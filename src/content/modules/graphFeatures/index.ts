import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { graphFeaturesTemplate } from './generate'
import { GF_RULES } from './rules'

export { GF_RULE_IDS, GF_RULES } from './rules'
export { canonicalEntries, gradeGraphFeatures, GF_PATTERN_IDS } from './grade'
export type { GfAnswer, GfEntries, GfFieldGrade, GfGrade } from './grade'
export { worksheetInstance, WORKSHEET_TURNS } from './generate'
export { slopeAt, valueAt } from './curve'

/**
 * Reading a graph (precalculus). Answer-only: the labelled graph is the question, and she fills in
 * increasing, decreasing, global max, global min, local max, and local min. No calculator panel.
 */
export const graphFeaturesModule: ModuleDef = {
  id: 'graphFeatures',
  title: 'Reading a graph',
  blurb: 'Where a graph increases and decreases, and its global and local max and min. Interval notation for the intervals; points listed with and.',
  order: 1.5,
  templates: [graphFeaturesTemplate],
  ruleCards: GF_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'read the graph', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(graphFeaturesModule)
