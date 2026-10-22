/**
 * Builds the tutor's TutorContext at the moment she presses Send.
 * Field sources: docs/progress/tutor-core.md §6. Never her name, email, or account.
 */
import type { PwGrade } from '@/content/modules/piecewiseRate/grade'
import { FN_PATTERN } from '@/content/modules/domainRange/patterns'
import { divisionWork } from '@/content/modules/polyDivision/grade'
import { zerosWork } from '@/content/modules/polyZeros/grade'
import type { RfGrade } from '@/content/modules/rationalFns/grade'
import { rfWork } from '@/content/modules/rationalFns/build'
import type { ScGrade } from '@/content/modules/signCharts/grade'
import { scWork } from '@/content/modules/signCharts/build'
import type { CxGrade } from '@/content/modules/complexNums/grade'
import { cxWork } from '@/content/modules/complexNums/build'
import type { GeoGrade } from '@/content/modules/geometry/grade'
import { geoWork } from '@/content/modules/geometry/build'
import type { PtGrade } from '@/content/modules/periodic/grade'
import { ptWork } from '@/content/modules/periodic/grade'
import { nmWork } from '@/content/modules/nomenclature/grade'
import { EC_PATTERN } from '@/content/modules/electrons/patterns'
import { POLY_PATTERN } from '@/content/modules/polynomials/patterns'
import { TR_PATTERN } from '@/content/modules/transformations/patterns'
import type { GeometryQuestion, ProblemInstance } from '@/content/types'
import { logFormsWork } from '@/content/modules/logForms'
import { partsWork, type PartGrade } from '@/content/modules/explog/parts'
import { trigWork, type TrigPartGrade } from '@/content/modules/trig/parts'
import { plain as trigPlain } from '@/content/modules/trig/text'
import { optWork, stagesFor as optStagesFor, type OptPartGrade } from '@/content/modules/optimization/parts'
import { plain as optPlain } from '@/content/modules/optimization/text'
import { finalRoute } from '@/engine/optim'
import { ERROR_PATTERNS } from '@/engine'
import type { OpsGrade } from '@/content/modules/functionOps/ops'
import type { DescriptionGrade, EconfigGrade, FunctionGrade, LogGrade, NmGrade, PolyGrade, SquareLineGrade, TransformGrade } from '@/engine'
import { getModule, hasModule } from '@/content/registry'
import type { FinalAnswerGrade } from '@/problem/inequality'
import { decodeSlotStep } from '@/problem/evenOdd'
import type { GfGrade } from '@/content/modules/graphFeatures/grade'
import type { Attempt } from '@/store'
import type { AtomGrade, PatternHit, SigFigGrade, SigFigTapGrade, StepResult } from '@/shared/types'
import { TUTOR_LIMITS, type TutorContext, type TutorMistake, type TutorVerdict } from '@/shared/tutor'

const STEP_KINDS = new Set(['inequality', 'inverse', 'evenOdd', 'diffQuotient'])

const GF_WORK = ['increasing', 'decreasing', 'globalMax', 'globalMin', 'localMax', 'localMin'] as const
const FN_WORK = ['answer', 'f', 'g'] as const
/** Polynomial answer boxes in reading order; a module's other boxes follow in the order they were stored. */
const POLY_WORK = ['vertex', 'axis', 'opens', 'extremumKind', 'extremumValue'] as const

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

/**
 * Electron-configuration grades (one, or the diagram and the unpaired count together).
 * Unreadable input and the wrong written form are a parse error, not a wrong answer.
 * A named mistake carries the catalog lesson plus the engine's sentence about her answer.
 */
export function verdictFromEconfig(grades: readonly EconfigGrade[]): TutorVerdict | null {
  if (grades.length === 0) return null
  const invalid = grades.find((g) => g.verdict === 'invalid' || g.verdict === 'unsupported')
  if (invalid && (invalid.verdict === 'invalid' || invalid.verdict === 'unsupported')) return withMessage('parse_error', invalid.message)
  const mistake = grades.find((g) => g.verdict === 'mistake')
  if (mistake && mistake.verdict === 'mistake') {
    const id = EC_PATTERN[mistake.mistake]
    const info = ERROR_PATTERNS[id]
    return withMessage('wrong', mistake.witness, undefined, {
      id,
      title: clip(info.title, 200),
      lesson: clip(info.lesson, TUTOR_LIMITS.field),
      witness: clip(mistake.witness, TUTOR_LIMITS.field),
    })
  }
  const wrong = grades.find((g) => g.verdict === 'wrong')
  if (wrong && wrong.verdict === 'wrong') return withMessage('wrong', wrong.message)
  if (grades.every((g) => g.verdict === 'correct')) {
    const message = grades.map((g) => (g.verdict === 'correct' ? g.message : '')).filter(Boolean).join(' ')
    return withMessage('correct', message)
  }
  return null
}

/**
 * Polynomial grades (precalculus Unit 2): one, or the parts of one check together. Unreadable input and an
 * answer that is equal but not in the form asked for are a parse error, not a wrong answer. A named mistake
 * carries the catalog lesson plus the engine's sentence about her numbers. `line` is the line she typed,
 * for a line-by-line problem.
 */
export function verdictFromPoly(grades: readonly (PolyGrade | SquareLineGrade)[], line?: string): TutorVerdict | null {
  if (grades.length === 0) return null
  const invalid = grades.find((g) => g.verdict === 'invalid' || g.verdict === 'unsupported')
  if (invalid && (invalid.verdict === 'invalid' || invalid.verdict === 'unsupported')) return withMessage('parse_error', invalid.message, line)
  const mistake = grades.find((g) => g.verdict === 'mistake')
  if (mistake && mistake.verdict === 'mistake') {
    const id = POLY_PATTERN[mistake.mistake]
    const info = ERROR_PATTERNS[id]
    return withMessage('wrong', mistake.witness, line, {
      id,
      title: clip(info.title, 200),
      lesson: clip(info.lesson, TUTOR_LIMITS.field),
      witness: clip(mistake.witness, TUTOR_LIMITS.field),
    })
  }
  const wrong = grades.find((g) => g.verdict === 'wrong')
  if (wrong && wrong.verdict === 'wrong') return withMessage('wrong', wrong.message, line)
  const message = grades.map((g) => (g.verdict === 'correct' ? g.message : '')).filter(Boolean).join(' ')
  return withMessage('correct', message, line)
}

/** Spectrum order, or any light grade already shaped like a sig-fig grade. Incomplete taps are not a verdict. */
export function verdictFromOrder(grade: { status: 'correct' | 'wrong' | 'incomplete'; message: string; pattern?: PatternHit }): TutorVerdict | null {
  if (grade.status === 'incomplete') return null
  return withMessage(grade.status, grade.message, undefined, grade.pattern ? mistakeOf(grade.pattern) : undefined)
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

/** Transformation, piecewise, or average-rate grade. The catalog lesson rides along with her witness. */
export function verdictFromTransform(grade: TransformGrade | DescriptionGrade): TutorVerdict | null {
  if (grade.verdict === 'unsupported') return null
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const id = TR_PATTERN[grade.mistake]
  const info = ERROR_PATTERNS[id]
  return withMessage('wrong', grade.witness, undefined, {
    id,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/** Piecewise domain, range, continuity, or a function written from a graph. The id is already a pw_ catalog id. */
export function verdictFromPw(grade: PwGrade): TutorVerdict | null {
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.id]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.id,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/** Rational functions. The mistake id is already an rf_ catalog id. Unreadable input is a parse error. */
export function verdictFromRf(grade: RfGrade): TutorVerdict | null {
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/** Sign charts. The mistake id is already an sc_ catalog id. Unreadable input is a parse error. */
export function verdictFromSc(grade: ScGrade): TutorVerdict | null {
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/**
 * A logarithm grade (a value, a rewritten form, or an equation's solution). The mistake id is
 * already a log_ catalog id. Unreadable input is a parse error, not a wrong answer. The worked
 * explanation is not part of the verdict: it contains the answer.
 */
export function verdictFromLog(grade: LogGrade, line?: string): TutorVerdict | null {
  if (grade.verdict === 'unsupported') return null
  if (grade.verdict === 'correct') return withMessage('correct', grade.message, line)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message, line)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message, line)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, line, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/** Complex numbers. The mistake id is already a cx_ catalog id. Unreadable input is a parse error. */
export function verdictFromCx(grade: CxGrade): TutorVerdict | null {
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/** The periodic table. The mistake id is already a pt_ catalog id. Unreadable input is a parse error. */
export function verdictFromPt(grade: PtGrade): TutorVerdict | null {
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/**
 * Chemical nomenclature. The mistake id is already an nm_ catalog id. Unreadable input, a capital-letter problem
 * and an answer not in the form asked for are a parse error; a problem outside the model gives no verdict.
 */
export function verdictFromNm(grade: NmGrade): TutorVerdict | null {
  if (grade.verdict === 'unsupported') return null
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/** Geometry. The mistake id is already a geo_ catalog id. Unreadable input is a parse error. */
export function verdictFromGeo(grade: GeoGrade): TutorVerdict | null {
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/**
 * One part of an exponential/log graph or a growth and decay word problem (Unit 3, second half). The mistake
 * id is already a catalog id (exp_, or a log_ id the problem computed). Unreadable input is a parse error.
 */
export function verdictFromExpLogPart(grade: PartGrade, herText?: string): TutorVerdict | null {
  const line = herText?.trim() ? herText.trim() : undefined
  if (grade.verdict === 'correct') return withMessage('correct', grade.message, line)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message, line)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message, line)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, line, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/**
 * One part of an angle or unit-circle problem (precalculus Unit 4). The mistake id is already a trig_ catalog id.
 * Unreadable input, and an answer in a form that is not asked for (not simplest radical form, a calculator decimal,
 * the wrong unit), is a parse error: nothing was graded.
 */
export function verdictFromTrigPart(grade: TrigPartGrade, herText?: string): TutorVerdict | null {
  const line = herText?.trim() ? herText.trim() : undefined
  if (grade.verdict === 'correct') return withMessage('correct', grade.message, line)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message, line)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message, line)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, line, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
}

/**
 * One part of an optimization problem (precalculus Unit 2). The mistake id is already an opt_ catalog id; the
 * sentences hold KaTeX, read back as words. Unreadable input, an equation of the wrong kind for the box, a unit of the
 * wrong kind (or none on an area) and a rounding not asked for are a parse error: nothing was graded.
 */
export function verdictFromOptPart(grade: OptPartGrade, herText?: string): TutorVerdict | null {
  const line = herText?.trim() ? herText.trim() : undefined
  if (grade.verdict === 'correct') return withMessage('correct', optPlain(grade.message), line)
  if (grade.verdict === 'wrong') return withMessage('wrong', optPlain(grade.message), line)
  if (grade.verdict === 'invalid') return withMessage('parse_error', optPlain(grade.message), line)
  const info = ERROR_PATTERNS[grade.mistake]
  const witness = optPlain(grade.witness)
  return withMessage('wrong', witness, line, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(witness, TUTOR_LIMITS.field),
  })
}

/** Operations with functions. The mistake id is already an op_ catalog id. */
export function verdictFromOps(grade: OpsGrade): TutorVerdict {
  if (grade.verdict === 'correct') return withMessage('correct', grade.message)
  if (grade.verdict === 'wrong') return withMessage('wrong', grade.message)
  if (grade.verdict === 'invalid') return withMessage('parse_error', grade.message)
  const info = ERROR_PATTERNS[grade.mistake]
  return withMessage('wrong', grade.witness, undefined, {
    id: grade.mistake,
    title: clip(info.title, 200),
    lesson: clip(info.lesson, TUTOR_LIMITS.field),
    witness: clip(grade.witness, TUTOR_LIMITS.field),
  })
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
  // Polynomials (Unit 2): her accepted lines when the problem is worked line by line, then her answer boxes.
  if (instance.answer.type === 'quadratics') {
    const lines = attempt.steps.map((step) => clip(step.text, TUTOR_LIMITS.line))
    pushRecord(lines, attempt.final?.polyEntries, POLY_WORK)
    return lines.slice(0, TUTOR_LIMITS.lines)
  }
  // Synthetic division: the rows of her table as rows, then her answers, in reading order.
  if (instance.answer.type === 'polyDivision') {
    const { question, degree, c } = instance.answer
    return divisionWork(question, degree, c, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  // Zeros, end behavior, a polynomial from its zeros, rational root candidates: her boxes in reading order.
  if (instance.answer.type === 'polyZeros') {
    return zerosWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'rationalFns') {
    return rfWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'signCharts') {
    return scWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'complexNums') {
    return cxWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'logForms') {
    return logFormsWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'logProperties' || instance.answer.type === 'expLogEquations') {
    const lines = attempt.steps.map((step) => clip(step.text, TUTOR_LIMITS.line))
    const box = attempt.final?.polyEntries?.answer?.trim()
    if (box) lines.push(clip(box, TUTOR_LIMITS.line))
    return lines.slice(0, TUTOR_LIMITS.lines)
  }
  // Graphs and inverses, and growth and decay word problems: her boxes, part by part.
  if (instance.answer.type === 'expLogGraphs' || instance.answer.type === 'expModels') {
    return partsWork(instance.answer.stages, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  // Optimization: her boxes, part by part; the letter of her final equation decides which parts 4 and 5 were.
  if (instance.answer.type === 'optimization') {
    const a = instance.answer
    const entries = attempt.final?.polyEntries
    const route = entries?.final ? finalRoute(entries.final, a.quantity, a.domain) : null
    return optWork(optStagesFor(a, route), entries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  // Angles, right triangles and the unit circle: her boxes, part by part (a quadrant by its name).
  if (instance.answer.type === 'angleMeasure' || instance.answer.type === 'rightTriangle' || instance.answer.type === 'unitCircle' || instance.answer.type === 'sinusoids' || instance.answer.type === 'otherTrigGraphs' || instance.answer.type === 'inverseTrig') {
    return trigWork(instance.answer.stages, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'geometry') {
    return geoWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'periodic') {
    return ptWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
  }
  if (instance.answer.type === 'nomenclature') {
    return nmWork(instance.answer, attempt.final?.polyEntries)
      .slice(0, TUTOR_LIMITS.lines)
      .map((line) => clip(line, TUTOR_LIMITS.line))
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
  if (instance.answer.type === 'electrons' && instance.answer.question.kind === 'order' && final.ltOrder && final.ltOrder.length > 0) {
    const labels = new Map(instance.answer.question.items.map((item) => [item.id, item.label]))
    pushLine(lines, 'order', final.ltOrder.map((id) => labels.get(id) ?? id).join(' → '))
  }
  if (instance.answer.type === 'electrons' && instance.answer.question.kind === 'econfig') {
    pushLine(lines, 'answer', final.ecText)
    pushLine(lines, 'diagram', final.ecDiagram)
  }
  pushRecord(lines, final.gfEntries, GF_WORK)
  pushRecord(lines, final.fnEntries, FN_WORK)
  return lines.slice(0, TUTOR_LIMITS.lines)
}

/**
 * Every geometry question uses the same screen and the same tutor description.
 * A new question has to be listed here or this fails to compile.
 */
export function assertGeometryQuestion(question: GeometryQuestion): void {
  switch (question) {
    case 'addition':
    case 'midpoint':
    case 'coord':
    case 'angleAddition':
    case 'bisector':
    case 'pairs':
    case 'words':
    case 'related':
    case 'truth':
    case 'laws':
    case 'reason':
    case 'algebraic':
    case 'twocolumn':
    case 'transversalPairs':
    case 'parallelSolve':
    case 'parallelConverse':
    case 'lineSlopes':
    case 'triangleAngles':
    case 'polygonAngles':
    case 'congruentParts':
    case 'congruentWhich':
    case 'congruentSolve':
    case 'isoscelesSolve':
    case 'triangleProof':
    case 'parallelogramProps':
    case 'parallelogramProve':
    case 'parallelogramCoords':
    case 'specialQuadProps':
    case 'quadClassify':
    case 'midsegment':
    case 'trapezoidKite':
    case 'proportion':
    case 'similarPolygons':
    case 'similarProve':
    case 'similarSolve':
    case 'splitter':
    case 'angleBisector':
    case 'geometricMean':
    case 'rightAltitude':
    case 'pythagorean':
    case 'pythagoreanConverse':
    case 'pythagoreanWords':
    case 'specialRight':
      return
    default: {
      const unexpected: never = question
      throw new Error(`unknown geometry question ${String(unexpected)}`)
    }
  }
}

function statementOf(instance: ProblemInstance): string {
  const answer = instance.answer
  let text = instance.statementText
  if (answer.type === 'sigFigs' || answer.type === 'atoms' || answer.type === 'electrons') {
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
  } else if (answer.type === 'functionOps') {
    text = instance.statementText
  } else if (answer.type === 'quadratics' || answer.type === 'polyDivision') {
    text = `f(x) = ${answer.f}. ${answer.prompt}`
  } else if (answer.type === 'polyZeros') {
    // pz.build gives zeros and a point, not f: there f is the answer, and the statement text is the question.
    text = answer.form === 'hidden' ? `${instance.statementText} ${answer.prompt}` : `f(x) = ${answer.f}. ${answer.prompt}`
  } else if (answer.type === 'rationalFns') {
    text = answer.question === 'equation' ? `${answer.equation}. ${answer.prompt}` : `f(x) = ${answer.f}. ${answer.prompt}`
  } else if (answer.type === 'signCharts') {
    text = `${answer.inequality}. ${answer.prompt}`
  } else if (answer.type === 'complexNums') {
    text =
      answer.question === 'zeros'
        ? `f(x) = ${answer.f}. One zero is ${answer.givenZero}. ${answer.prompt}`
        : `${answer.expression}. ${answer.prompt}`
  } else if (answer.type === 'logForms') {
    text = `${answer.problem}. ${answer.prompt}`
  } else if (answer.type === 'logProperties') {
    text = `${answer.expr}. ${answer.prompt}`
  } else if (answer.type === 'expLogEquations') {
    text = `${answer.equation}. ${answer.prompt}`
  } else if (answer.type === 'expLogGraphs') {
    // A matching problem shows four graphs or four equations: the tutor gets each candidate's formula. In
    // equation mode she sees one graph and the four equations, not the function on its own.
    const candidates = answer.candidates?.length ? ` ${answer.matchMode === 'graph' ? 'Graphs' : 'Equations'}: ${answer.candidates.map((c) => `${c.letter}: ${answer.fnName}(x) = ${c.f}`).join('; ')}.` : ''
    text = answer.matchMode === 'equation' ? `${answer.prompt}${candidates}` : `${answer.fnName}(x) = ${answer.f}. ${answer.prompt}${candidates}`
  } else if (answer.type === 'expModels') {
    text = answer.prompt
  } else if (answer.type === 'angleMeasure' || answer.type === 'rightTriangle' || answer.type === 'unitCircle' || answer.type === 'sinusoids' || answer.type === 'otherTrigGraphs' || answer.type === 'inverseTrig') {
    // The prompt as words (its KaTeX read back), the given equation (Unit 5), and the figure, which the tutor cannot
    // see; four graphs to match are said by their formulas, as expLogGraphs' candidates are.
    const display = answer.display ? ` ${trigPlain(answer.display)}` : ''
    const figure = answer.figure.ariaLabel.trim() ? ` Figure: ${answer.figure.ariaLabel}` : ''
    const graphs = answer.figure.graphs?.length ? ` Graphs: ${answer.figure.graphs.map((g) => `${g.letter}: ${g.formula ?? 'a graph'}`).join('; ')}.` : ''
    text = `${trigPlain(answer.prompt)}${display}${figure}${graphs}`
  } else if (answer.type === 'optimization') {
    // The prompt as words, and the pens' figure when the problem has one.
    text = `${optPlain(answer.prompt)}${answer.figure ? ` Figure: ${answer.figure.ariaLabel}` : ''}`
  } else if (answer.type === 'geometry') {
    assertGeometryQuestion(answer.question)
    const lines = answer.lines?.length ? ` Lines: ${answer.lines.join(' | ')}` : ''
    // A problem stated in words alone (a list of facts) has no figure to describe.
    const figure = answer.figure.ariaLabel.trim() ? ` Figure: ${answer.figure.ariaLabel}` : ''
    text = `${answer.prompt}${lines}${figure}`
  } else if (answer.type === 'periodic' || answer.type === 'nomenclature') {
    text = answer.prompt
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
    answer.type === 'electrons' ||
    answer.type === 'graphFeatures' ||
    answer.type === 'domainRange' ||
    answer.type === 'composition' ||
    answer.type === 'functionOps' ||
    answer.type === 'transformations' ||
    answer.type === 'piecewiseRate' ||
    answer.type === 'quadratics' ||
    answer.type === 'polyDivision' ||
    answer.type === 'polyZeros' ||
    answer.type === 'rationalFns' ||
    answer.type === 'signCharts' ||
    answer.type === 'complexNums' ||
    answer.type === 'logForms' ||
    answer.type === 'logProperties' ||
    answer.type === 'expLogEquations' ||
    answer.type === 'expLogGraphs' ||
    answer.type === 'expModels' ||
    answer.type === 'geometry' ||
    answer.type === 'periodic' ||
    answer.type === 'nomenclature'
  ) {
    lines = answer.reveal
  } else if (answer.type === 'angleMeasure' || answer.type === 'rightTriangle' || answer.type === 'unitCircle' || answer.type === 'sinusoids' || answer.type === 'otherTrigGraphs' || answer.type === 'inverseTrig') {
    lines = answer.reveal.map(trigPlain)
  } else if (answer.type === 'optimization') {
    lines = answer.reveal.map(optPlain)
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
    case 'electrons':
    case 'quadratics':
    case 'polyDivision':
    case 'polyZeros':
    case 'rationalFns':
    case 'signCharts':
    case 'complexNums':
    case 'logForms':
    case 'logProperties':
    case 'expLogEquations':
    case 'expLogGraphs':
    case 'expModels':
    case 'angleMeasure':
    case 'rightTriangle':
    case 'unitCircle':
    case 'sinusoids':
    case 'otherTrigGraphs':
    case 'inverseTrig':
    case 'optimization':
    case 'geometry':
    case 'periodic':
    case 'nomenclature':
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
    case 'functionOps':
      text = answer.answerText
      break
    case 'transformations':
      if (answer.question === 'describe') text = answer.sentences.join('; ')
      else if (answer.question === 'point') text = answer.imagePoint ?? ''
      else text = answer.formula
      break
    case 'piecewiseRate':
      if (answer.question === 'evaluate') text = answer.valueText ?? ''
      else if (answer.question === 'rate') text = answer.rateText ?? ''
      else if (answer.question === 'graph') text = (answer.asks ?? []).map((a) => `f(${a.x}) = ${a.valueText}`).join(' | ')
      else if (answer.question === 'domain') text = [answer.domainText, answer.rangeText].filter(Boolean).join(' | ')
      else if (answer.question === 'continuous') text = answer.kText ?? ''
      else text = (answer.rows ?? []).map((r) => `${r.formula} for ${r.condition}`).join(' | ')
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

function subjectOf(moduleId: string): TutorContext['subject'] {
  if (!hasModule(moduleId)) return 'precalculus'
  const subject = getModule(moduleId).subject
  if (subject === 'Chemistry') return 'chemistry'
  if (subject === 'Geometry') return 'geometry'
  return 'precalculus'
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
  const subject = subjectOf(instance.moduleId)
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
