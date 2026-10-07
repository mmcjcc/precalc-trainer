/**
 * Domain, range, and k graders. Each slip is the set or number that mistake produces on this problem.
 * A slip equal to the right answer is not named.
 */
import type { ErrorPatternId } from '@/shared/types'
import type { SolutionSet } from '@/shared/types'
import { parseInterval, ratEquals, setFromRelation, setToInterval, setsEqual } from '@/notation'
import {
  domainCloseOne,
  domainFillGaps,
  domainOf,
  fromStored,
  parseRat,
  rangeFromX,
  rangeOf,
  showMinus,
  unrestrictedRange,
  type BuiltPiece,
  type StoredPiece,
} from './model'

export type PwGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; id: ErrorPatternId; witness: string; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

interface Slip {
  id: ErrorPatternId
  set: SolutionSet
}

export function domainSlips(pieces: readonly BuiltPiece[]): Slip[] {
  const domain = domainOf(pieces)
  const out: Slip[] = []
  const filled = domainFillGaps(domain)
  if (!setsEqual(filled, domain)) out.push({ id: 'pw_domain_gap', set: filled })
  const closed = domainCloseOne(domain)
  if (closed && !setsEqual(closed, domain)) out.push({ id: 'pw_domain_closed', set: closed })
  return out
}

export function rangeSlips(pieces: readonly BuiltPiece[]): Slip[] {
  const range = rangeOf(pieces)
  const out: Slip[] = []
  const fromX = rangeFromX(pieces)
  if (fromX && !setsEqual(fromX, range)) out.push({ id: 'pw_range_from_x', set: fromX })
  const open = unrestrictedRange(pieces)
  if (!setsEqual(open, range)) out.push({ id: 'pw_range_unrestricted', set: open })
  return out
}

export function parseAnswerSet(text: string): SolutionSet | null {
  const rel = setFromRelation(text)
  if (rel) return rel
  const parsed = parseInterval(text)
  return parsed.ok ? parsed.set : null
}

function gradeSet(truth: SolutionSet, slips: readonly Slip[], text: string, kind: 'domain' | 'range'): PwGrade {
  const hers = parseAnswerSet(text)
  if (!hers) return { verdict: 'invalid', message: 'Type the set in interval notation, with a bracket on an included end and a parenthesis on an open end.' }
  const right = setToInterval(truth)
  if (setsEqual(hers, truth)) {
    return { verdict: 'correct', message: kind === 'domain' ? `The domain is ${showMinus(right)}.` : `The range is ${showMinus(right)}.` }
  }
  const herText = setToInterval(hers)
  for (const slip of slips) {
    if (!setsEqual(hers, slip.set)) continue
    const witness = witnessFor(slip.id, herText, right)
    return { verdict: 'mistake', id: slip.id, witness, message: witness }
  }
  const witness = `${showMinus(herText)} is not the ${kind}. The ${kind} is ${showMinus(right)}.`
  return { verdict: 'wrong', message: witness }
}

function witnessFor(id: ErrorPatternId, hers: string, right: string): string {
  const h = showMinus(hers)
  const r = showMinus(right)
  if (id === 'pw_domain_gap') return `${h} fills a gap the pieces leave out. The domain is ${r}.`
  if (id === 'pw_domain_closed') return `${h} closes an end the piece leaves open. The domain is ${r}.`
  if (id === 'pw_range_from_x') return `${h} uses the x-values at the boundaries. The range is the outputs, ${r}.`
  if (id === 'pw_range_unrestricted') return `${h} is what the pieces would cover if x could be anything. On these intervals the range is ${r}.`
  return `${h} is not it. The answer is ${r}.`
}

export function gradePwSet(pieces: readonly StoredPiece[], kind: 'domain' | 'range', text: string): PwGrade {
  const built = fromStored(pieces)
  if (!built) return { verdict: 'invalid', message: 'This problem could not be checked.' }
  if (kind === 'domain') return gradeSet(domainOf(built), domainSlips(built), text, 'domain')
  return gradeSet(rangeOf(built), rangeSlips(built), text, 'range')
}

export function gradeK(kText: string, slips: readonly { id: ErrorPatternId; text: string }[], answer: string): PwGrade {
  const hers = parseRat(answer.trim())
  const right = parseRat(kText)
  if (!hers) return { verdict: 'invalid', message: 'Type k as an integer or a fraction, like 3 or -1/2.' }
  if (!right) return { verdict: 'invalid', message: 'This problem could not be checked.' }
  if (ratEquals(hers, right)) return { verdict: 'correct', message: `k = ${showMinus(kText)}.` }
  for (const slip of slips) {
    const v = parseRat(slip.text)
    if (!v || !ratEquals(hers, v)) continue
    const witness = kWitness(slip.id, slip.text, kText)
    return { verdict: 'mistake', id: slip.id, witness, message: witness }
  }
  return { verdict: 'wrong', message: `${showMinus(answer.trim())} does not make the pieces meet. k = ${showMinus(kText)}.` }
}

function kWitness(id: ErrorPatternId, hers: string, right: string): string {
  const h = showMinus(hers)
  const r = showMinus(right)
  if (id === 'pw_k_sign') return `k = ${h} is the opposite sign. The pieces meet when k = ${r}.`
  if (id === 'pw_k_wrong_piece') return `k = ${h} uses the boundary’s x-value in the piece that has k. Set that piece equal to the other piece’s height: k = ${r}.`
  if (id === 'pw_k_other_boundary') return `k = ${h} makes the pieces meet at the other boundary. They have to meet at the shared boundary, so k = ${r}.`
  return `k = ${h} does not make the pieces meet. k = ${r}.`
}
