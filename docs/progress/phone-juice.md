# Phone juice: sounds, the combo, confetti and motion, the streak flame

Branch `phone-juice`. Uncommitted, for review.

## Why

The owner tried the Android build: it "works better" but "lacks some pizzaz/excitement that kids need (think
Duolingo)". This phase is the cheapest, loudest part of the fun plan: every right answer answers back with a sound and a
little motion, a combo climbs, and the end of a set feels like a small party. The owner chose sounds ON by default in the
store app, with a switch. It goes into the family web app too and works with rewards on or off. No new XP rules, no ad
changes, nothing about grading.

## What she gets

1. **Sounds**, synthesized in code with the Web Audio API (`components/juice/sounds.ts`; no audio files, nothing
   downloaded or licensed). Short, warm (sine tones, soft triangle tones through a low-pass for the low ones), at a
   modest volume (a master gain of 0.55 over peaks of 0.2 or less):
   - a right line or part: a bright two-note chime (a note and its fifth) that climbs the C major scale one step per
     answer in a row (the combo), from C5 up to C6 and no higher after eight;
   - a slip (a rejected line or card, a wrong check): a soft, low two-note "nope" (E♭4 then C4);
   - a problem finished: a short rising arpeggio (C5 E5 G5 C6); a set's results: a longer fanfare (G4 C5 E5, then a
     held C major chord);
   - with rewards on, today's goal met or a streak milestone: a sparkle (five quick high notes); a mistake squashed: a
     pop (a quick downward glide).
   One AudioContext for the app, made on her first tap while Sounds is on and woken by every tap after (a browser only
   lets one start from a gesture), put to sleep after 30 s with no sound and while the app is in the background. Where
   Web Audio is missing or blocked the app is silent, never an error.
   Sounds follow the event log as the vibrate tick does (`useJuice.ts`, mounted once in the app shell): only for events
   she just added here, never for an import, a reset or the compaction. What one tap adds is one moment (a check that
   grades two boxes, a last line and the finish recorded right after it): decided 40 ms after its first event, with one
   main sound (cues.ts: the finish outranks the chime of the line that finished it; a slip outranks a right box in the
   same check) and then the rewards' extras (the pop, the sparkle).
   **Settings, Practice: "Sounds"** (`settings.sounds`): on by default in the store app (STORE), off in the family web
   app; it belongs to the device (an import never changes it), like Vibrate. Shown where the browser has Web Audio;
   switching it on plays a taste of the chime.
2. **The combo** (`session/combo.ts`, pure, tested): right lines and parts in a row on the first try, over the problem
   and, in a running set, the set's problems before it. A typed line and a card picked right on the first pick both
   count; a slip resets it quietly (no penalty, no sound but the slip's own). From 3 on, with rewards on, a pill
   "3 in a row!" with a small flame slides in: in the phone composer right above the verdict line, at the top of the
   composer box under the work list on a wide screen, and at the bottom of the screen above the keypad where a problem
   has no composer (the parts flows). It grows at 5 and again at 10, and its count bumps when it goes up.
3. **Motion**, all in CSS (one small React layer for the confetti and the floats), all off under prefers-reduced-motion:
   - a kept line (`components/WorkedColumn.tsx`): its check pops and the line flashes green once (not a line restored
     with a saved problem, not a line "Show the step" gave her);
   - "+10" (the award's own XP: +10, +5 fixed, +4 picked, half for a mastered type) floats up from the kept line's
     check, or from the box or button of the part she checked (rewards on); the finish sheet, the wide completion card
     and the set's results count their XP up from 0;
   - confetti (CSS particles, no library): on a set's results, today's goal met, a type newly mastered, and a streak
     milestone;
   - the goal ring sweeps from before to now on the finish sheet (XP before this problem), on the set's results (before
     the set) and on Home (where it stood when she last saw it this session); the type rings already slid on the finish
     sheet and the results, and now also sweep up from empty (New to Practiced);
   - chunky primary buttons: one class, `btn-chunky` (index.css), gives the main actions a darker bottom edge that
     presses down on tap: every Check in every flow (and the inverse's Finish), the keypad's Check, Start a set, Next
     problem, Next in set and See results (completion card, finish sheet, the set's settled slot), Another set. The edge
     is a shadow the gold focus ring keeps; names and roles are unchanged.
4. **The streak**: a flame on the Today card beside "N-day streak", none without a streak, then three sizes (1-6, 7-29,
   30 or more days); dim until today's goal is met, then lit, with one flare the first time she sees it lit that day. The
   first time the streak reaches 7, 30 and 100 days, a one-time celebration: a banner at the top (a big flame, "7-day
   streak!", one warm line, a close button; it goes by itself after 9 s), confetti and the sparkle, remembered in the
   rewards' slice (`RewardsState.milestones`, in backups, additive) so it never repeats.
5. **Layout-agnostic**: the sound, combo, confetti, float and flame pieces never read the screen size; ProblemFrame (a
   page layout) places the pill.

## Design decisions (for review)

- **A revealed line breaks the combo** ("a revealed one does not count"): I read "in a row" as consecutive, so a line
  "Show the step" gave her, or a part answered after a rung-3 hint, resets it to 0 as a slip does (quietly, no sound).
  The other reading (skip it, keep the count) is one line in `comboOf`. Hints 1 and 2 do not touch it (a line right after
  a nudge still pays +10).
- **An undone line is taken back** from the combo (it never paid XP either); kept again, it counts again.
- **Parts count as the rewards count them**: right with no wrong check since the last right one; a box a check grades
  every time (the inequality's two boxes) counts once, and a check where one box is wrong is a slip.
- **The set's combo** runs over the set's attempts in order (`SetChrome.attemptIds`, additive); a skipped problem does not
  reset it. Outside a set (and in a unit review) it is the problem's own.
- **One main sound per moment**: the finish's arpeggio replaces the chime of the line or part that finished the problem;
  a check that is partly wrong plays the nope, not the chime. A revealed line and a hint make no sound. A line fixed after
  a slip chimes at the bottom of the scale (the slip reset the combo).
- **Drill answers are silent**: the design names lines and parts, and a drill answer is neither (the vibrate tick skips
  them too). A drill answer that meets the goal still sparkles. One line in `cues.ts` to add them.
- **The milestone fires only when events she just added cross it**, and only if it was never celebrated. A streak already
  past a milestone (an existing user, an import, rewards just switched on) celebrates nothing until the next one, which
  then marks the lower ones too. Rewards off: no streak, no milestone, nothing recorded. "Reset progress" clears the slice,
  so the milestones can be earned again. A banner rather than a sheet: the finish sheet is usually up at that moment, and
  two sheets would stack.
- **Confetti for a mastery** uses the completion's `newlyMastered` (the mastery bars' rule), so it works with rewards
  off; after a mastery is lost and won back it bursts again (the +100 XP does not pay again).
- **The set's results** celebrate each time they appear (a reload of the results replays the fanfare and the confetti).
- **"+10" from a part** rises from what she acted on, measured at the moment of the check: the focused box (the keypad
  keeps focus in it) or the Check button, else what she last tapped. Two boxes checked together rise one after the
  other. No float where the spot is gone or off screen (above the keypad it is kept in view).
- **Motion is off where the preference cannot be read** (no matchMedia, as in jsdom): nothing moves there. Under reduced
  motion the press of a chunky button does not move either (its edge stays); the pill, the flame and the banner still
  show, standing still.
- **The Sounds switch is in Settings, Practice** (with the keypad), not under Rewards, because it works with rewards off.
- **The AudioContext sleeps** after 30 s with no sound and in the background (battery on a phone); every tap wakes it,
  so the next chime is not late. The same cue asked twice within 50 ms is one sound (React's development double effects).
- **The goal ring on Home** sweeps from the XP it showed last time Home was on screen in this session (a module
  variable); on the first Home of a session it does not move.
- **Additive store changes**: `Settings.sounds` (a device setting, in `DEVICE_SETTINGS`), `RewardsState.milestones`
  (normalized, merged as a union, carried by backups), the action `noteMilestones`, `SetRewards.xpToday`, and the
  optional `SetChrome.attemptIds`. No XP rule, grading, engine or content file changed.

## Log

- 2026-10-21: read CLAUDE.md, BUILD_GUIDE §0/§7, phone-rewards.md, phone-session.md, phone-guided.md; the rewards
  (rewards.ts, haptics, Finish, Rings, TodayCard), the store, backup, the set runner and summary, ProblemFrame,
  Composer, WorkedColumn, the keypad, Settings, App and index.css; every Check button in the flows.
- Built the pure layer first with its tests: `session/combo.ts` (14 tests), `store/milestones.ts` and the slice, backup
  and settings changes (7), then `components/juice/cues.ts` and the sound definitions (8, node).
- Then the juice: the sounds on a fake AudioContext (`audioTesting.ts`, 8 tests), the moment subscriber, the layers
  (confetti, floats, the milestone banner), CountUp, the flame, the pill; the wiring in App, ProblemFrame, Finish,
  Rings, TodayCard, SetSummary, SetPage, Settings, WorkedColumn, the keypad's Check and every flow's Check.
  `Juice.test.tsx` (22), `ComboPill.test.tsx` (5), `Chunky.test.tsx` (6), `StoreSounds.test.tsx` (1).
- Fixes on the way: the chunky stylesheet test read the CSS through `import.meta.url`, which is not a file URL in jsdom
  (now the project path); the floats measured the box she checked but added the scroll of 40 ms later (now the scroll
  at the moment of the check); the goal's confetti and a milestone's bigger burst asked at once were merged into the
  smaller one (the milestone's wins now).

## Not done / left alone

- No device or browser testing (by instruction): the sounds (pitch and volume on a phone speaker), the confetti's look
  and smoothness, where the floats rise, the pill's slide and the chunky press are covered by jsdom tests only. Worth a
  listen and a look on the emulator: that Android's WebView lets the first chime play after the first tap (it follows
  Chrome's autoplay rule; the context is made and resumed inside the tap), the volume against the phone's own sounds,
  and the confetti on a slow phone (64 particles at most per burst, transform and opacity only).
- Drill answers make no sound; the unit review's results have no fanfare (only a set's results were asked for).
- On iPhone, Web Audio follows the ring/silent switch (silent when the phone is on silent). Not changed.
- No new XP rules, no ad changes, nothing about grading; the store fork needs no change (the switch's default follows
  STORE).

## Verification (2026-10-21)

- `npm run typecheck`: clean (app, node and server configs).
- New tests: `session/combo.test.ts` (14), `store/milestones.test.ts` (7), `components/juice/cues.test.ts` (8),
  `sounds.test.ts` (8), `Juice.test.tsx` (22), `ComboPill.test.tsx` (5), `Chunky.test.tsx` (6), `StoreSounds.test.tsx`
  (1): 71. No existing test changed.
- Whole suite, `vitest run --maxWorkers=4`, once at the end: 255 files, 4402 tests, all pass (967 s, with another
  project's tests running beside it).
- `vite build --outDir C:/work/juice/.tmp-dist`: passes (the existing chunk-size warning only); the built CSS keeps the
  chunky, kept-line, float, pill, flame, confetti and banner rules and the reduced-motion block that stops them. Tailwind's
  scanner finds the new color classes (`stroke-navy/35`, `border-gold-text/40`) and generates them (checked with its
  own compiler). The folder was deleted.

## Files

New: `src/session/combo.ts` (+ test), `src/store/milestones.ts` (+ test), `src/components/juice/{sounds.ts, cues.ts,
useJuice.ts, motion.ts, channel.ts, Confetti.tsx, XpFloats.tsx, CountUp.tsx, Flame.tsx, ComboPill.tsx, Milestone.tsx,
JuiceLayers.tsx, audioTesting.ts}` and their tests (`sounds.test.ts`, `cues.test.ts`, `Juice.test.tsx`,
`ComboPill.test.tsx`, `Chunky.test.tsx`, `StoreSounds.test.tsx`), `docs/progress/phone-juice.md`.
Changed: `src/store/{types.ts, backup.ts, rewards.ts (normalize and merge the slice only), index.ts}`,
`src/session/summary.ts` (`xpToday`), `src/App.tsx`, `src/index.css`, `src/components/{WorkedColumn.tsx, MathKeypad.tsx
(the Check key's class), MathInput.tsx, FinalAnswerCard.tsx, SigFigNumeralInput.tsx, VerdictCards.tsx}`,
`src/components/rewards/{Finish.tsx, Rings.tsx, TodayCard.tsx}`, `src/components/set/{SetSummary.tsx, TodaySet.tsx}`,
`src/pages/{Settings.tsx, SetPage.tsx}`, `src/pages/set/chrome.tsx`, `src/pages/flows/ProblemFrame.tsx`, the Check
button's class in `src/pages/flows/{AtomFlow, ComplexNumsFlow, CompositionFlow, EconfigPanel, ElectronFlow,
ExpLogPartsFlow, GeometryFlow, GraphFeaturesFlow, InverseFlow, LogFormsFlow, LogLineFlow, NomenclatureFlow, PeriodicFlow,
PiecewiseMore, PiecewiseRateFlow, PolyDivisionFlow, PolyZerosFlow, QuadraticsFlow, RationalFnsFlow, SigFigFlow,
SignChartsFlow, TransformationFlow}.tsx` and `fnUi.tsx`, `docs/BUILD_GUIDE.md` (§0 UI row, §7).
