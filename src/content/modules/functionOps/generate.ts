/**
 * Operations with functions. Three templates, one answer each.
 * Every seed promises one unambiguous trap: the slip is computed for this problem, it is not the
 * right answer, and no other mistake id lands on the same value. The preferred trap is tried first;
 * if a seed cannot reach it, the first other unambiguous slip is promised instead.
 */
import { problemId } from '@/content/registry'
import { makeRng, type Rng } from '@/content/rng'
import type { AnswerSpec, DifficultyKnobs, FunctionOpsOp, ProblemInstance, TemplateDef } from '@/content/types'
import type { CalcPanels, GraphSample } from '@/shared/types'
import { polyExpr } from '../fnExpr'
import { assessOps, gradeFunctionOps, opsSlips, showNum, uniqueSlips, type OpsData, type OpsPoint } from './ops'
import { OPS_RULE_FOR, cardForOp, nudgeFor, opCall, promptFor, type OpsMistakeId } from './rules'

const VERSION = 1
const TRIES = 80
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const TABLE_TRAPS = [
  'op_wrong_function',
  'op_difference_reversed',
  'op_quotient_flipped',
  'op_order_reversed',
  'op_product_for_composition',
  'op_composition_for_product',
  'op_undefined_missed',
] as const satisfies readonly OpsMistakeId[]

const GRAPH_TRAPS = [
  'op_sign_flipped',
  'op_wrong_function',
  'op_difference_reversed',
  'op_quotient_flipped',
  'op_order_reversed',
  'op_product_for_composition',
  'op_composition_for_product',
  'op_undefined_missed',
] as const satisfies readonly OpsMistakeId[]

const FORMULA_TRAPS = [
  'op_wrong_function',
  'op_difference_reversed',
  'op_quotient_flipped',
  'op_order_reversed',
  'op_product_for_composition',
  'op_composition_for_product',
  'op_minus_not_distributed',
  'op_inner_not_squared',
] as const satisfies readonly OpsMistakeId[]

const VALUE_OPS: FunctionOpsOp[] = ['f+g', 'f-g', 'g-f', 'fg', 'gg', 'fgf', 'f/g', 'f+f+g', 'fog', 'gof', 'fof', 'fogog']

type FunctionOpsAnswer = Extract<AnswerSpec, { type: 'functionOps' }>

interface Built {
  data: OpsData
  officialText: string
  trapId: OpsMistakeId
  trapAnswer: string
  reveal: string[]
}

function opsFor(want: OpsMistakeId, formula: boolean): FunctionOpsOp[] {
  switch (want) {
    case 'op_difference_reversed':
    case 'op_minus_not_distributed':
      return ['f-g', 'g-f']
    case 'op_quotient_flipped':
      return ['f/g']
    case 'op_order_reversed':
      return formula ? ['fog', 'gof'] : ['fog', 'gof', 'fogog']
    case 'op_product_for_composition':
      return formula ? ['fog', 'gof'] : ['fog', 'gof', 'fof', 'fogog']
    case 'op_composition_for_product':
      return formula ? ['fg'] : ['fg', 'gg', 'fgf']
    case 'op_inner_not_squared':
      return ['fog']
    case 'op_sign_flipped':
      return VALUE_OPS
    default:
      return formula ? ['f+g', 'f-g', 'g-f', 'f/g', 'fog', 'gof'] : VALUE_OPS
  }
}

function shownAt(at: string): string {
  if (at === 'x') return 'x'
  const n = Number(at)
  return Number.isFinite(n) ? showNum(n) : at
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

/**
 * What she would type for a slip. Integers stay integers. A quotient flipped the other way is a
 * reduced fraction ("1/2"), which the value box accepts. Anything that is not a short rational is
 * not promised.
 */
function trapText(value: number | string): string | null {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return null
  if (Number.isInteger(value)) return String(value)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  for (let den = 2; den <= 48; den++) {
    const num = Math.round(abs * den)
    if (num === 0 || Math.abs(num / den - abs) > 1e-8) continue
    const g = gcd(num, den)
    const nn = num / g
    const dd = den / g
    return dd === 1 ? sign + String(nn) : `${sign}${nn}/${dd}`
  }
  return null
}

/** First candidate whose unique slip is the one this seed wants; otherwise the first other real trap. */
function pickAt(base: OpsData, want: OpsMistakeId, candidates: readonly string[]): Built | null {
  let fallback: Built | null = null
  for (const at of candidates) {
    const built = take({ ...base, at }, want)
    if (!built) continue
    if (built.trapId === want) return built
    if (!fallback) fallback = built
  }
  return fallback
}

/**
 * A candidate the grader names as `want` when that slip is the only id on its value; otherwise the
 * most likely other unambiguous slip. Null when nothing can be promised.
 */
function take(data: OpsData, want: OpsMistakeId): Built | null {
  const assessed = assessOps(data, false)
  const formula = data.question === 'formula'
  const unique = uniqueSlips(assessed.slips, assessed.official, !formula && assessed.official === undefined)
  const trap = unique.find((s) => s.id === want) ?? unique[0]
  if (!trap) return null
  if (formula) {
    if (typeof assessed.official !== 'string' || !assessed.official) return null
    if (data.f && data.g && (data.f.includes(assessed.official) || data.g.includes(assessed.official))) return null
  } else if (trap.id === 'op_undefined_missed') {
    if (assessed.official !== undefined) return null
  } else if (typeof assessed.official !== 'number' || !Number.isInteger(assessed.official)) {
    return null
  }
  const trapAnswer = trapText(trap.value)
  if (trapAnswer === null || trapAnswer === assessed.officialText) return null
  const wrong = gradeFunctionOps(data, trapAnswer)
  if (wrong.verdict !== 'mistake' || wrong.mistake !== trap.id) return null
  const right = gradeFunctionOps(data, assessed.officialText)
  if (right.verdict !== 'correct') return null
  return { data, officialText: assessed.officialText, trapId: trap.id, trapAnswer, reveal: [] }
}

function finish(built: Built): Built {
  const full = assessOps(built.data, true)
  return { ...built, officialText: full.officialText || built.officialText, reveal: full.reveal.length > 0 ? full.reveal : built.reveal }
}

function hunt(seed: number, want: OpsMistakeId, attempt: (rng: Rng) => Built | null): Built {
  const rng = makeRng(seed >>> 0)
  let fallback: Built | null = null
  for (let n = 0; n < TRIES; n++) {
    const built = attempt(rng)
    if (!built) continue
    if (built.trapId === want) return finish(built)
    if (!fallback) fallback = built
  }
  if (fallback) return finish(fallback)
  throw new Error(`functionOps: seed ${seed} produced no trap`)
}

function sameLists(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function tableAttempt(rng: Rng, want: OpsMistakeId): Built | null {
  const pool = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8]
  const xs = rng.shuffle(pool).slice(0, 8).sort((a, b) => a - b)
  const fv = Array.from({ length: 8 }, () => rng.int(-6, 6))
  const gv = Array.from({ length: 8 }, () => rng.int(-6, 6))
  let op = rng.pick(opsFor(want, false))
  const outside = rng.intExcept(-9, 10, xs)
  const idx = rng.int(0, xs.length - 1)
  const mode = rng.int(0, 2)
  if (want !== 'op_undefined_missed' && sameLists(fv, gv)) return null

  let at = xs[idx]!
  if (want === 'op_undefined_missed') {
    if (mode === 0) {
      at = outside
    } else if (mode === 1) {
      op = 'f/g'
      gv[idx] = 0
      if (fv[idx] === 0) fv[idx] = 1
      at = xs[idx]!
    } else {
      if (op !== 'fog' && op !== 'gof' && op !== 'fof' && op !== 'fogog') op = 'fog'
      if (op === 'gof' || op === 'fof') fv[idx] = outside
      else gv[idx] = outside
      at = xs[idx]!
    }
  }

  const base: OpsData = { question: 'table', op, at: String(at), xs, fv, gv }
  if (want === 'op_undefined_missed') return take(base, want)
  const order = [at, ...xs.filter((x) => x !== at)]
  const candidates: string[] = []
  for (const a of order) {
    const looked = assessOps({ ...base, at: String(a) }, false)
    if (typeof looked.official === 'number' && Number.isInteger(looked.official)) candidates.push(String(a))
  }
  return pickAt(base, want, candidates)
}

/** Ends of a piecewise graph. `force` keeps the domain inside (−5, 5) on at least one side. Draws are fixed so every attempt consumes the same rolls. */
function ends(rng: Rng, force: boolean): { lo: number; hi: number } {
  const roll = rng.next()
  const side = rng.int(0, 2)
  const loPick = rng.int(-4, -2)
  const hiPick = rng.int(2, 4)
  if (!force && roll >= 0.65) return { lo: -5, hi: 5 }
  let lo = -5
  let hi = 5
  if (side !== 1) lo = loPick
  if (side !== 0) hi = hiPick
  if (hi - lo < 4) return { lo: -4, hi: 3 }
  return { lo, hi }
}

/** Integer vertices. Slope is an integer, so every integer x on a segment is a lattice point. */
function curve(rng: Rng, lo: number, hi: number): OpsPoint[] {
  const pts: OpsPoint[] = []
  let x = lo
  let y = rng.int(-4, 4)
  pts.push({ x, y })
  while (x < hi) {
    const step = rng.int(1, Math.min(2, hi - x))
    const options = [-2, -1, 0, 1, 2].filter((s) => {
      const ny = y + s * step
      return ny >= -5 && ny <= 5
    })
    const s = rng.pick(options)
    x += step
    y += s * step
    pts.push({ x, y })
  }
  return pts
}

function graphAttempt(rng: Rng, want: OpsMistakeId): Built | null {
  const op = rng.pick(opsFor(want, false))
  const fEnds = ends(rng, true)
  const gEnds = ends(rng, want === 'op_undefined_missed')
  const fPts = curve(rng, fEnds.lo, fEnds.hi)
  const gPts = curve(rng, gEnds.lo, gEnds.hi)
  if (JSON.stringify(fPts) === JSON.stringify(gPts)) return null
  const base: OpsData = { question: 'graph', op, at: '0', fPts, gPts }
  const pool: string[] = []
  for (let a = -5; a <= 5; a++) {
    const looked = assessOps({ ...base, at: String(a) }, false)
    const ok =
      want === 'op_undefined_missed'
        ? looked.official === undefined
        : typeof looked.official === 'number' && Number.isInteger(looked.official)
    if (ok) pool.push(String(a))
  }
  return pickAt(base, want, pool)
}

function quadratic(rng: Rng): string {
  const a = rng.pick([-3, -2, -1, 1, 2, 3])
  const b = rng.int(-5, 5)
  const c = rng.intExcept(-6, 6, [0])
  return polyExpr([c, b, a])
}

function linearF(rng: Rng): string {
  const slope = rng.pick([-3, -2, -1, 1, 2, 3])
  const c = rng.int(-5, 5)
  return polyExpr([c, slope])
}

function linearG(rng: Rng): string {
  const slope = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4])
  const c = rng.intExcept(-5, 5, [0])
  return polyExpr([c, slope])
}

function formulaAttempt(rng: Rng, want: OpsMistakeId): Built | null {
  const quad = quadratic(rng)
  const lin = linearF(rng)
  const g = linearG(rng)
  const op = rng.pick(opsFor(want, true))
  const useQuad = rng.chance(0.55)
  const forceQuad = want === 'op_inner_not_squared' || op === 'fog' || op === 'fg' || (want === 'op_minus_not_distributed' && op === 'g-f')
  const f = forceQuad || useQuad ? quad : lin
  if (f === g) return null
  return take({ question: 'formula', op, at: 'x', f, g }, want)
}

function samplesOf(pts: readonly OpsPoint[]): GraphSample[] {
  return pts.map((p) => ({ x: p.x, y: p.y }))
}

function instance(templateId: string, seed: number, knobs: DifficultyKnobs, built: Built): ProblemInstance {
  const { data } = built
  const call = opCall(data.op, shownAt(data.at))
  const question = data.question
  const prompt = promptFor(question, call)
  const primary = cardForOp(data.op)
  const trapCard = OPS_RULE_FOR[built.trapId]
  const ruleCards = primary === trapCard ? [primary] : [primary, trapCard]
  const answer: FunctionOpsAnswer = {
    type: 'functionOps',
    question,
    op: data.op,
    at: data.at,
    prompt,
    answerText: built.officialText,
    trapAnswer: built.trapAnswer,
    nudge: nudgeFor(data.op, call),
    ruleCard: primary,
    ruleCards,
    reveal: built.reveal,
    trap: built.trapId,
    ...(data.xs ? { xs: data.xs, fv: data.fv, gv: data.gv } : {}),
    ...(data.fPts ? { fPts: data.fPts, gPts: data.gPts } : {}),
    ...(data.f ? { f: data.f, g: data.g } : {}),
  }
  const statement =
    question === 'formula'
      ? `${prompt} f(x) = ${data.f}; g(x) = ${data.g}`
      : question === 'table'
        ? `${prompt} x: ${data.xs!.join(', ')}; f: ${data.fv!.join(', ')}; g: ${data.gv!.join(', ')}`
        : `${prompt} f: ${data.fPts!.map((p) => `(${p.x}, ${p.y})`).join(' ')}; g: ${data.gPts!.map((p) => `(${p.x}, ${p.y})`).join(' ')}`
  return {
    id: problemId('functionOps', templateId, VERSION, seed),
    moduleId: 'functionOps',
    templateId,
    skill: templateId,
    genVersion: VERSION,
    seed: seed >>> 0,
    knobs,
    kind: 'functionOps',
    title: call,
    instructions: prompt,
    statementText: statement,
    vars: ['x'],
    start: null,
    canonical: [],
    answer,
    graph:
      question === 'graph'
        ? {
            kind: 'function',
            samples: samplesOf(data.fPts!),
            gSamples: samplesOf(data.gPts!),
            endLabel: 'f',
            gEndLabel: 'g',
            xDomain: [-5, 5],
            yDomain: [-6, 6],
          }
        : { kind: 'none' },
    calc: NO_CALC,
    params: { trap: built.trapId, op: data.op, answerText: built.officialText, at: data.at },
  }
}

export function dataFromAnswer(answer: FunctionOpsAnswer): OpsData {
  return {
    question: answer.question,
    op: answer.op,
    at: answer.at,
    xs: answer.xs,
    fv: answer.fv,
    gv: answer.gv,
    fPts: answer.fPts,
    gPts: answer.gPts,
    f: answer.f,
    g: answer.g,
  }
}

function generateTable(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const want = TABLE_TRAPS[seed % TABLE_TRAPS.length]!
  return instance('ops.table', seed, knobs, hunt(seed, want, (rng) => tableAttempt(rng, want)))
}

function generateGraph(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const want = GRAPH_TRAPS[seed % GRAPH_TRAPS.length]!
  return instance('ops.graph', seed, knobs, hunt(seed, want, (rng) => graphAttempt(rng, want)))
}

function generateFormula(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const want = FORMULA_TRAPS[seed % FORMULA_TRAPS.length]!
  return instance('ops.formula', seed, knobs, hunt(seed, want, (rng) => formulaAttempt(rng, want)))
}

export const tableTemplate: TemplateDef = {
  id: 'ops.table',
  title: 'From a table',
  description: 'One value of an operation, read from a table of f and g. The answer is a number or undefined.',
  version: VERSION,
  knobs: [],
  generate: generateTable,
}

export const graphTemplate: TemplateDef = {
  id: 'ops.graph',
  title: 'From graphs',
  description: 'The same operations, read off two piecewise-linear graphs. The answer is a number or undefined.',
  version: VERSION,
  knobs: [],
  generate: generateGraph,
}

export const formulaTemplate: TemplateDef = {
  id: 'ops.formula',
  title: 'From formulas',
  description: 'Build (f + g)(x), (f − g)(x), (fg)(x), (f/g)(x), or a composition. Any equivalent formula is right.',
  version: VERSION,
  knobs: [],
  generate: generateFormula,
}

/** Slips for a generated problem, for the seed tests. */
export function slipsFor(answer: FunctionOpsAnswer) {
  return opsSlips(dataFromAnswer(answer))
}
