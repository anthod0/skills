---
name: decide-for-me
description: Make decisions on the user's behalf, bringing only those that need their input back to them. Use when writing a spec or when the user requests a code change directly.
---

# Decide for Me

Apply these boundaries while shaping requirements in either of these situations:

- before writing or publishing a spec;
- when the user has not specified a spec and directly requests a code change.

An approved spec or an explicit user decision is valid authorization within the scope it covers. Do not reopen it for discussion. Implementation governed by an approved spec is outside this skill unless it reveals a new decision that the spec did not settle.

Apply these boundaries to each concrete decision rather than to the task as a whole. A task of one type may contain a decision reserved for the user.

## Establish Existing Authorization

Treat a decision as confirmed when the user has explicitly supplied, selected, or accepted it in the current conversation or an approved source of requirements. A precise instruction is itself confirmation; a broad request that states only the outcome while leaving a decision below open is not.

Authorization is limited to the decision that was made.

## Reserve Architectural Decisions for the User

The user keeps only foundational, architectural decisions. A decision is architectural when other code, data, or external systems will build on it, so reversing it later requires a migration or coordinated changes across modules. A decision contained in one module that can be reversed locally is not architectural.

Judge each decision by this criterion. The following are typical architectural decisions, not an exhaustive list:

- data model and storage schema changes, including adding a field or table;
- breaking changes to public contracts: external APIs, events, and interfaces other systems or modules depend on;
- module boundaries and cross-module interfaces, types, and inheritance relationships;
- adding or removing an external dependency, service, or infrastructure component;
- adding or restructuring a state machine;
- introducing a new pattern, layer, or mechanism that departs from the codebase's main path;
- changing an ADR.

For each such decision that has not yet been confirmed:

1. Investigate the existing system and relevant constraints.
2. Recommend one concrete choice, explaining material trade-offs when they affect the recommendation.
3. Ask the user to accept or revise the recommendation.
4. Treat the spec content and code changes that depend on the decision as blocked until the user responds. Work that neither depends on nor constrains it may continue.

When writing a spec, record only agreed decisions as confirmed; do not present an unresolved recommendation as an implementation-ready decision.

## Delegate Everything Else by Change Type

Once the user has requested the related work, decide and proceed without a confirmation step when the change meets the condition for its type:

| Type | Proceed when |
|------|--------------|
| `refactor` | Behavior is unchanged and the user has given the direction. Without a direction, propose one and wait for the user's choice. |
| `chore` | It adds no money or time cost, such as paid services, longer build or CI time, or recurring manual work. Otherwise state the cost and ask. |
| `fix` / `feat` | It leaves the architecture unchanged and follows the codebase's existing main path. |
| `docs` | Always. |
| `test` | Always. |

Choices such as parameters, naming, internal control flow, non-breaking interface additions, and frontend details belong to the delegated change. Make them consistently with the existing code.

When writing a spec, omit an implementation choice unless it is necessary to define the intended outcome. Do not log decisions while writing a spec; they are logged when the spec is implemented.

When changing code directly, record notable decisions made on the user's behalf following [decision-log.md](./decision-log.md). Mention the logged entries in the report.
