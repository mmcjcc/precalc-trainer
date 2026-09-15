import type { Rational } from '@/shared/types'

export type CalcId = 'ti84' | 'nspire'

/** One calculator instruction. Mirrors `CalcStep` in `src/shared/types.ts` (structurally identical). */
export type CalcStep = {
  title: string
  /** Keystrokes as ONE readable line; expressions inline. */
  keys: string
  why?: string
  caution?: string
}

export type CalcFamily =
  | 'inequality'
  | 'number-line'
  | 'even-odd'
  | 'function'
  | 'inverse-cbrt'
  | 'inverse-linear'
  | 'inverse-frac-linear'
  | 'inverse-rational'
  | 'inverse-mobius'
  | 'not-one-to-one'
  | 'plus-minus-sqrt'

/** Every family, for tests and registries. The annotation keeps it in sync with `CalcFamily`. */
export const CALC_FAMILIES: readonly CalcFamily[] = [
  'inequality',
  'number-line',
  'even-odd',
  'function',
  'inverse-cbrt',
  'inverse-linear',
  'inverse-frac-linear',
  'inverse-rational',
  'inverse-mobius',
  'not-one-to-one',
  'plus-minus-sqrt',
]

/** An endpoint or asymptote value: a plain number or an exact rational from the notation layer. */
export type CalcEndpoint = number | Rational

export type CalcAsymptotes = {
  /** x = vertical — where the denominator is 0. */
  vertical: CalcEndpoint
  /** y = horizontal — what f approaches as x → ±∞. */
  horizontal: CalcEndpoint
}

export type CalcInstance = {
  family: CalcFamily
  /**
   * Main expression in app syntax, in the independent variable (default x):
   *  - function-type families: f(x);
   *  - inequality / number-line: the boundary LHS − RHS (e.g. "(-5x+6)-3"), OR the whole
   *    statement ("-5x+6 <= 3", "x < -2 or x > 5") — a relational operator marks the latter, and
   *    the boundary is then derived from its first comparison.
   */
  expr: string
  /** f⁻¹(x) in app syntax when one-to-one. */
  inverseExpr?: string
  /** Friendly check input k. */
  checkValue?: number
  /** f(k). */
  checkOutput?: number
  /** Not-one-to-one: the other input with f(twin) = f(k). */
  twin?: number
  /** Rational / Möbius: f's asymptotes. The panel explains how they swap under the inverse. */
  asymptotes?: CalcAsymptotes
  /** ± case: the radicand, e.g. "(x+7)/4" for y = ±√((x+7)/4). */
  pmInner?: string
  /** Inequality / number-line: the solution set's endpoints (exact rationals welcome). */
  boundary?: readonly CalcEndpoint[]
  /**
   * Inequality / number-line: the full statement in app syntax ("-5x+6 <= 3", "-2 < 3x+1 <= 5",
   * "x < -2 or x > 5") when `expr` holds only the boundary. Drives the Nspire relation shading and
   * the TRUE/FALSE tests on both calculators.
   */
  relation?: string
  /** Independent variable when the problem is stated in n or y (renamed to X / x in the panel). */
  independent?: string
}

export const CALC_FOOTER =
  'Written for TI-84 Plus CE OS 5.x and TI-Nspire CX II OS 5/6 (non-CAS). ' +
  'TI-84: MATH/DRAW/ZOOM numbering is stable across OS 5.x; the Y= Color/Line dialog, the DrawInv colour argument and FORMAT → Detect Asymptotes (OS 5.2+) are CE-only — a monochrome TI-84 Plus cycles line styles with ENTER instead. ' +
  'Nspire: Relation graphing (x=f1(y)) needs OS 4.0+, which every CX II has; on an old CX (non-II) below OS 4 use the parametric fallback x1(t)=f1(t), y1(t)=t with tmin/tmax set by hand. Keep Real or Complex on Real so cube roots of negatives graph.'
