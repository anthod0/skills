import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { caseIds, loadCase, conditionSkills, validateSubmission } from "./case.mjs";
import { runIsolated, decodeExecution, benchmarkDockerfile, resolveImage } from "./docker.mjs";
import { evaluateOracle } from "./evaluate.mjs";
import { assessAgent } from "../runner/agent-result.mjs";
import { git, exportPatch, agentTask, verifyActivation } from "./patch.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const image = `sha256:${"a".repeat(64)}`;

async function temporary(action) {
  const testRoot = await mkdtemp(join(tmpdir(), "skill-external-test-"));
  try {
    return await action(testRoot);
  } finally {
    assert.notEqual(testRoot, "/");
    assert.ok(resolve(testRoot).startsWith(resolve(tmpdir()) + "/"));
    await rm(testRoot, { recursive: true });
  }
}

test("all selected cases pass offline preflight and reject unrelated/unsafe IDs", async () => {
  for (const id of caseIds) {
    const materials = await loadCase(root, id);
    assert.equal(materials.manifest.classification, "B");
    assert.ok(materials.task.includes(materials.instance.problem_statement));
    assert.ok(!materials.task.includes(materials.instance.patch));
    assert.ok(!materials.task.includes(materials.instance.test_patch));
    const command = spawnSync(process.execPath, [join(root, "evaluate.mjs"), id, "--check"], {
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    assert.match(command.stdout, /no Docker, network, code execution or model calls/);
  }
  for (const id of ["../axios", "research/6", "test-filesystem-safety/ssh-hosts-list-filter"])
    await assert.rejects(loadCase(root, id), /Unsupported/);
});

test("a modified instance snapshot cannot silently change the fixed task", async () => {
  await temporary(async (testRoot) => {
    const id = caseIds[0];
    const materials = await loadCase(root, id);
    const directory = join(testRoot, "cases", id);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "case.json"), JSON.stringify(materials.manifest));
    await writeFile(
      join(directory, "instance.json"),
      JSON.stringify({ ...materials.instance, problem_statement: "replacement task" }),
    );
    await assert.rejects(loadCase(testRoot, id), /Invalid external case snapshot/);
  });
});

test("single-skill comparisons keep dependency materials identical", async () => {
  for (const id of caseIds) {
    const materials = await loadCase(root, id);
    const without = conditionSkills(materials, "without-skill");
    const withTarget = conditionSkills(materials, "with-skill");
    assert.ok(withTarget[`${materials.manifest.skill}/SKILL.md`]);
    assert.ok(!without[`${materials.manifest.skill}/SKILL.md`]);
    assert.ok(without["test-filesystem-safety/SKILL.md"]);
    for (const [path, content] of Object.entries(without)) assert.equal(withTarget[path], content);
  }
});

test("SWT cannot score a production repair or invalid patch as successful test generation", () => {
  const output = {
    patch: "diff --git a/sympy/core/tests/test_symbol.py b/sympy/core/tests/test_symbol.py\n",
    initial: {},
    files: { "sympy/core/tests/test_symbol.py": "assert True" },
  };
  assert.deepEqual(validateSubmission(output, "swt"), ["sympy/core/tests/test_symbol.py"]);
  assert.throws(
    () => validateSubmission({ ...output, files: { "sympy/core/symbol.py": "repair" } }, "swt"),
    /outside test directories/,
  );
  assert.throws(() => validateSubmission({ ...output, patch: "" }, "swt"), /nonempty/);
  assert.throws(
    () => validateSubmission({ ...output, patch: "GIT binary patch\n" }, "swt"),
    /text patch/,
  );
  assert.throws(
    () => validateSubmission({ ...output, files: { "../escape": "x" } }, "swt"),
    /Unsafe/,
  );
});

test("external containers are nonroot, bounded, mount-free, stdin-only and cleaned after interruption", async () => {
  const calls = [];
  const payload = { auth: "private credential" };
  const result = await runIsolated(image, ["node", "/harness/agent-entry.mjs"], payload, {
    network: "bridge",
    invoke: async (args, options) => {
      calls.push({ args, options });
      return args[0] === "run"
        ? { code: null, stdout: "", stderr: "", problem: "Interrupted" }
        : { code: 0, stdout: "", stderr: "" };
    },
  });
  const [run, cleanup] = calls;
  assert.ok(run.args.includes("--read-only"));
  assert.ok(run.args.includes("--user=1000:1000"));
  assert.ok(run.args.includes("--cap-drop=ALL"));
  assert.ok(run.args.includes("--memory=4g"));
  assert.ok(!run.args.some((arg) => /docker.sock|--mount|--volume|private credential/.test(arg)));
  assert.equal(run.options.input, JSON.stringify(payload));
  assert.equal(run.options.timeoutMs, 610_000);
  assert.equal(cleanup.args.at(-1), run.args[run.args.indexOf("--name") + 1]);
  assert.equal(cleanup.options.signal, undefined);
  assert.throws(() => decodeExecution(result), /Interrupted/);
});

test("cleanup failure invalidates a completed export", async () => {
  const result = await runIsolated(
    image,
    ["node"],
    {},
    {
      invoke: async (args) =>
        args[0] === "run"
          ? { code: 0, stdout: "{}", stderr: "" }
          : { code: 1, stdout: "", stderr: "busy" },
    },
  );
  assert.equal(result.cleanupFailed, true);
  assert.throws(() => decodeExecution(result), /cleanup failed/);
});

test("immutable benchmark images are reused locally without a floating-tag pull", async () => {
  const calls = [];
  const digest = `swebench/example@sha256:${"a".repeat(64)}`;
  const result = await resolveImage(digest, {
    invoke: async (args) => {
      calls.push(args);
      return {
        code: 0,
        stderr: "",
        stdout: JSON.stringify([{ Id: image, RepoDigests: [digest] }]),
      };
    },
  });
  assert.deepEqual(calls, [["image", "inspect", digest]]);
  assert.equal(result.image, image);
  await assert.rejects(resolveImage("swebench/example:latest"), /immutable/);
});

test("benchmark overlay removes future history and pins both image inputs", () => {
  const dockerfile = benchmarkDockerfile(image, image, "b".repeat(40), true);
  assert.match(dockerfile, /--depth=1 --single-branch/);
  assert.match(dockerfile, /remote remove origin/);
  assert.ok(!dockerfile.includes("reset --hard"), "preserve upstream dependency setup edits");
  assert.match(dockerfile, /WORKDIR \/testbed/);
  assert.match(dockerfile, /\/environment\/miniconda3/);
  assert.match(dockerfile, /USER 1000:1000/);
  assert.throws(
    () => benchmarkDockerfile("upstream:latest", image, "b".repeat(40), false),
    /Invalid/,
  );
});

test("SWT runs all six official stages and delegates grading without credentials", async () => {
  await temporary(async (testRoot) => {
    const materials = await loadCase(root, caseIds[1]);
    const stages = ["pred_pre", "pred_post", "gold_pre", "gold_post", "base_pre", "base_post"].map(
      (name) => ({ name, script: `run-${name}` }),
    );
    const calls = [];
    const official = { resolved: true, added_f2p: 1, coverage_delta_pred: 0.5 };
    const run = async (runtimeImage, command, payload) => {
      calls.push({ command, payload });
      let output;
      if (payload.action === "plan") output = { stages };
      else if (payload.action === "grade") output = { [materials.instance.instance_id]: official };
      else output = { code: 0, applied: true, log: payload.script };
      return { code: 0, stdout: JSON.stringify(output), stderr: "" };
    };
    const result = await evaluateOracle(materials, "test patch", {
      control: image,
      image,
      directory: join(testRoot, "oracle"),
      run,
    });
    assert.deepEqual(result, official);
    assert.equal(calls.length, 8);
    assert.deepEqual(
      calls.at(-1).payload.logs,
      stages.map((stage) => stage.script),
    );
    assert.ok(calls.every(({ payload }) => !Object.hasOwn(payload, "auth")));
    assert.ok(calls.slice(1, -1).every(({ payload }) => !Object.hasOwn(payload, "patch")));
  });
});

test("rename exports preserve production deletions, even after the agent commits", async () => {
  await temporary(async (testRoot) => {
    await mkdir(join(testRoot, "sympy/core/tests"), { recursive: true });
    await writeFile(join(testRoot, "sympy/core/symbol.py"), "class Symbol:\n    pass\n");
    git(["init", "-q"], testRoot);
    git(["config", "user.name", "Evaluation"], testRoot);
    git(["config", "user.email", "eval@invalid"], testRoot);
    git(["add", "--all"], testRoot);
    git(["commit", "-qm", "base"], testRoot);
    const base = git(["rev-parse", "HEAD"], testRoot).trim();
    await rename(
      join(testRoot, "sympy/core/symbol.py"),
      join(testRoot, "sympy/core/tests/symbol.py"),
    );
    git(["add", "--all"], testRoot);
    git(["commit", "-qm", "move"], testRoot);
    const output = await exportPatch(base, testRoot);
    assert.equal(output.initial["sympy/core/symbol.py"], "class Symbol:\n    pass\n");
    assert.equal(output.files["sympy/core/tests/symbol.py"], "class Symbol:\n    pass\n");
    assert.ok(!Object.hasOwn(output.files, "sympy/core/symbol.py"));
    assert.throws(() => validateSubmission(output, "swt"), /outside test directories/);
  });
});

test("runtime validation requires the real benchmark cwd without weakening fixture defaults", () => {
  const output = {
    runtime: {
      uid: 1000,
      cwd: "/testbed",
      authMode: 0o600,
      provider: "openai",
      piVersion: "0.85.1",
      nodeVersion: "v22.0.0",
    },
    execution: { code: 0 },
    events: [
      {
        type: "message_end",
        message: {
          role: "assistant",
          provider: "openai",
          model: "test",
          stopReason: "stop",
          content: [{ type: "text", text: "Done" }],
        },
      },
      { type: "agent_end" },
    ],
  };
  assert.equal(assessAgent(output, { provider: "openai", model: "test" }).ok, false);
  assert.equal(
    assessAgent(output, { provider: "openai", model: "test", cwd: "/testbed" }).ok,
    true,
  );
});

test("target skills use explicit Pi expansion and must be observed in user context", () => {
  const skills = { "implement/SKILL.md": "instructions" };
  assert.equal(agentTask("fix the issue", "implement", skills), "/skill:implement fix the issue");
  assert.equal(agentTask("fix the issue", undefined, {}), "fix the issue");
  assert.throws(() => agentTask("task", "implement", {}), /not supplied/);
  assert.throws(() => verifyActivation({ events: [] }, "implement"), /not observed/);
  assert.doesNotThrow(() =>
    verifyActivation(
      {
        events: [
          {
            type: "message_end",
            message: {
              role: "user",
              content: [
                {
                  type: "text",
                  text: '<skill name="implement" location="/run/pi-agent/skills/implement/SKILL.md">\\nloaded instructions',
                },
              ],
            },
          },
        ],
      },
      "implement",
    ),
  );
});

test("oracle timeout cannot become a benchmark pass", async () => {
  await temporary(async (testRoot) => {
    const materials = await loadCase(root, caseIds[0]);
    const run = async (_image, _command, payload) => ({
      code: 0,
      stderr: "",
      stdout: JSON.stringify(
        payload.action === "plan"
          ? { stages: [{ name: "tests", script: "tests" }] }
          : { code: null, problem: "ETIMEDOUT", log: "partial test output" },
      ),
    });
    await assert.rejects(
      evaluateOracle(materials, "patch", {
        control: image,
        image,
        directory: join(testRoot, "oracle"),
        run,
      }),
      /timed out/,
    );
  });
});
