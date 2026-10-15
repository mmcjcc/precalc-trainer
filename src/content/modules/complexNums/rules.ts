import type { RuleCard } from '@/content/types'
import type { CxMistakeId } from './grade'

export const CX_RULE_IDS = {
  iSquared: 'cx-i-squared',
  foil: 'cx-foil',
  conjugate: 'cx-conjugate',
  form: 'cx-form',
  cycle: 'cx-cycle',
  sqrtProduct: 'cx-sqrt-product',
  sqrtNeg: 'cx-sqrt-neg',
  discriminant: 'cx-discriminant',
  pair: 'cx-pair',
  formula: 'cx-formula',
} as const

export const CX_RULE_FOR: Record<CxMistakeId, string> = {
  cx_i_squared_positive: CX_RULE_IDS.iSquared,
  cx_foil_dropped: CX_RULE_IDS.foil,
  cx_conjugate_wrong: CX_RULE_IDS.conjugate,
  cx_not_simplified: CX_RULE_IDS.form,
  cx_power_cycle: CX_RULE_IDS.cycle,
  cx_sqrt_product: CX_RULE_IDS.sqrtProduct,
  cx_sqrt_negative_sign: CX_RULE_IDS.sqrtNeg,
  cx_discriminant_sign: CX_RULE_IDS.discriminant,
  cx_conjugate_missing: CX_RULE_IDS.pair,
  cx_half_formula: CX_RULE_IDS.formula,
}

export const CX_RULES: RuleCard[] = [
  {
    id: CX_RULE_IDS.iSquared,
    title: 'i² = −1',
    body: 'The square of i is −1, not +1. In (a + bi)(c + di) the last term is bdi², which equals −bd, so the real part is ac − bd.',
    example: '(3 − 2i)(4 + i) = 12 + 3i − 8i − 2i² = 14 − 5i',
  },
  {
    id: CX_RULE_IDS.foil,
    title: 'A product of binomials has four terms',
    body: 'FOIL keeps First, Outer, Inner, and Last. Dropping the outer and inner terms leaves only a real number and misses the imaginary part.',
    example: '(3 − 2i)(4 + i) = 12 + 3i − 8i + 2 = 14 − 5i, not 14',
  },
  {
    id: CX_RULE_IDS.conjugate,
    title: 'Multiply by the conjugate of the denominator',
    body: 'The conjugate of c + di is c − di. Multiply the numerator and the denominator by that, so the bottom becomes the real number c² + d², then write a + bi.',
    example: '(2 + 3i)/(1 − 2i) · (1 + 2i)/(1 + 2i) = (−4 + 7i)/5 = −4/5 + 7/5 i',
  },
  {
    id: CX_RULE_IDS.form,
    title: 'Standard form is a + bi',
    body: 'The answer is finished when it reads a + bi: no i² left standing, and no i in a denominator. A real denominator such as 5 is fine: (4 − 7i)/5 is the same as 4/5 − 7/5 i.',
    example: '(2 + 3i)/(1 − 2i) is not finished → −4/5 + 7/5 i',
  },
  {
    id: CX_RULE_IDS.cycle,
    title: 'Powers of i repeat every four',
    body: 'i¹ = i, i² = −1, i³ = −i, i⁴ = 1, then the list starts over. For i^n, reduce n modulo 4 (for a negative n, i^(−n) is the reciprocal, not i^n).',
    example: 'i²³ = i³ = −i; i⁻⁵ = 1/i⁵ = 1/i = −i',
  },
  {
    id: CX_RULE_IDS.sqrtProduct,
    title: '√(−a) · √(−b) = −√(ab)',
    body: 'Each square root of a negative contributes an i, so the product has i² = −1. The shortcut √x · √y = √(xy) does not hold when both x and y are negative.',
    example: '√(−4) · √(−9) = (2i)(3i) = 6i² = −6, not 6',
  },
  {
    id: CX_RULE_IDS.sqrtNeg,
    title: '√(−c) = i√c',
    body: 'The square root of a negative number is imaginary. Factor out the perfect square, then write i times the real square root. Leaving i out makes a real number the original expression is not.',
    example: '√(−48) = √48 · i = 4i√3, not 4√3',
  },
  {
    id: CX_RULE_IDS.discriminant,
    title: 'A negative discriminant means complex roots',
    body: 'The quadratic formula uses √(b² − 4ac). When that discriminant is negative, the square root is imaginary and the roots are a conjugate pair. Taking the opposite of the discriminant invents two real roots.',
    example: 'x² − 4x + 13 = 0 has D = −36, so x = 2 ± 3i, not 5 and −1',
  },
  {
    id: CX_RULE_IDS.pair,
    title: 'Non-real zeros come in conjugate pairs',
    body: 'If a polynomial has real coefficients and a + bi is a zero, then a − bi is a zero too. The pair gives a quadratic factor with real coefficients; divide that out to find the rest.',
    example: 'f(x) = x³ − 5x² + 17x − 13 with a zero 2 + 3i has zeros 1, 2 + 3i, and 2 − 3i',
  },
  {
    id: CX_RULE_IDS.formula,
    title: 'Divide −b and the square root by 2a',
    body: 'The quadratic formula is x = (−b ± √D) / (2a). The whole numerator, not only the square root, is divided by 2a.',
    example: 'x² − 4x + 13 = 0 → (4 ± 6i)/2 = 2 ± 3i, not 4 ± 3i',
  },
]
