import type { ChipId, ErrorPatternId, RelOp } from '@/shared/types'
import type { Rng } from '@/content/rng'
import { aTimesBinom, flipOp, gcd, linearExpr, opGlyph, prettyInt as pi } from '../format'

/**
 * Properties drill item bank (CG-12): minimal legal/illegal twin pairs, instantiated with small
 * distinct nonzero integers. Every relation-mode item is validated against `verifyStep` and every
 * expression-mode item against `exprEquivalent` in drill.test.ts, so the bank doubles as a
 * regression suite for the engine.
 */

export interface DrillCore {
  before: string
  after: string
  relOp?: RelOp
  verdict: 'legal' | 'illegal'
  chip?: ChipId
  patternId?: ErrorPatternId
  lesson: string
}

export interface DrillPair {
  key: string
  family: string
  mode: 'relation' | 'expression'
  /** Instantiate the twin pair with fresh constants. Usually [legal, illegal]. */
  make(rng: Rng): [DrillCore, DrillCore]
}

const OPS: readonly RelOp[] = ['<', '<=', '>', '>=']

const isLess = (op: RelOp) => op === '<' || op === '<='
/** "x + 3" / "x - 3" style constant tail. */
const tail = (n: number) => (n >= 0 ? `+ ${n}` : `- ${-n}`)
/** A number in prose: negatives get parentheses, positives do not ("3·5", "3·(−5)"). */
const paren = (n: number) => (n < 0 ? `(${pi(n)})` : `${n}`)
/** A value that satisfies `x op k` (one unit inside). */
const inside = (op: RelOp, k: number) => (isLess(op) ? k - 1 : k + 1)

export const DRILL_PAIRS: readonly DrillPair[] = [
  // ---------------------------------------------------------------- powers & roots
  {
    key: 'power-of-product',
    family: 'powers-roots',
    mode: 'expression',
    make(rng) {
      const a = rng.int(2, 5)
      const b = rng.int(1, 6)
      return [
        {
          before: `(${a}xy)^2`,
          after: `${a * a}x^2y^2`,
          verdict: 'legal',
          chip: 'simplify',
          lesson: `Powers distribute over multiplication: (${a}xy)^2 = ${a}^2 · x^2 · y^2 = ${a * a}x^2y^2. Every factor gets squared.`,
        },
        {
          before: `(x + ${b})^2`,
          after: `x^2 + ${b * b}`,
          verdict: 'illegal',
          patternId: 'power_over_sum',
          lesson: `Powers never distribute over +. (x + ${b})^2 = (x + ${b})(x + ${b}) = x^2 + ${2 * b}x + ${b * b}. Check x = 1: (1 + ${b})^2 = ${(1 + b) * (1 + b)}, but 1 + ${b * b} = ${1 + b * b}.`,
        },
      ]
    },
  },
  {
    key: 'cbrt-sign',
    family: 'powers-roots',
    mode: 'expression',
    make(rng) {
      const r = rng.pick([2, 3])
      const a = r * r * r
      return [
        {
          before: `cbrt(-${a}x)`,
          after: `-${r}cbrt(x)`,
          verdict: 'legal',
          chip: 'simplify',
          lesson: `Cube roots keep the sign: cbrt(−${a}x) = cbrt(−${a}) · cbrt(x) = ${pi(-r)}·cbrt(x), because (${pi(-r)})^3 = ${pi(-a)}.`,
        },
        {
          before: `cbrt(-${a}x)`,
          after: `${r}cbrt(x)`,
          verdict: 'illegal',
          patternId: 'cbrt_sign_dropped',
          lesson: `cbrt(−${a}) is ${pi(-r)}, not ${r}: (${pi(-r)})^3 = ${pi(-a)}. An odd root keeps the minus. Check x = 1: cbrt(${pi(-a)}) = ${pi(-r)}, but ${r}·cbrt(1) = ${r}.`,
        },
      ]
    },
  },
  {
    key: 'sqrt-square',
    family: 'powers-roots',
    mode: 'expression',
    make(rng) {
      const a = rng.int(2, 5)
      return [
        {
          before: `sqrt(${a * a}x^2)`,
          after: `${a}abs(x)`,
          verdict: 'legal',
          chip: 'simplify',
          lesson: `sqrt(u^2) = |u|: sqrt(${a * a}x^2) = ${a}|x|. A square root is never negative, and the absolute value keeps that promise for negative x.`,
        },
        {
          before: `sqrt(${a * a}x^2)`,
          after: `${a}x`,
          verdict: 'illegal',
          patternId: 'sqrt_square_abs',
          lesson: `sqrt(${a * a}x^2) is ${a}|x|, not ${a}x. Check x = −1: sqrt(${a * a}) = ${a}, but ${a}(−1) = ${pi(-a)}.`,
        },
      ]
    },
  },
  {
    key: 'even-root-pm',
    family: 'powers-roots',
    mode: 'relation',
    make(rng) {
      const a = rng.int(2, 6)
      return [
        {
          before: `x^2 = ${a * a}`,
          after: `x = +-${a}`,
          relOp: '=',
          verdict: 'legal',
          chip: 'root_both',
          lesson: `An even root gives ±: x = ±${a}, because ${a}^2 = ${a * a} AND (−${a})^2 = ${a * a}.`,
        },
        {
          before: `x^2 = ${a * a}`,
          after: `x = ${a}`,
          relOp: '=',
          verdict: 'illegal',
          patternId: 'dropped_pm',
          lesson: `x = ${a} is only half the answer. (−${a})^2 = ${a * a} too, so x = ±${a}. Check x = −${a}: (−${a})^2 = ${a * a} is true, but −${a} = ${a} is false.`,
        },
      ]
    },
  },
  {
    key: 'cube-root-both',
    family: 'powers-roots',
    mode: 'relation',
    make(rng) {
      // Cubes stay inside the engine's ±60 sample window (m = −4 → ±64 is invisible to it).
      const m = rng.pick([-3, -2])
      const cube = m * m * m
      return [
        {
          before: `cbrt(x) = ${m}`,
          after: `x = ${cube}`,
          relOp: '=',
          verdict: 'legal',
          chip: 'power_both',
          lesson: `Cube both sides: x = (${pi(m)})^3 = ${pi(cube)}. A negative cubed stays negative.`,
        },
        {
          before: `cbrt(x) = ${m}`,
          after: `x = ${-cube}`,
          relOp: '=',
          verdict: 'illegal',
          patternId: 'neg_power_sign',
          lesson: `(${pi(m)})^3 = (${pi(m)})(${pi(m)})(${pi(m)}) = ${pi(cube)}, not ${pi(-cube)}. Odd powers keep the sign. Check: cbrt(${pi(-cube)}) = ${pi(-m)}, not ${pi(m)}.`,
        },
      ]
    },
  },
  // ---------------------------------------------------------------- fractions
  {
    key: 'split-fraction',
    family: 'fractions',
    mode: 'expression',
    make(rng) {
      const a = rng.int(2, 6)
      const c = rng.int(2, 4)
      const b = c * rng.int(1, 4)
      return [
        {
          before: `(${a}x + ${b})/${c}`,
          after: `${a}x/${c} + ${b}/${c}`,
          verdict: 'legal',
          chip: 'rewrite_fraction',
          lesson: `A sum in the NUMERATOR splits: (${a}x + ${b})/${c} = ${a}x/${c} + ${b}/${c}. Each term gets divided by ${c}.`,
        },
        {
          before: `${c}/(x + ${b})`,
          after: `${c}/x + ${c}/${b}`,
          verdict: 'illegal',
          patternId: 'split_denominator',
          lesson: `A sum in the DENOMINATOR does not split: ${c}/(x + ${b}) stays together. Check x = 1: the left side is ${c}/${1 + b}, but ${c}/1 + ${c}/${b} = ${c} + ${c}/${b} — not the same number.`,
        },
      ]
    },
  },
  {
    key: 'minus-denominator',
    family: 'fractions',
    mode: 'expression',
    make(rng) {
      const b = rng.intExcept(-9, 9, [-1, 0, 1])
      const ab = Math.abs(b)
      const s = b > 0 ? '+' : '-'
      const o = b > 0 ? '-' : '+'
      return [
        {
          before: `1/(-x ${s} ${ab})`,
          after: `-1/(x ${o} ${ab})`,
          verdict: 'legal',
          chip: 'rewrite_fraction',
          lesson: `Factor −1 out of the WHOLE denominator: −x ${s} ${ab} = −(x ${o} ${ab}), so 1/(−x ${s} ${ab}) = −1/(x ${o} ${ab}).`,
        },
        {
          before: `1/(-x ${s} ${ab})`,
          after: `-1/(x ${s} ${ab})`,
          verdict: 'illegal',
          patternId: 'minus_teleport',
          lesson: `The minus must negate the whole denominator: −x ${s} ${ab} = −(x ${o} ${ab}), not −(x ${s} ${ab}). Check x = 1: 1/(−1 ${s} ${ab}) = 1/${pi(-1 + b)}, but −1/(1 ${s} ${ab}) = −1/${pi(1 + b)}.`,
        },
      ]
    },
  },
  {
    key: 'clear-denominator',
    family: 'fractions',
    mode: 'relation',
    make(rng) {
      const q = rng.pick([2, 3, 4, 5])
      const p = rng.pick([1, 2, 3, 4, 5].filter((v) => v !== q && gcd(v, q) === 1))
      const t = rng.intExcept(-6, 6, [0])
      const u = rng.intExcept(-9, 9, [t])
      return [
        {
          before: `(${p}/${q})y ${tail(t)} = ${u}`,
          after: `${p}y ${tail(q * t)} = ${q * u}`,
          relOp: '=',
          verdict: 'legal',
          chip: 'mul_div',
          lesson: `Multiply both sides by ${q} to clear the fraction — and EVERY term gets the ${q}: ${q}·(${p}/${q})y = ${p}y, ${q}·${paren(t)} = ${pi(q * t)}, ${q}·${paren(u)} = ${pi(q * u)}.`,
        },
        {
          before: `(${p}/${q})y ${tail(t)} = ${u}`,
          after: `${p}y ${tail(t)} = ${q * u}`,
          relOp: '=',
          verdict: 'illegal',
          patternId: 'op_on_one_term',
          lesson: `You multiplied (${p}/${q})y and ${pi(u)} by ${q} but skipped the ${pi(t)}. Multiplying both sides means every term on both sides: ${p}y ${tail(q * t)} = ${pi(q * u)}.`,
        },
      ]
    },
  },
  {
    key: 'cancel-term',
    family: 'fractions',
    mode: 'expression',
    make(rng) {
      const a = rng.int(2, 4)
      const b = a * rng.int(2, 4)
      return [
        {
          before: `(${a}x + ${b})/${a}`,
          after: `x + ${b / a}`,
          verdict: 'legal',
          chip: 'rewrite_fraction',
          lesson: `Every term of the numerator gets divided by ${a}: ${a}x/${a} = x and ${b}/${a} = ${b / a}. Only common FACTORS cancel, and ${a} is a factor of both terms.`,
        },
        {
          before: `(${a}x + ${b})/${a}`,
          after: `x + ${b}`,
          verdict: 'illegal',
          patternId: 'cancel_term',
          lesson: `You cancelled the ${a} with ${a}x only — the ${b} must be divided by ${a} too: x + ${b / a}. Check x = 1: (${a} + ${b})/${a} = ${(a + b) / a}, but 1 + ${b} = ${1 + b}.`,
        },
      ]
    },
  },
  {
    key: 'add-fractions',
    family: 'fractions',
    mode: 'expression',
    make(rng) {
      const a = rng.int(1, 6)
      const b = rng.intExcept(1, 6, [a])
      return [
        {
          before: `${a}/x + ${b}/x`,
          after: `${a + b}/x`,
          verdict: 'legal',
          chip: 'rewrite_fraction',
          lesson: `Same denominator, so add the numerators only: ${a}/x + ${b}/x = ${a + b}/x. The denominator stays x.`,
        },
        {
          before: `${a}/x + ${b}/x`,
          after: `${a + b}/(2x)`,
          verdict: 'illegal',
          patternId: 'add_denominators',
          lesson: `Denominators do not add: 1/2 + 1/2 is 1, not 2/4. With the common denominator x, add the tops: ${a + b}/x. Check x = 1: ${a} + ${b} = ${a + b}, but ${a + b}/2 is half of that.`,
        },
      ]
    },
  },
  // ---------------------------------------------------------------- inequality symbol
  {
    key: 'divide-negative',
    family: 'inequality-symbol',
    mode: 'relation',
    make(rng) {
      const a = rng.int(2, 5)
      const k = rng.intExcept(-6, 6, [0])
      const op = rng.pick(OPS)
      const f = flipOp(op)
      const test = inside(f, -k)
      return [
        {
          before: `-${a}x ${op} ${a * k}`,
          after: `x ${f} ${-k}`,
          relOp: op,
          verdict: 'legal',
          chip: 'mul_div',
          lesson: `Dividing both sides by ${pi(-a)} flips the symbol: ${opGlyph(op)} becomes ${opGlyph(f)}. ${pi(a * k)} ÷ (${pi(-a)}) = ${pi(-k)}, so x ${opGlyph(f)} ${pi(-k)}.`,
        },
        {
          before: `-${a}x ${op} ${a * k}`,
          after: `x ${op} ${-k}`,
          relOp: op,
          verdict: 'illegal',
          patternId: 'no_sign_flip',
          lesson: `You divided by ${pi(-a)} but kept ${opGlyph(op)}. Dividing by a negative flips it: x ${opGlyph(f)} ${pi(-k)}. Check x = ${pi(test)}: ${pi(-a)}·${paren(test)} = ${pi(-a * test)} makes the original true, but ${pi(test)} ${opGlyph(op)} ${pi(-k)} is false.`,
        },
      ]
    },
  },
  {
    key: 'add-sub-no-flip',
    family: 'inequality-symbol',
    mode: 'relation',
    make(rng) {
      const a = rng.intExcept(-6, 6, [0])
      const b = rng.int(-6, 6)
      const op = rng.pick(OPS)
      const verb = a > 0 ? 'Adding' : 'Subtracting'
      return [
        {
          before: `x ${tail(-a)} ${op} ${b}`,
          after: `x ${op} ${b + a}`,
          relOp: op,
          verdict: 'legal',
          chip: 'add_sub',
          lesson: `${verb} ${Math.abs(a)} on both sides never flips the symbol: x ${opGlyph(op)} ${pi(b + a)}.`,
        },
        {
          before: `x ${tail(-a)} ${op} ${b}`,
          after: `x ${flipOp(op)} ${b + a}`,
          relOp: op,
          verdict: 'illegal',
          patternId: 'flip_on_add',
          lesson: `Only multiplying or dividing by a NEGATIVE flips the symbol. ${verb} ${Math.abs(a)} keeps ${opGlyph(op)}: x ${opGlyph(op)} ${pi(b + a)}.`,
        },
      ]
    },
  },
  {
    key: 'positive-divide',
    family: 'inequality-symbol',
    mode: 'relation',
    make(rng) {
      const a = rng.int(2, 5)
      const k = rng.intExcept(-6, 6, [0])
      const op = rng.pick(OPS)
      const test = inside(op, k)
      return [
        {
          before: `${a}x ${op} ${a * k}`,
          after: `x ${op} ${k}`,
          relOp: op,
          verdict: 'legal',
          chip: 'mul_div',
          lesson: `Dividing by a POSITIVE ${a} keeps the symbol: x ${opGlyph(op)} ${pi(k)}. Only a negative flips.`,
        },
        {
          before: `${a}x ${op} ${a * k}`,
          after: `x ${flipOp(op)} ${k}`,
          relOp: op,
          verdict: 'illegal',
          patternId: 'flip_on_positive',
          lesson: `You flipped the symbol, but ${a} is positive — dividing by a positive never flips. x ${opGlyph(op)} ${pi(k)}. Check x = ${pi(test)}: ${a}·${paren(test)} = ${pi(a * test)} makes the original true, but ${pi(test)} ${opGlyph(flipOp(op))} ${pi(k)} is false.`,
        },
      ]
    },
  },
  {
    key: 'swap-sides',
    family: 'inequality-symbol',
    mode: 'relation',
    make(rng) {
      const k = rng.int(-9, 9)
      const op = rng.pick(OPS)
      const f = flipOp(op)
      const test = inside(f, k)
      return [
        {
          before: `${k} ${op} x`,
          after: `x ${f} ${k}`,
          relOp: op,
          verdict: 'legal',
          chip: 'swap_sides',
          lesson: `${pi(k)} ${opGlyph(op)} x says the same thing as x ${opGlyph(f)} ${pi(k)}. Swapping sides turns the symbol around so it still points at the smaller side.`,
        },
        {
          before: `${k} ${op} x`,
          after: `x ${op} ${k}`,
          relOp: op,
          verdict: 'illegal',
          patternId: 'swap_sides_no_reverse',
          lesson: `Swapping sides means the symbol turns around too: ${pi(k)} ${opGlyph(op)} x is x ${opGlyph(f)} ${pi(k)}. Check x = ${pi(test)}: ${pi(k)} ${opGlyph(op)} ${pi(test)} is true, but ${pi(test)} ${opGlyph(op)} ${pi(k)} is false.`,
        },
      ]
    },
  },
  // ---------------------------------------------------------------- distribute
  {
    key: 'distribute',
    family: 'distribute',
    mode: 'relation',
    make(rng) {
      const a = rng.int(2, 5)
      const b = rng.intExcept(-6, 6, [0])
      const k = rng.int(-4, 4)
      const c = a * (k + b)
      return [
        {
          before: `${aTimesBinom(a, b)} = ${c}`,
          after: `${linearExpr(a, a * b)} = ${c}`,
          relOp: '=',
          verdict: 'legal',
          chip: 'distribute',
          lesson: `Distribute: ${a}·x AND ${a}·${paren(b)} = ${pi(a * b)}. Every term inside the parentheses gets the ${a}.`,
        },
        {
          before: `${aTimesBinom(a, b)} = ${c}`,
          after: `${linearExpr(a, b)} = ${c}`,
          relOp: '=',
          verdict: 'illegal',
          patternId: 'partial_distribute',
          lesson: `The ${a} has to reach every term inside the parentheses: ${a}·x and ${a}·${paren(b)} = ${pi(a * b)}. Check x = 0: ${a}·${paren(b)} = ${pi(a * b)}, not ${pi(b)}.`,
        },
      ]
    },
  },
  {
    key: 'distribute-negative',
    family: 'distribute',
    mode: 'expression',
    make(rng) {
      const a = rng.int(1, 3)
      const b = rng.intExcept(-6, 6, [0])
      const before = aTimesBinom(-a, b)
      return [
        {
          before,
          after: linearExpr(-a, -a * b),
          verdict: 'legal',
          chip: 'distribute',
          lesson: `The minus is part of the multiplier ${pi(-a)}, so it reaches every term: ${pi(-a)}·x = ${a === 1 ? "−x" : `−${a}x`} and ${pi(-a)}·${paren(b)} = ${pi(-a * b)}.`,
        },
        {
          before,
          after: linearExpr(-a, a * b),
          verdict: 'illegal',
          patternId: 'negative_not_distributed',
          lesson: `The minus belongs to the multiplier ${pi(-a)} and hits BOTH terms: ${pi(-a)}·${paren(b)} = ${pi(-a * b)}, not ${pi(a * b)}. Check x = 0: ${pi(-a)}·(0 ${tail(b)}) = ${pi(-a * b)}.`,
        },
      ]
    },
  },
  // ---------------------------------------------------------------- simplify (reorder, like terms)
  {
    key: 'reorder',
    family: 'simplify',
    mode: 'expression',
    make(rng) {
      const a = rng.int(1, 9)
      const b = rng.intExcept(1, 9, [a])
      return [
        {
          before: `(${a} + x) + ${b}`,
          after: `(x + ${a}) + ${b}`,
          verdict: 'legal',
          chip: 'commutative',
          lesson: `Commutative property: the ORDER inside the sum changed (${a} + x became x + ${a}). The grouping is untouched.`,
        },
        {
          before: `(${a} + x) + ${b}`,
          after: `${a} + (x + ${b})`,
          verdict: 'legal',
          chip: 'associative',
          lesson: `Associative property: the GROUPING changed ((${a} + x) + ${b} became ${a} + (x + ${b})). The order ${a}, x, ${b} is untouched.`,
        },
      ]
    },
  },
  {
    key: 'combine-like',
    family: 'simplify',
    mode: 'expression',
    make(rng) {
      const a = rng.int(2, 7)
      const b = rng.intExcept(2, 7, [a])
      return [
        {
          before: `${a}x + ${b}x`,
          after: `${a + b}x`,
          verdict: 'legal',
          chip: 'combine_like',
          lesson: `${a}x and ${b}x are like terms (same variable, same power), so add the coefficients: ${a} + ${b} = ${a + b}, giving ${a + b}x.`,
        },
        {
          before: `${a}x + ${b}`,
          after: `${a + b}x`,
          verdict: 'illegal',
          patternId: 'combine_unlike',
          lesson: `${a}x and ${b} are NOT like terms — one has an x and the other does not, so ${a}x + ${b} stays as it is. Check x = 2: ${a}·2 + ${b} = ${2 * a + b}, but ${a + b}·2 = ${2 * (a + b)}.`,
        },
      ]
    },
  },
  // ---------------------------------------------------------------- equations
  {
    key: 'move-constant',
    family: 'equations',
    mode: 'relation',
    make(rng) {
      const a = rng.intExcept(-9, 9, [0])
      const b = rng.int(-9, 9)
      const verb = a > 0 ? 'Subtract' : 'Add'
      const prep = a > 0 ? 'from' : 'to'
      const sym = a > 0 ? '−' : '+'
      return [
        {
          before: `x ${tail(a)} = ${b}`,
          after: `x = ${b - a}`,
          relOp: '=',
          verdict: 'legal',
          chip: 'add_sub',
          lesson: `${verb} ${Math.abs(a)} ${prep} both sides: x = ${pi(b)} ${sym} ${Math.abs(a)} = ${pi(b - a)}.`,
        },
        {
          before: `x ${tail(a)} = ${b}`,
          after: `x = ${b + a}`,
          relOp: '=',
          verdict: 'illegal',
          patternId: 'term_across_sign',
          lesson: `Moving ${a > 0 ? '+' : '−'}${Math.abs(a)} across the = means ${a > 0 ? 'subtracting' : 'adding'} it on both sides: x = ${pi(b)} ${sym} ${Math.abs(a)} = ${pi(b - a)}. Check: ${pi(b + a)} ${tail(a).replace('-', '−')} = ${pi(b + 2 * a)}, not ${pi(b)}.`,
        },
      ]
    },
  },
  {
    key: 'lost-root',
    family: 'equations',
    mode: 'relation',
    make(rng) {
      const a = rng.int(2, 7)
      return [
        {
          before: `x^2 = ${a}x`,
          after: `x^2 - ${a}x = 0`,
          relOp: '=',
          verdict: 'legal',
          chip: 'add_sub',
          lesson: `Subtract ${a}x from both sides so one side is 0, then factor: x(x − ${a}) = 0 gives x = 0 or x = ${a}. Both solutions survive.`,
        },
        {
          before: `x^2 = ${a}x`,
          after: `x = ${a}`,
          relOp: '=',
          verdict: 'illegal',
          patternId: 'divide_by_variable',
          lesson: `Dividing both sides by x throws away the solution x = 0 (you cannot divide by 0). Check x = 0: 0^2 = ${a}·0 is true, but 0 = ${a} is false. Move everything to one side and factor instead.`,
        },
      ]
    },
  },
]

export const DRILL_FAMILIES: readonly string[] = Array.from(new Set(DRILL_PAIRS.map((p) => p.family)))
