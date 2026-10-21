# Phone guided mode: pick the next line

Branch `phone-guided`. Uncommitted, for review.

## Why

On a phone, writing every line of an equation on a keypad is slow, and the owner asked for something that "guides
someone through solving". A design review recommended a Guided mode: she picks the next line from three cards, and each
wrong card is one of the app's named mistakes, so a wrong pick shows exactly that mistake's lesson (studying worked
examples with errors in them has research behind it). Recognizing a line is easier than writing one, so the mode is kept
honest: picked lines count less and keep a problem out of mastery. Drag-and-drop was judged worse on phones. It goes into
the family web app too, and works with rewards on or off.

## What she gets (exponential and logarithmic equations)

1. **The switch** at the top of "Your work": `Type | Pick` and, beside it, "Pick: choose each next line from three
   (counts less)". Type by default; the choice is remembered (`settings.lineEntry`). Only on problem types that offer
   cards (`offersLineCards`), so not on expanding/condensing logs or any other screen.
2. **Pick**: the composer shows three full-width cards (KaTeX) where the box was, under "Pick the next line": the path's
   next line from her current line (the module's canonical step, `logNextStep`) and two wrong lines, each what one named
   mistake turns her current line into (the log engine's own slips, `relationSlips`, through the new `logLineSlips`).
   Their order is fixed by the problem's seed and the line, so a re-render or a reload never reshuffles them.
   - **Right card**: the line is checked and kept exactly as if she had typed it (the same checker and context, the same
     normalized text, the same "check your answers in the original" note), logged as the same `step_accepted` with
     `via: 'card'` (and the step type, `rule`). The next line's cards follow.
   - **Wrong card**: the same verdict a typed slip gets: on a phone the composer's line names the mistake with Why?
     (the whole lesson in a sheet); the work list shows "You picked <line>" and the full card. It is logged as the same
     `step_rejected` with its pattern and `via: 'card'`, so the error patterns and the mistake cards count it. The card
     leaves; she picks again from the cards left (also after a reload).
   - **Type it yourself instead** (under the cards): that line goes to the keypad (the keypad comes up with the box),
     with "Back to the cards" under it.
   - **A line with no cards** is typed, with one line saying why: no wrong line qualifies (the "or" lines and the
     polynomial lines of the log problems have no named slip), her own legal route off the path, or the end of the path
     ("write the solution in the answer box"). A line with only one qualifying wrong card shows two cards.
   - **The answer is always typed**: a picked line that is already the solution does not fill the answer box (a typed
     one still does, as before).
3. **Stuck?** while she types (Type mode): the hint sheet it opens starts with "Pick the next line" ("Three next lines,
   one of them right: pick it, then type again. A picked line counts less."): the cards for this one line, then back to
   typing. The ladder under it is unchanged (Stuck? still takes the nudge). A wide screen has no Stuck? chip; its hints
   panel shows the same offer.
4. **Honest**:
   - (a) XP (`store/rewards.ts`): a line picked right on the first pick +4 instead of the typed +10 (`line_picked`, "A
     line picked right" on the finish sheet); a line picked after a wrong pick 0. Nothing else in the XP rules changes
     (the finish, no-hints, squash and mastery awards; half for a mastered type applies to +4 as to every line: +2).
   - (b) A step type (the canonical step's rule card) she has picked right twice since she last typed one is typed the
     next time it comes up: no cards, no Stuck? offer, and "You picked this one right twice: type it this time".
   - (c) A problem finished with any picked line (`problem_done.picked`) stays out of the mastery window and the rings,
     as a timed test-mode problem does; its XP and its mistake cards (and squashes) still count. The finish sheet says
     "Picked lines count less, and a problem with a picked line does not move the ring"; with rewards off the completion
     card says it does not count toward mastery. In a set's results it reads "Finished, with 2 lines picked", not
     "Right first time".

## Design decisions (for review)

- **A line kept after its cards were shown counts as picked, however she enters it**: picked, typed after "Type it
  yourself instead", typed after switching back to Type, or after Stuck?'s offer. Otherwise Pick would be a way to read
  the right line among three and type it for full XP and mastery. It is the rule a line kept after "Show the step"
  already follows (revealed however it is entered). Stored per line on the attempt (`Attempt.picks`, keyed like
  `hintsUsed`, not cleared by undo; it also keeps the wrong cards she picked and whether she chose to type). The note
  under the box says so. Cost: in Pick mode the first line's cards show when the problem opens, so switching to Type
  right away still counts that first line as picked.
- **"+4 on the first pick"** looks at picks only: a typed slip before the cards does not take the +4 away; a wrong pick
  does (0). A line typed after a wrong pick (Type it yourself instead) pays nothing either: it is a card line.
- **The step type for (b)** is the canonical step's rule card, as asked. In this module every canonical step of a
  problem carries the same card (`eeRuleFor(trap, question)`), so the type is in practice per family of problem: a
  three-line problem in Pick mode goes pick, pick, type. The count is the card lines of the type since she last typed
  one herself: typing one starts it again, so the rule comes back every third time rather than once for life (my
  reading of "typed the next time"). A line shown by the hint, or undone, counts for neither. Every kept card line
  counts as "picked right" (also one picked after a wrong pick). The type is logged on every line of these problems as
  `step_accepted.rule`, an additive field beside `via`, so the rule is a pure function of the event log
  (`selectors.ts` `picksSinceTyped` / `typeThisTime`); the 60-day compaction forgets old picks.
- **Stuck?'s "first offers"**: the offer is the first thing in the hint sheet Stuck? opens, and Stuck? still takes the
  nudge as before, so the ladder is unchanged (the phone-screen test pins the nudge on the first tap). The other reading
  (the first tap shows the cards, the next one the ladder) would change that test.
- **Which wrong cards**: of the engine's slips of her line, the ones closest to the right line come first (pairs of
  characters in common, minus a penalty for a line much longer than the right one), one per mistake id, two at most,
  each confirmed by `checkLogStep(current, card)` as exactly that id, never kept by it, never the right line written
  another way (`logSame`). In the slips' own priority order the cards were odd (`3^x = log(13)^10` beside
  `x = log(13)/log(3)`); now that line gets `x = log(3)/log(13)` and `x = log(13) − log(3)`, and `3^x = 13` gets
  `log(3)^x = log(13)` and `3^x = log(13)`. Some cards still go sideways rather than forward (`ln(x + 2) = e^4` beside
  `x = e^4 − 2`): they are that line's named slips; a plain sign slip is not one of them.
- **Cards only from a line on the path** (the start, or a line that is a canonical line): after her own legal route the
  module's "next line" is its first line again, a sideways move, so those lines are typed.
- **Coverage** (40 seeds of each template, the lines on the paths): every exponential line gets three cards; 65% of
  the logarithmic lines get three (their polynomial and "or" lines have no named slip and are typed); 60% of the
  quadratic lines get cards, mostly two, since the first line has one qualifying wrong card (`4^x − (9·2)^x + 8 = 0`,
  the coefficient into the base) and the "or" lines none. Twelve different named mistakes appear on the cards. More
  slips there would be engine work. Building a line's cards takes about 12 ms here (cached per line).
- **Beyond the mastery window**: the set results said "Right first time" and the unit review counted "right first
  time" for a problem whose lines were all picked right. Both read `isFirstTryRight` (pages/review/session.ts), which
  now also needs no picked line; the set results say "Finished, with 2 lines picked" instead (a wrong pick still reads
  "Caught and fixed 1 mistake"). Left as they were: Progress's first-try and hint rates and the weekly counters count a
  picked line like a typed one (it is the same `step_accepted`, as asked).
- **The cards' state**: a wrong card leaves the list, kept across a reload. The cards remount per line, and focus goes to
  the first card when it is nowhere, so a keyboard's focus never rides on the right card into the next line.
- **Type / Pick belongs to the device** (an import keeps this device's value), like the keypad: picking is a phone's way
  to write lines.
- **Store API, additive**: `acceptStep({ via, rule })`, `showCards(key?)`, `rejectCard({ pattern, text, key? })`,
  `typeCardLine(typing, key?)`; `ProblemSummary.picked`; `FinishInfo.picked`; `inMasteryWindow(e)` (compaction.ts) used
  by the mastery rule, the rings, the rewards' window and the compaction's kept five. Backup import takes the new fields
  as they are (events are not reshaped).
- **Engine, additive**: `logLineSlips(line, vars)` (engine/logs/lineSlips.ts) lists `relationSlips` as `{ id, text }`;
  nothing that grades changed. `LogLineFlow` now builds its checker context with `expLogStepContext` (the same object
  as before) so the cards and her typed lines are judged alike.

## Log

- 2026-10-20: read CLAUDE.md, BUILD_GUIDE §0/§7, the four phone phase notes, LogLineFlow, the log engine's step checker
  and slips, the module's paths and rule cards, the store (events, attempt, rewards, selectors, compaction, backup),
  ProblemFrame, Stuck, the hint panel and the keypad's focus rules.
- Probed the engine's slips for every line of 36 problems: most come back from `checkLogStep` as their own id; some are
  kept (`x = e·1` for `ln(x) = 1`) or named as another id; about 6 ms a check here, about 17 ms to build a line's cards.
- Built the pure layer first with its tests: `logLineSlips` (4), the generic builder (7), the exp/log source over 40
  seeds of each template (5), then the store (types, actions, XP rule, selectors, compaction, backup; 13 new tests).
  The first ranking (likeness only) picked a slip piled on a slip; added the length penalty.
- Then the UI: `LineCards.tsx`, ProblemFrame's offer, the flow, the finish notes; `GuidedMode.test.tsx` (10), and the
  set results (`session/summary.test.ts`, 1). Fixes on the way: autofocus comes before the keypad knows the box, so
  "Type it yourself instead" focuses the box from an effect; the right card's button kept focus into the next line
  (the cards now remount per line); a wrong card leaving the list dropped focus to the page (it goes to the first card
  left). The existing tests around the problem screen (LogLineFlow, PhoneScreen, ProblemFrame, MathKeypadFlows,
  rewards, sets, review) passed unchanged.

## Not done / left alone

- No device or browser testing (by instruction): the cards in the phone composer, the sheet and the keypad hand-off are
  covered by jsdom tests only. Worth a look on the emulator: three cards plus the status row in the sticky composer on a
  small phone, and long lines (they scroll sideways inside their card).
- Only exponential and log equations offer cards. Another line-by-line type joins by adding a source to
  `problem/cardSources.ts` (its next line, its named slips, its checker).
- No Type / Pick in Settings: the switch is on the problem screen, and it is remembered there.
- No tablet layout (the pieces do not read the screen size; a layout only has to place them).
- The answer box is not a card (as designed).
- The card builder has no try/catch of its own: it calls only engine functions the checker already runs on the same
  lines (the parser, `relationSlips`, `checkLogStep`, `sameLogLine`).

## Verification (2026-10-20)

- `npm run typecheck`: clean (app, node and server configs).
- Whole suite, `vitest run --maxWorkers=4`, once at the end: 245 files, 4321 tests, all pass (622 s). New: 40 tests in
  `engine/logs/lineSlips.test.ts` (4), `problem/lineCards.test.ts` (7), `problem/cardSources.test.ts` (5: every
  template over 40 seeds, 120000 ms timeouts), `session/summary.test.ts` (1), `pages/flows/GuidedMode.test.tsx` (10:
  the switch, right on the first pick twice and the typed answer, rewards on, wrong then right, Type it yourself instead,
  a line with no cards, the hints' offer, two right picks then typed, and on a phone Stuck?'s offer and the keypad
  hand-off), and new cases in `store/{rewards, selectors, compaction, backup, store}.test.ts` (3, 3, 1, 2, 4). No
  existing test case changed.
- `vite build --outDir C:/work/tmp/guided-dist`: passes (the existing chunk-size warning only).

## Files

New: `src/engine/logs/lineSlips.ts` (+ test), `src/problem/lineCards.ts` (+ test), `src/problem/cardSources.ts`
(+ test), `src/components/LineCards.tsx`, `src/pages/flows/GuidedMode.test.tsx`, `src/session/summary.test.ts`,
`docs/progress/phone-guided.md`.
Changed: `src/engine/logs/index.ts` (one export), `src/store/{types.ts, index.ts, rewards.ts, selectors.ts,
compaction.ts, backup.ts}` (+ `rewards.test.ts`, `selectors.test.ts`, `compaction.test.ts`, `backup.test.ts`,
`store.test.ts`), `src/pages/flows/{LogLineFlow.tsx, ProblemFrame.tsx}`, `src/components/rewards/{Finish.tsx,
words.ts}`, `src/session/summary.ts`, `src/pages/review/session.ts` (`isFirstTryRight`), `docs/BUILD_GUIDE.md` (§0 UI
row, §7).
`src/store/compaction.ts` and `src/store/index.ts` hold NUL characters inside template strings (key separators, as
committed); they were edited as text with the NULs kept, and git shows `compaction.ts` as binary, as before.

## Review (Claude, 2026-10-20)

Built by one Claude agent (about 0.63M tokens, 66 minutes). Read: the card builder and its sources, the twice rule,
the flow wiring and the XP and mastery changes. Checked on the Android 16 emulator in a store-app build, on
500 · 1.08^x = 1000: the Type | Pick switch with its caption; three cards (1.08^x = 2, and the named slips
(500 · 1.08)^x = 1000 and 500 · 1.08^x = ln(1000)); a wrong pick named ("The number in front is not part of the
base", Why?) and gone from the cards; the right picks kept as lines 1 and 2; "That was the last line of the path";
the answer typed on the keypad (9.006); the finish sheet at +44 XP ("A line picked right +4": the line picked after a
slip pays nothing) with "Picked lines count less, and a problem with a picked line does not move the ring".

Changed in review:
- The twice rule was keyed by the step's rule card, which every line of a problem shares, so a three-line problem in
  Pick went pick, pick, type. The step type is now what the move does as the engine reads it
  (`cardSources.ts` `stepTypeOf`: take_log, both_sides, rewrite), so "picked right twice: type it this time" follows
  the kind of step across problems; the test now picks two both-sides lines in one problem and types the next
  both-sides line in another.
- Found on the emulator: a card for the slip (log 1.08)^x printed as log(1.08)^x, which reads as log(1.08^x), a right
  step. The LaTeX printer now brackets a function call raised to a power, (log(1.08))^x, everywhere (|u|^2 keeps its
  bars); tested in `notation/toLatex.test.ts`.

Left: only exp/log equations offer cards; the wording "A part right first try" for the answer of a line-by-line
problem could read "Answer right first try".

## Follow-up: the answer box at the end of the work (Claude, 2026-10-21)

Found on the emulator while reviewing the phone juice. On a phone the answer box sits under the work, behind the
composer, so the end of a line-by-line exponential or log problem was easy to miss:
- A typed line that already is the solution went into the answer box (out of sight) and the composer asked for the
  next line ("No cards for this line: type it."). Now, while the box still holds that line, the composer says "Your
  last line is in the answer box." with a "Check my answer" button, which checks the box as its own Check does; the
  kept line's status adds "It is in the answer box below."
- At the end of the card path, "That was the last line of the path: write the solution in the answer box." ends with
  "Go to the answer box": the box takes the focus as after a tap, so on a phone the keypad opens on it and brings it
  into view (on a computer it scrolls into view).
- The nudge's Dismiss no longer breaks into letters on a narrow phone.

Tests: `LogLineFlow.test.tsx` (the offer comes and goes with the box; "Check my answer" finishes the problem) and
`GuidedMode.test.tsx` ("Go to the answer box" on a wide screen, and on a phone where it opens the keypad on the box).
