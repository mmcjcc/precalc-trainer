/**
 * Shared text for the exponentials-and-logarithms unit. Leak checks, rounding, and the sentences
 * shown while she can still change her answer. None of those sentences carry a generated answer.
 */
import type { Rng } from '@/content/rng'
import { makeRng, mixSeed } from '@/content/rng'
import type { RuleCard } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'

/** A draw that is legal arithmetic but not a problem we will ship. */
export class LogSkip extends Error {
  constructor(message = 'skip') {
    super(message)
    this.name = 'LogSkip'
  }
}

/** First draw that does not throw LogSkip. The salt order is fixed, so the seed stays deterministic. */
export function searchSeed<T>(seed: number, salt: number, tries: number, build: (rng: Rng, n: number) => T): T {
  for (let n = 0; n < tries; n++) {
    try {
      return build(makeRng(mixSeed(seed, salt + n * 97)), n)
    } catch (e) {
      if (e instanceof LogSkip) continue
      throw e
    }
  }
  throw new Error(`no exponential or log problem for seed ${seed} (salt ${salt})`)
}

export function ipow(base: number, exp: number): number {
  let out = 1
  for (let i = 0; i < exp; i++) out *= base
  return out
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

/** Lowest terms, with the sign on the numerator. "3", "-3/2". */
export function frac(n: number, d: number): string {
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  n /= g
  d /= g
  return d === 1 ? String(n) : `${n}/${d}`
}

/**
 * Rounding to a number of decimal places, halves away from zero as textbooks and the TI-84 do, then exactly that many
 * places. 2.0959 to three places is "2.096"; 2.25 to one place is "2.3" even when it was computed as
 * 2.2499999999999996, and −2.75 is "−2.8" (review 2026-10-22: Math.round gave "2.2" and "−2.7").
 */
export function roundPlaces(value: number, places: number): string {
  const scale = 10 ** places
  const x = Math.abs(value) * scale
  // A few units of float error at most (2.25 as 2.2499999999999996), never a real fraction of a unit: $15,143,643.72
  // to the cent is x ≈ 1.5e9, where a tolerance of 1e-9 · x would move the answer by a cent.
  const units = Math.floor(x + 0.5 + 64 * Number.EPSILON * Math.max(1, x))
  return (((units === 0 ? 1 : Math.sign(value)) * units) / scale).toFixed(places)
}

export interface ShowsOptions {
  /**
   * A period after the answer ends a sentence unless a digit follows: "log(0.1) = −1." shows "−1", and "−1.5" does
   * not. The guards on what she sees beside a retry (safeWitness, safeExample, safeLesson) use it: the engine's
   * witnesses end with the right value, as in "...a negative power of the base: log(0.1) = −1.". Problem generation
   * does not yet: its general rule-card facts ("passes through (0, 1).") would turn every graph problem away.
   */
  sentenceEnd?: boolean
}

/**
 * True when `example` contains `answerText` as a whole token, on either side of an arrow.
 * Letters and underscores are boundaries, so "log_29" does not contain "29", but "31^" contains "31".
 */
export function exampleShowsAnswer(example: string, answerText: string, opts: ShowsOptions = {}): boolean {
  const minus = (s: string) => s.replace(/[−–]/g, '-')
  const tight = (s: string) => minus(s).replace(/\s+/g, '')
  const ans = tight(answerText)
  if (!ans) return false
  const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const after = opts.sentenceEnd ? '(?![\\d/A-Za-z]|\\.\\d)' : '(?![\\d./A-Za-z])'
  const token = new RegExp(`(?<![\\d./A-Za-z_])${escaped}${after}`)
  if (token.test(tight(example))) return true
  // Spaces are a boundary too. Stripping them would glue "is 7/3" into "is7/3" and hide the number.
  const looseAns = minus(answerText).replace(/\s+/g, ' ').trim()
  if (!looseAns) return false
  const looseEsc = looseAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  return new RegExp(`(?<![\\d./A-Za-z_])${looseEsc}${after}`).test(minus(example))
}

export function anyShows(texts: readonly string[], forms: readonly string[], opts: ShowsOptions = {}): boolean {
  return forms.some((form) => form.length > 0 && texts.some((text) => exampleShowsAnswer(text, form, opts)))
}

/** What she sees beside a retry: an answer that ends a sentence counts too. */
const BESIDE_A_RETRY: ShowsOptions = { sentenceEnd: true }

/** Terminating decimal of a lowest-terms fraction ("3/2" → "1.5"), else null. */
export function terminatingDecimal(answer: string): string | null {
  const m = answer.match(/^(-?\d+)\/(\d+)$/)
  if (!m) return null
  const n = Number(m[1])
  let d = Number(m[2])
  if (!d) return null
  while (d % 2 === 0) d /= 2
  while (d % 5 === 0) d /= 5
  if (d !== 1) return null
  const text = (n / Number(m[2])).toFixed(12).replace(/\.?0+$/, '')
  return text === answer ? null : text
}

/** The exact value plus a terminating decimal, both of which grade correct. */
export function numberForms(answer: string): string[] {
  const forms = [answer]
  const dec = terminatingDecimal(answer)
  if (dec) forms.push(dec)
  return forms
}

const RESERVED = new Set([29, 31, 37, 41, 43])

/** Rule-card numbers. A generated answer, base, or argument must not be one of these. */
export function reserved(n: number): boolean {
  return RESERVED.has(n)
}

export function catalogExample(id: string): string {
  const hit = ERROR_PATTERNS[id as ErrorPatternId]
  return hit?.example ?? ''
}

/**
 * A witness or catalog example she will see beside a retry. If it contains a form that grades
 * correct, replace it: the engine's witness for several slips repeats the right value.
 */
export function safeWitness(witness: string, forms: readonly string[]): string {
  if (!witness || anyShows([witness], forms, BESIDE_A_RETRY)) {
    return 'That matches a named slip. The rule card shows the same kind of mistake on different numbers.'
  }
  return witness
}

export function safeExample(example: string, forms: readonly string[]): string {
  if (!example || anyShows([example], forms, BESIDE_A_RETRY)) return ''
  return example
}

/** A catalog lesson shown beside a retry. If it spells this problem's answer, use a number-free line. */
export function safeLesson(lesson: string, forms: readonly string[]): string {
  if (!lesson || anyShows([lesson], forms, BESIDE_A_RETRY)) {
    return 'Look at the rule card: the same kind of mistake, on different numbers.'
  }
  return lesson
}

/** Rule cards, the format hint, and the nudge: all on screen before she answers. */
export function staticTexts(rules: readonly RuleCard[], formatHint: string, nudge: string): string[] {
  return [formatHint, nudge, ...rules.flatMap((rule) => [rule.title, rule.body, rule.example ?? ''])]
}

export const VALUE_HINT = 'Type a number. A whole number or a fraction is fine.'
export const CONVERT_HINT = 'Write the other form: the base, the exponent, and the result.'
export const DECIMAL_HINT = 'Round to the number of decimal places the problem asks for.'
export const EXPAND_HINT = 'One line at a time. A sum or difference of logs, with numbers in front, is finished.'
export const CONDENSE_HINT = 'One line at a time, until it is a single logarithm.'
export const EQUATION_HINT = 'List every solution. You may write x = the number, or just the number.'

export const VALUE_NUDGE = 'Ask which power of the base gives the number inside. The answer is that exponent.'
export const CONVERT_NUDGE = 'The base stays the base. A logarithm equals the exponent, and a power equals the result.'
export const EXPAND_NUDGE = 'A product inside a log becomes a sum, a quotient becomes a difference, and an exponent comes down in front.'
export const CONDENSE_NUDGE = 'A sum of logs is a product inside one log. A number in front goes back up as an exponent. A plain number can be a log of the base.'
export const EQUATION_NUDGE = 'Do the same thing to both sides, or rewrite between a power and a log. Check every answer in the original logs at the end.'

const PLACES_WORD = ['', 'one', 'two', 'three', 'four'] as const

export function placesWord(places: number): string {
  return PLACES_WORD[places] ?? String(places)
}

/** TI-84 keystrokes for a change of base. The keys, never the number they produce. */
export function changeOfBaseNudge(arg: string, base: string, places: number): string {
  return `On the TI-84, LOG is base 10 and LN is base e. log base ${base} of ${arg} is LOG ${arg} ) ÷ LOG ${base} ), or logBASE(${arg}, ${base}). Round to ${placesWord(places)} decimal places. Do not copy a result from this hint.`
}

export function keyNudge(kind: 'log' | 'ln', arg: string, places: number): string {
  const key = kind === 'ln' ? 'LN' : 'LOG'
  return `On the TI-84, press ${key} ${arg} ). LOG is base 10 and LN is base e. Round to ${placesWord(places)} decimal places.`
}
