# Chemistry chapter 6 — the periodic table

Working log for the uncommitted chapter 6 module (`periodic`) on branch `chemistry-ch6`.

## Data

`src/engine/chem/trends.ts`, Z 1–56, columns `radiusPm`, `ionizationKjMol`, `electronegativity`.

- Radius: Cordero et al., Dalton Trans. 2008, 2832 (single-bond covalent radii, pm; low-spin where two values are listed).
- First ionization energy: NIST Atomic Spectra Database, eV × 96.485, rounded to 0.1 kJ/mol.
- Electronegativity: Allred, J. Inorg. Nucl. Chem. 17 (1961) 215 (Pauling scale). He, Ne and Ar are Allen, J. Am. Chem. Soc. 111 (1989) 9003, because Allred left them blank. Those three are never ranked by electronegativity.

## Module

Unit `ch6` in the chemistry course. Module id `periodic` (order 8.5, after electrons). Templates `pt.locate`, `pt.valence`, `pt.trends`, `pt.ions`, `pt.why`. Parts are checked one at a time on the shared hint ladder; entries sit on the attempt and survive a reload. The third hint marks the answer shown.

Rankings are sorted from the table, and only kept when that order is also the order the trend teaches. Noble gases are left out of radius, electronegativity, and metallic-character rankings. Be/B, N/O, Mg/Al and P/S are left out of ionization rankings because the measurements do not rise smoothly.

Named slips are the `pt_` ids in the catalog. A group-1 or group-2 valence question has no named slip, because the answer is the column itself and no element is named. Every other generated problem promises a trap, and that trap grades to its id.

The module registry lists `periodic` after `electrons` and before the geometry modules (twenty-six modules).
