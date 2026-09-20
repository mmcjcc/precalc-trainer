/**
 * Opt-in differential sweep for the significant-figures engine (about a minute):
 *   node node_modules/vitest/vitest.mjs run --config vitest.sweep.config.mjs src/engine/sweep/sigfigs-differential.sweep.ts
 *
 * `src/engine/sigfigs` (digit strings) is run against `sigfigs-reference.ts` (exact fractions over
 * BigInt, figures counted arithmetically, digits by long division) on tens of thousands of seeded
 * cases. The two share no code. Only VALUES, PLACES and FIGURE COUNTS are compared, never spelling:
 * every text the engine produces is read back by the reference parser.
 *
 * A failure line reads:  [operation] input | engine: … | reference: …   (shortest inputs first).
 * The written conventions decide who is right; see docs/progress/sigfigs-fuzz.md, which also lists the
 * engine-side findings this sweep is expected to fail on until they are fixed:
 *   - muldiv/unrounded, mixed/unrounded: the calculator display pads zeros beyond 12 digits ("1e13 / 3" shows
 *     3333333333330…), so a false digit is shown;
 *   - grade/engine-text-exceeds-its-parser-limit: an alternate spelling with more than 30 digits is offered
 *     but refused when typed back ("round 1e-30 to 1 s.f.");
 *   - round/evaluate-threw-over-30-digits: evaluateSigFigTask throws on "round 4.0e30 to 2 s.f." although
 *     roundToSigFigs handles it.
 */
import { describe, expect, it } from 'vitest'
import {
  countSigFigs,
  evaluateSigFigTask,
  gradeSigFigAnswer,
  gradeSigFigIntermediate,
  gradeSigFigTaps,
  parseSigFigNumeral,
  roundToPlace,
  roundToSigFigs,
  validateSigFigTask,
} from '@/engine/sigfigs'
import type { SigFigEvaluation, SigFigOp, SigFigOperand, SigFigRounding, SigFigTask, SigFigTerm } from '@/shared/types'
import {
  type Frac,
  type RefChainResult,
  type RefPowerStyle,
  type RefRounding,
  fAbs,
  fDiv,
  fEq,
  fIsZero,
  fSub,
  frac,
  fracTimesPow10,
  longDivision,
  mustParse,
  plainDecimal,
  refChain,
  refMixed,
  refParse,
  refRoundToPlace,
  refRoundToSigFigs,
  refScientific,
  refStandard,
  terminates,
} from './sigfigs-reference'

// ---------------------------------------------------------------------------
// Seeded randomness (floats are fine HERE: they only choose shapes, never do chemistry)
// ---------------------------------------------------------------------------

type Rng = () => number
function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const int = (r: Rng, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1))
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
const chance = (r: Rng, p: number): boolean => r() < p

// ---------------------------------------------------------------------------
// Problem collection
// ---------------------------------------------------------------------------

interface Problem {
  op: string
  input: string
  engine: string
  reference: string
}

let totalCases = 0
const note = (text: string): void => {
  process.stdout.write(`[sigfigs-differential] ${text}\n`)
}

class Report {
  problems: Problem[] = []
  cases = 0
  constructor(readonly name: string) {}
  tick(n = 1): void {
    this.cases += n
    totalCases += n
  }
  add(op: string, input: string, engine: string, reference: string): void {
    if (this.problems.length < 5000) this.problems.push({ op, input, engine, reference })
  }
  /** Shortest input first, at most 12 per operation, so the fixer sees near-minimal cases. */
  lines(): string[] {
    const byOp = new Map<string, Problem[]>()
    for (const p of this.problems) {
      const list = byOp.get(p.op) ?? []
      list.push(p)
      byOp.set(p.op, list)
    }
    const out: string[] = []
    for (const [op, list] of byOp) {
      list.sort((a, b) => a.input.length - b.input.length)
      out.push(`${op}: ${list.length} disagreement(s)`)
      for (const p of list.slice(0, 12)) out.push(`  [${op}] ${p.input} | engine: ${p.engine} | reference: ${p.reference}`)
    }
    return out
  }
  finish(): void {
    note(`${this.name}: ${this.cases} cases, ${this.problems.length} disagreement(s); total so far ${totalCases}`)
    expect(this.lines(), `${this.name}: engine and reference disagree`).toEqual([])
  }
}

// ---------------------------------------------------------------------------
// Numeral generators
// ---------------------------------------------------------------------------

const NZ = '123456789'
const nz = (r: Rng): string => pick(r, NZ.split(''))
function zeroHeavy(r: Rng, len: number, pZero: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += chance(r, pZero) ? '0' : nz(r)
  return s
}
const zeros = (k: number): string => '0'.repeat(k)

const POWER_STYLES: readonly RefPowerStyle[] = ['e', 'E', 'x10^', ' x 10^', '×10^', ' × 10^', '*10^', ' * 10^']

function powerText(r: Rng, e: number): string {
  const style = pick(r, POWER_STYLES)
  const minus = chance(r, 0.4) ? '−' : '-'
  const sign = e < 0 ? minus : chance(r, 0.1) ? '+' : ''
  return style + sign + String(Math.abs(e))
}

/** A nonzero coefficient, adversarial about zeros. */
function coefficient(r: Rng, maxDigits: number): string {
  const shape = int(r, 0, 9)
  if (shape <= 2) {
    // whole number with placeholder zeros, maybe a trailing point
    const body = zeroHeavy(r, int(r, 0, Math.min(5, maxDigits - 2)), 0.5)
    const tail = zeros(int(r, 0, Math.max(0, Math.min(6, maxDigits - 1 - body.length))))
    return nz(r) + body + tail + (chance(r, 0.35) ? '.' : '')
  }
  if (shape <= 5) {
    // below one: leading zeros, captive zeros, trailing zeros
    const lead = zeros(int(r, 0, Math.min(8, maxDigits - 3)))
    const room = Math.max(0, maxDigits - 2 - lead.length)
    const body = zeroHeavy(r, int(r, 0, Math.min(5, room)), 0.5)
    const tail = zeros(int(r, 0, Math.max(0, Math.min(3, room - body.length))))
    return (chance(r, 0.15) ? '' : '0') + '.' + lead + nz(r) + body + tail
  }
  if (shape <= 8) {
    // something.something, zero heavy on both sides ("100.0", "10.050", "12.")
    const whole = nz(r) + zeroHeavy(r, int(r, 0, Math.min(4, maxDigits - 2)), 0.6)
    const room = Math.max(0, maxDigits - whole.length)
    return whole + '.' + zeroHeavy(r, int(r, 0, Math.min(6, room)), 0.6)
  }
  // redundant leading zeros: "007", "00.50", "0012.0"
  const inner = chance(r, 0.5) ? nz(r) + zeroHeavy(r, int(r, 0, 3), 0.5) : nz(r) + zeroHeavy(r, int(r, 0, 2), 0.5) + '.' + zeroHeavy(r, int(r, 1, 3), 0.6)
  return zeros(int(r, 1, 2)) + inner
}

function normalizedCoefficient(r: Rng): string {
  return nz(r) + (chance(r, 0.85) ? '.' + zeroHeavy(r, int(r, 1, 7), 0.5) : '')
}

const ZERO_TEXTS = ['0', '0.0', '0.00', '0.000', '00', '.0', '0.', '000.0', '0e3', '0.0e-2', '0.00 x 10^5'] as const

interface GenOptions {
  maxExp: number
  sign: boolean
  zero: boolean
  nonNormalized: boolean
}

/** Any numeral a student could type, adversarial about zeros, points and magnitude. */
function numeral(r: Rng, o: GenOptions): string {
  if (o.zero && chance(r, 0.03)) return pick(r, ZERO_TEXTS)
  let s: string
  const kind = r()
  if (kind < 0.62) s = coefficient(r, 22)
  else if (kind < 0.9 || !o.nonNormalized) s = normalizedCoefficient(r) + powerText(r, int(r, -o.maxExp, o.maxExp))
  else s = coefficient(r, 8) + powerText(r, int(r, -o.maxExp, o.maxExp))
  if (o.sign && chance(r, 0.12)) s = pick(r, ['-', '−', '+']) + s
  return s
}

/** A measured quantity as it would be printed in a chemistry problem. */
function measured(r: Rng): string {
  const k = r()
  if (k < 0.12) return normalizedCoefficient(r).slice(0, 6) + pick(r, ['e', ' x 10^']) + String(int(r, -9, 9))
  if (k < 0.3) {
    // whole numbers, some with placeholder zeros, some with a trailing point
    const body = nz(r) + zeroHeavy(r, int(r, 0, 3), 0.3)
    return body + zeros(int(r, 0, 3)) + (chance(r, 0.25) ? '.' : '')
  }
  if (k < 0.5) return '0.' + zeros(int(r, 0, 4)) + nz(r) + zeroHeavy(r, int(r, 0, 3), 0.35)
  return nz(r) + zeroHeavy(r, int(r, 0, 2), 0.3) + '.' + zeroHeavy(r, int(r, 1, 4), 0.35)
}

const EXACT_TEXTS = ['2', '3', '4', '5', '6', '8', '10', '12', '24', '60', '100', '1000', '2.54', '0.5'] as const

function term(r: Rng, pExact: number): SigFigTerm {
  if (chance(r, pExact)) return { text: pick(r, EXACT_TEXTS), exact: true, note: 'counted' }
  return { text: measured(r) }
}

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

const show = (v: unknown): string => {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Short exact rendering of a fraction for messages. */
function fracText(v: Frac): string {
  if (terminates(v)) {
    const t = plainDecimal(v)
    if (t.length <= 60) return t
  }
  return longDivision(v, 14).text + '…'
}

function taskText(t: SigFigTask): string {
  const term1 = (x: SigFigTerm): string => (x.exact ? `${x.text}(exact)` : x.text)
  const chainText = (terms: readonly SigFigTerm[], ops: readonly SigFigOp[]): string => terms.map((x, i) => (i === 0 ? '' : ` ${ops[i - 1]} `) + term1(x)).join('')
  switch (t.kind) {
    case 'count':
      return `count ${t.text}`
    case 'round':
      return t.sigFigs !== undefined ? `round ${t.text} to ${t.sigFigs} s.f.` : `round ${t.text} to place ${t.place}`
    case 'muldiv':
    case 'addsub':
      return chainText(t.terms, t.ops)
    case 'mixed':
      return t.operands.map((o, i) => (i === 0 ? '' : ` ${t.ops[i - 1]} `) + ('terms' in o ? `(${chainText(o.terms, o.ops)})` : term1(o))).join('')
    case 'convert':
      return `convert ${t.text} to ${t.to}`
  }
}

/**
 * Read a text the engine produced and check it shows `value` to `place`.
 * Returns a description of what is wrong, or null.
 */
function misreads(text: string, value: Frac, place: number): string | null {
  const p = refParse(text)
  if (!p.ok) return `"${text}" is not a numeral (stops at ${p.position})`
  if (!fEq(p.value, value)) return `"${text}" has value ${fracText(p.value)}, not ${fracText(value)}`
  if (p.lastPlace !== place) return `"${text}" is good to 10^${p.lastPlace}, not 10^${place}`
  return null
}

function tryRun<T>(f: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: f() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
  }
}

/** The engine's "calculator display" must be the true expansion, cut (or rounded) somewhere sensible. */
function checkUnrounded(rep: Report, op: string, input: string, shown: string, stops: boolean, exact: Frac): void {
  const refStops = terminates(exact)
  if (stops !== refStops) rep.add(op + '/terminates', input, String(stops), `${refStops} (value ${fracText(exact)})`)
  const ell = shown.endsWith('…') || shown.endsWith('...')
  const body = shown.replace(/(…|\.\.\.)$/, '')
  const p = refParse(body)
  if (!p.ok) {
    rep.add(op + '/unrounded', input, `unreadable "${shown}"`, fracText(exact))
    return
  }
  if (refStops) {
    if (ell || !fEq(p.value, exact)) rep.add(op + '/unrounded', input, shown, fracText(exact))
    return
  }
  const unit = fracTimesPow10(1n, p.lastWrittenPlace)
  const gap = fAbs(fSub(exact, p.value))
  const within = gap.n * unit.d <= unit.n * gap.d
  if (!ell || !within || p.digits.length < 6) rep.add(op + '/unrounded', input, shown, fracText(exact))
}

// ---------------------------------------------------------------------------
// Grader fuzz
// ---------------------------------------------------------------------------

function digitCount(text: string): number {
  return text.replace(/[^0-9]/g, '').length
}

/** Spell `v` so that it reads as good to 10^place; null when it cannot be written within the input limits. */
function spell(r: Rng, v: Frac, place: number): string | null {
  if (fIsZero(v)) return place <= 0 && place >= -20 ? refStandard(v, place) : null
  const std = refStandard(v, place)
  const sci = refScientific(v, place, pick(r, POWER_STYLES), chance(r, 0.3))
  const choice = std !== null && digitCount(std) <= 24 && chance(r, 0.7) ? std : sci
  return digitCount(choice) <= 28 ? choice : null
}

interface Answer {
  label: string
  text: string
}

/** Wrong answers a student plausibly gives; every one is re-checked by the oracle before use. */
function wrongAnswers(r: Rng, exact: Frac, R: RefRounding, mode: { n?: number }): Answer[] {
  const out: Answer[] = []
  const push = (label: string, text: string | null): void => {
    if (text !== null) out.push({ label, text })
  }
  // 1. the un-rounded calculator value
  if (!fEq(exact, R.value)) {
    if (terminates(exact)) {
      const t = plainDecimal(exact)
      if (digitCount(t) <= 28) push('unrounded', t)
    } else {
      const d = refRoundToSigFigs(exact, 10)
      push('unrounded(10 digits)', spell(r, d.value, d.place))
    }
  }
  // 2. chopped instead of rounded
  if (R.direction === 'up') push('truncated', spell(r, R.truncated, R.truncatedPlace))
  // 3. one figure too many / 4. one too few
  if (mode.n !== undefined) {
    const more = refRoundToSigFigs(exact, mode.n + 1)
    push('one figure too many', spell(r, more.value, more.place))
    if (mode.n >= 2) {
      const fewer = refRoundToSigFigs(exact, mode.n - 1)
      push('one figure too few', spell(r, fewer.value, fewer.place))
    }
  } else {
    const more = refRoundToPlace(exact, R.place - 1)
    push('one place too many', spell(r, more.value, more.place))
    const fewer = refRoundToPlace(exact, R.place + 1)
    if (!fIsZero(fewer.value)) push('one place too few', spell(r, fewer.value, fewer.place))
  }
  if (!fIsZero(R.value)) {
    // 5. dropped significant trailing zero (2.5 for 2.50)
    const m = fDiv(fAbs(R.value), fracTimesPow10(1n, R.place))
    if (m.n % 10n === 0n) push('dropped trailing zero', spell(r, R.value, R.place + 1))
    // 6. padded zero (2.500 for 2.50)
    push('padded zero', spell(r, R.value, R.place - 1))
  }
  return out
}

function oracleCorrect(text: string, R: RefRounding): boolean {
  const p = refParse(text)
  return p.ok && fEq(p.value, R.value) && p.lastPlace === R.place
}

const patternTally = new Map<string, number>()
function tally(label: string, id: string | undefined): void {
  const key = `${label} -> ${id ?? '(plain message)'}`
  patternTally.set(key, (patternTally.get(key) ?? 0) + 1)
}
function patternTallyLines(): string[] {
  return [...patternTally.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}: ${v}`)
}

function fuzzGrader(rep: Report, r: Rng, task: SigFigTask, exact: Frac, R: RefRounding, mode: { n?: number }, engineTexts: readonly string[]): void {
  const input = taskText(task)
  const right: Answer[] = engineTexts.map((t, i) => ({ label: i === 0 ? 'engine canonical' : 'engine alternate', text: t }))
  if (!fIsZero(R.value)) {
    const std = refStandard(R.value, R.place)
    if (std !== null && digitCount(std) <= 28) right.push({ label: 'reference standard spelling', text: std })
    const sci = refScientific(R.value, R.place, pick(r, POWER_STYLES), chance(r, 0.3))
    if (digitCount(sci) <= 28) right.push({ label: 'reference scientific spelling', text: sci })
  }
  // what an iPhone keyboard adds: outer spaces, an explicit plus sign
  const canonical = engineTexts[0]
  if (canonical !== undefined && digitCount(canonical) <= 30) {
    if (chance(r, 0.3)) right.push({ label: 'engine canonical with outer spaces', text: `  ${canonical} ` })
    if (chance(r, 0.15) && !/^[-+\u2212]/.test(canonical)) right.push({ label: 'engine canonical with a plus sign', text: `+${canonical}` })
  }
  for (const a of right) {
    rep.tick()
    const g = tryRun(() => gradeSigFigAnswer(task, a.text))
    if (!g.ok) rep.add('grade/threw', `${input} answer "${a.text}"`, g.error, 'correct')
    else if (g.value.status === 'parse_error' && digitCount(a.text) > 30 && a.label.startsWith('engine')) rep.add('grade/engine-text-exceeds-its-parser-limit', `${input} answer "${a.text}" (${a.label}, ${digitCount(a.text)} digits)`, `parse_error: ${g.value.message}`, 'correct (the engine offered this spelling itself)')
    else if (g.value.status !== 'correct') rep.add('grade/false-reject', `${input} answer "${a.text}" (${a.label})`, `${g.value.status}: ${g.value.message}`, 'correct')
  }
  for (const a of wrongAnswers(r, exact, R, mode)) {
    if (oracleCorrect(a.text, R)) continue
    rep.tick()
    const g = tryRun(() => gradeSigFigAnswer(task, a.text))
    if (!g.ok) rep.add('grade/threw', `${input} answer "${a.text}"`, g.error, 'wrong')
    else if (g.value.status !== 'wrong') rep.add('grade/false-accept', `${input} answer "${a.text}" (${a.label})`, g.value.status, 'wrong')
    else if (!g.value.message || g.value.message.trim().length < 10) rep.add('grade/no-coaching', `${input} answer "${a.text}" (${a.label})`, show(g.value.message), 'a sentence of coaching')
    else {
      tally(a.label, g.value.pattern?.id)
      // the engine's own policy: the whole terminating calculator value is always named sf_unrounded
      if (a.label === 'unrounded' && task.kind !== 'round' && g.value.pattern?.id !== 'sf_unrounded') rep.add('grade/unrounded-pattern', `${input} answer "${a.text}"`, `${g.value.pattern?.id ?? 'plain'}: ${g.value.message}`, 'sf_unrounded')
      if (g.value.pattern && !g.value.pattern.id.startsWith('sf_')) rep.add('grade/foreign-pattern', `${input} answer "${a.text}"`, g.value.pattern.id, 'an sf_* pattern')
    }
  }
}

// ---------------------------------------------------------------------------
// Whole-task comparison
// ---------------------------------------------------------------------------

function compareExpected(rep: Report, op: string, input: string, ev: SigFigEvaluation, exact: Frac, R: RefRounding): void {
  const want = plainDecimal(R.value)
  if (ev.expected.value !== want) rep.add(op + '/value', input, ev.expected.value, `${want} (exact ${fracText(exact)})`)
  if (ev.expected.place !== R.place) rep.add(op + '/place', input, String(ev.expected.place), String(R.place))
  if (ev.expected.sigFigs !== R.sigFigs) rep.add(op + '/sigFigs', input, String(ev.expected.sigFigs), String(R.sigFigs))
  if (ev.rounding !== R.direction) rep.add(op + '/direction', input, ev.rounding, R.direction)
  if (!fIsZero(R.value) || R.place <= 0) {
    for (const t of [ev.expected.text, ...ev.expected.alternates]) {
      const bad = misreads(t, R.value, R.place)
      if (bad) rep.add(op + '/answer-text', input, bad, `${want} good to 10^${R.place}`)
    }
  }
  checkUnrounded(rep, op, input, ev.unrounded, ev.unroundedTerminates, exact)
}

interface ChainOutcome {
  ev?: SigFigEvaluation
  usable: boolean
}

/** Shared by muldiv / addsub / mixed. `ref.rounding` is present when ref.status is ok. */
function compareChain(rep: Report, op: string, task: SigFigTask, ref: RefChainResult): ChainOutcome {
  const input = taskText(task)
  rep.tick()
  const run = tryRun(() => evaluateSigFigTask(task))
  const issues = tryRun(() => validateSigFigTask(task))
  if (!issues.ok) {
    rep.add(op + '/validate-threw', input, issues.error, 'validateSigFigTask never throws')
    return { usable: false }
  }
  const codes = issues.value.map((i) => i.code)
  if (ref.status !== 'ok' || !ref.rounding) {
    // The reference finds the task degenerate: the engine must refuse it or at least flag it.
    if (run.ok && codes.length === 0) rep.add(op + '/accepted-degenerate', input, `answer ${run.value.expected.text}, no issues`, `unusable: ${ref.reason}`)
    return { usable: false }
  }
  const R = ref.rounding
  if (!run.ok) {
    rep.add(op + '/threw', input, run.error, `${plainDecimal(R.value)} good to 10^${R.place}`)
    return { usable: false }
  }
  const ev = run.value
  if (ev.tie !== R.tie) rep.add(op + '/tie', input, String(ev.tie), `${R.tie} (exact ${fracText(ref.exactValue)}, place 10^${R.place})`)
  if (R.tie !== codes.includes('tie')) rep.add(op + '/validate-tie', input, show(codes), R.tie ? 'tie' : 'no tie')
  if (R.tie) return { ev, usable: false }
  if (ref.debatable) {
    if (!codes.includes('intermediate_carry')) rep.add(op + '/validate-carry', input, show(codes), 'intermediate_carry (count differs before/after rounding the group)')
    return { ev, usable: false }
  }
  if (codes.includes('intermediate_carry')) rep.add(op + '/validate-carry', input, show(codes), 'no carry in any group')
  compareExpected(rep, op, input, ev, ref.exactValue, R)
  if (fIsZero(R.value)) {
    if (!codes.includes('zero_result')) rep.add(op + '/validate-zero', input, show(codes), 'zero_result')
    return { ev, usable: false }
  }
  const other = codes.filter((c) => c !== 'zero_result')
  if (other.length > 0) rep.add(op + '/validate-false-alarm', input, show(issues.value), 'a usable task')
  if (ref.rule === 'muldiv') {
    if (ev.limit.sigFigs !== ref.limitSigFigs) rep.add(op + '/limit.sigFigs', input, String(ev.limit.sigFigs), String(ref.limitSigFigs))
  } else if (ev.limit.place !== ref.limitPlace) rep.add(op + '/limit.place', input, String(ev.limit.place), String(ref.limitPlace))
  if (ev.limit.rule !== ref.rule) rep.add(op + '/limit.rule', input, ev.limit.rule, ref.rule)
  return { ev, usable: true }
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

const ANY: GenOptions = { maxExp: 60, sign: true, zero: true, nonNormalized: true }

describe('significant figures: engine vs independent reference', () => {
  it('anchor cases from the written conventions (both sides)', () => {
    const rep = new Report('anchors')
    const counts: [string, number][] = [
      ['0.00450', 3], ['1200', 2], ['1200.', 4], ['100.0', 4], ['5002', 4], ['0.10050', 5], ['300', 1],
      ['3.00e8', 3], ['40.', 2], ['0.5', 1], ['1.20 x 10^3', 3],
    ]
    for (const [text, n] of counts) {
      rep.tick()
      expect(mustParse(text).sigFigs, `reference count ${text}`).toBe(n)
      const c = tryRun(() => countSigFigs(text))
      if (!c.ok || c.value !== n) rep.add('anchor/count', text, c.ok ? String(c.value) : c.error, String(n))
    }
    const rounds: [string, number, string, number][] = [
      ['0.004567', 2, '0.0046', -4], ['12345', 2, '12000', 3], ['1999', 2, '2000', 2], ['0.99961', 3, '1', -2],
    ]
    for (const [text, n, value, place] of rounds) {
      rep.tick()
      const R = refRoundToSigFigs(mustParse(text).value, n)
      expect(plainDecimal(R.value), `reference round ${text}`).toBe(value)
      expect(R.place).toBe(place)
      const e = tryRun(() => roundToSigFigs(text, n))
      if (!e.ok) rep.add('anchor/round', `${text} to ${n}`, e.error, value)
      else {
        const bad = misreads(e.value.text, R.value, R.place)
        if (bad) rep.add('anchor/round', `${text} to ${n}`, bad, `${value} good to 10^${place}`)
      }
    }
    const round1999: SigFigTask = { kind: 'round', text: '1999', sigFigs: 2 }
    for (const [answer, status] of [['2000', 'wrong'], ['2.0e3', 'correct'], ['2.0 x 10^3', 'correct'], ['2000.', 'wrong']] as const) {
      rep.tick()
      const g = gradeSigFigAnswer(round1999, answer)
      if (g.status !== status) rep.add('anchor/grade', `round 1999 to 2, answer ${answer}`, g.status, status)
    }
    const round12345: SigFigTask = { kind: 'round', text: '12345', sigFigs: 2 }
    for (const answer of ['12000', '1.2e4', '1.2 x 10^4', '1.2×10^4']) {
      rep.tick()
      const g = gradeSigFigAnswer(round12345, answer)
      if (g.status !== 'correct') rep.add('anchor/grade', `round 12345 to 2, answer ${answer}`, g.status, 'correct')
    }
    const chains: [SigFigTask, string, number, string[], string[]][] = [
      [{ kind: 'muldiv', terms: [{ text: '3.20' }, { text: '1.5' }], ops: ['*'] }, '4.8', -1, ['4.8'], ['4.80', '5', '4.800']],
      [{ kind: 'muldiv', terms: [{ text: '12.50' }, { text: '4.1' }], ops: ['/'] }, '3', -1, ['3.0'], ['3', '3.05', '3.049', '3.00']],
      [{ kind: 'addsub', terms: [{ text: '12.11' }, { text: '18.0' }, { text: '1.013' }], ops: ['+', '+'] }, '31.1', -1, ['31.1'], ['31.123', '31.12', '31']],
      [{ kind: 'addsub', terms: [{ text: '5.26' }, { text: '5.21' }], ops: ['-'] }, '0.05', -2, ['0.05'], ['0.050', '0.1', '0.0500']],
    ]
    for (const [task, value, place, good, bad] of chains) {
      rep.tick()
      const ref = task.kind === 'muldiv' || task.kind === 'addsub' ? refChain(task.terms, task.ops) : null
      expect(ref?.status).toBe('ok')
      expect(plainDecimal(ref!.rounding!.value), `reference ${taskText(task)}`).toBe(value)
      expect(ref!.rounding!.place).toBe(place)
      const ev = tryRun(() => evaluateSigFigTask(task))
      if (!ev.ok) rep.add('anchor/evaluate', taskText(task), ev.error, value)
      else {
        const wrong = misreads(ev.value.expected.text, ref!.rounding!.value, place)
        if (wrong) rep.add('anchor/evaluate', taskText(task), wrong, `${value} good to 10^${place}`)
      }
      for (const a of good) if (gradeSigFigAnswer(task, a).status !== 'correct') rep.add('anchor/grade', `${taskText(task)} answer ${a}`, gradeSigFigAnswer(task, a).status, 'correct')
      for (const a of bad) if (gradeSigFigAnswer(task, a).status !== 'wrong') rep.add('anchor/grade', `${taskText(task)} answer ${a}`, gradeSigFigAnswer(task, a).status, 'wrong')
    }
    // rule 6: an exact number never limits
    const exactTask: SigFigTask = { kind: 'muldiv', terms: [{ text: '2.54' }, { text: '12', exact: true }], ops: ['*'] }
    rep.tick()
    if (gradeSigFigAnswer(exactTask, '30.5').status !== 'correct') rep.add('anchor/grade', '2.54 * 12(exact) answer 30.5', gradeSigFigAnswer(exactTask, '30.5').status, 'correct')
    if (gradeSigFigAnswer(exactTask, '30').status !== 'wrong') rep.add('anchor/grade', '2.54 * 12(exact) answer 30', gradeSigFigAnswer(exactTask, '30').status, 'wrong')
    rep.finish()
  })

  it('counting figures on adversarial numerals', () => {
    const rep = new Report('count')
    const r = makeRng(20260920)
    for (let k = 0; k < 24000; k++) {
      const text = numeral(r, ANY)
      const ref = mustParse(text)
      rep.tick()
      const got = parseSigFigNumeral(text)
      if (!got.ok) {
        rep.add('parse/refused', text, `${got.error.message} @${got.error.position}`, `${ref.sigFigs} s.f.`)
        continue
      }
      const e = got.numeral
      const cmp = (field: string, a: unknown, b: unknown): void => {
        if (a !== b) rep.add('parse/' + field, text, show(a), show(b))
      }
      cmp('sigFigs', e.sigFigs, ref.sigFigs)
      cmp('isZero', e.isZero, ref.isZero)
      cmp('firstSigPlace', e.firstSigPlace, ref.firstPlace)
      cmp('lastSigPlace', e.lastSigPlace, ref.lastPlace)
      cmp('hasDecimalPoint', e.hasDecimalPoint, ref.hasPoint)
      cmp('scientific', e.scientific, ref.scientific)
      cmp('normalized', e.normalized, ref.normalized)
      cmp('exponent', e.exponent, ref.exponent)
      cmp('value', e.value, plainDecimal(ref.value))
      if (!ref.isZero) cmp('negative', e.negative, ref.negative)
      cmp('sigDigits', e.sigDigits, ref.digits.filter((d) => d.significant).map((d) => d.digit).join(''))
      cmp('digits', e.digits, ref.digits.map((d) => d.digit).join(''))
      cmp('text', e.text, text)
      cmp('chars.length', e.chars.length, text.length)
      const tappable = e.chars.filter((c) => c.digit).map((c) => c.index).join(',')
      cmp('tappable', tappable, ref.digits.map((d) => d.index).join(','))
      ref.digits.forEach((d, idx) => {
        const c = e.chars[d.index]
        if (!c) return
        if (c.significant !== d.significant) rep.add('parse/char.significant', `${text} [${d.index}]`, String(c.significant), String(d.significant))
        if (c.place !== d.place) rep.add('parse/char.place', `${text} [${d.index}]`, String(c.place), String(d.place))
        // role, where the conventions leave no room
        let role: string | null = null
        if (ref.isZero) role = null
        else if (d.digit !== 0) role = 'nonzero'
        else if (d.place > ref.firstPlace) role = 'leading_zero'
        else if (d.place < ref.lastPlace) role = 'trailing_zero_placeholder'
        else if (ref.digits.slice(idx + 1).some((x) => x.digit !== 0)) role = 'captive_zero'
        else if (idx === ref.digits.length - 1) role = 'trailing_zero_decimal'
        if (role !== null && c.role !== role) rep.add('parse/char.role', `${text} [${d.index}]`, c.role, role)
        if (!c.rule || c.rule.length < 8) rep.add('parse/char.rule', `${text} [${d.index}]`, show(c.rule), 'a sentence')
      })
      if (!ref.isZero) {
        const c = tryRun(() => countSigFigs(text))
        if (!c.ok || c.value !== ref.sigFigs) rep.add('countSigFigs', text, c.ok ? String(c.value) : c.error, String(ref.sigFigs))
        // count task + grader
        if (k % 4 === 0) {
          const task: SigFigTask = { kind: 'count', text }
          const ev = tryRun(() => evaluateSigFigTask(task))
          if (!ev.ok) rep.add('count/evaluate-threw', text, ev.error, String(ref.sigFigs))
          else if (ev.value.expected.text !== String(ref.sigFigs)) rep.add('count/expected', text, ev.value.expected.text, String(ref.sigFigs))
          for (const delta of [0, 1, -1, 2]) {
            const a = ref.sigFigs + delta
            if (a < 1) continue
            rep.tick()
            const g = tryRun(() => gradeSigFigAnswer(task, String(a)))
            const want = delta === 0 ? 'correct' : 'wrong'
            if (!g.ok || g.value.status !== want) rep.add('count/grade', `${text} answer ${a}`, g.ok ? g.value.status : g.error, want)
          }
        }
        // tapping the significant digits
        if (k % 4 === 1) {
          const sig = ref.digits.filter((d) => d.significant).map((d) => d.index)
          const notSig = ref.digits.filter((d) => !d.significant).map((d) => d.index)
          rep.tick()
          const ok = tryRun(() => gradeSigFigTaps(text, sig))
          if (!ok.ok || !ok.value.correct || ok.value.sigFigs !== ref.sigFigs) rep.add('taps/right-set', `${text} taps [${sig}]`, ok.ok ? `correct=${ok.value.correct} sigFigs=${ok.value.sigFigs}` : ok.error, `correct, ${ref.sigFigs}`)
          const variants: number[][] = []
          if (sig.length > 1) {
            const drop = int(r, 0, sig.length - 1)
            variants.push(sig.filter((_, i) => i !== drop))
          }
          if (notSig.length > 0) variants.push([...sig, pick(r, notSig)])
          if (notSig.length > 0) variants.push([...sig, ...notSig])
          for (const v of variants) {
            rep.tick()
            const bad = tryRun(() => gradeSigFigTaps(text, v))
            if (!bad.ok || bad.value.correct) rep.add('taps/wrong-set', `${text} taps [${v}]`, bad.ok ? 'correct' : bad.error, `wrong (significant: [${sig}])`)
            else if (!bad.value.message) rep.add('taps/no-coaching', `${text} taps [${v}]`, 'empty message', 'a sentence')
          }
        }
      }
    }
    rep.finish()
  })

  it('reading what she types: spellings, whitespace, refusals', () => {
    const rep = new Report('input')
    const r = makeRng(77)
    // every spec'd spelling of the same number reads the same
    for (let k = 0; k < 3000; k++) {
      const coeff = chance(r, 0.7) ? normalizedCoefficient(r) : coefficient(r, 8)
      const e = int(r, -30, 30)
      const base = mustParse(coeff + 'e' + e)
      const minus = ['-', '−']
      const spellings: string[] = []
      for (const style of ['e', 'E', 'x10^', 'x 10^', ' x 10^', ' x10^', '×10^', ' × 10^', '*10^', ' * 10^', ' x 10 ^ ']) {
        const sign = e < 0 ? pick(r, minus) : ''
        spellings.push(coeff + style + sign + Math.abs(e))
      }
      for (const s of spellings) {
        rep.tick()
        const got = parseSigFigNumeral(chance(r, 0.2) ? `  ${s} ` : s)
        if (!got.ok) rep.add('input/refused-spelling', s, `${got.error.message} @${got.error.position}`, `${base.sigFigs} s.f., value ${fracText(base.value)}`)
        else if (got.numeral.sigFigs !== base.sigFigs || got.numeral.value !== plainDecimal(base.value) || got.numeral.lastSigPlace !== base.lastPlace) {
          rep.add('input/spelling-changes-reading', s, `${got.numeral.sigFigs} s.f., value ${got.numeral.value}`, `${base.sigFigs} s.f., value ${fracText(base.value)}`)
        }
      }
    }
    // must be refused, with a position inside the text
    const refused: [string, number | null][] = [
      ['12,000', 2], ['1,200.5', 1], ['3.0 g', 4], ['3.0g', 3], ['12 mL', 3], ['1.2.3', 3], ['1..2', 2], ['', null], ['.', null],
      ['-', null], ['e3', 0], ['1e', null], ['1.2e', null], ['1.2x10^', null], ['1.2x10', null], ['1.2x', null], ['1 2', null], ['1.2 3', null],
      ['abc', 0], ['1/2', 1], ['$5', 0], ['5%', 1], ['1.2e3.5', null], ['--5', null], ['1.2x11^3', null], ['1.2e--3', null], ['2.5 x 100', null],
      ['1_000', 1], ["1'000", 1], ['1.2e3e4', null], ['½', 0], ['0x10', null], ['1.5 x 10^x', null],
    ]
    for (const [text, pos] of refused) {
      rep.tick()
      const got = tryRun(() => parseSigFigNumeral(text))
      if (!got.ok) rep.add('input/parse-threw', show(text), got.error, 'a ParseError value')
      else if (got.value.ok) rep.add('input/accepted-garbage', show(text), `${got.value.numeral.sigFigs} s.f., value ${got.value.numeral.value}`, 'refused')
      else {
        const p = got.value.error.position
        if (!got.value.error.message || got.value.error.message.length < 8) rep.add('input/no-message', show(text), show(got.value.error), 'a friendly sentence')
        if (p !== undefined && (p < 0 || p > text.length)) rep.add('input/position-out-of-range', show(text), String(p), `0..${text.length}`)
        if (pos !== null && p !== pos) rep.add('input/position', show(text), String(p), String(pos))
      }
      const g = tryRun(() => gradeSigFigAnswer({ kind: 'round', text: '12345', sigFigs: 2 }, text))
      if (!g.ok) rep.add('input/grade-threw', show(text), g.error, 'parse_error')
      else if (g.value.status !== 'parse_error') rep.add('input/grade-status', show(text), g.value.status, 'parse_error')
    }
    // random keyboard mash never throws; whatever the reference can read, the engine reads the same way
    const alphabet = '0123456789..,-+eExX*^ 10−×()/g%'
    let extensions = 0
    const extensionSamples: string[] = []
    for (let k = 0; k < 20000; k++) {
      let s = ''
      const len = int(r, 1, 9)
      for (let i = 0; i < len; i++) s += alphabet[int(r, 0, alphabet.length - 1)]
      rep.tick()
      const got = tryRun(() => parseSigFigNumeral(s))
      if (!got.ok) {
        rep.add('input/parse-threw', show(s), got.error, 'a ParseError value')
        continue
      }
      const ref = refParse(s)
      if (ref.ok && Math.abs(ref.exponent) <= 99) {
        if (!got.value.ok) rep.add('input/refused-valid', show(s), `${got.value.error.message} @${got.value.error.position}`, `${ref.sigFigs} s.f.`)
        else if (got.value.numeral.sigFigs !== ref.sigFigs || got.value.numeral.value !== plainDecimal(ref.value)) rep.add('input/mash-reading', show(s), `${got.value.numeral.sigFigs} s.f., ${got.value.numeral.value}`, `${ref.sigFigs} s.f., ${fracText(ref.value)}`)
      } else if (!ref.ok && got.value.ok) {
        extensions++
        if (extensionSamples.length < 40 && !extensionSamples.includes(s)) extensionSamples.push(s)
      }
    }
    note(`input: ${extensions} mashed strings accepted by the engine beyond the spec grammar, e.g. ${show(extensionSamples)}`)
    rep.finish()
  })

  it('rounding to every N, including carries and results that need scientific notation', () => {
    const rep = new Report('round-to-figures')
    const r = makeRng(4242)
    const special = ['1999', '0.99961', '99.96', '9.9995', '20012', '40000.2', '0.0009996', '9999', '99999.9', '1.0049', '10049', '2049', '950', '0.0950', '9.5001e7', '9.96e-12', '5002', '100.049']
    const opts: GenOptions = { maxExp: 40, sign: true, zero: false, nonNormalized: true }
    for (let k = 0; k < 7000; k++) {
      let text = k < special.length ? special[k]! : numeral(r, opts)
      if (chance(r, 0.25)) {
        // force a carry chain: a run of nines after the first digit
        const lead = pick(r, ['', '0.', '0.00'])
        const tail = pick(r, lead === '' ? ['', '6', '51', '49', '.97', '0', '.'] : ['', '6', '51', '49', '0'])
        text = lead + nz(r) + '9'.repeat(int(r, 1, 5)) + tail + (chance(r, 0.2) && tail !== '.' ? 'e' + int(r, -20, 20) : '')
      }
      const ref = mustParse(text)
      if (ref.isZero) continue
      const maxN = Math.min(ref.digits.length, 14)
      for (let n = 1; n <= maxN; n++) {
        if (n > ref.sigFigs) break
        rep.tick()
        const R = refRoundToSigFigs(ref.value, n)
        const input = `${text} to ${n} s.f.`
        const got = tryRun(() => roundToSigFigs(text, n))
        if (!got.ok) {
          rep.add('round/threw', input, got.error, `${plainDecimal(R.value)} good to 10^${R.place}`)
          continue
        }
        compareRounding(rep, 'round', input, got.value, ref.value, R)
        if (R.tie) continue
        if (k % 3 === 0) {
          const task: SigFigTask = { kind: 'round', text, sigFigs: n }
          const ev = tryRun(() => evaluateSigFigTask(task))
          if (!ev.ok) rep.add(plainDecimal(ref.value).replace(/[^0-9]/g, '').length > 30 ? 'round/evaluate-threw-over-30-digits' : 'round/evaluate-threw', input, ev.error, plainDecimal(R.value))
          else {
            if (ev.value.tie) rep.add('round/evaluate-tie', input, 'true', 'false')
            for (const t of [ev.value.expected.text, ...ev.value.expected.alternates]) {
              const bad = misreads(t, R.value, R.place)
              if (bad) rep.add('round/evaluate-text', input, bad, `${plainDecimal(R.value)} good to 10^${R.place}`)
            }
            fuzzGrader(rep, r, task, ref.value, R, { n }, [ev.value.expected.text, ...ev.value.expected.alternates])
          }
        }
      }
    }
    rep.finish()
  })

  it('rounding to a place', () => {
    const rep = new Report('round-to-place')
    const r = makeRng(99)
    const opts: GenOptions = { maxExp: 25, sign: true, zero: false, nonNormalized: false }
    for (let k = 0; k < 6000; k++) {
      const text = numeral(r, opts)
      const ref = mustParse(text)
      if (ref.isZero) continue
      const lo = Math.max(ref.lastWrittenPlace, ref.firstPlace - 12)
      for (let place = ref.firstPlace; place >= lo; place--) {
        rep.tick()
        const R = refRoundToPlace(ref.value, place)
        const input = `${text} to place ${place}`
        const got = tryRun(() => roundToPlace(text, place))
        if (!got.ok) {
          rep.add('roundPlace/threw', input, got.error, `${plainDecimal(R.value)} good to 10^${R.place}`)
          continue
        }
        compareRounding(rep, 'roundPlace', input, got.value, ref.value, R)
        if (!R.tie && k % 4 === 0 && !fIsZero(R.value)) {
          const task: SigFigTask = { kind: 'round', text, place }
          const ev = tryRun(() => evaluateSigFigTask(task))
          if (!ev.ok) rep.add('roundPlace/evaluate-threw', input, ev.error, plainDecimal(R.value))
          else fuzzGrader(rep, r, task, ref.value, R, {}, [ev.value.expected.text, ...ev.value.expected.alternates])
        }
      }
    }
    rep.finish()
  })

  it('tie detection (constructed ties and near misses)', () => {
    const rep = new Report('ties')
    const r = makeRng(555)
    let ties = 0
    for (let k = 0; k < 6000; k++) {
      const n = int(r, 1, 6)
      const kept = nz(r) + zeroHeavy(r, n - 1, 0.3)
      const tailKind = int(r, 0, 3)
      // 0: exactly half; 1: a hair above half; 2: a hair below half; 3: half written with trailing zeros
      const tail = tailKind === 0 ? '5' : tailKind === 1 ? '5' + zeros(int(r, 0, 4)) + nz(r) : tailKind === 2 ? '4' + '9'.repeat(int(r, 1, 6)) : '5' + zeros(int(r, 1, 4))
      const all = kept + tail
      const cut = int(r, 0, all.length)
      let text: string
      const layout = int(r, 0, 3)
      if (layout === 0) text = all.slice(0, cut) + '.' + all.slice(cut)
      else if (layout === 1) text = '0.' + zeros(int(r, 0, 5)) + all
      else if (layout === 2) text = all[0] + '.' + all.slice(1) + 'e' + int(r, -30, 30)
      else text = all + zeros(int(r, 0, 4)) + (chance(r, 0.3) ? '.' : '')
      if (text.startsWith('.')) text = '0' + text
      const ref = mustParse(text)
      const R = refRoundToSigFigs(ref.value, n)
      const wantTie = tailKind === 0 || tailKind === 3
      expect(R.tie, `reference tie for ${text} to ${n}`).toBe(wantTie)
      if (R.tie) ties++
      rep.tick()
      const got = tryRun(() => roundToSigFigs(text, n))
      const input = `${text} to ${n} s.f.`
      if (!got.ok) {
        rep.add('tie/threw', input, got.error, `tie=${R.tie}`)
        continue
      }
      if (got.value.tie !== R.tie) rep.add('tie/roundToSigFigs', input, String(got.value.tie), String(R.tie))
      // rule 10 says half-up on the magnitude, so even a tie has a defined value
      if (got.value.value !== plainDecimal(R.value)) rep.add('tie/half-up-value', input, got.value.value, plainDecimal(R.value))
      const issues = tryRun(() => validateSigFigTask({ kind: 'round', text, sigFigs: n }))
      if (!issues.ok) rep.add('tie/validate-threw', input, issues.error, 'never throws')
      else if (issues.value.some((i) => i.code === 'tie') !== R.tie) rep.add('tie/validate', input, show(issues.value.map((i) => i.code)), R.tie ? 'tie' : 'no tie')
      // the same thing through roundToPlace
      const viaPlace = tryRun(() => roundToPlace(text, R.carried ? R.place - 1 : R.place))
      if (viaPlace.ok && viaPlace.value.tie !== R.tie) rep.add('tie/roundToPlace', input, String(viaPlace.value.tie), String(R.tie))
    }
    // ties that come out of arithmetic: products ending in 5, halves and eighths, sums one place finer
    for (let k = 0; k < 6000; k++) {
      let task: SigFigTask
      const kind = int(r, 0, 2)
      if (kind === 0) {
        const a = nz(r) + '.' + pick(r, ['5', '25', '75', '5', '05'])
        const b = pick(r, ['2.5', '1.5', '3.5', '0.50', '4.5', '7.5', '2.50', '0.25'])
        task = { kind: 'muldiv', terms: [{ text: a }, { text: b }], ops: ['*'] }
      } else if (kind === 1) {
        const a = nz(r) + '.' + int(r, 0, 9) + (chance(r, 0.5) ? String(int(r, 0, 9)) : '')
        const b = pick(r, ['2.0', '4.0', '8.0', '1.6', '0.40', '0.80', '3.2', '16', '0.020'])
        task = { kind: 'muldiv', terms: [{ text: a }, { text: b }], ops: ['/'] }
      } else {
        const a = int(r, 1, 99) + '.' + int(r, 0, 9) + pick(r, ['5', '5', '50', '4', '6'])
        const b = int(r, 1, 99) + '.' + int(r, 0, 9)
        task = { kind: 'addsub', terms: [{ text: a }, { text: b }], ops: [pick(r, ['+', '-'] as const)] }
      }
      if (task.kind !== 'muldiv' && task.kind !== 'addsub') continue
      const ref = refChain(task.terms, task.ops)
      if (ref.status !== 'ok' || !ref.rounding) continue
      if (ref.rounding.tie) ties++
      rep.tick()
      const input = taskText(task)
      const ev = tryRun(() => evaluateSigFigTask(task))
      if (!ev.ok) {
        if (!ref.rounding.tie) rep.add('tie/evaluate-threw', input, ev.error, 'not a tie')
      } else if (ev.value.tie !== ref.rounding.tie) rep.add('tie/evaluate', input, String(ev.value.tie), `${ref.rounding.tie} (exact ${fracText(ref.exactValue)})`)
      const issues = validateSigFigTask(task)
      if (issues.some((i) => i.code === 'tie') !== ref.rounding.tie) rep.add('tie/validate-task', input, show(issues.map((i) => i.code)), ref.rounding.tie ? 'tie' : 'no tie')
    }
    expect(ties, 'the tie test must actually contain ties').toBeGreaterThan(3000)
    rep.finish()
  })

  it('multiply / divide chains of 2-4 terms with exact numbers mixed in', () => {
    const rep = new Report('muldiv')
    const r = makeRng(31337)
    for (let k = 0; k < 9000; k++) {
      const count = int(r, 2, 4)
      const terms: SigFigTerm[] = []
      for (let i = 0; i < count; i++) terms.push(term(r, 0.2))
      if (terms.every((t) => t.exact)) terms[int(r, 0, count - 1)] = { text: measured(r) }
      const ops: SigFigOp[] = []
      for (let i = 1; i < count; i++) ops.push(pick(r, ['*', '/'] as const))
      const task: SigFigTask = { kind: 'muldiv', terms, ops }
      const ref = refChain(terms, ops)
      const out = compareChain(rep, 'muldiv', task, ref)
      if (out.ev && out.usable) {
        const want = ref.limiting.join(',')
        const got = [...out.ev.limit.termIndices].sort((a, b) => a - b).join(',')
        if (got !== want) rep.add('muldiv/limit.termIndices', taskText(task), `[${got}]`, `[${want}]`)
        if (k % 2 === 0) fuzzGrader(rep, r, task, ref.exactValue, ref.rounding!, { n: ref.limitSigFigs }, [out.ev.expected.text, ...out.ev.expected.alternates])
      }
    }
    rep.finish()
  })

  it('add / subtract chains, including subtraction that cancels leading digits', () => {
    const rep = new Report('addsub')
    const r = makeRng(8086)
    for (let k = 0; k < 9000; k++) {
      const count = int(r, 2, 4)
      const terms: SigFigTerm[] = []
      const ops: SigFigOp[] = []
      if (k % 3 === 0) {
        // cancellation: b is a with its last one or two digits changed
        const a = measured(r)
        const pa = mustParse(a)
        let b = a
        if (!pa.scientific) {
          const idxs = pa.digits.map((d) => d.index)
          const chars = a.split('')
          for (const at of idxs.slice(-int(r, 1, 2))) chars[at] = String(int(r, 0, 9))
          b = chars.join('')
          if (mustParse(b).isZero) b = a
        }
        terms.push({ text: a }, { text: b })
        ops.push('-')
        for (let i = 2; i < count; i++) {
          terms.push(term(r, 0.15))
          ops.push(pick(r, ['+', '-'] as const))
        }
      } else {
        for (let i = 0; i < count; i++) terms.push(term(r, 0.2))
        for (let i = 1; i < count; i++) ops.push(pick(r, ['+', '-'] as const))
      }
      if (terms.every((t) => t.exact)) terms[0] = { text: measured(r) }
      const task: SigFigTask = { kind: 'addsub', terms, ops }
      const ref = refChain(terms, ops)
      const out = compareChain(rep, 'addsub', task, ref)
      if (out.ev && out.usable) {
        const want = ref.limiting.join(',')
        const got = [...out.ev.limit.termIndices].sort((a, b) => a - b).join(',')
        if (got !== want) rep.add('addsub/limit.termIndices', taskText(task), `[${got}]`, `[${want}]`)
        if (k % 2 === 0) fuzzGrader(rep, r, task, ref.exactValue, ref.rounding!, {}, [out.ev.expected.text, ...out.ev.expected.alternates])
      }
    }
    rep.finish()
  })

  it('mixed operations: carry every digit, round once', () => {
    const rep = new Report('mixed')
    const r = makeRng(1234567)
    for (let k = 0; k < 8000; k++) {
      const outerMul = chance(r, 0.6)
      const outerOps: readonly SigFigOp[] = outerMul ? ['*', '/'] : ['+', '-']
      const innerOps: readonly SigFigOp[] = outerMul ? ['+', '-'] : ['*', '/']
      const operandCount = int(r, 2, 3)
      const groupAt = new Set<number>([int(r, 0, operandCount - 1)])
      if (chance(r, 0.3)) groupAt.add(int(r, 0, operandCount - 1))
      const operands: SigFigOperand[] = []
      for (let i = 0; i < operandCount; i++) {
        if (groupAt.has(i)) {
          const n = int(r, 2, 3)
          const terms: SigFigTerm[] = []
          for (let j = 0; j < n; j++) terms.push(term(r, 0.12))
          if (terms.every((t) => t.exact)) terms[0] = { text: measured(r) }
          const ops: SigFigOp[] = []
          for (let j = 1; j < n; j++) ops.push(pick(r, innerOps))
          operands.push({ terms, ops })
        } else operands.push(term(r, 0.15))
      }
      const ops: SigFigOp[] = []
      for (let i = 1; i < operandCount; i++) ops.push(pick(r, outerOps))
      const task: SigFigTask = { kind: 'mixed', operands, ops }
      const ref = refMixed(operands, ops)
      const out = compareChain(rep, 'mixed', task, ref)
      if (!out.ev) continue
      // the precision each intermediate is good to
      if (!ref.debatable && ref.status === 'ok') {
        for (const g of ref.groups) {
          const mine = out.ev.intermediates.find((x) => x.operandIndex === g.operandIndex)
          const input = `${taskText(task)} group ${g.operandIndex}`
          if (!mine) {
            rep.add('mixed/intermediate-missing', input, 'absent', `${g.sigFigs} s.f., place ${g.place}`)
            continue
          }
          if (mine.rule !== g.rule) rep.add('mixed/intermediate.rule', input, mine.rule, g.rule)
          if (mine.sigFigs !== g.sigFigs) rep.add('mixed/intermediate.sigFigs', input, String(mine.sigFigs), String(g.sigFigs))
          if (mine.place !== g.place) rep.add('mixed/intermediate.place', input, String(mine.place), String(g.place))
          checkUnrounded(rep, 'mixed/intermediate', input, mine.unrounded, terminates(g.exactValue), g.exactValue)
          if (k % 3 === 0) {
            const idx = out.ev.intermediates.indexOf(mine)
            const probes: [{ sigFigs?: number; place?: number }, string][] = [
              [{ sigFigs: g.sigFigs }, 'correct'], [{ sigFigs: g.sigFigs + 1 }, 'wrong'], [{ place: g.place }, 'correct'], [{ place: g.place - 1 }, 'wrong'], [{ place: g.place + 1 }, 'wrong'],
            ]
            if (g.sigFigs > 1) probes.push([{ sigFigs: g.sigFigs - 1 }, 'wrong'])
            for (const [resp, want] of probes) {
              rep.tick()
              const gr = tryRun(() => gradeSigFigIntermediate(task, idx, resp))
              if (!gr.ok || gr.value.status !== want) rep.add('mixed/grade-intermediate', `${input} response ${show(resp)}`, gr.ok ? gr.value.status : gr.error, want)
            }
          }
        }
      }
      if (out.usable && k % 2 === 0) {
        const mode = ref.rule === 'muldiv' ? { n: ref.limitSigFigs } : {}
        fuzzGrader(rep, r, task, ref.exactValue, ref.rounding!, mode, [out.ev.expected.text, ...out.ev.expected.alternates])
      }
    }
    rep.finish()
  })

  it('degenerate tasks are refused or flagged, never answered', () => {
    const rep = new Report('degenerate')
    const bad: [string, SigFigTask, string][] = [
      ['measured zero factor', { kind: 'muldiv', terms: [{ text: '0.0' }, { text: '2.5' }], ops: ['*'] }, 'invalid'],
      ['every number exact', { kind: 'muldiv', terms: [{ text: '2', exact: true }, { text: '3', exact: true }], ops: ['*'] }, 'invalid'],
      ['every number exact (sum)', { kind: 'addsub', terms: [{ text: '2', exact: true }, { text: '3', exact: true }], ops: ['+'] }, 'invalid'],
      ['count zero', { kind: 'count', text: '0.00' }, 'invalid'],
      ['round zero to figures', { kind: 'round', text: '0.0', sigFigs: 2 }, 'invalid'],
      ['convert zero', { kind: 'convert', text: '0.0', to: 'scientific' }, 'invalid'],
      ['tie', { kind: 'round', text: '2.5', sigFigs: 1 }, 'tie'],
      ['tie in a product', { kind: 'muldiv', terms: [{ text: '1.5' }, { text: '2.5' }], ops: ['*'] }, 'tie'],
      ['zero result', { kind: 'addsub', terms: [{ text: '5.26' }, { text: '5.26' }], ops: ['-'] }, 'zero_result'],
      ['group rounds to zero', { kind: 'mixed', operands: [{ terms: [{ text: '5.26' }, { text: '5.26' }], ops: ['-'] }, { text: '2.0' }], ops: ['*'] }, 'zero_result'],
      ['division by measured zero', { kind: 'muldiv', terms: [{ text: '2.5' }, { text: '0.0' }], ops: ['/'] }, 'invalid'],
      ['ops/terms mismatch', { kind: 'muldiv', terms: [{ text: '2.5' }, { text: '3.0' }], ops: ['*', '*'] }, 'invalid'],
      ['unreadable term', { kind: 'addsub', terms: [{ text: '2,5' }, { text: '3.0' }], ops: ['+'] }, 'invalid'],
      ['both sigFigs and place', { kind: 'round', text: '2.5', sigFigs: 1, place: 0 }, 'invalid'],
      ['neither sigFigs nor place', { kind: 'round', text: '2.5' }, 'invalid'],
      ['mixed with same family inside', { kind: 'mixed', operands: [{ terms: [{ text: '2.5' }, { text: '3.0' }], ops: ['*'] }, { text: '2.0' }], ops: ['*'] }, 'invalid'],
      ['convert 2.0e3 to standard', { kind: 'convert', text: '2.0e3', to: 'standard' }, 'not_representable'],
    ]
    for (const [label, task, code] of bad) {
      rep.tick()
      const issues = tryRun(() => validateSigFigTask(task))
      if (!issues.ok) rep.add('degenerate/validate-threw', label, issues.error, 'never throws')
      else if (issues.value.length === 0) rep.add('degenerate/validate-silent', label, '[]', code)
      else if (!issues.value.some((i) => i.code === code)) rep.add('degenerate/validate-code', label, show(issues.value.map((i) => i.code)), code)
      const ev = tryRun(() => evaluateSigFigTask(task))
      if (ev.ok && (code === 'invalid' || code === 'not_representable')) rep.add('degenerate/evaluated', label, `answer ${ev.value.expected.text}`, 'SigFigTaskError')
      if (!ev.ok && code === 'tie') rep.add('degenerate/threw', label, ev.error, 'an evaluation (flagged by validate, not an error)')
      const g = tryRun(() => gradeSigFigAnswer(task, '1'))
      if (!g.ok && code === 'tie') rep.add('degenerate/grade-threw', label, g.error, 'a grade')
    }
    rep.finish()
  })

  it('converting to and from scientific notation keeps the figures', () => {
    const rep = new Report('convert')
    const r = makeRng(2718)
    for (let k = 0; k < 4000; k++) {
      const toSci = chance(r, 0.5)
      const text = toSci ? coefficient(r, 12) : normalizedCoefficient(r) + pick(r, ['e', ' x 10^']) + int(r, -8, 8)
      const ref = mustParse(text)
      const task: SigFigTask = { kind: 'convert', text, to: toSci ? 'scientific' : 'standard' }
      const input = taskText(task)
      rep.tick()
      const issues = tryRun(() => validateSigFigTask(task))
      if (!issues.ok) {
        rep.add('convert/validate-threw', input, issues.error, 'never throws')
        continue
      }
      const std = refStandard(ref.value, ref.lastPlace)
      const representable = toSci || std !== null
      const ev = tryRun(() => evaluateSigFigTask(task))
      if (!representable) {
        if (ev.ok && issues.value.length === 0) rep.add('convert/not-representable', input, `answer ${ev.value.expected.text}`, 'standard notation cannot show these figures')
        continue
      }
      if (!ev.ok) {
        rep.add('convert/threw', input, ev.error, toSci ? refScientific(ref.value, ref.lastPlace) : std!)
        continue
      }
      if (issues.value.length > 0) rep.add('convert/validate-false-alarm', input, show(issues.value), 'a usable task')
      const texts = [ev.value.expected.text, ...ev.value.expected.alternates]
      for (const t of texts) {
        const bad = misreads(t, ref.value, ref.lastPlace)
        if (bad) rep.add('convert/answer-text', input, bad, `${ref.sigFigs} s.f.`)
        const p = refParse(t)
        if (p.ok && toSci && !p.normalized) rep.add('convert/answer-form', input, t, 'normalized scientific notation')
        if (p.ok && !toSci && p.scientific) rep.add('convert/answer-form', input, t, 'standard notation')
      }
      if (ev.value.expected.sigFigs !== ref.sigFigs) rep.add('convert/sigFigs', input, String(ev.value.expected.sigFigs), String(ref.sigFigs))
      // grader
      const good = toSci ? refScientific(ref.value, ref.lastPlace, pick(r, POWER_STYLES), chance(r, 0.3)) : std!
      const answers: [string, string, string][] = [[good, 'correct', 'reference spelling']]
      for (const t of texts) answers.push([t, 'correct', 'engine spelling'])
      if (toSci) {
        answers.push([refScientific(ref.value, ref.lastPlace - 1), 'wrong', 'one figure too many'])
        const m = fDiv(fAbs(ref.value), fracTimesPow10(1n, ref.lastPlace))
        if (m.n % 10n === 0n) answers.push([refScientific(ref.value, ref.lastPlace + 1), 'wrong', 'dropped zero'])
        const shifted = fracTimesPow10(ref.value.n, 1)
        answers.push([refScientific(frac(shifted.n, ref.value.d * shifted.d), ref.lastPlace + 1), 'wrong', 'power of ten off by one'])
      } else {
        const padded = refStandard(ref.value, ref.lastPlace - 1)
        if (padded !== null) answers.push([padded, 'wrong', 'padded zero'])
        answers.push([refScientific(ref.value, ref.lastPlace), 'wrong', 'still scientific'])
      }
      for (const [a, want, label] of answers) {
        rep.tick()
        const g = tryRun(() => gradeSigFigAnswer(task, a))
        if (!g.ok || g.value.status !== want) rep.add('convert/grade', `${input} answer "${a}" (${label})`, g.ok ? `${g.value.status}: ${g.value.message}` : g.error, want)
        else if (g.value.status === 'wrong') tally(`convert ${label}`, g.value.pattern?.id)
      }
    }
    note('named mistakes given to planted wrong answers:\n  ' + patternTallyLines().join('\n  '))
    rep.finish()
  })
})

function compareRounding(rep: Report, op: string, input: string, got: SigFigRounding, exact: Frac, R: RefRounding): void {
  if (got.tie !== R.tie) rep.add(op + '/tie', input, String(got.tie), String(R.tie))
  if (got.exact !== plainDecimal(exact)) rep.add(op + '/exact', input, got.exact, plainDecimal(exact))
  if (R.tie) return // generated ties are skipped (half-up vs half-even must never matter); detection is tested separately
  const want = plainDecimal(R.value)
  if (got.value !== want) rep.add(op + '/value', input, got.value, want)
  if (got.place !== R.place) rep.add(op + '/place', input, String(got.place), String(R.place))
  if (got.sigFigs !== R.sigFigs) rep.add(op + '/sigFigs', input, String(got.sigFigs), String(R.sigFigs))
  if (got.direction !== R.direction) rep.add(op + '/direction', input, got.direction, R.direction)
  if (got.firstDropped !== R.firstDropped) rep.add(op + '/firstDropped', input, String(got.firstDropped), String(R.firstDropped))
  if (fIsZero(R.value)) return
  for (const t of [got.text, ...got.alternates]) {
    const bad = misreads(t, R.value, R.place)
    if (bad) rep.add(op + '/text', input, bad, `${want} good to 10^${R.place}`)
  }
  // rule 11: when plain digits can show the figures, a plain spelling must be on offer
  const std = refStandard(R.value, R.place)
  const offered = [got.text, ...got.alternates].map((t) => refParse(t))
  if (std !== null && std.replace(/[^0-9]/g, '').length <= 12 && !offered.some((p) => p.ok && !p.scientific)) rep.add(op + '/no-standard-spelling', input, show([got.text, ...got.alternates]), std)
  if (!fIsZero(R.truncated)) {
    const bad = misreads(got.truncatedText, R.truncated, R.truncatedPlace)
    if (bad) rep.add(op + '/truncatedText', input, bad, `${plainDecimal(R.truncated)} good to 10^${R.truncatedPlace}`)
  }
}
