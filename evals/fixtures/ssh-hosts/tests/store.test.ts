import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import test, { type TestContext } from "node:test";
import { listHosts } from "../src/config.js";
import { editConfig, readConfig } from "../src/store.js";

async function sandbox(t: TestContext) {
  const temporaryDirectory = resolve(tmpdir());
  const userHome = resolve(homedir());
  const testRoot = await mkdtemp(join(temporaryDirectory, "ssh-hosts-"));
  t.after(async () => {
    const root = resolve(testRoot);
    const withinTemp = relative(temporaryDirectory, root);
    if (
      !testRoot ||
      !withinTemp ||
      isAbsolute(withinTemp) ||
      withinTemp === ".." ||
      withinTemp.startsWith(`..${sep}`) ||
      root === userHome ||
      userHome.startsWith(root + sep)
    ) {
      throw new Error("Refusing cleanup outside the allocated temporary directory.");
    }
    await rm(testRoot, { recursive: true, force: true });
  });
  return join(testRoot, ".ssh", "config");
}

test("creates a missing config with private permissions", async (t) => {
  const file = await sandbox(t);
  assert.equal(await readConfig(file), "");
  await editConfig(file, { kind: "add", alias: "nas", options: { host: "192.168.1.20" } });
  assert.deepEqual(listHosts(await readFile(file, "utf8")), [
    { alias: "nas", host: "192.168.1.20" },
  ]);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test("preserves existing permissions and leaves no temporary file after an edit", async (t) => {
  const file = await sandbox(t);
  const directory = dirname(file);
  await mkdir(directory, { mode: 0o700 });
  await writeFile(file, "Host nas\n  HostName 192.168.1.20\n");
  await chmod(file, 0o640);
  await editConfig(file, { kind: "set", alias: "nas", options: { user: "sam" } });
  assert.equal(listHosts(await readFile(file, "utf8"))[0].user, "sam");
  assert.equal((await stat(file)).mode & 0o777, 0o640);
  assert.deepEqual(await readdir(directory), ["config"]);
});

test("an invalid edit leaves the file untouched", async (t) => {
  const file = await sandbox(t);
  const original = "Host nas\n  HostName 192.168.1.20\n";
  await mkdir(dirname(file));
  await writeFile(file, original);
  await assert.rejects(editConfig(file, { kind: "set", alias: "nas", options: { port: "-1" } }));
  assert.equal(await readFile(file, "utf8"), original);
});

test("refuses a symlink instead of replacing it or writing through it", async (t) => {
  const file = await sandbox(t);
  const target = join(dirname(file), "dotfiles-config");
  const original = "Host nas\n  HostName 192.168.1.20\n";
  await mkdir(dirname(file));
  await writeFile(target, original);
  await symlink(target, file);
  await assert.rejects(editConfig(file, { kind: "remove", alias: "nas" }));
  assert.equal(await readFile(target, "utf8"), original);
});
