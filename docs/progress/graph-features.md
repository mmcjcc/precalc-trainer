# Reading a graph (`graphFeatures`) — progress log

Scope: one precalculus module, id `graphFeatures`, title "Reading a graph", template `gf.features`.
Answer-only. The graph is the question (shown up front). Six fields: increasing, decreasing, global max,
global min, local max, local min. Nothing committed. `src/engine/functions/**` and `src/engine/index.ts`
are another agent's files and are left untouched.

## Plan

- Curve: piecewise cubic Hermite between turning points, zero end slopes (each piece monotone), quadratic
  tails with zero slope at the outer turns so the ends leave the window. Sampled onto `GraphSpec` (new
  optional `samples` / `markers` / `yDomain`); expression graphs stay on function-plot.
- Shapes: W (two mins, one max, both ends up), M (the mirror), S (one max and one min, ends opposite).
  Quarter-unit coordinates in [-8, 8], labelled.
- Grade intervals with the notation parser (existing typos keep their pattern ids). Point lists accept
  "and" or a comma, or "none". U between points is `gf_union_between_points` and shows the "Which joiner?"
  rule card at hint rung 2.
- Conventions: x-values in the intervals, parentheses at turns, ∞ gets a parenthesis, a reached global
  extremum is also local, no global max/min on a ±∞ end.

## Log

- [done] Shared types (additive): `ModuleId` / `ProblemKind` `'graphFeatures'`; eight `gf_*` ids;
  `GraphSample`, `GraphMarker`, and optional `samples` / `markers` / `yDomain` on `GraphSpec`.
  Catalog entries in `engine/matchers/catalog.ts`. `AttemptFinal.gfEntries` for the six boxes.
- [done] Content `src/content/modules/graphFeatures/**`: Hermite + quadratic tails, seeded `gf.features`
  (order 1.5, right after the number line, no subject), grader, rule cards including "Which joiner?".
  Registered from `content/modules/index.ts`. Calc panels empty.
- [done] `SampledGraph` draws the polyline and coordinate labels. `GraphPanel` uses it only when
  `samples` is set. `GraphFeaturesFlow` shows the graph in the statement; `ProblemFrame` does not put
  this kind behind the reveal gate. Wired in `Problem.tsx`.
- [done] Tests: 300 seeds (deterministic, exact turns, monotone drawn curve, tails off the window,
  canonical answers grade correct); every `gf_*` id on a realistic wrong answer and never on the right
  one; notation typos still fire; jsdom flow rebuilds her worksheet and accepts everything except
  `(-2.5, -5.5) U (7.25, -9.25)`, then the "and" version finishes. Rung 2 is "Which joiner?".
- Worksheet instance is `worksheetInstance()` (y = -9.25 sits just outside the random [-8, 8] box),
  not a URL seed. Hand-check `#/p/graphFeatures/gf.features/7` (a W), `/1` (an M), `/2` (an S).
- App typecheck and the node config typecheck passed. The full Vitest suite's only failures were in
  `src/engine/functions/property.test.ts` (the other agent's folder). Not touched.
