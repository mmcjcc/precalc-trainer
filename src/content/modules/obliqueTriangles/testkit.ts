/**
 * Test helpers for the oblique-triangle templates (imported by tests only): the seeded sweep every template passes,
 * and a reader of the numbers the prompt gives.
 */
import { generateProblem } from '@/content'
import type { ObliqueAnswer, ProblemInstance } from '@/content/types'
import { answerForms } from '../trig/parts'
import { plain } from '../trig/text'
import { badEnglish, gradeObliquePart, obliqueLeaks, readableTexts } from './grade'
import { OT_RULES } from './rules'
import { OT_HINTS } from './words'

export function otAnswerOf(p: ProblemInstance): ObliqueAnswer {
  if (p.answer.type !== 'obliqueTriangles') throw new Error(`${p.id} is not an oblique-triangle problem`)
  return p.answer
}

export function problemAt(templateId: string, seed: number): { p: ProblemInstance; a: ObliqueAnswer } {
  const p = generateProblem('obliqueTriangles', templateId, seed)
  return { p, a: otAnswerOf(p) }
}

/** The numbers the prompt gives, by name: "A = 40°" → A: 40, "a = 10" → a: 10. Read from the words, not the engine. */
export function givensOf(prompt: string): Record<string, number> {
  const words = plain(prompt).replace(/−/g, '-')
  const out: Record<string, number> = {}
  for (const g of words.matchAll(/\b([ABCabc]) = (\d+(?:\.\d+)?)(°?)/g)) out[g[1]!] = Number(g[2])
  return out
}

export interface OtSweep {
  /** Distinct prompts among seeds 1..60. */
  distinctFirst60: number
  /** Per part id: the largest share of one answer. */
  maxShare: Record<string, number>
  /** Per choice part id: the largest share of one right choice. */
  maxChoiceShare: Record<string, number>
  promised: Set<string>
  /** Every slip id that is a candidate somewhere. */
  candidates: Set<string>
  answers: ObliqueAnswer[]
}

/**
 * The seeded checks: deterministic; every answer and spelling right; every slip its own id and never the answer; the
 * promised slip a real candidate that grades as its id; a slip promised wherever one is possible; nonsense not an
 * attempt; nothing she sees early spells an answer; every text reads as English. Throws on the first failure.
 */
export function sweepOt(templateId: string, seeds = 300): OtSweep {
  const counts = new Map<string, Map<string, number>>()
  const promised = new Set<string>()
  const candidates = new Set<string>()
  const first60 = new Set<string>()
  const answers: ObliqueAnswer[] = []
  for (let seed = 1; seed <= seeds; seed++) {
    const { p, a } = problemAt(templateId, seed)
    const again = generateProblem('obliqueTriangles', templateId, seed)
    if (JSON.stringify(p) !== JSON.stringify(again)) throw new Error(`${p.id}: not deterministic`)
    answers.push(a)
    if (seed <= 60) first60.add(plain(a.prompt))
    for (const part of a.stages) {
      const early = a.early[part.id] ?? []
      for (const form of part.kind === 'choice' ? [part.answerText] : [part.answerText, ...part.forms]) {
        const g = gradeObliquePart(part, early, form)
        if (g.verdict !== 'correct') throw new Error(`${p.id} ${part.id}: “${form}” graded ${g.verdict}`)
      }
      for (const trap of part.traps) {
        candidates.add(trap.id)
        const g = gradeObliquePart(part, early, trap.text)
        if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new Error(`${p.id} ${part.id}: ${trap.id} “${trap.text}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
        if (answerForms(part).includes(trap.text) || trap.text === part.answerText) throw new Error(`${p.id} ${part.id}: a slip is the answer`)
      }
      const texts = new Set(part.traps.map((t) => t.text))
      if (texts.size !== part.traps.length) throw new Error(`${p.id} ${part.id}: two slips give the same answer`)
      if (part.kind !== 'choice' && gradeObliquePart(part, early, '???').verdict !== 'invalid') throw new Error(`${p.id} ${part.id}: nonsense was graded`)
      const byPart = counts.get(part.id) ?? new Map<string, number>()
      byPart.set(part.answerText, (byPart.get(part.answerText) ?? 0) + 1)
      counts.set(part.id, byPart)
    }
    if (a.trap) {
      const stage = a.stages.find((s) => s.id === a.trapStage)!
      if (!stage.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer)) throw new Error(`${p.id}: the promised ${a.trap} is not a candidate`)
      const g = gradeObliquePart(stage, a.early[stage.id] ?? [], a.trapAnswer!)
      if (g.verdict !== 'mistake' || g.mistake !== a.trap) throw new Error(`${p.id}: the promised ${a.trap} graded ${g.verdict}`)
      promised.add(a.trap)
    } else if (a.stages.some((s) => s.traps.length > 0)) throw new Error(`${p.id}: a slip is possible but none is promised`)
    const leaks = obliqueLeaks(a, p.instructions, OT_RULES, OT_HINTS)
    if (leaks.length) throw new Error(`${p.id}: ${leaks[0]}`)
    for (const t of readableTexts(a, p.instructions)) {
      const bad = badEnglish(t)
      if (bad) throw new Error(`${p.id}: ${bad}`)
    }
  }
  const maxShare: Record<string, number> = {}
  const maxChoiceShare: Record<string, number> = {}
  const choiceIds = new Set(answers.flatMap((a) => a.stages.filter((s) => s.kind === 'choice').map((s) => s.id)))
  for (const [id, m] of counts) {
    const total = [...m.values()].reduce((s, x) => s + x, 0)
    const top = Math.max(...m.values())
    // Shares are of all seeds: a part that only some problems have counts against the whole sweep.
    if (choiceIds.has(id)) maxChoiceShare[id] = top / total
    else maxShare[id] = top / seeds
  }
  return { distinctFirst60: first60.size, maxShare, maxChoiceShare, promised, candidates, answers }
}
