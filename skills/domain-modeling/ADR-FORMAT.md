# ADR Format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc. Together they form a concise set of the architectural decisions that currently govern the system and the reasons for them; they are not an immutable historical log.

Create the `docs/adr/` directory lazily — only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: the relevant context, the decision that currently governs the system, and why.}
```

That's it. An ADR can be a single paragraph. Its value is in making the current architectural decision and its rationale clear, not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Considered Options** — only when alternatives help explain the current decision and its trade-off
- **Consequences** — only when stable, non-obvious architectural effects need to be called out

Status frontmatter is unnecessary: the ADR set contains only effective decisions, not status-tracked historical entries.

## Content boundaries

Include stable architectural boundaries, authorities, invariants, consequential choices, and the reasons for those choices.

Exclude implementation status, migration steps, unresolved questions, future plans, detailed call sequences, volatile protocol details, and code-layout descriptions. Put these in a spec, current-state technical document, issue, or the code instead.

## Maintaining the current set

When an architectural decision changes, edit the ADR to state the new effective decision, merge overlapping ADRs, or delete an ADR that no longer governs the system. Do not preserve change history or obsolete decisions in ADR text; Git provides that history.

ADR changes should be infrequent. Normal feature work, implementation progress, and implementation-only refactoring do not require ADR updates.

## Numbering

Choose the next number after the highest one known to have been assigned. Prefer not to reuse the numbers of deleted ADRs, so stale references cannot acquire unrelated meanings.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the system and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it. If it is not surprising, nobody needs its rationale explained. If there was no real alternative, there is no consequential choice to capture.

Then test whether the content is stable enough for an ADR:

1. Can multiple implementations satisfy the decision?
2. Would an implementation-only refactor leave the ADR unchanged?
3. Would violating the statement actually change the architecture?

If any answer is no, put the information in a spec, current-state technical document, issue, or the code instead.

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, and the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, or deployment target. Not every library — just choices that are costly to reverse.
- **Boundary, authority, and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." Explicit prohibitions can be as important as permissions.
- **Architectural invariants.** Rules that every valid implementation must preserve across features and refactors.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." These prevent a future engineer from undoing an intentional trade-off.
- **Constraints that shape the architecture.** "We cannot use AWS because of compliance requirements." Record the architectural consequence, not a volatile operational target.
- **Rejected alternatives that explain the current choice.** Include them only when they are necessary to understand why the effective decision remains appropriate.
