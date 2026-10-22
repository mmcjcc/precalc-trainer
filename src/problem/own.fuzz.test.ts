/**
 * "Check my own problem": she may type anything. For every module that takes her own problem, 2000 strings typed on
 * that module's keypad (its own keys and the grid's digits and signs, a few to forty presses, seeded) each give an
 * instance or a reason within 50 ms, never an exception. A share of them are real problems, so the whole way through
 * (the exact solve and the engine's check of every hinted line) is inside the budget too. A module that rounds her
 * answer (exponential and log equations) takes the same strings again, rounded to three places.
 *
 * Timing on a shared machine: the whole suite runs three test files at a time, and a busy moment can double a time.
 * A string over 50 ms is timed again, up to four more times, and its best time counts; a first time over 250 ms
 * fails outright, so a real blowup (a log inside a log took 1.4 s) can never hide behind a retry or a cache.
 */
import { describe, expect, it } from 'vitest'
import { GRID_KEYS } from '@/components/keypadKeys'
import type { StripKey } from '@/components/symbolStrip'
import { makeRng } from '@/content/rng'
import { buildOwnProblem, ownConstructor, OWN_MODULES, type OwnOptions, type OwnResult } from '@/content/own'
import { ownKeysFor } from './ownDraft'

const COUNT = 2000
const BUDGET_MS = 50
/** A first time past this fails without a retry. */
const CEILING_MS = 250
const RETRIES = 4
/** The ids the tutor's server accepts (`ID` in server/src/validate.ts). */
const TUTOR_ID = /^[A-Za-z0-9_.:@/#?=&+-]{1,200}$/

type Rng = ReturnType<typeof makeRng>

/**
 * A string built the way a problem is, from the keypad's own keys: numbers and letters, the keypad's functions around
 * an inner sum, + − × ÷ and powers, a relation sign; then, often, one key pressed by mistake somewhere in it. These go
 * deep: most of them are real problems or nearly, so the exact solve and the engine's checks run on them.
 */
function problemLike(rng: Rng, keys: readonly StripKey[], input: string, moduleId: string): string {
  const letters = keys.filter((k) => /^[a-z]$/i.test(k.insert)).map((k) => k.insert)
  const fns = keys.filter((k) => k.caret === -1 && /\($/.test(k.insert.slice(0, -1))).map((k) => k.insert.slice(0, -1))
  const relations = keys.map((k) => k.insert.trim()).filter((t) => ['<', '<=', '>', '>=', '='].includes(t))
  const letter = () => (letters.length ? rng.pick(letters) : 'x')
  const number = () => String(rng.pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 100]))
  const small = () => String(rng.int(1, 9))
  const signed = () => `${rng.pick(['+', '-'])} ${small()}`
  // The shapes the module's problems have, half the time (the rest of the grammar reaches everything else).
  const shaped = (): string | null => {
    if (rng.chance(0.5)) return null
    switch (moduleId) {
      case 'inequalities':
        return rng.pick([
          () => `${small()}x ${signed()} ${rng.pick(['<', '<=', '>', '>='])} ${rng.int(-20, 20)}`,
          () => `-${small()}(x ${signed()}) ${rng.pick(['<', '>='])} ${small()}x ${signed()}`,
          () => `${rng.int(-9, 0)} < ${small()}x ${signed()} <= ${rng.int(1, 20)}`,
          () => `(${small()}/${small()})x ${signed()} > ${small()}`,
          () => `${small()}x ${signed()} < ${small()} or x ${signed()} > ${small()}`,
        ])()
      case 'inverses':
        return rng.pick([
          () => `f(x) = ${rng.int(-9, 9)}x ${signed()}`,
          () => `f(x) = cbrt(${small()}x ${signed()}) ${signed()}`,
          () => `y = ${rng.int(-9, 9)}/(x ${signed()}) ${signed()}`,
          () => `y = (${small()}x ${signed()})/(${small()}x ${signed()})`,
          () => `y = ${rng.pick(['', '-', '2', '1/2'])}(x ${signed()})^2 ${signed()}`,
        ])()
      case 'expLogEquations':
        return rng.pick([
          () => `${small()}^(x ${signed()}) = ${number()}`,
          () => `${small()} * ${rng.int(2, 7)}^x ${signed()} = ${number()}`,
          () => `log(x) + log(x ${signed()}) = ${rng.int(1, 3)}`,
          () => `log_${rng.int(2, 5)}(x ${signed()}) = ${rng.int(1, 4)}`,
          () => `ln(${small()}x ${signed()}) = ${small()}`,
          () => `e^(2x) - ${rng.int(3, 12)}e^x + ${rng.int(2, 30)} = 0`,
          () => `${rng.int(2, 5)}^(x ${signed()}) = ${rng.int(2, 7)}^x`,
        ])()
      case 'logProperties':
        return rng.pick([
          () => `log(x^${rng.int(2, 5)} y^${rng.int(1, 4)})`,
          () => `ln(${small()}x^${rng.int(2, 4)}/y)`,
          () => `log_${rng.int(2, 5)}(${small()}x)`,
          () => `${rng.int(2, 5)}log(x) + log(y) - log(n)`,
          () => `ln(x) - ${rng.int(2, 4)}ln(y)`,
        ])()
      case 'quadratics':
        return `${rng.pick(['', '-', '2', '3', '1/2', '-2'])}x^2 ${signed()}x ${signed()}`
      case 'diffQuotient':
        return rng.pick([() => `${small()}x ${signed()}`, () => `${small()}x^2 ${signed()}x ${signed()}`, () => `${small()}/(x ${signed()})`])()
      default:
        return null
    }
  }
  const term = (depth: number): string => {
    const roll = rng.next()
    if (roll < 0.3) return number()
    if (roll < 0.6) return `${rng.chance(0.5) ? number() : ''}${letter()}`
    if (roll < 0.72) return `${letter()}^${rng.int(2, 3)}`
    if (roll < 0.86 && fns.length && depth < 2) return `${rng.pick(fns)}${sum(depth + 1)})`
    if (depth < 2) return `${rng.chance(0.5) ? number() : '-'}(${sum(depth + 1)})`
    return number()
  }
  const sum = (depth: number): string => {
    let s = term(depth)
    for (let i = rng.int(0, 2); i > 0; i--) s += ` ${rng.pick(['+', '-', '+', '-', '*', '/'])} ${term(depth)}`
    return s
  }
  let text =
    shaped() ??
    (input === 'expression' ? sum(0) : input === 'either' && rng.chance(0.5) ? sum(0) : `${sum(0)} ${rng.pick(relations.length ? relations : ['='])} ${sum(0)}`)
  if (rng.chance(0.4)) {
    const all = [...keys, ...GRID_KEYS].map((k) => k.insert)
    const at = rng.int(0, text.length)
    text = rng.chance(0.5) ? `${text.slice(0, at)}${rng.pick(all)}${text.slice(at)}` : `${text.slice(0, at)}${text.slice(at + 1)}`
  }
  return text
}

/**
 * `count` strings typed on a keypad with `keys` in its context row, plus the grid: half of them presses at random
 * (letters and digits as often as in a real problem), half from the general grammar above (no module's shapes).
 */
function keypadStrings(keys: readonly StripKey[], input: string, count: number, seed: number): string[] {
  const rng = makeRng(seed)
  const all = [...keys, ...GRID_KEYS].map((k) => k.insert)
  const letters = keys.filter((k) => /^[a-z]$/i.test(k.insert)).map((k) => k.insert)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    if (i % 2 === 1) {
      out.push(problemLike(rng, keys, input, ''))
      continue
    }
    const presses = rng.int(1, 40)
    let s = ''
    for (let j = 0; j < presses; j++) {
      const roll = rng.next()
      if (roll < 0.22 && letters.length) s += rng.pick(letters)
      else if (roll < 0.5) s += String(rng.int(0, 9))
      else s += rng.pick(all)
    }
    out.push(s)
  }
  return out
}

interface Run {
  failures: string[]
  instances: number
  slowest: { text: string; ms: number }
}

function timed(moduleId: string, kindId: string, text: string, options: OwnOptions): number {
  const t0 = performance.now()
  buildOwnProblem(moduleId, kindId, text, options)
  return performance.now() - t0
}

function run(moduleId: string, kindId: string, strings: readonly string[], budgetMs: number, ceilingMs = Number.POSITIVE_INFINITY, options: OwnOptions = {}): Run {
  // Warm the engine once, so the first string does not pay for loading it.
  buildOwnProblem(moduleId, kindId, ownConstructor(moduleId)!.kinds.find((k) => k.id === kindId)!.example, options)
  const out: Run = { failures: [], instances: 0, slowest: { text: '', ms: 0 } }
  for (const text of strings) {
    const t0 = performance.now()
    let r: OwnResult
    try {
      r = buildOwnProblem(moduleId, kindId, text, options)
    } catch (e) {
      out.failures.push(`${JSON.stringify(text)} threw ${String(e)}`)
      continue
    }
    const first = performance.now() - t0
    let ms = first
    // Over the budget but not past the ceiling: a busy moment, or the string itself? Its best time says.
    for (let i = 0; i < RETRIES && ms > budgetMs && first <= ceilingMs; i++) ms = Math.min(ms, timed(moduleId, kindId, text, options))
    if (ms > out.slowest.ms) out.slowest = { text, ms }
    if (first > ceilingMs) out.failures.push(`${JSON.stringify(text)} took ${first.toFixed(1)} ms`)
    else if (ms > budgetMs) out.failures.push(`${JSON.stringify(text)} took ${ms.toFixed(1)} ms at best (${first.toFixed(1)} ms first)`)
    if (r.ok) {
      out.instances++
      // The tutor's server takes her problem's id and her attempt's id (the id, '#', the start time).
      if (!TUTOR_ID.test(`${r.instance.id}#${Date.now().toString(36)}`)) out.failures.push(`${JSON.stringify(text)}: id ${r.instance.id}`)
    } else if (!r.reason.parts.length) out.failures.push(`${JSON.stringify(text)}: an empty reason`)
  }
  return out
}

describe('she may type anything: an instance or a reason within 50 ms, never an exception', () => {
  for (const moduleId of OWN_MODULES) {
    for (const kind of ownConstructor(moduleId)!.kinds) {
      it(`${moduleId} / ${kind.id}: ${COUNT} keypad strings`, { timeout: 600_000 }, () => {
        const strings = keypadStrings(ownKeysFor(moduleId), kind.input, COUNT, 0x5eed + moduleId.length * 31 + kind.id.length)
        const r = run(moduleId, kind.id, strings, BUDGET_MS, CEILING_MS)
        expect(r.failures, `slowest ${r.slowest.ms.toFixed(1)} ms: ${r.slowest.text}`).toEqual([])
      })
      // Her answer rounded (exponential and log equations): the same strings, the same budget.
      if (ownConstructor(moduleId)!.rounding) {
        it(`${moduleId} / ${kind.id}, rounded to 3 places: ${COUNT} keypad strings`, { timeout: 600_000 }, () => {
          const strings = keypadStrings(ownKeysFor(moduleId), kind.input, COUNT, 0x5eed + moduleId.length * 31 + kind.id.length)
          const r = run(moduleId, kind.id, strings, BUDGET_MS, CEILING_MS, { places: 3 })
          expect(r.failures, `slowest ${r.slowest.ms.toFixed(1)} ms: ${r.slowest.text}`).toEqual([])
        })
      }
    }
  }
})

/** Problems shaped like the module's own (and one key pressed by mistake in some): they go all the way through. */
const DEEP = 400
const NO_HANG_MS = 2000

describe('her real problems, shaped like the module’s, all the way through: never an exception, never a hang', () => {
  for (const moduleId of OWN_MODULES) {
    for (const kind of ownConstructor(moduleId)!.kinds) {
      it(`${moduleId} / ${kind.id}: ${DEEP} problem-shaped strings`, { timeout: 600_000 }, () => {
        const rng = makeRng(0xdee9 + moduleId.length * 17 + kind.id.length)
        const keys = ownKeysFor(moduleId)
        const strings = Array.from({ length: DEEP }, () => problemLike(rng, keys, kind.input, moduleId))
        const r = run(moduleId, kind.id, strings, NO_HANG_MS)
        expect(r.failures).toEqual([])
        // A good share of them are real problems of hers and went all the way through.
        expect(r.instances, `slowest ${r.slowest.ms.toFixed(1)} ms: ${r.slowest.text}`).toBeGreaterThan(DEEP / 20)
        if (ownConstructor(moduleId)!.rounding) {
          const rounded = run(moduleId, kind.id, strings, NO_HANG_MS, Number.POSITIVE_INFINITY, { places: 3 })
          expect(rounded.failures).toEqual([])
          expect(rounded.instances).toBeGreaterThan(DEEP / 20)
        }
      })
    }
  }
})
