/**
 * Explanations: plain ordered lines a student can read (display text, superscripts and arrows already in
 * them). Each one REVEALS the answer, so show it as the last hint rung or after the problem is done.
 * Every function throws RangeError for a species outside the model (a template bug).
 */
import {
  addInOrder,
  aufbau,
  canonicalCore,
  chargeSize,
  deriveConfiguration,
  elementOf,
  EXCEPTION_ELEMENTS,
  FILLING_ORDER_TEXT,
  neutralConfiguration,
  NOBLE_GAS_CORES,
  removeOutermost,
  requireSpecies,
  restAfterCore,
  sameConfiguration,
  shellOrder,
  speciesDisplay,
  SUBSHELL_ORBITALS,
  subshellName,
} from './model'
import { hundDiagram, orbitalDiagram, orbitalDiagramDisplay, unpairedInDiagram } from './orbital'
import { aLetter, capitalized, listWords, nameOf, plural, termDisplay, termsDisplay } from './text'
import type { EconfigForm, EconfigSpecies, EconfigSpeciesLike, SubshellCount, SubshellLike } from './types'

/** "[Ar] 4s² 3d⁶" when a core fits, else the full display. */
function shortDisplay(sp: EconfigSpecies, config: readonly SubshellCount[]): string {
  const core = canonicalCore(sp)
  const rest = core ? restAfterCore(config, core) : null
  if (!core || !rest) return termsDisplay(config)
  return rest.length === 0 ? `[${core.symbol}]` : `[${core.symbol}] ${termsDisplay(rest)}`
}

function moves(trace: readonly SubshellCount[], word: 'from' | 'into'): string {
  return trace.map((t) => `${t.count} ${word} ${subshellName(t)}`).join(', then ')
}

/**
 * How the configuration is worked out: the electron count, the filling order, where each electron goes, the
 * chromium / copper exception, and for an ion which electrons leave (or arrive) first. With
 * `form: 'shorthand'` the last line builds the noble-gas shorthand.
 */
export function explainConfiguration(species: EconfigSpeciesLike, options: { form?: EconfigForm } = {}): string[] {
  const sp = requireSpecies(species)
  const { z, charge } = sp
  const el = elementOf(sp)
  const name = el.name
  const label = speciesDisplay(sp)
  const neutral = neutralConfiguration(z)
  const config = deriveConfiguration(z, charge)
  const lines: string[] = []

  lines.push(`${capitalized(name)} (${el.symbol}) has atomic number ${z}, so a neutral atom has ${plural(z, 'electron')}.`)
  lines.push(
    `Fill the subshells from the lowest energy up (the aufbau principle), in this order: ${FILLING_ORDER_TEXT}. An s subshell holds 2 electrons, a p subshell 6 and a d subshell 10.`,
  )
  const plain = aufbau(z)
  if (plain.length === 1) {
    lines.push(`${z === 1 ? 'The one electron goes' : `The ${z} electrons go`} into 1s.`)
  } else {
    let soFar = 0
    const steps = plain.map((t, i) => {
      soFar += t.count
      const last = i === plain.length - 1
      return `${subshellName(t)} takes ${last ? `the last ${t.count}` : t.count} (${soFar}${i === 0 ? ' so far' : ''})`
    })
    lines.push(`Where each electron goes: ${listWords(steps)}.`)
  }
  if (plain.some((t) => subshellName(t) === '3d')) lines.push('4s fills before 3d because 4s is slightly lower in energy.')
  if (EXCEPTION_ELEMENTS.includes(z)) {
    const d = neutral.find((t) => subshellName(t) === '3d')!
    lines.push(
      `That order alone would give ${termsDisplay(plain.slice(-2))}. ${capitalized(name)} is an exception: a ${z === 24 ? 'half-filled' : 'completely filled'} d subshell (${termDisplay(d)}) is extra stable, so one electron moves from 4s to 3d, giving ${termsDisplay(neutral.slice(-2))}.`,
    )
  }

  const shellNote = (c: readonly SubshellCount[]) =>
    termsDisplay(shellOrder(c)) === termsDisplay(c) ? '' : ` Written by shell number it is ${termsDisplay(shellOrder(c))}; both orders are accepted.`

  if (charge === 0) {
    lines.push(`${label}: ${termsDisplay(config)}.${shellNote(config)}`)
  } else {
    const k = Math.abs(charge)
    lines.push(`Neutral ${name}: ${termsDisplay(neutral)}.`)
    if (charge > 0) {
      const { trace } = removeOutermost(neutral, k)
      lines.push(`${label} has a ${chargeSize(charge)} charge: the atom has lost ${plural(k, 'electron')}, leaving ${z} − ${k} = ${z - k}.`)
      lines.push(`Electrons leave the outermost shell first, the one with the highest shell number: ${moves(trace, 'from')}.`)
      if (neutral.some((t) => subshellName(t) === '3d') && trace.some((t) => subshellName(t) === '4s'))
        lines.push('That is why a transition metal loses its 4s electrons before any 3d electron, even though 4s filled first.')
    } else {
      const { trace } = addInOrder(neutral, k)
      lines.push(`${label} has a ${chargeSize(charge)} charge: the atom has gained ${plural(k, 'electron')}, making ${z} + ${k} = ${z + k}.`)
      lines.push(`The extra ${k === 1 ? 'electron goes' : 'electrons go'} into the next open subshell: ${moves(trace, 'into')}.`)
    }
    const gas = NOBLE_GAS_CORES.find((g) => g.z === z - charge)
    const likeGas = gas && sameConfiguration(config, aufbau(gas.z)) ? ` That is the same configuration as ${nameOf(gas.z)}: a main-group ion ends up with a noble-gas configuration.` : ''
    lines.push(`${label}: ${termsDisplay(config)}.${likeGas}${shellNote(config)}`)
  }

  if (options.form === 'shorthand') {
    const core = canonicalCore(sp)
    if (!core) {
      lines.push(`No noble gas comes before ${name}, so there is nothing to abbreviate: the shorthand is the same as the full configuration.`)
    } else {
      const lead =
        charge === 0
          ? `Shorthand: the noble gas before ${name} is ${nameOf(core.z)} (${core.z} electrons)`
          : `Shorthand: ${nameOf(core.z)} has ${core.z} electrons, no more than ${label} has`
      lines.push(`${lead}, so [${core.symbol}] stands for ${termsDisplay(aufbau(core.z))}. ${label} is ${shortDisplay(sp, config)}.`)
    }
  }
  return lines
}

/**
 * How the orbital diagram of one subshell is drawn (the named subshell, or the last one in filling order):
 * how many electrons it holds, how many boxes, Pauli, Hund, the diagram, the unpaired count.
 */
export function explainOrbitalDiagram(species: EconfigSpeciesLike, subshell?: SubshellLike): string[] {
  const sp = requireSpecies(species)
  const info = orbitalDiagram(sp, subshell)
  const label = speciesDisplay(sp)
  const config = deriveConfiguration(sp.z, sp.charge)
  const { electrons, orbitals, name } = info
  const l = info.subshell.l
  const boxWord = orbitals === 1 ? 'box' : 'boxes'
  const lines = [
    `${label} is ${shortDisplay(sp, config)}: its ${name} subshell holds ${plural(electrons, 'electron')}.`,
    `${capitalized(aLetter(l))} subshell has ${plural(orbitals, 'orbital')}, drawn as ${orbitals} ${boxWord}. A box holds at most 2 electrons, and two in the same box have opposite spins, one arrow up and one down (the Pauli exclusion principle).`,
  ]
  if (electrons === 0) {
    lines.push(`${name} is empty in ${label}, so every box stays empty.`)
  } else if (orbitals === 1) {
    lines.push(electrons === 1 ? 'The one electron sits alone in the box, drawn as an up arrow.' : 'The two electrons share the one box, one up and one down.')
  } else {
    lines.push(
      `Hund's rule: every box of the subshell gets one electron, all with the same spin, before any box gets a second. ${
        electrons <= orbitals
          ? `The ${plural(electrons, 'electron')} ${electrons === 1 ? 'goes' : 'go'} into ${electrons === 1 ? 'one box' : `${electrons} separate boxes`}, pointing up.`
          : `The first ${orbitals} go one per box, pointing up; ${
              electrons - orbitals === 1 ? 'the 1 left over joins the first box as a pair' : `the ${electrons - orbitals} left over join the first boxes as pairs`
            }, pointing down.`
      }`,
    )
  }
  lines.push(`${name}: ${orbitalDiagramDisplay(info.boxes)}. Unpaired electrons in ${name}: ${info.unpaired}.`)
  return lines
}

/** How the unpaired electrons of the whole atom or ion are counted: full subshells have none, the rest by Hund's rule. */
export function explainUnpaired(species: EconfigSpeciesLike): string[] {
  const sp = requireSpecies(species)
  const label = speciesDisplay(sp)
  const config = deriveConfiguration(sp.z, sp.charge)
  const partial = config.filter((t) => t.count < 2 * SUBSHELL_ORBITALS[t.l])
  const lines = [`${label} is ${shortDisplay(sp, config)}.`, 'A full subshell holds only pairs, so it has no unpaired electrons.']
  let total = 0
  for (const t of partial) {
    const boxes = hundDiagram(t.count, t.l)
    const unpaired = unpairedInDiagram(boxes)
    total += unpaired
    lines.push(`${termDisplay(t)} is not full. By Hund's rule its boxes are ${orbitalDiagramDisplay(boxes)}: ${plural(unpaired, 'unpaired electron')}.`)
  }
  lines.push(
    partial.length === 0
      ? `Every occupied subshell of ${label} is full, so it has 0 unpaired electrons.`
      : `${label} has ${plural(total, 'unpaired electron')}${partial.length > 1 ? ` in all (${partial.map((t) => unpairedInDiagram(hundDiagram(t.count, t.l))).join(' + ')})` : ''}.`,
  )
  return lines
}

/**
 * How the element (or ion) is found from its configuration: add the electrons, apply the charge, look up the
 * atomic number. `form` says how the question showed the configuration (default full).
 */
export function explainIdentify(species: EconfigSpeciesLike, options: { form?: EconfigForm } = {}): string[] {
  const sp = requireSpecies(species)
  const { z, charge } = sp
  const electrons = z - charge
  const label = speciesDisplay(sp)
  const name = nameOf(z)
  const config = deriveConfiguration(z, charge)
  const core = options.form === 'shorthand' ? canonicalCore(sp) : null
  const rest = core ? restAfterCore(config, core) : null
  const parts = core && rest ? [`${core.z} for [${core.symbol}]`, ...rest.map((t) => String(t.count))] : config.map((t) => String(t.count))
  const lines = [
    parts.length === 1
      ? `The configuration shows ${plural(electrons, 'electron')}.`
      : `Add the electrons${core ? ' (the brackets stand for a whole noble gas)' : ' (the superscripts)'}: ${parts.join(' + ')} = ${electrons}.`,
  ]
  if (charge === 0) {
    lines.push(`A neutral atom has as many protons as electrons, so the atomic number is ${z}: ${name}, ${label}.`)
  } else {
    const k = Math.abs(charge)
    lines.push(
      `The charge is ${chargeSize(charge)}: the ion has ${k} ${charge > 0 ? 'fewer' : 'more'} ${k === 1 ? 'electron' : 'electrons'} than protons, so it has ${electrons} ${charge > 0 ? '+' : '−'} ${k} = ${z} protons.`,
    )
    lines.push(`Atomic number ${z} is ${name}, so the ion is ${label}.`)
  }
  return lines
}
