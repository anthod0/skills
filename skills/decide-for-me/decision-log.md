# Decision Log

Record notable decisions the agent made on the user's behalf in `docs/agents/decisions.tsv` at the repository root, for the user to review. The log is write-only for the agent: append entries, and do not read or edit existing ones unless the user asks.

## What to Log

Log a delegated decision when the user might plausibly choose differently, such as:

- choosing between viable approaches with different trade-offs;
- setting a parameter that affects behavior, such as a timeout, retry count, page size, or ordering;
- changing externally observable behavior beyond what the user explicitly asked for;
- judging a borderline case as meeting its change type's condition, such as a `chore` that adds no cost.

Do not log decisions with no plausible alternative worth reviewing, such as naming, formatting, or private control flow. Do not log decisions the user explicitly made. Specs are temporary, so when implementing a spec, treat only its Confirmed Decisions section as made by the user, and log other notable choices the implementation applies, including choices from the spec and choices made during implementation.

## Format

If the file does not exist, create it with this header row:

```tsv
Date	Type	Decision	Rationale
```

Append one row per decision, with fields separated by tabs:

- **Date:** `YYYY-MM-DD`.
- **Type:** the change type, such as `fix` or `chore`.
- **Decision:** the choice made, described by its effect on behavior rather than by code locations.
- **Rationale:** why, including the change type's condition when the case is borderline.

Write the header and fields in the user's language; keep change types such as `fix` as written. When the file already exists, keep its existing header. Write each field as one concrete sentence, understandable without this conversation. Fields must not contain tabs or line breaks. An entry is complete when the row has all four fields and the file is saved.
