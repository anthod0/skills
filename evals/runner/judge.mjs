import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { readRegular, readTree } from "./files.mjs";
import { readAuth, redact } from "./auth.mjs";
import { buildImage, runPiContainer } from "./docker.mjs";
import { parseAgentOutput, assessAgent } from "./agent-result.mjs";
import { changesBetween, checkScope } from "./submission.mjs";
import {
  supportedCases,
  conditions,
  criterionIds,
  reviewMaterial,
  reviewRequest,
  parseReview,
  reviewStatus,
  reviewExitCode,
} from "./behavior.mjs";

const evalRoot = fileURLToPath(new URL("../", import.meta.url));
const hash = (text) => createHash("sha256").update(text).digest("hex");
const readArtifact = (path) => readRegular(path, 32 * 1024 * 1024);

export function checkSelection(provider, model) {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider ?? "") ||
    typeof model !== "string" ||
    !model ||
    model.startsWith("-")
  )
    throw new Error("Expected provider and exact model ID");
}

export async function reviewRun(
  directory,
  selection,
  { authFile, image, signal, run = runPiContainer } = {},
) {
  checkSelection(selection.provider, selection.model);
  const original = JSON.parse(await readArtifact(join(directory, "result.json")));
  if (!supportedCases.includes(original.case)) throw new Error("Unsupported review case");
  checkSelection(original.provider, original.model);
  const inputsText = await readArtifact(join(directory, "inputs.json"));
  if (hash(inputsText.trimEnd()) !== original.sourceHash)
    throw new Error("Input snapshot hash mismatch");
  const inputs = JSON.parse(inputsText);
  checkScope([], inputs.manifest.allowed_changes);
  // Re-review deliberately uses the current rubric, but the original task and code.
  const criteria = await readRegular(join(evalRoot, "cases", original.case, "oracle/criteria.md"));
  criterionIds(criteria);
  const prompt = await readRegular(join(evalRoot, "runner/judge-prompt.md"));
  const reviewRoot = join(
    directory,
    "reviews",
    `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`,
  );
  await mkdir(reviewRoot, { recursive: true, mode: 0o700 });
  const report = {
    case: original.case,
    ...selection,
    thinking: "high",
    budgetSeconds: 180,
    sourceHash: original.sourceHash,
    startedAt: new Date().toISOString(),
    status: "running",
    conditions: [],
  };
  const save = () =>
    writeFile(join(reviewRoot, "result.json"), JSON.stringify(report, null, 2) + "\n");
  let auth;
  console.log(`Review: ${reviewRoot}`);
  try {
    await writeFile(
      join(reviewRoot, "inputs.json"),
      JSON.stringify({
        criteria,
        prompt,
        harness: await readTree(join(evalRoot, "runner")),
      }) + "\n",
    );
    if (original.conditions?.some((result) => result.cleanupFailed))
      throw new Error("Archived agent container cleanup failed; review stopped");
    // Validate all archived evidence before calling a model or building an image.
    const prepared = [];
    for (const condition of conditions) {
      const result = { condition, status: "running" };
      report.conditions.push(result);
      try {
        const root = join(directory, condition);
        const output = parseAgentOutput({
          code: 0,
          stdout: await readArtifact(join(root, "agent.json")),
        });
        result.agent = assessAgent(output, original);
        if (!result.agent.ok) throw new Error(result.agent.reason);
        const trace = (await readArtifact(join(root, "trace.jsonl")))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        if (JSON.stringify(trace) !== JSON.stringify(output.events))
          throw new Error("Trace does not match agent export");
        const changes = changesBetween(inputs.files, output.files);
        if (
          JSON.stringify(JSON.parse(await readArtifact(join(root, "changes.json")))) !==
          JSON.stringify(changes)
        )
          throw new Error("Changes do not match initial files and agent export");
        result.scope = checkScope(changes, inputs.manifest.allowed_changes);
        const material = reviewMaterial(inputs, output);
        const request = reviewRequest(prompt, criteria, material);
        const destination = join(reviewRoot, condition);
        await mkdir(destination);
        const serialized = JSON.stringify(request);
        await writeFile(join(destination, "request.json"), serialized + "\n");
        result.requestHash = hash(serialized);
        prepared.push({ result, material, request, destination });
      } catch (error) {
        result.status = "error";
        result.error = error.message;
      }
    }
    await save();
    if (prepared.length) {
      auth = await readAuth(selection.provider, authFile);
      if (image) report.image = image;
      else Object.assign(report, await buildImage(reviewRoot, signal));
    }
    for (const { result, material, request, destination } of prepared) {
      if (signal?.aborted) throw new Error("Interrupted");
      const started = Date.now();
      try {
        const execution = await run(
          report.image,
          {
            ...selection,
            auth,
            ...request,
            files: {},
            skills: {},
            thinking: report.thinking,
            budgetSeconds: report.budgetSeconds,
          },
          { signal },
        );
        result.judgeElapsedMs = Date.now() - started;
        result.cleanupFailed = execution.cleanupFailed ?? false;
        const output = parseAgentOutput({
          ...execution,
          // A cleanup error invalidates the run, not an already completed safe export.
          problem: execution.cleanupFailed ? undefined : execution.problem,
          stdout: redact(execution.stdout, auth),
        });
        await writeFile(join(destination, "judge.json"), JSON.stringify(output, null, 2) + "\n");
        if (execution.cleanupFailed) throw new Error("Judge container cleanup failed");
        result.judge = assessAgent(output, selection);
        const messages = output.events.filter(
          (event) => event.type === "message_end" && event.message?.role === "assistant",
        );
        if (
          !result.judge.ok ||
          output.runtime.mode !== "review" ||
          messages.length !== 1 ||
          result.judge.toolCalls !== 0 ||
          messages[0].message.content.some((part) => part.type === "toolCall")
        )
          throw new Error("Judge must finish one response without tools or compaction");
        result.behavior = parseReview(result.judge.finalResponse, criteria, material);
        result.status = "reviewed";
      } catch (error) {
        result.status = "error";
        result.error = redact(error.message, auth);
      }
      await save();
      if (result.cleanupFailed)
        throw new Error("Judge container cleanup failed; further reviews stopped");
    }
    report.status = reviewStatus(report.conditions);
  } catch (error) {
    report.status = "error";
    report.error = auth ? redact(error.message, auth) : error.message;
  } finally {
    for (const result of report.conditions) {
      if (result.status === "running") {
        result.status = "error";
        result.error = report.error ?? "Review did not complete";
      }
    }
    report.finishedAt = new Date().toISOString();
    await save();
  }
  console.log(`Behavior review: ${report.status}`);
  return { directory: reviewRoot, report };
}

async function main() {
  const [directory, provider, model, authFile, ...extra] = process.argv.slice(2);
  if (!directory || extra.length)
    throw new Error(
      "Usage: bun evals/runner/judge.mjs <run-directory> <provider> <model> [auth-file]",
    );
  checkSelection(provider, model);
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    const { report } = await reviewRun(
      resolve(directory),
      { provider, model },
      { authFile, signal: abort.signal },
    );
    process.exitCode = reviewExitCode(report.status);
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
