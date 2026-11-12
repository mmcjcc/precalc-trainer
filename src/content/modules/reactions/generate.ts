/**
 * Chapter 11 templates. Every draw — reaction, term, coefficients, tube order, box order, prompt
 * wording — comes from makeRng(mixSeed(seed, k)); every seed is checked by assertReactions before
 * it ships, and a promised trap is a value that really grades to that id.
 */
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, ReactionsAnswer, RxCheck, RxStageId, TemplateDef } from '@/content/types'
import { compoundOfFormula, formulaDisplay, ionDisplay, type NmIon } from '@/engine'
import { coefficientsOf } from './balance'
import {
  atomCounts,
  capName,
  countPool,
  elementName,
  elementOfFormula,
  elementsOf,
  equationDisplay,
  fuelName,
  PREDICT_COMBINATION,
  PREDICT_COMBUSTION,
  PREDICT_DECOMPOSITION,
  PREDICT_DOUBLE,
  PREDICT_SINGLE,
  reactionOf,
  REACTIONS,
  reactsWith,
  speciesOf,
  speciesDisplay,
  speciesName,
  typesPool,
  wordPool,
  elementalFormula,
  type RxReaction,
  type RxSpecies,
} from './facts'
import { acceptedRxAnswers, assertReactions, canonicalRxAnswer, trapsForRx, unbalancedCandidates, type RxTrap } from './grade'
import { BALANCED_TEXT, NONE_OFF, REACTS_TEXT, TYPE_ORDER, TYPE_TEXT } from './rules'

const MODULE_ID = 'reactions' as const
const NO_CALC = { ti84: [], nspire: [] }
const STAGE_IDS: readonly RxStageId[] = ['a', 'b', 'c', 'd', 'e']

type RxQuestion = ReactionsAnswer['question']

interface BuiltStage {
  kind: 'text' | 'choice' | 'coefficients'
  label: string
  hint: string
  nudge: string
  ruleCard: string
  check: RxCheck
  choices?: { id: string; text: string }[]
  slots?: string[]
  reactantCount?: number
  reveal: (answerText: string) => string
}

interface Drawn {
  prompt: string
  drafts: BuiltStage[]
  params: Record<string, number | string | boolean>
}

function attach(stage: BuiltStage, index: number): ReactionsAnswer['stages'][number] {
  const answerText = canonicalRxAnswer(stage.check)
  const accept = acceptedRxAnswers(stage.check)
  const traps = trapsForRx(stage.check)
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
    ...(accept.length ? { accept } : {}),
    ...(choices ? { choices } : {}),
    ...(stage.slots ? { slots: stage.slots, reactantCount: stage.reactantCount ?? 0 } : {}),
    nudge: stage.nudge,
    ruleCard: stage.ruleCard,
    reveal: [stage.reveal(answerText)],
    traps,
    check: stage.check,
  }
}

/** The promised trap: one of this chapter's own slips when the seed has one, else an engine slip. */
function promise(stages: ReactionsAnswer['stages'], rng: Rng) {
  const all = stages.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap: trap as RxTrap })))
  if (all.length === 0) return {}
  const own = all.filter((item) => item.trap.id.startsWith('rx_'))
  const chosen = rng.pick(own.length ? own : all)
  return { trap: chosen.trap.id, trapStage: chosen.stage.id, trapAnswer: chosen.trap.text }
}

function choiceShown(stage: ReactionsAnswer['stages'][number]): string {
  if (stage.kind === 'choice') return stage.choices?.find((c) => c.id === stage.answerText)?.text ?? stage.answerText
  if (stage.kind === 'text' && stage.check.kind !== 'atom-count') return formulaDisplay(stage.answerText)
  return stage.answerText
}

function buildAnswer(question: RxQuestion, prompt: string, drafts: BuiltStage[], rng: Rng): ReactionsAnswer {
  const stages = drafts.map((draft, index) => attach(draft, index))
  const ruleCards = [...new Set(stages.map((stage) => stage.ruleCard))]
  const promised = promise(stages, rng)
  return {
    type: 'reactions',
    question,
    prompt,
    stages,
    expectedDisplay: stages.map((stage) => `${stage.label}: ${choiceShown(stage)}`).join('; '),
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
  answer: ReactionsAnswer,
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
    kind: 'reactions',
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

function atoms(n: number, symbol: string): string {
  return `${n} ${symbol} atom${n === 1 ? '' : 's'}`
}

const FORMULA_HINT = 'A formula, like LiF.'

// ---------------------------------------------------------------------------
// rx.count — atoms in a term, then one equation checked
// ---------------------------------------------------------------------------

const COUNT_OPENERS: readonly string[] = [
  'Two counting jobs.',
  'Atom bookkeeping, before any balancing.',
  'A warm-up in counting atoms.',
  'Before balancing anything, count.',
  'Lab notebook check.',
]

const CHECK_PHRASES: readonly string[] = [
  'Then check this equation element by element:',
  'Then audit this equation, one element at a time:',
  'Next, compare the two sides of this equation:',
]

function drawCount(rng: Rng): Drawn {
  const pool = countPool()
  const grouped = pool.filter((f) => f.includes('('))
  const plain = pool.filter((f) => !f.includes('('))
  const formula = rng.chance(0.45) ? rng.pick(grouped) : rng.pick(plain)
  const coefficient = rng.int(2, 9)
  const elements = [...atomCounts(formula).keys()]
  const later = elements.slice(1)
  const element = later.length > 0 && rng.chance(0.8) ? rng.pick(later) : rng.pick(elements)
  const term = `${coefficient}${formulaDisplay(formula)}`
  const unit = atomCounts(formula).get(element)!

  // The equation: balanced half the time, else exactly one element off.
  const balanced = rng.chance(0.5)
  let r: RxReaction = rng.pick(REACTIONS)
  let candidates = unbalancedCandidates(r.id)
  while (!balanced && candidates.length === 0) {
    r = rng.pick(REACTIONS)
    candidates = unbalancedCandidates(r.id)
  }
  const shown = balanced ? coefficientsOf(r) : rng.pick(candidates)
  const eq = equationDisplay(r, shown)
  const names = elementsOf(r).map((el) => capName(elementName(el)))
  const opener = rng.int(0, COUNT_OPENERS.length - 1)
  const phrase = rng.int(0, CHECK_PHRASES.length - 1)
  return {
    prompt: `${COUNT_OPENERS[opener]} First, how many ${element} atoms are in ${term}? ${CHECK_PHRASES[phrase]} ${eq}`,
    drafts: [
      {
        kind: 'text',
        label: `${element} atoms in ${term}`,
        hint: 'A whole number.',
        nudge: 'Count the atoms in one formula unit first, parentheses included, then let the coefficient multiply all of them.',
        ruleCard: 'rx.count',
        check: { kind: 'atom-count', formula, coefficient, element },
        reveal: (answer) => `One unit of ${formulaDisplay(formula)} holds ${atoms(unit, element)}, and the coefficient takes that ${coefficient} times: ${atoms(Number(answer), element)}.`,
      },
      {
        kind: 'choice',
        label: 'Is the equation balanced?',
        hint: 'Choose one.',
        nudge: 'Tally each element on the left and on the right; a single mismatch settles it.',
        ruleCard: 'rx.balance',
        check: { kind: 'is-balanced', reaction: r.id, coefficients: shown },
        choices: rng.shuffle([
          { id: BALANCED_TEXT.yes, text: BALANCED_TEXT.yes },
          { id: BALANCED_TEXT.no, text: BALANCED_TEXT.no },
        ]),
        reveal: (answer) => (answer === BALANCED_TEXT.yes ? 'Every element has the same count on both sides, so the equation balances.' : 'At least one element has a different count on the two sides, so the equation does not balance.'),
      },
      {
        kind: 'choice',
        label: 'The element that does not match',
        hint: 'Choose one.',
        nudge: 'Write each element down with its count on each side; the odd one out is the answer, if there is one.',
        ruleCard: 'rx.balance',
        check: { kind: 'off-element', reaction: r.id, coefficients: shown },
        choices: [...rng.shuffle(names.map((n) => ({ id: n, text: n }))), { id: NONE_OFF, text: NONE_OFF }],
        reveal: (answer) => (answer === NONE_OFF ? 'Every element matches, so none of them is off.' : `${answer} is the element whose counts differ on the two sides.`),
      },
    ],
    params: { formula, coefficient, element, reaction: r.id, balanced, opener },
  }
}

// ---------------------------------------------------------------------------
// rx.balance — coefficients for a skeleton
// ---------------------------------------------------------------------------

const BALANCE_OPENERS: readonly string[] = [
  'Balance this skeleton equation:',
  'Put a coefficient in front of every substance so the atoms match:',
  'This equation has its formulas but no coefficients yet:',
  'Make the two sides of this equation agree, atom for atom:',
]

function drawBalance(rng: Rng): Drawn {
  // Half the draws pick a coefficient pattern first, so common patterns (2 1 2, 1 1 1) never crowd the answers.
  const patterns = [...new Set(REACTIONS.map((x) => coefficientsOf(x).join(' ')))]
  const pattern = rng.pick(patterns)
  const r = rng.chance(0.5) ? rng.pick(REACTIONS.filter((x) => coefficientsOf(x).join(' ') === pattern)) : rng.pick(REACTIONS)
  const species = [...r.reactants, ...r.products]
  const opener = rng.int(0, BALANCE_OPENERS.length - 1)
  return {
    prompt: `${BALANCE_OPENERS[opener]} ${equationDisplay(r)}`,
    drafts: [
      {
        kind: 'coefficients',
        label: 'Coefficients',
        hint: 'A whole number in every box, the 1s included.',
        nudge: 'Start with an element that sits in just one formula on each side, and leave any free element standing alone for last.',
        ruleCard: 'rx.balance',
        check: { kind: 'balance', reaction: r.id },
        slots: species.map((s) => speciesDisplay(s)),
        reactantCount: r.reactants.length,
        reveal: () => `Balanced: ${equationDisplay(r, coefficientsOf(r))}`,
      },
    ],
    params: { reaction: r.id, opener },
  }
}

// ---------------------------------------------------------------------------
// rx.types — classify from the equation
// ---------------------------------------------------------------------------

const TYPE_OPENERS: readonly string[] = [
  'Here is a balanced equation:',
  'From the lab write-up:',
  'An equation from the board:',
  'Read this equation carefully:',
]

function drawTypes(rng: Rng): Drawn {
  const type = rng.pick(TYPE_ORDER)
  const r = reactionOf(rng.pick(typesPool(type)))
  const opener = rng.int(0, TYPE_OPENERS.length - 1)
  return {
    prompt: `${TYPE_OPENERS[opener]} ${equationDisplay(r, coefficientsOf(r))}. What kind of reaction is it?`,
    drafts: [
      {
        kind: 'choice',
        label: 'The kind of reaction',
        hint: 'Choose one.',
        nudge: 'Look at the shape: how many substances go in, how many come out, and whether any of them is a lone element.',
        ruleCard: 'rx.types',
        check: { kind: 'type', reaction: r.id },
        choices: rng.shuffle(TYPE_ORDER.map((t) => ({ id: TYPE_TEXT[t], text: TYPE_TEXT[t] }))),
        reveal: (answer) => `The pattern of what goes in and what comes out makes this ${answer.toLowerCase()}.`,
      },
    ],
    params: { reaction: r.id, opener },
  }
}

// ---------------------------------------------------------------------------
// rx.predict — products
// ---------------------------------------------------------------------------

function ionsOf(formula: string): { cation: NmIon; anion: NmIon } {
  const c = compoundOfFormula(formula)
  if (!c || c.kind !== 'ionic') throw new Error(`reactions: ${formula} is not an ionic compound of the model`)
  return { cation: c.cation, anion: c.anion }
}

function leftSide(r: RxReaction): string {
  return r.reactants.map((s) => speciesDisplay(s)).join(' + ')
}

const COMBINATION_OPENERS: readonly string[] = ['A metal meets a nonmetal:', 'Predict the product:', 'These two elements combine:']

function predictCombination(rng: Rng): Drawn {
  const r = reactionOf(rng.pick(PREDICT_COMBINATION))
  const product = r.products[0]!
  const { cation, anion } = ionsOf(product.formula)
  const opener = rng.int(0, COMBINATION_OPENERS.length - 1)
  const note = cation.numeral != null ? ` Here ${cation.metalName} forms the ${ionDisplay(cation)} ion.` : ''
  return {
    prompt: `${COMBINATION_OPENERS[opener]} ${leftSide(r)} → ?${note}`,
    drafts: [
      {
        kind: 'text',
        label: 'Formula of the product',
        hint: FORMULA_HINT,
        nudge: 'Give the metal and the nonmetal their ion charges, then take just enough of each that the charges cancel.',
        ruleCard: 'rx.ionic',
        check: { kind: 'ionic-product', cation: cation.text, anion: anion.text, reactants: [] },
        reveal: (answer) => `${ionDisplay(cation)} and ${ionDisplay(anion)} cancel as ${formulaDisplay(answer)}.`,
      },
    ],
    params: { sub: 'combination', reaction: r.id, opener },
  }
}

const DECOMPOSITION_OPENERS: readonly string[] = [
  'Heat or electricity breaks this compound all the way down to its elements:',
  'Decompose it completely:',
  'Split this binary compound into the elements it is made of:',
]

function elementStage(symbol: string, label: string, rule: string): BuiltStage {
  const name = elementName(symbol)
  return {
    kind: 'text',
    label,
    hint: FORMULA_HINT,
    nudge: 'Write the element the way it exists when free; check whether it is one of the elements that never stands alone.',
    ruleCard: rule,
    check: { kind: 'element', symbol },
    reveal: (answer) => `Free ${name} is written ${formulaDisplay(answer)}.`,
  }
}

function predictDecomposition(rng: Rng): Drawn {
  const r = reactionOf(rng.pick(PREDICT_DECOMPOSITION))
  const symbols = r.products.map((s) => elementOfFormula(s.formula)!)
  const order = rng.shuffle(symbols)
  const opener = rng.int(0, DECOMPOSITION_OPENERS.length - 1)
  return {
    prompt: `${DECOMPOSITION_OPENERS[opener]} ${leftSide(r)} → ? + ?`,
    drafts: order.map((symbol) => elementStage(symbol, `The ${elementName(symbol)} that forms`, 'rx.diatomic')),
    params: { sub: 'decomposition', reaction: r.id, opener, first: order[0]! },
  }
}

function predictSingle(rng: Rng): Drawn {
  const entry = rng.pick(PREDICT_SINGLE)
  const r = reactionOf(entry.id)
  const lone = elementOfFormula(r.reactants[0]!.formula)!
  const compound = r.reactants[1]!
  const idle = rng.pick(entry.idle)
  if (!reactsWith(lone, compound.formula) || reactsWith(idle, compound.formula)) throw new Error(`reactions: tubes for ${r.id} disagree with the series`)
  const idleSpecies: RxSpecies = { formula: elementalFormula(idle), state: 's' }
  const tubeR = `${speciesDisplay(r.reactants[0]!)} + ${speciesDisplay(compound)} → ?`
  const tubeN = `${speciesDisplay(idleSpecies)} + ${speciesDisplay(compound)} → ?`
  const reactingFirst = rng.chance(0.5)
  const [tubeX, tubeY] = reactingFirst ? [tubeR, tubeN] : [tubeN, tubeR]
  const askReacting = rng.chance(0.5)
  const asked = askReacting ? lone : idle
  const askedTube = (askReacting ? reactingFirst : !reactingFirst) ? 'X' : 'Y'
  const productCompound = r.products.find((s) => atomCounts(s.formula).size >= 2)!
  const freed = elementOfFormula(r.products.find((s) => s !== productCompound)!.formula)!
  const { cation, anion } = ionsOf(productCompound.formula)
  return {
    prompt: `Two test tubes. Tube X: ${tubeX} Tube Y: ${tubeY} The activity series decides which tube shows a change.`,
    drafts: [
      {
        kind: 'choice',
        label: `What happens in tube ${askedTube}?`,
        hint: 'Choose one.',
        nudge: 'Find the lone element and the element it would push out on the activity series; only the higher one can do the pushing.',
        ruleCard: 'rx.activity',
        check: { kind: 'reacts', lone: asked, compound: compound.formula },
        choices: rng.shuffle([
          { id: REACTS_TEXT.yes, text: REACTS_TEXT.yes },
          { id: REACTS_TEXT.no, text: REACTS_TEXT.no },
        ]),
        reveal: (answer) =>
          answer === REACTS_TEXT.yes
            ? `${capName(elementName(asked))} sits above the element it replaces, so tube ${askedTube} reacts.`
            : `${capName(elementName(asked))} sits below the element it would replace, so nothing happens in tube ${askedTube}.`,
      },
      {
        kind: 'text',
        label: 'The compound formed in the tube that reacts',
        hint: FORMULA_HINT,
        nudge: 'The lone element becomes an ion and takes the place of its look-alike in the compound; balance the new pair of charges.',
        ruleCard: 'rx.ionic',
        check: { kind: 'ionic-product', cation: cation.text, anion: anion.text, reactants: [compound.formula] },
        reveal: (answer) => `The lone element trades in: ${ionDisplay(cation)} with ${ionDisplay(anion)} is ${formulaDisplay(answer)}.`,
      },
      elementStage(freed, 'The element set free in the tube that reacts', 'rx.diatomic'),
    ],
    params: { sub: 'single', reaction: r.id, idle, reactingFirst, askReacting },
  }
}

const DOUBLE_OPENERS: readonly string[] = ['Two solutions are mixed:', 'Pour one solution into the other:', 'Mix these two compounds in water:']

function predictDouble(rng: Rng): Drawn {
  const r = reactionOf(rng.pick(PREDICT_DOUBLE))
  const [a, b] = [r.reactants[0]!, r.reactants[1]!]
  const ia = ionsOf(a.formula)
  const ib = ionsOf(b.formula)
  const pairs = rng.shuffle([
    { cation: ia.cation, anion: ib.anion },
    { cation: ib.cation, anion: ia.anion },
  ])
  const opener = rng.int(0, DOUBLE_OPENERS.length - 1)
  return {
    prompt: `${DOUBLE_OPENERS[opener]} ${leftSide(r)} → ? + ?`,
    drafts: pairs.map((pair) => ({
      kind: 'text' as const,
      label: `The new compound that holds ${pair.cation.name}`,
      hint: FORMULA_HINT,
      nudge: 'Pair this cation with the anion of the OTHER compound, then balance the two charges.',
      ruleCard: 'rx.double',
      check: { kind: 'ionic-product' as const, cation: pair.cation.text, anion: pair.anion.text, reactants: [a.formula, b.formula] },
      reveal: (answer: string) => `${ionDisplay(pair.cation)} takes the other compound’s ${ionDisplay(pair.anion)}: ${formulaDisplay(answer)}.`,
    })),
    params: { sub: 'double', reaction: r.id, opener },
  }
}

function predictCombustion(rng: Rng): Drawn {
  const r = reactionOf(rng.pick(PREDICT_COMBUSTION))
  const fuel = r.reactants[0]!
  const order = rng.shuffle(['carbon', 'hydrogen'] as const)
  return {
    prompt: `${capName(fuelName(fuel.formula))} burns completely in plenty of oxygen: ${leftSide(r)} → ? + ?`,
    drafts: order.map((carries) => ({
      kind: 'text' as const,
      label: `The product that carries the ${carries}`,
      hint: FORMULA_HINT,
      nudge: 'With oxygen to spare, every atom of the fuel ends up joined to oxygen; ask what this element makes when it does.',
      ruleCard: 'rx.combustion',
      check: { kind: 'combustion-product' as const, fuel: fuel.formula, carries },
      reveal: (answer: string) => `Complete combustion sends the fuel’s ${carries} out as ${formulaDisplay(answer)}.`,
    })),
    params: { sub: 'combustion', reaction: r.id, first: order[0]! },
  }
}

/** Kinds of prediction, weighted so no single typed answer passes a tenth of the seeds. */
const PREDICT_KINDS: readonly { weight: number; draw: (rng: Rng) => Drawn }[] = [
  { weight: 27, draw: predictCombination },
  { weight: 20, draw: predictDecomposition },
  { weight: 28, draw: predictSingle },
  { weight: 18, draw: predictDouble },
  { weight: 7, draw: predictCombustion },
]

function drawPredict(rng: Rng): Drawn {
  const total = PREDICT_KINDS.reduce((a, k) => a + k.weight, 0)
  let roll = rng.next() * total
  for (const kind of PREDICT_KINDS) {
    roll -= kind.weight
    if (roll < 0) return kind.draw(rng)
  }
  return PREDICT_KINDS.at(-1)!.draw(rng)
}

// ---------------------------------------------------------------------------
// rx.word — a word equation to a skeleton
// ---------------------------------------------------------------------------

const WORD_OPENERS: readonly string[] = ['In words:', 'The lab notes say:', 'Written out as a sentence, the reaction is', 'A word equation:']

function wordStage(s: RxSpecies): BuiltStage {
  const name = speciesName(s)
  const element = elementOfFormula(s.formula)
  if (element) return elementStage(element, `Formula for ${name}`, 'rx.diatomic')
  return {
    kind: 'text',
    label: `Formula for ${name}`,
    hint: FORMULA_HINT,
    nudge: 'Work the formula out from the name, the way chapter 7 does: the ions and their charges, or the prefixes.',
    ruleCard: 'rx.word',
    check: { kind: 'named-formula', name },
    reveal: (answer) => `${capName(name)} is ${formulaDisplay(answer)}.`,
  }
}

/**
 * Word-equation rows weighted by 1 / (how many rows share their most common substance), so the
 * substances in many rows (O₂, H₂O, NaCl) never pass a tenth of any part.
 */
const WORD_WEIGHTS: readonly { id: string; weight: number }[] = (() => {
  const pool = wordPool()
  const rows = new Map<string, number>()
  for (const id of pool) for (const f of new Set(speciesOf(reactionOf(id)).map((s) => s.formula))) rows.set(f, (rows.get(f) ?? 0) + 1)
  return pool.map((id) => ({ id, weight: 1 / Math.max(...speciesOf(reactionOf(id)).map((s) => rows.get(s.formula)!)) }))
})()

function weightedPick(rng: Rng, items: readonly { id: string; weight: number }[]): string {
  const total = items.reduce((a, x) => a + x.weight, 0)
  let roll = rng.next() * total
  for (const item of items) {
    roll -= item.weight
    if (roll < 0) return item.id
  }
  return items.at(-1)!.id
}

function drawWord(rng: Rng): Drawn {
  const r = reactionOf(weightedPick(rng, WORD_WEIGHTS))
  const left = rng.shuffle(r.reactants)
  const right = rng.shuffle(r.products)
  const opener = rng.int(0, WORD_OPENERS.length - 1)
  const words = `${left.map(speciesName).join(' + ')} → ${right.map(speciesName).join(' + ')}`
  return {
    prompt: `${WORD_OPENERS[opener]} ${words}. Write the skeleton equation: the formula for each substance, in order.`,
    drafts: [...left, ...right].map(wordStage),
    params: { reaction: r.id, opener },
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATE_SALT: Record<string, number> = {
  'rx.count': 111,
  'rx.balance': 112,
  'rx.types': 113,
  'rx.predict': 114,
  'rx.word': 115,
}

function makeTemplate(id: string, question: RxQuestion, title: string, description: string, instructions: string, draw: (rng: Rng) => Drawn): TemplateDef {
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
      assertReactions(`${id}@${seed}`, answer, instructions)
      return instance({ id, title, version: 1 }, seed, knobs, instructions, answer, { ...drawn.params, trap: answer.trap ?? '' })
    },
  }
}

export const countTemplate = makeTemplate(
  'rx.count',
  'count',
  'Counting atoms',
  'Atoms in a term with a coefficient and subscripts, then whether an equation balances and which element is off.',
  'Answer each part. Counts are whole numbers.',
  drawCount,
)

export const balanceTemplate = makeTemplate(
  'rx.balance',
  'balance',
  'Balancing equations',
  'One whole-number coefficient for every substance, the 1s included, in the lowest terms that balance every element.',
  'Type a coefficient in every box.',
  drawBalance,
)

export const typesTemplate = makeTemplate(
  'rx.types',
  'types',
  'Kinds of reaction',
  'Combination, decomposition, single replacement, double replacement or combustion, read from the equation.',
  'Choose the kind of reaction.',
  drawTypes,
)

export const predictTemplate = makeTemplate(
  'rx.predict',
  'predict',
  'Predicting products',
  'A metal with a nonmetal, a compound split into its elements, single replacement with the activity series, partners trading, and a hydrocarbon burning.',
  'Answer each part. Type formulas like LiF.',
  drawPredict,
)

export const wordTemplate = makeTemplate(
  'rx.word',
  'word',
  'Word equations',
  'A word equation turned into a skeleton equation: the formula of every named substance, the pair-forming elements included.',
  'Type the formula of each substance.',
  drawWord,
)

export const RX_TEMPLATES: readonly TemplateDef[] = [countTemplate, balanceTemplate, typesTemplate, predictTemplate, wordTemplate]
