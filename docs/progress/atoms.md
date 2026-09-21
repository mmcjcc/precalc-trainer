# Atomic structure (CK-12 Chemistry - Intermediate ch. 4) — progress log

Scope: module id `atoms`, title "Atomic structure", subject Chemistry, ordered after sigFigs. One agent, whole
slice: engine grading (`src/engine/atoms/**`), `at_*` ErrorPatternIds + catalog entries, content templates
(`src/content/modules/atoms/**`), flow (`src/pages/flows/AtomFlow.tsx` + small components), dispatch in
`src/pages/Problem.tsx`, additive shared/content/store types, tests. Nothing committed; deploy files untouched.

## Plan (2026-09-21)

Templates:
1. `atom.particles` — protons / neutrons / electrons from a nuclear symbol (KaTeX), hyphen notation, or a named ion.
2. `atom.notation` — write symbol, mass number, atomic number, charge from p / n / e.
3. `atom.avgmass` — weighted average from an isotope table (real NATURAL_ISOTOPES sets + exact fictional "element X"),
   expressed as a sig-fig `mixed` task (groups mass × abundance ÷ 100 with 100 exact, joined by +), graded by
   `gradeSigFigAnswer`, method mistakes computed exactly (BigInt Rat from `engine/sigfigs/decimal`).
4. `atom.abundance` — two isotopes + average → both percents (to a stated place), exact solve.

Data rules: isotopes only from NATURAL_ISOTOPES, NOTABLE_ISOTOPES, or the brief's stable list (kept in
`src/content/modules/atoms/isotopes.ts`); ion charges only from `ELEMENTS[].commonCharges`.

## Log
- [done] Shared types (additive): `ModuleId 'atoms'`; 16 `at_*` ErrorPatternIds; `AtomParticle`, `AtomParticleCounts`,
  `AtomIsotope`, `AtomIsotopeRow`, `AtomQuestion` (particles | notation | avgmass | abundance), `AtomBox`, `AtomBoxGrade`,
  `AtomGrade`, `AtomMistakeCandidate`. 16 catalog entries in `engine/matchers/catalog.ts`.
- [done] Engine `src/engine/atoms/{particle,grade,exact,particles,notation,average,abundance,index}.ts`; `export * from './atoms'`
  in `src/engine/index.ts`. Typecheck green.
- Decision: a box that is empty/unreadable makes the whole check `parse_error` (only those boxes listed, nothing graded,
  nothing recorded), so no box leaks its verdict piecemeal.
- Decision (avgmass): order = sig-fig grader verdict (correct / parse error / named sf_* slip) → chemistry mistakes
  (exact value, matched at the last significant place she wrote, only when the right value does NOT match there;
  answers under 3 figures must equal the mistaken value exactly) → plain message (outside the isotope masses / not the
  weighted average). The sig-fig grader's power-of-ten plain message is overridden by `at_percent_not_decimal`.
- Decision (abundance): percents are asked to a stated place (the real table's decimals, hundredths for element X), so
  the two right answers always total 100; a finer answer that rounds right is accepted with a note.
- [next] engine tests, then content.
- [done] Engine tests `src/engine/atoms/{particles,notation,average,abundance}.test.ts` (45 green): every named mistake on
  a realistic wrong answer, never on the right one, plain messages otherwise, parse errors, sweeps over every element +
  taught charge, every NATURAL_ISOTOPES table (+ a made-up element X): canonical right, every candidate grades to its
  own id, the sig-fig grader's own candidates keep their sf_* ids.
- Verified: each real table's weighted average (sig-fig rounded) agrees with the periodic-table weight at the coarser
  place (Li 6.940, B 10.81, C 12.01, N 14.007, O 15.999, Mg 24.31, Si 28.085, Cl 35.45, K 39.0983, Cu 63.55,
  Ga 69.723, Br 79.90, Rb 85.47, Ag 107.868). For C the mass-number mistake is invisible (12.01 either way).
- [next] content: `src/content/modules/atoms/{isotopes,rules,build,particles,notation,avgmass,abundance,index}.ts`.
- [done] Content types (additive): `ProblemKind 'atoms'`, `AtomPeriodicEntry`, `AnswerSpec` variant `type: 'atoms'`
  (question, prompt, context, latex?, periodic, unit, expected[] per box, expectedDisplay, nudge, ruleCard(s), reveal, trap).
- [done] `src/content/modules/atoms/{isotopes,rules,build,particles,notation,avgmass,abundance,index}.ts`, registered
  (order 7, subject Chemistry). 10 rule cards (`at-*`). `generators.test.ts` expects seven modules; `Home.test.tsx`
  expects Chemistry = [Significant figures, Atomic structure].
- Decisions: particles/notation draw an element first, then one of its pool isotopes; a draw is kept only when every
  named mistake gives its own number (e.g. H-1 never appears in symbol form since A = Z). Hydrogen ions are left out
  (bare proton / hydride confuse ch. 4). Notation shows a periodic-table STRIP from min(p,e)−1 to max(p,e)+1, so the
  trap element (Z = electrons) is on screen as on a real table; particles in hyphen/ion form show the element's Z.
  Avgmass: real two-isotope Li B C N Cl Cu Ga Br Rb Ag, three-isotope O Mg Si K (H left out); element X masses to
  thousandths a little under A, abundances in hundredths summing to 100.00; kept only when the promised at_* mistakes
  are all visible (candidates graded to their own id). Abundance: real Li B Cl Cu Ga Rb (Br, Ag too close to 50/50);
  the given average is the table's own weighted average at the fewest decimals (3..6) that solves back to the published
  abundances exactly; element X to hundredths of a percent.
- [done] `src/content/modules/atoms/atoms.test.ts` (12 tests, 300 seeds per template): deterministic, JSON-safe, well
  formed, canonical answer grades correct, only allowed isotopes (independent list in the test) and commonCharges,
  real tables verbatim, element X sums exactly 100, every trap visible, all scenarios reached.
- [next] UI: `src/pages/flows/AtomFlow.tsx` + components, `Problem.tsx` dispatch, store field for resume, flow tests.
- [done] UI: `AttemptFinal.atEntries` (store, additive); `recordAtomGrade` in `pages/flows/record.ts` (one wrong record per
  distinct named mistake, else one plain wrong record; parse errors not logged); `components/IsotopeTable.tsx`
  (isotope table + periodic-table tiles), `components/AtomFeedback.tsx` (per-box rejection card, ✓/✗ marks);
  `pages/flows/AtomFlow.tsx` (boxes per template, avgmass reuses `SigFigNumeralInput` + its preview and the sig-fig
  feedback cards, live KaTeX "reads as" preview of the notation boxes, hint ladder nudge → rule/pattern card → worked
  explanation flagged as revealed, debounced save + restore); `case 'atoms'` in `pages/Problem.tsx`.
- [done] `pages/flows/AtomFlow.test.tsx` (12 jsdom tests): every template renders bare (no graph/calc); per template a
  wrong → right path with the named patterns recorded, re-check not re-recorded, completion, reload restores entries;
  first-try credit; plain message without pattern; rung 3 flags revealed.
- [next] full typecheck, whole suite, vite build; remove `.scratch-atoms/`.
- Full-suite note: under the whole suite's parallel load (12 CPUs, 43 files) the pre-existing F5 test in
  `src/pages/Problem.test.tsx` (five number-line problems in one test, ~1.7 s alone) crossed the default 5 s limit once
  the atoms tests were added. It now carries an explicit 20 s timeout (one line, test-only). The atoms seed loops carry
  60 s timeouts and share generated instances; `AtomFlow.test.tsx` describes carry 20 s.
- [done] Catalog examples checked against the engine (`average.test.ts`: 35.97, 35.48, 3545, Mg 21.81 / 24.31).
- Scratch folder `.scratch-atoms/` removed.

## Final state (2026-09-21)

`npm run typecheck` passes. `node node_modules/vitest/vitest.mjs run` (whole suite): 43 files / 649 tests green (two
consecutive full runs before the last small guard test, one after). `node node_modules/vite/bin/vite.js build` succeeds.
Nothing committed; deploy/, docker/, .github/, nginx.conf untouched. No dev server started, so no browser pass.

All four templates were built (including `atom.abundance`).

Fixed-seed links for a manual look: `#/p/atoms/atom.particles/c` (²³₁₁Na⁺), `#/p/atoms/atom.notation/7`
(11 p, 12 n, 10 e), `#/p/atoms/atom.avgmass/9` (rubidium), `#/p/atoms/atom.abundance/8` (copper, 63.546 u).

### Files
- Engine: `src/engine/atoms/{particle,grade,exact,particles,notation,average,abundance,index}.ts` + 4 test files;
  `export * from './atoms'` in `src/engine/index.ts`; 16 `at_*` entries in `src/engine/matchers/catalog.ts`.
- Shared/content/store types (additive): `src/shared/types.ts` (ModuleId, ErrorPatternIds, Atom* types),
  `src/content/types.ts` (ProblemKind 'atoms', AtomPeriodicEntry, AnswerSpec 'atoms'), `src/store/types.ts`
  (`AttemptFinal.atEntries`).
- Content: `src/content/modules/atoms/*` + `atoms.test.ts`; `import './atoms'` in `src/content/modules/index.ts`.
- UI: `src/pages/flows/AtomFlow.tsx` + `AtomFlow.test.tsx`, `src/components/{AtomFeedback,IsotopeTable}.tsx`,
  `recordAtomGrade` in `src/pages/flows/record.ts`, `case 'atoms'` in `src/pages/Problem.tsx`.
- Tests touched outside the module: `generators.test.ts` (seven modules), `Home.test.tsx` (Chemistry lists both
  modules), `Problem.test.tsx` (F5 timeout).

### Engine API (import from `@/engine`; types from `@/shared/types`)
```ts
particleCounts(p: AtomParticle): { protons, neutrons, electrons }            // Z, A − Z, Z − charge
gradeParticles(q, { protons, neutrons, electrons }: strings): AtomGrade
//  ³⁷₁₇Cl⁻: ('17','37','18') → wrong, boxes[1].pattern.id 'at_neutrons_as_mass_number'
gradeNotation(q, { symbol, massNumber, atomicNumber, charge }): AtomGrade    // charge '' = neutral; '2-', '-2', '+' ok
//  11 p 12 n 10 e: ('Ne','21','10','-') → at_element_from_electrons, at_mass_protons_electrons, at_charge_sign_flipped
averageMassTask(rows): SigFigTask                                            // mixed: Σ mass × abundance ÷ 100 (100 exact)
gradeAverageMass(q, typed: string): SigFigGrade                              // sf_* figure slips or at_* method mistakes
//  chlorine: '35.45' correct; '3545' at_percent_not_decimal; '35.97' / '36' at_unweighted_average; '35.48'
//  at_mass_numbers_used; '26.49' at_isotope_left_out; '35.453' sf_most_precise; '35.1' plain, no pattern
averageMassMistakeCandidates(q): AtomMistakeCandidate[]                      // each graded to its own id
solveAbundance(q): { exact, answer: [string, string] }; abundanceIssues(q): string[]
gradeAbundance(q, [p1, p2]): AtomGrade   // '50','50' at_assumed_even_split; swapped pair at_abundance_swapped;
                                          // total ≠ 100 at_abundance_sum; fractions / wrong pair: plain messages
explainParticles | explainNotation | explainAverageMass | explainAbundance (q): string[]   // rung 3 + after correct
nuclearSymbolLatex(p) '{}^{37}_{17}\mathrm{Cl}^{-}', nuclearSymbolText(p) '³⁷₁₇Cl⁻', parseChargeText, parseSymbolText
```
`AtomGrade`: `status` correct | wrong | parse_error, `message`, `boxes[]` (per box: status, message, pattern?,
parseError?), `patterns[]` (distinct, box order; record one wrong event per pattern), `note?`.

### Open / for later
- `docs/BUILD_GUIDE.md` §0 and §7 do not mention the atoms module (or sig figs).
- Browser/real-device pass not done (no server may be started): worth checking the KaTeX symbol size, the three
  particle boxes and the isotope table on an iPhone, and the iOS keyboard for the charge box (full keyboard).
- The Progress page lists `at_*` patterns by catalog title with everything else (no Chemistry grouping).
- Not modelled: polyatomic ions, isotopes beyond the allowed pool, abundance problems with three isotopes.
