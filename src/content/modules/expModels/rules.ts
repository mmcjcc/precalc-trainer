import type { RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

export const EM_MISTAKE_IDS = [
  'exp_rate_percent',
  'exp_wrong_period',
  'exp_simple_interest',
  'exp_continuous_swapped',
  'exp_exponent_missing_factor',
  'exp_halflife_inverted',
  'exp_halflife_fraction_base',
  'exp_halflife_decayed',
  'exp_growth_no_log',
  'exp_growth_log_diff',
  'exp_growth_swapped',
] as const

export type EmMistakeId = (typeof EM_MISTAKE_IDS)[number]

/** Rule card ids for exponential growth and decay models. */
export const EM_RULE_IDS = {
  compound: 'em-compound-interest',
  continuousInterest: 'em-continuous-interest',
  solveTime: 'em-solve-time',
  halflife: 'em-halflife',
  growthRate: 'em-growth-rate',
  growthPredict: 'em-growth-predict',
} as const

export const EM_RULE_FOR: Partial<Record<ErrorPatternId, string>> = {
  exp_rate_percent: EM_RULE_IDS.compound,
  exp_wrong_period: EM_RULE_IDS.compound,
  exp_simple_interest: EM_RULE_IDS.compound,
  exp_continuous_swapped: EM_RULE_IDS.continuousInterest,
  exp_exponent_missing_factor: EM_RULE_IDS.compound,
  exp_halflife_inverted: EM_RULE_IDS.halflife,
  exp_halflife_fraction_base: EM_RULE_IDS.halflife,
  exp_halflife_decayed: EM_RULE_IDS.halflife,
  exp_growth_no_log: EM_RULE_IDS.growthRate,
  exp_growth_log_diff: EM_RULE_IDS.growthRate,
  exp_growth_swapped: EM_RULE_IDS.growthPredict,
}

export const EM_RULES: RuleCard[] = [
  {
    id: EM_RULE_IDS.compound,
    title: 'Compound interest n times per year',
    body: 'Convert the annual percentage rate to a decimal r before substituting. Divide r by the number of compounding periods per year n, and multiply the exponent by both n and t so the exponent counts the total number of compounding periods.',
    example: 'A = P(1 + r/n)^(n·t), with r in decimal form and n periods per year',
  },
  {
    id: EM_RULE_IDS.continuousInterest,
    title: 'Continuous compounding and doubling time',
    body: 'When interest is compounded continuously, use base e with exponent r·t. To find the time to reach a target balance A (or to double, where A/P = 2), divide by P first and take the natural logarithm of both sides.',
    example: 'A = P·e^(r·t) → t = ln(A/P) / r; for periodic compounding, t = ln(A/P) / (n · ln(1 + r/n))',
  },
  {
    id: EM_RULE_IDS.solveTime,
    title: 'Solving for time with logarithms',
    body: 'Isolate the exponential factor by dividing the final amount by the initial amount before taking a logarithm. Then divide by the coefficient in the exponent.',
    example: 'A / P = (1 + r/n)^(n·t) → n·t = ln(A/P) / ln(1 + r/n) → t = ln(A/P) / (n · ln(1 + r/n))',
  },
  {
    id: EM_RULE_IDS.halflife,
    title: 'Half-life and radioactive decay',
    body: 'In the half-life model, the base is the decay factor per half-life and the exponent is elapsed time t divided by the half-life h. Always use the amount remaining (not the amount that has decayed) in the ratio A/A_0.',
    example: 'A = A_0 · (1/2)^(t/h) ↔ t = h · ln(A/A_0) / ln(1/2) ↔ h = t · ln(1/2) / ln(A/A_0)',
  },
  {
    id: EM_RULE_IDS.growthRate,
    title: 'Finding the continuous growth rate k from two data points',
    body: 'Divide the later population P_1 by the initial population P_0 to get the growth ratio, take the natural logarithm ln(P_1/P_0), and divide by the elapsed time t.',
    example: 'P_1 = P_0 · e^(k·t) → e^(k·t) = P_1/P_0 → k = ln(P_1/P_0) / t',
  },
  {
    id: EM_RULE_IDS.growthPredict,
    title: 'Predicting size vs solving for time in continuous growth',
    body: 'Keep the variables straight: when given a time t, substitute t into the exponent of P_0 · e^(k·t) to predict the population. When given a target population P, set P = P_0 · e^(k·t) and solve for t = ln(P/P_0) / k.',
    example: 'Given t: P = P_0 · e^(k·t); given P: t = ln(P/P_0) / k',
  },
]
