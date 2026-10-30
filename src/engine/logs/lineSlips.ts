/**
 * What each named mistake turns a line into, as lines she could have written: the relation slips of relslips.ts
 * (the ones `checkLogStep` matches her line against), in app syntax. For screens that show a mistake as a choice
 * next to the right line (Guided mode's cards). Additive: nothing here grades, and the checker is unchanged.
 */
import type { VarName } from '@/shared/types'
import { parseExpression, parseStatement, singleRelation } from '../parse'
import { relationSlips } from './relslips'
import { expressionSlips } from './slips'
import { appText } from './text'
import type { LogMistakeId } from './types'

export interface LogLineSlip {
  /** The named mistake. */
  id: LogMistakeId
  /** The line it gives, app syntax ("x = log(3)/log(13)"); the parser reads it back. */
  text: string
}

/**
 * Every slip of a one-relation line, in the checker's priority order (when two slips give the same line, the
 * earlier one names it), each line once. A line that does not parse, or is not a single relation ("x = 2 or
 * x = 3"), has none.
 */
export function logLineSlips(line: string, vars: readonly VarName[] = ['x']): LogLineSlip[] {
  const parsed = parseStatement(line, vars)
  if (!parsed.ok) return []
  const r = singleRelation(parsed.statement)
  if (!r) return []
  const out: LogLineSlip[] = []
  const seen = new Set<string>()
  for (const slip of relationSlips(r)) {
    const text = slip.stmt.source
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push({ id: slip.id, text })
  }
  return out
}

/**
 * Every slip of an expand/condense expression, in the checker's priority order, each line once. A line
 * that does not parse as an expression has none. Additive: nothing here grades.
 */
export function logRewriteSlips(line: string, vars: readonly VarName[] = ['x', 'y']): LogLineSlip[] {
  const parsed = parseExpression(line, vars)
  if (!parsed.ok) return []
  const out: LogLineSlip[] = []
  const seen = new Set<string>()
  for (const slip of expressionSlips(parsed.node)) {
    const text = appText(slip.node)
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push({ id: slip.id, text })
  }
  return out
}
