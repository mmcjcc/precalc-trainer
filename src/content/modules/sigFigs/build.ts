/**
 * Shared instance builder for the significant-figures templates.
 *
 * A template draws a DRAFT (engine task + units + words) from the seeded rng. The draft is kept only
 * when the ENGINE says the task is usable (`validateSigFigTask`: no rounding tie, no zero result, no
 * debatable intermediate, representable conversion) and when it really shows the trap it was drawn
 * for. Otherwise the template draws again from the same rng stream, so a seed stays deterministic.
 */
import type { Rng } from '@/content/rng'
import type {
  DifficultyKnobs,
  KnobDef,
  ProblemInstance,
  RuleCardId,
  SigFigEntry,
  SigFigQuantity,
  TemplateDef,
} from '@/content/types'
import { evaluateSigFigTask, prettySigFig, sigFigPlaceName, sigFigTaskTerms, validateSigFigTask } from '@/engine'
import type { CalcPanels, SigFigEvaluation, SigFigOp, SigFigOperand, SigFigTask, SigFigTerm } from '@/shared/types'
import { makeRng } from '@/content/rng'
import { pickWeighted, type Weighted } from './numbers'

export const SF_MODULE_ID = 'sigFigs' as const

/** One printed number of a draft: the engine term plus its unit and what it is. */
export interface DraftQuantity {
  text: string
  unit: string
  label: string
  exact?: boolean
  note?: string
}

export interface SigFigDraft {
  task: SigFigTask
  /** Reading order, same length and order as `sigFigTaskTerms(task)`. */
  quantities: DraftQuantity[]
  /** Unit printed beside the answer box ('' for none). */
  unit: string
  /** One sentence of chemistry context ('' when the bare numeral is the whole question). */
  context: string
  /** Overrides the prompt built from the task. */
  prompt?: string
  /** Scenario label, e.g. "quotient-significant-zero". */
  trap: string
  /** Hint rung 1 (falls back to the template's nudge). */
  nudge?: string
  /** Rule cards, most relevant first. */
  ruleCards: RuleCardId[]
  /** The trap's promise, checked against the engine's evaluation; a draft that fails is redrawn. */
  accept?: (evaluation: SigFigEvaluation) => boolean
  params?: Record<string, number | string | boolean>
}

export interface Scenario {
  id: string
  weight: number
  draw: (rng: Rng, knobs: DifficultyKnobs) => SigFigDraft
}

export interface SigFigTemplateSpec {
  id: string
  title: string
  description: string
  version: number
  knobs: KnobDef[]
  instructions: string
  entry: SigFigEntry
  /** Default hint rung 1. */
  nudge: string
  /** Scenarios to choose from for these knobs (weights are relative). */
  scenarios: (knobs: DifficultyKnobs) => Scenario[]
  /** Hand-checked draft used only if 400 draws all fail (never seen in the tested seed range). */
  fallback: SigFigDraft
}

export const SCI_KNOB: KnobDef = { key: 'sciNotation', label: 'Always use scientific notation', default: false }
export const EXACT_KNOB: KnobDef = {
  key: 'exactNumbers',
  label: 'Always include an exact number (counted or defined)',
  default: false,
}

const MAX_DRAWS = 400

/** No graph, no calculator panel for this module. */
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const OP_SIGN: Record<SigFigOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

const NEAREST: Record<number, string> = {
  2: 'nearest hundred',
  1: 'nearest ten',
  0: 'nearest whole number',
  [-1]: 'nearest tenth',
  [-2]: 'nearest hundredth',
  [-3]: 'nearest thousandth',
}

function withUnit(display: string, unit: string): string {
  if (unit === '') return display
  return unit === '%' || unit === '°' ? `${display}${unit}` : `${display} ${unit}`
}

/** "12.50 g", "(3.00 × 10⁸ m/s)": scientific numerals are wrapped so the × signs cannot be misread. */
function quantityLabel(q: DraftQuantity, inCalculation: boolean): string {
  const display = prettySigFig(q.text)
  const shown = withUnit(display, q.unit)
  return inCalculation && /x|×|e/i.test(q.text) ? `(${shown})` : shown
}

function chain(labels: string[], ops: SigFigOp[]): string {
  return labels.map((l, i) => (i === 0 ? l : `${OP_SIGN[ops[i - 1]!]} ${l}`)).join(' ')
}

function isGroup(o: SigFigOperand): o is { terms: SigFigTerm[]; ops: SigFigOp[] } {
  return 'terms' in o
}

/** The question in one line, numerals pretty-printed and units attached. */
export function buildPrompt(task: SigFigTask, quantities: DraftQuantity[]): string {
  const first = quantities[0]!
  switch (task.kind) {
    case 'count':
      return `How many significant figures are in ${quantityLabel(first, false)}?`
    case 'round':
      if (task.sigFigs !== undefined) {
        return `Round ${quantityLabel(first, false)} to ${task.sigFigs} significant figure${task.sigFigs === 1 ? '' : 's'}.`
      }
      return `Round ${quantityLabel(first, false)} to the ${NEAREST[task.place as number] ?? `${sigFigPlaceName(task.place as number)} place`} (the ${sigFigPlaceName(task.place as number)} place).`
    case 'convert':
      return task.to === 'scientific'
        ? `Write ${quantityLabel(first, false)} in scientific notation.`
        : `Write ${quantityLabel(first, false)} in standard (ordinary decimal) notation.`
    case 'muldiv':
    case 'addsub':
      return chain(
        quantities.map((q) => quantityLabel(q, true)),
        task.ops,
      )
    case 'mixed': {
      let next = 0
      const labels = task.operands.map((o) => {
        if (!isGroup(o)) return quantityLabel(quantities[next++]!, true)
        const inner = chain(
          o.terms.map(() => quantityLabel(quantities[next++]!, true)),
          o.ops,
        )
        // A product inside a sum binds by itself; a sum inside a product needs its parentheses.
        return o.ops.every((op) => op === '+' || op === '-') ? `(${inner})` : inner
      })
      return chain(labels, task.ops)
    }
  }
}

function toQuantities(draft: SigFigDraft): SigFigQuantity[] {
  const terms = sigFigTaskTerms(draft.task)
  if (terms.length !== draft.quantities.length) {
    throw new Error(`sigFigs draft ${draft.trap}: ${draft.quantities.length} quantities for ${terms.length} terms`)
  }
  return draft.quantities.map((q, i) => {
    const term = terms[i]!
    if (term.text !== q.text) throw new Error(`sigFigs draft ${draft.trap}: quantity ${i} is ${q.text}, term is ${term.text}`)
    const out: SigFigQuantity = {
      text: q.text,
      display: prettySigFig(q.text),
      unit: q.unit,
      label: q.label,
      exact: term.exact === true,
    }
    const note = term.note ?? q.note
    if (note !== undefined) out.note = note
    return out
  })
}

/** Usable = the engine has no complaint AND the trap's own promise holds. Returns the evaluation or null. */
export function acceptDraft(draft: SigFigDraft): SigFigEvaluation | null {
  if (validateSigFigTask(draft.task).length > 0) return null
  const evaluation = evaluateSigFigTask(draft.task)
  if (evaluation.tie) return null
  if (draft.accept && !draft.accept(evaluation)) return null
  return evaluation
}

export function makeSigFigTemplate(spec: SigFigTemplateSpec): TemplateDef {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    version: spec.version,
    knobs: spec.knobs,
    generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
      const rng = makeRng(seed)
      const options: Weighted<Scenario>[] = spec.scenarios(knobs).map((s) => ({ weight: s.weight, value: s }))
      const scenario = pickWeighted(rng, options)
      let draft: SigFigDraft | null = null
      let evaluation: SigFigEvaluation | null = null
      let draws = 0
      while (draws < MAX_DRAWS && evaluation === null) {
        draws++
        draft = scenario.draw(rng, knobs)
        evaluation = acceptDraft(draft)
      }
      let fallback = false
      if (draft === null || evaluation === null) {
        fallback = true
        draft = spec.fallback
        evaluation = evaluateSigFigTask(draft.task)
      }
      const prompt = draft.prompt ?? buildPrompt(draft.task, draft.quantities)
      const ruleCards = draft.ruleCards
      return {
        id: `${SF_MODULE_ID}/${spec.id}@${spec.version}/${(seed >>> 0).toString(36)}`,
        moduleId: SF_MODULE_ID,
        templateId: spec.id,
        skill: spec.id,
        genVersion: spec.version,
        seed,
        knobs,
        kind: 'sigFigs',
        title: spec.title,
        instructions: spec.instructions,
        // Plain words and numerals, NOT app syntax: the sig-fig flow prints answer.prompt itself and
        // must not push this through toLatex.
        statementText: prompt,
        vars: [],
        start: null,
        canonical: [],
        answer: {
          type: 'sigFigs',
          task: draft.task,
          entry: spec.entry,
          prompt,
          context: draft.context,
          quantities: toQuantities(draft),
          unit: draft.unit,
          expected: evaluation.expected.text,
          expectedDisplay: evaluation.expected.display,
          alternates: evaluation.expected.alternates,
          nudge: draft.nudge ?? spec.nudge,
          ruleCard: ruleCards[0]!,
          ruleCards,
          reveal: evaluation.steps,
          trap: draft.trap,
        },
        graph: { kind: 'none' },
        calc: NO_CALC,
        params: {
          ...(draft.params ?? {}),
          scenario: scenario.id,
          trap: draft.trap,
          draws,
          fallback,
          expected: evaluation.expected.text,
        },
      }
    },
  }
}
