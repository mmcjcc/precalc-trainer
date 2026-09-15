/**
 * Set-builder parser: "{x | P}" / "{x : P}" (braces optional) with its own tiny grammar — no
 * math.js, so every rejection can say exactly what to type instead.
 *
 *   pred   := clause ( 'or' clause )*
 *   clause := chain ( 'and' chain )*
 *   chain  := term relop term [ relop term ]        (a chain puts the variable in the middle)
 *   term   := [ + | - ] ( number [ '/' integer ] | inf ) | variable
 *   relop  := < | <= | > | >= | =   (≤ ≥ and unicode minus accepted)
 *
 * The bound variable may be x, y or n (inequality answers in y exist); the predicate must use the
 * same letter. Positions in errors are 0-based indexes into the ORIGINAL text.
 */
import type { ParseError, PatternHit, Rational, SolutionSet, VarName } from '@/shared/types'
import { ratCompare, ratDiv, ratFromString, ratNeg, ratToString } from '../rational'
import {
  allReals,
  emptySet,
  normalizeSet,
  setIntersection,
  setUnion,
  type Endpoint,
} from './solutionSet'

export type SetBuilderParseOk = { ok: true; set: SolutionSet; variable: VarName }
export type SetBuilderParseFail = { ok: false; error: ParseError; pattern?: PatternHit }
export type SetBuilderParseResult = SetBuilderParseOk | SetBuilderParseFail

type RelText = '<' | '<=' | '>' | '>=' | '=' | '!='
type TokKind =
  | 'lbrace'
  | 'rbrace'
  | 'bar'
  | 'relop'
  | 'num'
  | 'slash'
  | 'sign'
  | 'word'
  | 'inf'
  | 'in'
  | 'other'

interface Tok {
  kind: TokKind
  text: string
  pos: number
}

const VAR_NAMES: readonly string[] = ['x', 'y', 'n']
const INF_WORDS = new Set(['inf', 'infinity', 'oo'])

function isVarName(s: string): s is VarName {
  return VAR_NAMES.includes(s)
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '!=' || two === '==') {
      toks.push({ kind: 'relop', text: two === '==' ? '=' : two, pos: i })
      i += 2
      continue
    }
    let kind: TokKind | null = null
    let text = c
    if (c === '{') kind = 'lbrace'
    else if (c === '}') kind = 'rbrace'
    else if (c === '|' || c === ':' || c === '∣') kind = 'bar'
    else if (c === '<' || c === '>' || c === '=') kind = 'relop'
    else if (c === '≤') {
      kind = 'relop'
      text = '<='
    } else if (c === '≥') {
      kind = 'relop'
      text = '>='
    } else if (c === '≠') {
      kind = 'relop'
      text = '!='
    } else if (c === '/') kind = 'slash'
    else if (c === '+') kind = 'sign'
    else if (c === '-' || c === '−' || c === '–' || c === '—') {
      kind = 'sign'
      text = '-'
    } else if (c === '∞') kind = 'inf'
    else if (c === '∈') kind = 'in'
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
      const word = src.slice(i, j).toLowerCase()
      toks.push({ kind: INF_WORDS.has(word) ? 'inf' : 'word', text: word, pos: i })
      i = j
      continue
    }
    toks.push({ kind: 'other', text: c, pos: i })
    i++
  }
  return toks
}

class Fail extends Error {
  constructor(readonly error: ParseError) {
    super(error.message)
  }
}

function fail(message: string, position: number, length?: number): never {
  throw new Fail(length === undefined ? { message, position } : { message, position, length })
}

type Term =
  | { kind: 'var'; pos: number; end: number }
  | { kind: 'num'; value: Rational; pos: number; end: number }
  | { kind: 'inf'; value: 'inf' | '-inf'; pos: number; end: number }

function flip(op: RelText): RelText {
  switch (op) {
    case '<':
      return '>'
    case '<=':
      return '>='
    case '>':
      return '<'
    case '>=':
      return '<='
    default:
      return op
  }
}

function isLess(op: RelText): boolean {
  return op === '<' || op === '<='
}

class PredicateParser {
  private i = 0

  constructor(
    private readonly toks: Tok[],
    private readonly v: VarName,
    private readonly src: string,
    private readonly endPos: number,
  ) {}

  private peek(): Tok | undefined {
    return this.toks[this.i]
  }

  private next(): Tok | undefined {
    return this.toks[this.i++]
  }

  private isWord(t: Tok | undefined, w: string): boolean {
    return t !== undefined && t.kind === 'word' && t.text === w
  }

  parse(): SolutionSet {
    const v = this.v
    if (this.toks.length === 0) fail(`Write the condition after the bar, like {${v} | ${v} <= 2}.`, this.endPos)
    const set = this.parseOr()
    const left = this.peek()
    if (left) {
      fail(
        `Unexpected "${left.text}" — join conditions with "or" / "and", like ${v} < -2 or ${v} > 5.`,
        left.pos,
        left.text.length,
      )
    }
    return set
  }

  private parseOr(): SolutionSet {
    let set = this.parseAnd()
    while (this.isWord(this.peek(), 'or')) {
      this.next()
      set = setUnion(set, this.parseAnd())
    }
    return set
  }

  private parseAnd(): SolutionSet {
    let set = this.parseChain()
    while (this.isWord(this.peek(), 'and')) {
      this.next()
      set = setIntersection(set, this.parseChain())
    }
    return set
  }

  private parseChain(): SolutionSet {
    const v = this.v
    const terms: Term[] = [this.readTerm()]
    const ops: Tok[] = []
    while (this.peek()?.kind === 'relop') {
      ops.push(this.next()!)
      terms.push(this.readTerm())
    }
    const first = terms[0]!
    const last = terms[terms.length - 1]!
    const chainText = this.src.slice(first.pos, last.end)
    if (ops.length === 0) fail(`Each condition needs a comparison, like ${v} <= 2.`, first.pos, last.end - first.pos)
    if (ops.length > 2) {
      fail(`A chain has at most two comparisons, like -2 < ${v} <= 5.`, ops[2]!.pos, ops[2]!.text.length)
    }
    if (ops.length === 1) return this.relation(first, ops[0]!, terms[1]!, chainText)
    return this.chain(first, ops[0]!, terms[1]!, ops[1]!, terms[2]!, chainText)
  }

  private readTerm(): Term {
    const v = this.v
    const start = this.peek()
    if (!start) fail(`The condition ends too soon — what does ${v} compare to?`, this.endPos)
    let sign = 1
    if (start.kind === 'sign') {
      this.next()
      if (start.text === '-') sign = -1
    }
    const t = this.peek()
    if (!t) fail('Missing a number after the sign.', this.endPos)
    if (t.kind === 'word') {
      if (t.text === v) {
        if (start.kind === 'sign') {
          fail(
            `Write the condition with ${v} by itself on one side, like ${v} > -3.`,
            start.pos,
            t.pos + t.text.length - start.pos,
          )
        }
        this.next()
        return { kind: 'var', pos: t.pos, end: t.pos + t.text.length }
      }
      if (t.text === 'or' || t.text === 'and') {
        fail(`Expected a number or ${v} here, not "${t.text}".`, t.pos, t.text.length)
      }
      if (isVarName(t.text)) {
        fail(`The condition should be about ${v} (the letter before the bar), not ${t.text}.`, t.pos, t.text.length)
      }
      fail(
        `Couldn't read "${t.text}" — use ${v}, numbers, <, <=, >, >=, =, and the words "or" / "and".`,
        t.pos,
        t.text.length,
      )
    }
    if (t.kind === 'inf') {
      this.next()
      return { kind: 'inf', value: sign < 0 ? '-inf' : 'inf', pos: start.pos, end: t.pos + t.text.length }
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
      return { kind: 'num', value: r, pos: start.pos, end }
    }
    if (t.kind === 'relop') fail(`Expected a number or ${v} before "${t.text}".`, t.pos, t.text.length)
    fail(`Unexpected "${t.text}" — conditions use ${v}, numbers, and <, <=, >, >=, =.`, t.pos, t.text.length)
  }

  /** Two-term relation: `x op b` or `b op x`. */
  private relation(left: Term, opTok: Tok, right: Term, chainText: string): SolutionSet {
    const v = this.v
    const op = opTok.text as RelText
    const pos = left.pos
    const span = right.end - left.pos
    if (op === '!=') {
      fail(`≠ isn't needed here — write the numbers that ARE in the set, like ${v} < 3 or ${v} > 3.`, opTok.pos, 2)
    }
    if (left.kind === 'var' && right.kind === 'var') fail(`Compare ${v} with a number, like ${v} <= 2.`, pos, span)
    if (left.kind !== 'var' && right.kind !== 'var') {
      fail(`Each condition needs ${v} in it — "${chainText}" has no ${v}.`, pos, span)
    }
    const bound = left.kind === 'var' ? right : left
    if (bound.kind === 'var') fail(`Compare ${v} with a number, like ${v} <= 2.`, pos, span)
    const rel = left.kind === 'var' ? op : flip(op)
    const b: Endpoint = bound.value
    if (rel === '=') {
      if (bound.kind === 'inf') fail(`${v} can't equal ∞ — ∞ isn't a number.`, pos, span)
      return normalizeSet({ pieces: [], points: [bound.value] })
    }
    if (isLess(rel)) {
      if (b === '-inf') fail(`No number lies below −∞ — did you mean ${v} > -inf?`, pos, span)
      if (b === 'inf') {
        if (rel === '<=') fail('∞ is never reached — no number equals it. Use < next to inf.', pos, span)
        return allReals()
      }
      return normalizeSet({ pieces: [{ lo: '-inf', hi: b, loClosed: false, hiClosed: rel === '<=' }], points: [] })
    }
    if (b === 'inf') fail(`No number lies above ∞ — did you mean ${v} < inf?`, pos, span)
    if (b === '-inf') {
      if (rel === '>=') fail('∞ is never reached — no number equals it. Use > next to -inf.', pos, span)
      return allReals()
    }
    return normalizeSet({ pieces: [{ lo: b, hi: 'inf', loClosed: rel === '>=', hiClosed: false }], points: [] })
  }

  /** Three-term chain: `a op1 x op2 b`. */
  private chain(t0: Term, op1: Tok, t1: Term, op2: Tok, t2: Term, chainText: string): SolutionSet {
    const v = this.v
    const pos = t0.pos
    const span = t2.end - t0.pos
    if (t1.kind !== 'var') {
      if (t0.kind === 'var' || t2.kind === 'var') {
        fail(`Put ${v} in the middle of a chain, with numbers on both sides: -2 < ${v} <= 5.`, pos, span)
      }
      fail(`Each condition needs ${v} in it — "${chainText}" has no ${v}.`, pos, span)
    }
    if (t0.kind === 'var' || t2.kind === 'var') {
      fail(`In a chain ${v} appears once, in the middle: -2 < ${v} <= 5.`, pos, span)
    }
    const o1 = op1.text as RelText
    const o2 = op2.text as RelText
    if (o1 === '=' || o2 === '=' || o1 === '!=' || o2 === '!=') {
      fail(`Use = on its own, like ${v} = 3.`, pos, span)
    }
    if (isLess(o1) !== isLess(o2)) {
      fail(`A chained inequality reads one way, like -2 < ${v} <= 5 (or 5 >= ${v} > -2).`, pos, span)
    }
    let lo: Endpoint
    let hi: Endpoint
    let loClosed: boolean
    let hiClosed: boolean
    if (isLess(o1)) {
      lo = t0.value
      loClosed = o1 === '<='
      hi = t2.value
      hiClosed = o2 === '<='
    } else {
      lo = t2.value
      loClosed = o2 === '>='
      hi = t0.value
      hiClosed = o1 === '>='
    }
    if (lo === 'inf' || hi === '-inf') fail('No number lies beyond ∞ — check which way the chain reads.', pos, span)
    if ((lo === '-inf' && loClosed) || (hi === 'inf' && hiClosed)) {
      fail('∞ is never reached — use < or > next to inf.', pos, span)
    }
    if (lo !== '-inf' && hi !== 'inf') {
      const cmp = ratCompare(lo, hi)
      if (cmp > 0) {
        const suggest = `${ratToString(hi)} ${hiClosed ? '<=' : '<'} ${v} ${loClosed ? '<=' : '<'} ${ratToString(lo)}`
        fail(
          `${chainText} has no solutions: no number is above ${ratToString(lo)} and below ${ratToString(hi)}. Chains read left → right, smaller number first — try ${suggest}.`,
          pos,
          span,
        )
      }
      if (cmp === 0) {
        if (loClosed && hiClosed) return normalizeSet({ pieces: [], points: [lo] })
        fail(
          `${chainText} has no numbers in it. For just the number ${ratToString(lo)} write ${v} = ${ratToString(lo)}.`,
          pos,
          span,
        )
      }
    }
    return normalizeSet({ pieces: [{ lo, hi, loClosed, hiClosed }], points: [] })
  }
}

const EMPTY_RE = /^(\{\s*\}|∅|dne)$/i
const REALS_RE = /^(R|ℝ)$/

function realsPredicate(predText: string, v: string): boolean {
  const re = new RegExp(
    `^${v}\\s*(∈|in|is)\\s*(any\\s+|a\\s+)?(r|ℝ|reals?|real\\s+numbers?|any\\s+real\\s+number)$`,
    'i',
  )
  return re.test(predText.trim())
}

/** Parse "{x | P}" / "{x : P}" (braces optional) into an exact, normalized SolutionSet. */
export function parseSetBuilder(text: string): SetBuilderParseResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Type set-builder notation, like {x | x <= 2}.', position: 0 } }
  }
  if (EMPTY_RE.test(trimmed)) return { ok: true, set: emptySet(), variable: 'x' }
  if (REALS_RE.test(trimmed)) return { ok: true, set: allReals(), variable: 'x' }
  const toks = tokenize(text)
  try {
    const first = toks[0]!
    const last = toks[toks.length - 1]!
    let start = 0
    let end = toks.length
    if (first.kind === 'lbrace') {
      start = 1
      if (toks.length > 1 && last.kind === 'rbrace') end = toks.length - 1
      else fail('Close the set with }.', text.length)
    } else if (last.kind === 'rbrace') {
      fail('Add the opening { to match the closing }.', first.pos)
    }
    const inner = toks.slice(start, end)
    if (inner.length === 0) {
      fail('Write the letter, a bar, and the condition: {x | x <= 2}.', first.kind === 'lbrace' ? first.pos + 1 : first.pos)
    }
    const barIdx = inner.findIndex((t) => t.kind === 'bar')
    if (barIdx < 0) {
      fail(
        'Set-builder notation names the letter first, then a bar, then the condition: {x | x <= 2}.',
        inner[0]!.pos,
      )
    }
    const bar = inner[barIdx]!
    const head = inner.slice(0, barIdx)
    if (head.length === 0) fail('Put the letter before the bar: {x | x <= 2}.', bar.pos)
    const headTok = head[0]!
    if (head.length > 1 || headTok.kind !== 'word') {
      fail('Put just one letter before the bar: {x | x <= 2}.', headTok.pos, bar.pos - headTok.pos)
    }
    const name = headTok.text
    if (!isVarName(name)) {
      fail(
        `Only x, y, or n can be the variable here — write {x | x <= 2}, not {${name} | ...}.`,
        headTok.pos,
        headTok.text.length,
      )
    }
    const pred = inner.slice(barIdx + 1)
    if (pred.length === 0) fail(`Write the condition after the bar, like {${name} | ${name} <= 2}.`, bar.pos + 1)
    const predLast = pred[pred.length - 1]!
    const predEnd = predLast.pos + predLast.text.length
    const predText = text.slice(pred[0]!.pos, predEnd)
    if (realsPredicate(predText, name)) return { ok: true, set: allReals(), variable: name }
    const set = new PredicateParser(pred, name, text, predEnd).parse()
    return { ok: true, set, variable: name }
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.error }
    throw e
  }
}

/**
 * For content generators: "x >= 3/5", "-2 < x <= 5", "x < -2 or x > 5" → exact set (also accepts
 * full set-builder text, "R", "{}"). Returns null when the text does not parse.
 */
export function setFromRelation(text: string): SolutionSet | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (EMPTY_RE.test(trimmed)) return emptySet()
  if (REALS_RE.test(trimmed)) return allReals()
  if (/[|:∣]/.test(trimmed) || trimmed.startsWith('{')) {
    const r = parseSetBuilder(trimmed)
    return r.ok ? r.set : null
  }
  const toks = tokenize(trimmed)
  const vt = toks.find((t) => t.kind === 'word' && isVarName(t.text))
  if (!vt || !isVarName(vt.text)) return null
  const v = vt.text
  if (realsPredicate(trimmed, v)) return allReals()
  try {
    return new PredicateParser(toks, v, trimmed, trimmed.length).parse()
  } catch (e) {
    if (e instanceof Fail) return null
    throw e
  }
}
