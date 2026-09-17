import assert from "node:assert/strict";
import test from "node:test";
import { vitestEvents } from "./vitest-reporter.mjs";
import { assess } from "./result.mjs";

const check = { name: "preserves input", type: "test", mode: "run", result: { state: "pass" } };
function execution(tasks, { errors = [], suiteErrors = [], code = 0 } = {}) {
  return {
    code,
    stdout: vitestEvents(
      [
        {
          type: "suite",
          name: "file",
          result: { errors: suiteErrors },
          tasks: [{ type: "suite", name: "behavior", tasks }],
        },
      ],
      errors,
    )
      .map((event) => JSON.stringify(event))
      .join("\n"),
  };
}
const failed = (errors) => ({ ...check, result: { state: "fail", errors } });
const job = { expected: "assertion-failure", detects: [check.name] };

test("Vitest reports preserve nested behavior names and assertion evidence", () => {
  assert.equal(assess({ expected: "pass" }, execution([check])).ok, true);
  const result = execution([failed([{ name: "AssertionError", message: "wrong input" }])], {
    code: 1,
  });
  assert.equal(assess(job, result).ok, true);
  assert.equal(assess({ ...job, detects: ["another test"] }, result).ok, false);
  assert.equal(assess(job, execution([check])).ok, false);
});

test("Vitest exceptions, hook failures and unhandled errors cannot count as regression detection", () => {
  const assertion = { name: "AssertionError", message: "wrong input" };
  const ordinary = { name: "TypeError", message: "cannot read input" };
  for (const result of [
    execution([failed([ordinary])], { code: 1 }),
    execution([failed([assertion, ordinary])], { code: 1 }),
    execution([failed([])], { code: 1 }),
    execution([failed([assertion])], { code: 1, errors: [ordinary] }),
    execution([failed([assertion])], { code: 1, suiteErrors: [assertion] }),
    execution([], { code: 1, errors: [ordinary] }),
  ])
    assert.equal(assess(job, result).outcome, "invalid-run");
});

test("per-test hook assertions are not credited as test-body regressions", () => {
  const task = failed([{ name: "AssertionError", message: "setup or cleanup failed" }]);
  for (const hooks of [{ beforeEach: "run" }, { beforeEach: "pass", afterEach: "run" }]) {
    const result = execution([{ ...task, result: { ...task.result, hooks } }], { code: 1 });
    assert.equal(assess(job, result).outcome, "invalid-run");
  }
  const hooks = { beforeEach: "pass", afterEach: "pass" };
  assert.equal(
    assess(job, execution([{ ...task, result: { ...task.result, hooks } }], { code: 1 })).ok,
    true,
  );
});

test("Vitest skipped, pending, empty and exit-inconsistent suites are invalid", () => {
  for (const state of ["skip", "todo", "run", "queued"]) {
    const result = execution([check, { ...check, result: { state } }]);
    assert.equal(assess({ expected: "pass" }, result).outcome, "invalid-run");
  }
  assert.equal(assess({ expected: "pass" }, execution([])).outcome, "invalid-run");
  assert.equal(
    assess({ expected: "pass" }, execution([check], { code: 1 })).outcome,
    "invalid-run",
  );
});
