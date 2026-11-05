/**
 * Chapter 8 templates. Every seed is checked against the element table and the chem engines
 * before it ships, and a promised trap is a value that really grades to that id.
 */
import { problemId } from '@/content/registry'
import { makeRng, type Rng } from '@/content/rng'
import type { DifficultyKnobs, IbCheck, IbScenario, IbStageId, IonicBondingAnswer, MbAsk, ProblemInstance, TemplateDef } from '@/content/types'
import { formulaDisplay, IDE_NAMES } from '@/engine'
import type { ElementInfo } from '@/engine/chem/elements'
import { assertIonicBonding, canonicalIbAnswer, trapsForIb, type IbTrap } from './grade'
import {
  atomConfigText,
  capName,
  chargeOf,
  DOTS_ION_POOL,
  DOTS_NEUTRAL_POOL,
  ionTextOf,
  SEA_METALS,
  TRANSFER_METALS,
  TRANSFER_NONMETALS,
  TRANSFER_PAIRS,
  VALENCE_POOL,
} from './facts'
import { GAIN_LOSE_TEXT, DOTS_STAND_TEXT, PROPS_WRONG, SEA_WRONG } from './rules'

const MODULE_ID = 'ionicBonding' as const
const NO_CALC = { ti84: [], nspire: [] }
const STAGE_IDS: readonly IbStageId[] = ['a', 'b', 'c', 'd', 'e']

type IbQuestion = IonicBondingAnswer['question']

interface BuiltStage {
  kind: 'text' | 'choice'
  label: string
  hint: string
  nudge: string
  ruleCard: string
  check: IbCheck
  accept?: string[]
  choices?: { id: string; text: string }[]
  reveal: (answerText: string) => string
}

interface Drawn {
  prompt: string
  drafts: BuiltStage[]
  params: Record<string, number | string | boolean>
}

function attach(stage: BuiltStage, index: number): IonicBondingAnswer['stages'][number] {
  const answerText = canonicalIbAnswer(stage.check)
  const traps = trapsForIb(stage.check)
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
    ...(stage.accept ? { accept: stage.accept } : {}),
    ...(choices ? { choices } : {}),
    nudge: stage.nudge,
    ruleCard: stage.ruleCard,
    reveal: [stage.reveal(answerText)],
    traps,
    check: stage.check,
  }
}

function promise(stages: IonicBondingAnswer['stages'], rng: Rng) {
  const all = stages.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap: trap as IbTrap })))
  if (all.length === 0) return {}
  const chosen = rng.pick(all)
  return { trap: chosen.trap.id, trapStage: chosen.stage.id, trapAnswer: chosen.trap.text }
}

function buildAnswer(question: IbQuestion, prompt: string, drafts: BuiltStage[], rng: Rng): IonicBondingAnswer {
  const stages = drafts.map((draft, index) => attach(draft, index))
  const ruleCards = [...new Set(stages.map((stage) => stage.ruleCard))]
  const promised = promise(stages, rng)
  return {
    type: 'ionicBonding',
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
  answer: IonicBondingAnswer,
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
    kind: 'ionicBonding',
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

// ---------------------------------------------------------------------------
// ib.valence — from element to ion
// ---------------------------------------------------------------------------

const VALENCE_NAME_OPENERS: readonly ((el: ElementInfo) => string)[] = [
  (el) => `What ion does ${el.name} (${el.symbol}) form?`,
  (el) => `Follow ${el.name} (${el.symbol}) from atom to ion.`,
  (el) => `${capName(el.name)} (${el.symbol}) reacts and becomes an ion. Work out which one.`,
  (el) => `In a compound, ${el.name} (${el.symbol}) shows up as an ion. Find it.`,
]

const VALENCE_CONFIG_OPENERS: readonly ((config: string) => string)[] = [
  (config) => `A neutral atom has the configuration ${config}. What ion will it form?`,
  (config) => `Read this neutral atom: ${config}. Follow it into its ion.`,
  (config) => `An atom's configuration is ${config}. Work out the ion it becomes.`,
]

function valenceDrafts(el: ElementInfo, rng: Rng): BuiltStage[] {
  const loses = chargeOf(el.z) > 0
  return [
    {
      kind: 'text',
      label: 'Valence electrons',
      hint: 'A whole number.',
      nudge: 'Count only the electrons of the highest shell. A filled d subshell underneath stays out of the count.',
      ruleCard: 'ib.octet',
      check: { kind: 'valence', z: el.z },
      reveal: (answer) => `Only the outer shell counts: ${el.name} has ${plural(answer, 'valence electron')}.`,
    },
    {
      kind: 'choice',
      label: 'Which way do the electrons go?',
      hint: 'Choose one.',
      nudge: 'A metal sheds its few outer electrons; a nonmetal collects the few its outer shell is missing.',
      ruleCard: 'ib.octet',
      check: { kind: 'gain-lose', z: el.z },
      choices: rng.shuffle([
        { id: GAIN_LOSE_TEXT.lose, text: GAIN_LOSE_TEXT.lose },
        { id: GAIN_LOSE_TEXT.gain, text: GAIN_LOSE_TEXT.gain },
      ]),
      reveal: () => (loses ? `${capName(el.name)} sheds its outer electrons to uncover the full shell underneath.` : `${capName(el.name)} collects electrons to finish its outer shell.`),
    },
    {
      kind: 'text',
      label: 'How many electrons move',
      hint: 'A whole number.',
      nudge: 'The count of the move is the distance to the nearest full shell.',
      ruleCard: 'ib.octet',
      check: { kind: 'move-count', z: el.z },
      reveal: (answer) => `${capName(el.name)} is ${plural(answer, 'electron')} away from a noble gas, so that many move.`,
    },
    {
      kind: 'text',
      label: 'The ion',
      hint: 'The symbol with its charge, like Fr^+.',
      nudge: 'Electrons are negative: shedding them leaves a plus behind, and collecting them brings a minus in.',
      ruleCard: 'ib.ion',
      check: { kind: 'ion', z: el.z },
      reveal: (answer) => `Balance the move against the protons: the ion is ${formulaDisplay(answer)}.`,
    },
    {
      kind: 'text',
      label: 'Ion configuration',
      hint: 'A noble gas in square brackets, then any subshells that follow.',
      nudge: 'Write the ion as it is after the move, not the atom it came from.',
      ruleCard: 'ib.config',
      check: { kind: 'ion-config', z: el.z },
      reveal: (answer) => `After the move it matches a noble gas: ${answer}.`,
    },
  ]
}

function drawValence(rng: Rng): Drawn {
  const el = rng.pick(VALENCE_POOL)
  const form = rng.pick(['name', 'config'] as const)
  const opener = form === 'name' ? rng.int(0, VALENCE_NAME_OPENERS.length - 1) : rng.int(0, VALENCE_CONFIG_OPENERS.length - 1)
  const prompt = form === 'name' ? VALENCE_NAME_OPENERS[opener]!(el) : VALENCE_CONFIG_OPENERS[opener]!(atomConfigText(el.z))
  return { prompt, drafts: valenceDrafts(el, rng), params: { z: el.z, form, opener } }
}

// ---------------------------------------------------------------------------
// ib.dots — electron-dot counts
// ---------------------------------------------------------------------------

const DOTS_ATOM_OPENERS: readonly ((el: ElementInfo) => string)[] = [
  (el) => `How many dots does the electron-dot symbol of ${el.name} (${el.symbol}) show?`,
  (el) => `Draw the electron-dot symbol of ${el.name} (${el.symbol}) in your head. Count its dots.`,
  (el) => `${capName(el.name)} (${el.symbol}) gets an electron-dot symbol. How many dots ring it?`,
]

const DOTS_ION_OPENERS: readonly ((shown: string) => string)[] = [
  (shown) => `How many dots does the electron-dot symbol of the ion ${shown} show?`,
  (shown) => `Draw the electron-dot symbol of ${shown} in your head. Count its dots.`,
  (shown) => `The ion ${shown} gets an electron-dot symbol. How many dots ring it?`,
]

function dotsDrafts(el: ElementInfo, charge: number, rng: Rng): BuiltStage[] {
  return [
    {
      kind: 'text',
      label: 'Dots shown',
      hint: 'A whole number.',
      nudge:
        charge === 0
          ? 'Dots are the outermost shell as it stands. Count those electrons only.'
          : 'The electrons have already moved. Draw what is left, not the neutral atom.',
      ruleCard: 'ib.dots',
      check: { kind: 'dots', z: el.z, charge },
      reveal: (answer) =>
        charge === 0
          ? `The outer shell of ${el.name} holds ${plural(answer, 'electron')}, so the symbol shows ${plural(answer, 'dot')}.`
          : charge > 0
            ? `The cation emptied its outer shell, so the symbol shows ${plural(answer, 'dot')}.`
            : `The anion finished its octet, so the symbol shows ${plural(answer, 'dot')}.`,
    },
    {
      kind: 'choice',
      label: 'What the dots stand for',
      hint: 'Choose one.',
      nudge: 'The symbol in the middle already covers the nucleus and every inner electron.',
      ruleCard: 'ib.dots',
      check: { kind: 'dots-stand', z: el.z, charge },
      choices: rng.shuffle([
        { id: DOTS_STAND_TEXT.valence, text: DOTS_STAND_TEXT.valence },
        { id: DOTS_STAND_TEXT.all, text: DOTS_STAND_TEXT.all },
        { id: DOTS_STAND_TEXT.moved, text: DOTS_STAND_TEXT.moved },
      ]),
      reveal: (answer) => `The dots stand for ${answer.charAt(0).toLowerCase()}${answer.slice(1)}.`,
    },
  ]
}

function drawDots(rng: Rng): Drawn {
  const species = rng.pick(['atom', 'ion'] as const)
  const el = species === 'atom' ? rng.pick(DOTS_NEUTRAL_POOL) : rng.pick(DOTS_ION_POOL)
  const charge = species === 'atom' ? 0 : chargeOf(el.z)
  const opener = rng.int(0, 2)
  const prompt = species === 'atom' ? DOTS_ATOM_OPENERS[opener]!(el) : DOTS_ION_OPENERS[opener]!(formulaDisplay(ionTextOf(el.z)))
  return { prompt, drafts: dotsDrafts(el, charge, rng), params: { z: el.z, charge, opener } }
}

// ---------------------------------------------------------------------------
// ib.transfer — forming a compound
// ---------------------------------------------------------------------------

const TRANSFER_OPENERS: readonly ((metal: ElementInfo, nonmetal: ElementInfo) => string)[] = [
  (m, n) => `${capName(m.name)} reacts with ${n.name}. Build the compound they form.`,
  (m, n) => `${capName(m.name)} meets ${n.name}, and electrons change hands. Follow them into the formula.`,
]

function transferDrafts(metal: ElementInfo, nonmetal: ElementInfo): BuiltStage[] {
  return [
    {
      kind: 'text',
      label: 'Metal ion',
      hint: 'The symbol with its charge, like Fr^+.',
      nudge: 'The metal sheds its outer electrons, and each one that leaves takes a minus with it.',
      ruleCard: 'ib.ion',
      check: { kind: 'ion', z: metal.z },
      reveal: (answer) => `${capName(metal.name)} sheds its outer electrons and becomes ${formulaDisplay(answer)}.`,
    },
    {
      kind: 'text',
      label: 'Nonmetal ion',
      hint: 'The symbol with its charge, like Fr^+.',
      nudge: 'The nonmetal collects just enough electrons to finish its outer shell.',
      ruleCard: 'ib.ion',
      check: { kind: 'ion', z: nonmetal.z },
      reveal: (answer) => `${capName(nonmetal.name)} finishes its octet and becomes ${formulaDisplay(answer)}.`,
    },
    {
      kind: 'text',
      label: 'Ions per formula unit',
      hint: 'Two whole numbers with a colon between them, cations first.',
      nudge: 'Criss-cross the sizes of the two charges, then reduce to lowest terms.',
      ruleCard: 'ib.crisscross',
      check: { kind: 'ratio', cationZ: metal.z, anionZ: nonmetal.z },
      reveal: (answer) => `Criss-cross and reduce: ${answer}, cations to anions, cancels all the plus with all the minus.`,
    },
    {
      kind: 'text',
      label: 'Formula unit',
      hint: 'Subscripts as plain numbers, like RaCl2.',
      nudge: 'Cation first. The subscripts must cancel all the plus with all the minus, in lowest terms.',
      ruleCard: 'ib.crisscross',
      check: { kind: 'formula', cationZ: metal.z, anionZ: nonmetal.z },
      reveal: (answer) => `The neutral formula unit is ${formulaDisplay(answer)}.`,
    },
    {
      kind: 'text',
      label: 'Electrons moved per unit',
      hint: 'A whole number.',
      nudge: 'Multiply one cation’s loss by how many cations the unit holds.',
      ruleCard: 'ib.transfer',
      check: { kind: 'transfer-count', cationZ: metal.z, anionZ: nonmetal.z },
      reveal: (answer) => `In one formula unit, ${plural(answer, 'electron')} change hands.`,
    },
  ]
}

function drawTransfer(rng: Rng): Drawn {
  const { metal, nonmetal } = rng.pick(TRANSFER_PAIRS)
  const opener = rng.int(0, TRANSFER_OPENERS.length - 1)
  return {
    prompt: TRANSFER_OPENERS[opener]!(metal, nonmetal),
    drafts: transferDrafts(metal, nonmetal),
    params: { metal: metal.z, nonmetal: nonmetal.z, opener },
  }
}

// ---------------------------------------------------------------------------
// ib.props — properties of ionic compounds
// ---------------------------------------------------------------------------

const PROPS_PROMPTS: Record<IbScenario, (compound: string) => string> = {
  melt: (compound) => `A crystal of ${compound} stays solid far past the hottest kitchen flame. Why is it so hard to melt?`,
  brittle: (compound) => `Tap a crystal of ${compound} with a hammer and it shatters instead of denting. Why?`,
  conduct: (compound) => `Solid ${compound} does not light the bulb, but the molten liquid does. What changed?`,
  dissolve: (compound) => `Solid ${compound} does not conduct, but its solution in water does. Why?`,
}

function compoundName(metal: ElementInfo, nonmetal: ElementInfo): string {
  const ide = IDE_NAMES[nonmetal.symbol]
  if (!ide) throw new Error(`ionicBonding: no -ide name for ${nonmetal.symbol}`)
  return `${metal.name} ${ide}`
}

function drawProps(rng: Rng): Drawn {
  const metal = rng.pick(TRANSFER_METALS)
  const nonmetal = rng.pick(TRANSFER_NONMETALS)
  const scenario = rng.pick(['melt', 'brittle', 'conduct', 'dissolve'] as const)
  const check: IbCheck = { kind: 'props', scenario }
  return {
    prompt: PROPS_PROMPTS[scenario](compoundName(metal, nonmetal)),
    drafts: [
      {
        kind: 'choice',
        label: 'The reason',
        hint: 'Choose one.',
        nudge: 'Picture the lattice: charged ions locked in place, pulled hard from every direction.',
        ruleCard: 'ib.lattice',
        check,
        choices: rng.shuffle([
          { id: canonicalIbAnswer(check), text: canonicalIbAnswer(check) },
          { id: PROPS_WRONG.electrons, text: PROPS_WRONG.electrons },
          { id: PROPS_WRONG.molecules, text: PROPS_WRONG.molecules },
          { id: PROPS_WRONG.weak, text: PROPS_WRONG.weak },
        ]),
        reveal: (answer) => `The lattice explains it: ${answer.charAt(0).toLowerCase()}${answer.slice(1)}.`,
      },
    ],
    params: { metal: metal.z, nonmetal: nonmetal.z, scenario },
  }
}

// ---------------------------------------------------------------------------
// mb.sea — metallic bonding
// ---------------------------------------------------------------------------

const SEA_PROMPTS: Record<MbAsk, readonly ((metal: string) => string)[]> = {
  conduct: [
    (metal) => `A ${metal} wire carries a current while completely solid. How?`,
    (metal) => `Solid ${metal} conducts electricity without melting first. What is doing the conducting?`,
  ],
  bend: [
    (metal) => `A ${metal} sheet flattens under the hammer instead of shattering. Why?`,
    (metal) => `You can bend a bar of ${metal} without it cracking apart. Why?`,
  ],
  alloy: [
    (metal) => `Mixing another metal into molten ${metal} gives a solid alloy that holds together. Why does that work?`,
    (metal) => `Atoms of a different metal can sit inside solid ${metal} and the piece stays bonded. How?`,
  ],
  contrast: [
    (metal) => `A strip of ${metal} lights the bulb, but a crystal of rock salt does not. What is different about the metal?`,
    (metal) => `Solid ${metal} conducts; an ionic crystal on the same bench does not. What does the metal have?`,
  ],
}

function drawSea(rng: Rng): Drawn {
  const metal = rng.pick(SEA_METALS)
  const ask = rng.pick(['conduct', 'bend', 'alloy', 'contrast'] as const)
  const opener = rng.int(0, SEA_PROMPTS[ask].length - 1)
  const check: IbCheck = { kind: 'sea', ask }
  return {
    prompt: SEA_PROMPTS[ask][opener]!(metal),
    drafts: [
      {
        kind: 'choice',
        label: 'The reason',
        hint: 'Choose one.',
        nudge: 'Picture positive centers sitting in a sea of electrons that the whole piece shares.',
        ruleCard: 'mb.sea',
        check,
        choices: rng.shuffle([
          { id: canonicalIbAnswer(check), text: canonicalIbAnswer(check) },
          { id: SEA_WRONG.fixed, text: SEA_WRONG.fixed },
          { id: SEA_WRONG.ionic, text: SEA_WRONG.ionic },
        ]),
        reveal: (answer) => `The electron sea explains it: ${answer.charAt(0).toLowerCase()}${answer.slice(1)}.`,
      },
    ],
    params: { metal, ask, opener },
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function makeTemplate(id: string, question: IbQuestion, title: string, description: string, instructions: string, draw: (rng: Rng) => Drawn): TemplateDef {
  return {
    id,
    title,
    description,
    version: 1,
    knobs: [],
    generate: (seed, knobs) => {
      const rng = makeRng(seed)
      const drawn = draw(rng)
      const answer = buildAnswer(question, drawn.prompt, drawn.drafts, rng)
      assertIonicBonding(`${id}@${seed}`, answer)
      return instance({ id, title, version: 1 }, seed, knobs, instructions, answer, { ...drawn.params, trap: answer.trap ?? '' })
    },
  }
}

export const valenceTemplate = makeTemplate(
  'ib.valence',
  'valence',
  'From element to ion',
  'Valence electrons, which way the electrons move and how many, the ion with its charge, and the ion’s noble-gas shorthand.',
  'Answer each part. Write the ion with its charge, and the configuration in the form the part asks for.',
  drawValence,
)

export const dotsTemplate = makeTemplate(
  'ib.dots',
  'dots',
  'Electron-dot symbols',
  'How many dots the electron-dot symbol of an atom or a simple ion shows, and what the dots stand for.',
  'Answer each part. Dots are a whole number.',
  drawDots,
)

export const transferTemplate = makeTemplate(
  'ib.transfer',
  'transfer',
  'Forming a compound',
  'The two ions a metal and a nonmetal form, the criss-cross ratio, the formula unit, and the electrons moved per unit.',
  'Answer each part. Write ions with their charges and the formula with plain-number subscripts.',
  drawTransfer,
)

export const propsTemplate = makeTemplate(
  'ib.props',
  'props',
  'Why ionic compounds behave that way',
  'Melting, shattering and conducting, each explained by the lattice of ions — or mis-explained by a standing misconception.',
  'Choose the explanation that fits the lattice of ions.',
  drawProps,
)

export const seaTemplate = makeTemplate(
  'mb.sea',
  'sea',
  'The electron sea',
  'Conduction, bending and alloys in metals, explained by the electron-sea model and contrasted with the ionic lattice.',
  'Choose the explanation that fits the electron-sea model.',
  drawSea,
)

export const IB_TEMPLATES: readonly TemplateDef[] = [valenceTemplate, dotsTemplate, transferTemplate, propsTemplate, seaTemplate]
