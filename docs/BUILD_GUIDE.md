# Precalc Trainer — Build Guide

Interactive precalculus step-verification trainer for one student. She enters each line of
work; the engine decides whether the line is a legal transformation of the previous one, names the
property, and coaches on illegal moves. `SPEC.md` is the brief; `EVALUATION.md` is the
evaluated verdict; `research/` holds the detailed design notes. **Where SPEC.md and research
disagree, research wins** (the spec's random-sampling equivalence test is vacuous for equations).

## 0. Current state (2026-09-15)

| Area | Where | Status |
|---|---|---|
| Engine | `src/engine` (`index.ts` is the API) | Complete. Tier 1 move detectors, Tier 2 solution-set comparison (one variable: boundary method; two variables: x/y slicing), Tier 3 matchers (~30 patterns), swap-x-y gating including ± / or lines, verdict taxonomy, chip grading, counterexamples with side values, parity, one-to-one. `verify.ts` keeps a legacy 2-argument `verifyStep` for old callers only. |
| Notation | `src/notation` | Exact rational solution sets; interval and set-builder parsers with pattern lessons; `compareAnswerSet` / `crossCheck`; LaTeX and calculator formatting. |
| Content | `src/content/modules` | 5 modules: number line (1 template), inequalities (4), even/odd (2), inverses (6: linear, cube root, fraction coefficient, rational, Möbius, quadratic not one-to-one), properties drill (twin-pair bank), difference quotient (4: linear, quadratic, rational, radical; see docs/progress/diff-quotient.md). Tests push every canonical path, and the solve-first alternative for inverses, through the context engine for 25 seeds. |
| Calculator panels | `src/content/calc` | TI-84 Plus CE and TI-Nspire CX II for 11 problem families, expression / k / f(k) / twin substituted. |
| Store | `src/store` | Append-only event log with weekly compaction, attempt resume, selectors (mastery, first-try, hint rate, property accuracy, pattern counts, habits, streak, weak spots), export/import. |
| UI | `src/App.tsx`, `src/pages`, `src/pages/flows`, `src/problem`, `src/components` | Complete. `pages/Problem.tsx` dispatches to the inequality, number-line, even/odd and inverse flows; Home, Module, Progress, Settings, Drill, Sandbox and the PIN gate. Graph and calculator panels stay behind a reveal button until the problem is complete (they show the answer). On phones the panel toolbar sits in the composer, or at the top when a screen has no composer. The first-spike demo UI is removed. |
| Deploy | `Dockerfile`, `nginx.conf`, `docker/`, `.github/workflows`, `deploy/azure.md` | Written. The image builds and passes `deploy/smoke.sh` in GitHub Actions (Docker is not installed on the dev box). On Azure it runs behind Container Apps sign-in with Google plus an email allowlist in nginx (`docker/25-allowlist.sh`, `deploy/azure-setup.sh`). |

**Verification** (2026-09-15): `npm test` 28 files / 297 tests; `npm run test:sweep` pushes every canonical step and its mutations through the engine; browser QA and a two-agent review are recorded in `docs/progress/qa.md` and `docs/progress/review-findings.md` (all 23 findings fixed).

**Progress semantics** (`content/modules/progress.ts`). The anchor is the highest canonical line that
is the *same line* as the student's: each side expression-equivalent, or the sides swapped with the
symbol reversed, matched branch by branch for ± / or / chained lines. Relation equivalence is not used
because every legal line of a problem is an equivalent relation. Results are cached. A legal line on a
different route gets `anchorIndex −1` and `nextStep` returns `null` ("off the usual path"). Completion
uses `ModuleDef.solved` (inequalities: the variable is isolated), never the anchor. Flows display the
best anchor over the attempt's accepted lines so progress never moves backwards.

## 1. Stack (installed)

Vite 7 · React 19 · TypeScript 5.9 · Tailwind 4 (`@tailwindcss/vite`, tokens in `src/index.css`) ·
KaTeX 0.18 · math.js 15 · function-plot 1.25 · Zustand 5 · react-router-dom 7 (HashRouter) ·
Vitest 4 (+ jsdom, Testing Library). Alias `@/` → `src/`.

**Commands** (Bash tool). The package scripts call the tools through `node node_modules/...`, so
both forms work:
```
npm run typecheck          # node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
npm test [-- path]         # node node_modules/vitest/vitest.mjs run [path]
npm run build              # typecheck + node node_modules/vite/bin/vite.js build
npm run dev                # node node_modules/vite/bin/vite.js  (port 5173)
npm run test:sweep         # opt-in: every canonical step + mutations through the engine (~90 s)
```

## 2. Layers, directories, ownership

Imports flow downward only: `shared <- engine <- notation <- content <- ui`.
(`src/components`, `src/pages`, `src/store.ts`, `src/App.tsx` are the UI layer.)

```
src/
  shared/types.ts                 ARCHITECT. Fixed contracts.
  engine/                         ENGINE agent (all files) + MATCHERS agent (matchers/*, catalog)
    index.ts                      public API (section 4) — implement exactly
    math.ts parse.ts samples.ts roots.ts equiv.ts verify.ts   (existing; extend)
    slicing.ts                    NEW: two-variable solution-set comparison by x/y slices
    transforms.ts                 NEW: Tier-1 detectors returning DetectedMove (move existing detect* here)
    rewriteClassifier.ts          NEW: chip sub-classification for same-side rewrites
    counterexample.ts             NEW: nicest witness + message templates + side values
    parity.ts oneToOne.ts         NEW
    matchers/                     MATCHERS agent: catalog.ts (ERROR_PATTERNS, all ids in shared),
                                  index.ts (runMatchers), one file per family; the existing
                                  engine/matchers.ts is the seed — split it, keep its tests green
  notation/                       NOTATION agent
    index.ts                      public API (section 5)
    toLatex.ts calcString.ts      existing; keep
    rational.ts                   NEW exact rationals
    sets/solutionSet.ts           NEW normalize/equality/membership/printers/describe
    sets/interval.ts              MOVED from engine/sets (exact endpoints, all patterns)
    sets/setBuilder.ts            NEW {x | P} → exact SolutionSet (own tiny grammar)
    sets/compare.ts               NEW compareAnswerSet / crossCheck
  content/                        CONTENT agents (one per module) + CALC agent
    types.ts index.ts rng.ts      ARCHITECT. Fixed.
    modules/index.ts              registers every module (ARCHITECT wires it)
    calc/                         CALC agent: extend families; `calcPanels(instance)` helper
    modules/numberLine/           CONTENT-NUMBERLINE agent
    modules/inequalities/         CONTENT-INEQ agent
    modules/evenOdd/              CONTENT-EVENODD agent
    modules/inverses/             CONTENT-INVERSES agent
    modules/propertiesDrill/      CONTENT-DRILL agent
      each: index.ts (ModuleDef), templates/*.ts, stages.ts, hints.ts, *.test.ts
    fixtures/homework.ts          MATCHERS agent (existing seed)
    problems.ts                   legacy demo list — delete once modules exist
  ui (src/App.tsx, src/store/, src/components/, src/pages/, src/problem/)
    UI-SHELL agent (phase A): App.tsx routes, Shell, PinGate, store/ (events, attempt, settings,
      selectors), pages/{Home,Module,Progress,Settings}, components/{Katex,MasteryBar,Toast,
      BottomSheet,SymbolStrip,MathInput,NumberLineSet,CalcPanel,Keycap}, manifest
    UI-WORKSPACE agent (phase B): pages/{Problem,Drill}, problem/* flows, components/{StepInput,
      WorkedColumn,PropertyChips,IntervalInput,SetBuilderInput,VerdictInputs,HintRail,Graph,CheckIt}
deploy/, Dockerfile, nginx.conf, .github/workflows/   DEPLOY agent
```

## 3. Conventions

- Colocated tests. Pure layers (engine/notation/content) must have zero DOM/React imports.
- App syntax (what the student types, what content stores): ASCII, `sqrt(u)`, `cbrt(u)`, `abs(u)`,
  `^`, `/`, implicit multiplication, relations `= < <= > >=`, `or`, `and`, chained `a < E <= b`,
  `+-E` (±). `pi` allowed. Variables: `x`, `y`, `n`, plus `h` only in problems that own it (difference quotient: `vars: ['x', 'h']`). `f^-1(x)`, `finv(x)`, `f^(-1)(x)` and
  `f(x)` on the LEFT of `=` are aliases for `y`.
- Numbers shown to the student snap to integers/simple fractions when within 1e-9 (`niceNumber`).
- Tone: coach, not grader. Every rejection names the property or shows the counterexample.
- Palette tokens (`src/index.css`): navy, coral, coral-700 (text on white), gold, gold-text,
  ok, bad. Never raw hex in components. Color is never the only signal (✓/✗ + words).

## 4. Engine public API (`src/engine/index.ts`)

```ts
import type { VarName, StepContext, StepResult, ParseError, Counterexample, ChipId, ErrorPatternId, ErrorPatternInfo, RelOp } from '@/shared/types'
import type { MathNode } from 'mathjs'

export interface Relation { lhs: MathNode; rhs: MathNode; op: RelOp; lhsSrc: string; rhsSrc: string }
export interface Statement { disjuncts: Relation[][]; source: string; vars: string[] }   // OR of ANDs (existing shape)

export function normalizeInput(text: string): string                                 // = existing normalizeGlyphs + f^-1(x)→y aliases
export function parseStatement(text: string, vars?: VarName[]): { ok: true; statement: Statement } | { ok: false; error: ParseError }
export function parseExpression(text: string, vars?: VarName[]): { ok: true; node: MathNode; text: string } | { ok: false; error: ParseError }
export function compileExpr(text: string): (scope: Partial<Record<VarName, number>>) => number | 'undef'
export function evaluateExpr(text: string, scope: Partial<Record<VarName, number>>): number | 'undef'
export function exprEquivalent(a: string, b: string, vars?: VarName[], seed?: number): { equivalent: boolean; witness?: Counterexample; undecidable?: boolean }
export function verifyStep(prev: string, next: string, ctx: StepContext): StepResult      // relation mode
export function verifyRewrite(prev: string, next: string, ctx: StepContext): StepResult   // expression mode (even/odd slots, drill)
export function classifyRewrite(prev: string, next: string, vars?: VarName[]): { chip: ChipId; confidence: 'high' | 'medium' | 'low' }
export function substituteNegX(f: string): string       // "(-x)^3 - 2(-x)"  (unsimplified, app syntax)
export function negateExpr(f: string): string           // "-(x^3 - 2x)"
export function checkParity(f: string, seed?: number): { verdict: 'even' | 'odd' | 'neither'; reason: 'domain_asymmetric' | 'values'; table: { k: number; fk: number | 'undef'; fNegK: number | 'undef' }[] }
export function isOneToOne(f: string, seed?: number): { oneToOne: boolean; witness?: { a: number; b: number; y: number } }
export function statementHolds(stmt: Statement, scope: Record<string, number>): boolean | 'undef'
export function niceNumber(v: number): string
export const ERROR_PATTERNS: Record<ErrorPatternId, ErrorPatternInfo>   // engine/matchers/catalog.ts
```

Verdict/acceptance policy (`research/engine-design.md` §4–6, `research/error-patterns-and-hints.md`):
- Tier 1 detectors first (rewrite / swap sides / add-sub / mul-div / power / root / reciprocal /
  swap-vars). A hit yields `detected` (tag, chip, exact, constant, detail).
- `swap_xy` only when `ctx.allowSwap`; result `swapped: true`, verdict `equivalent_by_rename`.
  Without `allowSwap` the same pair is `not_equivalent` with pattern `swap_misname` when the
  student renamed only one letter, else the counterexample.
- Inequality × negative constant without flipping → `not_equivalent` + `no_sign_flip`; flipped on
  positive → `flip_on_positive`; flipped on add/sub → `flip_on_add`; swapped sides without
  reversing → `swap_sides_no_reverse`; non-constant multiplier on an inequality →
  `nonconstant_multiplier_inequality`.
- Equations: `mul_div` with a NON-constant ratio (e.g. multiply by (y+3)) defers to Tier 2; accept
  when solution sets agree; `extraneous_superset` → accept with `caveat: 'extraneous_check'` and
  pattern `squaring_caveat` info; `lost_subset` → reject with `divide_by_variable` or `dropped_pm`.
- Tier 2: one variable → existing boundary method (add domain points and tangential roots);
  two variables → `slicing.ts`: fix x ∈ {−8,−5,−3,−2,−1,−0.5,0.5,1,2,3,5,8, k}, root-find in y on
  [−60,60] for both statements, compare; then fix y and root-find in x. Both directions mandatory.
- Tier 3: matchers only explain rejections; else `counterexample` (nicest point, both sides' values).
- `acceptableChips`: exact chip for both-sides moves; whole `REWRITE_CHIPS` for rewrites unless
  `classifyRewrite` is `high` (then that chip only). If `ctx.canonical` has a line equivalent to
  `next` and `prev` is equivalent to the preceding canonical line, prefer the canonical tag's chip.
- Never accept `undecidable`.

## 5. Notation public API (`src/notation/index.ts`)

```ts
export { type Rational, rat, ratFromString, ratToString, ratCompare, ratToNumber, ratFromNumber } from './rational'
export { toLatex, nodeToLatex, statementToLatex } from './toLatex'
export { toTi84, toNspire } from './calcString'
export function normalizeSet(set: SolutionSet): SolutionSet
export function setsEqual(a: SolutionSet, b: SolutionSet): boolean
export function setContains(set: SolutionSet, v: Rational | number): boolean
export function setFromPieces(pieces: Piece[], points?: Rational[]): SolutionSet     // normalizes
export function setToInterval(set: SolutionSet): string        // "(-inf, -2] U (5, inf)" / "{}" / "(-inf, inf)"
export function setToSetBuilder(set: SolutionSet): string      // "{x | x <= -2 or x > 5}"
export function setToLatex(set: SolutionSet, form: 'interval' | 'builder'): string
export function describeSet(set: SolutionSet): string          // aria text for the number line
export function parseInterval(text: string): { ok: true; set: SolutionSet; pieceCount: number; note?: string } | { ok: false; error: ParseError; pattern?: PatternHit }
export function parseSetBuilder(text: string): { ok: true; set: SolutionSet } | { ok: false; error: ParseError; pattern?: PatternHit }
export function compareAnswerSet(student: SolutionSet, target: SolutionSet): { equal: boolean; pattern?: PatternHit; witness?: Rational }
export function crossCheck(interval: SolutionSet, builder: SolutionSet): { agree: boolean; pattern?: PatternHit; witness?: Rational }   // set_interval_mismatch
export function setFromRelation(text: string): SolutionSet | null   // "x >= 3/5", "-2 < x <= 5", "x < -2 or x > 5" → exact set (used by content)
```

Interval grammar and messages: `research/scope-defaults-and-tests.md` §A rows 16–18 and
`research/error-patterns-and-hints.md` "Answer matchers". Endpoints: integers, fractions `-7/4`,
decimals; `inf|∞|infinity|oo`; union `U|u|∪|or`; `{a, b}`; `{}`/`∅`/`DNE`; `R`.

## 6. Content public API (`src/content/index.ts`) — implemented; modules register themselves

Each module folder exports a `ModuleDef` and calls `registerModule(def)` from
`src/content/modules/index.ts`. Templates, constraints, canonical paths, hints, check values:
`research/content-templates.md`. Property tags on canonical steps must be `PropertyTag`s.
`ModuleDef.progress`/`nextStep` anchor on the student's CURRENT line (find the highest canonical
line equivalent to it via the engine), never on her step count.

Self-consistency tests are mandatory for every template: for ≥25 seeds, feed the canonical lines
through `verifyStep` sequentially (with `allowSwap` for inverses) and assert every step is accepted;
for inverses assert `finv(f(k)) == k` numerically; for sets assert the answer set round-trips
through `parseInterval(setToInterval(set))`.

Calculator panels: content modules call `calcPanels(instance)` from `content/calc` (CALC agent)
which returns `Record<CalcId, CalcStep[]>` for the instance's family with the expression, inverse
and check value substituted.

## 7. UI

Screens/routes, keymap, mobile composer, localStorage schema, mastery definition:
`research/ux-mobile-progress.md` (Reference section). HashRouter routes:
`/`, `/m/:moduleId`, `/p/:moduleId/:templateId/:seed?d=…`, `/drill`, `/progress`, `/settings`,
`/sandbox`. PIN gate reads `window.__PRECALC_CONFIG__.pinHash` (SHA-256 hex; empty = no gate). Settings shows a Sign out link when `signOutUrl` is set (the container sets it unless `AUTH_ALLOWLIST=off`).

Problem-page flows by kind:
- **inequality**: worked column starts at `instance.start`; steps until progress says solved; then
  final answer: interval input + set-builder input (both required; cross-checked; patterns 1–3, 10).
- **numberLine**: number line SVG of `answer.set`; interval + set-builder inputs only.
- **evenOdd**: two mini step columns (slot A first line ≡ f(−x), slot B first line ≡ −f(x); later
  lines are rewrites via `verifyRewrite`), then verdict + reason; plug-in table shown after.
- **inverse**: one-to-one verdict first (+ reason if "no"); if yes: steps from `y = f(x)` to
  `f^-1(x) = …` (swap allowed once), then "check it": she types f(k) and f⁻¹(f(k)); if no: show the
  twin evidence f(k) = f(twin), optional bonus path.
- **diffQuotient**: part 1 the f(x + h) line (engine `checkFxhLine`); part 2 starts from (f(x + h) − (f(x)))/h with her
  line dropped in, every line checked by `checkDqLine` (rewrite of the previous line + equivalent to the DQ); finished
  when the line is simplified (defined at h = 0). Secant sketch behind the graph gate; no calculator panel.
- **drill**: `/drill`: which-property (chips) and legal-or-illegal items from `generateDrill`.

Hints: rung 1 nudge, rung 2 rule card, rung 3 reveal `nextStep(...)` (marks the step revealed).
Idle nudge once per attempt after 4 visible minutes. Property chip prompt after each accepted step
(default on; Enter skips; recorded correct/wrong/skipped; never penalized).

## 8. Phases

- **A (parallel)**: ENGINE, NOTATION, CALC, UI-SHELL, DEPLOY.
- **B (parallel, after A)**: MATCHERS, five CONTENT modules, UI-WORKSPACE.
- **C**: wiring (`content/modules/index.ts`), full tests, build, browser QA, review, fixes.
