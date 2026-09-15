# Review findings (2026-09-15)

Findings-only review by two agents (engine routes, flow logic). Every finding except F11 was reproduced with a scripted test. Fix status is tracked in docs/progress/fix-engine.md and docs/progress/fix-flows.md.

```
########## engine-routes (10 findings)
== ER-1 [high] A ± between two terms (h +- E, typed or from the ± key) is read as multiplication (seen)
== ER-2 [high] Cube-root inverses: combining the cube with another move is falsely rejected when the root is not float-exact (a = 3), and the counterexample contradicts itself (seen)
== ER-3 [high] In one-variable problems every canonical add/subtract and distribute step is re-labelled as the final divide, and mul_div is graded as a correct chip (seen)

== ER-4 [medium] engine/matchers.ts: coefficientOf (combine_unlike, reciprocal_coeff)
   TITLE: A negative coefficient written '-2y' loses its sign: false 'Only like terms combine' lessons, and missed reciprocal_coeff for negative coefficients
   SCENARIO: (a) ineq.linear seed 8 {negativeLead:true, fractions:true}: -2x - 4 < -8 -> -2x < -12 (moved −4 without changing sign), with {vars:[x], seed:8}. (b) inv.linear seed 3 after the swap: x = -3y - 6 -> x - 6 = -3y, with {vars:[x,y], seed:3, allowSwap:false}. (c) inv.linear seed 4: x = -4y - 3 -> y = -4x - 3 (swapped back) or y = 1/(-4x - 3). (d) x + 6 = -2y -> y = x/-2 + 6 (also y = (-1/2)x + 6, y = -x/2 + 6), with {vars:[x,y], seed:1}. (e) inv.frac-linear seed 2: x - 1 = -(3/4)y -> y = (-4/3)x - 1.
   EXPECTED: (a) and (b): term_across_sign, or at least no wrong lesson. (c): counterexample only. (d) and (e): reciprocal_coeff ('multiply EVERY term of the other side by −1/2').
   ACTUAL: (a) pattern=combine_unlike witness="At x = 0: the original side gives −4, yours gives 0." (lesson 'Only like terms combine: 2x + 3 stays 2x + 3'). (b) pattern=combine_unlike witness="At x = 0: the original side gives −9, yours gives −3." The values are at y = 1, which is not shown, and the correct term_across_sign lesson is pre-empted. (c) pattern=combine_unlike witness="At x = 0: the original side gives −7, yours gives 1." (d) pattern=- (counterexample only). (e) pattern=- ; the same line with (-3/4)y written in parentheses gets reciprocal_coeff. Positive coefficients work: x - 4 = 2y -> y = x/2 - 4 gets reciprocal_coeff. In routes.out.txt all 5 inv.linear seeds (a < 0) and the 4 negative frac-linear seeds miss reciprocal_coeff.
   EVIDENCE: src/engine/matchers.ts:247-258 coefficientOf checks isUnaryMinus only on the whole term. For '-2y' (a product whose first factor is unaryMinus(2)), multiplicativeFactors (rewriteClassifier.ts:58-62) strips the nested unary minus, so the coefficient comes out +2. combineUnlikeCandidates then builds (|a| + c)·x, which equals the student's new side whenever c = 2a (for example −2x − 4 → −2x). reciprocalCoeff uses 1/(+2) and misses. Reproduced in probe.test.ts blocks C and E (probe.out.txt).
   FIX: In coefficientOf, walk the factors keeping the sign: treat a unaryMinus factor as −1 times its argument (or use tryConst on each original factor before stripping). Add matcher tests for '-2x - 4 < -8 -> -2x < -12' (no combine_unlike) and 'x + 6 = -2y -> y = x/-2 + 6' (reciprocal_coeff).

== ER-5 [medium] engine/matchers.ts: termAcrossSign
   TITLE: 'Moving a term changes its sign' never fires on inequalities, the module where the mistake is most common
   SCENARIO: x + 5 < 2 -> x < 7 with {vars:[x], seed:1}. ineq.linear seed 1: 2x + 8 > 10 -> 2x > 18. ineq.fraction seed 2: (1/4)y + 3 > 1 -> (1/4)y > 4. Other templates behave the same.
   EXPECTED: pattern term_across_sign, with the lesson worded for any relation symbol.
   ACTUAL: x + 5 < 2 -> x < 7: ok=false pattern=- ce="At x = 0 the original is FALSE but your line is TRUE. Original: 5 < 2 → FALSE. Yours: 0 < 7 → TRUE." The equation twin x + 5 = 2 -> x = 7 does get term_across_sign. 16 of 16 inequality term-across cases in routes.out.txt had no lesson (one got the wrong combine_unlike from ER-4).
   EVIDENCE: src/engine/matchers.ts:370-372: `if (o.op !== '=' || n.op !== '=') return undefined`. The catalog lesson (matchers/catalog.ts term_across_sign) says 'across ='.
   FIX: Allow any relation where o.op === n.op (the move keeps the symbol), and reword the lesson to 'across the = or inequality sign'. The candidate construction is unchanged.

== ER-6 [medium] engine/transforms.ts: swapVars
   TITLE: Swap combined with any solving move is rejected with a counterexample that never mentions the swap
   SCENARIO: inv.linear seed 1 (y = -2x - 6), StepContext {vars:[x,y], seed:1, allowSwap:true, checkValue:k}. From the start line type the inverse directly, y = (x + 6)/-2, or x + 6 = -2y. Solve-first variant: y + 6 = -2x (accepted) -> (x + 6)/-2 = y (divide and swap in one line; allowSwap still true). Fails on all 5 seeds.
   EXPECTED: Either accept as swap_xy plus the move (swap chip plus mul_div), or reject with swap-specific coaching ('write the swap as its own line'). The instructions say 'Swap x and y first, or solve for x first — both are fine'.
   ACTUAL: y = -2x - 6 -> y = (x + 6)/-2: ok=false verdict=not_equivalent pattern=- ce="At x = −3 the original needs y = 0, but your line needs y = −3/2. Check x = −3, y = 0: Original: 0 = 0 → TRUE. Yours: 0 = −3/2 → FALSE." The swap with only a rewrite is accepted (x = -6 - 2y, -2y - 6 = x), so the boundary is 'swap plus rewrite only'.
   EVIDENCE: src/engine/transforms.ts:585-597 swapVars accepts only when sameStatement(renamed(old), new), which allows rewrites and a side swap but no both-sides move. Everything else falls to Tier 2, which compares un-renamed solution sets. Reproduced in probe.test.ts block D and routes.out.txt route solve-then-swap-mid.
   FIX: When allowSwap is set and Tier 1 fails, run Tier 2 on renamed(old) vs new. If the sets agree, either accept with swapped:true (verdict equivalent_by_rename, chips swap_xy plus the detected move) or reject with a named swap_combined pattern ('Swap x and y on its own line, then keep solving').

== ER-7 [medium] engine/matchers.ts: candidate generators vs error-patterns doc
   TITLE: Three doc-listed step errors get no lesson: root over a sum, −(sum) sign, and multiplying by the coefficient instead of its reciprocal
   SCENARIO: (1) inv.cbrt-shift seed 2 after the swap: x = cbrt(2y + 12) -> x = cbrt(2y) + cbrt(12) (seed 1: x = cbrt(3y + 10) + 2 -> x = cbrt(3y) + cbrt(10) + 2), {vars:[x,y], allowSwap:false}. (2) Even/odd −f(x) slot, verifyRewrite('-(4x^3 + 3x^2)', '-4x^3 + 3x^2', {vars:[x], seed:3}). (3) inv.frac-linear seed 1: x - 6 = (3/4)y -> y = (3/4)(x - 6). ineq.fraction seed 1: (5/4)y > 4 -> y > 5.
   EXPECTED: (1) power_over_sum (doc row B: f ∈ {^n, sqrt, cbrt, abs}; its example is exactly cbrt(7x+3) → cbrt(7x)+cbrt(3)). (2) negative_not_distributed. (3) reciprocal_coeff (doc row 9 lists the k·R candidate).
   ACTUAL: (1) ok=false pattern=- (counterexample only) on all 5 seeds. (2) ok=false pattern=- ce="At x = 1 the original expression gives −7, but yours gives −1." (3) ok=false pattern=- on all 5 frac-linear and all 8 ineq.fraction cases.
   EVIDENCE: src/engine/matchers.ts:161-172 powerOverSumCandidates handles only '^' nodes. matchers.ts:107-128 negativeNotDistributedCandidates requires a constant negative factor in a '*' node, so a bare unary minus over a sum is skipped. matchers.ts:338-367 reciprocalCoeff builds only (1/k)·term_i and R ± 1/k, never k·R. Reproduced in routes.out.txt (W-cbrt-over-sum, W-multiply-by-coefficient) and probe2.out.txt (EVEN W row).
   FIX: powerOverSum: also emit sqrt(A)+sqrt(B), cbrt(A)+cbrt(B) and abs(A)+abs(B) for sqrt/cbrt/abs of a sum. negativeNotDistributed: treat unaryMinus(sum) as coefficient −1 (candidate −b + c + …). reciprocalCoeff: add the candidate coef·R, with a witness like 'you multiplied by 3/4 again instead of its reciprocal 4/3'.

== ER-8 [low] engine/matchers.ts: inequalityDirection for chains
   TITLE: Compound chain read backwards without turning the symbols is taught as 'divide by a negative'
   SCENARIO: ineq.compound seed 6 {negativeLead:true}: after the accepted 0 > x > -1, type -1 > x > 0. Also -1 < x < 0 -> 0 < x < -1, and 2 > x > 0 -> 0 > x > 2 ({vars:[x], seed:1}).
   EXPECTED: swap_sides_no_reverse ('Reading an inequality backwards reverses the symbol'), as the single-relation case 3 > x -> x > 3 already gets.
   ACTUAL: pattern=no_sign_flip witness="Your line is the old one with the symbol reversed — that only happens when you multiply or divide by a negative." No multiplication happened; she reversed the order.
   EVIDENCE: src/engine/matchers.ts:418-427: the swap_sides_no_reverse check needs single relations (o && n), which a chain is not. Reproduced in probe.test.ts block H and routes.out.txt W-swap-ends-no-reverse (seeds 6 and 8).
   FIX: For chains of equal shape, check whether new's ends equal old's ends reversed (outer expressions swapped, middle equal) with the symbols unchanged, and return swap_sides_no_reverse before the no_sign_flip fallback.

== ER-9 [low] engine/matchers.ts: sideWitness
   TITLE: Pattern witness shows a point where both sides agree ('original gives 0, yours gives 0')
   SCENARIO: verifyRewrite('cbrt(-x)', 'cbrt(x)', {vars:[x], seed:3}). verifyRewrite('4(-x)^3 + 3(-x)^2', '-4x^3 - 3x^2', ...). verifyRewrite('sqrt(25-(-x)^2)', 'sqrt(25+x^2)', ...).
   EXPECTED: The witness names a point where the two sides differ (x = 1 gives −1 vs 1).
   ACTUAL: cbrt_sign_dropped witness="At x = 0: the original side gives 0, yours gives 0." neg_power_sign witness="At x = 0: the original side gives 0, yours gives 0." and "At x = 0: the original side gives 5, yours gives 5." In two-variable problems the witness also prints only x while y is silently held at 1 (see ER-4 (b)).
   EVIDENCE: src/engine/matchers.ts:282-297: sideWitness returns on the first probe where both values are defined, without checking a ≠ b. It also filters y out of the displayed point when x is present (lines 290-292). Reproduced in probe2.out.txt EVEN W rows.
   FIX: Skip probes where nearlyEqual(a, b), and include every variable actually used in the displayed point (for example 'At x = 0, y = 1').

== ER-10 [low] engine/step.ts: chips for chain reorder
   TITLE: The negative compound's canonical 'read the chain the other way' step has no detected move and no chips, so the chip prompt silently skips it
   SCENARIO: ineq.compound seed 6 {negativeLead:true}, app context buildStepContext(p, false): 0 > x > -1 -> -1 < x < 0 (the canonical swap_sides step). Also 0 < -4x < 4 -> -1 < x < 0 and 0 < -4x < 4 -> x > -1 and x < 0.
   EXPECTED: detected.tag swap_sides, acceptableChips [swap_sides] (plus mul_div for the combined line).
   ACTUAL: ok=true verdict=equivalent tag=- chips=[]. useStepEngine.ts:150 shows the chip prompt only when acceptableChips.length > 0, so the canonical step tagged swap_sides is never quizzed or recorded.
   EVIDENCE: src/engine/transforms.ts:645-665 detectChain pairs relations positionally (old left with new left), so a reversed chain never matches as swap_sides and Tier 2 accepts with det = null. Reproduced in probe2.out.txt CHIP rows and routes.out.txt (divide-first and final-reversed-chain routes, tag=- chips=[]).
   FIX: In detectChain, also try pairing old relation i with new relation (n−1−i) with each relation swapped (swapRelation), and accept as swap_sides when every pair matches.

COVERAGE: What I ran: a harness at C:/Users/cohenjas/AppData/Local/Temp/claude/S--Users-cohenjas-OneDrive-math/bffa01d2-98bf-4739-ab17-1c19900b4199/scratchpad/review/engine/ (routes.test.ts, probe.test.ts, probe2.test.ts, probe3.test.ts; outputs routes.out.txt, probe*.out.txt). No repo files were edited.

- **Templates:** allTemplates() lists 13, not 15. The number line template has no steps, so the step families are the 4 inequality and 6 inverse templates.
- **Legal routes:** 958 steps from lines generated out of each instance's params. Inequalities used seeds 1-5 plus 3 knob variants; inverses used seeds 1-5. Routes covered:
  - divide first
  - multiply by −1 first
  - move the variable to the positive side
  - clear the fraction first
  - multiply by the reciprocal first
  - two moves in one line
  - reversed or unreduced final forms
  - split into an 'and' pair, or divide all three parts first
  - solve for x first, then swap
  - swap with the sides also swapped, or commuted
  - other final forms: split fraction, negative denominator, (1/a)(…), f^-1(x) notation
  - rational: reciprocal of both sides, cross-multiply in the other order, multiply before moving c
  - Möbius: collect on the other side, the −(…)/(x−a) form
  - quadratic: ± line, abs form and 'or' form
- **Wrong lines:** 240 realistic wrong lines taken from the step-matcher table:
  - no flip / flip on a positive / flip on add
  - term across the sign unchanged
  - divide only one term
  - sides swapped without reversing
  - partial or negative distribution
  - multiply by the coefficient instead of the reciprocal
  - reciprocal on one term
  - constant moved into the radical
  - cube applied to one term
  - root spread over a sum
  - split denominator
  - swap misname or swapping twice
  - 1/f
  - dropped ±
- **Chips:** checked both with a bare context and with the app's buildStepContext (canonical + canonicalAlt) on all 186 canonical steps across 10 templates × 5 seeds.
- **Even/odd:** checked through verifyRewrite (9 legal f(−x) / −f(x) rewrites, 6 wrong).

False accepts: none real. The 7 'accepted wrong' rows were my generator producing legal lines when c = 0, a = 1 or h = 0.

Not covered:
- UI rendering of these results
- the number line and drill templates
- evenOdd.special beyond the listed rewrites
- the flow-level logic for ± restrictions on the quadratic bonus path
- canonicalAlt paths beyond what the harness exercised

Messages I did not flag: parse errors for mixed-direction chains, and counterexample-only rejections for wrong lines that combine two mistakes. 

########## flow-logic (13 findings)

== F1 [high] property chips / keymap
   TITLE: A digit typed to start the next line is swallowed and recorded as a chip answer
   SCENARIO: #/p/inequalities/ineq.linear/9ix (seed 12345, 3x + 6 < 3), default askProperty 'always'. Type 3x < -3 and click Check this step. The chip prompt opens and focus moves into the now-empty step input (useStepEngine.ts:151,155). Start typing the next line with a digit, e.g. 3 (many lines start with one: 3x < 21, 2x >= ...).
   EXPECTED: The keystroke goes into the input and the chip prompt is skipped (PropertyChips says 'typing the next line skips it'), so step.property stays 'skipped'.
   ACTUAL: useKeymap.ts:72 treats a digit in an EMPTY field as a chip pick while chipsActive. The keydown is preventDefault-ed, so the '3' never reaches the input, and answerProperty records a chip she never chose. Reproduced: keyDown '3' prevented = true; steps[0] = {property:'wrong', chip:'distribute'}; the step_accepted event is patched to property 'wrong'.
   EVIDENCE: Temporary jsdom test S1 (src/__review__, now deleted): 'S1 prompt shown true active is input true ... keydown notPrevented false step {"property":"wrong","chip":"distribute"} event {..."property":"wrong"}'. Code: src/components/useKeymap.ts:72-73; src/problem/useStepEngine.ts:151,155,171-176; src/components/PropertyChips.tsx:62.
   FIX: Only map digits to chips when focus is NOT in a text field (or only when focus is inside the chip radiogroup). Otherwise leave the digit to the input, whose onChange already clears the prompt.

== F2 [high] hint accounting / mastery
   TITLE: Reading the revealed step (rung 3) and typing it by hand counts as first-try and not revealed
   SCENARIO: ineq.linear seed 12345. In the Hints panel click Nudge me, Show the rule, then Show the step (the button says '(marks the step as shown)'). The next line appears with 'Use this line'. Do not click it; type the same line into Next line and check it. Finish the problem.
   EXPECTED: The step is recorded revealed:true, firstTry:false, as the button text and research ('A show the step rung marks that step firstTry:false, revealed:true') promise, and problem_done.revealed = 1 blocks mastery.
   ACTUAL: Only onUseLine passes revealed:true. acceptStep computes firstTry from currentRejections alone and ignores hintsUsed. problem_done = {steps:2, firstTryRate:1, hints:3, revealed:0}, so the attempt still counts toward mastery. The same bypass works after Use this line → Undo → retype.
   EVIDENCE: S1-S12 below are temporary jsdom tests in src/__review__ (folder deleted before finishing). S2 log: hint events [[0,1],[0,2],[0,3]]; problem_done {"steps":2,"firstTryRate":1,"hints":3,"revealed":0,"finalCorrect":true}. Code: src/store/index.ts:262-263; src/problem/useStepEngine.ts:184-191,193-199; src/components/HintPanel.tsx:50.
   FIX: In acceptStep, treat hintsUsed[String(idx)] === 3 as revealed (revealed = input.revealed || rung3, firstTry = currentRejections === 0 && !revealed). Or record a per-step revealed flag the moment rung 3 is granted.

== F3 [medium] undo / first-try accounting
   TITLE: Undo resets currentRejections, so rejected tries are erased and the redone steps count as first-try
   SCENARIO: ineq.linear seed 12345. Accept 3x < -3. Submit x < 999 (rejected), then x < 998 (rejected; currentRejections = 2). Click Undo step 1, click Check this step on the restored draft, enter x < -1, then enter the right interval and set-builder.
   EXPECTED: The two rejections at this step still cost first-try, so problem_done.firstTryRate < 1.
   ACTUAL: undoStep sets currentRejections: 0, so the re-accepted line and the next line are both firstTry:true. problem_done.firstTryRate = 1 even though the log holds 2 step_rejected events. Any rejected step can be laundered by undoing one line and redoing it.
   EVIDENCE: S3 log: 'rejections before undo 2', 'rejected events 2', problem_done {"steps":2,"firstTryRate":1,...}. Code: src/store/index.ts:317 (currentRejections: 0 in undoStep), 262 (firstTry).
   FIX: Track rejections per step index (e.g. rejectionsByIdx on the attempt, not cleared by undo) and derive firstTry from the count for that idx. At minimum, do not reset the count on undo.

== F4 [medium] even/odd hints
   TITLE: Even/odd hint rungs are shared between the f(−x) and −f(x) columns
   SCENARIO: #/p/evenOdd/evenOdd.poly/<777 in base36>. With the f(−x) column active, click Nudge me and Show the rule. Focus the −f(x) input: the panel switches to 'Hints for the −f(x) column'.
   EXPECTED: The −f(x) column starts at rung 0 (button 'Nudge me').
   ACTUAL: Both slot engines read and write hintsUsed[String(steps.length)], the total step count across both columns. The −f(x) panel therefore opens at rung 2 ('Show the step (marks the step as shown)'), and one click reveals −f(x)'s line ('Use this line' shown) without its nudge or rule. The reverse happens whenever the other column has used hints at the same total index.
   EVIDENCE: S4 log: 'B heading true B button Show the step(marks the step as shown) hintsUsed {"0":2}'; 'after one B click: reveal shown true hint events [1,2,3]'. Code: src/problem/useStepEngine.ts:80,184,190; src/pages/flows/EvenOddFlow.tsx:93-94,126-129.
   FIX: Give useStepEngine a hintKey option. EvenOddFlow passes a per-slot key (e.g. slot A = its line count, slot B = a disjoint range such as 1000 + its line count), so each column keeps its own ladder.

== F5 [medium] completion recording / mastery
   TITLE: finalCorrect is always true, so wrong final answers never block mastery (answer-only problems master in 5 completions)
   SCENARIO: nl.read seeds 11, 22, 33, 44, 55. On each, first check (-1000, 1000) with {x | -1000 < x < 1000} (wrong), then the right answers.
   EXPECTED: Research (ux-mobile-progress.md:87,228): mastered only if 'the final answer was right in all 5'. A wrong-then-right final should show 'Problem finished' and not count as a correct final.
   ACTUAL: Every flow calls finish(true), and finishAttempt prefers input.finalCorrect over a.final.correct. All 5 problem_done events have finalCorrect:true. Answer-only problems have steps = 0, so firstTryRate = 1. mastery('nl.read') = {rate:1, mastered:true, count:5} despite 10 wrong final_answer events. The 'Problem finished' branch in ProblemFrame is unreachable. The same holds for the not-one-to-one inverse (wrong verdict or twin values) and the even/odd verdict.
   EVIDENCE: S5 log: 'wrong finals 10 dones [[true,1],[true,1],[true,1],[true,1],[true,1]] mastery {"rate":1,"mastered":true,"count":5}'. Code: src/pages/flows/InequalityFlow.tsx:102, NumberLineFlow.tsx:63, EvenOddFlow.tsx:171, InverseFlow.tsx:108,184,189,202; src/store/index.ts:395,404; src/store/selectors.ts:45.
   FIX: Decide finalCorrect from the attempt: false if any final_answer event for attempt.id was incorrect (or keep a sticky attempt.final.everWrong), and call finish with that. For steps = 0 problems, base the rate on first-try final answers rather than a constant 1.

== F6 [medium] idle nudge / time records
   TITLE: The active-seconds clock stops for the rest of the attempt once the idle nudge fires
   SCENARIO: ineq.linear seed 12345 (fake timers). Leave the page idle past 4 minutes so the nudge fires, then work for 6 more minutes (a keypress every 10 s).
   EXPECTED: activeSecs keeps growing while she works; problem_done.secs and habits.secs reflect the time.
   ACTUAL: useIdleNudge's `active` includes !attempt.nudged, so setNudged() tears down the effect that also drives onActiveSecs. activeSecs was 60 at 1 min, 300 at 5 min (nudged), and still 300 at 11 min. Because nudged is persisted, this also holds after a reload. Separately, on completion finishAttempt clears the attempt before the effect cleanup reports the last partial chunk (useIdleNudge.ts:52 → addActiveSecs no-ops), dropping up to 14 s per problem.
   EVIDENCE: S6 log: 'activeSecs after 1 min 60 after 5 min (nudged true ) 300 after 11 min 300'. Code: src/pages/flows/ProblemFrame.tsx:162,168; src/problem/useIdleNudge.ts:30-53; src/store/index.ts:379-382,396.
   FIX: Split the two concerns: run the active clock while attempt && !completion, and gate only the nudge on !attempt.nudged (e.g. an enabled flag for onNudge). Flush the pending seconds into finishAttempt via input.secs before clearing the attempt.

== F7 [medium] attempt lifecycle / navigation
   TITLE: Choosing Cancel on the leave-confirm for the stored attempt's own URL leaves a dead page (no attempt, Check does nothing)
   SCENARIO: A stored attempt whose problemId has an older genVersion than the current template (evenOdd.special is already @2, so bumps happen), e.g. problemId evenOdd/evenOdd.special@1/9ix with 1 step. Open its own URL /p/evenOdd/evenOdd.special/9ix (this is what Home's Continue card links to). window.confirm appears; choose Cancel. Type a correct f(−x) line and click Check f(−x).
   EXPECTED: She is not asked to 'leave' the problem she is opening. If Cancel is chosen, the page still works or explains the situation.
   ACTUAL: useAttemptLifecycle sees current.problemId !== instance.id and asks. Cancel navigates (replace) to the same path, so ProblemBody does not remount, the effect deps do not change, and no attempt is started or resumed. The flow receives attempt = null, so submit returns null: no step, no rejection, no message. A reload repeats the confirm, so the only way forward is OK, which abandons her work.
   EVIDENCE: S10 log: 'inst.id evenOdd/evenOdd.special@2/9ix oldId evenOdd/evenOdd.special@1/9ix confirm calls 1 attempt problemId ...@1/9ix steps before/after 1 1 rejection? false'. Code: src/problem/useAttempt.ts:22-31,44; src/problem/useStepEngine.ts:113.
   FIX: Before confirming, compare problemPath(current…) with the current route. If they are the same, the stored attempt is stale for this URL: abandon it and start fresh with an explanatory toast, rather than navigating to itself. Also re-run the lifecycle when Cancel keeps the same location.

== F8 [low] attempt lifecycle / resume
   TITLE: Same seed with different difficulty flags silently resumes the other problem's attempt
   SCENARIO: Open /p/inequalities/ineq.linear/9ix (3x + 6 < 3) and accept 3x < -3. Then open /p/inequalities/ineq.linear/9ix?d=n (a shared or edited link; the statement is -6x - 1 > 17).
   EXPECTED: A different problem: the leave-confirm, then a fresh attempt.
   ACTUAL: problemId omits flags, so both instances are inequalities/ineq.linear@1/9ix. No confirm; the old step '3*x < -3' shows under the new statement; the correct first line of the displayed problem is REJECTED because it is checked against the other problem's line. Completion would be recorded with attempt.difficulty ''. ProblemBody's key includes flags, but the attempt match does not.
   EVIDENCE: S7 log: 'plain 3x + 6 < 3 neg -6x - 1 > 17 ids equal true confirm calls 0 resumed steps ["3*x < -3"] difficulty ' and 'neg canonical[0] after resume -> REJECTED'. Code: src/content/registry.ts:56; src/problem/useAttempt.ts:22,44; src/pages/Problem.tsx:43.
   FIX: Match on problemId AND attempt.difficulty === flags in useAttemptLifecycle (both the early return and the returned attempt), or include flags in the attempt's problemId.

== F9 [low] property chips / completion
   TITLE: The last step's chip prompt stays open after completion; picking a chip shows feedback but records nothing
   SCENARIO: ineq.linear seed 12345. Enter both canonical lines, leaving the chip prompt under the last line (x < -1) unanswered. Fill the Final answer and click Check answer (Problem complete). Then click a chip in the still-visible prompt.
   EXPECTED: Either the prompt is gone once the problem is finished, or the answer is recorded on that step's event.
   ACTUAL: 14 chip radios remain after completion. Clicking one shows "We'd call this: multiply/divide both sides (flip if negative!).", but answerProperty returns early (attempt is null), so the step_accepted event stays property 'skipped'. The isolation step (often the flip-the-sign move) is the one lost.
   EVIDENCE: S8 log: 'prompt open at solve true radios after completion 14', note text as above, last step_accepted event property 'skipped'. Code: src/store/index.ts:287; src/pages/flows/InequalityFlow.tsx:38,86 (chipUi not gated on done); same pattern in InverseFlow.tsx:111,172.
   FIX: Hide or disable PropertyChips when completion is set (skip the prompt at finish), or let answerProperty patch the event by the snapshot's attemptId even after the attempt is closed.

== F10 [low] progress selectors / undo
   TITLE: Undone steps stay in the log as step_accepted and inflate first-try, hint and property rates
   SCENARIO: ineq.linear seed 12345. Accept 3x < -3 and Undo it three times, then accept it once more (1 step in the attempt).
   EXPECTED: Progress-page rates count the step once (or subtract undone steps).
   ACTUAL: firstTryRate(events, weekly, 'ineq.linear') = 4/4 and hintRate denominator = 4 for one surviving step. Selectors and compaction ignore step_undone, so undo/redo cycles pad the first-try numerator and denominator and dilute hint rate and property accuracy.
   EVIDENCE: S11 log: 'attempt steps 1 firstTryRate {"numerator":4,"denominator":4,"rate":1} hintRate {"numerator":0,"denominator":4,"rate":0}'. Code: src/store/selectors.ts:88-100,104-117,120-133; src/store/compaction.ts:43-44; src/store/index.ts:309-321.
   FIX: In undoStep, mark or remove the matching step_accepted event (same attemptId and stepIdx, latest), or have the selectors and foldEvent cancel a step_accepted against a later step_undone.

== F11 [low] final answer / pattern records
   TITLE: Interval-notation lessons caught at parse time (dropped ∪, backwards interval, bracket on ∞, bracket point, empty interval) are never logged
   SCENARIO: Number-line or inequality final answer: type an interval with a dropped union or a square bracket on inf and click Check answer. The field shows the named lesson (QA saw 'Check character 12: Two separate pieces need U (union)').
   EXPECTED: A final_answer event with that pattern, so Progress error-pattern counts include the notation slips (research ux-mobile-progress.md:143: the targeted lessons must fire from text input so progress does not read their absence as mastery).
   ACTUAL: gradeFinalAnswer sets status 'parse' with the pattern but sets graded.interval / graded.setBuilder only for parsed sets. recordSetAnswer logs only graded fields, so no event is written and patternCounts never sees these patterns.
   EVIDENCE: Code (not run in jsdom): src/problem/inequality.ts:63,69 (parse result carries pattern), 81-82,89,93 (graded flags only when a set parsed); src/pages/flows/record.ts:8-13 (records only mismatch or graded fields); pattern ids in src/notation/sets/interval.ts:187,301,328,336,346,355,362.
   FIX: In recordSetAnswer, when a field's status is 'parse' and it carries a pattern, record recordFinalAnswer({correct:false, pattern: field.pattern.id, via:'text'}). Leave pattern-less syntax errors unlogged.

== F12 [low] step submit / records
   TITLE: Re-clicking Check on an unchanged rejected line logs another rejection and triggers the 'two tries' highlight
   SCENARIO: ineq.linear seed 12345. Type x < 999 and click Check this step twice without editing.
   EXPECTED: Re-submitting identical text for the same step is not a new try (no second step_rejected or pattern count).
   ACTUAL: Two step_rejected events, currentRejections = 2, and the hint button shows 'Two tries in a row did not land' after one wrong line. Pattern counts on Progress double as well when the rejection has a pattern.
   EVIDENCE: S9 log: 2 step_rejected events at stepIdx 0, 'currentRejections 2 highlight true'. Code: src/problem/useStepEngine.ts:112-141 (no dedupe before s.rejectStep at 131).
   FIX: Keep the last rejected (stepIdx, typed text) in the hook; when the same text is resubmitted for the same idx, re-show the card without calling rejectStep.

== F13 [low] idle nudge copy
   TITLE: Idle nudge on the final-answer card says '0 steps to go — the hint button is right there' while the hint button is disabled
   SCENARIO: ineq.linear seed 12345. Enter all canonical lines so the Final answer card is showing, then stay idle for 4 minutes.
   EXPECTED: A nudge that fits the phase (write the solution set both ways) and does not point at a disabled control.
   ACTUAL: Banner: 'Still here? 0 steps to go — the hint button is right there.' The Hints panel button (Nudge me) is disabled because InequalityFlow passes disabled={solved || done}.
   EVIDENCE: S12 log: 'nudge Still here? 0 steps to go — the hint button is right there. hint button Nudge me disabled true'. Code: src/pages/flows/ProblemFrame.tsx:160,165; src/pages/flows/InequalityFlow.tsx:61.
   FIX: When progress.solved (or stepsToGo === 0), use a final-answer nudge such as 'Write the solution set both ways below', and only mention the hint button when hints are enabled.

COVERAGE: Read in full: src/pages/Problem.tsx; src/pages/flows/{InequalityFlow,NumberLineFlow,EvenOddFlow,InverseFlow,BonusInverseColumn,ProblemFrame,record,types}; src/problem/{stepEngine,evenOdd,inequality,inverse,useStepEngine,useAttempt,useIdleNudge,useKeyedHint,url}.ts; src/store/{index,selectors,types,compaction,storage}.ts; src/components/{FinalAnswerCard,VerdictCards,WorkedColumn,HintPanel,PropertyChips,MathInput,RejectionCard,useKeymap}; src/pages/Drill.tsx. Also read the relevant parts of src/content/modules/progress.ts, src/engine/step.ts and transforms.ts (swap detection) and src/content/registry.ts (problemId). Tests read for coverage: src/pages/Problem.test.tsx and the test names in store.test.ts, stepEngine.test.ts, selectors.test.ts and App.test.tsx; none cover undo, hints, chips, the nudge, resume or the leave-confirm path.

Reproduction: every finding except F11 was reproduced with a temporary jsdom test, src/__review__/flow.test.tsx (12 scenarios, all passing, each asserting the buggy behaviour), run with node node_modules/vitest/vitest.mjs run src/__review__. The whole src/__review__ folder has been deleted. F11 is pinned to exact code lines but was not run. No file under src/ or docs/ was edited.

Checked and found sound: undo of the swap step un-swaps (swap_xy is the only accept path that sets swapped); history-based progress ignores the swapped flag, so pre-swap lines are not mis-anchored; even/odd undo is correctly limited to the owner of the last step; parse errors never call rejectStep; useKeyedHint reads fresh store state (no stale closure); finish() cannot double-record, because attempt is null after the first call and the completion render is batched; timed mode is excluded from the mastery window and the streak; the compaction window keeps the last 5 problem_done per skill; Drill records one event per answer, guarded by the answer state.

Not examined, or left out as unproven or dev-only: StrictMode double effects on the confirm/Cancel path (dev build only); browsers that suppress window.confirm; loss of unchecked TwinCard/CheckItCard/verdict inputs on reload (minor, local state by design); the ProblemFrame graph/calculator reveal gate (being edited by the lead); calc panels, Graph, Sandbox, Progress page rendering; phone-width behaviour. 

review folder removed
```
