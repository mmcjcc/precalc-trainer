/**
 * Chapter 9 templates. Every draw — molecule, parts, comparison pair, elements, prompt wording —
 * comes from makeRng(mixSeed(seed, k)), every seed is checked by assertCovalentBonding before it
 * ships, and a promised trap is a value that really grades to that id.
 */
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { CbCheck, CbStageId, CovalentBondingAnswer, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { formulaDisplay } from '@/engine'
import { assertCovalentBonding, canonicalCbAnswer, trapsForCb, type CbTrap } from './grade'
import {
  bondedAtoms,
  capName,
  cbElement,
  CENTRAL_POOL,
  CONTRAST_SALTS,
  containsH,
  DRAW_POOL,
  EN_PAIRS,
  enOf,
  moleculeOf,
  moleculeShape,
  MULTI_DIATOMICS,
  NONPOLAR_MOLECULES,
  pairWord,
  POLAR_MOLECULES,
  CATCH_FORMULAS,
  SINGLE_DIATOMICS,
  BOIL_PAIRS,
  FORCE_POOLS,
  atomLonePairs,
  type CbMolecule,
} from './facts'
import { BEND_PULL, BEND_RIGHT, BEND_VANISH, BOND_TYPE_TEXT, DUET_FILLER, DUET_OCTET, DUET_RIGHT, FORCE_TEXT, ORDER_TEXT, SHAPE_CHOICES } from './rules'
import { boilRight, boilSame, boilWrongs } from './sentences'

const MODULE_ID = 'covalentBonding' as const
const NO_CALC = { ti84: [], nspire: [] }
const STAGE_IDS: readonly CbStageId[] = ['a', 'b', 'c', 'd', 'e']

type CbQuestion = CovalentBondingAnswer['question']

interface BuiltStage {
  kind: 'text' | 'choice'
  label: string
  hint: string
  nudge: string
  ruleCard: string
  check: CbCheck
  choices?: { id: string; text: string }[]
  reveal: (answerText: string) => string
}

interface Drawn {
  prompt: string
  drafts: BuiltStage[]
  params: Record<string, number | string | boolean>
}

function attach(stage: BuiltStage, index: number): CovalentBondingAnswer['stages'][number] {
  const answerText = canonicalCbAnswer(stage.check)
  const traps = trapsForCb(stage.check)
  const choices = stage.choices?.map((choice) => {
    const trap = traps.find((item) => item.text === choice.id)
    return trap ? { id: choice.id, text: choice.text, trap: trap.id, witness: trap.witness } : { id: choice.id, text: choice.text }
  })
  return {
    id: STAGE_IDS[index] ?? 'a',
    kind: stage.kind,
    label: stage.label,
    hint: stage.hint,
    answerText,
    ...(choices ? { choices } : {}),
    nudge: stage.nudge,
    ruleCard: stage.ruleCard,
    reveal: [stage.reveal(answerText)],
    traps,
    check: stage.check,
  }
}

function promise(stages: CovalentBondingAnswer['stages'], rng: Rng) {
  const all = stages.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap: trap as CbTrap })))
  if (all.length === 0) return {}
  const chosen = rng.pick(all)
  return { trap: chosen.trap.id, trapStage: chosen.stage.id, trapAnswer: chosen.trap.text }
}

function buildAnswer(question: CbQuestion, prompt: string, drafts: BuiltStage[], rng: Rng): CovalentBondingAnswer {
  const stages = drafts.map((draft, index) => attach(draft, index))
  const ruleCards = [...new Set(stages.map((stage) => stage.ruleCard))]
  const promised = promise(stages, rng)
  return {
    type: 'covalentBonding',
    question,
    prompt,
    stages,
    expectedDisplay: stages.map((stage) => `${stage.label}: ${stage.answerText}`).join('; '),
    reveal: stages.map((stage) => stage.reveal[0]!),
    ruleCards,
    ...promised,
  }
}

function instance(
  spec: { id: string; title: string; version: number },
  seed: number,
  knobs: DifficultyKnobs,
  instructions: string,
  answer: CovalentBondingAnswer,
  params: Record<string, number | string | boolean>,
): ProblemInstance {
  return {
    id: problemId(MODULE_ID, spec.id, spec.version, seed),
    moduleId: MODULE_ID,
    templateId: spec.id,
    skill: spec.id,
    genVersion: spec.version,
    seed,
    knobs,
    kind: 'covalentBonding',
    title: spec.title,
    instructions,
    statementText: answer.prompt,
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: { kind: 'none' },
    calc: NO_CALC,
    params,
  }
}

function plural(answer: string, word: string): string {
  return `${answer} ${word}${answer === '1' ? '' : 's'}`
}

function show(m: CbMolecule): string {
  return formulaDisplay(m.formula)
}

// ---------------------------------------------------------------------------
// cb.electrons — inside one molecule
// ---------------------------------------------------------------------------

const ELECTRON_OPENERS: readonly ((m: CbMolecule) => string)[] = [
  (m) => `Take one molecule of ${m.name} (${show(m)}) apart on paper.`,
  (m) => `A whiff of ${m.name} is a crowd of identical ${show(m)} molecules. Look inside one of them.`,
  (m) => `Here is just one molecule of ${m.name}, ${show(m)}.`,
  (m) => `${capName(m.name)}, ${show(m)}, holds itself together with no ions anywhere in it. Work out how.`,
]

function bondTypeStage(subject: 'molecule' | 'salt', formula: string, shown: string, rng: Rng): BuiltStage {
  return {
    kind: 'choice',
    label: `The electrons in ${shown}`,
    hint: 'Choose one.',
    nudge: 'Match the pull to the atoms: two nonmetals hold on almost equally hard; a metal lets its outer electrons go.',
    ruleCard: 'cb.bond',
    check: { kind: 'bond-type', subject, formula },
    choices: rng.shuffle([
      { id: BOND_TYPE_TEXT.shared, text: BOND_TYPE_TEXT.shared },
      { id: BOND_TYPE_TEXT.transferred, text: BOND_TYPE_TEXT.transferred },
    ]),
    reveal: () =>
      subject === 'molecule'
        ? `Two nonmetals pull almost equally, so in ${shown} the bonding electrons are shared pairs.`
        : `A metal beside a nonmetal does not share: in ${shown} the electrons moved across and ions remain.`,
  }
}

function totalValenceStage(m: CbMolecule): BuiltStage {
  return {
    kind: 'text',
    label: 'Valence electrons in the molecule',
    hint: 'A whole number.',
    nudge: 'Add up every atom’s outer-shell share; each element’s group sets what one atom brings.',
    ruleCard: 'cb.octet',
    check: { kind: 'total-valence', formula: m.formula },
    reveal: (answer) => `Adding each atom’s share, ${show(m)} brings ${plural(answer, 'valence electron')} to the structure.`,
  }
}

function electronsCentralDrafts(m: CbMolecule): BuiltStage[] {
  return [
    totalValenceStage(m),
    {
      kind: 'text',
      label: 'Bonding pairs around the center',
      hint: 'A whole number.',
      nudge: 'Count the pairs that sit in bonds. A bond of higher order carries more than one of them.',
      ruleCard: 'cb.bond',
      check: { kind: 'bonding-pairs', formula: m.formula },
      reveal: (answer) => `${capName(m.name)}’s central atom holds ${plural(answer, 'bonding pair')} in its bonds.`,
    },
    {
      kind: 'text',
      label: 'Lone pairs on the central atom',
      hint: 'A whole number.',
      nudge: 'Only the pairs the central atom keeps to itself. Pairs sitting on the outer atoms are not in this count.',
      ruleCard: 'cb.bond',
      check: { kind: 'lone-pairs', formula: m.formula },
      reveal: (answer) => `After the bonds are drawn, the central atom keeps ${plural(answer, 'lone pair')} of its own.`,
    },
  ]
}

function electronsDiatomicDrafts(m: CbMolecule, rng: Rng): BuiltStage[] {
  return [
    totalValenceStage(m),
    {
      kind: 'choice',
      label: 'The bond',
      hint: 'Choose one.',
      nudge: 'Count the pairs the two atoms must share for both to reach a full shell.',
      ruleCard: 'cb.multiple',
      check: { kind: 'bond-order', formula: m.formula },
      choices: rng.shuffle([
        { id: ORDER_TEXT[1], text: ORDER_TEXT[1] },
        { id: ORDER_TEXT[2], text: ORDER_TEXT[2] },
        { id: ORDER_TEXT[3], text: ORDER_TEXT[3] },
      ]),
      reveal: (answer) => `Sharing until both shells fill makes the bond in ${show(m)} a ${answer.toLowerCase()} bond.`,
    },
    {
      kind: 'text',
      label: 'Electrons in that bond',
      hint: 'A whole number.',
      nudge: 'Pairs first, then double them: each shared pair carries two electrons.',
      ruleCard: 'cb.multiple',
      check: { kind: 'bond-electrons', formula: m.formula },
      reveal: (answer) => `That bond shares ${plural(answer, 'electron')} between the two atoms.`,
    },
  ]
}

function drawElectrons(rng: Rng): Drawn {
  const diatomic = rng.chance(0.5)
  const m = diatomic ? (rng.chance(0.5) ? rng.pick(MULTI_DIATOMICS) : rng.pick(SINGLE_DIATOMICS)) : rng.pick(CENTRAL_POOL)
  const saltSubject = rng.chance(0.45)
  const salt = rng.pick(CONTRAST_SALTS)
  const opener = rng.int(0, ELECTRON_OPENERS.length - 1)
  const saltShown = formulaDisplay(salt.formula)
  const first = saltSubject
    ? bondTypeStage('salt', salt.formula, saltShown, rng)
    : bondTypeStage('molecule', m.formula, show(m), rng)
  const prompt = saltSubject
    ? `${capName(salt.name)} (${saltShown}) is a crystal from last chapter; ${m.name} (${show(m)}) is this chapter’s molecule. Decide how the crystal holds together, then count inside the molecule.`
    : `${ELECTRON_OPENERS[opener]!(m)} Decide how it holds together, then count what is inside.`
  const rest = m.central ? electronsCentralDrafts(m) : electronsDiatomicDrafts(m, rng)
  return {
    prompt,
    drafts: [first, ...rest],
    params: { formula: m.formula, saltSubject, salt: salt.formula, opener },
  }
}

// ---------------------------------------------------------------------------
// cb.dots — a described dot structure
// ---------------------------------------------------------------------------

function pairPhrase(n: number): string {
  return `${pairWord(n)} pair${n === 1 ? '' : 's'}`
}

/** The structure read out in words — counts never appear as digits, so no part's answer does. */
export function describeDots(m: CbMolecule): string {
  if (m.central) {
    const outer = m.atoms[0]!
    const own = m.lonePairsCentral ?? 0
    const outerLone = atomLonePairs(outer.symbol, m.bondOrder)
    const head = `Each ${outer.symbol} shares ${pairPhrase(m.bondOrder)} with the ${m.central}`
    const central = own === 0 ? `the ${m.central} keeps no pairs of its own` : `the ${m.central} keeps ${pairPhrase(own)} of its own`
    const tail = outer.symbol === 'H' ? `each H holds nothing more` : `each ${outer.symbol} keeps ${pairPhrase(outerLone)} to itself`
    return `${head}; ${central}, and ${tail}.`
  }
  if (m.atoms.length === 1) {
    const a = m.atoms[0]!
    const lone = atomLonePairs(a.symbol, m.bondOrder)
    const tail = lone === 0 ? 'neither keeps any pair of its own' : `each keeps ${pairPhrase(lone)} to itself`
    return `The two ${a.symbol} atoms share ${pairPhrase(m.bondOrder)}, and ${tail}.`
  }
  const [x, y] = [m.atoms[0]!, m.atoms[1]!]
  const xLone = atomLonePairs(x.symbol, m.bondOrder)
  const yLone = atomLonePairs(y.symbol, m.bondOrder)
  const head = `${x.symbol} and ${y.symbol} share ${pairPhrase(m.bondOrder)}`
  const sides: string[] = []
  if (xLone === yLone && xLone > 0) {
    sides.push(`each keeps ${pairPhrase(xLone)} of its own`)
  } else {
    if (yLone > 0) sides.push(`the ${y.symbol} keeps ${pairPhrase(yLone)} to itself`)
    if (xLone > 0) sides.push(`the ${x.symbol} keeps ${pairPhrase(xLone)} to itself`)
    if (x.symbol === 'H') sides.push('the H holds nothing more')
    if (y.symbol === 'H') sides.push('the H holds nothing more')
  }
  return `${head}; ${sides.join(', and ')}.`
}

const DOTS_OPENERS: readonly ((m: CbMolecule, said: string) => string)[] = [
  (m, said) => `A classmate reads the dot structure of ${m.name} (${show(m)}) aloud: ${said}`,
  (m, said) => `Her sketch of ${m.name}, ${show(m)}, says this in words: ${said}`,
  (m, said) => `Written out instead of drawn, the dot structure of ${show(m)} reads: ${said}`,
  (m, said) => `Over the phone, a lab partner describes ${m.name} (${show(m)}): ${said}`,
  (m, said) => `The study guide sums up ${show(m)}, ${m.name}, like this: ${said}`,
]

function atomsIn(m: CbMolecule): string[] {
  const list = m.atoms.map((a) => a.symbol)
  return m.central ? [m.central, ...list] : [...new Set(list)]
}

function drawDots(rng: Rng): Drawn {
  const m = rng.pick(DRAW_POOL)
  const opener = rng.int(0, DOTS_OPENERS.length - 1)
  const withH = containsH(m)
  const candidates = atomsIn(m)
  const atom = withH && rng.chance(0.6) ? 'H' : rng.pick(candidates)
  const variant = rng.int(0, DUET_RIGHT.length - 1)
  const drafts: BuiltStage[] = [
    {
      kind: 'text',
      label: 'Shared pairs in the molecule',
      hint: 'A whole number.',
      nudge: 'Walk the description: every pair said to be shared counts once, and “each” multiplies.',
      ruleCard: 'cb.bond',
      check: { kind: 'shared-pairs', formula: m.formula },
      reveal: (answer) => `Adding every bond up, the molecule holds ${plural(answer, 'shared pair')}.`,
    },
    {
      kind: 'text',
      label: 'Unshared pairs in the molecule',
      hint: 'A whole number.',
      nudge: 'Now the kept pairs: add them over every atom in the molecule, not just one.',
      ruleCard: 'cb.bond',
      check: { kind: 'unshared-pairs', formula: m.formula },
      reveal: (answer) => `The pairs kept at home add up to ${plural(answer, 'unshared pair')}.`,
    },
    {
      kind: 'text',
      label: `Dots shown around ${atom}`,
      hint: 'A whole number of electrons.',
      nudge: 'Count every electron touching that atom: both electrons of each shared pair, plus the pairs it keeps.',
      ruleCard: 'cb.octet',
      check: { kind: 'atom-dots', formula: m.formula, atom },
      reveal: (answer) => `Shared pairs count for both of their atoms, so ${atom} sits inside ${plural(answer, 'electron')}.`,
    },
  ]
  if (withH) {
    drafts.push({
      kind: 'choice',
      label: 'Why hydrogen stops short',
      hint: 'Choose one.',
      nudge: 'Think about which shell hydrogen is filling — and how much room that shell has.',
      ruleCard: 'cb.octet',
      check: { kind: 'duet-why', variant },
      choices: rng.shuffle([
        { id: DUET_RIGHT[variant]!, text: DUET_RIGHT[variant]! },
        { id: DUET_OCTET[variant]!, text: DUET_OCTET[variant]! },
        { id: DUET_FILLER[variant]!, text: DUET_FILLER[variant]! },
      ]),
      reveal: (answer) => `${answer} — that is hydrogen’s duet, beside everyone else’s octet.`,
    })
  }
  return {
    prompt: DOTS_OPENERS[opener]!(m, `“${describeDots(m)}”`),
    drafts,
    params: { formula: m.formula, atom, opener, variant },
  }
}

// ---------------------------------------------------------------------------
// cb.shape — VSEPR
// ---------------------------------------------------------------------------

const SHAPE_MOLECULE_OPENERS: readonly ((m: CbMolecule) => string)[] = [
  (m) => `Build ${m.name} (${show(m)}) in your head, electron groups and all.`,
  (m) => `A model kit question: what does one molecule of ${m.name}, ${show(m)}, look like?`,
  (m) => `Picture the central atom of ${show(m)} with everything that crowds around it.`,
  (m) => `${capName(m.name)}, ${show(m)}, has a shape the chapter names exactly.`,
]

const SHAPE_STATED_OPENERS: readonly ((bonded: number, lone: number) => string)[] = [
  (b, l) => `A central atom holds ${pairPhrase(b).replace('pair', 'bonding pair')} and ${lonePhrase(l)}.`,
  (b, l) => `On the board: a molecule whose central atom carries ${pairPhrase(b).replace('pair', 'bonding pair')} and ${lonePhrase(l)}.`,
  (b, l) => `A sketch shows ${pairPhrase(b).replace('pair', 'bonding pair')} around the central atom, with ${lonePhrase(l)} on it.`,
  (b, l) => `Imagine a central atom bonded through ${pairPhrase(b).replace('pair', 'bonding pair')}, keeping ${lonePhrase(l)}.`,
]

function lonePhrase(lone: number): string {
  return lone === 0 ? 'no lone pairs' : `${pairWord(lone)} lone pair${lone === 1 ? '' : 's'}`
}

const STATED_CONFIGS: readonly [number, number][] = [
  [2, 0],
  [3, 0],
  [4, 0],
  [3, 1],
  [2, 2],
]

function shapeDrafts(bonded: number, lone: number, variant: number, rng: Rng): BuiltStage[] {
  const drafts: BuiltStage[] = [
    {
      kind: 'choice',
      label: 'The shape',
      hint: 'Choose one.',
      nudge: 'Count the electron groups first — lone pairs take corners too — then name what the atoms draw.',
      ruleCard: 'cb.vsepr',
      check: { kind: 'shape', bonded, lone },
      choices: rng.shuffle(SHAPE_CHOICES.map((shape) => ({ id: shape, text: shape }))),
      reveal: (answer) => `The groups spread out, the atoms draw the figure: ${answer.toLowerCase()}.`,
    },
    {
      kind: 'text',
      label: 'The bond angle',
      hint: 'Degrees, as a number.',
      nudge:
        lone > 0
          ? 'Start from the arrangement’s own spread, then let the lone pairs squeeze the bonds a little closer.'
          : 'The angle comes with the arrangement — picture the groups spreading as far as they can get.',
      ruleCard: 'cb.vsepr',
      check: { kind: 'angle', bonded, lone },
      reveal: (answer) => `Spread as far as the groups allow, the bonds sit near ${answer} degrees.`,
    },
  ]
  if (lone > 0) {
    drafts.push({
      kind: 'choice',
      label: 'Why the lone pairs change the shape',
      hint: 'Choose one.',
      nudge: 'Picture every electron group in place, then ask which of them the name actually mentions.',
      ruleCard: 'cb.vsepr',
      check: { kind: 'bend-why', variant },
      choices: rng.shuffle([
        { id: BEND_RIGHT[variant]!, text: BEND_RIGHT[variant]! },
        { id: BEND_PULL[variant]!, text: BEND_PULL[variant]! },
        { id: BEND_VANISH[variant]!, text: BEND_VANISH[variant]! },
      ]),
      reveal: (answer) => `${answer}.`,
    })
  }
  return drafts
}

function drawShape(rng: Rng): Drawn {
  const fromMolecule = rng.chance(0.6)
  const variant = rng.int(0, BEND_RIGHT.length - 1)
  if (fromMolecule) {
    const m = rng.pick(CENTRAL_POOL)
    const bonded = bondedAtoms(m)
    const lone = m.lonePairsCentral ?? 0
    const opener = rng.int(0, SHAPE_MOLECULE_OPENERS.length - 1)
    return {
      prompt: `${SHAPE_MOLECULE_OPENERS[opener]!(m)} Name the shape, then the angle.`,
      drafts: shapeDrafts(bonded, lone, variant, rng),
      params: { formula: m.formula, bonded, lone, opener, variant },
    }
  }
  const [bonded, lone] = rng.pick(STATED_CONFIGS)
  const opener = rng.int(0, SHAPE_STATED_OPENERS.length - 1)
  return {
    prompt: `${SHAPE_STATED_OPENERS[opener]!(bonded, lone)} Name the shape, then the angle.`,
    drafts: shapeDrafts(bonded, lone, variant, rng),
    params: { formula: '', bonded, lone, opener, variant },
  }
}

// ---------------------------------------------------------------------------
// cb.polarity — difference, band, then a whole molecule
// ---------------------------------------------------------------------------

const EN_OPENERS: readonly ((a: string, b: string, enA: string, enB: string) => string)[] = [
  (a, b, enA, enB) => `On the electronegativity scale, ${a} sits at ${enA} and ${b} sits at ${enB}.`,
  (a, b, enA, enB) => `A reference table gives ${a} an electronegativity of ${enA} and ${b} one of ${enB}.`,
  (a, b, enA, enB) => `${capName(a)} pulls bonding electrons at ${enA}; ${b} pulls at ${enB}.`,
]

function shapeDescriptor(m: CbMolecule): string {
  if (!m.central) return 'two-atom'
  return moleculeShape(m).toLowerCase()
}

const MOLECULE_POLAR_SENTENCES: readonly ((m: CbMolecule) => string)[] = [
  (m) => `Separately: ${m.name} (${show(m)}) is a ${shapeDescriptor(m)} molecule — is the whole molecule polar or nonpolar?`,
  (m) => `And one molecule to judge: ${show(m)}, ${m.name}, is ${shapeDescriptor(m)}. Polar molecule, or nonpolar?`,
]

function drawPolarity(rng: Rng): Drawn {
  const pair = rng.pick(EN_PAIRS)
  const flip = rng.chance(0.5)
  const [a, b] = flip ? [pair[1], pair[0]] : pair
  const opener = rng.int(0, EN_OPENERS.length - 1)
  const catchDraw = rng.chance(0.3)
  const m = catchDraw ? moleculeOf(rng.pick(CATCH_FORMULAS)) : rng.chance(0.65) ? rng.pick(POLAR_MOLECULES) : rng.pick(NONPOLAR_MOLECULES)
  const sentence = rng.int(0, MOLECULE_POLAR_SENTENCES.length - 1)
  const nameA = cbElement(a).name
  const nameB = cbElement(b).name
  const prompt = `${EN_OPENERS[opener]!(nameA, nameB, enOf(a).toFixed(2), enOf(b).toFixed(2))} ${MOLECULE_POLAR_SENTENCES[sentence]!(m)}`
  return {
    prompt,
    drafts: [
      {
        kind: 'text',
        label: 'The electronegativity difference',
        hint: 'A decimal, to the hundredth.',
        nudge: 'Line the two values up and take the gap between them.',
        ruleCard: 'cb.bands',
        check: { kind: 'en-diff', a, b },
        reveal: (answer) => `Larger minus smaller: the two pulls sit ${answer} apart.`,
      },
      {
        kind: 'choice',
        label: 'That bond would be',
        hint: 'Choose one.',
        nudge: 'Hold your difference against the two cutoffs on the card.',
        ruleCard: 'cb.bands',
        check: { kind: 'bond-class', a, b },
        choices: rng.shuffle([
          { id: 'Nonpolar covalent', text: 'Nonpolar covalent' },
          { id: 'Polar covalent', text: 'Polar covalent' },
          { id: 'Ionic', text: 'Ionic' },
        ]),
        reveal: (answer) => `That difference lands the ${nameA}–${nameB} bond in the ${answer.toLowerCase()} band.`,
      },
      {
        kind: 'choice',
        label: 'The molecule as a whole',
        hint: 'Choose one.',
        nudge: 'Two checks in one: do the bonds pull unevenly, and does the shape let those pulls cancel?',
        ruleCard: 'cb.polar',
        check: { kind: 'molecule-polar', formula: m.formula },
        choices: rng.shuffle([
          { id: 'Polar', text: 'Polar' },
          { id: 'Nonpolar', text: 'Nonpolar' },
        ]),
        reveal: (answer) => `Bonds and shape together make ${show(m)} a ${answer.toLowerCase()} molecule.`,
      },
    ],
    params: { a, b, formula: m.formula, opener, sentence, catchDraw },
  }
}

// ---------------------------------------------------------------------------
// cb.forces — between molecules
// ---------------------------------------------------------------------------

const FORCE_OPENERS: readonly ((m: CbMolecule) => string)[] = [
  (m) => `A sealed flask of ${m.name} (${show(m)}) sits on the bench.`,
  (m) => `A sample of pure ${m.name}, ${show(m)}, waits in a flask.`,
]

function drawForces(rng: Rng): Drawn {
  const category = rng.pick(['hbond', 'dipole', 'dispersion'] as const)
  const sample = rng.pick(FORCE_POOLS[category])
  const roll = rng.next()
  const pairPool = roll < 0.35 ? BOIL_PAIRS.filter((p) => p.kind === 'hbond') : roll < 0.55 ? BOIL_PAIRS.filter((p) => p.kind === 'dipole') : BOIL_PAIRS.filter((p) => p.kind === 'size')
  const pair = rng.pick(pairPool)
  const opener = rng.int(0, FORCE_OPENERS.length - 1)
  const aName = moleculeOf(pair.a).name
  const bName = moleculeOf(pair.b).name
  const same = boilSame(pair.a, pair.b)
  const boilChoices = [boilRight(pair.a, pair.b), ...(same ? [same] : []), ...boilWrongs(pair.a, pair.b)]
  return {
    prompt: `${FORCE_OPENERS[opener]!(sample)} What holds its molecules near each other? Then compare two more samples: ${aName} (${formulaDisplay(pair.a)}) and ${bName} (${formulaDisplay(pair.b)}).`,
    drafts: [
      {
        kind: 'choice',
        label: `The force between ${show(sample)} molecules`,
        hint: 'Choose one.',
        nudge: 'Dispersion is always there. Ask what this molecule adds: a lopsided pull overall, or an H sitting on N, O or F.',
        ruleCard: 'cb.forces',
        check: { kind: 'force', formula: sample.formula },
        choices: rng.shuffle([
          { id: FORCE_TEXT.dispersion, text: FORCE_TEXT.dispersion },
          { id: FORCE_TEXT.dipole, text: FORCE_TEXT.dipole },
          { id: FORCE_TEXT.hbond, text: FORCE_TEXT.hbond },
        ]),
        reveal: (answer) => `For ${show(sample)}, the strongest grip between molecules is: ${answer.toLowerCase()}.`,
      },
      {
        kind: 'choice',
        label: 'Which boils higher',
        hint: 'Choose one.',
        nudge: 'The sample whose molecules grip each other harder needs more heat to fly apart.',
        ruleCard: 'cb.forces',
        check: { kind: 'boil', a: pair.a, b: pair.b },
        choices: rng.shuffle(boilChoices.map((text) => ({ id: text, text }))),
        reveal: (answer) => `${answer}.`,
      },
    ],
    params: { formula: sample.formula, pairA: pair.a, pairB: pair.b, opener },
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATE_SALT: Record<string, number> = {
  'cb.electrons': 91,
  'cb.dots': 92,
  'cb.shape': 93,
  'cb.polarity': 94,
  'cb.forces': 95,
}

function makeTemplate(id: string, question: CbQuestion, title: string, description: string, instructions: string, draw: (rng: Rng) => Drawn): TemplateDef {
  return {
    id,
    title,
    description,
    version: 1,
    knobs: [],
    generate: (seed, knobs) => {
      const rng = makeRng(mixSeed(seed, TEMPLATE_SALT[id]!))
      const drawn = draw(rng)
      const answer = buildAnswer(question, drawn.prompt, drawn.drafts, rng)
      assertCovalentBonding(`${id}@${seed}`, answer)
      return instance({ id, title, version: 1 }, seed, knobs, instructions, answer, { ...drawn.params, trap: answer.trap ?? '' })
    },
  }
}

export const electronsTemplate = makeTemplate(
  'cb.electrons',
  'electrons',
  'Inside one molecule',
  'Shared or transferred, the molecule’s valence electrons, and its pairs: bonding and lone around a center, or the order and electron count of a diatomic’s bond.',
  'Answer each part. Counts are whole numbers.',
  drawElectrons,
)

export const dotsTemplate = makeTemplate(
  'cb.dots',
  'dots',
  'Reading a dot structure',
  'A dot structure described in words: shared pairs, unshared pairs, the electrons around one named atom, and hydrogen’s duet.',
  'Answer each part from the description. Counts are whole numbers.',
  drawDots,
)

export const shapeTemplate = makeTemplate(
  'cb.shape',
  'shape',
  'The shape of a molecule',
  'VSEPR: the molecular shape, its approximate bond angle, and what the lone pairs do to both.',
  'Answer each part. Type the angle as a number of degrees.',
  drawShape,
)

export const polarityTemplate = makeTemplate(
  'cb.polarity',
  'polarity',
  'Polar bonds, polar molecules',
  'The electronegativity difference to the hundredth, the band it falls in, and whether a whole molecule is polar — symmetric catches included.',
  'Answer each part. The difference is a decimal to the hundredth.',
  drawPolarity,
)

export const forcesTemplate = makeTemplate(
  'cb.forces',
  'forces',
  'Forces between molecules',
  'Dispersion, dipole attraction or hydrogen bonding for a sample, and which of two samples boils higher — pairs that differ in exactly the force being tested.',
  'Choose the force, then the comparison that explains the higher boil.',
  drawForces,
)

export const CB_TEMPLATES: readonly TemplateDef[] = [electronsTemplate, dotsTemplate, shapeTemplate, polarityTemplate, forcesTemplate]
