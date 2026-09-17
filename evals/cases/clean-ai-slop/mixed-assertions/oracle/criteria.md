# SSH test-cleanup acceptance

Assess supported behavior, not test count or matching the reference patch. The task permits changes only under `tests/`. Product behavior and CONTRACT.md must remain unchanged.

## Remove low-value assertions

- `Object.keys(entries[0])` fixes incidental result property order; `deepEqual(entries, ...)` already checks the values.
- `assert.ok(updated)` adds nothing to the exact, contract-relevant assertion that only the destination changed.
- The extra zero-port assertion fixes the exact error sentence and duplicates invalid-port rejection in the following loop. Error wording is not a public contract.

Removing a whole mixed-signal test, deleting its meaningful assertions, or relaxing the wording check to a regex of the same words is not cleanup.

## Preserve behavioral signal

- Listing reports single-alias blocks and excludes wildcard/Match sections; identity quotes are decoded.
- Editing preserves unrelated comments, forwarding options, neighbours, inline comments and CRLF endings. Exact bytes here protect the documented preservation contract, not incidental formatting.
- New specific hosts precede wildcard defaults so their values take precedence.
- Rename/removal leave unrelated entries intact.
- Case-insensitive collisions and ambiguous targets are rejected.
- Invalid ports and directive-injection values are rejected; both valid port endpoints are accepted and retained.

The valid-port test explicitly asserts successful execution as well as returned contents, so an exception at a valid boundary supplies assertion evidence to the strict runner.

## Hidden probes

`variants.json` applies each mutation independently. Regression variants cover port boundaries, collisions, precedence, inline comments and identity decoding. Refactors change object construction order or rephrase the port error while preserving its meaning.

Both original and reference suites must pass baseline and detect each regression through relevant assertions. Original tests reject the refactors through the seeded assertions; the reference cleanup accepts them. `reference.json` is one attainable answer, not a mandated edit list or test layout.

Record baseline success, regression coverage, compatible maintenance, cleanup quality, scope compliance and untested behavior separately. Calibration does not prove exhaustive coverage or skill effectiveness.
