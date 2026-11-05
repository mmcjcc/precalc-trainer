/**
 * Grades one part of an ionic/metallic-bonding problem. A named mistake is whatever that slip
 * produces for THIS problem, compared exactly; a candidate equal to the right answer is never
 * used. The formula part grades through the nomenclature engine and the ion-configuration part
 * through the econfig engine, so chapter 8 can never disagree with chapters 5 and 7.
 */
import type { IbCheck, IbStageId, IonicBondingAnswer } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import { gradeConfiguration, gradeIonicFormula, ionicFormula, ionicFormulaMistakes, readIonFormula } from '@/engine'
import { EC_PATTERN } from '@/content/modules/electrons/patterns'
import {
  answerLeaks,
  atomConfigText,
  chargeOf,
  dotsOf,
  ibChargeText,
  ibElement,
  ibValence,
  ionConfigText,
  ionTextOf,
  ratioOf,
  transferCount,
} from './facts'
import { DOTS_STAND_TEXT, GAIN_LOSE_TEXT, IB_RULES, PROPS_CORRECT, PROPS_WRONG, SEA_CORRECT, SEA_WRONG } from './rules'

export const IB_KEYS: Record<IbStageId, string> = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' }

/** The chapter 8 ids minted for this module, in detection order. */
export const IB_MISTAKE_IDS = [
  'ib_valence_dblock',
  'ib_gain_lose',
  'ib_charge_sign',
  'ib_dots_neutral',
  'ib_dots_all',
  'ib_transfer_count',
  'ib_props_electrons',
  'ib_props_molecules',
  'ib_props_weak',
  'mb_fixed_electrons',
  'mb_ionic_confusion',
] as const satisfies readonly ErrorPatternId[]

/**
 * Slips this chapter names with an id another module already owns, instead of minting a twin
 * (the brief's ib_atom_config, ib_crisscross_swap and ib_unreduced; see docs/progress/chem-bonding.md):
 * the atom's configuration typed for the ion is the econfig engine's `ec_ion_charge_ignored`, and the
 * swapped or unreduced criss-cross is the nomenclature engine's pair.
 */
export const IB_REUSED_MISTAKE_IDS = ['ec_ion_charge_ignored', 'nm_crisscross_reversed', 'nm_not_lowest_ratio'] as const satisfies readonly ErrorPatternId[]

export type IbMistakeId = (typeof IB_MISTAKE_IDS)[number] | (typeof IB_REUSED_MISTAKE_IDS)[number]

export type IbGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string; message: string }

export interface IbTrap {
  id: ErrorPatternId
  text: string
  witness: string
}

type IbStage = IonicBondingAnswer['stages'][number]

const CORRECT = "That's right."
const WRONG = "That doesn't match this problem."
const WHOLE = 'Type a whole number.'
const CHOOSE = 'Choose one.'
const RATIO = 'Type two whole numbers with a colon between them, cations first.'
const ION_CHARGE = 'An ion shows its charge: write it after the symbol, like Fr^+ or with a superscript.'

export function exampleShowsAnswer(example: string, answerText: string): boolean {
  return answerLeaks(example, answerText)
}

export function ibWork(answer: IonicBondingAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const value = entries[IB_KEYS[stage.id]]?.trim()
    if (value) lines.push(`${stage.label}: ${value}`)
  }
  return lines
}

function correct(message = CORRECT): IbGrade {
  return { verdict: 'correct', message }
}

function wrong(message = WRONG): IbGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): IbGrade {
  return { verdict: 'invalid', message }
}

function mistake(trap: IbTrap): IbGrade {
  return { verdict: 'mistake', mistake: trap.id, witness: trap.witness, message: trap.witness }
}

function phrase(text: string): string {
  return text.trim().toLowerCase().replace(/−/g, '-').replace(/\./g, '').replace(/\s+/g, ' ')
}

function parseWhole(text: string): number | null {
  let t = phrase(text)
  t = t.replace(/\s*(electrons?|dots?)$/, '')
  if (!/^[+-]?\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isInteger(n) ? n : null
}

function gradeNumber(stage: IbStage, text: string): IbGrade {
  const n = parseWhole(text)
  if (n == null) return invalid(WHOLE)
  if (String(n) === stage.answerText) return correct()
  for (const trap of stage.traps) {
    if (parseWhole(trap.text) === n) return mistake(trap)
  }
  return wrong()
}

function matchChoice(stage: IbStage, text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  const choices = stage.choices ?? []
  const exact = choices.find((choice) => choice.id === raw || choice.text === raw)
  if (exact) return exact.id
  const lower = raw.toLowerCase()
  const folded = choices.find((choice) => choice.id.toLowerCase() === lower || choice.text.toLowerCase() === lower)
  return folded?.id ?? null
}

function gradeChoice(stage: IbStage, text: string): IbGrade {
  const id = matchChoice(stage, text)
  if (!id) return invalid(CHOOSE)
  if (id === stage.answerText || (stage.accept ?? []).includes(id)) return correct()
  for (const trap of stage.traps) {
    if (trap.text === id) return mistake(trap)
  }
  return wrong()
}

function gradeIon(stage: IbStage, z: number, text: string): IbGrade {
  const el = ibElement(z)
  const target = chargeOf(z)
  const parsed = readIonFormula(text)
  if (!parsed.ok) return invalid(parsed.error.message)
  const readings = parsed.value
  const single = readings
    .map((reading) => {
      const part = reading.parts.length === 1 ? reading.parts[0] : undefined
      return part && part.type === 'element' && part.count === 1 ? { symbol: part.symbol, charge: reading.charge } : null
    })
    .filter((r): r is { symbol: string; charge: number | null } => r !== null)
  if (single.length === 0) return invalid('Type one element symbol with its charge, like Fr^+.')
  if (single.every((r) => r.symbol !== el.symbol)) return wrong('Start from the element this problem names; its symbol comes first.')
  const ours = single.filter((r) => r.symbol === el.symbol)
  if (ours.every((r) => r.charge === null)) return invalid(ION_CHARGE)
  if (ours.some((r) => r.charge === target)) return correct()
  const typed = ours.find((r) => r.charge !== null)!
  for (const trap of stage.traps) {
    if (trap.text === `${el.symbol}^${ibChargeText(typed.charge!)}`) return mistake(trap)
  }
  return wrong('The size of the charge is the number of electrons that moved, and the sign follows them.')
}

function gradeIonConfig(z: number, text: string): IbGrade {
  const g = gradeConfiguration({ z, charge: chargeOf(z) }, text)
  switch (g.verdict) {
    case 'correct':
      return correct(g.message)
    case 'wrong':
      return wrong(g.message)
    case 'invalid':
      return invalid(g.message)
    case 'unsupported':
      return invalid(g.message)
    case 'mistake':
      return { verdict: 'mistake', mistake: EC_PATTERN[g.mistake], witness: g.witness, message: g.witness }
  }
}

function parseRatio(text: string): { a: number; b: number } | null {
  const t = phrase(text).replace(/\s*(?::|to|,)\s*/g, ':')
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(t)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (a < 1 || b < 1) return null
  return { a, b }
}

function gradeRatio(stage: IbStage, check: Extract<IbCheck, { kind: 'ratio' }>, text: string): IbGrade {
  const parsed = parseRatio(text)
  if (!parsed) return invalid(RATIO)
  const { cations, anions } = ratioOf(check.cationZ, check.anionZ)
  if (parsed.a === cations && parsed.b === anions) return correct()
  for (const trap of stage.traps) {
    const want = parseRatio(trap.text)
    if (want && want.a === parsed.a && want.b === parsed.b) return mistake(trap)
  }
  // Any other equivalent-but-unreduced pair is still the lowest-ratio slip.
  if (parsed.a * anions === parsed.b * cations) {
    const trap = stage.traps.find((item) => item.id === 'nm_not_lowest_ratio')
    if (trap) return mistake(trap)
    return wrong('That ratio balances the charges but is not in lowest terms.')
  }
  return wrong('That many of each ion does not cancel all the plus with all the minus.')
}

function gradeFormula(check: Extract<IbCheck, { kind: 'formula' }>, text: string): IbGrade {
  const g = gradeIonicFormula(ionTextOf(check.cationZ), ionTextOf(check.anionZ), text)
  switch (g.verdict) {
    case 'correct':
      return correct(g.message)
    case 'wrong':
      return wrong(g.message)
    case 'invalid':
      return invalid(g.message)
    case 'unsupported':
      return invalid(g.message)
    case 'mistake':
      return { verdict: 'mistake', mistake: g.mistake, witness: g.witness, message: g.witness }
  }
}

export function gradeIbStage(answer: IonicBondingAnswer, stageId: IbStageId, text: string): IbGrade {
  const stage = answer.stages.find((item) => item.id === stageId)
  if (!stage) return invalid(WRONG)
  switch (stage.check.kind) {
    case 'valence':
    case 'move-count':
    case 'dots':
    case 'transfer-count':
      return gradeNumber(stage, text)
    case 'gain-lose':
    case 'dots-stand':
    case 'props':
    case 'sea':
      return gradeChoice(stage, text)
    case 'ion':
      return gradeIon(stage, stage.check.z, text)
    case 'ion-config':
      return gradeIonConfig(stage.check.z, text)
    case 'ratio':
      return gradeRatio(stage, stage.check, text)
    case 'formula':
      return gradeFormula(stage.check, text)
    default: {
      const never: never = stage.check
      return never
    }
  }
}

/** The answer string for a check, taken from the element table and the chem engines. */
export function canonicalIbAnswer(check: IbCheck): string {
  switch (check.kind) {
    case 'valence': {
      const valence = ibValence(ibElement(check.z))
      if (valence == null) throw new Error(`ionicBonding: Z ${check.z} has no valence count`)
      return String(valence)
    }
    case 'gain-lose':
      return chargeOf(check.z) > 0 ? GAIN_LOSE_TEXT.lose : GAIN_LOSE_TEXT.gain
    case 'move-count':
      return String(Math.abs(chargeOf(check.z)))
    case 'ion':
      return ionTextOf(check.z)
    case 'ion-config':
      return ionConfigText(check.z)
    case 'dots':
      return String(dotsOf(check.z, check.charge))
    case 'dots-stand':
      return DOTS_STAND_TEXT.valence
    case 'ratio': {
      const { cations, anions } = ratioOf(check.cationZ, check.anionZ)
      return `${cations}:${anions}`
    }
    case 'formula':
      return ionicFormula(ionTextOf(check.cationZ), ionTextOf(check.anionZ))
    case 'transfer-count':
      return String(transferCount(check.cationZ, check.anionZ))
    case 'props':
      return PROPS_CORRECT[check.scenario]
    case 'sea':
      return SEA_CORRECT[check.ask]
    default: {
      const never: never = check
      return never
    }
  }
}

function addTrap(out: IbTrap[], answerText: string, id: ErrorPatternId, text: string, witness: string) {
  if (!text || text === answerText) return
  if (out.some((trap) => trap.text === text)) return
  out.push({ id, text, witness })
}

/** Every named slip this check can produce, in detection order. Equals to the answer are dropped. */
export function trapsForIb(check: IbCheck): IbTrap[] {
  const answerText = canonicalIbAnswer(check)
  const out: IbTrap[] = []
  switch (check.kind) {
    case 'valence': {
      const el = ibElement(check.z)
      const valence = ibValence(el)
      // Period 4 p-block atoms carry a filled 3d below the outer shell; counting it adds ten.
      if (valence != null && el.period === 4 && el.group != null && el.group >= 13) {
        addTrap(out, answerText, 'ib_valence_dblock', String(valence + 10), 'You counted the filled d subshell too. It sits one shell further in, so only the outermost shell belongs in this count.')
      }
      break
    }
    case 'gain-lose': {
      const loses = chargeOf(check.z) > 0
      addTrap(
        out,
        answerText,
        'ib_gain_lose',
        loses ? GAIN_LOSE_TEXT.gain : GAIN_LOSE_TEXT.lose,
        loses
          ? 'You sent the electrons the wrong way. A metal with a few outer electrons sheds them to uncover the full shell underneath.'
          : 'You sent the electrons the wrong way. A nonmetal this close to a full shell collects the few it is missing.',
      )
      break
    }
    case 'move-count':
      break
    case 'ion': {
      const el = ibElement(check.z)
      const charge = chargeOf(check.z)
      addTrap(
        out,
        answerText,
        'ib_charge_sign',
        `${el.symbol}^${ibChargeText(-charge)}`,
        charge > 0
          ? 'You flipped the sign. The minuses left with the electrons, so this ion ends up positive.'
          : 'You flipped the sign. The electrons it collected each brought a minus, so this ion ends up negative.',
      )
      break
    }
    case 'ion-config': {
      // The slip is typed as the atom's FULL configuration: its sum-of-counts witness never has to
      // echo a bracketed core, so no surface can show this part's own answer.
      const atomText = atomConfigText(check.z)
      if (atomText !== answerText) {
        const graded = gradeConfiguration({ z: check.z, charge: chargeOf(check.z) }, atomText)
        if (graded.verdict === 'mistake' && graded.mistake === 'ion_charge_ignored') {
          addTrap(out, answerText, 'ec_ion_charge_ignored', atomText, graded.witness)
        }
      }
      break
    }
    case 'dots': {
      const el = ibElement(check.z)
      const valence = ibValence(el) ?? 0
      if (check.charge !== 0) {
        addTrap(out, answerText, 'ib_dots_neutral', String(valence), 'You drew the neutral atom. The electrons have already moved, so the symbol shows the shell as it is now.')
        addTrap(out, answerText, 'ib_dots_all', String(check.z - check.charge), 'You counted every electron the ion owns. The dots are only the outermost shell; the symbol stands in for all the rest.')
      } else {
        addTrap(out, answerText, 'ib_dots_all', String(check.z), 'You counted every electron the atom owns. The dots are only the outermost shell; the symbol stands in for all the rest.')
      }
      break
    }
    case 'dots-stand':
      addTrap(out, answerText, 'ib_dots_all', DOTS_STAND_TEXT.all, 'You pointed at every electron. The symbol in the middle already stands for the nucleus and all the inner ones.')
      break
    case 'ratio': {
      const cm = Math.abs(chargeOf(check.cationZ))
      const am = Math.abs(chargeOf(check.anionZ))
      // Equal charges first: 2:2 for a 2+/2− pair is the unreduced slip, not a reversed criss-cross.
      addTrap(out, answerText, 'nm_not_lowest_ratio', `${am}:${cm}`, 'You balanced the charges but did not reduce. The formula unit uses the lowest whole numbers that cancel.')
      addTrap(out, answerText, 'nm_crisscross_reversed', `${cm}:${am}`, 'You gave each ion its own charge as its count. In the criss-cross, each charge sets how many of the OTHER ion the unit needs.')
      break
    }
    case 'formula': {
      const candidates = ionicFormulaMistakes(ionTextOf(check.cationZ), ionTextOf(check.anionZ)) ?? []
      for (const candidate of candidates) {
        if (candidate.id === 'nm_crisscross_reversed' || candidate.id === 'nm_not_lowest_ratio') {
          addTrap(out, answerText, candidate.id, candidate.text, candidate.witness)
        }
      }
      break
    }
    case 'transfer-count': {
      const perAtom = Math.abs(chargeOf(check.cationZ))
      addTrap(out, answerText, 'ib_transfer_count', String(perAtom), 'You counted one metal atom’s loss. The question asks for the whole formula unit, so every cation in it gives its share.')
      break
    }
    case 'props':
      addTrap(out, answerText, 'ib_props_electrons', PROPS_WRONG.electrons, 'You gave the metal story. In an ionic solid the transferred electrons sit on the anions and stay put; nothing drifts through the crystal.')
      addTrap(out, answerText, 'ib_props_molecules', PROPS_WRONG.molecules, 'You pictured separate molecules. An ionic compound is one continuous lattice of ions, with no little molecule to point at.')
      addTrap(out, answerText, 'ib_props_weak', PROPS_WRONG.weak, 'You called the attractions feeble. They pull hard in every direction — the crystal’s behaviour comes from the lattice, not from weakness.')
      break
    case 'sea':
      addTrap(out, answerText, 'mb_fixed_electrons', SEA_WRONG.fixed, 'You kept every electron at home. In a metal the outer electrons belong to the whole piece and drift between the positive centers.')
      addTrap(out, answerText, 'mb_ionic_confusion', SEA_WRONG.ionic, 'You described an ionic crystal. A metal is one kind of atom throughout, with no negative ions anywhere in it.')
      break
    default: {
      const never: never = check
      return never
    }
  }
  return out
}

function cardBlob(id: string): string {
  const card = IB_RULES.find((item) => item.id === id)
  return `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`
}

function leak(where: string, surface: string, text: string, answer: string) {
  if (answer && answerLeaks(text, answer)) throw new Error(`${where}: ${surface} contains the answer ${answer}`)
}

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertIonicBonding(where: string, answer: IonicBondingAnswer): void {
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  const ids = new Set<string>()
  for (const stage of answer.stages) {
    if (ids.has(stage.id)) throw new Error(`${where}: repeated part ${stage.id}`)
    ids.add(stage.id)
    const expected = canonicalIbAnswer(stage.check)
    if (stage.answerText !== expected) throw new Error(`${where}: ${stage.id} stored ${stage.answerText} but the tables say ${expected}`)
    const right = gradeIbStage(answer, stage.id, stage.answerText)
    if (right.verdict !== 'correct') throw new Error(`${where}: ${stage.id} answer graded ${right.verdict} (${right.message})`)
    for (const alt of stage.accept ?? []) {
      const graded = gradeIbStage(answer, stage.id, alt)
      if (graded.verdict !== 'correct') throw new Error(`${where}: ${stage.id} accept ${alt} graded ${graded.verdict}`)
    }
    const trapTexts = new Set<string>()
    for (const trap of stage.traps) {
      if (trap.text === stage.answerText) throw new Error(`${where}: trap ${trap.id} equals the answer`)
      if (trapTexts.has(trap.text)) throw new Error(`${where}: two traps share ${trap.text}`)
      trapTexts.add(trap.text)
      const graded = gradeIbStage(answer, stage.id, trap.text)
      if (graded.verdict !== 'mistake' || graded.mistake !== trap.id) {
        throw new Error(`${where}: trap ${trap.id} (${trap.text}) graded ${graded.verdict}${graded.verdict === 'mistake' ? ` ${graded.mistake}` : ''}`)
      }
      leak(where, `${trap.id} witness`, trap.witness, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, `${trap.id} witness`, trap.witness, alt)
    }
    for (const surface of [stage.hint, stage.nudge]) {
      leak(where, stage.id, surface, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, stage.id, surface, alt)
    }
    leak(where, 'prompt', answer.prompt, stage.answerText)
    for (const alt of stage.accept ?? []) leak(where, 'prompt', answer.prompt, alt)
    for (const ruleId of new Set([stage.ruleCard, ...answer.ruleCards])) {
      const blob = cardBlob(ruleId)
      leak(where, ruleId, blob, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, ruleId, blob, alt)
    }
  }
  if (answer.trap) {
    const stage = answer.stages.find((item) => item.id === answer.trapStage)
    if (!stage || answer.trapAnswer == null) throw new Error(`${where}: promised trap has no part`)
    const graded = gradeIbStage(answer, stage.id, answer.trapAnswer)
    if (graded.verdict !== 'mistake' || graded.mistake !== answer.trap) {
      throw new Error(`${where}: promised ${answer.trap} graded ${graded.verdict}`)
    }
  }
}
