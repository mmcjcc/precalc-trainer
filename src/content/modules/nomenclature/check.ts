/**
 * The generator's own check of every problem, run for every seed before it ships. A bad problem throws instead of
 * reaching her. What it checks (the core document's "Self-tests per seed", plus what the screen shows):
 *  - the engine says the problem is in the model (nomenclatureProblem, ionicPairProblem);
 *  - the stored answer is the engine's (its getters), and it and every accepted form (and the display form of a
 *    formula) grade correct;
 *  - every candidate differs from the answer, grades as its own id, and the promised trap is one of them;
 *  - nothing she sees before she finishes contains a part's answer: the prompt, hints, nudges, the rung-2 rule
 *    cards (the part's own, the one each candidate brings up, and the related ones), and for every candidate what
 *    the screen shows for it (title, lesson, sentence about her answer, example line).
 */
import {
  classOfFormula,
  formulaDisplay,
  formulaOfName,
  ionicFormula,
  ionicPairProblem,
  nameOfFormula,
  nmIon,
  nomenclatureProblem,
  type NmMistakeId,
} from '@/engine'
import type { NmCheck, NmStage, NomenclatureAnswer } from '@/content/types'
import { nmShown } from './feedback'
import { gradeCheck } from './grade'
import { leaksTo, stageKeys, type PartKeys } from './leaks'
import { nmRule, nmRuleFor, NM_IDS_BY_PART } from './rules'

function problemOf(check: NmCheck): string | null {
  switch (check.kind) {
    case 'ion_name':
      return nomenclatureProblem(check.ion, 'ion_name')
    case 'ion_formula':
      return nomenclatureProblem(check.ion, 'ion_formula')
    case 'ionic_formula':
      return ionicPairProblem(check.cation, check.anion)
    case 'name':
      return nomenclatureProblem(check.formula, 'name', { inWater: check.inWater === true })
    case 'formula':
      return nomenclatureProblem(check.name, 'formula')
    case 'classify':
      return nomenclatureProblem(check.formula, 'classify', { inWater: check.inWater === true })
  }
}

/** The engine's own answer for a check (its getters). */
export function engineAnswer(check: NmCheck): string {
  switch (check.kind) {
    case 'ion_name':
      return nmIon(check.ion).name
    case 'ion_formula':
      return nmIon(check.ion).text
    case 'ionic_formula':
      return ionicFormula(check.cation, check.anion)
    case 'name':
      return nameOfFormula(check.formula, { inWater: check.inWater === true })
    case 'formula':
      return formulaOfName(check.name)
    case 'classify':
      return classOfFormula(check.formula, { inWater: check.inWater === true })
  }
}

/**
 * The rung-2 cards this part can show: its own card, the related cards, and the card that any slip the graders can
 * name on this kind of part brings up (not only the candidates: a rule-based slip can name another).
 */
export function rungTwoCards(answer: NomenclatureAnswer, stage: NmStage): string[] {
  const ids = new Set<string>([stage.ruleCard, ...answer.ruleCards, ...NM_IDS_BY_PART[stage.part].map((id) => nmRuleFor(id, stage.part, stage.ruleCard))])
  return [...ids]
}

function cardText(id: string): string {
  const card = nmRule(id)
  return `${card.title}\n${card.body}\n${card.example ?? ''}`
}

function noLeak(where: string, what: string, text: string, keys: PartKeys, herText?: string): void {
  if (leaksTo(text, keys, herText)) throw new Error(`${where}: ${what} shows the answer: ${text}`)
}

/** The checks that depend on the part's check alone, done once per check (many seeds draw the same compound). */
const VERIFIED = new Set<string>()

function assertPart(at: string, stage: NmStage, keys: PartKeys): void {
  const memo = `${stage.part}|${stage.label}|${JSON.stringify(stage.check)}`
  if (VERIFIED.has(memo)) return
  const problem = problemOf(stage.check)
  if (problem) throw new Error(`${at}: outside the model: ${problem}`)
  const expected = engineAnswer(stage.check)
  if (stage.answerText !== expected) throw new Error(`${at}: stored ${stage.answerText}, the engine says ${expected}`)
  const rights = [stage.answerText, ...stage.accept]
  if (stage.kind === 'formula' || stage.kind === 'ion') rights.push(formulaDisplay(stage.answerText))
  for (const text of rights) {
    const g = gradeCheck(stage.check, text)
    if (g.verdict !== 'correct') throw new Error(`${at}: the right answer ${text} graded ${g.verdict}${g.verdict === 'mistake' ? ` ${g.mistake}` : ''}`)
  }
  if (stage.kind === 'choice') {
    const ids = (stage.choices ?? []).map((c) => c.id)
    if (!ids.includes(stage.answerText)) throw new Error(`${at}: the answer is not a choice`)
    for (const choice of stage.choices ?? []) {
      const g = gradeCheck(stage.check, choice.id)
      const right = choice.id === stage.answerText
      if ((g.verdict === 'correct') !== right) throw new Error(`${at}: choice ${choice.id} graded ${g.verdict}`)
      if (choice.trap && (g.verdict !== 'mistake' || g.mistake !== choice.trap)) throw new Error(`${at}: choice ${choice.id} promises ${choice.trap}`)
    }
  }
  for (const trap of stage.traps) {
    if (!NM_IDS_BY_PART[stage.part].includes(trap.id as NmMistakeId)) throw new Error(`${at}: ${trap.id} is not listed for a ${stage.part} part`)
    if (rights.includes(trap.text)) throw new Error(`${at}: candidate ${trap.id} is a right answer`)
    const g = gradeCheck(stage.check, trap.text)
    if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new Error(`${at}: candidate ${trap.id} (${trap.text}) graded ${g.verdict}${g.verdict === 'mistake' ? ` ${g.mistake}` : ''}`)
    const shown = nmShown(stage, g, trap.text)
    if (shown.kind !== 'mistake') throw new Error(`${at}: candidate ${trap.id} is not shown as a mistake`)
    for (const [what, text] of [
      ['title', shown.title],
      ['lesson', shown.lesson],
      ['witness', shown.witness],
      ['example', shown.example],
    ] as const)
      noLeak(at, `${trap.id} ${what}`, text, keys, trap.text)
  }
  VERIFIED.add(memo)
}

export function assertNomenclature(where: string, answer: NomenclatureAnswer): void {
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  const allKeys = answer.stages.map((s) => stageKeys(s))
  for (const keys of allKeys) noLeak(where, 'prompt', answer.prompt, keys)
  for (const stage of answer.stages) {
    const at = `${where} ${stage.id}`
    const keys = stageKeys(stage)
    assertPart(at, stage, keys)
    for (const k of allKeys) {
      noLeak(at, 'hint', stage.hint, k)
      noLeak(at, 'nudge', stage.nudge, k)
    }
    for (const id of rungTwoCards(answer, stage)) noLeak(at, `card ${id}`, cardText(id), keys)
  }
  if (answer.trap) {
    const stage = answer.stages.find((s) => s.id === answer.trapStage)
    if (!stage || answer.trapAnswer === undefined) throw new Error(`${where}: the promised trap has no part`)
    if (!stage.traps.some((t) => t.id === answer.trap && t.text === answer.trapAnswer)) throw new Error(`${where}: the promised trap is not one of the engine's candidates`)
    const g = gradeCheck(stage.check, answer.trapAnswer)
    if (g.verdict !== 'mistake' || g.mistake !== answer.trap) throw new Error(`${where}: promised ${answer.trap} graded ${g.verdict}`)
  }
}
