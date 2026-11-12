# Chemistry chapter 10 — the mole

Content stage of CK-12 chapter 10 on branch `chem-mole` (working copy `C:\work\chem9`). Two new modules,
`moles` and `chemFormulas`, unit `ch10` "The mole" of the chemistry course (after ch9), one problem kind
`mole` and one screen `MoleFlow` serving both. All wording is original; only CK-12's topic order is
followed (the mole and Avogadro's number, molar mass, mass / moles / particles / gas volume at STP,
percent composition, hydrates, empirical and molecular formulas). Every atomic mass is
`engine/chem/elements.ts` `atomicWeight` (READ-ONLY) rounded to the hundredths; every number goes through
the sig-fig engine (`engine/sigfigs`, READ-ONLY). `src/engine/` is untouched except nineteen `mo_` entries
appended to the catalog.

## Why

Her class reaches CK-12 chapter 10 after the bonding chapters: counting particles by the mole, weighing a
mole from a formula, moving between grams, moles, particles and liters of gas, and then reading a
compound's makeup by mass and back into a formula. Chapter 9 is the sibling build (same parts flow, same
leak discipline); the numeric siblings are the sig-fig engine, the sig-fig content and the atoms module,
whose parser, rounding, scientific notation and input box are reused here — no second number parser or
rounding rule was written.

## What she gets

Unit `ch10` in `courses.ts`, moduleIds `['moles', 'chemFormulas']`, module orders 8.91 and 8.92 (after
`covalentBonding` 8.9, before geometry 9).

| template | asks | parts |
|---|---|---|
| `mo.particles` | the counting unit of the substance (Atoms / Molecules / Formula units, a third each); moles ↔ particles with 6.022 × 10²³ (either direction); in 75 % of compound seeds a second sample: moles of the compound → atoms of one element, or atoms of one element → moles of the compound | 2–3 |
| `mo.molarMass` | two molar masses from two different families (diatomic, molecular, ionic with or without parentheses, hydrate), g/mol to the hundredths | 2 |
| `mo.mass` | sample 1: grams ↔ moles (one step); sample 2: grams ↔ particles (two steps, through moles); 3 or 4 significant figures given (3 when the molar mass itself has 3: H₂, He) | 2 |
| `mo.gas` | may 22.4 L/mol be used for a described sample (Yes 40 %; a liquid or solid at 0 °C and 1 atm 30 %; a gas at another temperature or pressure 30 %); then a gas at STP: liters ↔ moles, and liters ↔ grams | 3 |
| `cf.percent` | from a formula (45 %): its molar mass, then two elements' percents to the tenths or hundredths as the prompt says; from measured masses of the two elements of a sample (25 %): both percents by sig figs; a hydrate (30 %): its molar mass, then percent water | 2–3 |
| `cf.empirical` | from percents (a 100 g sample) or measured masses: moles of one named element, then the formula as a whole number beside each symbol | 2 |
| `cf.molecular` | from an empirical formula and a molar mass (exact, or a "measured" value within ±0.5 %): the empirical formula mass, the multiplier, the molecular formula as counts | 3 |

**The substance table** (`moles/facts.ts`, 40 rows): C, Fe, Al, Mg, He; H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂;
H₂O, CO₂, CO, NH₃, CH₄, C₂H₆, C₃H₈, C₆H₁₂O₆, C₁₂H₂₂O₁₁, H₂O₂, SO₂, C₆H₆, C₁₀H₈, C₈H₁₈; NaCl, CaCO₃,
MgO, Al₂O₃, Ca(OH)₂, (NH₄)₂SO₄, Fe₂O₃, KNO₃, Na₂CO₃, Mg₃(PO₄)₂; CuSO₄·5H₂O, MgSO₄·7H₂O, Na₂CO₃·10H₂O,
BaCl₂·2H₂O. Each row stores its pieces (symbols and subscripts, parenthesised groups with their own
subscript, hydrate waters separately), name, kind (element / diatomic / molecular / ionic / hydrate) and
state at 0 °C and 1 atm (so "gas at STP" is derived). Its ASCII text, display, counts and every molar mass
(and what each slip sums to) are derived; a test checks the derived text equals the key.

Files: `src/content/modules/moles/` — `facts.ts` (the table, rounded masses, molar masses and slip sums,
numeric leak reader), `numeric.ts` (the shared grading models), `rules.ts` (4 cards, choice texts, card →
slips, `MO_RULE_FOR`), `grade.ts` (models of every check, `gradeMoStage`, `moWork`, leak rules,
`assertMoleAnswer`), `build.ts` (the template builder both modules use), `generate.ts` (4 templates),
`index.ts`; tests `moles.test.ts`, `moles.crosscheck.test.ts`, `moles.review.test.ts`.
`src/content/modules/chemFormulas/` — `facts.ts` (percents, the empirical procedure and its slips),
`rules.ts` (4 cards, card → slips), `grade.ts` (models of the formula checks), `generate.ts`
(3 templates), `index.ts`; tests `chemFormulas.test.ts`, `chemFormulas.crosscheck.test.ts`,
`chemFormulas.review.test.ts`. Screen `src/pages/flows/MoleFlow.tsx` (+ `MoleFlow.test.tsx`).

## Named mistakes

Minted (19, appended to `ErrorPatternId` after the `cb_` block and to the catalog after `cb_hbond_any_h`,
placed as the new species "The Mole Muddler" at the END of `SPECIES`):

| id | fires when her answer is exactly … |
|---|---|
| `mo_particle_kind` | a wrong counting unit (every wrong button, with a witness for the substance's kind) |
| `mo_avogadro_inverted` | ÷ 6.022 × 10²³ where × belongs, or the reverse (off by that factor squared) |
| `mo_molecules_for_atoms` | the particle count where atoms of one element were asked (subscript missing), or atoms ÷ N_A without ÷ subscript |
| `mo_stopped_at_moles` | the intermediate moles of a two-step conversion |
| `mo_molar_mass_inverted` | × molar mass where ÷ belongs or the reverse (also × atomic mass for an element's moles) |
| `mo_atomic_mass_for_molar` | one element's atomic mass used as the compound's molar mass (one candidate per element) |
| `mo_subscripts_ignored` | one of each atom (molar mass, empirical formula mass) |
| `mo_paren_first_only` | the subscript after parentheses applied to the first element inside only |
| `mo_diatomic_single` | O for O₂ (molar mass, and in mass and gas conversions) |
| `mo_hydrate_water_left_out` | the hydrate weighed without its water (molar mass, mass conversions) |
| `mo_hydrate_water_once` | one water instead of its coefficient (molar mass, mass conversions, percent water) |
| `mo_molar_volume_inverted` | × 22.4 where ÷ belongs or the reverse |
| `mo_stp_misapplied` | "Yes" for a liquid or solid, or for a gas away from STP |
| `mo_percent_by_count` | the element's share of the ATOMS (H in H₂O as 66.7 %) |
| `mo_percent_one_atom` | one atom's mass over the molar mass when the subscript is above one |
| `mo_percent_part_over_part` | the part over the rest (formula), over the other element (sample), water over the salt (hydrate) |
| `mo_mass_ratio_as_mole_ratio` | the given percents or grams divided by the smallest and read as subscripts (only when every such ratio is within 0.3 of a whole number) |
| `mo_ratio_rounded` | a ratio ending in a third or quarter rounded to the nearest whole number, or one ending in a half rounded either way |
| `mo_empirical_as_molecular` | the empirical formula given back as the molecular formula, or the multiplier written in every box |

Reused: the sig-fig engine's own `sf_` ids (and its correct-with-a-note) for a right value written with
the wrong figures — the grader asks `gradeSigFigAnswer` first and only names an `mo_` slip when her value,
rounded to HER figures, is not the right value at her figures. No unit slip id applies (units are printed
beside the box). `nm_not_lowest_ratio` was judged against for an empirical formula left unreduced: its
lesson is about ionic formulas and criss-crossed charges, a different reading, so an unreduced formula gets
a plain message.

## Decisions and exclusions

- **Reserved substances:** Br₂, Ca(OH)₂ and BaCl₂·2H₂O are table rows no template draws (tested); they are
  the only substances rule-card and catalog examples work (tested: no example names a drawable formula or
  name). Their numbers (159.80, 74.10, 244.27, 54.09 %, 14.75 %, 43.18 %, 21.59 %, 226.25, 208.23 …)
  never equal a deterministic answer, and every number part is redrawn when its answer equals any number
  written on any card or any `mo_` catalog entry (so 6.022 × 10²³ or 22.4 can never be a shown answer);
  tested over 300 seeds of every template.
- **Counting-unit words:** the choice buttons are Atoms / Molecules / Formula units. The particle card names
  all three (a complete listing singles out none, ch9's rule); every other card, the prompt, the nudges and
  the `mo_particle_kind` lesson and example avoid those plural words, and the prompt calls a count
  "representative particles".
- **One kind for two modules:** `mole` (one `AnswerSpec` arm, one screen), as chapter 7 did for its two
  modules. Both modules carry all eight cards, because a card crosses modules (`cf.hydrate` answers the
  molar mass of a hydrate in `mo.molarMass`).
- **Each card lists its slips** as data (`MO_CARD_SLIPS`, `CF_CARD_SLIPS`); `MO_RULE_FOR` is built from
  them and puts that card first after a slip (tested: every `mo_` id is answered by exactly one card).
- **Given numbers** are born as text (`sigFigs/numbers.ts`) with a nonzero last digit, so their figures are
  never ambiguous. Avogadro's number is 6.022 × 10²³ (4 figures), the molar volume 22.4 L/mol (3 figures):
  gas parts give 3-figure measurements, mass parts 3 or 4 (3 when the molar mass has 3: H₂ 2.02, He 4.00).
- **No answer on a rounding boundary:** every number part is redrawn when the first dropped digit of its
  answer is a 5, and a slip whose value would sit on one is not promised (the grader still names it).
- **Two honest rounding paths agree:** a mass conversion is redrawn when the unrounded printed weights would
  round its answer differently (tested by the generator on every seed).
- **Mole conversions are SigFigTasks** (`muldiv` chains with 6.022 × 10²³, 22.4, the molar mass and an exact
  counted subscript), so the engine's limiting-figure messages read naturally; the percent from a sample is
  a `mixed` task (part ÷ (sum) × 100, 100 exact); a percent from a formula is a `round` task at the stated
  place on the exact value, because its inputs are the listed masses, not measurements.
- **Empirical data** are drawn from a real formula (percents to the tenths 70 % / hundredths 30 %, or one
  measured mass and the others in proportion to 3 figures) and kept only when the moles, divided by the
  smallest, are each within 0.03 of a target under the smallest multiplier 1–4, every smaller multiplier
  misses by at least 0.08 on some ratio, and rounding the moles to 3 figures first gives the same formula.
  Drawn cases: whole ratios, a half (Fe₂O₃, Al₂O₃, Mg₃(PO₄)₂), a third or two thirds (C₃H₈), a quarter
  (C₁₀H₈ → C₅H₄, C₈H₁₈ → C₄H₉) — tested. No familiar compound gives a three-quarters ratio, so that case is
  covered by the card and the slip but not drawn. Sucrose is out of the empirical pool (its ratios are not
  clean).
- **Molecular formulas** draw only compounds whose multiplier is at least two (C₆H₁₂O₆, C₂H₆, H₂O₂, C₆H₆,
  C₁₀H₈, C₈H₁₈): with a multiplier of one the answer would already be in the prompt.
- **STP scenarios:** a non-gas is always described at 0 °C and 1 atm and a gas off STP is always a gas, so
  exactly one "No" reason is right. Benzene (solid at 0 °C, which surprises) stays out of the scenarios.
- **Elements:** sulfur is not in the table (S₈ makes "atoms" debatable); Cu, Na and Ne appear only inside
  compounds.
- **Hints:** three rungs per part (nudge, the part's card or the slip's card, the worked line); rung 3 marks
  the attempt revealed. Hydrate reveals read "salt + n × 18.02".
- **Tutor wiring:** `tutorContext.ts` describes the kind (statement, her parts with units via `moWork`, the
  worked lines, the expected display) with a test; the flow builds its TutorVerdict inline as ch9 does.

## Tolerances

| part | rule | why |
|---|---|---|
| conversions (`mo.particles`, `mo.mass`, `mo.gas` numbers), moles of an element, percent from a sample | exact: the sig-fig engine's value + figures (`gradeSigFigAnswer`); a slip matches when its exact value rounded to HER figures equals her value | measured inputs, so significant figures decide; no float tolerance anywhere |
| molar mass, empirical formula mass | right within ±0.02 g/mol inclusive AND written to the hundredths or finer; a right-sized coarser answer gets a plain "to the hundredths" message; a slip matches within ±0.02, and slips are kept more than 0.04 from the answer and from each other; within 0.02 of the unrounded-weight sum (e.g. sucrose 342.30) is a plain pointer to the rounding rule | two honest rounding paths differ by up to 0.02 (the brief); bigger formulas can differ more, and those get the pointer |
| percent from a formula, percent water | exact at the stated place (sig-fig `round` task on the exact value) | the inputs are the listed hundredths masses, stated in the prompt; nothing is measured |
| empirical ratios (data) | each within 0.03 of its target; smaller multipliers miss by ≥ 0.08; same formula with 3-figure moles | the brief's rule, plus a margin so no ratio reads two ways |
| multiplier | a whole number, exact; the given molar mass divided by the empirical formula mass is within 0.03 of it | the "measured" molar mass is the true one ±0.5 % |
| counts | exact whole numbers, every box at least 1 | a formula |

## Deviations

- Two extra module files beyond facts/rules/grade/generate/index: `moles/numeric.ts` (the grading models
  both modules share) and `moles/build.ts` (the template builder both use) — importing either from a
  module's `grade.ts` or `generate.ts` would cycle.
- `src/content/modules/nomenclature/nomenclature.test.ts` — its registry-adjacency pins gained the ch10
  links (`moles`, `chemFormulas` between `covalentBonding` and `geoSegments`), as ch9 did for its own
  insertion. Nothing else in that file changed.
- `src/components/monsters/species.test.ts` — besides `mo` in the chemistry prefix regex, the species-count
  ceiling went from 36 to 37 for the one new species. If the geometry build also appends a species, the
  merge needs 38.

## Verification

Not run yet.

## Files

Added:
- `src/content/modules/moles/{facts,numeric,rules,grade,build,generate,index}.ts`,
  `moles.test.ts`, `moles.crosscheck.test.ts`, `moles.review.test.ts`
- `src/content/modules/chemFormulas/{facts,rules,grade,generate,index}.ts`,
  `chemFormulas.test.ts`, `chemFormulas.crosscheck.test.ts`, `chemFormulas.review.test.ts`
- `src/pages/flows/MoleFlow.tsx`, `src/pages/flows/MoleFlow.test.tsx`
- `docs/progress/chem-mole.md`

Changed (additive, appended in the chapter's own region):
- `src/shared/types.ts` — ModuleId `moles`, `chemFormulas`; 19 `mo_` ErrorPatternIds after the `cb_` block
- `src/content/types.ts` — ProblemKind `mole`; `MoStageId`, `MoQuantity`, `MoCount`, `MoCheck`; the `mole`
  AnswerSpec arm after `covalentBonding`; `MoleAnswer`, `MoStage`
- `src/engine/matchers/catalog.ts` — 19 `mo_` entries after `cb_hbond_any_h`
- `src/components/monsters/species.ts` — species "The Mole Muddler" at the end of `SPECIES`
- `src/content/courses.ts` — unit `ch10`; `src/content/modules/index.ts` — the two imports
- `src/pages/Problem.tsx` — `case 'mole'`
- `src/problem/tutorContext.ts` — `moWork`, statement, canonical and answer for the kind
- `src/problem/workedExample.ts` — 7 ids in `COVERED_PARTS_TEMPLATES`, a `mole` case
- Tests: `src/problem/tutorContext.test.ts` (a ch10 case), `src/content/courses.test.ts`,
  `src/content/modules/generators.test.ts` (70 modules), `src/pages/Home.test.tsx` (lands on ch10),
  `src/components/monsters/species.test.ts` (`mo` prefix, ceiling 37),
  `src/content/modules/nomenclature/nomenclature.test.ts` (adjacency)

Fixed-seed URLs: `#/p/moles/mo.particles/1`, `#/p/moles/mo.molarMass/1`, `#/p/moles/mo.mass/1`,
`#/p/moles/mo.gas/1`, `#/p/chemFormulas/cf.percent/1`, `#/p/chemFormulas/cf.empirical/1`,
`#/p/chemFormulas/cf.molecular/1`. Nothing is committed; the work sits in the working copy for review.
