/**
 * Periodic trends for CK-12 Chemistry chapter 6 (Z = 1 through 56, hydrogen through barium).
 *
 * One source per column:
 * - radiusPm: single-bond covalent radius in picometres from Cordero, Gómez, Platero-Prats,
 *   Revés, Echeverría, Cremades, Barragán and Alvarez, "Covalent radii revisited",
 *   Dalton Transactions 2008, 2832–2838. Where that paper lists two spin states, the
 *   low-spin radius is stored (Mn 139, Fe 132, Co 126), which is the first of the two.
 * - ionizationKjMol: first ionization energy in kJ/mol from the NIST Atomic Spectra Database
 *   ground-level ionization energies, converted with 1 eV = 96.485 kJ/mol and rounded to
 *   0.1 kJ/mol (the compilation published as the Wikipedia table "Ionization energies of
 *   the elements").
 * - electronegativity: Pauling electronegativity from Allred, "Electronegativity values from
 *   thermochemical data", Journal of Inorganic and Nuclear Chemistry 17 (1961) 215–221,
 *   the revision of Pauling's scale taught in CK-12 (fluorine is 3.98). Allred assigned no
 *   value to He, Ne or Ar; those three entries are the spectroscopic electronegativities of
 *   Allen, Journal of the American Chemical Society 111 (1989) 9003–9014 (He 4.16, Ne 4.79,
 *   Ar 3.24). Those three atoms are never used in an electronegativity ranking.
 *
 * Rankings in the chapter 6 module use only subsets whose order matches the trend that is
 * taught. Noble gases are left out of radius and electronegativity rankings. The ionization
 * pairs Be/B, N/O, Mg/Al and P/S disagree with a smooth rise across a period and are left
 * out of ionization rankings.
 */

export interface ElementTrend {
  z: number
  /** Single-bond covalent radius, picometres. */
  radiusPm: number
  /** First ionization energy, kJ/mol. */
  ionizationKjMol: number
  /** Pauling electronegativity (He, Ne and Ar: Allen; see the file header). */
  electronegativity: number
}

/** Z = 1 (H) through 56 (Ba), in order, every element present. No missing column. */
export const TRENDS: readonly ElementTrend[] = [
  { z: 1, radiusPm: 31, ionizationKjMol: 1312.0, electronegativity: 2.2 },
  { z: 2, radiusPm: 28, ionizationKjMol: 2372.3, electronegativity: 4.16 },
  { z: 3, radiusPm: 128, ionizationKjMol: 520.2, electronegativity: 0.98 },
  { z: 4, radiusPm: 96, ionizationKjMol: 899.5, electronegativity: 1.57 },
  { z: 5, radiusPm: 84, ionizationKjMol: 800.6, electronegativity: 2.04 },
  { z: 6, radiusPm: 76, ionizationKjMol: 1086.5, electronegativity: 2.55 },
  { z: 7, radiusPm: 71, ionizationKjMol: 1402.3, electronegativity: 3.04 },
  { z: 8, radiusPm: 66, ionizationKjMol: 1313.9, electronegativity: 3.44 },
  { z: 9, radiusPm: 57, ionizationKjMol: 1681.0, electronegativity: 3.98 },
  { z: 10, radiusPm: 58, ionizationKjMol: 2080.7, electronegativity: 4.79 },
  { z: 11, radiusPm: 166, ionizationKjMol: 495.8, electronegativity: 0.93 },
  { z: 12, radiusPm: 141, ionizationKjMol: 737.7, electronegativity: 1.31 },
  { z: 13, radiusPm: 121, ionizationKjMol: 577.5, electronegativity: 1.61 },
  { z: 14, radiusPm: 111, ionizationKjMol: 786.5, electronegativity: 1.9 },
  { z: 15, radiusPm: 107, ionizationKjMol: 1011.8, electronegativity: 2.19 },
  { z: 16, radiusPm: 105, ionizationKjMol: 999.6, electronegativity: 2.58 },
  { z: 17, radiusPm: 102, ionizationKjMol: 1251.2, electronegativity: 3.16 },
  { z: 18, radiusPm: 106, ionizationKjMol: 1520.6, electronegativity: 3.24 },
  { z: 19, radiusPm: 203, ionizationKjMol: 418.8, electronegativity: 0.82 },
  { z: 20, radiusPm: 176, ionizationKjMol: 589.8, electronegativity: 1.0 },
  { z: 21, radiusPm: 170, ionizationKjMol: 633.1, electronegativity: 1.36 },
  { z: 22, radiusPm: 160, ionizationKjMol: 658.8, electronegativity: 1.54 },
  { z: 23, radiusPm: 153, ionizationKjMol: 650.9, electronegativity: 1.63 },
  { z: 24, radiusPm: 139, ionizationKjMol: 652.9, electronegativity: 1.66 },
  { z: 25, radiusPm: 139, ionizationKjMol: 717.3, electronegativity: 1.55 },
  { z: 26, radiusPm: 132, ionizationKjMol: 762.5, electronegativity: 1.83 },
  { z: 27, radiusPm: 126, ionizationKjMol: 760.4, electronegativity: 1.88 },
  { z: 28, radiusPm: 124, ionizationKjMol: 737.1, electronegativity: 1.91 },
  { z: 29, radiusPm: 132, ionizationKjMol: 745.5, electronegativity: 1.9 },
  { z: 30, radiusPm: 122, ionizationKjMol: 906.4, electronegativity: 1.65 },
  { z: 31, radiusPm: 122, ionizationKjMol: 578.8, electronegativity: 1.81 },
  { z: 32, radiusPm: 120, ionizationKjMol: 762.2, electronegativity: 2.01 },
  { z: 33, radiusPm: 119, ionizationKjMol: 947.0, electronegativity: 2.18 },
  { z: 34, radiusPm: 120, ionizationKjMol: 941.0, electronegativity: 2.55 },
  { z: 35, radiusPm: 120, ionizationKjMol: 1139.9, electronegativity: 2.96 },
  { z: 36, radiusPm: 116, ionizationKjMol: 1350.8, electronegativity: 3.0 },
  { z: 37, radiusPm: 220, ionizationKjMol: 403.0, electronegativity: 0.82 },
  { z: 38, radiusPm: 195, ionizationKjMol: 549.5, electronegativity: 0.95 },
  { z: 39, radiusPm: 190, ionizationKjMol: 599.9, electronegativity: 1.22 },
  { z: 40, radiusPm: 175, ionizationKjMol: 640.1, electronegativity: 1.33 },
  { z: 41, radiusPm: 164, ionizationKjMol: 652.1, electronegativity: 1.6 },
  { z: 42, radiusPm: 154, ionizationKjMol: 684.3, electronegativity: 2.16 },
  { z: 43, radiusPm: 147, ionizationKjMol: 702.4, electronegativity: 1.9 },
  { z: 44, radiusPm: 146, ionizationKjMol: 710.2, electronegativity: 2.2 },
  { z: 45, radiusPm: 142, ionizationKjMol: 719.7, electronegativity: 2.28 },
  { z: 46, radiusPm: 139, ionizationKjMol: 804.4, electronegativity: 2.2 },
  { z: 47, radiusPm: 145, ionizationKjMol: 731.0, electronegativity: 1.93 },
  { z: 48, radiusPm: 144, ionizationKjMol: 867.8, electronegativity: 1.69 },
  { z: 49, radiusPm: 142, ionizationKjMol: 558.3, electronegativity: 1.78 },
  { z: 50, radiusPm: 139, ionizationKjMol: 708.6, electronegativity: 1.96 },
  { z: 51, radiusPm: 139, ionizationKjMol: 834.0, electronegativity: 2.05 },
  { z: 52, radiusPm: 138, ionizationKjMol: 869.3, electronegativity: 2.1 },
  { z: 53, radiusPm: 139, ionizationKjMol: 1008.4, electronegativity: 2.66 },
  { z: 54, radiusPm: 140, ionizationKjMol: 1170.4, electronegativity: 2.6 },
  { z: 55, radiusPm: 244, ionizationKjMol: 375.7, electronegativity: 0.79 },
  { z: 56, radiusPm: 215, ionizationKjMol: 502.9, electronegativity: 0.89 },
]

const BY_Z = new Map<number, ElementTrend>(TRENDS.map((row) => [row.z, row]))

/** The trend row for atomic number `z`, or undefined outside 1–56. */
export function trendByZ(z: number): ElementTrend | undefined {
  return BY_Z.get(z)
}
