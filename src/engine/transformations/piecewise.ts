/**
 * Piecewise functions: evaluate at a rational x exactly, and grade her value.
 *
 * Pieces are { formula, interval } with exact endpoints and open/closed ends (the shared `Piece` shape).
 * Formulas are polynomials or abs of linear expressions (any formula whose value at a rational x is rational
 * works; anything else makes the evaluation null, a template bug). Intervals must not overlap.
 *
 * Named mistakes: the neighbouring piece at a boundary point (the boundary belongs to the other side:
 * < vs ≤), a piece whose interval does not contain x, a value where no piece applies, "undefined" where one
 * does.
 */
import type { Piece, Rational } from '@/shared/types'
import { ratCompare } from '@/notation/rational'
import { isFiniteEndpoint, pieceContains, setFromPieces, setIntersection, setIsEmpty } from '@/notation/sets/solutionSet'
import type { MathNode } from '../math'
import { parseValueAnswer } from '../functions/answer'
import { parseFunction } from '../functions/common'
import { exactEval, surdRational } from '../functions/exact'
import { showNode, substituteValueText } from '../functions/text'
import { pretty, rp, rt, toRational } from './text'
import type { PiecewisePiece, PiecewiseValue, RatLike, TransformGrade } from './types'

/** The condition of an interval, app syntax: "x < 2", "x >= 2", "-1 <= x < 3", "x = 4", "x in R". */
export function pieceConditionText(interval: Piece, v = 'x'): string {
  const { lo, hi, loClosed, hiClosed } = interval
  if (lo === '-inf' && hi === 'inf') return `${v} in R`
  if (lo === '-inf' && isFiniteEndpoint(hi)) return `${v} ${hiClosed ? '<=' : '<'} ${rt(hi)}`
  if (hi === 'inf' && isFiniteEndpoint(lo)) return `${v} ${loClosed ? '>=' : '>'} ${rt(lo)}`
  if (isFiniteEndpoint(lo) && isFiniteEndpoint(hi)) {
    if (ratCompare(lo, hi) === 0) return `${v} = ${rt(lo)}`
    return `${rt(lo)} ${loClosed ? '<=' : '<'} ${v} ${hiClosed ? '<=' : '<'} ${rt(hi)}`
  }
  return `${v} in R`
}

interface Parsed {
  node: MathNode
  /** The formula as the engine printed it (app syntax). */
  text: string
  interval: Piece
}

/** Why the pieces are not a function the engine can use (null when they are). */
export function piecewiseProblem(pieces: readonly PiecewisePiece[]): string | null {
  return parsePieces(pieces).problem
}

function parsePieces(pieces: readonly PiecewisePiece[]): { parsed: Parsed[]; problem: string | null } {
  const parsed: Parsed[] = []
  if (!Array.isArray(pieces) || !pieces.length) return { parsed, problem: 'a piecewise function needs at least one piece' }
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!
    const f = parseFunction(p.formula ?? '')
    if (!f.ok) return { parsed, problem: `piece ${i + 1}: "${p.formula}" does not parse (${f.error.message})` }
    const iv = p.interval
    if (!iv || setIsEmpty(setFromPieces([iv]))) return { parsed, problem: `piece ${i + 1}: its interval is empty` }
    parsed.push({ node: f.node, text: showNode(f.node), interval: iv })
  }
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const both = setIntersection(setFromPieces([parsed[i]!.interval]), setFromPieces([parsed[j]!.interval]))
      if (!setIsEmpty(both)) return { parsed, problem: `pieces ${i + 1} and ${j + 1} overlap` }
    }
  }
  return { parsed, problem: null }
}

/** The formula's exact value at t when it is rational; null otherwise (undefined, irrational, unsupported). */
function rationalAt(node: MathNode, t: Rational): Rational | null {
  try {
    const v = exactEval(node, t)
    return v === 'undef' ? null : surdRational(v)
  } catch {
    return null
  }
}

function cond(p: Parsed): string {
  return pretty(pieceConditionText(p.interval))
}

function subText(p: Parsed, t: Rational): string {
  return substituteValueText(p.text, rt(t))
}

/** "f(2) = 2(2) + 1 = 5" (display text). */
function valueLine(p: Parsed, t: Rational, v: Rational): string {
  const sub = subText(p, t)
  const tail = sub === rt(v) ? '' : ` = ${rp(v)}`
  return `f(${rp(t)}) = ${pretty(sub)}${tail}`
}

function listConditions(parsed: Parsed[]): string {
  const cs = parsed.map(cond)
  return cs.length <= 1 ? cs.join('') : `${cs.slice(0, -1).join(', ')} and ${cs[cs.length - 1]}`
}

/**
 * f(x) for the piecewise function: which piece applies and the exact value, or undefined outside every
 * piece. Null when the pieces are invalid, x is unreadable, or the applying formula's value is not rational.
 */
export function evaluatePiecewise(pieces: readonly PiecewisePiece[], x: RatLike): PiecewiseValue | null {
  const { parsed, problem } = parsePieces(pieces)
  const t = toRational(x)
  if (problem || !t) return null
  const index = parsed.findIndex((p) => pieceContains(p.interval, t))
  if (index < 0) {
    return {
      defined: false,
      steps: [`No piece includes x = ${rp(t)}: the pieces are for ${listConditions(parsed)}.`, `So f(${rp(t)}) is undefined.`],
    }
  }
  const p = parsed[index]!
  const value = rationalAt(p.node, t)
  if (!value) return null
  return {
    defined: true,
    pieceIndex: index,
    value,
    text: rt(value),
    condition: pieceConditionText(p.interval),
    substitution: subText(p, t),
    steps: [`x = ${rp(t)} satisfies ${cond(p)}, so use ${pretty(p.text)}.`, `${valueLine(p, t, value)}.`],
  }
}

/** t is an endpoint of the interval that the interval leaves out (x < 2 at t = 2). */
function openEndAt(iv: Piece, t: Rational): boolean {
  return (isFiniteEndpoint(iv.lo) && !iv.loClosed && ratCompare(iv.lo, t) === 0) || (isFiniteEndpoint(iv.hi) && !iv.hiClosed && ratCompare(iv.hi, t) === 0)
}

/** "(< does not include the endpoint)" for the side of the interval that sits at t. */
function strictNote(iv: Piece, t: Rational): string {
  const atLo = isFiniteEndpoint(iv.lo) && ratCompare(iv.lo, t) === 0
  return atLo ? '(> does not include the endpoint)' : '(< does not include the endpoint)'
}

/**
 * Grade her f(x) for the piecewise function: a number (exact) or a word for "undefined". Named mistakes:
 * piecewise_boundary, piecewise_wrong_piece, piecewise_value_where_undefined, piecewise_undefined_where_defined.
 */
export function gradePiecewiseValue(pieces: readonly PiecewisePiece[], x: RatLike, answer: string): TransformGrade {
  const { parsed, problem } = parsePieces(pieces)
  const t = toRational(x)
  if (problem) return { verdict: 'unsupported', message: `This piecewise function is not valid: ${problem}.` }
  if (!t) return { verdict: 'unsupported', message: `x = ${String(x)} is not a number.` }
  const ev = evaluatePiecewise(pieces, t)
  if (!ev) return { verdict: 'unsupported', message: `The value at x = ${rp(t)} is outside what the checker can compute exactly.` }
  const ans = parseValueAnswer(answer ?? '')
  if (!ans.ok) return { verdict: 'invalid', message: ans.error.message, position: ans.error.position, length: ans.error.length }

  if (!ev.defined) {
    if (ans.undefined) return { verdict: 'correct', message: `Correct: ${lowerFirst(ev.steps.join(' '))}` }
    const her = herValue(ans.node)
    if (her === 'undef') return undefinedAsWritten()
    let source = ''
    const hit = her ? parsed.find((p) => { const v = rationalAt(p.node, t); return v !== null && ratCompare(v, her) === 0 }) : undefined
    if (hit && her) {
      source = openEndAt(hit.interval, t)
        ? ` ${pretty(hit.text)} would give ${rp(her)} at x = ${rp(t)}, but ${cond(hit)} leaves ${rp(t)} out ${strictNote(hit.interval, t)}.`
        : ` Your ${rp(her)} comes from ${pretty(hit.text)}, which is only for ${cond(hit)}.`
    }
    return {
      verdict: 'mistake',
      mistake: 'piecewise_value_where_undefined',
      witness: `No piece includes x = ${rp(t)}: the pieces are for ${listConditions(parsed)}. So f(${rp(t)}) is undefined.${source}`,
    }
  }

  const right = parsed[ev.pieceIndex]!
  const line = valueLine(right, t, ev.value)
  if (ans.undefined) {
    return {
      verdict: 'mistake',
      mistake: 'piecewise_undefined_where_defined',
      witness: `x = ${rp(t)} is in the piece for ${cond(right)}, so f(${rp(t)}) is defined: ${line}.`,
    }
  }
  const her = herValue(ans.node)
  if (her === 'undef') return undefinedAsWritten()
  if (her && ratCompare(her, ev.value) === 0) return { verdict: 'correct', message: `Correct: ${lowerFirst(ev.steps.join(' '))}` }
  if (her) {
    // Other pieces' formulas at x: pieces with x as a left-out endpoint first (the boundary mistake).
    const others = parsed
      .map((p, j) => ({ p, j }))
      .filter(({ j }) => j !== ev.pieceIndex)
      .sort((u, w) => Number(openEndAt(w.p.interval, t)) - Number(openEndAt(u.p.interval, t)))
    for (const { p } of others) {
      const v = rationalAt(p.node, t)
      if (!v || ratCompare(v, ev.value) === 0 || ratCompare(v, her) !== 0) continue
      if (openEndAt(p.interval, t)) {
        return {
          verdict: 'mistake',
          mistake: 'piecewise_boundary',
          witness: `At x = ${rp(t)} two pieces meet: ${cond(p)} leaves ${rp(t)} out ${strictNote(p.interval, t)}, and ${cond(right)} includes it. So ${line}. Your answer, ${rp(her)}, comes from ${pretty(p.text)}, the piece that leaves ${rp(t)} out.`,
        }
      }
      return {
        verdict: 'mistake',
        mistake: 'piecewise_wrong_piece',
        witness: `x = ${rp(t)} is not in ${cond(p)}, so ${pretty(p.text)} does not apply there. ${rp(t)} satisfies ${cond(right)}: ${line}. Your answer, ${rp(her)}, comes from ${pretty(p.text)}.`,
      }
    }
  }
  const herText = her ? rp(her) : pretty(ans.text)
  return { verdict: 'wrong', message: `x = ${rp(t)} satisfies ${cond(right)}, so use ${pretty(right.text)}: ${line}, not ${herText}.` }
}

/** Her number exactly: a Rational, null (a real number that is not rational), or 'undef' (1/0 as written). */
function herValue(node: MathNode): Rational | null | 'undef' {
  try {
    const v = exactEval(node, null)
    return v === 'undef' ? 'undef' : surdRational(v)
  } catch {
    return null
  }
}

function undefinedAsWritten(): TransformGrade {
  return { verdict: 'invalid', message: 'That value is undefined as written. Check for a division by 0.' }
}

function lowerFirst(s: string): string {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s
}
