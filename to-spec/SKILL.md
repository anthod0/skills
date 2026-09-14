---
name: to-spec
description: Reconcile confirmed requirements into a source-grounded implementation spec.
disable-model-invocation: true
---

# To Spec

Create a spec from the current conversation and any referenced source material.

Inspect only the code and project documentation needed to verify relevant existing behavior, constraints, and terminology.

Do not expand the requested scope. Requirements must be explicitly supported by the conversation or referenced source material. Use existing behavior only to verify context and constraints, not as a source of new requirements. Put uncertain or inferred possibilities under Open Questions rather than presenting them as requirements.

Include only sections that add useful information:

- **Problem** — what the user needs to change or accomplish.
- **Desired outcome** — the externally observable result.
- **Requirements** — confirmed behavior and constraints.
- **Acceptance criteria** — how completion can be verified.
- **Implementation decisions** — established technical or architectural decisions that constrain the work.
- **Out of scope** — boundaries that are useful to state explicitly.
- **Open questions or assumptions** — unresolved points that must not be treated as requirements.

Use user stories only when distinct actors or journeys make the requirements clearer. Do not generate stories for comprehensiveness.

Avoid file paths and code snippets unless they precisely capture an established interface or design decision that prose would make ambiguous.

Publish the completed spec using the tracker configured in `docs/agents/issue-tracker.md`. Without explicit tracker configuration, write `.scratch/<feature-slug>/spec.md`; a Git remote alone does not select an external tracker.

The spec is complete when it faithfully captures the agreed scope, separates confirmed requirements from unknowns, and can be implemented and reviewed without further decomposition.
