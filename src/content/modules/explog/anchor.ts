/**
 * Progress for a line-by-line log problem. The anchor is the latest canonical line that is the
 * same line as hers (`sameLogLine`), not a count of how many lines she has typed.
 */
import type { CanonicalStep, ProblemInstance, ProgressInfo } from '@/content/types'
import { parseStatement, sameLogLine } from '@/engine'
import type { VarName } from '@/shared/types'

export function logLines(instance: ProblemInstance): string[] {
  return [instance.start ?? '', ...instance.canonical.map((step) => step.text)].filter((line) => line.length > 0)
}

/**
 * `sameLogLine` reads equations. An expand/condense line is an expression, so it is set on the
 * right of a fresh letter (`h = …`) and then compared. Two writings of one sum match; the original
 * log and its expansion do not, so the anchor does not skip ahead.
 */
function asComparable(text: string, vars: readonly VarName[]): { text: string; vars: VarName[] } {
  const own = (vars.length ? [...vars] : ['x']) as VarName[]
  if (parseStatement(text, own).ok) return { text, vars: own }
  const carrier = (['h', 'n', 'y', 'x'] as const).find((v) => !own.includes(v))
  if (!carrier) return { text, vars: own }
  return { text: `${carrier} = (${text})`, vars: [...own, carrier] }
}

export function logSame(a: string, b: string, vars: readonly VarName[]): boolean {
  const left = asComparable(a, vars)
  const right = asComparable(b, vars)
  const all = [...new Set([...left.vars, ...right.vars])]
  return sameLogLine(left.text, right.text, all)
}

/** Index into the full line list (start is 0). A blank current line is the start. */
export function logAnchor(instance: ProblemInstance, currentLine: string | null): number {
  const lines = logLines(instance)
  if (!currentLine || !lines.length) return 0
  let anchor = 0
  const vars = instance.vars.length ? instance.vars : (['x'] as VarName[])
  for (let i = 0; i < lines.length; i++) {
    if (logSame(currentLine, lines[i]!, vars)) anchor = i
  }
  return anchor
}

export function logProgress(instance: ProblemInstance, currentLine: string | null, label: string): ProgressInfo {
  const total = Math.max(1, instance.canonical.length)
  const anchor = logAnchor(instance, currentLine)
  const done = anchor >= instance.canonical.length && instance.canonical.length > 0
  return {
    stage: done ? total : anchor,
    total,
    label: done ? 'finished form' : anchor === 0 ? label : `${anchor} ${anchor === 1 ? 'line' : 'lines'} matched`,
    anchorIndex: anchor === 0 ? -1 : anchor - 1,
    path: anchor === 0 ? 'none' : 'canonical',
  }
}

export function logNextStep(instance: ProblemInstance, currentLine: string | null): CanonicalStep | null {
  const anchor = logAnchor(instance, currentLine)
  return instance.canonical[anchor] ?? null
}
