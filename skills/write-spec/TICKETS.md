# Implementation Tickets

Read and follow this document when splitting a spec into tickets or updating tickets with confirmed decisions.

Initially record each ticket's goal, scope highlights, critical constraints, acceptance criteria, and dependencies. Supplement relevant tickets as later decisions are confirmed; do not require a complete design at decomposition time. The full spec remains authoritative for the overall outcome, scope, and final acceptance. Tickets do not replace or weaken its requirements.

Propose the breakdown first and publish only after the user approves it. Do not implement code during decomposition or automatically create tickets merely because the user asks to write a spec.

## 1. Read the Sources and Project Conventions

Read the spec identified by the user, whether provided as a file path, issue number, or URL. For an issue, read its body and comments to identify confirmed revisions; do not treat every comment as an accepted requirement. The current conversation supplements the spec but does not replace it. The spec may still have open questions; the user asking for a breakdown is enough to start.

Check the spec's external integration points. If external interface usage that affects ticket boundaries is unverified, investigate it as described in [Understand External Interfaces](SKILL.md#understand-external-interfaces) and update the spec. An unfinished prerequisite validation project does not stop decomposition; it stays outside the tickets and blocks the tickets that depend on its results.

Read the relevant contracts, domain terminology, ADRs, and existing tickets. Use existing code to understand the current state, constraints, and effort, not to introduce new requirements.

Read the project's `docs/agents/issue-tracker.md` when present and follow its conventions for locations, statuses, labels, and relationships. Without an explicit tracker configuration, use Local Markdown under `.scratch/`.

Distinguish readiness to decompose from readiness to implement. Decomposition is ready when you can describe the implementation path well enough to name the work units, their deliverables, and the order they depend on each other. Open questions do not need to be settled first. Ask the user before proposing the breakdown only when a question changes how many work units there are or where their boundaries fall, and ask only that question. Do not conduct a general requirements interview or make spec decisions by writing tickets.

For each open question, identify who resolves it (a ticket, the prerequisite validation project, or a user decision under [`/decide-for-me`](../decide-for-me/SKILL.md)) and which tickets depend on the answer. Record the question in those tickets as a gate instead of guessing the answer. Tickets the question does not affect proceed normally; affected tickets can be published but wait for the answer before implementation.

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

### Separate Work Types

Give every ticket exactly one [work type](SKILL.md#work-types): code implementation, external configuration, or deployment. External exploration is finished before the spec and never becomes a ticket.

- Put external configuration and deployment in the first or last tickets of the breakdown. Configuration that code or its tests need before they can run goes in the first ticket. Deployment, and configuration that only matters once deployed, go in the last ticket.
- Keep code implementation tickets to code and tests. Do not include steps or acceptance criteria that set environment values, change consoles or third-party resources, provision infrastructure, release, or verify a deployed environment. Code tickets may reference the configuration keys and integration points defined in the spec.
- Make code implementation acceptance verifiable from the repository, through tests, local runs, or fakes of the external interface. Put checks that need a live environment in the deployment ticket.
- Write configuration and deployment tickets as concrete operations with their target environment, required access, and verification. Note which steps need the user because the agent lacks access or authorization.

### Investigation and Design Tickets

Use a separate investigation or design ticket when its findings or confirmed design are needed by later work. These tickets cover internal design questions; external interface usage is already settled in the spec. State the questions to answer, the evidence or design artifact to produce, and the confirmation required before dependent implementation starts. A design proposal is not a confirmed contract.

A question local to one delivery slice may remain in that ticket with an explicit resolve-and-confirm step before the affected implementation. Reference the pending result from dependent scope rather than inventing interfaces, fields, or behavior to make tickets look complete.

### Prerequisite Refactoring and Cross-Cutting Changes

Create a separate prerequisite refactoring ticket only when the refactoring genuinely blocks delivery or requires independent verification. Explain what it enables for subsequent work. Do not add incidental cleanup tickets.

For cross-cutting changes that cannot be sliced vertically by behavior, split along independently verifiable and mergeable boundaries. If the change is indivisible, keep it as one atomic work unit with clear acceptance criteria and explain the granularity to the user. Do not introduce parallel old and new interfaces, compatibility layers, or migration mechanisms merely to enable decomposition; use them only when required by an existing public contract or confirmed requirements.

### Dependencies

List each ticket's genuine blockers: prerequisite tickets whose deliverables are necessary to complete its implementation or acceptance as defined.

Do not turn a recommended order, shared code location, or stage number into a blocking relationship. Do not unnecessarily serialize work that can proceed in parallel. If only part of a ticket is blocked, consider splitting it rather than blocking the entire ticket by default.

The dependency graph must be acyclic. Distinguish completed investigation from confirmed decisions: dependent implementation requires both the prerequisite deliverables and any necessary confirmation. Use the project's status and label conventions. Do not default to `ready-for-agent` or describe every created ticket as immediately executable.

## 4. Check Coverage and Consistency

Before presenting the breakdown, verify that:

- Every scope item and acceptance criterion in the full spec is covered by a ticket. Explicitly identify work already implemented rather than create duplicate tickets.
- Each ticket has a clear responsibility, with no gaps or duplicate ownership of the same deliverable.
- Each ticket has one work type. External configuration and deployment tickets sit at the start or end of the breakdown, and code implementation tickets contain no configuration or deployment steps or acceptance criteria.
- Tickets introduce no requirements beyond the sources and do not relax the full spec's minimum requirements or invariants.
- Critical constraints whose omission could cause incorrect implementation are recorded in the relevant ticket, not lost in a generic summary.
- Confirmed decisions remain confirmed decisions, and proposed approaches remain non-binding suggestions.
- Every open question has an owner (a ticket, the validation project, or a user decision), an expected result, and an explicit gate on the tickets that depend on it.
- Dependencies are genuine and acyclic, and each ticket's completion criteria are verifiable.

Preserve the full spec's overall requirements primarily through references. Restate only the key constraints directly relevant to the ticket whose omission could lead to incorrect implementation. Avoid copying the entire spec.

## 5. Present the Breakdown for User Approval

Use a numbered list showing each ticket's:

- Title.
- Work type.
- Deliverable.
- Prerequisite tickets, explicitly stating when there are none.
- Necessary stage boundaries, such as being mergeable but not yet releasable.
- Open questions that gate it, if any.

Ask the user to confirm granularity, blocking relationships, and whether any tickets should be merged or split further. Iterate until approved, then write and publish the initial ticket bodies. If writing the bodies reveals material changes to scope or dependencies, update the breakdown and obtain approval first.

## 6. Write and Publish Initial Tickets

Write concise tickets in the user's language. The template below is a starting point, not a requirement for identical headings. Cover the goal, scope, critical constraints, acceptance criteria, source, and blockers; add sections only when they carry necessary information. Do not repeat the spec's background or fill out a full sub-spec for each ticket.

Preserve confirmed contracts and technical boundaries that matter to the ticket. Include paths when they identify a relevant boundary, reference, or required deliverable, not a file-by-file implementation checklist. Record unresolved prerequisites as described above without filling them with assumptions.

### Ticket Template

```markdown
# <Number>: <Title>

Spec: <Link to the source spec>
Blocked by: <Prerequisite tickets and required results or confirmation; explicitly state when none>
Type: <Code implementation, external configuration, or deployment>
<Status or type according to project conventions, if needed>

## Goal

The behavior or result this ticket delivers. State any limitation on availability at this stage.

## Scope

- Key behaviors or questions this ticket owns.
- Critical constraints and confirmed boundaries, with references where needed.
- Unresolved prerequisites: what must be resolved, by which ticket, and before which implementation; include required user confirmation.

## Acceptance

- Verifiable completion conditions, including necessary failure-case and integration checks.
- For investigation or design, the required evidence or design artifact and confirmation gate.
```

### Publication Locations and Relationships

- **Local Markdown**: By default, write to `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order, one ticket per file. Use relative links to the source spec and prerequisite tickets. Follow project configuration when it explicitly specifies another location.
- **A real tracker**: Create one issue per ticket in dependency order so later tickets can reference existing identifiers. Prefer native blocking relationships; otherwise list blockers in the body. Keep the source reference in the body. Establish parent-child relationships according to project configuration and user authorization.

Do not close the source issue, rewrite its body, or automatically advance its status. Do not overwrite existing tickets during publication. If the same work already has a ticket, use the update process below when authorized; otherwise explain the overlap and ask whether to update it.

After publication, summarize each ticket's path or link and identify the currently unblocked work that can start. If publication is only partially complete, clearly report which tickets were created and which were not; do not recreate tickets already published successfully.

## 7. Supplement Tickets with Confirmed Decisions

When asked to update tickets, or when the user confirms a decision while working through them:

1. Read the existing tickets and the confirmation source. Identify every ticket whose scope, constraints, acceptance, or blockers are affected. A proposed design, experimental finding, or discussion comment alone does not authorize a decision requiring user confirmation.
2. Integrate the confirmed result into the relevant bullets or link to its authoritative spec, contract, or design document. Retain the key consequences needed to implement the ticket correctly; do not copy the entire design into each ticket.
3. Replace resolved questions and stale assumptions with the current confirmed requirements. Update blockers only when their deliverables and confirmation conditions are satisfied. Preserve unrelated ticket content; do not turn the update into a discussion log or implementation diary.
4. Check each affected ticket for contradictions, missing acceptance coverage, and obsolete blockers. If the decision changes the overall scope or delivery breakdown beyond what the user approved, obtain approval for that change before treating it as settled. Identify any source-spec conflict rather than silently overriding it in a ticket.
5. Summarize which tickets changed and which implementation gates remain open.

Leave tickets unchanged when there is no new confirmed decision to incorporate. Do not use this maintenance pass to add speculative implementation detail or rewrite tickets into full sub-specs.
