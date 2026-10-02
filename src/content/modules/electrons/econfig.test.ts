import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ElectronsEconfigQuestion, ProblemInstance } from '@/content/types'
import { elementByZ } from '@/engine/chem/elements'
import {
  configurationDisplay,
  configurationLatex,
  configurationMistakes,
  configurationText,
  econfigProblem,
  electronCount,
  ERROR_PATTERNS,
  gradeIdentifySpecies,
  gradeOrbitalDiagram,
  gradeUnpairedElectrons,
  gradeValenceElectrons,
  identifyMistakes,
  orbitalDiagram,
  orbitalDiagramMistakes,
  unpairedMistakes,
  valenceMistakes,
  speciesDisplay,
  speciesText,
  unpairedElectrons,
  valenceElectrons,
} from '@/engine'
import type { EconfigForm } from '@/engine'
import { ECONFIG_TEMPLATE_IDS, configurationOrdersGrade, isTransitionCation, trapKinds } from './econfig'
import { EC_MISTAKE_IDS } from './patterns'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SLOW = 120_000

/** Transition-metal cations the ion template should keep showing (4s leaves first). */
const LISTED_IONS = ['Fe2+', 'Fe3+', 'Mn2+', 'Co2+', 'Ni2+', 'Zn2+', 'Cu+', 'Cu2+', 'Cr3+']

const cache = new Map<string, ProblemInstance>()

function gen(templateId: string, seed: number): ProblemInstance {
  const key = `${templateId}:${seed}`
  let p = cache.get(key)
  if (!p) {
    p = generateProblem('electrons', templateId, seed)
    cache.set(key, p)
  }
  return p
}

function econfigOf(p: ProblemInstance): ElectronsEconfigQuestion {
  if (p.answer.type !== 'electrons' || p.answer.question.kind !== 'econfig') throw new Error(`${p.id} is not an econfig problem`)
  return p.answer.question
}

describe('econfig mistake ids', () => {
  it('has a catalog entry for every ec_ id, one per engine mistake', () => {
    expect(EC_MISTAKE_IDS).toHaveLength(17)
    for (const id of EC_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(0)
      expect(info.example).toContain('→')
    }
  })
})

describe.each(ECONFIG_TEMPLATE_IDS)('%s over 300 seeds', (templateId) => {
  it('is deterministic, passes econfigProblem, and the canonical answer grades correct', () => {
    let heavy = 0
    let exceptions = 0
    let gaKr = 0
    let ions = 0
    let dSubshell = 0
    let mainFull = 0
    let mainShort = 0
    const listed = new Set<string>()

    for (const seed of SEEDS) {
      const p = gen(templateId, seed)
      expect(generateProblem('electrons', templateId, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`electrons/${templateId}@1/${seed.toString(36)}`)
      expect(p.kind).toBe('electrons')
      expect(p.moduleId).toBe('electrons')
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc).toEqual({ ti84: [], nspire: [] })
      expect(p.answer.type).toBe('electrons')
      if (p.answer.type !== 'electrons') continue
      const q = econfigOf(p)
      const sp = q.species
      expect(p.answer.ruleCards[0]).toBe(p.answer.ruleCard)
      expect(p.answer.reveal.length).toBeGreaterThan(0)
      expect(p.answer.expectedDisplay.length).toBeGreaterThan(0)

      if (q.ask === 'full' || q.ask === 'shorthand' || q.ask === 'ion') {
        const form: EconfigForm = q.form ?? 'full'
        expect(econfigProblem(sp, form)).toBeNull()
        expect(configurationOrdersGrade(sp, form)).toBe(true)
        const written = configurationText(sp, { form })
        expect(p.answer.nudge).not.toContain(written)
        expect(p.answer.context).not.toContain(written)
        expect(p.instructions).not.toContain(written)
        expect(p.answer.prompt).not.toContain(written)
        expect(q.display).toBe(speciesDisplay(sp))
      }

      if (templateId === 'ec.full' || templateId === 'ec.shorthand') {
        expect(sp.charge).toBe(0)
        expect(sp.z).toBeGreaterThanOrEqual(3)
        if (sp.z >= 21) heavy++
        if (sp.z === 24 || sp.z === 29) exceptions++
      }

      if (templateId === 'ec.ion') {
        expect(sp.charge).not.toBe(0)
        expect(electronCount(sp)).toBeGreaterThan(2)
        const label = speciesText(sp)
        if (LISTED_IONS.includes(label)) listed.add(label)
        if (isTransitionCation(sp)) expect(q.form).toBe('shorthand')
        else if (q.form === 'full') mainFull++
        else mainShort++
      }

      if (templateId === 'ec.identify') {
        const form: EconfigForm = q.form ?? 'full'
        expect(econfigProblem(sp, 'identify')).toBeNull()
        expect(econfigProblem(sp, form)).toBeNull()
        expect(gradeIdentifySpecies(sp, speciesText({ z: sp.z, charge: 0 })).verdict).toBe('correct')
        const el = elementByZ(sp.z)
        expect(el).toBeTruthy()
        expect(gradeIdentifySpecies(sp, el!.name).verdict).toBe('correct')
        expect(p.answer.prompt.toLowerCase()).not.toContain(el!.name)
        expect(p.answer.prompt).not.toContain(speciesDisplay(sp))
        expect(q.latex).toBe(configurationLatex(sp, { form }))
        expect(q.display).toBe(configurationDisplay(sp, { form }))
        expect(q.display).not.toBe(speciesDisplay(sp))
        if (sp.charge !== 0) {
          ions++
          expect(p.answer.prompt).toContain('charge')
          expect(p.answer.prompt).toContain(String(Math.abs(sp.charge)))
        }
      }

      if (templateId === 'ec.valence') {
        expect(econfigProblem(sp, 'valence')).toBeNull()
        expect(sp.charge).toBe(0)
        expect(sp.z).toBeGreaterThanOrEqual(3)
        const count = valenceElectrons(sp)
        expect(count).not.toBeNull()
        expect(gradeValenceElectrons(sp, String(count)).verdict).toBe('correct')
        expect(p.answer.expectedDisplay).toBe(String(count))
        if (sp.z >= 31) gaKr++
      }

      if (templateId === 'ec.diagram') {
        expect(q.subshell).toBeTruthy()
        expect(econfigProblem(sp, 'diagram', q.subshell)).toBeNull()
        expect(econfigProblem(sp, 'unpaired')).toBeNull()
        const info = orbitalDiagram(sp, q.subshell)
        expect(orbitalDiagramMistakes(sp, q.subshell)?.some((c) => c.kind === 'hund_broken')).toBe(true)
        expect(gradeOrbitalDiagram(sp, info.boxes, { subshell: q.subshell }).verdict).toBe('correct')
        expect(gradeUnpairedElectrons(sp, String(unpairedElectrons(sp)), { diagram: info.boxes, subshell: q.subshell }).verdict).toBe('correct')
        expect(p.answer.prompt).toContain(q.subshell!)
        expect(p.answer.prompt).toContain(speciesDisplay(sp))
        if (sp.charge !== 0) ions++
        if (q.subshell!.endsWith('d')) dSubshell++
      }

      if (p.answer.trap === 'none') expect(trapKinds(q)).toEqual([])
      else expect(trapKinds(q)).toContain(p.answer.trap)
    }

    if (templateId === 'ec.full' || templateId === 'ec.shorthand') {
      expect(heavy / SEEDS.length).toBeGreaterThan(0.65)
      expect(exceptions).toBeGreaterThanOrEqual(30)
    }
    if (templateId === 'ec.ion') {
      expect(listed).toEqual(new Set(LISTED_IONS))
      expect(mainFull).toBeGreaterThan(0)
      expect(mainShort).toBeGreaterThan(0)
    }
    if (templateId === 'ec.valence') expect(gaKr).toBeGreaterThan(60)
    if (templateId === 'ec.identify') expect(ions).toBeGreaterThan(0)
    if (templateId === 'ec.diagram') {
      expect(ions).toBeGreaterThan(0)
      expect(dSubshell).toBeGreaterThan(0)
    }
  }, SLOW)

  it('offers the mistake it promises as something she could actually type', () => {
    for (const seed of SEEDS) {
      const p = gen(templateId, seed)
      if (p.answer.type !== 'electrons' || p.answer.question.kind !== 'econfig') throw new Error('econfig')
      const q = p.answer.question
      const trap = p.answer.trap
      if (trap === 'none') continue
      const label = `${templateId}/${seed} ${trap}`
      if (q.ask === 'full' || q.ask === 'shorthand' || q.ask === 'ion') {
        const cand = configurationMistakes(q.species, q.form ?? 'full')?.find((c) => c.kind === trap)
        expect(cand, label).toBeTruthy()
        expect(cand!.text.length).toBeGreaterThan(0)
      } else if (q.ask === 'identify') {
        const cand = identifyMistakes(q.species)?.find((c) => c.kind === trap)
        expect(cand, label).toBeTruthy()
        expect(cand!.text.length).toBeGreaterThan(0)
      } else if (q.ask === 'valence') {
        const cand = valenceMistakes(q.species)?.find((c) => c.kind === trap)
        expect(cand, label).toBeTruthy()
        expect(cand!.text.length).toBeGreaterThan(0)
      } else {
        const diagram = orbitalDiagramMistakes(q.species, q.subshell)?.find((c) => c.kind === trap)
        const unpaired = unpairedMistakes(q.species)?.find((c) => c.kind === trap)
        const cand = diagram ?? unpaired
        expect(cand, label).toBeTruthy()
        expect(cand!.text.length).toBeGreaterThan(0)
      }
    }
  }, SLOW)
})
