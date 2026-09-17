import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { readCase } from "./case.mjs";
import { readRegular, writeTree } from "./files.mjs";

const caseId = "example/first";
const fixture = { "README.md": "base", "notes.txt": "keep the suffix" };

async function withCase(run) {
  const temporaryBase = resolve(tmpdir());
  const realHome = resolve(homedir());
  const testRoot = await mkdtemp(join(temporaryBase, "skill-eval-input-"));
  try {
    await writeTree(testRoot, {
      "cases/example/first/case.json": '{"fixture":"shared"}',
      "cases/example/first/task.md": "task, not a workspace file",
      "cases/example/first/oracle/criteria.md": "hidden, not a workspace file",
      "cases/example/second/case.json": '{"fixture":"shared"}',
    });
    await writeTree(join(testRoot, "fixtures/shared"), fixture);
    await run(testRoot);
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
}

test("case loading adds only its own input and strips one trailing txt suffix", async () => {
  await withCase(async (root) => {
    assert.deepEqual({ ...(await readCase(root, caseId)).files }, fixture);
    const input = {
      "tests/added.test.ts.txt": "inert test source",
      "data/notes.txt.txt": "retains one suffix",
      "assets/icon.svg": "unchanged extension",
    };
    await writeTree(join(root, "cases", caseId, "input"), input);
    const loaded = await readCase(root, caseId);
    assert.equal(loaded.caseRoot, join(root, "cases", caseId));
    assert.equal(loaded.manifest.fixture, "shared");
    assert.deepEqual({ ...loaded.files }, {
      ...fixture,
      "tests/added.test.ts": input["tests/added.test.ts.txt"],
      "data/notes.txt": input["data/notes.txt.txt"],
      "assets/icon.svg": input["assets/icon.svg"],
    });
    assert.deepEqual({ ...(await readCase(root, "example/second")).files }, fixture);
    assert.equal(
      await readRegular(join(root, "cases", caseId, "input/tests/added.test.ts.txt")),
      input["tests/added.test.ts.txt"],
    );
  });
});

test("input cannot overwrite files or create file/directory conflicts after normalization", async () => {
  for (const input of [
    { "README.md.txt": "replacement" },
    { "tests/a.ts": "one", "tests/a.ts.txt": "two" },
    { "README.md/child.txt": "below a base file" },
    { "data.txt": "file", "data/child.txt": "child" },
  ]) {
    await withCase(async (root) => {
      await writeTree(join(root, "cases", caseId, "input"), input);
      await assert.rejects(readCase(root, caseId), /collision|conflict/);
    });
  }
  await withCase(async (root) => {
    await writeTree(join(root, "fixtures/shared"), { "tests/base.ts": "base test" });
    await writeTree(join(root, "cases", caseId, "input"), { "tests.txt": "replaces directory" });
    await assert.rejects(readCase(root, caseId), /conflict/);
  });
});

test("empty source directories cannot be replaced by normalized input files", async () => {
  for (const source of ["fixtures/shared", `cases/${caseId}/input`]) {
    await withCase(async (root) => {
      await writeTree(join(root, "cases", caseId, "input"), { "data.txt": "file" });
      await mkdir(join(root, source, "data"));
      await assert.rejects(readCase(root, caseId), /conflict/);
    });
  }
});

test("case and normalized input paths remain bounded and Git metadata stays reserved", async () => {
  for (const file of [".txt", "..txt", ".git.txt", "tests/...txt"]) {
    await withCase(async (root) => {
      await writeTree(join(root, "cases", caseId, "input"), { [file]: "invalid destination" });
      await assert.rejects(readCase(root, caseId), /Unsafe|reserved/);
    });
  }
  await withCase(async (root) => {
    for (const id of ["../escape", "example", "example/first/extra"])
      await assert.rejects(readCase(root, id), /Unsafe|Expected skill\/case/);
    await writeFile(join(root, "cases", caseId, "case.json"), '{"fixture":"../shared"}');
    await assert.rejects(readCase(root, caseId), /Unsafe/);
  });
});

test("an invalid or linked input is rejected rather than treated as absent", async () => {
  for (const kind of ["file", "directory-link", "dangling-link", "nested-link"]) {
    await withCase(async (root) => {
      const inputRoot = join(root, "cases", caseId, "input");
      if (kind === "file") await writeFile(inputRoot, "not a directory");
      else if (kind === "nested-link") {
        await writeTree(inputRoot, { "regular.txt": "regular" });
        await symlink(join(root, "fixtures/shared/README.md"), join(inputRoot, "linked.txt"));
      } else {
        const target = kind === "directory-link" ? "fixtures/shared" : "missing";
        await symlink(join(root, target), inputRoot);
      }
      await assert.rejects(readCase(root, caseId));
    });
  }
});

test("combined inputs count materialized directories toward the tree-entry limit", async () => {
  await withCase(async (root) => {
    for (const [source, prefix] of [
      ["fixtures/shared", "base"],
      [`cases/${caseId}/input`, "extra"],
    ]) {
      const files = Object.fromEntries(
        Array.from({ length: 150 }, (_, index) => [`${prefix}-${index}/file.ts`, "small"]),
      );
      await writeTree(join(root, source), files);
    }
    await assert.rejects(readCase(root, caseId), /Too many tree entries/);
  });
});

test("combined inputs obey file-count limits even when each source fits separately", async () => {
  await withCase(async (root) => {
    const source = Object.fromEntries(
      Array.from({ length: 260 }, (_, index) => [`file-${index}.txt`, "small"]),
    );
    await writeTree(join(root, "fixtures/shared"), source);
    await writeTree(join(root, "cases", caseId, "input"), source);
    await assert.rejects(readCase(root, caseId), /Too many files/);
  });
});
