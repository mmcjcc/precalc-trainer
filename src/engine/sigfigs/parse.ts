/**
 * Reads a numeral EXACTLY as typed (leading zeros, trailing zeros and a trailing "." all matter
 * for significant figures) and analyses every character by the conventions:
 *
 *   1 nonzero digits count            2 captive zeros count
 *   3 leading zeros never count       4 trailing zeros count only when a decimal point is written
 *   5 the power of ten never changes the count (rules 1-4 are applied to the coefficient; for a
 *     normalized coefficient that makes every digit significant)
 *
 * Grammar:  [sign] digits [. digits]  |  [sign] . digits     then optionally a power of ten:
 *           e3  E-4  x10^3  x 10^-3  ×10^(−3)  *10^3  ×10³  x10-3  x10+3
 *           (the caret may be left out only when a sign follows the 10: "2.5 x 100" is refused
 *           rather than read as 2.5 x 10^0)
 * Signs: + - − (U+2212) and the en, em and figure dashes a phone keyboard may substitute. Anything else (commas, units, fractions, spaces inside the
 * number) is a friendly ParseError whose position indexes the ORIGINAL text.
 *
 * ZERO ("0", "0.00", "000"): no digit is significant, so sigFigs = 0 and isZero = true; every zero
 * gets role leading_zero. lastSigPlace is the place of the last WRITTEN digit, so an add/subtract
 * answer can still be graded to the right place ("0.00").
 */
import type { ParseError, SigFigChar, SigFigCharRole, SigFigNumeral } from '@/shared/types'
import { decToMinimalPlain, type Dec } from './decimal'
import { prettyNumeral } from './format'

export type SigFigParse = { ok: true; numeral: SigFigNumeral } | { ok: false; error: ParseError }

/** Significant digits, not characters: placeholder zeros never count against the limit (see below). */
const MAX_DIGITS = 30
const MAX_EXPONENT_DIGITS = 2

const MINUS = '-−–—‒'
const TIMES = 'xX×*·⋅'
const SUPER_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const SUPER_MINUS = '⁻'
const SUPER_PLUS = '⁺'

const RULE: Record<SigFigCharRole, string> = {
  sign: 'The sign is not a digit, so it is never counted.',
  nonzero: 'Nonzero digits are always significant.',
  leading_zero: 'Leading zeros only place the decimal point, so they are never significant.',
  captive_zero: 'A zero between significant digits is significant.',
  trailing_zero_decimal:
    'This number has a decimal point, so its trailing zeros were measured: significant.',
  trailing_zero_placeholder:
    'No decimal point is written, so this trailing zero is only a placeholder: not significant.',
  decimal_point: 'The decimal point is not a digit, but it decides whether trailing zeros count.',
  exponent: 'The power of ten only sets the size of the number; it never adds significant figures.',
}
const RULE_ZERO_VALUE =
  'This number is zero: its zeros show how precisely it was measured, but none is a significant figure.'
const RULE_TRAILING_POINT =
  'A decimal point written at the end says the zeros in front of it were measured.'

const isDigit = (c: string): boolean => c >= '0' && c <= '9'
const isSpace = (c: string): boolean => /\s/.test(c)

function fail(message: string, position: number, length = 1): SigFigParse {
  return { ok: false, error: { message, position, length } }
}

/** A friendly message for a character that does not belong where it is. */
function unexpected(input: string, pos: number, seenDigits: boolean): SigFigParse {
  const c = String.fromCodePoint(input.codePointAt(pos) ?? 63)
  if (c === ',') return fail('Leave the commas out of numbers: write 12000, not 12,000.', pos)
  if (c === '/') return fail('Write the answer as a decimal number, not a fraction.', pos)
  if (c === '^') return fail('To write a power of ten, type it like 1.2e3 or 1.2 x 10^3.', pos)
  if (c === '(' || c === ')') return fail('No parentheses needed here, just the number.', pos)
  if (c === '+' || MINUS.includes(c))
    return fail('A sign can only go at the very front of the number, or on the power of ten.', pos)
  if (/[\p{L}%°µ]/u.test(c)) {
    let end = pos
    while (end < input.length && /[\p{L}%°µ]/u.test(input[end])) end++
    return seenDigits
      ? fail('Just the number here: leave off the units and any words.', pos, end - pos)
      : fail('Start with the number itself, like 0.0450 or 1.2e3.', pos, end - pos)
  }
  return fail(`I can't read "${c}" inside a number.`, pos, c.length)
}

interface ExponentScan {
  value: number
  end: number
}

/** Reads the power-of-ten part starting at `k` (its first non-space character). */
function scanExponent(input: string, k: number, end: number): ExponentScan | SigFigParse {
  const skip = (p: number): number => {
    while (p < end && isSpace(input[p])) p++
    return p
  }
  const unfinished = (pos: number): SigFigParse =>
    fail(
      'Finish the power of ten: it needs a whole number, like e3, e-4 or x 10^3.',
      Math.min(pos, end - 1),
    )
  let p = k
  let digits = ''
  let negative = false
  let digitsAt = p

  if (input[p] === 'e' || input[p] === 'E') {
    p++
    if (p < end && (input[p] === '+' || MINUS.includes(input[p]))) {
      negative = input[p] !== '+'
      p++
    }
    digitsAt = p
    while (p < end && isDigit(input[p])) digits += input[p++]
    if (digits === '') {
      // "5 eggs": a word, not a power of ten.
      if (p < end && /\p{L}/u.test(input[p])) return unexpected(input, k, true)
      return unfinished(p)
    }
  } else {
    p = skip(p + 1)
    if (input[p] !== '1' || input[p + 1] !== '0' || p + 1 >= end) {
      if (p < end && /\p{L}/u.test(input[p])) return unexpected(input, k, true)
      return fail('After the × comes 10 and its power, like x 10^3.', Math.min(p, end - 1))
    }
    p = skip(p + 2)
    if (p >= end) return unfinished(p)
    if (SUPER_DIGITS.includes(input[p]) || input[p] === SUPER_MINUS || input[p] === SUPER_PLUS) {
      if (input[p] === SUPER_MINUS || input[p] === SUPER_PLUS) {
        negative = input[p] === SUPER_MINUS
        p++
      }
      digitsAt = p
      while (p < end && SUPER_DIGITS.includes(input[p])) digits += String(SUPER_DIGITS.indexOf(input[p++]))
      if (digits === '') return unfinished(p)
    } else {
      let marked = false
      if (input[p] === '^') {
        marked = true
        p = skip(p + 1)
      }
      let paren = false
      if (input[p] === '(') {
        paren = true
        p = skip(p + 1)
      }
      if (p < end && (input[p] === '+' || MINUS.includes(input[p]))) {
        negative = input[p] !== '+'
        marked = true
        p++
      }
      // "2.5 x 100" must not be read as 2.5 x 10^0: bare digits after the 10 are refused.
      if (!marked && !paren && p < end && isDigit(input[p]))
        return fail('Mark the power with ^ (or use e): write 1.2 x 10^3 or 1.2e3.', p)
      digitsAt = p
      while (p < end && isDigit(input[p])) digits += input[p++]
      if (digits === '') return p < end && !isSpace(input[p]) && input[p] !== ')' ? unexpected(input, p, true) : unfinished(p)
      if (paren) {
        p = skip(p)
        if (input[p] !== ')') return fail('Close the parenthesis around the power of ten.', Math.min(p, end - 1))
        p++
      }
    }
  }
  if (p < end && input[p] === '.') return fail('The power of ten is always a whole number.', p)
  const trimmed = digits.replace(/^0+(?=\d)/, '')
  if (trimmed.length > MAX_EXPONENT_DIGITS)
    return fail(
      'That power of ten is far beyond anything in this course. Check the exponent.',
      digitsAt,
      digits.length,
    )
  const magnitude = Number(trimmed) // at most two digits: exact
  return { value: negative && magnitude !== 0 ? -magnitude : magnitude, end: p }
}

/** Parse and analyse one typed numeral. Never throws. */
export function parseSigFigNumeral(input: string): SigFigParse {
  const n = input.length
  let start = 0
  while (start < n && isSpace(input[start])) start++
  if (start === n) return fail('Type a number first.', 0, 0)
  let end = n
  while (end > start && isSpace(input[end - 1])) end--

  let i = start
  let negative = false
  let signAt = -1
  if (input[i] === '+' || MINUS.includes(input[i])) {
    negative = input[i] !== '+'
    signAt = i
    i++
  }

  // Coefficient.
  const mantissaStart = i
  let digits = ''
  const digitAt: number[] = []
  let pointAt = -1
  while (i < end) {
    const c = input[i]
    if (isDigit(c)) {
      digits += c
      digitAt.push(i)
      i++
    } else if (c === '.') {
      if (pointAt >= 0) return fail('A number has only one decimal point.', i)
      pointAt = i
      i++
    } else break
  }
  if (digits === '') {
    if (i >= end) return fail('I need at least one digit.', signAt >= 0 ? signAt : start, end - start)
    return unexpected(input, i, false)
  }
  const mantissaEnd = i

  // Power of ten (optional).
  let exponent = 0
  let scientific = false
  if (i < end) {
    let k = i
    while (k < end && isSpace(input[k])) k++
    const c = input[k]
    if (c === 'e' || c === 'E' || TIMES.includes(c)) {
      const scanned = scanExponent(input, k, end)
      if ('ok' in scanned) return scanned
      exponent = scanned.value
      scientific = true
      let p = scanned.end
      while (p < end && isSpace(input[p])) p++
      if (p < end) return unexpected(input, p, true)
    } else if (isDigit(c) || c === '.') {
      return fail('Leave out the space inside the number.', i, k - i)
    } else {
      return unexpected(input, k, true)
    }
  }

  // Analyse the coefficient digits.
  const fractionDigits = pointAt < 0 ? 0 : digitAt.filter((at) => at > pointAt).length
  const integerDigits = digits.length - fractionDigits
  const hasDecimalPoint = pointAt >= 0
  let first = -1
  let last = -1
  for (let d = 0; d < digits.length; d++) {
    if (digits[d] !== '0') {
      if (first < 0) first = d
      last = d
    }
  }
  const isZero = first < 0
  // Only SIGNIFICANT digits count against the limit: leading and placeholder zeros are not something a
  // measurement recorded, and the engine's own standard spellings ("1 x 10^-30" written out) would
  // otherwise be refused when typed back. The position is the 31st significant digit.
  const significantCount = isZero ? 0 : hasDecimalPoint ? digits.length - first : last - first + 1
  if (significantCount > MAX_DIGITS)
    return fail('That is more digits than any measurement has. Check the number.', digitAt[first + MAX_DIGITS])
  const placeOf = (d: number): number => integerDigits - 1 - d + exponent
  const roleOf = (d: number): SigFigCharRole => {
    if (isZero || d < first) return 'leading_zero'
    if (d <= last) return digits[d] === '0' ? 'captive_zero' : 'nonzero'
    return hasDecimalPoint ? 'trailing_zero_decimal' : 'trailing_zero_placeholder'
  }
  const significantRole = (r: SigFigCharRole): boolean =>
    r === 'nonzero' || r === 'captive_zero' || r === 'trailing_zero_decimal'

  const text = input.slice(start, end)
  const chars: SigFigChar[] = []
  let d = 0
  let sigDigits = ''
  let lastSigIndex = -1
  for (let at = start; at < end; at++) {
    const ch = input[at]
    const index = at - start
    if (at === signAt) {
      chars.push({ ch, index, role: 'sign', significant: false, digit: false, rule: RULE.sign })
    } else if (at >= mantissaStart && at < mantissaEnd) {
      if (at === pointAt) {
        const trailingPoint = at === mantissaEnd - 1 && !isZero && last < digits.length - 1
        chars.push({
          ch,
          index,
          role: 'decimal_point',
          significant: false,
          digit: false,
          rule: trailingPoint ? RULE_TRAILING_POINT : RULE.decimal_point,
        })
      } else {
        const role = roleOf(d)
        const significant = significantRole(role)
        if (significant) {
          sigDigits += ch
          lastSigIndex = d
        }
        chars.push({
          ch,
          index,
          role,
          significant,
          digit: true,
          place: placeOf(d),
          rule: isZero ? RULE_ZERO_VALUE : RULE[role],
        })
        d++
      }
    } else {
      chars.push({ ch, index, role: 'exponent', significant: false, digit: false, rule: RULE.exponent })
    }
  }

  const lastSigPlace = isZero ? placeOf(digits.length - 1) : placeOf(lastSigIndex)
  const firstSigPlace = isZero ? lastSigPlace : placeOf(first)
  const normalized = scientific && !isZero && integerDigits === 1 && first === 0
  const coefficient = input.slice(signAt >= 0 ? signAt : mantissaStart, mantissaEnd)
  const dec: Dec = { int: BigInt(digits) * (negative ? -1n : 1n), exp: exponent - fractionDigits }

  return {
    ok: true,
    numeral: {
      text,
      display: prettyNumeral(coefficient, scientific ? exponent : null),
      negative: negative && !isZero,
      isZero,
      sigFigs: sigDigits.length,
      sigDigits,
      firstSigPlace,
      lastSigPlace,
      hasDecimalPoint,
      scientific,
      normalized,
      exponent,
      digits,
      fractionDigits,
      value: decToMinimalPlain(dec),
      chars,
    },
  }
}

/** Exact value of an analysed numeral (engine-internal BigInt form). */
export function sigFigDec(numeral: SigFigNumeral): Dec {
  const int = BigInt(numeral.digits)
  return { int: numeral.negative ? -int : int, exp: numeral.exponent - numeral.fractionDigits }
}

/** For numerals that come from a generated TASK: a parse failure is a bug, so it throws. */
export function mustParseSigFig(text: string, what = 'number'): SigFigNumeral {
  const parsed = parseSigFigNumeral(text)
  if (!parsed.ok) throw new Error(`sig figs: cannot read ${what} "${text}": ${parsed.error.message}`)
  return parsed.numeral
}

/** How many significant figures `text` has; throws when it is not a numeral. */
export function countSigFigs(text: string): number {
  return mustParseSigFig(text).sigFigs
}
