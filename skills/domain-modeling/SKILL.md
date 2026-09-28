---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when the user wants to pin down domain terminology or a ubiquitous language, maintain the architectural decisions that currently govern a system, or when another skill needs to maintain the domain model.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline — challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `CONTEXT.md` for vocabulary is not this skill — that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

Each repo has a single domain context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

Create files lazily — only when you have something to write. If no root `CONTEXT.md` exists, create it when the first term is resolved. If no root `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Maintain ADRs sparingly

ADRs are the concise set of architectural decisions that currently govern the system and the reasons for them. They are not an immutable decision log.

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

Then check that the proposed content is stable:

1. Can multiple implementations satisfy the decision?
2. Would an implementation-only refactor leave the ADR unchanged?
3. Would violating the statement actually change the architecture?

If any admission criterion or stability check fails, skip the ADR. Put the information in a spec, current-state technical document, issue, or the code instead.

ADRs contain stable architectural boundaries, authorities, invariants, consequential choices, and the reasons for those choices. They exclude implementation status, migration steps, unresolved questions, future plans, detailed call sequences, volatile protocol details, and code-layout descriptions.

When a governing decision changes, edit, merge, or delete the affected ADRs so the set remains current; Git provides the history. Such changes should be infrequent. Normal feature work, implementation progress, and implementation-only refactoring do not require ADR updates. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).
