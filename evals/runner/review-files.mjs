import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readRegular } from "./files.mjs";

export const reviewDirectory = "/workspace/materials";
export const reviewFileNames = ["task.md", "session.jsonl", "initial.json", "changes.json"];

export function validateReviewFiles(files) {
  if (
    !files ||
    typeof files !== "object" ||
    Array.isArray(files) ||
    Object.keys(files).length !== reviewFileNames.length ||
    reviewFileNames.some((name) => typeof files[name] !== "string" || files[name].includes("\0"))
  )
    throw new Error("Expected task, native session, initial files and changes as review files");
}

export async function writeReviewFiles(files, directory = reviewDirectory) {
  validateReviewFiles(files);
  await mkdir(directory, { recursive: true });
  for (const name of reviewFileNames)
    await writeFile(join(directory, name), files[name], { flag: "wx", mode: 0o444 });
}

export async function verifyReviewFiles(files, directory = reviewDirectory) {
  for (const name of reviewFileNames) {
    const actual = await readRegular(join(directory, name), Buffer.byteLength(files[name]) + 1);
    if (actual !== files[name]) throw new Error("Judge modified review material");
  }
}
