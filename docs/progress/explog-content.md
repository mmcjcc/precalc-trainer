# Exponential and logarithmic functions (precalculus Unit 3)

Content stage for the engine in `src/engine/logs` (re-exported from `@/engine`). Course `precalc`, unit `unit3` (label "Unit 3", title "Exponential and logarithmic functions"), after Unit 2. Three modules, each problem built from the seed (`makeRng(mixSeed(seed, k))` via `searchSeed`), not from a fixed list. Nothing under `src/engine/` was edited. No new `log_` id: the 22 slips plus `log_check_answers` were already in the catalog. Changes are uncommitted on `precalc-explog-content`.

## What shipped

- `logForms` — "Logarithms and exponential form".
  - `lf.value`: exact value (`gradeLogValue`). A fraction such as 3/2 and its terminating decimal 1.5 are both right. A draw is dropped when a slip rounds to the same number as the answer (`logValueMistakes`).
  - `lf.convert`: the other form (`gradeConvertForm`), including `e^(2x) = 7` → `ln(7) = 2x` and a log with a variable.
  - `lf.decimal`: calculator value to two, three, or four places (`gradeLogValue` with `{ decimal: { places } }`). Hints may show TI-84 keystrokes (`LOG 10 ) ÷ LOG 3 )` or `logBASE(10, 3)`) and never the resulting number.
- `logProperties` — "Properties of logarithms". The prompt says every variable is positive. One checked line at a time (`checkLogRewrite` with `assumePositive: true`). Expand finishes when `isExpandedLog` and the line still equals the start (`expandLog` is the hinted line). Condense finishes when `isSingleLog` and the line still equals the start. A constant written as a log of the base is skipped when `sameLogLine` already calls it the same line, so the anchor does not start one step ahead.
- `expLogEquations` — "Exponential and logarithmic equations". One checked line (`checkLogStep` with `original` set to the first line, and `decimal` when the problem rounds), then a final answer (`gradeLogEquation`: `x = 5`, `5`, `x = 5 or x = -2`, or `no solution`). The answer box stays shut until a line is kept. An accepted line with caveat `extraneous_check` shows the `log_check_answers` note as status, never as a mistake. After she finishes, `analyzeLogEquation(...).explanation` is the worked solution. Equations do not auto-finish when the last hinted line is accepted.

The screen is the same line-at-a-time frame as quadratics: three hint rungs, the last shows the next line and marks it shown, entries survive a reload, and a note she can still act on does not contain the answer. `MathInput` keys: `log`, `ln`, `log_` (subscript base), `e^`, `logBASE(`, and `or`.

## Decimal families are split on purpose

`log_ln_confused` only swaps the LOG key and the LN key. It does not apply to a subscript base, and `changeOfBaseForm` only exists for a subscript base. One decimal problem therefore cannot promise all three calculator slips.

- Change of base (`log_3(10)`, `log_7(50)`, …) requires `log_change_base_inverted` and `log_quotient_as_quotient`, and those two rounded values must differ from the answer and from each other.
- A plain `ln` or `log` requires `log_ln_confused`, with that rounded value different from the answer.

## Same line vs a new step

`sameLogLine` treats a factored polynomial as the same line as the expanded one (the two sides are the same function). That is the anchor, not a solution-set check. A canonical step that `sameLogLine` calls the same as the line above is left off the hinted path, so progress does not start already on that step. The screen still keeps a different writing: "the line above, written again" is the same characters, not the same function. Factoring `e^(2x) - 11e^x + 30 = 0` into `(e^x - 5)(e^x - 6) = 0` is kept. The hinted next line is the one that is actually new, such as `e^x = 5 or e^x = 6`.

Equation seeds are folded with `spread` to about 160 distinct equations so the 2000-seed leak sweep does not solve thousands of cold equations. The answer histogram is still at most 30 of 300. No core bug turned up: every equal exact form the hand tests try (`ln(7)/ln(2)`, `log(7)/log(2)`, `log_2(7)`, `logBASE(7, 2)`) grades correct, and a decimal is correct only on a rounded problem, within half a unit of the last place.

## Checks

`npm run typecheck` passed (all three configs). Full Vitest suite: 180 files, 3088 tests, all green (about 396 s). The exponential equation sweeps use a 240 s timeout: alone they take about 35 s, and beside the other heavy files in the suite they passed 120 s (133 s and 106 s). Every other seeded loop stays at 120 s. `vite build --outDir C:\work\tmp\explog-dist` passed (the existing chunk-size warning only; the main chunk was already over 1,500 kB before this unit).

Seed-1 URLs (each shows the named trap):

- `#/p/logForms/lf.value/1` — `log_value_divided` on `log_81(177147)`
- `#/p/logForms/lf.convert/1` — `log_convert_swapped` on `10^(-3) = 0.001`
- `#/p/logForms/lf.decimal/1` — `log_change_base_inverted` on `log_8(19)`
- `#/p/logProperties/lp.expand/1` — `log_quotient_as_quotient` on `ln(sqrt(x) / y^4)`
- `#/p/logProperties/lp.condense/1` — `log_sum_split` on `log(x) + log(x + 3)`
- `#/p/expLogEquations/ee.exponential/1` — `log_one_side` on `3^x = 13`
- `#/p/expLogEquations/ee.logarithmic/1` — `log_sum_split` on `log_6(x) + log_6(x - 5) = 2`
- `#/p/expLogEquations/ee.quadratic/1` — `log_exp_coefficient_base` on `4^x - 9 * 2^x + 8 = 0`
