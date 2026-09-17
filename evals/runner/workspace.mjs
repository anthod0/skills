import { cp, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// These paths are generated inside the container, never evaluation inputs/exports.
export const generatedPaths = ["node_modules", ".svelte-kit", "build", "dist"];

export async function prepareWorkspace(files) {
  if (!files["package.json"]) return;
  await cp("/opt/dependencies/node_modules", "/workspace/node_modules", {
    recursive: true,
    verbatimSymlinks: true,
  });
  if (JSON.parse(files["package.json"]).name === "replydesk") {
    const result = spawnSync("node", ["node_modules/@sveltejs/kit/svelte-kit.js", "sync"], {
      cwd: "/workspace",
      encoding: "utf8",
      timeout: 30_000,
    });
    if (result.status !== 0) throw new Error(`Svelte sync failed: ${result.stderr}`);
  }
}

export async function testInvocation(files, command) {
  if (command[0] === "node")
    return ["node", "--test", "--test-reporter=/harness/reporter.mjs", ...command.slice(2)];
  if (JSON.parse(files["package.json"]).name === "ssh-hosts") {
    const tests = (await readdir("/workspace/tests"))
      .filter((name) => name.endsWith(".test.ts"))
      .sort()
      .map((name) => `tests/${name}`);
    if (!tests.length) throw new Error("No SSH tests");
    return ["node", "--import", "tsx", "--test", "--test-reporter=/harness/reporter.mjs", ...tests];
  }
  return [
    "node",
    "node_modules/vitest/vitest.mjs",
    "run",
    "--reporter=/harness/vitest-reporter.mjs",
  ];
}
