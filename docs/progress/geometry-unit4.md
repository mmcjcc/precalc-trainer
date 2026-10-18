# Honors Geometry, Unit 4 (congruent triangles)

Course `geometry`, unit `g4`, title "Congruent triangles" (Jurgensen chapter 4). Three modules, all on the existing geometry screen (`GeometryFlow`): parts one at a time, three hint rungs, entries kept across a reload, and the figure on screen before she answers. Units 1, 2, and 3 are unchanged.

New question kinds `congruentParts`, `congruentWhich`, `congruentSolve`, `isoscelesSolve`, and `triangleProof` are wired in `src/content/types.ts`, `Problem.tsx`, and `tutorContext.ts`. The tutor still describes a geometry problem from its prompt, figure, and parts.

## Modules

- `geoCongruence` (order 15), "Congruent triangles": `gc.parts`, `gc.which`, `gc.solve`
- `geoIsosceles` (order 16), "Isosceles and equilateral triangles": `gi.solve`
- `geoTriangleProofs` (order 17), "Proving triangles congruent": `gt.twocolumn`

`gc.parts` names the part that corresponds to a given part of `△ABC ≅ △DEF`, or picks the congruence statement the tick marks support. Vertex order is the correspondence. `gc.which` asks which method the marks actually prove: SSS, SAS, ASA, AAS, HL, or "Not enough information". SSA and AAA prove nothing. A shared side or vertical angles count only where the figure shows them. `gc.solve` sets corresponding parts equal, solves for x, then the measure asked. `gi.solve` uses the isosceles triangle theorem, its converse, or an equilateral triangle (60° angles, equal sides).

`gt.twocolumn` is thirteen skeletons, letters varied by seed: SSS, SAS, ASA, AAS, HL, then CPCTC; a shared side (reflexive), vertical angles, alternate interior angles from parallel lines, and the definitions of midpoint, segment bisector, angle bisector, and perpendicular. Rows are checked one at a time. AAS accepts both "AAS congruence postulate" and "AAS theorem"; HL accepts both "HL postulate" and "HL theorem".

## Named mistakes

Each id is named only when her entry is exactly what that slip produces on this problem.

`geo_ssa_as_congruence`, `geo_aaa_as_congruence`, `geo_sas_not_included`, `geo_asa_aas_swapped`, `geo_hl_no_right`, `geo_vertices_out_of_order`, `geo_cpctc_too_soon`, `geo_shared_side_missed`, `geo_base_angles_wrong_vertex`, `geo_equilateral_angle_for_side`.

Catalog and rule-card examples use 11, 23, and 41, and they never use a method name, "not enough information", or a reason's button label. No template generates 11, 23, or 41 as an answer. The 2000-seed sweep checks the catalog text and the rule cards against every part.

## Checked

`npm run typecheck`, the full Vitest suite (166 files, 2543 tests), and `vite build` passed. No browser pass: a dev server was not started. The jsdom flow tests cover the figure, a named mistake, the fix, an unreadable answer, and a reload. Each template is deterministic over 300 seeds, validates its own answers, and keeps its promised trap a real wrong candidate. An independent cross-check re-solves each prompt from the wording over 2000 seeds: one solution, real triangles, and the method decided from the given marks only. Figure labels stay off the lines, off each other, and inside the figure over 300 seeds per template. Each of the thirteen skeletons has a hand-written validity test.

## Notes

- A first visit to Honors Geometry lands on the last unit that has modules, which is now Unit 4. The home test that arrows onto the class expects the three Unit 4 titles. Clicking Unit 3 still expects the two Unit 3 titles.
- The vertical-angles proof used a steeper crossing than the "which method" figure, and the letter at the crossing sat on a ray. It now uses the same crossing that already cleared the layout check. `GeoFigure` was not changed.
- On the skeleton where she picks the congruence statement, that row is a statement choice, not a reason. CPCTC too soon is the reason pick on the congruence row itself. Typing a reason id into the statement picker is not an attempt.
