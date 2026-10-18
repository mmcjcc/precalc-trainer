# Chemical nomenclature core (CK-12 ch. 7): engine API and progress log

Engine core only (Claude, 2026-10-18, branch `chemistry-ch7-core`, working copy `C:\work\chem7`). Templates, screens,
rule cards, Home registration and the content wording around the graders are the next builder's job. Everything lives
in `src/engine/nomenclature/`; the public API is `src/engine/nomenclature/index.ts`, re-exported from `@/engine`
(`export * from './nomenclature'` at the end of `src/engine/index.ts`). Nothing is committed.

**Status:** complete. `node node_modules/vitest/vitest.mjs run src/engine/nomenclature` → 10 files, 605 tests green.
`npm run typecheck` clean (all three configs). Whole suite (4 workers): 185 files, 3,614 tests, all green (§8).

## 1. Conventions (read first)

- **The model.** Ions, and four kinds of compound built from them by CK-12's chapter 7 rules.
  - *Monatomic ions* come only from `commonCharges` in `src/engine/chem/elements.ts`: every metal's positive charges
    (Li⁺ … Fe³⁺, Fe²⁺, Cu²⁺, Cu⁺, Pb²⁺, Pb⁴⁺, Ag⁺, Zn²⁺ …) and H⁻, N³⁻, O²⁻, F⁻, P³⁻, S²⁻, Cl⁻, Br⁻, I⁻. H⁺ is left out
    (it appears only in acids) and mercury's 1+ is the polyatomic ion Hg₂²⁺, mercury(I), never a lone Hg⁺.
  - *Polyatomic ions* are the rows of `POLYATOMIC_IONS` (`data.ts`): CK-12's "Common Polyatomic Ions" table plus the
    brief's additions (§4.1). 80 ions in all: 36 cations, 44 anions.
  - *Compounds*: **ionic** (a cation and an anion, 1,494 pairs), **binary molecular** (two of 15 nonmetals, counts 1
    to 10: 9,701 compounds), **acids** (6 binary, 26 oxyacids), **hydrogen compounds** (HF, HCl, HBr, HI, H₂S, HCN not
    in water: molecular), **hydrates** (an ionic compound with 1 to 10 waters). Anything else is outside the model.
- **Three kinds of text** (as in the earlier cores). *App text* is what she types and what the readers read back:
  `Fe2(SO4)3`, `CuSO4·5H2O`, `HCl(aq)`, ions `SO4^2-`, `Fe^3+`, names `iron(III) sulfate`. *Display text* is for
  sentences: `Fe₂(SO₄)₃`, `CuSO₄·5H₂O`, `SO₄²⁻`. *LaTeX* is for KaTeX: `\mathrm{Fe_2(SO_4)_3}`,
  `\mathrm{CuSO_4\cdot 5H_2O}`, `\mathrm{SO_4^{2-}}`. Fields named `text` are app text; `message`, `witness` and every
  explanation step are display text. Names are the same in app and display text.
- **An ion as templates give it** (`IonLike`): an `NmIon`, its formula with the charge in any accepted writing
  (`'Fe3+'`, `'SO4 2-'`, `'SO4^2-'`, `'SO₄²⁻'`), or its name (`'sulfate'`, `'iron(III)'`).
- **Case matters in formulas.** Co is cobalt, CO is carbon monoxide. A capital-letter problem is `invalid` with reason
  `'case'` and a position, never fixed silently. Names are compared without case.
- **Graders** return `NmGrade` (the econfig/logs shape, with `pattern` like the logs core):

```ts
type NmGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: NmMistakeId; pattern: PatternHit; witness: string }   // named, about HER answer
  | { verdict: 'wrong'; message: string }                                               // plain, never the answer
  | { verdict: 'invalid'; reason: 'unreadable' | 'case' | 'not_in_form'; message: string; position?: number; length?: number }
  | { verdict: 'unsupported'; message: string }                                         // the PROBLEM is outside the model
```

  `invalid` is not an attempt: show the message, do not count it. `'unreadable'` cannot be read; `'case'` is a
  capital-letter problem; `'not_in_form'` is readable but not the asked form (a formula where a name is asked or the
  reverse, an Arabic numeral for a charge, a Roman numeral with no parentheses, a classical name, an ion with no
  charge, a subscript or water count of 1 written out, a number in front, extra parentheses, a Roman numeral inside a
  formula, a right acid name without the word acid); a right name with a misspelled element is `'unreadable'` with a
  spelling note. `unsupported` is a template bug: call `nomenclatureProblem` (§2.4) so it never reaches her.
- **Named mistakes are ErrorPatternIds** with the prefix `nm_` (32 of them, `NM_MISTAKE_IDS`), already registered in
  `src/shared/types.ts` with catalog entries in `src/engine/matchers/catalog.ts`; `grade.pattern` is a ready
  `PatternHit` (catalog entry + witness) to record.
- **Exactly what the slip produces.** A named mistake fires only when her answer IS what that slip gives for this
  problem: every slip is a finite list of variants generated from the problem (`nameSlips.ts`, `formulaSlips.ts`),
  compared after the accepted-spelling normalization. A few formula mistakes are also properties of her formula (the
  charges do not balance, a balanced multiple, an ion with the right elements and other counts, a wrong water count, an
  ion's wrong charge: §3, "rule"). The right answers are checked first, so no slip ever fires on a right answer
  (property-tested).
- **Witness sentences** name her mistake and the rule, about her answer; they never print the finished answer (a
  property test checks every candidate of every compound). The `explain…` functions reveal everything.
- **Candidates.** Each `…Mistakes` function lists what each slip produces for the problem, in the graders' priority
  order: `{ id, text, witness, shadows }`. Every candidate differs from the answer and grades as its own id (the list
  is built by grading); two slips that give the same text are one candidate, the later id in `shadows`.
- **Throwing.** Graders and `…Mistakes` never throw (a problem outside the model is `unsupported` / `null`). Getters
  (`nameOfFormula`, `formulaOfName`, `ionicFormula`, `classOfFormula`, `romanNumeralOf`, `cationChargeOf`, `nmIon`) and
  the `explain…` functions throw `RangeError` for a problem outside the model (a template bug).
- Deterministic. A grade takes well under a millisecond; a candidate list a few milliseconds.

## 2. API reference

All exported from `@/engine`. Types and field comments: `src/engine/nomenclature/types.ts`.

### 2.1 Ions and data

`NmIon = { text, formula, otherFormulas, charge, role: 'cation' | 'anion', kind: 'monatomic' | 'polyatomic', name,
otherNames, symbol, metalName, numeral, numeralOptional, inTextbook }`.
```ts
ionByFormula('SO4 2-')   // { text: 'SO4^2-', formula: 'SO4', charge: -2, role: 'anion', kind: 'polyatomic', name: 'sulfate', inTextbook: true, … }
ionByName('iron(III)')   // { text: 'Fe^3+', formula: 'Fe', charge: 3, name: 'iron(III)', symbol: 'Fe', metalName: 'iron', numeral: 3, … }
ionByName('bicarbonate').formula   // 'HCO3'      ionByName('sulphate ion').formula   // 'SO4'
ionByFormula('C2H3O2-').name       // 'acetate'   (CH3COO-, C2H3O2-, CH3CO2- all read)
ionByFormula('Hg2 2+').name        // 'mercury(I)' (otherNames: dimercury, dimercury(I))
ionByFormula('Ni2+')               // name 'nickel(II)', numeralOptional: true, otherNames ['nickel']
resolveIon('iron(II)')             // Fe²⁺ (formula or name; null outside the model)    nmIon(…) throws instead
ionDisplay(ionByName('sulfate')!)  // 'SO₄²⁻'     ionLatex(…) // '\mathrm{SO_4^{2-}}'
```
Lists: `nmIons()` (80), `nmCations()` (36), `nmAnions()` (44), `ionicCations()` (the cations a compound can have:
all but H₃O⁺). Tables: `POLYATOMIC_IONS` (`PolyatomicIonInfo = { name, formula, charge, otherFormulas, otherNames,
inTextbook }`), `NUMERAL_METALS` (`['Cr', 'Mn', 'Fe', 'Co', 'Cu', 'Sn', 'Au', 'Hg', 'Pb']`), `OPTIONAL_NUMERAL_METALS`
(`['Ni']`), `IDE_NAMES`, `GREEK_PREFIXES`, `MOLECULAR_ELEMENTS` (the written order, §4.5), `COMMON_NAMES` (water,
ammonia, methane), `COMMON_MOLECULAR_FORMULAS` (68 real binary molecular compounds), `COMMON_HYDRATES` (18).

### 2.2 Readers

`readChemicalFormula(text): FormulaParse` — a compound's formula: `{ parts, waters, state, text }` or an error
`{ reason, message, position, length? }`. `parts` keep her order and parentheses (`FormulaPart` = element with count, or
group with parts and count); `text` is her formula tidied.
```ts
readChemicalFormula('CuSO4 * 5 H2O').value.text   // 'CuSO4·5H2O'   (· • ∙ ⋅ * . all work; spaces ignored)
readChemicalFormula('Fe₂O₃').value.text           // 'Fe2O3'
readChemicalFormula('CaNO3 2').value.text         // 'CaNO32'       (digits after a space continue the count)
readChemicalFormula('HCl (AQ)').value.text        // 'HCl(aq)'      ((aq), (s), (l), (g))
readChemicalFormula('NaCL')   // error case: 'CL reads as C and L, and no element has the symbol L. Each element symbol starts with a capital letter, and a second letter is lowercase (Co is cobalt; CO is carbon and oxygen).' position 3
readChemicalFormula('nacl')   // error case, position 0          readChemicalFormula('Xy2')   // unreadable: 'No element has the symbol Xy.'
readChemicalFormula('2NaCl')  // not_in_form: 'A number in front counts formula units in an equation. Write the formula of one unit, with no number in front.'
readChemicalFormula('Na1Cl')  // not_in_form: 'A subscript of 1 is never written: …'
readChemicalFormula('Fe(III)Cl3') // not_in_form: 'A Roman numeral goes only in the name. …'
readChemicalFormula('Na+Cl-') // not_in_form: 'A compound’s formula has no charges in it: …'
```
Other errors: brackets `[ ]`, a parenthesis never closed or never opened, empty parentheses, 0 as a subscript, a
malformed water part, `h2o`.

`readIonFormula(text): IonParse` — an ion with its charge: a list of readings `{ parts, charge, text }` (charge
`null` when none was written). A charge typed straight after an ASCII subscript is ambiguous and gives two readings,
the last digit as the charge first; the graders pick the one that is an ion.
```ts
readIonFormula('SO4 2-')   // ['SO4^2-']        also SO4^2-, SO4^(2-), SO4^{2-}, SO4-2, SO₄²⁻, SO₄2-
readIonFormula('SO42-')    // ['SO4^2-', 'SO42^-']
readIonFormula('NO3-')     // ['NO^3-', 'NO3^-']
readIonFormula('Fe3+')     // ['Fe^3+', 'Fe3^+']   also Fe^3+, Fe 3+, Fe+3, Fe³⁺
readIonFormula('Mg++')     // ['Mg^2+']
```

`readChemicalName(text): NameParse` — `{ key, words }` or an error. Names are compared by key; `chemicalNameKey(text)`
gives the key alone (§4.3 lists what it unifies).
```ts
readChemicalName('Iron (III) Sulphate')   // { key: 'iron(iii) sulfate', words: ['iron(iii)', 'sulfate'] }
readChemicalName('iron(3) chloride')      // not_in_form: 'Write the charge as a Roman numeral in parentheses, right after the metal: (III), not (3).' position 5
readChemicalName('iron III chloride')     // not_in_form: 'Put the Roman numeral in parentheses, right after the metal: (III).'
readChemicalName('ferrous oxide')         // not_in_form: '“ferrous” is the older name for iron(II). This class uses the Stock system: the metal’s name with its charge as a Roman numeral in parentheses.'
readChemicalName('copper(II) sulfate 5 hydrate')   // not_in_form: 'A name is written in words: use a Greek prefix for the number of water molecules, like penta- for 5.'
```
Text helpers: `formulaDisplay('Fe2(SO4)3')` → `'Fe₂(SO₄)₃'`, `formulaLatex('P4O10')` → `'\mathrm{P_4O_{10}}'` (also
ions: `formulaLatex('Fe^3+')` → `'\mathrm{Fe^{3+}}'`), `romanNumeral(3)` → `'III'`, `romanValue('iv')` → 4,
`greekPrefix(5)` → `'penta'`.

### 2.3 Compounds

```ts
type Compound =
  | { kind: 'ionic'; cation: NmIon; cationCount: number; anion: NmIon; anionCount: number }
  | { kind: 'molecular'; first: string; firstCount: number; second: string; secondCount: number }   // symbols
  | { kind: 'hydrogen'; anion: NmIon; hydrogenCount: number }        // HCl not in water
  | { kind: 'acid'; anion: NmIon; hydrogenCount: number; binary: boolean }
  | { kind: 'hydrate'; salt: IonicCompound; waters: number }
```
`compoundOfFormula(text, options?)`, `compoundOfName(text)` — the compound or null; `readCompoundFormula` /
`readCompoundName` give `{ ok: true, compound } | { ok: false, message }` with the reason. `options.inWater`: the
problem says the compound is in water (HCl then reads as the acid).

`compoundFormula(c)` (canonical app text), `compoundName(c)` (canonical name), `compoundClass(c)` (`'ionic' |
'molecular' | 'acid' | 'hydrate'`; a hydrogen compound is molecular), `acceptedFormulas(c)` (every right formula text,
no state), `acceptedNameKeys(c)` (every right name, as keys), `systematicName(c)` (water → `'dihydrogen monoxide'`).
```ts
ionicCompound(ionByFormula('Fe3+')!, ionByName('sulfate')!)   // { kind: 'ionic', cationCount: 2, anionCount: 3, … }
balancedCounts(3, -2)            // [2, 3]          balancedCounts(4, -2)   // [1, 2]
compoundFormula(…)               // 'Fe2(SO4)3'     compoundName(…)         // 'iron(III) sulfate'
acceptedFormulas(compoundOfName('calcium acetate')!)   // ['Ca(CH3COO)2', 'Ca(C2H3O2)2', 'Ca(CH3CO2)2']
acceptedNameKeys(compoundOfFormula('NiCl2')!)          // ['nickel(ii) chloride', 'nickel chloride']
oxyacidName('sulfite')           // 'sulfurous acid'    binaryAcidName(ionByFormula('Br-')!)   // 'hydrobromic acid'
molecularCompound('N', 2, 'O', 5)   // throws RangeError outside the model; molecularProblem(…) gives the reason
```
Lists for templates and tests: `ionicCompounds()` (1,494), `acidCompounds()` (32), `hydrogenCompounds()` (6),
`molecularPairs()` (97), `molecularCompounds()` (9,701), `hydrateCompound(salt, waters)`, `ionPairProblem(cation,
anion)` (why two NmIons make no compound of the model).

### 2.4 Validator and getters

`nomenclatureProblem(problem, question, options?): string | null` — **the validator for the content stage**: why the
problem does not suit the question, or null. `question`: `'name'` and `'classify'` take a formula, `'formula'` a name,
`'ion_name'` an ion's formula, `'ion_formula'` an ion's name. Call it on every generated problem.
```ts
nomenclatureProblem('Fe2(SO4)3', 'name')          // null
nomenclatureProblem('MnO2', 'name')               // 'MnO₂ would need Mn⁴⁺, and the taught charges of manganese are 2+ and 3+.'
nomenclatureProblem('V2O5', 'name')               // 'Vanadium has no ion taught in this course, so V₂O₅ is outside the model.'
nomenclatureProblem('Cd(NO3)2', 'name')           // 'Cadmium has no ion taught in this course, so Cd(NO₃)₂ is outside the model.'
nomenclatureProblem('Mg2O2', 'name')              // 'Mg₂O₂ is not written in the lowest whole-number ratio.'
nomenclatureProblem('iron(IV) chloride', 'formula')   // '“iron(IV) chloride” is outside the model: check the Roman numeral against the taught charges of iron.'
nomenclatureProblem('SO4', 'ion_name')            // 'SO4 is not the formula of an ion in the model (write it with its charge, like SO4^2-).'
ionicPairProblem('Fe2+', 'O2 2-')                 // 'The model pairs peroxide only with the metals of groups 1 and 2 (like K₂O₂ and BaO₂).'
```
Getters (throw `RangeError` outside the model):
```ts
nameOfFormula('Fe2O3')                      // 'iron(III) oxide'
nameOfFormula('HCl')                        // 'hydrogen chloride'      nameOfFormula('HCl', { inWater: true })   // 'hydrochloric acid'
formulaOfName('Iron (III) Sulphate')        // 'Fe2(SO4)3'              formulaOfName('hydrochloric acid')         // 'HCl(aq)'
ionicFormula('Hg2 2+', 'Cl-')               // 'Hg2Cl2'                 ionicFormula('NH4+', 'PO4 3-')             // '(NH4)3PO4'
classOfFormula('NH4NO3')                    // 'ionic'                  classOfFormula('HCl(aq)')                  // 'acid'
romanNumeralOf('Cu2O')                      // 'I'   (FeCl3 'III', PbO2 'IV', Hg2Cl2 'I', NaCl null)
cationChargeOf('PbO2')                      // 4     (Hg2Cl2 → 2: the whole Hg₂²⁺ ion)
```

### 2.5 Graders

Order of the checks in every grader: the problem (→ `unsupported`), her text (→ `invalid`), every right way of writing
it (→ `correct`), the slips' variants in priority order (→ `mistake`), for formulas the three structural rules
(→ `mistake`), else `wrong`.

**`gradeNameFromFormula(formula, herName, options?: { inWater?: boolean })`** — she names a compound given as a formula.
```ts
gradeNameFromFormula('FeCl3', 'iron(III) chloride')   // correct: 'Correct: FeCl₃ is iron(III) chloride.'
gradeNameFromFormula('FeCl3', 'Iron (iii)chloride')   // correct (case, spaces)
gradeNameFromFormula('NiCl2', 'nickel chloride')
// correct: 'Correct: NiCl₂ is nickel chloride. The textbook writes nickel(II) chloride: nickel forms only Ni²⁺ at this level, so both are right.'
gradeNameFromFormula('FeCl3', 'iron chloride')
// nm_numeral_missing: 'Iron chloride does not say which iron ion is in FeCl₃. Iron forms more than one ion (Fe²⁺ and Fe³⁺), so the name needs the charge of one iron ion as a Roman numeral.'
gradeNameFromFormula('FeCl3', 'iron(II) chloride')
// nm_numeral_wrong: '(II) is the other charge iron can have. In FeCl₃, three chloride ions carry 3− in all, balanced by one iron ion.'
gradeNameFromFormula('Fe2O3', 'iron(II) oxide')
// nm_numeral_wrong: '(II) matches the subscript of Fe in Fe₂O₃, but a subscript counts ions; it is not the charge. The charge comes from the anions: three oxide ions carry 6− in all, balanced by two iron ions.'
gradeNameFromFormula('PbO2', 'lead(II) oxide')
// nm_numeral_wrong: '(II) is the subscript of oxide, not the charge of lead. Each oxide ion is 2−, so two oxide ions carry 4− in all, balanced by one lead ion.'
gradeNameFromFormula('MgCl2', 'magnesium dichloride')
// nm_prefix_on_ionic: 'Your name counts the ions with Greek prefixes (di-). MgCl₂ is ionic, and ionic names never use prefixes: the charges already fix how many of each ion there are.'
gradeNameFromFormula('NaCl', 'sodium(I) chloride')
// nm_numeral_on_fixed: 'Sodium forms only one ion, Na⁺, so its name never takes a Roman numeral. The numeral is only for metals with more than one charge.'
gradeNameFromFormula('Na2SO4', 'sodium sulfide')
// nm_ide_for_polyatomic: 'Sulfide is S²⁻, an ion of a single atom. Na₂SO₄ contains the polyatomic ion SO₄²⁻, which has its own name in the table: -ide is for one-atom anions.'
gradeNameFromFormula('Na2SO4', 'sodium sulfite')
// nm_ate_ite_swapped: 'Sulfite is SO₃²⁻, with one oxygen fewer than the ion in Na₂SO₄, SO₄²⁻. The ion with more oxygen ends in -ate; the one with fewer ends in -ite.'
gradeNameFromFormula('N2O5', 'nitrogen oxide')
// nm_prefix_missing: 'Your name leaves out both prefixes. Two nonmetals can combine in more than one ratio, so a molecular name gives the second element a prefix every time, and the first one whenever there is more than one atom of it.'
gradeNameFromFormula('S2Cl2', 'sulfur monochloride')
// nm_molecular_reduced: 'Sulfur monochloride is the name of SCl, the formula reduced to its lowest ratio. A molecular formula counts the atoms in one molecule and is never reduced: name the atoms that S₂Cl₂ has.'
gradeNameFromFormula('HCl(aq)', 'chloric acid')
// nm_hydro_missing: 'Chloric acid would be an acid with oxygen in it, named from an -ate ion. HCl(aq) is hydrogen and one other element, with no oxygen: a binary acid’s name starts with hydro-.'
gradeNameFromFormula('H2SO4', 'sulfurous acid')
// nm_ic_ous_swapped: '-ous acids come from -ite ions. H₂SO₄ contains sulfate, an -ate ion, so its acid’s name ends the other way.'
gradeNameFromFormula('CuSO4·5H2O', 'copper(II) sulfate tetrahydrate')
// nm_hydrate_count_wrong: 'Tetrahydrate means 4 water molecules, but CuSO₄·5H₂O has a different number after the dot. Count the H₂O and use its Greek prefix.'
gradeNameFromFormula('NaCl', 'potassium chloride')   // wrong: 'The anion part is right, but the cation is not the one in NaCl.'
gradeNameFromFormula('H2SO4', 'sulfuric')            // invalid not_in_form: 'An acid’s name ends with the word acid.'
gradeNameFromFormula('PCl5', 'phosphorous pentachloride')   // invalid unreadable: 'Check the spelling: the element is spelled phosphorus; …'
gradeNameFromFormula('FeCl3', 'FeCl3')               // invalid not_in_form: 'This question asks for the name, written in words. You typed a formula.'
gradeNameFromFormula('FeCl3', 'ferric chloride')     // invalid not_in_form (classical name, see readChemicalName)
gradeNameFromFormula('MnO2', 'manganese(IV) oxide')  // unsupported: 'MnO₂ would need Mn⁴⁺, …'
gradeNameFromFormula('HCl', 'hydrochloric acid')
// correct: 'Correct: dissolved in water, HCl is hydrochloric acid. Written without (aq), it is the pure compound, hydrogen chloride.'
```

**`gradeFormulaFromName(name, herFormula)`** — she writes the formula of a named compound.
```ts
gradeFormulaFromName('iron(III) sulfate', 'Fe2(SO4)3')   // correct: 'Correct: iron(III) sulfate is Fe₂(SO₄)₃.'  (also Fe₂(SO₄)₃, 'Fe2 (SO4) 3')
gradeFormulaFromName('hydrochloric acid', 'HCl')         // correct (HCl(aq) too); 'HCl(g)' is invalid: (g) is the pure compound
gradeFormulaFromName('calcium acetate', 'Ca(C2H3O2)2')   // correct (CH3COO, C2H3O2, CH3CO2 all accepted)
gradeFormulaFromName('sodium chloride', 'NaCl2')
// nm_charges_unbalanced: 'In your formula, one Na⁺ gives 1+ and two Cl⁻ give 2−: the total is 1−, not zero. A compound has no overall charge.'
gradeFormulaFromName('magnesium oxide', 'Mg2O2')
// nm_not_lowest_ratio: 'Your formula balances the charges, but both subscripts can be divided by 2. An ionic formula gives the lowest whole-number ratio of the ions.'
gradeFormulaFromName('calcium nitrate', 'CaNO3 2')      // (also 'CaNO32', 'CaN2O6')
// nm_parentheses_missing: 'Without parentheses, the 2 after NO₃ counts only its last atom, O. To show two nitrate ions, the whole ion goes in parentheses with the 2 outside.'
gradeFormulaFromName('aluminum oxide', 'Al3O2')
// nm_crisscross_reversed: 'Your formula gives each ion its own charge as its subscript: three Al³⁺ make 9+ and two O²⁻ make 4−, which do not cancel. In the criss-cross, each charge becomes the subscript of the OTHER ion.'
gradeFormulaFromName('iron(III) chloride', 'Fe3Cl')
// nm_numeral_as_subscript: 'Your formula turns the (III) into a subscript. The Roman numeral is the charge of one iron ion, 3+, not the number of iron atoms: balance that charge with chloride ions to find the subscripts.'
gradeFormulaFromName('iron(III) chloride', 'FeCl2')
// nm_numeral_wrong: 'Your formula balances Fe²⁺, the iron ion of iron(II) chloride. The Roman numeral in iron(III) chloride, (III), gives the charge of each iron ion.'
gradeFormulaFromName('mercury(I) chloride', 'HgCl')
// nm_unit_ion_reduced: 'Your formula splits mercury(I) into single Hg atoms and reduces them. Mercury(I) is the ion Hg₂²⁺: two mercury atoms that stay together, so the 2 inside it is never divided out.'
gradeFormulaFromName('sodium nitrate', 'NaNO2')
// nm_polyatomic_formula_wrong: 'NO₂ is nitrite, not nitrate. -ate has one more oxygen than -ite. Each polyatomic ion has its own formula in the table.'
gradeFormulaFromName('sulfuric acid', 'H2SO3')
// nm_polyatomic_formula_wrong: 'H₂SO₃ is sulfurous acid, made from sulfite. Sulfuric acid is made from sulfate: an -ic acid comes from an -ate ion and an -ous acid from an -ite ion.'
gradeFormulaFromName('hydrochloric acid', 'HClO3')
// nm_hydro_on_oxyacid: 'HClO₃ is chloric acid, an acid with oxygen in it. The hydro- in hydrochloric acid means there is no oxygen: just hydrogen and one other element.'
gradeFormulaFromName('disulfur dichloride', 'SCl')      // nm_molecular_reduced
gradeFormulaFromName('dinitrogen pentoxide', 'NO')      // nm_prefix_missing ('N2O', 'NO5' too)
gradeFormulaFromName('copper(II) sulfate pentahydrate', 'CuSO4')   // nm_hydrate_count_wrong: 'Your formula leaves out the water. …'
gradeFormulaFromName('sodium chloride', 'KCl')
// wrong: 'Your formula is not sodium chloride. KCl is potassium chloride. Find each ion’s formula and charge, then balance the charges.'
gradeFormulaFromName('cobalt(II) chloride', 'COCl2')
// invalid case: 'Check the capital letters. Each symbol starts with a capital letter and its second letter is lowercase: Co is cobalt, but CO is carbon and oxygen.' position 1
gradeFormulaFromName('calcium chloride', 'Ca(Cl)2')     // invalid not_in_form: 'Parentheses go around a polyatomic ion only when …'
gradeFormulaFromName('sodium chloride', 'sodium chloride')   // invalid not_in_form: 'This question asks for the formula: …'
```

**`gradeIonicFormula(cation, anion, herFormula)`** — the formula of two given ions (`IonLike` each). The same checks,
without the slips that need a name (numeral as subscript, numeral wrong, -ide, hydrogen part).
```ts
gradeIonicFormula('Fe3+', 'SO4 2-', 'Fe2(SO4)3')   // correct: 'Correct: Fe³⁺ and SO₄²⁻ make Fe₂(SO₄)₃.'
gradeIonicFormula('Pb4+', 'O2-', 'Pb2O4')          // nm_not_lowest_ratio (the criss-cross not reduced)
gradeIonicFormula('Fe3+', 'Cl-', 'Fe3Cl')          // nm_crisscross_reversed
gradeIonicFormula('Fe2+', 'O2 2-', 'FeO2')         // unsupported (peroxide: groups 1 and 2 only)
```

**`gradeIonName(ion, herName)`** — she names a single ion given by its formula. "sulfate ion" counts as "sulfate".
```ts
gradeIonName('SO4 2-', 'sulfate')     // correct        gradeIonName('Hg2 2+', 'dimercury')   // correct
gradeIonName('SO4 2-', 'sulfite')
// nm_ate_ite_swapped: 'Sulfite is SO₃²⁻, with one oxygen fewer than SO₄²⁻. The ion with more oxygen ends in -ate; the one with fewer ends in -ite.'
gradeIonName('Fe3+', 'iron')
// nm_numeral_missing: 'Iron forms more than one ion (Fe²⁺ and Fe³⁺), so the name of Fe³⁺ needs its charge as a Roman numeral.'
gradeIonName('Cl-', 'chlorine')       // nm_element_name_for_anion
gradeIonName('O2 2-', 'oxide')        // nm_unit_ion_reduced
gradeIonName('SO4 2-', 'SO4 2-')      // invalid not_in_form (a formula)
```

**`gradeIonFormula(ion, herFormula)`** — she writes a single ion (given by name) with its charge.
```ts
gradeIonFormula('sulfate', 'SO42-')   // correct (SO4 2-, SO4^2-, SO₄²⁻, SO4-2 …)
gradeIonFormula('nitrate', 'NO2-')    // nm_polyatomic_formula_wrong: 'NO₂ is nitrite, not nitrate. -ate has one more oxygen than -ite.'
gradeIonFormula('sulfate', 'SO4-')
// nm_ion_charge_wrong: 'Your ion has a 1− charge, but sulfate has a different one: an ion’s charge comes with its formula in the table.'
gradeIonFormula('iron(III)', 'Fe2+')  // nm_ion_charge_wrong: '… but the Roman numeral in iron(III) is the charge itself.'
gradeIonFormula('mercury(I)', 'Hg+')
// nm_unit_ion_reduced: 'Your ion is a single mercury atom. Mercury(I) is two mercury atoms that stay together as one ion and share a 2+ charge.'
gradeIonFormula('sulfate', 'S2-')     // nm_ide_for_polyatomic
gradeIonFormula('sulfate', 'SO4')     // invalid not_in_form: 'An ion’s formula includes its charge: write it after the formula, with ^ or as a superscript.'
gradeIonFormula('sulfate', 'so4 2-')  // invalid case
```

**`gradeClassify(formula, herPick, options?)`** — `herPick`: `'ionic'`, `'molecular'`, `'acid'`, `'hydrate'` (also
`'ionic compound'`, `'molecular compound'`, `'covalent'`, `'binary molecular'`, `'an acid'`, `'a hydrate'`; any case).
```ts
gradeClassify('NaCl', 'ionic')          // correct: 'Correct: NaCl is an ionic compound: it is made of ions, Na⁺ and Cl⁻.'
gradeClassify('NH4Cl', 'molecular')
// nm_class_ammonium_molecular: 'NH₄Cl has no metal, but NH₄⁺ is a polyatomic cation: a compound made of ions is ionic even when every element in it is a nonmetal.'
gradeClassify('CuSO4·5H2O', 'ionic')
// nm_class_hydrate_ignored: 'CuSO₄·5H₂O is an ionic compound with water in its crystals: the ·5H₂O part makes it a hydrate.'
gradeClassify('HCl(aq)', 'molecular')   // nm_class_acid_ignored
gradeClassify('HCl', 'acid')            // correct: 'Correct: dissolved in water, HCl is an acid. Written without (aq), it is a molecular compound.'
gradeClassify('NaCl', 'molecular')
// wrong: 'NaCl is not a molecular compound. Look at what it is made of: a metal ion or NH₄⁺ makes it ionic, two nonmetals make it molecular, H with an anion in water makes it an acid, and water after a dot makes it a hydrate.'
gradeClassify('NaCl', 'salt')           // invalid unreadable: 'Pick one: ionic, molecular, acid or hydrate.'
```

### 2.6 What each slip produces (`…Mistakes`)

`nameFromFormulaMistakes(formula, options?)`, `formulaFromNameMistakes(name)`, `ionicFormulaMistakes(cation, anion)`,
`ionNameMistakes(ion)`, `ionFormulaMistakes(ion)`, `classifyMistakes(formula, options?)` → `NmMistakeCandidate[]`
(`{ id, text, witness, shadows }`), or null outside the model.
```ts
nameFromFormulaMistakes('FeCl3').map(c => [c.id, c.text])
// [['nm_anion_first', 'chloride iron(III)'], ['nm_prefix_on_ionic', 'iron(III) trichloride'], ['nm_numeral_missing', 'iron chloride'],
//  ['nm_numeral_wrong', 'iron(II) chloride'], ['nm_element_name_for_anion', 'iron(III) chlorine']]
nameFromFormulaMistakes('H2SO4').map(c => [c.id, c.text])
// [['nm_acid_named_as_salt', 'hydrogen sulfate'], ['nm_hydro_on_oxyacid', 'hydrosulfuric acid'], ['nm_ic_ous_swapped', 'sulfurous acid'],
//  ['nm_acid_root', 'sulfic acid'], ['nm_acid_anion_ending', 'sulfate acid']]
nameFromFormulaMistakes('HClO3').map(c => c.text)
// ['hydrogen chlorate', 'hydrochloric acid', 'chlorous acid', 'perchloric acid', 'chlorate acid']
nameFromFormulaMistakes('N2O5').map(c => [c.id, c.text])
// [['nm_prefix_missing', 'nitrogen pentoxide'], ['nm_element_name_for_anion', 'dinitrogen pentoxygen'], ['nm_stock_on_molecular', 'nitrogen(V) oxide']]
formulaFromNameMistakes('calcium nitrate').map(c => [c.id, c.text])
// [['nm_anion_first', '(NO3)2Ca'], ['nm_parentheses_missing', 'CaNO32'], ['nm_ide_for_polyatomic', 'Ca3N2'], ['nm_polyatomic_formula_wrong', 'Ca(NO2)2'],
//  ['nm_crisscross_reversed', 'Ca2NO3'], ['nm_not_lowest_ratio', 'Ca2(NO3)4'], ['nm_charges_unbalanced', 'CaNO3']]
formulaFromNameMistakes('iron(III) chloride').map(c => [c.id, c.text, c.shadows])
// [['nm_anion_first', 'Cl3Fe', []], ['nm_numeral_as_subscript', 'Fe3Cl', ['nm_crisscross_reversed']], ['nm_numeral_wrong', 'FeCl2', []],
//  ['nm_not_lowest_ratio', 'Fe2Cl6', []], ['nm_charges_unbalanced', 'FeCl', []]]
formulaFromNameMistakes('mercury(I) chloride').map(c => c.text)   // ['Cl2Hg2', 'HgCl', 'HgCl2', '(Hg2)2Cl', '(Hg2)2Cl4', 'Hg2Cl']
formulaFromNameMistakes('copper(II) sulfate pentahydrate')[0]      // { id: 'nm_hydrate_count_wrong', text: 'CuSO4·4H2O', … }
ionicFormulaMistakes('Al3+', 'O2-').map(c => c.text)              // ['O3Al2', 'Al3O2', 'Al4O6', 'AlO']
ionNameMistakes('ClO3-').map(c => [c.id, c.text])                 // [['nm_ide_for_polyatomic', 'chloride'], ['nm_ate_ite_swapped', 'chlorite'], ['nm_per_hypo_wrong', 'perchlorate']]
ionFormulaMistakes('sulfate').map(c => c.text)                    // ['S^2-', 'HSO4^-', 'SO3^2-', 'SO4^-']
classifyMistakes('NH4NO3').map(c => [c.id, c.text])                // [['nm_class_ammonium_molecular', 'molecular']]
```
A slip appears in a list with ONE representative text, but the grader names every variant of it (all ten wrong
numerals, every prefix combination, every wrong water count, `CaNO32` / `CaNO3 2` / `CaN2O6` …).

### 2.7 Explanations (each REVEALS the answer)

`explainNameFromFormula(formula, options?)`, `explainFormulaFromName(name)`, `explainIonicFormula(cation, anion)`,
`explainIon(ion)`, `explainClassify(formula, options?)` → `NmExplanation = { steps: string[]; answer: string;
formulaLatex: string }`.
```ts
explainNameFromFormula('Fe2(SO4)3')
// steps: ['Fe₂(SO₄)₃ is an ionic compound: the metal ion Fe³⁺ and the polyatomic anion SO₄²⁻, sulfate.',
//   'Three sulfate ions carry 3 × (2−) = 6−. Two iron ions balance that, so each is 6+ ÷ 2 = 3+: Fe³⁺.',
//   'Iron forms more than one ion (Fe²⁺ and Fe³⁺), so the name gives this one’s charge as a Roman numeral: iron(III).',
//   'A polyatomic ion keeps its name from the table: SO₄²⁻ is sulfate.',
//   'Name the cation first, then the anion, with no prefixes: iron(III) sulfate.']
// answer: 'iron(III) sulfate', formulaLatex: '\mathrm{Fe_2(SO_4)_3}'
explainNameFromFormula('N2O5').steps
// ['N₂O₅ is a binary molecular compound: two nonmetals, nitrogen and oxygen, sharing electrons. Its name counts the atoms with Greek prefixes.',
//  'Two nitrogen atoms: di-, so dinitrogen.',
//  'Five oxygen atoms: penta- and the ending -ide, so pentoxide (the final a of penta- is dropped before oxide).',
//  'Name: dinitrogen pentoxide.']
explainFormulaFromName('lead(IV) oxide').steps
// ['Lead(IV) oxide is an ionic compound: the cation lead(IV) and the anion oxide.', 'The (IV) in lead(IV) is the charge of one lead ion: Pb⁴⁺.',
//  'Oxide is O²⁻, from its place in group 16.', 'Balance the charges with the lowest whole numbers: 1 × (4+) = 4+ and 2 × (2−) = 4−, which add up to zero.',
//  '(The criss-cross gives Pb₂O₄; divide both by 2 for the lowest ratio.)', 'Formula: PbO₂.']
explainIonicFormula('NH4+', 'PO4 3-').steps
// ['The cation is NH₄⁺ and the anion is PO₄³⁻.', 'Balance the charges with the lowest whole numbers: 3 × (1+) = 3+ and 1 × (3−) = 3−, which add up to zero.',
//  'There are three ammonium ions, so NH₄ goes in parentheses with the 3 outside.', 'Cation first, then anion: (NH₄)₃PO₄.']
explainNameFromFormula('HClO').steps
// ['HClO is hydrogen with the polyatomic anion ClO⁻, hypochlorite: an acid with oxygen in it (an oxyacid).', 'One H⁺ balances the 1− charge of ClO⁻.',
//  'Hypochlorite ends in -ite, so the acid ends in -ous, with no hydro-: hypochlorous acid.']
explainClassify('HCl(aq)')   // { steps: ['Water after a dot? No.', 'H first, with an anion, in water? Yes: HCl(aq) is an acid.'], answer: 'an acid', … }
```

## 3. Mistake ids, how each is detected, and a sample

"Variants" are generated from the problem and compared after normalization; "rule" is a property of her formula.

| id | the slip | where it fires | how it is detected | example (problem → her answer) |
|---|---|---|---|---|
| `nm_charges_unbalanced` | the charges do not add up to zero | formula from name, from ions; acids (H count) | rule: the right two ions, cation first, unbalanced | sodium chloride → NaCl₂; calcium chloride → CaCl; sulfuric acid → HSO₄ |
| `nm_not_lowest_ratio` | balanced, not reduced (the criss-cross not reduced) | formula from name, from ions | rule: the right ions, both counts × k ≥ 2 | magnesium oxide → Mg₂O₂; lead(IV) oxide → Pb₂O₄; NaCl → Na₂Cl₂ |
| `nm_parentheses_missing` | a repeated polyatomic ion without parentheses, or multiplied out | formula from name, from ions | variants: parentheses dropped (each subset of the ions), or the ion's atoms multiplied | calcium nitrate → CaNO₃₂, `CaNO3 2`, CaN₂O₆; ammonium sulfate → NH₄₂SO₄ |
| `nm_crisscross_reversed` | each ion given its own charge as its subscript | formula from name, from ions | variant (only when it does not balance) | aluminum oxide → Al₃O₂; calcium chloride → Ca₂Cl |
| `nm_numeral_as_subscript` | the Roman numeral written as the metal's subscript | formula from name | variant: symbol + numeral + the anion once (numeral ≥ II) | iron(III) chloride → Fe₃Cl; lead(IV) oxide → Pb₄O |
| `nm_unit_ion_reduced` | Hg₂²⁺ or O₂²⁻ split or reduced; peroxide named oxide | formula from name, from ions; name; ion name/formula | variants | mercury(I) chloride → HgCl; potassium peroxide → KO; K₂O₂ → potassium oxide; mercury(I) → Hg⁺ |
| `nm_polyatomic_formula_wrong` | a polyatomic ion written with the wrong atoms (its -ite/-ate partner, a per-/hypo- neighbour, any other count) | formula from name (salts and acids); ion formula | variants (partner, neighbour, one O fewer, NH₃) + rule: the same elements in the same order, other counts, right cation and counts | sodium nitrate → NaNO₂; nitrate → NO₂⁻; sulfate → SO₃²⁻; calcium carbonate → CaCO₂; sulfuric acid → H₂SO₃ |
| `nm_anion_first` | the anion first (name or formula; an acid's H last) | all but classify | variant: the two ions swapped, counts kept | ClNa; (NO₃)₂Ca; SO₄H₂; chloride sodium; carbon dioxide → O₂C |
| `nm_prefix_on_ionic` | Greek prefixes on an ionic compound | name | variants: a prefix on the cation, the anion or both, matching the counts (with or without the numeral) | MgCl₂ → magnesium dichloride; FeCl₃ → iron trichloride; Ca(NO₃)₂ → calcium dinitrate |
| `nm_numeral_missing` | no numeral for a metal with more than one charge | name, ion name | variant | FeCl₃ → iron chloride; Fe³⁺ → iron |
| `nm_numeral_wrong` | the wrong numeral: a subscript read as the charge, the anion's subscript, the metal's other charge | name, ion name; formula from name (the other charge's formula) | variants: every numeral I to X but the right one, each with its reason | FeCl₃ → iron(II) chloride; Fe₂O₃ → iron(II) oxide; FeCl₂ → iron(I) chloride; iron(III) chloride → FeCl₂ |
| `nm_numeral_on_fixed` | a numeral on a one-charge cation | name, ion name | variants: I to X | NaCl → sodium(I) chloride; ZnCl₂ → zinc(II) chloride; NH₄Cl → ammonium(I) chloride |
| `nm_ide_for_polyatomic` | -ide for a polyatomic ion (or its one-atom ion in a formula) | name, ion name; formula from name, ion formula | variants: the central element's -ide (hydrogen part kept) | Na₂SO₄ → sodium sulfide; KClO₃ → potassium chloride; sodium sulfate → Na₂S; sulfate → S²⁻ |
| `nm_ate_ite_swapped` | -ate and -ite exchanged | name, ion name | variant: the partner in the table | Na₂SO₄ → sodium sulfite; NO₃⁻ → nitrite |
| `nm_per_hypo_wrong` | per- or hypo- left off or added | name, ion name, acid name | variants: the table neighbours | NaClO₄ → sodium chlorate; ClO⁻ → chlorite; HClO₄ → chloric acid |
| `nm_element_name_for_anion` | the element's name for the anion (or the second element) | name, ion name | variant | NaCl → sodium chlorine; NO₂ → nitrogen dioxygen; Cl⁻ → chlorine |
| `nm_hydrogen_prefix_wrong` | the hydrogen part of an anion's name wrong | name, ion name, formula from name, ion formula | variants: the other members of the family (carbonate, sulfate, sulfite, phosphate, sulfide) | NaHCO₃ → sodium carbonate; KH₂PO₄ → potassium hydrogen phosphate; sodium hydrogen carbonate → Na₂CO₃ |
| `nm_prefix_missing` | prefixes left off a molecular compound | name, formula from name | variants: any of the prefixes dropped (subscripts set to 1) | N₂O₅ → nitrogen oxide, nitrogen pentoxide, dinitrogen oxide; CO → carbon oxide; dinitrogen pentoxide → NO |
| `nm_mono_on_first` | mono- on the first element | name | variant | CO → monocarbon monoxide |
| `nm_molecular_reduced` | a molecular formula reduced (or named reduced) | name, formula from name | variant (when the counts share a factor) | disulfur dichloride → SCl; N₂O₄ → nitrogen dioxide |
| `nm_stock_on_molecular` | a Roman numeral on a molecular compound | name | variants: I to X | N₂O₅ → nitrogen(V) oxide; CO₂ → carbon(IV) oxide |
| `nm_hydro_on_oxyacid` | hydro- on an oxyacid; an oxyacid's formula for a hydro- name | acid name; acid formula | variants | H₂SO₄ → hydrosulfuric acid; HClO₃ → hydrochloric acid; hydrochloric acid → HClO₃ |
| `nm_hydro_missing` | hydro- left off a binary acid; a binary acid's formula for an -ic name | acid name; acid formula | variants | HCl(aq) → chloric acid; H₂S(aq) → sulfuric acid; chloric acid → HCl |
| `nm_ic_ous_swapped` | -ic and -ous exchanged | acid name | variant | H₂SO₄ → sulfurous acid; HNO₂ → nitric acid |
| `nm_acid_root` | sulf-/phosph- for sulfur-/phosphor- | acid name | variant | H₂SO₄ → sulfic acid; H₃PO₄ → phosphic acid; H₂S(aq) → hydrosulfic acid |
| `nm_acid_named_as_salt` | an acid named as a hydrogen compound | acid name | variants (with and without prefixes on hydrogen) | HCl(aq) → hydrogen chloride; H₂SO₄ → hydrogen sulfate, dihydrogen sulfate |
| `nm_acid_anion_ending` | the ion's ending kept in an acid's name | acid name | variants | H₂SO₄ → sulfate acid; HCl(aq) → hydrochloride acid |
| `nm_hydrate_count_wrong` | the wrong water count or prefix, or the water left out | name, formula from name | variants (names: every other prefix, "hydrate", none) + rule (formulas: the right salt, any other count or none) | CuSO₄·5H₂O → copper(II) sulfate tetrahydrate, … hydrate, copper(II) sulfate; → CuSO₄·4H₂O, CuSO₄ |
| `nm_ion_charge_wrong` | the right ion with the wrong charge | ion formula | variant + rule: the ion's formula with any other charge | sulfate → SO₄⁻; phosphate → PO₄²⁻; iron(III) → Fe²⁺ |
| `nm_class_ammonium_molecular` | an ammonium compound called molecular | classify | the pick | NH₄Cl → molecular |
| `nm_class_hydrate_ignored` | a hydrate called ionic | classify | the pick | CuSO₄·5H₂O → ionic |
| `nm_class_acid_ignored` | an acid called molecular or ionic | classify | the pick | HCl(aq) → molecular; H₂SO₄ → ionic |

Priority when two slips give the same answer (the earlier id names it, the later is in `shadows`): formulas — anion
first, unit ion, parentheses, numeral as subscript, numeral wrong, -ide, hydrogen part, polyatomic formula,
criss-cross reversed, not lowest, unbalanced, then the rules; names — anion first, prefixes, numeral on fixed,
numeral missing, numeral wrong, element name, -ide, -ate/-ite, per-/hypo-, hydrogen part, peroxide. Example: Fe₃Cl for
iron(III) chloride is `nm_numeral_as_subscript` (shadowing `nm_crisscross_reversed`); for the ions Fe³⁺ and Cl⁻ (no
name given) it is `nm_crisscross_reversed`.

Plain `wrong` (no id): another cation or anion ("The anion part is right, but the cation is not the one in NaCl."),
wrong prefixes on a molecular name (dinitrogen tetroxide for N₂O₅), two slips at once (CaNO₃₃), another compound
(KCl for sodium chloride: "KCl is potassium chloride."), a wrong class pick with no named slip. A right name with the
word acid missing, or with a misspelled element (phosphorous, flouride, sulfer, cloride), is `invalid` instead: her
chemistry is right, and the only useful message would give the answer away.

## 4. Decisions

### 4.1 The data source

- **One named source:** CK-12 Chemistry - Intermediate, chapter 7, lesson "Polyatomic Ions", table "Common Polyatomic
  Ions" (mirrored as LibreTexts "Introductory Chemistry (CK-12)", section 7.9, Table 7.9.1; read 2026-10-18), written
  in the header of `data.ts`. Rows from it carry `inTextbook: true`: acetate (CH₃COO⁻, also read as C₂H₃O₂⁻ and
  CH₃CO₂⁻), bromate, chlorate, chlorite, cyanide, dihydrogen phosphate, hydrogen carbonate (bicarbonate), hydrogen
  sulfate (bisulfate), hydrogen sulfide, hydroxide, hypochlorite, nitrate, nitrite, perchlorate, permanganate,
  carbonate, chromate, dichromate, hydrogen phosphate, oxalate, peroxide, silicate, sulfate, sulfite, phosphate,
  phosphite, ammonium, and Hg₂²⁺ (printed there as "dimercury"; named mercury(I) as CK-12's Table 7.5.1 and lesson 7.10
  do; both names are accepted).
- **Additions** (`inTextbook: false`), required by the brief: hydronium, thiocyanate, hydrogen sulfite (bisulfite),
  and the bromine and iodine families (perbromate, bromite, hypobromite, periodate, iodate, iodite, hypoiodite), which
  the lesson's own per-/-ate/-ite/hypo- rule gives.
- **Left out:** arsenate. The table prints it as AsO₃³⁻, a misprint (arsenate is AsO₄³⁻, AsO₃³⁻ is arsenite); either
  choice would mark a student wrong who learned the other one.
- Monatomic ions come only from `elements.ts` `commonCharges` (§1). The anion names (-ide) and the binary-acid roots
  are in `data.ts`.

### 4.2 Roman numerals

- A metal takes a numeral when `elements.ts` lists more than one positive charge for it: **Cr, Mn, Fe, Co, Cu, Sn, Au,
  Hg, Pb** (`NUMERAL_METALS`).
- **Nickel** has one taught charge (Ni²⁺), but CK-12 writes "nickel (II)" (Table 7.5.1, and the exercise "nickel (II)
  hydroxide"). Its numeral is printed and **both nickel(II) and plain nickel are right**; a wrong numeral on nickel is
  `nm_numeral_wrong`.
- **Silver, zinc, aluminum and the group 1 and 2 metals** have one charge and never take a numeral: sodium(I),
  zinc(II), silver(I) are `nm_numeral_on_fixed` (so is ammonium(I)).
- **Cadmium** has no taught charge in `elements.ts` (`commonCharges: []`), so cadmium compounds are outside the model,
  although CK-12 lists Cd²⁺ and asks for Cd(NO₃)₂ (exercise 7.10 4c). I did not change `elements.ts`: the chapter 6
  module reads its charges for ion and isoelectronic-series questions (Ag⁺, Cd²⁺ and Sn⁴⁺ would form a new series).
  Adding `[2]` to cadmium there brings it in here with no numeral, no other change needed (§7).
- **Mercury(I)** is Hg₂²⁺: Hg₂Cl₂ is not reduced, and HgCl for it is `nm_unit_ion_reduced`. Its numeral (I) is the
  charge of each mercury atom.
- The numeral is read with parentheses, with or without a space before them (CK-12 prints "copper (I) oxide"), in any
  case. **iron(3) and iron(3+) are `invalid`** ("Write the charge as a Roman numeral … (III), not (3)"), and so is a
  numeral without parentheses (iron III chloride). Not an attempt: she is told the convention without being marked.
- **Classical names** (ferric, ferrous, cupric, cuprous, stannic, stannous, plumbic, plumbous, auric, aurous, mercuric,
  mercurous, cobaltic, cobaltous, chromic, chromous, manganic, manganous, nickelous) are `invalid`, with a note naming
  the Stock equivalent and saying the class uses the Stock system (CK-12 ch. 7 teaches only the Stock system).
  "chromic acid" is an acid name and is read normally.

### 4.3 Accepted spellings (one key each, never a mistake)

Case and spacing (`iron (III)`, `iron(III)chloride`, `Iron(iii) Chloride`); aluminium, sulphur/sulphate/sulphide/
sulphite/sulphuric/sulphurous, caesium; vowel elision either way before a vowel (monoxide/monooxide, pentoxide/
pentaoxide, tetroxide/tetraoxide, heptoxide/heptaoxide, tetraiodide/tetriodide, tetraarsenic/tetrarsenic); bicarbonate,
bisulfate, bisulfite; hydriodic for hydroiodic; ethanoate, ethanoic; dimercury, dimercury(I); the IUPAC one-word
hydrogencarbonate, hydrogensulfate, hydrogensulfite, hydrogensulfide, hydrogenphosphate, dihydrogenphosphate; hyphens
inside words (mono-oxide, penta-hydrate); a space before hydrate (penta hydrate); "ion" after an ion's name. Printed
names drop the a/o only before oxide (CK-12's spelling: monoxide, tetroxide, heptoxide), and keep triiodide, tetraiodide.
Formulas: ASCII or Unicode subscripts, spaces anywhere between units, the dot as · • ∙ ⋅ * or '.', a state after the
formula, acetate's three formulas, acetic acid as CH₃COOH, CH₃CO₂H, HC₂H₃O₂ or HCH₃COO, and for an acid named
hydro-…-ic, the formula with or without (aq).

### 4.4 Acids and hydrogen compounds

- An **oxyacid** (H with an -ate or -ite ion) is an acid with or without (aq): H₂SO₄ is sulfuric acid.
- **Hydrogen with F, Cl, Br, I, S or CN** is a binary acid when the formula has (aq) or the problem passes
  `{ inWater: true }`; otherwise it is the molecular compound hydrogen chloride (no prefixes; the strict prefix forms,
  hydrogen monochloride, dihydrogen monosulfide …, are accepted). For a bare HCl the acid name is ALSO accepted
  ("Correct: dissolved in water, HCl is hydrochloric acid. Written without (aq), …"), because CK-12 lesson 7.12 calls
  HCl hydrochloric acid without (aq); in a classify question bare HCl accepts molecular and acid.
- Acid formulas put H first; only acetic acid may be written CH₃COOH. Hydronium salts are not in the model (H₃O⁺ is an
  ion question only). Hydrogen ions (hydrogen carbonate …) do not form acids of their own.

### 4.5 Molecular compounds

- 15 elements, written in this order (the IUPAC sequence for these elements; CK-12's list C, P, N, H, S, I, Br, Cl,
  O, F is in the same order): B, Si, C, As, P, N, H, Te, Se, S, I, Br, Cl, O, F. So CO₂, NH₃, Cl₂O₇, OF₂, B₄H₁₀, PCl₅. A
  formula in another order (OCl₂) is outside the model.
- Counts 1 to 10 (mono- to deca-); formulas are never reduced. Hydrogen-first compounds other than water and the six
  hydrogen compounds of §4.4 are outside (H₂Se, H₂O₂). H₂O, NH₃ and CH₄ are named water, ammonia, methane; dihydrogen
  monoxide, nitrogen trihydride and carbon tetrahydride are accepted.

### 4.6 Ionic compounds

- Every compound cation with every anion, except: peroxide and hydride pair only with the metals of groups 1 and 2
  (K₂O₂, BaO₂, NaH, CaH₂). Otherwise MnO₂ would read as "manganese(II) peroxide" and PbO₂ and SnO₂ would have two
  readings; with the rule MnO₂ is outside the model (Mn⁴⁺ is not taught) and PbO₂ is lead(IV) oxide.
- A problem formula must be balanced, in the lowest ratio, with parentheses exactly where the textbook puts them.
  Her formula with right chemistry but extra parentheses (Ca(Cl)₂, Na(NO₃)) is `invalid` not_in_form.

### 4.7 Mistake ids by direction

In NAMES, -ate/-ite, per-/hypo- and -ic/-ous have their own ids. In FORMULAS any polyatomic ion written with the wrong
atoms (its partner, a per-/hypo- neighbour or any other count) is `nm_polyatomic_formula_wrong` (the brief's "NO₂ for
nitrate"), with a witness that names the confusion ("NO₂ is nitrite, not nitrate. -ate has one more oxygen than -ite").
The structural rules (unbalanced, not lowest, polyatomic formula) are exact properties of her formula, not
"closeness": the right ions, cation first, and her counts do not balance; or balance as a multiple; or her ion has the
right elements in the right order with other numbers.

### 4.8 Outside the model (unsupported)

Metals without a taught charge (V, Pd, Pt, Cd, Ti …: CK-12 7.8 asks for PdO, PtCl₄ and V₂O₅), untaught charges (Fe⁴⁺,
Mn⁴⁺), hydronium salts, peroxides and hydrides of other cations, ions not in the table (arsenate, thiosulfate, azide,
cyanate …), organic compounds other than acetic acid and methane, elements (O₂), molecular compounds with more than two
elements or more than ten atoms of one element, hydrates of non-ionic compounds or with more than ten waters.

## 5. Notes for the content stage

- **Ids are registered.** The 32 nm_ ids are ErrorPatternIds with catalog entries; record `grade.pattern` as it is.
- **Validate every generated problem** with `nomenclatureProblem(problem, question, options)` (and
  `ionicPairProblem(cation, anion)` for two-ion problems). Draw problems from the lists so nothing outside the model
  is produced: `ionicCompounds()`, `COMMON_MOLECULAR_FORMULAS` (real compounds; `molecularCompounds()` names every pair
  and count, most of them not real), `acidCompounds()`, `COMMON_HYDRATES` or `hydrateCompound(salt, n)`, `nmIons()`.
- **Prefer the textbook's ions:** `ion.inTextbook` marks the ions CK-12 prints. `ionicCompounds()` pairs everything
  with everything, so it includes compounds nobody makes ((NH₄)₂O, Fr compounds, gold(I) chromate …); a template
  should pick from a curated cation list (group 1 and 2 metals, Al, Zn, Ag, NH₄⁺, and Fe, Cu, Pb, Sn, Co, Cr, Mn, Hg
  for numerals) and the textbook anions.
- **Good traps** (check that the candidate list contains the id a template promises):
  - Roman numerals: Fe₂O₃, Cu₂O, PbO₂, SnO₂, CuO, FeCl₃, CoCl₂ (`nm_numeral_wrong` with a subscript reason;
    `nm_numeral_missing`); NaCl, ZnCl₂, AgNO₃, Al₂O₃ for `nm_numeral_on_fixed`; Hg₂Cl₂ for mercury(I).
  - Charge balance: unequal charges (Al₂O₃, Ca₃N₂, Mg₃(PO₄)₂) for `nm_crisscross_reversed` and
    `nm_charges_unbalanced`; charges that share a factor (MgO, CaSO₄, PbO₂, SnO₂) for `nm_not_lowest_ratio`, whose
    candidate is then the unreduced criss-cross (Mg₂O₂, Ca₂(SO₄)₂, Pb₂O₄, Sn₂O₄); for other compounds its candidate
    is the formula doubled.
  - Parentheses: a polyatomic ion with a count above 1 (Ca(NO₃)₂, (NH₄)₂SO₄, Fe₂(SO₄)₃, Al(OH)₃).
  - Polyatomic names: sulfate/sulfite, nitrate/nitrite, phosphate/phosphite, the chlorine family, the hydrogen ions.
    `nm_ide_for_polyatomic` is most natural for sulfate, nitrate, phosphate and the chlorates; for carbonate and
    silicate its text ("carbide", "silicide") is unusual.
  - Molecular: N₂O₅, N₂O₄, P₄O₁₀, S₂Cl₂, CO, NO, CO₂, CCl₄, As₂O₅, Cl₂O₇; `nm_molecular_reduced` needs counts with a
    common factor (N₂O₄, S₂Cl₂, P₄O₁₀); `nm_mono_on_first` needs one atom of the first element.
  - Acids: H₂SO₄, H₂SO₃, HNO₃, HNO₂, H₃PO₄, HClO₃/HClO₄/HClO₂/HClO, HCl(aq), H₂S(aq), HCN(aq).
  - Hydrates: CuSO₄·5H₂O, Na₂CO₃·10H₂O, MgSO₄·7H₂O, CoCl₂·6H₂O.
  - Classify: NH₄Cl and NH₄NO₃ (the ammonium trap), hydrates, HCl(aq) and H₂SO₄.
- **Problems to avoid:** bare binary hydrogen compounds (HCl, H₂S) in a classify or naming question unless the point is
  "not in water" (pass `{ inWater: true }` when the prompt says "acid" or "in water"); 1:1 compounds for the
  parentheses or criss-cross traps (there are none); peroxides and hydrides with any formula trap except
  `nm_unit_ion_reduced`; radioactive metals (Fr, Ra); Hg²⁺ vs Hg₂²⁺ unless the prompt is about mercury.
- **The catalog's example lines use CK-12 compounds.** If a problem IS the example (calcium nitrate for
  `nm_parentheses_missing`), the example shows its answer: show the witness and the lesson, and hide the example line
  for that problem.
- **Self-tests per seed:** `nomenclatureProblem(p, q, opts) === null`; for formula-to-name,
  `gradeNameFromFormula(f, nameOfFormula(f, opts), opts).verdict === 'correct'`; for name-to-formula,
  `gradeFormulaFromName(n, formulaOfName(n)).verdict === 'correct'`; for two ions,
  `gradeIonicFormula(a, b, ionicFormula(a, b))`; for ions, `gradeIonName(ion.text, ion.name)` and
  `gradeIonFormula(ion.name, ion.text)`; for classify, `gradeClassify(f, classOfFormula(f))`; and when a template
  promises a trap, its id is in the `…Mistakes` list for that problem.
- **Input.** Formulas: a symbol strip with subscripts ₂ ₃ ₄, the middle dot ·, ⁺ ⁻ and ², ³ helps on the phone; ASCII
  works everywhere (`CuSO4*5H2O`, `SO4^2-`). Show her text back through `formulaDisplay`, and the problem through
  `formulaLatex` in KaTeX. Ion answers need a charge; `Fe3+`, `SO42-`, `NO3-` all read the textbook way.
- **Showing a grade.** `invalid` → show the message under the input (position/length point into her text) and do not
  count it; `mistake` → `pattern.title`, `pattern.lesson`, the witness; `wrong` → the message; the `explain…` steps
  only as the last hint rung or after the problem is done.

## 6. Layering

`src/engine/nomenclature` imports `@/shared/types` (types only), `../chem/elements`, and `../matchers/catalog`
(`patternHit`); the tests also use `../samples` (`mulberry32`). Nothing from notation, content or ui. Outside the
folder: the export line at the end of `src/engine/index.ts`, 32 additive ErrorPatternIds in `src/shared/types.ts`, and
32 catalog entries in `src/engine/matchers/catalog.ts`. No other file was touched.

## 7. Open items for the reviewer

- **Cadmium** (CK-12 Table 7.5.1 and exercise Cd(NO₃)₂) needs `commonCharges: [2]` in `elements.ts`, which also
  changes the chapter 6 module's ion questions (§4.2). Pd, Pt and V (exercise 7.8: PdO, PtCl₄, V₂O₅) have no taught
  charges either; giving them charges would put them in both modules.
- **Arsenate** is out because of the CK-12 misprint (§4.1).
- **Bare HCl** is lenient by design (acid name and acid class accepted). If her teacher insists on "hydrogen chloride"
  for the gas, drop the acid keys in `rightNameKeys` (grade.ts) and the extra class in `gradeClassify`.
- **No base class.** NaOH classifies as ionic (CK-12 7.13 calls bases ionic compounds); a 'base' pick is `invalid`.
- Organic names beyond methane and acetic acid, and hydronium salts, are outside the model.

## 8. Files changed and test runs

New: `src/engine/nomenclature/` — `types.ts`, `data.ts` (the ion table and the naming tables), `text.ts`, `formula.ts`
(formula and ion readers), `names.ts` (name reader and keys), `ions.ts` (the ion model and the relations the slips
use), `compounds.ts` (building, names, formulas, lists), `read.ts` (formula or name → compound, with reasons; the
ionic segmentation), `nameSlips.ts`, `formulaSlips.ts` (what each slip produces; the structural rules), `grade.ts`
(the six graders and their candidate lists), `explain.ts`, `index.ts` (API, validator, getters); tests `data`,
`formula`, `names`, `compounds`, `grade.names`, `grade.formulas`, `explain`, `catalog`, `nomenclature.anchor`,
`property`. Changed: `src/engine/index.ts` (one export line), `src/shared/types.ts` (32 ids, additive),
`src/engine/matchers/catalog.ts` (32 entries); this document.

Test runs (2026-10-18, Git Bash, `C:\work\chem7`):
- `node node_modules/vitest/vitest.mjs run src/engine/nomenclature` → 10 files, 605 tests, about 25 s: data 10, formula
  51, names 31, compounds 126, grade.names 98, grade.formulas 81, explain 5, catalog 2, nomenclature.anchor 191 (116
  hand-worked formula ⟷ name pairs, 14 ion pairs, 9 numerals, 9 classes, 17 single ions, 24 of the brief's own mistake examples),
  property 10 (seeded loops, 120 s timeout each: every ionic compound, acid, hydrogen compound and molecular compound
  round-trips; every candidate of every ionic compound, acid, hydrogen compound, ion, 291 molecular compounds and 150
  hydrates grades as its own id without printing the answer; 4,000 right answers written every accepted way; 3,000
  random strings through every grader; 2,000 ionic formulas with random counts against a charge-balance oracle).
- `npm run typecheck` → exit 0 (all three configs), after the last source change.
- Whole suite, `node node_modules/vitest/vitest.mjs run --maxWorkers=4` → 185 files, 3,614 tests, all passed, 453 s
  (before this build: 175 files, 3,009 tests). The box was at 100% CPU from other programs and other sessions' test
  runs; an earlier run with the default 11 workers had one failure outside this folder,
  `src/engine/logs/property.test.ts` "300 equations …" timing out at its own 120 s limit (it imports nothing from
  `@/engine` or this folder, and alone it passes: 102 s for that loop today). With four workers the whole suite is
  green.

## Log

- [done] read the brief's files and CK-12 ch. 7 (LibreTexts mirror: lessons 7.3 to 7.13 and their review questions).
- [done] data, readers, the ion and compound model, the slips, graders, explanations, the API, the ids and catalog.
- [done] tests; the smoke runs found and fixed: MnO₂ read as a peroxide (peroxide and hydride now groups 1 and 2), a
  reason message for MnO₂ that blamed the balance, a witness that printed Hg₂²⁺ for the mercury(I) ion question, spaces
  inside "H2 O", and candidate grading that rebuilt the slip lists each time (now shared: the property file went from
  34 s to 17 s).
