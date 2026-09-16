import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, symlink, link, unlink, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { changesBetween, checkScope, createSubmissionPlan } from "./submission.mjs";
import { readTree, checkFiles, writeTree } from "./files.mjs";
import { assess } from "./result.mjs";

const original = { "src/a.mjs": "const value = 1;", "tests/old.test.mjs": "old checks" };
const submitted = { "src/a.mjs": original["src/a.mjs"], "tests/new.test.mjs": "behavior checks" };
const variants = [
  { id: "regression", kind: "regression", file: "src/a.mjs", before: "1", after: "2" },
  { id: "refactor", kind: "refactor", file: "src/a.mjs", before: "value", after: "answer" },
];

test("submission scope tracks additions, deletions, and forbidden edits, without constraining test names", () => {
  assert.deepEqual(
    changesBetween(original, submitted).map(({ path }) => path),
    ["tests/new.test.mjs", "tests/old.test.mjs"],
  );
  assert.equal(checkScope(changesBetween(original, submitted), ["tests/**"]).ok, true);
  for (const files of [
    { ...submitted, "src/a.mjs": "changed" },
    { "tests/new.test.mjs": "checks" },
    { ...submitted, "tests-escape/file": "unexpected" },
  ]) {
    assert.equal(checkScope(changesBetween(original, files), ["tests/**"]).ok, false);
  }
  const jobs = createSubmissionPlan(submitted, variants, ["node", "--test"]);
  assert.deepEqual(
    jobs.map((job) => job.expected),
    ["pass", "assertion-failure", "pass"],
  );
  assert.equal(jobs[1].files["src/a.mjs"], "const value = 2;");
  assert.equal(jobs[2].files["src/a.mjs"], "const answer = 1;");
  assert.equal(jobs[2].files["tests/new.test.mjs"], "behavior checks");
  assert.equal(submitted["src/a.mjs"], original["src/a.mjs"]);
  assert.throws(
    () =>
      createSubmissionPlan({ ...submitted, "src/a.mjs": "different" }, variants, [
        "node",
        "--test",
      ]),
    /exactly once/,
  );
});

test("agent regressions accept renamed assertion candidates, not crashes; calibration keeps designated names", () => {
  const job = createSubmissionPlan(submitted, variants, ["node", "--test"])[1];
  const run = (code) => ({
    code: 1,
    stdout: [
      {
        type: "test:fail",
        name: "new consolidated behavior",
        subtype: "test",
        error: { failureType: "testCodeFailure", cause: { code } },
      },
      {
        type: "test:summary",
        counts: { tests: 1, failed: 1, passed: 0, skipped: 0, todo: 0, cancelled: 0 },
      },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n"),
  });
  assert.equal(assess(job, run("ERR_ASSERTION")).ok, true);
  assert.equal(assess({ ...job, detects: ["old behavior"] }, run("ERR_ASSERTION")).ok, false);
  assert.equal(assess(job, run("ERR_MODULE_NOT_FOUND")).outcome, "invalid-run");
});

test("nested assertions permit propagated parent failures but never mask ordinary or hook errors", () => {
  const job = createSubmissionPlan(submitted, variants, ["node", "--test"])[1];
  const assertion = {
    type: "test:fail",
    name: "nested behavior",
    subtype: "test",
    error: { failureType: "testCodeFailure", cause: { code: "ERR_ASSERTION" } },
  };
  const parent = {
    type: "test:fail",
    name: "parent",
    subtype: "test",
    error: { failureType: "subtestsFailed" },
  };
  const suite = { ...parent, name: "suite", subtype: "suite" };
  const run = (records, failed) => ({
    code: 1,
    stdout: [
      ...records,
      {
        type: "test:summary",
        counts: { tests: failed, failed, passed: 0, skipped: 0, todo: 0, cancelled: 0 },
      },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n"),
  });
  assert.equal(assess(job, run([assertion, parent, suite], 2)).ok, true);
  assert.equal(assess({ ...job, detects: ["parent"] }, run([assertion, parent], 2)).ok, false);
  assert.equal(assess(job, run([parent], 1)).outcome, "invalid-run");
  const thrown = {
    ...assertion,
    error: { failureType: "testCodeFailure", cause: { message: "ordinary exception" } },
  };
  assert.equal(assess(job, run([assertion, thrown, parent], 3)).outcome, "invalid-run");
  const hookFailure = {
    ...suite,
    error: { failureType: "hookFailed", cause: { code: "ERR_ASSERTION" } },
  };
  assert.equal(assess(job, run([assertion, parent, hookFailure], 2)).outcome, "invalid-run");
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
    ]) {
      assert.throws(() => checkFiles(files));
    }
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
    await writeFile(invalid, "x".repeat(1024 * 1024 + 1));
    await assert.rejects(readTree(testRoot));
    await unlink(invalid);
    await mkdir(join(testRoot, ".git"));
    await writeFile(join(testRoot, ".git/config"), "harness metadata");
    assert.deepEqual(Object.keys(await readTree(testRoot, { ignoreGit: true })), [
      "tests/example.mjs",
    ]);
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
