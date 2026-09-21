/**
 * atom.notation: the counts are given (p, n, e); she writes the particle as symbol, mass number,
 * atomic number and charge. Named mistakes, each only when her box holds exactly what it produces:
 *
 *   symbol = element with Z = e, or atomic number = e   → at_element_from_electrons (11 p, 10 e written as Ne)
 *   mass number = p + e                                 → at_mass_protons_electrons
 *   mass number = n                                     → at_mass_neutrons_only
 *   atomic number = p + n (mass and atomic swapped)     → at_swapped_a_z
 *   charge = e − p                                      → at_charge_sign_flipped (more electrons is NEGATIVE)
 *   right letters, wrong case ("CL", "cl")              → at_symbol_case
 */
import type { AtomBoxGrade, AtomGrade, AtomQuestion } from '@/shared/types'
import { elementByZ } from '../chem/elements'
import { finishGrade, namedBox, okBox, parseAll, plainBox } from './grade'
import {
  assertParticle,
  chargeText,
  chargeWords,
  elementNameOf,
  hyphenName,
  nuclearSymbolText,
  parseChargeText,
  parseSymbolText,
  parseWholeNumber,
  particleCounts,
  plural,
  signedNumber,
  type SymbolReading,
} from './particle'

export type NotationQuestion = Extract<AtomQuestion, { kind: 'notation' }>

export interface NotationEntry {
  symbol: string
  massNumber: string
  atomicNumber: string
  /** Blank means neutral. */
  charge: string
}

export function gradeNotation(q: NotationQuestion, entry: NotationEntry): AtomGrade {
  const p = q.particle
  const el = assertParticle(p)
  const parsed = parseAll<{ symbol: SymbolReading; massNumber: number; atomicNumber: number; charge: number }>(
    {
      symbol: { box: 'symbol', parsed: parseSymbolText(entry.symbol) },
      massNumber: { box: 'massNumber', parsed: parseWholeNumber(entry.massNumber, 'Type the mass number.') },
      atomicNumber: { box: 'atomicNumber', parsed: parseWholeNumber(entry.atomicNumber, 'Type the atomic number.') },
      charge: { box: 'charge', parsed: parseChargeText(entry.charge) },
    },
    ['symbol', 'massNumber', 'atomicNumber', 'charge'],
  )
  if (!parsed.ok) return parsed.grade
  const { symbol: sym, massNumber: A, atomicNumber: Zt, charge: C } = parsed.values
  const { protons: pr, neutrons: ne, electrons: el_ } = particleCounts(p)
  const c = p.charge
  const rightA = p.massNumber
  const swappedPair = A === pr && Zt === rightA && rightA !== pr

  function symbolBox(): AtomBoxGrade {
    if (sym.exact && sym.exact.z === p.z) return okBox('symbol')
    const loose = sym.loose
    if (c !== 0 && loose && loose.z === el_ && el_ !== pr)
      return namedBox(
        'symbol',
        'at_element_from_electrons',
        `${loose.symbol} is the element with ${plural(el_, 'proton')}, but ${el_} is the number of ELECTRONS here. This particle has ${plural(pr, 'proton')}, and the protons decide the element.`,
      )
    if (loose && loose.z === p.z)
      return namedBox(
        'symbol',
        'at_symbol_case',
        el.symbol.length === 2
          ? `“${sym.typed}” has the right letters, but a symbol is a capital letter followed by a lowercase one: ${el.symbol}.`
          : `“${sym.typed}” is the right letter, but a one-letter symbol is always a capital: ${el.symbol}.`,
      )
    if (sym.byName && !loose) {
      if (sym.byName.z === p.z) return plainBox('symbol', 'Right element! Write its symbol (one or two letters) in place of the name.')
      return plainBox('symbol', `${sym.byName.name.charAt(0).toUpperCase()}${sym.byName.name.slice(1)} has ${plural(sym.byName.z, 'proton')}, and this particle has ${pr}. Find the element whose atomic number matches, and write its symbol.`)
    }
    if (loose && loose.z === ne && ne !== pr)
      return plainBox('symbol', `${loose.symbol} has atomic number ${ne}, the number of NEUTRONS here. The element is set by the protons alone.`)
    if (loose) return plainBox('symbol', `${loose.symbol} is element ${loose.z}, but this particle has ${plural(pr, 'proton')}. The element is the one whose atomic number equals the proton count.`)
    return plainBox('symbol', `No element has the symbol “${sym.typed}”. Find the element whose atomic number equals the number of protons, and write its symbol.`)
  }

  function massBox(): AtomBoxGrade {
    if (A === rightA) return okBox('massNumber')
    if (swappedPair)
      return namedBox(
        'massNumber',
        'at_swapped_a_z',
        `${A} and ${Zt} are in each other’s places. The mass number (protons + neutrons, the bigger one) goes on top; the atomic number (protons) goes underneath.`,
      )
    if (A === pr + el_)
      return namedBox(
        'massNumber',
        'at_mass_protons_electrons',
        `${pr} + ${el_} = ${A} adds the electrons. The mass number counts only what is in the nucleus: protons and neutrons.`,
      )
    if (A === ne)
      return namedBox('massNumber', 'at_mass_neutrons_only', `${A} is the neutrons alone. The mass number counts the ${plural(pr, 'proton')} as well.`)
    if (A === pr + ne + el_) return plainBox('massNumber', 'Electrons are far too light to count: the mass number is protons + neutrons only.')
    if (A === pr) return plainBox('massNumber', `${A} is only the protons. The mass number counts protons and neutrons together.`)
    return plainBox('massNumber', 'Mass number = protons + neutrons.')
  }

  function atomicBox(): AtomBoxGrade {
    if (Zt === pr) return okBox('atomicNumber')
    if (swappedPair)
      return namedBox(
        'atomicNumber',
        'at_swapped_a_z',
        `${A} and ${Zt} are in each other’s places. The mass number (protons + neutrons, the bigger one) goes on top; the atomic number (protons) goes underneath.`,
      )
    if (c !== 0 && Zt === el_)
      return namedBox(
        'atomicNumber',
        'at_element_from_electrons',
        `${Zt} is the number of electrons. The atomic number counts protons, and this particle has ${plural(pr, 'proton')}: the electrons only set the charge.`,
      )
    if (Zt === rightA)
      return namedBox('atomicNumber', 'at_swapped_a_z', `${Zt} is the mass number, protons + neutrons. The atomic number, written underneath, counts the protons only.`)
    return plainBox('atomicNumber', 'The atomic number is the number of protons.')
  }

  function chargeBox(): AtomBoxGrade {
    if (C === c) return okBox('charge')
    if (c !== 0 && C === -c)
      return namedBox(
        'charge',
        'at_charge_sign_flipped',
        c < 0
          ? `${plural(el_, 'electron')} and ${plural(pr, 'proton')}: there are MORE electrons than protons, so the charge is negative, not positive.`
          : `${plural(pr, 'proton')} and ${plural(el_, 'electron')}: there are FEWER electrons than protons, so the charge is positive, not negative.`,
      )
    if (c !== 0 && C === 0) return plainBox('charge', `${plural(pr, 'proton')} and ${plural(el_, 'electron')} do not balance, so this is an ion: charge = protons − electrons.`)
    if (c === 0) return plainBox('charge', `${plural(pr, 'proton')} and ${plural(el_, 'electron')} balance, so the atom is neutral: leave the charge blank (or type 0).`)
    return plainBox('charge', 'Charge = protons − electrons. Check the size of the difference.')
  }

  const boxes = [symbolBox(), massBox(), atomicBox(), chargeBox()]
  return finishGrade(boxes, `Right: ${nuclearSymbolText(p)}, which is ${hyphenName(p)}${c === 0 ? '' : ` with ${chargeWords(c)}`}.`)
}

/** Worked explanation (hint rung 3 and after a right answer). Reveals the answer. */
export function explainNotation(q: NotationQuestion): string[] {
  const p = q.particle
  const el = assertParticle(p)
  const { protons, neutrons, electrons } = particleCounts(p)
  const name = elementNameOf(p.z)
  const lines = [
    `${plural(protons, 'proton')}: the element with atomic number ${protons} is ${name}, symbol ${el.symbol}. The electrons never pick the element; they only set the charge.`,
    `Mass number = protons + neutrons = ${protons} + ${neutrons} = ${p.massNumber}. It goes on top; the atomic number, ${protons}, goes underneath.`,
    p.charge === 0
      ? `${plural(protons, 'proton')} and ${plural(electrons, 'electron')} balance, so the atom is neutral and no charge is written.`
      : `Charge = protons − electrons = ${protons} − ${electrons} = ${signedNumber(p.charge)}, written ${chargeText(p.charge)} at the top right.`,
    `Put together: ${nuclearSymbolText(p)}${p.charge === 0 ? `, also written ${hyphenName(p)}` : ''}.`,
  ]
  // Keep the lookup honest: the element really is the one with that many protons.
  if (elementByZ(protons)?.symbol !== el.symbol) throw new Error('atoms: element lookup mismatch')
  return lines
}
