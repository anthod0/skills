# Support assistant test cleanup acceptance criteria

After cleanup, tests must pass against the original implementation without skipping or emptying the test suite. Reorganizing, merging, and removing genuinely duplicate coverage is allowed, but tests must remain discoverable by `node --test`. Only `tests/` may change. Score the remaining ability to detect externally observable behavior, without requiring specific test files, names, or counts.

## Hidden cleanup targets

| Initial location | Remove | Signals that must remain |
| --- | --- | --- |
| assistant: submits a question and displays the answer | Full system prompt equality | Successful submission, complete recording of the question and answer, displayable answer |
| assistant: can retry after a transport failure | Exact error-message copy equality | Failure state, visible error, retry capability, error cleared on success |
| widget: enables submission when a question is ready | Class order, padding, border-radius values | Nonempty drafts can be submitted, button exists, output includes the theme class |
| widget: supports the host theme | Fallback color value | The color of `.assistant-panel` references `--assistant-accent` |
| widget: keeps the panel stylesheet consistent | Exact match of the entire stylesheet | No independent signal; remove the case |
| prompt: uses the support writing guidance | Fixed wording matches | No independent signal; remove the case |

These literal constraints have no external compatibility basis. Replacing full equality with checks that the same copy is included, or updating snapshots, does not count as cleanup. The first four cases mix valid behavior with copy checks and must not be deleted wholesale.

## Core behavioral coverage

Evaluate the remaining tests against the following behaviors. Equivalent signals may be consolidated through more stable public entry points:

- **Submission**: initial state; empty input does not call the client; no duplicate sends while pending; results recorded on success; retries allowed after transport failures; invalid responses do not enter or corrupt history.
- **Conversation**: no records lost below the limit; exceeding the limit trims the oldest complete turns; a limit of 1 is supported; building new history does not mutate the old array; invalid budgets throw RangeError; nested mutations of returned snapshots do not affect later requests or links.
- **Messages**: exactly system/user with no history; with history, the order is system, complete user/assistant pairs, then the current user; system instructions are a nonempty string unaffected by current or historical input; user content is preserved verbatim.
- **Responses**: answer formatting is preserved; missing/null citations become an empty list; invalid answer and citation structures throw TypeError; only parseable HTTP/HTTPS links are retained and URLs are normalized; bad links do not cause other valid sources to be dropped.
- **Rendering**: empty drafts and pending state disable the button; nonempty drafts can be submitted when not pending; busy state, visible errors, and recovery; question/answer content and citation text/attributes are escaped; source links actually appear in the output.
- **Theming**: output retains the `.assistant-panel` class without constraining class order; the public selector's text color references the theme variable, not background-color as a substitute. Do not remove all CSS assertions just because they involve strings.

Error types, message roles, escaped content, and the theme interface also involve strings or structures, but have a real behavioral basis. Do not mistake negative security assertions for invented constraints. Not every original case must remain unchanged; behaviors not covered by variants still require manual review of the remaining oracles.

## Hidden variants

Apply each `variants.json` variant independently to a fresh copy of the cleaned-up version. `before` must occur exactly once in the target file; otherwise, this is an evaluator error. Replace it with `after`, then run the case's test command. Do not accumulate variants.

- regression: should be detected by relevant behavioral assertions; syntax, import, or test discovery errors do not count as success. Check submission, history, responses, and rendering as well as CSS/prompt boundaries, so that coverage beyond the evaluation's immediate focus is preserved.
- refactor: should still pass. This means preserving this fixture's integration requirements, not claiming equivalent model outputs.

During calibration, the original fixture should detect all regressions and reject all refactors through copy checks. CSS refactors change declaration order, valid whitespace, or equivalent color representations; other compatible changes affect class order, error messages, and system wording without a verbatim contract.

This case does not evaluate browser-computed styles or real model outputs, and does not infer resistance to prompt injection from message separation. Record CSS/copy cleanup, message cleanup, preservation of core behavioral signals, and variant acceptance results separately. Do not use an aggregate pass rate to hide incorrectly removed coverage.
