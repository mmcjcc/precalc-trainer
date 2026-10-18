# Honors Geometry, Unit 4 (congruent triangles)

Course `geometry`, unit `g4`, title "Congruent triangles" (Jurgensen chapter 4). Three modules, all on the existing geometry screen (`GeometryFlow`): parts one at a time, three hint rungs, entries kept across a reload, and the figure on screen before she answers. Units 1, 2, and 3 are unchanged.

New question kinds `congruentParts`, `congruentWhich`, `congruentSolve`, `isoscelesSolve`, and `triangleProof` are wired in `src/content/types.ts`, `Problem.tsx`, and `tutorContext.ts`. The tutor still describes a geometry problem from its prompt, figure, and parts.

## Modules

- `geoCongruence` (order 15), "Congruent triangles": `gc.parts`, `gc.which`, `gc.solve`
- `geoIsosceles` (order 16), "Isosceles and equilateral triangles": `gi.solve`
- `geoTriangleProofs` (order 17), "Proving triangles congruent": `gt.twocolumn`

`gc.parts` either names the part that corresponds to a given part, or picks the congruence statement the marks support. The statement's second triangle is written in correspondence order. `gc.which` asks which postulate or theorem, if any, proves the triangles congruent: SSS, SAS, ASA, AAS, HL, or "Not enough information". SSA and AAA prove nothing. A shared side, vertical angles, or alternate interior angles count only where the figure shows them. `gc.solve` sets corresponding parts equal, solves for x, then the measure asked. `gi.solve` uses the isosceles triangle theorem, its converse, or an equilateral triangle (each angle 60°, and 60 is never an answer).

`gt.twocolumn` is thirteen skeletons. Letters, and for two separate triangles the correspondence, come from the seed: SSS, SAS, ASA, AAS, HL, then CPCTC; a shared side (reflexive), vertical angles, alternate interior angles from parallel lines, and the definitions of midpoint, segment bisector, angle bisector, and perpendicular. The prompt is the textbook "Given: …. Prove: …." Rows are one fact at a time. AAS accepts both "AAS congruence postulate" and "AAS theorem"; HL accepts both "HL postulate" and "HL theorem".

## Named mistakes

Each id is named only when her entry is exactly what that slip produces on this problem.

`geo_ssa_as_congruence`, `geo_aaa_as_congruence`, `geo_sas_not_included`, `geo_asa_aas_swapped`, `geo_hl_no_right`, `geo_vertices_out_of_order`, `geo_cpctc_too_soon`, `geo_shared_side_missed`, `geo_vertical_angles_missed`, `geo_base_angles_wrong_vertex`, `geo_equilateral_angle_for_side`.

Rule cards name the methods. A catalog lesson may name one of a confusable pair only if it names both (ASA with AAS, SAS with SSA, HL with SSA). Examples, witnesses, hints, nudges, and notes do not contain the part's answer. Example numbers are 6, 11, 23, 24, 41, and 90, and no template generates those.

## Checked

`npm run typecheck`, the full Vitest suite (166 files, 2528 tests), and `vite build` passed. No browser pass: a dev server was not started. The jsdom flow tests cover the figure, a named mistake, the fix, an unreadable answer, and a reload. Each template is deterministic over 300 seeds, validates its own answers, and keeps its promised trap a real wrong candidate. An independent cross-check re-solves each prompt from the wording over 2000 seeds: one solution, real triangles, and the method decided from the given marks only. Figure labels stay off the lines, off each other, and inside the figure over 300 seeds per template. Each of the thirteen skeletons has a hand-written validity test. Over 300 seeds, each numeric template shows at least ten values of x, all six correspondences appear, each `gc.which` answer is between 12% and 22%, and the alphabetical congruence statement is correct at most 25% of the time.

## Rework

The first version's arithmetic checked out. It still had to be regenerated, because a fixed table of triangles teaches the pattern, and because five of the named mistakes were not the slip the figure showed.

- A congruence written in another consistent order is the same correspondence. `△ACB ≅ △DFE` is not a wrong choice for `△ABC ≅ △DEF`. A statement row keeps exactly one correct choice, and an equivalent rewriting is not offered.
- `geo_vertices_out_of_order` is only for a choice that pairs real parts by the wrong vertex correspondence. On the midpoint proof, `AM ≅ BC` is not that slip: BC is the whole base, not a side of either triangle.
- AAS picked as SAS is a plain wrong reason. An AAS row has one pair of sides, so "the angle is not between the two sides" does not describe it. HL picked as SAS still carries `geo_sas_not_included`, because the right angle is not the included angle between the hypotenuse and a leg.
- On an HL figure, SSA is a plain wrong pick. The hypotenuse, a leg, and the right angle do prove the triangles congruent.
- A trap is promised only when the marks support it. SSA and AAA are not offered on a figure with no angle marked, and SSA is not offered on the kite or on a vertical-angles figure.
- One pair of alternate interior angles is one pair. Counting those vertices in both directions made a figure with a single pair of parallels look like ASA. The swapped vertices are a different pair, and they count only when the figure draws that pair too.

Prompts use ≅ and "congruent", and the Given/Prove layout. A row whose reason is Given is exempt from the on-screen check, because that list is the problem. When the Prove statement is a row, that row asks for the reason. `gc.which` does not print "Not enough information" in the prompt; that text is the button.

Every problem is drawn from its seed. Six letters come from a pool that leaves out I, O, J, K, L, M, and X. The correspondence is one of the six, the second triangle is rotated and reflected about half the time, and x is taken from a pool that avoids the example numbers. Over 300 seeds each numeric template shows at least ten values of x, each correspondence appears, each `gc.which` answer is about one sixth of the seeds, and the alphabetical congruence statement is the right one at most a quarter of the time.

`geo_vertical_angles_missed` is the new id for choosing "Not enough information" when the drawn crossing supplies vertical angles the answer needs.

## Notes

- A first visit to Honors Geometry lands on the last unit that has modules, which is now Unit 4. The home test that arrows onto the class expects the three Unit 4 titles. Clicking Unit 3 still expects the two Unit 3 titles.
- The vertical-angles proof used a steeper crossing than the "which method" figure, and the letter at the crossing sat on a ray. It now uses the same crossing that already cleared the layout check. `GeoFigure` was not changed.
- On the skeleton where she picks the congruence statement, that row is a statement choice, not a reason. CPCTC too soon is the reason pick on the congruence row itself. Typing a reason id into the statement picker is not an attempt.
