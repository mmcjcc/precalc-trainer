/**
 * Rule cards for right triangle trigonometry. They stay on the module page and in the hints while she answers, so
 * they give the method in words and letters. The only numbers are the names of the special triangles (30°, 45°, 60°,
 * 90°) and √2, √3, which no template asks for on its own: no side or angle a template generates is 30, 45, 60 or 90,
 * and no side is √2 or √3 alone.
 */
import type { RuleCard } from '@/content/types'

export const RT_RULE_IDS = {
  soh: 'rt-soh-cah-toa',
  reciprocal: 'rt-reciprocal',
  pythag: 'rt-third-side',
  special45: 'rt-special-45',
  special30: 'rt-special-30',
  side: 'rt-side',
  angle: 'rt-angle',
  elevation: 'rt-elevation',
} as const

export const RT_RULES: RuleCard[] = [
  {
    id: RT_RULE_IDS.soh,
    title: 'SOH CAH TOA',
    body: 'Name the sides from the acute angle θ: the hypotenuse is across from the right angle, the opposite side is across from θ, and the adjacent side is the leg that touches θ. Then sin θ = opposite/hypotenuse, cos θ = adjacent/hypotenuse and tan θ = opposite/adjacent.',
    example: 'SOH: sin = opposite/hypotenuse. CAH: cos = adjacent/hypotenuse. TOA: tan = opposite/adjacent.',
  },
  {
    id: RT_RULE_IDS.reciprocal,
    title: 'The reciprocal ratios',
    body: 'csc θ, sec θ and cot θ are sin θ, cos θ and tan θ turned upside down: csc θ = hypotenuse/opposite, sec θ = hypotenuse/adjacent and cot θ = adjacent/opposite. Rationalize a square root in the denominator.',
    example: 'csc θ = hypotenuse/opposite',
  },
  {
    id: RT_RULE_IDS.pythag,
    title: 'The third side',
    body: 'a² + b² = c², where c is the hypotenuse, the longest side. Two legs: add their squares and take the square root. A leg and the hypotenuse: subtract the leg’s square from the hypotenuse’s square, then take the square root. Leave a radical in simplest form.',
    example: 'a leg = √(c² − a²)',
  },
  {
    id: RT_RULE_IDS.special45,
    title: 'The 45°-45°-90° triangle',
    body: 'The two legs are equal, and the hypotenuse is a leg times √2. Going down from the hypotenuse to a leg, divide by √2 and rationalize the denominator.',
    example: 'hypotenuse = leg · √2',
  },
  {
    id: RT_RULE_IDS.special30,
    title: 'The 30°-60°-90° triangle',
    body: 'The short leg is across from the 30° angle. The hypotenuse is twice the short leg, and the long leg, across from the 60° angle, is the short leg times √3. Going down to the short leg, halve the hypotenuse or divide the long leg by √3.',
    example: 'long leg = short leg · √3; hypotenuse = twice the short leg',
  },
  {
    id: RT_RULE_IDS.side,
    title: 'A side from an angle and a side',
    body: 'From the angle you know, name the side you know and the side you want, and pick the ratio that uses those two: SOH CAH TOA. Write it as an equation and solve it: multiply when the side you want is on top, divide when it is underneath. Set the calculator to DEGREE mode first.',
    example: 'sin θ = x/h, so x = h · sin θ',
  },
  {
    id: RT_RULE_IDS.angle,
    title: 'An angle from two sides',
    body: 'From the angle you want, name the two sides you know and pick the ratio that uses them. Undo it with the inverse function: sin⁻¹, cos⁻¹ or tan⁻¹ (2nd SIN, 2nd COS and 2nd TAN on the TI-84), in DEGREE mode.',
    example: 'tan θ = a/b, so θ = tan⁻¹(a/b)',
  },
  {
    id: RT_RULE_IDS.elevation,
    title: 'Elevation and depression',
    body: 'An angle of elevation is measured up from the horizontal; an angle of depression is measured down from the horizontal, never from the vertical. Looking down from a high point at an angle of depression, the angle of elevation looking back up from the low point is the same angle.',
    example: 'the angle of depression at the top = the angle of elevation at the bottom',
  },
]
