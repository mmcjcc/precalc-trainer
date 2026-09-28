import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { evaluatePiecewise, gradePiecewiseValue, pieceConditionText, piecewiseProblem, type PiecewisePiece } from '@/engine'
import { rat, ratToString } from '@/notation'
import { linearExpr, polyExpr } from '../fnExpr'
import { buildEvaluate } from './build'

const VERSION = 1
const TRIES = 40
const TRAPS = ['boundary-leq', 'boundary-lt', 'inside', 'outside'] as const
type PwTrap = (typeof TRAPS)[number]

const NUDGE: Record<PwTrap, string> = {
  'boundary-leq': 'Two pieces meet at this x. One uses < and one uses ≤. Which inequality actually includes the endpoint?',
  'boundary-lt': 'This x is an endpoint. A piece written with < leaves that endpoint out. Find the piece that keeps it.',
  inside: 'Find the one piece whose interval contains this x, then substitute. A formula from another piece does not apply.',
  outside: 'Check every piece. If this x is left out of all of them, f(x) has no value.',
}

function formula(rng: Rng): string {
  const kind = rng.pick(['linear', 'quadratic', 'constant', 'abs'] as const)
  if (kind === 'constant') return String(rng.int(-5, 6))
  if (kind === 'linear') return linearExpr(rng.intExcept(-4, 4, [0]), rng.int(-5, 5))
  if (kind === 'quadratic') return polyExpr([rng.int(-4, 4), rng.int(-3, 3), rng.pick([1, 1, -1, 2])])
  return `abs(${linearExpr(rng.pick([1, 1, -1, 2]), rng.int(-4, 4))})`
}

function valueAt(formulaText: string, x: number): string | null {
  const ev = evaluatePiecewise([{ formula: formulaText, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], x)
  if (!ev || !ev.defined) return null
  return ev.text
}

function piece(formulaText: string, lo: number | '-inf', hi: number | 'inf', loClosed: boolean, hiClosed: boolean): PiecewisePiece {
  return {
    formula: formulaText,
    interval: {
      lo: lo === '-inf' ? '-inf' : rat(lo),
      hi: hi === 'inf' ? 'inf' : rat(hi),
      loClosed,
      hiClosed,
    },
  }
}

function endText(e: PiecewisePiece['interval']['lo']): string {
  if (e === '-inf' || e === 'inf') return e
  return ratToString(e)
}

function stored(p: PiecewisePiece) {
  return {
    formula: p.formula,
    condition: pieceConditionText(p.interval),
    lo: endText(p.interval.lo),
    hi: endText(p.interval.hi),
    loClosed: p.interval.loClosed,
    hiClosed: p.interval.hiClosed,
  }
}

function tryDraft(rng: Rng, trap: PwTrap): { pieces: PiecewisePiece[]; x: number } | null {
  if (trap === 'outside') {
    const p = rng.int(-2, 1)
    const q = p + rng.int(2, 4)
    const x = p + 1
    if (x >= q) return null
    const pieces = [piece(formula(rng), '-inf', p, false, false), piece(formula(rng), q, 'inf', false, false)]
    if (piecewiseProblem(pieces)) return null
    const ev = evaluatePiecewise(pieces, x)
    if (!ev || ev.defined) return null
    const sample = valueAt(pieces[0]!.formula, x) ?? '0'
    const g = gradePiecewiseValue(pieces, x, sample)
    if (g.verdict !== 'mistake' || g.mistake !== 'piecewise_value_where_undefined') return null
    if (gradePiecewiseValue(pieces, x, 'undefined').verdict !== 'correct') return null
    return { pieces, x }
  }

  const p = rng.int(-2, 2)
  const q = p + rng.int(2, 4)
  const A = formula(rng)
  const B = formula(rng)
  const C = formula(rng)
  const pieces = [piece(A, '-inf', p, false, false), piece(B, p, q, true, false), piece(C, q, 'inf', true, false)]
  if (piecewiseProblem(pieces)) return null

  if (trap === 'inside') {
    const x = p + 1
    if (x >= q) return null
    const right = valueAt(B, x)
    const other = valueAt(A, x)
    if (!right || !other || right === other) return null
    const g = gradePiecewiseValue(pieces, x, other)
    if (g.verdict !== 'mistake' || g.mistake !== 'piecewise_wrong_piece') return null
    if (gradePiecewiseValue(pieces, x, right).verdict !== 'correct') return null
    return { pieces, x }
  }

  const x = trap === 'boundary-leq' ? p : q
  const owner = trap === 'boundary-leq' ? B : C
  const neighbor = trap === 'boundary-leq' ? A : B
  const ov = valueAt(owner, x)
  const nv = valueAt(neighbor, x)
  if (!ov || !nv || ov === nv) return null
  const g = gradePiecewiseValue(pieces, x, nv)
  if (g.verdict !== 'mistake' || g.mistake !== 'piecewise_boundary') return null
  if (gradePiecewiseValue(pieces, x, ov).verdict !== 'correct') return null
  return { pieces, x }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  const trap = TRAPS[(seed >>> 0) % TRAPS.length]!
  for (let n = 0; n < TRIES; n++) {
    const draft = tryDraft(rng, trap)
    if (!draft) continue
    const ev = evaluatePiecewise(draft.pieces, draft.x)
    if (!ev) continue
    return buildEvaluate({
      version: VERSION,
      seed,
      knobs,
      pieces: draft.pieces.map(stored),
      x: String(draft.x),
      valueText: ev.defined ? ev.text : 'undefined',
      nudge: NUDGE[trap],
      reveal: ev.steps,
      trap,
    })
  }
  throw new Error(`pw.evaluate/${trap}: no core-supported function for seed ${seed}`)
}

export const evaluateTemplate: TemplateDef = {
  id: 'pw.evaluate',
  title: 'Evaluate a piecewise function',
  description: 'Two or three pieces. Includes a boundary on the ≤ side, a boundary the < piece leaves out, an interior point, and a point in a gap.',
  version: VERSION,
  knobs: [],
  generate,
}
