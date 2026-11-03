/**
 * Display-only rows for the periodic-table reference panel: Z = 93 (Np) through 118 (Og).
 *
 * The shared table in `src/engine/chem/elements.ts` stops at uranium on purpose — module
 * generators draw seeded problems from `ELEMENTS`, so adding rows there would reshuffle
 * every seed. These rows exist only so the reference panel looks like the wall chart;
 * no problem is ever generated or graded from them.
 *
 * `atomicWeight` is the mass number of the longest-lived isotope as printed in brackets
 * on the IUPAC periodic table (4 May 2022 release, still current as of 2026).
 */
import type { ElementInfo } from '@/engine/chem/elements'

export const TRANSURANICS: readonly ElementInfo[] = [
  { z: 93, symbol: 'Np', name: 'neptunium', atomicWeight: '237', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 94, symbol: 'Pu', name: 'plutonium', atomicWeight: '244', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 95, symbol: 'Am', name: 'americium', atomicWeight: '243', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 96, symbol: 'Cm', name: 'curium', atomicWeight: '247', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 97, symbol: 'Bk', name: 'berkelium', atomicWeight: '247', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 98, symbol: 'Cf', name: 'californium', atomicWeight: '251', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 99, symbol: 'Es', name: 'einsteinium', atomicWeight: '252', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 100, symbol: 'Fm', name: 'fermium', atomicWeight: '257', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 101, symbol: 'Md', name: 'mendelevium', atomicWeight: '258', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 102, symbol: 'No', name: 'nobelium', atomicWeight: '259', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 103, symbol: 'Lr', name: 'lawrencium', atomicWeight: '266', radioactive: true, period: 7, group: null, commonCharges: [] },
  { z: 104, symbol: 'Rf', name: 'rutherfordium', atomicWeight: '267', radioactive: true, period: 7, group: 4, commonCharges: [] },
  { z: 105, symbol: 'Db', name: 'dubnium', atomicWeight: '268', radioactive: true, period: 7, group: 5, commonCharges: [] },
  { z: 106, symbol: 'Sg', name: 'seaborgium', atomicWeight: '269', radioactive: true, period: 7, group: 6, commonCharges: [] },
  { z: 107, symbol: 'Bh', name: 'bohrium', atomicWeight: '270', radioactive: true, period: 7, group: 7, commonCharges: [] },
  { z: 108, symbol: 'Hs', name: 'hassium', atomicWeight: '277', radioactive: true, period: 7, group: 8, commonCharges: [] },
  { z: 109, symbol: 'Mt', name: 'meitnerium', atomicWeight: '278', radioactive: true, period: 7, group: 9, commonCharges: [] },
  { z: 110, symbol: 'Ds', name: 'darmstadtium', atomicWeight: '281', radioactive: true, period: 7, group: 10, commonCharges: [] },
  { z: 111, symbol: 'Rg', name: 'roentgenium', atomicWeight: '282', radioactive: true, period: 7, group: 11, commonCharges: [] },
  { z: 112, symbol: 'Cn', name: 'copernicium', atomicWeight: '285', radioactive: true, period: 7, group: 12, commonCharges: [] },
  { z: 113, symbol: 'Nh', name: 'nihonium', atomicWeight: '286', radioactive: true, period: 7, group: 13, commonCharges: [] },
  { z: 114, symbol: 'Fl', name: 'flerovium', atomicWeight: '289', radioactive: true, period: 7, group: 14, commonCharges: [] },
  { z: 115, symbol: 'Mc', name: 'moscovium', atomicWeight: '290', radioactive: true, period: 7, group: 15, commonCharges: [] },
  { z: 116, symbol: 'Lv', name: 'livermorium', atomicWeight: '293', radioactive: true, period: 7, group: 16, commonCharges: [] },
  { z: 117, symbol: 'Ts', name: 'tennessine', atomicWeight: '294', radioactive: true, period: 7, group: 17, commonCharges: [] },
  { z: 118, symbol: 'Og', name: 'oganesson', atomicWeight: '294', radioactive: true, period: 7, group: 18, commonCharges: [] },
]
