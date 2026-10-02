/**
 * Zeros, multiplicity and end behavior of a polynomial given in factored form, lead·Π(p·x + q)^m with
 * linear factors and rational numbers, e.g. -2(x + 1)^2(x - 3)(x - 1/2)^3; and writing the polynomial of
 * least degree from its zeros, their multiplicities and one more point.
 *
 * Everything is exact. Named mistakes (sample f(x) = −2(x + 1)^2(x − 3)(x − 1/2)^3 unless noted):
 *  - zero_sign_reversed:       (x + 1) read as the zero 1
 *  - zero_nonmonic_factor:     (2x − 1) read as the zero 1 (or −1, or 2): the 2 was not divided out
 *  - multiplicity_ignored:     every zero given multiplicity 1
 *  - multiplicity_wrong_zero:  the right exponents on the wrong zeros
 *  - cross_touch_swapped:      "crosses" at an even multiplicity, "touches" at an odd one
 *  - end_sign_ignored:         ends taken from the degree alone (as if the leading coefficient were positive)
 *  - end_parity_swapped:       the even-degree pattern used for an odd degree, or the reverse
 *  - lead_coefficient_omitted: a left out (or left as 1) where the extra point fixes it
 */
import type { Rational } from '@/shared/types'
import { rat, ratAbs, ratCompare, ratDiv, ratMul, ratNeg } from '@/notation/rational'
import { collectVars, isOp, isUnaryMinus, nodeArgs, type MathNode } from '../math'
import { parseFunction } from '../functions/common'
import { exactConstant } from '../functions/exact'
import { polyDeg, polyEquals, polyLead, polyMul, polyOf, polyPow, polyScale, polyToText, P_ONE, type Poly } from '../functions/poly'
import { substituteValueText } from '../functions/text'
import { parsePointAnswer } from '../transformations/points'
import { coefPrefix, isOne, pointPretty, rf, rp, rt, signedTerm, toPoint, toRational } from '../transformations/text'
import type { ExactPoint, RatLike } from '../transformations/types'
import {
  checked,
  dedupeCandidates,
  guard,
  invalidParse,
  joinAnd,
  parityWord,
  plain,
  polyPretty,
  pretty,
  ratKey,
  readFormula,
  readNumber,
  readPoly,
  same,
  splitList,
  valueAt,
} from './common'
import type {
  BuiltPolynomial,
  CrossTouch,
  CrossTouchCheck,
  EndBehavior,
  EndDirection,
  EndMistakeCandidate,
  FactoredAnalysis,
  FactoredPoly,
  FactoredSource,
  FactorInput,
  FormulaMistakeCandidate,
  LinearFactor,
  NumberMistakeCandidate,
  PolyGrade,
  PolyInput,
  PolyMistakeKind,
  ZeroAnswer,
  ZeroInfo,
  ZeroMistakeCandidate,
  ZerosSpec,
} from './types'

// ---------------------------------------------------------------------------
// Building and reading a factored polynomial
// ---------------------------------------------------------------------------

/**
 * lead·Π factors. A factor is given by its zero ({ zero: '1/2', mult: 3 } is (x − 1/2)^3) or by its two
 * numbers ({ coef: 2, constant: -1 } is (2x − 1)). Throws RangeError for lead = 0, coef = 0, a multiplicity
 * that is not a positive integer, no factors, or an unreadable number (a template bug).
 */
export function makeFactored(lead: RatLike, factors: readonly FactorInput[]): FactoredPoly {
  const l = toRational(lead)
  if (!l || l.n === 0) throw new RangeError(`makeFactored: the leading number must be a nonzero number, got ${String(lead)}`)
  if (!factors.length) throw new RangeError('makeFactored: at least one factor is needed')
  const out: LinearFactor[] = []
  for (const f of factors) {
    const mult = f.mult ?? 1
    if (!Number.isInteger(mult) || mult < 1) throw new RangeError(`makeFactored: multiplicity ${String(mult)} is not a positive integer`)
    let coef: Rational | null
    let constant: Rational | null
    if ('zero' in f) {
      const z = toRational(f.zero)
      coef = rat(1)
      constant = z ? ratNeg(z) : null
    } else {
      coef = toRational(f.coef)
      constant = toRational(f.constant)
    }
    if (!coef || !constant || coef.n === 0) throw new RangeError('makeFactored: a factor needs readable numbers and a nonzero x-coefficient')
    out.push({ coef, constant, mult })
  }
  return { lead: l, factors: mergeFactors(out) }
}

/** The same factor written twice becomes one factor with the multiplicities added. */
function mergeFactors(factors: readonly LinearFactor[]): LinearFactor[] {
  const out: LinearFactor[] = []
  for (const f of factors) {
    const twin = out.find((o) => same(o.coef, f.coef) && same(o.constant, f.constant))
    if (twin) twin.mult += f.mult
    else out.push({ ...f })
  }
  return out
}

function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

function ratPow(r: Rational, n: number): Rational {
  let out = rat(1)
  for (let i = 0; i < n; i++) out = ratMul(out, r)
  return out
}

/** Walks a product tree, collecting constants into `acc.lead` and linear factors into `acc.factors`. */
function walkProduct(node: MathNode, power: number, acc: { lead: Rational; factors: LinearFactor[] }): boolean {
  const n = unwrap(node)
  const args = nodeArgs(n)
  if (!collectVars(n).length) {
    const v = guard(() => exactConstant(n))
    if (!v || v.n === 0) return false
    acc.lead = ratMul(acc.lead, ratPow(v, power))
    return true
  }
  if (isUnaryMinus(n)) {
    if (power % 2 === 1) acc.lead = ratNeg(acc.lead)
    return walkProduct(args[0]!, power, acc)
  }
  if (isOp(n, '*') && args.length === 2) return walkProduct(args[0]!, power, acc) && walkProduct(args[1]!, power, acc)
  if (isOp(n, '/') && args.length === 2) {
    if (collectVars(args[1]!).length) return false
    const d = guard(() => exactConstant(args[1]!))
    if (!d || d.n === 0) return false
    acc.lead = ratDiv(acc.lead, ratPow(d, power))
    return walkProduct(args[0]!, power, acc)
  }
  if (isOp(n, '^') && args.length === 2) {
    if (collectVars(args[1]!).length) return false
    const e = guard(() => exactConstant(args[1]!))
    if (!e || e.d !== 1 || e.n < 1 || e.n * power > 12) return false
    return walkProduct(args[0]!, power * e.n, acc)
  }
  const p = guard(() => polyOf(n))
  if (!p || polyDeg(p) !== 1) return false
  acc.factors.push({ coef: p[1]!, constant: p[0]!, mult: power })
  return true
}

/**
 * Reads a factored polynomial from its text: a product of numbers and powers of linear factors,
 * "-2(x + 1)^2(x - 3)(x - 1/2)^3", "x^2(2x - 1)", "(3 - x)(x + 4)^2/2". Null for anything else (a sum such as
 * x^2 - 4, a quadratic factor, a constant).
 */
export function parseFactored(text: string): FactoredPoly | null {
  const p = parseFunction(text ?? '')
  if (!p.ok) return null
  return guard(() => {
    const acc = { lead: rat(1), factors: [] as LinearFactor[] }
    if (!walkProduct(p.node, 1, acc) || !acc.factors.length) return null
    return { lead: acc.lead, factors: mergeFactors(acc.factors) }
  })
}

function validFactored(fp: FactoredPoly): boolean {
  return (
    !!fp &&
    !!toRational(fp.lead) &&
    fp.lead.n !== 0 &&
    Array.isArray(fp.factors) &&
    fp.factors.length > 0 &&
    fp.factors.every((f) => !!toRational(f.coef) && !!toRational(f.constant) && f.coef.n !== 0 && Number.isInteger(f.mult) && f.mult >= 1)
  )
}

function resolve(source: FactoredSource): FactoredPoly | null {
  if (typeof source === 'string') return parseFactored(source)
  return validFactored(source) ? { lead: source.lead, factors: mergeFactors(source.factors) } : null
}

/** "x + 1", "2x - 1", "-x + 3", "(1/2)x + 2", "x": the inside of a factor (app syntax). */
function linearText(f: LinearFactor): string {
  const lead = isOne(f.coef) ? 'x' : `${coefPrefix(f.coef)}x`
  return `${lead}${signedTerm(f.constant)}`
}

/** "(x + 1)^2", "(2x - 1)", "x^3", "x": one factor as it is written (app syntax). */
function factorText(f: LinearFactor): string {
  const bare = isOne(f.coef) && f.constant.n === 0
  const base = bare ? 'x' : `(${linearText(f)})`
  return f.mult === 1 ? base : `${base}^${f.mult}`
}

/** The product of the factors without the number in front. */
function bodyText(factors: readonly LinearFactor[]): string {
  return factors.map(factorText).join('')
}

/** "-2(x + 1)^2(x - 3)(x - 1/2)^3" (app syntax; `parseFactored` reads it back). */
export function factoredFormText(fp: FactoredPoly): string {
  return `${coefPrefix(fp.lead)}${bodyText(fp.factors)}`
}

function bodyPoly(factors: readonly LinearFactor[]): Poly {
  let out: Poly = P_ONE
  for (const f of factors) out = polyMul(out, polyPow([f.constant, f.coef], f.mult))
  return out
}

function expand(fp: FactoredPoly): Poly {
  return polyScale(bodyPoly(fp.factors), fp.lead)
}

/** The factored polynomial multiplied out, standard form (app syntax); null when it is too large for exact arithmetic. */
export function expandFactored(source: FactoredSource): string | null {
  const fp = resolve(source)
  return fp ? guard(() => polyToText(expand(fp))) : null
}

function zeroOf(f: LinearFactor): Rational {
  return ratNeg(ratDiv(f.constant, f.coef))
}

/** The ends of a polynomial of this degree (≥ 1) and leading coefficient. */
export function endBehaviorOf(degree: number, leadingCoefficient: RatLike): EndBehavior {
  const lead = toRational(leadingCoefficient)
  if (!lead || lead.n === 0 || !Number.isInteger(degree) || degree < 1) throw new RangeError('endBehaviorOf: needs a degree of 1 or more and a nonzero leading coefficient')
  const right: EndDirection = lead.n > 0 ? 'up' : 'down'
  const left: EndDirection = degree % 2 === 0 ? right : right === 'up' ? 'down' : 'up'
  return { left, right }
}

function arrow(d: EndDirection): string {
  return d === 'up' ? '∞' : '−∞'
}

function endSentence(end: EndBehavior): string {
  return `As x → −∞, f(x) → ${arrow(end.left)}; as x → ∞, f(x) → ${arrow(end.right)}.`
}

// ---------------------------------------------------------------------------
// The analysis
// ---------------------------------------------------------------------------

interface Model extends FactoredAnalysis {
  poly: Poly
  /** The factors grouped by zero, in the order of `zeros`. */
  groups: LinearFactor[][]
}

function build(source: FactoredSource): Model | null {
  const fp = resolve(source)
  if (!fp) return null
  return guard(() => {
    const poly = expand(fp)
    const degree = fp.factors.reduce((s, f) => s + f.mult, 0)
    const leadingCoefficient = polyLead(poly)
    const byZero = new Map<string, { zero: Rational; factors: LinearFactor[] }>()
    for (const f of fp.factors) {
      const z = zeroOf(f)
      const g = byZero.get(ratKey(z))
      if (g) g.factors.push(f)
      else byZero.set(ratKey(z), { zero: z, factors: [f] })
    }
    const sorted = [...byZero.values()].sort((x, y) => ratCompare(x.zero, y.zero))
    const zeros: ZeroInfo[] = sorted.map((g) => {
      const mult = g.factors.reduce((s, f) => s + f.mult, 0)
      return { zero: g.zero, text: rt(g.zero), mult, behavior: mult % 2 === 0 ? 'touches' : 'crosses', factor: g.factors.map(factorText).join('') }
    })
    const end = endBehaviorOf(degree, leadingCoefficient)
    const text = factoredFormText(fp)
    const yIntercept = valueAt(poly, rat(0))
    const allMonic = fp.factors.every((f) => isOne(f.coef))
    const exps = fp.factors.map((f) => `${f.mult}`).join(' + ')
    const parity = parityWord(degree)

    const explanation: string[] = []
    for (const z of zeros) {
      const g = sorted.find((s) => same(s.zero, z.zero))!
      const f0 = g.factors[0]!
      const solve = isOne(f0.coef)
        ? f0.constant.n === 0
          ? 'it is 0 when x = 0'
          : `${pretty(linearText(f0))} = 0 when x = ${rp(z.zero)}`
        : `${pretty(linearText(f0))} = 0 gives ${pretty(`${coefPrefix(f0.coef)}x`)} = ${rp(ratNeg(f0.constant))}, so x = ${rp(z.zero)}`
      explanation.push(
        `${pretty(z.factor)}: ${solve}. The exponent is ${z.mult}, so the multiplicity is ${z.mult} (${parityWord(z.mult)}): the graph ${z.behavior === 'crosses' ? 'crosses the x-axis' : 'touches the x-axis and turns back'} there.`,
      )
    }
    explanation.push(
      fp.factors.length > 1 ? `Degree: add the exponents, ${exps} = ${degree} (${parity}).` : `Degree: ${degree} (${parity}), the exponent of the factor.`,
    )
    explanation.push(
      allMonic
        ? `Leading coefficient: ${rp(leadingCoefficient)}${isOne(fp.lead) ? ' (every factor starts with x and there is no number in front)' : ', the number in front (every factor starts with x)'}.`
        : `Leading coefficient: multiply the number in front by the x-coefficient of each factor, raised to its exponent: ${[rf(fp.lead), ...fp.factors.filter((f) => !isOne(f.coef)).map((f) => (f.mult === 1 ? rf(f.coef) : `${rf(f.coef)}^${f.mult}`))].join('·')} = ${rp(leadingCoefficient)}.`,
    )
    explanation.push(
      `${degree % 2 === 0 ? 'Even degree: both ends go the same way' : 'Odd degree: the ends go opposite ways'}. ${leadingCoefficient.n > 0 ? 'Positive' : 'Negative'} leading coefficient: the right end goes ${end.right}${degree % 2 === 0 ? `, and so does the left` : `, so the left end goes ${end.left}`}. ${endSentence(end)}`,
    )
    explanation.push(`y-intercept: f(0) = ${pretty(substituteValueText(text, '0'))} = ${rp(yIntercept)}.`)

    return {
      poly,
      groups: sorted.map((g) => g.factors),
      text,
      factored: fp,
      zeros,
      degree,
      leadingCoefficient,
      end,
      endText: endSentence(end),
      yIntercept,
      expandedText: polyToText(poly),
      explanation,
    }
  })
}

/**
 * Zeros with multiplicities (ascending), cross/touch at each, degree, leading coefficient, end behavior,
 * y-intercept and the explanation. Null when the source is not a product of linear factors.
 */
export function analyzeFactored(source: FactoredSource): FactoredAnalysis | null {
  const m = build(source)
  if (!m) return null
  const { poly: _poly, groups: _groups, ...rest } = m
  void _poly
  void _groups
  return rest
}

const NOT_FACTORED = 'This problem needs a polynomial written as a product of linear factors, like -2(x + 1)^2(x - 3).'

// ---------------------------------------------------------------------------
// Zeros
// ---------------------------------------------------------------------------

interface Reading {
  kind: PolyMistakeKind
  factor: LinearFactor
  zero: Rational
  wrong: Rational
  witness: string
}

/** The wrong zeros one factor can be read as. */
function readingsOf(f: LinearFactor): Reading[] {
  const z = zeroOf(f)
  const lin = pretty(linearText(f))
  const monic = isOne(f.coef)
  const F = pretty(factorText({ ...f, mult: 1 }))
  const solved = monic
    ? `${F} is 0 when ${lin} = 0, so x = ${rp(z)}`
    : `Set the factor equal to 0 and solve: ${lin} = 0, ${pretty(`${coefPrefix(f.coef)}x`)} = ${rp(ratNeg(f.constant))}, x = ${rp(z)}`
  const out: Reading[] = []
  if (z.n !== 0) {
    out.push({
      kind: 'zero_sign_reversed',
      factor: f,
      zero: z,
      wrong: ratNeg(z),
      witness: monic
        ? `${solved}, not ${rp(ratNeg(z))}: the zero has the opposite sign to the number in the factor.`
        : `${solved}. Your ${rp(ratNeg(z))} has the sign backwards.`,
    })
  }
  if (!isOne(ratAbs(f.coef)) && f.constant.n !== 0) {
    for (const wrong of [ratNeg(f.constant), f.constant]) {
      out.push({ kind: 'zero_nonmonic_factor', factor: f, zero: z, wrong, witness: `${solved}. Your ${rp(wrong)} ignores the ${rp(f.coef)} in front of x.` })
    }
    const inverted = ratNeg(ratDiv(f.coef, f.constant))
    out.push({ kind: 'zero_nonmonic_factor', factor: f, zero: z, wrong: inverted, witness: `${solved}. Your ${rp(inverted)} divides the wrong way round.` })
  }
  return out
}

/**
 * The wrong zero each factor can be misread as, factor by factor in the order written. A reading equal to
 * the factor's own zero or to ANOTHER zero of the polynomial is left out (it cannot be seen in her list);
 * two readings of one factor giving the same number share an entry (`shadows`). Null outside the model.
 */
export function zeroMistakes(source: FactoredSource): ZeroMistakeCandidate[] | null {
  const m = build(source)
  if (!m) return null
  const out: ZeroMistakeCandidate[] = []
  for (const f of m.factored.factors) {
    const raw = readingsOf(f).map((r) => ({ kind: r.kind, factor: factorText(f), zero: r.zero, wrong: r.wrong, text: rt(r.wrong), witness: r.witness, shadows: [] as PolyMistakeKind[] }))
    out.push(
      ...dedupeCandidates(
        raw,
        (r) => m.zeros.some((z) => same(z.zero, r.wrong)),
        (u, v) => same(u.wrong, v.wrong),
      ),
    )
  }
  return out
}

interface Entry {
  zero: Rational | null
  zeroText: string
  mult: number | null
}

function zeroList(m: Model): string {
  return joinAnd(m.zeros.map((z) => `x = ${rp(z.zero)} (multiplicity ${z.mult})`))
}

/**
 * Grade her zeros. `answer` is one row per zero ({ zero, mult }) or a plain list "-1, 3, 1/2" (zeros only,
 * graded as a set). Multiplicities are graded when any row has one. The zeros are checked first (a wrong
 * zero that is a misreading of a factor is named), then the multiplicities.
 */
export function gradeZeros(source: FactoredSource, answer: string | readonly ZeroAnswer[]): PolyGrade {
  return checked(() => gradeZerosUnchecked(source, answer))
}

function gradeZerosUnchecked(source: FactoredSource, answer: string | readonly ZeroAnswer[]): PolyGrade {
  const m = build(source)
  if (!m) return { verdict: 'unsupported', message: NOT_FACTORED }
  const hasMult = (r: { mult?: string | number }): boolean => r.mult !== undefined && `${r.mult}`.trim() !== ''
  const rows: { zero: string; mult?: string | number; start: number }[] =
    typeof answer === 'string' ? splitList(plain(answer)).map((it) => ({ zero: it.text, start: it.start })) : answer.map((r) => ({ zero: r.zero ?? '', mult: r.mult, start: 0 }))
  if (!rows.length || rows.every((r) => !r.zero.trim())) return { verdict: 'invalid', reason: 'unreadable', message: 'Type the zeros first, like -1, 3, 1/2.' }
  const withMult = rows.some(hasMult)
  const entries: Entry[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!
    // A row of the table she left completely blank is not an answer (`index` keeps counting her rows).
    if (typeof answer !== 'string' && !r.zero.trim() && !hasMult(r)) continue
    const label = r.zero.match(/^\s*x\s*=/i)
    const body = label ? r.zero.slice(label[0].length) : r.zero
    if (!body.trim()) return { verdict: 'invalid', reason: 'unreadable', message: `Zero ${i + 1} is empty: type a number, or remove the row.`, index: i }
    const n = readNumber(plain(body))
    if (!n.ok) return invalidParse({ ...n.error, position: n.error.position + r.start + (label ? label[0].length : 0) }, i)
    let mult: number | null = null
    if (withMult) {
      const t = `${r.mult ?? ''}`.trim()
      const v = t ? readNumber(t) : null
      if (!v || !v.ok || !v.value || v.value.d !== 1 || v.value.n < 1) {
        return { verdict: 'invalid', reason: 'unreadable', message: `The multiplicity of zero ${i + 1} must be a positive whole number (the exponent on its factor).`, index: i }
      }
      mult = v.value.n
    }
    if (n.value && entries.some((e) => same(e.zero, n.value))) {
      if (withMult) return { verdict: 'invalid', reason: 'unreadable', message: `You listed ${rp(n.value)} twice: give each zero once, with its multiplicity.`, index: i }
      continue
    }
    entries.push({ zero: n.value, zeroText: n.value ? rp(n.value) : pretty(n.text), mult })
  }

  const explanation = m.explanation
  const extras = entries.filter((e) => !m.zeros.some((z) => same(z.zero, e.zero)))
  const missing = m.zeros.map((z, i) => ({ z, group: m.groups[i]! })).filter(({ z }) => !entries.some((e) => same(e.zero, z.zero)))

  if (extras.length || missing.length) {
    // A wrong zero of hers that is a misreading of a factor she has no zero for.
    const hits: Reading[] = []
    for (const e of extras) {
      if (!e.zero) continue
      const hit = missing.flatMap(({ group }) => group.flatMap(readingsOf)).find((r) => same(r.wrong, e.zero) && !hits.some((h) => h.factor === r.factor))
      if (hit) hits.push(hit)
    }
    const first = hits[0]
    if (first) {
      const more = hits.slice(1).filter((h) => h.kind === first.kind)
      const also = more.length ? ` The same goes for ${joinAnd(more.map((h) => `${pretty(factorText({ ...h.factor, mult: 1 }))} (x = ${rp(h.zero)}, not ${rp(h.wrong)})`))}.` : ''
      return { verdict: 'mistake', mistake: first.kind, witness: `${first.witness}${also}`, explanation }
    }
    const parts: string[] = []
    const e = extras[0]
    if (e) {
      parts.push(e.zero ? `x = ${e.zeroText} is not a zero: f(${e.zeroText}) = ${rp(valueAt(m.poly, e.zero))}, not 0.` : `${e.zeroText} is not a zero of f(x).`)
    }
    const miss = missing[0]
    if (miss) {
      parts.push(
        missing.length === 1
          ? `You are missing the zero that comes from the factor ${pretty(miss.z.factor)}.`
          : `You are missing ${missing.length} zeros: every factor gives one (set ${joinAnd(missing.map((x) => pretty(factorText({ ...x.group[0]!, mult: 1 }))))} equal to 0).`,
      )
    }
    return { verdict: 'wrong', message: parts.join(' '), explanation }
  }

  // The zeros are right.
  if (!withMult) return { verdict: 'correct', message: `Correct: the zeros are ${joinAnd(m.zeros.map((z) => rp(z.zero)))}.`, explanation }
  const multOf = (z: ZeroInfo): number => entries.find((e) => same(e.zero, z.zero))!.mult!
  const wrong = m.zeros.filter((z) => multOf(z) !== z.mult)
  if (!wrong.length) return { verdict: 'correct', message: `Correct: ${zeroList(m)}.`, explanation }
  const first = wrong[0]!
  if (wrong.every((z) => multOf(z) === 1)) {
    return {
      verdict: 'mistake',
      mistake: 'multiplicity_ignored',
      witness: `The multiplicity of a zero is the exponent on its factor: ${pretty(first.factor)} gives x = ${rp(first.zero)} multiplicity ${first.mult}, not 1.`,
      explanation,
    }
  }
  const hers = m.zeros.map(multOf).sort((x, y) => x - y)
  const right = m.zeros.map((z) => z.mult).sort((x, y) => x - y)
  if (hers.every((v, i) => v === right[i])) {
    return {
      verdict: 'mistake',
      mistake: 'multiplicity_wrong_zero',
      witness: `Each exponent belongs to the zero of its own factor: ${joinAnd(m.zeros.map((z) => `${pretty(z.factor)} gives x = ${rp(z.zero)} multiplicity ${z.mult}`))}. You gave x = ${rp(first.zero)} multiplicity ${multOf(first)}, the exponent of a different factor.`,
      explanation,
    }
  }
  return {
    verdict: 'wrong',
    message: `Your zeros are right. The multiplicity of x = ${rp(first.zero)} is the exponent on its factor ${pretty(first.factor)}: ${first.mult}, not ${multOf(first)}.`,
    explanation,
  }
}

// ---------------------------------------------------------------------------
// Crosses or touches
// ---------------------------------------------------------------------------

function readCrossTouch(v: string): CrossTouch | null {
  const t = (v ?? '').trim().toLowerCase()
  if (/^(?:cross|crosses|crossing|goes through|passes through|through)$/.test(t)) return 'crosses'
  if (/^(?:touch|touches|touching|bounce|bounces|bouncing|turns|turns around|turns back|tangent)$/.test(t)) return 'touches'
  return null
}

function crossTouchSentence(z: ZeroInfo, chosen: CrossTouch): string {
  const fact = `${pretty(z.factor)} gives x = ${rp(z.zero)} multiplicity ${z.mult}, which is ${parityWord(z.mult)}`
  if (z.behavior === chosen) return `${fact}: the graph ${chosen === 'crosses' ? 'crosses the x-axis' : 'touches the x-axis and turns back'}.`
  return z.behavior === 'touches'
    ? `${fact}. An even power never changes sign, so the graph touches the x-axis at x = ${rp(z.zero)} and turns back; it does not cross.`
    : `${fact}. An odd power changes sign, so the graph crosses the x-axis at x = ${rp(z.zero)}; it does not turn back.`
}

/**
 * Grade her crosses/touches choice for every zero. `choices` is in the order of `analyzeFactored(...).zeros`
 * (ascending); each is 'crosses' or 'touches' (also "cross", "touch", "bounces"). `checks` has one entry per
 * zero. Any wrong choice is the swap of the rule (even multiplicity touches, odd crosses).
 */
export function gradeCrossTouch(source: FactoredSource, choices: readonly string[]): PolyGrade & { checks?: CrossTouchCheck[] } {
  return checked(() => gradeCrossTouchUnchecked(source, choices))
}

function gradeCrossTouchUnchecked(source: FactoredSource, choices: readonly string[]): PolyGrade & { checks?: CrossTouchCheck[] } {
  const m = build(source)
  if (!m) return { verdict: 'unsupported', message: NOT_FACTORED }
  if (choices.length !== m.zeros.length) {
    return { verdict: 'invalid', reason: 'unreadable', message: `Choose crosses or touches for each of the ${m.zeros.length} zeros.` }
  }
  const checks: CrossTouchCheck[] = []
  for (let i = 0; i < choices.length; i++) {
    const chosen = readCrossTouch(choices[i]!)
    if (!chosen) return { verdict: 'invalid', reason: 'unreadable', message: `Choose crosses or touches for x = ${rp(m.zeros[i]!.zero)}.`, index: i }
    const z = m.zeros[i]!
    checks.push({ zero: z.zero, mult: z.mult, expected: z.behavior, chosen, ok: chosen === z.behavior, message: crossTouchSentence(z, chosen) })
  }
  const explanation = m.explanation
  const bad = checks.filter((c) => !c.ok)
  if (!bad.length) {
    return {
      verdict: 'correct',
      message: `Correct: ${joinAnd(m.zeros.map((z) => `${z.behavior} at x = ${rp(z.zero)} (multiplicity ${z.mult})`))}.`,
      explanation,
      checks,
    }
  }
  return {
    verdict: 'mistake',
    mistake: 'cross_touch_swapped',
    witness: `${bad[0]!.message}${bad.length > 1 ? ` The same rule decides ${joinAnd(bad.slice(1).map((c) => `x = ${rp(c.zero)}`))}: even multiplicity touches, odd multiplicity crosses.` : ''}`,
    explanation,
    checks,
  }
}

// ---------------------------------------------------------------------------
// End behavior
// ---------------------------------------------------------------------------

interface Shape {
  degree: number
  lead: Rational
  /** Number of written factors and their exponents, when the source is factored. */
  factors: LinearFactor[] | null
  explanation: string[]
}

/** Degree and leading coefficient from a factored form, or from any polynomial text. */
function shapeOf(source: FactoredSource | PolyInput): Shape | null {
  if (typeof source === 'string' || !Array.isArray(source)) {
    const m = build(source as FactoredSource)
    if (m) return { degree: m.degree, lead: m.leadingCoefficient, factors: m.factored.factors, explanation: m.explanation.slice(m.zeros.length, m.zeros.length + 3) }
    if (typeof source !== 'string') return null
  }
  const src = readPoly(source as PolyInput)
  if (!src || polyDeg(src.poly) < 1) return null
  const degree = polyDeg(src.poly)
  const lead = polyLead(src.poly)
  const end = endBehaviorOf(degree, lead)
  return {
    degree,
    lead,
    factors: null,
    explanation: [
      `The leading term of ${pretty(src.text)} decides the ends: degree ${degree} (${parityWord(degree)}), leading coefficient ${rp(lead)}.`,
      `${degree % 2 === 0 ? 'Even degree: both ends go the same way' : 'Odd degree: the ends go opposite ways'}. ${lead.n > 0 ? 'Positive' : 'Negative'} leading coefficient: the right end goes ${end.right}${degree % 2 === 0 ? ', and so does the left' : `, so the left end goes ${end.left}`}. ${endSentence(end)}`,
    ],
  }
}

function readEnd(v: string): EndDirection | null {
  const t = plain(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (/^(?:up|rises|rise|\+ ?(?:inf|infinity|oo)|inf|infinity|oo|positive infinity|to infinity)$/.test(t)) return 'up'
  if (/^(?:down|falls|fall|- ?(?:inf|infinity|oo)|negative infinity|to negative infinity)$/.test(t)) return 'down'
  return null
}

function flip(d: EndDirection): EndDirection {
  return d === 'up' ? 'down' : 'up'
}

function endCandidates(s: Shape): EndMistakeCandidate[] {
  const right = endBehaviorOf(s.degree, s.lead)
  const even = s.degree % 2 === 0
  const sum = s.factors && s.factors.length > 1 ? ` (add the exponents: ${s.factors.map((f) => f.mult).join(' + ')} = ${s.degree})` : ''
  const countNote = s.factors && s.factors.length > 1 && s.factors.length % 2 !== s.degree % 2 ? ` Count the exponents, not the number of factors (${s.factors.length}).` : ''
  const raw: EndMistakeCandidate[] = [
    {
      kind: 'end_sign_ignored',
      end: endBehaviorOf(s.degree, rat(1)),
      witness: `The degree ${s.degree} (${parityWord(s.degree)}) says the two ends go ${even ? 'the same way' : 'opposite ways'}; the SIGN of the leading coefficient says which way. Here it is ${rp(s.lead)}, negative, so the right end goes down${even ? ' and so does the left' : ' and the left end goes up'}. Your answer is what a positive leading coefficient gives.`,
      shadows: [],
    },
    {
      kind: 'end_parity_swapped',
      end: { left: flip(right.left), right: right.right },
      witness: `The degree is ${s.degree}${sum}, which is ${parityWord(s.degree)}: ${even ? 'both ends go the same way' : 'the ends go opposite ways'}. Your answer ${even ? 'sends the ends opposite ways, the pattern of an odd degree' : 'sends both ends the same way, the pattern of an even degree'}.${countNote}`,
      shadows: [],
    },
  ]
  return dedupeCandidates(
    raw,
    (c) => c.end.left === right.left && c.end.right === right.right,
    (u, v) => u.end.left === v.end.left && u.end.right === v.end.right,
  )
}

/** The end behavior each slip gives; null outside the model. The source may be factored or standard form. */
export function endBehaviorMistakes(source: FactoredSource | PolyInput): EndMistakeCandidate[] | null {
  const s = shapeOf(source)
  return s ? endCandidates(s) : null
}

/**
 * Grade her two ends. `left` is where f(x) goes as x → −∞, `right` as x → ∞: 'up' / 'down' (also "inf",
 * "-inf", "∞", "−∞", "rises", "falls"). The source may be a factored polynomial or standard-form text.
 */
export function gradeEndBehavior(source: FactoredSource | PolyInput, answer: { left: string; right: string }): PolyGrade {
  return checked(() => gradeEndBehaviorUnchecked(source, answer))
}

function gradeEndBehaviorUnchecked(source: FactoredSource | PolyInput, answer: { left: string; right: string }): PolyGrade {
  const s = shapeOf(source)
  if (!s) return { verdict: 'unsupported', message: 'This problem needs a polynomial of degree 1 or more.' }
  const left = readEnd(answer?.left)
  const right = readEnd(answer?.right)
  if (!left || !right) {
    return { verdict: 'invalid', reason: 'unreadable', message: 'Choose up (f(x) → ∞) or down (f(x) → −∞) for each end.', index: left ? 1 : 0 }
  }
  const truth = endBehaviorOf(s.degree, s.lead)
  const explanation = s.explanation
  const even = s.degree % 2 === 0
  const summary = `degree ${s.degree} (${parityWord(s.degree)}) with a ${s.lead.n > 0 ? 'positive' : 'negative'} leading coefficient (${rp(s.lead)})`
  if (left === truth.left && right === truth.right) {
    return { verdict: 'correct', message: `Correct: ${summary}. ${endSentence(truth)}`, explanation }
  }
  const hit = endCandidates(s).find((c) => c.end.left === left && c.end.right === right)
  if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  return {
    verdict: 'wrong',
    message: `This polynomial has ${summary}. ${even ? 'Even degree: both ends go the same way.' : 'Odd degree: the ends go opposite ways.'} ${s.lead.n > 0 ? 'Positive' : 'Negative'} leading coefficient: the right end goes ${truth.right}.`,
    explanation,
  }
}

// ---------------------------------------------------------------------------
// y-intercept
// ---------------------------------------------------------------------------

function yInterceptCandidates(m: Model): NumberMistakeCandidate[] {
  const fp = m.factored
  const raw: NumberMistakeCandidate[] = []
  const work = `f(0) = ${pretty(substituteValueText(m.text, '0'))} = ${rp(m.yIntercept)}`
  const noLead = valueAt(bodyPoly(fp.factors), rat(0))
  raw.push({
    kind: 'lead_coefficient_omitted',
    value: noLead,
    text: rt(noLead),
    witness: `The ${rp(fp.lead)} in front multiplies everything: ${work}. Your ${rp(noLead)} is the product of the factors at x = 0 without it.`,
    shadows: [],
  })
  const flat = valueAt(expand({ lead: fp.lead, factors: fp.factors.map((f) => ({ ...f, mult: 1 })) }), rat(0))
  raw.push({
    kind: 'multiplicity_ignored',
    value: flat,
    text: rt(flat),
    witness: `Each factor is raised to its exponent before multiplying: ${work}. Your ${rp(flat)} uses every factor only once.`,
    shadows: [],
  })
  return dedupeCandidates(
    raw,
    (c) => same(c.value, m.yIntercept),
    (u, v) => same(u.value, v.value),
  )
}

/** The wrong y-intercept each slip gives (the number in front left out; the exponents ignored); null outside the model. */
export function yInterceptMistakes(source: FactoredSource): NumberMistakeCandidate[] | null {
  const m = build(source)
  return m ? yInterceptCandidates(m) : null
}

/** Grade her y-intercept: the number f(0), or the point "(0, f(0))". */
export function gradeYIntercept(source: FactoredSource, answer: string): PolyGrade {
  return checked(() => gradeYInterceptUnchecked(source, answer))
}

function gradeYInterceptUnchecked(source: FactoredSource, answer: string): PolyGrade {
  const m = build(source)
  if (!m) return { verdict: 'unsupported', message: NOT_FACTORED }
  const text = plain(answer)
  let value: Rational | null
  let shown: string
  if (text.includes(',')) {
    const pt = parsePointAnswer(text)
    if (!pt.ok) return invalidParse(pt.error)
    if (!pt.x || pt.x.n !== 0) {
      return { verdict: 'wrong', message: 'The y-intercept is where the graph meets the y-axis, so its x-coordinate is 0: the point (0, f(0)).', explanation: m.explanation }
    }
    value = pt.y
    shown = pretty(pt.yText)
  } else {
    const n = readNumber(text)
    if (!n.ok) return invalidParse(n.error)
    value = n.value
    shown = pretty(n.text)
  }
  const explanation = m.explanation
  const work = `f(0) = ${pretty(substituteValueText(m.text, '0'))} = ${rp(m.yIntercept)}`
  if (same(value, m.yIntercept)) return { verdict: 'correct', message: `Correct: ${work}, so the y-intercept is ${pointPretty({ x: rat(0), y: m.yIntercept })}.`, explanation }
  if (value) {
    const hit = yInterceptCandidates(m).find((c) => same(c.value, value))
    if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  }
  return { verdict: 'wrong', message: `Put x = 0 into every factor: ${work}. Your answer, ${value ? rp(value) : shown}, is not ${rp(m.yIntercept)}.`, explanation }
}

// ---------------------------------------------------------------------------
// A polynomial from its zeros
// ---------------------------------------------------------------------------

interface Built extends BuiltPolynomial {
  poly: Poly
  /** Π (x − z)^m, without a. */
  body: Poly
  zeros: { zero: Rational; mult: number }[]
}

/** r·a as display text: "−3a", "(3/2)a", "a", "−a". */
function timesA(r: Rational): string {
  if (isOne(r)) return 'a'
  if (r.n === -1 && r.d === 1) return '−a'
  return r.d === 1 ? `${rp(r)}a` : `(${rp(r)})a`
}

function monic(zeros: readonly { zero: Rational; mult: number }[]): LinearFactor[] {
  return zeros.map((z) => ({ coef: rat(1), constant: ratNeg(z.zero), mult: z.mult }))
}

function buildFromZeros(spec: ZerosSpec): Built | null {
  if (!spec || !Array.isArray(spec.zeros) || !spec.zeros.length) return null
  return guard(() => {
    const zeros: { zero: Rational; mult: number }[] = []
    for (const z of spec.zeros) {
      const r = toRational(z.zero)
      const mult = z.mult ?? 1
      if (!r || !Number.isInteger(mult) || mult < 1 || zeros.some((o) => same(o.zero, r))) return null
      zeros.push({ zero: r, mult })
    }
    const factors = monic(zeros)
    const body = bodyPoly(factors)
    const degree = zeros.reduce((s, z) => s + z.mult, 0)
    let a = rat(1)
    let point: ExactPoint | null = null
    const bodyTextA = bodyText(factors)
    const explanation: string[] = [
      `Each zero gives a factor: ${joinAnd(zeros.map((z, i) => `x = ${rp(z.zero)}${z.mult > 1 ? ` (multiplicity ${z.mult})` : ''} gives ${pretty(factorText(factors[i]!))}`))}.`,
    ]
    if (spec.point) {
      point = toPoint(spec.point)
      if (!point) return null
      const at = valueAt(body, point.x)
      if (at.n === 0 || point.y.n === 0) return null
      a = ratDiv(point.y, at)
      explanation.push(`Least degree means nothing else: f(x) = a${pretty(bodyTextA)}, degree ${degree}.`)
      explanation.push(
        `Use the point ${pointPretty(point)}: ${rp(point.y)} = a·${pretty(substituteValueText(bodyTextA, rt(point.x)))} = ${timesA(at)}, so a = ${rp(point.y)}/${rf(at)} = ${rp(a)}.`,
      )
    } else {
      explanation.push(`Least degree means nothing else: the degree is ${degree}. Without another point any nonzero number in front works; the simplest is 1.`)
    }
    const factored: FactoredPoly = { lead: a, factors }
    const text = factoredFormText(factored)
    explanation.push(`f(x) = ${pretty(text)}.`)
    const poly = polyScale(body, a)
    return { a, factored, text, expandedText: polyToText(poly), degree, point, explanation, poly, body, zeros }
  })
}

/**
 * The polynomial of least degree with these zeros and multiplicities (through `point` when one is given).
 * Null for a repeated zero, a bad multiplicity, or a point that is a zero or has y = 0.
 */
export function polynomialFromZeros(spec: ZerosSpec): BuiltPolynomial | null {
  const b = buildFromZeros(spec)
  if (!b) return null
  const { poly: _poly, body: _body, zeros: _zeros, ...rest } = b
  void _poly
  void _body
  void _zeros
  return rest
}

/** p = c·q for some number c ≠ 0. */
function proportional(p: Poly, q: Poly): boolean {
  if (!p.length || !q.length || p.length !== q.length) return false
  return polyEquals(polyScale(p, polyLead(q)), polyScale(q, polyLead(p)))
}

interface Variant {
  kind: PolyMistakeKind
  zeros: { zero: Rational; mult: number }[]
  witness: string
}

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]]
  const out: T[][] = []
  xs.forEach((x, i) => {
    for (const rest of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...rest])
  })
  return out
}

/** The factor sets her formula may be built from when she slips: signs flipped, exponents dropped or moved. */
function variants(b: Built): Variant[] {
  const out: Variant[] = []
  const zs = b.zeros
  const factorOf = (zero: Rational, mult = 1): string => pretty(factorText({ coef: rat(1), constant: ratNeg(zero), mult }))
  // Signs: every zero flipped first, then every other nonempty choice.
  const flippable = zs.map((z, i) => (z.zero.n !== 0 ? i : -1)).filter((i) => i >= 0)
  const masks: number[] = []
  if (flippable.length <= 5) for (let mask = (1 << flippable.length) - 1; mask >= 1; mask--) masks.push(mask)
  else masks.push((1 << flippable.length) - 1)
  for (const mask of masks) {
    const flipped = flippable.filter((_i, j) => mask & (1 << j))
    const first = zs[flipped[0]!]!
    out.push({
      kind: 'zero_sign_reversed',
      zeros: zs.map((z, i) => (flipped.includes(i) ? { zero: ratNeg(z.zero), mult: z.mult } : z)),
      witness: `A zero at x = ${rp(first.zero)} needs the factor ${factorOf(first.zero)}, which is 0 when x = ${rp(first.zero)}. Your formula has ${factorOf(ratNeg(first.zero))}, which is 0 at x = ${rp(ratNeg(first.zero))}.`,
    })
  }
  const repeated = zs.find((z) => z.mult > 1)
  if (repeated) {
    out.push({
      kind: 'multiplicity_ignored',
      zeros: zs.map((z) => ({ zero: z.zero, mult: 1 })),
      witness: `x = ${rp(repeated.zero)} has multiplicity ${repeated.mult}, so its factor carries that exponent: ${factorOf(repeated.zero, repeated.mult)}. Your formula uses ${factorOf(repeated.zero)} only once.`,
    })
    if (zs.length <= 5) {
      for (const perm of permutations(zs.map((z) => z.mult))) {
        const i = zs.findIndex((z, j) => z.mult !== perm[j])
        if (i < 0) continue
        const z = zs[i]!
        out.push({
          kind: 'multiplicity_wrong_zero',
          zeros: zs.map((x, j) => ({ zero: x.zero, mult: perm[j]! })),
          witness: `The multiplicity ${z.mult} belongs to x = ${rp(z.zero)}: its factor is ${factorOf(z.zero, z.mult)}. Your formula has ${factorOf(z.zero, perm[i]!)} instead.`,
        })
      }
    }
  }
  return out
}

function omittedWitness(b: Built, herValue: Rational): string {
  const p = b.point!
  return `Your formula has the right zeros and multiplicities, but it does not go through ${pointPretty(p)}: at x = ${rp(p.x)} it gives ${rp(herValue)}. Put a in front, f(x) = a${pretty(bodyText(b.factored.factors))}, and use the point: ${rp(p.y)} = ${timesA(valueAt(b.body, p.x))}, so a = ${rp(b.a)}.`
}

/**
 * The formula each slip gives (with a re-solved from the point where the slip leaves that possible), in
 * priority order; null outside the model.
 */
export function polynomialFromZerosMistakes(spec: ZerosSpec): FormulaMistakeCandidate[] | null {
  const b = buildFromZeros(spec)
  if (!b) return null
  return guard(() => {
    const raw: (FormulaMistakeCandidate & { poly: Poly })[] = []
    if (b.point && !isOne(b.a)) {
      raw.push({ kind: 'lead_coefficient_omitted', text: bodyText(b.factored.factors), poly: b.body, witness: omittedWitness(b, valueAt(b.body, b.point.x)), shadows: [] })
    }
    // One formula per kind: the first variant the grader would give that name to (a formula that an earlier
    // variant also produces carries the earlier variant's name, so it is not listed under the later one).
    const seen = new Set<PolyMistakeKind>()
    const earlier: Poly[] = []
    for (const v of variants(b)) {
      const factors = monic(v.zeros)
      const body = bodyPoly(factors)
      if (proportional(body, b.body)) continue
      const taken = earlier.some((e) => proportional(e, body))
      earlier.push(body)
      if (taken || seen.has(v.kind)) continue
      seen.add(v.kind)
      let a = rat(1)
      if (b.point) {
        const at = valueAt(body, b.point.x)
        if (at.n !== 0) a = ratDiv(b.point.y, at)
      }
      raw.push({ kind: v.kind, text: factoredFormText({ lead: a, factors }), poly: polyScale(body, a), witness: v.witness, shadows: [] })
    }
    return dedupeCandidates(
      raw,
      (c) => polyEquals(c.poly, b.poly),
      (u, w) => polyEquals(u.poly, w.poly),
    ).map(({ kind, text, witness, shadows }) => ({ kind, text, witness, shadows }))
  })
}

/**
 * Grade her polynomial of least degree with the given zeros, multiplicities and point: any formula that
 * multiplies out to the right polynomial (factored, expanded, (2x − 1) for a zero at 1/2, …). Without a
 * point any nonzero multiple of the right product is correct.
 */
export function gradePolynomialFromZeros(spec: ZerosSpec, answer: string): PolyGrade {
  return checked(() => gradePolynomialFromZerosUnchecked(spec, answer))
}

function gradePolynomialFromZerosUnchecked(spec: ZerosSpec, answer: string): PolyGrade {
  const b = buildFromZeros(spec)
  if (!b) return { verdict: 'unsupported', message: 'This problem needs distinct rational zeros with positive whole multiplicities, and a point that is not a zero.' }
  const her = readFormula(answer)
  if (!her.ok) return invalidParse(her.error)
  if (!her.poly) return { verdict: 'invalid', reason: 'unreadable', message: 'Write f(x) as a polynomial in x: a product of factors like (x - 3), or multiplied out.' }
  const explanation = b.explanation
  const hp = her.poly
  if (b.point ? polyEquals(hp, b.poly) : proportional(hp, b.body)) {
    return { verdict: 'correct', message: `Correct: f(x) = ${pretty(b.text)}${b.point ? `, which multiplies out to ${polyPretty(b.poly)}` : ''}.`, explanation }
  }
  if (proportional(hp, b.body)) {
    // Right zeros and multiplicities, wrong number in front (only reachable with a point).
    const herA = ratDiv(polyLead(hp), polyLead(b.body))
    const p = b.point!
    const herValue = valueAt(hp, p.x)
    const cleared = b.zeros.reduce((acc, z) => ratMul(acc, ratPow(rat(z.zero.d), z.mult)), rat(1))
    if (isOne(herA) || same(herA, cleared)) {
      return { verdict: 'mistake', mistake: 'lead_coefficient_omitted', witness: omittedWitness(b, herValue), explanation }
    }
    return {
      verdict: 'wrong',
      message: `Your zeros and multiplicities are right. Now check the number in front with the point ${pointPretty(p)}: at x = ${rp(p.x)} your formula gives ${rp(herValue)}, but it must give ${rp(p.y)}.`,
      explanation,
    }
  }
  const hit = guard(() => variants(b).find((v) => proportional(hp, bodyPoly(monic(v.zeros)))))
  if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  if (polyDeg(hp) !== b.degree) {
    return {
      verdict: 'wrong',
      message: `Your formula has degree ${polyDeg(hp)}. The least degree is the sum of the multiplicities, ${b.zeros.map((z) => z.mult).join(' + ')} = ${b.degree}: one factor (x − zero) for each zero, raised to its multiplicity, and nothing else.`,
      explanation,
    }
  }
  const off = b.zeros.find((z) => valueAt(hp, z.zero).n !== 0)
  return {
    verdict: 'wrong',
    message: off
      ? `x = ${rp(off.zero)} must be a zero, but your formula gives ${rp(valueAt(hp, off.zero))} there, not 0. It needs the factor ${pretty(factorText({ coef: rat(1), constant: ratNeg(off.zero), mult: off.mult }))}.`
      : `Your formula is 0 at every given zero, but the multiplicities are off: each factor (x − zero) is raised to its zero's multiplicity, ${joinAnd(b.zeros.map((z) => `${z.mult} for x = ${rp(z.zero)}`))}.`,
    explanation,
  }
}

