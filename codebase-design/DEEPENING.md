# Deepening shallow modules

Use this workflow when behaviour is fragmented across modules and callers must repeatedly coordinate it. The goal is one coherent interface that hides shared rules and orchestration, not fewer files for its own sake.

## 1. Establish the candidate

Inspect callers, current tests, and dependencies. Identify:

- knowledge or ordering duplicated across callers;
- pass-through modules that add no policy;
- behaviour that changes together;
- capabilities that callers genuinely need to retain.

Do not merge modules merely because they are small. Deepening is justified when it improves leverage or locality.

## 2. Classify dependencies

The dependency category guides seam and test strategy:

### In-process

Pure computation or in-memory state. Keep it inside the deepened module and test through the module's interface. No adapter is needed unless behaviour genuinely varies.

### Local-substitutable

Infrastructure with a faithful local implementation, such as PGLite or an in-memory filesystem. Prefer exercising that implementation in tests. Keep the seam internal unless callers need to select it.

### Remote but owned

A service controlled by the same organization across an HTTP, RPC, or queue boundary. Put a port at the network seam when transport or deployment varies. Use a production transport adapter and a lightweight test adapter while keeping business orchestration in the owning module.

### True external

A third-party system such as Stripe or Twilio. Isolate the external contract behind an injected port when doing so protects the module from SDK churn, enables deterministic tests, or clarifies failure handling. Tests may use a fake or mock adapter appropriate to the behaviour under test.

## 3. Place seams deliberately

Multiple adapters are strong evidence that a seam is useful, but adapter count is not a rule. A single production adapter can still justify a seam when it provides concrete isolation from an external contract, side effect, security boundary, or unstable dependency.

Do not add a seam only for hypothetical future flexibility. Keep test-only and implementation-only seams private rather than expanding the module's external interface.

Side-effecting modules are valid. Make their inputs, observable outcomes, idempotency, and failure modes explicit instead of hiding effects behind unobservable mutation.

## 4. Design the deeper interface

Move shared policy and ordering behind the seam. Reduce methods and parameters where that makes the common operation coherent, but retain distinctions callers need for correctness.

Document the full caller contract:

- invariants and valid transitions;
- ordering or concurrency guarantees;
- errors and retry semantics;
- configuration and meaningful performance constraints.

## 5. Replace implementation-coupled tests

Test supported behaviour through the new interface and assert observable outcomes. Remove old tests only when they duplicate that coverage or exist solely to preserve the former internal structure.

Retain focused tests that protect distinct algorithms, adapter contracts, safety properties, or failure recovery. A behaviour-preserving internal refactor should not force interface-level tests to change.

## Deliverable

Present:

1. the complexity currently leaking to callers;
2. the proposed interface and seam;
3. dependency and adapter choices with their concrete justification;
4. the test surface;
5. trade-offs and a clear recommendation.
