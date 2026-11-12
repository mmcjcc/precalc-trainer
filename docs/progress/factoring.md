# Factoring polynomials (precalculus Unit 2) — module `factoring`, prefix `fa_`

Branch `precalc-factoring`, working copy `C:\work\fact2`. Nothing committed. Module `factoring` ("Factoring
polynomials"), kind `factoring`, screen `src/pages/flows/FactoringFlow.tsx` (a mirror of `PolyZerosFlow`), one new
engine file `src/engine/polynomials/factor.ts`.

## Why

Her worksheet this week is "Factor Sum or Difference of Cubes", with x³ ± a³ = (x ± a)(x² ∓ ax + a²) and "same,
opposite, always plus" written at the top. The cubes template is the heart of the build; the other five make the
module a complete factoring review for Unit 2, listed first in Unit 2 (order 5.58, just before completing the square).

## What she gets

| template | asks | parts |
|---|---|---|
| `fa.gcf` | the greatest common monomial factor out: a number (30 %), a power of x (25 %) or both (45 %); what is left never factors further | product |
| `fa.squares` | a difference of two squares (45 %), a perfect-square trinomial with either sign (35 %), or a sum of two squares (20 %), whose answer is the choice "does not factor over the integers" | product (with the choice) |
| `fa.cubes` | x³ ± k³ (k = 1..6) and (mx)³ ± k³ (m = 2, 3, k prime to m); a common factor first in 25 % (2, 3, 4, 5, x or 2x: 2x³ + 54, 3x³ − 81, x⁴ − 8x) | what is cubed (two boxes inside "g( ▢³ ± ▢³ )"), then the product |
| `fa.trinomial` | x² + bx + c (45 %) and ax² + bx + c with a = 2..6; each of the four sign patterns of b and c a quarter of the time | product |
| `fa.grouping` | (x + t)(x² + u) multiplied out: u = −k² (35 %, finished with a difference of squares), u > 0 (35 %), u negative and not a square (30 %) | the two pairs (two boxes), then the product |
| `fa.complete` | method not named: a common factor then a difference of squares (3x³ − 12x), then cubes (2x³ − 16), then a trinomial; a difference of squares twice (x⁴ − 16, 16x⁴ − 1); a quadratic in x² (x⁴ − 5x² + 4) | product |

Every part has its own three-rung hint ladder (nudge, rule card, worked lines; the last marks the answer as shown);
a later part is not on the page until the one before is right; her boxes are `AttemptFinal.polyEntries` and the part
she reached `polyStage`, so a reload restores both. The product box is the math input with the live preview.

**Grading a typed product** (`checkFactored`): it must read; be a polynomial; multiply out to the given polynomial
exactly (else: the slip it multiplies out to, by name, or a plain "multiply it back" message); be a product, not
the polynomial typed back (not an attempt); have whole-number coefficients (not an attempt); and be factored
completely: every factor of hers, normalized to a primitive integer polynomial, must be one of the engine's
irreducible factors (multiset up to order and sign). A right product with a factor that still has a common factor or
still splits is "stopped early", and the witness names her factor that still factors without saying how.

## Named mistakes

14 new ids, all appended to the END of the Coefficient Cruncher's variants (species `crunch`, "polynomial procedure
slips ... zeros and factors"): SPECIES is already at the species test's maximum of 36, so a new species would fail
it; the rules allow the natural home instead. No existing id was identical to any of these slips, so none is reused.

| id | where | what she did (example on THIS problem's numbers) |
|---|---|---|
| `fa_gcf_not_greatest` | gcf, grouping pairs | a right product whose inside still has a common factor: 3(2x² + 3x) for 6x² + 9x |
| `fa_gcf_dropped_one` | gcf | the term equal to the common factor dropped instead of leaving 1: 3(3x² + 6x) for 9x² + 18x + 3 |
| `fa_sum_of_squares` | squares, complete | a sum of squares factored as (a + b)(a − b) or (a ± b)²; in x⁴ − 16, x² + 4 split |
| `fa_diff_as_square` | squares, grouping, complete | a difference of squares written as (a − b)² (or (a + b)²) |
| `fa_square_sign` | squares | a perfect square with the wrong sign inside: (x − 5)² for x² + 10x + 25 |
| `fa_cube_middle_sign` | cubes, complete | the middle term with the SAME sign as the binomial |
| `fa_cube_middle_doubled` | cubes, complete | the middle term doubled (2ab) |
| `fa_cube_last_negative` | cubes, complete | the last term negative |
| `fa_cube_binomial_cubed` | cubes, complete | (a ± b)³ |
| `fa_cube_root_coefficient` | cubes (both parts) | 8x³ read as (8x)³: 8x in the first box, 27 for 3 in the second, (8x + 3)(64x² − 24x + 9) |
| `fa_tri_signs_swapped` | trinomial, complete | the right two numbers with their signs swapped |
| `fa_tri_wrong_pair` | trinomial | two linear factors with the right first and last terms and a middle term that is neither b nor −b (structural, any pair) |
| `fa_group_sign` | grouping pairs | −9(x + 2) for −9x + 18 |
| `fa_stopped_early` | every template except gcf | a right product with a factor that still factors |

Every slip is detected from her answer multiplied out (or its factors) for the problem's own numbers: each problem
stores its slips (`answer.slips`, the entries she would type), and `faSelfTest`, run on every generated seed, checks
that each one grades as exactly its id, that none is the right answer, and that no two are the same answer. The
promised trap (`answer.trap`, `trapStage`) is one of them, picked by the seed; its rule card leads that part's hints.

## Decisions and exclusions

- **Engine.** `factor.ts` reuses `readFormula`, `polyOf`, `polyMul`, `polyEquals`, `rationalRoots`, `polyToText`;
  it splits the parse tree at its top-level products and normalizes each factor. Linear factors come from the
  rational roots; what is left must have degree ≤ 3 (then irreducible). A leftover of degree 4 or more returns null:
  no template draws one (x⁴ + 4 is not drawn). Exported from `src/engine/polynomials/index.ts` (lines added at the end).
- **Two boxes, one part.** "What is cubed" and "the pairs" are two boxes graded in one check (like the vertex
  part of completing the square); the distribution rule counts the pair of entries as the part's answer.
- **The cube roots part has only 13 possible answers** (the brief's m and k), drawn equally likely (expected 7.7 %
  each). With the first seed stream tried, one pair came to 31 of 300 seeds; the template's salt was moved to 833,
  where the largest is 27 of 300. A reviewer should know the 10 % bound holds for seeds 1..300, not with a margin.
- **The "does not factor" choice is part of the product part**, not a separate choice part.
- **What is cubed** is asked inside the common factor: the screen shows "2( ▢³ + ▢³ )" (the common factor is
  visible in part 1). A sign typed in a box is not an attempt ("the sign is already written").
- **Pairs must show the same binomial.** An equal pair with the other binomial (9(−x + 2) for −9x + 18) is not an
  attempt, with a message to take out the factor with the other sign; a pair whose inside still has a common factor
  is `fa_gcf_not_greatest`.
- **The cube-pattern trinomial** is never asked to factor further; the rule card says so, and the worked lines end
  with "does not factor further over the integers".
- **Statements** for the 40-in-60 rule are the prompt's wording plus the polynomial: the brief fixes fa.cubes to
  26 polynomials without a common factor, too few for 40 distinct in 60 seeds by the polynomial alone (each
  template has 3 or 4 wordings; the other five templates pass on the polynomial alone too).
- **Reserved for the examples** (`FA_RESERVED`, tested): 7 as a common factor or leading coefficient, 10 as a cube
  root, 11 and 12 as any drawn number, n = 10 in m⁴x⁴ − n⁴ (x⁴ − 10000; no square draws n = 10 either). The review test also checks no generated
  polynomial equals an example's polynomial over 1000 seeds per template.
- **Leak checks** compare compact text (spaces and the minus sign removed). For "what is cubed" the checked answers
  are the cube forms "(2x)^3" and "3^3": a lone "x" or "1" is in every card and cannot be a leak test.
- **Recording** is the flow's own `recordFaGrades` (same rules as `recordPolyGrades`; `record.ts` is not a file
  this builder may touch). Feedback cards are the flow's own, built on `SigFigRejection`, so the monster shows.
- Not drawn: a negative leading coefficient, a common factor in fa.trinomial (that is fa.complete), non-monic grouping.

## Deviations

- **Distribution of the squares part.** The brief asks for a sum of two squares in 15–25 % of fa.squares seeds;
  its answer is the same choice every time, so that one answer is 15–25 % of the part (over the common rules' 10 %),
  and the choice "factors" is right in 75–85 % (over the 60 % rule). Required by the brief; the typed answers of the
  other seeds stay under 10 %.
- **Species.** New ids went to the end of an existing species (crunch), not a new species: see Named mistakes.

## Verification

All runs in `C:\work\fact2` (2026-11-11/12). The last source edit was the reserved example (x⁴ − 10000) and the
fa.cubes seed stream; after it every run below was made. The one later edit was to an assertion in
`FactoringFlow.test.tsx`, and that file was run again after it.

- `npm run typecheck` (all three configs): exit 0, no errors (after the last edit).
- `vitest run src/content/modules/factoring src/engine/polynomials/factor.test.ts src/content/courses.test.ts
  src/content/modules/generators.test.ts src/components/monsters/species.test.ts
  src/components/monsters/coverage.test.ts src/components/monsters/art.test.ts src/problem/tutorContext.test.ts`:
  11 files, 166 tests, all passed (module tests: factoring 25, crosscheck 8, review 7, hand 33; engine factor 26).
- `vitest run src/problem/workedExample.test.ts`: 190 tests passed (the six fa.* templates included).
- `vitest run src/pages/flows/FactoringFlow.test.tsx src/pages/Home.test.tsx src/components/juice/Chunky.test.tsx
  --pool=threads` after the last edit: FactoringFlow 5/5 and Chunky 7/7 passed; one Home test timed out at 20 s with
  the three files running together under load. `vitest run src/pages/Home.test.tsx --pool=threads` alone: 12/12 passed.
  (The default forks pool could not start a jsdom worker within its 60 s on the loaded machine twice; `--pool=threads`
  is the only change.)
- `vite build --outDir C:\work\fact2\.tmp-dist`: built (the usual chunk-size warning); the folder was deleted.
- Not run: the whole suite (left to the reviewer, as the rules ask).

## Files

New: `src/engine/polynomials/factor.ts`, `factor.test.ts`; `src/content/modules/factoring/` (`build.ts`, `grade.ts`,
`rules.ts`, `index.ts`, `factoring.test.ts`, `factoring.crosscheck.test.ts`, `factoring.review.test.ts`,
`factoring.hand.test.ts`); `src/pages/flows/FactoringFlow.tsx`, `FactoringFlow.test.tsx`; this file.

Changed (lines added in the polynomial / precalc region only): `src/shared/types.ts` (ModuleId `factoring` after
`polyZeros`; 14 `fa_` ids after `poly_rrt_wrong_coefficients`), `src/content/types.ts` (ProblemKind `factoring`,
`FactoringQuestion`, `FactoringStageId`, `FactoringShape`, the `factoring` AnswerSpec arm after `polyZeros`),
`src/engine/matchers/catalog.ts` (14 entries after the poly_ block), `src/engine/polynomials/index.ts` (export lines at
the end), `src/components/monsters/species.ts` (14 ids at the end of `crunch`), `src/content/modules/index.ts`
(`import './factoring'` after diffQuotient), `src/content/courses.ts` (`factoring` first in unit2), `src/pages/Problem.tsx`
(one import, one case), `src/problem/tutorContext.ts` (`verdictFromFactoring`, work/statement/canonical/answer
branches), `src/problem/workedExample.ts` (six ids and a `factoring` case), and the count tests
`src/content/courses.test.ts`, `src/content/modules/generators.test.ts` (69 modules), `src/pages/Home.test.tsx`,
`src/problem/tutorContext.test.ts`.
