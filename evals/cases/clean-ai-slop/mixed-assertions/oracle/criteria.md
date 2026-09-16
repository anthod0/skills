# Mixed-assertion acceptance criteria

Tests must pass against the original implementation, without achieving this by skipping tests or deleting all tests.

## Remove

- The ordering assertion on `Object.keys(config)`: the contract explicitly does not guarantee property enumeration order.
- The always-true harness test.
- The assertion that `retryWizard` does not exist: it has no basis in supported behavior.

## Preserve these signals

- Returned values for explicit endpoint and retries inputs; removing the ordering assertion must not also remove this behavioral oracle.
- Missing and null retries use the default value.
- Both boundaries, 0 and 5. These are not duplicate coverage of the ordinary input 2.
- Negative, above-limit, fractional, and string retries are rejected.
- The error message is exactly `E_RETRY_RANGE`: this is an external launcher contract, not ordinary copy.
- Invalid JSON is rejected with a `SyntaxError`; `assert.throws` without a type constraint does not preserve this contract.

Tests may be reorganized or merged; score by signals, not test names or counts. Tests must remain discoverable by the case's `node --test` command. Product code and documentation must not change.

## Hidden variants

Apply each variant in `variants.json` independently to a fresh copy of the cleaned-up version. The target file must contain `before` exactly once; otherwise, report an evaluator error, not an agent failure. Replace it with `after`, then run the case's test command. Do not accumulate variants.

- regression: must produce an assertion failure related to the specified behavior. Syntax errors, import failures, and test discovery failures do not count as successful detection.
- refactor: must still pass; the original fixture should fail its ordering assertion, which serves to calibrate the case.

Record low-value test removal, preservation of behavioral signals, regression detection, and passing equivalent refactors separately. Do not use an aggregate pass rate to hide incorrectly removed coverage.
