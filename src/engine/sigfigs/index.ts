/**
 * Significant figures (chemistry). Public surface, re-exported from `@/engine`.
 * Exact arithmetic throughout (digit strings + BigInt); see docs/progress/sigfigs-engine.md for
 * signatures and one usage example per function.
 */
export { parseSigFigNumeral, countSigFigs, type SigFigParse } from './parse'
export { roundToSigFigs, roundToPlace } from './round'
export {
  evaluateSigFigTask,
  validateSigFigTask,
  sigFigTaskExpression,
  sigFigTaskTerms,
  SigFigTaskError,
} from './evaluate'
export {
  gradeSigFigAnswer,
  gradeSigFigTaps,
  gradeSigFigIntermediate,
  sigFigMistakeCandidates,
} from './grade'
export { sigFigPlaceName, composeSigFigText, prettySigFig } from './text'
