/**
 * Exact comparison of line equations. Any equivalent form is the same line:
 * y = 2x + 2, y − 4 = 2(x − 1), and 2x − y = −2.
 * A line is stored as ax + by + c = 0 with integer coefficients, gcd 1,
 * and the first nonzero of a, b positive.
 */
import type { MathNode } from 'mathjs'
import { parseExpression } from '@/engine'
import { rat, ratAdd, ratDiv, ratEquals, ratMul, ratSub, ratToString, type Rational } from '@/notation'

export interface LineEq {
  a: number
  b: number
  c: number
}

const ZERO = rat(0, 1)
const ONE = rat(1, 1)
const INVALID = 'Write an equation of a line, with x and y.'

export type LineRead = { ok: true; line: LineEq } | { ok: false; message: string }

interface Coeff {
  x: Rational
  y: Rational
  k: Rational
}

export function readLine(raw: string): LineRead {
  const text = (raw ?? '').trim()
  if (!text) return { ok: false, message: INVALID }
  const parts = splitEq(text)
  if (!parts) return { ok: false, message: INVALID }
  try {
    const left = coeffOf(parts[0])
    const right = coeffOf(parts[1])
    const diff: Coeff = { x: ratSub(left.x, right.x), y: ratSub(left.y, right.y), k: ratSub(left.k, right.k) }
    const line = normalize(diff)
    if (!line) return { ok: false, message: INVALID }
    return { ok: true, line }
  } catch {
    return { ok: false, message: INVALID }
  }
}

export function sameLine(a: LineEq, b: LineEq): boolean {
  return a.a === b.a && a.b === b.b && a.c === b.c
}

/** A canonical equation: "x = 3", "y = -2", or "y = -1/2x + 1". ASCII hyphen, so it matches what she types. */
export function formatLine(line: LineEq): string {
  if (line.b === 0) return `x = ${ratToString(rat(-line.c, line.a))}`
  if (line.a === 0) return `y = ${ratToString(rat(-line.c, line.b))}`
  const m = rat(-line.a, line.b)
  const k = rat(-line.c, line.b)
  return `y = ${slopeTerm(m)}${tail(k)}`
}

/** Slope of the line, or null when the line is vertical. */
export function lineSlope(line: LineEq): Rational | null {
  if (line.b === 0) return null
  return rat(-line.a, line.b)
}

function slopeTerm(m: Rational): string {
  if (ratEquals(m, ONE)) return 'x'
  if (ratEquals(m, rat(-1, 1))) return '-x'
  return `${ratToString(m)}x`
}

function tail(k: Rational): string {
  if (ratEquals(k, ZERO)) return ''
  const sign = k.n < 0 ? '-' : '+'
  return ` ${sign} ${ratToString(rat(Math.abs(k.n), k.d))}`
}

function splitEq(src: string): [string, string] | null {
  let depth = 0
  let at = -1
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === '=' && depth === 0) {
      if (at >= 0) return null
      at = i
    }
  }
  if (at <= 0 || at >= src.length - 1) return null
  const left = src.slice(0, at).trim()
  const right = src.slice(at + 1).trim()
  if (!left || !right) return null
  return [left, right]
}

function coeffOf(side: string): Coeff {
  const parsed = parseExpression(side, ['x', 'y'])
  if (!parsed.ok) throw new Error('unreadable')
  return walk(parsed.node)
}

function walk(node: MathNode): Coeff {
  const n = unwrap(node)
  const rec = n as unknown as Record<string, unknown>
  if (n.type === 'ConstantNode') {
    const value = rec.value
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('constant')
    return { x: ZERO, y: ZERO, k: numberRat(value) }
  }
  if (n.type === 'SymbolNode') {
    if (rec.name === 'x') return { x: ONE, y: ZERO, k: ZERO }
    if (rec.name === 'y') return { x: ZERO, y: ONE, k: ZERO }
    throw new Error('symbol')
  }
  if (n.type === 'OperatorNode') {
    const args = (rec.args as MathNode[] | undefined) ?? []
    if (rec.fn === 'unaryMinus' || (rec.op === '-' && args.length === 1)) return scale(walk(args[0]!), rat(-1, 1))
    if (rec.fn === 'unaryPlus' || (rec.op === '+' && args.length === 1)) return walk(args[0]!)
    const left = walk(args[0]!)
    const right = walk(args[1]!)
    if (rec.op === '+') return addC(left, right)
    if (rec.op === '-') return addC(left, scale(right, rat(-1, 1)))
    if (rec.op === '*') return mulC(left, right)
    if (rec.op === '/') return divC(left, right)
    if (rec.op === '^') {
      const exp = walk(args[1]!)
      if (!isConst(left) || !isConst(exp)) throw new Error('power')
      const base = left.k
      if (!ratIsInt(exp.k)) throw new Error('power')
      return { x: ZERO, y: ZERO, k: powRat(base, exp.k.n) }
    }
  }
  throw new Error(n.type)
}

function unwrap(node: MathNode): MathNode {
  const rec = node as unknown as { type: string; content?: MathNode }
  if (rec.type === 'ParenthesisNode' && rec.content) return unwrap(rec.content)
  return node
}

function isConst(c: Coeff): boolean {
  return ratEquals(c.x, ZERO) && ratEquals(c.y, ZERO)
}

function addC(a: Coeff, b: Coeff): Coeff {
  return { x: ratAdd(a.x, b.x), y: ratAdd(a.y, b.y), k: ratAdd(a.k, b.k) }
}

function scale(c: Coeff, f: Rational): Coeff {
  return { x: ratMul(c.x, f), y: ratMul(c.y, f), k: ratMul(c.k, f) }
}

function mulC(a: Coeff, b: Coeff): Coeff {
  if (!isConst(a) && !isConst(b)) throw new Error('nonlinear')
  return scale(isConst(a) ? b : a, isConst(a) ? a.k : b.k)
}

function divC(a: Coeff, b: Coeff): Coeff {
  if (!isConst(b) || ratEquals(b.k, ZERO)) throw new Error('divide')
  return scale(a, ratDiv(ONE, b.k))
}

function numberRat(value: number): Rational {
  if (Number.isInteger(value)) return rat(value, 1)
  const text = String(value)
  const m = text.match(/^(-?\d+)\.(\d+)$/)
  if (!m) throw new Error('decimal')
  const digits = m[2]!
  const den = 10 ** digits.length
  const num = Number(m[1]!) * den + Number(digits) * (m[1]!.startsWith('-') ? -1 : 1)
  return rat(num, den)
}

function ratIsInt(r: Rational): boolean {
  return r.d === 1
}

function powRat(base: Rational, exp: number): Rational {
  if (exp < 0 || exp > 8) throw new Error('power')
  let out = ONE
  for (let i = 0; i < exp; i++) out = ratMul(out, base)
  return out
}

function normalize(c: Coeff): LineEq | null {
  if (ratEquals(c.x, ZERO) && ratEquals(c.y, ZERO)) return null
  const den = lcm(lcm(c.x.d, c.y.d), c.k.d)
  let a = c.x.n * (den / c.x.d)
  let b = c.y.n * (den / c.y.d)
  let k = c.k.n * (den / c.k.d)
  const g = gcd(gcd(a, b), k)
  a /= g
  b /= g
  k /= g
  if (a < 0 || (a === 0 && b < 0)) {
    a = -a
    b = -b
    k = -k
  }
  return { a, b, c: k }
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}
