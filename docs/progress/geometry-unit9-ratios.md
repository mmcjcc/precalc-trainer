# Honors geometry Unit 9 — area ratios, shaded regions and geometric probability

Content stage that finishes Unit 9 (Jurgensen chapter 11: 11-7 Ratios of Areas, 11-8 Geometric Probability, and the
"find the shaded area" exercises of 11-5 and 11-6), on branch `geometry-unit9b` (working copy `C:\work\geo9`). Built
on ff5e016 (compound shaded regions in the figure) and 6eefaf7 (the three question kinds). Uncommitted, for review.

## Why

The last three sections of her chapter 11 use everything the two earlier Unit 9 modules built: triangles that share
a height (areas in the ratio of the bases), similar figures (areas in the ratio of the squares), a shaded region as
one area minus another (a circle in a square, a square or a hexagon in a circle, a ring), and geometric probability
(length over length, area over area). Every answer is exact: a ratio, a fraction, a whole number, a simplest radical,
a multiple of π, or two unlike terms.

## What she gets

Unit `g9` "Areas of plane figures" now holds three modules: `geoPolygonArea` (32), `geoCircleArea` (33) and, after
them, `geoAreaRatios` "Area ratios, shaded regions and probability" (order 34).

| template | question kind | asks |
|---|---|---|
| `ra.shared` | `areaRatio` | triangle ABC with D on BC (BD ≠ DC, 2–12, labeled), AD drawn, no height: the ratio of the area of one small triangle to the other (`parts`), or to triangle ABC (`whole`), the other small triangle's area from one's (`fromPart`), or one small triangle's area from ABC's (`fromWhole`); each ask is a quarter of the seeds; which small triangle is named first is half and half |
| `ra.similar` | `areaRatio` | `pair` (two similar triangles or quadrilaterals side by side, one pair of corresponding sides labeled a·k and b·k: a) the ratio of the perimeters, b) the ratio of the areas), `areas` (the two areas a²m and b²m given: the scale factor), `other` (the labeled sides and one area: the other area), `parallel` (triangle ABC, DE ∥ BC stated in the prompt, AD and DB labeled: a) ADE to ABC, b) ADE to trapezoid DBCE) |
| `ra.shaded` | `shadedRegion` | `squareCircle`, `circleSquare`, `ring`, `pond`, `circleHexagon`, `circleTriangle` (each about a sixth); three parts (outer area, inner area, shaded area) on 60% of seeds, the shaded area alone on 40% |
| `ra.chance` | `geoProbability` | `segment` (A, B, C, D on a segment, AB, BC, CD labeled; on BC, AB, CD, AC or BD), `target` (two circles with one center; inside the smaller circle, or in the ring), `pond` (a rectangle with a circle inside; inside it, `(3π)/40`, or outside it, `1 - (3π)/40`), `rectangles` (a shaded rectangle inside a rectangle, or a shaded right triangle PES at a corner); each a quarter of the seeds |

The screen is the shared geometry flow, unchanged: parts one at a time, the figure first, three hint rungs, entries
restored after a reload, and the π key on `shadedRegion` and `geoProbability`. Format hints: a ratio `RATIO_HINT6`
(`A ratio, like 9/7 or 9:7.`); a plain number `EXACT_HINT9`; a π answer `PI_HINT9`; a sum `SUM_HINT9`; a probability
`A fraction, like 43/97. With π: (43π)/97.` (`PROB_HINT9`, new, exported from `unit9Ratios.ts`).

A ratio part reads "4:25", "4 to 25", "4/25" and an unreduced "8:50" alike (`ratio: true`, Unit 6's rule). A
probability is a plain number: no `ratio`, no `lowest`; `2/8` and `0.25` pass for `1/4`. A sum passes in any order,
factored (`25(4 - π)`) or over one denominator (`(40 - 3π)/40`).

Every figure is drawn to the problem's true proportions: BD and DC at their stated lengths; the two similar figures
truly similar at the scale factor (every side and diagonal, the letters going round the same way); D and E cutting AB
and AC in the same ratio, so DE is truly parallel to BC; the inscribed circle centered in the square with radius half
the side; the inscribed polygons regular with every vertex on the circle (unrounded coordinates); the pond's circle
inside the rectangle and clear of every side; the shaded region the one the question is about (a compound region:
square minus circle, circle minus polygon, ring, rectangle minus circle, or one loop alone). Labels show only what the
prompt gives. The variant, the numbers, which quantity is asked, the turn and reflection, the unit and the opener all
come from `makeRng(mixSeed(seed, k))`; the variant (and the ask, the order, the region) is fixed per seed through
`modeOf`; the redraw loop allows 160 attempts per seed.

## Named mistakes

Nine new ids, in `GEO_UNIT9B_MISTAKE_IDS` (grade.ts, right after `GEO_UNIT9_MISTAKE_IDS`, in `GeoMistakeId` and
`isGeoMistake`), at the end of the geo region of `ErrorPatternId`, in the catalog after the circle entries, and at the
end of The Mismeasurer's `variants` (its `family` sentence extended). Each is the exact value that slip gives here.

| id | what she did (examples) |
|---|---|
| `geo_area_ratio_squared` | the ratio of the bases squared for triangles that only share a height (BD 4, DC 6: `4/9` for `2/3`) |
| `geo_area_ratio_not_squared` | the scale factor (or the ratio of two radii) given as the ratio of two areas (`3/5` for `9/25`; radii 2 and 6: `1/3` for `1/9`) |
| `geo_scale_from_areas_not_rooted` | the ratio of the areas given as the scale factor (`16/49` for `4/7`) |
| `geo_area_ratio_reversed` | the ratio in the other order (`3/2` for `2/3`; on a segment, the whole over the piece) |
| `geo_part_to_part_for_whole` | a piece compared with the other piece where the whole was asked, or with the whole where the other piece was asked (`2/5` for ABD:ADC; `4/21` for ADE:ABC; a probability as the piece over the rest) |
| `geo_region_not_subtracted` | the outer figure's area given as the shaded area (`100` for `100 - 25π`) |
| `geo_region_added` | the two areas added (`100 + 25π`) |
| `geo_inscribed_side_from_radius` | the radius used as the side of the inscribed square or triangle (`25` for the square in a circle of radius 5) |
| `geo_probability_complement` | the probability of the other region (`4/5` for `1/5`; `1 - (3π)/40` for `(3π)/40`) |

Reused, not redefined: `geo_perimeter_ratio_squared`, `geo_part_over_whole` (AD:DB as the scale factor in the parallel
variant), `geo_scale_factor_inverted` (the scale factor of the second figure to the first: the same slip as Unit 6's),
`geo_circle_diameter_as_radius`, `geo_circumference_for_area`, `geo_circle_radius_not_squared`, `geo_pi_left_off`,
`geo_area_not_halved`, `geo_half_applied`, `geo_perimeter_for_area`, `geo_apothem_for_radius` (the hexagon from the
radius as its apothem), `trig_special_legs_swapped` (the hexagon's apothem or the triangle's height from the short
leg), `trig_special_root3_two_swapped` (the hexagon's apothem with the factors swapped), `trig_special_wrong_way` (the
inscribed square's side as the diagonal times √2).

## Design decisions for review

- **The unit9Circles trap rule, copied**: a slip may equal an EARLIER part's answer and be promised (the outer area
  given for the shaded one; ADE:ABC typed for ADE:DBCE); a slip equal to a LATER part's answer stays a candidate but
  is never promised; a slip equal to a given is dropped. So `geo_perimeter_ratio_squared` (the squared scale factor
  typed for the perimeters, always part b's answer) is named on every `pair` seed and promised on none; the coverage
  test pins that. `geo_part_to_part_for_whole` on part a of `parallel` is part b's answer, so there it is named, not
  promised (it is promised on part b and elsewhere).
- **A ratio is never a whole number** on `ra.shared` `parts` (a seed with BD a multiple of DC redraws), so a ratio
  answer always looks like `n/d`.
- **Scale factors a:b** are in lowest terms, 2–9, unequal, with the larger at most three times the smaller (the small
  figure stays readable beside the large one). `9/7` is a format hint's example, so those seeds redraw.
- **An unreduced π probability** (`9pi/120` for `(3π)/40`) gets the reader's existing simplest-form note ("Reduce the
  number in front of π"), not an attempt, exactly as on the circle module; `answer.ts` is unchanged. A plain unreduced
  fraction passes. Tested in the hand and flow tests.
- **A one-term part whose slip is a sum** (the probability inside the circle, whose complement slip is `1 - (3π)/40`)
  reads sums (`sum: true` on that stage), so the slip can be named. The answer itself is one term.
- **The inscribed triangle's radius is drawn but not labeled**: inside an equilateral triangle a label on OA always
  sits as near a side as its own segment (the sides meet OA at thirty degrees), so the shared label check refuses
  every pose. The prompt states the radius. The square's and the hexagon's radius OA is labeled.
- **The probability triangle** is a right triangle PES at corner P (base PE on PQ, height PS), so the rectangle's
  length is labeled on RS and the prompt says "RS is …" (PQ is split at E).
- **The shaded region is the one asked** in `ra.chance` too: the smaller circle or the ring; the circle or the
  rectangle outside it; the inner rectangle or triangle. A segment has no region.
- **Segment pieces** are each at least a sixth of AD, so their three labels stay clear of each other at 375 px.
- **"No single answer above 10%" is per typed part against the template's 300 problems** (as the circle build). The
  shaded radii were moved off 2 (hexagon 4–14, triangle 4–16, the square in a circle 3–14, larger ponds) because
  `4π` reached 11%.
- **Mix salts**: the shape of `ra.shaded` uses `modeOf` salt 102 (salt 91 gave one shape 11.7% of the 300 seeds,
  under the 12% floor by chance alone; most salts are fine).
- Stage labels: `Ratio of the areas`, `Ratio of the perimeters`, `Scale factor`, `Area of triangle ADC` (and the
  like), `Ratio ADE to ABC`, `Ratio ADE to DBCE`, `Area of the square`, `Area of the circle`, `Area of the larger
  circle`, `Area of the smaller circle`, `Area of the rectangle`, `Area of the hexagon`, `Area of the triangle`,
  `Shaded area`, `Probability`.
- Rule cards (`unit9RatioRules.ts`, ids `geo9-…`): `geo9-same-height` (the same height, and the same base),
  `geo9-similar-areas`, `geo9-part-whole` (and the order of a ratio), `geo9-shaded-region`, `geo9-inscribed`,
  `geo9-chance-length`, `geo9-chance-area`, `geo9-chance-rest`. The module also opens four existing cards
  (`geo9-rect`, `geo9-regular`, `geo9-equilateral`, `geo9-circle-area`) for the outer and inner areas of a shaded
  region; they are the same objects as in the earlier modules. No digit and no radical on any card.
- Reserved for examples (no answer may be one; 2000-seed sweep): `9/7` (and `9:7`), `43`, `43/2`, `3√11`, `43π`,
  `(43π)/2`, `43π - 7`, `43π - 7√11`, `43/97`, `(43π)/97` (`RESERVED9B`). The shared gate also refuses `π`, `1`,
  `43`, `90` and `180` as answers; such seeds redraw.

## Deviations

- `src/content/modules/geometry/geometry.unit9c.test.ts` (the circle module's test): its "eleven circle ids at the end
  of The Mismeasurer" check now reads `variants.slice(-20, -9)`, because the nine new ids are appended after them.
- `src/shared/types.ts`: `'geoAreaRatios'` in `ModuleId` and the nine ids in `ErrorPatternId` (additive).
- `grade.ts`: only `GEO_UNIT9B_MISTAKE_IDS`, its place in `GeoMistakeId`, and its line in `isGeoMistake`.
- No change to `answer.ts`, `GeoFigure.tsx`, `unit7Build.ts`, `unit9Circles.ts`, `GeometryFlow.tsx`, or anything in
  `src/engine/` other than the nine catalog entries.

## Not done

- No new monster species (the list is at its ceiling of 38); the nine ids are variants of The Mismeasurer.
- An unreduced π probability is a note, not a pass (see the design decisions); changing that would need `answer.ts`.
- The inscribed triangle's radius is not labeled on the figure (see the design decisions).
- No dev server, no browser check: the figures are verified by `geoFigureLayout` at 375 px and by the solve test.

## Verification

Runs after the last code edit, from `C:\work\geo9`, on 2026-11-20. Only this document was edited after them. Scratch
logs and scratch test files were deleted after the counts below were taken.

- `npm run typecheck` (app, node and server configs): exit 0.
- Whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=3 --testTimeout=240000`: vitest exit 1. 465 files
  passed, 1 failed (466); 7765 tests passed, 2 failed (7767); 2922 s. Both failures were in `server/src/cards.test.ts`
  (not touched by this build): `TypeError: fetch failed … Error: bad port` from the test's local HTTP server. Re-run
  alone (`--maxWorkers=1`): exit 0, 35 passed. Every other file passed, including the four new ones:
  `geometry.unit9d.test.ts` (12: registration and the nine ids; per template over 300 seeds determinism, own answers
  grade, promised trap a real candidate and never a given or a later answer, nothing shown early, layout clean at
  375 px via `geoFigureLayout`, English, hints per kind, no reserved or given answer; trap coverage with every new id
  promised and `geo_perimeter_ratio_squared` named but never promised; a 2000-seed sweep per template in which every
  seed draws and no example, witness, hint, card or format-hint value is an answer; variety and the shares),
  `geometry.unit9d.solve.test.ts` (4: re-solved from the grammar in rationals, with the configuration checks),
  `geometry.unit9d.hand.test.ts` (18: every hand-worked case of the brief, as stated, none weakened),
  `GeometryFlow.unit9d.test.tsx` (15), and the shared files touched (courses, generators, Home, monsters, worked
  examples, tutorContext, Chunky, GeoFigure, `geometry.unit9c.test.ts`).
- Production build, `node node_modules/vite/bin/vite.js build --outDir C:\work\geo9\.tmp-dist`: exit 0, built in
  28.85 s. The output folder was deleted.

## Review (2026-11-20)

Every formula and every slip's arithmetic was re-derived by hand, and 64 generated problems (16 seeds of each
template) were read with their answers, slips, hints and figures: no error found. Two wording edits to reveals in
`unit9Ratios.ts`: the scale factor from two areas no longer says "64 to 49, which is 64 to 49" when the areas are
already the squares, and the triangle probability now states the triangle's area before the fraction. After those
edits: typecheck exit 0; the geometry, flow, figure, monster, catalog and registration tests, 76 files and 1,001
tests, all pass.

## Files

Added:

- `src/content/modules/geometry/unit9Ratios.ts`
- `src/content/modules/geometry/unit9RatioRules.ts`
- `src/content/modules/geometry/geometry.unit9d.test.ts`
- `src/content/modules/geometry/geometry.unit9d.solve.test.ts`
- `src/content/modules/geometry/geometry.unit9d.hand.test.ts`
- `src/pages/flows/GeometryFlow.unit9d.test.tsx`
- `docs/progress/geometry-unit9-ratios.md`

Changed:

- `src/shared/types.ts` (`geoAreaRatios`, nine mistake ids)
- `src/content/modules/geometry/grade.ts` (`GEO_UNIT9B_MISTAKE_IDS`)
- `src/content/modules/geometry/rules.ts` (spread `UNIT9_RATIO_RULE_FOR`)
- `src/content/modules/geometry/index.ts` (register `geoAreaRatios`)
- `src/content/courses.ts`, `src/content/courses.test.ts` (unit `g9`)
- `src/engine/matchers/catalog.ts` (nine entries after `geo_segment_triangle_added`)
- `src/components/monsters/species.ts` (nine ids at the end of `mismeasure`, its family sentence)
- `src/problem/workedExample.ts` (`ra.shared`, `ra.similar`, `ra.shaded`, `ra.chance`)
- `src/components/WorkedExample.figures.test.tsx`, `src/problem/tutorContext.test.ts`
- `src/content/modules/generators.test.ts` (seventy-six modules), `src/pages/Home.test.tsx`
- `src/content/modules/geometry/geometry.unit9c.test.ts` (the Mismeasurer slice)
