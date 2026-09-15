# Precalc Practice System — Spec Evaluation

Evaluated 2026-09-13/14 against `docs/SPEC.md`, with the amendment that the calculator panel must cover
both the **TI-84 Plus CE** and the **TI-Nspire CX II (non-CAS)**. Seven independent reviews (engine
math, error patterns/pedagogy, content generation, calculators, deployment, UX/mobile, scope/tests)
were run and their major claims were adversarially checked; the detailed material lives in
`docs/research/`.

## 1. Verdict

The spec is buildable and its product idea is right: verify every line, name the property, coach
the illegal move at the moment it happens. Its core algorithm is not right. The equation check as
written ("sample ~12 random x, verify f_old(v)=0 ⟺ f_new(v)=0") is vacuously true for almost every
pair of lines because random reals never land on a root, so it would accept `x+1=5 → x+1=7` and
`x²=9 → x=3`. The inequality truth-value check is sound but blind at boundaries (`x<3` vs `x≤3`).
Two further gaps block the inverse module: "swap x and y" is not an equivalence, and the step
language has no `±`/`or`. All of these have clean fixes, listed below, and the build follows them.

## 2. What the spec gets right

- Numeric, not symbolic: sampling-based checks with a proper solution-set method are robust and fast.
- Error-pattern coaching seeded from her real mistakes, plus "which property?" chips, targets the
  actual weakness (which manipulations the properties permit).
- Structured final-answer inputs (interval, set-builder, one-to-one verdict, even/odd evidence).
- Deterministic seeded generators with a full canonical path per instance.
- Static SPA + nginx container on Azure Container Apps scale-to-zero is the right cost point.

## 3. Must-change items (all adopted)

| # | Problem in the spec | Decision |
|---|---|---|
| 1 | Random-sample zero-set test is vacuous for equations. | Three tiers: (1) structural move detection on the two sides — rewrite (sides equivalent), swap sides, add/subtract both (L'−L ≡ R'−R), multiply/divide both (L'/L ≡ R'/R), cube/square, root, reciprocal, variable rename; (2) solution-set comparison by root-finding: for one variable, find boundary points of both lines and compare truth at each boundary, midpoint and beyond; for two variables, fix x and root-find in y, then fix y and root-find in x; (3) error-pattern matchers only explain rejections. |
| 2 | math.js treats `=` as assignment, `x(y+2)` as a function call, `xy` as one symbol, and returns complex numbers for `sqrt(-4)` and `(-8)^(1/3)`. | Own relation splitter (never hand `=` to math.js), implicit-multiplication tokenizer, `math.create(all, {predictable: true})`, rewrite `E^(p/q)` with odd q to a real root, treat NaN/Infinity/errors as "undefined at this sample". |
| 3 | "Swap x and y" is a reflection, not an equivalence; any correct checker rejects it. | Dedicated `swap_xy` step kind (new line ≡ old line with x↔y), allowed once per inverse problem, accepted in either textbook order (swap first or solve first). |
| 4 | No way to write `x = ±3`, `x = 2 or x = -2`, `-3 < 2x+1 ≤ 5`. | Statement = OR of ANDs of relations; grammar accepts `or`, `and`, chained inequalities, `+-`/`±`. Solution set = union/intersection. |
| 5 | Squaring both sides and even roots change the solution set; spec lists them as legal chips with no policy. | Verdicts `equivalent / extraneous_superset / lost_subset / not_equivalent / undecidable`. Squaring → accepted with a "check for extraneous solutions" caveat; a lost root (`x²=9 → x=3`) → rejected with the concrete lost value and the ± lesson; that same evidence feeds the "not one-to-one" reason for quadratics. |
| 6 | Inequality sampling cannot see strict vs non-strict or domain edges. | Test at the boundary points themselves (roots of both lines and domain edges) plus midpoints; tolerance-aware `<` vs `≤`. |
| 7 | Interval/set comparison "by sampling" misses open/closed endpoints and isolated points. | Exact solution-set model (rational endpoints, normalized pieces + points); set-builder predicates are evaluated at every critical value and midpoint, which is exact for this class of sets. |
| 8 | Canonical-path hints and "3 of 5 steps" break as soon as she takes a different legal route. | Hints and progress anchor on her *current* line (highest canonical line equivalent to it, or structural stage predicates), never on her step count; inverse paths stored in both orders. |
| 9 | Five of the eleven "error patterns" are not step matchers (interval notation checks, set/interval mismatch, idle). | Three interfaces: step matchers, answer matchers, idle watcher. Plus ~15 additional high-frequency patterns (term moved across `=` without sign change, exponent distributed over a sum, `c/(a+b)` split, cancelling a term, adding denominators, `√(u²)=u`, dividing by a variable expression, combining unlike terms, `(−x)ⁿ` sign, f(−x) substitution errors, f⁻¹ = 1/f). |
| 10 | Calculator panel was TI-84 only; the Nspire has no DrawInv, no DRAW→Horizontal, different root/fraction templates and a different table workflow. | Two keystroke template sets per problem family, tabbed, expression and check value substituted into both. Nspire inverse via Graph Entry/Edit → Relation `x=f1(y)`; Zoom-Square is menu 4 → B; table via ctrl+T with Independent: Ask; cube roots via the nth-root template (Real complex-format). TI-84 CE line-style is a Color/Line dialog, not a cycling key. |
| 11 | "PIN hash baked at build time" contradicts "APP_PIN via Container Apps secret → env" and "no API". | Runtime injection: the nginx entrypoint writes `config.js` with the SHA-256 of `APP_PIN`; the SPA checks it with WebCrypto. Documented honestly as a deterrent, not security. |
| 12 | Coral (#F96167) and gold (#F9E795) fail WCAG contrast on white; "green/red" are not in the palette. | Derived tokens: coral-700 for text/buttons, gold-text for text on gold, an explicit success green; icons and words always accompany color. |
| 13 | Aggregated counters cannot produce "sign-flip errors: 4 → 0 this week". | Append-only event log in localStorage (compacted after 60 days) with derived selectors; export/import JSON; web-app manifest + Add-to-Home-Screen prompt because iOS Safari deletes localStorage after 7 days without use. |
| 14 | Clean-number constraints stated only on answers. | Choose the clean target first (solution, check value, cube root, divisor) and derive coefficients; e.g. `cbrt(7x+3)` has no integer check value at all (cubes mod 7 ∈ {0,1,6}), so `b = m³ − a·k` is set from the chosen root and check value. |

## 4. Decisions and assumptions (defaults the build uses)

| Topic | Decision |
|---|---|
| React version | React 19 with Vite 7 (spec says 18; 19 is the current template default and Zustand/KaTeX/function-plot are unaffected). |
| Tailwind | v4 via `@tailwindcss/vite`, palette as `@theme` tokens. |
| Routing | HashRouter, canonical problem URL `#/p/<module>/<template>/<seed36>?d=<knobs>`; generator version stored per template. |
| Property chip | Prompt after every accepted step (setting, default on); Enter skips; recorded correct/wrong/skipped; never penalized; mandatory only in the drill. |
| Final answer for inverses | `f^-1(x) = …`, `finv(x) = …` or `y = …`, compared as an expression to the canonical inverse. NOT case: verdict + reason + twin check; restricted-domain inverse is a bonus. |
| Even/odd | Two evidence slots, first line must equal f(−x) / −f(x), later lines are rewrites; asymmetric domain ⇒ "neither" with that reason. |
| Number line module | Number line → notation only (graded); every interval input shows a live number-line preview. |
| Parse errors | Never count as attempts; caret at the character index; a bare expression in relation mode is rejected with "each line needs both sides and =, <, ≤, >, ≥". |
| Hint cost | Nudge and rule card are free; "show the step" marks that step revealed (excluded from first-try mastery). |
| Mastery | Per template family, rolling last 5 completed attempts, ≥80% first-try with no reveals and correct finals; nothing is ever locked. |
| Idle nudge | Once per attempt after 4 visible-tab minutes; a banner with progress, never content. |
| Calculator selection | Segmented control TI-84 Plus CE / TI-Nspire CX II, remembered in settings. |
| Graph | function-plot with the height derived from width so units are square; inverse in coral dashed; y = x dotted gray; not-one-to-one reflections drawn parametrically with a "fails vertical line test" badge. |

## 5. Scope changes vs the spec

- Both calculators (user amendment).
- ~15 additional error patterns beyond the seeded eleven; the idle nudge is tracked as a habit metric, not an error.
- Chips gained `swap sides`, `swap x and y`, `simplify arithmetic`, `rename to f⁻¹(x)`.
- Export/import of progress and an Add-to-Home-Screen prompt (persistence on iPhone).
- A Sandbox page (type any two lines, see the engine's verdict) for the parent to test the engine.

## 6. Risks, ranked

1. **Engine false verdicts on unusual student routes.** Mitigated by the three-tier design, the
   homework fixture corpus that the parent extends, and self-consistency tests that push every
   generated canonical path through the real engine.
2. **Two-variable steps in Möbius/rational inverses** (multiplying by `(y+3)` is a non-constant
   multiplier). Handled by the x/y slicing comparison; must be tested per family.
3. **Calculator keystrokes vary by OS version** (Nspire Relation graphing needs a current OS; CE
   dialog layouts). Panels carry a footer stating the OS versions they were written for.
4. **iOS Safari storage eviction** after 7 days idle. Manifest + A2HS + export/import.
5. **Client-side PIN is a speed bump only.** Documented; upgrade path is nginx basic auth or a tiny
   API later.
6. **Cold starts on scale-to-zero** (a few seconds on first open each day). Acceptable at family
   usage; Static Web Apps is the $0 alternative if the API never materializes.

## 7. Test plan (Vitest)

- Engine: the 30 verdict cases in `research/engine-design.md` §9 (sign flip, minus teleport, lost
  and extraneous roots, swap, cube root, chained inequalities, strict vs non-strict, poles,
  tangential roots, relative tolerance at large magnitudes).
- Matchers: one positive fixture and cross-negatives per pattern; `content/fixtures/homework.ts`
  is the growing corpus.
- Notation: interval grammar, every specific rejection message, normalization equalities,
  set-builder ↔ interval agreement.
- Content: determinism snapshots per template version, clean-number constraints, self-consistency
  of every canonical path through the engine, inverse round-trips at the stored check value,
  calculator panels rendered for every family and both calculators.
- UI: idle nudge with fake timers, chip skipping, interval builder/text parity.

## 8. Build status (2026-09-15)

- **Environment.** No Node.js existed on the machine; a portable Node 22 with npm 12 lives in
  `C:\Users\cohenjas\bin` and is visible to Git Bash only.
- **Built.** All five modules: number line (1 template), inequalities (4), even/odd (2), inverses (6,
  including quadratic not one-to-one, rational and Möbius) and the properties drill. Problem pages for
  all four problem kinds, Home, Module, Progress, Settings, Drill, Sandbox and the PIN gate. Calculator
  panels for the TI-84 Plus CE and the TI-Nspire CX II on every problem family. Container, nginx,
  GitHub Actions and the Azure guide are written.
- **Verified.**

  | Check | Result |
  |---|---|
  | Unit and page tests | 28 files, 297 tests passing |
  | Engine sweep (`npm run test:sweep`) | every canonical step of 10 templates, correct, side-swapped and three broken variants: no false accepts, no false rejects |
  | Browser QA | every flow walked end to end at desktop width, the phone layout checked at 375 px, no console errors on a fresh load |
  | Two-agent review | 23 findings, all fixed, each with a regression test that failed before the fix |
  | Production build | succeeds; the graphing library loads only on a problem page |

- **Biggest fixes from QA and review.** A sign-flip mistake taught with the wrong lesson; progress that
  looked solved after one step; the answer visible up front in the graph and calculator panels; hints
  and calculator unreachable on phones on several screens; ± answers read as multiplication; one-line
  cube-root inverses rejected; wrong chips graded correct; a digit that starts the next line recorded
  as a chip answer; wrong final answers not counting against mastery.
- **Still needs a person.** Try the store-and-test keystrokes on the real calculators (TI-84 `2nd ENTER`
  twice to recall a test; Nspire `ctrl var` for the store arrow). Check that Enter submits an answer on
  a real keyboard (automated key presses did not submit in the preview pane). The first container
  build and Azure deploy have not run: Docker is not installed on this machine, so CI will be the first
  place `deploy/smoke.sh` runs.
