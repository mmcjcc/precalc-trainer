/**
 * Text helpers for the nomenclature core. Three kinds of text, as in the earlier cores:
 *  - app text, what she types and what the readers read back: 'Fe2(SO4)3', 'CuSO4·5H2O', 'HCl(aq)', 'SO4^2-';
 *  - display text for sentences, with Unicode subscripts and charges: 'Fe₂(SO₄)₃', 'CuSO₄·5H₂O', 'SO₄²⁻';
 *  - LaTeX for KaTeX: '\mathrm{Fe_2(SO_4)_3}', '\mathrm{CuSO_4\cdot 5H_2O}', '\mathrm{SO_4^{2-}}'.
 * Names are the same in app and display text: 'iron(III) sulfate'.
 */
import { GREEK_PREFIXES } from './data'

export const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'
export const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** 12 → '₁₂' */
export function subscriptNumber(n: number): string {
  return [...String(n)].map((d) => SUBSCRIPT_DIGITS[Number(d)]).join('')
}

/** App text of a charge: 3 → '3+', -1 → '-', -2 → '2-'. */
export function chargeText(charge: number): string {
  const size = Math.abs(charge)
  return `${size === 1 ? '' : size}${charge > 0 ? '+' : '-'}`
}

/** Display superscript of a charge: 3 → '³⁺', -1 → '⁻'. */
export function chargeDisplay(charge: number): string {
  const size = Math.abs(charge)
  return `${size === 1 ? '' : [...String(size)].map((d) => SUPERSCRIPT_DIGITS[Number(d)]).join('')}${charge > 0 ? '⁺' : '⁻'}`
}

/** A charge for a sentence: 2 → '2+', -1 → '1−', -3 → '3−'. */
export function chargeWords(charge: number): string {
  return `${Math.abs(charge)}${charge > 0 ? '+' : charge < 0 ? '−' : ''}`
}

/** A signed total for a sentence: 6 → '6+', -6 → '6−', 0 → '0'. */
export function totalWords(total: number): string {
  return total === 0 ? '0' : chargeWords(total)
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/** 3 → 'III' (1 to 10). Throws RangeError outside. */
export function romanNumeral(n: number): string {
  const r = ROMAN[n - 1]
  if (!Number.isInteger(n) || !r) throw new RangeError(`${n} has no Roman numeral in this core (1 to 10).`)
  return r
}

/** 'iii' or 'III' → 3; null for anything that is not one of I to X written the standard way. */
export function romanValue(text: string): number | null {
  const i = ROMAN.indexOf(text.toUpperCase())
  return i >= 0 ? i + 1 : null
}

/** The Greek prefix for a count: 1 → 'mono', 5 → 'penta'. Throws RangeError outside 1 to 10. */
export function greekPrefix(n: number): string {
  const p = GREEK_PREFIXES[n - 1]
  if (!Number.isInteger(n) || !p) throw new RangeError(`${n} has no Greek prefix in this core (mono- to deca-).`)
  return p
}

/** The count a prefix stands for: 'penta' → 5; null when it is not a prefix. */
export function prefixValue(prefix: string): number | null {
  const i = GREEK_PREFIXES.indexOf(prefix)
  return i >= 0 ? i + 1 : null
}

/**
 * A word with the prefix for its count, as the textbook prints it: the final a or o of the prefix is dropped
 * before 'oxide' and 'oxygen' (monoxide, tetroxide, pentoxide; dioxide and trioxide keep theirs). With `first`,
 * a count of 1 takes no prefix (the first element never takes mono-).
 */
export function prefixed(n: number, word: string, first = false): string {
  if (first && n === 1) return word
  const p = greekPrefix(n)
  return /^o/.test(word) && /[ao]$/.test(p) ? p.slice(0, -1) + word : p + word
}

/** App text → display text: 'Fe2(SO4)3' → 'Fe₂(SO₄)₃', 'CuSO4·5H2O' → 'CuSO₄·5H₂O', 'SO4^2-' → 'SO₄²⁻'. */
export function formulaDisplay(text: string): string {
  const caret = text.indexOf('^')
  const body = caret >= 0 ? text.slice(0, caret) : text
  const charge = caret >= 0 ? text.slice(caret + 1) : ''
  const shown = body.replace(/([A-Za-z)])(\d+)/g, (_m, a: string, d: string) => a + subscriptNumber(Number(d)))
  return shown + [...charge].map((c) => (c === '+' ? '⁺' : c === '-' ? '⁻' : SUPERSCRIPT_DIGITS[Number(c)] ?? c)).join('')
}

/** App text → LaTeX: 'Fe2(SO4)3' → '\mathrm{Fe_2(SO_4)_3}', 'P4O10' → '\mathrm{P_4O_{10}}', 'Fe^3+' → '\mathrm{Fe^{3+}}'. */
export function formulaLatex(text: string): string {
  const caret = text.indexOf('^')
  const body = caret >= 0 ? text.slice(0, caret) : text
  const charge = caret >= 0 ? text.slice(caret + 1) : ''
  const latex = body
    .replace(/([A-Za-z)])(\d+)/g, (_m, a: string, d: string) => `${a}_${d.length > 1 ? `{${d}}` : d}`)
    .replace('·', '\\cdot ')
  return `\\mathrm{${latex}${charge ? `^{${charge}}` : ''}}`
}

/** 'iron' → 'Iron' */
export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** '1 ion', '3 ions' */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** 'one', 'two', … 'ten' for small counts in sentences; digits beyond. */
export function countWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n)
}

/** ['a'] → 'a'; ['a', 'b', 'c'] → 'a, b and c' */
export function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** 'a' or 'an' before a word or number for a sentence ('an 8', 'an ion', 'a 2+'). */
export function article(next: string): string {
  return /^(?:[aeiou]|8|11|18)/i.test(next) ? 'an' : 'a'
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x
}
