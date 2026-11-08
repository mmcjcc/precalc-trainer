# Honors geometry Unit 8 — circles

Content stage of Unit 8 (Jurgensen chapter 9, plus the circle equation) on branch `geometry-unit8`
(working copy `C:\work\geo8`). Built by Grok from the house brief; Claude reviewed, fixed the last
five failures (below) and finished the build. Three new modules on the shared geometry kind, drawn
with the new `spec.circles` of GeoFigure (committed separately as 9c25046); `GeoFigure.tsx` and
`answer.ts` untouched, as the brief required.

## Why

Her class reaches circles after right triangles: tangents and the radius, central angles and arcs,
chords, inscribed and other angles (inside = half the sum, outside = half the difference), the
products of segment lengths, and the equation of a circle with completing the square.

## What she gets

Unit `g8` "Circles" after g7 in `courses.ts`, three modules in display order 29–31:

| module | templates | asks |
|---|---|---|
| `geoTangentChords` | `tc.tangent`, `tc.arcs`, `tc.chords` | tangent ⟂ radius (find a side, or decide the converse from three lengths), two tangents from a point and the circumscribed quadrilateral, central angles and arcs (semicircles, major/minor names, arcs around the circle), congruent chords and the radius-to-chord right triangle |
| `geoCircleAngles` | `ia.inscribed`, `ia.inside`, `ia.outside` | inscribed angle ↔ arc both ways, the semicircle right angle, inscribed quadrilaterals; two chords inside (half-SUM); two secants / secant+tangent / two tangents outside (half-DIFFERENCE, two-tangent arcs filling the circle) |
| `geoCircleMeasures` | `cm.lengths`, `cm.equation` | crossing chords, two secants, tangent-and-secant products (radical answers simplified, e.g. 2√7); read center/radius from standard form (typed point + quantity), write the equation (4-way choice with mistake-mapped distractors), decide where a point is, complete the square with even D and E |

Every figure is generated from the seed's own measures and packed through the shared layout
(`unit5Layout.ts` gained the same circle bounds and 36-chord label strokes GeoFigure uses). Modes
stay fixed per seed; a redraw loop (96 attempts) retries placement without drifting the mix.

## Named mistakes

16 new ids, placed in the existing geometry species (The Mismeasurer takes the lengths and
equations, The Angle Swapper the angles and arcs): `geo_inscribed_not_halved`,
`geo_arc_not_doubled`, `geo_half_sum_difference_swapped`, `geo_major_minor_swapped`,
`geo_arcs_not_from_full`, `geo_cyclic_not_supplementary`, `geo_semicircle_right_missed`,
`geo_semicircle_as_quarter`, `geo_tangent_right_vertex`, `geo_tangent_not_squared`,
`geo_secant_part_not_whole`, `geo_chord_parts_crossed`, `geo_diameter_for_radius`,
`geo_radius_unsquared`, `geo_center_signs_flipped`, `geo_circumscribed_adjacent`.
Reused where the slip is the same picture: `trig_pythag_added`, `trig_pythag_subtracted`,
`trig_side_not_rooted` in the tangent and chord right triangles. Each trap is kept only when it is
exactly that mistake for those numbers, and dropped when it collides with the answer or a given.

## Decisions

- Circle equations stay inside the existing answer kinds: the center is a typed point, the radius a
  typed quantity, and write-the-equation is a choice whose distractors are the named slips
  (signs flipped, r for r², 2r for r). No new answer infrastructure.
- Unsimplified radicals (`sqrt(28)`) grade invalid with a nudge that never prints the simplified
  answer; a perfect square under the radical gets its own wording.
- The converse-of-tangency figures mark no right angle (the question is whether one exists), and
  the solve test checks none is drawn.
- Examples in catalog lessons and rule cards use letters only; the places card lists every place an
  angle can meet a circle, so it singles out none.

## Fixes after the Grok run (Claude)

Grok hit the 400-turn ceiling with five failures left; fixed in review:
- `semicircleAngle` interpolated a coordinate object into three strings (`angle [object Object]WR`)
  — the shadowed variable is now kept out of the text (product bug).
- The redraw loop starved one seed (466) at 48 attempts ("point S sits on a line"); raised to 96
  and the deterministic 2000-seed sweep now ships every seed.
- The solve test's standard-form parser split at the wrong `+` when the y-term was `(y + k)²`; its
  point parser required parens its callers had stripped; its semicircle branch quoted `'B'`/`'C'`
  instead of the captured letters (test bugs).
- The hand test accepted only the "simplest form" wording; the grader's distinct perfect-square
  message is now accepted too (test bug).
- Two test-only type errors (untyped stage ids; a shadowed `whole`) found by typecheck.

## Verification (2026-11-07, Git Bash, `C:\work\geo8`)

- `npm run typecheck` (all three configs): exit 0 (`C:\work\geo8-typecheck.log`).
- Unit 8 files (`geometry.unit8.test.ts`, `.hand.`, `.solve.`, `GeometryFlow.unit8.test.tsx`):
  exit 0, 71 tests (`C:\work\geo8-u8tests3.log`) — trap/leak sweep over 2000 seeds per template
  (examples, witnesses, hints, nudges and rule cards never show a generated answer), an independent
  re-solve of every part from the prompt's own words and numbers, 15 hand-worked problems
  (tangent from 8 to r=6 is 2√7; 5-12-13 converse with the right angle at the center; chords
  3·8 = 4·6; secants 4·9 = 3·12; (x−3)²+(y+2)²=25 center (3,−2) r 5; completing
  x²+y²−6x+4y−12=0), and the flow walk.
- Shared suites (tutorContext, WorkedExample.figures, monsters, courses, generators, Home,
  workedExample): exit 0, 14 files, 288 tests (`C:\work\geo8-shared-tests.log`).
- Full merged suite runs on main after the chem9 merge (see the ship log).
