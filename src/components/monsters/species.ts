/**
 * Mistake Monsters (docs/progress/phone-monsters.md): every named mistake in the catalog is a variant of exactly one
 * species. The species are families of mistakes (sign slips, bracket slips, log slips...); the table below places
 * every catalog id by hand, and a test fails on an id that has no place, so a new mistake must be placed here.
 * A variant's tagline is its catalog title (engine/matchers/catalog.ts); a species has a name and a one-line
 * personality. Pure data (no React): the art (art.ts) draws a species from its `look` and varies it per id.
 */

/** Which classes a species comes from: the store app (math only) shows the math species. */
export type MonsterSubject = 'math' | 'chemistry'

export type BodyShape =
  | 'blob'
  | 'bean'
  | 'box'
  | 'chopped'
  | 'pear'
  | 'ghost'
  | 'tri'
  | 'spiky'
  | 'hex'
  | 'cloud'
  | 'round'
  | 'log'
  | 'drop'
  | 'lean'

export type TopPart =
  | 'none'
  | 'horns'
  | 'ears'
  | 'antennae'
  | 'mohawk'
  | 'radical'
  | 'sprout'
  | 'horn'
  | 'spikes'
  | 'tuft'
  | 'hardhat'
  | 'bulb'
  | 'beam'
  | 'roundEars'
  | 'curls'

export type EyeStyle = 'round' | 'half' | 'angry' | 'squint' | 'side' | 'wide' | 'sleepy' | 'hollow' | 'mismatch' | 'spiral'

export type MouthStyle = 'smirk' | 'grin' | 'fangs' | 'zigzag' | 'o' | 'tongue' | 'flat' | 'teeth' | 'buck'

export type FeetStyle = 'stubs' | 'none' | 'tentacles' | 'skate' | 'claws'

export type ArmStyle = 'none' | 'stubs' | 'up' | 'brackets' | 'crossed'

/** The species' own sign: what makes it that species at a glance, whatever the variant wears. */
export type SignatureMark =
  | 'none'
  | 'split'
  | 'cut'
  | 'fraction'
  | 'superscript'
  | 'rings'
  | 'mask'
  | 'coin'
  | 'fence'
  | 'monocle'
  | 'speed'
  | 'stitches'
  | 'bolts'
  | 'hole'
  | 'dashed'
  | 'ruler'
  | 'arc'
  | 'arrow'
  | 'therefore'
  | 'disguise'
  | 'swirl'
  | 'zero'
  | 'case'
  | 'orbiters'
  | 'orbit'
  | 'grid'
  | 'charges'
  | 'nametag'
  | 'scales'

/** How a species looks: the art keeps all of it for every variant, and varies only the extras (art.ts). */
export interface SpeciesLook {
  body: BodyShape
  /** Body colour (HSL). */
  hue: number
  sat: number
  light: number
  /** Accent hue: horns, hats, the signature's colour. */
  accent: number
  top: TopPart
  eyes: EyeStyle
  mouth: MouthStyle
  feet: FeetStyle
  arms: ArmStyle
  mark: SignatureMark
  /** Drawn standing on its head (the Upside-Downer). */
  flip?: boolean
  /** The face a little higher, to leave its belly sign room. */
  face?: 'high'
}

export interface Species {
  id: string
  name: string
  /** One line of character. */
  personality: string
  /** What its mistakes have in common (for the card and for whoever places a new mistake). */
  family: string
  subject: MonsterSubject
  look: SpeciesLook
  /**
   * Catalog ids, in the order the collection shows the ones not seen yet. A variant's look depends on the ones before
   * it (art.ts speciesTraits redraws a clash with an earlier sibling), so a NEW MISTAKE GOES AT THE END: inserted
   * earlier, it would change the looks of monsters children have already caught.
   */
  variants: readonly string[]
}

/**
 * Catalog entries that are not mistakes, so never monsters: a behaviour, and the two notes on a legal line
 * ("Legal, but check..."), which the checker never records as a mistake (store/rewards.ts makes cards only from
 * rejections and wrong checks that name a pattern).
 */
export const NOT_MONSTERS: Readonly<Record<string, string>> = {
  abandoned: 'a behaviour (a problem left half-done), never named as a mistake',
  squaring_caveat: 'a note on a legal line (squaring can add answers), never a mistake',
  log_check_answers: 'a note on a legal line (a log step can let in answers), never a mistake',
}

/**
 * Rare variants wear a sparkle frame: a mistake only one problem type or two can produce, and only on their special
 * cases (a cube root of a negative, chromium and copper, helium, Hg₂²⁺...). Marked by hand: the app has no list of
 * which mistakes each template can produce, and most module-specific mistakes come from one or two types, so the
 * rule read literally would make most of the collection rare (docs/progress/phone-monsters.md).
 */
export const RARE: ReadonlySet<string> = new Set([
  'cbrt_sign_dropped',
  'sc_even_sign_flip',
  'bracket_point',
  'substitution_error',
  'const_into_radical',
  'sqrt_square_abs',
  'fn_domain_odd_root_restricted',
  'exp_halflife_inverted',
  'trig_sector_r_not_squared',
  'log_power_abs',
  'exp_base_direction',
  'exp_continuous_swapped',
  'exp_inverse_shift',
  'fn_composite_domain_simplified',
  'gf_global_on_ray',
  'tr_unfactored_shift',
  'pw_write_overlap',
  'geo_vertical_as_zero',
  'log_valid_rejected',
  'poly_sd_missing_placeholder',
  'rf_slant_remainder',
  'cx_sqrt_product',
  'geo_endpoint_averaged',
  'geo_kite_angles_wrong_pair',
  'geo_syllogism_order',
  'geo_hl_no_right',
  'geo_square_not_rectangle',
  'trig_reference_is_coterminal',
  'sf_exact_limited',
  'lt_energy_no_c',
  'at_assumed_even_split',
  'ec_exception_missed',
  'ec_ion_removed_from_3d',
  'pt_helium_octet',
  'pt_hydrogen_metal',
  'nm_unit_ion_reduced',
  'nm_acid_root',
])

export const SPECIES: readonly Species[] = [
  // ------------------------------------------------------------------ math (precalculus and geometry)
  {
    id: 'sign',
    name: 'The Sign Flipper',
    personality: 'Flips a sign the second you look away: a minus lost here, an inequality turned around there.',
    family: 'Sign slips: a + or − lost, flipped or moved, and inequality symbols turned the wrong way.',
    subject: 'math',
    look: { body: 'blob', hue: 352, sat: 68, light: 60, accent: 214, top: 'horns', eyes: 'angry', mouth: 'smirk', feet: 'stubs', arms: 'stubs', mark: 'split' },
    variants: [
      'no_sign_flip',
      'flip_on_positive',
      'flip_on_add',
      'swap_sides_no_reverse',
      'nonconstant_multiplier_inequality',
      'wrong_side',
      'term_across_sign',
      'negative_not_distributed',
      'minus_teleport',
      'cbrt_sign_dropped',
      'neg_power_sign',
      'fn_domain_no_flip',
      'op_sign_flipped',
      'op_minus_not_distributed',
      'rate_sign_flipped',
      'pw_k_sign',
      'poly_cs_h_sign',
      'poly_sd_wrong_sign_c',
      'poly_zero_sign_reversed',
      'sc_multiplied_by_denominator',
      'sc_even_sign_flip',
      'sc_signs_reversed',
      'sc_wrong_intervals',
      'log_value_sign',
      'trig_sign_quadrant',
      'trig_coordinate_sign',
      'trig_r_negative',
      'trig_solve_wrong_sign_quadrant',
      'trig_amplitude_negative',
      'trig_inverse_sign_dropped',
    ],
  },
  {
    id: 'bracket',
    name: 'Bracket Gremlin',
    personality: 'Swaps your brackets for parentheses and calls it notation.',
    family: 'Bracket and interval slips: brackets or parentheses, ∪, endpoints, ∞, intervals read backwards.',
    subject: 'math',
    look: { body: 'pear', hue: 138, sat: 52, light: 50, accent: 48, top: 'ears', eyes: 'wide', mouth: 'fangs', feet: 'claws', arms: 'brackets', mark: 'none' },
    variants: [
      'endpoint_type',
      'infinity_bracket',
      'backwards_interval',
      'dropped_union',
      'bracket_point',
      'empty_interval',
      'set_interval_mismatch',
      'gf_union_between_points',
      'gf_brackets_at_turns',
      'sc_endpoints_wrong',
      'sc_denominator_included',
      'exp_endpoint_closed',
    ],
  },
  {
    id: 'shortcut',
    name: 'The Corner Cutter',
    personality: 'Takes shortcuts that don’t exist, like distributing to half the terms.',
    family: 'Shortcut slips: a move done to some terms and not all, or a sum split where nothing splits.',
    subject: 'math',
    look: { body: 'chopped', hue: 28, sat: 82, light: 58, accent: 200, top: 'antennae', eyes: 'half', mouth: 'grin', feet: 'stubs', arms: 'stubs', mark: 'cut' },
    variants: [
      'partial_distribute',
      'op_on_one_term',
      'reciprocal_coeff',
      'combine_unlike',
      'power_over_sum',
      'substitution_error',
      'dq_fx_plus_fh',
      'dq_partial_sub',
      'dq_partial_cancel',
      'fn_compose_partial_sub',
      'op_inner_not_squared',
      'sc_critical_missing',
      'opt_term_dropped',
      'opt_binomial_square',
      'geo_proportion_distribute',
    ],
  },
  {
    id: 'balance',
    name: 'The Scale Tipper',
    personality: 'Does something to one side of the equation and wanders off.',
    family: 'Equation-move slips: a both-sides move done to one side, out of order, or undone with the wrong operation.',
    subject: 'math',
    look: { body: 'lean', hue: 262, sat: 48, light: 62, accent: 44, top: 'beam', eyes: 'round', mouth: 'o', feet: 'stubs', arms: 'up', mark: 'scales' },
    variants: [
      'const_into_radical',
      'sc_not_one_side',
      'poly_cs_unbalanced',
      'log_one_side',
      'log_convert_multiplied',
      'exp_growth_no_log',
      'exp_growth_log_diff',
      'opt_solve_divide',
      'trig_special_wrong_way',
    ],
  },
  {
    id: 'radical',
    name: 'The Radical',
    personality: 'Totally radical. Totally wrong about roots and fractions.',
    family: 'Radical and rational slips: square roots and their ±, roots with a domain, fractions split or cancelled.',
    subject: 'math',
    look: { body: 'bean', hue: 318, sat: 58, light: 60, accent: 178, top: 'radical', eyes: 'half', mouth: 'tongue', feet: 'stubs', arms: 'none', mark: 'none' },
    variants: [
      'sqrt_square_abs',
      'split_denominator',
      'cancel_term',
      'add_denominators',
      'fn_domain_root_strict',
      'fn_domain_root_denominator_zero',
      'fn_domain_odd_root_restricted',
      'geo_distance_no_root',
      'trig_r_not_rooted',
      'trig_side_not_rooted',
      'trig_special_45_two',
      'geo_mean_not_rooted',
    ],
  },
  {
    id: 'upside',
    name: 'The Upside-Downer',
    personality: 'Reads every fraction standing on its head.',
    family: 'Upside-down slips: a fraction, a ratio, a rate or a scale factor written with its top and bottom swapped, one ratio of a proportion turned over, or a parabola turned over.',
    subject: 'math',
    look: { body: 'drop', hue: 192, sat: 62, light: 52, accent: 330, top: 'horns', eyes: 'round', mouth: 'grin', feet: 'stubs', arms: 'stubs', mark: 'fraction', face: 'high', flip: true },
    variants: [
      'op_quotient_flipped',
      'rate_inverted',
      'geo_slope_inverted',
      'poly_rrt_inverted',
      'trig_conversion_inverted',
      'trig_tan_inverted',
      'exp_halflife_inverted',
      'opt_opens_wrong_way',
      'trig_hypotenuse_as_leg',
      'geo_scale_factor_inverted',
      'geo_shadows_crossed',
      'geo_one_ratio_inverted',
      'trig_period_times_b',
    ],
  },
  {
    id: 'power',
    name: 'The Power Grabber',
    personality: 'Grabs exponents and drops them wherever it likes.',
    family: 'Exponent slips: power rules, negative exponents, a square or an exponent forgotten.',
    subject: 'math',
    look: { body: 'round', hue: 14, sat: 74, light: 58, accent: 52, top: 'bulb', eyes: 'wide', mouth: 'teeth', feet: 'stubs', arms: 'up', mark: 'superscript' },
    variants: [
      'log_exp_sum_split',
      'log_exp_power_added',
      'log_exp_negative_exponent',
      'exp_exponent_missing',
      'poly_multiplicity_ignored',
      'poly_multiplicity_wrong_zero',
      'geo_distance_not_squared',
      'trig_sector_r_not_squared',
    ],
  },
  {
    id: 'log',
    name: 'Log Splitter',
    personality: 'Splits logs that were never meant to split.',
    family: 'Log slips: the product, quotient and power rules, log values, and logs used to undo.',
    subject: 'math',
    look: { body: 'log', hue: 26, sat: 50, light: 46, accent: 110, top: 'sprout', eyes: 'round', mouth: 'smirk', feet: 'stubs', arms: 'none', mark: 'rings' },
    variants: [
      'log_sum_split',
      'log_product_as_product',
      'log_quotient_as_quotient',
      'log_power_as_power',
      'log_coefficient_as_power',
      'log_coefficient_inside',
      'log_identity_misused',
      'log_power_abs',
      'log_value_divided',
    ],
  },
  {
    id: 'base',
    name: 'The Base Bandit',
    personality: 'Steals the base and leaves the wrong one in its place.',
    family: 'Base slips: which base, where it goes, base 10 or e, a base above or below 1.',
    subject: 'math',
    look: { body: 'box', hue: 222, sat: 16, light: 62, accent: 4, top: 'roundEars', eyes: 'round', mouth: 'smirk', feet: 'stubs', arms: 'stubs', mark: 'mask' },
    variants: [
      'log_change_base_inverted',
      'log_convert_swapped',
      'log_convert_dropped',
      'log_exp_coefficient_base',
      'log_ln_confused',
      'exp_base_direction',
      'exp_inverse_base_swapped',
    ],
  },
  {
    id: 'interest',
    name: 'The Interest Eater',
    personality: 'Nibbles at interest and half-lives until the numbers come out wrong.',
    family: 'Money and growth slips: rates as decimals, compounding, continuous growth, what is left after a half-life, how sales move with a price.',
    subject: 'math',
    look: { body: 'round', hue: 158, sat: 46, light: 48, accent: 46, top: 'horn', eyes: 'half', mouth: 'teeth', feet: 'stubs', arms: 'stubs', mark: 'coin', face: 'high' },
    variants: [
      'exp_rate_percent',
      'exp_wrong_period',
      'exp_simple_interest',
      'exp_continuous_swapped',
      'exp_halflife_base',
      'exp_halflife_decayed',
      'exp_growth_swapped',
      'opt_revenue_wrong_way',
      'opt_revenue_whole_price',
      'opt_revenue_steps',
    ],
  },
  {
    id: 'tangle',
    name: 'The Tangler',
    personality: 'Ties functions in knots: inside out, inverse upside down.',
    family: 'Inverse and composition slips: which function goes inside, f⁻¹ against 1/f, f(x + h), swapping x and y.',
    subject: 'math',
    look: { body: 'blob', hue: 282, sat: 52, light: 56, accent: 160, top: 'curls', eyes: 'spiral', mouth: 'zigzag', feet: 'tentacles', arms: 'none', mark: 'none' },
    variants: [
      'reciprocal_as_inverse',
      'swap_misname',
      'dq_fx_plus_h',
      'fn_compose_no_parens',
      'fn_compose_reversed',
      'fn_compose_product',
      'fn_compose_sum',
      'fn_value_product',
      'fn_value_reversed',
      'op_order_reversed',
      'op_product_for_composition',
      'op_composition_for_product',
      'op_wrong_function',
      'op_difference_reversed',
      'exp_inverse_shift',
      'exp_inverse_reciprocal',
      'opt_primary_secondary_swapped',
      'trig_ratio_for_angle',
      'trig_inverse_as_reciprocal',
      'trig_inverse_cancel_outside',
    ],
  },
  {
    id: 'fence',
    name: 'The Fence Jumper',
    personality: 'Hops the domain’s fence and lets forbidden numbers in.',
    family: 'Domain and range slips: what may go in, what comes out, where a function is undefined, an answer outside the range asked, the ranges of the trig graphs and of the inverse functions.',
    subject: 'math',
    look: { body: 'bean', hue: 96, sat: 52, light: 50, accent: 32, top: 'spikes', eyes: 'wide', mouth: 'grin', feet: 'stubs', arms: 'up', mark: 'fence' },
    variants: [
      'fn_domain_forgot_denominator',
      'fn_domain_denominator_nonneg',
      'fn_domain_gave_range',
      'fn_range_gave_domain',
      'fn_range_reflection_ignored',
      'fn_range_included_asymptote',
      'fn_composite_domain_simplified',
      'fn_composite_domain_inner_only',
      'op_undefined_missed',
      'exp_domain_range_swapped',
      'trig_solve_out_of_range',
      'trig_range_ignores_d',
      'trig_sec_range_as_sinusoid',
      'trig_inverse_other_angle',
      'trig_inverse_not_principal',
      'trig_arccos_range_as_arcsin',
      'trig_inverse_outside_domain',
    ],
  },
  {
    id: 'squint',
    name: 'The Squinter',
    personality: 'Reads graphs with its eyes half shut.',
    family: 'Reading slips: increasing or decreasing, highs and lows, x before y, end behavior, which value a question asks for, a wave’s period and midline read off its graph.',
    subject: 'math',
    look: { body: 'pear', hue: 72, sat: 58, light: 52, accent: 210, top: 'tuft', eyes: 'squint', mouth: 'flat', feet: 'stubs', arms: 'stubs', mark: 'monocle' },
    variants: [
      'gf_swapped_inc_dec',
      'gf_y_for_intervals',
      'gf_not_turning_point',
      'gf_global_not_local',
      'gf_global_on_ray',
      'gf_swapped_coordinates',
      'poly_cs_vertex_swapped',
      'poly_cross_touch_swapped',
      'poly_end_sign_ignored',
      'poly_end_parity_swapped',
      'exp_asymptote_axis',
      'opt_x_as_max',
      'opt_max_as_dimension',
      'opt_dimensions_swapped',
      'opt_other_from_primary',
      'trig_period_half',
      'trig_period_quarter',
      'trig_midline_at_extreme',
      'trig_model_later_time',
    ],
  },
  {
    id: 'shifty',
    name: 'Shifty',
    personality: 'Slides graphs the wrong way when nobody’s looking.',
    family: 'Transformation slips: shifts, stretches and reflections the wrong way, the wrong size or in the wrong order, and a trig graph’s period, phase shift, midline and starting point.',
    subject: 'math',
    look: { body: 'blob', hue: 176, sat: 56, light: 46, accent: 12, top: 'mohawk', eyes: 'side', mouth: 'smirk', feet: 'stubs', arms: 'none', mark: 'speed' },
    variants: [
      'tr_h_shift_reversed',
      'tr_v_shift_reversed',
      'tr_h_factor_inverted',
      'tr_v_factor_inverted',
      'tr_reflection_wrong_axis',
      'tr_missing_reflection',
      'tr_unfactored_shift',
      'tr_missing_step',
      'tr_extra_step',
      'tr_h_order',
      'tr_v_order',
      'tr_factors_swapped',
      'tr_v_factor_inside',
      'tr_v_shift_inside',
      'exp_shift_sign',
      'exp_sign_of_a',
      'exp_asymptote_unshifted',
      'exp_intercept_shift',
      'trig_period_as_b',
      'trig_shift_not_divided',
      'trig_shift_wrong_way',
      'trig_midline_zero',
      'trig_reflection_missed',
      'trig_b_as_period',
      'trig_vertical_shift_sign',
      'trig_model_start_point',
    ],
  },
  {
    id: 'patch',
    name: 'The Patchwork',
    personality: 'Stitches piecewise functions together from the wrong pieces.',
    family: 'Piecewise slips: which piece, which boundary, the gaps, the domain and range, writing one from a graph.',
    subject: 'math',
    look: { body: 'box', hue: 10, sat: 58, light: 58, accent: 48, top: 'ears', eyes: 'mismatch', mouth: 'zigzag', feet: 'stubs', arms: 'stubs', mark: 'stitches' },
    variants: [
      'pw_piecewise_wrong_piece',
      'pw_piecewise_boundary',
      'pw_piecewise_value_where_undefined',
      'pw_piecewise_undefined_where_defined',
      'pw_domain_gap',
      'pw_domain_closed',
      'pw_range_from_x',
      'pw_range_unrestricted',
      'pw_k_wrong_piece',
      'pw_k_other_boundary',
      'pw_write_boundary',
      'pw_write_slope',
      'pw_write_intercept',
      'pw_write_overlap',
    ],
  },
  {
    id: 'slope',
    name: 'The Slope Slider',
    personality: 'Skates down every slope backwards.',
    family: 'Slope and rate slips: rise over run, dividing by the change, parallel and perpendicular slopes, the h in a difference quotient.',
    subject: 'math',
    look: { body: 'lean', hue: 204, sat: 66, light: 56, accent: 18, top: 'tuft', eyes: 'half', mouth: 'grin', feet: 'skate', arms: 'up', mark: 'none' },
    variants: [
      'rate_no_division',
      'rate_divided_by_b',
      'dq_forgot_divide',
      'dq_set_h_zero',
      'geo_perp_reciprocal_only',
      'geo_perp_sign_only',
      'geo_parallel_kept_intercept',
      'geo_vertical_as_zero',
      'geo_lines_relation_swapped',
    ],
  },
  {
    id: 'phantom',
    name: 'The Phantom',
    personality: 'Haunts your answers: keeps the fake ones, spooks off the real ones.',
    family: 'Ghost-answer slips: extraneous answers kept, real ones dropped, a solution lost by dividing, an angle left out of the range.',
    subject: 'math',
    look: { body: 'ghost', hue: 248, sat: 40, light: 78, accent: 300, top: 'none', eyes: 'hollow', mouth: 'o', feet: 'none', arms: 'stubs', mark: 'none' },
    variants: ['dropped_pm', 'divide_by_variable', 'rf_extraneous_kept', 'rf_valid_dropped', 'log_extraneous_kept', 'log_valid_rejected'],
  },
  {
    id: 'crunch',
    name: 'The Coefficient Cruncher',
    personality: 'Chews up coefficients and spits out the wrong polynomial.',
    family: 'Polynomial procedure slips: completing the square, the vertex formula, synthetic division, zeros and factors, rational roots.',
    subject: 'math',
    look: { body: 'hex', hue: 214, sat: 10, light: 66, accent: 28, top: 'bulb', eyes: 'round', mouth: 'teeth', feet: 'stubs', arms: 'stubs', mark: 'bolts' },
    variants: [
      'poly_cs_no_factor_a',
      'poly_cs_half_or_square',
      'poly_cs_constant_not_scaled',
      'poly_sd_first_coefficient',
      'poly_sd_subtracted',
      'poly_sd_missing_placeholder',
      'poly_sd_quotient_degree',
      'poly_sd_remainder_last_quotient',
      'poly_zero_nonmonic_factor',
      'poly_lead_coefficient_omitted',
      'poly_rrt_no_plus_minus',
      'poly_rrt_integers_only',
      'poly_rrt_wrong_coefficients',
      'opt_vertex_ab_swapped',
      'opt_vertex_sign',
      'opt_vertex_no_two',
      'opt_coefficients_swapped',
      'trig_solve_reference_only',
      'trig_solve_one_answer',
    ],
  },
  {
    id: 'hole',
    name: 'The Hole Digger',
    personality: 'Digs holes where the asymptotes go, and the other way round.',
    family: 'Rational function slips: holes or asymptotes, the degree rule, intercepts at a hole, and where tan, cot, sec and csc have their asymptotes.',
    subject: 'math',
    look: { body: 'blob', hue: 30, sat: 40, light: 54, accent: 46, top: 'hardhat', eyes: 'sleepy', mouth: 'buck', feet: 'none', arms: 'stubs', mark: 'hole' },
    variants: [
      'rf_hole_as_asymptote',
      'rf_asymptote_from_numerator',
      'rf_hole_left_out',
      'rf_hole_y_unreduced',
      'rf_degree_rule',
      'rf_ratio_not_leading',
      'rf_slant_remainder',
      'rf_intercept_at_hole',
      'rf_intercept_swapped',
      'trig_asymptotes_zeros_swapped',
      'trig_sec_asymptotes_at_sin_zeros',
    ],
  },
  {
    id: 'imag',
    name: 'The Imaginary Friend',
    personality: 'Insists i² is +1. Nobody else believes it.',
    family: 'Complex number slips: i², conjugates, a + bi form, powers of i, roots of negatives.',
    subject: 'math',
    look: { body: 'cloud', hue: 226, sat: 62, light: 70, accent: 320, top: 'none', eyes: 'wide', mouth: 'grin', feet: 'none', arms: 'none', mark: 'dashed' },
    variants: [
      'cx_i_squared_positive',
      'cx_foil_dropped',
      'cx_conjugate_wrong',
      'cx_not_simplified',
      'cx_power_cycle',
      'cx_sqrt_product',
      'cx_sqrt_negative_sign',
      'cx_discriminant_sign',
      'cx_half_formula',
      'cx_conjugate_missing',
    ],
  },
  {
    id: 'mismeasure',
    name: 'The Mismeasurer',
    personality: 'Measures twice and gets it wrong both times.',
    family: 'Measure slips: parts and wholes, midpoints, halves and doubles, x in place of the measure, angle sums of polygons, fences and areas counted wrong, proportions set up or cross-multiplied wrong, the means and ratios of similar figures, and a wave’s height measured from the wrong place.',
    subject: 'math',
    look: { body: 'box', hue: 50, sat: 86, light: 56, accent: 4, top: 'antennae', eyes: 'round', mouth: 'grin', feet: 'stubs', arms: 'stubs', mark: 'ruler' },
    variants: [
      'geo_answered_x',
      'geo_parts_equal',
      'geo_part_equals_whole',
      'geo_half_for_whole',
      'geo_midpoint_subtracted',
      'geo_endpoint_averaged',
      'geo_equilateral_angle_for_side',
      'geo_diagonal_half_as_whole',
      'geo_median_not_halved',
      'geo_median_as_base',
      'geo_midsegment_doubled',
      'geo_exterior_adjacent',
      'geo_interior_sum_n180',
      'geo_interior_not_divided',
      'geo_exterior_180_over_n',
      'geo_sides_from_interior_360',
      'geo_sides_from_exterior_180',
      'geo_exterior_sum_as_interior',
      'opt_wall_fenced',
      'opt_wall_wrong_side',
      'opt_pen_ends_short',
      'opt_pen_long_short',
      'opt_area_one_pen',
      'opt_area_wrong_count',
      'opt_area_as_fence',
      'trig_pythag_added',
      'trig_pythag_subtracted',
      'geo_part_over_whole',
      'geo_perimeter_ratio_squared',
      'geo_cross_multiplied_wrong',
      'geo_geometric_as_arithmetic',
      'geo_bisector_ratio_swapped',
      'geo_angle_scaled',
      'trig_amplitude_with_d',
      'trig_amplitude_as_span',
      'trig_amplitude_as_diameter',
    ],
  },
  {
    id: 'angle',
    name: 'The Angle Swapper',
    personality: 'Trades angle partners: vertical for linear, alternate for corresponding.',
    family: 'Angle mix-ups: complementary or supplementary, vertical or linear, the transversal pairs, the angles of a quadrilateral, which side is across from which angle, and which part of a similar figure corresponds to which.',
    subject: 'math',
    look: { body: 'tri', hue: 122, sat: 44, light: 52, accent: 340, top: 'horns', eyes: 'round', mouth: 'smirk', feet: 'stubs', arms: 'stubs', mark: 'arc' },
    variants: [
      'geo_comp_supp_swapped',
      'geo_complement_reversed',
      'geo_vertical_as_supplementary',
      'geo_linear_pair_equal',
      'geo_linear_for_vertical',
      'geo_vertical_for_linear',
      'geo_same_side_congruent',
      'geo_congruent_as_same_side',
      'geo_alt_int_corr_swapped',
      'geo_alt_ext_corr_swapped',
      'geo_parallel_only_when_not',
      'geo_vertical_angles_missed',
      'geo_base_angles_wrong_vertex',
      'geo_consecutive_angles_equal',
      'geo_opposite_angles_supplementary',
      'geo_consecutive_marks_as_opposite',
      'geo_kite_angles_wrong_pair',
      'trig_special_legs_swapped',
      'trig_depression_from_vertical',
      'trig_opposite_adjacent_swapped',
      'geo_matched_by_position',
      'geo_corresponding_supplementary',
    ],
  },
  {
    id: 'ifthen',
    name: 'The If-Then Twister',
    personality: 'Turns every if-then inside out and backwards.',
    family: 'Logic slips: converse, inverse and contrapositive, counterexamples, the laws of logic.',
    subject: 'math',
    look: { body: 'spiky', hue: 296, sat: 46, light: 50, accent: 52, top: 'antennae', eyes: 'half', mouth: 'smirk', feet: 'stubs', arms: 'none', mark: 'arrow' },
    variants: [
      'geo_converse_inverse_swapped',
      'geo_contrapositive_half',
      'geo_contrapositive_unswitched',
      'geo_false_converse',
      'geo_counterexample_hypothesis',
      'geo_affirm_conclusion',
      'geo_deny_hypothesis',
      'geo_syllogism_order',
      'geo_missed_detachment',
    ],
  },
  {
    id: 'reason',
    name: 'The Reason Thief',
    personality: 'Swipes the right reason out of your proof and leaves a wrong one.',
    family: 'Proof slips: the wrong property for a line, congruence and similarity shortcuts that prove nothing, a pair the figure gives left out, CPCTC too soon.',
    subject: 'math',
    look: { body: 'bean', hue: 236, sat: 34, light: 46, accent: 48, top: 'ears', eyes: 'side', mouth: 'smirk', feet: 'stubs', arms: 'stubs', mark: 'therefore', face: 'high' },
    variants: [
      'geo_midpoint_for_addition',
      'geo_addition_for_midpoint',
      'geo_substitution_for_transitive',
      'geo_reflexive_for_symmetric',
      'geo_equality_for_postulate',
      'geo_congruent_for_midpoint',
      'geo_ssa_as_congruence',
      'geo_aaa_as_congruence',
      'geo_sas_not_included',
      'geo_asa_aas_swapped',
      'geo_hl_no_right',
      'geo_vertices_out_of_order',
      'geo_shared_side_missed',
      'geo_cpctc_too_soon',
      'geo_ssa_as_similarity',
      'geo_shared_angle_missed',
      'geo_similarity_test_missed',
      'geo_sss_two_pairs',
      'geo_aa_one_angle',
    ],
  },
  {
    id: 'quad',
    name: 'The Shape Faker',
    personality: 'Passes off any four-sided shape as something fancier.',
    family: 'Quadrilateral slips: which properties a shape has, which tests prove it, its most specific name.',
    subject: 'math',
    look: { body: 'box', hue: 340, sat: 50, light: 66, accent: 220, top: 'none', eyes: 'round', mouth: 'grin', feet: 'stubs', arms: 'stubs', mark: 'disguise' },
    variants: [
      'geo_parallelogram_as_rhombus',
      'geo_rect_rhombus_swapped',
      'geo_diagonals_assumed_congruent',
      'geo_one_diagonal_bisected',
      'geo_trapezoid_as_parallelogram',
      'geo_parallel_congruent_mixed',
      'geo_one_pair_half_test',
      'geo_parallelogram_test_missed',
      'geo_converse_property',
      'geo_square_not_rectangle',
      'geo_not_most_specific',
    ],
  },
  {
    id: 'spin',
    name: 'The Spinner',
    personality: 'Spins angles the wrong way around the circle.',
    family: 'Trig slips: radians and degrees, coterminal and reference angles, the unit circle’s values, arcs and sectors, special triangles, the calculator’s mode, and which trig function a graph is.',
    subject: 'math',
    look: { body: 'round', hue: 186, sat: 50, light: 40, accent: 52, top: 'antennae', eyes: 'wide', mouth: 'o', feet: 'stubs', arms: 'stubs', mark: 'swirl', face: 'high' },
    variants: [
      'trig_pi_dropped',
      'trig_pi_kept',
      'trig_coterminal_half_turn',
      'trig_coterminal_short',
      'trig_negative_direction',
      'trig_reference_from_y_axis',
      'trig_reference_wrong_way',
      'trig_reference_is_coterminal',
      'trig_sin_cos_swapped',
      'trig_reciprocal_mixed',
      'trig_reciprocal_missing',
      'trig_zero_for_undefined',
      'trig_undefined_for_zero',
      'trig_r_left_out',
      'trig_arc_degrees',
      'trig_sector_no_half',
      'trig_arc_sector_swapped',
      'trig_special_root3_two_swapped',
      'trig_radian_mode',
      'trig_period_base_mixed',
      'trig_cofunction_graph',
      'trig_degree_mode',
    ],
  },
  // ------------------------------------------------------------------ chemistry (the family app)
  {
    id: 'sigfig',
    name: 'The Zero Hoarder',
    personality: 'Hoards zeros and never knows which ones count.',
    family: 'Significant-figure slips: which digits count, rounding, the rules for × ÷ and + −, scientific notation.',
    subject: 'chemistry',
    look: { body: 'round', hue: 168, sat: 40, light: 56, accent: 52, top: 'tuft', eyes: 'wide', mouth: 'o', feet: 'stubs', arms: 'stubs', mark: 'zero', face: 'high' },
    variants: [
      'sf_leading_zeros',
      'sf_trailing_zeros_decimal',
      'sf_placeholder_zeros',
      'sf_captive_zero',
      'sf_ambiguous_zeros',
      'sf_places_not_figures',
      'sf_dropped_zero',
      'sf_extra_zeros',
      'sf_lost_placeholders',
      'sf_unrounded',
      'sf_truncated',
      'sf_rounded_early',
      'sf_addsub_rule_on_muldiv',
      'sf_muldiv_rule_on_addsub',
      'sf_most_precise',
      'sf_exact_limited',
      'sf_sci_changed_figures',
      'sf_sci_exponent',
      'sf_sci_form',
    ],
  },
  {
    id: 'units',
    name: 'The Unit Smuggler',
    personality: 'Smuggles numbers through without their units.',
    family: 'Light and unit slips: nanometers to meters, which way the formula goes, c and h in the right places.',
    subject: 'chemistry',
    look: { body: 'bean', hue: 32, sat: 30, light: 44, accent: 196, top: 'none', eyes: 'half', mouth: 'smirk', feet: 'stubs', arms: 'none', mark: 'case' },
    variants: [
      'lt_no_conversion',
      'lt_conversion_backwards',
      'lt_wrong_unit',
      'lt_multiplied',
      'lt_inverted',
      'lt_energy_divided',
      'lt_energy_no_c',
      'lt_order_reversed',
    ],
  },
  {
    id: 'atom',
    name: 'The Particle Pickpocket',
    personality: 'Pockets a proton, drops an electron, miscounts the rest.',
    family: 'Atomic structure slips: protons, neutrons and electrons, ions, symbols, isotopes and average mass.',
    subject: 'chemistry',
    look: { body: 'blob', hue: 208, sat: 52, light: 46, accent: 4, top: 'ears', eyes: 'side', mouth: 'grin', feet: 'stubs', arms: 'stubs', mark: 'orbiters' },
    variants: [
      'at_neutrons_as_mass_number',
      'at_mass_neutrons_only',
      'at_mass_protons_electrons',
      'at_swapped_a_z',
      'at_electrons_ignored_charge',
      'at_charge_sign_flipped',
      'at_protons_changed_for_ion',
      'at_element_from_electrons',
      'at_symbol_case',
      'at_unweighted_average',
      'at_percent_not_decimal',
      'at_mass_numbers_used',
      'at_isotope_left_out',
      'at_assumed_even_split',
      'at_abundance_swapped',
      'at_abundance_sum',
    ],
  },
  {
    id: 'orbital',
    name: 'The Orbital Overstuffer',
    personality: 'Crams electrons into whatever box is open.',
    family: 'Electron configuration slips: counting electrons, filling order, the exceptions, ions, cores, valence, orbital diagrams.',
    subject: 'chemistry',
    look: { body: 'round', hue: 268, sat: 56, light: 60, accent: 192, top: 'none', eyes: 'round', mouth: 'grin', feet: 'stubs', arms: 'stubs', mark: 'orbit' },
    variants: [
      'ec_electron_count',
      'ec_subshell_overfilled',
      'ec_subshell_nonexistent',
      'ec_filling_order',
      'ec_exception_missed',
      'ec_exception_misapplied',
      'ec_ion_charge_ignored',
      'ec_ion_wrong_direction',
      'ec_ion_removed_from_3d',
      'ec_ion_wrong_number',
      'ec_core_wrong',
      'ec_core_not_earlier',
      'ec_valence_total_electrons',
      'ec_valence_last_subshell',
      'ec_hund_broken',
      'ec_pauli_broken',
      'ec_unpaired_from_wrong_diagram',
    ],
  },
  {
    id: 'table',
    name: 'The Table Flipper',
    personality: 'Flips the periodic table over and reads it backwards.',
    family: 'Periodic table slips: blocks and families, valence from the table, trends, ion sizes, why a trend goes the way it does.',
    subject: 'chemistry',
    look: { body: 'box', hue: 4, sat: 62, light: 56, accent: 52, top: 'horns', eyes: 'angry', mouth: 'teeth', feet: 'stubs', arms: 'up', mark: 'grid', face: 'high' },
    variants: [
      'pt_trend_reversed',
      'pt_radius_like_ionization',
      'pt_cation_larger',
      'pt_anion_smaller',
      'pt_isoelectronic_electron_count',
      'pt_group_number_valence',
      'pt_period_as_valence',
      'pt_valence_is_atomic_number',
      'pt_valence_is_period',
      'pt_helium_octet',
      'pt_hydrogen_metal',
      'pt_helium_p_block',
      'pt_f_as_d_block',
      'pt_alkaline_called_alkali',
      'pt_alkali_called_alkaline',
      'pt_metalloid_called_metal',
      'pt_metal_called_metalloid',
      'pt_why_shells_across_period',
      'pt_why_shielding_same_shell',
      'pt_why_protons_down_group',
    ],
  },
  {
    id: 'ionic',
    name: 'The Criss-Crosser',
    personality: 'Crosses the charges, then crosses them again.',
    family: 'Ionic compound slips: balancing charges, polyatomic ions, Roman numerals, -ide, -ate and -ite.',
    subject: 'chemistry',
    look: { body: 'spiky', hue: 40, sat: 80, light: 56, accent: 220, top: 'none', eyes: 'angry', mouth: 'fangs', feet: 'stubs', arms: 'crossed', mark: 'charges' },
    variants: [
      'nm_charges_unbalanced',
      'nm_crisscross_reversed',
      'nm_not_lowest_ratio',
      'nm_parentheses_missing',
      'nm_unit_ion_reduced',
      'nm_polyatomic_formula_wrong',
      'nm_ion_charge_wrong',
      'nm_numeral_as_subscript',
      'nm_numeral_missing',
      'nm_numeral_wrong',
      'nm_numeral_on_fixed',
      'nm_anion_first',
      'nm_prefix_on_ionic',
      'nm_element_name_for_anion',
      'nm_ide_for_polyatomic',
      'nm_ate_ite_swapped',
      'nm_per_hypo_wrong',
      'nm_hydrogen_prefix_wrong',
    ],
  },
  {
    id: 'naming',
    name: 'The Name Mangler',
    personality: 'Gets every compound’s name almost right.',
    family: 'Molecular, acid and hydrate slips: prefixes, hydro- and -ic or -ous, the waters of a hydrate, which kind of compound.',
    subject: 'chemistry',
    look: { body: 'pear', hue: 146, sat: 38, light: 62, accent: 4, top: 'antennae', eyes: 'round', mouth: 'grin', feet: 'stubs', arms: 'stubs', mark: 'nametag', face: 'high' },
    variants: [
      'nm_prefix_missing',
      'nm_mono_on_first',
      'nm_molecular_reduced',
      'nm_stock_on_molecular',
      'nm_hydro_missing',
      'nm_hydro_on_oxyacid',
      'nm_ic_ous_swapped',
      'nm_acid_root',
      'nm_acid_anion_ending',
      'nm_acid_named_as_salt',
      'nm_hydrate_count_wrong',
      'nm_class_ammonium_molecular',
      'nm_class_hydrate_ignored',
      'nm_class_acid_ignored',
    ],
  },
]

const SPECIES_BY_ID = new Map<string, Species>(SPECIES.map((s) => [s.id, s]))

/** Catalog id → its species and its place among the species' variants. */
const PLACE = new Map<string, { species: Species; index: number }>()
for (const species of SPECIES) species.variants.forEach((id, index) => PLACE.set(id, { species, index }))

export function speciesById(id: string): Species | null {
  return SPECIES_BY_ID.get(id) ?? null
}

/** The species a named mistake belongs to, or null (not a monster: a note, a behaviour, an unknown id). */
export function speciesOf(patternId: string): Species | null {
  return PLACE.get(patternId)?.species ?? null
}

/** A mistake's place in its species (0 = first variant), or -1. */
export function variantIndex(patternId: string): number {
  return PLACE.get(patternId)?.index ?? -1
}

export function isMonster(patternId: string): boolean {
  return PLACE.has(patternId)
}

export function isRare(patternId: string): boolean {
  return RARE.has(patternId)
}

/** The species an edition shows: the store app (math only) leaves out the chemistry species. */
export function speciesForEdition(store: boolean): Species[] {
  return SPECIES.filter((s) => !store || s.subject === 'math')
}
