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

## Review (Claude, 2026-10-18)

Independent re-solve: `src/content/modules/explog.crosscheck.test.ts` solves every problem again without the
core's solver (values with `Math.log`, equations by a sign-change scan and bisection inside the domain,
expansions by evaluating both forms at random positive points) and checks every accepted spelling, the
promised trap, and that one of two roots alone is never named as a slip. 300 seeds per template, all green.
A Gemini 4 adversarial review of the line screen and the two generators gave five findings; four were real
(the fifth, "a new problem keeps the old state", is not: `ProblemBody` is keyed by the instance id).

Fixed in the core (`src/engine/logs/solve.ts`, `relslips.ts`; tests in `logs.review.test.ts`):
- An answer with SOME of the solutions and nothing else was named as whichever slip also had that root
  (x = 1 alone for 4^x − 3·2^x + 2 = 0 read as `log_exp_coefficient_base`). It is now "1 of the 2 solutions",
  unless the slip IS a valid negative root thrown out of a log equation (`log_valid_rejected`).
- A slip within 0.2% of a real root (x = 5.001 for 5) is no longer a named candidate.
- "Take the log of both sides" is not offered when a side is 0 or negative (the witness read log(0)).
- `log_valid_rejected` only for log equations; on an exponential equation "no solution" is plain wrong
  (its witness printed an empty "()").
- New candidate: the values of u reported as the solutions (2^x = 8 written x = 8) is `log_convert_dropped`.
- Quadratics in an exponential with two bases (4^x − 9·2^x + 8 = 0) now get the textbook explanation
  ("Write 4^x as (2^x)^2. Let u = 2^x: …") instead of a bare "Solution: x = 0 or x = 3".

Fixed in the content:
- Textbook sizes: exact values up to 2^10, 3^6, 5^4, 10^6 (it had log_81(177147) = 11/4 and log_(1/5)(3125));
  conversions up to 4096; 6·3^x = 1458 rather than 6·3^x = 354294; u = b^x roots up to 81 rather than
  4^x − 288·2^x + 8192 = 0; x(x − d) = P with P ≤ 1000 and d ≤ 40. Sums of logs combine to a power
  (log_6(4) + log_6(9) = 2, log_2(40) − log_2(5) = 3). `lf.value` may repeat an answer up to 15% of
  seeds: the exact values she can find by hand cluster on small numbers.
- Promised traps have the answer's shape: a two-root "slip" of a one-root equation is not promised. The
  quadratic-in-form problems promise the u-values slip.
- The log-quadratic family had two distinct problems (log_3(x^2 − 6x) = 3 and log_5(x^2 − 20x) = 3); it now
  draws from bases 2, 3, 5, 6, 10 and m = 1 (the textbook log_3(x^2 − 8x) = 2).
- Prompts say which form is wanted ("Solve. Give the exact answer." / "Solve exactly. Check every answer…").
- `x = e^1` reads `x = e`.
- Same-base problems (2^x = 4^(x − 3)) hint the exponent line instead of jumping to the answer.
- Screen: each root of a two-root answer is redacted from notes too; a kept line that is already the
  solution goes into the answer box; one answer counts once per attempt (a trailing space or a reload no
  longer records it twice); a new attempt at the same problem starts clean; Undo also restores the saved
  draft. Flow test: "fixes from the review".

Not changed (noted): expand hints show the whole expansion as the next line (the core has no partial
expansion path yet), and the condense hint skips the "2 = log_2(4)" rewrite.
