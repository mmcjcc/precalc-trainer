/**
 * Solve it again from the wording: read the polynomial she is shown, with plain integer arithmetic and a reader of
 * its own (no engine, no parser of the app), and decide each answer independently. The product the module calls
 * right must multiply back to the polynomial, and every one of its factors must be finished: no common factor,
 * a linear factor, a quadratic whose discriminant is not a square, or a cubic with no rational zero.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { FA_TEMPLATE_IDS, type FactoringAnswer } from '.'

const LOOP = 120_000

/** Coefficients from the constant term up. */
type IntPoly = number[]

/** "2x^3 - 3x^2 + x - 5" → [-5, 1, -3, 2]. Plain: whole-number terms only. */
function readSum(text: string): IntPoly {
  const terms = text.replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean)
  const out: number[] = []
  for (const t of terms) {
    const m = t.match(/^(-?)(\d*)(x(?:\^(\d+))?)?$/)
    if (!m) throw new Error(`cannot read the term ${t} of ${text}`)
    const sign = m[1] ? -1 : 1
    const coef = m[2] ? Number(m[2]) : 1
    const power = m[3] ? (m[4] ? Number(m[4]) : 1) : 0
    if (!m[3] && !m[2]) throw new Error(`empty term in ${text}`)
    while (out.length <= power) out.push(0)
    out[power]! += sign * coef
  }
  return trim(out)
}

function trim(p: IntPoly): IntPoly {
  const q = [...p]
  while (q.length && q[q.length - 1] === 0) q.pop()
  return q
}

function mul(a: IntPoly, b: IntPoly): IntPoly {
  const out = Array.from({ length: a.length + b.length - 1 }, () => 0)
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)))
  return trim(out)
}

const same = (a: IntPoly, b: IntPoly) => a.length === b.length && a.every((v, i) => v === b[i])

/** "2x(x - 2)(x^2 + 2x + 4)^2" → unit 2, factors x, (x − 2), (x^2 + 2x + 4)^2. */
function readProductText(text: string): { unit: number; factors: { p: IntPoly; mult: number }[] } {
  let rest = text.replace(/\s+/g, '')
  let unit = 1
  const lead = rest.match(/^(-?\d*)/)![1]!
  if (lead === '-') unit = -1
  else if (lead) unit = Number(lead)
  rest = rest.slice(lead.length)
  const factors: { p: IntPoly; mult: number }[] = []
  while (rest) {
    let m = rest.match(/^x(?:\^(\d+))?/)
    if (m && m[0]) {
      factors.push({ p: [0, 1], mult: m[1] ? Number(m[1]) : 1 })
      rest = rest.slice(m[0].length)
      continue
    }
    m = rest.match(/^\(([^()]+)\)(?:\^(\d+))?/)
    if (!m) throw new Error(`cannot read ${rest} in ${text}`)
    factors.push({ p: readSum(m[1]!), mult: m[2] ? Number(m[2]) : 1 })
    rest = rest.slice(m[0].length)
  }
  return { unit, factors }
}

function gcdAll(p: IntPoly): number {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a))
  return p.reduce((acc, c) => g(acc, c), 0)
}

function isSquare(n: number): boolean {
  if (n < 0) return false
  const r = Math.round(Math.sqrt(n))
  return r * r === n
}

function divisorsOf(n: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= Math.abs(n); d++) if (n % d === 0) out.push(d)
  return out
}

/** Finished over the integers: no common factor, and no further factor (by degree). */
function finished(p: IntPoly): boolean {
  if (same(p, [0, 1])) return true
  if (gcdAll(p) !== 1) return false
  if (p[0] === 0) return false
  const deg = p.length - 1
  if (deg === 1) return true
  if (deg === 2) return !isSquare(p[1]! * p[1]! - 4 * p[2]! * p[0]!)
  if (deg === 3) {
    for (const num of divisorsOf(p[0]!)) {
      for (const den of divisorsOf(p[3]!)) {
        for (const s of [1, -1]) {
          // p(s·num/den) = 0  ⇔  Σ c_k (s·num)^k den^(3−k) = 0
          const v = p.reduce((acc, c, k) => acc + c * (s * num) ** k * den ** (3 - k), 0)
          if (v === 0) return false
        }
      }
    }
    return true
  }
  throw new Error(`degree ${deg} factor: not expected`)
}

function icbrt(n: number): number | null {
  const r = Math.round(Math.cbrt(n))
  return r * r * r === n ? r : null
}

function sweep(templateId: string): FactoringAnswer[] {
  const out: FactoringAnswer[] = []
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('factoring', templateId, seed)
    if (p.answer.type !== 'factoring') throw new Error('expected factoring')
    expect(p.statementText).toBe(p.answer.f)
    out.push(p.answer)
  }
  return out
}

describe('factoring: every answer solved again from the polynomial she is shown', () => {
  for (const templateId of FA_TEMPLATE_IDS) {
    it(
      `${templateId}: the right product multiplies back and every factor is finished`,
      () => {
        for (const a of sweep(templateId)) {
          const f = readSum(a.f)
          if (a.prime) {
            // A sum of two squares: a x^2 + c with no x term, a and c positive squares, nothing in common.
            expect(f.length, a.f).toBe(3)
            expect(f[1]).toBe(0)
            expect(isSquare(f[0]!) && isSquare(f[2]!) && f[0]! > 0).toBe(true)
            expect(finished(f)).toBe(true)
            continue
          }
          const { unit, factors } = readProductText(a.answerText)
          let back: IntPoly = [unit]
          for (const fac of factors) for (let i = 0; i < fac.mult; i++) back = mul(back, fac.p)
          expect(back, `${a.f} vs ${a.answerText}`).toEqual(f)
          for (const fac of factors) expect(finished(fac.p), `${a.answerText}: ${JSON.stringify(fac.p)}`).toBe(true)
          // The number in front is the greatest common factor of the coefficients (with the sign of the lead).
          expect(Math.abs(unit), a.f).toBe(gcdAll(f))
          // The power of x in front is the lowest power in every term.
          const lowest = f.findIndex((c) => c !== 0)
          const xs = factors.filter((fac) => same(fac.p, [0, 1])).reduce((s, fac) => s + fac.mult, 0)
          expect(xs, a.f).toBe(lowest)
        }
      },
      LOOP,
    )
  }

  it(
    'fa.cubes: what is cubed is the cube root of each term inside the common factor',
    () => {
      for (const a of sweep('fa.cubes')) {
        const f = readSum(a.f)
        const lowest = f.findIndex((c) => c !== 0)
        const inner = f.slice(lowest)
        const g = gcdAll(inner)
        const top = inner[inner.length - 1]! / g
        const bottom = inner[0]! / g
        expect(inner.length, a.f).toBe(4)
        const m = icbrt(top)
        const n = icbrt(Math.abs(bottom))
        expect(m && n, a.f).toBeTruthy()
        expect(a.cubed!.first).toBe(m === 1 ? 'x' : `${m}x`)
        expect(a.cubed!.second).toBe(String(n))
        // The sign shown between the boxes is the sign of the constant term.
        expect(a.shape.s).toBe(bottom > 0 ? 1 : -1)
      }
    },
    LOOP,
  )

  it(
    'fa.grouping: each pair factored from the four coefficients 1, t, u, tu',
    () => {
      for (const a of sweep('fa.grouping')) {
        const [c0, c1, c2, c3] = readSum(a.f) as [number, number, number, number]
        expect(c3).toBe(1)
        const t = c2
        const u = c1
        expect(c0).toBe(t * u)
        const binom = t > 0 ? `x + ${t}` : `x - ${-t}`
        expect(a.pairs!.firstAnswer).toBe(`x^2(${binom})`)
        expect(a.pairs!.secondAnswer).toBe(`${u}(${binom})`)
        expect(readSum(a.pairs!.first)).toEqual([0, 0, t, 1])
        expect(readSum(a.pairs!.second)).toEqual([t * u, u])
      }
    },
    LOOP,
  )
})
