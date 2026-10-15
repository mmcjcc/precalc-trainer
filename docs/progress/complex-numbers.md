# Complex numbers (precalculus Unit 2)

New module `complexNums`, title "Complex numbers", listed in course `precalc` / unit `unit2` after `signCharts`. Five seeded templates. The arithmetic lives in `src/content/modules/complexNums/` (exact rationals, optional square-free radical, no float comparisons). Nothing under `src/engine/` was edited except the `cx_` catalog entries. Changes are uncommitted.

## What shipped

- `cx.arith`: add, subtract or multiply two complex numbers in a + bi form. Multiply seeds promise `cx_i_squared_positive` or `cx_foil_dropped`.
- `cx.divide`: divide by a complex number (multiply by the conjugate) and write a + bi with exact fractions.
- `cx.powers`: powers of i (including a few negative exponents) and square roots of negatives, including a product √(−a)·√(−b).
- `cx.quadratic`: a quadratic with a negative discriminant; both solutions, including `2 +- 3i`.
- `cx.zeros`: a real polynomial and one given complex zero; the conjugate is a zero too, then divide out.

The sentence above the work states the problem only. Each seed promises a trap where one is possible, and the build checks its own answers. Her entries are stored on `polyEntries` / `polyStage` and survive a reload. Hints are the shared three-rung ladder; the last rung marks the answer as shown. The symbol strip offers i, √, and ±.

## Checks

`npm run typecheck` (all three configs) passed. Full Vitest suite: 138 files, 2193 tests, all green. `vite build` passed.

Seed-1 URLs (each shows the named trap):
- `#/p/complexNums/cx.arith/1` — `cx_foil_dropped` on `(-5 - 6i)(-2 + 6i)`
- `#/p/complexNums/cx.divide/1` — `cx_conjugate_wrong` on `(-2 + 5i)/(-6 + 2i)`
- `#/p/complexNums/cx.powers/1` — `cx_sqrt_product` on `sqrt(-12) * sqrt(-12)`
- `#/p/complexNums/cx.quadratic/1` — `cx_discriminant_sign` on `2x^2 + 2x + 1 = 0`
- `#/p/complexNums/cx.zeros/1` — `cx_conjugate_missing` on `x^3 + 5x^2 - 4x - 60` with given zero `-4 + 2i`
