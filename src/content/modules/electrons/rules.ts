import type { RuleCard } from '@/content/types'
import { FILLING_ORDER, SUBSHELL_CAPACITY, subshellName } from '@/engine'

/**
 * Rule cards for electrons and light (CK-12 ch. 5), in this module's own words.
 * Ids are stable: templates point at them for hint rung 2. "Hz, which is s⁻¹" is said once, on the
 * wave-equation card. Configuration cards (5.4 onward) sit beside the light cards; the filling
 * order and the subshell capacities are read from the engine so the card cannot drift from it.
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

/** Filling order and capacities, taken from the engine rather than retyped. */
const FILLING = FILLING_ORDER.map((sub) => subshellName(sub)).join(' ')
const CAP_S = SUBSHELL_CAPACITY.s
const CAP_P = SUBSHELL_CAPACITY.p
const CAP_D = SUBSHELL_CAPACITY.d

/**
 * Electron-configuration cards (CK-12 ch. 5.4 onward). Ids are stable: templates point at them
 * for hint rung 2.
 */
export const EC_RULE_IDS = {
  filling: 'ec-filling',
  before3d: 'ec-4s-before-3d',
  exceptions: 'ec-exceptions',
  shorthand: 'ec-shorthand',
  ions: 'ec-ions',
  pauli: 'ec-pauli',
  hund: 'ec-hund',
  valence: 'ec-valence',
} as const

export type EcRuleKey = keyof typeof EC_RULE_IDS

export function ecRule(key: EcRuleKey): string {
  return EC_RULE_IDS[key]
}

export const EC_RULES: RuleCard[] = [
  {
    id: EC_RULE_IDS.filling,
    title: 'The order subshells fill',
    body: `Electrons fill subshells from lowest energy to highest: ${FILLING}. An s subshell holds ${CAP_S} electrons, a p subshell holds ${CAP_P}, and a d subshell holds ${CAP_D}. Stop when the number of electrons equals the atomic number (or, for an ion, the atomic number minus the charge).`,
    example: `${FILLING}     s ${CAP_S}, p ${CAP_P}, d ${CAP_D}`,
  },
  {
    id: EC_RULE_IDS.before3d,
    title: '4s fills before 3d',
    body: '4s is slightly lower in energy than 3d, so 4s fills right after 3p, and 3d fills after 4s. Writing the configuration by shell number may put 3d before 4s, but the electrons went into 4s first. Do not put electrons in 3d while 4s is still empty, and do not skip 3d on the way to 4p.',
    example: 'after 3p comes 4s, then 3d, then 4p',
  },
  {
    id: EC_RULE_IDS.exceptions,
    title: 'Chromium and copper',
    body: 'Chromium and copper are the two exceptions in the first 36 elements. A half-filled 3d subshell or a completely filled one is extra stable, so one electron moves from 4s to 3d. Chromium is 4s¹ 3d⁵, not 4s² 3d⁴. Copper is 4s¹ 3d¹⁰, not 4s² 3d⁹. Every other element from scandium to zinc follows the plain order.',
    example: 'Cr: 4s² 3d⁴ ✗ → 4s¹ 3d⁵     Cu: 4s² 3d⁹ ✗ → 4s¹ 3d¹⁰',
  },
  {
    id: EC_RULE_IDS.shorthand,
    title: 'Noble-gas shorthand',
    body: 'A noble-gas core stands for every electron up through that gas. Use the noble gas that comes just before the element — or, for an ion, the noble gas with no more electrons than the ion has. Write it in square brackets, then only the subshells that come after it. Do not write the core’s own subshells again, and do not use the element itself as its core.',
    example: 'Ca: 1s² … 3p⁶ 4s² → [Ar] 4s²',
  },
  {
    id: EC_RULE_IDS.ions,
    title: 'Ions lose the outermost electrons first',
    body: 'The charge tells you how many electrons were gained or lost. A positive ion has lost electrons; a negative ion has gained them. Electrons leave the highest shell number first. For a transition metal that means the 4s electrons leave before any 3d electron, even though 4s filled first. A main-group ion ends up with a noble-gas configuration.',
    example: 'Fe²⁺: [Ar] 4s² 3d⁴ ✗ → [Ar] 3d⁶',
  },
  {
    id: EC_RULE_IDS.pauli,
    title: 'Pauli exclusion principle',
    body: 'An orbital holds at most two electrons, and those two must have opposite spins: one arrow up and one arrow down. Two arrows the same way in one box, or three arrows in one box, cannot happen.',
    example: '[↑↑] ✗ → [↑↓]',
  },
  {
    id: EC_RULE_IDS.hund,
    title: "Hund's rule",
    body: 'The orbitals of one subshell have the same energy. Each box gets one electron, all with the same spin, before any box gets a second electron. Pairing up early, or pointing the single arrows different ways, breaks the rule. An unpaired electron is one that sits alone in its box.',
    example: '[↑↓] [ ] [ ] ✗ → [↑] [↑] [ ]',
  },
  {
    id: EC_RULE_IDS.valence,
    title: 'Valence electrons',
    body: 'Valence electrons are the electrons in the outermost occupied shell, the highest shell number, in every subshell of that shell. The atomic number counts every electron, not just the valence ones. A filled 3d subshell is in shell 3, an inner shell for gallium through krypton, so those ten electrons are not valence electrons.',
    example: 'Cl: 17 ✗ → 7     Ga: 13 ✗ → 3',
  },
]
