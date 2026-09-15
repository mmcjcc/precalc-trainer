import { compileExpression, isOp, isUnaryMinus, nodeArgs, type MathNode } from '../engine/math'
import { insertImplicitMul, normalizeGlyphs } from '../engine/parse'

/**
 * App syntax → the text a student types on a TI-84 Plus CE or a TI-Nspire CX II (non-CAS).
 *
 * Parenthesis policy (both calculators): an operand of `/` or `^` is wrapped only when it is not a
 * single number, a single symbol or a self-closing function call — so "1/4*x", "x^2", "(x-3)/(-3)",
 * "(x+6)/(x+2)". A negated simple numerator stays bare ("-1/(x+6)") because (−a)/b = −(a/b) under
 * any precedence. Sums are wrapped wherever precedence needs them (factors, the right side of −,
 * the operand of a negation). A fractional power is never produced: cbrt(u) → ³√(u) / root(u,3).
 */

function renameIndep(src: string, independent: string): string {
  if (independent === 'x') return src
  const re = new RegExp(`\\b${independent}\\b`, 'g')
  return src.replace(re, 'x')
}

function parseExpr(src: string): MathNode {
  const prepared = insertImplicitMul(normalizeGlyphs(src))
  return compileExpression(prepared)
}

function field<T>(n: MathNode, key: string): T | undefined {
  return (n as unknown as Record<string, T | undefined>)[key]
}

/** compileExpression only strips the outermost ParenthesisNode of each nested run; peel the rest. */
function unwrap(n: MathNode): MathNode {
  let cur = n
  while (cur.type === 'ParenthesisNode') {
    const inner = field<MathNode>(cur, 'content')
    if (!inner) break
    cur = inner
  }
  return cur
}

const args = (n: MathNode): MathNode[] => nodeArgs(n).map(unwrap)

function isSum(n: MathNode): boolean {
  return isOp(n, '+') || (isOp(n, '-') && nodeArgs(n).length === 2)
}

/** A single non-negative number, a single symbol, or a function call (it closes its own parens). */
function isSimple(n: MathNode): boolean {
  if (n.type === 'SymbolNode' || n.type === 'FunctionNode') return true
  if (n.type === 'ConstantNode') {
    const v = field<unknown>(n, 'value')
    return typeof v !== 'number' || v >= 0
  }
  return false
}

function fnName(n: MathNode): string {
  const fn = field<unknown>(n, 'fn')
  if (typeof fn === 'string') return fn
  if (fn && typeof fn === 'object' && 'name' in fn) return String((fn as { name?: string }).name ?? '')
  return field<string>(n, 'name') ?? ''
}

interface Dialect {
  symbol(name: string): string
  neg: string
  /** Separator placed before a factor (after the first). */
  mulSep(next: string): string
  /** TI-84 writes implied multiplication, so a quotient factor needs its own parens: (3/4)X. */
  wrapQuotientFactor: boolean
  fn(name: string, printed: string[], raw: MathNode[]): string
}

function makePrinter(d: Dialect): (node: MathNode) => string {
  const paren = (s: string) => `(${s})`
  const rec = (raw: MathNode): string => {
    const n = unwrap(raw)
    if (n.type === 'ConstantNode') return String(field<unknown>(n, 'value'))
    if (n.type === 'SymbolNode') return d.symbol(field<string>(n, 'name') ?? '')
    if (isUnaryMinus(n)) {
      const inner = args(n)[0]
      if (!inner) return d.neg
      const t = rec(inner)
      return d.neg + (isSum(inner) || isUnaryMinus(inner) ? paren(t) : t)
    }
    if (n.type === 'FunctionNode') {
      const a = args(n)
      return d.fn(fnName(n), a.map(rec), a)
    }
    if (isOp(n, '/')) {
      const [a, b] = args(n)
      if (!a || !b) return n.toString()
      const left = isSimple(a) || (isUnaryMinus(a) && args(a)[0] !== undefined && isSimple(args(a)[0]!)) ? rec(a) : paren(rec(a))
      const right = isSimple(b) ? rec(b) : paren(rec(b))
      return `${left}/${right}`
    }
    if (isOp(n, '^')) {
      const [a, b] = args(n)
      if (!a || !b) return n.toString()
      const base = isSimple(a) ? rec(a) : paren(rec(a))
      const exp = isSimple(b) ? rec(b) : paren(rec(b))
      return `${base}^${exp}`
    }
    if (isOp(n, '*')) {
      return args(n)
        .map((a, i) => {
          const t = rec(a)
          const wrap =
            isSum(a) || (i > 0 && isUnaryMinus(a)) || (d.wrapQuotientFactor && isOp(a, '/'))
          const piece = wrap ? paren(t) : t
          return i === 0 ? piece : d.mulSep(piece) + piece
        })
        .join('')
    }
    if (isOp(n, '+')) {
      return args(n)
        .map((a, i) => (i > 0 && isUnaryMinus(a) ? paren(rec(a)) : rec(a)))
        .join('+')
    }
    if (isOp(n, '-') && nodeArgs(n).length === 2) {
      const [a, b] = args(n)
      if (!a || !b) return n.toString()
      const right = isSum(b) || isUnaryMinus(b) ? paren(rec(b)) : rec(b)
      return `${rec(a)}-${right}`
    }
    return n.toString()
  }
  return rec
}

const printTi84 = makePrinter({
  symbol: (name) => {
    if (name === 'x') return 'X'
    if (name === 'pi') return 'π'
    if (name === 'e') return 'e'
    return name.toUpperCase()
  },
  neg: '(-)',
  // Implied multiplication reads naturally ("2X", "3(X+1)") except before a digit: X*2.
  mulSep: (next) => (/^[0-9.]/.test(next) ? '*' : ''),
  wrapQuotientFactor: true,
  fn: (name, p, raw) => {
    if (name === 'cbrt') return `³√(${p[0] ?? ''})`
    if (name === 'sqrt') return `√(${p[0] ?? ''})`
    if (name === 'abs') return `abs(${p[0] ?? ''})`
    if (name === 'nthRoot') {
      const idx = raw[1]
      const index = idx && isSimple(idx) ? (p[1] ?? '') : `(${p[1] ?? ''})`
      return `${index}ˣ√(${p[0] ?? ''})`
    }
    return `${name}(${p.join(',')})`
  },
})

const printNspire = makePrinter({
  symbol: (name) => (name === 'pi' ? 'π' : name.toLowerCase()),
  neg: '-',
  // x(y+2) is a function call on the Nspire: every product gets an explicit *.
  mulSep: () => '*',
  wrapQuotientFactor: false,
  fn: (name, p) => {
    if (name === 'cbrt') return `root(${p[0] ?? ''},3)`
    if (name === 'sqrt') return `√(${p[0] ?? ''})`
    if (name === 'abs') return `abs(${p[0] ?? ''})`
    if (name === 'nthRoot') return `root(${p[0] ?? ''},${p[1] ?? ''})`
    return `${name}(${p.join(',')})`
  },
})

export function toTi84(expr: string, independent = 'x'): string {
  return printTi84(parseExpr(renameIndep(expr, independent)))
}

export function toNspire(expr: string, independent = 'x'): string {
  return printNspire(parseExpr(renameIndep(expr, independent)))
}

export function assertNoFractionalPow(s: string): void {
  if (/\^\s*\(?\s*1\s*\/\s*[23]\s*\)?/.test(s)) {
    throw new Error(`calculator string used a fractional power: ${s}`)
  }
}
