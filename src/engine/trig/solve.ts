/**
 * Every angle in one turn where a function has a special value (uc.solve): "sin θ = −√3/2 on [0°, 360°)" is 240°
 * and 300°. The solutions are read off the hand table of the special angles (values.ts), exactly; the answer is a list
 * she types with commas in any order ("240, 300", "4π/3, 5π/3"). The slips are lists too: the reference angle alone,
 * the quadrants where the function has the other sign, the calculator's angle kept outside the range, sin and cos
 * swapped, a reciprocal missing or mixed up, π dropped. A list with one of two answers is named as such, with a
 * sentence that says how many there are and never which.
 */
import { angleSay, type AngleUnit } from './angle'
import { exactEq, exactNum, exactPi, exactQ, exactSay, exactText, exactNeg, type TrigExact } from './exact'
import type { TrigGrade, TrigInvalidReason } from './grade'
import { formNote, readTrigAnswer, type TrigNumberRead } from './reader'
import { q, qAdd, qCmp, qDiv, qMul, type Q } from './rational'
import type { TrigMistakeId } from './types'
import { trigValue, valueEq, type TrigFn } from './values'

/** The sixteen special angles of one turn, in degrees. */
export const SPECIAL_DEGREES: readonly number[] = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]

/** Every θ in [0°, 360°) with fn(θ) = value, exactly, in increasing order (none when the value is not special). */
export function solveAnswer(fn: TrigFn, value: TrigExact): Q[] {
  return SPECIAL_DEGREES.filter((d) => {
    const v = trigValue(fn, q(d))
    return v !== null && v !== 'undefined' && exactEq(v, value)
  }).map((d) => q(d))
}

/** An angle in degrees as the exact value she types in `unit`: 240 or 4π/3. */
export function angleValue(deg: Q, unit: AngleUnit): TrigExact {
  return unit === 'deg' ? exactQ(deg) : exactPi(qDiv(deg, q(180)))
}

/** The degrees of an exact angle typed in `unit`; null when it is not an angle in that unit (no π in radians). */
export function degreesOfValue(v: TrigExact, unit: AngleUnit): Q | null {
  if (v.root !== 1) return null
  if (unit === 'deg') return v.pi === 0 ? v.c : null
  if (v.c.n === 0) return q(0)
  return v.pi === 1 ? qMul(v.c, q(180)) : null
}

/** A list as she would type it: "240, 300", "4π/3, 5π/3". */
export function listText(degs: readonly Q[], unit: AngleUnit): string {
  return degs.map((d) => exactText(angleValue(d, unit))).join(', ')
}

/** For a sentence: "240° and 300°", "4π/3 and 5π/3". */
export function listSay(degs: readonly Q[], unit: AngleUnit): string {
  const words = degs.map((d) => angleSay({ deg: d, unit }))
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)!}`
}

/** A slip as a whole list, in the unit asked. */
export interface TrigListSlip {
  id: TrigMistakeId
  values: TrigExact[]
  witness: string
}

const RANGE: Record<AngleUnit, string> = { deg: '[0°, 360°)', rad: '[0, 2π)' }
const TURN: Record<AngleUnit, string> = { deg: '360°', rad: '2π' }
const BASE: Partial<Record<TrigFn, TrigFn>> = { csc: 'sin', sec: 'cos', cot: 'tan' }

const sorted = (vs: readonly TrigExact[]) => [...vs].sort((a, b) => exactNum(a) - exactNum(b))
const sameList = (a: readonly TrigExact[], b: readonly TrigExact[]) => a.length === b.length && sorted(a).every((v, i) => exactEq(v, sorted(b)[i]!))

/** The reference angle of the value's size, from the first quadrant (an axis gives none). */
function referenceOf(fn: TrigFn, value: TrigExact): Q | null {
  const size = exactNum(value) < 0 ? exactNeg(value) : value
  const firstQuadrant = solveAnswer(fn, size).find((d) => d.n > 0 && d.n < 90)
  return firstQuadrant ?? null
}

/** The angle the calculator's inverse gives (sin⁻¹ and tan⁻¹ in (−90°, 90°), cos⁻¹ in [0°, 180°]), exactly. */
function principalDegrees(fn: TrigFn, value: TrigExact): Q | null {
  const base = BASE[fn] ?? fn
  const v = BASE[fn] ? (exactNum(value) === 0 ? null : exactNum(value)) : exactNum(value)
  if (v === null) return null
  const x = BASE[fn] ? 1 / v : v
  const rad = base === 'sin' ? Math.asin(x) : base === 'cos' ? Math.acos(x) : Math.atan(x)
  if (!Number.isFinite(rad)) return null
  const deg = Math.round((rad * 180) / Math.PI)
  return Math.abs((rad * 180) / Math.PI - deg) < 1e-9 ? q(deg) : null
}

/**
 * The slips of one equation as whole lists, in detection order, the answer and repeats left out: the reference angle
 * alone; the quadrants where the function has the other sign; the calculator's angle kept outside the range; sin and
 * cos swapped; a reciprocal missing (cot solved as tan) or mixed up (csc and sec); π dropped (radians). π dropped is
 * left out when an answer is π itself (the catalog's lesson on π would name it).
 */
export function solveSlips(fn: TrigFn, value: TrigExact, unit: AngleUnit): TrigListSlip[] {
  const answer = solveAnswer(fn, value)
  const asked = answer.map((d) => angleValue(d, unit))
  const val = (degs: readonly Q[]) => degs.map((d) => angleValue(d, unit))
  const fnSay = `${fn} θ`
  const v = exactSay(value)
  const negative = exactNum(value) < 0
  const out: TrigListSlip[] = []
  const add = (s: TrigListSlip | null) => {
    if (!s || s.values.length === 0 || sameList(s.values, asked) || out.some((o) => sameList(o.values, s.values))) return
    out.push(s)
  }
  const offAxis = answer.every((d) => d.n % 90 !== 0)
  const ref = referenceOf(fn, value)
  if (ref && offAxis && !answer.some((d) => qCmp(d, ref) === 0)) {
    add({
      id: 'trig_solve_reference_only',
      values: val([ref]),
      witness: `Your list is just the reference angle, ${angleSay({ deg: ref, unit })}. ${fnSay} is ${negative ? 'negative' : 'positive'} here, so θ is in the quadrants where ${fn} is ${negative ? 'negative' : 'positive'}: put the reference angle into each of them.`,
    })
  }
  if (exactNum(value) !== 0) {
    const other = solveAnswer(fn, exactNeg(value))
    add({
      id: 'trig_solve_wrong_sign_quadrant',
      values: val(other),
      witness: `${fnSay} is ${negative ? 'positive' : 'negative'} at ${listSay(other, unit)}, but this equation has ${fnSay} ${negative ? 'negative' : 'positive'}. Use the quadrants where ${fn} is ${negative ? 'negative' : 'positive'}.`,
    })
  }
  const p = principalDegrees(fn, value)
  if (p && (p.n < 0 || p.n > 0)) {
    const base = BASE[fn] ?? fn
    let kept: Q[] | null = null
    if (base === 'cos' && p.n > 0 && p.n < 180) kept = [p, q(-p.n)]
    else if (base !== 'cos' && p.n < 0) kept = answer.map((d) => (qCmp(d, qAdd(p, q(360))) === 0 ? p : d))
    if (kept && kept.some((d) => d.n < 0)) {
      // The sentence does not quote her negative angle: for cos it is minus an answer (−30° next to 30°).
      add({
        id: 'trig_solve_out_of_range',
        values: val(kept),
        witness: `Your list has a negative angle, the kind the calculator’s inverse gives, and it is outside ${RANGE[unit]}. Add ${TURN[unit]} to it to bring it into the range.`,
      })
    }
  }
  if (fn === 'sin' || fn === 'cos') {
    const co: TrigFn = fn === 'sin' ? 'cos' : 'sin'
    add({
      id: 'trig_sin_cos_swapped',
      values: val(solveAnswer(co, value)),
      witness: `Those are the angles where ${co} θ = ${v}. ${fn === 'sin' ? 'sin θ is the y-coordinate of the point on the unit circle; cos θ is the x-coordinate.' : 'cos θ is the x-coordinate of the point on the unit circle; sin θ is the y-coordinate.'}`,
    })
  }
  if (fn === 'cot') {
    add({
      id: 'trig_reciprocal_missing',
      values: val(solveAnswer('tan', value)),
      witness: `Those are the angles where tan θ = ${v}. cot θ is one over tan θ, so solve tan θ = one over ${v} instead.`,
    })
  }
  if (fn === 'csc' || fn === 'sec') {
    const mixed: TrigFn = fn === 'csc' ? 'sec' : 'csc'
    add({
      id: 'trig_reciprocal_mixed',
      values: val(solveAnswer(mixed, value)),
      witness: `Those are the angles where ${mixed} θ = ${v}, and ${mixed} goes with ${mixed === 'sec' ? 'cos' : 'sin'}. ${fn} goes with ${fn === 'csc' ? 'sin' : 'cos'}: ${fn} θ = ${v} means ${fn === 'csc' ? 'sin' : 'cos'} θ is one over ${v}.`,
    })
  }
  if (unit === 'rad' && !answer.some((d) => d.n === 180)) {
    add({
      id: 'trig_pi_dropped',
      values: answer.map((d) => exactQ(qDiv(d, q(180)))),
      witness: 'Your angles have no π. In radians each angle is a number times π.',
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Reading a list
// ---------------------------------------------------------------------------

export type TrigListRead = { ok: true; items: TrigNumberRead[]; tex: string } | { ok: false; message: string }

/** Two numbers with only a space between them: "210 330". */
const SPACED = /^[-−+]?[\dπ.]+(?:\/\d+)?°?\s+[-−+]?[\dπ.]/i

/**
 * Her list of angles: separated by commas (or semicolons, "and", "or"), in any order, each one as the reader takes it
 * ("θ = 210°", "7pi/6", "{210, 330}"). A message when a piece cannot be read.
 */
export function readAngleList(raw: string): TrigListRead {
  let text = (raw ?? '').replace(/[−–—]/g, '-').trim()
  if (!text) return { ok: false, message: 'Type your answer first.' }
  const braces = /^\{(.*)\}$/.exec(text)
  if (braces) text = braces[1]!.trim()
  if (!text) return { ok: false, message: 'Type the angles inside the braces.' }
  const pieces = text.split(/\s*(?:,|;|&|\band\b|\bor\b)\s*/i)
  if (pieces.length > 1 && pieces.at(-1) === '') pieces.pop()
  if (pieces.some((p) => p === '')) return { ok: false, message: 'Your list has an empty spot: one angle between each pair of commas.' }
  if (pieces.length > 8) return { ok: false, message: 'That list is longer than this problem needs.' }
  const items: TrigNumberRead[] = []
  for (const piece of pieces) {
    if (SPACED.test(piece)) return { ok: false, message: 'Put a comma between the angles.' }
    const r = readTrigAnswer(piece)
    if (!r.ok) return { ok: false, message: r.message }
    if (r.kind === 'undefined') return { ok: false, message: 'Each angle has a size: give it in degrees or in radians.' }
    items.push(r)
  }
  return { ok: true, items, tex: items.map((i) => i.tex).join(',\\ ') }
}

// ---------------------------------------------------------------------------
// Grading a list
// ---------------------------------------------------------------------------

export interface AngleListSpec {
  unit: AngleUnit
  /** The answer in degrees. */
  degs: Q[]
  fn: TrigFn
  value: TrigExact
}

/** A grade with the key of her list (its angles in order), so the same list checked again is the same attempt. */
export type TrigListGrade = TrigGrade & { key?: string }

const invalid = (reason: TrigInvalidReason, message: string): TrigListGrade => ({ verdict: 'invalid', reason, message })

/** Within a unit of her last place of some answer's decimal: a calculator decimal. */
function nearDecimal(item: TrigNumberRead, targets: readonly number[]): boolean {
  if (!item.decimal || !item.plain) return false
  const tol = 10 ** -item.plain.places + 1e-12
  return targets.some((t) => Math.abs(item.approx - t) <= tol)
}

/**
 * Grade her list. Right: the same angles in any order. Named: a slip's list exactly, then by rule an angle outside the
 * range, every angle the right size with one in a quadrant of the other sign, or some but not all of the answers. Not
 * an attempt: an unreadable piece, the wrong unit, a calculator decimal, a form that is not simplest, an angle twice.
 */
export function gradeAngleList(spec: AngleListSpec, typed: string, candidates: readonly TrigListSlip[]): TrigListGrade {
  const read = readAngleList(typed)
  if (!read.ok) return invalid('unreadable', read.message)
  const items = read.items
  const unit = spec.unit
  const answerValues = spec.degs.map((d) => angleValue(d, unit))
  if (unit === 'deg') {
    if (items.some((i) => i.radians)) return invalid('wrong_unit', 'This one asks for degrees, not radians.')
    if (items.some((i) => i.hasPi)) {
      const asRadians = spec.degs.map((d) => angleValue(d, 'rad'))
      const hers = items.map((i) => i.exact).filter((e): e is TrigExact => e !== null)
      if (hers.length === items.length && sameList(hers, asRadians)) return invalid('wrong_unit', 'Those are the angles in radians. This one asks for degrees: multiply by 180/π.')
      return invalid('wrong_unit', 'This one asks for degrees, so the angles have no π in them.')
    }
  } else if (items.some((i) => i.degrees)) {
    return invalid('wrong_unit', 'This one asks for radians, so the angles take no degree sign.')
  }
  for (const i of items) {
    if (i.issue) return invalid('not_simplest', formNote(i.issue))
    if (!i.exact) return invalid('not_simplest', formNote('sum'))
  }
  const hers = items.map((i) => i.exact!)
  const key = sorted(hers).map((v) => exactText(v)).join('|')
  for (let a = 0; a < hers.length; a++) {
    for (let b = a + 1; b < hers.length; b++) if (exactEq(hers[a]!, hers[b]!)) return invalid('unreadable', 'Your list has the same angle twice. List each angle once.')
  }
  if (sameList(hers, answerValues)) return { verdict: 'correct', message: `Correct: ${listSay(spec.degs, unit)}.`, key }
  for (const c of candidates) if (sameList(hers, c.values)) return { verdict: 'mistake', mistake: c.id, witness: c.witness, key }
  // Not angles in the unit asked: radians without π, or degrees with a radical.
  const degs = hers.map((v) => degreesOfValue(v, unit))
  if (degs.some((d) => d === null)) {
    const targets = answerValues.map(exactNum)
    // In radians the notes write π attached (kπ/n): π on its own is an answer of cos θ = −1.
    if (items.some((i) => nearDecimal(i, targets))) {
      return invalid('not_exact', unit === 'rad' ? 'That is a calculator decimal. Give each angle exactly, written kπ/n.' : 'That is a calculator decimal. Give each angle exactly, in degrees.')
    }
    if (unit === 'rad') {
      const inDegrees = spec.degs.map((d) => exactQ(d))
      if (sameList(hers, inDegrees)) return invalid('wrong_unit', 'Those are the angles in degrees. This one asks for radians: multiply by π/180.')
      return invalid('wrong_unit', 'In radians each angle is written kπ/n or kπ, with whole numbers k and n.')
    }
    return invalid('unreadable', 'An angle in degrees is a number: no square root in it.')
  }
  const ds = degs as Q[]
  const range = RANGE[unit]
  const outside = ds.find((d) => qCmp(d, q(0)) < 0 || qCmp(d, q(360)) >= 0)
  if (outside) {
    // Her angle is not quoted: a negative one can be minus an answer, one past a turn an answer plus a turn.
    const negative = qCmp(outside, q(0)) < 0
    return {
      verdict: 'mistake',
      mistake: 'trig_solve_out_of_range',
      witness: negative
        ? `Your list has a negative angle, and it is outside ${range}. Add ${TURN[unit]} to it to bring it into the range.`
        : `Your list has an angle of a full turn or more, outside ${range}. Subtract ${TURN[unit]} to bring it into the range.`,
      key,
    }
  }
  const valueAt = (d: Q) => trigValue(spec.fn, d)
  const size = (d: Q) => {
    const v = valueAt(d)
    return v !== null && v !== 'undefined' && (valueEq(v, spec.value) || valueEq(v, exactNeg(spec.value)))
  }
  const wrongSign = ds.filter((d) => {
    const v = valueAt(d)
    return v !== null && v !== 'undefined' && !valueEq(v, spec.value) && valueEq(v, exactNeg(spec.value))
  })
  if (exactNum(spec.value) !== 0 && ds.every(size) && wrongSign.length > 0) {
    const negative = exactNum(spec.value) < 0
    return {
      verdict: 'mistake',
      mistake: 'trig_solve_wrong_sign_quadrant',
      witness: `${spec.fn} θ is ${negative ? 'positive' : 'negative'} at ${listSay(wrongSign, unit)}, but this equation has ${spec.fn} θ ${negative ? 'negative' : 'positive'}. Use only the quadrants where ${spec.fn} is ${negative ? 'negative' : 'positive'}.`,
      key,
    }
  }
  const inAnswer = (d: Q) => spec.degs.some((a) => qCmp(a, d) === 0)
  if (ds.length < spec.degs.length && ds.every(inAnswer)) {
    const count = spec.degs.length === 2 ? 'two angles' : `${spec.degs.length} angles`
    const has = ds.length === 1 ? 'one of them' : `${ds.length} of them`
    return {
      verdict: 'mistake',
      mistake: 'trig_solve_one_answer',
      witness: `There are ${count} in ${range} where ${spec.fn} θ = ${exactSay(spec.value)}, and your list has ${has}. Find the other one.`,
      key,
    }
  }
  return { verdict: 'wrong', message: 'Not every angle in that list solves the equation, or some are missing.', key }
}
