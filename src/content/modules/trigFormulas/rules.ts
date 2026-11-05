/**
 * Rule cards for sum, difference, double-angle and half-angle formulas.
 * Plain text only: the worked-example reader rejects a backslash command or a dollar sign,
 * and a bare numeral would leak an answer that is that numeral (half-angle tangents can be a whole number).
 */
import type { RuleCard } from '@/content/types'

export const TF_RULES: RuleCard[] = [
  {
    id: 'tf-sum',
    title: 'Sum and difference formulas',
    body:
      'Break the angle into two unit-circle angles (30°, 45°, 60°, 90°) and expand.\n' +
      '• sin(A + B) = sin A cos B + cos A sin B; sin(A − B) = sin A cos B − cos A sin B\n' +
      '• cos(A + B) = cos A cos B − sin A sin B; cos(A − B) = cos A cos B + sin A sin B\n' +
      '• tan(A + B) = (tan A + tan B) / (1 − tan A tan B); tan(A − B) = (tan A − tan B) / (1 + tan A tan B)\n' +
      'csc, sec and cot are the reciprocals of those three.',
    example: 'cos(A − B) = cos A cos B + sin A sin B',
  },
  {
    id: 'tf-double',
    title: 'Double-angle formulas',
    body:
      'From one ratio and the quadrant, the other ratio is the Pythagorean partner, with the quadrant’s sign.\n' +
      '• sin of twice the angle = twice sin θ cos θ\n' +
      '• cos of twice the angle = cos²θ − sin²θ (the squares in that order)\n' +
      '• tan of twice the angle = (twice sin θ cos θ) / (cos²θ − sin²θ)',
    example: 'sin of twice θ = twice the product of sin θ and cos θ',
  },
  {
    id: 'tf-half',
    title: 'Half-angle formulas',
    body:
      'The size comes from cosine of the whole angle. The sign comes from the quadrant the HALF angle lands in, not from the quadrant of θ.\n' +
      '• sin(θ/2) = ±√((1 − cos θ)/2)\n' +
      '• cos(θ/2) = ±√((1 + cos θ)/2)\n' +
      '• tan(θ/2) = ±√((1 − cos θ) / (1 + cos θ))',
    example: 'sin of half the angle uses one minus cosine under the root',
  },
]

export const TF_RULE_IDS = TF_RULES.map((c) => c.id)
