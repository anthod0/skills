# Replydesk test-cleanup acceptance

The task is to clean existing tests, not add the missing adapter or interaction suite. Only `tests/` may change. Keep product code, dependencies, configuration and documentation unchanged.

## Remove incidental copy checks

- Prompt fragments `customer support agent` and `plain text` in `reply-prompt.test.ts`.
- Error fragment `please try again` in `reply-action.test.ts`.
- CSS fragments `padding: 28px;` and `border-radius: 16px;` in `reply-page.test.ts`, together with the exclusively used raw CSS import.

Rewording the assertions or replacing them with regexes for the same fragments does not remove their coupling. CSS values and prompt/error prose have no verbatim contract in this product.

## Preserve independent signal

- Action validation rejects invalid input before generation, and successful results retain the draft and form values.
- Provider failure exposes an error and the correct status without private diagnostics, retains input, and allows a successful retry that clears the error.
- Prompt roles remain system/user; nonempty guidance is independent of user text and notes. Decoded user data preserves original Unicode and whitespace. Comparing system content across different inputs checks isolation, not fixed prompt wording.
- The rendered composer submits by POST, requires the customer message and disables copy before a draft exists. A returned draft is escaped text and makes copy available.

Do not delete whole mixed-signal tests or weaken escaped-output assertions. The initial SSR checks do not cover browser interactions, pending duplicate submissions or clipboard handling; do not claim otherwise.

## Review evidence

Review the initial tests, final diff and operation trace. Distinguish inherited assertions from newly introduced coupling and targeted cleanup. Cite the changed assertions; neither test counts nor the agent's summary prove quality. This case requires manual review.
