/**
 * Independent re-solve of Honors Geometry Unit 3 (written by the reviewer, not the generator's author).
 * Every problem is solved again from its own wording with exact fractions: the angle pair from the
 * eight positions, x from the pair's relation, slopes and lines from a separate line reader, and the
 * triangle and polygon formulas. The stored answers and the promised slips must agree.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { gradeGeoStage } from './grade'

type Q = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b))
const q = (n: bigint | number, d: bigint | number = 1n): Q => {
  let N = BigInt(n)
  let D = BigInt(d)
  if (D === 0n) throw new Error('division by zero')
  if (D < 0n) [N, D] = [-N, -D]
  const g = gcd(N, D) || 1n
  return { n: N / g, d: D / g }
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
const eq = (a: Q, b: Q) => a.n === b.n && a.d === b.d
const show = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`)
const num = (a: Q) => Number(a.n) / Number(a.d)
const readQ = (text: string): Q => {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '').replace(/°$/, '').replace(/^x=/, '')
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s)
  if (!m) throw new Error(`not a number: ${text}`)
  return q(BigInt(m[1]!), BigInt(m[2] ?? 1))
}

/** "2x + 10", "x − 1", "2x", "65" as [coefficient of x, constant]. */
type Lin = [Q, Q]
function lin(text: string): Lin {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '')
  const m = /^([+-]?\d*)x([+-]\d+)?$/.exec(s)
  if (m) {
    const c = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
    return [q(c), q(Number(m[2] ?? 0))]
  }
  if (/^[+-]?\d+$/.test(s)) return [q(0), q(Number(s))]
  throw new Error(`not linear: ${text}`)
}
const at = (e: Lin, x: Q) => add(mul(e[0], x), e[1])
/** The x with a = b (or a + b = total); null when there is no single solution. */
function solveEqual(a: Lin, b: Lin): Q | null {
  const c = sub(a[0], b[0])
  return c.n === 0n ? null : div(sub(b[1], a[1]), c)
}
function solveSum(a: Lin, b: Lin, total: number): Q | null {
  const c = add(a[0], b[0])
  return c.n === 0n ? null : div(sub(q(total), add(a[1], b[1])), c)
}

// --- the eight angles ------------------------------------------------------------------------------
// Upper crossing: 1 upper-left, 2 upper-right, 3 lower-right, 4 lower-left; lower crossing 5-8 the same.
// Interior means between the two lines; left and right are sides of the transversal.
const POS: Record<number, { crossing: 'upper' | 'lower'; up: boolean; left: boolean }> = {
  1: { crossing: 'upper', up: true, left: true },
  2: { crossing: 'upper', up: true, left: false },
  3: { crossing: 'upper', up: false, left: false },
  4: { crossing: 'upper', up: false, left: true },
  5: { crossing: 'lower', up: true, left: true },
  6: { crossing: 'lower', up: true, left: false },
  7: { crossing: 'lower', up: false, left: false },
  8: { crossing: 'lower', up: false, left: true },
}
const interior = (k: number) => (POS[k]!.crossing === 'upper' ? !POS[k]!.up : POS[k]!.up)
function pairKind(a: number, b: number): string {
  const A = POS[a]!
  const B = POS[b]!
  if (A.crossing === B.crossing) {
    if (A.up !== B.up && A.left !== B.left) return 'vert'
    return 'linear'
  }
  if (A.up === B.up && A.left === B.left) return 'corr'
  if (interior(a) && interior(b)) return A.left === B.left ? 'ssi' : 'alt-int'
  if (!interior(a) && !interior(b) && A.left !== B.left) return 'alt-ext'
  return 'none'
}
/** Equal for these when the lines are parallel (or always, for vertical angles). */
const EQUAL = new Set(['corr', 'alt-int', 'alt-ext', 'vert'])
const SUPPLEMENTARY = new Set(['ssi', 'linear'])

// --- lines -----------------------------------------------------------------------------------------
/** A line as a x + b y = c, with "2/5x" read as (2/5)x. Returns the slope (null when vertical). */
interface Line {
  a: Q
  b: Q
  c: Q
}
function termsOf(side: string): { x: Q; y: Q; k: Q } {
  const s = side.replace(/−/g, '-').replace(/\s+/g, '').replace(/^\+/, '')
  const out = { x: q(0), y: q(0), k: q(0) }
  const parts = s.replace(/-/g, '+-').split('+').filter((t) => t !== '')
  for (const part of parts) {
    const m = /^(-?)(\d+(?:\/\d+)?)?\(?(\d+\/\d+)?\)?([xy])?$/.exec(part)
    if (!m) throw new Error(`term: ${part} in ${side}`)
    const sign = m[1] === '-' ? -1n : 1n
    const coefText = m[3] ?? m[2]
    const coef = coefText ? readQ(coefText) : q(1)
    const value = mul(q(sign), coef)
    if (m[4] === 'x') out.x = add(out.x, value)
    else if (m[4] === 'y') out.y = add(out.y, value)
    else out.k = add(out.k, value)
  }
  return out
}
function parseLine(text: string): Line {
  const [l, r] = text.split('=')
  if (l === undefined || r === undefined) throw new Error(`not an equation: ${text}`)
  const L = termsOf(l)
  const R = termsOf(r)
  return { a: sub(L.x, R.x), b: sub(L.y, R.y), c: sub(R.k, L.k) }
}
function lineThrough(desc: string): Line {
  const two = /^through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)$/.exec(desc.replace(/−/g, '-'))
  if (two) {
    const [x1, y1, x2, y2] = two.slice(1).map((v) => q(Number(v)))
    // (y2 - y1) x - (x2 - x1) y = (y2 - y1) x1 - (x2 - x1) y1
    const a = sub(y2!, y1!)
    const b = sub(q(0), sub(x2!, x1!))
    return { a, b, c: add(mul(a, x1!), mul(b, y1!)) }
  }
  return parseLine(desc)
}
const slopeOf = (l: Line): Q | null => (l.b.n === 0n ? null : div(sub(q(0), l.a), l.b))
const showSlope = (m: Q | null) => (m === null ? 'undefined' : show(m))
function perpendicular(m: Q | null): Q | null {
  if (m === null) return q(0)
  if (m.n === 0n) return null
  return div(q(-1), m)
}

// --- the problems ----------------------------------------------------------------------------------
const problem = (module: string, template: string, seed: number) => generateProblem(module as never, template, seed).answer as GeometryAnswer
const stage = (a: GeometryAnswer, id: string) => a.stages.find((s) => s.id === id)!
const SEEDS = Number(process.env.GEO_SEEDS ?? 2000)

function checkGrades(a: GeometryAnswer, where: string) {
  for (const s of a.stages) expect(gradeGeoStage(a, s.id, s.answerText).verdict, `${where} ${s.id} ${s.answerText}`).toBe('correct')
  const g = gradeGeoStage(a, a.trapStage, a.trapAnswer)
  expect(g.verdict === 'mistake' && g.mistake, `${where} trap ${a.trap}=${a.trapAnswer}`).toBe(a.trap)
}

describe('unit 3, solved again from the wording', () => {
  it('angle pairs: the named relationship is the one the positions give', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('geoParallel', 'gl3.pairs', seed)
      const m = /relationship between ∠(\d) and ∠(\d)\?/.exec(a.prompt)
      expect(m, a.prompt).not.toBeNull()
      expect(stage(a, 'a').answerText, `gl3.pairs/${seed} ∠${m![1]} ∠${m![2]}`).toBe(pairKind(Number(m![1]), Number(m![2])))
      checkGrades(a, `gl3.pairs/${seed}`)
    }
  }, 120000)

  it('parallel lines: x and the angle follow from the pair, with one solution and real angles', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('geoParallel', 'gl3.solve', seed)
      const where = `gl3.solve/${seed}: ${a.prompt}`
      expect(a.prompt, where).toMatch(/parallel/)
      const m = /∠(\d) = \((.+?)\)° and ∠(\d) = \((.+?)\)°\. Find x, then m∠(\d)\./.exec(a.prompt)
      expect(m, where).not.toBeNull()
      const [i, j] = [Number(m![1]), Number(m![3])]
      const [e1, e2] = [lin(m![2]!), lin(m![4]!)]
      const kind = pairKind(i, j)
      const x = EQUAL.has(kind) ? solveEqual(e1, e2) : SUPPLEMENTARY.has(kind) ? solveSum(e1, e2, 180) : null
      expect(x, `${where} (${kind})`).not.toBeNull()
      expect(show(readQ(stage(a, 'x').answerText)), where).toBe(show(x!))
      const asked = Number(m![5]) === i ? e1 : e2
      expect(show(readQ(stage(a, 'result').answerText)), where).toBe(show(at(asked, x!)))
      for (const v of [at(e1, x!), at(e2, x!)]) expect(num(v) > 0 && num(v) < 180, `${where} angle ${show(v)}`).toBe(true)
      checkGrades(a, `gl3.solve/${seed}`)
    }
  }, 120000)

  it('converses: yes or no from a deciding pair, can’t tell from any other pair, and the named pair is that pair', () => {
    const FACT: Record<string, string> = { corr: 'corr', 'alt-int': 'alt-int', 'alt-ext': 'alt-ext', ssi: 'ssi' }
    const seen = { yes: 0, no: 0, cant: 0, solve: 0 }
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('geoParallel', 'gl3.converse', seed)
      const where = `gl3.converse/${seed}: ${a.prompt}`
      const numeric = /^∠(\d) = (\d+)° and ∠(\d) = (\d+)°\. Are lines m and n parallel\?/.exec(a.prompt)
      const algebra = /^∠(\d) = \((.+?)\)° and ∠(\d) = \((.+?)\)°\. Find x so that lines m and n are parallel/.exec(a.prompt)
      expect(numeric || algebra, where).toBeTruthy()
      if (numeric) {
        const kind = pairKind(Number(numeric[1]), Number(numeric[3]))
        const [u, v] = [Number(numeric[2]), Number(numeric[4])]
        const verdict = stage(a, 'a')
        const named = stage(a, 'b')
        if (FACT[kind]) {
          // A deciding pair settles it both ways: parallel when the measures fit the pair, and not parallel
          // when they do not, since parallel lines would make them fit. The pair is named either way.
          const parallel = kind === 'ssi' ? u + v === 180 : u === v
          expect(verdict.answerText, where).toBe(parallel ? 'yes' : 'no')
          if (parallel) seen.yes++
          else seen.no++
          expect(named.answerText, where).toBe(FACT[kind])
        } else {
          // Vertical angles, a linear pair, or an unrelated pair: these measures say nothing about the lines.
          expect(verdict.answerText, `${where} (${kind})`).toBe('cant')
          expect(verdict.choices?.find((c) => c.id === 'cant')?.text, where).toMatch(/^Can.t tell/)
          expect(named.answerText, `${where} (${kind})`).toBe('none')
          expect(named.choices?.find((c) => c.id === 'none')?.text, where).toMatch(/^None/)
          seen.cant++
        }
      } else {
        const kind = pairKind(Number(algebra![1]), Number(algebra![3]))
        expect(FACT[kind], `${where}: ${kind}`).toBeDefined()
        const [e1, e2] = [lin(algebra![2]!), lin(algebra![4]!)]
        const x = kind === 'ssi' ? solveSum(e1, e2, 180) : solveEqual(e1, e2)
        expect(x, where).not.toBeNull()
        expect(show(readQ(stage(a, 'x').answerText)), where).toBe(show(x!))
        for (const v of [at(e1, x!), at(e2, x!)]) expect(num(v) > 0 && num(v) < 180, `${where} angle ${show(v)}`).toBe(true)
        expect(stage(a, 'result').answerText, where).toBe(FACT[kind])
        seen.solve++
      }
      checkGrades(a, `gl3.converse/${seed}`)
    }
    expect(seen.yes > 0 && seen.no > 0 && seen.cant > 0 && seen.solve > 0, JSON.stringify(seen)).toBe(true)
  }, 120000)

  it('slopes and lines: every answer recomputed from the given line', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('geoParallel', 'gl3.slopes', seed)
      const where = `gl3.slopes/${seed}: ${a.prompt}`
      const p = a.prompt.replace(/−/g, '-')
      const slopeQ = /^What is the slope of a line (perpendicular|parallel) to the line (.+)\?$/.exec(p)
      const lineQ = /^What is an equation of the line that passes through \((-?\d+), (-?\d+)\) and is (parallel|perpendicular) to the line (.+)\?$/.exec(p)
      const pairQ = /^The line (.+) and the line (.+) are drawn\. Are the lines parallel, perpendicular, or neither\?$/.exec(p)
      expect(slopeQ || lineQ || pairQ, where).toBeTruthy()
      if (slopeQ) {
        kinds.add('slope')
        const m = slopeOf(lineThrough(slopeQ[2]!))
        const want = slopeQ[1] === 'parallel' ? m : perpendicular(m)
        const got = stage(a, 'result').answerText
        expect(got === 'undefined' ? 'undefined' : show(readQ(got)), where).toBe(showSlope(want))
      } else if (lineQ) {
        kinds.add('line')
        const [px, py] = [q(Number(lineQ[1])), q(Number(lineQ[2]))]
        const m = slopeOf(lineThrough(lineQ[4]!))
        const want = lineQ[3] === 'parallel' ? m : perpendicular(m)
        const answer = parseLine(stage(a, 'result').answerText)
        expect(showSlope(slopeOf(answer)), `${where} slope of ${stage(a, 'result').answerText}`).toBe(showSlope(want))
        // The answer passes through the point.
        expect(eq(add(mul(answer.a, px), mul(answer.b, py)), answer.c), `${where} point`).toBe(true)
      } else {
        kinds.add('pair')
        const [m1, m2] = [slopeOf(parseLine(pairQ![1]!)), slopeOf(parseLine(pairQ![2]!))]
        const par = showSlope(m1) === showSlope(m2)
        const perp = (m1 === null && m2 !== null && m2.n === 0n) || (m2 === null && m1 !== null && m1.n === 0n) || (m1 !== null && m2 !== null && eq(mul(m1, m2), q(-1)))
        expect(stage(a, 'a').answerText, where).toBe(par ? 'par' : perp ? 'perp' : 'neither')
      }
      checkGrades(a, `gl3.slopes/${seed}`)
    }
    expect([...kinds].sort()).toEqual(['line', 'pair', 'slope'])
  }, 120000)

  it('triangles: the angle sum and the exterior angle theorem, one solution, a real triangle', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('geoPolygonAngles', 'gpa.triangle', seed)
      const where = `gpa.triangle/${seed}: ${a.prompt}`
      const sum = /^In △ABC, m∠A = \((.+?)\)°, m∠B = \((.+?)\)°, and m∠C = \((.+?)\)°\. Find x, then m∠([ABC])\.$/.exec(a.prompt)
      const ext = /^The exterior angle at C of △ABC measures \((.+?)\)°\. The remote interior angles measure \((.+?)\)° and \((.+?)\)°\. Find x, then the exterior angle\.$/.exec(a.prompt)
      expect(sum || ext, where).toBeTruthy()
      if (sum) {
        const [A, B, C] = [lin(sum[1]!), lin(sum[2]!), lin(sum[3]!)]
        const x = solveSum([add(A[0], B[0]), add(A[1], B[1])], C, 180)
        expect(x, where).not.toBeNull()
        expect(show(readQ(stage(a, 'x').answerText)), where).toBe(show(x!))
        const angles = [at(A, x!), at(B, x!), at(C, x!)]
        for (const v of angles) expect(num(v) > 0 && num(v) < 180, `${where} angle ${show(v)}`).toBe(true)
        const asked = { A: angles[0]!, B: angles[1]!, C: angles[2]! }[sum[4] as 'A' | 'B' | 'C']
        expect(show(readQ(stage(a, 'result').answerText)), where).toBe(show(asked))
      } else {
        const [E, R1, R2] = [lin(ext![1]!), lin(ext![2]!), lin(ext![3]!)]
        const x = solveEqual(E, [add(R1[0], R2[0]), add(R1[1], R2[1])])
        expect(x, `${where} (one solution)`).not.toBeNull()
        expect(show(readQ(stage(a, 'x').answerText)), where).toBe(show(x!))
        const [e, r1, r2] = [at(E, x!), at(R1, x!), at(R2, x!)]
        for (const v of [r1, r2]) expect(num(v) > 0, `${where} remote ${show(v)}`).toBe(true)
        expect(num(e) > 0 && num(e) < 180, `${where} exterior ${show(e)}`).toBe(true)
        expect(show(readQ(stage(a, 'result').answerText)), where).toBe(show(e))
      }
      checkGrades(a, `gpa.triangle/${seed}`)
    }
  }, 120000)

  it('polygons: the sums and the regular-polygon formulas, 3 to 20 sides', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('geoPolygonAngles', 'gpa.polygon', seed)
      const where = `gpa.polygon/${seed}: ${a.prompt}`
      const p = a.prompt
      let want: Q
      let n: number
      let m: RegExpExecArray | null
      if ((m = /^What is the sum of the interior angles of a convex (\d+)-gon\?$/.exec(p))) {
        n = Number(m[1])
        want = q((n - 2) * 180)
      } else if ((m = /^What is each interior angle of a regular (\d+)-gon\?$/.exec(p))) {
        n = Number(m[1])
        want = q((n - 2) * 180, n)
      } else if ((m = /^What is each exterior angle of a regular (\d+)-gon\?$/.exec(p))) {
        n = Number(m[1])
        want = q(360, n)
      } else if ((m = /^Each interior angle of a regular polygon measures (\d+(?:\/\d+)?)°\. How many sides does it have\?$/.exec(p))) {
        const angle = readQ(m[1]!)
        const sides = div(q(360), sub(q(180), angle))
        expect(sides.d, `${where} whole number of sides`).toBe(1n)
        n = Number(sides.n)
        want = sides
      } else if ((m = /^Each exterior angle of a regular polygon measures (\d+(?:\/\d+)?)°\. How many sides does it have\?$/.exec(p))) {
        const sides = div(q(360), readQ(m[1]!))
        expect(sides.d, `${where} whole number of sides`).toBe(1n)
        n = Number(sides.n)
        want = sides
      } else if ((m = /^What is the sum of the exterior angles of a convex (\d+)-gon, one at each vertex\?$/.exec(p))) {
        n = Number(m[1])
        want = q(360)
      } else {
        throw new Error(`unread: ${where}`)
      }
      expect(n >= 3 && n <= 20, `${where} sides ${n}`).toBe(true)
      expect(show(readQ(stage(a, 'result').answerText)), where).toBe(show(want))
      checkGrades(a, `gpa.polygon/${seed}`)
    }
  }, 120000)
})

describe('line answers, read as a student writes them', () => {
  it('every equivalent form of a right line is correct; the parenthesized slope too', () => {
    // Through (3, 4), perpendicular to y = 5x + 1: y = (-1/5)x + 23/5.
    const a = problem('geoParallel', 'gl3.slopes', 8)
    expect(stage(a, 'result').answerText.replace(/\s+/g, '')).toMatch(/y=-\(?1\/5\)?x\+23\/5/)
    for (const typed of ['y = -1/5x + 23/5', 'y = (-1/5)x + 23/5', 'y = -(1/5)x + 23/5', 'y = -x/5 + 23/5', 'y - 4 = -1/5(x - 3)', 'x + 5y = 23', '5y = -x + 23']) {
      expect(gradeGeoStage(a, 'result', typed).verdict, typed).toBe('correct')
    }
    expect(gradeGeoStage(a, 'result', 'y = 5x - 11').verdict).not.toBe('correct')
  })
})
