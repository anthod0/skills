# Code Standards

## Call Paths and Responsibilities

Trace the business flow from its entry point through data sources, processing, and outputs. Distinguish dedicated modules from shared modules based on their actual callers.

- **Dedicated modules and functions:** Implement the specific workflow and known callers' needs. Do not add parameters, configuration, or defensive branches for hypothetical calling patterns.
- **Shared modules and functions:** Derive a common contract from existing callers rather than broadening the interface to accept arbitrary input.

Follow **YAGNI (You Aren't Gonna Need It)**: implement current business needs without introducing general-purpose abstractions for hypothetical reuse.

## Design by Contract

Define the preconditions callers must satisfy and the postconditions callees guarantee. Give each guarantee a clear owner and establish it at the responsible layer.

Internal calls rely on established contracts. Remove repeated null checks, type checks, parsing, and fallback branches for conditions already guaranteed upstream. Dedicated functions operate directly on business data rather than accepting and validating raw input again.

## Boundary Validation

Perform necessary validation and conversion at the trust boundaries of business inputs and outputs. Internal calls use the resulting data directly instead of repeating validation at every layer.

Apply **Parse, don't validate**: parse raw input into types or structures that express business constraints, carrying established guarantees downstream instead of making downstream code repeatedly inspect raw values.

## Fail Fast and Exception Propagation

Let exceptions propagate by default. Catch an exception only when the current layer can actually recover or has an explicit responsibility to translate errors at a boundary.

Remove `try/catch` blocks that merely rethrow the same exception and duplicate error logging in intermediate layers. Use `finally` or the language's resource-management facilities for cleanup rather than adding layers of exception handling.

Expose programming errors directly. Do not hide failures behind broad catches, silent suppression, default values, empty collections, or results that pretend the operation succeeded. Recovery strategies must come from actual business requirements, not a desire to keep the program from reporting errors.
