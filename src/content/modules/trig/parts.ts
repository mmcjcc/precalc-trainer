/**
 * Checking one part of a trig problem with the core's grader (engine/trig), and the checks every generated problem
 * passes before it is shown: each answer and each of its spellings grades right, each slip grades as its own id,
 * the promised slip is one of them, and nothing she can see before she answers a part spells its answer.
 */
import type { RuleCard, TrigAnswer, TrigPart, TrigPartTrap } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import {
  exactAscii,
  exactText,
  gradeAngleList,
  gradeTrigAnswer,
  isTrigMistake,
  q,
  readAngleList,
  readExact,
  type Q,
  type TrigCandidate,
  type TrigExact,
  type TrigListSlip,
  type TrigSpec,
} from '@/engine/trig'
import type { ErrorPatternId } from '@/shared/types'
import { LogSkip } from '../explog/text'
import { gradeUnit5Part, isUnit5Part, shiftSize } from './parts5'
import { pieces, plain, showsAnswer } from './text'

/**
 * A graded part. `key` (a list of angles) names her entry independent of its order and spelling, so the same list
 * checked again is the same attempt.
 */
export type TrigPartGrade =
  | { verdict: 'correct'; message: string; key?: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string; key?: string }
  | { verdict: 'wrong'; message: string; key?: string }
  | { verdict: 'invalid'; message: string }

/** Decides whether a text spells one of these answers (trig/text: showsAnswer, or the second half's showsNumber). */
export type ShowsAnswer = (texts: readonly string[], forms: readonly string[]) => boolean

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
    case 'angles':
      throw new Error('a list of angles is graded with gradeAngleList')
    default:
      throw new Error(`a ${c.kind} part is graded by parts5.ts`)
  }
}

/** A list part's slips, each read back from the list she would type. */
export function listCandidatesOf(part: TrigPart): TrigListSlip[] {
  const out: TrigListSlip[] = []
  for (const t of part.traps) {
    if (!isTrigMistake(t.id)) continue
    const r = readAngleList(t.text)
    if (!r.ok || r.items.some((i) => !i.exact)) continue
    out.push({ id: t.id, values: r.items.map((i) => i.exact as TrigExact), witness: t.witness })
  }
  return out
}

function gradeAngles(part: TrigPart, raw: string): TrigPartGrade {
  const c = part.check
  if (c.kind !== 'angles') throw new Error('not a list part')
  const value = readExact(c.value)
  if (value === null || value === 'undefined') throw new Error(`${part.id}: the value ${c.value} cannot be read`)
  const g = gradeAngleList({ unit: c.unit, degs: c.degs.map(degreesOf), fn: c.fn, value }, raw, listCandidatesOf(part))
  const key = 'key' in g && g.key ? { key: g.key } : {}
  switch (g.verdict) {
    case 'correct':
      return { verdict: 'correct', message: g.message, ...key }
    case 'mistake':
      return { verdict: 'mistake', mistake: g.mistake, witness: g.witness, ...key }
    case 'wrong':
      return { verdict: 'wrong', message: part.wrongNote, ...key }
    case 'invalid':
      return { verdict: 'invalid', message: g.message }
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
  const g = gradeOne(part, raw)
  // Unit 5: where a part has the button for an input with no value, a note points to the button, never to a word.
  return part.noValue && g.verdict === 'invalid' ? { verdict: 'invalid', message: noValueWords(g.message) } : g
}

/** The reader's "say so in a word" sentences, for a part with the no-value button. */
function noValueWords(message: string): string {
  return message
    .replace(/\s*If there is no value, say so in a word\./, ' If it has none, use the button under the box.')
    .replace(/Give a number, or a word if the value does not exist\./, 'Give a number, or use the button under the box.')
}

function gradeOne(part: TrigPart, raw: string): TrigPartGrade {
  if (part.kind === 'choice') return gradeChoice(part, raw)
  if (part.kind === 'angles') return gradeAngles(part, raw)
  // Unit 5: a phase shift, a midline, a range, key points, a function, x-values, an inverse function's value.
  if (isUnit5Part(part)) return gradeUnit5Part(part, raw)
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

/**
 * Spellings of a part's answer that would give it away. A choice's options are on screen by design. For a list of
 * angles each angle on its own gives part of it away, so each one counts (in each spelling the list has).
 */
export function answerForms(part: TrigPart): string[] {
  if (part.kind === 'choice') return []
  const forms = [part.answerText, ...part.forms]
  if (part.kind === 'angles') for (const f of [...forms]) forms.push(...f.split(/\s*,\s*/))
  // Unit 5. A phase shift's size alone gives it away (π/4 is π/4 to the left or right); each key point gives part of
  // the list away; a family's first members are asymptotes of their own.
  const c = part.check
  if (c.kind === 'shift' && c.value !== '0') {
    const size = shiftSize(c.value)
    forms.push(exactText(size), exactAscii(size))
  }
  if (c.kind === 'points') forms.push(...c.points.map(([x, y]) => `(${x}, ${y})`))
  if (c.kind === 'family') forms.push(...(part.leakForms ?? []))
  if (c.kind === 'principal' && c.deg === null) forms.push('undefined', 'no value')
  return [...new Set(forms)].filter(Boolean)
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
 * The words the figure draws while part `index` is open: the angle's label, the point's label (once the part it waits
 * for is answered), the radius, and a triangle's labels (a side she finds only once its part is answered). A solve
 * figure's angles are drawn once the problem is done, so never while a part is open.
 */
export function figureTextsAt(answer: TrigAnswer, index: number): string[] {
  const f = answer.figure
  const answered = new Set(answer.stages.slice(0, index).map((s) => s.id))
  const out = [f.label, f.sector?.radiusLabel ?? '']
  if (f.point && (!f.waitFor || answered.has(f.waitFor))) {
    out.push(f.point.label)
    // Unit 5: a reference triangle's sides, each once the part it waits for is answered.
    for (const leg of [f.legs?.x, f.legs?.y, f.legs?.r]) if (leg && (!leg.after || answered.has(leg.after))) out.push(leg.label)
  }
  if (f.triangle) {
    for (const s of f.triangle.sides) if (!s.after || answered.has(s.after)) out.push(s.label)
    for (const a of f.triangle.angles) out.push(a.label)
  }
  // Unit 5: the graph she reads (its labelled points), and the four graphs to choose from (their names only).
  if (f.graph) out.push(...(f.graph.markers ?? []).map((m) => m.label), f.graph.ariaLabel ?? '')
  for (const g of f.graphs ?? []) out.push(...(g.graph.markers ?? []).map((m) => m.label), g.graph.ariaLabel ?? '')
  return out.filter(Boolean)
}

/**
 * Texts she can see before each part is answered, checked against that part's answer and every later one: the
 * prompt, the instructions, the figure's words, every rule card and format hint (on screen throughout), and each
 * part's own texts and catalog entries (once it is open). `shows` is the leak matcher (the first half's by default).
 */
export function trigLeaks(answer: TrigAnswer, instructions: string, cards: readonly RuleCard[], hints: readonly string[], shows: ShowsAnswer = showsAnswer): string[] {
  const out: string[] = []
  const stages = answer.stages
  const later = (from: number) => stages.slice(from).flatMap(answerForms)
  const always = [answer.prompt, instructions, answer.figure.ariaLabel, ...hints, ...cards.flatMap((c) => [c.title, c.body, c.example ?? ''])]
  for (const text of always) if (text && shows([text], later(0))) out.push(text)
  stages.forEach((part, i) => {
    for (const text of figureTextsAt(answer, i)) if (shows([text], later(i))) out.push(`${part.id}: the figure’s “${text}”`)
    for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (text && shows([text], later(i))) out.push(`${part.id}: ${plain(text)}`)
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
export function assertTrigProblem(answer: TrigAnswer, instructions: string, cards: readonly RuleCard[], hints: readonly string[], shows: ShowsAnswer = showsAnswer): void {
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
  const leaks = trigLeaks(answer, instructions, cards, hints, shows)
  if (leaks.length) throw new LogSkip(`a text she sees early spells an answer: ${leaks[0]}`)
  const tex = texLeftovers(answer)
  if (tex.length) throw new Error(tex[0])
  for (const line of answer.reveal) if (plain(answer.prompt).includes(plain(line))) throw new LogSkip('the worked solution is in the prompt')
}
