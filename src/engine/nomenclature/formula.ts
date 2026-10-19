/**
 * The formula reader. Case matters: an element symbol is a capital letter, optionally followed by one lowercase
 * letter (Co is cobalt, CO is carbon and oxygen). A lowercase letter where a symbol starts, or a capital second
 * letter that only makes sense in lowercase (CL, NACL), is an error with reason 'case' and a 0-based position;
 * nothing is ever fixed silently.
 *
 * Compound formulas (`readFormula`): Fe2(SO4)3, NH4Cl, Ca(OH)2, N2O5, H2SO4, HCl(aq), CuSO4·5H2O. Subscripts
 * as ASCII digits or Unicode (Fe₂O₃); spaces between units are ignored ('Fe 2 O 3', 'CaNO3 2' reads as
 * CaNO32: digits separated by a space continue the count before them). The hydrate dot may be ·, •, ∙, ⋅, *
 * or '.'. A state may follow: (aq), (s), (l), (g). Not accepted, each with its own message: a charge, a
 * number in front (2NaCl), a subscript or water count of 1 written out, 0, brackets, a Roman numeral in
 * parentheses (Fe(III)Cl3), parentheses never closed.
 *
 * Ion formulas (`readIon`): Fe3+, Fe^3+, Fe 3+, Fe+3, Fe³⁺, SO4 2-, SO4^2-, SO4^(2-), SO₄²⁻, Cl-, Cl−, Mg++. A
 * charge typed straight after an ASCII subscript ('SO42-', 'Fe3+', 'NO3-') is ambiguous, and both readings are
 * returned, the last digit as the charge first: 'SO42-' → [SO4 2−, SO42 1−].
 */
import { elementBySymbol } from '../chem/elements'
import { chargeText, SUBSCRIPT_DIGITS, SUPERSCRIPT_DIGITS } from './text'
import type { FormulaElementPart, FormulaParse, FormulaPart, FormulaReading, IonParse, IonReading, NmParseError } from './types'

const DOTS = '·•∙⋅*.'
const MINUS = '-−–'

class ReadError extends Error {
  constructor(readonly info: NmParseError) {
    super(info.message)
  }
}

function fail(reason: NmParseError['reason'], message: string, position: number, length?: number): never {
  throw new ReadError(length === undefined ? { reason, message, position } : { reason, message, position, length })
}

const isUpper = (ch: string | undefined) => ch !== undefined && ch >= 'A' && ch <= 'Z'
const isLower = (ch: string | undefined) => ch !== undefined && ch >= 'a' && ch <= 'z'
const isAscii = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9'
const isSub = (ch: string | undefined) => ch !== undefined && SUBSCRIPT_DIGITS.includes(ch)
const isSupDigit = (ch: string | undefined) => ch !== undefined && SUPERSCRIPT_DIGITS.includes(ch)
const isSupSign = (ch: string | undefined) => ch === '⁺' || ch === '⁻'
const isSign = (ch: string | undefined) => ch === '+' || (ch !== undefined && MINUS.includes(ch))
const isSpace = (ch: string | undefined) => ch === ' ' || ch === '\t' || ch === ' '

/** The last count read: where its digits end and whether they were ASCII (for the ambiguous charge). */
interface LastCount {
  part: FormulaPart
  raw: string
  end: number
  ascii: boolean
}

interface Scanner {
  src: string
  i: number
  mode: 'compound' | 'ion'
  last: LastCount | null
}

function skipSpaces(s: Scanner): void {
  while (isSpace(s.src[s.i])) s.i++
}

const isElement = (symbol: string) => elementBySymbol(symbol) !== undefined

function digitValue(ch: string): number {
  return isSub(ch) ? SUBSCRIPT_DIGITS.indexOf(ch) : Number(ch)
}

/** Reads the count after a symbol or ')'. Digits separated by spaces continue it (except a charge in ion mode). */
function readCount(s: Scanner, part: FormulaPart): number {
  let raw = ''
  let ascii = true
  let at = -1
  let end = s.i
  if (isSub(s.src[s.i])) {
    ascii = false
    at = s.i
    while (isSub(s.src[s.i])) raw += String(digitValue(s.src[s.i++]!))
    end = s.i
  } else {
    for (;;) {
      let j = s.i
      while (isSpace(s.src[j])) j++
      if (!isAscii(s.src[j])) break
      let k = j
      while (isAscii(s.src[k])) k++
      // In an ion, "SO4 2-": digits after a space and before a sign are the charge, not a count.
      let after = k
      while (isSpace(s.src[after])) after++
      if (s.mode === 'ion' && j > s.i && isSign(s.src[after])) break
      if (at < 0) at = j
      raw += s.src.slice(j, k)
      s.i = k
      end = k
    }
  }
  if (raw === '') {
    s.last = null
    return 1
  }
  if (raw.startsWith('0')) fail('unreadable', raw === '0' ? '0 is not a subscript: leave out an element that is not there.' : `A subscript does not start with 0: “${raw}”.`, at, end - at)
  if (raw.length > 3) fail('unreadable', `${raw} is far too large for a subscript.`, at, end - at)
  if (raw === '1')
    fail('not_in_form', 'A subscript of 1 is never written: one atom or one ion has no number after it.', at, end - at)
  s.last = { part, raw, end, ascii }
  return Number(raw)
}

function caseHint(): string {
  return 'Each element symbol starts with a capital letter, and a second letter is lowercase (Co is cobalt; CO is carbon and oxygen).'
}

function readElement(s: Scanner): FormulaElementPart {
  const at = s.i
  const ch = s.src[at]!
  const next = s.src[at + 1]
  let symbol: string
  if (isLower(next) && isElement(ch + next)) symbol = ch + next
  else if (isElement(ch)) symbol = ch
  else {
    // A capital second letter: "CL", "NACL" — the letter before it and this one, in lowercase, is a symbol.
    const before = s.src[at - 1]
    if (isUpper(before) && isElement(before + ch.toLowerCase()))
      fail('case', `${before}${ch} reads as ${before} and ${ch}, and no element has the symbol ${ch}. ${caseHint()}`, at, 1)
    if (isLower(next)) fail('unreadable', `No element has the symbol ${ch}${next}.`, at, 2)
    fail('unreadable', `No element has the symbol ${ch}.`, at, 1)
  }
  s.i += symbol.length
  const part: FormulaElementPart = { type: 'element', symbol, count: 1, position: at, length: symbol.length }
  part.count = readCount(s, part)
  part.length = (s.last?.end ?? s.i) - at
  return part
}

const ROMAN_GROUP = /^(?:I|II|III|IV|V|VI|VII|VIII)$/
const STATE = /^\(\s*(aq|AQ|Aq|aQ|s|l|g)\s*\)/

function readSequence(s: Scanner, depth: number): FormulaPart[] {
  const parts: FormulaPart[] = []
  for (;;) {
    skipSpaces(s)
    const at = s.i
    const ch = s.src[at]
    if (ch === undefined) {
      if (depth > 0) fail('unreadable', 'This parenthesis is never closed: add a ) after the ion.', at - 1, 1)
      return parts
    }
    if (isUpper(ch)) {
      parts.push(readElement(s))
      continue
    }
    if (isLower(ch)) fail('case', `“${ch}” is lowercase where an element symbol starts. ${caseHint()}`, at, 1)
    if (ch === '(') {
      const state = STATE.exec(s.src.slice(at))
      if (state) {
        if (depth > 0) fail('unreadable', `(${state[1]}) goes at the very end of the formula.`, at, state[0].length)
        return parts
      }
      const close = s.src.indexOf(')', at)
      const inner = close > at ? s.src.slice(at + 1, close).trim() : ''
      if (ROMAN_GROUP.test(inner))
        fail('not_in_form', 'A Roman numeral goes only in the name. In a formula the subscripts show the charge balance: write the symbols and their subscripts.', at, close - at + 1)
      s.i++
      const inside = readSequence(s, depth + 1)
      if (s.src[s.i] !== ')') fail('unreadable', 'This parenthesis is never closed: add a ) after the ion.', at, 1)
      if (inside.length === 0) fail('unreadable', 'There is nothing inside these parentheses.', at, s.i - at + 1)
      s.i++
      const group: FormulaPart = { type: 'group', parts: inside, count: 1, position: at, length: 0 }
      group.count = readCount(s, group)
      group.length = (s.last?.end ?? s.i) - at
      parts.push(group)
      continue
    }
    if (ch === ')') {
      if (depth > 0) return parts
      fail('unreadable', 'This ) has no ( before it.', at, 1)
    }
    if ('[]{}'.includes(ch)) fail('unreadable', 'Use round parentheses ( ) around a polyatomic ion.', at, 1)
    if (s.mode === 'ion' && depth === 0 && parts.length > 0 && /^\d+\s*[+\-−–]/.test(s.src.slice(at))) return parts
    if (isAscii(ch) || isSub(ch)) {
      if (parts.length === 0 && depth === 0)
        fail('not_in_form', 'A number in front counts formula units in an equation. Write the formula of one unit, with no number in front.', at, 1)
      fail('unreadable', 'A number goes right after the symbol or the ) that it counts.', at, 1)
    }
    if (depth === 0 && DOTS.includes(ch)) return parts
    if (isSign(ch) || ch === '^' || isSupDigit(ch) || isSupSign(ch)) {
      if (s.mode === 'ion' && depth === 0) return parts
      if (s.mode === 'ion') fail('unreadable', 'The charge goes after the whole ion, outside the parentheses.', at, 1)
      fail('not_in_form', 'A compound’s formula has no charges in it: the charges add up to zero. Write only the symbols and their subscripts.', at, 1)
    }
    fail('unreadable', `“${ch}” does not belong in a formula.`, at, 1)
  }
}

function partsText(parts: readonly FormulaPart[]): string {
  return parts.map((p) => (p.type === 'element' ? p.symbol : `(${partsText(p.parts)})`) + (p.count === 1 ? '' : String(p.count))).join('')
}

/** App text of formula parts as she wrote them (her order and parentheses): 'Ca(NO3)2'. */
export function formulaPartsText(parts: readonly FormulaPart[]): string {
  return partsText(parts)
}

function readWaters(s: Scanner): number {
  const dot = s.i
  s.i++
  skipSpaces(s)
  const at = s.i
  let raw = ''
  while (isAscii(s.src[s.i]) || isSub(s.src[s.i])) raw += String(digitValue(s.src[s.i++]!))
  if (raw.startsWith('0')) fail('unreadable', 'The number of water molecules cannot be 0.', at, s.i - at)
  if (raw === '1') fail('not_in_form', 'One water molecule is written ·H2O, with no 1.', at, 1)
  skipSpaces(s)
  // H2O, with spaces allowed between its pieces ("5 H2 O"), as everywhere else in a formula.
  const m = /^([Hh])[ \t]*([2₂])[ \t]*([Oo])/.exec(s.src.slice(s.i))
  if (m && m[1] === 'H' && m[3] === 'O') {
    s.i += m[0].length
    return raw === '' ? 1 : Number(raw)
  }
  if (m) fail('case', `Water is H2O, with capital letters. ${caseHint()}`, s.i, m[0].length)
  fail('unreadable', 'After the dot, write how many water molecules there are and H2O, like 5H2O.', dot, Math.max(1, s.i - dot + 1))
}

function readState(s: Scanner): FormulaReading['state'] {
  const m = STATE.exec(s.src.slice(s.i))
  if (!m) return null
  s.i += m[0].length
  return m[1]!.toLowerCase() as FormulaReading['state']
}

function finish(s: Scanner): void {
  skipSpaces(s)
  const ch = s.src[s.i]
  if (ch === undefined) return
  if (isSign(ch) || ch === '^' || isSupDigit(ch) || isSupSign(ch))
    fail('not_in_form', 'A compound’s formula has no charges in it: the charges add up to zero. Write only the symbols and their subscripts.', s.i, 1)
  if (ch === '(') fail('unreadable', 'Only (aq), (s), (l) or (g) can come after the formula.', s.i, 1)
  fail('unreadable', `“${ch}” does not belong here.`, s.i, 1)
}

/** Reads a compound's formula. Never throws. */
export function readFormula(text: string): FormulaParse {
  const s: Scanner = { src: text ?? '', i: 0, mode: 'compound', last: null }
  try {
    skipSpaces(s)
    if (s.i >= s.src.length) fail('unreadable', 'Type the formula first.', 0)
    const parts = readSequence(s, 0)
    if (parts.length === 0) fail('unreadable', 'Start the formula with an element symbol.', s.i, 1)
    skipSpaces(s)
    let waters: number | null = null
    const dot = s.src[s.i]
    if (dot !== undefined && DOTS.includes(dot)) waters = readWaters(s)
    skipSpaces(s)
    const state = readState(s)
    finish(s)
    const textOut = `${partsText(parts)}${waters === null ? '' : `·${waters === 1 ? '' : waters}H2O`}${state ? `(${state})` : ''}`
    return { ok: true, value: { parts, waters, state, text: textOut } }
  } catch (e) {
    if (e instanceof ReadError) return { ok: false, error: e.info }
    throw e
  }
}

function readSuperscriptCharge(s: Scanner): number {
  const at = s.i
  let digits = ''
  let sign = 0
  let signs = 0
  while (isSupDigit(s.src[s.i]) || isSupSign(s.src[s.i])) {
    const ch = s.src[s.i]!
    if (isSupDigit(ch)) digits += String(SUPERSCRIPT_DIGITS.indexOf(ch))
    else {
      const v = ch === '⁺' ? 1 : -1
      if (sign !== 0 && sign !== v) fail('unreadable', 'A charge has one sign, + or −.', s.i, 1)
      sign = v
      signs++
    }
    s.i++
  }
  if (sign === 0) fail('unreadable', 'Add the sign of the charge: ⁺ or ⁻.', at, s.i - at)
  return chargeOf(digits, sign, signs, at, s.i - at)
}

function chargeOf(digits: string, sign: number, signs: number, at: number, length: number): number {
  if (digits !== '' && signs > 1) fail('unreadable', 'Write the charge as a number and one sign, like 2+.', at, length)
  const size = digits === '' ? signs : Number(digits)
  if (size === 0) fail('unreadable', 'A charge of 0 is not an ion.', at, length)
  if (size > 9) fail('unreadable', `${size} is far too large for the charge of an ion.`, at, length)
  return sign * size
}

/** Reads "+", "2-", "-2", "++" (ASCII) at s.i. */
function readAsciiCharge(s: Scanner): { charge: number; signOnly: boolean } {
  const at = s.i
  let digits = ''
  while (isAscii(s.src[s.i])) digits += s.src[s.i++]
  skipSpaces(s)
  let sign = 0
  let signs = 0
  while (isSign(s.src[s.i])) {
    const v = s.src[s.i] === '+' ? 1 : -1
    if (sign !== 0 && sign !== v) fail('unreadable', 'A charge has one sign, + or −.', s.i, 1)
    sign = v
    signs++
    s.i++
  }
  if (sign === 0) fail('unreadable', 'Add the sign of the charge: + or −.', at, Math.max(1, s.i - at))
  if (digits === '') while (isAscii(s.src[s.i])) digits += s.src[s.i++]
  return { charge: chargeOf(digits, sign, signs, at, s.i - at), signOnly: digits === '' && signs === 1 }
}

/** Reads an ion's formula with its charge (none written: charge null). Never throws. */
export function readIon(text: string): IonParse {
  const s: Scanner = { src: text ?? '', i: 0, mode: 'ion', last: null }
  try {
    skipSpaces(s)
    if (s.i >= s.src.length) fail('unreadable', 'Type the ion first.', 0)
    const parts = readSequence(s, 0)
    if (parts.length === 0) fail('unreadable', 'Start the ion with an element symbol.', s.i, 1)
    const last = s.last && s.last.part === parts[parts.length - 1] ? s.last : null
    const touching = last !== null && last.end === s.i
    skipSpaces(s)
    const ch = s.src[s.i]
    const body = partsText(parts)
    if (ch === undefined) return { ok: true, value: [{ parts, charge: null, text: body }] }
    let charge: number
    let ambiguous = false
    if (isSupDigit(ch) || isSupSign(ch)) charge = readSuperscriptCharge(s)
    else if (ch === '^') {
      s.i++
      skipSpaces(s)
      const open = s.src[s.i]
      const close = open === '(' ? ')' : open === '{' ? '}' : null
      if (close) s.i++
      charge = isSupDigit(s.src[s.i]) || isSupSign(s.src[s.i]) ? readSuperscriptCharge(s) : readAsciiCharge(s).charge
      if (close) {
        skipSpaces(s)
        if (s.src[s.i] !== close) fail('unreadable', `Close the ${open} after the charge.`, s.i, 1)
        s.i++
      }
    } else if (isAscii(ch) || isSign(ch)) {
      const r = readAsciiCharge(s)
      charge = r.charge
      ambiguous = r.signOnly && touching && last!.ascii
    } else fail('unreadable', `“${ch}” does not belong in an ion’s formula.`, s.i, 1)
    skipSpaces(s)
    if (s.i < s.src.length) fail('unreadable', `“${s.src[s.i]}” does not belong after the charge.`, s.i, 1)
    const plain: IonReading = { parts, charge, text: `${body}^${chargeText(charge)}` }
    if (!ambiguous) return { ok: true, value: [plain] }
    // 'SO42-': the last digit of the subscript may be the charge.
    const raw = last!.raw
    const size = Number(raw.slice(-1))
    const rest = raw.slice(0, -1)
    if (size === 0 || rest.startsWith('0') || rest === '1') return { ok: true, value: [plain] }
    const copy = cloneParts(parts)
    const target = copy[copy.length - 1]!
    target.count = rest === '' ? 1 : Number(rest)
    const sign = charge > 0 ? 1 : -1
    const split: IonReading = { parts: copy, charge: sign * size, text: `${partsText(copy)}^${chargeText(sign * size)}` }
    return { ok: true, value: [split, plain] }
  } catch (e) {
    if (e instanceof ReadError) return { ok: false, error: e.info }
    throw e
  }
}

function cloneParts(parts: readonly FormulaPart[]): FormulaPart[] {
  return parts.map((p) => (p.type === 'element' ? { ...p } : { ...p, parts: cloneParts(p.parts) }))
}

/** The written sequence of a formula without parentheses: [['Ca', 1], ['N', 2], ['O', 6]] for Ca(NO3)2. */
export function flatAtoms(parts: readonly FormulaPart[], times = 1): [string, number][] {
  const out: [string, number][] = []
  for (const p of parts) {
    if (p.type === 'element') out.push([p.symbol, p.count * times])
    else out.push(...flatAtoms(p.parts, p.count * times))
  }
  return out
}

/** Element counts of a formula, summed: { Ca: 1, N: 2, O: 6 }. */
export function atomCounts(parts: readonly FormulaPart[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const [sym, n] of flatAtoms(parts)) m.set(sym, (m.get(sym) ?? 0) + n)
  return m
}

/** A written sequence as a key: 'C1H3C1O1O1' for CH3COO (order and counts as written, no parentheses). */
export function sequenceKey(parts: readonly FormulaPart[]): string {
  return parts.map((p) => (p.type === 'element' ? `${p.symbol}${p.count}` : `(${sequenceKey(p.parts)})${p.count}`)).join('')
}

/** The simple formulas of the ion table ('SO4', 'CH3COO', 'Hg2') as parts. Throws for anything else. */
export function simpleParts(formula: string): FormulaElementPart[] {
  const out: FormulaElementPart[] = []
  const re = /([A-Z][a-z]?)(\d*)/y
  let at = 0
  while (at < formula.length) {
    re.lastIndex = at
    const m = re.exec(formula)
    if (!m) throw new RangeError(`Not a simple formula: ${formula}`)
    out.push({ type: 'element', symbol: m[1]!, count: m[2] ? Number(m[2]) : 1, position: at, length: m[0].length })
    at += m[0].length
  }
  return out
}
