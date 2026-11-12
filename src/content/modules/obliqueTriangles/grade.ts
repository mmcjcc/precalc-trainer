/**
 * Grading one part of an oblique-triangle problem, and the gate every generated problem passes before it is shown.
 *
 * Rounded sides, angles and areas go through the same grader as rightTriangle's rounded answers (engine/trig
 * gradeTrigAnswer): right within half a tenth of the true value (13.47 → 13.5, 13.47, 13.473 all right), more places
 * fine, fewer places "rounded too far" (a note), a degree sign on a length a note. The house part grader only claims
 * trig_ slips, so the slips are handed to gradeTrigAnswer here directly, the ot_ ones included. A number that matches
 * the answer worked out from values rounded too soon, a tenth or two off, is a note too: nothing is logged.
 */
import type { ObliqueAnswer, RuleCard, TrigPart } from '@/content/types'
import { gradeTrigAnswer, readTrigAnswer, type TrigCandidate, type TrigMistakeId } from '@/engine/trig'
import { LogSkip } from '../explog/text'
import { answerForms, gradeTrigPart, specOf, texLeftovers, trigLeaks, type TrigPartGrade } from '../trig/parts'
import { plain, showsNumber } from '../trig/text'

export const EARLY_NOTE =
  'Close, but not quite: that is what comes out when a value is rounded partway through. Keep every digit on the calculator (or use ANS for the last result) and round only the final answer.'

/** Grade her entry for one part. `early` are this part's rounded-too-early values. */
export function gradeObliquePart(part: TrigPart, early: readonly number[], raw: string): TrigPartGrade {
  if (part.kind !== 'decimal') return gradeTrigPart(part, raw)
  // gradeTrigAnswer only reads a candidate's id back out; an ot_ id passes through it unchanged.
  const cands: TrigCandidate[] = part.traps
    .filter((t) => t.value !== undefined)
    .map((t) => ({ id: t.id as TrigMistakeId, value: t.value!, witness: t.witness }))
  const g = gradeTrigAnswer(specOf(part), raw, cands)
  switch (g.verdict) {
    case 'correct':
      return { verdict: 'correct', message: g.message }
    case 'mistake':
      return { verdict: 'mistake', mistake: g.mistake, witness: g.witness }
    case 'invalid':
      return { verdict: 'invalid', message: g.message }
    case 'wrong':
      if (roundedTooEarly(part, early, raw)) return { verdict: 'invalid', message: EARLY_NOTE }
      return { verdict: 'wrong', message: part.wrongNote }
  }
}

function roundedTooEarly(part: TrigPart, early: readonly number[], raw: string): boolean {
  if (part.check.kind !== 'decimal' || early.length === 0) return false
  const read = readTrigAnswer(raw)
  if (!read.ok || read.kind !== 'number' || !read.plain) return false
  const her = read.plain.value
  if (Math.abs(her - part.check.value) > 0.25) return false
  return early.some((e) => Math.abs(her - e) <= 0.05 + 1e-9)
}

/** Grade her entry for one part of a problem. */
export function gradeOtPart(answer: ObliqueAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeObliquePart(part, answer.early[stageId] ?? [], text)
}

/** The figure's words while part `index` is open: `before`, or `after` once its part is answered. */
export function obliqueFigureTextsAt(answer: ObliqueAnswer, index: number): string[] {
  const answered = new Set(answer.stages.slice(0, index).map((s) => s.id))
  const after = answer.oblique.after
  const spec = after && answered.has(after.stage) ? after.spec : answer.oblique.before
  const out = [spec.ariaLabel]
  for (const p of spec.points) out.push(p.label ?? p.id)
  for (const s of spec.segments ?? []) if (s.label) out.push(s.label)
  for (const a of spec.angles ?? []) if (a.label) out.push(a.label)
  return out.filter(Boolean)
}

/** Words she can read that would not read as English: a leftover object, an undefined, an article before a number. */
export function badEnglish(text: string): string | null {
  const words = plain(text)
  if (/\[object|undefined|NaN/.test(words)) return `not words: ${words}`
  if (/\b[Aa]n? \d/.test(words)) return `an article before a number: ${words}`
  if (/\b1 (sides|angles|triangles|degrees)\b/.test(words)) return `a plural after one: ${words}`
  return null
}

/** Every text on the problem's screen that she can read, before or after answering. */
export function readableTexts(answer: ObliqueAnswer, instructions: string): string[] {
  const specs = [answer.oblique.before, ...(answer.oblique.after ? [answer.oblique.after.spec] : [])]
  return [
    answer.prompt,
    instructions,
    answer.figure.ariaLabel,
    ...specs.flatMap((s) => [s.ariaLabel, ...(s.segments ?? []).map((x) => x.label ?? ''), ...(s.angles ?? []).map((x) => x.label ?? '')]),
    ...answer.reveal,
    ...answer.stages.flatMap((s) => [s.label, s.ask, s.formatHint, s.nudge, s.wrongNote, ...s.reveal, ...s.traps.map((t) => t.witness), ...(s.choices ?? []).map((c) => c.label)]),
  ].filter(Boolean)
}

/** What she sees early that spells an answer of that part or a later one (the house check, plus this figure). */
export function obliqueLeaks(answer: ObliqueAnswer, instructions: string, cards: readonly RuleCard[], hints: readonly string[]): string[] {
  const out = trigLeaks(answer, instructions, cards, hints, showsNumber)
  const later = (from: number) => answer.stages.slice(from).flatMap(answerForms)
  answer.stages.forEach((part, i) => {
    for (const text of obliqueFigureTextsAt(answer, i)) if (showsNumber([text], later(i))) out.push(`${part.id}: the figure’s “${text}”`)
    for (const text of [EARLY_NOTE]) if (showsNumber([text], later(i))) out.push(`${part.id}: the early note`)
  })
  return out
}

/**
 * The gate every generated problem passes; a failure skips the draw (LogSkip) and the seed tries the next one. A text
 * that does not read as English is a bug, not a draw to skip.
 */
export function assertObliqueProblem(answer: ObliqueAnswer, instructions: string, cards: readonly RuleCard[], hints: readonly string[]): void {
  for (const part of answer.stages) {
    const early = answer.early[part.id] ?? []
    for (const form of part.kind === 'choice' ? [part.answerText] : [part.answerText, ...part.forms]) {
      const g = gradeObliquePart(part, early, form)
      if (g.verdict !== 'correct') throw new LogSkip(`${part.id}: “${form}” graded ${g.verdict}`)
    }
    for (const trap of part.traps) {
      const g = gradeObliquePart(part, early, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new LogSkip(`${part.id}: trap ${trap.id} “${trap.text}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
    }
    for (const e of early) {
      const g = gradeObliquePart(part, early, e.toFixed(1))
      if (g.verdict !== 'invalid') throw new LogSkip(`${part.id}: the early value ${e} graded ${g.verdict}`)
    }
    if (part.kind !== 'choice' && gradeObliquePart(part, early, '???').verdict !== 'invalid') throw new LogSkip(`${part.id}: nonsense was graded`)
  }
  if (answer.trap) {
    const stage = answer.stages.find((s) => s.id === answer.trapStage)
    if (!stage?.traps.some((t) => t.id === answer.trap && t.text === answer.trapAnswer)) throw new LogSkip(`the promised ${answer.trap} is not a candidate`)
  }
  for (const text of readableTexts(answer, instructions)) {
    const bad = badEnglish(text)
    if (bad) throw new Error(bad)
  }
  const leaks = obliqueLeaks(answer, instructions, cards, hints)
  if (leaks.length) throw new LogSkip(`a text she sees early spells an answer: ${leaks[0]}`)
  const tex = texLeftovers(answer)
  if (tex.length) throw new Error(tex[0])
  for (const line of answer.reveal) if (plain(answer.prompt).includes(plain(line))) throw new LogSkip('the worked solution is in the prompt')
}
