# Chemistry chapter 7 — chemical nomenclature (content and screens)

Content stage of CK-12 chapter 7 on branch `chemistry-ch7` (working copy `C:\work\chem7`), built on the engine core
`src/engine/nomenclature` (`nomenclature-core.md`). Nothing under `src/engine/` is changed; no new nm_ ids.

## What is here

Unit `ch7` "Chemical nomenclature" in the chemistry course (`courses.ts`), after chapter 6. Kind `nomenclature`.

| module (order) | template | asks | parts |
|---|---|---|---|
| `ionicNames` "Ions and ionic compounds" (8.6) | `nm.ion` | name an ion from its formula, or write it (with its charge) from its name | 1 |
| | `nm.ionicFormula` | the formula of two ions given as formulas (Fe³⁺ and SO₄²⁻), or by name (cation, anion, then formula) | 1 or 3 |
| | `nm.ionicName` | name an ionic compound (45 % numeral metals, 35 % one-charge metals, half with a polyatomic anion, 15 % ammonium, 5 % nickel) | 1 |
| | `nm.ionicFromName` | the formula of a named ionic compound (same mix) | 1 |
| `molecularAcids` "Molecular compounds, acids, and hydrates" (8.7) | `nm.molecular` | name a binary molecular compound, or write its formula | 1 |
| | `nm.acid` | name an acid from its formula (binary acids with (aq)) or from its anion, or write its formula | 1 |
| | `nm.hydrate` | name a real hydrate, or write its formula | 1 |
| | `nm.classify` | ionic, molecular, acid or hydrate (choice); ammonium salts, hydrates and acids weighted 3:3:3 against plain ionic and molecular 1:1 | 1 |

Files: `src/content/modules/nomenclature/` — `pools.ts` (what is asked, weighted, and what is reserved), `build.ts`
(a part from its check: the engine's answer, accepted forms, candidates, explanation), `generate.ts` (builders,
draws, templates, `everyProblem`), `check.ts` (the per-seed self-check), `grade.ts` (`gradeNmStage`: the engine's
grader for the part's check, her text unchanged), `leaks.ts` and `universe.ts` (when a text shows an answer),
`feedback.ts` (`nmShown`: what the screen shows for a grade), `rules.ts` (rule cards, the slip → card map, the ion
table), `index.ts`; tests `nomenclature.test.ts`, `nomenclature.review.test.ts`, `nomenclature.pools.test.ts`.
Screen `src/pages/flows/NomenclatureFlow.tsx` (+ test). Wiring: `src/content/types.ts` (ProblemKind
`nomenclature`, the answer arm, `NmCheck`, `NmPartKind`, `NmStageId`, `NmPromptPart`), `src/shared/types.ts`
(ModuleId `ionicNames`, `molecularAcids`, additive), `src/content/modules/index.ts`, `src/content/courses.ts`,
`src/pages/Problem.tsx`, `src/pages/flows/record.ts` (`recordNmGrade`), `src/problem/tutorContext.ts`
(`verdictFromNm`, work, statement, canonical, answer); count tests in `courses.test.ts`, `generators.test.ts`,
`Home.test.tsx`; `record.test.ts`, `tutorContext.test.ts`.

## Decisions

- **Pools.** Cations: groups 1–2 (no Rb, Cs, Be, Fr, Ra), Al, Zn, Ag, NH₄⁺, and Fe, Cu, Pb, Sn, Co, Cr, Mn, Hg (both
  ions each), Hg₂²⁺, Ni²⁺; anions: the monatomic ions and the textbook's polyatomic ions (no bromate, silicate or the
  ions outside CK-12's table). Weights 3/2/1 by how often the chapter uses them. Hydride is asked as an ion only.
  Molecular: the engine's list of real compounds without the hydrides (common names), SiC and BN. Acids: the
  textbook's acids, the bromine and iodine families at weight 1 (the lesson's own per-/-ate/-ite/hypo- rule), no
  thiocyanic or silicic acid. Hydrates: 61 real hydrates (17 of the engine's COMMON_HYDRATES, weighted up, and 44
  more), each read by the engine.
- **Reserved, never asked:** the catalog's own example compounds (NaCl, MgO, Ca(NO₃)₂, Al₂O₃, FeCl₃, Hg₂Cl₂, KNO₃,
  KNO₂, KCl, CaCl₂, CuO, SnO, SnO₂, KF, NaNO₃, NaNO₂, KClO₃, KClO₄, KBr, KH₂PO₄, K₂HPO₄; As₂O₅ and S₂Cl₂; NO and
  Cl₂O₇ as names; Na₂CO₃·10H₂O; H₃PO₃ as a name), so on a compound part every catalog example line can be shown;
  and the ions this module's examples use (Cs, Be, Au, Rb, bromate, silicate, NH₄I; selenium species and sodium
  thiosulfate are outside the model anyway).
- **Nothing shown before she finishes contains the answer** (`leaks.ts`): the answer in every accepted form, and the
  piece that decides it (a polyatomic ion's name, a metal's numeral, a hydrate's salt and water word, an acid's
  root word, the ions' formulas of a compound given by name). A piece she typed herself is no news (her own words
  quoted back), as in the engine's own witness test. `nmShown` cuts a catalog lesson sentence that shows the answer
  to its general part (before the colon) or drops it, replaces a title or a witness that shows it with this
  module's wording, and shows the catalog example line only when it contains no answer any template generates for
  that kind of part, else this module's own example (built from reserved ions and compounds), else none (only
  `nm_unit_ion_reduced` on a single-ion part has none).
- **Classify** uses this module's wording for its three slips (the catalog's titles, lessons, examples and the
  engine's sentences name the right kind). The prompt asks which naming rules the formula follows, so "ionic" for a
  hydrate and "molecular" for an acid are not also right; bare HCl, H₂S … are never printed (binary acids carry
  (aq)), and a test checks that exactly one of the four choices grades right on every seed.
- **Two ions by name** (40 % of `nm.ionicFormula`): the textbook's worked examples list the ions first, so the
  problem asks for each ion with its charge (gradeIonFormula), then the formula (gradeIonicFormula).
- **Promised trap:** one of the engine's candidates for the last part, weighted toward the classic slips; a
  candidate whose text reads oddly as a promise ("lithium mononitrate", "aluminum(I) nitrate") at a tenth of the
  weight. Every nm_ id is promised on some seed in 300 per template.
- **Screen:** parts one at a time on the shared three-rung ladder (per part), entries and the open part on the
  attempt, the formula or ion drawn with KaTeX as she types ("reads as"; for SO42- the reading that is an ion), a
  strip for ( ) · (aq) and ^ + −, a capital-letter slip shown with its message and the place underlined (not
  recorded), the CK-12 polyatomic ion table in a disclosure (with the bromine and iodine families), the worked
  explanation only on rung 3 or after she finishes.

## Issues found in the core (not changed; for the reviewer)

1. The three class entries name the answer: titles "Ammonium compounds are ionic", "Water after the dot makes a
   hydrate", "H first, with an anion, in water: an acid", their lessons and examples, and `gradeClassify`'s
   witnesses ("…is ionic…", "…makes it a hydrate", "…which makes it an acid"). On a four-way choice she can retry,
   that is the answer. The property test skips classify.
2. `gradeIonName` for a one-charge cation with a numeral: "Sodium forms only one ion, Na⁺, …" prints the answer
   (sodium). The engine's `printsAnswer` is case-sensitive, so "Sodium" passes it. Same for every group 1 and 2
   metal, Al, Zn, Ag, NH₄⁺.
3. Several catalog lessons list the table facts that are a single-ion question's answer: nm_polyatomic_formula_wrong
   (nitrate is NO₃⁻ …), nm_ate_ite_swapped, nm_per_hypo_wrong, nm_hydrogen_prefix_wrong, nm_ide_for_polyatomic,
   nm_ion_charge_wrong (sulfate is SO₄²⁻ …), nm_numeral_on_fixed (sodium, potassium …), nm_element_name_for_anion
   (chlorine becomes chloride …), nm_unit_ion_reduced (its title prints Hg₂²⁺ and O₂²⁻), nm_ic_ous_swapped (nitric,
   nitrous), nm_acid_root (phosphorous acid), nm_prefix_missing (NO, NO₂, N₂O).
4. The catalog's example lines use the chapter's core compounds and ions (NaCl, MgO, KCl, nitric, nitrous,
   phosphoric, carbonic and hydrobromic acid, sulfate, nitrate, potassium …), so on a single-ion or acid part they
   show other problems' answers; handled here by reserving and by this module's own example lines.
5. `explainFormulaFromName` for a hydride: "Hydride is H⁻, as every group 1 metal is." (`fixedChargeSource` takes
   hydrogen's group 1). Hydride compounds are not asked here.
6. Minor: `explainNameFromFormula` for an ammonium salt reads "the polyatomic cation NH₄⁺, ammonium and the
   polyatomic anion OH⁻, hydroxide" (a comma is missing after ammonium); the nm_acid_named_as_salt lesson starts a
   sentence with a lowercase "hydrogen chloride".

## Tests and runs (2026-10-18, Git Bash, `C:\work\chem7`)

- `nomenclature.test.ts` 46: registration; per template over 300 seeds deterministic, in the model, every answer and
  accepted form graded right by the engine called directly and through the module, the candidates are the engine's
  list for that problem and grade as their ids, the promised trap is one of them, exactly one classify choice is
  right, nothing shown before she answers contains the answer (the module's check and a plainer independent one),
  at least 60 different problems and no seed cycle, spelling variants right, messages for other answers clean;
  numeral and polyatomic shares of `nm.ionicName`; no bare HCl; every nm_ id promised somewhere; hand-worked
  textbook examples (iron(III), sulfate, Fe₂(SO₄)₃, Ca₃(PO₄)₂, PbO₂, CoCl₂ with COCl₂ a case slip at position 1,
  N₂O₅, CO, HCl(aq), H₂SO₄, HNO₂ from its anion, CuSO₄·5H₂O both ways, NH₄Cl …).
- `nomenclature.review.test.ts` 12: rule-card examples, format hints, instructions and descriptions against every
  answer of their parts and seed 1's; every example line a slip can show on each kind of part; the ion table;
  2000 seeds per template.
- `nomenclature.pools.test.ts` 11: every problem each template can build (4,821) passes the self-check; reserved
  items never asked; weights; real hydrates by name.
- `NomenclatureFlow.test.tsx` 29: per template the promised slip then the fix (events, completion), an unreadable
  or wrong-case answer records nothing, a reload restores entries; the live formula, the case caret, the CO note,
  every accepted spelling on screen, a finished part after reload, the hint ladder and the ion table.
- Also: `record.test.ts` (+2), `tutorContext.test.ts` (+1), `courses.test.ts`, `generators.test.ts`, `Home.test.tsx`.
- Whole suite `node node_modules/vitest/vitest.mjs run --maxWorkers=4`: 190 files, 3,726 tests, all passed, 393 s.
  `npm run typecheck` clean (all three configs). `vite build --outDir C:\work\tmp\chem7-dist` built (the existing
  over-1500-kB warning on the main chunk).

Fixed-seed URLs with the promised slip: `#/p/ionicNames/nm.ion/3` (SO₄²⁻: "sulfite", nm_ate_ite_swapped),
`#/p/ionicNames/nm.ionicFormula/5` (Sn²⁺ and Cl⁻: "Sn2Cl", nm_crisscross_reversed; seed 2 is a by-name one),
`#/p/ionicNames/nm.ionicName/8` (Sn(OH)₄: "tin hydroxide", nm_numeral_missing),
`#/p/ionicNames/nm.ionicFromName/5` (copper(II) chlorate: "Cu(ClO2)2", nm_polyatomic_formula_wrong),
`#/p/molecularAcids/nm.molecular/c` (N₂O₄: "nitrogen dioxide", nm_molecular_reduced),
`#/p/molecularAcids/nm.acid/6` (HNO₂: "nitric acid", nm_ic_ous_swapped),
`#/p/molecularAcids/nm.hydrate/9` (iron(II) sulfate heptahydrate: "FeSO4·6H2O", nm_hydrate_count_wrong),
`#/p/molecularAcids/nm.classify/7` (NH₄Cl: "molecular", nm_class_ammonium_molecular).

## Log

- [done] read CLAUDE.md, BUILD_GUIDE §0, roadmap, the core doc, chapter 6's log and review, the chemistry modules and flows.
- [done] pools, builders, templates, the per-seed self-check; every problem of every template checked exhaustively.
- [done] leak checks and the display filter; rule cards; the polyatomic ion table; the screen; wiring; tests.
- [done] the live note under a formula box goes through the same filter (the engine's case note names CO, which is
  the answer to carbon monoxide); nm.ionicFromName mixes its seed so seed n is not nm.ionicName's compound.
- [done] typecheck, whole suite, build.

## Review (Claude, 2026-10-18)

- Independent re-solve, `nomenclature.crosscheck.test.ts` (reviewer's): every generated problem answered again
  with the reviewer's own ion table and naming rules, no call into the core (charge balance, Roman numerals,
  polyatomic ions, Greek prefixes, acid names, hydrates, the four kinds). 400 seeds per template: 3,170 answers
  agree with the stored answer or one of its accepted forms; 144 parts are outside the oracle (phosphite and a
  few other ions it does not list) and are skipped.
- The core's own anchor test (`nomenclature.review.test.ts`, about 90 textbook pairs typed by the reviewer) still
  passes.
- Fixed in the core: hydride's charge was explained "as every group 1 metal is" (hydrogen sits in group 1 but is
  not a metal); it now reads "a hydrogen atom that has gained one electron".
- The builder's notes on the core's wording (classify titles, several catalog lessons and one witness that name
  the answer of a single-ion or classify part) are real; the screen's `nmShown` filter already keeps them off a
  part she can retry, so the core text is left for a later pass.
- Browser, 375 px: no horizontal overflow; the live preview shows what she types with real subscripts and the
  charge ("Sn^4+" reads as Sn⁴⁺); the polyatomic ion table opens from the problem.
- Built by a Claude agent (Grok's balance had run out); about 950k tokens.
