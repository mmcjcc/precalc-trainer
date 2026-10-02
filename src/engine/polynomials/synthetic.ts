/**
 * Synthetic division of a polynomial by x − c (c rational), exactly, with the remainder and factor
 * theorems.
 *
 * The table has three rows: the coefficients of f from the highest power down with a 0 for every missing
 * power, the products (c times the bottom entry one column to the left; nothing under the first
 * coefficient), and the bottom row (each column added). The bottom row is the quotient's coefficients
 * followed by the remainder, and the remainder is f(c).
 *
 * Named mistakes, each computed from what the slip WOULD produce (sample: (2x^3 − 3x^2 − 5) ÷ (x − 2),
 * bottom row 2, 1, 2, −1):
 *  - sd_wrong_sign_c:            the box holds −c                              2, −7, 14, −33
 *  - sd_subtracted:              subtracted each product instead of adding     2, −7, 14, −33 (same row; the
 *                                products row, when given, tells the two apart), or in one column only
 *  - sd_missing_placeholder:     no 0 for a missing power                      2, 1, −3
 *  - sd_first_coefficient:       started with a product, not a straight drop   4, 5, 10, 15
 *  - sd_quotient_degree:         quotient one degree too high or too low       2x^3 + x^2 + 2x
 *  - sd_remainder_last_quotient: remainder read one place too early            2
 */
import type { Rational } from '@/shared/types'
import { rat, ratAdd, ratMul, ratNeg, ratSub } from '@/notation/rational'
import { polyAdd, polyConst, polyEquals, polyMul, polyToText, P_X, type Poly } from '../functions/poly'
import { substituteValueText } from '../functions/text'
import { rf, rp, rt, toRational, xMinus } from '../transformations/text'
import type { RatLike } from '../transformations/types'
import {
  checked,
  dedupeCandidates,
  descending,
  fromDescending,
  guard,
  invalidParse,
  invalidRow,
  joinAnd,
  ordinal,
  plusParen,
  polyDeg,
  polyPretty,
  powerText,
  pretty,
  readFormula,
  readNumber,
  readPoly,
  readRow,
  rowPretty,
  rowText,
  same,
  sameRow,
  termName,
  valueAt,
} from './common'
import type {
  FormulaMistakeCandidate,
  NumberMistakeCandidate,
  PolyGrade,
  PolyInput,
  PolyMistakeKind,
  SyntheticAnswer,
  SyntheticMistakeCandidate,
  SyntheticTable,
} from './types'

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

interface Run {
  box: Rational
  coefficients: Rational[]
  products: Rational[]
  bottom: Rational[]
}

/**
 * One pass of the method. `combine` is what happens in each column ('subtract' is the slip); `first` is
 * how the first bottom entry is made ('down' is right; 'product' writes c·a there; 'sum' writes a + c·a).
 */
function run(coefficients: readonly Rational[], box: Rational, combine: 'add' | 'subtract' = 'add', first: 'down' | 'product' | 'sum' = 'down'): Run {
  const products: Rational[] = []
  const bottom: Rational[] = []
  const a0 = coefficients[0]!
  bottom.push(first === 'down' ? a0 : first === 'product' ? ratMul(box, a0) : ratAdd(a0, ratMul(box, a0)))
  for (let i = 1; i < coefficients.length; i++) {
    const product = ratMul(box, bottom[i - 1]!)
    products.push(product)
    bottom.push(combine === 'add' ? ratAdd(coefficients[i]!, product) : ratSub(coefficients[i]!, product))
  }
  return { box, coefficients: [...coefficients], products, bottom }
}

interface Model extends SyntheticTable {
  poly: Poly
  quotient: Poly
}

/** "x - 2", "x + 2", "x - 1/2": the divisor whose zero is c (app syntax). */
export function divisorText(c: RatLike): string {
  const r = toRational(c)
  if (!r) throw new RangeError(`divisorText: unreadable number ${String(c)}`)
  return xMinus(r)
}

function build(f: PolyInput, c: RatLike): Model | null {
  const src = readPoly(f)
  const box = toRational(c)
  if (!src || !box || polyDeg(src.poly) < 1) return null
  return guard(() => {
    const n = polyDeg(src.poly)
    const coefficients = descending(src.poly)
    const { products, bottom } = run(coefficients, box)
    const quotientCoefficients = bottom.slice(0, -1)
    const quotient = fromDescending(quotientCoefficients)
    const remainder = bottom[n]!
    const divisor = xMinus(box)
    const D = pretty(divisor)
    const missingPowers: number[] = []
    coefficients.forEach((v, i) => {
      if (v.n === 0) missingPowers.push(n - i)
    })
    const substitution = substituteValueText(src.text, rt(box))
    const isFactor = remainder.n === 0

    const explanation: string[] = []
    explanation.push(
      box.n < 0
        ? `${D} = x − (${rp(box)}) is 0 at x = ${rp(box)}, so ${rp(box)} goes in the box.`
        : `${D} is 0 at x = ${rp(box)}, so ${rp(box)} goes in the box.`,
    )
    explanation.push(
      missingPowers.length
        ? `Write the coefficients of ${pretty(src.text)} from the highest power down, with a 0 for the missing ${joinAnd(missingPowers.map(termName))}: ${rowPretty(coefficients)}.`
        : `Write the coefficients of ${pretty(src.text)} from the highest power down: ${rowPretty(coefficients)}.`,
    )
    explanation.push(`Bring the first coefficient straight down: ${rp(bottom[0]!)}.`)
    for (let i = 1; i <= n; i++) {
      explanation.push(
        `Multiply ${rf(box)}·${rf(bottom[i - 1]!)} = ${rp(products[i - 1]!)}, write it under ${rp(coefficients[i]!)} and add: ${plusParen(coefficients[i]!, products[i - 1]!)} = ${rp(bottom[i]!)}.`,
      )
    }
    explanation.push(
      `The bottom row is ${rowPretty(bottom)}. Its last number is the remainder, ${rp(remainder)}; the others are the coefficients of the quotient, which is one degree lower than f(x): ${polyPretty(quotient)}.`,
    )
    explanation.push(`Remainder theorem: the remainder is f(${rp(box)}). Check: f(${rp(box)}) = ${pretty(substitution)} = ${rp(remainder)}.`)
    explanation.push(
      isFactor
        ? `Factor theorem: the remainder is 0, so ${D} is a factor: f(x) = (${D})(${polyPretty(quotient)}).`
        : `Factor theorem: the remainder is not 0, so ${D} is not a factor of f(x).`,
    )
    return {
      poly: src.poly,
      quotient,
      f: src.text,
      degree: n,
      c: box,
      divisor,
      coefficients,
      missingPowers,
      products,
      bottom,
      quotientCoefficients,
      quotientText: polyToText(quotient),
      remainder,
      remainderText: rt(remainder),
      isFactor,
      substitution,
      rows: { coefficients: coefficients.map(rt), products: products.map(rt), bottom: bottom.map(rt) },
      explanation,
    }
  })
}

/**
 * The synthetic-division table of f(x) ÷ (x − c): rows, quotient, remainder, f(c), whether x − c is a
 * factor, and the worked explanation. Null when f is not a polynomial of degree ≥ 1 or c is unreadable.
 */
export function syntheticDivision(f: PolyInput, c: RatLike): SyntheticTable | null {
  const m = build(f, c)
  if (!m) return null
  const { poly: _poly, quotient: _quotient, ...table } = m
  void _poly
  void _quotient
  return table
}

/** f(x) exactly at a rational x (the remainder theorem's f(c)); null when f is not a polynomial or x is unreadable. */
export function polyValueAt(f: PolyInput, x: RatLike): Rational | null {
  const src = readPoly(f)
  const t = toRational(x)
  if (!src || !t) return null
  return guard(() => valueAt(src.poly, t))
}

const UNSUPPORTED = 'This problem needs a polynomial of degree 1 or more with rational coefficients and a rational number c.'

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

interface RawRun extends Run {
  kind: PolyMistakeKind
  /** The witness with a subject of the caller's choice ("Your bottom row 2, −7, 14, −33"). */
  witness: (subject: string) => string
}

/** Nonempty subsets of `items`, the whole set first, then by decreasing size. */
function subsets<T>(items: readonly T[]): T[][] {
  if (items.length > 4) return [[...items]]
  const out: T[][] = []
  for (let mask = (1 << items.length) - 1; mask >= 1; mask--) out.push(items.filter((_v, i) => mask & (1 << i)))
  return out.sort((x, y) => y.length - x.length)
}

function rawRuns(m: Model): RawRun[] {
  const { c, coefficients: cs, degree: n } = m
  const D = pretty(m.divisor)
  const out: RawRun[] = []
  if (c.n !== 0) {
    out.push({
      kind: 'sd_wrong_sign_c',
      ...run(cs, ratNeg(c)),
      witness: (subject) =>
        `The box holds the number that makes ${D} zero: x = ${rp(c)}. ${subject} is what ${rp(ratNeg(c))} in the box gives (the same as subtracting each product instead of adding it).`,
    })
    out.push({
      kind: 'sd_subtracted',
      ...run(cs, c, 'subtract'),
      witness: (subject) =>
        `Synthetic division ADDS each column: the sign change is already in the box number ${rp(c)}. ${subject} comes from subtracting the products, as long division does.`,
    })
  }
  const zeroAt = cs.map((v, i) => (v.n === 0 ? i : -1)).filter((i) => i > 0)
  for (const drop of subsets(zeroAt)) {
    const row = cs.filter((_v, i) => !drop.includes(i))
    const powers = drop.map((i) => termName(n - i))
    out.push({
      kind: 'sd_missing_placeholder',
      ...run(row, c),
      witness: (subject) =>
        `f(x) has no ${joinAnd(powers)}, so the coefficient row needs a 0 in ${drop.length === 1 ? 'that place' : 'those places'}: ${rowPretty(cs)}. Without ${drop.length === 1 ? 'it' : 'them'} every later number lines up with the wrong power. ${subject} comes from the row ${rowPretty(row)}.`,
    })
  }
  const down = `The first coefficient comes straight down: the bottom row starts with ${rp(cs[0]!)}. The multiplying starts in the next column (${rf(c)}·${rf(cs[0]!)} = ${rp(ratMul(c, cs[0]!))} goes under ${rp(cs[1]!)}).`
  out.push({ kind: 'sd_first_coefficient', ...run(cs, c, 'add', 'product'), witness: (subject) => `${down} ${subject} comes from starting the bottom row with the product ${rp(ratMul(c, cs[0]!))}.` })
  out.push({
    kind: 'sd_first_coefficient',
    ...run(cs, c, 'add', 'sum'),
    witness: (subject) => `${down} ${subject} comes from starting the bottom row with ${plusParen(cs[0]!, ratMul(c, cs[0]!))} = ${rp(ratAdd(cs[0]!, ratMul(c, cs[0]!)))}: nothing is added in the first column.`,
  })
  return out
}

function tableCandidates(m: Model): SyntheticMistakeCandidate[] {
  const raw = rawRuns(m).map((r) => ({
    kind: r.kind,
    box: r.box,
    coefficients: r.coefficients,
    products: r.products,
    bottom: r.bottom,
    text: rowText(r.bottom),
    witness: r.witness(`Your bottom row ${rowPretty(r.bottom)}`),
    shadows: [] as PolyMistakeKind[],
  }))
  return dedupeCandidates(
    raw,
    (r) => sameRow(r.bottom, m.bottom),
    (u, v) => sameRow(u.bottom, v.bottom),
  )
}

/**
 * The bottom row each table slip produces, in priority order, each different from the right row and from
 * the others. `sd_subtracted` always gives the same row as `sd_wrong_sign_c` and is listed in its `shadows`
 * (pass her products row to `gradeSyntheticTable` to tell them apart). Null outside the model.
 */
export function syntheticMistakes(f: PolyInput, c: RatLike): SyntheticMistakeCandidate[] | null {
  const m = build(f, c)
  return m ? tableCandidates(m) : null
}

interface RawQuotient {
  kind: PolyMistakeKind
  poly: Poly
  witness: string
}

function rawQuotients(m: Model): RawQuotient[] {
  const n = m.degree
  const D = pretty(m.divisor)
  const q = polyPretty(m.quotient)
  const rule = `Dividing by ${D} lowers the degree by one: f(x) has degree ${n}, so the quotient starts with ${n - 1 === 0 ? 'a constant' : powerText(n - 1)}. The bottom row ${rowPretty(m.bottom)} reads ${q}, remainder ${rp(m.remainder)}.`
  const out: RawQuotient[] = []
  out.push({ kind: 'sd_quotient_degree', poly: polyMul(P_X, m.quotient), witness: `${rule} Yours starts one power too high, at ${powerText(n)}.` })
  out.push({
    kind: 'sd_quotient_degree',
    poly: fromDescending(m.bottom),
    witness: `${rule} Yours starts one power too high, at ${powerText(n)}, and uses the remainder ${rp(m.remainder)} as its constant term.`,
  })
  if (n >= 2) {
    out.push({
      kind: 'sd_quotient_degree',
      poly: fromDescending(m.bottom.slice(0, -2)),
      witness: `${rule} Yours starts one power too low and leaves out the last coefficient, ${rp(m.bottom[n - 1]!)}.`,
    })
  }
  for (const r of rawRuns(m)) {
    const poly = fromDescending(r.bottom.slice(0, -1))
    out.push({ kind: r.kind, poly, witness: r.witness(`Your quotient ${polyPretty(poly)}`) })
  }
  return out
}

function quotientCandidates(m: Model): (FormulaMistakeCandidate & { poly: Poly })[] {
  const raw = rawQuotients(m).map((r) => ({ kind: r.kind, poly: r.poly, text: polyToText(r.poly), witness: r.witness, shadows: [] as PolyMistakeKind[] }))
  return dedupeCandidates(
    raw,
    (r) => polyEquals(r.poly, m.quotient),
    (u, v) => polyEquals(u.poly, v.poly),
  )
}

/** The wrong quotient each slip gives (degree read wrong, then the table slips); null outside the model. */
export function quotientMistakes(f: PolyInput, c: RatLike): FormulaMistakeCandidate[] | null {
  const m = build(f, c)
  if (!m) return null
  return quotientCandidates(m).map(({ kind, text, witness, shadows }) => ({ kind, text, witness, shadows }))
}

function remainderCandidates(m: Model, ask: 'remainder' | 'value'): NumberMistakeCandidate[] {
  const n = m.degree
  const c = m.c
  const D = pretty(m.divisor)
  const raw: NumberMistakeCandidate[] = []
  const add = (kind: PolyMistakeKind, value: Rational, witness: string): void => {
    raw.push({ kind, value, text: rt(value), witness, shadows: [] })
  }
  const last = m.bottom[n - 1]!
  add(
    'sd_remainder_last_quotient',
    last,
    `The remainder is the LAST number of the bottom row ${rowPretty(m.bottom)}: ${rp(m.remainder)}. Your ${rp(last)} is the number before it, the ${n - 1 === 0 ? 'quotient' : 'constant term of the quotient'}.`,
  )
  for (const r of rawRuns(m)) {
    const value = r.bottom[r.bottom.length - 1]!
    if (r.kind === 'sd_wrong_sign_c') {
      add(
        r.kind,
        value,
        ask === 'value'
          ? `f(${rp(c)}) means x = ${rp(c)}: f(${rp(c)}) = ${pretty(m.substitution)} = ${rp(m.remainder)}. Your ${rp(value)} is f(${rp(ratNeg(c))}), the value at the opposite number.`
          : `${D} is 0 at x = ${rp(c)}, so the remainder is f(${rp(c)}) = ${rp(m.remainder)}. Your ${rp(value)} is f(${rp(ratNeg(c))}): it comes from ${rp(ratNeg(c))} in the box (or from subtracting each product instead of adding).`,
      )
    } else add(r.kind, value, r.witness(`Your ${ask === 'value' ? 'value' : 'remainder'} ${rp(value)}`))
  }
  return dedupeCandidates(
    raw,
    (r) => same(r.value, m.remainder),
    (u, v) => same(u.value, v.value),
  )
}

/** The wrong remainder (= f(c)) each slip gives; null outside the model. */
export function remainderMistakes(f: PolyInput, c: RatLike): NumberMistakeCandidate[] | null {
  const m = build(f, c)
  return m ? remainderCandidates(m, 'remainder') : null
}

// ---------------------------------------------------------------------------
// Graders
// ---------------------------------------------------------------------------

/**
 * Grade her table. The bottom row is what is graded; her products row and box number, when the screen
 * collects them, are checked too and sharpen the diagnosis (they tell "−c in the box" from "subtracted").
 * A row that is not a whole-table slip is checked column by column against HER OWN previous entry, so the
 * message points at the first column where the arithmetic goes wrong.
 */
export function gradeSyntheticTable(f: PolyInput, c: RatLike, answer: SyntheticAnswer): PolyGrade {
  return checked(() => gradeSyntheticTableUnchecked(f, c, answer))
}

function gradeSyntheticTableUnchecked(f: PolyInput, c: RatLike, answer: SyntheticAnswer): PolyGrade {
  const m = build(f, c)
  if (!m) return { verdict: 'unsupported', message: UNSUPPORTED }
  const explanation = m.explanation
  const n = m.degree
  const D = pretty(m.divisor)
  const box = m.c

  let herBox: Rational | null = null
  if (answer.box !== undefined) {
    const b = readNumber(answer.box)
    if (!b.ok) return invalidParse(b.error)
    herBox = b.value
    if (!same(herBox, box)) {
      if (same(herBox, ratNeg(box))) {
        return {
          verdict: 'mistake',
          mistake: 'sd_wrong_sign_c',
          witness: `The box holds the number that makes ${D} zero: ${D} = 0 at x = ${rp(box)}, so write ${rp(box)}, not ${rp(ratNeg(box))}.`,
          explanation,
        }
      }
      return { verdict: 'wrong', message: `The box holds the number that makes the divisor zero: ${D} = 0 at x = ${rp(box)}.`, explanation }
    }
  }
  const bottom = readRow(answer.bottom, 'bottom row')
  if (!bottom.ok) return invalidRow(bottom)
  let products: (Rational | null)[] | null = null
  if (answer.products !== undefined) {
    const p = readRow(answer.products, 'middle row')
    if (!p.ok) return invalidRow(p)
    products = p.values
  }
  const her = bottom.values
  const herText = (i: number): string => (her[i] ? rp(her[i]!) : pretty(bottom.texts[i]!))

  if (sameRow(her, m.bottom)) {
    if (products && !sameRow(products, m.products)) {
      if (products.length !== n) {
        return {
          verdict: 'wrong',
          message: `Your bottom row is right. The middle row has ${n} numbers, one under each coefficient after the first (nothing goes under ${rp(m.coefficients[0]!)}); you gave ${products.length}.`,
          explanation,
        }
      }
      const i = products.findIndex((v, j) => !same(v, m.products[j]))
      return {
        verdict: 'wrong',
        message: `Your bottom row is right. In the middle row, the number under ${rp(m.coefficients[i + 1]!)} is ${rf(box)}·${rf(m.bottom[i]!)} = ${rp(m.products[i]!)}: the box number times the bottom entry one column to the left.`,
        explanation,
      }
    }
    return {
      verdict: 'correct',
      message: `Correct: the bottom row is ${rowPretty(m.bottom)}, so the quotient is ${polyPretty(m.quotient)} and the remainder is ${rp(m.remainder)}.`,
      explanation,
    }
  }

  // A whole-table slip.
  const hits = rawRuns(m).filter((r) => sameRow(r.bottom, her))
  if (hits.length) {
    // Two slips can give the same bottom row: her middle row, or the box she wrote, says which one it was.
    const hit = (products ? hits.find((r) => sameRow(r.products, products)) : undefined) ?? (herBox ? hits.find((r) => same(r.box, herBox)) : undefined) ?? hits[0]!
    return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness(`Your bottom row ${rowPretty(hit.bottom)}`), explanation }
  }

  if (her.length !== n + 1) {
    return {
      verdict: 'wrong',
      message: `The bottom row has one number under each coefficient of the top row ${rowPretty(m.coefficients)}: ${n + 1} numbers. You gave ${her.length}.`,
      explanation,
    }
  }
  if (!same(her[0], m.coefficients[0])) {
    return { verdict: 'wrong', message: `The first coefficient comes straight down: the bottom row starts with ${rp(m.coefficients[0]!)}, not ${herText(0)}.`, explanation }
  }
  // Column by column, each against her own previous entry (everything before the first slip is right).
  for (let i = 1; i <= n; i++) {
    const prev = her[i - 1]!
    const product = ratMul(box, prev)
    const expected = ratAdd(m.coefficients[i]!, product)
    if (same(her[i], expected)) continue
    const where = `In the ${ordinal(i + 1)} column (under ${rp(m.coefficients[i]!)})`
    const lead = i > 1 ? `Your first ${i} numbers, ${rowPretty(m.bottom.slice(0, i))}, are right. ` : `Your first number, ${rp(m.bottom[0]!)}, is right. `
    if (product.n !== 0 && same(her[i], ratSub(m.coefficients[i]!, product))) {
      return {
        verdict: 'mistake',
        mistake: 'sd_subtracted',
        witness: `${lead}${where} you subtracted the product: ${rp(m.coefficients[i]!)} − ${rf(product)} = ${herText(i)}. Synthetic division ADDS each column (the sign change is already in the box number ${rp(box)}): ${plusParen(m.coefficients[i]!, product)} = ${rp(expected)}.`,
        explanation,
      }
    }
    return {
      verdict: 'wrong',
      message: `${lead}${where}: multiply ${rf(box)}·${rf(prev)} = ${rp(product)}, then add ${plusParen(m.coefficients[i]!, product)} = ${rp(expected)}, not ${herText(i)}.`,
      explanation,
    }
  }
  // Unreachable: a row that agrees in every column is the right row.
  return { verdict: 'wrong', message: `The bottom row is ${rowPretty(m.bottom)}.`, explanation }
}

/** Grade her bottom row alone: one string per box, or "2, 1, 2, -1". */
export function gradeBottomRow(f: PolyInput, c: RatLike, answer: string | readonly string[]): PolyGrade {
  return gradeSyntheticTable(f, c, { bottom: answer })
}

/** Grade her quotient: a polynomial in x, compared exactly in any form. */
export function gradeQuotient(f: PolyInput, c: RatLike, answer: string): PolyGrade {
  return checked(() => gradeQuotientUnchecked(f, c, answer))
}

function gradeQuotientUnchecked(f: PolyInput, c: RatLike, answer: string): PolyGrade {
  const m = build(f, c)
  if (!m) return { verdict: 'unsupported', message: UNSUPPORTED }
  const her = readFormula(answer)
  if (!her.ok) return invalidParse(her.error)
  const explanation = m.explanation
  const D = pretty(m.divisor)
  if (!her.poly) {
    // The whole result q(x) + r/(x − c), typed where only the quotient is wanted.
    const whole = her.ratFn && guard(() => polyEquals(polyMul(her.ratFn!.num, [ratNeg(m.c), rat(1)]), polyMul(m.poly, her.ratFn!.den)))
    if (whole) {
      return {
        verdict: 'invalid',
        reason: 'not_in_form',
        message: `That is the whole result of the division. This answer is only the quotient, the polynomial part; the remainder ${rp(m.remainder)} goes in its own answer.`,
      }
    }
    return { verdict: 'invalid', reason: 'unreadable', message: 'The quotient is a polynomial in x: no x in a denominator and no roots.' }
  }
  if (polyEquals(her.poly, m.quotient)) {
    return { verdict: 'correct', message: `Correct: the quotient is ${polyPretty(m.quotient)} (remainder ${rp(m.remainder)}).`, explanation }
  }
  const hit = quotientCandidates(m).find((k) => polyEquals(k.poly, her.poly!))
  if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  const back = polyPretty(guard(() => addConstant(polyMul(her.poly!, [ratNeg(m.c), rat(1)]), m.remainder)) ?? [])
  return {
    verdict: 'wrong',
    message: `Check by multiplying back: (${D})·(your quotient) + (${rp(m.remainder)}) should give f(x). Yours gives ${back}, but f(x) = ${pretty(m.f)}. The quotient's coefficients are the bottom row without its last number.`,
    explanation,
  }
}

function addConstant(p: Poly, r: Rational): Poly {
  return polyAdd(p, polyConst(r))
}

/**
 * Grade her remainder, or her value of f(c) (`ask: 'value'` changes the wording only: by the remainder
 * theorem they are the same number).
 */
export function gradeRemainder(f: PolyInput, c: RatLike, answer: string, options: { ask?: 'remainder' | 'value' } = {}): PolyGrade {
  return checked(() => gradeRemainderUnchecked(f, c, answer, options))
}

function gradeRemainderUnchecked(f: PolyInput, c: RatLike, answer: string, options: { ask?: 'remainder' | 'value' } = {}): PolyGrade {
  const m = build(f, c)
  if (!m) return { verdict: 'unsupported', message: UNSUPPORTED }
  const ask = options.ask ?? 'remainder'
  // "none" / "no remainder" is the number 0.
  const her = readNumber(/^\s*(?:none|no remainder|nothing|zero)\s*$/i.test(answer ?? '') ? '0' : answer)
  if (!her.ok) return invalidParse(her.error)
  const explanation = m.explanation
  const C = rp(m.c)
  const check = `f(${C}) = ${pretty(m.substitution)} = ${rp(m.remainder)}`
  if (same(her.value, m.remainder)) {
    return {
      verdict: 'correct',
      message:
        ask === 'value'
          ? `Correct: ${check}, the last number of the bottom row ${rowPretty(m.bottom)}.`
          : `Correct: the remainder is ${rp(m.remainder)}, the last number of the bottom row ${rowPretty(m.bottom)}. (Remainder theorem: ${check}.)`,
      explanation,
    }
  }
  if (her.value) {
    const hit = remainderCandidates(m, ask).find((k) => same(k.value, her.value))
    if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  }
  const hers = her.value ? rp(her.value) : pretty(her.text)
  return {
    verdict: 'wrong',
    message:
      ask === 'value'
        ? `${check}. It is also the last number of the bottom row when you divide by ${pretty(m.divisor)}. Your answer, ${hers}, is not ${rp(m.remainder)}.`
        : `The remainder is the last number of the bottom row, ${rp(m.remainder)}. Check with the remainder theorem: ${check}. Your answer, ${hers}, is not ${rp(m.remainder)}.`,
    explanation,
  }
}

const YES = /^(?:y|yes|true|factor|is a factor|it is|it is a factor)$/i
const NO = /^(?:n|no|false|not a factor|is not a factor|it is not|it is not a factor)$/i

/**
 * Factor theorem: is x − c a factor of f? `answer` is true/false or "yes"/"no". A wrong answer that is
 * what testing the opposite number −c gives is named `sd_wrong_sign_c`.
 */
export function gradeIsFactor(f: PolyInput, c: RatLike, answer: boolean | string): PolyGrade {
  return checked(() => gradeIsFactorUnchecked(f, c, answer))
}

function gradeIsFactorUnchecked(f: PolyInput, c: RatLike, answer: boolean | string): PolyGrade {
  const m = build(f, c)
  if (!m) return { verdict: 'unsupported', message: UNSUPPORTED }
  let her: boolean
  if (typeof answer === 'boolean') her = answer
  else {
    const t = (answer ?? '').trim()
    if (YES.test(t)) her = true
    else if (NO.test(t)) her = false
    else return { verdict: 'invalid', reason: 'unreadable', message: 'Answer yes or no.' }
  }
  const explanation = m.explanation
  const D = pretty(m.divisor)
  const C = rp(m.c)
  const fact = `f(${C}) = ${pretty(m.substitution)} = ${rp(m.remainder)}`
  if (her === m.isFactor) {
    return {
      verdict: 'correct',
      message: m.isFactor
        ? `Correct: ${fact}, so ${D} is a factor (factor theorem): f(x) = (${D})(${polyPretty(m.quotient)}).`
        : `Correct: ${fact}, which is not 0, so ${D} is not a factor (factor theorem).`,
      explanation,
    }
  }
  const opposite = valueAt(m.poly, ratNeg(m.c))
  if (m.c.n !== 0 && (opposite.n === 0) !== m.isFactor) {
    return {
      verdict: 'mistake',
      mistake: 'sd_wrong_sign_c',
      witness: `${D} is 0 at x = ${C}, so the number to test is ${C}: ${fact}${m.isFactor ? '' : ', not 0'}. Testing ${rp(ratNeg(m.c))} gives f(${rp(ratNeg(m.c))}) = ${rp(opposite)}, which answers the question for ${pretty(xMinus(ratNeg(m.c)))} instead.`,
      explanation,
    }
  }
  return {
    verdict: 'wrong',
    message: m.isFactor
      ? `${fact}. A remainder of 0 means ${D} divides f(x) evenly, so it IS a factor.`
      : `${fact}. The remainder is not 0, so ${D} does not divide f(x) evenly: it is not a factor.`,
    explanation,
  }
}

// ---------------------------------------------------------------------------
// Setting up the coefficient row
// ---------------------------------------------------------------------------

/**
 * Grade the top row she sets up before dividing: f's coefficients from the highest power down, with a 0
 * for every missing power ("2, -3, 0, -5", or one string per box). Leaving a placeholder out is named
 * `sd_missing_placeholder`; other slips get a plain sentence that points at the entry without giving it away.
 */
export function gradeCoefficientRow(f: PolyInput, answer: string | readonly string[]): PolyGrade {
  return checked(() => {
    const src = readPoly(f)
    if (!src || polyDeg(src.poly) < 1) return { verdict: 'unsupported', message: UNSUPPORTED }
    const her = readRow(answer, 'coefficient row')
    if (!her.ok) return invalidRow(her)
    const n = polyDeg(src.poly)
    const cs = descending(src.poly)
    const missing = cs.map((v, i) => (v.n === 0 ? n - i : -1)).filter((p) => p >= 0)
    const F = pretty(src.text)
    const explanation = [
      `f(x) = ${F} has degree ${n}, so the row has ${n + 1} numbers: the coefficient of each power from ${powerText(n)} down to the constant term.`,
      missing.length
        ? `There is no ${joinAnd(missing.map(termName))}, so ${missing.length === 1 ? 'its place gets' : 'their places get'} a 0: ${rowPretty(cs)}.`
        : `No power is missing: ${rowPretty(cs)}.`,
    ]
    if (sameRow(her.values, cs)) {
      return {
        verdict: 'correct',
        message: missing.length
          ? `Correct: ${rowPretty(cs)} (the 0 holds the place of the missing ${joinAnd(missing.map(termName))}).`
          : `Correct: ${rowPretty(cs)}.`,
        explanation,
      }
    }
    const zeroAt = cs.map((v, i) => (v.n === 0 ? i : -1)).filter((i) => i > 0)
    for (const drop of subsets(zeroAt)) {
      if (!sameRow(her.values, cs.filter((_v, i) => !drop.includes(i)))) continue
      const powers = drop.map((i) => termName(n - i))
      return {
        verdict: 'mistake',
        mistake: 'sd_missing_placeholder',
        witness: `f(x) = ${F} has no ${joinAnd(powers)}. ${drop.length === 1 ? 'Its place still needs' : 'Their places still need'} a 0 in the row, or every later number lines up with the wrong power: a degree-${n} polynomial has ${n + 1} coefficients, and your row has ${her.values.length}.`,
        explanation,
      }
    }
    if (her.values.length !== n + 1) {
      return {
        verdict: 'wrong',
        message: `f(x) has degree ${n}, so the row has ${n + 1} numbers: one for each power from ${powerText(n)} down to the constant term (a 0 for a power that is missing). You gave ${her.values.length}.`,
        explanation,
      }
    }
    if (sameRow(her.values, [...cs].reverse())) {
      return { verdict: 'wrong', message: `Start with the highest power: the first number is the coefficient of ${powerText(n)}, and the constant term comes last. Your row is in the opposite order.`, explanation }
    }
    const i = her.values.findIndex((v, j) => !same(v, cs[j]))
    const flipped = same(her.values[i], ratNeg(cs[i]!))
    return {
      verdict: 'wrong',
      message: `Check the ${ordinal(i + 1)} number: it is the coefficient of the ${termName(n - i)} in f(x) = ${F}${flipped ? ', sign included' : cs[i]!.n === 0 ? ' (that power is missing)' : ''}.`,
      explanation,
    }
  })
}
