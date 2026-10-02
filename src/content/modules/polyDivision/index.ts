import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { SD_MODULE_ID } from './build'
import { factorTemplate } from './factor'
import { SD_RULES } from './rules'
import { tableTemplate } from './table'
import { valueTemplate } from './value'

export { SD_RULE_FOR, SD_RULE_IDS, SD_RULES, sdRuleIdFor } from './rules'
export { SD_FIRST_KEY, SD_KEYS, cellKey, divisionWork, gradeDivisionStage, gradeDivisionTable, tableEntries } from './grade'
export type { SdCell, SdPart, SdTableEntries } from './grade'
export { SD_MODULE_ID, factorSlip, sdPrompt, sdSelfTest, sdStageOf, sdTrapKinds } from './build'
export type { PolyDivisionAnswer, PolyDivisionQuestion, PolyDivisionStage, PolyDivisionStageId } from './build'

/**
 * Synthetic division (precalculus Unit 2, polynomial half). Three templates: the table itself (coefficient
 * row, then box, products and bottom row cell by cell, then quotient and remainder), the remainder theorem
 * (f(c)), and the factor theorem (is x − c a factor?). All of the mathematics is the engine's
 * (`src/engine/polynomials`). No graph and no calculator panel.
 */
export const polyDivisionModule: ModuleDef = {
  id: SD_MODULE_ID,
  title: 'Synthetic division',
  blurb: 'Set up and fill in the division table, read off the quotient and remainder, then use the remainder to find f(c) and to test for a factor.',
  // After completing the square (5.6); the last Unit 2 module follows at 5.8, before chemistry (6).
  order: 5.7,
  templates: [tableTemplate, valueTemplate, factorTemplate],
  ruleCards: SD_RULES,
  // The flow counts the checked parts itself; nothing anchors on a canonical path here.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(polyDivisionModule)
