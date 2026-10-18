/**
 * Chapter 6 templates. Each seed is checked against the tables before it ships, and a promised
 * trap is a value that really grades to that pt_ id.
 */
import { problemId } from '@/content/registry'
import { makeRng, type Rng } from '@/content/rng'
import type { DifficultyKnobs, PeriodicAnswer, ProblemInstance, PtCheck, PtProperty, PtStageId, TemplateDef } from '@/content/types'
import type { ElementInfo } from '@/engine/chem/elements'
import { assertPeriodic, canonicalAnswer, trapsFor, type PtMistakeId, type PtTrap } from './grade'
import {
  blockOf,
  classOf,
  configurationOf,
  familyOf,
  formatSymbols,
  ionLabel,
  isoSets,
  locatePool,
  speciesLabel,
  symbolOf,
  trendSets,
  valencePool,
  whyCases,
  type WhyCase,
} from './facts'
import { WHY_TEXT } from './rules'

const MODULE_ID = 'periodic' as const
const NO_CALC = { ti84: [], nspire: [] }
const STAGE_IDS: readonly PtStageId[] = ['a', 'b', 'c', 'd', 'e']
const PROPERTIES: readonly PtProperty[] = ['radius', 'ionization', 'electronegativity', 'metallic']
const SCOPES = ['period', 'group', 'diagonal'] as const
const LOCATE_PRIORITY: readonly PtMistakeId[] = [
  'pt_hydrogen_metal',
  'pt_helium_p_block',
  'pt_f_as_d_block',
  'pt_alkali_called_alkaline',
  'pt_alkaline_called_alkali',
  'pt_metalloid_called_metal',
  'pt_metal_called_metalloid',
  'pt_period_as_valence',
]

const PROPERTY_PHRASE: Record<PtProperty, string> = {
  radius: 'atomic radius',
  ionization: 'first ionization energy',
  electronegativity: 'electronegativity',
  metallic: 'metallic character',
}

interface BuiltStage {
  /** Overwritten by position. Locate drafts omit it. */
  id?: PtStageId
  kind: 'text' | 'choice'
  label: string
  hint: string
  nudge: string
  ruleCard: string
  check: PtCheck
  accept?: string[]
  choices?: { id: string; text: string; trap?: PtMistakeId; witness?: string }[]
  reveal: (answerText: string) => string
}

function byFamily(name: ReturnType<typeof familyOf>): ElementInfo[] {
  return locatePool().filter((el) => familyOf(el) === name)
}

const LOCATE_CATEGORIES: readonly ElementInfo[][] = [
  locatePool().filter((el) => el.symbol === 'H'),
  locatePool().filter((el) => el.symbol === 'He'),
  locatePool().filter((el) => blockOf(el) === 'f'),
  byFamily('alkali metals'),
  byFamily('alkaline earth metals'),
  locatePool().filter((el) => classOf(el) === 'metalloid'),
  locatePool().filter((el) => classOf(el) === 'metal' && familyOf(el) == null),
  byFamily('halogens'),
  byFamily('noble gases').filter((el) => el.symbol !== 'He'),
  byFamily('transition metals'),
]

const CHARGE_PAIRS: { z: number; charge: number }[] = []
for (const el of locatePool()) {
  if (el.z > 56) continue
  for (const charge of el.commonCharges) {
    if (charge !== 0) CHARGE_PAIRS.push({ z: el.z, charge })
  }
}

function showItems<T>(rng: Rng, items: readonly T[], textOf: (list: readonly T[]) => string, banned: ReadonlySet<string>): T[] {
  const shown = rng.shuffle([...items])
  if (!banned.has(textOf(shown))) return shown
  for (let i = 1; i < shown.length; i++) {
    const rot = shown.slice(i).concat(shown.slice(0, i))
    if (!banned.has(textOf(rot))) return rot
  }
  throw new Error('no display order avoids the answer')
}

function attach(stage: BuiltStage, index: number): PeriodicAnswer['stages'][number] {
  const answerText = canonicalAnswer(stage.check)
  const traps = trapsFor(stage.check)
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

function promise(stages: PeriodicAnswer['stages'], pick: (traps: { stage: PeriodicAnswer['stages'][number]; trap: PtTrap }[]) => { stage: PeriodicAnswer['stages'][number]; trap: PtTrap } | null) {
  const all = stages.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap: trap as PtTrap })))
  const chosen = pick(all)
  if (!chosen) return {}
  return { trap: chosen.trap.id, trapStage: chosen.stage.id, trapAnswer: chosen.trap.text }
}

function firstPriority(traps: { stage: PeriodicAnswer['stages'][number]; trap: PtTrap }[]) {
  for (const id of LOCATE_PRIORITY) {
    const hit = traps.find((item) => item.trap.id === id)
    if (hit) return hit
  }
  return traps[0] ?? null
}

function buildAnswer(
  question: PeriodicAnswer['question'],
  prompt: string,
  drafts: BuiltStage[],
  pick: (traps: { stage: PeriodicAnswer['stages'][number]; trap: PtTrap }[]) => { stage: PeriodicAnswer['stages'][number]; trap: PtTrap } | null,
): PeriodicAnswer {
  const stages = drafts.map((draft, index) => attach(draft, index))
  const ruleCards = [...new Set(stages.map((stage) => stage.ruleCard))]
  const promised = promise(stages, pick)
  return {
    type: 'periodic',
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
  answer: PeriodicAnswer,
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
    kind: 'periodic',
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

function locateDrafts(el: ElementInfo, rng: Rng): BuiltStage[] {
  const drafts: BuiltStage[] = [
    {
      kind: 'text',
      label: 'Period',
      hint: 'A whole number.',
      nudge: 'Count the rows from the top of the table.',
      ruleCard: 'pt.row',
      check: { kind: 'period', z: el.z },
      reveal: (answer) => `Count the rows from the top. The period is ${answer}.`,
    },
    {
      kind: 'text',
      label: 'Group',
      hint: el.group == null ? 'A whole number, or a short phrase if it is not in a numbered column.' : 'A whole number.',
      nudge: 'Count the columns from the left, using the long form of the table.',
      ruleCard: 'pt.column',
      check: { kind: 'group', z: el.z },
      ...(el.group == null ? { accept: ['no group', 'no column', 'ungrouped'] } : {}),
      reveal: (answer) => (answer === 'none' ? 'This element is set below the main table, so it has no column number.' : `Count the columns from the left. The group is ${answer}.`),
    },
    {
      kind: 'text',
      label: 'Block',
      hint: 'One letter.',
      nudge: 'The block letter is the subshell that receives the last electron.',
      ruleCard: 'pt.block',
      check: { kind: 'block', z: el.z },
      reveal: (answer) => `The subshell that receives the last electron decides it. The block is ${answer}.`,
    },
    {
      kind: 'choice',
      label: 'Class',
      hint: 'Choose one.',
      nudge: 'Use the staircase, and remember hydrogen is an exception to its column.',
      ruleCard: 'pt.class',
      check: { kind: 'class', z: el.z },
      choices: rng.shuffle([
        { id: 'metal', text: 'metal' },
        { id: 'nonmetal', text: 'nonmetal' },
        { id: 'metalloid', text: 'metalloid' },
      ]),
      reveal: (answer) => `Place it against the staircase. The class is ${answer}.`,
    },
  ]
  if (familyOf(el)) {
    drafts.push({
      kind: 'choice',
      label: 'Family',
      hint: 'Choose one.',
      nudge: 'Match the column. The first element of the first column is not in that column family.',
      ruleCard: 'pt.family',
      check: { kind: 'family', z: el.z },
      choices: rng.shuffle([
        { id: 'alkali metals', text: 'alkali metals' },
        { id: 'alkaline earth metals', text: 'alkaline earth metals' },
        { id: 'halogens', text: 'halogens' },
        { id: 'noble gases', text: 'noble gases' },
        { id: 'transition metals', text: 'transition metals' },
      ]),
      reveal: (answer) => `The column decides the family. The family is ${answer}.`,
    })
  }
  return drafts.map((draft) => ({ ...draft, id: 'a' as const }))
}

function drawLocate(rng: Rng): { prompt: string; drafts: BuiltStage[]; params: Record<string, number | string | boolean> } {
  const form = rng.pick(['name', 'symbol'] as const)
  const category = rng.pick(LOCATE_CATEGORIES)
  const el = rng.pick(category)
  const who = form === 'name' ? el.name : el.symbol
  return {
    prompt: `Where is ${who} on the periodic table?`,
    drafts: locateDrafts(el, rng),
    params: { z: el.z, form },
  }
}

function valenceSymbol(el: ElementInfo): { prompt: string; drafts: BuiltStage[] } {
  return {
    prompt: `How many valence electrons does ${el.name} have?`,
    drafts: [
      {
        id: 'a',
        kind: 'text',
        label: 'Valence electrons',
        hint: 'A whole number.',
        nudge: 'Only the outermost shell counts. On the right side of the table, do not copy the column number.',
        ruleCard: 'pt.valence',
        check: { kind: 'valence', z: el.z },
        reveal: (answer) => `Count the outer shell only. The valence count is ${answer}.`,
      },
    ],
  }
}

function valenceGroup(group: number): { prompt: string; drafts: BuiltStage[] } {
  const prompt =
    group === 18
      ? 'How many valence electrons does an element in group 18 have, other than helium?'
      : group === 1
        ? 'How many valence electrons does an element in the first column have, other than hydrogen?'
        : group === 2
          ? 'How many valence electrons does an element in the second column have?'
          : `How many valence electrons does an element in group ${group} have?`
  return {
    prompt,
    drafts: [
      {
        id: 'a',
        kind: 'text',
        label: 'Valence electrons',
        hint: 'A whole number.',
        nudge: 'Only the outermost shell counts. On the right side of the table, do not copy the column number.',
        ruleCard: 'pt.valence',
        check: { kind: 'valence-group', group },
        reveal: (answer) => `The outer shell is what counts. The valence count is ${answer}.`,
      },
    ],
  }
}

function valenceConfig(el: ElementInfo): { prompt: string; drafts: BuiltStage[] } {
  const config = configurationOf(el.z).text
  return {
    prompt: `Read this configuration: ${config}.`,
    drafts: [
      {
        id: 'a',
        kind: 'text',
        label: 'Valence electrons',
        hint: 'A whole number.',
        nudge: 'Add only the electrons in the highest shell, not every superscript.',
        ruleCard: 'pt.valence',
        check: { kind: 'config-valence', config },
        reveal: (answer) => `Add the electrons whose shell number is highest. The valence count is ${answer}.`,
      },
      {
        id: 'b',
        kind: 'text',
        label: 'Block',
        hint: 'One letter.',
        nudge: 'The block letter is the subshell that received the last electron.',
        ruleCard: 'pt.block',
        check: { kind: 'config-block', config },
        reveal: (answer) => `Look at the subshell written last. The block is ${answer}.`,
      },
      {
        id: 'c',
        kind: 'text',
        label: 'Period',
        hint: 'A whole number.',
        nudge: 'The period is the highest shell number in the configuration, not the last superscript.',
        ruleCard: 'pt.row',
        check: { kind: 'config-period', config },
        reveal: (answer) => `The highest shell number is the row. The period is ${answer}.`,
      },
    ],
  }
}

function drawValence(rng: Rng): { prompt: string; drafts: BuiltStage[]; params: Record<string, number | string | boolean> } {
  const mode = rng.pick(['symbol', 'symbol', 'group', 'config', 'config', 'helium'] as const)
  if (mode === 'group') {
    const group = rng.pick([1, 2, 13, 14, 15, 16, 17, 18])
    return { ...valenceGroup(group), params: { mode, group } }
  }
  const pool = valencePool()
  const el = mode === 'helium' ? pool.find((item) => item.symbol === 'He')! : rng.pick(pool)
  const form = mode === 'helium' ? rng.pick(['symbol', 'config'] as const) : mode
  const drawn = form === 'config' ? valenceConfig(el) : valenceSymbol(el)
  return { ...drawn, params: { mode: form, z: el.z } }
}

function drawTrends(rng: Rng): { prompt: string; drafts: BuiltStage[]; params: Record<string, number | string | boolean> } {
  const scope = rng.pick(SCOPES)
  const open = PROPERTIES.filter((property) => trendSets(property, scope).length > 0)
  const property = rng.pick(open)
  const set = rng.pick(trendSets(property, scope))
  const direction = rng.pick(['increasing', 'decreasing'] as const)
  const check: PtCheck = { kind: 'rank', property, direction, zs: set.zs }
  const answerText = canonicalAnswer(check)
  const banned = new Set<string>([answerText, ...trapsFor(check).map((trap) => trap.text)])
  const shown = showItems(rng, set.zs, (list) => formatSymbols(list), banned)
  return {
    prompt: `Rank these by ${PROPERTY_PHRASE[property]}, ${direction}: ${formatSymbols(shown)}.`,
    drafts: [
      {
        id: 'a',
        kind: 'text',
        label: 'Order',
        hint: 'Use each symbol once, separated by commas.',
        nudge: 'Across a row and down a column can pull together. Put the symbols in the order asked.',
        ruleCard: 'pt.rank',
        check,
        reveal: (answer) => `${direction} ${PROPERTY_PHRASE[property]}: ${answer}.`,
      },
    ],
    params: { scope, property, direction, size: set.zs.length },
  }
}

function drawIons(rng: Rng): { prompt: string; drafts: BuiltStage[]; params: Record<string, number | string | boolean> } {
  const mode = rng.pick(['compare', 'series'] as const)
  if (mode === 'compare') {
    const pair = rng.pick(CHARGE_PAIRS)
    const symbol = symbolOf(pair.z)
    const ion = ionLabel(symbol, pair.charge)
    const labels = rng.shuffle([symbol, ion])
    return {
      prompt: `Which is larger, ${labels[0]} or ${labels[1]}?`,
      drafts: [
        {
          id: 'a',
          kind: 'choice',
          label: 'Larger one',
          hint: 'Choose one.',
          nudge: 'A positive ion lost electrons. A negative ion gained electrons.',
          ruleCard: 'pt.size',
          check: { kind: 'larger', z: pair.z, charge: pair.charge },
          choices: rng.shuffle([
            { id: symbol, text: symbol },
            { id: ion, text: ion },
          ]),
          reveal: (answer) => `${answer} is the larger one.`,
        },
      ],
      params: { mode, z: pair.z, charge: pair.charge },
    }
  }
  const size = rng.pick([3, 4] as const)
  const sets = isoSets(size)
  const set = rng.pick(sets.length > 0 ? sets : isoSets(size === 3 ? 4 : 3))
  const direction = rng.pick(['increasing', 'decreasing'] as const)
  const check: PtCheck = { kind: 'iso', direction, ions: set.ions }
  const answerText = canonicalAnswer(check)
  const banned = new Set<string>([answerText, ...trapsFor(check).map((trap) => trap.text)])
  const shown = showItems(rng, set.ions, (list) => list.map(speciesLabel).join(', '), banned)
  return {
    prompt: `These ions have the same number of electrons. Rank them by ionic radius, ${direction}: ${shown.map(speciesLabel).join(', ')}.`,
    drafts: [
      {
        id: 'a',
        kind: 'text',
        label: 'Order',
        hint: 'Use each ion once, separated by commas.',
        nudge: 'These ions share an electron count. Fewer protons hold that cloud less tightly.',
        ruleCard: 'pt.iso',
        check,
        reveal: (answer) => `${direction} ionic radius: ${answer}.`,
      },
    ],
    params: { mode, direction, size: set.ions.length, electrons: set.electrons },
  }
}

const WHY_VERB: Record<WhyCase['kind'], string> = {
  'period-radius': 'a smaller atomic radius',
  'period-ie': 'a higher first ionization energy',
  'group-radius': 'a larger atomic radius',
  'group-ie': 'a lower first ionization energy',
}

function drawWhy(rng: Rng): { prompt: string; drafts: BuiltStage[]; params: Record<string, number | string | boolean> } {
  const kind = rng.pick(['period-radius', 'period-ie', 'group-radius', 'group-ie'] as const)
  const item = rng.pick(whyCases(kind))
  const focus = symbolOf(item.focus)
  const other = symbolOf(item.other)
  return {
    prompt: `Why does ${focus} have ${WHY_VERB[kind]} than ${other}?`,
    drafts: [
      {
        id: 'a',
        kind: 'choice',
        label: 'Reason',
        hint: 'Choose one.',
        nudge: 'Decide whether the two elements share a row or sit one above the other.',
        ruleCard: 'pt.why',
        check: { kind: 'why', reason: item.reason },
        choices: rng.shuffle([
          { id: WHY_TEXT.protons, text: WHY_TEXT.protons },
          { id: WHY_TEXT.shells, text: WHY_TEXT.shells },
          { id: WHY_TEXT.shielding, text: WHY_TEXT.shielding },
        ]),
        reveal: (answer) => `The reason is: ${answer}.`,
      },
    ],
    params: { mode: kind, z: item.focus, other: item.other },
  }
}

function anyTrap(traps: { stage: PeriodicAnswer['stages'][number]; trap: PtTrap }[], rng: Rng) {
  if (traps.length === 0) return null
  return rng.pick(traps)
}

function makeTemplate(
  id: string,
  title: string,
  description: string,
  instructions: string,
  draw: (rng: Rng) => { prompt: string; drafts: BuiltStage[]; params: Record<string, number | string | boolean> },
  pick: (traps: { stage: PeriodicAnswer['stages'][number]; trap: PtTrap }[], rng: Rng) => { stage: PeriodicAnswer['stages'][number]; trap: PtTrap } | null,
): TemplateDef {
  return {
    id,
    title,
    description,
    version: 1,
    knobs: [],
    generate: (seed, knobs) => {
      const rng = makeRng(seed)
      const drawn = draw(rng)
      const answer = buildAnswer(id.slice(3) as PeriodicAnswer['question'], drawn.prompt, drawn.drafts, (traps) => pick(traps, rng))
      assertPeriodic(`${id}@${seed}`, answer)
      return instance({ id, title, version: 1 }, seed, knobs, instructions, answer, { ...drawn.params, trap: answer.trap ?? '' })
    },
  }
}

export const locateTemplate = makeTemplate(
  'pt.locate',
  'Find the element',
  'Period, group, block, metal or nonmetal, and family when it has one.',
  'Answer each part. A block is one letter. If the element has no column number, say so in a short phrase.',
  drawLocate,
  (traps) => firstPriority(traps),
)

export const valenceTemplate = makeTemplate(
  'pt.valence',
  'Valence electrons',
  'Valence electrons from the symbol, the group, or a configuration, plus the block and period of a configuration.',
  'Answer each part. Valence electrons are a whole number.',
  drawValence,
  (traps, rng) => anyTrap(traps, rng),
)

export const trendsTemplate = makeTemplate(
  'pt.trends',
  'Rank the trend',
  'Rank three or four elements by a periodic trend, in the order the measurements support.',
  'Type the symbols in the order asked, separated by commas.',
  drawTrends,
  (traps, rng) => anyTrap(traps, rng),
)

export const ionsTemplate = makeTemplate(
  'pt.ions',
  'Ion size',
  'Compare an ion with its atom, or rank an isoelectronic series by radius.',
  'Choose the larger one, or type the ions in the order asked.',
  drawIons,
  (traps, rng) => anyTrap(traps, rng),
)

export const whyTemplate = makeTemplate(
  'pt.why',
  'Why the trend',
  'Pick the reason a radius or ionization-energy comparison goes the way it does.',
  'Choose the reason.',
  drawWhy,
  (traps, rng) => anyTrap(traps, rng),
)
