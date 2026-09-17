# Replydesk documentation acceptance

Evaluate meaning without prescribing headings, wording or length. Use blind human review: reviewers must not see whether a run used the skill. Only README.md may change.

## Preserve

- Replydesk drafts replies for human review; agents remain responsible for customer commitments, especially dates and remedies. Known facts ground the draft; internal notes are not necessarily appropriate to quote.
- Submitted messages and notes are sent to OpenAI. Use sample data for local trials and review text before sending.
- This workspace has no authentication or request quotas: keep it local or behind team access controls rather than exposing it directly to the public internet.
- Development prerequisites and valid install, test, check, build and start instructions. Preserve how to supply the API key, optional model and production ORIGIN, including the distinction that production does not load `.env` automatically.
- Ordinary server-rendered submissions work without JavaScript; in-place feedback and clipboard access need JavaScript. Drafts are not saved across reloads.
- A valid reference to CONTRACT.md and the writing-guidance source.

Human responsibility, appropriate treatment of internal notes and deployment advice contribute rationale not recoverable from code alone. Do not discard them simply because they are not implementation details.

## Remove

- The Draft generation paragraph that walks through FormData fields, validation, return values and pending flags.
- The Development notes chronology and completion statements.
- The auto-send queue proposal and its negative residue.
- The repeated concluding product summary.

## Do not add

Cleanup ledgers, completion reports, invented retention guarantees, claims that drafts cannot hallucinate, or promises that the application enforces access controls. Do not turn the deleted queue story into another notice of its absence.

Record fact preservation, low-value text removal, unsupported additions and scope independently. Check remaining paths and commands against the fixture. The ordinary tests do not validate documentation quality; no automated documentation oracle is provided.
