---
name: write-good-test
description: Read this skill when writing tests, including adding, modifying, or extending tests and assertions, and writing tests alongside feature implementation.
---

# Write Good Tests

Good tests fail when functionality breaks and continue to pass when only the internal implementation changes. Apply the following standards without announcing this skill or adding a report about test design.

## Write only behavioral tests; select coverage by risk

Behavioral tests verify functional outcomes of operations: a record is deleted, invalid input is rejected, unauthorized access is denied, or an operation can be retried after failure.

Select behaviors by risk. Prioritize paths and boundaries with high failure impact or a high likelihood of failure, and known bugs. Expected outcomes should come from requirements, public contracts, existing functionality, or known bugs. Do not invent requirements or treat incidental implementation details as contracts. Requirements determine what to implement, not which details each need a test.

Do not write visual or copy tests. Do not assert colors, fonts, spacing, layout, display copy, or exact message wording, including through screenshots, DOM snapshots, or text snapshots. There are no exceptions, even when requirements explicitly specify these details.

For example, if a requirement specifies a red delete button labeled "Delete now," verify that clicking it deletes the target record, not that it is red or displays those words. You may use the button's name to locate and operate it, but do not separately assert what its name must be.

Each test should focus on one behavior and make the precondition, action, and expected outcome clear. Multiple assertions can serve that behavior: "The transfer is rejected" and "The balance is unchanged" together verify a failed transfer.

## Verify through an appropriate public entry point

Use a module's public interface or a user-visible, operable interface. Test private functions indirectly through public entry points, not in isolation.

Choose a scope that reliably verifies the behavior at a reasonable running cost:

- **One module:** Suitable for inputs, outputs, error handling, and boundary conditions; fast and easy to diagnose.
- **Several parts together:** Suitable for verifying real code working together, such as a component displaying validation results after form submission.
- **A complete user flow:** Suitable for behavior that requires the entire path, such as finding an order after placing it. Expensive to run; use only when needed.

## Make assertions detect errors

Check return values, error types, state changes, or functional results in the interface, not merely that code ran. For example, check that input is preserved after submission fails, not the exact wording of the error message.

Expected outcomes must be independent of the implementation under test. For a balance of `100` and an attempted transfer of `120`, directly assert that the transfer is rejected and the balance remains `100`. Do not call the code under test or copy its algorithm to calculate expected values: both implementation and test could be wrong together.

Assertions should fail when the protected behavior breaks. Checks such as "A result exists" or "No exception was thrown" are usually insufficient to establish correctness.

## Stay independent of internal implementation

Test "Insufficient funds cause a transfer to fail," not "The transfer function calls a particular internal method."

When functionality is unchanged, renaming, splitting functions, or rewriting internals should not break tests. Do not treat internal call order, private state, or incidental interface structure as expected outcomes.

## Be clear, stable, and non-redundant

- **Clear:** The name and body reveal the scenario, action, and expected outcome; failures make the broken behavior easy to identify. Use "Rejects transfers with insufficient funds," not just "transfer test."
- **Stable:** Repeated runs of the same code produce the same result. Use controlled inputs for time and randomness; do not depend on execution order or state left by other tests.
- **Non-redundant:** Each added test provides distinct value, such as covering a new boundary, verifying collaboration between parts, or helping diagnose failures. Do not rewrite the same check without adding value, but do not assume a unit test is redundant merely because an end-to-end test covers the behavior.

## Filesystem safety

When tests touch the real filesystem, read and follow the `test-filesystem-safety` skill.
