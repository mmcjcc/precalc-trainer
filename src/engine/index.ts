/**
 * Engine public API (BUILD_GUIDE §4). Layers above import from here (`@/engine`).
 */
export type { Relation, Statement } from './types'
export type { Detection, DeferReason } from './transforms'
export type { OneToOneResult } from './oneToOne'
export type { ParityRow } from './parity'

export { normalizeInput, parseStatement, parseExpression, statementToPlain } from './parse'
export { compileExpr, evaluateExpr, exprEquivalent, substituteNegX, negateExpr, verifyRewrite } from './expressions'
export { verifyStep, verifyStatements as verifyStatementsWithContext } from './step'
export { classifyRewrite } from './rewriteClassifier'
export { checkParitySeeded as checkParity, checkParity as checkParityWithK, evalExpr } from './parity'
export { isOneToOne } from './oneToOne'
export { statementHolds, niceNumber, DEFAULT_SEED } from './samples'
export { detectMove } from './transforms'
export { runMatchers } from './matchers'
export { ERROR_PATTERNS, patternHit } from './matchers/catalog'

// Difference quotient (precalculus Unit 1 Day 5): f(x + h) lines, DQ lines, the simplified test.
export {
  appText,
  checkDqLine,
  checkFxhLine,
  definedAtHZero,
  differenceQuotient,
  dqMistake,
  dqSamplePoints,
  dqStartLine,
  dqStatus,
  DQ_VARS,
  fOfXPlusH,
  fxhMistake,
  LEFT_TO_DO,
  polynomialCoefficients,
  stripFxhLabel,
  substituteX,
} from './diffQuotient'
export type { DqLineResult, DqSpec } from './diffQuotient'

// Significant figures (chemistry). Exact digit-string / BigInt arithmetic; types live in @/shared/types.
export * from './sigfigs'

// Atomic structure (chemistry): particle counts, nuclear notation, isotope averages. Exact arithmetic.
export * from './atoms'

// Legacy exports (first-spike UI). Prefer the context-taking `verifyStep` above.
export { verifyStep as verifyStepLegacy, verifyStatements } from './verify'
export { statementsEquivalent } from './equiv'
export { CHIPS } from './types'
export type { VerifyResult, PatternHit, ChipId } from './types'
