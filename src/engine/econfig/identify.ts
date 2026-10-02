/**
 * "Which element (or ion) has this configuration?" The question shows the configuration of `species` (and,
 * for an ion, its charge); she types a symbol or a name, with or without the charge.
 *
 * Named mistakes (ions only), each the element that slip would produce:
 *   - the element with as many protons as the ion has electrons (the charge ignored)   → ion_charge_ignored
 *   - the charge applied the wrong way (electrons − charge instead of + charge)        → ion_wrong_direction
 */
import { elementByZ } from '../chem/elements'
import {
  aufbau,
  canonicalCore,
  chargeSize,
  deriveConfiguration,
  ECONFIG_MAX_Z,
  NOBLE_GAS_CORES,
  occupancyOf,
  resolveSpecies,
  sameOccupancy,
  speciesDisplay,
  speciesProblem,
  SUBSHELL_CAPACITY,
  subshellExists,
  totalElectrons,
} from './model'
import { invalidGrade } from './grade'
import { parseConfiguration, parseSpeciesAnswer } from './parse'
import { capitalized, nameOf, plural } from './text'
import type { ConfigurationMistakeCandidate, EconfigForm, EconfigGrade, EconfigMistakeKind, EconfigSpeciesLike, SubshellCount } from './types'

export interface IdentifyOptions {
  /** How the question showed the configuration. With 'shorthand', forgetting the core's electrons gets its own sentence. */
  form?: EconfigForm
  /** True when an ion's charge must be typed too ("Fe3+", not just "Fe"). Default false. */
  requireCharge?: boolean
}

/** Grade the element (or ion) she names for the configuration of `species`. */
export function gradeIdentifySpecies(species: EconfigSpeciesLike, answer: string, options: IdentifyOptions = {}): EconfigGrade {
  const problem = speciesProblem(species)
  if (problem) return { verdict: 'unsupported', message: problem }
  const sp = resolveSpecies(species)!
  const parsed = parseSpeciesAnswer(answer)
  if (!parsed.ok) return invalidGrade(parsed.error)
  const her = parsed.value
  const { z, charge } = sp
  const electrons = z - charge
  const name = nameOf(z)
  const label = speciesDisplay(sp)
  const k = Math.abs(charge)
  const size = charge === 0 ? '' : chargeSize(charge)

  if (her.z === z) {
    if (charge === 0) {
      if (her.charge !== null && her.charge !== 0)
        return { verdict: 'wrong', message: `Right element. But the configuration has ${plural(electrons, 'electron')}, exactly as many as ${name} has protons, so this is the neutral atom: it has no charge.` }
      return { verdict: 'correct', message: `Correct: ${plural(electrons, 'electron')} in a neutral atom means atomic number ${z}, which is ${name} (${label}).` }
    }
    const right: EconfigGrade = {
      verdict: 'correct',
      message: `Correct: ${plural(electrons, 'electron')} and a ${size} charge mean ${plural(z, 'proton')}, which is ${name}: ${label}.`,
    }
    if (her.charge === null)
      return options.requireCharge
        ? { verdict: 'wrong', message: `Right element: ${name}. Write its charge too: the ion has ${plural(z, 'proton')} and ${plural(electrons, 'electron')}.` }
        : right
    if (her.charge === charge) return right
    if (her.charge === -charge)
      return {
        verdict: 'wrong',
        message: `Right element. The ion has ${plural(z, 'proton')} and ${plural(electrons, 'electron')}: ${charge > 0 ? 'fewer' : 'more'} electrons than protons makes it ${charge > 0 ? 'positive' : 'negative'}, so the charge is ${size}.`,
      }
    return { verdict: 'wrong', message: `Right element. Check the charge: it is protons − electrons, ${z} − ${electrons}.` }
  }

  const herName = nameOf(her.z)
  if (charge !== 0 && her.z === electrons)
    return {
      verdict: 'mistake',
      mistake: 'ion_charge_ignored',
      witness: `${her.symbol} (${herName}) has ${electrons} electrons as a NEUTRAL atom, which matches the configuration. But this is an ion with a ${size} charge: it has ${charge > 0 ? 'lost' : 'gained'} ${plural(k, 'electron')}, so the atom it came from has ${electrons} ${charge > 0 ? '+' : '−'} ${k} = ${plural(z, 'electron')}, and ${plural(z, 'proton')}.`,
    }
  if (charge !== 0 && her.z === electrons - charge)
    return {
      verdict: 'mistake',
      mistake: 'ion_wrong_direction',
      witness: `${her.symbol} (${herName}) has ${plural(her.z, 'proton')}, which is ${electrons} ${charge > 0 ? '−' : '+'} ${k}: the charge went the wrong way. A ${size} ion has ${charge > 0 ? 'LOST' : 'GAINED'} ${plural(k, 'electron')}, so the neutral atom has ${charge > 0 ? 'MORE' : 'FEWER'} electrons than the ion: ${electrons} ${charge > 0 ? '+' : '−'} ${k}.`,
    }
  const core = canonicalCore(sp)
  if (options.form === 'shorthand' && core && her.z === electrons - core.z)
    return {
      verdict: 'wrong',
      message: `${capitalized(herName)} has ${plural(her.z, 'electron')}: that counts only the electrons written after the brackets. [${core.symbol}] stands for ${core.z} more, the whole configuration of ${nameOf(core.z)}.`,
    }
  const shown = `The configuration shows ${plural(electrons, 'electron')}${options.form === 'shorthand' && core ? ` (the ${core.z} in [${core.symbol}] plus the superscripts)` : ' (add the superscripts)'}`
  return {
    verdict: 'wrong',
    message:
      charge === 0
        ? `${capitalized(herName)} (${her.symbol}) has ${plural(her.z, 'electron')} as a neutral atom. ${shown}, and a neutral atom has as many protons as electrons.`
        : `${capitalized(herName)} (${her.symbol}) has ${plural(her.z, 'proton')}. ${shown}, and the ${size} charge means the ion has ${k} ${charge > 0 ? 'fewer' : 'more'} ${k === 1 ? 'electron' : 'electrons'} than protons.`,
  }
}

/**
 * The element each identification mistake would name (ions only; a neutral atom has none), as she would type
 * it. Every candidate grades as its own kind. Null for a species outside the model.
 *   identifyMistakes('Fe2+').map(c => [c.kind, c.text])   // [['ion_charge_ignored', 'Cr'], ['ion_wrong_direction', 'Ti']]
 */
export function identifyMistakes(species: EconfigSpeciesLike): ConfigurationMistakeCandidate[] | null {
  if (speciesProblem(species)) return null
  const sp = resolveSpecies(species)!
  const electrons = sp.z - sp.charge
  const raw: { kind: EconfigMistakeKind; z: number }[] =
    sp.charge === 0
      ? []
      : [
          { kind: 'ion_charge_ignored', z: electrons },
          { kind: 'ion_wrong_direction', z: electrons - sp.charge },
        ]
  const kept: ConfigurationMistakeCandidate[] = []
  for (const r of raw) {
    const el = elementByZ(r.z)
    if (!el) continue
    const grade = gradeIdentifySpecies(sp, el.symbol)
    if (grade.verdict === 'mistake' && grade.mistake === r.kind) kept.push({ kind: r.kind, text: el.symbol, witness: grade.witness, shadows: [] })
  }
  return kept
}

export interface ConfigurationReading {
  /** Electrons the configuration shows (the core's included). */
  electrons: number
  /** electrons + charge: the atomic number of the species with this configuration and charge. */
  z: number
  charge: number
  /** The element's symbol, or null when no element has that atomic number. */
  symbol: string | null
  /** True when this is exactly the model's ground-state configuration of that element with that charge. */
  groundState: boolean
}

/**
 * Read a configuration text and say whose it is: speciesOfConfiguration('[Ar] 3d5', 3) is iron (z 26) and the
 * ground state of Fe3+. Null when the text does not parse, the core is not He, Ne, Ar or Kr, or a subshell
 * does not exist or is over its maximum.
 */
export function speciesOfConfiguration(text: string, charge = 0): ConfigurationReading | null {
  const parsed = parseConfiguration(text)
  if (!parsed.ok || !Number.isInteger(charge)) return null
  const { core, terms } = parsed.value
  let coreConfig: SubshellCount[] = []
  if (core) {
    if (!NOBLE_GAS_CORES.some((g) => g.z === core.z)) return null
    coreConfig = aufbau(core.z)
  }
  for (const t of terms) {
    if (!subshellExists(t) || t.count > SUBSHELL_CAPACITY[t.l]) return null
    if (coreConfig.some((c) => c.n === t.n && c.l === t.l)) return null
  }
  const config = [...coreConfig, ...terms]
  const electrons = totalElectrons(config)
  const z = electrons + charge
  let groundState = false
  if (z >= 1 && z <= ECONFIG_MAX_Z) {
    try {
      groundState = sameOccupancy(occupancyOf(config), occupancyOf(deriveConfiguration(z, charge)))
    } catch {
      groundState = false
    }
  }
  return { electrons, z, charge, symbol: elementByZ(z)?.symbol ?? null, groundState }
}
