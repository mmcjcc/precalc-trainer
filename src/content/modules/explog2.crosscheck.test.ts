/**
 * Independent re-solve of Unit 3's second half. Graph features are read off the function by sampling it with
 * the app's parser and evaluator (no use of a, b, h, k); inverses are composed with f numerically; word
 * problems are solved again from the numbers printed in the sentence, times by bisection on the model rather
 * than by the closed form. The stored answers must agree at the rounding the problem asks for.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { compileExpr } from '@/engine'
import { evalNode } from '@/engine/math'
import { parseExpression } from '@/engine/parse'
import type { ExpLogPart } from '@/content/types'

const SEEDS = 300
const HEAVY = 120_000

const fn = (text: string) => {
  const g = compileExpr(text)
  return (x: number): number | null => {
    const v = g({ x })
    return v === 'undef' || !Number.isFinite(v) ? null : v
  }
}

/** A constant the app's parser reads ("13/4", "e^2 + 3"). */
function value(text: string): number {
  const p = parseExpression(text, [])
  if (!p.ok) throw new Error(`unreadable ${text}`)
  const v = evalNode(p.node, {})
  if (v === 'undef') throw new Error(`undefined ${text}`)
  return v
}

/** Root of a monotone function on [lo, hi] by bisection. */
function bisect(f: (t: number) => number, lo: number, hi: number): number {
  let a = lo
  let b = hi
  let fa = f(a)
  if (Math.sign(fa) === Math.sign(f(b))) throw new Error('no sign change')
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2
    const fm = f(m)
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m
      fa = fm
    } else b = m
  }
  return (a + b) / 2
}

function sweep(module: 'expLogGraphs' | 'expModels', template: string, check: (where: string, p: ReturnType<typeof generateProblem>) => string[]): void {
  const bad: string[] = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    const where = `${template}/${seed}`
    try {
      bad.push(...check(where, generateProblem(module, template, seed)))
    } catch (e) {
      bad.push(`${where}: ${(e as Error).message}`)
    }
  }
  expect(bad.slice(0, 12), `${bad.length} problems`).toEqual([])
}

const part = (stages: readonly ExpLogPart[], id: string) => stages.find((s) => s.id === id)!
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

describe('graphs, read off the function itself', () => {
  it('eg.features: domain, range, asymptote, intercept and direction agree with samples of f', () => {
    sweep('expLogGraphs', 'eg.features', (where, p) => {
      if (p.answer.type !== 'expLogGraphs') return [`${where}: wrong type`]
      const a = p.answer
      const f = fn(a.f)
      const bad: string[] = []
      const xs = Array.from({ length: 1201 }, (_, i) => -30 + i * 0.05)
      const defined = xs.filter((x) => f(x) !== null)
      const domain = part(a.stages, 'domain').answerText
      const range = part(a.stages, 'range').answerText
      const asym = part(a.stages, 'asymptote').answerText
      if (domain === '(-inf, inf)') {
        if (defined.length !== xs.length) bad.push(`${where}: ${a.f} is undefined somewhere on [−30, 30]`)
        // An exponential: every value on one side of the asymptote's height, and close to it far out.
        const k = Number(/^y = (-?\d+)$/.exec(asym)?.[1])
        // Far out on the flat side a value can round to k itself in floating point; those samples say nothing.
        const ys = xs.map((x) => f(x)!).filter((y) => Number.isFinite(y) && Math.abs(y - k) > 1e-9)
        const above = ys.every((y) => y > k)
        const below = ys.every((y) => y < k)
        if (!above && !below) bad.push(`${where}: values on both sides of y = ${k}`)
        const want = above ? `(${k}, inf)` : `(-inf, ${k})`
        if (range !== want) bad.push(`${where}: range ${range}, the samples say ${want}`)
        const far = Math.min(Math.abs((f(-60) ?? Infinity) - k), Math.abs((f(60) ?? Infinity) - k))
        if (!(far < 1e-6)) bad.push(`${where}: ${a.f} does not approach ${k}`)
        const y0 = f(0)!
        const point = /^\(0, (.+)\)$/.exec(part(a.stages, 'intercept').answerText)
        if (!point || !near(value(point[1]!), y0, 1e-9)) bad.push(`${where}: f(0) = ${y0}, stored ${part(a.stages, 'intercept').answerText}`)
      } else {
        const h = Number(/^\((-?\d+), inf\)$/.exec(domain)?.[1])
        if (f(h) !== null || f(h - 0.01) !== null || f(h + 1e-6) === null) bad.push(`${where}: ${a.f} is not defined exactly for x > ${h}`)
        if (asym !== `x = ${h}`) bad.push(`${where}: asymptote ${asym}`)
        if (range !== '(-inf, inf)') bad.push(`${where}: range ${range}`)
        const lowHigh = [f(h + 1e-12)!, f(h + 1e9)!]
        if (Math.max(...lowHigh.map(Math.abs)) < 5) bad.push(`${where}: a log that does not run off`)
        const point = /^\((.+), 0\)$/.exec(part(a.stages, 'intercept').answerText)
        const x0 = point ? value(point[1]!) : NaN
        if (!(Math.abs(f(x0) ?? Infinity) < 1e-9)) bad.push(`${where}: g(${x0}) is not 0`)
      }
      // Direction from two far-apart samples inside the domain.
      const ins = defined.filter((x) => Number.isFinite(f(x)!))
      const lo = f(ins[Math.floor(ins.length * 0.3)]!)!
      const hi = f(ins[Math.floor(ins.length * 0.9)]!)!
      const up = hi > lo
      if (part(a.stages, 'behavior').answerText !== (up ? 'increasing' : 'decreasing')) bad.push(`${where}: direction`)
      return bad
    })
  }, HEAVY)

  it('eg.match: the right letter is the function asked about, and each other graph is a different function', () => {
    sweep('expLogGraphs', 'eg.match', (where, p) => {
      if (p.answer.type !== 'expLogGraphs') return [`${where}: wrong type`]
      const a = p.answer
      const letter = a.stages[0]!.answerText
      const f = fn(a.f)
      const bad: string[] = []
      for (const c of a.candidates ?? []) {
        const g = fn(c.f)
        if (c.graph.f !== c.f) bad.push(`${where}: graph ${c.letter} draws ${c.graph.f}, not ${c.f}`)
        const same = [-3.3, -1.1, 0.7, 2.9, 5.3, 7.7].every((x) => {
          const u = f(x)
          const v = g(x)
          return u === null ? v === null : v !== null && near(u, v, 1e-9)
        })
        if (same !== (c.letter === letter)) bad.push(`${where}: candidate ${c.letter} ${same ? 'is' : 'is not'} f`)
      }
      return bad
    })
  }, HEAVY)

  it('eg.inverse: the stored inverse undoes f both ways', () => {
    sweep('expLogGraphs', 'eg.inverse', (where, p) => {
      if (p.answer.type !== 'expLogGraphs') return [`${where}: wrong type`]
      const f = fn(p.answer.f)
      const g = fn(p.answer.stages[0]!.answerText)
      const bad: string[] = []
      let checked = 0
      for (let x = -10; x <= 30; x += 0.37) {
        const y = f(x)
        if (y === null || Math.abs(y) > 1e6) continue
        // Where f is numerically flat (an exponential's far tail), y has lost the digits that say which x it came from.
        const step = f(x + 0.01)
        if (step === null || Math.abs(step - y) < 1e-4) continue
        const back = g(y)
        if (back === null || !near(back, x, 1e-7 * Math.max(1, Math.abs(x)))) bad.push(`${where}: f⁻¹(f(${x.toFixed(2)})) is ${back}`)
        checked++
      }
      if (checked < 10) bad.push(`${where}: too few points`)
      return bad.slice(0, 1)
    })
  }, HEAVY)
})

describe('word problems, solved again from the sentence', () => {
  const num = (s: string) => Number(s.replace(/[$,]/g, ''))
  const N: Record<string, number> = { annually: 1, semiannually: 2, quarterly: 4, monthly: 12 }

  it('em.interest: the balance, or the time by bisection on the model', () => {
    sweep('expModels', 'em.interest', (where, p) => {
      if (p.answer.type !== 'expModels') return [`${where}: wrong type`]
      const text = p.answer.prompt
      const ans = p.answer.stages[0]!
      const places = ans.places ?? 0
      const m = /(?:\$([\d,]+) is invested at|An investment earns) ([\d.]+)% interest compounded (\w+)\./.exec(text)
      if (!m) return [`${where}: unreadable “${text}”`]
      const r = Number(m[2]) / 100
      const n = m[3] === 'continuously' ? 0 : N[m[3]!]!
      const growth = (t: number) => (n === 0 ? Math.exp(r * t) : (1 + r / n) ** (n * t))
      const balance = /after (\d+) years/.exec(text)
      let mine: number
      if (balance) mine = num(m[1]!) * growth(Number(balance[1]))
      else {
        const target = /reach \$([\d,]+)/.exec(text)
        const ratio = target ? num(target[1]!) / num(m[1]!) : 2
        if (!target && !/double/.test(text)) return [`${where}: what is asked? “${text}”`]
        mine = bisect((t) => growth(t) - ratio, 0, 200)
      }
      const stored = num(ans.answerText)
      return near(stored, mine, 0.5 * 10 ** -places + 1e-9) ? [] : [`${where}: ${text} → ${mine}, stored ${ans.answerText}`]
    })
  }, HEAVY)

  it('em.halflife: the amount left, a time, an age, or a half-life, by bisection on A₀(1/2)^(t/h)', () => {
    sweep('expModels', 'em.halflife', (where, p) => {
      if (p.answer.type !== 'expModels') return [`${where}: wrong type`]
      const text = p.answer.prompt
      const ans = p.answer.stages[0]!
      const places = ans.places ?? 0
      let mine: number
      let m: RegExpExecArray | null
      if ((m = /half-life of (\d+) \w+\. A sample starts with (\d+) \w+ of it\. How much is left after (\d+) /.exec(text))) {
        mine = Number(m[2]) * 0.5 ** (Number(m[3]) / Number(m[1]))
      } else if ((m = /half-life of (\d+) \w+\. How long will it take (\d+) \w+ of it to decay to (\d+) /.exec(text))) {
        const [h, A0, A] = [Number(m[1]), Number(m[2]), Number(m[3])]
        mine = bisect((t) => A0 * 0.5 ** (t / h) - A, 0, 100 * h)
      } else if ((m = /(contains|has lost) (\d+)% of (?:the|its) carbon-14/.exec(text))) {
        const q = m[1] === 'contains' ? Number(m[2]) / 100 : 1 - Number(m[2]) / 100
        mine = bisect((t) => 0.5 ** (t / 5730) - q, 0, 100000)
      } else if ((m = /decays from (\d+) \w+ to (\d+) \w+ in (\d+) /.exec(text))) {
        const [A0, A, t] = [Number(m[1]), Number(m[2]), Number(m[3])]
        mine = bisect((h) => A0 * 0.5 ** (t / h) - A, 0.01, 10000)
      } else return [`${where}: unreadable “${text}”`]
      const stored = num(ans.answerText)
      return near(stored, mine, 0.5 * 10 ** -places + 1e-9) ? [] : [`${where}: ${text} → ${mine}, stored ${ans.answerText}`]
    })
  }, HEAVY)

  it('em.growth: k from the two counts, then the prediction or the time to reach a size', () => {
    sweep('expModels', 'em.growth', (where, p) => {
      if (p.answer.type !== 'expModels') return [`${where}: wrong type`]
      const text = p.answer.prompt
      const m = /(?:There are|The town has) ([\d,]+) (?:bacteria at the start|people now) and ([\d,]+) after (\d+) /.exec(text)
      if (!m) return [`${where}: unreadable “${text}”`]
      const [P0, P1, t1] = [num(m[1]!), num(m[2]!), Number(m[3])]
      const k = Math.log(P1 / P0) / t1
      const bad: string[] = []
      const [exact, rounded, follow] = p.answer.stages
      if (!near(value(exact!.answerText.replace(/^k = /, '')), k, 1e-12)) bad.push(`${where}: k = ${exact!.answerText}, the counts say ${k}`)
      if (Number(rounded!.answerText) !== Number(k.toFixed(4))) bad.push(`${where}: k rounded ${rounded!.answerText}, mine ${k.toFixed(4)}`)
      const kr = Number(k.toFixed(4))
      const places = follow!.places ?? 0
      const stored = num(follow!.answerText)
      const predict = /after (\d+) (?:hours|years)\?/.exec(follow!.ask)
      const reach = /there be ([\d,]+) bacteria|population reach ([\d,]+)/.exec(follow!.ask)
      const tol = 0.5 * 10 ** -places + 1e-9
      if (predict) {
        const T = Number(predict[1])
        if (!near(stored, P0 * Math.exp(k * T), tol) && !near(stored, P0 * Math.exp(kr * T), tol)) bad.push(`${where}: P(${T}) stored ${stored}`)
      } else if (reach) {
        const S = num(reach[1] ?? reach[2]!)
        const t = bisect((x) => P0 * Math.exp(k * x) - S, 0, 1000)
        if (!near(stored, t, tol) && !near(stored, Math.log(S / P0) / kr, tol)) bad.push(`${where}: time to ${S} is ${t}, stored ${stored}`)
      } else bad.push(`${where}: what is asked? ${follow!.ask}`)
      return bad
    })
  }, HEAVY)
})
