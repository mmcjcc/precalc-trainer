/**
 * Rule cards for chemical reactions, in our own words. They show on hint rung 2 while she can
 * still answer, so no card may single out an answer: every worked example uses the reserved
 * species of facts.ts (lithium, fluorine, nickel, tin, strontium, butane), which no template
 * draws; counts are written in words; formulas a template can ask for never appear; a card that
 * must name the five reaction types names all five together (a complete listing singles out none).
 */
import type { RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import type { RxType } from './facts'

/** The five reaction types, as the choice buttons print them (the id is the text). */
export const TYPE_TEXT: Readonly<Record<RxType, string>> = {
  combination: 'Combination',
  decomposition: 'Decomposition',
  single: 'Single replacement',
  double: 'Double replacement',
  combustion: 'Combustion',
}

export const TYPE_ORDER: readonly RxType[] = ['combination', 'decomposition', 'single', 'double', 'combustion']

export const BALANCED_TEXT = {
  yes: 'Balanced',
  no: 'Not balanced',
} as const

/** The off-element part's extra choice, for an equation that already balances. */
export const NONE_OFF = 'None of them'

export const REACTS_TEXT = {
  yes: 'Reacts',
  no: 'No reaction',
} as const

export const RX_RULES: readonly RuleCard[] = [
  {
    id: 'rx.count',
    title: 'Counting atoms in a term',
    body: 'A coefficient in front counts whole formula units, so it multiplies every atom in the formula, not just the first. A subscript after a closing parenthesis multiplies everything inside the parentheses. A subscript right after a symbol counts only that element. Multiply the numbers that stack on an atom; adding them never counts anything.',
    example: 'the O atoms in 4Sr(NO₃)₂ counted as six ✗ → the four reaches every atom and the two reaches all of NO₃: twenty-four',
  },
  {
    id: 'rx.balance',
    title: 'Balancing with coefficients',
    body: 'Atoms are neither made nor destroyed, so each element must show the same number of atoms on both sides of the arrow. Change only the coefficients in front; a subscript belongs to the formula and changing it makes a different substance. Use the lowest whole numbers that work, and here every substance gets its number written out, a one included.',
    example: 'four Li, two F₂, four LiF ✗ → every number halves: 2Li + F₂ → 2LiF',
  },
  {
    id: 'rx.types',
    title: 'Five kinds of reaction',
    body: 'Combination: two or more substances join into one. Decomposition: one substance breaks into two or more. Single replacement: an element takes the place of another element in a compound. Double replacement: two compounds trade partners. Combustion: a compound of carbon and hydrogen burns in oxygen gas. (An element burning in oxygen joins into one product, so this app files it under combination.)',
    example: 'Ni + Sn(NO₃)₂ → Ni(NO₃)₂ + Sn called a trade between two compounds ✗ → a lone element swapped in: one replacement',
  },
  {
    id: 'rx.activity',
    title: 'The activity series decides',
    body: 'A lone metal pushes another metal (or hydrogen) out of a compound only when it sits higher on the list. Most active first: potassium, calcium, sodium, magnesium, aluminum, zinc, iron, nickel, tin, lead, hydrogen, copper, silver, gold. Only the top three — potassium, calcium and sodium — push hydrogen out of cold water. Halogens follow their own order: fluorine, chlorine, bromine, iodine; a halogen pushes out any one below it. Lower on the list means nothing happens.',
    example: 'tin dropped into Ni(NO₃)₂ said to react ✗ → nickel sits above tin, so nothing happens',
  },
  {
    id: 'rx.diatomic',
    title: 'Seven elements travel in pairs',
    body: 'On its own, a free element is written as its symbol: a metal as a single atom. Seven elements are the exception and always appear as two-atom molecules when free: hydrogen, nitrogen, oxygen, fluorine, chlorine, bromine and iodine. Inside a compound they count like any other atom; the pairing is only for the free element.',
    example: 'free fluorine written as a lone F ✗ → F₂, two atoms bonded together',
  },
  {
    id: 'rx.ionic',
    title: 'A product formula from the charges',
    body: 'When a metal and a nonmetal combine, or when ions trade partners, the product is an ionic compound: find each ion with its charge, then take the fewest of each so the charges add up to zero. A polyatomic ion stays whole and gets parentheses when more than one is needed.',
    example: 'Sr²⁺ with F⁻ written SrF ✗ → two fluoride ions balance one strontium ion: SrF₂',
  },
  {
    id: 'rx.double',
    title: 'Double replacement: partners trade',
    body: 'In a double replacement the cation of each compound leaves with the anion of the other. Write each new pairing with its own charge balance; neither product is one of the starting compounds. Often one new pairing will not dissolve and drops out as a solid, a precipitate, marked (s).',
    example: 'SrCl₂ + Li₂SO₄ giving back SrCl₂ ✗ → strontium pairs with sulfate and lithium with chloride: SrSO₄ and LiCl',
  },
  {
    id: 'rx.combustion',
    title: 'Complete combustion',
    body: 'When a compound of carbon and hydrogen burns completely in oxygen gas, every carbon atom leaves in carbon dioxide and every hydrogen atom leaves in water. Those two are always the products, whatever the fuel; the fuel only changes the coefficients.',
    example: 'butane, C₄H₁₀, said to burn into soot and CO ✗ → its carbon leaves as carbon dioxide and its hydrogen as water',
  },
  {
    id: 'rx.word',
    title: 'From words to a skeleton equation',
    body: 'Write each named substance as its formula: an element as its free form (the seven pair-forming elements with a two), a compound from its name with the naming rules of chapter 7. Reactants go on the left of the arrow, products on the right. Coefficients come later; a skeleton equation is only the formulas.',
    example: 'lithium + fluorine gas → lithium fluoride written Li + F → LiF ✗ → Li + F₂ → LiF',
  },
]

const RULE_INDEX = new Map(RX_RULES.map((card) => [card.id, card]))

export function rxRule(id: string): RuleCard {
  const card = RULE_INDEX.get(id)
  if (!card) throw new Error(`missing reactions rule card ${id}`)
  return card
}

/** Which card to put first when she hits this slip. */
export const RX_RULE_FOR: Partial<Record<ErrorPatternId, string>> = {
  rx_coef_first_only: 'rx.count',
  rx_paren_first_only: 'rx.count',
  rx_add_not_multiply: 'rx.count',
  rx_not_lowest: 'rx.balance',
  rx_element_unbalanced: 'rx.balance',
  rx_combo_decomp_swapped: 'rx.types',
  rx_single_double_swapped: 'rx.types',
  rx_activity_backwards: 'rx.activity',
  rx_diatomic_single: 'rx.diatomic',
  rx_not_swapped: 'rx.double',
  rx_combustion_products: 'rx.combustion',
  nm_charges_unbalanced: 'rx.ionic',
  nm_crisscross_reversed: 'rx.ionic',
  nm_not_lowest_ratio: 'rx.ionic',
  nm_parentheses_missing: 'rx.ionic',
}
