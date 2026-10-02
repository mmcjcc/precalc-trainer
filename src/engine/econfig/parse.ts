/**
 * Reading what she types. Never throws: a problem comes back as a ParseError with a 0-based character
 * position into her ORIGINAL text.
 *
 * A configuration:
 *   - full ("1s2 2s2 2p6 3s1") or shorthand ("[Ne] 3s1"); the bracketed core must come first;
 *   - subshells separated by spaces, commas or semicolons, or not separated at all ("1s22s22p6", "1s²2s²2p⁶");
 *   - counts written "2p6", "2p^6", "2p^{6}" or with superscript digits "2p⁶";
 *   - letters in either case ("1S2 2P6", "[ar]");
 *   - any order (4s2 3d6 or 3d6 4s2): the order she types is kept in `terms` and never graded.
 * It reads ANY shell number 1 to 9 and letter s p d f, so 1p, 2d and 2p7 parse: naming those is the graders'
 * job. A subshell written twice, a missing count and a noble gas without brackets are parse errors.
 */
import type { ParseError } from '@/shared/types'
import { ELEMENTS, type ElementInfo } from '../chem/elements'
import { plainSuperscripts } from './model'
import type { ConfigurationParse, ParsedCore, ParsedTerm, SpeciesAnswerParse, SubshellLetter } from './types'

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function isDigit(ch: string | undefined): ch is string {
  return ch !== undefined && ch >= '0' && ch <= '9'
}

function isSuperscript(ch: string | undefined): ch is string {
  return ch !== undefined && SUPERSCRIPT_DIGITS.includes(ch)
}

function isLetter(ch: string | undefined): ch is string {
  return ch !== undefined && /[A-Za-z]/.test(ch)
}

function isSeparator(ch: string | undefined): boolean {
  return ch !== undefined && /[\s,;]/.test(ch)
}

function error(message: string, position: number, length?: number): { ok: false; error: ParseError } {
  return { ok: false, error: length === undefined ? { message, position } : { message, position, length } }
}

function elementBySymbolLoose(symbol: string): ElementInfo | undefined {
  const lower = symbol.toLowerCase()
  return ELEMENTS.find((e) => e.symbol.toLowerCase() === lower)
}

const TOO_MANY = 'No subshell holds that many electrons. Write the count as one or two digits, like 2p6 or 3d10.'

export function parseConfiguration(text: string): ConfigurationParse {
  const src = text ?? ''
  if (src.trim() === '') return error('Type the configuration, like 1s2 2s2 2p3.', 0)
  let i = 0
  let core: ParsedCore | null = null
  const terms: ParsedTerm[] = []
  const seen = new Set<string>()

  for (;;) {
    while (isSeparator(src[i])) i++
    if (i >= src.length) break
    const ch = src[i]!

    // The noble-gas core.
    if (ch === '[' || ch === '(' || ch === '{') {
      const close = ch === '[' ? ']' : ch === '(' ? ')' : '}'
      const end = src.indexOf(close, i + 1)
      if (end < 0) return error('This bracket is never closed. Write the noble gas like [Ar].', i, 1)
      const length = end - i + 1
      const symbol = src.slice(i + 1, end).trim()
      if (ch !== '[') return error('Use square brackets for the noble gas, like [Ar].', i, length)
      if (symbol === '') return error('Put the symbol of a noble gas inside the brackets, like [Ne].', i, length)
      if (!/^[A-Za-z]+$/.test(symbol)) return error('Inside the brackets goes just the symbol of a noble gas, like [Ar].', i, length)
      const el = elementBySymbolLoose(symbol)
      if (!el) return error(`No element has the symbol “${symbol}”. The core is a noble gas: [He], [Ne] or [Ar].`, i, length)
      if (core) return error('Use only one noble gas, at the very start.', i, length)
      if (terms.length > 0) return error('The noble gas goes first, before the subshells.', i, length)
      core = { symbol: el.symbol, z: el.z, nobleGas: el.group === 18, position: i, length }
      i = end + 1
      continue
    }

    // A word where a subshell should start.
    if (isLetter(ch)) {
      let j = i
      while (isLetter(src[j])) j++
      const word = src.slice(i, j)
      const gas = elementBySymbolLoose(word)
      if (gas && gas.group === 18 && terms.length === 0 && !core) return error(`Put the noble gas in square brackets: [${gas.symbol}].`, i, j - i)
      if (/^[spdf]$/i.test(word)) return error(`Write the shell number in front of the letter, like 2${word.toLowerCase()}.`, i, 1)
      return error('A subshell is a shell number and a letter, like 2p, followed by its number of electrons.', i, j - i)
    }
    if (isSuperscript(ch)) return error('A raised number goes after a subshell, like 2p⁶. Start each subshell with its shell number on the line.', i, 1)
    if (!isDigit(ch)) return error(`“${ch}” does not belong in a configuration. Write the subshells like 1s2 2s2 2p6.`, i, 1)

    // One subshell: shell number, letter, count.
    const start = i
    if (ch === '0') return error('Shells are numbered from 1.', i, 1)
    const n = Number(ch)
    i++
    const letter = src[i]
    if (!isLetter(letter)) return error('After the shell number comes the subshell letter: s, p, d or f (like 2p6).', start, 1)
    if (!/[spdf]/i.test(letter)) return error(`“${letter}” is not a subshell letter. The subshells are s, p, d and f.`, i, 1)
    const l = letter.toLowerCase() as SubshellLetter
    i++
    const name = `${n}${l}`
    const missing = () => error(`Write how many electrons are in ${name}, like ${name}${l === 's' ? 2 : l === 'p' ? 6 : 10}.`, start, 2)

    let digits = ''
    const caret = src[i] === '^'
    if (caret) i++
    if (caret && (src[i] === '{' || src[i] === '(')) {
      const close = src[i] === '{' ? '}' : ')'
      const end = src.indexOf(close, i + 1)
      if (end < 0) return error('This bracket is never closed.', i, 1)
      digits = plainSuperscripts(src.slice(i + 1, end).trim())
      if (!/^\d+$/.test(digits)) return missing()
      i = end + 1
    } else if (isSuperscript(src[i])) {
      while (isSuperscript(src[i])) digits += String(SUPERSCRIPT_DIGITS.indexOf(src[i++]!))
    } else if (isDigit(src[i])) {
      let j = i
      while (isDigit(src[j])) j++
      // "1s22s2": the digit just before a letter is the next subshell's shell number, not part of this count.
      if (src[j] !== undefined && /[spdf]/i.test(src[j]!)) j--
      if (j === i) return missing()
      digits = src.slice(i, j)
      i = j
    } else {
      return missing()
    }
    if (digits.length > 2) return error(TOO_MANY, start, i - start)
    if (seen.has(name)) return error(`${name} is written twice. Write each subshell once, with all of its electrons.`, start, i - start)
    seen.add(name)
    const count = Number(digits)
    if (count > 0) terms.push({ n, l, count, position: start, length: i - start })
  }

  if (!core && terms.length === 0) return error('Type the configuration, like 1s2 2s2 2p3.', 0)
  return { ok: true, value: { core, terms } }
}

// ---------------------------------------------------------------------------
// "Which element is this?": a symbol or a name, with an optional charge
// ---------------------------------------------------------------------------

function elementByName(name: string): ElementInfo | undefined {
  const lower = name.toLowerCase()
  const alias = lower === 'aluminium' ? 'aluminum' : lower === 'sulphur' ? 'sulfur' : lower
  return ELEMENTS.find((e) => e.name === alias)
}

/**
 * "Fe", "fe", "iron", "Fe3+", "Fe 3+", "Fe^3+", "Fe+3", "Fe³⁺", "Cl-", "Cl−". The symbol is matched whatever
 * the case. A charge is optional (null when she wrote none).
 */
export function parseSpeciesAnswer(text: string): SpeciesAnswerParse {
  const src = text ?? ''
  const lead = src.length - src.trimStart().length
  const t = plainSuperscripts(src).trim()
  if (t === '') return error('Type the element’s symbol or name, like Fe or iron.', 0)
  const m = /^([A-Za-z]+)\s*(.*)$/.exec(t)
  if (!m) return error('Start with the element’s symbol or name, like Fe.', lead, 1)
  const word = m[1]!
  const rest = m[2]!
  const restAt = lead + t.length - rest.length
  let charge: number | null = null
  if (rest !== '') {
    const c = /^\^?\s*\(?\s*(?:(\d)?\s*([+-])|([+-])\s*(\d))\s*\)?$/.exec(rest)
    if (!c) {
      if (/^\^?\s*\(?\s*\d\s*\)?$/.test(rest)) return error('Give the charge a sign: 3+ for positive, 2- for negative.', restAt, rest.length)
      return error('After the element, write only its charge, like Fe3+ or Cl-.', restAt, rest.length)
    }
    const sign = c[2] ?? c[3]
    const size = Number(c[1] ?? c[4] ?? 1)
    charge = (sign === '-' ? -size : size) || 0
  }
  const bySymbol = word.length <= 2 ? elementBySymbolLoose(word) : undefined
  const byName = bySymbol ? undefined : elementByName(word)
  const el = bySymbol ?? byName
  if (!el)
    return error(
      word.length <= 2 ? `No element has the symbol “${word}”.` : `“${word}” is not the name of an element. Type its symbol or name, like Fe or iron.`,
      lead,
      word.length,
    )
  return { ok: true, value: { z: el.z, symbol: el.symbol, charge, byName: !bySymbol } }
}
