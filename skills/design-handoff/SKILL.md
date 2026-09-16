---
name: design-handoff
description: Asynchronously stress-test and settle a design before implementation.
disable-model-invocation: true
---

# Design Handoff

Reach shared understanding through one worksheet, not a turn-by-turn interview. Maintain a **design tree** in which decisions branch from their prerequisites; its **frontier** contains the ready decisions that require the user's intent.

Use `/domain-modeling` as terms crystallise. Implementation begins only after the user confirms the completed design and separately asks to proceed.

## 1. Explore and apply the decision gate

Create or resume `.scratch/design-handoff/<topic>.md`. Explore the repository, environment, and relevant standards before drafting questions; discovering facts is agent work. Record each fact with its source.

Apply this **decision gate** to every ready decision:

1. **Derivable** from facts, standards, specifications, or project convention → settle it.
2. Otherwise it is **intent-dependent**:
   - reversing it changes types, signatures, module boundaries, public API, or written scope (**shape**) → ask;
   - reversing it changes only prose, messages, comments, test coverage, or similar local details (**content**) → settle it.
3. Uncertain classifications go to the frontier as shape decisions. A user's correction establishes the classification for similar decisions in this session.

For each agent-settled decision, record its classification (`Derivable` or `Content`), rationale, and strongest alternative. Order these by likelihood of objection. Follow standing instructions for process preferences such as commits and checks; record missing preferences in the final plan.

This step is complete when every foreseeable decision is agent-settled, on the frontier, blocked by a named decision, or blocked by named research.

## 2. Maintain the worksheet

Use stable decision IDs and this compact structure:

```md
# <Topic>
Status: Editing | Researching | Awaiting confirmation | Complete

## Goal
<Scope and constraints.>

## Established facts
- <Fact — source.>

## User-settled decisions
### D1: <Title>
**Decision:** ...
**Rationale:** ...

## Agent-settled decisions
### D2: <Title>
**Decision:** ...
**Classification:** Derivable | Content
**Rationale:** ...
**Strongest alternative:** ...

## Frontier
### D3: <Question>
**Why now:** <Why ready, intent-dependent, and shape-changing.>
**Recommendation:** <Answer and trade-offs.>
**Your decision:** <!-- Answer, or "accept". -->

## Blocked decisions
### D4: <Question>
**Depends on:** D3
**If relevant:** <Conditional recommendation or early answer.>
**Your decision:** <!-- Optional. -->

## Researching
- <Fact to investigate and decisions it blocks.>

## Notes for the agent
<!-- Corrections, scope changes, classification disputes, or missing branches. -->
```

Show useful blocked branches so the user can answer conditionally. A complete tree visits every branch; only intent-dependent shape decisions become questions.

## 3. Hand off or continue

- **Frontier nonempty:** set `Status: Editing`, finish the worksheet, and hand off only its path with a request to edit it and report back. The user owns the worksheet until handback.
- **Frontier empty, research nonempty:** set `Status: Researching` and finish the research yourself.
- **Frontier and research empty:** proceed to confirmation.

This step is complete when the worksheet is owned by exactly one party and no empty editing round was created.

## 4. Process a handback

1. Read the entire worksheet; `accept` takes the recommendation and blanks remain unresolved.
2. Apply `Notes for the agent` before interpreting answers.
3. Move answers to `User-settled decisions`, preserving their meaning.
4. Update `CONTEXT.md` through `/domain-modeling` for resolved terms. Put any qualifying ADR offer in the worksheet.
5. Recompute the design tree: prune irrelevant branches, unlock dependants, investigate facts, and run every ready decision through the decision gate.
6. Return to the handoff rules above.

This step is complete when every answer and note has been incorporated and every reachable decision has a current state.

## 5. Confirm

When the frontier and research queue are empty, verify that every branch was visited and every assumption is recorded. Summarise the plan in the worksheet, set `Status: Awaiting confirmation`, and ask only for confirmation. After confirmation, set `Status: Complete`.
