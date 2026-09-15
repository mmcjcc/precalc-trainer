/**
 * LEGACY 2-argument API (`verifyStep(oldLine, newLine)` → `VerifyResult`), kept because the
 * first-spike UI (`components/Workspace.tsx`, `pages/Sandbox.tsx`) and `content/modules/progress.ts`
 * still call it. It delegates to the new engine (`step.ts`) with a permissive context
 * (all variables, swap allowed). New code must use `verifyStep(prev, next, ctx)` from `@/engine`.
 */
import type { StepResult } from '@/shared/types'
import { parseStatement } from './parse'
import { DEFAULT_SEED } from './samples'
import { verifyStatements as verifyStatementsCtx } from './step'
import type { Statement, VerifyResult } from './types'

const LEGACY_CTX = { vars: ['x', 'y', 'n'] as ('x' | 'y' | 'n')[], seed: DEFAULT_SEED, allowSwap: true }

function toLegacy(r: StepResult, newS: Statement): VerifyResult {
  if (r.ok) {
    const out: VerifyResult = {
      ok: true,
      kind: r.verdict === 'equivalent_by_rename' ? 'swapVars' : r.caveat ? 'implies' : 'equivalent',
      statement: newS,
    }
    if (r.detected) out.property = r.detected.chip
    if (r.caveat && r.pattern) out.caveat = r.pattern.witness ?? r.pattern.lesson
    return out
  }
  if (r.verdict === 'parse_error') {
    return { ok: false, kind: 'parse-error', error: r.parseError ?? { message: 'Could not read that line.', position: 0 } }
  }
  const out: VerifyResult = { ok: false, kind: 'rejected' }
  if (r.pattern) out.pattern = r.pattern
  if (r.counterexample) {
    out.counterexample = {
      scope: { ...r.counterexample.point } as Record<string, number>,
      oldHolds: r.counterexample.oldTruth === true,
      newHolds: r.counterexample.newTruth === true,
      nice: r.counterexample.pointDisplay,
    }
  }
  return out
}

/** @deprecated use `verifyStep(prev, next, ctx)` from `@/engine`. */
export function verifyStatements(oldS: Statement, newS: Statement): VerifyResult {
  return toLegacy(verifyStatementsCtx(oldS, newS, LEGACY_CTX), newS)
}

/** @deprecated use `verifyStep(prev, next, ctx)` from `@/engine`. */
export function verifyStep(oldLine: string, newLine: string): VerifyResult {
  const oldP = parseStatement(oldLine)
  if (!oldP.ok) return { ok: false, kind: 'parse-error', error: oldP.error }
  const newP = parseStatement(newLine)
  if (!newP.ok) return { ok: false, kind: 'parse-error', error: newP.error }
  return verifyStatements(oldP.statement, newP.statement)
}
