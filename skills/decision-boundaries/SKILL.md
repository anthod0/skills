---
name: decision-boundaries
description: Decision boundaries before changing code. Use when writing a spec or when the user requests a code change directly.
---

# Decision Boundaries

Apply these boundaries while shaping requirements in either of these situations:

- before writing or publishing a spec;
- when the user has not specified a spec and directly requests a code change.

An approved spec or an explicit user decision is valid authorization within the scope it covers. Do not reopen it for discussion. Implementation governed by an approved spec is outside this skill unless it reveals a new decision that the spec did not settle.

These boundaries are not an exhaustive classification of all decisions. Apply them to each concrete decision rather than to the task as a whole.

## Establish Existing Authorization

Treat a decision as confirmed when the user has explicitly supplied, selected, or accepted it in the current conversation or an approved source of requirements. A precise instruction is itself confirmation; a broad request that states only the outcome while leaving a decision below open is not.

Authorization is limited to the decision that was made. For example, authorization for a frontend change does not also authorize supporting API or database changes.

## Decision Rights

### A. Reserve Key Decisions for the User

For each decision below that has not yet been confirmed:

1. Investigate the existing system and relevant constraints.
2. Proactively recommend one concrete choice, explaining material trade-offs when they affect the recommendation.
3. Ask the user to accept or revise the recommendation.
4. Treat the spec content and code changes that depend on the decision as blocked until the user responds.

Work that neither depends on nor constrains the unresolved decision may continue.

The following decisions require user confirmation:

- any database modification;
- interface and event inputs, outputs, validation, and errors;
- any state-machine modification;
- adding or removing an external dependency;
- changing an ADR;
- types directly coupled to a database or interface definition, including request and response types, database enums, JSON fields, and derived fields;
- interfaces, types, inheritance relationships, and function signatures spanning multiple modules;
- execution-order or timing changes that affect externally observable behavior;
- critical parameters such as page size, ordering, retry counts, and timeout values.

When writing a spec, record only agreed decisions as confirmed; do not present an unresolved recommendation as an implementation-ready decision. When changing code directly, stop before editing anything that depends on an unresolved decision.

### B. Delegate Implementation Decisions to the Agent

Once the user has requested the related work, the agent may make the following decisions without seeking additional confirmation:

- control flow, private functions, private types, internal naming, and other implementation choices contained within one module;
- code-organization refactoring across files, modules, or functions when functionality and externally observable behavior remain unchanged;
- formatting, lint fixes, and local type-checking fixes that do not change data structures;
- documentation;
- tests;
- frontend changes.

When writing a spec, omit an implementation choice unless it is necessary to define the intended outcome. When changing code directly, proceed without adding a confirmation step.

Apply boundaries according to the decision's semantic effect, not the type of file being changed. If a frontend, documentation, test, lint, or type-checking change also makes a decision reserved for the user, that decision still requires user confirmation.

### C. Other Decisions

For a decision not covered by A or B, declare the implementation scope and ask the user to confirm it. Do not force an unlisted decision into either group merely to apply this skill.
