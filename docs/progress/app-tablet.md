# One responsive app: the phone composer, the tablet layout and the scratch pad

Branch `app-tablet` in `C:\work\quests` (outside OneDrive). Uncommitted, for review.

## Why

The owner asked for "a tablet version with a scratch pad", and decided on ONE responsive app, never a second app. The
phone review had left one problem open: on a phone the composer grew tall (the nudge, the verdict, Stuck?, notes, the tools
row) and with the keypad up her own work was hidden, with a blank band between the composer and the keypad. Every problem
screen was built phone-first; the wide layout was a computer's page.

## What she gets

### 1. The phone composer, with the keypad up

- **Her work stays on screen.** With the keypad open the composer's extras fold to ONE line (36 px): the verdict about her
  line cut to that line (or the idle nudge when there is no verdict), the combo as its flame and count, Why?, Stuck? and a
  ⌄ button. A tap on the line or on ⌄ unfolds everything (the whole verdict with the caught monster's banner, the nudge
  with Dismiss, the combo pill, the tools row Hints / Graph / Calc / Rules / Scratch, a flow's notes); ⌃ folds it again,
  and so do her next Check and the keypad going down or coming back. Focus stays in her box throughout (the keypad does not
  close). A first catch shows its monster small, flipping in, in a gold ring before the title; the banner shows unfolded.
- **No blank band.** The composer sits right on the keypad: the problem column fills the screen down to the keypad and the
  composer is pushed to its end (even when her work is short), the shell drops the page's bottom padding while a docked
  composer is up, and while the keypad is up the page keeps no safe-area band under it (the keypad pads itself).
- **After a Check** the keypad brings her newest line of work right above the composer (4 px between them), not the page's
  end: so the screen shows the problem strip at the top, her last lines, the folded line and the box she writes in. The
  work-list card under her line (the full lesson) waits behind the composer; the folded line names the mistake and Why?
  opens the lesson.
- Measured with the layout's own numbers (the keypad's from index.css, the rest from the classes on the page; jsdom has no
  layout): the keypad is 311 px at 375 x 812 and 302 px at 360 x 640, the strip 45, the folded composer 151, two lines of
  work at most 132 (a fraction in each, Undo on the last). Left over: 169 px at 375 x 812 (about two and a half more lines),
  6 px at 360 x 640.

### 2. The tablet layout (840 px wide and more)

The layout follows the window, never the device or its user agent (`components/useBreakpoint.ts`):

| Window | Layout |
|---|---|
| below 600 px (a phone) | the phone layout |
| 600 to 839 px (a tablet upright, a phone on its side) | the phone layout with a wider reading column: at most 42rem, still one column |
| 840 px and more, 480 px tall or more (a tablet on its side, a large tablet, a computer) | the tablet layout |
| under 480 px tall, however wide (a big phone on its side, 932 x 430) | the phone layout |

- **The navigation rail** (`components/NavRail.tsx`) down the left on every screen instead of the bottom tabs (and of the
  old top navigation): Home, Monsters, Graph, Progress, Settings in the tab bar's order, then Ask (tutor configured) and the
  Sandbox (family app), each an icon in a pill and a label, at least 56 px tall, the current one marked (aria-current, the
  pill filled, the label bold; Home for a class or a module page, as the tab bar marks it). The app's mark on top goes Home.
  Narrower windows keep the tab bar.
- **The problem screen in two panes** that fill the window and scroll on their own (`components/PageLayout.tsx`):
  - left: the problem's header (module, title, instructions, the gold card with its figure or graph, the progress line),
    then its tools stacked as before on a computer (Hints, Graph it, Calculator, Rule cards, Ask), with a "Tools | Scratch
    pad" switch for the scratch pad;
  - right: her work (lines, parts, answers, the completion card), the composer under it (a block, not sticky), and the
    keypad docked at the bottom of the pane, not across the screen. The work follows her newest line when it grows (and
    when the keypad docks and the pane gets shorter), unless she scrolled up to read. A parts flow's box scrolls into view
    inside the pane above the keypad.
  - The flows are the same components: only the frame places them. No phone pieces here (no compact header, no pinned
    strip, no Stuck?: the hints are beside the problem).
- **Sheets are centred dialogs**: every `BottomSheet` the tablet layout opens (the leave question, the shortcuts, Settings'
  reset, the grapher's row options, the set's skip menu; the phone's own sheets, the hints, Why? and the problem, do not
  open there). **The finish sheet opens in the tablet layout too**, as a dialog (with rewards on), where the rewards used to
  sit inside the completion card; closing it leaves the small card with "See what you earned".
- **Menu pages at a comfortable width, cards in two columns** (`components/CardColumns.tsx`): Home in two columns (today's
  part: the title, the Today card, Start a set, Resume; beside it the class's part: classes, units, the path, the modules),
  the module page's problem types, the Monsters' species (their tiles as many a row as the card has room for), Progress's
  Habits and Drill cards, and the Settings sections (two columns read top to bottom, the page 64rem wide). Each page keeps
  its max width (Home 72rem in two columns, the module page 56rem, Monsters and Progress 64rem). One column in the phone
  layout.

### 3. The scratch pad

- A drawing surface for a finger or a stylus (`components/scratch`): pens in three inks (navy, red, green), a highlighter
  (under the ink), an eraser (takes ink off, never the grid), undo and redo, Clear (asks first: "Clear the scratch pad?
  Everything on it goes." with Clear it / Keep it; undo brings it back while the pad is open), and graph paper that can be
  turned off (on by default, remembered on the device). "For your own working. Nothing on the pad is read or checked."
- **One pad per problem attempt**, kept on the device: the strokes as compact vectors (whole numbers in pad units, the pad
  1000 units wide whatever its size; about three characters a point) in localStorage, `pct.scratch.<attempt id>`, with an
  index in `pct.scratch`. All pads together stay under 400,000 characters and 40 pads: saving drops the pads that changed
  longest ago first, never the one being saved. Never in backups. A reload or Back and return brings it back (Back keeps the
  undo history too).
- **Palm rejection by pointer type**: before a stylus a finger draws; once a stylus has drawn on the pad (or while it is
  down) touches do not, and a palm's stroke that started before the stylus came down is wiped. **Pressure** thickens the
  pen where the stylus reports it (half the width at the lightest touch, about 1.6 times at the hardest); a finger draws an
  even line.
- **Where it opens**: a phone, a sheet from the tools row ("Scratch", in the composer's tools or under the problem), which
  keeps what she drew when it closes; a tablet, the left pane's second view, under the problem card (the figure stays in
  view), never over her work or the line she writes.
- **Keyboard and screen readers**: every tool is a button with a name (Pen, navy; Pen, red; Pen, green; Highlighter;
  Eraser; Undo; Redo; Clear the pad; Graph paper) in a toolbar named "Scratch pad tools", pressed state on the tools and
  graph paper; the canvas is an image named "Scratch pad: a drawing area for your own working. The app does not read or
  check what you draw here."; the clear question is an alert dialog with focus on Keep it.

## Design decisions (for review)

- **The tablet layout starts at 840 px wide AND 480 px tall.** The brief puts phones on their side in 600-839; a big phone
  on its side is 915-932 px wide but only about 430 tall, where two panes over a docked keypad leave her work about 70 px.
  One query to change (`TABLET_LAYOUT_MIN_HEIGHT`).
- **Computers get the rail**, not the old top navigation (the brief's tablet layout includes computers), and the rail is on
  every screen in that layout, the problem screen too (the old wide layout kept its navigation everywhere). The rail has the
  top navigation's extras after the five (Ask, Sandbox). The brand link is the app's mark at the top of the rail.
- **The finish sheet in the tablet layout**: the brief lists it among the sheets to centre, so it now opens there too, and
  the completion card no longer carries the rewards inline on a wide screen (one test moved, below).
- **The left pane stacks the tools under the problem** (as the computer's side panels did) rather than tabbing them, so a
  hint and the figure are read together; the scratch pad is the pane's second view ("Tools | Scratch pad"), under the
  problem card, so the figure stays above it. Asking for a tool (a shortcut) brings the tools back.
- **The tools row folds with the extras** on a phone with the keypad up: at 360 x 640 it does not fit beside two lines of
  work. Stuck? stays on the folded line; Hints, Graph, Calc, Rules and Scratch are one tap away (⌄).
- **A note in a flow folds too** where it is a note (`ComposerExtra`: guided mode's "You saw the cards..." line and its
  "Back to the cards"); "Your last line is in the answer box" with its Check my answer stays (it is the next action).
- **After a Check, her newest line, not the page's end**, sits above the composer: the brief wants her last two lines on
  screen, and the page's end is the full lesson card.
- **The composer's column fills the screen** on a phone, so a short problem's composer sits on the keypad too; the blank is
  then between her work and the composer, never under the composer.
- **The eraser is a stroke** (destination-out), so undo, redo and clear are one history and the grid (a CSS background)
  never erases. Line widths are CSS px whatever the pad's size; positions scale with the pad's width.
- **Stylus mode lasts while the pad is open**: reopening it (or a reload) starts with fingers drawing again, so a borrowed
  stylus never locks her out.
- **The undo history is per page session** (a reload keeps the strokes, not the history).
- **Container queries** where a box should follow its column, not the window: the even/odd flow's two columns side by
  side from 36rem of room (a computer's work pane, not a tablet's), the Monsters' tiles per row. A class change in
  `EvenOddFlow.tsx`, nothing else in the flow.
- **The grapher's wide layout** now starts at the same window (`tab:` in index.css, a custom variant matching the layout's
  query), so it changes with the rail, not at 768.
- **jsdom without matchMedia is the tablet layout** (it was the "desktop" wide layout): every existing wide-screen test now
  runs in it, and passed with two exceptions, whose layout moved.

## Log

- 2026-10-22: read CLAUDE.md, BUILD_GUIDE (§0, §7), the roadmap, phone-screen, phone-keypad, phone-session, phone-guided,
  phone-path and app-grapher; App, appChrome, TabBar, navItems, PhoneHeader, ProblemFrame, PinnedProblem, PageLayout,
  Composer, ComposerVerdict, Stuck, BottomSheet, MathKeypad, keypadStore, keypadDom, useMathKeypad, WorkedColumn, Home,
  Module, Monsters, Progress, Settings, Grapher's layout, Review's running set, the finish sheet, and every test that
  mocks matchMedia or checks the wide layout.
- Found the blank band: the phone problem screen kept the page's 96 px bottom padding under the sticky composer, and the
  root's safe-area band under that; scrolled to its end, the composer sat that far above the keypad. A short page left
  the composer above a blank band too.
- Built the layer first: `useLayout()` (840 px, 480 tall), `layoutTesting.ts` (a window size that media queries follow,
  with live resizes), the rail, the shell, the keypad's dock and its pane-aware reveal, the composer's fold, the frame on
  the new `PageLayout` (phone column / tablet panes), sheets as dialogs, `CardColumns` and the menu pages, then the scratch
  pad (ink, storage, drawing, the component).
- First runs: the existing problem-screen, keypad and verdict tests (39) passed unchanged; the UI folders (104 files,
  1039 tests) had the two expected failures (below), both updated. New tests passed on their first run except one rounding
  in my own test (the store keeps the keypad's height in whole pixels).
- Tightened the folded composer for 360 x 640 (the line's margin 8 to 6 px, its top padding 8 to 4 px, 4 px between her
  last line and the composer): 2 px left became 6.
- The UI folders again after the menu pages, the notes' fold and the follow-the-end pane: 111 files, 1112 tests, all pass.
  Then the whole suite once (below).

## Not done

- No device or browser check (by instruction: no dev server, no browser). The fit at 360 x 640 is measured with the
  layout's numbers and a line of inline math up to 40 px tall; see "Check on a device".
- The scratch pad does not zoom or pan, has no shapes, text or ruler, and pads are not listed anywhere once their problem
  is finished (each attempt has its own; the cap drops old ones).
- The tablet layout's left pane has no width handle (the panes are 9 : 11).
- The store app's fork (src/ads, the native back button) was not touched: nothing here reads the edition except the
  rail's app name, as the old header did.
- Tablet-only gestures (two-finger undo on the pad, a stylus's barrel button for the eraser) are not wired.

## Verification

- `npm run typecheck`: clean (app, node and server configs).
- New tests: `components/NavRail.test.tsx` (11: the rail at 1280 x 800 and 1024 x 768 with the five in order and the
  current one marked, exactly 840 vs 839 px, a module page and a class marking Home, the rail on a problem screen, a
  phone's user agent at 1280, the tab bar at 800 x 1280 and 375 x 812, the wider reading column, 932 x 430, turning a
  tablet upright and back), `pages/flows/TabletLayout.test.tsx` (15: the two panes at both tablet sizes on a line problem,
  a parts problem, a geometry problem and a graph problem with the keypad docked in the right pane; the phone layout at
  800 x 1280 and 375 x 812; the leave question as a dialog or a sheet at all four sizes; the finish sheet as a dialog),
  `pages/flows/PhoneComposer.test.tsx` (4: at 375 x 812 and 360 x 640 the fold, the fit with the layout's numbers, no gap,
  and the newest line above the composer after a Check), `pages/MenuLayout.test.tsx` (20: Home, the module page, Monsters,
  Progress and Settings at the four sizes), `components/scratch/ink.test.ts` (7), `scratchStorage.test.ts` (6: per attempt,
  broken data, the cap dropping the oldest, the pad count, graph paper, never in a backup), `ScratchPad.test.tsx` (10: the
  named tools, drawing and undo/redo, clear with its question, graph paper, palm rejection twice, pressure, one pad per
  attempt and a reload; the phone's sheet and the tablet's pane with Back and return and a reload).
- Tests changed because the layout they check moved: `components/TabBar.test.tsx` ("a wide screen keeps today's top
  navigation" is now "the tablet layout has the navigation rail": the same links in the rail, with icons) and
  `components/rewards/Rewards.test.tsx` ("a wide screen ... inside the completion card" is now "the tablet layout ...: the
  same finish sheet, as a centred dialog; closing it leaves the small card"). No other test changed.
- Whole suite, `vitest run --maxWorkers=3`, once at the end: **363 files, 6208 tests, all pass** (1599 s).
- `vite build --outDir C:\work\quests\.tmp-dist`: passes (the existing chunk-size warning only). The built CSS has the rail,
  the docked keypad, `html[data-keypad-open] #root`, the phone problem column, the scratch surface and graph paper, the
  `tab` variant's query (`(min-width:840px) and (min-height:480px)`), the container queries (28rem, 36rem, 42rem) and the
  arbitrary classes (`grid-cols-[minmax(0,9fr)_minmax(0,11fr)]`, `max-h-[min(85dvh,48rem)]`, `h-[52dvh]`, `columns-2`...).
  The folder was deleted.
- After the whole-suite run, one small change: after "Clear it" the focus goes to Undo (Clear is off on an empty pad), with
  its check in `ScratchPad.test.tsx`; the scratch folder re-run (3 files, 23 tests) passes and the typecheck is clean.

## Check on a device

On the Android emulator (phone) and a tablet emulator or a wide browser window:

1. A phone at 360 x 640 (the smallest) and 375 x 812, an exponential equation line by line, two lines kept, the keypad
   up: the gold strip at the top, both lines fully visible above the composer, the folded line (36 px) and the box right on
   the keypad, nothing blank between the composer and the keypad. Then a wrong line: the folded line names it, Why? opens
   the lesson, the line she writes and her two lines stay put. A line with a fraction (x = ln(13)/ln(3)) is the tallest.
2. The ⌄ on the folded line: the tools row, the whole verdict and the nudge come back; the keypad stays up; the next Check
   folds it again. A first-time mistake: the monster small on the folded line, the banner when unfolded.
3. A short problem (just the start line): the composer still sits on the keypad (the blank is above it). With the gesture
   navigation bar: no white band under the keypad or between it and the composer.
4. A tablet on its side (or a 1024 x 768 browser window): the rail on every screen, the problem in two panes, each
   scrolling on its own; the keypad docked under her work in the right pane, the left pane untouched; the work keeps her
   newest line in view when the keypad opens and after each Check.
5. The same tablet upright (800 x 1280): the phone layout in a 42rem column, the tab bar, the keypad across the bottom.
   Rotating back and forth on a problem keeps her work.
6. The finish sheet, the hints, Why? and the leave question as centred dialogs on the tablet; bottom sheets on the phone.
7. Home, the module page, Monsters, Progress and Settings on the tablet: two columns, nothing stretched; the path's popover
   in Home's right column.
8. The scratch pad with a stylus (an Android tablet with a pen, an iPad with a Pencil in Safari): the hand resting on the
   screen draws nothing once the pen has touched; pressure thickens the line; the eraser leaves the grid; Clear asks first;
   a reload brings the drawing back. With a finger on a phone: Scratch from the tools row opens the sheet, drawing does not
   scroll the sheet, closing and opening keeps the drawing.
9. iPad Safari with the keyboard instead of the keypad (abc): the panes shrink with the visual viewport and the 123 bar
   stays over the keyboard.

## Files

New: `src/components/{NavRail.tsx (+ NavRail.test.tsx), CardColumns.tsx, layoutTesting.ts}`,
`src/components/scratch/{ink.ts (+ test), scratchStorage.ts (+ test), draw.ts, ScratchPad.tsx (+ test)}`,
`src/pages/flows/{TabletLayout.test.tsx, PhoneComposer.test.tsx}`, `src/pages/MenuLayout.test.tsx`, this log.

Changed: `src/App.tsx` (the rail instead of the top navigation; the main column by layout; no bottom padding under a docked
composer), `src/index.css` (the `tab` variant, the rail, the docked keypad, `--rail-w`, no root band under the open keypad,
the phone problem column, the scratch pad's surface and graph paper), `src/components/{useBreakpoint.ts (840 px and 480 tall,
useLayout), appChrome.ts (useDockedComposer), navItems.tsx (railOf), PageLayout.tsx (rewritten: the phone column and the
tablet panes), Composer.tsx (the fold, ComposerExtra), ComposerVerdict.tsx (the folded line), BottomSheet.tsx (dialog in the
tablet layout), MathKeypad.tsx (the dock, data-keypad-open), keypadStore.ts (dock), keypadDom.ts (pane-aware reveal, the
newest line above the composer), WorkedColumn.tsx (data-work-line), monsters/MonsterTag.tsx (CaughtBadge)}`,
`src/pages/flows/{ProblemFrame.tsx (on the new PageLayout; the finish sheet in both layouts; the scratch pad),
PinnedProblem.tsx (the strip's column), LogLineFlow.tsx (two notes fold), EvenOddFlow.tsx (a container query)}`,
`src/pages/{Home.tsx (two columns), Module.tsx, Monsters.tsx, Progress.tsx, Settings.tsx (CardColumns), Grapher.tsx (tab:
for md:)}`, `docs/BUILD_GUIDE.md` (§0 UI row, §7). Tests changed on purpose: `src/components/TabBar.test.tsx`,
`src/components/rewards/Rewards.test.tsx`.

Untouched: content, engines, grading, the rewards', quests' and monsters' rules, `src/session/breaks.ts`, deploy, server.

## Review (Claude, 2026-10-22)

Built by one Claude agent (1 h 37 min, 214 tool calls). Checked on the Android emulator in a store build, at the phone's
own size (411 x 914), at 360 x 640 (wm size 945x1680) and as a tablet (wm size 2560x1600, density 320: 1280 x 800):
- Phone, an exponential equation with the keypad up: after the keypad's Check, the pinned problem strip, the start line
  and her three lines show above the composer; the extras fold to one line ("✓ Kept · Stuck? ⌃", a wrong line's title
  cut to fit with Why?); the box sits on the keypad with no blank band.
- 360 x 640: the strip and her newest line show (a long line wraps to three rows there, so only one line fits with the
  empty preview box); acceptable on the smallest phones.
- Tablet: the rail on every screen; the problem in two panes (problem, tools and rule cards left; her work, the answer
  box and the composer right), the keypad docked under her work in the right pane with her lines in view; the scratch
  pad as the left pane's second view (graph paper, three pens, highlighter, eraser, undo, redo, clear), saved per attempt
  and back after a reload; Home in two columns with the store app's test banner at the bottom and room under it.
- The store fork merged with conflicts in App.tsx, BottomSheet.tsx, index.css and Settings.tsx (its ad banner room and
  "Privacy and ads"); resolved there, keeping the banner room on sheets, dialogs and toasts.

Changed in review:
- The phone composer now brings her newest lines above it when the keypad OPENS too, not only after a Check: a problem
  resumed at the top of the page (or the keypad closed and opened again) left her lines hidden behind the composer
  (keypadDom.ts; a PhoneComposer test that fails without it).
- Home's mistake cards went two-across by the screen's width and, in the tablet layout's 22rem Today column, wrapped
  their titles one letter a line: the list now goes two-across by a container query (@xl).

Seen once and not reproduced: the very first stroke on a fresh pad drew a dot; every stroke after, and the first after
reopening the pad, drew in full.
