/**
 * Rational root candidates (the rational root theorem) for a polynomial with integer coefficients and a
 * nonzero constant term: every rational zero is ±p/q with p a factor of the constant term and q a factor of
 * the leading coefficient. The list is graded as a set; then which candidates really are zeros.
 *
 * Named mistakes (sample f(x) = 2x^3 − 5x^2 − 4x + 3: candidates ±1, ±3, ±1/2, ±3/2; zeros −1, 1/2, 3):
 *  - rrt_no_plus_minus:      only the positive candidates          1, 3, 1/2, 3/2
 *  - rrt_inverted:           q/p instead of p/q                    ±1, ±2, ±1/3, ±2/3
 *  - rrt_integers_only:      only the factors of the constant      ±1, ±3
 *  - rrt_wrong_coefficients: factors of other coefficients         e.g. ±1, ±2, ±4, ±1/2 (from −4 and 2)
 *  - zero_sign_reversed:     (actual zeros) every sign backwards   1, −1/2, −3
 */
import type { Rational } from '@/shared/types'
import { rat, ratAbs, ratCompare, ratNeg, ratToString } from '@/notation/rational'
import { polyDeg, rationalRoots, type Poly } from '../functions/poly'
import { rp, rt } from '../transformations/text'
import {
  checked,
  dedupeCandidates,
  descending,
  divisors,
  guard,
  invalidParse,
  joinAnd,
  plain,
  pretty,
  ratKey,
  readNumber,
  readPoly,
  rowPretty,
  sameSet,
  sortedSet,
  splitList,
  termName,
  valueAt,
} from './common'
import type { PolyGrade, PolyInput, PolyMistakeKind, RootCandidates, RootSetMistakeCandidate } from './types'

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

interface Model extends RootCandidates {
  poly: Poly
  /** Integer coefficients, highest power first. */
  ints: number[]
}

/** The distinct positive fractions p/q, integers first, then by denominator and numerator. */
function positiveRatios(ps: readonly number[], qs: readonly number[]): Rational[] {
  const all: Rational[] = []
  for (const p of ps) for (const q of qs) all.push(rat(p, q))
  return sortedSet(all).sort((x, y) => (x.d === 1 ? 0 : 1) - (y.d === 1 ? 0 : 1) || x.d - y.d || x.n - y.n)
}

function withNegatives(pos: readonly Rational[]): Rational[] {
  return sortedSet([...pos, ...pos.map(ratNeg)])
}

/** "+-1, +-3, +-1/2" (app syntax). */
function pmText(pos: readonly Rational[]): string {
  return pos.map((r) => `+-${ratToString(r)}`).join(', ')
}

/** "±1, ±3, ±1/2" (display). */
function pmPretty(pos: readonly Rational[]): string {
  return pos.map((r) => `±${ratToString(r)}`).join(', ')
}

/** One model per problem text: a screen grades many lists against the same f. */
const MODELS = new Map<string, Model | null>()

function build(f: PolyInput): Model | null {
  if (typeof f !== 'string') return buildUncached(f)
  const hit = MODELS.get(f)
  if (hit !== undefined) return hit
  const out = buildUncached(f)
  if (MODELS.size >= 256) MODELS.clear()
  MODELS.set(f, out)
  return out
}

function buildUncached(f: PolyInput): Model | null {
  const src = readPoly(f)
  if (!src || polyDeg(src.poly) < 1) return null
  if (!src.poly.every((c) => c.d === 1)) return null
  const ints = descending(src.poly).map((c) => c.n)
  const constant = ints[ints.length - 1]!
  const leading = ints[0]!
  if (constant === 0 || Math.abs(constant) > 1e6 || Math.abs(leading) > 1e6) return null
  return guard(() => {
    const p = divisors(Math.abs(constant))
    const q = divisors(Math.abs(leading))
    const positives = positiveRatios(p, q)
    const candidates = withNegatives(positives)
    const tests = candidates.map((candidate) => ({ candidate, value: valueAt(src.poly, candidate) }))
    const rr = rationalRoots(src.poly)
    const text = pmText(positives)
    const explanation = [
      `Constant term ${rp(rat(constant))}: its factors are p = ${pmPretty(p.map((v) => rat(v)))}.`,
      `Leading coefficient ${rp(rat(leading))}: its factors are q = ${pmPretty(q.map((v) => rat(v)))}.`,
      `Every rational zero is one of the fractions p/q: ${pmPretty(positives)}. That is ${candidates.length} candidates once repeats are removed.`,
    ]
    const zeroExplanation = [
      `Test each candidate: put it into f(x) (or divide synthetically and look for remainder 0).`,
      rr.roots.length
        ? `${joinAnd(rr.roots.map((z) => `f(${rp(z)}) = 0`))}, so the rational ${rr.roots.length === 1 ? 'zero is' : 'zeros are'} ${joinAnd(rr.roots.map(rp))}. Every other candidate gives a value that is not 0.`
        : `None of the ${candidates.length} candidates gives 0, so f(x) has no rational zeros.`,
    ]
    return { poly: src.poly, ints, f: src.text, constant, leading, p, q, positives, candidates, text, tests, zeros: rr.roots, multiplicities: rr.mult, explanation, zeroExplanation }
  })
}

/**
 * The rational root candidates of f, f at each of them, and which are zeros. Null unless f has integer
 * coefficients, degree ≥ 1 and a nonzero constant term (factor x out first when the constant term is 0).
 */
export function rationalRootCandidates(f: PolyInput): RootCandidates | null {
  const m = build(f)
  if (!m) return null
  // Copies: the model is cached, and a caller may sort or extend what it is given.
  return {
    f: m.f,
    constant: m.constant,
    leading: m.leading,
    p: [...m.p],
    q: [...m.q],
    positives: [...m.positives],
    candidates: [...m.candidates],
    text: m.text,
    tests: m.tests.map((t) => ({ ...t })),
    zeros: [...m.zeros],
    multiplicities: [...m.multiplicities],
    explanation: [...m.explanation],
    zeroExplanation: [...m.zeroExplanation],
  }
}

const UNSUPPORTED = 'This problem needs a polynomial with integer coefficients, degree 1 or more and a nonzero constant term.'

// ---------------------------------------------------------------------------
// Candidates of mistakes
// ---------------------------------------------------------------------------

/** A candidate list with its set as one string, so lists are compared once, not element by element. */
type Keyed = RootSetMistakeCandidate & { key: string }

/** The set of these numbers as a key (order and repeats do not matter). */
function setKey(values: readonly Rational[]): string {
  return sortedSet(values).map(ratKey).join(' ')
}

const CANDIDATES = new WeakMap<Model, Keyed[]>()

function setCandidates(m: Model): Keyed[] {
  const cached = CANDIDATES.get(m)
  if (cached) return cached
  const out = computeSetCandidates(m)
  CANDIDATES.set(m, out)
  return out
}

function computeSetCandidates(m: Model): Keyed[] {
  const raw: Keyed[] = []
  const add = (kind: PolyMistakeKind, values: Rational[], witness: string): void => {
    raw.push({ kind, values, text: values.map(rt).join(', '), witness, shadows: [], key: setKey(values) })
  }
  const a0 = rp(rat(m.constant))
  const an = rp(rat(m.leading))
  add(
    'rrt_no_plus_minus',
    sortedSet(m.positives),
    `Each candidate can be positive or negative: ${pmPretty(m.positives)}. You listed only the positive ones, so ${m.positives.length} candidates are missing (${rp(ratNeg(m.positives[0]!))}, for example).`,
  )
  const inverted = positiveRatios(m.q, m.p)
  const example = inverted.find((r) => !m.positives.some((x) => ratCompare(x, r) === 0))
  add(
    'rrt_inverted',
    withNegatives(inverted),
    `The candidates are p/q: factors of the CONSTANT term ${a0} on top, factors of the LEADING coefficient ${an} underneath. Your list has them upside down (q/p)${example ? `: ${rp(example)} is on it, but ${example.n} is not a factor of ${a0}${example.d === 1 ? '' : ` over a factor of ${an}`}` : ''}.`,
  )
  const fractions = m.positives.filter((r) => r.d !== 1)
  add(
    'rrt_integers_only',
    withNegatives(m.p.map((v) => rat(v))),
    `The leading coefficient is ${an}, not ±1, so the ${m.q.length > 2 ? 'denominators' : 'denominator'} ${joinAnd(m.q.filter((v) => v > 1).map((v) => `${v}`))} ${m.q.length > 2 ? 'give' : 'gives'} fractions too: ${pmPretty(fractions)}. You listed only the factors of ${a0}.`,
  )
  // Factors of the wrong pair of coefficients.
  const n = m.ints.length - 1
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === j || m.ints[i] === 0 || m.ints[j] === 0) continue
      if ((i === n && j === 0) || (i === 0 && j === n)) continue
      const top = m.ints[i]!
      const bottom = m.ints[j]!
      add(
        'rrt_wrong_coefficients',
        withNegatives(positiveRatios(divisors(Math.abs(top)), divisors(Math.abs(bottom)))),
        `Use the constant term ${a0} for p and the leading coefficient ${an} for q. Your list comes from ${rp(rat(top))} (the ${i === n ? 'constant term' : i === 0 ? 'leading coefficient' : `coefficient of the ${termName(n - i)}`}) over ${rp(rat(bottom))} (the ${j === n ? 'constant term' : j === 0 ? 'leading coefficient' : `coefficient of the ${termName(n - j)}`}).`,
      )
    }
  }
  const right = setKey(m.candidates)
  return dedupeCandidates(
    raw,
    (c) => c.key === right,
    (u, v) => u.key === v.key,
  )
}

/** The candidate list each slip produces, in priority order; null outside the model. */
export function rootCandidateMistakes(f: PolyInput): RootSetMistakeCandidate[] | null {
  const m = build(f)
  return m ? setCandidates(m).map(({ kind, values, text, witness, shadows }) => ({ kind, values, text, witness, shadows: [...shadows] })) : null
}

// ---------------------------------------------------------------------------
// Reading her list
// ---------------------------------------------------------------------------

type ListRead = { ok: true; values: (Rational | null)[]; texts: string[] } | { ok: false; grade: PolyGrade }

/**
 * A list of numbers where an item may carry ±: "+-1, +-3, +-1/2", "±1, ±3", "1, -1, 3, -3", "{1, -1}",
 * "+-{1, 3, 1/2}" (the ± applies to every item).
 */
function readSignedList(text: string): ListRead {
  let t = plain(text ?? '').trim()
  if (!t) return { ok: false, grade: { verdict: 'invalid', reason: 'unreadable', message: 'Type the list first, with a comma between the numbers.' } }
  let allPm = false
  const wrapped = t.match(/^(?:\+\s*-|-\s*\+)\s*([{(\[].*[})\]])$/)
  if (wrapped) {
    allPm = true
    t = wrapped[1]!
    if (t.startsWith('(')) t = `{${t.slice(1, -1)}}`
  }
  const values: (Rational | null)[] = []
  const texts: string[] = []
  const items = splitList(t)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!
    if (!it.text) return { ok: false, grade: { verdict: 'invalid', reason: 'unreadable', message: 'There is an empty place in the list: check the commas.', index: i, position: it.start } }
    // "x = " in front is fine; then an optional ± ("+-", "+ -", "-+").
    const label = it.text.match(/^x\s*=\s*/i)
    const pm = it.text.slice(label ? label[0].length : 0).match(/^(?:\+\s*-|-\s*\+)\s*/)
    const skip = (label ? label[0].length : 0) + (pm ? pm[0].length : 0)
    const n = readNumber(it.text.slice(skip))
    if (!n.ok) return { ok: false, grade: invalidParse({ ...n.error, position: n.error.position + it.start + skip }, i) }
    values.push(n.value)
    texts.push(it.text.slice(skip))
    if ((pm || allPm) && n.value) {
      values.push(ratNeg(n.value))
      texts.push(`-${it.text.slice(skip)}`)
    }
  }
  return { ok: true, values, texts }
}

/** ±v when both signs are in the list, else the single value: "±3/2, 5". */
function compact(values: readonly Rational[]): string {
  const keys = new Set(values.map(ratKey))
  const out: string[] = []
  for (const v of sortedSet(values.map((x) => (x.n < 0 ? ratNeg(x) : x)))) {
    const pos = keys.has(ratKey(v))
    const neg = keys.has(ratKey(ratNeg(v)))
    out.push(pos && neg && v.n !== 0 ? `±${ratToString(v)}` : pos ? ratToString(v) : pretty(ratToString(ratNeg(v))))
  }
  return out.join(', ')
}

// ---------------------------------------------------------------------------
// Graders
// ---------------------------------------------------------------------------

/**
 * Grade her list of rational root candidates as a set. "+-1, +-3, +-1/2, +-3/2", "±1, ±3, …", every value
 * written out, repeats and unreduced fractions (2/2, 6/4) are all fine.
 */
export function gradeRootCandidates(f: PolyInput, answer: string): PolyGrade {
  return checked(() => gradeRootCandidatesUnchecked(f, answer))
}

function gradeRootCandidatesUnchecked(f: PolyInput, answer: string): PolyGrade {
  const m = build(f)
  if (!m) return { verdict: 'unsupported', message: UNSUPPORTED }
  const her = readSignedList(answer)
  if (!her.ok) return her.grade
  const explanation = [...m.explanation]
  const rational = her.values.filter((v): v is Rational => v !== null)
  const irrational = her.values.findIndex((v) => v === null)
  if (irrational < 0 && sameSet(rational, m.candidates)) {
    return {
      verdict: 'correct',
      message: `Correct: all ${m.candidates.length} candidates, ${pmPretty(m.positives)} (factors of ${rp(rat(m.constant))} over factors of ${rp(rat(m.leading))}).`,
      explanation,
    }
  }
  if (irrational < 0) {
    const herKey = setKey(rational)
    const hit = setCandidates(m).find((c) => c.key === herKey)
    if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  }
  const mine = sortedSet(rational)
  const extras = mine.filter((v) => !m.candidates.some((c) => ratCompare(c, v) === 0))
  const missing = m.candidates.filter((c) => !mine.some((v) => ratCompare(c, v) === 0))
  const parts: string[] = []
  if (irrational >= 0) parts.push(`${pretty(her.texts[irrational]!)} is not a rational number, so it cannot be a candidate.`)
  // The extra number closest to 0, positive first.
  const e = [...extras].sort((x, y) => ratCompare(ratAbs(x), ratAbs(y)) || y.n - x.n)[0]
  if (e) {
    const top = Math.abs(e.n)
    const reason =
      e.n === 0
        ? '0 is never a candidate when the constant term is not 0'
        : !m.p.includes(top)
          ? `its numerator ${top} is not a factor of the constant term ${rp(rat(m.constant))}`
          : `its denominator ${e.d} is not a factor of the leading coefficient ${rp(rat(m.leading))}`
    parts.push(`${rp(e)} is not a candidate: ${reason}.${extras.length > 1 ? ` (${extras.length} of your numbers are not candidates.)` : ''}`)
  }
  if (missing.length) {
    const have = m.candidates.length - missing.length
    const shown = missing.length <= 8 ? compact(missing) : `${compact(missing.slice(0, 8))}, …`
    parts.push(`You have ${have} of the ${m.candidates.length} candidates. Missing: ${shown}.`)
  }
  return { verdict: 'wrong', message: parts.join(' '), explanation }
}

/**
 * Grade which candidates really are zeros: a list such as "-1, 1/2, 3" (graded as a set), or "none" when f
 * has no rational zeros.
 */
export function gradeRationalZeros(f: PolyInput, answer: string): PolyGrade {
  return checked(() => gradeRationalZerosUnchecked(f, answer))
}

function gradeRationalZerosUnchecked(f: PolyInput, answer: string): PolyGrade {
  const m = build(f)
  if (!m) return { verdict: 'unsupported', message: UNSUPPORTED }
  const explanation = [...m.explanation, ...m.zeroExplanation]
  const none = /^\s*(?:none|no rational zeros|no zeros|no real zeros|\{\s*\}|∅)\s*$/i.test(answer ?? '')
  let rational: Rational[] = []
  let irrationalText: string | null = null
  if (!none) {
    const her = readSignedList(answer)
    if (!her.ok) return her.grade
    rational = sortedSet(her.values.filter((v): v is Rational => v !== null))
    const at = her.values.findIndex((v) => v === null)
    if (at >= 0) irrationalText = pretty(her.texts[at]!)
  }
  if (!irrationalText && sameSet(rational, m.zeros)) {
    return {
      verdict: 'correct',
      message: m.zeros.length
        ? `Correct: ${joinAnd(m.zeros.map((z) => `f(${rp(z)}) = 0`))}; no other candidate is a zero.`
        : `Correct: none of the ${m.candidates.length} candidates gives 0, so f(x) has no rational zeros.`,
      explanation,
    }
  }
  if (!irrationalText && rational.length && sameSet(rational, m.zeros.map(ratNeg))) {
    const z = m.zeros.find((v) => v.n !== 0 && !m.zeros.some((w) => ratCompare(w, ratNeg(v)) === 0)) ?? m.zeros[0]!
    return {
      verdict: 'mistake',
      mistake: 'zero_sign_reversed',
      witness: `Every sign is backwards: f(${rp(ratNeg(z))}) = ${rp(valueAt(m.poly, ratNeg(z)))}, not 0, while f(${rp(z)}) = 0. A zero is the number that makes f(x) equal 0 (the factor for x = ${rp(z)} is the one that is 0 there).`,
      explanation,
    }
  }
  const parts: string[] = []
  if (irrationalText) parts.push(`${irrationalText} is not a rational number: this question asks only about the rational candidates.`)
  const extra = rational.find((v) => !m.zeros.some((z) => ratCompare(z, v) === 0))
  if (extra) {
    const listed = m.candidates.some((c) => ratCompare(c, extra) === 0)
    parts.push(`${rp(extra)} is not a zero: f(${rp(extra)}) = ${rp(valueAt(m.poly, extra))}, not 0${listed ? '' : ' (it is not even on the candidate list)'}.`)
  }
  const found = rational.filter((v) => m.zeros.some((z) => ratCompare(z, v) === 0)).length
  const left = m.zeros.length - found
  if (left > 0) {
    parts.push(
      found
        ? `You have ${found} of the ${m.zeros.length} rational zeros: keep testing the candidates ${rowPretty(m.candidates)} for a remainder of 0.`
        : `There ${m.zeros.length === 1 ? 'is 1 rational zero' : `are ${m.zeros.length} rational zeros`} among the candidates ${rowPretty(m.candidates)}: test them until the remainder is 0.`,
    )
  } else if (!m.zeros.length && !extra) parts.push('None of the candidates gives 0.')
  return { verdict: 'wrong', message: parts.join(' '), explanation }
}
