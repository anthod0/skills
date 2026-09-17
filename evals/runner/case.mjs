import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { checkPath } from "./plan.mjs";
import { checkFiles, readRegular, readTree } from "./files.mjs";

async function isDirectory(path) {
  try {
    return (await lstat(path)).isDirectory();
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

export async function readCase(evalRoot, caseId) {
  checkPath(caseId);
  if (caseId.split("/").length !== 2) throw new Error("Expected skill/case");
  const caseRoot = join(evalRoot, "cases", caseId);
  const manifest = JSON.parse(await readRegular(join(caseRoot, "case.json")));
  checkPath(manifest.fixture);
  if (manifest.fixture.includes("/")) throw new Error("Fixture must name one directory");
  const fixtureRoot = join(evalRoot, "fixtures", manifest.fixture);
  const files = await readTree(fixtureRoot);
  const inputRoot = join(caseRoot, "input");
  let inputExists = true;
  try {
    await lstat(inputRoot);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    inputExists = false;
  }
  if (inputExists) {
    const input = await readTree(inputRoot);
    for (const [source, content] of Object.entries(input)) {
      const destination = source.endsWith(".txt") ? source.slice(0, -4) : source;
      checkPath(destination);
      if (Object.hasOwn(files, destination))
        throw new Error(`Case input path collision: ${destination}`);
      // Empty source directories are absent from the file map, but cannot be replaced.
      for (const root of [fixtureRoot, inputRoot]) {
        if (await isDirectory(join(root, destination)))
          throw new Error(`Case input file/directory conflict: ${destination}`);
      }
      files[destination] = content;
    }
  }
  checkFiles(files);
  return { caseRoot, manifest, files };
}
