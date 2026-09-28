import { all, create } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'

/**
 * Reviewer's cross-check, written separately from the templates and the engine: every generated
 * answer is recomputed with plain float math from the problem's own parameters. It also checks what
 * the student SEES: the f-notation on screen is the same function as the formula, the words of each
 * description match the signs and sizes of a, b, h, k, piecewise functions are well defined (no
 * overlapping pieces), and rate intervals never cross a vertical asymptote.
 */

const math = create(all, { predictable: true })
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SWEEP = { timeout: 120_000 }

const PARENT: Record<string, (u: number) => number> = {
  square: (u) => u * u,
  cube: (u) => u * u * u,
  sqrt: (u) => (u >= 0 ? Math.sqrt(u) : NaN),
  cbrt: (u) => Math.cbrt(u),
  abs: (u) => Math.abs(u),
  reciprocal: (u) => (u === 0 ? NaN : 1 / u),
}

/** "3", "-1/2", "0.5", "-inf" -> number */
function num(text: string): number {
  const t = text.trim().replace(/−/g, '-')
  if (/^-?inf$/i.test(t)) return t.startsWith('-') ? -Infinity : Infinity
  const [p, q] = t.split('/')
  const v = q === undefined ? Number(p) : Number(p) / Number(q)
  if (!Number.isFinite(v)) throw new Error(`unreadable number ${text}`)
  return v
}

/** "(4, -2)" or "(1/2, -3)" -> [x, y] */
function point(text: string): [number, number] {
  const m = /^\(\s*([^,]+),\s*([^)]+)\)$/.exec(text.trim())
  if (!m) throw new Error(`unreadable point ${text}`)
  return [num(m[1]!), num(m[2]!)]
}

/** Evaluate app-syntax text (implicit multiplication, sqrt/cbrt/abs, optional f) at x. */
function evalAt(text: string, x: number, f?: (u: number) => number): number {
  const expr = text.replace(/−/g, '-')
  const v = math.evaluate(expr, f ? { x, f } : { x })
  return typeof v === 'number' ? v : NaN
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b))

function transformation(templateId: string, seed: number) {
  const inst = generateProblem('transformations', templateId, seed, {})
  if (inst.answer.type !== 'transformations') throw new Error(`${templateId}/${seed}: not a transformations answer`)
  const ans = inst.answer
  const [a, b, h, k] = [num(ans.a), num(ans.b), num(ans.h), num(ans.k)]
  const f = PARENT[ans.parent]!
  const g = (x: number) => a * f(b * (x - h)) + k
  return { ans, a, b, h, k, f, g, label: `${templateId}/${seed} ${ans.notation || ans.formula} (a=${ans.a} b=${ans.b} h=${ans.h} k=${ans.k}, ${ans.parent})` }
}

/** x values where g is defined, spread over the window. */
function samplesFor(g: (x: number) => number): number[] {
  const out: number[] = []
  for (let i = -40; i <= 40; i++) {
    const x = i / 4 + 0.137
    if (Number.isFinite(g(x))) out.push(x)
  }
  return out
}

describe.each(['tr.describe', 'tr.point', 'tr.equation'])('%s over 300 seeds', (templateId) => {
  it('the formula is a*f(b(x - h)) + k, and the f-notation on screen is the same function', SWEEP, () => {
    for (const seed of SEEDS) {
      const { ans, f, g, label } = transformation(templateId, seed)
      const xs = samplesFor(g)
      expect(xs.length, label).toBeGreaterThan(10)
      for (const x of xs) {
        expect(close(evalAt(ans.formula, x), g(x)), `${label}: formula ${ans.formula} at x=${x}`).toBe(true)
        if (ans.notation) {
          const shown = ans.notation.replace(/^g\(x\)\s*=\s*/, '')
          expect(close(evalAt(shown, x, f), g(x)), `${label}: notation ${ans.notation} at x=${x}`).toBe(true)
        }
      }
      // The parent formula shown to her is the parent.
      for (const x of [-2.5, -1, 0.5, 1, 3]) {
        const want = f(x)
        if (Number.isFinite(want)) expect(close(evalAt(ans.parentFormula, x), want), `${label}: parent ${ans.parentFormula}`).toBe(true)
      }
    }
  })

  it('the words match the numbers: direction, axis and stretch or compress', SWEEP, () => {
    for (const seed of SEEDS) {
      const { ans, a, b, h, k, label } = transformation(templateId, seed)
      const words = ans.sentences.join(' | ').toLowerCase()
      if (h > 0) expect(words, label).toMatch(/right/)
      if (h < 0) expect(words, label).toMatch(/left/)
      if (h === 0) expect(words, label).not.toMatch(/\b(left|right)\b/)
      if (k > 0) expect(words, label).toMatch(/\bup\b/)
      if (k < 0) expect(words, label).toMatch(/\bdown\b/)
      if (k === 0) expect(words, label).not.toMatch(/\b(up|down)\b/)
      if (a < 0) expect(words, label).toMatch(/x-axis/)
      if (b < 0 && ans.parent !== 'square' && ans.parent !== 'abs') expect(words, label).toMatch(/y-axis/)
      if (Math.abs(b) > 1) expect(words, label).toMatch(/compress\w* horizontally|horizontal\w* compress/)
      if (Math.abs(b) < 1) expect(words, label).toMatch(/stretch\w* horizontally|horizontal\w* stretch/)
      if (Math.abs(a) > 1) expect(words, label).toMatch(/stretch\w* vertically|vertical\w* stretch/)
      if (Math.abs(a) < 1) expect(words, label).toMatch(/compress\w* vertically|vertical\w* compress/)
    }
  })
})

describe('tr.point over 300 seeds', () => {
  it('the source point is on f and its image is (p/b + h, a*q + k)', SWEEP, () => {
    for (const seed of SEEDS) {
      const { ans, a, b, h, k, f, g, label } = transformation('tr.point', seed)
      const [p, q] = point(ans.sourcePoint!)
      const [x, y] = point(ans.imagePoint!)
      expect(close(f(p), q), `${label}: (${p}, ${q}) is not on f`).toBe(true)
      expect(close(x, p / b + h) && close(y, a * q + k), `${label}: image ${ans.imagePoint}`).toBe(true)
      expect(close(g(x), y), `${label}: the image is not on g`).toBe(true)
    }
  })
})

function piecewise(templateId: string, seed: number) {
  const inst = generateProblem('piecewiseRate', templateId, seed, {})
  if (inst.answer.type !== 'piecewiseRate') throw new Error(`${templateId}/${seed}: not a piecewiseRate answer`)
  return inst.answer
}

describe('pw.evaluate over 300 seeds', () => {
  it('the pieces never overlap, and the value comes from the piece that contains x', SWEEP, () => {
    for (const seed of SEEDS) {
      const ans = piecewise('pw.evaluate', seed)
      const pieces = ans.pieces!.map((p) => ({ ...p, lo: num(p.lo), hi: num(p.hi) }))
      const label = `pw.evaluate/${seed} ${ans.pieces!.map((p) => `${p.formula} if ${p.condition}`).join('; ')} at x=${ans.x}`
      const contains = (p: (typeof pieces)[number], x: number) =>
        (x > p.lo || (x === p.lo && p.loClosed)) && (x < p.hi || (x === p.hi && p.hiClosed))
      // Well defined: probe every endpoint and points between them.
      const probes = pieces.flatMap((p) => [p.lo, p.hi, p.lo + 0.25, p.hi - 0.25]).filter(Number.isFinite)
      for (const x of probes) expect(pieces.filter((p) => contains(p, x)).length, `${label}: pieces overlap at x=${x}`).toBeLessThanOrEqual(1)
      const x = num(ans.x!)
      const owner = pieces.find((p) => contains(p, x))
      if (!owner) expect(ans.valueText, label).toBe('undefined')
      else expect(close(evalAt(owner.formula, x), num(ans.valueText!)), `${label}: value ${ans.valueText}`).toBe(true)
    }
  })
})

describe('arc.rate over 300 seeds', () => {
  it('the rate is (f(b) - f(a)) / (b - a), and the interval never crosses an asymptote', SWEEP, () => {
    for (const seed of SEEDS) {
      const ans = piecewise('arc.rate', seed)
      const [a, b] = [num(ans.a!), num(ans.b!)]
      const label = `arc.rate/${seed} f(x) = ${ans.f} on [${ans.a}, ${ans.b}] -> ${ans.rateText}`
      const fa = evalAt(ans.f!, a)
      const fb = evalAt(ans.f!, b)
      expect(close((fb - fa) / (b - a), num(ans.rateText!)), label).toBe(true)
      for (let i = 0; i <= 400; i++) {
        const x = a + ((b - a) * i) / 400
        expect(Number.isFinite(evalAt(ans.f!, x)), `${label}: f is undefined at x=${x} inside the interval`).toBe(true)
      }
    }
  })
})
