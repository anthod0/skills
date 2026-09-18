import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// --check only reads case materials; it never executes fixture code or creates runs.
test("paired CLI accepts all supported case materials, including Replydesk CSS/prompt cleanup", () => {
  const entry = fileURLToPath(new URL("./evaluate.mjs", import.meta.url));
  for (const caseId of [
    "clean-ai-slop/mixed-assertions",
    "clean-ai-slop/css-and-prompt-assertions",
    "test-filesystem-safety/ssh-hosts-unsafe-append",
  ]) {
    const result = spawnSync(process.execPath, [entry, caseId, "--check"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.status, 0, `${caseId}: ${result.error?.message ?? result.stderr}`);
  }
});
