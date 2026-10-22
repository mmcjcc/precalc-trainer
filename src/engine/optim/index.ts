/**
 * The optimization core (precalculus Unit 2, optimization with quadratics): reading her equations in x, y and the
 * quantity's letter, checking the secondary (linear) equation by proportional coefficients and the primary and final
 * equations by solving for the quantity and comparing values at points in the problem's domain, reading her numbers
 * exactly, the vertex and its slips, and the two graders. Pure; imported as `@/engine/optim` (the engine's index is
 * left as it was). API: docs/progress/optimization.md.
 */
export { OPT_MISTAKE_IDS, isOptMistake, type OptDomain, type OptGrade, type OptMistakeId, type OptVar } from './types'
export {
  displayNode,
  exactOfNode,
  lettersPhrase,
  readOptEquation,
  readOptNumber,
  residual,
  unitSpellings,
  type OptEquation,
  type OptEquationProblem,
  type OptEquationRead,
  type OptLengthUnit,
  type OptNumber,
  type OptNumberProblem,
  type OptNumberRead,
  type OptUnitKind,
  type OptUnits,
} from './read'
export { degenerate, dependence, domainPoints, linearForm, sameCurve, sameLinear, sameQuantity, sameValues, solvedAt, solvedFor, usesLetter, type LinearForm, type Point } from './equiv'
export {
  exactFromText,
  finalRoute,
  gradeOptEquation,
  gradeOptNumber,
  type OptDimension,
  type OptEquationPart,
  type OptEquationSpec,
  type OptEquationTrap,
  type OptNumberSpec,
  type OptNumberTrap,
} from './grade'
export { profileOf, profilePoints, sameProfile, type EquationProfile } from './profile'
export { evalQuadratic, vertexOf, vertexSlipValues, type Quadratic } from './vertex'
export { q, qAdd, qDiv, qEq, qMul, qNeg, qSub, qText, type Q } from '../trig/rational'
