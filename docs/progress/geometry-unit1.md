# Honors Geometry, Unit 1 (tools of geometry)

Third class tab: course `geometry`, title "Honors Geometry". Unit `g1` has `geoSegments` and `geoAngles`. Units `g2` (Reasoning and proof) and `g3` (Parallel and perpendicular lines) are listed and marked coming soon.

Later geometry units should import `GeoFigure`, `GeoFigureSpec`, and `readGeoAnswer` rather than copy them. The screen is `GeometryFlow` (parts one at a time, the shared hint ladder, entries kept across a reload). The figure is the statement, so it is on screen before she answers.

## Shared pieces

- `GeoFigureSpec` in `src/shared/types.ts`: points, segments, lines, rays, angle arcs, ticks, matching arcs, a right-angle mark, an optional grid.
- `src/components/GeoFigure.tsx`: SVG from that spec, container width, colour tokens, `role="img"` plus an aria-label. Labels are the stated expressions, not the answer.
- `src/content/modules/geometry/answer.ts`: one reader. Call `normalizeInput` first. Integers, fractions, decimals, `x = 7`, degrees, simplest radicals, points, and `none` / `undefined` only when the question allows them. An equal value that is not simplest radical form (`simplest: false`) is not an attempt.

## Modules

- `geoSegments`: `gs.addition`, `gs.midpoint`, `gs.coord`
- `geoAngles`: `ga.addition`, `ga.bisector`, `ga.pairs`, `ga.words`

Named mistakes (`geo_` ids in the catalog) are detected by computing what that slip produces on this problem:

`geo_answered_x`, `geo_parts_equal`, `geo_part_equals_whole`, `geo_half_for_whole`, `geo_midpoint_subtracted`, `geo_endpoint_averaged`, `geo_distance_not_squared`, `geo_distance_no_root`, `geo_comp_supp_swapped`, `geo_vertical_as_supplementary`, `geo_linear_pair_equal`, `geo_complement_reversed`.

## Checked

`npm run typecheck`, the full Vitest suite (145 files, 2260 tests), and `vite build` passed. No browser pass: a dev server was not started. The jsdom flow tests cover the figure, the named mistake, the fix, an unreadable answer, and a reload.

## Notes for the next unit

The tutor context uses subject `geometry` and includes the figure's aria-label in the statement. The tutor sidecar accepts exactly `TUTOR_SUBJECTS` from `src/shared/tutor.ts` (fixed in review), so a new class is one entry there.

## Review (2026-10-15)

An independent cross-check (`geometry.crosscheck.test.ts`) re-solves every template from its own wording with exact fractions (300 seeds in the suite; 20,000 per template passed with `GEO_SEEDS=20000`). Fixed in review:

- **Identity problems.** Midpoint and bisector problems that give the whole as an expression could make it exactly twice the piece ("AM = x + 20 and AB = 2x + 40"), true for every x. The generator now refuses that coefficient, and `finishHalf` rejects it.
- **Answers shown before she answers.** The catalog's wrong → right examples and the rule cards' examples used seed 1's numbers, so on seed 1 the Rules panel worked her problem (for example "x = 6 and AB = 2x + 3 → AB = 15"). Every example now uses x = 4 (never generated) and values outside the generated answers; `geometry.review.test.ts` sweeps 2000 seeds per template so no example can match a part's answer. The flow also drops a mistake's example whose numbers are this part's answer (`exampleShowsAnswer`). The format hints under the boxes swap their example when it is the answer ("like 7" when x = 7), and the reader's notes use 2√3, which is never a distance between grid points.
- **The simplest-form note** said "√45 equals 3√5": it now says what to fix without the value.
- **Reader.** Reads "AB = 15", "m∠1 = 26" and "a = 64" (not "2x = 12"); a degree sign on a part that is not an angle measure, a point where a number is asked (or the reverse), and a point without parentheses are notes, not attempts; a product of radicals ("√2√3") is not simplest form; a calculator decimal within 1% of the exact answer asks for the exact value. Stages carry `unit: 'deg'` for angle measures.
- **Figures.** A length labeled below its segment is a dimension line (|— 43 —|) clear of the point letters; a flat segment figure is shorter. Angle labels are placed clear of other labels, points and lines, moving out along the angle with a leader line; a whole angle's label goes just outside its arc. Text has a halo in the card colour. The axis letters are drawn only when that axis is on the grid. A browser pass over 140 figures (20 seeds per template, 375 px wide) found no overlapping, clipped or line-crossing labels.

