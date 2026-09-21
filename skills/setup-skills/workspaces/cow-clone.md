# Scheme 3 — CoW whole-repo clone

Independent copy of the project directory, including `.git`. Not a linked worktree. Commits live only in the clone until pushed. Use when the user explicitly wants throwaway clones or isolation from shared hooks/config/stash.

Requires CoW on the repo's volume. Abort if reflink/`cp -c` fails — do not fall back to a full copy.

## Create

```bash
src=$(git rev-parse --show-toplevel)
repo=$(basename "$src")
name=$1
dest="$HOME/worktrees/$repo/$name"
branch="agent/$name"

mkdir -p "$(dirname "$dest")"
[ ! -e "$dest" ] || { echo "exists: $dest" >&2; exit 1; }

if ! cp --reflink=always -a "$src" "$dest" 2>/dev/null; then
  if ! cp -c -R "$src" "$dest" 2>/dev/null; then
    echo "CoW clone failed" >&2
    exit 1
  fi
fi

rm -rf "$dest/.git/worktrees"
git -C "$dest" config --local checkout.guess false
git -C "$dest" checkout -b "$branch"
```

`$src` is the primary checkout. Print `$dest` on stdout.

Immediately create `$branch` so both copies are not left committing on `main`. Skip runtime junk after clone if it would break the copy (`*.pid`, `*.sock`); do not delete `node_modules` or `.env`.

## Creation script

Write a bash script at the path selected during setup that implements Create above. `chmod +x`.
