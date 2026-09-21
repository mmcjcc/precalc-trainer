/**
 * atom.avgmass — average atomic mass from an isotope table (isotopic mass in u, percent abundance).
 *
 * Real tables come straight from NATURAL_ISOTOPES (the two- and three-isotope elements whose answer
 * is clean and matches the periodic table); CK-12-style made-up "element X" tables are generated
 * exactly (masses to the thousandth of a u, abundances to the hundredth of a percent, summing to
 * exactly 100). The calculation is a significant-figures `mixed` task (engine `averageMassTask`);
 * every draw is validated with `validateSigFigTask` and redrawn on any issue, and kept only when the
 * trap it is built around really shows (its mistaken answer differs from the right one and from
 * every figure-rule slip).
 */
import type { Rng } from '@/content/rng'
import { averageMassMistakeCandidates, averageMassTask, validateSigFigTask } from '@/engine'
import { elementBySymbol, NATURAL_ISOTOPES } from '@/engine/chem/elements'
import type { AtomIsotopeRow, AtomQuestion, ErrorPatternId } from '@/shared/types'
import { fromInteger } from '../sigFigs/numbers'
import { makeAtomTemplate, type AtomDraft, type AtomScenario } from './build'
import { compareDecimalText } from './isotopes'
import { atRule } from './rules'

const R = atRule

const NUDGE =
  'This is a weighted average: change each percent to a decimal, multiply it by that isotope’s mass, then add. The answer should land between the isotope masses, nearest the most common one.'

const RULES = [R('weighted'), R('percent'), R('figures')]

/** Real elements used (hydrogen is left out: its deuterium term forces a six-figure answer). */
export const REAL_TWO = ['Li', 'B', 'C', 'N', 'Cl', 'Cu', 'Ga', 'Br', 'Rb', 'Ag'] as const
export const REAL_THREE = ['O', 'Mg', 'Si', 'K'] as const

const NUMBER_WORDS: Record<number, string> = { 2: 'two', 3: 'three' }

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type AvgQuestion = Extract<AtomQuestion, { kind: 'avgmass' }>

/** The engine has no complaint about the task, and the named mistakes the trap promises are all visible. */
export function avgmassShows(q: AvgQuestion, need: ErrorPatternId[], minorLabel?: string): boolean {
  if (validateSigFigTask(q.task).length > 0) return false
  const cands = averageMassMistakeCandidates(q)
  if (!need.every((id) => cands.some((c) => c.id === id))) return false
  if (minorLabel !== undefined && !cands.some((c) => c.id === 'at_isotope_left_out' && c.witness.includes(`leaves out ${minorLabel} `))) return false
  return true
}

const BASE_NEED: ErrorPatternId[] = ['at_percent_not_decimal', 'at_unweighted_average', 'at_isotope_left_out']

export function realQuestion(symbol: string): AvgQuestion {
  const el = elementBySymbol(symbol)
  const isos = NATURAL_ISOTOPES[symbol]
  if (!el || !isos) throw new Error(`atoms: no isotope table for ${symbol}`)
  const isotopes: AtomIsotopeRow[] = isos.map((i) => ({ label: `${el.name}-${i.massNumber}`, massNumber: i.massNumber, mass: i.mass, abundance: i.abundance }))
  return { kind: 'avgmass', element: el.name, symbol, fictional: false, isotopes, task: averageMassTask(isotopes) }
}

function rarest(rows: AtomIsotopeRow[]): AtomIsotopeRow {
  let best = rows[0]!
  for (const r of rows) if (compareDecimalText(r.abundance, best.abundance) < 0) best = r
  return best
}

function drawReal(rng: Rng, symbols: readonly string[], trap: string): AtomDraft | null {
  const symbol = rng.pick(symbols)
  const q = realQuestion(symbol)
  const minor = q.isotopes.length > 2 ? rarest(q.isotopes).label : undefined
  if (!avgmassShows(q, BASE_NEED, minor)) return null
  return {
    question: q,
    prompt: `Find the average atomic mass of ${q.element} from its natural isotopes.`,
    context: `${capital(q.element)} occurs in nature as ${NUMBER_WORDS[q.isotopes.length] ?? q.isotopes.length} isotopes.`,
    unit: 'u',
    trap,
    nudge: NUDGE,
    ruleCards: RULES,
    params: { element: symbol, fictional: false, isotopes: q.isotopes.length },
  }
}

/** A made-up element X: mass numbers 20–112, masses a little under each mass number, abundances summing to 100.00. */
function drawElementX(rng: Rng, count: 2 | 3, trap: string): AtomDraft | null {
  const first = rng.int(20, 110)
  const gaps = count === 2 ? [rng.pick([1, 2])] : rng.pick([[1, 1], [1, 2], [2, 1], [2, 2]])
  const massNumbers = [first]
  for (const g of gaps) massNumbers.push(massNumbers[massNumbers.length - 1]! + g)
  // Isotopic masses a little under the mass number, as for real nuclei in this range (thousandths of a u).
  const masses = massNumbers.map((A) => fromInteger(A * 1000 - rng.int(5, 95), 3))
  // Abundances in hundredths of a percent, summing to exactly 10000.
  let hundredths: number[]
  if (count === 2) {
    const major = rng.int(5500, 9500)
    hundredths = rng.chance(0.5) ? [major, 10000 - major] : [10000 - major, major]
  } else {
    const major = rng.int(6000, 9000)
    const rest = 10000 - major
    const a = rng.int(100, rest - 100)
    hundredths = rng.shuffle([major, a, rest - a])
  }
  const isotopes: AtomIsotopeRow[] = massNumbers.map((A, i) => ({ label: `X-${A}`, massNumber: A, mass: masses[i]!, abundance: fromInteger(hundredths[i]!, 2) }))
  const q: AvgQuestion = { kind: 'avgmass', element: 'element X', symbol: 'X', fictional: true, isotopes, task: averageMassTask(isotopes) }
  const minorIndex = hundredths.indexOf(Math.min(...hundredths))
  const need: ErrorPatternId[] = [...BASE_NEED, 'at_mass_numbers_used']
  if (!avgmassShows(q, need, count === 3 ? isotopes[minorIndex]!.label : undefined)) return null
  return {
    question: q,
    prompt: 'Find the average atomic mass of element X.',
    context: `Element X is made up, but its ${NUMBER_WORDS[count]} isotopes work just like a real element’s.`,
    unit: 'u',
    trap,
    nudge: NUDGE,
    ruleCards: RULES,
    params: { element: 'X', fictional: true, isotopes: count },
  }
}

export const AVGMASS_SCENARIOS: AtomScenario[] = [
  { id: 'real-two', weight: 3, draw: (rng) => drawReal(rng, REAL_TWO, 'weighted-average') },
  { id: 'real-three', weight: 2, draw: (rng) => drawReal(rng, REAL_THREE, 'minor-isotope') },
  { id: 'element-x-two', weight: 2, draw: (rng) => drawElementX(rng, 2, 'mass-numbers') },
  { id: 'element-x-three', weight: 2, draw: (rng) => drawElementX(rng, 3, 'minor-isotope') },
]

const fallbackQuestion = realQuestion('Cl')

export const avgmassTemplate = makeAtomTemplate({
  id: 'atom.avgmass',
  title: 'Average atomic mass',
  description: 'The weighted average of an isotope table, real elements and a made-up element X, with the significant figures right.',
  version: 1,
  instructions: 'Find the weighted average of the isotope masses, in u, rounded to the right number of significant figures.',
  scenarios: AVGMASS_SCENARIOS,
  fallback: {
    question: fallbackQuestion,
    prompt: 'Find the average atomic mass of chlorine from its natural isotopes.',
    context: 'Chlorine occurs in nature as two isotopes.',
    unit: 'u',
    trap: 'weighted-average',
    nudge: NUDGE,
    ruleCards: RULES,
  },
})
