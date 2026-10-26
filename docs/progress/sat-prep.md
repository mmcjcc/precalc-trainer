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

### Complete SAT Math Skill Map (19 skills across 4 domains; 10 mapped after review)

| Domain (Share) | Skill ID | Skill Title | Mapped Types (`moduleId` / `templateId`s) or Coming |
| --- | --- | --- | --- |
| **Algebra (35%)** | `alg.linear-eq-1v` | Linear equations in one variable | *Coming* |
| **Algebra (35%)** | `alg.linear-functions` | Linear functions | `geoParallel`: `gl3.slopes` |
| **Algebra (35%)** | `alg.linear-eq-2v` | Linear equations in two variables | `geoParallel`: `gl3.slopes` |
| **Algebra (35%)** | `alg.systems-linear` | Systems of two linear equations in two variables | *Coming* |
| **Algebra (35%)** | `alg.linear-inequalities` | Linear inequalities in one or two variables | `inequalities`: `ineq.linear`, `ineq.distribute`, `ineq.fraction`, `ineq.compound` |
| **Advanced Math (35%)** | `adv.equivalent-expressions` | Equivalent expressions | `composition`: `comp.expr`; `quadratics`: `cs.form` |
| **Advanced Math (35%)** | `adv.nonlinear-equations` | Nonlinear equations in one variable and systems of equations in two variables | `polyZeros`: `pz.zeros`; `rationalFns`: `rf.equation` |
| **Advanced Math (35%)** | `adv.nonlinear-functions` | Nonlinear functions (quadratic, exponential, polynomial, rational, radical, absolute value) | `graphFeatures`: `gf.features`; `composition`: `comp.value`; `functionOps`: `ops.table`, `ops.graph`, `ops.formula`; `transformations`: `tr.describe`, `tr.point`, `tr.equation`; `quadratics`: `cs.vertex`; `optimization`: `opt.wall`, `opt.pens`, `opt.numbers`, `opt.revenue` |
| **Problem-Solving and Data Analysis (15%)** | `psda.ratios-rates` | Ratios, rates, proportional relationships and units | `geoRatios`: `gr.proportion` |
| **Problem-Solving and Data Analysis (15%)** | `psda.percentages` | Percentages | *Coming* |
| **Problem-Solving and Data Analysis (15%)** | `psda.one-var-data` | One-variable data (distributions, center and spread) | *Coming* |
| **Problem-Solving and Data Analysis (15%)** | `psda.two-var-data` | Two-variable data (models and scatterplots) | *Coming* |
| **Problem-Solving and Data Analysis (15%)** | `psda.probability` | Probability and conditional probability | *Coming* |
| **Problem-Solving and Data Analysis (15%)** | `psda.inference` | Inference from sample statistics and margin of error | *Coming* |
| **Problem-Solving and Data Analysis (15%)** | `psda.claims` | Evaluating statistical claims (observational studies and experiments) | *Coming* |
| **Geometry and Trigonometry (15%)** | `geo.area-volume` | Area and volume | *Coming* |
| **Geometry and Trigonometry (15%)** | `geo.lines-angles-triangles` | Lines, angles and triangles | `geoSegments`: `gs.addition`, `gs.midpoint`, `gs.coord`; `geoAngles`: `ga.addition`, `ga.bisector`, `ga.pairs`, `ga.words`; `geoParallel`: `gl3.pairs`, `gl3.solve`; `geoPolygonAngles`: `gpa.triangle`, `gpa.polygon`; `geoCongruence`: `gc.solve`; `geoIsosceles`: `gi.solve`; `geoRatios`: `gr.polygons`; `geoSimilarTriangles`: `gt.solve`; `geoProportionalParts`: `gp.splitter`, `gp.bisector` |
| **Geometry and Trigonometry (15%)** | `geo.right-triangles-trig` | Right triangles and trigonometry | `rightTriangle`: `rt.ratios`, `rt.special`, `rt.side`, `rt.angle`; `unitCircle`: `uc.exact`; `geoRightSimilar`: `rs.altitude`; `geoPythagorean`: `py.side`, `py.classify`, `py.apply`; `geoSpecialRight`: `sp.special` |
| **Geometry and Trigonometry (15%)** | `geo.circles` | Circles | `angleMeasure`: `am.convert`, `am.arc` |

## Design decisions for review

1. **Strict template mapping** (tightened in review, see below):
   - `alg.linear-eq-1v` and `alg.systems-linear` remain *Coming*: no template asks for a one-variable linear equation or a 2 × 2 linear system.
   - All six data, statistics and probability skills past ratios, and `geo.area-volume`, are *Coming*.
   - `geo.circles` maps only to `angleMeasure` `am.convert` and `am.arc` (radians, arc length and sector area); circle equations come later.
2. **Weighted domain sampling (`src/pages/review/buildReview.ts`)**:
   - When a review's topics carry weights (the SAT reviews), each domain gets exactly its share of the count: at least 1, the rest by largest remainder (8 → 3 / 3 / 1 / 1, 12 → 4 / 4 / 2 / 2, 22 → 8 / 8 / 3 / 3). Inside a domain, types are drawn by weak spots without repeating a type until the domain's types are used up. Unweighted reviews (`'unit1'`) keep the existing code path untouched.
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

## Review 2026-10-25 (Claude)

- **Skill map tightened (commit 7107ec1):** a type counts only when what it asks is what the SAT skill tests. Dropped from the first map: difference quotients, inverses, log forms and properties, sign charts, exponential and log equations, domain and range, piecewise, even and odd, end behaviour, exponential models, number-line reading, quadrilateral proofs, unit-circle points beyond exact values, inverse trig, and `arc.rate` / `am.convert` as ratios. 10 of 19 skills are mapped.
- **Domain counts made exact:** on the phone an 8-problem set came out Algebra 2, Advanced Math 4, Data 1, Geometry 1, with "A pen against a wall" twice, because the extra slots were drawn at random around the target. Now the counts are fixed by largest remainder and a domain repeats a type only after using all of its types (test over 100 seeds for 8, 12 and 22).
- **Copy:** the header's run-on sentence is split ("About three quarters of the questions are multiple choice and a quarter are typed answers. They cover four content domains: …"); the timer line no longer repeats itself ("35 minutes for 22 problems, as on the test." / "13 minutes for 8 problems, scaled from the test's 35 minutes for 22.").
- **Phone check (store test build, Pixel emulator):** the SAT class on Home with the header, coverage line, practice-set card and four domain cards ("Practiced" / "Not yet" / "Coming"); an 8-problem timed set opens problem 1 with the timer ("0:02 / 13:00 … never stops you"); skipping through reaches "Results by domain" with problems, first-try rate, skipped, time, and "Weakest domain" with its practice button.
- Kept as built: "Start SAT practice set" is outlined on a phone because a phone's Home has one filled action ("Start a set"); timed SAT sets stay out of the mastery bars, as the timed review always has.

## Not done

- **9 of 19 SAT Math skills** are *Coming* and await new content in later phases:
  - Algebra: `Linear equations in one variable`, `Systems of two linear equations in two variables`
  - Problem-Solving and Data Analysis: `Percentages`, `One-variable data`, `Two-variable data`, `Probability and conditional probability`, `Inference from sample statistics and margin of error`, `Evaluating statistical claims`
  - Geometry and Trigonometry: `Area and volume`
- SAT-style multiple-choice and typed-answer items; for now every problem opens in its module's own step flow.
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
