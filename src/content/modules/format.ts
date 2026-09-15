import type { RelOp } from '@/shared/types'

export function coeffVar(c: number, v = 'x'): string {
  if (c === 1) return v
  if (c === -1) return `-${v}`
  return `${c}${v}`
}

export function linearExpr(a: number, b: number, v = 'x'): string {
  if (b === 0) return coeffVar(a, v)
  const left = coeffVar(a, v)
  return b > 0 ? `${left} + ${b}` : `${left} - ${-b}`
}

export function xShift(b: number, v = 'x'): string {
  if (b === 0) return v
  return b > 0 ? `${v} + ${b}` : `${v} - ${-b}`
}

export function aTimesBinom(a: number, b: number, v = 'x'): string {
  const inner = xShift(b, v)
  if (a === 1) return `(${inner})`
  if (a === -1) return `-(${inner})`
  return `${a}(${inner})`
}

export function relJoin(left: string, op: RelOp, right: string): string {
  return `${left} ${op} ${right}`
}

export function parenSum(expr: string): string {
  return expr.startsWith('-') || /[+]/.test(expr) || / - /.test(expr) ? `(${expr})` : expr
}

/** "(3/5)y" or "-(3/5)y" — a fractional coefficient in app syntax. */
export function fracCoeff(p: number, q: number, v: string, negative: boolean): string {
  return `${negative ? '-' : ''}(${p}/${q})${v}`
}

/** Append "+ t" / "- |t|" to a term (nothing when t = 0). */
export function addConst(term: string, t: number): string {
  if (t === 0) return term
  return t > 0 ? `${term} + ${t}` : `${term} - ${-t}`
}

/** The symbol after multiplying/dividing an inequality by a negative. */
export function flipOp(op: RelOp): RelOp {
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

/** Human symbol for messages: "<=" → "≤". */
export function opGlyph(op: RelOp): string {
  switch (op) {
    case '<=':
      return '≤'
    case '>=':
      return '≥'
    default:
      return op
  }
}

/** "−3" style minus for prose (student-facing text uses the true minus sign). */
export function prettyInt(n: number): string {
  return n < 0 ? `−${-n}` : `${n}`
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x
}
