# LENS: Pedagogy, error-pattern matchers, hint ladder, property-chip quiz (plus the dual-calculator amendment where it touches the check-it habit)

## Findings

### P1 [blocker] engine prerequisite for matchers
**Claim:** The equation-legality test as written ("f_old(v)=0 ⟺ f_new(v)=0 on random samples") is vacuously true for every step, so matchers on the rejection path would never run for equations.

**Evidence:** Take the spec's own problem (x+1)^3 = 7y+3. At 12 random (x,y) in −10..10 the old line is never satisfied (a 1-D curve has measure zero), so f_old≠0 and f_new≠0 at every sample; the biconditional holds for the legal step x+1 = cbrt(7y+3) AND for the illegal x+1 = cbrt(7y)+3 alike. The second branch ("each side pair equivalent") would instead reject every legal both-sides operation (adding 1 to both sides changes both sides). Only the inequality truth-value test is sound as written.

**Recommendation:** Legality = tier 1 OR tier 2 OR tier 3. Tier 1 (rewrite): newL≡oldL and newR≡oldR numerically (or swapped, with relOp reversed for inequalities). Tier 2 (both-sides op detector, all numeric at ~12 samples with domain skips): add/sub iff (newL−oldL)≡(newR−oldR) and ≢0; mul/div iff newL/oldL≡newR/oldR≡k with k a nonzero constant (k<0 on an inequality requires reversed relOp); cube iff newL≡oldL^3 and newR≡oldR^3; cube-root iff newL^3≡oldL and newR^3≡oldR; square/sqrt analogously but routed to the caveat policy in P8. Tier 3 (fallback, equations only): solution-set comparison by 1-D root finding — for each of ~8 sampled values of the other variable, scan g(t)=L−R on a 600-point grid over [−15,15], bisect sign changes, also accept |g|<1e-7 grid minima for tangent roots; sets equal within 1e-6 → legal; new⊂old → 'lost solutions' rejection; new⊃old → extraneous (see P8). Matchers run only when all three tiers fail. Unit-test with the two worked lines above.

### P2 [blocker] parser (breaks patterns 6, 7, 8 and the relation model)
**Claim:** math.js cannot parse the spec's step language as-is: '=' is assignment, 'x(y+2)' is a function call, and parentheses survive as ParenthesisNode, so structural matchers written against the raw tree silently miss.

**Evidence:** Verified on mathjs 15.2.0: math.parse('(x+1)^3 = 7y+3') throws 'Invalid left hand side of assignment operator = (char 9)'; math.parse('y = 2x') yields an AssignmentNode and evaluate() returns 2 (it assigns y, it does not compare); math.parse('x(y+2)') is a FunctionNode and evaluate({x:3,y:1}) throws "'x' is not a function"; math.parse('x*(y+2)').args[1].type === 'ParenthesisNode', so a rule looking for an 'add' child under 'multiply' never fires until the tree is unwrapped. Also sqrt(-4) evaluates to the complex 2i by default (NaN only with create(all,{predictable:true})), which would make even-root domain skipping fail silently. Positive facts: cbrt(-8) = −2, -x^2 at 3 = −9, and '3/5y' evaluates as (3/5)·y (=6 at y=10), matching calculator convention.

**Recommendation:** (1) Split the line on the relational operator with the app's own regex (/(<=|>=|!=|=|<|>)/, exactly one allowed, '≤ ≥' normalized) BEFORE handing each side to math.parse; never let math.js see '='. (2) Preprocess implicit multiplication: replace /\b([xyn])\s*\(/g with '$1*(' and /\)\s*([xyn(])/ with ')*$1' (math.js already handles '2x', '2(x+1)', '(x+1)(x-1)'). (3) Immediately transform every parsed side with node.transform(k => k.type==='ParenthesisNode' ? k.content : k) and run all structural matchers on the stripped tree. (4) Build the math instance with create(all,{predictable:true}) so sqrt/even powers of negatives are NaN and are skipped as 'undefined at this sample'. (5) Show the KaTeX preview from the stripped tree's toTex() so '1/2x' visibly renders as ½·x and she can correct her own intent.

### P3 [major] matcher architecture
**Claim:** Five of the eleven seeded patterns are not (oldLine,newLine) matchers at all — 1, 2, 3 and 10 are final-answer notation checks and 11 is a timer — so the single 'matcher over (oldExpr,newExpr)' interface in the spec cannot host them.

**Evidence:** Pattern 1 '[a, −∞)' is a lexical/ordering property of one interval string; pattern 10 compares her interval answer with her set-builder answer, neither of which is a step; pattern 11 is idle time. Patterns 4–9 are genuine step matchers.

**Recommendation:** Define three interfaces: StepMatcher(oldRel, newRel, samples) → {patternId, witness}; AnswerMatcher(parsedAnswer, targetSet, otherAnswer?) → {patternId, witness}; IdleWatcher(problemState, visibility). Rules for 1/2/3/10 are in the reference table (they are exact, not heuristic: endpoint order, missing 'U' between two parsed pieces or a missing component vs target, bracket-pair around a single value or [a,a], membership disagreement at endpoint±ε probe points). Keep pattern counts per id in the progress store regardless of interface.

### P4 [major] step-matcher algorithm (patterns 5a, 6, 7, 8, 9 and additions)
**Claim:** Patterns 6–9 are detectable from (old,new) alone by 'buggy-candidate generation': apply the student's mistaken transform to the OLD tree, then test the candidate against NEW numerically; this is precise (no false positives from sign coincidences) and reuses the equivalence engine.

**Evidence:** Worked on mathjs 15.2.0: from old x*(y+2) the partial-distribution generator produced candidate 'x*y+2', which is numerically ≡ the student line x*y+2 at 4 samples and ≢ the original; for minus-teleport, 1/(-x+2) ≢ -1/(x+2) (her line) but ≡ -1/(x-2) (the fix), so the generator 'negate fraction, un-negate only the negative term' reproduces her line exactly. Because each generator mimics one specific mistake, a match names the mistake, unlike a bare counterexample.

**Recommendation:** Implement generators as node.transform passes on the stripped old tree, producing one candidate per applicable site (both sides); a pattern fires when any candidate line is tier-1-equivalent to the student's line (side-by-side). Run generators only after P1's three tiers reject. Order by specificity (exact algebraic rules first, e.g. 7 partial-distribute, 6 minus-teleport, 8 constant-fold, 9 reciprocal, A term-across, B power-over-sum, C split-denominator, D cancel-term, E add-denominators; then numeric signatures: I unlike-terms 'agrees at all-ones', G divide-by-variable ratio). If several fire, report the one whose candidate differs from old at the smallest subtree; log all ids for progress. Cap total candidates per line at ~200 and evaluations at 12 samples each — negligible cost.

### P5 [major] pattern 4 (sign flip) algorithm
**Claim:** Pattern 4 needs a normalized-form ratio test to distinguish 'divided by a negative and didn't flip' from 'flipped when adding' and from 'swapped sides without reversing'; the spec only says 'detect numerically'.

**Evidence:** Normalize every inequality to g ⋈ 0 with ⋈ ∈ {<,≤} (multiply by −1 and reverse when relOp is > or ≥). Old −14 ≤ −14x → g_old = 14x − 14 ≤ 0. Her unflipped line 1 ≤ x (or x ≥ 1) → g_new = 1 − x ≤ 0. Ratio g_new/g_old = (1−x)/(14(x−1)) = −1/14 at every sample: negative constant ⇒ she multiplied/divided by a negative and did not reverse. Her correct line x ≤ 1 gives ratio +1/14 and passes tier 2. The swap error 3 < x → x < 3 gives ratio −1 with newL≡oldR, newR≡oldL. The add-and-flip error x + 2 < 5 → x > 3 gives g_new = 3 − x, g_old = x − 3: difference test (newL−oldL)≡(newR−oldR) holds only after reversing, ratio −1.

**Recommendation:** Algorithm: (1) let new' = new with relOp reversed; if truthEquivalent(old,new') is false, this is not a direction error — fall through. (2) If newL≡oldR and newR≡oldL → K 'swapped sides, symbol must turn around' (check before ratio). (3) Compute r = g_new/g_old at samples: r ≡ negative constant → 4a 'divided/multiplied by c<0, flip required' (report c = 1/r); r ≡ positive constant → 4b 'you flipped, but the multiplier was positive — no flip'; if instead (g_new − g_old) ≡ constant or r is not constant → 4c 'adding/subtracting never flips'. Include the witness point in every message (x=0: old says TRUE, yours says FALSE).

### P6 [major] pattern 5/8 (radical steps) and the ± gap
**Claim:** Pattern 5 conflates two different bugs with different lessons, and the step language cannot express a legal even-root step at all because there is no ± or 'or' token — so the 'take root (± if even!)' chip can never be earned.

**Evidence:** cbrt(−u) = −cbrt(u) is LEGAL (odd root), so the cube-root lesson must be 'you may pull the minus out, but you may not drop it'; sqrt has no such rule and (x+7)^2 = 4y → x+7 = sqrt(4y) LOSES half the solution set (tier 3 reports new ⊂ old). Separately, the most common inverse-module error on y = cbrt(7x+3) − 1 is cubing only the radical term: y^3 = 7x + 3 − 1. Tier 2 sees newL ≡ oldL^3 but newR ≢ oldR^3, and the candidate 'cube the radical term only, leave the constant' reproduces her line exactly.

**Recommendation:** Split into 5a (cbrt sign dropped: candidate replaces each cbrt(A) in new with cbrt(−A) and tests ≡ old; lesson 'cbrt(−u) = −cbrt(u), the sign survives'), 5b (± dropped: tier-2 detects even-root op AND tier-3 says new ⊂ old; lesson 'even roots give ±'), and 8b (op applied to one term: newL ≡ op(oldL) and newR ≡ op(term_i(oldR)) + rest; lesson 'isolate the radical first, then cube the WHOLE side'). Add tokens: '+-' or '±' expands the line into two relations (union of solution sets), and 'or' joins relations; compound inequalities '−3 < x ≤ 5' parse to an 'and'. Without these, module 2 (compound answers) and any square-root inverse step are unreachable.

### P7 [major] property-chip quiz decidability
**Claim:** The engine can decide the correct chip exactly for both-sides operations and for canonical-path steps, but only heuristically for side rewrites, so grading must be family-based to avoid punishing a correct choice.

**Evidence:** Both-sides ops are numerically decidable (P1 tier 2): add/sub, mul/div, cube/square, root are mutually exclusive tests with constant k or difference d reported. Rewrite subclassification depends on an AST diff: 2(x−3)+5 = 1 → 2x−6+5 = 1 changes exactly the subtree 2(x−3) → 2x−6 (product-with-sum became a sum: 'distribute', unambiguous); 2x−6+5 → 2x−1 removes a term with identical variable part ('combine like terms', unambiguous); but x+3+2x → 3x+3 is simultaneously a commutative reorder and a combine, and 2x−1 = 1 → x = 1 is two moves (add 1, divide 2) in one line, matching neither pure detector.

**Recommendation:** Chip resolution order: (1) if the line is tier-1-equivalent to a canonical path line, use its stored tag(s). (2) Else run the tier-2 detector; exact chips: add/sub, mul/div (with 'flip' note when k<0 on an inequality), cube/square, root, plus a new 'swap sides' chip. (3) Else compute the minimal differing subtree pair (u in old, v in new, same position, u≡v numerically) after stripping parentheses and classify: u product-with-sum & v sum → distribute; reverse → factor; same multiset of terms/factors (canonical strings) in different order → commutative; same terms, different grouping → associative; fewer additive terms with same variable parts → combine like terms; either side changed division structure → rewrite fraction; else 'simplify'. (4) Grading: for step (2) require the exact chip; for step (3) accept ANY chip in the rewrite family {distribute, factor, combine, commutative, associative, rewrite fraction} unless the classifier was unambiguous (cases distribute/factor/combine only), then show 'we'd call this: combine like terms' as a one-liner; for multi-move lines (detector fails but line equals canonical line k+2) award both stored tags and accept either chip. Never penalize; skip the quiz entirely on pure-arithmetic canonical tags to keep the loop fast. Allow multi-select so 'subtract 3, then divide by 2' is expressible.

### P8 [major] extraneous/lost solutions policy (patterns G, H)
**Claim:** The spec has no policy for steps that change the solution set in a teacher-accepted way (squaring both sides, multiplying/dividing both sides by an expression containing the variable); a strict equivalence engine would reject them, a lax one would hide the dropped root x=0 in x^2 = 3x → x = 3.

**Evidence:** Tier 3 classifies x^2 = 3x → x = 3 as new ⊂ old (root 0 lost; ratio (newL−newR)/(oldL−oldR) = 1/x, non-constant, so the divisor was x). sqrt(x) = −3 → x = 9 is new ⊃ old (extraneous). On inequalities, dividing by x is illegal outright because the sign of x is unknown.

**Recommendation:** Three outcomes: (a) new ⊂ old with a non-constant ratio → reject with pattern G 'you divided by an expression that can be 0; factor instead: x(x−3)=0'. (b) new ⊃ old via square/multiply-by-expression → accept-with-caveat: append the line with a ⚠ 'may add extraneous solutions' badge and require a final 'check it' line before the problem can complete. (c) Any non-constant ratio on an inequality → reject with the sign-unknown lesson. Record (a) and (c) as pattern hits for the progress view.

### P9 [major] hint ladder
**Claim:** The hint ladder is defined against the canonical path but the student is allowed to take any legal route, so rungs 1 and 3 and the '3 of 5 steps' counter will be wrong or contradictory whenever she skips, merges, or reorders steps.

**Evidence:** Canonical for y = cbrt(7x+3) − 1: [swap] x = cbrt(7y+3) − 1 → [+1] x+1 = cbrt(7y+3) → [cube] (x+1)^3 = 7y+3 → [−3] → [÷7]. If her first line is x+1 = cbrt(7y+3) (swap and add in one move) the canonical 'next step' after her line 1 would be shown as the add-1 line she already passed. If she solves for x before swapping (y+1 = cbrt(7x+3)) no canonical line matches and 'show the step' would reveal a line in the wrong variables.

**Recommendation:** Anchor hints on her CURRENT line, not on her step count: find the highest canonical index whose line is tier-1-equivalent (allowing side swap) to her line; nudges, rule card, reveal, and the 'k of n' counter are all computed from that index. Generators must store the path twice (swap-first and swap-last variants) and anchor against both, which covers every route students actually take in this module. If no anchor exists, rung 3 says 'your line is legal but off the standard route' and reveals the standard route from the problem start (charged as one reveal). Nudge text (rung 1) is a template keyed by the next canonical tag, e.g. isolate-radical → 'get the cube root by itself first — what's still attached to it?', divide → 'y still has a coefficient; what undoes multiplying by 7?'. After a rejected step whose matcher fired, rung 2 pre-selects that pattern's rule card instead of the module's default. Highlight (don't open) the hint button after two consecutive rejections on the same step.

### P10 [minor] idle nudge (pattern 11)
**Claim:** Pattern 11 is under-specified (N, trigger conditions, repetition) and as written conflicts with 'hints are never automatic'.

**Evidence:** A student using the calculator or the Graph panel is legitimately idle; a nudge that fires while the tab is hidden or repeats every N minutes becomes a nag, and a nudge that reveals content breaks the ladder rule.

**Recommendation:** Fire once per problem after 3 minutes with no input event while document.visibilityState === 'visible' and at least one accepted step or typed character exists; non-modal toast: 'Still here? 2 steps to go — hint button is right there.' (progress only, no content). Persist the in-progress problem (seed + accepted lines) so the home screen shows a 'Resume: 3 of 5 steps done' card; on completion clear it. Count abandonments (problem left ≥24h) as a progress metric next to the pattern counters, since abandonment was one of her real behaviors.

### P11 [major] missing error patterns
**Claim:** The seed set omits the six or seven most frequent precalc manipulation errors, all of which are detectable with the same candidate-generation machinery and directly target her stated weakness (which moves the properties permit).

**Evidence:** Term moved across '=' without sign change (x+3 = 7 → x = 7+3) has the numeric signature (oldL−oldR) − (newL−newR) ≡ 2t for an additive term t of old (here 6 = 2·3); exponent/root distributed over a sum ((x+y)^2 → x^2+y^2, cbrt(7x+3) → cbrt(7x)+cbrt(3)) is exactly the illegal half of the module-5 discrimination she is supposed to learn; c/(a+b) → c/a + c/b is likewise named in module 5 but has no step matcher; (2x+4)/2 → x+4 and 1/x + 1/2 → 2/(x+2) are the two most common fraction errors; sqrt(x^2) → x and (−x)^2 → −x^2 are sign/abs errors that show up in the even/odd module; f⁻¹ = 1/f is the classic inverse misconception and is a one-line numeric check against the answer.

**Recommendation:** Add patterns A–N from the reference table (A term-across, B power/root over sum, C split denominator, D cancel a term, E add denominators, F sqrt(u^2)=u / dropped abs, G divide by variable expression, H squaring caveat, I combine unlike terms, J (−x)^n sign, K swap sides without reversing, L f(−x) substitution errors, M reciprocal-as-inverse, N wrong side / endpoint type in interval answers). Each has a generator or signature spelled out there; seed the Vitest suite with the mini examples.

### P12 [major] calculator amendment (dual TI-84 CE + TI-Nspire CX II panel)
**Claim:** The spec's calculator panel is TI-84-only and several of its instructions have no keystroke-for-keystroke Nspire equivalent, so the panel needs a per-family × per-calculator template table rather than a single template with an expression slot.

**Evidence:** Checked against TI's knowledge base: the Nspire has no DrawInv; the inverse is graphed with [menu] → 3: Graph Entry/Edit → 2: Relation and typing x=f1(y) (TI KB solution 38095, notes it requires a current OS — relation graphing arrived in OS 4.2). Cube root is the nth-root template: templates key immediately left of [9], 4th item on row 1, index 3 then [tab] then radicand (KB 29131). Window/Zoom is [menu] → 4, with 5: Zoom-Standard and B: Zoom-Square — a letter, not a number (KB 27950). Table is [ctrl][T], then [menu] → Table → Edit Table Settings → Independent: Ask. There is no 'Horizontal' draw tool on the Nspire; the horizontal-line test is done with f2(x)=c and a slider ([menu] → Actions → Insert Slider) or by grabbing and dragging the line. TI-84 side confirmed: DRAW is 2nd PRGM with 1: ClrDraw, 3: Horizontal, 8: DrawInv.

**Recommendation:** Data model: panels[familyId][calcId] = (instance) => Step[] with a tab toggle (TI-84 CE | TI-Nspire CX II) remembered in localStorage; a Vitest test asserts every registered family has both calculators and that every step string contains the instance expression where a slot exists. Nspire templates per family: inverses → f1(x)=<expr> ⏎; [ctrl][G]; [menu] 3 → 2: Relation, x=f1(y) ⏎; f2(x)=x with line style via [ctrl][menu] → Attributes; [menu] 4 → 5 then [menu] 4 → B (Zoom-Square, explain equal pixel scaling); ± case → f2(x)=sqrt(<expr>) and f3(x)=−f2(x) (function references are typed directly). One-to-one test → f2(x)=c slider. Plug-in check → [ctrl][T], [menu] → Table → Edit Table Settings → Independent: Ask, type the stored check value k. Cube root entry → templates key, nth-root template, 3 [tab] <radicand>. Because the app's own 'check it' step stores k with the instance, both panels should substitute k into the table step so the calculator habit and the app habit are the same number.

### P13 [minor] counterexample pedagogy
**Claim:** Random-sample counterexamples ('at x = −7.318…') are hard for a student to reproduce by hand or on the calculator, weakening the 'these aren't the same statement' lesson.

**Evidence:** The spec's samples are random over −10..10 plus large magnitudes; the only witness available on rejection is whichever sample failed first.

**Recommendation:** Search for a witness in the fixed order 0, 1, −1, 2, −2, 3, −3, 5, 10, ½ (skipping undefined points) before falling back to the failing random sample; display both lines evaluated at it with KaTeX and offer 'check it on your calculator' which jumps to the table step of the active calculator panel with that x prefilled.

### P14 [minor] pattern 9 lesson and even/odd module checks
**Claim:** Pattern 9 (reciprocal coefficient) and pattern 7 (partial distribution) share one root cause — an operation applied to one term instead of the whole side — and the even/odd module needs its own substitution matchers, neither of which the spec calls out.

**Evidence:** (3/5)y = x − 2 → y = (5/3)x − 2 (reciprocal applied to one term) is structurally the same error as x(y+2) → xy+2; in the even/odd module the lines to verify are f(−x) and −f(x) against numerically computed targets, and the typical failures are substituting −x into only one term (x^3 + x → −x^3 + x) and treating (−x)^3 as x^3 or (−x)^2 as −x^2.

**Recommendation:** Give patterns 7, 8b, 9-partial and E a shared lesson stem ('a move on a side applies to EVERY term of that side') with the pattern-specific example appended; in the even/odd module run the (target,hers) pair through generator L (substitute −x into a subset of occurrences; flip parity of (−x)^n) and pattern 7b (negative distributed to first term only) so the feedback names the term she missed.

## Design decisions

- **Legality engine tiers**: Legal iff tier 1 (side-by-side rewrite equivalence) OR tier 2 (numerically detected both-sides operation) OR tier 3 (equal solution sets via 1-D root finding on sampled slices); inequalities keep the spec's truth-value sampling as their tier-3.  
  _Why:_ The spec's zero-set biconditional is vacuous on random samples; the tiers also yield the operation label the chip quiz and hint anchoring need.

- **Matcher style**: Buggy-candidate generation on the parenthesis-stripped old AST is the primary mechanism; numeric signatures (all-ones agreement, 2t difference, non-constant ratio) are secondary with lower confidence and generic lessons.  
  _Why:_ Candidates reproduce the specific mistake and name it; signatures are cheap fallbacks but can collide.

- **Parser front-end**: App-owned relational split, implicit-multiplication preprocessing for x( / )x, ParenthesisNode stripping, and a math.js instance created with predictable:true.  
  _Why:_ Verified: math.js treats '=' as assignment, 'x(y+2)' as a call, keeps ParenthesisNode, and returns complex for sqrt of negatives by default.

- **Chip grading**: Exact chip required only for numerically decidable both-sides operations (add/sub, mul/div, cube/square, root, swap sides); rewrite-family chips are accepted as a family unless the AST classifier is unambiguous; multi-select allowed; never a penalty; quiz skipped on pure-arithmetic tags.  
  _Why:_ Rewrite subclassification is heuristic; punishing a defensible chip would teach the wrong lesson about property names.

- **± and disjunction grammar**: Add '+-'/'±' (expands to two relations) and 'or'/'and' (compound relations) to the step language; solution sets are unions/intersections.  
  _Why:_ Without them no legal even-root step or compound inequality can be entered, so the '± if even' chip and pattern 5b are unreachable.

- **Extraneous/lost solutions**: Lost solutions (new ⊂ old) reject with pattern G; extraneous (new ⊃ old via squaring or multiplying by a variable expression) accept-with-caveat and require a final check line; any variable-expression multiplier on an inequality rejects.  
  _Why:_ Matches classroom practice while still catching the dropped x=0 root, the error she is most likely to make.

- **Hint anchoring**: All hint rungs and the step counter derive from the highest canonical index equivalent to the student's current line, with canonical paths stored in swap-first and swap-last variants.  
  _Why:_ Students skip and merge steps; counting her lines would show wrong hints and wrong 'k of n'.

- **Idle nudge**: One toast per problem after 3 visible-idle minutes, progress-only text, plus a persistent Resume card; abandonment counted as a metric.  
  _Why:_ Respects 'hints never automatic' while addressing the abandonment behavior.

- **Dual calculator panel**: panels[family][calc] template table with a remembered tab, Nspire inverse via Relation x=f1(y), Zoom-Square as menu 4 → B, table via ctrl+T with Independent: Ask, and the stored check value k substituted into both calculators' table steps.  
  _Why:_ Verified against TI KB 38095, 29131, 27950; the Nspire has no DrawInv or Horizontal tool, so a single template cannot serve both devices.

## Reference

# Matcher reference

## Shared primitives (all numeric, ~12 samples, skip NaN/±∞ and |denominator|<1e-9)
- `equiv(A,B)`: |A−B| ≤ 1e-9·(1+|A|+|B|) at every defined sample; require ≥6 defined samples.
- `constRatio(A,B)`: A/B is the same finite nonzero value at every defined sample → returns k, else null.
- `constDiff(A,B)`: A−B constant → returns d, else null.
- `strip(node)`: `node.transform(k => k.type==='ParenthesisNode' ? k.content : k)`; run on every parsed side before any structural rule.
- `normIneq(rel)`: rewrite `L ⋈ R` as `g ⋈ 0` with ⋈ ∈ {<, ≤} (`g = L−R` for <,≤ ; `g = R−L` and reverse for >,≥).
- `truthEquiv(old,new)`: boolean values agree at every sample where both are defined (inequalities).
- `roots(rel, var, fixed)`: grid 600 points on [−15,15], bisect sign changes, add |g|<1e-7 minima; used for tier 3 on equations.
- `terms(sum)`, `factors(prod)`: flatten n-ary add/multiply after strip; canonical string = mathjs `toString()` of a sorted, simplified node.

## Legality tiers (run before any matcher)
1. Rewrite: `equiv(newL,oldL) && equiv(newR,oldR)`; or swapped with relOp reversed on inequalities.
2. Both-sides op (returns the label used by chips):
   - add/sub: `equiv(newL−oldL, newR−oldR)` and the difference ≢ 0 → tag `addsub`, term d.
   - mul/div: `constRatio(newL,oldL) === constRatio(newR,oldR) = k` → tag `muldiv`, k; inequality requires reversed relOp iff k<0.
   - cube: `equiv(newL, oldL^3) && equiv(newR, oldR^3)` → `power3`; cube root: `equiv(newL^3, oldL) && equiv(newR^3, oldR)` → `root3`.
   - square / sqrt: same shape with 2; route to the extraneous/lost policy.
   - swap: `equiv(newL,oldR) && equiv(newR,oldL)` with relOp reversed if inequality → `swap`.
3. Solution sets: equations → `roots()` on ~8 slices; inequalities → `truthEquiv`. Equal → legal; new⊂old → lost (reject, pattern G/5b); new⊃old → extraneous (accept-with-caveat, pattern H).

## Chip detector (side rewrites, tier 1 only)
Find minimal differing subtree pair (u,v) at the same path with `equiv(u,v)`. Classify:
| condition | chip | confidence |
|---|---|---|
| u = product with a sum factor, v = sum with more terms | distribute | high |
| reverse of the above | factor | high |
| `terms(u)` multiset == `terms(v)` multiset, different order (same for factors) | commutative | high |
| same terms, different nesting only | associative | medium |
| fewer terms in v, every term of u maps to a v-term with the same variable part | combine like terms | high |
| division nodes differ in structure (fraction split/merged/reduced) | rewrite fraction | medium |
| anything else | simplify (accept any rewrite chip) | low |
Grading: high → exact chip expected, else show 'we'd call this …' (no penalty); medium/low → accept any rewrite-family chip.

## Nudge templates (rung 1) keyed by next canonical tag
| tag | nudge |
|---|---|
| swap | "Inverse means swap the roles of x and y first." |
| isolate-radical / addsub | "Get the ⟨radical/variable⟩ alone — what's still added to it?" |
| power3 | "The cube root is alone now; what undoes a cube root?" |
| muldiv | "y still has a coefficient ⟨k⟩. What undoes multiplying by ⟨k⟩?" |
| muldiv-negative (inequality) | "You're about to divide by a negative — what happens to the symbol?" |
| distribute | "Something is multiplying a parenthesis — clear it first." |
| combine | "Two terms look alike. Put them together before moving on." |
| verdict | "Before the answer counts: is this function one-to-one? Say why." |

## Step matchers (run only after all tiers reject)
| id | pattern | detection rule | lesson text | mini example |
|---|---|---|---|---|
| 4a | no sign flip on negative mul/div | `truthEquiv(old, reverse(new))` and `constRatio(g_new,g_old) = r < 0` (after `normIneq`) | "You divided by ⟨1/r⟩, a negative. Dividing or multiplying by a negative turns the symbol around; adding/subtracting never does." | −14 ≤ −14x → x ≥ 1 ✗ (r = −1/14); correct x ≤ 1 |
| 4b | flipped on positive mul/div | same, `r > 0` | "You flipped, but you divided by ⟨1/r⟩, which is positive — the symbol stays." | 3x < 6 → x > 2 ✗ |
| 4c | flipped on add/sub | `truthEquiv(old, reverse(new))` and `constDiff(g_new,g_old)` or r non-constant | "Adding or subtracting on both sides never flips the symbol — only a negative multiplier does." | x + 2 < 5 → x > 3 ✗ |
| K | swapped sides without reversing | `equiv(newL,oldR) && equiv(newR,oldL)` and relOp unchanged (check before 4a) | "Reading an inequality backwards reverses the symbol: 3 < x is the same as x > 3." | 3 < x → x < 3 ✗ |
| 5a | cbrt sign dropped | candidates: replace each `cbrt(A)` in NEW by `cbrt(−A)`; fire if candidate ≡ old | "A cube root keeps the sign: ∛(−8) = −2, so ∛(−u) = −∛u. You may pull the minus out, never drop it." | cbrt(−x) → cbrt(x) ✗ |
| 5b | ± dropped on even root | tier 2 detects sqrt-both-sides AND tier 3 says new ⊂ old | "Even roots give two answers: if u² = 9 then u = ±3. Write both, or say why one is excluded." | (x+7)² = 4y → x+7 = √(4y) ✗ |
| 6 | minus teleported out of a fraction | generator on old: for each `N/D` with D a sum containing a negative term: candidate `−N/(D with only that term's sign flipped)`; fire if ≡ new | "A minus in front of a fraction negates the WHOLE denominator: 1/(−x+2) = −1/(x−2)." | 1/(−x+2) → −1/(x+2) ✗ |
| 7 | partial distribution | generator: for each `a·(b+c)` (any n terms): candidates `a·b + c`, `b + a·c` (first-only / last-only); fire if ≡ new | "Distribute to EVERY term inside the parentheses: x(y+2) = xy + 2x." | x(y+2) → xy + 2 ✗ |
| 7b | negative not distributed | generator: for `−k(b+c)`: candidate `−k·b + k·c` | "The minus sign is part of the multiplier, so it reaches every term: −2(x−3) = −2x + 6." | −2(x−3) → −2x − 6 ✗ |
| 8 | constant folded into radical/paren | generator: for `f(A) ± c` with f ∈ {sqrt,cbrt,abs,^n}: candidate `f(A ± c)`; also reverse direction | "−1 is outside the cube root; it can't move inside. Undo the −1 first (add 1 to both sides), then deal with the root." | cbrt(7x+3) − 1 → cbrt(7x+2) ✗ |
| 8b | operation applied to one term | tier 2: `equiv(newL, op(oldL))` but `!equiv(newR, op(oldR))`; candidate `op(term_i(oldR)) + rest` for each term | "Cubing applies to the whole side, not one term. Isolate the radical first, then cube everything." | y = cbrt(7x+3) − 1 → y³ = 7x+3 − 1 ✗ |
| 9 | reciprocal-coefficient errors | old `k·y ⋈ R`, k rational: candidates `y ⋈ R+k`, `R−k`, `R+1/k`, `R−1/k`, `k·R`, and partial `(1/k)·term_1(R) + rest`; fire if ≡ new | "A coefficient is multiplication, so it's undone by multiplying by the reciprocal — on every term of the other side." | (3/5)y = x − 2 → y = x − 2 + 5/3 ✗; → y = (5/3)x − 2 ✗ |
| A | term moved across = without sign change | signature `(oldL−oldR) − (newL−newR) ≡ 2t` for an additive term t of old; or candidate: move t with same sign | "Moving a term across = means subtracting it from both sides, so its sign changes." | x + 3 = 7 → x = 7 + 3 ✗ |
| B | exponent/root distributed over a sum | generator: `f(A+B)` with f ∈ {^n, sqrt, cbrt, abs} → candidate `f(A)+f(B)` | "Powers and roots distribute over multiplication, never over addition: (xy)² = x²y² but (x+y)² ≠ x²+y²." | (x+1)³ → x³ + 1 ✗ |
| C | c/(a+b) split | generator: fraction with sum denominator → candidate `c/a + c/b` | "You can split a numerator sum, not a denominator sum: (a+b)/c = a/c + b/c, but c/(a+b) stays." | 3/(x+2) → 3/x + 3/2 ✗ |
| D | cancelled a term instead of a factor | generator: `(A+B)/C` → candidates `A/C + B`, `A + B/C`, and `A + B` when C matches one term | "Only common FACTORS cancel; every term of the numerator gets divided." | (2x+4)/2 → x + 4 ✗ |
| E | fractions added by adding denominators | generator: `a/b + c/d` → candidate `(a+c)/(b+d)` | "Fractions need a common denominator; 1/2 + 1/2 is not 2/4." | 1/x + 1/2 → 2/(x+2) ✗ |
| F | √(u²) = u / abs dropped | generator: replace `sqrt(A^2)` by `A`, or `abs(A)` by `A` | "√(u²) is |u|; it is never negative." | sqrt((x−1)²) → x − 1 ✗ |
| G | divided both sides by an expression containing the variable | tier 3 new ⊂ old and `constRatio` fails but `newL−newR ≡ (oldL−oldR)/h(x)` for a factor h of old | "You divided by ⟨h⟩, which is 0 at x = ⟨root⟩ — that solution vanished. Factor instead: x(x−3) = 0." | x² = 3x → x = 3 ✗ (lost x = 0) |
| H | squaring / multiplying by variable expression (accept-with-caveat) | tier 2 square-both-sides or `newL−newR ≡ (oldL−oldR)·h(x)` with tier 3 new ⊃ old | badge: "Legal, but squaring can create extra answers — check each answer in the original at the end." | √x = −3 → x = 9 ⚠ |
| I | combined unlike terms | signature: `equiv` fails but old and new agree at all-ones sample (x=y=n=1); confirm with candidate `(c1+c2)·varpart` | "Only like terms combine: 2x + 3 stays 2x + 3." | 2x + 3 → 5x ✗ |
| J | (−x)ⁿ sign | generator: `(−A)^n` ↔ `−(A^n)` for even n; `(−A)^n` → `A^n` for odd n | "(−x)² = x², but −x² is the negative of x²; odd powers keep the minus." | (−x)² → −x² ✗ |
| L | f(−x) substitution errors (even/odd module, compare to computed f(−x)) | candidates: substitute −x into a subset of occurrences; apply J to each power | "Replace EVERY x with (−x), keep the parentheses, then simplify each power." | x³ + x → −x³ + x ✗ |
| M | f⁻¹ written as 1/f | answer ≡ 1/f(x) numerically | "f⁻¹ undoes f; it is not 1/f. Check: f(f⁻¹(k)) should return k." | f(x)=2x+1 → f⁻¹ = 1/(2x+1) ✗ |

## Answer matchers (final-answer inputs)
| id | pattern | detection rule | lesson text | mini example |
|---|---|---|---|---|
| 1 | backwards interval | parsed piece (l,r): `l === +inf` or `r === −inf` or (finite and l > r); also `[` next to ±inf | "Intervals read left → right on the number line; −∞ always leads and gets a (." | [3, −∞) ✗ → (−∞, 3] |
| 2 | dropped ∪ | (a) two pieces juxtaposed without U; (b) her set ⊊ target and target∖hers is a whole component | "Two separate pieces need ∪ between them — one interval can't have a gap." | (−∞, −2] (5, ∞) ✗ |
| 3 | [3] for a point | bracket pair containing one value or [a,a] | "A single number is a set of one element: {3}. Brackets need two endpoints." | [3] ✗ → {3} |
| 10 | set/interval mismatch | probe membership at every endpoint of both answers and target, each ±ε, plus ±1e6; any disagreement between her two answers → witness | "Your interval and your set describe different numbers: x = ⟨w⟩ is in one but not the other." | (−∞,2) vs {x ∣ x ≤ 2}: witness 2 |
| N1 | wrong side / complement | her set ≡ complement(target) on probe points | "You shaded the wrong side: x > −2 is to the RIGHT of −2." | x > −2 → (−∞, −2) ✗ |
| N2 | endpoint type | her set differs from target only at endpoint probes | "≤ includes the endpoint → bracket; < excludes it → parenthesis." | x ≤ 2 → (−∞, 2) ✗ |

## Idle watcher
| id | pattern | rule | text |
|---|---|---|---|
| 11 | abandoned problem | 3 min no input, tab visible, ≥1 accepted step or typed char, once per problem; Resume card persisted | "Still here? 2 steps to go — the hint button is right there." |

## Dual-calculator panel keystrokes (per family; ⟨expr⟩, ⟨k⟩ substituted)
| task | TI-84 Plus CE | TI-Nspire CX II (non-CAS) |
|---|---|---|
| enter f | `Y=`, Y1=⟨expr⟩; cube root `MATH → 4: ³√(`; nth root `MATH → 5: ˣ√`; fraction `ALPHA → Y= → n/d` | Graphs page, f1(x)=⟨expr⟩ ⏎; cube root: templates key (left of [9]) → nth-root template (row 1, item 4) → 3 [tab] ⟨radicand⟩; fraction: templates key → fraction template |
| window | `ZOOM 6: ZStandard`, then `ZOOM 5: ZSquare` when y = x symmetry matters | `[menu] 4: Window/Zoom → 5: Zoom-Standard`, then `[menu] 4 → B: Zoom-Square` |
| inverse overlay | `2nd PRGM (DRAW) → 8: DrawInv Y1`; clear with `2nd PRGM → 1: ClrDraw` | `[ctrl][G]`, `[menu] 3: Graph Entry/Edit → 2: Relation`, type `x=f1(y)` ⏎ (needs current OS; relation graphing is OS 4.2+) |
| y = x mirror | Y2=X, cursor left of Y2, ENTER to cycle line style | f2(x)=x; `[ctrl][menu] → Attributes` for dotted style |
| one-to-one visual | `2nd PRGM → 3: Horizontal`, arrow up/down | f2(x)=c with `[menu] → Actions → Insert Slider` on c (or grab and drag the line) |
| ± case | Y2=√(⟨inner⟩), Y3=−Y2 via `VARS → Y-VARS → 1 → Y2` | f2(x)=√(⟨inner⟩), f3(x)=−f2(x) typed directly |
| plug-in check with ⟨k⟩ | `2nd WINDOW (TBLSET)` → Indpnt: Ask; `2nd GRAPH (TABLE)`, type ⟨k⟩ | `[ctrl][T]` split table; `[menu] → Table → Edit Table Settings → Independent: Ask`; type ⟨k⟩ |
| inequality answer | number line in app (no calculator step) | same |

Sources checked: TI KB 38095 (Nspire inverse via Relation x=f1(y)), TI KB 29131 (nth-root template location), TI KB 27950 (Window/Zoom numbering, Zoom-Square = B), TI-84 Plus guidebook DRAW menu (1 ClrDraw, 3 Horizontal, 8 DrawInv), mathjs 15.2.0 executed locally (assignment '=', FunctionNode for x(...), ParenthesisNode retention, predictable option, '3/5y' = (3/5)y).
