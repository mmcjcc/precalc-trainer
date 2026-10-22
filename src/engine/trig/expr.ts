/**
 * The reader for the functions she writes in Unit 5 (graphs of the trig functions): an equation for a graph,
 * "y = 3sin(2(x − π/4)) + 1", a model, "h(t) = 30 − 25cos(πt/2)", an expression in x, "√(1 − x²)", or a family of
 * x-values, "π/4 + kπ/2". It reads what she types on a keyboard or the keypad, the textbook's way:
 *
 *   3sin(2x − π/2) + 1, 3 sin 2x + 1        sin 2x is sin(2x): a function takes the product right after it
 *   −3cos(2(x − π/4)) + 1, (1/2)cos(x/2)    implicit multiplication, read left to right as on a TI-84 (1/2x is x/2)
 *   sec(x), csc(x), cot(x)                  all six functions (the TI-84 has three; the app reads all six)
 *   arcsin(x), asin(x), sin⁻¹(x), sin^-1(x) the inverse functions
 *   √(1 − x²), sqrt(1-x^2), (1 - x^2)^(1/2) square roots
 *
 * and gives back a tree that is evaluated two ways: as a number (to sample a function over two periods) and exactly
 * (c·√m·πᵏ) at the special points, where sin and cos of a multiple of π/6 or π/4 are known exactly. A sum of unlike
 * terms, or a function at an angle that is not special, has no exact value here ('unknown'); a ratio with zero on the
 * bottom, a square root of a negative, arcsin of a number past 1, is 'undef'. Messages never contain a value she has
 * not typed herself.
 */
import { EXACT_ZERO, exactAbs, exactAdd, exactDiv, exactInt, exactMul, exactNeg, exactNum, exactPi, exactPow, exactQ, exactSqrt, isZero, tx, type TrigExact } from './exact'
import { TrigOverflow, q, qDiv, qFromDecimal, qMul, type Q } from './rational'
import { trigValue, type TrigFn } from './values'

export type ExprFn = TrigFn | 'asin' | 'acos' | 'atan' | 'sqrt' | 'abs'

export type ExprNode =
  | { t: 'num'; v: Q; text: string }
  | { t: 'pi' }
  | { t: 'var'; name: string }
  | { t: 'neg'; arg: ExprNode }
  | { t: 'add'; op: '+' | '-'; l: ExprNode; r: ExprNode }
  | { t: 'mul'; op: '*' | '/' | 'implicit'; l: ExprNode; r: ExprNode }
  | { t: 'pow'; base: ExprNode; exp: ExprNode }
  | { t: 'fn'; name: ExprFn; arg: ExprNode }

export interface ExprOptions {
  /** The letters she may use, one or two: ['x'], ['t'], ['k']. Any other letter is a message naming it. */
  vars: readonly string[]
  /** How to name the variable in a message: "Use x as the variable." */
  varWords?: string
}

export type ExprRead = { ok: true; node: ExprNode; tex: string; used: string[] } | { ok: false; message: string }

class ExprError extends Error {}

function fail(message: string): never {
  throw new ExprError(message)
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Tok =
  | { k: 'num'; v: Q; text: string }
  | { k: 'pi' }
  | { k: 'name'; name: ExprFn }
  | { k: 'var'; name: string }
  | { k: 'op'; op: '+' | '-' | '*' | '/' | '^' }
  | { k: 'lp' }
  | { k: 'rp' }
  | { k: 'inv' }
  | { k: 'deg' }

const FN_WORDS: readonly [string, ExprFn][] = [
  ['arcsin', 'asin'],
  ['arccos', 'acos'],
  ['arctan', 'atan'],
  ['asin', 'asin'],
  ['acos', 'acos'],
  ['atan', 'atan'],
  ['sqrt', 'sqrt'],
  ['abs', 'abs'],
  ['sin', 'sin'],
  ['cos', 'cos'],
  ['tan', 'tan'],
  ['csc', 'csc'],
  ['sec', 'sec'],
  ['cot', 'cot'],
]

/** Glyphs from the keypad and from other keyboards, to the reader's own. */
export function normalizeExprText(raw: string): string {
  return raw
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[º˚]/g, '°')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[   ]/g, ' ')
    .trim()
}

function lettersToTokens(word: string, vars: readonly string[], varWords: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  const lower = word.toLowerCase()
  while (i < lower.length) {
    if (lower.startsWith('pi', i)) {
      out.push({ k: 'pi' })
      i += 2
      continue
    }
    const fn = FN_WORDS.find(([w]) => lower.startsWith(w, i))
    if (fn) {
      out.push({ k: 'name', name: fn[1] })
      i += fn[0].length
      continue
    }
    const c = lower[i]!
    if (c === 'θ') fail('Write the function in terms of its variable, not θ.')
    if (vars.includes(c)) {
      out.push({ k: 'var', name: c })
      i++
      continue
    }
    if (lower.startsWith('inf', i)) fail('∞ is not a number here. Write the function with numbers, π and its variable.')
    if (c === 'e') fail('There is no e in these functions. Use only numbers, π and the trig functions.')
    fail(`I can’t read the letter “${word[i]}” here. ${varWords}`)
  }
  return out
}

function tokenize(s: string, vars: readonly string[], varWords: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '(' || c === '[') {
      toks.push({ k: 'lp' })
      i++
      continue
    }
    if (c === ')' || c === ']') {
      toks.push({ k: 'rp' })
      i++
      continue
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      toks.push({ k: 'op', op: c })
      i++
      continue
    }
    if (c === '⁻' && s[i + 1] === '¹') {
      toks.push({ k: 'inv' })
      i += 2
      continue
    }
    if (c === '°') {
      toks.push({ k: 'deg' })
      i++
      continue
    }
    if (c === 'π') {
      toks.push({ k: 'pi' })
      i++
      continue
    }
    if (c === '√') {
      toks.push({ k: 'name', name: 'sqrt' })
      i++
      continue
    }
    if (c === '|') fail('Write an absolute value as abs( ).')
    if (/[0-9.]/.test(c)) {
      const start = i
      while (i < s.length && /[0-9.]/.test(s[i]!)) i++
      const text = s.slice(start, i)
      if ((text.match(/\./g) ?? []).length > 1 || text === '.') fail('A number has at most one decimal point.')
      let v: Q
      try {
        v = qFromDecimal(text)
      } catch {
        fail('That number is longer than this problem needs.')
      }
      toks.push({ k: 'num', v, text })
      continue
    }
    if (c === ',') fail('Use a decimal point, not a comma, inside a number.')
    if (/[a-zθ]/i.test(c)) {
      const start = i
      while (i < s.length && /[a-zθ]/i.test(s[i]!)) i++
      toks.push(...lettersToTokens(s.slice(start, i), vars, varWords))
      continue
    }
    fail(`I can’t read “${c}” here.`)
  }
  return toks
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const TRIG: ReadonlySet<ExprFn> = new Set(['sin', 'cos', 'tan', 'csc', 'sec', 'cot'])
const INVERSE: Partial<Record<ExprFn, ExprFn>> = { sin: 'asin', cos: 'acos', tan: 'atan' }

function parse(toks: Tok[]): ExprNode {
  let i = 0
  const peek = () => toks[i]
  const startsAtom = (t: Tok | undefined) => !!t && (t.k === 'num' || t.k === 'pi' || t.k === 'var' || t.k === 'lp' || t.k === 'name')

  function expr(): ExprNode {
    let left = term()
    for (;;) {
      const t = peek()
      if (!t || t.k !== 'op' || (t.op !== '+' && t.op !== '-')) return left
      i++
      left = { t: 'add', op: t.op, l: left, r: term() }
    }
  }
  function term(): ExprNode {
    let left = unary()
    for (;;) {
      const t = peek()
      if (t && t.k === 'op' && (t.op === '*' || t.op === '/')) {
        i++
        left = { t: 'mul', op: t.op, l: left, r: unary() }
        continue
      }
      if (startsAtom(t)) {
        if (toks[i - 1]?.k === 'num' && t!.k === 'num') fail('Put an operation between the two numbers.')
        left = { t: 'mul', op: 'implicit', l: left, r: power() }
        continue
      }
      return left
    }
  }
  function unary(): ExprNode {
    const t = peek()
    if (t && t.k === 'op' && (t.op === '-' || t.op === '+')) {
      i++
      const arg = unary()
      return t.op === '-' ? { t: 'neg', arg } : arg
    }
    return power()
  }
  function power(): ExprNode {
    const base = atom()
    const t = peek()
    if (t && t.k === 'op' && t.op === '^') {
      i++
      return { t: 'pow', base, exp: unary() }
    }
    return base
  }
  /** What a function takes when no parenthesis follows its name: the product right after it (sin 2x is sin(2x)). */
  function bareArg(): ExprNode {
    if (!startsAtom(peek()) || peek()!.k === 'name') fail('A function needs its input right after it, like sin(x).')
    let left = power()
    while (startsAtom(peek()) && peek()!.k !== 'name') left = { t: 'mul', op: 'implicit', l: left, r: power() }
    return left
  }
  function atom(): ExprNode {
    const t = peek()
    if (!t) fail('That is unfinished: something is missing at the end.')
    if (t.k === 'deg') fail('These functions use radians: write angles with π and no degree sign.')
    if (t.k === 'num') {
      i++
      if (peek()?.k === 'deg') fail('These functions use radians: write angles with π and no degree sign.')
      return { t: 'num', v: t.v, text: t.text }
    }
    if (t.k === 'pi') {
      i++
      return { t: 'pi' }
    }
    if (t.k === 'var') {
      i++
      return { t: 'var', name: t.name }
    }
    if (t.k === 'lp') {
      i++
      const inner = expr()
      if (peek()?.k !== 'rp') fail('A parenthesis is missing its partner.')
      i++
      return inner
    }
    if (t.k === 'name') {
      i++
      let name = t.name
      // sin⁻¹, sin^-1, sin^(-1): the inverse function.
      const n1 = peek()
      if (n1?.k === 'inv') {
        i++
        name = INVERSE[name] ?? fail('Only sin, cos and tan have inverse keys here: sin⁻¹, cos⁻¹, tan⁻¹.')
      } else if (n1?.k === 'op' && n1.op === '^' && TRIG.has(name)) {
        const a = toks[i + 1]
        const b = toks[i + 2]
        const c = toks[i + 3]
        const d = toks[i + 4]
        if (a?.k === 'op' && a.op === '-' && b?.k === 'num' && b.text === '1') {
          i += 3
          name = INVERSE[name] ?? fail('Only sin, cos and tan have inverse keys here: sin⁻¹, cos⁻¹, tan⁻¹.')
        } else if (a?.k === 'lp' && b?.k === 'op' && b.op === '-' && c?.k === 'num' && c.text === '1' && d?.k === 'rp') {
          i += 5
          name = INVERSE[name] ?? fail('Only sin, cos and tan have inverse keys here: sin⁻¹, cos⁻¹, tan⁻¹.')
        } else {
          fail('Write a power of a trig function after its parenthesis: (sin(x))^2.')
        }
      }
      if (peek()?.k === 'lp') {
        i++
        const inner = expr()
        if (peek()?.k !== 'rp') fail('A parenthesis is missing its partner.')
        i++
        return { t: 'fn', name, arg: inner }
      }
      return { t: 'fn', name, arg: bareArg() }
    }
    if (t.k === 'rp') fail('There is an extra parenthesis.')
    if (t.k === 'inv') fail('⁻¹ goes right after sin, cos or tan.')
    fail('An operation has nothing next to it.')
  }

  const node = expr()
  if (i < toks.length) {
    const extra = peek()
    if (extra?.k === 'rp') fail('There is an extra parenthesis.')
    fail('An operation has nothing next to it.')
  }
  return node
}

function usedVars(node: ExprNode, out = new Set<string>()): Set<string> {
  switch (node.t) {
    case 'var':
      out.add(node.name)
      break
    case 'neg':
    case 'fn':
      usedVars(node.arg, out)
      break
    case 'add':
    case 'mul':
      usedVars(node.l, out)
      usedVars(node.r, out)
      break
    case 'pow':
      usedVars(node.base, out)
      usedVars(node.exp, out)
      break
    default:
      break
  }
  return out
}

/** Read one expression. */
export function readExpr(raw: string, opts: ExprOptions): ExprRead {
  const varWords = opts.varWords ?? (opts.vars.length ? `Use ${opts.vars.join(' and ')}.` : 'Use numbers and π only.')
  try {
    const text = normalizeExprText(raw ?? '')
    if (!text) fail('Type your answer first.')
    const toks = tokenize(text, opts.vars, varWords)
    if (!toks.length) fail('Type your answer first.')
    const node = parse(toks)
    return { ok: true, node, tex: exprTex(node), used: [...usedVars(node)].sort() }
  } catch (e) {
    if (e instanceof ExprError) return { ok: false, message: e.message }
    if (e instanceof TrigOverflow) return { ok: false, message: 'That number is longer than this problem needs.' }
    throw e
  }
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** The value at a point (NaN where it is undefined). */
export function evalExprNum(node: ExprNode, env: Readonly<Record<string, number>>): number {
  switch (node.t) {
    case 'num':
      return node.v.n / node.v.d
    case 'pi':
      return Math.PI
    case 'var':
      return env[node.name] ?? Number.NaN
    case 'neg':
      return -evalExprNum(node.arg, env)
    case 'add': {
      const l = evalExprNum(node.l, env)
      const r = evalExprNum(node.r, env)
      return node.op === '+' ? l + r : l - r
    }
    case 'mul': {
      const l = evalExprNum(node.l, env)
      const r = evalExprNum(node.r, env)
      if (node.op === '/') return r === 0 ? Number.NaN : l / r
      return l * r
    }
    case 'pow': {
      const b = evalExprNum(node.base, env)
      const e = evalExprNum(node.exp, env)
      if (b < 0 && !Number.isInteger(e)) return Number.NaN
      if (b === 0 && e < 0) return Number.NaN
      return b ** e
    }
    case 'fn': {
      const a = evalExprNum(node.arg, env)
      if (!Number.isFinite(a)) return Number.NaN
      const s = Math.sin(a)
      const c = Math.cos(a)
      // Where the bottom is zero to rounding (cos at π/2), there is no value.
      const tiny = (v: number) => Math.abs(v) < 1e-13
      switch (node.name) {
        case 'sin':
          return s
        case 'cos':
          return c
        case 'tan':
          return tiny(c) ? Number.NaN : s / c
        case 'csc':
          return tiny(s) ? Number.NaN : 1 / s
        case 'sec':
          return tiny(c) ? Number.NaN : 1 / c
        case 'cot':
          return tiny(s) ? Number.NaN : c / s
        case 'asin':
          return Math.abs(a) > 1 + 1e-12 ? Number.NaN : Math.asin(Math.max(-1, Math.min(1, a)))
        case 'acos':
          return Math.abs(a) > 1 + 1e-12 ? Number.NaN : Math.acos(Math.max(-1, Math.min(1, a)))
        case 'atan':
          return Math.atan(a)
        case 'sqrt':
          return a < -1e-12 ? Number.NaN : Math.sqrt(Math.max(0, a))
        case 'abs':
          return Math.abs(a)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Exact values
// ---------------------------------------------------------------------------

export type ExactValue = { k: 'exact'; v: TrigExact } | { k: 'undef' } | { k: 'unknown' }

const UNKNOWN: ExactValue = { k: 'unknown' }
const UNDEF: ExactValue = { k: 'undef' }
const ex = (v: TrigExact): ExactValue => ({ k: 'exact', v })

/** The special angles in a principal range, in degrees: where arcsin, arccos and arctan have exact values. */
const PRINCIPAL_DEGREES: Record<'asin' | 'acos' | 'atan', readonly number[]> = {
  asin: [-90, -60, -45, -30, 0, 30, 45, 60, 90],
  acos: [0, 30, 45, 60, 90, 120, 135, 150, 180],
  atan: [-60, -45, -30, 0, 30, 45, 60],
}

const BASE_OF: Record<'asin' | 'acos' | 'atan', TrigFn> = { asin: 'sin', acos: 'cos', atan: 'tan' }

/**
 * The principal value of arcsin, arccos or arctan at an exact number, in degrees: from the special angles of the range
 * (the hand table in values.ts). 'none' outside the domain (arcsin 2); null when the number is not a special value.
 */
export function principalDegrees(fn: 'asin' | 'acos' | 'atan', v: TrigExact): number | 'none' | null {
  const x = exactNum(v)
  if (fn !== 'atan' && Math.abs(x) > 1 + 1e-12) return 'none'
  for (const d of PRINCIPAL_DEGREES[fn]) {
    const val = trigValue(BASE_OF[fn], q(d))
    if (val && val !== 'undefined' && val.c.n === v.c.n && val.c.d === v.c.d && val.root === v.root && val.pi === v.pi) return d
  }
  return null
}

/** The degrees of an exact angle (a rational multiple of π, or zero); null for anything else. */
function degreesOf(v: TrigExact): Q | null {
  if (isZero(v)) return q(0)
  if (v.root !== 1 || v.pi !== 1) return null
  return qMul(v.c, q(180))
}

/** The exact value at an exact point; 'unknown' where it has no exact form here. */
export function evalExprExact(node: ExprNode, env: Readonly<Record<string, TrigExact>>): ExactValue {
  try {
    return exactOf(node, env)
  } catch (e) {
    if (e instanceof TrigOverflow) return UNKNOWN
    throw e
  }
}

function exactOf(node: ExprNode, env: Readonly<Record<string, TrigExact>>): ExactValue {
  switch (node.t) {
    case 'num':
      return ex(exactQ(node.v))
    case 'pi':
      return ex(exactPi(q(1)))
    case 'var': {
      const v = env[node.name]
      return v ? ex(v) : UNKNOWN
    }
    case 'neg': {
      const a = exactOf(node.arg, env)
      return a.k === 'exact' ? ex(exactNeg(a.v)) : a
    }
    case 'add': {
      const l = exactOf(node.l, env)
      const r = exactOf(node.r, env)
      if (l.k === 'undef' || r.k === 'undef') return UNDEF
      if (l.k !== 'exact' || r.k !== 'exact') return UNKNOWN
      const sum = exactAdd(l.v, node.op === '+' ? r.v : exactNeg(r.v))
      return sum ? ex(sum) : UNKNOWN
    }
    case 'mul': {
      const l = exactOf(node.l, env)
      const r = exactOf(node.r, env)
      if (l.k === 'undef' || r.k === 'undef') return UNDEF
      if (node.op === '/' && r.k === 'exact' && isZero(r.v)) return UNDEF
      if (l.k !== 'exact' || r.k !== 'exact') return UNKNOWN
      return ex(node.op === '/' ? exactDiv(l.v, r.v) : exactMul(l.v, r.v))
    }
    case 'pow': {
      const b = exactOf(node.base, env)
      const e = exactOf(node.exp, env)
      if (b.k === 'undef' || e.k === 'undef') return UNDEF
      if (b.k !== 'exact' || e.k !== 'exact') return UNKNOWN
      if (e.v.root !== 1 || e.v.pi !== 0) return UNKNOWN
      const k = e.v.c
      if (k.d === 1) {
        if (Math.abs(k.n) > 12) return UNKNOWN
        if (isZero(b.v) && k.n < 0) return UNDEF
        return ex(exactPow(b.v, k.n))
      }
      if (k.d === 2 && Math.abs(k.n) === 1) {
        if (exactNum(b.v) < 0) return UNDEF
        const root = exactSqrt(b.v)
        if (!root) return UNKNOWN
        if (k.n < 0) return isZero(root) ? UNDEF : ex(exactDiv(exactInt(1), root))
        return ex(root)
      }
      return UNKNOWN
    }
    case 'fn': {
      const a = exactOf(node.arg, env)
      if (a.k !== 'exact') return a
      switch (node.name) {
        case 'sin':
        case 'cos':
        case 'tan':
        case 'csc':
        case 'sec':
        case 'cot': {
          const deg = degreesOf(a.v)
          if (!deg) return UNKNOWN
          const v = trigValue(node.name, deg)
          if (v === null) return UNKNOWN
          return v === 'undefined' ? UNDEF : ex(v)
        }
        case 'asin':
        case 'acos':
        case 'atan': {
          const d = principalDegrees(node.name, a.v)
          if (d === 'none') return UNDEF
          if (d === null) return UNKNOWN
          return ex(exactPi(qDiv(q(d), q(180))))
        }
        case 'sqrt': {
          if (exactNum(a.v) < 0) return UNDEF
          const r = exactSqrt(a.v)
          return r ? ex(r) : UNKNOWN
        }
        case 'abs':
          return ex(exactAbs(a.v))
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The same function
// ---------------------------------------------------------------------------

export interface SameFunctionCheck {
  /** The variable's name in both trees. */
  variable: string
  /** Points where both are worked out exactly (the key points); a value that has no exact form here is compared as a number. */
  exactAt: readonly TrigExact[]
  /** Points where both are compared as numbers (over two periods, or across the domain). */
  samples: readonly number[]
}

const closeNum = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))

/**
 * Are two functions the same, as functions: exactly equal at every exact point (both undefined counts as equal), and
 * equal as numbers at every sample (both undefined counts as equal)?
 */
export function sameFunction(a: ExprNode, b: ExprNode, check: SameFunctionCheck): boolean {
  for (const p of check.exactAt) {
    const env = { [check.variable]: p }
    const va = evalExprExact(a, env)
    const vb = evalExprExact(b, env)
    if (va.k === 'exact' && vb.k === 'exact') {
      const d = va.v
      const e = vb.v
      if (!(d.c.n === e.c.n && d.c.d === e.c.d && d.root === e.root && d.pi === e.pi)) return false
      continue
    }
    if (va.k === 'undef' || vb.k === 'undef') {
      if (va.k !== vb.k) {
        // One is undefined exactly, the other is not known exactly: compare as numbers.
        const na = evalExprNum(a, { [check.variable]: exactNum(p) })
        const nb = evalExprNum(b, { [check.variable]: exactNum(p) })
        if (Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na) < 1e9 && Math.abs(nb) < 1e9) return false
      }
      continue
    }
    const na = evalExprNum(a, { [check.variable]: exactNum(p) })
    const nb = evalExprNum(b, { [check.variable]: exactNum(p) })
    if (Number.isNaN(na) !== Number.isNaN(nb)) return false
    if (!Number.isNaN(na) && !closeNum(na, nb)) return false
  }
  for (const x of check.samples) {
    const na = evalExprNum(a, { [check.variable]: x })
    const nb = evalExprNum(b, { [check.variable]: x })
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      if (Number.isNaN(na) !== Number.isNaN(nb)) return false
      continue
    }
    if (!closeNum(na, nb)) return false
  }
  return true
}

/** Close as numbers at the samples (to a hundredth of the size), but not equal: a decimal in place of π, say. */
export function nearlySameFunction(a: ExprNode, b: ExprNode, samples: readonly number[], variable: string): boolean {
  let compared = 0
  for (const x of samples) {
    const na = evalExprNum(a, { [variable]: x })
    const nb = evalExprNum(b, { [variable]: x })
    if (Number.isNaN(na) || Number.isNaN(nb)) continue
    compared++
    if (Math.abs(na - nb) > 0.01 * Math.max(1, Math.abs(nb))) return false
  }
  return compared > 0
}

/** Does the tree use a trig function or an inverse one (an algebraic answer has none)? */
export function hasTrigFunction(node: ExprNode): boolean {
  switch (node.t) {
    case 'fn':
      return (node.name !== 'sqrt' && node.name !== 'abs') || hasTrigFunction(node.arg)
    case 'neg':
      return hasTrigFunction(node.arg)
    case 'add':
    case 'mul':
      return hasTrigFunction(node.l) || hasTrigFunction(node.r)
    case 'pow':
      return hasTrigFunction(node.base) || hasTrigFunction(node.exp)
    default:
      return false
  }
}

/** Does the tree contain a decimal written with a point (3.14, 0.5)? */
export function hasDecimal(node: ExprNode): boolean {
  switch (node.t) {
    case 'num':
      return node.text.includes('.')
    case 'neg':
    case 'fn':
      return hasDecimal(node.arg)
    case 'add':
    case 'mul':
      return hasDecimal(node.l) || hasDecimal(node.r)
    case 'pow':
      return hasDecimal(node.base) || hasDecimal(node.exp)
    default:
      return false
  }
}

/** Evenly spread points over [lo, hi], none on a special point: (i + 0.382)/n of the way. */
export function spreadSamples(lo: number, hi: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * (i + 0.381966)) / n)
}

// ---------------------------------------------------------------------------
// KaTeX
// ---------------------------------------------------------------------------

const FN_TEX: Record<ExprFn, string> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  csc: '\\csc',
  sec: '\\sec',
  cot: '\\cot',
  asin: '\\sin^{-1}',
  acos: '\\cos^{-1}',
  atan: '\\tan^{-1}',
  sqrt: '',
  abs: '',
}

const wrap = (s: string) => `\\left(${s}\\right)`

/** KaTeX of what she typed, every function's input in parentheses so she sees how it was read. */
export function exprTex(node: ExprNode): string {
  switch (node.t) {
    case 'num':
      return node.text
    case 'pi':
      return '\\pi'
    case 'var':
      return node.name
    case 'neg': {
      const inner = exprTex(node.arg)
      return `-${node.arg.t === 'add' || node.arg.t === 'neg' ? wrap(inner) : inner}`
    }
    case 'add': {
      const r = exprTex(node.r)
      return `${exprTex(node.l)} ${node.op} ${node.r.t === 'neg' || (node.op === '-' && node.r.t === 'add') ? wrap(r) : r}`
    }
    case 'mul': {
      if (node.op === '/') return `\\frac{${exprTex(node.l)}}{${exprTex(node.r)}}`
      const l = node.l.t === 'add' || node.l.t === 'neg' ? wrap(exprTex(node.l)) : exprTex(node.l)
      const r = node.r.t === 'add' || node.r.t === 'neg' ? wrap(exprTex(node.r)) : exprTex(node.r)
      const dot = node.op === '*' || (/\d$/.test(l) && /^\d/.test(r))
      return `${l}${dot ? ' \\cdot ' : ' '}${r}`
    }
    case 'pow': {
      const b = node.base.t === 'num' || node.base.t === 'pi' || node.base.t === 'var' ? exprTex(node.base) : wrap(exprTex(node.base))
      return `${b}^{${exprTex(node.exp)}}`
    }
    case 'fn':
      if (node.name === 'sqrt') return `\\sqrt{${exprTex(node.arg)}}`
      if (node.name === 'abs') return `\\left|${exprTex(node.arg)}\\right|`
      return `${FN_TEX[node.name]}${wrap(exprTex(node.arg))}`
  }
}

// ---------------------------------------------------------------------------
// An equation: y = …, h(t) = …
// ---------------------------------------------------------------------------

export interface FunctionAnswerOptions {
  /** The variable: x for a graph, t for a model. */
  variable: string
  /** May she leave out the left side ("3sin(2x) + 1")? An expression part says yes; an equation part too. */
  allowBare: boolean
}

export type FunctionRead = { ok: true; node: ExprNode; tex: string; name: string | null } | { ok: false; message: string }

/** "y", "f(x)", "h(t)", "h", "T(t)": a name for the function, not the variable itself. */
function nameOf(side: string, variable: string): string | null {
  const m = /^([A-Za-z])\s*(?:\(\s*([A-Za-z])\s*\))?$/.exec(side.trim())
  if (!m) return null
  if (m[2] && m[2].toLowerCase() !== variable) return null
  // The variable alone is not a name; a capital is (T(t) for a temperature, T = … too).
  if (m[1] === variable && !m[2]) return null
  return m[1]!
}

/** Read her function: an equation with a name on one side, or (when allowed) the expression alone. */
export function readFunctionAnswer(raw: string, opts: FunctionAnswerOptions): FunctionRead {
  const text = normalizeExprText(raw ?? '')
  if (!text) return { ok: false, message: 'Type your answer first.' }
  const sides = text.split('=')
  let body = text
  let name: string | null = null
  if (sides.length > 2) return { ok: false, message: 'Write one equals sign: the function’s name, =, then its formula.' }
  if (sides.length === 2) {
    const [l, r] = [sides[0]!.trim(), sides[1]!.trim()]
    if (!l || !r) return { ok: false, message: 'Something is missing on one side of the equals sign.' }
    const ln = nameOf(l, opts.variable)
    const rn = nameOf(r, opts.variable)
    if (ln) {
      name = ln
      body = r
    } else if (rn) {
      name = rn
      body = l
    } else if (new RegExp(`^${opts.variable}$`, 'i').test(l)) {
      return { ok: false, message: `Solve for the function, not for ${opts.variable}: write it as y = a formula in ${opts.variable}.` }
    } else {
      return { ok: false, message: `Write it as a name, an equals sign and a formula in ${opts.variable}: y = …` }
    }
  } else if (!opts.allowBare) {
    return { ok: false, message: `Write the whole equation: a name, an equals sign and a formula in ${opts.variable}.` }
  }
  const r = readExpr(body, { vars: [opts.variable], varWords: `The variable here is ${opts.variable}.` })
  if (!r.ok) return r
  if (!r.used.includes(opts.variable)) return { ok: false, message: `Your formula has no ${opts.variable} in it, so its graph is a flat line. Write it in terms of ${opts.variable}.` }
  return { ok: true, node: r.node, tex: name ? `${name === 'y' ? 'y' : `${name}(${opts.variable})`} = ${r.tex}` : r.tex, name }
}

/** Zero, for callers that need an exact zero without importing exact.ts. */
export const EXPR_ZERO: TrigExact = EXACT_ZERO

/** An exact number as a plain value for the env of evalExprExact: c·π^k. */
export function exactAt(c: Q, pi = 0): TrigExact {
  return tx(c, 1, pi)
}
