/**
 * The special right triangles, exactly. In a 45°-45°-90° triangle the legs are equal and the hypotenuse is a leg
 * times √2; in a 30°-60°-90° triangle the hypotenuse is twice the short leg (across from 30°) and the long leg
 * (across from 60°) is the short leg times √3. Every side follows from any one of them by a factor; the slips are the
 * factors a student uses instead, each with its own id and a sentence that never states the right side.
 */
import { exactInt, exactMul, exactQ, tx, type TrigExact } from './exact'
import { q } from './rational'
import type { TrigSlip } from './slips'
import type { TrigMistakeId } from './types'
import { valueEq } from './values'

export type SpecialTriangle = '45' | '30'
/** 45°-45°-90°: a leg or the hypotenuse. 30°-60°-90°: the short leg, the long leg or the hypotenuse. */
export type SpecialRole = 'leg' | 'short' | 'long' | 'hyp'

const ONE = exactInt(1)
const TWO = exactInt(2)
const HALF = exactQ(q(1, 2))
const ROOT2 = tx(q(1), 2)
const ROOT2_HALF = tx(q(1, 2), 2)
const ROOT3 = tx(q(1), 3)
const ROOT3_THIRD = tx(q(1, 3), 3)
const ROOT3_HALF = tx(q(1, 2), 3)
const TWO_ROOT3_THIRDS = tx(q(2, 3), 3)
const TWO_ROOT3 = tx(q(2), 3)

/** The roles a triangle has, in the order a textbook names them. */
export function specialRoles(tri: SpecialTriangle): SpecialRole[] {
  return tri === '45' ? ['leg', 'hyp'] : ['short', 'long', 'hyp']
}

/** The factor that turns the side `from` into the side `to`: short → long is √3, hyp → leg is √2/2. */
export function specialFactor(tri: SpecialTriangle, from: SpecialRole, to: SpecialRole): TrigExact {
  if (from === to) return ONE
  const key = `${tri}:${from}>${to}`
  const f: Record<string, TrigExact> = {
    '45:leg>hyp': ROOT2,
    '45:hyp>leg': ROOT2_HALF,
    '30:short>long': ROOT3,
    '30:short>hyp': TWO,
    '30:long>short': ROOT3_THIRD,
    '30:long>hyp': TWO_ROOT3_THIRDS,
    '30:hyp>short': HALF,
    '30:hyp>long': ROOT3_HALF,
  }
  const v = f[key]
  if (!v) throw new Error(`no side ${to} from ${from} in a ${tri} triangle`)
  return v
}

/** The side `to` from the side `from` of length `value`. */
export function specialSide(tri: SpecialTriangle, from: SpecialRole, value: TrigExact, to: SpecialRole): TrigExact {
  return exactMul(value, specialFactor(tri, from, to))
}

type Row = [TrigExact, TrigMistakeId, string]

/** The slip factors for each (triangle, given side, asked side), in detection order, with the sentence. */
function slipRows(tri: SpecialTriangle, from: SpecialRole, to: SpecialRole): Row[] {
  const key = `${tri}:${from}>${to}`
  const rows: Record<string, Row[]> = {
    '45:leg>hyp': [
      [TWO, 'trig_special_45_two', 'Your answer doubles the leg. In a 45°-45°-90° triangle the hypotenuse is a leg times √2, not times two.'],
      [ROOT2_HALF, 'trig_special_wrong_way', 'Your answer divides the leg by √2, which makes the hypotenuse shorter than a leg. Going up to the hypotenuse, multiply by √2.'],
    ],
    '45:hyp>leg': [
      [HALF, 'trig_special_45_two', 'Your answer halves the hypotenuse. In a 45°-45°-90° triangle a leg is the hypotenuse divided by √2, not by two.'],
      [ROOT2, 'trig_special_wrong_way', 'Your answer multiplies the hypotenuse by √2, which makes a leg longer than the hypotenuse. Going down to a leg, divide by √2.'],
    ],
    '30:short>long': [
      [TWO, 'trig_special_root3_two_swapped', 'Your answer doubles the short leg, and twice the short leg is the hypotenuse. The long leg, across from 60°, is the short leg times √3.'],
      [ROOT3_THIRD, 'trig_special_wrong_way', 'Your answer divides the short leg by √3, which makes the long leg shorter than the short one. Going up to the long leg, multiply by √3.'],
    ],
    '30:short>hyp': [
      [ROOT3, 'trig_special_root3_two_swapped', 'Your answer multiplies the short leg by √3, and that gives the long leg. The hypotenuse is twice the short leg.'],
      [HALF, 'trig_special_wrong_way', 'Your answer halves the short leg, but the hypotenuse is the longest side: it is twice the short leg.'],
    ],
    '30:long>short': [
      [HALF, 'trig_special_root3_two_swapped', 'Your answer halves the long leg, as if the long leg were twice the short one. Twice the short leg is the hypotenuse; the long leg is the short leg times √3, so divide by √3.'],
      [ROOT3, 'trig_special_wrong_way', 'Your answer multiplies the long leg by √3, which makes the short leg longer than the long one. Going down to the short leg, divide by √3.'],
    ],
    '30:long>hyp': [
      [ROOT3_HALF, 'trig_special_root3_two_swapped', 'Your answer treats the long leg as twice the short leg and the hypotenuse as the short leg times √3: the two factors are swapped. Find the short leg first, then double it.'],
      [TWO, 'trig_special_legs_swapped', 'Your answer doubles the long leg. The hypotenuse is twice the short leg, the one across from 30°.'],
      [TWO_ROOT3, 'trig_special_wrong_way', 'Your answer multiplies the long leg by √3 on the way to the short leg. Going down to the short leg, divide by √3; then double it for the hypotenuse.'],
    ],
    '30:hyp>short': [
      [ROOT3_THIRD, 'trig_special_root3_two_swapped', 'Your answer divides the hypotenuse by √3, as if the hypotenuse were the short leg times √3. The hypotenuse is twice the short leg.'],
      [ROOT3_HALF, 'trig_special_legs_swapped', 'That is the long leg, the one across from 60°. The short leg is across from 30°: half the hypotenuse.'],
      [TWO, 'trig_special_wrong_way', 'Your answer doubles the hypotenuse, which makes a leg longer than the hypotenuse. Going down to the short leg, halve the hypotenuse.'],
    ],
    '30:hyp>long': [
      [TWO_ROOT3_THIRDS, 'trig_special_root3_two_swapped', 'Your answer divides the hypotenuse by √3 and doubles it: the √3 and the two are swapped. The short leg is half the hypotenuse, and the long leg is the short leg times √3.'],
      [HALF, 'trig_special_legs_swapped', 'That is the short leg, the one across from 30°. The long leg, across from 60°, is the short leg times √3.'],
    ],
  }
  return rows[key] ?? []
}

/** The slips for the side `to` from the side `from` of length `value`; equal ones and the answer left out. */
export function specialSlips(tri: SpecialTriangle, from: SpecialRole, value: TrigExact, to: SpecialRole): TrigSlip[] {
  const answer = specialSide(tri, from, value, to)
  const out: TrigSlip[] = []
  for (const [factor, id, witness] of slipRows(tri, from, to)) {
    const v = exactMul(value, factor)
    if (valueEq(v, answer) || out.some((o) => valueEq(o.value, v))) continue
    out.push({ id, value: v, witness })
  }
  return out
}
