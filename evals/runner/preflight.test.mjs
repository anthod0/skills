import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// --check only reads case materials; it never executes fixture code or creates runs.
test("paired CLI accepts supported development and test revision case materials", () => {
  const entry = fileURLToPath(new URL("./evaluate.mjs", import.meta.url));
  for (const caseId of [
    "write-good-test/mixed-assertions",
    "write-good-test/css-and-prompt-assertions",
    "write-good-test/reply-language",
    "test-filesystem-safety/ssh-hosts-list-filter",
  ]) {
    const result = spawnSync(process.execPath, [entry, caseId, "--check"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.status, 0, `${caseId}: ${result.error?.message ?? result.stderr}`);
  }
});
