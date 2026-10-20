# Phone session: sets, the Today screen, bottom tabs, the ad seam

Branch `phone-session`. Uncommitted, for review.

## Why

A design review of the phone app found that Home had no single main action (a sales paragraph, a resume card, class
chips, module cards with two buttons each), the navigation was a row of text links at the top, out of thumb reach, and
there was no session: every problem was a one-off, so the store app's full-screen ad had no natural place. Google Play
allows a full-screen ad at the end of a level or a section, never right after a button that starts something. The
owner decided: full-screen ads only at the END OF A SET, announced. Rewards (XP, goal, streak, mistake cards) came last
phase; this phase adds the session loop around them, in the family web app too (on phones), with rewards on or off.

## What she gets

1. **Sets.** "Start a set" on Home builds three problems for her from the class selected on Home and runs them one after
   another on the usual problem screen. The types (`session/buildSet.ts`, pure, tested), never the same type twice:
   (a) the type of her top open mistake card in that class (closest to squashed); (b) a mastered type due for review
   (two weeks since its last problem, the rewards' `REVIEW_AFTER_MS`), the one waiting longest; (c) the unit she is
   working in (the unit of her most recent problem in the class; with no history, the class's first unit with
   problems): its types not mastered yet, Practiced and Solid before New, in the unit's order; (d) still short: the
   next unit the same way (then the units after it, then the ones before). Each at its default difficulty with a fresh
   seed. A new student gets the first three types of the first unit.
2. **Running a set** (`pages/SetPage.tsx`, route `/set`): on a phone the compact header gets a row above the title with
   ×, one dot per problem (done ✓, skipped dashed, hers now gold, to do hollow) and "2 of 3", and a ⋯ menu with "Skip
   this problem". A wide screen keeps its page, with the dots and a "Skip this problem…" button in a bar above the
   breadcrumb, and the dots again in the completion card. After a problem the finish sheet's main button (or the
   completion card's, rewards off) reads "Next in set"; after the last, "See results". "Back to <module>" is not offered
   inside a set.
3. **Leaving and resuming.** × (or "Done for today") goes Home and keeps the set (one active set, `pct.set`, versioned
   and checked on read: anything unreadable, an older version or a problem type that no longer exists is ignored). Home
   offers "Resume your set · 2 of 3"; her work in the open problem comes back with it. A problem she finished but did not
   leave with "Next in set" is behind her when she comes back.
4. **Skipping** counts as skipped, not as wrong: no `problem_done`, nothing against mastery. Work she had in it is left
   unfinished (`problem_abandoned`, as when another problem starts); a problem she only opened leaves no trace. From the
   ⋯ menu (a small sheet: "Keep going" / "Skip this problem"), or from the leave sheet: opening another problem while
   the set's problem has her work in it asks "problem 1 of 3 in your set ... Skip it?" with "Back to it" (back to the
   set) and "Skip it".
5. **Results**, after "See results": a big check, "Set done", each problem (its title, its type when that says more,
   and "Right first time", "Caught and fixed 2 mistakes" or "Skipped"); with rewards on, the set's XP (the sum of its
   attempts' awards from `store/rewards.ts`), today's goal ring, the rings that moved (before the set → now) and the
   mistakes it squashed. A big "Another set" (a new set from the same class) and "Done" (Home). Rewards off: the same
   without XP, rings, the goal and the squashed mistakes.
6. **The ad seam** (`session/breaks.ts`): `registerSetEndBreak(fn)` and `setEndBreak(go, { timed })`. The set runner
   calls `setEndBreak` exactly once per set, when she taps "See results" on the last problem (a second tap while a break
   is up does nothing), with `go` showing the results. By default `go` runs at once; a registered break that throws
   still shows them, and `go` runs at most once. Nothing else calls it ("Next in set", "Another set", "Start a set").
   The store app registers its announced interstitial ("A short ad, then your results"); nothing here shows an ad.
7. **Home on a phone is a Today screen**: the app's name as a short title (no paragraph), the rewards' Today card (rewards
   on), ONE big primary button "Start a set" with "3 problems, about 5 minutes" under it, then Resume (the set, then the
   unfinished problem when it is not the set's), then the class and unit lists as they were, their buttons outlined.
   A wide screen keeps its layout and its filled buttons, plus the button.
8. **Bottom tabs on a phone** (`components/TabBar.tsx`): Home, Ask (when the tutor is configured), Drill, Progress,
   Settings, Sandbox, the same destinations as the top navigation, each a line icon and a label, 56 px tall (each link at
   least 48), the current one with `aria-current="page"`, a pill behind its icon and a bold label. On every menu screen
   (Home, a class, a module page, Drill, Progress, Settings, Ask, the tutor log, Sandbox, the review's start and results);
   the top navigation hides on a phone. A problem screen and a running set (the set route, the unit review's problems)
   show neither: the compact header only. The bar pads itself for the navigation bar (`env(safe-area-inset-bottom)`)
   and paints over the white band under it; while it is up `--tabbar-h` on `<html>` keeps its room (body padding, scroll
   padding) and puts the toasts above it, as `--keypad-h` does for the keypad (the keypad opens over the bar, so the room
   is the larger of the two). Wide screens keep the top navigation unchanged, on every page.

## Design decisions (for review)

- **(c) leaves mastered types out.** "Types not yet mastered first" could also mean "mastered ones last, still in the
  unit". I read it as: a mastered type comes back through (b) when it is due, not through (c) or (d), so a unit she has
  nearly mastered fills the set from the next unit, and the next set's working unit moves on with her. Only when the
  whole class is mastered and nothing is due does a set take mastered types (`extra`, working unit first) rather than
  come up short. One function to change (`pickSetTypes`) if the other reading is wanted.
- **(a) is the top open card in the selected class**, not across classes (a set comes from one class). Cards the
  compaction folded into `pct.rewards` count. (a) and (b) apply with rewards off too: the cards and rings are pure
  functions of the log; only their display is a rewards feature.
- **(b) takes the type waiting longest** when several are due (the others wait for the next set); **(d) goes round the
  class**: the units after the working unit, then the ones before it.
- **One active set; "Start a set" replaces it** without asking (the finished problems stay in the log; only the old
  set's grouping goes). If the old set's open problem has her work in it, the usual leave sheet asks before the new set's
  first problem starts. The big button stays "Start a set" while a set is open, as designed; Resume is right under it.
- **Resume shows both** when there is a set and a different unfinished problem: "Resume your set" first, then the other
  problem's Continue card. The Continue card hides when the unfinished problem is the set's.
- **Skip from the leave sheet** applies when the problem she is asked about is the set's current one; "Back to it" then
  goes to `/set`, not to the bare problem URL.
- **The results' titles** are the problem's own title (what its header said) with the type's title under it when it
  differs ("Solve the inequality" / "Linear inequality"). "Caught and fixed N mistakes" counts every rejected line and
  every wrong check in that attempt, named or not. A finished problem with no mistake but a step shown says "Finished,
  with a step shown". A ring "moved" when its level or its fill changed.
- **The set's XP** includes what a skipped problem's lines earned before she skipped it (the sum of its attempts'
  awards). The break's `timed` is test mode at the start of the set.
- **A wide screen also shows a set bar above the breadcrumb** (the dots and "Skip this problem…"): without it a wide
  screen had no way to skip. The completion area shows the dots too, as designed.
- **The top header (name and links) hides entirely on a phone**: the tab bar has Home, and every page has its own title.
  `main` is a little tighter on a phone (16 px on top; 24 px at the bottom when the bar keeps its own room).
- **The tab bar marks a tab on every menu screen**: Home for a class, a module page and the unit review (Home opens
  them), Settings for the tutor log. The top navigation's marking is unchanged (a module page marks nothing there).
  Sandbox is in the bar because it is in the top navigation (five tabs, six with Ask); the store app can drop it there.
- **The review in progress registers as full screen** (`useFullScreenPage()` in `Review.tsx`'s running set, one line), so
  a phone shows no tab bar between its problems either. How reviews build, run, time and summarize is unchanged.
- **Home's other actions are outlined on a phone** (Continue, Resume, Practice weak spots, Random problem, the review
  link, the iOS "Got it") so "Start a set" is the one filled action; selected class and unit chips stay filled (they are
  choices, not actions).
- **Additive store action** `leaveAttempt()` (`store/index.ts`): `problem_abandoned` when she touched the attempt, else
  just clears it. `abandonAttempt` is unchanged (the review's Skip still uses it).
- **Small things**: a set this device cannot save (storage blocked or full) keeps going in memory with one toast, as the
  review does; Settings' "Reset progress" also clears the active set; `pages/review/session.ts` now exports
  `slotEvents` and `isFirstTryRight` (unchanged) and `components/rewards/Finish.tsx` exports `goalCaption`, for the
  results.

## Log

- 2026-10-20: read CLAUDE.md, BUILD_GUIDE §0/§7, phone-keypad.md, phone-screen.md, phone-rewards.md; App, Home,
  ProblemFrame, PhoneHeader, the leave sheet and useAttempt, the review (session, build, chrome, page and tests), the
  rewards (rewards.ts, Finish, TodayCard, Rings, words), the store, storage, compaction, courses, index.css.
- Built the pure layer first with its tests: `session/breaks.ts` (5 tests), `session/buildSet.ts` (14),
  `session/activeSet.ts` (7), `session/summary.ts` (through the results tests). All passed on the first run.
- Then the UI: the set chrome, dots and skip menu, the results, the set page, ProblemFrame / PhoneHeader / leave sheet
  wiring, the tab bar, the app shell, the Today screen; tests `SetPage.test.tsx` (8), `TabBar.test.tsx` (13),
  `HomeToday.test.tsx` (5). Typecheck clean. The existing tests around Home, App, rewards, the problem frame, the phone
  screen, Problem, Review, Ask and the store passed unchanged (19 files, 177 tests).
- The whole suite passed on its one run; then one test title in `TabBar.test.tsx` was made to say what it checks (that
  file re-run: 13 pass), and the build passed.

## Not done / left alone

- No device or browser testing (by instruction): the tab bar's safe-area padding, the sheets and the full-screen switch
  are covered by jsdom tests only. Worth a look on the emulator: the bar over Android's gesture bar, the keypad opening
  over the bar on Sandbox, a toast above the bar.
- The store app's interstitial itself (the fork registers it), and dropping Sandbox and Ask from its tab bar.
- A tablet layout (later): the set runner, the results, the tab bar and the Today pieces do not read the screen size,
  so a tablet layout only has to place them.
- No change to how unit reviews behave; a review is not a "set" for the break (it never calls `setEndBreak`).

## Verification (2026-10-20)

- `npm run typecheck`: clean (app, node and server configs).
- Whole suite, `vitest run --maxWorkers=4`: 235 files, 4262 tests, all pass (last phase: 229 files, 4210). New:
  `session/breaks.test.ts` (5), `session/buildSet.test.ts` (14), `session/activeSet.test.ts` (7),
  `pages/SetPage.test.tsx` (8), `components/TabBar.test.tsx` (13), `pages/HomeToday.test.tsx` (5). No existing test
  needed a change: on a wide screen (jsdom without `matchMedia`) Home, the problem page and the top navigation are as
  they were, and the phone tests render pages without the app shell.
- `vite build --outDir C:/work/tmp/session-dist`: passes (the existing chunk-size warning only); the built CSS keeps
  the tab bar, toast and padding rules as written.

## Files

New: `src/session/{breaks.ts, buildSet.ts, activeSet.ts, summary.ts}` (+ `breaks.test.ts`, `buildSet.test.ts`,
`activeSet.test.ts`), `src/pages/SetPage.tsx` (+ `SetPage.test.tsx`), `src/pages/set/{chrome.tsx, startSet.ts}`,
`src/components/set/{SetProgress.tsx, SetSummary.tsx, TodaySet.tsx}`, `src/components/{TabBar.tsx (+ TabBar.test.tsx),
navItems.tsx, appChrome.ts}`, `src/pages/HomeToday.test.tsx`, `docs/progress/phone-session.md`.
Changed: `src/App.tsx`, `src/index.css`, `src/pages/Home.tsx`, `src/pages/flows/{ProblemFrame.tsx, PhoneHeader.tsx,
LeaveProblemSheet.tsx}`, `src/pages/Review.tsx` (one line), `src/pages/review/session.ts` (two exports),
`src/pages/Settings.tsx` (reset clears the set), `src/store/index.ts` (`leaveAttempt`), `src/components/A2HSCard.tsx`
(`quiet`), `src/components/rewards/Finish.tsx` (exports `goalCaption`), `docs/BUILD_GUIDE.md` (§0 UI row, §7).
