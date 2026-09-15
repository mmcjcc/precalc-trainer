# ui-flows running log

- Read CLAUDE.md, BUILD_GUIDE §3–§7, contracts, public APIs, existing flow files. Plan: stepEngine
  (monotone progress + solved + off-path hint) → useStepEngine slot options → Problem.tsx (lifted
  completion + attempt snapshot so the column survives finishAttempt) → NumberLine / EvenOdd /
  Inverse flows → Graph dynamic import → jsdom page tests.
- stepEngine: progressLine(instance, line, swapped, history) = best stage over history, solved via
  ModuleDef.solved, offPath flag; hintView(..., solved) with off-route nudge + HintView.offPath
  (HintPanel shows a note; rung 3 unavailable). Tests updated.
- useStepEngine: options owns / stepToDraft / persistDraft for shared-attempt slot columns.
- inverse.ts gradeTwin; evenOdd.ts slotHelp + slotHintView; useKeyedHint (negative keys for
  verdict/check phases); Graph dynamic-imports function-plot (own chunk), supports reflect+extra.
- Written: Problem.tsx (lifted useCompletion + attempt snapshot), flows/{types,record,
  NumberLineFlow,EvenOddFlow,InverseFlow,BonusInverseColumn}.tsx, InequalityFlow updated,
  ProblemFrame statement/graphCaption props, TwinCard. Next: typecheck, tests.
- Tests: src/pages/Problem.test.tsx (routing guards + 4 flows end-to-end, Graph mocked), slotHintView
  / slotHelp / gradeTwin unit tests. Fixed jsdom crash: KaTeX MathML inside a heading's accessible
  name → slot headings now have an sr-only text name, math aria-hidden. Full suite 195/195 green.
- Typecheck: only App.tsx (other agent) errors. Full vite build blocked by App.tsx importing the
  missing src/pages/Progress; verifying my chunk split with a scratch entry (Problem page only).
- Build check (scratch entry importing only the Problem page, via the Vite API): OK; function-plot
  is a separate ~200 KB dynamic chunk. Added not-one-to-one inverse page test (No + reason → twin →
  complete → bonus offered). Remaining: rerun suite, final report.
- Final checks: npm run typecheck clean (App.tsx fixed upstream); full vite build OK — function-plot
  in its own 203 kB chunk, Problem chunk 93 kB. npm test 198/199; the one failure was a 5 s timeout
  in content/propertiesDrill/drill.test.ts (not mine) under full parallel load. Done.
