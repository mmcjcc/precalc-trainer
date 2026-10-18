# Exponentials and logarithms core: engine API and progress log

Engine core only (Claude, 2026-10-18, branch `precalc-explog`, working copy `C:\work\explog`). Templates, screens,
rule cards, nudges, Home registration and the growth/decay word problems are the next builder's job. The core
lives in `src/engine/logs/`; its public API is `src/engine/logs/index.ts`, re-exported from `@/engine`.
Nothing is committed.

**Status:** complete. `node node_modules/vitest/vitest.mjs run src/engine/logs` → 12 files, 522 tests green.
`npm run typecheck` clean (all three configs). Whole suite (2026-10-18): 174 files, 2,995 tests, all green
(before this build: 162 files, 2,473 tests). Counts per file in §8.

## 1. The log semantics (fixed first)

How the app now reads what she types (her course and her TI-84; `src/engine/logs/syntax.ts` rewrites every
spelling before math.js sees it, `src/engine/math.ts` defines the functions):

| She types | Means | Why |
|---|---|---|
| `log(x)` | base 10 | the TI-84 LOG key. math.js reads one-argument `log` as the NATURAL log; `math.ts` now redefines `log` |
| `ln(x)` | base e | the TI-84 LN key. math.js had no `ln` at all (every `ln` was undefined before) |
| `log(x, b)`, `logBASE(x, b)` (any case) | base b, argument first | the TI-84's MATH > A `logBASE(` and math.js both put the argument first |
| `log_2(8)`, `log_(1/2)(8)`, `log_{3}(81)` | base after the underscore | the subscript she writes on paper; `log_e(x)` is `ln(x)`, `log_10(x)` is `log(x)` |
| `log2(8)`, `log10(x)` | base 2, base 10 | digits typed straight after `log` with `(` next are a base (as in Python and math.js). `log100` with no parenthesis is log(100) |
| `log 100`, `ln x`, `lnx`, `log_2 8`, `2ln x + 1` | a log of ONE number or ONE letter | only when an operator, `)`, `,` or the end comes next |
| `ln 2x`, `log x^2`, `ln e^5`, `log xy`, `log 2(8)`, `log_28` | parse error with a caret on the log | ambiguous on paper ("ln 2x": ln(2x) or (ln 2)x?); the message asks for parentheses |
| `e`, `e^x`, `exp(x)`, `10^x`, `b^x`, `e^-x` | as written | `e^2x` is still (e²)·x, the calculator's precedence, as before |

- A log of 0 or a negative, a base of 0, 1 or a negative: undefined (the evaluator's `'undef'`).
- `log(243, 3)` is exactly 5 (no 4.999999999999999): `logBase` returns the integer when b^k reproduces x exactly.
- **Letter runs** now split into the names they contain: `x log(2)` is x·log(2) (before: "Unknown letter l"),
  `x ln(x)`, `2x log(x)`, `x sqrt(x)`, `pix`. A run made only of the app's letters (x, y, n, h, e) contains no
  function name, so `xy`, `ex`, `2hx` split exactly as before.
- **A function name without parentheses** (`sqrtx`, `y = 2 + abs`) is now a parse error ("sqrt needs parentheses
  around its input, like sqrt(x).") instead of a line that parsed but was undefined everywhere.
- **Decimal exponents keep their value.** `normalizeOddRoots` used to round ANY constant exponent to the nearest
  fraction with denominator ≤ 12 with no tolerance: `10^0.4771` became 10^(5/11), `e^0.33` became e^(1/3). It now
  rewrites only an exponent that IS p/q (`x^(1/3)`, `(−8)^(1/3) = −2` unchanged).
- **Domain boundaries:** `domainSubexpressions` now also returns `pos` (log inputs, and a variable log base, which
  must be > 0; a variable base also puts b − 1 in `zero`). The engine's Tier 2 adds their roots as boundaries.
- **Display:** KaTeX `\log`, `\ln`, `\log_{b}` (`toLatex('log_2(8) = 3')` is `\log_{2}\left(8\right) = 3`),
  `exp(u)` as `e^{u}`; TI-84 strings `log(X)`, `ln(X)`, `logBASE(X,2)`, `e^(X)`; Nspire `log(x,2)`, `e^(x)`.

**Every earlier use of `log` keeps working**: the only uses were `log(x)` as an input the exact cores must refuse
(`domainOf('log(x)')`, the range test, `averageRateOfChange('log(x)', 1, 10)`: all still `null`) and the
function-name lists. Graphs evaluate through `evalExpr`, so `log` plots base 10. Every string literal in `src`
and every string of 6 generated problems per template of every module (21,021 strings) was parsed before and
after the change: the only ones that read differently are `log(x)` (now base 10), the garbage parse `log10`
(was `log*10`), and 43 bare function names or `√45`-style glyph strings that used to parse to a value undefined
everywhere and are now a parse error (geometry reads its √ answers with its own reader). A committed regression
test (`regression.test.ts`, 140 lines from that corpus) pins the old parses.

## 2. How a step is judged (the textbook way)

`checkLogStep` (relation mode) and `checkLogRewrite` (expression mode) sample ONLY INSIDE THE DOMAIN: for one
variable the domain is found as open intervals from the roots of every log input, radicand and denominator on a
wide grid (`wide.ts`), and the samples are drawn from those intervals; for two variables, by rejection sampling
with positive points mixed in.

- **Expression mode** (expand, condense, simplify): the new line must equal the previous one at EVERY point where
  the previous one is defined. So `2 ln x → ln(x²)` is legal (the domain only grows: condensing), and
  `ln(x²) → 2 ln x` is NOT: at x = −1 the original is ln 1 = 0 and the new line is undefined. Its pattern is
  `log_power_abs` ("ln(x²) is 2 ln|x|"). With `assumePositive: true` (the "assume all variables are positive"
  instruction of expand/condense exercises) the domain is cut to x > 0 and the same step is the power rule.
  Likewise `log(x(x − 3)) → log x + log(x − 3)` is wrong at x = −1 unless x > 0 is assumed.
- **Equations**: the two lines must have the same solutions INSIDE THE DOMAIN OF THE ORIGINAL EQUATION
  (`ctx.original`, the problem's first line). That is the textbook method: solve, then check every answer in the
  original.
  - A line that also has solutions outside that domain is legal, with `caveat: 'extraneous_check'`, verdict
    `extraneous_superset` and the info pattern `log_check_answers`; `extraneous` lists each such candidate and
    the log input that fails (`log x + log(x − 3) = 1 → log(x(x − 3)) = 1` lets in x = −2).
  - Dropping such a candidate is legal (`x = 5 or x = −2 → x = 5`): `rejected` says why.
  - Losing a solution inside the domain is a mistake: `ln(x²) = 4 → 2 ln x = 4` loses x = −e²
    (`log_power_abs`); `x = 5 or x = −2 → x = −2` drops the real answer (`log_valid_rejected`).
  - ln(x²) = 4 → 2 ln x = 4 is therefore wrong (it loses x = −e²) unless the problem assumes x > 0.
- **Inequalities** are compared on the whole line, so the domain must be carried in the line itself:
  `log x < 2 → x < 100` is wrong (x = 0 fits the new line; the original is undefined there);
  `0 < x < 100` is right.
- **Wide grid.** Solution sets come from a grid that reaches 10⁷ (steps of 0.05 on [−12, 12], 0.25 on
  [−60, 60], then ×1.06 out to ±10⁷, plus points 10⁻¹⁰ … 10⁻¹ on both sides of every domain boundary). The
  engine's own Tier 2 scans only [−60, 60]: a half-life answer t ≈ 9953 was invisible to it, so a wrong step
  between two lines whose roots both lie beyond 60 could be accepted.
- **Exponential tails.** Two sides that have both underflowed (2^(x+1) and 3^x at x = −10⁴) say nothing; equality
  against an exact 0 is absolute, between two tiny nonzero sides relative (`equalLog` in `wide.ts`).
- **The engine routes log lines here.** `verifyStep` / `verifyStatements` send every one-variable line with a log,
  or with the variable in an exponent (2^x, e^x), to `checkLogStatements`; `verifyRewrite` sends such expressions
  to `checkLogRewrite`. Before, the general Tier 1 accepted `ln(x²) = 4 → 2 ln x = 4` as "moved terms across the
  sign" (it compares only where both lines are defined) and the condensing step without a caveat. No existing
  module has such lines, so nothing else changes (the corpus check above found none). Two-variable lines stay
  with the general checker.

## 3. API reference

All exported from `@/engine`. Types and field comments: `src/engine/logs/types.ts`.

Conventions (as in the earlier cores): fields named `text` are ASCII app syntax that the parser reads back
(`"log_2(x) + 1"`, `"x = log(7)/log(2)"`); sentences (`witness`, `message`, `explanation`, `detail`) are
display text with −, ·, subscript bases (log₂(8)). Deterministic: no randomness beyond the seeds passed in.

### 3.1 Line by line

`checkLogStep(prev: string, next: string, ctx?: LogStepContext): LogStepResult`

```ts
interface LogStepContext {
  vars?: VarName[]            // default ['x']
  seed?: number
  original?: string           // the problem's first line: extraneous answers are judged against ITS logs
  assumePositive?: boolean    // the problem says x > 0
  decimal?: DecimalSpec       // the problem wants a rounded decimal: { places: 3 } or { tolerance: 0.01 }
}
interface LogStepResult extends StepResult {   // the shared shape: ok, verdict, caveat, detected, acceptableChips, pattern, counterexample, parseError, normalized
  logMove?: { properties: LogProperty[]; detail: string }   // accepted lines: which properties the step used
  extraneous?: ExtraneousNote[]   // candidates the new line lets in that fail the original's domain
  rejected?: ExtraneousNote[]     // candidates of the previous line this step dropped for that reason
  notExact?: boolean              // a calculator decimal where the exact form is wanted (not a mistake)
  message?: string                // a sentence when there is no pattern/counterexample (notExact, rounding, undecidable)
}
interface ExtraneousNote { value: number; text: string; argument: string; argumentValue: string; sentence: string }
```
```ts
const O = 'log(x) + log(x - 3) = 1', ctx = { original: O }
checkLogStep(O, 'log(x(x - 3)) = 1', ctx)
// ok, verdict 'extraneous_superset', caveat 'extraneous_check', pattern log_check_answers,
// extraneous [{ value: −2, sentence: 'x = −2 makes log(x) undefined: its input is −2, and a log needs a positive input.' }],
// logMove.properties ['product_rule']
checkLogStep('log(x(x - 3)) = 1', 'x(x - 3) = 10', ctx)   // ok, logMove ['convert_form']
checkLogStep('x = 5 or x = -2', 'x = 5', ctx)            // ok, rejected [−2], logMove.detail 'rejected x = −2: x = −2 makes log(x) undefined: …'
checkLogStep('x = 5 or x = -2', 'x = -2', ctx)
// not ok, lost_subset, log_valid_rejected: 'x = 5 keeps every log in the original defined (x is 5, x − 3 is 2), and it
// solves the original, so it stays. Only an answer that makes a log’s input 0 or negative is extraneous.'
checkLogStep('log_2(x) = 5', 'x = 25')
// log_convert_swapped: 'log₂(x) = 5 means x = 2^5: the base 2 raised to the power 5. Your line x = 5^2 has the base and the exponent the other way round.'
checkLogStep('x log(2) = log(7)', 'x = log(2)/log(7)')
// log_change_base_inverted: 'x · log(2) = log(7) means x = log(7)/log(2): divide both sides by log(2). Your line x = log(2)/log(7) is upside down: …'
checkLogStep('2^x = 7', 'x log(2) = log(7)')             // ok, logMove ['take_log']
checkLogStep('x log(2) = log(7)', 'x = log(7)/log(2)')   // ok, logMove.detail 'divided both sides by log(2)'
checkLogStep('x = log(7)/log(2)', 'x = 2.807')           // not ok, notExact: true, no pattern, message '2.807 is a calculator approximation. …'
checkLogStep('x = log(7)/log(2)', 'x = 2.807', { decimal: { places: 3 } })   // ok, logMove ['rounded']
checkLogStep('x = log(7)/log(2)', 'x = 2.8', { decimal: { places: 3 } })     // not ok, message '2.8 is rounded too far: give 3 decimal places.'
checkLogStep('ln(x^2) = 4', '2ln(x) = 4')                // not ok, lost_subset, log_power_abs (counterexample at x = −7.389)
checkLogStep('log(x) < 2', 'x < 100')                    // not ok (counterexample at x = 0: the original is UNDEFINED there)
```
Without `original`, the previous line is the reference: dropping a candidate from a log-free line
(`x = 5 or x = −2 → x = 5`) is then a plain lost solution. **Pass `original` on every step of a log equation.**
`logMove.properties` (`LogProperty`): `product_rule`, `quotient_rule`, `power_rule`, `change_of_base`,
`inverse_property`, `log_identity`, `exp_product`, `exp_power`, `exp_negative`, `take_log`, `convert_form`,
`one_to_one`, `both_sides`, `reject_extraneous`, `rounded`, `evaluate`, `rewrite`. `detected` keeps the shared
contract: the engine's own move for `both_sides` steps, otherwise `{ tag: 'simplify', exact: false }` with the
log detail, and `acceptableChips` is the rewrite family (`REWRITE_CHIPS`): there are no log chips yet (§7).

`checkLogRewrite(prev: string, next: string, ctx?: LogRewriteContext): LogStepResult` — expression mode;
`ctx = { vars?: VarName[] (default ['x', 'y']), seed?, assumePositive? }`. Constant lines are compared exactly.
```ts
checkLogRewrite('log(x^2 y^3)', '2log(x) + 3log(y)', { assumePositive: true })   // ok, logMove ['product_rule', 'power_rule']
checkLogRewrite('log_2(8x)', '3 + log_2(x)')            // ok, ['product_rule', 'evaluate']
checkLogRewrite('ln(x^2)', '2ln(x)')
// not ok, log_power_abs, counterexample 'At x = −1 the original expression gives 0, but yours is undefined.',
// message 'x = −1 is in the domain of the original expression but not of yours.'
checkLogRewrite('log(x/3)', 'log(x)/log(3)')
// log_quotient_as_quotient: 'log(x/3) is not log(x)/log(3): the log of a quotient is the DIFFERENCE of the logs, and a quotient
// of logs is a change of base. At x = 1: log(x/3) ≈ −0.477, but log(x)/log(3) = 0.'
checkLogRewrite('log(x + 2)', 'log(2x)')                // log_sum_split (the slip, then a legal product rule)
checkLogRewrite('log_4(5x^3 y)', 'log_4(5) + (log_4(x))^3 + log_4(y)', { vars: ['x', 'y'], assumePositive: true })   // log_power_as_power (after a legal product rule)
checkLogRewrite('log(2 + 2)', 'log(2) + log(2)')        // ok: a slip that happens to give a right line is never reported
```

`expandLog(text, vars?)`, `condenseLog(text, vars?)` — the textbook full expansion and the single-log form (app
syntax; `null` when unreadable / not one base); `isExpandedLog`, `isSingleLog` — the finished forms.
```ts
expandLog('log(x^2 y / n)', ['x', 'y', 'n'])   // '2log(x) + log(y) - log(n)'
expandLog('log_3(9x^4)')                       // '2 + 4log_3(x)'
expandLog('ln(e^(2x))')                        // '2x'
condenseLog('2log(x) + log(y) - log(n)', ['x', 'y', 'n'])   // 'log(x^2y/n)'
condenseLog('(1/2)log(x) - 2log(y)')           // 'log(sqrt(x)/y^2)'
isExpandedLog('log(x + 1) - 2log(x)')          // true (a sum inside a log cannot be expanded)
isExpandedLog('log(2x)')                       // false
isSingleLog('ln(x/y)')                         // true
```
Every expansion and condensation is a legal line from its start (tested), so either can be a canonical path.

`sameLogLine(a, b, vars?)` — the same line up to rewrites, judged on the domains (for `ModuleDef.progress`
anchoring; the engine's `sameLine` samples outside the log domain): `log(x(x − 3)) = 1` and `log(x^2 − 3x) = 1`
are the same line; `2^x = 8` and `x = 3` are not.

`decimalTolerance(d: DecimalSpec): number` — half a unit in the last place for `{ places }`.

### 3.2 Exact values

`logValue(text): LogValue | null` — `{ text, value, exact, exactText, rational }`: `logValue('log_4(8)')` has
`exactText '3/2'`; `logValue('log_2(7)')` has `rational: false`.

`gradeLogValue(problem: string, answer: string, opts?: { decimal?: DecimalSpec }): LogGrade`

```ts
type LogGrade =
  | { verdict: 'correct'; message; explanation }
  | { verdict: 'mistake'; mistake: LogMistakeId; pattern: PatternHit; witness; explanation }
  | { verdict: 'wrong'; message; explanation }          // never states the answer
  | { verdict: 'invalid'; reason: 'unreadable' | 'not_exact' | 'not_rounded' | 'not_in_form'; message; position?; length? }   // not an attempt
  | { verdict: 'unsupported'; message }                 // the PROBLEM is outside the model
```
```ts
gradeLogValue('log_2(8)', '3')       // correct; explanation ['log₂(8) asks: 2 to what power gives 8?', '2^3 = 8, so log₂(8) = 3.']
gradeLogValue('log_4(8)', '1.5')     // correct (1.5 IS 3/2)
gradeLogValue('log_2(8)', '4')       // log_value_divided: 'log₂(8) asks: 2 to what power gives 8? That power is 3. Dividing 8 by 2 answers a different question.'
gradeLogValue('log(0.001)', '3')     // log_value_sign: '0.001 is between 0 and 1, so it takes a negative power of the base: log(0.001) = −3.'
gradeLogValue('log_4(8)', '2/3')     // log_change_base_inverted
gradeLogValue('log_5(1)', '1')       // log_identity_misused
gradeLogValue('log(5) + log(20)', 'log(25)')   // log_sum_split
gradeLogValue('log_2(7)', '2.807')   // invalid, not_exact: '2.807 is a calculator approximation. This one has an exact value: …' (does not give it)
gradeLogValue('log_2(7)', '2.807', { decimal: { places: 3 } })   // correct
gradeLogValue('log_2(7)', '0.356', { decimal: { places: 3 } })   // log_change_base_inverted (log 2 / log 7)
gradeLogValue('log_2(7)', '0.544', { decimal: { places: 3 } })   // log_quotient_as_quotient (log(7/2))
gradeLogValue('log(7)', '1.946', { decimal: { places: 3 } })     // log_ln_confused (the LN key)
gradeLogValue('log_2(7)', '2.81', { decimal: { places: 3 } })    // invalid, not_rounded
```
Exact answers are compared in the exact model (`exact.ts`): values are power products ±∏p^r·e^r, log-linear
forms c + Σkₚ ln p, or ratios of those. The logs of distinct primes are linearly independent over Q, so log₂ 8 = 3,
log 0.001 = −3, ln(e⁵) = 5, e^(ln 7) = 7, 10^(log 7) = 7, log₆ 4 + log₆ 9 = 2 and log₂ 3 · log₃ 8 = 3 are exact,
and log₂ 7 is provably irrational (a decimal can never be exactly it). A decimal is accepted only with `decimal`.

`logValueMistakes(problem, opts?)` — what each slip gives for this problem, without the answer:
`logValueMistakes('log_2(8)')` is `[log_value_divided '4', log_value_sign '-3', log_change_base_inverted '1/3',
log_quotient_as_quotient '0.602059991328']` (the last is the calculator route log(8/2)). A slip that gives the
right answer here is left out (log₂ 4 = 2 = 4/2: no `log_value_divided`).

### 3.3 Exponential ⟷ log form

`readForm(text, vars?)` reads b^y = x (either side; e^y, exp(y), and √b as b^(1/2)) or log_b(x) = y into
`{ base, baseValue, exponent, result, form: 'exp' | 'log' }`; `convertForm(text)` gives the other form;
`logFormText(parts)`, `expFormText(parts)` print them.
```ts
convertForm('2^5 = 32')        // 'log_2(32) = 5'
convertForm('log_3(81) = 4')   // '3^4 = 81'
convertForm('e^(2x) = 7')      // 'ln(7) = 2x'
convertForm('ln(x) = 3')       // 'e^3 = x'
convertForm('10^(-2) = 0.01')  // 'log(0.01) = -2'
```
`gradeConvertForm(given, answer, vars?): LogGrade` — her answer must be the OTHER form with the same three parts.
```ts
gradeConvertForm('2^5 = 32', 'log_2(32) = 5')   // correct (also '5 = log_2(32)', 'logBASE(32, 2) = 5')
gradeConvertForm('2^5 = 32', 'log_5(32) = 2')
// log_convert_swapped: 'In 2^5 = 32 the base is 2, the exponent is 5 and the result is 32; in your answer the base and the
// exponent traded places. The log form is log₂(32) = 5.'
gradeConvertForm('log_3(81) = 4', '3 * 4 = 81') // log_convert_multiplied
gradeConvertForm('2^5 = 32', '2^5 = 32')        // invalid, not_in_form (still exponential form)
gradeConvertForm('log(x) = 2', 'x = 100')       // invalid, not_in_form (solved, not the asked form)
```
`convertMistakes(given)` — every swap of two parts (bases that are not a valid base are left out), plus b·y = x
for the exponential form: for `log_3(81) = 4`: `4^3 = 81`, `3^81 = 4`, `81^4 = 3`, `3 * 4 = 81`.

### 3.4 Equations and final answers

`analyzeLogEquation(equation, vars?): LogEquation | null`
```ts
interface LogEquation {
  equation: string; variable: string; kind: 'exponential' | 'logarithmic' | 'other'
  solutions: LogSolution[]              // { value, text, exact } ascending; always inside the domain
  algebraic: string | null              // the equation without logs a textbook solves: 'x(x - 3) = 10'
  candidates: LogSolution[]             // its solutions: real and extraneous
  extraneous: ExtraneousNote[]
  domain: Interval[]; domainText: string   // 'x > 3', 'x < 0 or x > 8', 'every real x'
  explanation: string[]                 // the worked solution (display text)
}
analyzeLogEquation('log(x) + log(x - 3) = 1')
// solutions [{ value 5, text '5', exact }], algebraic 'x(x - 3) = 10', candidates −2 and 5, extraneous −2 (log(x) fails),
// explanation ['Domain: every log needs a positive input, so x > 3.', 'Combine the logs and rewrite without them: x(x − 3) = 10.',
//   'Solve: x = −2 or x = 5.', 'x = −2 makes log(x) undefined: its input is −2, and a log needs a positive input. So x = −2 is extraneous.',
//   'Solution: x = 5.']
```
Exact solutions: a rational verified by exact substitution, a quadratic surd, or the closed form of the families
| equation | `solutions[0].text` |
|---|---|
| `2^x = 7` | `log(7)/log(2)` |
| `3e^(2x) + 1 = 13` | `ln(4)/2` |
| `5^(x - 1) = 12` | `log(12)/log(5) + 1` |
| `0.5^(x/5730) = 0.3` | `5730log(0.3)/log(0.5)` |
| `1000(1.05)^x = 2000` | `log(2)/log(1.05)` |
| `2^(x + 1) = 3^x` | `ln(2)/(ln(3) - ln(2))` |
| `4^x = 8^(x - 1)` | `3` |
| `e^(2x) - 5e^x + 6 = 0` | `ln(2)`, `ln(3)` (u = eˣ; a root u ≤ 0 is reported as giving no solution) |
| `log_3(x^2 - 8x) = 2` | `-1`, `9` (both valid: x itself may be negative) |
A single log term is divided, not raised: `5 + 2 ln x = 4` gives `x = e^(−1/2)` with no fake candidate −e^(−1/2).

`gradeLogEquation(equation, answer, opts?: { decimal?; vars? }): LogGrade` — her answer as `x = 5`, `5`,
`x = 5 or x = -2`, `x = 5, x = -2`, `x = 5 and x = -2`, `5, -2`, `{5}`, `no solution`/`none`/`∅`
(`parseSolutionAnswer` exposes the reader).
```ts
gradeLogEquation('log(x) + log(x - 3) = 1', 'x = 5')             // correct
gradeLogEquation('log(x) + log(x - 3) = 1', 'x = 5 or x = -2')
// log_extraneous_kept: 'x = −2 makes log(x) undefined: its input is −2, and a log needs a positive input. Check every answer
// in the ORIGINAL equation: x = −2 is extraneous.'
gradeLogEquation('log(x) + log(x - 3) = 1', 'x = 13/2')          // log_sum_split (log(2x − 3) = 1)
gradeLogEquation('log_3(x^2 - 8x) = 2', 'x = 9')
// log_valid_rejected: 'x = −1 keeps every log input positive (x^2 − 8x is 9), so it is a real solution. …'
gradeLogEquation('2^x = 7', 'x = ln(7)/ln(2)')                   // correct (any equal exact form)
gradeLogEquation('2^x = 7', 'x = log(2)/log(7)')                 // log_change_base_inverted
gradeLogEquation('2^x = 7', 'x = log_7(2)')                      // log_convert_swapped (same number, written as a swapped base)
gradeLogEquation('3^x = 20', 'x = 20/3')                         // log_convert_multiplied
gradeLogEquation('2 * 3^x = 18', 'x = log(18)/log(6)')           // log_exp_coefficient_base
gradeLogEquation('3^(2x) = 5', 'x = log(5/3)/2')                 // log_quotient_as_quotient (at 2x·log 3 = log 5)
gradeLogEquation('2^x = 7', 'x = 2.807')                         // invalid, not_exact
gradeLogEquation('2^x = 7', 'x = 2.807', { decimal: { places: 3 } })   // correct
gradeLogEquation('log_2(x) + log_2(x - 2) = 3', 'x = 7')
// wrong: 'x = 7 does not solve log(x,2)+log(x−2,2) = 3: the left side is 5.129 there and the right side is 3.'
gradeLogEquation('2^x = 7', 'no solution')   // wrong: 'This equation has a solution: check your algebra, then check each candidate in the original.'
```
Named mistakes are the answer sets each slip of the equation leads to (and, for exponential equations, of the
line u·log b = log q a textbook writes next, where the division slips happen); a candidate whose solutions
inside the domain are the right ones is a legal line and never listed. When two slips give the same set, the
earlier names it and the later is in `shadows`; an answer written as a quotient of logs reads as
`log_change_base_inverted` rather than a swapped base. `logEquationMistakes(equation)` lists the candidate sets
(`{ id, text, values, witness, shadows }`), first `log_extraneous_kept` when there is an extraneous candidate.

`exactLogValue(node)`, `exactEquals`, `exactIsRational`, `exactRational`, `exactToNumber` (types `ExactLogValue`)
expose the exact model for templates that pick nice numbers.

## 4. Mistake ids (all `ErrorPatternId`s with catalog entries in `src/engine/matchers/catalog.ts`)

`LOG_MISTAKE_IDS` lists the 22 mistakes; `log_check_answers` is the caveat (info, like `squaring_caveat`).

| id | the slip | where it fires | example (her line → named) |
|---|---|---|---|
| `log_sum_split` | log(a + b) = log a + log b, or log a + log b = log(a + b); logs of a sum taken term by term | rewrite, step, value, final answer | log(x + 2) → log x + log 2; 2^x + 3 = 7 → log 2^x + log 3 = log 7; log x + log(x−3) = 1 → x = 13/2 |
| `log_product_as_product` | log(ab) = log a · log b (and back) | rewrite, step, value | log(2x) → log 2 · log x |
| `log_quotient_as_quotient` | log(a/b) = log a / log b; log a / log b = log(a/b) or log a − log b | rewrite, step, value (calculator route), final answer | log(x/3) → log x / log 3; x log 2 = log 7 → x = log(7/2); log₂ 7 ≈ 0.544 |
| `log_power_as_power` | log(aⁿ) = (log a)ⁿ | rewrite, step, final answer | log(x³) → (log x)³; 3^(2x) = 5 → (log 3)^(2x) = log 5 |
| `log_coefficient_as_power` | n log a = (log a)ⁿ, and (log a)ⁿ = n log a | rewrite, step | 2 log x → log(x)² |
| `log_coefficient_inside` | n log a = log(na), and log(na) = n log a | rewrite, step | 2 log x → log(2x); 2 ln 3 − ln(x+1) → ln(6/(x+1)) |
| `log_change_base_inverted` | log_b a = log b / log a; dividing the wrong way at u·log b = log a | rewrite, step, value, final answer | log₂ 7 → log 2/log 7; log₄ 8 = 2/3; x log 2 = log 7 → x = log 2/log 7 |
| `log_identity_misused` | log_b b = 0, log_b 1 = 1 (ln e = 0, log 10 = 0 …) | rewrite, step, value | log₅ 5 → 0 |
| `log_power_abs` | ln(x²) = 2 ln x where x can be negative (domain lost) | rewrite (domain loss), step (lost solution) | ln(x²) = 4 → 2 ln x = 4 (loses x = −e²) |
| `log_exp_sum_split` | e^(a+b) = eᵃ + eᵇ (and back) | rewrite, step | e^(x+2) → e^x + e^2 |
| `log_exp_power_added` | (eᵃ)ᵇ = e^(a+b); eᵃ·eᵇ = e^(ab) | rewrite, step | (e^x)³ → e^(x+3) |
| `log_exp_negative_exponent` | b⁻ⁿ = −bⁿ | rewrite, step, value | 2^(−3) → −8; e^(−3x) → −e^(3x) |
| `log_exp_coefficient_base` | c·bᵘ = (cb)ᵘ | rewrite, step, final answer | 2·3^x = 18 → 6^x = 18 |
| `log_convert_swapped` | base and exponent (or result) swapped converting forms | step, convert, final answer | log₂ x = 5 → x = 5²; 2⁵ = 32 → log₅ 32 = 2; 2^x = 7 → x = log₇ 2 |
| `log_convert_multiplied` | log_b A = C → A = b·C; b^A = C → A = C/b; b^y = x → b·y = x | step, convert, final answer | log₂ x = 5 → x = 10; 2^x = 8 → x = 4 |
| `log_convert_dropped` | log_b A = C → A = C; b^A = C → A = C | step, final answer | log x = 2 → x = 2; log(x(x−3)) = 1 → x(x−3) = 1 |
| `log_one_side` | a log taken of one side only | step, final answer | 2^x = 7 → x log 2 = 7 |
| `log_extraneous_kept` | an answer that makes a log input ≤ 0 kept | final answer | x = 5 or x = −2 |
| `log_valid_rejected` | a real answer thrown out (typically because x is negative) | step, final answer | x = 9 for log₃(x² − 8x) = 2 (x = −1 is real) |
| `log_value_sign` | the sign of a log of a number between 0 and 1 | value | log 0.001 = 3 |
| `log_value_divided` | log_b a answered a/b | value | log₂ 8 = 4 |
| `log_ln_confused` | LN for LOG or LOG for LN (base e vs 10) | value (decimal), step, final answer | log 7 ≈ 1.946; log x = 2 → x = e²; e^x = 7 → x = log 7 |

Every detector compares her line with what the slip produces FOR THIS PROBLEM, and only after the line has been
judged not legal, so it can never fire on a right line (a randomized test pushes over 300 legal rewrites the
rules produce through the checker: none is flagged). A slip may be followed by legal rewriting, or come after one
legal step (log₄(5x³y) → product rule → (log₄ x)³), or two (products and quotients expanded, then a power slip);
for equations her line may also be any line with exactly the slipped line's solutions.

## 5. Decisions

- **log is base 10, ln base e**, as on her TI-84; math.js's own one-argument `log` (natural) is overridden in the
  engine's instance. Only `log1p` and `kldivergence` depend on math.js's `log`; the app uses neither.
- **Subscripts:** `log_b(…)` with an underscore, and digits glued to `log` followed by `(` (`log2(8)`). `log 2(8)`
  (with a space) is an error, not a guess.
- **Parenthesis-free logs** only take one number or one letter; anything longer is an error that asks for
  parentheses (the textbook reading of "ln 2x" is not universal).
- **Domain judgment** (§2): rewrites must hold on the previous line's whole domain (condensing is fine, ln(x²) →
  2 ln x is not, unless x > 0 is assumed); equation steps are judged inside the ORIGINAL's domain, with a caveat
  when a step lets in an extraneous candidate; inequalities on the whole line.
- **Decimals**: exact unless the problem passes `decimal`; then anything within half a unit in the last place.
  A decimal where the exact form is wanted is `invalid`/`not_exact` (final answers) or `notExact` (steps):
  not counted as a mistake, and the message does not state the exact answer.
- **A decimal that IS the exact value** (1.5 for 3/2, −0.500 for −1/2) is exact.
- **Shadows:** when two slips give the same answer the earlier id names it (conversion slips first, in the order
  dropped, swapped, multiplied; for r = 1 swapped and dropped coincide). An answer written as a quotient of logs
  is read as the inverted change of base.
- **Negative bases with a variable exponent** ((−2)^x, (log 0.5)^(x/5730)) are never generated as candidates:
  math.js takes about 15 ms per evaluation of one (it searches for a real root), and they are defined only at
  isolated points.

## 6. Notes for the content stage

- **Contexts.** Give every step of a log equation `original: <the problem's first line>`. Expand/condense
  templates that print "assume all variables are positive" pass `assumePositive: true` (to `checkLogRewrite` and
  to `checkLogStep`); without it, ln(x²) → 2 ln x is rejected with `log_power_abs`, which is the right lesson for
  equations. Decimal problems pass `decimal: { places: n }` to `checkLogStep`, `gradeLogValue` and
  `gradeLogEquation`.
- **Canonical paths.** `expandLog` / `condenseLog` give the expand/condense answers; `analyzeLogEquation(...)
  .explanation` is the worked solution; the anchor test (`logs.anchor.test.ts`) has 17 worked equation paths
  that pass line by line — copy their shapes.
- **Progress anchoring**: use `sameLogLine` (domain-aware) instead of the engine's `sameLine` for log lines.
- **Final-line test** for `ModuleDef.solved`: the line is `x = a` (or `x = a or x = b`) and
  `gradeLogEquation(original, line).verdict === 'correct'`.
- **Good traps:** a log equation whose method lets in an extraneous candidate (log x + log(x − 3) = 1,
  log₂ x + log₂(x − 7) = 3, ln(x − 2) + ln(2x − 3) = 2 ln x); one where a NEGATIVE answer is valid (log₃(x² − 8x)
  = 2, log(x + 5) = log 3) so `log_valid_rejected` can fire; exponential equations with a coefficient (2·3^x = 18)
  and with an added constant (2^x + 3 = 7) so the coefficient and sum slips are live; change of base with a
  decimal answer (log₃ 10) so the calculator slips are live.
- **Avoid:** exact-value problems whose slips coincide with the answer (log₂ 4: 4/2 = 2; check
  `logValueMistakes(p).length`), log equations with r = 1 when the question is about the swapped conversion
  (1^b = 1 is also "dropped"), exponents written as decimals that are halves (`e^(0.5)` is parsed as `sqrt(e)`;
  `readForm` still reads it, but print `e^(1/2)` in problems), and two-variable log equations (they go to the
  general checker).
- **Self-tests per seed** (as the earlier cores): every canonical line passes `checkLogStep` with `original`;
  `gradeLogEquation(eq, solutions)` is `correct`; each `logEquationMistakes(eq)` candidate grades as its own id
  (or one of its shadows); `gradeLogValue(p, logValue(p).exactText)` is `correct`.
- **Registration:** the ids are already in `ErrorPatternId` and the catalog; a grade's `pattern` is a ready
  `PatternHit` to record. `log_check_answers` is a caveat, like `squaring_caveat`: do not count it.

## 7. Open items for the reviewer

- **Chips.** There are no log property chips: adding ChipIds would change `ALL_CHIPS`, which every module's chip
  prompt and the Drill show. `logMove.properties` carries the log property; a log module can map it to chips of
  its own (additive `ChipId`s plus a separate chip order) if the flow wants the chip prompt.
- **Inverse functions with logs** (y = log₂(x − 1) → swap → y = 2^x + 1) have two variables and go to the general
  checker, which samples outside the log domain; not covered here.
- **Log inequalities** are checked (the domain must be in the line), but there is no final-answer grader for them.
- `e^2x` still means (e²)·x (calculator precedence, unchanged). A KaTeX preview of her line shows it.

## 8. Files changed and test runs

New: `src/engine/logs/` — `syntax.ts` (the input rewrite), `types.ts`, `text.ts`, `wide.ts` (wide grid, domains,
solution sets), `exact.ts` (exact model), `equiv.ts` (domain-aware comparison), `slips.ts` (expression slip
generators), `rules.ts` (legal rewrites, expand/condense, naming the property), `relslips.ts` (equation slips),
`rewrite.ts`, `step.ts`, `value.ts`, `convert.ts`, `solve.ts`, `index.ts`; tests `syntax`, `exact`, `wide`,
`rewrite`, `step`, `value`, `convert`, `solve`, `catalog`, `regression`, `logs.anchor`, `property`.
Changed: `src/engine/math.ts` (ln, log, logBase, LOG_FUNCS, `pos` in domainSubexpressions, the
normalizeOddRoots tolerance), `src/engine/parse.ts` (log rewrite, letter-run splitting, function-name check),
`src/engine/roots.ts` (`pos` boundaries), `src/engine/step.ts` (routing, `verifyStatementsGeneric`),
`src/engine/expressions.ts` (routing), `src/engine/index.ts` (export), `src/shared/types.ts` (23 ids, additive),
`src/engine/matchers/catalog.ts` (23 entries), `src/notation/toLatex.ts` and `src/notation/calcString.ts`
(log display), this document. No other file was touched.

Test runs (2026-10-18): `src/engine/logs` 12 files, 522 tests: syntax 25, exact 31, wide 27, rewrite 70, step 50,
value 40, convert 32, solve 54, catalog 3, regression 140 (the old parses), logs.anchor 44 (hand-worked), property
6 (seeded loops, 120 s timeout each; about 33 s together). `npm run typecheck` exit 0. Whole suite
(`node node_modules/vitest/vitest.mjs run`): 174 files, 2,995 tests passed, 303 s. A production bundle
(`vite build` into a scratch folder) builds; the core adds about 105 kB minified to the main chunk, which was
already over the 1,500 kB warning limit before this build.

## Log

- [done] semantics fix + corpus comparison (21,021 strings before/after) + regression fixture.
- [done] wide grid, domains, exact model, slip generators, legal rules, line checkers, graders.
- [done] tests: unit tests per file; 17 hand-worked equation paths plus 23 hand-worked values, conversions and
  expansions (anchor); five seeded cross-check loops (1,300 problems against independent oracles) plus a loop of
  300+ legal rewrites that must never be flagged.
- Found and fixed on the way: math.js has no `ln`; math.js's one-argument `log` is natural; the old
  `normalizeOddRoots` changed decimal exponents; float overflow of 2^x looked like a domain edge at x = 1024; both
  sides underflowing to 0 looked like solutions (2^(x+1) = 3^x "solved" at x = −10⁷); the engine's operand-scaled
  tolerance called 4·10⁻²⁸ and 3·10⁻⁸ equal; math.js is very slow on negative bases with variable exponents.
