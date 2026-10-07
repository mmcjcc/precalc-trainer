/**
 * Reviewer's cross-check of pw.graph, pw.domain, pw.continuous and pw.write, written separately from
 * the module. Values come from the stored pieces with exact fractions (mathjs); the domain and the
 * range are recomputed as membership on a grid of halves (and far-out points) by solving each piece for
 * x, so open and closed ends are tested exactly; continuity is checked by substituting k back in.
 */
import { all, create, type Fraction } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { AnswerSpec, ProblemInstance } from '@/content/types'
import { substituteK } from './continuous'
import { fromStored, toEngine } from './model'
import { gradeWrite } from './write'

const math = create(all, { number: 'Fraction' })
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SWEEP = { timeout: 180_000 }

type Ans = Extract<AnswerSpec, { type: 'piecewiseRate' }>
type Piece = NonNullable<Ans['pieces']>[number]
type Fr = Fraction
const fr = (v: number | string): Fr => math.fraction(typeof v === 'string' ? v.replace(/−/g, '-').trim() : v) as Fr
// In Fraction mode math.compare returns a Fraction; Number() makes === 0 work.
const cmp = (a: Fr, b: Fr): number => Number(math.compare(a, b))

function answerOf(p: ProblemInstance): Ans {
  if (p.answer.type !== 'piecewiseRate') throw new Error(`${p.id}: not a piecewise answer`)
  return p.answer
}

const bound = (t: string): Fr | null => (/inf/.test(t) ? null : fr(t))

function inPiece(pc: Piece, x: Fr): boolean {
  const lo = bound(pc.lo)
  const hi = bound(pc.hi)
  if (lo && (pc.loClosed ? cmp(x, lo) < 0 : cmp(x, lo) <= 0)) return false
  if (hi && (pc.hiClosed ? cmp(x, hi) > 0 : cmp(x, hi) >= 0)) return false
  return true
}

function valueIn(pc: Piece, x: Fr): Fr {
  const e = pc.expr!
  switch (e.kind) {
    case 'const': return fr(e.c)
    case 'linear': return math.add(math.multiply(fr(e.m), x), fr(e.b)) as Fr
    case 'square': return math.multiply(x, x) as Fr
    case 'abs': return math.abs(x) as Fr
  }
}

function valueAt(pieces: Piece[], x: Fr): Fr | null {
  const owners = pieces.filter((pc) => inPiece(pc, x))
  if (owners.length > 1) throw new Error(`two pieces own x = ${x.toFraction()}`)
  return owners.length ? valueIn(owners[0]!, x) : null
}

/** Is y an output of the piece? Each kind solved for x exactly. */
function hits(pc: Piece, y: Fr): boolean {
  const e = pc.expr!
  const xs: Fr[] = []
  if (e.kind === 'const') return math.equal(fr(e.c), y) as boolean && intervalNonEmpty(pc)
  if (e.kind === 'linear') {
    if (math.equal(fr(e.m), 0)) return math.equal(fr(e.b), y) as boolean && intervalNonEmpty(pc)
    xs.push(math.divide(math.subtract(y, fr(e.b)), fr(e.m)) as Fr)
  }
  if (e.kind === 'abs' && cmp(y, fr(0)) >= 0) xs.push(y, math.multiply(fr(-1), y) as Fr)
  if (e.kind === 'square' && cmp(y, fr(0)) >= 0) {
    const r = Math.sqrt(Number(y.valueOf()))
    const exact = Number.isInteger(r * 2) && math.equal(math.multiply(fr(r), fr(r)), y)
    if (exact) xs.push(fr(r), fr(-r))
    else {
      // An irrational root is never an endpoint (the ends are halves), so a float test is exact enough.
      return [r, -r].some((x) => {
        const lo = bound(pc.lo)
        const hi = bound(pc.hi)
        return (!lo || x > Number(lo.valueOf())) && (!hi || x < Number(hi.valueOf()))
      })
    }
  }
  return xs.some((x) => inPiece(pc, x))
}

function intervalNonEmpty(pc: Piece): boolean {
  const lo = bound(pc.lo)
  const hi = bound(pc.hi)
  if (!lo || !hi) return true
  const c = cmp(lo, hi)
  return c < 0 || (c === 0 && pc.loClosed && pc.hiClosed)
}

/** Interval notation "(-inf, 3] U (5, inf)" or "{2}" as a membership test. */
function setOf(text: string): (v: Fr) => boolean {
  const t = text.replace(/−/g, '-').replace(/∞/g, 'inf').replace(/∪/g, 'U').trim()
  if (/^\{\s*\}$|^empty|^∅$/.test(t)) return () => false
  const parts = t.split(/\s*U\s*/)
  const tests = parts.map((part) => {
    const point = /^\{\s*([^}]+)\s*\}$/.exec(part)
    if (point) {
      const vals = point[1]!.split(',').map((s) => fr(s))
      return (v: Fr) => vals.some((p) => math.equal(p, v) as boolean)
    }
    const m = /^([[(])\s*([^,]+?)\s*,\s*([^\])]+?)\s*([\])])$/.exec(part)
    if (!m) throw new Error(`unreadable interval ${part} in ${text}`)
    const lo = bound(m[2]!)
    const hi = bound(m[3]!)
    return (v: Fr) =>
      (!lo || (m[1] === '[' ? cmp(v, lo) >= 0 : cmp(v, lo) > 0)) && (!hi || (m[4] === ']' ? cmp(v, hi) <= 0 : cmp(v, hi) < 0))
  })
  return (v) => tests.some((f) => f(v))
}

const GRID: Fr[] = [
  ...Array.from({ length: 161 }, (_, i) => fr((i - 80) / 2)),
  fr(-1000), fr(1000), fr(-250), fr(250), fr('1/3'), fr('-7/3'),
]

describe('pw.graph', () => {
  it('asks values that the pieces give, open and closed dots respected, 300 seeds', SWEEP, () => {
    for (const seed of SEEDS) {
      const p = generateProblem('piecewiseRate', 'pw.graph', seed)
      const a = answerOf(p)
      for (const ask of a.asks!) {
        const v = valueAt(a.pieces!, fr(ask.x))
        expect(ask.valueText.replace(/−/g, '-'), `${p.id}: f(${ask.x})`).toBe(v === null ? 'undefined' : v.toFraction())
        if (ask.trapText) expect(ask.trapText, p.id).not.toBe(ask.valueText)
      }
      expect(a.sketch, `${p.id}: the graph is the problem`).toBeDefined()
    }
  })
})

describe('pw.domain', () => {
  it('states the domain and range the pieces really have, 300 seeds', SWEEP, () => {
    let gaps = 0
    for (const seed of SEEDS) {
      const p = generateProblem('piecewiseRate', 'pw.domain', seed)
      const a = answerOf(p)
      const pieces = a.pieces!
      const inDomain = setOf(a.domainText!)
      const inRange = setOf(a.rangeText!)
      let gap = false
      for (const x of GRID) {
        const want = pieces.some((pc) => inPiece(pc, x))
        if (!want && cmp(x, fr(-6)) > 0 && cmp(x, fr(6)) < 0) gap = true
        expect(inDomain(x), `${p.id}: x = ${x.toFraction()} in the domain ${a.domainText}`).toBe(want)
      }
      for (const y of GRID) {
        const want = pieces.some((pc) => hits(pc, y))
        expect(inRange(y), `${p.id}: y = ${y.toFraction()} in the range ${a.rangeText} (${pieces.map((pc) => `${pc.formula} on ${pc.condition}`).join('; ')})`).toBe(want)
      }
      if (gap) gaps++
      expect(a.sketch === undefined || p.graph.kind === 'none', `${p.id}: no graph before she answers`).toBe(true)
    }
    expect(gaps, 'some domains have a gap').toBeGreaterThan(20)
  })
})

describe('pw.continuous', () => {
  it('k makes the two pieces meet at the boundary, 300 seeds', SWEEP, () => {
    for (const seed of SEEDS) {
      const p = generateProblem('piecewiseRate', 'pw.continuous', seed)
      const a = answerOf(p)
      const b = fr(a.boundary!)
      const left = math.evaluate(substituteK(a.leftFormula!, a.kText!).replace(/([0-9x)])\s*\(/g, '$1*('), { x: b }) as Fr
      const right = math.evaluate(substituteK(a.rightFormula!, a.kText!).replace(/([0-9x)])\s*\(/g, '$1*('), { x: b }) as Fr
      expect(math.equal(left, right), `${p.id}: k = ${a.kText} gives ${left.toFraction()} and ${right.toFraction()} at x = ${a.boundary}`).toBe(true)
      for (const t of a.traps ?? []) expect(t.text, p.id).not.toBe(a.kText)
      for (const shown of [a.prompt ?? '', p.instructions]) expect(shown, p.id).not.toMatch(new RegExp(`k\\s*=\\s*${a.kText!.replace(/[-/]/g, '\\$&')}\\b`))
    }
  })
})

describe('pw.write', () => {
  it('its rows describe the graph and its traps are named, 300 seeds', SWEEP, () => {
    for (const seed of SEEDS) {
      const p = generateProblem('piecewiseRate', 'pw.write', seed)
      const a = answerOf(p)
      const engine = toEngine(fromStored(a.pieces!)!)
      const traps = (a.traps ?? []).filter((t) => t.rows).map((t) => ({ id: t.id, rows: t.rows! }))
      expect(gradeWrite(engine, traps, a.rows!).verdict, p.id).toBe('correct')
      for (const t of traps) {
        const g = gradeWrite(engine, traps, t.rows)
        expect(g.verdict === 'mistake' && g.id, `${p.id}: trap ${t.id}`).toBe(t.id)
      }
      // The canonical rows give the pieces' values at every grid point they cover.
      for (const x of GRID.slice(0, 161)) {
        const v = valueAt(a.pieces!, x)
        const row = a.rows!.find((r) => {
          const c = r.condition.replace(/≤/g, '<=').replace(/≥/g, '>=')
          return math.evaluate(c.replace(/(\S+)\s*(<=|<)\s*x\s*(<=|<)\s*(\S+)/, '($1 $2 x) and (x $3 $4)'), { x }) as boolean
        })
        if (v === null) expect(row, `${p.id}: x = ${x.toFraction()} is outside the domain`).toBeUndefined()
        else {
          expect(row, `${p.id}: x = ${x.toFraction()}`).toBeDefined()
          const got = math.evaluate(row!.formula.replace(/−/g, '-').replace(/\|([^|]+)\|/g, 'abs($1)').replace(/([0-9x)])\s*\(/g, '$1*('), { x }) as Fr
          expect(math.equal(got, v), `${p.id}: ${row!.formula} at x = ${x.toFraction()}`).toBe(true)
        }
      }
    }
  })
})
