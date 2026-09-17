import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { updateConfig, type Change } from "./config.js";

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function snapshot(file: string) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new Error("Config must be a regular file, not a symlink or hard link.");
    }
    return { text: await readFile(file, "utf8"), mode: stat.mode & 0o777 };
  } catch (error) {
    if (missing(error)) return { text: "", mode: 0o600 };
    throw error;
  }
}

export async function readConfig(file: string): Promise<string> {
  return (await snapshot(file)).text;
}

export async function editConfig(file: string, change: Change): Promise<void> {
  const original = await snapshot(file);
  const updated = updateConfig(original.text, change);
  if (updated === original.text) return;

  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    try {
      await handle.writeFile(updated, "utf8");
      await handle.chmod(original.mode);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error: unknown) => {
      if (!missing(error)) throw error;
    });
  }
}
