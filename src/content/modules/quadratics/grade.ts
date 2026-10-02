/**
 * The two parts of the vertex question the engine has no grader for: which way the parabola opens, and its
 * minimum or maximum value. Both are read off the engine's `completeSquare(f)`; nothing is worked out here.
 * They return the engine's PolyGrade shape so the shared recorder and feedback cards take them as they are.
 */
import { completeSquare, gradeVertex, parsePointAnswer } from '@/engine'
import type { PolyGrade, PolyInput } from '@/engine'
import { ratEquals, ratFromString, ratToString } from '@/notation'
import { polyShow } from '@/content/modules/polynomials/patterns'

const UNSUPPORTED: PolyGrade = { verdict: 'unsupported', message: 'This problem is not a quadratic, so it cannot be checked. Pick another problem.' }

/** Her up / down choice ('' when she has not chosen). */
export function gradeOpens(f: PolyInput, choice: string): PolyGrade {
  const m = completeSquare(f)
  if (!m) return UNSUPPORTED
  const pick = choice.trim().toLowerCase()
  if (pick !== 'up' && pick !== 'down') return { verdict: 'invalid', reason: 'unreadable', message: 'Choose whether the parabola opens up or down.' }
  const a = polyShow(ratToString(m.a))
  const sign = m.opens === 'up' ? 'positive' : 'negative'
  if (pick === m.opens) return { verdict: 'correct', message: `Correct: a = ${a} is ${sign}, so the parabola opens ${m.opens}.`, explanation: m.explanation }
  return {
    verdict: 'wrong',
    message: `Look at the number in front of x^2: a = ${a} is ${sign}, so the parabola opens ${m.opens}, not ${pick}.`,
    explanation: m.explanation,
  }
}

/**
 * Her minimum / maximum choice and the value she typed. A value that is one of the engine's named vertex
 * slips (the k of a wrong vertex form, at the right h) is named by the engine's own vertex grader.
 */
export function gradeExtremum(f: PolyInput, kind: string, valueText: string, options: { vertex?: string } = {}): PolyGrade {
  const m = completeSquare(f)
  if (!m) return UNSUPPORTED
  const pick = kind.trim().toLowerCase()
  if (pick !== 'minimum' && pick !== 'maximum') return { verdict: 'invalid', reason: 'unreadable', message: 'Choose whether the value is a minimum or a maximum.' }
  if (valueText.trim() === '') return { verdict: 'invalid', reason: 'unreadable', message: `Type the ${pick} value first.` }
  const value = ratFromString(valueText)
  if (!value) return { verdict: 'invalid', reason: 'unreadable', message: `Type the ${pick} value as one number: a whole number, a fraction or a decimal.` }
  const right = m.extremum.kind
  const point = right === 'minimum' ? 'lowest' : 'highest'
  const k = polyShow(ratToString(m.extremum.value))
  const hers = polyShow(ratToString(value))
  const valueRight = ratEquals(value, m.extremum.value)
  if (valueRight && pick === right) {
    return { verdict: 'correct', message: `Correct: the parabola opens ${m.opens}, so the vertex is its ${point} point and ${k} is the ${right} value.`, explanation: m.explanation }
  }
  if (valueRight) {
    return {
      verdict: 'wrong',
      message: `${k} is the right number, but it is a ${right}, not a ${pick}: the parabola opens ${m.opens}, so the vertex is its ${point} point.`,
      explanation: m.explanation,
    }
  }
  // The same number as the y of the vertex she typed in this check: that box already carries the lesson.
  const herVertex = options.vertex ? parsePointAnswer(options.vertex) : null
  if (herVertex?.ok && herVertex.y && ratEquals(herVertex.y, value)) {
    return {
      verdict: 'wrong',
      message: `${hers} is the y-coordinate of the vertex you gave, so this will come right when the vertex does.`,
      explanation: m.explanation,
    }
  }
  if (ratEquals(value, m.h)) {
    return {
      verdict: 'wrong',
      message: `Your ${hers} is the x-coordinate of the vertex: it says where the turn happens. The ${right} value is the height there, the y-coordinate of the vertex.`,
      explanation: m.explanation,
    }
  }
  // The right h with her number as k: the engine names the slip when that point is one a slip produces.
  const asVertex = gradeVertex(f, `(${ratToString(m.h)}, ${ratToString(value)})`)
  if (asVertex.verdict === 'mistake') return asVertex
  return {
    verdict: 'wrong',
    message: `The ${right} value is the y-coordinate of the vertex: put the x of the axis of symmetry into f(x). That does not give ${hers}.`,
    explanation: m.explanation,
  }
}
