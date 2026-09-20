/**
 * Student-facing text helpers for significant figures: place names, pretty powers of ten, lists.
 */

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
  '+': '',
}

/** 3 → "³", −4 → "⁻⁴". */
export function superscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('')
}

const PLACE_NAMES: Record<number, string> = {
  9: 'billions',
  8: 'hundred-millions',
  7: 'ten-millions',
  6: 'millions',
  5: 'hundred-thousands',
  4: 'ten-thousands',
  3: 'thousands',
  2: 'hundreds',
  1: 'tens',
  0: 'ones',
  [-1]: 'tenths',
  [-2]: 'hundredths',
  [-3]: 'thousandths',
  [-4]: 'ten-thousandths',
  [-5]: 'hundred-thousandths',
  [-6]: 'millionths',
}

/** Name of a place value: 2 → "hundreds", 0 → "ones", −2 → "hundredths", 12 → "10¹²". */
export function sigFigPlaceName(place: number): string {
  return PLACE_NAMES[place] ?? `10${superscript(place)}`
}

/** "1 significant figure" / "3 significant figures". */
export function figuresPhrase(n: number): string {
  return `${n} significant figure${n === 1 ? '' : 's'}`
}

/** ["a"] → "a"; ["a","b"] → "a and b"; ["a","b","c"] → "a, b and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]
}

/** Pretty coefficient and power: ("-1.20", 3) → "−1.20 × 10³"; no power → just the minus fix. */
export function prettyNumeral(coefficient: string, exponent: number | null): string {
  const body = coefficient.replace(/^[-−–]/, '−').replace(/^\+/, '')
  return exponent === null ? body : `${body} × 10${superscript(exponent)}`
}
