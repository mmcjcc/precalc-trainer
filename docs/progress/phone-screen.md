# Phone problem screen

Branch `phone-screen`. Uncommitted, for review.

## Why

A design review on a phone (an emulator walkthrough plus an independent critic): the problem page buried the task
and hid the app's best feature. A red breadcrumb, the title, the instructions and "stage 0 of 2 · find x" all came
before the problem; the problem scrolled out of sight while she worked; in line-by-line flows the named mistake
landed in the work list, behind the composer and the keypad; leaving a problem popped a system dialog; a finished
problem said so twice (card and toast); "Copy link" copied an address that works nowhere inside the phone app.

## What she gets on a phone

"Phone" is `useBreakpoint() === 'mobile'` (below 768 px): the same switch that already makes the composer sticky and
the rail a row of sheets. A wide screen (and the tablet layout) keeps today's page, except the three changes that
are better everywhere: the leave sheet, no duplicate completion toast (the card scrolls into view instead), and no
"Copy link" inside the phone app.

1. **Compact header** (`PhoneHeader.tsx`): one row, an × (a link back to the module page, "Close, back to …"), the
   title on one line with an ellipsis, and progress dots (done filled, current gold and ringed, to do hollow; a
   count past 10). The instructions stay only when they add to the title (`extraInstructions`: a sentence goes
   when every word in it is in the title or a filler word), as one truncated line that a tap unfolds. Screen
   readers still hear "stage N of M · label" (a polite live region by the dots). In a screen without a composer the
   panel buttons (Hints, Graph, Calc, Rules) now come right after the problem card instead of above the header.
2. **Pinned problem** (`PinnedProblem.tsx`): an IntersectionObserver watches the gold card; once it has scrolled up
   under the top (safe-area inset + 48 px), a slim fixed strip under the status bar shows the problem in one line:
   the statement's KaTeX when every piece of it parses (an inequality, f(x) = …, two definitions, g(x) = …), else
   its first sentence; "Show the figure" when the card holds a figure or graph (an `img` role). A tap scrolls back
   to the card, or, while the keypad is up, opens the card in a sheet over her place; when the sheet closes the
   keypad comes back. No strip in the review set (it has its own sticky bar) or without IntersectionObserver.
3. **The verdict where she is looking** (`ComposerVerdict.tsx`): the composer has a status row right above her
   input: "✓ Kept" (with a note when kept with a caveat), the named mistake's title plus the first sentence of its
   lesson, or a grey note for a check that did not count; "Why?" opens the full lesson in a bottom sheet (the
   catalog lesson, the sentence about her line, the wrong → right example, the counterexample). The work-list card
   is unchanged. Flows pass it as `lineVerdict`: inequality, inverse, difference quotient (`engineVerdict` of the
   step engine), log lines and completing the square (their own feedback). Parts flows: after a Check on the
   keypad, `verdictReveal.ts` brings the verdict under the part's box into the band above the keypad (box and whole
   verdict when they fit, else the box at the top of the band and as much verdict as fits), under the strip.
4. **Stuck?** (`Stuck.tsx`): a chip at the right of the composer's status row (over the Check button) and under a
   wrong verdict in a screen without a composer (SigFigRejection, AtomRejection, the even/odd column's
   RejectionCard, the one-to-one/parity verdict, the final-answer card). It opens the hint sheet and takes the next
   hint: the ladder in the sheet takes the request as a press of its own button for the nudge and the rule; the rung
   that shows the step or the answer (it costs the first try) waits for her own tap. Shown only while the flow takes
   hints (`keymap.onHint`), so not on the inequality's final-answer card.
5. **Leave sheet** (`LeaveProblemSheet.tsx`, `useAttempt.ts`): opening a problem while another one has her work in
   it asks in a bottom sheet: the other problem (module · template, title, its statement) and "You have work on this
   problem. Leave it? It will count as unfinished." with "Back to it" (primary) and "Leave". Esc, the backdrop and ×
   are "Back to it", as Cancel was. A problem she only opened still leaves without asking.
6. **Completion**: no toast while the completion card is on the page (`data-completion-card`); the card scrolls into
   view and a polite live region says what the toast said ("Problem complete. 3 steps, 2 first-try, 1 hint") for
   screen readers. A finish with no card still toasts.
7. **Copy link**: hidden when `window.Capacitor?.isNativePlatform?.()` is true (`nativeApp.ts`); no dependency added.

## Not done / left alone

- No device or browser testing (by instruction): the strip, the sheets and the scrolling are covered by jsdom tests
  with a fake IntersectionObserver and mocked geometry only. iOS Safari with the phone's own keyboard open (abc, or
  the keypad switched off) may move a fixed strip; not checked.
- A few statements are a pointer rather than the problem ("the graph", "f is the piecewise function below"), so their
  strip reads weakly; a tap still brings the card back. Content was not touched.
- The tablet layout (768-1023 px, which includes a phone on its side) keeps today's page.
- The keypad's internals are unchanged: the parts-flow verdict scroll runs after the keypad's own scroll, and the
  sheets bring the keypad back through `notePress()`.

## Log

- 2026-10-20: read CLAUDE.md, BUILD_GUIDE §0/§7, phone-keypad.md, ProblemFrame, Composer, the five composer flows,
  the parts flows, useAttempt, the hint ladders and the keypad's scroll code.
- Built 1-7 above. Typecheck clean. New tests: `PhoneScreen.test.tsx` (an equation, a parts flow, a geometry
  problem and the chip's placement, on a phone with the keypad and a fake IntersectionObserver),
  `ProblemFrame.test.tsx` (the wide screen keeps today's page, toast vs card, Copy link, review set),
  `PhoneHeader.test.tsx`, `PinnedProblem.test.tsx`, `ComposerVerdict.test.tsx`, `verdictReveal.test.ts`.
  `Problem.test.tsx` F7/F8 drive the sheet instead of window.confirm (plus an Esc case);
  `GraphFeaturesFlow.test.tsx`'s harness reads `{ attempt }` from the hook's new return.
- First whole-suite run: 4160 of 4161 passed. The miss was mine: the completion live region repeated the card's
  line, so `getByText(/1 shown/)` in SigFigFlow.test found two elements. The region now speaks the toast's words.
  Also: the Why? sheet keeps the lesson it opened with until she closes it.

## Verification (2026-10-20)

- `npm run typecheck`: clean.
- Whole suite, `vitest run --maxWorkers=4`: 226 files, 4161 tests, all pass (6 new test files: `PhoneScreen.test.tsx`
  4 tests, `ProblemFrame.test.tsx` 7, `PhoneHeader.test.tsx` 8, `PinnedProblem.test.tsx` 7, `ComposerVerdict.test.tsx`
  6, `verdictReveal.test.ts` 6; `Problem.test.tsx` has one more).
- `vite build --outDir C:/work/tmp/screen-dist`: passes (the existing chunk-size warning only).

## Files

New: `src/components/{ComposerVerdict.tsx (+ test), Stuck.tsx, nativeApp.ts}`,
`src/pages/flows/{PhoneHeader.tsx (+ test), PinnedProblem.tsx (+ test), verdictReveal.ts (+ test),
LeaveProblemSheet.tsx, PhoneScreen.test.tsx, ProblemFrame.test.tsx}`.
Changed: `pages/flows/ProblemFrame.tsx`, `pages/Problem.tsx`, `problem/useAttempt.ts`, `problem/useStepEngine.ts`
(`kept`), `components/{Composer, RejectionCard, SigFigFeedback, AtomFeedback, VerdictCards, FinalAnswerCard,
HintPanel}.tsx`, the composer flows (`Inequality`, `Inverse`, `DiffQuotient`, `LogLine`, `Quadratics`), the ladders
in `hintLadder.tsx`, `fnUi.tsx`, `AtomFlow.tsx`, `ElectronFlow.tsx`, `GraphFeaturesFlow.tsx`, `SigFigFlow.tsx`,
`index.css`, `vite-env.d.ts`, `docs/BUILD_GUIDE.md` (§7), and two tests (`Problem.test.tsx` F7/F8,
`GraphFeaturesFlow.test.tsx` harness).
