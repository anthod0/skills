import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, chmod, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { writeReviewFiles, verifyReviewFiles } from "./review-files.mjs";
import { readRegular } from "./files.mjs";

async function temporary(run) {
  const temporaryBase = resolve(tmpdir());
  const realHome = resolve(homedir());
  const testRoot = await mkdtemp(join(temporaryBase, "skill-review-materials-"));
  try {
    await run(testRoot);
  } finally {
    const below = relative(temporaryBase, testRoot);
    assert.ok(below && !below.startsWith("..") && !below.startsWith(sep));
    assert.notEqual(testRoot, "/");
    assert.notEqual(testRoot, realHome);
    assert.ok(!realHome.startsWith(testRoot + sep));
    await rm(testRoot, { recursive: true, force: true });
  }
}

const files = {
  "task.md": "Inspect behavior",
  "session.jsonl": '{"type":"session"}\n',
  "initial.json": "{}\n",
  "changes.json": "[]\n",
};

test("judge material files preserve large native sessions and are verified after review", async () => {
  await temporary(async (testRoot) => {
    const material = {
      ...files,
      "session.jsonl": files["session.jsonl"] + "x".repeat(1024 * 1024),
    };
    await writeReviewFiles(material, testRoot);
    assert.equal(
      await readRegular(join(testRoot, "session.jsonl"), 2 * 1024 * 1024),
      material["session.jsonl"],
    );
    await verifyReviewFiles(material, testRoot);
    await chmod(join(testRoot, "session.jsonl"), 0o600);
    await writeFile(join(testRoot, "session.jsonl"), "altered");
    await assert.rejects(verifyReviewFiles(material, testRoot), /modified/);
  });
});

test("judge material paths are fixed and missing, additional or binary files are rejected", async () => {
  await temporary(async (testRoot) => {
    for (const material of [
      undefined,
      {},
      { ...files, "../escape": "bad" },
      { ...files, "session.jsonl": "\0" },
    ])
      await assert.rejects(writeReviewFiles(material, testRoot), /Expected/);
    await writeReviewFiles(files, testRoot);
    await assert.rejects(writeReviewFiles(files, testRoot), /EEXIST/);
  });
});
