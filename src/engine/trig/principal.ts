/**
 * The inverse trig functions (Unit 5): the principal value of arcsin, arccos and arctan at the special values, exactly
 * (from the hand table of the special angles: arcsin and arctan on the right half of the unit circle, arccos on the top
 * half), and no value at all outside the domain of arcsin and arccos. The slips of each question are computed for the
 * problem in hand, in degrees and then written in the unit asked: the unit circle's other angle, a positive angle for a
 * negative principal value, the sign dropped, arccos treated like arcsin, sin and cos swapped, tan upside down; on the
 * calculator, DEGREE mode, one over the function, the function itself; and for arcsin(sin θ), θ kept outside the range.
 * The sentences talk about her answer and never state the right one.
 */
import { exactNum, exactPi, exactQ, type TrigExact } from './exact'
import { principalDegrees } from './expr'
import { q, qAdd, qDiv, qNeg, qSub, type Q } from './rational'
import type { TrigMistakeId } from './types'
import { trigValue, type TrigFn } from './values'

export type InvFn = 'asin' | 'acos' | 'atan'
export type InvUnit = 'deg' | 'rad'

export const INV_BASE: Record<InvFn, TrigFn> = { asin: 'sin', acos: 'cos', atan: 'tan' }
export const INV_WORD: Record<InvFn, string> = { asin: 'arcsin', acos: 'arccos', atan: 'arctan' }
const FN_WORD: Record<InvFn, string> = { asin: 'sine', acos: 'cosine', atan: 'tangent' }
/** Where the principal values are, in words (no endpoints, which a problem may ask for). */
export const RANGE_WORDS: Record<InvFn, string> = {
  asin: 'the right half of the unit circle, Quadrants I and IV',
  acos: 'the top half of the unit circle, Quadrants I and II',
  atan: 'the right half of the unit circle, strictly between the top and the bottom',
}

/** The principal value in degrees; null outside the domain. Throws when the input is not a special value. */
export function principalValue(fn: InvFn, v: TrigExact): Q | null {
  const d = principalDegrees(fn, v)
  if (d === 'none') return null
  if (d === null) throw new Error(`${INV_WORD[fn]} has no exact special value here`)
  return q(d)
}

/** An angle in degrees, written in the unit asked: −60 or −π/3. */
export function angleIn(deg: Q, unit: InvUnit): TrigExact {
  return unit === 'deg' ? exactQ(deg) : exactPi(qDiv(deg, q(180)))
}

export interface InverseSlip {
  id: TrigMistakeId
  /** The slip's angle in degrees. */
  deg: Q
  witness: string
}

const into360 = (d: Q): Q => {
  let r = d
  while (r.n < 0) r = qAdd(r, q(360))
  while (r.n >= 360 * r.d) r = qSub(r, q(360))
  return r
}
const same = (a: Q, b: Q) => a.n === b.n && a.d === b.d

function distinctSlips(answer: Q, slips: readonly (InverseSlip | null)[]): InverseSlip[] {
  const out: InverseSlip[] = []
  for (const s of slips) {
    if (!s || same(s.deg, answer) || out.some((o) => same(o.deg, s.deg))) continue
    out.push(s)
  }
  return out
}

/** The other special angle in one turn where the base function has this value (not coterminal with p), or null. */
function otherAngle(fn: InvFn, p: Q): Q | null {
  const o = fn === 'asin' ? into360(qSub(q(180), p)) : fn === 'acos' ? into360(qSub(q(360), p)) : into360(qAdd(p, q(180)))
  return same(o, into360(p)) ? null : o
}

/** Slips for the exact value of an inverse function at a special value (inside the domain). */
export function evaluateSlips(fn: InvFn, v: TrigExact): InverseSlip[] {
  const p = principalValue(fn, v)
  if (!p) return []
  const negative = exactNum(v) < 0
  const word = INV_WORD[fn]
  const slips: (InverseSlip | null)[] = []
  if (fn === 'acos' && negative) {
    slips.push({
      id: 'trig_arccos_range_as_arcsin',
      deg: qSub(p, q(180)),
      witness: `That is a negative angle, the way arcsin answers a negative input. ${word} never gives a negative angle: its angles are on ${RANGE_WORDS.acos}, so a negative input lands in Quadrant II.`,
    })
  }
  const other = otherAngle(fn, p)
  slips.push(
    other
      ? {
          id: 'trig_inverse_other_angle',
          deg: other,
          witness: `That angle has the right ${FN_WORD[fn]}, but it is not the one ${word} gives. Of the angles with that ${FN_WORD[fn]}, ${word} takes the one on ${RANGE_WORDS[fn]}.`,
        }
      : null,
  )
  if (p.n < 0) {
    slips.push({
      id: 'trig_inverse_not_principal',
      deg: qAdd(p, q(360)),
      witness: `That is the right place on the unit circle, but measured counterclockwise nearly all the way round. ${word} of a negative input is a negative angle: turn clockwise from the positive x-axis instead.`,
    })
    slips.push({
      id: 'trig_inverse_sign_dropped',
      deg: qNeg(p),
      witness: `That angle belongs to the positive input. A negative input gives a negative angle here: ${word}(−x) = −${word}(x).`,
    })
  }
  if (fn === 'acos' && negative) {
    slips.push({
      id: 'trig_inverse_sign_dropped',
      deg: qSub(q(180), p),
      witness: `That angle belongs to the positive input. A negative input puts the angle in Quadrant II: arccos(−x) is a half turn minus arccos(x).`,
    })
  }
  if (fn === 'asin' || fn === 'acos') {
    const co: InvFn = fn === 'asin' ? 'acos' : 'asin'
    const c = principalDegrees(co, v)
    if (typeof c === 'number') {
      slips.push({
        id: 'trig_sin_cos_swapped',
        deg: q(c),
        witness:
          fn === 'asin'
            ? 'That angle has this number as its cosine, not its sine. arcsin gives the angle whose sine, the y-coordinate on the unit circle, is the input.'
            : 'That angle has this number as its sine, not its cosine. arccos gives the angle whose cosine, the x-coordinate on the unit circle, is the input.',
      })
    }
  } else if (exactNum(v) !== 0) {
    // The angle whose tangent is 1/v: the cotangent read as the tangent.
    const recip = principalDegrees('atan', invert(v))
    const c = typeof recip === 'number' ? recip : null
    if (c !== null) {
      slips.push({
        id: 'trig_tan_inverted',
        deg: q(c),
        witness: 'That angle has this number as its cotangent, x over y. arctan gives the angle whose tangent, y over x, is the input.',
      })
    }
  }
  return distinctSlips(p, slips)
}

/** 1/v for c·√m (no π): √m/(c·m). */
function invert(v: TrigExact): TrigExact {
  const n = v.c.n
  const d = v.c.d
  const m = v.root
  // 1/((n/d)√m) = d/(n√m) = d√m/(n·m)
  const num = d * Math.sign(n)
  const den = Math.abs(n) * m
  const g = gcdInt(Math.abs(num), den)
  return { c: { n: num / g, d: den / g }, root: m, pi: 0 }
}

function gcdInt(a: number, b: number): number {
  return b ? gcdInt(b, a % b) : a || 1
}

/**
 * The angle a student gives for an input outside the domain (arcsin 2): the end of the range the input points past, as
 * if the inverse stopped there. It is a value she can type; the slip is giving any value at all.
 */
export function outsideDomainTrap(fn: 'asin' | 'acos', x: number): Q {
  if (fn === 'asin') return q(x > 0 ? 90 : -90)
  return q(x > 0 ? 0 : 180)
}

/** The witness for any number given where there is no value. */
export function outsideDomainWitness(fn: 'asin' | 'acos', inputSay: string): string {
  const base = fn === 'asin' ? 'sine' : 'cosine'
  return `Your answer is an angle, but check the input first: a ${base} is never more than 1 or less than −1, so ${INV_WORD[fn]} only takes inputs from −1 to 1. Is ${inputSay} one of them?`
}

// ---------------------------------------------------------------------------
// The calculator
// ---------------------------------------------------------------------------

/** arcsin, arccos or arctan of a number, in radians (RADIAN mode). */
export function inverseRad(fn: InvFn, x: number): number {
  return fn === 'asin' ? Math.asin(x) : fn === 'acos' ? Math.acos(x) : Math.atan(x)
}

export interface InverseDecimalSlip {
  id: TrigMistakeId
  value: number
  witness: string
}

const KEY: Record<InvFn, string> = { asin: 'SIN', acos: 'COS', atan: 'TAN' }

/** Slips for a calculator value in radians: DEGREE mode, one over the function, the function itself. */
export function inverseDecimalSlips(fn: InvFn, x: number, xSay: string): InverseDecimalSlip[] {
  const base = INV_BASE[fn]
  const f = base === 'sin' ? Math.sin(x) : base === 'cos' ? Math.cos(x) : Math.tan(x)
  return [
    {
      id: 'trig_degree_mode',
      value: (inverseRad(fn, x) * 180) / Math.PI,
      witness: `That is the angle in degrees: the calculator is in DEGREE mode. Press MODE, choose RADIAN, and work out ${base}⁻¹(${xSay}) again.`,
    },
    {
      id: 'trig_inverse_as_reciprocal',
      value: 1 / f,
      witness: `That is 1 ÷ ${base}(${xSay}), one over the ${FN_WORD[fn]}. ${base}⁻¹ is not one over ${base}: it is the angle whose ${FN_WORD[fn]} is ${xSay}, 2nd ${KEY[fn]} on the TI-84.`,
    },
    {
      id: 'trig_ratio_for_angle',
      value: f,
      witness: `That is ${base}(${xSay}), the ${FN_WORD[fn]} of the number. The angle whose ${FN_WORD[fn]} is ${xSay} is ${base}⁻¹(${xSay}): 2nd ${KEY[fn]} on the TI-84.`,
    },
  ]
}

// ---------------------------------------------------------------------------
// arcsin(sin θ), arccos(cos θ), arctan(tan θ)
// ---------------------------------------------------------------------------

/** f⁻¹(f(θ)) for θ in degrees: the principal value with the same value of f; null where f(θ) has no value. */
export function cancelValue(fn: InvFn, thetaDeg: Q): Q | null {
  const v = trigValue(INV_BASE[fn], thetaDeg)
  if (!v || v === 'undefined') return null
  return principalValue(fn, v)
}

/** Slips for f⁻¹(f(θ)): θ kept (outside the range), the positive angle for a negative value, the sign dropped, the other angle. */
export function cancelSlips(fn: InvFn, thetaDeg: Q): InverseSlip[] {
  const p = cancelValue(fn, thetaDeg)
  if (!p) return []
  const word = INV_WORD[fn]
  const slips: (InverseSlip | null)[] = [
    {
      id: 'trig_inverse_cancel_outside',
      deg: thetaDeg,
      witness: `${word} undoes ${INV_BASE[fn]} only for angles on ${RANGE_WORDS[fn]}. This angle is not there, so the answer is the angle there with the same ${FN_WORD[fn]}.`,
    },
  ]
  if (p.n < 0) {
    slips.push({
      id: 'trig_inverse_not_principal',
      deg: qAdd(p, q(360)),
      witness: `That is the right place on the unit circle, but measured counterclockwise nearly all the way round. ${word} gives a negative angle here: turn clockwise from the positive x-axis instead.`,
    })
    slips.push({
      id: 'trig_inverse_sign_dropped',
      deg: qNeg(p),
      witness: `That angle has the opposite ${FN_WORD[fn]}. Find the ${FN_WORD[fn]} of the angle inside first, sign and all, then the angle with that ${FN_WORD[fn]} on ${RANGE_WORDS[fn]}.`,
    })
  }
  const other = otherAngle(fn, p)
  if (other && !same(other, into360(thetaDeg))) {
    slips.push({
      id: 'trig_inverse_other_angle',
      deg: other,
      witness: `That angle has the right ${FN_WORD[fn]}, but it is not the one ${word} gives. Of the angles with that ${FN_WORD[fn]}, ${word} takes the one on ${RANGE_WORDS[fn]}.`,
    })
  }
  return distinctSlips(p, slips)
}

/** Is the angle (degrees) in the principal range of the inverse? */
export function inPrincipalRange(fn: InvFn, deg: Q): boolean {
  const d = deg.n / deg.d
  if (fn === 'asin') return d >= -90 && d <= 90
  if (fn === 'acos') return d >= 0 && d <= 180
  return d > -90 && d < 90
}
