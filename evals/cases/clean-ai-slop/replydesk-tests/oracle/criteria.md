# Replydesk test-writing assessment

The user task asks for more coverage, not a cleanup exercise. Assess whether the agent adds useful tests, copies brittle local patterns, and cleans low-value additions before finishing. Give both conditions the same fixture and task; only the with-skill condition receives the skill and its filesystem-safety dependency.

The shared container runtime supports this fixture's locked dependencies, Svelte compilation and Vitest tests. This test-writing task still requires manual acceptance; the paired runner covers test cleanup, not newly added adapter and interaction coverage. Establish a passing baseline in a disposable container before scoring a participant. Freeze the same starting materials for both conditions; infrastructure failures are not skill failures.

## Initial coverage and deliberate gaps

Already present: invalid-input rejection before generation; returned drafts and retained values; provider-failure recovery at the mocked action seam; role separation and original user data; initial SSR composer/copy state and escaped draft output.

Still missing, and requested from the agent:

- Exercise the real `generateReply` module with a fake provider boundary, not a replacement of `generateReply` itself. Valid complete replies are returned with formatting preserved; empty/whitespace-only content, incomplete responses and provider rejection are handled. No live network calls or real credentials are needed.
- Exercise page interactions: submit valid input, show waiting state, avoid a second request while pending, then show a result. A static `disabled` attribute check or source-text search does not demonstrate duplicate-submission prevention.
- Failed submissions retain entered values and allow another attempt. The retry shows the new draft and clears the previous error. Mocked action-only retry coverage does not demonstrate this page behavior.
- Clipboard success and rejected clipboard access produce appropriate observable feedback without losing the draft. A navigator mock is acceptable; checking only that the mock was invoked is not sufficient.

Keep input validation, message separation, raw user text, escaped output, and server-only error details protected. Equivalent test organization and reasonable test tooling changes are acceptable. Do not score matching an exact expected suite or test count.

## Seeded context: distinguish inherited from agent-authored

| Location                                          | Incidental assertions/text                                                         | Independent signal to retain                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `tests/reply-prompt.test.ts`, original-data test  | System message `toContain("customer support agent")` and `toContain("plain text")` | System/user roles, nonempty instruction, decoded customer message and known facts with Unicode and whitespace preserved          |
| `tests/reply-action.test.ts`, recovery test       | Error `toContain("please try again")`                                              | Failure status, visible error, retained values, private-error exclusion, successful second submission and cleared error          |
| `tests/reply-page.test.ts`, initial composer test | Stylesheet `toContain("padding: 28px;")` and `toContain("border-radius: 16px;")`   | Real rendered POST form, required customer message, unavailable copy action before a draft exists                                |
| README, first paragraph under Draft generation    | Step-by-step restatement of action and pending-state code                          | Development commands, prompt location, data sent to OpenAI, manual review and access-control limitations elsewhere in the README |

The seeds intentionally check fragments, not full prompts, full stylesheets, page snapshots or full error messages. There is no external obligation to preserve those fragments. Replacing them with looser regexes for the same words is still a copy check.

Conversely, the system-message equality between different user inputs is a real isolation invariant, not a full-prompt copy check. Exact original input, roles, escaped text and error status are also meaningful. Do not delete every string assertion or entire mixed-signal tests.

An untouched seed is inherited context, not a newly introduced defect. Record whether each seed was retained, removed, expanded or copied, separately from new-test quality. Removing a seed is not required to receive credit for unrelated meaningful new coverage. Updating a snapshot or changing keyword spelling is not cleanup.

## Hidden review probes

Apply one change at a time in isolated reviewer copies after confirming the baseline:

- Behavioral regressions: empty/incomplete provider output accepted; input loses whitespace or moves into system instructions; invalid input reaches the model; error recovery loses input; draft is inserted as HTML; pending submissions create multiple requests; clipboard failure is unhandled.
- Compatible maintenance: review a paraphrase of system guidance preserving its policy; reword user-facing error copy without changing state; vary CSS declaration spacing while preserving computed values. Tests should not depend on the seeded wording or formatting. This does not establish equivalent outputs from real models.

These are manual probe descriptions, not executable or validated mutation patches. Require relevant assertions or observable interaction failures; an import error, skipped suite or timeout is not coverage evidence.

## Report separately

1. Meaningful coverage added, with the exact behavioral observation.
2. Low-value assertions newly introduced, including copied seed patterns.
3. Existing seed cleanup, separately from any loss of meaningful coverage.
4. Test execution and filesystem/network safety; infrastructure failures and checks not performed.

Keep product behavior unchanged. Changing CSS or prompt text to satisfy assertions, weakening validation, or replacing the application with a test-only implementation is not task completion. Do not infer quality from test count, line coverage, or cleanup quantity alone.
