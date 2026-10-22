# Precalculus Unit 2: optimization with quadratics

Course `precalc`, unit `unit2` ("Polynomial and rational functions"), right after completing the square (module
`quadratics`, order 5.6; this module is order 5.65, before synthetic division). Built by one Claude agent on branch
`precalc-optim` in `C:\work\optim` (outside OneDrive), uncommitted for review.

## Why

This week's honors precalculus homework (AP Calculus AB preparation, TI-84 required) is optimization with quadratics:
"Solve each optimization problem. Write the primary and secondary equation and the final equation you use to solve the
problem. Show all work as necessary." The worksheet has a pigpen with 500 ft of fencing against a stone wall (three
sides fenced), three identical corrals side by side sharing fences with 400 ft, two corrals the same way, and a
calculator practice sheet. On her page she wrote the equations right, then (1) used x = −b/(2a) with a and b swapped,
−(−2)/(2·500) for A = 500x − 2x², and (2) wrote A = 2xy for three pens (copied from the two-corral problem) and dropped
the 400x/3 term while simplifying. The app names both slips by id.

## What she gets

One module, `optimization`, "Optimization with quadratics", four templates, every problem drawn from the seed and solved
in six checked parts, the worksheet's way:

1. the **secondary equation** (the condition: the fencing, the sales line, the sentence about the numbers), any
   equivalent form (2x + y = 500, 500 = 2x + y, y = 500 − 2x, 4x + 2y = 1000, even (500 − y)/x = 2);
2. the **primary equation**, the quantity made largest or smallest in both letters (A = xy, A = 3xy, R = xy, P = xy,
   S = x² + y²);
3. the **final equation**, the primary in one letter, multiplied out or not (A = x(500 − 2x), A = 500x − 2x²,
   A = −2(x − 125)² + 31250); in x **or in y**: where she eliminates x instead, parts 4 and 5 ask for y first, then x;
4. the value that gives the extreme, from the vertex −b/(2a) (or the TI-84's maximum);
5. the other variable;
6. the largest (or smallest) value, an area with its square unit.

Templates:

- `opt.wall` "A pen against a wall": one pen with three sides fenced (a pigpen against a stone wall, a garden along a
  barn, a dog run against a house, a play area against a school wall), or with a dividing fence from the wall to the far
  side; x is the side that meets the wall (70%) or the side across from it; ft, m or yd.
- `opt.pens` "Pens in a row": 2, 3 or 4 identical pens (corrals, kennels, garden plots, pens) side by side sharing
  fences: n + 1 fences across and 2n along, or n along when a wall runs down the other long side; the largest combined
  area (65%) or the largest area of each pen.
- `opt.numbers` "Two numbers": a sum (x + y = s), twice the first plus the second, the first plus three times the
  second, or the first s more than the second; the largest product, the smallest product (numbers s apart: negative
  answers), or the smallest sum of squares.
- `opt.revenue` "Price and revenue": tickets, bike rentals, shirts or boxes of cookies; each $1 increase loses k sales,
  or each $0.50 decrease brings m more; x is the price and y the number sold (the prompt says so).

Answers are clean (whole numbers or short decimals) or the prompt asks how to give them ("Give exact answers: a fraction
or a mixed number is fine", or "Round your answers to the nearest tenth / hundredth"). The worksheet's own problems come
out as on her page: 500 ft against a wall gives x = 125 ft, y = 250 ft, 31,250 ft²; three pens with 400 ft give
x = 50 ft, y = 33⅓ ft, 5,000 ft² in all.

The screen (`pages/flows/OptimizationFlow.tsx`, kind `optimization`) is the parts pattern of the trig unit: one part at
a time, three hint rungs per part (the nudge, the rule card, the worked lines, which mark the answer shown), her entries
and the part she is on survive a reload, a named mistake shows the catalog title, lesson, the sentence about her own
work and the wrong → right example, and a check that does not count says so and logs nothing. KaTeX draws the prompt,
every question, nudge, slip sentence, right note and worked line, and a "reads as" preview of her equation (with the
quantity's letter upper case) or her number (with its unit). The figure (`components/OptFigure.tsx`): the pen or the row
of pens, a hatched wall with its name, every fenced side labelled x or y, never a number, never to scale ("Not drawn to
scale." under it). The calculator panel (behind its button): Y1 = the final equation, a WINDOW that holds the vertex,
2nd TRACE 4:maximum (3:minimum for a smallest value), and −b/(2a) keyed with this problem's a and b; TI-Nspire steps as
well. The keypad: `KEYPAD_SETS.optimization` (x, y, A; a revenue or number box passes its own letter), with =, x² and the
digits from the grid; number boxes get the problem's units (ft, ft², $, tickets).

## Design decisions for review

- **The core is `@/engine/optim`**, a new folder; `src/engine/index.ts` is unchanged. It reuses the parser
  (`parseStatement`, `parseExpression`) and the trig core's exact rationals (`engine/trig/rational`).
- **Equivalence, not text.** The secondary equation is linear: its coefficients (a·x + b·y + c, from evaluations, checked
  at nine points) are compared up to a nonzero multiple. A curve (xy = 500) and a rational form of the line are compared
  by solving for y at the points. The primary and final equations are solved for the quantity's letter (it appears
  linearly: α·A + β = 0 at each point) and compared by value at nine deterministic low-discrepancy points of the
  problem's domain (both sides positive and the fence used up; the price from free to no sales). Which letters a solved
  equation depends on is found by moving the points in x and in y; that is what tells the final equation's route (x or
  y) and turns away a final equation in both letters. Each equation's profile is computed once (cached per text, letter
  and domain), so her line is compared with twenty slips as twenty array comparisons.
- **Letters.** The parser reads letters in lower case; the quantity's letter is kept as its key and drawn upper case
  again. `A(x) = …` is `A = …`; another name (`f(x) =`, `Y1 =`) and any letter but x, y and the quantity is a note that
  says which letters the problem uses. One equation per box: a chain (`A = xy = …`) or an inequality is a note.
- **What is a note (not an attempt, nothing logged).** An equation of the wrong kind for its box: an equation with the
  quantity in the secondary box (unless it is the primary, which is named), the primary with one letter (the final
  written a part early), a final equation in both letters or with no letter; a right number with another letter in front
  (`y = 125` in the x box) or a unit of the wrong kind (ft² on a length, ft on an area, $ on a length); **an area with no
  unit** (the worksheet asks for units); a rounded decimal where the answers are exact (33.33 for 100/3), fewer places
  than asked ("rounded too far"), and a calculator estimate (124.9999). A named slip or a wrong number is graded as it
  is, whatever unit or letter is around it.
- **What is right.** Every equivalent equation; a number in any exact form (125, 125.0, 250/2, −500/(2(−2)), 100/3,
  33 1/3, 33⅓, 31,250), with or without "x =", "about", units after it (ft, feet, ft², ft^2, sq ft, square feet; m, yd),
  $ and dollars for money, the count word for a count; where rounding is asked, any correct rounding with at least the
  places asked, and the exact value too.
- **Parts 4 and 5 follow her final equation.** `answer.stages` has the x route; `answer.yStages` holds parts 4 and 5
  for a final equation in y. The flow (and the tutor) pick by re-reading her stored final entry (`finalRoute`), so a
  reload keeps the route without a new field on the attempt.
- **Not marked step by step** (`problem/solveStyle.ts` unchanged): the parts are separate boxes in a parts flow, not
  lines of one work column, and the step guide ("Write your next line") would describe the wrong screen.
- **The figure** is its own component (the geometry renderer has no hatched wall): letters only, the pen's proportions
  fixed per kind of figure and kept at least 20% away from the best pen's (a single pen against a wall is best twice as
  long as it is deep, so it is drawn 1.45 times; pens in a row are drawn square, best taller than wide; and so on), so the
  drawing cannot hint at the answer. Every label sits off every line (a 300-seed test per template).
- **KaTeX and plain text.** Everything the flow draws is KaTeX between dollar signs (money inside the math is `\$`, which
  the module's own `pieces`/`plain` keep apart from the delimiters). Rule cards and catalog entries stay plain Unicode
  text (A = lw, −b/(2a), x²) as in every other module: `RuleCardView`, the rail's rule-card panel and the module page
  draw them as text, and making them KaTeX would change shared components.
- **No number on a card, a hint or a catalog entry.** Rule cards, format hints and instructions give the method in words
  and letters; catalog examples use l and w, letters no problem uses; lessons have no digits but the 1 of n + 1 (the rule
  cards dropped "TI-84" and "4:maximum" because an answer of 84 or 4 would be spelled; the calculator panel has the
  keys). The a-and-b-swapped sentence names no coefficient (on the y route, b equalled the answer whenever a = −1/2).
- **23 opt_ ids.** From the brief: `opt_vertex_ab_swapped`, `opt_vertex_sign`, `opt_wall_fenced`,
  `opt_wall_wrong_side`, `opt_pen_ends_short` (n fences across instead of n + 1; also the divider left out),
  `opt_pen_long_short` (n along instead of 2n), `opt_area_one_pen`, `opt_area_wrong_count`, `opt_term_dropped`,
  `opt_x_as_max`, `opt_max_as_dimension`, `opt_other_from_primary`, `opt_opens_wrong_way`, `opt_revenue_wrong_way`.
  Added, each from the work: `opt_vertex_no_two` (−b/a), `opt_dimensions_swapped` (y's value in the x box, x again for
  y), `opt_solve_divide` (the secondary solved for y with only one term, or none, divided by y's number), 
  `opt_coefficients_swapped` (twice the second for twice the first; y − x for x − y), `opt_revenue_whole_price`
  (y = q₀ − kx), `opt_revenue_steps` ($0.50 steps counted per dollar), `opt_primary_secondary_swapped` (the two
  equations in each other's box), `opt_area_as_fence` (xy = 500, or A = 2x + y), `opt_binomial_square` ((40 − x)² as
  1600 ± x², and S = (x + y)²).
- **Readings of the brief's slips.** "The minimum where the maximum is asked (a > 0 parabola misread)" is
  `opt_opens_wrong_way`: a final equation that is the right one negated (a sign lost in solving the secondary equation,
  so the parabola opens up and its vertex is a minimum), and in part 6 the extreme value with its sign flipped. "The
  other dimension taken from the primary equation instead of the secondary" is reading the other side off the final
  equation (what multiplies x there), which carries the number of pens: n·y. With one pen that is the answer itself, so
  the slip exists only for pens in a row with the combined area asked.
- **Her compound slip** (A = 2xy for three pens, then the 400x/3 term lost: −4x²/3) is named `opt_term_dropped`, with a
  sentence that names the 2xy too; A = 2xy itself is `opt_area_wrong_count` in part 2 (and (400x − 4x²)/3 in part 3).
- **Slips carried on.** A wrong secondary or primary equation is named again where it shows later (the final equation
  built on 2x + 2y = 500, a y from it, the area of one pen in part 6). Every slip is computed for the problem; a slip
  equal to the answer is left out and the first of equal slips is kept, so each one grades as its own id.
- **Promised slips** are picked by the seed from the slips of the x route; a carried slip and y's value in the x box are
  never promised. Every problem promises one.
- **Generation and the gate.** A draw is redrawn (same seed, next salt) when the gate turns it away: every answer and
  spelling right on both routes, every slip its own id, nonsense not an attempt, the promised slip real, nothing she sees
  early spelling an answer (an answer ending a sentence counted), no TeX left in the words. Revenue draws keep the counts
  whole and the best price in cents; a problem whose prompt holds an answer (k = $20 and the best price $20) is skipped.
  A problem takes about 25 ms to generate and check on this machine.
- **Not changed outside the module:** `shared/types.ts` (module id, 23 ids), `content/types.ts` (the kind, the parts'
  types, the answer arm), the catalog (23 entries), `courses.ts` (Unit 2), `modules/index.ts`, `keypadKeys.ts` (one key
  set), `pages/Problem.tsx` (one case), `pages/flows/record.ts` (`recordOptPartGrade`), `problem/tutorContext.ts`
  (`verdictFromOptPart`, work, statement, worked lines, answer).

## Engine API (`src/engine/optim`, import `@/engine/optim`)

- Reading: `readOptEquation(text, quantity)` → `{ lhs, rhs, letters, key }` or a reason and a note;
  `readOptNumber(text, units)` → `{ exact, value, places, unit, name, tex }` or a note; `displayNode` (the letter upper
  case for KaTeX); `unitSpellings`.
- Equivalence: `linearForm`, `sameLinear`, `degenerate`, `solvedAt`, `solvedFor`, `sameValues`, `dependence`,
  `sameCurve`, `sameQuantity`, `domainPoints`; profiles: `profileOf`, `profilePoints`, `sameProfile`.
- Vertex: `vertexOf(quadratic)`, `vertexSlipValues` (−a/(2b), b/(2a), −b/a), `evalQuadratic`.
- Graders: `gradeOptEquation(spec, typed, traps)` with `spec.part` constraint, primary or final (the final's `route`
  comes back on a right answer), `gradeOptNumber(spec, typed, traps)`, `finalRoute`, `exactFromText`.
- `OPT_MISTAKE_IDS`, `isOptMistake`.

## Log

- [done] read CLAUDE.md, BUILD_GUIDE, roadmap, the quadratics module, expModels with ExpLogPartsFlow, the trig unit (its
  progress log and review, the flow, the figure, the gate and the sweeps), the geometry figure renderer and its label
  tests, the engine's parser and expression checks, the catalog, the keypad sets, courses.ts, tutorContext, record.
- [done] engine: reader, equivalence, profiles, vertex, graders; 64 tests (hand-made equivalent and non-equivalent
  pairs, the worksheet's numbers, her slips).
- [done] catalog: 23 opt_ entries in the catalog's voice.
- [done] content: model (exact final equations and every slip), parts (the six parts on both routes, the grader
  wrapper, the leak checks and the gate), four templates, figure specs, calculator steps, rule cards, words.
- Found while building: the 300-seed sweeps took ten minutes; profiles cached per equation, a leak matcher that builds
  each answer's patterns once and unit patterns built once brought a problem from 100 ms to 25 ms.
- Found while building: the vertex sentence quoted b, which is the answer on the y route when a = −1/2; the rule card
  and the nudge said "TI-84" and "4:maximum" (an answer of 84 or 4 would be spelled); a sentence-end check of a later
  answer inside her −8 (the number 8) would have turned away every numbers problem a given distance apart: an answer she
  already has is not news to a later part.
- Found while building: (40 − x)² written 1600 + x² is also "the −80x term dropped"; the binomial slip is named first.
- [done] screen, figure, keypad set, records, Problem.tsx, tutor context, Unit 2 on Home; tests.
- [done] typecheck, the whole suite, the build once (see Verification). The first whole run had one failure: a reader
  test and the reader change it covers were edited while the run was going, so the suite ran a second time on the
  final code.

## Not done

- No browser or device check (by instruction: no dev server, no browser). The figure's labels were checked in jsdom and
  by the layout test; the four-pen row and a long wall name are the places to look at on a phone.
- A mixed number (33 1/3) needs a space, which the phone keypad does not have; 100/3 and 33⅓ typed elsewhere work.
- The calculator panel graphs the final equation in x only (the route she takes is not known when the panel is built).
- Rule cards and catalog entries are plain text, not KaTeX (see the decisions).
- The Progress page lists opt_ mistakes with the others.

## Verification

All on 2026-10-21 in `C:\work\optim`, on the final code unless it says otherwise.

- `npm run typecheck` (the app, node and test configs): exit 0.
- The module's own files (engine, hand-worked problems, model, calculator steps, figure, flow, tutor context, keypad,
  courses): 13 files, 177 tests passed in 44 s. The 300-seed sweeps and the 2000-seed review ran in the whole suite.
- The whole suite (`vitest run --maxWorkers=4`), first run: 285 files, 4,758 tests, 964.64 s, one failure in
  `src/engine/optim/read.test.ts` (the test case `A = x(y)` as a product was added, and the reader changed to match,
  while the run was going; the run had the new test and the old reader). Second run, on the final code:
  285 files, 4,758 tests, all passed, 995.67 s.
- The build (`vite build --outDir C:\work\optim\.tmp-dist`): built in 20.6 s, folder deleted afterwards. Its one
  warning is the existing one about the main chunk (2,957 kB against the 1,500 kB limit; this module adds under 200 kB
  of source).
- The four showcase problems were generated again on the final code; each one's promised slip grades as its id:
  - `#/p/optimization/opt.wall/10` (seed 36): 420 ft along a barn; `opt_vertex_ab_swapped` in part 4, x = 1/420
    (−a/(2b) for A = 420x − 2x², her first slip).
  - `#/p/optimization/opt.pens/k` (seed 20): three garden plots, 200 m; `opt_area_wrong_count` in part 2, A = 2xy (her
    second slip; the answer is A = 3xy).
  - `#/p/optimization/opt.numbers/i` (seed 18): twice a first number plus a second is 148; `opt_coefficients_swapped`
    in part 1, x + 2y = 148.
  - `#/p/optimization/opt.revenue/9` (seed 9): 312 bikes a day at $6, 12 fewer for each $1 more;
    `opt_revenue_wrong_way` in part 1, y = 312 + 12(x − 6).

## Files

New, the core (`src/engine/optim/`): `types.ts` (the 23 ids), `read.ts` (equations and numbers), `equiv.ts`
(linear forms, solving for a letter, comparing values), `profile.ts` (profiles and their comparison), `vertex.ts`,
`grade.ts`, `index.ts`; tests `read`, `equiv`, `grade`, `vertex`, `catalog`.

New, the content (`src/content/modules/optimization/`): `index.ts` (module and templates), `build.ts` (assembling,
the promised slip, the instance), `model.ts` (exact mathematics and the slips), `parts.ts` (the six parts, grading, the
leak checks, the gate), `wall.ts`, `pens.ts`, `numbers.ts`, `revenue.ts` (the templates), `figure.ts`, `calc.ts`,
`rules.ts`, `words.ts`, `text.ts`, `testkit.ts` (the sweep and the independent re-solve); tests `optimization`
(300 seeds per template), `optimization.hand` (27 hand-worked problems), `optimization.review` (2000 seeds), `calc`,
`model`.

New, the screen: `src/components/OptFigure.tsx` (+ test), `src/pages/flows/OptimizationFlow.tsx` (+ test).

Changed: `src/shared/types.ts`, `src/content/types.ts`, `src/engine/matchers/catalog.ts`, `src/content/courses.ts`,
`src/content/modules/index.ts`, `src/components/keypadKeys.ts`, `src/pages/Problem.tsx`, `src/pages/flows/record.ts`,
`src/problem/tutorContext.ts`, `docs/roadmap.md`. Tests changed: `keypadKeys.test.ts`, `courses.test.ts`,
`generators.test.ts` (44 modules), `tutorContext.test.ts`.
