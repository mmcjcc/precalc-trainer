import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { DQ_RULES } from './build'
import { dqNextStep, dqProgress, dqSolved } from './grade'
import { dqLinearTemplate } from './linear'
import { dqQuadraticTemplate } from './quadratic'
import { dqRadicalTemplate } from './radical'
import { dqRationalTemplate } from './rational'

/** Precalculus Unit 1, Day 5: (f(x + h) − f(x))/h, the slope of a secant line. */
export const diffQuotientModule: ModuleDef = {
  id: 'diffQuotient',
  title: 'Difference quotient',
  blurb: 'Find f(x + h), subtract ALL of f(x), divide by h, and simplify until no h is left underneath.',
  // After the precalculus modules (1–5), before the chemistry ones (6, 7).
  order: 5.5,
  templates: [dqLinearTemplate, dqQuadraticTemplate, dqRationalTemplate, dqRadicalTemplate],
  ruleCards: DQ_RULES,
  progress: (instance, line) => dqProgress(instance, line),
  nextStep: (instance, line) => dqNextStep(instance, line),
  solved: dqSolved,
}

registerModule(diffQuotientModule)
