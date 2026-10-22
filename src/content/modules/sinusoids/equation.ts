/**
 * sg.equation: write an equation for a sinusoid, from its graph (one or two periods drawn, a highest point and the next
 * lowest point marked and labelled with exact coordinates, x ticks in multiples of π/k) or from a description
 * ("amplitude 3 and period π, shifted π/6 to the right and 2 units down"). Every equivalent equation is right, sine or
 * cosine, any equivalent shift, a negative A with the matching shift, B(x − C) or Bx − BC: the part is graded by
 * equivalence as functions (exactly at the key points, and over two periods), never by its text.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart, TrigPartTrap } from '@/content/types'
import { addExact, exactDiv, exactMul, exactNeg, exactNum, exactPi, exactQ, exactTex, isZero, q, qNeg, tx, wavePeriod, waveTex, waveText, type TrigExact, type Wave } from '@/engine/trig'
import type { CalcPanels } from '@/shared/types'
import { nspireMode, tiMode } from '../trig/calc'
import { NO_GRAPH } from '../trig/build5'
import { distinctFunctionTraps, functionCheck, sameForms } from '../trig/fn5'
import { pointLabel, waveGraph } from '../trig/graph5'
import { m } from '../trig/text'
import { drawA, drawB, exactOfQ, qTex, shiftOf, drawInner } from '../trig/wave5'
import type { SgDrafted } from './features'
import { SG_RULE_IDS } from './rules'
import { SG_EQUATION_HINT } from './words'

const quarterOf = (P: TrigExact) => exactDiv(P, exactQ(q(4)))
const halfOf = (P: TrigExact) => exactDiv(P, exactQ(q(2)))
const times = (v: TrigExact, k: number) => exactMul(v, exactQ(q(k)))

/** The five key x-values of one period of a wave from its shift (where the function is exact). */
function keyXs(w: Wave): TrigExact[] {
  const quarter = quarterOf(wavePeriod(w))
  return [0, 1, 2, 3, 4].map((i) => addExact(w.C, times(quarter, i)))
}

/** Equal spellings of a wave's equation: the cofunction, a negative A with its shift, the expanded inside. */
function equalSpellings(w: Wave): string[] {
  const P = wavePeriod(w)
  const quarter = quarterOf(P)
  const co: Wave = w.fn === 'cos' ? { ...w, fn: 'sin', C: addExact(w.C, exactNeg(quarter)) } : { ...w, fn: 'cos', C: addExact(w.C, quarter) }
  const flipped: Wave = { ...w, A: qNeg(w.A), C: addExact(w.C, halfOf(P)) }
  const out = [waveText(co, 'factored'), waveText(flipped, 'factored'), waveText({ ...w, C: addExact(w.C, P) }, 'factored')]
  if (!isZero(w.C)) out.push(waveText(w, 'expanded'), waveText(co, 'expanded'))
  return out
}

const trap = (id: TrigPartTrap['id'], w: Wave, witness: string, form: 'factored' | 'expanded' = 'factored'): TrigPartTrap => ({ id, text: waveText(w, form), witness })

const W = {
  span: 'Your amplitude is the whole height from the lowest point to the highest. The amplitude is half of that: from the midline up to the top.',
  half: 'Your graph repeats twice as fast as this one. From a highest point to the next lowest is half a period, so the period is twice that distance.',
  quarter: 'Your graph repeats four times as fast as this one. From a highest point down to the midline is only a quarter of a period.',
  bAsPeriod: 'Your equation puts the period where B goes. B is 2π divided by the period, so a long period means a small B.',
  low: 'Your midline is at the lowest height. The midline is halfway between the highest and lowest points: their average.',
  high: 'Your midline is at the highest height. The midline is halfway between the highest and lowest points: their average.',
  reflection: 'Your graph is the mirror image of this one across its midline: where this one goes down, yours goes up. Check which way the curve goes from where your cycle starts.',
  wrongWay: 'Your graph is shifted the wrong way. Inside the function, x minus a number moves the graph right and x plus a number moves it left.',
  notDivided: 'Your equation subtracts the shift from Bx, which moves the graph only the shift divided by B. Shift x itself: B times (x minus the shift).',
  timesB: 'Your B is the period divided by 2π, upside down: B is 2π divided by the period.',
  vertical: 'Your graph moves the other way up or down: a shift down subtracts at the end, a shift up adds.',
}

export interface EquationFromGraph {
  mode: 'graph'
  /** The amplitude (positive), B, the midline, and the x of the labelled highest point. */
  A: number | [number, number]
  B: TrigExact
  D: number
  high: TrigExact
  /** Label the highest point first, or the lowest point first (the next highest after it). */
  first: 'high' | 'low'
  periods: 1 | 2
}

export interface EquationFromWords {
  mode: 'words'
  fn: 'sin' | 'cos'
  A: number | [number, number]
  B: TrigExact
  shift: TrigExact
  D: number
}

const qOfA = (a: number | [number, number]) => (typeof a === 'number' ? q(a) : q(a[0], a[1]))

/** The sg.equation problem (exported for the hand-worked tests). */
export function equationProblem(o: EquationFromGraph | EquationFromWords): SgDrafted {
  const A = qOfA(o.A)
  const D = q(o.D)
  const P = wavePeriod({ fn: 'cos', A, B: o.B, C: exactOfQ(q(0)), D })
  const Pn = exactNum(P)
  let answer: Wave
  let prompt: string
  let figure: SgDrafted['figure']
  let graph: SgDrafted['graph']
  let traps: TrigPartTrap[]
  let reveal: string[]
  let calc: CalcPanels
  let givens: SgDrafted['givens'] = []
  if (o.mode === 'graph') {
    answer = { fn: 'cos', A, B: o.B, C: o.high, D }
    const low = addExact(o.high, halfOf(P))
    const top = exactQ(q(o.D * A.d + A.n, A.d))
    const bottom = exactQ(q(o.D * A.d - A.n, A.d))
    // The window: a quarter period before the first labelled point, one or two periods long.
    const firstX = o.first === 'high' ? o.high : addExact(o.high, exactNeg(halfOf(P)))
    const secondX = o.first === 'high' ? low : o.high
    const start = exactNum(firstX) - Pn / 4
    const window: [number, number] = [start, start + o.periods * Pn]
    const firstPt = o.first === 'high' ? { x: firstX, y: top } : { x: firstX, y: bottom }
    const secondPt = o.first === 'high' ? { x: secondX, y: bottom } : { x: secondX, y: top }
    const markers = [firstPt, secondPt].map((p) => ({ x: exactNum(p.x), y: exactNum(p.y), label: pointLabel(p.x, p.y), labelSide: exactNum(p.y) > o.D ? ('above' as const) : ('below' as const) }))
    const shown = waveGraph(answer, { window, markers, ariaLabel: `A wave-shaped graph. ${o.first === 'high' ? 'A highest point' : 'A lowest point'} is labelled ${markers[0]!.label} and the next ${o.first === 'high' ? 'lowest' : 'highest'} point is labelled ${markers[1]!.label}.` })
    figure = { kind: 'graph', deg: 0, label: '', graph: shown, ariaLabel: shown.ariaLabel! }
    graph = NO_GRAPH
    prompt = 'The graph below is a sinusoid. Write an equation for it, using sine or cosine.'
    traps = [
      trap('trig_amplitude_as_span', { ...answer, A: q(2 * A.n, A.d) }, W.span),
      trap('trig_period_half', { ...answer, B: times(o.B, 2) }, W.half),
      trap('trig_period_quarter', { ...answer, B: times(o.B, 4) }, W.quarter),
      trap('trig_b_as_period', { ...answer, B: P }, W.bAsPeriod),
      trap('trig_midline_at_extreme', { ...answer, D: exactRationalOf(bottom) }, W.low),
      trap('trig_midline_at_extreme', { ...answer, D: exactRationalOf(top) }, W.high),
      trap('trig_reflection_missed', { ...answer, A: qNeg(A) }, W.reflection),
      ...(isZero(o.high) ? [] : [trap('trig_shift_wrong_way', { ...answer, C: exactNeg(o.high) }, W.wrongWay)]),
    ]
    reveal = [
      `The midline is halfway between the heights: ${m(`D = \\frac{${exactTex(top)} + \\left(${exactTex(bottom)}\\right)}{2} = ${qTex(D)}`)}, and the amplitude is half the difference: ${m(`A = \\frac{${exactTex(top)} - \\left(${exactTex(bottom)}\\right)}{2} = ${qTex(A)}`)}.`,
      `From the highest point to the next lowest is half a period, ${m(exactTex(halfOf(P)))}, so the period is ${m(exactTex(P))} and ${m(`B = \\frac{2\\pi}{${exactTex(P)}} = ${exactTex(o.B)}`)}.`,
      `A cosine starts its cycle at a highest point, ${m(`x = ${exactTex(o.high)}`)}: ${m(waveTex(answer, 'factored'))}.`,
    ]
    calc = equationCalc(markers, answer.B.pi === 1 || answer.C.pi === 1)
    givens = markers.flatMap((mk) => [
      { value: mk.x, sources: [] },
      { value: mk.y, sources: [] },
    ])
  } else {
    answer = { fn: o.fn, A, B: o.B, C: o.shift, D }
    const parts: string[] = []
    if (!isZero(o.shift)) parts.push(`${m(exactTex(exactNum(o.shift) < 0 ? exactNeg(o.shift) : o.shift))} to the ${exactNum(o.shift) < 0 ? 'left' : 'right'}`)
    if (o.D !== 0) parts.push(`${m(String(Math.abs(o.D)))} ${Math.abs(o.D) === 1 ? 'unit' : 'units'} ${o.D < 0 ? 'down' : 'up'}`)
    const moved = parts.length ? `, shifted ${parts.join(' and ')}` : ''
    prompt = `Write an equation of a ${o.fn === 'sin' ? 'sine' : 'cosine'} curve with amplitude ${m(qTex(A))} and period ${m(exactTex(P))}${moved}.`
    figure = { kind: 'none', deg: 0, label: '', ariaLabel: '' }
    const start = exactNum(o.shift) - Pn / 4
    graph = waveGraph(answer, { window: [start, start + 2 * Pn] })
    traps = [
      ...(isZero(o.shift)
        ? []
        : [
            trap('trig_shift_wrong_way', { ...answer, C: exactNeg(o.shift) }, W.wrongWay),
            ...(o.B.pi === 0 && exactNum(o.B) !== 1 ? [trap('trig_shift_not_divided', { ...answer, C: exactDiv(o.shift, o.B) }, W.notDivided, 'expanded')] : []),
          ]),
      trap('trig_b_as_period', { ...answer, B: P }, W.bAsPeriod),
      ...(P.pi === 1 ? [trap('trig_period_times_b', { ...answer, B: exactDiv(P, exactPi(q(2))) }, W.timesB)] : []),
      ...(o.D === 0 ? [] : [trap('trig_vertical_shift_sign', { ...answer, D: q(-o.D) }, W.vertical)]),
    ]
    reveal = [
      `${m(`A = ${qTex(A)}`)}, and the period gives ${m(`B = \\frac{2\\pi}{${exactTex(P)}} = ${exactTex(o.B)}`)}.`,
      `${isZero(o.shift) ? 'With no phase shift' : `The phase shift is ${m(`C = ${exactTex(o.shift)}`)}`}${o.D === 0 ? ', and the midline is the x-axis' : `, and the vertical shift is ${m(`D = ${qTex(D)}`)}`}: ${m(waveTex(answer, 'factored'))}.`,
    ]
    calc = equationCalc([], answer.B.pi === 1 || answer.C.pi === 1)
    givens = [
      { value: Math.abs(A.n / A.d), sources: [] },
      { value: Pn, sources: [] },
      { value: Math.abs(exactNum(o.shift)), sources: [] },
      { value: Math.abs(o.D), sources: [] },
    ]
  }
  const check = functionCheck(waveText(answer, 'factored'), 'x', keyXs(answer), exactNum(answer.C) - Pn / 4, exactNum(answer.C) + (7 * Pn) / 4)
  const part: TrigPart = {
    id: 'equation',
    kind: 'function',
    label: 'Equation',
    ask: o.mode === 'graph' ? 'What is an equation for the graph?' : 'What is an equation for the curve?',
    formatHint: SG_EQUATION_HINT,
    nudge:
      o.mode === 'graph'
        ? `Read the amplitude, the midline and half a period off the two labelled points; then ${m('B = \\frac{2\\pi}{\\text{period}}')}, and a cosine starts at a highest point.`
        : `Put the numbers into ${m(`y = A\\${o.fn}\\left(B\\left(x - C\\right)\\right) + D`)}: ${m('B = \\frac{2\\pi}{\\text{period}}')}, ${m('C')} the phase shift (right is positive), ${m('D')} the vertical shift (up is positive).`,
    ruleCard: o.mode === 'graph' ? SG_RULE_IDS.fromGraph : SG_RULE_IDS.period,
    reveal,
    answerText: check.answer,
    forms: sameForms(check, equalSpellings(answer)),
    check,
    wrongNote: o.mode === 'graph' ? 'That equation does not give this graph. Check the amplitude, the period, the midline and where a cycle starts.' : 'That equation does not fit the description. Check each number: amplitude, period, phase shift and vertical shift.',
    traps: distinctFunctionTraps(check, traps),
  }
  return {
    question: 'equation',
    prompt,
    figure,
    stages: [part],
    promisable: part.traps,
    calc,
    ruleCards: [SG_RULE_IDS.fromGraph, SG_RULE_IDS.amplitude, SG_RULE_IDS.period, SG_RULE_IDS.shift],
    graph,
    givens,
  }
}

function exactRationalOf(v: TrigExact) {
  return v.c
}

/**
 * The calculator checks her own equation against the labelled points; it never types the answer. Where π is, only when
 * her equation has a π in it (a period without π, or a shift with one).
 */
function equationCalc(markers: { x: number; y: number; label: string }[], usesPi: boolean): CalcPanels {
  const at = markers.map((mk) => `X = ${Number(mk.x.toFixed(4))} should give Y = ${Number(mk.y.toFixed(4))}`).join('; ')
  return {
    ti84: [
      tiMode('rad'),
      { title: 'Enter your equation', keys: 'Y= → Y1 = your equation → ENTER', why: `X,T,θ,n types x.${usesPi ? ' π is 2nd ^.' : ''}` },
      { title: 'Check it', keys: '2nd TRACE (CALC) → 1:value → type an x → ENTER', why: at ? `At the labelled points: ${at}.` : 'Graph it with ZOOM 7:ZTrig and check the amplitude, period and shifts against the description.' },
    ],
    nspire: [nspireMode('rad'), { title: 'Enter your equation', keys: 'menu → Graph → f1(x) = your equation → enter', why: usesPi ? 'π is the π key.' : 'f1 is your equation.' }],
  }
}

const A_POOL: readonly [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 1],
  [3, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [3, 2],
]
const B_RATIONAL: readonly [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [1, 3],
  [2, 3],
]
const B_PI: readonly [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
]

export function drawEquation(rng: Rng): SgDrafted {
  const a = drawA(rng, A_POOL, 0)
  const A: [number, number] = [a.n, a.d]
  const B = drawB(rng, B_RATIONAL, B_PI, 0.2)
  const D = rng.chance(0.2) ? 0 : rng.pick([-3, -2, -1, 1, 2, 3])
  if (rng.chance(0.6)) {
    const P = wavePeriod({ fn: 'cos', A: a, B, C: exactOfQ(q(0)), D: q(D) })
    const high = times(quarterOf(P), rng.pick([-2, -1, 0, 1, 1, 2, 3]))
    return equationProblem({ mode: 'graph', A, B, D, high, first: rng.chance(0.65) ? 'high' : 'low', periods: rng.chance(0.5) ? 1 : 2 })
  }
  const shift = rng.chance(0.15) ? tx(q(0), 1, B.pi === 1 ? 0 : 1) : shiftOf(B, drawInner(rng))
  return equationProblem({ mode: 'words', fn: rng.pick(['sin', 'cos'] as const), A, B, shift: isZero(shift) ? exactOfQ(q(0)) : shift, D })
}
