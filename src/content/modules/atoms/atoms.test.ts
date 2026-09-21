import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content'
import type { AnswerSpec, ProblemInstance } from '@/content/types'
import {
  abundanceTotal,
  atomDisplay,
  averageMassMistakeCandidates,
  averageMassTask,
  evaluateSigFigTask,
  gradeAbundance,
  gradeAverageMass,
  gradeNotation,
  gradeParticles,
  particleCounts,
  solveAbundance,
  validateSigFigTask,
} from '@/engine'
import { elementBySymbol, elementByZ, NATURAL_ISOTOPES, NOTABLE_ISOTOPES } from '@/engine/chem/elements'
import type { ErrorPatternId } from '@/shared/types'

const TEMPLATES = ['atom.particles', 'atom.notation', 'atom.avgmass', 'atom.abundance'] as const
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)

/**
 * Written out here independently of the module's own file: the isotopes a problem may show are the
 * engine's natural and notable tables plus exactly these stable ones (from the brief).
 */
const BRIEF_STABLE = 'F-19 Ne-20 Na-23 Al-27 P-31 S-32 Ar-40 Ca-40 Sc-45 Mn-55 Fe-56 Co-59 Ni-58 Zn-64 As-75 Y-89 I-127 Cs-133 Au-197 Bi-209'.split(' ')
const ALLOWED = new Set<string>([
  ...BRIEF_STABLE,
  ...Object.entries(NATURAL_ISOTOPES).flatMap(([s, list]) => list.map((i) => `${s}-${i.massNumber}`)),
  ...NOTABLE_ISOTOPES.map((n) => `${n.symbol}-${n.massNumber}`),
])

type AtomAnswer = Extract<AnswerSpec, { type: 'atoms' }>

/** Seed loops are the slow part of this file: each instance is generated once and shared by the tests. */
const HEAVY = 60_000
const cache = new Map<string, ProblemInstance>()

function gen(templateId: string, seed: number): { p: ProblemInstance; a: AtomAnswer } {
  const key = `${templateId}:${seed}`
  let p = cache.get(key)
  if (!p) {
    p = generateProblem('atoms', templateId, seed)
    cache.set(key, p)
  }
  if (p.answer.type !== 'atoms') throw new Error('expected an atoms answer')
  return { p, a: p.answer }
}

function gradeExpected(a: AtomAnswer): string {
  const q = a.question
  const e = a.expected
  switch (q.kind) {
    case 'particles':
      return gradeParticles(q, { protons: e[0]!, neutrons: e[1]!, electrons: e[2]! }).status
    case 'notation':
      return gradeNotation(q, { symbol: e[0]!, massNumber: e[1]!, atomicNumber: e[2]!, charge: e[3]! }).status
    case 'avgmass':
      return gradeAverageMass(q, e[0]!).status
    case 'abundance':
      return gradeAbundance(q, [e[0]!, e[1]!]).status
  }
}

describe('atoms module registration', () => {
  it('is a Chemistry module ordered right after significant figures, with four templates', () => {
    const m = getModule('atoms')
    expect(m.subject).toBe('Chemistry')
    expect(m.title).toBe('Atomic structure')
    const ids = MODULES.map((x) => x.id)
    expect(ids.indexOf('atoms')).toBe(ids.indexOf('sigFigs') + 1)
    expect(m.templates.map((t) => t.id)).toEqual(TEMPLATES)
    expect(m.progress(generateProblem('atoms', 'atom.particles', 1), null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(m.nextStep(generateProblem('atoms', 'atom.particles', 1), null, false)).toBeNull()
  })

  it('has the rule cards the chapter needs, in its own words', () => {
    const titles = getModule('atoms').ruleCards.map((c) => c.title)
    for (const t of ['The protons pick the element', 'Mass number = protons + neutrons', 'Neutrons = A − Z', 'Electrons = Z − charge', 'Isotopes differ only in neutrons', 'Average atomic mass is a weighted average', 'A percent becomes a decimal before you multiply'])
      expect(titles).toContain(t)
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  const cardIds = new Set(getModule('atoms').ruleCards.map((c) => c.id))

  it('is deterministic, well formed, and its canonical answer grades correct', () => {
    for (const seed of SEEDS) {
      const { p, a } = gen(templateId, seed)
      expect(generateProblem('atoms', templateId, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`atoms/${templateId}@1/${seed.toString(36)}`)
      expect(p.kind).toBe('atoms')
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc).toEqual({ ti84: [], nspire: [] })
      expect(p.statementText).toBe(a.prompt)
      expect(p.params.fallback).toBe(false)
      expect(a.prompt.length).toBeGreaterThan(10)
      expect(a.reveal.length).toBeGreaterThan(2)
      expect(a.ruleCards[0]).toBe(a.ruleCard)
      for (const id of a.ruleCards) expect(cardIds.has(id), id).toBe(true)
      // A nudge never carries a number from the answer.
      for (const e of a.expected) {
        if (!/\d/.test(e)) continue
        const standalone = new RegExp(`(^|[^\\d.])${e.replace(/[.+]/g, (ch) => `\\${ch}`)}($|[^\\d.])`)
        expect(a.nudge, `${p.id}: ${e}`).not.toMatch(standalone)
      }
      expect(gradeExpected(a), `${p.id} ${a.expected.join('/')}`).toBe('correct')
    }
  }, HEAVY)
})

describe('atom.particles and atom.notation: only real isotopes and real charges', () => {
  it.each(['atom.particles', 'atom.notation'])('%s', (templateId) => {
    const shown = new Set<string>()
    const traps = new Set<string>()
    for (const seed of SEEDS) {
      const { a } = gen(templateId, seed)
      const q = a.question
      if (q.kind !== 'particles' && q.kind !== 'notation') throw new Error('unexpected kind')
      const p = q.particle
      const el = elementBySymbol(p.symbol)!
      expect(el.z).toBe(p.z)
      expect(ALLOWED.has(`${p.symbol}-${p.massNumber}`), `${p.symbol}-${p.massNumber}`).toBe(true)
      if (p.charge !== 0) expect(el.commonCharges, `${p.symbol} ${p.charge}`).toContain(p.charge)
      traps.add(a.trap)
      if (q.kind === 'particles') {
        shown.add(q.shown)
        if (q.shown === 'symbol') expect(a.latex).toMatch(/^\{\}\^\{\d+\}_\{\d+\}\\mathrm\{[A-Z][a-z]?\}/)
        else expect(a.periodic).toEqual([{ z: p.z, symbol: p.symbol, name: el.name }])
      } else {
        const { protons, electrons } = particleCounts(p)
        const zs = a.periodic.map((e) => e.z)
        expect(zs).toContain(protons)
        if (p.charge !== 0) expect(zs).toContain(electrons)
      }
    }
    if (templateId === 'atom.particles') expect([...shown].sort()).toEqual(['hyphen', 'ion', 'symbol'])
    expect(traps.size).toBeGreaterThanOrEqual(3)
  }, HEAVY)

  it('every particles trap is visible: each named mistake fires on the generated particle', () => {
    for (const seed of SEEDS) {
      const { a } = gen('atom.particles', seed)
      if (a.question.kind !== 'particles') continue
      const q = a.question
      const { protons: P, neutrons: N, electrons: E } = particleCounts(q.particle)
      const A = q.particle.massNumber
      const c = q.particle.charge
      const id = (pr: number, ne: number, el: number): ErrorPatternId[] =>
        gradeParticles(q, { protons: String(pr), neutrons: String(ne), electrons: String(el) }).patterns.map((x) => x.id)
      expect(id(P, A, E)).toEqual(['at_neutrons_as_mass_number'])
      expect(id(A, N, E)).toEqual(['at_swapped_a_z'])
      if (c !== 0) {
        expect(id(P, N, P)).toEqual(['at_electrons_ignored_charge'])
        expect(id(P, N, P + c)).toEqual(['at_charge_sign_flipped'])
        expect(id(P - c, N, E)).toEqual(['at_protons_changed_for_ion'])
      }
    }
  }, HEAVY)

  it('every notation trap is visible', () => {
    for (const seed of SEEDS) {
      const { a } = gen('atom.notation', seed)
      if (a.question.kind !== 'notation') continue
      const q = a.question
      const p = q.particle
      const { protons, neutrons, electrons } = particleCounts(p)
      const [sym, A, Z, ch] = a.expected as [string, string, string, string]
      const id = (s: string, m: number | string, z: number | string, c: string): ErrorPatternId[] =>
        gradeNotation(q, { symbol: s, massNumber: String(m), atomicNumber: String(z), charge: c }).patterns.map((x) => x.id)
      expect(id(sym.toUpperCase() === sym ? sym.toLowerCase() : sym.toUpperCase(), A, Z, ch)).toEqual(['at_symbol_case'])
      expect(id(sym, protons + electrons, Z, ch)).toEqual(['at_mass_protons_electrons'])
      expect(id(sym, neutrons, Z, ch)).toEqual(['at_mass_neutrons_only'])
      if (p.charge !== 0) {
        const flipped = ch.endsWith('+') ? ch.replace('+', '-') : ch.replace('-', '+')
        expect(id(sym, A, Z, flipped)).toEqual(['at_charge_sign_flipped'])
        const wrongElement = elementByZ(electrons)!.symbol
        expect(id(wrongElement, A, electrons, ch)).toEqual(['at_element_from_electrons'])
      }
    }
  }, HEAVY)
})

describe('atom.avgmass: real tables verbatim, made-up tables exact, validated by the sig-fig engine', () => {
  it('every seed', () => {
    const scenarios = new Set<string>()
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      const { p, a } = gen('atom.avgmass', seed)
      const q = a.question
      if (q.kind !== 'avgmass') throw new Error('unexpected kind')
      scenarios.add(String(p.params.scenario))
      expect(q.task).toEqual(averageMassTask(q.isotopes))
      expect(validateSigFigTask(q.task)).toEqual([])
      expect(evaluateSigFigTask(q.task).tie).toBe(false)
      expect(a.unit).toBe('u')
      if (q.fictional) {
        expect(q.symbol).toBe('X')
        expect(atomDisplay(abundanceTotal(q.isotopes))).toBe('100')
        for (const r of q.isotopes) {
          expect(r.label).toBe(`X-${r.massNumber}`)
          expect(r.mass).toMatch(/^\d+\.\d{3}$/)
          expect(r.abundance).toMatch(/^\d+\.\d{2}$/)
          expect(Number(r.mass)).toBeLessThan(r.massNumber)
          expect(Number(r.mass)).toBeGreaterThan(r.massNumber - 0.1)
        }
      } else {
        const el = elementBySymbol(q.symbol)!
        expect(q.element).toBe(el.name)
        expect(q.isotopes).toEqual(NATURAL_ISOTOPES[q.symbol]!.map((i) => ({ label: `${el.name}-${i.massNumber}`, massNumber: i.massNumber, mass: i.mass, abundance: i.abundance })))
        expect(q.symbol).not.toBe('H')
      }
      // Real tables repeat across seeds: the engine checks run once per distinct table.
      const key = JSON.stringify(q.isotopes)
      if (seen.has(key)) continue
      seen.add(key)
      const ids = averageMassMistakeCandidates(q).map((c) => c.id)
      for (const id of ['at_percent_not_decimal', 'at_unweighted_average', 'at_isotope_left_out'] as const) expect(ids, p.id).toContain(id)
      if (q.fictional) expect(ids, p.id).toContain('at_mass_numbers_used')
    }
    expect([...scenarios].sort()).toEqual(['element-x-three', 'element-x-two', 'real-three', 'real-two'])
  }, HEAVY)
})

describe('atom.abundance: real answers are the published abundances; made-up ones total 100', () => {
  it('every seed', () => {
    const scenarios = new Set<string>()
    for (const seed of SEEDS) {
      const { p, a } = gen('atom.abundance', seed)
      const q = a.question
      if (q.kind !== 'abundance') throw new Error('unexpected kind')
      scenarios.add(String(p.params.scenario))
      const { answer } = solveAbundance(q)
      expect(a.expected).toEqual(answer)
      expect(a.unit).toBe('%')
      // Never close to 50/50: assuming an even split must be a visible mistake.
      for (const v of answer) expect(Math.abs(Number(v) - 50)).toBeGreaterThan(10)
      expect(gradeAbundance(q, ['50', '50']).patterns.map((x) => x.id)).toEqual(['at_assumed_even_split'])
      expect(gradeAbundance(q, [answer[1], answer[0]]).patterns.map((x) => x.id)).toEqual(['at_abundance_swapped'])
      if (q.fictional) {
        expect(q.symbol).toBe('X')
        expect(q.place).toBe(-2)
      } else {
        const table = NATURAL_ISOTOPES[q.symbol]!
        expect(q.isotopes.map((i) => i.mass)).toEqual(table.map((i) => i.mass))
        expect(answer).toEqual(table.map((i) => i.abundance))
      }
    }
    expect([...scenarios].sort()).toEqual(['element-x', 'real'])
  }, HEAVY)
})
