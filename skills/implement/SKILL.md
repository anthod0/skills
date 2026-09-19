---
name: implement
description: "Implement a piece of coding work based on user-confirmed requirements."
disable-model-invocation: true
---

Implement the user-confirmed work. If a spec exists for the work, read it in full and treat it as the source of truth.

Apply the `/test-filesystem-safety` skill before writing or running any filesystem-touching test.

After completing the required code changes, finish in this order:

1. Run formatting, linting, typechecking, and individual test files.
2. Decide whether to run the full test suite based on the scope of the changes.
3. Run `/clean-ai-slop` and apply the required cleanup.
4. Run `/code-review`.
5. Fix any issues found and rerun the relevant checks. Do not run another review unless the user explicitly requests it.
6. Commit.
