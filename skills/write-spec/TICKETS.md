# Implementation Tickets

Read and follow this document when the user asks to split a confirmed spec into issues or implementation tickets.

Break the confirmed spec into implementation sub-specs, one per ticket. Spec confirmation is a prerequisite for decomposition. The full spec remains authoritative for the overall outcome, scope, and final acceptance. Tickets define their own deliverables, acceptance criteria, and genuine dependencies; they do not replace or weaken the full spec's requirements.

Propose the breakdown first and publish only after the user approves it. Do not implement code during decomposition or automatically create tickets merely because the user asks to write a spec.

## 1. Read the Sources and Project Conventions

Read the confirmed spec identified by the user, whether provided as a file path, issue number, or URL. For an issue, read its body and comments to identify confirmed revisions; do not treat every comment as an accepted requirement. The current conversation supplements confirmed context but does not replace a confirmed spec. If the spec has not been confirmed, obtain confirmation before starting decomposition.

Read the relevant contracts, domain terminology, ADRs, and existing tickets. Use existing code to understand the current state, constraints, and effort, not to introduce new requirements.

Read the project's `docs/agents/issue-tracker.md` when present and follow its conventions for locations, statuses, labels, and relationships. Without an explicit tracker configuration, use Local Markdown under `.scratch/`.

Do not conduct a general requirements interview during decomposition. If investigation reveals unresolved questions or requires new user decisions, apply [`/decision-boundaries`](../decision-boundaries/SKILL.md), return to the spec for clarification and confirmation, then resume the affected decomposition. Do not leave these questions to the ticket's implementer or make spec decisions by writing tickets.

## 2. Investigate Implementation Boundaries

If the current context is insufficient to assess delivery boundaries, dependencies, and effort, investigate the relevant code and test paths.

Identify:

- The smallest end-to-end path deliverable within the existing architecture.
- The systems and integration boundaries each behavior actually involves.
- Prerequisite work that genuinely blocks subsequent delivery.
- Work already covered by existing implementations or tickets.
- The distinction between each stage's availability and the conditions for releasing the complete product.

Investigation is not a redesign of the entire system. Do not add cleanup, features, interfaces, or architectural changes that the sources do not require.

## 3. Draft Delivery Slices and Dependencies

Prefer slices of end-to-end behavior over separate tickets for technical layers such as database, API, and UI. Each ticket covers the layers needed to deliver its behavior; it need not touch every layer.

Each ticket should:

- Have a clear deliverable that can be demonstrated or verified independently.
- Be completable in one fresh agent context once its prerequisites are done, judged by actual effort rather than document length.
- For ordinary feature work, be independently mergeable with relevant checks passing, leaving the system ready for further development.
- Use the intended application boundaries and contracts rather than deliver a standalone demo that must be rewired later.
- Include acceptance criteria for its behavior and failure cases rather than defer all verification to the final ticket.

Distinguish ticket completion from full spec completion. If a stage is mergeable but not yet releasable to users, state that limitation explicitly. Final integration acceptance does not replace each ticket's own acceptance.

### Prerequisite Refactoring and Cross-Cutting Changes

Create a separate prerequisite refactoring ticket only when the refactoring genuinely blocks delivery or requires independent verification. Explain what it enables for subsequent work. Do not add incidental cleanup tickets.

For cross-cutting changes that cannot be sliced vertically by behavior, split along independently verifiable and mergeable boundaries. If the change is indivisible, keep it as one atomic work unit with clear acceptance criteria and explain the granularity to the user. Do not introduce parallel old and new interfaces, compatibility layers, or migration mechanisms merely to enable decomposition; use them only when required by an existing public contract or confirmed requirements.

### Dependencies

List each ticket's genuine blockers: prerequisite tickets whose deliverables are necessary to complete its implementation or acceptance as defined.

Do not turn a recommended order, shared code location, or stage number into a blocking relationship. Do not unnecessarily serialize work that can proceed in parallel. If only part of a ticket is blocked, consider splitting it rather than blocking the entire ticket by default.

The dependency graph must be acyclic. Work without prerequisites can start immediately; dependent work can proceed once its prerequisites are complete. Use the project's status and label conventions. Do not default to `ready-for-agent` or describe every created ticket as immediately executable.

## 4. Check Coverage and Consistency

Before presenting the breakdown, verify that:

- Every scope item and acceptance criterion in the full spec is covered by a ticket. Explicitly identify work already implemented rather than create duplicate tickets.
- Each ticket has a clear responsibility, with no gaps or duplicate ownership of the same deliverable.
- Tickets introduce no requirements beyond the sources and do not relax the full spec's minimum requirements or invariants.
- Confirmed decisions remain confirmed decisions, and proposed approaches remain non-binding suggestions.
- Dependencies are genuine and acyclic, and each ticket's completion criteria are verifiable.

Preserve the full spec's overall requirements primarily through references. Restate only the key constraints directly relevant to the ticket whose omission could lead to incorrect implementation. Avoid copying the entire spec.

## 5. Present the Breakdown for User Approval

Use a numbered list showing each ticket's:

- Title.
- Deliverable.
- Prerequisite tickets, explicitly stating when there are none.
- Necessary stage boundaries, such as being mergeable but not yet releasable.

Ask the user to confirm granularity, blocking relationships, and whether any tickets should be merged or split further. Iterate until approved, then write and publish the full ticket bodies. If writing the bodies reveals material changes to scope or dependencies, update the breakdown and obtain approval first.

## 6. Write and Publish the Sub-Specs

Use the sub-spec format below in the user's language. The template defines structure and semantics, not mandatory empty sections. Omit optional sections when there is nothing to record; do not invent background, constraints, exclusions, or decisions to fill the template.

Preserve explicit contracts, interfaces, and technical boundaries. Include specific paths or code snippets only when they express confirmed boundaries or contracts. Do not turn a ticket into a file-by-file implementation checklist.

### Ticket Template

```markdown
# <Number or stage>: <Title>

<Status according to project conventions; omit if none are defined>

## Problem

The specific problem this ticket addresses and its impact, without repeating the full spec's entire background.

## Proposed Outcome

The behavior that will work or be verifiable when this ticket is complete. Where necessary, distinguish ticket completion from complete product delivery.

## Affected Users and Systems

The users, systems, and technical boundaries directly relevant to this ticket.

## Dependencies and Authoritative Sources

- Prerequisite tickets and the necessary conditions they provide; explicitly state when there are none.
- A reference to the full spec.
- References to contracts, domain documents, or ADRs relevant to this ticket.

## Scope

The specific behaviors, workflows, and necessary technical boundaries this ticket owns.

## Acceptance Criteria

- [ ] A verifiable completion condition.
- [ ] Necessary failure-case and integration verification.

## Out of Scope

Exclusions easily confused with this ticket's scope and work explicitly assigned to other tickets. Omit when there are none.

## Constraints and Confirmed Decisions

Reference existing constraints and, where necessary, restate invariants and confirmed contracts directly relevant to this ticket. Omit when there is nothing to record.

## Proposed Approach

Include only when the sources contain a relevant, unconfirmed implementation direction. Clearly identify it as non-binding. Otherwise omit.
```

### Publication Locations and Relationships

- **Local Markdown**: By default, write to `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order, one ticket per file. Use relative links to the source spec and prerequisite tickets. Follow project configuration when it explicitly specifies another location.
- **A real tracker**: Create one issue per ticket in dependency order so later tickets can reference existing identifiers. Prefer native blocking relationships; otherwise list blockers in the body. Keep the source reference in the body. Establish parent-child relationships according to project configuration and user authorization.

Do not close the source issue, rewrite its body, or automatically advance its status. Do not overwrite existing tickets. If the same work already has a ticket, explain this to the user and confirm whether to update it.

After publication, summarize each ticket's path or link and identify the currently unblocked work that can start. If publication is only partially complete, clearly report which tickets were created and which were not; do not recreate tickets already published successfully.
