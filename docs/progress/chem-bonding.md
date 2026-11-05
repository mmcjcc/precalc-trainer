# Chemistry chapter 8 — ionic and metallic bonding

Content stage of CK-12 chapter 8 on branch `chem-bonding` (working copy `C:\work\chem8`). New module
`ionicBonding`, unit `ch8` of the chemistry course, kind `ionicBonding`, screen `IonicBondingFlow`
(modeled on `PeriodicFlow`). All wording is original; only CK-12's topic order is followed. The
chem engines are called, never edited: formula units grade through `engine/nomenclature`
(`gradeIonicFormula`, `ionicFormulaMistakes`, `ionicFormula`) and ion configurations through
`engine/econfig` (`gradeConfiguration`, `configurationText`), so chapter 8 cannot disagree with
chapters 5 and 7. `ELEMENTS` and every engine file are untouched.

## What is here

Unit `ch8` "Ionic and metallic bonding" after ch7 in `courses.ts`, moduleIds `['ionicBonding']`,
module order 8.8 (after `molecularAcids` 8.7, before geometry 9).

| template | asks | parts |
|---|---|---|
| `ib.valence` | a main-group element (by name + symbol, or by its full configuration — she struggled with configurations, so half the prompts start from one): valence electrons, hand over or pull in (choice), how many move, the ion with its charge (typed), the ion's noble-gas shorthand (typed, econfig text format) | 5 |
| `ib.dots` | an atom or a simple ion: dots on its electron-dot symbol (cation 0, anion 8, atom = valence), and what the dots stand for (choice) | 2 |
| `ib.transfer` | a metal + nonmetal pair: both ions (typed), ions per formula unit as a ratio, the formula unit (typed, graded by the nomenclature engine), electrons transferred per formula unit | 5 |
| `ib.props` | melting, shattering, conducting molten, conducting dissolved — pick the lattice explanation over three standing misconceptions | 1 |
| `mb.sea` | conduction, bending, alloys, and the contrast with an ionic crystal — pick the electron-sea explanation | 1 |

Files: `src/content/modules/ionicBonding/` — `facts.ts` (pools, exclusions, transfer arithmetic),
`rules.ts` (8 rule cards, the choice sentences, slip → card map), `grade.ts` (`gradeIbStage`,
`canonicalIbAnswer`, `trapsForIb`, `assertIonicBonding` run on every seed), `generate.ts`
(5 templates), `index.ts`; tests `ionicBonding.test.ts`, `ionicBonding.crosscheck.test.ts`,
`ionicBonding.review.test.ts`. Screen `src/pages/flows/IonicBondingFlow.tsx` (+ test). Wiring:
`src/content/types.ts` (ProblemKind `ionicBonding`, the answer arm, `IbCheck`, `IbStageId`,
`IbScenario`, `MbAsk`), `src/shared/types.ts` (ModuleId + the new mistake ids, additive),
`src/engine/matchers/catalog.ts` (11 new entries, appended), `src/content/modules/index.ts`,
`src/content/courses.ts`, `src/pages/Problem.tsx`, `src/problem/workedExample.ts` (5 ids in
`COVERED_PARTS_TEMPLATES` + one `buildPartsForAnswer` case mirroring `periodic`),
`src/components/monsters/species.ts` (one new species at the END); count/list tests updated in
`courses.test.ts`, `generators.test.ts`, `Home.test.tsx`, and the chemistry prefix regex in
`species.test.ts`.

## Named mistakes

Minted (11, appended to `ErrorPatternId` and the catalog, placed as the new species "The Electron
Hoarder" at the end of `SPECIES`): `ib_valence_dblock`, `ib_gain_lose`, `ib_charge_sign`,
`ib_dots_neutral`, `ib_dots_all`, `ib_transfer_count`, `ib_props_electrons`, `ib_props_molecules`,
`ib_props_weak`, `mb_fixed_electrons`, `mb_ionic_confusion`.

Reused instead of minted (the brief's "check before minting" rule; each slip already has exactly
this id, with its lesson and monster):

- `ib_crisscross_swap` → **`nm_crisscross_reversed`** (the brief itself suggests this reuse);
- `ib_unreduced` → **`nm_not_lowest_ratio`** (same slip, word for word, on the ratio and formula parts);
- `ib_atom_config` → **`ec_ion_charge_ignored`** ("the atom's configuration given for the ion" is
  exactly the econfig engine's ion_charge_ignored, which the engine itself names when grading the
  ion-configuration part; minting a twin would put two monsters on one slip).

The trap text for `ec_ion_charge_ignored` is the atom's FULL configuration (not its shorthand), so
the engine's witness — which echoes her own sum, bracketed core included — never contains the
part's bracketed answer.

## Decisions and exclusions

- **Pools** (`facts.ts`; everything below is derived from `ELEMENTS.commonCharges`, with list tests
  pinning the exact symbols so a data edit cannot silently shift the draw):
  - `ib.valence`: Li, Be, N, O, F, Na, Mg, Al, P, S, Cl, K, Ca, Br — one taught charge, a noble-gas
    ion, and Z ≤ 36 so the econfig engine (model limit Z = 36) can write the ion's shorthand.
  - `ib.dots`: neutral atoms = every main-group atom Z ≤ 36 except H and He (noble gases stay for
    the neutral 8-dot case); ions = the 14 above plus Rb⁺, Sr²⁺, I⁻, Cs⁺, Ba²⁺ (dot counts need no
    configuration, so the heavier rows are safe here).
  - `ib.transfer` / `ib.props`: metals Li, Be, Na, Mg, Al, K, Ca, Rb, Sr, Cs, Ba × nonmetals N, O,
    F, P, S, Cl, Br, I; every pair checked against `ionicPairProblem` in the tests.
  - `mb.sea`: a fixed list of twenty familiar solid metals (mercury excluded: liquid).
- **Excluded from every draw, rather than special-cased:** H (two taught charges, bare-proton
  cation — misleading everywhere in this chapter); He and the noble gases as ion-formers (no ion);
  transition metals, metalloids, C and Si (no single clean noble-gas ion in `commonCharges`; the
  brief's variable-charge door was left closed — no chapter 8 template handles two charges, and
  Fe²⁺/Fe³⁺ ions are not noble-gas configurations, so they would break the unit's own story);
  Sn and Pb (two charges, neither noble-gas); Fr and Ra (radioactive, and reserved as the worked
  species of the rule cards and catalog examples so those can never leak an answer).
- **Reserved formulas:** NaCl, MgO, Al₂O₃, KCl, CaCl₂, KF are catalog-example compounds (the ch7
  rule), so `ib.transfer` never asks for them (82 of 88 pairs remain). `ib.props` still uses all
  88 pairs: its answers are explanation sentences, so a formula in a catalog example shows nothing.
- **Leak discipline:** `assertIonicBonding` runs for every generated seed — answers re-derived from
  the checks, every trap grades to exactly its id, and no hint, nudge, prompt, witness or rule card
  contains that part's answer (rule-card counts are written in words; examples use Fr/Ra/Ga). The
  review test extends this to catalog titles and lessons over 1000 seeds per template. Catalog
  wrong→right EXAMPLES of the reused `ec_`/`nm_` entries do print `[Ar]` and `MgO`, which can be
  answers here; the flow's GradeNote blanks an example that shows the part's answer (the same
  guard PeriodicFlow has, and the way the electrons module already ships), and the flow test
  asserts the blanking.
- **Prompt variety:** element/pair/scenario draws are crossed with several prompt wordings per
  template so seeds 1..60 give ≥ 40 distinct statements (asserted per template).
- **Worked examples:** the five ids are in `COVERED_PARTS_TEMPLATES` with one `ionicBonding` case
  in `buildPartsForAnswer`, shaped exactly like the `periodic` case (plain text, no TeX, no `$`).
- **Tutor wiring:** the flow builds its TutorVerdict and records grades inline (the shapes of
  `verdictFromPt` / `recordPtGrades`), because `tutorContext.ts` and `record.ts` were not on the
  brief's allow-list. Consequence: tutor context for this kind has the statement, the verdict and
  the reveal, but no "her work so far" lines (`ibWork` is exported and ready if the reviewer wants
  the two-line `tutorContext.ts` hookup).

## Deviations from the brief's file list

The brief's allow-list had no registration point for new mistake ids. Chapter 7 (commits f048ced,
10c6fb4) established what registering ids and a module actually touches, and this build followed
that precedent, additively only:

- `src/shared/types.ts` — `ionicBonding` in `ModuleId`; 11 new ids appended to `ErrorPatternId`
  (required: `ModuleDef.id` and trap ids are typed against these unions).
- `src/engine/matchers/catalog.ts` — 11 entries appended in a new chapter 8 block. The catalog is
  the coaching library (`Record<ErrorPatternId, …>` must stay total), not a chem engine; no
  existing entry or engine behaviour changed.
- `src/components/monsters/species.test.ts` — the hard-coded chemistry prefix regex gained
  `ib|mb` (without it the guard test misfiles the new ids as math).
- `src/pages/Home.test.tsx` — ch8 is now the chemistry course's last unit with modules, which is
  Home's default landing for the class; the hard-coded expectations moved from ch7 to ch8 (a
  Chapter 7 click was added so ch7's own lists stay covered).

## Verification

Machine note: another agent's suites were running on this machine during these runs, so durations
are inflated; every run below is this build's own, with its real exit code.

- `npm run typecheck` — run repeatedly during the build; final run (all files in their final
  state, log `C:\work\chem8-typecheck.log`): **exit 0**.
- `node node_modules/vitest/vitest.mjs run src/content/modules/ionicBonding/ionicBonding.test.ts`
  (log `C:\work\chem8-ib-test1.log`): **exit 0, 1 file, 13 tests passed** — registration, catalog
  entries, pinned pools, engine agreement (valence vs `valenceElectrons`, pairs vs
  `ionicPairProblem`), hand-worked answers, the 300-seed sweep per template (deterministic,
  answers/accepts/traps re-graded, leak checks), ≥ 40 distinct statements over seeds 1..60 per
  template, and every minted + reused id promised on some seed.
- `node node_modules/vitest/vitest.mjs run src/content/modules/ionicBonding/ionicBonding.crosscheck.test.ts src/content/modules/ionicBonding/ionicBonding.review.test.ts`
  (log `C:\work\chem8-ib-test2.log`): **exit 0, 2 files, 5 tests passed** — every part of 300 seeds
  per template re-solved independently from the prompt wording and ELEMENTS data (octet-rule
  charges, hand criss-cross, own aufbau shorthand), and the 1000-seed-per-template surface sweep.
  After a later wording fix to one `mb.sea` prompt, the crosscheck file was rerun alone
  (log `C:\work\chem8-ib-test2b.log`): **exit 0, 4 tests passed**.
- `node node_modules/vitest/vitest.mjs run src/pages/flows/IonicBondingFlow.test.tsx`
  (log `C:\work\chem8-ib-test3.log`): **exit 0, 1 file, 17 tests passed** — wrong-then-right walk
  with the promised mistake named and recorded, unreadable input recording nothing, reload keeping
  entries and the passed stage, and the three-rung hint ladder.
- `node node_modules/vitest/vitest.mjs run src/components/monsters src/content/courses.test.ts src/content/modules/generators.test.ts src/problem/workedExample.test.ts`
  (log `C:\work\chem8-ib-test4.log`): **exit 0, 11 files, 223 tests passed** — species placement +
  art for the new species, course/unit lists with ch8, the 59-module registry, and the automatic
  worked-example loops covering the five new templates.
- `node node_modules/vitest/vitest.mjs run src/pages/Home.test.tsx`
  (log `C:\work\chem8-ib-test5.log`): **exit 0, 1 file, 12 tests passed**.
- A first full-suite attempt surfaced one REAL failure of this build:
  `nomenclature.test.ts` pins the module-registry neighbor of `molecularAcids` as `geoSegments`,
  and `ionicBonding` (order 8.8) now sits between them. Fixed by updating that one adjacency
  assertion (plus the new ch8 link in the chain); rerun
  `node node_modules/vitest/vitest.mjs run src/content/modules/nomenclature/nomenclature.test.ts -t "chapter 7 registration"`
  (log `C:\work\chem8-nm-reg.log`): **exit 0, 2 passed | 44 skipped**. That first full-suite log
  (`C:\work\chem8-suite.log`) is also tainted — a stopped earlier run's worker processes survived
  the stop and interleaved into the same file — so it is not evidence either way; the clean run
  is below.
- Full suite, everything in final state: `npm test > C:\work\chem8-suite3.log 2>&1`:
  **exit 1 — 396 files: 385 passed, 11 failed; 6,716 tests: 6,705 passed, 11 failed.**
  All 11 failures are `Error: Test timed out in 120000/180000/240000/600000 ms`, every one in a
  file this build never touched (cardSources inv.linear; explog ee.exponential, its review;
  explog2 em.growth review; engine logs/property; engine nomenclature/property; nomenclature
  review nm.hydrate; piecewiseRate pw.write test + crosscheck; trig uc.point review; trig unit5
  sinusoidal crosscheck) — zero assertion failures anywhere. The run packed 22,051 s of test time
  into 2,941 s of wall clock beside the other agent's suite; per the build brief, those files'
  timeouts were left alone.
- A standalone rerun of those 11 files was started as extra evidence and then stopped before it
  finished, on the coordinator's instruction (the merged-tree gate later tonight is the final
  word); `C:\work\chem8-retimeouts.log` is therefore a cut-short run, not evidence either way.
  The classification above rests on the failure messages themselves: all 11 are the files' own
  per-test timeouts under tonight's double-suite machine load, in files this build never touched,
  with zero assertion failures — the same kind of known load flakes (long content files, the
  own.fuzz-style millisecond budgets) the first attempt showed.

Nothing is committed; the work sits in the worktree for review.
