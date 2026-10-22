# Honors Geometry, Unit 6 (similarity)

Course `geometry`, unit `g6`, title "Similarity" (Jurgensen chapter 7), after Unit 5. Three modules on the existing
geometry screen (`GeometryFlow`): parts one at a time, three hint rungs (the last marks the answer as shown), entries
kept across a reload, and the figure on screen before she answers. Built on branch `geometry-unit6` in `C:\work\geo6`
(outside OneDrive); uncommitted for review. Units 1 to 5 are unchanged.

## Why

The next unit of her honors geometry course after quadrilaterals is Jurgensen's chapter 7: ratio and proportion,
similar polygons, the AA Similarity Postulate and the SSS and SAS Similarity Theorems, and proportional lengths (the
Triangle Proportionality Theorem, its converse, and the Triangle Angle-Bisector Theorem). Every problem names the
specific slip when she is wrong, and every slip is a monster in her collection.

## What she gets

- `geoRatios` (order 21), "Ratio, proportion and similar polygons":
  - `gr.proportion` "Proportions": solve a proportion with x in any of the four places (`x/12 = 15/20`, `12/x = 20/15`,
    a fraction answer sometimes), a binomial on one side or both (`(x + 3)/8 = 15/20`, `12/(x + 2) = 8/14`,
    `(x + 12)/12 = (x − 3)/7`), the geometric mean (`Find the geometric mean of 18 and 2`, or
    `Solve 4/x = x/25 for the positive value of x`, sometimes a radical: 4√5), a ratio from an equation
    (`If 2h = 5u, find the ratio of h to u`, or from `d/12 = u/3`), and which equation must follow from `a/b = c/d`
    (alternation, inversion, the addition, subtraction and sum properties, the means-extremes product).
  - `gr.polygons` "Similar polygons": two similar triangles or quadrilaterals (`In the figure, ABCD ~ GHEF.`), the second
    drawn turned (and sometimes mirrored) so that no side, and in angle problems no vertex, sits where its partner sits.
    The statement's second polygon starts its letters anywhere around it, in either direction. Three parts: the scale
    factor (of the first to the second or the reverse), x (from a side in x, or an angle written `3x°`), then a side,
    the perimeter of the second polygon, or the angle the first triangle does not label (by the angle sum).
- `geoSimilarTriangles` (order 22), "Similar triangles":
  - `gt.prove` "Proving triangles similar": which postulate or theorem, if any, proves two triangles similar. Buttons:
    AA Similarity Postulate, SSS Similarity Theorem, SAS Similarity Theorem, Not enough information. Figures: two arc
    pairs; angle measures with the third angle by the angle sum; a shared angle with one arc pair (a segment parallel to
    a side, or one that makes the angle at D congruent to the angle at C); vertical angles at a crossing; right angles
    with one arc pair; parallel lines with arrows; all six sides with numbers; two sides with the included angle, apart
    or around a shared angle; and, for not enough information, SSA (drawn either similar or as the ambiguous case's
    other triangle), two pairs of sides only, one pair of angles only, the shared angle only, vertical angles only.
  - `gt.solve` "Using similar triangles": the true similarity statement, then x. A segment parallel to a side
    (`DE ∥ BC`), the reverse pairing (`∠ADE ≅ ∠ACB`), the altitude to the hypotenuse (the altitude or a leg as a
    geometric mean, radicals included), shadows at the same time of day, and a mirror on the ground. Story answers take
    their unit (`10 ft`, `14 feet`); the other unit is a note.
- `geoProportionalParts` (order 23), "Proportional parts":
  - `gp.splitter` "Triangle Proportionality Theorem": x in one piece (plain or an expression, then that piece), or in
    two pieces of one side; the converse (Yes / No from the four lengths, on a figure not drawn to scale); a parallel
    through a midpoint (the two halves in x, or the segment and the side it is parallel to).
  - `gp.bisector` "Angle bisectors and parallel lines": the Triangle Angle-Bisector Theorem with x in any of the four
    lengths, and three parallel lines cutting two transversals (not drawn to scale across the transversals).

Every piece of a longer segment carries its number on a dimension line for that piece. Answers are whole numbers,
fractions, decimals for halves in stories, and simplest radicals; a scale factor or ratio may be typed `2/3`, `2:3`,
`2 to 3`, or `4:6`.

## Named mistakes (new `geo_` ids, appended at the ends of their species)

| id | the slip | species |
|---|---|---|
| `geo_matched_by_position` | a side, an angle or a statement paired with the part drawn in the same place (or the segment a point lies on) | Angle Swapper |
| `geo_part_over_whole` | a piece over a piece on one side of a proportion, a piece over a whole on the other (`AD/DB = AE/AC`, `DE/BC = AD/DB`) | Mismeasurer |
| `geo_scale_factor_inverted` | the scale factor (or a side or perimeter from it) upside down | Upside-Downer |
| `geo_perimeter_ratio_squared` | the perimeter scaled by the square of the scale factor | Mismeasurer |
| `geo_cross_multiplied_wrong` | `a·b = c·d` from `a/b = c/d` | Mismeasurer |
| `geo_geometric_as_arithmetic` | the average for the geometric mean | Mismeasurer |
| `geo_bisector_ratio_swapped` | each piece of the bisected side paired with the far side | Mismeasurer |
| `geo_ssa_as_similarity` | SAS Similarity picked for two sides and a non-included angle | Reason Thief |
| `geo_corresponding_supplementary` | corresponding angles set to add to 180° | Angle Swapper |
| `geo_shadows_crossed` | the person's height with the other object's shadow (or distance to the mirror) | Upside-Downer |
| `geo_shared_angle_missed` | not enough information when a shared angle gives the second pair | Reason Thief |
| `geo_similarity_test_missed` | not enough information when the marks give AA, SSS or SAS | Reason Thief |
| `geo_sss_two_pairs` | SSS Similarity picked with two pairs of sides | Reason Thief |
| `geo_aa_one_angle` | AA picked with one pair of angles (a shared angle or vertical angles alone included) | Reason Thief |
| `geo_proportion_distribute` | `s(x + p)` multiplied out as `sx + p` | Corner Cutter |
| `geo_mean_not_rooted` | the product left as the mean (x² for x) | The Radical |
| `geo_angle_scaled` | a corresponding angle multiplied by the scale factor | Mismeasurer |
| `geo_one_ratio_inverted` | one ratio of a proportion turned over (`a/b = d/c`; also `a/b` for `b/a` from `pa = qb`, and shadow over height) | Upside-Downer |

Reused: `geo_vertices_out_of_order` (a statement in the wrong order), `geo_vertical_angles_missed` (not enough
information on a crossing), `geo_answered_x`, `geo_midsegment_doubled` and `geo_half_for_whole` (the midpoint case).
Each module that can name a reused id carries a card with the id that `GEO_RULE_FOR` opens for it.

Family lines widened: the Mismeasurer (proportions set up or cross-multiplied wrong, the means and ratios of similar
figures), the Upside-Downer (a scale factor, one ratio of a proportion), the Angle Swapper (which part of a similar
figure corresponds to which), the Reason Thief (similarity shortcuts, a pair the figure gives left out).

## Design decisions for review

- **The gate is Unit 6's own** (`unit6Build.ts` `finish6`), built like Unit 5's: a draw is refused when anything she
  can read before she answers shows a part's answer (the prompt, the figure's words and labels, hints, nudges, notes,
  witnesses, catalog titles, lessons and examples, rule cards), when **an answer equals a number the problem gives**
  (the trig lesson: copying a given must never be right), when a sentence is not English (every prompt, description,
  hint, nudge, worked line and witness), when a figure's labels would collide, or when a nonsense entry, a degree sign
  on a length, the other unit, or a calculator decimal gets a message that shows the answer. Refused draws are redrawn
  from the same seed.
- **Reserved values**: 0, 1, 23, 41, 67, 90, 180, and the texts 9/7, 7/9, 2√7 (the format hints' examples and the
  numbers the cards and lessons name). Catalog examples use j, k, l, m, n and words only; lessons have no digit but the
  180 of a straight angle; rule-card examples use J to N and only reserved numbers (`x = 23 and m∠J = (90 − x)° → 67°`).
- **Reading**: `GeoReadOptions.ratio` (answer.ts, off unless asked) reads `2:3`, `2 : 3`, `2 to 3` and `k = 2:3` as 2/3;
  a stage's `ratio` and `lengthUnit` fields (content/types.ts, additive) turn it on and strip `ft`/`feet`/`m`/`meters`
  in story parts. `assertGeoAnswer` now asks for a figure description only when the figure has points (a proportion
  stated in words has no figure; the pick path already worked this way).
- **Correspondence and position** (`gr.polygons`): the second polygon is the image of the first, so vertex i goes with
  vertex i; the statement lists the second polygon from a seeded start and direction. The drawing is accepted only when
  the side of the first polygon drawn in the same direction from its middle as each side of the second (and, for angle
  problems, each vertex) is never its partner, with a clear margin. A mirror image always leaves the side along its axis
  facing the same way, so only irregular shapes pass mirrored: about 9% of the figures are mirrored, the rest turned.
- **The angle case**: the first triangle labels two angles (no arcs, so no matching marks give the correspondence away);
  the second triangle's angle is `a·x°`, short enough to sit inside its angle; the third part asks for the angle the
  first triangle does not label, so no answer is a given number.
- **Which test** (`gt.prove`): the answer turns with the seed (SAS, none, AA, SSS), so any 300 seeds in a row show
  each answer exactly 75 times (25%; a shuffled run of four would give 76 on an unaligned window). The family, letters,
  shape and turn come from the seed's own draws. Arcs only ever mean congruent angles; numbered angles have no arc. SAS
  around a shared angle answers SAS (AA would first need the converse of the Triangle Proportionality Theorem).
- **Statements** (`gt.solve`): every choice writes the first triangle the same way, so exactly one is true and an
  equivalent rewriting is never offered as wrong; the true order is found from the drawn angles and checked by the
  independent re-solve from the given marks.
- **Not drawn to scale, on purpose**: the converse (D and E are placed apart from the answer, parallel-looking about
  half the time either way, so the picture never decides it) and the three parallel lines (each transversal keeps the
  true ratio of its pieces, but whole-number labels on two nearly vertical transversals cannot share one scale; nearly
  vertical, because GeoFigure puts a slanted segment's dimension line below it, where it would cross the parallels).
  Both prompts say "The figure is not drawn to scale." Every other figure is exact: labels are lengths at one scale,
  angles as labeled, arcs on equal angles, squares on right angles, arrows on parallels.
- **Dimension lines without changing GeoFigure**: a split side's pieces get dimension lines, which GeoFigure draws on
  the "below" side; split vertices sit at the bottom (or the top for a bisected base) and each split side keeps 16° from
  the vertical, so the dimension lines fall outside. Two arithmetic gaps in GeoFigure are worked around in the
  generators: a one-character dimension label (`x`, `4`) is padded with a space on each side, which SVG drops, so the
  gap GeoFigure leaves is wide enough; and each point's letter side is chosen before GeoFigure draws (clear of the
  lines, the dimension lines, the dots and the other labels), which GeoFigure then keeps. `GeoFigure.tsx` is unchanged.
- **Problem.tsx** needed no change: it already sends every geometry problem through `assertGeometryQuestion` to
  `GeometryFlow`; the six new question kinds are in that check (tutorContext.ts).

## Log

- [done] read CLAUDE.md, BUILD_GUIDE section 0, the roadmap, the Unit 1 to 5 logs with their reviews and the Unit 4
  rework, the optimization and trig-unit4b reviews; the geometry flow, GeoFigure and the Unit 5 layout copy, the
  reader, the grader, the Unit 5 gate and generators, the catalog, the species table.
- [done] contracts: 3 module ids and 18 ids (shared/types.ts), 6 question kinds and two stage fields
  (content/types.ts), the ratio reading (answer.ts), the Unit 6 ids, the ratio and unit reading and the figure
  description rule (grade.ts), 18 catalog entries, 18 species placements, the cards and `UNIT6_RULE_FOR`.
- [done] generators: `unit6Alg.ts` (exact rationals and linear algebra), `unit6Geom.ts` (exact shapes, turns, position
  matching), `unit6Build.ts` (the gate), `unit6Ratios.ts`, `unit6Similar.ts`, `unit6Parts.ts`; modules, Unit 6 on Home,
  the tutor's question check.
- Found while building: a prompt-free proportion tripped the shared "figure has no description" check; the check now
  asks only when there is a figure.
- Found while building: an angle label `(3x − 14)°` cannot fit inside a triangle drawn at half the width; the angle
  case writes `3x°`.
- Found while building: one-character labels on slanted dimension lines sat on their own line, short pieces had no room
  for their numbers, sides within 15° of the vertical put their dimension lines inside the triangle, and point letters
  landed on the dimension lines' end ticks; fixed as described above.
- Found while building: the SSA family's random draw rarely met the ambiguous case's conditions; it now picks among the
  side pairs that give two readable triangles.
- Found while building: the gate's whitespace-free example check read "N on" as "No" (an answer on the converse);
  card and catalog examples now say "between".
- [done] tests (below); the whole suite once, the build once.

## Not done

- No browser or device check (by instruction: no dev server, no browser). The figures were checked by GeoFigure's own
  layout, the generators' stricter copy, and rendering in jsdom; the places to look at on a phone are the two similar
  quadrilaterals side by side, the hourglass's crossing letter, and the shadow figure with a long tree shadow.
- Mirrored similar polygons are about 9% of the figures (see the decisions); more would need the position rule relaxed
  to the sides a problem uses.
- Angle-angle similarity from a story with the sun's angle given in degrees, and a person standing in a tree's shadow
  (nested shadow triangles), are not asked.
- Area ratios of similar figures (Jurgensen 11-x) are not asked; the squared scale factor appears only as the slip.
- The Progress page lists the Unit 6 mistakes with the others.

## Verification

All on 2026-10-22 in `C:\work\geo6`, on the final code.

- `npm run typecheck` (the app, node and server configs): exit 0.
- The whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=4`, once on the final code: 317 files,
  5,170 tests, all passed (916 s).
- `vite build --outDir C:\work\geo6\.tmp-dist`: built in 15.6 s, the folder deleted afterwards. Its one warning is the
  existing one about the main chunk (3,235 kB against the 1,500 kB limit); the Problem chunk is 422 kB.
- What the new tests cover:
  - `geometry.unit6.test.ts`: each template over 300 seeds is deterministic, serializable, validates its own answers,
    keeps its promised trap a real candidate graded as itself, garbage is not an attempt, no answer is on screen (prompt,
    figure words and labels, hints, nudges, notes) or in a witness, no answer is reserved or equals a given number, no
    choice text is in a prompt, every text reads as English; every new id is a candidate and has a catalog entry in the
    voice (✗ and →, no digits but 180); every slip the brief names is promised somewhere; the 2000-seed sweep of
    catalog examples, lessons, witnesses, hints and rule cards (examples, results, bodies) against every part's answer;
    hints and examples do not reuse seed 1's numbers; every part's card and every slip's card is in its module; ten or
    more values of x per numeric template, none over a fifth; each which-test answer 12-25% in five windows of 300
    seeds, all fourteen families; every case and property form; no I, O, J, K, L, M, N, X; position never gives the
    correspondence, some copies mirrored; the converse figure looks parallel about as often either way; a ratio in
    every spelling, a story's length with its unit; one right button, one true statement.
  - `geometry.unit6.solve.test.ts`: the independent re-solve from the words and the figure (its own parsers, algebra and
    reading of marks; no generator code): one solution with every length positive; the polygons' correspondence from the
    statement, drawn similar and to one scale; the which-test answer as the one test the given marks prove (arcs,
    squares, numbers with the angle sum, shared and vertical angles, parallel arrows and words), never two; the true
    statement as the only correspondence the given angles allow (through the large triangle for the altitude);
    triangle inequalities, angle sums, honest marks. 600 seeds per template in the suite; 2000 per template passed
    (`GEO6_SEEDS=2000`, 12,000 problems).
  - `geometry.unit6.hand.test.ts`: 24 problems worked by hand.
  - `GeoFigure.unit6.test.tsx`: GeoFigure's own layout check and the stricter Unit 6 check over 300 seeds per template;
    the generators' copy agrees with the component and the rendered segment labels; every figure renders, every mark on
    a point, a dimension line for every piece.
  - `GeometryFlow.unit6.test.tsx`: per template, the promised slip named (title, lesson, example) and recorded once,
    the fix, completion with the worked lines; an unreadable answer records nothing; a reload restores her entries; plus
    a scale factor typed 2:5, a story length with ft and the other unit as a note, the four method buttons with SSA
    named, a statement matched by position, the converse, the third hint, and a degree sign on an angle only.
  - `tutorContext.test.ts` (the six kinds, a words-only proportion, the statement she picked), `answer.test.ts` (ratio
    reading), `courses.test.ts`, `generators.test.ts` (48 modules), `Home.test.tsx` (Unit 6 first, its three titles).

## Files

New, the content (`src/content/modules/geometry/`): `unit6Alg.ts`, `unit6Geom.ts`, `unit6Build.ts`, `unit6Rules.ts`,
`unit6Ratios.ts` (gr.proportion, gr.polygons), `unit6Similar.ts` (gt.prove, gt.solve), `unit6Parts.ts` (gp.splitter,
gp.bisector); tests `geometry.unit6.test.ts`, `geometry.unit6.solve.test.ts`, `geometry.unit6.hand.test.ts`.

New, the screen tests: `src/components/GeoFigure.unit6.test.tsx`, `src/pages/flows/GeometryFlow.unit6.test.tsx`.

Changed: `src/shared/types.ts`, `src/content/types.ts`, `src/content/modules/geometry/{answer,grade,rules,index}.ts`,
`src/engine/matchers/catalog.ts` (geo_ entries only), `src/components/monsters/species.ts`, `src/content/courses.ts`,
`src/problem/tutorContext.ts`, `docs/roadmap.md`. Tests changed: `answer.test.ts`, `courses.test.ts`,
`generators.test.ts`, `Home.test.tsx`, `tutorContext.test.ts`.

## Fixed-seed traps

`#/p/<module>/<template>/<seed>`, the seed in base 36; each is the seed's promised slip, graded as its id.

- `#/p/geoRatios/gr.proportion/4`: 10/16 = 5/x; x as 32 (10 · 16 = 5x) is `geo_cross_multiplied_wrong` (the answer
  is 8).
- `#/p/geoRatios/gr.polygons/2`: △BAZ ~ △HQP; x as 32 (PH paired with BA, the side drawn in its place) is
  `geo_matched_by_position` (the answers are 4/3, 20, 24).
- `#/p/geoSimilarTriangles/gt.prove/e`: two proportional sides and the angle across from one; the SAS Similarity
  Theorem is `geo_ssa_as_similarity` (the answer is Not enough information).
- `#/p/geoSimilarTriangles/gt.solve/m`: ∠GYT ≅ ∠GPU; △GYT ~ △GUP (Y paired with U because Y lies on GU) is
  `geo_matched_by_position` (the answers are △GYT ~ △GPU, then x = 7).
- `#/p/geoProportionalParts/gp.splitter/1`: GQ ∥ VS; x as 52 (FG/GV = FQ/FS) is `geo_part_over_whole` (the answers
  are 4, then FQ = 12).
- `#/p/geoProportionalParts/gp.bisector/4`: SB bisects ∠GSZ; x as 45/2 (GB/BZ = SZ/SG) is
  `geo_bisector_ratio_swapped` (the answer is 10).

## Review (Claude, 2026-10-22)

Built by one Claude agent (about 0.94M tokens, 2 h 13 min). Checked:
- 30 sample problems by hand, five per template: every proportion, scale factor, missing side, angle and perimeter;
  the AA, SSS, SAS and "Not enough information" answers from the marks shown (including crossing segments drawn to look
  parallel but not marked, which is correctly not enough); the shadow and mirror heights; the splitter and its
  converse; the angle-bisector and three-parallel-lines ratios. All right.
- On the Android emulator in a store-app build: similar triangles drawn turned (the correspondence comes from the
  letters), the shadow and mirror scenes, three parallel lines with every length on its own dimension line, the
  splitter's parts, the choice screens.

Changed in review: in the shadow problems the object's shadow length was left to the label placer, which tries every
side (all above first) and keeps the first clean layout; it often sat above the ground, inside the triangle, as close
to the sun's ray as to the shadow, while the person's shadow had a dimension line. Both shadows are now forced onto
dimension lines below the ground (as the mirror's distances are); a test checks every shadow figure over 300 seeds.

Left: the crossing-segments "not enough" figures are drawn so the sides look parallel (textbook practice: the marks,
not the look, decide); mirrored polygon figures are rare (9%), by design.
