/**
 * How a chapter 10 part is graded, whichever module it comes from. Every part reduces to one model:
 *
 *   numeric    a measured answer. The sig-fig engine grades it first (gradeSigFigAnswer), so a right
 *              value with the wrong figures gets the engine's own note or sf_ id. Only then is her
 *              value compared with what each named slip produces, rounded to HER significant
 *              figures (the light module's rule), exactly — never a float tolerance.
 *   tolerance  a molar mass to the hundredths: within ±0.02 g/mol of the right sum is right (two
 *              honest rounding paths differ by that much); a slip's sum matches within ±0.02 too.
 *   counts     a formula entered as a whole number beside each symbol.
 *   whole      a whole number (the multiplier).
 *   choice     buttons.
 *
 * Models are built from a part's check by moles/grade.ts and chemFormulas/grade.ts.
 */
import { gradeSigFigAnswer, parseSigFigNumeral } from '@/engine'
import { analyseSigFigTask } from '@/engine/sigfigs/evaluate'
import { ratAbs, ratCmp, ratEq, ratFromDec, ratSub, rat, roundRatToPlace, roundRatToSigFigs, type Rat } from '@/engine/sigfigs/decimal'
import { sigFigDec } from '@/engine/sigfigs/parse'
import { canonicalForms } from '@/engine/sigfigs/round'
import type { MoCount } from '@/content/types'
import type { ErrorPatternId, SigFigGrade, SigFigTask } from '@/shared/types'
import { countsText, gcdOf, parseCounts, sameCounts } from './facts'

export type MoGrade =
  | { verdict: 'correct'; message: string; note?: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string; message: string }

export interface MoTrap {
  id: ErrorPatternId
  text: string
  witness: string
}

export interface NumericTrap {
  id: ErrorPatternId
  exact: Rat
  witness: string
}

export interface ToleranceTrap {
  id: ErrorPatternId
  /** What the slip sums to, in hundredths of a g/mol. */
  hundredths: bigint
  witness: string
}

export interface CountsTrap {
  id: ErrorPatternId
  counts: MoCount[]
  witness: string
}

export type PartModel =
  | {
      mode: 'numeric'
      task: SigFigTask
      /** The exact value of the calculation (for a 'round' task: the true value, not the chopped text). */
      exact: Rat
      traps: NumericTrap[]
    }
  | { mode: 'tolerance'; hundredths: bigint; full: Rat; traps: ToleranceTrap[] }
  | { mode: 'counts'; symbols: string[]; counts: MoCount[]; traps: CountsTrap[]; lowest: boolean }
  | { mode: 'whole'; value: number }
  | { mode: 'choice'; answer: string; traps: MoTrap[] }

const CORRECT = "That's right."
const WRONG = "That doesn't match this problem."
export const CHOOSE = 'Choose one.'
const WHOLE = 'Type a whole number, like 3.'
const COUNTS = 'Type a whole number of 1 or more in every box.'
const COARSE = 'That is the right size, but give it to the hundredths place, the way the atomic masses are written.'
const UNROUNDED =
  'That is the sum with the unrounded masses. This chapter rounds each atomic mass to the hundredths first, as the problem lists them — add those.'
const NOT_LOWEST = 'Those counts still share a common factor. An empirical formula is the smallest whole-number ratio, so divide them down.'
const TWO_CENTS = rat(2n, 100n)

function correct(message = CORRECT, note?: string): MoGrade {
  return note ? { verdict: 'correct', message, note } : { verdict: 'correct', message }
}

function wrong(message = WRONG): MoGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): MoGrade {
  return { verdict: 'invalid', message }
}

function mistake(id: ErrorPatternId, witness: string): MoGrade {
  return { verdict: 'mistake', mistake: id, witness, message: witness }
}

function rounded(r: { m: bigint; place: number }): Rat {
  return ratFromDec({ int: r.m, exp: r.place })
}

// ---------------------------------------------------------------------------
// numeric
// ---------------------------------------------------------------------------

/** The rounding the answer is held to: figures for a calculation, a place for a 'round' task. */
function target(task: SigFigTask): { sigFigs: number; place: number; byPlace: boolean } {
  const a = analyseSigFigTask(task)
  return { sigFigs: a.evaluation.expected.sigFigs, place: a.evaluation.expected.place, byPlace: task.kind === 'round' }
}

/** A value written the way the answer is held: same figures (or same place for a 'round' task). */
export function textAtTarget(task: SigFigTask, exact: Rat): string {
  const t = target(task)
  const r = t.byPlace ? roundRatToPlace(exact, t.place) : roundRatToSigFigs(exact, t.sigFigs)
  return canonicalForms(r.m, r.place).text
}

/** The first dropped digit when the value is rounded the way the answer is held. */
export function firstDroppedAtTarget(task: SigFigTask, exact: Rat): number {
  const t = target(task)
  return (t.byPlace ? roundRatToPlace(exact, t.place) : roundRatToSigFigs(exact, t.sigFigs)).firstDropped
}

function fromBase(base: SigFigGrade): MoGrade {
  if (base.status === 'correct') return correct(base.message, base.note)
  if (base.status === 'parse_error') return invalid(base.message)
  if (base.pattern) return mistake(base.pattern.id, base.message)
  return wrong(base.message)
}

function gradeNumeric(model: Extract<PartModel, { mode: 'numeric' }>, typed: string): MoGrade {
  const base = gradeSigFigAnswer(model.task, typed)
  if (base.status !== 'wrong' || !base.parsed || base.parsed.isZero || base.parsed.sigFigs < 1) return fromBase(base)
  const hers = ratFromDec(sigFigDec(base.parsed))
  const n = base.parsed.sigFigs
  const rightAtHers = rounded(roundRatToSigFigs(model.exact, n))
  // Right value at her figures: the sig-fig engine already said what is off.
  if (ratEq(rightAtHers, hers)) return fromBase(base)
  for (const trap of model.traps) {
    if (trap.exact.n === 0n) continue
    const at = rounded(roundRatToSigFigs(trap.exact, n))
    if (ratEq(at, hers) && !ratEq(at, rightAtHers)) return mistake(trap.id, trap.witness)
  }
  return fromBase(base)
}

// ---------------------------------------------------------------------------
// tolerance (molar masses)
// ---------------------------------------------------------------------------

function within(a: Rat, b: Rat, tol: Rat = TWO_CENTS): boolean {
  return ratCmp(ratAbs(ratSub(a, b)), tol) <= 0
}

export function hundredthsToRat(h: bigint): Rat {
  return rat(h, 100n)
}

function gradeTolerance(model: Extract<PartModel, { mode: 'tolerance' }>, typed: string): MoGrade {
  const parsed = parseSigFigNumeral(typed)
  if (!parsed.ok) return invalid(parsed.error.message)
  const v = ratFromDec(sigFigDec(parsed.numeral))
  if (within(v, hundredthsToRat(model.hundredths))) {
    return parsed.numeral.lastSigPlace <= -2 ? correct() : wrong(COARSE)
  }
  for (const trap of model.traps) {
    if (within(v, hundredthsToRat(trap.hundredths))) return mistake(trap.id, trap.witness)
  }
  if (within(v, model.full)) return wrong(UNROUNDED)
  return wrong()
}

/** Tolerance traps the grader can tell apart: more than 0.04 from the answer and from each other. */
export function separateTolerance(answer: bigint, traps: (ToleranceTrap | null)[]): ToleranceTrap[] {
  const out: ToleranceTrap[] = []
  const far = (a: bigint, b: bigint) => (a > b ? a - b : b - a) > 4n
  for (const trap of traps) {
    if (!trap || !far(trap.hundredths, answer) || out.some((t) => !far(t.hundredths, trap.hundredths))) continue
    out.push(trap)
  }
  return out
}

// ---------------------------------------------------------------------------
// counts, whole, choice
// ---------------------------------------------------------------------------

function gradeCounts(model: Extract<PartModel, { mode: 'counts' }>, typed: string): MoGrade {
  const counts = parseCounts(typed)
  if (!counts || counts.length !== model.symbols.length || counts.some((c, i) => c.symbol !== model.symbols[i] || c.n < 1)) return invalid(COUNTS)
  if (sameCounts(counts, model.counts)) return correct()
  for (const trap of model.traps) if (sameCounts(counts, trap.counts)) return mistake(trap.id, trap.witness)
  if (model.lowest && gcdOf(counts.map((c) => c.n)) > 1) return wrong(NOT_LOWEST)
  return wrong()
}

function gradeWhole(model: Extract<PartModel, { mode: 'whole' }>, typed: string): MoGrade {
  const t = typed.trim().replace(/\.$/, '')
  if (!/^\d{1,3}$/.test(t)) return invalid(WHOLE)
  return Number(t) === model.value ? correct() : wrong()
}

export interface ChoiceLike {
  choices?: { id: string; text: string }[]
  accept?: string[]
}

export function matchChoice(stage: ChoiceLike, text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  const choices = stage.choices ?? []
  const exact = choices.find((choice) => choice.id === raw || choice.text === raw)
  if (exact) return exact.id
  const lower = raw.toLowerCase()
  return choices.find((choice) => choice.id.toLowerCase() === lower || choice.text.toLowerCase() === lower)?.id ?? null
}

function gradeChoice(model: Extract<PartModel, { mode: 'choice' }>, stage: ChoiceLike, typed: string): MoGrade {
  const id = matchChoice(stage, typed)
  if (!id) return invalid(CHOOSE)
  if (id === model.answer || (stage.accept ?? []).includes(id)) return correct()
  const trap = model.traps.find((t) => t.text === id)
  return trap ? mistake(trap.id, trap.witness) : wrong()
}

/** Grade what she entered against the part's model. */
export function gradeModel(model: PartModel, stage: ChoiceLike, typed: string): MoGrade {
  switch (model.mode) {
    case 'numeric':
      return gradeNumeric(model, typed)
    case 'tolerance':
      return gradeTolerance(model, typed)
    case 'counts':
      return gradeCounts(model, typed)
    case 'whole':
      return gradeWhole(model, typed)
    case 'choice':
      return gradeChoice(model, stage, typed)
    default: {
      const never: never = model
      return never
    }
  }
}

/** The right answer as she would enter it. */
export function canonicalOfModel(model: PartModel): string {
  switch (model.mode) {
    case 'numeric':
      return analyseSigFigTask(model.task).evaluation.expected.text
    case 'tolerance':
      return `${model.hundredths / 100n}.${String(model.hundredths % 100n).padStart(2, '0')}`
    case 'counts':
      return countsText(model.counts)
    case 'whole':
      return String(model.value)
    case 'choice':
      return model.answer
    default: {
      const never: never = model
      return never
    }
  }
}

/** Other spellings of the right answer (numeric parts: the engine's alternates). */
export function alternatesOfModel(model: PartModel): string[] {
  return model.mode === 'numeric' ? analyseSigFigTask(model.task).evaluation.expected.alternates : []
}

/**
 * Every named slip as she would enter it, in detection order. A numeric slip is written with the
 * answer's own figures (or place); slips equal to the answer, or to an earlier slip, are dropped.
 */
export function trapsOfModel(model: PartModel): MoTrap[] {
  const out: MoTrap[] = []
  const add = (id: ErrorPatternId, text: string, witness: string) => {
    if (!text || out.some((t) => t.text === text)) return
    out.push({ id, text, witness })
  }
  switch (model.mode) {
    case 'numeric': {
      const answer = canonicalOfModel(model)
      const answerValue = ratOfText(answer)
      for (const trap of model.traps) {
        if (trap.exact.n === 0n) continue
        // A slip whose value sits on a rounding boundary could be written two ways: never promised.
        if (firstDroppedAtTarget(model.task, trap.exact) === 5) continue
        const text = textAtTarget(model.task, trap.exact)
        if (ratEq(ratOfText(text), answerValue)) continue
        if (out.some((t) => ratEq(ratOfText(t.text), ratOfText(text)))) continue
        add(trap.id, text, trap.witness)
      }
      break
    }
    case 'tolerance':
      for (const trap of model.traps) add(trap.id, canonicalOfModel({ ...model, hundredths: trap.hundredths }), trap.witness)
      break
    case 'counts':
      for (const trap of model.traps) if (!sameCounts(trap.counts, model.counts)) add(trap.id, countsText(trap.counts), trap.witness)
      break
    case 'whole':
      break
    case 'choice':
      for (const trap of model.traps) if (trap.text !== model.answer) add(trap.id, trap.text, trap.witness)
      break
    default: {
      const never: never = model
      return never
    }
  }
  return out
}

export function ratOfText(text: string): Rat {
  const parsed = parseSigFigNumeral(text)
  if (!parsed.ok) throw new Error(`moles: unreadable ${text}`)
  return ratFromDec(sigFigDec(parsed.numeral))
}

/** '1.51 x 10^24' → { coefficient: '1.51', power: '24' }; '18.02' → { coefficient: '18.02', power: '' }. */
export function splitNumeral(text: string): { coefficient: string; power: string } {
  const m = /^(.*?)\s*x\s*10\^(-?\d+)$/.exec(text.trim())
  return m ? { coefficient: m[1]!, power: m[2]! } : { coefficient: text.trim(), power: '' }
}
