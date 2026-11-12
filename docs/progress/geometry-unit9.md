# Honors geometry Unit 9 — areas of plane figures

Content stage of Unit 9 (Jurgensen chapter 11, first half) on branch `geometry-unit9`
(working copy `C:\work\geo9`). Ratios of areas, shaded regions, and geometric probability are a later build.
Circle circumference, area, arcs, and sectors are also left out: a quantity cannot carry π (see Not done).

## Why

Her class reaches areas after circles. This build is the polygon half: the area of a rectangle, a
parallelogram, a triangle, a trapezoid, and a rhombus or kite, then a height that has to be found first,
then a regular polygon. The circle half of the chapter needs answers such as `49π`, which the existing
quantity reader cannot take.

## What she gets

Unit `g9`, label "Unit 9", title "Areas of plane figures", after g8. One module, order 32, after
`geoCircleMeasures`:

| module | templates | asks |
|---|---|---|
| `geoPolygonArea` | `ar.basic`, `ar.special`, `ar.regular` | rectangle, parallelogram, triangle, trapezoid, rhombus or kite; a height found from a Pythagorean triple, an equilateral triangle, or a 30° or 45° angle; a regular polygon from the apothem and a side, or a hexagon, square, or equilateral triangle from one side or the radius |

`geoCircleArea` is not registered. No half-registered circle templates.

The screen is the shared geometry flow: parts one at a time, the figure before she answers, three hint
rungs with the last marking the answer as shown, entries restored after a reload. The answer box takes
the number only. Lengths are cm, m, in, or ft. Areas are named in the prompt as square units (`cm²`).

Every figure is drawn from that seed's own numbers. The shape, the ask, the turn of the figure, the
unit, and the story opener come from `makeRng(mixSeed(seed, k))`. A bad layout is rejected and redrawn,
up to 96 attempts, without changing which kind of problem the seed is.

## Named mistakes

Seven new ids, appended at the end of The Mismeasurer (`mismeasure`). Each one is the exact number that
slip produces on this problem, and it is dropped when that number is the right answer or another trap.

| id | what she did |
|---|---|
| `geo_slant_as_height` | used the slanted side as the height |
| `geo_area_not_halved` | left off the half for a triangle, trapezoid, rhombus, kite, or regular polygon, so the area is exactly double |
| `geo_half_applied` | took half of a rectangle or a parallelogram |
| `geo_bases_multiplied` | multiplied a trapezoid's bases instead of adding them |
| `geo_perimeter_for_area` | gave the perimeter where the area was asked |
| `geo_area_for_perimeter` | gave the area where the perimeter was asked (`ar.regular`) |
| `geo_apothem_for_radius` | used the radius of a regular polygon where the apothem belongs, or the apothem where the radius belongs |

Reused, not redefined: `geo_half_not_taken`, `geo_diagonal_half_as_whole`, `trig_pythag_added`,
`trig_pythag_subtracted`, `trig_side_not_rooted`, `trig_special_root3_two_swapped`,
`trig_special_45_two`, `trig_special_wrong_way`, `trig_special_legs_swapped`.

A correct radical that is not simplified is the existing simplest-form note (it quotes what she typed,
such as `√(27)`), not a named mistake, and it records nothing.

## Design decisions for review

- `answer.ts` and `GeoFigure.tsx` are unchanged. A quantity is a rational times a square root. `49π`
  and `49pi` do not parse. `12√3` does. Circle answers are not faked as decimals.
- `Problem.tsx` is unchanged. The geometry case already calls `assertGeometryQuestion`, and
  `polygonArea`, `specialArea`, and `regularArea` are in that list (`tutorContext.ts`).
- The import of Unit 9's drawer is aliased (`drawSpecial as drawPolygonSpecial`) because Unit 7 already
  exports `drawSpecial`.
- A kite is drawn and the prompt says kite, but `params.shape` stays `rhombus` (with `params.kite`).
  The five-shape mix test counts kite with rhombus, so each of the five shapes can stay in the 12–30% band.
- In `ar.basic` a trapezoid is asked for its area or its height, not a missing base. A rhombus or kite
  is asked for its area or one diagonal.
- The height is the perpendicular one. A parallelogram or a triangle is drawn with a labeled slanted
  side, and that side is the trap. The base length of a parallelogram is labeled on the top side, and
  the side length of an equilateral triangle is labeled on a leg, so the dashed height does not land on
  a labeled side. A regular polygon's side label is on a side that is not the one the apothem meets.
- A regular polygon whose apothem and side are both given is drawn regular at the stated side. The
  apothem segment is the true perpendicular from the center. The stated apothem (the one the formula
  uses, a whole number or a half, within half a unit of the true length) is the label. Hexagons,
  squares, and equilateral triangles are drawn to the true ratio.
- The shared number hint says "like 2√3". The leak check treats that as showing the answer, so a seeded
  problem whose display is exactly `2√3` is rejected and redrawn. The textbook hexagon of side 4
  (apothem `2√3`, area `24√3`) is `handHex4` only. When the screen gate refuses it, the hand builder
  returns the figure and the arithmetic without that gate. Seeds never ship it.
- Rule cards are one formula family each, with no digits. `geo9-all` lists every area formula and is
  never the card for a single part.
- The right-angle mark is only where the problem gives a right angle, or at the foot of a height, or
  where the diagonals of a rhombus or kite cross. A 30° or 45° angle is stated in the prompt and drawn
  to that measure. The degree number is not printed on the figure.

## Log

- Polygon module built and registered as `geoPolygonArea` on unit `g9`. Circle module left unregistered.
- Label placement moved off the side a dashed height or apothem meets, after every rotation failed the
  shared label check.
- Answers whose text is exactly `2√3` are redrawn, because that string is the example in the shared
  number hint.

## Not done

- `geoCircleArea` (`ca.circle`, `ca.sector`). `readGeoAnswer` cannot read `49π` or `49pi`. The tokenizer
  accepts `sqrt` and numbers only. The brief says not to change `answer.ts`. The circle slips (diameter
  used as the radius, `r²` forgotten, the `2` forgotten in a circumference, arc length swapped with
  sector area, the fraction of the circle left off or inverted) are not minted, because there is no
  problem that can grade them.
- Ratios of areas, shaded regions, geometric probability.

## Verification

Runs after the last code edit, from `C:\work\geo9`, on 2026-11-12. No code was edited after these runs.
Scratch logs were deleted after the counts below were taken.

- `npm run typecheck` (app, node, and server configs): exit 0.
- `geometry.unit9.test.ts`: 11 passed. Each template over 300 seeds is deterministic, validates its
  answers, grades its promised trap as that id, and does not show an answer early. No numeric answer is
  a given number. Every new id and the borrowed slips above are real candidates. A 2000-seed sweep
  (33.5 s) finds no generated answer in an example, witness, hint, nudge, or rule card. At least 25
  distinct prompts per template, no display over 10%, and the figure is not always the same way up.
  In `ar.basic` each of the five shapes is 12–30%.
- `geometry.unit9.solve.test.ts`: 3 passed. Each template over 300 seeds is solved again from the
  prompt and the figure's labels.
- `geometry.unit9.hand.test.ts`: 17 passed. That includes the polygon examples from the brief
  (triangle 30, trapezoid 32, rhombus 120, equilateral `9√3`, isosceles height 12 then area 60,
  hexagon apothem `2√3` and area `24√3`, octagon 120) plus a rectangle, a parallelogram, a kite, a
  right triangle, a 30° triangle, a 45° triangle, an isosceles trapezoid, a square from its radius,
  and a missing side. `sqrt(27)` on the equilateral triangle of side 6 is invalid, quotes `√(27)`,
  and does not show `3√3`. The three circle examples are not in this file.
- `GeometryFlow.unit9.test.tsx`: 11 passed. Per template: the figure first, the promised mistake named
  and recorded, then the fix and completion; an unreadable answer records nothing; a reload restores
  her entries. The third hint marks the answer shown. An unsimplified radical records nothing.
- One command (`--pool=threads --maxWorkers=1`) ran hand, flow, `courses.test.ts` (3),
  `WorkedExample.figures.test.tsx` (4, including a worked figure for each Unit 9 template),
  `species.test.ts` (7), `coverage.test.ts` (1), and `Chunky.test.tsx` (7): exit 0, 7 files,
  50 tests, 287.82 s.
- An earlier command printed 37 passes in `tutorContext.test.ts` (including the three area kinds)
  and 12 in `Home.test.tsx` (including Units 1–9), then was stopped while `generators.test.ts` was
  still on unrelated canonical-path tests. Those files are in the whole suite below, which did not
  fail them. The sixty-nine-module registration line in `generators.test.ts` had already passed.
- Whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=3`: vitest exit 1.
  430 files passed, 1 failed (431). 7204 tests passed, 1 failed (7205). Duration 3267.85 s.
  The only failure was `geometry.unit6.test.ts`, "examples, witnesses, hints, nudges, and rule cards
  never show a generated answer, over 2000 seeds": `Test timed out in 120000ms`. It is not an assertion
  failure. That file was already running beside another suite on this machine. Re-run alone,
  `--pool=threads --maxWorkers=1`: exit 0, 23 passed, 65.38 s.
- Production build, `node node_modules/vite/bin/vite.js build --outDir C:\work\geo9\.tmp-dist`:
  exit 0, built in 24.42 s. The output folder was deleted.

## Files

Added:

- `src/content/modules/geometry/unit9Polygons.ts`
- `src/content/modules/geometry/unit9Rules.ts`
- `src/content/modules/geometry/geometry.unit9.test.ts`
- `src/content/modules/geometry/geometry.unit9.solve.test.ts`
- `src/content/modules/geometry/geometry.unit9.hand.test.ts`
- `src/pages/flows/GeometryFlow.unit9.test.tsx`
- `docs/progress/geometry-unit9.md`

Changed (appended in this course's or the `geo_` region's own end, not reordered):

- `src/content/courses.ts`, `src/content/courses.test.ts` (unit `g9`)
- `src/content/modules/geometry/index.ts` (register `geoPolygonArea`)
- `src/content/modules/geometry/grade.ts` (`GEO_UNIT9_MISTAKE_IDS`)
- `src/content/modules/geometry/rules.ts` (spread `UNIT9_RULE_FOR`)
- `src/content/types.ts` (question kinds)
- `src/shared/types.ts` (module id and the seven mistake ids)
- `src/engine/matchers/catalog.ts` (seven entries, after `geo_circumscribed_adjacent`)
- `src/components/monsters/species.ts` (seven ids at the end of `mismeasure`)
- `src/problem/tutorContext.ts`, `src/problem/tutorContext.test.ts`
- `src/problem/workedExample.ts` (`ar.basic`, `ar.special`, `ar.regular`)
- `src/components/WorkedExample.figures.test.tsx`
- `src/content/modules/generators.test.ts` (sixty-nine modules)
- `src/pages/Home.test.tsx`

Not changed: `GeoFigure.tsx`, `answer.ts`, `Problem.tsx`, Units 1–8 content, chemistry modules, and
`src/engine/` except the new catalog entries.
