---
name: to-spec
description: Turn the current conversation into a spec and publish it to the project issue tracker — no interview, just synthesis of what you've already discussed.
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a spec (you may know this document as a PRD). Do NOT interview the user — just synthesize what you already know.

Read `docs/agents/issue-tracker.md` when present. Without an explicit tracker configuration, use Local Markdown under `.scratch/`; a GitHub remote alone never selects GitHub Issues.

Treat the conversation and referenced source material as the authority for the requested scope.

## Process

Write the spec using the structure of the template below, preferably in the user's language, then publish it to the project issue tracker.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

Derive user stories from explicit user needs in the conversation or referenced source material. Do not invent user stories for needs that are not present in those sources.

## Implementation Decisions

Document implementation decisions established in the conversation, referenced project documentation, or relevant ADRs. Use existing code only to identify constraints; do not treat it as a source of new requirements. Relevant implementation decisions may include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Prefer descriptive text over code snippets. Use code snippets when they describe core elements—such as state machines, schemas, or type shapes—more precisely than prose.

## Scope

A concrete list of the behaviors, workflows, and technical surfaces covered by this spec. Include only items supported by confirmed requirements.

## Out of Scope

Explicit exclusions or boundaries supported by the conversation or referenced source material.

</spec-template>
