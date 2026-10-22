/**
 * Right-triangle trigonometry, exactly. An acute angle θ of a right triangle names its three sides: the opposite side
 * (across from θ), the adjacent side (the leg that touches θ) and the hypotenuse (across from the right angle). Here:
 * the third side from two (the Pythagorean theorem, a radical left in simplest form), the six ratios of θ, and the
 * slips of each, computed for the triangle in hand, with a sentence about her answer that never states the right one.
 * Sides are c·√m with no π.
 */
import { exactDiv, exactMul, exactQ, exactRational, exactSay, exactSqrt, type TrigExact } from './exact'
import { qAdd, qSub, type Q } from './rational'
import type { TrigSlip } from './slips'
import type { TrigMistakeId } from './types'
import { valueEq, type TrigFn } from './values'

export type RtRole = 'opp' | 'adj' | 'hyp'

/** The three sides of a right triangle, named from the acute angle θ. */
export interface RtSides {
  opp: TrigExact
  adj: TrigExact
  hyp: TrigExact
}

/** a² as a rational, for a side c·√m. */
export function squareOf(a: TrigExact): Q {
  const s = exactRational(exactMul(a, a))
  if (!s || a.pi !== 0) throw new Error('a side is a whole number or a radical')
  return s
}

function rootOf(v: Q): TrigExact {
  if (v.n <= 0) throw new Error('no side has a length of zero or less')
  const r = exactSqrt(exactQ(v))
  if (!r) throw new Error('no square root')
  return r
}

/** The hypotenuse from the two legs: √(a² + b²). */
export function hypotenuseOf(a: TrigExact, b: TrigExact): TrigExact {
  return rootOf(qAdd(squareOf(a), squareOf(b)))
}

/** A leg from the other leg and the hypotenuse: √(c² − a²). */
export function legOf(leg: TrigExact, hyp: TrigExact): TrigExact {
  return rootOf(qSub(squareOf(hyp), squareOf(leg)))
}

/** "5", "2√3" for a sentence; squared as "5²" or "(2√3)²". */
const say = (a: TrigExact) => exactSay(a)
const sq = (a: TrigExact) => (/^\d+$/.test(say(a)) ? `${say(a)}²` : `(${say(a)})²`)

/** Leave out a slip equal to the answer, and a later slip equal to an earlier one. */
function distinct(answer: TrigExact, slips: readonly (TrigSlip | null)[]): TrigSlip[] {
  const out: TrigSlip[] = []
  for (const s of slips) {
    if (!s || valueEq(s.value, answer)) continue
    if (out.some((o) => valueEq(o.value, s.value))) continue
    out.push(s)
  }
  return out
}

/** Slips finding the hypotenuse from two legs: the square left unrooted, the squares subtracted. */
export function hypotenuseSlips(a: TrigExact, b: TrigExact): TrigSlip[] {
  const answer = hypotenuseOf(a, b)
  const sum = qAdd(squareOf(a), squareOf(b))
  const diff = qSub(squareOf(a), squareOf(b))
  return distinct(answer, [
    {
      id: 'trig_side_not_rooted',
      value: exactQ(sum),
      witness: `Your answer is ${sq(a)} + ${sq(b)}, the square of the hypotenuse. The hypotenuse itself is the square root of that sum.`,
    },
    diff.n !== 0
      ? {
          id: 'trig_pythag_subtracted',
          value: rootOf(diff.n > 0 ? diff : { n: -diff.n, d: diff.d }),
          witness: `Your answer subtracts the squares, but ${say(a)} and ${say(b)} are both legs: neither one is across from the right angle. With two legs, add the squares, then take the square root.`,
        }
      : null,
  ])
}

/** Slips finding a leg from the other leg and the hypotenuse: the squares added, the square left unrooted. */
export function legSlips(leg: TrigExact, hyp: TrigExact): TrigSlip[] {
  const answer = legOf(leg, hyp)
  return distinct(answer, [
    {
      id: 'trig_pythag_added',
      value: hypotenuseOf(leg, hyp),
      witness: `Your answer adds the squares of ${say(leg)} and ${say(hyp)}, but ${say(hyp)} is the hypotenuse, the side across from the right angle. With a leg and the hypotenuse, subtract the leg’s square from the hypotenuse’s square.`,
    },
    {
      id: 'trig_side_not_rooted',
      value: exactQ(qSub(squareOf(hyp), squareOf(leg))),
      witness: `Your answer is ${sq(hyp)} − ${sq(leg)}, the square of the missing leg. The leg itself is the square root of that difference.`,
    },
  ])
}

/** Which two sides each ratio of θ divides: top over bottom. */
export const RATIO_SIDES: Record<TrigFn, [RtRole, RtRole]> = {
  sin: ['opp', 'hyp'],
  cos: ['adj', 'hyp'],
  tan: ['opp', 'adj'],
  csc: ['hyp', 'opp'],
  sec: ['hyp', 'adj'],
  cot: ['adj', 'opp'],
}

export const ROLE_WORDS: Record<RtRole, string> = { opp: 'opposite', adj: 'adjacent', hyp: 'hypotenuse' }

/** One of the six ratios of θ, exactly (a radical in the denominator is rationalized by the normal form). */
export function rtRatio(fn: TrigFn, s: RtSides): TrigExact {
  const [top, bottom] = RATIO_SIDES[fn]
  return exactDiv(s[top], s[bottom])
}

/**
 * Slips for one ratio of θ: the opposite and adjacent sides swapped (the ratio as seen from the other acute angle),
 * the hypotenuse used as a leg (the ratio upside down, or a leg on the bottom of sin and cos), and for the reciprocal
 * functions the reciprocal left out or mixed up.
 */
export function rtRatioSlips(fn: TrigFn, s: RtSides): TrigSlip[] {
  const answer = rtRatio(fn, s)
  const r = (top: RtRole, bottom: RtRole) => exactDiv(s[top], s[bottom])
  const slip = (id: TrigMistakeId, top: RtRole, bottom: RtRole, witness: string): TrigSlip => ({ id, value: r(top, bottom), witness })
  const out: TrigSlip[] = []
  switch (fn) {
    case 'sin':
      out.push(
        slip('trig_opposite_adjacent_swapped', 'adj', 'hyp', 'That is adjacent over hypotenuse, which is cos θ: the ratio as seen from the other acute angle. sin θ uses the side across from θ: opposite over hypotenuse.'),
        slip('trig_hypotenuse_as_leg', 'hyp', 'opp', 'Your answer is more than one, and a sine never is: the hypotenuse is the longest side, so it goes on the bottom. sin θ is opposite over hypotenuse.'),
        slip('trig_hypotenuse_as_leg', 'opp', 'adj', 'That is opposite over adjacent, the two legs, which is tan θ. The bottom of sin θ is the hypotenuse, the side across from the right angle.'),
      )
      break
    case 'cos':
      out.push(
        slip('trig_opposite_adjacent_swapped', 'opp', 'hyp', 'That is opposite over hypotenuse, which is sin θ: the ratio as seen from the other acute angle. cos θ uses the leg that touches θ: adjacent over hypotenuse.'),
        slip('trig_hypotenuse_as_leg', 'hyp', 'adj', 'Your answer is more than one, and a cosine never is: the hypotenuse is the longest side, so it goes on the bottom. cos θ is adjacent over hypotenuse.'),
        slip('trig_hypotenuse_as_leg', 'adj', 'opp', 'That is adjacent over opposite, the two legs. The bottom of cos θ is the hypotenuse, the side across from the right angle.'),
      )
      break
    case 'tan':
      out.push(
        slip('trig_opposite_adjacent_swapped', 'adj', 'opp', 'That is adjacent over opposite, the tangent of the other acute angle. tan θ is the side across from θ over the leg that touches θ.'),
        slip('trig_hypotenuse_as_leg', 'opp', 'hyp', 'That divides by the hypotenuse, which makes it sin θ. tan θ is opposite over adjacent: the two legs, not the hypotenuse.'),
      )
      break
    case 'csc':
      out.push(
        slip('trig_reciprocal_missing', 'opp', 'hyp', 'That is opposite over hypotenuse, which is sin θ. csc θ is its reciprocal: hypotenuse over opposite.'),
        slip('trig_reciprocal_mixed', 'hyp', 'adj', 'That is hypotenuse over adjacent, which is sec θ. csc θ goes with sin θ: hypotenuse over opposite.'),
      )
      break
    case 'sec':
      out.push(
        slip('trig_reciprocal_missing', 'adj', 'hyp', 'That is adjacent over hypotenuse, which is cos θ. sec θ is its reciprocal: hypotenuse over adjacent.'),
        slip('trig_reciprocal_mixed', 'hyp', 'opp', 'That is hypotenuse over opposite, which is csc θ. sec θ goes with cos θ: hypotenuse over adjacent.'),
      )
      break
    case 'cot':
      out.push(slip('trig_reciprocal_missing', 'opp', 'adj', 'That is opposite over adjacent, which is tan θ. cot θ is its reciprocal: adjacent over opposite.'))
      break
  }
  return distinct(answer, out)
}
