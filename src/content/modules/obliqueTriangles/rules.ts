/**
 * Rule cards for oblique triangles, one per idea, in our own words. They stay on the module page and in the hints
 * while she answers, so they give the method in letters. Their only numbers are 180° and 90° and the example angles
 * 10°, 12°, 158° and 168°, which no problem draws (every angle drawn is from 15° to 150°): OT_RESERVED_ANGLES, tested.
 */
import type { RuleCard } from '@/content/types'

/** The example angles on the cards and in the catalog: never a given angle and never an answer. */
export const OT_RESERVED_ANGLES = [10, 12, 158, 168] as const

export const OT_RULE_IDS = {
  third: 'ot-third-angle',
  sines: 'ot-law-of-sines',
  ambiguous: 'ot-ambiguous-case',
  supplement: 'ot-sine-supplement',
  cosines: 'ot-law-of-cosines',
  cosAngle: 'ot-cosines-angle',
  areaSas: 'ot-area-sas',
  heron: 'ot-heron',
  which: 'ot-which-law',
} as const

export const OT_RULES: RuleCard[] = [
  {
    id: OT_RULE_IDS.third,
    title: 'The third angle',
    body: 'The three angles of a triangle add to 180°. With two angles known, subtract both from 180° to get the third, before the law of sines needs it.',
    example: 'A = 12° and B = 10°, so C = 180° − 12° − 10° = 158°.',
  },
  {
    id: OT_RULE_IDS.sines,
    title: 'The law of sines',
    body: 'Each side divided by the sine of the angle across from it gives the same number: a/sin A = b/sin B = c/sin C. Start from a pair you know completely, an angle and the side across from it, and solve for the side or angle you want. Work in DEGREE mode.',
    example: 'b = a · sin B / sin A',
  },
  {
    id: OT_RULE_IDS.ambiguous,
    title: 'The ambiguous case (SSA)',
    body: 'Given an acute angle A, the side b next to it and the side a across from it, work out the height h = b sin A from C down to the base. If a is shorter than h, side a cannot reach: no triangle. If a is longer than h but shorter than b, it reaches in two places: two triangles. If a is at least as long as b, it reaches in one place: one triangle.',
    example: 'a < h: none. h < a < b: two. a ≥ b: one.',
  },
  {
    id: OT_RULE_IDS.supplement,
    title: 'Two angles with the same sine',
    body: 'An angle B and its supplement 180° − B have the same sine, and sin⁻¹ only ever gives the acute one. When the triangle’s angle is obtuse (the second triangle of the ambiguous case), subtract the calculator’s angle from 180°.',
    example: 'sin 12° = sin 168°',
  },
  {
    id: OT_RULE_IDS.cosines,
    title: 'The law of cosines',
    body: 'For two sides a and b and the angle C between them, the third side comes from c² = a² + b² − 2ab cos C. Multiply 2ab by cos C before subtracting, and take the square root at the end. When C is obtuse its cosine is negative, so the last term adds.',
    example: 'c = √(a² + b² − 2ab cos C)',
  },
  {
    id: OT_RULE_IDS.cosAngle,
    title: 'An angle from three sides',
    body: 'Solve the law of cosines for the angle: cos C = (a² + b² − c²)/(2ab), where c is the side across from C. Then C = cos⁻¹ of that, in DEGREE mode. The largest angle is across from the longest side; a negative cosine means it is obtuse, and cos⁻¹ gives that obtuse angle directly.',
    example: 'C = cos⁻¹((a² + b² − c²)/(2ab))',
  },
  {
    id: OT_RULE_IDS.areaSas,
    title: 'Area from two sides and the angle between them',
    body: 'The height on side a is b sin C, so the area is half of a times that: area = ½ab sin C. The angle must be the one between the two sides you use.',
    example: 'area = ½ab sin C',
  },
  {
    id: OT_RULE_IDS.heron,
    title: 'Heron’s formula',
    body: 'From three sides: first the semi-perimeter, half the perimeter, s = (a + b + c)/2. Then the area is √(s(s − a)(s − b)(s − c)).',
    example: 'area = √(s(s − a)(s − b)(s − c)), with s = (a + b + c)/2',
  },
  {
    id: OT_RULE_IDS.which,
    title: 'Which law starts?',
    body: 'An angle and the side across from it known, or two angles and any side (AAS, ASA), or two sides and an angle across from one of them (SSA): the law of sines. Two sides and the angle between them (SAS), or three sides (SSS): the law of cosines. A right angle: neither law is needed, the Pythagorean theorem and SOH CAH TOA do it.',
    example: 'AAS, ASA, SSA: sines. SAS, SSS: cosines. A right angle: SOH CAH TOA.',
  },
]
