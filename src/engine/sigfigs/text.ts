/**
 * Small text helpers the UI needs around the numeral parser.
 */
import { parseSigFigNumeral } from './parse'

export { sigFigPlaceName } from './format'

/**
 * Joins a coefficient box and a power-of-ten box into one answer text, so a phone keyboard never
 * needs a caret or a letter: ("2.0", "3") → "2.0 x 10^3"; an empty power → just the coefficient.
 * Parse-error positions then index the JOINED text; positions inside the coefficient are unchanged.
 */
export function composeSigFigText(coefficient: string, power: string): string {
  const p = power.trim()
  return p === '' ? coefficient : `${coefficient.trimEnd()} x 10^${p}`
}

/** Pretty display of a numeral: "1.20e3" → "1.20 × 10³", "-0.5" → "−0.5". Unreadable text comes back unchanged. */
export function prettySigFig(text: string): string {
  const parsed = parseSigFigNumeral(text)
  return parsed.ok ? parsed.numeral.display : text
}
