/**
 * How the app reads logarithms (the student's course and her TI-84):
 *
 *   log(u)            base 10                 (TI-84 LOG key)
 *   ln(u)             base e                  (TI-84 LN key)
 *   log(u, b)         base b, argument first  (the order of the TI-84's logBASE( and of math.js)
 *   logBASE(u, b)     base b                  (TI-84 MATH > A, any letter case)
 *   log_b(u)          base b: log_2(8), log_(1/2)(8), log_{3}(x), log_e(x) is ln(x), log_10(x) is log(x)
 *   log2(u), log10(u) base 2, base 10: digits typed straight after "log" with "(" next are a base
 *   log 100, ln x, log_2 8, lnx
 *                     a log written without parentheses takes ONE number or ONE letter, and only when
 *                     an operator, ")", "," or the end of the side comes next ("2ln x + 1", "log 100").
 *                     Anything longer ("ln 2x", "log x^2", "ln e^5") is ambiguous on paper, so it is a
 *                     parse error that asks for parentheses.
 *
 * `rewriteLogSyntax` turns every spelling into the canonical text the evaluator reads:
 * `log(u)` (base 10), `ln(u)` (base e) or `log(u, b)` (any other base). It runs on one side of a
 * relation, before whitespace is removed (so `log 2(8)` and `log2(8)` can be told apart).
 */

/** A syntax problem the parser reports with a position into the text it was given. */
export class InputSyntaxError extends Error {
  position: number
  length: number
  constructor(message: string, position: number, length = 1) {
    super(message)
    this.name = 'InputSyntaxError'
    this.position = position
    this.length = length
  }
}

const LETTER = /[A-Za-z]/
const DIGIT = /[0-9.]/

function isLetter(c: string | undefined): boolean {
  return c !== undefined && LETTER.test(c)
}

function isDigit(c: string | undefined): boolean {
  return c !== undefined && DIGIT.test(c)
}

function skipSpaces(s: string, i: number): number {
  let k = i
  while (k < s.length && /\s/.test(s[k]!)) k++
  return k
}

/** Index of the bracket that closes the one at `open` (same kind), or -1. */
function matching(s: string, open: number): number {
  const o = s[open]
  const c = o === '(' ? ')' : o === '{' ? '}' : o === '[' ? ']' : ''
  if (!c) return -1
  let depth = 0
  for (let k = open; k < s.length; k++) {
    if (s[k] === o) depth++
    else if (s[k] === c) {
      depth--
      if (depth === 0) return k
    }
  }
  return -1
}

/**
 * What may come right after a parenthesis-free argument: an operator, a closing bracket, a comma, the end.
 * "^" may not ("ln x^2"), and "*" or "/" only before another log ("ln 7/ln 2"): "ln 1/2" could be
 * ln(1/2) or (ln 1)/2, so it throws and asks for parentheses.
 */
function argumentEndsAt(s: string, k: number, name: 'log' | 'ln'): boolean {
  const j = skipSpaces(s, k)
  if (j >= s.length) return true
  const c = s[j]!
  if (c === '*' || c === '/') {
    if (/^l(?:og|n)/i.test(s.slice(skipSpaces(s, j + 1)))) return true
    throw new InputSyntaxError(
      `Use parentheses to show what the ${name} covers, like ${name}(a)${c}b or ${name}(a${c}b). Without them it is not clear whether the ${c} is inside the ${name}.`,
      j,
    )
  }
  if ('+-=<>),]}|'.includes(c)) return true
  // "or" / "and" between relations never reach here (the statement is split first), but a
  // relation sign typed with a glyph might.
  return '≤≥≠'.includes(c)
}

interface Atom {
  text: string
  end: number
}

/** One number ("100", "0.5", ".5") or one letter ("x", "e", "pi"), starting at k. */
function readAtom(s: string, k: number): Atom | null {
  if (isDigit(s[k])) {
    let j = k
    while (j < s.length && isDigit(s[j])) j++
    const text = s.slice(k, j)
    if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null
    return { text, end: j }
  }
  if (isLetter(s[k])) {
    let j = k
    while (j < s.length && isLetter(s[j])) j++
    const word = s.slice(k, j)
    const lower = word.toLowerCase()
    if (lower === 'pi' || word.length === 1) return { text: lower, end: j }
    return null
  }
  return null
}

interface Group {
  inner: string
  end: number
}

/** A bracketed group starting at k ("(…)" or "{…}"), returning its inside. */
function readGroup(s: string, k: number, name: string): Group {
  const close = matching(s, k)
  if (close < 0) throw new InputSyntaxError(`A closing ${s[k] === '{' ? '}' : ')'} is missing after ${name}.`, k)
  return { inner: s.slice(k + 1, close), end: close + 1 }
}

function needParens(name: string, at: number, len: number): InputSyntaxError {
  const example = name === 'ln' ? 'ln(2x)' : name === 'log' ? 'log(2x)' : `${name}(2x)`
  return new InputSyntaxError(
    `Put the input of ${name} in parentheses, like ${example}. Without them it is not clear how much of what follows belongs to the ${name}.`,
    at,
    len,
  )
}

/** The canonical call for a log with this base text (null base: base 10). */
function logCall(arg: string, base: string | null): string {
  if (base === null) return `log(${arg})`
  const b = base.trim()
  if (b === 'e' || b === 'E') return `ln(${arg})`
  if (b === '10') return `log(${arg})`
  return `log(${arg}, ${b})`
}

/** The base after "log_": digits, e, a letter, or a bracketed group. */
function readBase(s: string, k: number): { text: string; end: number } {
  const j = skipSpaces(s, k)
  if (s[j] === '(' || s[j] === '{') {
    const g = readGroup(s, j, 'the base')
    if (!g.inner.trim()) throw new InputSyntaxError('The base of the log is empty: write it after the _, like log_2(8).', j, g.end - j)
    return { text: rewriteInside(g.inner, j + 1), end: g.end }
  }
  if (isDigit(s[j])) {
    let e = j
    while (e < s.length && isDigit(s[e])) e++
    const text = s.slice(j, e)
    if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw new InputSyntaxError('That base is not a number I can read.', j, e - j)
    return { text, end: e }
  }
  if (isLetter(s[j])) {
    // One letter: a numeric base is the usual case; a letter base (log_b) is read as that letter.
    return { text: s[j]!.toLowerCase(), end: j + 1 }
  }
  throw new InputSyntaxError('Write the base right after the _, like log_2(8).', Math.min(j, s.length - 1))
}

/**
 * Rewrites every log spelling in `src` (one side of a relation, or an expression) to `log(u)`,
 * `ln(u)` or `log(u, b)`. Text without "log"/"ln" comes back unchanged. Throws InputSyntaxError
 * (position into `src`) for a log that needs parentheses.
 */
export function rewriteLogSyntax(src: string): string {
  if (!/l(?:og|n)/i.test(src)) return src
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (!isLetter(c)) {
      out += c
      i++
      continue
    }
    // A run of letters: find log / ln / logbase inside it (xlog(2) is x·log(2)).
    let runEnd = i
    while (runEnd < src.length && isLetter(src[runEnd])) runEnd++
    const run = src.slice(i, runEnd)
    const lower = run.toLowerCase()
    let k = 0
    let handled = false
    while (k < run.length) {
      const at = i + k
      if (lower.startsWith('logbase', k)) {
        const after = skipSpaces(src, i + k + 7)
        const usage = 'logBASE needs its two inputs in parentheses: logBASE(8, 2) is log base 2 of 8.'
        if (k + 7 !== run.length || src[after] !== '(') throw new InputSyntaxError(usage, at, 7)
        // logBASE(8) is a syntax error on the TI-84 too, not base 10.
        if (!hasTopLevelComma(readGroup(src, after, 'logBASE').inner)) throw new InputSyntaxError(usage, at, 7)
        out += 'log'
        i = after
        handled = true
        break
      }
      if (lower.startsWith('log', k) || lower.startsWith('ln', k)) {
        const name = lower.startsWith('log', k) ? 'log' : 'ln'
        const nameEnd = i + k + name.length
        const r = rewriteOneLog(src, at, nameEnd, runEnd, name)
        out += r.text
        i = r.end
        handled = true
        break
      }
      out += run[k]
      k++
    }
    if (!handled) i = runEnd
  }
  return out
}

/** rewriteLogSyntax on a bracketed inside that starts at `offset` in the outer text; error positions stay in the outer text. */
function rewriteInside(inner: string, offset: number): string {
  try {
    return rewriteLogSyntax(inner)
  } catch (e) {
    if (e instanceof InputSyntaxError) throw new InputSyntaxError(e.message, e.position + offset, e.length)
    throw e
  }
}

function hasTopLevelComma(s: string): boolean {
  let depth = 0
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (ch === ',' && depth === 0) return true
  }
  return false
}

/**
 * One log starting at `at` (its name ends at `nameEnd`; the letter run it sits in ends at `runEnd`).
 * Returns the canonical text and where reading continues.
 */
function rewriteOneLog(src: string, at: number, nameEnd: number, runEnd: number, name: 'log' | 'ln'): { text: string; end: number } {
  // Letters glued to the name: "lnx" is ln(x); "logxy" and "lnsqrt(x)" are ambiguous.
  if (nameEnd < runEnd) {
    const atom = readAtom(src, nameEnd)
    if (!atom || atom.end !== runEnd || !argumentEndsAt(src, atom.end, name)) throw needParens(name, at, Math.max(name.length, runEnd - at))
    return { text: name === 'ln' ? `ln(${atom.text})` : logCall(atom.text, null), end: atom.end }
  }
  const next = skipSpaces(src, nameEnd)
  const c = src[next]
  if (c === '(') {
    // A call: log(u), ln(u), log(u, b). Its inside is rewritten by the main loop as it continues.
    return { text: name, end: nameEnd }
  }
  if (c === '_') {
    if (name === 'ln') throw new InputSyntaxError('ln already has base e. For another base write log_b, like log_2(8).', at, next + 1 - at)
    const base = readBase(src, next + 1)
    const open = skipSpaces(src, base.end)
    if (src[open] === '(') {
      const g = readGroup(src, open, 'the log')
      if (!g.inner.trim()) throw new InputSyntaxError('The log has nothing inside its parentheses.', open, g.end - open)
      return { text: logCall(rewriteInside(g.inner, open + 1), base.text), end: g.end }
    }
    const atom = readAtom(src, open)
    if (!atom || !argumentEndsAt(src, atom.end, name)) {
      throw new InputSyntaxError('Put the input of the log in parentheses right after its base: log_2(8) is log base 2 of 8.', at, Math.max(1, open - at))
    }
    return { text: logCall(atom.text, base.text), end: atom.end }
  }
  if (name === 'log' && next === nameEnd && isDigit(c)) {
    // Digits glued to "log": a base when "(" follows (log2(8), log10(x)), else the argument (log100).
    let e = next
    while (e < src.length && isDigit(src[e])) e++
    const digits = src.slice(next, e)
    const open = skipSpaces(src, e)
    if (src[open] === '(') {
      if (!/^\d+$/.test(digits)) throw new InputSyntaxError(`Write a base with an underscore, like log_${digits}(x).`, next, e - next)
      const g = readGroup(src, open, 'the log')
      if (!g.inner.trim()) throw new InputSyntaxError('The log has nothing inside its parentheses.', open, g.end - open)
      return { text: logCall(rewriteInside(g.inner, open + 1), digits), end: g.end }
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(digits) || !argumentEndsAt(src, e, name)) throw needParens(name, at, e - at)
    return { text: logCall(digits, null), end: e }
  }
  if (c === undefined || !(isDigit(c) || isLetter(c))) {
    throw new InputSyntaxError(`${name} needs an input, like ${name}(x).`, at, name.length)
  }
  if (name === 'ln' && next === nameEnd && isDigit(c)) {
    // "ln2" is ln(2); "ln2(x)" is not a thing.
    const atom = readAtom(src, next)
    if (!atom || !argumentEndsAt(src, atom.end, name)) throw needParens(name, at, Math.max(name.length, (atom?.end ?? next + 1) - at))
    return { text: `ln(${atom.text})`, end: atom.end }
  }
  // "log 100", "ln x", "log x + 1": one atom after a space.
  const atom = readAtom(src, next)
  if (!atom || !argumentEndsAt(src, atom.end, name)) throw needParens(name, at, Math.max(name.length, next - at + 1))
  return { text: name === 'ln' ? `ln(${atom.text})` : logCall(atom.text, null), end: atom.end }
}
