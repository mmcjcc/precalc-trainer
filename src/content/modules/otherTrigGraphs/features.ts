/**
 * og.features: for y = A tan(Bx − C) + D and cot, sec, csc (B > 0, x in radians): the period (π/B for tan and cot, 2π/B
 * for sec and csc), the vertical asymptotes as a family "x = a + kp" (every equivalent family is right) or as a list in
 * an interval, the x-intercepts of tan and cot when there is no vertical shift, and the range of sec and csc as a union
 * of intervals. The equation is the problem; the graph, with its asymptotes dashed, waits behind the Graph panel's gate.
 */
import type { Rng } from '@/content/rng'
import type { OtherTrigGraphsQuestion, TrigPart, TrigPartTrap } from '@/content/types'
import {
  asymptoteSlips,
  exactNum,
  exactTex,
  exactText,
  familyTex,
  isZero,
  membersBetween,
  periodSlips,
  q,
  rangeSlips,
  readXSet,
  waveAsymptotes,
  waveInnerShift,
  waveInsideTex,
  wavePeriod,
  waveRangeText,
  waveTex,
  waveZeros,
  zeroSlips,
  type TrigExact,
  type Wave,
  type WaveFn,
  type WaveForm,
  type XFamily,
} from '@/engine/trig'
import type { Drafted5 } from '../trig/build5'
import { waveCalc } from '../trig/calc5'
import { exactForms } from '../trig/forms'
import { waveGraph, waveYWindow } from '../trig/graph5'
import { m } from '../trig/text'
import { drawA, drawB, drawInner, exactOfQ, familyForms, graphItText, qTex, rangeForms, rangeTex, shiftOf } from '../trig/wave5'
import { OG_RULE_IDS } from './rules'
import { OG_FAMILY_HINT, OG_LIST_HINT, OG_PERIOD_HINT, OG_RANGE_HINT } from './words'

export type OgDrafted = Drafted5<OtherTrigGraphsQuestion>

const FN_WORD: Record<WaveFn, string> = { sin: 'sine', cos: 'cosine', tan: 'tangent', cot: 'cotangent', sec: 'secant', csc: 'cosecant' }

/** A list of x-values as she would type it: "x = 0, x = π/2". */
const listText = (vs: readonly TrigExact[]) => vs.map((v) => `x = ${exactText(v)}`).join(', ')
const listTex = (vs: readonly TrigExact[]) => vs.map((v) => `x = ${exactTex(v)}`).join(',\\; ')

function familyTraps(slips: readonly { id: TrigPartTrap['id']; family: XFamily; witness: string }[]): TrigPartTrap[] {
  return slips.map((s) => ({ id: s.id, text: familyForms(s.family).text, witness: s.witness }))
}

export interface OgFeaturesInput {
  wave: Wave
  form: WaveForm
  /** The asymptotes as a list between two x-values (half a step before one asymptote, two steps long), or a family. */
  list: { from: number } | null
}

/** The og.features problem for this wave (exported for the hand-worked tests). */
export function ogFeaturesProblem(o: OgFeaturesInput): OgDrafted {
  const w = o.wave
  if (w.fn === 'sin' || w.fn === 'cos') throw new Error('og.features is for tan, cot, sec and csc')
  const P = wavePeriod(w)
  const tanLike = w.fn === 'tan' || w.fn === 'cot'
  const base = tanLike ? '\\pi' : '2\\pi'
  const fam = waveAsymptotes(w)!
  const fnTex = `\\${w.fn}`

  const period: TrigPart = {
    id: 'period',
    kind: 'value',
    label: 'Period',
    ask: 'What is the period?',
    formatHint: OG_PERIOD_HINT,
    nudge: `${tanLike ? 'tan and cot repeat every half turn' : 'sec and csc repeat every full turn'}: the period of ${m(`y = A${fnTex}(Bx - C) + D`)} is ${m(`\\frac{${base}}{B}`)}.`,
    ruleCard: OG_RULE_IDS.period,
    reveal: [`${m(`B = ${exactTex(w.B)}`)}, so the period is ${m(`\\frac{${base}}{B} = \\frac{${base}}{${exactTex(w.B)}} = ${exactTex(P)}`)}.`],
    answerText: exactText(P),
    forms: exactForms(P),
    check: { kind: 'value', value: exactText(P) },
    wrongNote: `That is not the period. Find B, the number multiplying x: the period is ${tanLike ? 'π/B' : '2π/B'}.`,
    traps: periodSlips(w).map((s) => ({ id: s.id, text: exactText(s.value), witness: s.witness })),
  }

  const zeroOf = w.fn === 'tan' || w.fn === 'sec' ? 'cos' : 'sin'
  const insideTex = waveInsideTex(w, 'expanded')
  const stepTex = exactTex(fam.step)
  const asymReveal = [
    `${m(`\\${w.fn}`)} has no value where ${m(`\\${zeroOf}`)} of the inside is zero: ${m(`${insideTex} = ${zeroOf === 'cos' ? '\\frac{\\pi}{2}' : '0'} + k\\pi`)}.`,
    `Solving for ${m('x')}: ${m(familyTex(fam))}, one every ${m(stepTex)}.`,
  ]
  let asym: TrigPart
  let between: [number, number] | null = null
  if (o.list) {
    const s = exactNum(fam.step)
    between = [o.list.from, o.list.from + 2 * s]
    const answerSet = readXSet(familyForms(fam).text)
    if (!answerSet.ok) throw new Error(answerSet.message)
    const members = membersBetween(answerSet.set, between[0], between[1])
    const text = listText(members)
    const traps: TrigPartTrap[] = []
    for (const slip of asymptoteSlips(w, o.form)) {
      const r = readXSet(familyForms(slip.family).text)
      if (!r.ok) continue
      const vs = membersBetween(r.set, between[0], between[1])
      if (!vs.length) continue
      traps.push({ id: slip.id, text: listText(vs), witness: slip.witness })
    }
    asym = {
      id: 'asymptotes',
      kind: 'family',
      label: 'Vertical asymptotes',
      ask: 'What are the vertical asymptotes in that interval?',
      formatHint: OG_LIST_HINT,
      nudge: `Solve for where ${m(`\\${zeroOf}`)} of the inside is zero, then keep the ones in the interval.`,
      ruleCard: OG_RULE_IDS.asymptotes,
      reveal: [...asymReveal, `In the interval: ${m(listTex(members))}.`],
      answerText: text,
      forms: [members.map((v) => exactText(v)).join(', '), listText([...members].reverse())],
      check: { kind: 'family', answer: text, between, what: 'vertical asymptotes' },
      wrongNote: 'Those are not the vertical asymptotes in that interval. Find where the function has no value, then keep the ones in the interval.',
      traps,
      leakForms: members.flatMap((v) => [exactText(v), `x = ${exactText(v)}`]),
    }
  } else {
    const ff = familyForms(fam)
    asym = {
      id: 'asymptotes',
      kind: 'family',
      label: 'Vertical asymptotes',
      ask: 'What are the vertical asymptotes? Give all of them, as a family.',
      formatHint: OG_FAMILY_HINT,
      nudge: `Set the inside equal to the angles where ${m(`\\${zeroOf}`)} is zero and solve for ${m('x')}; ${m('k')} counts the repeats.`,
      ruleCard: OG_RULE_IDS.asymptotes,
      reveal: asymReveal,
      answerText: ff.text,
      forms: ff.forms,
      check: { kind: 'family', answer: ff.text, what: 'vertical asymptotes' },
      wrongNote: 'Those are not the vertical asymptotes. Find where the function has no value: where the function under it is zero.',
      traps: familyTraps(asymptoteSlips(w, o.form)),
      leakForms: ff.leak,
    }
  }

  const stages: TrigPart[] = [period, asym]
  const zeros = waveZeros(w)
  if (zeros) {
    const zf = familyForms(zeros)
    stages.push({
      id: 'zeros',
      kind: 'family',
      label: 'x-intercepts',
      ask: 'What are the x-intercepts? Give all of them, as a family.',
      formatHint: OG_FAMILY_HINT,
      nudge: `With no vertical shift, ${m(`\\${w.fn}`)} is zero where ${m(w.fn === 'tan' ? '\\sin' : '\\cos')} of the inside is zero: halfway between neighbouring asymptotes.`,
      ruleCard: OG_RULE_IDS.zeros,
      reveal: [`${m(`\\${w.fn}`)} is zero where ${m(`${insideTex} = ${w.fn === 'tan' ? '0' : '\\frac{\\pi}{2}'} + k\\pi`)}: ${m(familyTex(zeros))}.`],
      answerText: zf.text,
      forms: zf.forms,
      check: { kind: 'family', answer: zf.text, what: 'x-intercepts' },
      wrongNote: 'Those are not the x-intercepts. They are halfway between neighbouring asymptotes, where the function is zero.',
      traps: familyTraps(zeroSlips(w, o.form)),
      leakForms: zf.leak,
    })
  }
  if (!tanLike) {
    const rt = waveRangeText(w)
    stages.push({
      id: 'range',
      kind: 'interval',
      label: 'Range',
      ask: 'What is the range?',
      formatHint: OG_RANGE_HINT,
      nudge: `The ${FN_WORD[w.fn]} never takes a height strictly between its turning points, at ${m('D - |A|')} and ${m('D + |A|')}.`,
      ruleCard: OG_RULE_IDS.range,
      reveal: [`The turning points are at heights ${m(`D - |A| = ${qTex(q(w.D.n * w.A.d - Math.abs(w.A.n) * w.D.d, w.D.d * w.A.d))}`)} and ${m(`D + |A| = ${qTex(q(w.D.n * w.A.d + Math.abs(w.A.n) * w.D.d, w.D.d * w.A.d))}`)}: the range is ${m(rangeTex(rt))}.`],
      answerText: rt,
      forms: rangeForms(rt),
      check: { kind: 'interval', value: rt },
      wrongNote: 'That is not the range. The graph takes every height up to its lower turning point and from its upper one on.',
      traps: rangeSlips(w).map((s) => ({ id: s.id, text: s.text, witness: s.witness })),
    })
  }

  const Pn = exactNum(P)
  const c0 = exactNum(w.C)
  const window: [number, number] = [c0 - Pn, c0 + Pn]
  const yWindow = waveYWindow(w)
  const graph = waveGraph(w, { window, yWindow, asymptotes: true })
  const asks = ['the period', o.list ? `the vertical asymptotes between ${m(`x = ${exactTex(exactAt(between![0], fam))}`)} and ${m(`x = ${exactTex(exactAt(between![1], fam))}`)}` : 'every vertical asymptote']
  if (zeros) asks.push('every x-intercept')
  if (!tanLike) asks.push('the range')
  // A comma before the last "and": an item may hold an "and" of its own (between x = a and x = b).
  const list = asks.length === 2 ? `${asks[0]} and ${asks[1]}` : `${asks.slice(0, -1).join(', ')}, and ${asks.at(-1)!}`
  const givens = [
    { value: Math.abs(w.A.n / w.A.d), sources: [] },
    { value: exactNum(w.B), sources: [] },
    { value: Math.abs(exactNum(o.form === 'factored' ? w.C : waveInnerShift(w))), sources: [] },
    { value: Math.abs(w.D.n / w.D.d), sources: [] },
    ...(between ? between.map((b) => ({ value: Math.abs(b), sources: [] })) : []),
  ]
  return {
    question: 'features',
    prompt: `For the graph of the function below, find ${list}.`,
    display: m(waveTex(w, o.form)),
    graphIt: graphItText(w),
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: '' },
    stages,
    promisable: stages.flatMap((s) => s.traps),
    calc: waveCalc(w, { window, yWindow, find: 'asymptotes' }),
    ruleCards: [OG_RULE_IDS.period, OG_RULE_IDS.asymptotes, ...(zeros ? [OG_RULE_IDS.zeros] : []), ...(tanLike ? [] : [OG_RULE_IDS.range])],
    graph,
    givens,
  }
}

/** An interval end as an exact number of the family's kind (a half step before an asymptote). */
function exactAt(x: number, fam: XFamily): TrigExact {
  const unit = fam.step.pi === 1 ? Math.PI : 1
  const k = x / unit
  // A multiple of a quarter of the step's denominator: exact as a fraction with that denominator times 4.
  const d = fam.step.c.d * 4
  const n = Math.round(k * d)
  return { ...exactOfQ(q(n, d)), pi: n === 0 ? 0 : fam.step.pi }
}

const A_POOL: readonly [number, number][] = [
  [1, 1],
  [1, 1],
  [2, 1],
  [2, 1],
  [3, 1],
  [1, 2],
]
const B_RATIONAL: readonly [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [1, 3],
]
const B_PI: readonly [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 4],
]

export function drawOgFeatures(rng: Rng): OgDrafted {
  const fn = rng.pick(['tan', 'tan', 'tan', 'tan', 'tan', 'tan', 'tan', 'sec', 'sec', 'sec', 'sec', 'sec', 'csc', 'csc', 'csc', 'csc', 'cot', 'cot', 'cot', 'cot'] as const)
  const A = drawA(rng, A_POOL, 0.3)
  const B = drawB(rng, B_RATIONAL, B_PI, 0.2)
  const C = rng.chance(0.3) ? exactOfQ(q(0)) : shiftOf(B, drawInner(rng))
  const tanLike = fn === 'tan' || fn === 'cot'
  const D = q(tanLike ? (rng.chance(0.55) ? 0 : rng.pick([-3, -2, -1, 1, 2, 3])) : rng.chance(0.3) ? 0 : rng.pick([-3, -2, -1, 1, 2, 3]))
  const form: WaveForm = isZero(C) ? 'factored' : rng.chance(0.7) ? 'expanded' : 'factored'
  const w: Wave = { fn, A, B, C, D }
  let list: OgFeaturesInput['list'] = null
  const asList = rng.chance(0.45)
  const j = rng.pick([-1, 0] as const)
  // The list in an interval only where the zeros are not asked too: its ends, half a step from an asymptote, are zeros.
  if (asList && !waveZeros(w)) {
    const fam = waveAsymptotes(w)!
    const s = exactNum(fam.step)
    const b = exactNum(fam.base)
    // Start half a step before an asymptote near zero, so the interval holds two of them and neither end is one.
    list = { from: b + j * s - s / 2 }
  }
  return ogFeaturesProblem({ wave: w, form, list })
}
