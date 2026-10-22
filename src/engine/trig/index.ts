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
// The second half of Unit 4 (docs/progress/trig-unit4b.md): right triangles, the special triangles, the inverse
// functions on the calculator, one value and the quadrant, every angle in one turn.
export type { RtRole, RtSides } from './triangle'
export { RATIO_SIDES, ROLE_WORDS, hypotenuseOf, hypotenuseSlips, legOf, legSlips, rtRatio, rtRatioSlips, squareOf } from './triangle'
export type { SpecialRole, SpecialTriangle } from './special'
export { specialFactor, specialRoles, specialSide, specialSlips } from './special'
export type { AngleProblem, DepressionWords, RtFn, RtNames, SideProblem } from './inverse'
export { angleAnswer, angleSlips, fnDegrees, fnRadians, inverseDegrees, inverseRadians, linkOf, sideAnswer, sideSlips } from './inverse'
export type { GivenPoint } from './given'
export { givenCoordinateSlips, givenPoint, givenRSlips, givenValue, givenValueSlips, quadrantSigns, quadrantsWithSign, signIn } from './given'
export type { AngleListSpec, TrigListGrade, TrigListRead, TrigListSlip } from './solve'
export { SPECIAL_DEGREES, angleValue, degreesOfValue, gradeAngleList, listSay, listText, readAngleList, solveAnswer, solveSlips } from './solve'
// Unit 5 (docs/progress/trig-unit5.md): the graphs of the six functions, their equations and models, the inverse
// functions.
export type { ExactValue, ExprFn, ExprNode, ExprOptions, ExprRead, FunctionAnswerOptions, FunctionRead, SameFunctionCheck } from './expr'
export {
  evalExprExact,
  evalExprNum,
  exprTex,
  hasDecimal,
  hasTrigFunction,
  nearlySameFunction,
  normalizeExprText,
  principalDegrees,
  readExpr,
  readFunctionAnswer,
  sameFunction,
  spreadSamples,
} from './expr'
export type { Wave, WaveFn, WaveForm, WavePointsSlip, WaveRangeSlip, WaveSetSlip, WaveSlip, XFamily } from './wave'
export {
  addExact,
  amplitudeSlips,
  asymptoteSlips,
  baseTurn,
  familyTex,
  familyText,
  isSinusoid,
  keyPointSlips,
  midlineSlips,
  normalFamily,
  periodSlips,
  pointsText,
  rangeSlips,
  shiftSlips,
  waveAmplitude,
  waveAsymptotes,
  waveExtremes,
  waveInnerShift,
  waveInsideTex,
  waveInsideText,
  waveKeyPoints,
  wavePeriod,
  waveRangeText,
  waveRhsText,
  waveTex,
  waveText,
  waveValue,
  waveZeros,
  zeroSlips,
} from './wave'
export type { ShiftCandidate, ShiftRead } from './shift'
export { gradeShift, readShift } from './shift'
export type { XSet, XSetCandidate, XSetRead, XSetSpec } from './xset'
export { gradeXSet, membersBetween, readXSet, sameXSet, xSetTex } from './xset'
export type { PointsCandidate, PointsRead, XYPoint } from './points'
export { gradePoints, readPointList, samePoints } from './points'
export type { InvFn, InvUnit, InverseDecimalSlip, InverseSlip } from './principal'
export {
  INV_BASE,
  INV_WORD,
  RANGE_WORDS,
  angleIn,
  cancelSlips,
  cancelValue,
  evaluateSlips,
  inPrincipalRange,
  inverseDecimalSlips,
  inverseRad,
  outsideDomainTrap,
  outsideDomainWitness,
  principalValue,
} from './principal'
