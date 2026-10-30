# Desktop Problem Width & Worked Examples (`desk-problem`)

## Why

On a desktop window (`1900×1050`), the problem screen was constrained to a narrow centered container (`max-w-6xl`) with two columns, leaving wide empty gutters while solving required vertical scrolling. In addition, when she got stuck on a problem, she had hints for her own problem (which cost hint rungs or reveal her own step), but no way to see how a **similar** problem with different numbers is worked out step by step alongside her scratch pad.

## What she gets

1. **Desktop problem screen uses the width (`>= 1440px`, e.g. `1900×1050`)**:
   - Following the route-aware precedent in `src/App.tsx` (`max-w-[88rem]`), problem routes spread across the desktop window.
   - Her statement + tools column and her working + composer column sit at comfortable reading widths (`max-w-2xl` and `max-w-3xl`), and the side panels (**Scratch pad** and **Example — see one like it**) dock **beside** her work column instead of overlaying it. Both `Scratch` and `Example` can stay open side by side at the same time while she works.
   - Phones (`< 840px` or `< 480px` tall) and tablets at today's widths (`WINDOWS.landscape` `1024×768`, `WINDOWS.wide` `1280×800`) keep their exact existing layout.
2. **"Example — see one like it"**:
   - A toolbar button next to `Scratch` on covered problem types.
   - Generates a sibling problem from the **same module and template** using a deterministic sibling seed (`!= instance.seed`), stepping to the next seed if a candidate ever produces the same `statementText`.
   - **Line-by-line types**: shows the sibling's starting line and reveals **one walked line at a time** on each tap of `"Next line"`, each line accompanied by its reason in the module's own `nudge` and `ruleCard` wording, followed by the final conclusion once all lines are shown.
   - **Parts / answer types**: shows the sibling's statement and prompt, then each part with its answer and the module's per-part `nudge` / rule card wording as the why.
   - Includes an `"Another example"` button to step to another sibling seed on demand.
3. **Honesty rules**:
   - Opening an Example never touches her attempt's `firstTry`, `revealed`, `hintsUsed`, or `steps` (it is not her problem).
   - Opening an Example logs `{ t: 'example_viewed', skill, moduleId, at }` in the append-only event log (`pct.events`).
   - Hidden during timed sets (including timed SAT practice sets) and on her own typed problems (`/own/...`).

## Design decisions for review

1. **Desktop problem breakpoint (`DESKTOP_PROBLEM_MIN = 1440`)**:
   - `WINDOWS.wide` (`1280×800`) and `WINDOWS.landscape` (`1024×768`) are tested extensively in `TabletLayout.test.tsx` and `ScratchPad.test.tsx` for the two-pane tablet layout (`['Tools', 'Scratch pad']` tablist in the left pane). Setting `useDesktopProblemLayout()` at `min-width: 1440px` and `min-height: 480px` (and adding `WINDOWS.desktop = [1900, 1050]` to `src/components/layoutTesting.ts`) keeps `1024×768` and `1280×800` 100% unchanged while giving `1900×1050` desktop windows the multi-column docked layout.
2. **Strict coverage gate**:
   - Line-by-line templates are included only where walking `mod.nextStep(sibling, currentLine, swapped)` from the start line reaches completion **and** every walked line passes that module's own step checker (`classifyStep`, `gradeFxh`/`gradeDqStep`, `checkLogRewrite`, `checkLogStep` + `gradeLogEquation`).
   - `quadratics` (`cs.form`) is excluded because `quadraticsModule.nextStep` returns `null`; `evenOdd` (`evenOdd.poly`, `evenOdd.special`) is excluded because its two-slot evidence flow does not use `solved`; `inverses` (`inv.quadratic-not`) is excluded because it is not one-to-one.
   - Visual/figure-dependent templates (`graphFeatures`, `numberLine`, `geometry`, `trigonometry`, `quantumNumbers`, `eg.match`, `pw.graph`, `pw.write`) and constant-statement templates (`pw.domain`, `pw.continuous`) are excluded so an example never shows a missing figure or an identical `statementText`.

## Coverage

### Covered Line-by-Line Types (18 templates across 5 modules)

| Module | Template ID | Walk & Checker Verification |
| :--- | :--- | :--- |
| `inequalities` | `ineq.linear` | Walks `nextStep` to `mod.solved`; every step passes `classifyStep` |
| `inequalities` | `ineq.distribute` | Walks `nextStep` to `mod.solved`; every step passes `classifyStep` |
| `inequalities` | `ineq.fraction` | Walks `nextStep` to `mod.solved`; every step passes `classifyStep` |
| `inequalities` | `ineq.compound` | Walks `nextStep` to `mod.solved`; every step passes `classifyStep` |
| `inverses` | `inv.linear` | Walks `nextStep` to `detectInverseCompletion`; every step passes `classifyStep` |
| `inverses` | `inv.cbrt-shift` | Walks `nextStep` to `detectInverseCompletion`; every step passes `classifyStep` |
| `inverses` | `inv.frac-linear` | Walks `nextStep` to `detectInverseCompletion`; every step passes `classifyStep` |
| `inverses` | `inv.rational` | Walks `nextStep` to `detectInverseCompletion`; every step passes `classifyStep` |
| `inverses` | `inv.mobius` | Walks `nextStep` to `detectInverseCompletion`; every step passes `classifyStep` |
| `diffQuotient` | `dq.linear` | Walks `nextStep` to `dqSolved`; step 1 passes `gradeFxh`, algebra steps pass `gradeDqStep` |
| `diffQuotient` | `dq.quadratic` | Walks `nextStep` to `dqSolved`; step 1 passes `gradeFxh`, algebra steps pass `gradeDqStep` |
| `diffQuotient` | `dq.rational` | Walks `nextStep` to `dqSolved`; step 1 passes `gradeFxh`, algebra steps pass `gradeDqStep` |
| `diffQuotient` | `dq.radical` | Walks `nextStep` to `dqSolved`; step 1 passes `gradeFxh`, algebra steps pass `gradeDqStep` |
| `logProperties` | `lp.expand` | Walks `nextStep` to `mod.solved`; every step passes `checkLogRewrite` |
| `logProperties` | `lp.condense` | Walks `nextStep` to `mod.solved`; every step passes `checkLogRewrite` |
| `expLogEquations` | `ee.exponential` | Walks `nextStep` to finish; every step passes `checkLogStep` and final answer passes `gradeLogEquation` |
| `expLogEquations` | `ee.logarithmic` | Walks `nextStep` to finish; every step passes `checkLogStep` and final answer passes `gradeLogEquation` |
| `expLogEquations` | `ee.quadratic` | Walks `nextStep` to finish; every step passes `checkLogStep` and final answer passes `gradeLogEquation` |

### Covered Answer / Parts Types (40 templates across 13 modules)

| Module | Template IDs | Parts Rendered |
| :--- | :--- | :--- |
| `quadratics` | `cs.vertex` | Vertex form, Vertex `(h, k)`, Axis of symmetry, Direction & extremum value |
| `optimization` | `opt.wall`, `opt.pens`, `opt.numbers`, `opt.revenue` | Secondary equation, Primary equation, Final equation, optimal `x`, `y`, and extreme value |
| `polyDivision` | `sd.table`, `sd.value`, `sd.factor` | Coefficient row, synthetic division table / bottom row, quotient & remainder / `f(c)` / factor verdict |
| `polyZeros` | `pz.zeros`, `pz.end`, `pz.build`, `pz.rational` | Zeros & multiplicities, cross/touch behavior, end behavior, polynomial formula, rational root candidates & actual zeros |
| `rationalFns` | `rf.features`, `rf.asymptote`, `rf.equation` | Domain, holes, vertical asymptotes, horizontal/slant asymptote, intercepts, equation solution |
| `signCharts` | `sc.poly`, `sc.rational`, `sc.chart` | Critical numbers, interval signs, interval-notation solution |
| `complexNums` | `cx.arith`, `cx.divide`, `cx.powers`, `cx.quadratic`, `cx.zeros` | Standard form result / quotient / power of `i` / complex roots / all complex zeros |
| `expLogGraphs` | `eg.features`, `eg.inverse` | Domain, range, asymptote, intercept, increasing/decreasing, or inverse function `f⁻¹(x)` |
| `expModels` | `em.interest`, `em.halflife`, `em.growth` | Exact growth/decay rate `k`, rounded `k`, and balance / amount / time follow-up |
| `logForms` | `lf.value`, `lf.convert`, `lf.decimal` | Exact value, converted exponential/log form, or rounded change-of-base value |
| `domainRange` | `dr.domain`, `dr.range` | Domain or range in interval notation with restriction explanation |
| `periodic` | `pt.locate`, `pt.valence`, `pt.trends`, `pt.ions`, `pt.why` | Period/group/block/class, valence electrons, trend ranking, ion size comparison, physical reason |
| `ionicNames` & `molecularAcids` | `nm.ion`, `nm.ionicFormula`, `nm.ionicName`, `nm.ionicFromName`, `nm.molecular`, `nm.acid`, `nm.hydrate`, `nm.classify` | Ion name/formula, cation/anion & ionic formula, compound/acid/hydrate name or formula, compound classification |

## Log

- Inspected `App.tsx`, `PageLayout.tsx`, `ProblemFrame.tsx`, `TabletLayout.test.tsx`, `ScratchPad.tsx`, `ScratchPad.test.tsx`, `Review.tsx`, `store/types.ts`, and all step and parts modules.
- Added `example_viewed` event type to `Ev` in `src/store/types.ts`.
- Created `src/problem/workedExample.ts` implementing `offersExample`, `buildWorkedExample`, and `recordExampleViewed`.
- Created `src/components/WorkedExample.tsx` rendering sibling worked examples with one-line-at-a-time `"Next line"` reveal for step problems and per-part answer + hint reasons for parts problems.
- Added `WINDOWS.desktop = [1900, 1050]` to `src/components/layoutTesting.ts` and `useDesktopProblemLayout()` (`>= 1440px` wide, `>= 480px` tall) to `src/components/useBreakpoint.ts`.
- Updated `src/App.tsx`, `src/components/PageLayout.tsx`, `src/pages/flows/ProblemFrame.tsx`, `src/pages/review/chrome.tsx`, and `src/pages/Review.tsx`.
- Added unit and jsdom screen tests in `src/problem/workedExample.test.ts` and `src/pages/flows/DesktopProblem.test.tsx`.

## Not done

- Line-by-line examples for `cs.form` and `evenOdd` (their modules do not walk a single-column `nextStep` to `mod.solved`).
- Figure-dependent answer/parts modules (`geometry`, `trigonometry`, `graphFeatures`, `numberLine`, `quantumNumbers`, `eg.match`, `pw.graph`, `pw.write`) where the problem statement relies on an interactive SVG/canvas figure.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run build`

## Files

- `src/App.tsx`
- `src/components/PageLayout.tsx`
- `src/components/WorkedExample.tsx`
- `src/components/layoutTesting.ts`
- `src/components/useBreakpoint.ts`
- `src/pages/Review.tsx`
- `src/pages/flows/DesktopProblem.test.tsx`
- `src/pages/flows/ProblemFrame.tsx`
- `src/pages/review/chrome.tsx`
- `src/problem/workedExample.ts`
- `src/problem/workedExample.test.ts`
- `src/store/types.ts`
- `docs/progress/desk-problem.md`
