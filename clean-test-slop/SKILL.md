---
name: clean-test-slop
description: Analyze tests and remove low-value AI-generated test slop.
disable-model-invocation: true
---

# Clean Test Slop

Reduce the selected tests to **signal**: assertions that fail when supported observable behavior regresses and survive behavior-preserving refactors. Analyze and execute the cleanup; the invocation authorizes deletion inside the selected test scope.

## 1. Pin the scope

Use invocation arguments as the scope. With no arguments, inspect every discoverable test in the current project. Read repository instructions, test configuration, relevant specifications, and the production interfaces exercised by the tests. Identify test commands from project configuration rather than guessing them. Record the existing working-tree state and preserve unrelated edits.

Before running a filesystem-touching test, apply the `test-filesystem-safety` skill and inspect its setup and teardown. Do not baseline an unsafe test. Otherwise, run the narrowest applicable test command before editing when practical. Record existing failures instead of treating them as cleanup regressions.

**Complete when:** the candidate test files, applicable commands, pre-existing failures, and pre-existing local edits are explicitly known.

## 2. Build the signal ledger

For every test in scope, identify:

- the supported observable behavior it claims to protect;
- the public seam where that behavior is observed;
- evidence that the behavior exists, from implementation, specification, documented contract, or a known regression;
- the exact assertion that detects its regression;
- one classification and proposed action.

Classify as slop when it matches any category below and has no stronger behavioral signal:

- **TDD residue** — temporary scaffolding, placeholder or tracer tests, imagined future behavior, incremental cases made redundant by a later behavioral test, or checks that only prove the harness is wired.
- **Low-signal test** — tautological or always-passing assertions, tests without a meaningful oracle, duplicate coverage, implementation-coupled checks, mock choreography, superficial shape checks, or snapshots of incidental structure.
- **Copy check** — assertions whose subject is literal prose, documentation wording, styling, markup shape, or presentational UI text rather than an explicit product contract.
- **Fiction negative** — assertions that preserve the absence of an invented variable, command, code path, branch, element, screen, or unsupported behavior.

A negative assertion has signal when it exercises a real supported boundary such as rejection, validation, authorization, error handling, recovery, or safety. Exact text or presentation has signal only when evidence makes that content itself contractual.

Prefer the strongest test at the highest stable public seam when several tests protect the same behavior. Treat uncertainty as insufficient evidence for deletion and record the test for the final report.

**Complete when:** every test in scope appears once in the ledger, every deletion candidate cites concrete evidence, and every retained test names distinct behavioral signal.

## 3. Delete the slop

Apply the smallest coherent deletion:

1. Delete an assertion when the remaining case still has an independent behavioral oracle and reads coherently.
2. Delete the case when removing its slop leaves no meaningful oracle or only duplicates another case.
3. Delete the file when no signal-bearing case remains.

Remove snapshots, fixtures, and test-only helpers owned exclusively by deleted tests after confirming they have no remaining references. Confine edits to tests and test-only artifacts; report any production-code issue as a blocker instead of changing product behavior to accommodate the cleanup.

**Complete when:** every evidenced slop item is removed at a coherent boundary, no empty test shell or orphaned test artifact remains, and unrelated worktree content is untouched.

## 4. Verify the cleanup

Rerun the same narrow test command used for the baseline, then the broader relevant test command when practical. Inspect the final diff for accidental product changes, dangling references, empty suites, focused or skipped tests, and deleted coverage that was not represented in the ledger. Compare failures with the recorded baseline.

If verification exposes lost behavioral signal, restore only the smallest test that protects it and record why it survived cleanup.

**Complete when:** cleanup introduces no new failure, every changed or deleted line is accounted for by the ledger, and the final test set contains no known slop in scope.

## 5. Report

Report:

- scope and commands executed;
- assertions, cases, files, and test-only artifacts deleted, grouped by slop category;
- baseline and final verification results;
- uncertain tests retained and the missing evidence needed to decide them;
- blockers or residual risks.

**Complete when:** every scoped test is accounted for as deleted, retained signal, or explicitly unresolved.
