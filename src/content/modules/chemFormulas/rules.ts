/**
 * Rule cards for percent composition and formulas (chemistry chapter 10), in our own words. The
 * worked substances are Ca(OH)₂, BaCl₂·2H₂O and Br₂, which no chapter 10 template draws; the
 * multipliers of the empirical procedure are written in words, never as digits.
 */
import type { RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

export const CF_RULES: readonly RuleCard[] = [
  {
    id: 'cf.percent',
    title: 'Percent composition: one part over the whole',
    body: 'An element’s percent by mass is its share of one mole of the compound: its atomic mass times its subscript, divided by the molar mass of the whole compound, times 100. Measured masses work the same way: one element’s grams over the grams of the whole sample, times 100. The percents of one compound add up to 100, give or take rounding.',
    example: 'Ca in Ca(OH)₂: 40.08 ÷ 74.10 × 100 = 54.09%',
  },
  {
    id: 'cf.hydrate',
    title: 'A hydrate carries its water',
    body: 'A hydrate is an ionic compound with water locked into its crystal. The number in front of H₂O after the dot counts the waters in each formula unit, and the molar mass includes every one of them. Percent water is the mass of all those waters divided by the molar mass of the whole hydrate, times 100.',
    example: 'BaCl₂·2H₂O: its two waters are 36.04 g of every 244.27 g, a 14.75% share',
  },
  {
    id: 'cf.empirical',
    title: 'Empirical formula: grams, moles, smallest ratio',
    body: 'Read each percent as grams in a 100 g sample (or use the measured grams). Turn each element’s grams into moles with its atomic mass. Divide every mole amount by the smallest one. A ratio within a few hundredths of a whole number is that whole number. A ratio that ends in a half means double every ratio; one that ends in a third or two thirds, triple them; a quarter or three quarters, quadruple them — never round those away. The whole numbers you end with are the subscripts.',
    example: 'a ratio of one to one and a half is doubled to two to three, not rounded to one to two',
  },
  {
    id: 'cf.molecular',
    title: 'Molecular formula: a whole-number multiple',
    body: 'The molecular formula is the empirical formula repeated a whole number of times. Add up the empirical formula’s mass, divide the molar mass by it, and round to the nearest whole number: that is the multiplier. Multiply every subscript of the empirical formula by it.',
    example: 'Br₂ from the empirical formula Br: 159.80 ÷ 79.90 is a multiplier of two',
  },
]

/** The slips each formulas card answers (the card shown first when she makes one). */
export const CF_CARD_SLIPS: Record<string, readonly ErrorPatternId[]> = {
  'cf.percent': ['mo_percent_by_count', 'mo_percent_one_atom', 'mo_percent_part_over_part'],
  'cf.hydrate': ['mo_hydrate_water_left_out', 'mo_hydrate_water_once'],
  'cf.empirical': ['mo_mass_ratio_as_mole_ratio', 'mo_ratio_rounded'],
  'cf.molecular': ['mo_empirical_as_molecular'],
}
