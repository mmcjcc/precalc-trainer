/**
 * Transformations core (precalculus Unit 1): transformations of functions g(x) = a·f(b(x − h)) + k,
 * piecewise evaluation, average rate of change. Public API; re-exported from `@/engine`. The API document is
 * docs/progress/transformations-core.md.
 */
export type {
  AverageRate,
  DescribedStep,
  DescriptionGrade,
  EquationMistakeCandidate,
  ExactPoint,
  KeyFeatures,
  ParentInfo,
  ParentName,
  PiecewisePiece,
  PiecewiseValue,
  PointLike,
  PointMistakeCandidate,
  RateMistakeCandidate,
  RatLike,
  StatementForm,
  StepCheck,
  StepInput,
  StepSlot,
  TransformGrade,
  TransformMistakeKind,
  TransformSpec,
  TransformStep,
} from './types'
export { TRANSFORM_MISTAKE_KINDS } from './types'

export {
  explicitFormula,
  fNotation,
  graphWindow,
  hasUnfactoredForm,
  insideText,
  keyFeatures,
  makeTransform,
  mapPoint,
  PARENT_NAMES,
  PARENTS,
  parentFormula,
  sameGraph,
  specDomain,
  specProblem,
  specRange,
  transformValueAt,
  unfactoredConstant,
} from './spec'
export type { TransformParams } from './spec'
export { describeAsInputs, describeTransform, gradeDescription, stepSentence } from './describe'
export { gradeMappedPoint, mappedPointMistakes, parsePointAnswer } from './points'
export type { PointAnswerParse } from './points'
export { equationMistakes, gradeEquation, isSameFunction } from './equation'
export { evaluatePiecewise, gradePiecewiseValue, pieceConditionText, piecewiseProblem } from './piecewise'
export { averageRateMistakes, averageRateOfChange, gradeAverageRate } from './rate'
export { toRational } from './text'
