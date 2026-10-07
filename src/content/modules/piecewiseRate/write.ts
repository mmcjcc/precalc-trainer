/**
 * pw.write: she writes the piecewise function drawn on the graph, one row per piece.
 * Graded by meaning: the same value at every x in the domain, the same boundary ownership,
 * and nothing outside the domain. Equivalent formulas and row order do not matter.
 */
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import type { PiecewisePiece } from '@/engine'
import { evaluatePiecewise, pieceConditionText, piecewiseProblem } from '@/engine'
import type { ErrorPatternId, Rational } from '@/shared/types'
import {
  components,
  parseInterval,
  rat,
  ratAdd,
  ratDiv,
  ratEquals,
  ratMul,
  ratNeg,
  ratSub,
  ratToString,
  setContains,
  setFromPieces,
  setFromRelation,
  setIntersection,
  setIsEmpty,
  setsEqual,
  type Piece,
} from '@/notation'
import { buildMore } from './build'
import type { PwGrade } from './grade'
import {
  SLOPES,
  agreesWithEngine,
  evalExpr,
  piece,
  showMinus,
  sketchOf,
  storedPiece,
  toEngine,
  type BuiltPiece,
  type Expr,
} from './model'
import { PW_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 40

const TRAPS = ['pw_write_boundary', 'pw_write_slope', 'pw_write_intercept', 'pw_write_overlap'] as const
type WriteTrap = (typeof TRAPS)[number]

export interface WriteRow {
  formula: string
  condition: string
}

const WIDE: Piece = { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false }

function evalFormula(formula: string, x: Rational): Rational | null {
  const ev = evaluatePiecewise([{ formula, interval: WIDE }], x)
  if (!ev || !ev.defined) return null
  return ev.value
}

function oneInterval(text: string): Piece | null {
  const rel = setFromRelation(text)
  const set = rel ?? (() => {
    const parsed = parseInterval(text)
    return parsed.ok ? parsed.set : null
  })()
  if (!set) return null
  const parts = components(set)
  if (parts.length !== 1) return null
  return parts[0]!
}

function parseRow(row: WriteRow): PiecewisePiece | null {
  const interval = oneInterval(row.condition)
  if (!interval || setIsEmpty(setFromPieces([interval]))) return null
  const formula = row.formula.trim()
  if (!formula) return null
  if (piecewiseProblem([{ formula, interval }])) return null
  const probe = pointIn(interval)
  if (!probe || !evalFormula(formula, probe)) return null
  return { formula, interval }
}

function pointIn(iv: Piece): Rational | null {
  if (iv.lo !== '-inf' && iv.lo !== 'inf' && setContains(setFromPieces([iv]), iv.lo)) return iv.lo
  if (iv.hi !== '-inf' && iv.hi !== 'inf' && setContains(setFromPieces([iv]), iv.hi)) return iv.hi
  if (iv.lo !== '-inf' && iv.lo !== 'inf' && iv.hi !== '-inf' && iv.hi !== 'inf') {
    const mid = ratDiv(ratAdd(iv.lo, iv.hi), rat(2))
    if (setContains(setFromPieces([iv]), mid)) return mid
  }
  return rat(0)
}

function samplesIn(iv: Piece): Rational[] {
  const out: Rational[] = []
  const push = (x: Rational) => {
    if (setContains(setFromPieces([iv]), x)) out.push(x)
  }
  if (iv.lo !== '-inf' && iv.lo !== 'inf') push(iv.lo)
  if (iv.hi !== '-inf' && iv.hi !== 'inf') push(iv.hi)
  if (iv.lo !== '-inf' && iv.lo !== 'inf' && iv.hi !== '-inf' && iv.hi !== 'inf' && ratToString(iv.lo) !== ratToString(iv.hi)) {
    const span = ratSub(iv.hi, iv.lo)
    for (const k of [1, 2, 3]) push(ratAdd(iv.lo, ratMul(span, rat(k, 4))))
  }
  return out
}

/** True when the two formulas disagree somewhere on a shared x. Agreeing overlap is still one function. */
function conflicts(pieces: readonly PiecewisePiece[]): boolean {
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const both = setIntersection(setFromPieces([pieces[i]!.interval]), setFromPieces([pieces[j]!.interval]))
      if (setIsEmpty(both)) continue
      const xs = components(both).flatMap(samplesIn)
      if (xs.length === 0) return true
      for (const x of xs) {
        const a = evalFormula(pieces[i]!.formula, x)
        const b = evalFormula(pieces[j]!.formula, x)
        if (!a || !b || !ratEquals(a, b)) return true
      }
    }
  }
  return false
}

function covered(pieces: readonly PiecewisePiece[]) {
  return setFromPieces(pieces.map((p) => p.interval))
}

function probes(pieces: readonly PiecewisePiece[]): Rational[] {
  const out: Rational[] = []
  for (let n = -32; n <= 32; n++) out.push(rat(n, 4))
  for (const p of pieces) {
    if (p.interval.lo !== '-inf' && p.interval.lo !== 'inf') out.push(p.interval.lo)
    if (p.interval.hi !== '-inf' && p.interval.hi !== 'inf') out.push(p.interval.hi)
  }
  return out
}

function valueAt(pieces: readonly PiecewisePiece[], x: Rational): Rational | 'undef' | 'bad' {
  const owners = pieces.filter((p) => setContains(setFromPieces([p.interval]), x))
  if (owners.length === 0) return 'undef'
  const vals: Rational[] = []
  for (const o of owners) {
    const v = evalFormula(o.formula, x)
    if (!v) return 'bad'
    vals.push(v)
  }
  if (vals.some((v) => !ratEquals(v, vals[0]!))) return 'bad'
  return vals[0]!
}

/** Same domain and the same value at every probe, with no disagreeing overlap. */
export function sameFunction(a: readonly PiecewisePiece[], b: readonly PiecewisePiece[]): boolean {
  if (conflicts(a) || conflicts(b)) return false
  if (!setsEqual(covered(a), covered(b))) return false
  for (const x of probes([...a, ...b])) {
    const va = valueAt(a, x)
    const vb = valueAt(b, x)
    if (va === 'bad' || vb === 'bad') return false
    if (va === 'undef' || vb === 'undef') {
      if (va !== vb) return false
      continue
    }
    if (!ratEquals(va, vb)) return false
  }
  return true
}

export function gradeWrite(canonical: readonly PiecewisePiece[], traps: readonly { id: ErrorPatternId; rows: WriteRow[] }[], rows: readonly WriteRow[]): PwGrade {
  if (rows.length === 0) return { verdict: 'invalid', message: 'Add a row for each piece: a formula and its interval.' }
  const hers: PiecewisePiece[] = []
  for (const row of rows) {
    const parsed = parseRow(row)
    if (!parsed) return { verdict: 'invalid', message: 'Each row needs a formula in x and one interval, like 2x + 1 for -3 <= x < 1.' }
    hers.push(parsed)
  }
  if (sameFunction(hers, canonical)) return { verdict: 'correct', message: 'That is the function in the graph.' }
  if (conflicts(hers)) {
    const witness = 'Two of your intervals include the same x, and the formulas disagree there. Each x belongs to one piece.'
    return { verdict: 'mistake', id: 'pw_write_overlap', witness, message: witness }
  }
  for (const trap of traps) {
    if (trap.id === 'pw_write_overlap') continue
    const parsed = trap.rows.map(parseRow)
    if (parsed.some((p) => !p)) continue
    if (sameFunction(hers, parsed as PiecewisePiece[])) {
      const witness = witnessFor(trap.id)
      return { verdict: 'mistake', id: trap.id, witness, message: witness }
    }
  }
  return { verdict: 'wrong', message: 'That function does not match the graph on the whole domain.' }
}

function witnessFor(id: ErrorPatternId): string {
  if (id === 'pw_write_boundary') return 'A boundary point is on the wrong piece. The filled dot belongs to the piece that includes it.'
  if (id === 'pw_write_slope') return 'A piece tips the wrong way. Its slope has the opposite sign of the one in the graph.'
  if (id === 'pw_write_intercept') return 'A y-intercept was read off the drawn piece. If that piece does not reach x = 0, the height you see is not the intercept.'
  return 'That is not the function in the graph.'
}

function rowOf(p: BuiltPiece): WriteRow {
  return { formula: p.formula, condition: pieceConditionText({ lo: p.lo, hi: p.hi, loClosed: p.loClosed, hiClosed: p.hiClosed }) }
}

function engineOf(rows: WriteRow[]): PiecewisePiece[] | null {
  const out: PiecewisePiece[] = []
  for (const row of rows) {
    const parsed = parseRow(row)
    if (!parsed) return null
    out.push(parsed)
  }
  return out
}

function tryWrite(rng: Rng): { pieces: BuiltPiece[]; traps: { id: WriteTrap; rows: WriteRow[] }[] } | null {
  const a = rng.int(1, 2)
  const c = rng.int(a + 1, 4)
  const d = rng.int(c + 1, 6)
  const m1 = rng.pick(SLOPES)
  const b1 = rat(rng.int(-3, 3))
  const m2 = rng.pick(SLOPES.filter((s) => !ratEquals(s, m1)))
  const b2 = rat(rng.int(-3, 3))
  const leftExpr: Expr = { kind: 'linear', m: m1, b: b1 }
  const rightExpr: Expr = { kind: 'linear', m: m2, b: b2 }
  const yLeft = evalExpr(leftExpr, rat(c))
  const yRight = evalExpr(rightExpr, rat(c))
  if (ratEquals(yLeft, yRight)) return null
  const pieces: BuiltPiece[] = [piece(leftExpr, a, c, true, false), piece(rightExpr, c, d, true, false)]
  if (rng.chance(0.55)) {
    const lo = rng.int(-6, -4)
    const hi = rng.int(lo + 1, -2)
    const roll = rng.int(1, 3)
    const extra: Expr = roll === 1 ? { kind: 'const', c: rat(rng.int(-3, 3)) } : roll === 2 ? { kind: 'square' } : { kind: 'abs' }
    pieces.unshift(piece(extra, lo, hi, true, true))
  }
  if (!agreesWithEngine(pieces)) return null
  const jump = pieces.length === 3 ? 1 : 0
  const left = pieces[jump]!
  const right = pieces[jump + 1]!
  if (left.expr.kind !== 'linear' || right.expr.kind !== 'linear') return null
  if (left.lo === '-inf' || left.lo === 'inf' || left.hi === '-inf' || left.hi === 'inf') return null
  if (right.lo === '-inf' || right.lo === 'inf' || right.hi === '-inf' || right.hi === 'inf') return null

  const boundaryLeft: BuiltPiece = { ...left, hiClosed: true }
  const boundaryRight: BuiltPiece = { ...right, loClosed: false }
  const slopeLeft = piece({ kind: 'linear', m: ratNeg(left.expr.m), b: left.expr.b }, left.lo.n, left.hi.n, left.loClosed, left.hiClosed)
  const yNear = evalExpr(left.expr, left.lo)
  if (ratEquals(yNear, left.expr.b)) return null
  const interceptLeft = piece({ kind: 'linear', m: left.expr.m, b: yNear }, left.lo.n, left.hi.n, left.loClosed, left.hiClosed)
  const overlapLeft = piece(left.expr, left.lo.n, right.hi.n, left.loClosed, right.hiClosed)

  const withLeft = (changed: BuiltPiece) => pieces.map((p, i) => (i === jump ? changed : p))
  const trapPieces: { id: WriteTrap; pieces: BuiltPiece[] }[] = [
    { id: 'pw_write_boundary', pieces: pieces.map((p, i) => (i === jump ? boundaryLeft : i === jump + 1 ? boundaryRight : p)) },
    { id: 'pw_write_slope', pieces: withLeft(slopeLeft) },
    { id: 'pw_write_intercept', pieces: withLeft(interceptLeft) },
    { id: 'pw_write_overlap', pieces: withLeft(overlapLeft) },
  ]

  const canonical = toEngine(pieces)
  if (piecewiseProblem(canonical)) return null
  const traps: { id: WriteTrap; rows: WriteRow[] }[] = []
  for (const trap of trapPieces) {
    const rows = trap.pieces.map(rowOf)
    const parsed = engineOf(rows)
    if (!parsed) return null
    if (trap.id === 'pw_write_overlap') {
      if (!conflicts(parsed)) return null
    } else if (!sameFunction(parsed, toEngine(trap.pieces)) || sameFunction(parsed, canonical)) {
      return null
    }
    traps.push({ id: trap.id, rows })
  }
  // The four wrong functions are different from each other.
  for (let i = 0; i < traps.length; i++) {
    for (let j = i + 1; j < traps.length; j++) {
      if (traps[i]!.id === 'pw_write_overlap' || traps[j]!.id === 'pw_write_overlap') continue
      const pi = engineOf(traps[i]!.rows)
      const pj = engineOf(traps[j]!.rows)
      if (!pi || !pj || sameFunction(pi, pj)) return null
    }
  }
  if (gradeWrite(canonical, traps, pieces.map(rowOf)).verdict !== 'correct') return null
  return { pieces, traps }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  const trap = TRAPS[(seed >>> 0) % TRAPS.length]!
  for (let n = 0; n < TRIES; n++) {
    const draft = tryWrite(rng)
    if (!draft) continue
    if (!draft.traps.some((t) => t.id === trap)) continue
    const promised = draft.traps.find((t) => t.id === trap)!
    const canonical = toEngine(draft.pieces)
    if (gradeWrite(canonical, draft.traps, promised.rows).verdict !== 'mistake') continue
    const dots = sketchOf(draft.pieces).dots ?? []
    if (!dots.some((d) => d.closed) || !dots.some((d) => !d.closed)) continue
    const rows = draft.pieces.map(rowOf)
    const shown = rows.map((r) => `${showMinus(r.formula)} for ${showMinus(r.condition)}`).join('; ')
    const reveal = [`The graph is ${shown}.`]
    const prompt = 'Write the piecewise function shown in the graph.'
    return buildMore({
      templateId: 'pw.write',
      version: VERSION,
      seed,
      knobs,
      title: 'Write a piecewise function',
      instructions: prompt,
      statementText: 'One row for each piece.',
      answer: {
        question: 'write',
        prompt,
        pieces: draft.pieces.map(storedPiece),
        rows,
        parts: [
          {
            key: 'write',
            label: 'The function',
            placeholder: 'formula',
            nudge: 'Match each drawn piece: its formula, and which endpoints that piece includes.',
            ruleCard: PW_RULE_IDS.write,
            reveal,
            answerText: shown,
          },
        ],
        traps: draft.traps.map((t) => ({ id: t.id, rows: t.rows, witness: witnessFor(t.id) })),
        sketch: sketchOf(draft.pieces),
        nudge: 'Match each drawn piece: its formula, and which endpoints that piece includes.',
        ruleCard: PW_RULE_IDS.write,
        ruleCards: [PW_RULE_IDS.write],
        reveal,
        trap,
      },
    })
  }
  throw new Error(`pw.write/${trap}: no function for seed ${seed}`)
}

export const writeTemplate: TemplateDef = {
  id: 'pw.write',
  title: 'Write a piecewise function from its graph',
  description: 'The function is a graph. Write one formula and one interval for each piece.',
  version: VERSION,
  knobs: [],
  generate,
}
