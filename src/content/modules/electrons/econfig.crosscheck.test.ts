/**
 * Cross-check of the electron-configuration templates. Every answer is recomputed here from a small
 * model written separately from src/engine/econfig (filling order, the two exceptions, "highest
 * shell leaves first"), then compared with what the template shows and what the graders accept.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ElectronsEconfigQuestion, ProblemInstance } from '@/content/types'
import {
  gradeConfiguration,
  gradeIdentifySpecies,
  gradeOrbitalDiagram,
  gradeUnpairedElectrons,
  gradeValenceElectrons,
} from '@/engine'

const SWEEP = { timeout: 120_000 }
const SEEDS = 300

const SYMBOLS =
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr'.split(' ')
const ORDER: [string, number][] = [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6]]
const CAPACITY = new Map(ORDER)
const NOBLE: [string, number][] = [['He', 2], ['Ne', 10], ['Ar', 18], ['Kr', 36]]
const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹'

type Config = [string, number][]

function fill(electrons: number): Config {
  const out: Config = []
  let left = electrons
  for (const [name, cap] of ORDER) {
    if (left <= 0) break
    const n = Math.min(cap, left)
    out.push([name, n])
    left -= n
  }
  return out
}

function neutral(z: number): Config {
  const config = fill(z)
  if (z === 24 || z === 29) {
    // Chromium and copper: one electron moves from 4s to 3d.
    return config.map(([name, n]) => (name === '4s' ? [name, n - 1] : name === '3d' ? [name, n + 1] : [name, n]))
  }
  return config
}

function configOf(z: number, charge: number): Config {
  if (charge <= 0) return charge === 0 ? neutral(z) : fill(z - charge)
  const config = neutral(z).map(([name, n]) => [name, n] as [string, number])
  for (let lost = 0; lost < charge; lost++) {
    // The highest shell number first; inside a shell, p before s.
    const outer = config
      .filter(([, n]) => n > 0)
      .sort((a, b) => Number(b[0][0]) - Number(a[0][0]) || 'spd'.indexOf(b[0][1]!) - 'spd'.indexOf(a[0][1]!))[0]!
    outer[1] -= 1
  }
  return config.filter(([, n]) => n > 0)
}

function total(config: Config): number {
  return config.reduce((s, [, n]) => s + n, 0)
}

function shorthand(z: number, charge: number): { core: string | null; rest: Config } {
  const config = configOf(z, charge)
  const electrons = total(config)
  // A neutral atom uses the noble gas BEFORE it; an ion uses the largest one it has enough electrons for.
  const cores = NOBLE.filter(([, n]) => (charge === 0 ? n < z : n <= electrons))
  const core = cores[cores.length - 1]
  if (!core) return { core: null, rest: config }
  const inner = new Map(fill(core[1]))
  return { core: core[0], rest: config.filter(([name]) => !inner.has(name)) }
}

function text(z: number, charge: number, form: 'full' | 'shorthand', superscripts: boolean): string {
  const count = (n: number) => (superscripts ? String(n).split('').map((d) => SUPER[Number(d)]).join('') : String(n))
  const terms = (config: Config) => config.map(([name, n]) => `${name}${count(n)}`).join(' ')
  if (form === 'full') return terms(configOf(z, charge))
  const { core, rest } = shorthand(z, charge)
  return [core ? `[${core}]` : '', terms(rest)].filter(Boolean).join(' ')
}

function unpairedIn(name: string, n: number): number {
  const cap = CAPACITY.get(name)!
  return n <= cap / 2 ? n : cap - n
}

function unpaired(z: number, charge: number): number {
  return configOf(z, charge).reduce((s, [name, n]) => s + unpairedIn(name, n), 0)
}

/** Hund's rule: one up arrow per box, then the down arrows. */
function hundBoxes(name: string, n: number): string {
  const orbitals = CAPACITY.get(name)! / 2
  return Array.from({ length: orbitals }, (_, i) => (i < n - orbitals ? 'ud' : i < n ? 'u' : '-')).join(' ')
}

function valence(z: number): number {
  const config = neutral(z)
  const shell = Math.max(...config.map(([name]) => Number(name[0])))
  return total(config.filter(([name]) => Number(name[0]) === shell))
}

function speciesShown(z: number, charge: number): string {
  if (charge === 0) return SYMBOLS[z - 1]!
  const size = Math.abs(charge) === 1 ? '' : SUPER[Math.abs(charge)]
  return `${SYMBOLS[z - 1]}${size}${charge > 0 ? '⁺' : '⁻'}`
}

function question(p: ProblemInstance): ElectronsEconfigQuestion {
  if (p.answer.type !== 'electrons' || p.answer.question.kind !== 'econfig') throw new Error(`${p.id}: not an econfig question`)
  return p.answer.question
}

function answerOf(p: ProblemInstance) {
  if (p.answer.type !== 'electrons') throw new Error(`${p.id}: not an electrons answer`)
  return p.answer
}

describe('the separate model agrees with the textbook', () => {
  it('builds iron, chromium, copper and their ions', () => {
    expect(text(26, 0, 'shorthand', false)).toBe('[Ar] 4s2 3d6')
    expect(text(24, 0, 'shorthand', false)).toBe('[Ar] 4s1 3d5')
    expect(text(29, 0, 'shorthand', false)).toBe('[Ar] 4s1 3d10')
    expect(text(26, 2, 'shorthand', false)).toBe('[Ar] 3d6')
    expect(text(26, 3, 'shorthand', false)).toBe('[Ar] 3d5')
    expect(text(29, 1, 'shorthand', false)).toBe('[Ar] 3d10')
    expect(text(17, -1, 'shorthand', false)).toBe('[Ar]')
    expect(text(8, -2, 'full', false)).toBe('1s2 2s2 2p6')
    expect([unpaired(24, 0), unpaired(26, 0), unpaired(26, 3), unpaired(7, 0)]).toEqual([6, 4, 5, 3])
    expect([valence(17), valence(31), valence(20)]).toEqual([7, 3, 2])
    expect(hundBoxes('2p', 4)).toBe('ud u u')
  })
})

describe.each(['ec.full', 'ec.shorthand', 'ec.ion'] as const)('%s: the configuration', (templateId) => {
  it('matches the separate model and grades correct, 300 seeds', SWEEP, () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('electrons', templateId, seed)
      const q = question(p)
      const a = answerOf(p)
      const { z, charge } = q.species
      const form = q.form ?? 'full'
      seen.add(`${z}/${charge}`)

      expect(a.expectedDisplay, p.id).toBe(text(z, charge, form, true))
      expect(gradeConfiguration(q.species, text(z, charge, form, false), { form }).verdict, p.id).toBe('correct')
      expect(q.display, p.id).toBe(speciesShown(z, charge))
      expect(a.prompt, p.id).toContain(speciesShown(z, charge).replace(/[⁰-⁹⁺⁻²³¹]+$/, ''))
      expect(a.prompt, p.id).toContain(form === 'shorthand' ? 'shorthand' : 'full electron configuration')
      // The line above the prompt must not hand her the method.
      expect(a.context, p.id).not.toMatch(/4s|3d|exception|noble|loses|first/i)
      expect(generateProblem('electrons', templateId, seed)).toEqual(p)

      if (templateId === 'ec.ion') {
        expect(charge, p.id).not.toBe(0)
        expect(a.prompt, p.id).toContain(speciesShown(z, charge))
      } else {
        expect(charge, p.id).toBe(0)
        expect(z, p.id).toBeGreaterThanOrEqual(3)
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(templateId === 'ec.ion' ? 15 : 28)
    if (templateId !== 'ec.ion') {
      expect(seen.has('24/0') && seen.has('29/0')).toBe(true)
    } else {
      expect(['26/2', '26/3', '29/2', '25/2'].every((s) => seen.has(s))).toBe(true)
    }
  })
})

describe('ec.identify', () => {
  it('shows the configuration of the species it expects, 300 seeds', SWEEP, () => {
    let ions = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('electrons', 'ec.identify', seed)
      const q = question(p)
      const a = answerOf(p)
      const { z, charge } = q.species
      const form = q.form ?? 'full'
      expect(q.display, p.id).toBe(text(z, charge, form, true))
      expect(a.expectedDisplay, p.id).toBe(speciesShown(z, charge))
      expect(gradeIdentifySpecies(q.species, SYMBOLS[z - 1]!).verdict, p.id).toBe('correct')
      // The symbol must not be on screen anywhere before she answers.
      for (const shown of [a.prompt, a.context, p.instructions, a.nudge]) {
        expect(shown, p.id).not.toMatch(new RegExp(`\\b${SYMBOLS[z - 1]}\\b`))
      }
      if (charge !== 0) {
        ions++
        expect(a.prompt, p.id).toContain(`${Math.abs(charge)}${charge > 0 ? '+' : '−'} charge`)
      }
      // A different element with the same number of electrons is not accepted.
      const twin = z - charge
      if (charge !== 0 && twin >= 1 && twin <= 36) {
        expect(gradeIdentifySpecies(q.species, SYMBOLS[twin - 1]!).verdict, p.id).not.toBe('correct')
      }
    }
    expect(ions).toBeGreaterThan(60)
  })
})

describe('ec.valence', () => {
  it('expects the outer-shell count, 300 seeds', SWEEP, () => {
    const seen = new Set<number>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('electrons', 'ec.valence', seed)
      const q = question(p)
      const a = answerOf(p)
      const { z, charge } = q.species
      seen.add(z)
      expect(charge, p.id).toBe(0)
      // Main-group atoms only: no transition metal, and never hydrogen or helium.
      expect(z >= 3 && (z <= 20 || z >= 31), p.id).toBe(true)
      expect(a.expectedDisplay, p.id).toBe(String(valence(z)))
      expect(gradeValenceElectrons(q.species, String(valence(z))).verdict, p.id).toBe('correct')
      expect(gradeValenceElectrons(q.species, String(z)).verdict, p.id).not.toBe('correct')
      expect(a.context, p.id).not.toMatch(/3d|inner|outermost/i)
    }
    expect([31, 32, 33, 34, 35, 36].some((z) => seen.has(z))).toBe(true)
  })
})

describe('ec.diagram', () => {
  it('names a subshell where Hund matters and expects the whole-species count, 300 seeds', SWEEP, () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('electrons', 'ec.diagram', seed)
      const q = question(p)
      const a = answerOf(p)
      const { z, charge } = q.species
      const sub = q.subshell!
      const held = configOf(z, charge).find(([name]) => name === sub)
      expect(held, p.id).toBeDefined()
      const n = held![1]
      const orbitals = CAPACITY.get(sub)! / 2
      // Pairing early has to be possible: at least two electrons, and fewer than a pair in every box but one.
      expect(n >= 2 && n <= 2 * orbitals - 2, `${p.id}: ${sub} holds ${n}`).toBe(true)
      expect(a.prompt, p.id).toContain(`the ${sub} subshell of ${speciesShown(z, charge)}`)
      expect(gradeOrbitalDiagram(q.species, hundBoxes(sub, n), { subshell: sub }).verdict, p.id).toBe('correct')
      const count = unpaired(z, charge)
      expect(a.expectedDisplay.startsWith(`${sub}: `) && a.expectedDisplay.endsWith(`· ${count} unpaired`), `${p.id}: ${a.expectedDisplay}`).toBe(true)
      expect(gradeUnpairedElectrons(q.species, String(count)).verdict, p.id).toBe('correct')
      expect(gradeUnpairedElectrons(q.species, String(count + 1)).verdict, p.id).not.toBe('correct')
    }
  })
})
