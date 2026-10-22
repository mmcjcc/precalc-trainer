/**
 * it.evaluate: the exact value of arcsin, arccos or arctan (also written sin⁻¹, cos⁻¹, tan⁻¹) at a special value, in
 * radians (degrees only when the prompt asks): arcsin(−√3/2) = −π/3, arccos(−1/2) = 2π/3, arctan(−1) = −π/4. An input
 * outside the domain (arcsin 2) has no value: the part's "No value" button, which every problem here offers. Sometimes
 * a value on the calculator in radians to three places (arccos(−0.35) ≈ 1.928). No answer is an end of a range (0, ±π/2,
 * π), which the rule cards name.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart } from '@/content/types'
import {
  INV_BASE,
  INV_WORD,
  RANGE_WORDS,
  angleIn,
  evaluateSlips,
  exactNum,
  exactSay,
  exactTex,
  exactText,
  inverseDecimalSlips,
  inverseRad,
  outsideDomainTrap,
  outsideDomainWitness,
  principalValue,
  readExact,
  type InvFn,
  type InvUnit,
} from '@/engine/trig'
import { roundPlaces } from '../explog/text'
import { decimalTraps } from '../rightTriangle/common'
import type { Drafted5 } from '../trig/build5'
import { inverseCalc } from '../trig/calc5'
import { exactForms } from '../trig/forms'
import { plainGraph } from '../trig/graph5'
import { m } from '../trig/text'
import { IT_RULE_IDS } from './rules'
import { IT_DECIMAL_HINT, IT_DEG_HINT, IT_RAD_HINT } from './words'

export type ItDrafted = Drafted5<'evaluate' | 'compose'>

const TEX_NAME: Record<InvFn, [string, string]> = { asin: ['\\arcsin', '\\sin^{-1}'], acos: ['\\arccos', '\\cos^{-1}'], atan: ['\\arctan', '\\tan^{-1}'] }

/** "\arcsin\left(-\frac{\sqrt{3}}{2}\right)" or "\sin^{-1}\left(…\right)". */
export function invTex(fn: InvFn, inputTex: string, notation: 0 | 1): string {
  return `${TEX_NAME[fn][notation]}\\left(${inputTex}\\right)`
}

const BASE_WORD: Record<InvFn, string> = { asin: 'sine', acos: 'cosine', atan: 'tangent' }

/** The graph of the inverse function behind the gate, with the asked point marked. */
export function inverseGraph(fn: InvFn, mark: { x: number; y: number; label: string } | null, reach: number): ReturnType<typeof plainGraph> {
  const f = (x: number) => (fn === 'atan' ? Math.atan(x) : Math.abs(x) > 1 ? Number.NaN : fn === 'asin' ? Math.asin(x) : Math.acos(x))
  const half = fn === 'atan' ? Math.max(4, Math.ceil(reach) + 1) : reach > 1.4 ? Math.ceil(reach) + 0.5 : 1.5
  const yWindow: [number, number] = fn === 'acos' ? [-0.5, Math.PI + 0.5] : [-Math.PI / 2 - 0.5, Math.PI / 2 + 0.5]
  return plainGraph(f, { window: [-half, half], yWindow, ticks: { xStep: fn === 'atan' ? 1 : 0.5, yPiOver: 6 }, ...(mark ? { markers: [mark] } : {}), n: 400 })
}

export interface EvaluateInput {
  fn: InvFn
  /** The input as she reads it ("-√3/2", "2", "-0.35"). */
  input: string
  mode: 'exact' | 'decimal'
  unit: InvUnit
  notation: 0 | 1
}

/** The it.evaluate problem (exported for the hand-worked tests). */
export function evaluateProblem(o: EvaluateInput): ItDrafted {
  const v = readExact(o.input)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${o.input}`)
  const x = exactNum(v)
  const word = INV_WORD[o.fn]
  const base = INV_BASE[o.fn]
  const inputTex = o.mode === 'decimal' ? o.input : exactTex(v)
  const display = m(invTex(o.fn, inputTex, o.notation))
  const inputSay = o.mode === 'decimal' ? o.input.replace('-', '−') : exactSay(v)
  let part: TrigPart
  let mark: { x: number; y: number; label: string } | null = null
  let value: number | null
  if (o.mode === 'decimal') {
    value = inverseRad(o.fn, x)
    const text = roundPlaces(value, 3)
    part = {
      id: 'value',
      kind: 'decimal',
      label: 'Value',
      ask: 'What is the value, in radians, to three decimal places?',
      formatHint: IT_DECIMAL_HINT,
      nudge: `In RADIAN mode, use the inverse key: 2nd ${base.toUpperCase()} for ${m(`\\${base}^{-1}`)}.`,
      ruleCard: IT_RULE_IDS.calculator,
      reveal: [`${m(`${invTex(o.fn, inputTex, o.notation)} \\approx ${value.toFixed(5)}`)}, which rounds to ${m(text)}.`],
      answerText: text,
      forms: [],
      check: { kind: 'decimal', value, places: 3, unit: 'rad' },
      wrongNote: 'That is not the value. In RADIAN mode, use the inverse key, 2nd SIN, 2nd COS or 2nd TAN.',
      traps: decimalTraps(value, 3, inverseDecimalSlips(o.fn, x, inputSay)),
      noValue: true,
    }
    mark = { x, y: value, label: `(${inputSay}, ${text.replace('-', '−')})` }
  } else {
    const p = principalValue(o.fn, v)
    const unitWords = o.unit === 'rad' ? 'radians' : 'degrees'
    if (p === null) {
      value = null
      const trapDeg = outsideDomainTrap(o.fn as 'asin' | 'acos', x)
      part = {
        id: 'value',
        kind: 'principal',
        label: 'Value',
        ask: `What is the value, in ${unitWords}?`,
        formatHint: o.unit === 'rad' ? IT_RAD_HINT : IT_DEG_HINT,
        nudge: `${m(`\\${word}`)} gives the angle whose ${BASE_WORD[o.fn]} is the input, on ${RANGE_WORDS[o.fn]}. Look at the input first: is it one a ${BASE_WORD[o.fn]} can be?`,
        ruleCard: IT_RULE_IDS.outside,
        reveal: [`A ${BASE_WORD[o.fn]} is always between ${m('-1')} and ${m('1')}, and ${m(exactTex(v))} is not, so there is no angle: the expression has no value.`],
        answerText: 'no value',
        forms: ['undefined', 'DNE', 'does not exist'],
        check: { kind: 'principal', unit: o.unit, deg: null },
        wrongNote: 'That is not it. Check whether the input can be a sine or a cosine at all.',
        traps: [{ id: 'trig_inverse_outside_domain', text: exactText(angleIn(trapDeg, o.unit)), witness: outsideDomainWitness(o.fn as 'asin' | 'acos', inputSay) }],
        noValue: true,
      }
    } else {
      const angle = angleIn(p, o.unit)
      value = exactNum(angle)
      const forms = o.unit === 'rad' ? exactForms(angle) : [...new Set([exactText(angle), `${exactText(angle)}°`, `${exactText(angle)} degrees`])]
      part = {
        id: 'value',
        kind: 'principal',
        label: 'Value',
        ask: `What is the value, in ${unitWords}?`,
        formatHint: o.unit === 'rad' ? IT_RAD_HINT : IT_DEG_HINT,
        nudge: `${m(`\\${word}`)} gives the one angle whose ${BASE_WORD[o.fn]} is the input, on ${RANGE_WORDS[o.fn]}. Find it among the special angles.`,
        ruleCard: IT_RULE_IDS.special,
        reveal: [
          `The angle whose ${BASE_WORD[o.fn]} is ${m(exactTex(v))}, on ${RANGE_WORDS[o.fn]}, is ${m(`${exactTex(angle)}${o.unit === 'deg' ? '^{\\circ}' : ''}`)}.`,
          `So ${m(`${invTex(o.fn, inputTex, o.notation)} = ${exactTex(angle)}${o.unit === 'deg' ? '^{\\circ}' : ''}`)}.`,
        ],
        answerText: exactText(angle),
        forms: forms.filter((f) => f !== exactText(angle)),
        check: { kind: 'principal', unit: o.unit, deg: String(p.n / p.d) },
        wrongNote: `That is not the value. Find the angle with that ${BASE_WORD[o.fn]} on ${RANGE_WORDS[o.fn]}.`,
        traps: evaluateSlips(o.fn, v).map((s) => ({ id: s.id, text: exactText(angleIn(s.deg, o.unit)), witness: s.witness })),
        noValue: true,
      }
      mark = o.unit === 'rad' ? { x, y: value, label: `(${inputSay}, ${exactSay(angle)})` } : { x, y: (value * Math.PI) / 180, label: `(${inputSay}, ${exactSay(angle)}°)` }
    }
  }
  const prompt =
    o.mode === 'decimal'
      ? 'Use a calculator in RADIAN mode to find the value of the expression below, in radians. Round to three decimal places.'
      : `Find the exact value of the expression below, in ${o.unit === 'rad' ? 'radians' : 'degrees'}.`
  const tiInput = o.input.replace(/^-/, '(−) ').replace(/√(\d+)/g, '2nd x² (√) $1 )').replace(/\//g, ' ÷ ')
  return {
    question: 'evaluate',
    prompt,
    display,
    graphIt: `${o.fn}(x)`,
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: '' },
    stages: [part],
    promisable: part.traps,
    calc: inverseCalc({ fn: o.fn, tiInput, nsInput: o.input.replace(/-/g, '−'), unit: o.mode === 'decimal' ? 'rad' : o.unit, value, exact: o.mode === 'exact' && value !== null }),
    ruleCards: [IT_RULE_IDS.ranges, IT_RULE_IDS.special, IT_RULE_IDS.outside, IT_RULE_IDS.calculator],
    graph: inverseGraph(o.fn, mark, Math.abs(x)),
    givens: [{ value: x, sources: [] }],
  }
}

const EXACT_IN: Record<InvFn, readonly string[]> = {
  asin: ['1/2', '-1/2', '√2/2', '-√2/2', '√3/2', '-√3/2'],
  acos: ['1/2', '-1/2', '√2/2', '-√2/2', '√3/2', '-√3/2'],
  atan: ['√3/3', '-√3/3', '1', '-1', '√3', '-√3'],
}
const OUTSIDE_IN: readonly string[] = ['2', '-2', '3/2', '-3/2', '5/4', '-5/4', '4/3', '-4/3', '√2', '-√2', '√3', '-√3', '5/3', '-5/3', '3']

/** A calculator input: two decimals, away from the special values and from zero. */
function decimalInput(rng: Rng, fn: InvFn): string {
  for (let i = 0; i < 50; i++) {
    const v = fn === 'atan' ? rng.int(15, 95) / 10 : rng.int(12, 96) / 100
    const s = rng.chance(0.5) ? -v : v
    const special = [0.5, 0.71, 0.707, 0.87, 0.866, 1, 1.7, 0.58]
    if (special.some((t) => Math.abs(Math.abs(s) - t) < 0.015)) continue
    return String(s)
  }
  return fn === 'atan' ? '2.5' : '-0.35'
}

export function drawEvaluate(rng: Rng): ItDrafted {
  const fn = rng.pick(['asin', 'asin', 'asin', 'asin', 'acos', 'acos', 'acos', 'acos', 'atan', 'atan', 'atan'] as const)
  const r = rng.next()
  const notation = rng.chance(0.5) ? 0 : 1
  if (r < 0.27) return evaluateProblem({ fn, input: decimalInput(rng, fn), mode: 'decimal', unit: 'rad', notation })
  const unit: InvUnit = rng.chance(0.2) ? 'deg' : 'rad'
  if (r < 0.37 && fn !== 'atan') return evaluateProblem({ fn, input: rng.pick(OUTSIDE_IN), mode: 'exact', unit, notation })
  return evaluateProblem({ fn, input: rng.pick(EXACT_IN[fn]), mode: 'exact', unit, notation })
}

