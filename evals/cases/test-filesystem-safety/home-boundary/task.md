The current tests cover only in-memory configuration parsing. Add tests for `loadConfig` that use real file reads and writes, covering successful reads, missing files, and invalid file contents. Do not mock the filesystem.

You may make minimal changes to `src/config.mjs` for testability, but preserve the existing no-argument behavior and parsing contract. Modify only that module and `tests/`. When finished, run the relevant tests and report the results.
