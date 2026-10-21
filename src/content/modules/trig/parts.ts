/**
 * Checking one part of a trig problem with the core's grader (engine/trig), and the checks every generated problem
 * passes before it is shown: each answer and each of its spellings grades right, each slip grades as its own id,
 * the promised slip is one of them, and nothing she can see before she answers a part spells its answer.
 */
import type { RuleCard, TrigAnswer, TrigPart, TrigPartTrap } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { gradeTrigAnswer, isTrigMistake, q, readExact, type Q, type TrigCandidate, type TrigSpec } from '@/engine/trig'
import type { ErrorPatternId } from '@/shared/types'
import { LogSkip } from '../explog/text'
import { pieces, plain, showsAnswer } from './text'

export type TrigPartGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

/** "150" or "45/2" back to an exact number of degrees. */
export function degreesOf(text: string): Q {
  const [n, d] = text.split('/')
  return q(Number(n), d ? Number(d) : 1)
}

export function specOf(part: TrigPart): TrigSpec {
  const c = part.check
  switch (c.kind) {
    case 'angle':
      return { kind: 'angle', unit: c.unit, deg: degreesOf(c.deg) }
    case 'value': {
      const v = readExact(c.value)
      if (v === null) throw new Error(`${part.id}: the answer ${c.value} cannot be read`)
      return { kind: 'value', value: v, ...(c.fn ? { fn: c.fn } : {}), ...(c.units ? { units: c.units } : {}) }
    }
    case 'decimal':
      return { kind: 'decimal', value: c.value, places: c.places, ...(c.unit ? { unit: c.unit } : {}), ...(c.units ? { units: c.units } : {}) }
    case 'choice':
      throw new Error('a choice part has no spec')
  }
}

function candidateOf(part: TrigPart, trap: TrigPartTrap): TrigCandidate | null {
  if (!isTrigMistake(trap.id)) return null
  if (part.check.kind === 'decimal') return trap.value === undefined ? null : { id: trap.id, value: trap.value, witness: trap.witness }
  const v = readExact(trap.text)
  return v === null ? null : { id: trap.id, value: v, witness: trap.witness }
}

export function candidatesOf(part: TrigPart): TrigCandidate[] {
  return part.traps.map((t) => candidateOf(part, t)).filter((c): c is TrigCandidate => c !== null)
}

function gradeChoice(part: TrigPart, raw: string): TrigPartGrade {
  const t = raw.trim()
  if (!t) return { verdict: 'invalid', message: 'Pick one of the choices first.' }
  const hit = (part.choices ?? []).find((c) => c.value === t || c.label.toLowerCase() === t.toLowerCase())
  if (!hit) return { verdict: 'invalid', message: 'Pick one of the choices.' }
  if (hit.value === part.answerText) return { verdict: 'correct', message: `Correct: ${hit.label}.` }
  const trap = part.traps.find((tr) => tr.text === hit.value)
  if (trap) return { verdict: 'mistake', mistake: trap.id, witness: trap.witness }
  return { verdict: 'wrong', message: part.wrongNote }
}

/** Grade her entry for one part. A plain wrong answer gets the part's own note (what to look at, never the answer). */
export function gradeTrigPart(part: TrigPart, raw: string): TrigPartGrade {
  if (part.kind === 'choice') return gradeChoice(part, raw)
  const g = gradeTrigAnswer(specOf(part), raw, candidatesOf(part))
  switch (g.verdict) {
    case 'correct':
      return { verdict: 'correct', message: g.message }
    case 'mistake':
      return { verdict: 'mistake', mistake: g.mistake, witness: g.witness }
    case 'wrong':
      return { verdict: 'wrong', message: part.wrongNote }
    case 'invalid':
      return { verdict: 'invalid', message: g.message }
  }
}

/** Her boxes in reading order, for the tutor: "Reference angle: π/6". */
export function trigWork(stages: readonly TrigPart[], entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const s of stages) {
    const v = entries[s.id]?.trim()
    if (!v) continue
    const label = s.kind === 'choice' ? (s.choices?.find((c) => c.value === v)?.label ?? v) : v
    lines.push(`${s.label}: ${label}`)
  }
  return lines
}

/** Every part's answer as she would type it (for tests and the tutor's reference). */
export function trigEntries(stages: readonly TrigPart[]): Record<string, string> {
  return Object.fromEntries(stages.map((s) => [s.id, s.answerText]))
}

/** Spellings of a part's answer that would give it away. A choice's options are on screen by design. */
export function answerForms(part: TrigPart): string[] {
  if (part.kind === 'choice') return []
  return [...new Set([part.answerText, ...part.forms])].filter(Boolean)
}

/** What a part shows before she has its answer: its label, question, hint, nudge, the slips' sentences, the plain note. */
export function partShownTexts(part: TrigPart): string[] {
  return [part.label, part.ask, part.formatHint, part.nudge, part.wrongNote, ...part.traps.map((t) => t.witness)]
}

/** The catalog title, lesson and example of every slip this part can name. */
export function partCatalogTexts(part: TrigPart): string[] {
  const ids = new Set(part.traps.map((t) => t.id))
  return [...ids].flatMap((id) => [ERROR_PATTERNS[id].title, ERROR_PATTERNS[id].lesson, ERROR_PATTERNS[id].example])
}

/**
 * Texts she can see before each part is answered, checked against that part's answer and every later one: the
 * prompt, the instructions, the figure's words, every rule card and format hint (on screen throughout), and each
 * part's own texts and catalog entries (once it is open).
 */
export function trigLeaks(answer: TrigAnswer, instructions: string, cards: readonly RuleCard[], hints: readonly string[]): string[] {
  const out: string[] = []
  const stages = answer.stages
  const later = (from: number) => stages.slice(from).flatMap(answerForms)
  const always = [answer.prompt, instructions, answer.figure.ariaLabel, answer.figure.label, answer.figure.point?.label ?? '', answer.figure.sector?.radiusLabel ?? '', ...hints, ...cards.flatMap((c) => [c.title, c.body, c.example ?? ''])]
  for (const text of always) if (text && showsAnswer([text], later(0))) out.push(text)
  stages.forEach((part, i) => {
    for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (text && showsAnswer([text], later(i))) out.push(`${part.id}: ${plain(text)}`)
  })
  return out
}

/** Every math string reads back as words: no TeX left over. */
export function texLeftovers(answer: TrigAnswer): string[] {
  const all = [answer.prompt, ...answer.reveal, ...answer.stages.flatMap((s) => [s.ask, s.nudge, ...s.reveal])]
  const bad: string[] = []
  for (const s of all) {
    if ((s.match(/\$/g) ?? []).length % 2 !== 0) bad.push(`unbalanced $: ${s}`)
    const words = plain(s)
    if (/[\\{}$]/.test(words)) bad.push(`TeX left in: ${words}`)
    for (const p of pieces(s)) if (!p.tex && /\\/.test(p.text)) bad.push(`TeX outside $…$: ${s}`)
  }
  return bad
}

/**
 * The gate every generated problem passes; a failure skips the draw (LogSkip) and the seed tries the next one.
 * `promisable` are the slips the template may promise; the chosen one is graded here.
 */
export function assertTrigProblem(answer: TrigAnswer, instructions: string, cards: readonly RuleCard[], hints: readonly string[]): void {
  for (const part of answer.stages) {
    for (const form of part.kind === 'choice' ? [part.answerText] : [part.answerText, ...part.forms]) {
      const g = gradeTrigPart(part, form)
      if (g.verdict !== 'correct') throw new LogSkip(`${part.id}: “${form}” graded ${g.verdict}${g.verdict === 'invalid' || g.verdict === 'wrong' ? `: ${g.message}` : ''}`)
    }
    for (const trap of part.traps) {
      const g = gradeTrigPart(part, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new LogSkip(`${part.id}: trap ${trap.id} “${trap.text}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
    }
    if (part.kind !== 'choice' && gradeTrigPart(part, '???').verdict !== 'invalid') throw new LogSkip(`${part.id}: nonsense was graded`)
  }
  if (answer.trap) {
    const stage = answer.stages.find((s) => s.id === answer.trapStage)
    if (!stage?.traps.some((t) => t.id === answer.trap && t.text === answer.trapAnswer)) throw new LogSkip(`the promised ${answer.trap} is not a candidate`)
  }
  const leaks = trigLeaks(answer, instructions, cards, hints)
  if (leaks.length) throw new LogSkip(`a text she sees early spells an answer: ${leaks[0]}`)
  const tex = texLeftovers(answer)
  if (tex.length) throw new Error(tex[0])
  for (const line of answer.reveal) if (plain(answer.prompt).includes(plain(line))) throw new LogSkip('the worked solution is in the prompt')
}
