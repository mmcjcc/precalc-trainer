import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { QD_MODULE_ID } from './build'
import { formTemplate } from './form'
import { CS_RULES } from './rules'
import { vertexTemplate } from './vertex'

export { CS_RULE_FOR, CS_RULE_IDS, CS_RULES, csRuleIdFor } from './rules'
export { gradeExtremum, gradeOpens } from './grade'
export { QD_MODULE_ID, quadSelfTest, quadTrapKinds } from './build'
export type { QuadraticsAnswer } from './build'

/**
 * Completing the square (precalculus Unit 2, polynomial half). Two templates: rewriting ax^2 + bx + c in
 * vertex form one checked line at a time, and reading the vertex, axis of symmetry, direction and minimum
 * or maximum value. All of the mathematics is the engine's (`src/engine/polynomials`). The graph of f is
 * kept off `instance.graph` and shown by the flow only after she finishes.
 */
export const quadraticsModule: ModuleDef = {
  id: QD_MODULE_ID,
  title: 'Completing the square',
  blurb: 'Rewrite a quadratic in vertex form one line at a time, then read off its vertex, axis of symmetry, and minimum or maximum value.',
  // After the last Unit 1 module (difference quotient, 5.5) and before chemistry (6). The other Unit 2
  // modules follow at 5.7 and 5.8.
  order: 5.6,
  templates: [formTemplate, vertexTemplate],
  ruleCards: CS_RULES,
  // The flow counts her accepted lines itself; nothing anchors on a canonical path here.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(quadraticsModule)
