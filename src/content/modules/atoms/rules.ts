import type { RuleCard } from '@/content/types'

/**
 * Rule cards for atomic structure (CK-12 Chemistry - Intermediate ch. 4), in this module's own
 * words. Ids are stable: templates point at them for hint rung 2.
 */
export const AT_RULE_IDS = {
  protons: 'at-protons',
  massNumber: 'at-mass-number',
  neutrons: 'at-neutrons',
  electrons: 'at-electrons',
  isotopes: 'at-isotopes',
  notation: 'at-notation',
  weighted: 'at-weighted-average',
  percent: 'at-percent-decimal',
  figures: 'at-average-figures',
  abundance: 'at-abundance',
} as const

export type AtRuleKey = keyof typeof AT_RULE_IDS

export function atRule(key: AtRuleKey): string {
  return AT_RULE_IDS[key]
}

export const AT_RULES: RuleCard[] = [
  {
    id: AT_RULE_IDS.protons,
    title: 'The protons pick the element',
    body: 'The atomic number, Z, is the number of protons. Every atom of an element has the same Z, and changing the number of protons would make a different element. Z is the small number at the bottom left of a nuclear symbol and the whole number on each square of the periodic table.',
    example: 'Z = 17 → chlorine: every chlorine atom and ion has 17 protons',
  },
  {
    id: AT_RULE_IDS.massNumber,
    title: 'Mass number = protons + neutrons',
    body: 'The mass number, A, counts every particle in the nucleus: protons and neutrons together. Electrons are far too light to count. A is the top number of a nuclear symbol and the number after the name in hyphen notation.',
    example: 'chlorine-37: A = 37 = 17 protons + 20 neutrons',
  },
  {
    id: AT_RULE_IDS.neutrons,
    title: 'Neutrons = A − Z',
    body: 'Take the protons away from the mass number, and what is left is the neutrons.',
    example: '³⁷₁₇Cl: 37 − 17 = 20 neutrons     ¹⁴₆C: 14 − 6 = 8 neutrons',
  },
  {
    id: AT_RULE_IDS.electrons,
    title: 'Electrons = Z − charge',
    body: 'A neutral atom has as many electrons as protons. An ion has gained or lost electrons: a positive ion lost some, a negative ion gained some. The nucleus never changes when an ion forms.',
    example: 'Na⁺: 11 − 1 = 10 electrons     Cl⁻: 17 − (−1) = 18 electrons     O²⁻: 8 − (−2) = 10',
  },
  {
    id: AT_RULE_IDS.isotopes,
    title: 'Isotopes differ only in neutrons',
    body: 'Isotopes of an element have the same number of protons (so the same element and the same Z) but different numbers of neutrons, so their mass numbers differ. Hyphen notation names an isotope by its mass number.',
    example: 'chlorine-35 and chlorine-37: both 17 protons; 18 and 20 neutrons',
  },
  {
    id: AT_RULE_IDS.notation,
    title: 'Writing a nuclear symbol',
    body: 'Mass number at the top left, atomic number at the bottom left, charge at the top right (nothing there for a neutral atom). The symbol is one capital letter, followed by a lowercase letter when there are two.',
    example: '²³₁₁Na⁺     ³⁷₁₇Cl⁻     ¹⁴₆C',
  },
  {
    id: AT_RULE_IDS.weighted,
    title: 'Average atomic mass is a weighted average',
    body: 'Multiply each isotope’s mass by how common it is (as a decimal), then add. Common isotopes pull the average toward their own mass, so the answer lands between the isotope masses, nearest the most abundant one. It is the mass printed on the periodic table.',
    example: 'Cl: 34.969 u × 0.7576 + 36.966 u × 0.2424 = 35.45 u',
  },
  {
    id: AT_RULE_IDS.percent,
    title: 'A percent becomes a decimal before you multiply',
    body: 'Percent means “out of 100”, so divide by 100: the decimal point moves two places left. The 100 is exact, so it never limits the significant figures.',
    example: '75.76% → 0.7576     7.59% → 0.0759     10.00% → 0.1000',
  },
  {
    id: AT_RULE_IDS.figures,
    title: 'Significant figures in a weighted average',
    body: 'Each product (mass × decimal abundance) keeps the fewest significant figures of its two measurements. The sum then stops at the least precise place among the products. Keep every digit in the calculator and round once, at the end.',
    example: '26.49 (good to hundredths) + 8.961 (thousandths) → 35.45',
  },
  {
    id: AT_RULE_IDS.abundance,
    title: 'Finding abundances from the average',
    body: 'Call one isotope’s fraction x; the other is 1 − x, because together they make up the whole element. Solve x·m₁ + (1 − x)·m₂ = average for x, then turn it into a percent. The two percents always add to 100%, and the bigger one belongs to the isotope nearer the average.',
    example: 'x(34.969) + (1 − x)(36.966) = 35.453 → x = 0.7576 → 75.76% and 24.24%',
  },
]
