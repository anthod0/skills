import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { readRegular, readTree } from "./files.mjs";
import { readCase } from "./case.mjs";
import { readAuth, redact } from "./auth.mjs";
import { buildImage, runPiContainer } from "./docker.mjs";
import { parseAgentOutput, assessAgent } from "./agent-result.mjs";
import { changesBetween, checkScope } from "./submission.mjs";
import { supportedCases, conditions, criterionIds, reviewExitCode } from "./behavior.mjs";
import { checkSelection, reviewRun } from "./judge.mjs";

const evalRoot = fileURLToPath(new URL("../", import.meta.url));
const hash = (text) => createHash("sha256").update(text).digest("hex");

async function main() {
  const [caseId, provider, model, judgeProvider, judgeModel, authFile, ...extra] =
    process.argv.slice(2);
  const checkOnly = provider === "--check" && model === undefined;
  if (
    !supportedCases.includes(caseId) ||
    extra.length ||
    (!checkOnly && (!judgeProvider || !judgeModel))
  )
    throw new Error(
      `Usage: bun evals/runner/evaluate.mjs <${supportedCases.join("|")}> <provider> <model> <judge-provider> <judge-model> [auth-file], or <case> --check`,
    );
  if (!checkOnly) {
    checkSelection(provider, model);
    checkSelection(judgeProvider, judgeModel);
  }
  const { caseRoot, manifest, files } = await readCase(evalRoot, caseId);
  if (manifest.fixture !== "ssh-hosts" || manifest.skill !== caseId.split("/")[0])
    throw new Error("Unsupported case manifest");
  const task = await readRegular(join(caseRoot, "task.md"));
  const criteria = await readRegular(join(caseRoot, "oracle/criteria.md"));
  const ids = criterionIds(criteria);
  checkScope([], manifest.allowed_changes);
  const skills = Object.create(null);
  const suppliedSkills =
    manifest.skill === "clean-ai-slop"
      ? ["clean-ai-slop", "test-filesystem-safety"]
      : [manifest.skill];
  for (const skill of suppliedSkills) {
    for (const [path, text] of Object.entries(
      await readTree(join(evalRoot, "..", "skills", skill)),
    ))
      skills[`${skill}/${path}`] = text;
  }
  if (checkOnly) {
    console.log(
      `${caseId}: 2 agent conditions, ${ids.length} behavior criteria; no code executed or model called.`,
    );
    return;
  }
  const auth = await readAuth(provider, authFile);
  // Fail before paid agent work if the explicitly selected judge has no stored login.
  await readAuth(judgeProvider, authFile);
  const directory = join(
    evalRoot,
    "runs",
    `comparison-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`,
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const inputs = JSON.stringify({
    manifest,
    task,
    files,
    criteria,
    skills,
    harness: await readTree(join(evalRoot, "runner")),
  });
  await writeFile(join(directory, "inputs.json"), inputs + "\n");
  const report = {
    case: caseId,
    provider,
    model,
    judgeProvider,
    judgeModel,
    thinking: "high",
    budgetSeconds: 600,
    sourceHash: hash(inputs),
    startedAt: new Date().toISOString(),
    status: "running",
    conditions: [],
  };
  const save = () =>
    writeFile(join(directory, "result.json"), JSON.stringify(report, null, 2) + "\n");
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  console.log(`Results: ${directory}`);
  try {
    Object.assign(report, await buildImage(directory, abort.signal, files));
    for (const condition of conditions) {
      if (abort.signal.aborted) throw new Error("Interrupted");
      const conditionRoot = join(directory, condition);
      await mkdir(conditionRoot);
      const supplied = condition === "with-skill" ? skills : {};
      const result = {
        condition,
        status: "running",
        skillHashes: Object.fromEntries(
          Object.entries(supplied).map(([path, text]) => [path, hash(text)]),
        ),
      };
      report.conditions.push(result);
      await save();
      console.log(`Running ${condition} (${report.budgetSeconds}s budget)...`);
      const started = Date.now();
      const execution = await runPiContainer(
        report.image,
        {
          provider,
          model,
          auth,
          task,
          files,
          skills: supplied,
          thinking: report.thinking,
          budgetSeconds: report.budgetSeconds,
        },
        { signal: abort.signal },
      );
      result.agentElapsedMs = Date.now() - started;
      result.cleanupFailed = execution.cleanupFailed ?? false;
      if (execution.cleanupFailed) throw new Error(execution.problem);
      try {
        const output = parseAgentOutput({ ...execution, stdout: redact(execution.stdout, auth) });
        await writeFile(join(conditionRoot, "agent.json"), JSON.stringify(output, null, 2) + "\n");
        await writeFile(
          join(conditionRoot, "trace.jsonl"),
          output.events.map((event) => JSON.stringify(event)).join("\n") + "\n",
        );
        result.agent = assessAgent(output, { provider, model });
        result.runtime = output.runtime;
        if (!result.agent.ok) throw new Error(result.agent.reason);
        const changes = changesBetween(files, output.files);
        await writeFile(
          join(conditionRoot, "changes.json"),
          JSON.stringify(changes, null, 2) + "\n",
        );
        result.scope = checkScope(changes, manifest.allowed_changes);
        result.status = "recorded";
      } catch (error) {
        result.status = "invalid-run";
        result.error = redact(error.message, auth);
      }
      await save();
    }
    // Scope violations still receive behavior review: neither dimension hides the other.
    report.status = "recorded";
    await save();
    const review = await reviewRun(
      directory,
      { provider: judgeProvider, model: judgeModel },
      {
        authFile,
        image: report.image,
        signal: abort.signal,
      },
    );
    report.review = relative(directory, join(review.directory, "result.json"));
    report.status = review.report.status;
  } catch (error) {
    report.status = "error";
    report.error = redact(error.message, auth);
    console.error(report.error);
  } finally {
    report.finishedAt = new Date().toISOString();
    await save();
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
  console.log(`Comparison: ${report.status}`);
  process.exitCode = reviewExitCode(report.status);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 2;
});
