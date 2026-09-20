/**
 * Property-style checks over a few thousand seeded cases. Integer-only PRNG so runs are identical
 * everywhere; every value is built as a digit string.
 */
import { describe, expect, it } from 'vitest'
import type { SigFigOp, SigFigTask, SigFigTerm } from '@/shared/types'
import { pow10, rat, ratAbs, ratAdd, ratCmp, ratDiv, ratFromDec, ratMul, ratSub, type Rat } from './decimal'
import { evaluateSigFigTask, sigFigTaskTerms, validateSigFigTask } from './evaluate'
import { gradeSigFigAnswer, gradeSigFigTaps, sigFigMistakeCandidates } from './grade'
import { parseSigFigNumeral, sigFigDec } from './parse'
import { roundToPlace, roundToSigFigs } from './round'

/** The full suite runs files in parallel; the default 5 s is too tight for the big loops. */
const SLOW = 120_000

function makeRng(seed: number): (n: number) => number {
  let a = seed >>> 0
  return (n: number): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) % n
  }
}

function digits(rng: (n: number) => number, length: number, firstNonzero: boolean): string {
  let s = ''
  for (let i = 0; i < length; i++) s += String(i === 0 && firstNonzero ? 1 + rng(9) : rng(10))
  return s
}

/** A nonzero numeral in one of the shapes a chemistry problem uses. */
function randomNumeral(rng: (n: number) => number, allowScientific = true): string {
  const sign = rng(8) === 0 ? '-' : ''
  const shape = rng(allowScientific ? 6 : 5)
  let body: string
  if (shape === 0) body = digits(rng, 1 + rng(4), true) + '.' + digits(rng, 1 + rng(4), false) // 12.50
  else if (shape === 1) body = '0.' + '0'.repeat(rng(4)) + digits(rng, 1 + rng(4), true) // 0.00450
  else if (shape === 2) body = digits(rng, 1 + rng(3), true) + '0'.repeat(rng(4)) // 1200
  else if (shape === 3) body = digits(rng, 1 + rng(3), true) + '0'.repeat(1 + rng(3)) + '.' // 1200.
  else if (shape === 4) body = digits(rng, 1, true) + digits(rng, rng(3), false) + '0' + digits(rng, 1 + rng(2), true) // 5002
  else body = digits(rng, 1, true) + (rng(4) === 0 ? '' : '.' + digits(rng, 1 + rng(4), false)) + ['e', ' x 10^', '×10^'][rng(3)] + String(rng(22) - 9)
  return sign + body
}

/** Independent oracle: the textbook recipe, done with string surgery only. */
function oracleCount(text: string): number {
  let s = text.replace(/^[+\-−–]/, '').split(/e|E|\s*[x×*]\s*10/)[0].trim()
  if (s.includes('.')) return s.replace('.', '').replace(/^0+/, '').length
  s = s.replace(/^0+/, '').replace(/0+$/, '')
  return s.length
}

function valueOf(text: string): Rat {
  const p = parseSigFigNumeral(text)
  if (!p.ok) throw new Error(`cannot parse ${text}`)
  return ratFromDec(sigFigDec(p.numeral))
}

function apply(a: Rat, op: SigFigOp, b: Rat): Rat {
  return op === '+' ? ratAdd(a, b) : op === '-' ? ratSub(a, b) : op === '*' ? ratMul(a, b) : ratDiv(a, b)
}

/** Exact value of a task, recomputed here from the task alone. */
function exactValue(task: SigFigTask): Rat {
  const chain = (terms: SigFigTerm[], ops: SigFigOp[]): Rat => terms.slice(1).reduce((acc, term, i) => apply(acc, ops[i], valueOf(term.text)), valueOf(terms[0].text))
  switch (task.kind) {
    case 'count':
    case 'round':
    case 'convert':
      return valueOf(task.text)
    case 'muldiv':
    case 'addsub':
      return chain(task.terms, task.ops)
    case 'mixed': {
      const values = task.operands.map((o) => ('terms' in o ? chain(o.terms, o.ops) : valueOf(o.text)))
      return values.slice(1).reduce((acc, v, i) => apply(acc, task.ops[i], v), values[0])
    }
  }
}

function randomTask(rng: (n: number) => number): SigFigTask {
  const term = (): SigFigTerm => ({ text: randomNumeral(rng) })
  const plainTerm = (): SigFigTerm => ({ text: randomNumeral(rng, false) })
  const maybeExact = (): SigFigTerm => (rng(7) === 0 ? { text: String(2 + rng(11)), exact: true, note: 'counted' } : term())
  const kind = rng(7)
  if (kind === 0) return { kind: 'count', text: randomNumeral(rng) }
  if (kind === 1) return { kind: 'round', text: randomNumeral(rng), sigFigs: 1 + rng(5) }
  if (kind === 2) return { kind: 'round', text: randomNumeral(rng, false), place: rng(7) - 4 }
  if (kind === 3) {
    const n = 2 + rng(2)
    return { kind: 'muldiv', terms: [term(), ...Array.from({ length: n - 1 }, maybeExact)], ops: Array.from({ length: n - 1 }, () => (rng(2) === 0 ? '*' : '/') as SigFigOp) }
  }
  if (kind === 4) {
    const n = 2 + rng(2)
    return { kind: 'addsub', terms: Array.from({ length: n }, plainTerm), ops: Array.from({ length: n - 1 }, () => (rng(2) === 0 ? '+' : '-') as SigFigOp) }
  }
  if (kind === 5) {
    const inner: SigFigOp[] = rng(2) === 0 ? [rng(2) === 0 ? '+' : '-'] : [rng(2) === 0 ? '*' : '/']
    const outer: SigFigOp = inner[0] === '+' || inner[0] === '-' ? (rng(2) === 0 ? '*' : '/') : rng(2) === 0 ? '+' : '-'
    const group = { terms: [plainTerm(), plainTerm()], ops: inner }
    return { kind: 'mixed', operands: rng(2) === 0 ? [group, plainTerm()] : [plainTerm(), group], ops: [outer] }
  }
  return { kind: 'convert', text: randomNumeral(rng), to: rng(2) === 0 ? 'scientific' : 'standard' }
}

describe('counting agrees with an independent oracle', () => {
  it('3000 seeded numerals', () => {
    const rng = makeRng(20260920)
    for (let i = 0; i < 3000; i++) {
      const text = randomNumeral(rng)
      const parsed = parseSigFigNumeral(text)
      expect(parsed.ok, text).toBe(true)
      if (!parsed.ok) continue
      const n = parsed.numeral
      expect(n.sigFigs, text).toBe(oracleCount(text))
      expect(n.chars.length, text).toBe(n.text.length)
      expect(n.chars.filter((c) => c.significant).length, text).toBe(n.sigFigs)
      expect(n.firstSigPlace - n.lastSigPlace + 1, text).toBe(n.sigFigs)
      expect(n.chars.map((c) => c.ch).join(''), text).toBe(n.text)
      // Tapping exactly the significant digits is always graded correct; tapping every digit is
      // correct only when every digit is significant.
      const sig = n.chars.filter((c) => c.significant).map((c) => c.index)
      expect(gradeSigFigTaps(text, sig).correct, text).toBe(true)
      const all = n.chars.filter((c) => c.digit).map((c) => c.index)
      expect(gradeSigFigTaps(text, all).correct, text).toBe(all.length === sig.length)
    }
  }, SLOW)
})

describe('rounding invariants', () => {
  it('2000 seeded roundings: exactly N figures, within half a unit, ties reported exactly', () => {
    const rng = makeRng(8675309)
    for (let i = 0; i < 2000; i++) {
      const text = randomNumeral(rng)
      const n = 1 + rng(6)
      const r = roundToSigFigs(text, n)
      const shown = parseSigFigNumeral(r.text)
      expect(shown.ok, `${text} → ${r.text}`).toBe(true)
      if (!shown.ok) continue
      expect(shown.numeral.sigFigs, `${text} to ${n} → ${r.text}`).toBe(n)
      expect(r.sigFigs).toBe(n)
      expect(shown.numeral.lastSigPlace).toBe(r.place)
      for (const alt of r.alternates) {
        const a = parseSigFigNumeral(alt)
        expect(a.ok && a.numeral.sigFigs === n && a.numeral.value === shown.numeral.value, `${text} alt ${alt}`).toBe(true)
      }
      // |rounded − exact| ≤ ½ · 10^place, with equality exactly when a tie is reported.
      const twiceError = ratMul(ratAbs(ratSub(valueOf(r.text), valueOf(text))), rat(2n))
      const unit = r.place >= 0 ? rat(pow10(r.place)) : rat(1n, pow10(-r.place))
      const cmp = ratCmp(twiceError, unit)
      expect(cmp <= 0, `${text} to ${n} → ${r.text}`).toBe(true)
      expect(cmp === 0, `${text} to ${n} tie`).toBe(r.tie)
      // Half-up on the magnitude: a tie always moves away from zero.
      if (r.tie) expect(r.direction).toBe('up')
      // Rounding again changes nothing.
      expect(roundToSigFigs(r.text, n).value).toBe(r.value)
    }
  }, SLOW)

  it('constructed ties are always caught, and one more digit always breaks them', () => {
    const rng = makeRng(424242)
    for (let i = 0; i < 500; i++) {
      const keep = 1 + rng(4)
      const head = digits(rng, keep, true)
      const shift = rng(6)
      const tieText = shift === 0 ? `${head}5` : `${head.slice(0, 1)}.${head.slice(1)}5e${rng(12) - 6}`
      expect(roundToSigFigs(tieText, keep).tie, tieText).toBe(true)
      const broken = tieText.replace(/5(?=e|$)/, `5${'0'.repeat(rng(3))}${1 + rng(9)}`)
      expect(roundToSigFigs(broken, keep).tie, broken).toBe(false)
      expect(roundToSigFigs(broken, keep).direction, broken).toBe('up')
      const under = tieText.replace(/5(?=e|$)/, `4${'9'.repeat(1 + rng(4))}`)
      expect(roundToSigFigs(under, keep).tie, under).toBe(false)
      expect(roundToSigFigs(under, keep).direction, under).toBe('down')
    }
  }, SLOW)

  it('roundToPlace lands on the requested place', () => {
    const rng = makeRng(1234)
    for (let i = 0; i < 500; i++) {
      const text = randomNumeral(rng, false)
      const place = rng(8) - 4
      const r = roundToPlace(text, place)
      const shown = parseSigFigNumeral(r.text)
      expect(shown.ok, r.text).toBe(true)
      if (!shown.ok) continue
      if (r.sigFigs > 0) expect(shown.numeral.lastSigPlace, `${text} @${place} → ${r.text}`).toBe(place)
      else expect(shown.numeral.isZero).toBe(true)
    }
  }, SLOW)
})

describe('task invariants', () => {
  it('4000 seeded tasks', () => {
    const rng = makeRng(31337)
    let evaluated = 0
    let ties = 0
    const kinds = new Map<string, number>()
    const patternsSeen = new Set<string>()
    for (let i = 0; i < 4000; i++) {
      const task = randomTask(rng)
      const issues = validateSigFigTask(task) // must never throw
      if (issues.some((x) => x.code === 'invalid' || x.code === 'not_representable')) {
        expect(() => evaluateSigFigTask(task)).toThrow()
        continue
      }
      const label = JSON.stringify(task)
      const e = evaluateSigFigTask(task)
      evaluated++
      kinds.set(task.kind, (kinds.get(task.kind) ?? 0) + 1)
      if (e.tie) ties++
      expect(issues.some((x) => x.code === 'tie'), label).toBe(e.tie)
      expect(e.steps.length, label).toBeGreaterThan(0)
      expect(e.steps.every((s) => s.length > 10 && !/undefined|NaN|\[object/.test(s)), label).toBe(true)

      // The canonical answer (and every alternate) always grades as correct.
      for (const answer of [e.expected.text, ...e.expected.alternates]) {
        const g = gradeSigFigAnswer(task, answer)
        expect(g.status, `${label} answer ${answer}: ${g.message}`).toBe('correct')
      }
      // Every listed mistake is a wrong answer, earns exactly its id, and is never the right answer.
      for (const c of sigFigMistakeCandidates(task)) {
        const g = gradeSigFigAnswer(task, c.text)
        expect(g.status, `${label} mistake ${c.text}`).toBe('wrong')
        expect(g.pattern?.id, `${label} mistake ${c.text}`).toBe(c.id)
        expect(c.text).not.toBe(e.expected.text)
        patternsSeen.add(c.id)
      }

      if (task.kind === 'count') {
        expect(Number(e.expected.text)).toBe(oracleCount(task.text))
        continue
      }

      // The canonical answer shows exactly the required figures / place.
      const shown = parseSigFigNumeral(e.expected.text)
      expect(shown.ok, label).toBe(true)
      if (!shown.ok) continue
      const zero = e.expected.sigFigs === 0
      if (!zero) {
        expect(shown.numeral.sigFigs, label).toBe(e.expected.sigFigs)
        expect(shown.numeral.lastSigPlace, label).toBe(e.expected.place)
        expect(e.limit.sigFigs).toBe(e.expected.sigFigs)
        expect(e.limit.place).toBe(e.expected.place)
      }
      const terms = sigFigTaskTerms(task)
      const measured = terms.filter((x) => !x.exact)
      if (task.kind === 'round' && task.sigFigs !== undefined) expect(shown.numeral.sigFigs, label).toBe(task.sigFigs)
      if (task.kind === 'muldiv') expect(shown.numeral.sigFigs, label).toBe(Math.min(...measured.map((x) => oracleCount(x.text))))
      if (task.kind === 'addsub' && !zero) {
        const places = measured.map((x) => {
          const p = parseSigFigNumeral(x.text)
          return p.ok ? p.numeral.lastSigPlace : 99
        })
        expect(shown.numeral.lastSigPlace, label).toBe(Math.max(...places))
      }
      if (task.kind === 'convert') {
        expect(shown.numeral.sigFigs, label).toBe(oracleCount(task.text))
        expect(shown.numeral.scientific, label).toBe(task.to === 'scientific')
        if (task.to === 'scientific') expect(shown.numeral.normalized, label).toBe(true)
      }

      // Rounding never moves the value by more than half a unit in the last kept place.
      const exact = exactValue(task)
      const twiceError = ratMul(ratAbs(ratSub(valueOf(e.expected.text), exact)), rat(2n))
      const unit = e.expected.place >= 0 ? rat(pow10(e.expected.place)) : rat(1n, pow10(-e.expected.place))
      const cmp = ratCmp(twiceError, unit)
      expect(cmp <= 0, label).toBe(true)
      expect(cmp === 0, label).toBe(e.tie)

      // The sign matters: the same digits with the sign flipped are never accepted.
      if (!zero) {
        const flipped = e.expected.text.startsWith('-') ? e.expected.text.slice(1) : '-' + e.expected.text
        expect(gradeSigFigAnswer(task, flipped).status, label).toBe('wrong')
      }
    }
    expect(evaluated).toBeGreaterThan(3000)
    expect(ties).toBeLessThan(evaluated / 5)
    for (const kind of ['count', 'round', 'muldiv', 'addsub', 'mixed', 'convert']) expect(kinds.get(kind) ?? 0, kind).toBeGreaterThan(200)
    // The random tasks exercise most of the named mistakes.
    for (const id of ['sf_leading_zeros', 'sf_placeholder_zeros', 'sf_unrounded', 'sf_truncated', 'sf_extra_zeros', 'sf_dropped_zero', 'sf_ambiguous_zeros', 'sf_lost_placeholders', 'sf_addsub_rule_on_muldiv', 'sf_muldiv_rule_on_addsub', 'sf_exact_limited', 'sf_rounded_early', 'sf_sci_changed_figures', 'sf_sci_exponent', 'sf_sci_form'])
      expect(patternsSeen.has(id), id).toBe(true)
  }, SLOW)

  it('numbers from 1e-9 to 1e12 survive every operation exactly', () => {
    const tiny = '1.25e-9'
    const huge = '9.87e11'
    const product = evaluateSigFigTask({ kind: 'muldiv', terms: [{ text: tiny }, { text: huge }], ops: ['*'] })
    expect(product.unrounded).toBe('1233.75')
    expect(product.expected.text).toBe('1230')
    const quotient = evaluateSigFigTask({ kind: 'muldiv', terms: [{ text: tiny }, { text: huge }], ops: ['/'] })
    expect(quotient.expected.text).toBe('1.27 x 10^-21')
    expect(gradeSigFigAnswer({ kind: 'muldiv', terms: [{ text: tiny }, { text: huge }], ops: ['/'] }, '1.27e-21').status).toBe('correct')
    const sum = evaluateSigFigTask({ kind: 'addsub', terms: [{ text: '1000000000000' }, { text: '0.000000001' }], ops: ['+'] })
    expect(sum.unrounded).toBe('1000000000000.000000001')
    expect(sum.expected.text).toBe('1 x 10^12')
    expect(sum.expected.alternates).toEqual(['1000000000000'])
    const fine = evaluateSigFigTask({ kind: 'addsub', terms: [{ text: '1000000000000.' }, { text: '0.000000001' }], ops: ['+'] })
    expect(fine.expected.text).toBe('1.000000000000 x 10^12')
    expect(fine.expected.alternates).toEqual(['1000000000000.'])
    expect(roundToSigFigs('0.000000001', 1).text).toBe('1 x 10^-9')
    expect(roundToSigFigs('999999999999', 3).text).toBe('1.00 x 10^12')
  }, SLOW)
})
