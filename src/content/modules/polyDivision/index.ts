import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { SD_MODULE_ID } from './build'
import { factorTemplate } from './factor'
import { longTemplate, worksheetTemplate } from './long'
import { SD_RULES } from './rules'
import { tableTemplate } from './table'
import { valueTemplate } from './value'

export { LD_CARD_EXAMPLE, SD_RULE_FOR, SD_RULE_IDS, SD_RULES, sdRuleIdFor } from './rules'
export { LD_ROUND, SD_FIRST_KEY, SD_KEYS, cellKey, divisionWork, gradeDivisionStage, gradeDivisionTable, tableEntries } from './grade'
export type { SdCell, SdPart, SdTableEntries } from './grade'
export { SD_MODULE_ID, factorSlip, sdPrompt, sdSelfTest, sdStageOf, sdTrapKinds } from './build'
export type { PolyDivisionAnswer, PolyDivisionQuestion, PolyDivisionStage, PolyDivisionStageId } from './build'
export { LD_WORKSHEET, ldProblem } from './long'

/**
 * Dividing polynomials (precalculus Unit 2, polynomial half). Synthetic division, three templates: the
 * table itself (coefficient row, then box, products and bottom row cell by cell, then quotient and
 * remainder), the remainder theorem (f(c)), and the factor theorem (is x − c a factor?). Long division,
 * two templates: a cubic over a quadratic worked round by round (divide the leading terms, multiply,
 * subtract), drawn fresh or from her worksheet. All of the mathematics is the engine's
 * (`src/engine/polynomials`). No graph and no calculator panel.
 */
export const polyDivisionModule: ModuleDef = {
  id: SD_MODULE_ID,
  title: 'Polynomial division',
  blurb:
    'Synthetic division: fill in the table, read off the quotient and remainder, find f(c) and test for a factor. Long division: divide by a quadratic one step at a time, when synthetic division does not apply.',
  // After completing the square (5.6); the last Unit 2 module follows at 5.8, before chemistry (6).
  order: 5.7,
  templates: [tableTemplate, valueTemplate, factorTemplate, longTemplate, worksheetTemplate],
  ruleCards: SD_RULES,
  // The flow counts the checked parts itself; nothing anchors on a canonical path here.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(polyDivisionModule)
