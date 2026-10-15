/**
 * Reviewer's cross-check of the sign-chart templates, written separately from the module. The inequality
 * is evaluated directly (left minus right, exact fractions with mathjs) at every fraction p/q with q <= 6
 * on [-20, 20] and at far-out points: that decides which x solve it. The module's solution set must
 * contain exactly those x, its critical numbers must be exactly the grid points where the expression is 0
 * or undefined, and its signs must be the signs between them. Each seed's trap must be named as its trap.
 */
import { all, create, type Fraction } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { gradeScStage, type SignChartsAnswer } from './build'

const math = create(all, { number: 'Fraction' })
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SWEEP = { timeout: 180_000 }

type Fr = Fraction
const fr = (v: number | string): Fr => math.fraction(typeof v === 'string' ? v.replace(/−/g, '-').trim() : v) as Fr
const cmp = (a: Fr, b: Fr): number => Number(math.compare(a, b))
const isZero = (a: Fr): boolean => Number(a.n) === 0
const prep = (t: string): string => t.replace(/−/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/([0-9x)])\s*\(/g, '$1*(')

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}
const GRID: Fr[] = []
for (let q = 1; q <= 6; q++) for (let p = -20 * q; p <= 20 * q; p++) if (gcd(p, q) === 1) GRID.push(math.divide(fr(p), fr(q)) as Fr)
GRID.sort(cmp)
const FAR = [fr(-1000), fr(-250), fr(250), fr(1000)]

/** left - right at x, or null where it is undefined. */
function value(a: SignChartsAnswer, x: Fr): Fr | null {
  try {
    const l = math.evaluate(prep(a.left), { x })
    const r = math.evaluate(prep(a.right), { x })
    if (typeof l !== 'object' || typeof r !== 'object') return null
    return math.subtract(l as Fr, r as Fr) as Fr
  } catch {
    return null
  }
}

function holds(op: string, v: Fr): boolean {
  const c = cmp(v, fr(0))
  return op === '>' ? c > 0 : op === '>=' ? c >= 0 : op === '<' ? c < 0 : c <= 0
}

const bound = (t: string): Fr | null => (/inf/.test(t) ? null : fr(t))

/** Interval notation, "{2}", "no solution" or "(-inf, inf)" as a membership test. */
function setOf(text: string): (v: Fr) => boolean {
  const t = text.replace(/−/g, '-').replace(/∞/g, 'inf').replace(/∪/g, 'U').trim()
  if (/^(\{\s*\}|∅|no solution|none)$/i.test(t)) return () => false
  const tests = t.split(/\s*U\s*/).map((part) => {
    const point = /^\{\s*([^}]+)\s*\}$/.exec(part)
    if (point) {
      const vals = point[1]!.split(',').map((s) => fr(s))
      return (v: Fr) => vals.some((p) => cmp(p, v) === 0)
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

function answerOf(t: string, seed: number): SignChartsAnswer {
  const p = generateProblem('signCharts', t, seed)
  if (p.answer.type !== 'signCharts') throw new Error(`${p.id}: not a sign-chart answer`)
  return p.answer
}

describe.each(['sc.poly', 'sc.rational', 'sc.chart'] as const)('%s', (templateId) => {
  it('the solution set is exactly where the inequality holds, 300 seeds', SWEEP, () => {
    const shapes = new Set<string>()
    for (const seed of SEEDS) {
      const a = answerOf(templateId, seed)
      const id = `${templateId}/${seed}: ${a.inequality}`
      const inSet = setOf(a.solutionText)
      for (const x of [...GRID, ...FAR]) {
        const v = value(a, x)
        const want = v !== null && holds(a.op, v)
        expect(inSet(x), `${id}: x = ${x.toFraction()} -> ${want} (answer ${a.solutionText})`).toBe(want)
      }
      shapes.add(/no solution|\{\}|∅/i.test(a.solutionText) ? 'empty' : /\{/.test(a.solutionText) ? 'point' : 'intervals')

      // Critical numbers: where left - right is 0 or undefined, in order.
      const crit = GRID.filter((x) => {
        const v = value(a, x)
        return v === null || isZero(v)
      })
      const theirs = a.criticalText.split(',').map((s) => s.trim()).filter((s) => s && !/none/i.test(s)).map((s) => fr(s))
      expect(theirs.map((x) => x.toFraction()), `${id}: critical numbers`).toEqual(crit.map((x) => x.toFraction()))
      // Signs: one per interval between the critical numbers, at a point inside it.
      const cuts = [fr(-1000), ...crit, fr(1000)]
      const signs = cuts.slice(0, -1).map((lo, i) => {
        const mid = math.divide(math.add(lo, cuts[i + 1]!), 2) as Fr
        const v = value(a, mid)
        return v === null ? '?' : cmp(v, fr(0)) > 0 ? '+' : '-'
      })
      const theirSigns = a.signsText.replace(/[\s,]/g, '').replace(/−/g, '-').split('')
      expect(theirSigns, `${id}: signs`).toEqual(signs)

      expect(gradeScStage(a, 'solution', a.solutionText).verdict, id).toBe('correct')
      if (a.trap && a.trapAnswer) {
        const g = gradeScStage(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `${id}: trap ${a.trap} at ${a.trapStage} with ${a.trapAnswer}`).toBe(a.trap)
      }
    }
    expect(shapes.has('intervals')).toBe(true)
  })
})
