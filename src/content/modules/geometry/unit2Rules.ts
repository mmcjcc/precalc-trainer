/**
 * Rule cards for honors geometry Unit 2. Examples use a square, JK and LM, x = 4, and angle 8
 * measuring 17: none of those is an answer a Unit 2 template generates. The wording never uses a
 * reason's button label or a choice a template can mark correct ("the converse", "It is true.",
 * "Given", "There is no valid conclusion.", and the rest of that list).
 */
import type { RuleCard } from '@/content/types'
import type { GeoMistakeId } from './grade'

export const UNIT2_RULE_IDS = {
  related: 'geo2-related',
  contra: 'geo2-contra',
  biconditional: 'geo2-biconditional',
  counterexample: 'geo2-counterexample',
  detachment: 'geo2-detachment',
  syllogism: 'geo2-syllogism',
  fallacy: 'geo2-fallacy',
  equality: 'geo2-equality',
  congruence: 'geo2-congruence',
  definitions: 'geo2-definitions',
  postulates: 'geo2-postulates',
  theorems: 'geo2-theorems',
} as const

export const UNIT2_RULE_FOR: Partial<Record<GeoMistakeId, string>> = {
  geo_converse_inverse_swapped: UNIT2_RULE_IDS.related,
  geo_false_converse: UNIT2_RULE_IDS.related,
  geo_contrapositive_half: UNIT2_RULE_IDS.contra,
  geo_contrapositive_unswitched: UNIT2_RULE_IDS.contra,
  geo_counterexample_hypothesis: UNIT2_RULE_IDS.counterexample,
  geo_affirm_conclusion: UNIT2_RULE_IDS.fallacy,
  geo_deny_hypothesis: UNIT2_RULE_IDS.fallacy,
  geo_syllogism_order: UNIT2_RULE_IDS.syllogism,
  geo_missed_detachment: UNIT2_RULE_IDS.detachment,
  geo_midpoint_for_addition: UNIT2_RULE_IDS.postulates,
  geo_equality_for_postulate: UNIT2_RULE_IDS.postulates,
  geo_vertical_for_linear: UNIT2_RULE_IDS.postulates,
  geo_addition_for_midpoint: UNIT2_RULE_IDS.definitions,
  geo_congruent_for_midpoint: UNIT2_RULE_IDS.definitions,
  geo_substitution_for_transitive: UNIT2_RULE_IDS.equality,
  geo_reflexive_for_symmetric: UNIT2_RULE_IDS.equality,
  geo_linear_for_vertical: UNIT2_RULE_IDS.theorems,
}

export const LOGIC_RULES: RuleCard[] = [
  {
    id: UNIT2_RULE_IDS.related,
    title: 'Swapping parts and negating parts',
    body: 'An if-then has two related sentences that are easy to mix up. One swaps the two parts and leaves both parts positive. The other keeps the order and negates both parts. They are true or false together, and both can fail while the original if-then holds. A non-square rectangle shows that swapping "if it is a square, then it is a rectangle" does not hold.',
    example: 'If a figure is a square, then it is a rectangle. Swapping the parts fails for a non-square rectangle.',
  },
  {
    id: UNIT2_RULE_IDS.contra,
    title: 'Negate both parts, then swap',
    body: 'The related sentence that keeps the original truth value negates both parts and also swaps their order. Negating only one part, or negating both and leaving the order alone, builds a different sentence.',
    example: 'If a figure is a square, then it is a rectangle. Negate both and swap: if a figure is not a rectangle, then it is not a square.',
  },
  {
    id: UNIT2_RULE_IDS.biconditional,
    title: 'Both directions have to hold',
    body: 'A sentence with "if and only if" holds exactly when the if-then and the swapped if-then are both true. One direction is not enough. "A figure is a square if and only if it is a rectangle" fails because a rectangle need not be a square.',
    example: 'Square if and only if rectangle ✗ → both directions have to hold, and the swapped one fails',
  },
  {
    id: UNIT2_RULE_IDS.counterexample,
    title: 'A counterexample fits the opening',
    body: 'A counterexample makes the opening true and the ending false. A situation that misses the opening does not test the sentence. For a swapped sentence, the opening is the original ending.',
    example: 'If a figure is a square, then it is a rectangle. A triangle misses the opening. A non-square rectangle knocks down the swapped sentence.',
  },
  {
    id: UNIT2_RULE_IDS.fallacy,
    title: 'Two classic bad moves',
    body: 'From an if-then, the ending being true does not give you the opening, and the opening being false does not cross off the ending. A rectangle has four sides without being a square, and a shape that is not a square can still have four sides.',
    example: 'If it is a square, then it has four sides. It has four sides ✗ → you may not decide it is a square',
  },
  {
    id: UNIT2_RULE_IDS.syllogism,
    title: 'Chain through the middle',
    body: 'If the first sentence ends where the second begins, the opening of the first leads to the ending of the second. Reversing that chain, or joining two sentences that only share an ending, does not give a conclusion.',
    example: 'Square leads to rectangle, and rectangle leads to four sides. So four sides lead to a square ✗ → a square leads to four sides',
  },
  {
    id: UNIT2_RULE_IDS.detachment,
    title: 'The opening was handed to you',
    body: 'When an if-then is on the table and you are also told that its opening happened, the ending follows. Saying that nothing follows leaves out a conclusion you were allowed to draw.',
    example: 'If it is a square, then it has four sides. It is a square. Nothing follows ✗ → it has four sides',
  },
]

export const PROOF_RULES: RuleCard[] = [
  {
    id: UNIT2_RULE_IDS.equality,
    title: 'Equality moves',
    body: 'Swapping the two sides of an equality is not the same as saying a quantity equals itself: JK = LM can be rewritten with the sides the other way. Chaining two equalities that share a middle quantity is its own move: if JK = LM and LM = 17, then JK = 17 because both equal the middle. When you are asked to name the move for a single chain like that, name the chaining property. Inside a longer proof, many books call that same step substitution, and either name is accepted there.',
    example: 'JK = LM, so JK = JK ✗ → LM = JK',
  },
  {
    id: UNIT2_RULE_IDS.congruence,
    title: 'Congruence moves',
    body: 'Congruence swaps and chains the same way equality does. Writing an angle congruent to itself is not the same as reversing a congruence you already had. A chain of two congruences uses the middle angle twice.',
    example: 'Angle JKL is congruent to angle 8, so angle 8 is congruent to itself ✗ → angle 8 is congruent to angle JKL',
  },
  {
    id: UNIT2_RULE_IDS.definitions,
    title: 'Definitions say what the word means',
    body: 'A midpoint is the point that divides a segment into two congruent segments, so the two pieces also have the same length. Until a line says the pieces are congruent, the midpoint itself is the reason they are equal. Congruent segments are segments with equal lengths: that meaning turns a congruence already written in the proof into equal lengths, or equal lengths into a congruence. A right angle measures 90 degrees, and perpendicular lines meet to form right angles. M the midpoint of JK means JM and MK match, not merely that they add to JK.',
    example: 'M is the midpoint of JK. Next line: JM = MK because congruent segments have equal lengths ✗ → JM = MK because M is the midpoint of JK',
  },
  {
    id: UNIT2_RULE_IDS.postulates,
    title: 'Postulates about pieces',
    body: 'If a point lies between the endpoints of a segment, the two pieces add to the whole segment. If a ray lies inside an angle, the two pieces add to the whole angle. Two angles that sit side by side and make a straight line add to 180. Those facts come from the figure. They are not the move that adds the same number to both sides of an equation, and the pieces are not automatically the same length.',
    example: 'K is between J and L, so JK = KL ✗ → JK + KL = JL',
  },
  {
    id: UNIT2_RULE_IDS.theorems,
    title: 'Theorems you may quote',
    body: 'Opposite angles made by two crossing lines match each other. Two angles that are supplements of the same angle match each other, and the same idea works for complements. Every right angle matches every other right angle. Opposite angles are not the pair that makes a straight line.',
    example: 'Angle 8 and the angle across the crossing are called a straight pair ✗ → those opposite angles match',
  },
]
