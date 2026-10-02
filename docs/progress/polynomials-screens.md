# Polynomials screens (precalculus Unit 2) — shared pieces and the three modules

Three modules are built one after another on the engine core in `src/engine/polynomials`
(`docs/progress/polynomials-core.md`). This file has one section for the pieces all three share, then one
section per module. Nothing here is committed by the builders.

## 0. Shared pieces (builder 1, 2026-10-02)

| What | Where | Use |
|---|---|---|
| 24 `poly_` ids, one per `PolyMistakeKind` | `src/shared/types.ts` (`ErrorPatternId`) | id is always `` `poly_${kind}` `` |
| Catalog lessons | `src/engine/matchers/catalog.ts` (block "polynomials") | title, lesson, wrong → right example for all 24; checked against core §3 |
| Kind → id map | `src/content/modules/polynomials/patterns.ts` | `POLY_PATTERN`, `POLY_MISTAKE_IDS`, `polyPattern(kind, witness?)`, `polyGradePattern(grade)` (PatternHit or null), `polyShow(text)` (ASCII minus → −) |
| Recorder | `src/pages/flows/record.ts` | `recordPolyGrades(grades)`: one press of Check. Any invalid / unsupported part: nothing. All correct: ONE correct record. Otherwise one wrong record per part that is not correct, with its `poly_` id when named |
| Hint ladder | `src/pages/flows/hintLadder.tsx` | `useHintLadder(attempt, done)` → `{ rung, advance }` (rung 3 sets `final.revealed`), `<HintLadder rung nudge card related explanation onAdvance disabled />`, `<NotAnAttemptNotice messages />`. Generalised out of `EconfigPanel.tsx`, which now imports it |
| Feedback | `src/pages/flows/polyUi.tsx` | `<PolyGradeList parts={[{ label, grade }]} />` (if any part is invalid, only the notice; else one card per part), `<PolyGradeCard grade label? />`, `polyBlocked(grades)`, `polyAllCorrect(grades)`, `firstPolyPattern(grades)`, `savePolyEntries(entries)`. Re-exports the hint ladder pieces, so a screen imports from one file |
| Her boxes | `src/store/types.ts` | `AttemptFinal.polyEntries?: Record<string, string>` (additive). A line-by-line problem uses `attempt.steps` and `attempt.draft` instead |
| Tutor | `src/problem/tutorContext.ts` | `verdictFromPoly(grades, line?)`. `POLY_WORK` is the reading order of the boxes; unknown keys follow in stored order |

Adding a module (builders 2 and 3):

1. `ModuleId` in `src/shared/types.ts`, `ProblemKind` and a new `AnswerSpec` member in `src/content/types.ts`.
2. Module folder under `src/content/modules/<id>/`, imported in `src/content/modules/index.ts` after
   `./quadratics` (order 5.7, then 5.8: after `quadratics` at 5.6, before chemistry at 6).
3. `src/content/courses.ts`: add the id to `unit2.moduleIds`.
4. `src/pages/Problem.tsx`: one `case`.
5. `src/problem/tutorContext.ts`: the `workOf` branch for `answer.type === 'quadratics'` is the pattern (steps,
   then `polyEntries`); add your type there and in `statementOf`, `canonicalOf`, `answerOf`.
6. Tests that count: `src/content/modules/generators.test.ts` (module list), `src/content/courses.test.ts`
   (`modulesInUnit(precalc.units[1])`). `src/pages/Home.test.tsx` reads Unit 2's titles from the registry, so it
   needs no edit.

Things that bit:

- **Finish in an effect, not in the submit handler**, when the last thing she did is stored on the attempt as a
  step. `Problem.tsx` keeps a snapshot of the attempt from the last render; calling `finish()` in the same
  handler as `acceptStep` leaves the final line out of the finished page.
- **The rail's graph panel can be opened before she finishes.** A graph that must wait goes in the answer
  spec and is rendered by the flow after `completion`; `instance.graph` stays `{ kind: 'none' }`.
- The hint button's name at rung 2 is "Explain the answer (marks the answer as shown)": match it with a regex.
- Home lands on the LAST unit that has modules, so a first visit to precalculus now opens Unit 2.

## 1. Completing the square (`quadratics`, builder 1)

Files: `src/content/modules/quadratics/` (`build.ts`, `form.ts`, `vertex.ts`, `grade.ts`, `rules.ts`,
`index.ts`, `quadratics.test.ts`), `src/pages/flows/QuadraticsFlow.tsx` (+ test).

- **cs.form** — rewrite ax² + bx + c in vertex form, line by line. Each line goes through
  `checkSquareLine(f, line)`. A line still equal to f is kept (`acceptStep`), a named slip or a wrong line is a
  `step_rejected` (with the `poly_` id), an unreadable line or the line above typed again is not an attempt.
  The problem finishes when the last kept line is vertex form. Undo takes a line back. Lines are the
  attempt's `steps`, so a reload restores them, and the tutor sees them as her work.
- **cs.vertex** — vertex, axis of symmetry, opens up or down, minimum or maximum value: four parts, one
  Check, recorded with `recordPolyGrades`. Vertex and axis are the engine's graders. `gradeOpens` and
  `gradeExtremum` (`grade.ts`) read `completeSquare(f)` and return a `PolyGrade`; a value that is the k of a
  named slip is named by the engine's own `gradeVertex` at the right h, unless her vertex box already shows
  the same number (then it is a plain "this follows from your vertex", so one slip is one lesson).
- **Problems.** The template picks a, p = b/a and c; everything else is `completeSquare`. a = 1 about 37 %,
  otherwise 3, −2, −1 (weight 3 each), 1/2 (2), 2 (1). p is even (whole-number h); with the `fractions` knob
  (URL flag `f`) p is odd and a is a whole number. Redrawn until the engine says k ≠ 0, |k| ≤ 40, and the
  vertex is off y = x (`vertexMistakes` lists both `cs_h_sign` and `cs_vertex_swapped`). b and c are never 0.
- **Self-tests** (`quadSelfTest`, run inside `generate` and cached per f): core §5's list, plus only the last
  path line may be `done`, and the explanation is the path reasons plus three closing lines.
- **Trap.** One kind picked from the engine's candidates for the question (`quadTrapKinds`); its rule card
  leads the hint ladder. Stored as `answer.trap` and `params.trap`.
- **Hints.** Nudge (method, no numbers), the module's rule card for the slip just named (else the trap's),
  then the engine's path with reasons (`answer.reveal`).
- **Graph.** `answer.graph`: the parabola sampled through the vertex, vertex labelled, drawn with the existing
  `SampledGraph` (through `GraphPanel`) only after completion. Chosen over function-plot's `Graph` because it
  can mark a point and does not need a square window.
- **Calculator.** `cs.vertex` only: Y1, a window around the vertex, then 2nd TRACE (CALC) minimum / maximum
  on the TI-84 and Analyze Graph on the Nspire. `cs.form` has none.

Open points for the reviewer:

- The engine's `wrong` messages and `mistake` witnesses for the vertex and the axis state the right answer
  (core §6 says so). After one wrong check she can copy it; the attempt is already marked not-first-try.
- A legal line typed with y on the right (`2(x − 3)^2 − 5 = y`) is kept but does not finish the problem: the
  engine's `done` is true only for the expression or `y = …` / `f(x) = …`.
- With every unit now holding modules, Home's "Coming soon" unit state has no test left.

## 2. Synthetic division (`polyDivision`, builder 2, 2026-10-02)

Files: `src/content/modules/polyDivision/` (`build.ts`, `grade.ts`, `rules.ts`, `table.ts`, `value.ts`,
`factor.ts`, `index.ts`, `polyDivision.test.ts`), `src/pages/flows/PolyDivisionFlow.tsx` (+ test). Registered at
order 5.7, listed under precalc `unit2` after `quadratics`. No graph and no calculator panel.

Every problem is answered in **parts**, one Check each; the next part is not on the page until the one before
is right (a table drawn early would say how many numbers the top row needs).

- **sd.table** — (1) the coefficient row as a free list, `gradeCoefficientRow`; (2) the table: the checked row
  printed, inputs for the box, the products and the bottom row, graded with `gradeSyntheticTable({ box,
  products, bottom })` through `gradeDivisionTable`; (3) quotient and remainder, `gradeQuotient` and
  `gradeRemainder`, two boxes and one Check.
- **sd.value** — (1) the bottom row as a list, `gradeBottomRow`; (2) f(c), `gradeRemainder(..., { ask: 'value' })`.
- **sd.factor** — (1) the bottom row as a list; (2) yes or no, `gradeIsFactor`, 44 px radio buttons.

How it is built:

- **Problems.** A template picks the degree (3, or 4 about a third of the time), the box number c (±1, ±2,
  ±3; negative a little more than half the time, so the divisor is x + k), the leading coefficient and the
  middle coefficients, with one middle power set to 0 when the seed wants a missing power. The constant is
  picked too, unless a remainder is wanted (sd.factor): then it is the opposite of the remainder the ENGINE
  reports for f without its constant term. Redrawn until every cell of the engine's table is a whole number of
  at most 60 in size. Everything else is `syntheticDivision(f, c)`.
- **Scenarios and traps.** sd.table: placeholder / sign (x + k) / columns / read. sd.value: theorem / sign /
  placeholder / columns. sd.factor: factor (50 %, always with f(−c) ≠ 0, so a wrong "no" is the named sign
  slip) / opposite (f(c) ≠ 0 but f(−c) = 0, so a wrong "yes" is the named slip) / plain. The promised kind is
  checked against `sdTrapKinds(f, c, question)`, which reads the engine's `syntheticMistakes`,
  `quotientMistakes`, `remainderMistakes` and `gradeIsFactor`. `shadows` count only on the table screen, the
  one that collects the box and the products (core §4). `sd_first_coefficient` is never promised with c = 1.
- **Self-tests** (`sdSelfTest`, run inside `generate`, cached per f and c): core §5's list, plus the
  coefficient row, the bottom row as a list, c ≠ 0, degree ≥ 2, and the explanation having degree + 6 lines
  (the hint reveals are cut out of it by position).
- **Empty cells.** `gradeDivisionTable` returns the engine's grade and the cell to focus. The engine stops at
  a wrong box before reading the rows, so the rows are read once more without the box: a table with a hole in
  it is never an attempt, whatever the box says.
- **Hints.** One ladder per part (`useHintLadder(attempt, done, partIndex)`), so a hint opened for the top row
  does not open by itself on the table. Nudge and reveal are per part (`answer.stages[i]`); the reveal is the
  slice of the engine's explanation that answers that part. The rule card is the one for the slip just named,
  else the part's own.
- **What a right part says.** The engine's sentence for a right table states the quotient and the remainder,
  which the next part asks for. A passed part therefore shows a plain "✓ The table is right" and the engine's
  sentences appear only after the last part, with the whole explanation.
- **Recording.** `recordPolyGrades` once per Check. A check that is not all correct also sets
  `final.firstCorrect = false`: first try means every part right the first time, not only the first part.
- **Stored.** `AttemptFinal.polyEntries` (keys in `SD_KEYS`: `row`, `box`, `p1…`, `b0…`, `quotient`,
  `remainder`, `bottom`, `value`, `factor`) and the new `AttemptFinal.polyStage` (parts checked right).
- **Tutor.** `divisionWork` writes her cells as rows ("products row: 4, _, 4"), not one line per cell.

Shared pieces added for builder 3:

| What | Where | Use |
|---|---|---|
| `PolyTextBox`, `PolyChoice` | `src/pages/flows/polyUi.tsx` | the labelled 48 px answer box and the 44 px radio group, moved out of `QuadraticsFlow.tsx` (which now imports them). `PolyTextBox` takes `inputRef`, `PolyChoice` takes `firstRef` |
| `AttemptFinal.polyStage` | `src/store/types.ts` | a problem answered in several parts: how many are right so far |
| per-part hint ladder | `useHintLadder(attempt, done, key)` | pass the part index as `key` |

Open points for the reviewer:

- The remainder cell is not marked off in the table (core §5 draws a divider before it). The divider would
  tell her which number is the remainder, and that is the slip part 3 is there to catch.
- Engine messages for a `wrong` verdict state the right number ("then add 0 + 2 = 2, not 3"; "Your answer, 3,
  is not −1"). They are shown as specified.
- The engine's "type the row first" notice gives the example "2, 1, 2, -1", four numbers, whatever the degree.
- Fractional c (dividing by 2x − 1 with 1/2 in the box) is not offered; it would be a knob on these templates.
- Screens are verified by jsdom tests only; nothing was opened in a browser.

## 3. Zeros and end behavior (`polyZeros`, builder 3, 2026-10-02)

Files: `src/content/modules/polyZeros/` (`build.ts`, `grade.ts`, `rules.ts`, `zeros.ts`, `end.ts`,
`fromZeros.ts`, `rational.ts`, `index.ts`, `polyZeros.test.ts`), `src/pages/flows/PolyZerosFlow.tsx` (+ test).
Registered at order 5.8, listed under precalc `unit2` after `polyDivision`. `ModuleId` and `ProblemKind` gain
`'polyZeros'`; `AnswerSpec` gains a `type: 'polyZeros'` member. No new `AttemptFinal` field: the boxes are in
`polyEntries`, the part she has reached in `polyStage`.

Four templates, answered in parts like synthetic division (one Check per part, a later part is not on the
page until the one before is right, one hint ladder per part):

- **pz.zeros** — (1) her own table of zeros: a zero box and a multiplicity box per row, starting with ONE row
  and an "Add another zero" button (a pre-drawn table would say how many zeros there are), `gradeZeros` with
  her rows; (2) crosses or touches at each zero, 44 px radios in the order of `analyzeFactored(f).zeros`,
  `gradeCrossTouch`. Graph of f after she finishes. Calculator panel.
- **pz.end** — the left end and the right end, up or down, one check, `gradeEndBehavior`. f is shown factored
  (about 55 %) or multiplied out. Graph after she finishes. No calculator panel.
- **pz.build** — zeros with multiplicities and one more point; she types a formula in the math input with the
  live preview, `gradePolynomialFromZeros`. No graph, no calculator panel.
- **pz.rational** — (1) every possible rational zero in one text box, `gradeRootCandidates` (what she typed is
  read back with ± under the box); (2) the candidates that are zeros, or "none", `gradeRationalZeros`.
  Calculator panel. The instructions say how to type ±: `"+-1, +-3"`.

How it is built:

- **Problems.** The templates pick the numbers inside the factors and the number in front; `makeFactored` →
  `factoredFormText` → `analyzeFactored` do the rest. `drawFactored` (build.ts) never gives two whole-number
  zeros the same size, so no two zeros are opposites, and it redraws until `zeroMistakes` lists a sign slip
  for every zero away from 0 with no `shadows`. pz.zeros: 2 or 3 zeros, degree 3 to 6, always one even and
  one odd multiplicity; a factor with a number in front of x (2x − 1, 3x + 2, …) on about a third of the
  seeds, a factor x^m on about a tenth. pz.end in standard form is `analysis.expandedText` of a small
  factored polynomial (degree 3 to 5, coefficients of 60 or less), so its graph meets the x-axis inside the
  window. pz.build: 2 or 3 whole-number zeros, one repeated, a whole number in front that is not 1; the
  point's height is `polyValueAt(expandFactored(...), x)` and the engine must then recover the same number in
  front from the zeros and the point. pz.rational: a cubic multiplied out by the engine from three linear
  factors (70 %), or picked coefficients with exactly one rational zero (20 %) or none (10 %); leading
  coefficient 2, 3, 4 or 6, at most 16 candidates, constant never ± the leading coefficient.
- **Traps.** `pzTrapKinds(problem)` reads the engine's lists (`zeroMistakes`, `endBehaviorMistakes`,
  `polynomialFromZerosMistakes`, `rootCandidateMistakes`). The engine has no list for the multiplicity,
  crosses / touches and "every sign backwards" slips, so each of those is put to the grader as the answer the
  slip gives (all multiplicities 1; the exponents moved round the zeros; one choice flipped; every rational
  zero negated) and counted when it comes back named.
- **Self-tests** (`pzSelfTest`, run inside `generate`, cached): core §5's list per question, plus what §5 says
  to avoid. `buildZerosProblem` also puts the canonical answers through the module's own `gradeZerosStage`.
- **Not an attempt.** `gradeZerosStage(answer, stageId, entries)` returns the engine's grade and the box to
  focus. Three notices are the module's own, because the engine's version would mislead: an empty zeros
  table, an empty list (the engine says "like +-1, +-3, +-1/2", which can be most of the answer), and a zero
  with no multiplicity (the engine grades the zeros alone when no row has one, and would call it correct).
- **Hints.** Nudge and reveal per part (`answer.stages[i]`); the rule card is the one for the slip just named,
  else the part's own. On pz.zeros both parts reveal the same engine lines (one per zero: its factor, its
  multiplicity and what the graph does there).
- **Graph.** `answer.graph` is `{ kind: 'function', f, xDomain }` on a square window that holds every zero,
  drawn by the existing `Graph` component through `GraphPanel`, only after completion. `instance.graph` stays
  `{ kind: 'none' }`.
- **Calculator.** pz.zeros: Y1, the table in Ask mode for a zero, then the zero tool on the graph (with the
  note that the TI-84 tool needs a sign change, so it fails where the graph only touches). pz.rational: Y1
  and the table in Ask mode, one candidate at a time. The steps never name a zero or a candidate.
- **Stored.** `polyEntries` keys (`PZ_KEYS`): `rows`, `z0…`, `m0…`, `c0…`, `left`, `right`, `formula`,
  `candidates`, `rational`.
- **Tutor.** `zerosWork` writes her rows as "zero 1: -4, multiplicity 2", her choices as "at x = -4: touches".
  For pz.build the statement is the zeros and the point (`statementText`) plus the prompt; f is the answer.

Open points for the reviewer:

- Saying how to type ± in the instructions (as the brief asks) also tells her that candidates come in ±
  pairs, so `rrt_no_plus_minus` is rarely the promised trap (weight 1 of 11).
- The engine's messages for a wrong multiplicity and for a sign slip state the right number ("3, not 2";
  "x = −1, not 1"). They are shown as specified. Missing zeros are not given away.
- On pz.zeros the third hint rung of part 1 also says what the graph does at each zero (part 2's answer); the
  attempt is already marked as shown by then.
- The graph window is square (the `Graph` component's own), so the humps between zeros run off the top or
  bottom. What it is there to show (crossing or touching at each zero, where the ends go) is in view.
- Screens are verified by jsdom tests only; nothing was opened in a browser.
