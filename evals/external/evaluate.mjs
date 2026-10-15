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

export async function evaluateOracle(
  materials,
  patch,
  { control, image, directory, signal, run = runIsolated },
) {
  await mkdir(directory, { recursive: true });
  const request = {
    action: "plan",
    benchmark: materials.manifest.benchmark,
    instance: materials.instance,
    patch,
  };
  const plan = decodeExecution(
    await run(control, ["/opt/harness-python/bin/python", "/harness/adapter.py"], request, {
      signal,
      network: "bridge",
    }),
  );
  await saveJson(join(directory, "plan.json"), plan);
  const logs = [];
  for (const stage of plan.stages) {
    const execution = await run(
      image,
      ["node", "/harness/external/oracle-entry.mjs"],
      { script: stage.script, ...(materials.manifest.benchmark === "swe" ? { patch } : {}) },
      { signal, network: "bridge" },
    );
    await saveJson(join(directory, `${stage.name}-execution.json`), execution);
    const output = decodeExecution(execution);
    await saveJson(join(directory, `${stage.name}.json`), output);
    if (output.problem || output.code === null)
      throw new Error(`Oracle ${stage.name} timed out or exceeded its output limit`);
    // A rejected model patch is an unsuccessful submission, not a test pass.
    // Reference-patch failures are detected by the preflight gold validation.
    logs.push(output.log);
  }
  const grades = decodeExecution(
    await run(
      control,
      ["/opt/harness-python/bin/python", "/harness/adapter.py"],
      {
        action: "grade",
        benchmark: materials.manifest.benchmark,
        instance: materials.instance,
        patch,
        logs,
      },
      { signal },
    ),
  );
  await saveJson(join(directory, "official.json"), grades);
  return grades[materials.manifest.instance_id];
}

async function prepare(materials, directory, signal) {
  const runner = await readTree(join(root, "..", "runner"));
  const controlFiles = Object.fromEntries(
    Object.entries(runner).map(([path, content]) => [`runner/${path}`, content]),
  );
  controlFiles.Dockerfile = await readRegular(join(root, "Dockerfile"));
  controlFiles["external/adapter.py"] = await readRegular(join(root, "adapter.py"));
  const control = await build(join(directory, "control-build"), controlFiles, { signal });
  const metadata = decodeExecution(
    await runIsolated(
      control,
      ["/opt/harness-python/bin/python", "/harness/adapter.py"],
      { action: "metadata" },
      { signal },
    ),
  );
  await saveJson(join(directory, "harness-environment.json"), metadata);
  const plan = decodeExecution(
    await runIsolated(
      control,
      ["/opt/harness-python/bin/python", "/harness/adapter.py"],
      { action: "plan", benchmark: materials.manifest.benchmark, instance: materials.instance },
      { signal, network: "bridge" },
    ),
  );
  await saveJson(join(directory, "environment-plan.json"), plan);
  let source;
  if (plan.builds) {
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
      "oracle-entry.mjs": await readRegular(join(root, "oracle-entry.mjs")),
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
    oracleStageBudgetSeconds: 600,
    cpus: 1,
    memory: "4g",
    network: "bridge",
  };
  await saveJson(join(directory, "environment.json"), environment);
  const gold = await evaluateOracle(
    materials,
    materials.instance[materials.manifest.benchmark === "swe" ? "patch" : "test_patch"],
    { control, image, directory: join(directory, "validation-gold"), signal },
  );
  if (!gold?.resolved)
    throw new Error("Reference oracle did not resolve; environment is not validated");
  if (materials.manifest.benchmark === "swe") {
    const baseline = await evaluateOracle(materials, "", {
      control,
      image,
      directory: join(directory, "validation-base"),
      signal,
    });
    if (baseline?.resolved || !baseline?.patch_successfully_applied || baseline?.infra_failure)
      throw new Error("Baseline oracle is invalid or already resolves the issue");
  }
  return { ...environment, validated: true };
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
  const messages = judge.events.filter(
    (event) => event.type === "message_end" && event.message?.role === "assistant",
  );
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
        await writeFile(
          join(destination, "trace.jsonl"),
          output.events.map((event) => JSON.stringify(event)).join("\n") + "\n",
        );
        result.agent = assessAgent(output, { provider, model, cwd: "/testbed" });
        if (!result.agent.ok) throw new Error(result.agent.reason);
        verifyActivation(output, condition === "with-skill" ? materials.manifest.skill : undefined);
        result.activation =
          condition === "with-skill" ? "explicit-command-observed" : "target-not-supplied";
        await writeFile(join(destination, "submission.patch"), output.patch ?? "");
        await saveJson(join(destination, "prediction.json"), {
          instance_id: materials.manifest.instance_id,
          model_name_or_path: condition,
          model_patch: output.patch,
        });
        try {
          validateSubmission(output, materials.manifest.benchmark);
          result.scope = { ok: true };
        } catch (error) {
          result.scope = { ok: false, reason: error.message };
        }
        if (result.scope.ok)
          result.official = await evaluateOracle(materials, output.patch, {
            ...report.environment,
            directory: join(destination, "oracle"),
            signal: abort.signal,
          });
        else
          result.official = {
            excluded: true,
            reason: "Invalid submission scope/evidence; not scored",
          };
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
      report.behaviorStatus = reviewStatus(report.conditions);
      // Behavioral compliance and benchmark resolution are never combined into a score.
      report.status = report.behaviorStatus;
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
