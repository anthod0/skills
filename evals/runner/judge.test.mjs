import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { readRegular, writeTree } from "./files.mjs";
import { changesBetween } from "./submission.mjs";
import { conditions, criterionIds } from "./behavior.mjs";
import { reviewRun } from "./judge.mjs";

const selection = { provider: "example", model: "review-model" };
const originalSelection = { provider: "example", model: "agent-model" };
function packet(selected, files, text, events = []) {
  return {
    runtime: {
      uid: 1000,
      cwd: "/workspace",
      authMode: 0o600,
      provider: selected.provider,
      piVersion: "0.85.1",
      nodeVersion: "v22.19.0",
      mode: "review",
    },
    execution: { code: 0 },
    files,
    events: [
      ...events,
      {
        type: "message_end",
        message: {
          role: "assistant",
          ...selected,
          stopReason: "stop",
          content: [{ type: "text", text }],
        },
      },
      { type: "agent_end" },
    ],
  };
}

async function withArchive(run) {
  const temporaryBase = resolve(tmpdir());
  const realHome = resolve(homedir());
  const testRoot = await mkdtemp(join(temporaryBase, "skill-eval-review-"));
  try {
    const inputs = {
      manifest: { allowed_changes: ["tests/**"] },
      task: "Clean the test",
      files: { "tests/a.ts": "original", "src/a.ts": "unchanged" },
    };
    const inputsText = JSON.stringify(inputs);
    const original = {
      ...originalSelection,
      case: "clean-ai-slop/mixed-assertions",
      sourceHash: createHash("sha256").update(inputsText).digest("hex"),
    };
    const files = {
      "inputs.json": inputsText + "\n",
      "result.json": JSON.stringify(original),
      "auth.json": JSON.stringify({ example: { type: "api_key", key: "synthetic-review-key" } }),
    };
    for (const condition of conditions) {
      const exported = {
        ...inputs.files,
        "tests/a.ts": "cleaned",
        ...(condition === "with-skill" ? { "src/a.ts": "outside scope" } : {}),
      };
      const output = packet(originalSelection, exported, "Done");
      files[`${condition}/agent.json`] = JSON.stringify(output);
      files[`${condition}/trace.jsonl`] =
        output.events.map((event) => JSON.stringify(event)).join("\n") + "\n";
      files[`${condition}/changes.json`] = JSON.stringify(changesBetween(inputs.files, exported));
    }
    await writeTree(testRoot, files);
    await run(testRoot, { authFile: join(testRoot, "auth.json"), image: "sha256:test" });
  } finally {
    const belowTemporary = relative(temporaryBase, testRoot);
    assert.ok(
      belowTemporary && !belowTemporary.startsWith("..") && !belowTemporary.startsWith(sep),
    );
    assert.notEqual(testRoot, "/");
    assert.notEqual(testRoot, realHome);
    assert.ok(!realHome.startsWith(testRoot + sep));
    await rm(testRoot, { recursive: true, force: true });
  }
}

function successfulJudge(_image, payload) {
  const criteria = criterionIds(payload.systemPrompt).map((criterion) => ({
    criterion,
    verdict: "satisfied",
    evidence: ["change:tests/a.ts"],
    reason: "Synthetic judge result, not a semantic accuracy test",
  }));
  return { code: 0, stdout: JSON.stringify(packet(selection, {}, JSON.stringify({ criteria }))) };
}

test("re-review uses archived inputs, grades scope violations too, and never overwrites prior results", async () => {
  await withArchive(async (root, options) => {
    const original = await readRegular(join(root, "result.json"));
    let calls = 0;
    const run = async (image, payload) => {
      calls++;
      assert.deepEqual(payload.files, {});
      assert.deepEqual(payload.skills, {});
      assert.equal(payload.task.includes("without-skill"), false);
      assert.equal(payload.task.includes("with-skill"), false);
      assert.equal(payload.systemPrompt.includes("remove-low-value"), true);
      return successfulJudge(image, payload);
    };
    const first = await reviewRun(root, selection, { ...options, run });
    assert.equal(first.report.status, "violated");
    assert.equal(first.report.conditions[0].scope.ok, true);
    assert.equal(first.report.conditions[1].scope.ok, false);
    assert.ok(first.report.conditions.every((result) => result.behavior.criteria.length === 4));
    const saved = await readRegular(join(first.directory, "result.json"));
    const second = await reviewRun(root, selection, { ...options, run });
    assert.notEqual(first.directory, second.directory);
    assert.equal(await readRegular(join(first.directory, "result.json")), saved);
    assert.equal(await readRegular(join(root, "result.json")), original);
    assert.equal(calls, 4);
  });
});

test("mismatched, missing and oversized evidence fail before model calls rather than earning compliance", async () => {
  for (const problem of ["trace", "changes", "missing", "oversized"]) {
    await withArchive(async (root, options) => {
      for (const condition of conditions) {
        const path = join(root, condition);
        if (problem === "trace") await writeFile(join(path, "trace.jsonl"), "{}\n");
        if (problem === "changes") await writeFile(join(path, "changes.json"), "[]");
        if (problem === "missing") {
          const output = JSON.parse(await readRegular(join(path, "agent.json")));
          output.events.pop();
          await writeFile(join(path, "agent.json"), JSON.stringify(output));
        }
        if (problem === "oversized") {
          const output = JSON.parse(await readRegular(join(path, "agent.json")));
          output.events[0].message.content[0].text = "x".repeat(512 * 1024);
          await writeFile(join(path, "agent.json"), JSON.stringify(output));
          await writeFile(
            join(path, "trace.jsonl"),
            output.events.map((event) => JSON.stringify(event)).join("\n"),
          );
        }
      }
      let calls = 0;
      const review = await reviewRun(root, selection, {
        ...options,
        run: async (image, payload) => {
          calls++;
          return successfulJudge(image, payload);
        },
      });
      assert.equal(calls, 0);
      assert.equal(review.report.status, "error");
      assert.ok(
        review.report.conditions.every((result) => result.status === "error" && !result.behavior),
      );
    });
  }
});

test("judge protocol errors, tool attempts and transport failures remain review errors", async () => {
  for (const problem of ["json", "tool", "timeout"]) {
    await withArchive(async (root, options) => {
      const review = await reviewRun(root, selection, {
        ...options,
        run: async (image, payload) => {
          if (problem === "timeout") return { code: null, problem: "Timed out", stdout: "" };
          const execution = successfulJudge(image, payload);
          const output = JSON.parse(execution.stdout);
          if (problem === "json")
            output.events[0].message.content[0].text = "not JSON synthetic-review-key";
          else
            output.events[0].message.content.push({
              type: "toolCall",
              name: "bash",
              arguments: { command: "do not execute" },
            });
          return { code: 0, stdout: JSON.stringify(output) };
        },
      });
      assert.equal(review.report.status, "error");
      assert.ok(review.report.conditions.every((result) => !result.behavior));
      const saved = await readRegular(join(review.directory, "result.json"));
      assert.equal(saved.includes("synthetic-review-key"), false);
    });
  }
});

test("judge cleanup failure stops subsequent reviews", async () => {
  await withArchive(async (root, options) => {
    let calls = 0;
    const review = await reviewRun(root, selection, {
      ...options,
      run: async () => {
        calls++;
        return { code: 0, stdout: "", cleanupFailed: true };
      },
    });
    assert.equal(calls, 1);
    assert.equal(review.report.status, "error");
    assert.equal(review.report.conditions[0].cleanupFailed, true);
    assert.equal(review.report.conditions[1].status, "error");
    assert.equal(review.report.conditions[1].behavior, undefined);
  });
});
