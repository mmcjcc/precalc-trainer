/**
 * The template builder both chapter 10 modules share: drafts become parts (answers, accepted
 * spellings and traps all re-derived from each part's check), a seed is redrawn from the SAME rng
 * stream while it would show an answer, sit on a rounding boundary or disagree with the unrounded
 * masses, and every shipped seed passes assertMoleAnswer.
 */
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, MoCheck, MoleAnswer, MoStage, MoStageId, ProblemInstance, TemplateDef } from '@/content/types'
import type { ModuleId, SigFigTask } from '@/shared/types'
import { validateSigFigTask } from '@/engine'
import { analyseSigFigTask } from '@/engine/sigfigs/evaluate'
import { decToPlain, ratToDec, roundRatToSigFigs } from '@/engine/sigfigs/decimal'
import { alternatesFor, assertMoleAnswer, canonicalMoAnswer, equalsExampleNumber, leakReport, modelFor, trapsForMo, type MoTrap } from './grade'
import { countsOf, fullMolarMass, molarMassText, substanceOf } from './facts'
import { gradeModel } from './numeric'

const NO_CALC = { ti84: [], nspire: [] }
const STAGE_IDS: readonly MoStageId[] = ['a', 'b', 'c', 'd', 'e']

export interface BuiltStage {
  kind: MoStage['kind']
  label: string
  hint: string
  nudge: string
  ruleCard: string
  check: MoCheck
  unit?: string
  symbols?: string[]
  choices?: { id: string; text: string }[]
  reveal: (answerText: string) => string
}

export interface Drawn {
  prompt: string
  drafts: BuiltStage[]
  params: Record<string, number | string | boolean>
  /** Related cards shown under the part's own card. */
  extraCards?: string[]
}

function attach(stage: BuiltStage, index: number): MoStage {
  const answerText = canonicalMoAnswer(stage.check)
  const accept = alternatesFor(stage.check)
  const traps = trapsForMo(stage.check)
  const choices = stage.choices?.map((choice) => {
    const trap = traps.find((item) => item.text === choice.id)
    return trap ? { id: choice.id, text: choice.text, trap: trap.id, witness: trap.witness } : { id: choice.id, text: choice.text }
  })
  return {
    id: STAGE_IDS[index] ?? 'a',
    kind: stage.kind,
    label: stage.label,
    hint: stage.hint,
    answerText,
    ...(accept.length > 0 ? { accept } : {}),
    ...(choices ? { choices } : {}),
    ...(stage.unit ? { unit: stage.unit } : {}),
    ...(stage.symbols ? { symbols: stage.symbols } : {}),
    nudge: stage.nudge,
    ruleCard: stage.ruleCard,
    reveal: [stage.reveal(answerText)],
    traps,
    check: stage.check,
  }
}

function buildAnswer(question: MoleAnswer['question'], drawn: Drawn, rng: Rng): MoleAnswer {
  const stages = drawn.drafts.map((draft, index) => attach(draft, index))
  const ruleCards = [...new Set([...stages.map((stage) => stage.ruleCard), ...(drawn.extraCards ?? [])])]
  const all = stages.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap: trap as MoTrap })))
  const promised = all.length > 0 ? rng.pick(all) : null
  return {
    type: 'mole',
    question,
    prompt: drawn.prompt,
    stages,
    expectedDisplay: stages.map((stage) => `${stage.label}: ${displayOf(stage)}`).join('; '),
    reveal: stages.map((stage) => stage.reveal[0]!),
    ruleCards,
    ...(promised ? { trap: promised.trap.id, trapStage: promised.stage.id, trapAnswer: promised.trap.text } : {}),
  }
}

/** The answer as she would read it: '1.51 × 10²⁴ molecules', 'CH₂O', 'Formula units'. */
export function displayOf(stage: MoStage): string {
  return displayAnswer(stage, stage.answerText)
}

export function displayAnswer(stage: MoStage, text: string): string {
  if (stage.kind === 'choice') return stage.choices?.find((c) => c.id === text)?.text ?? text
  if (stage.kind === 'counts') {
    return text
      .split(';')
      .map((p) => p.split('='))
      .map(([symbol, n]) => `${symbol}${n === '1' ? '' : (n ?? '').replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!)}`)
      .join('')
  }
  if (stage.kind === 'number') return `${prettyNumber(text)}${stage.unit ? (stage.unit === '%' ? '%' : ` ${stage.unit}`) : ''}`
  return text
}

/** '1.51 x 10^24' → '1.51 × 10²⁴'. */
export function prettyNumber(text: string): string {
  return text.replace(/\s*x\s*10\^(-?\d+)/, (_m, p: string) => ` × 10${[...p].map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]!)).join('')}`)
}

/**
 * Why a built problem must be redrawn ('' when it may ship): an engine issue, an answer on a
 * rounding boundary, a surface that shows an answer, an answer equal to an example number, or a
 * mass answer that the unrounded atomic weights would round differently.
 */
function problemsOf(answer: MoleAnswer): string {
  for (const stage of answer.stages) {
    const model = modelFor(stage.check)
    if (model.mode === 'numeric') {
      if (validateSigFigTask(model.task).length > 0) return `${stage.id}: engine issue`
      if (analyseSigFigTask(model.task).rounded.firstDropped === 5) return `${stage.id}: boundary`
      if (!stableUnderFullMasses(stage.check, model.task)) return `${stage.id}: unrounded masses round differently`
    }
    if (gradeModel(model, stage, stage.answerText).verdict !== 'correct') return `${stage.id}: answer does not grade`
    const leak = leakReport(answer, stage)
    if (leak) return `${stage.id}: ${leak} leaks`
    if (equalsExampleNumber(stage)) return `${stage.id}: example number`
  }
  return ''
}

/** A conversion through a molar mass gives the same rounded answer with the printed (unrounded) weights. */
function stableUnderFullMasses(check: MoCheck, task: SigFigTask): boolean {
  if (check.kind !== 'convert' || task.kind !== 'muldiv') return true
  const s = substanceOf(check.formula)
  const rounded = molarMassText(s)
  const full = decToPlain(ratToDec(fullMolarMass(countsOf(s))))
  if (!task.terms.slice(1).some((term) => term.text === rounded)) return true
  const alt: SigFigTask = { ...task, terms: task.terms.map((term, i) => (i > 0 && term.text === rounded ? { text: full, exact: true } : term)) }
  const a = analyseSigFigTask(task)
  const b = analyseSigFigTask(alt)
  const n = a.evaluation.expected.sigFigs
  const ra = roundRatToSigFigs(a.exactValue, n)
  const rb = roundRatToSigFigs(b.exactValue, n)
  return ra.m === rb.m && ra.place === rb.place && rb.firstDropped !== 5
}

const ATTEMPTS = 400

export function makeMoleTemplate(
  moduleId: Extract<ModuleId, 'moles' | 'chemFormulas'>,
  id: string,
  question: MoleAnswer['question'],
  title: string,
  description: string,
  instructions: string,
  salt: number,
  draw: (rng: Rng) => Drawn,
): TemplateDef {
  return {
    id,
    title,
    description,
    version: 1,
    knobs: [],
    generate: (seed: number, knobs: DifficultyKnobs): ProblemInstance => {
      const rng = makeRng(mixSeed(seed, salt))
      let answer: MoleAnswer | null = null
      let drawn: Drawn | null = null
      let why = ''
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        drawn = draw(rng)
        const built = buildAnswer(question, drawn, rng)
        why = problemsOf(built)
        if (!why) {
          answer = built
          break
        }
      }
      if (!answer || !drawn) throw new Error(`${id}@${seed}: no clean draw in ${ATTEMPTS} tries (last: ${why})`)
      assertMoleAnswer(`${id}@${seed}`, answer)
      return {
        id: problemId(moduleId, id, 1, seed),
        moduleId,
        templateId: id,
        skill: id,
        genVersion: 1,
        seed,
        knobs,
        kind: 'mole',
        title,
        instructions,
        statementText: answer.prompt,
        vars: [],
        start: null,
        canonical: [],
        answer,
        graph: { kind: 'none' },
        calc: NO_CALC,
        params: { ...drawn.params, trap: answer.trap ?? '' },
      }
    },
  }
}
