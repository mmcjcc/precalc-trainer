import { TR_RULE_IDS } from './rules'

/** Hint rung 1. Never states the answer. */
export const TR_NUDGE: Record<string, string> = {
  'shift-right': 'Look at the number inside f with x. The sign does the opposite of what it looks like: a minus inside means the graph moves right.',
  'shift-left': 'Look at the number inside f with x. A plus inside means the graph moves left.',
  unfactored: 'A number is multiplying x inside f, and another number is being subtracted. Factor the multiplier out before you decide how far it shifts.',
  'h-compress': 'A number bigger than 1 multiplying x inside f squeezes the graph toward the y-axis. The factor is 1 over that number.',
  'h-stretch': 'A fraction multiplying x inside f spreads the graph away from the y-axis. The stretch factor is 1 over that fraction.',
  'reflect-x': 'There is a minus sign in front of f. That flips the graph over one of the axes. Which axis depends on where the minus sits.',
  'reflect-y': 'There is a minus sign on x inside f. That flips the graph over one of the axes. Which axis depends on where the minus sits.',
  'v-stretch': 'The number in front of f multiplies every height. Bigger than 1 means a vertical stretch by that number.',
  'v-compress': 'A fraction in front of f multiplies every height by that fraction. That is a vertical compression, not a stretch.',
  'v-order': 'For the y-coordinate, the number in front of f acts before the number added after it. Multiply first, then shift. The minus also flips the point.',
  'h-order': 'For the x-coordinate, undo the inside from the outside in: divide by the number on x first, then apply the shift.',
  factors: 'The number in front of f changes y. The number inside with x changes x. They do not trade places.',
}

const CARD: Record<string, string> = {
  'shift-right': TR_RULE_IDS.shift,
  'shift-left': TR_RULE_IDS.shift,
  unfactored: TR_RULE_IDS.factor,
  'h-compress': TR_RULE_IDS.hScale,
  'h-stretch': TR_RULE_IDS.hScale,
  'reflect-x': TR_RULE_IDS.reflect,
  'reflect-y': TR_RULE_IDS.reflect,
  'v-stretch': TR_RULE_IDS.vScale,
  'v-compress': TR_RULE_IDS.vScale,
  'v-order': TR_RULE_IDS.point,
  'h-order': TR_RULE_IDS.point,
  factors: TR_RULE_IDS.point,
}

export function cardsFor(trap: string): { ruleCard: string; ruleCards: string[] } {
  const ruleCard = CARD[trap] ?? TR_RULE_IDS.shift
  const rest = Object.values(TR_RULE_IDS).filter((id) => id !== ruleCard)
  return { ruleCard, ruleCards: [ruleCard, ...rest] }
}
