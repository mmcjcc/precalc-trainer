# Honors Geometry, Unit 5 (quadrilaterals)

Course `geometry`, unit `g5`, title "Quadrilaterals" (Jurgensen chapter 5). Three modules on the existing geometry
screen (`GeometryFlow`): parts one at a time, three hint rungs (the last marks the answer as shown), entries kept
across a reload, and the figure on screen before she answers. Built on branch `geometry-unit5` in `C:\work\geo5`
(outside OneDrive); uncommitted for review. Units 1 to 4 are unchanged.

New question kinds `parallelogramProps`, `parallelogramProve`, `parallelogramCoords`, `specialQuadProps`,
`quadClassify`, `midsegment`, and `trapezoidKite` are in `src/content/types.ts` and the tutor's
`assertGeometryQuestion`. `Problem.tsx` needed no change: it already sends every geometry problem through that
check to `GeometryFlow`. The tutor now leaves out "Figure:" when a problem is stated in words only.

## Modules

- `geoParallelograms` (order 18), "Parallelograms": `gq.props`, `gq.prove`, `gq.coords`
- `geoSpecialQuads` (order 19), "Rectangles, rhombuses, and squares": `gs.props`, `gs.classify`
- `geoTrapezoids` (order 20), "Trapezoids, kites, and midsegments": `gz.midseg`, `gz.isosceles`

`gq.props`: opposite sides (with a side beside them as a distractor), opposite angles, consecutive angles, the
halves of one diagonal (with a half of the other as a distractor), or a half and the whole diagonal. `gq.prove`:
the five ways (definition, both pairs congruent, one pair congruent and parallel, both pairs of opposite angles,
diagonals bisecting each other) or "Not enough information" for one pair parallel and the other pair congruent,
one pair congruent only, one pair parallel only, congruent consecutive angles, or one diagonal bisected. Each run
of six seeds shows the six answers once. A figure that does not prove it is drawn half the time as a
parallelogram and half the time as the shape that has the same marks (isosceles trapezoid, trapezoid, kite).
`gq.coords`: four slopes, four lengths, or the two diagonal midpoints, then what they show; a trap seed asks for
the slopes of one pair and the lengths of the other pair of an isosceles trapezoid. Every slope she finds is a
fraction that is not a whole number and every length an irrational radical, so no answer can be read off a
coordinate.

`gs.props`: a rectangle's congruent diagonals (half against whole, whole against whole, the isosceles triangle at
a side, the right-angle corner split by a diagonal), a rhombus's perpendicular diagonals (halves, the right
triangle at a side, the diagonal bisecting a corner), a square's (halves, the 45° corner). Each rectangle or
rhombus seed's trap is the other shape's diagonal fact. `gs.classify`: the most specific of eight names from a
list of facts, from marks (parallelogram family and "quadrilateral" only, since marks cannot say "not parallel"),
or from coordinates (all eight, by exact slopes and lengths); or "Must it be a rectangle? Must it be a rhombus?"
as two Yes/No parts, so a true name is never graded wrong. A true but less specific name on a most-specific
question is the named slip, never "wrong". Definitions: a trapezoid has exactly one pair of parallel sides and a
kite no congruent opposite sides (Jurgensen); questions whose answer would change under the inclusive
definitions are not asked.

`gz.midseg`: the triangle midsegment (both expressions, or the third side given) and the median of a trapezoid
(bases given, median given, or one base and the median). `gz.isosceles`: base angles at one base, angles across
the trapezoid, the diagonals (one whole, the other in two pieces), and a kite's angles (both axis ends in x with a
side angle given, or the side angles in x with an axis angle given).

## Named mistakes (new `geo_` ids)

`geo_consecutive_angles_equal`, `geo_opposite_angles_supplementary`, `geo_diagonal_half_as_whole`,
`geo_diagonals_assumed_congruent`, `geo_parallelogram_as_rhombus`, `geo_rect_rhombus_swapped`,
`geo_median_not_halved`, `geo_median_as_base`, `geo_midsegment_doubled`, `geo_kite_angles_wrong_pair`,
`geo_trapezoid_as_parallelogram`, `geo_parallel_congruent_mixed`, `geo_one_pair_half_test`,
`geo_consecutive_marks_as_opposite`, `geo_one_diagonal_bisected`, `geo_parallelogram_test_missed`,
`geo_square_not_rectangle`, `geo_not_most_specific`, `geo_converse_property`, `geo_slope_inverted`.

Reused Unit 1 ids: `geo_answered_x`, `geo_half_for_whole`, `geo_distance_no_root`, `geo_distance_not_squared`,
`geo_midpoint_subtracted` (each module that uses one carries a card with that id). Each id is named only when
her answer is exactly what that slip gives on this problem; the re-solve test recomputes every one.

Examples on catalog entries and rule cards use the letters J, K, L, M, N (never in a problem) and only numbers no
part can have as its answer (0, 1, 2, 4, 8, 33, 180, the slope 1/4, the radical 2√5, the point (4, 2)); none
names a shape, since a shape is an answer on a naming question. Format hints: 4, 17°, 53, 2√3, 1/4 or −4,
(−4, 1). No part's answer is any of these (`unit5Build.RESERVED_*`). A lesson that names a shape is not used on a
naming question whose answer is that shape (the mixed-pair lesson names the isosceles trapezoid, so on the
isosceles-trapezoid facts the Parallelogram pick is a plain wrong answer).

## Files

Generators: `unit5Pgram.ts` (gq.props), `unit5Prove.ts` (gq.prove), `unit5Coords.ts` (gq.coords),
`unit5Special.ts` (gs.props, gs.classify), `unit5Trap.ts` (gz.midseg, gz.isosceles). Shared: `unit5Build.ts`
(stages, the gate every problem passes: no answer on screen or in a lesson, example, witness, or message she can
retry on; English prompts; a clear figure), `unit5Geom.ts` (letters, shapes, turns, convexity), `unit5Lattice.ts`
(whole-number shapes), `unit5Figs.ts` (segment-label placement), `unit5Layout.ts` (a copy of GeoFigure's label
arithmetic so a generator can refuse a crowded figure; `GeoFigure.tsx` is unchanged), `unit5Rules.ts`.

## Log

- Found while building: the leak gate refused x = 3, 5, 6, 7, 11 because two card examples contained those
  digits, and refused every rectangle, rhombus, and square answer because three card examples named the shape.
- Found while building: with four perpendicular half-diagonals leaving the crossing point, GeoFigure finds a clear
  spot for its letter at only about a third of the turns, so diagonal figures are turned any amount and redrawn
  until the layout check passes. Prompts no longer open a sentence with "m∠".
- Found by the re-solve: on gq.prove seeds with one pair parallel and the other pair congruent starting at the
  second side, a tick was keyed to side 4 instead of side 0, so the figure ticked one side while its description
  said two. Keys are taken mod 4, and the re-solve now compares every drawn mark with the description (it fails on
  the old code).

## Fixed-seed traps

- `#/p/geoParallelograms/gq.props/1`: `geo_diagonal_half_as_whole` (YE = VY gives x = 17)
- `#/p/geoParallelograms/gq.prove/1`: `geo_parallelogram_test_missed` (Not enough information on two pairs of opposite angles)
- `#/p/geoParallelograms/gq.prove/j`: `geo_parallel_congruent_mixed` (arrows on one pair, ticks on the other)
- `#/p/geoParallelograms/gq.coords/1`: `geo_one_pair_half_test` (one pair of equal slopes called a parallelogram)
- `#/p/geoSpecialQuads/gs.props/1`: `geo_rect_rhombus_swapped` (a rhombus corner treated as a right angle, x = 4)
- `#/p/geoSpecialQuads/gs.classify/1`: `geo_not_most_specific` (Rectangle for a square)
- `#/p/geoSpecialQuads/gs.classify/a`: `geo_square_not_rectangle` (No on "Must it be a rhombus?")
- `#/p/geoTrapezoids/gz.midseg/1`: `geo_median_as_base` (the median set equal to base PQ, x = 1)
- `#/p/geoTrapezoids/gz.isosceles/1`: `geo_trapezoid_as_parallelogram` (base angles set supplementary, x = 18)

## Checked

`npm run typecheck` (app, node, and server configs), the whole Vitest suite (215 files, 4057 tests, 583 s with
`--maxWorkers=4`), and `vite build` (to `C:\work\tmp\geo5-dist`) passed. After the suite, two test-only checks
were added and run on their own (27 tests in the two files): every drawn mark agrees with the drawing (equal
ticks, equal arcs, right-angle squares on 90°), and each figure's first vertex lands in all four quarters over
300 seeds. No browser pass: no dev server was started.

- `geometry.unit5.test.ts`: 300 seeds per template (deterministic, own answers grade correct, the promised trap
  is a candidate and grades as itself, no answer on screen or in a hint, nudge, witness, or message, no button
  text in a prompt, English prompts, descriptions, hints, nudges, witnesses, and worked lines); every new id is a
  candidate on some seed and has a catalog entry; the 2000-seed sweep of catalog examples, witnesses, hints, and
  rule-card examples; ten or more values of x, none over a fifth of the seeds; each gq.prove answer 12 to 25%
  (each is exactly a sixth); every case, mode, and name appears; a true name is never graded wrong.
- `geometry.unit5.solve.test.ts`: the independent re-solve, 2000 seeds per template (`GEO_SEEDS` to change).
- `geometry.unit5.hand.test.ts`: 20 problems worked by hand.
- `GeoFigure.unit5.test.tsx`: GeoFigure's own layout check plus segment labels, ticks, right-angle squares, arrow
  marks, and dimension lines, 300 seeds per template; the generators' copy of the label arithmetic matches the
  component exactly, including the rendered segment-label positions; every figure renders with distinct, convex
  vertices.
- `GeometryFlow.unit5.test.tsx`: per template, the named slip then the fix (events recorded once, completes),
  an unreadable answer records nothing, a reload restores her entries; plus the mixed-marks proof, a square's
  two must-be parts, a rhombus named only a parallelogram, five coordinate parts, a midpoint part, the third
  hint, and a degree sign on an angle.
- `tutorContext.test.ts`: every new question kind, and a words-only problem without "Figure:".
