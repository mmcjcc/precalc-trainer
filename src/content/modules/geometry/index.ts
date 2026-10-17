import { registerModule } from '@/content/registry'
import type { DifficultyKnobs, ModuleDef, TemplateDef } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import type { GeoBuilt } from './build'
import { geoInstance } from './build'
import { drawLaws, drawRelated, drawTruth } from './logicMake'
import {
  drawAngleAddition,
  drawBisector,
  drawCoordinate,
  drawMidpoint,
  drawPairs,
  drawSegmentAddition,
  drawWords,
} from './make'
import { drawAlgebraic, drawReason, drawTwoColumn } from './proofMake'
import { ANGLE_RULES, SEGMENT_RULES } from './rules'
import { LOGIC_RULES, PROOF_RULES } from './unit2Rules'

export { readGeoAnswer, formatPoint, formatQty, formatValue, geoQty, sameGeoValue, sameQty, simplifyRadical } from './answer'
export type { GeoQty, GeoRead, GeoReadOptions, GeoValue } from './answer'
export { GEO_KEYS, canonicalEntries, geoWork } from './build'
export type { GeometryAnswer } from './build'
export { GEO_MISTAKE_IDS, GEO_UNIT1_MISTAKE_IDS, GEO_UNIT2_MISTAKE_IDS, exampleShowsAnswer, gradeGeoStage, isGeoMistake } from './grade'
export type { GeoGrade, GeoMistakeId } from './grade'
export { GEO_RULE_FOR, GEO_RULE_IDS } from './rules'

const PROGRESS = () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1 as const, path: 'none' as const })

function geoTemplate(
  moduleId: ModuleId,
  id: string,
  title: string,
  description: string,
  draw: (seed: number) => GeoBuilt,
): TemplateDef {
  return {
    id,
    title,
    description,
    version: 1,
    knobs: [],
    generate: (seed: number, knobs: DifficultyKnobs) => geoInstance(moduleId, id, 1, seed, knobs, draw(seed)),
  }
}

/**
 * Segments, midpoints and distance (honors geometry Unit 1). Addition on a line, a midpoint
 * on the segment, and the midpoint or distance of two points in the plane.
 */
export const geoSegmentsModule: ModuleDef = {
  id: 'geoSegments',
  subject: 'Geometry',
  title: 'Segments, midpoints and distance',
  blurb: 'Add pieces of a segment, use a midpoint, and find a midpoint or a distance in the coordinate plane.',
  order: 9,
  templates: [
    geoTemplate('geoSegments', 'gs.addition', 'Segment addition', 'B is between A and C. Find x, then a length.', drawSegmentAddition),
    geoTemplate('geoSegments', 'gs.midpoint', 'Midpoint of a segment', 'M is the midpoint of AB. Find x, then a length.', drawMidpoint),
    geoTemplate('geoSegments', 'gs.coord', 'Midpoint and distance', 'Two points in the plane: a midpoint, the other endpoint, or the distance.', drawCoordinate),
  ],
  ruleCards: SEGMENT_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Angles and angle pairs (honors geometry Unit 1). Addition, a bisector, complementary and
 * supplementary angles, vertical angles, a linear pair, and the classic word problems.
 */
export const geoAnglesModule: ModuleDef = {
  id: 'geoAngles',
  subject: 'Geometry',
  title: 'Angles and angle pairs',
  blurb: 'Add pieces of an angle, use a bisector, and solve complementary, supplementary, vertical, and linear pairs.',
  order: 10,
  templates: [
    geoTemplate('geoAngles', 'ga.addition', 'Angle addition', 'D is inside ∠ABC. Find x, then an angle measure.', drawAngleAddition),
    geoTemplate('geoAngles', 'ga.bisector', 'Angle bisector', 'BD bisects ∠ABC. Find x, then an angle measure.', drawBisector),
    geoTemplate('geoAngles', 'ga.pairs', 'Angle pairs', 'Two angles are complementary, supplementary, vertical, or a linear pair.', drawPairs),
    geoTemplate('geoAngles', 'ga.words', 'Angle word problems', 'An angle is described from its complement or its supplement. Find the angle.', drawWords),
  ],
  ruleCards: ANGLE_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Conditionals and logic (honors geometry Unit 2). Related statements, truth values and
 * counterexamples, and what follows from two premises.
 */
export const geoLogicModule: ModuleDef = {
  id: 'geoLogic',
  subject: 'Geometry',
  title: 'Conditionals and logic',
  blurb: 'Build the related if-then statements, decide whether one holds, and say what follows from two premises.',
  order: 11,
  templates: [
    geoTemplate(
      'geoLogic',
      'gl.related',
      'Related conditionals',
      'From one if-then, pick the swapped sentence, the negated sentence, and the sentence that does both, or name which of those a new sentence is.',
      drawRelated,
    ),
    geoTemplate(
      'geoLogic',
      'gl.truth',
      'True or false',
      'Decide whether an if-then, a related sentence, or an if-and-only-if holds. When it fails, pick the situation that knocks it down.',
      drawTruth,
    ),
    geoTemplate(
      'geoLogic',
      'gl.laws',
      'Laws of logic',
      'Two premises. Pick the conclusion they allow, or say that nothing follows.',
      drawLaws,
    ),
  ],
  ruleCards: LOGIC_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Properties and proofs (honors geometry Unit 2). A reason from the shared bank, an algebraic
 * proof, and a two-column proof. She never types a reason.
 */
export const geoProofModule: ModuleDef = {
  id: 'geoProof',
  subject: 'Geometry',
  title: 'Properties and proofs',
  blurb: 'Pick the reason a line is legal, finish an algebraic proof, and fill a two-column proof.',
  order: 12,
  templates: [
    geoTemplate('geoProof', 'gp.reason', 'Name the reason', 'One line of a proof. Pick the reason that makes it legal.', drawReason),
    geoTemplate(
      'geoProof',
      'gp.algebraic',
      'Algebraic proof',
      'An equation is solved in a few lines. Pick the reason for each line, in order.',
      drawAlgebraic,
    ),
    geoTemplate(
      'geoProof',
      'gp.twocolumn',
      'Two-column proof',
      'A proof from Unit 1 or Unit 2. Most rows need a reason; one or two rows need the missing statement.',
      drawTwoColumn,
    ),
  ],
  ruleCards: PROOF_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

registerModule(geoSegmentsModule)
registerModule(geoAnglesModule)
registerModule(geoLogicModule)
registerModule(geoProofModule)
