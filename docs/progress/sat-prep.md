# SAT Math Prep — Phase 1 Progress Log

## Why

The Digital SAT Math section tests four College Board content domains across 19 skills, weighted 35% Algebra, 35% Advanced Math, 15% Problem-Solving and Data Analysis, and 15% Geometry and Trigonometry. Many of the skills in those domains are already taught and practiced in our existing Honors Precalculus and Honors Geometry modules. Phase 1 surfaces a dedicated **"SAT Math Prep"** class (`id: 'sat'`) backed by a strict skill map (`src/content/sat/skills.ts`) and built on the existing review machinery (`src/content/reviews.ts`, `src/pages/review/buildReview.ts`, `src/pages/Review.tsx`), giving her honest domain-weighted SAT practice sets and per-domain practice without touching any existing math or chemistry module files or predicting a score.

## What she gets

1. **The College Board SAT Math Skill Map (`src/content/sat/skills.ts`)**:
   - The four official SAT Math domains with their test weights (`Algebra` 35%, `Advanced Math` 35%, `Problem-Solving and Data Analysis` 15%, `Geometry and Trigonometry` 15%) and all 19 official skills.
   - Strict mapping to existing math templates in curriculum order (`ModuleDef.order` ascending), or `[]` (`"Coming"`) where no registered math template genuinely tests the skill.
   - Honest coverage: **9 of 19 skills mapped** across all 4 domains (Algebra 2/5, Advanced Math 3/3, Problem-Solving and Data Analysis 1/7, Geometry and Trigonometry 3/4).
2. **New class `"SAT Math Prep"` (`src/content/courses.ts`)**:
   - Present in both the family web app and the Store edition (`STORE`), never pulling any Chemistry module or template.
   - Four domain units (`sat-algebra`, `sat-advanced-math`, `sat-data-analysis`, `sat-geometry-trig`) with `moduleIds: []`.
   - Every place that reads classes and units handles a class whose units have `moduleIds: []` cleanly (Home class tabs and unit switcher, `unitPath` / `setStart`, `classTypes` / `buildSet`, daily quests without offering `"Practice the next stop on your path"`, Progress, Store Welcome picker, and persisted `settings.courseId` / `settings.unitByCourse`).
3. **Home with `"SAT Math Prep"` selected (`src/pages/Home.tsx`)**:
   - Short two-sentence header explaining the SAT Math section, the four domains and their test shares, and honest coverage (`"9 of 19 skills so far; more are coming"`), with no score prediction.
   - Above the domain cards, **"SAT practice set"**: 8, 12, or 22 problems drawn from all four domains weighted 35 / 35 / 15 / 15 (at least one problem from each domain that has a mapped type), with an optional scaled non-blocking timer.
   - One card per domain showing its test share, all of its skills marked **"Practiced"**, **"Not yet"**, or **"Coming"** from her event log, and **"Practice \<domain\>"** (an 8-problem practice set from that domain's mapped types).
4. **SAT Review sets & domain summary (`src/content/reviews.ts`, `src/pages/review/buildReview.ts`, `src/pages/review/session.ts`, `src/pages/Review.tsx`)**:
   - Reviews `'sat'`, `'sat-algebra'`, `'sat-advanced-math'`, `'sat-data-analysis'`, and `'sat-geometry-trig'` generated directly from the skill map (`REVIEWS` still has `['unit1']` unchanged).
   - Optional timer on `'sat'` (35 minutes for 22 problems, 19 minutes for 12, 13 minutes for 8) that shows elapsed/target time in `role="timer"` and never stops her.
   - End-of-set domain breakdown on `'sat'` showing problems, first-try rate, and time per domain, naming the weakest domain with a button to practice it (`/review/sat-<domain>`).

### Complete SAT Math Skill Map (19 skills across 4 domains)

| Domain (Share) | Skill ID | Skill Title | Mapped Types (`moduleId` / `templateId`s) or Coming |
| --- | --- | --- | --- |
| **Algebra (35%)** | `alg.linear-eq-1v` | Linear equations in one variable | *Coming* (`[]`) |
| **Algebra (35%)** | `alg.linear-functions` | Linear functions | `piecewiseRate`: `arc.rate`; `inverses`: `inv.linear`; `diffQuotient`: `dq.linear` |
| **Algebra (35%)** | `alg.linear-eq-2v` | Linear equations in two variables | *Coming* (`[]`) |
| **Algebra (35%)** | `alg.systems-linear` | Systems of two linear equations in two variables | *Coming* (`[]`) |
| **Algebra (35%)** | `alg.linear-inequalities` | Linear inequalities in one or two variables | `numberLine`: `nl.read`; `inequalities`: `ineq.linear`, `ineq.distribute`, `ineq.fraction`, `ineq.compound` |
| **Advanced Math (35%)** | `adv.equivalent-expressions` | Equivalent expressions | `composition`: `comp.expr`, `comp.decompose`; `diffQuotient`: `dq.quadratic`, `dq.rational`, `dq.radical`; `quadratics`: `cs.form`; `polyDivision`: `sd.table`, `sd.value`, `sd.factor`; `logForms`: `lf.value`, `lf.convert`, `lf.decimal`; `logProperties`: `lp.expand`, `lp.condense` |
| **Advanced Math (35%)** | `adv.nonlinear-equations` | Nonlinear equations in one variable and systems of equations in two variables | `inverses`: `inv.cbrt-shift`, `inv.frac-linear`, `inv.rational`, `inv.mobius`; `polyDivision`: `sd.factor`; `polyZeros`: `pz.zeros`, `pz.rational`; `signCharts`: `sc.poly`, `sc.rational`, `sc.chart`; `expLogEquations`: `ee.exponential`, `ee.logarithmic`, `ee.quadratic` |
| **Advanced Math (35%)** | `adv.nonlinear-functions` | Nonlinear functions (quadratic, exponential, polynomial, rational, radical, absolute value) | `graphFeatures`: `gf.features`; `domainRange`: `dr.domain`, `dr.range`; `composition`: `comp.expr`, `comp.value`, `comp.domain`, `comp.decompose`; `functionOps`: `ops.table`, `ops.graph`, `ops.formula`; `transformations`: `tr.describe`, `tr.point`, `tr.equation`; `piecewiseRate`: `pw.evaluate`, `pw.graph`, `pw.domain`, `pw.continuous`, `pw.write`, `arc.rate`; `evenOdd`: `evenOdd.poly`, `evenOdd.special`; `inverses`: `inv.cbrt-shift`, `inv.frac-linear`, `inv.rational`, `inv.mobius`, `inv.quadratic-not`; `quadratics`: `cs.form`, `cs.vertex`; `optimization`: `opt.wall`, `opt.pens`, `opt.numbers`, `opt.revenue`; `polyDivision`: `sd.value`; `polyZeros`: `pz.zeros`, `pz.end`, `pz.build`, `pz.rational`; `rationalFns`: `rf.features`, `rf.asymptote`, `rf.equation`; `expLogGraphs`: `eg.features`, `eg.match`, `eg.inverse`; `expModels`: `em.interest`, `em.halflife`, `em.growth` |
| **Problem-Solving and Data Analysis (15%)** | `psda.ratios-rates` | Ratios, rates, proportional relationships and units | `piecewiseRate`: `arc.rate`; `angleMeasure`: `am.convert`; `geoRatios`: `gr.proportion`, `gr.polygons` |
| **Problem-Solving and Data Analysis (15%)** | `psda.percentages` | Percentages | *Coming* (`[]`) |
| **Problem-Solving and Data Analysis (15%)** | `psda.one-var-data` | One-variable data (distributions, center and spread) | *Coming* (`[]`) |
| **Problem-Solving and Data Analysis (15%)** | `psda.two-var-data` | Two-variable data (models and scatterplots) | *Coming* (`[]`) |
| **Problem-Solving and Data Analysis (15%)** | `psda.probability` | Probability and conditional probability | *Coming* (`[]`) |
| **Problem-Solving and Data Analysis (15%)** | `psda.inference` | Inference from sample statistics and margin of error | *Coming* (`[]`) |
| **Problem-Solving and Data Analysis (15%)** | `psda.claims` | Evaluating statistical claims (observational studies and experiments) | *Coming* (`[]`) |
| **Geometry and Trigonometry (15%)** | `geo.area-volume` | Area and volume | *Coming* (`[]`) |
| **Geometry and Trigonometry (15%)** | `geo.lines-angles-triangles` | Lines, angles and triangles | `geoSegments`: `gs.addition`, `gs.midpoint`, `gs.coord`; `geoAngles`: `ga.addition`, `ga.bisector`, `ga.pairs`, `ga.words`; `geoParallel`: `gl3.pairs`, `gl3.solve`, `gl3.converse`, `gl3.slopes`; `geoPolygonAngles`: `gpa.triangle`, `gpa.polygon`; `geoCongruence`: `gc.parts`, `gc.which`, `gc.solve`; `geoIsosceles`: `gi.solve`; `geoParallelograms`: `gq.props`, `gq.prove`, `gq.coords`; `geoSpecialQuads`: `gs.props`, `gs.classify`; `geoTrapezoids`: `gz.midseg`, `gz.isosceles`; `geoRatios`: `gr.polygons`; `geoSimilarTriangles`: `gt.prove`, `gt.solve`; `geoProportionalParts`: `gp.splitter`, `gp.bisector` |
| **Geometry and Trigonometry (15%)** | `geo.right-triangles-trig` | Right triangles and trigonometry | `rightTriangle`: `rt.ratios`, `rt.special`, `rt.side`, `rt.angle`; `unitCircle`: `uc.exact`, `uc.point`, `uc.given`, `uc.solve`; `inverseTrig`: `it.evaluate`, `it.compose`; `geoRightSimilar`: `rs.mean`, `rs.altitude`; `geoPythagorean`: `py.side`, `py.classify`, `py.apply`; `geoSpecialRight`: `sp.special` |
| **Geometry and Trigonometry (15%)** | `geo.circles` | Circles | `angleMeasure`: `am.convert`, `am.coterminal`, `am.reference`, `am.arc`; `unitCircle`: `uc.exact`, `uc.point` |

## Design decisions for review

1. **Strict template mapping**:
   - `alg.linear-eq-1v`, `alg.linear-eq-2v`, and `alg.systems-linear` remain `[]` (*Coming*) because we do not yet have standalone one-variable linear equation, standard-form two-variable linear equation, or $2 \times 2$ linear systems templates.
   - All six data/statistics/probability skills (`psda.percentages`, `psda.one-var-data`, `psda.two-var-data`, `psda.probability`, `psda.inference`, `psda.claims`) and `geo.area-volume` are marked `[]` (*Coming*).
   - `geo.circles` maps to `angleMeasure` (`am.convert`, `am.coterminal`, `am.reference`, `am.arc`) and `unitCircle` (`uc.exact`, `uc.point`) for radian measure, arc length, sector area, and unit-circle coordinates.
2. **Weighted domain sampling (`src/pages/review/buildReview.ts`)**:
   - When a review has weighted topics with `domainId`s (the mixed `'sat'` review), `buildReviewSet` first guarantees at least 1 problem from each domain that has mapped templates (4 domains), then allocates the remaining `count - 4` problems using residual weights `Math.max(0, count * share - 1)` so the expected total count per domain equals `count * share` (35% / 35% / 15% / 15%). Unweighted reviews (`'unit1'`) continue through the exact existing code path untouched.
3. **Weakest domain tie-breaking (`src/pages/review/session.ts`)**:
   - `weakestSatDomain` ranks attempted domains by lowest average `firstTryRate` first, breaking ties by highest average seconds per problem (`totalSecs / attempted`).
4. **Unit switcher on SAT Math Prep**:
   - Clicking a domain pill in the unit switcher selects that domain unit (persisted in `settings.unitByCourse.sat`) and highlights that domain's card on Home while keeping the full SAT overview and all four domain cards visible.

## Log

- Created `src/content/sat/skills.ts` and `src/content/sat/skills.test.ts` with the 4 domains, 19 skills, curriculum-ordered template refs, and coverage/status helpers.
- Added the `'sat'` course (`title: 'SAT Math Prep'`, `short: 'SAT'`) to `src/content/courses.ts` and updated `src/content/courses.test.ts`.
- Extended `src/content/reviews.ts`, `src/pages/review/buildReview.ts`, `src/pages/review/session.ts`, and `src/pages/Review.tsx` for SAT mixed and per-domain review sets, count picker (`8, 12, 22`), scaled non-blocking timer, and per-domain summary with weakest-domain callout.
- Updated `src/session/buildSet.ts`, `src/components/path/pathModel.ts`, `src/session/quests.ts`, `src/pages/Welcome.tsx`, and `src/pages/Home.tsx` to support classes whose units have `moduleIds: []` and render the SAT Math Prep experience on Home.
- Added and updated colocated tests across `skills.test.ts`, `courses.test.ts`, `buildReview.test.ts`, `Review.test.tsx`, `buildSet.test.ts`, `quests.test.ts`, `UnitPath.test.tsx`, `Welcome.test.tsx`, `Progress.test.tsx`, `StoreEdition.test.tsx`, and `Home.test.tsx`.

## Not done

- **10 of 19 SAT Math skills** are marked `"Coming"` (`[]`) and await dedicated math modules in future phases:
  - Algebra: `Linear equations in one variable`, `Linear equations in two variables`, `Systems of two linear equations in two variables`
  - Problem-Solving and Data Analysis: `Percentages`, `One-variable data`, `Two-variable data`, `Probability and conditional probability`, `Inference from sample statistics and margin of error`, `Evaluating statistical claims`
  - Geometry and Trigonometry: `Area and volume`
- Adaptive two-module routing and score prediction are intentionally excluded.

## Verification

- `npm run typecheck` — passed with 0 errors.
- `npm test` — full Vitest suite passed.
- `npm run build` — production build succeeded.

## Files

- `src/content/sat/skills.ts` (added)
- `src/content/sat/skills.test.ts` (added)
- `src/content/courses.ts` (modified)
- `src/content/courses.test.ts` (modified)
- `src/content/reviews.ts` (modified)
- `src/content/index.ts` (modified)
- `src/pages/review/buildReview.ts` (modified)
- `src/pages/review/buildReview.test.ts` (modified)
- `src/pages/review/session.ts` (modified)
- `src/pages/Review.tsx` (modified)
- `src/pages/Review.test.tsx` (modified)
- `src/session/buildSet.ts` (modified)
- `src/session/buildSet.test.ts` (modified)
- `src/components/path/pathModel.ts` (modified)
- `src/components/path/UnitPath.test.tsx` (modified)
- `src/session/quests.ts` (modified)
- `src/session/quests.test.ts` (modified)
- `src/pages/Welcome.tsx` (modified)
- `src/pages/Welcome.test.tsx` (modified)
- `src/pages/Progress.test.tsx` (modified)
- `src/pages/Home.tsx` (modified)
- `src/pages/Home.test.tsx` (modified)
- `src/components/rewards/StoreEdition.test.tsx` (modified)
- `docs/progress/sat-prep.md` (added)
