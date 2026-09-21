/**
 * atom.avgmass: average atomic mass from an isotope table.
 *
 * The calculation IS a significant-figures `mixed` task: one group per isotope, mass × abundance ÷ 100
 * with the 100 exact, and the groups joined by +. `gradeSigFigAnswer` does the arithmetic and the
 * figure rules (so figure slips come back with their own sf_* pattern); this file adds the chemistry
 * mistakes on top, each computed EXACTLY for the question and compared with what she typed:
 *
 *   masses × percents with no ÷ 100 (100× too big)     → at_percent_not_decimal
 *   plain average of the masses (or of the mass numbers) → at_unweighted_average
 *   mass numbers in place of isotopic masses            → at_mass_numbers_used
 *   one isotope's term missing                          → at_isotope_left_out
 *
 * A method mistake is matched when her value is what the mistaken calculation gives, rounded (or
 * chopped) to the last significant place she wrote — and NOT what the right calculation gives there.
 */
import type { AtomIsotopeRow, AtomMistakeCandidate, AtomQuestion, ErrorPatternId, SigFigGrade, SigFigTask } from '@/shared/types'
import { elementBySymbol } from '../chem/elements'
import { patternHit } from '../matchers/catalog'
import { ratFromDec } from '../sigfigs/decimal'
import { evaluateSigFigTask } from '../sigfigs/evaluate'
import { gradeSigFigAnswer } from '../sigfigs/grade'
import { sigFigDec } from '../sigfigs/parse'
import {
  consistentAt,
  decimalsOf,
  display,
  percentToDecimalText,
  R100,
  ratCmp,
  ratDiv,
  ratEq,
  ratFromInt,
  ratFromText,
  ratIsBetween,
  ratMul,
  ratSub,
  ratSum,
  roundedAt,
  textAt,
  type Rat,
} from './exact'

export type AverageMassQuestion = Extract<AtomQuestion, { kind: 'avgmass' }>

/** Why the 100 is exact, shown by the sig-fig explanation. */
export const PERCENT_NOTE = 'per cent: out of 100'

/** The weighted average as a sig-fig task: Σ (mass × abundance ÷ 100), the 100 exact. */
export function averageMassTask(rows: readonly AtomIsotopeRow[]): SigFigTask {
  if (rows.length < 2) throw new Error('atoms: an average needs at least two isotopes')
  return {
    kind: 'mixed',
    operands: rows.map((r) => ({
      terms: [{ text: r.mass }, { text: r.abundance }, { text: '100', exact: true, note: PERCENT_NOTE }],
      ops: ['*', '/'],
    })),
    ops: rows.slice(1).map(() => '+' as const),
  }
}

const masses = (rows: readonly AtomIsotopeRow[]): Rat[] => rows.map((r) => ratFromText(r.mass))
const percents = (rows: readonly AtomIsotopeRow[]): Rat[] => rows.map((r) => ratFromText(r.abundance))

/** Σ mass × abundance ÷ 100, exactly. */
export function exactAverage(rows: readonly AtomIsotopeRow[]): Rat {
  const m = masses(rows)
  const p = percents(rows)
  return ratDiv(ratSum(m.map((x, i) => ratMul(x, p[i]!))), R100)
}

/** Exact Σ abundance (a real table sums to 100 within rounding; a made-up one exactly). */
export function abundanceTotal(rows: readonly AtomIsotopeRow[]): Rat {
  return ratSum(percents(rows))
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function mostAbundant(rows: readonly AtomIsotopeRow[]): AtomIsotopeRow {
  let best = rows[0]!
  for (const r of rows) if (ratCmp(ratFromText(r.abundance), ratFromText(best.abundance)) > 0) best = r
  return best
}

interface MethodMistake {
  id: ErrorPatternId
  value: Rat
  witness: (shown: string) => string
}

/** The chemistry mistakes, in the order they are tried. */
function methodMistakes(q: AverageMassQuestion): MethodMistake[] {
  const rows = q.isotopes
  const m = masses(rows)
  const p = percents(rows)
  const n = rows.length
  const massList = rows.map((r) => r.mass).join(' + ')
  const massNumberList = rows.map((r) => String(r.massNumber)).join(' + ')
  const major = mostAbundant(rows)
  const first = rows[0]!
  const out: MethodMistake[] = [
    {
      id: 'at_percent_not_decimal',
      value: ratSum(m.map((x, i) => ratMul(x, p[i]!))),
      witness: (shown) =>
        `${shown} u is about 100 times too big: the percents went in as whole numbers (${first.mass} × ${first.abundance} and so on). Change each percent to a decimal first (${first.abundance}% → ${percentToDecimalText(first.abundance)}), then multiply.`,
    },
    {
      id: 'at_unweighted_average',
      value: ratDiv(ratSum(m), ratFromInt(n)),
      witness: (shown) =>
        `${shown} u is the plain average of the masses, (${massList}) ÷ ${n}, as if every isotope were equally common. ${capital(major.label)} makes up ${major.abundance}%, so the average belongs much closer to ${major.mass} u.`,
    },
    {
      id: 'at_unweighted_average',
      value: ratDiv(ratSum(rows.map((r) => ratFromInt(r.massNumber))), ratFromInt(n)),
      witness: (shown) =>
        `${shown} u is the plain average of the mass numbers, (${massNumberList}) ÷ ${n}. The isotopes are not equally common, and the average uses their measured masses, each weighted by its abundance.`,
    },
    {
      id: 'at_mass_numbers_used',
      value: ratDiv(ratSum(rows.map((r, i) => ratMul(ratFromInt(r.massNumber), p[i]!))), R100),
      witness: (shown) =>
        `${shown} u comes from the mass numbers (${rows.map((r) => r.massNumber).join(', ')}) in place of the isotopic masses. Use the masses from the table (${rows.map((r) => `${r.mass} u`).join(', ')}): a mass number only counts particles.`,
    },
  ]
  // Leaving out a row: the rarest isotope is the one most often forgotten, so it is tried first.
  const order = rows.map((_, i) => i).sort((a, b) => ratCmp(p[a]!, p[b]!))
  for (const k of order) {
    const row = rows[k]!
    out.push({
      id: 'at_isotope_left_out',
      value: ratDiv(ratSum(m.map((x, i) => (i === k ? ratFromInt(0) : ratMul(x, p[i]!)))), R100),
      witness: (shown) =>
        `${shown} u leaves out ${row.label} (${row.abundance}%). Every row of the table needs its own mass × abundance term in the sum, even a rare one.`,
    })
  }
  return out
}

function lightestHeaviest(rows: readonly AtomIsotopeRow[]): { lo: AtomIsotopeRow; hi: AtomIsotopeRow } {
  let lo = rows[0]!
  let hi = rows[0]!
  for (const r of rows) {
    if (ratCmp(ratFromText(r.mass), ratFromText(lo.mass)) < 0) lo = r
    if (ratCmp(ratFromText(r.mass), ratFromText(hi.mass)) > 0) hi = r
  }
  return { lo, hi }
}

/**
 * Grade a typed average atomic mass (any numeral spelling the sig-fig parser reads; no unit).
 * Order: the sig-fig grader's verdict (correct, parse error, or a named figure slip) → the chemistry
 * mistakes above → a plain, specific message.
 */
export function gradeAverageMass(q: AverageMassQuestion, answer: string): SigFigGrade {
  const task = averageMassTask(q.isotopes)
  const g = gradeSigFigAnswer(task, answer)
  if (g.status === 'parse_error') return g
  if (g.status === 'correct') {
    const ev = evaluateSigFigTask(task)
    return { ...g, message: `Correct! ${ev.expected.display} u is the weighted average, rounded to the ${ev.limit.placeName} place.` }
  }
  if (g.pattern?.id === 'sf_exact_limited') {
    // Same slip, told in this problem's words (the generic witness lists "100" once per isotope).
    const witness = `${g.parsed?.display ?? answer.trim()} u lets the 100 limit the answer. The 100 that turns a percent into a decimal is exact (per cent means out of 100), so only the measured masses and abundances limit the figures.`
    return { ...g, message: witness, pattern: patternHit('sf_exact_limited', witness) }
  }
  if (g.pattern || !g.parsed) return g
  const s = g.parsed
  const v = ratFromDec(sigFigDec(s))
  const exact = exactAverage(q.isotopes)
  if (consistentAt(v, s.lastSigPlace, exact)) return g // right arithmetic; the sig-fig grader's message is about the figures
  for (const mistake of methodMistakes(q)) {
    if (ratEq(v, mistake.value) || (s.sigFigs >= 3 && consistentAt(v, s.lastSigPlace, mistake.value))) {
      const witness = mistake.witness(s.display)
      return { status: 'wrong', message: witness, pattern: patternHit(mistake.id, witness), parsed: s }
    }
  }
  const { lo, hi } = lightestHeaviest(q.isotopes)
  if (!ratIsBetween(v, ratFromText(lo.mass), ratFromText(hi.mass)))
    return {
      status: 'wrong',
      message: `An average of these isotopes has to land between the lightest and the heaviest, ${lo.mass} u and ${hi.mass} u, and ${s.display} u does not. Multiply each mass by its abundance as a decimal, then add the products.`,
      parsed: s,
    }
  return {
    status: 'wrong',
    message: `${s.display} u is between the isotope masses, but it is not the weighted average of this table. Multiply each mass by its abundance as a decimal (percent ÷ 100), add the products, and round once at the end.`,
    parsed: s,
  }
}

/**
 * The chemistry mistakes as they would be typed at the answer's precision, each already run through
 * `gradeAverageMass` so `id` is exactly what she would be told (entries that grade differently are
 * dropped). Generators use it to keep only tables where a mistake is visible.
 */
export function averageMassMistakeCandidates(q: AverageMassQuestion): AtomMistakeCandidate[] {
  const ev = evaluateSigFigTask(averageMassTask(q.isotopes))
  const place = ev.expected.place
  const out: AtomMistakeCandidate[] = []
  for (const m of methodMistakes(q)) {
    const text = textAt(m.value, place)
    if (out.some((c) => c.text === text)) continue
    const g = gradeAverageMass(q, text)
    if (g.status === 'wrong' && g.pattern?.id === m.id) out.push({ id: m.id, text, exact: display(m.value), witness: g.message })
  }
  return out
}

/** Worked explanation (hint rung 3 and after a right answer). Reveals the answer. */
export function explainAverageMass(q: AverageMassQuestion): string[] {
  const rows = q.isotopes
  const task = averageMassTask(rows)
  const ev = evaluateSigFigTask(task)
  const m = masses(rows)
  const p = percents(rows)
  const products = m.map((x, i) => ratDiv(ratMul(x, p[i]!), R100))
  const sum = ratSum(products)
  const lines: string[] = [
    'Average atomic mass is a weighted average: each isotope counts in proportion to how common it is.',
    `Change each percent to a decimal by dividing by 100: ${rows.map((r) => `${r.abundance}% → ${percentToDecimalText(r.abundance)}`).join(', ')}.`,
    ...rows.map((r, i) => `${r.label}: ${r.mass} u × ${percentToDecimalText(r.abundance)} = ${display(products[i]!)} u`),
    `Add them: ${products.map((x) => display(x)).join(' + ')} = ${display(sum)} u.`,
  ]
  if (ev.intermediates.length === rows.length)
    lines.push(
      `Significant figures: each product keeps the fewest figures of its mass and its percent (the 100 is exact), so ${ev.intermediates
        .map((it) => `${it.roundedDisplay} is good to the ${it.placeName} place`)
        .join(', ')}. The sum stops at the least precise of those places: the ${ev.limit.placeName}.`,
    )
  lines.push(`Rounded to the ${ev.limit.placeName} place: ${ev.expected.display} u.`)
  const { lo, hi } = lightestHeaviest(rows)
  const major = mostAbundant(rows)
  const answer = roundedAt(sum, ev.expected.place)
  let nearest = rows[0]!
  for (const r of rows) {
    const d = (x: AtomIsotopeRow) => {
      const diff = ratSub(ratFromText(x.mass), answer)
      return diff.n < 0n ? { n: -diff.n, d: diff.d } : diff
    }
    if (ratCmp(d(r), d(nearest)) < 0) nearest = r
  }
  lines.push(
    `Check: ${ev.expected.display} u lies between ${lo.mass} u and ${hi.mass} u${nearest === major ? `, nearest ${major.label}, the most abundant isotope` : ''}.`,
  )
  if (!q.fictional) {
    const el = elementBySymbol(q.symbol)
    if (el) {
      const aw = ratFromText(el.atomicWeight)
      const awPlace = -decimalsOf(el.atomicWeight)
      const agrees = consistentAt(aw, awPlace, sum) || ratEq(roundedAt(aw, ev.expected.place), answer)
      if (agrees) lines.push(`That agrees with the ${el.atomicWeight} printed for ${el.name} on the periodic table.`)
    }
  }
  return lines
}
