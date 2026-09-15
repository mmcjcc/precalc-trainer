/**
 * Chip sub-classification for same-side rewrites (error-patterns "Chip detector").
 * Find the minimal differing subtree pair (u, v) at the same path, then classify by shape.
 */
import type { ChipId } from '@/shared/types'
import { fnName, isNumberNode, isOp, isUnaryMinus, negateNode, nodeArgs, tryConst, type MathNode } from './math'
import { parseExpression, parseStatement, singleRelation } from './parse'

export type Confidence = 'high' | 'medium' | 'low'
export interface RewriteClass {
  chip: ChipId
  confidence: Confidence
}

function rec(node: MathNode): Record<string, unknown> {
  return node as unknown as Record<string, unknown>
}

function sameHead(a: MathNode, b: MathNode): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'OperatorNode') return rec(a).op === rec(b).op && nodeArgs(a).length === nodeArgs(b).length
  if (a.type === 'FunctionNode') return fnName(a) === fnName(b) && nodeArgs(a).length === nodeArgs(b).length
  return false
}

/** Descend while exactly one argument differs. */
export function minimalDiff(a: MathNode, b: MathNode): [MathNode, MathNode] {
  let u = a
  let v = b
  for (let guard = 0; guard < 64; guard++) {
    if (!sameHead(u, v)) return [u, v]
    const ua = nodeArgs(u)
    const va = nodeArgs(v)
    const diffs = ua.map((x, i) => (x.toString() === va[i]!.toString() ? -1 : i)).filter((i) => i >= 0)
    if (diffs.length !== 1) return [u, v]
    u = ua[diffs[0]!]!
    v = va[diffs[0]!]!
  }
  return [u, v]
}

/** Flatten a sum into signed terms (unary minus / binary minus become negated terms). */
export function additiveTerms(node: MathNode): MathNode[] {
  if (isOp(node, '+') && nodeArgs(node).length === 2) return nodeArgs(node).flatMap(additiveTerms)
  if (isOp(node, '-') && nodeArgs(node).length === 2) {
    const [x, y] = nodeArgs(node)
    return [...additiveTerms(x!), ...additiveTerms(y!).map(negTerm)]
  }
  return [node]
}

function negTerm(t: MathNode): MathNode {
  if (isUnaryMinus(t)) return nodeArgs(t)[0]!
  return negateNode(t)
}

/** Flatten a product into factors (sign stripped, divisions kept as one factor). */
export function multiplicativeFactors(node: MathNode): MathNode[] {
  if (isUnaryMinus(node)) return multiplicativeFactors(nodeArgs(node)[0]!)
  if (isOp(node, '*')) return nodeArgs(node).flatMap(multiplicativeFactors)
  return [node]
}

function isSum(node: MathNode): boolean {
  return additiveTerms(node).length >= 2
}

function hasSumFactor(node: MathNode): boolean {
  if (isUnaryMinus(node)) return isSum(nodeArgs(node)[0]!)
  if (isOp(node, '*')) return nodeArgs(node).some((f) => isSum(f) || (isUnaryMinus(f) && isSum(nodeArgs(f)[0]!)))
  if (isOp(node, '/')) {
    const [num] = nodeArgs(node)
    return num != null && isSum(num)
  }
  if (isOp(node, '^')) {
    const [base, exp] = nodeArgs(node)
    const e = exp ? tryConst(exp) : null
    return base != null && isSum(base) && e != null && Number.isInteger(e) && e >= 2
  }
  return false
}

function containsDivision(node: MathNode): boolean {
  if (isOp(node, '/')) return true
  if (isUnaryMinus(node) || isOp(node, '*') || isOp(node, '+') || isOp(node, '-')) {
    return nodeArgs(node).some(containsDivision)
  }
  return false
}

/** Sorted canonical strings of the non-numeric factors of a term ('' for a pure number). */
function variableKey(term: MathNode): string {
  const factors = multiplicativeFactors(term).filter((f) => !isNumberNode(f) && tryConst(f) == null)
  return factors
    .map((f) => f.toString())
    .sort()
    .join('*')
}

function multisetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((x, i) => x === sb[i])
}

export function classifyRewriteNodes(a: MathNode, b: MathNode): RewriteClass {
  if (a.toString() === b.toString()) return { chip: 'simplify', confidence: 'low' }
  const [u, v] = minimalDiff(a, b)
  const tu = additiveTerms(u)
  const tv = additiveTerms(v)

  if (hasSumFactor(u) && tv.length > tu.length) {
    return { chip: 'distribute', confidence: isOp(u, '^') ? 'medium' : 'high' }
  }
  if (hasSumFactor(v) && tu.length > tv.length) {
    return { chip: 'factor', confidence: isOp(v, '^') ? 'medium' : 'high' }
  }

  const su = tu.map((t) => t.toString())
  const sv = tv.map((t) => t.toString())
  if (tu.length >= 2 && tu.length === tv.length) {
    if (multisetEqual(su, sv)) {
      return su.every((s, i) => s === sv[i]) ? { chip: 'associative', confidence: 'medium' } : { chip: 'commutative', confidence: 'high' }
    }
  }
  const fu = multiplicativeFactors(u).map((f) => f.toString())
  const fv = multiplicativeFactors(v).map((f) => f.toString())
  if (fu.length >= 2 && fu.length === fv.length && multisetEqual(fu, fv)) {
    return fu.every((s, i) => s === fv[i]) ? { chip: 'associative', confidence: 'medium' } : { chip: 'commutative', confidence: 'high' }
  }

  if (tv.length < tu.length && tu.length >= 2) {
    const ku = tu.map(variableKey)
    const kv = tv.map(variableKey)
    const merged = ku.filter((k, i) => ku.indexOf(k) !== i)
    if (kv.every((k) => ku.includes(k)) && merged.length) {
      return merged.some((k) => k !== '') ? { chip: 'combine_like', confidence: 'high' } : { chip: 'simplify', confidence: 'high' }
    }
  }

  if (containsDivision(u) || containsDivision(v)) return { chip: 'rewrite_fraction', confidence: 'medium' }

  // pure arithmetic folding (2*3*x → 6x): same variable part, numbers changed
  if (tu.length === 1 && tv.length === 1 && variableKey(u) === variableKey(v)) {
    const nu = multiplicativeFactors(u).filter(isNumberNode).length
    const nv = multiplicativeFactors(v).filter(isNumberNode).length
    if (nu !== nv) return { chip: 'simplify', confidence: 'high' }
  }
  return { chip: 'simplify', confidence: 'low' }
}

/**
 * Public classifier. Accepts two expressions, or two single-relation lines (then the side that
 * changed is classified; if both sides changed the result is at most 'medium').
 */
export function classifyRewrite(prev: string, next: string, vars?: readonly string[]): RewriteClass {
  const pe = parseExpression(prev, vars)
  const ne = parseExpression(next, vars)
  if (pe.ok && ne.ok) return classifyRewriteNodes(pe.node, ne.node)
  const ps = parseStatement(prev, vars)
  const ns = parseStatement(next, vars)
  if (!ps.ok || !ns.ok) return { chip: 'simplify', confidence: 'low' }
  const pr = singleRelation(ps.statement)
  const nr = singleRelation(ns.statement)
  if (!pr || !nr) return { chip: 'simplify', confidence: 'low' }
  const leftChanged = pr.lhs.toString() !== nr.lhs.toString()
  const rightChanged = pr.rhs.toString() !== nr.rhs.toString()
  if (leftChanged && !rightChanged) return classifyRewriteNodes(pr.lhs, nr.lhs)
  if (rightChanged && !leftChanged) return classifyRewriteNodes(pr.rhs, nr.rhs)
  if (!leftChanged && !rightChanged) return { chip: 'simplify', confidence: 'low' }
  const l = classifyRewriteNodes(pr.lhs, nr.lhs)
  const r = classifyRewriteNodes(pr.rhs, nr.rhs)
  const pick = l.chip === r.chip ? l : l.confidence === 'high' ? l : r
  return { chip: pick.chip, confidence: pick.confidence === 'high' && l.chip === r.chip ? 'high' : 'medium' }
}
