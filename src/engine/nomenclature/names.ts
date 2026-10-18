/**
 * The name reader. Names are compared by KEY: lower case, single spaces, and every accepted way of writing the
 * same name made the same:
 *  - case and spacing: 'Iron (III) Chloride', 'iron(III)chloride' and 'iron(iii) chloride' are one key;
 *  - British spellings: aluminium, sulphur/sulphate/sulphide/sulphite/sulphuric/sulphurous, caesium;
 *  - vowel elision, either way, never a mistake: monoxide/monooxide, pentoxide/pentaoxide, tetroxide/tetraoxide,
 *    triiodide, tetraiodide/tetriodide (a prefix's final a or o before a word that starts with a vowel);
 *  - aliases: bicarbonate (hydrogen carbonate), bisulfate, bisulfite, hydriodic (hydroiodic), ethanoate and
 *    ethanoic (acetate, acetic), dimercury and dimercury(I) (mercury(I));
 *  - hyphens inside a word (mono-oxide) are dropped.
 *
 * Not names, `invalid` with a message (not an attempt): an Arabic numeral for a charge (iron(3), iron 3+), a
 * Roman numeral without parentheses (iron III chloride), a malformed numeral, a classical name (ferric chloride:
 * the class uses the Stock system), digits anywhere else, and characters that are not letters, spaces or
 * parentheses. A formula typed where a name is asked is caught by the graders (they try the formula reader).
 */
import { CLASSICAL_NAMES } from './data'
import { romanValue } from './text'
import type { NameParse, NameReading, NmParseError } from './types'

const PREFIXES_WITH_VOWEL = ['mono', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca']
const VOWEL_ROOTS = /^(?:ox|iod|arsen)/

/** Elides the final a/o of a Greek prefix before a vowel root, so both spellings give one key. */
function elide(word: string): string {
  for (const p of PREFIXES_WITH_VOWEL) {
    if (word.startsWith(p) && VOWEL_ROOTS.test(word.slice(p.length))) return p.slice(0, -1) + word.slice(p.length)
  }
  return word
}

const WORD_ALIASES: Readonly<Record<string, string>> = {
  bicarbonate: 'hydrogen carbonate',
  bisulfate: 'hydrogen sulfate',
  bisulfite: 'hydrogen sulfite',
  hydriodic: 'hydroiodic',
  ethanoate: 'acetate',
  ethanoic: 'acetic',
  dimercury: 'mercury(i)',
  // IUPAC writes the hydrogen ions as one word.
  hydrogencarbonate: 'hydrogen carbonate',
  hydrogensulfate: 'hydrogen sulfate',
  hydrogensulfite: 'hydrogen sulfite',
  hydrogensulfide: 'hydrogen sulfide',
  hydrogenphosphate: 'hydrogen phosphate',
  dihydrogenphosphate: 'dihydrogen phosphate',
}

/**
 * The comparison key of a name (no validation). Every name the core prints maps to the key of every accepted
 * spelling of it: nameKey('Iron (III) sulphate') === nameKey('iron(III) sulfate') === 'iron(iii) sulfate'.
 */
export function nameKey(text: string): string {
  let s = (text ?? '').toLowerCase().replace(/[‐-―−]/g, '-')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')')
  s = s.replace(/\)-?(?=[a-z])/g, ') ')
  s = s.replace(/([a-z])-(?=[a-z])/g, '$1')
  s = s.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  s = s.replace(/sulph/g, 'sulf').replace(/aluminium/g, 'aluminum').replace(/caesium/g, 'cesium')
  s = s.replace(/\b(mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca) hydrate\b/g, '$1hydrate')
  const words = s.split(' ').filter((w) => w !== '')
  const out: string[] = []
  for (const w of words) {
    if (w === 'dimercury(i)') {
      out.push('mercury(i)')
      continue
    }
    const alias = WORD_ALIASES[w]
    out.push(...(alias ?? elide(w)).split(' '))
  }
  return out.join(' ')
}

function bad(reason: NmParseError['reason'], message: string, position: number, length?: number): NameParse {
  return { ok: false, error: length === undefined ? { reason, message, position } : { reason, message, position, length } }
}

const ROMAN_WORD = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i

/** Reads a name she typed: validation (see the file comment) and the key. Never throws. */
export function readName(text: string): NameParse {
  const src = text ?? ''
  if (src.trim() === '') return bad('unreadable', 'Type the name first.', 0)
  const digit = src.search(/[0-9₀-₉⁰⁴-⁹¹²³]/)
  if (digit >= 0) {
    const before = src.slice(0, digit)
    const inParens = /\(\s*[+\-−]?\s*$/.test(before)
    const metalNumber = inParens || /[a-z]\s*$/i.test(before)
    if (/hydrate/i.test(src.slice(digit)) && !inParens)
      return bad('not_in_form', 'A name is written in words: use a Greek prefix for the number of water molecules, like penta- for 5.', digit, 1)
    if (metalNumber)
      return bad('not_in_form', 'Write the charge as a Roman numeral in parentheses, right after the metal: (III), not (3).', digit, 1)
    return bad('not_in_form', 'A name is written in words, with no digits.', digit, 1)
  }
  const odd = src.search(/[^A-Za-z\s()\-‐-―−']/)
  if (odd >= 0) return bad('unreadable', `“${src[odd]}” does not belong in a name.`, odd, 1)
  let depth = 0
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '(') {
      if (depth > 0) return bad('unreadable', 'Parentheses do not go inside parentheses in a name.', i, 1)
      depth++
    } else if (src[i] === ')') {
      if (depth === 0) return bad('unreadable', 'This ) has no ( before it.', i, 1)
      depth--
    }
  }
  if (depth > 0) return bad('unreadable', 'This parenthesis is never closed.', src.lastIndexOf('('), 1)
  // Each parenthesized part must be a Roman numeral right after a word.
  const groups = /\(([^)]*)\)/g
  for (let m = groups.exec(src); m; m = groups.exec(src)) {
    const inner = m[1]!.trim()
    if (romanValue(inner) === null)
      return bad(
        /^[ivxlcdm]+$/i.test(inner) ? 'not_in_form' : 'unreadable',
        /^[ivxlcdm]+$/i.test(inner)
          ? `${inner.toUpperCase()} is not a Roman numeral the charges use. Write them as I, II, III, IV, V, VI, VII.`
          : 'Only a Roman numeral for the charge goes in parentheses in a name.',
        m.index,
        m[0].length,
      )
    if (src.slice(0, m.index).trim() === '') return bad('not_in_form', 'The Roman numeral goes right after the metal’s name.', m.index, m[0].length)
  }
  // A Roman numeral standing alone as a word: "iron III chloride".
  const words = /[A-Za-z]+/g
  for (let m = words.exec(src); m; m = words.exec(src)) {
    const w = m[0]
    const insideParens = src.lastIndexOf('(', m.index) > src.lastIndexOf(')', m.index)
    if (ROMAN_WORD.test(w) && !insideParens && m.index > 0)
      return bad('not_in_form', `Put the Roman numeral in parentheses, right after the metal: (${w.toUpperCase()}).`, m.index, w.length)
    const classical = CLASSICAL_NAMES[w.toLowerCase()]
    if (classical && !/^\s*acid\b/i.test(src.slice(m.index + w.length)))
      return bad(
        'not_in_form',
        `“${w}” is the older name for ${classical}. This class uses the Stock system: the metal’s name with its charge as a Roman numeral in parentheses.`,
        m.index,
        w.length,
      )
  }
  const key = nameKey(src)
  const value: NameReading = { key, words: key.split(' ') }
  return { ok: true, value }
}
