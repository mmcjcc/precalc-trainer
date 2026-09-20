# Significant figures — UI agent progress log

Scope: `src/pages/flows/SigFigFlow.tsx` (new) + small components under `src/components`, the `case 'sigFigs'` in
`src/pages/Problem.tsx`, `ProblemFrame` (no graph / calculator anywhere for a problem with no graph and no calculator
steps), Home grouping by `subject`, additive store fields for resume. Not touched: `src/engine`, `src/content`,
deploy files.

## Plan (2026-09-20)

- Store (additive): `AttemptFinal.sfText / sfPower / sfTaps / sfIntermediate / sfIntermediateDone / revealed`;
  `finishAttempt` counts `final.revealed` as one revealed item so a rung-3 reveal blocks mastery like a revealed step.
- Components: `SigFigDigits` (tappable digit row, per-digit feedback), `SigFigNumeralInput` (coefficient + power
  boxes, ± buttons, live "reads as" preview), `SigFigFeedback` (rejection card in the existing styling, correct card,
  worked explanation).
- Flow: statement card (context, prompt, unit, exact badges); count → taps; mixed → intermediate question(s) then
  final; numeral entry otherwise. Hints: nudge / rule card (pattern lesson after a wrong answer) / explanation
  (flagged as revealed). Every graded answer → `recordFinalAnswer` (pattern id logged).
- ProblemFrame: when `graph.kind === 'none'` and both calc panels are empty, drop the Graph and Calc rail panels,
  their keymap bindings and their rows in the `?` cheat-sheet.
- Home: precalc modules unchanged under "Modules"; other subjects (Chemistry) under their own heading.

## Log
- [done] Store (additive): `AttemptFinal.revealed / sfText / sfPower / sfTaps / sfIntermediate / sfIntermediateDone`
  (`src/store/types.ts`); `finishAttempt` adds `final.revealed` to the revealed count (`src/store/index.ts`).
- [done] `KEYMAP_HELP` rows carry `panel: 'graph' | 'calc'`; `KeymapHelp` takes `omit` to drop them.
- [done] Components: `src/components/SigFigNumeralInput.tsx` (coefficient + power boxes, ± on the power, live
  "reads as … — N significant figures" line, parse error located to the box and character), `SigFigDigits.tsx`
  (tappable digits with aria-pressed, live count, ✓/✗ per digit and the rule under each wrong one; the power of
  ten is shown but not tappable), `SigFigFeedback.tsx` (rejection card in the existing ✗ styling, correct card,
  worked explanation list).
- [done] `src/pages/flows/SigFigFlow.tsx`: statement (context, prompt large, quantity chips with exact badges);
  tap mode for sf.count; intermediate question(s) for sf.mixed (asks the figures the group carries, graded by
  `gradeSigFigIntermediate`, answered ones listed above the final box); numeral entry otherwise. Hint ladder to
  rung 3 per phase (keys 0 and 100+i); rung 3 sets `final.revealed` + `firstCorrect: false`. Re-checking the same
  entry is not a second record. Typed boxes debounce-save to `attempt.final` (300 ms, flushed on submit and unmount);
  taps save immediately.
- [done] `record.ts`: `recordSigFigGrade` (skips parse errors) and `recordSigFigTaps` (one wrong record per named
  pattern). `Problem.tsx`: `case 'sigFigs'`. `ProblemFrame`: `bare` problems (graph 'none' + empty calc panels)
  get no Graph/Calc rail panel, toolbar button, reveal gate, shortcut or cheat-sheet row. `Home.tsx`: precalc under
  "Precalculus" (was "Modules"; heading text only changes when another subject exists), each other subject under
  its own heading. `Module.tsx`: eyebrow reads "Chemistry module".
- Decision: sf.count is tap-only (no typed count): per-digit grading is the more diagnostic interaction and the
  live count makes the number explicit. `gradeSigFigAnswer` count grading is therefore unused by the UI.
- Decision: the intermediate question is required before the final box (a rung-3 hint reveals it, so she is never
  stuck); a wrong intermediate is recorded like a wrong verdict elsewhere (blocks "Problem complete").
- [next] typecheck, tests (`SigFigFlow.test.tsx`, `Home.test.tsx`), full suite, build, browser check on :5173.
- [done] `npm run typecheck` green. Tests: `src/pages/flows/SigFigFlow.test.tsx` (19: every template at seed 7 with no
  Graph/Calc heading, gate or cheat-sheet row while ineq.linear keeps both; wrong→right path with events and
  "Problem finished"; right-first "Problem complete" with firstTryRate 1; power box + ±; parse error located and
  unlogged; plain wrong message without pattern; taps graded per digit with rules and patterns, then complete;
  keyboard-operable digits with a non-tappable power of ten; mixed intermediate then final; hint ladder to rung 3
  flags `revealed` and problem_done.revealed 1; resume restores coefficient/power, taps and the mixed stage) and
  `src/pages/Home.test.tsx` (Precalculus vs Chemistry headings, card order).
- Test-writing notes: the answer section heading is "Final answer" (an input labelled "Your answer" collided with an
  `aria-labelledby` section of the same name); a leftover unfinished attempt makes the next problem call
  `window.confirm`, which jsdom does not implement — reset the store between problems in one test.
- [next] full suite, `vite build`, browser check against the running dev server on :5173.

## Final state (2026-09-20)

`npm run typecheck` passes. `node node_modules/vitest/vitest.mjs run` (whole suite): 36 files / 531 tests green.
`node node_modules/vite/bin/vite.js build` succeeds. Nothing committed.

Browser check NOT done: nothing was listening on port 5173 during this run (curl: no connection; no listener in
netstat), and the brief forbids starting a server. The flows are covered by the jsdom tests; a real-device pass on
an iPhone (decimal keypad on the coefficient box, numeric keypad + ± on the power box, 44 px digit buttons) is
still worth doing.

Files: new `src/pages/flows/SigFigFlow.tsx`, `src/pages/flows/SigFigFlow.test.tsx`, `src/pages/Home.test.tsx`,
`src/components/{SigFigNumeralInput,SigFigDigits,SigFigFeedback}.tsx`; edited `src/pages/Problem.tsx` (dispatch),
`src/pages/flows/ProblemFrame.tsx` (bare problems), `src/pages/flows/record.ts` (two recorders), `src/pages/Home.tsx`
(subject grouping), `src/pages/Module.tsx` (eyebrow), `src/components/KeymapHelp.tsx` + `useKeymap.ts` (omit rows),
`src/store/types.ts` (AttemptFinal fields), `src/store/index.ts` (finishAttempt counts final.revealed).

Not done / for later: Progress page does not group `sf_*` patterns under Chemistry (they list by their catalog
titles like every other pattern); Home's "Pick up where you left off" card still says "waiting for your first line"
for answer-only problems (pre-existing wording); `docs/BUILD_GUIDE.md` §0/§7 do not mention the module.
