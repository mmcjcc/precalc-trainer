/**
 * Grading a typed electron configuration, full or noble-gas shorthand, for an atom or an ion.
 *
 * The order she types the subshells in is never graded (4s2 3d6 and 3d6 4s2 are the same answer). The checks
 * run in this order, and the first one that fires is the verdict:
 *
 *   1. form: shorthand where the full configuration was asked (or the reverse) is `invalid`, not an attempt;
 *   2. the core of a shorthand answer (rule checks on what she typed):
 *        - not a noble gas, an earlier noble gas with the right tail, or an earlier one that leaves her
 *          spelling out a full shell                                              → core_wrong
 *        - the element itself, or a noble gas with more electrons than the species → core_not_earlier
 *   3. a subshell that does not exist (1p, 2d, 3f)                                → subshell_nonexistent
 *   4. a subshell over its maximum (s 2, p 6, d 10)                               → subshell_overfilled
 *   5. the two exception slips, which are exact configurations:
 *        - Cr or Cu written by the plain filling order (4s2 3d4, 4s2 3d9)         → exception_missed
 *        - one 4s electron moved to 3d in an element that is not Cr or Cu         → exception_misapplied
 *   6. a later subshell holding electrons while an earlier one has room (a subshell skipped, or 3d before
 *      4s). It comes BEFORE the count, because "you skipped 3d" explains "10 too few"  → filling_order
 *   7. the total number of electrons:
 *        - atom: any other total                                                  → electron_count
 *        - ion: as many as the neutral atom                                       → ion_charge_ignored
 *               the charge applied the wrong way (Z + charge)                     → ion_wrong_direction
 *               the right way, the wrong amount                                   → ion_wrong_number
 *               anything else                                                     → electron_count
 *   8. the right total: a transition-metal cation that still has 4s electrons     → ion_removed_from_3d
 */
import type { ParseError } from '@/shared/types'
import {
  aufbau,
  canonicalCore,
  chargeSize,
  deriveConfiguration,
  elementOf,
  EXCEPTION_ELEMENTS,
  fillingCompare,
  FILLING_ORDER_TEXT,
  neutralConfiguration,
  NOBLE_GAS_CORES,
  occupancyOf,
  configOfOccupancy,
  removeFrom3dFirst,
  resolveSpecies,
  restAfterCore,
  sameConfiguration,
  sameOccupancy,
  speciesDisplay,
  speciesProblem,
  SUBSHELL_CAPACITY,
  SUBSHELL_ORBITALS,
  subshellExists,
  subshellName,
  totalElectrons,
  type Occupancy,
} from './model'
import { parseConfiguration } from './parse'
import { aLetter, capitalized, listWords, nameOf, plural, termDisplay, termsDisplay, termsText } from './text'
import type {
  ConfigurationMistakeCandidate,
  EconfigForm,
  EconfigGrade,
  EconfigMistakeKind,
  EconfigSpecies,
  EconfigSpeciesLike,
  NobleGasCore,
  ParsedConfiguration,
  Subshell,
  SubshellCount,
  SubshellLetter,
} from './types'

export interface ConfigurationGradeOptions {
  /** Which form the question asks for. 'either' (the default) accepts both. */
  form?: EconfigForm | 'either'
}

interface Target {
  sp: EconfigSpecies
  /** "iron" */
  name: string
  /** "Fe³⁺" */
  label: string
  electrons: number
  config: SubshellCount[]
  occ: Occupancy
  /** The shorthand's core and what follows it (the whole configuration when there is no core). */
  core: NobleGasCore | null
  rest: SubshellCount[]
  transition: boolean
}

function targetOf(sp: EconfigSpecies): Target {
  const config = deriveConfiguration(sp.z, sp.charge)
  const core = canonicalCore(sp)
  const group = elementOf(sp).group
  return {
    sp,
    name: nameOf(sp.z),
    label: speciesDisplay(sp),
    electrons: sp.z - sp.charge,
    config,
    occ: occupancyOf(config),
    core,
    rest: (core && restAfterCore(config, core)) || config,
    transition: group !== null && group >= 3 && group <= 12,
  }
}

const mistake = (kind: EconfigMistakeKind, witness: string): EconfigGrade => ({ verdict: 'mistake', mistake: kind, witness })
const wrong = (message: string): EconfigGrade => ({ verdict: 'wrong', message })

export function invalidGrade(e: ParseError): EconfigGrade {
  return e.length === undefined ? { verdict: 'invalid', message: e.message, position: e.position } : { verdict: 'invalid', message: e.message, position: e.position, length: e.length }
}

const SHELL_LETTERS: readonly SubshellLetter[] = ['s', 'p', 'd', 'f']

/** Every subshell that exists up to shell 9, in filling order. */
const ALL_SUBSHELLS: readonly Subshell[] = (() => {
  const out: Subshell[] = []
  for (let n = 1; n <= 9; n++) for (const l of SHELL_LETTERS) if (subshellExists({ n, l })) out.push({ n, l })
  return out.sort(fillingCompare)
})()

/** " (18 in [Ar] + 2 + 5 = 25)": how her total adds up. Empty for a single number. */
function sumText(her: ParsedConfiguration, total: number): string {
  const parts = [...(her.core ? [`${her.core.z} in [${her.core.symbol}]`] : []), ...her.terms.map((t) => String(t.count))]
  return parts.length >= 2 ? ` (${parts.join(' + ')} = ${total})` : ''
}

/** Her answer as she wrote it, tidied: "[Ar] 4s² 3d⁶". */
function herDisplay(her: ParsedConfiguration): string {
  return [her.core ? `[${her.core.symbol}]` : '', termsDisplay(her.terms)].filter((s) => s !== '').join(' ')
}

function stableWord(z: number): string {
  return z === 24 ? 'half-filled' : 'completely filled'
}

function correctGrade(t: Target, her: ParsedConfiguration): EconfigGrade {
  const notes: string[] = []
  const { sp } = t
  if (sp.charge === 0 && EXCEPTION_ELEMENTS.includes(sp.z))
    notes.push(
      `${capitalized(t.name)} is one of the two exceptions: one electron moves from 4s to 3d, because a ${stableWord(sp.z)} 3d subshell (${termDisplay({ n: 3, l: 'd', count: t.occ.get('3d') ?? 0 })}) is extra stable.`,
    )
  if (sp.charge > 0 && t.transition) notes.push('The 4s electrons leave first, before any 3d electron.')
  if (sp.charge !== 0) {
    const gas = NOBLE_GAS_CORES.find((g) => g.z === t.electrons)
    if (gas && sameConfiguration(t.config, aufbau(gas.z))) notes.push(`That is the same configuration as ${nameOf(gas.z)}.`)
  }
  return { verdict: 'correct', message: [`Correct: ${t.label} is ${herDisplay(her)}.`, ...notes].join(' ') }
}

function countGrade(t: Target, her: ParsedConfiguration, total: number): EconfigGrade {
  const { z, charge } = t.sp
  const sum = sumText(her, total)
  const has = `Your configuration has ${plural(total, 'electron')}${sum}`
  if (charge === 0) {
    const diff = total - z
    return mistake('electron_count', `${has}, ${Math.abs(diff)} too ${diff > 0 ? 'many' : 'few'}. A neutral ${t.name} atom has ${z}, the same as its atomic number.`)
  }
  const k = Math.abs(charge)
  const arithmetic = charge > 0 ? `${z} − ${k} = ${t.electrons}` : `${z} + ${k} = ${t.electrons}`
  const size = chargeSize(charge)
  if (total === z)
    return mistake(
      'ion_charge_ignored',
      `${has}, as many as a neutral ${t.name} atom. ${t.label} has a ${size} charge, so it has ${charge > 0 ? 'lost' : 'gained'} ${plural(k, 'electron')}: ${arithmetic}.`,
    )
  if (total === z + charge)
    return mistake(
      'ion_wrong_direction',
      charge > 0
        ? `${has}, ${k} MORE than the ${z} of a neutral ${t.name} atom. Electrons are negative, so a ${size} charge means the atom LOST ${plural(k, 'electron')}: ${arithmetic}.`
        : `${has}, ${k} FEWER than the ${z} of a neutral ${t.name} atom. Electrons are negative, so a ${size} charge means the atom GAINED ${plural(k, 'electron')}: ${arithmetic}.`,
    )
  const moved = charge > 0 ? z - total : total - z
  if (moved > 0)
    return mistake(
      'ion_wrong_number',
      `${has}, ${moved} ${charge > 0 ? 'fewer' : 'more'} than the ${z} of a neutral ${t.name} atom. A ${size} charge means ${plural(k, 'electron')} ${k === 1 ? 'is' : 'are'} ${charge > 0 ? 'removed' : 'added'}, not ${moved}: ${arithmetic}.`,
    )
  return mistake('electron_count', `${has}. ${t.label} has ${arithmetic} electrons: the ${z} of a neutral ${t.name} atom, ${charge > 0 ? 'minus' : 'plus'} ${k} for the ${size} charge.`)
}

interface OrderViolation {
  /** The earlier subshell that still has room, with what she put in it. */
  open: SubshellCount
  /** The later subshell that already holds electrons. */
  later: SubshellCount
}

function firstOrderViolation(occ: Occupancy, skip4s: boolean): OrderViolation | null {
  let open: SubshellCount | null = null
  for (const s of ALL_SUBSHELLS) {
    if (skip4s && s.n === 4 && s.l === 's') continue
    const count = occ.get(subshellName(s)) ?? 0
    if (open && count > 0) return { open, later: { n: s.n, l: s.l, count } }
    if (!open && count < SUBSHELL_CAPACITY[s.l]) open = { n: s.n, l: s.l, count }
  }
  return null
}

function orderWitness(v: OrderViolation, occ: Occupancy): string {
  const a = subshellName(v.open)
  const b = subshellName(v.later)
  const order = `Subshells fill in this order: ${FILLING_ORDER_TEXT}.`
  if (a === '4s' && b === '3d')
    return `You put ${plural(v.later.count, 'electron')} in 3d while 4s ${v.open.count === 0 ? 'is still empty' : `has only ${v.open.count}`}. 4s is slightly lower in energy than 3d, so 4s fills first, right after 3p. ${order}`
  if (b === '4d' && (occ.get('3d') ?? 0) === 0)
    return `You wrote 4d, but the d subshell that fills in period 4 is 3d: a d subshell is one shell number behind the s subshell just before it (4s, then 3d, then 4p). ${order}`
  if (v.open.count === 0) return `You skipped ${a}: it comes before ${b} and has to fill first. ${order}`
  return `You moved on to ${b} while ${a} has only ${v.open.count} of its ${SUBSHELL_CAPACITY[v.open.l]} electrons. A subshell fills completely before the next one starts. ${order}`
}

function nonexistentWitness(term: SubshellCount): string {
  const letters = SHELL_LETTERS.slice(0, term.n)
  const firstShell = SHELL_LETTERS.indexOf(term.l) + 1
  return `There is no ${subshellName(term)} subshell. Shell ${term.n} has only ${letters.length === 1 ? 'an s subshell' : `${listWords([...letters])} subshells`}: ${term.l} subshells start at shell ${firstShell}.`
}

function overfilledWitness(term: SubshellCount): string {
  const orbitals = SUBSHELL_ORBITALS[term.l]
  return `${termDisplay(term)} is too many: ${aLetter(term.l)} subshell has ${plural(orbitals, 'orbital')} with 2 electrons each, so it holds at most ${SUBSHELL_CAPACITY[term.l]}. Once ${subshellName(term)} is full, the next electron starts the next subshell.`
}

function gradeParsed(t: Target, her: ParsedConfiguration): EconfigGrade {
  const { sp } = t
  let coreConfig: SubshellCount[] = []

  if (her.core) {
    const c = her.core
    const gas = `[${c.symbol}]`
    if (!c.nobleGas)
      return mistake(
        'core_wrong',
        `Only a noble gas can go in the brackets, because all of its subshells are full. ${c.symbol} (${nameOf(c.z)}) is not a noble gas. ${sp.charge === 0 ? `Use the noble gas that comes just before ${t.name} in the periodic table.` : `Use a noble gas with no more electrons than ${t.label} has (${t.electrons}).`}`,
      )
    if (sp.charge === 0 && c.z === sp.z)
      return mistake(
        'core_not_earlier',
        t.core
          ? `${gas} is ${t.name} itself, so it cannot stand in for part of ${t.name}'s own configuration. The shorthand starts from the noble gas BEFORE the element: for ${t.name} that is ${nameOf(t.core.z)}, [${t.core.symbol}].`
          : `${gas} is ${t.name} itself, and no noble gas comes before ${t.name}. Write its configuration out in full.`,
      )
    if (c.z > t.electrons)
      return mistake(
        'core_not_earlier',
        sp.charge === 0
          ? `${gas} stands for ${nameOf(c.z)}'s ${c.z} electrons, more than the ${sp.z} in ${t.name}. The core is the noble gas that comes BEFORE ${t.name} in the periodic table, never one after it.`
          : `${gas} stands for ${nameOf(c.z)}'s ${c.z} electrons, but ${t.label} has only ${t.electrons}. The core can never hold more electrons than the ion itself.`,
      )
    coreConfig = aufbau(c.z)
    const repeated = her.terms.find((term) => coreConfig.some((k) => k.n === term.n && k.l === term.l))
    if (repeated)
      return wrong(`${gas} already includes ${termDisplay(coreConfig.find((k) => k.n === repeated.n && k.l === repeated.l)!)}. After the brackets, write only the subshells that come after ${nameOf(c.z)}.`)
  }

  const occ = occupancyOf([...coreConfig, ...her.terms])
  const total = totalElectrons(coreConfig) + totalElectrons(her.terms)
  const equal = sameOccupancy(occ, t.occ)

  if (her.core && t.core && her.core.z < t.core.z) {
    const gas = `[${her.core.symbol}]`
    const right = `[${t.core.symbol}]`
    const previous = NOBLE_GAS_CORES[NOBLE_GAS_CORES.findIndex((g) => g.z === t.core!.z) - 1]
    if (equal) {
      // An ion with exactly a noble gas's configuration: [Ne] and [He] 2s2 2p6 are both fine for Na+.
      if (sp.charge !== 0 && t.rest.length === 0 && previous?.z === her.core.z) return correctGrade(t, her)
      const covered = restAfterCore(aufbau(t.core.z), her.core) ?? []
      return mistake(
        'core_wrong',
        `Every electron is in the right place, but the shorthand uses ${sp.charge === 0 ? `the noble gas JUST before ${t.name}` : `the nearest noble gas with no more electrons than ${t.label}`}: ${nameOf(t.core.z)}. ${right} already covers ${termsDisplay(covered)}, so only what comes after ${nameOf(t.core.z)} is written out.`,
      )
    }
    if (sameConfiguration(her.terms, t.rest))
      return mistake(
        'core_wrong',
        `${gas} stands for ${nameOf(her.core.z)}'s ${her.core.z} electrons. ${sp.charge === 0 ? `The noble gas just before ${t.name} is ${nameOf(t.core.z)}, ${right}, with ${t.core.z}` : `${t.label} has ${t.electrons} electrons, and the noble gas to start from is ${nameOf(t.core.z)}, ${right}, with ${t.core.z}`}: with ${gas} your configuration has only ${plural(total, 'electron')}.`,
      )
  }
  if (equal) return correctGrade(t, her)

  const ghost = her.terms.find((term) => !subshellExists(term))
  if (ghost) return mistake('subshell_nonexistent', nonexistentWitness(ghost))
  const over = her.terms.find((term) => term.count > SUBSHELL_CAPACITY[term.l])
  if (over) return mistake('subshell_overfilled', overfilledWitness(over))

  const her4s = occ.get('4s') ?? 0
  const her3d = occ.get('3d') ?? 0
  const right4s = t.occ.get('4s') ?? 0
  const right3d = t.occ.get('3d') ?? 0
  const exception = sp.charge === 0 && EXCEPTION_ELEMENTS.includes(sp.z)
  const transitionCation = sp.charge > 0 && t.transition && right4s === 0

  // The two exception slips are exact configurations (with the right total), so they are named first.
  if (exception && sameOccupancy(occ, occupancyOf(aufbau(sp.z))))
    return mistake(
      'exception_missed',
      `4s² 3d${sp.z === 24 ? '⁴' : '⁹'} follows the filling order exactly, but ${t.name} is one of the two exceptions among the first 36 elements. A ${stableWord(sp.z)} d subshell (3d${sp.z === 24 ? '⁵' : '¹⁰'}) is extra stable, so one electron moves from 4s to 3d.`,
    )
  if (sp.charge === 0 && !exception && t.transition && right4s === 2 && right3d >= 1 && right3d <= 9) {
    const moved: Occupancy = new Map(t.occ)
    moved.set('4s', 1)
    moved.set('3d', right3d + 1)
    if (sameOccupancy(occ, moved))
      return mistake(
        'exception_misapplied',
        `You moved an electron from 4s to 3d (4s¹ ${termDisplay({ n: 3, l: 'd', count: her3d })}). Only chromium and copper do that, because it gives them a half-filled (3d⁵) or completely filled (3d¹⁰) d subshell. ${termDisplay({ n: 3, l: 'd', count: her3d })} is neither, so ${t.name} follows the normal order and fills 4s completely.`,
      )
  }

  // A skipped or half-finished subshell explains a wrong total better than the total does, so it comes
  // first. 4s is left out of the check where the right answer itself has 3d ahead of a full 4s: a
  // transition-metal cation (no 4s at all), and chromium or copper written with their one 4s electron.
  const violation = firstOrderViolation(occ, transitionCation || (exception && her4s === 1))
  if (violation) return mistake('filling_order', orderWitness(violation, occ))

  if (total !== t.electrons) return countGrade(t, her, total)

  if (transitionCation && her4s > 0)
    return mistake(
      'ion_removed_from_3d',
      `Your configuration still has ${plural(her4s, 'electron')} in 4s. When a transition metal becomes a positive ion, the 4s electrons leave FIRST, before any 3d electron: 4s is the outermost shell (n = 4). ${t.label} has no 4s electrons left.`,
    )
  const differing = [...new Set([...occ.keys(), ...t.occ.keys()])].filter((key) => (occ.get(key) ?? 0) !== (t.occ.get(key) ?? 0))
  return wrong(`Your configuration has the right number of electrons, ${t.electrons}, but not all of them are in the right subshells. Look again at ${listWords(differing)}.`)
}

/**
 * Grade a typed configuration. `form` says what the question asked for: 'full', 'shorthand', or 'either'
 * (the default: both accepted). See the file comment for the order of the checks.
 */
export function gradeConfiguration(species: EconfigSpeciesLike, answer: string, options: ConfigurationGradeOptions = {}): EconfigGrade {
  const problem = speciesProblem(species)
  if (problem) return { verdict: 'unsupported', message: problem }
  const t = targetOf(resolveSpecies(species)!)
  const parsed = parseConfiguration(answer)
  if (!parsed.ok) return invalidGrade(parsed.error)
  const her = parsed.value
  const form = options.form ?? 'either'
  if (form === 'full' && her.core)
    return {
      verdict: 'invalid',
      message: 'That is the noble-gas shorthand. This question asks for the full configuration: write out every subshell, starting from 1s.',
      position: her.core.position,
      length: her.core.length,
    }
  // Hydrogen, helium and two-electron ions have nothing to abbreviate, so "1s2" is their shorthand too.
  if (form === 'shorthand' && !her.core && t.electrons > 2)
    return {
      verdict: 'invalid',
      message: 'This question asks for the noble-gas shorthand: start with a noble gas in square brackets, like [Ne], then write only the subshells that come after it.',
      position: 0,
    }
  return gradeParsed(t, her)
}

/** The full configuration, 1s2 2s2 2p6 …; a shorthand answer is `invalid` (wrong form, not an attempt). */
export function gradeFullConfiguration(species: EconfigSpeciesLike, answer: string): EconfigGrade {
  return gradeConfiguration(species, answer, { form: 'full' })
}

/** The noble-gas shorthand, [Ar] 4s2 3d6; an answer with no bracketed core is `invalid`. */
export function gradeShorthandConfiguration(species: EconfigSpeciesLike, answer: string): EconfigGrade {
  return gradeConfiguration(species, answer, { form: 'shorthand' })
}

// ---------------------------------------------------------------------------
// What each mistake would produce
// ---------------------------------------------------------------------------

interface RawCandidate {
  kind: EconfigMistakeKind
  config?: SubshellCount[]
  /** A ready-made text (the core mistakes, which are about the brackets). */
  text?: string
}

function tryDerive(z: number, charge: number): SubshellCount[] | undefined {
  try {
    const config = deriveConfiguration(z, charge)
    return config.length > 0 ? config : undefined
  } catch {
    return undefined
  }
}

function rawCandidates(t: Target, form: EconfigForm): RawCandidate[] {
  const { z, charge } = t.sp
  const raw: RawCandidate[] = []
  const add = (kind: EconfigMistakeKind, config: SubshellCount[] | undefined) => {
    if (config && config.length > 0) raw.push({ kind, config })
  }
  const right4s = t.occ.get('4s') ?? 0
  const right3d = t.occ.get('3d') ?? 0

  if (charge === 0) {
    const exception = EXCEPTION_ELEMENTS.includes(z)
    if (exception) add('exception_missed', aufbau(z))
    if (!exception && t.transition && right4s === 2 && right3d >= 1 && right3d <= 9) {
      const moved: Occupancy = new Map(t.occ)
      moved.set('4s', 1)
      moved.set('3d', right3d + 1)
      add('exception_misapplied', configOfOccupancy(moved))
    }
    // 3d filled before 4s: every 4s electron written in 3d instead.
    if (right4s > 0 && right4s + right3d <= SUBSHELL_CAPACITY.d && !t.occ.has('4p')) {
      const early: Occupancy = new Map(t.occ)
      early.delete('4s')
      early.set('3d', right3d + right4s)
      add('filling_order', configOfOccupancy(early))
    }
    const last = t.config[t.config.length - 1]!
    const before = t.config[t.config.length - 2]
    // One electron short in the last subshell.
    add('electron_count', [...t.config.slice(0, -1), ...(last.count > 1 ? [{ ...last, count: last.count - 1 }] : [])])
    // The last one or two electrons squeezed into the subshell before, instead of starting a new one.
    if (before && last.count <= 2) add('subshell_overfilled', [...t.config.slice(0, -2), { ...before, count: before.count + last.count }])
    // "Every shell has s, p, d": 1p after 1s, 2d after 2p.
    if (last.l === 's' && (last.n === 2 || last.n === 3))
      add('subshell_nonexistent', [...t.config.slice(0, -1), { n: last.n - 1, l: last.n === 2 ? 'p' : 'd', count: last.count }])
  } else {
    const k = Math.abs(charge)
    const sign = charge > 0 ? 1 : -1
    const neutral = neutralConfiguration(z)
    add('ion_charge_ignored', neutral)
    add('ion_wrong_direction', tryDerive(z, -charge))
    if (charge > 0 && t.transition && right4s === 0) add('ion_removed_from_3d', removeFrom3dFirst(z, k))
    add('ion_wrong_number', tryDerive(z, sign * (k >= 2 ? k - 1 : k + 1)))
  }

  if (form === 'shorthand' && t.core) {
    const tail = termsText(t.rest)
    const at = NOBLE_GAS_CORES.findIndex((g) => g.z === t.core!.z)
    const earlier = NOBLE_GAS_CORES[at - 1]
    if (earlier) raw.push({ kind: 'core_wrong', text: `[${earlier.symbol}] ${tail}`.trim() })
    const self = charge === 0 ? NOBLE_GAS_CORES.find((g) => g.z === z) : undefined
    const later = NOBLE_GAS_CORES[at + 1]?.symbol ?? 'Xe'
    raw.push({ kind: 'core_not_earlier', text: self ? `[${self.symbol}]` : `[${later}] ${tail}`.trim() })
  }
  return raw
}

/** A candidate configuration as she would type it in this form; null when it has no shorthand to write. */
function candidateText(t: Target, config: SubshellCount[], form: EconfigForm): string | null {
  if (form === 'full') return termsText(config)
  if (t.electrons <= 2) return termsText(config)
  const limit = t.core?.z ?? 0
  for (let i = NOBLE_GAS_CORES.length - 1; i >= 0; i--) {
    const core = NOBLE_GAS_CORES[i]!
    if (core.z > limit) continue
    const rest = restAfterCore(config, core)
    if (rest) return `[${core.symbol}] ${termsText(rest)}`.trim()
  }
  return null
}

/**
 * What each configuration mistake would produce for this species, in the grader's priority order. Every
 * candidate differs from the right answer and grades as its own kind; two kinds that give the same text are
 * one candidate (the later kind is listed in `shadows`). Null for a species outside the model.
 *   configurationMistakes('Cr', 'shorthand').map(c => [c.kind, c.text])
 *   // [['exception_missed', '[Ar] 4s2 3d4'], ['filling_order', '[Ar] 3d6'], ['electron_count', '[Ar] 4s1 3d4'], …]
 */
export function configurationMistakes(species: EconfigSpeciesLike, form: EconfigForm = 'full'): ConfigurationMistakeCandidate[] | null {
  if (speciesProblem(species)) return null
  const t = targetOf(resolveSpecies(species)!)
  const kept: ConfigurationMistakeCandidate[] = []
  for (const r of rawCandidates(t, form)) {
    const text = r.text ?? (r.config ? candidateText(t, r.config, form) : null)
    if (!text) continue
    const twin = kept.find((c) => c.text === text)
    if (twin) {
      if (twin.kind !== r.kind && !twin.shadows.includes(r.kind)) twin.shadows.push(r.kind)
      continue
    }
    const grade = gradeConfiguration(t.sp, text, { form })
    if (grade.verdict === 'mistake' && grade.mistake === r.kind) kept.push({ kind: r.kind, text, witness: grade.witness, shadows: [] })
  }
  return kept
}
