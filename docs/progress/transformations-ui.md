# Transformations screens (step 2)

Screens and templates on the transformations engine core. Nothing under `src/engine/` was edited except new catalog entries in `src/engine/matchers/catalog.ts`.

## What shipped

- Module `transformations` (order 1.75), templates `tr.describe`, `tr.point`, `tr.equation`.
- Module `piecewiseRate` (order 1.8), templates `pw.evaluate`, `arc.rate`. Both are precalculus (no subject).
- Every `TransformMistakeKind` is an `ErrorPatternId`: `tr_` + kind for the transformation kinds, `pw_` + kind for the piecewise kinds, and the rate kinds keep their `rate_` names (they already carry that prefix).
- Answer-only flows, hints on three rungs, witness shown, attempts recorded the way the other answer-only flows record them. Description checks record each distinct named step.
- Module 1 graphs f in gray and g in coral behind the reveal gate. Key points are listed under the graph. Reciprocal curves are split at the vertical asymptote (`fBreaks` / `extra.breaks`) so the two branches are separate polylines; function-plot's own sampler only splits when it notices a slope change, and a custom `fn` that returns NaN at the pole is easy for that heuristic to miss.
- Module 2 has no graph and no calculator panel.

## Core left as-is

No failing core case turned up. Point questions skip key points whose mistake candidates have `shadows`. A pure `a = −1`, `b = 1` reflection makes "flip the other coordinate" the same point as swapping a and b, so those point problems use `|a| = 2` or `3` instead of leaving every key point shadowed.
