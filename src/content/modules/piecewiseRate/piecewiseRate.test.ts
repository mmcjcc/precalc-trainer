import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import type { ProblemInstance } from '@/content/types'
import {
  ERROR_PATTERNS,
  averageRateMistakes,
  averageRateOfChange,
  evaluatePiecewise,
  gradeAverageRate,
  gradePiecewiseValue,
  piecewiseProblem,
  toRational,
  type PiecewisePiece,
  type TransformMistakeKind,
} from '@/engine'
import {
  components,
  rat,
  ratAdd,
  ratEquals,
  ratMul,
  ratSub,
  setContains,
  setFromPieces,
} from '@/notation'
import type { Endpoint, ErrorPatternId, Rational } from '@/shared/types'
import { substituteK } from './continuous'
import { gradeK, gradePwSet } from './grade'
import { fromStored, parseRat, rangeOf } from './model'
import { gradeWrite } from './write'

const SEEDS = 300

function list(template: string): ProblemInstance[] {
  return Array.from({ length: SEEDS }, (_, i) => generateProblem('piecewiseRate', template, i + 1))
}

function ans(p: ProblemInstance) {
  if (p.answer.type !== 'piecewiseRate') throw new Error(`${p.id} answer type ${p.answer.type}`)
  return p.answer
}

function piecesOf(p: ProblemInstance): PiecewisePiece[] {
  const a = ans(p)
  return (a.pieces ?? []).map((piece) => ({
    formula: piece.formula,
    interval: {
      lo: piece.lo === '-inf' ? '-inf' : toRational(piece.lo)!,
      hi: piece.hi === 'inf' ? 'inf' : toRational(piece.hi)!,
      loClosed: piece.loClosed,
      hiClosed: piece.hiClosed,
    },
  }))
}

describe('piecewise and rate registration', () => {
  it('sits under precalculus, right after Transformations', () => {
    const ids = MODULES.filter((m) => !m.subject).map((m) => m.id)
    expect(ids.indexOf('piecewiseRate')).toBe(ids.indexOf('transformations') + 1)
    const mod = MODULES.find((m) => m.id === 'piecewiseRate')!
    expect(mod.title).toBe('Piecewise functions and rate of change')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['pw.evaluate', 'pw.graph', 'pw.domain', 'pw.continuous', 'pw.write', 'arc.rate'])
    expect(mod.ruleCards.map((c) => c.title)).toEqual([
      'A boundary belongs to ≤',
      'Average rate of change',
      'Filled and hollow dots',
      'The domain is every x a piece includes',
      'The range is the outputs',
      'The pieces have to meet',
      'Each piece owns its interval',
    ])
  })
})

describe('pw.evaluate over 300 seeds', () => {
  const problems = list('pw.evaluate')

  it('is deterministic, core-supported, and the canonical value grades correct', () => {
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'pw.evaluate', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.kind).toBe('piecewiseRate')
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc.ti84).toEqual([])
      expect(p.calc.nspire).toEqual([])
      expect(p.start).toBeNull()
      const pieces = piecesOf(p)
      expect(pieces.length === 2 || pieces.length === 3).toBe(true)
      expect(piecewiseProblem(pieces), a.trap).toBeNull()
      const ev = evaluatePiecewise(pieces, a.x!)
      expect(ev, a.x).not.toBeNull()
      expect(gradePiecewiseValue(pieces, a.x!, a.valueText!).verdict).toBe('correct')
      expect(a.reveal).toEqual(ev!.steps)
      for (const piece of a.pieces ?? []) {
        expect(piece.formula.length).toBeGreaterThan(0)
        expect(piece.condition.length).toBeGreaterThan(0)
      }
    }
  }, 120_000)

  it('includes a boundary on each side, an interior point, and a point outside every piece', () => {
    const traps = new Set(problems.map((p) => ans(p).trap))
    expect(traps.has('boundary-leq')).toBe(true)
    expect(traps.has('boundary-lt')).toBe(true)
    expect(traps.has('inside')).toBe(true)
    expect(traps.has('outside')).toBe(true)
    const conditions = problems.flatMap((p) => ans(p).pieces?.map((piece) => piece.condition) ?? [])
    expect(conditions.some((c) => c.includes('<') && !c.includes('='))).toBe(true)
    expect(conditions.some((c) => c.includes('<='))).toBe(true)
    const outside = problems.filter((p) => ans(p).trap === 'outside')
    expect(outside.every((p) => ans(p).valueText === 'undefined')).toBe(true)
    const inside = problems.filter((p) => ans(p).trap === 'inside')
    expect(inside.every((p) => ans(p).valueText !== 'undefined')).toBe(true)
  })

  it('every piecewise mistake is reachable from a realistic wrong answer', () => {
    const seen = new Set<TransformMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      const pieces = piecesOf(p)
      const x = a.x!
      if (a.valueText === 'undefined') {
        const g = gradePiecewiseValue(pieces, x, '0')
        if (g.verdict === 'mistake') seen.add(g.mistake)
        continue
      }
      const undef = gradePiecewiseValue(pieces, x, 'undefined')
      if (undef.verdict === 'mistake') seen.add(undef.mistake)
      for (const piece of a.pieces ?? []) {
        const ev = evaluatePiecewise([{ formula: piece.formula, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], x)
        if (!ev || !ev.defined || ev.text === a.valueText) continue
        const g = gradePiecewiseValue(pieces, x, ev.text)
        if (g.verdict === 'mistake') seen.add(g.mistake)
      }
    }
    for (const kind of ['piecewise_boundary', 'piecewise_wrong_piece', 'piecewise_value_where_undefined', 'piecewise_undefined_where_defined'] as const) {
      expect(seen.has(kind), kind).toBe(true)
    }
  }, 120_000)
})

describe('arc.rate over 300 seeds', () => {
  const problems = list('arc.rate')

  it('is deterministic, core-supported, and the canonical rate grades correct', () => {
    const families = new Set<string>()
    let integers = 0
    let fractions = 0
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'arc.rate', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc.ti84).toEqual([])
      const rate = averageRateOfChange(a.f!, a.a!, a.b!)
      expect(rate, a.f).not.toBeNull()
      expect(rate!.text).toBe(a.rateText)
      expect(gradeAverageRate(a.f!, a.a!, a.b!, a.rateText!).verdict).toBe('correct')
      expect(a.reveal).toEqual(rate!.steps)
      const mistakes = averageRateMistakes(a.f!, a.a!, a.b!)
      expect(mistakes!.every((c) => c.shadows.length === 0)).toBe(true)
      families.add(a.trap.split('-')[0]!)
      if (a.trap.endsWith('integer')) integers++
      if (a.trap.endsWith('fraction')) fractions++
    }
    expect([...families].sort()).toEqual(['linear', 'quadratic', 'rational'])
    expect(integers).toBeGreaterThan(0)
    expect(fractions).toBeGreaterThan(0)
  }, 120_000)

  it('every rate mistake is what a realistic wrong answer grades as', () => {
    const seen = new Set<TransformMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      for (const c of averageRateMistakes(a.f!, a.a!, a.b!) ?? []) {
        const g = gradeAverageRate(a.f!, a.a!, a.b!, c.text)
        expect(g.verdict, `${a.f} ${c.kind} ${c.text}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          expect(g.witness.length).toBeGreaterThan(0)
          seen.add(c.kind)
        }
      }
    }
    for (const kind of ['rate_sign_flipped', 'rate_no_division', 'rate_inverted', 'rate_divided_by_b'] as const) {
      expect(seen.has(kind), kind).toBe(true)
    }
  }, 120_000)
})

const GRAPH_KIND = {
  pw_piecewise_boundary: 'piecewise_boundary',
  pw_piecewise_wrong_piece: 'piecewise_wrong_piece',
  pw_piecewise_value_where_undefined: 'piecewise_value_where_undefined',
} as const

const PROMPTS: Record<string, string> = {
  'pw.graph': 'Read the value of f from the graph.',
  'pw.domain': 'Give the domain and the range of f in interval notation.',
  'pw.continuous': 'Find the value of k that makes f continuous.',
  'pw.write': 'Write the piecewise function shown in the graph.',
}

function visible(p: ProblemInstance): string {
  const a = ans(p)
  return [p.instructions, p.statementText, a.prompt ?? '', a.nudge, ...(a.parts ?? []).map((part) => part.nudge)].join('\n')
}

function assertHidden(p: ProblemInstance, secrets: string[], mentions: string[] = []) {
  let blob = visible(p)
  for (const mention of mentions) blob = blob.split(mention).join(' ')
  for (const line of ans(p).reveal) {
    if (line.length > 12) expect(blob.includes(line), `${p.id} shows a worked line`).toBe(false)
  }
  for (const secret of secrets) {
    if (!secret) continue
    expect(blob.includes(secret), `${p.id} shows ${secret}`).toBe(false)
  }
}

function endpoint(text: string): Endpoint {
  if (text === '-inf' || text === 'inf') return text
  const r = parseRat(text)
  if (!r) throw new Error(`bad endpoint ${text}`)
  return r
}

function finiteBound(text: string): boolean {
  if (text === '-inf' || text === 'inf') return true
  const r = parseRat(text)
  return !!r && r.d === 1 && r.n >= -6 && r.n <= 6
}

/** Exact x-values in a piece: the included ends, a point just inside each end, and a quarter grid. */
function probesOf(piece: NonNullable<ReturnType<typeof ans>['pieces']>[number]): Rational[] {
  const iv = {
    lo: endpoint(piece.lo),
    hi: endpoint(piece.hi),
    loClosed: piece.loClosed,
    hiClosed: piece.hiClosed,
  }
  const set = setFromPieces([iv])
  const xs: Rational[] = []
  const consider = (x: Rational) => {
    if (setContains(set, x)) xs.push(x)
  }
  const lo = iv.lo === '-inf' || iv.lo === 'inf' ? null : iv.lo
  const hi = iv.hi === '-inf' || iv.hi === 'inf' ? null : iv.hi
  if (lo && hi) {
    consider(lo)
    consider(hi)
    const span = ratSub(hi, lo)
    for (let k = 1; k <= 16; k++) consider(ratAdd(lo, ratMul(span, rat(k, 17))))
    if (lo.d === 1 && hi.d === 1) {
      for (let n = lo.n * 4; n <= hi.n * 4; n++) consider(rat(n, 4))
    }
    consider(rat(0))
  } else {
    if (lo) {
      consider(lo)
      consider(ratAdd(lo, rat(1, 2)))
      consider(ratAdd(lo, rat(1)))
    }
    if (hi) {
      consider(hi)
      consider(ratSub(hi, rat(1, 2)))
      consider(ratSub(hi, rat(1)))
    }
  }
  return xs
}

function swapLinear(formula: string): string | null {
  const plus = /^(-?(?:\d+|\(\d+\/\d+\))?x) \+ (\d+)$/.exec(formula)
  if (plus) {
    if (plus[1]!.startsWith('-')) return `${plus[2]} - ${plus[1]!.slice(1)}`
    return `${plus[2]} + ${plus[1]}`
  }
  const minus = /^(-?(?:\d+|\(\d+\/\d+\))?x) - (\d+)$/.exec(formula)
  if (minus) return `-${minus[2]} + ${minus[1]}`
  return null
}

function equivalentRows(rows: { formula: string; condition: string }[]): { formula: string; condition: string }[] {
  let changed = false
  const next = rows.map((row) => {
    if (changed) return row
    const swapped = swapLinear(row.formula)
    if (!swapped) return row
    changed = true
    return { ...row, formula: swapped }
  })
  if (changed) return next
  return rows.map((row, i) => (i === 0 ? { ...row, formula: `0 + (${row.formula})` } : row))
}

function named(id: string) {
  const info = ERROR_PATTERNS[id as ErrorPatternId]
  expect(info?.title, id).toBeTruthy()
  expect(info?.lesson, id).toBeTruthy()
  expect(info?.example, id).toContain('→')
}

describe('pw.graph over 300 seeds', () => {
  const problems = list('pw.graph')

  it('is deterministic, hides the value, and the open-dot trap is a real candidate', () => {
    const asks = new Set<number>()
    const ops = new Set<string>()
    let squares = 0
    let abs = 0
    let halves = 0
    let gaps = 0
    let triple = 0
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'pw.graph', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.instructions).toBe(PROMPTS['pw.graph'])
      expect(p.graph).toEqual({ kind: 'none' })
      expect(a.question).toBe('graph')
      expect(a.pieces?.length === 2 || a.pieces?.length === 3).toBe(true)
      if ((a.pieces?.length ?? 0) === 3) triple++
      const pieces = piecesOf(p)
      expect(piecewiseProblem(pieces), p.id).toBeNull()
      for (const piece of a.pieces ?? []) {
        expect(finiteBound(piece.lo), piece.condition).toBe(true)
        expect(finiteBound(piece.hi), piece.condition).toBe(true)
        for (const op of piece.condition.match(/<=|>=|<|>/g) ?? []) ops.add(op)
        if (piece.formula === 'x^2') squares++
        if (piece.formula.startsWith('abs(')) abs++
        if (piece.formula.includes('(1/2)x')) halves++
      }
      const sketch = a.sketch
      expect(sketch?.runs?.length).toBeGreaterThan(0)
      expect(sketch?.xDomain).toEqual(sketch?.yDomain)
      expect(sketch!.xDomain![0]).toBeLessThanOrEqual(0)
      expect(sketch!.xDomain![1]).toBeGreaterThanOrEqual(0)
      expect(sketch?.dots?.some((d) => d.closed)).toBe(true)
      expect(sketch?.dots?.some((d) => !d.closed)).toBe(true)
      const first = a.asks?.[0]
      expect(first?.trapText, p.id).toBeTruthy()
      expect(first?.trapText).not.toBe(first?.valueText)
      const kind = GRAPH_KIND[a.trap as keyof typeof GRAPH_KIND]
      expect(kind, a.trap).toBeTruthy()
      expect(gradePiecewiseValue(pieces, first!.x, first!.valueText).verdict).toBe('correct')
      const wrong = gradePiecewiseValue(pieces, first!.x, first!.trapText!)
      expect(wrong.verdict, `${p.id} ${first!.trapText}`).toBe('mistake')
      if (wrong.verdict === 'mistake') expect(wrong.mistake).toBe(kind)
      named(a.trap)
      for (const ask of a.asks ?? []) expect(gradePiecewiseValue(pieces, ask.x, ask.valueText).verdict).toBe('correct')
      asks.add(a.asks?.length ?? 0)
      if (a.valueText === undefined && first?.valueText === 'undefined') gaps++
      assertHidden(p, (a.asks ?? []).flatMap((ask) => [ask.valueText, ask.trapText ?? '']), (a.asks ?? []).map((ask) => `f(${ask.x})`))
    }
    expect(asks.has(1)).toBe(true)
    expect(asks.has(2)).toBe(true)
    expect(triple).toBeGreaterThan(0)
    expect(squares).toBeGreaterThan(0)
    expect(abs).toBeGreaterThan(0)
    expect(halves).toBeGreaterThan(0)
    expect(gaps).toBeGreaterThan(0)
    expect(ops.has('<')).toBe(true)
    expect(ops.has('<=')).toBe(true)
  }, 120_000)
})

describe('pw.domain over 300 seeds', () => {
  const problems = list('pw.domain')

  it('is deterministic, hides the intervals, and each promised slip is a real set', () => {
    const ops = new Set<string>()
    let drawn = 0
    let gaps = 0
    let triple = 0
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'pw.domain', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.instructions).toBe(PROMPTS['pw.domain'])
      expect(p.graph).toEqual({ kind: 'none' })
      expect(a.question).toBe('domain')
      expect(Boolean(a.sketch)).toBe(p.seed % 2 === 0)
      if (a.sketch) drawn++
      expect(a.pieces?.length === 2 || a.pieces?.length === 3).toBe(true)
      if ((a.pieces?.length ?? 0) === 3) triple++
      const pieces = piecesOf(p)
      expect(piecewiseProblem(pieces), p.id).toBeNull()
      for (const piece of a.pieces ?? []) {
        expect(finiteBound(piece.lo)).toBe(true)
        expect(finiteBound(piece.hi)).toBe(true)
        for (const op of piece.condition.match(/<=|>=|<|>/g) ?? []) ops.add(op)
      }
      expect(gradePwSet(a.pieces ?? [], 'domain', a.domainText!).verdict, p.id).toBe('correct')
      expect(gradePwSet(a.pieces ?? [], 'range', a.rangeText!).verdict, p.id).toBe('correct')
      const promised = a.traps?.find((t) => t.id === a.trap)
      expect(promised?.text, p.id).toBeTruthy()
      const kind = a.trap.startsWith('pw_range') ? 'range' : 'domain'
      const slip = gradePwSet(a.pieces ?? [], kind, promised!.text!)
      expect(slip.verdict, p.id).toBe('mistake')
      if (slip.verdict === 'mistake') expect(slip.id).toBe(a.trap)
      named(a.trap)
      const built = fromStored(a.pieces ?? [])
      expect(built, p.id).not.toBeNull()
      const range = rangeOf(built!)
      const values: Rational[] = []
      for (const piece of a.pieces ?? []) {
        for (const x of probesOf(piece)) {
          const ev = evaluatePiecewise([{ formula: piece.formula, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], x)
          expect(ev?.defined, `${p.id} ${piece.formula} at ${x.n}/${x.d}`).toBe(true)
          if (!ev || !ev.defined) continue
          expect(setContains(range, ev.value), `${p.id} ${piece.formula}(${x.n}/${x.d}) = ${ev.text} outside ${a.rangeText}`).toBe(true)
          values.push(ev.value)
        }
      }
      const bounded = (a.pieces ?? []).every((piece) => piece.lo !== '-inf' && piece.lo !== 'inf' && piece.hi !== '-inf' && piece.hi !== 'inf')
      for (const part of components(range)) {
        if (bounded) {
          expect(part.lo === '-inf' || part.lo === 'inf' || part.hi === '-inf' || part.hi === 'inf', a.rangeText).toBe(false)
        }
        for (const side of ['lo', 'hi'] as const) {
          const end = part[side]
          if (end === '-inf' || end === 'inf') continue
          const closed = side === 'lo' ? part.loClosed : part.hiClosed
          const hit = values.some((v) => ratEquals(v, end))
          expect(hit, `${p.id} ${a.rangeText} ${closed ? 'misses' : 'reaches'} ${end.n}/${end.d}`).toBe(closed)
        }
      }
      if (components(setFromPieces(pieces.map((piece) => piece.interval))).length > 1) gaps++
      assertHidden(p, [a.domainText!, a.rangeText!])
    }
    expect(drawn).toBeGreaterThan(0)
    expect(drawn).toBeLessThan(problems.length)
    expect(gaps).toBeGreaterThan(0)
    expect(triple).toBeGreaterThan(0)
    expect(ops.has('<')).toBe(true)
    expect(ops.has('<=')).toBe(true)
  }, 120_000)
})

describe('pw.continuous over 300 seeds', () => {
  const problems = list('pw.continuous')

  it('is deterministic, hides k, and each continuity slip is the value that mistake produces', () => {
    const ops = new Set<string>()
    let halves = 0
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'pw.continuous', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.instructions).toBe(PROMPTS['pw.continuous'])
      expect(p.graph).toEqual({ kind: 'none' })
      expect(a.question).toBe('continuous')
      expect(a.kText).toBeTruthy()
      expect(a.pieces?.length).toBe(2)
      const pieces = piecesOf(p)
      expect(piecewiseProblem(pieces), p.id).toBeNull()
      for (const piece of a.pieces ?? []) {
        expect(finiteBound(piece.lo)).toBe(true)
        expect(finiteBound(piece.hi)).toBe(true)
        for (const op of piece.condition.match(/<=|>=|<|>/g) ?? []) ops.add(op)
      }
      const left = substituteK(a.leftFormula!, a.kText!)
      const right = substituteK(a.rightFormula!, a.kText!)
      expect(left.includes('k') || right.includes('k'), `${a.leftFormula} | ${a.rightFormula} → ${left} | ${right}`).toBe(false)
      expect(`${left} ${right}`.includes('1/2x')).toBe(false)
      if (left.includes('(1/2)x') || right.includes('(1/2)x')) halves++
      const at = a.boundary!
      const lv = evaluatePiecewise([{ formula: left, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], at)
      const rv = evaluatePiecewise([{ formula: right, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], at)
      expect(lv?.defined && rv?.defined && ratEquals(lv.value, rv.value), `${p.id} ${left} vs ${right} at ${at}`).toBe(true)
      const slips = (a.traps ?? []).flatMap((t) => (t.text ? [{ id: t.id, text: t.text }] : []))
      expect(gradeK(a.kText!, slips, a.kText!).verdict, p.id).toBe('correct')
      const promised = slips.find((s) => s.id === a.trap)
      expect(promised, p.id).toBeTruthy()
      expect(promised!.text).not.toBe(a.kText)
      const wrong = gradeK(a.kText!, slips, promised!.text)
      expect(wrong.verdict, p.id).toBe('mistake')
      if (wrong.verdict === 'mistake') expect(wrong.id).toBe(a.trap)
      named(a.trap)
      const sketch = a.sketch
      expect(sketch?.xDomain).toEqual(sketch?.yDomain)
      expect(sketch?.dots?.some((d) => d.closed)).toBe(true)
      expect(sketch?.dots?.some((d) => !d.closed)).toBe(true)
      assertHidden(p, [a.kText!])
    }
    expect(halves).toBeGreaterThan(0)
    expect([...ops].sort()).toEqual(['<', '<=', '>', '>='])
  }, 120_000)
})

describe('pw.write over 300 seeds', () => {
  const problems = list('pw.write')

  it('grades the graph by meaning, and each promised row is that mistake', () => {
    const ops = new Set<string>()
    let triple = 0
    let halves = 0
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'pw.write', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.instructions).toBe(PROMPTS['pw.write'])
      expect(p.graph).toEqual({ kind: 'none' })
      expect(a.question).toBe('write')
      expect(a.rows?.length === 2 || a.rows?.length === 3).toBe(true)
      if ((a.rows?.length ?? 0) === 3) triple++
      const pieces = piecesOf(p)
      expect(piecewiseProblem(pieces), p.id).toBeNull()
      for (const piece of a.pieces ?? []) {
        expect(finiteBound(piece.lo)).toBe(true)
        expect(finiteBound(piece.hi)).toBe(true)
        for (const op of piece.condition.match(/<=|>=|<|>/g) ?? []) ops.add(op)
        if (piece.formula.includes('(1/2)x')) halves++
      }
      const traps = (a.traps ?? []).flatMap((t) => (t.rows ? [{ id: t.id, rows: t.rows }] : []))
      const rows = a.rows ?? []
      expect(gradeWrite(pieces, traps, rows).verdict, p.id).toBe('correct')
      expect(gradeWrite(pieces, traps, [...rows].reverse()).verdict, `${p.id} reordered`).toBe('correct')
      expect(gradeWrite(pieces, traps, equivalentRows(rows)).verdict, `${p.id} ${equivalentRows(rows).map((r) => r.formula).join('; ')}`).toBe('correct')
      const promised = traps.find((t) => t.id === a.trap)
      expect(promised, p.id).toBeTruthy()
      for (const trap of traps) {
        const g = gradeWrite(pieces, traps, trap.rows)
        expect(g.verdict, `${p.id} ${trap.id}`).toBe('mistake')
        if (g.verdict === 'mistake') expect(g.id).toBe(trap.id)
      }
      named(a.trap)
      const sketch = a.sketch
      expect(sketch?.xDomain).toEqual(sketch?.yDomain)
      expect(sketch?.dots?.some((d) => d.closed)).toBe(true)
      expect(sketch?.dots?.some((d) => !d.closed)).toBe(true)
      assertHidden(p, rows.flatMap((row) => [row.formula, row.condition]))
    }
    expect(triple).toBeGreaterThan(0)
    expect(halves).toBeGreaterThan(0)
    expect(ops.has('<')).toBe(true)
    expect(ops.has('<=')).toBe(true)
  }, 120_000)
})
