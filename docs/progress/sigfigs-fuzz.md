# Significant figures — FUZZ / differential-check agent progress log

Scope: `src/engine/sweep/sigfigs-reference.ts` (independent reference) and
`src/engine/sweep/sigfigs-differential.sweep.ts` (opt-in sweep). Nothing under `src/engine/sigfigs` is edited.

Run: `node node_modules/vitest/vitest.mjs run --config vitest.sweep.config.mjs src/engine/sweep/sigfigs-differential.sweep.ts`

## Plan (2026-09-20)

- Read ONLY `docs/progress/sigfigs-engine.md`, `src/engine/sigfigs/index.ts` (export list) and the `SigFig*` types in
  `src/shared/types.ts` before the reference is written. Implementation files stay unread until then.
- Reference method (deliberately not string surgery): every value is an exact fraction n/d over BigInt.
  Figures are counted ARITHMETICALLY: first significant place = floor(log10 |v|) found by comparing n with
  d x 10^k; last significant place = (power of ten) - (fraction digits typed) when a point was typed, else
  (power of ten) + (10-adic valuation of the typed integer). sigFigs = first - last + 1. Rounding = integer
  division with remainder (tie when 2r = divisor). Digits of displays come from long division.
- The differential compares VALUES and PLACES, never canonical spelling: the engine's answer text is read back by
  the reference parser and must have the right value and the right last significant place.

## Log
- [done] `src/engine/sweep/sigfigs-reference.ts` (exact Frac over BigInt; refParse counts figures from places;
  refRoundToPlace / refRoundToSigFigs by integer division with remainder; refChain / refMixed; refStandard /
  refScientific spell a value so it shows a given last place; longDivision for displays).
- [done] `src/engine/sweep/sigfigs-differential.sweep.ts`: 11 tests, ~512,000 cases, 18 s. Anchors, 24,000
  adversarial numerals (fields, per-character significance/place/role, count tasks, taps), 3,000 numbers in 11
  spellings + refusal list + 20,000 keyboard-mash strings, rounding to every N (7,000 numerals, carries, sci
  results) and to every place, 12,000 constructed ties and near misses (also via products, eighths, finer sums),
  9,000 muldiv chains, 9,000 addsub chains (a third with cancelling subtraction), 8,000 mixed tasks with
  intermediate grading, 17 degenerate tasks, 4,000 conversions. Grader fuzz on every other task: canonical +
  alternates + reference spellings (+ spaces, + plus sign) must be correct; unrounded, truncated, one figure
  too many/few, dropped/padded zero must be wrong (each re-checked by the reference oracle first).
- Reference bugs found and fixed along the way: a taps variant that re-drew its index per element (so it
  sometimes removed nothing); a carry-chain generator that wrote two decimal points; refStandard refused
  whole numbers whose digit at the place is nonzero ("12000" good to the thousands IS standard).
- Sweep-side decisions: a zero result good to a place above the ones ("80 - 81" -> 0 to the tens) has no
  standard spelling, so its text is not checked (validate reports zero_result, generators skip it). Engine
  extensions beyond the spec grammar ("x10-3", superscripts, parentheses) are not judged. The scientific twin
  of a whole number is only REQUIRED when standard digits cannot show the figures (rule 11).

## Findings (engine side; the sweep fails on these until fixed)

1. Calculator display pads zeros past 12 digits: `1e13 / 3` -> unrounded "3333333333330…" (true digits
   3333333333333.33…). Shows a false digit; same in `intermediates[].unrounded`. Only for |value| >= 1e12.
   Suggest E-notation past 12 digits, or more digits. LOW.
2. Alternates the engine cannot read back: `round 1e-30 to 1 s.f.` offers alternate
   "0.000000000000000000000000000001" (31 digits) and `gradeSigFigAnswer` answers parse_error ("more digits than
   any measurement has") when it is typed. Same for `6.022e23 * 2.0e8` (alternate 33 digits). The limit counts
   leading/placeholder zeros. Suggest dropping alternates over the limit or counting only significant digits. LOW.
3. `evaluateSigFigTask({kind:'round', text:'4.0e30', sigFigs:2})` throws a plain Error ("cannot read number
   4000…") and `validateSigFigTask` reports it `invalid`, although `roundToSigFigs('4.0e30', 2)` works and
   `round 1e30 to 1 s.f.` evaluates fine. Some 30+-digit plain expansion is re-parsed internally. LOW-MEDIUM.
4. (not a sweep failure) On a ROUND task, answering with the unrounded input ("round 59 to 1 s.f." -> "59")
   gets the plain message "Your arithmetic is right, but you kept more digits than the measurements support.
   Find the measurement that limits the answer…": there is no arithmetic and no measurement in a rounding
   drill. Voice only. On calculation tasks the whole calculator value is always named sf_unrounded (verified).

Conventions the spec leaves open (engine choice accepted by the reference, noted for the record):
- Non-normalized scientific notation without a point: "10e2" / "120 x 10^3" read as 1 / 2 figures (rules 1-4
  applied to the coefficient) although rule 5 literally says every coefficient digit counts. Normalized
  coefficients (what the app writes) are unaffected.
- A group that rounds to zero inside a mixed task: validate says zero_result but evaluate throws (a plain
  5.26 - 5.26 evaluates to "0.00"). Generators skip both; harmless.

Everything else agreed on all cases: counting, per-digit roles, rounding (value, place, direction, first
dropped digit, truncation), tie detection (roundToSigFigs, roundToPlace, evaluate, validate), muldiv/addsub
limits and limiting terms, mixed intermediates and their grading, conversions, degenerate-task refusal,
grader accept/reject on every planted answer.

## Unfinished
- Nothing pending on the sweep. Once findings 1-3 are fixed (or explicitly accepted), the three op names in
  the file header can be relaxed and the sweep goes green.
