# Phone quests: three daily quests, a chest, colour themes to earn

Branch `phone-quests` in `C:\work\quests` (outside OneDrive). Uncommitted, for review.

## Why

The owner asked for the "pizzazz kids need (think Duolingo)". Juice, the unit path and Mistake Monsters shipped. This is
the fourth fun build of the approved plan: DAILY QUESTS AND CHESTS. Three small goals a day, built on what the checker
sees, and a chest when all three are done. Rewards are earned, never bought: no gems, no shop, no hearts, nothing a
purchase or an ad can give.

## What she gets

1. **Three quests a day** (`src/session/quests.ts`, pure). Each local day draws three from the pool, by a generator seeded
   with the day, among the ones she can do that day judged by her log when the day began (midnight): her class (the class
   of her latest problem before the day, else Home's choice), her open mistake cards, her rings, her path. What she does
   during the day never changes the day's three. One quest per group (two set quests, or two "focus" quests, on one day
   would ask the same thing twice). Sizes follow the daily goal (30, 60, 100 XP):

   | Quest (her words) | Group | Weight | Offered when | 30 / 60 / 100 | What counts |
   |---|---|---|---|---|---|
   | Earn N XP | volume | 2 | always | 30 / 60 / 100 | the day's XP from her work (the rewards' own awards), her own problems included; a chest's bonus not |
   | Finish N problems | volume | 2 | always | 2 / 3 / 4 | every `problem_done` of the day, her own and timed ones included |
   | Get N lines or parts right first try | skill | 3 | always | 5 / 8 / 12 | the rewards' `line`, `part` and `line_picked` awards (an undone line paid nothing, a fixed or shown one is not first try); her own count |
   | Finish a set with no hints | set | 2 | her class has problem types | 1 | a `set_done` of the day with nothing skipped and no `hint` event in any of its problems |
   | A perfect set: every problem right first time | set | 1 | the same, and the goal is 60 or 100 | 1 | a `set_done` with nothing skipped and every problem `isFirstTryRight` (the results' "Right first time") |
   | Squash a monster | focus | 3 | an open card when the day began, of a type she can practise (goal 30: one at most two clean problems from squashed) | 1 | the rewards' squash awards (her own problems never squash) |
   | Finish a problem in a type you have not mastered | focus | 2 | her class has a type she has not mastered | 1 / 1 / 2 | a generated `problem_done` of a type not mastered when the day began (never her own) |
   | Practice the next stop on your path (+ the stop's name) | focus | 2 | her path has a "You are here": the set builder's first type when the day began | 1 | a generated `problem_done` of that type (never her own) |
   | Check a problem from your homework | own | (always on its day) | one school day a week (Monday to Thursday, fixed by the week's hash), where her class has a module that takes her own problem | 1 | a `problem_done` of her own |

   Never a quest to make a mistake, never one that needs test mode, the tutor or anything paid.
2. **Where.** Home's Today card has a quests row: "Quests 1/3" (to a screen reader "Quests: 1 of 3 done") and three short
   lines, each with its words, "6 of 8" and a thin bar (decorative), ticked and green once done. The finish sheet (the
   wide completion card) and the set's results show what that problem or set moved: "Quest done: Finish a set with no
   hints" in gold with a tick that pops (motion allowed), and "Get 8 lines or parts right first try 6 of 8" with its bar
   for a quest it moved without finishing. A finished quest plays the code-made `quest` cue (E5, A5, then a held E6; Sounds
   on), after the finish's arpeggio or the results' fanfare.
3. **The chest.** When all three are done, a chest appears on Home's quests row, on the finish sheet (outside a set) and
   on the set's results, until she opens it: a gold card with the chest drawn in code, a button named "Open today's
   chest". Tap: the opening is logged at once (`chest_opened`), the chest shakes, its lid swings up, the reward rises out,
   a burst of confetti and the `chest` cue (a thunk, a glide up, a shower of high notes). The reward in words takes the
   focus (`role="status"`): "+35 XP" and "Bonus XP: it counts in today's goal."; "An extra rest day for your streak" and
   how many she has saved; "A new colour theme: Ocean" with "Use Ocean now". Under reduced motion the reward shows at once,
   the lid simply up. A day's chest not opened by midnight is "yesterday's chest" the next day (it "waits for you today
   only"), then it is gone. One chest a day.
4. **The reward**, drawn from the chest's day (a hash) and what she has when she opens it (`store/chest.ts`):

   | Roll (0-99, from the day) | Reward | When it cannot be that |
   |---|---|---|
   | 0-7 (about one chest in twelve) | a colour theme she does not own yet (which one: another hash of the day) | she owns all three: bonus XP |
   | 8-27 (about one in five) | an extra rest day, banked the day she opens it | she holds `MAX_REST_DAYS` (2), has never met her goal, or a chest gave one this week (Monday to Sunday): bonus XP |
   | 28-99 | bonus XP: 15, 20, ... 50 (a third hash of the day) | |

   Bonus XP counts on the day she opens the chest, in that day's XP, the goal and the streak, like any XP. The rest day is
   banked in the streak walk on the day she opens it, never past the cap, and used by itself for a missed day like the
   weekly one. A theme is hers from then on.
5. **Themes.** Three to earn beside the default navy, each five values for the navy family of tokens in `src/index.css`
   (`--color-navy`, `-600`, the new `-800` for the chunky buttons' and path stops' darker edge, `-100`, `-50`), set on
   `<html>` at runtime (`components/quests/theme.ts`, mounted in the app shell). Coral, gold, ok and bad never change.
   Settings, Rewards: "Colour theme", a radio group of Navy and the themes she owns, each with a swatch, and how many are
   left to find. Rewards off, or a theme she does not own (a reset, a replaced backup): navy.

   | Theme | navy / -600 / -800 / -100 / -50 | on white | -600 | -800 | on -100 | on -50 | text at 90 / 80 / 70 / 60 % on white |
   |---|---|---|---|---|---|---|---|
   | Navy (default) | #2F3C7E / #26316a / #1b2353 / #e6e8f3 / #f3f4f9 | 10.15 | 12.14 | 14.87 | 8.32 | 9.24 | 7.59 / 5.73 / 4.35 / 3.37 |
   | Ocean | #07425A / #053647 / #032530 / #DCEBF0 / #EEF6F8 | 10.85 | 12.92 | 16.02 | 8.88 | 9.90 | 8.16 / 6.10 / 4.60 / 3.52 |
   | Plum | #58286F / #48205C / #2F143D / #EEE4F3 / #F7F2F9 | 10.78 | 12.83 | 16.30 | 8.74 | 9.77 | 8.19 / 6.12 / 4.60 / 3.53 |
   | Cocoa | #553627 / #462C20 / #2D1C14 / #F1E7E1 / #F9F4F1 | 10.81 | 12.79 | 16.31 | 8.88 | 9.90 | 8.04 / 5.99 / 4.51 / 3.46 |

   Tested for every theme (`src/store/themes.test.ts`): the primary, -600 and -800 at least 4.5:1 on white (text, and
   white text on the filled buttons); the primary at least 4.5:1 on -50 and -100; navy text at 90 % and 80 % at least
   4.5:1 on white and on -50; the marks that carry meaning at least 3:1 (a ring's fill on its -100 track; the 60 % mended
   day's dot and skipped problem's ring on white, and white on that dot); never worse than navy at any text opacity the app
   uses (100 to 40 %); the tints as light as navy's. Navy's values are read from the stylesheet itself.
6. **Store app and family app.** Quests and chests follow the rewards switch: on by default in the store app, off by
   default in the family app (no quests, no chest, no theme picker, navy). The end-of-set ad keeps its place (before the
   set's results, `session/breaks.ts`, untouched): the set's end is logged in the break's `go`, with the results, and inside
   a set the finish sheet never shows the chest ("Your chest is ready: open it on your set's results."), so an ad never
   covers a chest she is opening and never comes between her tap and its reward.
7. **Accessibility.** Text first: each quest's words and "6 of 8" (", done" for a screen reader), the bars and the chest
   art `aria-hidden`; the chest is a native button named "Open today's chest" (or yesterday's), described by its line, at
   least 64 px tall; "Use Ocean now" and the theme options at least 44 px; the reward's words take the focus after the tap;
   reduced motion: no wiggle, shake, lid swing, rise, pop or bar sweep.

## Design decisions for review

1. **The day's quests are judged by her log when the day began** (events before local midnight, the rewards slice, the
   goal, Home's class and unit). What she does during the day never changes them, so a squash quest does not vanish when
   she squashes the monster. Changing the goal mid-day resizes them (and can re-pick: "A perfect set" is not offered at a
   goal of 30, and a goal of 30 asks a squash only of a nearly squashed card); a merge import of older events can re-pick
   too. Both are rare and give nothing she has not earned.
2. **Her class for the quests is the class of her latest problem before the day**, else Home's choice, else the first:
   stable all day. A student switching Home's tab does not change the path quest; it names its stop ("Practice the next
   stop on your path" / "Linear inequality"), which counts in any class.
3. **Lines or parts.** "Get N lines right first try" would be impossible for a geometry or chemistry student (parts flows
   have no lines), so the quest counts both, in the rewards' own words ("lines or parts right first try"). A card picked
   right on the first pick (Guided mode) counts as one: it pays +4 there and "counts less" only in XP.
4. **"Earn N XP" equals the goal** (the brief's example "Earn 60 XP"), and leaves a chest's bonus out, so yesterday's chest
   opened this morning cannot finish today's quest.
5. **Sets need a new event.** The set's grouping lived only on the device (`pct.set`); "Finish a set with no hints" and "A
   perfect set" must be read from the log, so the set runner logs `set_done` (set id, the finished attempts, the number
   skipped) once, inside the break's `go`, with the results. A set with a skipped problem counts for neither set quest.
   "No hints" means no `hint` event at all (rung 3 included); "perfect" is the results' own "Right first time" on every
   problem (`isFirstTryRight`: finished right, every line first try, nothing shown, no line picked).
6. **The homework quest's day** is fixed by the ISO week's hash, one of Monday to Thursday (homework nights), and always one
   of the three on that day when her class takes her own problem (precalculus; not geometry or chemistry). "At most once a
   week" holds strictly; if she skips the app that day, she does not see it that week.
7. **The squash quest at a goal of 30** (about one problem) only comes when a monster is at most two clean problems from
   squashed; at 60 and 100 any open card she can practise.
8. **The quest cue plays from the screen that says "Quest done"** (the finish sheet, the wide completion card, the set's
   results), once per problem or set, after their own sound, not from the event-log juice (`useJuice`). Playing it there
   keeps the juice's moments as they were (their tests list exact cues, and a day's three quests depend on the date). A
   quest finished by a line in the middle of a problem gets its cue at the finish.
9. **The chest's sound is the juice's**: `chest_opened` is its moment's main cue (`cues.ts`), so a bonus that meets the
   goal sparkles after it.
10. **Bonus XP counts on the day she opens the chest**, not the chest's day: yesterday's chest opened today adds to today
    (yesterday is settled). Its award has no problem type (`XpAward.skill` is '').
11. **The draw uses what she has when she opens it** (owned themes, rest days held, a rest day this week), with the chest's
    day as the seed. Before the tap nothing is shown, so a reload never rerolls anything she saw; after the tap the event
    holds the reward. A theme slot when she owns them all, or a rest slot when one is not allowed, is bonus XP (the rest
    share does not grow).
12. **A rest day needs a streak bank that has begun** (she met her goal at least once): the streak walk starts on her first
    met day, so a rest day banked before it would be lost.
13. **Chest events are kept forever by the compaction** (a rest day is part of every streak walk after it, a theme is hers
    for good); they pay XP only while live (after `foldedThrough`), as any event. Only the first opening of a day counts
    (two devices merged); a hand-edited reward outside the table is ignored.
14. **Themes avoid green, red and gold**: a green "Forest" (the brief's example) would read like the right colour (ok
    green) on the rings, the path's faces and every Check button. The three are Ocean (deep teal-blue), Plum and Cocoa,
    each darker than navy so their text passes everything navy passes, and more (their 70 % text is 4.5:1 or better).
15. **The theme setting goes with a replace import** (like the daily goal, unlike the device switches); it applies only
    where the log says she owns it. A merge keeps this device's.
16. **The chest is a gold card, not a filled navy button**: Home's one primary action stays "Start a set".

## Log

- 2026-10-22: read CLAUDE.md, BUILD_GUIDE (§0, §7), the roadmap, phone-rewards, phone-juice, phone-session, phone-path,
  phone-monsters and own-problem; the store (types, index, rewards, selectors, compaction, backup, storage, milestones,
  catches, time), the rewards components (TodayCard, Finish, Rings, words, haptics), the juice (sounds, cues, useJuice,
  motion, Confetti, channel), Home, Settings, the session (buildSet, activeSet, summary, breaks), the set page and its
  results, the path's model, ProblemFrame's completion, index.css and the tests around them.
- Store first: the two events (`set_done`, `chest_opened`), `ThemeId` and `Settings.theme`, `store/themes.ts`,
  `store/chest.ts` (the draw, the openings, owned themes, rest days), the `chest` award and the rest days in the streak
  walk (`rewards.ts`), the compaction's keep, the settings' normalizing, the actions `noteSetDone` and `openChest`. The
  typecheck pointed at four places that read every event as having a skill or an attempt (`Home` `eventCourseId`,
  `combo.ts`, `useJuice` `lastAttemptId`, the compaction's fold): each now asks first.
- Themes: computed contrast for candidate colours with a scratch script (deleted); Ocean was first lighter than navy and
  went darker until every opacity passed at least as navy does.
- The pure quest model (`session/quests.ts`) and its tests, then the screens (`components/quests`), the Today card, the
  finish sheet, the set page and its results, Settings, the app shell, the CSS (token, edges, the quest and chest motion,
  the reduced-motion block), the two cues.
- Fixed on the way: a theme slot with every theme owned fell through to a rest day (now XP, as documented); a streak
  scenario in a test read Friday as still "today"; a perfect-set fixture had two finishes for one attempt; the quests
  heading's accessible name had a stray space ("Quests : 1 of 3 done").

## Not done

- No device or browser testing (by instruction): the chest's look, wiggle, shake and lid, the confetti, the cues' sound on
  a phone speaker, the quests row's height on a small phone and the themes on real screens are covered by jsdom tests and
  reasoning only. Worth a look on the emulator: the chest card on the finish sheet above the rings, the Today card's
  height with the quests row, each theme on Home, a problem, the keypad and the Monsters tab.
- The graphs, the number line and the grapher draw with the palette constants (`PALETTE` in `src/shared/types.ts`, owned by
  another builder now) and stay navy under a theme; the monsters' art and the confetti keep their own colours.
- Quests are text, not links: "Practice the next stop" and "Check a problem from your homework" do not open the problem
  or the builder from the Today card (the path and the module page do).
- The tab bar and the wide header keep their white backgrounds; only the navy family changes.
- Seen and left: navy's own `text-navy/70` (104 places) is 4.35:1 on white, just under 4.5:1; the themes are at 4.5 or
  better there.

## Verification (2026-10-22)

- `npm run typecheck`: clean (app, node and server configs).
- New tests, 52: `store/chest.test.ts` (6: the draw is deterministic and in its table over ten years of days, a theme only
  one she lacks, a rest day only where allowed, first opening per day, owned themes, rest days by opening day, once a
  week), `store/themes.test.ts` (5: navy's values are the stylesheet's; every theme's contrast), `store/chestStore.test.ts`
  (11: `openChest` logs the day's draw once, today or yesterday only, the same reward from the same state; `noteSetDone`
  once; bonus XP in the day's XP, the goal and the settled day; a duplicate opening pays once; the chest's rest day keeps a
  streak across two missed days, never past the cap, not while she holds the most, never before a first met day, once a
  week; backup replace and merge, the store's own export, import and compaction; the theme setting through imports),
  `session/quests.test.ts` (16: a year of days in three states and three goals, three quests from three groups, sized to
  the goal, the same every time, a squash only with a monster on the loose, every kind seen; what she does during the day
  never changes them; the homework quest once a week on Monday to Thursday, never in geometry; a goal of 30's squash rule;
  her class from her log; progress for every kind from seeded logs, her own problems and undone, fixed, shown and picked
  lines included; two of three is no chest; one chest a day, yesterday's for one day; what a problem moved),
  `components/quests/Quests.test.tsx` (11, jsdom: the quests row, ticks and the chest on Home; rewards off, the family
  default; opening with motion, its cue and focus, and under reduced motion; yesterday's chest; a theme from the chest
  applied; Settings' themes and the root tokens; "Quest done" on the finish sheet with its cue after the arpeggio; a set with
  a registered break: the break before the results, the set's end logged after it, no chest on the set's finish sheets, the
  chest opened on the results; a chest earned mid-set waits; the quest news standing still), `StoreQuests.test.tsx` (1: the
  store app shows the quests and the themes by default), `questCues.test.ts` (2). The long sweeps have 600000 ms timeouts,
  the page tests 120000 ms. Tests that need a day with a given quest find one and fake the date (`Date` only).
- No existing test changed. Before the full run, the existing tests around the rewards, Home, the set page, the juice, the
  squash, the store and the session passed with the changes (30 files, 289 tests).
- Whole suite, `vitest run --maxWorkers=3`, once at the end: 356 files, 6135 tests: 6132 passed, 3 failed, all three
  timeouts in other builders' content sweeps (`content/modules/explog.crosscheck.test.ts` at its 240000 ms limit,
  `trig/trig2.review.test.ts` and `trig/trig5.test.ts` at 120000 ms) in a run that took 3941 s, about twice the usual,
  with another builder's tests running beside it. Those three files run again alone: 3 files, 29 tests, all pass (126 s).
  `src/content` is not this build's to change; their limits may want raising (the brief's own note about busy suites).
- `vite build --outDir C:\work\quests\.tmp-dist`: passes (the existing chunk-size warning only; main chunk 3,486 kB, the
  set page 10.5 kB). The built CSS has `--color-navy-800`, the chest, lid, reward and quest rules, `transform-box`, the
  reduced-motion block that stops them, and the classes Tailwind had to find (`fill-gold-text/40`, `fill-navy-100`,
  `min-h-16`, `shadow-[0_0_0_1px_var(--color-navy-100)]`, `ml-1.5`, the `color-mix` shadows). The folder was deleted, and
  the scratch contrast script with it.

## Files

New: `src/session/quests.ts` (+ `quests.test.ts`), `src/session/questTesting.ts` (test helpers, not bundled),
`src/store/chest.ts` (+ `chest.test.ts`, `chestStore.test.ts`), `src/store/themes.ts` (+ `themes.test.ts`),
`src/components/quests/{Quests.tsx, Chest.tsx, useQuests.ts, theme.ts}` and their tests (`Quests.test.tsx`,
`StoreQuests.test.tsx`, `questCues.test.ts`), `docs/progress/phone-quests.md`.

Changed: `src/store/types.ts` (the `set_done` and `chest_opened` events, `ChestReward`, `ThemeId`, `Settings.theme`),
`src/store/rewards.ts` (the `chest` award, chest rest days in the streak walk, `StreakView.since`, `chestRestEligible`),
`src/store/compaction.ts` (keeps chest events, never folds an event without a skill), `src/store/backup.ts` (the theme
setting), `src/store/index.ts` (`noteSetDone`, `openChest`, exports), `src/components/juice/{sounds.ts (the quest and
chest cues), cues.ts (the chest is its moment's sound), useJuice.ts (one narrowing)}`, `src/session/combo.ts` (one
narrowing), `src/components/rewards/{TodayCard.tsx (the quests row), Finish.tsx (quest news and the chest)}`,
`src/components/set/SetSummary.tsx` (quest news and the chest), `src/pages/SetPage.tsx` (logs the set's end in the break's
`go`), `src/pages/flows/ProblemFrame.tsx` (tells the finish whether it is in a set), `src/pages/Settings.tsx` (Colour
theme), `src/pages/Home.tsx` (one narrowing), `src/App.tsx` (mounts the theme), `src/index.css` (`--color-navy-800`, the
edges and two shadows follow the theme, the quest and chest motion), `docs/BUILD_GUIDE.md` (§0 UI row, §7).

## Review (Claude, 2026-10-22)

Built by one Claude agent (2 h 3 min). Checked:
- The XP code: a chest's bonus pays on the day she opens it (not into the "Earn XP" quest), only the first opening of a
  day counts (two devices merged), a chest's rest day is banked on the open day and capped at two with the weekly ones,
  and own problems count where their XP counts but never squash.
- On the Android emulator (store build): Home's Today card with "Quests 0/3", three quests with words, "5 of 8" and bars
  (her own problem's lines already counted); after a seeded clean set, "Quests 3/3" with green ticks and the gold "Open
  today's chest" card; tapping it opened the chest to "+15 XP · Bonus XP: it counts in today's goal" and the goal ring
  moved 290 → 305; the Plum theme applied to a module page (titles, text, Start buttons, the tab highlight) reads well.
- Decisions accepted: Cocoa instead of Forest (a green theme would look like the "right" green), the chest as a gold
  card so "Start a set" stays the one primary action, quests fixed from her state at midnight.

Changed in review: the three seeded sweeps that timed out in the builder's busy full suite (explog.crosscheck,
trig2.review, trig5) get 600-second limits, as the Unit 5 review sweep did.

Left as is (noted by the builder): navy's own 70% text (`text-navy/70`) is 4.35:1, just under 4.5, on 104 uses; graphs
and the number line keep their fixed navy palette under a theme.
