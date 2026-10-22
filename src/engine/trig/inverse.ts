/**
 * Sides and angles of a right triangle on the calculator, as the TI-84 gives them in DEGREE mode: a side from an acute
 * angle and one other side, and an acute angle from two sides with sin⁻¹, cos⁻¹ and tan⁻¹. Decimals, rounded by the
 * caller. Each slip keeps its number before rounding: the calculator in RADIAN mode, the ratio for the other acute
 * angle (or an angle of depression measured from the vertical), the ratio upside down or a leg taken for the
 * hypotenuse, and for an angle SIN pressed where 2nd SIN was meant (or the ratio itself given as the angle). The
 * sentences talk about her answer with the problem's own words and never state the right number.
 */
import type { TrigDecimalSlip } from './slips'
import { ROLE_WORDS, type RtRole } from './triangle'

export type RtFn = 'sin' | 'cos' | 'tan'

const RAD = Math.PI / 180
const KEY: Record<RtFn, string> = { sin: 'SIN', cos: 'COS', tan: 'TAN' }
const WORD: Record<RtFn, string> = { sin: 'sine', cos: 'cosine', tan: 'tangent' }
const CO: Record<RtFn, RtFn> = { sin: 'cos', cos: 'sin', tan: 'tan' }

/** sin, cos or tan of an angle in degrees: the calculator in DEGREE mode. */
export function fnDegrees(fn: RtFn, deg: number): number {
  return fnRadians(fn, deg * RAD)
}

/** The same keys in RADIAN mode: the number is read as radians. */
export function fnRadians(fn: RtFn, x: number): number {
  return fn === 'sin' ? Math.sin(x) : fn === 'cos' ? Math.cos(x) : Math.tan(x)
}

/** sin⁻¹, cos⁻¹ or tan⁻¹ in degrees (DEGREE mode). */
export function inverseDegrees(fn: RtFn, ratio: number): number {
  return inverseRadians(fn, ratio) / RAD
}

/** The same keys in RADIAN mode: the angle as a number of radians. */
export function inverseRadians(fn: RtFn, ratio: number): number {
  return fn === 'sin' ? Math.asin(ratio) : fn === 'cos' ? Math.acos(ratio) : Math.atan(ratio)
}

/** The function of θ that links two sides, written top over bottom: sin = opp/hyp, cos = adj/hyp, tan = opp/adj. */
export function linkOf(a: RtRole, b: RtRole): { fn: RtFn; top: RtRole; bottom: RtRole } {
  const has = (r: RtRole) => a === r || b === r
  if (a === b) throw new Error('two different sides')
  if (has('opp') && has('hyp')) return { fn: 'sin', top: 'opp', bottom: 'hyp' }
  if (has('adj') && has('hyp')) return { fn: 'cos', top: 'adj', bottom: 'hyp' }
  return { fn: 'tan', top: 'opp', bottom: 'adj' }
}

/** Words for the three sides in a sentence: "the ladder", "the height up the wall". */
export type RtNames = Record<RtRole, string>

/** An angle of depression: where it is measured from (the high point) and where the triangle's angle really is. */
export interface DepressionWords {
  /** "the top of the lighthouse" */
  high: string
  /** "the boat" */
  low: string
}

/** A side from an acute angle θ (degrees) and one other side. */
export interface SideProblem {
  deg: number
  known: { role: RtRole; value: number }
  asked: RtRole
  names: RtNames
  depression?: DepressionWords
}

function sideWith(deg: number, known: { role: RtRole; value: number }, asked: RtRole, f: (fn: RtFn, deg: number) => number): number {
  const L = linkOf(known.role, asked)
  const v = f(L.fn, deg)
  // v = top / bottom: the unknown on top is the known side times v, on the bottom the known side over v.
  return asked === L.top ? known.value * v : known.value / v
}

export function sideAnswer(p: SideProblem): number {
  return sideWith(p.deg, p.known, p.asked, fnDegrees)
}

const degSay = (deg: number) => `${Number(deg.toFixed(6))}°`
const role = (r: RtRole) => (r === 'hyp' ? 'the hypotenuse' : `the ${ROLE_WORDS[r]} side`)
const swapLeg = (r: RtRole): RtRole => (r === 'opp' ? 'adj' : r === 'adj' ? 'opp' : r)

/**
 * Slips for a side, in detection order: RADIAN mode; the other acute angle's ratio (named as measured from the vertical
 * on an angle of depression); the ratio upside down (sin and cos) or a leg taken for the hypotenuse (tan).
 */
export function sideSlips(p: SideProblem): TrigDecimalSlip[] {
  const A = degSay(p.deg)
  const L = linkOf(p.known.role, p.asked)
  const fn = L.fn
  const out: TrigDecimalSlip[] = []
  out.push({
    id: 'trig_radian_mode',
    value: sideWith(p.deg, p.known, p.asked, (f, d) => fnRadians(f, d)),
    witness: `That is what the calculator gives in RADIAN mode: it took ${A} as ${Number(p.deg.toFixed(6))} radians. Press MODE, choose DEGREE, and work it out again.`,
  })
  const other = sideWith(90 - p.deg, p.known, p.asked, fnDegrees)
  if (p.depression) {
    out.push({
      id: 'trig_depression_from_vertical',
      value: other,
      witness: `That puts the ${A} angle at ${p.depression.high}, between the vertical side and the line of sight. An angle of depression is measured down from the horizontal, so in the triangle the ${A} angle is the one at ${p.depression.low}.`,
    })
  } else if (fn === 'tan') {
    out.push({
      id: 'trig_opposite_adjacent_swapped',
      value: other,
      witness: `That has the two legs the other way round. From the ${A} angle, ${p.names.opp} is the opposite side and ${p.names.adj} is the adjacent side, and tan ${A} = opposite/adjacent.`,
    })
  } else {
    const leg: RtRole = p.known.role === 'hyp' ? p.asked : p.known.role
    out.push({
      id: 'trig_opposite_adjacent_swapped',
      value: other,
      witness: `That uses ${CO[fn]} ${A} where ${fn} ${A} belongs: from the ${A} angle, ${p.names[leg]} is ${role(leg)}, not ${role(swapLeg(leg))}.`,
    })
  }
  if (fn === 'tan') {
    // Both sides are legs: one of them taken for the hypotenuse.
    const asHyp = p.known.role
    const value = p.asked === 'opp' ? p.known.value * fnDegrees('sin', p.deg) : p.known.value * fnDegrees('cos', p.deg)
    out.push({
      id: 'trig_hypotenuse_as_leg',
      value,
      witness: `That uses ${p.asked === 'opp' ? 'sin' : 'cos'} ${A}, as if ${p.names[asHyp]} were the hypotenuse. ${cap(p.names.opp)} and ${p.names.adj} are both legs: the hypotenuse is across from the right angle, so the ratio of the two legs is tan.`,
    })
  } else if (p.asked === L.top) {
    out.push({
      id: 'trig_hypotenuse_as_leg',
      value: p.known.value / fnDegrees(fn, p.deg),
      witness: `Your answer divides by ${fn} ${A}, which makes a leg longer than the hypotenuse. ${fn} ${A} = ${ROLE_WORDS[L.top]}/${ROLE_WORDS[L.bottom]}, so ${p.names[p.asked]} is ${p.names[p.known.role]} times ${fn} ${A}.`,
    })
  } else {
    out.push({
      id: 'trig_hypotenuse_as_leg',
      value: p.known.value * fnDegrees(fn, p.deg),
      witness: `Your answer multiplies by ${fn} ${A}, which makes the hypotenuse shorter than a leg. ${fn} ${A} = ${ROLE_WORDS[L.top]}/${ROLE_WORDS[L.bottom]}, so divide ${p.names[p.known.role]} by ${fn} ${A}.`,
    })
  }
  return out
}

/** A capital at the start of a sentence, but a letter that names a side ("x") stays as it is. */
function cap(s: string): string {
  return /^[a-z]{2}/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** An acute angle θ from two sides (named from θ). */
export interface AngleProblem {
  a: { role: RtRole; value: number }
  b: { role: RtRole; value: number }
  names: RtNames
  depression?: DepressionWords
}

function ratioParts(p: AngleProblem): { fn: RtFn; top: number; bottom: number; text: string } {
  const L = linkOf(p.a.role, p.b.role)
  const v = (r: RtRole) => (p.a.role === r ? p.a.value : p.b.value)
  const top = v(L.top)
  const bottom = v(L.bottom)
  return { fn: L.fn, top, bottom, text: `${top}/${bottom}` }
}

export function angleAnswer(p: AngleProblem): number {
  const r = ratioParts(p)
  return inverseDegrees(r.fn, r.top / r.bottom)
}

/**
 * Slips for an angle, in detection order: RADIAN mode; SIN pressed where 2nd SIN was meant; the ratio itself; the other
 * acute angle (measured from the vertical, on an angle of depression); a leg taken for the hypotenuse, or the
 * hypotenuse for a leg.
 */
export function angleSlips(p: AngleProblem): TrigDecimalSlip[] {
  const r = ratioParts(p)
  const ratio = r.top / r.bottom
  const fn = r.fn
  const theta = inverseDegrees(fn, ratio)
  const out: TrigDecimalSlip[] = [
    {
      id: 'trig_radian_mode',
      value: inverseRadians(fn, ratio),
      witness: `That is the angle in radians: the calculator was in RADIAN mode. Press MODE, choose DEGREE, and work out ${fn}⁻¹(${r.text}) again.`,
    },
    {
      id: 'trig_ratio_for_angle',
      value: fnDegrees(fn, ratio),
      witness: `That is ${fn}(${r.text}), the ${WORD[fn]} of a number. The angle is the one whose ${WORD[fn]} is ${r.text}: ${fn}⁻¹(${r.text}), which is 2nd ${KEY[fn]} on the TI-84.`,
    },
    {
      id: 'trig_ratio_for_angle',
      value: ratio,
      witness: `That is the ratio ${r.text} itself, which is ${fn} θ. The angle is ${fn}⁻¹ of it: 2nd ${KEY[fn]} on the TI-84.`,
    },
  ]
  if (p.depression) {
    out.push({
      id: 'trig_depression_from_vertical',
      value: 90 - theta,
      witness: `That angle is measured from the vertical, between the side at ${p.depression.high} and the line of sight. An angle of depression is measured down from the horizontal: it is the other acute angle of the triangle.`,
    })
  } else {
    const L = linkOf(p.a.role, p.b.role)
    out.push({
      id: 'trig_opposite_adjacent_swapped',
      value: 90 - theta,
      witness: `That is the other acute angle. From θ, ${p.names[L.top]} is ${role(L.top)} and ${p.names[L.bottom]} is ${role(L.bottom)}, so use ${fn}⁻¹.`,
    })
  }
  if (fn === 'tan') {
    if (r.top < r.bottom) {
      out.push({
        id: 'trig_hypotenuse_as_leg',
        value: inverseDegrees('sin', ratio),
        witness: `That uses sin⁻¹, as if ${p.names.adj} were the hypotenuse. ${cap(p.names.opp)} and ${p.names.adj} are both legs, so the ratio of the two is tan θ.`,
      })
    }
  } else {
    // The hypotenuse in the place of the missing leg, with tan.
    const missingIsAdj = fn === 'sin'
    const value = missingIsAdj ? inverseDegrees('tan', r.top / r.bottom) : inverseDegrees('tan', r.bottom / r.top)
    out.push({
      id: 'trig_hypotenuse_as_leg',
      value,
      witness: `That uses tan⁻¹ with ${p.names.hyp} as a leg, but ${p.names.hyp} is the hypotenuse, across from the right angle. With the hypotenuse, the ratio is ${fn} θ.`,
    })
  }
  return out
}
