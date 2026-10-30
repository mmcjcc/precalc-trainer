# Guide me switch and more card sources

Branch `guided-switch`. Uncommitted, for review.

## Why

Guided mode (pick the next line from three cards, each wrong one a named mistake) existed only for
exponential and log equations, and the Type | Pick control sat in "Your work", easy to miss behind the
phone composer. The owner wants a visible **Guide me** switch on the problem screen that his daughter
can flip on and off mid-problem, remembered across visits, and the same cards on the line-by-line
types she is weakest in (inequalities and quadratics first).

## What she gets

1. **Guide me** in the composer/step area (not ProblemFrame): a switch, only on types that have a card
   source. ON = every line is answered by picking from the cards (typing hidden, cards not behind
   Hints). OFF = she types, and the cards stay in Hints exactly as today. Flipping mid-problem keeps
   her earlier lines. The setting is `settings.lineEntry` (`pick` / `type`), persisted on the device.
2. **Card sources** beyond exp/log equations, in this order: inequalities, quadratics (completing the
   square, `cs.form` only), inverses (one-to-one step column), log properties, difference quotient,
   even/odd. Each source follows `cardSources.ts`: the right next line from the module's `nextStep`
   (or, for quadratics, the engine's worked path, because `nextStep` is null there), the wrong lines
   from named mistakes applied to her current line, kept only when the module's checker names exactly
   that mistake, plus the checker and a "same line" test.
3. **Scoring unchanged.** A picked card still goes through the checker as the same line typed would.
   Mastery, first-try, hint, XP and event behaviour are the existing Guided mode rules. The switch
   only changes how the cards are offered.

## Design decisions for review

- **Switch in the composer, not ProblemFrame.** Another builder is redesigning the desktop problem
  screen in ProblemFrame / PageLayout / TabletLayout / scratch. `GuidedStep` (in `LineCards.tsx`) is
  the step-area that swaps typing and cards and holds the switch; flows pass it as `composer`.
  Even/odd has no composer: the switch sits in each slot column (the step area).
- **`lineEntry` kept.** ON writes `pick`, OFF writes `type`, so existing persist, backup and XP rules
  do not change.
- **Quadratics `nextStep` is null** (the module never anchors on a path; every legal line equals f).
  The source walks `answer.path` from `completeSquare` and treats two writings as the same line only
  when their parsed trees match, not by value (value would match every path line). Vertex-form
  questions (`cs.vertex`) have no source, so no switch.
- **Inverse non-1-to-1** has no step column: `offersLineCards` is false, no switch.
- **Picked lines skip the property-chip prompt** on inequality / inverse / DQ (the line is chosen, not
  authored). Events, `via: 'card'`, and the twice-type rule are unchanged. Worth a look if you want
  chips on a picked line too.
- **Even/odd slot B** is not on the module's canonical path (`nextStep` is only f(−x)). Slot B uses
  the stored −f(x) forms as its path, keyed with a `B:` prefix on `current`. Documented; coverage may
  be thinner than slot A.
- **`lineCards.ts` unchanged.**

## Coverage

| Module | Source | Notes |
|---|---|---|
| expLogEquations | yes | as before |
| inequalities | yes | linear / distribute / fraction / compound; compound lines with no qualifying slip are typed |
| quadratics | yes, `cs.form` only | `cs.vertex` is four answers, no cards |
| inverses | yes, one-to-one | `inv.quadratic-not` has no step column |
| logProperties | yes | expand / condense; expression slips |
| diffQuotient | yes | part 1 f(x+h) and later DQ lines |
| evenOdd | yes | slot A from `nextStep`; slot B from stored −f(x) |
| everything else | no | switch hidden; nothing changes |

## Log

- Read CLAUDE.md, BUILD_GUIDE §0, phone-guided.md, cardSources / lineCards / explog anchor, ProblemFrame
  (read-only), Composer, LogLineFlow, and the other step flows.
- Built additive `logRewriteSlips` (engine, does not grade) and `stepLineSlips` (problem layer) for
  inequality / inverse named mistakes.
- Extended `cardSources.ts` in the order asked; `lineCards.ts` untouched.
- Moved the control to a Guide me switch in `GuidedStep` (composer/step area). Wired LogLineFlow,
  InequalityFlow, QuadraticsFlow (form), InverseFlow, DiffQuotientFlow, EvenOddFlow.
- Wrapped the switch in `ComposerExtra` so the phone composer still folds extras when the keypad is up.
- Path-card tests: 12 seeds per added module; inv.linear `minShare` 0.2; evenOdd.poly `minShare` 0.15
  and three-card rows not required (slot A slips of f(−x) are thinner).

## Not done

- No device or browser testing (jsdom only). Worth a look: two Guide me switches on even/odd, long
  inequality cards on a narrow phone, quadratics wrong cards that jump to a wrong vertex form.
- Property chips after a picked line (see decisions).
- Types without a source still have no switch.
- `LineEntrySwitch` (Type / Pick) is still exported from `LineCards.tsx` but unused.

## Verification

- `npm run typecheck`: pass (exit 0).
- `npm test`: 374 files, 6392 tests, all pass (1449 s). GuidedMode 14, PhoneComposer 6, cardSources 11,
  StepGuide 5, Chunky 7. A prior full run failed only `own.fuzz` `diffQuotient / dq: 2000 keypad strings`
  on the 50 ms budget (58.5 ms at best under load); that file is not on this path and was not changed.
  The rerun was green.
- `npm run build`: pass (exit 0; vite built in 28.52 s). The existing 1500 kB chunk warning is unchanged.

## Files

New: `src/problem/stepSlips.ts`, `src/problem/useGuidedCards.ts`, `docs/progress/guided-switch.md`.
Changed: `src/engine/logs/lineSlips.ts` (+ `logRewriteSlips`), `src/engine/logs/index.ts`,
`src/problem/cardSources.ts` (+ test), `src/problem/solveStyle.ts`, `src/components/LineCards.tsx`,
`src/components/StepGuide.tsx` (+ test), `src/store/types.ts` (comment), `src/pages/flows/{LogLineFlow,
InequalityFlow, QuadraticsFlow, InverseFlow, DiffQuotientFlow, EvenOddFlow, GuidedMode.test}.tsx`.
Unchanged on purpose: `src/problem/lineCards.ts`, `src/pages/flows/ProblemFrame.tsx`,
`src/components/PageLayout.tsx`, `src/pages/flows/TabletLayout.tsx`, `src/components/scratch/`.
