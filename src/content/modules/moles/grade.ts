/**
 * Grades one part of a chapter 10 problem (both modules). Each part's check becomes a model
 * (numeric.ts); a named mistake is what that slip produces for THIS problem's substance and
 * numbers, compared exactly at her own figures. Every value re-derives from the substance table
 * (facts.ts) and the given text, so no answer is typed twice. `assertMoleAnswer` runs on every
 * generated seed: a bad problem throws instead of shipping.
 */
import type { MoCheck, MoleAnswer, MoStage, MoStageId } from '@/content/types'
import type { ErrorPatternId, SigFigTask, SigFigTerm } from '@/shared/types'
import { analyseSigFigTask } from '@/engine/sigfigs/evaluate'
import { ratEq, type Rat } from '@/engine/sigfigs/decimal'
import { ERROR_PATTERNS } from '@/engine'
import { cfModel, isCfCheck } from '../chemFormulas/grade'
import {
  answerLeaks,
  atomicMassText,
  AVOGADRO_TEXT,
  countOf,
  countsDisplay,
  countsFormula,
  countsOf,
  diatomicSingleHundredths,
  fullMolarMass,
  hundredthsText,
  MO_RESERVED_WORDS,
  molarMassHundredths,
  molarMassText,
  MOLAR_VOLUME_TEXT,
  numberLeaks,
  numbersIn,
  parenFirstOnlyHundredths,
  parseCounts,
  particleKindOf,
  show,
  subscriptsIgnoredHundredths,
  substanceOf,
  waterLeftOutHundredths,
  waterOnceHundredths,
  anhydrousCounts,
  type MoSubstance,
} from './facts'
import { alternatesOfModel, canonicalOfModel, gradeModel, ratOfText, separateTolerance, trapsOfModel, type MoGrade, type MoTrap, type NumericTrap, type PartModel } from './numeric'
import { MO_RULES, PARTICLE_TEXT, STP_TEXT } from './rules'
import { CF_RULES } from '../chemFormulas/rules'

export type { MoGrade, MoTrap } from './numeric'

export const MO_KEYS: Record<MoStageId, string> = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' }

/** The chapter 10 ids minted for both modules, in catalog order. */
export const MO_MISTAKE_IDS = [
  'mo_particle_kind',
  'mo_avogadro_inverted',
  'mo_molecules_for_atoms',
  'mo_stopped_at_moles',
  'mo_molar_mass_inverted',
  'mo_atomic_mass_for_molar',
  'mo_subscripts_ignored',
  'mo_paren_first_only',
  'mo_diatomic_single',
  'mo_hydrate_water_left_out',
  'mo_hydrate_water_once',
  'mo_molar_volume_inverted',
  'mo_stp_misapplied',
  'mo_percent_by_count',
  'mo_percent_one_atom',
  'mo_percent_part_over_part',
  'mo_mass_ratio_as_mole_ratio',
  'mo_ratio_rounded',
  'mo_empirical_as_molecular',
] as const satisfies readonly ErrorPatternId[]

export type MoMistakeId = (typeof MO_MISTAKE_IDS)[number]

// ---------------------------------------------------------------------------
// Terms of the road-map calculations
// ---------------------------------------------------------------------------

const NA: SigFigTerm = { text: AVOGADRO_TEXT }
const VM: SigFigTerm = { text: MOLAR_VOLUME_TEXT }

function t(text: string): SigFigTerm {
  return { text }
}

function counted(n: number): SigFigTerm {
  return { text: String(n), exact: true, note: 'counted' }
}

function chain(terms: SigFigTerm[], ops: ('*' | '/')[]): SigFigTask {
  return { kind: 'muldiv', terms, ops }
}

export function exactOf(task: SigFigTask): Rat {
  return analyseSigFigTask(task).exactValue
}

function spec(id: ErrorPatternId, task: SigFigTask, witness: string): NumericTrap {
  return { id, exact: exactOf(task), witness }
}

// ---------------------------------------------------------------------------
// Witnesses: one sentence about her answer. No numbers, never the right answer.
// ---------------------------------------------------------------------------

const W = {
  avogadroDivided:
    'You divided by Avogadro’s number. Going from moles to a count of particles makes the number enormous, so that factor multiplies.',
  avogadroMultiplied:
    'You multiplied by Avogadro’s number. A huge count of particles shrinks to a handful of moles, so that factor divides.',
  molecules: (symbol: string) =>
    `That counts whole units of the compound. Each unit carries more than one ${symbol} atom, so the count of ${symbol} atoms is larger by that subscript.`,
  moleculesBack: (symbol: string) =>
    `You treated every ${symbol} atom as a whole unit of the compound. Each unit holds more than one ${symbol} atom, so divide by that subscript too.`,
  stopped: (what: string) => `That is the number of moles — the halfway stop. The question wants ${what}, so one more factor still has to go on.`,
  molarMultiplied: 'You multiplied by the molar mass. Grams turn into moles by dividing: the molar mass is how many grams make one mole.',
  molarDivided: 'You divided by the molar mass. Moles turn into grams by multiplying: every mole weighs the molar mass in grams.',
  atomic: (symbol: string) => `You used the atomic mass of ${symbol} alone. A mole of the compound weighs every atom in its formula added together.`,
  diatomic: (symbol: string) =>
    `You weighed one ${symbol} atom. Elemental ${symbol} comes as two-atom molecules, ${show(`${symbol}2`)}, so a mole of it weighs twice the atomic mass.`,
  waterOut: 'You left out the water. The waters after the dot are part of every formula unit of the hydrate, and part of its mass.',
  waterOnce: 'You counted one water. The number in front of H₂O says how many waters ride along with each formula unit.',
  subscripts: 'You added one of each atom. Every subscript multiplies its atom’s mass — the formula counts how many of each there are.',
  parenFirst: 'Only the first atom inside the parentheses got the outside subscript. That subscript multiplies everything inside the group.',
  volumeMultiplied: 'You multiplied by the molar volume. Liters of gas become moles by dividing: each mole at STP fills that many liters.',
  volumeDivided: 'You divided by the molar volume. Moles of gas become liters by multiplying: each mole at STP fills that many liters.',
} as const

const STOPPED_WHAT: Record<string, string> = {
  g: 'the mass',
  particles: 'a count of particles',
  L: 'the volume',
}

// ---------------------------------------------------------------------------
// Models of the moles checks
// ---------------------------------------------------------------------------

/** The slips that put the wrong mass per mole into a mass calculation (atomic, diatomic, hydrate). */
function massSlips(s: MoSubstance): { id: ErrorPatternId; massText: string; witness: string }[] {
  const out: { id: ErrorPatternId; massText: string; witness: string }[] = []
  const diatomic = diatomicSingleHundredths(s)
  if (diatomic != null) out.push({ id: 'mo_diatomic_single', massText: hundredthsText(diatomic), witness: W.diatomic(countsOf(s)[0]!.symbol) })
  if (s.kind === 'molecular' || s.kind === 'ionic' || s.kind === 'hydrate') {
    const counts = s.kind === 'hydrate' ? anhydrousCounts(s) : countsOf(s)
    for (const c of counts) out.push({ id: 'mo_atomic_mass_for_molar', massText: atomicMassText(c.symbol), witness: W.atomic(c.symbol) })
  }
  const out2 = waterLeftOutHundredths(s)
  if (out2 != null) out.push({ id: 'mo_hydrate_water_left_out', massText: hundredthsText(out2), witness: W.waterOut })
  const once = waterOnceHundredths(s)
  if (once != null) out.push({ id: 'mo_hydrate_water_once', massText: hundredthsText(once), witness: W.waterOnce })
  return out
}

function convertModel(check: Extract<MoCheck, { kind: 'convert' }>): PartModel {
  const s = substanceOf(check.formula)
  const G = t(check.given)
  const M = t(molarMassText(s))
  const route = `${check.from}>${check.to}`
  const numeric = (task: SigFigTask, traps: NumericTrap[]): PartModel => ({ mode: 'numeric', task, exact: exactOf(task), traps })
  switch (route) {
    case 'mol>particles':
      return numeric(chain([G, NA], ['*']), [spec('mo_avogadro_inverted', chain([G, NA], ['/']), W.avogadroDivided)])
    case 'particles>mol':
      return numeric(chain([G, NA], ['/']), [spec('mo_avogadro_inverted', chain([G, NA], ['*']), W.avogadroMultiplied)])
    case 'mol>atoms': {
      const symbol = check.atom ?? ''
      const k = counted(countOf(countsOf(s), symbol))
      return numeric(chain([G, NA, k], ['*', '*']), [
        spec('mo_molecules_for_atoms', chain([G, NA], ['*']), W.molecules(symbol)),
        spec('mo_avogadro_inverted', chain([G, NA, k], ['/', '*']), W.avogadroDivided),
      ])
    }
    case 'atoms>mol': {
      const symbol = check.atom ?? ''
      const k = counted(countOf(countsOf(s), symbol))
      return numeric(chain([G, k, NA], ['/', '/']), [
        spec('mo_molecules_for_atoms', chain([G, NA], ['/']), W.moleculesBack(symbol)),
        spec('mo_avogadro_inverted', chain([G, k, NA], ['/', '*']), W.avogadroMultiplied),
      ])
    }
    case 'g>mol':
      return numeric(chain([G, M], ['/']), [
        spec('mo_molar_mass_inverted', chain([G, M], ['*']), W.molarMultiplied),
        ...massSlips(s).map((slip) => spec(slip.id, chain([G, t(slip.massText)], ['/']), slip.witness)),
      ])
    case 'mol>g':
      return numeric(chain([G, M], ['*']), [
        spec('mo_molar_mass_inverted', chain([G, M], ['/']), W.molarDivided),
        ...massSlips(s).map((slip) => spec(slip.id, chain([G, t(slip.massText)], ['*']), slip.witness)),
      ])
    case 'g>particles':
      return numeric(chain([G, M, NA], ['/', '*']), [
        spec('mo_stopped_at_moles', chain([G, M], ['/']), W.stopped(STOPPED_WHAT.particles!)),
        spec('mo_molar_mass_inverted', chain([G, M, NA], ['*', '*']), W.molarMultiplied),
        spec('mo_avogadro_inverted', chain([G, M, NA], ['/', '/']), W.avogadroDivided),
        ...massSlips(s).map((slip) => spec(slip.id, chain([G, t(slip.massText), NA], ['/', '*']), slip.witness)),
      ])
    case 'particles>g':
      return numeric(chain([G, NA, M], ['/', '*']), [
        spec('mo_stopped_at_moles', chain([G, NA], ['/']), W.stopped(STOPPED_WHAT.g!)),
        spec('mo_molar_mass_inverted', chain([G, NA, M], ['/', '/']), W.molarDivided),
        spec('mo_avogadro_inverted', chain([G, NA, M], ['*', '*']), W.avogadroMultiplied),
        ...massSlips(s).map((slip) => spec(slip.id, chain([G, NA, t(slip.massText)], ['/', '*']), slip.witness)),
      ])
    case 'L>mol':
      return numeric(chain([G, VM], ['/']), [spec('mo_molar_volume_inverted', chain([G, VM], ['*']), W.volumeMultiplied)])
    case 'mol>L':
      return numeric(chain([G, VM], ['*']), [spec('mo_molar_volume_inverted', chain([G, VM], ['/']), W.volumeDivided)])
    case 'L>g':
      return numeric(chain([G, VM, M], ['/', '*']), [
        spec('mo_stopped_at_moles', chain([G, VM], ['/']), W.stopped(STOPPED_WHAT.g!)),
        spec('mo_molar_volume_inverted', chain([G, VM, M], ['*', '*']), W.volumeMultiplied),
        spec('mo_molar_mass_inverted', chain([G, VM, M], ['/', '/']), W.molarDivided),
        ...massSlips(s).map((slip) => spec(slip.id, chain([G, VM, t(slip.massText)], ['/', '*']), slip.witness)),
      ])
    case 'g>L':
      return numeric(chain([G, M, VM], ['/', '*']), [
        spec('mo_stopped_at_moles', chain([G, M], ['/']), W.stopped(STOPPED_WHAT.L!)),
        spec('mo_molar_volume_inverted', chain([G, M, VM], ['/', '/']), W.volumeDivided),
        spec('mo_molar_mass_inverted', chain([G, M, VM], ['*', '*']), W.molarMultiplied),
        ...massSlips(s).map((slip) => spec(slip.id, chain([G, t(slip.massText), VM], ['/', '*']), slip.witness)),
      ])
    default:
      throw new Error(`moles: no conversion ${route}`)
  }
}

/** The calculation a conversion part asks for (the sig-fig task the engine grades). */
export function convertTask(check: Extract<MoCheck, { kind: 'convert' }>): SigFigTask {
  const model = convertModel(check)
  if (model.mode !== 'numeric') throw new Error('moles: conversion is numeric')
  return model.task
}

/** Molar mass part: the right sum and what each slip sums to. */
export function molarMassModel(s: MoSubstance): PartModel {
  const hundredths = molarMassHundredths(s)
  const tol = (id: ErrorPatternId, h: bigint | null, witness: string) => (h == null ? null : { id, hundredths: h, witness })
  const symbol = countsOf(s)[0]!.symbol
  return {
    mode: 'tolerance',
    hundredths,
    full: fullMolarMass(countsOf(s)),
    traps: separateTolerance(hundredths, [
      tol('mo_diatomic_single', diatomicSingleHundredths(s), W.diatomic(symbol)),
      tol('mo_paren_first_only', parenFirstOnlyHundredths(s), W.parenFirst),
      tol('mo_hydrate_water_left_out', waterLeftOutHundredths(s), W.waterOut),
      tol('mo_hydrate_water_once', waterOnceHundredths(s), W.waterOnce),
      tol('mo_subscripts_ignored', subscriptsIgnoredHundredths(s), W.subscripts),
    ]),
  }
}

const PARTICLE_WITNESS = {
  element: {
    molecules: (n: string) => `${n} is a single element whose particles stand alone; they do not bond into little clusters, so there is no cluster to count.`,
    'formula units': (n: string) => `There are no ions in ${n}: it is one element by itself, so there is no repeating ion ratio to count.`,
  },
  cluster: {
    atoms: (n: string) => `The atoms of ${n} travel bonded together in small separate clusters, and that whole cluster is what a mole of it counts.`,
    'formula units': (n: string) => `That counting unit belongs to ionic crystals. ${n} is held together by shared pairs in separate clusters, so it does not apply.`,
  },
  ionic: {
    atoms: (n: string) => `${n} is a compound of ions, not loose atoms. A mole of it counts its smallest repeating ratio of ions.`,
    molecules: (n: string) => `${n} is ionic: its ions sit in one endless lattice, with no separate little cluster to count. The count goes by its smallest repeating ion ratio.`,
  },
} as const

function particleModel(s: MoSubstance): PartModel {
  const kind = particleKindOf(s)
  const shown = show(s.key)
  const traps: MoTrap[] = []
  const add = (pick: keyof typeof PARTICLE_TEXT, witness: string) => traps.push({ id: 'mo_particle_kind', text: PARTICLE_TEXT[pick], witness })
  if (kind === 'atoms') {
    add('molecules', PARTICLE_WITNESS.element.molecules(shown))
    add('formula units', PARTICLE_WITNESS.element['formula units'](shown))
  } else if (kind === 'molecules') {
    add('atoms', PARTICLE_WITNESS.cluster.atoms(shown))
    add('formula units', PARTICLE_WITNESS.cluster['formula units'](shown))
  } else {
    add('atoms', PARTICLE_WITNESS.ionic.atoms(shown))
    add('molecules', PARTICLE_WITNESS.ionic.molecules(shown))
  }
  return { mode: 'choice', answer: PARTICLE_TEXT[kind], traps }
}

function stpModel(check: Extract<MoCheck, { kind: 'stp-ok' }>): PartModel {
  if (check.state !== 'gas' && !check.atStp) throw new Error('moles: a non-gas away from STP has two reasons')
  const answer = check.state !== 'gas' ? STP_TEXT.notGas : check.atStp ? STP_TEXT.yes : STP_TEXT.notStp
  const traps: MoTrap[] = []
  if (answer === STP_TEXT.notGas) {
    traps.push({
      id: 'mo_stp_misapplied',
      text: STP_TEXT.yes,
      witness: 'That shortcut is only for gases. A liquid or a solid packs its particles close together, so a mole of it fills nothing like that volume.',
    })
  }
  if (answer === STP_TEXT.notStp) {
    traps.push({
      id: 'mo_stp_misapplied',
      text: STP_TEXT.yes,
      witness: 'That volume per mole holds only at standard temperature and pressure. A gas anywhere else spreads into a different volume.',
    })
  }
  return { mode: 'choice', answer, traps }
}

const MODELS = new Map<string, PartModel>()

/**
 * The model of any chapter 10 check (chemFormulas checks come from chemFormulas/grade.ts). A check
 * is plain data, so its model is cached by its JSON (models are never mutated).
 */
export function modelFor(check: MoCheck): PartModel {
  const key = JSON.stringify(check)
  const cached = MODELS.get(key)
  if (cached) return cached
  const model = buildModel(check)
  if (MODELS.size > 50_000) MODELS.clear()
  MODELS.set(key, model)
  return model
}

function buildModel(check: MoCheck): PartModel {
  if (isCfCheck(check)) return cfModel(check)
  switch (check.kind) {
    case 'particle-kind':
      return particleModel(substanceOf(check.formula))
    case 'convert':
      return convertModel(check)
    case 'molar-mass':
      return molarMassModel(substanceOf(check.formula))
    case 'stp-ok':
      return stpModel(check)
    default:
      throw new Error(`moles: unhandled check ${(check as MoCheck).kind}`)
  }
}

export function canonicalMoAnswer(check: MoCheck): string {
  return canonicalOfModel(modelFor(check))
}

export function alternatesFor(check: MoCheck): string[] {
  return alternatesOfModel(modelFor(check))
}

export function trapsForMo(check: MoCheck): MoTrap[] {
  return trapsOfModel(modelFor(check))
}

export function gradeMoStage(answer: MoleAnswer, stageId: MoStageId, text: string): MoGrade {
  const stage = answer.stages.find((item) => item.id === stageId)
  if (!stage) return { verdict: 'invalid', message: "That doesn't match this problem." }
  return gradeModel(modelFor(stage.check), stage, text)
}

/** Her entries, part by part, for the tutor ('Moles in sample 1: 2.50 mol'). */
export function moWork(answer: MoleAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const text = enteredText(stage, entries)
    if (!text) continue
    if (stage.kind === 'counts') {
      const counts = parseCounts(text)
      lines.push(`${stage.label}: ${counts ? countsFormula(counts) : text}`)
    } else if (stage.kind === 'choice') {
      lines.push(`${stage.label}: ${stage.choices?.find((c) => c.id === text)?.text ?? text}`)
    } else {
      lines.push(`${stage.label}: ${text}${stage.unit ? ` ${stage.unit}` : ''}`)
    }
  }
  return lines
}

/** Entry keys: a choice or whole box is the part letter; a number is 'b' + 'b^' (power); counts are 'b.C', 'b.H'. */
export function enteredText(stage: MoStage, entries: Record<string, string>): string {
  const key = MO_KEYS[stage.id]
  if (stage.kind === 'number') {
    const coefficient = (entries[key] ?? '').trim()
    const power = (entries[`${key}^`] ?? '').trim()
    if (!coefficient && !power) return ''
    return power ? `${coefficient} x 10^${power}` : coefficient
  }
  if (stage.kind === 'counts') {
    const symbols = stage.symbols ?? []
    const values = symbols.map((symbol) => (entries[`${key}.${symbol}`] ?? '').trim())
    if (values.every((v) => !v)) return ''
    return symbols.map((symbol, i) => `${symbol}=${values[i]}`).join(';')
  }
  return (entries[key] ?? '').trim()
}

// ---------------------------------------------------------------------------
// Leaks
// ---------------------------------------------------------------------------

/** Every rule card of both modules, by id. */
export const ALL_RULES = [...MO_RULES, ...CF_RULES]

export function cardBlob(id: string): string {
  const card = ALL_RULES.find((item) => item.id === id)
  return `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`
}

/**
 * Does the surface single out this part's answer? Numbers compare by VALUE ('1.51 × 10²⁴' is
 * 1.51 x 10^24); a formula by its display or ASCII text; a choice by its words, unless the surface
 * shows EVERY option (a complete listing singles out none); a whole number by its own token.
 */
export function stageLeaks(stage: MoStage, surface: string): boolean {
  switch (stage.kind) {
    case 'number': {
      const values = [stage.answerText, ...(stage.accept ?? [])].map(ratOfText)
      return values.some((v) => numberLeaks(surface, v))
    }
    case 'counts': {
      const counts = parseCounts(stage.answerText)
      if (!counts) return false
      return surface.includes(countsDisplay(counts)) || answerLeaks(surface, countsFormula(counts))
    }
    case 'whole':
      return answerLeaks(surface, stage.answerText)
    case 'choice': {
      const choice = stage.choices?.find((c) => c.id === stage.answerText)
      const text = choice?.text ?? stage.answerText
      if (!answerLeaks(surface, text)) return false
      const all = (stage.choices ?? []).map((c) => c.text)
      return !(all.length >= 2 && all.every((option) => answerLeaks(surface, option)))
    }
    default: {
      const never: never = stage.kind
      return never
    }
  }
}

/** Every rule card and every mo_ catalog entry (title, lesson, example): no generated answer may equal a number in one. */
export function exampleSurfaces(): string[] {
  return [...ALL_RULES.map((card) => cardBlob(card.id)), ...MO_MISTAKE_IDS.map((id) => `${ERROR_PATTERNS[id].title} ${ERROR_PATTERNS[id].lesson} ${ERROR_PATTERNS[id].example}`)]
}

let exampleValues: Rat[] | null = null

/** True when a number part's answer equals a number written on any card or mo_ catalog entry. */
export function equalsExampleNumber(stage: MoStage): boolean {
  if (stage.kind !== 'number') return false
  exampleValues ??= exampleSurfaces().flatMap(numbersIn)
  const values = [stage.answerText, ...(stage.accept ?? [])].map(ratOfText)
  return values.some((v) => exampleValues!.some((e) => ratEq(e, v)))
}

/** The reasons a stage would leak, '' when clean. Used by the generators to redraw. */
export function leakReport(answer: MoleAnswer, stage: MoStage, extra: readonly string[] = []): string {
  const surfaces: [string, string][] = [
    ['hint', stage.hint],
    ['nudge', stage.nudge],
    ['label', stage.label],
    ['prompt', answer.prompt],
    ...stage.traps.map((trap): [string, string] => [`${trap.id} witness`, trap.witness]),
    ...[...new Set([stage.ruleCard, ...answer.ruleCards])].map((id): [string, string] => [id, cardBlob(id)]),
    ...extra.map((text, i): [string, string] => [`example ${i}`, text]),
  ]
  for (const [name, text] of surfaces) if (stageLeaks(stage, text)) return name
  return ''
}

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertMoleAnswer(where: string, answer: MoleAnswer): void {
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  for (const word of MO_RESERVED_WORDS) {
    if (answer.prompt.includes(word)) throw new Error(`${where}: prompt draws the reserved substance ${word}`)
  }
  const ids = new Set<string>()
  for (const stage of answer.stages) {
    if (ids.has(stage.id)) throw new Error(`${where}: repeated part ${stage.id}`)
    ids.add(stage.id)
    const model = modelFor(stage.check)
    const expected = canonicalOfModel(model)
    if (stage.answerText !== expected) throw new Error(`${where}: ${stage.id} stored ${stage.answerText} but the table says ${expected}`)
    const right = gradeModel(model, stage, stage.answerText)
    if (right.verdict !== 'correct') throw new Error(`${where}: ${stage.id} answer graded ${right.verdict} (${right.message})`)
    for (const alt of stage.accept ?? []) {
      const graded = gradeModel(model, stage, alt)
      if (graded.verdict !== 'correct') throw new Error(`${where}: ${stage.id} accept ${alt} graded ${graded.verdict}`)
    }
    if (model.mode === 'numeric') {
      const a = analyseSigFigTask(model.task)
      if (model.task.kind !== 'round' && !ratEq(a.exactValue, model.exact)) throw new Error(`${where}: ${stage.id} exact value disagrees with the engine`)
      if (a.rounded.firstDropped === 5) throw new Error(`${where}: ${stage.id} answer sits on a rounding boundary`)
    }
    const texts = new Set<string>()
    for (const trap of stage.traps) {
      if (trap.text === stage.answerText) throw new Error(`${where}: trap ${trap.id} equals the answer`)
      if (texts.has(trap.text)) throw new Error(`${where}: two traps share ${trap.text}`)
      texts.add(trap.text)
      const graded = gradeModel(model, stage, trap.text)
      if (graded.verdict !== 'mistake' || graded.mistake !== trap.id) {
        throw new Error(`${where}: trap ${trap.id} (${trap.text}) graded ${graded.verdict}${graded.verdict === 'mistake' ? ` ${graded.mistake}` : ''}`)
      }
    }
    const leak = leakReport(answer, stage)
    if (leak) throw new Error(`${where}: ${stage.id} ${leak} shows the answer ${stage.answerText}`)
    if (equalsExampleNumber(stage)) throw new Error(`${where}: ${stage.id} answer ${stage.answerText} equals an example number`)
  }
  if (answer.trap) {
    const stage = answer.stages.find((item) => item.id === answer.trapStage)
    if (!stage || answer.trapAnswer == null) throw new Error(`${where}: promised trap has no part`)
    const graded = gradeModel(modelFor(stage.check), stage, answer.trapAnswer)
    if (graded.verdict !== 'mistake' || graded.mistake !== answer.trap) throw new Error(`${where}: promised ${answer.trap} graded ${graded.verdict}`)
  } else if (answer.stages.some((stage) => stage.traps.length > 0)) {
    throw new Error(`${where}: a trap was possible but none was promised`)
  }
}

