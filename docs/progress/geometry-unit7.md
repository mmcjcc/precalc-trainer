# Honors Geometry, Unit 7, first half (right triangles)

Course `geometry`, unit `g7`, title "Right triangles" (Jurgensen chapter 8, sections 8-1 to 8-4), after Unit 6. Three
modules on the existing geometry screen (`GeometryFlow`): parts one at a time, three hint rungs (the last marks the
answer as shown), entries kept across a reload, and the figure on screen before she answers. Built on branch
`geometry-unit7` in `C:\work\geo7` (outside OneDrive); uncommitted for review. Units 1 to 6 are unchanged. The second
half of the chapter (the tangent, sine and cosine ratios, elevation and depression) comes in a later build.

## Why

Her honors geometry course moves from similarity to right triangles: the geometric mean and the altitude to the
hypotenuse, the Pythagorean Theorem and its converse, and the special right triangles. Every problem names the specific
slip when she is wrong, and every slip is a monster in her collection.

## What she gets

- `geoRightSimilar` (order 24), "Similarity in right triangles":
  - `rs.mean` "The geometric mean": `Find the geometric mean of 3 and 15.` (3√5; a whole number when the product is a
    square), or `The geometric mean of 8 and x is 4√14. Find x.` (the mean a whole number or a radical).
  - `rs.altitude` "The altitude to the hypotenuse": right triangle ABC (right angle at C) with the altitude CD. Two of the
    six lengths are given (the two segments; a segment and the altitude; a segment and the leg next to it; a segment and
    the hypotenuse; a leg and the hypotenuse), given lengths whole numbers or radicals, and one or two others are asked
    as x and y, exactly. Sometimes a length is an expression in x: the altitude (`CD = 2x − 2`), a segment
    (`AD = x − 3`, asked first as AD, then x), a leg (`AC = x + 14`), or both segments (`AD = x`, `DB = x + 7`, solved
    as a quadratic), with a leg as y sometimes after x.
- `geoPythagorean` (order 25), "The Pythagorean Theorem and its converse":
  - `py.side` "Finding a missing side": a leg or the hypotenuse of a right triangle (twelve Pythagorean triples and their
    multiples, whole legs that leave a radical, a leg given as a radical like 2√3), in simplest radical form; inside a
    rectangle (the diagonal, or a side from the diagonal), an isosceles triangle (the altitude to the base, a leg, or the
    base), a rhombus (a side from the diagonals, or a diagonal from a side and the other diagonal), and the distance
    between two points on the grid.
  - `py.classify` "Acute, right, or obtuse": `Can segments with lengths 16, 20, and 12 form a triangle? If they can,
    classify the triangle by its angles.` Buttons: Acute, Right, Obtuse, Not a triangle. The longest length is listed
    anywhere; a length is sometimes a radical (4, 6, 2√13; √7, 3, 4).
  - `py.apply` "Pythagorean word problems": a ladder against a wall (its height, its length, or how far its foot is), a
    television or computer screen's diagonal or height, a ramp's length or run, a path across a rectangular field (or
    its width), a kite string (its height or length), and a ship's course (how far from the start, or how far it sailed
    one way), each rounded to the nearest whole unit, tenth or hundredth as the problem asks, in feet, inches, meters,
    yards, kilometers or miles.
- `geoSpecialRight` (order 26), "Special right triangles":
  - `sp.special` "Sides of the special triangles": a 45°-45°-90° triangle from a leg or the hypotenuse; a 30°-60°-90°
    triangle from any side (one or two sides asked, the 30° or the 60° angle marked); a square's diagonal or side; an
    equilateral triangle's altitude or side; a rectangle whose diagonal makes 30° with a side (one or two sides asked);
    a rhombus with a 60° angle (the longer diagonal from a side or the shorter diagonal, or a side from the longer
    diagonal); an isosceles right triangle's legs from its hypotenuse. A given side is a whole number or a whole number
    times √2 or √3; every answer exact.

Exact parts take every equal form (`3√5`, `3sqrt(5)`, `3*sqrt(5)`, `x = 3√5`, `9/2` or `4.5`); `√45` or `6√5/2` is a note
that asks for simplest form, and a calculator decimal a note that asks for the exact value. Rounded parts take the
rounded decimal with or without its unit (`16.2`, `16.2 ft`, `16.2 feet`), and more places when they round to it or are
the true length rounded at her own place; fewer places ("rounded too far"), the exact radical ("use a calculator"), or
another unit is a note. A note never counts as an attempt.

## Named mistakes

New `geo_` ids, each appended at the end of its species' variants:

| id | the slip | species |
|---|---|---|
| `geo_leg_far_segment` | a leg as the geometric mean of the hypotenuse and the segment at the far end | The Mismeasurer |
| `geo_altitude_leg_mixed` | the altitude as the mean of a leg and a segment, or a leg as the mean of the two segments | The Mismeasurer |
| `geo_half_not_taken` | the whole base, diagonal or side where the right triangle inside has half of it | The Mismeasurer |
| `geo_converse_wrong_side` | the converse with the last-listed length as c when it is not the longest (always reads acute) | The Shape Faker |
| `geo_triangle_inequality_skipped` | acute, right or obtuse picked for lengths that make no triangle | The Shape Faker |
| `geo_acute_obtuse_swapped` | c² against a² + b² read the wrong way | The Shape Faker |
| `geo_coefficient_not_squared` | (k√m)² taken as k · m (in a mean, a side, or a classification) | The Power Grabber |

Family lines widened: the Mismeasurer (the geometric means of a right triangle, half a length inside a figure), the
Shape Faker (now "Shape slips", with what kind of triangle three lengths make), the Power Grabber (a radical squared
without the number in front).

Reused: `geo_geometric_as_arithmetic` and `geo_mean_not_rooted` (Unit 6), `geo_answered_x`, `geo_part_equals_whole`,
`geo_half_for_whole`, `geo_distance_not_squared`, `geo_distance_no_root` (Unit 1), and from the precalculus
right-triangle core `trig_pythag_added` (the hypotenuse squared and added for a leg), `trig_pythag_subtracted` (a leg
used as the hypotenuse), `trig_side_not_rooted` (c² given as c), `trig_special_root3_two_swapped` (the 30°-60°-90°
factors swapped), `trig_special_45_two` (the 45°-45°-90° hypotenuse as twice a leg), `trig_special_wrong_way`,
`trig_special_legs_swapped`. The borrowed trig ids keep their catalog entries and monsters; geometry grades them through
`GEO_BORROWED_TRIG_IDS` in grade.ts. A radical left unsimplified is a note, never a mistake.

## Design decisions for review

- **Reuse of the precalculus core**: the third side and its slips are `hypotenuseOf`, `legOf`, `hypotenuseSlips`,
  `legSlips`, and the special triangles `specialSide`, `specialSlips` from `@/engine/trig`, converted to and from the
  geometry reader's quantity (`fromTrig`, `toTrig` in unit7Build.ts). Their witnesses are used as written except one
  word: the core writes "In a 45°-45°-90° triangle", which the English check (and Jurgensen) reads as an article before
  a number, so `coreWords` turns that "a" into "the". `src/engine/trig` is unchanged.
- **Borrowed ids in geometry**: `isGeoMistake` and `GeoMistakeId` now include the seven trig ids. No Unit 1 to 6 problem
  has a trig trap, so nothing there changes.
- **A radical binds its number** (`exposedExact` in grade.ts, used by `assertGeoAnswer` for the Unit 7 question kinds
  only, and by the Unit 7 gate): a side of 6√2 does not show a leg of 6 (the classic 45°-45°-90° problem), √3 on a card
  does not show 3, 6.5 does not show 6. Units 1 to 6 keep `exposed`, so their accepted seeds are unchanged.
- **The gate** (`finish7` in unit7Build.ts) is Unit 6's, held to Unit 7's rules: no answer on screen (prompt, figure,
  hints, nudges), in a witness, in a catalog entry for a slip on that part, in a rule card's example or result, or in a
  numeric card body; no answer reserved (0, 1, 43, 43.7, 43.71, 90, 180, 3√11, (3√11)/2, the format hints' examples);
  **no answer, exact or rounded, equal to a number or radical the problem gives** (the 13-foot ramp); a worked line
  never shows a later part's answer; every retry note (nonsense, a degree sign, a decimal, an unsimplified radical,
  fewer places, the exact radical, another unit) never shows this part's answer or a later one (it may quote what she
  typed, which can hold an earlier part's answer); every text English, including "1 feet" and "4 foot"; every figure
  clear. A refused draw is redrawn from the same seed.
- **Labels** (`placeLabels7`): a piece of a longer segment (the hypotenuse's two segments) always gets its own dimension
  line, outside the triangle; a side of a triangle gets its one outside place (beside it when GeoFigure's "above" points
  out of the figure, otherwise a dimension line); a segment inside the figure (the altitude, a rectangle's diagonal)
  tries beside it, then a dimension line. On top of Unit 6's check, every segment label must be nearer its own segment
  than any other by 10 px (6 px on a dimension line, whose end ticks tie it to its segment), so no label sits between
  two lines. `GeoFigure.tsx` is unchanged.
- **What the figure does not label**: the hypotenuse AB of the altitude problems (its two segments carry the dimension
  lines; a given AB is in the prompt only), an isosceles triangle's base (a label at its middle is exactly as near the
  foot of the altitude as the base itself; the base is in the prompt), a rhombus's diagonals (their middles are the
  crossing point; the diagonals are in the prompt), and a side asked for without a letter (part labeled by its name, as
  "BD" or "PQ"). The asked side is labeled x, y or "?" only, never a number.
- **The altitude figure's turn**: GeoFigure draws a dimension line below a segment (to its right when the segment stands
  upright), so the hypotenuse's pieces are outside only when the right angle is above the hypotenuse or to its left.
  The figure turns between −22° and 100° and is mirrored half the time: the right angle sits in three of the four
  directions from the middle (never bottom right). Every other figure turns all the way round and mirrors; story
  scenes keep walls upright and mirror, and the ship's course follows its compass directions.
- **Story figures carry numbers without units**: a label as wide as "150 ft" cannot sit beside an upright side without
  touching it; the prompt gives the unit.
- **Coordinates to six decimals**: three decimals put a small figure's right angle up to 0.03° off; the re-solve holds
  every right-angle mark to 0.02°.
- **The converse**: buttons Acute, Right, Obtuse, Not a triangle (kept in that order). The answer class comes from the
  seed (each a quarter; over any 300 seeds in a row each is 15-35%). A right triangle listed with its hypotenuse last
  leaves no slip to name (only the last length taken as c gives one), so its hypotenuse moves earlier in the list; the
  longest is otherwise anywhere. Where two slips give the same pick, the coefficient slip names it first, then the wrong
  side, then the swap. The three converse lessons, and the coefficient lesson, never name a kind of triangle (a "square
  corner" stands in), because they can be shown where the answer is one; the prompt never says acute, right, obtuse or
  "not a triangle".
- **Rounding** (`round` and `exact` on a stage, content/types.ts, additive; `gradeRounded` in grade.ts): halves away from
  zero; draws whose length (or a slip's) sits within 0.0001 of a rounding boundary are redrawn. A slip is named on its
  rounded value. More inches, yards, kilometers and miles join feet and meters as length units (additive; the feet and
  meters messages are unchanged).
- **x = 4 never carries the answered-x slip**: the Unit 1 catalog example for `geo_answered_x` is "4 ✗ → 33", so the
  gate refuses x = 4 (and 33) with that slip. The hand test uses x(x + 7) = 144 instead of x(x + 5) = 36.
- **Problem.tsx** needed no change: it already sends every geometry problem through `assertGeometryQuestion` to
  `GeometryFlow`; the six new kinds are in that check (tutorContext.ts).

## Log

- [done] read CLAUDE.md, BUILD_GUIDE section 0, the roadmap, the Unit 5 and 6 logs with their reviews, the Unit 4
  rework, the trig-unit4b log; the geometry flow, the reader and grader, the Unit 5 layout copy and Unit 6 gate, the
  trig core's triangle.ts and special.ts, the catalog, the species table, the count tests.
- [done] contracts: 3 module ids and 7 ids (shared/types.ts); 6 question kinds, `round`, `exact` and more length units
  (content/types.ts); the Unit 7 and borrowed ids, rounding, the length units and `exposedExact` (grade.ts); 7 catalog
  entries; 7 species placements; rule cards and `UNIT7_RULE_FOR`.
- [done] generators: `unit7Build.ts` (the gate, parts, labels, figure checks), `unit7Mean.ts`, `unit7Pyth.ts`,
  `unit7Special.ts`; modules, Unit 7 on Home, the tutor's question check.
- Found while building: the isosceles figure failed every draw: the base's label (at its middle) is exactly as near the
  altitude's foot as the base. The base moved to the prompt.
- Found while building: the core's witnesses ("In a 45°-45°-90° triangle") and the first aria labels ("a 45° angle")
  failed the English check; `coreWords` and "an angle of 45°".
- Found while building: a card example that said "the right triangle" blocked every right answer of the converse; the
  rule-card examples of that module never name a kind of triangle.
- Found while building: worked lines that repeated themselves ("√181 = √181", "3/2 = 3/2"), "8/4√14" without
  parentheses, a missing "First VQ = 28 − 8 = 20" step; fixed with `rootSay`, `halfOf` and parentheses.
- Found by the tests: 29.950 typed for a length of 29.94997 (right to the thousandth) graded wrong because it rounds to
  30.0 at the tenth; more places are now right when they are the true length rounded at her own place.
- Found by the re-solve: right-angle marks up to 0.026° off on small figures (coordinates to three decimals); six now.
- [done] tests (below); typecheck; the whole suite once; the build once.

## Not done

- No browser or device check (by instruction: no dev server, no browser). The figures were checked by GeoFigure's own
  layout, the stricter copy, the nearest-segment rule, and rendering in jsdom; a scratch rasterizer of the layout copy
  showed a sample of each template. Places to look at on a phone: three-digit story labels beside an upright side (the
  label sits 1-3 px from the line, as GeoFigure places it), the rhombus's crossing letter, the altitude's label between
  two thin sub-triangles.
- The altitude problems never put the right angle at the bottom right (see the decisions).
- Not asked: the hypotenuse of the altitude problems as a whole (AB is only given), a segment from the far leg (a
  quadratic), the two legs given; a "how much shorter is the path" second part; decimal side lengths in the converse.
- The second half of the chapter (trig ratios, elevation and depression).

## Verification

All on 2026-10-22 in `C:\work\geo7`, on the final code.

- `npm run typecheck` (the app, node and server configs): exit 0.
- The whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=3`, once on the final code: 354 files,
  6,186 tests, all passed (1,736 s).
- `vite build --outDir C:\work\geo7\.tmp-dist`: built in 18.1 s, the folder deleted afterwards. Its one warning is the
  existing one about the main chunk (3,556 kB against the 1,500 kB limit); the Problem chunk is 437 kB.
- What the new tests cover:
  - `geometry.unit7.test.ts`: the radical-binding reader; registration; seed 1's promised slips; per template over 300
    seeds: deterministic, serializable, answers grade, the promised trap a real candidate graded as itself, garbage not
    an attempt, nothing she reads before answering (prompt, figure words and labels, hints, nudges) shows an answer, a
    worked line never shows a later answer, every witness and text English, no button text in a prompt; no answer
    reserved, zero or less, or a given number or radical (rounded answers included); retry notes never show an answer;
    every new id a real candidate with a catalog entry in the voice (no digit; the converse ones never name a kind);
    every slip the brief names promised on some seed; the 2000-seed sweep of catalog entries, witnesses, hints and rule
    cards (examples, results, bodies) against every part's answer; hints and examples not reusing seed 1's numbers;
    every part's card and every slip's card in its module; the cards named as the book names the theorems; at least 25
    distinct problems per template and no answer (whole or per part) above a tenth; each converse answer 15-35% in four
    windows of 300 seeds; every case; no I, O, J, K, L, M, N, X; the right angle in every direction and both
    orientations (three directions for the altitude); every equal exact form right, unsimplified radicals and decimals
    notes; rounded answers, more places, fewer places, the exact radical, units.
  - `geometry.unit7.solve.test.ts`: the independent re-solve from the words and the figure (its own parsers; a grid
    search and Newton's method for the altitude triangle from any two lengths, x from its expression or a quadratic;
    the Pythagorean Theorem for each figure; exact squares for the converse; each story read word by word; the special
    triangles by the sines of their angles), with real triangles (positive lengths, the Triangle Inequality), every
    right-angle mark at 90°, every labeled angle as labeled, figures to scale, every given label on the segment the words
    name, the asked side labeled with its letter. 300 seeds per template in the suite; 2000 per template passed
    (`GEO7_SEEDS=2000`, 12,000 problems).
  - `geometry.unit7.hand.test.ts`: 17 tests worked by hand, among them the brief's: the geometric mean of 4 and 9 is 6
    and of 3 and 15 is 3√5; with segments 4 and 9 the altitude is 6 and the legs 2√13 and 3√13; legs 5 and 12 give 13;
    7, 24, 25 right; 4, 5, 6 acute; 4, 5, 7 obtuse; 3, 4, 8 no triangle; a square of side 6 has diagonal 6√2; an
    equilateral triangle of side 10 has altitude 5√3; a 30°-60°-90° triangle with hypotenuse 14 has legs 7 and 7√3.
  - `GeoFigure.unit7.test.tsx`: GeoFigure's own layout and the stricter check over 300 seeds per figured template;
    each segment label nearer its own segment than any other; a side's label outside its triangle; the copy agrees with
    the component and the rendered labels; pieces of the hypotenuse on dimension lines; every label a given or a letter.
  - `GeometryFlow.unit7.test.tsx`: per template, the promised slip named (title, lesson, example) and recorded once, the
    fix, completion with the worked lines, the chunky Check button; an unreadable answer records nothing; a reload
    restores her entries; a rounded length's notes; an unsimplified radical's note; the four buttons; the Triangle
    Inequality slip; a two-part altitude problem with the far segment named; the third hint.
  - `tutorContext.test.ts` (the six kinds, a picked kind of triangle, a length typed with its unit), `courses.test.ts`,
    `generators.test.ts` (54 modules), `Home.test.tsx` (Unit 7 first, its three titles).

## Files

New, the content (`src/content/modules/geometry/`): `unit7Build.ts`, `unit7Rules.ts`, `unit7Mean.ts` (rs.mean,
rs.altitude), `unit7Pyth.ts` (py.side, py.classify, py.apply), `unit7Special.ts` (sp.special); tests
`geometry.unit7.test.ts`, `geometry.unit7.solve.test.ts`, `geometry.unit7.hand.test.ts`.

New, the screen tests: `src/components/GeoFigure.unit7.test.tsx`, `src/pages/flows/GeometryFlow.unit7.test.tsx`.

Changed: `src/shared/types.ts`, `src/content/types.ts`, `src/content/modules/geometry/{grade,rules,index}.ts`,
`src/engine/matchers/catalog.ts` (geo_ entries only), `src/components/monsters/species.ts`, `src/content/courses.ts`,
`src/problem/tutorContext.ts`, `docs/roadmap.md`. Tests changed: `courses.test.ts`, `generators.test.ts`,
`Home.test.tsx`, `tutorContext.test.ts`.

## Fixed-seed traps

`#/p/<module>/<template>/<seed>`, the seed in base 36; each is the seed's promised slip, graded as its id.

- `#/p/geoRightSimilar/rs.mean/3`: the geometric mean of 8 and x is 4√14; x as 7 ((4√14)² taken as 4 · 14) is
  `geo_coefficient_not_squared` (the answer is 28).
- `#/p/geoRightSimilar/rs.altitude/3`: VU = 7, UF = 28, AU = 2x − 4; y = FA as 7√5 (FA paired with VU, the far segment)
  is `geo_leg_far_segment` (the answers are x = 9, y = 14√5).
- `#/p/geoPythagorean/py.side/e`: the diagonals of rhombus TDEZ are 20 and 18; the side as 2√181 (the whole diagonals as
  legs) is `geo_half_not_taken` (the answer is √181).
- `#/p/geoPythagorean/py.classify/1`: lengths 16, 20, 12; Acute (12, the last listed, taken as c) is
  `geo_converse_wrong_side` (the answer is Right).
- `#/p/geoPythagorean/py.apply/2`: a path 83 m long across a field 74 m long; the width as 111.2 (the squares added) is
  `trig_pythag_added` (the answer is 37.6 m).
- `#/p/geoSpecialRight/sp.special/a`: a 30°-60°-90° triangle with m∠V = 60 and QW = 20; VW as 10 (the longer leg halved,
  the factors swapped) is `trig_special_root3_two_swapped` (the answer is (20√3)/3).

## Review (Claude, 2026-10-22)

Built by one Claude agent (2 h 35 min, 315 tool calls). Checked:
- Eighteen sample problems by hand (three per template): geometric means (9 and 25 → 15; 10 and 16 → 4√10; 21 and x with
  mean 6√7 → 12), the altitude relations (RH = 2, HF = 8, UH = 2x − 2 → x = 3 and FU = 4√5; DZ = 5, ZW = 4 → WV = 6;
  SE = x − 3, EU = 24, VE = 12 → SE = 6, x = 9), missing sides (28, 53 → 45; 10, 4 → 2√29; a rhombus with side 34 and a
  diagonal 60 → 32), the converse (16, 19, 24 acute; 5√6, 22, 25 acute; 12, 35, 37 right), word problems (37.6 m,
  17.49 in, 10.8 ft) and special triangles (4√2, 3√2, 6√3). All right.
- On the Android emulator (store build): the altitude figure (hypotenuse segments on their own dimension lines, both
  right-angle marks, the expression on the altitude), a rhombus drawn to scale with the right angle at W, a ladder
  scene with dimension lines, and a turned 30°-60°-90° triangle with the given side and the 60° mark only.
No changes in review.
