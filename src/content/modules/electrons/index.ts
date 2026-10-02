import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { EL_MODULE_ID } from './build'
import { diagramTemplate, fullTemplate, identifyTemplate, ionTemplate, shorthandTemplate, valenceTemplate } from './econfig'
import { energyTemplate } from './energy'
import { freqTemplate } from './freq'
import { EC_RULES, LT_RULES } from './rules'
import { spectrumTemplate } from './spectrum'
import { wavelengthTemplate } from './wavelength'

export { LT_RULE_IDS, LT_RULES } from './rules'
export { EC_RULE_IDS, EC_RULES } from './rules'

/**
 * Electrons and light (chemistry; CK-12 Introductory Chemistry ch. 5). Light calculations are
 * sections 5.1–5.3. Electron configurations (5.4 onward: aufbau, Pauli, Hund, diagrams, shorthand,
 * valence electrons, ions) are more templates on this same module, graded by the econfig engine.
 */
export const electronsModule: ModuleDef = {
  id: EL_MODULE_ID,
  subject: 'Chemistry',
  title: 'Electrons and light',
  blurb: 'Frequency, wavelength and photon energy, the order of the spectrum, and electron configurations: aufbau order, orbital diagrams, noble-gas shorthand, valence electrons and ions. Chapter 5.',
  order: 8,
  templates: [freqTemplate, wavelengthTemplate, energyTemplate, spectrumTemplate, fullTemplate, shorthandTemplate, ionTemplate, identifyTemplate, valenceTemplate, diagramTemplate],
  ruleCards: [...LT_RULES, ...EC_RULES],
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(electronsModule)
