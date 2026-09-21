---
name: setup-skills
description: Configure this repo for the engineering skills — set up its issue tracker, domain doc layout, and workspace creation. Run once before first use of the other engineering skills.
disable-model-invocation: true
---

# Setup Skills

Scaffold the per-repo configuration that the engineering skills assume:

- **Issue tracker** — where issues live (Local Markdown by default; external trackers require an explicit choice)
- **Domain docs** — where `CONTEXT.md` and ADRs live, and the consumer rules for reading them
- **Workspaces** — a creation script plus an `AGENTS.md` / `CLAUDE.md` record so later agents create isolated working directories the same way

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write.

## Process

### 1. Explore

Look at the current repo to understand its starting state. Read whatever exists; don't assume:

- `AGENTS.md` and `CLAUDE.md` at the repo root — does either exist? Is there already an `## Agent skills` section or an explicit tracker choice in either?
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repo root
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/` — does this skill's prior output already exist?
- `.scratch/` — sign that a local-markdown issue tracker convention is already in use
- Monorepo signals — a `pnpm-workspace.yaml`, a `workspaces` field in `package.json`, or a populated `packages/*` with its own `src/`. Present only in a genuinely large multi-package repo; their absence means single-context, which is almost every repo.
- The workspace creation script — check the path specified by the user or recorded in project instructions, otherwise `scripts/create-workspace`. Is it already initialized?
- CoW on this repo's volume — run the probe in [Workspace setup](./workspaces/setup.md#probe-cow) (repo filesystem, not `/tmp`)
- Ignored files worth carrying — follow [Ignored files to carry](./workspaces/setup.md#ignored-files-to-carry-schemes-1-and-2), including other gitignored paths at the repo root that are needed to run the project.

### 2. Present findings and ask

Summarise what's present and what's missing. Then take the sections in order — one section, one answer, then the next.

Lead each section with the recommended answer so the user can accept it in a word. Give a one-line explainer only when the choice genuinely branches; skip asking about the domain-doc layout when exploration found no monorepo.

**Section A — Issue tracker.**

> Explainer: The "issue tracker" is where `write-spec` publishes its output.

Recommend **Local Markdown** and ask the user to accept it or explicitly choose another tracker. A GitHub or GitLab remote is repository metadata, not a tracker choice; never infer the tracker from it.

- **Local Markdown (default)** — files under `.scratch/<feature>/`
- **GitHub** — GitHub Issues via `gh`; use only when the user or existing project instructions explicitly select it
- **GitLab** — GitLab Issues via [`glab`](https://gitlab.com/gitlab-org/cli); use only when explicitly selected
- **Other** — record the user's workflow as freeform prose

Record the confirmed choice in `docs/agents/issue-tracker.md`.

**Section B — Domain docs.** Default to **single-context** — one `CONTEXT.md` + `docs/adr/` at the repo root. This fits almost every repo; write it without asking.

Offer **multi-context** — a root `CONTEXT-MAP.md` pointing to per-context `CONTEXT.md` files — only when exploration found monorepo signals. Then confirm which layout they want.

**Section C — Workspaces.**

> Explainer: Later agents must create extra working directories with one script, not by inventing `git worktree` vs clone each time.

Use `scripts/create-workspace` as the default script path without asking. Honor a path specified by the user or already recorded in project instructions, and use the selected path throughout the generated configuration.

Recommend scheme **2** when the CoW probe returned `cow`, otherwise scheme **1**. Ask the user to accept the default or explicitly choose 1, 2, or 3. Never default to 3.

For schemes 1 and 2, select the ignored paths needed to run the project using [Ignored files to carry](./workspaces/setup.md#ignored-files-to-carry-schemes-1-and-2). Scheme 3 CoW-copies the whole tree and needs no carry list; handle runtime files as described in its scheme file.

Read **only** the chosen scheme file linked in [Workspace setup](./workspaces/setup.md#schemes) before writing the script.

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block to add to whichever of `CLAUDE.md` / `AGENTS.md` is being edited (see step 4 for selection rules)
- The contents of `docs/agents/issue-tracker.md` and `docs/agents/domain.md`
- The workspace creation script at the selected path (from the chosen scheme file, `COPY_PATHS` filled in for schemes 1 and 2)

Let them edit before writing.

### 4. Write

**Pick the file to edit:**

- If `CLAUDE.md` exists, edit it.
- Else if `AGENTS.md` exists, edit it.
- If neither exists, ask the user which one to create — don't pick for them.

Never create `AGENTS.md` when `CLAUDE.md` already exists (or vice versa) — always edit the one that's already there.

If an `## Agent skills` block already exists in the chosen file, update its contents in-place rather than appending a duplicate. Don't overwrite user edits to the surrounding sections.

The block:

```markdown
## Agent skills

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Domain docs

[one-line summary of layout — "single-context" or "multi-context"]. See `docs/agents/domain.md`.

### Workspaces

When the user wants a worktree or an isolated workspace, create it with [the generated script's actual path, including its required and optional arguments].
```

Then write the docs files using the seed templates in this skill folder as a starting point:

- [issue-tracker-github.md](./issue-tracker-github.md) — GitHub issue tracker
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md) — GitLab issue tracker
- [issue-tracker-local.md](./issue-tracker-local.md) — local-markdown issue tracker
- [domain.md](./domain.md) — domain doc consumer rules + layout

For "other" issue trackers, write `docs/agents/issue-tracker.md` from scratch using the user's description.

Write the creation script at the selected path from the chosen scheme file, creating its parent directory if needed, and `chmod +x`. Its scope is workspace creation only; do not add merge, push, PR, or workspace removal operations.

### 5. Done

Tell the user the setup is complete and which engineering skills will now read from these files. Mention they can edit `docs/agents/*.md` directly later — re-running this skill is only necessary if they want to switch issue trackers, change workspace scheme, or restart from scratch. Later agents create workspaces with the command recorded in project instructions, not by re-reading the scheme files.
