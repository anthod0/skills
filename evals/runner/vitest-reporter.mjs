import { writeFileSync } from "node:fs";

export function vitestEvents(files, unhandled = []) {
  const events = [];
  const counts = { tests: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0 };
  function visit(task) {
    if (task.type === "suite") {
      for (const error of task.result?.errors ?? []) {
        events.push({
          type: "test:fail",
          name: task.name,
          subtype: "suite",
          error: { failureType: "hookFailed", message: error.message },
        });
      }
      for (const child of task.tasks ?? []) visit(child);
      return;
    }
    counts.tests++;
    const state = task.result?.state ?? task.mode;
    if (state === "skip" || state === "todo") counts[state === "skip" ? "skipped" : "todo"]++;
    else if (!["pass", "fail"].includes(state)) counts.cancelled++;
    else counts[state === "pass" ? "passed" : "failed"]++;
    const errors = task.result?.errors ?? [];
    // Vitest leaves a throwing beforeEach/afterEach in "run", not "fail".
    const hookFailed = Object.values(task.result?.hooks ?? {}).some((state) => state !== "pass");
    const assertion =
      errors.length > 0 &&
      errors.every((error) => error.name === "AssertionError" || error.code === "ERR_ASSERTION");
    events.push({
      type: state === "fail" ? "test:fail" : "test:pass",
      name: task.name,
      subtype: "test",
      skip: state === "skip",
      todo: state === "todo",
      ...(state === "fail"
        ? {
            error: {
              failureType: hookFailed ? "hookFailed" : "testCodeFailure",
              cause: {
                ...(assertion ? { code: "ERR_ASSERTION" } : {}),
                message: errors.map((error) => error.message).join("\n"),
              },
            },
          }
        : {}),
    });
  }
  for (const file of files) visit(file);
  for (const error of unhandled)
    events.push({
      type: "test:fail",
      name: "Unhandled runner error",
      subtype: "suite",
      error: { failureType: "runnerFailure", message: error.message },
    });
  events.push({ type: "test:summary", counts });
  return events;
}

export default class Reporter {
  onFinished(files = [], errors = []) {
    writeFileSync(
      "/tmp/vitest-events.jsonl",
      vitestEvents(files, errors)
        .map((event) => JSON.stringify(event))
        .join("\n") + "\n",
      { flag: "wx" },
    );
  }
}
