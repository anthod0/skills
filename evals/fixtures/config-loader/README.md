# Dispatch configuration

Dispatch loads configuration for a batch-job launcher.

## Why retries are bounded

The delivery partner permits at most five retries per job under our integration agreement. Jobs without idempotency keys need a way to disable retries to avoid duplicate deliveries. The partner's operations team approves changes to this policy.

## Implementation notes

`parseConfig` calls `JSON.parse`, assigns `input.retries ?? 3` to a local variable, and uses `Number.isInteger` plus two comparisons to validate the result. It creates an object with `endpoint` before `retries`. `loadConfig` calls `homedir`, joins four path components, calls `readFile` with `utf8`, and passes the result to `parseConfig`.

The default retry count is 3. The minimum is 0. The maximum is 5. The return object has `endpoint` and `retries` fields.

## Development log

We first wired up a parser, then added validation, then made zero retries work. Finally, we added tests and completed the implementation. The earlier retry wizard proposal was dropped. There is no retry wizard anymore.

## Summary

This module loads Dispatch configuration. In summary, it provides configuration loading for Dispatch.

## Development

Requires Node.js 22 or later; there are no third-party dependencies. Run the parser tests with `node --test tests/config.test.mjs`.

See [the launcher contract](CONTRACT.md) for compatibility requirements.
