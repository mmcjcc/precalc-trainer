/**
 * A list of points with exact coordinates, "(π/4, 1), (π/2, 4), (3π/4, 1), (π, −2), (5π/4, 1)": the five key points of
 * one period of a sine or cosine graph. Each coordinate is read by the trig reader (π, fractions, radicals); the list is
 * graded as a set, in any order. Messages never contain a value she has not typed.
 */
import { exactEq, exactNum, type TrigExact } from './exact'
import type { TrigGrade } from './grade'
import { formNote, readTrigAnswer } from './reader'
import type { TrigMistakeId } from './types'

export interface XYPoint {
  x: TrigExact
  y: TrigExact
}

export type PointsRead = { ok: true; points: XYPoint[]; tex: string } | { ok: false; message: string }

function coordinate(text: string): { ok: true; v: TrigExact; tex: string } | { ok: false; message: string } {
  const r = readTrigAnswer(text)
  if (!r.ok) return { ok: false, message: r.message }
  if (r.kind === 'undefined') return { ok: false, message: 'Each coordinate is a number.' }
  if (r.degrees) return { ok: false, message: 'The x-coordinates are in radians: no degree sign.' }
  if (r.issue) return { ok: false, message: formNote(r.issue) }
  if (!r.exact) return { ok: false, message: 'Write each coordinate as one number: combine the terms.' }
  return { ok: true, v: r.exact, tex: r.tex }
}

/** Read a list of points, each in parentheses. */
export function readPointList(raw: string): PointsRead {
  const t = (raw ?? '').replace(/[−–—]/g, '-').trim()
  if (!t) return { ok: false, message: 'Type your answer first: points like (a, b), separated by commas.' }
  const points: XYPoint[] = []
  const texs: string[] = []
  let i = 0
  while (i < t.length) {
    const c = t[i]!
    if (/[\s,;]/.test(c)) {
      i++
      continue
    }
    if (/^and\b/i.test(t.slice(i))) {
      i += 3
      continue
    }
    if (c !== '(') return { ok: false, message: 'Write each point in parentheses, like (a, b), with commas between the points.' }
    let depth = 0
    let j = i
    for (; j < t.length; j++) {
      if (t[j] === '(') depth++
      else if (t[j] === ')') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth !== 0) return { ok: false, message: 'A parenthesis is missing its partner.' }
    const inner = t.slice(i + 1, j)
    const parts: string[] = []
    let d = 0
    let start = 0
    for (let k = 0; k < inner.length; k++) {
      if (inner[k] === '(') d++
      else if (inner[k] === ')') d--
      else if (inner[k] === ',' && d === 0) {
        parts.push(inner.slice(start, k))
        start = k + 1
      }
    }
    parts.push(inner.slice(start))
    if (parts.length !== 2 || !parts[0]!.trim() || !parts[1]!.trim()) return { ok: false, message: 'Each point has two coordinates, x and y, with a comma between them.' }
    const x = coordinate(parts[0]!)
    if (!x.ok) return x
    const y = coordinate(parts[1]!)
    if (!y.ok) return y
    points.push({ x: x.v, y: y.v })
    texs.push(`\\left(${x.tex}, ${y.tex}\\right)`)
    i = j + 1
  }
  if (!points.length) return { ok: false, message: 'Type your answer first: points like (a, b), separated by commas.' }
  return { ok: true, points, tex: texs.join(',\\; ') }
}

const samePoint = (a: XYPoint, b: XYPoint) => exactEq(a.x, b.x) && exactEq(a.y, b.y)

/** The same points, in any order (no point twice). */
export function samePoints(a: readonly XYPoint[], b: readonly XYPoint[]): boolean {
  return a.length === b.length && a.every((p, i) => a.findIndex((r) => samePoint(r, p)) === i) && a.every((p) => b.some((r) => samePoint(p, r)))
}

export interface PointsCandidate {
  id: TrigMistakeId
  points: XYPoint[]
  witness: string
}

/** Grade her list of key points against the answer and this problem's slips. */
export function gradePoints(answer: readonly XYPoint[], typed: string, candidates: readonly PointsCandidate[]): TrigGrade {
  const r = readPointList(typed)
  if (!r.ok) return { verdict: 'invalid', reason: 'unreadable', message: r.message }
  const her = r.points
  if (her.some((p, i) => her.findIndex((s) => samePoint(s, p)) !== i)) return { verdict: 'invalid', reason: 'unreadable', message: 'Your list has the same point twice.' }
  if (samePoints(her, answer)) return { verdict: 'correct', message: 'Correct: those are the key points of one period.' }
  for (const c of candidates) if (samePoints(her, c.points)) return { verdict: 'mistake', mistake: c.id, witness: c.witness }
  if (her.length !== answer.length && her.every((p) => answer.some((a) => samePoint(a, p)))) {
    return { verdict: 'invalid', reason: 'unreadable', message: 'Those points are right, but one period has five key points: the start, the end, and three between them, a quarter period apart.' }
  }
  const near = her.length === answer.length && her.every((p) => answer.some((a) => Math.abs(exactNum(a.x) - exactNum(p.x)) < 0.01 && Math.abs(exactNum(a.y) - exactNum(p.y)) < 0.01))
  if (near) return { verdict: 'invalid', reason: 'not_exact', message: 'Those are calculator decimals. Give each coordinate exactly, with π in the x-coordinates.' }
  return { verdict: 'wrong', message: 'Those are not the key points of this period.' }
}
