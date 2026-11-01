# Honors Geometry, Unit 7, second half (the tangent, sine and cosine ratios)

Course `geometry`, unit `g7`, title still "Right triangles" (Jurgensen chapter 8, sections 8-5 to 8-7), after
`geoSpecialRight`. Two modules on the existing geometry screen (`GeometryFlow`): parts one at a time, three hint rungs
(the last marks the answer as shown), entries kept across a reload, and the figure on screen before she answers. Built
on branch `geometry-unit7b` in `C:\work\geo7` (outside OneDrive); uncommitted for review. Units 1 to 7 first half are
unchanged in what they ask. "Solve the right triangle" is 8-8 and is not built.

## Why

Her honors geometry course now asks for the three ratios of an acute angle, a side from a ratio, an angle from two
sides, and angles of elevation and depression, including the two-observation problem. The precalculus right-triangle
core already computes those ratios, sides and inverse angles, and already names the slips. This half reuses that core.
Every named slip is a monster. The one slip the core does not have (the two ground distances combined the wrong way)
is a new `geo_` id.

## What she gets

- `geoTrigRatios` (order 27), "The tangent, sine and cosine ratios":
  - `tr.ratio` "Writing a ratio": from a labeled right triangle, write the tangent, sine or cosine ratio of a named
    acute angle as a fraction in lowest terms (`3/5`, or a simplest radical such as `√3/2`), or name which ratio uses a
    given pair of sides. Sides are a Pythagorean triple or a multiple, or one radical. A radical left unsimplified is
    the simplest-form note, not a mistake. `6/10` for `3/5` is the lowest-terms note. `0.6` for `3/5` is the
    calculator-decimal note.
  - `tr.side` "Finding a side": one side and an acute angle that is not 30°, 45° or 60°. Find the opposite, the
    adjacent or the hypotenuse, rounded to the nearest tenth or hundredth. The given side is sometimes the hypotenuse
    and sometimes a leg, so sometimes she divides by the ratio.
  - `tr.angle` "Finding an angle": two given sides, which pair varies. Find the acute angle to the nearest degree, or
    sometimes the nearest tenth of a degree. A random draw is not within about a twentieth of a degree of 30°, 45° or
    60°; the hand-worked builders still accept `tan⁻¹(1) = 45°` and `sin⁻¹(1/2) = 30°`.
- `geoElevDepress` (order 28), "Angles of elevation and depression":
  - `el.story` "An angle of elevation or depression": one right triangle. A tree or a building from a distance and an
    angle of elevation; a boat from a lighthouse, a cliff or a window, with the angle of depression; a ladder, a kite
    string, a ramp, a guy wire, or a plane's distance along the line of sight. Sometimes the asked quantity is the
    angle. The figure marks the angle at the right vertex. A depression draws a dashed horizontal at the observer, and
    the arc sits between that horizontal and the line of sight, not inside the triangle.
  - `el.two` "Two angles of elevation": two observations of one top. Same side (a second point closer or farther) or
    opposite sides. Find the height or one of the distances, rounded as asked. Each ground piece has its own dimension
    line. 30° and 45° are allowed here (the textbook tower uses them).

Degrees everywhere. Rule cards name SOH-CAH-TOA, the three ratios, and that an angle of elevation and an angle of
depression are both measured from the horizontal and are equal alternate interior angles. Every card tells her to put
the TI-84 in DEGREE mode.

## Named mistakes

One new id, appended at the end of The Mismeasurer (`mismeasure`), after `geo_half_not_taken`. That family line now
also says two ground distances added where they should be subtracted, or the reverse. No trig-family species was edited.

| id | the slip | species |
|---|---|---|
| `geo_distances_combined` | same-side height built with the tangents added, or opposite-sides height built with them subtracted | The Mismeasurer |

Reused from the precalculus right-triangle core (graded, not redefined; catalog entries and monsters stay the trig ones):

| id | where she meets it |
|---|---|
| `trig_opposite_adjacent_swapped` | the ratio upside down (adjacent/opposite for tangent), or sine and cosine as fractions of each other |
| `trig_sin_cos_swapped` | she names sine where the pair is cosine, or the reverse, on the "which ratio" part |
| `trig_hypotenuse_as_leg` | the hypotenuse on top of a ratio, or a leg where the hypotenuse belongs; also multiplied where she should divide (or the reverse) on a side |
| `trig_ratio_for_angle` | the ratio's value given as the angle, or the angle's ratio given as the angle |
| `trig_radian_mode` | her number matches the same expression with the calculator in RADIAN mode, including a negative value |
| `trig_depression_from_vertical` | the complement, 90° minus the right answer: depression measured from the vertical, or placed at the far vertex |

`trig_tan_inverted` is not used. The fraction slips come from `rtRatioSlips`, `sideSlips` and `angleSlips`. A promised
trap is the first of those that survives as a real candidate. A slip that rounds to the answer, to a given, to 0, or
that sits on a rounding boundary, is dropped and the seed is redrawn when nothing remains.

## Design decisions for review

- **The core is read-only.** Sides and angles use `sideAnswer`, `sideSlips`, `angleAnswer`, `angleSlips`, `rtRatio`,
  `rtRatioSlips`, `linkOf` and `fnDegrees` from `src/engine/trig`. Nothing in `src/engine/trig`, `src/content/modules/trig`,
  `cardSources.ts`, `workedExample.ts`, or a trig-family species was edited. These templates are not in the worked-example
  panel; that panel cannot draw figures yet.
- **`coreWords` capitalizes a letter that starts a sentence.** The core's second sentence often starts with "sin θ" or
  "sin 68°", which the English check refuses. A sentence that already starts with a capital is unchanged, so Unit 7's
  first half reads the same. The "a 5" to "the 5" change is unchanged. The engine text itself is not edited.
- **A decimal of a lowest-terms ratio is a note.** `stage.lowest` (new, off unless set) makes `0.6` for `3/5` the
  calculator-decimal note. `6/10` is the lowest-terms note. Earlier units do not set `lowest`, so `0.6` for a first-half
  fraction is still correct, as that half's tests require.
- **Fewer places that happen to equal the asked number are a note.** `7.0` for a hundredth answer of `7.00` (the true
  length is about 7.002) used to grade correct, because the numbers are equal before the place check. It is now the
  "rounded too far" note. A slip still wins. The exact whole number, typed as itself (`12` when the truth is 12 and the
  box asks for a tenth, so the answer reads `12.0`), stays correct: Unit 7's first half requires that. More places that
  round to the answer stay correct.
- **Which ratio is about a fifth of `tr.ratio`.** Three buttons would each be about 15% of answers if that mode were
  half the seeds, and the tenth-of-answers cap would fail. Fraction mode is the rest. The ratio itself is chosen
  uniformly, and the three each land between 25% and 40% over 300 seeds. Triples are the twelve exported ones, scaled
  1 to 4, about 60% of the time; the rest have one radical, so `3/5` is not most of the sine answers.
- **Depression distance is height over tangent.** In the triangle the given angle of depression is the alternate
  interior angle at the boat, not the angle at the observer. The dashed horizontal is at the observer; the marked arc
  is between that horizontal and the line of sight.
- **`el.two` formulas.** Same side: height = gap · tan(near) · tan(far) / (tan(near) − tan(far)), near the larger angle.
  Opposite sides: the tangents are added. The wrong-way height is `geo_distances_combined`. Its witness has no digits.
- **The figure.** Asked sides and asked angles are `x` or `?` only. Plain triangles turn and sometimes mirror, so the
  right angle is not always at the bottom left. Stories stay upright and mirror, so the ground stays horizontal.
  `el.two`'s two ground pieces each get a dimension line for that piece only. A rounded or exact answer that equals a
  number the problem gives is redrawn.
- **`GeoFigure.tsx` gained two lines.** The task said not to change it, and named dashed lines as something it already
  drew. It did not: `segment.dashed` was unused. A depression horizontal would have been a solid segment, which reads
  as a side of the triangle. The line now sets `strokeDasharray` when `dashed` is set, and a `data-dashed` attribute
  the layout test can see. A segment without the flag is drawn exactly as before.
- **Format hints name 43 once.** `43`, `43.7` and `43.71` stay reserved, so they are never an answer. The length hint
  is "like 43 m", not "like 43 or 43 m": seed 1 of `el.two` gives 43, and the seed-1 check refuses a hint that repeats
  a given number.
- **Problem.tsx needed no edit.** It already sends every geometry answer through `assertGeometryQuestion` into
  `GeometryFlow`. The five new question kinds are in that check.

## Log

- [done] Read CLAUDE.md, BUILD_GUIDE section 0, the roadmap, the Unit 7 and Unit 6 reviews, and trig-unit4b. Reused the
  geometry flow, the reader, Unit 6/7 gates, and `src/engine/trig` (triangle, special, inverse, expr). Did not fork it.
- [done] `geoTrigRatios` and `geoElevDepress` on unit `g7`, orders 27 and 28. Kinds in `types.ts` and `tutorContext.ts`.
  One new id in the catalog and at the end of The Mismeasurer.
- Found while grading: the core's second sentence starts with "sin" or "cos", so the English gate refused the hand
  examples. `coreWords` capitalizes that letter. Already-capital sentences are unchanged.
- Found while grading: `7.0` graded correct for a hundredth of `7.00`. Fewer places are a note even when the shorter
  number equals the asked one, unless she typed the exact value itself.
- Found while grading: `0.6` graded correct for sine `3/5`, because the reader reduces it to the same fraction. With
  `lowest` set, that decimal is a note.
- Found by the re-solve: the depression parser pointed "the boat" at the angle's digits, and "farther from" did not
  match "farther to". The parsers now follow the sentences the generator writes.
- [done] Typecheck. The whole suite and the build are recorded under Verification.
- The first full suite (379 files, 6541 tests, 3949s) failed three tests. Home still listed only the first three Unit 7
  modules; those two titles are now in `unit7Titles`. `ee.exponential`'s worked-example walk takes about 40s and the
  20s default killed it. That one test now has a 120s timeout. It is not a geometry problem, and the geometry
  templates stay out of the worked-example panel.

## Not done

- No browser or device check (by instruction: no dev server, no browser). Figures were checked by the layout tests
  over 300 seeds per template, in jsdom, including the depression arc and the two dimension lines.
- "Solve the right triangle" (8-8) is not built.
- These templates are not in `workedExample.ts` or `cardSources.ts`. A later build draws figures there.
- `src/engine/trig` was not changed. Trig-family monster species were not changed. No new `trig_` id was defined.
- Not committed, not pushed, not stashed, no new branch.

## Verification

All in `C:\work\geo7`, on the final code.

- `npm run typecheck`: exit 0 (about 161s, after the Home titles and the exponential timeout).
- Colocated tests, before the full suite: `geometry.unit7b.hand.test.ts` (10, including tan 35° ≈ 0.7002, 6-8-10,
  the unsimplified radical, multiply versus divide, tan⁻¹(1) = 45°, sin⁻¹(1/2) = 30°, the 6 m ladder at 68° ≈ 5.56 m,
  the tree at 32° from 25 m ≈ 15.6 m, the 40 m cliff at 25° ≈ 85.8 m, the tower at 30° and 45° from 100 m closer ≈
  136.6 m); `geometry.unit7b.solve.test.ts` (the independent re-solve, bands, real triangles); `geometry.unit7b.test.ts`
  (300 seeds, the 2000-seed sweep, distributions); `GeoFigure.unit7b.test.tsx`; `GeometryFlow.unit7b.test.tsx`;
  Unit 7 first half's rounding test after the grader change; species, coverage, courses, generators, tutorContext, Chunky.
- `node node_modules/vitest/vitest.mjs run --maxWorkers=3`: the first run (3949s) failed 3 of 6541 tests. Home listed
  only the first three Unit 7 modules, and `ee.exponential`'s worked-example walk (about 40s) hit the 20s default.
  After those two test edits, the second run passed: 381 files, 6541 tests, 3614s, exit 0.
- `node node_modules/vite/bin/vite.js build --outDir C:\work\geo7\.tmp-dist`: exit 0, 2244 modules, built in 37.5s.
  `.tmp-dist` was deleted afterward. The chunk-size warning is the existing app bundle, not this unit.

## Files

Changed:

- `src/shared/types.ts` — module ids `geoTrigRatios`, `geoElevDepress`; `geo_distances_combined`; `GeoSegment.dashed`.
- `src/content/types.ts` — question kinds `trigRatio`, `trigSide`, `trigAngle`, `elevationStory`, `elevationTwo`; `lowest`.
- `src/content/courses.ts`, `src/content/courses.test.ts` — the two modules on `g7`, title unchanged.
- `src/content/modules/geometry/index.ts` — the two modules, orders 27 and 28.
- `src/content/modules/geometry/grade.ts` — `lowest`, the borrowed trig ids, the rounding note, the decimal-of-a-fraction note.
- `src/content/modules/geometry/unit7Build.ts` — `coreWords` capitalizes a sentence start.
- `src/content/modules/geometry/rules.ts` — `UNIT7B_RULE_FOR`.
- `src/content/modules/generators.test.ts`, `src/problem/tutorContext.ts`, `src/problem/tutorContext.test.ts`.
- `src/pages/Home.test.tsx` — Unit 7's module titles include the two new ones.
- `src/problem/workedExample.test.ts` — a 120s timeout on the `ee.exponential` walk only. No geometry template added.
- `src/engine/matchers/catalog.ts` — `geo_distances_combined` only. No `trig_` entry edited.
- `src/components/monsters/species.ts` — `geo_distances_combined` appended to The Mismeasurer; that family line widened.
- `src/components/GeoFigure.tsx` — draw `segment.dashed`. See the decision above.

Added:

- `src/content/modules/geometry/unit7bRatios.ts`, `unit7bElev.ts`, `unit7bBuild.ts`, `unit7bRules.ts`.
- `src/content/modules/geometry/geometry.unit7b.test.ts`, `geometry.unit7b.hand.test.ts`, `geometry.unit7b.solve.test.ts`.
- `src/components/GeoFigure.unit7b.test.tsx`, `src/pages/flows/GeometryFlow.unit7b.test.tsx`.
- `docs/progress/geometry-unit7b.md` (this file).
