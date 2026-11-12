# Chemistry chapter 11 — chemical reactions

Content stage of CK-12 chapter 11 on branch `chem-reactions` (working copy `C:\work\chem11`). New module
`reactions`, unit `ch11` "Chemical reactions", kind `reactions`, screen `ReactionsFlow` (a mirror of
`CovalentBondingFlow`). All wording is original; only the chapter's topic list is followed (equations,
balancing, the five reaction types, the activity series, predicting products). Every formula is read by the
nomenclature engine's reader and every product formula a template asks for is graded by the engine
(`gradeIonicFormula`, `gradeFormulaFromName`); no second formula parser exists. Nothing under `src/engine/`
changed except eleven `rx_` entries appended to the catalog.

## Why

Her class reaches CK-12 chapter 11 after bonding: reading and balancing chemical equations, the five kinds of
reaction, and predicting what forms. The chapter's hardest habits are counting atoms through coefficients and
parentheses, balancing in lowest terms, the activity series and the seven pair-forming elements — each now a
named mistake with its own monster.

## What she gets

Unit `ch11` after ch9 in `courses.ts` (a separate entry, so the ch10 build's unit can slot between them),
moduleIds `['reactions']`, module order 8.95 (after `covalentBonding` 8.9, before geometry 9).

| template | asks | parts |
|---|---|---|
| `rx.count` | the atoms of one element in a term like 3Ca(NO₃)₂ (typed); is a shown equation balanced (choice, 50/50); which element is off, by name, or "None of them" (choice) | 3 |
| `rx.balance` | a skeleton equation: one whole-number box in front of every species, 1s typed; right when every element balances AND the numbers share no factor | 1 (one box per species) |
| `rx.types` | the type from the balanced equation (choice of five, each 20 % ± noise of seeds) | 1 |
| `rx.predict` | metal + nonmetal → the ionic product; a binary compound → its two elements; single replacement in two test tubes (does tube X/Y react — 50/50 — then the compound formed and the element freed in the tube that reacts); double replacement (both new compounds); a hydrocarbon burning (both products) | 1–3 |
| `rx.word` | a word equation → the formula of each named substance, in order (diatomics included) | 2–4 |

**The reaction table** (`facts.ts`): 59 real reactions stored UNBALANCED with state symbols and a type tag —
14 combination, 11 decomposition, 14 single replacement, 12 double replacement, 8 combustion. The balancer
(`balance.ts`) computes every coefficient set from the integer null space of the element matrix (exact rational
Gaussian elimination, scaled to lowest whole numbers); `balance.test.ts` restates all 59 balanced equations worked
by hand and checks each has exactly one lowest-terms solution, every coefficient 1–12.

## Named mistakes

Minted (11, appended to `ErrorPatternId` and the catalog, one new species "The Arrow Juggler" at the END of
`SPECIES`): `rx_coef_first_only`, `rx_paren_first_only`, `rx_add_not_multiply` (rx.count, exact values for the
term), `rx_not_lowest`, `rx_element_unbalanced` (rx.balance: exact properties of her coefficients — all balance
with a common factor; exactly one element off, the witness naming it and both counts, never the fix),
`rx_combo_decomp_swapped`, `rx_single_double_swapped` (rx.types), `rx_activity_backwards` (both directions: a
reaction where the lone element is lower, no reaction where it is higher), `rx_diatomic_single` (O for O₂ in
predict and word), `rx_not_swapped` (a starting compound typed as a product, double and single replacement),
`rx_combustion_products` (CO or C for the carbon product, H₂ for the hydrogen product).

Reused: `nm_charges_unbalanced` (the brief's "charges do not balance" product), plus whatever exact slip the
nomenclature engine names on a formula part (`nm_crisscross_reversed`, `nm_not_lowest_ratio`, `nm_anion_first`,
`nm_parentheses_missing`, …). Engine candidates become traps only when they grade as their own id through this
module, and their witness, title and lesson do not show the answer. Promises prefer an `rx_` trap where the seed
has one. `nm_not_lowest_ratio` was judged against for the balance slip: its lesson is about ionic subscripts, not
equation coefficients.

## Decisions and exclusions

- **Species in the naming model.** Every compound in the table passes `nomenclatureProblem(f, 'name')` (tested).
  Elements and hydrocarbons other than methane are outside the engine's compound model; their formulas are still
  read by the engine's reader. Word equations use only rows whose every species the engine (or the element
  table) names, and no P₄. Predict double replacement uses only salt + salt/base rows (H⁺ is not an ion of the
  naming model, so no neutralizations there).
- **Oxygen burning.** An element + O₂ is a combination and, by the chapter's wider definition, also a combustion.
  rx.types never draws those rows (tested); the types card says the app files them under combination, and
  combustion here means a carbon–hydrogen fuel.
- **Single replacement as two tubes.** "Reacts / no reaction" would otherwise change the part count (a leak by the
  "Part 1 of 3" heading). Each seed shows a reacting tube and a non-reacting one (a lower metal or iodine with the
  same compound — never the reverse pairing, which would print the products); part a asks about one tube (50/50),
  parts b and c ask the products of "the tube that reacts". Cold water: only K, Na, Ca (on the card).
- **The off-element part** always exists (so the part count never tells the answer); "None of them" is right on a
  balanced equation. Choices are element NAMES, because a symbol like S would be found in the "(s)" of the
  equation by the leak rule.
- **Balance UI**: one stage of kind `coefficients` (new, additive in `content/types.ts`) with `slots` (each
  species as shown) and `reactantCount`; each box is its own entry (`a0`, `a1`, …), joined with `|` for the
  grader. A blank box, a non-number or a 0 is not an attempt.
- **Leak rule** (`rxLeaks`): the shared token rule, applied to the app AND display form of an answer, with
  subscript digits counted as part of a token (so Al₂O₃ does not "show" Al, CO₂ does not show CO). A surface
  showing every option of a choice part singles out none (the five-type card).
- **Reserved for examples** (`RX_RESERVED_FORMULAS`, never drawn, tested): Li, F₂, LiF, Ni, Sn, Sn(NO₃)₂, Ni(NO₃)₂,
  SrCl₂, Li₂SO₄, SrSO₄, LiCl, Sr(NO₃)₂, SrF₂, butane C₄H₁₀. Counts on cards and catalog examples are written in
  words (the 4Sr(NO₃)₂ example: twenty-four O atoms).
- **Combustion card** states the rule in words (carbon dioxide and water); the answer formulas never appear on it.
  The rule IS the answer for those two parts — accepted as the chapter's own rule, flagged for the reviewer.
- **Engine wording**: the engine writes "which has a 1− charge"; `readable()` rewrites it to "a charge of 1−" so no
  article sits before a number, and any engine candidate whose witness would still break that rule is dropped.
- **Distributions** (asserted over seeds 1..300): no typed answer over 30 of 300 per part; no right choice over
  60 %; types each 12–30 %; reacts / no reaction each ≥ 30 %. To get there: rx.balance picks a coefficient
  pattern first on half the draws; rx.word redraws (up to twice) rows holding O₂ or H₂O; rx.predict weights its
  five kinds 27/20/28/18/7 and its double pool leaves out AlCl₃ + NaOH; rx.count coefficients run 2–9.
- **Exclusions** (brief): no net ionic equations, no solubility table (precipitates only named on a card), no
  redox vocabulary, no stoichiometry.
- **Tutor**: `verdictFromRx` lives in `tutorContext.ts` (the flow uses it); work, statement, canonical and answer
  are wired, with a test.

## Deviations

- `src/content/modules/nomenclature/nomenclature.test.ts`: its registry-adjacency pin (`geoSegments` right after
  `covalentBonding`) now passes through `reactions`, as ch8 and ch9 did for their insertions.
- `src/components/monsters/species.test.ts`: the species ceiling went from 36 to 37 (the table already held 36)
  and the chemistry prefix regex gained `rx`. Other builders tonight add species too; the reviewer will need to
  raise the ceiling once for all of them.
- Extra module file `balance.ts` (the brief asks for the balancer in its own file).

## Verification

Git Bash, `C:\work\chem11`, 2026-11-11/12, on a laptop shared with four other builders (heavy load; vitest
transform alone took minutes). The whole suite was NOT run, as the brief asks.

The last source edit was the new species' look in `species.ts` (art data only: the first look drew a sticker
0.5 px past the 100 × 100 viewBox). Run AFTER that edit:

- `vite build --outDir C:\work\chem11\.tmp-dist`: **exit 0** (the existing over-1500-kB main-chunk warning); the
  folder was deleted.
- `vitest run src/components/monsters` (8 files, 41 tests): 39 passed, 2 failed by **timeout only** under load
  (`art.test.ts` "every shape inside its viewBox" past its 120 s limit; `MonsterArt.test.tsx` past its 20 s
  default). Re-run one worker at a time: `art.test.ts` + `MonsterArt.test.tsx` → art.test **6/6 passed** (the
  viewBox check included), MonsterArt 2/3 (the same 20 s timeout, at 23 s); `MonsterArt.test.tsx` alone → **3/3
  passed**. species, coverage, collection, Catch, Squash and catchCue all passed in the directory run.

Run after the last edit to every OTHER file (so before the species-look edit, which no other test reads):

- `npm run typecheck` (all three configs): **exit 0, 0 errors**.
- `vitest run --maxWorkers=3` over `src/content/modules/reactions` (balance, reactions, hand, crosscheck, review),
  `ReactionsFlow.test.tsx`, `courses.test.ts`, `generators.test.ts`, `Home.test.tsx`, `src/components/monsters`,
  `workedExample.test.ts`, `tutorContext.test.ts`, `Chunky.test.tsx`, `nomenclature.test.ts`: **21 files, 425
  tests: 424 passed, 1 failed**. The failure was the art viewBox check on the first look; the edit above fixed it,
  and it passes in the re-run.
  - `balance.test.ts` 4: all 59 hand-balanced equations pinned; uniqueness, lowest terms, ≤ 12; the element matrix;
    the no-solution and many-solution cases.
  - `reactions.test.ts` 30: registration, catalog, the table (types, shapes, every compound in the naming model,
    reserved species absent), the pools against the series, and per template over 300 seeds: deterministic,
    answers and traps re-graded, no leak in prompt/hint/nudge, readable English, ≥ 40 statements in seeds 1..60,
    typed answers ≤ 30/300, right choice ≤ 60 %. Also type shares 12–30 %, reacts / no reaction ≥ 30 %, every
    rx_ id promised, nm_charges_unbalanced a trap, and every seed that can have a trap promises one.
  - `reactions.hand.test.ts` 14: more than forty answers worked by hand (atom counts with each slip, balance
    including the witness, balanced/off element, the five types and both swaps, product formulas from charges,
    partners trading, diatomics, ten activity-series pairs, combustion, names to formulas).
  - `reactions.crosscheck.test.ts` 5: every part re-solved from the prompt with the test's own reader, ion tables,
    activity list, name dictionary and a brute-force balancer (300 seeds; 150 for balance).
  - `reactions.review.test.ts` 5: 1000 seeds per template. Hints, nudges, prompts, instructions, witnesses,
    catalog titles + lessons, rx_ examples and rule cards never single out an answer.
  - `ReactionsFlow.test.tsx` 18: per template the promised mistake is named, recorded and fixed (events,
    completion, no answer in the alert), an unreadable answer records nothing, and a reload restores entries.
    Also the passed-part reload, the three-rung ladder and the chunky button.

Nothing is committed. Fixed-seed URLs: `#/p/reactions/rx.count/1`, `#/p/reactions/rx.balance/1`,
`#/p/reactions/rx.types/1`, `#/p/reactions/rx.predict/1`, `#/p/reactions/rx.word/1`.

## Files

New: `src/content/modules/reactions/` — `facts.ts`, `balance.ts`, `rules.ts`, `grade.ts`, `generate.ts`,
`index.ts`; tests `balance.test.ts`, `reactions.test.ts`, `reactions.hand.test.ts`, `reactions.crosscheck.test.ts`,
`reactions.review.test.ts`; `src/pages/flows/ReactionsFlow.tsx` + `ReactionsFlow.test.tsx`; this document.
Changed (additive): `src/shared/types.ts` (ModuleId `reactions`, eleven `rx_` ids), `src/content/types.ts`
(ProblemKind, `RxStageId`, `RxCheck`, the answer arm, `ReactionsAnswer`), `src/engine/matchers/catalog.ts`
(eleven entries after the chapter 9 block), `src/components/monsters/species.ts` (one species at the end),
`src/content/modules/index.ts`, `src/content/courses.ts`, `src/pages/Problem.tsx`, `src/problem/tutorContext.ts`,
`src/problem/workedExample.ts`; tests `courses.test.ts`, `generators.test.ts`, `Home.test.tsx`,
`tutorContext.test.ts`, `species.test.ts`, `nomenclature.test.ts`.
