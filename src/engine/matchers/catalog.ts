/**
 * The coaching library: one entry per ErrorPatternId (title, lesson, wrong → right example).
 * Seeded by the ENGINE agent from research/error-patterns-and-hints.md; the MATCHERS agent owns
 * refinements. Voice: coach, names the property, shows the concrete number.
 */
import type { ErrorPatternId, ErrorPatternInfo, PatternHit } from '@/shared/types'

export const ERROR_PATTERNS: Record<ErrorPatternId, ErrorPatternInfo> = {
  // --- final-answer / notation (notation layer) ---
  backwards_interval: {
    id: 'backwards_interval',
    title: 'Intervals read left to right',
    lesson: 'Intervals read left → right on the number line; −∞ always leads and gets a (.',
    example: '[3, −∞) → (−∞, 3]',
  },
  dropped_union: {
    id: 'dropped_union',
    title: 'Two pieces need a ∪',
    lesson: 'Two separate pieces need ∪ between them — one interval can\'t have a gap.',
    example: '(−∞, −2] (5, ∞) → (−∞, −2] ∪ (5, ∞)',
  },
  bracket_point: {
    id: 'bracket_point',
    title: 'A single number is a set',
    lesson: 'A single number is a set of one element: {3}. Brackets need two endpoints.',
    example: '[3] → {3}',
  },
  set_interval_mismatch: {
    id: 'set_interval_mismatch',
    title: 'Your two answers disagree',
    lesson: 'Your interval and your set describe different numbers — one includes a value the other leaves out.',
    example: '(−∞, 2) vs {x | x ≤ 2}: x = 2 is in one but not the other',
  },
  wrong_side: {
    id: 'wrong_side',
    title: 'Shaded the wrong side',
    lesson: 'x > −2 is to the RIGHT of −2. Read the symbol as an arrow from x.',
    example: 'x > −2 → (−2, ∞), not (−∞, −2)',
  },
  endpoint_type: {
    id: 'endpoint_type',
    title: 'Bracket or parenthesis?',
    lesson: '≤ includes the endpoint → bracket; < excludes it → parenthesis.',
    example: 'x ≤ 2 → (−∞, 2], not (−∞, 2)',
  },
  infinity_bracket: {
    id: 'infinity_bracket',
    title: 'Infinity is never reached',
    lesson: '∞ is not a number you can land on, so it always gets a parenthesis.',
    example: '[3, ∞] → [3, ∞)',
  },
  empty_interval: {
    id: 'empty_interval',
    title: 'That interval is empty',
    lesson: 'An interval whose left end is past its right end contains nothing. Check which way the symbol points.',
    example: '(5, 2) → (2, 5)',
  },
  // --- inequality direction (engine) ---
  no_sign_flip: {
    id: 'no_sign_flip',
    title: 'Dividing by a negative flips the symbol',
    lesson: 'Multiplying or dividing both sides by a NEGATIVE turns the symbol around; adding or subtracting never does.',
    example: '−14 ≤ −14x → x ≥ 1 ✗ → x ≤ 1',
  },
  flip_on_positive: {
    id: 'flip_on_positive',
    title: 'Positive multiplier — the symbol stays',
    lesson: 'You flipped, but you divided by a POSITIVE number. Only a negative multiplier turns the symbol around.',
    example: '3x < 6 → x > 2 ✗ → x < 2',
  },
  flip_on_add: {
    id: 'flip_on_add',
    title: 'Adding never flips',
    lesson: 'Adding or subtracting on both sides never flips the symbol — only a negative multiplier does.',
    example: 'x + 2 < 5 → x > 3 ✗ → x < 3',
  },
  swap_sides_no_reverse: {
    id: 'swap_sides_no_reverse',
    title: 'Swapping sides reverses the symbol',
    lesson: 'Reading an inequality backwards reverses the symbol: 3 < x is the same as x > 3.',
    example: '3 < x → x < 3 ✗ → x > 3',
  },
  nonconstant_multiplier_inequality: {
    id: 'nonconstant_multiplier_inequality',
    title: 'That multiplier changes sign',
    lesson: 'Multiplying an inequality by an expression whose sign depends on x is not a single legal move — for some x it flips, for others it doesn\'t.',
    example: '1/x < 2 → 1 < 2x ✗ (fails at x = −1)',
  },
  // --- algebra steps (engine) ---
  cbrt_sign_dropped: {
    id: 'cbrt_sign_dropped',
    title: 'Cube roots keep the sign',
    lesson: 'A cube root keeps the sign: ∛(−8) = −2, so ∛(−u) = −∛u. You may pull the minus out, never drop it.',
    example: 'cbrt(−x) → cbrt(x) ✗ → −cbrt(x)',
  },
  dropped_pm: {
    id: 'dropped_pm',
    title: 'Even roots give two answers',
    lesson: 'Even roots give two answers: if u² = 9 then u = ±3. Write both, or say why one is excluded.',
    example: 'x² = 9 → x = 3 ✗ → x = ±3',
  },
  minus_teleport: {
    id: 'minus_teleport',
    title: 'The minus jumped out of the denominator',
    lesson: 'A minus in front of a fraction negates the WHOLE denominator: 1/(−x+2) = −1/(x−2).',
    example: '1/(−x+2) → −1/(x+2) ✗ → −1/(x−2)',
  },
  partial_distribute: {
    id: 'partial_distribute',
    title: 'Distribution missed a term',
    lesson: 'Distribute to EVERY term inside the parentheses: x(y+2) = xy + 2x.',
    example: 'x(y+2) → xy + 2 ✗ → xy + 2x',
  },
  negative_not_distributed: {
    id: 'negative_not_distributed',
    title: 'The minus is part of the multiplier',
    lesson: 'The minus sign is part of the multiplier, so it reaches every term: −2(x−3) = −2x + 6.',
    example: '−2(x−3) → −2x − 6 ✗ → −2x + 6',
  },
  const_into_radical: {
    id: 'const_into_radical',
    title: 'The constant is outside the root',
    lesson: 'cbrt(u) − 1 is not cbrt(u − 1). Undo the −1 first (add 1 to both sides), then deal with the root. Same trap on the calculator: close ³√( ) before the −1.',
    example: 'cbrt(7x+3) − 1 → cbrt(7x+2) ✗',
  },
  op_on_one_term: {
    id: 'op_on_one_term',
    title: 'The operation applies to the whole side',
    lesson: 'Cubing (or any both-sides move) applies to the whole side, not one term. Isolate the radical first, then cube everything.',
    example: 'y = cbrt(7x+3) − 1 → y³ = 7x+3 − 1 ✗',
  },
  reciprocal_coeff: {
    id: 'reciprocal_coeff',
    title: 'Undo a coefficient with its reciprocal',
    lesson: 'A coefficient is multiplication, so it\'s undone by multiplying by the reciprocal — on EVERY term of the other side.',
    example: '(3/5)y = x − 2 → y = (5/3)x − 2 ✗ → y = (5/3)(x − 2)',
  },
  term_across_sign: {
    id: 'term_across_sign',
    title: 'Moving a term changes its sign',
    lesson: 'Moving a term across the = or inequality sign means subtracting it from both sides, so its sign changes.',
    example: 'x + 3 = 7 → x = 7 + 3 ✗ → x = 7 − 3',
  },
  power_over_sum: {
    id: 'power_over_sum',
    title: 'Powers don\'t distribute over +',
    lesson: 'Powers and roots distribute over multiplication, never over addition: (xy)² = x²y² but (x+y)² ≠ x²+y².',
    example: '(x+1)³ → x³ + 1 ✗',
  },
  split_denominator: {
    id: 'split_denominator',
    title: 'You can\'t split a denominator',
    lesson: 'You can split a numerator sum, not a denominator sum: (a+b)/c = a/c + b/c, but c/(a+b) stays.',
    example: '3/(x+2) → 3/x + 3/2 ✗',
  },
  cancel_term: {
    id: 'cancel_term',
    title: 'Only factors cancel',
    lesson: 'Only common FACTORS cancel; every term of the numerator gets divided.',
    example: '(2x+4)/2 → x + 4 ✗ → x + 2',
  },
  add_denominators: {
    id: 'add_denominators',
    title: 'Fractions need a common denominator',
    lesson: 'Fractions need a common denominator; 1/2 + 1/2 is not 2/4.',
    example: '1/x + 1/2 → 2/(x+2) ✗',
  },
  sqrt_square_abs: {
    id: 'sqrt_square_abs',
    title: '√(u²) is |u|',
    lesson: '√(u²) is |u|; it is never negative.',
    example: 'sqrt((x−1)²) → x − 1 ✗ → |x − 1|',
  },
  divide_by_variable: {
    id: 'divide_by_variable',
    title: 'Dividing by a variable can lose a solution',
    lesson: 'You divided by an expression that can be 0 — the solution where it IS 0 vanished. Factor instead: x(x − 3) = 0.',
    example: 'x² = 3x → x = 3 ✗ (lost x = 0)',
  },
  squaring_caveat: {
    id: 'squaring_caveat',
    title: 'Legal, but check for extra answers',
    lesson: 'Squaring (or multiplying by an expression with the variable) can create extra answers — check each answer in the original at the end.',
    example: '√x = −3 → x = 9 ⚠ (9 fails the original)',
  },
  combine_unlike: {
    id: 'combine_unlike',
    title: 'Only like terms combine',
    lesson: 'Only like terms combine: 2x + 3 stays 2x + 3.',
    example: '2x + 3 → 5x ✗',
  },
  neg_power_sign: {
    id: 'neg_power_sign',
    title: '(−x)ⁿ and −xⁿ differ',
    lesson: '(−x)² = x², but −x² is the negative of x²; odd powers keep the minus.',
    example: '(−x)² → −x² ✗',
  },
  substitution_error: {
    id: 'substitution_error',
    title: 'Replace EVERY x with (−x)',
    lesson: 'Replace EVERY x with (−x), keep the parentheses, then simplify each power.',
    example: 'x³ + x → −x³ + x ✗ → −x³ − x',
  },
  reciprocal_as_inverse: {
    id: 'reciprocal_as_inverse',
    title: 'f⁻¹ is not 1/f',
    lesson: 'f⁻¹ undoes f; it is not 1/f. Check: f(f⁻¹(k)) should return k.',
    example: 'f(x) = 2x+1 → f⁻¹(x) = 1/(2x+1) ✗',
  },
  swap_misname: {
    id: 'swap_misname',
    title: 'Swap BOTH letters',
    lesson: 'To find an inverse, every x becomes y AND every y becomes x. Renaming only one letter gives a different equation.',
    example: 'y = (x+1)³ → x = (x+1)³ ✗ → x = (y+1)³',
  },
  // --- significant figures (engine/sigfigs; chemistry) ---
  sf_leading_zeros: {
    id: 'sf_leading_zeros',
    title: 'Leading zeros never count',
    lesson: 'Zeros in front of the first nonzero digit only place the decimal point. Start counting at the first nonzero digit.',
    example: '0.00450 → 6 figures ✗ → 3 figures (4, 5, 0)',
  },
  sf_trailing_zeros_decimal: {
    id: 'sf_trailing_zeros_decimal',
    title: 'Zeros after a decimal point were measured',
    lesson: 'When a decimal point is written, the zeros at the end are significant: someone measured them. Otherwise nobody would write them.',
    example: '100.0 → 1 figure ✗ → 4 figures',
  },
  sf_placeholder_zeros: {
    id: 'sf_placeholder_zeros',
    title: 'No decimal point, so those zeros are placeholders',
    lesson: 'In a whole number written without a decimal point, the zeros at the end only hold the place. A written point (1200.) is what makes them count.',
    example: '1200 → 4 figures ✗ → 2 figures; 1200. → 4 figures',
  },
  sf_captive_zero: {
    id: 'sf_captive_zero',
    title: 'Zeros in the middle count',
    lesson: 'A zero sandwiched between significant digits is significant too. It was read off the instrument like its neighbors.',
    example: '5002 → 2 figures ✗ → 4 figures',
  },
  sf_addsub_rule_on_muldiv: {
    id: 'sf_addsub_rule_on_muldiv',
    title: '× and ÷ go by significant figures',
    lesson: 'Lining up decimal places is the rule for + and −. For × and ÷, count significant figures and keep the FEWEST.',
    example: '2.0 × 11.31 = 22.62 → 22.6 ✗ → 23 (two figures, like 2.0)',
  },
  sf_muldiv_rule_on_addsub: {
    id: 'sf_muldiv_rule_on_addsub',
    title: '+ and − go by decimal places',
    lesson: 'Counting significant figures is the rule for × and ÷. For + and −, line up the places and round to the LEAST precise one.',
    example: '104.52 + 3.1 = 107.62 → 110 ✗ → 107.6 (tenths, like 3.1)',
  },
  sf_most_precise: {
    id: 'sf_most_precise',
    title: 'The weakest measurement sets the limit',
    lesson: 'An answer can only be as good as its least precise measurement, so match the FEWEST figures (or the least precise place), not the most.',
    example: '2.4 × 3.421 = 8.2104 → 8.210 ✗ → 8.2',
  },
  sf_unrounded: {
    id: 'sf_unrounded',
    title: 'The calculator shows more than you measured',
    lesson: 'A calculator prints every digit it can; most of them are noise. Round to what the measurements support.',
    example: '12.50 ÷ 4.1 → 3.04878 ✗ → 3.0',
  },
  sf_truncated: {
    id: 'sf_truncated',
    title: 'Round, don’t chop',
    lesson: 'Look at the first digit you drop: 5 or more and the last kept digit goes up by one; less than 5 and it stays.',
    example: '0.004567 to 2 figures → 0.0045 ✗ → 0.0046',
  },
  sf_places_not_figures: {
    id: 'sf_places_not_figures',
    title: 'Significant figures aren’t decimal places',
    lesson: 'Decimal places count from the point. Significant figures count from the first nonzero digit, wherever the point is.',
    example: '0.004567 to 2 figures → 0.00 ✗ → 0.0046',
  },
  sf_dropped_zero: {
    id: 'sf_dropped_zero',
    title: 'Keep the zero that shows your precision',
    lesson: 'A trailing zero after the decimal point is significant. Dropping it says the answer is less precise than it really is.',
    example: '12.50 ÷ 4.1 → 3 ✗ → 3.0 (two figures)',
  },
  sf_extra_zeros: {
    id: 'sf_extra_zeros',
    title: 'Extra zeros claim extra precision',
    lesson: 'Every zero written after the decimal point says "I measured this". Stop where the limiting measurement stops.',
    example: '12.11 + 18.0 + 1.013 → 31.10 ✗ → 31.1 (tenths, like 18.0)',
  },
  sf_ambiguous_zeros: {
    id: 'sf_ambiguous_zeros',
    title: 'Those zeros read as placeholders',
    lesson: 'A whole number with no decimal point hides whether its zeros were measured. Scientific notation shows exactly the figures you mean.',
    example: '1999 to 2 figures → 2000 ✗ (reads as 1 figure) → 2.0 × 10³',
  },
  sf_lost_placeholders: {
    id: 'sf_lost_placeholders',
    title: 'Rounding never changes the size',
    lesson: 'After rounding a big number, fill the dropped places with placeholder zeros so it stays the same size.',
    example: '12345 to 2 figures → 12 ✗ → 12000',
  },
  sf_exact_limited: {
    id: 'sf_exact_limited',
    title: 'Exact numbers never limit',
    lesson: 'Counted things and defined conversions are exact: unlimited significant figures. Only measurements limit the answer.',
    example: '3 beakers × 2.45 g → 7 g ✗ → 7.35 g (the 3 is counted)',
  },
  sf_rounded_early: {
    id: 'sf_rounded_early',
    title: 'Round once, at the end',
    lesson: 'Carry every digit through the middle steps, note how precise each one is, and round only the final answer. Early rounding piles up error.',
    example: '(11.07 + 1.1) × 2.115: 12.2 × 2.115 → 25.8 ✗; 12.17 × 2.115 → 25.7',
  },
  sf_sci_changed_figures: {
    id: 'sf_sci_changed_figures',
    title: 'Converting keeps every figure',
    lesson: 'Changing notation moves the decimal point and nothing else. The number of significant figures stays exactly the same.',
    example: '0.00450 → 4.5 × 10⁻³ ✗ → 4.50 × 10⁻³',
  },
  sf_sci_exponent: {
    id: 'sf_sci_exponent',
    title: 'Count the jumps of the decimal point',
    lesson: 'The power of ten is how many places the point moved: positive for big numbers, negative for small ones.',
    example: '0.00450 → 4.50 × 10³ ✗ → 4.50 × 10⁻³',
  },
  sf_sci_form: {
    id: 'sf_sci_form',
    title: 'One nonzero digit in front',
    lesson: 'Scientific notation has exactly one nonzero digit before the decimal point, so the coefficient is at least 1 and less than 10.',
    example: '45.0 × 10⁻⁴ ✗ → 4.50 × 10⁻³',
  },
  // --- behavioral (ui) ---
  abandoned: {
    id: 'abandoned',
    title: 'Still here?',
    lesson: 'A problem left half-done is a problem half-learned — the hint button is right there.',
    example: '',
  },
}

/** Builds a PatternHit from the catalog, optionally with a concrete witness for this instance. */
export function patternHit(id: ErrorPatternId, witness?: string): PatternHit {
  const info = ERROR_PATTERNS[id]
  return witness ? { ...info, witness } : { ...info }
}
