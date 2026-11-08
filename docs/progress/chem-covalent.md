# Chemistry chapter 9 — covalent bonding

Content stage of CK-12 chapter 9 on branch `chem-covalent` (working copy `C:\work\chem9`). New module
`covalentBonding`, unit `ch9` of the chemistry course, kind `covalentBonding`, screen
`CovalentBondingFlow` (a mirror of `IonicBondingFlow`). All wording is original; only CK-12's topic
order is followed (Lewis structures, VSEPR, polarity and intermolecular forces). Valence counts read
the same group arithmetic ionicBonding uses, and every electronegativity comes from
`engine/chem/trends.ts` (READ-ONLY; Allred's revision of the Pauling scale) — no value is typed twice.
`src/engine/` is untouched except ten new `cb_` entries appended to the catalog.

## Why

Her class reaches CK-12 chapter 9 after the ionic chapter: covalent bonds as shared pairs, electron
dot structures and the octet (with hydrogen's duet), VSEPR shapes with their angles, bond and
molecular polarity from electronegativity, and the three intermolecular forces that set boiling
points. Chapter 8 is the sibling build: same shapes, same flow pattern, same leak discipline.

## What she gets

Unit `ch9` "Covalent bonding" after ch8 in `courses.ts`, moduleIds `['covalentBonding']`, module
order 8.9 (after `ionicBonding` 8.8, before geometry 9).

| template | asks | parts |
|---|---|---|
| `cb.electrons` | shared or transferred (45 % of seeds contrast a chapter 8 salt, so the choice stays live); total valence electrons; then bonding + lone pairs around the center, or a diatomic's bond order + electrons in the bond | 4 |
| `cb.dots` | a dot structure described in words (counts in words, never digits): shared pairs, unshared pairs, electrons around one named atom, and — when the molecule has H — why hydrogen stops at two | 3–4 |
| `cb.shape` | from a molecule (60 %) or stated bonding/lone-pair counts (40 %): the shape (choice of the five), the angle (typed: 180, 120, 109.5, 107, 104.5), and why lone pairs change the shape | 2–3 |
| `cb.polarity` | the electronegativity difference to the hundredth from values printed in the prompt; the band (cutoffs 0.4 and 1.7, stated on the rule card; no drawn pair sits on a cutoff); and whether a separate molecule is polar (catch trio CO₂/CS₂/CCl₄ ≈ 29 % of draws) | 3 |
| `cb.forces` | the force in one sample (dispersion only / dipole-dipole / hydrogen bonds); then which of two samples boils higher, where the pair differs in exactly the force tested (H₂O/H₂S, HF/HCl, N₂/CO, six halogen size pairs) | 2 |

**The molecule table** (`facts.ts`): 25 hand-checkable molecules — H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂,
HF, HCl, HBr, CO (two-atom); CO₂, CS₂ (linear); H₂O, H₂S, OF₂, Cl₂O (bent); NH₃, PH₃, PCl₃, NCl₃
(trigonal pyramidal); CH₄, SiH₄, CCl₄, SiCl₄ (tetrahedral). Each row stores only formula, name,
central atom, composition, bond order and central lone pairs; valence totals, shared/unshared
pairs, per-atom dot counts, shapes, angles, bond differences, molecular polarity and forces are
all derived. Octet breakers (BF₃, BeCl₂, SF₆, PCl₅, NO, O₃, benzene) are not in the table and no
problem asks about one.

Files: `src/content/modules/covalentBonding/` — `facts.ts` (the table, pools, EN pairs, boil
pairs), `rules.ts` (7 rule cards, the choice sentences, slip → card map `CB_RULE_FOR`),
`sentences.ts` (the boil-comparison sentences, shared by grader/generator/tests), `grade.ts`
(`gradeCbStage`, `canonicalCbAnswer`, `trapsForCb`, `assertCovalentBonding` run on every seed),
`generate.ts` (5 templates), `index.ts`; tests `covalentBonding.test.ts`,
`covalentBonding.crosscheck.test.ts`, `covalentBonding.review.test.ts`. Screen
`src/pages/flows/CovalentBondingFlow.tsx` (+ test). Wiring: `src/content/types.ts` (ProblemKind
`covalentBonding`, the answer arm, `CbCheck`, `CbStageId`, `CbShape`, `CbBand`),
`src/shared/types.ts` (ModuleId + ten `cb_` ids, additive), `src/engine/matchers/catalog.ts`
(10 entries appended at the end of the chemistry region), `src/content/modules/index.ts`,
`src/content/courses.ts`, `src/pages/Problem.tsx`, `src/problem/workedExample.ts` (5 ids in
`COVERED_PARTS_TEMPLATES` + one `covalentBonding` case mirroring `ionicBonding`),
`src/components/monsters/species.ts` (one new species at the END); count/list tests updated in
`courses.test.ts`, `generators.test.ts`, `Home.test.tsx`, the chemistry prefix regex in
`species.test.ts`, and the module-adjacency pins in `nomenclature.test.ts`.

## Named mistakes

Minted (10, appended to `ErrorPatternId` and the catalog, placed as the new species "The Pair
Poacher" at the end of `SPECIES`): `cb_transfer_share`, `cb_h_octet`, `cb_pairs_swapped`,
`cb_pairs_for_electrons`, `cb_electron_groups_shape`, `cb_angle_wrong_shape`, `cb_en_negative`,
`cb_bands_flipped`, `cb_polar_because_bonds`, `cb_hbond_any_h`.

Reuse was checked and judged against for every candidate the brief named:

- `ib_gain_lose` for transferred-vs-shared: its lesson coaches the DIRECTION of a transfer
  between a metal and a nonmetal ("swapping those directions turns the ion inside out"); the
  chapter 9 slip is transferring at all where sharing happens. Wrong lesson for the slip, so
  `cb_transfer_share` was minted with a two-way lesson (it also fires when a chapter 8 salt in
  the contrast part is called shared).
- `ib_dots_all` / `ib_dots_neutral` for dot-count slips: both lessons read the dots of a FREE
  atom or simple ion ("the outermost shell as it stands", "the electrons have already moved");
  dots around an atom inside a molecule are shared pairs plus kept pairs, a different reading,
  so the wording does not fit a molecule and nothing was reused.

Each id fires only on exact matches for this problem's numbers: the swapped pair counts are each
other's (and the trap is dropped when the two counts are equal, e.g. H₂O's 2 + 2), the
electron-group shape is the arrangement's own name (plus `Trigonal planar` on bent molecules for
a dropped lone pair), the wrong angles are 120/109.5 for a pyramid and 109.5 for bent, the
negative difference is exactly −(the right difference), the flipped bands swap only the outer
bands (a middle-band pair has no reversed reading), and hydrogen bonding on sight of H fires
only when the molecule contains H without H-on-N/O/F.

## Decisions and exclusions

- **Reserved molecules:** PH₃, SiH₄ and HBr are table rows that no template draws (tested); they
  are the only molecules rule cards and catalog examples work. The element pairs H–Br, P–H and
  Si–H are likewise kept out of the EN-pair draw so a card can print an H–Br difference.
- **Near-cutoff molecules:** H₂S, NCl₃ and Cl₂O have bond differences under 0.4 (0.38, 0.12,
  0.28 on Allred's values), so the chapter's own rule — polar bonds PLUS an unsymmetric shape —
  calls them nonpolar while finer data gives them small dipoles. They stay out of the
  molecule-polarity and force draws entirely (still drawn for electrons, dots and shape), so the
  app never teaches either answer. H₂S appears only in the H₂O-vs-H₂S boiling comparison, where
  the asked fact (H₂O hydrogen-bonds, H₂S cannot) is clean.
- **CS₂ in the catch trio:** the brief lists CO₂/CS₂/CCl₄ as "polar bonds, symmetric shape".
  On Allred's values C–S is 0.03, so CS₂'s bonds are NOT polar by the chapter's own cutoff.
  CS₂ stays in the catch rotation (symmetric, answer Nonpolar, counted in the 25–45 % share),
  but its 'Polar' answer grades as plain wrong with a message about the near-equal pulls —
  `cb_polar_because_bonds` fires only where its story is true (CO₂, CCl₄, SiCl₄). Reviewer
  should confirm this reading.
- **HF's difference is 1.78** — above the 1.7 ionic cutoff. HF stays in the table (hydrogen
  bonding needs it) and is polar there, but H–F is never drawn as a classification pair, so the
  band question never calls HF ionic.
- **The 0.4/1.7 cutoffs** are stated on the `cb.bands` rule card as the brief asks; the 31
  drawn element pairs are fixed by hand and none computes to 0.40 or 1.70 exactly (tested).
- **Complete-listing leak rule:** the brief wants the VSEPR card to list all five shapes WITH
  their angles ("a card that lists every option singles out none") and the cutoffs stated on the
  bands card. The leak checks (generate-time assert, review sweep, flow test) therefore treat a
  surface as clean when it shows EVERY member of the part's closed option set (the five shapes,
  the five angles, the three bands, Polar beside Nonpolar); any surface that shows only some
  still throws. Everything without a closed set is checked outright, as in ch8.
- **The shared-or-transferred part** would otherwise have one correct answer 100 % of the time
  (every chapter 9 molecule shares), colliding with the no-choice-over-60 % rule. 45 % of
  `cb.electrons` seeds therefore point the choice at a named chapter 8 salt (NaCl, KBr, CaO,
  MgCl₂, LiF — in the prompt as a contrast), where Transferred is right; measured split 54/46.
- **Fixed right sentences vary their wording:** the duet-why and bend-why parts have one right
  CONCEPT, so each has two phrasings of the right sentence (and matching wrong sets) drawn by
  seed, keeping any single correct text near 50 %.
- **Distributions over seeds 1..300** (all asserted): every choice part's top answer ≤ 60 %
  (largest observed: Single at 56.6 % of bond-order parts); catch trio 29.3 % of the
  molecule-polarity part (bounds 25–45 %); ≥ 40 distinct statements per template over seeds
  1..60 (39–60 observed, after widening the dots openers); every drawable molecule appears and
  no reserved molecule ever does; all ten cb_ ids are promised somewhere.
- **Trapless seeds promise nothing:** a seed whose parts offer no exact slip (e.g. CO₂ in
  `cb.dots`: no H, and shared pairs equal unshared pairs) carries no promised trap, and the
  assert throws if a trap was possible but none was promised. Every `cb.electrons` and
  `cb.polarity` seed has a trap; the others promise one wherever one exists.
- **Angles are typed, not chosen**, per the brief; the grader accepts `107`, `107°`,
  `107 degrees`, `107.0`. The difference part accepts `.96`, `0.96`, `0.960`.
- **Tutor wiring:** like ch8, the flow builds its TutorVerdict and records grades inline;
  `tutorContext.ts` and `record.ts` were not touched (`cbWork` is exported and ready for the
  two-line hookup if the reviewer wants it).

## Deviations from the brief's file list

- `src/content/modules/nomenclature/nomenclature.test.ts` — its registration test pins the
  module-registry neighbours (`geoSegments` directly after `ionicBonding`); inserting
  `covalentBonding` between them breaks that chain, so the adjacency assertions gained the ch9
  link, exactly as the ch8 build updated the same test for its own insertion. Nothing else in
  the file changed.
- `src/content/modules/covalentBonding/sentences.ts` — one extra module file beyond the brief's
  five (facts/rules/grade/generate/index): the boil-comparison sentences are data shared by the
  grader, the generator and the tests, and importing them from generate.ts into grade.ts would
  cycle.

## Verification (2026-11-07, Git Bash, `C:\work\chem9`)

- `npm run typecheck` (all three configs; log `C:\work\chem9-typecheck.log`): **exit 0**.
- `node node_modules/vitest/vitest.mjs run src/content/modules/covalentBonding/covalentBonding.test.ts`:
  **exit 0, 18 tests** — registration, catalog entries, the molecule table pinned row by row
  against hand-restated values (name, central atom, valence total, shared/unshared pairs,
  central lone pairs, bond order, shape, angle, bond polarity, molecular polarity, force), the
  31 EN pairs pinned with hand-computed differences and bands (H–Cl 0.96 polar covalent, C–H
  0.35 nonpolar covalent, Na–Cl 2.23 ionic among them), the brief's anchor rows, the pools, the
  hand-worked grading walk (every trap id from a typed value), the 300-seed sweep per template
  (deterministic, answers re-graded, traps grade to exactly their ids, leak-free), variety,
  promised-id coverage, molecule coverage, the catch share and the ≤ 60 % rule.
- `node node_modules/vitest/vitest.mjs run src/content/modules/covalentBonding/covalentBonding.crosscheck.test.ts`:
  **exit 0, 5 tests** — every part of 300 seeds per template re-solved independently from the
  prompt alone: compositions parsed from the displayed formulas with the test's own subscript
  map, Lewis counts re-derived by octet arithmetic (needs − has, halved), dot counts re-read
  from the worded description, differences recomputed from the printed values, shapes from the
  test's own tables, forces and boiling winners from the test's own verdicts.
- `node node_modules/vitest/vitest.mjs run src/content/modules/covalentBonding/covalentBonding.review.test.ts`:
  **exit 0, 1 test** — 1000 seeds per template: hints, nudges, prompts, witnesses, catalog
  titles + lessons, catalog examples (held to the strict rule — no blanking needed anywhere)
  and whole rule cards never single out a part's answer.
- `node node_modules/vitest/vitest.mjs run src/pages/flows/CovalentBondingFlow.test.tsx`:
  **exit 0, 17 tests** — per template the promised mistake named, recorded and fixed (events,
  completion, no answer leaked into the alert), an unreadable answer recording nothing, a reload
  restoring entries; plus the passed-part reload and the three-rung hint ladder.
- `node node_modules/vitest/vitest.mjs run src/components/monsters src/content/courses.test.ts src/content/modules/generators.test.ts`:
  **exit 0, 10 files, 57 tests** — species placement + art for The Pair Poacher, course/unit
  lists with ch9, the 65-module registry.
- `node node_modules/vitest/vitest.mjs run src/problem/workedExample.test.ts src/pages/Home.test.tsx`:
  **exit 0, 2 files, 188 tests** — the automatic worked-example loops over the five new
  templates, and Home landing on ch9 with ch8 and ch7 still covered by clicks.
- `vite build --outDir C:\work\chem9\.tmp-dist` (log `C:\work\chem9-build.log`): **exit 0**
  (the existing over-1500-kB main-chunk warning); the folder was deleted after the run.
- Full suite `node node_modules/vitest/vitest.mjs run --maxWorkers=3 > C:\work\chem9-suite.log`:
  **exit 1 — 410 files: 409 passed, 1 failed; 6,888 tests: 6,887 passed, 1 failed.** The one
  failure is `src/problem/own.fuzz.test.ts` — its own millisecond parse budget ("took 52.9 ms
  at best"), in a file this build never touched, inside a packed 73-minute run (9,543 s of test
  time in 4,358 s of wall clock) that also overlapped this build's typecheck; the same known
  load-flake class ch8's log recorded. Rerun standalone on the idle machine
  (log `C:\work\chem9-ownfuzz-rerun.log`): **exit 0, 1 file, 15 tests passed**. Zero assertion
  failures anywhere in the suite.

Nothing is committed; the work sits in the worktree for review.

Fixed-seed URLs with the promised slip (seed in base 36 in the id, plain in the URL):
`#/p/covalentBonding/cb.electrons/1`, `#/p/covalentBonding/cb.dots/1`,
`#/p/covalentBonding/cb.shape/1`, `#/p/covalentBonding/cb.polarity/1`,
`#/p/covalentBonding/cb.forces/1` — the flow test walks the first trapped seed of each.
