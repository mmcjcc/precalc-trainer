/**
 * Test helpers for the trig templates (imported by tests only): the 300-seed checks every template passes, and an
 * independent re-solve from what the problem shows (the figure's angle, radius and point), with Math only. The
 * second half's templates are re-solved by resolve2.ts, from the triangle's labels and the prompt's words.
 */
import { generateProblem } from '@/content'
import type { ProblemInstance, TrigAnswer, TrigPart } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import { answerForms, gradeTrigPart, trigLeaks, type ShowsAnswer } from './parts'
import { resolveSecondHalf } from './resolve2'
import { plain, showsAnswer } from './text'

export function trigAnswerOf(p: ProblemInstance): TrigAnswer {
  if (p.answer.type !== 'angleMeasure' && p.answer.type !== 'rightTriangle' && p.answer.type !== 'unitCircle') throw new Error(`${p.id} is not a trig problem`)
  return p.answer
}

/**
 * The number an answer names, read by a pattern of its own (not the app's reader): "-47π/12", "√3/2", "2√3/3",
 * "-0.5", "143.2", "π^2/216". 'undefined' for the word; NaN for anything else.
 */
export function numberOf(text: string): number | 'undefined' {
  const t = text.trim().replace(/[−–]/g, '-')
  if (t === 'undefined') return 'undefined'
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  const m = /^(-?)(\d*)(?:√(\d+))?(π(?:\^(\d+))?)?(?:\/(\d+))?$/.exec(t)
  if (!m || (!m[2] && !m[3] && !m[4])) return Number.NaN
  const sign = m[1] ? -1 : 1
  const coef = m[2] ? Number(m[2]) : 1
  const root = m[3] ? Math.sqrt(Number(m[3])) : 1
  const pi = m[4] ? Math.PI ** (m[5] ? Number(m[5]) : 1) : 1
  const den = m[6] ? Number(m[6]) : 1
  return (sign * coef * root * pi) / den
}

const RAD = Math.PI / 180

function trigOf(fn: string, deg: number): number | 'undefined' {
  const s = Math.sin(deg * RAD)
  const c = Math.cos(deg * RAD)
  const tiny = (v: number) => Math.abs(v) < 1e-12
  switch (fn) {
    case 'sin':
      return tiny(s) ? 0 : s
    case 'cos':
      return tiny(c) ? 0 : c
    case 'tan':
      return tiny(c) ? 'undefined' : tiny(s) ? 0 : s / c
    case 'csc':
      return tiny(s) ? 'undefined' : 1 / s
    case 'sec':
      return tiny(c) ? 'undefined' : 1 / c
    default:
      return tiny(s) ? 'undefined' : tiny(c) ? 0 : c / s
  }
}

function sameNumber(a: number | 'undefined', b: number | 'undefined', tol = 1e-9): boolean {
  if (a === 'undefined' || b === 'undefined') return a === b
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))
}

/** Each part's answer worked out again from what the problem shows, with Math only. Returns what disagrees. */
export function resolveAgain(a: TrigAnswer): string[] {
  const second = resolveSecondHalf(a)
  if (second) return second
  const bad: string[] = []
  const f = a.figure
  const expect = (part: TrigPart, want: number | 'undefined', places?: number) => {
    const got = numberOf(part.answerText)
    const ok = places === undefined ? sameNumber(got, want) : got !== 'undefined' && want !== 'undefined' && Math.abs(got - Number(want.toFixed(places))) < 1e-9
    if (!ok) bad.push(`${part.id}: ${part.answerText} but ${want}`)
  }
  for (const part of a.stages) {
    const c = part.check
    if (a.type === 'angleMeasure' && a.question === 'convert') {
      const given = f.deg
      if (c.kind === 'angle') expect(part, c.unit === 'rad' ? given * RAD : given)
      else if (c.kind === 'decimal') expect(part, c.unit === 'rad' ? given * RAD : given, c.places)
    } else if (a.type === 'angleMeasure' && a.question === 'coterminal' && c.kind === 'angle') {
      const co = ((f.deg % 360) + 360) % 360
      expect(part, c.unit === 'rad' ? co * RAD : co)
    } else if (a.type === 'angleMeasure' && a.question === 'reference') {
      const co = ((f.deg % 360) + 360) % 360
      if (c.kind === 'choice') {
        const want = co % 90 === 0 ? 'axis' : `Q${Math.floor(co / 90) + 1}`
        if (part.answerText !== want) bad.push(`quadrant: ${part.answerText} but ${want}`)
      } else if (c.kind === 'angle') {
        const ref = Math.acos(Math.abs(Math.cos(co * RAD))) / RAD
        expect(part, c.unit === 'rad' ? ref * RAD : ref)
      }
    } else if (a.type === 'angleMeasure' && a.question === 'arc') {
      const r = Number(/^(\d+)/.exec(f.sector!.radiusLabel)![1])
      const theta = f.deg * RAD
      const want = f.sector!.shade === 'arc' ? r * theta : 0.5 * r * r * theta
      if (c.kind === 'decimal') expect(part, want, c.places)
      else expect(part, want)
    } else if (a.type === 'unitCircle' && a.question === 'exact' && c.kind === 'value') {
      expect(part, trigOf(c.fn!, f.deg))
    } else if (a.type === 'unitCircle' && a.question === 'point' && c.kind === 'value') {
      const { x, y } = f.point!
      const r = Math.hypot(x, y)
      if (part.id === 'r') expect(part, r)
      else {
        const t = Math.atan2(y, x) / RAD
        expect(part, trigOf(part.id, t))
      }
    }
  }
  return bad
}

export interface SweepResult {
  distinctProblems: number
  maxAnswerShare: number
  topAnswer: string
  promised: Set<string>
  problems: string[]
}

/**
 * The 300-seed checks: deterministic; every answer and spelling grades right; every slip grades as its own id; the
 * promised slip is one of them; nonsense is not an attempt; nothing she sees early spells an answer; the re-solve
 * agrees. Throws on the first failure with the problem's id.
 */
export function sweep(
  moduleId: ModuleId,
  templateId: string,
  seeds = 300,
  cards: readonly { id: string; title: string; body: string; example?: string }[] = [],
  hints: readonly string[] = [],
  /** The leak matcher the template's gate uses (the second half's showsNumber for its templates). */
  shows: ShowsAnswer = showsAnswer,
): SweepResult {
  const answers = new Map<string, number>()
  const problems = new Set<string>()
  const promised = new Set<string>()
  for (let seed = 1; seed <= seeds; seed++) {
    const p = generateProblem(moduleId, templateId, seed)
    const again = generateProblem(moduleId, templateId, seed)
    if (JSON.stringify(p) !== JSON.stringify(again)) throw new Error(`${p.id}: not deterministic`)
    const a = trigAnswerOf(p)
    for (const part of a.stages) {
      for (const form of part.kind === 'choice' ? [part.answerText] : [part.answerText, ...part.forms]) {
        const g = gradeTrigPart(part, form)
        if (g.verdict !== 'correct') throw new Error(`${p.id} ${part.id}: “${form}” graded ${g.verdict}`)
      }
      for (const trap of part.traps) {
        const g = gradeTrigPart(part, trap.text)
        if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new Error(`${p.id} ${part.id}: ${trap.id} “${trap.text}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
        if (answerForms(part).includes(trap.text)) throw new Error(`${p.id} ${part.id}: a slip is the answer`)
      }
      if (part.kind !== 'choice' && gradeTrigPart(part, '???').verdict !== 'invalid') throw new Error(`${p.id} ${part.id}: nonsense was graded`)
    }
    if (a.trap) {
      const stage = a.stages.find((s) => s.id === a.trapStage)
      if (!stage?.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer)) throw new Error(`${p.id}: the promised ${a.trap} is not a candidate`)
      const g = gradeTrigPart(stage, a.trapAnswer!)
      if (g.verdict !== 'mistake' || g.mistake !== a.trap) throw new Error(`${p.id}: the promised ${a.trap} graded ${g.verdict}`)
      promised.add(a.trap)
    } else if (a.stages.some((s) => s.traps.length > 0)) throw new Error(`${p.id}: a slip is possible but none is promised`)
    const leaks = trigLeaks(a, p.instructions, cards, hints, shows)
    if (leaks.length) throw new Error(`${p.id}: ${leaks[0]}`)
    const disagree = resolveAgain(a)
    if (disagree.length) throw new Error(`${p.id}: the re-solve disagrees: ${disagree[0]}`)
    const key = a.stages.map((s) => s.answerText).join(' | ')
    answers.set(key, (answers.get(key) ?? 0) + 1)
    problems.add(plain(a.prompt))
  }
  const [topAnswer, top] = [...answers.entries()].sort((x, y) => y[1] - x[1])[0]!
  return { distinctProblems: problems.size, maxAnswerShare: top / seeds, topAnswer, promised, problems: [...problems] }
}
