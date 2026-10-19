/**
 * Rule cards for chapter 7. A card is open in the Rule cards panel on every problem of its module and is hint
 * rung 2 of a part, so:
 *  - an example line uses only ions and compounds no template of its module asks about: cesium, beryllium and
 *    gold, selenide and selenate, bromate, I₂O₅, the selenium acids, sodium thiosulfate, ammonium iodide (the tests
 *    check every example against every answer the module's templates can generate);
 *  - a body never names an ion or compound a part can ask for where that card is the part's rung 2 (the generator
 *    checks it for every problem).
 * The polyatomic ion reference is built from the engine's table (POLYATOMIC_IONS): it lists the whole table and
 * singles out nothing.
 */
import { formulaDisplay, POLYATOMIC_IONS, type NmMistakeId } from '@/engine'
import type { NmPartKind, RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

export const NM_RULES: readonly RuleCard[] = [
  {
    id: 'nm.charges',
    title: 'Ion charges from the periodic table',
    body: 'A metal atom loses electrons and becomes a cation; a nonmetal atom gains electrons and becomes an anion. In the main groups the column gives the charge: group 1 is 1+, group 2 is 2+, group 13 is 3+, group 15 is 3−, group 16 is 2− and group 17 is 1−. A one-atom cation keeps its element’s name; a one-atom anion takes the ending -ide.',
    example: 'Se in group 16: Se⁻ ✗ → Se²⁻, selenide',
  },
  {
    id: 'nm.numeral',
    title: 'The Roman numeral is the metal’s charge',
    body: 'Iron, copper, tin, lead, cobalt, chromium, manganese and mercury each form more than one ion, so the name says which: the charge of ONE metal ion, as a Roman numeral in parentheses right after the metal. Work it out from the anions: their total charge, shared among the metal ions. A subscript counts ions; it is never the charge. A metal with only one charge (groups 1, 2 and 13, zinc and silver) never takes a numeral.',
    example: 'Au³⁺: gold ✗ → gold(III)',
  },
  {
    id: 'nm.polyatomic',
    title: 'Polyatomic ions keep their table names',
    body: 'A polyatomic ion is a group of atoms with one charge for the whole group. Its name, formula and charge come from the table and never change inside a compound. Of two ions with the same element, -ate has one more oxygen than -ite; per-…-ate has one more than -ate, and hypo-…-ite one fewer than -ite. An H in front adds hydrogen (or dihydrogen) to the name. The -ide ending is for one-atom anions, apart from two table ions that keep it.',
    example: 'SeO₄²⁻: selenite ✗ → selenate',
  },
  {
    id: 'nm.crisscross',
    title: 'Balance the charges, lowest ratio',
    body: 'The positive and negative charges must add up to zero. A shortcut: the size of each ion’s charge becomes the subscript of the OTHER ion; then divide both subscripts by any common factor. Write the cation first. A polyatomic ion goes in parentheses when there is more than one of it, a subscript of 1 is left out, and the two-atom ions of the table keep the 2 inside their formulas.',
    example: 'Cs⁺ and Se²⁻: CsSe₂ ✗ → Cs₂Se',
  },
  {
    id: 'nm.ionicNaming',
    title: 'Name the cation, then the anion',
    body: 'An ionic compound is named cation first, then anion, with no prefixes: the charges already fix how many of each ion there are. A one-atom cation keeps its element’s name, with a Roman numeral when the metal has more than one charge; a one-atom anion ends in -ide; a polyatomic ion keeps its name from the table. A polyatomic cation is named the same way as a metal one.',
    example: 'Be(BrO₃)₂: beryllium dibromate ✗ → beryllium bromate',
  },
  {
    id: 'nm.prefixes',
    title: 'Greek prefixes count the atoms',
    body: 'A binary molecular compound is two nonmetals sharing electrons. Name the first element, then the second with the ending -ide, and count the atoms of each with a prefix: mono- 1, di- 2, tri- 3, tetra- 4, penta- 5, hexa- 6, hepta- 7, octa- 8, nona- 9, deca- 10. The first element never takes mono-. The a or o of a prefix drops before oxide. The formula is never reduced, and there is no Roman numeral.',
    example: 'I₂O₅: iodine pentoxide ✗ → diiodine pentoxide',
  },
  {
    id: 'nm.acids',
    title: 'Acid names come from the anion',
    body: 'An acid is hydrogen with an anion, dissolved in water. An -ide anion, with no oxygen: hydro- + root + -ic acid. An -ate anion: root + -ic acid. An -ite anion: root + -ous acid. An anion with oxygen never takes hydro-. Sulfur and phosphorus keep the longer roots sulfur- and phosphor-. In the formula, the H comes first, as many as the anion’s charge.',
    example: 'H₂Se(aq): selenic acid ✗ → hydroselenic acid',
  },
  {
    id: 'nm.hydrates',
    title: 'A hydrate names its water',
    body: 'A hydrate is an ionic compound with water molecules held in its crystals, written after a dot. Name the ionic compound, then a Greek prefix for the number of waters and the word hydrate. To write the formula, write the compound, a dot, the number of waters and H₂O.',
    example: 'Na₂S₂O₃·5H₂O: sodium thiosulfate ✗ → its name counts the 5 waters too',
  },
  {
    id: 'nm.classify',
    title: 'Decide which naming rules apply',
    body: 'Check in this order. Water written after a dot: name the salt, then count the waters with a prefix. H written first with an anion, dissolved in water (or with an anion that has oxygen): name it from the anion, with -ic or -ous. A metal ion or NH₄⁺ with an anion: name the two ions, with no prefixes. Only nonmetals: count every atom with a Greek prefix.',
    example: 'NH₄I named with prefixes ✗ → NH₄⁺ is a cation: name its ions',
  },
]

const RULE_INDEX = new Map(NM_RULES.map((card) => [card.id, card]))

export function nmRule(id: string): RuleCard {
  const card = RULE_INDEX.get(id)
  if (!card) throw new Error(`missing nomenclature rule card ${id}`)
  return card
}

/** The cards of each module, the module's own first (a hydrate is named with the ionic rules too). */
export const ION_RULE_IDS = ['nm.charges', 'nm.numeral', 'nm.polyatomic', 'nm.crisscross', 'nm.ionicNaming'] as const
export const MOLECULAR_RULE_IDS = ['nm.prefixes', 'nm.acids', 'nm.hydrates', 'nm.classify', 'nm.ionicNaming', 'nm.numeral', 'nm.polyatomic', 'nm.charges', 'nm.crisscross'] as const

const BY_MISTAKE: Partial<Record<ErrorPatternId, string>> = {
  nm_charges_unbalanced: 'nm.crisscross',
  nm_not_lowest_ratio: 'nm.crisscross',
  nm_parentheses_missing: 'nm.crisscross',
  nm_crisscross_reversed: 'nm.crisscross',
  nm_numeral_as_subscript: 'nm.numeral',
  nm_unit_ion_reduced: 'nm.polyatomic',
  nm_polyatomic_formula_wrong: 'nm.polyatomic',
  nm_anion_first: 'nm.ionicNaming',
  nm_prefix_on_ionic: 'nm.ionicNaming',
  nm_numeral_missing: 'nm.numeral',
  nm_numeral_wrong: 'nm.numeral',
  nm_numeral_on_fixed: 'nm.numeral',
  nm_ide_for_polyatomic: 'nm.polyatomic',
  nm_ate_ite_swapped: 'nm.polyatomic',
  nm_per_hypo_wrong: 'nm.polyatomic',
  nm_element_name_for_anion: 'nm.charges',
  nm_hydrogen_prefix_wrong: 'nm.polyatomic',
  nm_prefix_missing: 'nm.prefixes',
  nm_mono_on_first: 'nm.prefixes',
  nm_molecular_reduced: 'nm.prefixes',
  nm_stock_on_molecular: 'nm.prefixes',
  nm_hydro_on_oxyacid: 'nm.acids',
  nm_hydro_missing: 'nm.acids',
  nm_ic_ous_swapped: 'nm.acids',
  nm_acid_root: 'nm.acids',
  nm_acid_named_as_salt: 'nm.acids',
  nm_acid_anion_ending: 'nm.acids',
  nm_hydrate_count_wrong: 'nm.hydrates',
  nm_ion_charge_wrong: 'nm.charges',
  nm_class_ammonium_molecular: 'nm.classify',
  nm_class_hydrate_ignored: 'nm.classify',
  nm_class_acid_ignored: 'nm.classify',
}

const IONIC_NAME_IDS: readonly NmMistakeId[] = [
  'nm_anion_first',
  'nm_prefix_on_ionic',
  'nm_numeral_on_fixed',
  'nm_numeral_missing',
  'nm_numeral_wrong',
  'nm_element_name_for_anion',
  'nm_ide_for_polyatomic',
  'nm_ate_ite_swapped',
  'nm_per_hypo_wrong',
  'nm_hydrogen_prefix_wrong',
  'nm_unit_ion_reduced',
]
const IONIC_FORMULA_IDS: readonly NmMistakeId[] = [
  'nm_anion_first',
  'nm_unit_ion_reduced',
  'nm_parentheses_missing',
  'nm_numeral_as_subscript',
  'nm_numeral_wrong',
  'nm_ide_for_polyatomic',
  'nm_hydrogen_prefix_wrong',
  'nm_polyatomic_formula_wrong',
  'nm_crisscross_reversed',
  'nm_not_lowest_ratio',
  'nm_charges_unbalanced',
]

/**
 * The slips the engine's graders can name on each kind of part (nameSlips.ts, formulaSlips.ts and the rules in
 * grade.ts of the core): what a part can show, and so what the tests check for it.
 */
export const NM_IDS_BY_PART: Readonly<Record<NmPartKind, readonly NmMistakeId[]>> = {
  'ion-name': ['nm_numeral_on_fixed', 'nm_numeral_missing', 'nm_numeral_wrong', 'nm_element_name_for_anion', 'nm_ide_for_polyatomic', 'nm_ate_ite_swapped', 'nm_per_hypo_wrong', 'nm_hydrogen_prefix_wrong', 'nm_unit_ion_reduced'],
  'ion-formula': ['nm_unit_ion_reduced', 'nm_ide_for_polyatomic', 'nm_hydrogen_prefix_wrong', 'nm_polyatomic_formula_wrong', 'nm_ion_charge_wrong'],
  'ionic-name': IONIC_NAME_IDS,
  'ionic-formula': IONIC_FORMULA_IDS,
  'molecular-name': ['nm_mono_on_first', 'nm_prefix_missing', 'nm_molecular_reduced', 'nm_element_name_for_anion', 'nm_stock_on_molecular'],
  'molecular-formula': ['nm_anion_first', 'nm_molecular_reduced', 'nm_prefix_missing'],
  'acid-name': ['nm_acid_named_as_salt', 'nm_hydro_missing', 'nm_hydro_on_oxyacid', 'nm_ic_ous_swapped', 'nm_acid_root', 'nm_per_hypo_wrong', 'nm_acid_anion_ending'],
  'acid-formula': ['nm_anion_first', 'nm_hydro_on_oxyacid', 'nm_hydro_missing', 'nm_polyatomic_formula_wrong', 'nm_charges_unbalanced'],
  'hydrate-name': ['nm_hydrate_count_wrong', ...IONIC_NAME_IDS],
  'hydrate-formula': ['nm_hydrate_count_wrong', ...IONIC_FORMULA_IDS],
  class: ['nm_class_ammonium_molecular', 'nm_class_hydrate_ignored', 'nm_class_acid_ignored'],
}

/**
 * The card to put first when she makes this slip on this kind of part. A single ion keeps its own card (charges,
 * numeral or table); a molecular compound's slips are about prefixes, an acid's about acid names.
 */
export function nmRuleFor(id: ErrorPatternId, part: NmPartKind, stageCard: string): string {
  if (part === 'ion-name' || part === 'ion-formula' || part === 'class') return part === 'class' ? 'nm.classify' : stageCard
  if (part === 'molecular-name' || part === 'molecular-formula') return 'nm.prefixes'
  if (part === 'acid-name' || part === 'acid-formula') return 'nm.acids'
  return BY_MISTAKE[id] ?? stageCard
}

// --- the polyatomic ion reference ----------------------------------------------------------------------

export interface PolyatomicRow {
  name: string
  formula: string
  /** Display text with the charge: 'SO₄²⁻'. */
  display: string
  charge: number
}

const chargeLabel = (q: number) => `${Math.abs(q)}${q > 0 ? '+' : '−'}`

function row(r: (typeof POLYATOMIC_IONS)[number]): PolyatomicRow {
  const sign = r.charge > 0 ? '+' : '-'
  const size = Math.abs(r.charge)
  const name = r.formula === 'Hg2' ? 'mercury(I) (dimercury)' : r.name
  return { name, formula: r.formula, display: formulaDisplay(`${r.formula}^${size === 1 ? '' : size}${sign}`), charge: r.charge }
}

/** The textbook's "Common Polyatomic Ions" table, grouped by charge as CK-12 prints it. */
export function polyatomicReference(): { charge: string; rows: PolyatomicRow[] }[] {
  const textbook = POLYATOMIC_IONS.filter((r) => r.inTextbook)
  const charges = [...new Set(textbook.map((r) => r.charge))].sort((a, b) => (Math.sign(a) === Math.sign(b) ? Math.abs(a) - Math.abs(b) : a < 0 ? -1 : 1))
  return charges.map((q) => ({ charge: chargeLabel(q), rows: textbook.filter((r) => r.charge === q).map(row) }))
}

/** The bromine and iodine families: not in the textbook's table, named by the same per-/-ate/-ite/hypo- pattern. */
export function halogenFamilyReference(): PolyatomicRow[] {
  return POLYATOMIC_IONS.filter((r) => !r.inTextbook && /^(?:per|hypo)?(?:brom|iod)(?:ate|ite)$/.test(r.name)).map(row)
}
