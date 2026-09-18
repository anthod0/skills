---
name: write-spec
description: Capture and publish a product or engineering discussion as a spec after the user confirms the direction, before implementation.
---

This skill takes the current conversation context and codebase understanding and produces a spec. Do NOT interview the user — just synthesize what you already know.

Read `docs/agents/issue-tracker.md` when present. Without an explicit tracker configuration, use Local Markdown under `.scratch/`.

Treat the conversation and referenced source material as the authority for the requested requirements and scope.

## Process

Before implementation, write the entire spec in the user's language, following the structure defined by `<spec-template>`, then publish it to the project issue tracker.

The `<spec-template>` block defines the document's structure and semantics, not literal output wording. Write all headings and prose in the user's language rather than copying the English wording from the template.

<spec-template>

## Problem

Describe the problem from the affected user's or stakeholder's perspective and explain its impact.

## Proposed Outcome

Describe the desired outcome without introducing unconfirmed requirements or prematurely prescribing an implementation.

## Affected Users and Systems

Identify the users, roles, teams, and systems known to be affected. Include only those supported by the conversation or referenced source material.

## Scope

Give a concrete list of the behaviors, workflows, and technical surfaces covered by this spec. Include only items supported by confirmed requirements.

## Out of Scope

List explicit exclusions and boundaries supported by the conversation or referenced source material.

## Constraints

Document established product, security, compliance, compatibility, operational, schedule, and technical constraints. Do not invent constraints.

## Confirmed Decisions

Document decisions explicitly established in the conversation, referenced project documentation, or relevant ADRs. These decisions constrain subsequent design and implementation. They may include:

- API paths and contracts
- Type definitions and schemas
- Technology choices
- Required implementation paths
- Module or interface boundaries
- Specific system interactions

Include the rationale when it was established. Use existing code only to identify constraints; do not treat it as a source of new requirements. Prefer descriptive text over code snippets, but use code when it expresses contracts, schemas, state machines, or type shapes more precisely.

## Proposed Approach

Include this section only when the sources discuss a tentative implementation direction that has not been confirmed. Clearly identify it as non-binding and subject to change during design or planning. Omit this section when no tentative approach was discussed.

## Open Questions

Record unresolved questions surfaced by the conversation or referenced source material. Do not present assumptions or proposed approaches as settled decisions. Omit this section when there are no known open questions.

</spec-template>
