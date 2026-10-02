/**
 * Electron configurations (chemistry, CK-12 ch. 5): ground-state configurations of H to Kr and their taught
 * ions, noble-gas shorthand, valence electrons, orbital diagrams, unpaired electrons. Public API; re-exported
 * from `@/engine`. The API document is docs/progress/econfig-core.md.
 */
import { diagramProblem } from './orbital'
import { canonicalCore, resolveSpecies, speciesDisplay, speciesProblem } from './model'
import { capitalized, nameOf } from './text'
import type { EconfigQuestion, EconfigSpeciesLike, SubshellLike } from './types'
import { valenceProblem } from './valence'

export type {
  ConfigurationMistakeCandidate,
  ConfigurationParse,
  CountMistakeCandidate,
  DiagramMistakeCandidate,
  EconfigForm,
  EconfigGrade,
  EconfigMistakeKind,
  EconfigOrder,
  EconfigQuestion,
  EconfigSpecies,
  EconfigSpeciesLike,
  ElectronConfiguration,
  NobleGasCore,
  OrbitalBox,
  OrbitalDiagram,
  OrbitalDiagramInfo,
  OrbitalDiagramParse,
  ParsedConfiguration,
  ParsedCore,
  ParsedTerm,
  EconfigRenderOptions,
  NobleGasShorthand,
  SpeciesAnswer,
  SpeciesAnswerParse,
  Spin,
  Subshell,
  SubshellCount,
  SubshellLetter,
  SubshellLike,
} from './types'
export { ECONFIG_MISTAKE_KINDS } from './types'

export {
  ECONFIG_MAX_Z,
  econfigAtoms,
  econfigIons,
  econfigSpecies,
  electronConfiguration,
  electronCount,
  EXCEPTION_ELEMENTS,
  FILLING_ORDER,
  NOBLE_GAS_CORES,
  nobleGasShorthand,
  resolveSpecies,
  shellOrder,
  speciesDisplay,
  speciesLatex,
  speciesProblem,
  speciesText,
  SUBSHELL_CAPACITY,
  SUBSHELL_ORBITALS,
  subshellName,
} from './model'
export { configurationDisplay, configurationLatex, configurationText, termsDisplay, termsLatex, termsText } from './text'
export { parseConfiguration, parseSpeciesAnswer } from './parse'
export { configurationMistakes, gradeConfiguration, gradeFullConfiguration, gradeShorthandConfiguration } from './grade'
export type { ConfigurationGradeOptions } from './grade'
export { gradeIdentifySpecies, identifyMistakes, speciesOfConfiguration } from './identify'
export type { ConfigurationReading, IdentifyOptions } from './identify'
export { explainValence, gradeValenceElectrons, valenceElectrons, valenceMistakes, valenceProblem } from './valence'
export {
  diagramProblem,
  gradeOrbitalDiagram,
  gradeUnpairedElectrons,
  hundDiagram,
  lastSubshell,
  orbitalDiagram,
  orbitalDiagramDisplay,
  orbitalDiagramLatex,
  orbitalDiagramMistakes,
  orbitalDiagramText,
  parseOrbitalDiagram,
  unpairedElectrons,
  unpairedInDiagram,
  unpairedMistakes,
} from './orbital'
export type { DiagramGradeOptions, UnpairedGradeOptions } from './orbital'
export { explainConfiguration, explainIdentify, explainOrbitalDiagram, explainUnpaired } from './explain'

/**
 * The validator for the content stage: why this species does not suit this question, or null when it does.
 * Call it on every generated problem so a template never produces an element or ion outside the model.
 *
 *   econfigProblem('Fe3+')                 → null              (in the model: any question that takes an ion)
 *   econfigProblem('Fe4+')                 → "Fe⁴⁺ is outside the model: the taught charges of iron are 3+ and 2+."
 *   econfigProblem('Rb')                   → "Element 37 (rubidium) is outside the model: …"
 *   econfigProblem('Fe', 'valence')        → "Iron is a transition metal, and transition metals are out of scope …"
 *   econfigProblem('He', 'shorthand')      → "No noble gas comes before helium, so it has no shorthand to write."
 *   econfigProblem('O', 'diagram', '3d')   → null (an empty subshell is a fair question); '5s' is not: outside the model
 *
 * With no question it checks the species alone (the same as `speciesProblem`).
 */
export function econfigProblem(species: EconfigSpeciesLike, question?: EconfigQuestion, subshell?: SubshellLike): string | null {
  const problem = speciesProblem(species)
  if (problem) return problem
  const sp = resolveSpecies(species)!
  switch (question) {
    case 'valence':
      return valenceProblem(sp)
    case 'shorthand':
      if (canonicalCore(sp)) return null
      return sp.charge === 0
        ? `No noble gas comes before ${nameOf(sp.z)}, so it has no shorthand to write.`
        : `${capitalized(speciesDisplay(sp))} has too few electrons for a noble-gas core.`
    case 'diagram':
      return diagramProblem(sp, subshell)
    default:
      return null
  }
}
