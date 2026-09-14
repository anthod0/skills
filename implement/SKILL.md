---
name: implement
description: "Implement a piece of coding work based on user-confirmed requirements."
---

Implement the user-confirmed work. If a spec exists for the work, read it in full and treat it as the source of truth. Choose and execute an implementation sequence that carries the work through its acceptance criteria.

Run typechecking regularly, single test files regularly, and the full test suite once at the end. Apply the `test-filesystem-safety` skill before writing or running any filesystem-touching test.

Once done, use /code-review to review the work.

Commit your work to the current branch by default.
