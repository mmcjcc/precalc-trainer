/**
 * uc.solve: every angle in [0°, 360°) or [0, 2π) where a function has a special value (sin θ = −√3/2, tan θ = 1,
 * cos θ = 0, csc θ = 2, sec θ = −√2), typed as a list in any order. Usually two answers, sometimes one. Values whose
 * answers include θ = 0 are left out (sin θ = 0, tan θ = 0, cos θ = 1, sec θ = 1): the range itself starts with 0,
 * so it would read as showing an answer. The figure is the unit circle and its axes; the answer angles are drawn once
 * she is done.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart } from '@/content/types'
import {
  angleSay,
  angleTex,
  exactDiv,
  exactInt,
  exactNeg,
  exactNum,
  exactTex,
  exactText,
  listText,
  qText,
  quadrantName,
  quadrantsWithSign,
  readExact,
  solveAnswer,
  solveSlips,
  unitPoint,
  type AngleUnit,
  type Q,
  type TrigExact,
  type TrigFn,
} from '@/engine/trig'
import { nspireExactKeys, tiExactKeys, ucSolveCalc } from '../trig/calc'
import { solveFigure } from '../trig/figure'
import { m } from '../trig/text'
import type { UcDrafted } from './drafted'
import { LIST_DEG_HINT, LIST_RAD_HINT } from './hints'
import { UC_RULE_IDS } from './rules'

/** The special values each function is solved for (as typed), none with θ = 0 among the answers. */
export const SOLVE_VALUES: Record<TrigFn, string[]> = {
  sin: ['1/2', '-1/2', '√2/2', '-√2/2', '√3/2', '-√3/2', '1', '-1'],
  cos: ['1/2', '-1/2', '√2/2', '-√2/2', '√3/2', '-√3/2', '0', '-1'],
  tan: ['1', '-1', '√3', '-√3', '√3/3', '-√3/3'],
  csc: ['2', '-2', '√2', '-√2', '2√3/3', '-2√3/3', '1', '-1'],
  sec: ['2', '-2', '√2', '-√2', '2√3/3', '-2√3/3', '-1'],
  cot: ['1', '-1', '√3', '-√3', '√3/3', '-√3/3', '0'],
}

const BASE: Record<TrigFn, 'sin' | 'cos' | 'tan'> = { sin: 'sin', cos: 'cos', tan: 'tan', csc: 'sin', sec: 'cos', cot: 'tan' }
const RANGE_TEX: Record<AngleUnit, string> = { deg: '[0^{\\circ}, 360^{\\circ})', rad: '[0, 2\\pi)' }

function ex(t: string): TrigExact {
  const v = readExact(t)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${t}`)
  return v
}

/** In quadrant k, the angle with reference angle α, as the worked line writes it: π − π/3 = 2π/3. */
function inQuadrant(k: number, ref: Q, d: Q, unit: AngleUnit): string {
  const a = angleTex({ deg: ref, unit })
  const half = unit === 'deg' ? '180^{\\circ}' : '\\pi'
  const full = unit === 'deg' ? '360^{\\circ}' : '2\\pi'
  const out = angleTex({ deg: d, unit })
  if (k === 1) return `${out}`
  if (k === 2) return `${half} - ${a} = ${out}`
  if (k === 3) return `${half} + ${a} = ${out}`
  return `${full} - ${a} = ${out}`
}

function quadrantOf(d: Q): number {
  const v = d.n / d.d
  return v < 90 ? 1 : v < 180 ? 2 : v < 270 ? 3 : 4
}

/** The uc.solve problem for this function, value and unit (exported for the hand-worked tests). */
export function solveProblem(o: { fn: TrigFn; value: TrigExact; unit: AngleUnit }): UcDrafted {
  const { fn, value, unit } = o
  const degs = solveAnswer(fn, value)
  if (!degs.length) throw new Error(`no special angle has ${fn} = ${exactText(value)}`)
  const base = BASE[fn]
  const reciprocal = base !== fn
  const zeroCot = fn === 'cot' && exactNum(value) === 0
  const baseValue: TrigExact = !reciprocal ? value : zeroCot ? exactInt(0) : exactDiv(exactInt(1), value)
  const baseFn: 'sin' | 'cos' | 'tan' = zeroCot ? 'cos' : base
  const eq = `\\${fn}\\theta = ${exactTex(value)}`
  const baseEq = `\\${baseFn}\\theta = ${exactTex(baseValue)}`
  const answerText = listText(degs, unit)
  const say = (d: Q) => angleSay({ deg: d, unit })
  const reveal: string[] = []
  if (reciprocal) reveal.push(zeroCot ? `${m(eq)} exactly where ${m('\\cos\\theta = 0')}: ${m('\\cot\\theta = \\frac{\\cos\\theta}{\\sin\\theta}')}.` : `${m(eq)} means ${m(baseEq)}.`)
  const onAxis = degs.every((d) => d.n % 90 === 0)
  if (onAxis) {
    for (const d of degs) {
      const p = unitPoint(d)!
      reveal.push(`At ${m(`\\theta = ${angleTex({ deg: d, unit })}`)} the point on the unit circle is ${m(`(${exactTex(p.x)}, ${exactTex(p.y)})`)}, so ${m(`\\${baseFn}\\theta = ${exactTex(baseValue)}`)}.`)
    }
  } else {
    const size = exactNum(baseValue) < 0 ? exactNeg(baseValue) : baseValue
    const ref = solveAnswer(baseFn, size).find((d) => d.n > 0 && d.n < 90)!
    const sign = exactNum(baseValue) < 0 ? -1 : 1
    reveal.push(
      `The reference angle is ${m(angleTex({ deg: ref, unit }))}, since ${m(`\\${baseFn}\\left(${angleTex({ deg: ref, unit })}\\right) = ${exactTex(size)}`)}. ${baseFn} is ${sign > 0 ? 'positive' : 'negative'} in ${quadrantsWithSign(baseFn, sign as 1 | -1).map((k) => quadrantName(k)).join(' and ')}.`,
    )
    for (const d of degs) reveal.push(`In ${quadrantName(quadrantOf(d) as 1 | 2 | 3 | 4)}: ${m(`\\theta = ${inQuadrant(quadrantOf(d), ref, d, unit)}`)}.`)
  }
  reveal.push(`So ${degs.length === 1 ? `the only solution in ${m(RANGE_TEX[unit])} is ${m(`\\theta = ${angleTex({ deg: degs[0]!, unit })}`)}` : `${m('\\theta')} is ${degs.map((d) => m(angleTex({ deg: d, unit }))).join(' or ')}`}.`)

  const reversed = [...degs].reverse()
  const forms = new Set<string>([listText(reversed, unit)])
  if (unit === 'deg') {
    forms.add(degs.map((d) => `${qText(d)}°`).join(', '))
    forms.add(reversed.map((d) => `${qText(d)}°`).join(', '))
  } else {
    forms.add(answerText.replace(/π/g, 'pi'))
    forms.add(listText(reversed, unit).replace(/π/g, 'pi'))
  }
  if (degs.length === 2) forms.add(answerText.replace(', ', ' and '))
  forms.delete(answerText)

  const part: TrigPart = {
    id: 'solutions',
    kind: 'angles',
    label: 'Every solution',
    ask: `Which angles ${m('\\theta')} in ${m(RANGE_TEX[unit])} have ${m(eq)}? List every one, separated by commas.`,
    formatHint: unit === 'deg' ? LIST_DEG_HINT : LIST_RAD_HINT,
    nudge: onAxis
      ? `${reciprocal ? 'Turn it into sin, cos or tan first. ' : ''}The value puts the point on an axis: find where on the unit circle that coordinate has this value.`
      : `${reciprocal ? 'Turn it into sin, cos or tan first. ' : ''}Find the reference angle from the size of the value, then each quadrant where the function has its sign, and put the reference angle there.`,
    ruleCard: UC_RULE_IDS.solve,
    reveal,
    answerText,
    forms: [...forms],
    check: { kind: 'angles', unit, degs: degs.map(qText), fn, value: exactText(value) },
    wrongNote: 'Not every angle there solves the equation, or one is missing. Find the reference angle, then each quadrant where the function has this sign.',
    traps: solveSlips(fn, value, unit).map((s) => ({ id: s.id, text: s.values.map(exactText).join(', '), witness: s.witness })),
  }

  // The calculator's one angle, in the unit asked: sin⁻¹ and tan⁻¹ in (−90°, 90°), cos⁻¹ in [0°, 180°].
  const x = exactNum(baseValue)
  const rad = baseFn === 'sin' ? Math.asin(x) : baseFn === 'cos' ? Math.acos(x) : Math.atan(x)
  const principal = unit === 'deg' ? (rad * 180) / Math.PI : rad
  const principalText = unit === 'deg' ? `${Number(principal.toFixed(6))}°` : `${Number(principal.toFixed(6))}`.replace('-', '−')
  return {
    question: 'solve',
    prompt: `Solve ${m(eq)} for ${m('\\theta')} in ${m(RANGE_TEX[unit])}. Give every solution exactly, in ${unit === 'deg' ? 'degrees' : 'radians'}.`,
    figure: solveFigure(
      degs.map((d) => d.n / d.d),
      degs.map((d) => say(d)),
    ),
    stages: [part],
    promisable: part.traps,
    calc: ucSolveCalc({ fn, unit, valueKeys: tiExactKeys(value), valueNs: nspireExactKeys(value), zero: zeroCot, principal, principalText: principalText.replace('-', '−') }),
    calcExpr: `${baseFn === 'sin' ? 'asin' : baseFn === 'cos' ? 'acos' : 'atan'}(${exactText(baseValue).replace(/√(\d+)/g, 'sqrt($1)')})`,
    ruleCards: [UC_RULE_IDS.solve, UC_RULE_IDS.signs, UC_RULE_IDS.special, UC_RULE_IDS.reciprocal, UC_RULE_IDS.axes],
  }
}

export function drawSolve(rng: Rng): UcDrafted {
  const fn = rng.pick(['sin', 'sin', 'sin', 'cos', 'cos', 'cos', 'tan', 'tan', 'csc', 'csc', 'sec', 'sec', 'cot', 'cot'] as const)
  const value = ex(rng.pick(SOLVE_VALUES[fn]))
  const unit: AngleUnit = rng.chance(0.5) ? 'deg' : 'rad'
  return solveProblem({ fn, value, unit })
}
