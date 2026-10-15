/**
 * Parser for a complex answer. Normalize with the app's input normalizer first, then accept the
 * usual spellings of a + bi, a pair a +- bi, a list, (a+bi)/c, and k i sqrt(m).
 */
import { normalizeInput } from '@/engine'
import { rat, type Rational } from '@/notation'
import {
  CxSkip,
  cx,
  cxAdd,
  cxDiv,
  cxEq,
  cxIPower,
  cxIsReal,
  cxMul,
  cxNeg,
  cxPow,
  cxSqrt,
  cxSub,
  splitSquare,
  type Cx,
} from './arith'

export type CxParse =
  | { ok: true; values: Cx[]; simplified: boolean; source: string }
  | { ok: false; message: string }

type Tok =
  | { k: 'num'; v: Rational; t: string }
  | { k: 'i' | 'sqrt' | 'plus' | 'minus' | 'times' | 'div' | 'pow' | 'lparen' | 'rparen' | 'comma' | 'pm' }

type Ast =
  | { t: 'num'; v: Rational }
  | { t: 'i' }
  | { t: 'sqrt'; arg: Ast }
  | { t: 'neg'; inner: Ast }
  | { t: 'add' | 'sub' | 'mul' | 'div' | 'pow'; a: Ast; b: Ast }

const UNREADABLE = 'That doesn’t read as a complex number.'

function fail(message: string): CxParse {
  return { ok: false, message }
}

function tokenize(src: string): Tok[] | string {
  const s = src
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '(') {
      out.push({ k: 'lparen' })
      i++
      continue
    }
    if (c === ')') {
      out.push({ k: 'rparen' })
      i++
      continue
    }
    if (c === ',') {
      out.push({ k: 'comma' })
      i++
      continue
    }
    if (c === '*') {
      out.push({ k: 'times' })
      i++
      continue
    }
    if (c === '/') {
      out.push({ k: 'div' })
      i++
      continue
    }
    if (c === '^') {
      out.push({ k: 'pow' })
      i++
      continue
    }
    if (c === '+' && s[i + 1] === '-') {
      // "+-" with no space is ±. "3 + -2i" keeps the plus and the minus.
      out.push({ k: 'pm' })
      i += 2
      continue
    }
    if (c === '+') {
      out.push({ k: 'plus' })
      i++
      continue
    }
    if (c === '-') {
      out.push({ k: 'minus' })
      i++
      continue
    }
    if (c === 'i' || c === 'I') {
      out.push({ k: 'i' })
      i++
      continue
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1
      while (j < s.length && /[0-9]/.test(s[j]!)) j++
      const n = Number(s.slice(i, j))
      if (!Number.isSafeInteger(n)) return 'A number in that answer is too large to check exactly.'
      out.push({ k: 'num', v: rat(n), t: s.slice(i, j) })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i + 1
      while (j < s.length && /[a-zA-Z]/.test(s[j]!)) j++
      const id = s.slice(i, j).toLowerCase()
      if (id === 'sqrt') {
        out.push({ k: 'sqrt' })
        i = j
        continue
      }
      if (id === 'i') {
        out.push({ k: 'i' })
        i = j
        continue
      }
      return UNREADABLE
    }
    return UNREADABLE
  }
  return out
}

function insertImplicit(toks: Tok[]): Tok[] {
  const out: Tok[] = []
  const startsAtom = (t: Tok) => t.k === 'num' || t.k === 'i' || t.k === 'sqrt' || t.k === 'lparen'
  const endsAtom = (t: Tok) => t.k === 'num' || t.k === 'i' || t.k === 'rparen'
  for (let i = 0; i < toks.length; i++) {
    const cur = toks[i]!
    const prev = out[out.length - 1]
    if (prev && endsAtom(prev) && startsAtom(cur)) out.push({ k: 'times' })
    // i sqrt, num sqrt already covered; sqrt 3 without parens is handled in atom()
    out.push(cur)
  }
  return out
}

class Parser {
  private i = 0
  constructor(private readonly toks: Tok[]) {}

  peek(): Tok | undefined {
    return this.toks[this.i]
  }

  take(): Tok | undefined {
    return this.toks[this.i++]
  }

  at(k: Tok['k']): boolean {
    return this.peek()?.k === k
  }

  eat(k: Tok['k']): boolean {
    if (this.at(k)) {
      this.i++
      return true
    }
    return false
  }

  atom(): Ast | string {
    if (this.eat('lparen')) {
      const inner = this.expr()
      if (typeof inner === 'string') return inner
      if (!this.eat('rparen')) return UNREADABLE
      return inner
    }
    if (this.eat('i')) return { t: 'i' }
    if (this.eat('sqrt')) {
      if (this.eat('lparen')) {
        const arg = this.expr()
        if (typeof arg === 'string') return arg
        if (!this.eat('rparen')) return UNREADABLE
        return { t: 'sqrt', arg }
      }
      const n = this.peek()
      if (n?.k === 'num') {
        this.take()
        return { t: 'sqrt', arg: { t: 'num', v: n.v } }
      }
      return UNREADABLE
    }
    const n = this.peek()
    if (n?.k === 'num') {
      this.take()
      return { t: 'num', v: n.v }
    }
    return UNREADABLE
  }

  power(): Ast | string {
    const base = this.atom()
    if (typeof base === 'string') return base
    if (!this.eat('pow')) return base
    const exp = this.unary()
    if (typeof exp === 'string') return exp
    return { t: 'pow', a: base, b: exp }
  }

  unary(): Ast | string {
    if (this.eat('plus')) return this.unary()
    if (this.eat('minus')) {
      const inner = this.unary()
      if (typeof inner === 'string') return inner
      return { t: 'neg', inner }
    }
    return this.power()
  }

  term(): Ast | string {
    let left = this.unary()
    if (typeof left === 'string') return left
    for (;;) {
      if (this.eat('times')) {
        const right = this.unary()
        if (typeof right === 'string') return right
        left = { t: 'mul', a: left, b: right }
        continue
      }
      if (this.eat('div')) {
        const right = this.unary()
        if (typeof right === 'string') return right
        left = { t: 'div', a: left, b: right }
        continue
      }
      break
    }
    return left
  }

  expr(): Ast | string {
    let left = this.term()
    if (typeof left === 'string') return left
    for (;;) {
      if (this.eat('plus')) {
        const right = this.term()
        if (typeof right === 'string') return right
        left = { t: 'add', a: left, b: right }
        continue
      }
      if (this.eat('minus')) {
        const right = this.term()
        if (typeof right === 'string') return right
        left = { t: 'sub', a: left, b: right }
        continue
      }
      break
    }
    return left
  }

  item(): { ast: Ast; pm: Ast | null } | string {
    // "+- 3i" (the answer to x^2 + 9 = 0) is 0 +- 3i.
    if (this.eat('pm')) {
      const b = this.term()
      if (typeof b === 'string') return b
      return { ast: { t: 'num', v: rat(0) }, pm: b }
    }
    const a = this.expr()
    if (typeof a === 'string') return a
    if (this.eat('pm')) {
      const b = this.term()
      if (typeof b === 'string') return b
      return { ast: a, pm: b }
    }
    return { ast: a, pm: null }
  }

  list(): { items: { ast: Ast; pm: Ast | null }[] } | string {
    const first = this.item()
    if (typeof first === 'string') return first
    const items = [first]
    while (this.eat('comma')) {
      const next = this.item()
      if (typeof next === 'string') return next
      items.push(next)
    }
    if (this.peek() !== undefined) return UNREADABLE
    return { items }
  }
}

function evalAst(ast: Ast): Cx {
  switch (ast.t) {
    case 'num':
      return cx(ast.v, 0)
    case 'i':
      return cx(0, 1)
    case 'neg':
      return cxNeg(evalAst(ast.inner))
    case 'sqrt':
      return cxSqrt(evalAst(ast.arg))
    case 'add':
      return cxAdd(evalAst(ast.a), evalAst(ast.b))
    case 'sub':
      return cxSub(evalAst(ast.a), evalAst(ast.b))
    case 'mul':
      return cxMul(evalAst(ast.a), evalAst(ast.b))
    case 'div':
      return cxDiv(evalAst(ast.a), evalAst(ast.b))
    case 'pow': {
      const base = evalAst(ast.a)
      const exp = evalAst(ast.b)
      if (cxEq(base, cx(0, 1)) && cxIsReal(exp) && exp.reRad === 1 && exp.re.d === 1) return cxIPower(exp.re.n)
      return cxPow(base, exp)
    }
  }
}

function isRealRatAst(ast: Ast): boolean {
  if (ast.t === 'num') return true
  if (ast.t === 'neg') return isRealRatAst(ast.inner)
  if (ast.t === 'add' || ast.t === 'sub' || ast.t === 'mul' || ast.t === 'div' || ast.t === 'pow') {
    return isRealRatAst(ast.a) && isRealRatAst(ast.b)
  }
  return false
}

function isAtomProduct(ast: Ast): boolean {
  if (ast.t === 'num' || ast.t === 'i') return true
  if (ast.t === 'neg') return isAtomProduct(ast.inner)
  if (ast.t === 'sqrt') return isRealRatAst(ast.arg)
  if (ast.t === 'mul') return isAtomProduct(ast.a) && isAtomProduct(ast.b)
  if (ast.t === 'div') return isAtomProduct(ast.a) && isRealRatAst(ast.b)
  return false
}

function isSumOfTerms(ast: Ast): boolean {
  if (ast.t === 'add' || ast.t === 'sub') return isSumOfTerms(ast.a) && isSumOfTerms(ast.b)
  return isAtomProduct(ast)
}

/** a + bi, (a+bi)/real, k i sqrt(m), a real, or a pure imaginary — no i², no complex denominator. */
function isSimplifiedAst(ast: Ast): boolean {
  if (ast.t === 'div') return isSumOfTerms(ast.a) && isRealRatAst(ast.b)
  if (ast.t === 'pow') return false
  if (ast.t === 'sqrt') {
    try {
      const arg = evalAst(ast.arg)
      if (!cxIsReal(arg)) return false
      return arg.re.n >= 0
    } catch {
      return false
    }
  }
  return isSumOfTerms(ast)
}

function hasIPower(ast: Ast): boolean {
  if (ast.t === 'pow') return true
  if (ast.t === 'neg' || ast.t === 'sqrt') return hasIPower(ast.t === 'sqrt' ? ast.arg : ast.inner)
  if (ast.t === 'add' || ast.t === 'sub' || ast.t === 'mul' || ast.t === 'div') return hasIPower(ast.a) || hasIPower(ast.b)
  return false
}

function hasComplexDenom(ast: Ast): boolean {
  if (ast.t === 'div') {
    try {
      const d = evalAst(ast.b)
      if (!cxIsReal(d) || d.reRad !== 1) return true
    } catch {
      return true
    }
    return hasComplexDenom(ast.a) || hasComplexDenom(ast.b)
  }
  if (ast.t === 'neg' || ast.t === 'sqrt') return hasComplexDenom(ast.t === 'sqrt' ? ast.arg : ast.inner)
  if (ast.t === 'add' || ast.t === 'sub' || ast.t === 'mul' || ast.t === 'pow') return hasComplexDenom(ast.a) || hasComplexDenom(ast.b)
  return false
}

/**
 * Every square root, anywhere in the answer, in simplest radical form: a positive whole number with no
 * square factor. 3 + sqrt(-4), sqrt(12) and sqrt(1/2) are values, not finished answers.
 */
function radicalsSimplest(ast: Ast): boolean {
  if (ast.t === 'sqrt') {
    try {
      const arg = evalAst(ast.arg)
      if (!cxIsReal(arg) || arg.reRad !== 1 || arg.re.d !== 1 || arg.re.n <= 0) return false
      if (splitSquare(arg.re.n).coeff !== 1) return false
    } catch {
      return false
    }
    return radicalsSimplest(ast.arg)
  }
  if (ast.t === 'neg') return radicalsSimplest(ast.inner)
  if (ast.t === 'add' || ast.t === 'sub' || ast.t === 'mul' || ast.t === 'div' || ast.t === 'pow') {
    return radicalsSimplest(ast.a) && radicalsSimplest(ast.b)
  }
  return true
}

function simplifiedFlag(ast: Ast): boolean {
  if (hasIPower(ast) || hasComplexDenom(ast) || !radicalsSimplest(ast)) return false
  if (ast.t === 'sqrt') {
    try {
      const arg = evalAst(ast.arg)
      if (cxIsReal(arg) && arg.re.n < 0) return false
    } catch {
      return false
    }
  }
  return isSimplifiedAst(ast)
}

function expandItem(item: { ast: Ast; pm: Ast | null }): { values: Cx[]; simplified: boolean } {
  const left = evalAst(item.ast)
  const leftSimple = simplifiedFlag(item.ast)
  if (!item.pm) return { values: [left], simplified: leftSimple }
  const right = evalAst(item.pm)
  const simple = leftSimple && simplifiedFlag(item.pm)
  return { values: [cxAdd(left, right), cxSub(left, right)], simplified: simple }
}

/**
 * Parse one complex answer. Empty input and nonsense come back as a message (not an attempt).
 * `simplified` is false when the value is written with i², a complex denominator, or √ of a negative.
 */
export function parseCxAnswer(text: string): CxParse {
  const source = normalizeInput(text).trim()
  if (!source) return fail('Type your answer first.')
  const toks = tokenize(outerParensOff(source))
  if (typeof toks === 'string') return fail(toks)
  if (toks.length === 0) return fail('Type your answer first.')
  const parser = new Parser(insertImplicit(toks))
  let parsed: ReturnType<Parser['list']>
  try {
    parsed = parser.list()
  } catch (e) {
    if (e instanceof RangeError) return fail('A number in that answer is too large to check exactly.')
    return fail(UNREADABLE)
  }
  if (typeof parsed === 'string') return fail(parsed)
  try {
    const values: Cx[] = []
    let simplified = true
    for (const item of parsed.items) {
      const got = expandItem(item)
      values.push(...got.values)
      if (!got.simplified) simplified = false
    }
    if (values.length === 0) return fail(UNREADABLE)
    return { ok: true, values, simplified, source }
  } catch (e) {
    if (e instanceof RangeError) return fail('A number in that answer is too large to check exactly.')
    if (e instanceof CxSkip) return fail(UNREADABLE)
    return fail(UNREADABLE)
  }
}

/** "(2 +- 3i)": one pair of brackets around the whole answer is dropped when it holds a plus-or-minus. */
function outerParensOff(text: string): string {
  if (!text.startsWith('(') || !text.endsWith(')') || !/\+-|±/.test(text)) return text
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    if (depth === 0 && i < text.length - 1) return text
  }
  return text.slice(1, -1).trim()
}

export const CX_UNREADABLE = UNREADABLE
