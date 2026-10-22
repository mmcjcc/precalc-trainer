/**
 * Reading what she types in an optimization problem: an equation in x, y and the letter of the quantity made largest
 * (A, P, R or S), and a number with or without its unit. Equations go through the app's own parser (`parse.ts`),
 * which reads letters in lower case: the quantity's letter is kept as `key` and shown upper case again by
 * `displayNode`. Numbers are read exactly where she typed an exact number (a whole number, a decimal, a fraction, a
 * mixed number, or arithmetic of them such as −500/(2·(−2))).
 */
import { collectVars, evalNode, isNumberNode, isOp, isUnaryMinus, math, nodeArgs, symbolName, type MathNode } from '../math'
import { parseExpression, parseStatement } from '../parse'
import { q, qAdd, qDiv, qFromDecimal, qMul, qNeg, qSub, type Q } from '../trig/rational'

// ---------------------------------------------------------------------------
// Equations
// ---------------------------------------------------------------------------

export type OptEquationProblem = 'empty' | 'no_equals' | 'chain' | 'inequality' | 'letters' | 'name' | 'parse'

export interface OptEquation {
  ok: true
  lhs: MathNode
  rhs: MathNode
  /** The letters she used, as the problem writes them: 'x', 'y', and the quantity ('A'). */
  letters: string[]
  /** The quantity's letter as the parser keeps it ('a' for A). */
  key: string
}

export type OptEquationRead = OptEquation | { ok: false; reason: OptEquationProblem; message: string }

/** Superscript powers and the dots of a product, as the parser reads them. */
function glyphs(text: string): string {
  return text
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[⋅•∙]/g, '*')
    .replace(/[−–—]/g, '-')
}

/** "x, y and A" for the letter messages. */
export function lettersPhrase(quantity: string): string {
  return `x, y and ${quantity}`
}

const FN_LEFT = /^\s*([A-Za-z])\s*\(\s*([xyXY])\s*\)\s*=/
const FN_RIGHT = /=\s*([A-Za-z])\s*\(\s*([xyXY])\s*\)\s*$/

/**
 * Her equation, or why it cannot be read. "A(x) = …" is the same as "A = …"; another name on the left ("f(x) = …",
 * "Y1 = …") is a note, since the problem has a letter for the quantity.
 */
export function readOptEquation(text: string, quantity: string): OptEquationRead {
  const key = quantity.toLowerCase()
  let t = glyphs(text.trim())
  if (!t) return { ok: false, reason: 'empty', message: 'Type the equation first.' }
  if (/[<>≤≥≠]|!=/.test(t)) return { ok: false, reason: 'inequality', message: 'This part wants an equation, with an = sign, not an inequality.' }
  const equals = (t.match(/=/g) ?? []).length
  if (equals === 0) return { ok: false, reason: 'no_equals', message: 'Write a whole equation, with an = sign.' }
  if (equals > 1) return { ok: false, reason: 'chain', message: 'Write one equation with one = sign. Keep the other steps on paper.' }
  const left = FN_LEFT.exec(t)
  if (left) {
    // f(x) = … on the left is a function's name; A(x) = … is the quantity's.
    if (left[1]!.toLowerCase() !== key) return { ok: false, reason: 'name', message: `Name the quantity with its letter: ${quantity} = …, not ${left[1]}(${left[2]!.toLowerCase()}).` }
    t = t.replace(FN_LEFT, `${quantity} =`)
  }
  // On the right only the quantity's own A(x) is a name; x(y) there is a product.
  const right = FN_RIGHT.exec(t)
  if (right && right[1]!.toLowerCase() === key) t = t.replace(FN_RIGHT, `= ${quantity}`)
  if (/\bY\s*1\b/.test(t) || /\bf\s*\(/.test(t)) return { ok: false, reason: 'name', message: `Name the quantity with its letter: ${quantity} = ….` }
  const parsed = parseStatement(t, ['x', 'y', key])
  if (!parsed.ok) {
    const unknown = /^Unknown letter "(.+?)"/.exec(parsed.error.message)
    if (unknown) return { ok: false, reason: 'letters', message: `This problem uses only the letters ${lettersPhrase(quantity)}. The figure or the problem says what each one is.` }
    return { ok: false, reason: 'parse', message: parsed.error.message }
  }
  const relations = parsed.statement.disjuncts.flat()
  if (parsed.statement.disjuncts.length !== 1 || relations.length !== 1) {
    return { ok: false, reason: 'chain', message: 'Write one equation with one = sign.' }
  }
  const rel = relations[0]!
  const used = new Set([...collectVars(rel.lhs), ...collectVars(rel.rhs)])
  const letters = ['x', 'y', key].filter((v) => used.has(v)).map((v) => (v === key ? quantity : v))
  return { ok: true, lhs: rel.lhs, rhs: rel.rhs, letters, key }
}

/** The equation's left side minus its right side at a point ('undef' where either side is undefined). */
export function residual(eq: OptEquation, scope: Record<string, number>): number | 'undef' {
  const l = evalNode(eq.lhs, scope)
  const r = evalNode(eq.rhs, scope)
  if (l === 'undef' || r === 'undef') return 'undef'
  return l - r
}

/** A side with the quantity's letter upper case again, for KaTeX. */
export function displayNode(node: MathNode, quantity: string): MathNode {
  const key = quantity.toLowerCase()
  return node.transform((n) => (symbolName(n) === key ? new math.SymbolNode(quantity) : n))
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** A length unit of these problems. */
export type OptLengthUnit = 'ft' | 'm' | 'yd'

/** What a number's unit is, when it has one. */
export type OptUnitKind = 'length' | 'area' | 'money' | 'count'

/** The units a number in this problem may carry: the problem's length unit, its square, money, or a count word. */
export interface OptUnits {
  lengthUnit?: OptLengthUnit
  money?: boolean
  /** Words for a count, plural first: ['tickets', 'ticket']. */
  count?: readonly string[]
}

const LENGTH_WORDS: Record<OptLengthUnit, { short: string; words: string[] }> = {
  ft: { short: 'ft', words: ['feet', 'foot'] },
  m: { short: 'm', words: ['meters', 'metres', 'meter', 'metre'] },
  yd: { short: 'yd', words: ['yards', 'yard'] },
}

/** Every spelling of the length and area units she might type, longest first, with what each one is. */
export function unitSpellings(unit: OptLengthUnit): { text: string; kind: 'length' | 'area' }[] {
  const { short, words } = LENGTH_WORDS[unit]
  const lengths = [short, ...words]
  const areas: string[] = []
  for (const w of lengths) {
    areas.push(`${w}^2`, `${w}²`, `${w}2`, `${w} squared`, `sq ${w}`, `sq. ${w}`, `square ${w}`)
  }
  areas.push(`sq ${short}.`, `sq. ${short}.`)
  const all = [...areas.map((text) => ({ text, kind: 'area' as const })), ...lengths.flatMap((w) => [{ text: w, kind: 'length' as const }, { text: `${w}.`, kind: 'length' as const }])]
  return all.sort((a, b) => b.text.length - a.text.length)
}

const UNIT_PATTERNS = new Map<OptLengthUnit, { re: RegExp; text: string; kind: 'length' | 'area' }[]>()

/** The spellings as patterns for the end of her answer, built once per unit. */
function unitPatterns(unit: OptLengthUnit): { re: RegExp; text: string; kind: 'length' | 'area' }[] {
  let hit = UNIT_PATTERNS.get(unit)
  if (!hit) {
    hit = unitSpellings(unit).map((s) => ({ ...s, re: new RegExp(`\\s*${escape(s.text)}$`, 'i') }))
    UNIT_PATTERNS.set(unit, hit)
  }
  return hit
}

export interface OptNumber {
  ok: true
  /** The exact value, when she typed an exact number; null for anything with a root or a long decimal. */
  exact: Q | null
  value: number
  /** Digits after the point of a plain decimal (0 for a whole number); null for a fraction or arithmetic. */
  places: number | null
  /** The unit she wrote after it (or a $ in front), if any. */
  unit: OptUnitKind | null
  /** The letter of "x =" in front, if she wrote one. */
  name: string | null
  /** KaTeX of what she typed, for the preview; '' when the screen should draw it another way. */
  tex: string
}

export type OptNumberProblem = 'empty' | 'letters' | 'unit' | 'parse' | 'undefined'
export type OptNumberRead = OptNumber | { ok: false; reason: OptNumberProblem; message: string }

const VULGAR: Record<string, [number, number]> = {
  '½': [1, 2],
  '⅓': [1, 3],
  '⅔': [2, 3],
  '¼': [1, 4],
  '¾': [3, 4],
  '⅕': [1, 5],
  '⅖': [2, 5],
  '⅗': [3, 5],
  '⅘': [4, 5],
  '⅙': [1, 6],
  '⅚': [5, 6],
  '⅛': [1, 8],
  '⅜': [3, 8],
  '⅝': [5, 8],
  '⅞': [7, 8],
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The exact value of a constant expression of whole numbers and decimals: + − × ÷ and whole powers. */
export function exactOfNode(node: MathNode): Q | null {
  try {
    return exactRec(node)
  } catch {
    return null
  }
}

function exactRec(node: MathNode): Q | null {
  if (node.type === 'ParenthesisNode') return exactRec((node as unknown as { content: MathNode }).content)
  if (isNumberNode(node)) {
    const v = (node as unknown as { value: number }).value
    if (Number.isInteger(v)) return q(v)
    const s = String(v)
    return /e/i.test(s) ? null : qFromDecimal(s)
  }
  const args = nodeArgs(node)
  if (isUnaryMinus(node)) {
    const a = args[0] ? exactRec(args[0]) : null
    return a ? qNeg(a) : null
  }
  if (node.type === 'OperatorNode' && (node as unknown as { fn: string }).fn === 'unaryPlus') return args[0] ? exactRec(args[0]) : null
  if (args.length !== 2) return null
  const a = exactRec(args[0]!)
  const b = exactRec(args[1]!)
  if (!a || !b) return null
  if (isOp(node, '+')) return qAdd(a, b)
  if (isOp(node, '-')) return qSub(a, b)
  if (isOp(node, '*')) return qMul(a, b)
  if (isOp(node, '/')) return b.n === 0 ? null : qDiv(a, b)
  if (isOp(node, '^')) {
    if (b.d !== 1 || Math.abs(b.n) > 12) return null
    let out = q(1)
    for (let i = 0; i < Math.abs(b.n); i++) out = qMul(out, a)
    if (b.n < 0) return out.n === 0 ? null : qDiv(q(1), out)
    return out
  }
  return null
}

const UNIT_TEX: Record<OptLengthUnit, string> = { ft: '\\text{ft}', m: '\\text{m}', yd: '\\text{yd}' }

function withCommasTex(digits: string): string {
  const m = /^(-?)(\d+)(\.\d+)?$/.exec(digits)
  if (!m) return digits
  return `${m[1]}${m[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}')}${m[3] ?? ''}`
}

/**
 * Her number, or why it cannot be read. Accepted around it: "x =" (or any one letter and =), "about", a $ in front or
 * "dollars" after, thousands commas, and a unit after it: the problem's length unit, its square in any common
 * spelling (ft², ft^2, sq ft, square feet), or the problem's count word.
 */
export function readOptNumber(text: string, units: OptUnits = {}): OptNumberRead {
  let t = glyphs(text.trim())
  if (!t) return { ok: false, reason: 'empty', message: 'Type your answer first.' }
  t = t.replace(/^(?:about|approximately|approx\.?|≈)\s*/i, '')
  let name: string | null = null
  const named = /^([A-Za-z])\s*(?:\(\s*[xyXY]\s*\))?\s*(?:=|≈)\s*/.exec(t)
  if (named) {
    name = named[1]!
    t = t.slice(named[0].length)
  }
  let unit: OptUnitKind | null = null
  let unitTex = ''
  if (/^-?\s*\$/.test(t)) {
    t = t.replace(/^(-?)\s*\$\s*/, '$1')
    unit = 'money'
    unitTex = '\\$'
  }
  if (/\s*dollars?\.?$/i.test(t)) {
    t = t.replace(/\s*dollars?\.?$/i, '')
    unit = 'money'
    unitTex = '\\$'
  }
  if (unit === null && units.lengthUnit && /[A-Za-z.²2]\s*$/.test(t)) {
    for (const s of unitPatterns(units.lengthUnit)) {
      const re = s.re
      // A one-letter unit (m) needs a space or a digit before it, so a stray letter is not read as meters.
      if (re.test(t) && (s.text.length > 1 || /[\d)]\s*m$|\sm$/i.test(t))) {
        t = t.replace(re, '')
        unit = s.kind
        unitTex = s.kind === 'area' ? `\\ ${UNIT_TEX[units.lengthUnit]}^{2}` : `\\ ${UNIT_TEX[units.lengthUnit]}`
        break
      }
    }
  }
  if (unit === null && units.count?.length) {
    for (const w of [...units.count].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`\\s+${escape(w)}\\.?$`, 'i')
      if (re.test(t)) {
        t = t.replace(re, '')
        unit = 'count'
        unitTex = `\\ \\text{${w}}`
        break
      }
    }
  }
  t = t.trim()
  if (!t) return { ok: false, reason: 'empty', message: 'Type the number as well as its unit.' }
  if (/[A-Za-z]/.test(t.replace(/sqrt|cbrt|pi/gi, ''))) {
    const word = /[A-Za-z]{2,}/.test(t.replace(/sqrt|cbrt|pi/gi, ''))
    if (word) return { ok: false, reason: 'unit', message: 'That unit is not one this problem uses. Write the number, then its unit.' }
    return { ok: false, reason: 'letters', message: 'This part wants a number, not a formula: work the value out.' }
  }
  const grouped = /^([-+]?)(\d{1,3}(?:,\d{3})+)(\.\d+)?$/.exec(t)
  if (grouped) t = `${grouped[1]}${grouped[2]!.replace(/,/g, '')}${grouped[3] ?? ''}`
  const money = unit === 'money' ? '\\$' : ''
  const tail = unit === 'money' ? '' : unitTex
  // A plain decimal or whole number.
  const plain = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(t)
  if (plain && (plain[2] || plain[3])) {
    const digits = `${plain[1] === '-' ? '-' : ''}${plain[2] || '0'}${plain[3] ? `.${plain[3]}` : ''}`
    let exact: Q | null = null
    try {
      exact = qFromDecimal(digits)
    } catch {
      exact = null
    }
    return { ok: true, exact, value: Number(digits), places: plain[3] ? plain[3].length : 0, unit, name, tex: `${money}${withCommasTex(digits)}${tail}` }
  }
  // A mixed number: 33 1/3.
  const mixed = /^([-+]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t)
  if (mixed) {
    const [w, n, d] = [Number(mixed[2]), Number(mixed[3]), Number(mixed[4])]
    if (d === 0) return { ok: false, reason: 'undefined', message: 'A fraction cannot have 0 underneath.' }
    const sign = mixed[1] === '-' ? -1 : 1
    const exact = q(sign * (w * d + n), d)
    return { ok: true, exact, value: exact.n / exact.d, places: null, unit, name, tex: `${money}${sign < 0 ? '-' : ''}${w}\\tfrac{${n}}{${d}}${tail}` }
  }
  // 33⅓
  const vulgar = /^([-+]?)(\d*)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/.exec(t)
  if (vulgar) {
    const [n, d] = VULGAR[vulgar[3]!]!
    const w = vulgar[2] ? Number(vulgar[2]) : 0
    const sign = vulgar[1] === '-' ? -1 : 1
    const exact = q(sign * (w * d + n), d)
    return { ok: true, exact, value: exact.n / exact.d, places: null, unit, name, tex: `${money}${sign < 0 ? '-' : ''}${w || ''}\\tfrac{${n}}{${d}}${tail}` }
  }
  const p = parseExpression(t, ['x'])
  if (!p.ok) return { ok: false, reason: 'parse', message: p.error.message }
  if (collectVars(p.node).length) return { ok: false, reason: 'letters', message: 'This part wants a number, not a formula: work the value out.' }
  const value = evalNode(p.node, {})
  if (value === 'undef') return { ok: false, reason: 'undefined', message: 'That works out to no number (a division by 0, or a square root of a negative).' }
  return { ok: true, exact: exactOfNode(p.node), value, places: null, unit, name, tex: '' }
}
