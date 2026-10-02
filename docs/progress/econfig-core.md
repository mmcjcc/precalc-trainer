# Electron configurations core (CK-12 ch. 5) — engine API and progress log

Engine core only (Claude, 2026-10-01). Templates, screens, catalog wording and ErrorPatternId registration are
the next builder's job. Everything lives in `src/engine/econfig/`; the public API is re-exported from
`@/engine` (`src/engine/index.ts`, one named export block at the end of the file). Nothing committed.

**Status:** complete. `node node_modules/vitest/vitest.mjs run src/engine/econfig` → 8 files, 321 tests green
(model 81, parse 23, grade 62, identify 17, valence 38, orbital 82, explain 12, seeded properties 6).
`npm run typecheck` clean for the whole project (all three configs). See "Commands run" at the bottom for the
full suite.

## 1. Conventions (read first)

- **The model.** Elements 1 (H) to 36 (Kr), neutral atoms and the monatomic ions whose charge is in
  `commonCharges` of `src/engine/chem/elements.ts` (27 ions; H⁺ is left out because it has no electrons).
  No configuration is typed into the engine. Each one is derived from three rules (`model.ts`):
  1. the filling order 1s 2s 2p 3s 3p 4s 3d 4p, each subshell filled to its capacity (s 2, p 6, d 10);
  2. chromium and copper move one electron from 4s to 3d: `[Ar] 4s1 3d5`, `[Ar] 4s1 3d10`;
  3. a cation loses electrons from the highest shell number first (so 4s before 3d: Fe²⁺ is `[Ar] 3d6`); an
     anion puts the extra electrons in the next open subshell.
  `model.test.ts` pins all 36 atoms and all 27 ions against tables typed by hand, in full and in shorthand.
- **A species** is `EconfigSpecies = { z, charge }`. Every function also takes text (`'Fe'`, `'Fe3+'`,
  `'Cl-'`, `'O 2-'`, `'Fe³⁺'`) or `{ symbol: 'Fe', charge: 3 }` / `{ z: 26, charge: 3 }`: the
  `EconfigSpeciesLike` type.
- **Three kinds of text.** *App text* is what she types and what the parser reads back: `1s2 2s2 2p6`,
  `[Ar] 4s2 3d6`, a diagram `ud u u`. *Display text* is for sentences, with superscripts and arrows already in
  it: `[Ar] 4s² 3d⁶`, `[↑↓] [↑ ] [↑ ]`. *LaTeX* is for KaTeX: `\mathrm{[Ar]\,4s^{2}\,3d^{6}}`.
  Fields named `text` are app text; `message`, `witness` and every explanation line are display text.
- **Order.** `'filling'` (the default) is 4s before 3d; `'shell'` is 3d before 4s. The order she TYPES in is
  never graded: `4s2 3d6`, `3d6 4s2`, even `3d6 4s2 1s2 …` are the same answer.
- **Graders** return `EconfigGrade`, the same shape as the transformations core:

```ts
type EconfigGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: EconfigMistakeKind; witness: string }   // named, a sentence about HER answer
  | { verdict: 'wrong'; message: string }                                  // wrong, plain specific sentence
  | { verdict: 'invalid'; message: string; position?: number; length?: number } // unreadable or wrong form: not an attempt
  | { verdict: 'unsupported'; message: string }                            // the PROBLEM is outside the model
```

  `invalid` covers a parse error (with a 0-based position into her text) AND an answer in the wrong form
  (shorthand typed where the full configuration was asked, or the reverse): show the message, do not count an
  attempt. `unsupported` is a template bug (or a transition metal in a valence question); call
  `econfigProblem` in the template so it never reaches her.
- **Witness sentences name her mistake and the rule; they do not print the finished answer** (a few come close:
  the exception sentences say "one electron moves from 4s to 3d"). The `explain…` functions reveal everything.
- **Mistake kinds** are a local union `EconfigMistakeKind` (17 kinds, array `ECONFIG_MISTAKE_KINDS`), NOT
  ErrorPatternIds. Several are SHARED between graders (`ion_charge_ignored` is the same habit in a
  configuration, an identification and an unpaired count), so one catalog entry per kind serves every screen.
- **Candidates.** Every `…Mistakes` function returns what each mistake WOULD produce for this problem, in the
  grader's priority order. Each listed candidate differs from the right answer and grades as its own kind
  (the function runs the grader on it and drops any that would not); `witness` is the grader's sentence. Two
  kinds that give the same answer are one candidate with the later kind in `shadows`.
- **Throwing.** Getters, renderers and `explain…` functions throw `RangeError` for a species outside the model
  (a template bug). Graders never throw (they return `unsupported`); parsers never throw.
- Deterministic: no randomness in the core. One grade takes about 0.1 ms.

## 2. API reference

Types (all exported from `@/engine`; definitions and field comments in `src/engine/econfig/types.ts`):
`SubshellLetter`, `Subshell`, `SubshellCount`, `SubshellLike`, `ElectronConfiguration`, `EconfigSpecies`,
`EconfigSpeciesLike`, `EconfigForm`, `EconfigOrder`, `EconfigRenderOptions`, `NobleGasCore`,
`NobleGasShorthand`, `ParsedTerm`, `ParsedCore`, `ParsedConfiguration`, `ConfigurationParse`, `SpeciesAnswer`,
`SpeciesAnswerParse`, `Spin`, `OrbitalBox`, `OrbitalDiagram`, `OrbitalDiagramInfo`, `OrbitalDiagramParse`,
`EconfigMistakeKind`, `EconfigGrade`, `ConfigurationMistakeCandidate`, `CountMistakeCandidate`,
`DiagramMistakeCandidate`, `EconfigQuestion`, `ConfigurationGradeOptions`, `IdentifyOptions`,
`ConfigurationReading`, `DiagramGradeOptions`, `UnpairedGradeOptions`.

### 2.1 Species, the validator, the lists

`econfigProblem(species: EconfigSpeciesLike, question?: EconfigQuestion, subshell?: SubshellLike): string | null`
— **the validator for the content stage**: why this species does not suit this question, or null when it does.
`EconfigQuestion = 'full' | 'shorthand' | 'identify' | 'valence' | 'diagram' | 'unpaired'`. Call it on every
generated problem.
```ts
econfigProblem('Fe3+')                // null
econfigProblem('Fe4+')                // 'Fe⁴⁺ is outside the model: the taught charges of iron are 3+ and 2+.'
econfigProblem('Rb')                  // 'Element 37 (rubidium) is outside the model: hydrogen (1) to krypton (36) only.'
econfigProblem('Sc3+')                // 'Sc³⁺ is outside the model: scandium has no simple ion taught at this level.'
econfigProblem('H+')                  // 'H⁺ has no electrons, so there is no configuration to write.'
econfigProblem('Fe', 'valence')       // 'Iron is a transition metal, and transition metals are out of scope for this question: …'
econfigProblem('Cl-', 'valence')      // 'Valence electrons are asked about neutral atoms only, and Cl⁻ is an ion.'
econfigProblem('He', 'shorthand')     // 'No noble gas comes before helium, so it has no shorthand to write.'
econfigProblem('O', 'diagram', '5s')  // '5s is outside the model: the subshells are 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p.'
```
`speciesProblem(species): string | null` — the species check alone. `valenceProblem(species)` and
`diagramProblem(species, subshell?)` are the per-question parts.

`econfigAtoms(): EconfigSpecies[]` — the 36 neutral atoms. `econfigIons(): EconfigSpecies[]` — the 27 ions
(each element's `commonCharges`, most common first): H⁻, Li⁺, Be²⁺, N³⁻, O²⁻, F⁻, Na⁺, Mg²⁺, Al³⁺, P³⁻, S²⁻,
Cl⁻, K⁺, Ca²⁺, Cr³⁺, Cr²⁺, Mn²⁺, Mn³⁺, Fe³⁺, Fe²⁺, Co²⁺, Co³⁺, Ni²⁺, Cu²⁺, Cu⁺, Zn²⁺, Br⁻.

`econfigSpecies(symbolOrText: string, charge?: number): EconfigSpecies` — a validated species; throws
RangeError outside the model.
```ts
econfigSpecies('Fe', 3)   // { z: 26, charge: 3 }      econfigSpecies('Cl-')   // { z: 17, charge: -1 }
```
`resolveSpecies(species): EconfigSpecies | null` — the reader alone, no validation (`'Fe 3+'`, `'Fe^3+'`,
`'Fe+3'`, `'Fe³⁺'`, `'Cl−'` all read; null when unreadable).

`speciesText(sp)` → `'Fe3+'`, `'Cl-'`, `'Na'` (app text, reads back). `speciesDisplay(sp)` → `'Fe³⁺'`.
`speciesLatex(sp)` → `'\mathrm{Fe}^{3+}'`.

Constants: `ECONFIG_MAX_Z` (36); `FILLING_ORDER` (`Subshell[]`: 1s 2s 2p 3s 3p 4s 3d 4p); `SUBSHELL_CAPACITY`
(`{ s: 2, p: 6, d: 10, f: 14 }`); `SUBSHELL_ORBITALS` (`{ s: 1, p: 3, d: 5, f: 7 }`); `NOBLE_GAS_CORES`
(`[{ symbol: 'He', z: 2 }, Ne 10, Ar 18, Kr 36]`); `EXCEPTION_ELEMENTS` (`[24, 29]`);
`ECONFIG_MISTAKE_KINDS`. `subshellName({ n: 3, l: 'd' })` → `'3d'`.

### 2.2 Configurations and renderers

`electronConfiguration(species, order: EconfigOrder = 'filling'): ElectronConfiguration` — occupied subshells
with counts.
```ts
electronConfiguration('Fe')            // [{n:1,l:'s',count:2}, …, {n:4,l:'s',count:2}, {n:3,l:'d',count:6}]
electronConfiguration('Fe', 'shell')   // … {n:3,l:'d',count:6}, {n:4,l:'s',count:2}
electronConfiguration('Fe3+')          // … {n:3,l:'p',count:6}, {n:3,l:'d',count:5}     (no 4s term)
```
`shellOrder(config)` — the same subshells sorted by shell number. `electronCount(species)` → Z − charge.

`nobleGasShorthand(species, order = 'filling'): { core: NobleGasCore | null; rest: ElectronConfiguration }`
— for a neutral atom the core is the last noble gas BEFORE the element (argon's is [Ne]; hydrogen and helium
have none); for an ion it is the largest noble gas with no more electrons than the ion.
```ts
nobleGasShorthand('Fe')    // { core: { symbol: 'Ar', z: 18 }, rest: [4s2, 3d6] }
nobleGasShorthand('Br-')   // { core: { symbol: 'Kr', z: 36 }, rest: [] }
nobleGasShorthand('He')    // { core: null, rest: [1s2] }
```

`configurationText(species, options?: { form?: 'full' | 'shorthand'; order?: 'filling' | 'shell' }): string`,
`configurationDisplay(…)`, `configurationLatex(…)` — defaults: full form, filling order.
```ts
configurationText('Fe')                                         // '1s2 2s2 2p6 3s2 3p6 4s2 3d6'
configurationText('Fe', { form: 'shorthand' })                  // '[Ar] 4s2 3d6'
configurationText('Fe', { form: 'shorthand', order: 'shell' })  // '[Ar] 3d6 4s2'
configurationText('Cu', { form: 'shorthand' })                  // '[Ar] 4s1 3d10'
configurationText('Fe3+', { form: 'shorthand' })                // '[Ar] 3d5'
configurationText('Na+', { form: 'shorthand' })                 // '[Ne]'
configurationText('He', { form: 'shorthand' })                  // '1s2'   (nothing to abbreviate)
configurationDisplay('Cu', { form: 'shorthand' })               // '[Ar] 4s¹ 3d¹⁰'
configurationLatex('Fe', { form: 'shorthand' })                 // '\mathrm{[Ar]\,4s^{2}\,3d^{6}}'
```
`termsText(config)` / `termsDisplay(config)` / `termsLatex(config)` render any list of subshells in the order
given: `'4s2 3d6'`, `'4s² 3d⁶'`, `'4s^{2}\,3d^{6}'`.

### 2.3 The parser

`parseConfiguration(text: string): { ok: true; value: ParsedConfiguration } | { ok: false; error: ParseError }`
— `ParsedConfiguration = { core: ParsedCore | null; terms: ParsedTerm[] }`; each term has `n`, `l`, `count`,
`position`, `length`, in the order she typed. It accepts: full or shorthand; spaces, commas or semicolons
between subshells, or nothing at all (`1s22s22p6`, `1s²2s²2p⁶`); counts as `2p6`, `2p^6`, `2p^{6}`, `2p⁶`;
either case (`1S2`, `[ar]`); any order. It reads any shell 1 to 9 with s p d f, so `1p6`, `2d1`, `2p7` parse
(naming those is the graders' job). A subshell with count 0 (`4s0`) is dropped.
```ts
parseConfiguration('[Ar] 3d6 4s2')
// { ok: true, value: { core: { symbol: 'Ar', z: 18, nobleGas: true, position: 0, length: 4 },
//     terms: [{ n: 3, l: 'd', count: 6, position: 5, length: 3 }, { n: 4, l: 's', count: 2, position: 9, length: 3 }] } }
parseConfiguration('1s2 2s 2p3')    // error 'Write how many electrons are in 2s, like 2s2.', position 4, length 2
parseConfiguration('Ar 4s2 3d6')    // error 'Put the noble gas in square brackets: [Ar].', position 0, length 2
parseConfiguration('1s2 2s2 2s2')   // error '2s is written twice. Write each subshell once, with all of its electrons.', position 8
parseConfiguration('1s2 2g3')       // error '“g” is not a subshell letter. The subshells are s, p, d and f.', position 5
parseConfiguration('4s2 [Ar] 3d6')  // error 'The noble gas goes first, before the subshells.', position 4, length 4
```
Other errors: empty input; `(Ar)` / `{Ar}` (use square brackets); a bracket never closed; an unknown symbol in
brackets; two cores; a letter with no shell number (`p6`); a shell number with no letter; shell 0; a count of
three or more digits; a stray character. A bracketed element that is not a noble gas (`[Ca]`) PARSES (with
`nobleGas: false`); the grader names it.

`parseSpeciesAnswer(text): { ok: true; value: SpeciesAnswer } | { ok: false; error: ParseError }` — her answer
to "which element?": a symbol in any case or a name, with an optional charge.
```ts
parseSpeciesAnswer('fe')       // { z: 26, symbol: 'Fe', charge: null, byName: false }
parseSpeciesAnswer('iron 3+')  // { z: 26, symbol: 'Fe', charge: 3, byName: true }
parseSpeciesAnswer('Cl−')      // { z: 17, symbol: 'Cl', charge: -1, byName: false }
parseSpeciesAnswer('Zz')       // error 'No element has the symbol “Zz”.', position 0, length 2
```

### 2.4 Grading a configuration

`gradeConfiguration(species, answer: string, options?: { form?: 'full' | 'shorthand' | 'either' }): EconfigGrade`
(default `'either'`), `gradeFullConfiguration(species, answer)`, `gradeShorthandConfiguration(species, answer)`.
The checks run in the order listed in §3; the first that fires is the verdict.
```ts
gradeShorthandConfiguration('Fe', '[Ar] 3d6 4s2')   // { verdict: 'correct', message: 'Correct: Fe is [Ar] 3d⁶ 4s².' }
gradeShorthandConfiguration('Cr', '[Ar] 4s1 3d5')
// correct: 'Correct: Cr is [Ar] 4s¹ 3d⁵. Chromium is one of the two exceptions: one electron moves from 4s to 3d,
//   because a half-filled 3d subshell (3d⁵) is extra stable.'
gradeShorthandConfiguration('Cr', '[Ar] 4s2 3d4')
// { verdict: 'mistake', mistake: 'exception_missed', witness: '4s² 3d⁴ follows the filling order exactly, but chromium is
//   one of the two exceptions among the first 36 elements. A half-filled d subshell (3d⁵) is extra stable, so one
//   electron moves from 4s to 3d.' }
gradeShorthandConfiguration('K', '[Ar] 3d1')
// mistake 'filling_order': 'You put 1 electron in 3d while 4s is still empty. 4s is slightly lower in energy than 3d,
//   so 4s fills first, right after 3p. Subshells fill in this order: 1s 2s 2p 3s 3p 4s 3d 4p.'
gradeFullConfiguration('Fe', '1s2 2s2 2p6 3s2 3p6 4s2 3d5')
// mistake 'electron_count': 'Your configuration has 25 electrons (2 + 2 + 6 + 2 + 6 + 2 + 5 = 25), 1 too few. A neutral
//   iron atom has 26, the same as its atomic number.'
gradeShorthandConfiguration('Fe2+', '[Ar] 4s2 3d4')
// mistake 'ion_removed_from_3d': 'Your configuration still has 2 electrons in 4s. When a transition metal becomes a
//   positive ion, the 4s electrons leave FIRST, before any 3d electron: 4s is the outermost shell (n = 4). Fe²⁺ has no
//   4s electrons left.'
gradeFullConfiguration('Fe', '[Ar] 4s2 3d6')
// { verdict: 'invalid', message: 'That is the noble-gas shorthand. This question asks for the full configuration: write
//   out every subshell, starting from 1s.', position: 0, length: 4 }
gradeShorthandConfiguration('Ca', '[Ar] 3p6 4s2')
// { verdict: 'wrong', message: '[Ar] already includes 3p⁶. After the brackets, write only the subshells that come after argon.' }
gradeFullConfiguration('Fe4+', '1s2')   // { verdict: 'unsupported', message: 'Fe⁴⁺ is outside the model: …' }
```
What counts as right:
- any order of the right subshells; `4s0` may be written;
- shorthand: the canonical core, `[Ar] 4s2 3d6`. For an ION with exactly a noble gas's configuration both
  `[Ne]` and `[He] 2s2 2p6` are right (Na⁺, O²⁻ …; likewise `[Ar]` / `[Ne] 3s2 3p6`, `[Kr]` /
  `[Ar] 4s2 3d10 4p6`). For a NEUTRAL noble gas only `[Ne] 3s2 3p6` is right for argon: `[Ar]` is
  `core_not_earlier`;
- hydrogen, helium and the two-electron ions have nothing to abbreviate: in shorthand form `1s1` / `1s2` is
  accepted (and `[He]` for Li⁺, Be²⁺, H⁻).

`configurationMistakes(species, form: EconfigForm = 'full'): ConfigurationMistakeCandidate[] | null` (null:
species outside the model). Each candidate is `{ kind, text, witness, shadows }`.
```ts
configurationMistakes('Cr', 'shorthand').map(c => [c.kind, c.text])
// [['exception_missed', '[Ar] 4s2 3d4'], ['filling_order', '[Ar] 3d6'], ['electron_count', '[Ar] 4s1 3d4'],
//  ['core_wrong', '[Ne] 4s1 3d5'], ['core_not_earlier', '[Kr] 4s1 3d5']]
configurationMistakes('Fe').map(c => [c.kind, c.text])
// [['exception_misapplied', '1s2 2s2 2p6 3s2 3p6 4s1 3d7'], ['filling_order', '1s2 2s2 2p6 3s2 3p6 3d8'],
//  ['electron_count', '1s2 2s2 2p6 3s2 3p6 4s2 3d5']]
configurationMistakes('Na').map(c => [c.kind, c.text])
// [['electron_count', '1s2 2s2 2p6'], ['subshell_overfilled', '1s2 2s2 2p7'], ['subshell_nonexistent', '1s2 2s2 2p6 2d1']]
configurationMistakes('Fe2+', 'shorthand').map(c => [c.kind, c.text])
// [['ion_charge_ignored', '[Ar] 4s2 3d6'], ['ion_wrong_direction', '[Ar] 4s2 3d8'], ['ion_removed_from_3d', '[Ar] 4s2 3d4'],
//  ['ion_wrong_number', '[Ar] 4s1 3d6'], ['core_wrong', '[Ne] 3d6'], ['core_not_earlier', '[Kr] 3d6']]
```

### 2.5 Identify the element or ion

`gradeIdentifySpecies(species, answer: string, options?: { form?: EconfigForm; requireCharge?: boolean }): EconfigGrade`
— the question shows the configuration of `species` (`configurationText(species, { form })`) and, for an ion,
SAYS the charge ("a 2+ ion has the configuration [Ar] 3d6: which element is it?"), because a configuration
alone does not pick out an ion. She types a symbol or a name; a charge is optional unless `requireCharge`.
`form` says how the configuration was shown (it only tunes one plain message).
```ts
gradeIdentifySpecies('Fe', 'iron')   // correct: 'Correct: 26 electrons in a neutral atom means atomic number 26, which is iron (Fe).'
gradeIdentifySpecies('Fe2+', 'Fe')   // correct: 'Correct: 24 electrons and a 2+ charge mean 26 protons, which is iron: Fe²⁺.'
gradeIdentifySpecies('Fe2+', 'Cr')
// mistake 'ion_charge_ignored': 'Cr (chromium) has 24 electrons as a NEUTRAL atom, which matches the configuration. But
//   this is an ion with a 2+ charge: it has lost 2 electrons, so the atom it came from has 24 + 2 = 26 electrons, and 26 protons.'
gradeIdentifySpecies('Fe2+', 'Ti')
// mistake 'ion_wrong_direction': 'Ti (titanium) has 22 protons, which is 24 − 2: the charge went the wrong way. A 2+ ion
//   has LOST 2 electrons, so the neutral atom has MORE electrons than the ion: 24 + 2.'
gradeIdentifySpecies('Fe', 'O', { form: 'shorthand' })
// wrong: 'Oxygen has 8 electrons: that counts only the electrons written after the brackets. [Ar] stands for 18 more, …'
gradeIdentifySpecies('Fe', 'Co')
// wrong: 'Cobalt (Co) has 27 electrons as a neutral atom. The configuration shows 26 electrons (add the superscripts), …'
```
`identifyMistakes(species): ConfigurationMistakeCandidate[] | null` — the element each slip names (`text` is a
symbol); empty for a neutral atom.
```ts
identifyMistakes('Fe2+').map(c => [c.kind, c.text])   // [['ion_charge_ignored', 'Cr'], ['ion_wrong_direction', 'Ti']]
```
`speciesOfConfiguration(text: string, charge = 0): ConfigurationReading | null` — whose configuration a text is
(for template self-tests): `{ electrons, z, charge, symbol, groundState }`.
```ts
speciesOfConfiguration('[Ar] 3d5', 3)     // { electrons: 23, z: 26, charge: 3, symbol: 'Fe', groundState: true }
speciesOfConfiguration('[Ar] 4s2 3d4')    // { …, z: 24, symbol: 'Cr', groundState: false }
```

### 2.6 Valence electrons

`valenceElectrons(species): number | null` — neutral MAIN-GROUP atoms only (groups 1, 2, 13 to 18): the
electrons in the outermost occupied shell, read off the configuration. Null for a transition metal, an ion or
a species outside the model.
```ts
valenceElectrons('Cl')   // 7      valenceElectrons('Ga')   // 3 (3d¹⁰ is in shell 3)      valenceElectrons('Fe')   // null
```
`gradeValenceElectrons(species, answer: string): EconfigGrade`
```ts
gradeValenceElectrons('Cl', '7')    // correct: "Correct: chlorine's outermost shell is n = 3 (3s² 3p⁵), which holds 7 valence electrons."
gradeValenceElectrons('Cl', '17')
// mistake 'valence_total_electrons': "17 is ALL of chlorine's electrons (its atomic number). Valence electrons are only the
//   ones in the outermost shell, n = 3: the 10 electrons in the inner shells do not count."
gradeValenceElectrons('Cl', '5')
// mistake 'valence_last_subshell': '5 is the number of electrons in 3p alone. The outermost shell is the whole of n = 3,
//   so the 2 electrons in 3s count too.'
gradeValenceElectrons('Ga', '13')   // wrong: '13 counts the ten 3d electrons. 3d is in shell 3, an inner shell here: …'
gradeValenceElectrons('Fe', '2')
// { verdict: 'unsupported', message: 'Iron is a transition metal, and transition metals are out of scope for this
//   question: their 4s and 3d electrons can both take part in bonding, so valence electrons are only asked for
//   main-group elements (groups 1, 2 and 13 to 18).' }
```
`valenceMistakes(species): CountMistakeCandidate[] | null` — `{ kind, value, text, witness, shadows }`.
```ts
valenceMistakes('Cl').map(c => [c.kind, c.text])   // [['valence_total_electrons', '17'], ['valence_last_subshell', '5']]
valenceMistakes('Na').map(c => [c.kind, c.text])   // [['valence_total_electrons', '11']]   (3s¹ alone IS the answer)
valenceMistakes('H')                               // []
```
`explainValence(species): string[]` — see §2.9.

### 2.7 Orbital diagrams

**Representation.** `Spin = 'up' | 'down'`; `OrbitalBox = readonly Spin[]` (the arrows in one box, in the
order they were put in); `OrbitalDiagram = readonly OrbitalBox[]` (the boxes of ONE subshell, left to right:
1 box for s, 3 for p, 5 for d). `[]` is an empty box, `['up']` a single electron, `['up', 'down']` a pair. A
box may hold a wrong state (`['up', 'up']`, three arrows) so the Pauli mistake can be made and named.

`orbitalDiagram(species, subshell?: SubshellLike): OrbitalDiagramInfo` — the right diagram of one subshell:
the named one (`'3d'` or `{ n: 3, l: 'd' }`, any of 1s to 4p, occupied or not), or by default
`lastSubshell(species)`, the last occupied subshell in filling order (3d for Fe, 2p for O, 4s for K, 3d for Cr).
```ts
orbitalDiagram('Fe')
// { subshell: { n: 3, l: 'd' }, name: '3d', electrons: 6, orbitals: 5,
//   boxes: [['up', 'down'], ['up'], ['up'], ['up'], ['up']], unpaired: 4, text: 'ud u u u u' }
orbitalDiagram('O', '2p').text     // 'ud u u'
orbitalDiagram('Fe2+', '4s').text  // '-'   (empty)
```
`hundDiagram(electrons, l)` — Hund's-rule boxes for any count: `hundDiagram(4, 'p')` → `ud u u`.
`unpairedInDiagram(boxes)` — boxes holding exactly one arrow.

Text forms: `orbitalDiagramText(boxes)` → `'ud u u'` (u up, d down, `-` empty; the parser reads it back);
`orbitalDiagramDisplay(boxes)` → `'[↑↓] [↑ ] [↑ ]'`; `orbitalDiagramLatex(boxes)` →
`'\boxed{\uparrow\downarrow}\,\boxed{\uparrow\phantom{\downarrow}}\,…'`.
`parseOrbitalDiagram(text)` reads `ud u -`, `UD,U,_`, `↑↓ ↑ ↑`, `[ud] [u] []`, `[↑↓][↑][ ]`; errors carry a
position.

`gradeOrbitalDiagram(species, answer: OrbitalDiagram | string, options?: { subshell?: SubshellLike }): EconfigGrade`
— pass the boxes from the UI straight in (or typed text).
```ts
gradeOrbitalDiagram('O', [['up', 'down'], ['up'], ['up']])
// { verdict: 'correct', message: 'Correct: 2p of O is [↑↓] [↑ ] [↑ ], with 2 unpaired electrons.' }
gradeOrbitalDiagram('O', 'ud ud -')
// mistake 'hund_broken': "Box 1 holds a pair while box 3 is still empty. Hund's rule: the orbitals of a subshell have
//   the same energy, so each one gets ONE electron before any of them gets a second."
gradeOrbitalDiagram('N', 'u d u')
// mistake 'hund_broken': "Your single electrons point in different directions (2 up, 1 down). Hund's rule: the unpaired
//   electrons of a subshell all have the same spin, so the single arrows all point the same way."
gradeOrbitalDiagram('O', 'uu u u')
// mistake 'pauli_broken': 'Box 1 holds two arrows pointing up. Two electrons in the same orbital must have opposite
//   spins, one up and one down (the Pauli exclusion principle).'
gradeOrbitalDiagram('O', 'udu u -')   // mistake 'pauli_broken': 'Box 1 holds 3 arrows. An orbital holds at most 2 electrons, …'
gradeOrbitalDiagram('O', 'ud u -')    // wrong: 'Your diagram has 3 arrows, but the 2p subshell of O holds 4 electrons. Draw one arrow for each electron.'
gradeOrbitalDiagram('Fe3+', 'ud u u u u')   // wrong: 'Your diagram has 6 arrows, but the 3d subshell of Fe³⁺ holds 5 electrons. …'
gradeOrbitalDiagram('Fe', 'ud ud ud - -', { subshell: '3d' })   // mistake 'hund_broken'
```
Order of the checks: number of boxes (plain) → Pauli → number of arrows (plain) → a pair beside an empty box
(Hund) → single arrows with different spins (Hund). Not graded: WHICH boxes hold the single electrons
(`u - u` is right for carbon) and whether the singles all point up or all down (`d d d` is right for nitrogen;
the message adds "By convention the single arrows are drawn pointing up.").

`orbitalDiagramMistakes(species, subshell?): DiagramMistakeCandidate[] | null` — `{ kind, boxes, text, witness, shadows }`.
```ts
orbitalDiagramMistakes('O').map(c => [c.kind, c.text])    // [['hund_broken', 'ud ud -'], ['pauli_broken', 'uu u u']]
orbitalDiagramMistakes('Fe').map(c => [c.kind, c.text])   // [['hund_broken', 'ud ud ud - -'], ['pauli_broken', 'uu u u u u']]
orbitalDiagramMistakes('B')                               // []  (one electron: nothing to get wrong)
```

### 2.8 Unpaired electrons

`unpairedElectrons(species): number` — the whole atom or ion, every subshell counted.
```ts
unpairedElectrons('N')   // 3    unpairedElectrons('Fe')   // 4    unpairedElectrons('Cr')   // 6    unpairedElectrons('Fe3+')   // 5
```
`gradeUnpairedElectrons(species, answer: string, options?: { diagram?: OrbitalDiagram | string; subshell?: SubshellLike }): EconfigGrade`
— when the screen also has HER diagram of one subshell, pass it: a count that matches her own wrong diagram is
named as such.
```ts
gradeUnpairedElectrons('N', '3')    // correct: 'Correct: N has 3 unpaired electrons (2p [↑ ] [↑ ] [↑ ]).'
gradeUnpairedElectrons('N', '1')
// mistake 'unpaired_from_wrong_diagram': "1 is the count from a diagram that pairs electrons up first (2p³ drawn as
//   [↑↓] [↑ ] [  ]). Hund's rule: every orbital of a subshell gets one electron before any orbital gets a second, so
//   more of them stay unpaired."
gradeUnpairedElectrons('O', '0', { diagram: 'ud ud -' })
// mistake 'unpaired_from_wrong_diagram': "0 is what your 2p diagram shows, so the counting is fine: the diagram is what
//   needs fixing. Box 1 holds a pair while box 3 is still empty. Hund's rule: …"
gradeUnpairedElectrons('Cr', '4')   // mistake 'exception_missed': '4 is the count for 4s² 3d⁴, the plain filling order. …'
gradeUnpairedElectrons('Fe3+', '4') // mistake 'ion_charge_ignored': "4 is the count for the neutral atom. Fe³⁺ has lost 3 electrons: …"
gradeUnpairedElectrons('Fe3+', '3') // mistake 'ion_removed_from_3d': '3 is the count if the electrons are taken out of 3d while 4s stays full. …'
gradeUnpairedElectrons('O', '4')    // wrong: '4 is the number of electrons in 2p. Some of them share an orbital: …'
gradeUnpairedElectrons('Cr', '5')   // wrong: '5 counts 3d alone. 4s¹ is not full either, so its unpaired electron counts too.'
```
`unpairedMistakes(species): CountMistakeCandidate[] | null`
```ts
unpairedMistakes('Fe3+').map(c => [c.kind, c.text])
// [['unpaired_from_wrong_diagram', '1'], ['ion_charge_ignored', '4'], ['ion_removed_from_3d', '3']]
unpairedMistakes('Cr').map(c => [c.kind, c.text])   // [['unpaired_from_wrong_diagram', '2'], ['exception_missed', '4']]
unpairedMistakes('Cu')                              // []
```

### 2.9 Explanations (each REVEALS the answer: last hint rung, or after the problem is done)

`explainConfiguration(species, options?: { form?: EconfigForm }): string[]`
```ts
explainConfiguration('Fe3+', { form: 'shorthand' })
// ['Iron (Fe) has atomic number 26, so a neutral atom has 26 electrons.',
//  'Fill the subshells from the lowest energy up (the aufbau principle), in this order: 1s 2s 2p 3s 3p 4s 3d 4p. An s
//     subshell holds 2 electrons, a p subshell 6 and a d subshell 10.',
//  'Where each electron goes: 1s takes 2 (2 so far), 2s takes 2 (4), 2p takes 6 (10), 3s takes 2 (12), 3p takes 6 (18),
//     4s takes 2 (20) and 3d takes the last 6 (26).',
//  '4s fills before 3d because 4s is slightly lower in energy.',
//  'Neutral iron: 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶.',
//  'Fe³⁺ has a 3+ charge: the atom has lost 3 electrons, leaving 26 − 3 = 23.',
//  'Electrons leave the outermost shell first, the one with the highest shell number: 2 from 4s, then 1 from 3d.',
//  'That is why a transition metal loses its 4s electrons before any 3d electron, even though 4s filled first.',
//  'Fe³⁺: 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵.',
//  'Shorthand: argon has 18 electrons, no more than Fe³⁺ has, so [Ar] stands for 1s² 2s² 2p⁶ 3s² 3p⁶. Fe³⁺ is [Ar] 3d⁵.']
explainConfiguration('Cr')[4]
// 'That order alone would give 4s² 3d⁴. Chromium is an exception: a half-filled d subshell (3d⁵) is extra stable, so one
//   electron moves from 4s to 3d, giving 4s¹ 3d⁵.'
explainConfiguration('Cl-')[6]
// 'Cl⁻: 1s² 2s² 2p⁶ 3s² 3p⁶. That is the same configuration as argon: a main-group ion ends up with a noble-gas configuration.'
```
`explainOrbitalDiagram(species, subshell?): string[]`
```ts
explainOrbitalDiagram('O')
// ['O is [He] 2s² 2p⁴: its 2p subshell holds 4 electrons.',
//  'A p subshell has 3 orbitals, drawn as 3 boxes. A box holds at most 2 electrons, and two in the same box have
//     opposite spins, one arrow up and one down (the Pauli exclusion principle).',
//  "Hund's rule: every box of the subshell gets one electron, all with the same spin, before any box gets a second. The
//     first 3 go one per box, pointing up; the 1 left over joins the first box as a pair, pointing down.",
//  '2p: [↑↓] [↑ ] [↑ ]. Unpaired electrons in 2p: 2.']
```
`explainUnpaired(species): string[]`
```ts
explainUnpaired('Cr')
// ['Cr is [Ar] 4s¹ 3d⁵.', 'A full subshell holds only pairs, so it has no unpaired electrons.',
//  "4s¹ is not full. By Hund's rule its boxes are [↑ ]: 1 unpaired electron.",
//  "3d⁵ is not full. By Hund's rule its boxes are [↑ ] [↑ ] [↑ ] [↑ ] [↑ ]: 5 unpaired electrons.",
//  'Cr has 6 unpaired electrons in all (1 + 5).']
```
`explainValence(species): string[]` (throws for a transition metal or an ion)
```ts
explainValence('Ga')
// ["Gallium's configuration is 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d¹⁰ 4p¹.",
//  'Valence electrons are the electrons in the outermost occupied shell, the highest shell number. Here that is n = 4: 4s² 4p¹.',
//  'The ten 3d electrons are in shell 3, an inner shell, so they are not valence electrons.',
//  '2 + 1 = 3: gallium has 3 valence electrons.']
```
`explainIdentify(species, options?: { form?: EconfigForm }): string[]`
```ts
explainIdentify('Fe3+', { form: 'shorthand' })
// ['Add the electrons (the brackets stand for a whole noble gas): 18 for [Ar] + 5 = 23.',
//  'The charge is 3+: the ion has 3 fewer electrons than protons, so it has 23 + 3 = 26 protons.',
//  'Atomic number 26 is iron, so the ion is Fe³⁺.']
```

## 3. Mistake kinds, how each is detected, and a sample wrong answer

Configuration checks run in this order (first hit wins): form → core → nonexistent → overfilled → the two
exception slips → filling order → electron total → 4s kept by a transition cation.

| kind | grader | how it is detected | sample: question → her wrong answer |
|---|---|---|---|
| `core_wrong` | shorthand | brackets hold an element that is not a noble gas; or an EARLIER noble gas with the right tail; or an earlier one with every electron then written out | Ca → `[Ne] 4s2`; Ca → `[Ne] 3s2 3p6 4s2`; Ti → `[Ca] 3d2` |
| `core_not_earlier` | shorthand | the core is the element itself, or has more electrons than the species | Ar → `[Ar]`; Ca → `[Kr] 4s2`; Na⁺ → `[Ar]` |
| `subshell_nonexistent` | full, shorthand | a typed subshell with letter index ≥ shell number | Na → `1s2 2s2 2p6 2d1`; Li → `1s2 1p1` |
| `subshell_overfilled` | full, shorthand | a typed count above s 2, p 6, d 10 | Na → `1s2 2s2 2p7`; Li → `1s3` |
| `exception_missed` | full, shorthand | Cr / Cu answer equals the plain filling order | Cr → `[Ar] 4s2 3d4`; Cu → `[Ar] 4s2 3d9` |
| | unpaired | her count is the count of that configuration | Cr → `4` (right: 6) |
| `exception_misapplied` | full, shorthand | Sc, Ti, V, Mn, Fe, Co, Ni answer equals the right one with one 4s electron moved to 3d | Fe → `[Ar] 4s1 3d7` |
| `filling_order` | full, shorthand | a later subshell (filling order) holds electrons while an earlier one has room: a subshell skipped, 3d before 4s, 4d for 3d. Checked BEFORE the total, because "you skipped 3d" explains "10 too few" | K → `[Ar] 3d1`; Br → `[Ar] 4s2 4p5`; Fe → `… 4s2 4d6` |
| `electron_count` | full, shorthand | neutral atom: total ≠ Z (says by how many, with her sum). Ion: a total that fits none of the three ion kinds | Fe → `… 4s2 3d5` (25) |
| `ion_charge_ignored` | full, shorthand | ion: her total is Z, the neutral atom's | Na⁺ → `1s2 2s2 2p6 3s1` |
| | identify | she names the element whose Z is the ion's electron count | "2+ ion, [Ar] 3d6" → `Cr` |
| | unpaired | her count is the neutral atom's | Fe³⁺ → `4` (right: 5) |
| `ion_wrong_direction` | full, shorthand | ion: her total is Z + charge (the mirror image) | Na⁺ → `1s2 2s2 2p6 3s2`; O²⁻ → `1s2 2s2 2p2` |
| | identify | she names the element with Z = electrons − charge | "2+ ion, [Ar] 3d6" → `Ti` |
| `ion_wrong_number` | full, shorthand | ion: the total moved the right way from Z, by the wrong amount | Fe³⁺ → `[Ar] 3d6`; O²⁻ → `1s2 2s2 2p5` |
| `ion_removed_from_3d` | full, shorthand | transition-metal cation, right total, but 4s still holds electrons | Fe²⁺ → `[Ar] 4s2 3d4`; Cu⁺ → `[Ar] 4s1 3d9` |
| | unpaired | her count is the count of that configuration | Fe³⁺ → `3` (right: 5) |
| `valence_total_electrons` | valence | her number is Z | Cl → `17` (right: 7) |
| `valence_last_subshell` | valence | her number is the count of the last subshell | Cl → `5`; O → `4` (right: 6) |
| `hund_broken` | diagram | a box holds a pair while another box is empty; or the single arrows point different ways | O 2p → `ud ud -`; N 2p → `u d u` |
| `pauli_broken` | diagram | a box with two arrows the same way, or more than two arrows | O 2p → `uu u u`; `udu u -` |
| `unpaired_from_wrong_diagram` | unpaired | her count is what a pair-first diagram gives; or (with `options.diagram`) what HER wrong diagram shows | N → `1` (right: 3); O → `0` |

Plain `wrong` messages (no kind): the core's own subshells written again after the brackets; a diagram with
the wrong number of boxes or arrows; valence = the 3d electrons counted (Ga → 13), the group number (B → 13);
unpaired = the electrons in the unfilled subshell (O → 4), one of chromium's two subshells alone (Cr → 5);
identify = any other element, a wrong charge on the right element, only the electrons after the brackets.

## 4. Decisions

- **Typing order is not graded.** The brief asks for both standard orders; any order of the right subshells
  is accepted, so a typing-order slip is never confused with the filling-order MISTAKE (which is about which
  subshells hold electrons).
- **Filling order before the total.** `Br` as `[Ar] 4s2 4p5` is "You skipped 3d", not "10 too few"; `Fe` as
  `… 3p6 3d6` is "3d while 4s is still empty". A total is reported when the subshells are in order and none is
  skipped (`… 4s2 3d5`). For ions the same order check runs first, then the three ion kinds by total.
- **4s is left out of the order check** where the right answer itself has 3d ahead of a full 4s: a
  transition-metal cation, and Cr / Cu written with one 4s electron.
- **Ion totals name the ion kind.** For an ion, total = Z is `ion_charge_ignored` whatever the arrangement
  (the sentence says "as many as a neutral iron atom", not "the neutral atom's configuration").
- **Wrong form is `invalid`.** Shorthand where the full configuration was asked is not an attempt; she is told
  which form is wanted. Use `form: 'either'` to accept both.
- **Noble-gas-configuration ions** accept both `[Ne]` and `[He] 2s2 2p6`; a neutral noble gas does not accept
  its own symbol.
- **`ion_charge_ignored` replaces a "neutral configuration given" kind** so the same habit has one name in
  configuration, identification and unpaired-count questions.
- **Hund's rule has two halves** (CK-12's wording): one electron per orbital before pairing, AND the single
  electrons share a spin. Both are `hund_broken`, with different sentences.
- **Valence electrons are read from the configuration** (the highest occupied shell), not from the group
  number; a hand-typed table by group pins them in `valence.test.ts`.
- **"Outermost subshell"** is ambiguous for transition metals (4s by shell number, 3d by filling), so the
  default diagram subshell is named `lastSubshell` and documented as the last one in filling order. Name the
  subshell in the prompt.

## 5. Notes for the content stage

- **Register** one ErrorPatternId per kind you use (e.g. `ec_filling_order`) and map `grade.mistake` → id; use
  `grade.witness` as the PatternHit witness. `ECONFIG_MISTAKE_KINDS` lists all 17.
- **Validate every generated problem** with `econfigProblem(species, question, subshell?)` and draw species
  from `econfigAtoms()` / `econfigIons()` so nothing outside the model is produced.
- **Template self-tests** (per seed): `econfigProblem(...) === null`;
  `gradeConfiguration(sp, configurationText(sp, { form, order }), { form }).verdict === 'correct'` for both
  orders; `gradeOrbitalDiagram(sp, orbitalDiagram(sp, sub).boxes, { subshell: sub })` correct;
  `gradeValenceElectrons(sp, String(valenceElectrons(sp)))` correct;
  `gradeUnpairedElectrons(sp, String(unpairedElectrons(sp)))` correct; `gradeIdentifySpecies(sp, speciesText({ z: sp.z, charge: 0 }))`
  correct; when a template promises a trap, check the candidate list contains that kind.
- **Which species make good problems.**
  - Full configuration: Li to Ca for the basic order; Sc to Zn for 4s before 3d (`filling_order` and
    `exception_misapplied` candidates exist for Sc, Ti, V, Mn, Fe, Co, Ni); **Cr and Cu** for the exceptions;
    Ga to Kr for 3d¹⁰ before 4p (the "skipped 3d" trap). H and He are trivial.
  - Shorthand: Li to Kr. Na to Ar ([Ne]) and K to Kr ([Ar]) are the best; a noble gas itself (Ne, Ar, Kr) only
    when the point is "the core is the gas BEFORE it". Never H or He (`econfigProblem(sp, 'shorthand')`).
  - Ions: main-group ions (all end at a noble gas; candidates for `ion_charge_ignored`, `ion_wrong_direction`
    and `ion_wrong_number`, except that H⁻ has no wrong-direction candidate and Br⁻ no wrong-number one) and
    the transition-metal cations, which add `ion_removed_from_3d` ("4s leaves first"): Fe²⁺, Fe³⁺, Mn²⁺, Co²⁺,
    Ni²⁺, Zn²⁺, Cu⁺, Cu²⁺, Cr³⁺. For shorthand of an ion, skip H⁻, Li⁺, Be²⁺ (the answer is just `[He]`).
  - Identify: any species; for ions state the charge in the prompt and expect `identifyMistakes(sp)` to have
    both candidates.
  - Valence: main-group atoms only. Period 2 and 3 p-block set both traps; **Ga to Kr** add the 3d¹⁰ trap; H
    and He have no candidates (too easy); skip groups 3 to 12 (`valenceElectrons` is null).
  - Orbital diagram: the subshells where Hund's rule matters, i.e. `orbitalDiagramMistakes(sp, sub)` contains
    `hund_broken`: p² to p⁴ (C, N, O; Si, P, S; Ge, As, Se) and d² to d⁸ (Ti to Ni, and the ions Fe²⁺, Fe³⁺,
    Mn²⁺, Co²⁺, Ni²⁺, Cr³⁺). p¹, p⁵, p⁶, d¹, d⁹, d¹⁰ and s subshells cannot show the Hund mistake.
  - Unpaired electrons: species with `unpairedMistakes(sp).length > 0`. Cr (6) and the Fe ions are the rich ones.
- **Building an orbital-diagram answer from tappable boxes.** Render `SUBSHELL_ORBITALS[l]` boxes (or
  `orbitalDiagram(sp, sub).orbitals`); keep the answer as `Spin[][]`, one array per box, starting empty
  (`[[], [], []]`). Give her an "↑" and a "↓" control that append an arrow to the box she taps, and a way to
  clear a box. Do NOT cap a box at two arrows or forbid two arrows the same way: `['up', 'up']` and three
  arrows must be possible, or the Pauli mistake can never be named. Pass the array straight to
  `gradeOrbitalDiagram(sp, boxes, { subshell })`; show a box with `orbitalDiagramDisplay` or
  `orbitalDiagramLatex`. A reveal can fill the boxes from `orbitalDiagram(sp, sub).boxes`. The same array
  round-trips through `orbitalDiagramText` / `parseOrbitalDiagram` for storage in an attempt log.
- **Showing a configuration:** `configurationLatex` for KaTeX, `configurationDisplay` for plain sentences.
  Superscript digits ¹ ² ³ differ slightly in size from ⁴ to ⁹ in some fonts; check on the phone.
- **Two-part screens.** For "draw the diagram, then count the unpaired electrons" on one screen, pass her
  diagram as `options.diagram` to `gradeUnpairedElectrons` so a count that is right FOR HER DIAGRAM is not
  blamed on counting.
- **Asking for ions in an identify question:** the prompt must give the charge; the engine grades the element
  (and the charge only if she types one, or always with `requireCharge`).

## 6. Layering

`src/engine/econfig` imports only `@/shared/types` (the `ParseError` type) and `../chem/elements`. No shared
types, catalog entries or other folders were changed. The only edit outside the folder is the export block
appended to `src/engine/index.ts`.

## Log
- [started] plan written.
- [done] all source files (`types`, `model`, `text`, `parse`, `grade`, `identify`, `valence`, `orbital`,
  `explain`, `index`).
- [done] `model.test.ts`: 36 hand-typed atoms and 27 hand-typed ions, full and shorthand; renderers; species;
  the validator.
- [done] `parse.test.ts`, `grade.test.ts`, `identify.test.ts`, `valence.test.ts`, `orbital.test.ts`,
  `explain.test.ts`, `property.test.ts` (seeded: 1,500 right answers in random order and writing style; 3,000
  mutated answers checked against an occupancy oracle; every candidate of every species grades as its own kind).
- Decision: the filling-order check moved in front of the electron total (a skipped subshell explains the
  wrong total); see §4.
- [done] export block appended to `src/engine/index.ts` (no name clashes with the existing 217 exports).
- [done] this API reference.

## Commands run (2026-10-01, Bash, from the project root)

- `node node_modules/vitest/vitest.mjs run src/engine/econfig` → 8 files, 321 tests passed.
- `npm run typecheck` → exit 0 (tsconfig.app.json, tsconfig.node.json, server/tsconfig.json), run after the
  last source change.
- `node node_modules/vitest/vitest.mjs run` (whole suite, while another builder was working in the tree) →
  97 files, 1,699 tests: 1,695 passed, 4 failed, all four "Test timed out" in files outside this folder:
  `src/pages/Problem.test.tsx` (20 s), `src/pages/flows/DiffQuotientFlow.test.tsx` (30 s),
  `src/content/modules/composition/composition.test.ts` (60 s), `src/content/modules/propertiesDrill/drill.test.ts`
  (20 s). The run took 466 s on a loaded box.
- The same four files alone → 4 files, 43 tests passed. The failures are load, not logic; nothing was changed
  in those files.

## Open issues

- The seeded loops in `property.test.ts` carry a 120 s timeout (each takes 1 to 3 s alone, 12 s was seen once
  under load).
- Not modelled, on purpose: elements past krypton, excited states, quantum numbers, ions outside
  `commonCharges` (Sc³⁺, Ti⁴⁺ …), H⁺ (no electrons), valence electrons of transition metals.
- A dash between subshells (`1s2-2s2`) and a count after a space (`2p 6`) are parse errors, with a message.
- For chromium and copper ions the "exception missed" slip cannot be told from the right answer or from
  `ion_removed_from_3d` (Cu⁺ as `[Ar] 4s1 3d9`), so `exception_missed` is reported for neutral Cr and Cu only.
- Catalog wording, ErrorPatternIds, templates and screens are not started (next builder).
