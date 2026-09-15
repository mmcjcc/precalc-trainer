# Browser QA log (2026-09-15)

Dev server `npm run dev` (port 5173), desktop width 1280, driven through the preview pane. Fixed-seed
problems so the lines are reproducible:

| Problem | Path |
|---|---|
| Distribute inequality `3(x + 4) < 9` | `#/p/inequalities/ineq.distribute/9ix` |
| Compound inequality `-2 < 2x + 2 <= 0` | `#/p/inequalities/ineq.compound/ll` |
| Number line `x < -3 or x >= 8` | `#/p/numberLine/nl.read/39u` |
| Even/odd `4x^3 + 3x^2` | `#/p/evenOdd/evenOdd.poly/v` |
| Linear inverse `y = -3x + 3` | `#/p/inverses/inv.linear/1k8` |
| Quadratic, not one-to-one `y = -4x^2 + 4` | `#/p/inverses/inv.quadratic-not/2r` |
| Möbius inverse `y = (-3x - 4)/(x + 5)` | `#/p/inverses/inv.mobius/39u` |

## Verified in the browser

- Home lists all five modules; no console errors.
- **Inequality:** a correct distribute step is accepted with the chip prompt. An unflipped-direction
  line is rejected with a counterexample and both sides' values. Progress moves 0 → 1 → 2 → 3 of 3,
  the final-answer card opens only when x is isolated, and interval + set-builder complete the problem
  (events: two correct final answers, problem_done). A reload mid-problem restores the attempt.
- **Number line:** the label reads "open dot at -3, ray to the left; closed dot at 8, ray to the
  right". A dropped ∪ gets "Check character 12: Two separate pieces need U (union)". A bracket slip
  gets "x = -3 is in your interval but not in your set-builder". The right answers complete.
- **Even/odd:** a non-substituted f(−x) is rejected with the slot hint; the substituted line, its
  simplified rewrite and −f(x) are accepted and stored per slot; the verdict unlocks; "neither" asks for
  a reason; the right verdict shows the ±k plug-in table and completes.
- **Inverse (one-to-one):** "Yes" is graded correct and saved; renaming only one letter gets "Swap
  BOTH letters"; the swap, a skipped-step jump to `y = (x - 3)/-3`, and completion detection work
  ("stage 4 of 4 · f⁻¹ found", check-it card with k = -2).

## Bugs found in QA and fixed

1. Progress stayed at stage 0 after a distribute step (same-side rewrites counted as the start line).
   Fixed in `content/modules/progress.ts` with an exact-form tie-break and a literal start line.
2. `3x + 12 < 9 → x > -1` was taught as "dividing by a negative flips". It is a flip after dividing by
   a positive. Fixed in `engine/transforms.ts` (`directionError`); 16 direction cases in
   `engine/direction.test.ts`.
3. Inequality calculator panels graphed `3x` instead of the boundary. Both calculators now graph left
   side minus right side, explain how to read its sign, table at k−1, k, k+1; Nspire shades the relation.
4. The number-line calculator panel showed inverse-function steps (no branch for that family). Being
   fixed by the calc-panels agent, along with compound inequalities, rational/Möbius asymptote notes,
   Nspire fraction formatting, and restored calculator tests.
5. Calculator steps stayed hidden when the layout widened after mount. Fixed in `CalcPanel.tsx`.
6. Expression-mode rejections printed two identical "left = …, right = …" lines and a random point
   like x = 3.445. Fixed: no side values for expressions, integer witnesses first, clearer heading.
7. The property-chip prompt appeared (twice) after even/odd evidence lines. Suppressed there.
8. Answer-only problems reported "0 steps · 0 first-try" on completion. Fixed in the card and toast.

## Not yet verified in the browser

- Inverse check-it grading with a wrong number (the page reloaded mid-batch), and the not-one-to-one
  path (verdict "No", reason, twin card, bonus column). Both are covered by `pages/Problem.test.tsx`.
- Drill, Progress, Settings and Sandbox pages (covered by `App.test.tsx`).
- Phone width (375 px): sticky composer, bottom sheet, symbol strip.
- Enter-to-submit: automated keypresses did not submit forms in the preview pane, while clicking the
  submit buttons did; needs a manual check on a real keyboard.

## Engine mutation sweep (scratch run, 2026-09-15)

Every canonical step of the 4 inequality and 6 inverse templates, 10 seeds each, both orderings for
inverses, checked through the context engine with swap gating:

| Check | Count | Result |
|---|---|---|
| Correct canonical steps | 579 | all accepted |
| Same step with sides swapped and the symbol reversed | 507 | all accepted |
| Broken variants: flipped symbol, a constant changed by one, negated right side | 1,155 | all rejected, each with a named lesson or a counterexample |

No false accepts and no false rejects. The sweep is now in the repo as an opt-in check:
`npm run test:sweep` (`src/engine/sweep/canonical-mutations.sweep.ts`, about 90 s, not part of `npm test`).

## Second QA round (2026-09-15)

Verified in the browser without clicks (the preview pane stops drawing when the window is behind
another, which blocks clicks but not navigation, reads or form fills):

- **Progress** renders the per-type table, the error-pattern table for this week against before,
  habits (3 finished, 0 unfinished), the day streak and backup controls. No console errors.
- **Settings** renders the calculator choice, the practice switches and reset. **Sandbox** renders
  its example buttons and the allow-swap checkbox. **Drill** renders a real legal-or-illegal item.
- **Calculator agent fixes** landed: number-line store-and-test panels, compound inequality graph
  between two lines, asymptote-swap steps for rational and Möbius, cleaner fraction formatting, and
  `content/calc/calc.test.ts` for every family on both calculators. Suite: 25 files, 231 tests.

Fixed in this round:

9. **Spoilers visible up front.** The Graph panel shaded the solution set (inequalities), drew the
   inverse (inverses) or showed the symmetry (even/odd) from the start, and the calculator panel typed
   the set-builder answer for number-line problems. Both panels now show a short note and a reveal
   button, and open by themselves once the problem is complete. The number-line graph stays visible
   because it is the question.
10. **Phone: panels unreachable without a composer.** On phones the Hints / Graph / Calc / Rules
    buttons only rendered inside the sticky input composer, so the number-line problem, even/odd,
    the inverse verdict and check-it cards, the final-answer card and the completion screen had no
    way to open them. The toolbar now renders at the top whenever there is no composer.
11. **Touch targets.** "shortcuts (?)" (32 px tall) and "Undo" (36 px) are now 44 px.

Needs a person on real hardware:

- Store-and-test keystrokes the calculator agent wrote from memory: TI-84 `2nd ENTER` (ENTRY) twice
  to recall a test; Nspire `ctrl var` for →, and `<=` / `>=` typed as shortcuts.
- Enter-to-submit on a real keyboard.

Verified after the fix at 375 × 812 with a full reload of the inverse check-it screen: the Hints,
Graph, Calc and Rules buttons render at the top, each 44 px tall; no horizontal overflow; no button in
the main column under 40 px; the check-it inputs are 309 px wide.

12. **Calculator windows cut off the numbers she needs.** The TI-84 inverse panels chose ZOOM 4:ZDecimal
    whenever k was at most 6, but that window shows y only from about −4 to 4, so a Möbius inverse's
    asymptote at y = −5 and a quadratic's f(2) = −12 were off screen; ZStandard and Nspire Zoom –
    Standard also miss values past ±10 (Nspire ±6.7 in y). The window is now sized from every stored
    number (k, f(k), twin, asymptotes, endpoints): ZDecimal only when all fit within ±4, ZStandard +
    ZSquare up to ±10, otherwise explicit WINDOW / Window Settings at ±N (a multiple of 5) followed by
    ZSquare / Zoom – Square, with a sentence naming the values that did not fit.

## Review fixes (2026-09-15)

A findings-only review by two agents produced 23 reproducible findings
(`docs/progress/review-findings.md`); two fix agents resolved all of them, each with a regression test
that failed first (`docs/progress/fix-engine.md`, `docs/progress/fix-flows.md`).

Reviewer engine harness, before and after:

| Measure | Before | After |
|---|---|---|
| Legal alternative steps falsely rejected (958 tried) | 11 | 0 |
| Canonical steps with a chip mismatch in the app context (186) | 40 | 19, all still offering the right chip |
| Wrong lines with no named lesson (240 tried) | 129 | 90, all with a counterexample |

Independently confirmed after the fixes: `y = -2 +- sqrt((x - 1)/2)` and `x = 1 +- 3` accepted as the ±
root step while a dropped ± is still rejected; the one-line cube-root inverse accepted; inequality steps
carry exactly their own chip; swap plus divide accepted only while swapping is allowed; the original 30
seeded-mistake checks still pass. A new jsdom test mounts a stored inverse attempt straight into its
check-it stage with no React hook errors, and a fresh browser tab on that problem logs no console
errors (the hook-order messages seen earlier were buffered history from live reloads while the agents
were editing). Final counts: 28 test files, 297 tests; sweep 10/10; production build succeeds.
