# Precalculus Unit 4, first half: angles, radians and the unit circle

Course `precalc`, unit `unit4` ("Unit 4", "Trigonometric functions"), after Unit 3. Built by one Claude agent on
branch `precalc-trig1` in `C:\work\trig` (outside OneDrive), uncommitted for review. A second build adds the reverse
problems, right-triangle trig and the special triangles.

## Why

The honors precalculus class (AP Calculus AB preparation, TI-84 required) finishes exponentials and logs this month
and starts trigonometry next. The app has to cover the whole year before it is published.

## What she gets

Two modules, six templates, every problem drawn from the seed (the angle, its unit, the turns, the function, the
radius, the point), checked by a new exact core, with a figure on every problem that has an angle.

- `angleMeasure`, "Angles and radian measure" (order 5.993)
  - `am.convert`: degrees to radians, exactly (multiples of 15°, and 10°, 12°, 18°, 20°, 24°, 36°, 40°, 72° steps:
    72° → 2π/5) and radians to degrees (kπ/n, n = 2, 3, 4, 6, 12, 5, 9, 10, 18), negative angles and angles past a
    turn included; about one problem in four asks for a decimal (2.5 radians to degrees to the nearest tenth; 40° to
    radians to the nearest hundredth). Slips: π dropped, π kept in degrees, the factor upside down.
  - `am.coterminal`: the angle in [0°, 360°) or [0, 2π) for an angle past a full turn either way (−665°, 23π/6,
    −11π/4). Slips: half turns (±180°, ±π), one turn short, a negative angle turned counterclockwise, π dropped.
  - `am.reference`: two parts, where the terminal side lies (Quadrant I–IV or "On an axis"), then the reference angle
    in the angle's own unit. About one problem in twenty-five is on an axis: one part, no reference angle. Slips:
    measured to the y-axis, subtracted the wrong way (negative, or the Quadrant III rule in IV), the coterminal angle
    given as the reference angle, π dropped; for the quadrant, the negative direction and half turns.
  - `am.arc`: arc length s = rθ or sector area A = ½r²θ, θ in degrees, as a multiple of π, or a plain number of
    radians; exact in terms of π or rounded; word problems (a pendulum, a clock's minute hand, a bicycle wheel, a lawn
    sprinkler, a pizza slice) or a plain circle. Slips: degrees used in the formula, 180/π, the ½ dropped, r not
    squared, arc and sector swapped, π dropped.
- `unitCircle`, "The unit circle and trig functions of any angle" (order 5.994)
  - `uc.exact`: one of the six functions at a multiple of 30° or 45°, in degrees or radians, any quadrant, coterminal
    forms (13π/6, −225°) and the axes (with values that do not exist). Slips: the wrong sign for the quadrant, sin and
    cos swapped, tan upside down, a reciprocal mixed up or missing, 0 for "undefined" and "undefined" for 0.
  - `uc.point`: a point on the terminal side (whole-number distances from Euclid's formula, or small coordinates that
    leave a radical, (−2, 3) → √13); r first, then one, two or three of the six functions. Slips: r squared but not
    rooted, r left out, the signs of the coordinates dropped, sin/cos swapped, tan upside down, reciprocals.

The screen (`pages/flows/TrigFlow.tsx`, kinds `angleMeasure` and `unitCircle`) is the parts pattern of the Unit 3
second half: parts one at a time, three hint rungs per part (the third shows the worked lines and marks the answer
shown), entries and the part she is on survive a reload, a named mistake shows the catalog title, lesson, her witness
and the wrong → right example, and a check that does not count says so and logs nothing. Every formula and angle on
the screen is KaTeX (the prompt, each part's question, the nudge, the worked lines, a "reads as" preview of her
entry); headings stay plain text (KaTeX in a heading breaks its accessible name in jsdom). The figure
(`components/TrigFigure.tsx`): the unit circle with the terminal side, the angle's arc with an arrow (clockwise for a
negative angle, a widening spiral past a full turn); axes with the point, the terminal side through it, r as a letter
and the drop to the x-axis for `uc.point`; a circle with the central angle and its bold arc or shaded sector for
`am.arc`. The reference angle (dashed, gold) is drawn only once she has answered it, or finished. The calculator panel
(behind its button, as everywhere): MODE to DEGREE or RADIAN first, then the keys (the ANGLE menu's ° and r for
conversions; 1 ÷ SIN( … ) for csc), then a decimal check of her exact answer; TI-Nspire steps as well. The keypad set
`KEYPAD_SETS.trig`: π, √, °, "undefined" (one tap in, one tap out), then sin, cos, tan, csc, sec, cot.

## Design decisions for review

- **The core is imported as `@/engine/trig`.** The brief keeps `src/engine/` closed outside the new folder and the
  catalog, so `src/engine/index.ts` does not re-export it.
- **Exact values are c·√m·πᵏ** (c rational, m square-free, k a whole number): every special value, every ratio of a
  whole-number point (3√13/13), radian measures, arc lengths, and the values slips give (27000/π, π²/216). Angles are
  exact rationals of degrees. No float is compared in the exact paths.
- **What counts as right.** Every equal exact form: √3/2, sqrt(3)/2, (1/2)√3, 1/2√3 (read left to right, as on a
  TI-84), 0.5 for 1/2 (a decimal that ends is the exact number it names), 2/4 for 1/2 and 10π/12 for 5π/6 (rational
  forms are not "radical form"), "undefined", "undef", "DNE", "does not exist". A name before the answer ("sin θ =",
  "r =", "s =") and a unit after it ("cm", "square feet", "ft²") are dropped; a box labelled with another function is
  a note.
- **Not an attempt (a note, nothing logged).** An equal value not in simplest radical form (1/√2, √12/2, √4,
  (2√3)/6, √2·√3, √(3/4), 3^(1/2)); a sum not combined (2π − π/6: equal, but not one number); a calculator decimal
  where the exact value is asked (−0.866, 2.618); the exact value where a rounding is asked; a number rounded too far;
  the wrong unit (150° when radians are asked, 5π/6 when degrees are); a degree sign on a value; a box labelled with
  another function; unreadable input (sin(30°), y/r, ∞, 1/0). A non-simplest form that equals a slip's value names
  the slip (1/√2 for csc 45° is "sin itself").
- **Notes say what to fix and never repeat a number.** The form note does not echo her input (it is in her box above),
  and no reader message carries an example value, so no message can spell an answer.
- **Rounded answers** (conversions, arcs): anything within half a unit of the last place asked is right, more places
  too (143.24 for 143.2); fewer places is "rounded too far" when it is right to its own places. A slip is named at the
  places asked or at her own places, only when exactly one slip fits. A slip that rounds to the answer, or to an
  earlier slip, is left out for that problem.
- **Two ids for 0 and "undefined"** (`trig_zero_for_undefined`, `trig_undefined_for_zero`): one id with one example
  would have shown "zero ✗" on problems whose answer is 0.
- **Seven ids beyond the brief's list**, each seen in the work: `trig_pi_kept` (150π for 150°),
  `trig_negative_direction` (−θ turned counterclockwise; quadrant and coterminal), `trig_reference_is_coterminal`
  (stopping at the terminal side), `trig_reciprocal_missing` (sin for csc), `trig_r_not_rooted` (x² + y² for r),
  `trig_arc_sector_swapped`, and the 0/undefined split above. 22 trig_ ids in all.
- **Promised slips.** A template promises a slip wherever one is possible. Two kinds of problem have none: 650°-type
  coterminal angles (one turn, and two half turns land on the answer as well; about one in nine coterminal problems)
  and the axis problems of `am.reference`. The 27000/π, π²/216 and 172800/π values of the inverted factor are named
  when typed but never promised (nobody types them by accident); on rounded problems the inverted factor is promised.
- **Leaks.** Rule cards, format hints, instructions and catalog entries give the method in words and letters and never
  a value: no "1/2", "√3/2" or "undefined" anywhere a template's answer could be one of them (the special-triangle
  card says "half the hypotenuse" and "the square root of three"). The only digits on cards are the fixed numbers of a
  turn (90°, 180°, 360°, 2π), so conversions never ask for ±180°/±360°/±π/±2π and a coterminal angle is never on an
  axis. Every generated problem passes the gate (`trig/parts.ts` `assertTrigProblem`): each answer and spelling right,
  each slip its own id, the promised slip real, nothing she sees before a part (or any message she can retry on)
  spelling it, no TeX left in the words. A problem that fails is redrawn from the seed. Problems whose prompt shows the
  answer are therefore not shown (sin 0°, the reference angle of 15°, the point (3, 9) with tan θ asked).
- **Generation from the seed, without skips that tilt the mix.** A rare value (π/8 is 22.5°, a numerator not in
  lowest terms) is redrawn from the same generator instead of skipping the problem; only the gate skips. The answer
  share stays under 10% (worst: √3/2 at 8% of `uc.exact`).
- **The reference angle of an axis angle is not asked**: those problems stop after "On an axis".
- **The quadrant is a choice** of five ("Quadrant I" … "IV", "On an axis"), so the axis is always a possible pick.
- **Text**: math strings hold KaTeX between dollar signs; `trig/text.ts` `plain` reads the TeX this unit writes back
  as words for the tutor, the leak checks and the tests (a test fails on any TeX left in the words).
- **Not changed outside the unit**: `record.ts` (one function added), `tutorContext.ts` (the two kinds wired),
  `Problem.tsx` (two cases), `keypadKeys.ts` (one key set), `courses.ts`, `modules/index.ts`, `shared/types.ts`
  (22 ids, 2 module ids, additive), `content/types.ts` (additive), the catalog (22 entries).

## Engine API (`src/engine/trig`, import `@/engine/trig`)

- Exact numbers: `q`, `tx(c, root, pi)`, `exactText` ("√3/2", typed), `exactAscii` ("sqrt(3)/2"), `exactSay`
  ("−√3/2"), `exactTex`, arithmetic (`exactMul`, `exactDiv`, `exactAdd` for like terms, `exactSqrt`, `exactPow`).
- Angles (`{ deg: Q, unit }`): `radiansOf`, `measureOf`, `angleText`/`angleSay`/`angleTex`, `placeOf` (quadrant or
  axis), `coterminalDeg`, `referenceDeg`, `turnsTo`, and the slip angles `halfTurnSlipDeg`, `oneTurnShortDeg`,
  `negativeDirectionDeg`.
- Values: `unitPoint(deg)` (cos, sin) at a multiple of 30° or 45° (null elsewhere), `trigValue(fn, deg)`,
  `pointR(x, y)`, `pointValue(fn, x, y)`, `ratioOf`; 'undefined' where the bottom is zero.
- Reader: `readTrigAnswer(text, { units })` → `{ kind: 'undefined' }` or `{ kind: 'number', exact, approx, degrees,
  radians, decimal, plain, hasPi, hasRoot, issue, tex, fn }`, or `{ ok: false, message }`; `formNote(issue)`.
- Slips (each in detection order, the ones equal to the answer left out, later duplicates shadowed):
  `conversionSlips`, `conversionDecimalSlips`, `coterminalSlips`, `placeSlips`, `referenceSlips`, `valueSlips`,
  `rSlips`, `pointSlips`, `arcSlips` (with the matching `…Answer` functions).
- Grader: `gradeTrigAnswer(spec, typed, candidates)` with `spec` an exact angle in a unit, an exact value (with the
  function the box is for and unit words), or a decimal with its places → `correct | mistake | wrong | invalid`.

## Log

- [done] read CLAUDE.md, BUILD_GUIDE, roadmap, the explog core and content logs, the expModels / ExpLogPartsFlow
  pair, the geometry reader and grader, the catalog, the keypad sets and courses.ts.
- [done] engine: exact numbers, angles, the hand table of special values (degrees, and the radian names by hand),
  the reader, the slips, the grader; 105 tests (the independent table, a Math.sin/cos oracle at every multiple of 15°
  from −720° to 720°, 27 hand-worked anchors).
- [done] catalog: 22 trig_ entries, numbers in words.
- [done] content: the two modules, the shared trig helpers (text, parts and gate, figure specs, calculator steps).
- Found while building: a witness that quoted her negative reference angle ("−π/6 is negative") spelled the answer
  π/6: the sentence no longer quotes it. The reader's example values (2√5/5, √3, like 150°, r = 5) and the form note
  echoing her input spelled answers in the 2000-seed retry sweep: messages now carry no numbers.
- Found while building: skipping a draw for a rare value (a numerator not in lowest terms, π/8) tilted the mix (35%
  decimal conversions instead of 25%, 26% axis problems instead of 8%): draws now redraw from the same generator.
- Found while building: "a wheel has a radius of 23 meters"; the wheel is now a bicycle wheel (10–16 in, 25–40 cm).
  The coterminal template had negative angles within one turn (−305°); every angle is now past a full turn either
  way, as the brief asks.
- [done] screen, figure, keypad set, records, Problem.tsx, tutor context, Unit 4 on Home; tests, the phone keypad
  case included.
- [done] typecheck, the whole suite once, the build once (see Verification).

## Not done

- No browser or device check (by instruction: no dev server, no browser). The figure's label placement was checked in
  jsdom only (no overlap test); a spiral's label and a small angle's label are the two places to look at on a phone.
- The arc's unit words are read only in the form the problem uses (an area typed with a length unit is a note that
  cannot read the unit, not a named slip).
- The Progress page lists trig mistakes with the others (as for Unit 3).
- The second half (reverse problems, right-triangle trig, the special triangles) is the next build.

## Verification

- `npm run typecheck` (all three configs): exit 0.
- The whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=4`: 263 files, 4,525 tests, all green
  (932 s). The new files alone: 16 files, 192 tests; plus one new case each in `tutorContext.test.ts` and
  `keypadKeys.test.ts`, and the count tests above.
- `vite build --outDir C:\work\trig\.tmp-dist`: built (18 s), the existing chunk-size warning only (main chunk
  2,854 kB, Problem chunk 389 kB); the folder was deleted.
- What the tests cover:
  - the core against a hand-written table of all six functions at every multiple of 30° and 45° in one turn, the
    same angles written in radians (the names by hand, read back), every angle a turn or two either way, and Math.sin
    and Math.cos at every multiple of 15° from −720° to 720°; points from Pythagorean triples and with radicals
    against Math.atan2; 27 hand-worked anchors through the grader (150° = 5π/6; −510° → 210°; the reference angle of
    7π/6 is π/6; sin(−225°) = √2/2; tan(3π/2) undefined; (−3, 4): r = 5, cos θ = −3/5; a 6 cm radius and 2π/3 give
    4π cm; …) and 23 more through the content builders, with the slip each names and the worked lines;
  - each template over 300 seeds (`trig/testkit.ts` `sweep`): deterministic; every answer and every listed spelling
    right; every slip its own id and never the answer; nonsense not an attempt; the promised slip a real candidate
    that grades as its id; a slip promised wherever one is possible; nothing she sees before a part spells it; an
    independent re-solve from what the problem shows (the figure's angle, radius and point, with Math) agrees; at
    least 25 distinct problems; no answer above 10% of seeds; every slip of the brief promised somewhere;
  - 2000 seeds per template (`trig.review.test.ts`): no catalog example or lesson, rule card, format hint,
    instruction, prompt or figure label spells an answer; part by part no question, hint, nudge, slip sentence,
    catalog entry or plain note spells that part's answer or a later one; the messages for 25 kinds of retry (a
    decimal, a non-simplest form, the wrong unit, a function left in, ∞, 1/0, …) never do, an answer ending a sentence
    counted as shown; every equal exact form and every rounding with more places is right;
  - jsdom: per template a named mistake (title, lesson, witness, example; one record when checked twice), the fix,
    the records, completion with the worked lines in KaTeX; an unreadable answer records nothing; a reload restores
    the entry and the part; the reference angle drawn on the figure only after she answers it; the hint ladder; the
    KaTeX preview of her entry; one problem of each answer kind finished on the phone keypad alone (√ and π from the
    context row, "undefined" in one tap, the ° key); the figure's geometry (terminal side, direction, spiral, point,
    sector, the hidden reference angle).

## Files

New, the core (`src/engine/trig/`): `rational.ts` (exact fractions), `exact.ts` (c·√m·πᵏ), `angle.ts` (units,
quadrant or axis, coterminal and reference angles, the slip angles), `values.ts` (the six functions at the special
angles and from a point), `reader.ts` (her answers, the form she wrote, the KaTeX preview), `slips.ts` (every named
slip per question, with its sentence), `grade.ts`, `types.ts` (the 22 ids), `index.ts`; tests `exact`, `angle`,
`values` (the hand table), `reader`, `slips`, `grade`, `trig.anchor` (hand-worked), `catalog`.

New, the content: `src/content/modules/trig/` (`text.ts` math strings and leak checks, `parts.ts` the part grader and
the gate, `figure.ts`, `calc.ts` the calculator steps, `testkit.ts` test helpers: the 300-seed sweep and the
independent re-solve; tests `text`, `calc`, `trig.review` (2000 seeds), `trig.hand`), `angleMeasure/` (`index.ts`,
`build.ts`, `rules.ts`, `angleMeasure.test.ts`), `unitCircle/` (`index.ts`, `build.ts`, `rules.ts`,
`unitCircle.test.ts`).

New, the screen: `src/components/TrigFigure.tsx` (+ test), `src/pages/flows/TrigFlow.tsx` (+ test).

Changed: `src/shared/types.ts` (22 `trig_` ids, module ids `angleMeasure` and `unitCircle`), `src/content/types.ts`
(the two kinds, `TrigPart`, `TrigPartCheck`, `TrigPartTrap`, `TrigFigureSpec`, the two answer arms),
`src/engine/matchers/catalog.ts` (22 entries), `src/content/courses.ts` (Unit 4), `src/content/modules/index.ts`
(registration), `src/components/keypadKeys.ts` (`KEYPAD_SETS.trig`), `src/pages/Problem.tsx` (the two flows),
`src/pages/flows/record.ts` (`recordTrigPartGrade`), `src/problem/tutorContext.ts` (`verdictFromTrigPart`, work,
statement, worked lines, answer). Tests changed: `keypadKeys.test.ts` (the trig set), `courses.test.ts` (Unit 4),
`generators.test.ts` (43 modules), `Home.test.tsx` (a first visit now lands on Unit 4), `tutorContext.test.ts` (one
case for both kinds).

## Review (Claude, 2026-10-21)

Built by one Claude agent (about 0.87M tokens, 2 hours, 354 tool calls). Read the design notes, the engine API, the
reader's verdicts and the flow; checked the math independently and the screens on the Android emulator in a store-app
build.

- **Answers, independently:** 3000 problems (500 per template) re-solved from the words and math of the prompt the
  student reads (not from the figure or the engine), with floating point and mathjs only: conversions (exact and
  rounded), coterminal angles, the quadrant and the reference angle in the angle's own unit, arc lengths and sector
  areas, the six functions at special angles, r and the ratios of a point, and the parts each prompt asks for. No
  mismatch. 36 of them also checked by hand.
- **The reader, by hand:** equal forms are right (−sqrt(3)/2, −(1/2)√3, 0.5, 2/4, 10π/12, 5/6π, "r = 10",
  "cos θ = 3/5", units after an arc); calculator decimals, a root in the denominator, √100 and a sum not combined are a
  note that logs nothing; the slips are named (sign, sin/cos swapped, tan upside down, reciprocal, π dropped, r not
  rooted, degrees in the arc formula, the coterminal angle as the reference angle, the negative direction); 0 for a
  value that does not exist is named, and undefined, undef, DNE, none and "no value" are all right.
- **On the emulator:** Unit 4 on the module pages; the exact-value screen with its figure (240° in Quadrant III), the
  trig keypad (π, √, °, undefined, the six functions), "−√3" named as the quadrant's sign with ASTC, then √3 right,
  +35 XP and the reference angle drawn in gold; the sector and point figures; the quadrant choice.

Changed in review:
- The figure drew the angle in standard position, so "Where does the terminal side of 29π/6 lie?" was answered by the
  picture. Until she has answered the quadrant, the figure is the unit circle and its axes (and says so); the angle
  then appears, and the reference angle still waits for its own answer.
- A point's label went diagonally outward, the way the ray runs on past the point, so the arrowhead covered "(−3, 4)".
  It now sits across the ray on the side away from the x-axis, as far out as it is wide; a test renders 196 points.
- The arc calculator panel said where π is on keys without π, and offered "Check your exact answer" on a rounded
  answer.
- The trig Check buttons get the phone juice's chunky press, and a test now fails on any flow's submit button
  without it.

Left: "½" typed as one character is not read (the keypad has no such key); the exact-value format hint says "type
the word for that" instead of naming "undefined" (the keypad has the key, and every common word is accepted); the
figure shows the quadrant on exact-value problems, which helps with the sign (as a sketch would).
