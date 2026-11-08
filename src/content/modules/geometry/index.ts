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
import { drawIsosceles, drawParts, drawSolve, drawWhich } from './unit4Make'
import { drawTriangleProof } from './unit4Proof'
import { CONGRUENCE_RULES, ISOSCELES_RULES, TRIANGLE_PROOF_RULES } from './unit4Rules'
import { drawPgramCoords } from './unit5Coords'
import { drawPgramProps } from './unit5Pgram'
import { drawPgramProve } from './unit5Prove'
import { PARALLELOGRAM_RULES, SPECIAL_RULES, TRAPEZOID_RULES } from './unit5Rules'
import { drawClassify, drawSpecialProps } from './unit5Special'
import { drawMidsegment, drawTrapezoidKite } from './unit5Trap'
import { drawProportion, drawSimilarPolygons } from './unit6Ratios'
import { PARTS_RULES, RATIO_RULES, SIMILAR_RULES } from './unit6Rules'
import { drawBisectorParts, drawSplitter } from './unit6Parts'
import { drawSimilarProve, drawSimilarSolve } from './unit6Similar'
import { drawAltitude, drawGeoMean } from './unit7Mean'
import { drawApply, drawClassify7, drawPythSide } from './unit7Pyth'
import { PYTHAGOREAN_RULES, RIGHT_SIMILAR_RULES, SPECIAL_RIGHT_RULES } from './unit7Rules'
import { drawSpecial } from './unit7Special'
import { drawTrigAngle, drawTrigRatio, drawTrigSide } from './unit7bRatios'
import { drawElevStory, drawElevTwo } from './unit7bElev'
import { ELEVATION_RULES, TRIG_RATIO_RULES } from './unit7bRules'
import { drawInscribed, drawInside, drawOutside } from './unit8Angles'
import { drawEquation, drawLengths } from './unit8Measures'
import { ANGLE_RULES_8, MEASURE_RULES, TANGENT_RULES } from './unit8Rules'
import { drawArcs, drawChords, drawTangent } from './unit8Tangent'

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
    geoTemplate('geoParallel', 'gl3.converse', 'Are the lines parallel?', 'Two angles are given. Decide whether they show the lines are parallel, show they are not, or cannot tell, and name what decides it.', drawParallelConverse),
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

/**
 * Congruent triangles (honors geometry Unit 4). Corresponding parts, the postulate or theorem
 * the marks support, and an equation from two congruent parts.
 */
export const geoCongruenceModule: ModuleDef = {
  id: 'geoCongruence',
  subject: 'Geometry',
  title: 'Congruent triangles',
  blurb: 'Name a corresponding part, decide which postulate or theorem the marks support, and solve for a part of two congruent triangles.',
  order: 15,
  templates: [
    geoTemplate(
      'geoCongruence',
      'gc.parts',
      'Corresponding parts',
      'From a congruence statement, name the corresponding part, or pick the statement the marks support.',
      drawParts,
    ),
    geoTemplate(
      'geoCongruence',
      'gc.which',
      'Which method',
      'Two triangles with marks. Which postulate or theorem proves they are congruent, if any?',
      drawWhich,
    ),
    geoTemplate(
      'geoCongruence',
      'gc.solve',
      'Corresponding parts',
      'Two congruent triangles. Corresponding parts are expressions in x. Find x, then the part asked for.',
      drawSolve,
    ),
  ],
  ruleCards: CONGRUENCE_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Isosceles and equilateral triangles (honors geometry Unit 4). Base angles sit across from the
 * congruent sides, and an equilateral triangle's angles are not its side lengths.
 */
export const geoIsoscelesModule: ModuleDef = {
  id: 'geoIsosceles',
  subject: 'Geometry',
  title: 'Isosceles and equilateral triangles',
  blurb: 'Use two congruent sides, two congruent angles, or three congruent sides. Find x, then the part asked for.',
  order: 16,
  templates: [
    geoTemplate(
      'geoIsosceles',
      'gi.solve',
      'Isosceles and equilateral',
      'Two sides are congruent, two angles are congruent, or the triangle is equilateral. Find x, then the part asked for.',
      drawIsosceles,
    ),
  ],
  ruleCards: ISOSCELES_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Proving triangles congruent (honors geometry Unit 4). Two-column proofs: a reason from the bank,
 * or the missing statement, one row at a time.
 */
export const geoTriangleProofsModule: ModuleDef = {
  id: 'geoTriangleProofs',
  subject: 'Geometry',
  title: 'Proving triangles congruent',
  blurb: 'Fill a two-column proof that two triangles are congruent, then a pair of corresponding parts.',
  order: 17,
  templates: [
    geoTemplate(
      'geoTriangleProofs',
      'gt.twocolumn',
      'Two-column proof',
      'A proof that two triangles are congruent. Most rows need a reason; some rows need the missing statement.',
      drawTriangleProof,
    ),
  ],
  ruleCards: TRIANGLE_PROOF_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Parallelograms (honors geometry Unit 5, Jurgensen 5-1 and 5-2). Algebra with the properties, which fact
 * proves a quadrilateral is a parallelogram, and parallelograms on the coordinate plane.
 */
export const geoParallelogramsModule: ModuleDef = {
  id: 'geoParallelograms',
  subject: 'Geometry',
  title: 'Parallelograms',
  blurb: 'Use the sides, angles, and diagonals of a parallelogram, decide which fact proves one, and check one on the coordinate plane.',
  order: 18,
  templates: [
    geoTemplate(
      'geoParallelograms',
      'gq.props',
      'Parallelogram properties',
      'Sides, angles, or diagonal pieces of a parallelogram are expressions in x. Find x, then the measure asked.',
      drawPgramProps,
    ),
    geoTemplate(
      'geoParallelograms',
      'gq.prove',
      'Proving a parallelogram',
      'A quadrilateral with marks. Which fact, if any, proves it is a parallelogram?',
      drawPgramProve,
    ),
    geoTemplate(
      'geoParallelograms',
      'gq.coords',
      'Parallelograms on the coordinate plane',
      'Four vertices on a grid. Find slopes, lengths, or the midpoints of the diagonals, then say what they show.',
      drawPgramCoords,
    ),
  ],
  ruleCards: PARALLELOGRAM_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Rectangles, rhombuses, and squares (honors geometry Unit 5, Jurgensen 5-4). Algebra with the special
 * properties, and the most specific name a quadrilateral must have.
 */
export const geoSpecialQuadsModule: ModuleDef = {
  id: 'geoSpecialQuads',
  subject: 'Geometry',
  title: 'Rectangles, rhombuses, and squares',
  blurb: 'Use the diagonals of a rectangle, a rhombus, and a square, and name a quadrilateral as exactly as the facts allow.',
  order: 19,
  templates: [
    geoTemplate(
      'geoSpecialQuads',
      'gs.props',
      'Special parallelograms',
      'Diagonal pieces or angles of a rectangle, a rhombus, or a square are expressions in x. Find x, then the measure asked.',
      drawSpecialProps,
    ),
    geoTemplate(
      'geoSpecialQuads',
      'gs.classify',
      'Naming quadrilaterals',
      'From facts, marks, or coordinates: the most specific name, or whether it must be a rectangle and a rhombus.',
      drawClassify,
    ),
  ],
  ruleCards: SPECIAL_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Trapezoids, kites, and midsegments (honors geometry Unit 5, Jurgensen 5-3 and 5-5). The triangle midsegment and
 * the median of a trapezoid, and an isosceles trapezoid or a kite with expressions in x.
 */
export const geoTrapezoidsModule: ModuleDef = {
  id: 'geoTrapezoids',
  subject: 'Geometry',
  title: 'Trapezoids, kites, and midsegments',
  blurb: 'Use a triangle midsegment and the median of a trapezoid, and the angles and diagonals of isosceles trapezoids and kites.',
  order: 20,
  templates: [
    geoTemplate(
      'geoTrapezoids',
      'gz.midseg',
      'Midsegments and medians',
      'A triangle midsegment or the median of a trapezoid, with expressions in x. Find x, then the length asked.',
      drawMidsegment,
    ),
    geoTemplate(
      'geoTrapezoids',
      'gz.isosceles',
      'Isosceles trapezoids and kites',
      'Angles or diagonals of an isosceles trapezoid, or angles of a kite, with expressions in x. Find x, then the measure asked.',
      drawTrapezoidKite,
    ),
  ],
  ruleCards: TRAPEZOID_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

registerModule(geoSegmentsModule)
registerModule(geoAnglesModule)
registerModule(geoLogicModule)
registerModule(geoProofModule)
registerModule(geoParallelModule)
registerModule(geoPolygonAnglesModule)
registerModule(geoCongruenceModule)
registerModule(geoIsoscelesModule)
registerModule(geoTriangleProofsModule)
registerModule(geoParallelogramsModule)
registerModule(geoSpecialQuadsModule)
/**
 * Ratio, proportion and similar polygons (honors geometry Unit 6, Jurgensen 7-1 to 7-3). Solving a proportion, the
 * properties of proportions and the geometric mean; the scale factor, sides, angles and perimeters of similar polygons.
 */
export const geoRatiosModule: ModuleDef = {
  id: 'geoRatios',
  subject: 'Geometry',
  title: 'Ratio, proportion and similar polygons',
  blurb: 'Solve a proportion, use its properties and the geometric mean, and find the scale factor, sides, angles and perimeter of similar polygons.',
  order: 21,
  templates: [
    geoTemplate(
      'geoRatios',
      'gr.proportion',
      'Proportions',
      'Solve a proportion or find a geometric mean, find a ratio from an equation, or pick the equation a proportion gives.',
      drawProportion,
    ),
    geoTemplate(
      'geoRatios',
      'gr.polygons',
      'Similar polygons',
      'Two similar polygons, one turned or flipped. Find the scale factor, then x, then a side, the perimeter, or an angle.',
      drawSimilarPolygons,
    ),
  ],
  ruleCards: RATIO_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

registerModule(geoTrapezoidsModule)
/**
 * Similar triangles (honors geometry Unit 6, Jurgensen 7-3 to 7-5). Which postulate or theorem proves two triangles
 * similar, and using similar triangles: a triangle inside a triangle, the altitude to the hypotenuse, shadows and a mirror.
 */
export const geoSimilarTrianglesModule: ModuleDef = {
  id: 'geoSimilarTriangles',
  subject: 'Geometry',
  title: 'Similar triangles',
  blurb: 'Decide which postulate or theorem proves two triangles similar, then write the similarity statement and find a length.',
  order: 22,
  templates: [
    geoTemplate(
      'geoSimilarTriangles',
      'gt.prove',
      'Proving triangles similar',
      'Two triangles with marks. Which postulate or theorem, if any, proves they are similar?',
      drawSimilarProve,
    ),
    geoTemplate(
      'geoSimilarTriangles',
      'gt.solve',
      'Using similar triangles',
      'A triangle inside a triangle, the altitude to the hypotenuse, or shadows and a mirror. Write the similarity statement, then find x.',
      drawSimilarSolve,
    ),
  ],
  ruleCards: SIMILAR_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

registerModule(geoRatiosModule)
/**
 * Proportional parts (honors geometry Unit 6, Jurgensen 7-6). The Triangle Proportionality Theorem and its converse, a
 * parallel through a midpoint, the Triangle Angle-Bisector Theorem, and three parallel lines cutting two transversals.
 */
export const geoProportionalPartsModule: ModuleDef = {
  id: 'geoProportionalParts',
  subject: 'Geometry',
  title: 'Proportional parts',
  blurb: 'Use a segment parallel to a side, an angle bisector, or three parallel lines to set up a proportion of pieces.',
  order: 23,
  templates: [
    geoTemplate(
      'geoProportionalParts',
      'gp.splitter',
      'Triangle Proportionality Theorem',
      'A segment parallel to a side divides the other two sides proportionally. Find x, decide whether a segment is parallel, or use a midpoint.',
      drawSplitter,
    ),
    geoTemplate(
      'geoProportionalParts',
      'gp.bisector',
      'Angle bisectors and parallel lines',
      'An angle bisector divides the opposite side in the ratio of the other two sides, and three parallel lines divide two transversals proportionally. Find x.',
      drawBisectorParts,
    ),
  ],
  ruleCards: PARTS_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

registerModule(geoSimilarTrianglesModule)
registerModule(geoProportionalPartsModule)

/**
 * Similarity in right triangles (honors geometry Unit 7, Jurgensen 8-1). The geometric mean, and the right triangle
 * with the altitude to the hypotenuse: the altitude and each leg as geometric means, sometimes with a length in x.
 */
export const geoRightSimilarModule: ModuleDef = {
  id: 'geoRightSimilar',
  subject: 'Geometry',
  title: 'Similarity in right triangles',
  blurb: 'Find a geometric mean, and use the altitude to the hypotenuse of a right triangle to find the altitude, the legs, and the segments of the hypotenuse.',
  order: 24,
  templates: [
    geoTemplate(
      'geoRightSimilar',
      'rs.mean',
      'The geometric mean',
      'Find the geometric mean of two numbers in simplest radical form, or a number from its geometric mean and the other number.',
      drawGeoMean,
    ),
    geoTemplate(
      'geoRightSimilar',
      'rs.altitude',
      'The altitude to the hypotenuse',
      'A right triangle with the altitude to the hypotenuse. From two lengths, find the others exactly; sometimes a length is written in x.',
      drawAltitude,
    ),
  ],
  ruleCards: RIGHT_SIMILAR_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * The Pythagorean Theorem and its converse (honors geometry Unit 7, Jurgensen 8-2 and 8-3). A missing side, alone or
 * inside a rectangle, an isosceles triangle, a rhombus or the coordinate grid; acute, right, obtuse, or no triangle;
 * word problems rounded as asked.
 */
export const geoPythagoreanModule: ModuleDef = {
  id: 'geoPythagorean',
  subject: 'Geometry',
  title: 'The Pythagorean Theorem and its converse',
  blurb: 'Find a missing side of a right triangle exactly, classify a triangle from its three sides, and solve word problems with the Pythagorean Theorem.',
  order: 25,
  templates: [
    geoTemplate(
      'geoPythagorean',
      'py.side',
      'Finding a missing side',
      'A missing leg or hypotenuse in simplest radical form, alone or inside a rectangle, an isosceles triangle, a rhombus, or the coordinate grid.',
      drawPythSide,
    ),
    geoTemplate(
      'geoPythagorean',
      'py.classify',
      'Acute, right, or obtuse',
      'Three lengths: do they make a triangle, and if so, is it acute, right, or obtuse?',
      drawClassify7,
    ),
    geoTemplate(
      'geoPythagorean',
      'py.apply',
      'Pythagorean word problems',
      'Ladders, screens, ramps, fields, kites and ships, each length rounded as the problem asks.',
      drawApply,
    ),
  ],
  ruleCards: PYTHAGOREAN_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Special right triangles (honors geometry Unit 7, Jurgensen 8-4). 45°-45°-90° and 30°-60°-90° triangles from one
 * side, alone and inside squares, equilateral triangles, rectangles and rhombuses, exactly.
 */
export const geoSpecialRightModule: ModuleDef = {
  id: 'geoSpecialRight',
  subject: 'Geometry',
  title: 'Special right triangles',
  blurb: 'Use the 45°-45°-90° and 30°-60°-90° triangles to find sides exactly, alone and inside squares, equilateral triangles, rectangles, and rhombuses.',
  order: 26,
  templates: [
    geoTemplate(
      'geoSpecialRight',
      'sp.special',
      'Sides of the special triangles',
      'One side of a 45°-45°-90° or 30°-60°-90° triangle, alone or inside a figure. Find the others in simplest radical form.',
      drawSpecial,
    ),
  ],
  ruleCards: SPECIAL_RIGHT_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * The tangent, sine and cosine ratios (honors geometry Unit 7, Jurgensen 8-5 and 8-6). A ratio in lowest terms, a side
 * from a non-special angle, or an acute angle from two sides. The calculator stays in DEGREE mode.
 */
export const geoTrigRatiosModule: ModuleDef = {
  id: 'geoTrigRatios',
  subject: 'Geometry',
  title: 'The tangent, sine and cosine ratios',
  blurb: 'Write a tangent, sine, or cosine ratio in lowest terms, find a side from an acute angle, and find an acute angle from two sides.',
  order: 27,
  templates: [
    geoTemplate(
      'geoTrigRatios',
      'tr.ratio',
      'Writing a ratio',
      'From a labeled right triangle, write one ratio of an acute angle in lowest terms, or name which ratio uses two sides.',
      drawTrigRatio,
    ),
    geoTemplate(
      'geoTrigRatios',
      'tr.side',
      'Finding a side',
      'An acute angle that is not 30°, 45°, or 60°, and one side. Find another side, rounded as asked.',
      drawTrigSide,
    ),
    geoTemplate(
      'geoTrigRatios',
      'tr.angle',
      'Finding an angle',
      'Two sides of a right triangle. Find an acute angle to the nearest degree or tenth of a degree.',
      drawTrigAngle,
    ),
  ],
  ruleCards: TRIG_RATIO_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Angles of elevation and depression (honors geometry Unit 7, Jurgensen 8-7). One right triangle in a story, or two
 * observations of the same height. Both angles are measured from the horizontal.
 */
export const geoElevDepressModule: ModuleDef = {
  id: 'geoElevDepress',
  subject: 'Geometry',
  title: 'Angles of elevation and depression',
  blurb: 'Use an angle of elevation or depression to find a height, a distance, or the angle, including two observations of the same top.',
  order: 28,
  templates: [
    geoTemplate(
      'geoElevDepress',
      'el.story',
      'An angle of elevation or depression',
      'A tree, a cliff, a ladder, a kite, a ramp, a guy wire, or a plane: one right triangle, rounded as asked.',
      drawElevStory,
    ),
    geoTemplate(
      'geoElevDepress',
      'el.two',
      'Two angles of elevation',
      'Two angles of elevation to the same top, from points on the same side or on opposite sides. Find the height or a distance.',
      drawElevTwo,
    ),
  ],
  ruleCards: ELEVATION_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Tangents, arcs and chords (honors geometry Unit 8, Jurgensen 9-1 to 9-3). A tangent and the radius, two tangents
 * from one point, central angles and arcs, and a radius perpendicular to a chord.
 */
export const geoTangentChordsModule: ModuleDef = {
  id: 'geoTangentChords',
  subject: 'Geometry',
  title: 'Tangents, arcs and chords',
  blurb: 'A tangent meets the radius at a right angle, two tangents from one point match, and arcs and chords follow the center.',
  order: 29,
  templates: [
    geoTemplate(
      'geoTangentChords',
      'tc.tangent',
      'Tangents',
      'A tangent and the radius, the converse, two tangents from one point, or a walk around the circle.',
      drawTangent,
    ),
    geoTemplate(
      'geoTangentChords',
      'tc.arcs',
      'Central angles and arcs',
      'A central angle and its arc, a semicircle, arcs around the circle, or a minor arc and its major arc.',
      drawArcs,
    ),
    geoTemplate(
      'geoTangentChords',
      'tc.chords',
      'Chords',
      'Congruent chords, or a radius perpendicular to a chord: the half-chord, the distance to the center, or the radius.',
      drawChords,
    ),
  ],
  ruleCards: TANGENT_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Inscribed and other angles (honors geometry Unit 8, Jurgensen 9-5 to 9-7). An inscribed angle, an angle inside
 * the circle, and an angle outside the circle.
 */
export const geoCircleAnglesModule: ModuleDef = {
  id: 'geoCircleAngles',
  subject: 'Geometry',
  title: 'Inscribed and other angles',
  blurb: 'An inscribed angle is half its arc. Inside the circle the arcs are added, and outside they are subtracted.',
  order: 30,
  templates: [
    geoTemplate(
      'geoCircleAngles',
      'ia.inscribed',
      'Inscribed angles',
      'An inscribed angle and its arc, an angle inscribed in a semicircle, or opposite angles of an inscribed quadrilateral.',
      drawInscribed,
    ),
    geoTemplate(
      'geoCircleAngles',
      'ia.inside',
      'An angle inside the circle',
      'Two chords crossing inside the circle, or a tangent and a chord at the point of tangency.',
      drawInside,
    ),
    geoTemplate(
      'geoCircleAngles',
      'ia.outside',
      'An angle outside the circle',
      'Two secants, a secant and a tangent, or two tangents from a point outside the circle.',
      drawOutside,
    ),
  ],
  ruleCards: ANGLE_RULES_8,
  progress: PROGRESS,
  nextStep: () => null,
}

/**
 * Segment lengths and the equation of a circle (honors geometry Unit 8, Jurgensen 9-4 and 9-7, plus the circle
 * equation). Products of lengths, then center and radius.
 */
export const geoCircleMeasuresModule: ModuleDef = {
  id: 'geoCircleMeasures',
  subject: 'Geometry',
  title: 'Segment lengths and circle equations',
  blurb: 'Products of chord parts, secants, and a tangent with a secant, then the equation of a circle.',
  order: 31,
  templates: [
    geoTemplate(
      'geoCircleMeasures',
      'cm.lengths',
      'Segment lengths',
      'Two chords crossing inside, two secants from one point, or a tangent and a secant.',
      drawLengths,
    ),
    geoTemplate(
      'geoCircleMeasures',
      'cm.equation',
      'Equation of a circle',
      'Read a center and radius, write the equation, decide where a point is, or complete the square.',
      drawEquation,
    ),
  ],
  ruleCards: MEASURE_RULES,
  progress: PROGRESS,
  nextStep: () => null,
}

registerModule(geoRightSimilarModule)
registerModule(geoPythagoreanModule)
registerModule(geoSpecialRightModule)
registerModule(geoTrigRatiosModule)
registerModule(geoElevDepressModule)
registerModule(geoTangentChordsModule)
registerModule(geoCircleAnglesModule)
registerModule(geoCircleMeasuresModule)
