/**
 * The trig core (precalculus Unit 4): exact angles in degrees or radians, the quadrant, coterminal and reference
 * angles, the six functions at the special angles and from a point on the terminal side, arc length and sector
 * area, a reader for her exact answers, the named slips of each question computed for the problem in hand, and the
 * grader. Pure; imported as `@/engine/trig` (the engine's index is left as it was). API: docs/progress/trig-unit4a.md.
 */
export type { Q } from './rational'
export { q, qText, qNum, qEq, qAdd, qSub, qMul, qDiv, qNeg, qAbs, qCmp, qFromDecimal, gcd } from './rational'
export type { TrigExact } from './exact'
export {
  EXACT_ONE,
  EXACT_ZERO,
  exactAbs,
  exactAdd,
  exactAscii,
  exactDiv,
  exactEq,
  exactInt,
  exactInv,
  exactMul,
  exactNeg,
  exactNum,
  exactPi,
  exactPow,
  exactQ,
  exactRational,
  exactSay,
  exactSign,
  exactSqrt,
  exactTex,
  exactText,
  isZero,
  tx,
} from './exact'
export type { AngleUnit, Axis, Place, Quadrant, TrigAngle } from './angle'
export {
  FULL_TURN,
  HALF_TURN,
  QUARTER_TURN,
  angle,
  angleSay,
  angleTex,
  angleText,
  coterminalDeg,
  degFromPiMultiple,
  degText,
  halfTurnSlipDeg,
  isSpecialDeg,
  measureOf,
  negativeDirectionDeg,
  oneTurnShortDeg,
  piMultipleFromDeg,
  placeOf,
  placeWords,
  quadrantName,
  radiansOf,
  referenceDeg,
  samePlace,
  turnsTo,
} from './angle'
export type { TrigFn, TrigValue } from './values'
export { TRIG_FNS, fnTex, pointR, pointValue, ratioOf, reciprocalFn, trigValue, unitPoint, valueAscii, valueEq, valueNeg, valueSay, valueTex, valueText } from './values'
export type { FormIssue, ReadOptions, TrigNumberRead, TrigRead } from './reader'
export { formNote, readExact, readTrigAnswer } from './reader'
export type { ArcProblem, ArcTheta, ArcWhat, TrigDecimalSlip, TrigPlaceSlip, TrigSlip } from './slips'
export {
  approxOf,
  arcAnswer,
  arcSlips,
  conversionAnswer,
  conversionDecimalAnswer,
  conversionDecimalSlips,
  conversionSlips,
  coterminalAnswer,
  coterminalSlips,
  placeAnswer,
  placeOfPoint,
  placeSlips,
  pointAnswer,
  pointSlips,
  rAnswer,
  referenceAnswer,
  referenceSlips,
  rSlips,
  saySlipValue,
  valueAnswer,
  valueSlips,
} from './slips'
export type { TrigCandidate, TrigGrade, TrigInvalidReason, TrigSpec } from './grade'
export { gradeTrigAnswer, placesPhrase } from './grade'
export type { TrigMistakeId } from './types'
export { TRIG_MISTAKE_IDS, isTrigMistake } from './types'
