# Phone path: the unit as a road she walks

Branch `phone-path`. Uncommitted, for review.

## Why

The owner asked for the "pizzazz kids need (think Duolingo)". The juice (sounds, the combo, floats, confetti, chunky
buttons, the streak flame) shipped last week. The next step of the agreed plan is the path: Home shows the unit as a
road she walks, so she sees where she is and what is next, and finishing a stop feels like moving. Duolingo's lesson
path, adapted: nothing is ever locked (her class's order is not ours to enforce).

## What she gets

Home, for the class and unit selected there, at every screen size (`src/components/path`):

1. **A unit header** above the path: the unit's name ("Unit 3 · Exponential and logarithmic functions"), "N of M types
   solid" (Solid or Mastered), and where she is: "You are here: Rewrite in the other form" with a "Show me" button that
   scrolls to that stop and focuses it. When the next set starts in another unit (her working unit, or a mistake to
   squash there), the header says so instead ("Your next set starts in Unit 1 · Functions and their graphs, with Linear
   inequality.") with "Show that unit", which switches the unit chips to it.
2. **The path**: an ordered list of the unit's problem types (templates) in course order, one stop each, winding over
   five lanes (centre, right, far right, right, centre, left, far left, left) like a road. Pure layout: absolutely placed
   rows of fixed height, the road a light band drawn in inline SVG under each row (and a CSS band through each signpost),
   no canvas, no images. A **signpost** where each module's stretch begins: its title and, where it applies, the
   step-by-step mark (`StepBadge`). Each stop is a round node inside the rewards' ring (`Ring`, the last-five levels and
   counts the app already uses) with its title beside it, on the side away from the edge it leans to:
   - New (none finished): a grey face with an outlined star, the ring empty;
   - Practiced: a navy face with a white star, the ring part-filled (a fifth per problem that went well, a sliver at 0);
   - Solid: a green face with a check, the ring part-filled in green;
   - Mastered: a green face with a check, the ring full.
   The faces have a darker bottom edge like the chunky buttons and press down on tap (not under reduced motion).
3. **You are here**: the stop "Start a set" would start with, taken from the set builder itself (`setStart` calls
   `pickSetTypes` with what Home's button passes it), so the path and the set never disagree. Raised (80 px instead of
   68), a gold "You are here" tag over it, its title in bold, and a gentle gold halo that swells and fades every 2.4 s
   where motion is allowed (none under reduced motion).
4. **A stop's sheet** (a phone: a bottom sheet) or **popover** (wide: under the stop, with a point at it): the module's
   name, the type's title, its ring and its state in words ("Solid: 3 of the last 5 went well"), "You are here: your
   next set starts with this type." on that stop, then "Practice this type" (a fresh problem of that template at its
   default difficulty, as the module page's Start gives) and "About this module" (the module page). Every stop opens;
   no locks, padlocks or greyed-out buttons anywhere.
5. **The end of the road**: the unit review where the unit has one (precalculus Unit 1 today) is a gold trophy that
   opens it ("Unit 1 review"); other units end at a plain finish flag: "Finish line" and "N of M types solid". The review
   card above the path stays as it was.
6. **A level-up celebration**: when a stop's level went up since the path last showed it (New to Practiced, Practiced to
   Solid, Solid to Mastered), the next visit to Home pops that node and sweeps its ring from where it stood to now, once,
   when the node comes into view (Home is long on a phone); never under reduced motion.
7. **Modules in this unit**: under the path, a compact list of links to each module page (rule cards, every type with
   its difficulty, the mastery explanation stay there). The properties drill, which has no problem types and so no
   stretch of road, is in this list with how the drill is going.
8. **Accessibility**: the path is an `<ol>` ("Path through Unit 3"); each stop is a button named "Exponential equations:
   practiced, 2 of 5. In Exponential and logarithmic equations." with "You are here." first on that stop; the ring and
   every icon are decorative (the state is in the name and in words on the sheet); the dialog keeps focus inside (Tab and
   Shift+Tab go round, focus that lands outside comes back), closes with Escape, its close button or a tap outside, and
   gives focus back to the stop; nodes are 68 px (80 raised), every other control at least 44 px; text keeps 4.5:1.

Home keeps its order (title, Today card, Start a set, Resume your set / Pick up where you left off, the class tabs, weak
spots, the unit chips, the review card), then the path, the module list and Sandbox. Empty units ("Coming soon") keep
their "Nothing to practise here yet" line. Every class works (precalculus, geometry, and chemistry in the family app).

## Design decisions (for review)

- **"You are here" is the set's first type, even when that is a mistake card or a review** (the set builder's (a) and
  (b) come before the working unit). The brief says take it from the set builder so the two never disagree; that type
  can be in another unit than the one Home shows, and then no stop on this unit's path is marked: the header names the
  unit and type the set starts with and offers "Show that unit". The other reading (mark this unit's first unit pick)
  would disagree with the set. One line (`hereId` in `UnitPath.tsx`) if wanted.
- **A stop's title is written beside its node.** Duolingo's nodes are bare, but her units are long (Unit 1 has 36
  types) and the types differ; the title (two lines at most, the rest in the name and the sheet) tells her which is which
  without a tap. The state is not repeated there: the face and the ring show it, the name and the sheet say it.
- **"Show me" in the header** scrolls to the "You are here" stop and focuses it. Duolingo scrolls its path to the current
  lesson on open; Home cannot (that would hide the Today card and Start a set), and on a phone the stop can be screens
  down. Not in the brief; one block in the header to drop.
- **The drill has no stop.** The path is the unit's problem types; the properties drill has none, so it is only in the
  module list (and the Drill tab), with its "Drill so far" line that the old module card had.
- **The review card stays above the path**, as it was (its "Continue — problem 3 of 12" and its explanation), and the
  trophy at the end of the path opens the same review. Two ways in; the card is Home behaviour the path does not replace.
- **The trophy is a link, not a button**: it goes to the review, as the card's link does. Its name is "Unit 1 review: one
  mixed set from the whole unit". The finish flag is not interactive.
- **The level-up memory** (`pathMemory.ts`, `pct.path` on this device, not in backups, like the active set): the path
  remembers the ring it last showed for each type. The first time the path is shown on a device it remembers every ring
  as it is, so nothing old celebrates (an existing user, a new phone). A stop is remembered when Home shows it, except one
  that levelled up: that one is remembered when its celebration plays, which waits until the node is 60% on screen
  (IntersectionObserver; where there is none it plays at once). So a level-up she has not scrolled to yet waits for her,
  in any unit, until she sees it. A ring that went down is remembered lower wherever it is (a slip, "Reset progress"),
  so winning the level back celebrates again. Under reduced motion nothing celebrates and the level-up is simply
  remembered (it does not play later either). A level-up brought in by importing a backup also celebrates on the next
  visit; nothing in the import path was changed for it. The memory is read and written only once the store is loaded
  (`hydrated`, always true by the time Home draws), so it is never compared with an empty log.
- **The stop's name** is "<type>: <state>. In <module>." with "You are here. " in front on that stop, the state as the
  rings count it ("new", "practiced, 2 of 5", "solid, 4 of 5", "mastered"; 2 of 5 is how many of the last five went
  well, the number inside the rewards' ring). Geometry's "Congruent triangles" has two types both titled "Corresponding
  parts"; their names differ only by state and their place in the list (content, not changed).
- **Only a level counts**, not a fuller ring inside a level (Practiced 1 of 5 to 2 of 5 is quiet), as the brief says.
- **The celebration is a pop and the ring's sweep**, with the face turning its new colour as it pops. No sound, no
  confetti (the finish sheet and the set's results already celebrate the moment it happened).
- **The halo pulses for as long as Home is open** (2.4 s, transform and opacity only), and not at all under reduced
  motion; the tag and the size still mark the stop then.
- **The sheet's "Practice this type" is a filled, chunky button**: it is the dialog's own main action. Home's surface
  keeps one primary action, "Start a set": the stops, the trophy, "Show me" and the module links are not filled.
- **A phone gets a bottom sheet, a wide screen (tablet up) a popover** under the stop (`useBreakpoint`, read by Home and
  passed down: the path never reads the screen size). Both are modal dialogs that trap focus; a tap outside closes the
  popover (that tap does not reach what is under it). The lanes are 44 px apart on a phone, 64 on a wide screen, where
  the path is centred at most 42 rem wide.
- **The stops come from the set builder's own list** (`classTypes`), kept to the unit, so a type the set can give her is
  always on the path; a module with no problem types has no stretch of road.
- **The old module cards' "Random problem"** (a random type of a module) is gone with the cards; a stop's "Practice this
  type" gives a problem of one type, and the module page's Start of each type is unchanged.

## Log

- 2026-10-21: read CLAUDE.md, BUILD_GUIDE (§0, §7), roadmap, phone-juice.md, phone-rewards.md, phone-session.md; Home,
  the set builder, the selectors and the rewards' rings, TodayCard, Rings, Finish, words, the juice's motion and flame,
  index.css, StepBadge, courses, the module page, the bottom sheet, the set's start and the active set, Welcome, App,
  and every test that renders Home (Home, HomeToday, App, StepGuide, Rewards, StoreEdition, Welcome, SetPage, TabBar,
  Chunky, Juice, AskAnything, attemptResolves).
- Listed every unit's modules and types (a scratch test, deleted): Unit 1 has 36 types in 11 modules plus the drill; one
  module (geoCongruence) has two types titled "Corresponding parts", so their names differ only by state.
- Built the pure layer with its tests first: `pathModel.ts` (the stops from `classTypes`, the state words and names,
  `setStart`, the lanes, the road's curve; 11 tests) and `pathMemory.ts` (what the path last showed, the level-ups and
  what it keeps; 5 tests). Then `StopDialog.tsx`, `UnitPath.tsx`, the CSS (in the reduced-motion block too), and Home.
- The pure model first sat in `unitPath.ts` beside `UnitPath.tsx`: on this case-insensitive disk TypeScript resolved
  `@/components/path/UnitPath` to the `.ts` file. Renamed it `pathModel.ts`.
- Rewrote the tests of the module cards for the path: Home.test.tsx (the module titles and links now come from "Modules
  in this unit", and the signposts are checked against them, the drill on the list only), HomeToday.test.tsx (the
  stops are not filled actions, phone and wide), App.test.tsx (a stop per type of the landing unit, a link per module),
  StepGuide.test.tsx (the step-by-step mark is on exactly the step modules' signposts). New UI tests in
  `UnitPath.test.tsx` (17).
- Fixed on the way: the header and the finish flag both say "N of M types solid", so the test reads the header's own
  line; the stop that is "You are here" carries the prefix in its name, so the state test strips it.

## Not done / left alone

- No device or browser testing (by instruction): how the road, the nodes, the captions beside them, the tag, the halo,
  the pop and the popover look and move is covered by jsdom tests and reasoning only. Worth a look on the emulator and a
  wide browser: the road's bends between rows and through the signposts, captions at the centre lane on a narrow phone
  (about 120 px; long titles are cut at two lines), the halo at the far lanes, the popover under a stop near the bottom.
- No auto-scroll to "You are here" when Home opens (it would hide the Today card and Start a set); "Show me" does it.
- Not changed: how sets are built, mastery, the rewards' XP rules, the module page, the review, the store fork (nothing
  there reads the module cards), content, engines, flows.

## Verification (2026-10-21)

- `npm run typecheck`: clean (app, node and server configs).
- New tests: `components/path/pathModel.test.ts` (11), `pathMemory.test.ts` (5), `UnitPath.test.tsx` (17): 33.
  Rewritten for the path (the module-card checks now read the path and the module list): `pages/Home.test.tsx`,
  `pages/HomeToday.test.tsx`, `App.test.tsx`, `components/StepGuide.test.tsx`. No other test changed.
- Whole suite, `vitest run --maxWorkers=4`, once at the end: 276 files, 4642 tests, all pass (1320 s, with another
  builder's tests running beside it). Afterwards one check in `UnitPath.test.tsx` was made stricter (with no history,
  every unit's "You are here" is exactly its first type, not "at most one"); that file re-run: 17 pass; typecheck clean.
- `vite build --outDir C:/work/path/.tmp-dist`: passes (the existing chunk-size warning only); the built CSS keeps the
  path's face, tag, halo and pop rules, the arbitrary classes (`max-w-[calc(100vw_-_2rem)]`, `w-[14px]`, `z-[1]`,
  `stroke-navy/50`) and the reduced-motion block that stops `.path-pulse` and `.path-levelup` and the press. The folder
  was deleted.

## Files

New: `src/components/path/{pathModel.ts, pathMemory.ts, StopDialog.tsx, UnitPath.tsx}` and their tests
(`pathModel.test.ts`, `pathMemory.test.ts`, `UnitPath.test.tsx`), `docs/progress/phone-path.md`.
Changed: `src/pages/Home.tsx` (the module cards gave way to the path and the module list), `src/index.css` (the path's
faces, tag, halo and pop, in the reduced-motion block too), `src/pages/Home.test.tsx`, `src/pages/HomeToday.test.tsx`,
`src/App.test.tsx`, `src/components/StepGuide.test.tsx`, `docs/BUILD_GUIDE.md` (§0 UI row, §7).
