/**
 * Public types of the polynomials core (precalculus Unit 2: completing the square, synthetic division,
 * zeros / multiplicity / end behavior, rational root candidates). Kept local to the engine folder: the
 * mistake kinds are a local union, not ErrorPatternIds (the content stage registers ids and catalog
 * wording and maps these kinds onto them).
 */
import type { Rational } from '@/shared/types'
import type { ExactPoint, PointLike, RatLike } from '../transformations/types'

// ---------------------------------------------------------------------------
// Mistakes and grades
// ---------------------------------------------------------------------------

/** Every named mistake the polynomials graders can report. */
export type PolyMistakeKind =
  // Completing the square
  | 'cs_no_factor_a'
  | 'cs_unbalanced'
  | 'cs_constant_not_scaled'
  | 'cs_half_or_square'
  | 'cs_h_sign'
  | 'cs_vertex_swapped'
  // Synthetic division, remainder and factor theorems
  | 'sd_wrong_sign_c'
  | 'sd_missing_placeholder'
  | 'sd_subtracted'
  | 'sd_first_coefficient'
  | 'sd_quotient_degree'
  | 'sd_remainder_last_quotient'
  // Zeros, multiplicity, end behavior, building a polynomial from its zeros
  | 'zero_sign_reversed'
  | 'zero_nonmonic_factor'
  | 'multiplicity_ignored'
  | 'multiplicity_wrong_zero'
  | 'cross_touch_swapped'
  | 'end_sign_ignored'
  | 'end_parity_swapped'
  | 'lead_coefficient_omitted'
  // Rational root candidates
  | 'rrt_inverted'
  | 'rrt_no_plus_minus'
  | 'rrt_integers_only'
  | 'rrt_wrong_coefficients'

export const POLY_MISTAKE_KINDS: readonly PolyMistakeKind[] = [
  'cs_no_factor_a',
  'cs_unbalanced',
  'cs_constant_not_scaled',
  'cs_half_or_square',
  'cs_h_sign',
  'cs_vertex_swapped',
  'sd_wrong_sign_c',
  'sd_missing_placeholder',
  'sd_subtracted',
  'sd_first_coefficient',
  'sd_quotient_degree',
  'sd_remainder_last_quotient',
  'zero_sign_reversed',
  'zero_nonmonic_factor',
  'multiplicity_ignored',
  'multiplicity_wrong_zero',
  'cross_touch_swapped',
  'end_sign_ignored',
  'end_parity_swapped',
  'lead_coefficient_omitted',
  'rrt_inverted',
  'rrt_no_plus_minus',
  'rrt_integers_only',
  'rrt_wrong_coefficients',
]

/**
 * A grader's verdict (the functions and transformations cores' shape, plus `explanation`).
 *  - correct:     her answer is right; `message` is a short confirmation.
 *  - mistake:     wrong, and exactly what the named mistake produces; `witness` is a sentence about HER numbers.
 *  - wrong:       wrong, no named mistake fits; `message` is a plain, specific sentence.
 *  - invalid:     not an attempt: show `message` under the input and do not count it. Either the text could
 *                 not be read (`reason: 'unreadable'`; `position`/`length` point into the text, `index` says
 *                 which box of a row), or it is equal to the right answer but not in the form the question
 *                 asks for (`reason: 'not_in_form'`: f(x) typed back in standard form where vertex form is
 *                 wanted, the whole division result where only the quotient is wanted).
 *  - unsupported: the PROBLEM is outside the model (a template bug, never her fault).
 * `explanation` is the ordered, plain-language worked solution (display text): show it for the hint
 * reveal and after a correct answer, not together with a `wrong` verdict she can still retry.
 */
export type PolyGrade =
  | { verdict: 'correct'; message: string; explanation: string[] }
  | { verdict: 'mistake'; mistake: PolyMistakeKind; witness: string; explanation: string[] }
  | { verdict: 'wrong'; message: string; explanation: string[] }
  | { verdict: 'invalid'; message: string; reason: 'unreadable' | 'not_in_form'; position?: number; length?: number; index?: number }
  | { verdict: 'unsupported'; message: string }

/**
 * A polynomial as templates give it: text in app syntax ("2x^3 - 3x^2 - 5", "f(x) = x^2 - 6x + 13", any
 * form that multiplies out to a polynomial) or its coefficients from the highest power down, zeros
 * included ([2, -3, 0, -5]).
 */
export type PolyInput = string | readonly RatLike[]

// ---------------------------------------------------------------------------
// Completing the square
// ---------------------------------------------------------------------------

export type SquareStep = 'start' | 'factor' | 'add_subtract' | 'square' | 'distribute' | 'combine'

/** One line of the canonical worked path. Every line is an expression equal to f(x). */
export interface SquareLine {
  step: SquareStep
  /** App syntax: "2(x^2 - 6x + 9 - 9) + 13". */
  text: string
  /** Why this line follows (display text). */
  reason: string
}

export interface CompletedSquare {
  /** f(x) in standard form, app syntax: "2x^2 - 12x + 13". */
  f: string
  a: Rational
  b: Rational
  c: Rational
  /** The vertex (h, k): h = −b/(2a), k = c − b²/(4a). */
  h: Rational
  k: Rational
  /** b/(2a): the number inside the square, (x + half)^2. */
  half: Rational
  /** (b/(2a))²: the number added and subtracted inside the parentheses. */
  square: Rational
  /** App syntax: "2(x - 3)^2 - 5". */
  vertexForm: string
  vertex: ExactPoint
  /** "(3, -5)". */
  vertexText: string
  axis: Rational
  /** "x = 3". */
  axisText: string
  opens: 'up' | 'down'
  /** The minimum (a > 0) or maximum (a < 0) value, k. */
  extremum: { kind: 'minimum' | 'maximum'; value: Rational }
  /** The canonical lines, each equal to f(x); the existing step checker accepts every consecutive pair. */
  path: SquareLine[]
  explanation: string[]
}

/** What one completing-the-square slip produces: the vertex form a(x − h)^2 + k she would end with. */
export interface SquareMistakeCandidate {
  kind: PolyMistakeKind
  a: Rational
  h: Rational
  k: Rational
  /** "2(x - 3)^2 + 13" (app syntax). */
  text: string
  /** The sentence the grader returns when her form (or line) multiplies out to this. */
  witness: string
  shadows: PolyMistakeKind[]
}

/** A wrong vertex or axis and the slip that produces it. */
export interface PointValueCandidate {
  kind: PolyMistakeKind
  point: ExactPoint
  /** "(-3, -5)". */
  text: string
  witness: string
  shadows: PolyMistakeKind[]
}

/** A wrong number and the slip that produces it (axis of symmetry, remainder, y-intercept). */
export interface NumberMistakeCandidate {
  kind: PolyMistakeKind
  value: Rational
  /** "-33", "1/2". */
  text: string
  witness: string
  shadows: PolyMistakeKind[]
}

/** A wrong formula and the slip that produces it (quotient, polynomial from zeros). */
export interface FormulaMistakeCandidate {
  kind: PolyMistakeKind
  /** App syntax. */
  text: string
  witness: string
  shadows: PolyMistakeKind[]
}

/**
 * The line-by-line helper's verdict. `correct` means the line is equal to f(x) (a legal line);
 * `done` says it is already in vertex form.
 */
export type SquareLineGrade =
  | { verdict: 'correct'; done: boolean; message: string; explanation: string[] }
  | { verdict: 'mistake'; mistake: PolyMistakeKind; witness: string; explanation: string[] }
  | { verdict: 'wrong'; message: string; explanation: string[] }
  | { verdict: 'invalid'; message: string; reason: 'unreadable' | 'not_in_form'; position?: number; length?: number }
  | { verdict: 'unsupported'; message: string }

// ---------------------------------------------------------------------------
// Synthetic division
// ---------------------------------------------------------------------------

export interface SyntheticTable {
  /** f(x) in standard form, app syntax. */
  f: string
  degree: number
  /** The number in the box: the zero of the divisor x − c. */
  c: Rational
  /** "x - 2", "x + 2", "x - 1/2". */
  divisor: string
  /** Top row: the coefficients from the highest power down, with a 0 for every missing power. Length degree + 1. */
  coefficients: Rational[]
  /** The powers whose coefficient is a 0 placeholder, highest first. */
  missingPowers: number[]
  /** Middle row: products[i] sits under coefficients[i + 1] (nothing sits under the first coefficient). Length degree. */
  products: Rational[]
  /** Bottom row: the quotient's coefficients, then the remainder. Length degree + 1. */
  bottom: Rational[]
  /** bottom without its last number: the quotient from its highest power (degree − 1) down. */
  quotientCoefficients: Rational[]
  /** "2x^2 + x + 2". */
  quotientText: string
  remainder: Rational
  remainderText: string
  /** The remainder is 0: x − c is a factor (factor theorem). */
  isFactor: boolean
  /** f(c) written out, app syntax: "2(2)^3 - 3(2)^2 - 5". Its value is the remainder (remainder theorem). */
  substitution: string
  /** The three rows as text, for display or for filling input boxes. */
  rows: { coefficients: string[]; products: string[]; bottom: string[] }
  explanation: string[]
}

/** What one synthetic-division slip produces: the whole table she would write. */
export interface SyntheticMistakeCandidate {
  kind: PolyMistakeKind
  /** The number she put in the box. */
  box: Rational
  /** The coefficient row she used (shorter when a placeholder is left out). */
  coefficients: Rational[]
  products: Rational[]
  bottom: Rational[]
  /** Her bottom row, "2, -7, 14, -33". */
  text: string
  witness: string
  /** Other kinds giving the same bottom row (the products row, when the UI collects it, tells them apart). */
  shadows: PolyMistakeKind[]
}

/** Her table: the bottom row, and optionally the middle row and the box (they sharpen the diagnosis). */
export interface SyntheticAnswer {
  /** One string per box, or one string "2, 1, 2, -1". */
  bottom: string | readonly string[]
  /** The products row (one entry fewer than the bottom row). */
  products?: string | readonly string[]
  /** The number she wrote in the box. */
  box?: string
}

// ---------------------------------------------------------------------------
// Zeros, multiplicity, end behavior
// ---------------------------------------------------------------------------

/** One factor (coef·x + constant)^mult. coef ≠ 0, mult ≥ 1. */
export interface LinearFactor {
  coef: Rational
  constant: Rational
  mult: number
}

/** lead · Π (coef·x + constant)^mult. `lead` is the number written in front (not the leading coefficient when a factor is not monic). */
export interface FactoredPoly {
  lead: Rational
  factors: LinearFactor[]
}

/** A factor as templates give it: by its zero (the monic factor x − zero) or by its two numbers. */
export type FactorInput = { zero: RatLike; mult?: number } | { coef: RatLike; constant: RatLike; mult?: number }

/** A factored polynomial as functions accept it: the object, or its text "-2(x + 1)^2(x - 3)(x - 1/2)^3". */
export type FactoredSource = FactoredPoly | string

export type CrossTouch = 'crosses' | 'touches'
/** Where f(x) heads: 'up' is f(x) → ∞, 'down' is f(x) → −∞. */
export type EndDirection = 'up' | 'down'

export interface EndBehavior {
  /** As x → −∞. */
  left: EndDirection
  /** As x → ∞. */
  right: EndDirection
}

export interface ZeroInfo {
  zero: Rational
  /** "-1", "1/2". */
  text: string
  /** The exponents of every factor with this zero, added. */
  mult: number
  /** Odd multiplicity crosses the x-axis, even multiplicity touches it and turns back. */
  behavior: CrossTouch
  /** The factor as written: "(x + 1)^2", "(2x - 1)", "x^3". */
  factor: string
}

export interface FactoredAnalysis {
  /** The factored form, app syntax. */
  text: string
  factored: FactoredPoly
  /** Distinct zeros, ascending. */
  zeros: ZeroInfo[]
  degree: number
  leadingCoefficient: Rational
  end: EndBehavior
  /** Display text: "As x → −∞, f(x) → −∞; as x → ∞, f(x) → −∞." */
  endText: string
  yIntercept: Rational
  /** Multiplied out, app syntax. */
  expandedText: string
  explanation: string[]
}

/** One wrong reading of one factor: the zero she would list for it. */
export interface ZeroMistakeCandidate {
  kind: PolyMistakeKind
  /** The factor it comes from, "(x + 1)^2". */
  factor: string
  /** The right zero of that factor. */
  zero: Rational
  /** The wrong zero. */
  wrong: Rational
  /** "1". */
  text: string
  witness: string
  shadows: PolyMistakeKind[]
}

/** One row of her zeros table. `mult` may be left out when the question asks for the zeros only. */
export interface ZeroAnswer {
  zero: string
  mult?: string | number
}

export interface CrossTouchCheck {
  zero: Rational
  mult: number
  expected: CrossTouch
  chosen: CrossTouch
  ok: boolean
  /** A sentence about this zero (display text). */
  message: string
}

/** The end-behavior answers a slip produces. */
export interface EndMistakeCandidate {
  kind: PolyMistakeKind
  end: EndBehavior
  witness: string
  shadows: PolyMistakeKind[]
}

/** Zeros with multiplicities and (optionally) one more point of the graph. */
export interface ZerosSpec {
  zeros: readonly { zero: RatLike; mult?: number }[]
  /** A point that is not a zero; it fixes the leading coefficient. Without it any nonzero multiple is right. */
  point?: PointLike
}

export interface BuiltPolynomial {
  /** The leading coefficient (1 when there is no point). */
  a: Rational
  factored: FactoredPoly
  /** "-2(x + 1)^2(x - 3)" (app syntax). */
  text: string
  expandedText: string
  degree: number
  point: ExactPoint | null
  explanation: string[]
}

// ---------------------------------------------------------------------------
// Rational root candidates
// ---------------------------------------------------------------------------

export interface RootCandidates {
  /** f(x) in standard form, app syntax. */
  f: string
  /** The constant term a0 and the leading coefficient an (integers, both nonzero). */
  constant: number
  leading: number
  /** Positive factors of |a0| and of |an|, ascending. */
  p: number[]
  q: number[]
  /** The positive candidates p/q without repeats: integers first, then fractions by denominator. */
  positives: Rational[]
  /** Every candidate, ascending. */
  candidates: Rational[]
  /** "+-1, +-2, +-3, +-6, +-1/2, +-3/2" (app syntax; `gradeRootCandidates` reads it back). */
  text: string
  /** f at every candidate, in the order of `candidates` (exact). */
  tests: { candidate: Rational; value: Rational }[]
  /** The candidates that are zeros, ascending, and their multiplicities. */
  zeros: Rational[]
  multiplicities: number[]
  /** How to list the candidates (display text). */
  explanation: string[]
  /** Which candidates are zeros and why (display text). */
  zeroExplanation: string[]
}

/** The candidate list a slip produces. */
export interface RootSetMistakeCandidate {
  kind: PolyMistakeKind
  /** The whole list she would give, ascending. */
  values: Rational[]
  /** "-2, -1, -1/2, 1/2, 1, 2". */
  text: string
  witness: string
  shadows: PolyMistakeKind[]
}
