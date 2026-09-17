import assert from "node:assert/strict";
import test from "node:test";
import { runPiContainer } from "./docker.mjs";

const payload = { budgetSeconds: 180 };

test("timed out containers are removed by their own name, independent of the aborted signal", async () => {
  const calls = [];
  const abort = new AbortController();
  const result = await runPiContainer("sha256:test", payload, {
    signal: abort.signal,
    invoke: async (args, options) => {
      calls.push({ args, options });
      if (args[0] === "run") {
        abort.abort();
        return { code: null, stdout: "", stderr: "", problem: "Timed out" };
      }
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const name = calls[0].args[calls[0].args.indexOf("--name") + 1];
  assert.deepEqual(calls[1].args, ["rm", "--force", name]);
  assert.equal(calls[1].options.signal, undefined);
  assert.equal(result.problem, "Timed out");
});

test("container cleanup failure invalidates an otherwise successful execution", async () => {
  const result = await runPiContainer("sha256:test", payload, {
    invoke: async (args) =>
      args[0] === "run"
        ? { code: 0, stdout: "finished", stderr: "" }
        : { code: 1, stdout: "", stderr: "daemon unavailable" },
  });
  assert.match(result.problem, /cleanup failed/);
  assert.equal(result.cleanupFailed, true);
  assert.equal(result.stdout, "finished");
});

test("a thrown launch error still triggers container cleanup", async () => {
  let removed = false;
  await assert.rejects(
    runPiContainer("sha256:test", payload, {
      invoke: async (args) => {
        if (args[0] === "run") throw new Error("launch failed");
        removed = true;
        return { code: 0, stdout: "", stderr: "" };
      },
    }),
    /launch failed/,
  );
  assert.equal(removed, true);
});
