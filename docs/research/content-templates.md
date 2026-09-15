# LENS: Content generation and clean-number constraints (problem templates, parameter ranges, canonical paths, hint texts, check values) for the five Unit-1 modules, plus the TI-84 Plus CE + TI-Nspire CX II (non-CAS) keystroke amendment.

## Findings

### CG-01 [blocker] Inverses / step engine
**Claim:** The 'swap x and y' step in every inverse canonical path is NOT an equivalence of relations, so the spec's equivalence-only verifier will reject the canonical path itself, and the chip list has no tag for it.

**Evidence:** y = cbrt(x+1) - 2 vs x = cbrt(y+1) - 2: at (x,y) = (7,0) the old line is TRUE and the new line is FALSE (cbrt(1)-2 = -1 ≠ 7). Any legal path for the six inverse families contains exactly one such step; the spec's property chips (add/subtract … rewrite fraction) contain nothing to tag it, and 'combine like terms' etc. cannot justify it.

**Recommendation:** Add a distinguished step kind `swap_xy` (chip text: 'swap x and y (inverse relation)'). Verify it by checking new(x,y) ≡ old(y,x) with the same sampler used elsewhere; allow it at most once per problem and record whether it happened so the final answer `f⁻¹(x) = …` is compared against the correct orientation. Also accept the alternative route (solve for x first, swap at the end) since it only changes where the single swap occurs.

### CG-02 [blocker] Inverses / step engine
**Claim:** Random (x,y) sampling of two-variable relations is vacuous: every line in an inverse problem is an equation with a 1-D solution curve, so a random point is a solution of neither line and 'same zero set on samples' passes for everything, including wrong lines.

**Evidence:** Old: x = 2y/(y+3)... concretely old: x = (2y+1)/(y+3), wrong new: x = 2y+1 (dropped denominator). Sample (x,y) = (0.37, -4.2): old residual ≠ 0, new residual ≠ 0 → both 'not satisfied' → sampler reports agreement and ACCEPTS the illegal step. The only lines a random sampler would reject are trivially true ones like 0 = 0.

**Recommendation:** For inverse problems sample ON the known solution curve, not at random: generate points (t, f(t)) for ~12 values of t (skip poles / outside domain), transform to (f(t), t) once the recorded swap has happened, and require the new line to be TRUE at all of them (residual < ε·scale). Add the converse test with ~12 random off-curve points where the new line must be FALSE (catches 0=0 / x=x). Counterexample message becomes: 'The point (x,y) = (2, 1) is on your previous line (check: 1 = (2·2+1)/(2+3) ✓) but not on your new line.' Single-variable inequality sampling stays as specified — that part of the spec is right.

### CG-03 [major] Inverses / cube-root family
**Claim:** For f(x) = cbrt(ax+b)+c with a ≠ 1, an integer check value k with integer f(k) often does not exist, so the spec's own example cbrt(7x+3) can never satisfy the 'round-trip lands on integers' rule.

**Evidence:** f(k) integer ⇔ 7k+3 is a perfect cube m³. Cubes mod 7 are {0,1,6}; 3 is never a residue, so no integer k works (scratch script confirmed; also a=4 fails for b ∈ {±2, ±6}, a=7 fails for 10 of 19 b values in −9..9). Picking (a,b) first and then searching for k therefore fails silently for a large fraction of parameter draws.

**Recommendation:** Reverse the construction: draw the cube root m ∈ {−3..3}\{0}, the check value k ∈ {−4..4}, and a, c; then SET b = m³ − a·k (reject |b| > 15). f(k) = m + c is an integer by construction and f⁻¹(m+c) = ((m+c−c)³ − b)/a = k exactly. Examples: a=7, m=2, k=1 → b=1 → cbrt(7x+1): f(1)=2+c. a=7, m=3, k=3 → b=6 → cbrt(7x+6). Shift-only family a=1: k = m³ − b directly (cbrt(x+1)−2: k=7, f(7)=0, f⁻¹(0)=8−1=7). Store k, m and f(k) on the instance.

### CG-04 [major] Inverses / Möbius family
**Claim:** Möbius (ax+b)/(cx+d) needs an explicit integrality criterion for the check value; the spec's 'pick parameters so f(k) is an integer' is under-specified and, done by float search, will produce k values with non-integer f(k) or hit the pole.

**Evidence:** With n = ck+d and Δ = ad−bc: f(k) = (a·n − Δ)/(c·n). For c=1 this is integer ⇔ (k+d) | Δ. Worked: f(x) = (2x+1)/(x+3), Δ = 5 → k+3 ∈ {±1,±5} → k ∈ {2, −2, −4, −8}; f(2)=1, f(−2)=−3. Inverse: x(y+3)=2y+1 → xy−2y = 1−3x → y(x−2) = 1−3x → f⁻¹(x) = (1−3x)/(x−2) = (3x−1)/(2−x); f⁻¹(1)=2 ✓, f⁻¹(−3)=−10/−5=−2 ✓ (script). Asymptotes f: VA x=−3, HA y=2; f⁻¹: VA x=2, HA y=−3 — the swap is the teaching point.

**Recommendation:** Generate a ∈ ±{1..5}, b ∈ ±{1..6}, d ∈ ±{1..6}, c ∈ {1} (knob: c=2 with a,d odd → half-integer asymptotes), reject Δ=0 and gcd(a,b,c,d)>1. Then brute-force k ∈ [−8,8] with exact integer arithmetic (not floats): keep k iff ck+d ≠ 0 and (ck+d) | (ak+b) and |f(k)| ≤ 12; require ≥2 such k (for c=1 every instance in the stated ranges has ≥2 — script checked all 1388). Store k, f(k), the asymptote pairs (−d/c, a/c) and (a/c, −d/c), and the general inverse f⁻¹(x) = (dx−b)/(−cx+a).

### CG-05 [major] Canonical path / hints / progress
**Claim:** A fixed ordered canonical path cannot drive 'show next step' or '3 of 5 steps' once the student takes a different legal route, and equivalence cannot tell you which canonical step she is 'at' because every legal line is equivalent to every other.

**Evidence:** Problem −3(x−2)+4x ≤ 6x+3. Canonical: distribute → combine → −5x+6 ≤ 3 → −5x ≤ −3 → x ≥ 3/5. A student who instead writes x+6 ≤ 6x+3 → 3 ≤ 5x → x ≥ 3/5 never divides by a negative; after her line '3 ≤ 5x' the stored canonical next line '−5x ≤ −3' does not follow from what is on her screen, and hint 3 would show it anyway.

**Recommendation:** Store the canonical path for display/grading, but compute hints and progress from STRUCTURAL stage predicates evaluated on the current line: for linear inequalities S1 no parentheses, S2 ≤1 variable term and ≤1 constant per side, S3 variable on one side only, S4 constant on the other side only, S5 coefficient 1 with the relation solved. Progress = stages satisfied / 5. Hint 3 = apply the canonical strategy to HER current line (distribute if S1 false; else combine; else move the variable term to the side with the larger coefficient — which is what makes the divide-by-negative variant appear only when she chooses the negative side; else move constant; else divide, flipping if negative). For inverses use stages: swapped / denominators cleared / radical or power isolated / y isolated. Same rule for hint 1 wording ('what's still attached to y?').

### CG-06 [major] Number line & set notation
**Claim:** Verifying set-builder vs interval 'by sampling' with random points misses exactly the things this module tests: open vs closed endpoints and isolated points.

**Evidence:** Target (−∞,−2) ∪ [1,4) ∪ {6}. Student set {x | x < −2 or 1 < x < 4 or x = 6} differs only at x=1; student interval (−∞,−2) ∪ [1,4) differs only at x=6. Twelve random reals in [−10,10] hit x=1 or x=6 with probability 0.

**Recommendation:** Model a solution set as a normalized list of pieces {lo, hi, loClosed, hiClosed} with lo,hi ∈ ℚ∪{±∞} plus points; normalize (sort, merge touching pieces, absorb a point sitting on an open endpoint: (−∞,2)∪{2} → (−∞,2]). Compare interval answers structurally after normalization. Verify a set-builder predicate deterministically: collect critical values E = all endpoints/points of both the target and the student's predicate (parse her chain/or/and expression to extract them); test the predicate at every e ∈ E and at the midpoint of every consecutive pair in sorted E ∪ {min(E)−1, max(E)+1}. That is exact for this class of sets. Generator: 1–3 pieces, integer endpoints in [−8,8], consecutive critical values ≥2 apart (≥3 across a 'hole' so the gap renders), ≤1 isolated point, at most one unbounded end per ray.

### CG-07 [major] Even/odd/neither
**Claim:** Comparing f(−x) with ±f(x) only 'where both sides are defined' (the spec's domain-skipping rule) declares functions with asymmetric domains even AND odd when the overlap is degenerate, and gives no way to explain the correct 'neither' verdict.

**Evidence:** f(x) = sqrt(x): f(−x) = sqrt(−x) is defined only at x ≤ 0, so the overlap with f's domain is {0}; there f(0)=f(−0)=−f(0)=0 and the sampler reports both symmetries. Script run: 1/(x+2) also needs the domain check — the numeric test only flags it 'neither' because a sample at x=2 finds f(−2) undefined.

**Recommendation:** Add a domain-symmetry pre-check: if any sample x has f(x) defined and f(−x) undefined (or vice versa) the verdict is NEITHER with reason 'domain is not symmetric about 0' (teach it as the first question to ask). Only then compare values at symmetric points. Item bank with verified verdicts (script): polynomial — even 3x⁴−2x²+5, odd x³−4x, neither x³+x²; root — odd cbrt(x), even x·cbrt(x), neither cbrt(x)+1, even sqrt(25−x²), odd x·sqrt(25−x²), neither sqrt(x+3); rational — odd 1/x, even 1/(x²−4), odd x/(x²−1), even (x²+1)/(x²−3), odd (x²+1)/x, neither 1/(x+2); abs — even |x|, odd x|x|, neither |x|+x. Generation rules: polynomial verdict is decided by the exponent set (all even incl. 0 → even; all odd → odd; mixed → neither), coefficients ±1..5, 2–3 terms; rational = (poly)/(poly) with the same parity rule per part (even/even → even, odd/even or even/odd → odd, else neither), denominator with no real root at the check value.

### CG-08 [major] Even/odd check values
**Claim:** The 'plug-in test taught as the check' needs stored check values with clean f(k) and f(−k), which the root and rational families do not give for arbitrary parameters.

**Evidence:** sqrt(9−x²) at k=1 gives sqrt(8); x/(x²−1) at k=1 is undefined; cbrt(x)+1 at k=2 gives 1.26+1.

**Recommendation:** Store k per instance chosen by constraint: polynomials k ∈ {1,2}; cbrt family k ∈ {±8, ±27} (cbrt(8)=2 — makes cbrt(−8) = −2 the visible sign fold); sqrt(a²−x²) family draw a from Pythagorean hypotenuses {5, 13} with k the matching leg (sqrt(25−9)=4); rationals k ∈ {1,2,3} with denominator ≠ 0 at ±k and |f(k)| a fraction with denominator ≤ 5. Show the plug-in table f(k), f(−k), −f(k) next to the verdict.

### CG-09 [major] Inverses / quadratic (not one-to-one) family
**Claim:** The quadratic family's deliverable is under-specified: the TI section graphs the ± branches (Y2 = √((X+7)/4), Y3 = −Y2) and the chips include 'take root (± if even!)', but the input format cannot express ± and the spec does not say whether a restricted-domain inverse is required after the 'no' verdict.

**Evidence:** math.js cannot parse 'y = ±sqrt((x+7)/4)'; the spec's plain-text input has no ± token. For f(x) = 4x²−7 the round trip with stored k=2 is f(2)=9, √((9+7)/4)=2 ✓ but the twin k=−2 gives f(−2)=9 → 2 ≠ −2, which is the actual lesson.

**Recommendation:** Define the family as: f(x) = a(x−h)² + c (a ∈ ±{1,2,3,4}, h ∈ {0} or −3..3, c ∈ −9..9), required deliverables = verdict NO + reason 'even power gives ±' or 'repeated y-value: f(k) = f(2h−k)'; store the twin pair (k, 2h−k) with k = h+2 so both values are integers. Optional bonus path on the restricted domain x ≥ h: swap → isolate (y−h)² = (x−c)/a → y = h + sqrt((x−c)/a). Support a `+-` token in the parser that expands a line into the disjunction of two relations (solution set = union) so the ± line can be typed and verified; otherwise render the ± line as a non-typed explanatory card. Graph the reflected relation parametrically as (a(t−h)²+c, t).

### CG-10 [minor] Inverses / simple rational a/(x+b)+c
**Claim:** The rational family needs an explicit divisor rule for k and a guard for the self-inverse case, neither of which the spec states.

**Evidence:** f(x) = 3/(x−2)+1: f(k) integer ⇔ (k−2) | 3 → k ∈ {3, 1, 5, −1} with f = 4, −2, 2, 0 and f⁻¹(x) = 3/(x−1)+2 returning 3, 1, 5, −1 (script). With b=c=0 (f(x)=a/x) the inverse equals f, which a student will read as 'I made a mistake'.

**Recommendation:** Draw a ∈ ±{1,2,3,4,6}, b,c ∈ −6..6 with not both zero; k = d − b for a divisor d of a with |k| ≤ 8, preferring d ∈ {±1, ±a}; store k and f(k)=a/d+c. Asymptotes are integers automatically (f: x=−b, y=c; f⁻¹: x=c, y=−b). Canonical path: y=a/(x+b)+c → swap → x−c = a/(y+b) [sub_both] → (y+b)(x−c) = a [mul_both by (y+b), clear_denominator] → y+b = a/(x−c) [div_both by (x−c)] → y = a/(x−c) − b [sub_both]. Note the multiply-by-(y+b) step is accepted by the on-curve sampler of CG-02 because Δ≠0 guarantees no point with y+b=0 lies on the curve.

### CG-11 [minor] Linear inequalities
**Claim:** The spec's clean-answer rule ('integers or fifths/thirds') is stated on the answer only; intermediate canonical lines must also be integer-coefficient, the interval input must accept fraction endpoints, and the fractional-coefficient template has an unstated divisibility condition.

**Evidence:** Template a(x+b) + cx ⋈ dx + e collects to m·x ⋈ r with m = a+c−d, r = e−ab; s = r/m must be in the allowed set. Choosing s = 3/5 and m = −5 forces r = −3 → e = ab − 3; with a=−3, b=−2, c=4, d=6 this yields −3(x−2)+4x ≤ 6x+3 → x ≥ 3/5 (truth-table check: x=0 makes the un-flipped x ≤ 3/5 TRUE while the original is FALSE — the counterexample the spec wants). (3/5)y + 2 ≤ 8 has y ≤ 10 only because 3 | (8−2); (3/5)y + 2 ≤ 9 gives y ≤ 35/3.

**Recommendation:** Generate solution s first from S = ℤ∩[−8,8] ∪ {±1/3, ±2/3, ±4/3, ±5/3, ±1/5, ±2/5, ±3/5, ±4/5, ±6/5}; choose m with denominator(s) | m (m ∈ −5..−2 for the divide-by-negative knob, 2..5 otherwise), r = m·s; then a ∈ ±{2,3,4}, b ∈ ±{1,2,3}, c, d ∈ −6..6 with a+c−d = m, e = r + ab, |e| ≤ 40. Fractional template ±(p/q)y + t ⋈ u: q ∈ {2,3,4,5}, p coprime, and require p | (u−t) for the integer variant (else the answer is a q-ths fraction; allowed only when q ∈ {3,5}). Interval and set inputs must parse '3/5', '-2/3' and decimals at endpoints, and compare as rationals, not floats.

### CG-12 [minor] Properties drill item bank
**Claim:** The drill needs a fixed item schema built as minimal legal/illegal pairs, instantiated with random constants, and cross-checked by the equivalence engine — otherwise the bank will drift out of sync with what the step verifier accepts.

**Evidence:** Every item in the spec's list has a twin: (xy)² = x²y² (legal) vs (x+y)² = x²+y² (illegal); (a+b)/c = a/c+b/c (legal) vs c/(a+b) = c/a+c/b (illegal); −2x < 6 → x > −3 (legal) vs x < −3 (illegal); 1/(−x+2) = −1/(x−2) (legal) vs −1/(x+2) (illegal, pattern 6); (3/5)y+1 = 7 → 3y+5 = 35 (legal) vs 3y+1 = 35 (illegal, pattern 9); (2+x)+5 → (x+2)+5 (commutative) vs 2+(x+5) (associative).

**Recommendation:** Schema: {id, family, before, after, relOp?, verdict: 'legal'|'illegal', propertyTag?, errorPatternId?, lesson, twinId, params: {a,b,c ranges}}. Instantiate with small nonzero integers (|·| ≤ 9, distinct, avoid values that make an illegal twin accidentally true, e.g. (x+y)² = x²+y² holds when a=0 or b=0). Vitest: for every generated item assert engine.verify(before, after) === (verdict === 'legal'); this makes the bank a regression suite for the engine and vice versa.

### CG-13 [major] Calculator panel (TI-84 Plus CE + TI-Nspire CX II amendment)
**Claim:** The Nspire CX II has no DrawInv and no Horizontal-line draw command, its cube-root of a negative depends on a mode setting, and its inverse path differs from the TI-84, so a single instruction template with the expression substituted will be wrong on one of the two calculators.

**Evidence:** TI KB 38095: on the Nspire CX family graph the inverse with menu → 3:Graph Entry/Edit → 2:Relation, then type x=f1(y). TI KB 31051: ³√(−27) returns −3 in Real mode but 1.5+2.59808i in Rectangular mode, so cbrt(x+1)−2 graphs only for x ≥ −1 on a student's Nspire left in Rectangular. TI KB 27950: Window/Zoom is menu 4, Zoom-Standard = 5, Zoom-Square = B. Nspire shortcut page: ctrl+÷ = fraction template, ctrl+T = Add Function Table in Graphs. TI-84 side of the spec checks out: MATH 4:³√(, MATH 5:ˣ√ (TI KB 34754), 2nd PRGM 8:DrawInv, not traceable.

**Recommendation:** Keep two keystroke templates per family (table in reference). Nspire specifics: set Complex Format to Real once (doc settings) and say why; cube root via the templates key → ˣ√ template with index 3 (or type root(x+1,3)); inverse via Relation x=f1(y) (traceable, unlike DrawInv); horizontal-line test via a second function f2(x)=k with a slider or just trace f1 with ctrl+T table looking for repeated values; square window via menu 4 → B. TI-84: after DrawInv, note ZOOM 5:ZSquare must be applied BEFORE drawing because ClrDraw wipes drawings on any window change.

### CG-14 [note] Property tag vocabulary
**Claim:** Generator canonical paths, chips, hint rule cards and the drill must share one enum; the spec lists chips as prose and never names tags.

**Evidence:** The canonical paths in this review need tags the chip list lacks: swap_xy, clear_denominator (multiply both sides by an expression), reciprocal_multiply, isolate/rename to f⁻¹(x).

**Recommendation:** Define PropertyTag = distribute | combine_like | add_both | sub_both | mul_both_pos | mul_both_neg_flip | div_both_pos | div_both_neg_flip | commutative | associative | factor | cube_both | square_both | root_both_pm | rewrite_fraction | swap_xy | clear_denominator | reciprocal_multiply | rename_inverse; the chip labels map 1:1 onto these.

## Design decisions

- **Parameter construction order**: Choose the clean target (solution s, check value k, cube root m, divisor d) FIRST and derive the remaining coefficient from it; never draw coefficients and search for a clean k afterwards.  
  _Why:_ Searching after the fact fails for whole parameter classes (cbrt(7x+3) has no integer k at all) and silently biases the distribution; deriving b = m³ − a·k, r = m·s, k = d − b guarantees integrality with no rejection loop. Möbius is the one family where a bounded brute-force over k ∈ [−8,8] with exact integer arithmetic is simpler and always succeeds in the stated ranges.

- **Check value semantics**: Each inverse instance stores k, f(k), and (for quadratics) the twin 2h−k; the app's 'check it' shows f(k) then f⁻¹(f(k)) and, for the not-one-to-one case, f⁻¹(f(twin)) ≠ twin.  
  _Why:_ Round-trip with integers is the only check she can do by hand and on the calculator table (Indpnt: Ask / ctrl+T) and the twin makes the one-to-one failure concrete instead of abstract.

- **Canonical path vs. student path**: Canonical path is stored for grading and 'show the step', but hints and progress are computed from structural stage predicates on the student's current line.  
  _Why:_ All legal lines are equivalent relations, so equivalence cannot locate her position; structural stages can, and they stay valid when she takes the other legal route (e.g. moving x-terms to avoid dividing by a negative).

- **Two-variable verification**: Inverse problems are verified by on-curve sampling (points (t,f(t)) or (f(t),t) after the recorded swap) plus off-curve falsity, with swap_xy as a distinguished step kind.  
  _Why:_ Random (x,y) sampling is vacuous for equations with a 1-D solution set; on-curve sampling is exact enough and gives a concrete counterexample point to show.

- **Solution sets**: One normalized SolutionSet model (pieces + points, rational endpoints) shared by the number-line renderer, the interval validator, the set-builder validator and the inequality answer checker; set-builder verified at critical values and midpoints, not random samples.  
  _Why:_ Open/closed endpoints and isolated points are measure-zero; only deterministic critical-point testing detects them.

- **Even/odd domain rule**: Domain symmetry is checked first and is a teachable reason for 'neither'; value comparison only afterwards.  
  _Why:_ Prevents vacuous even-and-odd verdicts (sqrt(x)) and matches how the textbook test is taught.

- **Quadratic family scope**: Required deliverable is verdict + reason + twin check; the restricted-domain inverse and the ± line are an optional bonus path, with a `+-` token expanding to a disjunction if typed steps are wanted.  
  _Why:_ Spec calls it 'the NOT case'; the ± line cannot be expressed in math.js syntax, so either support the token or keep it explanatory.

- **Calculator panel**: Two independent keystroke templates per family (TI-84 Plus CE, TI-Nspire CX II non-CAS), rendered as tabs, each with the instance's expression substituted and a one-line 'why' for ZSquare/Zoom-Square and Real mode.  
  _Why:_ The two calculators diverge on inverse graphing (DrawInv vs Relation x=f1(y)), on cube roots of negatives (Nspire mode-dependent) and on tables (TBLSET vs ctrl+T); a shared template would be wrong on one.

## Reference

## Property tag enum
`distribute | combine_like | add_both | sub_both | mul_both_pos | mul_both_neg_flip | div_both_pos | div_both_neg_flip | commutative | associative | factor | cube_both | square_both | root_both_pm | rewrite_fraction | swap_xy | clear_denominator | reciprocal_multiply | rename_inverse`

## Template table

| Family | Params | Constraints (clean numbers) | Canonical steps (tag) | Check value |
|---|---|---|---|---|
| **Ineq A: distribute+combine+neg-divide** `a(x+b)+cx ⋈ dx+e` | s ∈ ℤ[−8,8] ∪ {±1/3,±2/3,±4/3,±5/3,±1/5,±2/5,±3/5,±4/5,±6/5}; m; a∈±{2,3,4}; b∈±{1,2,3}; c,d∈[−6,6] | den(s) \| m; m∈[−5,−2] for neg-divide knob else [2,5]; a+c−d=m; r=m·s; e=r+ab; \|e\|≤40; d≠0 | distribute → combine_like → sub_both (move dx) → sub_both (move const) → div_both_neg_flip / div_both_pos | answer s; counterexample x=0 (or any x on the wrong side) |
| **Ineq B: fractional coefficient** `±(p/q)y + t ⋈ u` | q∈{2,3,4,5}, p∈{1..5} coprime to q, t,u∈[−9,9] | integer variant: p \| (u−t); fraction variant only when q∈{3,5}; sign knob → flip | sub_both → reciprocal_multiply (× q/p; flip if negative) → (optional) distribute | y = q(u−t)/p |
| **Number line → notation** | 1–3 pieces, endpoints ∈ ℤ[−8,8], ≤1 point | consecutive critical values ≥2 apart, ≥3 across a hole; at most one ray each direction; normalize before compare | (answer only: interval string + set-builder predicate) | critical values + midpoints |
| **Even/odd: polynomial** | 2–3 terms, exponents ⊂ {0..5}, coeffs ±1..5 | verdict by exponent parity set | evidence f(−x) [substitute], −f(x) [distribute −1] → verdict | k∈{1,2} |
| **Even/odd: root** | cbrt(x)·{1,x}+{0,1}; sqrt(a²−x²)·{1,x}, a∈{5,13}; sqrt(x+b) | asym-domain items must be flagged 'neither: domain' | same | cbrt: k∈{±8}; sqrt: k = leg (3 or 4 for a=5) |
| **Even/odd: rational** | num/den each even-, odd- or mixed-parity poly, degree ≤2 | den(±k)≠0; \|f(k)\| denominator ≤5 | same | k∈{1,2,3} |
| **Inverse: cbrt shift** `a·cbrt(x+b)+c` or `cbrt(ax+b)+c` | m∈{−3..3}\{0}, k∈[−4,4], a∈{1,2,3,5,7}, c∈[−6,6] | b := m³ − a·k; \|b\|≤15 | swap_xy → add/sub_both (isolate cbrt) → cube_both → sub_both / div_both → rename_inverse | k; f(k)=m+c; f⁻¹(m+c)=k |
| **Inverse: linear** `ax+b` | a∈±{2..5}, b∈[−9,9] | none | swap_xy → sub_both → div_both → rename_inverse | any k∈[−3,3] with \|f(k)\|≤20 |
| **Inverse: frac-linear** `±(p/q)x+b` | q∈{2,3,4,5}, p coprime, b∈[−6,6] | k ∈ {±q} so f(k)=±p+b integer | swap_xy → sub_both → reciprocal_multiply → (distribute) → rename_inverse | k=q; f(q)=p+b; f⁻¹(p+b)=q |
| **Inverse: quadratic (NOT 1-1)** `a(x−h)²+c` | a∈±{1..4}, h∈[−3,3], c∈[−9,9] | twin pair (k, 2h−k), k=h+2 | swap_xy → sub_both → div_both → root_both_pm (explanatory or `+-` token) → verdict NO + reason | f(k)=f(2h−k)=4a+c |
| **Inverse: rational** `a/(x+b)+c` | a∈±{1,2,3,4,6}, b,c∈[−6,6], not both 0 | k=d−b, d \| a, \|k\|≤8 | swap_xy → sub_both → clear_denominator (×(y+b)) → div_both (÷(x−c)) → sub_both → rename_inverse | f(k)=a/d+c; f⁻¹ = a/(x−c)−b |
| **Inverse: Möbius** `(ax+b)/(cx+d)` | a∈±{1..5}, b,d∈±{1..6}, c=1 (knob c=2, a,d odd) | Δ=ad−bc≠0; gcd=1; brute-force k∈[−8,8]: (ck+d)\|(ak+b), \|f(k)\|≤12, need ≥2 | swap_xy → clear_denominator → distribute → sub_both (collect y-terms) → factor (y(cx−a)) → div_both → rename_inverse | f⁻¹=(dx−b)/(−cx+a); asymptotes (−d/c,a/c)↔(a/c,−d/c) |
| **Properties drill** | item = {before, after, verdict, tag/errorPattern, twinId, params} | instantiate with distinct nonzero ints \|·\|≤9; avoid values making an illegal twin true | one step | engine-validated in Vitest |

## Worked examples (verified by script)

**Ineq A** `−3(x−2)+4x ≤ 6x+3` (a=−3,b=−2,c=4,d=6,e=3; m=−5, r=−3, s=3/5)
1. `−3x+6+4x ≤ 6x+3` distribute  2. `x+6 ≤ 6x+3` combine_like  3. `−5x+6 ≤ 3` sub_both (6x)  4. `−5x ≤ −3` sub_both (6)  5. `x ≥ 3/5` div_both_neg_flip.
Answer `[3/5, inf)`, `{x | x ≥ 3/5}`. Un-flipped `x ≤ 3/5`: at x=0 original FALSE (6 ≤ 3), hers TRUE → pattern 4.
Hints: (1) "Parentheses first — what does −3 multiply?" / after step 2: "Get the x-terms together on one side." / before 5: "What are you dividing by? Does its sign matter?" (2) rule card "multiply/divide by a negative → flip; add/subtract → never flips". (3) show canonical line for her current stage.

**Ineq B** `−(3/5)y + 4 > 10` → `−(3/5)y > 6` sub_both → `y < −10` reciprocal_multiply (× −5/3, flip). Pattern 9 traps: `y > 6 + 5/3`, `−3y > 6·5`? (only one side multiplied).

**cbrt shift** `f(x)=cbrt(x+1)−2` (m=2,k=7): `y=cbrt(x+1)−2` → `x=cbrt(y+1)−2` swap_xy → `x+2=cbrt(y+1)` add_both → `(x+2)³=y+1` cube_both → `y=(x+2)³−1` sub_both → `f⁻¹(x)=(x+2)³−1` rename_inverse. One-to-one: YES. Check f(7)=cbrt(8)−2=0, f⁻¹(0)=8−1=7. Pattern 8 trap: `cbrt(x+1)−2` read as `cbrt(x−1)`.
Hints: "Which operation is applied LAST to x? Undo that first." / "cube both sides undoes a cube root — no ± for odd roots." / show line.

**frac-linear** `f(x)=(3/5)x+2` (k=5): `x=(3/5)y+2` swap_xy → `x−2=(3/5)y` sub_both → `y=(5/3)(x−2)` reciprocal_multiply → `f⁻¹(x)=(5x−10)/3` distribute+rewrite_fraction. f(5)=5, f⁻¹(5)=5 (also k=−5: f=−1, f⁻¹(−1)=−5).

**quadratic** `f(x)=4x²−7` (h=0, twin 2,−2): f(2)=f(−2)=9 → NOT one-to-one (reason: repeated y-value / even power ±). Bonus on x≥0: `x=4y²−7` → `y²=(x+7)/4` → `y=sqrt((x+7)/4)`; f⁻¹(9)=2 but f⁻¹(f(−2))=2≠−2.

**rational** `f(x)=3/(x−2)+1` (k=3): `x=3/(y−2)+1` swap_xy → `x−1=3/(y−2)` sub_both → `(y−2)(x−1)=3` clear_denominator → `y−2=3/(x−1)` div_both → `f⁻¹(x)=3/(x−1)+2`. f(3)=4, f⁻¹(4)=3. Asymptotes f: x=2,y=1; f⁻¹: x=1,y=2.

**Möbius** `f(x)=(2x+1)/(x+3)` (Δ=5, k=2): `x=(2y+1)/(y+3)` swap_xy → `x(y+3)=2y+1` clear_denominator → `xy+3x=2y+1` distribute → `xy−2y=1−3x` sub_both → `y(x−2)=1−3x` factor → `f⁻¹(x)=(1−3x)/(x−2)` div_both. f(2)=5/5=1, f⁻¹(1)=−2/−1=2; f(−2)=−3, f⁻¹(−3)=10/−5=−2. Asymptotes f: x=−3,y=2; f⁻¹: x=2,y=−3.
Hints: "y appears twice — get both y-terms on one side, everything else on the other." / "factor out y" / show.

**Number line** target `(−∞,−2) ∪ [1,4) ∪ {6}` ↔ `{x | x < −2 or 1 ≤ x < 4 or x = 6}`; critical values {−2,1,4,6} → test at those and at −3, −0.5, 2.5, 5, 7.

## Calculator keystrokes per family (both models; substitute EXPR)

| Task | TI-84 Plus CE | TI-Nspire CX II (non-CAS) |
|---|---|---|
| Open graphing | `Y=` | `home` → Graphs (or `doc ▸ Insert ▸ Graphs`); entry line `f1(x)=`; `ctrl+G` hides/shows entry line |
| Cube root | `MATH → 4:³√(` EXPR `)` | templates key (⌸) → `ˣ√` template, index 3, radicand EXPR; or type `root(EXPR,3)`. Set `doc ▸ Settings ▸ Complex Format: Real` or ³√ of negatives errors/graphs half (TI KB 31051) |
| Square root | `2nd x²` | `ctrl + x²` |
| Fraction (3/5)x | `ALPHA → Y= (F1) → 1:n/d` | `ctrl + ÷` fraction template |
| Standard window | `ZOOM 6:ZStandard` | `menu → 4:Window/Zoom → 5:Zoom-Standard` |
| Square window (needed whenever y=x mirror is shown) | `ZOOM 5:ZSquare` | `menu → 4 → B:Zoom-Square` |
| y = x line | `Y2 = X`, cursor left of Y2, `ENTER` cycles line style | `f2(x)=x`; `ctrl+menu` on graph → Attributes to change style |
| Inverse relation | `2nd PRGM (DRAW) → 8:DrawInv`, then `ALPHA TRACE → Y1` (or `VARS → Y-VARS → 1 → Y1`), `ENTER`. Not traceable; `DRAW → 1:ClrDraw` clears; do ZSquare first (window change clears drawings) | `menu → 3:Graph Entry/Edit → 2:Relation`, type `x=f1(y)`, `enter` (KB 38095). Traceable |
| Horizontal-line test | `DRAW → 3:Horizontal`, ▲/▼ to move | `f2(x)=k` and vary k (or insert slider: `menu → Actions → Insert Slider`) |
| ± case (quadratic) | `Y2 = √((X+7)/4)`, `Y3 = -Y2` via `VARS → Y-VARS → 1:Function → Y2` | `f2(x)=√((x+7)/4)`, `f3(x)=−f2(x)`; or Relation `x=f1(y)` shows both branches at once |
| Plug-in check | `2nd WINDOW (TBLSET)` → `Indpnt: Ask`; `2nd GRAPH (TABLE)` type k | `ctrl+T` (Add Function Table) in Graphs, or Calculator page `f1(k)` |
| Inequality (number line) | not graphed on calculator — app SVG only; optional `Y1 = (EXPR_L) ≤ (EXPR_R)` via `2nd MATH (TEST)` shows 1/0 | Relation entry accepts `EXPR_L ≤ EXPR_R` and shades (menu 3 → 2:Relation) |

Sources checked: TI KB 27950 (Nspire Window/Zoom numbering), TI KB 38095 (Nspire inverse via Relation), TI Relations eGuide (x = g(y) supported), TI Nspire shortcuts page (ctrl+÷, ctrl+T), TI KB 31051 (Real vs Rectangular cube roots), TI KB 34754 (TI-84 MATH 4/5), dummies DrawInv page (2nd PRGM 8, non-traceable).
