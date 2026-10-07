/**
 * pw.graph: the function is only a graph. She reads f(a) at a jump, an interior point, or a gap.
 * The jump's trap is the open dot's height. Grade with the engine's piecewise value grader.
 */
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { evaluatePiecewise, gradePiecewiseValue } from '@/engine'
import { rat, ratEquals, ratToString } from '@/notation'
import { buildMore } from './build'
import { PW_RULE_IDS } from './rules'
import {
  SLOPES,
  agreesWithEngine,
  containsInt,
  evalExpr,
  interiorInteger,
  piece,
  sketchOf,
  storedPiece,
  toEngine,
  type BuiltPiece,
  type Expr,
} from './model'

const VERSION = 1
const TRIES = 48

const TRAPS = ['pw_piecewise_boundary', 'pw_piecewise_wrong_piece', 'pw_piecewise_value_where_undefined'] as const
type GraphTrap = (typeof TRAPS)[number]

const KIND: Record<GraphTrap, 'piecewise_boundary' | 'piecewise_wrong_piece' | 'piecewise_value_where_undefined'> = {
  pw_piecewise_boundary: 'piecewise_boundary',
  pw_piecewise_wrong_piece: 'piecewise_wrong_piece',
  pw_piecewise_value_where_undefined: 'piecewise_value_where_undefined',
}

const NUDGE: Record<GraphTrap, string> = {
  pw_piecewise_boundary: 'Two dots sit on this x. Only the filled one is on the graph.',
  pw_piecewise_wrong_piece: 'Read the piece whose interval actually contains this x.',
  pw_piecewise_value_where_undefined: 'If no piece reaches this x, there is no value to give.',
}

function expr(rng: Rng): Expr {
  const roll = rng.int(1, 10)
  if (roll <= 2) return { kind: 'const', c: rat(rng.int(-4, 5)) }
  if (roll === 3) return { kind: 'square' }
  if (roll === 4) return { kind: 'abs' }
  return { kind: 'linear', m: rng.pick(SLOPES), b: rat(rng.int(-4, 4)) }
}

/** Strictly increasing bounds in [-6, 6], each gap at least `span`. */
function bounds(rng: Rng, nPieces: number, span: number): number[] | null {
  const need = nPieces + 1
  const cuts: number[] = []
  let prev = -7
  for (let i = 0; i < need; i++) {
    const lo = prev + span
    const hi = 6 - (need - i - 1) * span
    if (lo > hi) return null
    const v = rng.int(lo, hi)
    cuts.push(v)
    prev = v
  }
  return cuts
}

interface Draft {
  pieces: BuiltPiece[]
  x: number
  trapText: string
  valueText: string
}

function finish(pieces: BuiltPiece[], x: number, trapText: string, trap: GraphTrap): Draft | null {
  const eng = toEngine(pieces)
  if (!agreesWithEngine(pieces)) return null
  const ev = evaluatePiecewise(eng, x)
  if (!ev) return null
  const valueText = ev.defined ? ev.text : 'undefined'
  if (valueText === trapText) return null
  const right = gradePiecewiseValue(eng, x, valueText)
  if (right.verdict !== 'correct') return null
  const wrong = gradePiecewiseValue(eng, x, trapText)
  if (wrong.verdict !== 'mistake' || wrong.mistake !== KIND[trap]) return null
  const dots = sketchOf(pieces).dots ?? []
  if (!dots.some((d) => d.closed) || !dots.some((d) => !d.closed)) return null
  return { pieces, x, trapText, valueText }
}

function tryJump(rng: Rng): Draft | null {
  const n = rng.chance(0.35) ? 3 : 2
  const cut = bounds(rng, n, 1)
  if (!cut) return null
  const pieces: BuiltPiece[] = []
  for (let i = 0; i < n; i++) pieces.push(piece(expr(rng), cut[i]!, cut[i + 1]!, true, false))
  const meet = 0
  const c = cut[meet + 1]!
  const openY = evalExpr(pieces[meet]!.expr, rat(c))
  const closedY = evalExpr(pieces[meet + 1]!.expr, rat(c))
  if (ratEquals(openY, closedY)) return null
  return finish(pieces, c, ratToString(openY), 'pw_piecewise_boundary')
}

function tryInterior(rng: Rng): Draft | null {
  const n = rng.chance(0.35) ? 3 : 2
  const cut = bounds(rng, n, n === 3 ? 2 : 3)
  if (!cut) return null
  const pieces: BuiltPiece[] = []
  for (let i = 0; i < n; i++) pieces.push(piece(expr(rng), cut[i]!, cut[i + 1]!, i === 0, i === n - 1 ? false : true))
  // Own the shared boundaries on the right piece, and leave the outer right open.
  for (let i = 0; i < n; i++) {
    pieces[i] = piece(pieces[i]!.expr, cut[i]!, cut[i + 1]!, true, false)
  }
  const host = pieces.findIndex((p) => interiorInteger(p) !== null && (p.hi as { n: number }).n - (p.lo as { n: number }).n >= 3)
  if (host < 0) return null
  const p = pieces[host]!
  const lo = (p.lo as { n: number }).n
  const hi = (p.hi as { n: number }).n
  const x = rng.int(lo + 1, hi - 1)
  const other = pieces.findIndex((_, i) => i !== host)
  if (other < 0) return null
  const truth = evalExpr(p.expr, rat(x))
  const trapY = evalExpr(pieces[other]!.expr, rat(x))
  if (ratEquals(truth, trapY)) return null
  return finish(pieces, x, ratToString(trapY), 'pw_piecewise_wrong_piece')
}

function tryGap(rng: Rng): Draft | null {
  const a = rng.int(-6, 0)
  const b = rng.int(a + 1, 2)
  const c = b + rng.int(2, 3)
  const d = rng.int(c + 1, 6)
  if (c > 6 || d > 6) return null
  const x = b + 1
  if (x >= c) return null
  const pieces = [piece(expr(rng), a, b, true, true), piece(expr(rng), c, d, true, false)]
  if (rng.chance(0.4) && a >= -4) {
    // already two; a third would need room on the right, which we may not have
  }
  if (containsInt(pieces[0]!, x) || containsInt(pieces[1]!, x)) return null
  const trapY = evalExpr(pieces[0]!.expr, rat(x))
  return finish(pieces, x, ratToString(trapY), 'pw_piecewise_value_where_undefined')
}

function secondAsk(rng: Rng, pieces: BuiltPiece[], used: number): { x: number; valueText: string } | null {
  const choices: number[] = []
  for (const p of pieces) {
    if (p.lo === '-inf' || p.lo === 'inf' || p.hi === '-inf' || p.hi === 'inf' || p.lo.d !== 1 || p.hi.d !== 1) continue
    for (let x = p.lo.n + 1; x <= p.hi.n - 1; x++) if (x !== used && containsInt(p, x)) choices.push(x)
  }
  if (choices.length === 0) return null
  const x = rng.pick(choices)
  const ev = evaluatePiecewise(toEngine(pieces), x)
  if (!ev || !ev.defined) return null
  return { x, valueText: ev.text }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  const trap = TRAPS[(seed >>> 0) % TRAPS.length]!
  const two = (seed >>> 0) % 2 === 1
  for (let n = 0; n < TRIES; n++) {
    const draft = trap === 'pw_piecewise_boundary' ? tryJump(rng) : trap === 'pw_piecewise_wrong_piece' ? tryInterior(rng) : tryGap(rng)
    if (!draft) continue
    const asks: { x: string; valueText: string; trapText?: string }[] = [
      { x: String(draft.x), valueText: draft.valueText, trapText: draft.trapText },
    ]
    if (two) {
      const extra = secondAsk(rng, draft.pieces, draft.x)
      if (extra) asks.push({ x: String(extra.x), valueText: extra.valueText })
    }
    const ev = evaluatePiecewise(toEngine(draft.pieces), draft.x)
    const reveal = ev?.steps ?? []
    const find = asks.length === 1 ? `Find f(${asks[0]!.x}).` : `Find f(${asks.map((a) => a.x).join(') and f(')}).`
    const prompt = 'Read the value of f from the graph.'
    return buildMore({
      templateId: 'pw.graph',
      version: VERSION,
      seed,
      knobs,
      title: 'Read a piecewise graph',
      instructions: prompt,
      statementText: find,
      answer: {
        question: 'graph',
        prompt,
        pieces: draft.pieces.map(storedPiece),
        asks,
        parts: asks.map((a, i) => ({
          key: `v${i}`,
          label: `f(${a.x})`,
          placeholder: 'value',
          nudge: i === 0 ? NUDGE[trap] : 'Read the height of the piece that contains this x.',
          ruleCard: PW_RULE_IDS.dots,
          reveal: i === 0 ? reveal : evaluatePiecewise(toEngine(draft.pieces), Number(a.x))?.steps ?? [],
          answerText: a.valueText,
        })),
        sketch: sketchOf(draft.pieces),
        nudge: NUDGE[trap],
        ruleCard: PW_RULE_IDS.dots,
        ruleCards: [PW_RULE_IDS.dots],
        reveal,
        trap,
        traps: [{ id: trap, text: draft.trapText, witness: '' }],
      },
    })
  }
  throw new Error(`pw.graph/${trap}: no graph for seed ${seed}`)
}

export const graphTemplate: TemplateDef = {
  id: 'pw.graph',
  title: 'Read a piecewise graph',
  description: 'The function is only a graph, with filled and hollow dots. Read f at a jump, an interior point, or a gap.',
  version: VERSION,
  knobs: [],
  generate,
}
