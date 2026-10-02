# Polynomials core (Unit 2: completing the square, synthetic division, zeros and end behavior, rational root candidates) — engine API and progress log

Engine core only (Claude, 2026-10-01). Templates, screens, catalog wording and ErrorPatternId registration
are the next builder's job. Everything lives in `src/engine/polynomials/`; the public API is
`src/engine/polynomials/index.ts`. **It is not yet re-exported from `@/engine`**: `src/engine/index.ts` had
another owner during this build. The block to paste is in §7. Nothing committed.

**Status:** complete. `node node_modules/vitest/vitest.mjs run src/engine/polynomials` → 5 files, 123 tests
green (square 31, synthetic 31, zeros 39, roots 17, seeded properties 5). `npm run typecheck` clean for the
whole project (all three configs) at the time of writing. Full suite (`node node_modules/vitest/vitest.mjs
run`, 2026-10-01 21:29): 101 files, 1,828 tests, all green (two more tests were added to this folder after
that run; the folder was re-run green).

## 1. Conventions (read first)

- **Exact.** Every polynomial is read off the parse tree into rational coefficients (`polyOf` from the
  functions core) and every number into a `Rational`. Nothing in this folder compares floats. Two formulas are
  "the same" when their coefficients are equal, so any form she types (factored, expanded, `(2x - 1)` for a
  zero at 1/2) is compared exactly.
- **The problem's polynomial** is a `PolyInput`: text in app syntax (`'2x^3 - 3x^2 - 5'`, `'f(x) = x^2 - 6x + 13'`,
  any form that multiplies out to a polynomial) or its coefficients from the highest power down, zeros
  included (`[2, -3, 0, -5]`; entries may be numbers, `'1/2'`, or `Rational`s).
- **Numbers** given by templates are `RatLike` (the transformations core's type): a `Rational`, a JS number
  (read as written: 0.5 is 1/2) or text (`'-3/2'`).
- **A factored polynomial** is a `FactoredSource`: the object from `makeFactored`, or its text
  `'-2(x + 1)^2(x - 3)(x - 1/2)^3'` (a product of numbers and powers of LINEAR factors; anything else is
  outside the model).
- **Text fields** (`f`, `text`, `vertexForm`, `divisor`, `quotientText`, `rows`, …) are ASCII app syntax the
  parser reads back. **Sentences** (`message`, `witness`, `reason`, `explanation`) are display text with − ± ∞.
- **Graders** return `PolyGrade`:

```ts
type PolyGrade =
  | { verdict: 'correct'; message: string; explanation: string[] }
  | { verdict: 'mistake'; mistake: PolyMistakeKind; witness: string; explanation: string[] } // named; a sentence about HER numbers
  | { verdict: 'wrong'; message: string; explanation: string[] }                             // wrong, plain specific message
  | { verdict: 'invalid'; message: string; reason: 'unreadable' | 'not_in_form'; position?: number; length?: number; index?: number }
  | { verdict: 'unsupported'; message: string }                                              // the PROBLEM is outside the model
```

  - `invalid` is **not an attempt**: show the message under the input and do not count it. `reason:
    'unreadable'` is a parse problem (`position`/`length` point into her text; `index` says which box of a row
    or which zero). `reason: 'not_in_form'` means her answer is EQUAL to the right one but not in the form the
    question asks for: f(x) typed back in standard form where vertex form is wanted, the whole division result
    where only the quotient is wanted. Say so, let her keep going.
  - `explanation` is the ordered, plain-language worked solution for that problem (every grader returns it on
    `correct`, `mistake` and `wrong`). Use it for the hint reveal and after a correct answer. Do not show it
    next to a `wrong` verdict she can still retry: it contains the answer.
  - A number so large that exact arithmetic leaves the safe-integer range (a held-down key) comes back as
    `invalid` ("A number in that answer is too large to check exactly."); graders never throw.
- **Mistake kinds** are a local union `PolyMistakeKind` (24 kinds, array `POLY_MISTAKE_KINDS`), NOT
  ErrorPatternIds. Kinds are shared across contexts where the slip is the same (`sd_wrong_sign_c` in the table,
  the remainder and the factor theorem; `zero_sign_reversed` in the zero list, the polynomial she builds and
  the rational zeros), so one catalog entry per kind serves every screen.
- **Candidates and shadows.** Every `…Mistakes` function returns what each slip WOULD produce for this problem,
  in priority order, without the candidates that equal the right answer. When two kinds give the same wrong
  answer the earlier kind keeps it and the later ones are listed in its `shadows`. A template can avoid
  ambiguous problems with `mistakes.every(c => c.shadows.length === 0)`, EXCEPT for the synthetic table (see §4).
- Deterministic: no randomness in the core. Problem text and the rational-root model are cached per string.

## 2. API reference

Types (all exported from `./polynomials`): `PolyGrade`, `PolyMistakeKind`, `PolyInput`, `CompletedSquare`,
`SquareLine`, `SquareStep`, `SquareLineGrade`, `SquareMistakeCandidate`, `PointValueCandidate`,
`NumberMistakeCandidate`, `FormulaMistakeCandidate`, `SyntheticTable`, `SyntheticAnswer`,
`SyntheticMistakeCandidate`, `FactoredPoly`, `LinearFactor`, `FactorInput`, `FactoredSource`,
`FactoredAnalysis`, `ZeroInfo`, `ZeroAnswer`, `ZeroMistakeCandidate`, `CrossTouch`, `CrossTouchCheck`,
`EndBehavior`, `EndDirection`, `EndMistakeCandidate`, `ZerosSpec`, `BuiltPolynomial`, `RootCandidates`,
`RootSetMistakeCandidate`. Field comments: `src/engine/polynomials/types.ts`.

### 2.1 Completing the square (`square.ts`)

`completeSquare(f: PolyInput): CompletedSquare | null` — null unless f is a quadratic.
```ts
const m = completeSquare('2x^2 - 12x + 13')
// a 2, b −12, c 13, h 3, k −5, half −3 (the number inside the square), square 9 (added and subtracted)
// vertexForm '2(x - 3)^2 - 5', vertexText '(3, -5)', axisText 'x = 3', opens 'up', extremum { kind: 'minimum', value: −5 }
m.path.map(l => [l.step, l.text])
// [['start', '2x^2 - 12x + 13'], ['factor', '2(x^2 - 6x) + 13'], ['add_subtract', '2(x^2 - 6x + 9 - 9) + 13'],
//  ['square', '2((x - 3)^2 - 9) + 13'], ['distribute', '2(x - 3)^2 - 18 + 13'], ['combine', '2(x - 3)^2 - 5']]
m.path[2].reason
// 'Half of −6 is −3, and (−3)^2 = 9. Add 9 inside the parentheses to make a perfect square, and subtract it again so the value does not change.'
m.explanation // the path's reasons, then 'Vertex form: f(x) = 2(x − 3)^2 − 5.', the vertex/axis line, the opens/minimum line (8 lines)
completeSquare('x^2 - 6x + 13').path.map(l => l.text)   // a = 1: no factor or distribute line
// ['x^2 - 6x + 13', 'x^2 - 6x + 9 - 9 + 13', '(x - 3)^2 - 9 + 13', '(x - 3)^2 + 4']
completeSquare('-x^2 - 6x + 13').vertexForm      // '-(x + 3)^2 + 22'
completeSquare('3x^2 + 5x').vertexForm           // '3(x + 5/6)^2 - 25/12'
completeSquare('x^2 + 4').path.length            // 1 (b = 0: already vertex form)
```
Every line of `path` is an expression equal to f(x), and `verifyRewrite(path[i-1].text, path[i].text,
{ vars: ['x'], seed })` accepts every consecutive pair (tested), so the path can be `ctx.canonical`.

`vertexFormText(a: Rational, h: Rational, k: Rational): string` — `'2(x - 3)^2 - 5'`, `'-(x + 1)^2'`, `'(1/2)x^2 + 3'`.

`isVertexForm(text: string): boolean` — written as a(x − h)^2 + k: ONE squared binomial `x − h` (monic; `x`
alone when h = 0) times a number, plus at most one constant.
```ts
isVertexForm('2(x - 3)^2 - 5')        // true   also '-5 + 2(x - 3)^2', '(x - 6)^2/2 - 5', 'y = 2(x - 3)^2 - 5', 'x^2 + 4'
isVertexForm('2(x - 3)^2 - 18 + 13')  // false  also '2x^2 - 12x + 13', '(2x - 6)^2/2 - 5', '2(3 - x)^2 - 5'
```

`gradeVertexForm(f, answer: string): PolyGrade`
```ts
gradeVertexForm(F, '-5 + 2(x-3)^2')    // { verdict: 'correct', message: 'Correct: f(x) = 2(x − 3)^2 − 5.', explanation }
gradeVertexForm(F, '2x^2 - 12x + 13')  // { verdict: 'invalid', reason: 'not_in_form', message: 'That is equal to f(x), but it is not vertex form yet. …' }
gradeVertexForm(F, '2(x - 3)^2 + 4')
// { verdict: 'mistake', mistake: 'cs_constant_not_scaled', witness: 'The 9 you added sits inside 2( ), so it is worth 2·9 = 18.
//   Taking it out of the parentheses changes the constant by 18, not by 9: 13 − 18 = −5, not 13 − 9 = 4.', explanation }
gradeVertexForm(F, '2(x - 3)^2 - 7')
// { verdict: 'wrong', message: 'Multiply your answer back out: it gives 2x^2 − 12x + 11, but f(x) = 2x^2 − 12x + 13. The x^2 and x
//   terms match, so the square is right. Multiplied out, the constants differ (yours is 11, f has 13): k = 13 − 18 = −5.' }
```
`squareMistakes(f): SquareMistakeCandidate[] | null` — each candidate is the vertex form `a(x − h)^2 + k` the slip ends with.
```ts
squareMistakes(F).map(c => [c.kind, c.text, c.shadows])
// [['cs_h_sign', '2(x + 3)^2 - 5', []], ['cs_unbalanced', '2(x - 3)^2 + 13', []], ['cs_unbalanced', '2(x - 3)^2 + 31', []],
//  ['cs_constant_not_scaled', '2(x - 3)^2 + 4', []], ['cs_no_factor_a', '2(x - 6)^2 - 23', []],
//  ['cs_no_factor_a', '2(x - 6)^2 - 59', ['cs_half_or_square']], ['cs_no_factor_a', '(x - 6)^2 - 23', []],
//  ['cs_half_or_square', '2(x - 3)^2 - 23', []], ['cs_half_or_square', '2(x - 6)^2 - 5', []]]
```

`gradeVertex(f, answer: string): PolyGrade` — her point `"(h, k)"` (parentheses optional, coordinates exact).
```ts
gradeVertex(F, '(3, -5)')    // correct: 'Correct: f(x) = 2(x − 3)^2 − 5, so the vertex is (3, −5).'
gradeVertex(F, '(-3, -5)')   // mistake cs_h_sign: 'In a(x − h)^2 + k the sign inside the square is opposite to h: 2(x − 3)^2 − 5 has the
                             //   square (x − 3)^2, which is 0 at x = 3. So h = 3 and the vertex is (3, −5), not (−3, −5).'
gradeVertex(F, '(-5, 3)')    // mistake cs_vertex_swapped
gradeVertex(F, '(3, 1)')     // wrong: 'Your x-coordinate 3 is right. The y-coordinate is the value of f there: f(3) = −5 (the k of 2(x − 3)^2 − 5).'
```
`vertexMistakes(f): PointValueCandidate[] | null` — `(−h, k)`, `(k, h)`, then the vertex of every form candidate.

`gradeAxisOfSymmetry(f, answer: string): PolyGrade` — `"x = 3"` or `"3"`; `"y = 3"` is `invalid`.
```ts
gradeAxisOfSymmetry(F, 'x = -3')   // mistake cs_h_sign
gradeAxisOfSymmetry(F, '6')        // mistake cs_no_factor_a: 'Divide by 2a, not by 2: x = −b/(2a) = 12/4 = 3. Your 6 is −b/2, which leaves a = 2 out.'
```
`axisMistakes(f): NumberMistakeCandidate[] | null` — −h (`cs_h_sign`), −b/2 (`cs_no_factor_a`), −b/a (`cs_half_or_square`).

`checkSquareLine(f, line: string): SquareLineGrade` — the line-by-line helper. `correct` means the line is still
the same function as f (a legal line; `done: true` when it is already vertex form). When it is not, the slip is
named if the line multiplies out to what a slip produces. The line may be an expression, or an **equation with
y** (the method that moves the constant to y's side: it is solved for y exactly).
```ts
checkSquareLine(F, '2(x^2 - 6x + 9 - 9) + 13')   // { verdict: 'correct', done: false, message: 'This line is still equal to f(x).' }
checkSquareLine(F, '2(x - 3)^2 - 5')             // { verdict: 'correct', done: true, message: 'This is vertex form: f(x) = 2(x − 3)^2 − 5.' }
checkSquareLine(F, '2(x^2 - 6x + 9) + 13')       // mistake cs_unbalanced
checkSquareLine(F, '2(x - 3)^2 - 9 + 13')        // mistake cs_constant_not_scaled
checkSquareLine(F, '2(x^2 - 12x) + 13')
// mistake cs_no_factor_a: 'Factoring 2 out of the x-terms divides BOTH of them by 2: 2x^2 − 12x = 2(x^2 − 6x), not 2(x^2 − 12x). Then
//   half of −6 is −3, so the square is (x − 3)^2 and the vertex form is 2(x − 3)^2 − 5.'
checkSquareLine(F, 'y - 13 + 18 = 2(x^2 - 6x + 9)')   // correct (equation line)
checkSquareLine(F, 'y - 13 + 9 = 2(x^2 - 6x + 9)')    // mistake cs_constant_not_scaled
checkSquareLine(F, '2(x^2 - 6x) + 12')
// wrong: 'This line is not equal to f(x) any more: it multiplies out to 2x^2 − 12x + 12, but f(x) = 2x^2 − 12x + 13 (at x = 0 the line
//   gives 12 and f gives 13). …'
```
It does not check that a line follows from the PREVIOUS line: that is `verifyRewrite`'s job (every legal line of
this problem is equal to f, so the two agree on what is accepted; this helper adds the name of the slip).

### 2.2 Synthetic division, remainder and factor theorems (`synthetic.ts`)

`syntheticDivision(f: PolyInput, c: RatLike): SyntheticTable | null` — f ÷ (x − c). Null unless f has degree ≥ 1.
```ts
const t = syntheticDivision('2x^3 - 3x^2 - 5', 2)
// f '2x^3 - 3x^2 - 5', degree 3, c 2, divisor 'x - 2', missingPowers [1]
// rows { coefficients: ['2', '-3', '0', '-5'], products: ['4', '2', '4'], bottom: ['2', '1', '2', '-1'] }
// (the same three rows as Rational[]: t.coefficients, t.products, t.bottom)
// quotientCoefficients [2, 1, 2], quotientText '2x^2 + x + 2', remainder −1, remainderText '-1', isFactor false
// substitution '2(2)^3 - 3(2)^2 - 5'   (f(c) written out; its value is the remainder)
t.explanation
// ['x − 2 is 0 at x = 2, so 2 goes in the box.',
//  'Write the coefficients of 2x^3 − 3x^2 − 5 from the highest power down, with a 0 for the missing x term: 2, −3, 0, −5.',
//  'Bring the first coefficient straight down: 2.',
//  'Multiply 2·2 = 4, write it under −3 and add: −3 + 4 = 1.', 'Multiply 2·1 = 2, write it under 0 and add: 0 + 2 = 2.',
//  'Multiply 2·2 = 4, write it under −5 and add: −5 + 4 = −1.',
//  'The bottom row is 2, 1, 2, −1. Its last number is the remainder, −1; the others are the coefficients of the quotient, which is one degree lower than f(x): 2x^2 + x + 2.',
//  'Remainder theorem: the remainder is f(2). Check: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1.',
//  'Factor theorem: the remainder is not 0, so x − 2 is not a factor of f(x).']
syntheticDivision('x^4 - 3x^2 + 2x', -2).rows.bottom   // ['1', '-2', '1', '0', '0']  divisor 'x + 2', isFactor true
syntheticDivision([2, 1, -5, 2], '1/2').quotientText   // '2x^2 + 2x - 4'
```
`products[i]` sits under `coefficients[i + 1]`: nothing goes under the first coefficient.

`divisorText(c: RatLike): string` — `'x - 2'`, `'x + 2'`, `'x - 1/2'`.
`polyValueAt(f: PolyInput, x: RatLike): Rational | null` — f(x) exactly (`polyValueAt('2x^3 - 3x^2 - 5', -2)` is −33).

`gradeCoefficientRow(f, answer: string | readonly string[]): PolyGrade` — the top row she sets up.
```ts
gradeCoefficientRow(F, '2, -3, 0, -5')   // correct: 'Correct: 2, −3, 0, −5 (the 0 holds the place of the missing x term).'
gradeCoefficientRow(F, '2, -3, -5')
// mistake sd_missing_placeholder: 'f(x) = 2x^3 − 3x^2 − 5 has no x term. Its place still needs a 0 in the row, or every later number
//   lines up with the wrong power: a degree-3 polynomial has 4 coefficients, and your row has 3.'
gradeCoefficientRow(F, '2, 3, 0, -5')    // wrong: 'Check the second number: it is the coefficient of the x^2 term in f(x) = 2x^3 − 3x^2 − 5, sign included.'
```

`gradeSyntheticTable(f, c, answer: SyntheticAnswer): PolyGrade` where
`SyntheticAnswer = { bottom: string | readonly string[]; products?: string | readonly string[]; box?: string }`.
The bottom row is graded; the products row and the box, when the screen collects them, are checked too and
tell "−c in the box" from "subtracted". `gradeBottomRow(f, c, bottom)` is the bottom row alone.
```ts
gradeBottomRow(F, 2, ['2', '1', '2', '-1'])   // correct: 'Correct: the bottom row is 2, 1, 2, −1, so the quotient is 2x^2 + x + 2 and the remainder is −1.'
gradeBottomRow(F, 2, '2, -7, 14, -33')
// mistake sd_wrong_sign_c: 'The box holds the number that makes x − 2 zero: x = 2. Your bottom row 2, −7, 14, −33 is what −2 in the box
//   gives (the same as subtracting each product instead of adding it).'
gradeSyntheticTable(F, 2, { bottom: ['2', '-7', '14', '-33'], products: ['4', '-14', '28'] })   // mistake sd_subtracted
gradeSyntheticTable(F, 2, { bottom: ['2', '-7', '14', '-33'], box: '2' })                       // mistake sd_subtracted (the box is right)
gradeSyntheticTable(F, 2, { bottom: ['2', '-7', '14', '-33'], box: '-2' })                      // mistake sd_wrong_sign_c
gradeBottomRow(F, 2, '2, 1, -3')        // mistake sd_missing_placeholder (the row 2, −3, −5 without its 0)
gradeBottomRow(F, 2, '4, 5, 10, 15')    // mistake sd_first_coefficient
gradeBottomRow(F, 2, '2, 1, -2, -9')
// mistake sd_subtracted (one column): 'Your first 2 numbers, 2, 1, are right. In the third column (under 0) you subtracted the product:
//   0 − 2 = −2. Synthetic division ADDS each column (the sign change is already in the box number 2): 0 + 2 = 2.'
gradeBottomRow(F, 2, '2, 1, 3, 1')
// wrong: 'Your first 2 numbers, 2, 1, are right. In the third column (under 0): multiply 2·1 = 2, then add 0 + 2 = 2, not 3.'
gradeBottomRow(F, 2, ['2', '', '2', '-1'])   // { verdict: 'invalid', reason: 'unreadable', index: 1, message: 'Fill in every box of the bottom row.' }
```
A row that is not a whole-table slip is checked column by column against HER OWN previous entry, so the
message points at the first column where the arithmetic goes wrong (later columns that follow from it are not
blamed).

`syntheticMistakes(f, c): SyntheticMistakeCandidate[] | null` — the whole table each slip gives (`box`,
`coefficients`, `products`, `bottom`, `text`).
```ts
syntheticMistakes(F, 2).map(k => [k.kind, k.text, k.shadows])
// [['sd_wrong_sign_c', '2, -7, 14, -33', ['sd_subtracted']], ['sd_missing_placeholder', '2, 1, -3', []],
//  ['sd_first_coefficient', '4, 5, 10, 15', []], ['sd_first_coefficient', '6, 9, 18, 31', []]]
```

`gradeQuotient(f, c, answer: string): PolyGrade` — a polynomial in x, any form.
```ts
gradeQuotient(F, 2, 'x(2x + 1) + 2')           // correct: 'Correct: the quotient is 2x^2 + x + 2 (remainder −1).'
gradeQuotient(F, 2, '2x^3 + x^2 + 2x')         // mistake sd_quotient_degree: '… Yours starts one power too high, at x^3.'
gradeQuotient(F, 2, '2x^2 + x + 2 - 1/(x - 2)') // invalid, reason 'not_in_form': 'That is the whole result of the division. …'
gradeQuotient(F, 2, '2x^2 + x + 3')
// wrong: 'Check by multiplying back: (x − 2)·(your quotient) + (−1) should give f(x). Yours gives 2x^3 − 3x^2 + x − 7, but f(x) = 2x^3 − 3x^2 − 5. …'
```
`quotientMistakes(f, c): FormulaMistakeCandidate[] | null`.

`gradeRemainder(f, c, answer: string, options?: { ask?: 'remainder' | 'value' }): PolyGrade` — the remainder, or
f(c) (`ask: 'value'` changes the wording only: by the remainder theorem it is the same number).
```ts
gradeRemainder(F, 2, '-1')   // correct: 'Correct: the remainder is −1, the last number of the bottom row 2, 1, 2, −1. (Remainder theorem: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1.)'
gradeRemainder(F, 2, '2')    // mistake sd_remainder_last_quotient: 'The remainder is the LAST number of the bottom row 2, 1, 2, −1: −1. Your 2 is the number before it, the constant term of the quotient.'
gradeRemainder(F, 2, '-33', { ask: 'value' })  // mistake sd_wrong_sign_c: 'f(2) means x = 2: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1. Your −33 is f(−2), the value at the opposite number.'
```
`remainderMistakes(f, c): NumberMistakeCandidate[] | null`.

`gradeIsFactor(f, c, answer: boolean | string): PolyGrade` — factor theorem; `true`/`false` or `"yes"`/`"no"`.
```ts
gradeIsFactor('x^3 - 7x + 6', -3, 'yes')   // correct: 'Correct: f(−3) = (−3)^3 − 7(−3) + 6 = 0, so x + 3 is a factor (factor theorem): f(x) = (x + 3)(x^2 − 3x + 2).'
gradeIsFactor('x^3 - 7x + 6', -3, 'no')
// mistake sd_wrong_sign_c: 'x + 3 is 0 at x = −3, so the number to test is −3: f(−3) = … = 0. Testing 3 gives f(3) = 12, which answers the question for x − 3 instead.'
```
Named only when testing −c would give the other answer (f(c) = 0 and f(−c) ≠ 0, or the reverse); otherwise a
wrong yes/no is plain `wrong`.

### 2.3 Zeros, multiplicity, end behavior (`zeros.ts`)

`makeFactored(lead: RatLike, factors: readonly FactorInput[]): FactoredPoly` — a factor is `{ zero, mult? }`
(the monic factor x − zero) or `{ coef, constant, mult? }` ((coef·x + constant)^mult). Throws RangeError on a
template bug. `parseFactored(text): FactoredPoly | null` reads the same from text; `factoredFormText(fp)` prints
it (and round-trips through `parseFactored`).
```ts
const fp = makeFactored(-2, [{ zero: -1, mult: 2 }, { zero: 3 }, { zero: '1/2', mult: 3 }])
factoredFormText(fp)                                                // '-2(x + 1)^2(x - 3)(x - 1/2)^3'
factoredFormText(makeFactored(3, [{ coef: 2, constant: -1 }, { zero: -4, mult: 2 }]))   // '3(2x - 1)(x + 4)^2'
parseFactored('x^2(2x - 1)(3 - x)^3')   // lead 1, factors x^2, (2x − 1), (−x + 3)^3
parseFactored('x^2 - 4')                // null (a sum, not a product of linear factors)
expandFactored('(x - 2)^2(x + 1)')      // 'x^3 - 3x^2 + 4'
```

`analyzeFactored(source: FactoredSource): FactoredAnalysis | null`
```ts
const a = analyzeFactored('-2(x + 1)^2(x - 3)(x - 1/2)^3')
a.zeros.map(z => [z.text, z.mult, z.behavior, z.factor])     // ascending
// [['-1', 2, 'touches', '(x + 1)^2'], ['1/2', 3, 'crosses', '(x - 1/2)^3'], ['3', 1, 'crosses', '(x - 3)']]
a.degree              // 6
a.leadingCoefficient  // −2
a.end                 // { left: 'down', right: 'down' }     'up' is f(x) → ∞, 'down' is f(x) → −∞
a.endText             // 'As x → −∞, f(x) → −∞; as x → ∞, f(x) → −∞.'
a.yIntercept          // −3/4
a.expandedText        // '-2x^6 + 5x^5 + (11/2)x^4 - (29/4)x^3 - (7/4)x^2 + (13/4)x - 3/4'
a.explanation         // one line per zero, then degree, leading coefficient, ends, y-intercept (7 lines here)
analyzeFactored('3(2x - 1)(x + 4)^2').leadingCoefficient   // 6 (the 3 in front times the 2 of 2x)
```
`endBehaviorOf(degree: number, leadingCoefficient: RatLike): EndBehavior` — `endBehaviorOf(3, -1)` is `{ left: 'up', right: 'down' }`.

`gradeZeros(source, answer: string | readonly ZeroAnswer[]): PolyGrade` — a plain list `"-1, 3, 1/2"` (zeros only,
graded as a set), or one row per zero `{ zero: string; mult?: string | number }` (multiplicities graded when
any row has one; a row left completely blank is skipped, so a table with spare rows can be passed as it is).
Zeros are checked first, then multiplicities.
```ts
gradeZeros(P, '-1, 3, 1/2')    // correct: 'Correct: the zeros are −1, 1/2 and 3.'
gradeZeros(P, [{ zero: '-1', mult: 2 }, { zero: '3', mult: 1 }, { zero: '1/2', mult: 3 }])
// correct: 'Correct: x = −1 (multiplicity 2), x = 1/2 (multiplicity 3) and x = 3 (multiplicity 1).'
gradeZeros(P, '1, 3, 1/2')
// mistake zero_sign_reversed: '(x + 1) is 0 when x + 1 = 0, so x = −1, not 1: the zero has the opposite sign to the number in the factor.'
gradeZeros('3(2x - 1)(x + 4)^2', '1, -4')
// mistake zero_nonmonic_factor: 'Set the factor equal to 0 and solve: 2x − 1 = 0, 2x = 1, x = 1/2. Your 1 ignores the 2 in front of x.'
gradeZeros(P, [{ zero: '-1', mult: 1 }, { zero: '3', mult: 1 }, { zero: '1/2', mult: 1 }])   // mistake multiplicity_ignored
gradeZeros(P, [{ zero: '-1', mult: 3 }, { zero: '3', mult: 1 }, { zero: '1/2', mult: 2 }])   // mistake multiplicity_wrong_zero
gradeZeros(P, '-1, 3')         // wrong: 'You are missing the zero that comes from the factor (x − 1/2)^3.'   (the zero itself is not given away)
gradeZeros(P, '-1, 3, 1/2, 5') // wrong: 'x = 5 is not a zero: f(5) = −13122, not 0.'
```
`zeroMistakes(source): ZeroMistakeCandidate[] | null` — per factor, the wrong zero each misreading gives.
```ts
zeroMistakes('3(2x - 1)(x + 4)^2').map(c => [c.kind, c.factor, c.text])
// [['zero_sign_reversed', '(2x - 1)', '-1/2'], ['zero_nonmonic_factor', '(2x - 1)', '1'], ['zero_nonmonic_factor', '(2x - 1)', '-1'],
//  ['zero_nonmonic_factor', '(2x - 1)', '2'], ['zero_sign_reversed', '(x + 4)^2', '4']]
```

`gradeCrossTouch(source, choices: readonly string[]): PolyGrade & { checks?: CrossTouchCheck[] }` — one choice per
zero **in the order of `analyzeFactored(...).zeros`** (ascending): `'crosses'` or `'touches'` (also "cross",
"touch", "bounces"). `checks` has one entry per zero with its own sentence.
```ts
gradeCrossTouch(P, ['touches', 'crosses', 'crosses'])   // correct
gradeCrossTouch(P, ['touches', 'touches', 'crosses'])
// mistake cross_touch_swapped: '(x − 1/2)^3 gives x = 1/2 multiplicity 3, which is odd. An odd power changes sign, so the graph crosses
//   the x-axis at x = 1/2; it does not turn back.'   checks[1].ok === false
```

`gradeEndBehavior(source: FactoredSource | PolyInput, answer: { left: string; right: string }): PolyGrade` — `left`
is where f(x) goes as x → −∞, `right` as x → ∞: `'up'`/`'down'` (also `inf`, `-inf`, `∞`, `−∞`, `rises`, `falls`).
The source may be factored or standard form (`'-x^3 + 4x'`, `[2, 0, -1, 0, 5]`).
```ts
gradeEndBehavior(P, { left: 'down', right: 'down' })
// correct: 'Correct: degree 6 (even) with a negative leading coefficient (−2). As x → −∞, f(x) → −∞; as x → ∞, f(x) → −∞.'
gradeEndBehavior(P, { left: 'up', right: 'up' })      // mistake end_sign_ignored
gradeEndBehavior(P, { left: 'up', right: 'down' })
// mistake end_parity_swapped: 'The degree is 6 (add the exponents: 2 + 1 + 3 = 6), which is even: both ends go the same way. Your answer
//   sends the ends opposite ways, the pattern of an odd degree. Count the exponents, not the number of factors (3).'
gradeEndBehavior(P, { left: 'down', right: 'up' })    // wrong (both slips at once: plain message)
```
`endBehaviorMistakes(source): EndMistakeCandidate[] | null` — for P: `[end_sign_ignored up/up, end_parity_swapped up/down]`.

`gradeYIntercept(source, answer: string): PolyGrade` — the number f(0) or the point `"(0, f(0))"`.
```ts
gradeYIntercept(P, '(0, -3/4)')   // correct: 'Correct: f(0) = −2(0 + 1)^2(0 − 3)(0 − 1/2)^3 = −3/4, so the y-intercept is (0, −3/4).'
gradeYIntercept(P, '3/8')         // mistake lead_coefficient_omitted
gradeYIntercept(P, '-3')          // mistake multiplicity_ignored
```
`yInterceptMistakes(source): NumberMistakeCandidate[] | null`.

`polynomialFromZeros(spec: ZerosSpec): BuiltPolynomial | null` where
`ZerosSpec = { zeros: { zero: RatLike; mult?: number }[]; point?: { x: RatLike; y: RatLike } }`. Null for a
repeated zero, a bad multiplicity, or a point that is a zero or has y = 0.
```ts
const spec = { zeros: [{ zero: -1, mult: 2 }, { zero: 3 }], point: { x: 0, y: 6 } }
const b = polynomialFromZeros(spec)
// a −2, text '-2(x + 1)^2(x - 3)', expandedText '-2x^3 + 2x^2 + 10x + 6', degree 3
b.explanation
// ['Each zero gives a factor: x = −1 (multiplicity 2) gives (x + 1)^2 and x = 3 gives (x − 3).',
//  'Least degree means nothing else: f(x) = a(x + 1)^2(x − 3), degree 3.',
//  'Use the point (0, 6): 6 = a·(0 + 1)^2(0 − 3) = −3a, so a = 6/(−3) = −2.', 'f(x) = −2(x + 1)^2(x − 3).']
```
`gradePolynomialFromZeros(spec, answer: string): PolyGrade` — any formula that multiplies out to the right
polynomial. Without `point`, any nonzero multiple of the right product is correct.
```ts
gradePolynomialFromZeros(spec, '-2x^3 + 2x^2 + 10x + 6')   // correct     also '2(x + 1)^2(3 - x)'
gradePolynomialFromZeros(spec, '(x + 1)^2(x - 3)')
// mistake lead_coefficient_omitted: 'Your formula has the right zeros and multiplicities, but it does not go through (0, 6): at x = 0 it
//   gives −3. Put a in front, f(x) = a(x + 1)^2(x − 3), and use the point: 6 = −3a, so a = −2.'
gradePolynomialFromZeros(spec, '2(x - 1)^2(x + 3)')   // mistake zero_sign_reversed (whatever number is in front)
gradePolynomialFromZeros(spec, '-2(x + 1)(x - 3)')    // mistake multiplicity_ignored
gradePolynomialFromZeros(spec, '(x + 1)(x - 3)^2')    // mistake multiplicity_wrong_zero
gradePolynomialFromZeros(spec, '2(x + 1)^2(x - 3)')
// wrong: 'Your zeros and multiplicities are right. Now check the number in front with the point (0, 6): at x = 0 your formula gives −6, but it must give 6.'
```
`polynomialFromZerosMistakes(spec): FormulaMistakeCandidate[] | null`
```ts
// [['lead_coefficient_omitted', '(x + 1)^2(x - 3)'], ['zero_sign_reversed', '2(x - 1)^2(x + 3)'],
//  ['multiplicity_ignored', '-2(x + 1)(x - 3)'], ['multiplicity_wrong_zero', '(2/3)(x + 1)(x - 3)^2']]
```

### 2.4 Rational root candidates (`roots.ts`)

`rationalRootCandidates(f: PolyInput): RootCandidates | null` — null unless f has integer coefficients, degree
≥ 1 and a NONZERO constant term (factor x out first).
```ts
const m = rationalRootCandidates('2x^3 - 5x^2 - 4x + 3')
// constant 3, leading 2, p [1, 3], q [1, 2]
// positives [1, 3, 1/2, 3/2]      candidates [−3, −3/2, −1, −1/2, 1/2, 1, 3/2, 3]      text '+-1, +-3, +-1/2, +-3/2'
// tests [{ candidate: −3, value: −84 }, …, { candidate: −1, value: 0 }, …]   (f at every candidate, exact)
// zeros [−1, 1/2, 3], multiplicities [1, 1, 1]
m.explanation
// ['Constant term 3: its factors are p = ±1, ±3.', 'Leading coefficient 2: its factors are q = ±1, ±2.',
//  'Every rational zero is one of the fractions p/q: ±1, ±3, ±1/2, ±3/2. That is 8 candidates once repeats are removed.']
m.zeroExplanation
// ['Test each candidate: put it into f(x) (or divide synthetically and look for remainder 0).',
//  'f(−1) = 0, f(1/2) = 0 and f(3) = 0, so the rational zeros are −1, 1/2 and 3. Every other candidate gives a value that is not 0.']
```

`gradeRootCandidates(f, answer: string): PolyGrade` — the list as a SET. Accepted spellings: `+-1, +-3`,
`±1, ±3`, `+/-1`, every value written out, `{…}` or `(…)` around the list, `+-{1, 3, 1/2, 3/2}`, repeats and
unreduced fractions (`2/2`, `6/4`).
```ts
gradeRootCandidates(F, '±1, ±3, ±1/2, ±3/2')   // correct: 'Correct: all 8 candidates, ±1, ±3, ±1/2, ±3/2 (factors of 3 over factors of 2).'
gradeRootCandidates(F, '1, 3, 1/2, 3/2')       // mistake rrt_no_plus_minus
gradeRootCandidates(F, '±1, ±2, ±1/3, ±2/3')   // mistake rrt_inverted
gradeRootCandidates(F, '±1, ±3')               // mistake rrt_integers_only
gradeRootCandidates(F, '±1, ±2, ±4, ±1/2')
// mistake rrt_wrong_coefficients: 'Use the constant term 3 for p and the leading coefficient 2 for q. Your list comes from −4 (the
//   coefficient of the x term) over 2 (the leading coefficient).'
gradeRootCandidates(F, '±1, ±3, ±1/2')         // wrong: 'You have 6 of the 8 candidates. Missing: ±3/2.'
gradeRootCandidates(F, '±1, ±3, ±1/2, ±3/2, ±5')
// wrong: '5 is not a candidate: its numerator 5 is not a factor of the constant term 3. (2 of your numbers are not candidates.)'
```
`rootCandidateMistakes(f): RootSetMistakeCandidate[] | null` — the whole list each slip gives (`values`, `text`).

`gradeRationalZeros(f, answer: string): PolyGrade` — which candidates really are zeros: a list graded as a set,
or `"none"`.
```ts
gradeRationalZeros(F, '-1, 1/2, 3')    // correct: 'Correct: f(−1) = 0, f(1/2) = 0 and f(3) = 0; no other candidate is a zero.'
gradeRationalZeros(F, '1, -1/2, -3')   // mistake zero_sign_reversed
gradeRationalZeros(F, '-1, 1/2, 3, 1') // wrong: '1 is not a zero: f(1) = −4, not 0.'
gradeRationalZeros(F, '-1, 3')         // wrong: 'You have 2 of the 3 rational zeros: keep testing the candidates … for a remainder of 0.'  (not given away)
gradeRationalZeros('x^2 + x + 1', 'none')  // correct
```

## 3. Mistake kinds and the exact wrong answer each produces

Samples: square f(x) = 2x^2 − 12x + 13 = 2(x − 3)^2 − 5; division (2x^3 − 3x^2 − 5) ÷ (x − 2), bottom row
2, 1, 2, −1; zeros P(x) = −2(x + 1)^2(x − 3)(x − 1/2)^3 and R(x) = 3(2x − 1)(x + 4)^2; building: zeros −1 (mult 2)
and 3 through (0, 6), answer −2(x + 1)^2(x − 3); roots 2x^3 − 5x^2 − 4x + 3.

| kind | where | what she did | right | wrong answer produced |
|---|---|---|---|---|
| `cs_no_factor_a` | form, line | halved b = −12 without factoring 2 out | 2(x − 3)^2 − 5 | 2(x − 6)^2 − 23; 2(x − 6)^2 − 59 (= the line 2(x^2 − 12x) + 13); (x − 6)^2 − 23 (the 2 lost) |
| | vertex / axis | | (3, −5) / x = 3 | (6, −23) / x = 6 (−b/2) |
| `cs_unbalanced` | form, line | added 9 inside, never took it away | 2(x − 3)^2 − 5 | 2(x − 3)^2 + 13 (line 2(x^2 − 6x + 9) + 13); added twice: 2(x − 3)^2 + 31 |
| | vertex | | (3, −5) | (3, 13) |
| `cs_constant_not_scaled` | form, line | took 9 out without multiplying by a = 2 | 2(x − 3)^2 − 5 | 2(x − 3)^2 + 4 (line 2(x − 3)^2 − 9 + 13) |
| `cs_half_or_square` | form, line | (−6)^2/2 = 18 for (−6/2)^2 = 9; or did not halve | 2(x − 3)^2 − 5 | 2(x − 3)^2 − 23; 2(x − 6)^2 − 5 |
| | axis | −b/a | x = 3 | x = 4 for 3x^2 − 12x + 1 (axis x = 2) |
| `cs_h_sign` | form, line | sign inside the square | 2(x − 3)^2 − 5 | 2(x + 3)^2 − 5 |
| | vertex / axis | read h with the sign of the square | (3, −5) / x = 3 | (−3, −5) / x = −3 |
| `cs_vertex_swapped` | vertex | (k, h) | (3, −5) | (−5, 3) |
| `sd_wrong_sign_c` | table | −2 in the box for x − 2 (or 2 for x + 2) | 2, 1, 2, −1 | 2, −7, 14, −33 |
| | quotient / remainder / f(c) | | 2x^2 + x + 2 / −1 | 2x^2 − 7x + 14 / −33 (= f(−2)) |
| | factor theorem | tested −c | x + 3 is a factor of x^3 − 7x + 6 | "no" (f(3) = 12) |
| `sd_subtracted` | table | subtracted each product | 2, 1, 2, −1 | 2, −7, 14, −33 with products 4, −14, 28 (same bottom row as above); one column: 2, 1, −2, −9 |
| `sd_missing_placeholder` | coefficient row | no 0 for the missing x term | 2, −3, 0, −5 | 2, −3, −5 |
| | table / quotient / remainder | | 2, 1, 2, −1 | 2, 1, −3 / 2x + 1 / −3 |
| `sd_first_coefficient` | table | started with the product 2·2, or with 2 + 4 | 2, 1, 2, −1 | 4, 5, 10, 15; 6, 9, 18, 31 |
| `sd_quotient_degree` | quotient | one degree too high / too low | 2x^2 + x + 2 | 2x^3 + x^2 + 2x; 2x^3 + x^2 + 2x − 1; 2x + 1 |
| `sd_remainder_last_quotient` | remainder | read one place early | −1 | 2 |
| `zero_sign_reversed` | zeros | (x + 1) read as 1 | −1, 1/2, 3 | 1, 1/2, 3 |
| | zeros (R) | (2x − 1) → −1/2 | 1/2, −4 | −1/2, −4 |
| | building | factors with the signs flipped | −2(x + 1)^2(x − 3) | 2(x − 1)^2(x + 3) (any number in front) |
| | rational zeros | every sign backwards | −1, 1/2, 3 | 1, −1/2, −3 |
| `zero_nonmonic_factor` | zeros (R) | (2x − 1) read as 1, −1 or 2 | 1/2, −4 | 1, −4; −1, −4; 2, −4 |
| `multiplicity_ignored` | zeros | every multiplicity 1 | 2, 3, 1 | 1, 1, 1 |
| | building | no exponents | −2(x + 1)^2(x − 3) | −2(x + 1)(x − 3) |
| | y-intercept | every factor once | −3/4 | −3 |
| `multiplicity_wrong_zero` | zeros | exponents on the wrong zeros | −1:2, 1/2:3, 3:1 | −1:3, 1/2:2, 3:1 |
| | building | | −2(x + 1)^2(x − 3) | (2/3)(x + 1)(x − 3)^2 |
| `cross_touch_swapped` | cross/touch | even ↔ odd | touches, crosses, crosses | any other choice |
| `end_sign_ignored` | ends | sign of the leading coefficient ignored | down, down | up, up |
| `end_parity_swapped` | ends | even pattern ↔ odd pattern | down, down | up, down |
| `lead_coefficient_omitted` | building | a left out (or left as 1) | −2(x + 1)^2(x − 3) | (x + 1)^2(x − 3) |
| | y-intercept | the number in front left out | −3/4 | 3/8 |
| `rrt_no_plus_minus` | candidates | positives only | ±1, ±3, ±1/2, ±3/2 | 1, 3, 1/2, 3/2 |
| `rrt_inverted` | candidates | q/p | | ±1, ±2, ±1/3, ±2/3 |
| `rrt_integers_only` | candidates | factors of the constant only | | ±1, ±3 |
| `rrt_wrong_coefficients` | candidates | factors of other coefficients | | e.g. ±1, ±2, ±4, ±1/2 (−4 over 2); 10 such lists for this f |

The tests (`square.test.ts`, `synthetic.test.ts`, `zeros.test.ts`, `roots.test.ts`) assert the witness strings.

## 4. Decisions

- **Vertex form is a form, not just a function.** `gradeVertexForm` needs her answer to equal f AND to be
  written as a(x − h)^2 + k with the binomial `x − h` (monic). Equal but not in that form is `invalid` /
  `not_in_form` rather than `wrong`: it is a legal line of work, not a wrong answer.
- **"−c in the box" and "subtracted each product" give the same bottom row** (coef − c·prev = coef + (−c)·prev).
  With the bottom row alone the grader names `sd_wrong_sign_c` (its witness mentions both) and
  `syntheticMistakes` lists `sd_subtracted` in its `shadows`: for the table, `shadows.length === 0` is NOT a
  usable template filter. Pass her products row (or the box) to `gradeSyntheticTable` to tell them apart. A
  subtraction in a single column is always recognised (`sd_subtracted`, column-local).
- **Column-local arithmetic checks.** A bottom row that is not a whole-table slip is checked against her own
  previous entry, so one slip produces one message about one column.
- **Zeros are graded before multiplicities**, and a wrong zero is named when it is a misreading of a factor
  she has no zero for. A missing zero is described by its factor, not given away.
- **Any wrong crosses/touches choice is `cross_touch_swapped`** (a two-way choice has one wrong answer).
- **End behavior** has three wrong answers: both ends flipped is `end_sign_ignored` (only listed when the
  leading coefficient is negative), the left end flipped is `end_parity_swapped`, the right end flipped is both
  slips together and gets the plain message.
- **Building a polynomial** is graded up to the number in front for the sign and multiplicity slips: her
  formula is compared with each slip's product by proportionality, so the slip is named whatever a she found.
- **Rational zeros not given away.** `gradeRationalZeros` and `gradeZeros` say how many zeros are missing or
  which factor she has not used, not the zero. The explanation (hint reveal) has everything.
- **"none" / "no remainder"** is read as 0 by `gradeRemainder`; `"none"` is the empty set for `gradeRationalZeros`.

## 5. Notes for the content stage

### The synthetic-division table as input boxes

```
 box │  c0   c1   c2  …  cn        coefficients (n + 1 cells)
     │       p1   p2  …  pn        products     (n cells: NOTHING under c0)
     └──────────────────────
        b0   b1   b2  … │ bn      bottom row   (n + 1 cells; a divider before the last one: the remainder)
```
- `syntheticDivision(f, c).rows` gives the three rows as strings; `products[i]` belongs under
  `coefficients[i + 1]` and `bottom[i]` under `coefficients[i]`.
- **Do not pre-draw the coefficient row if you want the placeholder trap.** A grid with exactly n + 1 boxes
  tells her a 0 is needed. Two-step layout: (1) she types the top row as a free list (or adds boxes herself)
  → `gradeCoefficientRow(f, row)`; (2) the grid appears with the checked top row filled in, an input for the
  box, n product boxes and n + 1 bottom boxes → `gradeSyntheticTable(f, c, { box, products, bottom })`. With a
  one-step layout where she types the bottom row as a list, `gradeBottomRow` still recognises the shorter row.
- Collect the **products row** if you can: it is the only way to tell `sd_subtracted` from `sd_wrong_sign_c`
  when the whole row is wrong, and a right bottom row with a wrong middle row gets its own message.
- Pass her boxes as an array of strings: an empty box comes back as `invalid` with its `index` (focus that box).
- Tab order: column by column (product, then sum) matches how the method is worked; row by row does not.
- Then the quotient (`gradeQuotient`) and the remainder (`gradeRemainder`) as separate answers; a
  "f(c) = ?" question is `gradeRemainder(..., { ask: 'value' })`, and "is x − c a factor?" is `gradeIsFactor`.
- Show the divisor with `divisorText(c)`; the problem statement should say `x + 2`, not `x − (−2)`.

### Good traps

- **Completing the square:** a ≠ 1 (2, 3, −1, −2, 1/2) is where every slip lives; a = 1 only has the sign, the
  balance and the halving slips. Keep b/a even for a first pass (integer h), then odd b/a (h = 3/2) once the
  method is solid. a < 0 makes the "add inside / what is it worth outside" step bite (the value added is
  negative). `squareMistakes(f).every(c => c.shadows.length === 0)` filters ambiguous quadratics (a = 2 always
  shadows one `cs_half_or_square` form under `cs_no_factor_a`, because b/2 = b/a there: prefer a = 3, −2, 1/2 when
  the question is about that slip).
- **Synthetic division:** divisor x + k (the sign trap); a polynomial with a missing power in the MIDDLE
  (2x^3 − 3x^2 − 5, x^4 − 3x^2 + 2x); remainder 0 problems for the factor theorem, and for `gradeIsFactor` a
  polynomial where f(c) = 0 but f(−c) ≠ 0 (x^3 − 7x + 6 with x + 3) so the sign slip is visible.
- **Zeros:** mix factor signs ((x + 1), (x − 3)); include one even multiplicity; a non-monic factor (2x − 1)
  for `zero_nonmonic_factor`; a negative number in front with an even degree for `end_sign_ignored`; a number
  of factors whose parity differs from the degree (3 factors, degree 6) so `end_parity_swapped` gets its
  "count the exponents" sentence. For the y-intercept, a number in front ≠ 1 and a multiplicity ≥ 2 so both
  named slips are live (`yInterceptMistakes(f).length === 2`).
- **Building a polynomial:** give a point that makes a an integer ≠ 1 (the y-intercept is the natural one);
  use a repeated zero so the multiplicity slips are live.
- **Rational roots:** leading coefficient with factors (2, 3, 4, 6) so fractions appear; constant term with 2
  to 4 factors. Lists up to 12 or 16 candidates are fine; 24 is tedious to type.

### What to avoid

- Completing the square with b = 0 (already vertex form: the path has one line, no candidates).
- Quadratics whose vertex lies on y = x (`cs_vertex_swapped` equals the answer) or on the y-axis when the
  question is about the sign of h: check `vertexMistakes(f)` for the kinds you need.
- Synthetic division with c = 0 (dividing by x) or c = 1 with `sd_first_coefficient` (the product equals the
  coefficient); degree 1 dividends (the quotient is a constant).
- Factored polynomials with a factor that is not linear ((x^2 + 1)): `parseFactored` returns null. Two zeros
  that are opposites with the same multiplicity ((x − 1)(x + 1)): the sign slip is invisible
  (`zeroMistakes` leaves it out).
- Degree above 6 or zeros with denominators above 3 in factored problems: the arithmetic stays exact but
  f(extra zero) in a message becomes a long fraction.
- Rational-root problems with constant term 0 (`rationalRootCandidates` is null: factor x out first) or with
  non-integer coefficients; a constant term equal to ± the leading coefficient (q/p is the same list, so
  `rrt_inverted` cannot fire).

### Template self-tests (per seed)

- Square: `completeSquare(f) !== null`; `gradeVertexForm(f, m.vertexForm)`, `gradeVertex(f, m.vertexText)`,
  `gradeAxisOfSymmetry(f, m.axisText)` are `correct`; every `m.path` line passes `checkSquareLine` and each
  consecutive pair passes `verifyRewrite`.
- Division: `syntheticDivision(f, c) !== null`; `gradeSyntheticTable(f, c, { bottom: t.rows.bottom, products:
  t.rows.products, box: ratToString(t.c) })`, `gradeQuotient(f, c, t.quotientText)`, `gradeRemainder(f, c,
  t.remainderText)`, `gradeIsFactor(f, c, t.isFactor)` are `correct`.
- Zeros: `analyzeFactored(text) !== null`; `gradeZeros(text, a.zeros.map(z => ({ zero: z.text, mult: z.mult })))`,
  `gradeCrossTouch(text, a.zeros.map(z => z.behavior))`, `gradeEndBehavior(text, a.end)` are `correct`;
  `polynomialFromZeros(spec) !== null` and `gradePolynomialFromZeros(spec, b.text)` is `correct`.
- Roots: `rationalRootCandidates(f) !== null`; `gradeRootCandidates(f, m.text)` and
  `gradeRationalZeros(f, m.zeros.map(ratToString).join(', ') || 'none')` are `correct`.

### Registration

Register one ErrorPatternId per kind you use (e.g. `poly_cs_unbalanced`), map `grade.mistake` → id, and use
`grade.witness` as the PatternHit witness. `POLY_MISTAKE_KINDS` lists all 24. `invalid` is never recorded.

## 6. Open questions for the reviewer

- **Which method does her class use for completing the square?** The canonical `path` adds and subtracts
  inside the parentheses (expression lines). `checkSquareLine` also accepts the other common method's lines
  (`y − 13 + 18 = 2(x^2 − 6x + 9)`), but there is no canonical path for it; one can be added (the step engine's
  relation mode would check it) if her homework shows that method.
- Wrong-answer messages follow the earlier cores: they explain with the right numbers (a wrong vertex form
  message shows k). Where giving the answer away would end the exercise (a missing zero, the remaining
  rational zeros) the message holds it back. Change the wording in the core if the flow should be stricter.

## 7. Layering and the export block

`src/engine/polynomials` imports `@/shared/types`, `@/notation/rational`, the engine's parser (`../parse`,
`../math`), the functions core's internals (`../functions/poly`, `exact`, `text`, `common`) and the
transformations core's text and point readers (`../transformations/text`, `points`, `types`). No shared types
were changed; no file outside this folder and this document was edited. No exported name clashes with anything
`@/engine` exports today (checked by search). To expose the API from `@/engine`, add to `src/engine/index.ts`:

```ts
// Polynomials (precalculus Unit 2): completing the square, synthetic division, zeros and end behavior, rational
// root candidates. Exact arithmetic; API in docs/progress/polynomials-core.md.
export * from './polynomials'
```
(`RatLike`, `ExactPoint`, `PointLike` are the transformations core's types and are already exported there; this
folder does not re-export them.)

## Log
- [started] plan: `types.ts`, `common.ts` (readers, text), `square.ts`, `synthetic.ts`, `zeros.ts`, `roots.ts`,
  `index.ts`, one test file per piece plus `property.test.ts`. Types written.
- [done] all five source files and `index.ts`; whole-project typecheck clean. `square.test.ts` green.
- [done] `synthetic.test.ts`, `zeros.test.ts`, `roots.test.ts` (hand-checked tables, every kind fires on a
  realistic wrong answer, every candidate grades as its own kind and differs from the right answer).
- [done] `property.test.ts`, five seeded loops with `exactEval` on the parsed text as the oracle: 300 quadratics
  (vertex form and every path line equal f exactly; f(h) = k), 300 divisions (quotient·(x − c) + remainder = f
  exactly; remainder = f(c); the table's arithmetic column by column), 200 factored polynomials (crosses/touches
  against the sign of f on both sides of each zero; end behavior against the sign of f beyond the zeros), 200
  polynomials from zeros, 200 integer polynomials (a candidate is a zero exactly when f vanishes there).
- Decision: every grader is wrapped so an overflow of the safe-integer range is an `invalid` verdict, not a throw.
- Decision: the rational-root model and the problem text are cached per string (grading 20 candidate lists
  against one f took 35 ms each before; under 1 ms after).
- [done] `gradeCoefficientRow` added for the two-step table layout; equation lines in `checkSquareLine`.
- The property file takes 15 to 60 s depending on machine load (mathjs parsing dominates); each loop carries a
  120 s timeout like the other cores' sweeps.
- [done] final state: 123 tests green in this folder, `npm run typecheck` clean, full suite 101 files green.
  Nothing outside `src/engine/polynomials/**` and this document was edited; nothing committed.
