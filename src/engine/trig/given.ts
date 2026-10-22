/**
 * One trig value and where θ is (uc.given): "sin θ = 5/13 and cos θ < 0". The textbook's way: the value is a ratio of
 * two of x, y and r (sin θ = y/r, tan θ = y/x, sec θ = r/x, …), the quadrant gives the signs of x and y, the
 * Pythagorean theorem gives the third, and then any other function is a ratio of the point. Everything is exact; the
 * missing coordinate may be a radical (sin θ = 2/3 in Quadrant II puts the point at (−√5, 2), r = 3).
 */
import { placeWords, quadrantName, type Quadrant } from './angle'
import { exactDiv, exactInt, exactNeg, exactNum, exactQ, exactSay, exactSqrt, isZero, type TrigExact } from './exact'
import { q, qAbs, qAdd, qSub, type Q } from './rational'
import type { TrigSlip } from './slips'
import { squareOf } from './triangle'
import { ratioOf, valueEq, type TrigFn, type TrigValue } from './values'

/** The signs of x and y in each quadrant. */
export function quadrantSigns(qd: Quadrant): { x: 1 | -1; y: 1 | -1 } {
  return { x: qd === 1 || qd === 4 ? 1 : -1, y: qd === 1 || qd === 2 ? 1 : -1 }
}

/** The sign of each function in each quadrant: All Students Take Calculus. */
export function signIn(fn: TrigFn, qd: Quadrant): 1 | -1 {
  const s = quadrantSigns(qd)
  switch (fn) {
    case 'sin':
    case 'csc':
      return s.y
    case 'cos':
    case 'sec':
      return s.x
    case 'tan':
    case 'cot':
      return (s.x * s.y) as 1 | -1
  }
}

/** The two quadrants where `fn` has the sign `sign`. */
export function quadrantsWithSign(fn: TrigFn, sign: 1 | -1): Quadrant[] {
  return ([1, 2, 3, 4] as Quadrant[]).filter((qd) => signIn(fn, qd) === sign)
}

/** The point on the terminal side the textbook draws: two of x, y, r read from the value, the third found. */
export interface GivenPoint {
  x: TrigExact
  y: TrigExact
  r: TrigExact
  /** The one found with the Pythagorean theorem. */
  missing: 'x' | 'y' | 'r'
}

function rootQ(v: Q): TrigExact {
  const r = exactSqrt(exactQ(v))
  if (!r || v.n <= 0) throw new Error('no such point')
  return r
}

/**
 * The point for fn(θ) = value with θ in quadrant `qd`. `value` is a fraction n/d in lowest terms (whole numbers): for
 * sin, cos, csc and sec the bigger of the two is r; for tan and cot they are |y| and |x|.
 */
export function givenPoint(fn: TrigFn, value: Q, qd: Quadrant): GivenPoint {
  if (value.n === 0) throw new Error('a value of zero is on an axis')
  if (Math.sign(value.n) !== signIn(fn, qd)) throw new Error(`${fn} has the other sign in ${quadrantName(qd)}`)
  const a = qAbs(value)
  const n = a.n
  const d = a.d
  const s = quadrantSigns(qd)
  const X = (v: number) => exactInt(s.x * v)
  const Y = (v: number) => exactInt(s.y * v)
  switch (fn) {
    case 'sin': {
      if (n >= d) throw new Error('a sine is less than one')
      return { y: Y(n), r: exactInt(d), x: signed(s.x, rootQ(q(d * d - n * n))), missing: 'x' }
    }
    case 'cos': {
      if (n >= d) throw new Error('a cosine is less than one')
      return { x: X(n), r: exactInt(d), y: signed(s.y, rootQ(q(d * d - n * n))), missing: 'y' }
    }
    case 'csc': {
      if (n <= d) throw new Error('a cosecant is more than one')
      return { r: exactInt(n), y: Y(d), x: signed(s.x, rootQ(q(n * n - d * d))), missing: 'x' }
    }
    case 'sec': {
      if (n <= d) throw new Error('a secant is more than one')
      return { r: exactInt(n), x: X(d), y: signed(s.y, rootQ(q(n * n - d * d))), missing: 'y' }
    }
    case 'tan':
      return { y: Y(n), x: X(d), r: rootQ(q(n * n + d * d)), missing: 'r' }
    case 'cot':
      return { x: X(n), y: Y(d), r: rootQ(q(n * n + d * d)), missing: 'r' }
  }
}

function signed(sign: 1 | -1, v: TrigExact): TrigExact {
  return sign < 0 ? exactNeg(v) : v
}

/** One of the six functions at the point. */
export function givenValue(fn: TrigFn, p: GivenPoint): TrigValue {
  return ratioOf(fn, p.x, p.y, p.r)
}

function distinct(answer: TrigValue, slips: readonly (TrigSlip | null)[]): TrigSlip[] {
  const out: TrigSlip[] = []
  for (const s of slips) {
    if (!s || valueEq(s.value, answer)) continue
    if (out.some((o) => valueEq(o.value, s.value))) continue
    out.push(s)
  }
  return out
}

const sq = (a: TrigExact) => {
  const t = exactSay(a)
  return /^\d+$/.test(t) ? `${t}²` : `(${t})²`
}

/**
 * Slips for the missing coordinate: the quadrant's sign ignored, the squares added (r is the hypotenuse), the square
 * left unrooted.
 */
export function givenCoordinateSlips(p: GivenPoint, qd: Quadrant): TrigSlip[] {
  if (p.missing === 'r') return []
  const c = p.missing
  const other: 'x' | 'y' = c === 'x' ? 'y' : 'x'
  const answer = p[c]
  const sign = exactNum(answer) < 0 ? -1 : 1
  const known = p[other]
  const signWord = sign < 0 ? 'negative' : 'positive'
  return distinct(answer, [
    {
      id: 'trig_coordinate_sign',
      value: exactNeg(answer),
      witness: `Your ${c} has the right size but the wrong sign. θ is in ${quadrantName(qd)}, where ${c} is ${signWord}: the theorem gives the size, the quadrant gives the sign.`,
    },
    {
      id: 'trig_pythag_added',
      value: signed(sign, rootQ(qAdd(squareOf(p.r), squareOf(known)))),
      witness: `Your answer adds the squares of r and ${other}, but r is the distance from the origin, the longest side of the point’s right triangle. Subtract: ${c}² = r² − ${other}².`,
    },
    {
      id: 'trig_side_not_rooted',
      value: signed(sign, exactQ(qSub(squareOf(p.r), squareOf(known)))),
      witness: `Your answer is ${sq(p.r)} − ${sq(absOf(known))}, which is ${c}², the square of the coordinate. ${c} itself is its square root, with the quadrant’s sign.`,
    },
  ])
}

function absOf(a: TrigExact): TrigExact {
  return exactNum(a) < 0 ? exactNeg(a) : a
}

/** Slips for r: the square left unrooted, a sign given to a distance. */
export function givenRSlips(p: GivenPoint): TrigSlip[] {
  const sum = qAdd(squareOf(p.x), squareOf(p.y))
  return distinct(p.r, [
    {
      id: 'trig_r_not_rooted',
      value: exactQ(sum),
      witness: `That is x² + y², which is r², the square of the distance. r is the square root of x² + y².`,
    },
    {
      id: 'trig_r_negative',
      value: exactNeg(p.r),
      witness: 'r is the distance from the origin to the point, so it is never negative, whatever the quadrant: the signs belong to x and y.',
    },
  ])
}

const POSITIVE_WORD = (v: TrigExact) => (exactNum(v) > 0 ? 'positive' : 'negative')

/**
 * Slips for another function at the point (the first half's slips for a point, with exact coordinates): the
 * quadrant's sign, r left out, sin and cos swapped, tan upside down, a reciprocal missing or mixed up.
 */
export function givenValueSlips(fn: TrigFn, p: GivenPoint, qd: Quadrant): TrigSlip[] {
  const v = givenValue(fn, p)
  const ratio = (f: TrigFn) => ratioOf(f, p.x, p.y, p.r)
  const one = exactInt(1)
  const slips: (TrigSlip | null)[] = []
  if (v !== 'undefined' && !isZero(v)) {
    slips.push({
      id: 'trig_sign_quadrant',
      value: exactNeg(v),
      witness: `Your answer has the right size but the wrong sign. Keep the signs of x and y: θ is in ${placeWords({ kind: 'quadrant', quadrant: qd })}, where ${fn} θ is ${POSITIVE_WORD(v)}.`,
    })
  }
  const leftOut = 'Your answer leaves out r. This point is not on the unit circle, so divide by its distance from the origin, r.'
  switch (fn) {
    case 'sin':
      slips.push({ id: 'trig_r_left_out', value: p.y, witness: `${leftOut} sin θ = y/r.` })
      slips.push({ id: 'trig_sin_cos_swapped', value: ratio('cos'), witness: 'That is x/r, which is cos θ. sin θ uses the y-coordinate: y/r.' })
      break
    case 'cos':
      slips.push({ id: 'trig_r_left_out', value: p.x, witness: `${leftOut} cos θ = x/r.` })
      slips.push({ id: 'trig_sin_cos_swapped', value: ratio('sin'), witness: 'That is y/r, which is sin θ. cos θ uses the x-coordinate: x/r.' })
      break
    case 'tan':
      slips.push({ id: 'trig_tan_inverted', value: ratio('cot'), witness: 'That is x/y, which is cot θ. tan θ is y/x: the y-coordinate over the x-coordinate.' })
      break
    case 'cot':
      slips.push({ id: 'trig_tan_inverted', value: ratio('tan'), witness: 'That is y/x, which is tan θ. cot θ is x/y: the x-coordinate over the y-coordinate.' })
      break
    case 'csc':
      slips.push({ id: 'trig_reciprocal_missing', value: ratio('sin'), witness: 'That is y/r, which is sin θ. csc θ is its reciprocal, r/y.' })
      slips.push({ id: 'trig_reciprocal_mixed', value: ratio('sec'), witness: 'That is r/x, which is sec θ. csc θ goes with sin θ: r over y.' })
      slips.push({ id: 'trig_r_left_out', value: exactDiv(one, p.y), witness: `${leftOut} csc θ = r/y.` })
      break
    case 'sec':
      slips.push({ id: 'trig_reciprocal_missing', value: ratio('cos'), witness: 'That is x/r, which is cos θ. sec θ is its reciprocal, r/x.' })
      slips.push({ id: 'trig_reciprocal_mixed', value: ratio('csc'), witness: 'That is r/y, which is csc θ. sec θ goes with cos θ: r over x.' })
      slips.push({ id: 'trig_r_left_out', value: exactDiv(one, p.x), witness: `${leftOut} sec θ = r/x.` })
      break
  }
  return distinct(v, slips)
}
