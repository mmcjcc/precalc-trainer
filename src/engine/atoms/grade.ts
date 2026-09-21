/**
 * Shared shape of an atomic-structure grade: one entry per answer box, the distinct named mistakes,
 * and a headline message. A box that is empty or unreadable makes the whole check a parse error:
 * nothing is graded then, so no box gives its answer away piecemeal and nothing is recorded.
 */
import type { AtomBox, AtomBoxGrade, AtomGrade, ErrorPatternId, ParseError, PatternHit } from '@/shared/types'
import { patternHit } from '../matchers/catalog'
import type { Parsed } from './particle'

export const okBox = (box: AtomBox, message = ''): AtomBoxGrade => ({ box, status: 'correct', message })

export const plainBox = (box: AtomBox, message: string): AtomBoxGrade => ({ box, status: 'wrong', message })

export function namedBox(box: AtomBox, id: ErrorPatternId, witness: string): AtomBoxGrade {
  return { box, status: 'wrong', message: witness, pattern: patternHit(id, witness) }
}

export function parseBox(box: AtomBox, error: ParseError): AtomBoxGrade {
  return { box, status: 'parse_error', message: error.message, parseError: error }
}

/**
 * Parse every box. When any box fails, the grade is a parse error that lists ONLY the unreadable
 * boxes (the readable ones are not graded yet).
 */
export function parseAll<T extends Record<string, unknown>>(
  specs: { [K in keyof T]: { box: AtomBox; parsed: Parsed<T[K]> } },
  order: (keyof T)[],
): { ok: true; values: T } | { ok: false; grade: AtomGrade } {
  const failures: AtomBoxGrade[] = []
  const values = {} as T
  for (const key of order) {
    const { box, parsed } = specs[key]
    if (parsed.ok) values[key] = parsed.value
    else failures.push(parseBox(box, parsed.error))
  }
  if (failures.length === 0) return { ok: true, values }
  return { ok: false, grade: { status: 'parse_error', message: failures[0]!.message, boxes: failures, patterns: [] } }
}

/** Collect the distinct patterns in box order and pick the headline. */
export function finishGrade(boxes: AtomBoxGrade[], correctMessage: string, note?: string): AtomGrade {
  const patterns: PatternHit[] = []
  for (const b of boxes) if (b.pattern && !patterns.some((p) => p.id === b.pattern!.id)) patterns.push(b.pattern)
  const wrong = boxes.filter((b) => b.status !== 'correct')
  if (wrong.length === 0) {
    const g: AtomGrade = { status: 'correct', message: correctMessage, boxes, patterns: [] }
    if (note) g.note = note
    return g
  }
  const headline = patterns[0]?.witness ?? wrong[0]!.message
  return { status: 'wrong', message: headline, boxes, patterns }
}
