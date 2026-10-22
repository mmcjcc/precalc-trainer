/**
 * Honors geometry Unit 6, module geoRatios (Jurgensen 7-1 to 7-3): ratio, proportion and similar polygons.
 *
 * gr.proportion solves a proportion (x in any of the four places, a binomial on one side or both, the geometric mean
 * a/x = x/b), finds a ratio from an equation (if 5a = 7b, the ratio of a to b), or picks the equation that must follow
 * from a/b = c/d. gr.polygons gives two similar polygons, triangles or quadrilaterals, the second drawn turned and
 * sometimes flipped so that where a side sits never says which side it corresponds to: the scale factor, then x from
 * a side or an angle, then a side, the perimeter, or an angle.
 *
 * Everything comes from the seed: the case, the letters, the numbers, the scale factor, which side carries x, the turn.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoAngleMark, GeoSegment } from '@/shared/types'
import { formatQty, simplifyRadical } from './answer'
import type { GeoBuilt } from './build'
import {
  MINUS,
  R,
  crossText,
  evalAt,
  isWhole,
  konst,
  lin6,
  linShow,
  lprod,
  lprodUndistributed,
  lsolve,
  positive,
  productShow,
  qText,
  ratAdd,
  ratDiv,
  ratMul,
  ratSub,
  solveSteps,
  type LinQ,
  type Rational,
} from './unit6Alg'
import {
  DEG_HINT6,
  LEN_HINT6,
  MEAN_HINT6,
  RATIO_HINT6,
  RESERVED6_NUMBERS,
  RESERVED6_TEXT,
  X_HINT6,
  X_POOL6,
  choiceStage6,
  finish6,
  numberStage6,
  placeLabels6,
  type Stage6,
  type TrapDraft6,
} from './unit6Build'
import {
  besideRight,
  bounds,
  convex,
  gcd,
  matchByPosition,
  points6,
  quadFromSides,
  readable,
  runLetters6,
  scaled,
  triAngles,
  triFromAngles,
  triFromSides,
  turned,
  type XY,
} from './unit6Geom'
import { RATIO_RULES, UNIT6_RULE_IDS } from './unit6Rules'

const PROPORTION_INSTRUCTIONS = 'Solve it, and check that your answer makes the two ratios equal.'
const POLYGON_INSTRUCTIONS = 'Find each part in order. The figure is there before you answer.'

export function weighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = rng.next() * total
  for (const [item, w] of items) {
    r -= w
    if (r < 0) return item
  }
  return items[items.length - 1]![0]
}

const reservedQ = (q: Rational) => RESERVED6_NUMBERS.has(q.n / q.d) || RESERVED6_TEXT.has(qText(q))

// =================================================================================================================
// gr.proportion
// =================================================================================================================

type PropKind = 'simple' | 'binomial' | 'mean' | 'property' | 'product'

export function drawProportion(seed: number): GeoBuilt {
  const kind = weighted<PropKind>(makeRng(mixSeed(seed, 6100)), [
    ['simple', 25],
    ['binomial', 25],
    ['mean', 20],
    ['property', 15],
    ['product', 15],
  ])
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = makeRng(mixSeed(seed, 6101 + attempt))
    const built =
      kind === 'simple'
        ? propSimple(rng)
        : kind === 'binomial'
          ? propBinomial(rng)
          : kind === 'mean'
            ? propMean(rng)
            : kind === 'property'
              ? propProperty(rng, seed)
              : propProduct(rng)
    if (built) return built
  }
  throw new Error(`gr.proportion/${seed}: no ${kind} problem`)
}

function propFinish(prompt: string, stages: Stage6[], params: Record<string, string | number | boolean>, promise: ErrorPatternId[], title: string): GeoBuilt | null {
  return finish6({
    question: 'proportion',
    prompt,
    figure: { points: [], ariaLabel: '' },
    stages,
    lengths: [],
    angles: [],
    title,
    instructions: PROPORTION_INSTRUCTIONS,
    params,
    cards: RATIO_RULES,
    promise,
  })
}

/** "x/12", "(x + 3)/8": a binomial in a fraction gets parentheses. */
function fracShow(top: LinQ, bottom: LinQ): string {
  const wrap = (e: LinQ) => (e.a.n !== 0 && e.b.n !== 0 ? `(${linShow(e)})` : linShow(e))
  return `${wrap(top)}/${wrap(bottom)}`
}

/** n1/d1 = n2/d2, each a linear expression in x. */
export interface Proportion {
  n1: LinQ
  d1: LinQ
  n2: LinQ
  d2: LinQ
}

export const propShow = (p: Proportion) => `${fracShow(p.n1, p.d1)} = ${fracShow(p.n2, p.d2)}`

/** Solve "left product = right product" when both products stay linear. */
function solveProducts(l1: LinQ, l2: LinQ, r1: LinQ, r2: LinQ): Rational | null {
  const left = lprod(l1, l2)
  const right = lprod(r1, r2)
  if (!left || !right) return null
  return lsolve(left, right)
}

/** The right answer and the slips of a proportion, each solved exactly (null where a slip has no single x). */
export function proportionSlips(p: Proportion): { right: Rational | null; cross: Rational | null; flip: Rational | null; spread: Rational | null } {
  const right = solveProducts(p.n1, p.d2, p.n2, p.d1)
  // Each fraction's own numerator times its own denominator.
  const cross = solveProducts(p.n1, p.d1, p.n2, p.d2)
  // One ratio turned over: the two numerators together, the two denominators together.
  const flip = solveProducts(p.n1, p.n2, p.d1, p.d2)
  // The cross products with a binomial multiplied out on its x term only.
  const lu = lprodUndistributed(p.n1, p.d2)
  const ru = lprodUndistributed(p.n2, p.d1)
  const left = lu ?? lprod(p.n1, p.d2)
  const rightSide = ru ?? lprod(p.n2, p.d1)
  const spread = (lu || ru) && left && rightSide ? lsolve(left, rightSide) : null
  return { right, cross, flip, spread }
}

const CROSS_W = (p: Proportion) =>
  `That x makes ${productShow(p.n1, p.d1)} equal ${productShow(p.n2, p.d2)}: each fraction’s own numerator times its own denominator. Cross-multiplying pairs each numerator with the denominator on the other side of the equals sign.`
const FLIP_W = (p: Proportion) =>
  `That x makes ${productShow(p.n1, p.n2)} equal ${productShow(p.d1, p.d2)}, which is the proportion with one of its ratios turned upside down. Cross-multiply instead: each numerator times the other denominator.`
const SPREAD_W = (c: string, bin: string) => `That x multiplies only the x by ${c}. The ${c} in front of (${bin}) multiplies both terms inside the parentheses.`

function crossReveal(p: Proportion): string {
  return crossText(`${productShow(p.n1, p.d2)} = ${productShow(p.n2, p.d1)}`, lprod(p.n1, p.d2)!, lprod(p.n2, p.d1)!)
}

const PAIRS: readonly [number, number][] = [
  [2, 3], [3, 2], [3, 4], [4, 3], [2, 5], [5, 2], [3, 5], [5, 3], [4, 5], [5, 4], [5, 6], [6, 5], [3, 7], [7, 3], [4, 7], [7, 4],
  [5, 7], [7, 5], [5, 8], [8, 5], [3, 8], [8, 3], [7, 8], [8, 7], [2, 7], [7, 2], [4, 9], [9, 4], [5, 9], [9, 5], [1, 2], [2, 1],
  [1, 3], [3, 1], [1, 4], [4, 1],
]

const same = (p: Rational, q: Rational) => p.n === q.n && p.d === q.d

/** x/a = b/c with x in any of the four places. */
function propSimple(rng: Rng): GeoBuilt | null {
  const slot = rng.int(0, 3)
  let vals: Rational[]
  if (rng.chance(0.8)) {
    const [p, q] = rng.pick(PAIRS)
    const n = rng.int(1, 8)
    const m = rng.int(1, 8)
    if (n === m) return null
    vals = [R(p * n), R(q * n), R(p * m), R(q * m)]
  } else {
    // Three whole numbers, and the fourth whatever makes the ratios equal: a fraction this time.
    const v: (Rational | null)[] = [null, null, null, null]
    for (let i = 0; i < 4; i++) if (i !== slot) v[i] = R(rng.int(2, 15))
    const [a, b, c, d] = v
    // a/b = c/d: a = bc/d, b = ad/c, c = ad/b, d = bc/a.
    const missing = slot === 0 ? ratDiv(ratMul(b!, c!), d!) : slot === 1 ? ratDiv(ratMul(a!, d!), c!) : slot === 2 ? ratDiv(ratMul(a!, d!), b!) : ratDiv(ratMul(b!, c!), a!)
    if (isWhole(missing) || missing.d > 5) return null
    v[slot] = missing
    vals = v as Rational[]
  }
  if (vals.some((v) => v.n / v.d > 72)) return null
  // A ratio of 1, or the same fraction on both sides, is no proportion to solve.
  if (same(vals[0]!, vals[1]!) || same(vals[2]!, vals[3]!)) return null
  if (same(vals[0]!, vals[2]!) && same(vals[1]!, vals[3]!)) return null
  const answer = vals[slot]!
  if (!positive(answer) || reservedQ(answer)) return null
  const expr = vals.map((v, i) => (i === slot ? lin6(1, 0) : konst(v)))
  const prop: Proportion = { n1: expr[0]!, d1: expr[1]!, n2: expr[2]!, d2: expr[3]! }
  const s = proportionSlips(prop)
  if (!s.right || !same(s.right, answer)) return null
  const traps: TrapDraft6[] = []
  if (positive(s.cross)) traps.push({ id: 'geo_cross_multiplied_wrong', stage: 'x', text: qText(s.cross), witness: CROSS_W(prop) })
  if (positive(s.flip)) traps.push({ id: 'geo_one_ratio_inverted', stage: 'x', text: qText(s.flip), witness: FLIP_W(prop) })
  const prompt = rng.chance(0.5) ? `Solve the proportion ${propShow(prop)} for x.` : `Solve for x: ${propShow(prop)}.`
  const stages = [
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: qText(answer),
      nudge: 'Cross-multiply: each numerator times the denominator on the other side of the equals sign. Then solve for x.',
      ruleCard: UNIT6_RULE_IDS.proportion,
      reveal: [crossReveal(prop)],
      traps,
    }),
  ]
  return propFinish(prompt, stages, { case: 'simple', slot, x: qText(answer) }, ['geo_cross_multiplied_wrong', 'geo_one_ratio_inverted'], 'Solving a proportion')
}

/** (x + p)/q = r/s in several arrangements, or a binomial on both sides. */
function propBinomial(rng: Rng): GeoBuilt | null {
  const form = rng.pick(['top', 'bottom', 'right', 'both'] as const)
  const x = rng.pick(X_POOL6)
  let prop: Proportion
  // The number that multiplies the first binomial when she cross-multiplies.
  let factor: LinQ
  let firstBin: LinQ
  if (form === 'both') {
    const q = rng.int(2, 12)
    const s = rng.int(2, 12)
    if (q === s) return null
    const g = gcd(q, s)
    const n = rng.int(1, 6)
    const p = (q / g) * n - x
    const u = (s / g) * n - x
    if (p === 0 || u === 0 || Math.abs(p) > 15 || Math.abs(u) > 15) return null
    prop = { n1: lin6(1, p), d1: konst(q), n2: lin6(1, u), d2: konst(s) }
    factor = prop.d2
    firstBin = prop.n1
  } else {
    const [r0, s0] = rng.pick(PAIRS.filter(([a, b]) => a > 1 && b > 1))
    const ns = [1, 2, 3, 4, 5, 6].filter((n) => {
      const p = r0 * n - x
      return p !== 0 && Math.abs(p) <= 12
    })
    if (ns.length === 0) return null
    const n = rng.pick(ns)
    const m = rng.int(1, 4)
    if (m === n) return null
    const bin = lin6(1, r0 * n - x)
    const q = konst(s0 * n)
    const r = konst(r0 * m)
    const s = konst(s0 * m)
    if (form === 'top') {
      prop = { n1: bin, d1: q, n2: r, d2: s }
      factor = s
    } else if (form === 'bottom') {
      prop = { n1: q, d1: bin, n2: s, d2: r }
      factor = s
    } else {
      prop = { n1: r, d1: s, n2: bin, d2: q }
      factor = s
    }
    firstBin = bin
  }
  const shown = [prop.n1, prop.d1, prop.n2, prop.d2]
  if (shown.some((e) => e.a.n === 0 && (e.b.n <= 0 || e.b.n / e.b.d > 72))) return null
  if (shown.some((e) => evalAt(e, R(x)).n <= 0)) return null
  const sl = proportionSlips(prop)
  if (!sl.right || !same(sl.right, R(x))) return null
  const traps: TrapDraft6[] = []
  if (sl.spread) traps.push({ id: 'geo_proportion_distribute', stage: 'x', text: qText(sl.spread), witness: SPREAD_W(linShow(factor), linShow(firstBin)) })
  if (sl.cross) traps.push({ id: 'geo_cross_multiplied_wrong', stage: 'x', text: qText(sl.cross), witness: CROSS_W(prop) })
  if (sl.flip) traps.push({ id: 'geo_one_ratio_inverted', stage: 'x', text: qText(sl.flip), witness: FLIP_W(prop) })
  const prompt = rng.chance(0.5) ? `Solve the proportion ${propShow(prop)} for x.` : `Solve for x: ${propShow(prop)}.`
  const stages = [
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(x),
      nudge: 'Cross-multiply, and multiply the whole binomial by the number in front of it. Then solve for x.',
      ruleCard: UNIT6_RULE_IDS.proportion,
      reveal: [crossReveal(prop)],
      traps,
    }),
  ]
  return propFinish(prompt, stages, { case: 'binomial', form, x }, ['geo_proportion_distribute', 'geo_cross_multiplied_wrong', 'geo_one_ratio_inverted'], 'Solving a proportion')
}

/** The geometric mean of a and b: a/x = x/b. */
function propMean(rng: Rng): GeoBuilt | null {
  let a: number
  let b: number
  if (rng.chance(0.55)) {
    const g = rng.int(4, 30)
    const divisors: number[] = []
    for (let d = 2; d < g; d++) if ((g * g) % d === 0) divisors.push(d)
    if (divisors.length === 0) return null
    a = rng.pick(divisors)
    b = (g * g) / a
    if (b > 300) return null
  } else {
    a = rng.int(2, 24)
    b = rng.int(a + 1, 36)
    const root = Math.round(Math.sqrt(a * b))
    if (root * root === a * b) return null
  }
  const q = simplifyRadical(1, 1, a * b)
  const answerText = formatQty(q)
  if (q.rad === 1 && reservedQ(R(q.n))) return null
  if (RESERVED6_TEXT.has(answerText)) return null
  // A radical answer keeps a small number under the root, as a textbook asks it.
  if (q.rad > 30) return null
  const words = rng.chance(0.5)
  const [first, second] = rng.chance(0.5) ? [a, b] : [b, a]
  const prompt = words ? `Find the geometric mean of ${first} and ${second}.` : `Solve ${first}/x = x/${second} for the positive value of x.`
  const traps: TrapDraft6[] = [
    {
      id: 'geo_geometric_as_arithmetic',
      stage: 'x',
      text: qText(ratDiv(R(a + b), R(2))),
      witness: `That is the average of ${first} and ${second}, the arithmetic mean. The geometric mean is the positive number whose square is ${first} · ${second}.`,
    },
    {
      id: 'geo_mean_not_rooted',
      stage: 'x',
      text: String(a * b),
      witness: `That is ${first} · ${second}, which is x², the square of the mean. The mean itself is the positive square root of that product.`,
    },
  ]
  const root = q.rad === 1 ? `${q.n}` : answerText === `√${a * b}` ? answerText : `√${a * b} = ${answerText}`
  const stages = [
    numberStage6({
      id: 'x',
      label: words ? 'Geometric mean' : 'x',
      hint: MEAN_HINT6,
      answerText,
      nudge: words
        ? 'The geometric mean x makes the first number over x equal x over the second. Cross-multiply, then take the positive square root.'
        : 'Cross-multiply: x times x is x². Then take the positive square root.',
      ruleCard: UNIT6_RULE_IDS.mean,
      reveal: [`Cross-multiply: x² = ${first} · ${second} = ${a * b}, so x = ${root}.`],
      traps,
    }),
  ]
  return propFinish(prompt, stages, { case: 'mean', x: answerText, words }, ['geo_geometric_as_arithmetic', 'geo_mean_not_rooted'], 'Geometric mean')
}

/** Letters for the proportion properties: no i, j, k, l, m, n, o, or x. */
const PROPERTY_LETTERS = 'abcdefghpqrstuvwyz'

type Four = [Rational, Rational, Rational, Rational]

export interface PropertyForm {
  key: string
  text: (L: readonly [string, string, string, string]) => string
  /** Both sides at these values, or null where a side is undefined. */
  sides: (v: Four) => [Rational, Rational] | null
}

const safeDiv = (a: Rational, b: Rational): Rational | null => (b.n === 0 ? null : ratDiv(a, b))
const pairOf = (l: Rational | null, r: Rational | null): [Rational, Rational] | null => (l && r ? [l, r] : null)

export const RIGHT_FORMS: readonly PropertyForm[] = [
  { key: 'alternation', text: ([a, b, c, d]) => `${a}/${c} = ${b}/${d}`, sides: ([a, b, c, d]) => pairOf(safeDiv(a, c), safeDiv(b, d)) },
  { key: 'inversion', text: ([a, b, c, d]) => `${b}/${a} = ${d}/${c}`, sides: ([a, b, c, d]) => pairOf(safeDiv(b, a), safeDiv(d, c)) },
  { key: 'addition', text: ([a, b, c, d]) => `(${a} + ${b})/${b} = (${c} + ${d})/${d}`, sides: ([a, b, c, d]) => pairOf(safeDiv(ratAdd(a, b), b), safeDiv(ratAdd(c, d), d)) },
  { key: 'subtraction', text: ([a, b, c, d]) => `(${a} ${MINUS} ${b})/${b} = (${c} ${MINUS} ${d})/${d}`, sides: ([a, b, c, d]) => pairOf(safeDiv(ratSub(a, b), b), safeDiv(ratSub(c, d), d)) },
  { key: 'means', text: ([a, b, c, d]) => `${a}${d} = ${b}${c}`, sides: ([a, b, c, d]) => [ratMul(a, d), ratMul(b, c)] },
  { key: 'sum', text: ([a, b, c, d]) => `(${a} + ${c})/(${b} + ${d}) = ${a}/${b}`, sides: ([a, b, c, d]) => pairOf(safeDiv(ratAdd(a, c), ratAdd(b, d)), safeDiv(a, b)) },
]

export const CROSS_FORMS: readonly PropertyForm[] = [
  { key: 'ownProducts', text: ([a, b, c, d]) => `${a}${b} = ${c}${d}`, sides: ([a, b, c, d]) => [ratMul(a, b), ratMul(c, d)] },
  { key: 'crossedRatio', text: ([a, b, c, d]) => `${a}/${d} = ${c}/${b}`, sides: ([a, b, c, d]) => pairOf(safeDiv(a, d), safeDiv(c, b)) },
]

export const FLIP_FORMS: readonly PropertyForm[] = [
  { key: 'leftTurned', text: ([a, b, c, d]) => `${b}/${a} = ${c}/${d}`, sides: ([a, b, c, d]) => pairOf(safeDiv(b, a), safeDiv(c, d)) },
  { key: 'rightTurned', text: ([a, b, c, d]) => `${a}/${b} = ${d}/${c}`, sides: ([a, b, c, d]) => pairOf(safeDiv(a, b), safeDiv(d, c)) },
]

export const PLAIN_FORMS: readonly PropertyForm[] = [
  { key: 'mixedAddition', text: ([a, b, c, d]) => `(${a} + ${b})/${a} = (${c} + ${d})/${d}`, sides: ([a, b, c, d]) => pairOf(safeDiv(ratAdd(a, b), a), safeDiv(ratAdd(c, d), d)) },
  { key: 'plusOne', text: ([a, b, c, d]) => `(${a} + 1)/${b} = (${c} + 1)/${d}`, sides: ([a, b, c, d]) => pairOf(safeDiv(ratAdd(a, R(1)), b), safeDiv(ratAdd(c, R(1)), d)) },
  { key: 'sums', text: ([a, b, c, d]) => `${a} + ${d} = ${b} + ${c}`, sides: ([a, b, c, d]) => [ratAdd(a, d), ratAdd(b, c)] },
]

/** Values with a/b = c/d: c = k·d and a = k·b for several k, b and d, some negative or fractional. */
const PROPORTION_SAMPLES: readonly Four[] = (() => {
  const out: Four[] = []
  const ks = [R(2, 3), R(5, 2), R(-3, 4), R(7), R(1, 5)]
  const bs = [R(3), R(-2), R(5, 3), R(11)]
  const ds = [R(4), R(7, 2), R(-5), R(13)]
  for (const k of ks) for (const b of bs) for (const d of ds) out.push([ratMul(k, b), b, ratMul(k, d), d])
  return out
})()

/** True when the form holds for every proportion a/b = c/d in the samples (where both of its sides exist). */
export function formHolds(form: PropertyForm): boolean {
  let tested = 0
  for (const v of PROPORTION_SAMPLES) {
    const sides = form.sides(v)
    if (!sides) continue
    tested++
    const [l, r] = sides
    if (l.n * r.d !== r.n * l.d) return false
  }
  return tested >= 20
}

function propProperty(rng: Rng, seed: number): GeoBuilt | null {
  const pool = PROPERTY_LETTERS.split('')
  const L: [string, string, string, string] = ['', '', '', '']
  for (let i = 0; i < 4; i++) L[i] = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
  const right = rng.pick(RIGHT_FORMS)
  const cross = rng.pick(CROSS_FORMS)
  const flip = rng.pick(FLIP_FORMS)
  const plain = rng.pick(PLAIN_FORMS)
  if (!formHolds(right)) throw new Error(`property form ${right.key} does not hold`)
  for (const wrong of [cross, flip, plain]) if (formHolds(wrong)) throw new Error(`property form ${wrong.key} always holds`)
  const given = `${L[0]}/${L[1]} = ${L[2]}/${L[3]}`
  const texts = [right, cross, flip, plain].map((f) => f.text(L))
  if (new Set(texts).size !== 4 || texts.includes(given)) return null
  const stage = choiceStage6({
    id: 'a',
    label: 'Equation',
    choices: [
      { id: 'right', text: right.text(L) },
      {
        id: 'cross',
        text: cross.text(L),
        trap: 'geo_cross_multiplied_wrong',
        witness: 'That equation multiplies each fraction’s own numerator by its own denominator. The cross products of a proportion pair each numerator with the denominator on the other side.',
      },
      {
        id: 'flip',
        text: flip.text(L),
        trap: 'geo_one_ratio_inverted',
        witness: 'That equation turns only one of the two ratios upside down. Turned over together, two equal ratios stay equal; one on its own does not.',
      },
      { id: 'plain', text: plain.text(L) },
    ],
    answerId: 'right',
    nudge: 'Cross-multiply each choice and simplify. The true one says the same thing as the cross products of the given proportion.',
    ruleCard: UNIT6_RULE_IDS.properties,
    reveal: [
      right.key === 'means'
        ? `The equation ${right.text(L)} says the product of the means equals the product of the extremes: those are the cross products of ${given}.`
        : `Cross-multiplying ${right.text(L)} and simplifying gives ${L[0]}${L[3]} = ${L[1]}${L[2]}, the same cross products as ${given}.`,
    ],
    seed,
    salt: 6150,
  })
  const prompt = `If ${given}, which equation must also be true?`
  return propFinish(prompt, [stage], { case: 'property', form: right.key }, ['geo_cross_multiplied_wrong', 'geo_one_ratio_inverted'], 'Properties of proportions')
}

/** If 5a = 7b, the ratio of a to b (or of b to a); or the same from a/5 = b/7. */
function propProduct(rng: Rng): GeoBuilt | null {
  const pool = PROPERTY_LETTERS.split('')
  const A = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
  const B = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
  const p = rng.int(2, 12)
  const q = rng.int(2, 12)
  if (p === q) return null
  const product = rng.chance(0.6)
  const forward = rng.chance(0.6)
  // p·A = q·B gives A/B = q/p; A/p = B/q gives A/B = p/q.
  const aOverB = product ? ratDiv(R(q), R(p)) : ratDiv(R(p), R(q))
  const answer = forward ? aOverB : ratDiv(R(1), aOverB)
  if (reservedQ(answer) || answer.n === answer.d) return null
  const [top, bottom] = forward ? [A, B] : [B, A]
  const statement = product ? `${p}${A} = ${q}${B}` : `${A}/${p} = ${B}/${q}`
  const prompt = `If ${statement}, find the ratio of ${top} to ${bottom}.`
  const rawAB = product ? `${q}/${p}` : `${p}/${q}`
  const rawBA = product ? `${p}/${q}` : `${q}/${p}`
  const raw = forward ? rawAB : rawBA
  const tail = qText(answer) === raw ? '' : `, which is ${qText(answer)}`
  const first = product ? `Divide both sides of ${statement} by ${p}${B}: ${A}/${B} = ${rawAB}` : `Multiply both sides of ${statement} by ${p}, then divide by ${B}: ${A}/${B} = ${rawAB}`
  const reveal = forward ? `${first}${tail}.` : `${first}, so ${B}/${A} = ${rawBA}${tail}.`
  const stages = [
    numberStage6({
      id: 'result',
      label: `${top}/${bottom}`,
      hint: RATIO_HINT6,
      answerText: qText(answer),
      nudge: `Get ${top} and ${bottom} into one ratio on one side: divide both sides by the same expression.`,
      ruleCard: UNIT6_RULE_IDS.properties,
      reveal: [reveal],
      traps: [
        {
          id: 'geo_one_ratio_inverted',
          stage: 'result',
          text: qText(ratDiv(R(1), answer)),
          witness: `That ratio is upside down: it is the ratio of ${bottom} to ${top}. Divide both sides by the same expression and see which number ends up on top.`,
        },
      ],
      ratio: true,
    }),
  ]
  return propFinish(prompt, stages, { case: 'product', form: product ? 'product' : 'quotient', forward }, ['geo_one_ratio_inverted'], 'Ratios from an equation')
}

// =================================================================================================================
// gr.polygons
// =================================================================================================================

type PolyKind = 'sides' | 'perimeter' | 'angle'

/** Scale factors of the first polygon to the second, as [numerator, denominator]. */
const SCALES: readonly [number, number][] = [
  [2, 1], [3, 1], [3, 2], [5, 2], [4, 3], [5, 3], [5, 4], [1, 2], [1, 3], [2, 3], [2, 5], [3, 4], [3, 5], [4, 5],
]

export function drawSimilarPolygons(seed: number): GeoBuilt {
  const kind = weighted<PolyKind>(makeRng(mixSeed(seed, 6200)), [
    ['sides', 40],
    ['perimeter', 30],
    ['angle', 30],
  ])
  for (let attempt = 0; attempt < 800; attempt++) {
    const rng = makeRng(mixSeed(seed, 6201 + attempt))
    const built = polygonsProblem(rng, kind, seed)
    if (built) return built
  }
  throw new Error(`gr.polygons/${seed}: no ${kind} problem`)
}

interface PolyPair {
  n: 3 | 4
  first: string[]
  second: string[]
  /** As drawn: second's vertex i is the image of first's vertex i. */
  p1: XY[]
  p2: XY[]
  /** Side i joins vertex i and vertex i + 1. */
  len1: number[]
  len2: number[]
  /** Scale factor of the first polygon to the second. */
  k: Rational
  sidePos: { index: number; margin: number }[]
  vertexPos: { index: number; margin: number }[]
}

export function sideName6(ids: readonly string[], i: number): string {
  return `${ids[i]!}${ids[(i + 1) % ids.length]!}`
}

/** Whole-number sides of a readable scalene polygon, and a way to draw it at any size. */
function baseShape(rng: Rng, n: 3 | 4): { sides: number[]; shape: (s: number[]) => XY[] | null } | null {
  if (n === 3) {
    const sides = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3)
    const t = triFromSides(sides[0]!, sides[1]!, sides[2]!)
    if (!t || !readable(t, 30, 0.35)) return null
    return { sides, shape: (s) => triFromSides(s[0]!, s[1]!, s[2]!) }
  }
  const sides = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4)
  const lo = Math.max(Math.abs(sides[0]! - sides[1]!), Math.abs(sides[2]! - sides[3]!))
  const hi = Math.min(sides[0]! + sides[1]!, sides[2]! + sides[3]!)
  if (hi - lo < 1.2) return null
  const diag = lo + (hi - lo) * (0.35 + rng.next() * 0.3)
  const q = quadFromSides(sides as [number, number, number, number], diag)
  if (!q || !readable(q, 40, 0.35)) return null
  const ratio = diag / sides[0]!
  return { sides, shape: (s) => quadFromSides(s as [number, number, number, number], ratio * s[0]!) }
}

/**
 * The first polygon tilted a little, and the second its image by the scale factor, turned (and sometimes flipped) so
 * that no side, and for angle problems no vertex, sits where its partner sits. Side by side, in an order from the seed.
 */
function placePair(rng: Rng, shape1: XY[], k: Rational, needVertices: boolean): Pick<PolyPair, 'p1' | 'p2' | 'sidePos' | 'vertexPos'> | null {
  const factor = k.d / k.n
  for (const base of rng.shuffle([75, 105, 135, 160, 200, 225, 255, 285])) {
    const reflect = rng.chance(0.5)
    const own = turned(shape1, rng.int(-12, 12), false)
    const other = turned(scaled(own, factor), base + rng.int(-8, 8), reflect)
    const w = Math.max(bounds(own).maxX - bounds(own).minX, bounds(other).maxX - bounds(other).minX)
    const gap = 0.32 * w
    const firstLeft = rng.chance(0.5)
    const p1 = firstLeft ? own : besideRight(other, own, gap)
    const p2 = firstLeft ? besideRight(own, other, gap) : other
    const sidePos = matchByPosition(p1, p2, 'side')
    const vertexPos = matchByPosition(p1, p2, 'vertex')
    if (sidePos.some((m, j) => m.index === j)) continue
    if (needVertices && vertexPos.some((m, j) => m.index === j)) continue
    return { p1, p2, sidePos, vertexPos }
  }
  return null
}

function polygonsProblem(rng: Rng, kind: PolyKind, seed: number): GeoBuilt | null {
  const n: 3 | 4 = kind === 'angle' ? 3 : rng.chance(0.5) ? 3 : 4
  const [kn, kd] = rng.pick(SCALES)
  const k = R(kn, kd)
  const first = runLetters6(rng, n)
  if (!first) return null
  const run2 = runLetters6(rng, n, first)
  if (!run2) return null
  // The second polygon's letters go around it in order, starting anywhere, in either direction.
  const offset = rng.int(0, n - 1)
  const dir = rng.chance(0.5) ? 1 : -1
  const second = Array.from({ length: n }, (_, i) => run2[(((offset + dir * i) % n) + n) % n]!)
  let shape1: XY[] | null
  let len1: number[]
  let len2: number[]
  let angles1: number[] = []
  let knownSide: number
  if (kind === 'angle') {
    // Whole-degree angles, each pair at least 8° apart, none near a right angle.
    const a0 = rng.int(32, 100)
    const a1 = rng.int(32, 100)
    const a2 = 180 - a0 - a1
    const all = [a0, a1, a2]
    if (a2 < 30 || all.some((g) => Math.abs(g - 90) < 6 || RESERVED6_NUMBERS.has(g))) return null
    if (Math.abs(a0 - a1) < 8 || Math.abs(a1 - a2) < 8 || Math.abs(a0 - a2) < 8) return null
    knownSide = rng.int(0, 2)
    // The one labeled side is a whole number in both triangles.
    const unit = rng.int(2, 7)
    const known1 = kn * unit
    const known2 = kd * unit
    const raw = triFromAngles(a0, a1, 1)
    const rawSides = [0, 1, 2].map((i) => Math.hypot(raw[(i + 1) % 3]!.x - raw[i]!.x, raw[(i + 1) % 3]!.y - raw[i]!.y))
    const s = known1 / rawSides[knownSide]!
    shape1 = scaled(raw, s)
    len1 = rawSides.map((v) => v * s)
    len2 = len1.map((v) => (v * kd) / kn)
    len1[knownSide] = known1
    len2[knownSide] = known2
    angles1 = all
  } else {
    const base = baseShape(rng, n)
    if (!base) return null
    const unit = rng.int(1, 2)
    len1 = base.sides.map((t) => t * kn * unit)
    len2 = base.sides.map((t) => t * kd * unit)
    if ([...len1, ...len2].some((v) => v > 48 || v < 2)) return null
    shape1 = base.shape(len1)
    knownSide = rng.int(0, n - 1)
  }
  if (!shape1 || !convex(shape1)) return null
  const placed = placePair(rng, shape1, k, kind === 'angle')
  if (!placed) return null
  const pair: PolyPair = { n, first, second, len1, len2, k, ...placed }
  return kind === 'angle' ? angleCase(rng, pair, angles1, knownSide, seed) : sideCase(rng, pair, kind, knownSide, seed)
}

const triOrQuad = (n: number) => (n === 3 ? 'triangle' : 'quadrilateral')
export const polyName = (ids: readonly string[]) => (ids.length === 3 ? `△${ids.join('')}` : ids.join(''))

function segmentsFor(pair: PolyPair, labels1: (string | null)[], labels2: (string | null)[]): GeoSegment[] {
  const out: GeoSegment[] = []
  for (const [ids, labels] of [
    [pair.first, labels1],
    [pair.second, labels2],
  ] as const) {
    for (let i = 0; i < pair.n; i++) {
      const [a, b] = [ids[i]!, ids[(i + 1) % pair.n]!]
      const label = labels[i]
      out.push(label ? { from: a, to: b, label } : { from: a, to: b })
    }
  }
  return out
}

const pairPoints = (pair: PolyPair) => [...points6(pair.first, pair.p1, pair.p1), ...points6(pair.second, pair.p2, pair.p2)]

/** An expression a·x + b worth `value` at x, with a coefficient from the seed. */
function exprFor(rng: Rng, value: number, x: number): LinQ | null {
  const a = rng.int(1, 5)
  const b = value - a * x
  if (b === 0 && a === 1) return null
  if (Math.abs(b) > 45) return null
  return lin6(a, b)
}

/** "2(9) + 3 = 21" for a whole x. */
function atXQ(e: LinQ, x: number): string {
  const a = e.a.n / e.a.d
  const b = e.b.n / e.b.d
  const head = a === 1 ? `${x}` : `${a}(${x})`
  const value = a * x + b
  if (b === 0) return `${head} = ${value}`
  return `${head} ${b < 0 ? MINUS : '+'} ${Math.abs(b)} = ${value}`
}

/** "side AB is labeled 12, side BC is labeled 18, and side CA is labeled 15". */
function listLabels(ids: readonly string[], labels: readonly (string | null)[]): string {
  const parts = labels.map((l, i) => (l ? `side ${sideName6(ids, i)} is labeled ${l}` : null)).filter((s): s is string => s !== null)
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')}${parts.length > 2 ? ',' : ''} and ${parts[parts.length - 1]}`
}

/** "12/8 = 3/2" when the fraction reduces, "12/8" otherwise... written as the scale factor's worked value. */
function ratioWork(top: number, bottom: number, value: Rational): string {
  const raw = `${top}/${bottom}`
  return qText(value) === raw ? raw : `${raw} = ${qText(value)}`
}

function sideCase(rng: Rng, pair: PolyPair, kind: 'sides' | 'perimeter', knownSide: number, seed: number): GeoBuilt | null {
  const { n, first, second, len1, len2, k } = pair
  const xSide = rng.pick(Array.from({ length: n }, (_, i) => i).filter((i) => i !== knownSide))
  const x = rng.pick(X_POOL6)
  const value = len2[xSide]!
  const expr = exprFor(rng, value, x)
  if (!expr) return null
  if (pair.sidePos[knownSide]!.margin < 18 || pair.sidePos[xSide]!.margin < 18) return null
  // The scale factor asked: of the first to the second, or of the second to the first.
  const forward = rng.chance(0.55)
  const [askFrom, askTo] = forward ? [first, second] : [second, first]
  const kAsk = forward ? k : ratDiv(R(1), k)
  const label1: (string | null)[] = len1.map((v) => String(v))
  const label2: (string | null)[] = len2.map(() => null)
  label2[knownSide] = String(len2[knownSide])
  label2[xSide] = linShow(expr)
  const kName = sideName6(second, knownSide)
  const kName1 = sideName6(first, knownSide)
  const xName = sideName6(second, xSide)
  const xName1 = sideName6(first, xSide)
  const posK = pair.sidePos[knownSide]!.index
  const posX = pair.sidePos[xSide]!.index
  const bigger = k.n > k.d ? first : second
  const askedTop = forward ? len1[knownSide]! : len2[knownSide]!
  const askedBottom = forward ? len2[knownSide]! : len1[knownSide]!
  const scaleTraps: TrapDraft6[] = [
    {
      id: 'geo_scale_factor_inverted',
      stage: 'a',
      text: qText(ratDiv(R(1), kAsk)),
      witness: `That is the scale factor of ${polyName(askTo)} to ${polyName(askFrom)}. The scale factor of ${polyName(askFrom)} to ${polyName(askTo)} has the side of ${polyName(askFrom)} on top.`,
    },
    {
      id: 'geo_matched_by_position',
      stage: 'a',
      text: qText(forward ? ratDiv(R(len1[posK]!), R(len2[knownSide]!)) : ratDiv(R(len2[knownSide]!), R(len1[posK]!))),
      witness: `That pairs ${kName} with ${sideName6(first, posK)}, the side drawn in the same place. The statement pairs ${kName} with the side whose letters sit in the same places: read the letters, not the picture.`,
    },
  ]
  const xTraps: TrapDraft6[] = []
  const xPos = lsolve(expr, konst(ratDiv(R(len1[posX]!), k)))
  if (xPos) {
    xTraps.push({
      id: 'geo_matched_by_position',
      stage: 'x',
      text: qText(xPos),
      witness: `That x makes ${xName} match ${sideName6(first, posX)}, the side drawn in the same place. ${xName} corresponds to the side whose letters sit in the same places in the statement.`,
    })
  }
  const xInv = lsolve(expr, konst(ratMul(R(len1[xSide]!), k)))
  if (xInv) {
    xTraps.push({
      id: 'geo_scale_factor_inverted',
      stage: 'x',
      text: qText(xInv),
      witness: `That x uses the scale factor upside down: it makes ${xName} ${bigger === second ? 'shorter' : 'longer'} than ${xName1}, but ${polyName(bigger)} is the larger figure.`,
    })
  }
  const stages: Stage6[] = [
    numberStage6({
      id: 'a',
      label: 'Scale factor',
      hint: RATIO_HINT6,
      answerText: qText(kAsk),
      nudge: `Find a pair of corresponding sides that both have numbers. The scale factor of ${polyName(askFrom)} to ${polyName(askTo)} puts the side of ${polyName(askFrom)} on top.`,
      ruleCard: UNIT6_RULE_IDS.scale,
      reveal: [`${kName1} and ${kName} are corresponding sides, so the scale factor of ${polyName(askFrom)} to ${polyName(askTo)} is ${ratioWork(askedTop, askedBottom, kAsk)}.`],
      traps: scaleTraps,
      ratio: true,
    }),
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(x),
      nudge: `Read the statement to find the side of ${polyName(first)} that corresponds to ${xName}. Then use the scale factor.`,
      ruleCard: UNIT6_RULE_IDS.polygons,
      reveal: [`${xName} corresponds to ${xName1}, so ${xName} = ${len1[xSide]} ÷ ${qText(k)} = ${value}. Then ${solveSteps(expr, konst(value))}.`],
      traps: xTraps,
    }),
  ]
  let promise: ErrorPatternId[]
  let what: string
  if (kind === 'sides') {
    what = xName
    stages.push(
      numberStage6({
        id: 'result',
        label: xName,
        hint: LEN_HINT6,
        answerText: String(value),
        nudge: `Put your value of x into the expression for ${xName}.`,
        ruleCard: UNIT6_RULE_IDS.substitute,
        reveal: [`${xName} = ${atXQ(expr, x)}.`],
        traps: [
          { id: 'geo_answered_x', stage: 'result', text: String(x), witness: `That is the value of x, not ${xName}. Put x back into the expression for ${xName}.` },
          {
            id: 'geo_matched_by_position',
            stage: 'result',
            text: qText(ratDiv(R(len1[posX]!), k)),
            witness: `That length comes from ${sideName6(first, posX)}, the side drawn in the same place as ${xName}. ${xName} corresponds to the side whose letters sit in the same places in the statement.`,
          },
          {
            id: 'geo_scale_factor_inverted',
            stage: 'result',
            text: qText(ratMul(R(len1[xSide]!), k)),
            witness: `That length uses the scale factor upside down: ${polyName(bigger)} is the larger figure, so its sides are the longer ones.`,
          },
        ],
      }),
    )
    promise = rng.pick<ErrorPatternId[]>([
      ['geo_matched_by_position', 'geo_scale_factor_inverted'],
      ['geo_scale_factor_inverted', 'geo_matched_by_position'],
      ['geo_matched_by_position', 'geo_answered_x'],
    ])
  } else {
    what = `the perimeter of ${polyName(second)}`
    const per1 = len1.reduce((s, v) => s + v, 0)
    const per2 = len2.reduce((s, v) => s + v, 0)
    stages.push(
      numberStage6({
        id: 'result',
        label: `Perimeter of ${polyName(second)}`,
        hint: LEN_HINT6,
        answerText: String(per2),
        nudge: `Add the sides of ${polyName(first)}. The perimeters of similar figures have the same ratio as their sides.`,
        ruleCard: UNIT6_RULE_IDS.perimeter,
        reveal: [`The perimeter of ${polyName(first)} is ${len1.join(' + ')} = ${per1}. The perimeters have the same ratio as the sides, so the perimeter of ${polyName(second)} is ${per1} ÷ ${qText(k)} = ${per2}.`],
        traps: [
          {
            id: 'geo_perimeter_ratio_squared',
            stage: 'result',
            text: qText(ratDiv(R(per1), ratMul(k, k))),
            witness: 'That uses the square of the scale factor, which is the ratio of the areas. Perimeters of similar figures keep the scale factor itself.',
          },
          {
            id: 'geo_scale_factor_inverted',
            stage: 'result',
            text: qText(ratMul(R(per1), k)),
            witness: `That perimeter uses the scale factor upside down: ${polyName(bigger)} is the larger figure, so its perimeter is the longer one.`,
          },
        ],
      }),
    )
    promise = rng.pick<ErrorPatternId[]>([
      ['geo_perimeter_ratio_squared', 'geo_matched_by_position'],
      ['geo_matched_by_position', 'geo_perimeter_ratio_squared'],
      ['geo_scale_factor_inverted', 'geo_perimeter_ratio_squared'],
    ])
  }
  const prompt = `In the figure, ${polyName(first)} ~ ${polyName(second)}. Find the scale factor of ${polyName(askFrom)} to ${polyName(askTo)}, then x, then ${what}.`
  const aria = `${n === 3 ? 'Triangles' : 'Quadrilaterals'} ${first.join('')} and ${second.join('')}. In ${triOrQuad(n)} ${first.join('')}, ${listLabels(first, label1)}. In ${triOrQuad(n)} ${second.join('')}, ${listLabels(second, label2)}.`
  const figure = placeLabels6({ ariaLabel: aria, points: pairPoints(pair), segments: segmentsFor(pair, label1, label2) }, [first, second])
  if (!figure) return null
  return finish6({
    question: 'similarPolygons',
    prompt,
    figure,
    stages,
    lengths: [...len1, ...len2],
    angles: [],
    title: 'Similar polygons',
    instructions: POLYGON_INSTRUCTIONS,
    params: { case: kind, n, x, k: qText(k), forward, salt: seed % 7 },
    cards: RATIO_RULES,
    promise,
  })
}

function angleCase(rng: Rng, pair: PolyPair, angles1: number[], knownSide: number, seed: number): GeoBuilt | null {
  const { first, second, len1, len2, k } = pair
  // Roles: the angle of the second triangle written in x, the other labeled angle of the first, and the one asked.
  const [vX, vL, vA] = rng.shuffle([0, 1, 2]) as [number, number, number]
  // The angle in x is written a·x, short enough to sit inside its angle: m∠G = 3x.
  const coeffs = [2, 3, 4, 5].filter((c) => angles1[vX]! % c === 0)
  if (coeffs.length === 0) return null
  const a = rng.pick(coeffs)
  const x = angles1[vX]! / a
  const expr = lin6(a, 0)
  if (pair.vertexPos.some((m) => m.margin < 15)) return null
  const asked = angles1[vA]!
  const forward = rng.chance(0.55)
  const [askFrom, askTo] = forward ? [first, second] : [second, first]
  const kAsk = forward ? k : ratDiv(R(1), k)
  const label1: (string | null)[] = [null, null, null]
  const label2: (string | null)[] = [null, null, null]
  label1[knownSide] = String(len1[knownSide])
  label2[knownSide] = String(len2[knownSide])
  const mark = (ids: readonly string[], v: number, label: string): GeoAngleMark => ({ vertex: ids[v]!, from: ids[(v + 1) % 3]!, to: ids[(v + 2) % 3]!, label, arc: false })
  const angles: GeoAngleMark[] = [mark(first, vX, `${angles1[vX]}°`), mark(first, vL, `${angles1[vL]}°`), mark(second, vX, `${linShow(expr)}°`)]
  const Gx = second[vX]!
  const Ga = second[vA]!
  const posX = pair.vertexPos[vX]!.index
  const posA = pair.vertexPos[vA]!.index
  const askedTop = forward ? len1[knownSide]! : len2[knownSide]!
  const askedBottom = forward ? len2[knownSide]! : len1[knownSide]!
  const scaleTraps: TrapDraft6[] = [
    {
      id: 'geo_scale_factor_inverted',
      stage: 'a',
      text: qText(ratDiv(R(1), kAsk)),
      witness: `That is the scale factor of ${polyName(askTo)} to ${polyName(askFrom)}. The scale factor of ${polyName(askFrom)} to ${polyName(askTo)} has the side of ${polyName(askFrom)} on top.`,
    },
  ]
  const xTraps: TrapDraft6[] = []
  if (posX === vL) {
    const t = lsolve(expr, konst(angles1[vL]!))
    if (t) xTraps.push({ id: 'geo_matched_by_position', stage: 'x', text: qText(t), witness: `That x sets angle ${Gx} equal to angle ${first[vL]}, the angle drawn in the same place. Angle ${Gx} corresponds to the angle whose letter sits in the same place in the statement.` })
  }
  const supp = lsolve(expr, konst(180 - angles1[vX]!))
  if (supp) xTraps.push({ id: 'geo_corresponding_supplementary', stage: 'x', text: qText(supp), witness: `That x makes angle ${Gx} and angle ${first[vX]} add to 180°. Corresponding angles of similar figures are congruent, not supplementary.` })
  const grown = lsolve(expr, konst(ratDiv(R(angles1[vX]!), k)))
  if (grown) xTraps.push({ id: 'geo_angle_scaled', stage: 'x', text: qText(grown), witness: 'That x multiplies the angle by the scale factor. Similar figures have the same angles; only the sides are scaled.' })
  const resultTraps: TrapDraft6[] = [{ id: 'geo_answered_x', stage: 'result', text: String(x), witness: `That is the value of x, not the measure of angle ${Ga}.` }]
  if (posA === vX || posA === vL) {
    resultTraps.push({
      id: 'geo_matched_by_position',
      stage: 'result',
      text: String(angles1[posA]!),
      witness: `That is the measure of angle ${first[posA]}, the angle drawn in the same place as angle ${Ga}. Angle ${Ga} corresponds to the angle whose letter sits in the same place in the statement.`,
    })
  }
  resultTraps.push({
    id: 'geo_corresponding_supplementary',
    stage: 'result',
    text: String(180 - asked),
    witness: `That measure and the measure of angle ${first[vA]} add to 180°. Corresponding angles are congruent, so angle ${Ga} has the same measure as angle ${first[vA]}.`,
  })
  const scaledAsked = ratDiv(R(asked), k)
  if (scaledAsked.n / scaledAsked.d < 180) resultTraps.push({ id: 'geo_angle_scaled', stage: 'result', text: qText(scaledAsked), witness: 'That measure is an angle multiplied by the scale factor. The sides change size; the angles do not.' })
  const stages: Stage6[] = [
    numberStage6({
      id: 'a',
      label: 'Scale factor',
      hint: RATIO_HINT6,
      answerText: qText(kAsk),
      nudge: `The labeled sides are a pair of corresponding sides. The scale factor of ${polyName(askFrom)} to ${polyName(askTo)} puts the side of ${polyName(askFrom)} on top.`,
      ruleCard: UNIT6_RULE_IDS.scale,
      reveal: [`${sideName6(first, knownSide)} and ${sideName6(second, knownSide)} are corresponding sides, so the scale factor of ${polyName(askFrom)} to ${polyName(askTo)} is ${ratioWork(askedTop, askedBottom, kAsk)}.`],
      traps: scaleTraps,
      ratio: true,
    }),
    numberStage6({
      id: 'x',
      label: 'x',
      hint: X_HINT6,
      answerText: String(x),
      nudge: `Find the angle of ${polyName(first)} that corresponds to angle ${Gx}. Corresponding angles are congruent.`,
      ruleCard: UNIT6_RULE_IDS.corrAngles,
      reveal: [`Angle ${Gx} corresponds to angle ${first[vX]}, so ${solveSteps(expr, konst(angles1[vX]!))}.`],
      traps: xTraps,
    }),
    numberStage6({
      id: 'result',
      label: `m∠${Ga}`,
      hint: DEG_HINT6,
      answerText: String(asked),
      nudge: `Angle ${Ga} corresponds to an angle of ${polyName(first)} that has no label. The angles of a triangle add to 180°.`,
      ruleCard: UNIT6_RULE_IDS.corrAngles,
      reveal: [`Angle ${Ga} corresponds to angle ${first[vA]}, and m∠${first[vA]} = 180 ${MINUS} ${angles1[vX]} ${MINUS} ${angles1[vL]} = ${asked}.`],
      traps: resultTraps,
      deg: true,
    }),
  ]
  const prompt = `In the figure, ${polyName(first)} ~ ${polyName(second)}. Find the scale factor of ${polyName(askFrom)} to ${polyName(askTo)}, then x, then m∠${Ga}.`
  const aria = `Triangles ${first.join('')} and ${second.join('')}. In triangle ${first.join('')}, side ${sideName6(first, knownSide)} is labeled ${len1[knownSide]}, angle ${first[vX]} is labeled ${angles1[vX]}°, and angle ${first[vL]} is labeled ${angles1[vL]}°. In triangle ${second.join('')}, side ${sideName6(second, knownSide)} is labeled ${len2[knownSide]} and angle ${Gx} is labeled ${linShow(expr)}°.`
  const figure = placeLabels6({ ariaLabel: aria, points: pairPoints(pair), segments: segmentsFor(pair, label1, label2), angles }, [first, second])
  if (!figure) return null
  // The first triangle is drawn with the angles it is labeled with.
  const drawn = triAngles(pair.p1 as [XY, XY, XY])
  if (drawn.some((g, i) => Math.abs(g - angles1[i]!) > 0.05)) return null
  return finish6({
    question: 'similarPolygons',
    prompt,
    figure,
    stages,
    lengths: [len1[knownSide]!, len2[knownSide]!],
    angles: [...angles1],
    title: 'Similar polygons',
    instructions: POLYGON_INSTRUCTIONS,
    params: { case: 'angle', n: 3, x, k: qText(k), forward, salt: seed % 7 },
    cards: RATIO_RULES,
    promise: rng.pick<ErrorPatternId[]>([
      ['geo_corresponding_supplementary', 'geo_angle_scaled'],
      ['geo_angle_scaled', 'geo_corresponding_supplementary'],
      ['geo_matched_by_position', 'geo_corresponding_supplementary'],
    ]),
  })
}
