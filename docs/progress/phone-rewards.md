# Phone rewards (XP, daily goal, streak, mistake cards)

Branch `phone-rewards`. Uncommitted, for review.

## Why

A design review found that finishing a problem felt like nothing ("Problem finished", "0 hints · day streak 1"), Home
had no single main action, and Progress was a long table of "not yet". The phone app should be appealing, with rewards
that fit a study app; the family web app gets them as an option.

## What she gets (rewards on)

- **XP**, from the event log (`store/rewards.ts`, pure): a line or part right on the first try +10; fixed after a named
  mistake on it +5; revealed 0; a finished problem +20, +10 more with no hints and nothing revealed; a right drill answer
  +2; a mistake squashed +50 (once per card); a type newly mastered +100 (once per type, the rule in `selectors.ts`). A
  mastered type pays half (rounded up) until it is due for review: two weeks after its last problem. An undone line
  pays nothing. Hints cost nothing but the no-hints bonus.
- **Daily goal** 30, 60 or 100 XP (Settings, default 60). A ring shows today's XP against it.
- **Streak**: a day counts when the goal is met. One rest day is banked each week (Monday, and on the first day she
  ever met the goal), at most two, used by itself for a missed day; a missed day with none left waits for a double goal
  the next day (today's ring then counts to twice the goal). "5 of 7 this week" and a Monday-to-Sunday row of dots.
  No warnings: with no streak it says "Meet today's goal to start a streak".
- **Mistake collection**: each named mistake (step rejection or wrong check with a catalog pattern) is a card per
  (pattern, problem type), marked Caught, with its count. Three later finished problems of that type without it flip it
  to Squashed (+50 once). Made again after that, it is Caught again (no second +50).
- **Where**: (1) the finish sheet on a phone (a bottom sheet in the completion card's place: big check, "+45 XP" with
  its lines, the goal ring, the type's ring sliding from before to after, one big Next problem button and Done for today;
  closing it leaves a small card with "See what you earned"); on a wide screen the same content in the completion card.
  (2) The top of Home: goal ring, streak, week dots, rest days saved, top three open cards (each opens a problem of its
  type). (3) Progress: a ring per problem type (New, Practiced, Solid, Mastered) grouped by class and unit, and the
  mistake collection; on a phone in place of the two tables, on a wide screen above them. The Day streak stat becomes
  the goal streak.
- **Celebrations**: goal met, a double goal that mends yesterday, a comeback (first finished problem after three or
  more whole days away), and the squash and mastery lines, starred.
- **Switches** (Settings, Rewards): "Rewards (XP, daily goal, streak)" (absent = on in the store app, off in the family
  app; it belongs to the device, an import never changes it), the daily goal, and "Vibrate" (touch screens that can
  vibrate; default on): a 10 ms tick on a right line or part, a double tick when the goal is met.

## Design decisions (for review)

- **Parts** are right `final_answer` events: the wrong checks since the attempt's last right one are the mistakes on
  it, and a rung-3 hint since then revealed it. The inequality / number-line answer grades both boxes on every check,
  so `recordSetAnswer` now logs `part` ("Interval notation" / "Set-builder notation") and each box pays once; the two
  boxes disagreeing is a named mistake on both. `final_answer.part` is a new optional field (additive).
- **The slice `pct.rewards`** (in backups): `days` (met / double, never lowered), `settledThrough` (days up to it are
  read from `days` alone), `foldedThrough` + `cards` + `mastered` (what the compaction deletes, folded first). The
  days are settled on every start (inside `compactNow`, before it deletes anything), before the goal changes (so
  raising it never undoes a day; lowering it can count a recent day that met the lower goal), and after an import.
  Merge import: per-day max, settled/folded marks go back to the earlier device's, cards keep the later state and the
  larger count; folded counts can be off after merging two devices that both compacted (as `weekly` already is).
- **+100 once per type**, even across a lost-and-won-back mastery and across the compaction (`mastered`).
- **Squash counting resets** when she makes the mistake again (the "2 of 3" counts since the latest time). Any
  finished problem of the type counts, timed ones too; her own attempt with the mistake never does.
- **Rings**: a fifth for each of the last five normal-mode problems that went well (first-try rate ≥ 80%, nothing
  revealed, the answer right); Solid at three; full and green when the mastery rule says Mastered.
- **Settings copy** says the goals are "about 1, 3 or 5 problems" as the design does; a clean problem with three lines
  earns 60, so the real counts may be lower. Worth checking against her real XP.
- **Haptics** only for events she just added (an import of older events never ticks). The Android app may need
  `android.permission.VIBRATE` in its manifest for `navigator.vibrate` inside the WebView (not checked here).

## Log

- 2026-10-20: read CLAUDE.md, BUILD_GUIDE §0/§7, phone-keypad.md, phone-screen.md, the store (events, selectors,
  compaction, backup, storage), record.ts (how lines and parts are logged), the hint ladders, ProblemFrame's
  completion card, Home, Progress, Settings, Drill.
- Built the pure layer (`store/rewards.ts`) with its tests first (24), then the slice, backup and store wiring (store
  and backup tests), then the UI (`components/rewards/*`, Home, Progress, Settings, ProblemFrame, App) and its jsdom
  tests (`Rewards.test.tsx` 17, `StoreEdition.test.tsx` 1). One fix on the way: a unit heading lost the space before its
  "· 0 of N mastered" in the accessible name.

## Not done / left alone

- The parts flows do not log a part's name, so the sheet says "A part right first try" / "2 parts right first try"
  rather than the design's "m∠B right first try" (the inequality's two boxes are named). Naming them is one argument
  per flow's record helper if wanted.
- No device or browser testing (by instruction): the sheet, rings and ticks are covered by jsdom tests only.
- The old day streak (`pct.streak`) is untouched; with rewards off it shows as before.

## Verification (2026-10-20)

- `npm run typecheck`: clean.
- Whole suite, `vitest run --maxWorkers=4`: 229 files, 4210 tests, all pass. New: `store/rewards.test.ts` (24),
  `components/rewards/Rewards.test.tsx` (17), `components/rewards/StoreEdition.test.tsx` (1); `store/backup.test.ts`
  (+3) and `store/store.test.ts` (+4).
- `vite build --outDir C:/work/tmp/rewards-dist`: passes (the existing chunk-size warning only).

## Files

New: `src/store/rewards.ts` (+ test), `src/components/rewards/{words.ts, Rings.tsx, MistakeCards.tsx, TodayCard.tsx,
Finish.tsx, haptics.ts, Rewards.test.tsx, StoreEdition.test.tsx}`, `docs/progress/phone-rewards.md`.
Changed: `src/store/{types.ts, index.ts, backup.ts (+ test), selectors.ts, storage.ts, store.test.ts}`,
`src/pages/{Home.tsx, Progress.tsx, Settings.tsx}`, `src/pages/flows/{ProblemFrame.tsx, record.ts}`, `src/App.tsx`,
`docs/BUILD_GUIDE.md` (§0 store row, §7).

## Review (Claude, 2026-10-20)

Built by one Claude agent (about 0.54M tokens, 66 minutes). Read in full: `store/rewards.ts` (the XP walk, the
parts and boxes, the streak with rest days and the double-goal mend, settle / fold / merge, the rings, the finish
info) and the record helpers in `record.ts` (each check logs one record; the set answer is the only one that grades
two boxes every time, and it names them). No counting bugs found. Checked on the Android 16 emulator in a store-app
build:
- Home: the Today card (goal ring "10 of 60 XP", "Meet today's goal to start a streak · 0 of 7 this week", the week's
  dots, an empty "Mistakes to squash");
- finishing log₁₆ 128 = 7/4 with the keypad: the finish sheet with "+40 XP" (Answer right first try +10, Problem
  finished +20, No hints +10), the goal ring at 50 of 60, the type's ring going New → Practiced 1/5, Next problem and
  Done for today;
- Progress and Settings (the switch on by default in the store app, the goal, Vibrate).

Changed in review:
- Progress on a phone opened with about ten screens of empty "New" rings before the mistake collection. The
  collection now comes first, and each unit is a fold-out that opens by itself once she has finished a problem in it
  (the others are one line each); the test checks both.
- Settings said 60 XP is "about 3 problems", but a clean problem pays 40 to 70 XP (a line +10, finishing +20, no
  hints +10). Now "about 1 problem", "1 or 2 problems", "2 or 3 problems", and the three goals sit in three equal
  columns instead of wrapping onto two rows.
- Store app only: `android.permission.VIBRATE` in the fork's manifest (a normal permission, no prompt), so the ticks
  work inside the WebView.

Seen and left: the emulator's "about 1195 min of focused work" is its old data from before the idle cap (phase 1),
not a new count. The parts flows still do not name their parts on the finish sheet, as the builder noted.

Verification after the review changes: typecheck clean; the whole suite, 229 files and 4210 tests, passes.
