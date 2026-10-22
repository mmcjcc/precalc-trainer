/**
 * The math keypad's keys and edits, kept pure so they are unit-tested without a DOM.
 *
 * The keypad replaces the phone's keyboard for math answers on touch screens. It only ever inserts
 * text into the box, exactly as the symbol strip does (`insertToken`): the caret, the live preview,
 * the parser and the grading never know which keyboard she used. Every key is a `StripKey`, so a key
 * here and a key on a box's strip insert the same characters.
 */
import { STRIP_KEYS, insertToken, type Insertion, type StripKey } from './symbolStrip'

/** A key of the fixed grid; `area` is its cell in the CSS grid (`.kp-grid` in index.css). */
export interface GridKey extends StripKey {
  area: string
  tone: 'digit' | 'op'
}

function stripKey(label: string): StripKey {
  const k = STRIP_KEYS.find((key) => key.label === label)
  if (!k) throw new Error(`no strip key labelled ${label}`)
  return k
}

/** A letter the box allows (x, y, n, h, i). */
export function letterKey(letter: string): StripKey {
  return { label: letter, insert: letter, caret: 0, name: letter }
}

const digit = (d: string): GridKey => ({ label: d, insert: d, caret: 0, name: d, area: `d${d}`, tone: 'digit' })
const op = (label: string, insert: string, name: string, area: string): GridKey => ({ label, insert, caret: 0, name, area, tone: 'op' })

/**
 * The keys every math box gets. `×` and `÷` insert what the parser reads (`*`, `/`); `x²` squares
 * what comes before it, like the TI-84 key; `=` is the strip's spaced `=`.
 */
export const GRID_KEYS: readonly GridKey[] = [
  op('^', '^', 'power', 'pow'),
  digit('7'),
  digit('8'),
  digit('9'),
  op('÷', '/', 'divide', 'div'),
  op('(', '(', 'open parenthesis', 'lp'),
  op(')', ')', 'close parenthesis', 'rp'),
  digit('4'),
  digit('5'),
  digit('6'),
  op('×', '*', 'times', 'mul'),
  op(',', ',', 'comma', 'comma'),
  op('x²', '^2', 'squared', 'sq'),
  digit('1'),
  digit('2'),
  digit('3'),
  op('−', '-', 'minus', 'sub'),
  digit('0'),
  { ...digit('.'), name: 'point', area: 'dot' },
  { ...stripKey('='), area: 'eq', tone: 'op' },
  op('+', '+', 'plus', 'add'),
]

const GRID_INSERTS = new Set(GRID_KEYS.map((k) => k.insert.trim()))

const isLetter = (k: StripKey) => /^[a-z]$/i.test(k.insert)

export interface KeypadLayout {
  /** The letter in the grid's first cell: the box's first variable, x when it names none. */
  primary: StripKey
  /** The context row: the box's other letters, then its strip keys the grid does not already have. */
  context: StripKey[]
}

/**
 * Split a box's strip keys into the grid letter and the context row. `vars` replaces the strip's
 * letters when the box takes other ones (a range is written in y; the strip only offers x).
 */
export function keypadLayout(keys: readonly StripKey[] = [], vars?: readonly string[]): KeypadLayout {
  const letters = vars ? vars.map(letterKey) : keys.filter(isLetter)
  const primary = letters[0] ?? letterKey('x')
  const seen = new Set<string>([primary.insert])
  const context: StripKey[] = []
  for (const k of [...letters.slice(1), ...keys.filter((key) => !isLetter(key) && !GRID_INSERTS.has(key.insert.trim()))]) {
    if (seen.has(k.insert)) continue
    seen.add(k.insert)
    context.push(k)
  }
  return { primary, context }
}

/** Every key a box's keypad shows: what backspace treats as one tap. */
export function allKeys(layout: KeypadLayout): StripKey[] {
  return [...GRID_KEYS, layout.primary, ...layout.context]
}

function clampSel(value: string, a: number, b: number): [number, number] {
  const start = Math.max(0, Math.min(a, b, value.length))
  const end = Math.min(value.length, Math.max(a, b, 0))
  return [start, end]
}

/**
 * Insert a key at the caret, or over the selection: the strip's own insertion. One exception: a closing
 * bracket typed just before the same closing bracket steps over it, as a code editor does. A function key
 * (ln, √, log_) types its own ")", and she taps ")" to close it anyway; on the emulator that left
 * "x ln(2)|))" with a stray bracket the parser rejected.
 */
export function insertKey(value: string, selStart: number, selEnd: number, key: StripKey): Insertion {
  const closer = key.insert === ')' || key.insert === ']' || key.insert === '}'
  if (closer && selStart === selEnd && value[selStart] === key.insert) return { value, caret: selStart + 1 }
  return insertToken(value, selStart, selEnd, key)
}

/**
 * Backspace. A selection is deleted. Otherwise one tap undoes one key: an empty template the keypad
 * typed (`sqrt(|)`, `log_|()`, `{|}`) goes with its brackets, a spaced token (` = `, ` <= `, ` or `)
 * goes with its spaces, and a name typed in one tap (`pi`, `inf`) goes whole. Anything else is one
 * character, as on any keyboard.
 */
export function deleteBackward(value: string, selStart: number, selEnd: number, keys: readonly StripKey[]): Insertion {
  const [start, end] = clampSel(value, selStart, selEnd)
  if (start !== end) return { value: value.slice(0, start) + value.slice(end), caret: start }
  if (start === 0) return { value, caret: 0 }
  const before = value.slice(0, start)
  const after = value.slice(start)

  for (const key of keys) {
    if (key.caret >= 0) continue
    const cut = key.insert.length + key.caret
    const open = key.insert.slice(0, cut)
    const close = key.insert.slice(cut)
    if (open && before.endsWith(open) && after.startsWith(close)) {
      return { value: before.slice(0, before.length - open.length) + after.slice(close.length), caret: start - open.length }
    }
  }

  const trimmed = before.replace(/\s+$/, '')
  const spaced = keys
    .filter((k) => k.insert !== k.insert.trim() && k.insert.trim().length > 0)
    .sort((a, b) => b.insert.trim().length - a.insert.trim().length)
  for (const key of spaced) {
    const core = key.insert.trim()
    if (!trimmed.endsWith(core)) continue
    let cut = trimmed.length - core.length
    // A word (or, U) only counts on its own: "for" does not end with the key "or".
    if (/^[a-z]/i.test(core) && /[a-z]/i.test(trimmed[cut - 1] ?? '')) continue
    if (key.insert.startsWith(' ') && trimmed[cut - 1] === ' ') cut -= 1
    return { value: before.slice(0, cut) + after, caret: cut }
  }

  for (const key of keys) {
    if (!/^[a-z]{2,}$/i.test(key.insert) || !before.endsWith(key.insert)) continue
    const cut = before.length - key.insert.length
    if (/[a-z]/i.test(before[cut - 1] ?? '')) continue
    return { value: before.slice(0, cut) + after, caret: cut }
  }

  return { value: before.slice(0, -1) + after, caret: start - 1 }
}

/** Caret left or right by one character; with a selection, to its start or end. */
export function moveCaret(value: string, selStart: number, selEnd: number, dir: -1 | 1): number {
  const [start, end] = clampSel(value, selStart, selEnd)
  if (start !== end) return dir < 0 ? start : end
  return Math.max(0, Math.min(value.length, start + dir))
}

export interface Span {
  top: number
  bottom: number
}

/**
 * How far to scroll (positive = down) so that what matters around a box sits in the band of screen
 * above the keypad. In order of preference: the whole region (the part's card, with the message about
 * her answer), the box's own block (its preview and the box) down to the region's end, that block, and
 * at least the box itself, which is never left behind the keypad.
 */
export function revealDelta(box: Span, block: Span, region: Span, band: Span): number {
  const room = band.bottom - band.top
  const fits = (s: Span) => s.bottom - s.top <= room
  const target = [region, { top: block.top, bottom: region.bottom }, block].find(fits) ?? box
  let delta = 0
  if (target.bottom > band.bottom) delta = target.bottom - band.bottom
  if (target.top - delta < band.top) delta = target.top - band.top
  if (box.bottom - delta > band.bottom) delta = box.bottom - band.bottom
  if (box.top - delta < band.top) delta = box.top - band.top
  return Math.round(delta)
}

/** The strip's own keys, by label (so a keypad key inserts exactly what the strip key does). */
export const keysWith = (labels: readonly string[]): StripKey[] => labels.map(stripKey)

/**
 * Context keys for answer boxes that never had a strip (the keypad replaces the phone keyboard there,
 * so it must offer what those answers are written with).
 */
export const KEYPAD_SETS = {
  /** A number: digits and operations only. */
  number: [] as readonly StripKey[],
  /** Exact numbers that may hold a radical (zeros of a polynomial). */
  radical: keysWith(['√']),
  /** A list of candidates written with ± (rational zeros). */
  plusMinus: keysWith(['±', '√']),
  /** Interval notation. */
  interval: keysWith(['[', ']', '∞', '∪']),
  /** A solution set: {2, 3}, or the numbers with commas. */
  set: keysWith(['{ }']),
  /** A condition like -2 <= x < 3 (a piece of a piecewise function). */
  condition: keysWith(['<', '≤', '>', '≥', '∞']),
  /** Equations and points in x and y (asymptotes, intercepts). */
  xy: [letterKey('x'), letterKey('y')] as readonly StripKey[],
  /**
   * Optimization's equations: x and y, and the letter of the quantity made largest (A here; a revenue or a product box
   * passes its own letter as `vars`). The grid already has =, x² and the digits.
   */
  optimization: [letterKey('x'), letterKey('y'), letterKey('A')] as readonly StripKey[],
  /**
   * Angles and the unit circle: π, √, the degree sign and the word for a value that does not exist first (the
   * answers use them), then the six functions (a name she may write before her answer, "sin θ = …").
   */
  trig: [
    ...keysWith(['π', '√']),
    { label: '°', insert: '°', caret: 0, name: 'degrees' },
    { label: 'undefined', insert: 'undefined', caret: 0, name: 'undefined' },
    { label: 'sin', insert: 'sin()', caret: -1, name: 'sine' },
    { label: 'cos', insert: 'cos()', caret: -1, name: 'cosine' },
    { label: 'tan', insert: 'tan()', caret: -1, name: 'tangent' },
    { label: 'csc', insert: 'csc()', caret: -1, name: 'cosecant' },
    { label: 'sec', insert: 'sec()', caret: -1, name: 'secant' },
    { label: 'cot', insert: 'cot()', caret: -1, name: 'cotangent' },
  ] as readonly StripKey[],
  /**
   * Unit 5, graphs of the trig functions: an equation or an expression in x. x in the grid's first cell, then π, √ and
   * the six functions (sin( lands inside its parenthesis). The grid has =, ^, the comma and the digits.
   */
  trigGraph: [
    letterKey('x'),
    ...keysWith(['π', '√']),
    { label: 'sin', insert: 'sin()', caret: -1, name: 'sine' },
    { label: 'cos', insert: 'cos()', caret: -1, name: 'cosine' },
    { label: 'tan', insert: 'tan()', caret: -1, name: 'tangent' },
    { label: 'csc', insert: 'csc()', caret: -1, name: 'cosecant' },
    { label: 'sec', insert: 'sec()', caret: -1, name: 'secant' },
    { label: 'cot', insert: 'cot()', caret: -1, name: 'cotangent' },
  ] as readonly StripKey[],
  /** Unit 5, a sinusoidal model in t: t in the grid, then π, sin and cos. */
  trigModel: [
    letterKey('t'),
    ...keysWith(['π']),
    { label: 'sin', insert: 'sin()', caret: -1, name: 'sine' },
    { label: 'cos', insert: 'cos()', caret: -1, name: 'cosine' },
  ] as readonly StripKey[],
  /** Unit 5, a phase shift: π, then the direction in one tap each. */
  trigShift: [
    ...keysWith(['π']),
    { label: 'right', insert: ' right', caret: 0, name: 'to the right' },
    { label: 'left', insert: ' left', caret: 0, name: 'to the left' },
  ] as readonly StripKey[],
  /** Unit 5, x-values as a family x = a + kp: x, the integer k, π. The grid has = and the comma for a list. */
  trigFamily: [letterKey('x'), letterKey('k'), ...keysWith(['π'])] as readonly StripKey[],
  /** Unit 5, exact points and values: π and √ (the grid has the parentheses and the comma). */
  trigExact: keysWith(['π', '√']),
  /**
   * Unit 5, an inverse function's value: π, √, the degree sign, then the inverse functions (a name she may write before
   * her answer, "sin⁻¹(1/2) = …"). No word for a missing value: the part has its own button.
   */
  trigInverse: [
    ...keysWith(['π', '√']),
    { label: '°', insert: '°', caret: 0, name: 'degrees' },
    { label: 'sin⁻¹', insert: 'sin⁻¹()', caret: -1, name: 'inverse sine' },
    { label: 'cos⁻¹', insert: 'cos⁻¹()', caret: -1, name: 'inverse cosine' },
    { label: 'tan⁻¹', insert: 'tan⁻¹()', caret: -1, name: 'inverse tangent' },
  ] as readonly StripKey[],
  /** Unit 5, a value at a reference triangle's point: π, √, then the six functions (a name before her answer). */
  trigValue: [
    ...keysWith(['π', '√']),
    { label: 'sin', insert: 'sin()', caret: -1, name: 'sine' },
    { label: 'cos', insert: 'cos()', caret: -1, name: 'cosine' },
    { label: 'tan', insert: 'tan()', caret: -1, name: 'tangent' },
    { label: 'csc', insert: 'csc()', caret: -1, name: 'cosecant' },
    { label: 'sec', insert: 'sec()', caret: -1, name: 'secant' },
    { label: 'cot', insert: 'cot()', caret: -1, name: 'cotangent' },
  ] as readonly StripKey[],
  /**
   * The grapher's rows (pages/Grapher.tsx). Letters first, as every box's keypad puts them: x in the grid's first cell,
   * then y, the usual slider letters (y = a(x − h)² + k, y = mx + b... ) and e; then √, |x|, the trig functions, ln,
   * log, π, the inequality signs for shading, braces for a restriction ({x > 0}) and f(x). The grid has ^, =, x² and
   * the digits.
   */
  graph: [
    letterKey('x'),
    letterKey('y'),
    letterKey('a'),
    letterKey('b'),
    letterKey('h'),
    letterKey('k'),
    { label: 'e', insert: 'e', caret: 0, name: 'e' },
    ...keysWith(['√']),
    { label: '|x|', insert: 'abs()', caret: -1, name: 'absolute value' },
    { label: 'sin', insert: 'sin()', caret: -1, name: 'sine' },
    { label: 'cos', insert: 'cos()', caret: -1, name: 'cosine' },
    { label: 'tan', insert: 'tan()', caret: -1, name: 'tangent' },
    { label: 'ln', insert: 'ln()', caret: -1, name: 'natural log' },
    { label: 'log', insert: 'log()', caret: -1, name: 'log base 10' },
    ...keysWith(['π', '<', '≤', '>', '≥', '{ }']),
    { label: 'f(x)', insert: 'f(x)', caret: 0, name: 'f of x' },
  ] as readonly StripKey[],
} as const
