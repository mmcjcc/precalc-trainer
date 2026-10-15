/**
 * Independent cross-check of Honors Geometry Unit 1 (written by the reviewer, not the generator's author).
 * Each problem is solved again from its own wording (the prompt, or the figure's description for the
 * coordinate problems) with exact fractions, and compared with the stored answers. The promised slip is
 * recomputed from the same wording and graded.
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
const show = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`)
const num = (a: Q) => Number(a.n) / Number(a.d)

/** "2x + 3", "x − 4", "4x", "41" as [coefficient, constant]. */
type Lin = [Q, Q]
function lin(text: string): Lin {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '')
  const m = /^([+-]?\d*)x([+-]\d+)?$/.exec(s)
  if (m) {
    const c = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
    return [q(c), q(Number(m[2] ?? 0))]
  }
  if (/^[+-]?\d+$/.test(s)) return [q(0), q(Number(s))]
  throw new Error(`not a linear expression: ${text}`)
}
const at = (e: Lin, x: Q) => add(mul(e[0], x), e[1])
const scale = (k: number, e: Lin): Lin => [mul(q(k), e[0]), mul(q(k), e[1])]
const plus = (a: Lin, b: Lin): Lin => [add(a[0], b[0]), add(a[1], b[1])]
/** The x with left = right; null when the equation has no single solution. */
function solve(left: Lin, right: Lin): Q | null {
  const c = sub(left[0], right[0])
  if (c.n === 0n) return null
  return div(sub(right[1], left[1]), c)
}

function readNumber(text: string): Q {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '').replace(/^x=/, '')
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s)
  if (!m) throw new Error(`not a number: ${text}`)
  return q(BigInt(m[1]), BigInt(m[2] ?? 1))
}
function readPoint(text: string): [Q, Q] {
  const m = /^\((.+),(.+)\)$/.exec(text.replace(/\s+/g, ''))
  if (!m) throw new Error(`not a point: ${text}`)
  return [readNumber(m[1]), readNumber(m[2])]
}
/** k√m from "5", "3√5", "√13", "3 sqrt(5)". */
function readRadical(text: string): { k: bigint; m: bigint } {
  const s = text.replace(/\s+/g, '').replace(/sqrt\((\d+)\)/, '√$1')
  if (/^\d+$/.test(s)) return { k: BigInt(s), m: 1n }
  const r = /^(\d*)√(\d+)$/.exec(s)
  if (!r) throw new Error(`not a radical: ${text}`)
  return { k: BigInt(r[1] || 1), m: BigInt(r[2]) }
}
const squareFree = (m: bigint) => {
  for (let f = 2n; f * f <= m; f++) if (m % (f * f) === 0n) return false
  return true
}

interface Worked {
  x?: Q
  result: Q | [Q, Q] | { k: bigint; m: bigint }
  /** What each slip produces, recomputed from the wording. */
  slips: Record<string, Q[] | [Q, Q] | Q>
  /** Measures that must be positive (lengths) or strictly between 0 and 180 (angles). */
  lengths?: Q[]
  angles?: Q[]
}

const NAME = /^[A-Z]{2}$/
function workSegmentAddition(p: string): Worked {
  const m =
    /^([A-Z]) is between ([A-Z]) and ([A-Z]), with ([A-Z]{2}) = (.+?), ([A-Z]{2}) = (.+?), and ([A-Z]{2}) = (.+?)\. Find x, then the length of ([A-Z]{2})\.$/.exec(
      p,
    )
  if (!m) throw new Error(`unread: ${p}`)
  const [, mid, e1, e2, n1, t1, n2, t2, n3, t3, asked] = m
  const parts = { [n1]: lin(t1), [n2]: lin(t2), [n3]: lin(t3) }
  const halfA = [e1 + mid, mid + e1].find((k) => k in parts)!
  const halfB = [mid + e2, e2 + mid].find((k) => k in parts)!
  const whole = [e1 + e2, e2 + e1].find((k) => k in parts)!
  expect(halfA && halfB && whole, p).toBeTruthy()
  const x = solve(plus(parts[halfA], parts[halfB]), parts[whole])
  expect(x, `no single solution: ${p}`).not.toBeNull()
  const value = (k: string) => at(parts[k], x!)
  return {
    x: x!,
    result: value(asked),
    slips: {
      geo_parts_equal: solve(parts[halfA], parts[halfB]) ?? [],
      geo_part_equals_whole: [solve(parts[halfA], parts[whole]), solve(parts[halfB], parts[whole])].filter(
        (v): v is Q => v !== null,
      ),
      geo_answered_x: x!,
      geo_half_for_whole: value(whole),
    },
    lengths: [value(halfA), value(halfB), value(whole)],
  }
}

function workAngleAddition(p: string): Worked {
  const m =
    /^([A-Z]) is in the interior of ∠([A-Z]{3}), with m∠([A-Z]{3}) = (.+?), m∠([A-Z]{3}) = (.+?), and m∠([A-Z]{3}) = (.+?)\. Find x, then m∠([A-Z]{3})\.$/.exec(
      p,
    )
  if (!m) throw new Error(`unread: ${p}`)
  const [, inner, whole, n1, t1, n2, t2, n3, t3, asked] = m
  const parts = { [n1]: lin(t1), [n2]: lin(t2), [n3]: lin(t3) }
  const [a, v, c] = whole.split('')
  const halfA = [a + v + inner, inner + v + a].find((k) => k in parts)!
  const halfB = [inner + v + c, c + v + inner].find((k) => k in parts)!
  expect(halfA && halfB && whole in parts, p).toBeTruthy()
  const x = solve(plus(parts[halfA], parts[halfB]), parts[whole])
  expect(x, `no single solution: ${p}`).not.toBeNull()
  const value = (k: string) => at(parts[k], x!)
  return {
    x: x!,
    result: value(asked),
    slips: {
      geo_parts_equal: solve(parts[halfA], parts[halfB]) ?? [],
      geo_part_equals_whole: [solve(parts[halfA], parts[whole]), solve(parts[halfB], parts[whole])].filter(
        (v): v is Q => v !== null,
      ),
      geo_answered_x: x!,
      geo_half_for_whole: value(whole),
    },
    angles: [value(halfA), value(halfB), value(whole)],
  }
}

/** Midpoint of a segment or bisector of an angle: two given measures, one of them maybe the whole. */
function workHalves(p: string): Worked {
  const seg = /^([A-Z]) is the midpoint of ([A-Z]{2})\. ([A-Z]{2}) = (.+?) and ([A-Z]{2}) = (.+?)\. Find x, then the length of ([A-Z]{2})\.$/.exec(p)
  const ang = /^([A-Z]{2}) bisects ∠([A-Z]{3})\. m∠([A-Z]{3}) = (.+?) and m∠([A-Z]{3}) = (.+?)\. Find x, then m∠([A-Z]{3})\.$/.exec(p)
  const m = seg ?? ang
  if (!m) throw new Error(`unread: ${p}`)
  const [, , whole, n1, t1, n2, t2, asked] = m
  expect(NAME.test(n1) || n1.length === 3).toBe(true)
  const e1 = lin(t1)
  const e2 = lin(t2)
  const secondIsWhole = n2 === whole
  expect(n1 === whole, `the first given measure is never the whole: ${p}`).toBe(false)
  const x = secondIsWhole ? solve(scale(2, e1), e2) : solve(e1, e2)
  expect(x, `no single solution: ${p}`).not.toBeNull()
  const half = at(e1, x!)
  const full = mul(q(2), half)
  const result = asked === whole ? full : half
  const measures = secondIsWhole ? [half, at(e2, x!)] : [half, at(e2, x!), full]
  return {
    x: x!,
    result,
    slips: {
      geo_part_equals_whole: secondIsWhole ? (solve(e1, e2) ?? []) : [],
      geo_half_for_whole: asked === whole ? half : full,
      geo_answered_x: x!,
    },
    ...(seg ? { lengths: measures } : { angles: measures }),
  }
}

function workPairs(p: string): Worked {
  const m =
    /^∠1 and ∠2 are (complementary|supplementary|vertical angles|a linear pair)\. m∠1 = (.+?) and m∠2 = (.+?)\. Find x, then m∠([12])\.$/.exec(
      p,
    )
  if (!m) throw new Error(`unread: ${p}`)
  const [, kind, t1, t2, asked] = m
  const e1 = lin(t1)
  const e2 = lin(t2)
  const sumTo = (total: number) => solve(plus(e1, e2), [q(0), q(total)])
  const x =
    kind === 'complementary' ? sumTo(90) : kind === 'vertical angles' ? solve(e1, e2) : sumTo(180)
  expect(x, `no single solution: ${p}`).not.toBeNull()
  const a1 = at(e1, x!)
  const a2 = at(e2, x!)
  const slips: Worked['slips'] = { geo_answered_x: x! }
  if (kind === 'complementary') slips.geo_comp_supp_swapped = sumTo(180) ?? []
  if (kind === 'supplementary') slips.geo_comp_supp_swapped = sumTo(90) ?? []
  if (kind === 'vertical angles') slips.geo_vertical_as_supplementary = sumTo(180) ?? []
  if (kind === 'a linear pair') slips.geo_linear_pair_equal = solve(e1, e2) ?? []
  if (kind === 'complementary') {
    expect(num(a1) > 0 && num(a1) < 90 && num(a2) > 0 && num(a2) < 90, p).toBe(true)
  }
  if (kind === 'vertical angles') expect(num(a1)).toBe(num(a2))
  return { x: x!, result: asked === '1' ? a1 : a2, slips, angles: [a1, a2] }
}

const TIMES: Record<string, number> = {
  '': 1,
  twice: 2,
  'three times': 3,
  'four times': 4,
  'five times': 5,
  'six times': 6,
  'seven times': 7,
  'eight times': 8,
}
function workWords(p: string): Worked {
  const m =
    /^An angle measures (?:(\d+) (more|less) than )?(?:(twice|(?:three|four|five|six|seven|eight) times) )?its (complement|supplement)\. Find the angle\.$/.exec(
      p,
    )
  if (!m) throw new Error(`unread: ${p}`)
  const [, n = '0', dir = 'more', times = '', other] = m
  const k = TIMES[times]
  expect(k, p).toBeDefined()
  const sign = dir === 'more' ? 1 : -1
  // a = k(T − a) ± n, so a(1 + k) = kT ± n.
  const angle = (total: number) => q(k * total + sign * Number(n), 1 + k)
  const T = other === 'complement' ? 90 : 180
  const a = angle(T)
  const partner = sub(q(T), a)
  expect(num(a) > 0 && num(partner) > 0, `the angle and its ${other} are positive: ${p}`).toBe(true)
  return {
    result: a,
    slips: { geo_complement_reversed: partner, geo_comp_supp_swapped: angle(T === 90 ? 180 : 90) },
    angles: [a, partner],
  }
}

function workCoordinate(p: string, aria: string): Worked {
  const s = aria.replace(/−/g, '-')
  const m = /^Point A at \((-?\d+), (-?\d+)\) and (point B|midpoint M) at \((-?\d+), (-?\d+)\) on a coordinate grid\.$/.exec(s)
  if (!m) throw new Error(`unread figure: ${aria}`)
  const [ax, ay, bx, by] = [m[1], m[2], m[4], m[5]].map((v) => q(Number(v)))
  if (p === 'Find the midpoint of AB.') {
    expect(m[3]).toBe('point B')
    const half = (u: Q, v: Q) => div(add(u, v), q(2))
    return {
      result: [half(ax, bx), half(ay, by)],
      slips: { geo_midpoint_subtracted: [div(sub(ax, bx), q(2)), div(sub(ay, by), q(2))] },
    }
  }
  if (p === 'M is the midpoint of AB. Find the coordinates of B.') {
    expect(m[3]).toBe('midpoint M')
    const half = (u: Q, v: Q) => div(add(u, v), q(2))
    return {
      result: [sub(mul(q(2), bx), ax), sub(mul(q(2), by), ay)],
      slips: { geo_endpoint_averaged: [half(ax, bx), half(ay, by)] },
    }
  }
  if (p === 'Find the distance from A to B.') {
    expect(m[3]).toBe('point B')
    const dx = sub(bx, ax)
    const dy = sub(by, ay)
    const d2 = add(mul(dx, dx), mul(dy, dy))
    expect(d2.d).toBe(1n)
    const abs = (v: Q) => (v.n < 0n ? q(-v.n, v.d) : v)
    let k = 1n
    let rest = d2.n
    for (let f = 2n; f * f <= rest; f++) while (rest % (f * f) === 0n) { rest /= f * f; k *= f }
    return {
      result: { k, m: rest },
      slips: { geo_distance_not_squared: add(abs(dx), abs(dy)), geo_distance_no_root: d2 },
    }
  }
  throw new Error(`unread: ${p}`)
}

const TEMPLATES: { module: string; template: string; work: (a: GeometryAnswer) => Worked }[] = [
  { module: 'geoSegments', template: 'gs.addition', work: (a) => workSegmentAddition(a.prompt) },
  { module: 'geoSegments', template: 'gs.midpoint', work: (a) => workHalves(a.prompt) },
  { module: 'geoSegments', template: 'gs.coord', work: (a) => workCoordinate(a.prompt, a.figure.ariaLabel) },
  { module: 'geoAngles', template: 'ga.addition', work: (a) => workAngleAddition(a.prompt) },
  { module: 'geoAngles', template: 'ga.bisector', work: (a) => workHalves(a.prompt) },
  { module: 'geoAngles', template: 'ga.pairs', work: (a) => workPairs(a.prompt) },
  { module: 'geoAngles', template: 'ga.words', work: (a) => workWords(a.prompt) },
]

/** 300 in the suite; set GEO_SEEDS for a wider sweep. */
const SEEDS = Number(process.env.GEO_SEEDS ?? 300)
const sameQ = (a: Q, b: Q) => a.n === b.n && a.d === b.d
function stageMatches(text: string, want: Worked['result']): boolean {
  if (Array.isArray(want)) {
    const [x, y] = readPoint(text)
    return sameQ(x, want[0]) && sameQ(y, want[1])
  }
  if ('k' in want) {
    const r = readRadical(text)
    return r.k === want.k && r.m === want.m
  }
  return sameQ(readNumber(text), want)
}
function slipMatches(text: string, want: Q[] | [Q, Q] | Q): boolean {
  if (Array.isArray(want) && want.length === 2 && /^\(/.test(text.trim())) {
    const [x, y] = readPoint(text)
    return sameQ(x, want[0] as Q) && sameQ(y, want[1] as Q)
  }
  const got = readNumber(text)
  return Array.isArray(want) ? want.some((w) => sameQ(got, w as Q)) : sameQ(got, want)
}

describe('geometry unit 1, solved again from the wording', () => {
  for (const t of TEMPLATES) {
    it(`${t.template}: answers, figure sizes and the promised slip agree over 300 seeds`, () => {
      const kinds = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const a = generateProblem(t.module as never, t.template, seed).answer as GeometryAnswer
        const where = `${t.template}/${seed}: ${a.prompt} [${a.figure.ariaLabel}]`
        const w = t.work(a)
        kinds.add(a.prompt.replace(/[0-9]+|[A-Z]{2,3}/g, '#').slice(0, 40))

        const xStage = a.stages.find((s) => s.id === 'x')
        const result = a.stages.find((s) => s.id === 'result')!
        if (w.x) {
          expect(xStage, where).toBeDefined()
          expect(show(readNumber(xStage!.answerText)), where).toBe(show(w.x))
        } else {
          expect(xStage, where).toBeUndefined()
        }
        expect(stageMatches(result.answerText, w.result), `${where} result ${result.answerText}`).toBe(true)
        if (!Array.isArray(w.result) && 'k' in w.result) expect(squareFree(w.result.m), where).toBe(true)

        for (const v of w.lengths ?? []) expect(num(v), `${where} length ${show(v)}`).toBeGreaterThan(0)
        for (const v of w.angles ?? []) {
          expect(num(v), `${where} angle ${show(v)}`).toBeGreaterThan(0)
          expect(num(v), `${where} angle ${show(v)}`).toBeLessThan(180)
        }

        // Every stage's own answer is right; every listed slip is a different value and is named.
        for (const s of a.stages) {
          expect(gradeGeoStage(a, s.id, s.answerText).verdict, `${where} ${s.id}`).toBe('correct')
          // What she reads while she can still retry never contains this part's answer.
          const answerHere = new RegExp(`(?<![\\d./√−-])${s.answerText.replace(/[()]/g, '\\$&')}(?![\\d/√])`)
          const replies = [
            gradeGeoStage(a, s.id, 'banana'),
            gradeGeoStage(a, s.id, s.kind === 'point' ? '(101, 103)' : '1001'),
          ]
          if (s.id === 'result' && !Array.isArray(w.result) && 'k' in w.result && w.result.k > 1n) {
            // Her value is right but not simplest: the note says what to fix, not the simplified answer.
            const unsimplified = gradeGeoStage(a, s.id, `sqrt(${w.result.k * w.result.k * w.result.m})`)
            expect(unsimplified.verdict, `${where} unsimplified`).toBe('invalid')
            replies.push(unsimplified)
          }
          const messages = replies.map((g) => (g.verdict === 'mistake' ? g.witness : g.message))
          for (const said of [s.hint, s.nudge, ...s.traps.map((t) => t.witness), ...messages]) {
            expect(said, `${where} ${s.id} says its answer ${s.answerText}`).not.toMatch(answerHere)
          }
          for (const trap of s.traps) {
            expect(trap.text, `${where} ${trap.id}`).not.toBe(s.answerText)
            const g = gradeGeoStage(a, s.id, trap.text)
            expect(g.verdict, `${where} ${s.id} ${trap.id}=${trap.text}`).toBe('mistake')
            const firstSame = s.traps.find((o) => o.text === trap.text)!
            if (g.verdict === 'mistake') expect(g.mistake, where).toBe(firstSame.id)
          }
        }

        // The promised slip is what the wording produces, and it grades as that slip.
        const want = w.slips[a.trap]
        expect(want, `${where}: no independent value for ${a.trap}`).toBeDefined()
        expect(slipMatches(a.trapAnswer, want), `${where}: ${a.trap} gave ${a.trapAnswer}`).toBe(true)
        const g = gradeGeoStage(a, a.trapStage, a.trapAnswer)
        expect(g.verdict === 'mistake' && g.mistake, where).toBe(a.trap)
      }
      expect(kinds.size, `${t.template} varies its wording`).toBeGreaterThan(0)
    }, 120000)
  }
})
