# Precalculus Unit 6, part 2: sum and difference, double and half angles, trig equations

Course `precalc`, unit `unit6` ("Analytic trigonometry"). Part 1 (`trigIdentities`) stays. Part 2 adds two modules on the existing `TrigAnswerFields` shape (stages with label, ask, answerText, nudge, ruleCard, reveal). Branch `trig-advanced` in `C:\work\calc2`. Not committed.

`unit6` module ids are `trigIdentities`, `trigFormulas` (order 5.9985), `trigEquations` (order 5.999).

## What she gets

`trigFormulas`, "Sum, difference, double and half angles":

- `ta.sumdiff`. Exact sin, cos, tan, csc, sec or cot of 15°, 75°, 105°, 165° and the radian twins π/12, 5π/12, 7π/12, 11π/12. Stages: pick the split, pick the expanded formula line, type the exact value in the unit-circle grammar (`√`, `sqrt()`, sums of unlike radicals graded numerically). Named mistakes: `ta_formula_mix` (the sine line used for cosine), `ta_cos_sign` (the middle sign of cos(A ± B) flipped; cosine and secant only), `ta_bad_split` (a split that is not on the unit circle).
- `ta.double`. sin θ or cos θ is a fraction from a primitive Pythagorean triple (3-4-5, 5-12-13, 8-15-17, and further triples), quadrant I–IV, including negatives. Stages: the missing ratio with its sign, then sin 2θ, cos 2θ, tan 2θ. Any numerically equal exact form is accepted. Named mistakes: `ta_quadrant_sign`, `ta_double_linear` (sin 2θ = 2 sin θ), `ta_double_mix` (the squares in cos 2θ swapped).
- `ta.half`. cos θ is a fraction and θ lies on an interval. Stages: which quadrant θ/2 lands in, the sign of the asked function there, the exact value. The asked function is one whose sign in θ's quadrant disagrees with its sign in θ/2's. Named mistakes: `ta_half_sign`, `ta_half_swap` (1 − cos versus 1 + cos).

`trigEquations`, "Solving trigonometric equations", every solution on one full turn:

- `te.linear`. One function, linear in that function (`a sin x + b = c`, and the cosine and tangent twins). Stages: isolate the function (typed equation), the reference angle in radians, every solution (unit-circle solution-list grammar, order does not matter). Named mistakes: `te_one_quadrant`, `te_deg_rad` (the degree number typed where a radian was asked). Moving the constant with the wrong sign reuses the existing id `term_across_sign` ("Moving a term changes its sign"). No new id was minted for that slip.
- `te.factor`. A quadratic in sin x, cos x, or tan x, including 2sin²x − sin x − 1 = 0 and cosine twins. Stages: the factored form, the two equations, each factor's solutions, the combined list. The clean path always factors. "Divide both sides by sin x" (or cos x) is a wrong option so `te_lost_solution` is teachable; that option is never the right answer. `te_no_solution` is a factor sin x = ±2 or cos x = ±2, rejected as "no solution". tan x = ±2 is not treated as no solution.

Figures are `{ kind: 'none' }` everywhere. `TrigFigure` was not extended. Hints are the part's nudge, rule card, and reveal (the house three rungs). Rule cards are plain text: the formula is on the card, with no TeX command and no dollar sign.

Grading does not string-match one spelling. Single-term exact values and radian lists go through the house graders (`gradeTrigPart`, `readAngleList`) after a module trap is claimed. Sums of unlike radicals, which the house exact type cannot store, are checked numerically with `readTrigAnswer`. Every stored exact value and every stored solution is also checked against `Math` in the crosscheck tests (tolerance 1e-9), and each generator rechecks its own catalog at build time.

## Exclusions

These are left out of the catalogs rather than special-cased:

- Sum and difference: each item teaches one split. The other split that also equals the angle is not a choice. `ta_cos_sign` is only cosine and secant. A tangent denominator flip is an ordinary wrong choice.
- Double angle: triples are primitive and the legs are unequal, so cos 2θ is not 0 and the swapped-squares trap is a different number. An item whose answer is the digits of the given fraction (a positive "3/5" inside a given "−3/5") is left out, because the prompt would show it.
- Half angle: cos θ is never 0, 1, or −1. Only functions whose sign changes between θ and θ/2 are asked. The half-angle rule writes the denominator as `/2` with no space, so a tangent of the half angle that really is 2 is not read as already printed on the card.
- Linear equations: sin ±1, sin 0, cos ±1, and tan 0 are left out (one solution, or a reference angle of 0, so "only one quadrant" would be the whole answer). cos 0 is kept (π/2 and 3π/2). No wrap is already isolated, so the sign slip always has a constant to move. The cosine reference angle is the complement of the sine one: |cos| = 1/2 is 60°, |cos| = √3/2 is 30°.
- Factoring: no item is solved by dividing both sides by the function. The swapped factor order is not a wrong choice (it is the same factorization). A sign-flipped pair that is the same set of roots (±1/2) is replaced by "fn x = 2 or fn x = −2". When the solution list contains the angle 0, the prompt, the instructions, and the rule say "zero" and "one full turn" instead of a bare 0, because `[0, 2π)` would show that answer. Tangent is not given a root of ±1/2: that is a real angle, but it is not on the special-angle table, so there is no exact list in the unit-circle solution grammar. Tangent items are the shapes whose roots are 0 or ±1 (tan²x − 1 = 0, and tan x(tan x ± 1) = 0). The tangent twin of 2sin²x − sin x − 1 = 0 would ask for tan x = −1/2 and is left out. Cosine twins of that equation are included.

Catalogs are seed-deterministic (seed mod the catalog length) and longer than 60 rows with unique statements, so seeds 1..60 are 60 different statements. Sum and difference is 3 wordings × 4 angles × 2 units × 6 functions = 144. Linear is 76. Factor, after the tangent exclusion, is 98 (10 of them tangent, 40 of them the lost-solution shape, 32 of them a factor with no solution).

## Wiring that is not on the new-module allow-list

The two modules cannot typecheck, grade a named mistake, or render without the following. None of it rewrites an engine, `trigIdentities`, `unitCircle`, `TrigFigure`, the store, the session, or `TrigPartsBody`.

- `src/shared/types.ts`: `ModuleId` gains `trigFormulas` and `trigEquations`. `ErrorPatternId` gains the 12 new ids. `term_across_sign` was already there.
- `src/content/types.ts`: `ProblemKind`, two `AnswerSpec` arms on `TrigAnswerFields`, `TrigFormulasQuestion`, `TrigEquationsQuestion`, and the two answer types added to `TrigAnswer` so the existing parts body accepts them.
- `src/engine/matchers/catalog.ts`: catalog entries for the 12 ids only. Grader logic was not changed. `ta_` / `te_` ids are not `trig_` ids, so they are not in `TRIG_MISTAKE_IDS`.
- `src/pages/Problem.tsx`: the two kinds render `TrigFormulasFlow` and `TrigEquationsFlow`.
- `src/pages/flows/TrigFlow.tsx`: those two functions are thin wrappers, the same shape as `UnitCircleFlow`. They call `gradeTfPart` / `gradeTePart` and otherwise use `TrigPartsBody` unchanged. `DOING` gained labels for the new stage ids. The house grader drops a trap whose id is not a `trig_` mistake, so the wrappers' graders claim a `ta_` / `te_` trap first and then delegate.
- `src/problem/tutorContext.ts`: both answer types join the existing trig chains (the work summary, the plain prompt, the reveal) and the `answerOf` switch, so the tutor does not fall back to the title.
- `src/problem/workedExample.ts`: the five template ids are in `COVERED_PARTS_TEMPLATES`. The shared `trigParts` builder already existed, but its switch did not name these answer types (`default` returns null), so `trigFormulas` and `trigEquations` were added to that fall-through and to `carriedFigure`. No new builder. A figure of kind `none` is not carried.
- Tests that hard-coded the old unit: `courses.test.ts` (unit 6's three ids), `generators.test.ts` (sixty modules, the two ids in order), `Home.test.tsx` (the three unit-6 titles).
- `src/components/monsters/species.ts`: the 12 new ids are appended at the end of the existing trig species `spin`. No new species. `term_across_sign` was already placed and was not moved.

No one-line export was added to `unitCircle`. The new graders import `gradeTrigPart` from `src/content/modules/trig/parts.ts` and `readTrigAnswer`, `readExact`, `readAngleList`, `solveAnswer`, and `listText` from `src/engine/trig`, all of which were already exported.

## Not done

- Product-to-sum formulas, and solving equations that need a sum-to-product step, are not in these two modules.
- A real browser was not available in this session. The screen path is the jsdom flow tests (wrong answer, the named mistake, the fix, finished, and a reload that keeps the part). Desktop and mobile layout were not opened in a browser.

## Verification

Commands were run in `C:\work\calc2` on 2026-11-05. Vitest was not piped through `tail`. Exit codes are the process exit codes. Other Node test processes were already running on the machine, so the full suite shared the CPU.

- `npm run typecheck` (`tsc` for `tsconfig.app.json`, `tsconfig.node.json`, and `server/tsconfig.json`), after the cosine reference-angle fix and the half-angle rule spacing fix: exit 0.
- Crosscheck, `node node_modules/vitest/vitest.mjs run src/content/modules/trigFormulas/trigFormulas.crosscheck.test.ts src/content/modules/trigEquations/trigEquations.crosscheck.test.ts --reporter=verbose`: exit 0 (33 s). Five tests, 300 seeds each. Sum, difference, double, and half values are recomputed with `Math` from the words on the page. Linear solutions are parsed off the sentence and plugged back in, and the special-angle scan is the whole list. Factor polynomials are parsed off the sentence the same way. `sqrt()` spellings and reversed solution lists grade correct.
- Flow, the same runner on `trigFormulas.flow.test.tsx` and `trigEquations.flow.test.tsx`: exit 0 (108 s). Ten tests. Each template: the promised mistake is named (title, lesson, example, witness), a second Check does not log it twice, the fix finishes the problem with `finalCorrect: false`, and a reload keeps the draft and the part. No browser was opened.
- Full suite, `npm test` (`node node_modules/vitest/vitest.mjs run`), stdout and stderr captured to `%TEMP%\trig-advanced-npm-test.txt`: exit 1. Vitest's own summary: 11 files failed, 388 passed (399 files); 13 tests failed, 6748 passed (6761); duration 2913.37 s. Started 04:20:55. The new files passed inside that run: both crosschecks, both flow files, `workedExample.test.ts` (166 tests, including the five new template ids), `species.test.ts`, `courses.test.ts`, `generators.test.ts`, `Home.test.tsx`, and `src/engine/trig/catalog.test.ts`.

The 13 failures are not these modules. Their timeouts were not changed.

| Test | What it reported |
|---|---|
| `cardSources.test.ts` inv.linear, 40 seeds | timed out at 120 s |
| `own.fuzz.test.ts` inequalities / solve | a string took 270.6 ms (ceiling 250 ms) |
| `own.fuzz.test.ts` logProperties / expand | slowest 526.7 ms |
| `own.fuzz.test.ts` diffQuotient / dq | a string took 273.6 ms |
| `Problem.test.tsx` number-line completion | timed out at 20 s |
| `explog.test.ts` ee.exponential, 300 seeds | timed out at 240 s |
| `explog2.review.test.ts` eg.features, 2000 seeds | timed out at 120 s |
| `engine/logs/property.test.ts` 300 equations | timed out at 120 s |
| `geometry.unit6.test.ts` trap coverage, 2000 seeds | timed out at 120 s |
| `nomenclature.review.test.ts` nm.ionicName, 2000 seeds | timed out at 120 s |
| `piecewiseRate.test.ts` pw.write, 300 seeds | timed out at 120 s |
| `trig/trig.review.test.ts` uc.point, 2000 seeds | timed out at 120 s |
| `trig/unit5.crosscheck.test.ts` sinusoidal models | timed out at 600 s |

`own.fuzz.test.ts` says a busy moment can push a string over its 250 ms ceiling. That is what those three did, on inequalities, log properties, and difference quotients.
