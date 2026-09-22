/**
 * Builds the tutor's TutorContext at the moment she presses Send.
 * Field sources: docs/progress/tutor-core.md §6. Never her name, email, or account.
 */
import { FN_PATTERN } from '@/content/modules/domainRange/patterns'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import type { FunctionGrade } from '@/engine'
import { getModule } from '@/content/registry'
import type { FinalAnswerGrade } from '@/problem/inequality'
import { decodeSlotStep } from '@/problem/evenOdd'
import type { GfGrade } from '@/content/modules/graphFeatures/grade'
import type { Attempt } from '@/store'
import type { AtomGrade, PatternHit, SigFigGrade, SigFigTapGrade, StepResult } from '@/shared/types'
import { TUTOR_LIMITS, type TutorContext, type TutorMistake, type TutorVerdict } from '@/shared/tutor'

const STEP_KINDS = new Set(['inequality', 'inverse', 'evenOdd', 'diffQuotient'])

const GF_WORK = ['increasing', 'decreasing', 'globalMax', 'globalMin', 'localMax', 'localMin'] as const
const FN_WORK = ['answer', 'f', 'g'] as const

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max)
}

function mistakeOf(pattern: PatternHit): TutorMistake {
  return {
    ...(pattern.id ? { id: clip(pattern.id, 80) } : {}),
    title: clip(pattern.title, 200),
    lesson: clip(pattern.lesson, TUTOR_LIMITS.field),
    ...(pattern.witness ? { witness: clip(pattern.witness, TUTOR_LIMITS.field) } : {}),
  }
}

function withMessage(status: TutorVerdict['status'], message: string | undefined, line?: string, mistake?: TutorMistake): TutorVerdict {
  return {
    status,
    ...(line ? { line: clip(line, TUTOR_LIMITS.line) } : {}),
    ...(message ? { message: clip(message, TUTOR_LIMITS.field) } : {}),
    ...(mistake ? { mistake } : {}),
  }
}

/** A worked-line StepResult, rejected or accepted. */
export function verdictFromStep(result: StepResult, herText: string): TutorVerdict {
  if (result.ok) {
    return withMessage('accepted', result.detected?.detail, result.normalized?.text ?? herText)
  }
  const status = result.verdict === 'parse_error' ? 'parse_error' : 'rejected'
  const message = result.counterexample?.message ?? result.parseError?.message
  return withMessage(status, message, herText, result.pattern ? mistakeOf(result.pattern) : undefined)
}

/** Interval + set-builder final answer (inequalities and the number line). */
export function verdictFromSetAnswer(grade: FinalAnswerGrade, texts: { interval: string; set: string }): TutorVerdict | null {
  const line = [
    texts.interval.trim() ? `interval: ${texts.interval.trim()}` : '',
    texts.set.trim() ? `set: ${texts.set.trim()}` : '',
  ]
    .filter(Boolean)
    .join('; ')
  if (grade.mismatch) {
    return withMessage('wrong', grade.mismatch.witness ?? grade.mismatch.lesson, line, mistakeOf(grade.mismatch))
  }
  const bad = [grade.interval, grade.setBuilder].find((f) => f.status === 'parse' || f.status === 'wrong')
  if (bad?.status === 'parse') return withMessage('parse_error', bad.message, line, bad.pattern ? mistakeOf(bad.pattern) : undefined)
  if (bad?.status === 'wrong') return withMessage('wrong', bad.message, line, bad.pattern ? mistakeOf(bad.pattern) : undefined)
  if (grade.done) return withMessage('correct', undefined, line)
  return null
}

/** Domain, range, or composition grade from the function engine. */
export function verdictFromFunction(grade: FunctionGrade): TutorVerdict | null {
  if (grade.verdict === 'unsupported') return null
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const id = FN_PATTERN[grade.mistake]
  const info = ERROR_PATTERNS[id]
  return withMessage('wrong', grade.witness, undefined, {
    id,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

export function verdictFromSigFig(grade: SigFigGrade): TutorVerdict {
  return withMessage(grade.status, grade.message, undefined, grade.pattern ? mistakeOf(grade.pattern) : undefined)
}

export function verdictFromTaps(grade: SigFigTapGrade): TutorVerdict {
  const pattern = grade.patterns[0]
  return withMessage(grade.correct ? 'correct' : 'wrong', grade.message, undefined, pattern ? mistakeOf(pattern) : undefined)
}

/** First named mistake across the boxes, matching the card she is looking at. */
export function verdictFromAtom(grade: AtomGrade): TutorVerdict {
  const pattern = grade.patterns[0]
  return withMessage(grade.status, grade.message, undefined, pattern ? mistakeOf(pattern) : undefined)
}

export function verdictFromGraph(grade: GfGrade): TutorVerdict | null {
  if (grade.incomplete) return null
  if (grade.correct) return withMessage('correct', "That's the graph.")
  const pattern = grade.patterns[0]
  const field = grade.fields.find((f) => f.status === 'wrong')
  return withMessage('wrong', pattern?.witness ?? field?.message, undefined, pattern ? mistakeOf(pattern) : undefined)
}

/** One-to-one and even/odd verdict cards: right or wrong, in the card's own words. */
export function verdictFromYesNo(correct: boolean, message: string, line: string): TutorVerdict {
  return withMessage(correct ? 'correct' : 'wrong', message, line)
}

/** Check-it / twin number boxes. */
export function verdictFromChecked(fields: { status: string; message: string }[], done: boolean): TutorVerdict | null {
  const filled = fields.filter((f) => f.status !== 'empty')
  if (filled.length === 0) return null
  const parse = filled.find((f) => f.status === 'parse')
  if (parse) return withMessage('parse_error', parse.message)
  const wrong = filled.find((f) => f.status === 'wrong')
  if (wrong) return withMessage('wrong', wrong.message)
  if (done) return withMessage('correct', filled.map((f) => f.message).filter(Boolean).join(' '))
  return null
}

/** Decomposition check (composition). A parse or an unsupported problem is a parse_error. */
export function verdictFromDecomposition(result: { ok: boolean; message: string; reason?: string }): TutorVerdict {
  const parse = !result.ok && (result.reason === 'parse_f' || result.reason === 'parse_g' || result.reason === 'unsupported')
  if (parse) return withMessage('parse_error', result.message)
  return withMessage(result.ok ? 'correct' : 'wrong', result.message)
}

function pushLine(lines: string[], label: string, text: string | undefined) {
  const t = text?.trim()
  if (!t) return
  lines.push(clip(`${label}: ${t}`, TUTOR_LIMITS.line))
}

function pushRecord(lines: string[], record: Record<string, string> | undefined, order: readonly string[]) {
  if (!record) return
  const seen = new Set<string>()
  for (const key of order) {
    seen.add(key)
    pushLine(lines, key, record[key])
  }
  for (const [key, value] of Object.entries(record)) {
    if (!seen.has(key)) pushLine(lines, key, value)
  }
}

function workOf(instance: ProblemInstance, attempt: Attempt | null): string[] {
  if (!attempt) return []
  if (STEP_KINDS.has(instance.kind)) {
    return attempt.steps
      .slice(0, TUTOR_LIMITS.lines)
      .map((step) => {
        if (instance.kind !== 'evenOdd') return clip(step.text, TUTOR_LIMITS.line)
        const decoded = decodeSlotStep(step.text)
        if (!decoded) return clip(step.text, TUTOR_LIMITS.line)
        const prefix = decoded.slot === 'A' ? 'f(-x): ' : '-f(x): '
        return clip(prefix + decoded.expr, TUTOR_LIMITS.line)
      })
  }
  const final = attempt.final
  if (!final) return []
  const lines: string[] = []
  pushLine(lines, 'interval', final.interval)
  pushLine(lines, 'set', final.set)
  pushLine(lines, 'coefficient', final.sfText)
  pushLine(lines, 'power', final.sfPower)
  pushLine(lines, 'intermediate', final.sfIntermediate)
  pushRecord(lines, final.atEntries, [])
  pushRecord(lines, final.gfEntries, GF_WORK)
  pushRecord(lines, final.fnEntries, FN_WORK)
  return lines.slice(0, TUTOR_LIMITS.lines)
}

function statementOf(instance: ProblemInstance): string {
  const answer = instance.answer
  let text = instance.statementText
  if (answer.type === 'sigFigs' || answer.type === 'atoms') {
    const context = answer.context.trim()
    text = context ? `${answer.prompt} ${context}` : answer.prompt
  } else if (answer.type === 'graphFeatures') {
    const turns = answer.turns.map((t) => `(${t.x}, ${t.y}) ${t.kind}`).join(', ')
    text = `${answer.shape} shape, turning points ${turns}, left end ${answer.leftEnd}, right end ${answer.rightEnd}`
  } else if (answer.type === 'domainRange') {
    const which = answer.question === 'domain' ? 'Find the domain of' : 'Find the range of'
    text = `${which} ${instance.statementText}`
  } else if (answer.type === 'composition') {
    text = `${answer.question}: ${instance.statementText}`
  }
  const clipped = clip(text, TUTOR_LIMITS.field)
  return clipped.trim() ? clipped : clip(instance.title, TUTOR_LIMITS.field)
}

function canonicalOf(instance: ProblemInstance): string[] {
  const answer = instance.answer
  let lines: string[] = []
  if (STEP_KINDS.has(instance.kind)) lines = instance.canonical.map((c) => c.text)
  else if (
    answer.type === 'sigFigs' ||
    answer.type === 'atoms' ||
    answer.type === 'graphFeatures' ||
    answer.type === 'domainRange' ||
    answer.type === 'composition'
  ) {
    lines = answer.reveal
  }
  return lines.slice(0, TUTOR_LIMITS.lines).map((line) => clip(line, TUTOR_LIMITS.line))
}

function answerOf(instance: ProblemInstance): string | undefined {
  const answer = instance.answer
  let text = ''
  switch (answer.type) {
    case 'set':
      text = [answer.interval, answer.setBuilder].filter(Boolean).join(' ; ')
      break
    case 'parity':
      text = answer.verdict
      break
    case 'inverse':
      text = answer.inverse ?? 'not one-to-one'
      break
    case 'diffQuotient':
      text = answer.simplified
      break
    case 'sigFigs':
    case 'atoms':
      text = answer.expectedDisplay
      break
    case 'graphFeatures':
      text = [answer.increasing, answer.decreasing, answer.globalMax, answer.globalMin, answer.localMax, answer.localMin].join(' | ')
      break
    case 'domainRange':
      text = answer.interval
      break
    case 'composition':
      if (answer.question === 'expr') text = answer.simplified ?? ''
      else if (answer.question === 'value') text = answer.valueText ?? ''
      else if (answer.question === 'domain') text = answer.interval ?? ''
      else text = `f(x) = ${answer.f}; g(x) = ${answer.g}`
      break
    default:
      text = ''
  }
  const clipped = clip(text, TUTOR_LIMITS.field).trim()
  return clipped ? clipped : undefined
}

function cleanVerdict(verdict: TutorVerdict): TutorVerdict {
  const mistake = verdict.mistake
    ? {
        ...(verdict.mistake.id ? { id: clip(verdict.mistake.id, 80) } : {}),
        title: clip(verdict.mistake.title, 200),
        lesson: clip(verdict.mistake.lesson, TUTOR_LIMITS.field),
        ...(verdict.mistake.witness ? { witness: clip(verdict.mistake.witness, TUTOR_LIMITS.field) } : {}),
      }
    : undefined
  return withMessage(verdict.status, verdict.message, verdict.line, mistake)
}

/**
 * Problem, her work so far, the checker's latest verdict, and the reference solution.
 * `finished` is true once the flow is showing its completion card.
 */
export function buildTutorContext(
  instance: ProblemInstance,
  attempt: Attempt | null,
  verdict: TutorVerdict | null | undefined,
  finished: boolean,
): TutorContext {
  const answer = answerOf(instance)
  const subject = getModule(instance.moduleId).subject === 'Chemistry' ? 'chemistry' : 'precalculus'
  return {
    problemId: instance.id,
    ...(attempt?.id ? { attemptId: attempt.id } : {}),
    moduleId: instance.moduleId,
    subject,
    kind: instance.kind,
    title: clip(instance.title, 200),
    instructions: clip(instance.instructions, TUTOR_LIMITS.field),
    statement: statementOf(instance),
    work: workOf(instance, attempt),
    ...(verdict ? { verdict: cleanVerdict(verdict) } : {}),
    canonical: canonicalOf(instance),
    ...(answer ? { answer } : {}),
    finished,
    revealed: Boolean(attempt?.steps.some((s) => s.revealed) || attempt?.final?.revealed === true),
  }
}
