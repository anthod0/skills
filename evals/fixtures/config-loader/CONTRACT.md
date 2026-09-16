# Dispatch configuration contract

This module is consumed by the Dispatch launcher. Its public exports are `parseConfig` and `loadConfig`.

- `parseConfig(text)` accepts JSON containing an `endpoint` string and optional `retries`.
- It returns the supplied endpoint and a retry count. Object property enumeration order is not contractual.
- Omitted or null retries use 3. Integer values from 0 through 5 are valid, including both endpoints. Zero disables retries.
- Other retry values throw an error whose message is exactly `E_RETRY_RANGE`. The launcher uses that token to select a localized help message.
- Malformed JSON throws a `SyntaxError`.
- `loadConfig()` reads UTF-8 JSON from the current user's `.config/dispatch/config.json` and parses it using the same contract. File read errors propagate to the caller.
