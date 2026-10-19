/**
 * Rule cards for exponential growth and decay word problems. Letters only: a generated answer is a number,
 * and these cards stay on screen while she can still answer.
 */
import type { RuleCard } from '@/content/types'

export const EM_RULE_IDS = {
  compound: 'em-compound',
  continuous: 'em-continuous',
  time: 'em-solve-time',
  halfLife: 'em-half-life',
  growth: 'em-growth',
} as const

export const EM_RULES: RuleCard[] = [
  {
    id: EM_RULE_IDS.compound,
    title: 'Compound interest',
    body: 'A = P(1 + r/n)^(nt): P is the amount invested, r the yearly rate as a decimal, n the number of times a year it compounds (annually 1, semiannually 2, quarterly 4, monthly 12), and t the number of years. The exponent nt counts every compounding.',
    example: 'r% compounded quarterly: P(1 + r/100/4)^(4t)',
  },
  {
    id: EM_RULE_IDS.continuous,
    title: 'Compounded continuously',
    body: 'When the problem says continuously, the base is e: A = Pe^(rt), with r as a decimal. Simple interest P(1 + rt) is neither: it never earns interest on interest.',
    example: 'P dollars at r% continuously: A = Pe^(r/100 · t)',
  },
  {
    id: EM_RULE_IDS.time,
    title: 'Solving for the time',
    body: 'Put the numbers in, divide both sides by the starting amount so the power is alone, then take ln of both sides: the exponent comes down in front. Divide by what multiplies t. Doubling means the amount is 2 times the start; halving, 1/2 times.',
    example: '(1 + r/n)^(nt) = A/P → nt·ln(1 + r/n) = ln(A/P)',
  },
  {
    id: EM_RULE_IDS.halfLife,
    title: 'Half-life',
    body: 'A = A₀(1/2)^(t/h): A₀ is the starting amount, h the half-life, and t/h the number of half-lives that have passed. A is the amount still left. The base stays 1/2; the fraction left is what the power equals. Carbon-14 has a half-life of 5730 years.',
    example: 'q of it left: (1/2)^(t/h) = q → t = h·ln(q)/ln(1/2)',
  },
  {
    id: EM_RULE_IDS.growth,
    title: 'Continuous growth: P = P₀e^(kt)',
    body: 'Put in the two counts and the time, divide by P₀, then take ln: kt = ln(P/P₀), so k = ln(P/P₀)/t. To predict, put the time into P₀e^(kt). To find when it reaches a size, set P to that size and solve the same way for t.',
    example: 'P₀e^(kt) = P → k = ln(P/P₀)/t',
  },
]
