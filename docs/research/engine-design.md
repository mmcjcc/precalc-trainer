# LENS: Numeric equivalence engine correctness (Core engine: step verification)

## Findings

### ENG-1 [blocker] Equation equivalence test
**Claim:** The spec's equation check — sample ~12 random x and verify `f_old(v)=0 ⟺ f_new(v)=0` — is vacuously true for essentially every pair of lines, so it accepts every wrong step.

**Evidence:** Random reals land on a root with probability 0, so at every sample both f_old and f_new are nonzero and the biconditional holds. I prototyped the spec's check verbatim (math.js 15.2.0, 12 seeded samples over −10..10, ±1, ±37.5, ±250): `x+1=5 → x+1=7` ACCEPT, `2x=6 → x=5` ACCEPT, `x^2=9 → x=3` ACCEPT, `sqrt(x)=-2 → x=4` ACCEPT. The 'AND verify equivalence of each side pair when the step claims to be a rewrite' clause only covers rewrites; it does nothing for add/multiply/cube-both-sides steps, which are the majority of inverse-problem steps.

**Recommendation:** Replace with the two-tier design in the reference: Tier 1 structural transform detection (rewrite, swap sides, L'−L ≡ R'−R, L'/L ≡ R'/R, L' ≡ h(L) ∧ R' ≡ h(R) for h ∈ {^2, ^3, cbrt, sqrt±, 1/·}, variable rename), which both proves legality and names the property; Tier 2 fallback = compute the solution sets by root-finding and compare them with the boundary-point method. The prototype boundary method gave REJECT with the correct reason for all four cases above (e.g. `x^2=9 → x=3`: boundaries {−3,3}, mismatch at x=−3 old TRUE/new FALSE → 'lost solution −3').

### ENG-2 [blocker] Parsing relations with math.js
**Claim:** math.js cannot parse the student's lines as written because `=` is the assignment operator; `(x+1)^3 = 7y+3`, `x = 2 or x = -2`, `x = ±3` and `x ≤ 3` all throw.

**Evidence:** Run against mathjs 15.2.0: `parse('(x+1)^3 = 7y+3')` → 'Invalid left hand side of assignment operator = (char 9)'; `parse('y = 7x+3')` → AssignmentNode (would assign, not compare); `parse('x = ±3')` → 'Syntax error in part "±3"'; `parse('x ≤ 3')` → syntax error. Only `==`/`<=`/`>=` and chained `-3 < 2x+1 <= 5` parse (the latter evaluates correctly: x=2 → true, x=−2 → false).

**Recommendation:** Do not hand the whole line to math.js. Tokenize the statement yourself: split top-level on `or`/`,`/`;` into disjuncts, on `and` and chained relOps into conjuncts, expand `±` into two disjuncts, normalize `≤ ≥ ≠` to ASCII, then parse each SIDE separately with math.parse. Statement = disjunction of conjunctions of Relation{L: Node, op, R: Node}. Solution set of the statement = union over disjuncts of intersection over conjuncts; every engine routine below operates on this structure.

### ENG-3 [blocker] Inverse 'swap x and y' step
**Claim:** 'Swap x and y' is not an equivalence of relations, so any solution-set or truth-value comparator must reject it; the engine needs a dedicated variable-rename detector and a state flag.

**Evidence:** y=(x+1)^3 vs x=(y+1)^3 at (x,y)=(0,1): old TRUE (1=1), new FALSE (0=8) — verified with math.js. The graphs are reflections, not the same set. A rename check passes: L'(x,y) ≡ L(y,x) and R'(x,y) ≡ R(y,x) at 4 sample pairs (max |Δ| < 1e-9).

**Recommendation:** Add detector SWAP_VARS: new statement ≡ old statement with scope {x:y, y:x} (test L'(x,y)=L(y,x) ∧ R'(x,y)=R(y,x), or sides exchanged), on ≥12 (x,y) samples with the relative tolerance in ENG-7. Allowed only when the problem's module is 'inverse', at most once per problem; on acceptance set state.swapped=true and make the swapped relation the new 'current line'. Accept either textbook order (swap first then solve for y, or solve for x then swap): store the canonical path as two alternative orderings, or just let the detector fire at any step. Also reject the common mis-rename `x=(x+1)^3` (rename check fails at (0,1): 0 vs 1). Final answer `f^-1(x) = cbrt(x)-1` is compared by per-side expression equivalence (Tier 1a) against the canonical inverse expression, not by relation comparison.

### ENG-4 [major] Two-variable relations
**Claim:** Truth-value sampling at random (x,y) points cannot distinguish two-variable equations (both sides are FALSE almost everywhere), and it cannot produce the promised counterexample; you must slice: fix x, root-find in y, and fix y, root-find in x.

**Evidence:** Partial-distribution error `x(y+2)=5 → xy+2=5` at random (x,y)=(2,1): old 6=5 FALSE, new 4=5 FALSE → 'agree'. Slicing at x=2: old y-root {0.5}, new {1.5} → mismatch with a displayable counterexample ('at x=2 the original needs y=0.5, yours needs y=1.5'). One direction alone is insufficient: `x=3` vs `x=5` (no y-dependence) — root-finding in y at x=1 finds nothing for either (looks equivalent); root-finding in x at y=1 gives {3} vs {5}. Lost/extraneous detection works the same way: `sqrt(x+7)=y → x+7=y^2` at x=2: old y-roots {3}, new {−3,3} (strict superset → extraneous branch introduced by squaring); `y^2=x+7 → y=sqrt(x+7)` at x=2: {−3,3} → {3} (lost root).

**Recommendation:** Tier 2 for 2 variables: X-samples = {−8,−5,−3,−2,−1,−0.5,0.5,1,2,3,5,8} ∪ 4 seeded randoms in [−10,10] ∪ the problem's stored check value k; for each x run the 1-var boundary method (ENG-8) on y over [−60,60]; repeat with roles exchanged. Aggregate: if every slice agrees → EQUIVALENT; if all mismatches are old-TRUE/new-FALSE → LOST_SOLUTIONS (report the smallest-magnitude lost point); all new-TRUE/old-FALSE → EXTRANEOUS; else NOT_EQUIVALENT with the nicest counterexample point. Run Tier 1 first; it resolves >90% of canonical steps without root-finding.

### ENG-5 [major] Squaring / even roots in the inverse module
**Claim:** The canonical inverse path for sqrt-type problems necessarily passes through a non-equivalent step (squaring introduces solutions), and the spec gives the engine no policy for it; likewise the 'quadratic NOT one-to-one' case needs a lost-root verdict rather than a plain reject.

**Evidence:** y=sqrt(x+7): swap → x=sqrt(y+7) → x^2=y+7 is the textbook step, but slicing at y=2 gives old x-roots {3}, new {−3,3}. A comparator that only says 'not equivalent' would block every sqrt inverse problem. Conversely for y=x^2 (NOT case): x=y^2 → y=sqrt(x): at x=4 old {−2,2}, new {2}; that missing y=−2 is exactly the evidence the one-to-one verdict's 'even power gives ±' reason should cite.

**Recommendation:** Define verdicts EXTRANEOUS_SUPERSET and LOST_SUBSET distinct from NOT_EQUIVALENT. Policy: (a) if Tier 1 detects SQUARE_BOTH_SIDES (L' ≡ L², R' ≡ R²) and the verdict is EXTRANEOUS_SUPERSET, accept the step but require the student to attach the restriction chip (e.g. 'x ≥ 0' after the swap, because sqrt output is nonnegative) — store it on state.restrictions and enforce it in the final-answer domain check; (b) if Tier 1 detects TAKE_ROOT with even index and the verdict is LOST_SUBSET, reject with the ± lesson and the concrete lost value ("at x=4, y=−2 also works"), and in the quadratic-inverse template route that same evidence into the one-to-one 'no' reason. Never silently accept a LOST_SUBSET.

### ENG-6 [major] Domain handling in math.js
**Claim:** With default math.js config, negative radicands produce Complex values that make comparisons throw, and division by zero produces Infinity that compares equal to itself; the spec's 'skip points near denominator zeros / outside even-root domains' has no mechanism to find those points.

**Evidence:** mathjs 15.2.0 default config: `sqrt(-4)` → `2i`; `sqrt(x) >= 0` at x=−4 throws 'No ordering relation is defined for complex numbers'; `(-8)^(1/3)` → `1 + 1.732i` (principal complex root, NOT −2); `nthRoot(-4,2)` throws 'Root must be odd when a is negative'; `3/(x+2)` at x=−2 → Infinity (no error); `1/(x-2) == 1/(x-2)` at x=2 → true (Infinity==Infinity), so an undefined point looks satisfied. With `create(all,{predictable:true})`: `sqrt(-4)` → NaN, `(-8)^(1/3)` → −2, `(-8)^(2/3)` → 3.9999999999999996, `cbrt(-8)` → −2, and `NaN == NaN` → false. Poles look like sign changes to a bracketing root-finder: for `1/(x-2)=0` bisection converges to 2 with |g| ≈ 1e12.

**Recommendation:** Instantiate `create(all, {predictable: true})` and wrap every evaluate in try/catch. Define eval semantics: any non-finite or non-number result ⇒ 'undef'; a relation is TRUE only if both sides are finite numbers and the tolerance-aware comparison holds; 'undef' counts as FALSE for solution-set membership but is reported separately in counterexamples ('the original is undefined at x=2'). Build a domain function per side by walking the AST: collect denominators (OperatorNode '/', args[1]), sqrt args, `^` with exponent p/q where q even, abs is fine; root-find each collected subexpression to get domain-boundary points and add them to the boundary set (ENG-8). In the root-finder, accept a bracketed sign change as a root only if |g(r)| ≤ 1e-7·max(1,|L(r)|,|R(r)|); otherwise it is a pole. Prototype result: `x/(x-2)=2/(x-2) → x=2` REJECT (extraneous: at 2 old undef, new true); `1/(x-2)=0 → x=2` REJECT.

### ENG-7 [major] Tolerances and sample ranges
**Claim:** An absolute ε, or math.js's own `==` (relTol 1e-12), misjudges legal rewrites once cubed terms reach ~1e18, and the spec's 'a couple large magnitudes' samples push it there; tolerance must be relative to operand magnitude and sample magnitude must be capped.

**Evidence:** Legal rewrite `(x+1)^3 - x^3` vs `3x^2+3x+1`: at x=250.37 |Δ|=2.3e-10; at x=1e4+0.37 |Δ|=7.0e-5; at x=1e6+0.37 |Δ|=93.5, yet relative to the operand magnitude (x+1)^3≈1e18 it is 9e-17. math.js `(x+1)^3-x^3 == 3x^2+3x+1` at x=1e6+0.37 returns FALSE. Degenerate sample points also create false equalities: `x^2 == x` is true at x=1, `2x == x` true at x=0.

**Recommendation:** Expression equivalence: equal(a,b,scale) ⇔ |a−b| ≤ 1e-9·max(1,|a|,|b|,scale) where scale = max |value| of the top-level operands of both sides at that sample (math.js: evaluate node.args of the root OperatorNode; cheap). Sample set for one variable: 8 seeded uniform in [−10,10] excluding |v−k|<0.05 for k∈{−1,0,1}, 2 in [−1,1]\{0}, and fixed ±37.5, ±250; nothing above 1e3. Require ≥8 samples where both lines are defined, else widen and retry; if still <8, report 'can't compare — undefined almost everywhere' rather than accept. Root comparison: roots match if |r1−r2| ≤ 1e-6·max(1,|r|), but prefer verifying membership (evaluate the other relation at r with tolerance) over list comparison. Use a seeded PRNG (mulberry32 with the problem seed) so a counterexample is reproducible.

### ENG-8 [major] Inequality truth-value sampling
**Claim:** Random truth-value sampling never detects strict-vs-non-strict boundary errors or domain-point errors; the correct and complete method for one-variable relations is to test at the boundary points themselves and at one point in each interval between them.

**Evidence:** Spec's 12-sample truth-value test (prototyped): `x<3 → x<=3` EQUIVALENT (wrong), `-3<2x+1 → -2<=x` EQUIVALENT (wrong). Since every relation here is piecewise-continuous, its truth value is constant on each open interval between consecutive points of B = roots(L_old−R_old) ∪ roots(L_new−R_new) ∪ domain-boundary points; so testing each b∈B, each midpoint, and one point beyond each end is a complete decision procedure. Prototype: `x<3 → x<=3` REJECT (x=3: old FALSE, new TRUE); `-14<=-14x → x>=1` REJECT (x=0 old TRUE/new FALSE, x=2 old FALSE/new TRUE); `-14<=-14x → x<=1` and `→ 1>=x` ACCEPT; `1/x<2 → 1<2x` REJECT (x=−1 old TRUE/new FALSE — multiplying by x of unknown sign); `(x-3)^2<=0 → x=3` ACCEPT (tangential root found by |g|-minimum search).

**Recommendation:** Boundary method (1 var): (1) g(x)=L−R on a 2400-point grid over [−60,60] for both lines and for every domain subexpression; bracket sign changes → bisection (80 iters) → accept if |g(r)| ≤ 1e-7·scale (pole otherwise); also refine grid-local minima of |g| with |g| ≤ 1e-3·scale by golden-section and accept if the same criterion holds (tangential roots). (2) B = sorted, deduped (1e-7) union of all roots and domain points. (3) Test points T = {b∈B} ∪ midpoints ∪ {min(B)−1, max(B)+1} (or {−7,0,7} if B empty) ∪ 4 seeded randoms. (4) Evaluate each line at each t with tolerance-aware relOp: d=L−R, eq ⇔ |d| ≤ 1e-9·max(1,|L|,|R|); `<` is TRUE iff ¬eq ∧ d<0; `≤` iff eq ∨ d<0 (this makes a root found at 2.9999999999 evaluate `x<3` as FALSE, as required). (5) Equivalent iff truth values agree at all t. Sign-flip pattern: normalize both to `h(x) ≤ 0` form (negate h for `>`/`≥`); if h_new/h_old is a constant c<0 across samples the student forgot to flip; c>0 → legal 'divide both sides'.

### ENG-9 [major] ± and 'or' answers
**Claim:** The spec has no representation for multi-branch statements, so `x = ±3`, `x = 3 or x = -3`, `y = ±sqrt(x+7)` and compound inequalities cannot be verified, and `x^2=9 → x=3` cannot be distinguished from the correct answer.

**Evidence:** math.js has no `±` (syntax error verified) and `=` cannot appear inside `or`. Prototype with a disjunction-aware boundary method: `abs(x)=3 → x=3` REJECT (lost −3); with branches {x=3, x=−3} the union {−3,3} matches.

**Recommendation:** Grammar (ENG-2): `A or B`, `A, B`, `x = ±E` ⇒ {x=E, x=−E}, `±E = F` ⇒ {E=F, −E=F}; `a < E ≤ b` and `A and B` ⇒ conjunction. Solution-set semantics: statement TRUE at t iff some disjunct has all conjuncts TRUE. Root set of a statement = union of root sets of all relations in it (boundary method unchanged). Tier 1 TAKE_ROOT(even) detector requires the new statement to have exactly the two branches L' = √R and L' = −√R (or `abs(L') = √R`); a single branch ⇒ LOST_SUBSET with lesson 'take root (± if even!)'.

### ENG-10 [major] Implicit multiplication tokens
**Claim:** math.js does not treat `xy` or `x(y+2)` as multiplication, so the spec's partial-distribution example cannot even be evaluated.

**Evidence:** mathjs 15.2.0: `evaluate('xy + 2',{x:3,y:1})` → 'Undefined symbol xy'; `evaluate('x(y+2)',{x:3,y:1})` → "'x' is not a function; its value is: 3"; `evaluate('2x',{x:3})` → 6 works.

**Recommendation:** Pre-tokenize before math.parse: split identifier runs that are not in the function whitelist {sqrt,cbrt,abs,nthRoot,pi,e,inf} into single-letter variables joined by `*`, and insert `*` between a variable and a following `(`. Round-trip the rewritten string into the KaTeX preview so she sees `x·(y+2)` and can catch tokenizer surprises. Add unit tests for `xy`, `2xy`, `x(y+2)`, `3x(2y-1)`, `sqrt(x)y`.

### ENG-11 [minor] Error-pattern matchers need the structural delta, not only a mismatch flag
**Claim:** The minus-teleport and similar matchers should be implemented as 'student's line equals a known wrong transform of the old line' numeric tests, which requires Tier 1's per-side machinery, not a comparison of solution sets.

**Evidence:** `1/(-x+2)` vs `-1/(x+2)`: per-side values at x=0: 0.5 vs −0.5; at x=1: 1 vs −0.333. Per-side comparison against the correct rewrite `-1/(x-2)` passes at all samples. The wrong transform is 'negate the fraction and flip only the sign of the x-term in the denominator'; only per-side numerics can recognize it, a solution-set comparison just says 'different'.

**Recommendation:** Each matcher = (applicability predicate on old AST) + (generator of wrong-transform candidate expressions) + numeric equality test of the student's side against each candidate (ENG-7 tolerance). Seed: minus-teleport (candidate: −1/(Σ terms with only the leading sign flipped)), partial distribution (multiplier applied to first term only), constant folded into radical (cbrt(a+c) for cbrt(a)±c), reciprocal-coefficient (only first term multiplied by 5/3; or 5/3 added), sign-flip (normalized ratio constant negative, ENG-8). Run matchers only after Tier 1 and Tier 2 both fail, and surface the tier-2 counterexample when no matcher fires.

### ENG-12 [minor] Counterexample selection
**Claim:** The spec's counterexample ('At x = 1 your old line says TRUE but your new line says FALSE') can only be produced by the boundary/slicing method, and the point should be chosen for readability.

**Evidence:** For equations a random x makes both lines FALSE (no counterexample). The boundary method yields the informative point directly: x^2=9 → x=3 gives x=−3 (old TRUE, new FALSE); sqrt(x)=−2 → x=4 gives x=4 (new TRUE, old FALSE: 'sqrt(4)=2, not −2').

**Recommendation:** From the mismatch list, rank points by niceness: integers first, then halves/thirds/fifths (denominator ≤ 6, checked by |v·d − round(v·d)| < 1e-6), then smallest |v|; snap displayed values to that fraction. Message templates: equations — 'x = −3 solves the original but not your line' / 'x = 4 satisfies your line but makes the original false/undefined'; inequalities — 'at x = 0 the original is TRUE, your line is FALSE'; two variables — 'at x = 2 the original needs y = 0.5, your line needs y = 1.5'. Always show both sides evaluated numerically.

## Design decisions

- **Engine architecture**: Three tiers: (1) structural transform detectors on the parsed sides (rewrite, swap sides, add/subtract, multiply/divide, power/root, reciprocal, variable rename), (2) solution-set comparison by root-finding + boundary-point testing (1 var) and by x/y slicing (2 vars), (3) error-pattern matchers over the structural delta. Tier 1 success names the property automatically; Tier 2 decides legality when Tier 1 finds no single named transform (e.g. two moves in one line); Tier 3 only explains failures.  
  _Why:_ The spec's single random-sampling check is vacuous for equations (ENG-1) and blind at boundaries for inequalities (ENG-8); named-transform detection is what actually maps to the pedagogical goal (which property justified this?).

- **Statement model**: Own tokenizer/splitter produces Statement = OR of AND of Relation{L,op,R}; each side parsed by math.js with `predictable:true`; `±`, `or`, `,`, chained inequalities and `and` supported; unicode ≤ ≥ normalized.  
  _Why:_ math.js parses `=` as assignment and has no ±/≤ (ENG-2, ENG-9).

- **Undefined values**: NaN/Infinity/Complex/throw ⇒ 'undef'; undef never equals anything and counts as FALSE for membership, but is reported distinctly in messages.  
  _Why:_ Default math.js returns Complex for sqrt of negatives and Infinity for /0, and Infinity==Infinity is true (ENG-6).

- **Tolerance**: Relative tolerance 1e-9 against max(1, |a|, |b|, top-level operand magnitudes); root acceptance 1e-7·scale; roots deduped at 1e-7; sample magnitudes capped at 250 (never ≥1e3).  
  _Why:_ Cubed terms at |x|≥1e5 lose absolute precision (|Δ|=93.5 at x=1e6 for a legal rewrite) while staying at 1e-16 relative to operands (ENG-7).

- **Swap x↔y**: Dedicated SWAP_VARS detector (rename check), inverse module only, once per problem, sets state.swapped and replaces the current relation; accepted in either textbook order.  
  _Why:_ Swapping is a reflection, not an equivalence; any set comparator must reject it (ENG-3).

- **Lossy steps**: Verdicts EQUIVALENT / EXTRANEOUS_SUPERSET / LOST_SUBSET / NOT_EQUIVALENT / UNDECIDABLE. Squaring with EXTRANEOUS_SUPERSET is accepted only with an attached restriction chip; LOST_SUBSET is always rejected with the concrete lost value; UNDECIDABLE (too few defined samples) is reported, never accepted.  
  _Why:_ Sqrt inverses require squaring; quadratic NOT-one-to-one case needs the lost value as evidence (ENG-5).

- **Inequality × non-constant expression**: If Tier 1 finds L'/L ≡ R'/R = m(x) with m non-constant and the relation is an inequality, reject with lesson 'multiplying by an expression whose sign depends on x is not a single legal move' (and Tier 2 will confirm with a counterexample such as x=−1 for 1/x<2 → 1<2x).  
  _Why:_ Precalc Unit 1 does not do sign-case analysis; accepting it would hide the sign-flip rule she is learning.

- **Reproducibility**: All randomness from mulberry32 seeded by the problem seed; counterexamples therefore stable across reloads and shareable via the URL seed.  
  _Why:_ Debuggability of engine tests and consistent feedback for the student.

## Reference

# Step-verification engine — reference design

All math.js facts below were verified by running mathjs **15.2.0** locally (node 22). Use `const math = create(all, { predictable: true })`.

## 1. Input pipeline
1. Normalize: `≤→<=`, `≥→>=`, `≠→!=`, `∞→inf`, `√(→sqrt(`, `³√(→cbrt(`, strip spaces.
2. Tokenize implicit multiplication BEFORE math.parse: identifier runs not in `{sqrt,cbrt,abs,nthRoot,pi,e,inf}` become single letters joined by `*` (`xy→x*y`, `2xy→2*x*y`); insert `*` between a variable and `(` (`x(y+2)→x*(y+2)`). math.js otherwise throws `Undefined symbol xy` and `'x' is not a function`.
3. Statement grammar (own splitter; math.js treats `=` as assignment and throws):
   - `Stmt := Disj ('or' | ',' | ';') Disj*` ; `Disj := Conj ('and' Conj)*` ; `Conj := Side (relOp Side)+` (chained ⇒ conjunction of adjacent pairs).
   - `±E` on either side ⇒ two disjuncts (`x = ±3` ⇒ `x=3 or x=-3`; `y = ±sqrt(x+7)` ⇒ two branches).
   - Relation = `{ L: math.parse(sideText), op ∈ {=,<,<=,>,>=}, R: Node }`. Each side is parsed separately, error positions mapped back to the original string for the format hint.
4. Free variables = union of SymbolNodes not in the function whitelist; a line may introduce no variable that the problem does not own.

## 2. Evaluation semantics
- `val(node, scope)`: try `node.compile().evaluate(scope)`; result must be `typeof 'number'` and `Number.isFinite` else `undef` (covers NaN from sqrt(−4), Infinity from 3/(x+2) at −2, Complex, thrown errors).
- Scale at a point: `S = max(1, |L|, |R|, |top-level operands of L and R|)` (operands = `node.args` of the root OperatorNode, evaluated).
- `eq(a,b,S) ⇔ |a−b| ≤ 1e-9·S`.
- Relation truth at a point (tolerance-aware): `d = L−R`; if either side undef ⇒ `undef`. `=`: eq. `<=`: eq ∨ d<0. `>=`: eq ∨ d>0. `<`: ¬eq ∧ d<0. `>`: ¬eq ∧ d>0.
- Statement truth = OR over disjuncts of AND over conjuncts, where `undef` behaves as FALSE for membership but is preserved for messaging.
- Domain subexpressions (AST walk, per side): `/` → args[1]; `sqrt(a)` → a (must be ≥0); `a^(p/q)` with even q → a; `nthRoot(a,n)` even n → a. Store as `domainZero[]` (must be ≠0) and `domainNonneg[]`.

## 3. Sample sets and tolerances
- PRNG: mulberry32(problemSeed ⊕ stepIndex).
- 1-var expression samples (Tier 1): 8 uniform in [−10,10] rejecting any value within 0.05 of {−1,0,1}; 2 uniform in [−1,1]\{0}; fixed −37.5, 37.5, −250, 250; plus the problem's stored check value k. Never use |v| ≥ 1e3 (at x=1e6 a legal cube rewrite differs by 93.5 absolute).
- 2-var samples: 12 (x,y) pairs from the same generator, plus (k, f(k)).
- Require ≥ 8 samples where both lines are defined; otherwise widen once ([−30,30]); if still < 8 ⇒ `UNDECIDABLE` (message: "your line is undefined almost everywhere I can test it").
- Root acceptance: `|g(r)| ≤ 1e-7·S(r)`; root dedupe: `|r1−r2| ≤ 1e-7·max(1,|r|)`; bisection: 80 iterations; grid: 2401 points on [−60,60].
- Never rely on math.js `==` (relTol 1e-12 to the *result*): it returns FALSE for `(x+1)^3-x^3 == 3x^2+3x+1` at x=1e6+0.37.

## 4. Tier 1 — structural transform detectors
Old relation `L op R`, new relation `L' op' R'` (single-relation statements; for multi-branch new statements see TAKE_ROOT). Each test is "numerically ≡ on all samples" with §2 `eq`. Run in this order; first match wins and yields `{verdict, property}`.

| id | test | verdict / property |
|---|---|---|
| REWRITE | `L'≡L ∧ R'≡R` | EQUIVALENT; sub-classify property by AST shape if desired (distribute / combine / factor / rewrite fraction); op must be unchanged |
| SWAP_SIDES | `L'≡R ∧ R'≡L` and `op' = reverse(op)` (`=`↔`=`, `<`↔`>`, `<=`↔`>=`) | EQUIVALENT "symmetric property"; if op' not reversed for an inequality ⇒ NOT_EQUIVALENT + sign lesson |
| ADD_BOTH | `L'−L ≡ R'−R` (call it d), op'=op | EQUIVALENT "add/subtract both sides" |
| MUL_BOTH | `L'/L ≡ R'/R` (=m) on samples where L,R ≠ 0 | if m constant: c>0 & op'=op ⇒ EQUIVALENT "multiply/divide both sides"; c<0 & op'=reverse(op) ⇒ EQUIVALENT "…(sign flip!)"; c<0 & op'=op & op≠`=` ⇒ NOT_EQUIVALENT, pattern **NO_SIGN_FLIP**. If m non-constant: op=`=` ⇒ defer to Tier 2 (may add/remove roots at zeros/poles of m); inequality ⇒ NOT_EQUIVALENT "can't multiply an inequality by an expression whose sign varies" |
| POWER_k (k=2,3) | `L'≡L^k ∧ R'≡R^k` | k=3 ⇒ EQUIVALENT "cube both sides"; k=2 ⇒ run Tier 2; EQUIVALENT if sets equal (e.g. both sides provably same sign), EXTRANEOUS_SUPERSET ⇒ accept-with-restriction chip |
| TAKE_ROOT_3 | `L'≡cbrt(L) ∧ R'≡cbrt(R)` (also accept `L'≡L^(1/3)` since predictable:true gives −2 for (−8)^(1/3)) | EQUIVALENT "take cube root" |
| TAKE_ROOT_2 | new statement has 2 branches `{L'=√R, L'=−√R}` (or `abs(L')=√R`) with `L'^2≡L` | EQUIVALENT "take root (± if even!)"; single branch ⇒ LOST_SUBSET, pattern **DROPPED_PM** |
| RECIPROCAL | `L'≡1/L ∧ R'≡1/R` | `=` ⇒ Tier 2 (zeros ⇄ poles); inequality ⇒ NOT_EQUIVALENT unless Tier 2 says equal |
| SWAP_VARS | (inverse module, `!state.swapped`) `L'(x,y)≡L(y,x) ∧ R'(x,y)≡R(y,x)`, or with sides exchanged | EQUIVALENT-BY-RENAME "swap x and y"; set `state.swapped=true`; current relation := new line |

Normalization for the sign-flip test (independent of which side x is on): write each inequality as `h ≤ 0` / `h < 0` with `h = L−R` for `<,<=` and `h = R−L` for `>,>=`; `h_new/h_old ≡ c<0` ⇒ NO_SIGN_FLIP. Example: `-14 <= -14x`: h_old = −14+14x; `x >= 1`: h_new = 1−x; ratio −1/14 ⇒ flag. `x <= 1`: h_new = x−1; ratio 1/14 ⇒ legal.

## 5. Tier 2 — solution-set comparison
### 5a. One variable (boundary method)
1. For each relation in old and new statements: `g = L−R`. On the 2401-point grid over [−60,60] compute g; bracket sign changes (skip if either endpoint undef) → bisection → accept root if `|g(r)| ≤ 1e-7·S(r)` (else it is a pole, discard). Also detect tangential roots: grid points that are local minima of |g| with `|g| ≤ 1e-3·S` → golden-section on |g| → same acceptance test.
2. Domain points: run step 1 on every `domainZero`/`domainNonneg` subexpression of both lines.
3. `B` = sorted, deduped union of all roots and domain points.
4. Test set `T` = each `b∈B`, each midpoint of consecutive `B`, `min(B)−1`, `max(B)+1` (if B empty: −7, 0, 7), plus 4 seeded randoms in [−10,10].
5. Evaluate old and new statements at each `t` (tolerance-aware, §2). Mismatch list = points where `(old===true) !== (new===true)`, recording `undef`.
6. Verdict: no mismatches ⇒ EQUIVALENT. All mismatches old-TRUE/new-FALSE ⇒ LOST_SUBSET. All new-TRUE/old-(FALSE|undef) ⇒ EXTRANEOUS_SUPERSET. Mixed ⇒ NOT_EQUIVALENT.
Complexity: ~5 relations × 2401 evals — trivially fast in the browser (<10 ms with compiled nodes).

### 5b. Two variables (slicing)
- X-slices: {−8,−5,−3,−2,−1,−0.5,0.5,1,2,3,5,8} ∪ 4 seeded randoms ∪ {k}. For each x, run 5a in y (scope `{x, y:·}`) on both statements.
- Y-slices: same values for y, run 5a in x.
- Aggregate mismatches across all slices; verdict rules as in 5a.6; counterexample = nicest mismatch point `(x,y)`.
- Both directions are mandatory: `x=3` vs `x=5` has no y-roots at any x-slice (looks equivalent) but x-roots {3} vs {5} at y=1.

## 6. Verdict taxonomy → UI
- EQUIVALENT (+ property from Tier 1 if any) → accept, chip prompt.
- EQUIVALENT-BY-RENAME → accept, property "swap x and y", state.swapped.
- EXTRANEOUS_SUPERSET → if Tier 1 = POWER_2: accept with mandatory restriction chip (`x ≥ 0` / `y ≥ 0`, generated from the even-root side's sign); else reject with "x = 4 satisfies your line but not the original".
- LOST_SUBSET → reject: "you lost x = −3" (+ DROPPED_PM lesson when Tier 1 = TAKE_ROOT_2 single branch; in quadratic-inverse templates also feed the one-to-one 'no' reason).
- NOT_EQUIVALENT → run Tier 3 matchers; else counterexample message.
- UNDECIDABLE → "I can't test this line — it's undefined at almost every x I tried"; never accept.

## 7. Tier 3 — matcher hooks (numeric "equals a known wrong transform")
For each matcher: applicability predicate on old AST → generate candidate wrong sides → compare student's side with §2 `eq` on samples.
- NO_SIGN_FLIP: normalized ratio constant c<0 (§4).
- MINUS_TELEPORT: old side has a fraction `a/(−x+b)` (leading term negative); candidate `−a/(x+b)` (sign of only the leading term flipped). Correct: `−a/(x−b)`. Counterexample x=0: 1/2 vs −1/2.
- PARTIAL_DISTRIBUTE: old side `m·(p+q)`; candidate `m·p + q`.
- CONST_INTO_RADICAL: old `cbrt(a) ± c` or `sqrt(a) ± c`; candidate `cbrt(a ± c)`. Counterexample x=0: cbrt(3)−1≈0.44 vs cbrt(2)≈1.26.
- RECIP_COEFF: old `(p/q)·y = R`; candidates `y = R + q/p`, `y = (q/p)·firstTerm(R) + rest(R)`.
- DROPPED_PM: Tier 1 TAKE_ROOT_2 single branch.
- SWAP_MISNAME: inverse module, `L'≡L(x→x)` with `R'` containing only x (e.g. `x=(x+1)^3`) — rename check fails; message "swap BOTH letters".

## 8. Counterexample selection
Rank mismatch points: integers → fractions with denominator ≤ 6 (|v·d − round(v·d)| < 1e-6) → smallest |v|. Snap display to that fraction. Templates: equations "x = −3 solves the original but not your line" / "x = 4 satisfies your line, but the original is FALSE (√4 = 2, not −2)" / "…the original is UNDEFINED at x = 2"; inequalities "at x = 0 the original is TRUE, your line is FALSE"; two variables "at x = 2 the original needs y = 0.5, your line needs y = 1.5". Always print both sides' numeric values.

## 9. Test cases (Vitest) — expected verdicts
| # | old → new | expected |
|---|---|---|
| 1 | `-14 <= -14x` → `x >= 1` | NOT_EQUIVALENT, pattern NO_SIGN_FLIP; counterexample x=0 (old TRUE, new FALSE) |
| 2 | `-14 <= -14x` → `x <= 1` | EQUIVALENT, "divide both sides by negative (flip)" |
| 3 | `-14 <= -14x` → `1 >= x` | EQUIVALENT |
| 4 | `y = 1/(-x+2)` → `y = -1/(x+2)` | NOT_EQUIVALENT, pattern MINUS_TELEPORT; x=0: 1/2 vs −1/2 |
| 5 | `y = 1/(-x+2)` → `y = -1/(x-2)` | EQUIVALENT (REWRITE) |
| 6 | `x^2 = 9` → `x = 3` | LOST_SUBSET (lost −3), DROPPED_PM |
| 7 | `x^2 = 9` → `x = ±3` / `x = 3 or x = -3` | EQUIVALENT, "take root (± if even!)" |
| 8 | `sqrt(x) = -2` → `x = 4` | EXTRANEOUS_SUPERSET → reject; "x=4: √4 = 2 ≠ −2" |
| 9 | `y = (x+1)^3` → `x = (y+1)^3` (inverse module) | EQUIVALENT-BY-RENAME; same pair outside inverse module or second time ⇒ NOT_EQUIVALENT (counterexample (0,1)) |
| 10 | `y = (x+1)^3` → `x = (x+1)^3` | NOT_EQUIVALENT, SWAP_MISNAME |
| 11 | `x = (y+1)^3` → `cbrt(x) = y + 1` | EQUIVALENT, "take cube root" (also with `x^(1/3)`); sample x=−4 must evaluate (cbrt(−4) = −1.587) |
| 12 | `cbrt(7x+3) - 1 = y` → `cbrt(7x+2) = y` | NOT_EQUIVALENT, CONST_INTO_RADICAL |
| 13 | `x(y+2) = 5` → `xy + 2 = 5` | NOT_EQUIVALENT, PARTIAL_DISTRIBUTE; slice x=2: y 0.5 vs 1.5 |
| 14 | `x(y+2) = 5` → `xy + 2x = 5` | EQUIVALENT (REWRITE, distribute) |
| 15 | `(3/5)y = x - 2` → `y = (5/3)(x-2)` | EQUIVALENT (MUL_BOTH c=5/3) |
| 16 | `(3/5)y = x - 2` → `y = (5/3)x - 2` | NOT_EQUIVALENT, RECIP_COEFF |
| 17 | `x < 3` → `x <= 3` | NOT_EQUIVALENT; counterexample x=3 |
| 18 | `-3 < 2x+1 <= 5` → `-2 < x <= 2` | EQUIVALENT; → `-2 <= x <= 2` NOT_EQUIVALENT at x=−2 |
| 19 | `2x + 1 <= 7` → `x <= 3` | EQUIVALENT |
| 20 | `1/x < 2` → `1 < 2x` | NOT_EQUIVALENT (non-constant multiplier on inequality); counterexample x=−1 |
| 21 | `x/(x-2) = 2/(x-2)` → `x = 2` | EXTRANEOUS_SUPERSET (original undefined at 2) |
| 22 | `1/(x-2) = 0` → `x = 2` | EXTRANEOUS_SUPERSET; pole must not be reported as a root |
| 23 | `y = sqrt(x+7)` → (swap) `x = sqrt(y+7)` → `x^2 = y + 7` | step 2: EXTRANEOUS_SUPERSET via POWER_2 ⇒ accept with restriction `x ≥ 0`; final `y = x^2 - 7, x ≥ 0` |
| 24 | `y = x^2` → `x = y^2` → `y = sqrt(x)` | LOST_SUBSET; evidence "at x=4, y=−2 also works" (feeds one-to-one = no, reason 'even power gives ±') |
| 25 | `(x+1)^3 = 7y+3` → `x^3+3x^2+3x+1 = 7y+3` | EQUIVALENT at all samples including ±250 (relative tolerance) |
| 26 | `3/(x+2) = y` → `3 = y(x+2)` | EQUIVALENT (MUL_BOTH non-constant → Tier 2 agrees) |
| 27 | `(x-3)^2 <= 0` → `x = 3` | EQUIVALENT (tangential root found) |
| 28 | `x + 1 = 5` → `x + 1 = 7` | NOT_EQUIVALENT (regression for the vacuous-sampling bug) |
| 29 | `abs(x) = 3` → `x = 3` | LOST_SUBSET |
| 30 | `sqrt(x) >= 0` → `x >= 0` | EQUIVALENT; must not throw (Complex) — requires predictable:true |

## 10. math.js 15.2.0 facts (verified by execution)
- `parse('(x+1)^3 = 7y+3')` throws "Invalid left hand side of assignment operator ="; `parse('y = 7x+3')` → AssignmentNode. `==`, `<=`, `>=`, chained `-3 < 2x+1 <= 5` parse and evaluate to booleans. No `±`, no `≤`.
- `evaluate('2x')` works; `evaluate('xy+2')` → "Undefined symbol xy"; `evaluate('x(y+2)')` → "'x' is not a function".
- Default config: `sqrt(-4)` → `2i`; `sqrt(x) >= 0` at −4 throws "No ordering relation is defined for complex numbers"; `(-8)^(1/3)` → `1 + 1.732i`; `nthRoot(-4,2)` throws; `cbrt(-8)` → −2; `3/(x+2)` at −2 → Infinity; `Infinity == Infinity` → true.
- `predictable:true`: `sqrt(-4)` → NaN; `(-8)^(1/3)` → −2; `(-8)^(2/3)` → 3.9999999999999996; `NaN == NaN` → false.
- `==` uses relTol 1e-12 / absTol 1e-15 relative to the compared values: `0.1+0.2 == 0.3` true, but `(x+1)^3-x^3 == 3x^2+3x+1` at x=1e6+0.37 is FALSE (absolute error 93.5 on values ~3e12; relative to the 1e18 operands it is 9e-17).
- `x^2 == x` is true at x=1 and `2x == x` at x=0 — exclude these sample points.
