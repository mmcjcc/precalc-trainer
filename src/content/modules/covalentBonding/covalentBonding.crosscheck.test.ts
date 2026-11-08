/**
 * Solve each problem again from the wording. The stored `check` is not used to compute the
 * answer: molecules are read out of the prompt, compositions out of their formulas, dot counts
 * out of the described structure's own words, differences out of the printed electronegativity
 * values, and Lewis counts out of the octet arithmetic (needs minus has, halved) — everything
 * must agree with what the module stored.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { CovalentBondingAnswer } from '@/content/types'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000

const SUB: Record<string, number> = { '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4, '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9 }
const WORDS: Record<string, number> = { no: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }

/** This test's own valence shares, from the group numbers. */
const VALENCE: Record<string, number> = { H: 1, C: 4, Si: 4, N: 5, P: 5, O: 6, S: 6, F: 7, Cl: 7, Br: 7, I: 7 }

const SALT_DISPLAYS = ['NaCl', 'KBr', 'CaO', 'MgCl₂', 'LiF']

/** 'H₂O' → { H: 2, O: 1 }, parsed with this test's own subscript map. */
function composition(display: string): Record<string, number> {
  const out: Record<string, number> = {}
  const re = /([A-Z][a-z]?)([₀-₉]*)/g
  for (const m of display.matchAll(re)) {
    if (!m[1]) continue
    const count = m[2] ? [...m[2]].reduce((s, ch) => s * 10 + SUB[ch]!, 0) : 1
    out[m[1]] = (out[m[1]] ?? 0) + count
  }
  return out
}

/** Every display formula in a text, this test's own reading. */
function displaysIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/(?<![A-Za-z])((?:[A-Z][a-z]?[₀-₉]*){1,3})(?![a-z])/g)) {
    const token = m[1]!
    // At least two atoms or a subscript: skips lone capitals that start sentences.
    const comp = composition(token)
    const atoms = Object.values(comp).reduce((x, y) => x + y, 0)
    if (atoms >= 2 && Object.keys(comp).every((sym) => sym in VALENCE || ['Na', 'K', 'Ca', 'Mg', 'Li'].includes(sym))) out.push(token)
  }
  return out
}

/** Octet arithmetic, this test's own: shared pairs = (needs − has) / 2. */
function lewis(comp: Record<string, number>) {
  let needs = 0
  let has = 0
  let atoms = 0
  for (const [sym, count] of Object.entries(comp)) {
    needs += count * (sym === 'H' ? 2 : 8)
    has += count * VALENCE[sym]!
    atoms += count
  }
  const shared = (needs - has) / 2
  const lonePairs = (has - 2 * shared) / 2
  return { shared, lonePairs, has, atoms }
}

function answerOf(templateId: string, seed: number): CovalentBondingAnswer {
  const p = generateProblem('covalentBonding', templateId, seed)
  if (p.answer.type !== 'covalentBonding') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

function stageByLabel(a: CovalentBondingAnswer, prefix: string) {
  const stage = a.stages.find((s) => s.label.startsWith(prefix))
  if (!stage) throw new Error(`no part labeled ${prefix}`)
  return stage
}

function maybeStage(a: CovalentBondingAnswer, prefix: string) {
  return a.stages.find((s) => s.label.startsWith(prefix)) ?? null
}

/** The molecule the prompt names: its one display formula that is not a chapter 8 salt. */
function moleculeDisplay(prompt: string): string {
  const displays = displaysIn(prompt).filter((d) => !SALT_DISPLAYS.includes(d))
  if (displays.length === 0) throw new Error(`no molecule in: ${prompt}`)
  return displays[0]!
}

describe('cb.electrons re-solved from the prompt', () => {
  it(
    'bond type, total valence and every pair count re-derive from octet arithmetic',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('cb.electrons', seed)
        const display = moleculeDisplay(a.prompt)
        const comp = composition(display)
        const { shared, lonePairs, has, atoms } = lewis(comp)

        const bondType = a.stages[0]!
        const subjectDisplay = /The electrons in (.+)$/.exec(bondType.label)?.[1]
        expect(subjectDisplay, `${seed}`).toBeTruthy()
        expect(bondType.answerText).toBe(SALT_DISPLAYS.includes(subjectDisplay!) ? 'Transferred from one atom to the other' : 'Shared between the atoms')

        expect(stageByLabel(a, 'Valence electrons in the molecule').answerText, `${seed} ${display}`).toBe(String(has))

        if (atoms === 2) {
          const orderName = { 1: 'Single', 2: 'Double', 3: 'Triple' }[shared]
          expect(stageByLabel(a, 'The bond').answerText, `${seed} ${display}`).toBe(orderName)
          expect(stageByLabel(a, 'Electrons in that bond').answerText).toBe(String(2 * shared))
        } else {
          // The central atom is the one that appears once; the others ring it.
          const central = Object.entries(comp).find(([, count]) => count === 1)![0]
          const outerCount = atoms - 1
          const order = shared / outerCount
          const outerSym = Object.entries(comp).find(([sym]) => sym !== central)![0]
          const outerLone = outerSym === 'H' ? 0 : (8 - 2 * order) / 2
          expect(stageByLabel(a, 'Bonding pairs around the center').answerText, `${seed} ${display}`).toBe(String(shared))
          expect(stageByLabel(a, 'Lone pairs on the central atom').answerText).toBe(String(lonePairs - outerCount * outerLone))
        }
      }
    },
    HEAVY,
  )
})

describe('cb.dots re-solved from the described structure', () => {
  it(
    'shared, unshared and per-atom counts re-derive from the description’s own words',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('cb.dots', seed)
        const said = /“(.+)”/.exec(a.prompt)?.[1]
        expect(said, `${seed}: ${a.prompt}`).toBeTruthy()
        const display = moleculeDisplay(a.prompt)
        const comp = composition(display)

        // Shared pairs, from the sharing clause alone.
        let shared = 0
        const sharedAt = new Map<string, number>()
        let m = /Each ([A-Z][a-z]?) shares (\w+) pairs? with the ([A-Z][a-z]?)/.exec(said!)
        if (m) {
          const per = WORDS[m[2]!]!
          shared = per * comp[m[1]!]!
          sharedAt.set(m[1]!, per)
          sharedAt.set(m[3]!, shared)
        } else if ((m = /The two ([A-Z][a-z]?) atoms share (\w+) pairs?/.exec(said!))) {
          shared = WORDS[m[2]!]!
          sharedAt.set(m[1]!, shared)
        } else if ((m = /([A-Z][a-z]?) and ([A-Z][a-z]?) share (\w+) pairs?/.exec(said!))) {
          shared = WORDS[m[3]!]!
          sharedAt.set(m[1]!, shared)
          sharedAt.set(m[2]!, shared)
        } else {
          throw new Error(`no sharing clause in: ${said}`)
        }

        // Kept pairs, clause by clause.
        let unshared = 0
        const loneAt = new Map<string, number>()
        for (const k of said!.matchAll(/the ([A-Z][a-z]?) keeps (\w+) pairs? of its own/g)) {
          unshared += WORDS[k[2]!]!
          loneAt.set(k[1]!, WORDS[k[2]!]!)
        }
        for (const k of said!.matchAll(/each ([A-Z][a-z]?) keeps (\w+) pairs? to itself/g)) {
          unshared += WORDS[k[2]!]! * comp[k[1]!]!
          loneAt.set(k[1]!, WORDS[k[2]!]!)
        }
        for (const k of said!.matchAll(/the ([A-Z][a-z]?) keeps (\w+) pairs? to itself/g)) {
          unshared += WORDS[k[2]!]!
          loneAt.set(k[1]!, WORDS[k[2]!]!)
        }
        for (const k of said!.matchAll(/(?:and each|each) keeps (\w+) pairs? (?:to itself|of its own)/g)) {
          unshared += WORDS[k[1]!]! * 2
          for (const sym of Object.keys(comp)) loneAt.set(sym, WORDS[k[1]!]!)
        }
        if (/keeps no pairs of its own/.test(said!)) {
          const central = Object.entries(comp).find(([, count]) => count === 1)?.[0]
          if (central) loneAt.set(central, 0)
        }

        expect(stageByLabel(a, 'Shared pairs in the molecule').answerText, `${seed}: ${said}`).toBe(String(shared))
        expect(stageByLabel(a, 'Unshared pairs in the molecule').answerText, `${seed}: ${said}`).toBe(String(unshared))

        const dotsStage = a.stages.find((s) => s.label.startsWith('Dots shown around '))!
        const atom = dotsStage.label.replace('Dots shown around ', '')
        const dots = 2 * (sharedAt.get(atom) ?? 0) + 2 * (loneAt.get(atom) ?? 0)
        expect(dotsStage.answerText, `${seed}: ${atom} in ${said}`).toBe(String(dots))

        const duet = maybeStage(a, 'Why hydrogen stops short')
        if (comp['H']) {
          expect(duet, `${seed}`).not.toBeNull()
          expect([
            'Hydrogen is filling the first shell, which holds just two electrons',
            'Its one and only shell is full once a single shared pair sits on it',
          ]).toContain(duet!.answerText)
        } else {
          expect(duet).toBeNull()
        }
      }
    },
    HEAVY,
  )
})

describe('cb.shape re-solved from the prompt', () => {
  // This test's own shape table for the drawable central molecules.
  const SHAPES: Record<string, [string, string]> = {
    'CO₂': ['Linear', '180'],
    'CS₂': ['Linear', '180'],
    'H₂O': ['Bent', '104.5'],
    'H₂S': ['Bent', '104.5'],
    'OF₂': ['Bent', '104.5'],
    'Cl₂O': ['Bent', '104.5'],
    'NH₃': ['Trigonal pyramidal', '107'],
    'PCl₃': ['Trigonal pyramidal', '107'],
    'NCl₃': ['Trigonal pyramidal', '107'],
    'CH₄': ['Tetrahedral', '109.5'],
    'CCl₄': ['Tetrahedral', '109.5'],
    'SiCl₄': ['Tetrahedral', '109.5'],
  }
  const BY_COUNTS: Record<string, [string, string]> = {
    '2+0': ['Linear', '180'],
    '3+0': ['Trigonal planar', '120'],
    '4+0': ['Tetrahedral', '109.5'],
    '3+1': ['Trigonal pyramidal', '107'],
    '2+2': ['Bent', '104.5'],
  }

  it(
    'shape and angle follow from the molecule, or from the stated counts, read independently',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('cb.shape', seed)
        const stated = /(\w+) bonding pairs/.exec(a.prompt)
        let expected: [string, string]
        let lone: number
        if (stated) {
          const bonded = WORDS[stated[1]!]!
          const loneM = /(no|\w+) lone pairs?/.exec(a.prompt)
          expect(loneM, `${seed}: ${a.prompt}`).toBeTruthy()
          lone = WORDS[loneM![1]!]!
          expected = BY_COUNTS[`${bonded}+${lone}`]!
        } else {
          const display = moleculeDisplay(a.prompt)
          expected = SHAPES[display]!
          expect(expected, `${seed}: ${display}`).toBeTruthy()
          lone = expected[0] === 'Trigonal pyramidal' ? 1 : expected[0] === 'Bent' ? 2 : 0
        }
        expect(stageByLabel(a, 'The shape').answerText, `${seed}: ${a.prompt}`).toBe(expected[0])
        expect(stageByLabel(a, 'The bond angle').answerText).toBe(expected[1])
        const why = maybeStage(a, 'Why the lone pairs change the shape')
        if (lone > 0) {
          expect(why, `${seed}`).not.toBeNull()
          expect([
            'Lone pairs take their own corners of the arrangement and push the bonds together, but only the atoms get named',
            'Every pair, lone ones included, spreads out in the arrangement — the name just traces the atoms, so it shows fewer corners',
          ]).toContain(why!.answerText)
        } else {
          expect(why).toBeNull()
        }
      }
    },
    HEAVY,
  )
})

describe('cb.polarity re-solved from the prompt', () => {
  // This test's own polar/nonpolar verdicts for the molecules the template may ask about.
  const POLAR: Record<string, string> = {
    'H₂O': 'Polar',
    'NH₃': 'Polar',
    HF: 'Polar',
    HCl: 'Polar',
    CO: 'Polar',
    'PCl₃': 'Polar',
    'OF₂': 'Polar',
    'CO₂': 'Nonpolar',
    'CS₂': 'Nonpolar',
    'CCl₄': 'Nonpolar',
    'SiCl₄': 'Nonpolar',
    'CH₄': 'Nonpolar',
    'H₂': 'Nonpolar',
    'N₂': 'Nonpolar',
    'O₂': 'Nonpolar',
    'F₂': 'Nonpolar',
    'Cl₂': 'Nonpolar',
    'Br₂': 'Nonpolar',
    'I₂': 'Nonpolar',
  }

  it(
    'difference, band and molecule verdict re-derive from the printed values and this test’s own table',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('cb.polarity', seed)
        const numbers = [...a.prompt.matchAll(/\d\.\d\d/g)].map((m) => Number(m[0]))
        expect(numbers.length, `${seed}: ${a.prompt}`).toBe(2)
        const diff = Math.round(Math.abs(numbers[0]! - numbers[1]!) * 100) / 100
        expect(stageByLabel(a, 'The electronegativity difference').answerText).toBe(diff.toFixed(2))
        const band = diff < 0.4 ? 'Nonpolar covalent' : diff > 1.7 ? 'Ionic' : 'Polar covalent'
        expect(diff).not.toBe(0.4)
        expect(diff).not.toBe(1.7)
        expect(stageByLabel(a, 'That bond would be').answerText).toBe(band)
        const display = moleculeDisplay(a.prompt)
        expect(POLAR[display], `${seed}: ${display}`).toBeTruthy()
        expect(stageByLabel(a, 'The molecule as a whole').answerText).toBe(POLAR[display])
      }
    },
    HEAVY,
  )
})

describe('cb.forces re-solved from the prompt', () => {
  // This test's own force verdicts for every sample the template may pour.
  const FORCES: Record<string, string> = {
    'H₂O': 'Hydrogen bonds, on top of dispersion',
    'NH₃': 'Hydrogen bonds, on top of dispersion',
    HF: 'Hydrogen bonds, on top of dispersion',
    HCl: 'Dipole-dipole attraction, on top of dispersion',
    CO: 'Dipole-dipole attraction, on top of dispersion',
    'OF₂': 'Dipole-dipole attraction, on top of dispersion',
    'PCl₃': 'Dipole-dipole attraction, on top of dispersion',
    'H₂': 'London dispersion forces only',
    'N₂': 'London dispersion forces only',
    'O₂': 'London dispersion forces only',
    'F₂': 'London dispersion forces only',
    'Cl₂': 'London dispersion forces only',
    'Br₂': 'London dispersion forces only',
    'I₂': 'London dispersion forces only',
    'CO₂': 'London dispersion forces only',
    'CS₂': 'London dispersion forces only',
    'CH₄': 'London dispersion forces only',
    'CCl₄': 'London dispersion forces only',
    'SiCl₄': 'London dispersion forces only',
  }
  // This test's own boiling verdicts: [the two samples, which wins, the word the reason must use].
  const BOILS: [string, string, string, string][] = [
    ['H₂O', 'H₂S', 'H₂O', 'hydrogen-bond'],
    ['HF', 'HCl', 'HF', 'hydrogen-bond'],
    ['N₂', 'CO', 'CO', 'dipole'],
    ['F₂', 'Cl₂', 'Cl₂', 'dispersion'],
    ['F₂', 'Br₂', 'Br₂', 'dispersion'],
    ['F₂', 'I₂', 'I₂', 'dispersion'],
    ['Cl₂', 'Br₂', 'Br₂', 'dispersion'],
    ['Cl₂', 'I₂', 'I₂', 'dispersion'],
    ['Br₂', 'I₂', 'I₂', 'dispersion'],
  ]

  it(
    'the sample’s force and the comparison’s winner re-derive from this test’s own tables',
    () => {
      for (const seed of SEEDS) {
        const a = answerOf('cb.forces', seed)
        const forceStage = a.stages.find((s) => s.label.startsWith('The force between '))!
        const sample = forceStage.label.replace('The force between ', '').replace(' molecules', '')
        expect(FORCES[sample], `${seed}: ${sample}`).toBeTruthy()
        expect(forceStage.answerText).toBe(FORCES[sample])

        const boilStage = stageByLabel(a, 'Which boils higher')
        const compared = /compare two more samples: [^(]*\(([^)]+)\) and [^(]*\(([^)]+)\)/.exec(a.prompt)
        expect(compared, `${seed}: ${a.prompt}`).toBeTruthy()
        const pair = BOILS.find(([x, y]) => compared![1] === x && compared![2] === y)
        expect(pair, `${seed}: ${a.prompt}`).toBeTruthy()
        expect(boilStage.answerText.startsWith(`${pair![2]}:`), `${seed}: ${boilStage.answerText}`).toBe(true)
        expect(boilStage.answerText.toLowerCase()).toContain(pair![3])
      }
    },
    HEAVY,
  )
})
