# Compare alternative interfaces

Use this workflow only when an interface is consequential: it has several callers, encodes difficult invariants, crosses an expensive seam, or would be costly to reverse. For a local or obvious change, design one interface directly.

## 1. Frame the decision

State briefly:

- callers and use cases;
- invariants and failure modes every design must preserve;
- dependencies and their category from [DEEPENING.md](DEEPENING.md);
- what should remain hidden behind the seam;
- the decision criteria and any hard constraints.

A small code sketch may clarify constraints, but do not let the existing interface predetermine every alternative.

## 2. Generate meaningful alternatives

Produce two or three interfaces with materially different trade-offs. Choose contrasts relevant to the problem, such as:

- minimal surface and high leverage;
- simplest common-case call;
- explicit control for advanced callers;
- command-oriented versus declarative input;
- a port located at a different real seam.

Do not manufacture alternatives by renaming methods or rearranging equivalent parameters. Stop once additional designs no longer expose a new trade-off.

For each design, show only what is needed to evaluate it:

1. interface, including invariants, ordering, and error semantics;
2. one representative usage example;
3. complexity hidden by the implementation;
4. dependency and adapter strategy;
5. strongest advantage and principal cost.

## 3. Compare and decide

Compare the alternatives by:

- **Depth** — capability relative to caller knowledge;
- **Locality** — where rules and future changes concentrate;
- **Seam placement** — whether variation is isolated at the right location;
- compatibility with repository vocabulary and constraints.

Recommend one design and explain why it best fits the actual callers. Propose a hybrid only when the combination remains coherent and does not enlarge the interface without corresponding leverage.

## Stop conditions

Finish when:

- the recommendation satisfies every hard constraint;
- rejected alternatives have a concrete disadvantage, not merely a preference;
- another alternative would repeat an explored trade-off;
- the remaining uncertainty requires a prototype or domain clarification rather than more interface sketches.
