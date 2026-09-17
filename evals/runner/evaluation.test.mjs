import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, symlink, link, unlink, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { changesBetween, checkScope } from "./submission.mjs";
import { readTree, readRegular, checkFiles, checkPath, writeTree } from "./files.mjs";
import { generatedPaths } from "./workspace.mjs";

const original = { "src/a.mjs": "const value = 1;", "tests/old.test.mjs": "old checks" };
const submitted = { "src/a.mjs": original["src/a.mjs"], "tests/new.test.mjs": "behavior checks" };

test("submission scope tracks additions, deletions, and forbidden edits, without constraining test names", () => {
  assert.deepEqual(changesBetween(original, submitted), [
    { path: "tests/new.test.mjs", before: null, after: "behavior checks" },
    { path: "tests/old.test.mjs", before: "old checks", after: null },
  ]);
  assert.equal(checkScope(changesBetween(original, submitted), ["tests/**"]).ok, true);
  for (const files of [
    { ...submitted, "src/a.mjs": "changed" },
    { "tests/new.test.mjs": "checks" },
    { ...submitted, "tests-escape/file": "unexpected" },
  ]) {
    assert.equal(checkScope(changesBetween(original, files), ["tests/**"]).ok, false);
  }
  assert.deepEqual(
    checkScope(changesBetween(original, { ...original, "README.md": "allowed" }), ["README.md"]),
    { ok: true, violations: [] },
  );
  for (const path of [
    "/tmp/a",
    "../a",
    "tests/../../a",
    "tests\\a",
    "tests//a",
    "src/routes/$(command)",
  ])
    assert.throws(() => checkPath(path), /Unsafe/);
  assert.throws(() => checkScope([], ["../outside/**"]), /Unsafe/);
});

test("workspace export rejects escapes, non-text files, links, and oversized files without following them", async () => {
  const temporaryBase = resolve(tmpdir());
  const realHome = resolve(homedir());
  const testRoot = await mkdtemp(join(temporaryBase, "skill-eval-export-"));
  try {
    const text = "\ufeffinert UTF-8 text: café\n";
    await writeTree(testRoot, { "tests/example.mjs": text });
    assert.deepEqual({ ...(await readTree(testRoot)) }, { "tests/example.mjs": text });
    for (const files of [
      { "../escape": "x" },
      { "/absolute": "x" },
      { ".git/config": "x" },
      { a: "\0" },
      { a: "x".repeat(1024 * 1024 + 1) },
    ])
      assert.throws(() => checkFiles(files));
    const invalid = join(testRoot, "invalid");
    await symlink(join(testRoot, "tests/example.mjs"), invalid);
    await assert.rejects(readTree(testRoot));
    await unlink(invalid);
    await link(join(testRoot, "tests/example.mjs"), invalid);
    await assert.rejects(readTree(testRoot), /not a link/);
    await unlink(invalid);
    await writeFile(invalid, Buffer.from([0xff]));
    await assert.rejects(readTree(testRoot));
    await unlink(invalid);
    const largeArtifact = "x".repeat(1024 * 1024 + 1);
    await writeFile(invalid, largeArtifact);
    await assert.rejects(readTree(testRoot));
    assert.equal(await readRegular(invalid, 2 * 1024 * 1024), largeArtifact);
    await assert.rejects(readRegular(invalid, 1024));
    await unlink(invalid);
    await mkdir(join(testRoot, ".git"));
    await writeFile(join(testRoot, ".git/config"), "harness metadata");
    assert.deepEqual(Object.keys(await readTree(testRoot, { ignoreGit: true })), [
      "tests/example.mjs",
    ]);
    await mkdir(join(testRoot, "node_modules"));
    await symlink(join(testRoot, "tests/example.mjs"), join(testRoot, "node_modules/link"));
    await writeTree(testRoot, { "tests/dist/source.ts": "still source" });
    assert.deepEqual(
      Object.keys(await readTree(testRoot, { ignoreGit: true, excludeRoots: generatedPaths })),
      ["tests/dist/source.ts", "tests/example.mjs"],
    );
    await symlink(join(testRoot, "tests"), join(testRoot, "build"));
    await assert.rejects(readTree(testRoot, { ignoreGit: true, excludeRoots: generatedPaths }));
    await unlink(join(testRoot, "build"));
    await writeFile(join(testRoot, "dist"), "not a generated directory");
    const exported = await readTree(testRoot, { ignoreGit: true, excludeRoots: generatedPaths });
    assert.equal(exported.dist, "not a generated directory");
    assert.equal(checkScope(changesBetween({}, exported), ["tests/**"]).ok, false);
  } finally {
    const belowTemporary = relative(temporaryBase, testRoot);
    assert.ok(
      belowTemporary && !belowTemporary.startsWith("..") && !belowTemporary.startsWith(sep),
    );
    assert.notEqual(testRoot, "/");
    assert.notEqual(testRoot, realHome);
    assert.ok(!realHome.startsWith(testRoot + sep));
    await rm(testRoot, { recursive: true, force: true });
  }
});
