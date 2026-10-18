/**
 * Honors geometry Unit 4. Every seed grades its own answers, keeps the promised trap as a real
 * candidate, and leaves the answer out of anything she can read before she finishes.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { ModuleId } from '@/shared/types'
import type { GeometryAnswer } from '@/content/types'
import { GEO_UNIT4_MISTAKE_IDS, containsAnswer, exampleShowsAnswer, gradeGeoStage, stageDisplay } from './grade'
import { CONGRUENCE_RULES, ISOSCELES_RULES, TRIANGLE_PROOF_RULES } from './unit4Rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const RESERVED = ['4', '6', '11', '15', '17', '19', '23', '24', '26', '29', '37', '41', '53', '60', '64', '90', '165', '180']

const TEMPLATES: { module: ModuleId; template: string; cards: { id: string; title: string; body: string; example?: string }[] }[] = [
  { module: 'geoCongruence', template: 'gc.parts', cards: CONGRUENCE_RULES },
  { module: 'geoCongruence', template: 'gc.which', cards: CONGRUENCE_RULES },
  { module: 'geoCongruence', template: 'gc.solve', cards: CONGRUENCE_RULES },
  { module: 'geoIsosceles', template: 'gi.solve', cards: ISOSCELES_RULES },
  { module: 'geoTriangleProofs', template: 'gt.twocolumn', cards: TRIANGLE_PROOF_RULES },
]

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

function choiceById(stage: GeometryAnswer['stages'][number], id: string) {
  return stage.choices?.find((choice) => choice.id === id)
}

describe('geometry unit 4 registration', () => {
  it('puts the three modules in Unit 4 order, after the polygon module', () => {
    const congruence = getModule('geoCongruence')
    const isosceles = getModule('geoIsosceles')
    const proofs = getModule('geoTriangleProofs')
    expect(congruence.title).toBe('Congruent triangles')
    expect(isosceles.title).toBe('Isosceles and equilateral triangles')
    expect(proofs.title).toBe('Proving triangles congruent')
    expect(congruence.order).toBe(15)
    expect(isosceles.order).toBe(16)
    expect(proofs.order).toBe(17)
    expect(congruence.order).toBeGreaterThan(getModule('geoPolygonAngles').order)
    expect(congruence.templates.map((t) => t.id)).toEqual(['gc.parts', 'gc.which', 'gc.solve'])
    expect(isosceles.templates.map((t) => t.id)).toEqual(['gi.solve'])
    expect(proofs.templates.map((t) => t.id)).toEqual(['gt.twocolumn'])
    const sample = generateProblem('geoCongruence', 'gc.parts', 1)
    expect(sample.kind).toBe('geometry')
    expect(congruence.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(congruence.nextStep(sample, null, false)).toBeNull()
    expect(isosceles.nextStep(sample, null, false)).toBeNull()
    expect(proofs.nextStep(sample, null, false)).toBeNull()
  })

  it('seed 1 of each template shows the trap named for that problem', () => {
    expect(answerOf('geoCongruence', 'gc.parts', 1).trap).toBe('geo_vertices_out_of_order')
    const which = answerOf('geoCongruence', 'gc.which', 1)
    expect(which.stages[0]!.answerText).toBe('SSS')
    expect(which.trap).toBe('geo_hl_no_right')
    expect(which.trapAnswer).toBe('HL')
    expect(answerOf('geoCongruence', 'gc.solve', 1).trap).toBe('geo_vertices_out_of_order')
    expect(answerOf('geoIsosceles', 'gi.solve', 1).trap).toBe('geo_base_angles_wrong_vertex')
    expect(answerOf('geoTriangleProofs', 'gt.twocolumn', 1).trap).toBe('geo_cpctc_too_soon')
  })
})

describe.each(TEMPLATES)('$module/$template over 300 seeds', ({ module, template, cards }) => {
  const cardIds = new Set(cards.map((card) => card.id))

  it('is deterministic, validates its answers, and keeps the trap as a real candidate', () => {
    for (const seed of SEEDS) {
      const p = generateProblem(module, template, seed)
      expect(generateProblem(module, template, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`${module}/${template}@1/${seed.toString(36)}`)
      expect(p.kind).toBe('geometry')
      expect(p.answer.type).toBe('geometry')
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const a = p.answer
      expect(a.stages.length).toBeGreaterThan(0)
      expect(a.figure.ariaLabel.length).toBeGreaterThan(0)
      for (const n of a.angles) expect(n > 0 && n < 180, `${p.id} angle ${n}`).toBe(true)
      for (const n of a.lengths) expect(n > 0, `${p.id} length ${n}`).toBe(true)
      const before = [a.prompt, a.figure.ariaLabel]
      for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
      for (const ang of a.figure.angles ?? []) if (ang.label) before.push(ang.label)
      const blob = before.join('\n')
      for (const stage of a.stages) {
        expect(cardIds.has(stage.ruleCard), stage.ruleCard).toBe(true)
        expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${p.id} ${stage.id}`).toBe('correct')
        for (const alt of stage.accept ?? []) {
          expect(gradeGeoStage(a, stage.id, alt).verdict, `${p.id} accept ${alt}`).toBe('correct')
        }
        const display = stageDisplay(stage)
        // The Given list is the problem. A row whose answer is the reason "Given" repeats it on purpose.
        const givenReason = stage.kind === 'reason' && stage.answerText === 'given'
        if (!givenReason) expect(containsAnswer(blob, display), `${p.id} shows “${display}”`).toBe(false)
        expect(RESERVED.includes(display), `${p.id} reserved ${display}`).toBe(false)
        expect(RESERVED.includes(stage.answerText), `${p.id} reserved ${stage.answerText}`).toBe(false)
        for (const line of stage.reveal) expect(blob.includes(line), `${p.id} reveal`).toBe(false)
        const garbage = stage.kind === 'choice' ? '' : '???'
        expect(gradeGeoStage(a, stage.id, garbage).verdict, `${p.id} garbage`).toBe('invalid')
      }
      const promised = a.stages.find((stage) => stage.id === a.trapStage)
      expect(promised?.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer), `${p.id} ${a.trap}`).toBe(true)
      const trapGrade = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(trapGrade.verdict, `${p.id} ${a.trapAnswer}`).toBe('mistake')
      if (trapGrade.verdict === 'mistake') expect(trapGrade.mistake).toBe(a.trap)
      if (template === 'gc.solve') expect(a.trapStage).toBe('x')
      if (template === 'gi.solve' && a.trap === 'geo_base_angles_wrong_vertex') expect(a.trapStage).toBe('x')
      if (a.trap === 'geo_equilateral_angle_for_side') expect(a.trapStage).toBe('result')
      expect(`${a.prompt}\n${a.figure.ariaLabel}`, p.id).not.toMatch(/\bmatch(?:es|ing)?\b/i)
      if (template === 'gc.which') {
        expect(a.prompt).toBe('Which postulate or theorem, if any, proves the triangles congruent?')
      }
      if (template === 'gc.parts') {
        const name = /^△[A-Z]{3} ≅ △[A-Z]{3}\. Which (angle of △[A-Z]{3} corresponds to ∠[A-Z]|side of △[A-Z]{3} corresponds to [A-Z]{2})\?$/
        expect(name.test(a.prompt) || a.prompt === 'Which congruence statement do the marks support?', a.prompt).toBe(true)
      }
      if (template === 'gc.solve') {
        expect(a.prompt).toMatch(/^△[A-Z]{3} ≅ △[A-Z]{3}\. .+\. Find x, then (m∠[A-Z]|[A-Z]{2})\.$/)
      }
      if (template === 'gt.twocolumn') expect(a.prompt).toMatch(/^Given: .+\. Prove: .+\.$/)
    }
  }, HEAVY)
})

describe('geometry unit 4 trap coverage', () => {
  it('every new geo_ id is a real candidate on some seed', () => {
    const seen = new Set<string>()
    for (const { module, template } of TEMPLATES) {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
      }
    }
    for (const id of GEO_UNIT4_MISTAKE_IDS) {
      expect(seen.has(id), id).toBe(true)
      expect(ERROR_PATTERNS[id].lesson.length, id).toBeGreaterThan(40)
      expect(ERROR_PATTERNS[id].example, id).toContain('✗')
    }
  }, HEAVY)

  it('examples, witnesses, hints, nudges, and notes do not show a generated answer, over 2000 seeds', () => {
    // Titles, lessons, and rule-card bodies may name the methods. A card that lists every method
    // singles out none. The example, the witness, and the lines still on screen may not.
    const clashes: string[] = []
    for (const { module, template, cards } of TEMPLATES) {
      for (let seed = 1; seed <= 2000; seed++) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) {
          const display = stageDisplay(stage)
          const shown = [stage.hint, stage.nudge, stage.note ?? ''].join('\n')
          if (containsAnswer(shown, display)) clashes.push(`${template}/${seed} ${display}: hint`)
          for (const trap of stage.traps) {
            const info = ERROR_PATTERNS[trap.id]
            if (
              containsAnswer(info.example, display) ||
              exampleShowsAnswer(info.example, display) ||
              containsAnswer(trap.witness, display)
            ) {
              clashes.push(`${template}/${seed} ${display}: ${trap.id}`)
            }
          }
          for (const card of cards) {
            const example = card.example ?? ''
            if (containsAnswer(example, display) || exampleShowsAnswer(example, display)) {
              clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
            }
          }
        }
      }
    }
    expect(clashes.slice(0, 8)).toEqual([])
  }, HEAVY)
})

describe('unit 4 variety and the which-method traps', () => {
  it('letters, correspondences, x, and the six which-answers all show up over 300 seeds', () => {
    const perms = {
      parts: new Set<number>(),
      solve: new Set<number>(),
      which: new Set<number>(),
      proof: new Set<number>(),
    }
    const xs = { solve: new Set<string>(), iso: new Set<string>() }
    const whichAnswers = new Map<string, number>()
    let statement = 0
    let alpha = 0
    for (const seed of SEEDS) {
      const parts = generateProblem('geoCongruence', 'gc.parts', seed)
      perms.parts.add(Number(parts.params.perm))
      if ((seed - 1) % 2 === 1) {
        statement += 1
        if (parts.params.alphaSame === 1) alpha += 1
      }
      const which = generateProblem('geoCongruence', 'gc.which', seed)
      perms.which.add(Number(which.params.perm))
      if (which.answer.type !== 'geometry') throw new Error('which')
      const ans = which.answer.stages[0]!.answerText
      whichAnswers.set(ans, (whichAnswers.get(ans) ?? 0) + 1)
      const solve = generateProblem('geoCongruence', 'gc.solve', seed)
      perms.solve.add(Number(solve.params.perm))
      if (solve.answer.type !== 'geometry') throw new Error('solve')
      xs.solve.add(solve.answer.stages[0]!.answerText)
      const iso = generateProblem('geoIsosceles', 'gi.solve', seed)
      if (iso.answer.type !== 'geometry') throw new Error('iso')
      xs.iso.add(iso.answer.stages[0]!.answerText)
      const proof = generateProblem('geoTriangleProofs', 'gt.twocolumn', seed)
      if (proof.params.perm !== undefined) perms.proof.add(Number(proof.params.perm))
      for (const built of [parts, which, solve, iso, proof]) {
        if (built.answer.type !== 'geometry') continue
        const letters = built.answer.figure.points.map((point) => point.id).join('')
        expect(letters.replace(/M/g, ''), built.id).not.toMatch(/[IOJKLX]/)
      }
    }
    for (const [name, set] of Object.entries(perms)) expect([...set].sort((a, b) => a - b), name).toEqual([0, 1, 2, 3, 4, 5])
    expect(xs.solve.size).toBeGreaterThanOrEqual(10)
    expect(xs.iso.size).toBeGreaterThanOrEqual(10)
    for (const id of ['SSS', 'SAS', 'ASA', 'AAS', 'HL', 'none']) {
      const n = whichAnswers.get(id) ?? 0
      expect(n / SEEDS.length, id).toBeGreaterThanOrEqual(0.12)
      expect(n / SEEDS.length, id).toBeLessThanOrEqual(0.22)
    }
    expect(statement).toBe(150)
    expect(alpha / statement).toBeLessThanOrEqual(0.25)
  }, HEAVY)

  it('HL treats SSA as a plain wrong pick, and a figure with no angle does not call SSA or AAA', () => {
    for (const seed of SEEDS) {
      const built = generateProblem('geoCongruence', 'gc.which', seed)
      if (built.answer.type !== 'geometry') throw new Error('which')
      const a = built.answer
      const stage = a.stages[0]!
      const answer = stage.answerText
      const family = String(built.params.case)
      const where = `gc.which/${seed} ${family} ${answer}`
      const ssa = choiceById(stage, 'SSA')
      const aaa = choiceById(stage, 'AAA')
      if (answer === 'HL') {
        expect(ssa?.trap, where).toBeUndefined()
        expect(gradeGeoStage(a, 'a', 'SSA').verdict, where).toBe('wrong')
        expect(choiceById(stage, 'SAS')?.trap, where).toBe('geo_sas_not_included')
      }
      if (answer === 'SSS' && a.figure.ariaLabel.includes('Angle pairs: none')) {
        expect(ssa?.trap, where).toBeUndefined()
        expect(aaa?.trap, where).toBeUndefined()
        expect(gradeGeoStage(a, 'a', 'SSA').verdict, where).toBe('wrong')
        expect(gradeGeoStage(a, 'a', 'AAA').verdict, where).toBe('wrong')
      }
      if (family === 'kite' || family === 'vertical' || family === 'vertical-one') {
        expect(ssa?.trap, where).toBeUndefined()
        expect(gradeGeoStage(a, 'a', 'SSA').verdict, where).toBe('wrong')
      }
      if (a.figure.ariaLabel.includes('Right angles: none')) {
        expect(choiceById(stage, 'HL')?.trap, where).toBe('geo_hl_no_right')
      }
    }
  }, HEAVY)

  it('proof: the SSS row is too soon for corresponding parts, and a shared side is not given', () => {
    const first = generateProblem('geoTriangleProofs', 'gt.twocolumn', 1)
    expect(first.params.skeleton).toBe('sss-three')
    if (first.answer.type !== 'geometry') throw new Error('not geometry')
    expect(first.answer.trap).toBe('geo_cpctc_too_soon')
    expect(first.answer.trapAnswer).toBe('thm-cpctc')
    expect(first.answer.trapStage).toBe('d')
    expect(gradeGeoStage(first.answer, 'd', 'thm-cpctc')).toMatchObject({ verdict: 'mistake', mistake: 'geo_cpctc_too_soon' })
    expect(gradeGeoStage(first.answer, 'd', 'post-sss').verdict).toBe('correct')

    const shared = generateProblem('geoTriangleProofs', 'gt.twocolumn', 6)
    expect(shared.params.skeleton).toBe('sss-shared')
    if (shared.answer.type !== 'geometry') throw new Error('not geometry')
    expect(shared.answer.trap).toBe('geo_shared_side_missed')
    expect(shared.answer.trapAnswer).toBe('given')
    expect(shared.answer.trapStage).toBe('c')
    expect(gradeGeoStage(shared.answer, 'c', 'given')).toMatchObject({ verdict: 'mistake', mistake: 'geo_shared_side_missed' })
    expect(gradeGeoStage(shared.answer, 'c', 'cong-refl').verdict).toBe('correct')
  })
})
