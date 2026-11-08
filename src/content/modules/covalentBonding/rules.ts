/**
 * Rule cards for covalent bonding. Shown on hint rung 2, while she can still answer, so no body
 * or example may single out an answer: counts are written in words, worked molecules are PH₃,
 * SiH₄ and HBr (which the chapter 9 draw never uses), and a card that must name the shapes or
 * the bands names every one of them together — a complete list singles out none (the leak checks
 * treat a surface that shows the whole option set as clean).
 */
import type { CbShape, RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

/** The two ways electrons can behave; the id is the text, like the chapter 8 choices. */
export const BOND_TYPE_TEXT = {
  shared: 'Shared between the atoms',
  transferred: 'Transferred from one atom to the other',
} as const

/** Bond order choices. */
export const ORDER_TEXT: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'Single',
  2: 'Double',
  3: 'Triple',
}

/** Why hydrogen stops at two: the right sentence in two wordings, and the octet-claim slip. */
export const DUET_RIGHT: readonly string[] = [
  'Hydrogen is filling the first shell, which holds just two electrons',
  'Its one and only shell is full once a single shared pair sits on it',
]
export const DUET_OCTET: readonly string[] = [
  'Hydrogen works like every other atom: a finished hydrogen shows eight electrons',
  'Nothing stops at two — hydrogen keeps collecting until it reaches eight',
]
export const DUET_FILLER: readonly string[] = [
  'The bigger atom hogs the shared pair, so hydrogen is left with whatever remains',
  'Hydrogen runs out of room on the page, so we only draw part of its shell',
]

/** Why lone pairs change the shape: the right sentence in two wordings, and two standing wrongs. */
export const BEND_RIGHT: readonly string[] = [
  'Lone pairs take their own corners of the arrangement and push the bonds together, but only the atoms get named',
  'Every pair, lone ones included, spreads out in the arrangement — the name just traces the atoms, so it shows fewer corners',
]
export const BEND_PULL: readonly string[] = [
  'The lone pairs reach out and drag the outer atoms toward themselves until the molecule folds',
  'Each lone pair grabs the nearest bonded atom and pulls it over to its own side',
]
export const BEND_VANISH: readonly string[] = [
  'Lone pairs vanish once the bonds form, so only the bonds decide the angles',
  'A pair that bonds nothing takes up no room, so the atoms spread out as if it were not there',
]

/** The polarity bands, as the buttons print them. */
export const BAND_TEXT = {
  nonpolar: 'Nonpolar covalent',
  polar: 'Polar covalent',
  ionic: 'Ionic',
} as const

/** Polar-or-not, as the buttons print it. */
export const POLAR_TEXT = {
  polar: 'Polar',
  nonpolar: 'Nonpolar',
} as const

/** The three forces, as the buttons print them. */
export const FORCE_TEXT = {
  dispersion: 'London dispersion forces only',
  dipole: 'Dipole-dipole attraction, on top of dispersion',
  hbond: 'Hydrogen bonds, on top of dispersion',
} as const

export const CB_RULES: readonly RuleCard[] = [
  {
    id: 'cb.bond',
    title: 'A covalent bond is a shared pair',
    body: 'Two nonmetal atoms both pull on the same electrons and neither wins, so the pair sits between them and holds both nuclei at once. What this builds are molecules — separate little clusters, each one complete — where an ionic compound is one endless lattice counted in formula units.',
    example: 'PH₃ read as a stack of ions ✗ → three shared pairs hold one little molecule together',
  },
  {
    id: 'cb.octet',
    title: 'Eight around each atom — two around hydrogen',
    body: 'In a finished dot structure every atom sits in a full outer shell, and a shared pair counts for both of its atoms at once. Most atoms are full at eight electrons. Hydrogen is the exception: its only shell is the first, full at two, so a finished hydrogen carries one bond and nothing more.',
    example: 'an H of SiH₄ ringed with four pairs ✗ → one shared pair already completes it',
  },
  {
    id: 'cb.multiple',
    title: 'Single, double and triple bonds',
    body: 'Atoms can share more than one pair: a single bond is one shared pair, a double bond two, a triple bond three. Count electrons by doubling the pairs — every shared pair is two electrons. More shared pairs also pull the atoms closer, so the bond gets shorter and stronger (that is as far as this chapter takes it).',
    example: 'HBr drawn sharing two pairs ✗ → one shared pair joins H to Br',
  },
  {
    id: 'cb.vsepr',
    title: 'Electron groups spread out: the five shapes',
    body: 'VSEPR in one sentence: the electron groups around the central atom spread as far apart as they can. Count the groups — a bond of any size is one group, and so is a lone pair — then name only what the atoms show: two atoms and no lone pairs is Linear at 180; three atoms is Trigonal planar at 120; four atoms is Tetrahedral at 109.5; three atoms plus a lone pair is Trigonal pyramidal at about 107; two atoms plus two lone pairs is Bent at about 104.5.',
    example: 'PH₃ named for all four electron groups ✗ → one corner is a lone pair, so the atoms draw the smaller shape',
  },
  {
    id: 'cb.bands',
    title: 'Read the difference, then the band',
    body: 'Subtract the two electronegativities, larger minus smaller — the gap is a distance, always positive. Below 0.4 the sharing is even: Nonpolar covalent. From 0.4 up to 1.7 the sharing is lopsided: Polar covalent. Above 1.7 one atom takes the electrons outright: Ionic.',
    example: 'H and Br read as sharing evenly ✗ → their gap clears 0.4, so the sharing is lopsided',
  },
  {
    id: 'cb.polar',
    title: 'Polar molecule: polar bonds plus a lopsided shape',
    body: 'A molecule is polar only when both things hold: at least one bond pulls unevenly, AND the shape fails to cancel the pulls. Equal bonds pointing straight out opposite ends, or spread evenly around the center, cancel exactly — that molecule is nonpolar however hard each bond tugs. Lone pairs that bend the molecule stop the cancelling.',
    example: 'HBr called nonpolar for being small ✗ → one lopsided bond and nothing to cancel it: the molecule is polar',
  },
  {
    id: 'cb.forces',
    title: 'Three grips between molecules',
    body: 'Ranked weakest to strongest: London dispersion, which every molecule has and which grows with the size of the electron cloud; dipole-dipole attraction, added when the whole molecule is polar; and hydrogen bonding, the strongest of the three, only when an H is bonded straight to N, O or F. The stickier the grip between molecules, the more heat boiling takes.',
    example: 'HBr expected to hydrogen-bond ✗ → its H sits on bromine, so dispersion plus dipole attraction is all it gets',
  },
]

const RULE_INDEX = new Map(CB_RULES.map((card) => [card.id, card]))

export function cbRule(id: string): RuleCard {
  const card = RULE_INDEX.get(id)
  if (!card) throw new Error(`missing covalent-bonding rule card ${id}`)
  return card
}

/** Which card to put first when she hits this slip (each card's slips, the ch8-style map). */
export const CB_RULE_FOR: Partial<Record<ErrorPatternId, string>> = {
  cb_transfer_share: 'cb.bond',
  cb_pairs_swapped: 'cb.bond',
  cb_h_octet: 'cb.octet',
  cb_pairs_for_electrons: 'cb.multiple',
  cb_electron_groups_shape: 'cb.vsepr',
  cb_angle_wrong_shape: 'cb.vsepr',
  cb_en_negative: 'cb.bands',
  cb_bands_flipped: 'cb.bands',
  cb_polar_because_bonds: 'cb.polar',
  cb_hbond_any_h: 'cb.forces',
}

/** The five shape choices in a stable order (shuffled per seed where they are offered). */
export const SHAPE_CHOICES: readonly CbShape[] = ['Linear', 'Trigonal planar', 'Tetrahedral', 'Trigonal pyramidal', 'Bent']
