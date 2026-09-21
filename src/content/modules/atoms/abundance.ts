/**
 * atom.abundance — two isotopes and the average atomic mass are given; find each percent abundance:
 * x·m₁ + (1 − x)·m₂ = average.
 *
 * Real elements: the isotope masses come from NATURAL_ISOTOPES, and the average given is that table's
 * own weighted average, rounded to the fewest decimals that still solve back to the table's
 * abundances exactly (so the answer IS the published abundance). Made-up element X: masses to the
 * ten-thousandth of a u and an abundance to the hundredth of a percent, averaged exactly. Both
 * percents are asked for to a stated place, so the right answers total exactly 100. Elements whose
 * isotopes are close to 50/50 (Br, Ag) are left out: assuming 50/50 would be nearly right there.
 */
import type { Rng } from '@/content/rng'
import { abundanceIssues, atomTextAt, exactAverageMass, percentPlaceWords, solveAbundance } from '@/engine'
import { elementBySymbol, NATURAL_ISOTOPES } from '@/engine/chem/elements'
import type { AtomIsotopeRow, AtomQuestion } from '@/shared/types'
import { fromInteger } from '../sigFigs/numbers'
import { makeAtomTemplate, type AtomDraft, type AtomScenario } from './build'
import { atRule } from './rules'

const R = atRule

const NUDGE =
  'Call the first isotope’s fraction x, so the other one is 1 − x. Set x·(its mass) + (1 − x)·(the other mass) equal to the average, solve for x, then turn it into a percent.'

const RULES = [R('abundance'), R('weighted'), R('percent')]

/** Two-isotope elements whose minor isotope is between 5% and 40%. */
export const ABUNDANCE_ELEMENTS = ['Li', 'B', 'Cl', 'Cu', 'Ga', 'Rb'] as const

type AbundanceQuestion = Extract<AtomQuestion, { kind: 'abundance' }>

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function prompt(q: AbundanceQuestion): string {
  return `The average atomic mass of ${q.element} is ${q.average} u. Find the percent abundance of each isotope, to ${percentPlaceWords(q.place)}.`
}

/** The real question for an element: the shortest average (3 to 6 decimals) that solves back to the published abundances. */
export function realAbundanceQuestion(symbol: string): AbundanceQuestion | null {
  const el = elementBySymbol(symbol)
  const isos = NATURAL_ISOTOPES[symbol]
  if (!el || !isos || isos.length !== 2) return null
  const rows: AtomIsotopeRow[] = isos.map((i) => ({ label: `${el.name}-${i.massNumber}`, massNumber: i.massNumber, mass: i.mass, abundance: i.abundance }))
  const exact = exactAverageMass(rows)
  const place = -(isos[0]!.abundance.split('.')[1]?.length ?? 0)
  for (let decimals = 3; decimals <= 6; decimals++) {
    const q: AbundanceQuestion = {
      kind: 'abundance',
      element: el.name,
      symbol,
      fictional: false,
      isotopes: [
        { label: rows[0]!.label, massNumber: rows[0]!.massNumber, mass: rows[0]!.mass },
        { label: rows[1]!.label, massNumber: rows[1]!.massNumber, mass: rows[1]!.mass },
      ],
      average: atomTextAt(exact, -decimals),
      place,
    }
    if (abundanceIssues(q).length > 0) continue
    const { answer } = solveAbundance(q)
    if (answer[0] === isos[0]!.abundance && answer[1] === isos[1]!.abundance) return q
  }
  return null
}

function drawReal(rng: Rng): AtomDraft | null {
  const symbol = rng.pick(ABUNDANCE_ELEMENTS)
  const q = realAbundanceQuestion(symbol)
  if (!q) return null
  return {
    question: q,
    prompt: prompt(q),
    context: `${capital(q.element)} has two natural isotopes.`,
    unit: '%',
    trap: 'two-isotope-solve',
    nudge: NUDGE,
    ruleCards: RULES,
    params: { element: symbol, fictional: false },
  }
}

function drawElementX(rng: Rng): AtomDraft | null {
  const a1 = rng.int(20, 110)
  const a2 = a1 + rng.pick([1, 2])
  const m1 = fromInteger(a1 * 10000 - rng.int(50, 950), 4)
  const m2 = fromInteger(a2 * 10000 - rng.int(50, 950), 4)
  const low = rng.int(1000, 3800) // hundredths of a percent
  const p1 = rng.chance(0.5) ? low : 10000 - low
  const rows: AtomIsotopeRow[] = [
    { label: `X-${a1}`, massNumber: a1, mass: m1, abundance: fromInteger(p1, 2) },
    { label: `X-${a2}`, massNumber: a2, mass: m2, abundance: fromInteger(10000 - p1, 2) },
  ]
  const q: AbundanceQuestion = {
    kind: 'abundance',
    element: 'element X',
    symbol: 'X',
    fictional: true,
    isotopes: [
      { label: rows[0]!.label, massNumber: a1, mass: m1 },
      { label: rows[1]!.label, massNumber: a2, mass: m2 },
    ],
    average: atomTextAt(exactAverageMass(rows), -4),
    place: -2,
  }
  if (abundanceIssues(q).length > 0) return null
  const { answer } = solveAbundance(q)
  if (answer[0] !== rows[0]!.abundance || answer[1] !== rows[1]!.abundance) return null
  return {
    question: q,
    prompt: prompt(q),
    context: 'Element X is made up, with two isotopes.',
    unit: '%',
    trap: 'two-isotope-solve',
    nudge: NUDGE,
    ruleCards: RULES,
    params: { element: 'X', fictional: true },
  }
}

export const ABUNDANCE_SCENARIOS: AtomScenario[] = [
  { id: 'real', weight: 3, draw: drawReal },
  { id: 'element-x', weight: 2, draw: drawElementX },
]

const fallbackQuestion: AbundanceQuestion = {
  kind: 'abundance',
  element: 'chlorine',
  symbol: 'Cl',
  fictional: false,
  isotopes: [
    { label: 'chlorine-35', massNumber: 35, mass: '34.969' },
    { label: 'chlorine-37', massNumber: 37, mass: '36.966' },
  ],
  average: '35.453',
  place: -2,
}

export const abundanceTemplate = makeAtomTemplate({
  id: 'atom.abundance',
  title: 'Percent abundance',
  description: 'Work backwards from the average atomic mass to how common each of two isotopes is.',
  version: 1,
  instructions: 'Find the percent abundance of each isotope, to the place asked.',
  scenarios: ABUNDANCE_SCENARIOS,
  fallback: {
    question: fallbackQuestion,
    prompt: prompt(fallbackQuestion),
    context: 'Chlorine has two natural isotopes.',
    unit: '%',
    trap: 'two-isotope-solve',
    nudge: NUDGE,
    ruleCards: RULES,
  },
})
