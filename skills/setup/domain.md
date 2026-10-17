# Domain Modeling

Use one `CONTEXT.md` at the repo root for domain terminology and `docs/adr/` for effective architectural decisions. Discover this guide through the project's `AGENTS.md` or `CLAUDE.md`; use the format documents linked below when maintaining domain content.

## Read existing knowledge

Read `CONTEXT.md` when working with domain concepts. Use its canonical terms rather than synonyms it explicitly avoids.

List `docs/adr/` and read relevant ADRs as needed. Explicitly flag conflicts with existing decisions rather than silently overriding them.

If `CONTEXT.md` or `docs/adr/` does not exist, proceed without flagging the absence or proposing empty scaffolding. Create domain content only when there is confirmed knowledge to record.

## Sharpen the model during discussion

- **Challenge conflicting terminology.** When a term conflicts with the glossary, point out the mismatch and resolve which meaning is intended.
- **Clarify vague or overloaded language.** Propose a precise canonical term and confirm its meaning rather than silently treating distinct concepts as synonyms.
- **Test relationships with concrete scenarios.** Use edge cases to clarify boundaries between concepts; hypothetical scenarios are not confirmed requirements.
- **Cross-check claims against code.** Surface discrepancies between described behavior and implementation. Code establishes current behavior, not intended requirements.

## Record confirmed knowledge

Update `CONTEXT.md` when a term is resolved rather than batching updates until the end. Keep it a domain glossary, not a spec, scratch pad, or collection of implementation details. Before editing it, read [context-format.md](./context-format.md).

Before creating, changing, merging, or deleting ADRs, read [adr-format.md](./adr-format.md). It defines admission criteria, naming, content boundaries, and maintenance rules. Record only confirmed architectural decisions; obtain user confirmation for unresolved architectural choices before changing the ADR set. An explicit user decision or an approved spec already authorizes the decisions it covers; do not ask for the same confirmation again.

Keep tentative terminology, unresolved decisions, and proposed approaches in the spec or discussion until confirmed. Leave domain documents unchanged when there is no new confirmed knowledge to record.
