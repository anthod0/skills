---
name: codebase-design
description: Review or redesign a consequential module interface. Use when consolidating shallow modules, placing a substitution seam, or comparing alternative interfaces.
---

# Codebase Design

Use this skill for decisions whose interface or seam will shape multiple callers or be costly to reverse. Do not load it for routine implementation, naming, dependency injection, or local refactoring.

Before designing, read the repository's domain and architecture documentation. Preserve its established vocabulary; the terms below are reasoning tools, not a mandate to rename project concepts.

## Choose the workflow

- **Consolidating a cluster of shallow modules** → read [DEEPENING.md](DEEPENING.md).
- **Comparing substantially different interfaces** → read [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md).
- **Reviewing one proposed interface** → use the focused review below.

Read only the workflow needed for the task.

## Focused interface review

Evaluate the design on three dimensions:

- **Depth** — how much useful behaviour callers get for what they must learn.
- **Locality** — whether rules, change, bugs, and verification stay concentrated.
- **Seam placement** — whether replaceable behaviour is isolated where variation actually occurs.

Then:

1. Identify callers and everything they must know: operations, invariants, ordering, errors, configuration, and relevant performance constraints.
2. Find complexity leaking into callers, especially repeated orchestration or duplicated rules.
3. Propose the smallest coherent interface that hides that complexity without erasing capabilities callers need.
4. Keep implementation-only seams private. Expose a seam only when it provides concrete isolation, substitution, or testing value now.
5. Test observable behaviour through the same interface callers use.
6. State trade-offs and recommend a design; do not present an unranked menu.

Use the deletion test as a diagnostic: if removing the module makes its complexity spread across callers, it provides leverage. If the complexity simply disappears, it may be a pass-through.

## Working vocabulary

- **Module** — something with an interface and an implementation, at any scale.
- **Interface** — everything callers must know to use a module correctly, not only its type signature.
- **Implementation** — behaviour hidden inside the module.
- **Seam** — a location where behaviour can change without editing its callers.
- **Adapter** — an implementation that occupies a seam.
- **Depth** — leverage delivered through the interface, not a ratio of code lines.
- **Leverage** — capability gained per unit of interface learned.
- **Locality** — concentration of knowledge and change.

Use more specific repository terms such as `service`, `component`, or `API` when they are part of the project's established language.
