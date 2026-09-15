/**
 * Expression-mode helpers of the public API: compile / evaluate / equivalence with a witness, the
 * even-odd substitutions, and `verifyRewrite` (same-side rewrites in the even/odd slots and drill).
 */
import type { ChipId, Counterexample, PropertyTag, StepContext, StepResult, VarName } from '@/shared/types'
import { CHIP_LABEL, CHIP_OF_TAG, REWRITE_CHIPS } from '@/shared/types'
import { expressionCounterexample } from './counterexample'
import { collectVars, evalNode, nearlyEqual, type MathNode } from './math'
import { runMatchers } from './matchers'
import { normalizeGlyphs, parseExpression, parseStatement } from './parse'
import { classifyRewriteNodes } from './rewriteClassifier'
import { DEFAULT_SEED, exprEquiv, type Scope } from './samples'

export type Evaluator = (scope: Partial<Record<VarName, number>>) => number | 'undef'

/** Compiles an expression once; the evaluator returns 'undef' for NaN/∞/errors (or a parse error). */
export function compileExpr(text: string): Evaluator {
  const p = parseExpression(text)
  if (!p.ok) return () => 'undef'
  const node = p.node
  return (scope) => {
    const s: Scope = {}
    for (const [k, v] of Object.entries(scope)) if (typeof v === 'number') s[k] = v
    return evalNode(node, s)
  }
}

export function evaluateExpr(text: string, scope: Partial<Record<VarName, number>>): number | 'undef' {
  return compileExpr(text)(scope)
}

export interface ExprEquivalence {
  equivalent: boolean
  witness?: Counterexample
  undecidable?: boolean
}

/** String API: numeric equivalence of two expressions with a concrete witness when they differ. */
const NICE_PROBES = [1, -1, 2, -2, 3, -3, 0, 4, -4, 5, -5, 0.5, -0.5]

/**
 * A readable counterexample for two expressions in one variable: the first small integer (then a
 * half) where both are defined and differ. Returns null when none of the probes separates them.
 */
function niceExpressionWitness(a: MathNode, b: MathNode, vars: readonly string[]): Counterexample | null {
  if (vars.length !== 1) return null
  const v = vars[0]!
  for (const t of NICE_PROBES) {
    const scope = { [v]: t }
    const va = evalNode(a, scope)
    const vb = evalNode(b, scope)
    if (va === 'undef' && vb === 'undef') continue
    if (va === 'undef' || vb === 'undef' || !nearlyEqual(va, vb, Math.max(1, Math.abs(va), Math.abs(vb)))) {
      return expressionCounterexample(scope, va, vb, vars)
    }
  }
  return null
}

export function exprEquivalent(a: string, b: string, vars?: VarName[], seed = DEFAULT_SEED): ExprEquivalence {
  const pa = parseExpression(a, vars)
  const pb = parseExpression(b, vars)
  if (!pa.ok || !pb.ok) return { equivalent: false, undecidable: true }
  const allVars = vars && vars.length ? vars : [...new Set([...collectVars(pa.node), ...collectVars(pb.node)])]
  const res = exprEquiv(pa.node, pb.node, allVars.length ? allVars : ['x'], seed)
  if (res.equivalent) return { equivalent: true }
  if (res.undecidable) return { equivalent: false, undecidable: true }
  if (res.witness) {
    return { equivalent: false, witness: niceExpressionWitness(pa.node, pb.node, allVars) ?? expressionCounterexample(res.witness.scope, res.witness.a, res.witness.b, allVars) }
  }
  const dm = res.domainMismatches[0]
  if (dm) {
    return { equivalent: false, witness: expressionCounterexample(dm, evalNode(pa.node, dm), evalNode(pb.node, dm), allVars) }
  }
  return { equivalent: false }
}

const X_TOKEN = /(?<![A-Za-z])x(?![A-Za-z])/g

/** "x^3 - 2x" → "(-x)^3 - 2(-x)" (unsimplified, app syntax). */
export function substituteNegX(f: string): string {
  return normalizeGlyphs(f.trim()).replace(X_TOKEN, '(-x)')
}

/** "x^3 - 2x" → "-(x^3 - 2x)". */
export function negateExpr(f: string): string {
  return `-(${normalizeGlyphs(f.trim())})`
}

function freeLetter(vars: readonly string[]): VarName | null {
  for (const v of ['y', 'n', 'x'] as const) if (!vars.includes(v)) return v
  return null
}

/** Expression mode: is `next` a legal rewrite of the expression `prev`? */
export function verifyRewrite(prev: string, next: string, ctx: StepContext): StepResult {
  const pp = parseExpression(prev, ctx.vars)
  if (!pp.ok) {
    return {
      ok: false,
      verdict: 'parse_error',
      acceptableChips: [],
      parseError: { message: `Previous line: ${pp.error.message}`, position: pp.error.position, length: pp.error.length },
    }
  }
  const pn = parseExpression(next, ctx.vars)
  if (!pn.ok) {
    return {
      ok: false,
      verdict: 'parse_error',
      acceptableChips: [],
      parseError: { message: pn.error.message, position: pn.error.position, length: pn.error.length },
    }
  }
  const vars = [...new Set([...collectVars(pp.node), ...collectVars(pn.node)])].sort()
  const res = exprEquiv(pp.node, pn.node, vars.length ? vars : ['x'], ctx.seed, { domain: 'strict' }, ctx.checkValue)
  const normalized = { text: pn.text, latex: '' }
  if (res.equivalent) {
    const cls = classifyRewriteNodes(pp.node, pn.node)
    const tag = cls.chip as PropertyTag
    const exact = cls.confidence === 'high'
    const chips: ChipId[] = exact ? [cls.chip] : [...REWRITE_CHIPS]
    return {
      ok: true,
      verdict: 'equivalent',
      detected: { tag, chip: CHIP_OF_TAG[tag], exact, detail: `rewrote the expression (${CHIP_LABEL[cls.chip]})` },
      acceptableChips: chips,
      normalized,
    }
  }
  if (res.undecidable) return { ok: false, verdict: 'undecidable', acceptableChips: [], normalized }

  let counterexample: Counterexample | undefined
  if (res.witness) counterexample = niceExpressionWitness(pp.node, pn.node, vars) ?? expressionCounterexample(res.witness.scope, res.witness.a, res.witness.b, vars)
  else if (res.domainMismatches[0]) {
    const s = res.domainMismatches[0]
    counterexample = expressionCounterexample(s, evalNode(pp.node, s), evalNode(pn.node, s), vars)
  }
  const result: StepResult = { ok: false, verdict: 'not_equivalent', acceptableChips: [], normalized }
  if (counterexample) result.counterexample = counterexample
  // Reuse the relation matchers by wrapping both expressions as `L = expr` with a letter not in use.
  const letter = freeLetter(vars)
  if (letter) {
    const os = parseStatement(`${letter} = ${pp.text}`)
    const ns = parseStatement(`${letter} = ${pn.text}`)
    if (os.ok && ns.ok) {
      const pattern = runMatchers(os.statement, ns.statement, ctx)
      if (pattern) result.pattern = pattern
    }
  }
  return result
}
