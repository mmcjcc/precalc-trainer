/**
 * Honors geometry Unit 2, conditionals and logic. Every sentence comes from the statement bank.
 * A named mistake is exactly the choice she picked. Seed 1 of each template shows one.
 */
import { makeRng, mixSeed } from '@/content/rng'
import type { ErrorPatternId, GeoFigureSpec } from '@/shared/types'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import type { GeoBuilt } from './build'
import {
  LAW_CHAINS,
  STATEMENT_BANK,
  biconditionalOf,
  biconditionalTruth,
  formAtoms,
  formTruth,
  halfNegation,
  isCounterexample,
  sceneFigure,
  statementOf,
  type BankEntry,
  type LawChain,
  type LogicForm,
  type Situation,
} from './bank'
import { stageDisplay, stageIdAt } from './grade'
import { UNIT2_RULE_IDS } from './unit2Rules'

const INSTRUCTIONS = 'Pick one choice for each part. Read every choice before you check.'

const RELATED_HINT = 'Compare each sentence with the starting if-then. One change, or both changes, or a sentence that does only half the work.'
const RELATED_NUDGE = 'Swapping the two parts is a different move from negating both parts. Doing both is a third move. Negating only one part is none of those three.'
const TRUTH_HINT = 'Decide whether the written sentence holds. A related sentence can hold while this one fails.'
const TRUTH_NUDGE = 'Check the sentence that is written, not a rearrangement of its parts. The swapped sentence can fail on its own.'
const EXAMPLE_HINT = 'Pick the situation that knocks the written sentence down, or say that none of them does.'
const EXAMPLE_NUDGE = 'A counterexample fits the opening and misses the ending. A situation that misses the opening does not count.'
const LAWS_HINT = 'What follows from these two premises, and nothing else?'
const LAWS_NUDGE = 'The opening of an if-then has to be the part you were told. A chain needs the ending of the first sentence to be the opening of the second. Matching the ending, or crossing off the opening, does not settle anything.'

const NONE = 'There is no valid conclusion.'
const HOLDS = 'No counterexample: the statement holds.'
const TRUE_TEXT = 'It is true.'
const FALSE_TEXT = 'It is false.'
const NAME_CONVERSE = 'the converse'
const NAME_INVERSE = 'the inverse'
const NAME_CONTRA = 'the contrapositive'
const NAME_HALF = 'none of these: only one part is negated'

type Choice = { id: string; text: string; trap?: ErrorPatternId; witness?: string }

interface StageDraft {
  label: string
  hint: string
  nudge: string
  ruleCard: string
  note?: string
  choices: Choice[]
  answerId: string
  reveal: string[]
}

export function drawRelated(seed: number): GeoBuilt {
  const entry = STATEMENT_BANK[(seed - 1) % STATEMENT_BANK.length]!
  const figure = sceneFigure(entry.scene, figureAria(entry))
  if (seed % 2 === 1) return identify(seed, entry, figure)
  return nameRelated(seed, entry, figure)
}

export function drawTruth(seed: number): GeoBuilt {
  const entry = STATEMENT_BANK[(seed - 1) % STATEMENT_BANK.length]!
  const slot = (seed - 1) % 5
  const figure = sceneFigure(entry.scene, figureAria(entry))
  if (slot === 4) return truthIff(seed, entry, figure)
  const form: LogicForm = (['converse', 'conditional', 'inverse', 'contrapositive'] as const)[slot]!
  return truthForm(seed, entry, form, figure)
}

export function drawLaws(seed: number): GeoBuilt {
  const chain = LAW_CHAINS[Math.floor((seed - 1) / 5) % LAW_CHAINS.length]!
  const pattern = (seed - 1) % 5
  const figure = sceneFigure(chain.scene, chainAria(chain))
  const draft = lawStage(chain, pattern)
  const prompt = `Premise 1: ${draft.p1}\nPremise 2: ${draft.p2}\nWhat follows from these two premises alone?`
  return pack('laws', 'What follows?', prompt, figure, [draft.stage], draft.stage.choices.find((c) => c.trap)!.trap!, 'a', trapId(draft.stage), {
    chain: chain.id,
    pattern: String(pattern),
  })
}

function identify(seed: number, entry: BankEntry, figure: GeoFigureSpec): GeoBuilt {
  const converse = statementOf(entry, 'converse')
  const inverse = statementOf(entry, 'inverse')
  const contra = statementOf(entry, 'contrapositive')
  const half0 = halfNegation(entry, 0)
  const half1 = halfNegation(entry, 1)
  const stages: StageDraft[] = [
    {
      label: 'Parts swapped',
      hint: RELATED_HINT,
      nudge: RELATED_NUDGE,
      ruleCard: UNIT2_RULE_IDS.related,
      choices: [
        { id: 'converse', text: converse },
        {
          id: 'inverse',
          text: inverse,
          trap: 'geo_converse_inverse_swapped',
          witness: 'That sentence keeps the order and negates both parts. This part wants the sentence that only swaps the two parts.',
        },
        { id: 'contra', text: contra },
        { id: 'half', text: half1 },
      ],
      answerId: 'converse',
      reveal: [`The sentence that only swaps the two parts is: ${converse}`],
    },
    {
      label: 'Both parts negated',
      hint: RELATED_HINT,
      nudge: RELATED_NUDGE,
      ruleCard: UNIT2_RULE_IDS.related,
      choices: [
        { id: 'inverse', text: inverse },
        {
          id: 'converse',
          text: converse,
          trap: 'geo_converse_inverse_swapped',
          witness: 'That sentence swaps the two parts and leaves them positive. This part wants the sentence that keeps the order and negates both.',
        },
        { id: 'contra', text: contra },
        { id: 'half', text: half0 },
      ],
      answerId: 'inverse',
      reveal: [`The sentence that keeps the order and negates both parts is: ${inverse}`],
    },
    {
      label: 'Negated and swapped',
      hint: RELATED_HINT,
      nudge: RELATED_NUDGE,
      ruleCard: UNIT2_RULE_IDS.contra,
      choices: [
        { id: 'contra', text: contra },
        {
          id: 'inverse',
          text: inverse,
          trap: 'geo_contrapositive_unswitched',
          witness: 'That sentence negates both parts and leaves them in the same order. This part also swaps the two parts.',
        },
        {
          id: 'half',
          text: half0,
          trap: 'geo_contrapositive_half',
          witness: 'That sentence negates only one of the two parts. This part negates both parts and swaps them.',
        },
        { id: 'converse', text: converse },
      ],
      answerId: 'contra',
      reveal: [`The sentence that negates both parts and swaps them is: ${contra}`],
    },
  ]
  const which = (seed - 1) % 3
  const trapStage = stages[which]!
  const promised = trapStage.choices.find((choice) => choice.trap && (which < 2 || choice.trap === (seed % 2 === 0 ? 'geo_contrapositive_half' : 'geo_contrapositive_unswitched')))!
  // For the first two stages there is one trap. For the third, seed % 2 picks which of the two is promised;
  // seed 1 is stage 0, so this branch is not the seed-1 problem.
  const trapChoice = which < 2 ? trapStage.choices.find((choice) => choice.trap)! : promised
  const prompt = `Start from this if-then: "${statementOf(entry, 'conditional')}"\nPick the sentence each part asks for.`
  return pack('related', 'Related conditionals', prompt, figure, stages, trapChoice.trap!, stageIdAt(which), trapChoice.id, {
    entry: entry.id,
    mode: 'identify',
  })
}

function nameRelated(seed: number, entry: BankEntry, figure: GeoFigureSpec): GeoBuilt {
  const kind = (Math.floor(seed / 2) % 4) as 0 | 1 | 2 | 3
  const shown =
    kind === 0
      ? statementOf(entry, 'converse')
      : kind === 1
        ? statementOf(entry, 'inverse')
        : kind === 2
          ? statementOf(entry, 'contrapositive')
          : pickHalf(entry, seed)
  const classified = classify(entry, shown)
  const correct =
    classified === 'converse' ? NAME_CONVERSE : classified === 'inverse' ? NAME_INVERSE : classified === 'contra' ? NAME_CONTRA : NAME_HALF
  const trap =
    classified === 'converse'
      ? { id: 'inverse', text: NAME_INVERSE, trap: 'geo_converse_inverse_swapped' as const, witness: 'That description is the one for negating both parts and keeping their order. This sentence only swaps the two parts.' }
      : classified === 'inverse'
        ? { id: 'converse', text: NAME_CONVERSE, trap: 'geo_converse_inverse_swapped' as const, witness: 'That description is the one for swapping the two parts. This sentence keeps the order and negates both.' }
        : classified === 'contra'
          ? { id: 'inverse', text: NAME_INVERSE, trap: 'geo_contrapositive_unswitched' as const, witness: 'That description negates both parts and keeps their order. This sentence also swaps the two parts.' }
          : { id: 'contra', text: NAME_CONTRA, trap: 'geo_contrapositive_half' as const, witness: 'That description negates both parts and swaps them. This sentence negates only one part.' }
  const choices: Choice[] = [
    { id: 'converse', text: NAME_CONVERSE },
    { id: 'inverse', text: NAME_INVERSE },
    { id: 'contra', text: NAME_CONTRA },
    { id: 'neither', text: NAME_HALF },
  ]
  const answerId = choices.find((choice) => choice.text === correct)!.id
  const withTrap = choices.map((choice) => (choice.id === trap.id ? { ...choice, trap: trap.trap, witness: trap.witness } : choice))
  const stage: StageDraft = {
    label: 'Which description',
    hint: RELATED_HINT,
    nudge: RELATED_NUDGE,
    ruleCard: classified === 'contra' || classified === 'half' ? UNIT2_RULE_IDS.contra : UNIT2_RULE_IDS.related,
    note: `New sentence: ${shown}`,
    choices: withTrap,
    answerId,
    reveal: [`The new sentence is ${classified === 'half' ? 'not one of the three related forms, because only one part is negated' : 'one of the three related forms'}: ${shown}`],
  }
  const prompt = `Start from this if-then: "${statementOf(entry, 'conditional')}"\nA new sentence was written from it. Which description fits that sentence?`
  return pack('related', 'Name the related statement', prompt, figure, [stage], trap.trap, 'a', trap.id, {
    entry: entry.id,
    mode: 'name',
    shown: classified,
  })
}

function truthForm(seed: number, entry: BankEntry, form: LogicForm, figure: GeoFigureSpec): GeoBuilt {
  const sentence = statementOf(entry, form)
  const holds = formTruth(entry, form)
  return truthProblem(seed, entry, sentence, holds, form, false, figure, { entry: entry.id, form })
}

function truthIff(seed: number, entry: BankEntry, figure: GeoFigureSpec): GeoBuilt {
  const sentence = biconditionalOf(entry)
  const holds = biconditionalTruth(entry)
  const direction: LogicForm = entry.conditional ? 'converse' : 'conditional'
  return truthProblem(seed, entry, sentence, holds, direction, true, figure, { entry: entry.id, form: 'iff' })
}

function truthProblem(
  seed: number,
  entry: BankEntry,
  sentence: string,
  holds: boolean,
  direction: LogicForm,
  iff: boolean,
  figure: GeoFigureSpec,
  params: Record<string, string>,
): GeoBuilt {
  const falseConverse = iff ? entry.conditional && !entry.converse : direction === 'converse' && !entry.converse
  const truthChoices: Choice[] = [
    {
      id: 'true',
      text: TRUE_TEXT,
      ...(falseConverse
        ? {
            trap: 'geo_false_converse' as const,
            witness: 'The sentence that swaps the two parts can fail even when the original if-then holds. This one does fail, so calling the written sentence a sure thing is the mistake.',
          }
        : {}),
    },
    { id: 'false', text: FALSE_TEXT },
  ]
  const example = exampleStage(entry, direction, iff, holds)
  const stages: StageDraft[] = [
    {
      label: 'True or false',
      hint: TRUTH_HINT,
      nudge: TRUTH_NUDGE,
      ruleCard: iff ? UNIT2_RULE_IDS.biconditional : UNIT2_RULE_IDS.related,
      note: sentence,
      choices: truthChoices,
      answerId: holds ? 'true' : 'false',
      reveal: [holds ? `The written sentence holds: ${sentence}` : `The written sentence does not hold: ${sentence}`],
    },
    example,
  ]
  const prompt = `Does this statement hold?\n"${sentence}"`
  if (falseConverse && !holds) {
    return pack('truth', 'True or false', prompt, figure, stages, 'geo_false_converse', 'a', 'true', params)
  }
  const miss = example.choices.find((choice) => choice.trap === 'geo_counterexample_hypothesis')
  if (!miss) throw new Error(`gl.truth/${seed}: no hypothesis trap for ${entry.id}`)
  return pack('truth', 'True or false', prompt, figure, stages, 'geo_counterexample_hypothesis', 'b', miss.id, params)
}

function exampleStage(entry: BankEntry, direction: LogicForm, iff: boolean, holds: boolean): StageDraft {
  const pool = situations(entry)
  const knocks = (situation: Situation) => (iff ? (situation.p && !situation.q) || (situation.q && !situation.p) : isCounterexample(direction, situation))
  const official = holds ? undefined : entry.counterexamples[direction]
  if (!holds && !official) throw new Error(`${entry.id}: false ${direction} has no counterexample`)
  if (official && !knocks(official)) throw new Error(`${entry.id}: stored counterexample does not knock down ${direction}`)
  const misses = pool.filter((situation) => {
    if (official && situation.text === official.text) return false
    if (knocks(situation)) return false
    return !formAtoms(direction, situation.p, situation.q).hyp
  })
  if (misses.length === 0) throw new Error(`${entry.id}: no situation misses the hypothesis of ${direction}`)
  const witness = 'That situation misses the opening of the written sentence, so it cannot knock the sentence down.'
  const choices: Choice[] = []
  const used = new Set<string>()
  const add = (choice: Choice) => {
    if (used.has(choice.text)) return
    used.add(choice.text)
    choices.push(choice)
  }
  if (official) {
    add({ id: official.id, text: official.text })
    add({ id: 'holds', text: HOLDS })
  } else {
    add({ id: 'holds', text: HOLDS })
    // A situation that fits the original if-then is a plain decoy only when it also fits this
    // sentence's opening. Otherwise it is a hypothesis miss and the loop below names it.
    const example = pool.find((situation) => situation.p && situation.q && !knocks(situation) && formAtoms(direction, situation.p, situation.q).hyp)
    if (example) add({ id: example.id, text: example.text })
  }
  for (const miss of misses.slice(0, 2)) {
    add({ id: miss.id, text: miss.text, trap: 'geo_counterexample_hypothesis', witness })
  }
  return {
    label: 'Counterexample',
    hint: EXAMPLE_HINT,
    nudge: EXAMPLE_NUDGE,
    ruleCard: UNIT2_RULE_IDS.counterexample,
    choices,
    answerId: official ? official.id : 'holds',
    reveal: [
      official
        ? `A counterexample is a situation that fits the opening and misses the ending: ${official.text}`
        : 'Nothing on the list knocks the sentence down, because the sentence holds.',
    ],
  }
}

function lawStage(chain: LawChain, pattern: number): { stage: StageDraft; p1: string; p2: string } {
  const ifpq = `If ${chain.p}, then ${chain.q}.`
  const ifqr = `If ${chain.q}, then ${chain.r}.`
  const ifpr = `If ${chain.p}, then ${chain.r}.`
  const ifrp = `If ${chain.r}, then ${chain.p}.`
  const ifrq = `If ${chain.r}, then ${chain.q}.`
  const cp = cap(chain.p)
  const cq = cap(chain.q)
  const cr = cap(chain.r)
  const cnq = cap(chain.notQ)
  const cnp = cap(chain.notP)
  if (pattern === 0) {
    return {
      p1: ifpq,
      p2: cq,
      stage: oneLaw(
        [
          { id: 'none', text: NONE },
          { id: 'affirm', text: cp, trap: 'geo_affirm_conclusion', witness: 'The second premise matches the ending. That does not let you claim the opening.' },
          { id: 'notq', text: cnq },
          { id: 'back', text: `If ${chain.q}, then ${chain.p}.` },
        ],
        'none',
        UNIT2_RULE_IDS.fallacy,
        'Nothing follows: being told the ending does not hand you the opening.',
      ),
    }
  }
  if (pattern === 1) {
    return {
      p1: ifpq,
      p2: cnp,
      stage: oneLaw(
        [
          { id: 'none', text: NONE },
          { id: 'deny', text: cnq, trap: 'geo_deny_hypothesis', witness: 'The second premise says the opening failed. The ending can still hold.' },
          { id: 'q', text: cq },
          { id: 'inverse', text: `If ${chain.notP}, then ${chain.notQ}.` },
        ],
        'none',
        UNIT2_RULE_IDS.fallacy,
        'Nothing follows: crossing off the opening does not cross off the ending.',
      ),
    }
  }
  if (pattern === 2) {
    return {
      p1: ifpq,
      p2: ifqr,
      stage: oneLaw(
        [
          { id: 'forward', text: ifpr },
          { id: 'back', text: ifrp, trap: 'geo_syllogism_order', witness: 'That sentence runs the chain backwards. The forward chain keeps the first opening and the last ending.' },
          { id: 'none', text: NONE },
          { id: 'end', text: cr },
        ],
        'forward',
        UNIT2_RULE_IDS.syllogism,
        `The two if-thens share a middle, so the conclusion is: ${ifpr}`,
      ),
    }
  }
  if (pattern === 3) {
    return {
      p1: ifpq,
      p2: ifrq,
      stage: oneLaw(
        [
          { id: 'none', text: NONE },
          { id: 'bad', text: ifpr, trap: 'geo_syllogism_order', witness: 'Those two if-thens share an ending, so there is no middle term to chain.' },
          { id: 'back', text: ifrp },
          { id: 'end', text: cq },
        ],
        'none',
        UNIT2_RULE_IDS.syllogism,
        'Nothing follows: the two if-thens share an ending, not a middle.',
      ),
    }
  }
  // "So, …" so the conclusion is not a copy of the words already inside the if-then.
  const follows = `So, ${chain.q}.`
  return {
    p1: ifpq,
    p2: cp,
    stage: oneLaw(
      [
        { id: 'end', text: follows },
        { id: 'none', text: NONE, trap: 'geo_missed_detachment', witness: 'The second premise is the opening of the if-then, so the ending does follow.' },
        { id: 'notq', text: cnq },
        { id: 'back', text: `If ${chain.q}, then ${chain.p}.` },
      ],
      'end',
      UNIT2_RULE_IDS.detachment,
      `The opening was given, so the ending follows: ${follows}`,
    ),
  }
}

function oneLaw(choices: Choice[], answerId: string, ruleCard: string, reveal: string): StageDraft {
  return {
    label: 'Conclusion',
    hint: LAWS_HINT,
    nudge: LAWS_NUDGE,
    ruleCard,
    choices,
    answerId,
    reveal: [reveal],
  }
}

function pack(
  question: GeometryAnswer['question'],
  title: string,
  prompt: string,
  figure: GeoFigureSpec,
  drafts: StageDraft[],
  trap: ErrorPatternId,
  trapStage: GeometryStageId,
  trapAnswer: string,
  params: Record<string, string>,
): GeoBuilt {
  const stages = drafts.map((draft, index) => {
    const choices = makeRng(mixSeed(hash(prompt), index + 3)).shuffle(draft.choices)
    const texts = new Set(choices.map((choice) => choice.text))
    if (texts.size !== choices.length) throw new Error(`${title}: repeated choice`)
    const traps = choices
      .filter((choice): choice is Choice & { trap: ErrorPatternId } => Boolean(choice.trap))
      .map((choice) => ({ id: choice.trap, text: choice.id, witness: choice.witness ?? 'That choice is a different move.' }))
    return {
      id: stageIdAt(index),
      kind: 'choice' as const,
      label: draft.label,
      hint: draft.hint,
      note: draft.note,
      answerText: draft.answerId,
      choices,
      nudge: draft.nudge,
      ruleCard: draft.ruleCard,
      reveal: draft.reveal,
      traps,
    }
  })
  const reveal = stages.flatMap((stage) => stage.reveal)
  const ruleCards = [...new Set(stages.map((stage) => stage.ruleCard))]
  const answer: GeometryAnswer = {
    type: 'geometry',
    question,
    prompt,
    figure,
    stages,
    lengths: [],
    angles: [],
    expectedDisplay: stages.map((stage) => stageDisplay(stage)).join(' · '),
    reveal,
    ruleCards,
    trap,
    trapStage,
    trapAnswer,
  }
  return { answer, title, instructions: INSTRUCTIONS, params: { ...params, question } }
}

function trapId(stage: StageDraft): string {
  const hit = stage.choices.find((choice) => choice.trap)
  if (!hit?.trap) throw new Error('law stage has no trap')
  return hit.id
}

function pickHalf(entry: BankEntry, seed: number): string {
  const order: (0 | 1)[] = seed % 2 === 0 ? [0, 1] : [1, 0]
  for (const which of order) {
    const sentence = halfNegation(entry, which)
    if (!isRealForm(entry, sentence)) return sentence
  }
  throw new Error(`${entry.id}: both half negations collide with a real form`)
}

function isRealForm(entry: BankEntry, sentence: string): boolean {
  return (['conditional', 'converse', 'inverse', 'contrapositive'] as const).some((form) => statementOf(entry, form) === sentence)
}

function classify(entry: BankEntry, sentence: string): 'converse' | 'inverse' | 'contra' | 'half' {
  if (sentence === statementOf(entry, 'converse')) return 'converse'
  if (sentence === statementOf(entry, 'inverse')) return 'inverse'
  if (sentence === statementOf(entry, 'contrapositive')) return 'contra'
  if (isRealForm(entry, sentence)) throw new Error(`${entry.id}: a real form was described as a half negation`)
  return 'half'
}

function situations(entry: BankEntry): Situation[] {
  const out: Situation[] = []
  const seen = new Set<string>()
  for (const situation of entry.situations) {
    if (seen.has(situation.text)) continue
    seen.add(situation.text)
    out.push(situation)
  }
  for (const form of ['conditional', 'converse', 'inverse', 'contrapositive'] as const) {
    const counter = entry.counterexamples[form]
    if (!counter || seen.has(counter.text)) continue
    seen.add(counter.text)
    out.push(counter)
  }
  return out
}

function cap(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

function figureAria(entry: BankEntry): string {
  if (entry.scene === 'life') return 'No diagram. This statement is about an ordinary day.'
  return `A diagram for “${entry.title}”, with the points and angles labeled.`
}

function chainAria(chain: LawChain): string {
  if (chain.scene === 'life') return 'No diagram. These premises are about an ordinary day.'
  return 'A diagram for the two premises, with the points and angles labeled.'
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}
