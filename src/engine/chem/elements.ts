/**
 * Periodic-table data for high-school chemistry modules (CK-12 Chemistry - Intermediate).
 *
 * Sources:
 * - IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW), abridged standard
 *   atomic weights (2024 table; Atomic Weights 2021 report, with 2024 revisions for Gd, Lu,
 *   and Zr). For an element with no standard atomic weight, the mass number of its
 *   longest-lived isotope (NUBASE2020 / CIAAW radioactive-elements table); Tc is given as 98
 *   as printed on high-school periodic tables.
 * - NIST Atomic Weights and Isotopic Compositions (relative atomic masses and representative
 *   isotopic abundances).
 *
 * Numeric values the app does exact decimal arithmetic on (atomic weights, isotopic masses,
 * and natural abundances) are stored as text so trailing zeros survive (e.g. '12.011', not
 * 12.011).
 */

export interface ElementInfo {
  z: number
  symbol: string
  /** lower-case English name, e.g. 'chlorine' */
  name: string
  /**
   * Conventional atomic weight as printed on a high-school periodic table, as TEXT:
   * '1.008', '4.0026', '12.011', '14.007', '15.999', '22.990', '35.45', '55.845', '63.546'.
   * For an element with no stable isotope, the mass number of its longest-lived isotope, e.g. '98' (Tc).
   */
  atomicWeight: string
  /** true when the element has no stable isotope (Tc, Pm, and Z >= 84) */
  radioactive: boolean
  /** 1..7 */
  period: number
  /** 1..18; null for the lanthanides (Z 57-71) and actinides (Z 89-103) */
  group: number | null
  /**
   * Ion charges a first-year chemistry student is taught, most common first.
   * Group 1 -> [1]; group 2 -> [2]; Al [3]; Zn [2]; Ag [1]; N [-3]; P [-3]; O [-2]; S [-2];
   * F, Cl, Br, I -> [-1]; H [1, -1]; Fe [3, 2]; Cu [2, 1]; Pb [2, 4]; Sn [2, 4]; Co [2, 3];
   * Cr [3, 2]; Mn [2, 3]; Hg [2, 1]; Au [3, 1]; Ni [2]. Empty [] for the noble gases, for C and Si,
   * and wherever no simple monatomic ion is taught at this level.
   */
  commonCharges: number[]
}

/** Z = 1 (H) through 92 (U), in order, every element present. */
export const ELEMENTS: readonly ElementInfo[] = [
  { z: 1, symbol: 'H', name: 'hydrogen', atomicWeight: '1.008', radioactive: false, period: 1, group: 1, commonCharges: [1, -1] },
  { z: 2, symbol: 'He', name: 'helium', atomicWeight: '4.0026', radioactive: false, period: 1, group: 18, commonCharges: [] },
  { z: 3, symbol: 'Li', name: 'lithium', atomicWeight: '6.94', radioactive: false, period: 2, group: 1, commonCharges: [1] },
  { z: 4, symbol: 'Be', name: 'beryllium', atomicWeight: '9.0122', radioactive: false, period: 2, group: 2, commonCharges: [2] },
  { z: 5, symbol: 'B', name: 'boron', atomicWeight: '10.81', radioactive: false, period: 2, group: 13, commonCharges: [] },
  { z: 6, symbol: 'C', name: 'carbon', atomicWeight: '12.011', radioactive: false, period: 2, group: 14, commonCharges: [] },
  { z: 7, symbol: 'N', name: 'nitrogen', atomicWeight: '14.007', radioactive: false, period: 2, group: 15, commonCharges: [-3] },
  { z: 8, symbol: 'O', name: 'oxygen', atomicWeight: '15.999', radioactive: false, period: 2, group: 16, commonCharges: [-2] },
  { z: 9, symbol: 'F', name: 'fluorine', atomicWeight: '18.998', radioactive: false, period: 2, group: 17, commonCharges: [-1] },
  { z: 10, symbol: 'Ne', name: 'neon', atomicWeight: '20.180', radioactive: false, period: 2, group: 18, commonCharges: [] },
  { z: 11, symbol: 'Na', name: 'sodium', atomicWeight: '22.990', radioactive: false, period: 3, group: 1, commonCharges: [1] },
  { z: 12, symbol: 'Mg', name: 'magnesium', atomicWeight: '24.305', radioactive: false, period: 3, group: 2, commonCharges: [2] },
  { z: 13, symbol: 'Al', name: 'aluminum', atomicWeight: '26.982', radioactive: false, period: 3, group: 13, commonCharges: [3] },
  { z: 14, symbol: 'Si', name: 'silicon', atomicWeight: '28.085', radioactive: false, period: 3, group: 14, commonCharges: [] },
  { z: 15, symbol: 'P', name: 'phosphorus', atomicWeight: '30.974', radioactive: false, period: 3, group: 15, commonCharges: [-3] },
  { z: 16, symbol: 'S', name: 'sulfur', atomicWeight: '32.06', radioactive: false, period: 3, group: 16, commonCharges: [-2] },
  { z: 17, symbol: 'Cl', name: 'chlorine', atomicWeight: '35.45', radioactive: false, period: 3, group: 17, commonCharges: [-1] },
  { z: 18, symbol: 'Ar', name: 'argon', atomicWeight: '39.95', radioactive: false, period: 3, group: 18, commonCharges: [] },
  { z: 19, symbol: 'K', name: 'potassium', atomicWeight: '39.098', radioactive: false, period: 4, group: 1, commonCharges: [1] },
  { z: 20, symbol: 'Ca', name: 'calcium', atomicWeight: '40.078', radioactive: false, period: 4, group: 2, commonCharges: [2] },
  { z: 21, symbol: 'Sc', name: 'scandium', atomicWeight: '44.956', radioactive: false, period: 4, group: 3, commonCharges: [] },
  { z: 22, symbol: 'Ti', name: 'titanium', atomicWeight: '47.867', radioactive: false, period: 4, group: 4, commonCharges: [] },
  { z: 23, symbol: 'V', name: 'vanadium', atomicWeight: '50.942', radioactive: false, period: 4, group: 5, commonCharges: [] },
  { z: 24, symbol: 'Cr', name: 'chromium', atomicWeight: '51.996', radioactive: false, period: 4, group: 6, commonCharges: [3, 2] },
  { z: 25, symbol: 'Mn', name: 'manganese', atomicWeight: '54.938', radioactive: false, period: 4, group: 7, commonCharges: [2, 3] },
  { z: 26, symbol: 'Fe', name: 'iron', atomicWeight: '55.845', radioactive: false, period: 4, group: 8, commonCharges: [3, 2] },
  { z: 27, symbol: 'Co', name: 'cobalt', atomicWeight: '58.933', radioactive: false, period: 4, group: 9, commonCharges: [2, 3] },
  { z: 28, symbol: 'Ni', name: 'nickel', atomicWeight: '58.693', radioactive: false, period: 4, group: 10, commonCharges: [2] },
  { z: 29, symbol: 'Cu', name: 'copper', atomicWeight: '63.546', radioactive: false, period: 4, group: 11, commonCharges: [2, 1] },
  { z: 30, symbol: 'Zn', name: 'zinc', atomicWeight: '65.38', radioactive: false, period: 4, group: 12, commonCharges: [2] },
  { z: 31, symbol: 'Ga', name: 'gallium', atomicWeight: '69.723', radioactive: false, period: 4, group: 13, commonCharges: [] },
  { z: 32, symbol: 'Ge', name: 'germanium', atomicWeight: '72.630', radioactive: false, period: 4, group: 14, commonCharges: [] },
  { z: 33, symbol: 'As', name: 'arsenic', atomicWeight: '74.922', radioactive: false, period: 4, group: 15, commonCharges: [] },
  { z: 34, symbol: 'Se', name: 'selenium', atomicWeight: '78.971', radioactive: false, period: 4, group: 16, commonCharges: [] },
  { z: 35, symbol: 'Br', name: 'bromine', atomicWeight: '79.904', radioactive: false, period: 4, group: 17, commonCharges: [-1] },
  { z: 36, symbol: 'Kr', name: 'krypton', atomicWeight: '83.798', radioactive: false, period: 4, group: 18, commonCharges: [] },
  { z: 37, symbol: 'Rb', name: 'rubidium', atomicWeight: '85.468', radioactive: false, period: 5, group: 1, commonCharges: [1] },
  { z: 38, symbol: 'Sr', name: 'strontium', atomicWeight: '87.62', radioactive: false, period: 5, group: 2, commonCharges: [2] },
  { z: 39, symbol: 'Y', name: 'yttrium', atomicWeight: '88.906', radioactive: false, period: 5, group: 3, commonCharges: [] },
  { z: 40, symbol: 'Zr', name: 'zirconium', atomicWeight: '91.222', radioactive: false, period: 5, group: 4, commonCharges: [] },
  { z: 41, symbol: 'Nb', name: 'niobium', atomicWeight: '92.906', radioactive: false, period: 5, group: 5, commonCharges: [] },
  { z: 42, symbol: 'Mo', name: 'molybdenum', atomicWeight: '95.95', radioactive: false, period: 5, group: 6, commonCharges: [] },
  { z: 43, symbol: 'Tc', name: 'technetium', atomicWeight: '98', radioactive: true, period: 5, group: 7, commonCharges: [] },
  { z: 44, symbol: 'Ru', name: 'ruthenium', atomicWeight: '101.07', radioactive: false, period: 5, group: 8, commonCharges: [] },
  { z: 45, symbol: 'Rh', name: 'rhodium', atomicWeight: '102.91', radioactive: false, period: 5, group: 9, commonCharges: [] },
  { z: 46, symbol: 'Pd', name: 'palladium', atomicWeight: '106.42', radioactive: false, period: 5, group: 10, commonCharges: [] },
  { z: 47, symbol: 'Ag', name: 'silver', atomicWeight: '107.87', radioactive: false, period: 5, group: 11, commonCharges: [1] },
  { z: 48, symbol: 'Cd', name: 'cadmium', atomicWeight: '112.41', radioactive: false, period: 5, group: 12, commonCharges: [] },
  { z: 49, symbol: 'In', name: 'indium', atomicWeight: '114.82', radioactive: false, period: 5, group: 13, commonCharges: [] },
  { z: 50, symbol: 'Sn', name: 'tin', atomicWeight: '118.71', radioactive: false, period: 5, group: 14, commonCharges: [2, 4] },
  { z: 51, symbol: 'Sb', name: 'antimony', atomicWeight: '121.76', radioactive: false, period: 5, group: 15, commonCharges: [] },
  { z: 52, symbol: 'Te', name: 'tellurium', atomicWeight: '127.60', radioactive: false, period: 5, group: 16, commonCharges: [] },
  { z: 53, symbol: 'I', name: 'iodine', atomicWeight: '126.90', radioactive: false, period: 5, group: 17, commonCharges: [-1] },
  { z: 54, symbol: 'Xe', name: 'xenon', atomicWeight: '131.29', radioactive: false, period: 5, group: 18, commonCharges: [] },
  { z: 55, symbol: 'Cs', name: 'cesium', atomicWeight: '132.91', radioactive: false, period: 6, group: 1, commonCharges: [1] },
  { z: 56, symbol: 'Ba', name: 'barium', atomicWeight: '137.33', radioactive: false, period: 6, group: 2, commonCharges: [2] },
  { z: 57, symbol: 'La', name: 'lanthanum', atomicWeight: '138.91', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 58, symbol: 'Ce', name: 'cerium', atomicWeight: '140.12', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 59, symbol: 'Pr', name: 'praseodymium', atomicWeight: '140.91', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 60, symbol: 'Nd', name: 'neodymium', atomicWeight: '144.24', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 61, symbol: 'Pm', name: 'promethium', atomicWeight: '145', radioactive: true, period: 6, group: null, commonCharges: [] },
  { z: 62, symbol: 'Sm', name: 'samarium', atomicWeight: '150.36', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 63, symbol: 'Eu', name: 'europium', atomicWeight: '151.96', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 64, symbol: 'Gd', name: 'gadolinium', atomicWeight: '157.25', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 65, symbol: 'Tb', name: 'terbium', atomicWeight: '158.93', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 66, symbol: 'Dy', name: 'dysprosium', atomicWeight: '162.50', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 67, symbol: 'Ho', name: 'holmium', atomicWeight: '164.93', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 68, symbol: 'Er', name: 'erbium', atomicWeight: '167.26', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 69, symbol: 'Tm', name: 'thulium', atomicWeight: '168.93', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 70, symbol: 'Yb', name: 'ytterbium', atomicWeight: '173.05', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 71, symbol: 'Lu', name: 'lutetium', atomicWeight: '174.97', radioactive: false, period: 6, group: null, commonCharges: [] },
  { z: 72, symbol: 'Hf', name: 'hafnium', atomicWeight: '178.49', radioactive: false, period: 6, group: 4, commonCharges: [] },
  { z: 73, symbol: 'Ta', name: 'tantalum', atomicWeight: '180.95', radioactive: false, period: 6, group: 5, commonCharges: [] },
  { z: 74, symbol: 'W', name: 'tungsten', atomicWeight: '183.84', radioactive: false, period: 6, group: 6, commonCharges: [] },
  { z: 75, symbol: 'Re', name: 'rhenium', atomicWeight: '186.21', radioactive: false, period: 6, group: 7, commonCharges: [] },
  { z: 76, symbol: 'Os', name: 'osmium', atomicWeight: '190.23', radioactive: false, period: 6, group: 8, commonCharges: [] },
  { z: 77, symbol: 'Ir', name: 'iridium', atomicWeight: '192.22', radioactive: false, period: 6, group: 9, commonCharges: [] },
  { z: 78, symbol: 'Pt', name: 'platinum', atomicWeight: '195.08', radioactive: false, period: 6, group: 10, commonCharges: [] },
  { z: 79, symbol: 'Au', name: 'gold', atomicWeight: '196.97', radioactive: false, period: 6, group: 11, commonCharges: [3, 1] },
  { z: 80, symbol: 'Hg', name: 'mercury', atomicWeight: '200.59', radioactive: false, period: 6, group: 12, commonCharges: [2, 1] },
  { z: 81, symbol: 'Tl', name: 'thallium', atomicWeight: '204.38', radioactive: false, period: 6, group: 13, commonCharges: [] },
  { z: 82, symbol: 'Pb', name: 'lead', atomicWeight: '207.2', radioactive: false, period: 6, group: 14, commonCharges: [2, 4] },
  { z: 83, symbol: 'Bi', name: 'bismuth', atomicWeight: '208.98', radioactive: false, period: 6, group: 15, commonCharges: [] },
  { z: 84, symbol: 'Po', name: 'polonium', atomicWeight: '209', radioactive: true, period: 6, group: 16, commonCharges: [] },
  { z: 85, symbol: 'At', name: 'astatine', atomicWeight: '210', radioactive: true, period: 6, group: 17, commonCharges: [] },
  { z: 86, symbol: 'Rn', name: 'radon', atomicWeight: '222', radioactive: true, period: 6, group: 18, commonCharges: [] },
  { z: 87, symbol: 'Fr', name: 'francium', atomicWeight: '223', radioactive: true, period: 7, group: 1, commonCharges: [1] },
  { z: 88, symbol: 'Ra', name: 'radium', atomicWeight: '226', radioactive: true, period: 7, group: 2, commonCharges: [2] },
  { z: 89, symbol: 'Ac', name: 'actinium', atomicWeight: '227', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 90, symbol: 'Th', name: 'thorium', atomicWeight: '232.04', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 91, symbol: 'Pa', name: 'protactinium', atomicWeight: '231.04', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 92, symbol: 'U', name: 'uranium', atomicWeight: '238.03', radioactive: true, period: 7, group: null, commonCharges: [] },
]

export interface IsotopeInfo {
  massNumber: number
  /** isotopic mass in u as TEXT, 3 to 6 decimal places, e.g. '34.969' */
  mass: string
  /** natural abundance in PERCENT as TEXT, e.g. '75.76' */
  abundance: string
}

/**
 * Every naturally occurring isotope with abundance >= 0.01 %, keyed by element symbol, for exactly
 * these elements: H, Li, B, C, N, O, Mg, Si, Cl, K, Cu, Ga, Br, Rb, Ag.
 * The abundances of each element must sum to 100 within 0.02.
 */
export const NATURAL_ISOTOPES: Readonly<Record<string, readonly IsotopeInfo[]>> = {
  H: [
    { massNumber: 1, mass: '1.007825', abundance: '99.9885' },
    { massNumber: 2, mass: '2.014102', abundance: '0.0115' },
  ],
  Li: [
    { massNumber: 6, mass: '6.015123', abundance: '7.59' },
    { massNumber: 7, mass: '7.016003', abundance: '92.41' },
  ],
  B: [
    { massNumber: 10, mass: '10.012937', abundance: '19.9' },
    { massNumber: 11, mass: '11.009305', abundance: '80.1' },
  ],
  C: [
    { massNumber: 12, mass: '12.000000', abundance: '98.93' },
    { massNumber: 13, mass: '13.003355', abundance: '1.07' },
  ],
  N: [
    { massNumber: 14, mass: '14.003074', abundance: '99.636' },
    { massNumber: 15, mass: '15.000109', abundance: '0.364' },
  ],
  O: [
    { massNumber: 16, mass: '15.994915', abundance: '99.757' },
    { massNumber: 17, mass: '16.999132', abundance: '0.038' },
    { massNumber: 18, mass: '17.999160', abundance: '0.205' },
  ],
  Mg: [
    { massNumber: 24, mass: '23.985042', abundance: '78.99' },
    { massNumber: 25, mass: '24.985837', abundance: '10.00' },
    { massNumber: 26, mass: '25.982593', abundance: '11.01' },
  ],
  Si: [
    { massNumber: 28, mass: '27.976927', abundance: '92.223' },
    { massNumber: 29, mass: '28.976495', abundance: '4.685' },
    { massNumber: 30, mass: '29.973770', abundance: '3.092' },
  ],
  Cl: [
    { massNumber: 35, mass: '34.969', abundance: '75.76' },
    { massNumber: 37, mass: '36.966', abundance: '24.24' },
  ],
  K: [
    { massNumber: 39, mass: '38.963706', abundance: '93.2581' },
    { massNumber: 40, mass: '39.963998', abundance: '0.0117' },
    { massNumber: 41, mass: '40.961825', abundance: '6.7302' },
  ],
  Cu: [
    { massNumber: 63, mass: '62.929598', abundance: '69.15' },
    { massNumber: 65, mass: '64.927790', abundance: '30.85' },
  ],
  Ga: [
    { massNumber: 69, mass: '68.925574', abundance: '60.108' },
    { massNumber: 71, mass: '70.924703', abundance: '39.892' },
  ],
  Br: [
    { massNumber: 79, mass: '78.918338', abundance: '50.69' },
    { massNumber: 81, mass: '80.916290', abundance: '49.31' },
  ],
  Rb: [
    { massNumber: 85, mass: '84.911790', abundance: '72.17' },
    { massNumber: 87, mass: '86.909181', abundance: '27.83' },
  ],
  Ag: [
    { massNumber: 107, mass: '106.905092', abundance: '51.839' },
    { massNumber: 109, mass: '108.904755', abundance: '48.161' },
  ],
}

export interface NotableIsotope {
  symbol: string
  massNumber: number
  /** one short sentence a student would recognise, e.g. 'used in radiocarbon dating' */
  note: string
}

/**
 * About a dozen isotopes students meet by name: H-2 (deuterium), H-3 (tritium), C-12 (defines the
 * atomic mass unit), C-13, C-14 (radiocarbon dating), N-15, O-18, Co-60, Sr-90, I-131, U-235, U-238.
 */
export const NOTABLE_ISOTOPES: readonly NotableIsotope[] = [
  { symbol: 'H', massNumber: 2, note: 'deuterium, the stable heavy isotope of hydrogen' },
  { symbol: 'H', massNumber: 3, note: 'tritium, a radioactive hydrogen isotope' },
  { symbol: 'C', massNumber: 12, note: 'defines the atomic mass unit' },
  { symbol: 'C', massNumber: 13, note: 'stable carbon isotope used in NMR spectroscopy' },
  { symbol: 'C', massNumber: 14, note: 'used in radiocarbon dating' },
  { symbol: 'N', massNumber: 15, note: 'stable nitrogen isotope used as a tracer' },
  { symbol: 'O', massNumber: 18, note: 'stable oxygen isotope used in climate and water studies' },
  { symbol: 'Co', massNumber: 60, note: 'gamma source used in cancer radiotherapy' },
  { symbol: 'Sr', massNumber: 90, note: 'fission product that substitutes for calcium in bone' },
  { symbol: 'I', massNumber: 131, note: 'used to diagnose and treat thyroid conditions' },
  { symbol: 'U', massNumber: 235, note: 'fissile isotope used as fuel in nuclear reactors' },
  { symbol: 'U', massNumber: 238, note: 'most abundant naturally occurring uranium isotope' },
]

export function elementBySymbol(symbol: string): ElementInfo | undefined {
  return ELEMENTS.find((el) => el.symbol === symbol)
}

export function elementByZ(z: number): ElementInfo | undefined {
  return ELEMENTS.find((el) => el.z === z)
}
