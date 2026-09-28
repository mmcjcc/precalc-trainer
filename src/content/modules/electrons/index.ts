import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { EL_MODULE_ID } from './build'
import { energyTemplate } from './energy'
import { freqTemplate } from './freq'
import { LT_RULES } from './rules'
import { spectrumTemplate } from './spectrum'
import { wavelengthTemplate } from './wavelength'

export { LT_RULE_IDS, LT_RULES } from './rules'

/**
 * Electrons and light (chemistry; CK-12 Introductory Chemistry ch. 5). The light calculations of
 * sections 5.1–5.3 live here now. Electron-configuration templates, from a separate engine, should
 * be added to this same module as another question kind — not as a new module.
 */
export const electronsModule: ModuleDef = {
  id: EL_MODULE_ID,
  subject: 'Chemistry',
  title: 'Electrons and light',
  blurb: 'Frequency, wavelength and the energy of one photon, and the order of the spectrum: chapter 5, sections 5.1 to 5.3.',
  order: 8,
  templates: [freqTemplate, wavelengthTemplate, energyTemplate, spectrumTemplate],
  ruleCards: LT_RULES,
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(electronsModule)
