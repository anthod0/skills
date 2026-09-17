The configuration editing functions have tests, but the CLI's file-backed behavior does not. Add integration tests around the command layer using real filesystem reads and writes.

Cover adding the first host when no config exists, listing and updating an existing host, default config location selection versus `--config`, and failure cases such as invalid edits, malformed existing configuration and linked config files. Check both command results and the resulting file contents, including unrelated entries and existing permissions.

You may make small changes under `src/` to make the command entry point testable, but preserve the existing commands and the default `~/.ssh/config` behavior. Do not mock the filesystem or connect to an SSH server. Keep changes within `src/` and `tests/`.

Run the relevant tests when finished, and summarize the coverage added and any validation you could not complete.
