/**
 * Shared building blocks for honors Unit 5: the format hints, the values no template may use as an answer,
 * number and choice parts, and the last gate every problem passes before it ships. The gate refuses a problem
 * when anything she can read before she answers (the prompt, the figure, a hint, a nudge, a witness, a catalog
 * lesson or example, a rule card's example) shows a part's answer, when a figure's labels would collide at
 * 375 px, or when a prompt does not read as English. A generator that is refused tries again with new numbers.
 */
import { ERROR_PATTERNS } from '@/engine'
import { makeRng } from '@/content/rng'
import type { GeometryAnswer, GeometryQuestion, GeometryStageId, RuleCard } from '@/content/types'
import type { ErrorPatternId, GeoFigureSpec } from '@/shared/types'
import { readGeoAnswer, sameGeoValue } from './answer'
import type { GeoBuilt } from './build'
import { exampleShowsAnswer, exposed, gradeGeoStage, isGeoMistake, stageDisplay } from './grade'
import { lin, qText, solveEqual, type Lin, type Q } from './expr'
import { figureIssues } from './unit5Layout'

export const X_HINT5 = 'A number, like 4 or x = 4.'
export const DEG_HINT5 = 'Degrees, like 17, 17°, or 17 deg.'
export const LEN_HINT5 = 'A length, like 53.'
export const RAD_HINT5 = 'A length in simplest radical form, like 2√3.'
export const SLOPE_HINT5 = 'A slope, like 1/4 or -4.'
export const PT_HINT5 = 'A point, like (-4, 1).'

/**
 * No Unit 5 part has one of these as its answer. They are the numbers in the format hints (4, 17, 53), in the
 * rule cards and the catalog examples (2, 33, 43, 86, 180, and the reused Unit 1 examples 8 and 40), and the
 * measures a rule states outright (45, 90).
 */
export const RESERVED_NUMBERS: ReadonlySet<number> = new Set([2, 4, 8, 17, 33, 40, 43, 45, 53, 86, 90, 180])
/** The same for slopes, radicals, and points: the hint and rule-card examples, and the reused Unit 1 catalog examples. */
export const RESERVED_TEXT: ReadonlySet<string> = new Set(['1/4', '-1/4', '4', '-4', '2√3', '2√5', '2√10', '(-4, 1)', '(4, 2)', '(5/2, 11/2)', '(-3/2, -5/2)'])

/** x for every Unit 5 template: 18 values, none reserved. */
export const X_POOL5: readonly number[] = [3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 21, 22, 24, 25]

export const reserved = (n: number) => RESERVED_NUMBERS.has(n)

export interface TrapDraft {
  id: ErrorPatternId
  stage: GeometryStageId
  text: string
  witness: string
}

type Stage = GeometryAnswer['stages'][number]

/** "−3", "7/2": a rational as she would type it (ASCII minus). */
export function typed(q: Q): string {
  return qText(q)
}

/** An integer value of q, or null. */
export function whole(q: Q | null): number | null {
  return q && q.d === 1 ? q.n : null
}

/** "3(5) − 7 = 8", "11 + 8 = 19": an expression evaluated at x, as she would write it. */
export function atX(e: Lin, x: number): string {
  const head = e.a === 1 ? `${x}` : `${e.a}(${x})`
  const value = e.a * x + e.b
  if (e.b === 0) return `${head} = ${value}`
  return `${head} ${e.b < 0 ? '−' : '+'} ${Math.abs(e.b)} = ${value}`
}

/** a·x + b with value `value` at x, trying the coefficients in the order given. */
export function fit(value: number, x: number, a: number): Lin {
  return lin(a, value - a * x)
}

/** The x that makes `left` equal `right`, or null when there is none or every x works. */
export function solve(left: Lin, right: Lin): Q | null {
  return solveEqual(left, right)
}

export function sum(e: Lin, f: Lin): Lin {
  return lin(e.a + f.a, e.b + f.b)
}

export function times(k: number, e: Lin): Lin {
  return lin(k * e.a, k * e.b)
}

function sameValue(a: string, b: string): boolean {
  const ra = readGeoAnswer(a, { allowUndefined: true })
  const rb = readGeoAnswer(b, { allowUndefined: true })
  if (!ra.ok || !rb.ok) return a.trim() === b.trim()
  return sameGeoValue(ra.value, rb.value)
}

/** Traps for one number part: never the answer, and never two with the same value (the first keeps it). */
export function trapsFor(stage: GeometryStageId, answerText: string, drafts: readonly TrapDraft[]): Stage['traps'] {
  const out: Stage['traps'] = []
  for (const d of drafts) {
    if (d.stage !== stage) continue
    if (sameValue(d.text, answerText)) continue
    if (out.some((t) => sameValue(t.text, d.text))) continue
    out.push({ id: d.id, text: d.text, witness: d.witness })
  }
  return out
}

export function numberStage(opts: {
  id: GeometryStageId
  label: string
  hint: string
  answerText: string
  nudge: string
  ruleCard: string
  reveal: string[]
  traps: readonly TrapDraft[]
  deg?: boolean
  kind?: 'number' | 'point'
}): Stage {
  return {
    id: opts.id,
    kind: opts.kind ?? 'number',
    ...(opts.deg ? { unit: 'deg' as const } : {}),
    label: opts.label,
    hint: opts.hint,
    answerText: opts.answerText,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    traps: trapsFor(opts.id, opts.answerText, opts.traps),
  }
}

export interface ChoiceDraft5 {
  id: string
  text: string
  trap?: ErrorPatternId
  witness?: string
}

/** A pick-one part. The order of the choices comes from the seed. */
export function choiceStage(opts: {
  id: GeometryStageId
  label: string
  hint: string
  choices: ChoiceDraft5[]
  answerId: string
  nudge: string
  ruleCard: string
  reveal: string[]
  seed: number
  salt: number
  keepOrder?: boolean
}): Stage {
  const order = opts.keepOrder ? [...opts.choices] : makeRng((opts.seed ^ Math.imul(opts.salt + 1, 0x9e3779b1)) >>> 0 || 1).shuffle(opts.choices)
  const traps = order
    .filter((c) => c.trap && c.witness && c.id !== opts.answerId)
    .map((c) => ({ id: c.trap!, text: c.id, witness: c.witness! }))
  return {
    id: opts.id,
    kind: 'choice',
    label: opts.label,
    hint: opts.hint,
    answerText: opts.answerId,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    choices: order.map((c) => (c.trap && c.witness && c.id !== opts.answerId ? { id: c.id, text: c.text, trap: c.trap, witness: c.witness } : { id: c.id, text: c.text })),
    traps,
  }
}

/** A word answer is found whole and in any case; a number or a short word is found as its own token. */
function shows(blob: string, display: string): boolean {
  const d = display.trim()
  if (!d || !blob) return false
  if (/[A-Za-z]{4}/.test(d)) return blob.toLowerCase().includes(d.toLowerCase())
  return exposed(blob, d)
}

/** Every value a part's answer is written as: the stored text, and the text with a Unicode minus. */
function spellings(display: string): string[] {
  const out = [display]
  if (display.includes('-')) out.push(display.replace(/-/g, '−'))
  return out
}

/** Grammar the prompt has to keep for every seed. */
export function englishIssues(text: string): string[] {
  const out: string[] = []
  if (/\b[Aa]n? \d/.test(text)) out.push(`an article before a number: “${text}”`)
  if (/\b1 (ticks|arcs|units|degrees)\b/.test(text) || /\b([02-9]|\d{2,}) (tick|arc|unit|degree)\b/.test(text)) out.push(`a plural that does not agree: “${text}”`)
  for (const sentence of text.split(/(?<=[.?!])\s+/)) {
    const s = sentence.trim()
    if (s && !/^[A-Z]/.test(s)) out.push(`a sentence that does not start with a capital letter: “${s}”`)
  }
  return out
}

/** Why this problem may not ship, or null. */
export function leakOf(answer: GeometryAnswer, cards: readonly RuleCard[]): string | null {
  const displays = answer.stages.map((stage) => stageDisplay(stage))
  for (const display of displays) {
    const n = Number(display)
    if (display.trim() !== '' && Number.isFinite(n) && RESERVED_NUMBERS.has(n)) return `answer ${display} is reserved`
    if (RESERVED_TEXT.has(display)) return `answer ${display} is reserved`
  }
  const screen: string[] = [answer.prompt, answer.figure.ariaLabel, ...(answer.lines ?? [])]
  for (const p of answer.figure.points) screen.push(p.label ?? '')
  for (const s of answer.figure.segments ?? []) if (s.label) screen.push(s.label)
  for (const a of answer.figure.angles ?? []) if (a.label) screen.push(a.label)
  for (const stage of answer.stages) screen.push(stage.hint, stage.nudge, stage.note ?? '')
  const screenBlob = screen.join('\n')
  for (const display of displays) {
    for (const spelled of spellings(display)) if (shows(screenBlob, spelled)) return `“${display}” is on screen before she answers`
  }
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    const replies = [gradeGeoStage(answer, stage.id, stage.kind === 'choice' ? '' : '???'), gradeGeoStage(answer, stage.id, stage.kind === 'choice' ? 'not-a-choice' : '1001')]
    for (const grade of replies) {
      if (grade.verdict === 'correct') return `${stage.id} accepts nonsense`
      const said = grade.verdict === 'mistake' ? grade.witness : grade.message
      if (shows(said, display)) return `${stage.id} message shows “${display}”`
    }
    for (const trap of stage.traps) {
      if (!isGeoMistake(trap.id)) return `${trap.id} is not a geometry mistake`
      for (const other of displays) if (shows(trap.witness, other)) return `${stage.id} ${trap.id} witness shows “${other}”`
      const info = ERROR_PATTERNS[trap.id]
      const lesson = `${info.title}\n${info.lesson}\n${info.example}`
      if (shows(lesson, display)) return `${stage.id} catalog ${trap.id} shows “${display}”`
      if (exampleShowsAnswer(info.example, display)) return `${stage.id} catalog example ${trap.id} shows ${display}`
    }
    for (const card of cards) {
      const example = card.example ?? ''
      if (shows(example, display)) return `${stage.id} rule card ${card.id} example shows “${display}”`
      const result = example.split(/=|→/).pop()?.trim() ?? ''
      if (result && exampleShowsAnswer(result, display)) return `${stage.id} rule card ${card.id} result shows ${display}`
      // A card body may name every shape or method; it may not contain a number that is the answer.
      if (!/[A-Za-z]{4}/.test(display) && shows(card.body, display)) return `${stage.id} rule card ${card.id} body shows ${display}`
    }
  }
  return null
}

export interface Finish5 {
  question: GeometryQuestion
  prompt: string
  figure: GeoFigureSpec
  stages: Stage[]
  lengths: number[]
  angles: number[]
  title: string
  instructions: string
  params: Record<string, string | number | boolean>
  cards: readonly RuleCard[]
  /** Rule cards for named mistakes, by id; only cards this module has are listed. */
  ruleFor: Partial<Record<ErrorPatternId, string>>
  /** Which slip the seed promises, most wanted first. Falls back to the first trap. */
  promise: readonly ErrorPatternId[]
  /** The part whose slip is promised when several parts have it (a later part cannot hint at one still open). */
  promiseStage?: GeometryStageId
  /** The pick or value to promise when several traps share an id (the nearest general name, say). */
  promiseText?: string
}

/** The finished problem, or null when it shows an answer, crowds its figure, or does not read as English. */
export function finish5(o: Finish5): GeoBuilt | null {
  const traps = o.stages.flatMap((s) => s.traps.map((t) => ({ ...t, stage: s.id })))
  if (traps.length === 0) return null
  const first = (list: typeof traps, keep: (t: (typeof traps)[number]) => boolean) => [...list.filter(keep), ...list.filter((t) => !keep(t))]
  // A slip she would believe is promised first: a positive whole number (or a pick), not a fraction or a negative.
  const believable = (t: (typeof traps)[number]) => (/^\d+$/.test(t.text) ? Number(t.text) > 0 : !/^-?\d/.test(t.text))
  let ordered = first(traps, believable)
  if (o.promiseText) ordered = first(ordered, (t) => t.text === o.promiseText)
  if (o.promiseStage) ordered = first(ordered, (t) => t.stage === o.promiseStage)
  let picked = ordered[0]!
  search: for (const onlyBelievable of [true, false]) {
    for (const id of o.promise) {
      const hit = ordered.find((t) => t.id === id && (!onlyBelievable || believable(t)))
      if (hit) {
        picked = hit
        break search
      }
    }
  }
  const known = new Set(o.cards.map((c) => c.id))
  const cardIds = [...new Set([...o.stages.map((s) => s.ruleCard), ...traps.map((t) => o.ruleFor[t.id]).filter((id): id is string => Boolean(id))])].filter((id) => known.has(id))
  for (const s of o.stages) if (!known.has(s.ruleCard)) throw new Error(`${s.id}: rule card ${s.ruleCard} is not in this module`)
  const answer: GeometryAnswer = {
    type: 'geometry',
    question: o.question,
    prompt: o.prompt,
    figure: o.figure,
    stages: o.stages,
    lengths: o.lengths,
    angles: o.angles,
    expectedDisplay: o.stages.map((s) => `${s.label}: ${stageDisplay(s)}`).join(' · '),
    reveal: o.stages.flatMap((s) => s.reveal),
    ruleCards: cardIds,
    trap: picked.id,
    trapStage: picked.stage,
    trapAnswer: picked.text,
  }
  if (englishIssues(o.prompt).length > 0 || englishIssues(o.figure.ariaLabel).length > 0) return null
  if (o.figure.points.length > 0 && figureIssues(o.figure).length > 0) return null
  if (leakOf(answer, o.cards)) return null
  for (const stage of o.stages) {
    if (gradeGeoStage(answer, stage.id, stage.answerText).verdict !== 'correct') return null
    for (const trap of stage.traps) {
      const g = gradeGeoStage(answer, stage.id, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) return null
    }
  }
  return { answer, title: o.title, instructions: o.instructions, params: o.params }
}

/** The x a slip produces as she would type it, or null when that slip has no single answer. */
export function slipText(q: Q | null): string | null {
  return q ? typed(q) : null
}

/** A positive whole number from an equation, or null. */
export function wholePositive(q: Q | null): number | null {
  const n = whole(q)
  return n !== null && n > 0 ? n : null
}

export { lin }
export type { Lin }
