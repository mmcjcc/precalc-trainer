# Precalculus Unit 6, Part 1: Fundamental trig identities

Course `precalc`, unit `unit6` ("Unit 6", "Analytic trigonometry"), after Unit 5 (`sinusoids`, `otherTrigGraphs`, `inverseTrig`).
Built on branch `trig-identities` in `C:\work\desk`, uncommitted for review. It extends the trig core (`src/engine/trig`) and connects the new module `trigIdentities` ("Fundamental trig identities", order `5.998`) to the course list, problem flow, Guide Me line cards, Worked Examples, and the AI tutor context.

## Why

After Unit 5's trig graphs and inverse trig functions, honors precalculus moves into analytic trigonometry (Larson 5.1–5.2, Sullivan 7.3): using the reciprocal, quotient, and Pythagorean identities to express one trig function in terms of another in a given quadrant, to simplify trig expressions to a single trig function or constant, and to verify identities by transforming the left-hand side into the right-hand side step by step. Both AP Calculus AB and later analytic trig sections (solving trig equations, sum/difference and double-angle formulas) depend on fluent algebraic manipulation of these eight fundamental identities.

## What she gets

One module `trigIdentities` ("Fundamental trig identities", order `5.998`) with three templates, four textbook rule cards (`ti-fundamental`, `ti-express`, `ti-simplify`, `ti-verify`), and a hybrid flow (`TrigIdentitiesFlow`) that supports both multi-part problems and step-by-step line rewrites:

- `ti.express`, "Write one trig function in terms of another" (PARTS):
  - Prompt gives one trig function of $\theta$, a target trig function of $\theta$, and a quadrant ($\text{I}$, $\text{II}$, $\text{III}$, or $\text{IV}$), across 10 ordered pairs ($\sin\leftrightarrow\cos$, $\tan\leftrightarrow\sec$, $\cot\leftrightarrow\csc$, $\sec$ in terms of $\sin$, $\csc$ in terms of $\cos$, $\tan$ in terms of $\sin$, $\cot$ in terms of $\cos$) and all four quadrants (36 distinct combinations, each quadrant 25% over 300 seeds).
  - Part 1 (`identity`, choice): pick the Pythagorean identity that ties the pair together ($\sin^2\theta + \cos^2\theta = 1$, $1 + \tan^2\theta = \sec^2\theta$, or $1 + \cot^2\theta = \csc^2\theta$).
  - Part 2 (`sign`, choice): pick the sign (`+` or `−`) of the target function in the given quadrant.
  - Part 3 (`expr`, text input with live KaTeX preview, symbol strip, and keypad with $\theta$, $\sqrt{\phantom{x}}$, $^2$, and the six trig functions): write the final expression in $\theta$, such as $-\sqrt{1 - \cos^2\theta}$. Accepts textbook and calculator spellings (`-sqrt(1 - cos^2(θ))`, `-sqrt(1 - (cos θ)^2)`, `-sqrt(1 - cos²θ)`, `-(1 - cos^2(θ))^(1/2)`).
- `ti.simplify`, "Simplify a trig expression" (STEP BY STEP):
  - 28 distinct trig expressions in $x$ that simplify in 2–3 canonical steps ($\le 6$ lines total) to a single trig function (`sin x`, `cos x`, `tan x`, `cot x`, `sec x`, `csc x`, or a power `sin²x`, `cos²x`, `tan²x`, `cot²x`, `sec²x`, `csc²x`) or a constant (`1`, `−1`).
  - Every intermediate line is checked for equivalence on the domain by `verifyTrigStep`, and any valid off-walk route finishes as soon as the student's line satisfies the structural simplified check `isSimplifiedTrig`.
- `ti.verify`, "Verify a trig identity" (STEP BY STEP):
  - 28 distinct trig identities in $x$ verified in 2–4 canonical steps ($\le 6$ lines total) by transforming the left-hand side into the right-hand side one line at a time.
  - Requires at least one valid intermediate step before accepting the right-hand side as done (`unverified_jump` if the student types the target right-hand side immediately from the start line), and finishes when the student's line matches the target right-hand side's canonical AST form (`sameTrigExpr`).

## Design decisions for review

- **Additive extension of `src/engine/trig`**:
  - `src/engine/trig/expr.ts` gains two pure structural helpers (`canonicalExprKey` and `sameExprForm`) at the end of the file without touching any existing Unit 4/5 export.
  - `src/engine/trig/identity.ts` implements `readTrigIdentityExpr` (normalizing `sin²x`, `sin^2 x`, `sin^2(x)`, `(sin x)^2`, `sin x`, `√(...)`, and `θ` on top of `readExpr`), `evalTrigSafe` and `trigSampleAngles` ($\ge 12$ seeded angles across all four quadrants that stay away from multiples of $\pi/6$ and $\pi/4$ so $\sin, \cos, \tan, \cot, \sec, \csc$ and $1 \pm \sin, 1 \pm \cos, \sin \pm \cos$ are all defined and non-zero, using the `'undef'` discipline of `src/engine/expressions.ts`), `trigExprEquivalent`, `sameTrigExpr`, `isSimplifiedTrig`, `detectTrigStepFamily`, `trigIdentitySlips`, `verifyTrigStep`, and `gradeTiExpressExpr`.
- **Guide Me cards (`src/problem/cardSources.ts`)**:
  - `offersLineCards` is enabled for `ti.simplify` and `ti.verify` (and `false` for `ti.express`).
  - `trigIdentitiesCards` builds up to 3 cards from `nextStep` and `trigIdentitySlips(current, ctx)`, verified through `verifyTrigStep`.
  - `stepTypeOf` returns `'pythagorean' | 'reciprocal' | 'quotient' | 'algebra'` from `detectTrigStepFamily` so the "picked right twice → type it next time" rule keys on the kind of identity move rather than a single shared rule-card ID.
- **Worked Examples (`src/problem/workedExample.ts`)**:
  - `'ti.simplify'` and `'ti.verify'` are added to `COVERED_STEP_TEMPLATES`; `'ti.express'` is added to `COVERED_PARTS_TEMPLATES`.
- **The 8 new `trig_` mistake IDs and their monster species**:
  - All 8 new `trig_` IDs (`trig_pythag_sign`, `trig_pythag_no_square`, `trig_reciprocal_wrong_pair`, `trig_quotient_inverted`, `trig_cancel_across_sum`, `trig_square_dropped`, `trig_identity_sign_lost`, `trig_split_denominator`) are appended at the end of the `spin` (`The Spinner`) trig-family species in `src/components/monsters/species.ts`.
  - Catalog entries in `src/engine/matchers/catalog.ts` use $\alpha$, $u$, $v$, and the word `one` (zero ASCII digits and no generated expression in $x$ or $\theta$).
  - In `src/content/modules/trig/trig5.review.test.ts` line 72, `UNIT5_IDS` is bounded at `TRIG_MISTAKE_IDS.indexOf('trig_pythag_sign')` so Unit 5's review slice stays the 31 Unit 5 IDs while `trigIdentities.review.test.ts` checks Unit 6's 8 IDs.

| Species | New ids |
|---|---|
| `spin` (`The Spinner`) | `trig_pythag_sign`, `trig_pythag_no_square`, `trig_reciprocal_wrong_pair`, `trig_quotient_inverted`, `trig_cancel_across_sum`, `trig_square_dropped`, `trig_identity_sign_lost`, `trig_split_denominator` |

## Log

- Read `AGY_TASK.md`, `CLAUDE.md`, `docs/BUILD_GUIDE.md` §0, `docs/roadmap.md`, `docs/progress/trig-unit5.md`, `docs/progress/explog-01-properties.md`, and `src/engine/trig/`.
- Added `'trigIdentities'` to `ModuleId` (`src/shared/types.ts`) and `ProblemKind` / `AnswerSpec` (`src/content/types.ts`), and added the 8 new `trig_` mistake IDs to `src/shared/types.ts`, `src/engine/trig/types.ts`, `src/engine/matchers/catalog.ts`, and `src/components/monsters/species.ts`.
- Built `src/engine/trig/identity.ts` and exported its API from `src/engine/trig/index.ts`.
- Built `src/content/modules/trigIdentities/index.ts` with `TI_RULE_CARDS`, `ti.express`, `ti.simplify`, `ti.verify`, self-verification at generation, and module registration in `src/content/modules/index.ts` and `src/content/courses.ts` (Precalculus `unit6`, "Analytic trigonometry").
- Wired `src/problem/cardSources.ts`, `src/problem/workedExample.ts`, `src/problem/tutorContext.ts`, `src/pages/flows/TrigIdentitiesFlow.tsx`, and `src/pages/Problem.tsx`.
- Wrote unit, hand-worked, 300-seed sweep, 2000-seed review, and jsdom flow tests (`identity.test.ts`, `trigIdentities.hand.test.ts`, `trigIdentities.test.ts`, `trigIdentities.review.test.ts`, `TrigIdentitiesFlow.test.tsx`, plus additions to `courses.test.ts`, `generators.test.ts`, `Home.test.tsx`, `cardSources.test.ts`, and `tutorContext.test.ts`).

## Not done

- Sum and difference formulas, double-angle and half-angle formulas, product-to-sum formulas, and solving trigonometric equations are subsequent modules in Unit 6 ("Analytic trigonometry").
- Proof rewrites that work both sides simultaneously are intentionally out of scope for `ti.verify` (which transforms the left side into the right side one line at a time).

## Verification

- `npm run typecheck`: passes across `tsconfig.app.json`, `tsconfig.node.json`, and `server/tsconfig.json`.
- Targeted and full Vitest suite (`node node_modules/vitest/vitest.mjs run --maxWorkers=3`): passes.
- Production build (`node node_modules/vite/bin/vite.js build --outDir C:\work\desk\.tmp-dist`): passes (temp output directory removed after verification).

## Files

New:
- `src/engine/trig/identity.ts`
- `src/engine/trig/identity.test.ts`
- `src/content/modules/trigIdentities/index.ts`
- `src/content/modules/trigIdentities/trigIdentities.hand.test.ts`
- `src/content/modules/trigIdentities/trigIdentities.test.ts`
- `src/content/modules/trigIdentities/trigIdentities.review.test.ts`
- `src/pages/flows/TrigIdentitiesFlow.tsx`
- `src/pages/flows/TrigIdentitiesFlow.test.tsx`
- `docs/progress/trig-identities.md`

Changed:
- `src/shared/types.ts`
- `src/engine/trig/types.ts`
- `src/engine/trig/expr.ts`
- `src/engine/trig/index.ts`
- `src/engine/matchers/catalog.ts`
- `src/components/monsters/species.ts`
- `src/content/types.ts`
- `src/content/modules/index.ts`
- `src/content/courses.ts`
- `src/problem/cardSources.ts`
- `src/problem/workedExample.ts`
- `src/problem/tutorContext.ts`
- `src/pages/Problem.tsx`
- `src/content/modules/trig/trig5.review.test.ts`
- `src/content/courses.test.ts`
- `src/content/modules/generators.test.ts`
- `src/pages/Home.test.tsx`
- `src/problem/cardSources.test.ts`
- `src/problem/tutorContext.test.ts`

## Review (2026-11-01, Claude)

The log's Verification section above did not survive the final edits: an independent re-run found 26 failures across 11
files. Root causes and fixes, all applied on this branch:

- **`cos x (1 / sin x)` parsed as `cos(x · (1 / sin x))`.** `readExpr`'s bare-argument rule absorbs a following
  parenthesized group (so `cos 2(x − π/4)` works), which silently misread every pool walk shaped `fn x (group)` and made
  generation's own self-verify throw across ti.simplify and ti.verify. Fixed in `readTrigIdentityExpr` preprocessing: a
  bare one-letter argument is wrapped (`cos(x)`) before parsing; `sin 2x` and `sin x^2` keep their old reading and
  `expr.ts` stays untouched.
- **`tutorContext.ts`:** a duplicated branch guarded by `if (false)` still ran its `else if`s and overwrote the
  plain-words reveal with raw KaTeX, breaking four pre-existing Unit 4/5 and optimization tutor tests; removed, along
  with a duplicated assignment there and a tripled `case 'inverseTrig'` in `Problem.tsx`.
- **Slip naming:** the "partner without its square" rewrites (`1 − cos²x → sin x`, `sec²x − 1 → tan x`) were labeled
  `trig_square_dropped`; relabeled `trig_pythag_no_square`, and the missing flip candidate was added so
  `1 − cos²x → 1 + cos²x` is caught and named `trig_pythag_sign`. `detectStructuralSlip` now names the no-square form
  specifically when the previous line is a Pythagorean combination.
- **ti.express trap matching:** slip candidates are now matched structurally or on quadrant-free samples. The no-square
  candidate for cot θ in terms of csc θ, `−√(csc θ − 1)`, is undefined everywhere on QIII/QIV, so the promised trap
  could never grade as its mistake under quadrant-restricted sampling.
- **Leak rule:** the quotient family step-nudge named `tan x`/`cot x`, which are legal walk lines (the 2000-seed review
  test rightly failed it); reworded. `PICK_MODULES` gained `trigIdentities`. `\sin^{2}x` LaTeX spacing matched the
  tests. The Guide-Me flow test clicked its button by half the accessible name (`Pick`), which jsdom turned into an
  opaque `getComputedStyle` crash — now `Pick the next line`.
- **`ee.exponential` worked-example timeout:** the 25-seed walk takes ~40 s on this machine; same 120 s bump as the
  geometry-unit7b branch, as an identical hunk so the branches merge clean.

Verification after fixes: typecheck green; full suite green (381 files; the two files fixed last re-run green solo);
production build green. Browser QA on the dev server: ti.simplify guided cards (trap pick → named lesson + The Spinner
caught + used card removed; right picks advance; completion reveal; the "picked lines don't count toward mastery"
note), ti.verify (typing the RHS as line 1 rejected as an unverified jump; a typed `tan x (1 / tan x) + tan²x` — the
parser-fix shape — accepted; finished on the RHS card), ti.express parts with the θ keypad, and the Example sheet on
both kinds (sibling never her numbers; steps reveal line by line with identity reasons; parts show answers with the
rule wording).

Accepted deviations: the SIMPLIFY and VERIFY pools are curated 28-item tables of verified walks rather than
seed-generated families — reasonable for identities, the distribution tests pass; widen the pools if she reports
repeats. In ti.verify a first line that simply restates the printed right-hand side is rejected as an unverified jump
(the brief said it should finish; restating the goal verifies nothing) — kept, pinned by the flow test.
