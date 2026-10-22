# Precalculus Unit 4, second half: right triangles, the special triangles, and the reverse unit-circle problems

Course `precalc`, unit `unit4` ("Unit 4", "Trigonometric functions"). Built by one Claude agent on branch
`precalc-trig2` in `C:\work\trig2` (outside OneDrive), uncommitted for review. It builds on the first half
(`docs/progress/trig-unit4a.md`): the same exact core (`src/engine/trig`), reader, grader, parts flow (`TrigFlow`) and
figure (`TrigFigure`), extended, not forked.

## Why

The honors precalculus class (AP Calculus AB preparation, TI-84 required) is starting trigonometry, and the app needs
the whole year before it is published. This is the second half of Unit 4: right triangle trigonometry, the special
right triangles, and the reverse unit-circle problems (a value and the quadrant; every angle with a value).

## What she gets

A new module and two new templates in the unit-circle module, six templates in all, every problem drawn from the seed
(the triangle's sides, the angle, which ratios, the story and its numbers, the quadrant, the function and its value),
checked by the trig core, with a figure on every problem.

- `rightTriangle`, "Right triangle trigonometry" (order 5.9935, between `angleMeasure` and `unitCircle`):
  - `rt.ratios`: two sides of a right triangle, whole numbers (a Pythagorean triple, or small numbers that leave a
    radical: legs 2 and 3 give √13); the third side first, then one, two or three of the six ratios of the marked angle
    θ, exactly and rationalized. θ sits at the bottom corner or at the top, so "opposite" is sometimes the bottom leg.
    The figure labels the two sides she is given; the third side gets its length only once she has found it.
  - `rt.special`: one side of a 45°-45°-90° or 30°-60°-90° triangle, a whole number or a radical (4√3, 6√2, 5√2…);
    the other sides as x and y, in parts. Every side can be the one given, the hypotenuse included (a leg asked from it).
    A 45°-45°-90° problem has one part (the hypotenuse from a leg, or each leg from the hypotenuse: both legs are x).
  - `rt.side`: a missing side from an acute angle in degrees and one side, rounded to the nearest whole unit, tenth or
    hundredth, in DEGREE mode. A plain triangle (35%) or a word problem: a ladder against a wall, a ramp, a kite on a
    staked string, a lighthouse and a boat (an angle of depression), a tree and its shadow, each with the pairs of sides
    a textbook asks about and real sizes. The figure draws the scene, the side she knows with its unit, the angle, and x.
  - `rt.angle`: an acute angle from two sides with sin⁻¹, cos⁻¹ or tan⁻¹ (2nd SIN, 2nd COS, 2nd TAN), to the nearest
    tenth of a degree; plain triangles and the same stories (the lighthouse asks for the angle of depression). The angle
    is θ in the figure, never its measure.
- `unitCircle` (same module, same flow), two templates added:
  - `uc.given`: one function's value and where θ is: a quadrant ("θ is in Quadrant III"), an interval
    ("π/2 < θ < π", "180° < θ < 270°"), or another function's sign ("sin θ = 5/13 and cos θ < 0"). The point is read
    off the value the textbook's way and the prompt says so ("For the point on the terminal side with y = 5 and r = 13,
    find x"; for tan and cot "with |x| = 4 and |y| = 3", then r). Then one, two or three other functions, exactly. The
    missing coordinate may be a radical (sin θ = 2/3 in Quadrant II: x = −√5).
  - `uc.solve`: every angle in [0°, 360°) or [0, 2π) where sin, cos, tan, csc, sec or cot has a special value
    (sin θ = −√3/2, tan θ = 1, cos θ = 0, csc θ = 2, sec θ = −√2), in the unit asked, typed as a list in any order
    ("240, 300", "7π/6, 11π/6", "{240°, 300°}", "θ = 240 or θ = 300"). Usually two answers, sometimes one
    (sin θ = −1, cos θ = −1, csc θ = 1…).

The screen is the first half's `TrigFlow` (kind `rightTriangle` added, `RightTriangleFlow`): parts one at a time, three
hint rungs per part (the nudge, the rule card, the worked lines, which mark the answer shown), entries and the part she
is on survive a reload, a named mistake shows the catalog title, lesson, the sentence about her own answer and the
wrong → right example, a check that does not count says so and logs nothing, and a list of angles reads back in KaTeX
with its commas. The calculator panel (behind its button, as everywhere): MODE to DEGREE first for sides, angles and
the special triangles; the keys (`20 × SIN( 70 )`, `2nd TAN (TAN⁻¹) 12 ÷ 16 )`, `2nd COS (COS⁻¹) (−) 1 ÷ 2 )`); the
decimal check of an exact answer (without a word about π where the answer has none); for uc.solve, the mode of the
unit asked, the one angle the calculator gives and what its range is, and each of her angles checked; TI-Nspire steps
as well. The keypad: the trig set; a list's comma is the grid's own key.

## Design decisions for review

- **The core grows in `@/engine/trig`**: `triangle.ts` (the third side, the six ratios of an acute angle, their slips),
  `special.ts` (every side of a special triangle from every other, by a factor; the slips are the factors used
  instead), `inverse.ts` (sides and angles on the calculator, in DEGREE mode, with each slip's number before rounding),
  `given.ts` (the point for a value and a quadrant; the coordinate, r and value slips), `solve.ts` (the solution set
  from the hand table of special angles, exactly; the slip lists; a list reader and a list grader). The first half's
  files are unchanged except `index.ts` (exports) and `types.ts` (ids).
- **18 new trig_ ids** (shared/types.ts, the core's `TRIG_MISTAKE_IDS`, the catalog in words with no number but 90,
  180 and 360, so no example can be an answer): from the brief `trig_opposite_adjacent_swapped`,
  `trig_hypotenuse_as_leg`, `trig_pythag_added`, `trig_special_root3_two_swapped`, `trig_special_45_two`,
  `trig_special_wrong_way`, `trig_depression_from_vertical`, `trig_radian_mode`, `trig_ratio_for_angle`,
  `trig_coordinate_sign`, `trig_solve_reference_only`, `trig_solve_one_answer`, `trig_solve_out_of_range`,
  `trig_solve_wrong_sign_quadrant`. Added from the work: `trig_pythag_subtracted` (two legs, the squares subtracted),
  `trig_side_not_rooted` (the square of the side left as the side), `trig_special_legs_swapped` (the short and long legs
  swapped: twice the long leg for the hypotenuse), `trig_r_negative` (r given the quadrant's sign). Reused from the first
  half: `trig_sign_quadrant`, `trig_sin_cos_swapped`, `trig_tan_inverted`, `trig_reciprocal_missing`,
  `trig_reciprocal_mixed`, `trig_r_left_out`, `trig_r_not_rooted`, `trig_pi_dropped`.
- **Where two slips give the same number, one id names it** (the earlier in each list):
  - ratios: for sin, cos and tan the other acute angle's ratio is `opposite_adjacent_swapped`; a ratio with the
    hypotenuse on top, or a leg in its place (sin as opposite/adjacent, tan as opposite/hypotenuse), is
    `hypotenuse_as_leg`; for csc and sec the crossed pair is `reciprocal_mixed` and the base function
    `reciprocal_missing`; for cot, tan θ is `reciprocal_missing`.
  - sides: the ratio upside down (dividing where she multiplies) is `hypotenuse_as_leg` for sin and cos; for tan, the
    legs the other way round is `opposite_adjacent_swapped` and a leg taken for the hypotenuse `hypotenuse_as_leg`. On
    an angle of depression the other acute angle's ratio is `depression_from_vertical` instead of the swap.
  - angles: RADIAN mode first, then SIN for 2nd SIN, then the ratio itself (both `ratio_for_angle`), then the other
    acute angle; at the rounding asked, a later slip that rounds like an earlier one is left out.
- **The leak matcher for the new templates** (`trig/text.ts` `showsNumber`): the first half's whole-token match with √
  and π bound to the number they touch, so a side given as 6√2 does not "show" a leg of 6, √3 on a card does not show
  a side of 3, and 5π/6 does not show π/6; 6√2 itself, −12 in "(−12, 5)", 240 in "240°" and an answer ending a sentence
  still count. Without it every special triangle given as k√2 or k√3 is turned away (the brief's 4√3 and 6√2 among
  them). The first half's templates keep their matcher (`assertTrigProblem` and `trigLeaks` take it as an optional
  argument; their behaviour is unchanged).
- **The figure is checked too, part by part** (`trig/parts.ts` `figureTextsAt`): the labels the figure draws while
  each part is open (a found side's length and a uc.given point only after their part) against that part's answer and
  every later one.
- **The unit circle's special-angles card is reworded in words** ("the right triangle with angles of thirty and sixty
  degrees"): uc.solve's answers include 30°, 45°, 60° and 90°, which the card used to write as digits. Its meaning is
  unchanged. Two cards added (`uc-given`, `uc-solve`); the hints moved to `unitCircle/hints.ts` (same texts) with three
  new ones, none with a digit or a π of its own (π is an answer in radians).
- **uc.solve leaves out values whose answers include θ = 0** (sin θ = 0, tan θ = 0, cos θ = 1, sec θ = 1): the range
  "[0°, 360°)" itself would read as showing the answer 0, and sin θ = 0 writes 0 in the prompt. Everything else of the
  brief is there, the axis values with one answer included.
- **A list is graded as a set** (`gradeAngleList`): the same angles in any order are right. Named: a slip's whole list
  exactly (the reference angle alone; the angles of the other sign; the calculator's angle kept, −60° for sin, ±120° for
  cos; sin and cos swapped; cot solved as tan; csc and sec crossed; π dropped), then by rule any angle outside the range,
  every angle the right size with one in a quadrant of the other sign, and some but not all of the answers. Not an
  attempt: an unreadable piece, two numbers with no comma, the same angle twice, the wrong unit, a calculator decimal,
  a form not simplest. Sentences never quote her negative or past-a-turn angle (−30° next to an answer of 30°), and the
  radian notes write π attached, "kπ/n", because π alone is the answer to cos θ = −1.
- **One record per list**: the part's grade carries a key (her angles, sorted); the flow's "same answer again" check
  uses it, so "300, 240" after "240, 300°" logs nothing new (`TrigPartGrade.key`, additive).
- **"Only one of two answers" is named but never promised**: a list with one answer is part of the answer, so its text
  is one of the answer's own spellings. Its sentence says how many there are and that she has one, never which.
  `trig_pi_dropped` is left out when an answer is π itself (its lesson writes π).
- **The figures** (`TrigFigure`, extended; the geometry renderer has no scenes): a triangle kind drawn from a pure
  layout (`components/trigTriangle.ts`), so a test can check every label against every stroke, filled shape, other
  label and the edge in every state she sees (before any part, after each, done). The scene's lengths that run along
  part of an object (up a wall, up a tower or a tree, along the ground or the water) are dimension lines end to end
  with ticks and extension lines; the ladder, the ramp's slope, the string and the line of sight carry their labels
  beside them. The lighthouse's angle of depression is drawn from a dashed horizontal at the top, never from the tower.
  The marked angle is drawn at its true size between 24° and 66° (15° and 72° in a scene) and steeper or flatter
  outside that, with "Not drawn to scale." under it. Labels are placed in a fixed order with the found side's last, so
  its appearance never moves another label. The uc.given point waits for the part that settles its quadrant (the
  missing coordinate; for tan or cot given, the first function); until then the axes with the quadrants numbered. The
  uc.solve circle draws the answer angles once she is done, their labels turned off the axes.
- **Exact answers** take every equal form (5√3, 5sqrt(3), 5*sqrt(3), "x = 5√3", 2.4 for 12/5); a radical in the
  denominator, √75 for 5√3, or a calculator decimal is a note. **Rounded answers** follow the first half: within half a
  unit of the last place asked is right, more places too, a unit after it too ("18.8 ft", "18.79 feet"); fewer places
  is "rounded too far"; a degree sign on a length is a note.
- **Draws that keep the gate from tilting the mix**: special-triangle answers are never 30, 45, 60 or 90 and never √2
  or √3 alone (numbers on the rule cards); radical draws start at 2 (a side of 1 makes tan θ = 9/1 = 9, which the
  figure already shows); sides and angles avoid 30°, 45° and 60° (special triangles, where an exact answer would read
  as "rounded too far"). Over 300 seeds the gate turns away about 23 rt.ratios draws, 6 rt.side, 9 uc.given and none of
  the others; each is redrawn from the same seed.
- **Words**: the catalog and the witnesses are plain text (as in the first half, they are drawn as text); prompts,
  questions, nudges and worked lines are KaTeX for every formula and angle.
- **Not changed outside the unit**: `shared/types.ts` (a module id, 18 ids), `content/types.ts` (the kind, the
  question types, the list check, the triangle and solve figure fields, the answer arm; additive), the catalog (18
  entries), `courses.ts` (Unit 4), `modules/index.ts`, `pages/Problem.tsx` (one case), `problem/tutorContext.ts` (the
  kind in four places). Tests changed: `courses.test.ts`, `generators.test.ts` (45 modules), `Home.test.tsx` (Unit 4's
  three titles), `tutorContext.test.ts` (one case), `keypadKeys.test.ts` (the list's comma), `unitCircle.test.ts`.

## Engine API (additions to `src/engine/trig`, import `@/engine/trig`)

- Right triangles (`triangle.ts`): `RtRole` ('opp' | 'adj' | 'hyp'), `RtSides`, `hypotenuseOf`, `legOf`,
  `hypotenuseSlips`, `legSlips`, `rtRatio(fn, sides)`, `rtRatioSlips`, `RATIO_SIDES`, `ROLE_WORDS`, `squareOf`.
- Special triangles (`special.ts`): `specialFactor(tri, from, to)`, `specialSide`, `specialSlips`, `specialRoles`.
- The calculator (`inverse.ts`): `fnDegrees`, `fnRadians`, `inverseDegrees`, `inverseRadians`, `linkOf(a, b)`,
  `sideAnswer`/`sideSlips` (a `SideProblem`: angle, known side, asked side, words for the sides, a depression),
  `angleAnswer`/`angleSlips` (an `AngleProblem`). Slips are `TrigDecimalSlip`s, numbers before rounding.
- One value and the quadrant (`given.ts`): `givenPoint(fn, value, quadrant)` → `{ x, y, r, missing }`, `givenValue`,
  `givenCoordinateSlips`, `givenRSlips`, `givenValueSlips`, `quadrantSigns`, `signIn`, `quadrantsWithSign`.
- Every angle in one turn (`solve.ts`): `solveAnswer(fn, value)` (degrees, exact), `solveSlips(fn, value, unit)`
  (`TrigListSlip`: id, the list's exact values, the sentence), `readAngleList(text)`, `gradeAngleList(spec, text,
  slips)` → a `TrigGrade` with the list's `key`, `angleValue`, `degreesOfValue`, `listText`, `listSay`,
  `SPECIAL_DEGREES`.

## Log

- [done] read CLAUDE.md, BUILD_GUIDE, roadmap, the first half's log and review, the optimization log, the trig core,
  the angleMeasure and unitCircle modules, TrigFlow, TrigFigure and its tests, the geometry figure renderer, the
  catalog, courses.ts, tutorContext, the keypad sets.
- [done] the core: right triangles, special triangles, the calculator, one value and the quadrant, every angle in one
  turn (list reader and grader); tests against hand tables and Math (every special triangle both ways, every uc.solve
  value in both units, the inverse functions) and 28 hand-worked anchors; the catalog's 18 entries.
- [done] content: the rightTriangle module (four templates, eight rule cards, stories, shapes), uc.given and uc.solve,
  the shared trig helpers (the list part, the figure texts in the gate, `showsNumber`, figure builders, calculator
  panels), the independent re-solve (`trig/resolve2.ts`).
- Found while building: the uc.given worked line "θ is in Quadrant II." was word for word in the prompt (the gate turned
  away 47 of 300 draws); merged into the line that gives the sign.
- Found while building: the out-of-range sentence quoted her angle, and for cos −30° sits next to an answer of 30°
  (141 of 300 uc.solve draws turned away); the sentences no longer quote it. The 2000-seed review then found the radian
  notes ("a number times π: type pi") spelling the answer π of cos θ = −1; they write kπ/n now.
- Found while building: radical draws with a side of 1 made a ratio equal to a side shown in the figure; draws start
  at 2. Plain triangles with a unit ("25 in") on a vertical leg ran 3 units off the figure; margins widened.
- [done] screen: TrigFigure (triangle, waiting point, solve circle), TrigFlow (the flow, the list key and preview, the
  figure's state), Problem.tsx, tutor context, Unit 4 on Home; tests.
- Found while building: the flow's "same answer again" check remembers only the last entry, so a list, another list,
  then the first again would have logged the first twice; the flow now remembers every list checked on a part (single
  answers keep the first half's behaviour).
- [done] typecheck, the whole suite once, the build once (see Verification).

## Not done

- No browser or device check (by instruction: no dev server, no browser). The figures were checked in jsdom and by the
  layout test; the ramp at a small angle (drawn at 15°), a long label beside the lighthouse and the kite's diamond near
  the top edge are the places to look at on a phone.
- The scenes are simple shapes (a wall, a wedge, a diamond, a crown and trunk, a tower, a hull), not drawings.
- Angles of depression are asked only from a lighthouse; a cliff, a plane or a balloon would be more stories on the
  same layout.
- uc.solve leaves out θ = 0 answers (see the decisions); sin θ = 0 is the one textbook favourite missing.
- The Progress page lists the new trig_ mistakes with the others.

## Verification

All on 2026-10-22 in `C:\work\trig2`, on the final code.

- `npm run typecheck` (the app, node and server configs): exit 0.
- The whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=4`, once on the final code: 301 files,
  5,016 tests, all passed (1,035 s). (An earlier run was stopped part way because a flow change landed after it
  started, so the counted run is all on the final code.)
- `vite build --outDir C:\work\trig2\.tmp-dist`: built in 15.2 s, the folder deleted afterwards. Its one warning is
  the existing one about the main chunk (3,062 kB against the 1,500 kB limit); the Problem chunk is 423 kB.
- What the new tests cover:
  - the core against hand tables and Math: the third side of 16 triangles both ways (triples and radicals), the six
    ratios of three triangles by hand and of all 16 against Math.atan2; every special triangle from every side and
    back (14 hand rows, each side also checked as the hypotenuse times the sine of the angle across from it); the
    functions and their inverses in both modes, a side from each pair of sides and an angle from each pair; the point
    for one value in every quadrant of the value's sign, for all six functions and five sizes each, with every other
    function against Math; every uc.solve value of the six functions (35 rows by hand) in degrees and in radians, with
    Math trying every whole degree of the turn; the list reader and grader; 28 hand-worked anchors through the graders;
  - each template over 300 seeds (`trig/testkit.ts` `sweep` with the new leak matcher): deterministic; every answer and
    spelling right; every slip its own id and never the answer; nonsense not an attempt; the promised slip real and
    named as its id, promised wherever one is possible; nothing she sees before a part, the figure's labels as they
    stand then included, spells that part's answer or a later one; an independent re-solve (`trig/resolve2.ts`) from
    the figure's labels and corners and the prompt's words, with Math, agrees; at least 25 distinct problems; no answer
    above 10% of seeds; every slip of the brief promised somewhere;
  - 2000 seeds per new template (`trig2.review.test.ts`): no catalog entry, rule card, hint or instruction spells an
    answer; part by part no question, nudge, note, slip sentence, catalog entry or figure label does; the messages of
    about 35 kinds of retry (a calculator decimal, a radical in the denominator, the wrong unit, two angles with no
    comma, the same angle twice, one of two answers, the answers a turn off…) never do, an answer ending a sentence
    counted; every equal form, rounding with more places, unit word, order and spelling of a list is right;
  - 22 hand-worked problems through the builders (`rightTriangle.hand.test.ts`): the prompt as words, the answers as
    she would type them, a slip named, and the worked lines;
  - the figure: the triangle layout over 1,200 problems in every state (before any part, after each, done) with no
    label on a line, a filled shape, another label or the edge; dimension lines end to end; a found side labelled only
    once found; the scenes drawn; the lighthouse's angle from a dashed horizontal; the uc.given point waiting for its
    part, the quadrants numbered clear of the axes; the uc.solve angles only when done, every special angle's label in
    both units clear of both axes;
  - the calculator panels over 300 seeds per template: the mode first wherever a trig key meets an angle, 2nd SIN for
    the inverse, the exact check only for exact answers, π only in radians; hand-checked keys;
  - jsdom, per template: the promised mistake named (title, lesson, sentence, example) and recorded once, the fix,
    completion with the worked lines in KaTeX; an unreadable answer records nothing; a reload restores the entries and
    the part; the figure never answers a part early; one of two answers named with a count, never which, and the same
    list in any order or spelling, or again after another list, recorded once; a list read back in KaTeX; the phone
    keypad alone finishes a list (the grid's comma, the π key) and a rounded side;
  - the tutor context for a right triangle and a list; the module list, courses and Home's Unit 4.

Problems to look at, one per template, with the mistake each promises (`#/p/<module>/<template>/<seed>`, the seed in
base 36):

- `#/p/rightTriangle/rt.ratios/6`: one leg 21 and the hypotenuse 29; the third side as √1282 (21² + 29²) is
  `trig_pythag_added` (the answer is 20).
- `#/p/rightTriangle/rt.special/m`: a 30°-60°-90° triangle whose short leg is 13; the hypotenuse as 13√3 is
  `trig_special_root3_two_swapped` (the answer is 26).
- `#/p/rightTriangle/rt.side/6`: a boat 363 m from a lighthouse, an angle of depression of 17°; the height as 1187.3
  (363/tan 17°) is `trig_depression_from_vertical` (the answer is 111.0 m).
- `#/p/rightTriangle/rt.angle/c`: from a 61 m lighthouse, a boat 105 m away along the line of sight; 0.0101, which is
  sin(61/105), is `trig_ratio_for_angle`: SIN pressed for 2nd SIN (the answer is 35.5°).
- `#/p/unitCircle/uc.given/7`: csc θ = −29/20 and cos θ < 0; x as 21 is `trig_coordinate_sign` (the answer is −21).
- `#/p/unitCircle/uc.solve/6`: tan θ = −√3 on [0°, 360°); "120, −60" is `trig_solve_out_of_range` (the answer is
  120°, 300°).

## Files

New, the core (`src/engine/trig/`): `triangle.ts`, `special.ts`, `inverse.ts`, `given.ts`, `solve.ts`; tests
`triangle`, `special`, `inverse`, `given`, `solve`, `trig2.anchor` (hand-worked).

New, the content: `src/content/modules/rightTriangle/` (`index.ts`, `build.ts`, `common.ts`, `words.ts`, `rules.ts`,
`shapes.ts`, `stories.ts`, `ratios.ts`, `specials.ts`, `sides.ts`, `angles.ts`; tests `rightTriangle` (300 seeds),
`rightTriangle.hand`), `src/content/modules/unitCircle/` (`given.ts`, `solve.ts`, `hints.ts`, `drafted.ts`),
`src/content/modules/trig/` (`forms.ts`, `resolve2.ts` (test helper); tests `trig2.review` (2000 seeds),
`calc.second`).

New, the screen: `src/components/trigTriangle.ts` (+ test), tests `src/components/TrigFigure.second.test.tsx`,
`src/pages/flows/TrigFlow.second.test.tsx`.

New, this log: `docs/progress/trig-unit4b.md`.

Changed: `src/shared/types.ts`, `src/content/types.ts`, `src/engine/trig/index.ts`, `src/engine/trig/types.ts`,
`src/engine/matchers/catalog.ts`, `src/content/courses.ts`, `src/content/modules/index.ts`,
`src/content/modules/trig/{parts,text,figure,calc,testkit}.ts`, `src/content/modules/unitCircle/{build,index,rules}.ts`,
`src/components/TrigFigure.tsx`, `src/pages/flows/TrigFlow.tsx`, `src/pages/Problem.tsx`, `src/problem/tutorContext.ts`,
`docs/roadmap.md`. Tests changed: `unitCircle.test.ts`, `courses.test.ts`, `generators.test.ts`, `Home.test.tsx`,
`tutorContext.test.ts`, `keypadKeys.test.ts`.

## Review (Claude, 2026-10-22)

Built by one Claude agent (about 0.87M tokens, 2 h 15 min; its first run stopped on the weekly usage limit and was
restarted). Checked:
- 45 sample problems by hand across all six templates and every story and phrasing (66 word-problem shapes listed):
  every answer right.
- An independent re-solve of 2400 problems (400 per template) from what she reads, with my own reading of each story
  (the kite's string, the ladder and the ramp are hypotenuses; the heights and the rise are opposite; distances and
  shadows adjacent; the angle of depression at the top equals the elevation at the boat), Math and mathjs only: the
  rounded sides and angles at the precision asked, the third side and the six ratios, both special triangles with any
  side given, the given-value problems' signs from a quadrant, an interval or another function's sign, and every
  solution set of uc.solve. No mismatch.
- On the Android emulator in a store-app build: the kite, lighthouse (both kinds), ramp, tree-shadow and 30-60-90
  figures: labels on the right sides, dimension lines end to end, "Not drawn to scale." where it is not.

Changed in review:
- The 18 new trig_ mistakes placed among the monsters (appended to their species, so no caught monster changes its
  look), and the main branch's monsters merged in.
- A 13-foot ramp at 3° reaches 13.0 feet along the ground, so copying the given length was right: a draw whose rounded
  answer equals a number the prompt gives is redrawn (1 draw in 800); a test checks 800 problems.

Left: the tree is drawn as a dashed trunk with a pale crown (reads, but could look more like a tree); the lighthouse's
angle arc is small at phone size (its label sits beside it).
