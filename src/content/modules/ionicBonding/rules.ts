/**
 * Rule cards for ionic and metallic bonding. Shown on hint rung 2, while she can still answer,
 * so no body or example may hold an answer a template can ask for: counts are written in words,
 * and the worked species are francium and radium, which the chapter 8 draw never uses.
 */
import type { IbScenario, MbAsk, RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

/** The two directions of the lose-or-gain choice. The id is the text, like the periodic why texts. */
export const GAIN_LOSE_TEXT = {
  lose: 'Hand electrons over',
  gain: 'Pull electrons in',
} as const

/** What the dots of an electron-dot symbol stand for. */
export const DOTS_STAND_TEXT = {
  valence: 'Only the electrons of the outermost shell',
  all: 'Every electron the atom owns',
  moved: 'The electrons it would hand over or pull in',
} as const

/** The right explanation for each ionic-compound scenario. */
export const PROPS_CORRECT: Record<IbScenario, string> = {
  melt: 'Every ion is gripped by its neighbors in all directions, so tearing the lattice apart takes a huge amount of energy',
  brittle: 'A struck layer shifts, like charges meet face to face, and the repulsion splits the crystal',
  conduct: 'In the solid the ions are locked into the lattice; melting frees the ions to move and carry the current',
  dissolve: 'Water pries the ions out of the lattice, and the freed ions carry the current through the solution',
}

/** The standing misconceptions offered beside the right explanation. */
export const PROPS_WRONG = {
  electrons: 'Loose electrons drift through the solid and carry charge between the ions',
  molecules: 'It is made of small separate molecules that slip past one another',
  weak: 'The attractions between its ions are weak and easily broken',
} as const

/** The right electron-sea explanation for each metallic behaviour. */
export const SEA_CORRECT: Record<MbAsk, string> = {
  conduct: 'Its outer electrons belong to the whole piece and drift along it when pushed',
  bend: 'The positive centers slide past one another while the shared electrons keep holding the piece together',
  alloy: 'The shared electrons bond whatever metal atoms sit in the crystal, so atoms of another size can mix in',
  contrast: 'The metal’s moving charges are shared electrons; the crystal’s charges are ions that cannot leave their places',
}

/** The standing misconceptions offered beside the electron-sea answer. */
export const SEA_WRONG = {
  fixed: 'Each atom keeps its own electrons tightly at home',
  ionic: 'The metal is a lattice of positive and negative ions held in place',
} as const

export const IB_RULES: readonly RuleCard[] = [
  {
    id: 'ib.octet',
    title: 'Count the outer shell, then aim for a noble gas',
    body: 'Valence electrons are the electrons of the highest shell only — a filled d subshell underneath is not part of the count. An atom of this chapter moves just enough of them to match the nearest noble gas: a full outer shell.',
    example: 'Fr keeps its single outer electron ✗ → it sheds it to match the noble gas before it',
  },
  {
    id: 'ib.ion',
    title: 'The charge comes from the move',
    body: 'Each electron that leaves takes one minus away, so the atom ends up positive by exactly the number it shed. Each electron that arrives brings one minus, so the atom ends up negative by the number it collected. Write the symbol with that charge.',
    example: 'Ra sheds its pair and is written with a minus ✗ → the minuses left, so the ion is positive',
  },
  {
    id: 'ib.config',
    title: 'The ion wears the new configuration',
    body: 'Write the configuration of the ion as it is after the move, not of the atom it came from. A simple ion of this chapter matches a noble gas, so its noble-gas shorthand is short.',
    example: 'Fr⁺ written with the atom’s own configuration ✗ → drop the electron it handed over first',
  },
  {
    id: 'ib.dots',
    title: 'Dots show the outer shell as it is now',
    body: 'An electron-dot symbol rings the symbol with the outermost electrons only; the symbol itself stands in for the nucleus and every inner electron. After the move, a simple metal cation shows no dots and an anion shows its finished octet.',
    example: 'Fr⁺ still drawn with its dot ✗ → the dot left with the electron',
  },
  {
    id: 'ib.crisscross',
    title: 'Criss-cross, then reduce',
    body: 'The size of each ion’s charge becomes the subscript of the OTHER ion, and the finished formula is reduced to the lowest whole-number ratio. The unit ends up neutral: all the plus cancels all the minus.',
    example: 'Ra and oxide left doubled after the criss-cross ✗ → reduce the ratio first',
  },
  {
    id: 'ib.transfer',
    title: 'Electrons moved per formula unit',
    body: 'Count the electrons that change hands in one whole formula unit: every cation’s loss added together, which equals every anion’s gain added together. One atom’s share is the unit’s total only when the unit holds one of it.',
    example: 'Ra with two halide ions, one atom’s loss counted ✗ → add up the whole unit',
  },
  {
    id: 'ib.lattice',
    title: 'A lattice of ions explains the behaviour',
    body: 'An ionic solid is one repeating lattice of oppositely charged ions. Pulls in every direction make it hard to melt; a shifted layer puts like charges together and it cracks; and current flows only once the ions themselves can move, in the melt or in solution.',
    example: 'molten RaCl₂ lighting a bulb put down to drifting electrons ✗ → its ions are what move',
  },
  {
    id: 'mb.sea',
    title: 'The electron-sea model',
    body: 'A metal is positive centers sitting in a sea of outer electrons that the whole piece shares. The drifting sea carries current through the solid, lets layers slide without the piece breaking, and bonds whatever metal atoms are mixed in.',
    example: 'francium read as an ionic crystal ✗ → one kind of atom in a shared sea',
  },
]

const RULE_INDEX = new Map(IB_RULES.map((card) => [card.id, card]))

export function ibRule(id: string): RuleCard {
  const card = RULE_INDEX.get(id)
  if (!card) throw new Error(`missing ionic-bonding rule card ${id}`)
  return card
}

/** Which card to put first when she hits this slip. */
export const IB_RULE_FOR: Partial<Record<ErrorPatternId, string>> = {
  ib_valence_dblock: 'ib.octet',
  ib_gain_lose: 'ib.octet',
  ib_charge_sign: 'ib.ion',
  ib_dots_neutral: 'ib.dots',
  ib_dots_all: 'ib.dots',
  ib_transfer_count: 'ib.transfer',
  ib_props_electrons: 'ib.lattice',
  ib_props_molecules: 'ib.lattice',
  ib_props_weak: 'ib.lattice',
  mb_fixed_electrons: 'mb.sea',
  mb_ionic_confusion: 'mb.sea',
  ec_ion_charge_ignored: 'ib.config',
  nm_crisscross_reversed: 'ib.crisscross',
  nm_not_lowest_ratio: 'ib.crisscross',
}
