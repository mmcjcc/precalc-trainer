/**
 * Grading one part of a zeros problem from her stored boxes, and reading those boxes back. The verdicts are
 * the engine's. This file only keeps the names of the stored boxes in one place, decides which box an
 * unreadable answer points at, and says "type something first" itself: the engine's own notice for an empty
 * list gives a fixed example ("like +-1, +-3, +-1/2") that can be most of the answer.
 */
import type { AnswerSpec } from '@/content/types'
import { gradeCrossTouch, gradeEndBehavior, gradePolynomialFromZeros, gradeRationalZeros, gradeRootCandidates, gradeZeros } from '@/engine'
import type { PolyGrade, ZeroAnswer, ZerosSpec } from '@/engine'

type ZerosAnswer = Extract<AnswerSpec, { type: 'polyZeros' }>
type ZerosStageId = ZerosAnswer['stages'][number]['id']

/** Keys of `AttemptFinal.polyEntries` for this module. Rows and zeros are numbered from 0. */
export const PZ_KEYS = {
  /** pz.zeros, part 1: how many rows her table has (she adds them herself), as text. */
  rows: 'rows',
  /** The zero in row i. */
  zero: (i: number) => `z${i}`,
  /** The multiplicity in row i. */
  mult: (i: number) => `m${i}`,
  /** pz.zeros, part 2: 'crosses' or 'touches' at the i-th zero, in the engine's (ascending) order. */
  cross: (i: number) => `c${i}`,
  /** pz.end: 'up' or 'down'. */
  left: 'left',
  right: 'right',
  /** pz.build: her formula. */
  formula: 'formula',
  /** pz.rational, part 1: the list of candidates. */
  candidates: 'candidates',
  /** pz.rational, part 2: the candidates that are zeros, or "none". */
  rational: 'rational',
} as const

/** The table never grows past this. More than any problem needs, so the limit says nothing about the answer. */
export const PZ_MAX_ROWS = 8

/** How many rows her zeros table has (at least one). */
export function zeroRowCount(entries: Record<string, string>): number {
  const n = Number.parseInt(entries[PZ_KEYS.rows] ?? '', 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), PZ_MAX_ROWS) : 1
}

/** Her zeros table out of the stored entries, one row per row on screen (blank rows included). */
export function zeroRows(entries: Record<string, string>): { zero: string; mult: string }[] {
  const rows: { zero: string; mult: string }[] = []
  for (let i = 0; i < zeroRowCount(entries); i++) rows.push({ zero: entries[PZ_KEYS.zero(i)] ?? '', mult: entries[PZ_KEYS.mult(i)] ?? '' })
  return rows
}

/** The entries with row `index` taken out and the rows below it moved up. */
export function removeZeroRow(entries: Record<string, string>, index: number): Record<string, string> {
  const rows = zeroRows(entries).filter((_, i) => i !== index)
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(entries)) if (!/^[zm]\d+$/.test(key)) next[key] = value
  rows.forEach((row, i) => {
    if (row.zero) next[PZ_KEYS.zero(i)] = row.zero
    if (row.mult) next[PZ_KEYS.mult(i)] = row.mult
  })
  next[PZ_KEYS.rows] = String(Math.max(rows.length, 1))
  return next
}

/** The zeros and the point of a pz.build problem in the shape the engine grades against. */
export function zerosSpec(answer: Pick<ZerosAnswer, 'zeros' | 'point'>): ZerosSpec {
  return { zeros: answer.zeros.map((z) => ({ zero: z.text, mult: z.mult })), ...(answer.point ? { point: answer.point } : {}) }
}

/** One graded part of a check, with the label its card carries when a check has several parts. */
export interface PzPart {
  label?: string
  grade: PolyGrade
}

/** The stored box a part of the problem starts at (where focus goes when that part opens). */
export const PZ_FIRST_KEY: Record<ZerosStageId, string> = {
  zeros: PZ_KEYS.zero(0),
  cross: PZ_KEYS.cross(0),
  end: PZ_KEYS.left,
  formula: PZ_KEYS.formula,
  candidates: PZ_KEYS.candidates,
  rational: PZ_KEYS.rational,
}

const notYet = (message: string): PolyGrade => ({ verdict: 'invalid', reason: 'unreadable', message })

const blank = (text: string | undefined) => !text?.trim()

/** Her zeros table: the engine's verdict, and the box to focus when the table is not an attempt yet. */
function gradeZeroTable(f: string, entries: Record<string, string>): { grade: PolyGrade; focus: string | null } {
  const rows = zeroRows(entries)
  if (rows.every((r) => blank(r.zero) && blank(r.mult))) return { grade: notYet('Type a zero in the first row, with its multiplicity.'), focus: PZ_KEYS.zero(0) }
  // The engine grades the zeros alone when no row has a multiplicity. This question asks for both.
  const bare = rows.findIndex((r) => !blank(r.zero) && blank(r.mult))
  if (bare >= 0) return { grade: notYet(`Zero ${bare + 1} needs its multiplicity: a positive whole number.`), focus: PZ_KEYS.mult(bare) }
  const answer: ZeroAnswer[] = rows.map((r) => ({ zero: r.zero, mult: r.mult }))
  const grade = gradeZeros(f, answer)
  if (grade.verdict !== 'invalid') return { grade, focus: null }
  const i = grade.index
  if (i === undefined) return { grade, focus: PZ_KEYS.zero(0) }
  if (blank(rows[i]?.zero)) return { grade, focus: PZ_KEYS.zero(i) }
  // Which box of the row is it? With every multiplicity set to 1 only the zeros can still be unreadable.
  const zerosOnly = gradeZeros(f, rows.map((r) => (blank(r.zero) && blank(r.mult) ? { zero: '', mult: '' } : { zero: r.zero, mult: '1' })))
  return { grade, focus: zerosOnly.verdict === 'invalid' ? PZ_KEYS.zero(i) : PZ_KEYS.mult(i) }
}

/**
 * One press of Check on one part of the problem: the engine's grade for her stored boxes, and the key of
 * the box to focus when the check is not an attempt (empty or unreadable).
 */
export function gradeZerosStage(answer: ZerosAnswer, stage: ZerosStageId, entries: Record<string, string>): { parts: PzPart[]; focus: string | null } {
  const f = answer.f
  const one = (grade: PolyGrade, key: string | null) => ({ parts: [{ grade }], focus: grade.verdict === 'invalid' ? key : null })
  switch (stage) {
    case 'zeros': {
      const { grade, focus } = gradeZeroTable(f, entries)
      return { parts: [{ grade }], focus }
    }
    case 'cross': {
      const grade = gradeCrossTouch(f, answer.zeros.map((_, i) => entries[PZ_KEYS.cross(i)] ?? ''))
      return one(grade, grade.verdict === 'invalid' ? PZ_KEYS.cross(grade.index ?? 0) : null)
    }
    case 'end': {
      const grade = gradeEndBehavior(f, { left: entries[PZ_KEYS.left] ?? '', right: entries[PZ_KEYS.right] ?? '' })
      return one(grade, grade.verdict === 'invalid' && grade.index === 1 ? PZ_KEYS.right : PZ_KEYS.left)
    }
    case 'formula':
      return one(gradePolynomialFromZeros(zerosSpec(answer), entries[PZ_KEYS.formula] ?? ''), PZ_KEYS.formula)
    case 'candidates': {
      const text = entries[PZ_KEYS.candidates] ?? ''
      return one(blank(text) ? notYet('Type your list first, with commas between the numbers.') : gradeRootCandidates(f, text), PZ_KEYS.candidates)
    }
    case 'rational': {
      const text = entries[PZ_KEYS.rational] ?? ''
      return one(blank(text) ? notYet('Type the zeros you found, with commas between them, or type none.') : gradeRationalZeros(f, text.trim()), PZ_KEYS.rational)
    }
  }
}

/**
 * Her work as lines for the tutor, in reading order. The zeros table is one line per row she filled in;
 * boxes she has not touched are left out.
 */
export function zerosWork(answer: ZerosAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  const push = (label: string, text: string | undefined) => {
    if (text?.trim()) lines.push(`${label}: ${text.trim()}`)
  }
  switch (answer.question) {
    case 'zeros':
      zeroRows(entries).forEach((row, i) => {
        if (blank(row.zero) && blank(row.mult)) return
        lines.push(`zero ${i + 1}: ${blank(row.zero) ? '_' : row.zero.trim()}, multiplicity ${blank(row.mult) ? '_' : row.mult.trim()}`)
      })
      answer.zeros.forEach((z, i) => push(`at x = ${z.text}`, entries[PZ_KEYS.cross(i)]))
      break
    case 'end':
      push('left end', entries[PZ_KEYS.left])
      push('right end', entries[PZ_KEYS.right])
      break
    case 'build':
      push('formula', entries[PZ_KEYS.formula])
      break
    case 'rational':
      push('possible rational zeros', entries[PZ_KEYS.candidates])
      push('rational zeros', entries[PZ_KEYS.rational])
      break
  }
  return lines
}
