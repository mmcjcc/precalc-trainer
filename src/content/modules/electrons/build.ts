/**
 * Shared instance builder for the light-calculation templates.
 *
 * A draft is kept only when the sig-fig engine accepts the task (no tie, no other complaint) and
 * every applicable lt_ mistake produces a different number from the right answer and from the
 * others. Otherwise the template draws again from the same rng stream.
 */
import { makeRng } from '@/content/rng'
import type { Rng } from '@/content/rng'
import type {
  DifficultyKnobs,
  ElectronsLightQuestion,
  KnobDef,
  LightConstantInfo,
  LightFormula,
  ProblemInstance,
  RuleCardId,
  SigFigQuantity,
  TemplateDef,
} from '@/content/types'
import { evaluateSigFigTask, prettySigFig, validateSigFigTask } from '@/engine'
import type { CalcPanels, SigFigEvaluation } from '@/shared/types'
import { lightMistakesDistinct } from './grade'
import { ltRule, type LtRuleKey } from './rules'
import { C_TEXT, energyFromFrequencyTask, energyFromWavelengthTask, frequencyTask, H_TEXT, wavelengthTask } from './tasks'

export const EL_MODULE_ID = 'electrons' as const

const MAX_DRAWS = 400
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

export interface LightDraft {
  formula: LightFormula
  wavelengthText?: string
  wavelengthInNm: boolean
  frequencyText?: string
  answerInNm: boolean
  givenUnit: string
  givenLabel: string
  /** Unit printed beside the answer box. */
  unit: string
  context: string
  prompt: string
  trap: string
  nudge?: string
  ruleCards: LtRuleKey[]
  accept?: (evaluation: SigFigEvaluation) => boolean
}

export interface LightScenario {
  id: string
  weight: number
  draw: (rng: Rng) => LightDraft
}

export interface LightTemplateSpec {
  id: string
  title: string
  description: string
  version: number
  knobs: KnobDef[]
  instructions: string
  nudge: string
  scenarios: () => LightScenario[]
  fallback: LightDraft
}

export function lightConstants(showNm: boolean): LightConstantInfo[] {
  const list: LightConstantInfo[] = [
    { symbol: 'c', display: prettySigFig(C_TEXT), unit: 'm/s', exact: false, figures: '3 significant figures' },
    { symbol: 'h', display: prettySigFig(H_TEXT), unit: 'J·s', exact: false, figures: '4 significant figures' },
  ]
  if (showNm) list.push({ symbol: '1 nm', display: '10⁻⁹', unit: 'm', exact: true, figures: 'exact' })
  return list
}

export function taskFor(draft: LightDraft) {
  switch (draft.formula) {
    case 'freq':
      return frequencyTask(draft.wavelengthText ?? '', draft.wavelengthInNm)
    case 'wavelength':
      return wavelengthTask(draft.frequencyText ?? '', draft.answerInNm)
    case 'energy-freq':
      return energyFromFrequencyTask(draft.frequencyText ?? '')
    case 'energy-wave':
      return energyFromWavelengthTask(draft.wavelengthText ?? '', draft.wavelengthInNm)
  }
}

function givenText(draft: LightDraft): string {
  return draft.formula === 'wavelength' || draft.formula === 'energy-freq' ? (draft.frequencyText ?? '') : (draft.wavelengthText ?? '')
}

export function toQuestion(draft: LightDraft, ev: SigFigEvaluation): ElectronsLightQuestion {
  const text = givenText(draft)
  const given: SigFigQuantity = {
    text,
    display: prettySigFig(text),
    unit: draft.givenUnit,
    label: draft.givenLabel,
    exact: false,
  }
  return {
    kind: 'light',
    formula: draft.formula,
    task: taskFor(draft),
    given,
    constants: lightConstants(draft.wavelengthInNm || draft.answerInNm),
    ...(draft.wavelengthText !== undefined ? { wavelengthText: draft.wavelengthText } : {}),
    wavelengthInNm: draft.wavelengthInNm,
    ...(draft.frequencyText !== undefined ? { frequencyText: draft.frequencyText } : {}),
    answerInNm: draft.answerInNm,
    unit: draft.unit,
    expected: ev.expected.text,
    expectedDisplay: ev.expected.display,
    alternates: ev.expected.alternates,
  }
}

function lead(draft: LightDraft): string[] {
  const wl = draft.wavelengthText ? prettySigFig(draft.wavelengthText) : ''
  const freq = draft.frequencyText ? prettySigFig(draft.frequencyText) : ''
  switch (draft.formula) {
    case 'freq':
      return [
        'c = λν, so the frequency is ν = c ÷ λ.',
        draft.wavelengthInNm
          ? `${wl} nm has to become meters first: multiply by 10⁻⁹ (exact), then divide c by that length. Round once, at the end.`
          : `${wl} m is already in meters, so divide c by it and round once, at the end.`,
      ]
    case 'wavelength':
      return [
        'c = λν, so the wavelength is λ = c ÷ ν.',
        draft.answerInNm
          ? `Dividing c by ${freq} Hz gives meters. The question asks for nanometers, so divide by 10⁻⁹ (exact) in the same calculation and round once.`
          : `Leave the quotient in meters. The frequency is ${freq} Hz. Round once, at the end.`,
      ]
    case 'energy-freq':
      return [
        'The energy of one photon is E = hν, a product.',
        `Multiply h by ${freq} Hz and round to the fewer significant figures. Do not divide.`,
      ]
    case 'energy-wave':
      return [
        'E = hν and ν = c ÷ λ, so E = hc ÷ λ in one calculation. Do not round in the middle.',
        draft.wavelengthInNm
          ? `${wl} nm becomes meters by multiplying by 10⁻⁹ (exact) as part of that calculation.`
          : `${wl} m is already in meters, so divide hc by it and round once, at the end.`,
      ]
  }
}

/** Usable = the engine has no complaint, the draft's own promise holds, and every lt_ mistake is distinct. */
export function acceptDraft(draft: LightDraft): SigFigEvaluation | null {
  const task = taskFor(draft)
  if (validateSigFigTask(task).length > 0) return null
  let evaluation: SigFigEvaluation
  try {
    evaluation = evaluateSigFigTask(task)
  } catch {
    return null
  }
  if (evaluation.tie) return null
  if (draft.accept && !draft.accept(evaluation)) return null
  if (!lightMistakesDistinct(toQuestion(draft, evaluation))) return null
  return evaluation
}

export function makeLightTemplate(spec: LightTemplateSpec): TemplateDef {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    version: spec.version,
    knobs: spec.knobs,
    generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
      const rng = makeRng(seed)
      const options = spec.scenarios()
      const total = options.reduce((sum, s) => sum + s.weight, 0)
      let roll = rng.next() * total
      let scenario = options[options.length - 1]!
      for (const s of options) {
        roll -= s.weight
        if (roll < 0) {
          scenario = s
          break
        }
      }
      let draft: LightDraft | null = null
      let evaluation: SigFigEvaluation | null = null
      let draws = 0
      while (draws < MAX_DRAWS && evaluation === null) {
        draws++
        draft = scenario.draw(rng)
        evaluation = acceptDraft(draft)
      }
      let fallback = false
      if (draft === null || evaluation === null) {
        fallback = true
        draft = spec.fallback
        evaluation = acceptDraft(draft)
        if (!evaluation) throw new Error(`electrons: fallback for ${spec.id} is not a usable task`)
      }
      const question = toQuestion(draft, evaluation)
      const ruleCards: RuleCardId[] = draft.ruleCards.map((key) => ltRule(key))
      return {
        id: `${EL_MODULE_ID}/${spec.id}@${spec.version}/${(seed >>> 0).toString(36)}`,
        moduleId: EL_MODULE_ID,
        templateId: spec.id,
        skill: spec.id,
        genVersion: spec.version,
        seed,
        knobs,
        kind: 'electrons',
        title: spec.title,
        instructions: spec.instructions,
        statementText: draft.prompt,
        vars: [],
        start: null,
        canonical: [],
        answer: {
          type: 'electrons',
          question,
          prompt: draft.prompt,
          context: draft.context,
          expectedDisplay: question.expectedDisplay,
          nudge: draft.nudge ?? spec.nudge,
          ruleCard: ruleCards[0]!,
          ruleCards,
          reveal: [...lead(draft), ...evaluation.steps],
          trap: draft.trap,
        },
        graph: { kind: 'none' },
        calc: NO_CALC,
        params: {
          scenario: scenario.id,
          trap: draft.trap,
          draws,
          fallback,
          formula: draft.formula,
          expected: question.expected,
        },
      }
    },
  }
}
