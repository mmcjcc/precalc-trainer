/**
 * sg.features: from y = A sin(B(x − C)) + D or y = A cos(Bx − C) + D (both forms; B > 0, A sometimes negative, x in
 * radians), the amplitude, the period, the phase shift (a size and left or right, or none), the midline and the range,
 * one part at a time; sometimes then the five key points of one period from the phase shift. The equation is the
 * problem (TrigAnswerFields.display); the graph waits behind the Graph panel's gate, since it shows every answer.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart, TrigPartTrap } from '@/content/types'
import {
  amplitudeSlips,
  exactMul,
  exactNum,
  exactTex,
  exactText,
  isZero,
  keyPointSlips,
  midlineSlips,
  periodSlips,
  pointsText,
  q,
  qAbs,
  rangeSlips,
  shiftSlips,
  waveAmplitude,
  waveInnerShift,
  waveInsideTex,
  waveKeyPoints,
  wavePeriod,
  waveRangeText,
  waveTex,
  type Wave,
  type WaveForm,
  type WaveSlip,
} from '@/engine/trig'
import { exactForms } from '../trig/forms'
import { pointLabel, waveGraph } from '../trig/graph5'
import type { Drafted5 } from '../trig/build5'
import { m } from '../trig/text'
import { drawA, drawB, drawInner, exactOfQ, graphItText, qTex, qText, rangeForms, rangeTex, shiftForms, shiftOf, shiftTex, shiftText } from '../trig/wave5'
import { waveCalc } from '../trig/calc5'
import { SG_RULE_IDS } from './rules'
import { SG_AMPLITUDE_HINT, SG_MIDLINE_HINT, SG_PERIOD_HINT, SG_POINTS_HINT, SG_RANGE_HINT, SG_SHIFT_HINT } from './words'

export type SgDrafted = Drafted5<'features' | 'equation' | 'model'>

const valueTraps = (slips: readonly WaveSlip[]): TrigPartTrap[] => slips.map((s) => ({ id: s.id, text: exactText(s.value), witness: s.witness }))

export interface FeaturesInput {
  wave: Wave
  form: WaveForm
  keyPoints: boolean
}

/** The sg.features problem for this wave (exported for the hand-worked tests). */
export function featuresProblem(o: FeaturesInput): SgDrafted {
  const w = o.wave
  if (w.fn !== 'sin' && w.fn !== 'cos') throw new Error('sg.features is for sine and cosine')
  const amp = waveAmplitude(w)
  const P = wavePeriod(w)
  const fnTex = `\\${w.fn}`
  const generic = o.form === 'factored' ? `y = A${fnTex}\\left(B\\left(x - C\\right)\\right) + D` : `y = A${fnTex}\\left(Bx - C\\right) + D`

  const amplitude: TrigPart = {
    id: 'amplitude',
    kind: 'value',
    label: 'Amplitude',
    ask: 'What is the amplitude?',
    formatHint: SG_AMPLITUDE_HINT,
    nudge: `In ${m(generic)} the amplitude is ${m('|A|')}: how far the graph rises above its midline. A minus sign in front flips the graph but does not change the amplitude.`,
    ruleCard: SG_RULE_IDS.amplitude,
    reveal: [`${m(`A = ${qTex(w.A)}`)}, so the amplitude is ${m(`|A| = ${exactTex(amp)}`)}.`],
    answerText: exactText(amp),
    forms: exactForms(amp),
    check: { kind: 'value', value: exactText(amp) },
    wrongNote: 'That is not the amplitude. It is the size of the number in front of the function, without its sign.',
    traps: valueTraps(amplitudeSlips(w)),
  }

  const period: TrigPart = {
    id: 'period',
    kind: 'value',
    label: 'Period',
    ask: 'What is the period?',
    formatHint: SG_PERIOD_HINT,
    nudge: `The period of ${m(`y = A${fnTex}(Bx - C) + D`)} is ${m('\\frac{2\\pi}{B}')}, with ${m('B')} the number multiplying ${m('x')}.`,
    ruleCard: SG_RULE_IDS.period,
    reveal: [`${m(`B = ${exactTex(w.B)}`)}, so the period is ${m(`\\frac{2\\pi}{B} = \\frac{2\\pi}{${exactTex(w.B)}} = ${exactTex(P)}`)}.`],
    answerText: exactText(P),
    forms: exactForms(P),
    check: { kind: 'value', value: exactText(P) },
    wrongNote: 'That is not the period. Find B, the number multiplying x: the period is 2π/B.',
    traps: valueTraps(periodSlips(w)),
  }

  const shiftReveal: string[] = isZero(w.C)
    ? [`Nothing is subtracted from ${m('x')} inside the function, so there is no phase shift.`]
    : o.form === 'factored'
      ? [`The inside, ${m(waveInsideTex(w, 'factored'))}, is zero at ${m(`x = ${exactTex(w.C)}`)}: the phase shift is ${m(shiftTex(w.C))}.`]
      : [
          `Factor ${m(`B = ${exactTex(w.B)}`)} out of the inside: ${m(`${waveInsideTex(w, 'expanded')} = ${waveInsideTex(w, 'factored')}`)}.`,
          `The phase shift is ${m(`\\frac{C}{B} = ${exactTex(w.C)}`)}: ${m(shiftTex(w.C))}.`,
        ]
  const shift: TrigPart = {
    id: 'shift',
    kind: 'shift',
    label: 'Phase shift',
    ask: 'What is the phase shift? Give its size and its direction.',
    formatHint: SG_SHIFT_HINT,
    nudge:
      o.form === 'factored'
        ? `In ${m(generic)} the graph shifts ${m('C')}: right when ${m('x - C')} has a minus, left when it has a plus.`
        : `In ${m(generic)} factor ${m('B')} out of the inside first: ${m('Bx - C = B\\left(x - \\frac{C}{B}\\right)')}. The phase shift is ${m('\\frac{C}{B}')}.`,
    ruleCard: SG_RULE_IDS.shift,
    reveal: shiftReveal,
    answerText: shiftText(w.C),
    forms: shiftForms(w.C),
    check: { kind: 'shift', value: exactText(w.C) },
    wrongNote: 'That is not the phase shift. Find where the inside of the function is zero: that is where a cycle starts.',
    traps: shiftSlips(w, o.form).map((s) => ({ id: s.id, text: shiftText(s.value), witness: s.witness })),
  }

  const midline: TrigPart = {
    id: 'midline',
    kind: 'midline',
    label: 'Midline',
    ask: 'What is the equation of the midline?',
    formatHint: SG_MIDLINE_HINT,
    nudge: `The midline of ${m(generic)} is the horizontal line ${m('y = D')}, halfway between the highest and lowest points.`,
    ruleCard: SG_RULE_IDS.amplitude,
    reveal: [w.D.n === 0 ? `Nothing is added at the end, so the midline is the x-axis, ${m('y = 0')}.` : `${m(`D = ${qTex(w.D)}`)}, so the midline is ${m(`y = ${qTex(w.D)}`)}.`],
    answerText: `y = ${qText(w.D)}`,
    forms: [qText(w.D), `y=${qText(w.D)}`],
    check: { kind: 'midline', value: qText(w.D) },
    wrongNote: 'That is not the midline. It is the horizontal line through the number added at the end.',
    traps: midlineSlips(w).map((s) => ({ id: s.id, text: `y = ${exactText(s.value)}`, witness: s.witness })),
  }

  const rangeText = waveRangeText(w)
  const lo = q(w.D.n * qAbs(w.A).d - qAbs(w.A).n * w.D.d, w.D.d * qAbs(w.A).d)
  const hi = q(w.D.n * qAbs(w.A).d + qAbs(w.A).n * w.D.d, w.D.d * qAbs(w.A).d)
  const range: TrigPart = {
    id: 'range',
    kind: 'interval',
    label: 'Range',
    ask: 'What is the range?',
    formatHint: SG_RANGE_HINT,
    nudge: `The heights go ${m('|A|')} above and below the midline ${m('y = D')}: the range is ${m('[D - |A|, D + |A|]')}.`,
    ruleCard: SG_RULE_IDS.amplitude,
    reveal: [`The lowest height is ${m(`D - |A| = ${qTex(lo)}`)} and the highest is ${m(`D + |A| = ${qTex(hi)}`)}: the range is ${m(rangeTex(rangeText))}.`],
    answerText: rangeText,
    forms: rangeForms(rangeText),
    check: { kind: 'interval', value: rangeText },
    wrongNote: 'That is not the range. Go the amplitude above and below the midline.',
    traps: rangeSlips(w).map((s) => ({ id: s.id, text: s.text, witness: s.witness })),
  }

  const stages = [amplitude, period, shift, midline, range]
  if (o.keyPoints) {
    const pts = waveKeyPoints(w)
    const text = pointsText(pts)
    const quarter = exactMul(P, exactOfQ(q(1, 4)))
    stages.push({
      id: 'keypoints',
      kind: 'points',
      label: 'Key points',
      ask: 'What are the five key points of one period, starting at the phase shift?',
      formatHint: SG_POINTS_HINT,
      nudge: `Start at the phase shift and step a quarter period at a time. ${w.fn === 'sin' ? 'sin goes midline, highest, midline, lowest, midline' : 'cos goes highest, midline, lowest, midline, highest'}${w.A.n < 0 ? '; the minus sign in front swaps the highest and the lowest' : ''}.`,
      ruleCard: SG_RULE_IDS.keyPoints,
      reveal: [
        `A quarter period is ${m(`\\frac{1}{4}\\cdot ${exactTex(P)} = ${exactTex(quarter)}`)}; from ${m(`x = ${exactTex(w.C)}`)} the heights are ${pts.map((p) => m(qTex(p.y))).join(', ')}.`,
        `The key points are ${pts.map((p) => m(`\\left(${exactTex(p.x)}, ${qTex(p.y)}\\right)`)).join(', ')}.`,
      ],
      answerText: text,
      forms: [text.replace(/π/g, 'pi'), pointsText([...pts].reverse())],
      check: { kind: 'points', points: pts.map((p) => [exactText(p.x), qText(p.y)] as [string, string]) },
      wrongNote: 'Those are not the key points of this period. Start at the phase shift and step a quarter period at a time.',
      traps: keyPointSlips(w, o.form).map((s) => ({ id: s.id, text: pointsText(s.points), witness: s.witness })),
    })
  }

  // The graph behind the gate: two periods from a quarter period before the shift, a highest and a lowest point labelled.
  const Pn = exactNum(P)
  const c0 = exactNum(w.C)
  const extremes = waveKeyPoints(w).filter((_p, i) => (w.fn === 'sin' ? i === 1 || i === 3 : i === 0 || i === 2))
  const graph = waveGraph(w, {
    window: [c0 - Pn / 4, c0 + 2 * Pn],
    markers: extremes.map((p) => ({ x: exactNum(p.x), y: p.y.n / p.y.d, label: pointLabel(p.x, exactOfQ(p.y)), labelSide: p.y.n * w.D.d > w.D.n * p.y.d ? ('above' as const) : ('below' as const) })),
  })

  return {
    question: 'features',
    prompt: `For the graph of the function below, find the amplitude, the period, the phase shift, the midline and the range${o.keyPoints ? ', then the five key points of one period' : ''}.`,
    display: m(waveTex(w, o.form)),
    graphIt: graphItText(w),
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: '' },
    stages,
    promisable: stages.flatMap((s) => s.traps),
    calc: waveCalc(w, { window: [c0 - Pn / 4, c0 + 2 * Pn], find: 'features' }),
    ruleCards: [SG_RULE_IDS.amplitude, SG_RULE_IDS.period, SG_RULE_IDS.shift, SG_RULE_IDS.keyPoints],
    graph,
    givens: [
      { value: Math.abs(w.A.n / w.A.d), sources: ['amplitude'] },
      { value: exactNum(w.B), sources: [] },
      { value: exactNum(o.form === 'factored' ? w.C : waveInnerShift(w)), sources: o.form === 'factored' || exactNum(w.B) === 1 ? ['shift'] : [] },
      { value: w.D.n / w.D.d, sources: ['midline'] },
    ],
  }
}

const A_POOL: readonly [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 1],
  [3, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [1, 2],
  [3, 2],
  [5, 2],
]
const B_RATIONAL: readonly [number, number][] = [
  [2, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 1],
  [3, 2],
]
const B_PI: readonly [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 1],
]

export function drawFeatures(rng: Rng): SgDrafted {
  const fn = rng.pick(['sin', 'cos'] as const)
  const A = drawA(rng, A_POOL, 0.35)
  const B = drawB(rng, B_RATIONAL, B_PI, 0.2)
  const C = rng.chance(0.15) ? exactOfQ(q(0)) : shiftOf(B, drawInner(rng))
  const D = q(rng.chance(0.2) ? 0 : rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]))
  const form: WaveForm = isZero(C) ? 'factored' : rng.chance(0.5) ? 'factored' : 'expanded'
  return featuresProblem({ wave: { fn, A, B, C, D }, form, keyPoints: rng.chance(0.3) })
}
