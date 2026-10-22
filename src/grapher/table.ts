/**
 * The TI-84's TABLE for one row: x from a start, in steps (TblStart and ΔTbl), and the row's y at each, "undefined"
 * where the row is not defined (the TI-84 shows ERROR). Pure.
 */
import type { CurveFn } from './model'

export interface TableRow {
  x: number
  /** NaN where the row is undefined (or outside its restriction). */
  y: number
}

export const TABLE_LENGTH = 11

/** start + i·step without the float noise of repeated addition (0.1 + 0.2). */
export function tableX(start: number, step: number, i: number): number {
  const x = start + i * step
  return x === 0 ? 0 : Number(x.toPrecision(12))
}

export function tableRows(fn: CurveFn, start: number, step: number, count = TABLE_LENGTH): TableRow[] {
  const rows: TableRow[] = []
  if (!Number.isFinite(start) || !Number.isFinite(step) || step === 0) return rows
  for (let i = 0; i < count; i++) {
    const x = tableX(start, step, i)
    const y = fn.allow && !fn.allow(x) ? Number.NaN : fn.f(x)
    rows.push({ x, y: Number.isFinite(y) ? y : Number.NaN })
  }
  return rows
}
