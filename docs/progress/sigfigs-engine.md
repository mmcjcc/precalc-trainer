# Significant figures — ENGINE agent progress log

Scope: `src/engine/sigfigs/**`, `sf_*` ids in `src/shared/types.ts` + `src/engine/matchers/catalog.ts`,
additive shared types, re-exports in `src/engine/index.ts`. No module id / problem kind / templates / UI.

## Plan (2026-09-20)

Files (all BigInt / digit strings, no floats in the arithmetic):
- `decimal.ts`  exact Dec (int x 10^exp) and Rat (n/d) arithmetic, rounding with tie detection, text output
- `parse.ts`    typed numeral -> SigFigNumeral (roles per character, counts, places) or ParseError
- `format.ts`   pretty display (x 10^3 -> × 10³), place names
- `round.ts`    roundToSigFigs / roundToPlace + canonical answer text (rule 11)
- `evaluate.ts` evaluateSigFigTask / validateSigFigTask / expression text / explanation steps
- `mistakes.ts` what each named mistake WOULD produce for a task
- `grade.ts`    gradeSigFigAnswer / gradeSigFigTaps / gradeSigFigIntermediate
- `index.ts`    public surface, re-exported from `src/engine/index.ts`

Decisions so far:
- Shared task/result types carry TEXT only (JSON-safe for the store); BigInt stays inside the engine.
- Zero-valued numerals ("0", "0.00"): no digit is significant, sigFigs = 0, isZero = true, every zero has role
  leading_zero; lastSigPlace = place of the last WRITTEN digit so add/subtract can still land on "0.00".
- Scientific notation: rules 1-4 are applied to the coefficient; for a normalized coefficient that makes every
  digit significant (rule 5). "10 x 10^2" (not normalized, no decimal point) therefore reads as 1 s.f.
- Invalid TASKS (generator bugs) throw; student input never throws (parse errors are values).

## Log
- [done] shared types: 19 `sf_*` ErrorPatternId values + SigFig* types appended to `src/shared/types.ts` (additive only).
- [done] `decimal.ts`, `format.ts`, `parse.ts`, `round.ts`, `evaluate.ts` written (not yet compiled/tested).
- Decision: bare digits after "x 10" are refused ("2.5 x 100" must not mean 2.5 x 10^0); "x10^3", "x10-3",
  "x10+3", "×10³", "e3" are accepted. A UI "×10ⁿ" button can insert "e" or "×10^" so no caret/letter key is needed.
- Decision: mixed tasks are modelled as an outer chain whose operands are terms or groups (a group uses the
  other family), which covers (a+b)/c, a*b - c, (a+b)/(c-d), a*b + c*d.
- Tooling note: long Bash heredocs containing quotes fail in this harness ("unexpected EOF"), so source files
  were written with the Write tool instead.
- [next] `mistakes.ts`, `grade.ts`, `index.ts`, catalog entries, engine/index.ts re-exports, tests.
- [done] `mistakes.ts`, `grade.ts`, `text.ts`, `index.ts`; 19 catalog entries in `matchers/catalog.ts`;
  `export * from './sigfigs'` added to `src/engine/index.ts`. `npm run typecheck` passes.
- [next] tests: parse / round / evaluate / grade / property. TODO: replace the placeholder example text of
  `sf_rounded_early` in the catalog with one verified by the engine.
- [done] `parse.test.ts` (59 tests) and `round.test.ts` (21 tests) green. Reviewed the explanation text and the
  mistake table by printing ~20 tasks; refined wording; catalog example for `sf_rounded_early` verified by the
  engine: (11.07 + 1.1) x 2.115 -> 25.7, early rounding gives 25.8.
- Decision: the scientific twin is not listed as an alternate when its power would be 10^0 ("4.8 x 10^0");
  it is still ACCEPTED when typed, since grading is by value + last significant place.
- [next] `evaluate.test.ts`, `grade.test.ts`, `property.test.ts`; delete `src/engine/sigfigs/__scratch/`.
- [done] `evaluate.test.ts` (33), `grade.test.ts` (45), `property.test.ts` (6: 3000 numerals vs an independent
  string oracle, 2000 roundings, 500 constructed ties, 500 place roundings, 4000 seeded tasks). All green.
  Scratch folder removed.
- Decision: `sf_unrounded` fires when the answer is the whole (terminating) calculator value, or matches the
  display with >= 3 figures too many; 1-2 extra figures with right digits is the plain "kept more digits than
  the measurements support" message (unless it is exactly what `sf_most_precise` / a wrong rule produces).
- Note: for a SUM, "as far as the most precise term" equals the full calculator value, so `sf_unrounded` wins
  there; `sf_most_precise` shows up on multiply/divide and on the intermediate question.
- [next] full typecheck + `vitest run src/engine`, API notes below.

## Final state (2026-09-20)

`npm run typecheck` passes. `node node_modules/vitest/vitest.mjs run src/engine` passes (11 files, 286 tests;
the sigfigs folder alone is 5 files / 164 tests). Full suite: 33 files / 467 tests green.
Nothing committed. No module id, problem kind, template or UI was added (later agents).

Files: `src/engine/sigfigs/{decimal,format,parse,round,evaluate,mistakes,grade,text,index}.ts` and
`{parse,round,evaluate,grade,property}.test.ts`; 19 `sf_*` ids + `SigFig*` types in `src/shared/types.ts`;
19 entries in `src/engine/matchers/catalog.ts`; `export * from './sigfigs'` in `src/engine/index.ts`.

## API for the next agents (import everything from `@/engine`; types from `@/shared/types`)

All numbers cross the API as TEXT (or small integers such as a count or a place). Tasks and results are plain
JSON, safe for the store. "place" is always a power of ten: -2 hundredths, -1 tenths, 0 ones, 1 tens, 3 thousands.

### Types (in `@/shared/types`)

```ts
type SigFigOp = '+' | '-' | '*' | '/'
interface SigFigTerm { text: string; exact?: boolean; note?: string }     // note: "counted", "defined: 100 cm = 1 m"
interface SigFigGroup { terms: SigFigTerm[]; ops: SigFigOp[] }            // one family of ops
type SigFigOperand = SigFigTerm | SigFigGroup
type SigFigTask =
  | { kind: 'count'; text: string }
  | { kind: 'round'; text: string; sigFigs?: number; place?: number }     // exactly one of the two
  | { kind: 'muldiv'; terms: SigFigTerm[]; ops: SigFigOp[] }              // ops.length = terms.length - 1, left to right
  | { kind: 'addsub'; terms: SigFigTerm[]; ops: SigFigOp[] }
  | { kind: 'mixed'; operands: SigFigOperand[]; ops: SigFigOp[] }         // outer ops one family, every group the OTHER family
  | { kind: 'convert'; text: string; to: 'scientific' | 'standard' }
```
Mixed examples: `(a + b) / c` = `{kind:'mixed', operands:[{terms:[a,b],ops:['+']}, c], ops:['/']}`;
`a * b - c` = `{kind:'mixed', operands:[{terms:[a,b],ops:['*']}, c], ops:['-']}`; two groups are allowed.

Also: `SigFigNumeral` (+ `SigFigChar`, `SigFigCharRole`), `SigFigEvaluation` (+ `SigFigLimit`, `SigFigExpected`,
`SigFigIntermediate`), `SigFigRounding`, `SigFigGrade`, `SigFigTapGrade` (+ `SigFigTapFeedback`),
`SigFigTaskIssue`, `SigFigMistakeCandidate`. Read the doc comments in `src/shared/types.ts`; the key fields:

- `SigFigNumeral`: `text`, `display` ("1.20 × 10³"), `sigFigs`, `sigDigits`, `firstSigPlace`, `lastSigPlace`,
  `hasDecimalPoint`, `scientific`, `normalized`, `exponent`, `isZero`, `negative`, `value` (plain exact text),
  `chars[]`. Each `chars[i]` = `{ ch, index (= i), role, significant, digit (tappable), place?, rule }` with role one of
  `sign | nonzero | leading_zero | captive_zero | trailing_zero_decimal | trailing_zero_placeholder | decimal_point | exponent`.
- `SigFigEvaluation`: `expression` ("12.50 ÷ 4.1"), `unrounded` ("3.04878048780…"), `unroundedTerminates`,
  `limit { rule, termIndices, sigFigs, place, placeName, text }`, `expected { text, display, alternates, value, sigFigs, place }`,
  `tie`, `rounding`, `intermediates[]`, `steps[]` (the explanation: show after a correct answer or as the rung-3 reveal).
- `SigFigGrade`: `status: 'correct' | 'wrong' | 'parse_error'`, `message` (always set), `pattern?` (a `PatternHit`
  with `witness`; log `pattern.id` to the store), `parseError?` (`position` indexes the text she typed), `note?`, `parsed?`.

### Functions

```ts
parseSigFigNumeral(text: string): { ok: true; numeral: SigFigNumeral } | { ok: false; error: ParseError }
//  parseSigFigNumeral('0.00450')  → ok, numeral.sigFigs === 3, numeral.chars[6].role === 'trailing_zero_decimal'
//  parseSigFigNumeral('12,000')   → { ok:false, error:{ message:'Leave the commas out…', position:2, length:1 } }
//  Accepted: 12.50  .5  40.  -3  −3  +3  1.2e3  1.2E-4  1.2x10^3  1.2 x 10^-3  1.2×10^(−3)  1.2*10^3  1.2 × 10³  1.2x10-3
//  Refused with a position: commas, units/words, fractions, a space inside the number, two points,
//  an unfinished power of ten, "2.5 x 100" (bare digits after the 10), more than 30 SIGNIFICANT digits
//  (placeholder zeros do not count: "0.000…001" with 31 digits is fine), |power| > 99.

countSigFigs(text: string): number                     // throws if not a numeral.   countSigFigs('1200.') === 4

roundToSigFigs(text: string, n: number): SigFigRounding
//  roundToSigFigs('1999', 2)   → { text:'2.0 x 10^3', display:'2.0 × 10³', alternates:[], value:'2000', sigFigs:2, place:2,
//                                  tie:false, direction:'up', truncatedText:'1900', firstDropped:9, exact:'1999' }
//  roundToSigFigs('12345', 2)  → text '12000', alternates ['1.2 x 10^4'];  roundToSigFigs('2.5', 1).tie === true
roundToPlace(text: string, place: number): SigFigRounding
//  roundToPlace('31.123', -1).text === '31.1'

evaluateSigFigTask(task: SigFigTask): SigFigEvaluation          // throws SigFigTaskError on a malformed TASK
//  evaluateSigFigTask({ kind:'muldiv', terms:[{text:'12.50'},{text:'4.1'}], ops:['/'] })
//    → expected.text '3.0', unrounded '3.04878048780…', limit.text '4.1 has the fewest significant figures (2).',
//      limit.termIndices [1], tie false, steps [5 sentences]
validateSigFigTask(task: SigFigTask): SigFigTaskIssue[]         // never throws; [] = usable
//  codes: 'invalid' | 'tie' | 'zero_result' | 'intermediate_carry' | 'not_representable'
//  GENERATORS: reseed whenever this is non-empty (rule 10: never show a tie).
//  validateSigFigTask({ kind:'round', text:'2.5', sigFigs:1 }) → [{ code:'tie', … }]
sigFigTaskExpression(task): string                              // '(12.11 + 1.3) ÷ 2.0'
sigFigTaskTerms(task): SigFigTerm[]                             // reading order; what limit.termIndices index into

gradeSigFigAnswer(task: SigFigTask, answer: string): SigFigGrade
//  count tasks: answer is a whole number ('3'). Everything else: a numeral in any accepted spelling.
//  gradeSigFigAnswer(div, '3.0') → correct;  '3' → wrong, pattern.id 'sf_dropped_zero';  '3.0 g' → parse_error (position 4)
//  gradeSigFigAnswer({kind:'round',text:'1999',sigFigs:2}, '2000') → wrong, 'sf_ambiguous_zeros';  '2.0e3' → correct
gradeSigFigTaps(text: string, selected: readonly number[]): SigFigTapGrade
//  selected = the `index` of every digit she marked significant (indices of non-digits are ignored)
//  gradeSigFigTaps('0.00450', [2,3,4,5]) → correct:false, digits[] (one per tappable digit, with ok / rule / patternId),
//    patterns [sf_leading_zeros, sf_trailing_zeros_decimal], message = first witness
gradeSigFigIntermediate(task, intermediateIndex: number, response: { sigFigs?: number; place?: number }): SigFigGrade
//  index into evaluateSigFigTask(task).intermediates; pass whichever of sigFigs / place the UI asked about
//  gradeSigFigIntermediate(sumThenDivide, 0, { sigFigs: 3 }) → correct;  { sigFigs: 2 } → 'sf_muldiv_rule_on_addsub'
sigFigMistakeCandidates(task): SigFigMistakeCandidate[]         // { id, text, witness }[]
//  realistic wrong answers, each already run through the grader, so `id` is exactly what she would be told.
//  Use for distractors, or to pick tasks that CAN expose a mistake (e.g. keep a mixed task only if it has
//  an 'sf_rounded_early' candidate).   sigFigMistakeCandidates(round1999) → 2000/sf_ambiguous_zeros, 1900/sf_truncated, 20/sf_lost_placeholders …

composeSigFigText(coefficient: string, power: string): string   // ('2.0','3') → '2.0 x 10^3'; ('2.0','') → '2.0'
prettySigFig(text: string): string                              // '1.20e3' → '1.20 × 10³'; unreadable text comes back unchanged
sigFigPlaceName(place: number): string                          // -2 → 'hundredths', 0 → 'ones', 3 → 'thousands'
class SigFigTaskError extends Error { code: SigFigTaskIssue['code'] }
```

### Grading policy (rule 11)

Correct = same VALUE as the correctly rounded result AND the last significant digit in the expected place
(for a nonzero value that is the same thing as "has the expected number of figures"). So any spelling works:
`12000`, `1.2e4`, `1.2 x 10^4`, even `12e3` (correct, with a gentle `note` about tidy scientific notation).
Convert tasks additionally require the target notation (scientific must be normalized).
Order of diagnosis for a wrong value answer: whole terminating calculator value (`sf_unrounded`) → exact rule-level
candidates (`sf_rounded_early`, `sf_exact_limited`, `sf_addsub_rule_on_muldiv` / `sf_muldiv_rule_on_addsub` on the
last step or inside a group, `sf_most_precise`, `sf_places_not_figures`) → right value but wrong figures
(`sf_ambiguous_zeros`, `sf_dropped_zero`, `sf_extra_zeros`) → long calculator display (`sf_unrounded`) →
`sf_truncated` → `sf_lost_placeholders` → plain messages (wrong size by a power of ten; right arithmetic but too
many / too few figures; "the digits themselves are off, so recheck the arithmetic"). Plain messages carry NO pattern id.
Count answers: `sf_placeholder_zeros`, `sf_leading_zeros`, `sf_trailing_zeros_decimal`, `sf_captive_zero`, else plain.
Convert answers: `sf_sci_form`, `sf_sci_changed_figures`, `sf_sci_exponent`, else plain.

Pattern ids added (19): the 15 requested plus `sf_most_precise` (matched the most precise number instead of the
least), `sf_places_not_figures` (N decimal places instead of N figures), `sf_sci_exponent` (power of ten wrong
size/sign) and `sf_sci_form` (coefficient not between 1 and 10).

### Conventions decided here

- Canonical text: standard notation when it can show the figures, else scientific ("2.0 x 10^3"); a whole number
  whose last significant digit is a zero in the ones place gets a trailing point ("2000."), scientific twin listed in
  `alternates`. Values with first digit above the millions or below the hundred-thousandths put scientific first.
  The scientific twin is not LISTED when its power would be 0, but is still accepted.
- Zero: a zero-valued numeral has `sigFigs 0`, every zero is `leading_zero`, and `lastSigPlace` is the last written
  place. A zero result (5.26 − 5.26) expects "0.00"; `validateSigFigTask` reports `zero_result` so generators can
  skip it. Count / round-to-figures / convert tasks on zero, and a measured zero as a factor, throw.
- Scientific notation: rules 1-4 are applied to the coefficient ("10 x 10^2" reads as 1 figure); a normalized
  coefficient therefore has every digit significant (rule 5).
- Mixed tasks: a group's figure count / place is taken from the group ROUNDED to its own precision (for counting
  only; its full value is carried forward). When that rounding carries into a new digit (9.97 → 10.0) the count is
  debatable, and `validateSigFigTask` reports `intermediate_carry`.
- `SigFigGrade.message` equals `pattern.witness` when a pattern is present; `pattern.lesson` / `pattern.example`
  come from the catalog. `evaluation.steps` reveals the answer, so keep it for after-correct or rung 3.
- UI input: `type="text"` with `inputMode="decimal"` loses the minus key on iOS; either offer ± and ×10ⁿ buttons
  or use `composeSigFigText(coefficientBox, powerBox)`. The parser accepts "e", "x10^", "×10^", "*10^", "×10³".

### Unfinished / for later agents

- `docs/BUILD_GUIDE.md` (§0 table, §4 API list) does not mention sig figs yet: not mine to edit.
- `ModuleId`, `ProblemKind`, `AnswerSpec`, templates, hints (rungs 1-2), flow UI, Progress grouping of `sf_*` ids.
- Not modelled: counting figures of exact numbers (infinite), round-half-even (ties are simply never generated),
  logarithm / pH figure rules, more than one level of nesting.

## Fuzz fixes (2026-09-20)

The differential sweep (`docs/progress/sigfigs-fuzz.md`) reported five disagreements. Reproduced all five first
(scratch test, since removed); baseline: engine suite 286 green, sweep 4 of 11 tests failing on exactly the
three reported op families (unrounded 101, engine-text-exceeds-parser-limit 717, evaluate-threw-over-30-digits 132).

Verdicts (from the written conventions, not the reporter's claim):
1. `unrounded` pads zeros past 12 digits — ENGINE WRONG. `ratToDisplay` cut at `firstPlace − 12 + 1`; when that place is
   above the ones, `decToPlain` fills it with placeholder zeros that read as digits ("3333333333330…"). The type says
   "exact un-rounded value / every digit". Fix: never cut above the tenths, so the display always has a decimal point
   and every shown digit is a true digit ("3333333333333.3…"). Same function serves `intermediates[].unrounded`.
2. Alternate spelling the parser refuses — ENGINE WRONG (self-contradiction). The 30-digit cap counted leading and
   placeholder zeros, yet its message is "more digits than any measurement has". Fix: the cap counts SIGNIFICANT
   digits (position = the 31st significant digit). "0.000…001" (31 digits, 1 s.f.) is now read and graded correct.
3. `round 4.0e30 to 2` threw a plain Error — ENGINE WRONG. `roundingSentences` re-parsed the 31-digit plain expansion
   with `mustParseSigFig` only to count its figures. Fix: count arithmetically (`digitCount(minimalDec(...).int)`); the
   evaluator no longer depends on the parser's input limits for its own output. (Fix 2 alone would also have cured it.)
4. "10e2" reads as 1 s.f. — SPEC CONFLICT, engine left alone. Rule 5's example is normalized; a coefficient outside
   [1, 10) is not scientific notation, so rule 4 governs its trailing zeros. Documented decision, pinned by
   `parse.test.ts` ("10 x 10^2" → 1). The app only writes normalized coefficients.
5. Zero group as a factor: validate says zero_result, evaluate throws — ENGINE RIGHT, left alone. A factor with no
   significant figures leaves the × ÷ rule undefined, so the task is degenerate (the reference refuses it too:
   "a measured piece has no significant figures"). A plain zero SUM differs materially: "0.00" has a defined place,
   so it evaluates. The code `zero_result` on the throw is the most useful one for generators.

- [done] regression tests appended (fail before the fix): `evaluate.test.ts` (display digits, 4.0e30, 1.0e-30 convert),
  `grade.test.ts` (alternates of round 1e-30 and 6.022e23 × 2.0e8 grade correct), `parse.test.ts` (31 digits / 1 s.f.
  accepted; 31 significant digits refused at the 31st).
- [done] fixes: `decimal.ts` `ratToDisplay` cut place = `min(firstPlace − figures + 1, −1)`; `parse.ts` limit counts
  significant digits (`significantCount > MAX_DIGITS`, position = 31st significant digit); `evaluate.ts`
  `roundingSentences` counts the placeholder spelling's figures with `digitCount(minimalDec(...).int)`.
  No exported name, signature or type changed; `src/engine/sweep` untouched.
- Verification: `npm run typecheck` clean; `node node_modules/vitest/vitest.mjs run src/engine` 11 files / 292 tests
  (sigfigs folder 5 files / 170); differential sweep 11/11 green, 513,060 cases, 0 disagreements.
- For the FUZZ agent: the header comment of `src/engine/sweep/sigfigs-differential.sweep.ts` and the "Findings" list in
  `docs/progress/sigfigs-fuzz.md` still describe findings 1-3 as open; they are fixed and can be relaxed (not my files).
- Side effect worth knowing: a whole number with more than 30 digits but few significant ones ("4" + 30 zeros) is now
  read instead of refused; a zero written with 40 zeros is read as zero. The exponent cap (|power| ≤ 99) is unchanged.
