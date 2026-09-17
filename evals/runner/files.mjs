import { constants } from "node:fs";
import { open, lstat, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { checkPath } from "./plan.mjs";

const fileLimit = 1024 * 1024;
const treeLimit = 16 * 1024 * 1024;
const entryLimit = 512;

export function checkFiles(files) {
  if (!files || typeof files !== "object" || Array.isArray(files))
    throw new Error("Expected text file map");
  let size = 0;
  const paths = Object.keys(files);
  const directories = new Set();
  if (paths.length > entryLimit) throw new Error("Too many files");
  for (const [path, text] of Object.entries(files)) {
    checkPath(path);
    if (path.split("/").includes(".git")) throw new Error("Git metadata is reserved");
    if (typeof text !== "string" || text.includes("\0") || Buffer.byteLength(text) > fileLimit)
      throw new Error("Invalid or oversized text file");
    size += Buffer.byteLength(text);
    const parts = path.split("/");
    for (let length = 1; length < parts.length; length++) {
      const parent = parts.slice(0, length).join("/");
      if (Object.hasOwn(files, parent)) throw new Error(`File/directory conflict: ${parent}`);
      directories.add(parent);
      if (paths.length + directories.size > entryLimit) throw new Error("Too many tree entries");
    }
  }
  if (size > treeLimit) throw new Error("File tree too large");
}

export async function readRegular(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > fileLimit)
      throw new Error("Expected bounded regular file, not a link");
    const buffer = Buffer.alloc(fileLimit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > fileLimit) throw new Error("File too large");
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      buffer.subarray(0, length),
    );
    if (text.includes("\0")) throw new Error("Binary file is not supported");
    return text;
  } finally {
    await handle.close();
  }
}

export async function readTree(root, { ignoreGit = false, excludeRoots = [] } = {}) {
  const files = Object.create(null);
  let entries = 0;
  let size = 0;
  async function visit(directory, prefix = "") {
    if (!(await lstat(directory)).isDirectory()) throw new Error("Expected directory, not symlink");
    for (const name of (await readdir(directory)).sort()) {
      if (!prefix && ignoreGit && name === ".git") continue;
      const path = join(directory, name);
      const info = await lstat(path);
      if (!prefix && excludeRoots.includes(name) && info.isDirectory()) continue;
      if (++entries > entryLimit) throw new Error("Too many tree entries");
      const relative = prefix + name;
      checkPath(relative);
      if (info.isDirectory()) await visit(path, relative + "/");
      else {
        files[relative] = await readRegular(path);
        size += Buffer.byteLength(files[relative]);
        if (size > treeLimit) throw new Error("File tree too large");
      }
    }
  }
  await visit(root);
  checkFiles(files);
  return files;
}

export async function writeTree(root, files) {
  checkFiles(files);
  for (const [path, text] of Object.entries(files)) {
    const destination = join(root, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, text, { flag: "wx" });
  }
}
