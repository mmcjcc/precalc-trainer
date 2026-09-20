import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { addsubTemplate } from './addsub'
import { SF_MODULE_ID } from './build'
import { countTemplate } from './count'
import { mixedTemplate } from './mixed'
import { muldivTemplate } from './muldiv'
import { roundTemplate } from './round'
import { SF_RULES } from './rules'
import { sciTemplate } from './sci'

export { SF_RULE_IDS, SF_RULES } from './rules'

/**
 * Significant figures (chemistry). Answer-only kind 'sigFigs': everything the flow needs is on
 * `instance.answer` (task, prompt, context, quantities, unit, nudge, rule cards, reveal). Grade
 * with the engine (`gradeSigFigAnswer(answer.task, typed)`), never by comparing text.
 */
export const sigFigsModule: ModuleDef = {
  id: SF_MODULE_ID,
  subject: 'Chemistry',
  title: 'Significant figures',
  blurb: 'Count them, round to them, and carry them through calculations: the rules from chemistry class, with the classic traps built in.',
  order: 6,
  templates: [countTemplate, roundTemplate, muldivTemplate, addsubTemplate, mixedTemplate, sciTemplate],
  ruleCards: SF_RULES,
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(sigFigsModule)
