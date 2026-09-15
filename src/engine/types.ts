/**
 * Engine-internal statement model plus LEGACY result shapes.
 *
 * The public contracts live in `@/shared/types` (StepResult, Verdict, ChipId, ErrorPatternId, ...).
 * The legacy `VerifyResult` / `CHIPS` / `PatternId` exports below are kept only so the first-spike
 * UI (`components/Workspace.tsx`, `pages/Sandbox.tsx`, `store.ts`) and the homework fixture keep
 * compiling until the registry-driven app replaces them. New code must use `@/engine` (index.ts).
 */
import type { MathNode } from 'mathjs'
import { ALL_CHIPS, CHIP_LABEL } from '@/shared/types'
import type {
  ChipId as SharedChipId,
  ErrorPatternId,
  ParseError as SharedParseError,
  PatternHit as SharedPatternHit,
  RelOp as SharedRelOp,
} from '@/shared/types'

/** Legacy: includes `!=` for the notation printer's lookup table. The parser never produces it. */
export type RelOp = SharedRelOp | '!='

/**
 * Chip ids are the shared contract. The legacy hyphenated spellings are tolerated in the TYPE only
 * because the demo list `src/content/problems.ts` (scheduled for deletion) still stores them; the
 * engine never emits them.
 */
export type ChipId =
  | SharedChipId
  | 'add-sub'
  | 'mul-div'
  | 'combine'
  | 'power'
  | 'root'
  | 'rewrite-fraction'
  | 'swap-sides'
  | 'swap-vars'

/** Error-pattern ids are the shared contract (`ErrorPatternId`). */
export type PatternId = ErrorPatternId

export type Relation = {
  lhs: MathNode
  rhs: MathNode
  op: SharedRelOp
  lhsSrc: string
  rhsSrc: string
}

/** OR of ANDs of relations. */
export type Statement = {
  disjuncts: Relation[][]
  source: string
  vars: string[]
}

export type ParseError = SharedParseError & { hint?: string }

export type ParseSuccess = { ok: true; statement: Statement }
export type ParseFailure = { ok: false; error: ParseError }
export type ParseResult = ParseSuccess | ParseFailure

export type StepKind = 'equivalent' | 'implies' | 'swapVars' | 'rejected'

/** Same shape as the shared `PatternHit` (catalog entry + optional concrete witness). */
export type PatternHit = SharedPatternHit

export type Counterexample = {
  scope: Record<string, number>
  oldHolds: boolean
  newHolds: boolean
  nice: string
}

export type VerifyOk = {
  ok: true
  kind: Exclude<StepKind, 'rejected'>
  property?: ChipId
  statement: Statement
  caveat?: string
}

export type VerifyFail = {
  ok: false
  kind: 'rejected' | 'parse-error'
  error?: ParseError
  pattern?: PatternHit
  counterexample?: Counterexample
}

/** @deprecated use `StepResult` from `@/shared/types` via `@/engine`. */
export type VerifyResult = VerifyOk | VerifyFail

/** @deprecated use `CHIP_LABEL` / `ALL_CHIPS` from `@/shared/types`. */
export const CHIPS: { id: SharedChipId; label: string }[] = ALL_CHIPS.map((id) => ({ id, label: CHIP_LABEL[id] }))

export function flipOp(op: SharedRelOp): SharedRelOp {
  switch (op) {
    case '<':
      return '>'
    case '>':
      return '<'
    case '<=':
      return '>='
    case '>=':
      return '<='
    default:
      return op
  }
}

export function isInequality(op: SharedRelOp | '!='): boolean {
  return op === '<' || op === '<=' || op === '>' || op === '>='
}

export function isStrict(op: SharedRelOp): boolean {
  return op === '<' || op === '>'
}
