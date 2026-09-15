import { evalNode, type MathNode } from './math'
import {
  constantOnSamples,
  exprEquivalent,
  gValue,
  primaryVar,
  samplesFor,
  statementHolds,
} from './samples'
import { truthEquivalent1D } from './roots'
import { flipOp, isInequality, type Relation, type Statement } from './types'

function symbolName(node: MathNode): string | null {
  if (node.type !== 'SymbolNode' || !('name' in node)) return null
  return (node as { name: string }).name
}

/** When both lines isolate the same variable, compare the other side as an expression. */
export function isolatedEquivalent(oldR: Relation, newR: Relation, vars: string[]): boolean | null {
  if (oldR.op !== newR.op) return null
  const leftO = symbolName(oldR.lhs)
  const leftN = symbolName(newR.lhs)
  if (leftO && leftO === leftN) {
    return exprEquivalent(oldR.rhs, newR.rhs, vars.filter((v) => v !== leftO))
  }
  const rightO = symbolName(oldR.rhs)
  const rightN = symbolName(newR.rhs)
  if (rightO && rightO === rightN) {
    return exprEquivalent(oldR.lhs, newR.lhs, vars.filter((v) => v !== rightO))
  }
  return null
}

export function singleRel(stmt: Statement): Relation | null {
  return stmt.disjuncts.length === 1 && stmt.disjuncts[0]!.length === 1
    ? stmt.disjuncts[0]![0]!
    : null
}

export function statementsEquivalent(oldS: Statement, newS: Statement): boolean {
  const vars = [...new Set([...oldS.vars, ...newS.vars])]
  const o = singleRel(oldS)
  const n = singleRel(newS)
  if (o && n) {
    const isolated = isolatedEquivalent(o, n, vars)
    if (isolated != null) return isolated
  }
  if (vars.length <= 1) {
    const v = primaryVar({ ...oldS, vars: vars.length ? vars : ['x'] })
    return truthEquivalent1D(oldS, newS, v)
  }
  const samples = samplesFor(vars)
  let compared = 0
  let oldTrue = 0
  let newTrue = 0
  for (const s of samples) {
    const o = statementHolds(oldS, s)
    const n = statementHolds(newS, s)
    if (o === 'undef' && n === 'undef') continue
    if (o === true !== (n === true)) return false
    if (o === true) oldTrue++
    if (n === true) newTrue++
    compared++
  }
  if (oldTrue === 0 && newTrue === 0) return false
  return compared >= 6
}

export function reverseInequality(stmt: Statement): Statement {
  return {
    ...stmt,
    disjuncts: stmt.disjuncts.map((clause) =>
      clause.map((rel) => ({
        ...rel,
        op: isInequality(rel.op) ? flipOp(rel.op) : rel.op,
      })),
    ),
  }
}

export function gRatioSamples(oldS: Statement, newS: Statement): number | null {
  const o = singleRel(oldS)
  const n = singleRel(newS)
  if (!o || !n) return null
  const vars = [...new Set([...oldS.vars, ...newS.vars])]
  const samples = samplesFor(vars.length ? vars : ['x'])
  const ratios: number[] = []
  for (const s of samples) {
    const go = gValue(o, s)
    const gn = gValue(n, s)
    if (go === 'undef' || gn === 'undef') continue
    if (Math.abs(go) < 1e-8) continue
    ratios.push(gn / go)
  }
  return constantOnSamples(ratios)
}

export function bothSidesDelta(oldR: Relation, newR: Relation, vars: string[]) {
  const samples = samplesFor(vars.length ? vars : ['x'])
  const adds: number[] = []
  const ratios: number[] = []
  const nearly = (a: number, b: number, scale = 1) =>
    Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), scale)
  for (const s of samples) {
    const oL = evalNode(oldR.lhs, s)
    const oR = evalNode(oldR.rhs, s)
    const nL = evalNode(newR.lhs, s)
    const nR = evalNode(newR.rhs, s)
    if (oL === 'undef' || oR === 'undef' || nL === 'undef' || nR === 'undef') continue
    const dL = nL - oL
    const dR = nR - oR
    if (nearly(dL, dR, Math.max(Math.abs(dL), Math.abs(dR)))) adds.push(dL)
    if (Math.abs(oL) > 1e-8 && Math.abs(oR) > 1e-8) {
      const rL = nL / oL
      const rR = nR / oR
      if (nearly(rL, rR, Math.max(Math.abs(rL), Math.abs(rR)))) ratios.push(rL)
    }
  }
  return {
    add: constantOnSamples(adds),
    ratio: constantOnSamples(ratios),
  }
}
