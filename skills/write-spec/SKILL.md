---
name: write-spec
description: Capture confirmed intent in specs and maintain implementation tickets. Use when writing a spec or design proposal, splitting a spec into tickets, or updating tickets with confirmed decisions.
---

This skill takes the current conversation context and codebase understanding and produces a spec. Before synthesizing it, read and apply [`/decide-for-me`](../decide-for-me/SKILL.md). Do not conduct a general requirements interview; ask only for agreement required by those boundaries. If a decision remains blocked, stop before publishing the spec.

Read `docs/agents/issue-tracker.md` when present. Without an explicit tracker configuration, use Local Markdown under `.scratch/`.

When splitting a spec into issues or tickets, or updating tickets with confirmed decisions, read and follow [TICKETS.md](TICKETS.md). Use its ticket process rather than the full spec template below; decomposition does not require every downstream design decision to be settled.

Treat the conversation and referenced source material as the authority for the requested requirements and scope.

## Work Types

Classify the work into these types and keep them separate in the spec and tickets:

- **External exploration**: learning how to use external tools, APIs, SDKs, CLIs, and services. Complete it before writing the spec, as described in [Understand External Interfaces](#understand-external-interfaces).
- **External configuration**: changes made outside the codebase, such as console settings, accounts, credentials, permissions, environment variables, DNS, and third-party resources.
- **Deployment**: building, releasing, migrating, and rolling out to an environment, plus post-release verification.
- **Code implementation**: changes to the repository's code and tests. Code may read a configuration key; setting its value in an environment is external configuration.

## Understand External Interfaces

Before writing the spec, investigate every external tool, API, SDK, or service the work touches until you can state how the implementation will use it. Read official documentation, SDK source or type definitions, and existing usage in the codebase; run non-destructive commands or calls when that is the only way to confirm behavior. Do not record "how does X work" or "which call should we use" as an open question for the user.

Ask the user only for what investigation cannot supply: access you lack, such as accounts, credentials, or paid environments, and decisions reserved by [`/decide-for-me`](../decide-for-me/SKILL.md), such as adding an external dependency. Ask for the access, then finish the investigation yourself.

When confirming external behavior needs substantial validation work, such as a prototype against a live service, a load or compatibility test, or experiments that need provisioned resources, do not guess and do not hide it inside a ticket. Propose a separate validation project as a prerequisite of the whole spec: state the questions, the evidence it must produce, and the environment it needs. Record it in the spec as a prerequisite. Tickets may be drafted before it finishes, but tickets that depend on its results stay blocked until the results are recorded in the spec's integration points.

## Process

Before implementation, write the entire spec in the user's language, following the structure defined by `<spec-template>`, then publish it to the project issue tracker.

When recording the spec, discover the project's domain-modeling conventions through `AGENTS.md` or `CLAUDE.md` and follow the linked workspace guides to update confirmed domain terms and architectural decisions. If no conventions are configured, do not invent a layout or fall back to an external skill; ask where to record domain knowledge when an update is needed. Read the relevant existing domain documents first; reference them rather than duplicating their full contents in the spec. Use this pass to capture confirmed knowledge not yet reflected in those documents; it is not a reason to defer updates during discussion. Leave documents unchanged when there is nothing new to record. Keep tentative terms and decisions in the spec's proposed approach or open questions, not in the glossary or accepted ADRs. This is a documentation sync, not a new design interview.

The `<spec-template>` block defines the document's structure and semantics, not literal output wording. Write all headings and prose in the user's language rather than copying the English wording from the template.

<spec-template>

## Problem

Describe the problem from the affected user's or stakeholder's perspective and explain its impact.

## Proposed Outcome

Describe the desired outcome without introducing unconfirmed requirements or prematurely prescribing an implementation.

## Affected Users and Systems

Identify the users, roles, teams, and systems known to be affected. Include only those supported by the conversation or referenced source material.

## Scope

Give a concrete list of the behaviors, workflows, and technical surfaces covered by this spec. Include only items supported by confirmed requirements. Group the items by work type: code implementation, external configuration, and deployment. Omit a group with no items.

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

## External Integration Points

Include this section when the work touches external tools, APIs, SDKs, or services. For each one, record the verified usage the implementation relies on: the version, the endpoints, SDK methods, CLI commands, or events used, authentication, required configuration keys, relevant limits and error behavior, and the source used to verify each item. Record what code calls and what must be configured, not a tutorial. List any prerequisite validation project here with its questions and status.

## Proposed Approach

Include this section only when the sources discuss a tentative implementation direction that has not been confirmed. Clearly identify it as non-binding and subject to change during design or planning. Omit this section when no tentative approach was discussed.

## Open Questions

Record unresolved questions surfaced by the conversation or referenced source material. Do not include questions about external interface usage; resolve them by investigation or a prerequisite validation project. Do not present assumptions or proposed approaches as settled decisions. Omit this section when there are no known open questions.

</spec-template>
