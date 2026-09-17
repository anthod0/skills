import { cp } from "node:fs/promises";
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
