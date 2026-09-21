/**
 * atom.abundance: two isotopes and the average atomic mass are given; find each percent abundance.
 *
 *   x·m₁ + (1 − x)·m₂ = average   →   x = (average − m₂) ÷ (m₁ − m₂)
 *
 * Solved exactly (BigInt rationals). Each percent is asked for to a stated place (hundredths of a
 * percent, say), so the two right answers always total exactly 100. Named mistakes:
 *
 *   50 and 50                                   → at_assumed_even_split
 *   the right pair in the wrong rows            → at_abundance_swapped
 *   two percents that do not total 100          → at_abundance_sum
 */
import type { AtomBoxGrade, AtomGrade, AtomQuestion } from '@/shared/types'
import { sigFigPlaceName } from '../sigfigs/format'
import { finishGrade, namedBox, okBox, parseAll, plainBox } from './grade'
import {
  consistentAt,
  display,
  isTieAt,
  minusText,
  R100,
  ratAdd,
  ratCmp,
  ratDiv,
  ratEq,
  ratFromInt,
  ratFromText,
  ratMul,
  ratSub,
  roundedAt,
  textAt,
  type Rat,
} from './exact'
import type { Parsed } from './particle'

export type AbundanceQuestion = Extract<AtomQuestion, { kind: 'abundance' }>

export interface AbundanceSolution {
  /** Exact percents (the second is 100 minus the first). */
  exact: [Rat, Rat]
  /** Each rounded to the question's place, plain text: ["75.76", "24.24"]. */
  answer: [string, string]
}

export function solveAbundance(q: AbundanceQuestion): AbundanceSolution {
  const m1 = ratFromText(q.isotopes[0].mass)
  const m2 = ratFromText(q.isotopes[1].mass)
  const avg = ratFromText(q.average)
  const x = ratDiv(ratSub(avg, m2), ratSub(m1, m2))
  const p1 = ratMul(x, R100)
  const p2 = ratSub(R100, p1)
  return { exact: [p1, p2], answer: [textAt(p1, q.place), textAt(p2, q.place)] }
}

/** Why a generated question is unusable ([] = fine): average outside the masses, a rounding tie, or rounded answers not totalling 100. */
export function abundanceIssues(q: AbundanceQuestion): string[] {
  const issues: string[] = []
  const m1 = ratFromText(q.isotopes[0].mass)
  const m2 = ratFromText(q.isotopes[1].mass)
  if (ratCmp(m1, m2) === 0) return ['the two isotopes have the same mass']
  const { exact } = solveAbundance(q)
  if (ratCmp(exact[0], ratFromInt(0)) <= 0 || ratCmp(exact[0], R100) >= 0) return ['the average is not between the two masses']
  if (isTieAt(exact[0], q.place) || isTieAt(exact[1], q.place)) issues.push('a percent ends exactly on a rounding tie')
  if (!ratEq(ratAdd(roundedAt(exact[0], q.place), roundedAt(exact[1], q.place)), R100)) issues.push('the rounded percents do not total 100')
  return issues
}

interface Percent {
  value: Rat
  /** Place of the last digit she wrote: "69.15" → −2, "70" → 0. */
  written: number
  text: string
}

/** A percent as typed: "75.76", "75.76 %", "75.76%". */
export function parsePercentText(text: string, which: string): Parsed<Percent> {
  const lead = text.length - text.trimStart().length
  const t = text.trim().replace(/\s*%$/, '')
  if (t === '') return { ok: false, error: { message: `Type the percent abundance of ${which}.`, position: 0 } }
  if (/^[-−]/.test(t)) return { ok: false, error: { message: 'An abundance can’t be negative.', position: lead, length: 1 } }
  const m = /^(\d*)(?:\.(\d*))?$/.exec(t)
  if (!m || (m[1] === '' && (m[2] ?? '') === '')) {
    const bad = t.search(/[^0-9.]/)
    return {
      ok: false,
      error: {
        message: t.includes(',') ? 'Leave the commas out: type the percent as a plain number, like 75.76.' : 'Type the percent as a plain number, like 75.76.',
        position: lead + Math.max(0, bad),
        length: 1,
      },
    }
  }
  const frac = m[2] ?? ''
  return { ok: true, value: { value: ratFromText(`${m[1] || '0'}${frac ? `.${frac}` : ''}`), written: -frac.length, text: t } }
}

function nearerIsotope(q: AbundanceQuestion): 0 | 1 {
  const m1 = ratFromText(q.isotopes[0].mass)
  const m2 = ratFromText(q.isotopes[1].mass)
  const avg = ratFromText(q.average)
  const d1 = ratSub(avg, m1)
  const d2 = ratSub(m2, avg)
  const abs = (r: Rat): Rat => (r.n < 0n ? { n: -r.n, d: r.d } : r)
  return ratCmp(abs(d1), abs(d2)) <= 0 ? 0 : 1
}

/** A box value matches a target percent: equal to the answer at the asked place, or what the exact value gives at the place she wrote. */
function matches(v: Percent, exact: Rat, rounded: Rat): boolean {
  return ratEq(v.value, rounded) || consistentAt(v.value, v.written, exact)
}

const PLACE_WORD: Record<number, string> = { [-1]: 'tenth', [-2]: 'hundredth', [-3]: 'thousandth', [-4]: 'ten-thousandth' }

/** 'the nearest hundredth of a percent' */
export function placeWords(place: number): string {
  if (place >= 0) return 'the nearest whole percent'
  return `the nearest ${PLACE_WORD[place] ?? sigFigPlaceName(place)} of a percent`
}

export function gradeAbundance(q: AbundanceQuestion, entry: [string, string]): AtomGrade {
  const [iso1, iso2] = q.isotopes
  const parsed = parseAll<{ a: Percent; b: Percent }>(
    {
      a: { box: 'abundance1', parsed: parsePercentText(entry[0], iso1.label) },
      b: { box: 'abundance2', parsed: parsePercentText(entry[1], iso2.label) },
    },
    ['a', 'b'],
  )
  if (!parsed.ok) return parsed.grade
  const { a, b } = parsed.values
  const { exact, answer } = solveAbundance(q)
  const rounded: [Rat, Rat] = [ratFromText(answer[0]), ratFromText(answer[1])]
  const typed: [Percent, Percent] = [a, b]
  const boxIds = ['abundance1', 'abundance2'] as const
  const labels = [iso1.label, iso2.label]
  const avg = q.average
  const near = nearerIsotope(q)

  /** Right for this box: the asked-for value, or a finer spelling that rounds to it. */
  const rightAt = (i: 0 | 1): boolean => {
    const v = typed[i]
    if (ratEq(v.value, rounded[i])) return true
    return v.written < q.place && consistentAt(v.value, v.written, exact[i])
  }
  const ok: [boolean, boolean] = [rightAt(0), rightAt(1)]
  if (ok[0] && ok[1]) {
    const finer = typed.some((v) => v.written < q.place && !ratEq(v.value, rounded[typed.indexOf(v)]!))
    return finishGrade(
      [okBox('abundance1'), okBox('abundance2')],
      `Right: ${labels[0]} ${answer[0]}% and ${labels[1]} ${answer[1]}%.`,
      finer ? `Rounded to ${placeWords(q.place)} as asked, that is ${answer[0]}% and ${answer[1]}%.` : undefined,
    )
  }

  const fifty = ratFromInt(50)
  if (ratEq(a.value, fifty) && ratEq(b.value, fifty)) {
    const witness = `50% and 50% would put the average exactly halfway between the two masses. ${avg} u is closer to ${q.isotopes[near].mass} u, so there is more ${labels[near]} than ${labels[1 - near]}.`
    return finishGrade([namedBox('abundance1', 'at_assumed_even_split', witness), namedBox('abundance2', 'at_assumed_even_split', witness)], '')
  }

  if (matches(a, exact[1], rounded[1]) && matches(b, exact[0], rounded[0])) {
    const witness = `Those are the right two numbers in the wrong rows. The average, ${avg} u, is closer to ${labels[near]} (${q.isotopes[near].mass} u), so ${labels[near]} gets the bigger percent.`
    return finishGrade([namedBox('abundance1', 'at_abundance_swapped', witness), namedBox('abundance2', 'at_abundance_swapped', witness)], '')
  }

  const total = ratAdd(a.value, b.value)
  // Two fractions that add to 1: the percent step was skipped. Plain, specific message.
  if (ratEq(total, ratFromInt(1)) || (ratCmp(a.value, ratFromInt(1)) < 0 && ratCmp(b.value, ratFromInt(1)) < 0)) {
    const msg = `${a.text} and ${b.text} look like fractions of 1. A percent is the fraction × 100, so ${a.text} would be ${display(ratMul(a.value, R100))}%.`
    return finishGrade([ok[0] ? okBox('abundance1') : plainBox('abundance1', msg), ok[1] ? okBox('abundance2') : plainBox('abundance2', msg)], '')
  }

  if (!ratEq(total, R100)) {
    const witness = `${a.text}% + ${b.text}% = ${textAt(total, Math.min(a.written, b.written, 0))}%, but the two isotopes make up all of ${q.element}: the percents must total exactly 100%.`
    const boxes: AtomBoxGrade[] = [0, 1].map((i) => (ok[i] ? okBox(boxIds[i]!) : namedBox(boxIds[i]!, 'at_abundance_sum', witness)))
    return finishGrade(boxes, '')
  }

  // They total 100 but do not reproduce the average: say what average they WOULD give.
  const m1 = ratFromText(iso1.mass)
  const m2 = ratFromText(iso2.mass)
  const would = ratDiv(ratAdd(ratMul(a.value, m1), ratMul(b.value, m2)), R100)
  const avgPlace = -(avg.split('.')[1]?.length ?? 0)
  let shownPlace = avgPlace
  while (ratEq(roundedAt(would, shownPlace), ratFromText(avg)) && shownPlace > avgPlace - 4) shownPlace--
  const check = `With ${a.text}% and ${b.text}%, the average would be ${minusText(textAt(would, shownPlace))} u, not ${avg} u.`
  const boxes: AtomBoxGrade[] = [0, 1].map((i) => {
    const idx = i as 0 | 1
    if (ok[idx]) return okBox(boxIds[idx])
    const v = typed[idx]
    if (v.written > q.place && consistentAt(v.value, v.written, exact[idx]))
      return plainBox(boxIds[idx], `Right as far as it goes: give ${labels[idx]} to ${placeWords(q.place)}, as the question asks.`)
    return plainBox(boxIds[idx], check)
  })
  return finishGrade(boxes, '')
}

/** Worked explanation (hint rung 3 and after a right answer). Reveals the answer. */
export function explainAbundance(q: AbundanceQuestion): string[] {
  const [iso1, iso2] = q.isotopes
  const m1 = ratFromText(iso1.mass)
  const m2 = ratFromText(iso2.mass)
  const avg = ratFromText(q.average)
  const { exact, answer } = solveAbundance(q)
  const x = ratDiv(exact[0], R100)
  const top = ratSub(avg, m2)
  const bottom = ratSub(m1, m2)
  const near = nearerIsotope(q)
  return [
    `Let x be the fraction of ${iso1.label}. The rest, 1 − x, is ${iso2.label}, because the two isotopes make up all of ${q.element}.`,
    `Weighted average: x × ${iso1.mass} + (1 − x) × ${iso2.mass} = ${q.average}.`,
    `Collect the x terms: ${iso2.mass} + (${iso1.mass} − ${iso2.mass})x = ${q.average}, so ${minusText(display(bottom))}x = ${minusText(display(top))}.`,
    `x = ${minusText(display(top))} ÷ ${bottom.n < 0n ? `(${minusText(display(bottom))})` : display(bottom)} = ${display(x)}`,
    `As a percent (× 100) to ${placeWords(q.place)}: ${iso1.label} is ${answer[0]}%, and ${iso2.label} is 100% − ${answer[0]}% = ${answer[1]}%.`,
    `Check: the average ${q.average} u is closer to ${q.isotopes[near].mass} u, and ${q.isotopes[near].label} does have the bigger share.`,
  ]
}
