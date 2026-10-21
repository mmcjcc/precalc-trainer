/**
 * Grading one trig answer: an exact angle in the unit asked, an exact value (or 'undefined'), or a number rounded
 * the way the problem asks. A named mistake is a slip whose value for THIS problem equals hers exactly (or, for a
 * rounded answer, rounds the same way). Not an attempt (`invalid`, nothing is logged): an unreadable answer, the
 * right value in a form that is not simplest radical form, a calculator decimal where the exact value is asked, a
 * number rounded too far, the exact value where a rounded one is asked, the wrong unit, a box labelled with another
 * function. No message here states the right answer before she has it.
 */
import { angleSay, measureOf, radiansOf, type AngleUnit } from './angle'
import { exactEq, exactNum, exactQ, type TrigExact } from './exact'
import { formNote, readTrigAnswer, type TrigNumberRead } from './reader'
import type { Q } from './rational'
import type { TrigMistakeId } from './types'
import { valueSay, type TrigFn, type TrigValue } from './values'

export type TrigSpec =
  /** An exact angle in `unit` (degrees as a number, radians as a multiple of π). */
  | { kind: 'angle'; unit: AngleUnit; deg: Q }
  /** An exact value or 'undefined'. `fn` is the function the box is for (a label naming another one is refused). */
  | { kind: 'value'; value: TrigValue; fn?: TrigFn; units?: readonly string[] }
  /** A number rounded to `places`. `unit` is the angle unit when the answer is an angle. */
  | { kind: 'decimal'; value: number; places: number; unit?: AngleUnit; units?: readonly string[] }

export interface TrigCandidate {
  id: TrigMistakeId
  /** Exact for exact answers (or 'undefined'); a number for a rounded answer. */
  value: TrigValue | number
  witness: string
}

export type TrigInvalidReason = 'unreadable' | 'not_simplest' | 'not_exact' | 'not_rounded' | 'not_decimal' | 'wrong_unit' | 'wrong_label'

export type TrigGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: TrigMistakeId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; reason: TrigInvalidReason; message: string }

const correct = (message: string): TrigGrade => ({ verdict: 'correct', message })
const wrong = (message: string): TrigGrade => ({ verdict: 'wrong', message })
const invalid = (reason: TrigInvalidReason, message: string): TrigGrade => ({ verdict: 'invalid', reason, message })
const named = (c: TrigCandidate): TrigGrade => ({ verdict: 'mistake', mistake: c.id, witness: c.witness })

const PLACES_WORDS = ['the nearest whole number', 'the nearest tenth', 'the nearest hundredth', 'the nearest thousandth', 'four decimal places']

export function placesPhrase(places: number): string {
  return PLACES_WORDS[places] ?? `${places} decimal places`
}

function exactCandidate(c: TrigCandidate): TrigExact | null {
  return typeof c.value === 'number' || c.value === 'undefined' ? null : c.value
}

/** A calculator decimal of `target`: she typed a decimal point and her number is within a unit of her last place. */
function calculatorDecimal(read: TrigNumberRead, target: number): boolean {
  if (!read.decimal) return false
  const tol = read.plain ? 10 ** -read.plain.places + 1e-12 : 0.01 * Math.max(1, Math.abs(target))
  return Math.abs(read.approx - target) <= tol
}

function gradeAngle(spec: Extract<TrigSpec, { kind: 'angle' }>, read: TrigNumberRead, cands: readonly TrigCandidate[]): TrigGrade {
  const target = measureOf({ deg: spec.deg, unit: spec.unit })
  const her = read.exact
  if (spec.unit === 'deg' && read.radians) return invalid('wrong_unit', 'This one asks for degrees, not radians.')
  if (spec.unit === 'rad' && read.degrees) {
    if (her && exactEq(her, exactQ(spec.deg))) return invalid('wrong_unit', 'That is the angle in degrees. This one asks for radians: multiply by π/180.')
    return invalid('wrong_unit', 'This one asks for radians, so the answer takes no degree sign.')
  }
  if (her && exactEq(her, target)) {
    if (read.issue) return invalid('not_simplest', formNote(read.issue))
    return correct(`Correct: ${angleSay({ deg: spec.deg, unit: spec.unit })}.`)
  }
  for (const c of cands) {
    const v = exactCandidate(c)
    if (her && v && exactEq(her, v)) return named(c)
  }
  if (spec.unit === 'deg' && read.hasPi) {
    if (her && exactEq(her, radiansOf(spec.deg))) return invalid('wrong_unit', 'That is the angle in radians. This one asks for degrees: multiply by 180/π.')
    return invalid('wrong_unit', 'This one asks for degrees, so the answer has no π in it.')
  }
  if (spec.unit === 'rad' && !read.hasPi && spec.deg.n !== 0 && her && exactEq(her, exactQ(spec.deg))) {
    return invalid('wrong_unit', 'That is the angle in degrees. This one asks for radians: multiply by π/180.')
  }
  if (calculatorDecimal(read, exactNum(target))) {
    return invalid('not_exact', spec.unit === 'rad' ? 'That is a calculator decimal. Give the exact answer: a number times π.' : 'That is a calculator decimal. Give the exact angle in degrees.')
  }
  if (read.issue === 'sum' && !her && Math.abs(read.approx - exactNum(target)) < 1e-9) return invalid('not_simplest', formNote('sum'))
  if (read.issue && read.issue !== 'sum') return invalid('not_simplest', formNote(read.issue))
  return wrong('That is not the angle this part asks for.')
}

function gradeValue(spec: Extract<TrigSpec, { kind: 'value' }>, read: TrigNumberRead | { kind: 'undefined' }, cands: readonly TrigCandidate[]): TrigGrade {
  if (read.kind === 'undefined') {
    if (spec.value === 'undefined') return correct('Correct: the value does not exist.')
    const hit = cands.find((c) => c.value === 'undefined')
    if (hit) return named(hit)
    return wrong('This value exists: it is a number.')
  }
  if (read.degrees) return invalid('wrong_unit', 'This answer is a number, not an angle: leave off the degree sign.')
  const her = read.exact
  if (spec.value !== 'undefined' && her && exactEq(her, spec.value)) {
    if (read.issue) return invalid('not_simplest', formNote(read.issue))
    return correct(`Correct: ${valueSay(spec.value)}.`)
  }
  for (const c of cands) {
    const v = exactCandidate(c)
    if (her && v && exactEq(her, v)) return named(c)
  }
  if (spec.value !== 'undefined') {
    const target = exactNum(spec.value)
    if (!her && read.issue === 'sum' && Math.abs(read.approx - target) < 1e-9 * Math.max(1, Math.abs(target))) return invalid('not_simplest', formNote('sum'))
  }
  if (read.issue) return invalid('not_simplest', formNote(read.issue))
  const near = [spec.value, ...cands.map((c) => c.value)].some((v) => typeof v !== 'number' && v !== 'undefined' && calculatorDecimal(read, exactNum(v)))
  if (near) return invalid('not_exact', 'That is a calculator decimal. This part asks for the exact value: a whole number, a fraction or a radical.')
  return wrong('That is not the value this part asks for.')
}

function gradeDecimal(spec: Extract<TrigSpec, { kind: 'decimal' }>, read: TrigNumberRead | { kind: 'undefined' }, typed: string, cands: readonly TrigCandidate[]): TrigGrade {
  if (read.kind === 'undefined') return invalid('unreadable', 'This answer is a number: work it out and round it the way the problem asks.')
  if (spec.unit === 'rad' && read.degrees) return invalid('wrong_unit', 'This answer is in radians, so it takes no degree sign.')
  if (spec.unit === 'deg' && read.radians) return invalid('wrong_unit', 'This answer is in degrees, not radians.')
  if (!spec.unit && read.degrees) return invalid('wrong_unit', 'This answer is not an angle: leave off the degree sign.')
  const tol = 0.5 * 10 ** -spec.places + 1e-9
  const plain = read.plain
  const numeric = cands.filter((c): c is TrigCandidate & { value: number } => typeof c.value === 'number')
  if (!plain) {
    if (Math.abs(read.approx - spec.value) <= 1e-9 * Math.max(1, Math.abs(spec.value))) {
      return invalid('not_decimal', `That is the exact value. This problem asks for a decimal: work it out on the calculator and round to ${placesPhrase(spec.places)}.`)
    }
    const hits = numeric.filter((c) => Math.abs(read.approx - c.value) <= 1e-9 * Math.max(1, Math.abs(c.value)))
    if (hits.length === 1) return named(hits[0]!)
    if (read.issue && read.issue !== 'sum') return invalid('not_simplest', formNote(read.issue))
    return wrong('That does not match this problem. Check the formula and each number you put in.')
  }
  if (Math.abs(plain.value - spec.value) <= tol) return correct(`Correct: ${typed.trim().replace(/-/g, '−')}.`)
  if (plain.places < spec.places && Math.abs(plain.value - spec.value) <= 0.5 * 10 ** -plain.places + 1e-9) {
    return invalid('not_rounded', `Keep ${spec.places} decimal place${spec.places === 1 ? '' : 's'}: your answer is rounded too far.`)
  }
  const herTol = Math.max(tol, 0.5 * 10 ** -plain.places + 1e-9)
  const hits = numeric.filter((c) => Math.abs(plain.value - c.value) <= herTol)
  if (hits.length === 1) return named(hits[0]!)
  return wrong('That does not match this problem. Check the formula and each number you put in.')
}

/** Grade her answer for one part. `candidates` are this problem's slips (slips.ts), in detection order. */
export function gradeTrigAnswer(spec: TrigSpec, typed: string, candidates: readonly TrigCandidate[]): TrigGrade {
  const read = readTrigAnswer(typed, { units: spec.kind === 'angle' ? [] : spec.units })
  if (!read.ok) return invalid('unreadable', read.message)
  if (spec.kind === 'value' && spec.fn && read.fn && read.fn !== spec.fn) {
    return invalid('wrong_label', `This box is for ${spec.fn}. Your answer is labelled ${read.fn}.`)
  }
  if (spec.kind === 'angle') {
    if (read.kind === 'undefined') return invalid('unreadable', 'An angle has a size: give it in degrees or in radians.')
    return gradeAngle(spec, read, candidates)
  }
  if (spec.kind === 'value') return gradeValue(spec, read, candidates)
  return gradeDecimal(spec, read, typed, candidates)
}
