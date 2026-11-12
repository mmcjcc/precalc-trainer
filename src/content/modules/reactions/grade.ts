/**
 * Grades one part of a chemical-reactions problem. A named mistake is what that slip gives for THIS
 * term, equation or pairing, compared exactly (the two balance ids are exact properties of her
 * coefficients: every element balances but the numbers share a factor; exactly one element is off).
 * Formulas are read and graded by the nomenclature engine; nothing here parses a formula.
 */
import type { ReactionsAnswer, RxCheck, RxStageId } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import {
  acceptedFormulas,
  compoundOfName,
  ERROR_PATTERNS,
  formulaDisplay,
  formulaFromNameMistakes,
  formulaOfName,
  gradeFormulaFromName,
  gradeIonicFormula,
  ionicFormula,
  ionicFormulaMistakes,
  readChemicalFormula,
  type FormulaPart,
  type NmGrade,
  type NmMistakeCandidate,
} from '@/engine'
import { balances, coefficientsOf, commonFactor } from './balance'
import {
  atomCounts,
  capName,
  elementalFormula,
  elementName,
  formulaParts,
  isDiatomic,
  offElements,
  reactionOf,
  reactsWith,
  RX_RESERVED_FORMULAS,
  rxLeaks,
  sideCounts,
} from './facts'
import { BALANCED_TEXT, NONE_OFF, REACTS_TEXT, RX_RULES, TYPE_TEXT } from './rules'

export const RX_KEYS: Record<RxStageId, string> = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' }

/** The chapter 11 ids minted for this module, in detection order. */
export const RX_MISTAKE_IDS = [
  'rx_coef_first_only',
  'rx_paren_first_only',
  'rx_add_not_multiply',
  'rx_not_lowest',
  'rx_element_unbalanced',
  'rx_combo_decomp_swapped',
  'rx_single_double_swapped',
  'rx_activity_backwards',
  'rx_diatomic_single',
  'rx_not_swapped',
  'rx_combustion_products',
] as const satisfies readonly ErrorPatternId[]

export type RxMistakeId = (typeof RX_MISTAKE_IDS)[number]

/** The chapter 7 id the brief asks to reuse (a product whose charges do not balance); the engine names it. */
export const RX_REUSED_MISTAKE_IDS = ['nm_charges_unbalanced'] as const satisfies readonly ErrorPatternId[]

export type RxGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string; message: string }

export interface RxTrap {
  id: ErrorPatternId
  text: string
  witness: string
}

type RxStage = ReactionsAnswer['stages'][number]

const CORRECT = "That's right."
const WRONG = "That doesn't match this problem."
const WHOLE = 'Type a whole number.'
const CHOOSE = 'Choose one.'

export function exampleShowsAnswer(example: string, answerText: string): boolean {
  return rxLeaks(example, answerText)
}

/** Her parts as lines for the tutor: 'Formula for zinc: Zn'. Coefficients read back in slot order. */
export function rxWork(answer: ReactionsAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    if (stage.kind === 'coefficients') {
      const boxes = (stage.slots ?? []).map((_, i) => entries[slotKey(stage.id, i)]?.trim() ?? '')
      if (boxes.some(Boolean)) lines.push(`${stage.label}: ${boxes.map((b, i) => `${b || '_'} ${stage.slots![i]}`).join(', ')}`)
      continue
    }
    const value = entries[RX_KEYS[stage.id]]?.trim()
    if (!value) continue
    const shown = stage.kind === 'choice' ? (stage.choices?.find((c) => c.id === value)?.text ?? value) : value
    lines.push(`${stage.label}: ${shown}`)
  }
  return lines
}

/** The entry key of one coefficient box. */
export function slotKey(stageId: RxStageId, index: number): string {
  return `${stageId}${index}`
}

/** Her coefficient boxes joined for the grader ('2|1|2'). */
export function coefficientText(stage: RxStage, entries: Record<string, string>): string {
  return (stage.slots ?? []).map((_, i) => (entries[slotKey(stage.id, i)] ?? '').trim()).join('|')
}

function correct(message = CORRECT): RxGrade {
  return { verdict: 'correct', message }
}

function wrong(message = WRONG): RxGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): RxGrade {
  return { verdict: 'invalid', message }
}

function mistakeOf(id: ErrorPatternId, witness: string): RxGrade {
  return { verdict: 'mistake', mistake: id, witness, message: witness }
}

/** The engine writes "a 1− charge"; she reads "a charge of 1−" (no article right before a number). */
function readable(text: string): string {
  return text.replace(/\b([Aa])n? (\d+[−+]) charge\b/g, (_m, a: string, n: string) => `${a} charge of ${n}`)
}

function fromEngine(g: NmGrade): RxGrade {
  switch (g.verdict) {
    case 'correct':
      return correct(readable(g.message))
    case 'wrong':
      return wrong(readable(g.message))
    case 'invalid':
    case 'unsupported':
      return invalid(readable(g.message))
    case 'mistake':
      return mistakeOf(g.mistake, readable(g.witness))
  }
}

function parseWhole(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\.$/, '').replace(/\s*(atoms?)$/, '')
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

// ---------------------------------------------------------------------------
// Counting atoms in a term
// ---------------------------------------------------------------------------

interface Occurrence {
  /** The atom's own subscript. */
  own: number
  /** Each enclosing group, outermost first: its subscript, and whether this atom is the group's first atom. */
  groups: { count: number; first: boolean }[]
}

function occurrences(parts: readonly FormulaPart[], element: string, groups: Occurrence['groups'] = []): Occurrence[] {
  const out: Occurrence[] = []
  parts.forEach((part, i) => {
    // Inside the innermost group, only its first part keeps the "first atom" mark.
    const here = groups.map((g, depth) => (depth === groups.length - 1 ? { count: g.count, first: g.first && i === 0 } : g))
    if (part.type === 'element') {
      if (part.symbol === element) out.push({ own: part.count, groups: here })
    } else {
      out.push(...occurrences(part.parts, element, [...here, { count: part.count, first: true }]))
    }
  })
  return out
}

/** The right count: coefficient × every number stacked on each atom. */
function rightCount(check: Extract<RxCheck, { kind: 'atom-count' }>): number {
  return check.coefficient * (atomCounts(check.formula).get(check.element) ?? 0)
}

/** The coefficient reaching only the first element of the formula. */
function coefFirstOnly(check: Extract<RxCheck, { kind: 'atom-count' }>): number | null {
  const parts = formulaParts(check.formula)
  const first = parts[0]
  if (!first || first.type !== 'element' || first.symbol === check.element) return null
  return atomCounts(check.formula).get(check.element) ?? 0
}

/** A group's subscript reaching only the first atom inside it. */
function parenFirstOnly(check: Extract<RxCheck, { kind: 'atom-count' }>): number | null {
  const occ = occurrences(formulaParts(check.formula), check.element)
  if (!occ.some((o) => o.groups.some((g) => g.count > 1))) return null
  let total = 0
  for (const o of occ) total += o.groups.reduce((n, g) => (g.first ? n * g.count : n), o.own)
  return check.coefficient * total
}

/** Every number stacked on an atom added instead of multiplied (the written numbers only). */
function addedCount(check: Extract<RxCheck, { kind: 'atom-count' }>): number {
  const occ = occurrences(formulaParts(check.formula), check.element)
  let total = 0
  for (const o of occ) {
    const written = [check.coefficient, ...o.groups.map((g) => g.count), o.own].filter((m) => m > 1)
    total += written.length === 0 ? 1 : written.reduce((a, b) => a + b, 0)
  }
  return total
}

// ---------------------------------------------------------------------------
// Coefficients
// ---------------------------------------------------------------------------

/** Her boxes as numbers, or why they cannot be read. '|' separates boxes; spaces or commas work too. */
export function readCoefficients(text: string, count: number): { ok: true; values: number[] } | { ok: false; message: string } {
  const raw = text.includes('|') ? text.split('|') : text.trim().split(/[\s,]+/)
  const boxes = raw.map((b) => b.trim())
  if (boxes.length !== count || boxes.some((b) => b === '')) return { ok: false, message: 'Type a whole number in every box, the 1s included.' }
  if (boxes.some((b) => !/^\d+$/.test(b))) return { ok: false, message: 'Each box takes a whole number, like 2.' }
  const values = boxes.map(Number)
  if (values.some((v) => v === 0)) return { ok: false, message: 'Every substance in the equation takes part, so no coefficient is 0.' }
  if (values.some((v) => v > 99)) return { ok: false, message: 'Those numbers are far too large for this equation.' }
  return { ok: true, values }
}

/** The grade for a set of coefficients (also the witness of each balance trap). */
export function coefficientGrade(reactionId: string, values: readonly number[]): RxGrade {
  const r = reactionOf(reactionId)
  if (balances(r, values)) {
    const factor = commonFactor(values)
    if (factor === 1) return correct()
    return mistakeOf(
      'rx_not_lowest',
      `Every element balances with your numbers, but each of them divides by ${factor}. An equation keeps the smallest whole numbers that balance.`,
    )
  }
  const off = offElements(r, values)
  if (off.length === 1) {
    const el = off[0]!
    const { left, right } = sideCounts(r, values, el)
    return mistakeOf(
      'rx_element_unbalanced',
      `Your numbers leave ${elementName(el)} uneven: ${left} ${elementName(el)} atom${left === 1 ? '' : 's'} on the left, ${right} on the right. Every other element already matches.`,
    )
  }
  return wrong(`With your numbers, ${off.map(elementName).join(', ')} do not match on the two sides. Count each element left and right.`)
}

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

function readTidy(text: string): { ok: true; tidy: string; parts: FormulaPart[]; waters: number | null } | { ok: false; message: string } {
  const read = readChemicalFormula(text)
  if (!read.ok) return { ok: false, message: read.error.message }
  const state = read.value.state
  const tidy = state ? read.value.text.slice(0, -(state.length + 2)) : read.value.text
  return { ok: true, tidy, parts: read.value.parts, waters: read.value.waters }
}

function gradeElement(check: Extract<RxCheck, { kind: 'element' }>, text: string): RxGrade {
  const her = readTidy(text)
  if (!her.ok) return invalid(her.message)
  if (her.waters !== null) return wrong('That has water in it; this box is for one free element.')
  const counts = atomCounts(her.tidy)
  const name = elementName(check.symbol)
  if (counts.size !== 1) return wrong(`That is a compound. This box is for free ${name} on its own.`)
  const [symbol, n] = [...counts.entries()][0]!
  if (symbol !== check.symbol) return wrong(`That is ${elementName(symbol)}, not ${name}.`)
  if (her.tidy === canonicalRxAnswer(check) || (check.symbol === 'S' && her.tidy === 'S8')) return correct()
  if (isDiatomic(check.symbol) && n === 1) return mistakeOf('rx_diatomic_single', diatomicWitness(check.symbol))
  if (isDiatomic(check.symbol)) return wrong(`Free ${name} has a set number of atoms in each molecule, and that is not it.`)
  return wrong(`Free ${name} is written as its symbol alone, with no subscript.`)
}

function diatomicWitness(symbol: string): string {
  const name = elementName(symbol)
  return `A single ${symbol} atom is not how free ${name} exists. On its own, ${name} is one of the seven elements whose atoms pair up into two-atom molecules.`
}

const COMBUSTION_WITNESS = {
  CO: 'Carbon monoxide is what a flame makes when it runs short of oxygen. Complete combustion has oxygen to spare, so each carbon picks up more oxygen than that.',
  C: 'Soot is carbon that never burned. In complete combustion nothing is left over: every carbon atom leaves joined to oxygen.',
  H2: 'Hydrogen gas does not come out of a fire in air. With oxygen all around, every hydrogen atom of the fuel ends up bonded to oxygen.',
} as const

function gradeCombustion(check: Extract<RxCheck, { kind: 'combustion-product' }>, text: string): RxGrade {
  const her = readTidy(text)
  if (!her.ok) return invalid(her.message)
  if (her.tidy === canonicalRxAnswer(check)) return correct()
  if (check.carries === 'carbon') {
    if (her.tidy === 'CO') return mistakeOf('rx_combustion_products', COMBUSTION_WITNESS.CO)
    if (her.tidy === 'C') return mistakeOf('rx_combustion_products', COMBUSTION_WITNESS.C)
    if (!atomCounts(her.tidy).has('C')) return wrong('That product holds no carbon, and this box is for the one that carries the carbon away.')
  } else {
    if (her.tidy === 'H2') return mistakeOf('rx_combustion_products', COMBUSTION_WITNESS.H2)
    if (!atomCounts(her.tidy).has('H')) return wrong('That product holds no hydrogen, and this box is for the one that carries the hydrogen away.')
  }
  return wrong()
}

function notSwappedWitness(her: string): string {
  return `${formulaDisplay(her)} is one of the compounds you started with. A replacement makes new pairings, so no product is a reactant handed back unchanged.`
}

function gradeIonicProduct(check: Extract<RxCheck, { kind: 'ionic-product' }>, text: string): RxGrade {
  const g = gradeIonicFormula(check.cation, check.anion, text)
  if (g.verdict === 'correct' || g.verdict === 'invalid' || g.verdict === 'unsupported') return fromEngine(g)
  const her = readTidy(text)
  if (her.ok && check.reactants.includes(her.tidy)) return mistakeOf('rx_not_swapped', notSwappedWitness(her.tidy))
  return fromEngine(g)
}

function gradeNamed(check: Extract<RxCheck, { kind: 'named-formula' }>, text: string): RxGrade {
  return fromEngine(gradeFormulaFromName(check.name, text))
}

// ---------------------------------------------------------------------------
// Choices and numbers
// ---------------------------------------------------------------------------

function matchChoice(stage: RxStage, text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  const choices = stage.choices ?? []
  const exact = choices.find((choice) => choice.id === raw || choice.text === raw)
  if (exact) return exact.id
  const lower = raw.toLowerCase()
  return choices.find((choice) => choice.id.toLowerCase() === lower || choice.text.toLowerCase() === lower)?.id ?? null
}

function gradeChoice(stage: RxStage, text: string): RxGrade {
  const id = matchChoice(stage, text)
  if (!id) return invalid(CHOOSE)
  if (id === stage.answerText) return correct()
  const trap = stage.traps.find((item) => item.text === id)
  if (trap) return mistakeOf(trap.id, trap.witness)
  return wrong()
}

function gradeNumber(stage: RxStage, text: string): RxGrade {
  const n = parseWhole(text)
  if (n == null) return invalid(WHOLE)
  if (String(n) === stage.answerText) return correct()
  const trap = stage.traps.find((item) => parseWhole(item.text) === n)
  if (trap) return mistakeOf(trap.id, trap.witness)
  return wrong('Count again: every number written on an atom, the coefficient included, multiplies.')
}

export function gradeRxStage(answer: ReactionsAnswer, stageId: RxStageId, text: string): RxGrade {
  const stage = answer.stages.find((item) => item.id === stageId)
  if (!stage) return invalid(WRONG)
  const check = stage.check
  switch (check.kind) {
    case 'atom-count':
      return gradeNumber(stage, text)
    case 'is-balanced':
    case 'off-element':
    case 'type':
    case 'reacts':
      return gradeChoice(stage, text)
    case 'balance': {
      const read = readCoefficients(text, stage.slots?.length ?? 0)
      if (!read.ok) return invalid(read.message)
      return coefficientGrade(check.reaction, read.values)
    }
    case 'ionic-product':
      return gradeIonicProduct(check, text)
    case 'element':
      return gradeElement(check, text)
    case 'combustion-product':
      return gradeCombustion(check, text)
    case 'named-formula':
      return gradeNamed(check, text)
    default: {
      const never: never = check
      return never
    }
  }
}

// ---------------------------------------------------------------------------
// Answers and traps, re-derived from the table, the balancer and the engine
// ---------------------------------------------------------------------------

/** The answer string for a check. */
export function canonicalRxAnswer(check: RxCheck): string {
  switch (check.kind) {
    case 'atom-count':
      return String(rightCount(check))
    case 'is-balanced':
      return balances(reactionOf(check.reaction), check.coefficients) ? BALANCED_TEXT.yes : BALANCED_TEXT.no
    case 'off-element': {
      const off = offElements(reactionOf(check.reaction), check.coefficients)
      if (off.length > 1) throw new Error(`reactions: ${check.reaction} has ${off.length} elements off`)
      return off.length === 0 ? NONE_OFF : capName(elementName(off[0]!))
    }
    case 'balance':
      return coefficientsOf(reactionOf(check.reaction)).join(' ')
    case 'type':
      return TYPE_TEXT[reactionOf(check.reaction).type]
    case 'ionic-product':
      return ionicFormula(check.cation, check.anion)
    case 'element':
      return elementalFormula(check.symbol)
    case 'reacts':
      return reactsWith(check.lone, check.compound) ? REACTS_TEXT.yes : REACTS_TEXT.no
    case 'combustion-product':
      return check.carries === 'carbon' ? 'CO2' : 'H2O'
    case 'named-formula':
      return formulaOf(check.name)
    default: {
      const never: never = check
      return never
    }
  }
}

/** The engine's canonical formula of a name, written without a state ('HCl', not 'HCl(aq)'). */
function formulaOf(name: string): string {
  return formulaOfName(name).replace(/\((aq|s|l|g)\)$/, '')
}

/** Other spellings that grade correct. */
export function acceptedRxAnswers(check: RxCheck): string[] {
  const answer = canonicalRxAnswer(check)
  if (check.kind === 'named-formula') {
    const c = compoundOfName(check.name)
    return c ? acceptedFormulas(c).filter((f) => f !== answer) : []
  }
  if (check.kind === 'element' && check.symbol === 'S') return ['S8']
  return []
}

function addTrap(out: RxTrap[], answerText: string, id: ErrorPatternId, text: string, witness: string) {
  if (!text || text === answerText) return
  if (out.some((trap) => trap.text === text)) return
  out.push({ id, text, witness })
}

const COUNT_WITNESS = {
  coef: 'You let the coefficient multiply only the first element. A coefficient counts whole formula units, so it reaches every atom in the formula, this one included.',
  paren: 'You let the subscript after the parenthesis count only the first atom inside. That subscript multiplies everything in the parentheses.',
  add: 'You added the numbers stacked on this atom. A coefficient and a subscript each count groups of what follows them, so they multiply.',
} as const

const TYPE_SWAP: Partial<Record<keyof typeof TYPE_TEXT, { to: keyof typeof TYPE_TEXT; id: ErrorPatternId; witness: string }>> = {
  combination: {
    to: 'decomposition',
    id: 'rx_combo_decomp_swapped',
    witness: 'Read the arrow left to right: here several substances go in and a single one comes out, so things are joining, not coming apart.',
  },
  decomposition: {
    to: 'combination',
    id: 'rx_combo_decomp_swapped',
    witness: 'Read the arrow left to right: here a single substance goes in and several come out, so something is coming apart, not joining.',
  },
  single: {
    to: 'double',
    id: 'rx_single_double_swapped',
    witness: 'Look at the reactants: one of them is a lone element, not a compound. Only one partner changes places, so this is not a trade between two compounds.',
  },
  double: {
    to: 'single',
    id: 'rx_single_double_swapped',
    witness: 'Look at the reactants: both are compounds, and no lone element walks in. Both pairs split up and trade, so two partners change places.',
  },
}

function leaksIn(texts: readonly string[], answers: readonly string[]): boolean {
  return texts.some((t) => answers.some((a) => rxLeaks(t, a)))
}

/** Engine candidates that grade as their own id through this module's grader and say nothing that gives the answer away. */
function engineTraps(out: RxTrap[], answerText: string, accepted: readonly string[], candidates: readonly NmMistakeCandidate[] | null, grade: (text: string) => RxGrade) {
  for (const cand of candidates ?? []) {
    const g = grade(cand.text)
    if (g.verdict !== 'mistake' || g.mistake !== cand.id) continue
    const info = ERROR_PATTERNS[cand.id]
    if (leaksIn([g.witness, info.title, info.lesson], [answerText, ...accepted])) continue
    if (READABLE.some((re) => re.test(g.witness))) continue
    addTrap(out, answerText, cand.id, cand.text, g.witness)
  }
}

/** One-element-off candidates near the answer: the skeleton's 1s, or one coefficient nudged. */
export function unbalancedCandidates(reactionId: string): number[][] {
  const r = reactionOf(reactionId)
  const right = coefficientsOf(r)
  const out: number[][] = []
  const push = (v: number[]) => {
    if (v.some((x) => x < 1)) return
    if (offElements(r, v).length !== 1) return
    if (out.some((o) => o.join(' ') === v.join(' '))) return
    out.push(v)
  }
  push(right.map(() => 1))
  right.forEach((_, i) => {
    for (const delta of [1, -1, 2]) push(right.map((x, j) => (j === i ? x + delta : x)))
  })
  return out
}

/** Every named slip this check can produce, in detection order. Equals to the answer are dropped. */
export function trapsForRx(check: RxCheck): RxTrap[] {
  const answerText = canonicalRxAnswer(check)
  const accepted = acceptedRxAnswers(check)
  const out: RxTrap[] = []
  switch (check.kind) {
    case 'atom-count': {
      const coef = coefFirstOnly(check)
      if (coef != null) addTrap(out, answerText, 'rx_coef_first_only', String(coef), COUNT_WITNESS.coef)
      const paren = parenFirstOnly(check)
      if (paren != null) addTrap(out, answerText, 'rx_paren_first_only', String(paren), COUNT_WITNESS.paren)
      addTrap(out, answerText, 'rx_add_not_multiply', String(addedCount(check)), COUNT_WITNESS.add)
      break
    }
    case 'is-balanced':
    case 'off-element':
      break
    case 'balance': {
      const right = coefficientsOf(reactionOf(check.reaction))
      const doubled = right.map((x) => 2 * x)
      const g = coefficientGrade(check.reaction, doubled)
      if (g.verdict === 'mistake') addTrap(out, answerText, g.mistake, doubled.join(' '), g.witness)
      for (const v of unbalancedCandidates(check.reaction)) {
        const u = coefficientGrade(check.reaction, v)
        if (u.verdict === 'mistake') addTrap(out, answerText, u.mistake, v.join(' '), u.witness)
      }
      break
    }
    case 'type': {
      const swap = TYPE_SWAP[reactionOf(check.reaction).type]
      if (swap) addTrap(out, answerText, swap.id, TYPE_TEXT[swap.to], swap.witness)
      break
    }
    case 'ionic-product': {
      for (const reactant of check.reactants) addTrap(out, answerText, 'rx_not_swapped', reactant, notSwappedWitness(reactant))
      engineTraps(out, answerText, accepted, ionicFormulaMistakes(check.cation, check.anion), (t) => gradeIonicProduct(check, t))
      break
    }
    case 'element':
      if (isDiatomic(check.symbol)) addTrap(out, answerText, 'rx_diatomic_single', check.symbol, diatomicWitness(check.symbol))
      break
    case 'reacts': {
      const reacts = reactsWith(check.lone, check.compound)
      const lone = elementName(check.lone)
      addTrap(
        out,
        answerText,
        'rx_activity_backwards',
        reacts ? REACTS_TEXT.no : REACTS_TEXT.yes,
        reacts
          ? `You read the series upside down. ${capName(lone)} sits above the element it would replace, so it does push that element out.`
          : `You read the series upside down. ${capName(lone)} sits below the element it would have to replace, so it cannot push that element out.`,
      )
      break
    }
    case 'combustion-product':
      if (check.carries === 'carbon') {
        addTrap(out, answerText, 'rx_combustion_products', 'CO', COMBUSTION_WITNESS.CO)
        addTrap(out, answerText, 'rx_combustion_products', 'C', COMBUSTION_WITNESS.C)
      } else {
        addTrap(out, answerText, 'rx_combustion_products', 'H2', COMBUSTION_WITNESS.H2)
      }
      break
    case 'named-formula':
      engineTraps(out, answerText, accepted, formulaFromNameMistakes(check.name), (t) => gradeNamed(check, t))
      break
    default: {
      const never: never = check
      return never
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The per-seed assert
// ---------------------------------------------------------------------------

function cardBlob(id: string): string {
  const card = RX_RULES.find((item) => item.id === id)
  return `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`
}

/** A surface that shows EVERY option of a choice part singles out none. */
function leaks(stage: RxStage, surface: string, answer: string): boolean {
  if (!answer || !rxLeaks(surface, answer)) return false
  if (stage.kind === 'choice' && stage.choices && stage.choices.length >= 2 && stage.choices.every((c) => rxLeaks(surface, c.text))) return false
  return true
}

/** Exported for the review and flow tests: the shared leak rule plus the complete-listing rule. */
export function singlesOut(stage: RxStage, surface: string, answer: string): boolean {
  return leaks(stage, surface, answer)
}

function leak(where: string, stage: RxStage, surfaceName: string, text: string, answers: readonly string[]) {
  for (const answer of answers) if (leaks(stage, text, answer)) throw new Error(`${where}: ${surfaceName} contains the answer ${answer}`)
}

const READABLE = [/\[object/, /undefined/, /\bNaN\b/, /\b[Aa]n? \d/]

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertReactions(where: string, answer: ReactionsAnswer, instructions = ''): void {
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  for (const reserved of RX_RESERVED_FORMULAS) {
    if (rxLeaks(answer.prompt, reserved)) throw new Error(`${where}: prompt draws the reserved ${reserved}`)
  }
  const readable = [answer.prompt, instructions, ...answer.stages.flatMap((s) => [s.label, s.hint, s.nudge, ...(s.choices ?? []).map((c) => c.text), ...s.traps.map((t) => t.witness)])]
  for (const text of readable) for (const bad of READABLE) if (bad.test(text)) throw new Error(`${where}: unreadable text "${text}"`)
  const ids = new Set<string>()
  for (const stage of answer.stages) {
    if (ids.has(stage.id)) throw new Error(`${where}: repeated part ${stage.id}`)
    ids.add(stage.id)
    const expected = canonicalRxAnswer(stage.check)
    if (stage.answerText !== expected) throw new Error(`${where}: ${stage.id} stored ${stage.answerText} but the table says ${expected}`)
    for (const reserved of RX_RESERVED_FORMULAS) if (stage.answerText === reserved) throw new Error(`${where}: ${stage.id} answers with the reserved ${reserved}`)
    const answers = [stage.answerText, ...(stage.accept ?? [])]
    for (const alt of answers) {
      const g = gradeRxStage(answer, stage.id, alt)
      if (g.verdict !== 'correct') throw new Error(`${where}: ${stage.id} answer ${alt} graded ${g.verdict} (${g.message})`)
    }
    if (stage.kind === 'choice') {
      const rights = (stage.choices ?? []).filter((c) => gradeRxStage(answer, stage.id, c.id).verdict === 'correct')
      if (rights.length !== 1) throw new Error(`${where}: ${stage.id} has ${rights.length} right choices`)
    }
    const trapTexts = new Set<string>()
    for (const trap of stage.traps) {
      if (answers.includes(trap.text)) throw new Error(`${where}: trap ${trap.id} equals the answer`)
      if (trapTexts.has(trap.text)) throw new Error(`${where}: two traps share ${trap.text}`)
      trapTexts.add(trap.text)
      const g = gradeRxStage(answer, stage.id, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) {
        throw new Error(`${where}: trap ${trap.id} (${trap.text}) graded ${g.verdict}${g.verdict === 'mistake' ? ` ${g.mistake}` : ''}`)
      }
      leak(where, stage, `${trap.id} witness`, trap.witness, answers)
    }
    leak(where, stage, 'hint', stage.hint, answers)
    leak(where, stage, 'nudge', stage.nudge, answers)
    leak(where, stage, 'prompt', answer.prompt, answers)
    leak(where, stage, 'instructions', instructions, answers)
    for (const ruleId of new Set([stage.ruleCard, ...answer.ruleCards])) leak(where, stage, ruleId, cardBlob(ruleId), answers)
  }
  if (answer.trap) {
    const stage = answer.stages.find((item) => item.id === answer.trapStage)
    if (!stage || answer.trapAnswer == null) throw new Error(`${where}: promised trap has no part`)
    const g = gradeRxStage(answer, stage.id, answer.trapAnswer)
    if (g.verdict !== 'mistake' || g.mistake !== answer.trap) throw new Error(`${where}: promised ${answer.trap} graded ${g.verdict}`)
  } else if (answer.stages.some((stage) => stage.traps.length > 0)) {
    throw new Error(`${where}: a trap was possible but none was promised`)
  }
}
