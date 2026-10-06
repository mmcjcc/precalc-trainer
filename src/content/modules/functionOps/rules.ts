import type { FunctionOpsOp, RuleCard } from '@/content/types'

/** Mistake ids this module names, most likely first. A shared value is never a promised trap. */
export const OP_PRIORITY = [
  'op_sign_flipped',
  'op_wrong_function',
  'op_difference_reversed',
  'op_quotient_flipped',
  'op_order_reversed',
  'op_product_for_composition',
  'op_composition_for_product',
  'op_minus_not_distributed',
  'op_inner_not_squared',
  'op_undefined_missed',
] as const

export type OpsMistakeId = (typeof OP_PRIORITY)[number]

export const OPS_RULE_IDS = {
  add: 'ops-add',
  minus: 'ops-minus',
  product: 'ops-product',
  quotient: 'ops-quotient',
  compose: 'ops-compose',
  order: 'ops-order',
  which: 'ops-which',
  sign: 'ops-sign',
  undefined: 'ops-undefined',
  square: 'ops-square',
} as const

export const OPS_RULES: RuleCard[] = [
  {
    id: OPS_RULE_IDS.add,
    title: 'Add the outputs',
    body: '(f + g)(a) is f(a) + g(a). (f + f + g)(a) adds f(a) a second time and then adds g(a).',
    example: 'f(8) + g(8) = 1 + 3 = 4',
  },
  {
    id: OPS_RULE_IDS.minus,
    title: 'Subtract in the order asked',
    body: '(g − f)(a) is g(a) minus f(a). The other order changes the sign. On a formula, the minus sign reaches every term of the function being subtracted.',
    example: 'g(−4) − f(−4) = 4 − (−1) = 5',
  },
  {
    id: OPS_RULE_IDS.product,
    title: 'Side by side means multiply',
    body: '(fg)(a) is f(a) times g(a). (gg)(a) is g(a) times g(a). (fgf)(a) is f(a) times g(a) times f(a). Nothing here is a composition.',
    example: 'g(2) · g(2) = 8 · 8 = 64',
  },
  {
    id: OPS_RULE_IDS.quotient,
    title: 'f/g puts f on top',
    body: '(f/g)(a) is f(a) divided by g(a). If g(a) is 0, the value does not exist. The formula (f/g)(x) can stay unsimplified.',
    example: 'f(1)/g(1) = 0/1 = 0',
  },
  {
    id: OPS_RULE_IDS.compose,
    title: 'The circle means inside first',
    body: '(f ∘ g)(a) is f(g(a)): g first, then f of that result. (f ∘ f)(a) uses f twice. (f ∘ g ∘ g)(a) uses g twice and then f.',
    example: 'g(−5) = −3, then f(−3) = 2',
  },
  {
    id: OPS_RULE_IDS.order,
    title: 'f ∘ g means f on the outside',
    body: '(f ∘ g)(x) puts g inside f. (g ∘ f)(x) is the other order, with g on the outside.',
    example: '(g ∘ f)(x) = 4x^2 + 8x + 3, not 2x^2 + 4x + 1',
  },
  {
    id: OPS_RULE_IDS.which,
    title: 'f and g are different functions',
    body: 'Read the function the question names. f(a) and g(a) are different numbers, even at the same input.',
    example: 'g(−5) = −3, not f(−5) = 4',
  },
  {
    id: OPS_RULE_IDS.sign,
    title: 'Below the x-axis is negative',
    body: 'A point under the x-axis has a negative y-value. A point above the x-axis stays positive. The height without its sign is a different output.',
    example: 'g(3) = −1, not 1',
  },
  {
    id: OPS_RULE_IDS.undefined,
    title: 'Some values do not exist',
    body: 'If the input is not in the table, or the curve has stopped, or a denominator is 0, the value does not exist. The answer is the word undefined.',
    example: 'g(−5) is not on the graph, so (f ∘ g)(−5) is undefined',
  },
  {
    id: OPS_RULE_IDS.square,
    title: 'Square the whole inside',
    body: '(px + q)^2 is p^2 x^2 + 2pq x + q^2. Squaring each term and skipping the middle term is not the square.',
    example: '(8x + 2)^2 = 64x^2 + 32x + 4, not 64x^2 + 4',
  },
]

/** The rule card a named mistake should open. */
export const OPS_RULE_FOR: Record<OpsMistakeId, string> = {
  op_wrong_function: OPS_RULE_IDS.which,
  op_sign_flipped: OPS_RULE_IDS.sign,
  op_difference_reversed: OPS_RULE_IDS.minus,
  op_quotient_flipped: OPS_RULE_IDS.quotient,
  op_order_reversed: OPS_RULE_IDS.order,
  op_product_for_composition: OPS_RULE_IDS.compose,
  op_composition_for_product: OPS_RULE_IDS.product,
  op_undefined_missed: OPS_RULE_IDS.undefined,
  op_minus_not_distributed: OPS_RULE_IDS.minus,
  op_inner_not_squared: OPS_RULE_IDS.square,
}

export function cardForOp(op: FunctionOpsOp): string {
  switch (op) {
    case 'f+g':
    case 'f+f+g':
      return OPS_RULE_IDS.add
    case 'f-g':
    case 'g-f':
      return OPS_RULE_IDS.minus
    case 'fg':
    case 'gg':
    case 'fgf':
      return OPS_RULE_IDS.product
    case 'f/g':
      return OPS_RULE_IDS.quotient
    default:
      return OPS_RULE_IDS.compose
  }
}

const OP_NAME: Record<FunctionOpsOp, string> = {
  'f+g': 'f + g',
  'f-g': 'f − g',
  'g-f': 'g − f',
  fg: 'fg',
  gg: 'gg',
  fgf: 'fgf',
  'f/g': 'f/g',
  'f+f+g': 'f + f + g',
  fog: 'f ∘ g',
  gof: 'g ∘ f',
  fof: 'f ∘ f',
  fogog: 'f ∘ g ∘ g',
}

/** "(f ∘ g)(−5)" or "(f + g)(x)". `at` is already the student-facing input. */
export function opCall(op: FunctionOpsOp, at: string): string {
  return `(${OP_NAME[op]})(${at})`
}

/** Hint rung 1. Names the operation and not the value. */
export function nudgeFor(op: FunctionOpsOp, call: string): string {
  switch (op) {
    case 'f+g':
      return `${call} is f at that input plus g at that input.`
    case 'f-g':
      return `${call} is f at that input minus the whole of g at that input.`
    case 'g-f':
      return `${call} is g at that input minus f at that input, in that order.`
    case 'fg':
      return `${call} means f at that input times g at that input.`
    case 'gg':
      return `${call} means g at that input times itself.`
    case 'fgf':
      return `${call} means f times g times f, all at that input.`
    case 'f/g':
      return `${call} is f at that input divided by g at that input.`
    case 'f+f+g':
      return `${call} is f at that input, plus f at that input again, plus g at that input.`
    case 'fog':
      return `${call} means do g first, then f of that result.`
    case 'gof':
      return `${call} means do f first, then g of that result.`
    case 'fof':
      return `${call} means do f, then f of that result.`
    case 'fogog':
      return `${call} means do g, then g again, then f of that result.`
  }
}

export function promptFor(question: 'table' | 'graph' | 'formula', call: string): string {
  if (question === 'table') return `Find ${call} from the table.`
  if (question === 'graph') return `Find ${call} from the graphs.`
  return `Find ${call}.`
}
