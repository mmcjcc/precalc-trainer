/**
 * og.match: which of four graphs is the given equation (tan, cot, sec, csc and sinusoids mixed). The three wrong graphs
 * are named slips, each the equation with one thing wrong: the period inverted (drawn with period 2πB, not 2π/B), the
 * reflection missed, the shift the wrong way, the cofunction drawn (tan for cot, sec for csc, sin for cos), the vertical
 * shift the wrong way. A card never announces its formula (GraphSpec.ariaLabel "Graph A"); the right graph's place is
 * the seed's shuffle, so each place gets about a quarter of the problems.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart, TrigPartTrap } from '@/content/types'
import { exactDiv, exactNeg, exactNum, exactQ, isSinusoid, isZero, q, qNeg, wavePeriod, waveTex, waveText, waveValue, type Wave, type WaveFn, type WaveForm } from '@/engine/trig'
import { LogSkip } from '../explog/text'
import { NO_GRAPH } from '../trig/build5'
import { waveCalc } from '../trig/calc5'
import { waveGraph, waveYWindow } from '../trig/graph5'
import { m } from '../trig/text'
import { drawA, drawB, drawInner, exactOfQ, shiftOf } from '../trig/wave5'
import type { OgDrafted } from './features'
import { OG_RULE_IDS } from './rules'
import { OG_MATCH_HINT } from './words'

const LETTERS = ['A', 'B', 'C', 'D'] as const
const CO: Record<WaveFn, WaveFn> = { sin: 'cos', cos: 'sin', tan: 'cot', cot: 'tan', sec: 'csc', csc: 'sec' }

type SlipId = 'trig_period_times_b' | 'trig_reflection_missed' | 'trig_shift_wrong_way' | 'trig_cofunction_graph' | 'trig_vertical_shift_sign'

interface Candidate {
  wave: Wave
  slip: { id: SlipId; witness: (letter: string) => string } | null
}

/** The slips' graphs that exist for this equation, in a fixed order. */
export function matchSlips(w: Wave): Candidate[] {
  const out: Candidate[] = []
  if (exactNum(w.B) !== 1) {
    out.push({
      wave: { ...w, B: exactDiv(exactQ(q(1)), w.B) },
      slip: { id: 'trig_period_times_b', witness: (l) => `Graph ${l} has its period multiplied by B instead of divided by it, so its cycles are ${exactNum(w.B) > 1 ? 'much longer' : 'much shorter'} than this equation’s.` },
    })
  }
  out.push({
    wave: { ...w, A: qNeg(w.A) },
    slip: { id: 'trig_reflection_missed', witness: (l) => `Graph ${l} is flipped over its midline: ${w.A.n < 0 ? 'it leaves out the minus sign in front' : 'it has a minus sign the equation does not have'}, so it goes up where this graph goes down.` },
  })
  if (!isZero(w.C)) {
    out.push({
      wave: { ...w, C: exactNeg(w.C) },
      slip: { id: 'trig_shift_wrong_way', witness: (l) => `Graph ${l} is shifted the wrong way: its cycles start on the other side, as if the sign inside were turned around.` },
    })
  }
  out.push({
    wave: { ...w, fn: CO[w.fn] },
    slip: { id: 'trig_cofunction_graph', witness: (l) => `Graph ${l} is the graph of ${CO[w.fn]}, not ${w.fn}: look at what it does where a cycle starts.` },
  })
  if (w.D.n !== 0) {
    out.push({
      wave: { ...w, D: qNeg(w.D) },
      slip: { id: 'trig_vertical_shift_sign', witness: (l) => `Graph ${l} is moved ${w.D.n > 0 ? 'down' : 'up'}, where the number added at the end moves it ${w.D.n > 0 ? 'up' : 'down'}.` },
    })
  }
  return out
}

/** Do two graphs look different in the window (heights apart at a fifth or more of the points)? */
export function lookApart(a: Wave, b: Wave, window: [number, number], yWindow: [number, number]): boolean {
  const span = yWindow[1] - yWindow[0]
  let apart = 0
  let seen = 0
  for (let i = 0; i <= 400; i++) {
    const x = window[0] + ((window[1] - window[0]) * (i + 0.37)) / 401
    const ya = waveValue(a, x)
    const yb = waveValue(b, x)
    const inA = Number.isFinite(ya) && ya >= yWindow[0] && ya <= yWindow[1]
    const inB = Number.isFinite(yb) && yb >= yWindow[0] && yb <= yWindow[1]
    if (!inA && !inB) continue
    seen++
    if (inA !== inB || Math.abs(ya - yb) > 0.06 * span) apart++
  }
  return seen > 0 && apart / seen >= 0.2
}

export interface MatchInput {
  wave: Wave
  form: WaveForm
  /** Indexes into matchSlips(wave): the three wrong graphs. */
  slips: [number, number, number]
  /** The candidate shown in each place, A to D: a permutation of 0..3, candidate 0 being the right graph. */
  order: [number, number, number, number]
}

/** The og.match problem (exported for the hand-worked tests). */
export function matchProblem(o: MatchInput): OgDrafted {
  const w = o.wave
  const all = matchSlips(w)
  const cands: Candidate[] = [{ wave: w, slip: null }, ...o.slips.map((i) => all[i]!)]
  const P = exactNum(wavePeriod(w))
  const c0 = exactNum(w.C)
  const window: [number, number] = [c0 - P, c0 + P]
  const ys = cands.map((c) => waveYWindow(c.wave))
  const yWindow: [number, number] = [Math.min(...ys.map((y) => y[0])), Math.max(...ys.map((y) => y[1]))]
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) if (!lookApart(cands[i]!.wave, cands[j]!.wave, window, yWindow)) throw new LogSkip('two candidate graphs look alike')
  }
  const placed = o.order.map((i) => cands[i]!)
  const right = LETTERS[placed.findIndex((c) => c.slip === null)]!
  const traps: TrigPartTrap[] = []
  placed.forEach((c, i) => {
    if (c.slip) traps.push({ id: c.slip.id, text: LETTERS[i]!, witness: c.slip.witness(LETTERS[i]!) })
  })
  const graphs = placed.map((c, i) => ({
    letter: LETTERS[i]!,
    graph: waveGraph(c.wave, { window, yWindow, asymptotes: !isSinusoid(c.wave.fn), ariaLabel: `Graph ${LETTERS[i]!}` }),
    formula: waveText(c.wave, 'factored'),
  }))
  const fnWord = w.fn
  const part: TrigPart = {
    id: 'match',
    kind: 'choice',
    label: 'The matching graph',
    ask: 'Which graph is the graph of the equation?',
    formatHint: OG_MATCH_HINT,
    choices: LETTERS.map((l) => ({ value: l, label: `Graph ${l}` })),
    nudge: 'Check the period first, then where a cycle starts, then which way the graph goes there, then the vertical shift.',
    ruleCard: OG_RULE_IDS.match,
    reveal: [
      `The period is ${m(`${isSinusoid(w.fn) || w.fn === 'sec' || w.fn === 'csc' ? '\\frac{2\\pi}{B}' : '\\frac{\\pi}{B}'}`)}, ${w.D.n === 0 ? 'with no vertical shift' : `with the midline moved ${w.D.n > 0 ? 'up' : 'down'}`}${isZero(w.C) ? '' : ', and a phase shift'}; ${w.A.n < 0 ? `the minus sign flips the ${fnWord} graph over its midline` : `the ${fnWord} graph is not flipped`}.`,
      `That is graph ${right}.`,
    ],
    answerText: right,
    forms: [],
    check: { kind: 'choice' },
    wrongNote: 'That graph does not match. Compare the period, the shift, the sign of A and the vertical shift, one at a time.',
    traps,
  }
  return {
    question: 'match',
    prompt: 'Which of the four graphs is the graph of the function below?',
    display: m(waveTex(w, o.form)),
    figure: { kind: 'match', deg: 0, label: '', graphs, ariaLabel: 'Four graphs, A to D.' },
    stages: [part],
    promisable: traps,
    calc: waveCalc(w, { window, yWindow, find: 'match' }),
    ruleCards: [OG_RULE_IDS.match, OG_RULE_IDS.period, OG_RULE_IDS.asymptotes],
    graph: NO_GRAPH,
    givens: [],
  }
}

const A_POOL: readonly [number, number][] = [
  [1, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
]
const B_RATIONAL: readonly [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 1],
  [3, 1],
  [1, 2],
  [1, 3],
]

export function drawMatch(rng: Rng): OgDrafted {
  const fn = rng.pick(['tan', 'tan', 'tan', 'cot', 'cot', 'sec', 'sec', 'csc', 'csc', 'sin', 'sin', 'cos', 'cos'] as const)
  const A = drawA(rng, A_POOL, 0.35)
  const B = drawB(rng, B_RATIONAL, [], 0)
  const C = rng.chance(0.35) ? exactOfQ(q(0)) : shiftOf(B, drawInner(rng))
  const D = q(rng.chance(0.5) ? 0 : rng.pick([-2, -1, 1, 2]))
  const form: WaveForm = isZero(C) ? 'factored' : rng.chance(0.5) ? 'expanded' : 'factored'
  const w: Wave = { fn, A, B, C, D }
  const slips = matchSlips(w)
  if (slips.length < 3) throw new LogSkip('fewer than three slips for this equation')
  const picked = rng.shuffle(slips.map((_s, i) => i)).slice(0, 3) as [number, number, number]
  const order = rng.shuffle([0, 1, 2, 3]) as [number, number, number, number]
  return matchProblem({ wave: w, form, slips: picked, order })
}
