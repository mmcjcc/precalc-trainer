/**
 * opt.numbers: two numbers with a condition (a sum, a sum with a multiple, or how far apart they are), and either
 * their product as large (or, for numbers a given distance apart, as small) as possible, or the sum of their squares
 * as small as possible.
 */
import type { Rng } from '@/content/rng'
import { q } from '@/engine/optim'
import { optCalc } from './calc'
import { evalQuadratic, finalQuadratic, lineEquation, primaryEquation, solve, type Line, type OptModel } from './model'
import type { LineSlip, ObjectiveSlip, OptDraft, OptWords } from './parts'
import { OPT_RULE_IDS } from './rules'
import { m, qTex, quadText } from './text'
import { allClean, HINT_EQ_SECONDARY, HINT_PLAIN_EXACT, HINT_PLAIN_ROUNDED, plainLetter, primaryHint, roundingSentence } from './words'

/** sum: x + y = s. twice: 2x + y = s. thrice: x + 3y = s. apart: x − y = s (the first is s more than the second). */
export type NumbersCondition = 'sum' | 'twice' | 'thrice' | 'apart'
export type NumbersGoal = 'product' | 'squares'

export interface NumbersOptions {
  condition: NumbersCondition
  goal: NumbersGoal
  s: number
  places: number | null
}

const CONDITION: Record<NumbersCondition, { line: (s: number) => Line; words: (s: string) => string; swapped?: { line: (s: number) => Line; text?: (s: number) => string; witness: (s: string) => string } }> = {
  sum: { line: (s) => ({ a: q(1), b: q(1), c: q(s) }), words: (s) => `Two numbers have a sum of ${s}.` },
  twice: {
    line: (s) => ({ a: q(2), b: q(1), c: q(s) }),
    words: (s) => `Twice a first number plus a second number is ${s}.`,
    swapped: { line: (s) => ({ a: q(1), b: q(2), c: q(s) }), witness: () => 'Your equation doubles the second number. The problem doubles the first: twice the first, plus the second.' },
  },
  thrice: {
    line: (s) => ({ a: q(1), b: q(3), c: q(s) }),
    words: (s) => `A first number plus three times a second number is ${s}.`,
    swapped: { line: (s) => ({ a: q(3), b: q(1), c: q(s) }), witness: () => 'Your equation triples the first number. The problem triples the second: the first, plus three times the second.' },
  },
  apart: {
    line: (s) => ({ a: q(1), b: q(-1), c: q(s) }),
    words: (s) => `The first of two numbers is ${s} more than the second.`,
    swapped: {
      line: (s) => ({ a: q(-1), b: q(1), c: q(s) }),
      // As she would write it: the second minus the first.
      text: (s) => `y - x = ${s}`,
      witness: (s) => `Your equation makes the second number the larger one. The problem says the first is ${s} more than the second.`,
    },
  },
}

/** The draft for one numbers problem (exported for the hand-worked tests). */
export function numbersDraft(o: NumbersOptions): OptDraft {
  const c = CONDITION[o.condition]
  const line = c.line(o.s)
  const squares = o.goal === 'squares'
  const quantity = squares ? 'S' : 'P'
  const model: OptModel = { line, objective: squares ? { kind: 'squares' } : { kind: 'product', k: q(1) }, quantity }
  const goal: 'max' | 'min' = squares || o.condition === 'apart' ? 'min' : 'max'
  const sol = solve(model)
  const clean = allClean([sol.x, sol.y, sol.value])
  const places = clean ? null : o.places
  const sText = m(String(o.s))
  const what = squares ? 'the sum of their squares' : 'their product'
  const extremePhrase = squares ? 'the smallest sum of squares' : goal === 'max' ? 'the largest product' : 'the smallest product'
  const ask = squares ? 'Find the two numbers that make the sum of their squares as small as possible, and that sum.' : goal === 'max' ? 'Find the two numbers that make their product as large as possible, and that product.' : 'Find the two numbers that make their product as small as possible, and that product.'
  const prompt = `${c.words(sText)} Let $x$ be the first number and $y$ the second, and let $${quantity}$ be ${what}. ${ask}${clean ? '' : ` ${roundingSentence(places)}`}`
  const right = lineEquation(line)
  const primary = primaryEquation(model)
  const slips: LineSlip[] = c.swapped
    ? [
        {
          id: 'opt_coefficients_swapped',
          line: c.swapped.line(o.s),
          ...(c.swapped.text ? { text: c.swapped.text(o.s), tex: c.swapped.text(o.s) } : {}),
          witness: c.swapped.witness(sText),
          why: o.condition === 'apart' ? 'The first number is the larger one.' : 'The multiple belongs to the other number.',
          promise: true,
        },
      ]
    : []
  const objectiveSlips: ObjectiveSlip[] = []
  const hint = places === null ? HINT_PLAIN_EXACT : HINT_PLAIN_ROUNDED
  const words: OptWords = {
    quantity: squares ? 'sum of the squares' : 'product',
    extremePhrase,
    letters: { x: plainLetter('x'), y: plainLetter('y') },
    bestAsk: { x: `What value of $x$ gives ${extremePhrase}?`, y: `What value of $y$ gives ${extremePhrase}?` },
    otherAsk: { x: 'What is the second number, $y$?', y: 'What is the first number, $x$?' },
    maxLabel: squares ? 'Smallest sum of squares' : goal === 'max' ? 'Largest product' : 'Smallest product',
    maxAsk: `What is ${extremePhrase}?`,
    maxDim: 'none',
    maxUnitRequired: false,
    maxUnitForms: () => [],
    maxShow: (v) => `$${qTex(v)}$`,
    numberHint: { best: hint, other: hint, max: hint },
  }
  const final = finalQuadratic(model, 'x')
  // Where the numbers make sense for the picture: both positive for a sum, a stretch either side of the turn for
  // numbers a given distance apart.
  const domain: { x: [number, number]; y: [number, number] } =
    o.condition === 'apart' ? { x: [-o.s / 2, (3 * o.s) / 2], y: [(-3 * o.s) / 2, o.s / 2] } : { x: [0, o.s / num(line.a)], y: [0, o.s / num(line.b)] }
  const window = domain.x
  const ends: [number, number] = [num(evalQuadratic(final, q(Math.round(window[0])))), num(evalQuadratic(final, q(Math.round(window[1]))))]
  return {
    question: 'numbers',
    model,
    goal,
    prompt,
    instructions: `Write the secondary equation (the condition), the primary equation (${what}), and the final equation in one variable. Then find the numbers and ${extremePhrase}. Each part opens when the one before it is right.`,
    domain,
    units: {},
    places,
    words,
    secondary: {
      ask: 'Write the secondary equation: the condition on $x$ and $y$.',
      nudge:
        o.condition === 'apart'
          ? 'Turn the sentence into an equation. “More than” is about a difference: which number is the larger one?'
          : 'Turn the sentence into an equation in $x$ and $y$: a sum is the two added, and “twice” or “three times” multiplies the number it goes with.',
      reveal: [
        o.condition === 'apart'
          ? `The first minus the second is ${sText}: $${right.tex}$.`
          : o.condition === 'sum'
            ? `The two numbers add up to ${sText}: $${right.tex}$.`
            : `In symbols: $${right.tex}$.`,
      ],
      formatHint: HINT_EQ_SECONDARY,
      rightNote: 'Right: that is the condition.',
      wrongNote: 'That is not the sentence of the problem. Read it again, one piece at a time.',
      forms: [right.text],
      slips,
      extra: [
        {
          id: 'opt_primary_secondary_swapped',
          text: primary.text,
          witness: `That is the primary equation, ${what}. The secondary equation is the condition in the first sentence, with no $${quantity}$ in it.`,
          promise: false,
        },
      ],
    },
    primary: {
      ask: `Write the primary equation: ${squares ? 'the sum of the squares $S$' : 'the product $P$'} in terms of $x$ and $y$.`,
      nudge: squares ? 'Square each number, then add the squares.' : 'The product of two numbers is one times the other.',
      reveal: [squares ? `Square each number and add: $${primary.tex}$.` : `One number times the other: $${primary.tex}$.`],
      formatHint: primaryHint(quantity),
      rightNote: squares ? 'Right: that is the sum of the squares.' : 'Right: that is the product.',
      wrongNote: squares ? 'That is not the sum of the squares of x and y.' : 'That is not the product of x and y.',
      slips: objectiveSlips,
      extra: [
        {
          id: 'opt_primary_secondary_swapped',
          text: right.text,
          witness: `That is the secondary equation, the condition. The primary equation says what $${quantity}$ is.`,
          promise: false,
        },
        ...(squares
          ? [
              {
                id: 'opt_binomial_square' as const,
                text: 'S = (x + y)^2',
                witness: 'Your $S$ squares the sum of the numbers. The sum of the squares squares each number first, then adds.',
                promise: true,
              },
            ]
          : []),
      ],
    },
    ruleCards: [OPT_RULE_IDS.numbers, OPT_RULE_IDS.equations, OPT_RULE_IDS.final, OPT_RULE_IDS.vertex, OPT_RULE_IDS.readBack],
    calc: optCalc({ final, goal, xWindow: window, value: sol.value, ends, quantityWords: squares ? 'the sum of the squares' : 'the product', inputWords: 'the x' }),
    calcExpr: quadText(final, 'x').text,
  }
}

const num = (v: { n: number; d: number }) => v.n / v.d

export function drawNumbers(rng: Rng): OptDraft {
  const roll = rng.int(0, 99)
  let condition: NumbersCondition
  let goal: NumbersGoal
  if (roll < 22) [condition, goal] = ['sum', 'product']
  else if (roll < 40) [condition, goal] = ['twice', 'product']
  else if (roll < 54) [condition, goal] = ['thrice', 'product']
  else if (roll < 72) [condition, goal] = ['apart', 'product']
  else if (roll < 86) [condition, goal] = ['sum', 'squares']
  else [condition, goal] = ['twice', 'squares']
  // Sizes that keep every answer at least 5 away from 0.
  const s =
    condition === 'apart'
      ? 2 * rng.int(5, 40)
      : condition === 'twice' && goal === 'product'
        ? rng.chance(0.7) ? 4 * rng.int(5, 40) : 2 * rng.int(10, 80)
        : condition === 'thrice'
          ? rng.chance(0.7) ? 6 * rng.int(3, 25) : 2 * rng.int(9, 75)
          : condition === 'twice'
            ? rng.chance(0.7) ? 5 * rng.int(5, 30) : rng.int(25, 150)
            : 2 * rng.int(10, 80)
  const places = rng.chance(0.5) ? null : rng.pick([1, 2] as const)
  return numbersDraft({ condition, goal, s, places })
}
