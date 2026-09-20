/**
 * Rounding to N significant figures or to a place, half-up on the magnitude, with exact tie
 * detection, and the canonical way to WRITE the rounded value so that it shows its figures
 * (rule 11): standard notation when it can, otherwise scientific notation; a whole number whose
 * last significant digit is a zero in the ones place gets a trailing decimal point ("2000.").
 */
import type { SigFigRounding } from '@/shared/types'
import {
  absBig,
  decToMinimalPlain,
  digitCount,
  ratFromDec,
  roundRatToPlace,
  roundRatToSigFigs,
  scientificText,
  standardText,
  type RoundedRat,
} from './decimal'
import { mustParseSigFig, sigFigDec } from './parse'

export interface CanonicalForms {
  text: string
  display: string
  alternates: string[]
}

/** Numbers this large or this small read better in scientific notation. */
const SCI_ABOVE_PLACE = 6
const SCI_BELOW_PLACE = -5

/**
 * Canonical spellings of the value m × 10^place showing exactly the digits of m.
 * `preferScientific` forces the scientific form first (conversion tasks).
 */
export function canonicalForms(m: bigint, place: number, preferScientific = false): CanonicalForms {
  const standard = standardText(m, place)
  if (m === 0n) {
    const text = standard ?? '0'
    return { text, display: mustParseSigFig(text).display, alternates: [] }
  }
  const scientific = scientificText(m, place)
  const firstPlace = place + digitCount(m) - 1
  const extreme = firstPlace > SCI_ABOVE_PLACE || firstPlace < SCI_BELOW_PLACE
  // "4.8 x 10^0" is right but nobody writes it: only offer it when scientific form was asked for.
  const forms =
    standard === null
      ? [scientific]
      : preferScientific || extreme
        ? [scientific, standard]
        : firstPlace === 0
          ? [standard]
          : [standard, scientific]
  return { text: forms[0], display: mustParseSigFig(forms[0]).display, alternates: forms.slice(1) }
}

/** Shared shape for the public rounding functions and the task evaluator. */
export function describeRounding(r: RoundedRat, exactText: string): SigFigRounding {
  const forms = canonicalForms(r.m, r.place)
  return {
    exact: exactText,
    value: decToMinimalPlain({ int: r.m, exp: r.place }),
    text: forms.text,
    display: forms.display,
    alternates: forms.alternates,
    sigFigs: r.m === 0n ? 0 : digitCount(r.m),
    place: r.place,
    tie: r.tie,
    direction: r.direction,
    truncatedText: canonicalForms(r.truncM, r.truncPlace).text,
    firstDropped: r.firstDropped,
  }
}

/**
 * Round a numeral to n significant figures. Throws when `text` is not a numeral, is zero, or
 * n < 1.   roundToSigFigs('1999', 2).text === '2.0 x 10^3'
 */
export function roundToSigFigs(text: string, n: number): SigFigRounding {
  const numeral = mustParseSigFig(text)
  if (numeral.isZero) throw new Error('sig figs: zero cannot be rounded to significant figures')
  const exact = ratFromDec(sigFigDec(numeral))
  return describeRounding(roundRatToSigFigs(exact, n), numeral.value)
}

/**
 * Round a numeral to a place (power of ten: −2 = hundredths, 0 = ones, 3 = thousands).
 * roundToPlace('31.123', -1).text === '31.1'
 */
export function roundToPlace(text: string, place: number): SigFigRounding {
  if (!Number.isInteger(place)) throw new Error(`sig figs: bad place ${place}`)
  const numeral = mustParseSigFig(text)
  const exact = ratFromDec(sigFigDec(numeral))
  return describeRounding(roundRatToPlace(exact, place), numeral.value)
}

/** Internal: is |m| a single block of digits ending in a significant zero? ("3.0", "1.00") */
export function endsInSignificantZero(m: bigint): boolean {
  return m !== 0n && absBig(m) % 10n === 0n
}
