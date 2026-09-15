/**
 * Cross-layer contracts for the Precalc Trainer.
 *
 * Layers (imports flow downward only):
 *   shared  <-  engine  <-  notation  <-  content  <-  ui
 *
 * This file is TYPES + small constant tables only. No logic.
 * Every layer codes against these types; change them only additively and report it.
 */

// ---------------------------------------------------------------------------
// Basic vocabulary
// ---------------------------------------------------------------------------

export type RelOp = '=' | '<' | '<=' | '>' | '>='
export type VarName = 'x' | 'y' | 'n'
export type ModuleId = 'numberLine' | 'inequalities' | 'evenOdd' | 'inverses' | 'propertiesDrill'
export type CalcId = 'ti84' | 'nspire'

/** Fine-grained property tags. Canonical steps carry one; the engine's move detector reports one. */
export type PropertyTag =
  | 'add_both'
  | 'sub_both'
  | 'mul_both'
  | 'div_both'
  | 'mul_div_neg_flip'
  | 'clear_denominator'
  | 'reciprocal_multiply'
  | 'distribute'
  | 'combine_like'
  | 'commutative'
  | 'associative'
  | 'factor'
  | 'rewrite_fraction'
  | 'simplify'
  | 'cube_both'
  | 'square_both'
  | 'cube_root_both'
  | 'root_both_pm'
  | 'swap_sides'
  | 'swap_xy'
  | 'rename_inverse'

/** Coarse chips the student picks from ("which property justified this step?"). */
export type ChipId =
  | 'add_sub'
  | 'mul_div'
  | 'distribute'
  | 'combine_like'
  | 'commutative'
  | 'associative'
  | 'factor'
  | 'power_both'
  | 'root_both'
  | 'rewrite_fraction'
  | 'swap_sides'
  | 'swap_xy'
  | 'simplify'
  | 'rename_inverse'

export const CHIP_OF_TAG: Record<PropertyTag, ChipId> = {
  add_both: 'add_sub',
  sub_both: 'add_sub',
  mul_both: 'mul_div',
  div_both: 'mul_div',
  mul_div_neg_flip: 'mul_div',
  clear_denominator: 'mul_div',
  reciprocal_multiply: 'mul_div',
  distribute: 'distribute',
  combine_like: 'combine_like',
  commutative: 'commutative',
  associative: 'associative',
  factor: 'factor',
  rewrite_fraction: 'rewrite_fraction',
  simplify: 'simplify',
  cube_both: 'power_both',
  square_both: 'power_both',
  cube_root_both: 'root_both',
  root_both_pm: 'root_both',
  swap_sides: 'swap_sides',
  swap_xy: 'swap_xy',
  rename_inverse: 'rename_inverse',
}

export const CHIP_LABEL: Record<ChipId, string> = {
  add_sub: 'add/subtract both sides',
  mul_div: 'multiply/divide both sides (flip if negative!)',
  distribute: 'distribute',
  combine_like: 'combine like terms',
  commutative: 'commutative reorder',
  associative: 'associative regroup',
  factor: 'factor',
  power_both: 'cube/square both sides',
  root_both: 'take root (± if even!)',
  rewrite_fraction: 'rewrite fraction',
  swap_sides: 'swap sides',
  swap_xy: 'swap x and y',
  simplify: 'simplify arithmetic',
  rename_inverse: 'rename to f⁻¹(x)',
}

/** Chips that describe a same-side rewrite (graded as a family unless the classifier is confident). */
export const REWRITE_CHIPS: readonly ChipId[] = [
  'distribute',
  'combine_like',
  'commutative',
  'associative',
  'factor',
  'rewrite_fraction',
  'simplify',
]

export const ALL_CHIPS: readonly ChipId[] = [
  'add_sub',
  'mul_div',
  'distribute',
  'combine_like',
  'commutative',
  'associative',
  'factor',
  'power_both',
  'root_both',
  'rewrite_fraction',
  'swap_sides',
  'swap_xy',
  'simplify',
  'rename_inverse',
]

// ---------------------------------------------------------------------------
// Error patterns (the coaching library)
// ---------------------------------------------------------------------------

export type ErrorPatternId =
  // final-answer / notation matchers (notation layer)
  | 'backwards_interval'
  | 'dropped_union'
  | 'bracket_point'
  | 'set_interval_mismatch'
  | 'wrong_side'
  | 'endpoint_type'
  | 'infinity_bracket'
  | 'empty_interval'
  // inequality direction matchers (engine)
  | 'no_sign_flip'
  | 'flip_on_positive'
  | 'flip_on_add'
  | 'swap_sides_no_reverse'
  | 'nonconstant_multiplier_inequality'
  // algebra step matchers (engine)
  | 'cbrt_sign_dropped'
  | 'dropped_pm'
  | 'minus_teleport'
  | 'partial_distribute'
  | 'negative_not_distributed'
  | 'const_into_radical'
  | 'op_on_one_term'
  | 'reciprocal_coeff'
  | 'term_across_sign'
  | 'power_over_sum'
  | 'split_denominator'
  | 'cancel_term'
  | 'add_denominators'
  | 'sqrt_square_abs'
  | 'divide_by_variable'
  | 'squaring_caveat'
  | 'combine_unlike'
  | 'neg_power_sign'
  | 'substitution_error'
  | 'reciprocal_as_inverse'
  | 'swap_misname'
  // behavioral (ui)
  | 'abandoned'

export interface ErrorPatternInfo {
  id: ErrorPatternId
  title: string
  /** One or two sentences, in the voice of her study decks. */
  lesson: string
  /** A mini example: wrong → right. */
  example: string
}

// ---------------------------------------------------------------------------
// Exact solution sets (used by notation parsers, number line, inequality answers)
// ---------------------------------------------------------------------------

/** Normalized rational: d > 0, gcd(|n|, d) = 1. */
export interface Rational {
  n: number
  d: number
}
export type Endpoint = Rational | '-inf' | 'inf'

export interface Piece {
  lo: Endpoint
  hi: Endpoint
  loClosed: boolean
  hiClosed: boolean
}

/**
 * A subset of the reals: disjoint, sorted pieces plus isolated points that lie in no piece.
 * Always produced/consumed in NORMALIZED form (see notation/sets/solutionSet.ts):
 *  - pieces sorted by lo, non-overlapping, touching pieces merged, [a,a] converted to a point,
 *  - a point sitting on an open endpoint closes that endpoint instead,
 *  - points sorted, none inside a piece.
 */
export interface SolutionSet {
  pieces: Piece[]
  points: Rational[]
}

// ---------------------------------------------------------------------------
// Engine results (engine/index.ts is the public entry point)
// ---------------------------------------------------------------------------

export interface ParseError {
  message: string
  /** 0-based character index into the ORIGINAL student text. */
  position: number
  length?: number
}

export type Verdict =
  | 'equivalent'
  | 'equivalent_by_rename'
  | 'extraneous_superset'
  | 'lost_subset'
  | 'not_equivalent'
  | 'undecidable'
  | 'parse_error'

export interface DetectedMove {
  tag: PropertyTag
  chip: ChipId
  /** true → the chip must match exactly; false → any chip in REWRITE_CHIPS is accepted. */
  exact: boolean
  /** Constant multiplier / added amount when the move used a constant (display only). */
  constant?: number
  /** Human sentence, e.g. "multiplied both sides by −1/14 (negative → flip)". */
  detail: string
}

export type Truth = boolean | 'undef'

export interface Counterexample {
  point: Partial<Record<VarName, number>>
  /** "x = 0"  /  "x = 2, y = 0.5" */
  pointDisplay: string
  oldTruth: Truth
  newTruth: Truth
  oldValues?: { L: number | 'undef'; R: number | 'undef' }
  newValues?: { L: number | 'undef'; R: number | 'undef' }
  /** Full sentence for the student, e.g. "At x = 0 your old line is TRUE but your new line is FALSE." */
  message: string
}

export interface PatternHit {
  id: ErrorPatternId
  title: string
  lesson: string
  example: string
  /** Optional concrete witness text for this instance, e.g. "you divided by −14 and kept ≤". */
  witness?: string
}

export interface StepResult {
  /** Accepted into the worked column? */
  ok: boolean
  verdict: Verdict
  /** Accepted-with-caveat (squaring both sides may add solutions; must check at the end). */
  caveat?: 'extraneous_check'
  detected?: DetectedMove
  /** Chips graded correct for this step (empty when nothing was detected). */
  acceptableChips: ChipId[]
  pattern?: PatternHit
  counterexample?: Counterexample
  parseError?: ParseError
  /** true when this step was the (single) x↔y swap of an inverse problem. */
  swapped?: boolean
  /** Restriction the student must acknowledge after an even-power step, e.g. "x >= 0". */
  restriction?: string
  /** Normalized text + LaTeX of the accepted line (what the UI stores/displays). */
  normalized?: { text: string; latex: string }
}

export interface StepContext {
  /** Variables the problem owns; any other letter is a parse error. */
  vars: VarName[]
  seed: number
  /** Inverse module and the swap has not happened yet. */
  allowSwap?: boolean
  /** Stored friendly check value k (added to the sample set). */
  checkValue?: number
  /** Canonical lines (calculator syntax) to anchor chip grading and hints. */
  canonical?: string[]
  /** Which module we are in (matchers may specialize). */
  moduleId?: ModuleId
}

// ---------------------------------------------------------------------------
// Graphing + calculator panel specs (produced by content, consumed by ui)
// ---------------------------------------------------------------------------

export type PlotStyle = 'solid' | 'dashed' | 'dotted'
export type PlotColor = 'navy' | 'coral' | 'gray' | 'gold'

export interface PlotCurve {
  /** Expression in app calculator syntax, in x. */
  expr: string
  label: string
  style: PlotStyle
  color: PlotColor
}

export interface GraphSpec {
  kind: 'function' | 'numberLine' | 'none'
  /** Main function f(x) in app syntax (kind = function). */
  f?: string
  /** Inverse f⁻¹(x) when one-to-one. */
  finv?: string
  /** Draw the reflection of f across y = x parametrically (not one-to-one case). */
  reflect?: boolean
  /** Show y = x dotted gray. */
  showIdentity?: boolean
  /** Extra curves, e.g. f(−x) and −f(x) for even/odd. */
  extra?: PlotCurve[]
  /** Solution set for kind = numberLine. */
  set?: SolutionSet
  /** Suggested x-range (square window derived from it). */
  xDomain?: [number, number]
  /** Optional badge, e.g. "fails vertical line test". */
  badge?: string
}

/** One calculator instruction (matches content/calc/types.ts, which is the implementation). */
export interface CalcStep {
  /** What this step accomplishes, e.g. "Enter Y1". */
  title: string
  /** Keystrokes as one readable line, e.g. "Y= → Y1 = ³√(7X+3)-1". */
  keys: string
  /** Why this step matters, e.g. "ZSquare makes the mirror look like a mirror". */
  why?: string
  /** A trap to avoid, shown in coral. */
  caution?: string
}

export type CalcPanels = Record<CalcId, CalcStep[]>

export const CALC_LABEL: Record<CalcId, string> = {
  ti84: 'TI-84 Plus CE',
  nspire: 'TI-Nspire CX II',
}

// ---------------------------------------------------------------------------
// Palette (mirrors src/index.css @theme tokens; keep in sync)
// ---------------------------------------------------------------------------

export const PALETTE = {
  navy: '#2F3C7E',
  coral: '#F96167',
  coral700: '#C62F37',
  gold: '#F9E795',
  goldText: '#7A5C00',
  success: '#0F7A3E',
  gray: '#6b7280',
} as const
