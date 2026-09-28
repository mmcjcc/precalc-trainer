/**
 * Public types of the transformations core (Unit 1: transformations of functions, piecewise evaluation,
 * average rate of change). Kept local to the engine folder: the mistake kinds are a local union, not
 * ErrorPatternIds (the content stage registers ids and catalog wording and maps these kinds onto them).
 */
import type { Piece, Rational, SolutionSet } from '@/shared/types'

// ---------------------------------------------------------------------------
// The transformation g(x) = a·f(b(x − h)) + k
// ---------------------------------------------------------------------------

/** The parent functions: x^2, x^3, sqrt(x), cbrt(x), abs(x), 1/x. */
export type ParentName = 'square' | 'cube' | 'sqrt' | 'cbrt' | 'abs' | 'reciprocal'

/** A point with exact coordinates. */
export interface ExactPoint {
  x: Rational
  y: Rational
}

/** A number as templates and inputs give it: a Rational, a JS number (0.5 is read as 1/2), or text ("-3/2"). */
export type RatLike = Rational | number | string

/** A point whose coordinates may be given loosely (`mapPoint(spec, { x: 4, y: 2 })`). */
export interface PointLike {
  x: RatLike
  y: RatLike
}

/**
 * g(x) = a·f(b(x − h)) + k. a ≠ 0, b ≠ 0.
 *  - a < 0: reflect over the x-axis; |a| ≠ 1: vertical stretch (|a| > 1) or compression by |a|.
 *  - b < 0: reflect over the y-axis; |b| ≠ 1: horizontal stretch or compression by 1/|b| (compression when |b| > 1).
 *  - h: horizontal shift (right when h > 0); k: vertical shift (up when k > 0).
 */
export interface TransformSpec {
  parent: ParentName
  a: Rational
  b: Rational
  h: Rational
  k: Rational
}

/**
 * How the problem wrote the inside of f: 'factored' is f(2(x − 3)); 'unfactored' is f(2x − 6), the classic
 * trap (the shift is 6/2 = 3, not 6). Graders use it to decide which named mistake a wrong answer is.
 */
export type StatementForm = 'factored' | 'unfactored'

export interface ParentInfo {
  name: ParentName
  /** App syntax: 'x^2', 'x^3', 'sqrt(x)', 'cbrt(x)', 'abs(x)', '1/x'. */
  formula: string
  /** Words for sentences: 'squaring', 'square root', … */
  words: string
  /** f(−x) = f(x) ('even': x^2, abs), f(−x) = −f(x) ('odd': x^3, cbrt, 1/x), neither ('none': sqrt). */
  symmetry: 'even' | 'odd' | 'none'
  /** The feature every transformation carries along: vertex, start point or center; null for 1/x (asymptotes). */
  anchor: 'vertex' | 'start point' | 'center' | null
  /** Named key points of f, left to right. */
  keyPoints: readonly ExactPoint[]
}

export interface KeyFeatures {
  /** vertex (x^2, abs), start point (sqrt), center (x^3, cbrt): (0, 0) on f → (h, k) on g. Null for 1/x. */
  anchor: { name: 'vertex' | 'start point' | 'center'; parent: ExactPoint; image: ExactPoint } | null
  /** 1/x only: the asymptotes x = h and y = k of g (x = 0 and y = 0 on f). */
  asymptotes: { vertical: Rational; horizontal: Rational } | null
  /** The parent's key points and where each lands on g, in the parent's order. */
  points: { parent: ExactPoint; image: ExactPoint }[]
  /** Exact domain and range of g, and their interval text ("[3, inf)"). */
  domain: SolutionSet
  range: SolutionSet
  domainInterval: string
  rangeInterval: string
  /** Reading lines for a hint or the reveal (display text, unicode). */
  explanation: string[]
}

// ---------------------------------------------------------------------------
// Steps in words
// ---------------------------------------------------------------------------

/**
 * One transformation step, the way she would say it. `amount` and `factor` are positive.
 * A scale factor is the number x-values (horizontal) or y-values (vertical) are multiplied by:
 * 'compress' has factor < 1, 'stretch' has factor > 1 ("compress horizontally by a factor of 1/2").
 */
export type TransformStep =
  | { kind: 'reflect'; axis: 'x' | 'y' }
  | { kind: 'shift'; direction: 'left' | 'right' | 'up' | 'down'; amount: Rational }
  | { kind: 'scale'; axis: 'horizontal' | 'vertical'; word: 'stretch' | 'compress'; factor: Rational }

/**
 * A step as the UI collects it: numbers may be text ("1/2") or numbers. For a scale, the WORD decides
 * stretch or compress and the number is read as the factor or its reciprocal, whichever fits the word:
 * "compress by 2" and "compress by 1/2" both mean x-values × 1/2. A negative shift amount turns the
 * direction around ("right −3" is "left 3").
 */
export type StepInput =
  | { kind: 'reflect'; axis: 'x' | 'y' }
  | { kind: 'shift'; direction: 'left' | 'right' | 'up' | 'down'; amount: RatLike }
  | { kind: 'scale'; axis: 'horizontal' | 'vertical'; word: 'stretch' | 'compress'; factor: RatLike }

/** Where a step acts, in the standard order of application for a·f(b(x − h)) + k. */
export type StepSlot = 'reflect_y' | 'h_scale' | 'h_shift' | 'reflect_x' | 'v_scale' | 'v_shift'

export interface DescribedStep {
  slot: StepSlot
  step: TransformStep
  /** "shift right 3", "compress horizontally by a factor of 1/2" (display text). */
  sentence: string
  /** Why the formula has this step: "x − 3 inside f" (display text, for hints). */
  reason: string
}

/**
 * One line of the description check.
 *  - correct: she has this step.
 *  - wrong:   her step for this slot has the wrong number or axis (`mistake` names it when a pattern fits).
 *  - missing: g has this step and she has nothing for it (`mistake`: missing_reflection / missing_step).
 *  - extra:   a step of hers that g does not have (`mistake`: extra_step).
 */
export interface StepCheck {
  slot: StepSlot
  status: 'correct' | 'wrong' | 'missing' | 'extra'
  /** g's step (absent for 'extra'). */
  expected?: DescribedStep
  /** Her step, normalized (absent for 'missing'). */
  chosen?: TransformStep
  mistake?: TransformMistakeKind
  /** A sentence about her step and her numbers (display text). */
  message: string
}

export type DescriptionGrade =
  | { verdict: 'correct'; message: string; checks: StepCheck[] }
  /** At least one named mistake; `mistake`/`witness` are the first one in step order, `checks` has all. */
  | { verdict: 'mistake'; mistake: TransformMistakeKind; witness: string; checks: StepCheck[] }
  | { verdict: 'wrong'; message: string; checks: StepCheck[] }
  /** One of her steps could not be read (`index` into her list); not an attempt. */
  | { verdict: 'invalid'; message: string; index: number }
  | { verdict: 'unsupported'; message: string }

// ---------------------------------------------------------------------------
// Mistakes and grades
// ---------------------------------------------------------------------------

/** Every named mistake the transformations graders can report. */
export type TransformMistakeKind =
  // Transformations: shared by the description, point and equation graders
  | 'h_shift_reversed'
  | 'v_shift_reversed'
  | 'h_factor_inverted'
  | 'v_factor_inverted'
  | 'reflection_wrong_axis'
  | 'unfactored_shift'
  | 'missing_reflection'
  // Description only
  | 'missing_step'
  | 'extra_step'
  // Mapping a point only
  | 'h_order'
  | 'v_order'
  | 'factors_swapped'
  // Writing the equation only
  | 'v_factor_inside'
  | 'v_shift_inside'
  // Piecewise evaluation
  | 'piecewise_boundary'
  | 'piecewise_wrong_piece'
  | 'piecewise_value_where_undefined'
  | 'piecewise_undefined_where_defined'
  // Average rate of change
  | 'rate_sign_flipped'
  | 'rate_no_division'
  | 'rate_inverted'
  | 'rate_divided_by_b'

export const TRANSFORM_MISTAKE_KINDS: readonly TransformMistakeKind[] = [
  'h_shift_reversed',
  'v_shift_reversed',
  'h_factor_inverted',
  'v_factor_inverted',
  'reflection_wrong_axis',
  'unfactored_shift',
  'missing_reflection',
  'missing_step',
  'extra_step',
  'h_order',
  'v_order',
  'factors_swapped',
  'v_factor_inside',
  'v_shift_inside',
  'piecewise_boundary',
  'piecewise_wrong_piece',
  'piecewise_value_where_undefined',
  'piecewise_undefined_where_defined',
  'rate_sign_flipped',
  'rate_no_division',
  'rate_inverted',
  'rate_divided_by_b',
]

/**
 * A grader's verdict (the same shape as the functions core's FunctionGrade).
 *  - correct:     her answer is right; `message` is a short confirmation.
 *  - mistake:     wrong, and exactly what the named mistake produces; `witness` is a sentence about HER numbers.
 *  - wrong:       wrong, no named mistake fits; `message` is a plain, specific sentence.
 *  - invalid:     her answer could not be read (not an attempt); `position`/`length` point into it.
 *  - unsupported: the PROBLEM is outside the exact model (a template bug, never her fault).
 */
export type TransformGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: TransformMistakeKind; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string; position?: number; length?: number }
  | { verdict: 'unsupported'; message: string }

/** What one point mistake gives. `shadows`: other kinds giving the same wrong point (earlier kind wins). */
export interface PointMistakeCandidate {
  kind: TransformMistakeKind
  point: ExactPoint
  /** "(-2, -1)" (app syntax). */
  text: string
  witness: string
  shadows: TransformMistakeKind[]
}

/** What one equation mistake gives: the transformation her wrong formula describes, and its formula. */
export interface EquationMistakeCandidate {
  kind: TransformMistakeKind
  spec: TransformSpec
  /** Its explicit formula (app syntax), e.g. "-2(x + 3)^2 + 1". */
  text: string
  /** The sentence the grader returns when her formula is this one. */
  witness: string
  shadows: TransformMistakeKind[]
}

// ---------------------------------------------------------------------------
// Piecewise functions
// ---------------------------------------------------------------------------

/**
 * One piece: a formula in x (a polynomial or abs of a linear expression, so values at rational x are rational)
 * on an interval with exact endpoints. `interval` is the shared `Piece` shape:
 * { lo: Rational | '-inf', hi: Rational | 'inf', loClosed, hiClosed }.
 */
export interface PiecewisePiece {
  formula: string
  interval: Piece
}

export type PiecewiseValue =
  | {
      defined: true
      /** Index of the piece whose interval contains x. */
      pieceIndex: number
      value: Rational
      /** "5", "-1/2" (app syntax). */
      text: string
      /** The piece's condition, "x >= 2" (app syntax). */
      condition: string
      /** The formula with x substituted, "2(2) + 1" (app syntax). */
      substitution: string
      /** Reading lines (display text). */
      steps: string[]
    }
  | { defined: false; steps: string[] }

// ---------------------------------------------------------------------------
// Average rate of change
// ---------------------------------------------------------------------------

export interface AverageRate {
  a: Rational
  b: Rational
  fa: Rational
  fb: Rational
  /** f(b) − f(a). */
  rise: Rational
  /** b − a. */
  run: Rational
  /** rise / run. */
  rate: Rational
  /** The rate as app syntax: "5", "-3/2". */
  text: string
  /** Reading lines (display text): the two values, then the quotient. */
  steps: string[]
}

export interface RateMistakeCandidate {
  kind: TransformMistakeKind
  value: Rational
  text: string
  witness: string
  shadows: TransformMistakeKind[]
}
