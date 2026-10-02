/**
 * Electron-configuration templates (CK-12 ch. 5.4 onward) on the electrons module.
 *
 * Every species comes from econfigAtoms() / econfigIons(), and every problem is checked with
 * econfigProblem. Configurations, counts, diagrams and explanations are the engine's: this file
 * only chooses a species, a question, and which named mistake the seed promises.
 */
import type { Rng } from '@/content/rng'
import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ElectronsEconfigQuestion, ProblemInstance, RuleCardId, TemplateDef } from '@/content/types'
import { elementByZ } from '@/engine/chem/elements'
import {
  configurationDisplay,
  configurationLatex,
  configurationMistakes,
  configurationText,
  econfigAtoms,
  econfigIons,
  econfigProblem,
  electronConfiguration,
  electronCount,
  EXCEPTION_ELEMENTS,
  explainConfiguration,
  explainIdentify,
  explainOrbitalDiagram,
  explainUnpaired,
  explainValence,
  gradeConfiguration,
  identifyMistakes,
  orbitalDiagram,
  orbitalDiagramDisplay,
  orbitalDiagramMistakes,
  speciesDisplay,
  speciesLatex,
  speciesText,
  subshellName,
  unpairedElectrons,
  unpairedMistakes,
  valenceElectrons,
  valenceMistakes,
} from '@/engine'
import type { EconfigForm, EconfigMistakeKind, EconfigSpecies } from '@/engine'
import type { CalcPanels } from '@/shared/types'

type Species = EconfigSpecies

import { EL_MODULE_ID } from './build'
import { ecRule, type EcRuleKey } from './rules'

export const ECONFIG_TEMPLATE_IDS = ['ec.full', 'ec.shorthand', 'ec.ion', 'ec.identify', 'ec.valence', 'ec.diagram'] as const

type EconfigAsk = ElectronsEconfigQuestion['ask']
type Bucket = 'basic' | 'dblock' | 'exception' | 'after3d'

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const NUDGE: Record<EconfigAsk, string> = {
  full: 'Subshells fill from the lowest energy up. 4s comes before 3d, and 3d comes before 4p. An s subshell holds 2, a p holds 6 and a d holds 10. Keep going until every electron is placed.',
  shorthand: 'Start from the noble gas just before this element, in square brackets, and write only the subshells after it. The same filling order still applies, including 4s before 3d.',
  ion: 'The charge is how many electrons were gained or lost. A positive ion loses electrons from the highest shell number first, so a transition metal loses 4s before any 3d electron.',
  identify: 'Add up every electron in the configuration. A noble gas in brackets stands for all of its electrons. For a neutral atom that total is the atomic number; for an ion, undo the charge to get the protons.',
  valence: 'Valence electrons are only the ones in the outermost shell, the highest shell number. Count every subshell of that shell. A filled inner subshell, including 3d, is not part of the count, and neither is the atomic number.',
  diagram: 'Each box of this subshell gets one electron, all pointing the same way, before any box gets a second. Then count unpaired electrons in the whole atom or ion, not only in the subshell you drew.',
}

const INSTRUCTIONS: Record<EconfigAsk, string> = {
  full: 'Type the full configuration, every subshell from 1s. Any order is fine: 4s2 3d6 and 3d6 4s2 are the same answer.',
  shorthand: 'Type the noble-gas shorthand. Put the noble gas in square brackets, then only the subshells after it. Any order is fine.',
  ion: '',
  identify: 'Type the element’s symbol or its name.',
  valence: 'Type how many valence electrons, as a whole number.',
  diagram: 'Fill the boxes of the named subshell with arrows, then type how many unpaired electrons the whole atom or ion has.',
}

const TRAP_RULE: Partial<Record<EconfigMistakeKind, EcRuleKey>> = {
  filling_order: 'before3d',
  exception_missed: 'exceptions',
  exception_misapplied: 'exceptions',
  electron_count: 'filling',
  subshell_overfilled: 'filling',
  subshell_nonexistent: 'filling',
  ion_charge_ignored: 'ions',
  ion_wrong_direction: 'ions',
  ion_removed_from_3d: 'ions',
  ion_wrong_number: 'ions',
  core_wrong: 'shorthand',
  core_not_earlier: 'shorthand',
  valence_total_electrons: 'valence',
  valence_last_subshell: 'valence',
  hund_broken: 'hund',
  pauli_broken: 'pauli',
  unpaired_from_wrong_diagram: 'hund',
}

const RULES_FOR: Record<EconfigAsk, EcRuleKey[]> = {
  full: ['filling', 'before3d', 'exceptions'],
  shorthand: ['shorthand', 'filling', 'before3d', 'exceptions'],
  ion: ['ions', 'shorthand', 'before3d', 'filling'],
  identify: ['filling', 'shorthand', 'ions'],
  valence: ['valence', 'filling', 'before3d'],
  diagram: ['hund', 'pauli', 'ions', 'exceptions'],
}

/** 4s-before-3d (not Cr or Cu), the two exceptions, and 3d-full-before-4p come up much more often than Li–Ca. */
const ATOM_WEIGHT: Record<Bucket, number> = { basic: 1, dblock: 4, exception: 8, after3d: 4 }
/** Transition-metal cations (the 4s-leaves-first trap) against main-group ions. */
const ION_TM_WEIGHT = 5
const ION_MAIN_WEIGHT = 2

interface Named {
  name: string
  capital: string
  symbol: string
}

function names(sp: Species): Named {
  const el = elementByZ(sp.z)
  if (!el) throw new Error(`econfig template: no element for atomic number ${sp.z}`)
  return { name: el.name, capital: el.name.charAt(0).toUpperCase() + el.name.slice(1), symbol: el.symbol }
}

function chargePhrase(charge: number): string {
  return `${Math.abs(charge)}${charge > 0 ? '+' : '−'}`
}

/** Neutral transition metals are exactly the atoms whose valence count the engine refuses. */
function isTransitionMetal(z: number): boolean {
  return valenceElectrons({ z, charge: 0 }) === null
}

function has3d(sp: Species): boolean {
  return electronConfiguration(sp).some((term) => term.n === 3 && term.l === 'd')
}

/**
 * Li–Ca are the plain order. Sc–Zn except Cr and Cu are 4s-before-3d. Cr and Cu are the exceptions.
 * Ga–Kr are main-group atoms whose configuration already holds 3d.
 */
export function atomBucket(sp: Species): Bucket {
  if (EXCEPTION_ELEMENTS.includes(sp.z)) return 'exception'
  if (has3d(sp) && valenceElectrons(sp) !== null) return 'after3d'
  if (isTransitionMetal(sp.z)) return 'dblock'
  return 'basic'
}

/** A transition-metal cation: positive, and the neutral atom is outside the valence question. */
export function isTransitionCation(sp: Species): boolean {
  return sp.charge > 0 && isTransitionMetal(sp.z)
}

function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T {
  if (items.length === 0) throw new Error('econfig template: empty pool')
  let total = 0
  for (const item of items) total += weight(item)
  let roll = rng.next() * total
  for (const item of items) {
    roll -= weight(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]!
}

function chooseTrap(rng: Rng, candidates: readonly { kind: EconfigMistakeKind }[]): string {
  if (candidates.length === 0) return 'none'
  return rng.pick(candidates).kind
}

const ATOM_POOL: Species[] = econfigAtoms().filter((sp) => sp.z >= 3 && econfigProblem(sp, 'full') === null && econfigProblem(sp, 'shorthand') === null)

const ION_POOL: Species[] = econfigIons().filter((sp) => electronCount(sp) > 2 && econfigProblem(sp, 'shorthand') === null && econfigProblem(sp, 'full') === null)

const IDENTIFY_POOL: Species[] = [...econfigAtoms(), ...econfigIons()].filter((sp) => econfigProblem(sp, 'identify') === null)

const VALENCE_POOL: Species[] = econfigAtoms().filter((sp) => sp.z >= 3 && valenceElectrons(sp) !== null && econfigProblem(sp, 'valence') === null)

interface DiagramEntry {
  sp: Species
  subshell: string
  weight: number
}

function diagramWeight(sp: Species, subshell: string): number {
  let weight = 2
  if (sp.charge !== 0) weight += 3
  if (subshell.endsWith('d')) weight += 2
  if (sp.charge === 0 && EXCEPTION_ELEMENTS.includes(sp.z)) weight += 3
  if ((unpairedMistakes(sp)?.length ?? 0) > 0) weight += 1
  return weight
}

const DIAGRAM_POOL: DiagramEntry[] = []
for (const sp of [...econfigAtoms(), ...econfigIons()]) {
  if (econfigProblem(sp, 'unpaired')) continue
  for (const term of electronConfiguration(sp)) {
    const subshell = subshellName(term)
    if (econfigProblem(sp, 'diagram', subshell)) continue
    const mistakes = orbitalDiagramMistakes(sp, subshell)
    if (!mistakes?.some((c) => c.kind === 'hund_broken')) continue
    DIAGRAM_POOL.push({ sp, subshell, weight: diagramWeight(sp, subshell) })
  }
}
if (ATOM_POOL.length === 0 || ION_POOL.length === 0 || IDENTIFY_POOL.length === 0 || VALENCE_POOL.length === 0 || DIAGRAM_POOL.length === 0) {
  throw new Error('econfig template: a species pool came out empty')
}

function ruleKeys(ask: EconfigAsk, trap: string, charge: number): EcRuleKey[] {
  const primary = trap in TRAP_RULE ? TRAP_RULE[trap as EconfigMistakeKind] : undefined
  const base = RULES_FOR[ask].filter((key) => charge !== 0 || key !== 'ions' || ask === 'ion')
  const rest = primary ? base.filter((key) => key !== primary) : base
  return primary ? [primary, ...rest] : rest
}

/**
 * The line above the prompt. It says which element this is and nothing about the method: a sentence
 * such as "4s leaves before 3d" would hand her the very mistake the seed is there to catch.
 */
function contextFor(ask: EconfigAsk, sp: Species): string {
  if (ask === 'identify') return 'The configuration below belongs to one of the first 36 elements.'
  const { capital, symbol } = names(sp)
  const atom = `${capital} (${symbol}) has atomic number ${sp.z}.`
  return sp.charge === 0 ? atom : `${atom} This ion has a ${chargePhrase(sp.charge)} charge.`
}

interface Built {
  question: ElectronsEconfigQuestion
  prompt: string
  context: string
  instructions: string
  nudge: string
  ruleCards: RuleCardId[]
  reveal: string[]
  expectedDisplay: string
  trap: string
  scenario: string
}

function build(seed: number, ask: EconfigAsk, built: Built, knobs: DifficultyKnobs, templateId: string): ProblemInstance {
  const q = built.question
  const problem = econfigProblem(q.species, ask === 'ion' ? q.form : ask === 'full' || ask === 'shorthand' ? ask : ask === 'diagram' ? 'diagram' : ask, q.subshell)
  if (problem) throw new Error(`${templateId}/${seed}: ${problem}`)
  if (ask === 'diagram' && econfigProblem(q.species, 'unpaired')) throw new Error(`${templateId}/${seed}: unpaired question refused`)
  // The promised trap has to be one the engine would actually name, when any exist.
  if (built.trap !== 'none') {
    const kinds = trapKinds(q)
    if (!kinds.includes(built.trap)) throw new Error(`${templateId}/${seed}: trap ${built.trap} is not a candidate`)
  }
  return {
    id: `${EL_MODULE_ID}/${templateId}@1/${(seed >>> 0).toString(36)}`,
    moduleId: EL_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: 1,
    seed,
    knobs,
    kind: 'electrons',
    title: titleOf(templateId),
    instructions: built.instructions,
    statementText: built.prompt,
    vars: [],
    start: null,
    canonical: [],
    answer: {
      type: 'electrons',
      question: q,
      prompt: built.prompt,
      context: built.context,
      expectedDisplay: built.expectedDisplay,
      nudge: built.nudge,
      ruleCard: built.ruleCards[0]!,
      ruleCards: built.ruleCards,
      reveal: built.reveal,
      trap: built.trap,
    },
    graph: { kind: 'none' },
    calc: NO_CALC,
    params: {
      ask,
      z: q.species.z,
      charge: q.species.charge,
      trap: built.trap,
      scenario: built.scenario,
      symbol: speciesText(q.species),
      form: q.form ?? '',
      subshell: q.subshell ?? '',
    },
  }
}

function titleOf(id: string): string {
  switch (id) {
    case 'ec.full':
      return 'Full configuration'
    case 'ec.shorthand':
      return 'Noble-gas shorthand'
    case 'ec.ion':
      return 'Ion configuration'
    case 'ec.identify':
      return 'Which element is it?'
    case 'ec.valence':
      return 'Valence electrons'
    case 'ec.diagram':
      return 'Orbital diagram'
    default:
      return id
  }
}

/** Mistake kinds the engine offers for this problem, diagram and unpaired both when she does both. */
export function trapKinds(q: ElectronsEconfigQuestion): string[] {
  const sp = q.species
  switch (q.ask) {
    case 'full':
    case 'shorthand':
    case 'ion':
      return configurationMistakes(sp, q.form ?? 'full')?.map((c) => c.kind) ?? []
    case 'identify':
      return identifyMistakes(sp)?.map((c) => c.kind) ?? []
    case 'valence':
      return valenceMistakes(sp)?.map((c) => c.kind) ?? []
    case 'diagram':
      return [...(orbitalDiagramMistakes(sp, q.subshell)?.map((c) => c.kind) ?? []), ...(unpairedMistakes(sp)?.map((c) => c.kind) ?? [])]
    default:
      return []
  }
}

function configBuilt(sp: Species, form: EconfigForm, ask: 'full' | 'shorthand' | 'ion', trap: string, scenario: string): Built {
  const { name, symbol } = names(sp)
  const who = sp.charge === 0 ? `${name} (${symbol})` : `the ${name} ion ${speciesDisplay(sp)}`
  const prompt = form === 'shorthand' ? `Write the noble-gas shorthand for ${who}.` : `Write the full electron configuration of ${who}.`
  const keys = ruleKeys(ask, trap, sp.charge)
  return {
    question: {
      kind: 'econfig',
      ask,
      species: { z: sp.z, charge: sp.charge },
      form,
      latex: speciesLatex(sp),
      display: speciesDisplay(sp),
    },
    prompt,
    context: contextFor(ask, sp),
    instructions: form === 'shorthand' ? INSTRUCTIONS.shorthand : INSTRUCTIONS.full,
    nudge: ask === 'ion' ? NUDGE.ion : form === 'shorthand' ? NUDGE.shorthand : NUDGE.full,
    ruleCards: keys.map((key) => ecRule(key)),
    reveal: explainConfiguration(sp, { form }),
    expectedDisplay: configurationDisplay(sp, { form }),
    trap,
    scenario,
  }
}

function drawAtom(rng: Rng, form: EconfigForm, ask: 'full' | 'shorthand'): Built {
  const sp = weightedPick(rng, ATOM_POOL, (s) => ATOM_WEIGHT[atomBucket(s)])
  const scenario = atomBucket(sp)
  const trap = chooseTrap(rng, configurationMistakes(sp, form) ?? [])
  return configBuilt(sp, form, ask, trap, scenario)
}

function drawIon(rng: Rng): Built {
  const sp = weightedPick(rng, ION_POOL, (s) => (isTransitionCation(s) ? ION_TM_WEIGHT : ION_MAIN_WEIGHT))
  const tm = isTransitionCation(sp)
  let form: EconfigForm = tm ? 'shorthand' : rng.chance(0.5) ? 'shorthand' : 'full'
  if (econfigProblem(sp, form)) form = form === 'full' ? 'shorthand' : 'full'
  const trap = chooseTrap(rng, configurationMistakes(sp, form) ?? [])
  return configBuilt(sp, form, 'ion', trap, tm ? 'ion-tm' : 'ion-main')
}

function drawIdentify(rng: Rng): Built {
  const sp = weightedPick(rng, IDENTIFY_POOL, (s) => (s.charge === 0 ? 1 : 2))
  const shorthandOk = econfigProblem(sp, 'shorthand') === null
  const form: EconfigForm = shorthandOk && rng.chance(0.5) ? 'shorthand' : 'full'
  const prompt =
    sp.charge === 0
      ? 'Which element has this electron configuration?'
      : `An ion with a ${chargePhrase(sp.charge)} charge has this electron configuration. Which element is it?`
  const trap = chooseTrap(rng, identifyMistakes(sp) ?? [])
  const keys = ruleKeys('identify', trap, sp.charge)
  return {
    question: {
      kind: 'econfig',
      ask: 'identify',
      species: { z: sp.z, charge: sp.charge },
      form,
      latex: configurationLatex(sp, { form }),
      display: configurationDisplay(sp, { form }),
    },
    prompt,
    context: contextFor('identify', sp),
    instructions: INSTRUCTIONS.identify,
    nudge: NUDGE.identify,
    ruleCards: keys.map((key) => ecRule(key)),
    reveal: explainIdentify(sp, { form }),
    expectedDisplay: speciesDisplay(sp),
    trap,
    scenario: sp.charge === 0 ? 'atom' : 'ion',
  }
}

function valenceScenario(sp: Species): string {
  if (has3d(sp)) return 'after3d'
  if ((valenceMistakes(sp) ?? []).some((c) => c.kind === 'valence_last_subshell')) return 'both-traps'
  return 'outer-only'
}

function valenceWeight(sp: Species): number {
  const scenario = valenceScenario(sp)
  if (scenario === 'after3d') return 5
  if (scenario === 'both-traps') return 3
  return 1
}

function drawValence(rng: Rng): Built {
  const sp = weightedPick(rng, VALENCE_POOL, valenceWeight)
  const scenario = valenceScenario(sp)
  const { name, symbol } = names(sp)
  const count = valenceElectrons(sp)
  if (count === null) throw new Error(`econfig valence: ${speciesText(sp)} has no valence count`)
  const trap = chooseTrap(rng, valenceMistakes(sp) ?? [])
  const keys = ruleKeys('valence', trap, 0)
  return {
    question: {
      kind: 'econfig',
      ask: 'valence',
      species: { z: sp.z, charge: 0 },
      latex: speciesLatex(sp),
      display: speciesDisplay(sp),
    },
    prompt: `How many valence electrons does an atom of ${name} (${symbol}) have?`,
    context: contextFor('valence', sp),
    instructions: INSTRUCTIONS.valence,
    nudge: NUDGE.valence,
    ruleCards: keys.map((key) => ecRule(key)),
    reveal: explainValence(sp),
    expectedDisplay: String(count),
    trap,
    scenario,
  }
}

function drawDiagram(rng: Rng): Built {
  const entry = weightedPick(rng, DIAGRAM_POOL, (e) => e.weight)
  const { sp, subshell } = entry
  const { name } = names(sp)
  const diagramCands = orbitalDiagramMistakes(sp, subshell) ?? []
  const unpairedCands = unpairedMistakes(sp) ?? []
  const useUnpaired = unpairedCands.length > 0 && rng.chance(0.4)
  const trap = chooseTrap(rng, useUnpaired ? unpairedCands : diagramCands)
  const info = orbitalDiagram(sp, subshell)
  const who = sp.charge === 0 ? `a ${name} atom` : speciesDisplay(sp)
  const keys = ruleKeys('diagram', trap, sp.charge)
  return {
    question: {
      kind: 'econfig',
      ask: 'diagram',
      species: { z: sp.z, charge: sp.charge },
      subshell,
      latex: speciesLatex(sp),
      display: speciesDisplay(sp),
    },
    prompt: `Fill in the orbital diagram of the ${subshell} subshell of ${speciesDisplay(sp)}, then say how many unpaired electrons ${who} has in all.`,
    context: contextFor('diagram', sp),
    instructions: INSTRUCTIONS.diagram,
    nudge: NUDGE.diagram,
    ruleCards: keys.map((key) => ecRule(key)),
    reveal: [...explainOrbitalDiagram(sp, subshell), ...explainUnpaired(sp)],
    expectedDisplay: `${info.name}: ${orbitalDiagramDisplay(info.boxes)} · ${unpairedElectrons(sp)} unpaired`,
    trap,
    scenario: `${sp.charge === 0 ? 'atom' : 'ion'}-${subshell}`,
  }
}

function makeTemplate(id: (typeof ECONFIG_TEMPLATE_IDS)[number], title: string, description: string, draw: (rng: Rng) => Built): TemplateDef {
  return {
    id,
    title,
    description,
    version: 1,
    knobs: [],
    generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
      return build(seed, askOf(id), draw(makeRng(seed)), knobs, id)
    },
  }
}

function askOf(id: (typeof ECONFIG_TEMPLATE_IDS)[number]): EconfigAsk {
  switch (id) {
    case 'ec.full':
      return 'full'
    case 'ec.shorthand':
      return 'shorthand'
    case 'ec.ion':
      return 'ion'
    case 'ec.identify':
      return 'identify'
    case 'ec.valence':
      return 'valence'
    case 'ec.diagram':
      return 'diagram'
  }
}

export const fullTemplate = makeTemplate('ec.full', 'Full configuration', 'The full electron configuration of a neutral atom, lithium through krypton. 4s-before-3d, chromium and copper, and gallium through krypton come up often.', (rng) => drawAtom(rng, 'full', 'full'))

export const shorthandTemplate = makeTemplate('ec.shorthand', 'Noble-gas shorthand', 'The noble-gas shorthand of a neutral atom, lithium through krypton, with the same weighting as the full configuration.', (rng) => drawAtom(rng, 'shorthand', 'shorthand'))

export const ionTemplate = makeTemplate('ec.ion', 'Ion configuration', 'The configuration of an ion. Transition-metal cations are asked in shorthand (4s leaves first); main-group ions in either form.', drawIon)

export const identifyTemplate = makeTemplate('ec.identify', 'Which element is it?', 'A configuration is shown. She names the element or, when the charge is stated, the element the ion came from.', drawIdentify)

export const valenceTemplate = makeTemplate('ec.valence', 'Valence electrons', 'How many valence electrons a main-group atom has. Gallium through krypton come up often, for the filled-3d trap.', drawValence)

export const diagramTemplate = makeTemplate('ec.diagram', 'Orbital diagram', 'The orbital diagram of one named subshell where Hund’s rule matters, then the unpaired electrons in the whole atom or ion.', drawDiagram)

/** Both writing orders of the canonical configuration grade correct. Used by the template self-test. */
export function configurationOrdersGrade(sp: EconfigSpecies, form: EconfigForm): boolean {
  for (const order of ['filling', 'shell'] as const) {
    const text = configurationText(sp, { form, order })
    if (gradeConfiguration(sp, text, { form }).verdict !== 'correct') return false
  }
  return true
}
