/**
 * Her phase shift, read as a signed exact value (to the right is positive, to the left negative, none is zero), every
 * way a textbook writes it: "π/4 right", "π/4 to the right", "right π/4", "−π/3", "π/3 left", "π/3 units to the left",
 * "none", "no phase shift", "0". A bare number is signed: "π/4" is to the right and "−π/3" to the left (Larson's
 * phase shift C/B). Messages never contain a value she has not typed.
 */
import { EXACT_ZERO, exactEq, exactNeg, exactNum, exactTex, type TrigExact } from './exact'
import type { TrigGrade } from './grade'
import { formNote, readTrigAnswer } from './reader'
import type { TrigMistakeId } from './types'

export type ShiftRead = { ok: true; value: TrigExact; tex: string; decimal: boolean; places: number | null } | { ok: false; message: string }

const NONE = /^(?:none|no|zero|0|no\s+(?:phase\s+)?shift|not\s+shifted|no\s+horizontal\s+shift|no\s+shift)\.?$/i

function clean(raw: string): string {
  return (raw ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:the\s+)?(?:phase\s+|horizontal\s+)?shift(?:ed)?\s*(?:is|=|:)?\s*/i, '')
    .replace(/\.$/, '')
    .trim()
}

/** Read one phase shift. */
export function readShift(raw: string): ShiftRead {
  const t = clean(raw)
  if (!t) return { ok: false, message: 'Type your answer first: a size and a direction, or say there is no shift.' }
  if (NONE.test(t)) return { ok: true, value: EXACT_ZERO, tex: '\\text{none}', decimal: false, places: null }
  if (/\b(?:up|down|upward|downward)\b/i.test(t)) return { ok: false, message: 'Up and down is the vertical shift. The phase shift goes left or right.' }
  let dir: 'left' | 'right' | null = null
  let body = t
  const front = /^(?:to\s+the\s+)?(left|right)\s*(?:by\s+)?(.+)$/i.exec(t)
  const back = /^(.+?)\s*(?:units?\s*)?(?:to\s+the\s+)?(left|right|l|r)$/i.exec(t)
  if (front) {
    dir = front[1]!.toLowerCase() as 'left' | 'right'
    body = front[2]!
  } else if (back && /[\dπ)i]\s*(?:units?\s*)?(?:to\s+the\s+)?(?:left|right|l|r)$/i.test(t)) {
    const w = back[2]!.toLowerCase()
    dir = w === 'l' || w === 'left' ? 'left' : 'right'
    body = back[1]!
  } else if (/\b(?:left|right)\b/i.test(t)) {
    return { ok: false, message: 'Write the size of the shift and then its direction, like a/b left.' }
  }
  const read = readTrigAnswer(body.trim())
  if (!read.ok) return { ok: false, message: read.message }
  if (read.kind === 'undefined') return { ok: false, message: 'A shift is a number: how far the graph moves, and which way.' }
  if (read.degrees) return { ok: false, message: 'The shift is measured in the units of x, radians: no degree sign.' }
  if (read.issue) return { ok: false, message: formNote(read.issue) }
  if (!read.exact) return { ok: false, message: 'Write the shift as one number: combine the terms.' }
  let value = read.exact
  if (dir) {
    if (exactNum(value) < 0) return { ok: false, message: 'With left or right, give the size of the shift: a positive number.' }
    if (dir === 'left') value = exactNeg(value)
  }
  const size = exactNum(value) < 0 ? exactNeg(value) : value
  const tex = exactNum(value) === 0 ? '\\text{none}' : `${exactTex(size)}\\text{ to the ${exactNum(value) < 0 ? 'left' : 'right'}}`
  return { ok: true, value, tex, decimal: read.decimal, places: read.plain?.places ?? null }
}

export interface ShiftCandidate {
  id: TrigMistakeId
  value: TrigExact
  witness: string
}

/** Grade her phase shift against the exact answer and this problem's slips. */
export function gradeShift(answer: TrigExact, typed: string, candidates: readonly ShiftCandidate[]): TrigGrade {
  const r = readShift(typed)
  if (!r.ok) return { verdict: 'invalid', reason: 'unreadable', message: r.message }
  if (exactEq(r.value, answer)) {
    const n = exactNum(answer)
    return { verdict: 'correct', message: n === 0 ? 'Correct: there is no phase shift.' : `Correct: the graph shifts ${n < 0 ? 'left' : 'right'}.` }
  }
  for (const c of candidates) if (exactEq(r.value, c.value)) return { verdict: 'mistake', mistake: c.id, witness: c.witness }
  const target = exactNum(answer)
  if (r.decimal && r.places !== null && target !== 0 && Math.abs(Math.abs(exactNum(r.value)) - Math.abs(target)) <= 10 ** -r.places + 1e-12) {
    return { verdict: 'invalid', reason: 'not_exact', message: 'That is a calculator decimal. Give the exact shift, with π where the shift has it.' }
  }
  return { verdict: 'wrong', message: 'That is not the phase shift.' }
}
