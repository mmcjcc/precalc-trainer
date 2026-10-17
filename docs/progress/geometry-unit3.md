# Honors Geometry, Unit 3 (parallel and perpendicular lines)

Course `geometry`, unit `g3`, title "Parallel and perpendicular lines". Two modules, both on the existing geometry screen (`GeometryFlow`): parts one at a time, three hint rungs, entries kept across a reload, and the figure on screen before she answers. Units 1 and 2 are unchanged.

`Problem.tsx` already sends every `geometry` problem to `GeometryFlow`, and the tutor already describes a geometry problem from its prompt, figure, and parts. No new problem kind was added. The tutor test covers a Unit 3 problem.

## Modules

- `geoParallel` (order 13), "Parallel lines and transversals": `gl3.pairs`, `gl3.solve`, `gl3.converse`, `gl3.slopes`
- `geoPolygonAngles` (order 14), "Angles of triangles and polygons": `gpa.triangle`, `gpa.polygon`

The sentence above the prompt says what the problem is, not how to solve it. Figures are drawn to the true angles. Labels are the numbers 1 to 8 or a short expression, never the answer. As in a textbook, the eight transversal angles carry their numbers with no arcs (`GeoAngleMark.arc: false`), and lines m and n and transversal t are named near one end (`GeoLine.label`). Angle measures carry `unit: 'deg'`. Line answers compare exactly (`readLine` / `sameLine` in `lines.ts`): any equivalent form is right, including vertical and horizontal lines.

## Named mistakes

Each id is named only when her entry is exactly what that slip produces on this problem.

`geo_same_side_congruent`, `geo_alt_int_corr_swapped`, `geo_alt_ext_corr_swapped`, `geo_parallel_only_when_not`, `geo_congruent_as_same_side`, `geo_perp_reciprocal_only`, `geo_perp_sign_only`, `geo_parallel_kept_intercept`, `geo_vertical_as_zero`, `geo_exterior_adjacent`, `geo_interior_sum_n180`, `geo_interior_not_divided`, `geo_exterior_180_over_n`, `geo_sides_from_interior_360`, `geo_sides_from_exterior_180`, `geo_exterior_sum_as_interior`, `geo_lines_relation_swapped`.

Catalog and rule-card examples use 4, 17, 1/4, −4, 24, 165, 90/11, and 180/11. No template generates those as an answer. The 2000-seed sweep checks the catalog text and the rule cards against every part.

## Checked

`npm run typecheck`, the full Vitest suite (154 files, 2384 tests), and `vite build` passed. No browser pass: a dev server was not started. The jsdom flow tests cover the figure, a named mistake, the fix, an unreadable answer, and a reload. Each template is deterministic over 300 seeds, validates its own answers, keeps every angle strictly between 0 and 180, and keeps every polygon convex with 3 to 20 sides. An independent cross-check re-solves each prompt over 2000 seeds and requires exactly one solution.

## Notes

- `gl3.solve` seed 2 used to answer `x = 8`. The figure numbers the angles 1 to 8, so that answer was already on the picture. The seed is now `x = 10` (angles 46°).
- `gpa.triangle` seed 1 used to set the exterior expression equal to the sum of the two remote interiors for every x. The exterior is now `(6x − 5)`, which matches that sum only at `x = 8`. The adjacent-interior slip is `182/11`.
- A first visit to Honors Geometry lands on the last unit that has modules, which is now Unit 3.
- The numeric `gl3.converse` answers Yes, No, or "Can’t tell from these angles", then names the angle pair. A deciding pair (corresponding, alternate interior, alternate exterior, same-side interior) answers Yes when the measures fit and No when they do not, and is named either way. Vertical angles and a linear pair cannot tell (it used to answer No, the inverse error). Other pairs at the two crossings decide it in two steps, so the template does not ask them. The algebraic "find x" variant is unchanged.
- A fractional slope prints as `(2/5)x` or `−(1/5)x` (`-(1/5)x` in answers), so it never reads as 2 over 5x. Every spelling still reads: `2/5x`, `(-1/5)x`, `-x/5`, point-slope, standard form.

## Review (2026-10-17)

An independent re-solve (`geometry.unit3.solve.test.ts`) works every template again from its wording over 2000 seeds: the angle pair from the eight positions, x from the pair's relation, slopes and lines from a separate line reader, and the triangle and polygon formulas. Gemini 4's adversarial review found nothing; the re-solve found one real error, fixed with a Claude helper agent:

- **"Are lines m and n parallel?" with vertical angles or a linear pair** was answered "No". Those angles match (or add to 180) whether or not the lines are parallel, so the honest answer is "Can't tell from these angles". The numeric converse is now Yes / No / Can't tell, and the second part names the angle pair (the pair for Yes and for No; "None: these two angles do not decide it" for vertical angles and linear pairs). Can't-tell figures alternate between parallel-looking and tilted lines so the picture never answers.
- **Fractional slopes** read "(2/5)x" and "−(5/2)x" everywhere she reads them ("2/5x" can be read as 2 over 5x); every spelling she might type is still read.
- **Figures:** numbered angles on the transversal have no arcs (the four arcs made a full circle), lines are labeled m, n and t, and an angle label with no room inside a narrow angle goes just outside it with a leader line.

