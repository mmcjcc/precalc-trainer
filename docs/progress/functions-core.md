# Functions core (Unit 1: domain and range, composition) — engine API and progress log

Engine core only (Claude, 2026-09-21). Templates, screens, catalog wording and ErrorPatternId registration
are the next builder's job. Everything lives in `src/engine/functions/`; the public API is re-exported
from `@/engine` (`src/engine/index.ts`). Nothing committed.

**Status:** complete. `node node_modules/vitest/vitest.mjs run src/engine/functions` → 5 files, 164 tests
green (domain 63, range 38, compose 49, exact/poly/text 11, seeded properties 3). `npm run typecheck`
clean for the whole project. Full suite `npm test` green (54 files) at the time of writing.

## 1. Conventions (read first)

- **Input functions** are app-syntax strings in x, exactly what templates store: `"sqrt(x + 2)/(x - 3)"`,
  `"-2sqrt(x + 1) + 5"`, `"|x| - 3"`. A leading `"f(x) ="` (any single letter) is allowed.
- **Sets are exact** `SolutionSet`s (`@/shared/types`) with rational endpoints, compared with `setsEqual`.
  No float tolerance anywhere in domain/range answers.
- **Text fields** named `interval`, `builder`, `text`, `expr`, `condition`, `solved` are ASCII app syntax
  (`parseInterval` / `parseSetAnswer` / `parseExpression` read them back). **Sentences** (`explanation`,
  `witness`, `message`, `steps`) are display text with − ≥ ≤ ≠ ∞ ∪ ∘ already in them; show them as-is.
- **null** from a `…Of` / `…Mistakes` function means the PROBLEM is outside the exact model (see §2). A
  template must never produce such a function: test every template with `domainOf(f) !== null` etc.
- **Graders** return `FunctionGrade`:

```ts
type FunctionGrade =
  | { verdict: 'correct'; message: string }                                // done
  | { verdict: 'mistake'; mistake: FunctionMistakeKind; witness: string }  // named mistake, sentence about HER numbers
  | { verdict: 'wrong'; message: string }                                  // wrong, plain specific sentence
  | { verdict: 'invalid'; message: string; position?: number; length?: number } // unreadable input: not an attempt
  | { verdict: 'unsupported'; message: string }                            // problem outside the model (template bug)
```

- **Mistake kinds** are a local union `FunctionMistakeKind` (list in §4, array `FUNCTION_MISTAKE_KINDS`).
  They are NOT ErrorPatternIds: the content stage registers ids + catalog wording and maps kind → id.
- **Set answers** accepted by every set grader (string or a `SolutionSet` from an existing input):
  interval `"[-2, 3) U (3, inf)"`, set-builder `"{x | x >= -2 and x != 3}"`, `"{x | x ≥ -2, x ≠ 3}"`,
  bare `"x != 3"`, `"x < 3 or x > 3"`, `"all real numbers except 3 and -2"`, `"R"`, `"all real numbers"`,
  range answers in y (`"{y | y != 1}"`). NOTE: the notation layer's `parseSetBuilder` (used by the existing
  SetBuilderInput) rejects `≠` on purpose (right for inequalities); for domain/range inputs call
  `parseSetAnswer` or pass her raw text to the grader.
- **Value answers**: a constant expression (`"11"`, `"-1/2"`, `"2sqrt(3)"`, `"sqrt(8)/2"`, `"0.5"`) or a word
  for undefined (`undefined`, `undef`, `DNE`, `none`, `does not exist`, `no value`, `∅`, `{}`).
- Deterministic: no randomness in the core; witness points are the friendliest numbers (integers near 0,
  preferring an x where f's value is an integer).

## 2. Supported shapes (null otherwise, never a guess)

**Domain** (`domainOf`, `gradeDomain`): polynomials; rational functions whose denominators have only
rational real roots (irreducible factors with no real roots, e.g. x^2 + 4, are fine; Sturm's theorem
proves it); even roots (sqrt, nthRoot(u, 4), u^(1/2), u^(1/4)) of expressions whose boundary points are
rational (linear, factorable quadratics, rational functions); an even root as a factor of a denominator
(radicand > 0); odd roots (cbrt, nthRoot(u, 3), u^(1/3)); |u|; integer powers (negative ones are
denominators); sums, differences, products and quotients of all of these, nested. Not supported: irrational
boundary points (`1/(x^2 - 2)`, `sqrt(x^2 - 3)`), log/trig/exp, pi in a restriction, variable exponents,
x^(3/2)-style powers.

**Range** (`rangeOf`, `gradeRange`): constant; linear; quadratic (vertex); odd-degree polynomial (all reals);
a·sqrt(bx + c) + d and any even root of a linear expression; a·|bx + c| + d; a·cbrt(bx + c) + d and any odd
root; a/(x - h) + k, also written (px + q)/(rx + s). The formula must have the family's natural domain
(`1/(1/x)` is not "linear"). Not supported: even-degree polynomials of degree ≥ 4, anything with two roots,
roots of non-linear expressions, holes (`(x^2 - 1)/(x - 1)`).

**Composition**: any f, g in the domain model. `compositeDomain` needs the preimage of dom f under g to have
rational endpoints (`f = sqrt(x - 1), g = x^2 - 1` needs ±√2 → null; the formula path agrees). Values
(f∘g)(a) are exact rationals or rational combinations of square roots; anything else (cbrt(5)) is kept as its
unevaluated expression text and compared as a float (1e-9 relative). Formula answers are compared by exact
cross-multiplication when both are rational expressions (a proof), else by exact evaluation at 14+ rational
probe points of the composite's domain.

## 3. API reference

Types (all exported from `@/engine`):

```ts
interface DomainRestriction {
  kind: 'denominator' | 'even_root' | 'even_root_denominator'
  expr: string          // "x - 3" (the denominator) or "-2x + 6" (the radicand)
  relation: '!=' | '>=' | '>'
  condition: string     // "x - 3 != 0"
  set: SolutionSet      // where the condition holds (inside expr's own domain), exact
  solved: string        // "x != 3", "x <= 3", "x <= -3 or x >= 3"
  index?: number        // root index (root kinds)
  root?: string         // "sqrt(x - 1)" (root kinds)
}
interface DomainResult {
  f: string; set: SolutionSet; interval: string; builder: string
  restrictions: DomainRestriction[]
  oddRoots: { expr: string; index: number; root: string }[]
  explanation: string[]  // ordered lines for the hint reveal / after a correct answer
}
type RangeFamily = 'constant' | 'linear' | 'quadratic' | 'odd_polynomial' | 'even_root' | 'absolute_value' | 'odd_root' | 'reciprocal'
interface RangeResult {
  f: string; family: RangeFamily; set: SolutionSet; interval: string
  builder: string                                    // in y: "{y | y != 2}"
  params: { a?: Rational; h?: Rational; k?: Rational } // quadratic: a, vertex (h, k); roots/abs: a·root(..)+k with h where
  explanation: string[]                              //   the inside is 0; reciprocal: a/(x-h)+k; linear: a slope, k intercept
}
interface SetMistakeCandidate { kind: FunctionMistakeKind; set: SolutionSet; interval: string; witness: string }
interface ExpressionMistakeCandidate { kind: FunctionMistakeKind; text: string; witness: string }
interface ValueMistakeCandidate { kind: FunctionMistakeKind; text: string; witness: string }
interface CompositionText { unsimplified: string; simplified: string }
interface CompositeDomainResult {
  set: SolutionSet; interval: string; builder: string
  innerDomain: SolutionSet            // dom g
  outerDomain: SolutionSet            // dom f
  simplified: string                  // simplified f(g(x))
  simplifiedDomain: SolutionSet | null // what the simplified formula alone would suggest
  hidesRestriction: boolean           // the trap: simplifiedDomain != set
  explanation: string[]
}
interface ExactNumber { exact: Surd | null; approx: number; text: string } // text is exact app syntax
type CompositeValue =
  | { defined: true; value: ExactNumber; inner: ExactNumber; steps: string[] }
  | { defined: false; reason: 'inner' | 'outer'; inner?: ExactNumber; steps: string[] }
type DecompositionResult =
  | { ok: true; message: string }
  | { ok: false; reason: 'parse_f' | 'parse_g' | 'trivial_f' | 'trivial_g' | 'not_equal' | 'domain' | 'unsupported'
      message: string; position?: number; length?: number }
```

### Domain

`domainOf(f: string): DomainResult | null`
```ts
domainOf('sqrt(x + 2)/(x - 3)')
// set = [-2, 3) U (3, inf); interval '[-2, 3) U (3, inf)'; builder '{x | x >= -2 and x != 3}'
// restrictions: [even_root 'x + 2 >= 0' solved 'x >= -2', denominator 'x - 3 != 0' solved 'x != 3']
// explanation: ['The square root sqrt(x + 2) needs a radicand ≥ 0: x + 2 ≥ 0 → x ≥ −2.',
//               'The denominator x − 3 cannot be 0: x − 3 ≠ 0 → x ≠ 3.',
//               'Domain: [−2, 3) ∪ (3, ∞), that is, x ≥ −2 and x ≠ 3.']
```

`domainMistakes(f: string): SetMistakeCandidate[] | null` — what each domain mistake produces for f, in
priority order, each different from the domain and from each other (candidates that coincide with the
answer are skipped).
```ts
domainMistakes('1/(x - 3)').map(c => [c.kind, c.interval])
// [['domain_forgot_denominator', '(-inf, inf)'], ['domain_denominator_nonneg', '[3, inf)'],
//  ['domain_denominator_nonneg', '(3, inf)'], ['domain_gave_range', '(-inf, 0) U (0, inf)']]
```

`gradeDomain(f: string, answer: SolutionSet | string): FunctionGrade`
```ts
gradeDomain('sqrt(-2x + 6)', '[3, inf)')
// { verdict: 'mistake', mistake: 'domain_no_flip', witness: 'From −2x + 6 ≥ 0: −2x ≥ −6; dividing by −2, a
//   negative number, flips the inequality, so x ≤ 3. Your answer points the other way: at x = 4 the
//   radicand −2x + 6 is −2, which is negative.' }
gradeDomain('sqrt(x - 2)', '[5, inf)')
// { verdict: 'wrong', message: 'x = 2 is in the domain: f(2) = 0, but your answer leaves it out.' }
```

### Range

`rangeOf(f: string): RangeResult | null`
```ts
rangeOf('-2x^2 + 4x + 3')   // family 'quadratic', interval '(-inf, 5]', builder '{y | y <= 5}', params a=-2 h=1 k=5
// explanation: ['f(x) = −2x^2 + 4x + 3 is a quadratic with a = −2 < 0, so the parabola opens down and its vertex is the highest point.',
//               'Vertex: x = −b/(2a) = −4/(2·(−2)) = 1, and f(1) = 5.',
//               'So every output is ≤ 5, and each of those values is reached.', 'Range: (−∞, 5].']
```

`rangeMistakes(f: string): SetMistakeCandidate[] | null`
```ts
rangeMistakes('3/(x - 2) + 1').map(c => [c.kind, c.interval])
// [['range_gave_domain', '(-inf, 2) U (2, inf)'], ['range_included_asymptote', '(-inf, inf)']]
```

`gradeRange(f: string, answer: SolutionSet | string): FunctionGrade`
```ts
gradeRange('3/(x - 2) + 1', '{y | y != 1}')   // { verdict: 'correct', message: 'Correct: the range is (−∞, 1) ∪ (1, ∞).' }
gradeRange('sqrt(x - 3)', '(0, inf)')          // { verdict: 'wrong', message: 'y = 0 is an output, f(3) = 0, but your answer leaves it out.' }
```

### Composition

`composeText(f: string, g: string): CompositionText | null` — g goes in IN PARENTHESES (a single call such
as sqrt(x) only under an exponent); the simplified form expands and reduces the rational parts and applies
(sqrt(u))^2 → u, (cbrt(u))^3 → u, cbrt(u^3) → u. The simplified form is verified equal to the unsimplified
one on the composite's domain (else the unsimplified text is returned).
```ts
composeText('x^2 + 1', 'x - 3')   // { unsimplified: '(x - 3)^2 + 1', simplified: 'x^2 - 6x + 10' }
composeText('x^2', 'sqrt(x)')     // { unsimplified: '(sqrt(x))^2', simplified: 'x' }
composeText('2x + 1', '1/x')      // { unsimplified: '2(1/x) + 1', simplified: '(x + 2)/x' }
```

`compositeDomain(f: string, g: string): CompositeDomainResult | null` — {x in dom g : g(x) in dom f},
computed from dom g and the preimage of dom f under g, never from the simplified formula.
```ts
compositeDomain('x^2', 'sqrt(x)')
// interval '[0, inf)', simplified 'x', simplifiedDomain (-inf, inf), hidesRestriction true
// explanation: ['First, x must be in the domain of g(x) = sqrt(x): [0, ∞) (x ≥ 0).',
//   'f(x) = x^2 accepts every real number, so every output of g is allowed.', 'Domain of f∘g: [0, ∞) (x ≥ 0).',
//   'Careful: the simplified formula x on its own would allow (−∞, ∞), but g(x) has to be defined first, so the domain stays [0, ∞).']
compositeDomain('1/(x - 2)', 'sqrt(x)').explanation[1]
// 'f(x) = 1/(x − 2) needs x − 2 ≠ 0. With g(x) in place of x that is sqrt(x) − 2 ≠ 0, which holds for x ≥ 0 and x ≠ 4.'
```

`compositeDomainMistakes(f: string, g: string): SetMistakeCandidate[] | null`
```ts
compositeDomainMistakes('x^2', 'sqrt(x)').map(c => [c.kind, c.interval])  // [['composite_domain_simplified', '(-inf, inf)']]
```

`gradeCompositeDomain(f: string, g: string, answer: SolutionSet | string): FunctionGrade`
```ts
gradeCompositeDomain('1/(x - 2)', 'sqrt(x)', '[0, inf)')
// { verdict: 'mistake', mistake: 'composite_domain_inner_only', witness: 'You kept only the domain of g. Its output
//   g(x) also has to be an allowed input for f: at x = 4, g(4) = 2, and f(2) is undefined (the denominator x − 2 is 0 at x = 2).' }
```

`compositionMistakes(f: string, g: string): ExpressionMistakeCandidate[] | null` — each candidate differs
from f(g(x)), is defined on an interval, and differs from earlier candidates.
```ts
compositionMistakes('x^2 + 1', 'x - 3').map(c => [c.kind, c.text])
// [['compose_no_parens', 'x - 3^2 + 1'], ['compose_partial_sub', 'x^2 + 1'], ['compose_product', '(x^2 + 1)(x - 3)'],
//  ['compose_reversed', '(x^2 + 1) - 3'], ['compose_sum', 'x^2 + 1 + (x - 3)']]
```

`gradeComposition(f: string, g: string, answer: string): FunctionGrade` — any equivalent form on the
composite's domain is correct (unsimplified, simplified, expanded, "f(g(x)) =" / "(f o g)(x) =" in front).
Her form must be defined on the whole composite domain.
```ts
gradeComposition('x^2 + 1', 'x - 3', 'x - 8')
// { verdict: 'mistake', mistake: 'compose_no_parens', witness: 'Put g(x) in parentheses when you substitute: x → (x − 3)
//   turns x^2 + 1 into (x − 3)^2 + 1. Without them it reads x − 3^2 + 1, and f's exponents and coefficients reach
//   only part of x − 3. At x = 1: f(g(1)) = f(−2) = 5, but x − 3^2 + 1 gives −7.' }
gradeComposition('x^2 + 1', 'x - 3', 'x^2 + 7')
// { verdict: 'wrong', message: 'At x = 1: f(g(1)) = f(−2) = 5, but your expression gives 8. Replace every x in f with (x − 3).' }
```

`compositeValue(f: string, g: string, a: Rational | number | string): CompositeValue | null`
```ts
compositeValue('2x + 5', 'x^2 - 1', 2)
// { defined: true, value: { text: '11', ... }, inner: { text: '3', ... },
//   steps: ['g(2) = 2^2 − 1 = 3.', 'f(3) = 2(3) + 5 = 11.', '(f∘g)(2) = 11.'] }
compositeValue('sqrt(x)', 'x - 5', 1)
// { defined: false, reason: 'outer', steps: ['g(1) = 1 − 5 = −4.',
//   'f(−4) = sqrt(−4) is undefined: the radicand x is −4 at x = −4, which is negative.',
//   'So (f∘g)(1) is undefined: g(1) = −4 is not in the domain of f.'] }
compositeValue('sqrt(x)', 'x + 1', 1)   // value.text 'sqrt(2)' (exact)
```

`compositeValueMistakes(f, g, a): ValueMistakeCandidate[] | null`
```ts
compositeValueMistakes('2x + 5', 'x^2 - 1', 2).map(c => [c.kind, c.text])  // [['value_product', '27'], ['value_reversed', '80']]
```

`gradeCompositeValue(f: string, g: string, a: Rational | number | string, answer: string): FunctionGrade` —
exact comparison (`22/2`, `0.5` for 1/2, `sqrt(8)/2` for sqrt(2) are correct); a decimal close to an
irrational answer gets "X is a rounded decimal. Give the exact value: …"; "undefined"/"DNE" is graded
against `defined`.
```ts
gradeCompositeValue('2x + 5', 'x^2 - 1', 2, '27')
// { verdict: 'mistake', mistake: 'value_product', witness: 'You multiplied f(2)·g(2) = 9·3 = 27. (f∘g)(2) means
//   f(g(2)): first g(2) = 3, then f(3) = 11.' }
```

`checkDecomposition(h: string, f: string, g: string): DecompositionResult` — accepted when f(g(x)) equals h
(values, and the same domain when both are exact) and neither f nor g is just x.
```ts
checkDecomposition('1/(x - 3)^2', '1/x^2', 'x - 3')   // { ok: true, message: 'Yes: f(g(x)) = 1/(x − 3)^2 = h(x).' }
checkDecomposition('1/(x - 3)^2', '1/x', '(x - 3)^2') // { ok: true, ... }  (a second valid answer)
checkDecomposition('(2x + 1)^3', 'x', '(2x + 1)^3')   // { ok: false, reason: 'trivial_f', message: 'f(x) = x does nothing: …' }
checkDecomposition('(2x + 1)^3', 'x^3', '2x')         // { ok: false, reason: 'not_equal', message: 'f(g(x)) = (2x)^3 is not h(x):
                                                      //   at x = 1, h(1) = 27, but f(g(1)) = f(2) = 8.' }
checkDecomposition('x^3', 'x^6', 'sqrt(x)')           // { ok: false, reason: 'domain', ... } (equal only for x ≥ 0)
```

`compositeAtText(f: string, g: string, x: Rational | number): string | null` — a hint line.
```ts
compositeAtText('x^2 + 1', 'x - 3', 1)   // 'f(g(1)) = f(−2) = 5'
```

### Helpers

`parseSetAnswer(text: string): { ok: true; set } | { ok: false; error: ParseError }` — every set form in §1.
```ts
parseSetAnswer('{x | x >= 1, x != 3}')   // ok, set [1, 3) U (3, inf)
```
`parseValueAnswer(text: string)` → `{ ok: true; undefined: true } | { ok: true; undefined: false; node; text } | { ok: false; error }`.
```ts
parseValueAnswer('DNE')   // { ok: true, undefined: true }
```
`setToBuilderText(set: SolutionSet, v = 'x'): string` — `'{x | x >= -2 and x != 3}'`, `'{y | y != 1}'`.
`describeSetText(set: SolutionSet, v = 'x'): string` — `'all real numbers except -1 and 2'`, `'x >= -2 and x != 3'`.
`substituteFunctionText(f: string, g: string): string` — `substituteFunctionText('2x + 1', 'x - 3') === '2(x - 3) + 1'`.
`surdToText(s: Surd): string` — `'2sqrt(3)'`, `'-1 + sqrt(2)'`.
`FUNCTION_MISTAKE_KINDS: readonly FunctionMistakeKind[]` — all 19 kinds (for registering catalog entries).

## 4. Mistake kinds and the exact wrong answer each produces

Detection: compute what the mistake WOULD produce for this function, compare her answer exactly (sets:
`setsEqual`; values: exact surds; formulas: §2). A candidate equal to the right answer is skipped; when two
kinds produce the same set, the earlier one in this table wins.

| kind | what she did | sample | right answer | wrong answer produced |
|---|---|---|---|---|
| `domain_forgot_denominator` | dropped a denominator ≠ 0 | `sqrt(x + 2)/(x - 3)` | `[-2, 3) U (3, inf)` | `[-2, inf)` |
| `domain_root_denominator_zero` | used ≥ for an even root in a denominator | `1/sqrt(x - 1)` | `(1, inf)` | `[1, inf)` |
| `domain_root_strict` | used > where ≥ belongs (left out the radicand's zero) | `sqrt(x + 2)/(x - 3)` | `[-2, 3) U (3, inf)` | `(-2, 3) U (3, inf)` |
| `domain_no_flip` | divided by a negative without flipping | `sqrt(-2x + 6)` | `(-inf, 3]` | `[3, inf)` |
| `domain_odd_root_restricted` | restricted an odd root like an even one | `cbrt(x - 2)` | `(-inf, inf)` | `[2, inf)` |
| `domain_denominator_nonneg` | wrote D >= 0 (or D > 0) instead of D != 0 | `1/(x - 3)` | `(-inf, 3) U (3, inf)` | `[3, inf)` and `(3, inf)` |
| `domain_gave_range` | gave the range | `sqrt(-2x + 6)` | `(-inf, 3]` | `[0, inf)` |
| `range_gave_domain` | gave the domain | `-2sqrt(x + 1) + 5` | `(-inf, 5]` | `[-1, inf)` |
| `range_reflection_ignored` | wrong side for a < 0 (root, abs, downward parabola) | `-2sqrt(x + 1) + 5` | `(-inf, 5]` | `[5, inf)` |
| `range_included_asymptote` | kept y = k for a/(x - h) + k | `3/(x - 2) + 1` | `(-inf, 1) U (1, inf)` | `(-inf, inf)` |
| `compose_no_parens` | substituted g without parentheses | f = `x^2 + 1`, g = `x - 3` | `(x - 3)^2 + 1` | `x - 3^2 + 1` (= x − 8) |
| `compose_partial_sub` | replaced only some x's (or none) | f = `x^2 + 2x`, g = `x + 1` | `(x + 1)^2 + 2(x + 1)` | `(x + 1)^2 + 2x`, `x^2 + 2(x + 1)`, `x^2 + 2x` |
| `compose_product` | f(x)·g(x) | f = `x^2 + 1`, g = `x - 3` | `x^2 - 6x + 10` | `(x^2 + 1)(x - 3)` |
| `compose_reversed` | g(f(x)) | same | same | `(x^2 + 1) - 3` (= x^2 − 2) |
| `compose_sum` | f(x) + g(x) | same | same | `x^2 + 1 + (x - 3)` (= x^2 + x − 2) |
| `value_product` | f(a)·g(a) | f = `2x + 5`, g = `x^2 - 1`, a = 2 | `11` | `27` |
| `value_reversed` | g(f(a)) | same | `11` | `80` |
| `composite_domain_simplified` | read the domain off the simplified formula | f = `x^2`, g = `sqrt(x)` | `[0, inf)` | `(-inf, inf)` |
| `composite_domain_inner_only` (extra) | kept dom g, forgot g(x) must be in dom f | f = `1/(x - 2)`, g = `sqrt(x)` | `[0, 4) U (4, inf)` | `[0, inf)` |

Sample witnesses (exact strings the graders return for the wrong answers above):

- `domain_forgot_denominator` (`1/(x - 3)`, `(-inf, inf)`): "Your answer includes x = 3, but the denominator x − 3 is 0 there, so f(3) is undefined. A denominator can never be 0: x − 3 ≠ 0 gives x ≠ 3."
- `domain_root_denominator_zero`: "Your answer includes x = 1, but there the denominator sqrt(x − 1) is the square root of 0, which is 0, so f(1) divides by 0. A root in a denominator must be strictly positive: x − 1 > 0, not ≥ 0."
- `domain_root_strict` (`sqrt(-2x + 6)`, `(-inf, 3)`): "Your answer leaves out x = 3, but f(3) = 0 is defined: the square root of 0 is 0. The radicand only has to be ≥ 0, so −2x + 6 ≥ 0 keeps its endpoint (x = 3 belongs in the domain; use a bracket)."
- `domain_no_flip`: see §3 gradeDomain.
- `domain_odd_root_restricted`: "Your answer leaves out x = 1, but f(1) = −1 is defined. cbrt(x − 2) is a cube root: the cube root of a negative number is a real number (cbrt(−8) = −2). Only even roots, like square roots, need a radicand ≥ 0."
- `domain_denominator_nonneg` (`[3, inf)`): "A denominator only has to be nonzero, not ≥ 0. At x = 2, x − 3 = −1 and f(2) = −1 is defined, but your answer leaves it out. Solve x − 3 ≠ 0 instead: x ≠ 3."
- `domain_gave_range`: "[0, ∞) is the range of f: its outputs. The domain is the set of inputs x that f accepts. x = 4 is in your answer, but the radicand −2x + 6 is −2 there, which is negative, so f(4) is undefined."
- `range_gave_domain`: "[−1, ∞) is the domain: the inputs x. The range is the set of outputs y = f(x). y = 6 is in your answer, but f(x) never equals 6 (f(x) ≤ 5 for every x)."
- `range_reflection_ignored`: "The coefficient −2 in front flips the graph upside down: −2·sqrt(x + 1) ≤ 0, so f(x) ≤ 5. Your answer includes y = 6, but no output is above 5." (quadratic: "a = −2 is negative, so the parabola opens down and the vertex (1, 5) is its HIGHEST point: every output is ≤ 5. Your answer includes y = 6, which is above the vertex.")
- `range_included_asymptote`: "y = 1 is the horizontal asymptote: 3/(x − 2) is never 0 (its numerator is 3), so f(x) never equals 1. Your answer includes 1; the range is (−∞, 1) ∪ (1, ∞)."
- `compose_product`: "Your answer is f(x)·g(x) = (x^2 + 1)(x − 3): you multiplied the two formulas. f(g(x)) puts g(x) inside f: replace every x in f with (x − 3) to get (x − 3)^2 + 1. At x = 1: f(g(1)) = f(−2) = 5, but f(1)·g(1) = 2·(−2) = −4."
- `compose_reversed`: "Your answer is g(f(x)) = (x^2 + 1) − 3: g on the outside. f(g(x)) is the other order, f on the outside with g(x) inside: (x − 3)^2 + 1. At x = 1: f(g(1)) = f(−2) = 5, but g(f(1)) = g(2) = −1."
- `compose_sum`: "Your answer is f(x) + g(x) = x^2 + 1 + (x − 3): you added the formulas. … At x = 1: f(g(1)) = f(−2) = 5, but f(1) + g(1) = 2 + (−2) = 0."
- `compose_partial_sub` (none replaced): "Your answer is still f(x): none of the x's became (x − 3). Every x in f must become (x − 3): (x − 3)^2 + 1. At x = 1: f(g(1)) = f(−2) = 5, but your line gives 2."
- `value_reversed`: "You found g(f(2)) = g(9) = 80: that is (g∘f)(2). For (f∘g)(2) work from the inside out: first g(2) = 3, then f(3) = 11."
- `composite_domain_simplified`: "That is the domain of the simplified formula x alone, but simplifying can hide a restriction. x = −1 is in your answer, but g(−1) is undefined (the radicand x is −1 there, which is negative), so f(g(−1)) is undefined too. The domain of f∘g is every x in the domain of g whose output g(x) is in the domain of f."

## 5. Notes for the content stage

- Register one ErrorPatternId per kind you want in the catalog (e.g. `fn_forgot_denominator`) and map
  `grade.mistake` → id; use `grade.witness` as the PatternHit witness. `FUNCTION_MISTAKE_KINDS` lists them.
- Template self-tests: for every seed, `domainOf(f)` / `rangeOf(f)` / `compositeDomain(f, g)` not null;
  `grade…(…, result.set)` is `correct`; `grade…(…, result.interval)` is `correct`. Pick composite-value
  points a so the value is interesting both ways (some seeds undefined: `compositeValue(...).defined`).
- Hints: rung 3 can reveal `explanation` lines one at a time (they are ordered: each restriction, then the
  answer). For composition, reveal `composeText(f, g).unsimplified` first, then `.simplified`.
- `invalid` is a parse problem (show the message under the input, do not count an attempt); `unsupported`
  means the template produced something outside §2.
- Composite values that leave the exact model (cbrt(5)) come back with `value.exact === null` and
  `value.text` the exact expression (`'cbrt(5)'`); prefer seeds with rational or square-root values.

## 6. Layering exception

`src/engine/functions` imports the exact-set code from `@/notation/rational`, `@/notation/sets/solutionSet`,
`@/notation/sets/interval`, `@/notation/sets/setBuilder` and `@/notation/sets/compare` directly. Those files
import only `@/shared/types` and each other, so there is no import cycle (the `@/notation` index would pull in
`toLatex`/`calcString`, which import engine files). This is the one engine → notation import; the task asked
for the notation sets to be reused. Moving `rational.ts` + `sets/*` under `src/shared` later would remove it.

## Plan (2026-09-21)

- `exact.ts` — exact real values r0 + r1·√m1 + … (rational coefficients, square-free radicands) and
  `exactEval(node, x)`.
- `poly.ts` — polynomials with Rational coefficients, rational functions read off the AST, rational roots
  (rational-root theorem, exact deflation), Sturm count.
- `solve.ts` — restriction walk, `solveEq(node, c)`, `preimage(node, S)` by an exact sign chart.
- `domain.ts`, `range.ts`, `compose.ts` — public functions, mistake candidates, graders.
- `answer.ts` — reading her set answers (interval, set-builder, and the `!=` forms domains need).

## Log
- [done] `exact.ts` (surds + exact evaluation), `poly.ts` (rational polynomials, rational roots, Sturm),
  `text.ts` (printers), `solve.ts` (restriction walk, solveEq, preimage), `common.ts`, `answer.ts`
  (parseSetAnswer with != and "all real numbers except", parseValueAnswer).
- [done] `domain.ts`: domainOf, domainMistakes, gradeDomain; `domain.test.ts` (45 exact domains,
  13 mistake cases, witnesses, answer forms).
- [done] `range.ts`: rangeOf, rangeMistakes, gradeRange; `range.test.ts` (25 exact ranges across the 8
  families, nulls, params, explanations, 7 mistake cases, witnesses, y answers).
- Decision: witness points prefer an x where f's value reads well (cbrt(x - 2): x = 1 gives -1, not x = 0).
- [done] `compose.ts`: composeText, compositeDomain (+ mistakes, grader), gradeComposition (+ mistakes),
  compositeValue (+ mistakes, grader), checkDecomposition, compositeAtText; `compose.test.ts` (every
  composite domain is cross-checked against the restriction walk of the unsimplified formula).
- Decision: g is substituted in parentheses, except a single call such as sqrt(x) that is not under an
  exponent: 1/(sqrt(x) - 2), (sqrt(x))^2, 2sqrt(x) + 1.
- [done] `exact.test.ts` (surd canonical forms, conjugate division, exact signs, rational roots, Sturm,
  factoring, reduction, text helpers, answer forms) and `property.test.ts`: 250 seeded domain functions
  (exact domain vs float evaluation away from boundaries and exact evaluation at them; canonical answer as
  set / interval / set-builder text grades correct; every candidate differs and grades as its own kind; >300
  candidates checked), 150 range functions (sampled outputs inside the range), 150 composition pairs
  (composite domain vs float f(g(x)) and vs the formula walk; both texts correct; every formula candidate is
  a mistake; (f∘g)(a) matches floats and is undefined exactly off the domain; pairs with irrational
  boundaries are refused by both paths).
- Decision: formula comparisons are exact proofs for rational expressions (cross-multiplication); radicals
  are compared by exact evaluation at rational probes of the relevant domain (overlap of both domains for
  mistake matching, so a formula defined only on a short interval still matches its candidate).
- Decision: a formula candidate undefined everywhere (g(f(x)) = sqrt(negative)) is dropped.
- [done] Exported from `src/engine/index.ts`; `npm run typecheck` clean; full `npm test` green.
