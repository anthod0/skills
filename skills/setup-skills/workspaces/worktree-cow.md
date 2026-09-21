# Scheme 2 — worktree + CoW ignored files

Linked git worktree. Tracked files from `git worktree add`. Ignored files cloned with filesystem CoW so they share blocks until edited.

Requires CoW on the **repo's volume** (APFS `cp -c`, or Linux `cp --reflink=always` on btrfs/XFS). Setup already probed this; if a later CoW copy fails, abort — do not silently `cp` without reflink.

## Create

```bash
src=$(git rev-parse --show-toplevel)
repo=$(basename "$src")
name=$1
base=${2:-HEAD}
dest="$HOME/worktrees/$repo/$name"
branch="agent/$name"

mkdir -p "$(dirname "$dest")"
git worktree add -b "$branch" "$dest" "$base"

cow_cp() {
  if cp --reflink=always -a "$1" "$2" 2>/dev/null; then return 0; fi
  if cp -c -R "$1" "$2" 2>/dev/null; then return 0; fi
  echo "CoW copy failed: $1" >&2
  exit 1
}

for rel in "${COPY_PATHS[@]}"; do
  src_path="$src/$rel"
  [ -e "$src_path" ] || continue
  mkdir -p "$(dirname "$dest/$rel")"
  cow_cp "$src_path" "$dest/$rel"
done
```

`$src` is the primary checkout. Print `$dest` on stdout when done.

Fail if `$dest` exists or `$branch` already exists. Destination must be on the same filesystem as `$src`.

## Creation script

Write a bash script at the path selected during setup that implements Create above, with `COPY_PATHS` hardcoded. `chmod +x`.
