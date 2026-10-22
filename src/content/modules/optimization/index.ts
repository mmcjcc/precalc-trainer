import { registerModule } from '@/content/registry'
import type { ModuleDef, OptimizationAnswer } from '@/content/types'
import { OPT_MODULE_ID, template } from './build'
import { drawNumbers } from './numbers'
import { gradeOptPart, optWork, stagesFor, type OptPartGrade } from './parts'
import { drawPens } from './pens'
import { drawRevenue } from './revenue'
import { OPT_RULES } from './rules'
import { drawWall } from './wall'

export { OPT_RULES, OPT_RULE_IDS } from './rules'
export { OPT_MODULE_ID, finishDraft } from './build'
export { OPT_HINTS } from './words'
export { answerForms, optEntries, optLeaks, optWork, partCatalogTexts, partShownTexts, stagesFor, type OptPartGrade } from './parts'
export { numbersDraft } from './numbers'
export { pensDraft } from './pens'
export { revenueDraft } from './revenue'
export { wallDraft } from './wall'

export const wallTemplate = template(
  'opt.wall',
  'A pen against a wall',
  'One rectangular pen against a wall with three sides fenced, or with a dividing fence: the fencing, the area, the final equation, the dimensions and the largest area.',
  71,
  drawWall,
)

export const pensTemplate = template(
  'opt.pens',
  'Pens in a row',
  'Two, three or four identical pens side by side sharing fences, with or without a wall along one side: the largest combined area, or the largest area of each pen.',
  72,
  drawPens,
)

export const numbersTemplate = template(
  'opt.numbers',
  'Two numbers',
  'Two numbers with a given sum (or a sum with a multiple, or a difference) whose product is largest or smallest, or whose sum of squares is smallest.',
  73,
  drawNumbers,
)

export const revenueTemplate = template(
  'opt.revenue',
  'Price and revenue',
  'Each $1 increase in price loses sales, or each $0.50 decrease brings more: the price that gives the largest revenue, the number sold, and that revenue.',
  74,
  drawRevenue,
)

export const OPT_TEMPLATES = [wallTemplate, pensTemplate, numbersTemplate, revenueTemplate] as const

/** Grade her entry for one part. The final equation's letter (her own entry for it) decides parts 4 and 5. */
export function gradeOptStage(answer: OptimizationAnswer, stages: readonly ReturnType<typeof stagesFor>[number][], stageId: string, text: string): OptPartGrade {
  const part = stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeOptPart(answer, part, text)
}

export { gradeOptPart, optWork as optimizationWork }

/**
 * Optimization with quadratics (precalculus Unit 2, right after completing the square), the worksheet's way: the
 * secondary and primary equations, the final equation in one variable, the vertex, the other variable and the
 * largest (or smallest) value, for pens against a wall, pens in a row, two numbers, and price and revenue.
 */
export const optimizationModule: ModuleDef = {
  id: OPT_MODULE_ID,
  title: 'Optimization with quadratics',
  blurb: 'Fences, pens in a row, two numbers and ticket prices: the secondary and primary equations, the final equation, then the vertex gives the largest or smallest value.',
  // Right after completing the square (5.6) and before synthetic division (5.7).
  order: 5.65,
  templates: [...OPT_TEMPLATES],
  ruleCards: OPT_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(optimizationModule)
