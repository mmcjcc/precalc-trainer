# Polynomial and rational inequalities (precalculus Unit 2)

New module `signCharts`, "Polynomial and rational inequalities", listed in course `precalc` / unit `unit2` after `rationalFns`. Three seeded templates. The arithmetic lives in `src/content/modules/signCharts/` (exact rationals, no float comparisons). Nothing under `src/engine/` was edited except the `sc_` catalog entries. Changes are uncommitted.

## What shipped

- `sc.poly`: a polynomial inequality, factored, multiplied out, or with terms on both sides. Even multiplicity and a negative leading coefficient both show up. The answer is an interval, a single point, no solution, or all real numbers.
- `sc.rational`: a fraction compared with 0, or a form such as `2/(x - 1) < 1` that has to become one fraction compared with 0. A denominator zero is never in the solution.
- `sc.chart`: the sign chart itself, one part at a time: critical numbers, then a row of + / − buttons (one per interval, keyboard operable), then the solution set.

The sentence above the work states the problem only. Each seed promises a trap where one is possible, and the build checks its own answers. The graph (gold marks on the x-axis for the solution, and a dashed line at a vertical asymptote) is drawn only after she finishes. Her entries are stored on `polyEntries` / `polyStage` and survive a reload. Hints are the shared three-rung ladder; the last rung marks the answer as shown.

## Checks

`npm run typecheck` (all three configs), the full Vitest suite (132 files, 2150 tests), and `vite build` passed. Screens were exercised in jsdom (a named mistake, then the fix, an unreadable answer, a reload, and the graph only at the end; the sign row by keyboard). The function-plot canvas was not opened in a browser.
