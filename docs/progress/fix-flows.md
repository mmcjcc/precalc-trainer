# fix-flows progress (F1–F13, section flow-logic of the review findings)

- Started: regression tests written first (store, selectors, compaction, keymap, record, Problem page).
- F1 done: useKeymap digits pick chips only when focus is not in a text field. Tests: Problem.test "F1: a digit typed…" (failed before), useKeymap.test digits case.
- F2 done: acceptStep marks revealed/firstTry:false when hintsUsed[hintKey] reached rung 3. Tests: store.test F2 ×2 (failed before).
- F3 done: attempt.rejectionsByIdx (optional; legacy attempts fall back to currentRejections), not cleared by undo. Tests: store.test F3 ×2.
- F4 done: useStepEngine hintKey option; EvenOddFlow slot A = lines, slot B = 1000 + lines. Test: Problem.test F4 (failed before).
- F5 done: attempt.final.everWrong / firstCorrect set by recordFinalAnswer; finishAttempt decides finalCorrect; finish() takes no argument; answer-only rate = first check. Tests: store.test F5 ×2, Problem.test F5 (failed before). Existing inverse-not test updated: wrong twin first → "Problem finished".
- F6 done: useIdleNudge is nudge-only; useActiveClock in ProblemBody runs while attempt && !completion; take() flushed into finishAttempt secs. Test: Problem.test F6 (failed before: 300 vs 660).
- F7 done: same route + different problemId → startAttempt (abandons) + toast, no confirm; Cancel for a different problem lands on its page. Tests: Problem.test F7 ×2 (stale one failed before).
- F8 done: attempt matches on problemId AND difficulty; startAttempt abandons on difficulty change. Test: Problem.test F8 (failed before).
- F9 done: useStepEngine closes/masks the chip prompt when disabled (finished). Test: Problem.test F9 (failed before: 14 radios).
- F10 done: compaction.cancelledSteps used by firstTryRate/hintRate/propertyAccuracy and compact(). Tests: selectors.test F10 ×2, compaction.test F10 (failed before).
- F11 done: recordSetAnswer logs parse-time named patterns as wrong (wrong records first). Tests: record.test.ts (failed before).
- F12 done: identical text re-submitted for the same attempt/key re-shows the card without rejectStep. Test: Problem.test F12 (failed before).
- F13 done: ProblemFrame nudgeText prop + FINAL_ANSWER_NUDGE when progress.solved; number line / even-odd verdict / inverse phases pass their own text. Test: Problem.test F13 (failed before).
- Final: npm run typecheck exit 0; npm test 27 files / 296 tests passed; npm run test:sweep 10/10; vite build OK. All F1–F13 fixed.
