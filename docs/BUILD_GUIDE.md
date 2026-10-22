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
| Store | `src/store` | Append-only event log with weekly compaction, attempt resume, selectors (mastery, first-try, hint rate, property accuracy, pattern counts, habits, streak, weak spots), rewards (`rewards.ts`: XP, daily goal, goal streak, mistake cards, type rings; slice `pct.rewards`), export/import. |
| UI | `src/App.tsx`, `src/pages`, `src/pages/flows`, `src/problem`, `src/components` | Complete. `pages/Problem.tsx` dispatches to the inequality, number-line, even/odd and inverse flows; Home, Module, Progress, Settings, Drill, Sandbox and the PIN gate. Graph and calculator panels stay behind a reveal button until the problem is complete (they show the answer). On phones the panel toolbar sits in the composer, or at the top when a screen has no composer. The first-spike demo UI is removed. Sets of three problems (`/set`, `src/session`) and the phone's bottom tab bar: §7. Guided mode (pick the next line from three cards; exponential and log equations): §7. Juice (sounds, the combo, confetti and motion, the streak flame and milestones; `src/components/juice`): §7. Home's unit path (the unit as a road of its problem types, "You are here", no locks; `src/components/path`): §7. Mistake Monsters (every named mistake a monster to catch and squash, the Monsters tab; `src/components/monsters`): §7. The grapher (the Graph tab, "Graph it" from a problem; `src/grapher`, `src/components/grapher`): §7. |
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
`/`, `/m/:moduleId`, `/p/:moduleId/:templateId/:seed?d=…`, `/set`, `/drill`, `/progress`, `/settings`,
`/sandbox`. PIN gate reads `window.__PRECALC_CONFIG__.pinHash` (SHA-256 hex; empty = no gate). Settings shows a Sign out link when `signOutUrl` is set (the container sets it unless `AUTH_ALLOWLIST=off`).

Every math answer box opts into the phone math keypad (touch screens only; desktop is unchanged): use
`MathInput` (automatic), `PolyTextBox` with `keypad={{ keys, vars }}`, `MathTextInput` in place of a plain
`<input>`, or `useMathKeypad` in your own component; a flow that renders `SymbolStrip` itself hides it when
`useMathKeypadOn()` is true. Ready-made key sets: `KEYPAD_SETS` in `src/components/keypadKeys.ts`. See
`docs/progress/phone-keypad.md`.

On a phone (`useBreakpoint() === 'mobile'`) `ProblemFrame` draws the compact problem screen: × + title + progress
dots, the problem pinned at the top once its card scrolls away, and the verdict where she is looking. A composer flow
passes `lineVerdict` (`engineVerdict(engine)` for a step engine, else its own `LineVerdict` from
`components/ComposerVerdict.tsx`) so the composer names the mistake above her input; a hint ladder calls
`useStuckRequest(rung, advance, disabled)` so "Stuck?" can take the next hint; a wrong-answer card renders
`<StuckChip />` under itself. On every screen, leaving a problem with her work in it is asked in the app's own sheet
(`useAttemptLifecycle` returns `{ attempt, leaveQuestion }`; the Problem page shows `LeaveProblemSheet`), and the
completion card replaces the completion toast. See `docs/progress/phone-screen.md`.

Rewards (Settings "Rewards (XP, daily goal, streak)": on by default in the store app, off in the family app): XP, the
daily goal, the streak with rest days and the mistake collection are pure functions of the event log in
`store/rewards.ts`, shown by `components/rewards/*` on the phone's finish sheet (the completion card on a wide screen),
the top of Home and Progress. A line is a `step_accepted`; a part is a right `final_answer` (the wrong checks since the
last right one are its mistakes), so a check that grades several boxes every time logs `part` on each record. The slice
`pct.rewards` keeps what the 60-day compaction deletes; `compactNow` settles and folds it first. See
`docs/progress/phone-rewards.md`.

Sets (works with rewards on or off): Home's "Start a set" builds three problems from the class selected on Home
(`session/buildSet.ts`, pure: her top open mistake card's type, a mastered type due for review, then the working unit's
types not yet mastered, Practiced and Solid before New, then the next unit), keeps ONE active set in `pct.set`
(`session/activeSet.ts`, versioned and checked on read like `pages/review/session.ts`) and runs it on route `/set`
(`pages/SetPage.tsx`) on the usual problem screen: `SetChromeProvider` (`pages/set/chrome.tsx`) gives ProblemFrame the
set's dots (the phone header; the completion area and a bar on a wide screen), Skip, and the main button ("Next in
set", then "See results"). Skip is in the phone header's ⋯ menu and in the leave sheet; it counts as skipped
(`leaveAttempt`: `problem_abandoned` only when she had work in it), never as a wrong answer. **The ad seam**: "See
results" calls `setEndBreak(go, { timed })` (`session/breaks.ts`) exactly once per set, `go` showing the results; the
store app registers its announced interstitial with `registerSetEndBreak`. Nothing else may call it (not "Next in set",
"Another set" or "Start a set"), and nothing in this repo shows an ad. The results (`components/set/SetSummary.tsx`,
`session/summary.ts`) add up the rewards' own awards and rings; no XP rules of their own.

Navigation by screen size: on a phone, menu screens show the bottom tab bar (`components/TabBar.tsx`: Home, Monsters,
Graph, Progress, Settings on every screen, `tabItems` in `components/navItems.tsx`; the wide top navigation shows the same
five, then Ask while the tutor is configured and the Sandbox in the family app; the drill has no tab and keeps `/drill`,
reached from its module in Unit 1 and from Progress) and the top navigation hides; a problem screen or a
running set shows neither (`components/appChrome.ts`: the `/p` and `/set` routes, and any page that calls
`useFullScreenPage()`, as ProblemFrame and the review's running set do). While the bar is up, `--tabbar-h` on `<html>`
keeps its room at the bottom (body padding, scroll padding, toasts), as `--keypad-h` does for the keypad. Wide screens
keep the top navigation everywhere. The set runner, the results, the tab bar and the Today pieces
(`components/set/TodaySet.tsx`) never read the screen size; only page layouts do. See `docs/progress/phone-session.md`.

Guided mode (works with rewards on or off; exponential and log equations so far): a "Type" / "Pick" switch
(`components/LineCards.tsx`, remembered in `settings.lineEntry`, a device setting) on problem types that offer cards
(`problem/cardSources.ts`). Pick shows three cards in the composer: the path's next line and two wrong lines, each
what a named mistake turns her current line into (the engine's own slips, `logLineSlips`), confirmed by the checker
as exactly that mistake; the pure, generic builder is `problem/lineCards.ts` (ranking, checks, an order fixed by the
seed and the line). A picked card goes through the checker as the same line typed would: a right one is the same
`step_accepted` with `via: 'card'`, a wrong one the same `step_rejected` with its pattern and `via: 'card'`. While she
types, the hints (and so Stuck?) offer the cards for one line first (`ProblemFrame`'s `pickLine`). Honest by the
store's rules: a picked line pays +4 on the first pick and 0 after a wrong one (`rewards.ts`); a step type (the
canonical step's rule card, `step_accepted.rule`) picked right twice since she last typed one is typed next
(`selectors.ts` `typeThisTime`); a problem with a picked line (`problem_done.picked`) stays out of the mastery
window, the rings and the compaction's kept five (`compaction.ts` `inMasteryWindow`). A line kept after its cards were
shown counts as picked however she entered it (`Attempt.picks`). The answer is always typed. To add a line-by-line
type, add its source to `cardSources.ts`. See `docs/progress/phone-guided.md`.

Juice (works with rewards on or off; `components/juice`): sounds synthesized with Web Audio (`sounds.ts`: one AudioContext
made lazily and woken by a gesture, asleep when idle or hidden, silent where Web Audio is missing or blocked), chosen per
moment from the event log by `useJuice.ts` + `cues.ts` (mounted once in the app shell; only for events she just added, as
the vibrate tick): a chime that climbs with the combo, a soft "nope" for a slip, an arpeggio at a finish, and with rewards
on a pop for a squashed mistake and a sparkle for the goal or a streak milestone; the set's results play a fanfare
(`SetSummary`). Settings "Sounds" (`settings.sounds`, a device setting like Vibrate): on by default in the store app, off
in the family app. The combo (`session/combo.ts`, pure): right lines and parts in a row on the first try, over the problem
and the running set's earlier problems (`SetChrome.attemptIds`); a slip resets it. Its pill (`ComboPill`, rewards on, from
3) is in the composer (a phone: above the verdict line; a wide screen: the top of the composer box), or in a sticky dock
above the keypad where a problem has no composer. Motion, all off under prefers-reduced-motion (`motion.ts`; where the
preference cannot be read, nothing moves): a kept line flashes and its check pops (`WorkedColumn`, which marks each row
`data-kept-step`), "+10" rises from the line or part that earned it (rewards on), XP counts up on the finish sheet and the
set's results (`CountUp`), confetti (CSS particles) on the set's results, the goal met, a type newly mastered and a streak
milestone, rings sweep from before to now (`GoalRing from`), and `btn-chunky` (index.css) gives the main actions (every
Check, the keypad's Check, Start a set, Next problem / Next in set / See results, Another set) a darker edge that presses
down. The streak: a flame on the Today card (none, 1-6, 7-29, 30+ days; lit, with one flare a day, once today's goal is
met) and a one-time banner the first time the streak reaches 7, 30 and 100 days (`RewardsState.milestones`, in backups;
`store/milestones.ts`). See `docs/progress/phone-juice.md`.

The unit path (works with rewards on or off; `components/path`, every screen size): Home shows the selected unit as a
road of its problem types in course order (`pathModel.ts` `unitPath`, from the set builder's own `classTypes`), winding
over five lanes, a signpost where each module begins (its title and the step-by-step mark), and in place of the module
cards a compact "Modules in this unit" list of module-page links (the drill, with no types, is only there). Each stop is a
button with the rewards' ring (`skillRings`: New grey, Practiced navy part-filled, Solid and Mastered green with a check),
named "type: state. In module." and "You are here" first on the type "Start a set" would start with (`setStart` calls
`pickSetTypes` with what Home's button passes it, so the two never disagree; when that type is in another unit the
header says so and offers that unit). A stop opens a sheet (phone) or popover (wide) that keeps focus in: "Practice this
type" and "About this module". The unit's review is a trophy at the end (Unit 1), else a finish flag with "N of M types
solid". Nothing is ever locked or disabled. A stop that levelled up since the path last showed it pops once and its ring
sweeps, when it comes into view (`pathMemory.ts`: what the path last showed, device memory in `pct.path`, not in backups;
nothing under reduced motion, nothing on a device's first visit); "You are here" pulses where motion is allowed. See
`docs/progress/phone-path.md`.

Mistake Monsters (works with rewards on or off; `components/monsters`, every screen size): every named mistake is a
variant of one of 33 species (`species.ts`: a hand-written table that places every catalog id, and a test fails on an
id with no place, so a new mistake must be placed there; `NOT_MONSTERS` lists the three catalog entries that are never
mistakes; the store app shows the 26 math species). The art is drawn in code (`art.ts`, pure, deterministic: the species
fixes the body, colours, top, eyes, mouth, feet and its own sign; each id adds a pattern, an accessory, an eye count and
a colour shift that no sibling shares; an unseen variant is its species' silhouette with a "?"), rendered by `MonsterArt`
(decorative). The first time she makes a mistake she never made before (`store/catches.ts` `firstCatches`: not in her
log, the folded cards or `RewardsState.caught`), the verdict that names it shows its monster, "Caught: <name>", flipping
in (`CaughtBanner`; decided by `useMonsterCatches`, mounted once in the shell, only for events she just added, and
remembered with the store's `noteCatches`, in backups), with the "catch" cue in place of the nope (Sounds on); after that
its small avatar sits beside the title (`MistakeAvatar`: `RejectionCard`, the composer's verdict line, `SigFigRejection`
and `PatternLesson`, the interval answer card). A squash (the rewards decide) shows as `SquashMoment` (a splat, the card
turning gold) in the finish sheet and the wide completion card, and with rewards off in the completion card; the pop
plays rewards on or off. The Monsters tab (`/monsters`, `pages/Monsters.tsx`, lazy): "N squashed · M on the loose",
species by species (open once she has met one), caught in colour with ×count and squash pips, squashed in gold, not seen
as a silhouette, rare ones (`RARE`, hand-marked special cases) in a sparkle frame; a tile opens the monster's card
(`MonsterCard.tsx`: lesson, example, where she last caught it, "Practice this"; focus kept in, Escape closes). XP only
with rewards on. Reduced motion: no flip, wiggle, splat or twinkle. See `docs/progress/phone-monsters.md`.

The grapher (the Graph tab, `/graph`, `pages/Grapher.tsx`, lazy; every screen size, both editions): rows typed on the math
keypad (`KEYPAD_SETS.graph`; the keypad's Check key reads "Next" there, `enter` on `useMathKeypad`), each with a swatch
(show or hide), a KaTeX preview and an error that says what it cannot read; a canvas plane with pan, pinch, wheel, + and −,
Zoom to fit and the standard window; points of interest (zeros, maxima and minima, y-intercepts, crossings) as dots and as
a list of buttons; sliders for any other letter; the TI-84's TABLE; RADIAN or DEGREE. The pure core is `src/grapher`
(parse.ts reads rows with the engine's own `parseExpression`, compile.ts makes fast closures with the engine's meaning,
sample.ts cuts each curve at the zeros of its critical sub-expressions, poi.ts, fit.ts, view.ts, table.ts, format.ts,
state.ts, graphIt.ts); the React parts are `components/grapher`. The graph stays on the device (`pct.graph`, not in
backups). "Graph it" (`GraphItButton`) opens the grapher from a problem with what the problem shows her (its given
function, or her own final equation in optimization), never its hidden answer (`grapher/graphIt.ts` per problem type),
in the problem's window; Back returns to the problem with her work. See `docs/progress/app-grapher.md`.

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
