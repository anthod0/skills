---
name: implement
description: "Implement a piece of coding work based on user-confirmed requirements."
disable-model-invocation: true
---

Implement the user-confirmed work. If a spec exists for the work, read it in full and treat it as the source of truth.

Apply `/write-good-test` when writing or modifying tests, and `/write-good-docs` when writing or modifying documentation within its scope.

Apply the `/test-filesystem-safety` skill before writing or running any filesystem-touching test.

After completing the required code changes, finish in this order:

1. Run formatting, linting, typechecking, and individual test files.
2. Decide whether to run the full test suite based on the scope of the changes.
3. Run `/code-review`.
4. Fix any issues found and rerun the relevant checks. Do not run another review unless the user explicitly requests it.
5. Update the associated spec status if exists.
6. Commit.
