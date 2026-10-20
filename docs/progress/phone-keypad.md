# Phone math keypad

Branch `phone-keypad`. Uncommitted, for review.

## Why

On a phone, typing math on the system keyboard was the worst problem the design review found: a number answer
opened the letter keyboard, the symbol strip sat on top of a full keyboard, and the first line of
7^(x+2) = 2^x, `(x+2)ln(7) = x ln(2)`, took about 30 taps across three keyboards. With the keypad it is 12 taps
on one: `( x + 2 ) ln 7 → = x ln 2` (the ln key brings its own parentheses), then Check. A test counts them.

## What she gets (touch screens only)

- A math box gets `inputmode="none"`: tapping it opens the app's keypad, not the phone's keyboard. The caret,
  the preview, the parser and the grading are unchanged; the keypad types into the box through the input's own
  change event (native value setter + `input` event), with the strip's `insertToken`.
- One fixed panel at the bottom (safe-area aware, keys 44-52 px tall, 5 px gaps, about 40% of a phone):

  ```
  context row (scrolls): the box's other letters, then its strip keys (√ π ln log ≤ ∞ ∪ ° …)
  x   ^   7  8  9  ÷
  (   )   4  5  6  ×
  ,   x²  1  2  3  −
  abc ⌄   0  .  =  +
  ←   →   ⌫  [  ✓ Check  ]
  ```

  `×` and `÷` insert `*` and `/`; `^` is the power key; `x²` inserts `^2` (the TI-84 key); `=` is the strip's
  spaced `=`. The first cell is the box's first letter (x; i for complex numbers). Backspace undoes one key
  (an empty `sqrt()`, a spaced ` = `, `pi`), else one character; held, it repeats. ← → move the caret.
  A phone on its side gets three wide rows (CSS only).
- Check does exactly what Enter does in that box: the keydown goes to the box first, then the browser's
  implicit submission (the form's default button, or a form whose only text field it is).
- abc puts this box on the phone's keyboard (words: "no solution", "deg"); a slim bar above that keyboard has a
  123 key that brings the keypad back. ⌄ hides the keypad; tapping the box opens it again.
- Autofocus on page load leaves the caret in the box but does not open the keypad (as the phone keyboard does
  not); a tap does. Focus that follows a key press (Check, then the next part's box) keeps it open.
- While it is open, `--keypad-h` on `<html>` is its height: body padding keeps that room at the bottom, scroll
  padding keeps boxes above it, the phone composer is sticky on top of it, toasts sit above it. The focused box
  (with its card and the message about her answer) scrolls into the band above the keypad; after a Check in the
  composer the page scrolls to its end, where her newest line is.
- The symbol strip is not shown on a touch screen; on a fine pointer (mouse) nothing at all changes.
- Settings, Practice: "Math keypad" switch, shown on touch screens, on by default (`settings.mathKeypad`
  absent = on). A replace-import keeps this device's value.
- Accessibility: `role="group"` named "Math keypad"; every key is a button with a spoken name (times, divide,
  power, square root, delete, left, right, check, …), out of the tab order. A screen reader's tap that moves
  focus onto a key is handed back to the box.

## How a box opts in

- `MathInput`: automatic. Its `stripKeys` (default: the full strip) become the context row.
- `PolyTextBox`: pass `keypad={{ keys: LOG_KEYS }}` (and `vars` when the letters differ from the strip's).
- Any other `<input>`: use `<MathTextInput keypad={{ keys, vars }} …same props… />` (drop-in).
- Your own component: `const kp = useMathKeypad({ keys, vars, inputMode, disabled })`, then spread `ref`,
  `inputMode`, `onFocus`, `onBlur`, `onClick` on the input.
- A flow that renders `SymbolStrip` itself hides it when `useMathKeypadOn()` is true.
- Boxes that never had a strip use `KEYPAD_SETS` (`components/keypadKeys.ts`): `number`, `radical`,
  `plusMinus`, `interval`, `set`, `condition`, `xy`.

## Boxes opted in

MathInput everywhere (inequalities, even/odd, inverses + bonus, difference quotient, composition, function ops,
quadratics, log lines, polynomial formula, transformation formula, sandbox); ComplexNums, Geometry (number, point,
line parts; a line gets x and y), ExpLogParts (interval/formula/exact/point with their strips, line with x y,
decimal with none; a range gets y), LogForms, the LogLine answer box, fnUi `SetAnswerField` (domain/range,
composition, piecewise sets), PolyZeros (zeros, multiplicities, candidates, rational zeros), PolyDivision (rows,
cells, quotient, remainder, value), SignCharts, RationalFns, GraphFeatures, Transformations (amounts, factors,
point), PiecewiseRate value, PiecewiseMore (k, value, piece formulas and conditions), FinalAnswerCard (interval and
set-builder; its token buttons hide), VerdictCards (check-it and twin numbers), Sandbox's current line.

## Not done / left alone

- Chemistry boxes (sig figs, atoms, electron configurations, nomenclature, periodic table) keep the phone's
  keyboard: they already open the number pad (`inputMode="decimal"`/`"numeric"`, built for phones) or take words
  and formulas, and the phone app is the math-only fork. Opting one in is one prop if wanted later.
- AskAnything and the tutor chat stay on the phone keyboard (chat boxes), with their strip.
- No device testing here (no browser was opened, by instruction): the scroll and visual-viewport behaviour is
  covered by jsdom tests with mocked geometry only.

## Verification (2026-10-20)

- `npm run typecheck`: clean.
- Whole suite, `vitest run --maxWorkers=4`: 219 files, 4117 tests, all pass. New: `keypadKeys.test.ts` (24),
  `MathKeypad.test.tsx` (22), `MathKeypadFlows.test.tsx` (4 problems finished with keypad taps only: a number
  answer −1/5, 7^(x+2) = 2^x line by line, an exponential's domain/range/asymptote/intercept, a geometry angle
  with °), one more case in `store/backup.test.ts`.
- `vite build --outDir C:/work/tmp/keypad-dist`: passes (the existing chunk-size warning only).

## Files

New: `src/components/keypadKeys.ts` (+ test), `keypadStore.ts`, `keypadDom.ts`, `useMathKeypad.ts`,
`MathKeypad.tsx` (+ test), `MathTextInput.tsx`, `keypadTesting.ts` (test helpers),
`src/pages/flows/MathKeypadFlows.test.tsx`.
Changed: `App.tsx`, `index.css`, `components/{MathInput,Composer,Toast,FinalAnswerCard,VerdictCards}.tsx`,
`pages/Settings.tsx`, `pages/Sandbox.tsx`, `store/types.ts`, `store/backup.ts` (+ test), and the flows listed
above.
