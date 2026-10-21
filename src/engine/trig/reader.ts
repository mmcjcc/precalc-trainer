/**
 * The reader for her trig answers. It takes what she types on a keyboard or the keypad and gives back an exact
 * value with what it noticed about the form:
 *
 *   "√3/2", "sqrt(3)/2", "(√3)/2", "1/2√3"        √3/2 (implicit multiplication reads left to right, as on a TI-84)
 *   "-1/2", "−0.5", "1", "0", "2√3/3"             exact values (a decimal that ends is the exact number it names)
 *   "undefined", "undef", "DNE", "does not exist"  the word for a value that does not exist
 *   "5π/6", "5pi/6", "(5/6)π", "5/6π"              radian measures
 *   "150", "150°", "150 degrees", "-210°"          degree measures (the ° is remembered)
 *   "sin θ = 1/2", "r = √13", "s = 4π cm"          a name before the answer, and a unit after it, are dropped
 *
 * A value written in a form that is not simplest radical form (1/√2, √12/2, √4, (2√3)/6, √2·√3) is read, and the
 * form is reported in `issue`; the grader treats an equal value in such a form as "not in the form asked", never as
 * a mistake. The messages here never contain a value she has not typed herself.
 */
import { exactAdd, exactDiv, exactInt, exactMul, exactNeg, exactPow, exactQ, exactSqrt, isZero, tx, type TrigExact } from './exact'
import { TrigOverflow, gcd, q, qFromDecimal, type Q } from './rational'
import type { TrigFn } from './values'

export type FormIssue =
  /** a square root in a denominator: 1/√2, 3/(2√3) */
  | 'radical_denominator'
  /** a perfect square under the radical: √4 */
  | 'perfect_square'
  /** a fraction or a decimal under the radical: √(3/4), √0.75 */
  | 'radicand_fraction'
  /** a square factor left under the radical: √12 */
  | 'radicand_square'
  /** the number in front of the radical and the denominator share a factor: (2√3)/6 */
  | 'unreduced_radical'
  /** two radicals multiplied: √2√3 */
  | 'radical_product'
  /** a power of a radical, or a power of 1/2: √3^2, 3^(1/2) */
  | 'radical_power'
  /** two terms not combined: 2π − π/6, √3/2 + √3/2 */
  | 'sum'

export interface TrigNumberRead {
  ok: true
  kind: 'number'
  /** The exact value; null for a sum of unlike terms (1 + √3), which has no single exact form here. */
  exact: TrigExact | null
  approx: number
  /** She typed a degree sign or the word degrees. */
  degrees: boolean
  /** She typed rad or radians. */
  radians: boolean
  /** She typed a decimal point somewhere. */
  decimal: boolean
  /** The whole answer is one plain number, with its decimal places ("0.70" has 2). */
  plain: { value: number; places: number } | null
  hasPi: boolean
  hasRoot: boolean
  issue: FormIssue | null
  /** KaTeX of what she typed, for the "reads as" preview. */
  tex: string
  /** The trig function she named before an equals sign ("sin θ = …"), if any. */
  fn: TrigFn | null
}

export type TrigRead = { ok: true; kind: 'undefined'; tex: string; fn: TrigFn | null } | TrigNumberRead | { ok: false; message: string }

export interface ReadOptions {
  /** Unit words she may type after the number, longest first or not: "cm", "square inches", "ft²". */
  units?: readonly string[]
}

const FN_NAMES: readonly TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']

const UNDEFINED_WORDS = /^(?:undefined|undef\.?|und|dne|d\.n\.e\.?|does\s*not\s*exist|doesn['’]?t\s*exist|not\s*defined|no\s*value|none)$/i

const NUMBER_HINT = 'Type a number: a whole number, a fraction, or a radical such as a√b/c.'

class ReadError extends Error {}

function fail(message: string): never {
  throw new ReadError(message)
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Tok =
  | { k: 'num'; v: Q; text: string; decimal: boolean }
  | { k: 'pi' }
  | { k: 'sqrt' }
  | { k: 'deg' }
  | { k: 'op'; op: '+' | '-' | '*' | '/' | '^' }
  | { k: 'lp' }
  | { k: 'rp' }

function normalize(raw: string): string {
  return raw
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[º˚]/g, '°')
    .replace(/[   ]/g, ' ')
    .trim()
}

function tokenize(s: string): Tok[] {
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
      toks.push({ k: 'sqrt' })
      i++
      continue
    }
    if (c === '∞') fail('∞ is not a number a trig function can equal. Give a number, or a word if the value does not exist.')
    if (/[0-9.,]/.test(c)) {
      const start = i
      while (i < s.length && /[0-9.,]/.test(s[i]!)) i++
      let text = s.slice(start, i)
      if (text.includes(',')) {
        if (!/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)) fail('Use a decimal point, not a comma, inside a number.')
        text = text.replace(/,/g, '')
      }
      if ((text.match(/\./g) ?? []).length > 1 || text === '.') fail(NUMBER_HINT)
      let v: Q
      try {
        v = qFromDecimal(text)
      } catch {
        fail('That number is longer than this problem needs.')
      }
      toks.push({ k: 'num', v, text, decimal: text.includes('.') })
      continue
    }
    if (/[a-zθ]/i.test(c)) {
      const start = i
      while (i < s.length && /[a-zθ]/i.test(s[i]!)) i++
      const word = s.slice(start, i)
      const lower = word.toLowerCase()
      if (lower === 'pi') {
        toks.push({ k: 'pi' })
        continue
      }
      if (lower === 'sqrt') {
        toks.push({ k: 'sqrt' })
        continue
      }
      if (lower === 'inf' || lower === 'infinity') fail('∞ is not a number a trig function can equal. Give a number, or a word if the value does not exist.')
      if ((FN_NAMES as readonly string[]).includes(lower) || /^(?:sin|cos|tan|csc|sec|cot)/.test(lower)) {
        fail(`Your answer still has ${lower.slice(0, 3)} in it. Give the value itself: a number, a fraction or a radical.`)
      }
      if (/^[xyr]$/.test(lower)) fail('Use the numbers of this point: put in its x, y and r.')
      if (lower === 'θ' || lower === 'theta') fail('Write the value itself, without θ.')
      fail(`I can’t read “${word}”. ${NUMBER_HINT}`)
    }
    fail(`I can’t read “${c}”. ${NUMBER_HINT}`)
  }
  return toks
}

// ---------------------------------------------------------------------------
// Parse tree
// ---------------------------------------------------------------------------

type Node =
  | { t: 'num'; v: Q; text: string }
  | { t: 'pi' }
  | { t: 'sqrt'; arg: Node }
  | { t: 'neg'; arg: Node }
  | { t: 'add'; op: '+' | '-'; l: Node; r: Node }
  | { t: 'mul'; op: '*' | '/' | 'implicit'; l: Node; r: Node }
  | { t: 'pow'; base: Node; exp: Node }

function parse(toks: Tok[]): { node: Node; degreeSigns: number } {
  let i = 0
  let degreeSigns = 0
  const peek = () => toks[i]
  const startsAtom = (t: Tok | undefined) => !!t && (t.k === 'num' || t.k === 'pi' || t.k === 'sqrt' || t.k === 'lp')

  function expr(): Node {
    let left = term()
    for (;;) {
      const t = peek()
      if (!t || t.k !== 'op' || (t.op !== '+' && t.op !== '-')) return left
      i++
      left = { t: 'add', op: t.op, l: left, r: term() }
    }
  }
  function term(): Node {
    let left = unary()
    for (;;) {
      const t = peek()
      if (t && t.k === 'op' && (t.op === '*' || t.op === '/')) {
        i++
        left = { t: 'mul', op: t.op, l: left, r: unary() }
        continue
      }
      if (startsAtom(t)) {
        const before = toks[i - 1]
        if (before?.k === 'num' && t!.k === 'num') fail('Put an operation between the two numbers.')
        if (before?.k === 'deg') fail('A degree sign ends the angle: nothing comes after it.')
        left = { t: 'mul', op: 'implicit', l: left, r: power() }
        continue
      }
      return left
    }
  }
  function unary(): Node {
    const t = peek()
    if (t && t.k === 'op' && (t.op === '-' || t.op === '+')) {
      i++
      const arg = unary()
      return t.op === '-' ? { t: 'neg', arg } : arg
    }
    return power()
  }
  function power(): Node {
    const base = postfix(atom())
    const t = peek()
    if (t && t.k === 'op' && t.op === '^') {
      i++
      return { t: 'pow', base, exp: unary() }
    }
    return base
  }
  function postfix(node: Node): Node {
    while (peek()?.k === 'deg') {
      i++
      degreeSigns++
    }
    return node
  }
  function atom(): Node {
    const t = peek()
    if (!t) fail('That answer is unfinished.')
    if (t.k === 'num') {
      i++
      return { t: 'num', v: t.v, text: t.text }
    }
    if (t.k === 'pi') {
      i++
      return { t: 'pi' }
    }
    if (t.k === 'sqrt') {
      i++
      const next = peek()
      if (!next || (next.k !== 'num' && next.k !== 'lp' && next.k !== 'pi' && next.k !== 'sqrt')) fail('A square root needs a number after it: √ then the number, or sqrt( ).')
      return { t: 'sqrt', arg: atom() }
    }
    if (t.k === 'lp') {
      i++
      const inner = expr()
      if (peek()?.k !== 'rp') fail('A parenthesis is missing its partner.')
      i++
      return inner
    }
    if (t.k === 'rp') fail('There is an extra parenthesis.')
    if (t.k === 'deg') fail('A degree sign goes right after the number.')
    fail(NUMBER_HINT)
  }

  const node = expr()
  if (i < toks.length) {
    const extra = peek()
    if (extra?.k === 'rp') fail('There is an extra parenthesis.')
    fail(NUMBER_HINT)
  }
  return { node, degreeSigns }
}

// ---------------------------------------------------------------------------
// Value and form
// ---------------------------------------------------------------------------

interface Value {
  exact: TrigExact | null
  approx: number
}

function evalNode(node: Node): Value {
  switch (node.t) {
    case 'num':
      return { exact: exactQ(node.v), approx: node.v.n / node.v.d }
    case 'pi':
      return { exact: tx(q(1), 1, 1), approx: Math.PI }
    case 'neg': {
      const v = evalNode(node.arg)
      return { exact: v.exact ? exactNeg(v.exact) : null, approx: -v.approx }
    }
    case 'sqrt': {
      const v = evalNode(node.arg)
      if (v.approx < 0) fail('A square root of a negative number is not a real number.')
      const exact = v.exact ? exactSqrt(v.exact) : null
      if (!exact) fail('Write one square root of a whole number.')
      return { exact, approx: Math.sqrt(v.approx) }
    }
    case 'add': {
      const l = evalNode(node.l)
      const r = evalNode(node.r)
      const rr = r.exact ? (node.op === '-' ? exactNeg(r.exact) : r.exact) : null
      const exact = l.exact && rr ? exactAdd(l.exact, rr) : null
      return { exact, approx: node.op === '-' ? l.approx - r.approx : l.approx + r.approx }
    }
    case 'mul': {
      const l = evalNode(node.l)
      const r = evalNode(node.r)
      if (node.op === '/') {
        if (r.approx === 0 || (r.exact && isZero(r.exact))) fail('A number divided by zero is not a number. If there is no value, say so in a word.')
        return { exact: l.exact && r.exact ? exactDiv(l.exact, r.exact) : null, approx: l.approx / r.approx }
      }
      return { exact: l.exact && r.exact ? exactMul(l.exact, r.exact) : null, approx: l.approx * r.approx }
    }
    case 'pow': {
      const b = evalNode(node.base)
      const e = evalNode(node.exp)
      const k = e.exact && e.exact.root === 1 && e.exact.pi === 0 ? e.exact.c : null
      if (!k) fail('Use a whole-number power.')
      if (k.d === 1) {
        if (Math.abs(k.n) > 12) fail('That power is larger than this problem needs.')
        if (b.exact && isZero(b.exact) && k.n < 0) fail('A number divided by zero is not a number. If there is no value, say so in a word.')
        return { exact: b.exact ? exactPow(b.exact, k.n) : null, approx: b.approx ** k.n }
      }
      if (k.d === 2 && Math.abs(k.n) === 1) {
        const root = b.exact ? exactSqrt(b.exact) : null
        if (!root || b.approx < 0) fail('Write one square root of a whole number.')
        return { exact: k.n < 0 ? exactDiv(exactInt(1), root) : root, approx: b.approx ** (k.n / 2) }
      }
      fail('Use a whole-number power.')
    }
  }
}

function hasNode(node: Node, test: (n: Node) => boolean): boolean {
  if (test(node)) return true
  switch (node.t) {
    case 'num':
    case 'pi':
      return false
    case 'sqrt':
    case 'neg':
      return hasNode(node.arg, test)
    case 'add':
    case 'mul':
      return hasNode(node.l, test) || hasNode(node.r, test)
    case 'pow':
      return hasNode(node.base, test) || hasNode(node.exp, test)
  }
}

const isSqrt = (n: Node) => n.t === 'sqrt' || (n.t === 'pow' && n.exp.t === 'mul' && n.exp.op === '/')
const hasSqrt = (n: Node) => hasNode(n, isSqrt)

function isPerfectSquare(n: number): boolean {
  const s = Math.round(Math.sqrt(n))
  return s * s === n
}

function squareFree(n: number): boolean {
  for (let f = 2; f * f <= n; f++) if (n % (f * f) === 0) return false
  return true
}

/** The written whole numbers on top and underneath, and whether a radical is among them, for (a√m)/b forms. */
function radicalContent(node: Node): { num: number; den: number; radical: boolean } | null {
  switch (node.t) {
    case 'num':
      return node.v.d === 1 ? { num: Math.abs(node.v.n), den: 1, radical: false } : null
    case 'neg':
      return radicalContent(node.arg)
    case 'sqrt':
      return node.arg.t === 'num' && node.arg.v.d === 1 ? { num: 1, den: 1, radical: true } : null
    case 'pi':
      return { num: 1, den: 1, radical: false }
    case 'mul': {
      const l = radicalContent(node.l)
      const r = radicalContent(node.r)
      if (!l || !r) return null
      if (node.op === '/') return { num: l.num * r.den, den: l.den * r.num, radical: l.radical || r.radical }
      return { num: l.num * r.num, den: l.den * r.den, radical: l.radical || r.radical }
    }
    default:
      return null
  }
}

function formIssue(node: Node): FormIssue | null {
  const issues = new Set<FormIssue>()
  const visit = (n: Node) => {
    switch (n.t) {
      case 'sqrt': {
        const v = evalNode(n.arg)
        const r = v.exact
        if (r && r.root === 1 && r.pi === 0) {
          if (r.c.d !== 1 || n.arg.t === 'num' && n.arg.text.includes('.')) issues.add('radicand_fraction')
          else if (isPerfectSquare(r.c.n)) issues.add('perfect_square')
          else if (!squareFree(r.c.n)) issues.add('radicand_square')
        }
        visit(n.arg)
        return
      }
      case 'neg':
        visit(n.arg)
        return
      case 'add': {
        const l = evalNode(n.l)
        const r = evalNode(n.r)
        if (l.approx !== 0 && r.approx !== 0) issues.add('sum')
        visit(n.l)
        visit(n.r)
        return
      }
      case 'mul':
        if (n.op === '/' && hasSqrt(n.r)) issues.add('radical_denominator')
        if (n.op !== '/' && hasSqrt(n.l) && hasSqrt(n.r)) issues.add('radical_product')
        visit(n.l)
        visit(n.r)
        return
      case 'pow':
        if (hasSqrt(n.base) || (n.exp.t === 'mul' && n.exp.op === '/') || evalNode(n.exp).exact?.c.d !== 1) issues.add('radical_power')
        visit(n.base)
        return
      default:
        return
    }
  }
  visit(node)
  const content = radicalContent(node)
  if (content && content.radical && gcd(content.num, content.den) > 1 && content.den > 1) issues.add('unreduced_radical')
  const order: FormIssue[] = ['radical_denominator', 'perfect_square', 'radicand_fraction', 'radicand_square', 'unreduced_radical', 'radical_product', 'radical_power', 'sum']
  return order.find((o) => issues.has(o)) ?? null
}

/**
 * What to fix about the form, never the simplified value. It does not repeat what she typed (it is in her box right
 * above), so no number shows up in it at all.
 */
export function formNote(issue: FormIssue): string {
  switch (issue) {
    case 'radical_denominator':
      return 'Your answer has a square root in the denominator, which is not simplest form. Rationalize the denominator: multiply the top and the bottom by that square root.'
    case 'perfect_square':
      return 'Your answer has a perfect square under the radical. Write it as a number, with no radical left.'
    case 'radicand_fraction':
      return 'Your answer has a fraction under the radical. Split it into a square root on top and one underneath, then rationalize.'
    case 'radicand_square':
      return 'Your answer is not simplest radical form. Take every perfect-square factor out of the radical.'
    case 'unreduced_radical':
      return 'Your answer is not simplest form. Reduce the number in front of the radical with the denominator.'
    case 'radical_product':
      return 'Your answer is not simplest form. Multiply the radicals into one radical, then simplify.'
    case 'radical_power':
      return 'Your answer is not simplest form. Work out the power and write any root with √.'
    case 'sum':
      return 'Your answer is not one number yet. Combine the terms into a single term.'
  }
}

// ---------------------------------------------------------------------------
// KaTeX preview
// ---------------------------------------------------------------------------

function wrap(tex: string): string {
  return `\\left(${tex}\\right)`
}

function needsParens(n: Node): boolean {
  return n.t === 'add' || n.t === 'neg'
}

function texOf(node: Node): string {
  switch (node.t) {
    case 'num':
      return node.text
    case 'pi':
      return '\\pi'
    case 'sqrt':
      return `\\sqrt{${texOf(node.arg)}}`
    case 'neg':
      return `-${needsParens(node.arg) ? wrap(texOf(node.arg)) : texOf(node.arg)}`
    case 'add':
      return `${texOf(node.l)} ${node.op} ${node.r.t === 'neg' || (node.op === '-' && node.r.t === 'add') ? wrap(texOf(node.r)) : texOf(node.r)}`
    case 'mul': {
      if (node.op === '/') return `\\frac{${texOf(node.l)}}{${texOf(node.r)}}`
      const l = needsParens(node.l) ? wrap(texOf(node.l)) : texOf(node.l)
      const r = needsParens(node.r) ? wrap(texOf(node.r)) : texOf(node.r)
      const dot = node.op === '*' || (/\d$/.test(l) && /^\d/.test(r))
      return `${l}${dot ? ' \\cdot ' : ' '}${r}`
    }
    case 'pow': {
      const b = node.base.t === 'num' || node.base.t === 'pi' ? texOf(node.base) : wrap(texOf(node.base))
      return `${b}^{${texOf(node.exp)}}`
    }
  }
}

// ---------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------

/** A name before her answer: a trig function of anything ("sin θ", "tan(5π/6)") or a short name ("r", "s", "A"). */
function splitLabel(text: string): { body: string; fn: TrigFn | null } {
  const eq = text.split('=')
  if (eq.length === 1) return { body: text, fn: null }
  if (eq.length > 2) fail('Write the answer with at most one equals sign: a name, =, and the value.')
  const left = eq[0]!.trim()
  const body = eq[1]!.trim()
  if (!body) fail('Type the value after the equals sign.')
  const fn = /^(sin|cos|tan|csc|sec|cot)(?![a-z])/i.exec(left)
  if (fn) return { body, fn: fn[1]!.toLowerCase() as TrigFn }
  if (/^[A-Za-zθ]{1,3}$/.test(left)) return { body, fn: null }
  fail('Write just the answer, or a name, an equals sign and the answer.')
}

/** "4π cm" → "4π", "235.6 square feet" → "235.6": a unit word right after the number, longest spelling first. */
function stripUnits(text: string, units: readonly string[]): string {
  const sorted = [...units].sort((a, b) => b.length - a.length)
  for (const u of sorted) {
    const esc = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const m = new RegExp(`^(.*(?:\\d|\\)|π|pi|°))\\s*${esc}\\.?$`, 'i').exec(text)
    if (m) return m[1]!.trim()
  }
  return text
}

/** Read one answer. */
export function readTrigAnswer(raw: string, opts: ReadOptions = {}): TrigRead {
  try {
    return readOrThrow(raw, opts)
  } catch (e) {
    if (e instanceof ReadError) return { ok: false, message: e.message }
    if (e instanceof TrigOverflow) return { ok: false, message: 'That number is longer than this problem needs.' }
    throw e
  }
}

function readOrThrow(raw: string, opts: ReadOptions): TrigRead {
  let text = normalize(raw ?? '')
  if (!text) fail('Type your answer first.')
  const { body, fn } = splitLabel(text)
  text = body.replace(/^(?:≈|about\s+|approximately\s+|approx\.?\s+)/i, '').trim()
  if (UNDEFINED_WORDS.test(text.replace(/\.$/, '').trim())) return { ok: true, kind: 'undefined', tex: '\\text{undefined}', fn }
  if (opts.units?.length) text = stripUnits(text, opts.units)
  let degrees = false
  let radians = false
  const degWord = /\s*(?:degrees|degree|deg)\.?$/i
  const radWord = /\s*(?:radians|radian|rads|rad)\.?$/i
  if (degWord.test(text) && /[\d)π°]\s*(?:degrees|degree|deg)\.?$/i.test(text)) {
    degrees = true
    text = text.replace(degWord, '')
  } else if (radWord.test(text) && /[\d)πi]\s*(?:radians|radian|rads|rad)\.?$/i.test(text)) {
    radians = true
    text = text.replace(radWord, '')
  }
  text = text.trim()
  if (!text) fail('Type the number too.')
  const toks = tokenize(text)
  if (!toks.length) fail('Type your answer first.')
  const { node, degreeSigns } = parse(toks)
  if (degreeSigns > 0) degrees = true
  const hasPi = hasNode(node, (n) => n.t === 'pi')
  if (degrees && hasPi) fail('An angle written with π is in radians, so it takes no degree sign.')
  if (degrees && radians) fail('Write the angle in one unit: degrees or radians.')
  const v = evalNode(node)
  if (!Number.isFinite(v.approx)) fail('That number is larger than this problem needs.')
  const bare = toks.filter((t) => t.k !== 'deg')
  const single = bare.length === 1 || (bare.length === 2 && bare[0]!.k === 'op' && (bare[0]!.op === '-' || bare[0]!.op === '+'))
  const numTok = bare.find((t) => t.k === 'num')
  const plain =
    single && numTok && numTok.k === 'num'
      ? { value: v.approx, places: numTok.text.includes('.') ? numTok.text.split('.')[1]!.length : 0 }
      : null
  return {
    ok: true,
    kind: 'number',
    exact: v.exact ?? null,
    approx: v.approx,
    degrees,
    radians,
    decimal: toks.some((t) => t.k === 'num' && t.decimal),
    plain,
    hasPi,
    hasRoot: hasSqrt(node),
    issue: formIssue(node),
    tex: `${texOf(node)}${degrees ? '^{\\circ}' : ''}`,
    fn,
  }
}

/** The value she typed, for tests and the generators' self-checks. */
export function readExact(raw: string): TrigExact | 'undefined' | null {
  const r = readTrigAnswer(raw)
  if (!r.ok) return null
  if (r.kind === 'undefined') return 'undefined'
  return r.exact
}

