/**
 * Chapter 7 templates. Each seed draws its ion or compound, and the direction, from the pools; the engine gives
 * the answer, the accepted forms, what each slip produces and the explanation. Every problem is checked before it
 * ships (`assertNomenclature`): the engine says the problem is in the model, its own answer and every accepted
 * form grade correct, every candidate grades as its own id, the promised trap is one of them, and nothing she can
 * see before she finishes shows the answer.
 *
 * A problem is built by one of the exported builders from explicit choices (an ion and a direction, a compound and
 * a group …); the draw functions only make those choices from the seed. `everyProblem` lists every problem a
 * template can build, so the tests can check them all, not only the seeds they happen to run.
 */
import {
  compoundFormula,
  compoundName,
  compoundOfFormula,
  formulaDisplay,
  ionicCompound,
  resolveIon,
  romanValue,
  type AcidCompound,
  type IonicCompound,
  type NmIon,
  type NmMistakeId,
} from '@/engine'
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, NmPromptPart, NmStage, NmStageId, NomenclatureAnswer, NomenclatureQuestion, ProblemInstance, RuleCardId, TemplateDef } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import { assertNomenclature } from './check'
import { stageOf, type PartDraft } from './build'
import {
  ACID_NAME_RESERVED,
  anionsFor,
  classifyPool,
  MOLECULAR_NAME_RESERVED,
  needsNumeral,
  pickWeighted,
  poolAcids,
  poolCations,
  poolHydrates,
  poolIonicCompounds,
  poolIons,
  poolMolecular,
  printedAcidFormula,
  type ClassifyGroup,
  type ClassifyItem,
  type Weighted,
} from './pools'

const STAGE_IDS: readonly NmStageId[] = ['a', 'b', 'c']
const NO_CALC = { ti84: [], nspire: [] }

// --- wording -------------------------------------------------------------------------------------------

/** The line under each kind of box. None contains an answer a template can generate. */
export const HINTS = {
  ionName: 'Type the ion’s name in words.',
  ionFormula: 'Type the formula, then its charge: ^2- or a space and 2-.',
  formula: 'Type subscripts as plain digits. Capital letters matter.',
  hydrateFormula: 'Type subscripts as plain digits, and the dot as * or a period.',
  name: 'Type the name in words.',
  acidName: 'Type the name in words, ending with acid.',
  choice: 'Choose one.',
} as const

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function ionCard(ion: NmIon): RuleCardId {
  if (ion.kind === 'polyatomic') return 'nm.polyatomic'
  return needsNumeral(ion) || ion.numeralOptional ? 'nm.numeral' : 'nm.charges'
}

function ionNameNudge(ion: NmIon): string {
  if (ion.kind === 'polyatomic') return 'This ion has more than one atom: its name is in the polyatomic ion table.'
  if (ion.role === 'anion') return 'A one-atom anion is named from its element, with a new ending.'
  if (needsNumeral(ion) || ion.numeralOptional) return 'This metal can form more than one ion, so the name says which one.'
  return 'A one-atom cation is named after its element. Does this metal form more than one ion?'
}

function ionFormulaNudge(ion: NmIon): string {
  if (ion.kind === 'polyatomic') return 'Find the ion in the polyatomic ion table: its formula and its charge.'
  if (ion.role === 'cation' && ion.numeral !== null) return 'Write the metal’s symbol. The Roman numeral in the name is the charge.'
  return 'Write the element’s symbol, then the charge its group in the periodic table gives.'
}

function ionicNameNudge(c: IonicCompound): string {
  if (needsNumeral(c.cation)) return 'Name the cation, then the anion. This metal has more than one charge: work out one metal ion’s charge from the anions.'
  return 'Name the cation, then the anion. An ionic name has no prefixes.'
}

const FORMULA_NUDGE = 'Write each ion’s formula and charge, then balance the charges with the lowest whole numbers.'
const IONS_NUDGE = 'The charges must add up to zero. How many of each ion does that take, in the lowest whole numbers?'
const MOLECULAR_NAME_NUDGE = 'Count the atoms of each element and give each count its Greek prefix. The first element never takes mono-.'
const MOLECULAR_FORMULA_NUDGE = 'Each prefix gives the subscript of its element.'
const ACID_NAME_NUDGE = 'Look at the anion. No oxygen: hydro-…-ic acid. An -ate anion gives -ic acid; an -ite anion gives -ous acid.'
const ACID_FORMULA_NUDGE = 'Find the anion the name comes from, then put enough H in front to balance its charge.'
const ANION_ACID_NUDGE = 'Read the anion’s ending: -ide, -ate or -ite. Each one gives the acid its own kind of name.'
const HYDRATE_NAME_NUDGE = 'Name the ionic compound before the dot, then count the waters with a Greek prefix.'
const HYDRATE_FORMULA_NUDGE = 'Write the ionic compound’s formula, then a dot, the number of waters and H2O.'
const CLASSIFY_NUDGE = 'Check in order: water after a dot? H written first, dissolved in water? A metal ion or NH₄⁺? Only nonmetals?'

function ionicCards(c: IonicCompound): RuleCardId[] {
  const out: RuleCardId[] = []
  if (c.cation.numeral !== null) out.push('nm.numeral')
  if (c.cation.kind === 'polyatomic' || c.anion.kind === 'polyatomic') out.push('nm.polyatomic')
  if (c.anion.kind === 'monatomic') out.push('nm.charges')
  return out
}

// --- the problems --------------------------------------------------------------------------------------

/** One problem before the engine fills it in: how it is printed, its parts, and the cards it leans on. */
export interface NmDrawn {
  given: NomenclatureAnswer['given']
  problem: string
  ions?: { cation: string; anion: string }
  parts: NmPromptPart[]
  drafts: PartDraft[]
  /** Cards this problem leans on besides each part's own card (folded under it on rung 2). */
  cards: RuleCardId[]
  params: Record<string, string | number | boolean>
}

/** nm.ion: name an ion from its formula, or write its formula (with the charge) from its name. */
export function ionProblem(ion: NmIon, direction: 'name' | 'formula'): NmDrawn {
  const card = ionCard(ion)
  if (direction === 'name')
    return {
      given: 'formula',
      problem: ion.text,
      parts: [{ text: 'Name the ion ' }, { formula: ion.text }, { text: '.' }],
      drafts: [{ kind: 'name', part: 'ion-name', label: 'Name of the ion', hint: HINTS.ionName, nudge: ionNameNudge(ion), ruleCard: card, check: { kind: 'ion_name', ion: ion.text } }],
      cards: [],
      params: { direction, ion: ion.text },
    }
  return {
    given: 'name',
    problem: ion.name,
    parts: [{ text: `Write the formula of the ${ion.name} ion, with its charge.` }],
    drafts: [{ kind: 'ion', part: 'ion-formula', label: 'Formula of the ion', hint: HINTS.ionFormula, nudge: ionFormulaNudge(ion), ruleCard: card, check: { kind: 'ion_formula', ion: ion.name } }],
    cards: [],
    params: { direction, ion: ion.text },
  }
}

/**
 * nm.ionicFormula: the formula of the compound of two ions, given as formulas (one part) or by name (each ion
 * with its charge first, then the formula, as the textbook's worked examples list the ions first).
 */
export function ionicFormulaProblem(c: IonicCompound, byName: boolean): NmDrawn {
  const formulaPart: PartDraft = {
    kind: 'formula',
    part: 'ionic-formula',
    label: 'Formula',
    hint: HINTS.formula,
    nudge: IONS_NUDGE,
    ruleCard: 'nm.crisscross',
    check: { kind: 'ionic_formula', cation: c.cation.text, anion: c.anion.text },
  }
  if (!byName)
    return {
      given: 'ions',
      problem: `${c.cation.text} and ${c.anion.text}`,
      ions: { cation: c.cation.text, anion: c.anion.text },
      parts: [{ text: 'Write the formula of the ionic compound formed by ' }, { formula: c.cation.text }, { text: ' and ' }, { formula: c.anion.text }, { text: '.' }],
      drafts: [formulaPart],
      cards: ionicCards(c),
      params: { byName, cation: c.cation.text, anion: c.anion.text },
    }
  const ionPart = (ion: NmIon, label: string): PartDraft => ({
    kind: 'ion',
    part: 'ion-formula',
    label,
    hint: HINTS.ionFormula,
    nudge: ionFormulaNudge(ion),
    ruleCard: ionCard(ion),
    check: { kind: 'ion_formula', ion: ion.name },
  })
  return {
    given: 'ions',
    problem: `${c.cation.name} and ${c.anion.name}`,
    ions: { cation: c.cation.name, anion: c.anion.name },
    parts: [{ text: `${capital(c.cation.name)} ions and ${c.anion.name} ions form an ionic compound. Write each ion with its charge, then the formula of the compound.` }],
    drafts: [ionPart(c.cation, 'Cation'), ionPart(c.anion, 'Anion'), formulaPart],
    cards: ionicCards(c),
    params: { byName, cation: c.cation.text, anion: c.anion.text },
  }
}

export type IonicGroup = 'numeral' | 'fixed' | 'ammonium' | 'nickel'

/** nm.ionicName: name an ionic compound from its formula. */
export function ionicNameProblem(c: IonicCompound, group: IonicGroup): NmDrawn {
  const formula = compoundFormula(c)
  return {
    given: 'formula',
    problem: formula,
    parts: [{ text: 'Name the ionic compound ' }, { formula }, { text: '.' }],
    drafts: [{ kind: 'name', part: 'ionic-name', label: 'Name', hint: HINTS.name, nudge: ionicNameNudge(c), ruleCard: 'nm.ionicNaming', check: { kind: 'name', formula } }],
    cards: ionicCards(c),
    params: { group, formula },
  }
}

/** nm.ionicFromName: write the formula of a named ionic compound. */
export function ionicFromNameProblem(c: IonicCompound, group: IonicGroup): NmDrawn {
  const name = compoundName(c)
  return {
    given: 'name',
    problem: name,
    parts: [{ text: `Write the formula of ${name}.` }],
    drafts: [{ kind: 'formula', part: 'ionic-formula', label: 'Formula', hint: HINTS.formula, nudge: FORMULA_NUDGE, ruleCard: 'nm.crisscross', check: { kind: 'formula', name } }],
    cards: ionicCards(c),
    params: { group, formula: compoundFormula(c) },
  }
}

/** nm.molecular: name a binary molecular compound, or write its formula from the name. */
export function molecularProblem(formula: string, direction: 'name' | 'formula'): NmDrawn {
  if (direction === 'name')
    return {
      given: 'formula',
      problem: formula,
      parts: [{ text: 'Name the molecular compound ' }, { formula }, { text: '.' }],
      drafts: [{ kind: 'name', part: 'molecular-name', label: 'Name', hint: HINTS.name, nudge: MOLECULAR_NAME_NUDGE, ruleCard: 'nm.prefixes', check: { kind: 'name', formula } }],
      cards: [],
      params: { direction, formula },
    }
  const name = compoundName(compoundOfFormula(formula)!)
  return {
    given: 'name',
    problem: name,
    parts: [{ text: `Write the formula of ${name}.` }],
    drafts: [{ kind: 'formula', part: 'molecular-formula', label: 'Formula', hint: HINTS.formula, nudge: MOLECULAR_FORMULA_NUDGE, ruleCard: 'nm.prefixes', check: { kind: 'formula', name } }],
    cards: [],
    params: { direction, formula },
  }
}

export type AcidDirection = 'name' | 'formula' | 'anion'

/** nm.acid: name an acid from its formula (binary acids printed with (aq)) or from its anion, or write its formula. */
export function acidProblem(acid: AcidCompound, direction: AcidDirection): NmDrawn {
  const printed = printedAcidFormula(acid)
  const cards: RuleCardId[] = acid.binary ? [] : ['nm.polyatomic']
  const nameDraft = (nudge: string): PartDraft => ({ kind: 'name', part: 'acid-name', label: 'Name', hint: HINTS.acidName, nudge, ruleCard: 'nm.acids', check: { kind: 'name', formula: printed } })
  if (direction === 'name')
    return {
      given: 'formula',
      problem: printed,
      parts: [{ text: 'Name the acid ' }, { formula: printed }, { text: '.' }],
      drafts: [nameDraft(ACID_NAME_NUDGE)],
      cards,
      params: { direction, formula: printed },
    }
  if (direction === 'anion')
    return {
      given: 'anion',
      problem: acid.anion.text,
      parts: [{ text: `An acid is made of hydrogen ions and the ${acid.anion.name} ion, ` }, { formula: acid.anion.text }, { text: '. Name the acid.' }],
      drafts: [nameDraft(ANION_ACID_NUDGE)],
      cards,
      params: { direction, formula: printed },
    }
  const name = compoundName(acid)
  return {
    given: 'name',
    problem: name,
    parts: [{ text: `Write the formula of ${name}.` }],
    drafts: [{ kind: 'formula', part: 'acid-formula', label: 'Formula', hint: HINTS.formula, nudge: ACID_FORMULA_NUDGE, ruleCard: 'nm.acids', check: { kind: 'formula', name } }],
    cards,
    params: { direction, formula: printed },
  }
}

/** nm.hydrate: name a hydrate from its formula, or write its formula from the name. */
export function hydrateProblem(formula: string, direction: 'name' | 'formula'): NmDrawn {
  const c = compoundOfFormula(formula)
  if (!c || c.kind !== 'hydrate') throw new Error(`${formula} is not a hydrate of the model`)
  if (direction === 'name')
    return {
      given: 'formula',
      problem: formula,
      parts: [{ text: 'Name the hydrate ' }, { formula }, { text: '.' }],
      drafts: [{ kind: 'name', part: 'hydrate-name', label: 'Name', hint: HINTS.name, nudge: HYDRATE_NAME_NUDGE, ruleCard: 'nm.hydrates', check: { kind: 'name', formula } }],
      cards: ['nm.ionicNaming', ...ionicCards(c.salt)],
      params: { direction, formula },
    }
  const name = compoundName(c)
  return {
    given: 'name',
    problem: name,
    parts: [{ text: `Write the formula of ${name}.` }],
    drafts: [{ kind: 'formula', part: 'hydrate-formula', label: 'Formula', hint: HINTS.hydrateFormula, nudge: HYDRATE_FORMULA_NUDGE, ruleCard: 'nm.hydrates', check: { kind: 'formula', name } }],
    cards: ['nm.crisscross', ...ionicCards(c.salt)],
    params: { direction, formula },
  }
}

/** nm.classify: which of the four kinds a formula is (which naming rules it follows). */
export function classifyProblem(item: ClassifyItem): NmDrawn {
  return {
    given: 'classify',
    problem: item.formula,
    parts: [{ text: 'What kind of compound is ' }, { formula: item.formula }, { text: '? Decide which naming rules it follows.' }],
    drafts: [{ kind: 'choice', part: 'class', label: 'Kind of compound', hint: HINTS.choice, nudge: CLASSIFY_NUDGE, ruleCard: 'nm.classify', check: { kind: 'classify', formula: item.formula } }],
    cards: [],
    params: { group: item.group, formula: item.formula },
  }
}

// --- drawing from the seed -----------------------------------------------------------------------------

const IONIC_GROUPS: readonly Weighted<IonicGroup>[] = [
  { item: 'numeral', weight: 45 },
  { item: 'fixed', weight: 35 },
  { item: 'ammonium', weight: 15 },
  { item: 'nickel', weight: 5 },
]

export function cationsOf(group: IonicGroup): Weighted<NmIon>[] {
  return poolCations().filter(({ item: c }) => {
    if (group === 'numeral') return needsNumeral(c)
    if (group === 'nickel') return c.numeralOptional
    if (group === 'ammonium') return c.formula === 'NH4'
    return c.numeral === null && c.formula !== 'NH4'
  })
}

/** An ionic compound from a group: a metal with a numeral, a one-charge metal (half with a polyatomic anion), ammonium, nickel. */
function drawIonicCompound(rng: Rng): { c: IonicCompound; group: IonicGroup } {
  const group = pickWeighted(rng, IONIC_GROUPS)
  const cation = pickWeighted(rng, cationsOf(group))
  const wantPoly = group === 'fixed' ? rng.chance(0.5) : null
  const anions = anionsFor(cation, (a) => wantPoly === null || (a.kind === 'polyatomic') === wantPoly)
  const anion = pickWeighted(rng, anions.length > 0 ? anions : anionsFor(cation))
  return { c: ionicCompound(cation, anion), group }
}

let IONS_POOL: Weighted<IonicCompound>[] | null = null

/** Unequal charges exercise the criss-cross; equal ones come up too, half as often. */
function ionsPool(): Weighted<IonicCompound>[] {
  IONS_POOL ??= poolIonicCompounds().map((p) => ({ item: p.compound, weight: p.weight * (p.compound.cation.charge === -p.compound.anion.charge ? 1 : 2) }))
  return IONS_POOL
}

const ACID_DIRECTIONS: readonly Weighted<AcidDirection>[] = [
  { item: 'name', weight: 2 },
  { item: 'formula', weight: 2 },
  { item: 'anion', weight: 1 },
]

const CLASSIFY_GROUPS: readonly Weighted<ClassifyGroup>[] = [
  { item: 'ammonium', weight: 3 },
  { item: 'hydrate', weight: 3 },
  { item: 'acid', weight: 3 },
  { item: 'ionic', weight: 1 },
  { item: 'molecular', weight: 1 },
]

const DRAW: Readonly<Record<NomenclatureQuestion, (rng: Rng) => NmDrawn>> = {
  ion: (rng) => ionProblem(pickWeighted(rng, poolIons()), rng.pick(['name', 'formula'] as const)),
  ionicFormula: (rng) => {
    const c = pickWeighted(rng, ionsPool())
    return ionicFormulaProblem(c, rng.chance(0.4))
  },
  ionicName: (rng) => {
    const { c, group } = drawIonicCompound(rng)
    return ionicNameProblem(c, group)
  },
  ionicFromName: (rng) => {
    const { c, group } = drawIonicCompound(rng)
    return ionicFromNameProblem(c, group)
  },
  molecular: (rng) => {
    const formula = pickWeighted(rng, poolMolecular())
    const wantName = rng.chance(0.5)
    return molecularProblem(formula, wantName && !MOLECULAR_NAME_RESERVED.has(formula) ? 'name' : 'formula')
  },
  acid: (rng) => {
    const acid = pickWeighted(rng, poolAcids())
    let direction = pickWeighted(rng, ACID_DIRECTIONS)
    if (direction !== 'formula' && ACID_NAME_RESERVED.has(printedAcidFormula(acid))) direction = 'formula'
    return acidProblem(acid, direction)
  },
  hydrate: (rng) => hydrateProblem(pickWeighted(rng, poolHydrates()), rng.pick(['name', 'formula'] as const)),
  classify: (rng) => {
    const group = pickWeighted(rng, CLASSIFY_GROUPS)
    return classifyProblem(pickWeighted(rng, classifyPool().filter((w) => w.item.group === group)))
  },
}

const groupOf = (c: IonicCompound): IonicGroup =>
  c.cation.formula === 'NH4' ? 'ammonium' : c.cation.numeralOptional ? 'nickel' : needsNumeral(c.cation) ? 'numeral' : 'fixed'

/** Every problem a template can build (each pool item in each direction it is asked), for the tests. */
export function everyProblem(question: NomenclatureQuestion): NmDrawn[] {
  const ionic = poolIonicCompounds().map((p) => p.compound)
  switch (question) {
    case 'ion':
      return poolIons().flatMap(({ item }) => [ionProblem(item, 'name'), ionProblem(item, 'formula')])
    case 'ionicFormula':
      return ionic.flatMap((c) => [ionicFormulaProblem(c, false), ionicFormulaProblem(c, true)])
    case 'ionicName':
      return ionic.map((c) => ionicNameProblem(c, groupOf(c)))
    case 'ionicFromName':
      return ionic.map((c) => ionicFromNameProblem(c, groupOf(c)))
    case 'molecular':
      return poolMolecular().flatMap(({ item }) => [...(MOLECULAR_NAME_RESERVED.has(item) ? [] : [molecularProblem(item, 'name')]), molecularProblem(item, 'formula')])
    case 'acid':
      return poolAcids().flatMap(({ item }) => [
        ...(ACID_NAME_RESERVED.has(printedAcidFormula(item)) ? [] : [acidProblem(item, 'name'), acidProblem(item, 'anion')]),
        acidProblem(item, 'formula'),
      ])
    case 'hydrate':
      return poolHydrates().flatMap(({ item }) => [hydrateProblem(item, 'name'), hydrateProblem(item, 'formula')])
    case 'classify':
      return classifyPool().map(({ item }) => classifyProblem(item))
  }
}

// --- the answer and the instance ------------------------------------------------------------------------

/** How strongly a slip is preferred as the seed's promised trap: the classic ones first, every one possible. */
const TRAP_WEIGHT: Readonly<Partial<Record<NmMistakeId, number>>> = {
  nm_numeral_wrong: 3,
  nm_numeral_missing: 3,
  nm_numeral_as_subscript: 3,
  nm_crisscross_reversed: 3,
  nm_parentheses_missing: 3,
  nm_not_lowest_ratio: 3,
  nm_charges_unbalanced: 3,
  nm_ate_ite_swapped: 3,
  nm_ide_for_polyatomic: 3,
  nm_prefix_on_ionic: 3,
  nm_prefix_missing: 3,
  nm_mono_on_first: 3,
  nm_hydro_on_oxyacid: 3,
  nm_hydro_missing: 3,
  nm_ic_ous_swapped: 3,
  nm_hydrate_count_wrong: 3,
  nm_ion_charge_wrong: 3,
  nm_class_ammonium_molecular: 3,
  nm_class_hydrate_ignored: 3,
  nm_class_acid_ignored: 3,
}

/**
 * A candidate's text is the engine's first variant of the slip. A few read oddly as a promise ("lithium
 * mononitrate", "aluminum(I) nitrate"): they stay possible, at a tenth of the weight.
 */
function natural(stage: NmStage, text: string): number {
  if (/\bmono(?!hydrate|xide)/.test(text) && stage.part !== 'molecular-name') return 0.1
  const numeral = /\(([IVX]+)\)/.exec(text)?.[1]
  if (!numeral) return 1
  const check = stage.check
  const c = check.kind === 'name' ? compoundOfFormula(check.formula) : null
  const cation = c?.kind === 'ionic' ? c.cation : c?.kind === 'hydrate' ? c.salt.cation : check.kind === 'ion_name' ? resolveIon(check.ion) : null
  if (cation && cation.numeral === null && romanValue(numeral) !== cation.charge) return 0.1
  return 1
}

function promise(stages: NmStage[], rng: Rng): Pick<NomenclatureAnswer, 'trap' | 'trapStage' | 'trapAnswer'> {
  const main = stages[stages.length - 1]!
  if (main.traps.length === 0) return {}
  const trap = pickWeighted(
    rng,
    main.traps.map((t) => ({ item: t, weight: (TRAP_WEIGHT[t.id as NmMistakeId] ?? 1) * natural(main, t.text) })),
  )
  return { trap: trap.id, trapStage: main.id, trapAnswer: trap.text }
}

function promptText(parts: readonly NmPromptPart[]): string {
  return parts.map((p) => ('text' in p ? p.text : formulaDisplay(p.formula))).join('')
}

/** The finished answer of a drawn problem: the engine fills each part; `rng` picks the promised trap. */
export function nmAnswer(question: NomenclatureQuestion, drawn: NmDrawn, rng: Rng): NomenclatureAnswer {
  const stages = drawn.drafts.map((draft, i) => stageOf(STAGE_IDS[i]!, draft))
  const ruleCards = [...new Set([...stages.map((s) => s.ruleCard), ...drawn.cards])]
  return {
    type: 'nomenclature',
    question,
    given: drawn.given,
    problem: drawn.problem,
    ...(drawn.ions ? { ions: drawn.ions } : {}),
    prompt: promptText(drawn.parts),
    promptParts: drawn.parts,
    stages,
    expectedDisplay: stages.map((s) => `${s.label}: ${s.answerDisplay}`).join('; '),
    reveal: [...new Set(stages.flatMap((s) => s.reveal))],
    ruleCards,
    ...promise(stages, rng),
  }
}

/**
 * `salt`: nm.ionicName and nm.ionicFromName draw from the same pool the same way, so the second mixes its seed
 * (otherwise seed n would ask the same compound in both).
 */
function makeTemplate(moduleId: ModuleId, id: string, question: NomenclatureQuestion, title: string, description: string, instructions: string, salt = 0): TemplateDef {
  const version = 1
  return {
    id,
    title,
    description,
    version,
    knobs: [],
    generate: (seed: number, knobs: DifficultyKnobs): ProblemInstance => {
      const rng = makeRng(salt ? mixSeed(seed, salt) : seed)
      const drawn = DRAW[question](rng)
      const answer = nmAnswer(question, drawn, rng)
      assertNomenclature(`${id}@${seed}`, answer)
      return {
        id: problemId(moduleId, id, version, seed),
        moduleId,
        templateId: id,
        skill: id,
        genVersion: version,
        seed,
        knobs,
        kind: 'nomenclature',
        title,
        instructions,
        statementText: answer.prompt,
        vars: [],
        start: null,
        canonical: [],
        answer,
        graph: { kind: 'none' },
        calc: NO_CALC,
        params: { ...drawn.params, trap: answer.trap ?? '' },
      }
    },
  }
}

export const ionTemplate = makeTemplate(
  'ionicNames',
  'nm.ion',
  'ion',
  'Name or write an ion',
  'Name a single ion from its formula, or write its formula, with its charge, from its name.',
  'Answer in words for a name. For a formula, type its charge after it: ^2- or a space and 2-.',
)

export const ionicFormulaTemplate = makeTemplate(
  'ionicNames',
  'nm.ionicFormula',
  'ionicFormula',
  'Formula from two ions',
  'Two ions, given by formula or by name: write the formula of the compound they form.',
  'Type subscripts as plain digits. When the ions are given by name, write each one with its charge first.',
)

export const ionicNameTemplate = makeTemplate(
  'ionicNames',
  'nm.ionicName',
  'ionicName',
  'Name an ionic compound',
  'Fixed-charge metals, Roman numerals for metals with more than one charge, polyatomic ions and ammonium compounds.',
  'Type the name in words.',
)

export const ionicFromNameTemplate = makeTemplate(
  'ionicNames',
  'nm.ionicFromName',
  'ionicFromName',
  'Formula of an ionic compound',
  'Write the formula of a named ionic compound: ion charges, criss-cross, lowest ratio, parentheses.',
  'Type subscripts as plain digits. Capital letters matter: each symbol starts with a capital, and a second letter is lowercase.',
  7,
)

export const molecularTemplate = makeTemplate(
  'molecularAcids',
  'nm.molecular',
  'molecular',
  'Molecular compounds',
  'Name a binary molecular compound from its formula, or write the formula from its name, with Greek prefixes.',
  'Names in words; formulas with plain digits for subscripts.',
)

export const acidTemplate = makeTemplate(
  'molecularAcids',
  'nm.acid',
  'acid',
  'Acids',
  'Name an acid from its formula or from its anion, or write its formula: hydro-…-ic, -ate to -ic, -ite to -ous.',
  'Names in words, ending with acid; formulas with plain digits for subscripts.',
)

export const hydrateTemplate = makeTemplate(
  'molecularAcids',
  'nm.hydrate',
  'hydrate',
  'Hydrates',
  'Name a hydrate from its formula, or write its formula from its name.',
  'For a formula, type the dot as * or a period: both work.',
)

export const classifyTemplate = makeTemplate(
  'molecularAcids',
  'nm.classify',
  'classify',
  'Which kind of compound?',
  'Ionic, molecular, acid or hydrate: decide which naming rules a formula follows.',
  'Choose one of the four kinds.',
)

/** The templates in module order, with the question each asks. */
export const NM_TEMPLATES: readonly { moduleId: ModuleId; templateId: string; question: NomenclatureQuestion }[] = [
  { moduleId: 'ionicNames', templateId: 'nm.ion', question: 'ion' },
  { moduleId: 'ionicNames', templateId: 'nm.ionicFormula', question: 'ionicFormula' },
  { moduleId: 'ionicNames', templateId: 'nm.ionicName', question: 'ionicName' },
  { moduleId: 'ionicNames', templateId: 'nm.ionicFromName', question: 'ionicFromName' },
  { moduleId: 'molecularAcids', templateId: 'nm.molecular', question: 'molecular' },
  { moduleId: 'molecularAcids', templateId: 'nm.acid', question: 'acid' },
  { moduleId: 'molecularAcids', templateId: 'nm.hydrate', question: 'hydrate' },
  { moduleId: 'molecularAcids', templateId: 'nm.classify', question: 'classify' },
]
