/**
 * atom.particles: "How many protons, neutrons and electrons?" Each box is graded on its own and a
 * wrong box gets a NAMED mistake only when her number is exactly what that mistake produces:
 *
 *   protons   = A                → at_swapped_a_z             (read the mass number as the atomic number)
 *   protons   = Z ± charge       → at_protons_changed_for_ion (the charge changed the nucleus)
 *   neutrons  = A                → at_neutrons_as_mass_number (forgot to subtract Z)
 *   electrons = Z (an ion)       → at_electrons_ignored_charge
 *   electrons = Z + charge       → at_charge_sign_flipped     (added electrons for a cation / removed for an anion)
 *
 * Anything else gets a plain, specific sentence and no pattern id.
 */
import type { AtomBoxGrade, AtomGrade, AtomParticle, AtomQuestion } from '@/shared/types'
import { finishGrade, namedBox, okBox, parseAll, plainBox } from './grade'
import {
  assertParticle,
  chargeLabel,
  chargeWords,
  elementNameOf,
  formulaText,
  hyphenName,
  nuclearSymbolText,
  parseWholeNumber,
  particleCounts,
  plural,
} from './particle'

export type ParticlesQuestion = Extract<AtomQuestion, { kind: 'particles' }>

export interface ParticlesEntry {
  protons: string
  neutrons: string
  electrons: string
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** How the particle is referred to in a sentence, matching the way it was shown. */
export function particleShownText(q: ParticlesQuestion): string {
  const p = q.particle
  if (q.shown === 'symbol') return nuclearSymbolText(p)
  if (q.shown === 'hyphen') return p.charge === 0 ? hyphenName(p) : `${hyphenName(p)} (${formulaText(p)})`
  return formulaText(p)
}

/** "(−1)" style operand for "17 − (−1)". */
function chargeOperand(c: number): string {
  return c < 0 ? `(−${-c})` : String(c)
}

export function gradeParticles(q: ParticlesQuestion, entry: ParticlesEntry): AtomGrade {
  const p: AtomParticle = q.particle
  assertParticle(p)
  const parsed = parseAll<{ protons: number; neutrons: number; electrons: number }>(
    {
      protons: { box: 'protons', parsed: parseWholeNumber(entry.protons, 'Type the number of protons.') },
      neutrons: { box: 'neutrons', parsed: parseWholeNumber(entry.neutrons, 'Type the number of neutrons.') },
      electrons: { box: 'electrons', parsed: parseWholeNumber(entry.electrons, 'Type the number of electrons.') },
    },
    ['protons', 'neutrons', 'electrons'],
  )
  if (!parsed.ok) return parsed.grade
  const { protons: P, neutrons: N, electrons: E } = parsed.values
  const right = particleCounts(p)
  const Z = p.z
  const A = p.massNumber
  const c = p.charge
  const name = elementNameOf(Z)
  const formula = formulaText(p)
  const symbolForm = q.shown === 'symbol'

  function protonsBox(): AtomBoxGrade {
    if (P === Z) return okBox('protons')
    if (P === A)
      return namedBox(
        'protons',
        'at_swapped_a_z',
        symbolForm
          ? `${P} is the mass number, the top number: it counts protons and neutrons together. The protons are the atomic number, the number written underneath.`
          : `${P} is the mass number of ${hyphenName(p)}: protons and neutrons together. The protons are ${name}’s atomic number, from the periodic table.`,
      )
    if (c !== 0 && (P === Z - c || P === Z + c))
      return namedBox(
        'protons',
        'at_protons_changed_for_ion',
        `You gave ${plural(P, 'proton')}, as if the ${chargeLabel(c)} charge changed the nucleus. An ion only gains or loses electrons, so ${formula} has exactly as many protons as a neutral ${name} atom: its atomic number.`,
      )
    return plainBox(
      'protons',
      symbolForm
        ? 'The number of protons is the atomic number: the lower number in front of the symbol.'
        : `The number of protons is the atomic number of ${name}, from the periodic table.`,
    )
  }

  function neutronsBox(): AtomBoxGrade {
    if (N === right.neutrons) return okBox('neutrons')
    if (N === A)
      return namedBox(
        'neutrons',
        'at_neutrons_as_mass_number',
        `${A} is the mass number, which counts protons and neutrons together. Subtract the ${plural(Z, 'proton')} to leave just the neutrons.`,
      )
    if (P !== Z && N === A - P) return plainBox('neutrons', `That fits your proton count (${A} − ${P} = ${N}). Once the protons are right, neutrons = mass number − protons.`)
    if (N === A + Z) return plainBox('neutrons', `Neutrons = mass number − atomic number: take the protons away from ${A} instead of adding them.`)
    if (c !== 0 && N === A - right.electrons)
      return plainBox('neutrons', 'The mass number counts only what is in the nucleus, so subtract the protons, not the electrons.')
    return plainBox(
      'neutrons',
      symbolForm
        ? 'Neutrons = mass number − atomic number: the top number minus the bottom number.'
        : `Neutrons = mass number − atomic number. The mass number is the ${A} in ${hyphenName(p)}.`,
    )
  }

  function electronsBox(): AtomBoxGrade {
    if (E === right.electrons) return okBox('electrons')
    if (c !== 0 && E === Z)
      return namedBox(
        'electrons',
        'at_electrons_ignored_charge',
        `${plural(E, 'electron')} would balance the ${plural(Z, 'proton')}: that is a neutral atom. ${formula} has ${chargeWords(c)}, so its electrons and protons do not balance. Electrons = protons − charge.`,
      )
    if (c !== 0 && E === Z + c)
      return namedBox(
        'electrons',
        'at_charge_sign_flipped',
        c > 0
          ? `You gave ${plural(E, 'electron')}, more than the ${plural(Z, 'proton')}. Extra electrons would make the particle NEGATIVE, but ${formula} is positive: it has lost electrons, not gained them.`
          : `You gave ${plural(E, 'electron')}, fewer than the ${plural(Z, 'proton')}. Missing electrons would make the particle POSITIVE, but ${formula} is negative: it has gained electrons, not lost them.`,
      )
    if (P !== Z && E === P - c) return plainBox('electrons', 'That fits your proton count. Once the protons are right, electrons = protons − charge.')
    if (c === 0) return plainBox('electrons', `A neutral atom has exactly as many electrons as protons.`)
    return plainBox('electrons', `Electrons = protons − charge, and ${formula} has ${chargeWords(c)}.`)
  }

  const boxes = [protonsBox(), neutronsBox(), electronsBox()]
  return finishGrade(boxes, `Right: ${plural(P, 'proton')}, ${plural(N, 'neutron')} and ${plural(E, 'electron')} in ${particleShownText(q)}.`)
}

/** Worked explanation (hint rung 3 and after a right answer). Reveals the answer. */
export function explainParticles(q: ParticlesQuestion): string[] {
  const p = q.particle
  assertParticle(p)
  const { protons, neutrons, electrons } = particleCounts(p)
  const name = elementNameOf(p.z)
  const lines: string[] = []
  lines.push(
    q.shown === 'symbol'
      ? `The atomic number is the lower number, ${p.z}, so ${name} has ${plural(protons, 'proton')}. Every ${name} atom and ion has exactly ${protons}.`
      : `${capital(name)} is element ${p.z} on the periodic table, so it has ${plural(protons, 'proton')}. Every ${name} atom and ion has exactly ${protons}.`,
  )
  lines.push(
    `${q.shown === 'symbol' ? `The mass number is the top number, ${p.massNumber}` : `The mass number is the ${p.massNumber} in ${hyphenName(p)}`}. It counts protons and neutrons together, so neutrons = ${p.massNumber} − ${p.z} = ${neutrons}.`,
  )
  if (p.charge === 0) lines.push(`There is no charge, so the electrons balance the protons: ${plural(electrons, 'electron')}.`)
  else
    lines.push(
      `Electrons = protons − charge = ${p.z} − ${chargeOperand(p.charge)} = ${electrons}. ${
        p.charge < 0
          ? `A ${-p.charge}− charge means ${plural(-p.charge, 'extra electron')}.`
          : `A ${p.charge}+ charge means ${plural(p.charge, 'electron')} lost.`
      }`,
    )
  return lines
}
