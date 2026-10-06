/**
 * Reviewer's cross-check of the functionOps templates, written separately from the module: every
 * expected answer is recomputed here from the problem's own data (a table lookup, straight lines
 * between the graph's vertices, or substitution into the formulas with a mathjs instance in exact
 * fractions), and the module's grader is given the recomputed answer and the promised trap.
 */
import { all, create, type Fraction } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { AnswerSpec, ProblemInstance } from '@/content/types'
import { gradeFunctionOps } from './ops'
import { dataFromAnswer } from './generate'

const math = create(all, { number: 'Fraction' })
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SWEEP = { timeout: 180_000 }

type Ans = Extract<AnswerSpec, { type: 'functionOps' }>
type Fr = Fraction
type Lookup = (x: Fr) => Fr | null

const fr = (v: number | string): Fr => math.fraction(typeof v === 'string' ? v.replace(/−/g, '-').trim() : v) as Fr
const txt = (a: Fr): string => a.toFraction()

function answerOf(p: ProblemInstance): Ans {
  if (p.answer.type !== 'functionOps') throw new Error(`${p.id}: not a functionOps answer`)
  return p.answer
}

/** A table: only its own x-values exist. */
function tableLookup(xs: number[], ys: number[]): Lookup {
  return (x) => {
    const i = xs.findIndex((v) => math.equal(fr(v), x))
    return i < 0 ? null : fr(ys[i]!)
  }
}

/** Straight lines between vertices; nothing outside the first and last x (both ends included). */
function graphLookup(pts: { x: number; y: number }[]): Lookup {
  const sorted = pts.slice().sort((a, b) => a.x - b.x)
  return (x) => {
    for (let i = 0; i + 1 < sorted.length; i++) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      if (math.smallerEq(fr(a.x), x) && math.smallerEq(x, fr(b.x))) {
        const t = math.divide(math.subtract(x, fr(a.x)), fr(b.x - a.x)) as Fr
        return math.add(fr(a.y), math.multiply(t, fr(b.y - a.y))) as Fr
      }
    }
    return null
  }
}

/** The value the question asks for, or null when it does not exist. */
function valueOf(op: string, f: Lookup, g: Lookup, a: Fr): Fr | null {
  const both = (h: (u: Fr, v: Fr) => Fr | null): Fr | null => {
    const u = f(a)
    const v = g(a)
    return u === null || v === null ? null : h(u, v)
  }
  const chain = (...fns: Lookup[]): Fr | null => {
    let v: Fr | null = a
    for (const fn of fns.reverse()) {
      if (v === null) return null
      v = fn(v)
    }
    return v
  }
  switch (op) {
    case 'f+g': return both((u, v) => math.add(u, v) as Fr)
    case 'f-g': return both((u, v) => math.subtract(u, v) as Fr)
    case 'g-f': return both((u, v) => math.subtract(v, u) as Fr)
    case 'fg': return both((u, v) => math.multiply(u, v) as Fr)
    case 'gg': return g(a) === null ? null : (math.multiply(g(a)!, g(a)!) as Fr)
    case 'fgf': return both((u, v) => math.multiply(math.multiply(u, v), u) as Fr)
    case 'f/g': return both((u, v) => (math.equal(v, fr(0)) ? null : (math.divide(u, v) as Fr)))
    case 'f+f+g': return both((u, v) => math.add(math.add(u, u), v) as Fr)
    case 'fog': return chain(f, g)
    case 'gof': return chain(g, f)
    case 'fof': return chain(f, f)
    case 'fogog': return chain(f, g, g)
    default: throw new Error(`unknown op ${op}`)
  }
}

/** App syntax to mathjs: "x(x - 1)" is a product, not a call of x. */
function prep(text: string): string {
  return text.replace(/−/g, '-').replace(/([0-9x)])\s*\(/g, '$1*(')
}

function sub(expr: string, inner: string): string {
  return prep(expr).replace(/x/g, `(${prep(inner)})`)
}

function formulaOf(op: string, f: string, g: string): string {
  const F = `(${prep(f)})`
  const G = `(${prep(g)})`
  switch (op) {
    case 'f+g': return `${F} + ${G}`
    case 'f-g': return `${F} - ${G}`
    case 'g-f': return `${G} - ${F}`
    case 'fg': return `${F} * ${G}`
    case 'f/g': return `${F} / ${G}`
    case 'fog': return sub(f, g)
    case 'gof': return sub(g, f)
    default: throw new Error(`formula op ${op} not expected`)
  }
}

const at = (expr: string, x: number): Fr | null => {
  try {
    return math.evaluate(expr, { x: fr(x) }) as Fr
  } catch {
    return null // a 0 in a denominator
  }
}

describe.each(['ops.table', 'ops.graph'] as const)('%s', (templateId) => {
  it('expects the value recomputed from its own data, 300 seeds', SWEEP, () => {
    let undef = 0
    const ops = new Set<string>()
    for (const seed of SEEDS) {
      const p = generateProblem('functionOps', templateId, seed)
      const a = answerOf(p)
      ops.add(a.op)
      const [f, g] =
        templateId === 'ops.table'
          ? [tableLookup(a.xs!, a.fv!), tableLookup(a.xs!, a.gv!)]
          : [graphLookup(a.fPts!), graphLookup(a.gPts!)]
      if (templateId === 'ops.graph') {
        for (const pt of [...a.fPts!, ...a.gPts!]) {
          expect(Number.isInteger(pt.x) && Number.isInteger(pt.y), `${p.id}: lattice vertices`).toBe(true)
          expect(Math.abs(pt.x) <= 6 && Math.abs(pt.y) <= 6, `${p.id}: vertex (${pt.x}, ${pt.y}) inside the window`).toBe(true)
        }
      }
      const v = valueOf(a.op, f, g, fr(a.at))
      const expected = v === null ? 'undefined' : txt(v)
      if (v === null) undef++
      expect(a.answerText, `${p.id}: ${a.op} at ${a.at}`).toBe(expected)
      // Every value read off a graph is a whole number, so she can read it exactly.
      if (templateId === 'ops.graph' && v !== null) {
        for (const look of [f(fr(a.at)), g(fr(a.at))]) if (look !== null) expect(Number(look.d), `${p.id}: a fractional height`).toBe(1)
      }

      const data = dataFromAnswer(a)
      expect(gradeFunctionOps(data, expected).verdict, p.id).toBe('correct')
      if (a.trap && a.trap !== 'none') {
        expect(a.trapAnswer, p.id).not.toBe(expected)
        const t = gradeFunctionOps(data, a.trapAnswer)
        expect(t.verdict === 'mistake' && t.mistake, `${p.id}: trap ${a.trap} answer ${a.trapAnswer}`).toBe(a.trap)
      }
      if (v !== null) expect(gradeFunctionOps(data, 'undefined').verdict, p.id).not.toBe('correct')
      for (const shown of [a.prompt, a.nudge, p.instructions]) {
        if (expected === 'undefined') expect(shown, p.id).not.toMatch(/undefined|does not exist|off the/i)
      }
      expect(generateProblem('functionOps', templateId, seed)).toEqual(p)
    }
    expect(undef, 'some questions have no value').toBeGreaterThan(15)
    expect(undef, 'most questions have a value').toBeLessThan(150)
    expect(ops.size).toBeGreaterThanOrEqual(10)
  })
})

describe('ops.formula', () => {
  it('expects the formula recomputed by substitution, 300 seeds', SWEEP, () => {
    const ops = new Set<string>()
    for (const seed of SEEDS) {
      const p = generateProblem('functionOps', 'ops.formula', seed)
      const a = answerOf(p)
      ops.add(a.op)
      const mine = formulaOf(a.op, a.f!, a.g!)
      let compared = 0
      for (const x of [-3, -2, -1, 0, 1, 2, 3, 5, 7, 11]) {
        const want = at(mine, x)
        if (want === null) continue
        const got = at(prep(a.answerText), x)
        expect(got !== null && math.equal(got, want), `${p.id}: ${a.answerText} vs ${mine} at x = ${x}`).toBe(true)
        compared++
      }
      expect(compared, p.id).toBeGreaterThan(6)
      const data = dataFromAnswer(a)
      expect(gradeFunctionOps(data, a.answerText).verdict, p.id).toBe('correct')
      expect(gradeFunctionOps(data, mine.replace(/\*/g, '')).verdict, `${p.id}: unsimplified ${mine}`).toBe('correct')
      if (a.trap && a.trap !== 'none') {
        const t = gradeFunctionOps(data, a.trapAnswer)
        expect(t.verdict === 'mistake' && t.mistake, `${p.id}: trap ${a.trap}`).toBe(a.trap)
      }
      for (const shown of [a.prompt, a.nudge, p.instructions]) expect(shown, p.id).not.toContain(a.answerText)
    }
    expect([...ops].sort()).toEqual(['f+g', 'f-g', 'f/g', 'fg', 'fog', 'g-f', 'gof'])
  })
})
