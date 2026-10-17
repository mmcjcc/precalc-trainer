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
import { PARALLEL_RULES, POLYGON_RULES } from './unit3Rules'
import {
  drawLineSlopes,
  drawParallelConverse,
  drawParallelSolve,
  drawPolygonAngles,
  drawTransversalPairs,
  drawTriangleAngles,
} from './unit3Make'

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

/**
 * Parallel lines and transversals (honors geometry Unit 3). Angle pairs, solving with
 * parallel lines, the converses, and slopes of parallel and perpendicular lines.
 */
export const geoParallelModule: ModuleDef = {
  id: 'geoParallel',
  subject: 'Geometry',
  title: 'Parallel lines and transversals',
  blurb: 'Name an angle pair, solve with parallel lines, decide whether two lines are parallel, and use slopes.',
  order: 13,
  templates: [
    geoTemplate('geoParallel', 'gl3.pairs', 'Angle pairs', 'Two lines are cut by a transversal. Name the relationship of two numbered angles.', drawTransversalPairs),
    geoTemplate('geoParallel', 'gl3.solve', 'Parallel lines', 'The two lines are parallel. Two angles are expressions in x. Find x, then a measure.', drawParallelSolve),
    geoTemplate('geoParallel', 'gl3.converse', 'Are the lines parallel?', 'Two angles are given. Decide whether the lines are parallel, and name the fact.', drawParallelConverse),
    geoTemplate('geoParallel', 'gl3.slopes', 'Slopes and equations', 'A slope, a comparison, or the equation of a parallel or perpendicular line.', drawLineSlopes),
  ],
  ruleCards: PARALLEL_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Angles of triangles and polygons (honors geometry Unit 3). The triangle sum, an exterior
 * angle, and the interior and exterior angles of a convex polygon.
 */
export const geoPolygonAnglesModule: ModuleDef = {
  id: 'geoPolygonAngles',
  subject: 'Geometry',
  title: 'Angles of triangles and polygons',
  blurb: 'Find an angle in a triangle, or an interior or exterior angle of a polygon.',
  order: 14,
  templates: [
    geoTemplate('geoPolygonAngles', 'gpa.triangle', 'Triangle angles', 'A triangle with expressions in x. Find x, then an angle measure.', drawTriangleAngles),
    geoTemplate('geoPolygonAngles', 'gpa.polygon', 'Polygon angles', 'An interior or exterior angle of a convex polygon, or the number of sides.', drawPolygonAngles),
  ],
  ruleCards: POLYGON_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

registerModule(geoSegmentsModule)
registerModule(geoAnglesModule)
registerModule(geoLogicModule)
registerModule(geoProofModule)
registerModule(geoParallelModule)
registerModule(geoPolygonAnglesModule)
