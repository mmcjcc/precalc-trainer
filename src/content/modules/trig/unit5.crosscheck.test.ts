/**
 * Reviewer's cross-check of precalculus Unit 5 (docs/progress/trig-unit5.md, Review). The builder's resolve5.ts reads
 * each problem back from its words; this file takes other roads, so that a slip shared by the generator and that
 * reading would still show:
 *  - features: from the given function itself (the KaTeX on screen turned into math.js, cross-checked against the
 *    Graph it function), by exact arithmetic on its inner linear argument, not by reading A, B, C and D off the text;
 *  - an equation from a graph: the drawn curve and its labelled points against the expected function, and an equation
 *    built here from the highest and lowest labelled points, which must grade right;
 *  - matching: which of the four DRAWN curves is the function, by sampling;
 *  - models: the value from the model, and the first time by scanning the model from the story's start;
 *  - inverse functions: math.js's own asin, acos and atan on the expression shown (a complex result is "no value").
 * Nothing here asks the generators or the trig core for an answer; the graders only confirm answers made here.
 */
import { evaluate } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GraphSpec } from '@/shared/types'
import { gradeSgPart } from '../sinusoids'

const SEEDS = Number(process.env.REVIEW_T5_N ?? 300)
const SLOW = { timeout: 600_000 }
const PI = Math.PI
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

// ---------------------------------------------------------------------------
// Reading numbers and formulas
// ---------------------------------------------------------------------------

/** App or answer text ("2π/3", "-6√13/13", "π/4", "3/2") as math.js reads it. */
function appToMath(s: string): string {
  return s
    .replace(/[−–]/g, '-')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√(\d+)/g, 'sqrt($1)')
    .replace(/(sin|cos|tan)⁻¹/g, 'a$1')
    .replace(/([\d)])\s*π/g, '$1*pi')
    .replace(/π/g, 'pi')
    // The app reads "pix/3" and "πt" and "π(x + 1)" as products; math.js would read a name "pix" or a call of pi.
    .replace(/(?<![a-z])pi(?=[a-z(])/g, 'pi*')
    .replace(/∞/g, 'Infinity')
}

function num(text: string): number {
  const v = evaluate(appToMath(text.trim()))
  return typeof v === 'number' ? v : Number.NaN
}

/** The KaTeX shown on screen ("$y = -2\cos\left(\frac{2x}{3} - \frac{\pi}{3}\right) + 3$") as math.js reads it. */
function texToMath(tex: string): string {
  let s = tex.replace(/\$/g, '').replace(/^\s*[a-zA-Z]\s*(\(\s*[xt]\s*\))?\s*=\s*/, '')
  s = s.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')').replace(/\\left\|/g, 'abs(').replace(/\\right\|/g, ')')
  s = s.replace(/\\(sin|cos|tan)\^\{-1\}/g, 'a$1').replace(/\\arc(sin|cos|tan)/g, 'a$1')
  for (let i = 0; i < 12; i++) {
    const before = s
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    if (s === before) break
  }
  return s
    .replace(/\\pi/g, '(pi)')
    .replace(/\\(sin|cos|tan|sec|csc|cot)/g, '$1')
    .replace(/\\cdot/g, '*')
    .replace(/[−–]/g, '-')
}

/** A real value, or NaN where math.js gives a complex number (asin(2)) or nothing. */
function real(expr: string, scope: Record<string, number> = {}): number {
  try {
    const v = evaluate(expr, scope)
    return typeof v === 'number' ? v : Number.NaN
  } catch {
    return Number.NaN
  }
}

/** The balanced inside of the first call of `name` in a math.js string. */
function inside(expr: string, names: string[]): { name: string; arg: string } | null {
  const m = new RegExp(`(?<![a-z])(${names.join('|')})\\(`).exec(expr)
  if (!m) return null
  let depth = 0
  for (let i = m.index + m[1]!.length; i < expr.length; i++) {
    if (expr[i] === '(') depth++
    else if (expr[i] === ')' && --depth === 0) return { name: m[1]!, arg: expr.slice(m.index + m[1]!.length + 1, i) }
  }
  return null
}

/** "[1, 5]", "(-∞, -1] ∪ [3, ∞)" → its pieces as numbers with their brackets. */
function intervalPieces(text: string): { lo: number; hi: number; loC: boolean; hiC: boolean }[] {
  return text.split(/∪|U(?=\s*[([])/).map((p) => {
    const m = /^\s*([[(])\s*(.+?)\s*,\s*(.+?)\s*([\])])\s*$/.exec(p)
    if (!m) throw new Error(`interval ${text}`)
    return { lo: num(m[2]!), hi: num(m[3]!), loC: m[1] === '[', hiC: m[4] === ']' }
  })
}

/** "x = π/3 + 2kπ" → { a, p } (the family a + kp); "x = π/4, x = 3π/4" → a list. */
function familyOf(text: string): { a: number; p: number } | number[] {
  const body = text.replace(/[−–]/g, '-')
  if (/k/.test(body)) {
    const e = body
      .replace(/^\s*x\s*=\s*/, '')
      .replace(/(\d)\s*k/g, '$1*k')
      .replace(/k\s*π/g, 'k*pi')
      .replace(/(\d|\))\s*π/g, '$1*pi')
      .replace(/π/g, 'pi')
    const a = real(e, { k: 0 })
    return { a, p: real(e, { k: 1 }) - a }
  }
  return body.split(',').map((s) => num(s.replace(/^\s*x\s*=\s*/, '')))
}

const sameFamily = (f: { a: number; p: number }, a: number, p: number) => close(Math.abs(f.p), Math.abs(p), 1e-9) && close(Math.round((f.a - a) / p), (f.a - a) / p, 1e-7)

interface Part {
  id: string
  kind: string
  ask: string
  answerText: string
  check: Record<string, unknown> & { kind: string }
}
interface Answer {
  question: string
  prompt: string
  display?: string
  graphIt?: string
  figure: { kind: string; graph?: GraphSpec; graphs?: { letter: string; graph: GraphSpec }[]; legs?: Record<string, { label: string }> }
  stages: Part[]
}
const part = (a: Answer, id: string) => a.stages.find((s) => s.id === id)
const problem = (m: string, t: string, seed: number) => generateProblem(m as never, t, seed).answer as unknown as Answer

/** The given function: the KaTeX on screen, which must agree with the Graph it function where there is one. */
function givenFunction(a: Answer, where: string, wrong: string[]): string {
  const shown = texToMath(a.display ?? '')
  if (a.graphIt) {
    const git = appToMath(a.graphIt)
    for (const x of [-2.3, -0.7, 0.4, 1.9, 3.3]) {
      const u = real(shown, { x })
      const v = real(git, { x })
      if (Number.isFinite(u) && Math.abs(u) < 1e6 && !close(u, v, 1e-9)) {
        wrong.push(`${where}: Graph it ${a.graphIt} differs from the display ${a.display} at x = ${x}`)
        break
      }
    }
  }
  return shown
}

/** The inner argument of the trig function: B and inner(0) (the argument is Bx − C, so inner(0) = −C). */
function innerOf(expr: string, names: string[]): { name: string; B: number; c0: number; at: (theta: number) => number } | null {
  const call = inside(expr, names)
  if (!call) return null
  const c0 = real(call.arg, { x: 0 })
  const B = real(call.arg, { x: 1 }) - c0
  return { name: call.name, B, c0, at: (theta) => (theta - c0) / B }
}

// ---------------------------------------------------------------------------
// Sine and cosine
// ---------------------------------------------------------------------------

describe('reviewer cross-check: sinusoid features from the function itself', () => {
  it('amplitude, period, phase shift, midline, range and key points', SLOW, () => {
    const wrong: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('sinusoids', 'sg.features', seed)
      const where = `sg.features/${seed.toString(36)}`
      const f = givenFunction(a, where, wrong)
      const inner = innerOf(f, ['sin', 'cos'])
      if (!inner) {
        wrong.push(`${where}: no sin or cos in ${f}`)
        continue
      }
      const at = (theta: number) => real(f, { x: inner.at(theta) })
      const v = [0, PI / 2, PI, (3 * PI) / 2].map(at)
      const M = Math.max(...v)
      const m = Math.min(...v)
      const want: Record<string, number> = { amplitude: (M - m) / 2, period: (2 * PI) / Math.abs(inner.B), shift: inner.at(0), midline: (M + m) / 2 }
      for (const [id, value] of Object.entries(want)) {
        const p = part(a, id)
        if (!p) continue
        const got = num(String(p.check.value))
        if (!close(got, value)) wrong.push(`${where} ${id}: ${String(p.check.value)} (${got}), should be ${value} for ${a.display}`)
      }
      const r = part(a, 'range')
      if (r) {
        const [piece] = intervalPieces(String(r.check.value))
        if (!piece || !close(piece.lo, m) || !close(piece.hi, M) || !piece.loC || !piece.hiC) wrong.push(`${where} range: ${String(r.check.value)}, should be [${m}, ${M}]`)
      }
      const k = part(a, 'points')
      if (k) {
        const P = (2 * PI) / Math.abs(inner.B)
        const x0 = inner.at(0)
        const mine = [0, 1, 2, 3, 4].map((j) => [x0 + (j * P) / 4, real(f, { x: x0 + (j * P) / 4 })] as const)
        const theirs = (k.check.points as [string, string][]).map(([x, y]) => [num(x), num(y)] as const)
        const ok = theirs.length === 5 && mine.every(([x, y]) => theirs.some(([u, w]) => close(u, x) && close(w, y)))
        if (!ok) wrong.push(`${where} key points: ${JSON.stringify(k.check.points)}, should be ${mine.map(([x, y]) => `(${x.toFixed(4)}, ${y.toFixed(4)})`).join(' ')}`)
      }
    }
    expect(wrong).toEqual([])
  })
})

/** A rational number as "n/d" (the graph's labelled y-values and the factors here are rational), or null. */
function fracOrNull(v: number): string | null {
  for (let d = 1; d <= 48; d++) {
    const n = Math.round(v * d)
    if (Math.abs(n / d - v) < 1e-9) return d === 1 ? String(n) : `(${n}/${d})`
  }
  return null
}
const frac = (v: number) => fracOrNull(v) ?? String(v)
/** " + 3", " - 1/2", "" for 0. */
const plus = (v: number) => (close(v, 0) ? '' : v < 0 ? ` - ${frac(-v)}` : ` + ${frac(v)}`)

describe('reviewer cross-check: an equation from a graph or a description', () => {
  it('the drawn curve and its labels are the answer; an equation built from the labelled extremes grades right', SLOW, () => {
    const wrong: string[] = []
    let graphs = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('sinusoids', 'sg.equation', seed)
      const where = `sg.equation/${seed.toString(36)}`
      const p = part(a, 'equation')!
      const answer = appToMath(String(p.check.answer).replace(/^\s*y\s*=\s*/, ''))
      const g = a.figure.graph
      if (!g) continue
      graphs++
      // The drawn curve is the answer's.
      for (const run of g.runs ?? []) {
        for (const pt of run.filter((_, i) => i % 7 === 0)) {
          if (!close(real(answer, { x: pt.x }), pt.y, 1e-7)) {
            wrong.push(`${where}: drawn (${pt.x}, ${pt.y}) is not on ${p.check.answer as string}`)
            break
          }
        }
      }
      // Each label says its point, and the point is on the curve.
      const ms = g.markers ?? []
      for (const mk of ms) {
        const lm = /^\(\s*(.+?)\s*,\s*(.+?)\s*\)$/.exec(mk.label.replace(/[−–]/g, '-'))
        if (!lm || !close(num(lm[1]!), mk.x) || !close(num(lm[2]!), mk.y) || !close(real(answer, { x: mk.x }), mk.y, 1e-9)) wrong.push(`${where}: label ${mk.label} at (${mk.x}, ${mk.y})`)
      }
      // From the highest and lowest labelled points, nearest pair: y = A cos(B(x − x_max)) + D.
      const top = Math.max(...ms.map((q) => q.y))
      const bottom = Math.min(...ms.map((q) => q.y))
      const highs = ms.filter((q) => close(q.y, top))
      const lows = ms.filter((q) => close(q.y, bottom))
      let best: [typeof ms[number], typeof ms[number]] | null = null
      for (const h of highs) for (const l of lows) if (!best || Math.abs(h.x - l.x) < Math.abs(best[0].x - best[1].x)) best = [h, l]
      if (!best || close(top, bottom)) {
        wrong.push(`${where}: no highest and lowest labelled points (${ms.map((q) => q.label).join(' ')})`)
        continue
      }
      const [hi, lo] = best
      const half = Math.abs(hi.x - lo.x)
      const xHi = /^\(\s*(.+?)\s*,/.exec(hi.label.replace(/[−–]/g, '-'))![1]!
      // B = π/half: a number when half is a multiple of π (half = π/2 gives 2), else π over a number (half = 3 gives π/3).
      const B = fracOrNull(PI / half) ?? `(π/${frac(half)})`
      const mine = `y = ${frac((top - bottom) / 2)}cos(${B}(x - (${xHi})))${plus((top + bottom) / 2)}`
      const graded = gradeSgPart(generateProblem('sinusoids', 'sg.equation', seed).answer as never, 'equation', mine)
      if (graded.verdict !== 'correct') wrong.push(`${where}: my ${mine} graded ${graded.verdict}: ${(graded as { message?: string }).message ?? ''}`)
    }
    expect(graphs).toBeGreaterThan(SEEDS * 0.4)
    expect(wrong).toEqual([])
  })
})

describe('reviewer cross-check: sinusoidal models', () => {
  it('the value is the model’s at the time asked, and the first time is the first crossing from the story’s start', SLOW, () => {
    const wrong: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('sinusoids', 'sg.model', seed)
      const where = `sg.model/${seed.toString(36)}`
      const mp = part(a, 'model')!
      const v = String(mp.check.variable)
      const model = appToMath(String(mp.check.answer).replace(/^.*?=\s*/, ''))
      const value = part(a, 'value')
      if (value) {
        const tm = /\$t\s*=\s*([\d.]+)\$|day\s+\$(\d+)\$/.exec(value.ask)
        const t = tm ? Number(tm[1] ?? tm[2]) : Number.NaN
        if (!tm) wrong.push(`${where}: no time in "${value.ask}"`)
        else if (!close(real(model, { [v]: t }), Number(value.check.value), 1e-9)) wrong.push(`${where} value: ${String(value.check.value)}, model gives ${real(model, { [v]: t })}`)
      }
      const time = part(a, 'time')
      if (time) {
        const hm = /first[^$]*\$([\d.]+)\$/.exec(time.ask)
        if (!hm) {
          wrong.push(`${where}: no height in "${time.ask}"`)
          continue
        }
        const H = Number(hm[1])
        // Months count from t = 1 for January and days of the year from day 1; clocks and rides from t = 0.
        const start = /t = 1\$? for January|day of the year/.test(a.prompt + time.ask) ? 1 : 0
        // Scan from the start for the first crossing of H (or touching it), then bisect.
        let t0 = start
        let g0 = real(model, { [v]: t0 }) - H
        let found = g0 === 0 ? t0 : Number.NaN
        // Scan two periods at most: a year of days, else a day of hours (or less).
        const step = /365/.test(a.prompt) ? 0.004 : 0.0005
        for (let i = 1; i <= 200_000 && Number.isNaN(found); i++) {
          const t1 = start + i * step
          const g1 = real(model, { [v]: t1 }) - H
          if (g1 === 0 || Math.sign(g1) !== Math.sign(g0)) {
            let lo = t0
            let hiT = t1
            for (let k = 0; k < 80; k++) {
              const mid = (lo + hiT) / 2
              if (Math.sign(real(model, { [v]: mid }) - H) === Math.sign(g0)) lo = mid
              else hiT = mid
            }
            found = (lo + hiT) / 2
          }
          t0 = t1
          g0 = g1
        }
        if (!close(found, Number(time.check.value), 1e-6)) wrong.push(`${where} time: ${String(time.check.value)}, first crossing of ${H} from t = ${start} is ${found}`)
      }
    }
    expect(wrong).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Tangent, cotangent, secant, cosecant
// ---------------------------------------------------------------------------

describe('reviewer cross-check: tan, cot, sec and csc features from the function itself', () => {
  it('period, asymptotes, x-intercepts and range', SLOW, () => {
    const wrong: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('otherTrigGraphs', 'og.features', seed)
      const where = `og.features/${seed.toString(36)}`
      const f = givenFunction(a, where, wrong)
      const inner = innerOf(f, ['tan', 'cot', 'sec', 'csc'])
      if (!inner) {
        wrong.push(`${where}: no tan, cot, sec or csc in ${f}`)
        continue
      }
      const fn = inner.name
      const at = (theta: number) => real(f, { x: inner.at(theta) })
      const P = ((fn === 'tan' || fn === 'cot' ? 1 : 2) * PI) / Math.abs(inner.B)
      const period = part(a, 'period')
      if (period && !close(num(String(period.check.value)), P)) wrong.push(`${where} period: ${String(period.check.value)}, should be ${P} for ${a.display}`)
      // Asymptotes where the argument is π/2 + kπ (tan, sec) or kπ (cot, csc).
      const asym = { a: inner.at(fn === 'tan' || fn === 'sec' ? PI / 2 : 0), p: PI / Math.abs(inner.B) }
      // A and D: tan(θ) = 1 at θ = π/4; cot(π/4) = 1; sec(0) = 1 and sec(π) = −1; csc(π/2) = 1 and csc(3π/2) = −1.
      let A: number
      let D: number
      if (fn === 'tan') [D, A] = [at(0), at(PI / 4) - at(0)]
      else if (fn === 'cot') [D, A] = [at(PI / 2), at(PI / 4) - at(PI / 2)]
      else if (fn === 'sec') [D, A] = [(at(0) + at(PI)) / 2, (at(0) - at(PI)) / 2]
      else [D, A] = [(at(PI / 2) + at((3 * PI) / 2)) / 2, (at(PI / 2) - at((3 * PI) / 2)) / 2]
      const checkSet = (id: string, fam: { a: number; p: number }) => {
        const p = part(a, id)
        if (!p) return
        const got = familyOf(String(p.check.answer))
        const between = p.check.between as [number, number] | undefined
        if (Array.isArray(got)) {
          if (!between) return void wrong.push(`${where} ${id}: a list without an interval`)
          const mine: number[] = []
          for (let k = -400; k <= 400; k++) {
            const x = fam.a + k * fam.p
            if (x > between[0] + 1e-12 && x < between[1] - 1e-12) mine.push(x)
          }
          const ok = got.length === mine.length && mine.every((x) => got.some((y) => close(x, y)))
          if (!ok) wrong.push(`${where} ${id}: ${String(p.check.answer)} in (${between.join(', ')}), should be ${mine.map((x) => x.toFixed(4)).join(', ')}`)
        } else if (!sameFamily(got, fam.a, fam.p)) wrong.push(`${where} ${id}: ${String(p.check.answer)}, should be ${fam.a} + k·${fam.p}`)
      }
      checkSet('asymptotes', asym)
      if (part(a, 'zeros')) {
        if (fn !== 'tan' && fn !== 'cot') wrong.push(`${where}: x-intercepts asked of ${fn}`)
        const theta = fn === 'tan' ? Math.atan(-D / A) : PI / 2 - Math.atan(-D / A)
        checkSet('zeros', { a: inner.at(theta), p: PI / Math.abs(inner.B) })
      }
      const range = part(a, 'range')
      if (range) {
        const pieces = intervalPieces(String(range.check.value))
        const lo = D - Math.abs(A)
        const hi = D + Math.abs(A)
        const ok = pieces.length === 2 && pieces[0]!.lo === -Infinity && close(pieces[0]!.hi, lo) && pieces[0]!.hiC && close(pieces[1]!.lo, hi) && pieces[1]!.loC && pieces[1]!.hi === Infinity
        if (!ok) wrong.push(`${where} range: ${String(range.check.value)}, should be (-∞, ${lo}] ∪ [${hi}, ∞)`)
      }
    }
    expect(wrong).toEqual([])
  })
})

describe('reviewer cross-check: which drawn graph is the function', () => {
  it('exactly one of the four drawn curves is the given function, and it is the answer', SLOW, () => {
    const wrong: string[] = []
    const places: Record<string, number> = {}
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('otherTrigGraphs', 'og.match', seed)
      const where = `og.match/${seed.toString(36)}`
      const f = texToMath(a.display ?? '')
      const fits = (a.figure.graphs ?? []).filter(({ graph }) =>
        (graph.runs ?? []).flat().every((pt) => {
          const y = real(f, { x: pt.x })
          // A break in the drawing (NaN) or a point on an asymptote says nothing.
          if (!Number.isFinite(pt.y) || !Number.isFinite(y) || Math.abs(y) > 1e6) return true
          return close(y, pt.y, 1e-6)
        }),
      )
      const choice = part(a, 'match')!
      if (fits.length !== 1 || fits[0]!.letter !== choice.answerText) wrong.push(`${where}: ${fits.map((q) => q.letter).join(', ') || 'no graph'} fit ${a.display}; the answer is ${choice.answerText}`)
      places[choice.answerText] = (places[choice.answerText] ?? 0) + 1
    }
    expect(wrong).toEqual([])
    for (const n of Object.values(places)) expect(n / SEEDS).toBeGreaterThan(0.12)
  })
})

// ---------------------------------------------------------------------------
// Inverse functions
// ---------------------------------------------------------------------------

/** The value a part expects, as a number (NaN for "no value"). */
function expected(p: Part): number {
  const c = p.check
  if (c.kind === 'principal') return c.deg === null ? Number.NaN : (num(String(c.deg)) * PI) / 180
  if (c.kind === 'decimal') return Number(c.value)
  if (c.kind === 'function') return Number.NaN
  return String(c.value) === 'undefined' ? Number.NaN : num(String(c.value))
}

describe('reviewer cross-check: inverse trig values from math.js', () => {
  it('evaluate: every value, no value outside the domain, degrees when asked, calculator values rounded', SLOW, () => {
    const wrong: string[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('inverseTrig', 'it.evaluate', seed)
      const where = `it.evaluate/${seed.toString(36)}`
      const v = real(texToMath(a.display ?? ''))
      for (const p of a.stages) {
        const want = expected(p)
        const deg = p.check.kind === 'principal' && p.check.unit === 'deg'
        if (Number.isNaN(v)) {
          if (!Number.isNaN(want)) wrong.push(`${where}: ${a.display} has no value, the answer is ${p.answerText}`)
        } else if (p.check.kind === 'decimal') {
          const places = Number(p.check.places)
          if (Number(want.toFixed(places)) !== Number(v.toFixed(places))) wrong.push(`${where}: ${a.display} ≈ ${v}, the answer ${p.answerText}`)
        } else if (!close(want, v, 1e-9)) wrong.push(`${where}: ${a.display} = ${v}${deg ? ` (${(v * 180) / PI}°)` : ''}, the answer is ${p.answerText}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('compose: the last value is the expression’s; a reference triangle’s side and quadrant agree with it', SLOW, () => {
    const wrong: string[] = []
    let triangles = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('inverseTrig', 'it.compose', seed)
      const where = `it.compose/${seed.toString(36)}`
      const shown = texToMath(a.display ?? '')
      const last = a.stages[a.stages.length - 1]!
      if (last.check.kind === 'function') {
        // An expression in x: the composition itself, at points inside its domain.
        const expr = appToMath(String(last.check.answer).replace(/^.*?=\s*/, ''))
        for (const x of [-0.9, -0.55, -0.2, 0.15, 0.5, 0.85, 1.7, -2.4]) {
          const want = real(shown, { x })
          if (!Number.isFinite(want)) continue
          if (!close(real(expr, { x }), want, 1e-9)) {
            wrong.push(`${where}: ${last.check.answer as string} at x = ${x} is ${real(expr, { x })}, ${a.display} is ${want}`)
            break
          }
        }
        continue
      }
      const v = real(shown)
      const want = expected(last)
      if (Number.isNaN(v) ? !Number.isNaN(want) : !close(want, v, 1e-9)) wrong.push(`${where}: ${a.display} = ${v}, the answer is ${last.answerText}`)
      const quadrant = part(a, 'quadrant')
      if (quadrant) {
        triangles++
        // θ = the inner inverse function's value.
        const call = inside(shown, ['asin', 'acos', 'atan'])
        const theta = call ? real(`${call.name}(${call.arg})`) : Number.NaN
        const q = theta > PI / 2 ? 'Q2' : theta >= 0 ? 'Q1' : 'Q4'
        if (quadrant.answerText !== q) wrong.push(`${where}: θ = ${theta}, quadrant ${quadrant.answerText}`)
        for (const side of ['x', 'y', 'r'] as const) {
          const p = part(a, side)
          if (!p) continue
          const r = 1
          const coord = side === 'x' ? Math.cos(theta) : side === 'y' ? Math.sin(theta) : r
          // The triangle is scaled: compare ratios with r from the figure's label (or the part itself).
          const rLabel = a.figure.legs?.r?.label
          const rr = side === 'r' ? expected(p) : rLabel ? num(rLabel) : Number.NaN
          if (!Number.isFinite(rr) || (side !== 'r' && !close(expected(p) / rr, coord, 1e-9))) wrong.push(`${where} ${side}: ${p.answerText} with r = ${rLabel}, θ = ${theta}`)
        }
      }
    }
    expect(triangles).toBeGreaterThan(SEEDS * 0.1)
    expect(wrong).toEqual([])
  })
})
