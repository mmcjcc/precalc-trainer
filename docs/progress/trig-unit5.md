# Precalculus Unit 5: graphs of the trigonometric functions

Course `precalc`, unit `unit5` ("Unit 5", "Graphs of the trigonometric functions"), after Unit 4 (Larson 4.5 to 4.8).
Built by one Claude agent on branch `precalc-unit5` in `C:\work\trig5` (outside OneDrive), uncommitted for review. It
builds on Unit 4 (`docs/progress/trig-unit4a.md`, `trig-unit4b.md`): the same exact core (`src/engine/trig`), reader,
grader, parts flow (`TrigFlow`) and figure (`TrigFigure`), extended, not forked.

## Why

The honors precalculus class (AP Calculus AB preparation, TI-84 required) finishes Unit 4 with the unit circle and
right triangles; the app needs the whole year before it is published. Unit 5 is the graphs of the six functions, their
models, and the inverse functions: what the AP course leans on (period, phase shift, the inverse ranges) and what the
TI-84 is used for in class (a model's value, intersect in RADIAN mode).

## What she gets

Three modules, seven templates, every problem drawn from the seed and checked by the trig core before it is shown.
Radians throughout (degrees only where a problem asks), π in KaTeX, Larson's and Sullivan's words (amplitude, period,
phase shift, midline, vertical asymptote, principal value).

- `sinusoids`, "Graphs of sine and cosine" (order 5.995):
  - `sg.features`: y = A sin(B(x − C)) + D or y = A cos(Bx − C) + D (the factored or the expanded form; A a whole
    number or a half, B whole, a fraction or a multiple of π, the shift a fraction of π or of the period). The
    amplitude, the period, the phase shift (a size and left or right, or none; "−π/3" is right too), the midline
    (y = D) and the range (the app's interval reader); in 30% of problems also the five key points of one period.
  - `sg.equation`: an equation from a graph (60%: a highest and the next lowest point labelled exactly, x ticks at
    multiples of π/k, one or two periods drawn) or from a description (a sine or cosine curve with an amplitude, a
    period, a shift and a vertical shift). Every equivalent equation is right: graded as a function, exactly at the key
    points and sampled over two periods.
  - `sg.model`: a Ferris wheel (its diameter, its center or a boarding platform, a turn in minutes or seconds, boarding
    at the bottom or timed from the center going up), a tide, the hours of daylight, monthly average highs, a day's
    temperature. The model (graded by equivalence), a value at a time, and the first time it reaches a height, rounded
    as asked, in RADIAN mode with intersect.
- `otherTrigGraphs`, "Graphs of tangent, cotangent, secant and cosecant" (order 5.996):
  - `og.features`: the period; the vertical asymptotes as a family (every equivalent family is right: any base, any
    letter, either sign of k, (2k + 1)π/4) or, in some problems without an x-intercept part, those between two
    x-values as a list; the x-intercepts of tan and cot (when there is no vertical shift); the range of sec and csc as
    a union.
  - `og.match`: which of four graphs is the equation's. The three wrong graphs are named slips (the period multiplied
    by B, the reflection missed, the shift the wrong way, the cofunction's graph, the vertical shift's sign), each
    checked to look different; the cards are laid out as expLogGraphs' matching cards are (the same two-column grid,
    figure and caption), named only "Graph A" to "Graph D".
- `inverseTrig`, "Inverse trigonometric functions" (order 5.997):
  - `it.evaluate`: arcsin, arccos and arctan (written arcsin or sin⁻¹) of the special values, exactly, in radians (20% in
    degrees); an input outside [−1, 1] is answered with the "No value" button beside Check, never a typed word; 27% a
    calculator value to three places.
  - `it.compose`: sin(arcsin 0.3) = 0.3 (and no value for sin(arcsin 2)); arcsin(sin(5π/6)) = π/6; cos(arctan(3/4)) =
    4/5 and tan(arcsin(−5/13)) = −5/12 with a reference triangle, in three parts (the quadrant, the third side of the
    point, the value); and algebraic forms such as cos(arcsin x) = √(1 − x²) (nine shapes, with x, x/c or cx inside),
    graded by equivalence on the domain.

The screen is Unit 4's `TrigFlow` (`SinusoidsFlow`, `OtherTrigGraphsFlow`, `InverseTrigFlow`): the given equation on its
own line in KaTeX, parts one at a time, three hint rungs per part (the nudge, the rule card, the worked lines, which mark
the answer shown), entries and the open part survive a reload, a named mistake shows the catalog title, lesson, the
sentence about her answer and the example. sg.equation's graph and og.match's four cards are the problem; every other
graph (a wave with its key points, a model with its value and time, an inverse function with her point) waits behind
the Graph panel's reveal gate. "Graph it" opens the given function only (sg.features, og.features, inverseTrig), only
behind the gates, never for sg.equation, og.match or a model. The TI-84 and TI-Nspire steps sit behind their button:
RADIAN mode first (DEGREE where degrees are asked), the function as keys (`3 SIN( 2 X,T,θ,n − π ÷ 2 ) + 1`, sec as
`1 ÷ COS(`), a window of two periods, then maximum, value or intersect; for an inverse, `2nd COS (COS⁻¹) (−) 1 ÷ 2 )`;
where π is, only where the keys or her exact answer use π. The keypad sets: a graph (x, π, √, the six functions), a
model (t), a shift (right, left), a family (x, k, π), exact points, an inverse value (π, √, °, sin⁻¹, cos⁻¹, tan⁻¹; no
word for a missing value), the grid's comma for lists.

## Design decisions for review

- **The core grows in `@/engine/trig`, additively**: `expr.ts` (her function: a small reader for formulas in x or t
  with the six functions and the inverses, "sin 2x" as sin(2x); exact and numeric evaluation; `sameFunction` exact at
  the key points and sampled), `wave.ts` (the six functions' graphs: period, amplitude, phase shift, key points,
  asymptotes, zeros, extremes, texts, and each slip's value), `shift.ts` (a phase shift as a signed exact value),
  `xset.ts` (a family or a list of x-values, compared by residues modulo the common period), `points.ts` (key points
  in any order), `principal.ts` (principal values from a hand table, the inverse slips, cancelling). `reader.ts` only
  learns an inverse function's name before "=". Unit 4's behavior is unchanged (its whole suite passes). The shared
  `texPlain` (trig/text.ts, also used by optimization) learns \arcsin, \infty, \cup and \left| \right|, none of which
  appears in a Unit 4 or optimization text; \sin^{-1} keeps reading "sin^−1", as Unit 4's reveals always have (a first
  version read it "sin⁻¹" and the whole suite caught the change to Unit 4's rt.angle reveal: reverted).
- **A phase shift is read the way both books write it**: a size and a direction ("π/4 right", "right π/4", "π/4 to
  the right", "π/4 R"), or Larson's signed C/B ("−π/3" is π/3 left, a bare "π/4" is right), or none ("none", "0",
  "no shift"). Up or down is a note (that is the vertical shift).
- **Grading by equivalence**: sg.equation, sg.model and the algebraic compositions grade her formula as a function:
  exactly at the key points (exact arithmetic with π and radicals) and numerically at spread samples over two periods
  (or the domain). A decimal standing in for π is a note, not wrong. The re-solve checks three different equivalent
  forms of every sg.equation answer (cosine from the highest point, the sine, the cosine from the lowest point) and
  that every promised slip is a different function.
- **The numbers check** (build5): an answer must not equal a number the problem gives. The exceptions are read straight
  off the equation by design: the amplitude |A|, the midline D, a factored form's shift; and sin(arcsin u) = u, whose
  answer is its input (the lesson). A list or family of x-values is a set, not one number, and is not checked (a csc or
  cot cycle starts with an asymptote at its shift). The review test checks this again from her screen (the equation's
  TeX, the words, the figure's labels), with πx/3 read as the coefficient π/3.
- **Rule cards name the facts in letters** (period 2π/B and π/B, phase shift C/B, midline y = D, the range
  [D − |A|, D + |A|], the inverse ranges [−π/2, π/2], [0, π], (−π/2, π/2)). Because the inverse cards show 0, ±π/2, π
  and ±1, no inverseTrig answer is one of them (arctan(1) is asked: its answer is π/4). The algebraic card
  was reworded in review: read with u as x, "cos(arcsin u) = √(1 − u²)" worked a problem the template asks; the card
  now says how (opposite u, hypotenuse 1, the adjacent side from a² + b² = c²) without the expression.
- **No value is a button**: a part with `noValue` has a "No value" button beside Check (type="button", not chunky)
  that enters "no value"; a typed "undefined" or "DNE" is accepted too (lenient), but nothing tells her to type a word:
  the reader's "say so in a word" notes are rewritten for such parts to point at the button, the keypad has no word
  key, and no prompt, question, hint or instruction prints the button's text. In it.evaluate, any number typed for an
  input with no angle is the named mistake (trig_inverse_outside_domain); in it.compose, the cancelled input is.
- **og.match**: the right graph's place is drawn from the seed (15–35% per place over 300 seeds); its card is the
  equation's curve (the re-solve finds exactly one card whose drawn curve is the equation, and it is the answer). The
  tutor, which cannot see the cards, gets each card's formula; the screen reader gets "Graph A".
- **Graphs to their true shape**: `GraphSpec.ticks` (additive; no other module sets it, tested over every template)
  switches GraphPanel to `components/TrigGraph`: runs split at the asymptotes and sampled densely near them, dashed
  asymptotes, x ticks at multiples of π/k labelled π/4, π/2, 3π/4 … (thinned to every m-th tick when crowded), and
  labelled points placed by a search for the nearest spot clear of the curve, the asymptotes, the tick labels, the
  dots and the other labels. A label may cross an axis line (its white halo breaks the line) when no other spot is
  free; the layout test allows that for at most 3% of a template's labels. The model graph shows one period so its
  labels have room.
- **A figure never answers a part**: the reference triangle draws nothing before the quadrant is answered, then two
  sides, and the side she finds only once she has found it; a graph to read labels only its highest and lowest points.
  `figureTextsAt` and the gate check the labels as they stand while each part is open.
- **The calculator steps never type an answer**: sg.equation's panel enters "your equation" and checks it at the
  labelled points; `calcExpr` was removed from the Unit 5 drafts (unused, and it held sg.equation's answer).
- **Where no slip is possible, none is promised**: sin(arcsin u) with u in the domain and tan(arctan u) have no named
  slip (20 of 300 it.compose problems). Every other problem promises one, graded as its id.
- **Slips reused from Unit 4**: the reference triangle's sides and values use Unit 4's given-point slips
  (trig_coordinate_sign, trig_r_not_rooted, trig_r_negative, trig_r_left_out, trig_side_not_rooted, trig_sign_quadrant,
  trig_sin_cos_swapped, trig_tan_inverted, trig_reciprocal_missing, trig_reciprocal_mixed, trig_pythag_added,
  trig_pythag_subtracted, trig_ratio_for_angle); their sentences are Unit 4's, with "θ is in …" said as "The angle θ is
  in …" in Unit 5 (no sentence starts with a symbol; Unit 4's own texts are untouched).
- **it.evaluate's answers are few by nature** (the special angles): the most common answer, π/3, is 29 of 300 seeds
  (9.7%), under the 10% limit but close to it.

### The 31 new trig_ ids and their monster species (each appended at the end of the species' list)

| Species | New ids | Family line widened |
|---|---|---|
| sign | trig_amplitude_negative, trig_inverse_sign_dropped | no |
| upside | trig_period_times_b | no |
| tangle | trig_inverse_as_reciprocal, trig_inverse_cancel_outside | no |
| fence | trig_range_ignores_d, trig_sec_range_as_sinusoid, trig_inverse_other_angle, trig_inverse_not_principal, trig_arccos_range_as_arcsin, trig_inverse_outside_domain | yes |
| squint | trig_period_half, trig_period_quarter, trig_midline_at_extreme, trig_model_later_time | yes |
| shifty | trig_period_as_b, trig_shift_not_divided, trig_shift_wrong_way, trig_midline_zero, trig_reflection_missed, trig_b_as_period, trig_vertical_shift_sign, trig_model_start_point | yes |
| hole | trig_asymptotes_zeros_swapped, trig_sec_asymptotes_at_sin_zeros | yes |
| mismeasure | trig_amplitude_with_d, trig_amplitude_as_span, trig_amplitude_as_diameter | yes |
| spin | trig_period_base_mixed, trig_cofunction_graph, trig_degree_mode | yes |

Catalog entries (`src/engine/matchers/catalog.ts`) are in the warm voice, in letters and words: digits only in 90,
180, 360 and 2π (`src/engine/trig/catalog.test.ts`).

## Engine API (additions to `src/engine/trig`, import `@/engine/trig`)

- `readExpr`, `evalExprNum`, `evalExprExact`, `sameFunction`, `nearlySameFunction`, `hasDecimal`, `hasTrigFunction`,
  `spreadSamples`, `exprTex`, `readFunctionAnswer(raw, { variable, allowBare })` (y =, f(x) =, h(t) =, T(t) =).
- `Wave { fn, A, B, C, D }`: `wavePeriod`, `waveAmplitude`, `waveInnerShift`, `waveKeyPoints`, `waveAsymptotes`,
  `waveZeros`, `waveValue`, `waveExtremes`, `waveText`, `waveTex`, `familyText`, `waveRangeText`, and the slips
  `amplitudeSlips`, `periodSlips`, `shiftSlips`, `midlineSlips`, `rangeSlips`, `asymptoteSlips`, `zeroSlips`,
  `keyPointSlips`.
- `readShift`, `gradeShift`; `readXSet`, `sameXSet`, `membersBetween`, `gradeXSet`; `readPointList`, `samePoints`,
  `gradePoints`; `principalValue`, `evaluateSlips`, `outsideDomainTrap`, `inverseDecimalSlips`, `cancelValue`,
  `cancelSlips`, `inPrincipalRange`, `RANGE_WORDS`.

## Log

- Read CLAUDE.md, BUILD_GUIDE §0, the roadmap, the Unit 4 logs and reviews, the grapher log, optimization, geometry
  Unit 6's review; the trig core, the Unit 4 modules, TrigFlow, TrigFigure, Graph, GraphPanel, graphIt, the catalog and
  courses.ts.
- Engine: expr, wave, shift, xset, points, principal, with tests against hand tables and Math; 31 ids, catalog
  entries, monster species.
- Content: the parts kinds (shift, midline, interval, points, function, family, principal), parts5, build5 (the gate
  and the numbers check), calc5, graph5, wave5, fn5; the three modules and seven templates; registration in the module
  list and courses.ts; Problem.tsx, tutorContext, graphIt; TrigFlow, TrigFigure, TrigGraph and its layout.
- Tests: the 300-seed sweep with the independent re-solve (resolve5: the equation as she reads it, the graphs' drawn
  curves and labels, the words of a story, mathjs and Math), the 2000-seed review, the hand-worked problems, the
  calculator panels, the graph layout over 300 seeds per template, the figures, the jsdom flows, the tutor context, the
  keypad sets.
- Fixed what the tests found: a re-solve that read "π/4(x + 2)" as π over 4(x + 2) (now read from the TeX); "1 hours
  after midnight" and "1 feet deep" in the tide story (now "1 hour", "1 foot", and no "t =" before an hour); sentences
  starting with θ or a number in it.compose; retry notes for x-values and shifts that printed π or "none" (reworded:
  "with fractions instead of decimals", "say there is no shift"); the it-algebraic and it-triangle cards (above);
  graph labels that had no clear spot (a wider search; the model graph one period wide); tan(arctan 12) drawn outside
  its window (the window now holds the input); the π note on sg.equation's panel only when her equation has a π; the
  Nspire's π note for a composition; the og.match order comment.
- The whole suite, the typecheck and the build (Verification); the first full run caught the shared `texPlain`
  change to Unit 4's rt.angle reveal, reverted. Scratch files deleted.

## Not done

- Solving trig equations (Larson 5.3) and the laws of sines and cosines are later units.
- Damped trig graphs and sums of trig functions (Larson 4.6's last part), and graphs of the inverse functions as a
  question of their own (their graphs are behind the gate only).
- No browser or phone check: the brief asked for no dev server; the layout is tested in viewBox units, which scale as
  a whole (so what clears at 340 wide clears at the phone's 375 px), and the four cards stack in one column on a phone.

## Verification

All in `C:\work\trig5` (outside OneDrive), 2026-10-22:

- `npm run typecheck` (app, node and server configs): passes.
- The whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=3`: 337 files, 5850 tests, all pass (1471 s).
  The first full run had one failure, Unit 4's rt.angle hand test, which caught the shared `texPlain` reading
  `\tan^{-1}` differently; the change was reverted (above) and the second full run passed.
- The build, `node node_modules/vite/bin/vite.js build --outDir C:\work\trig5\.tmp-dist`: passes (41 s; Vite's
  existing warning that the main chunk is over 1,500 kB stands, 3,388 kB); the folder was deleted.
- Unit 5's own tests (seeded loops with a 120 s timeout):
  - engine: `expr.test.ts` (46: the reader, exact and numeric values, equivalence, against Math), `wave.test.ts` (21:
    periods, shifts, key points, asymptotes, zeros against hand tables), `principal.test.ts` (52: principal values
    against a hand table and Math.asin/acos/atan, the slips), `readers5.test.ts` (56: shifts, x-value sets, points,
    the messages);
  - `trig5.test.ts` (8): each template over 300 seeds (deterministic; every answer and spelling right; every slip its
    own id and never the answer; the promised slip a candidate graded as its id wherever one is possible; nothing seen
    early spells an answer, figure labels included; the independent re-solve in `resolve5.ts` agrees; at least 25
    distinct problems; no answer over 10%; every slip of the brief a candidate), and og.match's place balance (each
    place 15–35%, no equation over 10%);
  - `trig5.review.test.ts` (39): 2000 seeds per template for the catalog, cards, hints, instructions, early texts and
    retry messages; seed 1's numbers; equal forms, roundings and textbook spellings right (300 seeds); no answer a given
    number, read independently (300 seeds); English (no article before a number, plurals, no sentence starting with a
    symbol, π in KaTeX, no button text before she answers); the triangle and the graphs never answer a part;
  - `trig5.hand.test.ts` (26): hand-worked problems, the brief's among them (y = 3 sin(2x − π/2) + 1, y = tan(x/2),
    arccos(−1/2), arcsin(sin(5π/6)), cos(arctan(3/4)), tan(arcsin(−5/13)), h(t) = 30 − 25cos(πt/2));
  - `calc5.test.ts` (12): RADIAN or DEGREE first, π only where used, over 300 seeds; hand-checked panels;
  - `TrigGraph.test.tsx` (16): π labels, the true shape, branches split at asymptotes, dashed asymptotes, ticks
    additive (no other module's graph sets them), labels clear over 300 seeds per template;
  - `TrigFigure.unit5.test.tsx` (3), `TrigFlow.unit5.test.tsx` (31: per template the named mistake, the fix, the
    records, completion, an unreadable answer, a reload, the chunky Check; the graphs and their gates, Graph it, the
    TI-84 button, No value, the inverse keys, the reference triangle, the three hint rungs), a Unit 5 case in
    `tutorContext.test.ts`, two in `keypadKeys.test.ts`, and the Unit 5 rows of `graphIt.test.ts`.
- Fixed seeds to look at (each promises the slip named): `#/p/sinusoids/sg.features/3` (y = −2sin(x/3 − 5π/6);
  trig_period_times_b, a period of 2π/3), `#/p/sinusoids/sg.equation/9` (trig_shift_not_divided,
  y = 3cos(x/2 − π) − 1), `#/p/sinusoids/sg.model/5` (a Ferris wheel 90 meters across; trig_amplitude_as_diameter),
  `#/p/otherTrigGraphs/og.features/6` (y = sec(2x) − 3; trig_range_ignores_d), `#/p/otherTrigGraphs/og.match/7`
  (y = −½ sin(2x); trig_reflection_missed, graph A), `#/p/inverseTrig/it.evaluate/8` (arccos(−3/2);
  trig_inverse_outside_domain, π), `#/p/inverseTrig/it.compose/b` (sin(tan⁻¹(12/5)); trig_r_left_out, 12).

## Files

New:
- `src/engine/trig/expr.ts`, `wave.ts`, `shift.ts`, `xset.ts`, `points.ts`, `principal.ts`; tests `expr.test.ts`,
  `wave.test.ts`, `principal.test.ts`, `readers5.test.ts`.
- `src/content/modules/sinusoids/` (`build.ts`, `equation.ts`, `features.ts`, `index.ts`, `model.ts`, `rules.ts`,
  `words.ts`), `src/content/modules/otherTrigGraphs/` (`build.ts`, `features.ts`, `index.ts`, `match.ts`, `rules.ts`,
  `words.ts`), `src/content/modules/inverseTrig/` (`build.ts`, `compose.ts`, `evaluate.ts`, `index.ts`, `rules.ts`,
  `words.ts`).
- `src/content/modules/trig/parts5.ts`, `build5.ts`, `calc5.ts`, `fn5.ts`, `graph5.ts`, `wave5.ts`, `resolve5.ts`
  (test helper); tests `trig5.test.ts`, `trig5.review.test.ts`, `trig5.hand.test.ts`, `calc5.test.ts`.
- `src/components/TrigGraph.tsx`, `trigGraphLayout.ts`; tests `TrigGraph.test.tsx`, `TrigFigure.unit5.test.tsx`.
- `src/pages/flows/TrigFlow.unit5.test.tsx`.
- `docs/progress/trig-unit5.md`.

Changed:
- `src/shared/types.ts` (31 ids, three ModuleIds, `GraphSpec.ticks`), `src/content/types.ts` (the kinds, questions,
  part checks, figure kinds and answer arms), `src/engine/trig/types.ts`, `index.ts`, `reader.ts`,
  `src/engine/matchers/catalog.ts`, `src/components/monsters/species.ts`.
- `src/content/modules/index.ts`, `src/content/courses.ts`, `src/content/modules/trig/parts.ts`, `text.ts`,
  `testkit.ts`.
- `src/components/GraphPanel.tsx` (three lines), `TrigFigure.tsx`, `keypadKeys.ts`; `src/pages/flows/TrigFlow.tsx`,
  `src/pages/Problem.tsx`; `src/problem/tutorContext.ts`; `src/grapher/graphIt.ts`.
- Tests: `src/content/modules/generators.test.ts`, `src/content/courses.test.ts`, `src/pages/Home.test.tsx`,
  `src/grapher/graphIt.test.ts`, `src/problem/tutorContext.test.ts`, `src/components/keypadKeys.test.ts`,
  `src/content/modules/trig/trig2.review.test.ts` (its id slice ends where Unit 5's begin).
- `docs/roadmap.md` (a row for Unit 5).

## Review (Claude, 2026-10-22)

Built by one Claude agent (4 h, 763 tool calls). Checked:
- Twenty-one sample problems by hand (three per template): every amplitude, period, phase shift, midline, range,
  asymptote and x-intercept family, the three model stories (temperature, tide, Ferris wheel) with their values and
  first times, the inverse values, arctan(tan(7π/6)) = π/6, cos(cos⁻¹(−3)) with no value, and the reference triangle
  of cot(cos⁻¹(−6/7)) (y = √13, cot = −6√13/13). All right.
- An independent cross-check of 2,100 problems (300 per template, `trig/unit5.crosscheck.test.ts`), by other roads than
  `resolve5.ts`: features from the function on screen by exact arithmetic on its inner argument (and the Graph it
  function checked against it); the drawn curve and every label of an equation-from-a-graph problem against the answer,
  plus an equation built from the labelled extremes (a cosine from the maximum) that must grade right; which drawn
  curve of the four matches the function; model values and first times by scanning the model from the story's start;
  inverse values from math.js. No differences.
- Answers a textbook accepts, graded right: shifts in words or signed ("π/2 to the right", "-π/4"), ranges as
  intervals or inequalities, equivalent equations (sine for cosine, a negative amplitude with a shifted phase, f(x) =),
  any member of an asymptote family and (2k + 1)π/2, "undefined" or "DNE" for no value. Unsimplified forms get notes.
- On the Android emulator (store build): an equation from a graph (π ticks, labelled extremes off the curve), the four
  matching cards (dashed asymptotes, π/12 ticks), the reference triangle (axes only until the quadrant is answered,
  then the triangle with x and r, y unlabelled until found), and a features graph behind its reveal gate.

Left as is: "3.14" typed for π in an equation is graded wrong rather than noted when the drift passes 1% over two
periods (the note fires for closer decimals); a bare positive phase shift on a left shift is the "wrong way" slip
(Larson's signed convention; the part asks for size and direction).
