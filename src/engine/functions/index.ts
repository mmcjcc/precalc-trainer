/**
 * Functions core (precalculus Unit 1): domain and range, composition. Public API; re-exported from
 * `@/engine`. The API document is docs/progress/functions-core.md.
 */
export type {
  DomainRestriction,
  DomainResult,
  ExpressionMistakeCandidate,
  FunctionGrade,
  FunctionMistakeKind,
  RangeFamily,
  RangeResult,
  RestrictionKind,
  SetMistakeCandidate,
  ValueMistakeCandidate,
} from './types'
export { FUNCTION_MISTAKE_KINDS } from './types'

export { domainOf, domainMistakes, gradeDomain } from './domain'
export { rangeOf, rangeMistakes, gradeRange } from './range'
export {
  checkDecomposition,
  compositeAtText,
  compositeDomain,
  compositeDomainMistakes,
  compositeValue,
  compositeValueMistakes,
  compositionMistakes,
  composeText,
  gradeComposition,
  gradeCompositeDomain,
  gradeCompositeValue,
} from './compose'
export type { CompositeDomainResult, CompositeValue, CompositionText, DecompositionResult, ExactNumber } from './compose'
export { parseSetAnswer, parseValueAnswer } from './answer'
export type { SetAnswerParse, ValueAnswerParse } from './answer'
export { builderText as setToBuilderText, describeText as describeSetText, substituteText as substituteFunctionText } from './text'
export { surdToText, type Surd } from './exact'
