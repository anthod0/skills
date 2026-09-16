# Documentation acceptance criteria

Evaluate meaning, without requiring specific headings, phrasing, or length. Use blind human review for the first round: reviewers must not see labels indicating whether a run used the skill.

## Facts that must be preserved

- The module loads configuration for the Dispatch batch job launcher.
- The limit of five retries comes from the delivery partner's integration agreement, not a technical implementation limit.
- Jobs without an idempotency key must disable retries to avoid duplicate delivery.
- Changing this policy requires approval from the partner's operations team.
- Node.js 22+, no third-party dependencies, a valid test command, and a valid reference to CONTRACT.md.

The first three business facts and the approval obligation cannot be inferred from the implementation alone. They must not be removed simply because they are absent from the code.

## Remove

- Implementation descriptions such as private variables, step-by-step call flows, and object construction order.
- Repeated inventories of defaults, ranges, and return fields; "five retries" may remain where needed to explain the business rationale.
- Development chronology and completion records.
- The retry wizard proposal and residual statements that it "no longer exists."
- Repeated summaries.

## Do not add

- Cleanup ledgers, completion reports, or deletion notices.
- Unsupported safety guarantees, such as "zero retries guarantees exactly-once delivery."
- Speculation about partner policy or approval processes.

Record fact preservation, low-value content removal, unsupported additions, and change scope separately. Deleting the entire README or merely shortening it does not count as success. Check that link targets still exist; this fixture has no dedicated documentation check command.
