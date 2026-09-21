/**
 * Text builders for difference-quotient lines (app syntax, the way she writes them on paper):
 * monomials in x and h, signed sums, and a commutative "shape key" used to anchor her line on the
 * canonical path (every DQ line is equivalent to every other, so equivalence cannot anchor).
 */
import { parseExpression } from '@/engine'
import { isOp, isUnaryMinus, nodeArgs, tryConst, type MathNode } from '@/engine/math'
import type { VarName } from '@/shared/types'

function pow(v: string, e: number): string {
  return e === 0 ? '' : e === 1 ? v : `${v}^${e}`
}

/** c·x^i·h^j as she writes it: "3x^2", "-x", "6xh", "h^2", "-7"; '' when c = 0. */
export function mono(c: number, i = 0, j = 0): string {
  if (c === 0) return ''
  const vars = `${pow('x', i)}${pow('h', j)}`
  const abs = Math.abs(c)
  const coef = vars && abs === 1 ? '' : String(abs)
  return `${c < 0 ? '-' : ''}${coef}${vars}`
}

/** Signed terms joined with + / −, empty terms skipped: ["3x^2", "-2x", "1"] → "3x^2 - 2x + 1". */
export function sum(terms: readonly string[]): string {
  const parts = terms.filter((t) => t !== '')
  if (!parts.length) return '0'
  return parts.reduce((acc, t, idx) => (idx === 0 ? t : t.startsWith('-') ? `${acc} - ${t.slice(1)}` : `${acc} + ${t}`), '')
}

/** "x + h + 3", "x + h - 2", "x + h" */
export function shifted(base: string, c: number): string {
  return c === 0 ? base : c > 0 ? `${base} + ${c}` : `${base} - ${-c}`
}

/** k·(inner) with the 1 / −1 folded in: "3(x + 2)", "-(x + h)", "(x + h)"; a bare letter needs no parentheses. */
export function times(k: number, inner: string): string {
  const wrapped = /^[a-z]$/i.test(inner) ? inner : `(${inner})`
  if (k === 1) return wrapped
  if (k === -1) return `-${wrapped}`
  return `${k}${wrapped}`
}

// ---------------------------------------------------------------------------
// Shape key: the same line up to reordering terms and factors
// ---------------------------------------------------------------------------

function isSum(n: MathNode): boolean {
  return isOp(n, '+') || (isOp(n, '-') && nodeArgs(n).length === 2)
}

/**
 * Terms of a left-associated chain a + b − c + d. Only the LEFT operand is flattened: a sum on the
 * right can only come from parentheses, and "5x + 5h − 2 − (5x − 2)" is a different line from
 * "5x + 5h − 2 − 5x + 2" (the minus has not been distributed yet), so it stays one grouped term.
 */
function signedTerms(n: MathNode, sign: number, out: { sign: number; node: MathNode }[]): void {
  if (isSum(n)) {
    const [a, b] = nodeArgs(n)
    signedTerms(a!, sign, out)
    out.push({ sign: isOp(n, '-') ? -sign : sign, node: b! })
    return
  }
  out.push({ sign, node: n })
}

/** Product → [coefficient, sorted keys of the other factors]; unary minus folds into the coefficient. */
function productKey(n: MathNode, sign: number): string {
  let coef = sign
  const keys: string[] = []
  const visit = (m: MathNode) => {
    if (isUnaryMinus(m)) {
      coef = -coef
      visit(nodeArgs(m)[0]!)
      return
    }
    if (isOp(m, '*')) {
      for (const f of nodeArgs(m)) visit(f)
      return
    }
    const c = m.type === 'ConstantNode' ? tryConst(m) : null
    if (c != null) coef *= c
    else keys.push(shapeKeyOf(m))
  }
  visit(n)
  keys.sort()
  return keys.length ? `${coef}*${keys.join('*')}` : String(coef)
}

export function shapeKeyOf(n: MathNode): string {
  if (n.type === 'SymbolNode') return String((n as unknown as { name: string }).name)
  if (n.type === 'ConstantNode') return String(tryConst(n))
  if (isSum(n)) {
    const terms: { sign: number; node: MathNode }[] = []
    signedTerms(n, 1, terms)
    return `sum(${terms
      .map((t) => productKey(t.node, t.sign))
      .sort()
      .join(',')})`
  }
  if (isUnaryMinus(n) || isOp(n, '*')) return `(${productKey(n, 1)})`
  if (isOp(n, '/')) {
    const [a, b] = nodeArgs(n)
    return `div(${shapeKeyOf(a!)},${shapeKeyOf(b!)})`
  }
  if (isOp(n, '^')) {
    const [a, b] = nodeArgs(n)
    return `pow(${shapeKeyOf(a!)},${shapeKeyOf(b!)})`
  }
  if (n.type === 'FunctionNode') {
    const fn = (n as unknown as { fn: { name?: string } | string }).fn
    const name = typeof fn === 'string' ? fn : (fn.name ?? 'f')
    return `${name}(${nodeArgs(n).map(shapeKeyOf).join(',')})`
  }
  return n.toString()
}

/** Shape key of an app-syntax line, or null when it does not parse. */
export function shapeKey(text: string, vars: readonly VarName[]): string | null {
  const p = parseExpression(text, vars)
  return p.ok ? shapeKeyOf(p.node) : null
}
