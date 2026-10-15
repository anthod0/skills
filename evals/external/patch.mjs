import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { readRegular, checkFiles, checkPath } from "../runner/files.mjs";
import { sessionMessages } from "../runner/session.mjs";

export function git(args, cwd = "/workspace") {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error("Cannot prepare/export benchmark repository");
  return result.stdout;
}

export async function exportPatch(base, cwd = "/workspace") {
  if (!/^[a-f0-9]{40}$/.test(base)) throw new Error("Invalid baseline commit");
  git(["add", "--intent-to-add", "--all"], cwd);
  // Export renames as deletion + addition: both paths must enter evidence/scope.
  const args = ["diff", "--no-renames", "--no-ext-diff", "--no-textconv"];
  const patch = git([...args, "--binary", base, "--"], cwd);
  if (/^GIT binary patch$/m.test(patch) || Buffer.byteLength(patch) > 1024 * 1024)
    throw new Error("Binary or oversized patch");
  const names = git([...args, "--name-only", "-z", base, "--"], cwd)
    .split("\0")
    .filter(Boolean);
  const initial = Object.create(null);
  const files = Object.create(null);
  for (const path of names) {
    checkPath(path);
    const before = spawnSync("git", ["show", `${base}:${path}`], {
      cwd,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    if (before.error) throw new Error("Cannot read baseline evidence");
    if (before.status === 0) initial[path] = before.stdout;
    try {
      files[path] = await readRegular(join(cwd, path));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  checkFiles(initial);
  checkFiles(files);
  return { patch, initial, files };
}

export function agentTask(task, targetSkill, skills) {
  if (!targetSkill) return task;
  if (!/^[a-z][a-z0-9-]*$/.test(targetSkill) || !skills[`${targetSkill}/SKILL.md`])
    throw new Error("Explicit target skill was not supplied");
  return `/skill:${targetSkill} ${task}`;
}

export function verifyActivation(output, targetSkill) {
  if (!targetSkill) return;
  const marker = `<skill name="${targetSkill}" location="/run/pi-agent/skills/${targetSkill}/SKILL.md">`;
  const activated = sessionMessages(output).some(
    (message) =>
      message.role === "user" &&
      (typeof message.content === "string"
        ? message.content.startsWith(marker)
        : message.content?.some((part) => part.type === "text" && part.text.startsWith(marker))),
  );
  if (!activated) throw new Error("Target skill expansion was not observed in the agent context");
}
