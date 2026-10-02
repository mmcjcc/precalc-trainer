/**
 * Completing the square: choosing a quadratic, checking it against the engine, and turning it into a
 * ProblemInstance. The templates pick coefficients only. The vertex form, the vertex, the axis, the worked
 * path and every candidate mistake come from `src/engine/polynomials`; nothing is worked out here.
 */
import { convertExpr, keyedNum } from '@/content/calc/format'
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, DifficultyKnobs, ProblemInstance } from '@/content/types'
import {
  axisMistakes,
  checkSquareLine,
  compileExpr,
  completeSquare,
  gradeAxisOfSymmetry,
  gradeVertex,
  gradeVertexForm,
  squareMistakes,
  verifyRewrite,
  vertexMistakes,
} from '@/engine'
import type { CompletedSquare, PolyMistakeKind } from '@/engine'
import { ratToNumber, ratToString } from '@/notation'
import type { CalcPanels, GraphSpec } from '@/shared/types'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { gradeExtremum, gradeOpens } from './grade'
import { CS_RULE_IDS, csRuleIdFor } from './rules'

export const QD_MODULE_ID = 'quadratics' as const

export type QuadraticsAnswer = Extract<AnswerSpec, { type: 'quadratics' }>
export type QuadraticsQuestion = QuadraticsAnswer['question']

/** Coefficients from the highest power down. a is text so 1/2 stays exact; b and c are integers. */
export type QuadCoefficients = readonly [a: string, b: number, c: number]

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

/**
 * a = 1 about a third of the time. Otherwise 3, −2, −1 and 1/2 before 2: with a = 2, b/2 equals b/a, so one
 * "halved wrong" form hides behind "did not factor a out" (polynomials-core.md §5).
 */
const LEADS: readonly { a: string; weight: number }[] = [
  { a: '1', weight: 7 },
  { a: '3', weight: 3 },
  { a: '-2', weight: 3 },
  { a: '-1', weight: 3 },
  { a: '1/2', weight: 2 },
  { a: '2', weight: 1 },
]

function pickLead(rng: Rng, allow: (a: string) => boolean): string {
  const pool = LEADS.filter((l) => allow(l.a))
  let roll = rng.next() * pool.reduce((sum, l) => sum + l.weight, 0)
  for (const l of pool) {
    roll -= l.weight
    if (roll < 0) return l.a
  }
  return pool[pool.length - 1]!.a
}

/** Distinct mistake kinds the engine lists for the question, in its priority order. */
export function quadTrapKinds(f: QuadCoefficients | string, question: QuadraticsQuestion): PolyMistakeKind[] {
  const kinds: PolyMistakeKind[] = []
  const add = (list: readonly { kind: PolyMistakeKind }[] | null) => {
    for (const c of list ?? []) if (!kinds.includes(c.kind)) kinds.push(c.kind)
  }
  if (question === 'form') add(squareMistakes(f))
  else {
    add(vertexMistakes(f))
    add(axisMistakes(f))
  }
  return kinds
}

const checked = new Map<string, string | null>()

/**
 * The self-tests of polynomials-core.md §5 for one quadratic. Returns null when all pass, else what failed.
 * Cached per f: the engine's answers do not change between calls.
 */
export function quadSelfTest(f: QuadCoefficients | string, seed = 1): string | null {
  const key = typeof f === 'string' ? f : f.join(',')
  const cached = checked.get(key)
  if (cached !== undefined) return cached
  const result = runSelfTest(f, seed)
  checked.set(key, result)
  return result
}

function runSelfTest(f: QuadCoefficients | string, seed: number): string | null {
  const m = completeSquare(f)
  if (!m) return 'completeSquare returned null'
  if (m.path.length < 2) return 'already vertex form: the path has one line'
  if (gradeVertexForm(f, m.vertexForm).verdict !== 'correct') return `vertex form ${m.vertexForm} does not grade correct`
  if (gradeVertex(f, m.vertexText).verdict !== 'correct') return `vertex ${m.vertexText} does not grade correct`
  if (gradeAxisOfSymmetry(f, m.axisText).verdict !== 'correct') return `axis ${m.axisText} does not grade correct`
  if (gradeOpens(f, m.opens).verdict !== 'correct') return `opens ${m.opens} does not grade correct`
  if (gradeExtremum(f, m.extremum.kind, ratToString(m.extremum.value)).verdict !== 'correct') return 'the extremum does not grade correct'
  if (m.explanation.length !== m.path.length + 2) return 'the explanation is not the path reasons plus three closing lines'
  for (let i = 0; i < m.path.length; i++) {
    const line = m.path[i]!
    const g = checkSquareLine(f, line.text)
    if (g.verdict !== 'correct') return `path line "${line.text}" is ${g.verdict}`
    const last = i === m.path.length - 1
    if (g.done !== last) return `path line "${line.text}" has done = ${String(g.done)}`
    if (i > 0) {
      const prev = m.path[i - 1]!.text
      if (!verifyRewrite(prev, line.text, { vars: ['x'], seed }).ok) return `"${prev}" → "${line.text}" is not an accepted rewrite`
    }
  }
  return null
}

export interface QuadDraft {
  coefficients: QuadCoefficients
  m: CompletedSquare
  /** h is not a whole number (odd b/a). */
  fractionalH: boolean
}

/**
 * Draw a quadratic for either question. b/a is even (a whole-number h) unless `fractionalH`. Redrawn until
 * the engine says: b ≠ 0, the vertex is off both axes and off y = x (so the sign and the swapped-coordinates
 * slips each give a different point), and k is small enough to graph.
 */
export function drawQuadratic(rng: Rng, fractionalH: boolean): QuadDraft {
  for (let tries = 0; tries < 60; tries++) {
    // Fractional h keeps a whole: half of an odd number is already a fraction.
    const a = pickLead(rng, (lead) => !fractionalH || lead !== '1/2')
    const big = a === '1' || a === '-1'
    let p: number
    if (fractionalH) p = rng.sign() * rng.pick(big ? [1, 3, 5, 7] : [1, 3, 5])
    else if (a === '1/2') p = rng.sign() * rng.pick([4, 8])
    else p = rng.sign() * 2 * rng.int(1, big ? 5 : 3)
    const c = rng.intExcept(-12, 12, [0])
    // b = a·p. For a = 1/2, p is a multiple of 4, so b is a whole number.
    const b = a === '1/2' ? p / 2 : Number(a) * p
    const coefficients: QuadCoefficients = [a, b, c]
    const m = completeSquare(coefficients)
    if (!m) continue
    if (m.k.n === 0 || Math.abs(ratToNumber(m.k)) > 40) continue
    const kinds = (vertexMistakes(coefficients) ?? []).map((cand) => cand.kind)
    if (!kinds.includes('cs_h_sign') || !kinds.includes('cs_vertex_swapped')) continue
    return { coefficients, m, fractionalH }
  }
  throw new Error('quadratics: no quadratic passed the filters in 60 draws')
}

/** A window around the vertex that also shows the origin, and the curve sampled so it passes through the vertex. */
export function parabolaGraph(m: CompletedSquare): GraphSpec & { xDomain: [number, number]; yDomain: [number, number] } {
  const h = ratToNumber(m.h)
  const k = ratToNumber(m.k)
  const up = m.opens === 'up'
  const xLo = Math.min(Math.floor(h) - 5, -1)
  const xHi = Math.max(Math.ceil(h) + 5, 1)
  const yLo = Math.min(Math.floor(k) - (up ? 2 : 12), -1)
  const yHi = Math.max(Math.ceil(k) + (up ? 12 : 2), 1)
  const f = compileExpr(m.f)
  const samples: { x: number; y: number }[] = []
  // Twelve samples per unit: a whole or half-integer h lands on a sample.
  const count = (xHi - xLo) * 12
  for (let i = 0; i <= count; i++) {
    const x = xLo + i / 12
    const y = f({ x })
    if (y !== 'undef' && Number.isFinite(y)) samples.push({ x, y })
  }
  return {
    kind: 'function',
    f: m.f,
    samples,
    markers: [{ x: h, y: k, label: polyShow(m.vertexText), labelSide: up ? 'below' : 'above' }],
    xDomain: [xLo, xHi],
    yDomain: [yLo, yHi],
  }
}

/** Checking the vertex with the calculator's minimum / maximum tool. Shown behind the reveal gate. */
export function vertexCalc(m: CompletedSquare): CalcPanels {
  const g = parabolaGraph(m)
  const [xLo, xHi] = g.xDomain
  const [yLo, yHi] = g.yDomain
  const tool = m.extremum.kind
  const vertex = polyShow(m.vertexText)
  const negativeLead = m.opens === 'down'
  const numeric = `The calculator searches by trial, so it may show something like ${approx(ratToNumber(m.h))} for X. Your exact work decides the answer: the vertex is ${vertex}.`
  return {
    ti84: [
      {
        title: 'Enter Y1',
        keys: `Y= → Y1 = ${convertExpr('ti84', m.f)}`,
        caution: negativeLead ? 'Start with the (−) key at the bottom, not the subtraction key.' : undefined,
      },
      {
        title: 'Set a window that shows the turn',
        keys: `WINDOW: Xmin = ${keyedNum('ti84', xLo)}, Xmax = ${keyedNum('ti84', xHi)}, Ymin = ${keyedNum('ti84', yLo)}, Ymax = ${keyedNum('ti84', yHi)}. Then GRAPH.`,
        why: 'ZStandard stops at ±10, and this turning point may be outside it.',
      },
      {
        title: `Find the ${tool}`,
        keys: `2nd TRACE (CALC) → ${tool === 'minimum' ? '3:minimum' : '4:maximum'}. Move the cursor left of the turn and press ENTER, move it right of the turn and press ENTER, then ENTER once more for the guess.`,
        why: `The bottom of the screen shows X and Y at the turning point. X is h and Y is k, the ${tool} value: compare them with your vertex.`,
        caution: numeric,
      },
    ],
    nspire: [
      {
        title: 'Graph f1',
        keys: `ctrl+G → f1(x) = ${convertExpr('nspire', m.f)} → enter`,
      },
      {
        title: 'Set a window that shows the turn',
        keys: `menu → Window/Zoom → Window Settings: XMin = ${keyedNum('nspire', xLo)}, XMax = ${keyedNum('nspire', xHi)}, YMin = ${keyedNum('nspire', yLo)}, YMax = ${keyedNum('nspire', yHi)}, OK.`,
        why: 'The standard window stops at ±10, and this turning point may be outside it.',
      },
      {
        title: `Find the ${tool}`,
        keys: `menu → Analyze Graph → ${tool === 'minimum' ? 'Minimum' : 'Maximum'}. Click left of the turn for the lower bound, then right of it for the upper bound.`,
        why: `The point is labelled with its coordinates (h, k). k is the ${tool} value: compare them with your vertex.`,
        caution: numeric,
      },
    ],
  }
}

/** What a numeric search typically shows for h: just short of the exact value. */
function approx(h: number): string {
  const shown = (h - 4e-7).toFixed(7)
  return shown.replace('-', '−')
}

export interface QuadBuild {
  question: QuadraticsQuestion
  templateId: string
  version: number
  seed: number
  knobs: DifficultyKnobs
  title: string
  instructions: string
  prompt: string
  nudge: string
  draft: QuadDraft
  trap: PolyMistakeKind
  /** Rule cards after the one that answers the trap. */
  ruleCards: string[]
}

export function buildQuadratic(d: QuadBuild): ProblemInstance {
  const { coefficients, m, fractionalH } = d.draft
  const where = `${d.templateId}/${d.seed}`
  const problem = quadSelfTest(coefficients, d.seed)
  if (problem) throw new Error(`${where}: ${problem}`)
  // The promised trap has to be one the engine would actually name for this problem.
  if (!quadTrapKinds(coefficients, d.question).includes(d.trap)) throw new Error(`${where}: trap ${d.trap} is not a candidate`)

  const primary = csRuleIdFor(d.trap) ?? CS_RULE_IDS.half
  const ruleCards = [primary, ...d.ruleCards.filter((id) => id !== primary)]
  const steps = m.path.slice(1)
  const closing = m.explanation.slice(steps.length)
  const reveal = d.question === 'form' ? [...steps.map((line) => `${line.reason} You now have ${polyShow(line.text)}.`), closing[0]!] : m.explanation
  const extremumText = ratToString(m.extremum.value)
  const expectedDisplay =
    d.question === 'form'
      ? polyShow(m.vertexForm)
      : `vertex ${polyShow(m.vertexText)}; axis of symmetry ${polyShow(m.axisText)}; opens ${m.opens}; ${m.extremum.kind} value ${polyShow(extremumText)}`

  return {
    id: problemId(QD_MODULE_ID, d.templateId, d.version, d.seed),
    moduleId: QD_MODULE_ID,
    templateId: d.templateId,
    skill: d.templateId,
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'quadratics',
    title: d.title,
    instructions: d.instructions,
    statementText: m.f,
    vars: ['x'],
    start: d.question === 'form' ? m.f : null,
    canonical: [],
    answer: {
      type: 'quadratics',
      question: d.question,
      f: m.f,
      prompt: d.prompt,
      vertexForm: m.vertexForm,
      vertexText: m.vertexText,
      axisText: m.axisText,
      opens: m.opens,
      extremumKind: m.extremum.kind,
      extremumText,
      path: m.path.map((line) => ({ text: line.text, reason: line.reason })),
      expectedDisplay,
      nudge: d.nudge,
      ruleCard: primary,
      ruleCards,
      reveal,
      trap: d.trap,
      graph: parabolaGraph(m),
    },
    // The rail's graph panel can be opened before she finishes, so the parabola is not put there.
    graph: { kind: 'none' },
    calc: d.question === 'vertex' ? vertexCalc(m) : NO_CALC,
    params: {
      question: d.question,
      a: coefficients[0],
      b: coefficients[1],
      c: coefficients[2],
      trap: d.trap,
      fractionalH,
    },
  }
}
