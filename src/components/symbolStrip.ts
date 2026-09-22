/**
 * Symbol strip tokens + caret math (UX-01/UX-02). Pure, unit-tested.
 * Keys insert ASCII parser tokens; the label is the pretty glyph. `caret` is the offset from the
 * END of the inserted token where the caret lands (−1 = just inside the closing paren).
 */
export interface StripKey {
  label: string
  insert: string
  /** Offset from the end of `insert` (0 = after it, −1 = one char before its end). */
  caret: number
  /** Accessible name when the label is a bare glyph. */
  name: string
}

export const STRIP_KEYS: readonly StripKey[] = [
  { label: 'x', insert: 'x', caret: 0, name: 'x' },
  { label: 'y', insert: 'y', caret: 0, name: 'y' },
  { label: '^', insert: '^', caret: 0, name: 'power' },
  { label: '(', insert: '(', caret: 0, name: 'open parenthesis' },
  { label: ')', insert: ')', caret: 0, name: 'close parenthesis' },
  { label: '/', insert: '/', caret: 0, name: 'divide' },
  { label: '=', insert: ' = ', caret: 0, name: 'equals' },
  { label: '<', insert: ' < ', caret: 0, name: 'less than' },
  { label: '≤', insert: ' <= ', caret: 0, name: 'less than or equal' },
  { label: '>', insert: ' > ', caret: 0, name: 'greater than' },
  { label: '≥', insert: ' >= ', caret: 0, name: 'greater than or equal' },
  { label: '√', insert: 'sqrt()', caret: -1, name: 'square root' },
  { label: '³√', insert: 'cbrt()', caret: -1, name: 'cube root' },
  { label: '| |', insert: 'abs()', caret: -1, name: 'absolute value' },
  { label: '∞', insert: 'inf', caret: 0, name: 'infinity' },
  { label: '∪', insert: ' U ', caret: 0, name: 'union' },
  { label: '{ }', insert: '{}', caret: -1, name: 'set braces' },
  { label: 'π', insert: 'pi', caret: 0, name: 'pi' },
  { label: '±', insert: '+-', caret: 0, name: 'plus or minus' },
  { label: 'or', insert: ' or ', caret: 0, name: 'or' },
  { label: '[', insert: '[', caret: 0, name: 'open bracket' },
  { label: ']', insert: ']', caret: 0, name: 'close bracket' },
  { label: '≠', insert: ' != ', caret: 0, name: 'not equal' },
  { label: '|', insert: ' | ', caret: 0, name: 'such that' },
]

const stripKey = (label: string): StripKey => {
  const k = STRIP_KEYS.find((key) => key.label === label)
  if (!k) throw new Error(`no strip key labelled ${label}`)
  return k
}

/** Difference quotient: expressions in x and h only, so no relation, interval or set keys. */
export const DIFF_QUOTIENT_KEYS: readonly StripKey[] = [
  stripKey('x'),
  { label: 'h', insert: 'h', caret: 0, name: 'h' },
  stripKey('^'),
  stripKey('('),
  stripKey(')'),
  stripKey('/'),
  stripKey('√'),
]

/** Domain and range: interval notation, set-builder, and "all real numbers except …". */
export const SET_ANSWER_KEYS: readonly StripKey[] = [
  stripKey('x'),
  stripKey('('),
  stripKey(')'),
  stripKey('['),
  stripKey(']'),
  stripKey('∞'),
  stripKey('∪'),
  stripKey('{ }'),
  stripKey('|'),
  stripKey('<'),
  stripKey('≤'),
  stripKey('>'),
  stripKey('≥'),
  stripKey('≠'),
  stripKey('or'),
]

/** Formulas for f, g, and (f ∘ g)(x): the keys a function actually uses. */
export const FUNCTION_KEYS: readonly StripKey[] = [
  stripKey('x'),
  stripKey('^'),
  stripKey('('),
  stripKey(')'),
  stripKey('/'),
  stripKey('√'),
  stripKey('³√'),
  stripKey('| |'),
]

export interface Insertion {
  value: string
  caret: number
}

/**
 * Insert `key.insert` replacing [selStart, selEnd) and return the new value + caret.
 * A selection wrapped by a paren-token (sqrt(), abs(), {}) goes INSIDE the parens.
 * Leading/trailing spaces of spaced tokens collapse against existing whitespace.
 */
export function insertToken(value: string, selStart: number, selEnd: number, key: StripKey): Insertion {
  const start = Math.max(0, Math.min(selStart, selEnd, value.length))
  const end = Math.min(value.length, Math.max(selStart, selEnd, 0))
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  let after = value.slice(end)

  let token = key.insert
  if (token.startsWith(' ') && (before.endsWith(' ') || before.length === 0)) token = token.slice(1)
  if (token.endsWith(' ') && /^\s/.test(after)) {
    token = token.slice(0, -1)
    after = after.replace(/^\s+/, ' ')
  }

  if (key.caret < 0 && selected.length > 0) {
    // wrap: sqrt(|selected|)
    const cut = token.length + key.caret
    const wrapped = token.slice(0, cut) + selected + token.slice(cut)
    return { value: before + wrapped + after, caret: before.length + cut + selected.length }
  }
  return { value: before + token + after, caret: before.length + token.length + key.caret }
}
