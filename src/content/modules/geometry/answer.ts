/**
 * One reader for every geometry answer: integers, fractions, decimals, "x = 7", degrees,
 * simplest radicals, multiples of π, and points. Call `normalizeInput` first (the symbol strip's √
 * becomes sqrt and π becomes pi). An equal value that is not in simplest form is still read; the
 * grader treats that as not an attempt. Nonsense is `ok: false` with a message.
 *
 * Unit 9 adds π (a circumference of 10π, an area of 25π) and, only where a part allows it, a sum of
 * unlike terms (a segment of a circle with area 4π − 8).
 */
import { normalizeInput } from '@/engine'
import { rat, ratToString } from '@/notation'

/**
 * A rational times √rad, and times π when `pi` is 1. `rad` is a square-free integer, and 1 means no
 * radical. `pi` is left off every quantity that has no π, so a length of Units 1 to 8 is unchanged.
 */
export interface GeoQty {
  n: number
  d: number
  rad: number
  pi?: 1
}

export type GeoValue =
  | { kind: 'qty'; q: GeoQty }
  | { kind: 'point'; x: GeoQty; y: GeoQty }
  /** Two or more unlike terms, none zero, in the order of `geoSum`. Read only where the part allows a sum. */
  | { kind: 'sum'; terms: GeoQty[] }
  | { kind: 'none' }
  | { kind: 'undefined' }

export type GeoRead =
  | {
      ok: true
      value: GeoValue
      simplest: boolean
      note?: string
      /** She typed a degree sign or the word degrees. */
      degrees?: boolean
      /** She typed a decimal point. */
      decimal?: boolean
    }
  | { ok: false; message: string }

export interface GeoReadOptions {
  /** Accept the words none / undefined. Off unless the question allows them. */
  allowNone?: boolean
  allowUndefined?: boolean
  /** Read a ratio written "2:3" or "2 to 3" as the number 2/3 (a scale factor). Off unless the part is a ratio. */
  ratio?: boolean
  /** Read unlike terms added or subtracted (4π − 8) as one value. Off unless the part's answer is such a sum. */
  sum?: boolean
}

type Flags = { denom: boolean; perfect: boolean; square: boolean; unreduced: boolean; sum: boolean; product: boolean }

type Node =
  | { t: 'n'; n: number; d: number }
  | { t: 'pi' }
  | { t: 'sqrt'; arg: Node }
  | { t: 'neg'; arg: Node }
  | { t: 'add'; op: '+' | '-'; l: Node; r: Node }
  | { t: 'mul'; op: '*' | '/'; l: Node; r: Node }

type Tok =
  | { k: 'n'; n: number; d: number }
  | { k: 'sqrt' }
  | { k: 'pi' }
  | { k: 'op'; op: '+' | '-' | '*' | '/' }
  | { k: 'lp' | 'rp' | 'comma' }

const NUMBER_HINT = 'Type an integer, a fraction, a decimal, or a simplest radical like 2√3.'
const SINGLE = 'Write a single number: an integer, a fraction, or a number times one square root.'

/** (n/d)·√rad, simplified, times π when `pi` is true. */
export function geoQty(n: number, d: number, rad: number, pi = false): GeoQty {
  const q = simplifyRadical(n, d, rad)
  return pi && q.n !== 0 ? { ...q, pi: 1 } : q
}

export function sameQty(a: GeoQty, b: GeoQty): boolean {
  return a.n === b.n && a.d === b.d && a.rad === b.rad && (a.pi ?? 0) === (b.pi ?? 0)
}

export function sameGeoValue(a: GeoValue, b: GeoValue): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'qty' && b.kind === 'qty') return sameQty(a.q, b.q)
  if (a.kind === 'point' && b.kind === 'point') return sameQty(a.x, b.x) && sameQty(a.y, b.y)
  if (a.kind === 'sum' && b.kind === 'sum') return a.terms.length === b.terms.length && a.terms.every((t, i) => sameQty(t, b.terms[i]!))
  return true
}

/** The decimal value, for "is this calculator decimal near the exact answer" and for drawing. Never for grading. */
export function approxQty(q: GeoQty): number {
  return (q.n / q.d) * Math.sqrt(q.rad) * (q.pi ? Math.PI : 1)
}

/** The decimal value of a quantity or a sum; null for a point or a word. */
export function approxValue(v: GeoValue): number | null {
  if (v.kind === 'qty') return approxQty(v.q)
  if (v.kind === 'sum') return v.terms.reduce((s, t) => s + approxQty(t), 0)
  return null
}

/**
 * "3√5", "√5/2", "(3√5)/2", "7", "6π", "(3π)/2", "6π√2". "−3" uses an ASCII hyphen so it matches
 * what she types.
 */
export function formatQty(q: GeoQty): string {
  if (q.rad === 1 && !q.pi) return ratToString(rat(q.n, q.d))
  const negative = q.n < 0
  const an = Math.abs(q.n)
  const symbols = `${q.pi ? 'π' : ''}${q.rad === 1 ? '' : `√${q.rad}`}`
  const body = an === 1 ? symbols : `${an}${symbols}`
  if (q.d === 1) return `${negative ? '-' : ''}${body}`
  if (negative) return `-(${body})/${q.d}`
  if (an === 1) return `${symbols}/${q.d}`
  return `(${body})/${q.d}`
}

export function formatPoint(x: GeoQty, y: GeoQty): string {
  return `(${formatQty(x)}, ${formatQty(y)})`
}

/** "4π - 8", "6π - 9√3", "16 - 4π": what is added first, then what is taken away. */
function formatSum(terms: readonly GeoQty[]): string {
  const ordered = [...terms.filter((t) => t.n > 0), ...terms.filter((t) => t.n < 0)]
  return ordered
    .map((t, i) => {
      if (i === 0) return formatQty(t)
      return t.n < 0 ? `- ${formatQty({ ...t, n: -t.n })}` : `+ ${formatQty(t)}`
    })
    .join(' ')
}

export function formatValue(v: GeoValue): string {
  if (v.kind === 'qty') return formatQty(v.q)
  if (v.kind === 'point') return formatPoint(v.x, v.y)
  if (v.kind === 'sum') return formatSum(v.terms)
  return v.kind
}

/**
 * Terms added together as one value: like terms are combined and a zero is dropped. One term left (or none)
 * is a quantity; two or more are a sum, π terms first, then the plain number, then radicals from the smallest
 * radicand up. A term taken away is given with a negative `n`.
 */
export function geoSum(terms: readonly GeoQty[]): GeoValue {
  const out = collect(terms.map((t) => ({ n: t.n, d: t.d, rad: t.rad, p: t.pi ?? 0 }))).map(toQty)
  if (out.length <= 1) return { kind: 'qty', q: out[0] ?? { n: 0, d: 1, rad: 1 } }
  return { kind: 'sum', terms: out }
}

/** Pull square factors out of rad and reduce the rational coefficient. rad >= 0. */
export function simplifyRadical(n: number, d: number, rad: number): GeoQty {
  if (!Number.isInteger(n) || !Number.isInteger(d) || !Number.isInteger(rad)) {
    throw new Error('simplifyRadical needs integers')
  }
  if (d === 0) throw new Error('zero denominator')
  if (rad < 0) throw new Error('negative radicand')
  if (rad === 0 || n === 0) return { n: 0, d: 1, rad: 1 }
  let coeff = n
  let r = rad
  let f = 2
  while (f * f <= r) {
    const square = f * f
    while (r % square === 0) {
      r /= square
      coeff *= f
    }
    f += f === 2 ? 1 : 2
  }
  const reduced = rat(coeff, d)
  return { n: reduced.n, d: reduced.d, rad: r === 0 ? 1 : r }
}

function isSquareFree(n: number): boolean {
  if (n < 2) return false
  let f = 2
  while (f * f <= n) {
    if (n % (f * f) === 0) return false
    f += f === 2 ? 1 : 2
  }
  return true
}

function isPerfectSquare(n: number): boolean {
  if (n < 0) return false
  const s = Math.round(Math.sqrt(n))
  return s * s === n
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

export function readGeoAnswer(raw: string, opts: GeoReadOptions = {}): GeoRead {
  const prepared = prepare(raw, opts.ratio === true)
  if (!prepared.ok) return prepared
  const word = prepared.text.replace(/[.]$/, '').toLowerCase()
  if (word === 'none' || word === 'undefined') {
    if (word === 'none' && opts.allowNone) return { ok: true, value: { kind: 'none' }, simplest: true }
    if (word === 'undefined' && opts.allowUndefined) return { ok: true, value: { kind: 'undefined' }, simplest: true }
    const said = word === 'none' ? 'none' : 'undefined'
    return { ok: false, message: `This part asks for a number. “${said}” is not a value here.` }
  }
  const typed = {
    ...(prepared.degrees ? { degrees: true } : {}),
    ...(/\d\.\d|(?:^|[^\d])\.\d/.test(prepared.text) ? { decimal: true } : {}),
  }
  const point = splitPoint(prepared.text)
  if (point === 'bad') return { ok: false, message: 'A point has two coordinates, written (x, y).' }
  if (!point && !prepared.text.startsWith('(') && prepared.text.includes(',')) {
    return { ok: false, message: 'Write a point with parentheses around it, as (x, y).' }
  }
  if (point) {
    const x = readQty(point[0])
    if (!x.ok) return x
    const y = readQty(point[1])
    if (!y.ok) return y
    if (x.terms.length > 1 || y.terms.length > 1) return { ok: false, message: SINGLE }
    const simplest = x.simplest && y.simplest
    const note = !x.simplest ? x.note : !y.simplest ? y.note : undefined
    return { ok: true, value: { kind: 'point', x: one(x.terms), y: one(y.terms) }, simplest, ...(note ? { note } : {}), ...typed }
  }
  const qty = readQty(prepared.text)
  if (!qty.ok) return qty
  const rest = { simplest: qty.simplest, ...(qty.note ? { note: qty.note } : {}), ...typed }
  if (qty.terms.length <= 1) return { ok: true, value: { kind: 'qty', q: one(qty.terms) }, ...rest }
  if (!opts.sum) return { ok: false, message: SINGLE }
  return { ok: true, value: { kind: 'sum', terms: qty.terms }, ...rest }
}

/** The one term of a value that has at most one; no term is zero. */
function one(terms: readonly GeoQty[]): GeoQty {
  return terms[0] ?? { n: 0, d: 1, rad: 1 }
}

type Prepared = { ok: true; text: string; degrees: boolean } | { ok: false; message: string }

/**
 * A name before the value: one letter ("x = 7", "a = 64"), a segment or angle name ("AB = 15"), or a
 * measure ("m∠1 = 26", "∠ABD = 40"). An equation such as "2x = 12" is not a name and is not read.
 */
const NAMED = /^(?:[A-Za-z]|[A-Z]{2,3}|(?:m\s*)?∠\s*(?:[A-Z]{1,3}|\d))\s*=\s*(.*)$/

/** "2:3", "2 : 3", "2 to 3": one ratio sign between two numbers. */
const RATIO = /^([^:∶]+?)\s*(?:[:∶]|\bto\b)\s*([^:∶]+)$/i

function prepare(raw: string, ratio = false): Prepared {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, message: 'Type an answer first.' }
  const normalized = normalizeInput(trimmed)
  const degrees = /°|\b(?:degrees|degree|deg)\b/i.test(normalized)
  let s = normalized.replace(/°/g, '')
  s = s.replace(/\s*(?:degrees|degree|deg)\b/gi, '').trim()
  if (!s) return { ok: false, message: 'Type an answer first.' }
  const assigned = NAMED.exec(s)
  if (assigned) {
    s = assigned[1]!.trim()
    if (!s) return { ok: false, message: 'Type the number after the equals sign.' }
  }
  if (ratio) {
    // A textbook writes a scale factor 2:3 as often as 2/3. Both read as the same number.
    const parts = RATIO.exec(s)
    if (parts) s = `(${parts[1]!.trim()})/(${parts[2]!.trim()})`
  }
  return { ok: true, text: s, degrees }
}

/** A top-level comma inside one pair of parentheses, or null when this is not a point. */
function splitPoint(s: string): [string, string] | 'bad' | null {
  if (!s.startsWith('(') || !s.endsWith(')')) return null
  const inner = s.slice(1, -1)
  let depth = 0
  let comma = -1
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth < 0) return null
    } else if (c === ',' && depth === 0) {
      if (comma >= 0) return 'bad'
      comma = i
    }
  }
  if (comma < 0 || depth !== 0) return null
  const left = inner.slice(0, comma).trim()
  const right = inner.slice(comma + 1).trim()
  if (!left || !right) return 'bad'
  return [left, right]
}

/** `terms` holds no zero and no two like terms: none for zero, one for a single number, more for a sum. */
type QtyRead = { ok: true; terms: GeoQty[]; simplest: boolean; note?: string } | { ok: false; message: string }

function readQty(text: string): QtyRead {
  const parsed = parseExpr(text)
  if (!parsed.ok) return parsed
  const value = evalNode(parsed.node)
  if (!value.ok) return value
  for (const t of value.v) {
    if (t.p < 0) return { ok: false, message: 'π in the denominator is not a form we can check here. Write a number times π.' }
    if (t.p > 1) return { ok: false, message: 'π times π is not a value this course uses. Write a number times one π.' }
  }
  const terms = value.v.map(toQty)
  const flags: Flags = { denom: false, perfect: false, square: false, unreduced: false, sum: false, product: false }
  inspect(parsed.node, flags)
  for (const top of topTerms(parsed.node)) {
    const content = radicalContent(top)
    if (content && content.radical && gcd(content.num, content.den) > 1) flags.unreduced = true
  }
  if (treeHasSqrt(parsed.node) && terms.every((t) => t.rad === 1)) flags.perfect = true
  const simplest = !flags.denom && !flags.perfect && !flags.square && !flags.unreduced && !flags.sum && !flags.product
  if (simplest) return { ok: true, terms, simplest: true }
  return { ok: true, terms, simplest: false, note: simplifyNote(text.trim(), flags, terms.length) }
}

/** What to fix, never the simplified value: when her value is right, that value is the answer. */
function simplifyNote(input: string, flags: Flags, count: number): string {
  const shown = input.replace(/sqrt/g, '√').replace(/pi/gi, 'π')
  if (flags.denom) return `${shown} has a square root in the denominator, which is not simplest form. Rationalize the denominator.`
  if (flags.perfect) return `${shown} has a perfect square under the radical. Write it as a number, with no radical left.`
  if (flags.square) return `${shown} is not simplest radical form. Take every perfect-square factor out of the radical.`
  if (flags.unreduced) return `${shown} is not simplest form. Reduce the number in front of ${/sqrt/.test(input) ? 'the radical' : 'π'}.`
  if (flags.product) return `${shown} is not simplest form. Multiply the radicals into one radical.`
  if (count > 1) return `${shown} is not simplest form. Combine the like terms.`
  return `${shown} is not simplest form. Write it as a single term.`
}

function treeHasSqrt(node: Node): boolean {
  if (node.t === 'sqrt') return true
  if (node.t === 'n' || node.t === 'pi') return false
  if (node.t === 'neg') return treeHasSqrt(node.arg)
  return treeHasSqrt(node.l) || treeHasSqrt(node.r)
}

/** The terms of a sum as she wrote them: "6π - 9√3" is 6π and 9√3. Anything else is its own one term. */
function topTerms(node: Node): Node[] {
  return node.t === 'add' ? [...topTerms(node.l), ...topTerms(node.r)] : [node]
}

function inspect(node: Node, flags: Flags): void {
  if (node.t === 'sqrt') {
    const arg = evalNode(node.arg)
    if (arg.ok) markSqrt(arg.v[0] ?? { n: 0, d: 1, rad: 1, p: 0 }, flags)
    inspect(node.arg, flags)
    return
  }
  if (node.t === 'neg') {
    inspect(node.arg, flags)
    return
  }
  if (node.t === 'n' || node.t === 'pi') return
  if (node.t === 'mul' && node.op === '/' && treeHasSqrt(node.r)) flags.denom = true
  if (node.t === 'mul' && node.op === '*' && treeHasSqrt(node.l) && treeHasSqrt(node.r)) flags.product = true
  if (node.t === 'add') {
    // Two like terms left uncombined (2√3 + 3√3, 2π + 4π, 2 + 3). Unlike terms are a sum, which may be simplest.
    const l = evalNode(node.l)
    const r = evalNode(node.r)
    if (l.ok && r.ok && collect([...l.v, ...r.v]).length < l.v.length + r.v.length) flags.sum = true
  }
  inspect(node.l, flags)
  inspect(node.r, flags)
}

function markSqrt(arg: Term, flags: Flags): void {
  if (arg.rad !== 1 || arg.d !== 1 || arg.n < 2 || isPerfectSquare(arg.n) || !isSquareFree(arg.n)) {
    if (arg.rad === 1 && arg.d === 1 && arg.n >= 0 && isPerfectSquare(arg.n)) flags.perfect = true
    else flags.square = true
  }
}

/** Written integer numerator and denominator, before canceling, plus whether a radical or π is present. */
function radicalContent(node: Node): { num: number; den: number; radical: boolean } | null {
  if (node.t === 'n') return { num: node.n, den: node.d, radical: false }
  if (node.t === 'pi') return { num: 1, den: 1, radical: true }
  if (node.t === 'neg') {
    const c = radicalContent(node.arg)
    return c ? { num: -c.num, den: c.den, radical: c.radical } : null
  }
  if (node.t === 'sqrt') {
    if (node.arg.t === 'n' && node.arg.d === 1 && node.arg.n >= 0) return { num: 1, den: 1, radical: true }
    return null
  }
  if (node.t === 'add') return null
  const l = radicalContent(node.l)
  const r = radicalContent(node.r)
  if (!l || !r) return null
  if (node.op === '*') return { num: l.num * r.num, den: l.den * r.den, radical: l.radical || r.radical }
  return { num: l.num * r.den, den: l.den * r.num, radical: l.radical || r.radical }
}

/** One term while a value is worked out: (n/d)·√rad·π^p. `p` may pass through 2 or −1; a finished value has 0 or 1. */
interface Term {
  n: number
  d: number
  rad: number
  p: number
}

function toQty(t: Term): GeoQty {
  return t.p === 1 ? { n: t.n, d: t.d, rad: t.rad, pi: 1 } : { n: t.n, d: t.d, rad: t.rad }
}

/** (n/d)·√rad·π^p simplified, as a list: empty when it is zero. */
function mk(n: number, d: number, rad: number, p: number): Term[] {
  const s = simplifyRadical(n, d, rad)
  return s.n === 0 ? [] : [{ n: s.n, d: s.d, rad: s.rad, p }]
}

/** Like terms combined, zeros dropped, in a fixed order: π first, then the plain number, then radicals. */
function collect(terms: readonly Term[]): Term[] {
  const out: Term[] = []
  for (const t of terms) {
    if (t.n === 0) continue
    const at = out.findIndex((o) => o.rad === t.rad && o.p === t.p)
    if (at < 0) {
      out.push({ ...t })
      continue
    }
    const o = out[at]!
    const sum = rat(o.n * t.d + t.n * o.d, o.d * t.d)
    if (sum.n === 0) out.splice(at, 1)
    else out[at] = { ...o, n: sum.n, d: sum.d }
  }
  return out.sort((a, b) => b.p - a.p || a.rad - b.rad)
}

type Eval = { ok: true; v: Term[] } | { ok: false; message: string }

function evalNode(node: Node): Eval {
  if (node.t === 'n') return { ok: true, v: mk(node.n, node.d, 1, 0) }
  if (node.t === 'pi') return { ok: true, v: [{ n: 1, d: 1, rad: 1, p: 1 }] }
  if (node.t === 'neg') {
    const v = evalNode(node.arg)
    if (!v.ok) return v
    return { ok: true, v: v.v.map((t) => ({ ...t, n: -t.n })) }
  }
  if (node.t === 'sqrt') {
    const v = evalNode(node.arg)
    if (!v.ok) return v
    if (v.v.length > 1) return { ok: false, message: SINGLE }
    const t = v.v[0]
    if (!t) return { ok: true, v: [] }
    if (t.p !== 0) return { ok: false, message: 'A square root of π is not a value we can check. Write a number times π.' }
    if (t.rad !== 1) return { ok: false, message: 'A square root inside a square root is not a length we can check. Write one radical.' }
    if (t.n < 0) return { ok: false, message: 'A square root of a negative number is not a length in this course.' }
    return { ok: true, v: mk(1, t.d, t.n * t.d, 0) }
  }
  const l = evalNode(node.l)
  if (!l.ok) return l
  const r = evalNode(node.r)
  if (!r.ok) return r
  if (node.t === 'add') {
    const right = node.op === '-' ? r.v.map((t) => ({ ...t, n: -t.n })) : r.v
    return { ok: true, v: collect([...l.v, ...right]) }
  }
  if (node.op === '*') {
    return { ok: true, v: collect(l.v.flatMap((a) => r.v.flatMap((b) => mk(a.n * b.n, a.d * b.d, a.rad * b.rad, a.p + b.p)))) }
  }
  if (r.v.length === 0) return { ok: false, message: 'Division by zero is not a number.' }
  if (r.v.length > 1) return { ok: false, message: 'A sum in the denominator is not a form we can check. Write the answer as separate terms.' }
  const b = r.v[0]!
  return { ok: true, v: collect(l.v.flatMap((a) => mk(a.n * b.d, a.d * b.n * b.rad, a.rad * b.rad, a.p - b.p))) }
}

type Parse = { ok: true; node: Node } | { ok: false; message: string }

function parseExpr(text: string): Parse {
  let toks: Tok[]
  try {
    toks = tokenize(text)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : NUMBER_HINT }
  }
  if (toks.length === 0) return { ok: false, message: 'Type an answer first.' }
  let i = 0
  const peek = () => toks[i]
  function parseAdd(): Node {
    let left = parseMul()
    for (;;) {
      const op = peek()
      if (!op || op.k !== 'op' || (op.op !== '+' && op.op !== '-')) break
      i++
      left = { t: 'add', op: op.op, l: left, r: parseMul() }
    }
    return left
  }
  function startsFactor(tok: Tok | undefined): boolean {
    return !!tok && (tok.k === 'n' || tok.k === 'sqrt' || tok.k === 'pi' || tok.k === 'lp')
  }
  function parseMul(): Node {
    let left = parseFactor()
    for (;;) {
      const op = peek()
      if (op && op.k === 'op' && (op.op === '*' || op.op === '/')) {
        i++
        left = { t: 'mul', op: op.op, l: left, r: parseFactor() }
        continue
      }
      if (startsFactor(op)) {
        left = { t: 'mul', op: '*', l: left, r: parseFactor() }
        continue
      }
      break
    }
    return left
  }
  function parseFactor(): Node {
    const tok = peek()
    if (!tok) fail('That expression is unfinished.')
    if (tok.k === 'op' && (tok.op === '+' || tok.op === '-')) {
      i++
      const arg = parseFactor()
      return tok.op === '-' ? { t: 'neg', arg } : arg
    }
    if (tok.k === 'sqrt') {
      i++
      return { t: 'sqrt', arg: parseFactor() }
    }
    if (tok.k === 'pi') {
      i++
      return { t: 'pi' }
    }
    if (tok.k === 'lp') {
      i++
      const inner = parseAdd()
      if (peek()?.k !== 'rp') fail('A parenthesis is missing its partner.')
      i++
      return inner
    }
    if (tok.k === 'n') {
      i++
      return { t: 'n', n: tok.n, d: tok.d }
    }
    fail(NUMBER_HINT)
  }
  function fail(message: string): never {
    throw new ParseError(message)
  }
  try {
    const node = parseAdd()
    if (i < toks.length) {
      const extra = peek()
      if (extra?.k === 'rp') return { ok: false, message: 'There is an extra parenthesis.' }
      return { ok: false, message: NUMBER_HINT }
    }
    return { ok: true, node }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, message: e.message }
    throw e
  }
}

class ParseError extends Error {}

function tokenize(text: string): Tok[] {
  const s = text.trim()
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '(') {
      toks.push({ k: 'lp' })
      i++
      continue
    }
    if (c === ')') {
      toks.push({ k: 'rp' })
      i++
      continue
    }
    if (c === ',') {
      toks.push({ k: 'comma' })
      i++
      continue
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      toks.push({ k: 'op', op: c })
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      const start = i
      i++
      let dots = c === '.' ? 1 : 0
      while (i < s.length && /[0-9.]/.test(s[i]!)) {
        if (s[i] === '.') dots++
        i++
      }
      const raw = s.slice(start, i)
      if (dots > 1 || raw === '.') throw new ParseError(NUMBER_HINT)
      toks.push({ k: 'n', ...numberToken(raw) })
      continue
    }
    if (/[a-z]/i.test(c)) {
      const start = i
      i++
      while (i < s.length && /[a-z]/i.test(s[i]!)) i++
      const word = s.slice(start, i).toLowerCase()
      if (word === 'x') throw new ParseError('Write the value, not an expression that still has x in it.')
      // A run of letters is made of the two names the reader knows: "pisqrt" is π·√, as in 6π√2.
      const names: Tok[] = []
      let rest = word
      while (rest) {
        if (rest.startsWith('sqrt')) {
          names.push({ k: 'sqrt' })
          rest = rest.slice(4)
        } else if (rest.startsWith('pi')) {
          names.push({ k: 'pi' })
          rest = rest.slice(2)
        } else {
          throw new ParseError(`I can’t read “${s.slice(start, i)}”. ${NUMBER_HINT}`)
        }
      }
      toks.push(...names)
      continue
    }
    throw new ParseError(NUMBER_HINT)
  }
  return toks
}

function numberToken(raw: string): { n: number; d: number } {
  if (raw.length > 12) throw new ParseError('That number is longer than this problem needs.')
  if (!raw.includes('.')) {
    const n = Number(raw)
    if (!Number.isSafeInteger(n)) throw new ParseError('That number is longer than this problem needs.')
    return { n, d: 1 }
  }
  const [whole, frac = ''] = raw.split('.')
  if (frac.length > 8) throw new ParseError('That decimal is longer than this problem needs.')
  const digits = `${whole || '0'}${frac}`
  if (!/^\d+$/.test(digits)) throw new ParseError(NUMBER_HINT)
  const n = Number(digits)
  const d = 10 ** frac.length
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new ParseError('That number is longer than this problem needs.')
  const reduced = rat(whole?.startsWith('-') ? -n : n, d)
  return { n: reduced.n, d: reduced.d }
}
