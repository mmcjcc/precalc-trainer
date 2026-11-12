# Honors geometry Unit 9 — circles: circumference, area, arcs and sectors

Content stage of Unit 9, the circle half (Jurgensen chapter 11, sections 11-5 and 11-6), on branch
`geometry-circles` (working copy `C:\work\geo9`). Built on the π answer engine committed as 9383e46. Ratios of
areas, shaded regions made of several figures, rings, and geometric probability are a later build. Uncommitted, for
review.

## Why

Her class finishes chapter 11 with the circle: circumference and area, then arc length and the area of a sector,
then the segment of a circle (sector minus triangle). Every answer there is exact, in terms of π (`49π`, `(27π)/2`,
`6π − 9√3`), which the reader can take since 9383e46.

## What she gets

Unit `g9` "Areas of plane figures" now holds two modules: `geoPolygonArea` (order 32) and, after it,
`geoCircleArea` "Circles: circumference, area, arcs and sectors" (order 33).

| template | question kind | asks |
|---|---|---|
| `ca.circle` | `circleArea` | two parts: from the radius (about 15% a simple radical such as `3√2`), the circumference and the area; from the diameter (about a quarter odd, so the area is like `(49π)/4`), the same; from a circumference given as a multiple of π, the radius then the area; from an area given as a multiple of π, the radius then the circumference |
| `ca.sector` | `arcSector` | central angle 30–160° (15 values); `arc` (arc length), `sector` (sector area), `both`, `angle` (the central angle in degrees from the radius and an arc length or a sector area), `radius` (from the angle and an arc length). About a fifth of `arc` and `sector` asks are the MAJOR arc ACB or the major sector, with C on the major arc and the major sector shaded |
| `ca.segment` | `circleSegment` | 60°, 90° or 120° with an even radius 4–18: a) sector AOB, b) triangle AOB, c) the shaded segment, a two-term answer such as `4π - 8` (taken in any order, factored as `4(π - 2)`, or with like terms combined) |

The screen is the shared geometry flow, unchanged: parts one at a time, the figure first, three hint rungs, entries
restored after a reload, and the π key on the symbol strip and the keypad for these three question kinds. Format
hints: a π part `A number times π, like 43π or (43π)/2.`; a plain length `EXACT_HINT9`; an angle `A number of
degrees, like 43 or 43°.`; the segment `Two terms, like 43π - 7 or 43π - 7√11.`

Every figure is drawn to the problem's true radius and central angle: the circle with center O, the given radius
(labeled with its number) or diameter, or a radius labeled `r` when the radius is asked or not given; for sectors and
segments radii OA and OB, the central angle marked with its degrees (`x°` when the angle is asked), and the region
the question is about shaded (the major sector for a major ask). The figure's turn (0–359°) and reflection, the unit,
the opener, the variant and the numbers all come from `makeRng(mixSeed(seed, k))`; the redraw loop allows 120
attempts per seed. The variant/ask (and, for sectors, the angle) is fixed per seed through `modeOf`, so a redraw never
moves the mix.

## Named mistakes

Eleven new ids, appended at the end of `GEO_UNIT9_MISTAKE_IDS`, of `ErrorPatternId`'s geo region, of the catalog after
`geo_apothem_for_radius`, and of The Mismeasurer's `variants`. Each is the exact value that slip gives for this
problem's numbers.

| id | what she did (examples) |
|---|---|
| `geo_circumference_for_area` | 2πr for the area (radius 7: `14π`) |
| `geo_area_for_circumference` | πr² for the circumference (radius 7: `49π`) |
| `geo_circle_diameter_as_radius` | the diameter where the radius belongs (`196π` for the area of radius 7; `28π` for its circumference; `18` from a circumference of `18π`; an arc or sector with d for r; the angle or radius that slip solves to) |
| `geo_circle_radius_as_diameter` | π·r for the circumference (`7π`) |
| `geo_circle_radius_not_squared` | π·r for an area (`7π`; a sector with r unsquared; the angle that gives) |
| `geo_pi_left_off` | the right number without π (`49` for `49π`); only on a part whose answer is one multiple of π |
| `geo_sector_fraction_left_off` | the whole circumference for an arc, the whole area for a sector (or the segment started from the whole circle; the radius from an arc read as the whole circumference) |
| `geo_arc_sector_swapped` | the sector's area for the arc length or the reverse (and the angle or radius that swapped formula solves to) |
| `geo_arc_measure_for_length` | the arc's degrees as its length (`60` for a 60° arc; `240` for a major arc of a 120° angle) |
| `geo_segment_triangle_not_subtracted` | the sector's area for the segment |
| `geo_segment_triangle_added` | sector plus triangle (`4π + 8`) |

Reused, not redefined: `geo_major_minor_swapped` (the minor arc or sector where the major one was asked, or the
reverse), `geo_area_not_halved` (triangle AOB without its half; on the segment, twice the triangle taken away when that
is still positive), `trig_side_not_rooted` (the radius from an area left as r²), and on triangle AOB
`trig_special_legs_swapped`, `trig_special_root3_two_swapped`, `trig_special_wrong_way` (the height of the 60° or 120°
triangle from the wrong 30-60-90 factor; the area computed from that height). `geo_diameter_for_radius` and
`geo_radius_unsquared` are not used (their lessons are about the equation of a circle).

## Design decisions for review

- **A slip equal to a later part's answer stays a candidate but is never promised.** On `ca.circle` πr² typed for
  the circumference always equals the area asked next (or the given area). Telling her "that is the area" names the
  slip; promising it would hand her part b. So `geo_area_for_circumference` is graded wherever it occurs but is never
  the promised trap; the coverage test pins that. The witness never prints a number.
- **A slip equal to an EARLIER part's answer is kept and may be promised**: the segment's "sector only" slip is part
  a's answer by definition. (The polygon half's `scrub` dropped every trap equal to any answer; this module has its
  own rule in `deliver`.)
- **Copies of a given are dropped, except the arc's degrees.** `geo_arc_measure_for_length` on a minor arc is the
  stated central angle (`60`), so it is kept as a graded candidate on minor arcs and never promised there; on a major
  arc (`360 − θ`, not stated) it is promised. Every other slip that equals a given is dropped by the shared builder.
- **An answer of exactly `π` never ships**: the prompt's "in terms of π" already prints π, and the shared leak gate
  refuses it, so such seeds redraw. The textbook's 45°, radius 4 case (arc `π`, sector `2π`) is assembled for the
  hand test only, without the gate (as Unit 9's `handHex4` was).
- **Angle answers of 90 never ship** (90 is reserved in Unit 7's gate), so the `angle` ask draws from the other 14
  angles. 90° still appears as a given in every other ask.
- **"No single answer above 10%" is measured per typed part against the template's 300 problems** (as the polygon
  half's test measured against 300), not against the count of that part alone. The 70-odd `angle` asks spread over
  14 angles cannot hold 10% of themselves by chance alone.
- The format hints' examples are whole strings (`43π`, `(43π)/2`, `43`, `43π - 7`, `43π - 7√11`); no draw ever has one
  of those as an answer (2000-seed sweep). A radius of 7 can appear on `ca.circle`, whose screen never shows the
  two-term hint.
- Figure points keep unrounded coordinates (`pointOf` rounds to six places), so A and B are on the circle to 1e-9.
- The segment's triangle for 120° is `r²√3/4` from base `r√3` and height `r/2`; its special-triangle slips use those
  roles (height from the long leg, doubled, or divided by √3).
- Stage labels: `Circumference`, `Area`, `Radius`, `Arc length`, `Sector area`, `Central angle`, `Triangle area`,
  `Segment area`.
- The Mismeasurer's `family` sentence now also names the areas of plane figures (the polygon build had added its ids
  without touching the sentence, so the clause covers both halves).
- Rule cards (`unit9CircleRules.ts`, ids `geo9-…` so Unit 9's `^geo9-` checks hold): circumference, area of a circle,
  radius and diameter, arc length, sector area, arc measure versus arc length, the segment, in terms of π. No digit
  and no radical on any card; numbers are words ("three hundred sixty degrees").

## Deviations

- `src/shared/types.ts`: `'geoCircleArea'` appended to `ModuleId` (additive; needed to register the module).
- `src/content/modules/geometry/geometry.unit9.test.ts` (the polygon half's test): its "every Unit 9 id is a candidate"
  loop now skips the eleven circle ids, which polygons cannot produce; they are covered in `geometry.unit9c.test.ts`.
- `unit9Polygons.ts`: `askUnit` and `askSq` exported (the one-word change the brief allows), nothing else.
- No change to `answer.ts`, `GeoFigure.tsx`, `unit7Build.ts`, `GeometryFlow.tsx`; `grade.ts` only gained the eleven ids.

## Not done

- Ratios of areas, regions made of several figures, rings, geometric probability (a later build, per the brief).
- `geo_area_for_circumference` is never the promised trap (see the first design decision).

## Verification

Runs after the last code edit, from `C:\work\geo9`, on 2026-11-12. Nothing but this document was edited after them.
Scratch logs were deleted after the counts below were taken.

- `npm run typecheck` (app, node and server configs): exit 0.
- Whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=3 --testTimeout=240000`: exit 0,
  462 files passed (462), 7703 tests passed (7703), 1856 s. No failures. It includes the four new files:
  `geometry.unit9c.test.ts` (12 tests: registration; per template over 300 seeds determinism, own answers grade,
  promised trap is a real candidate and never a given or a later answer, nothing shown early, layout clean at 375 px
  via `geoFigureLayout`, English, hints per kind; no reserved or given answer; trap coverage; a 2000-seed sweep per
  template in which every seed produces a problem and no example, witness, hint, card or reserved hint example shows
  an answer; variety and the variant/ask/angle shares), `geometry.unit9c.solve.test.ts` (3: re-solved from the
  grammar in rationals, A and B on the circle to 1e-9, drawn angle to 1e-6, the shaded region the one asked),
  `geometry.unit9c.hand.test.ts` (20: every hand-worked case of the brief, as stated, none weakened; the 45°
  radius 4 case is assembled without the gate because its arc is exactly π), `GeometryFlow.unit9c.test.tsx` (17).
- Earlier targeted runs (before the last edit, which only changed a test timeout constant): the shared files touched
  (21 files, 419 tests) and every `src/content/modules/geometry` test plus `GeometryFlow*` (53 files, 746 tests)
  passed; the whole suite above reran all of them after the last edit.
- Production build, `node node_modules/vite/bin/vite.js build --outDir C:\work\geo9\.tmp-dist`: exit 0, built in
  18.03 s. The output folder was deleted.

## Files

Added:

- `src/content/modules/geometry/unit9Circles.ts`
- `src/content/modules/geometry/unit9CircleRules.ts`
- `src/content/modules/geometry/geometry.unit9c.test.ts`
- `src/content/modules/geometry/geometry.unit9c.solve.test.ts`
- `src/content/modules/geometry/geometry.unit9c.hand.test.ts`
- `src/pages/flows/GeometryFlow.unit9c.test.tsx`
- `docs/progress/geometry-unit9-circles.md`

Changed:

- `src/shared/types.ts` (`geoCircleArea`, eleven mistake ids)
- `src/content/modules/geometry/grade.ts` (`GEO_UNIT9_MISTAKE_IDS`)
- `src/content/modules/geometry/rules.ts` (spread `UNIT9_CIRCLE_RULE_FOR`)
- `src/content/modules/geometry/index.ts` (register `geoCircleArea`)
- `src/content/modules/geometry/unit9Polygons.ts` (export `askUnit`, `askSq`)
- `src/content/modules/geometry/geometry.unit9.test.ts` (skip the circle ids)
- `src/content/courses.ts`, `src/content/courses.test.ts` (unit `g9`)
- `src/engine/matchers/catalog.ts` (eleven entries after `geo_apothem_for_radius`)
- `src/components/monsters/species.ts` (eleven ids at the end of `mismeasure`, its family sentence)
- `src/problem/workedExample.ts` (`ca.circle`, `ca.sector`, `ca.segment`)
- `src/components/WorkedExample.figures.test.tsx`, `src/problem/tutorContext.test.ts`
- `src/content/modules/generators.test.ts` (seventy-five modules), `src/pages/Home.test.tsx`
