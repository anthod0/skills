import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { loadCase, caseIds, conditionSkills, validateSubmission, pins, hash } from "./case.mjs";
import {
  runIsolated,
  decodeExecution,
  build,
  resolveImage,
  benchmarkDockerfile,
  pinBuildInput,
} from "./docker.mjs";
import { verifyActivation } from "./patch.mjs";
import { readRegular, readTree } from "../runner/files.mjs";
import { readAuth, redact } from "../runner/auth.mjs";
import { parseAgentOutput, assessAgent } from "../runner/agent-result.mjs";
import { sessionMessages } from "../runner/session.mjs";
import { runPiContainer } from "../runner/docker.mjs";
import { checkSelection } from "../runner/judge.mjs";
import {
  criterionIds,
  reviewMaterial,
  reviewRequest,
  parseReview,
  reviewStatus,
  reviewExitCode,
} from "../runner/behavior.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const saveJson = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");

async function prepare(materials, directory, signal) {
  const runner = await readTree(join(root, "..", "runner"));
  const controlFiles = Object.fromEntries(
    Object.entries(runner).map(([path, content]) => [`runner/${path}`, content]),
  );
  controlFiles.Dockerfile = await readRegular(join(root, "Dockerfile"));
  controlFiles["external/environment.py"] = await readRegular(join(root, "environment.py"));
  const control = await build(join(directory, "control-build"), controlFiles, { signal });
  let source;
  if (materials.manifest.benchmark === "swt") {
    const plan = decodeExecution(
      await runIsolated(
        control,
        ["/opt/harness-python/bin/python", "/harness/environment.py"],
        { instance: materials.instance },
        { signal, network: "bridge" },
      ),
    );
    await saveJson(join(directory, "environment-plan.json"), plan);
    for (const [index, stage] of plan.builds.entries()) {
      source = {
        image: await build(join(directory, `upstream-build-${index}`), stage.files, {
          tag: stage.tag,
          signal,
        }),
        digests: [],
      };
    }
  } else source = await resolveImage(materials.manifest.environment_image, { signal });
  await pinBuildInput(control, { signal });
  await pinBuildInput(source.image, { signal });
  const image = await build(
    join(directory, "benchmark-build"),
    {
      Dockerfile: benchmarkDockerfile(
        control,
        source.image,
        materials.instance.base_commit,
        materials.manifest.benchmark === "swt",
      ),
      "agent-entry.mjs": await readRegular(join(root, "agent-entry.mjs")),
      "patch.mjs": await readRegular(join(root, "patch.mjs")),
    },
    { signal },
  );
  const environment = {
    control,
    image,
    upstream: source,
    pins,
    platform: "linux/amd64",
    agentBudgetSeconds: 600,
    cpus: 1,
    memory: "4g",
    network: "bridge",
  };
  await saveJson(join(directory, "environment.json"), environment);
  return environment;
}

async function review(materials, output, selection, auth, image, directory, signal) {
  const prompt = await readRegular(join(root, "..", "runner", "judge-prompt.md"));
  const material = reviewMaterial({ task: materials.task, files: output.initial }, output);
  const request = reviewRequest(prompt, materials.criteria, material);
  await saveJson(join(directory, "review-request.json"), request);
  const execution = await runPiContainer(
    image,
    { ...selection, auth, ...request, files: {}, skills: {}, thinking: "high", budgetSeconds: 180 },
    { signal },
  );
  const judge = parseAgentOutput({ ...execution, stdout: redact(execution.stdout, auth) });
  await saveJson(join(directory, "judge.json"), judge);
  const assessment = assessAgent(judge, selection);
  await writeFile(join(directory, "judge-session.jsonl"), judge.sessionJsonl ?? "");
  const messages = sessionMessages(judge).filter((message) => message.role === "assistant");
  if (
    !assessment.ok ||
    judge.runtime.mode !== "review" ||
    assessment.toolCalls !== 0 ||
    messages.length !== 1
  )
    throw new Error("Judge did not finish a tool-free review");
  return {
    behavior: parseReview(assessment.finalResponse, materials.criteria, material),
    requestHash: hash(JSON.stringify(request)),
    judge: assessment,
  };
}

export async function main(args = process.argv.slice(2)) {
  const [id, provider, model, judgeProvider, judgeModel, authFile, ...extra] = args;
  const check = provider === "--check" && args.length === 2;
  const prepareOnly = provider === "--prepare" && args.length === 2;
  if (
    extra.length ||
    (!check && !prepareOnly && (!provider || !model || !judgeProvider || !judgeModel))
  )
    throw new Error(
      `Usage: eval-external.sh <${caseIds.join("|")}> --check|--prepare, or <case> <provider> <model> <judge-provider> <judge-model> [auth-file]`,
    );
  const materials = await loadCase(root, id);
  criterionIds(materials.criteria);
  if (check) {
    console.log(
      `${id}: pinned B case, two conditions, ${criterionIds(materials.criteria).length} behavior criteria; no Docker, network, code execution or model calls.`,
    );
    return;
  }
  let auth, judgeAuth;
  if (!prepareOnly) {
    checkSelection(provider, model);
    checkSelection(judgeProvider, judgeModel);
    auth = await readAuth(provider, authFile);
    judgeAuth = await readAuth(judgeProvider, authFile);
  }
  const directory = join(
    root,
    "..",
    "runs",
    `external-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`,
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const harness = {
    external: await readTree(root),
    runner: await readTree(join(root, "..", "runner")),
  };
  const inputs = { ...materials, harness, pins };
  await saveJson(join(directory, "inputs.json"), inputs);
  const report = {
    case: id,
    classification: "B",
    provider,
    model,
    judgeProvider,
    judgeModel,
    sourceHash: hash(JSON.stringify(inputs)),
    startedAt: new Date().toISOString(),
    status: "running",
    conditions: [],
  };
  const save = () => saveJson(join(directory, "result.json"), report);
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  console.log(`Results: ${directory}`);
  await save();
  try {
    report.environment = await prepare(materials, directory, abort.signal);
    if (prepareOnly) report.status = "prepared";
    else {
      for (const condition of ["without-skill", "with-skill"]) {
        if (abort.signal.aborted) throw new Error("Interrupted");
        const destination = join(directory, condition);
        await mkdir(destination);
        const supplied = conditionSkills(materials, condition);
        const result = {
          condition,
          status: "running",
          skillHashes: Object.fromEntries(
            Object.entries(supplied).map(([path, content]) => [path, hash(content)]),
          ),
        };
        report.conditions.push(result);
        await save();
        const execution = await runIsolated(
          report.environment.image,
          ["node", "/harness/external/agent-entry.mjs"],
          {
            provider,
            model,
            auth,
            task: materials.task,
            targetSkill: condition === "with-skill" ? materials.manifest.skill : undefined,
            skills: supplied,
            thinking: "high",
            budgetSeconds: 600,
          },
          { signal: abort.signal, network: "bridge" },
        );
        result.cleanupFailed = execution.cleanupFailed ?? false;
        const output = parseAgentOutput({ ...execution, stdout: redact(execution.stdout, auth) });
        await saveJson(join(destination, "agent.json"), output);
        await writeFile(join(destination, "session.jsonl"), output.sessionJsonl ?? "");
        result.agent = assessAgent(output, { provider, model, cwd: "/testbed" });
        if (!result.agent.ok) throw new Error(result.agent.reason);
        verifyActivation(output, condition === "with-skill" ? materials.manifest.skill : undefined);
        result.activation =
          condition === "with-skill" ? "explicit-command-observed" : "target-not-supplied";
        await writeFile(join(destination, "submission.patch"), output.patch ?? "");
        try {
          validateSubmission(output, materials.manifest.benchmark);
          result.scope = { ok: true };
        } catch (error) {
          result.scope = { ok: false, reason: error.message };
        }
        Object.assign(
          result,
          await review(
            materials,
            output,
            { provider: judgeProvider, model: judgeModel },
            judgeAuth,
            report.environment.control,
            destination,
            abort.signal,
          ),
        );
        result.status = "reviewed";
        await save();
      }
      report.status = reviewStatus(report.conditions);
    }
  } catch (error) {
    report.status = "error";
    report.error = auth ? redact(error.message, auth, judgeAuth) : error.message;
    for (const result of report.conditions)
      if (result.status === "running") result.status = "error";
  } finally {
    report.finishedAt = new Date().toISOString();
    await save();
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
  if (report.error) console.error(report.error);
  console.log(`External evaluation: ${report.status}`);
  process.exitCode = report.status === "prepared" ? 0 : reviewExitCode(report.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
