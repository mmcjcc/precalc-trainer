/**
 * Atomic structure (chemistry, CK-12 ch. 4). Public surface, re-exported from `@/engine`.
 * See docs/progress/atoms.md for the grading rules and one example per function.
 */
export {
  particleCounts,
  particleFromCounts,
  assertParticle,
  elementNameOf,
  hyphenName,
  chargeText,
  chargeWords,
  formulaText,
  nuclearSymbolText,
  nuclearSymbolLatex,
  parseChargeText,
  parseSymbolText,
  parseWholeNumber,
  superscript,
  subscript,
} from './particle'
export { gradeParticles, explainParticles, particleShownText, type ParticlesEntry, type ParticlesQuestion } from './particles'
export { gradeNotation, explainNotation, type NotationEntry, type NotationQuestion } from './notation'
export {
  averageMassTask,
  gradeAverageMass,
  averageMassMistakeCandidates,
  explainAverageMass,
  exactAverage as exactAverageMass,
  abundanceTotal,
  PERCENT_NOTE,
  type AverageMassQuestion,
} from './average'
export {
  solveAbundance,
  abundanceIssues,
  gradeAbundance,
  explainAbundance,
  parsePercentText,
  placeWords as percentPlaceWords,
  type AbundanceQuestion,
  type AbundanceSolution,
} from './abundance'
export { ratFromText as atomRatFromText, textAt as atomTextAt, display as atomDisplay } from './exact'
