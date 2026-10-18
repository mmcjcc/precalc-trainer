/**
 * Public types of the exponentials-and-logarithms core (precalculus). Every named mistake is an
 * ErrorPatternId with the prefix log_ (registered in @/shared/types, worded in matchers/catalog.ts), so a
 * result's `pattern` is a PatternHit the flows can record as they are.
 */
import type { ErrorPatternId, PatternHit, StepResult, VarName } from '@/shared/types'

/** Every log_ id of the shared catalog. */
export type LogPatternId = Extract<ErrorPatternId, `log_${string}`>

/** The caveat of a legal step that can let in extraneous answers (info, like squaring_caveat). */
export type LogCaveatId = 'log_check_answers'

/** The named mistakes (every log_ id except the caveat). */
export type LogMistakeId = Exclude<LogPatternId, LogCaveatId>

export const LOG_MISTAKE_IDS: readonly LogMistakeId[] = [
  'log_sum_split',
  'log_product_as_product',
  'log_quotient_as_quotient',
  'log_power_as_power',
  'log_coefficient_as_power',
  'log_coefficient_inside',
  'log_change_base_inverted',
  'log_identity_misused',
  'log_power_abs',
  'log_exp_sum_split',
  'log_exp_power_added',
  'log_exp_negative_exponent',
  'log_exp_coefficient_base',
  'log_convert_swapped',
  'log_convert_multiplied',
  'log_convert_dropped',
  'log_one_side',
  'log_extraneous_kept',
  'log_valid_rejected',
  'log_value_sign',
  'log_value_divided',
  'log_ln_confused',
]

// ---------------------------------------------------------------------------
// Properties a legal line used (for the detail sentence and, later, chips)
// ---------------------------------------------------------------------------

export type LogProperty =
  /** log(ab) = log a + log b (either direction). */
  | 'product_rule'
  /** log(a/b) = log a − log b. */
  | 'quotient_rule'
  /** log(aⁿ) = n log a. */
  | 'power_rule'
  /** log_b a = log a / log b. */
  | 'change_of_base'
  /** log_b(bᵘ) = u, b^(log_b u) = u, ln(eᵘ) = u, e^(ln u) = u. */
  | 'inverse_property'
  /** log_b 1 = 0, log_b b = 1. */
  | 'log_identity'
  /** bᵃ · bᶜ = b^(a + c), bᵃ / bᶜ = b^(a − c). */
  | 'exp_product'
  /** (bᵃ)ᶜ = b^(ac). */
  | 'exp_power'
  /** b⁻ⁿ = 1/bⁿ. */
  | 'exp_negative'
  /** A = B → log(A) = log(B) (any base). */
  | 'take_log'
  /** log_b A = C → A = b^C, b^A = C → A = log_b C: rewriting between exponential and log form. */
  | 'convert_form'
  /** log_b A = log_b B → A = B; bᴬ = bᴮ → A = B. */
  | 'one_to_one'
  /** Added, subtracted, multiplied or divided on both sides (the engine's Tier 1 moves). */
  | 'both_sides'
  /** Dropped a candidate that makes a log's input 0 or negative in the original. */
  | 'reject_extraneous'
  /** Rounded the exact answer to the decimal the problem asks for. */
  | 'rounded'
  /** Replaced a log of a number by its value (log₂ 8 → 3). */
  | 'evaluate'
  /** Any other legal rewrite (arithmetic, distributing, combining). */
  | 'rewrite'

export interface LogMove {
  properties: LogProperty[]
  /** Display sentence: "used the product rule (log(ab) = log a + log b)". */
  detail: string
}

// ---------------------------------------------------------------------------
// Decimal answers
// ---------------------------------------------------------------------------

/**
 * What a problem that wants a calculator decimal accepts: `places` (round to that many decimal places;
 * anything within half a unit in the last place of the exact value is right) or an explicit absolute
 * `tolerance`. Without one, the problem wants the EXACT answer and a decimal is not accepted.
 */
export type DecimalSpec = { places: number } | { tolerance: number }

// ---------------------------------------------------------------------------
// Line checkers
// ---------------------------------------------------------------------------

export interface LogStepContext {
  /** Letters the problem owns (default ['x']). */
  vars?: VarName[]
  seed?: number
  /**
   * The problem's first line. Extraneous answers are judged against ITS logs: a later line may keep or
   * drop a candidate that is outside the original's domain. Default: the previous line.
   */
  original?: string
  /** The problem says to assume every variable is positive (expand/condense exercises). */
  assumePositive?: boolean
  /** The problem wants a rounded decimal (the last line may then be x = 2.807). */
  decimal?: DecimalSpec
}

/** A candidate that solves a line but makes some log of the original undefined. */
export interface ExtraneousNote {
  value: number
  /** "-2" (app syntax; exact when the candidate is a simple number). */
  text: string
  /** The original's log input that is 0 or negative there, app syntax: "x - 3". */
  argument: string
  /** Its value there, display text: "−5". */
  argumentValue: string
  /** Display sentence: "x = −2 makes log(x) undefined: its input is −2." */
  sentence: string
}

/** `checkLogStep` / `checkLogRewrite` result: the shared StepResult plus the log reading of the step. */
export interface LogStepResult extends StepResult {
  /** The properties the step used (accepted steps). */
  logMove?: LogMove
  /** Candidates the new line lets in that fail the original's domain (with caveat 'extraneous_check'). */
  extraneous?: ExtraneousNote[]
  /** Candidates of the previous line this step dropped because they fail the original's domain. */
  rejected?: ExtraneousNote[]
  /** The line is a calculator decimal where the problem wants the exact form (not counted as a mistake). */
  notExact?: boolean
  /** A sentence to show when there is no pattern or counterexample (notExact, unsupported lines). */
  message?: string
}

export interface LogRewriteContext {
  /** Letters the expression may use (default ['x', 'y']). */
  vars?: VarName[]
  seed?: number
  /** The problem says to assume every variable is positive (the usual expand/condense instruction). */
  assumePositive?: boolean
}

// ---------------------------------------------------------------------------
// Graders (final answers)
// ---------------------------------------------------------------------------

/**
 * A grader's verdict (the polynomials core's shape):
 *  - correct:     right; `message` is a short confirmation.
 *  - mistake:     wrong, and exactly what the named slip produces for this problem; `witness` is about HER numbers.
 *  - wrong:       wrong, no named slip fits; `message` is a plain, specific sentence (it never states the answer).
 *  - invalid:     not an attempt: show `message` under the input and do not count it. `reason`:
 *                 'unreadable' (parse problem; `position`/`length` point into her text),
 *                 'not_exact' (a calculator decimal where the exact form is asked; the message does not say it),
 *                 'not_rounded' (the right value, but not to the places asked),
 *                 'not_in_form' (equal, but not the form the question asks for).
 *  - unsupported: the PROBLEM is outside the model (a template bug, never her fault).
 * `explanation` is the worked solution (display text): for the hint reveal and after a correct answer, not
 * next to a `wrong` verdict she can still retry.
 */
export type LogGrade =
  | { verdict: 'correct'; message: string; explanation: string[] }
  | { verdict: 'mistake'; mistake: LogMistakeId; pattern: PatternHit; witness: string; explanation: string[] }
  | { verdict: 'wrong'; message: string; explanation: string[] }
  | { verdict: 'invalid'; reason: 'unreadable' | 'not_exact' | 'not_rounded' | 'not_in_form'; message: string; position?: number; length?: number }
  | { verdict: 'unsupported'; message: string }

/** What one slip produces for a problem: the wrong value (or set, or line) she would end with. */
export interface LogMistakeCandidate {
  id: LogMistakeId
  /** App syntax of what the slip produces ("4", "log(2)/log(7)", "x = 6.5", "log_5(32) = 2"). */
  text: string
  /** Numeric value(s), when the candidate is a number or a solution set. */
  values?: number[]
  witness: string
  /** Later slips that produce the same thing (the earlier id wins). */
  shadows: LogMistakeId[]
}
