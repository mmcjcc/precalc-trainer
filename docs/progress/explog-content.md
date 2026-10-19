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

## Second half (Claude, 2026-10-19): graphs, inverses, growth and decay

Two more modules in `unit3`, on branch `precalc-explog-models` (working copy `C:\work\explog`, uncommitted on top of
450f666). Gemini 4 had started this and stopped at its quota (450f666: 34 type errors, no tests). Kept from it: the
registration edits (`courses.ts` and its test, `modules/index.ts`, `Home.test.tsx`, the `Problem.tsx` dispatch, the
`tutorContext.ts` wiring), the module titles and orders, and the parts-one-at-a-time frame. Replaced: both generators
(they drew principals, rates and half-lives from fixed lists; witnesses stated the answer, e.g. "so the range is
(k, ∞)"; the log "base" distractor drew the same graph as the sign one; no trap was checked against the answer at
the rounding asked), both graders, the content types, both flows, the catalog wording and the ids. Nothing under
`src/engine/` was edited except the new `exp_` catalog entries.

### What shipped

- `expLogGraphs` — "Graphs of exponential and logarithmic functions".
  - `eg.features`: f(x) = a·b^(x − h) + k (bases 2–5, 1/2–1/5, 2/3, 3/2, 3/4, 4/3, 2/5, 5/2, e) or
    g(x) = a·log_b(x − h) + k (2, 3, 4, 5, 10, e, 1/2, 1/3), |a| ≤ 3, k ≠ 0 for an exponential and h ≠ 0 for a log.
    Five parts, one at a time: domain and range (read with `parseSetAnswer`: interval notation, an inequality,
    set-builder, "all real numbers"), the asymptote as an equation, the intercept as an exact point (fractions,
    powers and e stay exact: (0, 10/3), (e + 2, 0); a calculator decimal is not an attempt), and increasing or
    decreasing (radio). Promised traps: y = 0 kept after the shift (`exp_asymptote_unshifted`), x = −h for
    log(x + h) (`exp_shift_sign`), y > k when a < 0 (`exp_sign_of_a`), a log's domain with ≥
    (`exp_endpoint_closed`), and an intercept with a shift left out (`exp_intercept_shift`); named but less often
    promised: domain and range swapped, the asymptote on the wrong axis, the base direction, x − h = m with the log
    erased (`log_convert_dropped`).
  - `eg.match`: four graphs for an equation, or four equations for a graph, differing by the sign of a, the base
    above or below 1, and the direction of a shift; every pair is at least a unit apart somewhere on screen. For a
    log, base 1/b IS the reflection (log_(1/b) u = −log_b u), so a log's fourth candidate reverses the vertical
    shift instead; in equation mode the reflection is written either as −a or as base 1/b, named by how it is
    written. Candidate graphs are labelled "Graph A" … "Graph D" for a screen reader, not by their formula.
  - `eg.inverse`: f⁻¹ of a shifted exponential (a log) or of a shifted log (an exponential), bases 2, 3, 4, 5, 10,
    e, a ∈ {1, 2, 3, −1, −2}. Graded by composition, never by spelling: g(f(x)) = x at samples of the domain,
    f(g(y)) = y at samples of the range of f, and exact spot checks with the logs core's exact model at rational
    points (f(h) = a + k, f(h + 1) = ab + k). Every equal form is right: log_2(x − 3) + 1, ln(x − 3)/ln(2) + 1,
    1 + logBASE(x − 3, 2). Traps: the shifts copied (`exp_inverse_shift`), the base and the input swapped
    (`exp_inverse_base_swapped`: log_(x − 3)(2) + 1, or (x − 1)^2 + 3 going back), the reciprocal
    (`exp_inverse_reciprocal`).
- `expModels` — "Exponential growth and decay". The textbook sentence, ending with how to round.
  - `em.interest`: the balance to the cent, the time to reach a balance, or the doubling time. P $500–$15,000,
    2%–8% in quarter points, annually, semiannually, quarterly, monthly or continuously, 2–30 years; times at most
    40 years. Traps: n for another period (each one), simple interest, continuous for periodic and periodic for
    continuous, the exponent without n (and nt left undivided when solving for t), r as the percent. The percent
    slip is a candidate only for times: on a balance it gives more than 10^9 dollars, which nobody types.
  - `em.halflife`: the amount left, the time to decay to an amount, carbon-14 ("contains p%" or "has lost q%";
    h = 5730), the half-life from two measurements. Half-lives 2–24 hours, 3–60 days, 5–90 years. Traps: h/t
    (`exp_halflife_inverted`), the fraction left as the base, which gives t = h (`exp_halflife_base`), the amount
    decayed (A₀ − A, or 1 − q) (`exp_halflife_decayed`).
  - `em.growth`: P = P₀e^(kt) for bacteria (hours) or a town (years). (a) k exactly: any equal exact form
    (ln(3/2)/4, ln(1.5)/4, (ln 270 − ln 180)/4, 0.25 ln 1.5); a decimal is not an attempt. (b) k to four places.
    (c) a prediction or the time to reach a size, where the exact k and the rounded k are both right. Traps:
    (P₁/P₀)/t (`exp_growth_no_log`), ln(P₁ − P₀)/t (`exp_growth_log_diff`), t/ln(P₁/P₀): the time and the size
    trade places in the division (`exp_growth_swapped`), and the core's `log_ln_confused` (the LOG key) and
    `log_quotient_as_quotient` (ln P₁/ln P₀).

### How a part is checked

Both modules share one part grader, `src/content/modules/explog/parts.ts`: intervals through `parseSetAnswer`;
lines x = n or y = n; points coordinate by coordinate; choices; formulas by composition; exact values with
`gradeLogValue`; every rounded number with `gradeLogValue` and `{ decimal: { places } }` on the problem's closed
form, so a value within half a unit of the last place is right, a shorter rounding is "rounded too far", and the
exact expression is "round it" (neither is an attempt). Then her number is compared with this problem's traps at
the places asked; a coarser answer names a slip only when exactly one slip fits. A dollar answer reads "$2,834.71",
"2834.71", "2,834.71", "2834.71 dollars" and "A = 2834.71"; other numbers take "t =", a unit word and thousands
commas. The core's messages are not shown: its "X is not <closed form>" spells the setup, which is the answer one
keypress away.

Every trap is computed for the problem in hand, and a rounded part is dropped when any trap rounds to the answer
or to another trap at the places asked. The generator grades each part's answer and the promised trap; the
300-seed tests grade every trap. Texts are checked part by part: a part's question, hint, nudge, the sentences
and catalog entries of its traps and its plain note never spell that part's answer or a later one; the prompt,
the instructions and every rule card never spell any. A choice's answer (increasing or decreasing, a letter) is not
searched for: the options are on the screen.

### Ids are exp_, the graphs and inverses too

The brief asked for log_ ids for graphs and inverses. `src/engine/logs/catalog.test.ts` asserts that every log_
id in the catalog is one of the core's 22 mistakes or its caveat, and `src/engine/logs/types.ts` defines
`LogMistakeId` as every log_ `ErrorPatternId`, so a content log_ id would fail that test and silently join the
core's type. Both files are under `src/engine/`, so all 22 new ids are exp_:
`exp_asymptote_unshifted`, `exp_shift_sign`, `exp_sign_of_a`, `exp_endpoint_closed`, `exp_domain_range_swapped`,
`exp_asymptote_axis`, `exp_intercept_shift`, `exp_base_direction`, `exp_inverse_shift`, `exp_inverse_base_swapped`,
`exp_inverse_reciprocal`, `exp_rate_percent`, `exp_wrong_period`, `exp_simple_interest`, `exp_continuous_swapped`,
`exp_exponent_missing`, `exp_halflife_inverted`, `exp_halflife_base`, `exp_halflife_decayed`, `exp_growth_no_log`,
`exp_growth_log_diff`, `exp_growth_swapped`. Catalog examples use base 7, shifts 8 and 9 (never drawn) or letters.

### Outside the two modules

- `src/notation/toLatex.ts`: a factor whose TeX starts with a digit now gets a `\cdot`. Before, `5 * 7^x = 1715`
  rendered as 57^x = 1715 and `4^x - 9 * 2^x + 8 = 0` as 4^x − 92^x + 8 = 0: 13 distinct `ee.exponential`
  equations in the first 300 seeds, and the two-base `ee.quadratic` problems, showed a different equation from the
  one graded. Test: `src/notation/toLatex.test.ts`. The statements of this half build their TeX from the parameters.
- `GraphSpec.ariaLabel` (additive, `src/shared/types.ts`), read by `src/components/Graph.tsx`.
- `src/content/types.ts`: `ExpLogPart`, `ExpLogPartKind`, `ExpLogPartTrap` and the two AnswerSpec arms, replacing
  Gemini's.

### Checks

`npm run typecheck` passed (all three configs). Whole suite with `--maxWorkers=4`: 193 files, 3,232 tests, all
green (437 s). `vite build --outDir C:\work\tmp\explog-dist` passed (the existing chunk-size warning only).

New tests, every seeded loop with a 120 s timeout (alone, none takes more than 19 s):
- `expLogGraphs/expLogGraphs.test.ts`, `expModels/expModels.test.ts`: each template over 300 seeds is deterministic,
  every part's answer and every accepted spelling grades right ($, commas, units, "t =", inequalities, "all real
  numbers"), every trap grades as its own id and, for rounded parts, differs from the answer and the other traps at
  the places asked; the promised trap is one of them; nothing she sees before a part is answered spells it; at least
  25 distinct problems and no answer above 10% of seeds; the brief's traps are all promised somewhere in the run.
- `explog2.hand.test.ts`: 24 tests of hand-worked textbook problems, each answer checked against Math in the test
  ($1,000 at 5% monthly for 10 years is $1,647.01; carbon-14 with 25% left is 11,460 years; the inverse of
  2^(x − 1) + 3 is log_2(x − 3) + 1; doubling at 6% continuously in 11.55 years; 250 g, 12-day half-life, 44.19 g
  after 30 days; k = ln(3/2)/4 in six spellings; the features of −2·3^(x − 1) + 4 and log_2(x + 3) − 1; …), with
  the slips each gives.
- `explog2.review.test.ts`: 2000 seeds per template: no catalog example or lesson, rule card, format hint or
  instruction contains an answer, and part by part no early text does; every exp_ id has a catalog entry in the
  voice (two or three sentences, a ✗ example), and the catalog's exp_ ids are exactly these 22.
- `explog2.crosscheck.test.ts`: an independent re-solve of 300 seeds per template: graph features read off samples
  of f (no use of a, b, h, k), inverses composed numerically, matching candidates compared with f, and every word
  problem solved again from the numbers in its sentence (times by bisection on the model, not the closed form).
- `pages/flows/ExpLogPartsFlow.test.tsx`: 20 jsdom tests: per template a named mistake (catalog title, lesson,
  example, witness; one record even when checked twice) then the fix, completion with the worked answer (and the
  graph for features and inverses); an unreadable answer or an empty choice records nothing; a reload restores the
  entry and the part she is on; the hint ladder per part, rung 3 marking the answer shown.
- `problem/tutorContext.test.ts`: one more case (work part by part, the match candidates for the tutor, the verdict).
- `notation/toLatex.test.ts`: the dot between a number and a power of a number.

Seed-1 URLs (each shows the named trap):

- `#/p/expLogGraphs/eg.features/1` — `exp_intercept_shift` on f(x) = 2·4^x − 6: y-intercept (0, 2), the − 6 left out
  (the answer is (0, −4)).
- `#/p/expLogGraphs/eg.match/1` — `exp_shift_sign` on g(x) = −log₄(x − 4) + 1, pick the graph: graph D is shifted
  the other way.
- `#/p/expLogGraphs/eg.inverse/1` — `exp_inverse_shift` on f(x) = 2log₂(x − 1) + 2: 2^((x − 1)/2) + 2, the shifts
  copied (the answer is 2^((x − 2)/2) + 1).
- `#/p/expModels/em.interest/1` — `exp_exponent_missing` on $5,500 at 7.75% compounded continuously for 17 years:
  5,943.20, e^r without the t (the answer is $20,537.41).
- `#/p/expModels/em.halflife/1` — `exp_halflife_inverted` on a bone with 24% of its carbon-14: 2783, from h/t (the
  answer is 11,797 years).
- `#/p/expModels/em.growth/1` — `exp_growth_no_log` on 700 bacteria growing to 1330 in 7 hours: k ≈ 0.2714, the
  ratio over the time without ln (the answer is 0.0917).

### Not changed (noted)

- `gradeLogValue` builds the core's own slip list on every call, also on a decimal problem where only the tolerance
  matters; it is most of the generation time (about 5 ms per growth problem).
- An exponential's horizontal reflection, a(−x), and stretches inside the function are not drawn; the brief's
  three differences are.
- Balance problems never name the percent slip (its value is beyond anything typed).
