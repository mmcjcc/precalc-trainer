import type { Rational, RelOp, SolutionSet, VarName } from '@/shared/types'
import { rat, setFromPieces, setToInterval, setToSetBuilder } from '@/notation'

function toRat(k: number | Rational): Rational {
  return typeof k === 'number' ? rat(k) : k
}

/** The ray (or point) `x ⋈ k` as an exact set. Accepts an integer or an exact rational. */
export function rayFor(op: RelOp, k: number | Rational): SolutionSet {
  const p = toRat(k)
  switch (op) {
    case '<=':
      return setFromPieces([{ lo: '-inf', hi: p, loClosed: false, hiClosed: true }])
    case '<':
      return setFromPieces([{ lo: '-inf', hi: p, loClosed: false, hiClosed: false }])
    case '>=':
      return setFromPieces([{ lo: p, hi: 'inf', loClosed: true, hiClosed: false }])
    case '>':
      return setFromPieces([{ lo: p, hi: 'inf', loClosed: false, hiClosed: false }])
    default:
      return setFromPieces([], [p])
  }
}

/** The bounded piece `lo ⋈ x ⋈ hi` (ops are the two symbols of the chain, both < or <=). */
export function segmentFor(
  lo: number | Rational,
  loOp: RelOp,
  hi: number | Rational,
  hiOp: RelOp,
): SolutionSet {
  return setFromPieces([
    { lo: toRat(lo), hi: toRat(hi), loClosed: loOp === '<=', hiClosed: hiOp === '<=' },
  ])
}

/**
 * The predicate inside the canonical set-builder string, in app syntax:
 * "x < -2 or 1 <= x < 4 or x = 6". Parses with the engine and with `setFromRelation`.
 */
export function setPredicate(set: SolutionSet, variable: VarName = 'x'): string {
  const builder = setToSetBuilder(set, variable)
  const m = /^\{\s*[a-z]\s*[|:∣]\s*(.*)\}$/.exec(builder)
  return m ? m[1]!.trim() : builder
}

export function setAnswer(set: SolutionSet, variable: VarName = 'x') {
  return {
    type: 'set' as const,
    set,
    interval: setToInterval(set),
    setBuilder: setToSetBuilder(set, variable),
    requireInterval: true,
    requireSetBuilder: true,
  }
}
