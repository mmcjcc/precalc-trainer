import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { trigWork } from '../trig/parts'
import { OT_MODULE_ID, OT_TEMPLATES } from './build'
import { OT_RULES } from './rules'

export { OT_RULES, OT_RULE_IDS, OT_RESERVED_ANGLES } from './rules'
export { OT_HINTS, OT_INSTRUCTIONS, OT_TITLES } from './words'
export { OT_MODULE_ID, OT_TEMPLATES, ambiguousTemplate, areaTemplate, chooseTemplate, cosinesTemplate, finishOt, sinesTemplate } from './build'
export { EARLY_NOTE, gradeObliquePart, gradeOtPart, obliqueFigureTextsAt } from './grade'
export { sinesProblem } from './sines'
export { ambiguousProblem } from './ambiguous'
export { sasProblem, sssProblem } from './cosines'
export { heronProblem, sasAreaProblem } from './area'
export { chooseProblem } from './choose'

export { trigWork as otWork }

/**
 * Oblique triangles (precalculus Unit 7): the law of sines, the ambiguous case, the law of cosines, the area of a
 * triangle, and which law starts a solution. Rounded answers to the nearest tenth, on the calculator in DEGREE mode.
 */
export const obliqueTrianglesModule: ModuleDef = {
  id: OT_MODULE_ID,
  title: 'Laws of sines and cosines',
  blurb: 'Triangles with no right angle: the law of sines and its ambiguous case, the law of cosines, area from two sides and an angle or from three sides, and which law to start with.',
  order: 5.9995,
  templates: [...OT_TEMPLATES],
  ruleCards: OT_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(obliqueTrianglesModule)
