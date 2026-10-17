# Scheme 1 — worktree + copy ignored files

Linked Git worktree with ordinary copies of independent local resources and symbolic links to shared resources. Use when CoW is unavailable.

## Create

Copy local resources from the primary checkout. Accept a workspace name and an optional base revision, defaulting to the calling checkout's HEAD, including when called from a linked worktree. Resolve the base there before changing directories. Uncommitted code changes are not carried into the new worktree.

Create a linked worktree at `<workspace-root>/<repo>/<name>`, where `<repo>` is the primary checkout's directory name, creating missing parent directories. Use a new branch named `agent/<name>` at the selected base revision.

Copy each path selected for independent use during setup from the source checkout to the same relative location in the workspace. Skip copy paths that no longer exist, create missing parent directories, and preserve file metadata and symbolic links. For each resource selected for sharing, create a symbolic link at its corresponding workspace path to the authoritative location recorded during setup. Print the destination path to standard output only after creation succeeds.

Fail if the destination or branch already exists, or if worktree creation, copying, or linking fails. Do not fall back to a second clone.

## Creation script

Write an executable Bash script at the path selected during setup that implements the creation behavior above. Embed the selected workspace root, copy list, and shared-link mappings. Resolve the source checkout and workspace root independently of the caller's working directory.

Include the checks and applicable repairs in [Runtime relocation](./setup.md#runtime-relocation) after copying and before reporting success.
