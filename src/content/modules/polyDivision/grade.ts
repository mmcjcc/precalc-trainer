/**
 * Grading the synthetic-division table she fills in cell by cell, and reading her stored cells back.
 * The verdicts are the engine's (`gradeSyntheticTable`); this file only decides which cell an unreadable
 * table points at, and keeps the names of the stored boxes in one place.
 */
import type { AnswerSpec } from '@/content/types'
import { gradeBottomRow, gradeCoefficientRow, gradeIsFactor, gradeQuotient, gradeRemainder, gradeSyntheticTable, syntheticDivision } from '@/engine'
import type { PolyGrade } from '@/engine'

type DivisionAnswer = Extract<AnswerSpec, { type: 'polyDivision' }>
type DivisionStageId = DivisionAnswer['stages'][number]['id']

/** Keys of `AttemptFinal.polyEntries` for this module. Cells are numbered by column, from 0. */
export const SD_KEYS = {
  /** sd.table, part 1: the coefficient row as she typed it. */
  row: 'row',
  box: 'box',
  /** The product in column i (1 … degree): it sits under coefficient i. Column 0 has none. */
  product: (i: number) => `p${i}`,
  /** The bottom-row number in column i (0 … degree). */
  bottom: (i: number) => `b${i}`,
  quotient: 'quotient',
  remainder: 'remainder',
  /** sd.value and sd.factor, part 1: the bottom row typed as a list. */
  bottomRow: 'bottom',
  value: 'value',
  /** 'yes' or 'no'. */
  factor: 'factor',
} as const

export interface SdTableEntries {
  box: string
  /** One string per product cell, left to right (degree cells). */
  products: readonly string[]
  /** One string per bottom cell, left to right (degree + 1 cells). */
  bottom: readonly string[]
}

/** One cell of the table: the box, or a cell of the middle or bottom row by its index in that row. */
export type SdCell = { row: 'box' } | { row: 'products' | 'bottom'; index: number }

/** Her cells out of the stored entries, in the shape the engine grades. */
export function tableEntries(entries: Record<string, string>, degree: number): SdTableEntries {
  const products: string[] = []
  const bottom: string[] = []
  for (let i = 0; i <= degree; i++) {
    if (i > 0) products.push(entries[SD_KEYS.product(i)] ?? '')
    bottom.push(entries[SD_KEYS.bottom(i)] ?? '')
  }
  return { box: entries[SD_KEYS.box] ?? '', products, bottom }
}

/** The stored key of a cell. */
export function cellKey(cell: SdCell): string {
  if (cell.row === 'box') return SD_KEYS.box
  return cell.row === 'products' ? SD_KEYS.product(cell.index + 1) : SD_KEYS.bottom(cell.index)
}

/**
 * Grade her whole table: the box, the products row and the bottom row together, so the engine can tell
 * "−c in the box" from "subtracted each product".
 *
 * An empty or unreadable cell makes the check `invalid` (not an attempt) and `cell` says which one to
 * focus (null when the engine could not point at one). The engine stops at a wrong box before it reads the rows, so the rows are read once more
 * without the box: a table with a hole in it is not an attempt, whatever the box says.
 */
export function gradeDivisionTable(f: string, c: string, entries: SdTableEntries): { grade: PolyGrade; cell: SdCell | null } {
  const cellOf = (g: Extract<PolyGrade, { verdict: 'invalid' }>): SdCell | null => {
    if (g.index !== undefined) return gradeBottomRow(f, c, entries.bottom).verdict === 'invalid' ? { row: 'bottom', index: g.index } : { row: 'products', index: g.index }
    // No cell index: the box could not be read. The one other case is a number too large to check exactly
    // somewhere in the table, which the engine reports without a place; then no cell is singled out.
    const right = syntheticDivision(f, c)
    const boxAlone = right ? gradeSyntheticTable(f, c, { box: entries.box, bottom: right.rows.bottom }) : null
    return boxAlone?.verdict === 'invalid' ? { row: 'box' } : null
  }
  const full = gradeSyntheticTable(f, c, { box: entries.box, products: entries.products, bottom: entries.bottom })
  if (full.verdict === 'invalid') return { grade: full, cell: cellOf(full) }
  const rows = gradeSyntheticTable(f, c, { products: entries.products, bottom: entries.bottom })
  if (rows.verdict === 'invalid') return { grade: rows, cell: cellOf(rows) }
  return { grade: full, cell: null }
}

/** One graded part of a check, with the label its card carries when a check has several parts. */
export interface SdPart {
  label?: string
  grade: PolyGrade
}

/** The stored box a part of the problem starts at (where focus goes when that part opens). */
export const SD_FIRST_KEY: Record<DivisionStageId, string> = {
  row: SD_KEYS.row,
  grid: SD_KEYS.box,
  answers: SD_KEYS.quotient,
  bottom: SD_KEYS.bottomRow,
  value: SD_KEYS.value,
  factor: SD_KEYS.factor,
}

/**
 * One press of Check on one part of the problem: the engine's grade(s) for her stored boxes, and the key
 * of the box to focus when the check is not an attempt (empty or unreadable).
 */
export function gradeDivisionStage(answer: DivisionAnswer, stage: DivisionStageId, entries: Record<string, string>): { parts: SdPart[]; focus: string | null } {
  const { f, c } = answer
  const one = (grade: PolyGrade, key: string) => ({ parts: [{ grade }], focus: grade.verdict === 'invalid' ? key : null })
  switch (stage) {
    case 'row':
      return one(gradeCoefficientRow(f, entries[SD_KEYS.row] ?? ''), SD_KEYS.row)
    case 'grid': {
      const { grade, cell } = gradeDivisionTable(f, c, tableEntries(entries, answer.degree))
      // The engine's row messages say which row; a box message does not say it is about the box.
      return { parts: [cell?.row === 'box' ? { label: 'The box', grade } : { grade }], focus: cell ? cellKey(cell) : null }
    }
    case 'answers': {
      const quotient = gradeQuotient(f, c, entries[SD_KEYS.quotient] ?? '')
      // Trimmed: the engine reads "none" as 0, but not "none " with a space after it.
      const remainder = gradeRemainder(f, c, (entries[SD_KEYS.remainder] ?? '').trim())
      return {
        parts: [
          { label: 'Quotient', grade: quotient },
          { label: 'Remainder', grade: remainder },
        ],
        focus: quotient.verdict === 'invalid' ? SD_KEYS.quotient : remainder.verdict === 'invalid' ? SD_KEYS.remainder : null,
      }
    }
    case 'bottom':
      return one(gradeBottomRow(f, c, entries[SD_KEYS.bottomRow] ?? ''), SD_KEYS.bottomRow)
    case 'value':
      return one(gradeRemainder(f, c, (entries[SD_KEYS.value] ?? '').trim(), { ask: 'value' }), SD_KEYS.value)
    case 'factor':
      return one(gradeIsFactor(f, c, entries[SD_KEYS.factor] ?? ''), SD_KEYS.factor)
  }
}

const blank = (text: string | undefined) => (text?.trim() ? text.trim() : '_')

/**
 * Her work as lines for the tutor, in reading order: the rows of the table as rows (an empty cell is "_"),
 * not one line per cell. Boxes she has not touched are left out.
 */
export function divisionWork(question: 'table' | 'value' | 'factor', degree: number, c: string, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  const push = (label: string, text: string | undefined) => {
    if (text?.trim()) lines.push(`${label}: ${text.trim()}`)
  }
  if (question === 'table') {
    push('top row', entries[SD_KEYS.row])
    const t = tableEntries(entries, degree)
    push('box', t.box)
    if (t.products.some((v) => v.trim())) lines.push(`products row: ${t.products.map(blank).join(', ')}`)
    if (t.bottom.some((v) => v.trim())) lines.push(`bottom row: ${t.bottom.map(blank).join(', ')}`)
    push('quotient', entries[SD_KEYS.quotient])
    push('remainder', entries[SD_KEYS.remainder])
    return lines
  }
  push('bottom row', entries[SD_KEYS.bottomRow])
  if (question === 'value') push(`f(${c})`, entries[SD_KEYS.value])
  else push('factor', entries[SD_KEYS.factor])
  return lines
}
