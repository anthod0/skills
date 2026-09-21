# Workspace setup

Read during setup to probe CoW and identify ignored files to carry. After the user chooses a scheme, read **only** its file when generating or changing the creation script:

## Schemes

| Scheme | When | File |
| --- | --- | --- |
| 1 | No CoW on this disk | [worktree-copy.md](./worktree-copy.md) |
| 2 | CoW works (default when it does) | [worktree-cow.md](./worktree-cow.md) |
| 3 | Independent CoW clone | [cow-clone.md](./cow-clone.md) |

## Probe CoW

Run on the **repo filesystem**, never `/tmp`:

```bash
root=$(git rev-parse --show-toplevel)
src=$(mktemp "$root/.cow-probe.XXXXXX")
dst="$src.cow"
: > "$src"
if cp --reflink=always "$src" "$dst" 2>/dev/null || cp -c "$src" "$dst" 2>/dev/null; then
  echo cow
else
  echo copy
fi
rm -f "$src" "$dst"
```

`cow` → default scheme 2. `copy` → default scheme 1. Scheme 3 is never default.

## Ignored files to carry (schemes 1 and 2)

List paths that exist, are gitignored, and are needed to run the project. Probe these names when they exist and `git check-ignore -q` succeeds:

`.env`, `.env.local`, `.env.development`, `.env*.local`, `node_modules`, `.venv`, `venv`, `vendor`, `Pods`

Skip regenerable or runtime junk even if ignored: `target`, `.next`, `dist`, `build`, `.turbo`, `.cache`, `coverage`, `*.pid`, `*.sock`, `.scratch`.

Choose the paths based on the project's setup and runtime needs, without a separate user confirmation, and bake the list into the creation script. Do not re-discover at every workspace creation.
