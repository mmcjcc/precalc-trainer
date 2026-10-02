/**
 * Reviewer's cross-check of the Unit 2 modules (quadratics, polyDivision, polyZeros), written
 * separately from the templates and from src/engine/polynomials. Every polynomial is read here with
 * a mathjs instance of its own in exact fractions, turned into coefficients by evaluating it at nine
 * points, and every answer the templates expect is recomputed from those coefficients: the vertex
 * from -b/(2a), the division table by the three-row method, zeros by testing p/q candidates and
 * dividing them out, end behavior from the degree and the leading coefficient. The graders are then
 * given the recomputed answers.
 */
import { all, create, type Fraction } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { AnswerSpec, ProblemInstance } from '@/content/types'
import {
  checkSquareLine,
  gradeAxisOfSymmetry,
  gradeBottomRow,
  gradeCoefficientRow,
  gradeCrossTouch,
  gradeEndBehavior,
  gradeIsFactor,
  gradePolynomialFromZeros,
  gradeQuotient,
  gradeRationalZeros,
  gradeRemainder,
  gradeRootCandidates,
  gradeVertex,
  gradeZeros,
} from '@/engine'

const math = create(all, { number: 'Fraction' })
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SWEEP = { timeout: 180_000 }

type Fr = Fraction
const fr = (v: number | string): Fr => math.fraction(typeof v === 'string' ? v.replace(/−/g, '-').trim() : v) as Fr
const add = (a: Fr, b: Fr): Fr => math.add(a, b) as Fr
const sub = (a: Fr, b: Fr): Fr => math.subtract(a, b) as Fr
const mul = (a: Fr, b: Fr): Fr => math.multiply(a, b) as Fr
const div = (a: Fr, b: Fr): Fr => math.divide(a, b) as Fr
const eq = (a: Fr, b: Fr): boolean => math.equal(a, b) as boolean
const isZero = (a: Fr): boolean => eq(a, fr(0))
const sign = (a: Fr): number => (isZero(a) ? 0 : (math.larger(a, fr(0)) as boolean) ? 1 : -1)
const txt = (a: Fr): string => a.toFraction()

/** App syntax to something mathjs reads the same way: "x(x - 1)" is a product, not a call of x. */
function prep(text: string): string {
  return text.replace(/−/g, '-').replace(/([0-9x)])\s*\(/g, '$1*(')
}

function valueAt(text: string, x: Fr): Fr {
  return math.evaluate(prep(text), { x }) as Fr
}

/** Coefficients, constant term first, from the values at 0..8 (Newton's divided differences). */
function coefficients(text: string): Fr[] {
  const n = 9
  const dd = Array.from({ length: n }, (_, i) => valueAt(text, fr(i)))
  for (let j = 1; j < n; j++) for (let i = n - 1; i >= j; i--) dd[i] = div(sub(dd[i]!, dd[i - 1]!), fr(j))
  let poly: Fr[] = [fr(0)]
  let basis: Fr[] = [fr(1)]
  for (let j = 0; j < n; j++) {
    poly = Array.from({ length: Math.max(poly.length, basis.length) }, (_, k) => add(poly[k] ?? fr(0), mul(dd[j]!, basis[k] ?? fr(0))))
    // basis := basis * (x - j)
    basis = Array.from({ length: basis.length + 1 }, (_, k) => sub(basis[k - 1] ?? fr(0), mul(fr(j), basis[k] ?? fr(0))))
  }
  while (poly.length > 1 && isZero(poly[poly.length - 1]!)) poly.pop()
  return poly
}

const horner = (c: Fr[], x: Fr): Fr => c.reduceRight((acc, k) => add(mul(acc, x), k), fr(0))

/** The three-row method on coefficients written from the highest power down. */
function synthetic(high: Fr[], c: Fr): { products: Fr[]; bottom: Fr[] } {
  const bottom = [high[0]!]
  const products: Fr[] = []
  for (let i = 1; i < high.length; i++) {
    products.push(mul(c, bottom[i - 1]!))
    bottom.push(add(high[i]!, products[i - 1]!))
  }
  return { products, bottom }
}

function divisors(n: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= Math.abs(n); d++) if (Math.abs(n) % d === 0) out.push(d)
  return out
}

/** Every ±p/q of an integer polynomial (constant term first), without repeats, as texts. */
function candidates(c: Fr[]): Fr[] {
  const a0 = Number(txt(c[0]!))
  const an = Number(txt(c[c.length - 1]!))
  const seen = new Map<string, Fr>()
  for (const p of divisors(a0)) for (const q of divisors(an)) for (const s of [1, -1]) {
    const v = div(fr(s * p), fr(q))
    seen.set(txt(v), v)
  }
  return [...seen.values()]
}

/** Rational zeros with multiplicities, by clearing denominators, testing ±p/q and dividing each one out. */
function rationalZeros(c: Fr[]): { zero: Fr; mult: number }[] {
  let low = c.slice()
  const out: { zero: Fr; mult: number }[] = []
  let atZero = 0
  while (low.length > 1 && isZero(low[0]!)) {
    low = low.slice(1)
    atZero++
  }
  if (atZero > 0) out.push({ zero: fr(0), mult: atZero })
  const lcm = low.reduce((m, k) => (m * Number(k.d)) / gcd(m, Number(k.d)), 1)
  const whole = low.map((k) => mul(k, fr(lcm)))
  for (const z of candidates(whole)) {
    let high = low.slice().reverse()
    let mult = 0
    while (high.length > 1) {
      const { bottom } = synthetic(high, z)
      if (!isZero(bottom[bottom.length - 1]!)) break
      high = bottom.slice(0, -1)
      mult++
    }
    if (mult > 0) out.push({ zero: z, mult })
  }
  return out.sort((a, b) => sign(sub(a.zero, b.zero)))
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

function ends(c: Fr[]): { left: 'up' | 'down'; right: 'up' | 'down' } {
  const degree = c.length - 1
  const up = sign(c[degree]!) > 0
  const right = up ? 'up' : 'down'
  const left = degree % 2 === 0 ? right : up ? 'down' : 'up'
  return { left, right }
}

/** "3x^2 - x + 4" from coefficients written from the highest power down. */
function polyText(high: Fr[]): string {
  const n = high.length - 1
  const parts: string[] = []
  high.forEach((k, i) => {
    if (isZero(k) && n > 0) return
    const power = n - i
    const size = txt(math.abs(k) as Fr)
    const coef = power > 0 && size === '1' ? '' : size.includes('/') ? `(${size})` : size
    const body = power === 0 ? size : power === 1 ? `${coef}x` : `${coef}x^${power}`
    parts.push(parts.length === 0 ? (sign(k) < 0 ? `-${body}` : body) : `${sign(k) < 0 ? '-' : '+'} ${body}`)
  })
  return parts.join(' ') || '0'
}

function answerOf<T extends AnswerSpec['type']>(p: ProblemInstance, type: T): Extract<AnswerSpec, { type: T }> {
  if (p.answer.type !== type) throw new Error(`${p.id}: expected a ${type} answer`)
  return p.answer as Extract<AnswerSpec, { type: T }>
}

function pointOf(text: string): [Fr, Fr] {
  const m = /^\(\s*([^,]+),\s*([^)]+)\)$/.exec(text.trim())
  if (!m) throw new Error(`unreadable point ${text}`)
  return [fr(m[1]!), fr(m[2]!)]
}

describe('the cross-check reads polynomials the way a textbook does', () => {
  it('finds coefficients, zeros and ends of known polynomials', () => {
    expect(coefficients('2(x - 3)^2 - 5').map(txt)).toEqual(['13', '-12', '2'])
    expect(coefficients('-3x(x - 4)^2').map(txt)).toEqual(['0', '-48', '24', '-3'])
    expect(coefficients('(1/2)x^2 - 2x - 11').map(txt)).toEqual(['-11', '-2', '1/2'])
    expect(rationalZeros(coefficients('-2(x + 1)^2(x - 3)(2x - 1)^3')).map((z) => [txt(z.zero), z.mult])).toEqual([['-1', 2], ['1/2', 3], ['3', 1]])
    expect(ends(coefficients('-2(x + 1)^2(x - 3)(2x - 1)^3'))).toEqual({ left: 'down', right: 'down' })
    expect(ends(coefficients('x^3 - 7x + 6'))).toEqual({ left: 'down', right: 'up' })
    const t = synthetic([2, -3, 0, -5].map(fr), fr(2))
    expect(t.bottom.map(txt)).toEqual(['2', '1', '2', '-1'])
    expect(polyText([2, 1, 2].map(fr))).toBe('2x^2 + x + 2')
    expect(polyText([-1, 0, 4].map(fr))).toBe('-x^2 + 4')
  })
})

describe.each(['cs.form', 'cs.vertex'] as const)('quadratics %s', (templateId) => {
  it('expects the vertex of -b/(2a), 300 seeds and the fractional knob', SWEEP, () => {
    const seen = new Set<string>()
    for (const knobs of [undefined, { fractions: true }]) {
      for (const seed of SEEDS) {
        const p = knobs ? generateProblem('quadratics', templateId, seed, knobs) : generateProblem('quadratics', templateId, seed)
        const a = answerOf(p, 'quadratics')
        const c = coefficients(a.f)
        expect(c.length, p.id).toBe(3)
        const [c0, b, lead] = c as [Fr, Fr, Fr]
        expect(isZero(b), `${p.id}: b = 0 is already vertex form`).toBe(false)
        const h = div(mul(fr(-1), b), mul(fr(2), lead))
        const k = sub(c0, div(mul(b, b), mul(fr(4), lead)))
        seen.add(a.f)

        const [vh, vk] = pointOf(a.vertexText)
        expect(eq(vh, h) && eq(vk, k), `${p.id}: vertex ${a.vertexText} for ${a.f}`).toBe(true)
        expect(a.axisText.replace(/\s/g, ''), p.id).toBe(`x=${txt(h)}`)
        expect(a.opens, p.id).toBe(sign(lead) > 0 ? 'up' : 'down')
        expect(a.extremumKind, p.id).toBe(sign(lead) > 0 ? 'minimum' : 'maximum')
        expect(eq(fr(a.extremumText), k), p.id).toBe(true)
        // Vertex form and every line of the worked path are the same function as f.
        for (const line of [a.vertexForm, ...a.path.map((l) => l.text)]) {
          for (const x of [-3, -1, 0, 2, 5]) expect(eq(valueAt(line, fr(x)), horner(c, fr(x))), `${p.id}: ${line}`).toBe(true)
        }
        expect(a.path[0]!.text, p.id).toBe(a.f)
        expect(a.path[a.path.length - 1]!.text, p.id).toBe(a.vertexForm)
        expect(a.vertexForm, p.id).toMatch(/\^2/)

        expect(gradeVertex(a.f, `(${txt(h)}, ${txt(k)})`).verdict, p.id).toBe('correct')
        expect(gradeAxisOfSymmetry(a.f, `x = ${txt(h)}`).verdict, p.id).toBe('correct')
        const done = checkSquareLine(a.f, a.vertexForm)
        expect(done.verdict === 'correct' && done.done, p.id).toBe(true)
        if (!isZero(h)) expect(gradeVertex(a.f, `(${txt(mul(fr(-1), h))}, ${txt(k)})`).verdict, p.id).not.toBe('correct')

        // Nothing she sees before answering holds the answer.
        for (const shown of [a.prompt, p.instructions, a.nudge]) {
          expect(shown, p.id).not.toContain(a.vertexForm)
          expect(shown, p.id).not.toContain(a.vertexText)
        }
        if (!knobs) expect(Number(h.d), `${p.id}: default problems keep a whole-number h`).toBe(1)
        expect(generateProblem('quadratics', templateId, seed, knobs ?? {})).toEqual(knobs ? p : generateProblem('quadratics', templateId, seed, {}))
      }
    }
    expect(seen.size).toBeGreaterThan(120)
  })
})

describe.each(['sd.table', 'sd.value', 'sd.factor'] as const)('polyDivision %s', (templateId) => {
  it('expects the table worked by hand, 300 seeds', SWEEP, () => {
    let factors = 0
    let missing = 0
    for (const seed of SEEDS) {
      const p = generateProblem('polyDivision', templateId, seed)
      const a = answerOf(p, 'polyDivision')
      const c = fr(a.c)
      const high = coefficients(a.f).reverse()
      expect(high.length - 1, p.id).toBe(a.degree)
      expect(a.degree, p.id).toBeGreaterThanOrEqual(2)
      const t = synthetic(high, c)
      const remainder = t.bottom[t.bottom.length - 1]!
      if (high.some(isZero)) missing++

      expect(a.rows.coefficients, p.id).toEqual(high.map(txt))
      expect(a.rows.products, p.id).toEqual(t.products.map(txt))
      expect(a.rows.bottom, p.id).toEqual(t.bottom.map(txt))
      expect(a.remainderText, p.id).toBe(txt(remainder))
      // The remainder theorem, by plain substitution.
      expect(eq(valueAt(a.f, c), remainder), p.id).toBe(true)
      expect(a.isFactor, p.id).toBe(isZero(remainder))
      if (a.isFactor) factors++
      // quotient · (x − c) + remainder is f.
      for (const x of [-2, 0, 1, 4, 7]) {
        const back = add(mul(valueAt(a.quotientText, fr(x)), sub(fr(x), c)), remainder)
        expect(eq(back, valueAt(a.f, fr(x))), `${p.id}: quotient ${a.quotientText}`).toBe(true)
      }
      expect(a.divisor, p.id).toBe(sign(c) > 0 ? `x - ${txt(c)}` : `x + ${txt(mul(fr(-1), c))}`)
      // The value question names the number, f(−1); the other two name the divisor, x + 1.
      expect(a.prompt, p.id).toContain(templateId === 'sd.value' ? `f(${a.c.replace('-', '−')})` : a.divisor.replace('-', '−'))
      expect(a.prompt, p.id).not.toMatch(/box|placeholder|missing|opposite/i)

      expect(gradeCoefficientRow(a.f, high.map(txt).join(', ')).verdict, p.id).toBe('correct')
      expect(gradeBottomRow(a.f, a.c, t.bottom.map(txt).join(', ')).verdict, p.id).toBe('correct')
      expect(gradeQuotient(a.f, a.c, polyText(t.bottom.slice(0, -1))).verdict, p.id).toBe('correct')
      expect(gradeRemainder(a.f, a.c, txt(remainder)).verdict, p.id).toBe('correct')
      expect(gradeIsFactor(a.f, a.c, isZero(remainder)).verdict, p.id).toBe('correct')
      expect(gradeIsFactor(a.f, a.c, !isZero(remainder)).verdict, p.id).not.toBe('correct')
      // The sign slip really is a different bottom row here.
      const flipped = synthetic(high, mul(fr(-1), c)).bottom.map(txt).join(', ')
      expect(gradeBottomRow(a.f, a.c, flipped).verdict, p.id).not.toBe('correct')
      expect(generateProblem('polyDivision', templateId, seed)).toEqual(p)

      if (templateId === 'sd.value') expect(a.isFactor, `${p.id}: f(c) = 0 would make the value question a factor question`).toBe(false)
    }
    expect(missing).toBeGreaterThan(60)
    if (templateId === 'sd.factor') expect(factors > 90 && factors < 210, `${factors} factors of 300`).toBe(true)
  })
})

describe('polyZeros pz.zeros', () => {
  it('expects the zeros found by dividing them out, 300 seeds', SWEEP, () => {
    for (const seed of SEEDS) {
      const p = generateProblem('polyZeros', 'pz.zeros', seed)
      const a = answerOf(p, 'polyZeros')
      const c = coefficients(a.f)
      const found = rationalZeros(c)
      expect(found.reduce((s, z) => s + z.mult, 0), `${p.id}: every zero of ${a.f} is rational`).toBe(c.length - 1)
      expect(a.zeros.map((z) => [z.text, z.mult]), p.id).toEqual(found.map((z) => [txt(z.zero), z.mult]))
      expect(a.zeros.map((z) => z.behavior), p.id).toEqual(found.map((z) => (z.mult % 2 === 1 ? 'crosses' : 'touches')))
      expect(a.end, p.id).toEqual(ends(c))
      expect(a.prompt, p.id).not.toMatch(/odd|even|opposite|multiplicity of \d/i)
      for (const z of found) expect(a.prompt, p.id).not.toMatch(new RegExp(`x = ${txt(z.zero).replace('-', '[-−]')}\\b`))

      expect(gradeZeros(a.f, found.map((z) => ({ zero: txt(z.zero), mult: z.mult }))).verdict, p.id).toBe('correct')
      expect(gradeCrossTouch(a.f, found.map((z) => (z.mult % 2 === 1 ? 'crosses' : 'touches'))).verdict, p.id).toBe('correct')
      // Every sign flipped is not accepted (no pair of opposite zeros hides the slip).
      const flipped = found.map((z) => ({ zero: txt(mul(fr(-1), z.zero)), mult: z.mult }))
      expect(gradeZeros(a.f, flipped).verdict, p.id).not.toBe('correct')
      expect(generateProblem('polyZeros', 'pz.zeros', seed)).toEqual(p)
    }
  })
})

describe('polyZeros pz.end', () => {
  it('expects the ends the degree and the leading coefficient give, 300 seeds', SWEEP, () => {
    const shapes = new Set<string>()
    for (const seed of SEEDS) {
      const p = generateProblem('polyZeros', 'pz.end', seed)
      const a = answerOf(p, 'polyZeros')
      const c = coefficients(a.f)
      const e = ends(c)
      shapes.add(`${e.left}/${e.right}`)
      expect(a.end, `${p.id}: ${a.f}`).toEqual(e)
      // The same answer from the values far out on both sides.
      expect(sign(valueAt(a.f, fr(1000))) > 0 ? 'up' : 'down', p.id).toBe(e.right)
      expect(sign(valueAt(a.f, fr(-1000))) > 0 ? 'up' : 'down', p.id).toBe(e.left)
      expect(a.prompt, p.id).not.toMatch(/odd|even|negative|positive|degree \d/i)
      expect(gradeEndBehavior(a.f, e).verdict, p.id).toBe('correct')
      expect(gradeEndBehavior(a.f, { left: e.right === 'up' ? 'down' : 'up', right: e.right }).verdict === 'correct', p.id).toBe(e.left !== e.right)
    }
    expect(shapes.size).toBe(4)
  })
})

describe('polyZeros pz.build', () => {
  it('expects the least-degree polynomial through the point, 300 seeds', SWEEP, () => {
    for (const seed of SEEDS) {
      const p = generateProblem('polyZeros', 'pz.build', seed)
      const a = answerOf(p, 'polyZeros')
      expect(a.form, p.id).toBe('hidden')
      const c = coefficients(a.f)
      const given = a.zeros.map((z) => ({ zero: fr(z.text), mult: z.mult }))
      const found = rationalZeros(c)
      // Exactly the given zeros with the given multiplicities, and nothing more (least degree).
      expect(found.map((z) => [txt(z.zero), z.mult]), p.id).toEqual(
        given.slice().sort((x, y) => sign(sub(x.zero, y.zero))).map((z) => [txt(z.zero), z.mult]),
      )
      expect(c.length - 1, p.id).toBe(given.reduce((s, z) => s + z.mult, 0))
      const point = a.point!
      expect(eq(horner(c, fr(point.x)), fr(point.y)), `${p.id}: f(${point.x}) = ${point.y}`).toBe(true)
      expect(isZero(fr(point.y)), `${p.id}: the point must not be a zero`).toBe(false)
      // The answer is never on screen; the zeros and the point are.
      for (const shown of [a.prompt, p.statementText, p.instructions]) expect(shown, p.id).not.toContain(a.f)
      expect(`${a.prompt} ${p.statementText}`.replace(/−/g, '-'), p.id).toContain(`(${point.x}, ${point.y})`)

      const spec = { zeros: a.zeros.map((z) => ({ zero: z.text, mult: z.mult })), point: { x: point.x, y: point.y } }
      expect(gradePolynomialFromZeros(spec, a.f).verdict, p.id).toBe('correct')
      expect(gradePolynomialFromZeros(spec, polyText(c.slice().reverse())).verdict, p.id).toBe('correct')
      expect(gradePolynomialFromZeros(spec, polyText(c.map((k) => mul(k, fr(2))).reverse())).verdict, p.id).not.toBe('correct')
    }
  })
})

describe('polyZeros pz.rational', () => {
  it('expects every ±p/q and the ones that are zeros, 300 seeds', SWEEP, () => {
    let none = 0
    for (const seed of SEEDS) {
      const p = generateProblem('polyZeros', 'pz.rational', seed)
      const a = answerOf(p, 'polyZeros')
      const c = coefficients(a.f)
      expect(c.every((k) => Number(k.d) === 1), `${p.id}: integer coefficients`).toBe(true)
      expect(isZero(c[0]!), `${p.id}: the constant term is not 0`).toBe(false)
      const all = candidates(c)
      const listed = new Set<string>()
      for (const item of a.candidatesText!.split(',').map((s) => s.trim())) {
        expect(item, p.id).toMatch(/^\+-/)
        const v = fr(item.slice(2))
        listed.add(txt(v))
        listed.add(txt(mul(fr(-1), v)))
      }
      expect([...listed].sort(), p.id).toEqual(all.map(txt).sort())
      expect(all.length, `${p.id}: a list this long is tedious to type`).toBeLessThanOrEqual(24)
      expect(Math.abs(Number(txt(c[0]!))), `${p.id}: p/q and q/p must differ`).not.toBe(Math.abs(Number(txt(c[c.length - 1]!))))

      const zeros = all.filter((z) => isZero(horner(c, z))).sort((x, y) => sign(sub(x, y)))
      const zerosText = zeros.length === 0 ? 'none' : zeros.map(txt).join(', ')
      if (zeros.length === 0) none++
      expect(a.rationalZerosText, p.id).toBe(zerosText)
      expect(gradeRootCandidates(a.f, all.map(txt).join(', ')).verdict, p.id).toBe('correct')
      expect(gradeRationalZeros(a.f, zerosText).verdict, p.id).toBe('correct')
      // Only the positive half, or only the whole numbers, is not the full list.
      expect(gradeRootCandidates(a.f, all.filter((z) => sign(z) > 0).map(txt).join(', ')).verdict, p.id).not.toBe('correct')
      for (const shown of [a.prompt, p.instructions]) expect(shown, p.id).not.toContain(a.candidatesText!)
    }
    expect(none).toBeLessThan(120)
  })
})
