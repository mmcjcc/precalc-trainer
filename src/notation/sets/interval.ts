/**
 * Interval-notation parser with exact endpoints and the specific rejections the research asks for.
 *
 * Grammar (whitespace is free):
 *   set      := piece ( union piece )*
 *   piece    := ( '(' | '[' ) endpoint ',' endpoint ( ')' | ']' )
 *             | '{' [ endpoint ( ',' endpoint )* ] '}'
 *             | R | ℝ | ∅ | DNE
 *   endpoint := [ + | - ] ( number [ '/' integer ] | inf | infinity | oo | ∞ )
 *   union    := U | u | ∪ | or
 *
 * Every error carries a 0-based position into the ORIGINAL text (the tokenizer works on the
 * original string, so unicode glyphs never shift positions).
 */
import type { Endpoint, ParseError, PatternHit, Piece, Rational, SolutionSet } from '@/shared/types'
import { ratCompare, ratDiv, ratFromString, ratNeg } from '../rational'
import { endpointToString, isFiniteEndpoint, normalizeSet, setToInterval } from './solutionSet'
import { patternHit } from './patterns'

export type IntervalParseOk = { ok: true; set: SolutionSet; pieceCount: number; note?: string }
export type IntervalParseFail = { ok: false; error: ParseError; pattern?: PatternHit }
export type IntervalParseResult = IntervalParseOk | IntervalParseFail

type TokKind =
  | 'open'
  | 'close'
  | 'lbrace'
  | 'rbrace'
  | 'comma'
  | 'slash'
  | 'sign'
  | 'num'
  | 'inf'
  | 'union'
  | 'empty'
  | 'reals'
  | 'word'
  | 'other'

interface Tok {
  kind: TokKind
  text: string
  pos: number
}

const INF_WORDS = new Set(['inf', 'infinity', 'oo'])
const UNION_WORDS = new Set(['u', 'or', 'union'])
const REALS_WORDS = new Set(['r', 'reals'])
const EMPTY_WORDS = new Set(['dne'])

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    let kind: TokKind | null = null
    let text = c
    if (c === '(' || c === '[') kind = 'open'
    else if (c === ')' || c === ']') kind = 'close'
    else if (c === '{') kind = 'lbrace'
    else if (c === '}') kind = 'rbrace'
    else if (c === ',') kind = 'comma'
    else if (c === '/') kind = 'slash'
    else if (c === '+') kind = 'sign'
    else if (c === '-' || c === '−' || c === '–' || c === '—') {
      kind = 'sign'
      text = '-'
    } else if (c === '∞') kind = 'inf'
    else if (c === '∪') kind = 'union'
    else if (c === '∅') kind = 'empty'
    else if (c === 'ℝ') kind = 'reals'
    if (kind) {
      toks.push({ kind, text, pos: i })
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++
      toks.push({ kind: 'num', text: src.slice(i, j), pos: i })
      i = j
      continue
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i + 1
      while (j < src.length && /[A-Za-z]/.test(src[j]!)) j++
      const word = src.slice(i, j)
      const lower = word.toLowerCase()
      const k: TokKind = INF_WORDS.has(lower)
        ? 'inf'
        : UNION_WORDS.has(lower)
          ? 'union'
          : EMPTY_WORDS.has(lower)
            ? 'empty'
            : REALS_WORDS.has(lower)
              ? 'reals'
              : 'word'
      toks.push({ kind: k, text: word, pos: i })
      i = j
      continue
    }
    toks.push({ kind: 'other', text: c, pos: i })
    i++
  }
  return toks
}

class Fail extends Error {
  constructor(
    readonly error: ParseError,
    readonly pattern?: PatternHit,
  ) {
    super(error.message)
  }
}

function fail(message: string, position: number, length?: number, pattern?: PatternHit): never {
  const error: ParseError = length === undefined ? { message, position } : { message, position, length }
  throw new Fail(error, pattern)
}

/** Print a piece, forcing round brackets next to ±∞ (used to suggest corrections). */
function formatPiece(lo: Endpoint, hi: Endpoint, loClosed: boolean, hiClosed: boolean): string {
  const open = lo === '-inf' ? '(' : loClosed ? '[' : '('
  const close = hi === 'inf' ? ')' : hiClosed ? ']' : ')'
  return `${open}${endpointToString(lo)}, ${endpointToString(hi)}${close}`
}

interface EndpointRead {
  value: Endpoint
  pos: number
  end: number
}

class Parser {
  private i = 0
  readonly pieces: Piece[] = []
  readonly points: Rational[] = []
  /** Number of pieces/points the student typed (before normalization). */
  typed = 0

  constructor(
    private readonly toks: Tok[],
    private readonly src: string,
  ) {}

  private peek(): Tok | undefined {
    return this.toks[this.i]
  }

  private next(): Tok | undefined {
    return this.toks[this.i++]
  }

  private get endPos(): number {
    return this.src.length
  }

  parseAll(): void {
    this.parsePiece()
    for (;;) {
      const t = this.peek()
      if (!t) return
      if (t.kind === 'union') {
        this.next()
        if (!this.peek()) fail('Finish the union — what comes after U?', this.endPos)
        this.parsePiece()
        continue
      }
      if (
        t.kind === 'open' ||
        t.kind === 'lbrace' ||
        t.kind === 'empty' ||
        t.kind === 'reals' ||
        t.kind === 'comma'
      ) {
        const cut = t.kind === 'comma' ? t.pos + 1 : t.pos
        const fixed = `${this.src.slice(0, t.pos).trim()} U ${this.src.slice(cut).trim()}`
        fail(
          `Two separate pieces need U between them: ${fixed}. One interval can't have a gap.`,
          t.pos,
          t.text.length,
          patternHit('dropped_union'),
        )
      }
      fail(`Unexpected "${t.text}" — use interval notation like (-inf, 2] U {5}.`, t.pos, t.text.length)
    }
  }

  private parsePiece(): void {
    const t = this.peek()
    if (!t) fail('Type an interval, like (-inf, 2] U {5}.', this.endPos)
    switch (t.kind) {
      case 'open':
        this.parseInterval()
        return
      case 'lbrace':
        this.parseBraces()
        return
      case 'empty':
        this.next()
        return
      case 'reals':
        this.next()
        this.pieces.push({ lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false })
        this.typed++
        return
      case 'word':
        fail(
          `This box takes interval notation like (-inf, 2] — a condition like ${t.text} <= 2 belongs in the set-builder box.`,
          t.pos,
          t.text.length,
        )
      case 'sign':
      case 'num':
      case 'inf': {
        const ep = this.readEndpoint()
        if (isFiniteEndpoint(ep.value)) {
          const v = endpointToString(ep.value)
          fail(
            `On its own, ${v} isn't a set. A single point is written {${v}}; a range needs two endpoints, like (-inf, ${v}].`,
            ep.pos,
            ep.end - ep.pos,
          )
        }
        fail('∞ is a direction, not a point — a ray looks like (5, inf).', ep.pos, ep.end - ep.pos)
      }
      case 'close':
        fail(`Intervals start with ( or [ — "${t.text}" can't come first.`, t.pos, 1)
      default:
        fail(`Unexpected "${t.text}" — use interval notation like (-inf, 2] U {5}.`, t.pos, t.text.length)
    }
  }

  private readEndpoint(): EndpointRead {
    const start = this.peek()
    if (!start) fail('Missing an endpoint — each interval needs two, like (-inf, 2].', this.endPos)
    let sign = 1
    if (start.kind === 'sign') {
      this.next()
      if (start.text === '-') sign = -1
    }
    const t = this.peek()
    if (!t) fail('Missing a number after the sign.', this.endPos)
    if (t.kind === 'inf') {
      this.next()
      return { value: sign < 0 ? '-inf' : 'inf', pos: start.pos, end: t.pos + t.text.length }
    }
    if (t.kind === 'num') {
      this.next()
      let r = ratFromString(t.text)
      if (!r) fail(`Couldn't read the number "${t.text}".`, t.pos, t.text.length)
      let end = t.pos + t.text.length
      if (this.peek()?.kind === 'slash') {
        this.next()
        const d = this.peek()
        if (!d || d.kind !== 'num') {
          fail(
            'A fraction needs a whole number under the bar, like -7/4.',
            d ? d.pos : this.endPos,
            d ? d.text.length : undefined,
          )
        }
        this.next()
        const dr = ratFromString(d.text)
        if (!dr || dr.d !== 1) {
          fail('Write fractions as whole numbers over whole numbers, like -7/4.', d.pos, d.text.length)
        }
        if (dr.n === 0) fail("A denominator can't be 0.", d.pos, d.text.length)
        r = ratDiv(r, dr)
        end = d.pos + d.text.length
      }
      if (sign < 0) r = ratNeg(r)
      return { value: r, pos: start.pos, end }
    }
    if (t.kind === 'word') {
      fail(`Endpoints must be numbers like -7/4, 2.5, or inf — not "${t.text}".`, t.pos, t.text.length)
    }
    fail('Expected a number here, like -7/4 or inf.', t.pos, t.text.length)
  }

  private parseInterval(): void {
    const open = this.next()!
    const lo = this.readEndpoint()
    const t = this.peek()
    if (!t) fail('Finish the interval: two endpoints separated by a comma, then ) or ].', this.endPos)
    if (t.kind === 'close') {
      this.next()
      const text = this.src.slice(open.pos, t.pos + 1)
      const span = t.pos + 1 - open.pos
      if (isFiniteEndpoint(lo.value)) {
        const v = endpointToString(lo.value)
        fail(
          `A single point uses braces: write {${v}}, not ${text}. Brackets need two different endpoints.`,
          open.pos,
          span,
          patternHit('bracket_point'),
        )
      }
      fail('∞ is a direction, not a point — a ray looks like (5, inf), with two endpoints.', open.pos, span)
    }
    if (t.kind !== 'comma') fail('Separate the two endpoints with a comma, like (-inf, 2].', t.pos, t.text.length)
    this.next()
    const hi = this.readEndpoint()
    const c = this.peek()
    if (!c) fail('Close the interval with ) or ].', this.endPos)
    if (c.kind !== 'close') fail(`Close the interval with ) or ] — found "${c.text}".`, c.pos, c.text.length)
    this.next()

    const loClosed = open.text === '['
    const hiClosed = c.text === ']'
    const pos = open.pos
    const span = c.pos + 1 - open.pos
    const pieceText = this.src.slice(open.pos, c.pos + 1)
    const loS = endpointToString(lo.value)
    // Brackets travel with their numbers when we suggest the left → right order.
    const swapped = () => formatPiece(hi.value, lo.value, hiClosed, loClosed)

    if (lo.value === 'inf' || hi.value === '-inf') {
      fail(
        `Intervals read left → right: the smaller number goes first, and −∞ always leads with a ( — write ${swapped()}.`,
        pos,
        span,
        patternHit('backwards_interval'),
      )
    }
    if ((lo.value === '-inf' && loClosed) || (hi.value === 'inf' && hiClosed)) {
      fail(
        `∞ is never reached, so it always gets a round parenthesis — write ${formatPiece(lo.value, hi.value, loClosed, hiClosed)}.`,
        pos,
        span,
        patternHit('infinity_bracket'),
      )
    }
    if (isFiniteEndpoint(lo.value) && isFiniteEndpoint(hi.value)) {
      const cmp = ratCompare(lo.value, hi.value)
      if (cmp > 0) {
        fail(
          `Intervals read left → right: the smaller number goes first — write ${swapped()}.`,
          pos,
          span,
          patternHit('backwards_interval'),
        )
      }
      if (cmp === 0) {
        if (loClosed && hiClosed) {
          fail(
            `A single point uses braces: write {${loS}}, not ${pieceText}. Brackets need two different endpoints.`,
            pos,
            span,
            patternHit('bracket_point'),
          )
        }
        fail(
          `${pieceText} has no numbers in it — both endpoints are ${loS} and at least one is excluded. For just the number ${loS} write {${loS}}; for no solutions write {}.`,
          pos,
          span,
          patternHit('empty_interval'),
        )
      }
    }
    this.pieces.push({ lo: lo.value, hi: hi.value, loClosed, hiClosed })
    this.typed++
  }

  private parseBraces(): void {
    const lb = this.next()!
    const first = this.peek()
    if (!first) fail('Close the set of points with }.', this.endPos)
    if (first.kind === 'rbrace') {
      this.next()
      return
    }
    if (first.kind === 'word') {
      fail(
        `This box takes interval notation like (-inf, 2] — set-builder like {${first.text} | ${first.text} < 2} goes in the other box.`,
        lb.pos,
        first.pos + first.text.length - lb.pos,
      )
    }
    for (;;) {
      const ep = this.readEndpoint()
      if (!isFiniteEndpoint(ep.value)) {
        fail("∞ can't be a point in a set — a ray looks like (5, inf).", ep.pos, ep.end - ep.pos)
      }
      this.points.push(ep.value)
      this.typed++
      const t = this.peek()
      if (!t) fail('Close the set of points with }.', this.endPos)
      if (t.kind === 'rbrace') {
        this.next()
        return
      }
      if (t.kind === 'comma') {
        this.next()
        const after = this.peek()
        if (!after) fail('Close the set of points with }.', this.endPos)
        if (after.kind === 'rbrace') fail('Remove the extra comma before }.', t.pos, 1)
        continue
      }
      if (t.kind === 'open' || t.kind === 'lbrace') {
        fail('Close the set with } before starting another piece.', t.pos, 1)
      }
      fail(`Separate points with commas, like {-1, 4} — found "${t.text}".`, t.pos, t.text.length)
    }
  }
}

/**
 * Parse interval notation into an exact, normalized SolutionSet.
 * `pieceCount` is the number of pieces/points typed; `note` is set when the normalized set has
 * fewer pieces than typed ("could be written as one piece").
 */
export function parseInterval(text: string): IntervalParseResult {
  if (!text.trim()) {
    return { ok: false, error: { message: 'Type an interval, like (-inf, 2] U {5}.', position: 0 } }
  }
  const parser = new Parser(tokenize(text), text)
  try {
    parser.parseAll()
  } catch (e) {
    if (e instanceof Fail) {
      return e.pattern ? { ok: false, error: e.error, pattern: e.pattern } : { ok: false, error: e.error }
    }
    throw e
  }
  const set = normalizeSet({ pieces: parser.pieces, points: parser.points })
  const normalizedCount = set.pieces.length + set.points.length
  const result: IntervalParseOk = { ok: true, set, pieceCount: parser.typed }
  if (normalizedCount > 0 && normalizedCount < parser.typed) {
    result.note =
      normalizedCount === 1
        ? `This could be written as one piece: ${setToInterval(set)}.`
        : `This could be written with fewer pieces: ${setToInterval(set)}.`
  }
  return result
}
