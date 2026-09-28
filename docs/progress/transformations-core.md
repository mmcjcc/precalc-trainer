# Transformations core (Unit 1: transformations, piecewise, average rate of change) — engine API and progress log

Engine core only (Claude, 2026-09-27). Templates, screens, catalog wording and ErrorPatternId registration
are the next builder's job. Everything lives in `src/engine/transformations/`; the public API is re-exported
from `@/engine` (`src/engine/index.ts`). Nothing committed.

**Status:** complete. `node node_modules/vitest/vitest.mjs run src/engine/transformations` → 7 files, 196 tests
green (spec 34, describe 33, points 36, equation 53, piecewise 18, rate 18, seeded properties 4).
`npm run typecheck` clean for the whole project (all three configs) at the time of writing. Full suite
(`node node_modules/vitest/vitest.mjs run`): 78 files, 1,279 tests, 4 failures, all "Test timed out in
5000ms" in files outside this folder (`src/content/modules/sigFigs/sigFigs.test.ts`,
`src/content/modules/electrons/electrons.crosscheck.test.ts`, `src/tutor/TutorPanel.test.tsx`); those three
files pass alone (53/53), so the failures come from a loaded parallel run, not from logic.

## 1. Conventions (read first)

- **The model.** g(x) = a·f(b(x − h)) + k, with a, b, h, k exact rationals (a ≠ 0, b ≠ 0) and f one of six
  parents: `'square'` x^2, `'cube'` x^3, `'sqrt'` sqrt(x), `'cbrt'` cbrt(x), `'abs'` abs(x), `'reciprocal'` 1/x.
  Build specs with `makeTransform` (it throws RangeError on a = 0, b = 0, an unknown parent or an unreadable
  number: a template bug).
- **Numbers** may be given as a `Rational` (`{ n, d }`), a JS number (read exactly as written: 0.1 is 1/10),
  or text (`'-3/2'`, `'0.5'`): the `RatLike` type. Everything graded is exact rational arithmetic (surds for
  square roots); no float is compared with a tolerance, except a probe where HER formula leaves the exact
  model (see `gradeEquation`).
- **Text fields** named `text`, `formula`, `condition`, `substitution`, and the renderers' output, are ASCII
  app syntax the parser reads back (`"-2(x - 3)^2 + 1"`, `"x >= 2"`). **Sentences** (`message`, `witness`,
  `steps`, `explanation`, `sentence`, `reason`) are display text with − ≤ ≥ ∞ ∪ already in them.
- **Statement form.** `StatementForm = 'factored' | 'unfactored'` says how the PROBLEM wrote the inside of f:
  `f(2(x − 3))` or `f(2x − 6)`. Pass it to the graders (option `{ form }`); it decides which named mistake a
  wrong answer is when two readings give the same answer (see §5).
- **Graders** return `TransformGrade`, the same shape as the functions core's `FunctionGrade`:

```ts
type TransformGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: TransformMistakeKind; witness: string }   // named, a sentence about HER numbers
  | { verdict: 'wrong'; message: string }                                    // wrong, plain specific sentence
  | { verdict: 'invalid'; message: string; position?: number; length?: number } // unreadable: not an attempt
  | { verdict: 'unsupported'; message: string }                              // the PROBLEM is outside the model
```

  `gradeDescription` returns `DescriptionGrade` (the same verdicts plus a `checks` list, one per step).
- **Mistake kinds** are a local union `TransformMistakeKind` (22 kinds, array `TRANSFORM_MISTAKE_KINDS`), NOT
  ErrorPatternIds. The transformation kinds are SHARED by the description, point and equation graders (a
  reversed horizontal shift is `h_shift_reversed` wherever it happens), so one catalog entry per kind serves
  all three screens and the Progress page counts the habit once.
- **Candidates and shadows.** Every `…Mistakes` function returns what each mistake WOULD produce for this
  problem, in priority order, dropping candidates equal to the right answer. When two kinds produce the same
  wrong answer the earlier kind wins and the later ones are listed in its `shadows`: a template can avoid
  ambiguous problems with `mistakes.every(c => c.shadows.length === 0)`.
- Deterministic: no randomness in the core.

## 2. API reference

Types (all exported from `@/engine`): `ParentName`, `ParentInfo`, `TransformSpec`, `TransformParams`,
`RatLike`, `PointLike`, `ExactPoint`, `StatementForm`, `KeyFeatures`, `TransformStep`, `StepInput`,
`StepSlot`, `DescribedStep`, `StepCheck`, `DescriptionGrade`, `TransformGrade`, `TransformMistakeKind`,
`PointMistakeCandidate`, `PointAnswerParse`, `EquationMistakeCandidate`, `PiecewisePiece`, `PiecewiseValue`,
`AverageRate`, `RateMistakeCandidate`. Definitions and field comments: `src/engine/transformations/types.ts`.

### 2.1 Specs, renderers, values

`makeTransform(parent: ParentName, params?: { a?, b?, h?, k?: RatLike }): TransformSpec` — defaults a = 1,
b = 1, h = 0, k = 0.
```ts
const g = makeTransform('square', { a: -2, h: 3, k: 1 })     // g(x) = -2(x - 3)^2 + 1
makeTransform('sqrt', { a: '-3/2', b: 0.5, h: '-1', k: 2 })  // a = -3/2, b = 1/2, h = -1, k = 2
makeTransform('square', { a: 0 })                            // throws RangeError: a cannot be 0 …
```

`specProblem(spec): string | null` — why an object is not a valid spec (graders return `unsupported` with it).

`PARENTS: Record<ParentName, ParentInfo>`, `PARENT_NAMES`, `parentFormula(parent)` — formula (`'x^2'`,
`'sqrt(x)'`, `'1/x'`…), words, symmetry (`'even'` x^2, abs; `'odd'` x^3, cbrt, 1/x; `'none'` sqrt), anchor name
and key points: x^2 (−2,4) (−1,1) (0,0) (1,1) (2,4); x^3 (−2,−8) (−1,−1) (0,0) (1,1) (2,8); sqrt (0,0) (1,1)
(4,2) (9,3); cbrt (−8,−2) (−1,−1) (0,0) (1,1) (8,2); abs (−2,2) (−1,1) (0,0) (1,1) (2,2); 1/x (−2,−1/2) (−1,−1)
(−1/2,−2) (1/2,2) (1,1) (2,1/2).

`fNotation(spec, form = 'factored'): string` and `explicitFormula(spec, form = 'factored'): string` — app syntax.
```ts
fNotation(g)                                              // '-2f(x - 3) + 1'
explicitFormula(g)                                        // '-2(x - 3)^2 + 1'
explicitFormula(makeTransform('sqrt', { b: -1, h: -2 }))  // 'sqrt(-(x + 2))'
explicitFormula(makeTransform('reciprocal', { a: 3, h: 1, k: 2 }))  // '3/(x - 1) + 2'
explicitFormula(makeTransform('reciprocal', { a: '-1/2', h: 3 }))   // '-1/(2(x - 3))'
explicitFormula(makeTransform('cube', { a: '-1/2', b: -1 }))        // '-(1/2)(-x)^3'
const s = makeTransform('sqrt', { b: 2, h: 3 })
fNotation(s)                    // 'f(2(x - 3))'     explicitFormula(s)                 // 'sqrt(2(x - 3))'
fNotation(s, 'unfactored')      // 'f(2x - 6)'       explicitFormula(s, 'unfactored')   // 'sqrt(2x - 6)'
```

`insideText(spec, form = 'factored')` — the inside of f alone: `'2(x - 3)'`, `'-2x + 6'`, `'-(x + 2)'`, `'(1/2)x'`.
`hasUnfactoredForm(spec): boolean` — b ≠ 1 and h ≠ 0 (the two forms differ; includes b = −1: `f(-x + 3)`).
`unfactoredConstant(spec): Rational` — b·h, the c of f(bx − c).

`transformValueAt(spec, x: RatLike): Surd | 'undef' | null` — g(x) exactly (a surd for sqrt); null when x is
unreadable or the value leaves the exact model (cube root of a non-cube).
```ts
transformValueAt(makeTransform('sqrt'), 2)                  // surd, surdToText → 'sqrt(2)'
transformValueAt(makeTransform('reciprocal', { h: 3 }), 3)  // 'undef'
transformValueAt(makeTransform('cbrt'), 2)                  // null
```

`sameGraph(s1, s2): boolean` — the two specs are the same function (exact canonical forms: a·b² for x^2,
a·|b| for abs, a·b³ for x^3, a/b for 1/x, a·√|b| and sign(b) for sqrt, a³·b for cbrt, plus h and k).
```ts
sameGraph(makeTransform('square', { a: 4 }), makeTransform('square', { b: -2 }))  // true: 4x^2 = (-2x)^2
sameGraph(makeTransform('cube', { a: -1, h: 3 }), makeTransform('cube', { b: -1, h: 3 }))  // true (odd)
sameGraph(makeTransform('sqrt', { b: 4 }), makeTransform('sqrt', { b: -4 }))      // false
```

### 2.2 Points and features

`mapPoint(spec, point: PointLike): ExactPoint` — (p, q) on f → (p/b + h, a·q + k) on g. Throws RangeError for
an unreadable point.
```ts
mapPoint(makeTransform('square', { a: -2, b: 2, h: 3, k: 1 }), { x: 4, y: 16 })  // (5, -31)
mapPoint(makeTransform('reciprocal', { a: 3, h: 1, k: 2 }), { x: '1/2', y: 2 })   // (3/2, 8)
```

`keyFeatures(spec): KeyFeatures` — anchor (vertex of x^2 and abs, start point of sqrt, center of x^3 and cbrt:
(0, 0) → (h, k)), asymptotes of 1/x (x = h, y = k), every key point with its image, exact domain and range
with interval text, and reading lines.
```ts
keyFeatures(g)
// anchor { name: 'vertex', parent: (0, 0), image: (3, 1) }, asymptotes null,
// domainInterval '(-inf, inf)', rangeInterval '(-inf, 1]',
// explanation ['The vertex (0, 0) of y = x^2 moves to (3, 1).', 'a = −2 < 0, so the graph opens down.',
//              'Domain: (−∞, ∞). Range: (−∞, 1].']
keyFeatures(makeTransform('sqrt', { b: -1, h: -2 })).explanation[1]
// 'From (−2, 0) the graph goes left (b = −1) and up (a = 1).'
keyFeatures(makeTransform('reciprocal', { a: 3, h: 1, k: 2 }))
// anchor null, asymptotes { vertical: 1, horizontal: 2 }, domain '(-inf, 1) U (1, inf)', range '(-inf, 2) U (2, inf)'
```
`specDomain(spec)`, `specRange(spec)` — the same sets alone. They agree with the functions core's
`domainOf`/`rangeOf` on `explicitFormula(spec)` in both forms (cross-checked on 1,000+ formulas in spec.test.ts),
so domain/range questions about g can use `gradeDomain(explicitFormula(spec), answer)` and `gradeRange(…)`.

`graphWindow(spec): [number, number]` — a symmetric square window (at least [−8, 8], at most [−30, 30]) that
shows (h, k) and the images of f's key points near the origin, for `GraphSpec.xDomain`.
```ts
graphWindow(makeTransform('square', { h: 10, k: -1 }))   // [-14, 14]
```

### 2.3 Steps in words

`describeTransform(spec, options?: { form?: StatementForm }): DescribedStep[]` (the brief's describe(spec);
renamed so it cannot clash with Vitest's `describe`). Standard order: reflect over the y-axis (b < 0),
horizontal stretch/compression by 1/|b|, horizontal shift h, reflect over the x-axis (a < 0), vertical
stretch/compression by |a|, vertical shift k. Each step has `slot`, `step` (a `TransformStep`), `sentence`,
`reason`. Throws RangeError for an invalid spec.
```ts
describeTransform(g).map(d => d.sentence)
// ['shift right 3', 'reflect over the x-axis', 'stretch vertically by a factor of 2', 'shift up 1']
describeTransform(makeTransform('sqrt', { b: 2, h: 3 })).map(d => d.sentence)
// ['compress horizontally by a factor of 1/2', 'shift right 3']
describeTransform(makeTransform('sqrt', { a: 3, b: 2, h: 3, k: -1 }), { form: 'unfactored' })[1].reason
// '2x − 6 = 2(x − 3) inside f'
```
`stepSentence(step: TransformStep): string` — `'compress vertically by a factor of 2/3'`, `'shift left 7/2'`.
`describeAsInputs(spec): StepInput[]` — g's steps as inputs (a "show me" reveal can fill the UI with them).

`gradeDescription(spec, chosen: readonly StepInput[], options?: { form?: StatementForm }): DescriptionGrade`
— graded as a SET (her order is not checked; see §4). A `StepInput` is
`{ kind: 'reflect', axis: 'x' | 'y' }`, `{ kind: 'shift', direction: 'left'|'right'|'up'|'down', amount: RatLike }`
or `{ kind: 'scale', axis: 'horizontal'|'vertical', word: 'stretch'|'compress', factor: RatLike }`. The UI can
pass her typed text straight in (`amount: '3/2'`). For a scale the WORD decides stretch or compress and the
number is read as the factor or its reciprocal, whichever fits the word ("compress by 2" = "compress by 1/2").
A negative amount turns the direction around. `checks` has one entry per step of g (`correct`, `wrong`,
`missing`) plus one per extra step of hers (`extra`), in slot order; each non-correct check names its mistake
when one fits. `verdict: 'mistake'` carries the first named one; `invalid` carries the `index` of the
unreadable step.
```ts
gradeDescription(g, [{ kind: 'shift', direction: 'up', amount: 1 }, { kind: 'reflect', axis: 'x' },
  { kind: 'scale', axis: 'vertical', word: 'stretch', factor: 2 }, { kind: 'shift', direction: 'right', amount: 3 }])
// { verdict: 'correct', message: 'Correct: shift right 3, reflect over the x-axis, stretch vertically by a factor of 2 and shift up 1.', checks }
gradeDescription(makeTransform('sqrt', { b: 2, h: 3 }),
  [{ kind: 'scale', axis: 'horizontal', word: 'compress', factor: '1/2' }, { kind: 'shift', direction: 'right', amount: 6 }],
  { form: 'unfactored' })
// { verdict: 'mistake', mistake: 'unfactored_shift', witness: 'Factor 2 out of the inside first: 2x − 6 = 2(x − 3).
//   The shift is what is subtracted from x after factoring, so g shifts right 3, not right 6.', checks }
gradeDescription(g, [{ kind: 'shift', direction: 'right', amount: 'three' }])
// { verdict: 'invalid', message: 'Could not read the shift amount "three". Type a number like 3, 1/2 or 2.5.', index: 0 }
```

### 2.4 Mapping a point

`parsePointAnswer(text): PointAnswerParse` — `(5, -3)`, `5,-3`, `( 1/2 , -0.5 )`, `(4/2 + 3, −1)`; each
coordinate read exactly (`x`/`y` are `Rational`, or null for a real number that is not rational, which is
simply never right). Errors carry a position: missing comma (at a `;` if she typed one), extra comma, x left
in a coordinate, `1/0`, unbalanced parentheses.

`mappedPointMistakes(spec, point, options?: { form? }): PointMistakeCandidate[] | null` (null: invalid spec or
point).
```ts
mappedPointMistakes(makeTransform('square', { a: -2, b: 2, h: 3, k: 1 }), { x: 4, y: 16 }).map(c => [c.kind, c.text])
// [['h_shift_reversed', '(-1, -31)'], ['v_shift_reversed', '(5, -33)'], ['unfactored_shift', '(8, -31)'],
//  ['missing_reflection', '(5, 33)'], ['reflection_wrong_axis', '(1, 33)' /* shadows factors_swapped */],
//  ['h_factor_inverted', '(11, -31)'], ['v_factor_inverted', '(5, -7)'], ['h_order', '(7/2, -31)'],
//  ['v_order', '(5, -34)'], ['factors_swapped', '(-5, 9)']]
```

`gradeMappedPoint(spec, point: PointLike, answer: string, options?: { form? }): TransformGrade`
```ts
const sp = makeTransform('square', { a: -2, b: 2, h: 3, k: 1 })
gradeMappedPoint(sp, { x: 4, y: 16 }, '(5, -31)')
// { verdict: 'correct', message: 'Correct: (4, 16) on f moves to (5, −31) on g (x = 4 ÷ 2 + 3 = 5, y = −2·16 + 1 = −31).' }
gradeMappedPoint(sp, { x: 4, y: 16 }, '(11, -31)')
// { verdict: 'mistake', mistake: 'h_factor_inverted', witness: 'The 2 multiplying x inside f squeezes the graph toward
//   the y-axis: DIVIDE the x-coordinate by 2. x = 4 ÷ 2 + 3 = 5. Your x-coordinate, 11, multiplies by 2: 2·4 + 3 = 11.' }
gradeMappedPoint(makeTransform('sqrt', { b: 2, h: 3 }), { x: 4, y: 2 }, '(8, 2)', { form: 'unfactored' })
// { verdict: 'mistake', mistake: 'unfactored_shift', witness: 'Factor 2 out first: 2x − 6 = 2(x − 3), so the shift is
//   right 3, not right 6. x = 4 ÷ 2 + 3 = 5. Your x-coordinate, 8, used 6: 4 ÷ 2 + 6 = 8.' }
gradeMappedPoint(sp, { x: 4, y: 16 }, '(5, 2.333)')
// { verdict: 'wrong', message: 'Your x-coordinate 5 is right. For y, multiply by −2, then add 1: y = −2·16 + 1 = −31.' }
```
A decimal close to a non-terminating fraction gets "2.33 is a rounded decimal: give the exact value, 7/3."

### 2.5 Writing the equation

`gradeEquation(spec, answer: string, options?: { form? }): TransformGrade` — she types g(x) as an explicit
formula in x (`g(x) =` or `y =` in front is fine; f-notation is `invalid` with a hint). Correct when her formula
is the same FUNCTION as g in any form (factored, expanded, inside multiplied out):
1. the same exact domain (the functions core's restriction walk: `sqrt(3 - x)` is not `sqrt(x - 3)`,
   `(x + 1)/(x^2 - 1)` is not `1/(x - 1)`, `(sqrt(x - 3))^4` is not `(x - 3)^2`);
2. the same exact value at 14 rational probes inside g's domain, chosen so every root is exact (for sqrt the
   inside is a perfect square, for cbrt a perfect cube), and undefined at probes outside it;
3. no disagreement from the existing float sampler (`compareOnSamples` from `engine/samples`, strict domain) at
   other points inside g's domain; samples are only taken where g is defined.
Where HER formula leaves the exact model at a probe (a cube root of a non-cube, a log) that probe is compared
as a float (relative 1e-9), the functions core's precedent.
```ts
gradeEquation(g, '-2x^2 + 12x - 17')        // { verdict: 'correct', message: 'Correct: g(x) = −2(x − 3)^2 + 1.' }
gradeEquation(g, '(-2(x - 3))^2 + 1')
// { verdict: 'mistake', mistake: 'v_factor_inside', witness: 'The −2 multiplies the OUTPUT of f, so it goes in front:
//   −2(x − 3)^2 + 1. Inside the parentheses it multiplies x instead, a horizontal change: at x = 4, g(4) = −1 but your formula gives 5.' }
const root = makeTransform('sqrt', { a: -1, b: 2, h: 3, k: 1 })   // -sqrt(2(x - 3)) + 1
gradeEquation(root, '-sqrt(2x - 3) + 1')
// { verdict: 'mistake', mistake: 'unfactored_shift', witness: 'The shift right 3 applies to x itself: x becomes x − 3, so
//   the inside is 2(x − 3) = 2x − 6: −sqrt(2(x − 3)) + 1. Your inside 2x − 3 factors as 2(x − 3/2), a shift right 3/2.' }
gradeEquation(makeTransform('sqrt', { h: 3 }), 'sqrt(3 - x)')
// { verdict: 'wrong', message: 'Your formula is defined at x = −1 (it gives 2), but g(−1) is undefined: the inside x − 3
//   is −4 there, and the square root of a negative number is undefined. Check each piece: what is inside f, the number
//   in front of f, and the number added after it.' }
gradeEquation(g, '-2f(x - 3) + 1')
// { verdict: 'invalid', message: "Write g(x) as a formula in x, with f's formula in place of f: f(x) = x^2, so f(x − 3) is (x − 3)^2.", position: 2, length: 1 }
```

`equationMistakes(spec, options?: { form? }): EquationMistakeCandidate[] | null` — each candidate is the spec
her wrong formula describes, its formula `text` and the `witness` the grader returns.
```ts
equationMistakes(g).map(c => [c.kind, c.text])
// [['h_shift_reversed', '-2(x + 3)^2 + 1'], ['v_shift_reversed', '-2(x - 3)^2 - 1'],
//  ['missing_reflection', '2(x - 3)^2 + 1' /* shadows reflection_wrong_axis: x^2 hides a y-axis reflection */],
//  ['v_factor_inverted', '-(1/2)(x - 3)^2 + 1'], ['v_factor_inside', '(-2(x - 3))^2 + 1'], ['v_shift_inside', '-2(x - 2)^2']]
equationMistakes(root).map(c => [c.kind, c.text])
// [['h_shift_reversed', '-sqrt(2(x + 3)) + 1'], ['v_shift_reversed', '-sqrt(2(x - 3)) - 1'],
//  ['unfactored_shift', '-sqrt(2x - 3) + 1'], ['unfactored_shift', '-sqrt(2(x - 6)) + 1'],
//  ['missing_reflection', 'sqrt(2(x - 3)) + 1'], ['reflection_wrong_axis', 'sqrt(-2(x - 3)) + 1' /* shadows v_factor_inside */],
//  ['h_factor_inverted', '-sqrt((1/2)(x - 3)) + 1'], ['v_shift_inside', '-sqrt(2(x - 5/2))']]
```
`isSameFunction(spec, answer): boolean` — the correctness test alone (for a flow that only needs yes/no).

### 2.6 Piecewise evaluation

`PiecewisePiece = { formula: string; interval: Piece }` where `Piece` is the shared
`{ lo: Rational | '-inf', hi: Rational | 'inf', loClosed, hiClosed }`. Formulas: polynomials or abs of linear
expressions (any formula whose value at a rational x is rational works). Intervals must not overlap.

`piecewiseProblem(pieces): string | null` — `'pieces 1 and 2 overlap'`, `'piece 1: its interval is empty'`, …
`pieceConditionText(interval): string` — `'x < 2'`, `'x >= 3'`, `'-1 <= x < 3'`, `'x = 4'`, `'x in R'`.

`evaluatePiecewise(pieces, x: RatLike): PiecewiseValue | null` (null: invalid pieces, unreadable x, or a
non-rational value)
```ts
// F: x^2 for x < 2; 2x + 1 for 2 <= x < 5; abs(x - 8) for x > 5
evaluatePiecewise(F, 2)
// { defined: true, pieceIndex: 1, value: 5, text: '5', condition: '2 <= x < 5', substitution: '2(2) + 1',
//   steps: ['x = 2 satisfies 2 ≤ x < 5, so use 2x + 1.', 'f(2) = 2(2) + 1 = 5.'] }
evaluatePiecewise(F, 5)
// { defined: false, steps: ['No piece includes x = 5: the pieces are for x < 2, 2 ≤ x < 5 and x > 5.', 'So f(5) is undefined.'] }
```

`gradePiecewiseValue(pieces, x: RatLike, answer: string): TransformGrade` — a number (exact) or a word for
undefined (`undefined`, `DNE`, `none`, …, the functions core's `parseValueAnswer`).
```ts
gradePiecewiseValue(F, 2, '4')
// { verdict: 'mistake', mistake: 'piecewise_boundary', witness: 'At x = 2 two pieces meet: x < 2 leaves 2 out (< does not
//   include the endpoint), and 2 ≤ x < 5 includes it. So f(2) = 2(2) + 1 = 5. Your answer, 4, comes from x^2, the piece that leaves 2 out.' }
gradePiecewiseValue(F, 7, '2')
// { verdict: 'wrong', message: 'x = 7 satisfies x > 5, so use abs(x − 8): f(7) = abs(7 − 8) = 1, not 2.' }
```

### 2.7 Average rate of change

`averageRateOfChange(f: string, a: RatLike, b: RatLike): AverageRate | null` — (f(b) − f(a))/(b − a) exactly for
polynomial and rational f (and any f whose values at a and b are rational, e.g. sqrt(x) on [1, 4]). Null when
f does not parse, a = b, f is undefined at a or b, or a value is irrational: never a float guess.
```ts
averageRateOfChange('x^2', 1, 4)
// { a: 1, b: 4, fa: 1, fb: 16, rise: 15, run: 3, rate: 5, text: '5',
//   steps: ['f(4) = 4^2 = 16 and f(1) = 1^2 = 1.', 'Average rate of change = (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 15/3 = 5.'] }
averageRateOfChange('1/x', 1, 3).text      // '-1/3'
averageRateOfChange('sqrt(x)', 1, 2)       // null (sqrt(2) is not rational)
```
`averageRateMistakes(f, a, b): RateMistakeCandidate[] | null`
```ts
averageRateMistakes('x^2', 1, 4).map(c => [c.kind, c.text])
// [['rate_sign_flipped', '-5'], ['rate_no_division', '15'], ['rate_inverted', '1/5'], ['rate_divided_by_b', '15/4']]
```
`gradeAverageRate(f, a, b, answer: string): TransformGrade`
```ts
gradeAverageRate('x^2', 1, 4, '15')
// { verdict: 'mistake', mistake: 'rate_no_division', witness: '15 is the change in f, f(4) − f(1) = 16 − 1 = 15. Divide it
//   by the change in x, 4 − 1 = 3: (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 5.' }
```

`toRational(v: RatLike): Rational | null` — the reader every function above uses (exported for the UI).

## 3. Mistake kinds and the exact wrong answer each produces

Samples: description and equation g(x) = −2f(x − 3) + 1 with f = x^2 unless the row says otherwise; points
g(x) = −2f(2(x − 3)) + 1 with f = x^2, (4, 16) → (5, −31); `root` = −sqrt(2(x − 3)) + 1.

| kind | where | what she did | sample | right | wrong answer produced |
|---|---|---|---|---|---|
| `h_shift_reversed` | describe | x − 3 read as left | f(x − 3) | shift right 3 | shift left 3 |
| | point | p/b − h | (4, 16) | (5, −31) | (−1, −31) |
| | equation | sign of h | g | −2(x − 3)^2 + 1 | −2(x + 3)^2 + 1 |
| `v_shift_reversed` | describe | + k read as down | f(x) + 1 | shift up 1 | shift down 1 |
| | point | a·q − k | (4, 16) | (5, −31) | (5, −33) |
| | equation (extra) | sign of k | g | | −2(x − 3)^2 − 1 |
| `h_factor_inverted` | describe | f(2x) read as a stretch | f(2x) | compress horizontally by a factor of 1/2 | stretch horizontally by a factor of 2 |
| | point | b·p + h | (4, 16) | (5, −31) | (11, −31) |
| | equation | b → 1/b | root | −sqrt(2(x − 3)) + 1 | −sqrt((1/2)(x − 3)) + 1 |
| `v_factor_inverted` | describe | 1/2 read as stretch by 2 | (1/2)f(x) | compress vertically by a factor of 1/2 | stretch vertically by a factor of 2 |
| | point (extra) | q/a + k | (4, 16) | (5, −31) | (5, −7) |
| | equation (extra) | a → 1/a | g | | −(1/2)(x − 3)^2 + 1 |
| `reflection_wrong_axis` | describe | −f(x) vs f(−x) | −f(x) (sqrt) | reflect over the x-axis | reflect over the y-axis |
| | point | sign on the wrong coordinate | (4, 16) | (5, −31) | (1, 33) |
| | equation | minus inside instead of in front | root | | sqrt(−2(x − 3)) + 1 |
| `unfactored_shift` | describe | f(2x − 6) read as right 6 | f(2x − 6) | shift right 3 | shift right 6 |
| | point | used c instead of c/b | f(2x − 6), (4, 16) | (5, −31) | (8, −31) |
| | equation | f(bx − h) for f(b(x − h)), and the reverse | root | | −sqrt(2x − 3) + 1; −sqrt(2(x − 6)) + 1 |
| `missing_reflection` | describe | left out a reflection | g | reflect over the x-axis | (not listed) |
| | point (extra) | dropped the sign of a (or b) | (4, 16) | (5, −31) | (5, 33) |
| | equation (extra) | dropped the minus | g | | 2(x − 3)^2 + 1 |
| `missing_step` | describe | left out a shift or scale | f(x − 3) + 1 | shift up 1 | (not listed) |
| `extra_step` | describe | a step g does not have, or two for one slot | f(x − 3) | shift right 3 | + shift up 2 |
| `h_order` (extra) | point | (p + h)/b: shifted before dividing | (4, 16) | (5, −31) | (7/2, −31) |
| `v_order` | point | a·(q + k) | (4, 16) | (5, −31) | (5, −34) |
| `factors_swapped` | point | a on x, b on y | (4, 16) | (5, −31) | (−5, 9) (and (1, 33), shadowed above) |
| `v_factor_inside` | equation | a inside the parent: f(a·b(x − h)) + k | g | | (−2(x − 3))^2 + 1 |
| `v_shift_inside` | equation | k inside the parent: a·f(b(x − h) + k) | g | | −2(x − 3 + 1)^2 = −2(x − 2)^2 |
| `piecewise_boundary` | piecewise | the neighbouring piece at a boundary | F at 2 | 5 | 4 |
| `piecewise_wrong_piece` | piecewise | a piece whose interval misses x | F at 3 | 7 | 9 |
| `piecewise_value_where_undefined` | piecewise | a number where no piece applies | F at 5 | undefined | 11 (any number) |
| `piecewise_undefined_where_defined` | piecewise | "undefined" where a piece applies | F at 1 | 1 | undefined |
| `rate_sign_flipped` | rate | subtractions in opposite orders | x^2 on [1, 4] | 5 | −5 |
| `rate_no_division` | rate | forgot to divide | x^2 on [1, 4] | 5 | 15 |
| `rate_inverted` | rate | run over rise | x^2 on [1, 4] | 5 | 1/5 |
| `rate_divided_by_b` | rate | divided by b, not b − a | x^2 on [1, 4] | 5 | 15/4 |

"(extra)" marks cheap additions beyond the brief's lists. Sample witnesses are in §2 and in the tests
(`describe.test.ts`, `points.test.ts`, `equation.test.ts`, `piecewise.test.ts`, `rate.test.ts` assert the exact
strings).

## 4. Decisions

- **Descriptions are graded as a set.** Each of her steps is matched to the slot it acts on and compared with
  g's step for that slot; her order is not checked, because textbooks and teachers list these steps in
  different orders. The amounts are graded as the standard order needs them: the horizontal shift is h (the
  shift of the factored form, applied after the horizontal scaling). `describeTransform` gives the standard
  order for the reveal.
- **Reflections are read from the formula.** For the odd parents (x^3, cbrt, 1/x) a reflection over the wrong
  axis happens to draw the same graph (f(−x) = −f(x)); it is still named `reflection_wrong_axis` in the
  description and point graders, with a witness that says the graphs agree but the formula does not. In the
  EQUATION grader, which compares functions, (−(x − 3))^3 is simply correct for −(x − 3)^3. For the even parents
  (x^2, abs) a reflection over the y-axis does not change the graph, so in a description it is optional (listing
  it or leaving it out are both correct; the confirmation mentions it).
- **Scale wording.** The word decides stretch or compress; the number is the factor or its reciprocal,
  whichever fits the word, so both textbook conventions ("compress by 1/2", "compress by 2") are accepted and
  "stretch by 2" for f(2x) is `h_factor_inverted`.
- **The unfactored form includes b = −1** (`f(-x + 3)`, `sqrt(3 - x)`): there "shift left 3" is
  `unfactored_shift` when the problem wrote it unfactored and `h_shift_reversed` when factored.
- **Shared kinds** across contexts (see §1); point- and equation-only kinds are named so.
- **Exactness.** Specs, mapping, candidates and piecewise/rate values are exact rationals; equation grading is
  exact at its probes (surds for square roots), with a float fallback only at a probe where her formula leaves
  the exact model.

## 5. Notes for the content stage

- **Register** one ErrorPatternId per kind you use (e.g. `tf_h_shift_reversed`) and map `grade.mistake` → id;
  use `grade.witness` as the PatternHit witness. `TRANSFORM_MISTAKE_KINDS` lists all 22. For descriptions, each
  `check.mistake` can be recorded (several per attempt).
- **Which statement forms set which traps:**
  - f-notation factored, `g(x) = -2f(2(x - 3)) + 1`: shift direction (x − 3 is right), f(2x) read as a
    stretch, the order of operations for points (`h_order`, `v_order`), a and b swapped.
  - f-notation unfactored, `g(x) = f(2x - 6)` (`fNotation(spec, 'unfactored')`): the classic trap, "right 6";
    pass `{ form: 'unfactored' }` to every grader. Only meaningful when `hasUnfactoredForm(spec)`.
  - `f(-x + 3)` / `sqrt(3 - x)` (b = −1, unfactored): reflect over the y-axis AND shift RIGHT 3.
  - Words to equation ("compress horizontally by a factor of 1/2, then shift right 3"): the f(2x − 3) trap
    (`unfactored_shift`), a minus sign on the wrong side of f, a or k written inside the parentheses.
  - `-f(x)` vs `f(-x)`: use sqrt (neither even nor odd) when the point is the axis; with x^2 or abs, f(−x) is
    invisible; with x^3, cbrt, 1/x the two reflections draw the same graph.
- **Template constraints worth adding:** avoid b < 0 with x^2/abs unless the question is about that; avoid
  both reflections on an odd parent (they cancel); for point questions pick key points whose candidates have no
  shadows (`mappedPointMistakes(spec, p, { form }).every(c => c.shadows.length === 0)`); for rates the same with
  `averageRateMistakes`. Keep |a|, |b| ≠ 1 when the scale is the point of the question.
- **Template self-tests** (per seed): `makeTransform` does not throw; `gradeEquation(spec, explicitFormula(spec,
  form)).verdict === 'correct'` for both forms; `gradeMappedPoint(spec, p, pointText)` correct for the chosen key
  point; `gradeDescription(spec, describeAsInputs(spec))` correct; piecewise: `piecewiseProblem(pieces) === null`
  and `evaluatePiecewise(pieces, x) !== null`; rates: `averageRateOfChange(f, a, b) !== null`.
- **Showing f and g on the existing graph component** (`components/Graph.tsx`, function-plot): use
  `GraphSpec { kind: 'function', f: parentFormula(spec.parent), extra: [{ expr: explicitFormula(spec), label: 'g',
  style: 'solid', color: 'coral' }], xDomain: graphWindow(spec) }`: f is drawn navy, g coral, in a square window;
  both strings are app syntax the Graph's `evalExpr` reads. The graph shows the answer, so keep it behind the
  reveal gate like the other modules. `Graph` has no point markers (`GraphSpec.markers` is only drawn by
  `SampledGraph`); list `keyFeatures(spec).points` / the anchor in text instead, or extend Graph (UI work). Check
  a 1/x graph in the browser: function-plot may join the two branches across x = h.
- **Average rate of change** reuses the difference-quotient module's secant sketch: `GraphSpec { kind:
  'function', f, secant: { x0: a, h0: b - a } }` draws the secant whose slope is the rate.
- **Domain and range of g**: `keyFeatures(spec).domain/range` (exact), graded with the functions core's
  `gradeDomain` / `gradeRange` on `explicitFormula(spec)`.
- `invalid` is a parse problem (show the message under the input, do not count an attempt); `unsupported`
  means the template produced something outside the model.

## 6. Layering

Like the functions core, `src/engine/transformations` imports the exact-set code from `@/notation/rational`
and `@/notation/sets/solutionSet` directly (those files import only `@/shared/types`, so there is no cycle), and
reuses the functions core's internals (`../functions/exact`, `text`, `answer`, `common`, `solve`). No shared
types were changed.

## Log
- [started] plan written (types, text, spec, describe, points, equation, piecewise, rate, index).
- [done] all modules; exports appended to `src/engine/index.ts`.
- [done] `spec.test.ts` (34: renderers, exact mapping for every parent × sign combination, key features,
  domain/range cross-checked against `domainOf`/`rangeOf` on 1,000+ formulas, `sameGraph` vs exact
  evaluation), `describe.test.ts` (33: all 324 sign combinations of a, b, h, k), `points.test.ts` (36),
  `equation.test.ts` (53: equivalent forms, wrong-domain cases, every candidate of every parent grades as its own
  kind), `piecewise.test.ts` (18: both sides of each boundary), `rate.test.ts` (18), `property.test.ts` (4 seeded
  loops: 300 specs × key points, 100 specs × equation candidates, 300 piecewise functions × x values, 200 rates).
- Decision: witness points in equation messages all read "at x = …"; they prefer an x where both values are
  rational, then a domain difference next to a rational value.
- Sweep tests carry a 120 s timeout (as the functions core's do): under a full parallel run they exceed the 5 s
  default although each takes 3 to 5 s alone.
