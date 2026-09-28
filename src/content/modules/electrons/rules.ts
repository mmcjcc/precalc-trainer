import type { RuleCard } from '@/content/types'

/**
 * Rule cards for electrons and light (CK-12 ch. 5.1–5.3), in this module's own words.
 * Ids are stable: templates point at them for hint rung 2. "Hz, which is s⁻¹" is said once, on the
 * wave-equation card. Electron-configuration cards will be added beside these later.
 */
export const LT_RULE_IDS = {
  wave: 'lt-wave',
  inverse: 'lt-inverse',
  convert: 'lt-convert-nm',
  energy: 'lt-energy',
  higher: 'lt-higher-energy',
  spectrum: 'lt-spectrum',
  constants: 'lt-constants',
} as const

export type LtRuleKey = keyof typeof LT_RULE_IDS

export function ltRule(key: LtRuleKey): string {
  return LT_RULE_IDS[key]
}

export const LT_RULES: RuleCard[] = [
  {
    id: LT_RULE_IDS.wave,
    title: 'c = λν',
    body: 'The speed of light equals wavelength times frequency: c = λν. c is the speed of light, λ (lambda) is the wavelength, and ν (nu) is the frequency. So ν = c ÷ λ and λ = c ÷ ν. Frequency is measured in hertz (Hz, which is s⁻¹).',
    example: 'ν = c ÷ λ     λ = c ÷ ν',
  },
  {
    id: LT_RULE_IDS.inverse,
    title: 'Wavelength and frequency move in opposite directions',
    body: 'They multiply to the same c, so a longer wavelength means a smaller frequency, and a shorter wavelength means a larger one. A long radio wave has a low frequency; a short gamma ray has a high one.',
    example: 'longer λ → smaller ν     shorter λ → larger ν',
  },
  {
    id: LT_RULE_IDS.convert,
    title: 'Convert nanometers to meters first',
    body: 'c is in meters per second, so λ has to be in meters before you use it. 1 nm = 10⁻⁹ m, exactly: multiply the nanometers by 10⁻⁹ (the decimal point jumps nine places left). Do not multiply by 10⁹, and do not skip the conversion.',
    example: '620 nm → 6.20 × 10⁻⁷ m     not 620 m, and not 6.20 × 10¹¹ m',
  },
  {
    id: LT_RULE_IDS.energy,
    title: 'Energy of one photon',
    body: 'E = hν: Planck’s constant times the frequency. If you know the wavelength instead, ν = c ÷ λ, so E = hc ÷ λ. Do that as one multiplication-and-division and round once, at the end. The energy is in joules, for one photon.',
    example: 'E = h × ν     or     E = hc ÷ λ',
  },
  {
    id: LT_RULE_IDS.higher,
    title: 'Higher frequency means higher energy',
    body: 'E = hν and h is the same for every photon, so a higher frequency is a higher energy. Energy and frequency run the same way; wavelength runs the opposite way.',
    example: 'violet (higher ν) carries more energy per photon than red',
  },
  {
    id: LT_RULE_IDS.spectrum,
    title: 'The order of the spectrum',
    body: 'From longest wavelength to shortest: radio, microwave, infrared, visible, ultraviolet, X-ray, gamma. Radio has the lowest frequency and the lowest energy; gamma has the highest of both. Frequency and energy rise as wavelength falls. For visible colors the same is true from red to violet: red, orange, yellow, green, blue, violet.',
    example: 'increasing wavelength: gamma → radio     increasing frequency or energy: radio → gamma',
  },
  {
    id: LT_RULE_IDS.constants,
    title: 'The constants count toward significant figures',
    body: 'c = 3.00 × 10⁸ m/s has three significant figures and h = 6.626 × 10⁻³⁴ J·s has four. Both are measurements, so they limit a × or ÷ answer like any other measured number. 1 nm = 10⁻⁹ m is exact: it never limits the answer.',
    example: '3.00 × 10⁸ has 3 figures     6.626 × 10⁻³⁴ has 4     10⁻⁹ is exact',
  },
]
