/**
 * Exponentials and logarithms core (precalculus). log is base 10, ln is base e, log(u, b) / log_b(u) /
 * logBASE(u, b) is base b (the parser rewrites every spelling; see syntax.ts). API document:
 * docs/progress/explog-core.md.
 */
export type {
  DecimalSpec,
  ExtraneousNote,
  LogCaveatId,
  LogGrade,
  LogMistakeCandidate,
  LogMistakeId,
  LogMove,
  LogPatternId,
  LogProperty,
  LogRewriteContext,
  LogStepContext,
  LogStepResult,
} from './types'
export { LOG_MISTAKE_IDS } from './types'

// Line by line.
export { checkLogStep, decimalTolerance, sameLogLine } from './step'
export { checkLogRewrite, condenseLog, expandLog, isExpandedLog, isSingleLog } from './rewrite'
// What each named mistake turns a line into (the checker's own slips), for lines shown as choices (Guided mode).
export { logLineSlips, logRewriteSlips, type LogLineSlip } from './lineSlips'

// Final answers.
export { gradeLogValue, logValue, logValueMistakes, type LogValue } from './value'
export { convertForm, convertMistakes, expFormText, gradeConvertForm, logFormText, readForm, type ExpLogParts } from './convert'
export {
  analyzeLogEquation,
  gradeLogEquation,
  logEquationMistakes,
  parseSolutionAnswer,
  type AnswerValue,
  type LogEquation,
  type LogSolution,
  type SolutionAnswer,
} from './solve'

// Exact values of constant expressions (exact.ts) for templates that need to pick nice numbers.
export { exactEquals, exactIsRational, exactRational, exactToNumber, tryExact as exactLogValue, type ExactValue as ExactLogValue } from './exact'
