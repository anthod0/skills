# Scheme 3 — CoW whole-repo clone

Independent Git repository copied from the project directory, including `.git`. Commits live only in the clone until pushed; selected local resources remain shared through symbolic links. Use when the user explicitly wants throwaway clones or isolation from shared hooks/config/stash.

Requires CoW on the repo's volume and a destination on the same filesystem. Abort if CoW copying fails; do not fall back to a full copy.

## Create

Copy the primary checkout to `<workspace-root>/<repo>/<name>`, where `<repo>` is its directory name and `<name>` is the supplied workspace name.

Fail if the destination already exists. Create any missing parent directories, then CoW-copy the entire source checkout, including its Git metadata, while preserving file metadata and symbolic links.

For resources selected for sharing during setup, replace only the newly created copies in the destination with symbolic links to their recorded authoritative locations. Leave the source resources unchanged and stop if linking fails.

Remove inherited linked-worktree registrations from the clone's Git metadata only. Disable automatic remote-branch guessing in the clone's local Git configuration, then immediately create and switch to a new branch named `agent/<name>` at the copied HEAD so both copies are not left committing on `main`. Fail if that branch already exists or cannot be created.

Exclude or remove copied runtime files, such as process-ID files and sockets, when they would break the clone. Preserve dependencies and environment files, including `node_modules` and `.env`. Print the destination path to standard output only after creation succeeds.

## Creation script

Write an executable Bash script at the path selected during setup that implements the creation behavior above. Embed the selected workspace root and shared-link mappings. Resolve the source checkout and workspace root independently of the caller's working directory.

Include the checks and applicable repairs in [Runtime relocation](./setup.md#runtime-relocation) after copying and before reporting success.
