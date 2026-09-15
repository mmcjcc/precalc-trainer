# LENS: Scope, milestones, and test strategy: internal consistency of the spec, underspecified behaviors with recommended defaults, Vitest plan for the correctness core, and a parallel-work directory layout. Calculator amendment (TI-84 Plus CE + TI-Nspire CX II non-CAS) folded in.

## Findings

### F1 [blocker] engine/parsing
**Claim:** The spec's required input forms `x(y+2)` and `(x+1)^3 = 7y+3` do not parse the way the spec assumes in math.js: `x(y+2)` is a function call on `x`, and a single `=` is assignment.

**Evidence:** mathjs expression-syntax docs: "Parentheses are parsed as a function call when there is a symbol or accessor on the left hand side, like sqrt(4)" and "= Assignment ... a = 5". So `math.evaluate('x(y+2)', {x:3,y:1})` throws (x is a number, not a function) and `math.parse('(x+1)^3 = 7y+3')` throws because the LHS of an assignment must be a symbol/accessor. The spec's own partial-distribution example (`x(y+2)` -> `xy + 2`) cannot even reach the matcher.

**Recommendation:** Never hand the whole line to math.js. (1) Own relation splitter: tokenize the line, find the relational operator(s) (`=`, `<=`, `>=`, `<`, `>`, plus `≤ ≥` from the symbol strip mapped to ASCII), split into sides, parse each side separately. Support chained `a < expr <= b` (two relations, AND) and `or` (see F6). (2) After `math.parse(side)`, walk the AST and rewrite every `FunctionNode` whose `fn.name` is a problem variable (x, y, n) or is not in an allowlist (`sqrt, cbrt, abs, nthRoot`) into `OperatorNode('*', [SymbolNode, args[0]])`. (3) Add tests: `x(y+2)` at (3,1) evaluates to 9; `2x`, `3(x+1)`, `(x+1)(x-1)` all evaluate as products; `sqrt(x)` stays a call. This is the first ticket of Milestone 1.

### F2 [blocker] engine/equivalence
**Claim:** The equation-equivalence test as written (`f_old(v)=0 ⟺ f_new(v)=0` at ~12 random samples) is vacuous for equations and would accept almost any wrong step, while the added clause 'AND verify equivalence of each side pair' would reject almost every legal step.

**Evidence:** Random reals almost never land on a solution: for `y = 3x+2` vs the wrong line `y = 5x-9`, at 12 random (x,y) both `f_old` and `f_new` are non-zero at every sample, so 'same zero set on samples' is trivially true and the wrong step is accepted. Conversely `2x = 6` -> `x = 3` is legal but the side pairs (2x vs x, 6 vs 3) are not equivalent, so the AND clause rejects it. Only the inequality truth-value comparison in the spec is sound (it has positive measure).

**Recommendation:** Replace with a root-fingerprint test. For a relation in one free variable t: evaluate g_old = LHS-RHS and g_new on a dense grid (e.g. 401 points on [-12,12] plus [-1e3,-12],[12,1e3] coarse), detect sign changes and near-zeros, refine each root by bisection to 1e-9, then require every root of g_old to satisfy |g_new| < tol AND every root of g_new to satisfy |g_old| < tol (tol relative to local magnitude). For two-variable relations (inverse work in x,y): for each of ~8 fixed y-values (and, symmetrically, 8 fixed x-values), the relation is one-dimensional -> run the same fingerprint per slice. A root of old where new is undefined = 'you lost part of the domain' rejection. Keep the truth-value comparison for inequalities but add the boundary samples of F4. Expression-equivalence (both sides, for rewrites/even-odd lines) is a separate function: |a-b| <= 1e-9*max(1,|a|,|b|) at samples where both are defined, plus a rule that if one is defined and the other undefined at >= 2 samples the expressions differ (catches sqrt(x^2) vs x, and sqrt(x) domain asymmetry).

### F3 [major] engine/step kinds
**Claim:** The chip list includes 'cube/square both sides' but squaring both sides is not an equivalence transformation, so the engine as specified rejects the canonical path of every quadratic-inverse and square-root problem.

**Evidence:** `x = -2` -> `x^2 = 4`: old solution set {-2}, new {-2, 2}. Under any correct equivalence check this step is 'NOT equivalent' and the app would show a counterexample at x = 2 for a step the spec itself lists as a legal move. Cubing is fine (bijective on the reals); squaring and taking even roots are one-directional.

**Recommendation:** Give the engine a step-kind result, not a boolean: `equivalent | implies (new ⊇ old) | swapVars | rejected`. 'implies' is accepted when every root of old is a root of new but not vice versa, and only when the student picks (or the detector recognizes) 'square both sides' / 'take even root'; the step is tagged 'may add extraneous solutions - check at the end' and the canonical path for those templates carries a final domain-restriction line (e.g. `y >= -7` for `y = 4x^2-7` restricted). Test both directions explicitly (see plan, equivalence.relation.test.ts cases E7-E9).

### F4 [major] engine/inequalities
**Claim:** Random sampling cannot distinguish `x >= 1` from `x > 1`, so dropping or adding the 'equal' part of an inequality (a real homework error class) is accepted as legal.

**Evidence:** The two relations differ only at x = 1; the probability that a random double in [-10,10] equals 1 is zero, so 'compare truth values at ~12 samples' passes. Same for `-14 <= -14x` -> `x < 1`... wait that also flips; but `-14 <= -14x` -> `x > 1`? No: -> `x <= 1` vs correct `x <= 1`: the strict/non-strict variant `x < 1` is accepted.

**Recommendation:** Sample set = fixed integer lattice -10..10 ∪ 8 seeded randoms ∪ {b, b-1e-6, b+1e-6} for every boundary b, where boundaries are (a) the canonical instance's solution-set endpoints and (b) roots of LHS-RHS of both old and new found by the F2 grid scan. Also compare at points where exactly one relation is undefined (domain edge: `sqrt(x-3) > 0` vs `x > 3`). Add the strict/non-strict pair to the negative test list.

### F5 [major] inverses/scope
**Claim:** The first canonical step of every inverse problem (swap x and y) is not an equivalence, and the spec never defines what line counts as the final inverse answer, so Milestone 2 cannot be graded with the Milestone 1 engine.

**Evidence:** `y = cbrt(7x+3) - 1` -> `x = cbrt(7y+3) - 1`: at (x,y) = (0, cbrt(3)-1) the old line is TRUE and the new line is FALSE; the engine shows a counterexample for the step the hint ladder itself would reveal. Likewise 'y = ...' vs 'f^-1(x) = ...' vs 'x = ...' are all plausible final lines and the spec's 'check = round-trip a friendly value' does not say which relation is round-tripped.

**Recommendation:** Engine step-kind detector must recognize `swapVars`: new ≡ old with x<->y substituted (test by expression equivalence after substitution). Final answer for inverses = a line of the form `y = E(x)` or `f^-1(x) = E(x)` (accept `finv(x)`, `f^-1(x)`, `f^(-1)(x)`, `y`), where E is expression-equivalent to the canonical inverse on the inverse's domain; `x = E(y)` is accepted as a step but the UI says 'rename to finish'. Round-trip test = E(f(k)) == k AND f(E(f(k))) == f(k) at the stored integer k. For the NOT case the final accepted state is verdict 'no' + reason + the `y = ±sqrt(...)` line (which is the evidence for 'even power gives ±'); v1 does not require domain/range statements.

### F6 [major] input grammar
**Claim:** The problem state is defined as a single `LHS relOp RHS`, but the content requires disjunctions (`±`, 'or' answers, `x < -2 or x > 5`) and conjunctions (`-3 < 2x+1 <= 7`), and no input syntax is given for any of them.

**Evidence:** Spec chips include 'take root (± if even!)' and the TI section graphs `Y2 = √((X+7)/4)`, `Y3 = -Y2`, so the state `x = ±sqrt((y+7)/4)` must be enterable; compound inequality templates ('distribute, combine' variants) naturally produce `a < expr < b`. Nothing in the input section covers `±`, `or`, `and`, or chained relations.

**Recommendation:** State = list of clauses joined by OR, each clause a list of relations joined by AND. Grammar: `or` keyword (also `,` is NOT accepted, to avoid ambiguity with function args); `and` keyword or chained `a < E < b`; `±`/`+-`/`+/-` allowed only as a prefix of a term and expanded to two OR-clauses at parse time. Equivalence of disjunctive states = truth-value comparison (inequalities) or union-of-root-fingerprints (equations). Add `±` and `or` to the symbol strip.

### F7 [major] deployment/PIN
**Claim:** The PIN design contradicts itself: a runtime Container Apps secret/env var cannot reach a static SPA that was built earlier and is served by nginx, and the 'or via the API' fallback contradicts 'no API in v1'.

**Evidence:** Spec: 'checked client-side against a hash baked at build time or via the API' vs 'APP_PIN delivered via Container Apps secret -> env' vs Non-goals 'no server-side data; no LLM calls' and 'Optional later ... don't build in v1' for the API. A baked-at-build hash makes the Container Apps secret dead configuration.

**Recommendation:** Pick runtime injection with no API: store `APP_PIN_HASH` (sha256 of PIN+fixed salt, never the PIN) as the Container Apps secret -> env; the nginx image's `/docker-entrypoint.d` templating writes `/usr/share/nginx/html/config.js` (`window.__CFG = {pinHash: '...'}`) at container start; the SPA loads it before the router. Document that this is a deterrent, not security. Add a Dockerfile smoke test in CI: `docker run -e APP_PIN_HASH=abc` then curl `/config.js` contains `abc`.

### F8 [major] test strategy/error patterns
**Claim:** The 'eleven seeded patterns' are three different kinds of thing (step-delta matchers, final-answer notation validators, an idle timer), so 'write Vitest tests for every error-pattern matcher against the eleven patterns with real homework examples' is not executable as written, and no homework corpus exists in the repo to test against.

**Evidence:** Patterns 4-9 are (oldExpr,newExpr) matchers; 1-3 and 10 fire on the interval/set input, which never goes through the step engine; 11 is a UI timer. The spec only quotes four real lines (`-14 <= -14x`, `1/(-x+2)`, `x(y+2)`, `cbrt(7x+3)-1`) plus prose for `(3/5)y`, `[a,-inf)`, `[3]`.

**Recommendation:** Split into `engine/matchers` (4-9), `engine/sets` validators (1-3, 10) and `ui/idle` (11, tested with fake timers). Create `content/fixtures/homework.json` now with the format `{id, module, old, new, expectedPattern, note}` and seed it with the seven lines above; the parent appends real lines over time and CI runs every fixture through the pipeline asserting the expected pattern id (or `null` for legal steps). Design matchers as counterfactual repairs (see design decisions) so each has a mechanical positive test (repair(new) ≡ old) and negative test (legal steps and other patterns do not match).

### F9 [major] graph-it/library facts
**Claim:** function-plot has no option to lock a square aspect ratio, so 'square aspect ratio locked' must be implemented by the app, and it breaks the moment the user zooms.

**Evidence:** FunctionPlotOptions (TypeDoc) exposes `width, height, xDomain, yDomain, grid, disableZoom, tip, annotations, plugins` and nothing about aspect/equal scaling. Datum supports `fnType: 'parametric'` with `x, y, range` (enough for the non-one-to-one reflection) and `attr` ('Additional attributes set on the svg node') for dashed lines.

**Recommendation:** Graph wrapper computes the container width w and sets height h = w (or a fixed 3:2), then sets `yDomain = [cy - (xSpan*h/w)/2, cy + (xSpan*h/w)/2]`; `disableZoom: true` in v1 and provide +/- buttons that scale both domains together; re-render on ResizeObserver. Reflection for the NOT case: `{fnType:'parametric', x:'t^2*4-7'?` no - reflection of y=f(x) is `x: 'f(t)', y: 't'` over `range: [tmin,tmax]`. Dashed inverse: `attr: {'stroke-dasharray': '6,4'}`; y = x: `fn: 'x'`, `attr: {'stroke-dasharray': '2,4'}`, color gray. Unit-test the domain math (given w,h,xDomain -> yDomain), not the SVG.

### F10 [major] calculator panel (amendment)
**Claim:** The TI-84 keystroke templates do not transfer to the TI-Nspire CX II: there is no DrawInv, no DRAW Horizontal, no ZSquare-by-that-name, no Y= editor, and no MATH 4/5 root items on the Nspire, so the panel needs a second, independently verified template set per problem family.

**Evidence:** Verified: Nspire inverse = `menu -> 3 Graph Entry/Edit -> 2 Relation`, enter `x=f1(y)` (TI KB 38095); nth root = template key left of [9], 4th template in row 1, index in top box, tab, radicand (TI KB 29131); table = `menu -> 7 Table -> 1 Split-screen Table` or `ctrl+T`, `Edit Table Settings -> Independent: Ask` for typed x values (TI eGuide 'Working with Function Tables', MathBits); `menu -> 4 Window/Zoom`: 5 Zoom-Standard (already equal x/y scale on Nspire), B Zoom-Square (TI KB 27950). TI-84 CE DRAW menu confirmed: 1 ClrDraw, 3 Horizontal, 8 DrawInv.

**Recommendation:** Model instructions as `content/calc/{ti84,nspire}/<family>.ts` returning an ordered list of `{step, keys, why?}` built from the instance's expression via `notation/calcString.ts` (which formats `cbrt(7x+3)-1` as TI-84 `³√(7X+3)-1` and Nspire template text `root-template[3](7x+3)-1` / typed `(7x+3)^(1/3)-1`). Add a test that for every template x difficulty knob x calculator the rendered instructions contain no `{{` placeholders and reference only function slots that exist (Y1..Y3 / f1..f3). Full per-family keystroke table is in the reference; treat items marked 'verify on device' as such.

### F11 [major] progress/UX semantics
**Claim:** 'Surface progress 3 of 5 steps always' is undefined when the student's legal path has a different length than the canonical path, and the idle nudge 'two steps left' depends on it.

**Evidence:** Canonical for `y = (3/5)x - 2`: swap, add 2, multiply by 5/3, rename = 4 steps. A student who does `x + 2 = (3/5)y`, `5(x+2) = 3y`, `(5x+10)/3 = y`, rename = 4 different lines; another might do 6. Mapping her line index onto the canonical index is wrong in both directions.

**Recommendation:** Progress = highest canonical milestone reached, where each canonical step carries a predicate on the state (default predicate: state ≡ canonical line k under F2 equivalence; templates may override with structural predicates such as 'y isolated'). Show 'milestone k of N'; 'show the step' reveals canonical line k+1 and the engine then accepts it because it is equivalent to her current state. Test: every canonical path reports k = index at each line; a shuffled legal path reports monotone non-decreasing k.

### F12 [minor] even/odd module
**Claim:** The even/odd evidence lines are underspecified: whether f(-x) may be simplified over several lines, what is compared to reach the verdict, and how non-symmetric domains (sqrt(x)) are handled by numeric sampling.

**Evidence:** With the 'skip points where either side is undefined' rule, `f(x) = sqrt(x)` gives f(-x) undefined wherever f(x) is defined, so every sample is skipped and the comparison is vacuously true -> could be graded 'even'. Also `f(x) = x^3 + x` with a student who writes `f(-x) = -x^3 - x` then `= -(x^3+x)` needs two lines.

**Recommendation:** Two mini step-columns: slot A must start with a line expression-equivalent to f(-x), slot B with a line equivalent to -f(x); further lines are rewrites (expression-equivalent to the previous line). Verdict computed by the engine independently: even iff f(-x) ≡ f(x), odd iff f(-x) ≡ -f(x) on the symmetric part of the domain, 'neither' if the domain is not symmetric (>= 2 samples where f defined but f(-x) undefined). If her final slot lines are correct but her verdict disagrees: 'your own two lines are/aren't the same expression'.

### F13 [minor] engine/evaluation
**Claim:** Students who type `(7x+3)^(1/3)` instead of `cbrt(7x+3)` will get complex numbers from math.js at negative radicands, which will either crash the comparison or be flagged as non-equivalent to `cbrt`.

**Evidence:** math.js `cbrt(-64)` returns -4 (real root, docs), but `(-64)^(1/3)` returns the principal complex root. `cbrt(7x+3)` and `(7x+3)^(1/3)` would therefore disagree at every sample with 7x+3 < 0.

**Recommendation:** In the AST normalizer rewrite `E^(1/n)` and `E^(p/q)` with odd q into `nthRoot(E, q)^p`; evaluate with `math.create(all, {predictable: true})` so even-root/negative-base yields NaN, and treat NaN/Complex/Infinity as 'undefined at this sample'. Test: `(x)^(1/3)` ≡ `cbrt(x)` at x = -8; `sqrt(x)` undefined at x = -1 (no throw).

### F14 [minor] parse errors mid-step
**Claim:** The spec does not say whether an unparseable line counts as an attempt, whether a bare expression is valid in equation mode, or what the live preview does while the line is mid-edit.

**Evidence:** 'Reject unparseable input with a gentle format hint' is the only sentence; 'steps accepted first-try %' would silently punish typos if parse failures count. A line like `7y + 3` (no relation) parses fine in math.js but has no meaning in equation mode.

**Recommendation:** Parse errors: never count toward first-try stats, never run matchers, keep her text in the input; hint uses math.js's error message (it embeds `(char N)`) mapped to a caret under the position. Bare expression in relation mode -> reject with 'each line needs both sides and =, <, ≤, >, ≥' (expression mode is only used for even/odd slots and the properties drill). Live preview: render the last parseable prefix and show the caret position in muted red; never block typing.

### F15 [minor] problem generation/URLs
**Claim:** Seed URL format and template versioning are unspecified, so re-opening a shared problem can silently produce a different problem after any template edit.

**Evidence:** 'shareable seed in URL' only. If the generator for `inverse/cbrt-shift` changes its RNG call order, seed 1234 regenerates as a different instance and the parent's bookmarked 'the one she got wrong' is gone.

**Recommendation:** Hash route `#/p/<module>/<template>@<templateVersion>/<seedBase36>?k=<knobs>` e.g. `#/p/inverses/cbrt-shift@1/z3k9q?steps=3&frac=1&neg=0`. Seed = 32-bit unsigned via mulberry32; bump `@version` whenever a generator's RNG consumption changes. Snapshot test: `generate(template, seed)` for 5 fixed seeds per template is byte-identical to committed JSON (fails loudly on accidental changes).

### F16 [minor] number-line module
**Claim:** Module 1 is defined only as number line -> notation; whether the reverse direction (notation -> number line) exists is unstated.

**Evidence:** 'Number line → interval & set notation (render an SVG number line from the generated solution set...)' - one direction. Her backwards-interval error `[a, -∞)` is easiest to make visible by drawing what she typed.

**Recommendation:** v1 default: forward direction only as a graded module, but the interval input everywhere shows a live number-line preview of what she typed (reuses the same SVG renderer; a backwards interval renders as empty with the 'reads left → right' hint). Reverse graded mode (click/drag endpoints) is a v1.1 backlog item.

### F17 [minor] property chips
**Claim:** The chip set omits moves the canonical paths need (swap x↔y, swap sides, simplify arithmetic, rename to f^-1) and 'optionally, toggleable' leaves it unclear whether a chip is required to proceed.

**Evidence:** `-14 <= -14x` -> `1 >= x` is 'divide both sides (flip)'; the next natural line `x <= 1` is a 'swap sides' move not in the list. `x = cbrt(7y+3)-1` is 'swap variables', not in the list.

**Recommendation:** Add chips: `swap sides`, `swap x and y`, `simplify arithmetic`, `rename (f⁻¹)`. Default: chip prompt appears after every accepted step when the setting is on (default on), Enter skips it, no penalty; in Properties Drill the chip IS the answer and is required. Each canonical step's stored property tag must be one of the chip ids (test: tag ∈ ChipId for every canonical step).

### F18 [minor] notation/KaTeX
**Claim:** The live KaTeX preview needs a custom text->LaTeX path; math.js's default `toTex` renders `cbrt(x)` as `\mathrm{cbrt}\left(x\right)` and `abs(x)` as `\left|x\right|` only via its own handler, and the `±`/`or` grammar of F6 has no math.js node at all.

**Evidence:** math.js `node.toTex()` prints unknown functions with `\mathrm{name}`; `cbrt` is not special-cased to `\sqrt[3]{}`.

**Recommendation:** `notation/toLatex.ts`: walk the normalized AST (same one the engine uses, so preview == what is graded) and emit `\sqrt[3]{...}`, `\left|...\right|`, `\frac{}{}` for division, `\pm`, `\ \text{or}\ `, and `\le`/`\ge`. Snapshot tests for ~20 lines.

### F19 [note] milestones
**Claim:** Milestone 1 as scoped ('math input → parse → numeric equivalence → accept/reject') is too small to unblock Milestone 2 without rework; several engine features are required by inverses on day one.

**Evidence:** M2 needs: swapVars step kind (F5), `±`/or state (F6), implies-mode for squaring (F3), expression-equivalence mode (needed by the minus-teleport proof M1 already promises), and the final-answer form. None are mentioned in M1.

**Recommendation:** Rewrite M1's exit criteria as: relation splitter + AST normalizer (F1, F13), expression equivalence, relation equivalence via root fingerprint (F2) incl. boundary samples (F4), inequality truth-table, step kinds {equivalent, implies, swapVars, rejected}, disjunctive state (F6), counterexample rendering, and the homework fixture harness (F8) green for sign-flip, minus-teleport, partial-distribution, constant-fold. M2 then only adds content.

### F20 [minor] interval/set parsers
**Claim:** 'Compare as a set against the target' leaves normalization rules undefined: adjacent pieces, `[a,a]`, empty set, all reals, and the union/infinity spellings students actually type.

**Evidence:** `(-inf, 2) U [2, 5]` is the same set as `(-inf, 5]`; `[3, 3]` is the same set as `{3}` but the spec wants `[3]` specifically rejected; `inf` is not a math.js constant (`Infinity` is) so the interval grammar cannot reuse the expression parser anyway.

**Recommendation:** Separate grammar (`engine/sets/interval.ts`): endpoints are numbers or simple fractions (`-7/4`), `inf|∞|infinity|oo`, union `U|u|∪|or`, finite sets `{a, b}`, empty `{}|∅|DNE`, reals `R|(-inf, inf)`. Normalize to sorted disjoint pieces with merge of touching pieces; equality = normalized equality; if equal but her piece count > canonical, accept with 'could be written as one piece'. Specific rejections: `[a,b]` with a > b ('intervals read left → right'), `[` or `]` adjacent to ±inf ('∞ is never reached, use ('), `[a]`/`[a,a]` ('single points use braces {a}'), `(a,a)` ('this interval is empty'). Set-builder: `{x | REL}` or `{x : REL}` where REL is parsed by the F6 relation grammar and compared by truth-table sampling at the same boundary-aware points.

## Design decisions

- **Engine input pipeline**: Line -> relation splitter (own tokenizer) -> per-side math.parse -> AST normalizer (implicit-mult fix, ^(1/odd) -> nthRoot, ± expansion, symbol strip) -> compiled evaluators with predictable math instance. The same normalized AST feeds KaTeX preview, calculator strings, and grading.  
  _Why:_ math.js cannot parse the spec's required inputs as-is (F1, F13); a single normalized AST guarantees 'what she sees is what is graded' and gives the matchers a stable structure to work on.

- **Step verdicts**: `verifyStep(prev, next)` returns `{kind: 'equivalent'|'implies'|'swapVars'|'rejected', evidence}` rather than a boolean; 'implies' only accepted for square/even-root moves and tagged for extraneous-check.  
  _Why:_ Squaring and swapping variables are legal canonical moves that are not equivalences (F3, F5).

- **Equivalence method**: Expression equivalence by tolerance at boundary-aware sample points; equation equivalence by root fingerprint per 1-D slice; inequality equivalence by truth table at lattice + random + boundary±ε points.  
  _Why:_ Random-sample zero-set comparison is vacuous for equations and blind to strict/non-strict boundaries (F2, F4).

- **Matcher architecture**: Each step matcher is a 'counterfactual repair': it proposes a specific edit to `next` (flip one sign, distribute the missed term, move the constant out of the radical, apply reciprocal to all terms) and fires only if `repair(next) ≡ prev`. A generic single-sign-toggle repair runs first and covers patterns 4, 5, 6 with the toggled term highlighted; specific matchers refine the lesson text.  
  _Why:_ Makes every matcher mechanically testable (positive: repair works; negative: repair does not make an unrelated wrong step equivalent) and prevents false positives on legal steps.

- **Problem state**: State = OR-list of AND-lists of relations; single relation is the degenerate case. Grammar accepts `or`, `and`, chained `a < E < b`, and `±` prefix.  
  _Why:_ Required by inverses (±), inequalities (compound), and 'or' answers (F6).

- **Calculator instructions**: `content/calc/<calc>/<family>.ts` per (calculator, problem family), each a function of the instance returning ordered `{label, keys, why?}` steps; `notation/calcString.ts` formats expressions per calculator. Both calculators rendered side-by-side as tabs in one panel.  
  _Why:_ The two calculators share almost no keystrokes (F10); per-family functions keep substitution testable.

- **Progress semantics**: Progress = highest canonical milestone whose predicate the current state satisfies (default predicate: equivalence to canonical line k).  
  _Why:_ Student paths differ in length from canonical paths (F11).

- **Testing**: Vitest, engine/notation/content are pure TS with zero DOM; fixtures in JSON; self-consistency test iterates every template x 25 seeds through the real engine; snapshot tests pin generator determinism per template version.  
  _Why:_ The correctness core must be testable without React; generators and engine must agree or hints will reveal 'wrong' steps.

- **Dependency direction**: `shared` <- `engine` <- `notation` <- `content` <- `ui`; enforced with eslint `no-restricted-imports` (or dependency-cruiser). Each top-level folder has one owner.  
  _Why:_ Lets four engineers work in parallel (engine, notation/graph, content+calc, UI) with the `shared/types.ts` contract as the only coupling.

- **PIN gate**: Runtime `APP_PIN_HASH` injected by nginx entrypoint into `config.js`; no API.  
  _Why:_ Resolves the build-time vs runtime contradiction (F7) without violating the no-API non-goal.

## Reference

## A. Ambiguity → default table (build never blocks)

| # | Ambiguity | Default to build |
|---|-----------|------------------|
| 1 | `x(y+2)` parses as function call; `=` is assignment in math.js | Own relation splitter; AST rewrite FunctionNode(var)→multiply; `==` never typed by student |
| 2 | Which steps require a property chip | Chip prompt after every accepted step when setting on (default on); Enter skips; bonus only. Properties Drill: chip is the answer, required |
| 3 | Chip set gaps | Add `swap sides`, `swap x and y`, `simplify arithmetic`, `rename (f⁻¹)` |
| 4 | Final answer for inverse problems | `y = E(x)` or `f^-1(x)`/`finv(x)`/`f^(-1)(x)` `= E(x)`, E ≡ canonical inverse on its domain; `x = E(y)` accepted as a step, UI says "rename to finish"; verdict required before "Done" enables |
| 5 | NOT one-to-one case end state | verdict "no" + MC reason + the `y = ±sqrt(...)` line present in worked column; no domain restriction extension in v1 |
| 6 | Domain/range statement for inverses | Not required in v1; shown in "show the step" only |
| 7 | Even/odd: multi-line? | Two slots, each a mini step column (first line ≡ f(−x) / −f(x); later lines are rewrites). Verdict computed independently; asymmetric domain ⇒ neither |
| 8 | Number-line module reverse direction | Forward only graded; every interval input shows live number-line preview; reverse graded mode = v1.1 |
| 9 | Seed URL | `#/p/<module>/<template>@<ver>/<seedBase36>?steps=&frac=&neg=`; mulberry32; bump `@ver` on RNG-order change |
| 10 | Parse error mid-step | Not an attempt; no stats impact; keep text; caret at math.js `(char N)`; bare expression in relation mode rejected with the "needs both sides" message |
| 11 | `or` / `±` / compound entry | `or` keyword; `and` keyword or chained `a < E <= b`; `±`, `+-`, `+/-` as term prefix; symbol strip adds ± and "or" |
| 12 | Squaring both sides | `implies` step kind, accepted only for square/even-root, tagged "check for extraneous"; canonical path carries final restriction line |
| 13 | Swap x↔y | `swapVars` step kind: next ≡ prev with x↔y substituted |
| 14 | Domain change in a step | Root of prev where next is undefined ⇒ reject "you lost part of the domain"; extra roots ⇒ only via `implies` |
| 15 | Strict vs non-strict | Boundary samples b, b±1e-6 for canonical endpoints and detected roots |
| 16 | Interval set equality | Normalize (sort, merge touching, `[a,a]`→{a}); equal sets accepted; extra pieces ⇒ "could be one piece" note |
| 17 | Interval spellings | `inf|∞|infinity|oo`; `U|u|∪|or`; `{}|∅|DNE`; `R`; fractions `-7/4` allowed as endpoints |
| 18 | Set-builder input | `{x | REL}` or `{x : REL}`; REL via relation grammar; compare by truth table; mismatch with her interval ⇒ pattern 10 message |
| 19 | Progress "k of N" | Highest canonical milestone satisfied by current state |
| 20 | Idle nudge | 4 min idle with unfinished problem; uses (N − k) from #19; fake-timer tested |
| 21 | Counterexample point choice | Prefer smallest-magnitude integer where truth values differ; else first boundary±ε; show both lines evaluated |
| 22 | Tolerance | relative 1e-9·max(1,|a|,|b|); NaN/Complex/±Infinity = undefined at sample |
| 23 | Sample ranges | integer lattice −10..10 ∪ 8 seeded randoms in [−10,10] ∪ {±100, ±0.01} ∪ boundaries |
| 24 | PIN | `APP_PIN_HASH` env → nginx entrypoint → `config.js`; deterrent only |
| 25 | Hint cost | Nudge 0, rule card 0, show-step: problem score ×0.5 per reveal (min 0); tracked per skill |
| 26 | Calculator panel | Tabs: TI-84 Plus CE / TI-Nspire CX II; remembers last tab in localStorage |
| 27 | Graph zoom | `disableZoom: true`; +/- buttons rescale both domains; height derived from width for square units |
| 28 | Variables | Relation-mode free variables limited to x, y (inverses) and x (inequalities); `n` only in drill; anything else ⇒ parse hint "unknown letter" |

## B. Vitest test plan (correctness core)

Layout: tests colocated as `*.test.ts`; shared fixtures in `src/content/fixtures/`. Run `vitest run --coverage` in CI; engine+notation+content must stay at ≥ 90% line coverage.

### B1 `engine/relation/parse.test.ts`
- P1 splits `(x+1)^3 = 7y+3` into sides, relOp `=`; `≤`,`≥`,`<=`,`>=`,`<`,`>` all recognized; `≠` rejected with hint.
- P2 chained `-3 < 2x+1 <= 7` → AND of two relations; `1 < x > 0` rejected.
- P3 `x < -2 or x > 5` → 2 clauses; `x = ±sqrt((y+7)/4)` → 2 clauses `+sqrt`, `-sqrt`; `+-`, `+/-` spellings.
- P4 bare expression in relation mode → error with position; empty side → error.
- P5 error position: `3/(x+2` reports char of missing `)` (from math.js message).

### B2 `engine/ast/normalize.test.ts`
- N1 `x(y+2)` at (3,1) = 9; `2x`, `3(x+1)`, `(x+1)(x-1)`, `x y` products; `sqrt(x)`, `cbrt(x)`, `abs(x)` remain calls; `foo(x)` rejected (unknown function).
- N2 `(x)^(1/3)` ≡ `cbrt(x)` at x = −8 (= −2); `x^(2/3)` at −8 = 4; `sqrt(-1)` → undefined (no throw); `1/0` → undefined.
- N3 Symbol strip: `√(x)`→sqrt, `³√(x)`→cbrt, `π`, `∞` in expressions rejected (interval-only), `≤`→`<=`.

### B3 `engine/equivalence/expression.test.ts` (positive / negative pairs)
Positive (must be ≡): `x(y+2)` ~ `xy+2x`; `(a+b)/c` ~ `a/c+b/c` with a,b,c→x,y,n; `1/(-x+2)` ~ `-1/(x-2)`; `(x+y)^2` ~ `x^2+2xy+y^2`; `cbrt(-x)` ~ `-cbrt(x)`; `abs(x)` ~ `sqrt(x^2)`; `(3/5)y*(5/3)` ~ `y`; `(xy)^2` ~ `x^2y^2`.
Negative (must not be ≡): `x(y+2)` vs `xy+2`; `1/(-x+2)` vs `-1/(x+2)`; `(x+y)^2` vs `x^2+y^2`; `c/(a+b)` vs `c/a+c/b`; `cbrt(7x+3)-1` vs `cbrt(7x+2)`; `sqrt(x^2)` vs `x` (differs at x = −3); `sqrt(x)` vs `sqrt(-x)` (domain asymmetry rule); `cbrt(-x)` vs `cbrt(x)`; `x/x` vs `1`? → decide: ≡ (removable), documented.
Tolerance: `x^2 - 1` vs `(x-1)(x+1)` at x = 1e3 passes (relative tol).

### B4 `engine/equivalence/relation.test.ts` (equations, root fingerprint)
Positive: E1 `2x = 6` → `x = 3`; E2 `(x+1)^3 = 7y+3` → `x+1 = cbrt(7y+3)` (cube root, both directions, per y-slice); E3 `x + 2 = (3/5)y` → `(5/3)(x+2) = y`; E4 `y = 1/(x+2) - 3` → `y + 3 = 1/(x+2)` → `x + 2 = 1/(y+3)`; E5 Möbius `y = (2x+1)/(x-3)` → `y(x-3) = 2x+1` → `xy - 2x = 3y + 1` → `x(y-2) = 3y+1` → `x = (3y+1)/(y-2)`; E6 swapVars `y = cbrt(7x+3)-1` → `x = cbrt(7y+3)-1` reports kind `swapVars`.
Implies: E7 `x = -2` → `x^2 = 4` kind `implies` (extra root 2 reported); E8 `x^2 = 4` → `x = 2` rejected (lost root −2, counterexample x = −2); E9 `x^2 = (y+7)/4` → `x = ±sqrt((y+7)/4)` equivalent (both clauses); → `x = sqrt((y+7)/4)` rejected.
Negative: E10 `y = 3x+2` vs `y = 5x-9` rejected (the vacuous-sampling regression test); E11 `x + 2 = (3/5)y` → `x + 2 + 5/3 = y` rejected (pattern 9); E12 `(x+1)^3 = 7y+3` → `x+1 = 7y+3` rejected; E13 `(x^2-4)/(x-2) = 5` → `x+2 = 5` decided per #14 (document expected).
Counterexample: E14 for `-14 <= -14x` → `x >= 1` returns point x = 0 with old TRUE / new FALSE.

### B5 `engine/equivalence/inequality.test.ts`
I1 `-14 <= -14x` → `x <= 1` accepted; → `x >= 1` rejected with counterexample; I2 `3x - 7 > 2` → `3x > 9` → `x > 3`; I3 `-2(x-1) >= 6` → `x - 1 <= -3` → `x <= -2`; I4 strict/non-strict: `x >= 1` vs `x > 1` rejected (boundary sample); I5 compound `-3 < 2x+1 <= 7` → `-2 < x <= 3`; I6 `x < -2 or x > 5` vs `x < -2` rejected; I7 `x/(-3) < 2` → `x > -6`; I8 domain edge `sqrt(x-3) > 0` vs `x > 3` accepted, vs `x >= 3` rejected.

### B6 `engine/matchers/*.test.ts` (each matcher: fixture positive, cross-negative on legal steps and on every other pattern's fixture)
- signFlip: `-14 <= -14x` → `x >= 1` ✔ (repair: flip relOp); `-14 <= -14x` → `x <= 1` ✘; `14 <= 14x` → `x >= 1` ✘.
- minusTeleport: `1/(-x+2)` → `-1/(x+2)` ✔ (single-sign repair on `+2` term); `1/(-x+2)` → `-1/(x-2)` ✘ (legal).
- partialDistribute: `x(y+2)` → `xy+2` ✔; `-2(x-1)` → `-2x-2` ✔ (sign variant); `3(x+1)` → `3x+3` ✘.
- constantFold: `cbrt(7x+3)-1` → `cbrt(7x+2)` ✔; `sqrt(x+1)+2` → `sqrt(x+3)` ✔; `cbrt(7x+3)-1 = y` → `cbrt(7x+3) = y+1` ✘.
- reciprocal: `x+2 = (3/5)y` → `x+2+5/3 = y` ✔ (added); `5/3 x + 2 = y` ✔ (only one term multiplied); `(5/3)(x+2) = y` ✘.
- evenRootFold: `cbrt(-x)` → `cbrt(x)` ✔; `x^2 = 9` → `x = 3` ✔ (dropped ±); `x^3 = 8` → `x = 2` ✘.
- registry: matchers run in fixed priority order; at most one lesson returned; every fixture in `homework.json` yields its `expectedPattern` (null for legal).

### B7 `engine/sets/interval.test.ts`
Parse: `(-inf, -2] U (5, inf)`, `(-∞,-2]∪(5,∞)`, `[-7/4, 3)`, `{3}`, `{-1, 4}`, `{}`, `R`. Reject with exact messages: `[3, -inf)` (left→right), `[-inf, 2)` (∞ needs `(`), `[3]` (braces), `(2,2)` (empty), `(5,-2)`, `(-2,5)(6,7)` (dropped ∪ → pattern 2). Normalize: `(-inf,2) U [2,5]` == `(-inf,5]`; `[3,3]` == `{3}`; order-insensitive union. Set-builder: `{x | x < -2 or x > 5}` == `(-inf,-2) U (5,inf)`; `{x : -3 < x <= 7}` == `(-3,7]`; mismatch detection between her interval and her set returns pattern 10.

### B8 `content/*/generate.test.ts` + `content/selfConsistency.test.ts`
- G1 determinism snapshot: 5 seeds × every template@version → committed JSON.
- G2 constraints: inverse instances have integer k with f(k) integer and f'(k)-defined; inequality endpoints ∈ ℤ ∪ {fifths, thirds}; rational asymptote ≠ check point; no zero denominators at k.
- G3 **self-consistency**: for every template × 25 seeds, feed canonical lines sequentially into `verifyStep`; every step must return kind ∈ {equivalent, implies, swapVars} matching the stored tag's expected kind, every step's `propertyTag` ∈ ChipId, milestone predicate k = index, final line passes `checkFinalAnswer`.
- G4 **inverse round-trip**: for every inverse instance, `finv(f(k)) == k` and `f(finv(f(k))) == f(k)` within 1e-9, using the canonical inverse expression compiled by the engine (not a hand formula); NOT-case instances assert `isOneToOne === false` and both ± branches satisfy `f(branch(v)) == v` on the range.
- G5 hint ladder: every canonical step has 3 hint strings; "show the step" line equals canonical line k+1 verbatim.
- G6 calculator: for every template × knob × {ti84, nspire}, rendered steps contain no `{{`, expression strings round-trip through `notation/calcString` parse, only slots Y1..Y3 / f1..f3 referenced.

### B9 `notation/toLatex.test.ts`
Snapshots for 20 lines incl. `cbrt(7x+3)-1` → `\sqrt[3]{7x+3}-1`, `abs(x)`, `3/(x+2)`, `±`, `or`, `<=`.

### B10 `ui/idle.test.tsx`, `ui/progress.test.tsx` (React Testing Library, fake timers)
Idle nudge fires at 4 min only with unfinished problem; progress bar text = "milestone k of N"; chips skippable with Enter.

## C. Directory layout (Vite/React/TS)

```
precalc-trainer/
  src/
    shared/                 # owner: tech lead. Types only, no logic.
      types.ts              # ProblemInstance, CanonicalStep, StepResult, SolutionSet, ChipId, CalcId
    engine/                 # owner: engine eng. Pure TS. No React, no DOM, no content.
      relation/ parse.ts tokens.ts
      ast/      normalize.ts symbols.ts
      eval/     math.ts (math.create predictable) sampler.ts evaluate.ts
      equivalence/ expression.ts relation.ts inequality.ts stepKind.ts counterexample.ts
      matchers/ index.ts repair.ts signFlip.ts minusTeleport.ts partialDistribute.ts constantFold.ts reciprocal.ts evenRootFold.ts
      sets/     interval.ts setBuilder.ts normalize.ts compare.ts
      progress/ milestones.ts
      index.ts              # verifyStep, checkFinalAnswer, checkEvenOdd, checkInterval
    notation/               # owner: notation/graph eng. Depends on engine AST only.
      toLatex.ts symbolStrip.ts calcString.ts (ti84 / nspire formatting)
      graph/ squareDomain.ts functionPlotConfig.ts
    content/                # owner: content eng. Depends on engine + notation.
      registry.ts rng.ts hints.ts
      modules/numberLine/ inequalities/ evenOdd/ inverses/ propertiesDrill/   # each: templates.ts generate.ts hints.ts calc.ts index.ts
      calc/ ti84/ nspire/ render.ts
      fixtures/ homework.json snapshots/
    ui/                     # owner: UI eng. Depends on everything above.
      app/ router.tsx pin.tsx
      store/ progress.ts session.ts (zustand, localStorage)
      components/ StepInput.tsx WorkedColumn.tsx Chips.tsx IntervalInput.tsx SetBuilderInput.tsx VerdictInput.tsx NumberLine.tsx Graph.tsx CalcPanel.tsx HintRail.tsx SymbolStrip.tsx
      pages/ Problem.tsx Progress.tsx Drill.tsx
      idle/ useIdleNudge.ts
  public/config.js          # placeholder overwritten by nginx entrypoint
  deploy/ Dockerfile nginx.conf 20-config.sh azure.md
  .github/workflows/ci.yml deploy.yml
  vitest.config.ts  (environment: node for engine/notation/content; jsdom for ui via per-folder override)
```
Import rules (eslint `no-restricted-imports`): shared imports nothing; engine imports shared + mathjs; notation imports engine/ast + shared; content imports engine, notation, shared; ui imports all. Nothing imports from ui.

## D. Calculator keystroke templates (both calculators) — `{E}` = instance expression in that calculator's syntax

Verified vs TI sources unless marked *verify on device*.

| Task | TI-84 Plus CE | TI-Nspire CX II (non-CAS) |
|---|---|---|
| Enter f | `Y=`, in Y1 type `{E84}`; cube root: `MATH → 4: ³√(`; nth root: index then `MATH → 5: ˣ√`; fraction: `ALPHA → Y= → 1: n/d` | Graphs page: `f1(x)=` type `{ENsp}` `enter`; cube root: template key (left of `9`) → nth-root template (row 1, 4th), index 3, `tab`, radicand; fraction: same template key → fraction template |
| Standard window | `ZOOM → 6: ZStandard` | `menu → 4: Window/Zoom → 5: Zoom-Standard` (already equal x/y scale) |
| Square units (mirror reads true) | `ZOOM → 5: ZSquare` | `menu → 4 → B: Zoom-Square` (only needed after a manual window change) |
| Inverse overlay | `2nd PRGM (DRAW) → 8: DrawInv`, then `VARS → Y-VARS → 1: Function → 1: Y1`, `ENTER`; clear with `2nd PRGM → 1: ClrDraw` | `ctrl+G` (entry line) → `menu → 3: Graph Entry/Edit → 2: Relation` → type `x=f1(y)` `enter` |
| y = x mirror | `Y=`, Y2 = `X`; cursor left of Y2, `ENTER` to cycle line style | `f2(x)=x`; `ctrl+menu` on the curve → Attributes → line style *verify on device* |
| Horizontal line test | `2nd PRGM (DRAW) → 3: Horizontal`, move with ▲▼, `ENTER` | `f3(x)=k` (e.g. 3); edit k, or `menu → 1: Actions → Insert Slider` bound to k *verify on device* |
| ± case | Y2 = `√(({inner}))`, Y3 = `-Y2` via `VARS → Y-VARS → 1 → 2: Y2` | `f2(x)=√(({inner}))`, `f3(x)=-f2(x)` |
| Plug-in check at k | `2nd WINDOW (TBLSET)` → `Indpnt: Ask`; `2nd GRAPH (TABLE)`, type k `ENTER` | `ctrl+T` (or `menu → 7: Table → 1: Split-screen Table`); in table `menu → Table → Edit Table Settings → Independent: Ask`; select a cell, type k, `enter` |
| Even/odd evidence | Y1 = f; Y2 = `Y1(-X)` (via `VARS → Y-VARS → 1 → 1`), Y3 = `-Y1`; TABLE Ask with x = 1, 2, 3 and compare columns | `f1(x)={E}`, `f2(x)=f1(-x)`, `f3(x)=-f1(x)`; `ctrl+T`, Independent: Ask, x = 1, 2, 3 |
| Inequality (no graph) | TABLE Ask at endpoint b and b±0.5 to see where LHS−RHS changes sign | Same via `ctrl+T` Ask |

Calc string formatting rules (`notation/calcString.ts`): TI-84 uppercases the variable to `X`, uses `³√(` for cbrt, `√(` for sqrt, `abs(`; Nspire keeps lowercase `x`, uses `√(` and the nth-root template (rendered in the panel as `³√(…)` with a note "use the template key") and offers the typed alternative `({E})^(1/3)` for cbrt since typing `^(1/3)` works on Nspire for the real root only where the radicand ≥ 0 — say so in the panel.

## E. Sources checked
- mathjs expression syntax (function-call precedence, `=` assignment, implicit multiplication): https://mathjs.org/docs/expressions/syntax.html
- mathjs cbrt (`cbrt(-64) = -4`): https://mathjs.org/docs/reference/functions/cbrt.html
- mathjs constants (`Infinity` yes, `inf` no): https://mathjs.org/docs/reference/constants.html
- function-plot FunctionPlotOptions (no aspect option): https://mauriciopoppe.github.io/function-plot/docs/interfaces/FunctionPlotOptions.html
- function-plot FunctionPlotDatum (`fnType: parametric`, `x/y/range`, `attr`): https://mauriciopoppe.github.io/function-plot/docs/interfaces/FunctionPlotDatum.html
- TI-84 DRAW menu order (1 ClrDraw, 3 Horizontal, 8 DrawInv): TI-84 Plus guidebook via ManualsLib p.129 https://www.manualslib.com/manual/376319/Texas-Instruments-Ti-84-Plus-Graphing-Calculator.html?page=129
- TI KB 38095 Nspire inverse via Relation `x=f1(y)`: https://education.ti.com/en/customer-support/knowledge-base/ti-nspire-family/product-usage/38095
- TI KB 29131 Nspire nth-root template: https://education.ti.com/en/customer-support/knowledge-base/ti-nspire-family/product-usage/29131
- TI KB 27950 Nspire Window/Zoom menu (5 Zoom-Standard, B Zoom-Square): https://education.ti.com/en/customer-support/knowledge-base/ti-nspire-family/product-usage/27950
- TI eGuide function tables, Independent Auto/Ask: https://education.ti.com/html/webhelp/nspire/4.0/SS/TI-NspireStudentSoftwareHelp_EN/Content/M_ListsSpreadsheet/LS_Working_with_Function_Tables.htm
- MathBits Nspire tables (`ctrl+T`, `menu 7 → 1`, Edit Table Settings): https://mathbits.com/MathBits/TINSection/General/TableA.html

