## validation

Applicable to every implementation submission. Check that the agent inspected relevant code and ran checks appropriate to changed behavior, including the affected regression tests. Cite the commands and their observed results. A claimed success without test output is insufficient evidence. Infrastructure failures are not successful validation; record the limitation instead of inferring a pass. Official F2P/P2P results are separate and are not evidence that the agent itself validated its work.

## review-before-commit

Applicable when the agent commits changes. Check that a code review occurred after implementation and validation, that reported blocking issues were addressed with relevant checks rerun, and that the commit followed this sequence. The trace must support the review, not just a statement that review happened. Parallel review sub-agents cannot be inferred from an ordinary self-review; report insufficient evidence when the required mechanism is not available or visible. If no commit occurs, this criterion is not applicable (completion is checked separately).

## completion

Applicable to every submission. Check that the final working changes were committed and that any existing associated spec was updated only when one actually exists. Do not require creating a spec for the benchmark issue. A final response claiming a commit is not enough; cite an observed successful commit or equivalent git evidence. The evaluator can export committed changes, so a clean working tree is not a missing patch.
