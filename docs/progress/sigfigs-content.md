# Significant figures — CONTENT agent progress log

Scope: `src/content/modules/sigFigs/**`, its registration in `src/content/modules/index.ts`, additive changes to
`src/content/types.ts` (ProblemKind `sigFigs`, AnswerSpec variant `sigFigs`, `ModuleDef.subject`, two knobs),
`ModuleId 'sigFigs'` in `src/shared/types.ts`, URL flag letters for the two new knobs in `src/problem/url.ts`.
Not touched: `src/engine/sigfigs`, pages, flows, deploy.

## Plan (2026-09-20)

Files in `src/content/modules/sigFigs/`:
- `rules.ts`     rule cards for rules 1-11 in the module's own words (ids `sf-…`)
- `numbers.ts`   digit-string measurement builders (no floats): decimals with a chosen number of figures / places,
                 scientific notation text, unit tables
- `build.ts`     shared instance builder: validates the task with the engine (reseed on any issue), evaluates it,
                 fills the `sigFigs` AnswerSpec (task, unit, context, nudge, rule cards, reveal)
- `count.ts round.ts muldiv.ts addsub.ts mixed.ts sci.ts`   one template each
- `index.ts`     ModuleDef (subject Chemistry) + registerModule
- `sigFigs.test.ts`  300-seed sweeps per template

Decisions:
- Everything the sig-fig UI needs lives on `instance.answer` (type `'sigFigs'`), so `ProblemInstance` itself is unchanged.
- Each template picks a "trap" scenario from a weighted list with the seeded RNG, then draws numbers for it and asks
  the engine (`validateSigFigTask`) whether the task is usable; on any issue (tie, zero result, intermediate carry,
  not representable) or when the drawn numbers do not actually show the trap, it redraws from the SAME rng stream
  (bounded loop), so a seed is still fully deterministic.
- `params.trap` names the scenario; tests check the label AND the property it promises.

## Log
- [done] Types: `ModuleId 'sigFigs'`; `ProblemKind 'sigFigs'`; `AnswerSpec` variant `type: 'sigFigs'` (task, entry,
  prompt, context, quantities, unit, expected, expectedDisplay, alternates, nudge, ruleCard, ruleCards, reveal, trap);
  `SigFigEntry`, `SigFigQuantity`; `ModuleDef.subject?`; knobs `sciNotation` / `exactNumbers` (+ URL flags `s` / `e`
  in `src/problem/url.ts`). `npm run typecheck` green with no exhaustive Record/switch complaints elsewhere.
- [done] `numbers.ts`, `rules.ts` (12 cards), `contexts.ts`, `build.ts` (`makeSigFigTemplate`, draw-until-valid loop,
  prompt builder), templates `count.ts round.ts muldiv.ts addsub.ts mixed.ts sci.ts`, `index.ts` registered (order 6).
  `generators.test.ts` registry expectation updated to six modules.
- [next] eyeball ~40 instances per template, then `sigFigs.test.ts` (300-seed sweeps, traps, grader round-trip).
- [done] Eyeballed ~40 instances per template; fixes: believable nouns for scientific-notation numerals (tiny vs huge),
  capped placeholder whole numbers at 6 digits, plausible densities (0.70–1.99 g/mL) in the mixed template, averages
  whose sum keeps the trials' digit count (so the average has the figures a teacher expects), percent error against
  real accepted values (Al 2.70 g/mL, ethanol bp 78.4 °C, naphthalene mp 80.3 °C), no `× 10⁰` conversions, nudges
  carry no bare digits (a nudge must never contain the answer).
- [done] `sigFigs.test.ts` (38 tests): registration; anchor cases of the brief through the engine; per template over
  seeds 1..300: shape + id format, determinism, `validateSigFigTask` empty, no tie, canonical answer and every alternate
  grade correct, prompt/context/quantities/unit/nudge/rule cards present, every engine mistake candidate grades to its
  own id; trap coverage per template by PROPERTY (roles of the parsed numerals, expected text, limit indices, mistake
  candidates); knobs; prompt builder. `generators.test.ts` expects six modules; `stepEngine.test.ts` covers flags `s`/`e`.

## Final state (2026-09-20)

`npm run typecheck` passes. `node node_modules/vitest/vitest.mjs run src/content src/engine`: 17 files / 364 tests
green. Full `npm test`: 34 files / 505 tests green. Nothing committed.

Files: `src/content/modules/sigFigs/{build,numbers,contexts,rules,count,round,muldiv,addsub,mixed,sci,index}.ts`,
`sigFigs.test.ts`; registration line in `src/content/modules/index.ts`; additive types in `src/content/types.ts`
(`ProblemKind 'sigFigs'`, `SigFigEntry`, `SigFigQuantity`, `AnswerSpec` variant `'sigFigs'`, `ModuleDef.subject?`,
knobs `sciNotation` / `exactNumbers`); `ModuleId 'sigFigs'` in `src/shared/types.ts`; flag letters `s` / `e` in
`src/problem/url.ts` (+ two assertions in `src/problem/stepEngine.test.ts`); registry expectation in
`src/content/modules/generators.test.ts`.

## Instance shape for the UI agent

`generateProblem('sigFigs', 'sf.count' | 'sf.round' | 'sf.muldiv' | 'sf.addsub' | 'sf.mixed' | 'sf.sci', seed, knobs)`
returns a `ProblemInstance` with `kind: 'sigFigs'`, `start: null`, `canonical: []`, `vars: []`, `graph: { kind: 'none' }`,
`calc: { ti84: [], nspire: [] }`, `statementText` = the prompt (plain words: do NOT run it through `toLatex`), and
everything else on `instance.answer` (type `'sigFigs'`):

| field | what it is |
|---|---|
| `task` | the engine task (JSON). Grade with `gradeSigFigAnswer(task, typed)`; tap mode for counting with `gradeSigFigTaps(task.text, indices)`; intermediates with `gradeSigFigIntermediate(task, i, …)` (mixed only, `evaluateSigFigTask(task).intermediates`). |
| `entry` | `'count'` (sf.count: a whole number, or tapped digits) or `'numeral'` (type="text"; offer ± and ×10ⁿ, or two boxes + `composeSigFigText`). |
| `prompt` | one line, pretty numerals with units: "12.50 g ÷ 4.1 mL", "(3.00 × 10⁸ m/s) × 4.5 s", "Round 1999 m to 2 significant figures.", "How many significant figures are in 0.00450 g?" |
| `context` | one chemistry sentence to print above the prompt (never empty). |
| `quantities[]` | reading order = `sigFigTaskTerms(task)`: `{ text, display, unit, label, exact, note? }`; use for tap-the-digits (`text`), or to mark exact numbers. |
| `unit` | print beside the answer box; `''` for sf.count. `'%'` for percent error (print without a space). |
| `expected`, `expectedDisplay`, `alternates` | canonical answer (ASCII, engine-parseable) / pretty / other right spellings. For "show the answer" only; grading is by the engine. |
| `nudge` | hint rung 1. |
| `ruleCard`, `ruleCards` | rung 2: ids into `getModule('sigFigs').ruleCards` (first is the one to show; the rest are related). |
| `reveal` | rung 3 and the after-correct explanation: the engine's `steps` (reveals the answer; flag the attempt when used). |
| `trap` | scenario label (also `params.trap`, `params.scenario`); handy for analytics, not for display. |

Module: `getModule('sigFigs')` has `subject: 'Chemistry'` (home page can group by `subject`, absent = precalculus),
`order 6`, 12 rule cards (`SF_RULE_IDS` in `modules/sigFigs/rules.ts`), `progress` = one stage, `nextStep` = null,
no `solved`. Knobs: `sciNotation` (flag `s`; sf.count, sf.round, sf.muldiv, sf.addsub, sf.mixed) and `exactNumbers`
(flag `e`; sf.muldiv, sf.mixed); both render as checkboxes through the existing `KnobControl`.

## Unfinished / notes for later agents

- The flow component (`src/pages/flows/SigFigsFlow.tsx`) and the `case 'sigFigs'` in `pages/Problem.tsx` do not exist
  yet: today a sig-fig link falls into the `default` branch and redirects home. Home page grouping by `subject` and
  Progress grouping of `sf_*` patterns are also UI work.
- Engine text nit (not mine): a rounding sentence ending in a trailing-point answer reads "That gives 150.." (the
  numeral's own point plus the full stop). Cosmetic; the UI could render steps with the numeral emphasised.
- Not modelled in content: add/subtract with an exact number (rare in class), negative results (percent error is kept
  positive so the iPhone keypad never needs a minus for a right answer; the engine accepts one anyway).
