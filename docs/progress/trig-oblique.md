# Precalculus Unit 7: oblique triangles (laws of sines and cosines, the ambiguous case, area)

Course `precalc`, unit `unit7` ("Unit 7", "Applications of trigonometry"), module `obliqueTriangles`, "Laws of sines
and cosines" (order 5.9995, after `trigEquations`). Built by one Claude agent on branch `precalc-oblique` in
`C:\work\pre7`, uncommitted for review.

## Why

The honors precalculus class (AP Calculus AB preparation, TI-84 required) reaches triangles with no right angle after
analytic trigonometry. The app had right-triangle trig (Unit 4) but nothing for the laws of sines and cosines, the
ambiguous case or the area formulas.

## What she gets

Five parts templates, every choice from the seed, a figure on every problem, a calculator panel (TI-84 and TI-Nspire,
DEGREE mode first) behind its button as everywhere.

- `ot.sines`: two angles and a side, AAS (the side across from a given angle) or ASA (the side between them, said so in
  the prompt). Part 1: the third angle, typed (exact, "80" or "80°"). Part 2: a requested side by the law of sines, to
  the nearest tenth. On ASA, and on AAS when the side asked is across from the third angle, the third angle is in the
  formula.
- `ot.ambiguous`: SSA with A acute (20° to 70°), b and a. Part 1, a choice: no triangle, exactly one, two. Then B
  (one triangle) or both B's (two: "Angle B, acute", then "Angle B, obtuse"). The seed's plan picks the outcome a
  third each; a is drawn clear of h and of b (at least 5% away), so the right-angle case never comes up.
- `ot.cosines`: SAS (the third side; the included angle obtuse in about a third) or SSS (an angle: "the largest
  angle" in 85% of SSS problems, obtuse in 60% of those). By the plan the largest angle is asked in about 47% of all
  ot.cosines problems and is obtuse in about 28% (tested over 300 seeds: at least 40% and 20%).
- `ot.area`: ½ab sin C (two sides and the included angle) or Heron's formula (three sides).
- `ot.choose`: the givens said in the prompt and drawn; part 1, a choice: the law of sines (AAS, ASA, SSA with one
  triangle), the law of cosines (SAS, SSS), "Neither law: it is a right triangle" (a right angle given as C = 90° and
  drawn with its square: two legs, a leg and the hypotenuse, or an acute angle and the hypotenuse); part 2, the first
  unknown that start gives (the side, B, the third side, the angle, or the right triangle's side), to the tenth.
  The plan gives about 40% / 40% / 20%.

The figure (GeoFigure, unchanged): the triangle at its true shape, the longest side along the bottom so every label
falls outside; the given sides labelled "a = 10", the given angles "40°", the side asked by its letter alone, the angle
asked with an arc and no number. The ambiguous case draws only angle A, side b and the ray side c lies on until she
has answered how many triangles fit; then side a in each place it reaches the ray (B, and a dashed B′), or the dashed
height it cannot reach.

The screen (`src/pages/flows/ObliqueFlow.tsx`) is the TrigFlow parts pattern as rightTriangle uses it, copied (its body
is not exported and draws TrigFigure): parts one at a time, three hint rungs (nudge, rule card with the related ones
folded, worked lines marking the answer shown), entries and the part survive a reload, a named mistake shows title,
lesson, the sentence about her answer and the example, notes log nothing, Check buttons are `btn-chunky`, the keypad
is the trig set (° for angles).

## Named mistakes

17 new ids, all appended to the END of the existing trig species `spin` (The Spinner) in `species.ts`, in this order:

| id | where | what her answer is |
|---|---|---|
| `ot_sines_wrong_pair` | sines, ambiguous, choose | the known side over the sine of the wrong angle (a sin A / sin B for b) |
| `ot_third_angle_skipped` | sines, choose (ASA/AAS) | a given angle used where the third angle belongs |
| `ot_cosines_term_dropped` | cosines SAS, choose | √(a² + b²), the Pythagorean sum |
| `ot_square_root_skipped` | cosines SAS, Heron | c² given as c; s(s − a)(s − b)(s − c) without the root |
| `ot_cos_sign_obtuse` | cosines SAS (C obtuse), SSS (obtuse asked) | the term subtracted as if cos C were positive; the acute supplement |
| `ot_cosines_order` | cosines SAS (C acute) | √((a² + b² − 2ab) cos C), the TI-84 bracket slip |
| `ot_cosines_wrong_side` | SSS | the angle across from another side |
| `ot_sine_acute_taken` | ambiguous, obtuse B | the acute angle sin⁻¹ gives |
| `ot_ssa_second_missed` | ambiguous count | "one" when two fit |
| `ot_ssa_two_claimed` | ambiguous count | "two" when none or one fits |
| `ot_area_half_dropped` | area SAS | ab sin C |
| `ot_area_cosine` | area SAS | ½ab cos C |
| `ot_heron_perimeter` | Heron | the perimeter in place of s |
| `ot_sines_no_pair` | choose | law of sines picked for SAS or SSS |
| `ot_cosines_for_pair` | choose | law of cosines picked for AAS, ASA or SSA |
| `ot_right_missed` | choose | a law picked for a right triangle |
| `ot_right_assumed` | choose | "neither" picked for a triangle with no right angle |

Reused (identical slips): `trig_radian_mode` (the calculator in RADIAN mode, on every calculator part: sides, angles,
areas, the right triangle's ratio), `trig_side_not_rooted`, `trig_pythag_added`, `trig_pythag_subtracted` (the
right-triangle case of ot.choose, the Pythagorean theorem itself), `trig_opposite_adjacent_swapped` (cos for sin in
that case). Not reused: `trig_side_not_rooted` for the law of cosines and Heron, because its lesson and example are
the Pythagorean theorem (a² + b²); `ot_square_root_skipped` names it there.

Rounded too early: each rounded part carries `early` values (sines or cosines to two or three places; c² to the whole
number or the tenth; the ratio a/sin A to the tenth); her number matching one (within 0.05), within 0.25 of the true
value and not the answer at the tenth, gets the note "Close, but not quite: … round only the final answer."
(invalid: nothing logged). Slips within 0.3 of the answer are left out, so a slip and an early value never meet.

## Decisions and exclusions

- **Grading** reuses rightTriangle's rounded-answer code (`engine/trig` `gradeTrigAnswer` through `specOf`). Tolerance:
  right when |her − value| ≤ 0.05 + 1e-9 (half a tenth of the unrounded value), more places fine ("13.47",
  "13.473"), fewer places "rounded too far" (a note), a degree sign on a length a note, "°" optional on an angle. A
  slip is named when exactly one slip is within half a unit of her last place (or of the tenth). The house part
  grader drops non-trig_ slips, so `grade.ts` hands every slip to `gradeTrigAnswer` itself (the id is cast: the
  grader only reads it back). The third angle is an exact `angle` part (house grader).
- **The plan** (a second rng from the seed alone: `planRng`) fixes the outcome or case, the draw picks the numbers, so
  redraws by the gate never tilt the mix.
- **Every drawn triangle is real**: angles sum to 180°, every angle at least 15° and none within 3° of 90° (but the
  right case, exactly one 90°), the longest side at most 90% of the other two. No rounded answer within 0.02 of a
  rounding boundary, none equal to a given number. Draws that fail are redrawn (up to 160 tries per seed).
- **The ambiguous case does not give itself away**: the prompt and the first part read the same for all three
  outcomes; the flow does not count the parts ("Part 1: How many triangles", status "stage 0 of 1") until the count
  is answered; side a is drawn only after it.
- **A acute only** in SSA (the brief decides by h = b sin A); an obtuse A is not drawn.
- **Reserved example numbers**: the rule cards and catalog use the angles 10°, 12°, 158° and 168° (OT_RESERVED_ANGLES),
  plus 90° and 180°; no drawn angle is under 15° or over 150°, so none can be a given or an answer (tested over 300
  seeds per template). Sides on cards and catalog entries are letters only.
- **Rule cards** (9, one idea each): the third angle, the law of sines, the ambiguous case, two angles with the same
  sine, the law of cosines, an angle from three sides, area ½ab sin C, Heron's formula, which law starts (lists all
  three answers, singles out none).
- **Answers are typed without units** (the prompts give none); areas say "square units are understood".
- **Answer type**: a new `AnswerSpec` arm `obliqueTriangles` on `TrigAnswerFields` with `oblique` (the GeoFigure specs)
  and `early`; `figure` is kind `none` and carries the aria label, so the tutor and the house leak checks read it.
  `ObliqueAnswer` joins `TrigAnswer`, so `trigLeaks`/`texLeftovers` take it. The worked example's `carriedFigure`
  compares `oblique`.

## Deviations

- The ambiguous case's figure is not the full triangle before the count part: drawn to true shape it would answer
  that part (with two triangles it cannot be one triangle). It draws the givens, then side a's positions.
- The hand pin A = 30°, a = 5, b = 8 has B = 53.1301°, 0.0199 from the 53.15 boundary (and 126.8699° likewise), just
  inside the brief's 0.02 margin, so the generator would redraw that exact problem; the hand test builds it with the
  template's builder (which applies no boundary check) and pins 53.1 and 126.9.
- The figure is drawn by GeoFigure (no TrigFigure change, which is not this build's file); the flow is its own file
  rather than a wrapper in TrigFlow.tsx.
- `species.ts`: the spin family's sentence gained "and the laws of sines and cosines" (its description of what it
  holds); no variant moved.

## Verification

All in `C:\work\pre7` on 2026-11-11. No code changed after these runs, only this log. The whole suite was not run
(by instruction: the reviewer runs it).

- `npm run typecheck` (app, node and server configs): exit 0.
- `vitest run src/content/modules/obliqueTriangles/obliqueTriangles.test.ts`: 1 file, 32 tests passed (each template
  over 300 seeds through `sweepOt`: deterministic, every answer and spelling right, every slip its own id and never
  the answer, the promised slip real, nonsense not an attempt, no early leak, English everywhere; at least 40
  distinct statements in seeds 1..60; no typed answer over 10%, no right choice over 60%; reserved angles never drawn;
  the ambiguous outcomes each 25-45%; largest angle at least 40% and obtuse at least 20%; both area formulas; every
  law; all 18 named mistakes promised somewhere).
- `vitest run obliqueTriangles.hand.test.ts obliqueTriangles.crosscheck.test.ts`: 2 files, 22 tests passed (the
  brief's six pins and about 20 more by hand, each with its slips and notes; the re-solve from the prompt's words with
  Math only over 300 seeds per template, the figure's labels the givens and its shape true).
- `vitest run --pool=threads src/pages/flows/ObliqueFlow.test.tsx`: 1 file, 19 tests passed (per template: mistake
  named and recorded once, fix, completion with worked lines; unreadable records nothing; reload restores; the early
  note records nothing; the ambiguous case's parts uncounted and side a undrawn before the count; no triangle
  finishes in one part; the chunky Check). The first two attempts with the default forks pool failed to start a
  worker ("Timeout waiting for worker to respond", the laptop busy); `--pool=threads` ran.
- `vitest run --pool=threads` on `obliqueTriangles.review.test.ts` (1000 seeds per template), `courses.test.ts`,
  `generators.test.ts`, `Home.test.tsx`, `species.test.ts`, `coverage.test.ts`, `workedExample.test.ts`,
  `tutorContext.test.ts`, `Chunky.test.tsx`: 9 files, 281 tests passed.
- `vite build --outDir C:\work\pre7\.tmp-dist`: built in 3 min 12 s with the existing chunk-size warning only (Problem
  chunk 556 kB); the folder was deleted.

## Files

New: `src/content/modules/obliqueTriangles/` (`index.ts`, `build.ts`, `common.ts`, `solve.ts`, `figure.ts`, `grade.ts`,
`calc.ts`, `rules.ts`, `words.ts`, `sines.ts`, `ambiguous.ts`, `cosines.ts`, `area.ts`, `choose.ts`, `testkit.ts`;
tests `obliqueTriangles.test.ts`, `.hand.test.ts`, `.crosscheck.test.ts`, `.review.test.ts`),
`src/pages/flows/ObliqueFlow.tsx` and `ObliqueFlow.test.tsx`, this log.

Changed: `src/shared/types.ts` (module id, 17 ids), `src/content/types.ts` (kind, `ObliqueQuestion`, `ObliqueFigure`,
the answer arm, `ObliqueAnswer` in `TrigAnswer`), `src/engine/matchers/catalog.ts` (17 entries),
`src/components/monsters/species.ts`, `src/content/courses.ts` (Unit 7), `src/content/modules/index.ts`,
`src/pages/Problem.tsx`, `src/problem/tutorContext.ts` (four places), `src/problem/workedExample.ts` (five template
ids, the switch, `carriedFigure`). Tests changed: `courses.test.ts`, `generators.test.ts` (69 modules),
`Home.test.tsx` (a first visit lands on Unit 7), `tutorContext.test.ts` (one case).
