# Scheme 1 — worktree + copy ignored files

Linked git worktree. Tracked files from `git worktree add`. Ignored files copied with `cp -a`. Use when CoW is unavailable.

## Create

Primary checkout must be a git repo (not itself a linked worktree if the tool requires a primary — use `git rev-parse --show-toplevel`).

```bash
src=$(git rev-parse --show-toplevel)
repo=$(basename "$src")
name=$1
base=${2:-HEAD}
dest="$HOME/worktrees/$repo/$name"
branch="agent/$name"

mkdir -p "$(dirname "$dest")"
git worktree add -b "$branch" "$dest" "$base"

# COPY_PATHS filled at setup from the project's required ignored paths
for rel in "${COPY_PATHS[@]}"; do
  src_path="$src/$rel"
  [ -e "$src_path" ] || continue
  mkdir -p "$(dirname "$dest/$rel")"
  cp -a "$src_path" "$dest/$rel"
done
```

`$src` is the primary checkout. Print `$dest` on stdout when done.

Fail if `$dest` exists, if `$branch` already exists, or if `git worktree add` fails. Do not fall back to a second clone.

## Creation script

Write a bash script at the path selected during setup that implements Create above, with `COPY_PATHS` hardcoded. `chmod +x`.
