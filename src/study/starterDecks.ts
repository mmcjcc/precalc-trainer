/**
 * Starter study sets: ready-made decks she can copy into her own sets with one tap (the copy is
 * hers to edit; this file is never shown as a set). Decks come from the engines where the app
 * already has the data — polyatomic ions and element symbols from the chemistry engine, transition
 * words from the SAT module — and from small tables here that the tests re-check numerically.
 * Chemistry definitions are facts in our own words, never copied from a textbook.
 *
 * The store build keeps its math-only scope: a deck's subject runs through `includesSubject`,
 * the same gate the module registry uses.
 */
import { ELEMENTS, type ElementInfo } from '@/engine/chem/elements'
import { ionDisplay, nmIons, type NmIon } from '@/engine'
import { transitionGlossary } from '@/content/modules/satrw/transitions'
import { includesSubject } from '@/edition'
import type { StudyDraftCard } from '@/store/studySets'

export interface StarterDeck {
  /** Stable slug, never shown. */
  id: string
  title: string
  /** One line under the title in the starter list. */
  blurb: string
  /** A subject the store build skips ('Chemistry', 'English'); math decks carry none. */
  subject?: string
  cards: readonly StudyDraftCard[]
}

function card(term: string, definition: string): StudyDraftCard {
  return { term, definition }
}

// --- unit circle ---------------------------------------------------------------------------------------

export interface UnitCircleValue {
  fn: 'sin' | 'cos' | 'tan'
  deg: number
  rad: string
  /** Exact value as the card prints it; 'undefined' where the function has none. */
  exact: string
}

/** The values the deck drills: the three functions at the five first-quadrant angles, 180° and 270°. */
export const UNIT_CIRCLE_VALUES: readonly UnitCircleValue[] = [
  { fn: 'sin', deg: 0, rad: '0', exact: '0' },
  { fn: 'sin', deg: 30, rad: 'π/6', exact: '1/2' },
  { fn: 'sin', deg: 45, rad: 'π/4', exact: '√2/2' },
  { fn: 'sin', deg: 60, rad: 'π/3', exact: '√3/2' },
  { fn: 'sin', deg: 90, rad: 'π/2', exact: '1' },
  { fn: 'sin', deg: 180, rad: 'π', exact: '0' },
  { fn: 'sin', deg: 270, rad: '3π/2', exact: '-1' },
  { fn: 'cos', deg: 0, rad: '0', exact: '1' },
  { fn: 'cos', deg: 30, rad: 'π/6', exact: '√3/2' },
  { fn: 'cos', deg: 45, rad: 'π/4', exact: '√2/2' },
  { fn: 'cos', deg: 60, rad: 'π/3', exact: '1/2' },
  { fn: 'cos', deg: 90, rad: 'π/2', exact: '0' },
  { fn: 'cos', deg: 180, rad: 'π', exact: '-1' },
  { fn: 'cos', deg: 270, rad: '3π/2', exact: '0' },
  { fn: 'tan', deg: 0, rad: '0', exact: '0' },
  { fn: 'tan', deg: 30, rad: 'π/6', exact: '√3/3' },
  { fn: 'tan', deg: 45, rad: 'π/4', exact: '1' },
  { fn: 'tan', deg: 60, rad: 'π/3', exact: '√3' },
  { fn: 'tan', deg: 90, rad: 'π/2', exact: 'undefined' },
  { fn: 'tan', deg: 180, rad: 'π', exact: '0' },
  { fn: 'tan', deg: 270, rad: '3π/2', exact: 'undefined' },
]

const RADIAN_CONVERSIONS: readonly { deg: number; rad: string }[] = [
  { deg: 30, rad: 'π/6' },
  { deg: 45, rad: 'π/4' },
  { deg: 60, rad: 'π/3' },
  { deg: 90, rad: 'π/2' },
  { deg: 180, rad: 'π' },
  { deg: 270, rad: '3π/2' },
  { deg: 360, rad: '2π' },
]

function unitCircleCards(): StudyDraftCard[] {
  const values = UNIT_CIRCLE_VALUES.map((v) => card(`${v.fn} ${v.deg}° (${v.rad})`, v.exact))
  const conversions = RADIAN_CONVERSIONS.map((c) => card(`${c.deg}° in radians`, c.rad))
  const signs = [
    card('Quadrant I: which trig functions are positive?', 'All of them'),
    card('Quadrant II: which trig functions are positive?', 'Sine and cosecant only'),
    card('Quadrant III: which trig functions are positive?', 'Tangent and cotangent only'),
    card('Quadrant IV: which trig functions are positive?', 'Cosine and secant only'),
    card('ASTC', 'All, Students, Take, Calculus - which functions are positive in quadrants I-IV: All, Sine, Tangent, Cosine'),
  ]
  return [...values, ...conversions, ...signs]
}

// --- trig identities and formulas ------------------------------------------------------------------------

const TRIG_IDENTITY_CARDS: readonly StudyDraftCard[] = [
  card('Pythagorean identity', 'sin²θ + cos²θ = 1'),
  card('Pythagorean identity, tan form', '1 + tan²θ = sec²θ'),
  card('Pythagorean identity, cot form', '1 + cot²θ = csc²θ'),
  card('csc θ (reciprocal identity)', '1 / sin θ'),
  card('sec θ (reciprocal identity)', '1 / cos θ'),
  card('cot θ (reciprocal identity)', '1 / tan θ'),
  card('tan θ (quotient identity)', 'sin θ / cos θ'),
  card('cot θ (quotient identity)', 'cos θ / sin θ'),
  card('sin(-θ)', '-sin θ (sine is odd)'),
  card('cos(-θ)', 'cos θ (cosine is even)'),
  card('tan(-θ)', '-tan θ (tangent is odd)'),
  card('sin(90° - θ) (cofunction)', 'cos θ'),
  card('tan(90° - θ) (cofunction)', 'cot θ'),
  card('sec(90° - θ) (cofunction)', 'csc θ'),
  card('sin(A + B)', 'sin A cos B + cos A sin B'),
  card('sin(A - B)', 'sin A cos B - cos A sin B'),
  card('cos(A + B)', 'cos A cos B - sin A sin B'),
  card('cos(A - B)', 'cos A cos B + sin A sin B'),
  card('tan(A + B)', '(tan A + tan B) / (1 - tan A tan B)'),
  card('tan(A - B)', '(tan A - tan B) / (1 + tan A tan B)'),
  card('sin 2θ', '2 sin θ cos θ'),
  card('cos 2θ (three forms)', 'cos²θ - sin²θ = 2cos²θ - 1 = 1 - 2sin²θ'),
  card('tan 2θ', '2 tan θ / (1 - tan²θ)'),
  card('sin(θ/2)', '±√((1 - cos θ)/2), sign from the quadrant of θ/2'),
  card('cos(θ/2)', '±√((1 + cos θ)/2), sign from the quadrant of θ/2'),
  card('tan(θ/2)', '(1 - cos θ)/sin θ = sin θ/(1 + cos θ)'),
  card('Period of sin and cos', '360° (2π)'),
  card('Period of tan', '180° (π)'),
]

// --- logarithm and exponent rules ------------------------------------------------------------------------

const LOG_RULE_CARDS: readonly StudyDraftCard[] = [
  card('logₐ(xy) - product rule', 'logₐ x + logₐ y'),
  card('logₐ(x/y) - quotient rule', 'logₐ x - logₐ y'),
  card('logₐ(xⁿ) - power rule', 'n · logₐ x'),
  card('Change of base: logₐ x', 'ln x / ln a (or log x / log a)'),
  card('logₐ 1', '0, because a⁰ = 1'),
  card('logₐ a', '1'),
  card('logₐ(aˣ)', 'x - the log undoes the exponential'),
  card('a^(logₐ x)', 'x - the exponential undoes the log'),
  card('log x with no base written', 'log base 10 (the common log)'),
  card('ln x', 'log base e (the natural log)'),
  card('e', "Euler's number, about 2.718 - the base of the natural log"),
  card('y = aˣ in log form', 'x = logₐ y - a logarithm is an exponent'),
  card('Domain of y = logₐ x', 'x > 0: only positive numbers have logs'),
  card('logₐ 0', 'Undefined - aˣ is never 0'),
  card('xᵃ · xᵇ', 'x^(a+b): add the exponents'),
  card('xᵃ / xᵇ', 'x^(a-b): subtract the exponents'),
  card('(xᵃ)ᵇ', 'x^(ab): multiply the exponents'),
  card('x⁰', '1 (for x ≠ 0)'),
  card('x⁻ⁿ', '1/xⁿ'),
  card('x^(1/n)', 'The nth root of x'),
]

// --- geometry --------------------------------------------------------------------------------------------

const GEOMETRY_CARDS: readonly StudyDraftCard[] = [
  card('Midpoint', 'The point that divides a segment into two congruent segments.'),
  card('Segment bisector', "A line, ray, or segment that passes through a segment's midpoint."),
  card('Angle bisector', 'A ray that divides an angle into two congruent angles.'),
  card('Complementary angles', 'Two angles whose measures add to 90°.'),
  card('Supplementary angles', 'Two angles whose measures add to 180°.'),
  card('Linear pair postulate', 'If two angles form a linear pair, they are supplementary.'),
  card('Vertical angles theorem', 'Vertical angles are congruent.'),
  card('Segment addition postulate', 'If B is between A and C, then AB + BC = AC.'),
  card('Angle addition postulate', 'If D is in the interior of ∠ABC, then m∠ABD + m∠DBC = m∠ABC.'),
  card('Corresponding angles postulate', 'If two parallel lines are cut by a transversal, corresponding angles are congruent.'),
  card('Alternate interior angles theorem', 'If two parallel lines are cut by a transversal, alternate interior angles are congruent.'),
  card('Consecutive (same-side) interior angles', 'If two parallel lines are cut by a transversal, same-side interior angles are supplementary.'),
  card('Triangle sum theorem', 'The three angle measures of a triangle add to 180°.'),
  card('Exterior angle theorem', 'An exterior angle of a triangle equals the sum of the two remote interior angles.'),
  card('SSS', 'Three pairs of congruent sides prove two triangles congruent.'),
  card('SAS', 'Two pairs of congruent sides and the included angles prove two triangles congruent.'),
  card('ASA', 'Two pairs of congruent angles and the included sides prove two triangles congruent.'),
  card('AAS', 'Two pairs of congruent angles and a pair of non-included sides prove two triangles congruent.'),
  card('HL', 'In right triangles, a congruent hypotenuse and leg prove the triangles congruent.'),
  card('CPCTC', 'Corresponding parts of congruent triangles are congruent - used after the triangles are proved congruent.'),
  card('Base angles theorem', 'In an isosceles triangle, the angles opposite the congruent sides are congruent.'),
  card('Midsegment theorem', 'A segment joining the midpoints of two sides of a triangle is parallel to the third side and half as long.'),
  card('Parallelogram properties', 'Opposite sides and opposite angles are congruent, consecutive angles are supplementary, and the diagonals bisect each other.'),
  card('AA similarity', 'Two pairs of congruent angles prove two triangles similar.'),
  card('Geometric mean (altitude) theorem', 'The altitude to the hypotenuse of a right triangle is the geometric mean of the two segments it makes on the hypotenuse.'),
  card('Pythagorean theorem', 'In a right triangle, a² + b² = c², where c is the hypotenuse.'),
  card('Converse of the Pythagorean theorem', 'If a² + b² = c² for the sides of a triangle, the triangle is a right triangle.'),
  card('45-45-90 triangle', 'The legs are congruent and the hypotenuse is leg · √2.'),
  card('30-60-90 triangle', 'The hypotenuse is twice the short leg, and the long leg is short leg · √3.'),
  card('SOH-CAH-TOA', 'sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.'),
  card('Angle of elevation / depression', 'The angle measured up (elevation) or down (depression) from the horizontal; for the same two points they are congruent alternate interior angles.'),
]

// --- chemistry -------------------------------------------------------------------------------------------

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Every polyatomic ion of the nomenclature model, alphabetical by name. */
export function polyatomicIonsForDeck(): NmIon[] {
  return nmIons()
    .filter((ion) => ion.kind === 'polyatomic')
    .sort((a, b) => a.name.localeCompare(b.name))
}

function polyatomicCards(): StudyDraftCard[] {
  return polyatomicIonsForDeck().map((ion) => {
    const names = ion.otherNames.length > 0 ? ` (also called ${ion.otherNames.join(', ')})` : ''
    return card(capitalize(ion.name), ionDisplay(ion) + names)
  })
}

/** Beyond calcium, only the symbols a first-year course keeps using. */
const ELEMENT_DECK_EXTRAS: ReadonlySet<string> = new Set(['Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Br', 'Ag', 'Sn', 'Sb', 'I', 'Ba', 'W', 'Au', 'Hg', 'Pb'])

/** Hydrogen through calcium, then the common heavier elements (the ones with surprising symbols included). */
export function elementsForDeck(): ElementInfo[] {
  return ELEMENTS.filter((el) => el.z <= 20 || ELEMENT_DECK_EXTRAS.has(el.symbol))
}

function elementCards(): StudyDraftCard[] {
  return elementsForDeck().map((el) => card(capitalize(el.name), el.symbol))
}

/** Chapter 7-8 vocabulary, stated in our own words. */
const CHEM_VOCAB_CARDS: readonly StudyDraftCard[] = [
  card('Cation', 'A positively charged ion: an atom or group that has lost electrons. Metals form cations.'),
  card('Anion', 'A negatively charged ion: an atom or group that has gained electrons. Nonmetals form anions.'),
  card('Valence electrons', 'The electrons in the outermost energy level - the ones involved in bonding.'),
  card('Octet rule', 'Atoms gain, lose, or share electrons to reach 8 valence electrons, a noble-gas configuration.'),
  card('Noble-gas configuration', 'A full outer shell of 8 electrons (2 for helium) - the stable arrangement ions reach for.'),
  card('Lewis dot symbol', "An element's symbol with one dot for each valence electron."),
  card('Ionic bond', 'The attraction between oppositely charged ions after electrons transfer from a metal to a nonmetal.'),
  card('Covalent bond', 'A bond in which two nonmetal atoms share one or more pairs of electrons.'),
  card('Metallic bond', 'The attraction between metal cations and a sea of free-moving valence electrons.'),
  card('Electron sea model', 'Metal atoms pool their valence electrons into a shared sea that moves freely - why metals conduct and bend instead of shattering.'),
  card('Polyatomic ion', 'A charged group of covalently bonded atoms that acts as one unit, like SO₄²⁻ or NH₄⁺.'),
  card('Formula unit', 'The lowest whole-number ratio of ions in an ionic compound: NaCl means a 1:1 ratio, not one molecule.'),
  card('Molecule', 'A neutral group of atoms held together by covalent bonds.'),
  card('Binary compound', 'A compound made of exactly two elements, like NaCl or CO₂.'),
  card('Hydrate', 'An ionic compound with a fixed number of water molecules locked into its crystal, like CuSO₄·5H₂O.'),
  card('Anhydrous', "What is left after a hydrate's water is driven off by heating."),
  card('Binary acid', 'An acid made of hydrogen and one other element, like HCl(aq) - named hydro-...-ic acid.'),
  card('Oxoacid', 'An acid made of hydrogen and an oxygen-containing polyatomic ion, like H₂SO₄ - named from the ion: -ate becomes -ic, -ite becomes -ous.'),
  card('Roman numeral in a name', 'The charge of a metal that forms more than one ion: iron(III) means Fe³⁺.'),
  card('Crystal lattice', 'The repeating three-dimensional pattern of alternating cations and anions in an ionic solid.'),
  card('Electrolyte', 'A substance that conducts electricity when dissolved or melted, because its ions are free to move.'),
  card('Malleable', 'Can be hammered into sheets without shattering - true of metals, where layers slide through the electron sea.'),
  card('Ductile', 'Can be drawn out into wire - another property metallic bonding gives metals.'),
  card('Alloy', 'A mixture of a metal with one or more other elements that keeps metallic properties, like steel or brass.'),
]

/**
 * The electrons-in-atoms chapter: light and photons through quantum numbers and configurations,
 * in our own words. The configuration examples and the filling order are re-checked numerically
 * by the tests (electron counts against the element table, the order against the n+l rule).
 */
const CHEM_ELECTRON_CARDS: readonly StudyDraftCard[] = [
  // Light and quanta
  card('Electromagnetic radiation', 'Energy that travels through space as waves: radio waves, visible light, X-rays, and the rest of the spectrum.'),
  card('Wavelength (λ)', 'The distance from one crest of a wave to the next. Longer wavelength means lower frequency and lower energy.'),
  card('Frequency (ν)', 'How many wave cycles pass a point each second, measured in hertz (Hz).'),
  card('c = λν', 'Wavelength times frequency equals the speed of light (3.00 × 10⁸ m/s) - so wavelength and frequency are inversely related.'),
  card('Electromagnetic spectrum, lowest to highest energy', 'Radio, microwave, infrared, visible, ultraviolet, X-ray, gamma ray.'),
  card('Visible light', 'The narrow slice the eye sees, about 700 nm (red, lowest energy) to 400 nm (violet, highest energy) - ROYGBIV.'),
  card('Quantum', 'The smallest step of energy an atom can gain or lose. Energy changes in fixed steps, not in a smooth flow.'),
  card('E = hν', "A quantum of radiation carries energy equal to Planck's constant (h = 6.626 × 10⁻³⁴ J·s) times the frequency: higher frequency, higher energy."),
  card('Photon', 'A particle of light that carries one quantum of energy.'),
  card('Photoelectric effect', "Light shining on a metal knocks electrons off - but only when the light's frequency is above a threshold. Dim violet light can do what bright red light cannot."),
  card('What the photoelectric effect proved', 'Light acts as particles: a single photon must carry enough energy by itself to free one electron, so frequency decides and brightness alone does not.'),
  card('Wave-particle duality', 'Light (and matter) behaves as a wave in some experiments and as a particle in others.'),
  card("de Broglie's idea", 'Moving particles have wavelengths too: electrons behave as waves, which is why the quantum model treats them that way.'),
  card('Atomic emission spectrum', "The set of specific colored lines an element gives off when its excited electrons fall back down. Each element's lines are unique - a fingerprint."),
  card('Why emission spectra are lines, not rainbows', 'Electrons sit only at fixed energy levels, so the light given off carries only the exact differences between those levels.'),
  card('Ground state', 'An atom with every electron in the lowest-energy arrangement available.'),
  card('Excited state', 'An atom after an electron has absorbed energy and jumped to a higher level. It falls back to the ground state by giving off light.'),
  card('Bohr model', "Electrons travel in fixed circular orbits with set energies. It explained hydrogen's spectrum but fails for every other element."),
  // The quantum mechanical model
  card('Quantum mechanical model', 'The modern model of the atom: mathematics that gives the probability of finding an electron in a region, not a path it follows.'),
  card('How the quantum model differs from Bohr', 'Electrons do not orbit in perfect circles. They occupy orbitals - fuzzy regions where they are likely to be found.'),
  card('Heisenberg uncertainty principle', 'It is impossible to know both the position and the velocity of a particle exactly at the same time.'),
  card('Electron cloud', 'A picture of where an electron spends its time: the darker the region, the higher the probability of finding the electron there.'),
  card('Orbital', 'A three-dimensional region around the nucleus where there is a high probability of finding an electron. One orbital holds at most 2 electrons.'),
  card('The four quantum numbers', "Principal (energy level), angular momentum (sublevel shape), magnetic (orientation), and spin (direction): together they describe one electron, and no two electrons in an atom share all four."),
  card('Principal quantum number (n)', 'The main energy level of an electron. Larger n means larger orbitals, farther from the nucleus, with more energy.'),
  card('Angular momentum quantum number (l)', 'Which sublevel the electron is in - the orbital shape. l runs from 0 to n − 1, so level n has n sublevels, designated s, p, d, or f.'),
  card('Magnetic quantum number', "The orientation of an orbital in space around the nucleus. An s orbital is a sphere, so its orientation doesn't matter."),
  card('Spin quantum number', 'The direction an electron spins - clockwise or counterclockwise - which creates a magnetic field. Two electrons sharing an orbital must have opposite spins.'),
  card('s, p, d, f: how many orbitals', 's has 1 orbital, p has 3, d has 5, f has 7 - and each orbital holds up to 2 electrons.'),
  card('s, p, d, f: how many electrons', 's holds up to 2 electrons, p holds 6, d holds 10, f holds 14.'),
  card('Most electrons energy level n can hold', '2n² - level 1 holds 2, level 2 holds 8, level 3 holds 18, level 4 holds 32.'),
  card('Shape of an s orbital', 'A sphere centered on the nucleus.'),
  card('Shape of a p orbital', 'A dumbbell (figure eight) along one of three axes - which is why there are three p orbitals.'),
  // Rules and configurations
  card('Pauli exclusion principle', 'No two electrons in an atom can have the same four quantum numbers - so an orbital holds at most two electrons, and they must have opposite spins.'),
  card('Aufbau principle', 'Electrons fill the lowest-energy orbitals first. Because the sublevels of different levels overlap, 4s fills before 3d.'),
  card("Hund's rule", 'In orbitals of equal energy, every orbital gets one electron - all spinning the same way - before any orbital gets a second.'),
  card('Orbital filling order', '1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p (the diagonal chart).'),
  card('Electron configuration', "The arrangement of an atom's electrons: the sublevels in filling order, each with its electron count as a superscript, like 1s² 2s² 2p⁴."),
  card('Orbital diagram', 'One box per orbital with an arrow per electron. Opposite arrows are opposite spins, and every orbital of a used sublevel is drawn even if it is empty.'),
  card('Valence electrons', "The electrons in the highest principal energy level. They are responsible for an element's chemical behavior, and an atom can have at most 8 (a full s and p)."),
  card('Noble gas notation', 'For period 3 and beyond: write the previous noble gas in brackets, then the rest of the configuration - sodium is [Ne] 3s¹.'),
  card('Electron configuration: oxygen (Z = 8)', '1s² 2s² 2p⁴'),
  card('Electron configuration: sodium (Z = 11)', '[Ne] 3s¹'),
  card('Electron configuration: chlorine (Z = 17)', '[Ne] 3s² 3p⁵'),
  card('Electron configuration: calcium (Z = 20)', '[Ar] 4s²'),
  card('Electron configuration: iron (Z = 26)', '[Ar] 4s² 3d⁶'),
]

// --- SAT transitions -------------------------------------------------------------------------------------

/** 'cause→effect' prints as a readable card label. */
const RELATION_CARD_LABELS: Readonly<Record<string, string>> = {
  contrast: 'Contrast',
  'cause→effect': 'Cause and effect',
  example: 'Example',
  addition: 'Addition',
  sequence: 'Sequence (time order)',
}

function transitionCards(): StudyDraftCard[] {
  const out: StudyDraftCard[] = []
  for (const group of transitionGlossary()) {
    const label = RELATION_CARD_LABELS[group.label] ?? capitalize(group.label)
    for (const word of group.words) out.push(card(word.replace(/,$/, ''), `${label} - signals ${group.signals}.`))
    out.push(card(`${label} transitions`, group.words.map((word) => word.replace(/,$/, '')).join(', ')))
  }
  return out
}

// --- the decks -------------------------------------------------------------------------------------------

let DECKS: StarterDeck[] | null = null

function buildDecks(): StarterDeck[] {
  return [
    {
      id: 'unit-circle',
      title: 'Unit circle',
      blurb: 'Exact values, radians, and which functions are positive where.',
      cards: unitCircleCards(),
    },
    {
      id: 'trig-identities',
      title: 'Trig identities & formulas',
      blurb: 'Pythagorean through half angle - every identity the trig units use.',
      cards: TRIG_IDENTITY_CARDS,
    },
    {
      id: 'log-rules',
      title: 'Logarithm & exponent rules',
      blurb: 'The log properties and the exponent rules behind them.',
      cards: LOG_RULE_CARDS,
    },
    {
      id: 'geometry-theorems',
      title: 'Geometry theorems & postulates',
      blurb: 'The reasons proofs use, from linear pairs to special right triangles.',
      cards: GEOMETRY_CARDS,
    },
    {
      id: 'polyatomic-ions',
      title: 'Polyatomic ions',
      blurb: 'Name to formula and charge, straight from the naming chapters.',
      subject: 'Chemistry',
      cards: polyatomicCards(),
    },
    {
      id: 'chem-vocab',
      title: 'Chemistry vocabulary: bonding & compounds',
      blurb: 'The chapter 7-8 terms, defined in plain words.',
      subject: 'Chemistry',
      cards: CHEM_VOCAB_CARDS,
    },
    {
      id: 'chem-electrons',
      title: 'Electrons in atoms: the quantum model',
      blurb: 'Photons, orbitals, the four quantum numbers, and electron configurations.',
      subject: 'Chemistry',
      cards: CHEM_ELECTRON_CARDS,
    },
    {
      id: 'element-symbols',
      title: 'Element symbols',
      blurb: 'Hydrogen through calcium, plus the heavier ones worth knowing.',
      subject: 'Chemistry',
      cards: elementCards(),
    },
    {
      id: 'sat-transitions',
      title: 'SAT transition words',
      blurb: 'Every transition the SAT questions draw from, by relationship.',
      subject: 'English',
      cards: transitionCards(),
    },
  ]
}

/** Every starter deck, chemistry and SAT included (tests check them all). */
export function allStarterDecks(): readonly StarterDeck[] {
  DECKS ??= buildDecks()
  return DECKS
}

/** The decks this build shows: the store app keeps its math-only scope. */
export function starterDecks(): readonly StarterDeck[] {
  return allStarterDecks().filter((deck) => includesSubject(deck.subject))
}
