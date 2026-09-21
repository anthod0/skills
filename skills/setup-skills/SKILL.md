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

This is a prompt-driven skill, not a deterministic script. Explore, confirm the configuration choices below, then generate, check, and write the files without a separate draft approval.

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
- Workspace destination — check whether the user or project instructions already specify where new workspaces should live; otherwise use `$HOME/worktrees` as the workspace root.
- CoW availability — determine whether the source checkout and selected destination meet the [CoW requirements](./workspaces/setup.md#cow-requirements).
- Local resources to copy or share — inspect gitignored resources throughout the repo using [Local resources to copy or share](./workspaces/setup.md#local-resources-to-copy-or-share), including agent/domain materials and runtime dependencies.

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

> Explainer: The generated script provides the default way to create extra working directories with the workspace scheme selected during setup.

Use `scripts/create-workspace` as the default script path without asking. Honor a path specified by the user or already recorded in project instructions, and use the selected path throughout the generated configuration.

Show where new workspaces will be created: `<workspace-root>/<repo>/<name>`, where `<repo>` is the source checkout's directory name. Default the root to `$HOME/worktrees` without a separate confirmation; honor a user-specified or project-recorded location. Bake the selected root into the script so it determines the destination on each run.

Recommend scheme **2** when CoW is supported and the selected destination is on the repo's filesystem, otherwise scheme **1**. Ask the user to accept the default or explicitly choose 1, 2, or 3. Never default to 3. If the destination changes, reassess CoW suitability before writing the script.

Select local resources and their handling using [Local resources to copy or share](./workspaces/setup.md#local-resources-to-copy-or-share).

Read **only** the chosen scheme file linked in [Workspace setup](./workspaces/setup.md#schemes) before writing the script.

### 3. Write

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

Workspaces are created under [the selected workspace root]/<repo>/<name>.
When the user wants a worktree or an isolated workspace, create it with [the generated script's actual path, including its required and optional arguments].
[Optional: Describe any known cases that require manual follow-up after the script runs. Omit if none.]
```

Then write the docs files using the seed templates in this skill folder as a starting point:

- [issue-tracker-github.md](./issue-tracker-github.md) — GitHub issue tracker
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md) — GitLab issue tracker
- [issue-tracker-local.md](./issue-tracker-local.md) — local-markdown issue tracker
- [domain.md](./domain.md) — domain doc consumer rules + layout

For "other" issue trackers, write `docs/agents/issue-tracker.md` from scratch using the user's description.

Write the creation script at the selected path from the chosen scheme file, creating its parent directory if needed, and make it executable. Its scope is workspace creation only; do not add merge, push, PR, or workspace removal operations.

### 4. Done

Tell the user the setup is complete and which engineering skills will now read from these files. Mention they can edit `docs/agents/*.md` directly later — re-running this skill is only necessary if they want to switch issue trackers, change workspace scheme, or restart from scratch. Later agents use the command recorded in project instructions as the starting point and may consult the scheme files or adapt creation steps to the repository's current state.
