/**
 * Polynomial long division, one round at a time: divide the leading terms, multiply the divisor by
 * that term, subtract. This is the method for a divisor synthetic division cannot take (a quadratic,
 * or any divisor that is not x − c). Exact arithmetic; the rounds are the engine's, and every answer
 * she types for a round is compared as a polynomial, in any form.
 *
 * A wrong answer here is a plain `wrong` with a sentence about what she did when the engine can tell
 * (the minus sign not carried through the product, only the first term of the divisor multiplied,
 * the rest of the dividend not brought down). The slips have no names in the mistake catalog yet.
 */
import type { Rational } from '@/shared/types'
import { rat, ratDiv, ratToString } from '@/notation/rational'
import { polyAdd, polyDeg, polyEquals, polyIsZero, polyLead, polyMul, polySub, polyToText, polyTrim, type Poly } from '../functions/poly'
import { checked, descending, guard, invalidParse, polyPretty, readFormula, readPoly } from './common'
import type { PolyGrade, PolyInput } from './types'

export interface LongRound {
  /** What is divided this round: the dividend, then the difference of the round before. App syntax. */
  current: string
  /** The leading term of `current` over the leading term of the divisor: the next term of the quotient. */
  term: string
  /** `term` times the whole divisor. */
  product: string
  /** `current` minus `product`: what the next round divides, or the remainder after the last round. */
  difference: string
  /** `current` and `product` by column, from the highest power of `current` down to the constant: "0" where a power is missing. */
  currentRow: string[]
  productRow: string[]
}

export interface LongDivision {
  /** Standard form, app syntax. */
  dividend: string
  divisor: string
  rounds: LongRound[]
  quotient: string
  remainder: string
  /** The worked division, display text, in order: for each round its three lines, then the result. */
  explanation: string[]
}

interface Model {
  dividend: Poly
  divisor: Poly
  rounds: { current: Poly; term: Poly; product: Poly; difference: Poly }[]
  quotient: Poly
  remainder: Poly
}

function monomial(coef: Rational, power: number): Poly {
  const out: Rational[] = Array.from({ length: power + 1 }, () => rat(0))
  out[power] = coef
  return polyTrim(out)
}

function leadTerm(p: Poly): Poly {
  return monomial(polyLead(p), polyDeg(p))
}

function build(dividend: PolyInput, divisor: PolyInput): Model | null {
  return guard(() => {
    const a = readPoly(dividend)
    const b = readPoly(divisor)
    if (!a || !b || polyIsZero(b.poly) || polyDeg(b.poly) < 1 || polyDeg(a.poly) < polyDeg(b.poly)) return null
    const rounds: Model['rounds'] = []
    let current = a.poly
    let quotient: Poly = []
    while (!polyIsZero(current) && polyDeg(current) >= polyDeg(b.poly)) {
      const term = monomial(ratDiv(polyLead(current), polyLead(b.poly)), polyDeg(current) - polyDeg(b.poly))
      const product = polyMul(term, b.poly)
      const difference = polySub(current, product)
      rounds.push({ current, term, product, difference })
      quotient = polyAdd(quotient, term)
      current = difference
    }
    return { dividend: a.poly, divisor: b.poly, rounds, quotient, remainder: current }
  })
}

/** A row of coefficients for the columns of `top`, highest power first. */
function row(p: Poly, top: number): string[] {
  const out: string[] = []
  for (let power = top; power >= 0; power--) out.push(ratToString(p[power] ?? rat(0)))
  return out
}

const show = (p: Poly) => (polyIsZero(p) ? '0' : polyPretty(p))
const text = (p: Poly) => (polyIsZero(p) ? '0' : polyToText(p))

function explain(m: Model): string[] {
  const lines: string[] = []
  const D = show(m.divisor)
  m.rounds.forEach((r, i) => {
    lines.push(`Divide the leading terms: ${show(leadTerm(r.current))} ÷ ${show(leadTerm(m.divisor))} = ${show(r.term)}. That is the ${i === 0 ? 'first' : 'next'} term of the quotient.`)
    lines.push(`Multiply the whole divisor by it: ${show(r.term)} · (${D}) = ${show(r.product)}.`)
    lines.push(`Subtract, changing the sign of every term of the product: (${show(r.current)}) − (${show(r.product)}) = ${show(r.difference)}.`)
  })
  lines.push(
    polyIsZero(m.remainder)
      ? `Nothing is left, so the division is exact: the quotient is ${show(m.quotient)} and the remainder is 0.`
      : `${show(m.remainder)} has a lower degree than ${D}, so the division stops: quotient ${show(m.quotient)}, remainder ${show(m.remainder)}. The whole result is ${show(m.quotient)} + (${show(m.remainder)})/(${D}).`,
  )
  return lines
}

/** The division worked round by round, or null when the divisor is a constant, is zero, or outgrows the dividend. */
export function longDivision(dividend: PolyInput, divisor: PolyInput): LongDivision | null {
  const m = build(dividend, divisor)
  if (!m) return null
  return {
    dividend: text(m.dividend),
    divisor: text(m.divisor),
    rounds: m.rounds.map((r) => ({
      current: text(r.current),
      term: text(r.term),
      product: text(r.product),
      difference: text(r.difference),
      currentRow: row(r.current, polyDeg(r.current)),
      productRow: row(r.product, polyDeg(r.current)),
    })),
    quotient: text(m.quotient),
    remainder: text(m.remainder),
    explanation: explain(m),
  }
}

/** The box of a long division being checked. Rounds count from 0. */
export type LongPart = { what: 'term' | 'product' | 'difference'; round: number } | { what: 'quotient' | 'remainder' }

const UNSUPPORTED = 'This division is outside what the app can check. Try another problem.'
const NOT_A_POLYNOMIAL = 'This answer is a polynomial in x: no x in a denominator and no roots.'

/** Grade one box of the long division: a polynomial in x, compared exactly in any form. */
export function gradeLongPart(dividend: PolyInput, divisor: PolyInput, part: LongPart, answer: string): PolyGrade {
  return checked(() => gradeUnchecked(dividend, divisor, part, answer))
}

function gradeUnchecked(dividend: PolyInput, divisor: PolyInput, part: LongPart, answer: string): PolyGrade {
  const m = build(dividend, divisor)
  if (!m) return { verdict: 'unsupported', message: UNSUPPORTED }
  const round = 'round' in part ? m.rounds[part.round] : undefined
  if ('round' in part && !round) return { verdict: 'unsupported', message: UNSUPPORTED }
  const her = readFormula(answer)
  if (!her.ok) return invalidParse(her.error)
  const explanation = explain(m)
  const D = show(m.divisor)

  if (part.what === 'quotient' || part.what === 'remainder') {
    if (!her.poly) {
      // The whole result q + r/d typed into one box.
      const whole = her.ratFn && guard(() => polyEquals(polyMul(her.ratFn!.num, m.divisor), polyMul(m.dividend, her.ratFn!.den)))
      if (whole) {
        return {
          verdict: 'invalid',
          reason: 'not_in_form',
          message:
            part.what === 'quotient'
              ? 'That is the whole result of the division. This box is only the quotient, the polynomial part; the remainder has its own box.'
              : 'That is the whole result of the division. This box is only the remainder: what is left after the last subtraction.',
        }
      }
      // The remainder over the divisor: the last piece of the whole result.
      if (part.what === 'remainder' && her.ratFn && guard(() => polyEquals(polyMul(her.ratFn!.num, m.divisor), polyMul(m.remainder, her.ratFn!.den)))) {
        return { verdict: 'invalid', reason: 'not_in_form', message: 'Type the remainder alone, without the divisor under it.' }
      }
      return { verdict: 'invalid', reason: 'unreadable', message: NOT_A_POLYNOMIAL }
    }
    if (part.what === 'quotient') {
      if (polyEquals(her.poly, m.quotient)) return { verdict: 'correct', message: `Correct: the quotient is ${show(m.quotient)}.`, explanation }
      if (polyEquals(her.poly, m.remainder)) return { verdict: 'wrong', message: 'That is what was left at the end. The quotient is the polynomial you built on top, one term per round.', explanation }
      return { verdict: 'wrong', message: 'The quotient is the sum of the terms you found, one from each round, in the order you found them.', explanation }
    }
    if (polyEquals(her.poly, m.remainder)) return { verdict: 'correct', message: `Correct: the remainder is ${show(m.remainder)}.`, explanation }
    if (polyEquals(her.poly, m.quotient)) return { verdict: 'wrong', message: 'That is the quotient. The remainder is what was left after the last subtraction.', explanation }
    return {
      verdict: 'wrong',
      message: `The remainder is what is left after the last subtraction. Its degree has to be lower than the degree of ${D}, which is why the division stops there.`,
      explanation,
    }
  }

  if (!her.poly) return { verdict: 'invalid', reason: 'unreadable', message: NOT_A_POLYNOMIAL }
  const r = round!
  const first = show(leadTerm(r.current))
  const lead = show(leadTerm(m.divisor))

  if (part.what === 'term') {
    if (polyEquals(her.poly, r.term)) return { verdict: 'correct', message: `Correct: ${first} ÷ ${lead} = ${show(r.term)}.`, explanation }
    if (polyEquals(her.poly, r.product)) return { verdict: 'wrong', message: 'That is the product. This box is the one term you multiply the divisor by.', explanation }
    return {
      verdict: 'wrong',
      message: `Look only at the leading terms: ${first} ÷ ${lead}. Divide the coefficients and subtract the exponents. The other terms of the divisor come in when you multiply.`,
      explanation,
    }
  }

  if (part.what === 'product') {
    if (polyEquals(her.poly, r.product)) return { verdict: 'correct', message: `Correct: ${show(r.term)} · (${D}) = ${show(r.product)}.`, explanation }
    if (polyDeg(m.divisor) > 0 && polyEquals(her.poly, polyMul(r.term, leadTerm(m.divisor)))) {
      return { verdict: 'wrong', message: `You multiplied by the first term of the divisor only. ${show(r.term)} multiplies every term of ${D}.`, explanation }
    }
    return { verdict: 'wrong', message: `Multiply ${show(r.term)} by each term of ${D}, one at a time, and keep each sign.`, explanation }
  }

  // The difference.
  if (polyEquals(her.poly, r.difference)) {
    const last = r === m.rounds[m.rounds.length - 1]
    return {
      verdict: 'correct',
      message: last
        ? `Correct: ${show(r.difference)} is left, and its degree is lower than the degree of ${D}.`
        : `Correct: ${show(r.difference)} is left. Its degree is not lower than the degree of ${D} yet, so there is another round.`,
      explanation,
    }
  }
  const leadOfProduct = leadTerm(r.product)
  const tail = polySub(r.product, leadOfProduct)
  // The leading terms cancel, and the rest of the product is added where it should be subtracted.
  if (!polyIsZero(tail) && polyEquals(her.poly, polyAdd(polySub(r.current, leadOfProduct), tail))) {
    return {
      verdict: 'wrong',
      message: `The minus sign belongs to every term of ${show(r.product)}, not only the first. After the leading terms cancel, the rest of the product is subtracted too: change each of its signs, then combine like terms.`,
      explanation,
    }
  }
  if (polyEquals(her.poly, polyAdd(r.current, r.product))) {
    return { verdict: 'wrong', message: `That is the sum. Subtract the product: the leading terms have to cancel.`, explanation }
  }
  // Right as far as the product reaches, with lower terms of the dividend not brought down.
  const reach = polyDeg(r.current) - polyDeg(m.divisor)
  const cut = polyTrim(r.difference.map((c, power) => (power < reach ? rat(0) : c)))
  if (reach > 0 && !polyEquals(cut, r.difference) && polyEquals(her.poly, cut)) {
    return { verdict: 'wrong', message: 'The subtraction is right as far as it goes. Bring down the rest of the terms too: everything that had nothing under it stays as it is.', explanation }
  }
  const missing = descending(m.divisor).some((c, i) => i > 0 && c.n === 0)
  return {
    verdict: 'wrong',
    message: missing
      ? `Subtract like terms only: x² terms from x² terms, x terms from x terms, numbers from numbers. ${D} skips a power, so the product does too, and that column of the product is empty.`
      : `Subtract like terms only, and change the sign of every term of ${show(r.product)} first. The leading terms have to cancel.`,
    explanation,
  }
}
