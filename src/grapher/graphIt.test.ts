import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content'
import type { OptimizationAnswer, ProblemInstance } from '@/content/types'
import { formatPoint } from './format'
import { graphItFromFinal, graphItFromStatement } from './graphIt'
import { buildModel, visibleCurves } from './model'
import { pointsOfInterest } from './poi'

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1)

/** Templates where Graph it offers the problem's own function. */
const OFFERED: Record<string, readonly string[] | 'all'> = {
  quadratics: 'all',
  polyZeros: ['pz.zeros', 'pz.end', 'pz.rational'],
  polyDivision: 'all',
  rationalFns: ['rf.features', 'rf.asymptote'],
  expLogGraphs: ['eg.features', 'eg.inverse'],
  transformations: 'all',
  piecewiseRate: ['pw.evaluate', 'pw.domain', 'pw.continuous', 'arc.rate'],
}

const offered = (moduleId: string, templateId: string) => {
  const o = OFFERED[moduleId]
  return o === 'all' || (o !== undefined && o.includes(templateId))
}

/** The rows' functions agree with the formula at many points (a hidden answer would). */
function sameFunction(rowText: string, formula: string): boolean {
  const m = buildModel([
    { id: 'a', text: rowText },
    { id: 'b', text: `y = ${formula}` },
  ])
  const f = m.curve(0)
  const g = m.curve(1)
  if (!f || !g) return false
  let agree = 0
  for (const x of [-3.3, -1.7, -0.4, 0.6, 1.9, 2.8, 4.4, 6.1]) {
    const a = f.f(x)
    const b = g.f(x)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(b))) return false
    agree++
  }
  return agree >= 3
}

function bodyOf(rowText: string): string {
  return rowText.replace(/^[A-Za-z]\(x\) = /, '').replace(/^y = /, '').replace(/ \{.*\}$/, '')
}

describe('Graph it is offered only for what the problem shows her', () => {
  for (const mod of MODULES) {
    for (const t of mod.templates) {
      const expectOffer = offered(mod.id, t.id)
      it(`${mod.id} ${t.id}: ${expectOffer ? 'its given function' : 'not offered'}`, () => {
        for (const seed of expectOffer ? SEEDS : SEEDS.slice(0, 3)) {
          let inst: ProblemInstance
          try {
            inst = generateProblem(mod.id, t.id, seed)
          } catch {
            continue
          }
          const req = graphItFromStatement(inst)
          if (!expectOffer) {
            expect(req).toBeNull()
            continue
          }
          expect(req).not.toBeNull()
          const rows = req!.rows
          // Every row reads and draws.
          const m = buildModel(rows.map((r, i) => ({ id: `r${i}`, text: r.text })))
          expect(m.rows.map((r) => r.error)).toEqual(rows.map(() => null))
          expect(visibleCurves(m).length).toBe(rows.length)
          const a = inst.answer
          // What she is shown, and nothing else.
          if (a.type === 'transformations') {
            expect(bodyOf(rows[0]!.text)).toBe(a.parentFormula)
            if (a.question === 'equation') {
              expect(rows).toHaveLength(1)
              expect(sameFunction(rows[0]!.text, a.formula)).toBe(a.parentFormula === a.formula)
            } else {
              expect(rows[1]!.text).toBe(`g(x) = ${a.notation}`)
              expect(inst.statementText).toContain(a.notation)
            }
          } else if (a.type === 'expLogGraphs') {
            expect(bodyOf(rows[0]!.text)).toBe(a.f)
            if (a.graph.finv) expect(sameFunction(rows[0]!.text, a.graph.finv)).toBe(false)
          } else if (a.type === 'piecewiseRate') {
            if (a.question === 'rate') expect(bodyOf(rows[0]!.text)).toBe(a.f)
            else if (a.question === 'continuous') {
              // k stays a letter (with a slider): its value is the answer. The pieces are the ones she is shown.
              expect(rows.map((r) => r.text)).toEqual([
                `y = ${a.leftFormula} {${a.pieces![0]!.condition}}`,
                `y = ${a.rightFormula} {${a.pieces![1]!.condition}}`,
              ])
              expect(rows[a.kSide === 'left' ? 0 : 1]!.text).toMatch(/k/)
              expect(m.sliders).toEqual(['k'])
            } else {
              rows.forEach((r, i) => expect(r.text).toBe(`y = ${a.pieces![i]!.formula} {${a.pieces![i]!.condition}}`))
            }
          } else if (a.type === 'quadratics' || a.type === 'polyZeros' || a.type === 'polyDivision' || a.type === 'rationalFns') {
            expect(rows).toHaveLength(1)
            expect(bodyOf(rows[0]!.text)).toBe(a.f)
          }
        }
      }, 120_000)
    }
  }

  it('the transformations’ g is never handed over when writing g is the question', () => {
    for (const seed of SEEDS) {
      const inst = generateProblem('transformations', 'tr.equation', seed)
      if (inst.answer.type !== 'transformations') throw new Error('expected a transformation')
      const req = graphItFromStatement(inst)!
      expect(req.rows.map((r) => r.text)).toEqual([`f(x) = ${inst.answer.parentFormula}`])
    }
  })

  it('optimization offers nothing from its statement: its final equation is an answer', () => {
    for (const t of getModule('optimization').templates) {
      for (const seed of SEEDS.slice(0, 6)) expect(graphItFromStatement(generateProblem('optimization', t.id, seed))).toBeNull()
    }
  })
})

describe('her final equation (optimization)', () => {
  const load = (templateId: string, seed: number) => generateProblem('optimization', templateId, seed).answer as OptimizationAnswer
  const finalText = (a: OptimizationAnswer) => (a.stages.find((s) => s.id === 'final') as unknown as { answerText: string }).answerText

  it('500 ft against a wall: A(x) = 500x − 2x², its maximum at (125, 31250) in the window it opens with', () => {
    const a = load('opt.wall', 982)
    expect(finalText(a)).toBe('A = 500x - 2x^2')
    const req = graphItFromFinal(a, 'A = 500x - 2x^2')!
    expect(req.rows).toEqual([{ text: 'A(x) = 500x - 2x^2' }])
    expect(req.inX).toBe(false)
    const w = req.window!
    expect(w.xMin).toBeLessThan(0)
    expect(w.xMax).toBeGreaterThan(250)
    expect(w.yMin).toBeLessThanOrEqual(0)
    expect(w.yMax).toBeGreaterThan(31250)
    const m = buildModel([{ id: 'r', text: req.rows[0]!.text }])
    const pois = pointsOfInterest({ curves: visibleCurves(m).map((c) => ({ index: c.index, fn: c.fn })), xMin: w.xMin, xMax: w.xMax })
    expect(pois.filter((p) => p.kinds.includes('max')).map((p) => formatPoint(p.x, p.y))).toEqual(['(125, 31250)'])
  })

  it('takes her own way of writing it: multiplied out or not, sides swapped, A(x) =, in y', () => {
    const a = load('opt.wall', 982)
    expect(graphItFromFinal(a, 'A = x(500 - 2x)')!.rows[0]!.text).toBe('A(x) = x(500 - 2x)')
    expect(graphItFromFinal(a, 'x(500 − 2x) = A')!.rows[0]!.text).toBe('A(x) = x(500 - 2x)')
    expect(graphItFromFinal(a, 'A(x) = -2x^2 + 500x')!.rows[0]!.text).toBe('A(x) = -2x^2 + 500x')
    const inY = graphItFromFinal(a, 'A = 250y - y^2/2')!
    expect(inY.rows[0]!.text).toBe('A(x) = 250x - x^2/2')
    expect(inY.inX).toBe(true)
    expect(inY.window!.xMax).toBeGreaterThan(500)
    // Not solved for A: the grapher solves it.
    const twice = graphItFromFinal(a, '2A = 1000x - 4x^2')!
    const m = buildModel([{ id: 'r', text: twice.rows[0]!.text }])
    expect(m.curve(0)!.f(125)).toBeCloseTo(31250, 9)
  })

  it('every template’s final equation graphs with its extreme at the vertex', () => {
    for (const t of ['opt.wall', 'opt.pens', 'opt.numbers', 'opt.revenue']) {
      for (const seed of SEEDS.slice(0, 8)) {
        const a = load(t, seed)
        const req = graphItFromFinal(a, finalText(a))
        expect(req).not.toBeNull()
        const m = buildModel([{ id: 'r', text: req!.rows[0]!.text }])
        const f = m.curve(0)!.f
        // The vertex of the quadratic, from three values.
        const c = f(0)
        const p = f(1) - c
        const q = f(-1) - c
        const qa = (p + q) / 2
        const qb = (p - q) / 2
        const vx = -qb / (2 * qa)
        const w = req!.window!
        expect(vx).toBeGreaterThan(w.xMin)
        expect(vx).toBeLessThan(w.xMax)
        expect(f(vx)).toBeGreaterThan(w.yMin)
        expect(f(vx)).toBeLessThan(w.yMax)
        const pois = pointsOfInterest({ curves: visibleCurves(m).map((cv) => ({ index: cv.index, fn: cv.fn })), xMin: w.xMin, xMax: w.xMax })
        const turn = pois.find((pt) => pt.kinds.includes(a.goal === 'max' ? 'max' : 'min'))
        expect(turn).toBeTruthy()
        expect(turn!.x).toBeCloseTo(vx, 6)
      }
    }
  }, 120_000)

  it('cannot be read: nothing to graph', () => {
    const a = load('opt.wall', 982)
    expect(graphItFromFinal(a, 'A = ')).toBeNull()
    expect(graphItFromFinal(a, 'A = xy')).toBeNull()
  })
})
