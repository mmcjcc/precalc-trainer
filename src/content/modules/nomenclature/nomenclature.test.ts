/**
 * Chapter 7 templates over 300 seeds each: deterministic, in the engine's model, every answer checked with the
 * engine's own graders (the core document's "Self-tests per seed"), the promised trap a real candidate of THIS
 * problem, nothing that shows the answer before she answers, and enough different problems. Then hand-worked
 * textbook examples through the module's grader, with the spellings a textbook accepts.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, makeRng, MODULES } from '@/content'
import type { NmStage, NomenclatureAnswer } from '@/content/types'
import {
  classifyMistakes,
  classOfFormula,
  compoundOfFormula,
  ERROR_PATTERNS,
  formulaDisplay,
  formulaFromNameMistakes,
  formulaOfName,
  gradeClassify,
  gradeFormulaFromName,
  gradeIonFormula,
  gradeIonicFormula,
  gradeIonName,
  gradeNameFromFormula,
  ionFormulaMistakes,
  ionicFormula,
  ionicFormulaMistakes,
  ionicPairProblem,
  ionNameMistakes,
  nameFromFormulaMistakes,
  nameOfFormula,
  nmIon,
  NM_MISTAKE_IDS,
  nomenclatureProblem,
  readChemicalFormula,
  readIonFormula,
  type NmGrade,
  type NmMistakeCandidate,
} from '@/engine'
import { stageOf } from './build'
import { rungTwoCards } from './check'
import { nmShown, safeNote } from './feedback'
import { acidProblem, classifyProblem, hydrateProblem, ionicFormulaProblem, ionicFromNameProblem, ionicNameProblem, ionProblem, molecularProblem, nmAnswer, NM_TEMPLATES, type NmDrawn } from './generate'
import { gradeNmStage } from './grade'
import { leaksTo, stageKeys } from './leaks'
import { poolAcids } from './pools'
import { ION_RULE_IDS, MOLECULAR_RULE_IDS, nmRule, NM_RULES } from './rules'

const HEAVY = 120_000
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)

function problem(moduleId: string, templateId: string, seed: number): { p: ReturnType<typeof generateProblem>; a: NomenclatureAnswer } {
  const p = generateProblem(moduleId as never, templateId, seed)
  if (p.answer.type !== 'nomenclature') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return { p, a: p.answer }
}

const verdictOf = (g: NmGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)

/** The engine's grader and candidates for a check, called directly (not through the module). */
function engineFor(stage: NmStage): { grade: (t: string) => NmGrade; candidates: NmMistakeCandidate[] | null; answer: string; problem: string | null } {
  const c = stage.check
  switch (c.kind) {
    case 'ion_name':
      return { grade: (t) => gradeIonName(c.ion, t), candidates: ionNameMistakes(c.ion), answer: nmIon(c.ion).name, problem: nomenclatureProblem(c.ion, 'ion_name') }
    case 'ion_formula':
      return { grade: (t) => gradeIonFormula(c.ion, t), candidates: ionFormulaMistakes(c.ion), answer: nmIon(c.ion).text, problem: nomenclatureProblem(c.ion, 'ion_formula') }
    case 'ionic_formula':
      return {
        grade: (t) => gradeIonicFormula(c.cation, c.anion, t),
        candidates: ionicFormulaMistakes(c.cation, c.anion),
        answer: ionicFormula(c.cation, c.anion),
        problem: ionicPairProblem(c.cation, c.anion),
      }
    case 'name':
      return { grade: (t) => gradeNameFromFormula(c.formula, t), candidates: nameFromFormulaMistakes(c.formula), answer: nameOfFormula(c.formula), problem: nomenclatureProblem(c.formula, 'name') }
    case 'formula':
      return { grade: (t) => gradeFormulaFromName(c.name, t), candidates: formulaFromNameMistakes(c.name), answer: formulaOfName(c.name), problem: nomenclatureProblem(c.name, 'formula') }
    case 'classify':
      return { grade: (t) => gradeClassify(c.formula, t), candidates: classifyMistakes(c.formula), answer: classOfFormula(c.formula), problem: nomenclatureProblem(c.formula, 'classify') }
  }
}

/** True when `answer` is in `text` as a whole formula or name (an independent, plainer check than the module's). */
function plainlyShows(text: string, answer: string, isName: boolean): boolean {
  if (!text || !answer) return false
  if (isName) {
    const t = ` ${text.toLowerCase().replace(/[.,:;!?()’'“”]/g, ' ').replace(/\s+/g, ' ')} `
    const a = answer.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
    return t.replace(/[()]/g, ' ').replace(/\s+/g, ' ').includes(` ${a} `)
  }
  for (const form of [answer, formulaDisplay(answer)]) {
    for (let i = text.indexOf(form); i >= 0; i = text.indexOf(form, i + 1)) {
      const next = text[i + form.length]
      const prev = text[i - 1]
      const glued = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9(₀-₉⁰-⁹⁺⁻·]/.test(ch)
      if (!glued(next) && !(prev !== undefined && /[A-Za-z0-9₀-₉]/.test(prev))) return true
    }
  }
  return false
}

describe('chapter 7 registration', () => {
  it('is two Chemistry modules after the periodic table and before geometry, four templates each', () => {
    const ionic = getModule('ionicNames')
    const molecular = getModule('molecularAcids')
    expect(ionic.subject).toBe('Chemistry')
    expect(molecular.subject).toBe('Chemistry')
    expect(ionic.title).toBe('Ions and ionic compounds')
    expect(molecular.title).toBe('Molecular compounds, acids, and hydrates')
    const ids = MODULES.map((m) => m.id)
    expect(ids.indexOf('ionicNames')).toBe(ids.indexOf('periodic') + 1)
    expect(ids.indexOf('molecularAcids')).toBe(ids.indexOf('ionicNames') + 1)
    expect(ids.indexOf('geoSegments')).toBe(ids.indexOf('molecularAcids') + 1)
    expect(ionic.templates.map((t) => t.id)).toEqual(['nm.ion', 'nm.ionicFormula', 'nm.ionicName', 'nm.ionicFromName'])
    expect(molecular.templates.map((t) => t.id)).toEqual(['nm.molecular', 'nm.acid', 'nm.hydrate', 'nm.classify'])
    expect(ionic.ruleCards.map((c) => c.id)).toEqual([...ION_RULE_IDS])
    expect(molecular.ruleCards.map((c) => c.id)).toEqual([...MOLECULAR_RULE_IDS])
    const sample = generateProblem('ionicNames', 'nm.ion', 1)
    expect(ionic.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(ionic.nextStep(sample, null, false)).toBeNull()
  })

  it('has a catalog entry for every nm_ id, and a rule card with a wrong → right example for every topic', () => {
    for (const id of NM_MISTAKE_IDS) {
      expect(ERROR_PATTERNS[id].id).toBe(id)
      expect(ERROR_PATTERNS[id].title.length).toBeGreaterThan(0)
    }
    expect(NM_RULES.map((c) => c.id)).toEqual(['nm.charges', 'nm.numeral', 'nm.polyatomic', 'nm.crisscross', 'nm.ionicNaming', 'nm.prefixes', 'nm.acids', 'nm.hydrates', 'nm.classify'])
    for (const card of NM_RULES) {
      expect(card.example, card.id).toContain('✗')
      expect(card.example, card.id).toContain('→')
      expect(nmRule(card.id)).toBe(card)
    }
  })
})

describe.each(NM_TEMPLATES)('$templateId over 300 seeds', ({ moduleId, templateId }) => {
  it(
    'is deterministic and in the model, its answers are the engine’s and grade right, and its promised trap is a real candidate',
    () => {
      for (const seed of SEEDS) {
        const { p, a } = problem(moduleId, templateId, seed)
        expect(generateProblem(moduleId as never, templateId, seed)).toEqual(p)
        expect(p.id).toBe(`${moduleId}/${templateId}@1/${seed.toString(36)}`)
        expect(p.kind).toBe('nomenclature')
        expect(p.moduleId).toBe(moduleId)
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        expect(p.statementText).toBe(a.prompt)
        expect(a.problem.length).toBeGreaterThan(0)
        for (const stage of a.stages) {
          const where = `${templateId}/${seed} ${stage.id}`
          const engine = engineFor(stage)
          expect(engine.problem, where).toBeNull()
          expect(stage.answerText, where).toBe(engine.answer)
          // The core's self-test, with the engine's grader called directly …
          expect(verdictOf(engine.grade(stage.answerText)), where).toBe('correct')
          // … and through the module, for the answer, every accepted form, and the display form of a formula.
          for (const text of [stage.answerText, ...stage.accept, ...(stage.kind === 'name' || stage.kind === 'choice' ? [] : [formulaDisplay(stage.answerText)])])
            expect(verdictOf(gradeNmStage(a, stage.id, text)), `${where} ${text}`).toBe('correct')
          // The candidates are the engine's list for THIS problem, and each grades as its own id.
          expect(stage.traps.map((t) => [t.id, t.text]), where).toEqual((engine.candidates ?? []).map((c) => [c.id, c.text]))
          for (const trap of stage.traps) {
            expect(trap.text).not.toBe(stage.answerText)
            expect(verdictOf(gradeNmStage(a, stage.id, trap.text)), `${where} ${trap.text}`).toBe(trap.id)
          }
          // A choice that is also right is never a distractor: exactly one of the four kinds grades correct.
          if (stage.kind === 'choice') {
            const right = (stage.choices ?? []).filter((c) => verdictOf(gradeNmStage(a, stage.id, c.id)) === 'correct').map((c) => c.id)
            expect(right, where).toEqual([stage.answerText])
            for (const c of stage.choices ?? []) if (c.trap) expect(verdictOf(gradeNmStage(a, stage.id, c.id))).toBe(c.trap)
          }
        }
        const main = a.stages[a.stages.length - 1]!
        if (main.traps.length > 0) {
          expect(a.trap, `${templateId}/${seed}`).toBeTruthy()
          expect(a.trapStage).toBe(main.id)
          expect(main.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer)).toBe(true)
          expect(verdictOf(gradeNmStage(a, main.id, a.trapAnswer!))).toBe(a.trap)
        } else expect(a.trap).toBeUndefined()
      }
    },
    HEAVY,
  )

  it(
    'shows nothing that gives the answer away before she answers',
    () => {
      for (const seed of SEEDS) {
        const { a } = problem(moduleId, templateId, seed)
        for (const stage of a.stages) {
          const keys = stageKeys(stage)
          const where = `${templateId}/${seed} ${stage.id}`
          const isName = stage.kind === 'name' || stage.kind === 'choice'
          const before = [a.prompt, stage.hint, stage.nudge, ...rungTwoCards(a, stage).map((id) => `${nmRule(id).title} ${nmRule(id).body} ${nmRule(id).example ?? ''}`)]
          for (const text of before) {
            expect(leaksTo(text, keys), `${where}: ${text}`).toBe(false)
            expect(plainlyShows(text, stage.answerText, isName), `${where}: ${text}`).toBe(false)
          }
          for (const trap of stage.traps) {
            const shown = nmShown(stage, gradeNmStage(a, stage.id, trap.text), trap.text)
            if (shown.kind !== 'mistake') throw new Error(`${where}: ${trap.id} is not shown as a mistake`)
            expect(shown.id).toBe(trap.id)
            // Her own answer may be quoted back ("hydrogen sulfate" contains the word sulfate), as in the engine's own test.
            const hers = new RegExp(trap.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            for (const text of [shown.title, shown.lesson, shown.witness, shown.example]) {
              expect(leaksTo(text, keys, trap.text), `${where} ${trap.id}: ${text}`).toBe(false)
              expect(plainlyShows(text.replace(hers, '…'), stage.answerText, isName), `${where} ${trap.id}: ${text}`).toBe(false)
            }
          }
        }
      }
    },
    HEAVY,
  )

  it(
    'shows at least 60 different problems, drawn from the seed (not a list cycled by seed)',
    () => {
      const keys = SEEDS.map((seed) => {
        const { a } = problem(moduleId, templateId, seed)
        return `${a.given}|${a.problem}`
      })
      expect(new Set(keys).size).toBeGreaterThanOrEqual(60)
      for (let period = 1; period <= 100; period++) expect(keys.slice(period).every((k, i) => k === keys[i]), `period ${period}`).toBe(false)
    },
    HEAVY,
  )

  it(
    'grades every spelling a textbook accepts as right, and keeps the answer out of the messages for other answers',
    () => {
      for (const seed of SEEDS.slice(0, 150)) {
        const { a } = problem(moduleId, templateId, seed)
        const other = problem(moduleId, templateId, seed + 1000).a
        for (const stage of a.stages) {
          const where = `${templateId}/${seed} ${stage.id}`
          const answer = stage.answerText
          const variants =
            stage.kind === 'name'
              ? [answer.toUpperCase(), `  ${answer.replace(/ /g, '   ')} `, answer.replace(/sulf/g, 'sulph').replace(/aluminum/g, 'aluminium'), answer.replace('(', ' (')]
              : stage.kind === 'formula'
                ? [answer.replace('·', '*'), answer.replace('·', '.'), answer.replace(/\)/g, ') '), formulaDisplay(answer)]
                : stage.kind === 'ion'
                  ? [answer.replace('^', ' '), answer.replace('^', ''), formulaDisplay(answer)]
                  : [answer.toUpperCase()]
          for (const v of variants) expect(verdictOf(gradeNmStage(a, stage.id, v)), `${where} ${JSON.stringify(v)}`).toBe('correct')
          // Messages for answers that are not slips: unreadable, another problem's answer, the wrong case.
          const keys = stageKeys(stage)
          const others = ['???', other.stages[other.stages.length - 1]!.answerText, ...(stage.kind === 'formula' || stage.kind === 'ion' ? [answer.toLowerCase()] : [])]
          for (const typed of others) {
            const g = gradeNmStage(a, stage.id, typed)
            const shown = nmShown(stage, g, typed)
            // Another seed can draw the same problem: a right answer's message may say the answer.
            if (shown.kind === 'correct') continue
            const texts = shown.kind === 'mistake' ? [shown.title, shown.lesson, shown.witness, shown.example] : [shown.message]
            for (const text of texts) expect(leaksTo(text, keys, typed), `${where} ${typed}: ${text}`).toBe(false)
            // The note under the box as she types (the reader's own message) goes through the same filter.
            const read = stage.kind === 'formula' ? readChemicalFormula(typed) : stage.kind === 'ion' ? readIonFormula(typed) : null
            if (read && !read.ok) expect(leaksTo(safeNote(stage, read.error.message, read.error.reason, typed), keys, typed), `${where} ${typed}: live note`).toBe(false)
          }
        }
      }
    },
    HEAVY,
  )
})

describe('what the templates print', () => {
  it(
    'nm.ionicName: at least a third need a Roman numeral, and at least a third contain a polyatomic ion',
    () => {
      let numeral = 0
      let poly = 0
      for (const seed of SEEDS) {
        const c = compoundOfFormula(problem('ionicNames', 'nm.ionicName', seed).a.problem)
        if (!c || c.kind !== 'ionic') throw new Error('not ionic')
        if (c.cation.numeral !== null && !c.cation.numeralOptional) numeral++
        if (c.cation.kind === 'polyatomic' || c.anion.kind === 'polyatomic') poly++
      }
      expect(numeral).toBeGreaterThanOrEqual(100)
      expect(poly).toBeGreaterThanOrEqual(100)
    },
    HEAVY,
  )

  it(
    'never prints a hydrogen compound without (aq), and prints every binary acid with it',
    () => {
      const bare = /^(?:HF|HCl|HBr|HI|H2S|HCN)$/
      for (const { moduleId, templateId } of NM_TEMPLATES)
        for (const seed of SEEDS) {
          const { a } = problem(moduleId, templateId, seed)
          expect(bare.test(a.problem), `${templateId}/${seed}`).toBe(false)
          for (const s of a.stages) if (s.check.kind === 'name' || s.check.kind === 'classify') expect(bare.test(s.check.formula)).toBe(false)
        }
    },
    HEAVY,
  )

  it(
    'every nm_ id is the promised trap on some seed',
    () => {
      const seen = new Set<string>()
      for (const { moduleId, templateId } of NM_TEMPLATES)
        for (const seed of SEEDS) {
          const t = problem(moduleId, templateId, seed).a.trap
          if (t) seen.add(t)
        }
      expect([...seen].sort()).toEqual([...NM_MISTAKE_IDS].sort())
    },
    HEAVY,
  )
})

// --- hand-worked examples ------------------------------------------------------------------------------

function hand(question: NomenclatureAnswer['question'], drawn: NmDrawn): NomenclatureAnswer {
  return nmAnswer(question, drawn, makeRng(1))
}

const verdict = (a: NomenclatureAnswer, text: string, stage = a.stages[a.stages.length - 1]!.id) => verdictOf(gradeNmStage(a, stage, text))
const salt = (cation: string, anion: string) => {
  const c = compoundOfFormula(ionicFormula(cation, anion))
  if (!c || c.kind !== 'ionic') throw new Error('not ionic')
  return c
}

describe('hand-worked examples (CK-12 chapter 7)', () => {
  it('names single ions, and writes them with their charge', () => {
    const iron = hand('ion', ionProblem(nmIon('Fe^3+'), 'name'))
    expect(iron.stages[0]!.answerText).toBe('iron(III)')
    expect(verdict(iron, 'iron(III)')).toBe('correct')
    expect(verdict(iron, 'Iron (iii)')).toBe('correct')
    expect(verdict(iron, 'iron')).toBe('nm_numeral_missing')
    expect(verdict(iron, 'iron(II)')).toBe('nm_numeral_wrong')
    expect(verdict(iron, 'iron(3)')).toBe('invalid')

    const sulfate = hand('ion', ionProblem(nmIon('SO4^2-'), 'name'))
    expect(sulfate.stages[0]!.answerText).toBe('sulfate')
    for (const t of ['sulfate', 'Sulfate', 'sulphate', 'sulfate ion']) expect(verdict(sulfate, t), t).toBe('correct')
    expect(verdict(sulfate, 'sulfite')).toBe('nm_ate_ite_swapped')
    expect(verdict(sulfate, 'sulfide')).toBe('nm_ide_for_polyatomic')

    expect(hand('ion', ionProblem(nmIon('NH4^+'), 'name')).stages[0]!.answerText).toBe('ammonium')
    const chloride = hand('ion', ionProblem(nmIon('Cl^-'), 'name'))
    expect(chloride.stages[0]!.answerText).toBe('chloride')
    expect(verdict(chloride, 'chlorine')).toBe('nm_element_name_for_anion')

    const nickel = hand('ion', ionProblem(nmIon('Ni^2+'), 'name'))
    expect(verdict(nickel, 'nickel(II)')).toBe('correct')
    expect(verdict(nickel, 'nickel')).toBe('correct')

    const sulfateFormula = hand('ion', ionProblem(nmIon('sulfate'), 'formula'))
    expect(sulfateFormula.stages[0]!.answerText).toBe('SO4^2-')
    for (const t of ['SO4^2-', 'SO4 2-', 'SO42-', 'SO4-2', 'SO₄²⁻', 'SO4^(2-)']) expect(verdict(sulfateFormula, t), t).toBe('correct')
    expect(verdict(sulfateFormula, 'SO4-')).toBe('nm_ion_charge_wrong')
    expect(verdict(sulfateFormula, 'SO3^2-')).toBe('nm_polyatomic_formula_wrong')
    expect(verdict(sulfateFormula, 'so4 2-')).toBe('invalid')
    expect(verdict(sulfateFormula, 'SO4')).toBe('invalid')

    const iron3 = hand('ion', ionProblem(nmIon('iron(III)'), 'formula'))
    expect(iron3.stages[0]!.answerText).toBe('Fe^3+')
    expect(verdict(iron3, 'Fe3+')).toBe('correct')
    expect(verdict(iron3, 'Fe2+')).toBe('nm_ion_charge_wrong')
  })

  it('writes the formula of two ions, given by formula or by name', () => {
    const byFormula = hand('ionicFormula', ionicFormulaProblem(salt('Fe^3+', 'SO4^2-'), false))
    expect(byFormula.prompt).toBe('Write the formula of the ionic compound formed by Fe³⁺ and SO₄²⁻.')
    expect(byFormula.stages[0]!.answerText).toBe('Fe2(SO4)3')
    expect(verdict(byFormula, 'Fe2(SO4)3')).toBe('correct')
    expect(verdict(byFormula, 'Fe₂(SO₄)₃')).toBe('correct')
    expect(verdict(byFormula, 'Fe2SO43')).toBe('nm_parentheses_missing')
    expect(verdict(byFormula, 'Fe3(SO4)2')).toBe('nm_crisscross_reversed')

    const byName = hand('ionicFormula', ionicFormulaProblem(salt('Ca^2+', 'PO4^3-'), true))
    expect(byName.stages.map((s) => s.label)).toEqual(['Cation', 'Anion', 'Formula'])
    expect(byName.stages.map((s) => s.answerText)).toEqual(['Ca^2+', 'PO4^3-', 'Ca3(PO4)2'])
    expect(verdict(byName, 'Ca2+', 'a')).toBe('correct')
    expect(verdict(byName, 'PO4^2-', 'b')).toBe('nm_ion_charge_wrong')
    expect(verdict(byName, 'Ca3(PO4)2', 'c')).toBe('correct')
    expect(verdict(byName, 'Ca6(PO4)4', 'c')).toBe('nm_not_lowest_ratio')
  })

  it('names ionic compounds: numerals from charge balance, polyatomic ions, ammonium, spellings', () => {
    const rust = hand('ionicName', ionicNameProblem(salt('Fe^3+', 'O^2-'), 'numeral'))
    expect(rust.stages[0]!.answerText).toBe('iron(III) oxide')
    expect(verdict(rust, 'iron(II) oxide')).toBe('nm_numeral_wrong')
    expect(verdict(rust, 'iron oxide')).toBe('nm_numeral_missing')
    expect(verdict(rust, 'diiron trioxide')).toBe('nm_prefix_on_ionic')

    expect(hand('ionicName', ionicNameProblem(salt('Cu^2+', 'SO4^2-'), 'numeral')).stages[0]!.answerText).toBe('copper(II) sulfate')
    expect(hand('ionicName', ionicNameProblem(salt('Pb^4+', 'O^2-'), 'numeral')).stages[0]!.answerText).toBe('lead(IV) oxide')

    const nickel = hand('ionicName', ionicNameProblem(salt('Ni^2+', 'Cl^-'), 'nickel'))
    expect(nickel.stages[0]!.answerText).toBe('nickel(II) chloride')
    expect(verdict(nickel, 'nickel chloride')).toBe('correct')

    expect(hand('ionicName', ionicNameProblem(salt('NH4^+', 'SO4^2-'), 'ammonium')).stages[0]!.answerText).toBe('ammonium sulfate')

    const baking = hand('ionicName', ionicNameProblem(salt('Na^+', 'HCO3^-'), 'fixed'))
    expect(baking.stages[0]!.answerText).toBe('sodium hydrogen carbonate')
    expect(verdict(baking, 'sodium bicarbonate')).toBe('correct')
    expect(verdict(baking, 'sodium carbonate')).toBe('nm_hydrogen_prefix_wrong')

    const alum = hand('ionicName', ionicNameProblem(salt('Al^3+', 'SO4^2-'), 'fixed'))
    expect(alum.stages[0]!.answerText).toBe('aluminum sulfate')
    for (const t of ['aluminium sulphate', 'Aluminum Sulfate', '  aluminum   sulfate ']) expect(verdict(alum, t), t).toBe('correct')
    expect(verdict(alum, 'aluminum(III) sulfate')).toBe('nm_numeral_on_fixed')
    expect(verdict(alum, 'Al2(SO4)3')).toBe('invalid')

    const mercury = hand('ionicName', ionicNameProblem(salt('Hg2^2+', 'Br^-'), 'numeral'))
    expect(mercury.stages[0]!.answerText).toBe('mercury(I) bromide')
    expect(verdict(mercury, 'mercury(II) bromide')).toBe('nm_numeral_wrong')
  })

  it('writes ionic formulas from names, and a capital-letter slip is not an attempt', () => {
    const lead = hand('ionicFromName', ionicFromNameProblem(salt('Pb^4+', 'O^2-'), 'numeral'))
    expect(lead.prompt).toBe('Write the formula of lead(IV) oxide.')
    expect(lead.stages[0]!.answerText).toBe('PbO2')
    expect(verdict(lead, 'Pb2O4')).toBe('nm_not_lowest_ratio')
    expect(verdict(lead, 'Pb4O')).toBe('nm_numeral_as_subscript')

    const cobalt = hand('ionicFromName', ionicFromNameProblem(salt('Co^2+', 'Cl^-'), 'numeral'))
    expect(cobalt.stages[0]!.answerText).toBe('CoCl2')
    const caseSlip = gradeNmStage(cobalt, 'a', 'COCl2')
    expect(caseSlip.verdict).toBe('invalid')
    if (caseSlip.verdict === 'invalid') {
      expect(caseSlip.reason).toBe('case')
      expect(caseSlip.position).toBe(1)
    }

    const ammonium = hand('ionicFromName', ionicFromNameProblem(salt('NH4^+', 'PO4^3-'), 'ammonium'))
    expect(ammonium.stages[0]!.answerText).toBe('(NH4)3PO4')
    expect(verdict(ammonium, 'NH43PO4')).toBe('nm_parentheses_missing')

    const acetate = hand('ionicFromName', ionicFromNameProblem(salt('Ca^2+', 'CH3COO^-'), 'fixed'))
    for (const t of ['Ca(CH3COO)2', 'Ca(C2H3O2)2', 'Ca(CH3CO2)2']) expect(verdict(acetate, t), t).toBe('correct')
  })

  it('names and writes binary molecular compounds', () => {
    const n2o5 = hand('molecular', molecularProblem('N2O5', 'name'))
    expect(n2o5.stages[0]!.answerText).toBe('dinitrogen pentoxide')
    expect(verdict(n2o5, 'dinitrogen pentaoxide')).toBe('correct')
    expect(verdict(n2o5, 'nitrogen oxide')).toBe('nm_prefix_missing')
    expect(verdict(n2o5, 'nitrogen(V) oxide')).toBe('nm_stock_on_molecular')

    const co = hand('molecular', molecularProblem('CO', 'name'))
    expect(co.stages[0]!.answerText).toBe('carbon monoxide')
    expect(verdict(co, 'carbon monooxide')).toBe('correct')
    expect(verdict(co, 'monocarbon monoxide')).toBe('nm_mono_on_first')

    const n2o4 = hand('molecular', molecularProblem('N2O4', 'formula'))
    expect(n2o4.prompt).toBe('Write the formula of dinitrogen tetroxide.')
    expect(n2o4.stages[0]!.answerText).toBe('N2O4')
    expect(verdict(n2o4, 'NO2')).toBe('nm_molecular_reduced')
  })

  it('names acids and writes their formulas, with or without (aq) where the engine allows it', () => {
    const acidOf = (anion: string) => poolAcids().find((w) => w.item.anion.name === anion)!.item
    const hcl = hand('acid', acidProblem(acidOf('chloride'), 'name'))
    expect(hcl.problem).toBe('HCl(aq)')
    expect(hcl.stages[0]!.answerText).toBe('hydrochloric acid')
    expect(verdict(hcl, 'chloric acid')).toBe('nm_hydro_missing')
    expect(verdict(hcl, 'hydrogen chloride')).toBe('nm_acid_named_as_salt')
    expect(verdict(hcl, 'hydrochloric')).toBe('invalid')

    const hclFormula = hand('acid', acidProblem(acidOf('chloride'), 'formula'))
    expect(hclFormula.stages[0]!.answerText).toBe('HCl(aq)')
    expect(verdict(hclFormula, 'HCl')).toBe('correct')
    expect(verdict(hclFormula, 'HCl(aq)')).toBe('correct')
    expect(verdict(hclFormula, 'HClO3')).toBe('nm_hydro_on_oxyacid')

    const sulfuric = hand('acid', acidProblem(acidOf('sulfate'), 'name'))
    expect(sulfuric.stages[0]!.answerText).toBe('sulfuric acid')
    expect(verdict(sulfuric, 'sulphuric acid')).toBe('correct')
    expect(verdict(sulfuric, 'sulfurous acid')).toBe('nm_ic_ous_swapped')
    expect(verdict(sulfuric, 'hydrosulfuric acid')).toBe('nm_hydro_on_oxyacid')
    expect(verdict(sulfuric, 'sulfic acid')).toBe('nm_acid_root')

    const nitrous = hand('acid', acidProblem(acidOf('nitrite'), 'anion'))
    expect(nitrous.prompt).toBe('An acid is made of hydrogen ions and the nitrite ion, NO₂⁻. Name the acid.')
    expect(nitrous.stages[0]!.answerText).toBe('nitrous acid')
    expect(verdict(nitrous, 'nitric acid')).toBe('nm_ic_ous_swapped')

    const acetic = hand('acid', acidProblem(acidOf('acetate'), 'formula'))
    for (const t of ['HC2H3O2', 'CH3COOH', 'HCH3COO']) expect(verdict(acetic, t), t).toBe('correct')
  })

  it('names hydrates and writes them with any of the dots', () => {
    const blue = hand('hydrate', hydrateProblem('CuSO4·5H2O', 'name'))
    expect(blue.stages[0]!.answerText).toBe('copper(II) sulfate pentahydrate')
    for (const t of ['copper(II) sulfate penta-hydrate', 'Copper (II) Sulphate Pentahydrate']) expect(verdict(blue, t), t).toBe('correct')
    expect(verdict(blue, 'copper(II) sulfate tetrahydrate')).toBe('nm_hydrate_count_wrong')
    expect(verdict(blue, 'copper(II) sulfate')).toBe('nm_hydrate_count_wrong')
    expect(verdict(blue, 'copper(II) sulfate 5 hydrate')).toBe('invalid')

    const write = hand('hydrate', hydrateProblem('CuSO4·5H2O', 'formula'))
    expect(write.prompt).toBe('Write the formula of copper(II) sulfate pentahydrate.')
    for (const t of ['CuSO4·5H2O', 'CuSO4*5H2O', 'CuSO4.5H2O', 'CuSO4 · 5 H2O', 'CuSO₄·5H₂O']) expect(verdict(write, t), t).toBe('correct')
    expect(verdict(write, 'CuSO4')).toBe('nm_hydrate_count_wrong')
    expect(verdict(write, 'CuSO4·4H2O')).toBe('nm_hydrate_count_wrong')

    const epsom = hand('hydrate', hydrateProblem('MgSO4·7H2O', 'name'))
    expect(epsom.stages[0]!.answerText).toBe('magnesium sulfate heptahydrate')
  })

  it('classifies, with the traps the engine names and no choice that is also right', () => {
    const cases: [string, string, string][] = [
      ['NH4Cl', 'ionic', 'nm_class_ammonium_molecular'],
      ['CuSO4·5H2O', 'hydrate', 'nm_class_hydrate_ignored'],
      ['HCl(aq)', 'acid', 'nm_class_acid_ignored'],
      ['H2SO4', 'acid', 'nm_class_acid_ignored'],
    ]
    for (const [formula, right, trap] of cases) {
      const a = hand('classify', classifyProblem({ formula, group: 'ionic' }))
      const stage = a.stages[0]!
      expect(stage.answerText, formula).toBe(right)
      expect(stage.choices?.map((c) => c.id)).toEqual(['ionic', 'molecular', 'acid', 'hydrate'])
      expect(stage.traps.some((t) => t.id === trap), formula).toBe(true)
      const correct = (stage.choices ?? []).filter((c) => verdictOf(gradeNmStage(a, 'a', c.id)) === 'correct').map((c) => c.id)
      expect(correct, formula).toEqual([right])
    }
    const co2 = hand('classify', classifyProblem({ formula: 'CO2', group: 'molecular' }))
    expect(co2.stages[0]!.answerText).toBe('molecular')
    expect(verdict(co2, 'ionic')).toBe('wrong')
  })

  it('a part built by hand is the engine’s own answer (stageOf)', () => {
    const stage = stageOf('a', { kind: 'name', part: 'ionic-name', label: 'Name', hint: '', nudge: '', ruleCard: 'nm.ionicNaming', check: { kind: 'name', formula: 'Ba3(PO4)2' } })
    expect(stage.answerText).toBe('barium phosphate')
    expect(stage.traps.length).toBeGreaterThan(0)
  })
})
