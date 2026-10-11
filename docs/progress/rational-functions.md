# Rational functions (precalculus Unit 2)

New module `rationalFns`, "Rational functions", listed in course `precalc` / unit `unit2` after `polyZeros`. Three seeded templates. The arithmetic lives in `src/content/modules/rationalFns/` (exact rationals, no float comparisons). Nothing under `src/engine/` was edited except the `rf_` catalog entries. Changes are uncommitted.

## What shipped

- `rf.features`: domain, vertical asymptotes, holes, horizontal or slant asymptote, x-intercepts, and y-intercept, one part at a time. About half the seeds have a hole. This template never asks for a numerator two or more degrees higher than the denominator.
- `rf.asymptote`: the horizontal or slant asymptote only. Bottom-heavy is `y = 0`, equal degrees are the ratio of the leading coefficients, and a numerator one degree higher is the quotient of the division.
- `rf.equation`: a rational equation. On most seeds one candidate makes a denominator 0 and is left out. "no solution" is possible.

The sentence above the work states the problem only. Each seed promises a trap where one is possible, and the build checks its own answers. The graph (dashed asymptotes, an open dot at a hole) is drawn only after she finishes. Her entries are stored on `polyEntries` / `polyStage` and survive a reload. Hints are the shared three-rung ladder; the last rung marks the answer as shown.

## Checks

`npm run typecheck` (all three configs), the full Vitest suite (126 files, 2086 tests), and `vite build` passed. Screens were exercised in jsdom (a named mistake, then the fix, an unreadable answer, a reload, and the graph only at the end). The function-plot canvas was not opened in a browser.
