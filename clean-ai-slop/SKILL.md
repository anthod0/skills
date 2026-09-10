---
name: clean-ai-slop
description: Clean low-value tests and documentation after implementing code changes, before the final response. Also use when explicitly asked to clean tests or documentation.
---

# Clean AI Slop

## Entry and shared boundaries

After implementing code changes, inspect tests and documentation changed by the task. For explicit cleanup requests, use the requested scope; with no scope specified, inspect all discoverable tests and documentation in the current project.

Read repository instructions, record the existing working-tree state, and preserve unrelated edits. The invocation authorizes deletion within the selected scope. Confine changes to selected files and their exclusively owned artifacts; report production-code issues instead of changing product behavior. Keep analysis and cleanup reports in working notes and the response, not in project documentation.

## A. Test cleanup

Reduce tests to **signal**: assertions that fail when supported observable behavior regresses and survive behavior-preserving refactors.

### A1. Establish scope and baseline

Identify candidate tests, relevant specifications, and the production interfaces they exercise. Read test configuration and derive commands from project configuration rather than guessing them.

Before running a filesystem-touching test, apply the `test-filesystem-safety` skill and inspect its setup and teardown. Do not baseline an unsafe test. Otherwise, run the narrowest applicable test command before editing when practical. Record pre-existing failures.

**Complete when:** candidate tests, applicable commands, baseline status, and pre-existing local edits are known.

### A2. Build the test signal ledger

For every test in scope, identify:

- the supported observable behavior it claims to protect;
- the public seam where that behavior is observed;
- evidence from implementation, specification, documented contract, or a known regression;
- the exact assertion that detects its regression;
- one classification and proposed action.

Classify as slop when it matches a category below and has no stronger behavioral signal:

- **TDD residue** — temporary scaffolding, placeholder or tracer tests, imagined future behavior, incremental cases made redundant by a later behavioral test, or checks that only prove the harness is wired.
- **Low-signal test** — tautological or always-passing assertions, tests without a meaningful oracle, duplicate coverage, implementation-coupled checks, mock choreography, superficial shape checks, or snapshots of incidental structure.
- **Copy check** — assertions whose subject is literal prose, documentation wording, styling, markup shape, or presentational UI text rather than an explicit product contract.
- **Fiction negative** — assertions that preserve the absence of an invented variable, command, code path, branch, element, screen, or unsupported behavior.

A negative assertion has signal when it exercises a real supported boundary such as rejection, validation, authorization, error handling, recovery, or safety. Exact text or presentation has signal only when evidence makes that content itself contractual.

Prefer the strongest test at the highest stable public seam when several tests protect the same behavior. Treat uncertainty as insufficient evidence for deletion and retain the test for clarification.

**Complete when:** every scoped test appears once in the ledger, every deletion candidate cites evidence, and every retained test names distinct signal or an unresolved question.

### A3. Delete test slop

Apply the smallest coherent deletion:

1. Delete an assertion when the remaining case still has an independent behavioral oracle and reads coherently.
2. Delete the case when removing its slop leaves no meaningful oracle or only duplicates another case.
3. Delete the file when no signal-bearing case remains.

Remove snapshots, fixtures, and test-only helpers owned exclusively by deleted tests after confirming they have no remaining references. Edit only tests and test-only artifacts.

**Complete when:** evidenced test slop is removed, with no empty test shells or orphaned test artifacts.

### A4. Verify tests

Rerun the baseline command, then the broader relevant test command when practical. Compare failures with the baseline. Inspect the diff for accidental product changes, dangling references, empty suites, focused or skipped tests, and deleted coverage absent from the ledger.

If verification exposes lost behavioral signal, restore the smallest test that protects it and record why it survived cleanup.

**Complete when:** verification introduces no new failure, every change is accounted for, and no known test slop remains in scope. Explicitly report any verification that could not be performed.

### A5. Report test cleanup

Report scope, commands, deletions grouped by test slop category, baseline and final results, uncertain tests retained, and blockers. Account for every scoped test as deleted, retained signal, or unresolved.

## B. Documentation cleanup

Keep documentation concise and focused on current externally observable outcomes and facts beyond the code. Code is the single source of truth for implemented behavior; documentation is not a prose copy of it.

### B1. Establish documentation scope

Identify candidate documents, their audience, and their purpose. Read relevant code to verify claims about implemented behavior. Identify applicable documentation validation commands and pre-existing issues.

**Complete when:** candidate documents, authoritative code references, available checks, and pre-existing local edits are known.

### B2. Apply the five documentation rules

For each document or coherent section, identify the useful fact it contributes beyond the code and evaluate it against these rules:

1. **Final state, not process history.** Describe the current final state. Remove progress logs, intermediate attempts, chronological implementation narratives, and completed-work summaries. Preserve relevant rationale as a concise explanation of the current decision, not a diary.
2. **Delete without negative residue.** Delete obsolete or unnecessary content directly. Do not replace it with “X does not exist,” “X is no longer used,” or “X was removed.” Retain a real externally observable constraint only when it independently helps the reader, not as a memorial to deleted content.
3. **Keep it concise.** Remove repetition, filler, redundant summaries, and examples that add no distinct information. Keep only what the intended reader needs.
4. **Document outcomes, not internals.** For system descriptions, retain externally observable final effects. Remove internal call flows, private symbols, file-by-file walkthroughs, implementation mechanics, and other details that belong in code.
5. **Code owns implementation truth.** Remove prose that merely restates code, including copied inventories, defaults, branches, and signatures. Prefer a reference to authoritative code when useful. Record facts beyond the code: user goals, domain meaning, external obligations, and reasons or trade-offs behind current behavior. Observable outcomes should frame those facts, not recreate the implementation in prose.

Classify documentation slop as **process history**, **negative residue**, **verbosity**, **implementation detail**, or **code duplication**. Verify behavioral claims against code. Preserve uncertain non-code facts for clarification; do not invent replacements or treat missing evidence as disproof.

**Complete when:** each scoped document or section has a clear keep, simplify, delete, or unresolved decision, supported by its purpose and available evidence.

### B3. Clean documentation

Delete slop at the sentence, section, or file boundary. Rewrite only as needed to leave concise, coherent final-state facts. Remove links and assets owned exclusively by deleted documentation after checking references. Edit only documentation and documentation-only artifacts.

Do not add deletion notices, cleanup ledgers, or progress reports to project documents. Do not change code to make stale documentation true.

**Complete when:** evidenced documentation slop is removed without negative residue, empty sections, or orphaned documentation artifacts.

### B4. Verify documentation

Run applicable documentation checks when available. Check links and anchors affected by edits, and verify remaining behavioral claims against code. Review changed documents against all five rules, especially negative residue introduced by cleanup.

**Complete when:** remaining content is concise, current, externally focused, and contributes facts beyond the code; checks introduce no new failures. Explicitly report unresolved claims and checks that could not be performed.

### B5. Report documentation cleanup

Report scope, sections or files removed or simplified by documentation slop category, checks and results, uncertain content retained, and blockers. Account for each scoped document as cleaned, retained, or unresolved. Keep this report in the response only.
