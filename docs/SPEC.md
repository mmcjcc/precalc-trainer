# Precalc Practice System — Build Spec

## Purpose

Interactive test-prep web app for a high-school precalculus student. She solves
problems **step by step**, entering each line of work; the system verifies every step is a
*legal* transformation, names the property that justifies it, and coaches her when a move
is illegal. Her known weak spot: remembering which manipulations the basic properties
(commutative, associative, distributive, inverse operations, equality/inequality
properties) actually permit — she makes one illegal "shortcut" per problem, not
conceptual errors. The system must catch the illegal move at the moment it happens and
say *why* it's illegal.

Secondary features: generate fresh similar problems, graph any problem ("Graph it"), and
show TI-84 Plus CE instructions for reproducing the graph/check on her calculator.

## Users and access

- Single primary user (student) + parent occasionally reviewing progress.
- Hosted in the parent's Azure subscription (Container Apps). Access gated by a shared
  PIN stored in an env var (`APP_PIN`), checked client-side against a hash baked at
  build time or via the API. No accounts, no PII stored server-side.
- Progress persists in `localStorage` (per-device is acceptable for v1).

## Tech stack

- **Vite + React 18 + TypeScript**, single-page app.
- **KaTeX** for all math rendering. Student input is plain calculator-style text
  (`(x+1)^3 = 7y+3`, `cbrt(7x+3)-1`, `3/(x+2)`); render a live KaTeX preview as she
  types. Support `sqrt()`, `cbrt()`, `abs()`, `^`, implicit multiplication (`2x`, `x(y+2)`).
- **math.js** for parsing/evaluating expressions. Do NOT attempt symbolic CAS
  equivalence — use numeric sampling (below).
- **function-plot** (d3-based, MIT) for in-app graphing.
- State: Zustand or React context; keep it simple. Persist progress to `localStorage`.
- Styling: Tailwind. Look: clean, friendly, high-contrast; palette navy `#2F3C7E`,
  coral `#F96167`, gold `#F9E795` on white (matches her study decks). Must work well on
  a phone (she'll use it on mobile) and desktop.
- Optional later (design for it, don't build in v1): tiny Node/Express API in the same
  container for an Anthropic-powered "explain my mistake in plain English" endpoint.

## Core engine: step verification

### Equation/expression steps
A problem state is `LHS relOp RHS` (relOp ∈ {=, <, ≤, >, ≥}) in variables (x, y, n).
When the student submits the next line:

1. Parse both her new line and the current line with math.js. Reject unparseable input
   with a gentle format hint (show the exact character position).
2. **Numeric equivalence sampling**: solve nothing; instead test whether the new
   relation has the same solution set behavior as the old one:
   - For equations: sample ~12 random values for the free variables over a spread of
     ranges (e.g. −10..10 plus a couple large/small magnitudes), skipping points within
     ε of any denominator zero or outside even-root domains. The step is legal iff, at
     every sample where both sides are defined, `oldLHS − oldRHS` and `newLHS − newRHS`
     have the same zero set — practical test: check that old and new are satisfied by
     the same sampled solutions. Simplest robust implementation: verify
     `f_old(v) = 0 ⟺ f_new(v) = 0` on samples AND verify equivalence of each side pair
     when the step claims to be a rewrite (same solutions, both directions).
   - For inequalities: sample points and compare **truth values** of old vs new
     relation at each point. An un-flipped inequality after dividing by a negative
     fails immediately (e.g., `-14 <= -14x` vs `x >= 1`: test x = 0 → true/false
     mismatch). This is the single most important check in the app.
3. If equivalent → accept the step, append to the worked column, and ask (optionally,
   toggleable) "which property/move justified this?" with chips:
   `add/subtract both sides · multiply/divide both sides (sign flip if negative!) ·
   distribute · combine like terms · commutative reorder · associative regroup ·
   factor · cube/square both sides · take root (± if even!) · rewrite fraction`.
   Correct chip = bonus point; wrong chip = one-line correction, no penalty.
4. If NOT equivalent → do not just say "wrong." Run the **error-pattern matchers**
   (below) against the delta; if one matches, show its targeted lesson. Otherwise show
   a counterexample: "At x = 1 your old line says TRUE but your new line says FALSE —
   these aren't the same statement," with both evaluated numerically.

### Structured answer types (final answers)
Free-text math is wrong for these; build dedicated validated inputs:
- **Interval notation**: a chip-builder or strict parser accepting e.g.
  `(-inf, -2] U (5, inf)`. Enforce: left endpoint < right endpoint (reject backwards
  intervals with the specific message "intervals read left → right"), `(` mandatory on
  ±∞, `{a}` for isolated points (reject `[3]` with the specific message), `U` between
  disjoint pieces. Compare as a set against the target solution set.
- **Set-builder notation**: template input `{x | ___ }` with an inequality expression;
  verify by sampling that it describes the same set as the interval answer. If her set
  and interval disagree with each other, say exactly that ("your interval and your set
  describe different numbers") — this was a real error of hers.
- **One-to-one verdict**: required yes/no on every inverse problem before the answer is
  accepted; forgetting it was a systematic miss. If "no" is correct, require the reason
  (multiple choice: fails HLT / even power gives ± / repeated y-value found).
- **Even/odd/neither verdict** with required evidence lines f(−x) and −f(x).

### Error-pattern library (seed with her actual mistakes; keep extensible)
Each pattern: matcher over (oldExpr, newExpr) + a short targeted lesson with a
mini-example. Seed set:
1. **Backwards interval** `[a, −∞)` → intervals read small → large; −∞ leads with `(`.
2. **Dropped ∪** between disjoint pieces.
3. **`[3]` for a point** → single points use braces `{3}`.
4. **No sign flip** when multiplying/dividing an inequality by a negative.
5. **Even-root sign fold**: treating `cbrt(-x)` as `cbrt(x)`, or dropping the ± when
   square-rooting: detect `sqrt`/`cbrt` with sign mishandling numerically.
6. **Minus teleport out of a fraction**: `1/(-x+2)` rewritten `-1/(x+2)` — factor −1
   from the WHOLE denominator: `-1/(x-2)`.
7. **Partial distribution**: `x(y+2)` → `xy + 2` (constant term missed the multiplier).
8. **Constant folded into a radical/paren**: `cbrt(7x+3) - 1` treated as `cbrt(7x+2)`.
9. **Reciprocal-coefficient error**: clearing `(3/5)y` by adding instead of multiplying
   by `5/3`, or multiplying only one term by the reciprocal.
10. **Set/interval mismatch** (final-answer check, see above).
11. **Abandoned problem**: N minutes idle mid-problem → gentle "two steps left" nudge.
    (She left several problems unfinished; surface progress "3 of 5 steps" always.)

## Content modules (v1 = Unit 1)

Each module = problem templates + generators + hint ladders + TI instructions.

1. **Number line → interval & set notation** (render an SVG number line from the
   generated solution set; open/closed dots, rays, isolated points).
2. **Linear inequalities** (one-variable; distribute, combine, divide-by-negative
   variants; answer in interval AND set notation, must agree).
3. **Even / odd / neither** (polynomials, cube/square roots, rationals; require the
   f(−x) and −f(x) work lines; plug-in test taught as the check).
4. **Inverses + one-to-one** (cube-root shifts, linear, fractional-coefficient linear,
   quadratics [the NOT case], simple rationals `a/(x+b)+c`, Möbius `(ax+b)/(cx+d)`;
   verdict required; check = round-trip a friendly value).
5. **Properties drill** (standalone flashcard/quiz mode): "which property justifies
   this step?" and "legal or illegal?" one-step judgments — directly targets her core
   weakness. Include commutative vs associative discrimination, distribution over
   addition NOT over multiplication (`(xy)² = x²y²` vs `(x+y)² ≠ x²+y²`), fraction
   splitting `(a+b)/c = a/c + b/c` is legal but `c/(a+b) ≠ c/a + c/b`.

## Problem generation

Deterministic template generators, seeded RNG (shareable seed in URL so a specific
problem can be re-opened). Coefficients constrained so answers stay clean:
- Inverses round-trip check value must land on integers (pick parameters so f(k) is an
  integer for some small k; store k with the instance as the suggested check number).
- Inequality solutions land on integers or simple fifths/thirds.
- Rational functions keep asymptotes at friendly fractions; never generate a divide-by
  -zero at the check point.
Difficulty knobs per template (number of steps, fraction coefficients y/n, negative
leading coefficient y/n). Each generated instance carries its full canonical solution
path (ordered steps + property tag per step) — this powers hints, "show next step,"
and grading.

## Hint ladder (per step, student-invoked, never automatic)

1. **Nudge**: names the goal of the next step ("get y alone — what's still attached?").
2. **Property reminder**: the relevant rule card (same wording as her study decks, e.g.
   "multiply/divide by a negative → flip the inequality; add/subtract → never flips").
3. **Show the step**: reveals the next canonical line, cost = reduced score for that
   problem, never a lockout.
Track hint usage per skill for the progress view.

## "Graph it" feature

Every problem gets a Graph button:
- Plot the function(s) with function-plot: f in navy, f⁻¹ in coral dashed where
  applicable, y = x dotted gray, **square aspect ratio locked** so reflections read as
  true mirrors. For not-one-to-one cases draw the reflected relation parametrically and
  badge it "fails vertical line test."
- Inequality problems: shade the solution set on a number line SVG instead.
- Alongside the graph, show the **TI-84 Plus CE panel** (collapsible), with exact
  keystrokes for the current problem, auto-filled with its actual expression:
  - Entering it: `Y=`, cube root via `MATH → 4: ³√(`, nth root `MATH → 5: ˣ√`,
    fraction template `ALPHA → Y= (F1) → n/d`.
  - Window: `ZOOM 6: ZStandard`, then **`ZOOM 5: ZSquare`** whenever y = x symmetry
    matters (explain why: equal pixel scaling makes the mirror look like a mirror).
  - Inverse overlay: `2nd PRGM (DRAW) → 8: DrawInv Y1` — draws the inverse relation of
    Y1 directly. Note it's a drawing (not traceable); `2nd PRGM → 1: ClrDraw` to clear.
  - y = x mirror line: enter as Y2 with a different line style (left of Y2, ENTER to
    cycle styles).
  - One-to-one visual test: `2nd PRGM (DRAW) → 3: Horizontal`, arrow up/down — does any
    horizontal line cross twice?
  - The ± case: graph `Y2 = √((X+7)/4)` and `Y3 = -Y2` using `VARS → Y-VARS → 1 → Y2`.
  - Plug-in check: `2nd GRAPH (TABLE)` and `2nd WINDOW (TBLSET)` with `Indpnt: Ask` to
    type exact x values — mirrors the app's "check it" habit.
  These are static instruction templates per problem family with the expression
  substituted in; no calculator emulation.

## UI/UX requirements

- Layout per problem: problem statement (KaTeX) top; worked-steps column growing
  downward (her accepted lines, each with its property tag chip); input row with live
  preview; right rail (desktop) / bottom sheet (mobile) holding Hints, Graph it,
  TI-84 panel, and the rule card for the current module.
- Progress: per-skill mastery bars (steps accepted first-try %, hint rate, error
  patterns triggered with counts — so parent can see "sign-flip errors: 4 → 0 this
  week"). All local.
- Celebrate completion honestly (streaks, per-skill mastery), no dark patterns, no
  timers by default (optional "test mode" with a timer for SAT-style pacing).
- Keyboard-first on desktop; big touch targets + a math symbol strip (√, ³√, ≤, ≥, ∞,
  ∪, {, }, |, π) above the mobile keyboard.
- Accessible: all math has aria labels (KaTeX handles this); color never the sole
  signal (✓/✗ icons accompany green/red).

## Container & Azure deployment

- Multi-stage Dockerfile: `node:22-alpine` build → `nginx:alpine` serving `dist/`
  (SPA fallback to index.html). Keep the image lean (<60 MB).
- Reserve an `/api` path in nginx config (proxy stub, commented) for the future tutor
  endpoint so adding the API later doesn't change the frontend origin.
- Registry: GHCR (free) — `ghcr.io/<user>/precalc-trainer`.
- Azure: **Container Apps**, consumption plan, min replicas 0 (scale to zero),
  max 1, 0.25 vCPU / 0.5 GiB. Ingress external on 443. Provide `deploy/azure.md` with
  the az CLI sequence (create RG, env, containerapp create/update from GHCR image with
  pull secret) and a GitHub Actions workflow: build → push GHCR → `az containerapp
  update` on main. Cost expectation: ~$0 at family usage; call out that Static Web
  Apps free tier is the $0 alternative if the API never materializes.
- `APP_PIN` delivered via Container Apps secret → env; the SPA asks once per device
  and stores a session flag.

## Non-goals (v1)

- No accounts/auth beyond the PIN; no server-side data; no LLM calls; no calculator
  emulator; no coverage beyond Unit 1 modules (but module registry must make Unit 2
  trivial to add).

## Milestones

1. Engine spike: math input → parse → numeric equivalence check → accept/reject with
   counterexample display. Prove the sign-flip and minus-teleport catches work.
2. Inverses module end-to-end (templates, generator, hint ladder, structured verdicts).
3. Inequalities + interval/set answer inputs with the notation validators.
4. Even/odd module + properties drill.
5. Graph-it + TI-84 panels.
6. Progress view, polish, mobile pass.
7. Dockerfile + Azure deploy + Actions pipeline.

Each milestone lands runnable; write Vitest unit tests for the equivalence engine and
every error-pattern matcher (these are the correctness core — test them against the
eleven seeded patterns with real examples from her homework).
