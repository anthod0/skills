---
name: test-filesystem-safety
description: Filesystem safety guardrails for writing, reviewing, or running tests that use HOME, user directories, temporary directories, or recursive cleanup.
---

# Test Filesystem Safety

Apply these guardrails before writing, reviewing, or running any test that touches the filesystem.

## Isolate with an explicit test root

Create a unique directory under the operating system's temporary directory using a safe temporary-directory API such as `mkdtemp`. Keep that path in a dedicated, immutable variable such as `testRoot`, and pass derived paths into the code under test through explicit configuration, dependency injection, or a filesystem adapter.

Cleanup may target only that exact test root. Prefer the temporary-directory API's scoped cleanup facility when one exists. Otherwise, before recursive deletion, require all of the following to be true:

- the cleanup target is the exact directory returned by the temporary-directory API;
- it is non-empty and resolves beneath the operating system's temporary directory;
- it is not `/`, the real user home directory, or an ancestor of either;
- cleanup runs in `finally`/`afterEach` without consulting mutable environment variables.

## Hard guardrail: HOME is never a test sandbox

Never assign, export, unset, mock, or otherwise mutate `HOME`, `USERPROFILE`, or the process/global notion of the current user's home directory in order to isolate a test. This includes changing it only for a test command or child process and restoring it afterward.

Never derive a recursive cleanup target from `HOME`, `USERPROFILE`, `os.homedir()`, shell expansion such as `$HOME`, or another mutable environment variable. A typo, failed assignment, leaked process state, or cleanup-order bug can turn that cleanup into deletion of the real user directory.

If production code directly resolves the user's home directory, introduce an injectable home/config/data-directory boundary and test through that boundary using a path beneath `testRoot`. If that boundary cannot be introduced within scope, stop and report the testability blocker; do not emulate a fake home by mutating the environment.

## Review and execution gate

Before running a filesystem-touching test, inspect its setup and teardown. If it mutates the home-directory environment or recursively deletes a path derived from it, do not run it. Replace the pattern with an explicit isolated test root first, or report it as a blocker when modification is outside scope.

A filesystem-touching test is safe to run only when its sandbox path and cleanup target can both be traced to the same temporary-directory API result without passing through mutable global environment state.
