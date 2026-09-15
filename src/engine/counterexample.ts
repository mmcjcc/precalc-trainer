/**
 * Counterexample selection and message templates (engine-design §8, §12).
 * Rank mismatch points: integers → fractions with denominator ≤ 6 → smallest |v|; snap the
 * displayed values; always show both sides' numeric values.
 */
import type { Counterexample, RelOp, Truth } from '@/shared/types'
import { evalNode } from './math'
import type { Mismatch } from './roots'
import type { SliceMismatch } from './slicing'
import { evalRelation, nicenessRank, prettyNumber, snapNumber, statementHolds, statementHoldsNear, type Scope } from './samples'
import type { Relation, Statement } from './types'

export type Values = { L: number | 'undef'; R: number | 'undef' }

const OP_TEXT: Record<RelOp, string> = { '=': '=', '<': '<', '<=': '≤', '>': '>', '>=': '≥' }

function rankPoint(scope: Scope, vars: readonly string[]): [number, number] {
  let rank = 0
  let mag = 0
  for (const v of vars) {
    const x = scope[v]
    if (x == null) continue
    rank += nicenessRank(x)
    mag += Math.abs(x)
  }
  return [rank, mag]
}

/** The nicest mismatch: integers first, then simple fractions, then smallest magnitude. */
export function pickNicest<M extends Mismatch>(mismatches: M[], vars: readonly string[]): M | undefined {
  let best: M | undefined
  let bestKey: [number, number] = [Infinity, Infinity]
  for (const m of mismatches) {
    const key = rankPoint(m.scope, vars)
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = m
      bestKey = key
    }
  }
  return best
}

export function pointDisplay(scope: Scope, vars: readonly string[]): string {
  const order = [...vars].sort()
  return order
    .filter((v) => scope[v] != null)
    .map((v) => `${v} = ${prettyNumber(snapNumber(scope[v]!))}`)
    .join(', ')
}

function snappedScope(scope: Scope): Scope {
  const out: Scope = {}
  for (const [k, v] of Object.entries(scope)) out[k] = snapNumber(v)
  return out
}

/** Relation used for the displayed values: the first one that holds at the point, else the first. */
function representative(stmt: Statement, scope: Scope): Relation | null {
  let first: Relation | null = null
  for (const clause of stmt.disjuncts) {
    for (const rel of clause) {
      first ??= rel
      if (evalRelation(rel, scope) === true) return rel
    }
  }
  return first
}

export function sideValues(stmt: Statement, scope: Scope): { rel: Relation | null; values: Values } {
  const rel = representative(stmt, scope)
  if (!rel) return { rel: null, values: { L: 'undef', R: 'undef' } }
  return { rel, values: { L: evalNode(rel.lhs, scope), R: evalNode(rel.rhs, scope) } }
}

function fmt(v: number | 'undef'): string {
  return v === 'undef' ? 'undefined' : prettyNumber(v)
}

function truthWord(t: Truth): string {
  return t === 'undef' ? 'UNDEFINED' : t ? 'TRUE' : 'FALSE'
}

function relationText(rel: Relation | null, values: Values, truth: Truth): string {
  if (!rel) return truthWord(truth)
  const op = OP_TEXT[rel.op]
  return `${fmt(values.L)} ${op} ${fmt(values.R)} → ${truthWord(truth)}`
}

export type CounterexampleKind = 'equation' | 'inequality' | 'twoVar'

/** Truth at a displayed point, with the same root tolerance Tier 2 decided with. */
function truthAt(stmt: Statement, scope: Scope, v: string | undefined): Truth {
  return v ? statementHoldsNear(stmt, scope, v) : statementHolds(stmt, scope)
}

function freeVarOf(m: Mismatch | SliceMismatch, vars: readonly string[]): string | undefined {
  return 'freeVar' in m ? m.freeVar : vars[0]
}

/** The mismatch is still a mismatch at the rounded point we would show. */
export function survivesSnap(oldS: Statement, newS: Statement, m: Mismatch | SliceMismatch, vars: readonly string[]): boolean {
  const scope = snappedScope(m.scope)
  const v = freeVarOf(m, vars)
  return (truthAt(oldS, scope, v) === true) !== (truthAt(newS, scope, v) === true)
}

/** Builds the student-facing counterexample for a relation-mode rejection. */
export function buildCounterexample(
  oldS: Statement,
  newS: Statement,
  m: Mismatch | SliceMismatch,
  vars: readonly string[],
  kind: CounterexampleKind,
): Counterexample {
  // Show the rounded point only if it still separates the lines; the TRUE/FALSE words are
  // re-checked there, so a displayed "2 = 2" is never labelled FALSE.
  const snapped = snappedScope(m.scope)
  const v = freeVarOf(m, vars)
  const so = truthAt(oldS, snapped, v)
  const sn = truthAt(newS, snapped, v)
  const keepSnap = (so === true) !== (sn === true)
  const scope = keepSnap ? snapped : m.scope
  const oldTruth = keepSnap ? so : m.old
  const newTruth = keepSnap ? sn : m.new
  const o = sideValues(oldS, scope)
  const n = sideValues(newS, scope)
  const where = pointDisplay(scope, vars)
  const both = `Original: ${relationText(o.rel, o.values, oldTruth)}. Yours: ${relationText(n.rel, n.values, newTruth)}.`
  let message: string
  if (kind === 'twoVar' && 'fixedVar' in m) {
    const fv = m.fixedVar
    const free = m.freeVar
    const fixedText = `${fv} = ${prettyNumber(snapNumber(scope[fv]!))}`
    const oldNeeds = m.oldRoots.length
      ? `needs ${free} = ${m.oldRoots.map((r) => prettyNumber(snapNumber(r))).join(' or ')}`
      : `has no ${free} that works`
    const newNeeds = m.newRoots.length
      ? `needs ${free} = ${m.newRoots.map((r) => prettyNumber(snapNumber(r))).join(' or ')}`
      : `has no ${free} that works`
    if (!m.oldRoots.length && !m.newRoots.length) {
      message = `At ${where} the original is ${truthWord(oldTruth)} but your line is ${truthWord(newTruth)}, so they are not the same statement. ${both}`
    } else if (oldTruth === true && newTruth !== true) {
      message = `At ${fixedText} the original ${oldNeeds}, but your line ${newNeeds}. Check ${where}: ${both}`
    } else if (oldTruth === 'undef') {
      message = `At ${where} your line is TRUE, but the original is UNDEFINED there. ${both}`
    } else {
      message = `At ${fixedText} your line ${newNeeds}, but the original ${oldNeeds}. Check ${where}: ${both}`
    }
  } else if (kind === 'inequality') {
    message = `At ${where} the original is ${truthWord(oldTruth)} but your line is ${truthWord(newTruth)}. ${both}`
  } else if (oldTruth === true && newTruth !== true) {
    message = `${where} solves the original but not your line. ${both}`
  } else if (oldTruth === 'undef') {
    message = `${where} satisfies your line, but the original is UNDEFINED at ${where}. ${both}`
  } else {
    message = `${where} satisfies your line, but the original is FALSE there. ${both}`
  }
  return {
    point: scope,
    pointDisplay: where,
    oldTruth,
    newTruth,
    oldValues: o.values,
    newValues: n.values,
    message,
  }
}

/** Counterexample for expression mode: the two expressions differ at a point. */
export function expressionCounterexample(
  scope: Scope,
  a: number | 'undef',
  b: number | 'undef',
  vars: readonly string[],
): Counterexample {
  const snapped = snappedScope(scope)
  const where = pointDisplay(snapped, vars)
  const message =
    a === 'undef'
      ? `At ${where} the original expression is undefined, but yours gives ${fmt(b)}.`
      : b === 'undef'
        ? `At ${where} the original expression gives ${fmt(a)}, but yours is undefined.`
        : `At ${where} the original expression gives ${fmt(a)}, but yours gives ${fmt(b)}.`
  return {
    point: snapped,
    pointDisplay: where,
    oldTruth: true,
    newTruth: false,
    message,
  }
}
