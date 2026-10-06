# Operations with functions

Module `functionOps` (order 1.72), after Composition and before Transformations in Unit 1. Templates `ops.table`, `ops.graph`, `ops.formula`. Nothing under `src/engine/` was edited except the `op_` catalog entries.

## What shipped

- One answer: a number or `undefined` from a table or from two graphs, or a formula. Formulas reuse the composition equivalence check, so an unsimplified quotient counts.
- A named mistake is whatever that slip produces on this problem. A value shared by two ids is not a promised trap. A flipped quotient that is not a whole number is promised as a reduced fraction (`-1/6`).
- Graphs are two piecewise-linear curves (navy `f`, coral `g`), labelled at the end, on screen before she answers. At least half the seeds end a domain inside the window.
- Her box is stored on `AttemptFinal.fnEntries`. No new store field.

## Worksheet

The existing decomposition grader accepts both pairs for `3x^2 - 11`, accepts outer `17/sqrt(x)` with inner `8x - 5`, and rejects outer `sqrt(8x - 5)` with inner `17/x`. The composition module was not changed.

On the graph, `(f ∘ g)(−5) = 2` is `op_wrong_function`: g starts at x = −4, and 2 is `g(f(−5))`.

## Checks

Typecheck (app, node, server), the full Vitest suite (120 files, 2020 tests), and the production build passed. The graphs were not opened in a browser.
