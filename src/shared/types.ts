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
/** `h` is the difference-quotient step; the parser accepts it only when the problem owns it (ctx.vars). */
export type VarName = 'x' | 'y' | 'n' | 'h'
export type ModuleId = 'numberLine' | 'inequalities' | 'evenOdd' | 'inverses' | 'propertiesDrill' | 'sigFigs' | 'atoms' | 'diffQuotient' | 'graphFeatures'
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
  // difference quotient (engine/diffQuotient.ts; precalculus Unit 1 Day 5)
  | 'dq_fx_plus_h'
  | 'dq_fx_plus_fh'
  | 'dq_partial_sub'
  | 'dq_partial_cancel'
  | 'dq_forgot_divide'
  | 'dq_set_h_zero'
  // significant figures (engine/sigfigs; chemistry module)
  | 'sf_leading_zeros'
  | 'sf_trailing_zeros_decimal'
  | 'sf_placeholder_zeros'
  | 'sf_captive_zero'
  | 'sf_addsub_rule_on_muldiv'
  | 'sf_muldiv_rule_on_addsub'
  | 'sf_most_precise'
  | 'sf_unrounded'
  | 'sf_truncated'
  | 'sf_places_not_figures'
  | 'sf_dropped_zero'
  | 'sf_extra_zeros'
  | 'sf_ambiguous_zeros'
  | 'sf_lost_placeholders'
  | 'sf_exact_limited'
  | 'sf_rounded_early'
  | 'sf_sci_changed_figures'
  | 'sf_sci_exponent'
  | 'sf_sci_form'
  // atomic structure (engine/atoms; chemistry module)
  | 'at_neutrons_as_mass_number'
  | 'at_swapped_a_z'
  | 'at_electrons_ignored_charge'
  | 'at_charge_sign_flipped'
  | 'at_protons_changed_for_ion'
  | 'at_element_from_electrons'
  | 'at_mass_protons_electrons'
  | 'at_mass_neutrons_only'
  | 'at_symbol_case'
  | 'at_unweighted_average'
  | 'at_percent_not_decimal'
  | 'at_mass_numbers_used'
  | 'at_isotope_left_out'
  | 'at_assumed_even_split'
  | 'at_abundance_swapped'
  | 'at_abundance_sum'
  // reading a graph (content/modules/graphFeatures; precalculus)
  | 'gf_union_between_points'
  | 'gf_y_for_intervals'
  | 'gf_brackets_at_turns'
  | 'gf_swapped_inc_dec'
  | 'gf_global_on_ray'
  | 'gf_global_not_local'
  | 'gf_not_turning_point'
  | 'gf_swapped_coordinates'
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

/** One vertex of a sampled polyline (graph features). Existing graphs leave `samples` unset. */
export interface GraphSample {
  x: number
  y: number
}

/** A labelled point drawn on a sampled graph, e.g. a turning point "(-2.5, -5.5)". */
export interface GraphMarker {
  x: number
  y: number
  label: string
  /** Preferred side of the point. The plot may nudge the label so neighbours stay readable. */
  labelSide?: 'above' | 'below'
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
  /**
   * Difference quotient: draw ONE secant line of f through (x0, f(x0)) and (x0 + h0, f(x0 + h0)),
   * labelled like the worksheet sketch (x, x + h, f(x), f(x + h), h).
   */
  secant?: { x0: number; h0: number }
  /**
   * Sampled polyline, for a curve that is not one expression (reading a graph). Plotted instead of
   * `f` when present. Existing graphs leave this unset.
   */
  samples?: GraphSample[]
  /** Labelled points on that polyline (the turning points). */
  markers?: GraphMarker[]
  /** Y window for a sampled graph. Expression graphs omit this and stay square (x domain for both). */
  yDomain?: [number, number]
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

// ---------------------------------------------------------------------------
// Significant figures (chemistry). Engine: src/engine/sigfigs (exported from '@/engine').
// Every number in these types is TEXT or a small integer: tasks and results are JSON-safe for the
// store and carry no floats. The engine does the arithmetic on BigInt internally.
// ---------------------------------------------------------------------------

/** What one typed character is doing inside a numeral. */
export type SigFigCharRole =
  | 'sign'
  | 'nonzero'
  | 'leading_zero'
  | 'captive_zero'
  /** Trailing zero in a numeral that HAS a decimal point: significant. */
  | 'trailing_zero_decimal'
  /** Trailing zero in a whole number written without a decimal point: placeholder only. */
  | 'trailing_zero_placeholder'
  | 'decimal_point'
  /** Every character of the power-of-ten part ("e3", " x 10^-4"), including its spaces. */
  | 'exponent'

export interface SigFigChar {
  ch: string
  /** 0-based index into `SigFigNumeral.text`; equals this entry's position in `chars`. */
  index: number
  role: SigFigCharRole
  significant: boolean
  /** true for the digits of the coefficient: the characters a student can tap. */
  digit: boolean
  /** Power of ten this digit stands for, power-of-ten part included (coefficient digits only). */
  place?: number
  /** One sentence: why this character is or is not significant. */
  rule: string
}

/** A numeral exactly as typed, analysed by the significant-figure conventions. */
export interface SigFigNumeral {
  /** The typed text, outer whitespace trimmed; zeros and a trailing "." preserved. */
  text: string
  /** Pretty text for display, e.g. "1.20 × 10³" or "−0.0045". */
  display: string
  negative: boolean
  /** Value is zero ("0", "0.00"): no digit is significant, sigFigs is 0. */
  isZero: boolean
  sigFigs: number
  /** The significant digits in reading order, e.g. "450" for 0.00450. */
  sigDigits: string
  /** Place (power of ten) of the first significant digit; for zero, same as lastSigPlace. */
  firstSigPlace: number
  /** Place of the last significant digit; for zero, the place of the last WRITTEN digit. */
  lastSigPlace: number
  hasDecimalPoint: boolean
  /** A power-of-ten part was typed. */
  scientific: boolean
  /** Scientific AND exactly one nonzero digit in front of the decimal point. */
  normalized: boolean
  /** The typed power of ten (0 when none). */
  exponent: number
  /** Coefficient digits as typed, without the point, e.g. "000450" for 0.00450. */
  digits: string
  /** How many of `digits` sit after the decimal point. */
  fractionDigits: number
  /** Exact value as a plain minimal decimal, e.g. "0.0045", "1200", "-3". Value only, no figures. */
  value: string
  /** One entry per character of `text`. */
  chars: SigFigChar[]
}

export type SigFigOp = '+' | '-' | '*' | '/'

/** One number of a calculation, as printed in the problem. */
export interface SigFigTerm {
  text: string
  /** Rule 6: counted or defined, unlimited figures, never limits the result. */
  exact?: boolean
  /** Why it is exact, for the explanation: "counted", "defined: 100 cm = 1 m". */
  note?: string
}

/** A parenthesised (or precedence-bound) sub-calculation inside a mixed task; one family of ops. */
export interface SigFigGroup {
  terms: SigFigTerm[]
  /** ops.length === terms.length - 1, evaluated left to right. */
  ops: SigFigOp[]
}

export type SigFigOperand = SigFigTerm | SigFigGroup

export type SigFigTask =
  /** How many significant figures does `text` have? Answer: a whole number, or tapped digits. */
  | { kind: 'count'; text: string }
  /** Round `text`: give exactly one of sigFigs (to N significant figures) or place (power of ten). */
  | { kind: 'round'; text: string; sigFigs?: number; place?: number }
  /** Chain of * and / evaluated left to right. */
  | { kind: 'muldiv'; terms: SigFigTerm[]; ops: SigFigOp[] }
  /** Chain of + and - evaluated left to right. */
  | { kind: 'addsub'; terms: SigFigTerm[]; ops: SigFigOp[] }
  /**
   * One level of mixing: the outer ops are one family (all + - or all * /) and every group uses
   * the OTHER family. (a + b) / c  is  operands [{terms:[a,b],ops:['+']}, c], ops ['/'].
   */
  | { kind: 'mixed'; operands: SigFigOperand[]; ops: SigFigOp[] }
  /** Rewrite `text` in the other notation without changing its figures. */
  | { kind: 'convert'; text: string; to: 'scientific' | 'standard' }

export type SigFigRule = 'count' | 'round' | 'muldiv' | 'addsub' | 'convert'

/** What limited the answer. */
export interface SigFigLimit {
  rule: SigFigRule
  /** Limiting term(s), as indices into the task's terms in reading order (groups flattened). */
  termIndices: number[]
  /** Figures the answer keeps (for addsub: the figures the rounded answer ends up with). */
  sigFigs: number
  /** Place (power of ten) of the last digit the answer keeps. */
  place: number
  /** "hundredths", "tens", "ones", … */
  placeName: string
  /** One sentence, e.g. "4.1 has the fewest significant figures (2)." */
  text: string
}

export interface SigFigExpected {
  /** Canonical answer, ASCII and parseable: "3.0", "12000", "2.0 x 10^3", "2000.". Count tasks: "3". */
  text: string
  /** The same, pretty: "2.0 × 10³". */
  display: string
  /** Other spellings that are equally right (the scientific or standard twin), ASCII. */
  alternates: string[]
  /** Correctly rounded value as a plain decimal ("2000"); value only. */
  value: string
  sigFigs: number
  place: number
}

/** The un-rounded result of one group of a mixed task, and the precision it is good to. */
export interface SigFigIntermediate {
  /** Index into `task.operands`. */
  operandIndex: number
  rule: 'muldiv' | 'addsub'
  /** "12.11 + 1.3" */
  expression: string
  /** Every digit, e.g. "13.41" (ends with "…" when it never terminates). */
  unrounded: string
  /** What it would be if rounded now, e.g. "13.4". Display only: never feed it forward. */
  roundedDisplay: string
  sigFigs: number
  place: number
  placeName: string
  limit: SigFigLimit
}

export interface SigFigEvaluation {
  task: SigFigTask
  /** "12.50 ÷ 4.1", "(12.11 + 1.3) ÷ 2.0"; for count/round/convert the numeral itself. */
  expression: string
  /** Exact un-rounded value as text (the calculator display); ends with "…" if it never terminates. */
  unrounded: string
  unroundedTerminates: boolean
  limit: SigFigLimit
  expected: SigFigExpected
  /** The discarded part was exactly one half: generators must reject such tasks (rule 10). */
  tie: boolean
  rounding: 'up' | 'down' | 'exact'
  intermediates: SigFigIntermediate[]
  /** Ordered, student-readable explanation (shown after a correct answer or as the rung-3 reveal). */
  steps: string[]
}

export interface SigFigRounding {
  /** The input value, plain decimal. */
  exact: string
  /** Rounded value, plain decimal, value only ("2000"). */
  value: string
  /** Canonical text that SHOWS the figures ("2.0 x 10^3"). */
  text: string
  display: string
  /** Other right spellings (ASCII). */
  alternates: string[]
  sigFigs: number
  place: number
  tie: boolean
  direction: 'up' | 'down' | 'exact'
  /** What chopping instead of rounding would give (canonical text). */
  truncatedText: string
  /** First discarded digit, 0-9. */
  firstDropped: number
}

export interface SigFigGrade {
  status: 'correct' | 'wrong' | 'parse_error'
  /** Always set: the sentence to show her. */
  message: string
  /** Named mistake (wrong only) with a witness about HER numbers. Absent: `message` is the plain coaching. */
  pattern?: PatternHit
  parseError?: ParseError
  /** Correct, but worth a gentle remark (e.g. coefficient not between 1 and 10). */
  note?: string
  /** What she typed, analysed (absent on parse_error). */
  parsed?: SigFigNumeral
}

export interface SigFigTapFeedback {
  /** Index into the numeral's `chars`. */
  index: number
  ch: string
  role: SigFigCharRole
  significant: boolean
  selected: boolean
  ok: boolean
  rule: string
  /** Named mistake this wrong tap belongs to (absent when ok, or for a missed nonzero digit). */
  patternId?: ErrorPatternId
}

export interface SigFigTapGrade {
  correct: boolean
  /** The right count. */
  sigFigs: number
  selectedCount: number
  /** One entry per tappable digit, in reading order. */
  digits: SigFigTapFeedback[]
  /** Distinct named mistakes among the wrong taps, in reading order. */
  patterns: PatternHit[]
  message: string
}

/** A way a generated task can be unsuitable (see validateSigFigTask). */
export interface SigFigTaskIssue {
  code: 'invalid' | 'tie' | 'zero_result' | 'intermediate_carry' | 'not_representable'
  message: string
}

/** What a named mistake WOULD have produced for a task (`text` is canonical and parseable). */
export interface SigFigMistakeCandidate {
  id: ErrorPatternId
  text: string
  witness: string
}

// ---------------------------------------------------------------------------
// Atomic structure (chemistry). Engine: src/engine/atoms (exported from '@/engine').
// Particle counts are small whole numbers; masses and abundances are TEXT and every graded
// calculation is exact (the significant-figures engine's BigInt arithmetic). JSON-safe.
// ---------------------------------------------------------------------------

/** One atom or monatomic ion: element (by symbol and atomic number), mass number and charge. */
export interface AtomParticle {
  /** Element symbol exactly as printed, e.g. "Cl". */
  symbol: string
  /** Atomic number Z = protons. */
  z: number
  /** Mass number A = protons + neutrons. */
  massNumber: number
  /** Net charge, e.g. -1 for Cl⁻, 2 for Mg²⁺, 0 for a neutral atom. */
  charge: number
}

export interface AtomParticleCounts {
  protons: number
  neutrons: number
  electrons: number
}

/** One isotope of an element in a table: label, mass number, isotopic mass (u, TEXT). */
export interface AtomIsotope {
  /** "chlorine-35" for a real element, "X-63" for a made-up one. */
  label: string
  massNumber: number
  /** Isotopic mass in u as TEXT, e.g. "34.969". */
  mass: string
}

export interface AtomIsotopeRow extends AtomIsotope {
  /** Natural abundance in PERCENT as TEXT, e.g. "75.76". */
  abundance: string
}

/**
 * What an atomic-structure problem asks. `particles`: count protons / neutrons / electrons of a
 * particle shown as a nuclear symbol, in hyphen notation, or as a named ion. `notation`: the counts
 * are given, write the particle. `avgmass`: weighted average of an isotope table, as a sig-fig
 * `mixed` task (each mass × abundance ÷ 100 with 100 exact, joined by +). `abundance`: two isotopes
 * and the average are given; find both percents to the stated place.
 */
export type AtomQuestion =
  | { kind: 'particles'; particle: AtomParticle; shown: 'symbol' | 'hyphen' | 'ion' }
  | { kind: 'notation'; particle: AtomParticle }
  | {
      kind: 'avgmass'
      /** Element name ("chlorine") or "element X" for a made-up element. */
      element: string
      /** Symbol used in labels ("Cl", or "X"). */
      symbol: string
      fictional: boolean
      isotopes: AtomIsotopeRow[]
      /** The weighted average as a sig-fig task; grade with `gradeAverageMass`, never by text. */
      task: SigFigTask
    }
  | {
      kind: 'abundance'
      element: string
      symbol: string
      fictional: boolean
      isotopes: [AtomIsotope, AtomIsotope]
      /** Average atomic mass in u, TEXT. */
      average: string
      /** Place (power of ten) each percent is asked to: -2 = hundredths of a percent. */
      place: number
    }

/** Answer boxes of the atomic-structure questions. */
export type AtomBox =
  | 'protons'
  | 'neutrons'
  | 'electrons'
  | 'symbol'
  | 'massNumber'
  | 'atomicNumber'
  | 'charge'
  | 'abundance1'
  | 'abundance2'

export interface AtomBoxGrade {
  box: AtomBox
  status: 'correct' | 'wrong' | 'parse_error'
  /** Sentence for this box ('' when correct and nothing to add). Equals `pattern.witness` when a pattern is set. */
  message: string
  /** Named mistake for this box, with a witness about HER numbers. */
  pattern?: PatternHit
  /** Position indexes the text typed in THIS box. */
  parseError?: ParseError
}

export interface AtomGrade {
  /** `parse_error` when any box is empty or unreadable: nothing else is graded (and nothing is recorded). */
  status: 'correct' | 'wrong' | 'parse_error'
  /** Always set: the headline sentence to show her. */
  message: string
  /** One per box, in the order of the question's boxes (a parse-error grade lists only the unreadable boxes). */
  boxes: AtomBoxGrade[]
  /** Distinct named mistakes across the boxes, in box order (log each id to the store). */
  patterns: PatternHit[]
  /** Correct, but worth a gentle remark. */
  note?: string
}

/** What a named average-atomic-mass mistake WOULD produce for a question (`text` at the answer's precision). */
export interface AtomMistakeCandidate {
  id: ErrorPatternId
  text: string
  /** Exact value of the mistaken calculation, plain decimal text (may end in "…"). */
  exact: string
  witness: string
}
