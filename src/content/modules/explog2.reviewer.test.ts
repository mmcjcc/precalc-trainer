/**
 * Reviewer's independent re-solve of precalculus Unit 3, second half (written by the reviewer, not the builder):
 * every word problem is solved again from the numbers in its sentences with Math, every inverse is checked by
 * composing it with the printed function, and every graph feature is read numerically off the printed function.
 * Only the app's parser is shared, to evaluate the printed text.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { evalNode } from '@/engine/math'
import { parseExpression } from '@/engine/parse'
import type { ModuleId } from '@/shared/types'

const SEEDS = Number(process.env.EXPLOG2_SEEDS ?? 300)
const HEAVY = 120000

type Part = { id: string; kind: string; answerText: string; places?: number; money?: boolean; ask: string }
type A = Record<string, unknown> & { stages: Part[]; prompt: string }

const answer = (module: string, template: string, seed: number) => generateProblem(module as ModuleId, template, seed).answer as unknown as A

/** f as a JS function of x, through the app's parser; undefined outside the domain. */
function fn(text: string): (x: number) => number | undefined {
  const p = parseExpression(text.replace(/^\s*y\s*=\s*/, ''), ['x'])
  if (!p.ok) throw new Error(`unreadable “${text}”: ${p.error.message}`)
  return (x) => {
    const v = evalNode(p.node, { x })
    return v === 'undef' || !Number.isFinite(v) ? undefined : v
  }
}
const num = (text: string) => {
  const v = fn(text.replace(/,/g, ''))(0)
  if (v === undefined) throw new Error(`not a number: ${text}`)
  return v
}
const words = (text: string) => Number(text.replace(/[$,]/g, ''))
const round = (v: number, places: number) => (Math.round(v * 10 ** places) / 10 ** places).toFixed(places)

function sweep(module: string, template: string, check: (where: string, a: A) => string[]) {
  const bad: string[] = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    const where = `${template}/${seed}`
    try {
      bad.push(...check(where, answer(module, template, seed)))
    } catch (e) {
      bad.push(`${where}: ${(e as Error).message}`)
    }
  }
  expect(bad.slice(0, 12), `${bad.length} problems`).toEqual([])
}

/** The stored decimal answer must be the reviewer's value rounded to the places asked. */
function sameRounded(where: string, part: Part, mine: number): string[] {
  const places = part.places ?? 0
  const stored = Number(part.answerText.replace(/[$,]/g, ''))
  const want = Number(round(mine, places))
  return Math.abs(stored - want) <= 0.5 * 10 ** -places + 1e-9 ? [] : [`${where} ${part.id}: reviewer ${round(mine, places)}, stored ${part.answerText}`]
}

describe('Unit 3 second half solved again by the reviewer', () => {
  it('em.interest: compound and continuous interest from the sentence', () => {
    sweep('expModels', 'em.interest', (where, a) => {
      const s = a.prompt
      const rate = Number(/([\d.]+)% interest/.exec(s)![1]) / 100
      const per: Record<string, number> = { annually: 1, semiannually: 2, quarterly: 4, monthly: 12, daily: 365 }
      const comp = /compounded (\w+)/.exec(s)![1]!
      const grow = (t: number) => (comp === 'continuously' ? Math.exp(rate * t) : (1 + rate / per[comp]!) ** (per[comp]! * t))
      const part = a.stages[0]!
      const balance = /\$([\d,]+) is invested.*after (\d+) years/.exec(s)
      const reach = /\$([\d,]+) is invested.*reach \$([\d,]+)/.exec(s)
      let mine: number
      if (reach) {
        const ratio = words(reach[2]!) / words(reach[1]!)
        mine = comp === 'continuously' ? Math.log(ratio) / rate : Math.log(ratio) / (per[comp]! * Math.log(1 + rate / per[comp]!))
      } else if (balance) mine = words(balance[1]!) * grow(Number(balance[2]))
      else if (/double/.test(s)) mine = comp === 'continuously' ? Math.log(2) / rate : Math.log(2) / (per[comp]! * Math.log(1 + rate / per[comp]!))
      else return [`${where}: unread sentence “${s}”`]
      return sameRounded(where, part, mine)
    })
  }, HEAVY)

  it('em.halflife: amounts, times, half-lives and carbon-14 from the sentence', () => {
    sweep('expModels', 'em.halflife', (where, a) => {
      const s = a.prompt
      const part = a.stages[0]!
      let m = /contains (\d+)% of the carbon-14.*half-life of carbon-14 is (\d+) years/.exec(s)
      if (m) return sameRounded(where, part, (Number(m[2]) * Math.log(Number(m[1]) / 100)) / Math.log(0.5))
      m = /has lost (\d+)% of its carbon-14.*half-life of carbon-14 is (\d+) years/.exec(s)
      if (m) return sameRounded(where, part, (Number(m[2]) * Math.log(1 - Number(m[1]) / 100)) / Math.log(0.5))
      m = /decays from (\d[\d,]*) (\w+) to (\d[\d,]*) \w+ in (\d+) (\w+)\. What is its half-life/.exec(s)
      if (m) return sameRounded(where, part, (Number(m[4]) * Math.log(0.5)) / Math.log(words(m[3]!) / words(m[1]!)))
      m = /half-life of (\d+) (\w+)\. How long will it take (\d[\d,]*) \w+ of it to decay to (\d[\d,]*)/.exec(s)
      if (m) return sameRounded(where, part, (Number(m[1]) * Math.log(words(m[4]!) / words(m[3]!))) / Math.log(0.5))
      m = /half-life of (\d+) (\w+)\. A sample starts with (\d[\d,]*) \w+ of it\. How much is left after (\d+)/.exec(s)
      if (m) return sameRounded(where, part, words(m[3]!) * 0.5 ** (Number(m[4]) / Number(m[1])))
      // No article before a number anywhere: "a 825-milligram" needs "an".
      if (/\b[Aa]n? \d/.test(s)) return [`${where}: an article before a number in “${s}”`]
      return [`${where}: unread sentence “${s}”`]
    })
  }, HEAVY)

  it('em.growth: k exactly, k rounded, then the follow-up, from the sentence', () => {
    sweep('expModels', 'em.growth', (where, a) => {
      const s = a.prompt
      const m = /(?:are|has) ([\d,]+) (?:bacteria|people)[^.]* and ([\d,]+) after (\d+) (hours|years)/.exec(s)
      if (!m) return [`${where}: unread sentence “${s}”`]
      const p0 = words(m[1]!)
      const p1 = words(m[2]!)
      const t = Number(m[3])
      const k = Math.log(p1 / p0) / t
      const bad: string[] = []
      const [exact, rounded, follow] = a.stages
      if (Math.abs(num(exact!.answerText) - k) > 1e-12) bad.push(`${where}: exact k ${exact!.answerText} is not ${k}`)
      bad.push(...sameRounded(where, rounded!, k))
      // The follow-up: a prediction or a time to reach a size, read from its own question.
      const ask = follow!.ask
      const when = /after (\d+) (hours|years)/.exec(ask)
      const size = /reach ([\d,]+)|there be ([\d,]+)|have ([\d,]+)/.exec(ask)
      if (when) {
        const v = p0 * Math.exp(k * Number(when[1]))
        const vr = p0 * Math.exp(Number(rounded!.answerText) * Number(when[1]))
        const ok = sameRounded(where, follow!, v).length === 0 || sameRounded(where, follow!, vr).length === 0
        if (!ok) bad.push(`${where} follow: reviewer ${v} (or ${vr} with the rounded k), stored ${follow!.answerText}`)
      } else if (size) {
        const v = Math.log(words(size[1] ?? size[2] ?? size[3]!) / p0) / k
        const vr = Math.log(words(size[1] ?? size[2] ?? size[3]!) / p0) / Number(rounded!.answerText)
        const ok = sameRounded(where, follow!, v).length === 0 || sameRounded(where, follow!, vr).length === 0
        if (!ok) bad.push(`${where} follow: reviewer ${v} (or ${vr} with the rounded k), stored ${follow!.answerText}`)
      } else bad.push(`${where}: unread follow-up “${ask}”`)
      return bad
    })
  }, HEAVY)

  it('eg.inverse: the stored inverse undoes the printed function both ways', () => {
    sweep('expLogGraphs', 'eg.inverse', (where, a) => {
      const f = fn(String(a.f))
      const g = fn(a.stages[0]!.answerText)
      const bad: string[] = []
      let tried = 0
      // From −6 out to 30, so a log shifted right still has plenty of points inside its domain. Where f is
      // nearly flat (3·10^(x − 6) + 5 far left of 6) the difference from its asymptote has lost its digits,
      // so those points say nothing about g.
      for (let i = -20; i <= 100; i++) {
        const x = i * 0.3 + 0.13
        const fx = f(x)
        const fNext = f(x + 0.3)
        if (fx === undefined || fNext === undefined) continue
        if (Math.abs(fNext - fx) < 1e-6 * Math.max(1, Math.abs(fx))) continue
        const back = g(fx)
        tried++
        if (back === undefined || Math.abs(back - x) > 1e-6 * Math.max(1, Math.abs(x))) {
          bad.push(`${where}: g(f(${x})) = ${back}, not ${x}`)
          break
        }
      }
      if (tried < 10) bad.push(`${where}: only ${tried} points in the domain`)
      return bad
    })
  }, HEAVY)

  it('eg.features: domain, range, asymptote, intercept and direction read numerically off f', () => {
    sweep('expLogGraphs', 'eg.features', (where, a) => {
      const f = fn(String(a.f))
      const bad: string[] = []
      const part = (id: string) => a.stages.find((s) => s.id === id)!
      const log = a.family === 'logarithmic'
      // Where f is defined, sampled.
      const xs = Array.from({ length: 2001 }, (_, i) => -50 + i * 0.05)
      const defined = xs.filter((x) => f(x) !== undefined)
      if (log) {
        const left = Math.min(...defined)
        const asym = Number(/x = (-?[\d.]+)/.exec(part('asymptote').answerText)?.[1])
        if (!(left > asym && left - asym <= 0.051)) bad.push(`${where}: defined from ${left}, asymptote stored ${part('asymptote').answerText}`)
        if (part('domain').answerText.replace(/\s/g, '') !== `(${asym},inf)`) bad.push(`${where}: domain ${part('domain').answerText}`)
        if (part('range').answerText.replace(/\s/g, '') !== '(-inf,inf)') bad.push(`${where}: range ${part('range').answerText}`)
        // x-intercept: f there is 0.
        const xi = num(/^\((.*), 0\)$/.exec(part('intercept').answerText)![1]!)
        const at = f(xi)
        if (at === undefined || Math.abs(at) > 1e-9) bad.push(`${where}: f at the stored x-intercept ${xi} is ${at}`)
      } else {
        if (defined.length !== xs.length) bad.push(`${where}: an exponential undefined somewhere`)
        const far = [f(-200)!, f(200)!]
        const kStored = Number(/y = (-?[\d.]+)/.exec(part('asymptote').answerText)?.[1])
        const flat = Math.abs(far[0]! - kStored) < 1e-6 ? far[0]! : far[1]!
        if (Math.abs(flat - kStored) > 1e-6) bad.push(`${where}: f levels off at ${flat}, asymptote stored ${part('asymptote').answerText}`)
        const above = f(0)! > kStored
        const want = above ? `(${kStored},inf)` : `(-inf,${kStored})`
        if (part('range').answerText.replace(/\s/g, '') !== want) bad.push(`${where}: range ${part('range').answerText}, reviewer ${want}`)
        if (part('domain').answerText.replace(/\s/g, '') !== '(-inf,inf)') bad.push(`${where}: domain ${part('domain').answerText}`)
        const yi = num(/^\(0, (.*)\)$/.exec(part('intercept').answerText)![1]!)
        if (Math.abs(yi - f(0)!) > 1e-9 * Math.max(1, Math.abs(yi))) bad.push(`${where}: f(0) = ${f(0)}, stored ${part('intercept').answerText}`)
      }
      const x0 = defined[Math.floor(defined.length / 2)]!
      const rising = f(x0 + 0.5)! > f(x0)!
      if (part('behavior').answerText !== (rising ? 'increasing' : 'decreasing')) bad.push(`${where}: f is ${rising ? 'increasing' : 'decreasing'}, stored ${part('behavior').answerText}`)
      return bad
    })
  }, HEAVY)

  it('eg.match: the right candidate is the printed function, and no other candidate is', () => {
    sweep('expLogGraphs', 'eg.match', (where, a) => {
      const f = fn(String(a.f))
      const cands = a.candidates as { letter: string; f: string }[]
      const right = a.stages[0]!.answerText
      const same = (g: (x: number) => number | undefined) => {
        let n = 0
        for (let i = -30; i <= 30; i++) {
          const x = i / 3 + 0.07
          const u = f(x)
          const v = g(x)
          if (u === undefined && v === undefined) continue
          if (u === undefined || v === undefined || Math.abs(u - v) > 1e-9 * Math.max(1, Math.abs(u))) return false
          n++
        }
        return n > 5
      }
      const matches = cands.filter((c) => same(fn(c.f))).map((c) => c.letter)
      return matches.length === 1 && matches[0] === right ? [] : [`${where}: candidates equal to f: ${matches.join(',') || 'none'}, stored ${right}`]
    })
  }, HEAVY)

  // The finished eg.inverse graph once said "Could not draw this graph here". Every curve a graph shows
  // must have points inside the window, on each side of its breaks except left of a log's asymptote.
  it('eg.*: every curve on every graph has points in the window', () => {
    type Spec = { kind: string; f?: string; finv?: string; fBreaks?: number[]; xDomain?: [number, number] }
    const onScreen = (where: string, what: string, text: string, lo: number, hi: number) => {
      const f = fn(text)
      let shown = 0
      for (let i = 0; i <= 240; i++) {
        const y = f(lo + ((hi - lo) * i) / 240)
        if (y !== undefined && y >= lo && y <= hi) shown++
      }
      return shown >= 5 ? [] : [`${where}: ${what} ${text} has ${shown} sampled points in [${lo}, ${hi}]`]
    }
    for (const template of ['eg.features', 'eg.match', 'eg.inverse']) {
      sweep('expLogGraphs', template, (where, a) => {
        const specs = [a.graph as Spec, ...((a.candidates as { graph: Spec }[] | undefined) ?? []).map((c) => c.graph)]
        const bad: string[] = []
        for (const s of specs) {
          if (s.kind !== 'function' || !s.f) continue
          const [lo, hi] = s.xDomain ?? [-8, 8]
          bad.push(...onScreen(where, 'f', s.f, lo, hi))
          if (s.finv) bad.push(...onScreen(where, 'f⁻¹', s.finv, lo, hi))
        }
        return bad
      })
    }
  }, HEAVY)
})
