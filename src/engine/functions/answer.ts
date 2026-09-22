/**
 * Reading her answers.
 *
 * Set answers (domain, range, composite domain): interval notation (`parseInterval`), set-builder
 * (`parseSetBuilder`), a bare condition ("x >= 2"), plus the forms domains need that the notation
 * parsers deliberately reject: ≠ ("{x | x != 3}", "{x | x >= -2, x != 3}", "x != 3 and x != -2") and
 * "all real numbers except 3". The notation layer's rejection of ≠ is right for inequality answers;
 * for a domain it is the textbook form.
 *
 * Value answers ((f o g)(a)): a constant expression, or a word meaning "undefined".
 */
import type { ParseError, Rational, SolutionSet } from '@/shared/types'
import { ratFromString } from '@/notation/rational'
import { parseInterval } from '@/notation/sets/interval'
import { parseSetBuilder, setFromRelation } from '@/notation/sets/setBuilder'
import { allReals, setDifference, setFromPieces } from '@/notation/sets/solutionSet'
import type { MathNode } from '../math'
import { parseExpression } from '../parse'

export type SetAnswerParse = { ok: true; set: SolutionSet } | { ok: false; error: ParseError }

const NE = /(?:!=|≠|=\/=|<>)/

function fail(message: string, position = 0, length?: number): SetAnswerParse {
  return { ok: false, error: length ? { message, position, length } : { message, position } }
}

function exceptList(list: string): Rational[] | null {
  const parts = list
    .split(/\s*(?:,|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean)
  const out: Rational[] = []
  for (const p of parts) {
    const r = ratFromString(p)
    if (!r) return null
    out.push(r)
  }
  return out.length ? out : null
}

/** "{x | x != 3}", "{x | x >= -2, x != 3}", "x != 3 and x != -2", "y != 2". */
function parseNotEqual(text: string): SetAnswerParse {
  let v: string | null = null
  let pred = text.trim()
  const head = pred.match(/^\{?\s*([a-z])\s*[|:∣]\s*/i)
  if (head) {
    v = head[1]!.toLowerCase()
    pred = pred.slice(head[0].length)
    if (text.trim().startsWith('{')) {
      if (!pred.endsWith('}')) return fail('Close the set with }.', text.length)
      pred = pred.slice(0, -1)
    }
  }
  if (/\bor\b/i.test(pred)) {
    return fail('With ≠, list the conditions with "and" (or commas): {x | x >= -2 and x != 3}.', text.indexOf('or'))
  }
  const clauses = pred
    .split(/\s*(?:,|\band\b)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean)
  const holes: Rational[] = []
  const rest: string[] = []
  for (const c of clauses) {
    if (!NE.test(c)) {
      rest.push(c)
      continue
    }
    const [l, r] = c.split(NE).map((s) => s!.trim())
    const left = l ?? ''
    const right = r ?? ''
    const letterLeft = /^[a-z]$/i.test(left)
    const letter = letterLeft ? left.toLowerCase() : /^[a-z]$/i.test(right) ? right.toLowerCase() : null
    const value = ratFromString(letterLeft ? right : left)
    if (!letter || !value) {
      return fail(`Write each ≠ condition as a letter and a number, like x != 3 ("${c}" is not).`, Math.max(0, text.indexOf(c)), c.length)
    }
    if (v && letter !== v) return fail(`Use the same letter throughout: ${v}, not ${letter}.`, Math.max(0, text.indexOf(c)), c.length)
    v = letter
    holes.push(value)
  }
  let base: SolutionSet = allReals()
  if (rest.length) {
    const r = setFromRelation(rest.join(' and '))
    if (!r) return fail(`Could not read "${rest.join(' and ')}" — write conditions like ${v ?? 'x'} >= -2.`, Math.max(0, text.indexOf(rest[0]!)))
    base = r
  }
  return { ok: true, set: setDifference(base, setFromPieces([], holes)) }
}

/**
 * Her set answer in any of the accepted forms → an exact SolutionSet. Errors carry a position into
 * `text` when the underlying parser gives one.
 */
export function parseSetAnswer(text: string): SetAnswerParse {
  const t = text.trim()
  if (!t) return fail('Type your answer first.')
  const except = t.match(/^(?:all\s+)?(?:real\s+numbers|reals|R|ℝ)\s*(?:except|but(?:\s+not)?|other\s+than)\s+(.+)$/i)
  if (except) {
    const pts = exceptList(except[1]!)
    if (!pts) return fail('List the excluded numbers after "except", like: all real numbers except 3 and -2.', t.length - except[1]!.length)
    return { ok: true, set: setDifference(allReals(), setFromPieces([], pts)) }
  }
  if (/^(?:all\s+)?(?:real\s+numbers|reals)$/i.test(t)) return { ok: true, set: allReals() }
  if (NE.test(t)) return parseNotEqual(t)
  if (/[|:∣]/.test(t)) {
    const sb = parseSetBuilder(t)
    return sb.ok ? { ok: true, set: sb.set } : { ok: false, error: sb.error }
  }
  const iv = parseInterval(t)
  if (iv.ok) return { ok: true, set: iv.set }
  if (/[a-z]/i.test(t) && /[<>=≤≥]/.test(t)) {
    const r = setFromRelation(t)
    if (r) return { ok: true, set: r }
  }
  return { ok: false, error: iv.error }
}

// ---------------------------------------------------------------------------
// Value answers
// ---------------------------------------------------------------------------

const UNDEFINED_WORDS = /^(?:undefined|undef|dne|does\s+not\s+exist|none|no\s+(?:value|solution|output)|not\s+defined|n\/a|∅|\{\})$/i

export type ValueAnswerParse =
  | { ok: true; undefined: true }
  | { ok: true; undefined: false; node: MathNode; text: string }
  | { ok: false; error: ParseError }

/** A number ("11", "-1/2", "2sqrt(3)", "0.5") or a word for "undefined" ("undefined", "DNE", "none"). */
export function parseValueAnswer(text: string): ValueAnswerParse {
  const t = text.trim()
  if (!t) return { ok: false, error: { message: 'Type your answer first.', position: 0 } }
  if (UNDEFINED_WORDS.test(t)) return { ok: true, undefined: true }
  const p = parseExpression(t, ['x'])
  if (!p.ok) return { ok: false, error: p.error }
  if (/(?<![A-Za-z])x(?![A-Za-z])/.test(p.text)) {
    const at = t.search(/(?<![A-Za-z])x(?![A-Za-z])/)
    return { ok: false, error: { message: 'This answer is a number — plug the value in so no x is left.', position: Math.max(0, at), length: 1 } }
  }
  return { ok: true, undefined: false, node: p.node, text: p.text }
}
