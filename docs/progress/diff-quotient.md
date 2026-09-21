# Difference quotient (Precalculus Unit 1, Day 5) — progress log

Scope: module id `diffQuotient`, title "Difference quotient", no subject (groups with Precalculus on Home),
order 5.5 (after the properties drill, before the chemistry modules). One agent, whole slice: engine
additions (variable `h`, x/h sampling, the simplified test, `dq_*` named mistakes), content templates,
`DiffQuotientFlow`, dispatch, tests. Nothing committed; deploy/, docker/, .github/, nginx.conf untouched.

Her homework (f(x) = 5x − 2): f(x+h) = 5(x+h) − 2, then (5x + 5h − 2 − (5x − 2))/h =
(5x + 5h − 2 − 5x + 2)/h = 5h/h = 5. Correct at every line (the minus reached both terms of f(x)).

## Plan (2026-09-21)

Engine (`src/engine/diffQuotient.ts`, exported from `@/engine`):
- `VarName` gains `'h'`; the parser already rejects letters outside `ctx.vars`, so `h` is legal only when a
  problem owns it. Implicit multiplication already splits `xh`, `2hx`, `h(2x+h)`; tests pin that.
- `makeSamples` with `h` among the variables: h never near 0, rows with x + h near 0 dropped, extra rows
  with positive x and x + h (radicals). Only affects variable sets containing `h` (new), so nothing old moves.
- Simplified = equivalent to the DQ on the x/h samples AND defined at h = 0 for every sampled x where the
  DQ is defined for small h (≥ 2 such x). Works for polynomial, rational, radical f.
- Named mistakes by candidate (what the mistake would produce for this f, compared numerically):
  stage 1 (f(x+h)): `dq_fx_plus_h`, `dq_fx_plus_fh`, `dq_partial_sub`, `power_over_sum`, `partial_distribute` /
  `negative_not_distributed` (coefficient of a binomial power missed a piece, polynomial f).
  stage 2 (DQ lines): `dq_set_h_zero`, `dq_forgot_divide`, `dq_partial_cancel`, `negative_not_distributed`
  (minus in front of f(x) missed terms), then the stage-1 slips inside the numerator, then the generic
  matchers of `verifyRewrite`, else the counterexample (nice integer x, h).

Content (`src/content/modules/diffQuotient/`): `dq.linear`, `dq.quadratic`, `dq.rational`, `dq.radical`.
Additive contract changes: `ModuleId 'diffQuotient'`, `ProblemKind 'diffQuotient'`, AnswerSpec
`{ type: 'diffQuotient' }`, `GraphSpec.secant`.

Flow (`src/pages/flows/DiffQuotientFlow.tsx`): attempt step 0 = the f(x+h) line (stage 1), steps 1.. = DQ
lines (stage 2). The stage-2 start line is built from her step 0 with f(x) in parentheses.

## Log
- [done] Shared types (additive): `VarName 'h'`, `ModuleId 'diffQuotient'`, six `dq_*` ErrorPatternIds + catalog
  entries, `GraphSpec.secant`. Content types (additive): `ProblemKind 'diffQuotient'`, AnswerSpec `diffQuotient`.
- [done] Engine `src/engine/diffQuotient.ts` (exported from `@/engine`): `checkFxhLine`, `checkDqLine`, `dqStatus`,
  `definedAtHZero`, `fxhMistake`, `dqMistake`, text helpers. `makeSamples` gains `withStepH` (only for sets with h).
- Fix (engine/math.ts `stripParens`): mathjs `transform` does not descend into a replacement node, so nested
  parentheses survived as ParenthesisNodes; toLatex then fell back to mathjs toTex and printed `\mathrm{h}` (mathjs
  has a Planck constant named h) and `5\cdot x`. Now strips recursively. Whole engine/content suite re-run green.
- Fix (engine/expressions.ts `verifyRewrite`): the matcher wrapper `y = expr` now parses with the lines' own letters,
  so the generic matchers also run on lines with h.
- `pointDisplay` lists h right after x ("x = 1, h = 2").
- [done] Engine tests `src/engine/diffQuotient.test.ts` (66 green).
- [done] Content `src/content/modules/diffQuotient/{text,build,grade,linear,quadratic,rational,radical,index}.ts`.
- [done] Content tests `diffQuotient.test.ts` (21 green): 4 templates × 300 seeds deterministic and well formed,
  canonical path accepted line by line with the canonical chip, only the last line simplified, progress anchors
  and next-step reveals, coverage (a = ±1, missing terms, negatives, shifted forms), knob, her 5x − 2 path.
- Decision: DQ lines are all equivalent to each other, so progress anchors by a commutative SHAPE key (terms and
  factors in any order; only the left operand of +/− flattens, so "− (5x − 2)" ≠ "− 5x + 2"). Chip grading adds
  the canonical tag's chip when her line has a canonical line's shape (classifier says `factor` for combining the
  rational fractions; the tag says `rewrite_fraction`; both accepted).
- Decision: the only knob is `negativeLead` (existing convention, default random): linear, quadratic, rational.
  Harder forms (shifted rational / radical, full quadratics) are mixed in by the seed. No `steps` knob: its
  control shows "Shortest" selected even when the template would randomize.
- [done] UI: `ProblemFrame` hides the calculator panel whenever its steps are empty (graph and calc independent);
  `GraphPanel` → `SecantGraph` (plain SVG sketch) when `graph.secant` is set; `DiffQuotientFlow`; dispatch in
  `Problem.tsx`; example segments parse h. Flow tests (5 green) + Home test.
- Note: KaTeX inside a heading breaks jsdom's accessible-name computation (MathML has no style) → plain-text headings.
- [done] Seeded mistake loops in the content test (quadratic 300 seeds; linear/rational/radical 100 each): every named
  mistake fires on its realistic wrong line for every seed. Secant sketch geometry checked on 20 instances (labels in
  the viewBox, caption parenthesizes a negative f(x)). BUILD_GUIDE §0/§3/§7 mention the module and `h`.
- Seeds for manual checking: her homework f(x) = 5x − 2 is `#/p/diffQuotient/dq.linear/3y` (seed 142);
  3x² + 2x − 1 `#/p/diffQuotient/dq.quadratic/3u0`; −x² + 4x `.../dq.quadratic/2x`; 3/x `.../dq.rational/e`;
  2/(x + 1) `.../dq.rational/2`; √x `.../dq.radical/1`; √(x + 3) `.../dq.radical/s`.
- Radical template done (not skipped).
