# Workspace setup

Read during setup to select a workspace scheme and decide which local resources to copy or share. After the user chooses a scheme, read **only** its file when generating or changing the creation script:

## Schemes

| Scheme | When | File |
| --- | --- | --- |
| 1 | No CoW on this disk | [worktree-copy.md](./worktree-copy.md) |
| 2 | CoW works (default when it does) | [worktree-cow.md](./worktree-cow.md) |
| 3 | Independent CoW clone | [cow-clone.md](./cow-clone.md) |

## CoW requirements

Schemes 2 and 3 require CoW support and a destination on the same filesystem as the source checkout. Use scheme 1 when these conditions are not met.

## Local resources to copy or share

Inspect gitignored files and directories throughout the repo for resources needed to run the project or follow its agent instructions, specs, and domain docs. Common environment and dependency paths include:

`.env`, `.env.local`, `.env.development`, `.env*.local`, `node_modules`, `.venv`, `venv`, `vendor`, `Pods`

For CoW schemes, retain reusable build outputs and caches by default. For ordinary copies, weigh their reuse value against the cost of copying. Exclude transient process state, such as PID files and sockets, and artifacts known to be incompatible with the target workspace.

Choose each resource's handling based on its purpose and the user's intended workflow:

- **Share through a symbolic link** when edits must be immediately visible across workspaces, such as shared private project documentation. Link to the authoritative resource in the primary checkout or its established shared location.
- **Copy** when the workspace needs its own writable instance, such as runtime dependencies and workspace-specific environment configuration. Use ordinary copies in scheme 1 and CoW copies in schemes 2 and 3.

Record the selected paths and handling as defaults in the creation script. Ask only when the user's goals and project instructions leave the choice unclear. Agents may adjust these defaults at creation time for the current repository and target revision.

Schemes 1 and 2 need copy lists and shared-link mappings; scheme 3 copies the whole tree and needs only the shared-link mappings. Keep copy and link operations from overlapping, and leave source resources unchanged during creation.

## Runtime relocation

Inspect the project's runtime resources during setup and include these checks in the generated creation script after copying:

- **Absolute path references:** Search copied runtime text files for absolute paths into the source checkout. Rewrite operational references that should point into the new workspace using the actual source and destination paths. Preserve comments and intentional shared-resource references.
- **Symbolic links:** Check copied links against their intended targets, resolved from the source links' original locations. Redirect references to independently copied resources to their workspace counterparts, preserve shared-resource and external-cache targets, and adjust relative links affected by relocation.

Encode repairs based on the inspected file formats and dependency layout. Rewrite only understood regular text files and the copied links themselves; do not traverse directory links or modify source files, shared targets, external caches, or binaries. Report paths outside the script's supported runtime layout for the creating agent to assess.
