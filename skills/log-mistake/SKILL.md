---
name: log-mistake
description: Record agent mistakes in the current repository's mistake log and apply the user's prevention measures. Use when the user points out that the agent made a mistake or asks to act on logged mistakes.
---

# Log Mistake

The mistake log is `docs/agents/mistakes.md` at the repository root. The user reviews it, decides prevention measures, and the agent applies them and removes the resolved entries.

## Log a Mistake

When the user points out a mistake, record it, then continue correcting it. If the file does not exist, create it with an `# Agent Mistakes` heading.

Log only mistakes by the agent. When the user changes or adds a requirement rather than correcting the agent's work, do not log it.

Append one entry per mistake:

```markdown
## YYYY-MM-DD: <short title>

- **Mistake:** What the agent did.
- **Correction:** What the user pointed out or asked for instead.
- **Cause:** One of: misread intent, did not follow an existing rule, missing or unclear rule. Add one sentence explaining it.
- **Related rule:** The skill, AGENTS.md section, or other rule involved, or none.
```

The template defines structure, not literal wording. Write the heading, labels, and content in the user's language. When the file already exists, keep its existing heading and label wording.

Write each field as one or two concrete sentences that a reader without this conversation can understand. Do not edit skills or AGENTS.md as part of logging; prevention measures come from the user's review.

The entry is complete when all four fields are filled and the file is saved. Tell the user in one line that the mistake was logged.

## Apply Prevention Measures

When the user, after reviewing the log, requests prevention measures for one or more entries:

1. Apply each measure as the user specified, such as editing a skill, AGENTS.md, or a test.
2. Remove from the log each entry whose requested measures are all applied. Keep entries the user has not addressed.
3. Report the measures applied and the entries removed.
