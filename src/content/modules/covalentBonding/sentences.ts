/**
 * The boils-higher choice sentences, one fixed set per comparison pair, built from the pair so
 * the grader, the generator and the tests all read the same words. Every pair differs in exactly
 * the force being tested, and every sentence names its sample so a shuffled order stays honest.
 */
import { formulaDisplay } from '@/engine'
import { BOIL_PAIRS, moleculeOf, type BoilPair } from './facts'

function pairOf(a: string, b: string): BoilPair {
  const pair = BOIL_PAIRS.find((item) => item.a === a && item.b === b)
  if (!pair) throw new Error(`covalentBonding: no comparison pair ${a} / ${b}`)
  return pair
}

function show(formula: string): string {
  return formulaDisplay(formula)
}

/** The partner element hydrogen sits on in the higher-boiling sample of an hbond pair. */
function hbondPartner(formula: string): string {
  const m = moleculeOf(formula)
  const partner = m.central ?? m.atoms.find((a) => a.symbol !== 'H')?.symbol ?? 'H'
  return { N: 'nitrogen', O: 'oxygen', F: 'fluorine' }[partner] ?? partner
}

/** The right sentence: which boils higher, and why. */
export function boilRight(a: string, b: string): string {
  const pair = pairOf(a, b)
  switch (pair.kind) {
    case 'hbond':
      return `${show(pair.higher)}: its hydrogen sits on ${hbondPartner(pair.higher)}, so its molecules hydrogen-bond, and that grip takes the most heat to break`
    case 'dipole':
      return `${show(pair.higher)}: its molecules pull lopsidedly, so dipole attraction adds to the dispersion both samples have`
    case 'size':
      return `${show(pair.higher)}: the bigger electron cloud makes its dispersion forces stronger`
  }
}

/** The hydrogen-everywhere slip, offered only on the hbond pairs; null elsewhere. */
export function boilSame(a: string, b: string): string | null {
  const pair = pairOf(a, b)
  if (pair.kind !== 'hbond') return null
  return `They boil close together: both contain hydrogen, so both samples hydrogen-bond`
}

/** The remaining wrong sentences for the pair (never the right one, never a named slip). */
export function boilWrongs(a: string, b: string): string[] {
  const pair = pairOf(a, b)
  const lower = pair.higher === pair.a ? pair.b : pair.a
  switch (pair.kind) {
    case 'hbond':
      return [`${show(lower)}: the heavier molecule always boils higher, whatever the forces`]
    case 'dipole':
      return [
        `${show(lower)}: the bond inside each of its molecules is very strong, and stronger bonds mean a higher boil`,
        `They boil close together: the two molecules weigh about the same, and weight is all that matters`,
      ]
    case 'size':
      return [
        `${show(lower)}: its atoms hold their electrons tightest, so its molecules grip each other hardest`,
        `They boil close together: both are even-pulling molecules, so the grip between them is identical`,
      ]
  }
}
