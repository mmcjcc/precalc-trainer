/**
 * Notation layer public API (BUILD_GUIDE §5). Content and UI import from here.
 */
export {
  type Rational,
  rat,
  ratFromString,
  ratToString,
  ratCompare,
  ratToNumber,
  ratFromNumber,
  ratEquals,
  ratToLatex,
  ratAdd,
  ratSub,
  ratMul,
  ratDiv,
  ratNeg,
  ratIsInteger,
} from './rational'
export { toLatex, nodeToLatex, statementToLatex } from './toLatex'
export { toTi84, toNspire } from './calcString'
export {
  type Endpoint,
  type Piece,
  type SolutionSet,
  normalizeSet,
  setsEqual,
  setContains,
  setFromPieces,
  setToInterval,
  setToSetBuilder,
  setToLatex,
  describeSet,
  emptySet,
  allReals,
  setIsEmpty,
  setIsAllReals,
  setComplement,
  setIntersection,
  setUnion,
  setDifference,
  setIsSubset,
  setCriticalValues,
  components,
} from './sets/solutionSet'
export {
  parseInterval,
  type IntervalParseResult,
  type IntervalParseOk,
  type IntervalParseFail,
} from './sets/interval'
export {
  parseSetBuilder,
  setFromRelation,
  type SetBuilderParseResult,
  type SetBuilderParseOk,
  type SetBuilderParseFail,
} from './sets/setBuilder'
export { compareAnswerSet, crossCheck, type CompareResult, type CrossCheckResult } from './sets/compare'
export { NOTATION_PATTERNS, patternHit, type NotationPatternId } from './sets/patterns'
