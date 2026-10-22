# The grapher: a Graph tab like Desmos, and "Graph it" from a problem

Branch `app-grapher` in `C:\work\grapher` (outside OneDrive). Uncommitted, for review.

## Why

The owner asked for "a generic graphing system like Desmos". Her homework this week was optimization (graph
A(x) = 500x − 2x² and find its maximum, on the TI-84 or by the vertex), and the class graphs constantly. A grapher in the
app lets her see any function she is working with, on the phone or a computer, without leaving the app.

## What she gets

1. **A Graph tab** (`/graph`, `pages/Grapher.tsx`, lazy). The tab bar is Home, Monsters, Graph, Progress, Settings on
   every screen, both editions; the wide top navigation shows the same five, then Ask and the Sandbox as before. The Graph
   icon is crossed axes with a parabola (Progress keeps its L-shaped axes with bars). At 360 px each tab is about 70 px
   wide and the longest labels (Monsters, Progress, Settings: 8 letters at 12 px) are about 55 px.
2. **An expression list.** Each row: its colour swatch with the row number (a button that shows or hides the row,
   `aria-pressed`), a KaTeX preview, the box, an inline error that says what it cannot read (with the character, as the
   problem boxes do), and an options button (colour, show or hide, move up, move down, show its table, delete row, in the
   app's bottom sheet). Enter, or the keypad's key (it reads **Next** here instead of Check), goes to a new row below;
   Backspace in an empty row removes it; ↑ and ↓ move between rows. "+ Add a row" at the end.
   On a touch screen the rows use the app's math keypad with a graphing key set (`KEYPAD_SETS.graph`): x in the grid's
   first cell, then y, a, b, h, k and e, then √, |x|, sin, cos, tan, ln, log, π, <, ≤, >, ≥, braces and f(x); the grid
   has ^, =, x², the digits and the operations.
   Rows it reads (each side through the app's own parser, so a row means exactly what the same text means in a problem):
   `y = 2x + 1`, `2x + 1 = y` or a bare expression in x (a curve); `f(x) = x^2` (her function, graphed, and usable in
   any other row: `g(x) = f(x - 2)`, `y = 2f(x)`, `f(g(x))`; a capital is kept: `A(x) = 500x - 2x^2`); `x = 3` (a
   vertical line); `(3, 4)` or `(1, 2), (3, 4)` (points); `y < x^2`, `y >= 2x - 1`, `x^2 > y` (shading, the edge dashed
   for < and >); `x <= 2` (shading beside a vertical line); `2x + 3y = 6`, `2x - 3y < 6`, `xy = 1` (y in it once,
   solved for y); `a = 2` (a value for a letter, with its slider under the row); and a restriction at the end of a row,
   `y = x^2 {x > 0}`, `y = 6 {1 <= x < 3}`, `y = |x| {x = 5}` (open or filled dots at its ends).
3. **The plane** (a canvas): a light grid with finer lines between the ticks, the axes, nice tick labels (1, 2 or 5
   times a power of ten, as many decimals as the step needs, scientific for very large or small, pinned to the edge when
   an axis is out of view, with a white halo over the curves). Curves are sampled adaptively (below). Drag to pan; pinch
   with two fingers, the wheel or a trackpad's pinch to zoom about the fingers; + and − zoom by two about the centre;
   "Zoom to fit"; the house goes back to the standard window (the TI-84's ZStandard, −10 to 10). Zooms glide in a fifth
   of a second, and jump under reduced motion. The window, the plane's size and the zoom limits (a span from 1e−7 to
   1e12) are in `grapher/view.ts`.
4. **Points of interest**, computed in the visible window and drawn as small grey dots: zeros, local maxima and minima,
   the y-intercept, and where any two visible curves (or a curve and a vertical line) cross. A tap on a dot shows its
   coordinates in a label on the plane and in the status line under it ("Row 1: maximum (125, 31250)"); a tap on a curve
   traces it there ("Row 1: (2, 2)"); a tap on empty plane clears it. Coordinates are exact for integers and simple
   fractions (1/3, −5/2, 0.25) and rounded to what fits otherwise (1.4142, 1234.6, 1.2 × 10⁻⁵), never looking exact when
   they are not (2.0). Under the plane, "Points of interest (N)" folds out the same points as buttons (keyboard
   reachable); picking one shows it on the plane.
5. **A table** for any row that is a function of x (the TI-84's TABLE): pick the row, the start and the step (TblStart,
   ΔTbl); x and y, "undefined" where the row has no value.
6. **Sliders**: every letter that is not x, y or e (and not a function's name) gets a slider row: its value (a box that
   takes −1/2 or 2pi too; a value past the range takes the range with it), the slider, and folded out, from, to and step.
   Default 1, from −10 to 10, step 0.1. y = a(x − h)² + k is three sliders.
7. **RADIAN or DEGREE** (the TI-84's MODE words), RADIAN by default: degree mode makes sin, cos and tan take degrees
   (exact at whole right angles: sin 180° is 0) and the inverses give degrees.
8. **"Graph it" from a problem.** Where a problem shows a function, a "Graph it" button (under the problem card; on a
   phone without a composer, beside the panel buttons; in the calculator steps too) opens the grapher with that function
   in a new row and the problem's window. In optimization it is in the final equation's card, once her final equation is
   right, and graphs her own equation (A(x) = 500x − 2x² opens with its maximum at (125, 31250) in view and listed). The
   grapher says "From your problem: row 1." and offers "← Back to the problem"; Back (or the phone's) returns to the
   problem with everything she had entered. A row already there is shown again, not added twice. Which function each
   problem type offers is in the table below; never the problem's hidden answer.
9. **Kept on the device** (`pct.graph`): rows, sliders, the window, the angle mode and the table survive a reload (saved
   a quarter second after a change, and when the app goes to the background). "Clear all…" asks first, in the app's own
   sheet ("Every row and slider goes, and the window goes back to the standard one."); it keeps the angle mode.
10. **Layout.** A phone: one column, the plane on top at 55% of the screen between the page's top and the tab bar (45% of
    what is left while the keypad is up), then the status line, then the rows, sliders, table, points and Clear all in
    a list that scrolls on its own, keeping the row she types in above the keypad. A wide screen (768 px and up, the
    tablet layout to come included): the rows on the left (23rem), the plane on the right, the points under it. The page
    fills the screen exactly; nothing scrolls behind it.
11. **Accessibility.** Every row is a labelled field ("Row 1"), its error tied to it (`aria-describedby`,
    `aria-invalid`); the plane is an image named by its window ("Graph, x from −10 to 10, y from −10 to 10") with a text
    description of each row ("Row 1, navy: the curve y = x^2 - 4." "Row 2, red: shading below its edge, y < 2x + 1, the
    edge dashed (not included)." hidden rows and rows in error said so); the picked point is in a polite live region;
    every control is a named button (Zoom in, Zoom out, Zoom to fit, Standard window, Row 1 options, RADIAN...), at least
    44 px; the swatches are toggle buttons; colour is never the only signal (rows are numbered and the description names
    each colour). Reduced motion: no animated zoom.
12. **Both editions, offline.** Nothing is downloaded; no new package.

### "Graph it", problem type by problem type

| Module | Template | Graph it offers | Why |
|---|---|---|---|
| optimization | all four | her final equation, once part 3 is right, as A(x) = … (a final equation in y is drawn in x, as the TI-84 does, and the button says so); the window: x where the problem makes sense, y from 0 past the top | the final equation is an answer until she has written it; then it is her own |
| quadratics | cs.form, cs.vertex | f(x) = the given f, in the window of the problem's own graph | given |
| polyZeros | pz.zeros, pz.end, pz.rational | f(x) = the given f | given |
| polyZeros | pz.build | nothing | f is the answer |
| polyDivision | sd.table, sd.value, sd.factor | f(x) = the dividend; Zoom to fit | given |
| rationalFns | rf.features, rf.asymptote | f(x) = the given f, in its graph's window | given |
| rationalFns | rf.equation | nothing | where the two sides meet is the answer |
| expLogGraphs | eg.features, eg.inverse | f(x) (or g(x)) = the given function, never f⁻¹ | given |
| expLogGraphs | eg.match | nothing | the picture is the answer |
| transformations | tr.describe, tr.point | f(x) = the parent and g(x) = f(x + 1) + 3 as the problem writes it, square window ±8 | both given |
| transformations | tr.equation | f(x) = the parent only | g's formula is the answer |
| piecewiseRate | pw.evaluate, pw.domain | each piece as `y = formula {condition}`, one colour, filled and open dots | given (shown as cases) |
| piecewiseRate | pw.continuous | the two pieces with k left as a letter (a slider) | k is the answer |
| piecewiseRate | arc.rate | f(x) = the given f | given |
| piecewiseRate | pw.graph, pw.write | nothing | the formulas were never shown, or are the answer |
| every other module | | nothing | not in this first set |

## Design decisions (for review)

- **Graph it graphs the given function even where its graph shows what the problem asks for.** The rule in the brief is
  "offer it only for what the problem already shows her (the given function, or her own entered equation), never for the
  problem's hidden answer", and the brief lists quadratics, polynomials, rational functions and exponential and log
  graphs, whose given functions' graphs show the vertex, the zeros, the asymptotes. So it graphs them, as her TI-84
  would, and never graphs a formula she is asked to write. The modules' own "graph of f" panels still wait for the end.
  This is the decision most worth a look: turning Graph it off before the end for one type is one line in
  `grapher/graphIt.ts` (return null), and a test lists every template's choice (`graphIt.test.ts`).
- **Not offered once a problem is finished.** A finished problem is not kept on its page (a reload, or Back from the
  grapher, starts it again), so Back would not find her work. The finished problem's own graph panel is open then.
- **The optimization button waits for part 3 to be right**, and then graphs what she typed (her own words: A = x(500 − 2x)
  becomes A(x) = x(500 − 2x); one not solved for A, 2A = …, goes in as an equation in y, which the grapher solves). Its
  maximum is the answer to parts 4 to 6, which she finds on the TI-84 the same way (the brief's own example).
- **The calculator panel's "Graph it"** is the statement's, shown only where the statement offers one (so never the
  optimization panel's Y1, which is the final equation).
- **A canvas, not SVG or function-plot**, for the plane: a drag resamples and redraws every curve on every frame; while a
  finger moves the curves are sampled coarser (4 px steps, 1 px tolerance) and finely again when it lifts, when the window
  is saved. Nothing goes through React during a drag. function-plot stays where it was (the problems' own graphs).
- **The evaluator** (`grapher/compile.ts`) compiles the engine's parse tree into closures (about a hundred times faster
  than evaluating the tree) with the engine's meaning, checked against `evalNode` on 40 expressions at 17 points:
  log base 10, ln, log(u, b); √ of a negative, 0 to a negative power and division by 0 undefined; odd roots of negatives
  negative; math.js's halves-away-from-zero round. Overflow is ±∞ (off the chart), not undefined. No `eval`/`new Function`.
- **Sampling** (`grapher/sample.ts`): each curve is cut at the zeros of its critical sub-expressions (denominators, the
  cosine under a tangent, the insides of logs, square roots and even roots, an arcsine's ±1, a negative or fractional
  power's base, her restriction's boundaries), found numerically in the window with touching zeros ((x − 1)²) too. At
  each cut both one-sided limits decide: continuous (carry on), a missing point (a hole, drawn as an open circle, the
  line left open), a jump or an asymptote (the piece ends, running off the window), a domain edge (the piece ends exactly
  there, √x starting at (0, 0)). Between cuts it samples every 2 px and splits chords until they are within 0.3 px of the
  curve, not refining stretches far outside the window. A jump nothing foresaw (floor) is found by bisection: a change
  that does not shrink with the step is a break, a steep one that does (y = 1000000x) is still the curve.
- **Points of interest** (`grapher/poi.ts`) in the visible window only, at most 30 of a kind per curve (nearest the
  middle). x is snapped to the integer or simple fraction it is when the function agrees there (f is as near 0, or as
  high or low), so 500x − 2x² has its top at exactly (125, 31250). A sign change across an asymptote is not a zero; a
  constant row and two identical rows add no points. A picked point of interest is dropped when the rows or a slider
  change (it may have moved); a traced spot follows.
- **"Zoom to fit"** (`grapher/fit.ts`): each curve's points of interest at ±10, ±100... ±100000, keeping the widest
  scale with at most 12 (so a wave shows a few waves and (x − 5000)² is found); the y-range holds the curve there with
  the extreme 2% of samples dropped (an asymptote does not flatten it) and every point of interest. Points and vertical
  lines count.
- **The standard window is −10 to 10 on both axes**, the TI-84's, not Desmos's square units: she knows ZStandard. A
  window stretches to the plane's shape (the TI-84's Xmin...Ymax), so opening the keypad squeezes the plane rather than
  cutting it.
- **Her functions** are found first across all rows, then a call f(…) is passed through the engine's parser as a carrier
  call (`nthroot(…, −1000 − k)`, a function name its tokenizer keeps whole), so `f(x)^2`, `2f(x - 1)` and `xf(x)` are
  calls while `a(x - h)^2` stays a product. Definitions may come after their use; a function defined twice, in terms of
  itself, or in a circle is an error on its rows. A restriction belongs on a row that graphs it, not on the definition.
- **A space between letters is times** (`a sin(x)` is a·sin x): the engine drops spaces, which would read it as asin(x),
  the arcsine. After a function name the space is kept (`ln x` is ln(x), as the engine reads it).
- **Letters are not case-sensitive** (the app's parser reads them in lower case); a function's name keeps its capital in
  the preview and the list. e is Euler's number, never a slider.
- **Rows that are not functions of x** (x² + y² = 25, x = y²) say to solve for y; an equation with no y (x² = 4) says to
  graph the two sides as two rows and look where they cross. Not drawn: implicit curves, polar, parametric, lists and
  regressions.
- **Colours** are six named, dark ones (navy, red, green, purple, gold, teal, all at least 4.5:1 on white), hex in
  `grapher/colors.ts` like PALETTE; pieces from a problem share one colour.
- **The keypad's Check key** reads "Next" (named "next row") in a grapher row and "Done" in a number box: an additive
  `enter` option on `useMathKeypad` / `MathTextInput` / `KeypadTarget`; every other box is unchanged.
- **Device memory, not in backups**, like `pct.set` and `pct.path`; Reset progress leaves the graph (it is not
  progress); a stored graph is checked on read (bad parts take defaults, a broken one is ignored).
- **Where the table and sliders sit**: on a phone they are under the plane, in the scrolling list with the rows; on a
  wide screen they are in the left column with the rows (the plane keeps the whole right column), and the points of
  interest stay under the plane on both.
- **Speed**: a drag frame with three curves and a shading takes about 1 ms of sampling here (on a machine where plain
  JavaScript ran five times slower than usual), points of interest 7 to 19 ms after the drag ends, Zoom to fit about
  45 ms (a phone: perhaps five to ten times that). The closures fold constants and have fast paths (x^2 as x·x, a
  number times f); the points of interest sample every curve once on one grid and read crossings from those samples.

## Log

- 2026-10-22: read CLAUDE.md, BUILD_GUIDE, roadmap, the phone keypad, screen, juice and monsters logs; the engine's
  parser and evaluator (parse.ts, math.ts, expressions.ts, logs/syntax.ts), notation's toLatex; Graph, SampledGraph,
  GraphPanel and graphBreaks; the keypad (MathKeypad, keypadKeys, keypadStore, keypadDom, useMathKeypad, MathTextInput,
  MathInput); CalcPanel, TabBar, navItems, appChrome, App; ProblemFrame, Problem, useAttempt; the optimization flow and
  its engine; the answers of every module with a function (a scratch dump, deleted).
- Built the pure core first, each with its tests: format, view, compile (against the engine), parse (every row kind and
  its errors), sample, roots, poi, fit, table, state, model, preview, graphIt. Found on the way: math.js rounds halves
  away from zero; the restriction's tolerance at a boundary was wider than the sampler's step inside it (a strict end was
  lost); an open end's height is the formula's own value there, not the limit's estimate; "a sin(x)" read as the arcsine;
  fractions of numbers past a million.
- Then the UI: the store, the canvas drawing and hit test, the plane with its gestures, the rows, sliders, table, points,
  the page, Graph it in ProblemFrame, CalcPanel and the optimization flow, the tab, the keypad's Next.
- In the tests: jsdom has no canvas (a recording fake context, `canvasTesting.ts`), and React's act holds a deferred
  render until a wait ends, so the plane's next frame needs a second short wait in the tests.
- Timed it: points of interest took 15 to 45 ms and Zoom to fit 300 ms here, mostly crossings resampled per pair and
  each scale resampled per curve. Constant folding and fast paths in the closures, and one shared grid for the points
  (crossings from the curves' own samples), brought them to 7 to 19 ms and 45 ms. A zero found on two neighbouring grid
  points (0 and 250, 250 apart) was first taken for a stretch along the axis and dropped; three in a row now are.
- Read my own code before the last run: screen readers would have heard "x caret 2" in the plane's description and the
  Graph it button's name (now x², the true minus, √, π: `speakable`).

## Not done

- No browser or device check (by instruction: no dev server, no browser). Worth a look on the emulator: 60 fps while
  dragging with three curves and a shading (coarse sampling while a finger moves is the design for it), the pinch, the
  plane at 55% with the keypad up, the label of a picked point near the edges, the header on a 360 px phone when "Back to
  the problem" is there (it wraps to a second line), the five tabs' labels.
- No keyboard panning of the plane (the zoom buttons, Zoom to fit, the standard window and the points list are keyboard
  reachable; arrow keys on the plane are not wired).
- Not drawn: implicit curves (circles), x as a function of y, polar and parametric curves, lists, regressions, sec, csc
  and cot (the parser reads them as letters today).
- "Graph it" is in the first set of modules only (the table above); inequalities, domain and range, composition,
  inverses, even/odd, the difference quotient, sign charts and the trig modules could follow with their own rules.
- The problem screen now has the rail's "Graph" panel (the problem's own graph, behind its gate) and the "Graph it"
  button (the grapher): two similar names; renaming the panel touches a dozen tests.
- A rounded coordinate is not marked as rounded beyond its decimal (2.0); π multiples are not recognised (π/2 shows as
  1.5708).

## Verification (2026-10-22, in `C:\work\grapher`)

- `npm run typecheck` (the app, node and server configs): clean, on the final code.
- New tests, 345 in 9 files: `grapher/parse.test.ts` (63: every row kind, her functions, every error, sliders, the
  preview), `compile.test.ts` (48: 40 expressions against the engine's `evalNode` at 17 points, undefined vs overflow,
  degree mode, the critical sub-expressions), `sample.test.ts` (19: tan x and 1/x not crossed, tan x in degrees, the
  hole of (x² − 1)/(x − 1) open, √x from (0, 0), ln x, √(4 − x²), floor's jumps, a curve that leaves and comes back,
  steep and flat, a window a million wide and a millionth wide, fast quality, restrictions' dots), `poi.test.ts` (13:
  x² − 4, sin x in radians and degrees, 500x − 2x² at exactly (125, 31250), y = x and y = x² at (0, 0) and (1, 1),
  touching crossings and zeros, asymptotes, constants, restrictions), `view.test.ts` (18: pan, zoom, pinch, limits,
  ticks, Zoom to fit, numbers, the speakable form, the table, degrees), `graphIt.test.ts` (150: every template of every
  module, offered or not, and never a hidden answer: g for "write g", f⁻¹, k, the optimization final equation; her final
  equation in every form, its vertex in the window), `components/grapher/graphStore.test.ts` (8: rows, colours, sliders,
  Graph it's import, saving and reading back, a broken stored graph, the keypad's keys), `pages/Grapher.test.tsx` (20:
  the lazy tab with five tabs, rows with preview and errors, Enter and Backspace, hide, recolour, move, delete, f and g,
  the description, shading with a dashed edge and a hole drawn, drag, pinch, wheel, + and −, the standard window, Zoom to
  fit, tracing, points of interest as buttons and by tap, sliders, the table, DEGREE, a reload, Clear all asking first,
  the keypad's keys and Next), `pages/flows/GraphIt.test.tsx` (6: the optimization problem at seed 982, the worksheet's
  500 ft pen: no Graph it before part 3, then its maximum at (125, 31250), Back with her part 4 entry intact, no
  duplicate row; a quadratic under the problem and in the calculator steps, in the problem's window; transformations'
  "write g" with f alone; synthetic division zoomed to fit; piecewise pieces, none once finished; pz.build none).
  Changed: `TabBar.test.tsx` (five tabs, /graph, a 360 px estimate of the labels), `Monsters.test.tsx` (five tabs).
- Whole suite (`vitest run --maxWorkers=4`): the first run had one failure, a 20 s timeout in
  `content/modules/propertiesDrill/drill.test.ts` (an engine sweep this branch does not touch; it passed alone in 8 s,
  with other projects' processes running on the machine). After the last small fixes (below) the whole suite ran again
  on the final code: **308 files, 5199 tests, all pass** (1191 s).
- Fixed after the first run, from reading my own code: the wheel now stops a zoom that is still gliding; a request to
  focus a row is taken once (a left-over one grabbed a row when the page opened again); a row's preview follows an
  error the sliders' values reveal.
- `vite build --outDir C:\work\grapher\.tmp-dist`: passes (the existing chunk-size warning only). The grapher is its own
  lazy chunk (39 kB, 14 kB gzipped) and its core a 45 kB chunk shared with the problem pages (16 kB gzipped). Tailwind
  generated the classes it uses (`accent-[var(--color-navy)]`, `md:w-[23rem]`, `border-[3px]`, `md:order-2`...). Built
  three times (to check the CSS, then on the final code); the folder was deleted each time.
- Scratch files (a dump of every module's answers, timing and jsdom probes) were in `src/zzscratch` and are deleted.

## Files

New, the pure core (`src/grapher/`): `format.ts` (numbers, ticks, the speakable form), `view.ts` (window, pan, zoom,
pinch, ticks), `compile.ts` (the evaluator and the critical sub-expressions), `parse.ts` (rows and their errors),
`preview.ts` (KaTeX), `model.ts` (the compiled graph, sliders, solving for y), `roots.ts` (bisection, Brent, zeros,
snapping), `sample.ts` (adaptive sampling), `poi.ts` (points of interest), `fit.ts` (Zoom to fit), `table.ts`,
`colors.ts`, `state.ts` (`pct.graph`), `graphIt.ts` (what each problem may graph); tests `parse.test.ts`,
`compile.test.ts`, `sample.test.ts`, `poi.test.ts`, `view.test.ts` (zoom and pan, fit, numbers, table), `graphIt.test.ts`.

New, the screen (`src/components/grapher/`): `graphStore.ts` (+ `graphStore.test.ts`, which also checks the keypad's
key set), `draw.ts` (canvas drawing, hit test), `Plane.tsx` (gestures, zoom buttons), `RowList.tsx` (rows, the options
sheet), `SliderList.tsx`, `NumberBox.tsx`, `TablePanel.tsx`, `PointsPanel.tsx`, `GraphItButton.tsx`, `canvasTesting.ts`
(test helper: a recording 2D context); `src/pages/Grapher.tsx` (+ `Grapher.test.tsx`); `src/pages/flows/GraphIt.test.tsx`;
this log.

Changed: `src/App.tsx` (the lazy route), `src/components/navItems.tsx` (the Graph tab and its icon),
`src/components/keypadKeys.ts` (`KEYPAD_SETS.graph`), `src/components/keypadStore.ts`, `useMathKeypad.ts`,
`MathKeypad.tsx`, `MathTextInput.tsx` (the optional `enter` label of the Check key), `src/components/CalcPanel.tsx` (an
optional `graphIt` slot), `src/pages/flows/ProblemFrame.tsx` (Graph it under the problem and in the calculator steps),
`src/pages/flows/OptimizationFlow.tsx` (Graph it in the final equation's card), `docs/BUILD_GUIDE.md` (§0 UI row, §7).
Tests changed on purpose: `src/components/TabBar.test.tsx` (five tabs, /graph, the 360 px check),
`src/pages/Monsters.test.tsx` (five tabs). No package added; content, grading, the engines, the rewards and deploy
untouched.
