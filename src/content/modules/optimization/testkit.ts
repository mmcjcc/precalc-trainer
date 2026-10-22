/**
 * Test helpers for the optimization templates (imported by tests only): the 300-seed checks every template passes,
 * and an independent re-solve of each problem from what it SHOWS (the prompt's words and numbers, the figure's pens
 * and wall), by brute force over the domain, never from the generator's own model.
 */
import { generateProblem } from '@/content'
import type { OptimizationAnswer, OptPart, ProblemInstance } from '@/content/types'
import { exactFromText } from '@/engine/optim'
import { answerForms, gradeOptPart, optLeaks, stagesFor } from './parts'
import { OPT_RULES } from './rules'
import { plain } from './text'
import { OPT_HINTS } from './words'

export function optAnswerOf(p: ProblemInstance): OptimizationAnswer {
  if (p.answer.type !== 'optimization') throw new Error(`${p.id} is not an optimization problem`)
  return p.answer
}

/** A part's right value as a plain number (an equation part has none). */
export function valueOf(a: OptimizationAnswer, part: OptPart): number {
  if (part.check.kind !== 'number') throw new Error(`${part.id} is not a number`)
  const v = exactFromText(part.check.value, a.units)
  return v.n / v.d
}

const num = (s: string) => Number(s.replace(/,/g, ''))

/** What the prompt says, read with patterns of the test's own. */
function words(a: OptimizationAnswer): string {
  return plain(a.prompt)
}

interface Resolved {
  x: number
  y: number
  value: number
}

/** Golden-section search for the top (or bottom) of a one-variable function on [lo, hi], after a coarse scan. */
function extreme(f: (t: number) => number, lo: number, hi: number, goal: 'max' | 'min'): number {
  const sign = goal === 'max' ? 1 : -1
  const g = (t: number) => sign * f(t)
  // A coarse scan over 4000 points finds the bracket; the golden section narrows it.
  let best = lo
  let bestV = -Infinity
  const n = 4000
  for (let i = 0; i <= n; i++) {
    const t = lo + ((hi - lo) * i) / n
    const v = g(t)
    if (v > bestV) {
      bestV = v
      best = t
    }
  }
  const step = (hi - lo) / n
  let a = Math.max(lo, best - step)
  let b = Math.min(hi, best + step)
  const r = (Math.sqrt(5) - 1) / 2
  for (let i = 0; i < 200; i++) {
    const c = b - r * (b - a)
    const d = a + r * (b - a)
    if (g(c) > g(d)) b = d
    else a = c
  }
  return (a + b) / 2
}

/** The fence problems: the total from the words, the fences counted from the figure, the area the question asks. */
function resolveFence(a: OptimizationAnswer): Resolved {
  const w = words(a)
  const m = /has ([\d,]+) (ft|m|yd) of fencing/.exec(w)
  if (!m) throw new Error(`no fencing total in: ${w}`)
  const P = num(m[1]!)
  const fig = a.figure
  if (!fig) throw new Error('a fence problem without a figure')
  // Fences across the row: one more than the pens drawn. Along it: one per pen on each fenced edge (one for the
  // whole row when the pen is divided), and the wall's edge has none.
  const across = fig.pens + 1
  const edges = fig.wall ? 1 : 2
  const along = (fig.whole ? 1 : fig.pens) * edges
  const combined = /combined area/.test(w)
  const areaOf = (acrossLen: number, alongLen: number) => {
    if (fig.whole) return acrossLen * alongLen
    return (combined ? fig.pens : 1) * acrossLen * alongLen
  }
  const top = P / across
  const acrossLen = extreme((t) => areaOf(t, (P - across * t) / along), 0, top, 'max')
  const alongLen = (P - across * acrossLen) / along
  const value = areaOf(acrossLen, alongLen)
  return fig.across === 'x' ? { x: acrossLen, y: alongLen, value } : { x: alongLen, y: acrossLen, value }
}

function resolveNumbers(a: OptimizationAnswer): Resolved {
  const w = words(a)
  let yOf: (x: number) => number
  let s: number
  let m: RegExpExecArray | null
  if ((m = /^Two numbers have a sum of (-?\d+)/.exec(w))) {
    s = num(m[1]!)
    yOf = (x) => s - x
  } else if ((m = /^Twice a first number plus a second number is (-?\d+)/.exec(w))) {
    s = num(m[1]!)
    yOf = (x) => s - 2 * x
  } else if ((m = /^A first number plus three times a second number is (-?\d+)/.exec(w))) {
    s = num(m[1]!)
    yOf = (x) => (s - x) / 3
  } else if ((m = /^The first of two numbers is (\d+) more than the second/.exec(w))) {
    s = num(m[1]!)
    yOf = (x) => x - s
  } else throw new Error(`no condition in: ${w}`)
  const squares = /sum of their squares as small/.test(w)
  const goal: 'max' | 'min' = /as large as possible/.test(w) ? 'max' : 'min'
  const f = (x: number) => (squares ? x * x + yOf(x) ** 2 : x * yOf(x))
  const x = extreme(f, -3 * Math.abs(s) - 10, 3 * Math.abs(s) + 10, goal)
  return { x, y: yOf(x), value: f(x) }
}

function resolveRevenue(a: OptimizationAnswer): Resolved {
  const w = words(a)
  const start = /(?:sells|rents out) (\d+) .*? at \$(\d+(?:\.\d+)?)/.exec(w)
  if (!start) throw new Error(`no starting sales in: ${w}`)
  const q0 = num(start[1]!)
  const p0 = num(start[2]!)
  let sold: (x: number) => number
  let m: RegExpExecArray | null
  if ((m = /For each \$1 increase in the price, (\d+) fewer/.exec(w))) {
    const k = num(m[1]!)
    sold = (x) => q0 - k * (x - p0)
  } else if ((m = /For each \$0\.50 decrease in the price, (\d+) more/.exec(w))) {
    const k = num(m[1]!)
    sold = (x) => q0 + k * ((p0 - x) / 0.5)
  } else throw new Error(`no price change in: ${w}`)
  // From free to the price where nobody buys.
  let hi = p0
  while (sold(hi) > 0) hi += 0.5
  const x = extreme((t) => t * sold(t), 0, hi, 'max')
  return { x, y: sold(x), value: x * sold(x) }
}

/** Each number part's answer worked out again from what the problem shows. Returns what disagrees. */
export function resolveAgain(a: OptimizationAnswer): string[] {
  const r = a.question === 'numbers' ? resolveNumbers(a) : a.question === 'revenue' ? resolveRevenue(a) : resolveFence(a)
  const bad: string[] = []
  const close = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))
  const [, , , best, otherPart, max] = a.stages
  // The search pins the turn to well under a ten-thousandth of a unit, and the top itself far closer (it is flat
  // there); the parts hold exact values.
  const checks: [OptPart, number, number][] = [
    [best!, r.x, 1e-4],
    [otherPart!, r.y, 1e-4],
    [max!, r.value, 1e-7],
  ]
  for (const [part, want, tol] of checks) {
    const got = valueOf(a, part)
    if (!close(got, want, tol)) bad.push(`${part.id}: ${part.answerText} but ${want}`)
  }
  return bad
}

export interface SweepResult {
  distinctProblems: number
  maxAnswerShare: number
  topAnswer: string
  promised: Set<string>
  /** Every slip id some problem names, on any part. */
  named: Set<string>
}

/**
 * The 300-seed checks: deterministic; every answer and spelling grades right on both routes; every slip grades as
 * its own id and is never an answer; nonsense is not an attempt; the promised slip is one of them; nothing she sees
 * early spells an answer; the re-solve agrees. Throws on the first failure with the problem's id.
 */
export function sweep(templateId: string, seeds = 300): SweepResult {
  const answers = new Map<string, number>()
  const problems = new Set<string>()
  const promised = new Set<string>()
  const named = new Set<string>()
  for (let seed = 1; seed <= seeds; seed++) {
    const p = generateProblem('optimization', templateId, seed)
    const again = generateProblem('optimization', templateId, seed)
    if (JSON.stringify(p) !== JSON.stringify(again)) throw new Error(`${p.id}: not deterministic`)
    const a = optAnswerOf(p)
    for (const route of ['x', 'y'] as const) {
      for (const part of stagesFor(a, route)) {
        for (const form of [part.answerText, ...part.forms]) {
          const g = gradeOptPart(a, part, form)
          if (g.verdict !== 'correct') throw new Error(`${p.id} ${route} ${part.id}: “${form}” graded ${g.verdict}`)
        }
        for (const trap of part.traps) {
          const g = gradeOptPart(a, part, trap.text)
          if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new Error(`${p.id} ${part.id}: ${trap.id} “${trap.text}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
          if (answerForms(part).includes(trap.text)) throw new Error(`${p.id} ${part.id}: a slip is the answer`)
          named.add(trap.id)
        }
        if (gradeOptPart(a, part, '???').verdict !== 'invalid') throw new Error(`${p.id} ${part.id}: nonsense was graded`)
      }
    }
    if (!a.trap) throw new Error(`${p.id}: no slip promised`)
    const stage = a.stages.find((s) => s.id === a.trapStage)
    if (!stage?.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer)) throw new Error(`${p.id}: the promised ${a.trap} is not a candidate`)
    const g = gradeOptPart(a, stage, a.trapAnswer!)
    if (g.verdict !== 'mistake' || g.mistake !== a.trap) throw new Error(`${p.id}: the promised ${a.trap} graded ${g.verdict}`)
    promised.add(a.trap)
    const leaks = optLeaks(a, p.instructions, OPT_RULES, OPT_HINTS)
    if (leaks.length) throw new Error(`${p.id}: ${leaks[0]}`)
    const disagree = resolveAgain(a)
    if (disagree.length) throw new Error(`${p.id}: the re-solve disagrees: ${disagree[0]}`)
    const key = a.stages.map((s) => s.answerText).join(' | ')
    answers.set(key, (answers.get(key) ?? 0) + 1)
    problems.add(plain(a.prompt))
  }
  const [topAnswer, top] = [...answers.entries()].sort((x, y) => y[1] - x[1])[0]!
  return { distinctProblems: problems.size, maxAnswerShare: top / seeds, topAnswer, promised, named }
}
