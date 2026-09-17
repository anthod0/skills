# ssh-hosts

A small CLI for the SSH aliases you keep forgetting. Add a machine, change its port, or retire an old host without reformatting the rest of `~/.ssh/config`.

```sh
ssh-hosts add devbox --host 10.8.0.14 --user deploy --port 2222
ssh-hosts list
ssh devbox

ssh-hosts set devbox --identity '~/.ssh/work_ed25519'
ssh-hosts rename devbox staging
ssh-hosts remove staging
```

## Install from source

Requires Node.js 22+ and Bun for dependency management.

```sh
bun install --frozen-lockfile
bun run build
npm link
```

To try it on a separate file instead of your SSH config:

```sh
demo=$(mktemp)
cp examples/config "$demo"
bun run dev --config "$demo" list
bun run dev --config "$demo" set nas --user alex
```

Quote identity paths containing spaces or `~`; the path is stored for SSH to interpret, not expanded by this tool.

## Working with existing configs

Comments, forwarding rules, and options outside the edited fields are left alone. New entries go before wildcard defaults because SSH uses the first value it finds. `list` shows values written in single-alias blocks, not the effective settings from `ssh -G`.

Editing is deliberately limited to ordinary single-alias `Host` blocks. Files containing `Include`, `Match`, or quoted/escaped Host patterns need manual editing. Repeated aliases, multi-alias targets, and repeated options being changed are also refused rather than guessed at. Wildcard blocks remain untouched.

Writes replace the file atomically and preserve its permission bits; new configs use `0600`. Symlinked and hard-linked configs are refused: use `--config` to select the actual file in your dotfiles checkout. Avoid simultaneous edits from another process; there is no file locking. Removal deletes the selected host block, including its connection options.

## Development

```sh
bun run dev list
bun run typecheck
bun run test
```

Tests use Node's built-in test runner with tsx and cover configuration parsing and editing. The tool stores identity paths but never opens keys or connects to a host.
