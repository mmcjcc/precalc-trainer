/**
 * Grades one part of a covalent-bonding problem. A named mistake is whatever that slip produces
 * for THIS problem's molecule, pair or counts, compared exactly; a candidate equal to the right
 * answer is never used. Every value re-derives from the molecule table and the trend data
 * (facts.ts), so no answer is typed twice.
 */
import type { CbCheck, CbStageId, CovalentBondingAnswer } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import {
  ANGLE_TEXTS,
  angleOf,
  answerLeaks,
  bandOf,
  bondedAtoms,
  bondsPolar,
  CB_RESERVED_FORMULAS,
  containsH,
  dotsAround,
  enDiff,
  enDiffText,
  forceOf,
  hasHydrogenBonding,
  moleculeOf,
  moleculePolar,
  MOLECULES,
  sharedPairs,
  shapeOf,
  totalValence,
  unsharedPairs,
} from './facts'
import { BAND_TEXT, BEND_RIGHT, BOND_TYPE_TEXT, CB_RULES, DUET_OCTET, DUET_RIGHT, FORCE_TEXT, ORDER_TEXT, POLAR_TEXT } from './rules'
import { boilRight, boilSame } from './sentences'

export const CB_KEYS: Record<CbStageId, string> = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' }

/** The chapter 9 ids minted for this module, in detection order. No existing id fit (see the doc). */
export const CB_MISTAKE_IDS = [
  'cb_transfer_share',
  'cb_h_octet',
  'cb_pairs_swapped',
  'cb_pairs_for_electrons',
  'cb_electron_groups_shape',
  'cb_angle_wrong_shape',
  'cb_en_negative',
  'cb_bands_flipped',
  'cb_polar_because_bonds',
  'cb_hbond_any_h',
] as const satisfies readonly ErrorPatternId[]

export type CbMistakeId = (typeof CB_MISTAKE_IDS)[number]

export type CbGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string; message: string }

export interface CbTrap {
  id: ErrorPatternId
  text: string
  witness: string
}

type CbStage = CovalentBondingAnswer['stages'][number]

const CORRECT = "That's right."
const WRONG = "That doesn't match this problem."
const WHOLE = 'Type a whole number.'
const CHOOSE = 'Choose one.'
const DECIMAL = 'Type the difference as a decimal, like 0.25.'
const DEGREES = 'Type the angle as a number of degrees, like 90 or 90.5.'

export function exampleShowsAnswer(example: string, answerText: string): boolean {
  return answerLeaks(example, answerText)
}

export function cbWork(answer: CovalentBondingAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const value = entries[CB_KEYS[stage.id]]?.trim()
    if (value) lines.push(`${stage.label}: ${value}`)
  }
  return lines
}

function correct(message = CORRECT): CbGrade {
  return { verdict: 'correct', message }
}

function wrong(message = WRONG): CbGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): CbGrade {
  return { verdict: 'invalid', message }
}

function mistake(trap: CbTrap): CbGrade {
  return { verdict: 'mistake', mistake: trap.id, witness: trap.witness, message: trap.witness }
}

function phrase(text: string): string {
  return text.trim().toLowerCase().replace(/−/g, '-').replace(/\s+/g, ' ')
}

function parseWhole(text: string): number | null {
  let t = phrase(text).replace(/\.$/, '')
  t = t.replace(/\s*(electrons?|dots?|pairs?)$/, '')
  if (!/^[+-]?\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isInteger(n) ? n : null
}

/** A decimal with an optional sign and degree word stripped: '0.96', '-.5', '109.5°'. */
function parseDecimal(text: string): number | null {
  let t = phrase(text).replace(/°/g, '').replace(/\s*degrees?$/, '').trim()
  t = t.replace(/\.$/, '')
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(t)) return null
  return Number(t)
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

function gradeNumber(stage: CbStage, text: string): CbGrade {
  const n = parseWhole(text)
  if (n == null) return invalid(WHOLE)
  if (String(n) === stage.answerText) return correct()
  for (const trap of stage.traps) {
    if (parseWhole(trap.text) === n) return mistake(trap)
  }
  return wrong()
}

function gradeDecimal(stage: CbStage, text: string, invalidMessage: string): CbGrade {
  const v = parseDecimal(text)
  if (v == null) return invalid(invalidMessage)
  if (near(v, Number(stage.answerText))) return correct()
  for (const trap of stage.traps) {
    if (near(v, Number(trap.text))) return mistake(trap)
  }
  return wrong()
}

function matchChoice(stage: CbStage, text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  const choices = stage.choices ?? []
  const exact = choices.find((choice) => choice.id === raw || choice.text === raw)
  if (exact) return exact.id
  const lower = raw.toLowerCase()
  const folded = choices.find((choice) => choice.id.toLowerCase() === lower || choice.text.toLowerCase() === lower)
  return folded?.id ?? null
}

function gradeChoice(stage: CbStage, text: string): CbGrade {
  const id = matchChoice(stage, text)
  if (!id) return invalid(CHOOSE)
  if (id === stage.answerText || (stage.accept ?? []).includes(id)) return correct()
  for (const trap of stage.traps) {
    if (trap.text === id) return mistake(trap)
  }
  return wrong()
}

export function gradeCbStage(answer: CovalentBondingAnswer, stageId: CbStageId, text: string): CbGrade {
  const stage = answer.stages.find((item) => item.id === stageId)
  if (!stage) return invalid(WRONG)
  switch (stage.check.kind) {
    case 'total-valence':
    case 'bonding-pairs':
    case 'lone-pairs':
    case 'bond-electrons':
    case 'shared-pairs':
    case 'unshared-pairs':
    case 'atom-dots':
      return gradeNumber(stage, text)
    case 'angle':
      return gradeDecimal(stage, text, DEGREES)
    case 'en-diff':
      return gradeDecimal(stage, text, DECIMAL)
    case 'bond-type':
    case 'bond-order':
    case 'duet-why':
    case 'shape':
    case 'bend-why':
    case 'bond-class':
    case 'molecule-polar':
    case 'force':
    case 'boil':
      return gradeChoice(stage, text)
    default: {
      const never: never = stage.check
      return never
    }
  }
}

/** The answer string for a check, re-derived from the molecule table and the trend data. */
export function canonicalCbAnswer(check: CbCheck): string {
  switch (check.kind) {
    case 'bond-type':
      return check.subject === 'molecule' ? BOND_TYPE_TEXT.shared : BOND_TYPE_TEXT.transferred
    case 'total-valence':
      return String(totalValence(moleculeOf(check.formula)))
    case 'bonding-pairs':
      return String(sharedPairs(moleculeOf(check.formula)))
    case 'lone-pairs': {
      const m = moleculeOf(check.formula)
      if (m.lonePairsCentral == null) throw new Error(`covalentBonding: ${check.formula} has no central atom`)
      return String(m.lonePairsCentral)
    }
    case 'bond-order':
      return ORDER_TEXT[moleculeOf(check.formula).bondOrder]
    case 'bond-electrons':
      return String(2 * moleculeOf(check.formula).bondOrder)
    case 'shared-pairs':
      return String(sharedPairs(moleculeOf(check.formula)))
    case 'unshared-pairs':
      return String(unsharedPairs(moleculeOf(check.formula)))
    case 'atom-dots':
      return String(dotsAround(moleculeOf(check.formula), check.atom))
    case 'duet-why':
      return DUET_RIGHT[check.variant % DUET_RIGHT.length]!
    case 'shape':
      return shapeOf(check.bonded, check.lone)
    case 'angle':
      return angleOf(check.bonded, check.lone)
    case 'bend-why':
      return BEND_RIGHT[check.variant % BEND_RIGHT.length]!
    case 'en-diff':
      return enDiffText(check.a, check.b)
    case 'bond-class': {
      const band = bandOf(enDiff(check.a, check.b))
      return band
    }
    case 'molecule-polar':
      return moleculePolar(moleculeOf(check.formula)) ? POLAR_TEXT.polar : POLAR_TEXT.nonpolar
    case 'force':
      return FORCE_TEXT[forceOf(moleculeOf(check.formula))]
    case 'boil':
      return boilRight(check.a, check.b)
    default: {
      const never: never = check
      return never
    }
  }
}

function addTrap(out: CbTrap[], answerText: string, id: ErrorPatternId, text: string, witness: string) {
  if (!text || text === answerText) return
  if (out.some((trap) => trap.text === text)) return
  out.push({ id, text, witness })
}

const SWAPPED_WITNESS =
  'Those two counts traded places. The pairs that sit in bonds hold atoms together; the pairs kept at home are the lone ones — each count has its own box.'

/** Every named slip this check can produce, in detection order. Equals to the answer are dropped. */
export function trapsForCb(check: CbCheck): CbTrap[] {
  const answerText = canonicalCbAnswer(check)
  const out: CbTrap[] = []
  switch (check.kind) {
    case 'bond-type': {
      if (check.subject === 'molecule') {
        addTrap(
          out,
          answerText,
          'cb_transfer_share',
          BOND_TYPE_TEXT.transferred,
          'You moved the electrons across. Two nonmetals pull almost equally hard, so neither can take the pair: it sits between them and belongs to both.',
        )
      } else {
        addTrap(
          out,
          answerText,
          'cb_transfer_share',
          BOND_TYPE_TEXT.shared,
          'You kept the electrons between the atoms. A metal beside a nonmetal does not share: its outer electrons leave outright, and ions are what remain.',
        )
      }
      break
    }
    case 'total-valence':
      break
    case 'bonding-pairs': {
      const m = moleculeOf(check.formula)
      const bonding = sharedPairs(m)
      const lone = m.lonePairsCentral ?? 0
      addTrap(out, answerText, 'cb_pairs_swapped', String(lone), SWAPPED_WITNESS)
      addTrap(
        out,
        answerText,
        'cb_pairs_for_electrons',
        String(2 * bonding),
        'You counted electrons where pairs were asked. Two electrons make one pair, so the count of pairs is half of yours.',
      )
      break
    }
    case 'lone-pairs': {
      const m = moleculeOf(check.formula)
      addTrap(out, answerText, 'cb_pairs_swapped', String(sharedPairs(m)), SWAPPED_WITNESS)
      break
    }
    case 'bond-order':
      break
    case 'bond-electrons': {
      const m = moleculeOf(check.formula)
      addTrap(
        out,
        answerText,
        'cb_pairs_for_electrons',
        String(m.bondOrder),
        'You counted pairs where electrons were asked. Every shared pair is two electrons, so double the pairs to count them.',
      )
      break
    }
    case 'shared-pairs': {
      const m = moleculeOf(check.formula)
      addTrap(out, answerText, 'cb_pairs_swapped', String(unsharedPairs(m)), SWAPPED_WITNESS)
      break
    }
    case 'unshared-pairs': {
      const m = moleculeOf(check.formula)
      addTrap(out, answerText, 'cb_pairs_swapped', String(sharedPairs(m)), SWAPPED_WITNESS)
      break
    }
    case 'atom-dots': {
      if (check.atom === 'H') {
        addTrap(
          out,
          answerText,
          'cb_h_octet',
          '8',
          'You gave hydrogen a full octet. Its only shell is the first, and that shell cannot hold more than one pair.',
        )
      }
      break
    }
    case 'duet-why': {
      addTrap(
        out,
        answerText,
        'cb_h_octet',
        DUET_OCTET[check.variant % DUET_OCTET.length]!,
        'You held hydrogen to the same eight as the others. Its only shell is the first, and that shell is simply too small for more than one pair.',
      )
      break
    }
    case 'shape': {
      if (check.lone > 0) {
        const arrangement = shapeOf(check.bonded + check.lone, 0)
        addTrap(
          out,
          answerText,
          'cb_electron_groups_shape',
          arrangement,
          'You named where the electron groups point. One of those corners holds a lone pair, and the shape is named after the atoms alone.',
        )
        if (check.lone === 2) {
          addTrap(
            out,
            answerText,
            'cb_electron_groups_shape',
            shapeOf(check.bonded + 1, 0),
            'You let one lone pair drop out of the count and named that arrangement. Both lone pairs take corners; the atoms draw the shape that is left.',
          )
        }
      }
      break
    }
    case 'angle': {
      if (check.lone === 1) {
        addTrap(
          out,
          answerText,
          'cb_angle_wrong_shape',
          '120',
          'That angle belongs to a flat three-cornered arrangement. Here a lone pair holds the fourth corner and folds the bonds downward, closer together.',
        )
        addTrap(
          out,
          answerText,
          'cb_angle_wrong_shape',
          '109.5',
          'That is the four-corner arrangement before the squeeze. A lone pair pushes harder than a bonded atom, so the bonds sit a little closer than that.',
        )
      }
      if (check.lone === 2) {
        addTrap(
          out,
          answerText,
          'cb_angle_wrong_shape',
          '109.5',
          'That is the four-corner arrangement before the squeeze. Two lone pairs push harder than bonded atoms do, so the two bonds sit closer than that.',
        )
      }
      break
    }
    case 'bend-why':
      break
    case 'en-diff': {
      const diff = enDiff(check.a, check.b)
      if (diff > 0) {
        addTrap(
          out,
          answerText,
          'cb_en_negative',
          (-diff).toFixed(2),
          'You subtracted in the other order and kept the sign. The difference is a distance between the two pulls, so report it as a positive number.',
        )
      }
      break
    }
    case 'bond-class': {
      const band = bandOf(enDiff(check.a, check.b))
      if (band === 'Nonpolar covalent') {
        addTrap(
          out,
          answerText,
          'cb_bands_flipped',
          BAND_TEXT.ionic,
          'You read the bands backwards. A difference this small means the two atoms pull almost equally — they share the electrons evenly, and nothing changes hands.',
        )
      }
      if (band === 'Ionic') {
        addTrap(
          out,
          answerText,
          'cb_bands_flipped',
          BAND_TEXT.nonpolar,
          'You read the bands backwards. A difference this large is a one-sided tug: the electrons leave one atom for the other instead of being shared.',
        )
      }
      break
    }
    case 'molecule-polar': {
      // The slip fires exactly where its story holds: a symmetric molecule whose bonds DO pull
      // (CO2, CCl4, SiCl4). CS2's bonds pull almost equally (difference 0.03), so 'Polar' there
      // is a plain wrong answer, not this named slip.
      const m = moleculeOf(check.formula)
      if (m.central && (m.lonePairsCentral ?? 0) === 0 && bondsPolar(m)) {
        addTrap(
          out,
          answerText,
          'cb_polar_because_bonds',
          POLAR_TEXT.polar,
          bondedAtoms(m) === 2
            ? 'Each bond does pull — but the two pulls point exactly apart and cancel, so the molecule as a whole tugs no particular way.'
            : 'Each bond does pull — but four equal pulls spread evenly around the center cancel, so the molecule as a whole tugs no particular way.',
        )
      }
      break
    }
    case 'force': {
      const m = moleculeOf(check.formula)
      if (containsH(m) && !hasHydrogenBonding(m)) {
        addTrap(
          out,
          answerText,
          'cb_hbond_any_h',
          FORCE_TEXT.hbond,
          'Hydrogen alone is not enough. That grip only forms when the H sits straight on N, O or F — and in this molecule it does not.',
        )
      }
      break
    }
    case 'boil': {
      const same = boilSame(check.a, check.b)
      if (same) {
        addTrap(
          out,
          answerText,
          'cb_hbond_any_h',
          same,
          'Hydrogen alone is not enough. Only the sample whose H sits straight on N, O or F gets that grip; the other one never does.',
        )
      }
      break
    }
    default: {
      const never: never = check
      return never
    }
  }
  return out
}

function cardBlob(id: string): string {
  const card = CB_RULES.find((item) => item.id === id)
  return `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`
}

/**
 * The closed option set of a part, when it has one: a surface that shows EVERY member singles
 * out none (the brief's "a card that lists every option" rule), so such a surface is clean.
 */
function optionSet(stage: CbStage): readonly string[] | null {
  if (stage.kind === 'choice' && stage.choices && stage.choices.length >= 2) return stage.choices.map((choice) => choice.text)
  if (stage.check.kind === 'angle') return ANGLE_TEXTS
  return null
}

function leaks(stage: CbStage, surface: string, answer: string): boolean {
  if (!answer || !answerLeaks(surface, answer)) return false
  const options = optionSet(stage)
  if (options && options.every((option) => answerLeaks(surface, option))) return false
  return true
}

function leak(where: string, stage: CbStage, surfaceName: string, text: string, answer: string) {
  if (leaks(stage, text, answer)) throw new Error(`${where}: ${surfaceName} contains the answer ${answer}`)
}

const RESERVED_WORDS = ['PH3', 'PH₃', 'phosphine', 'SiH4', 'SiH₄', 'silane', 'HBr', 'hydrogen bromide']

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertCovalentBonding(where: string, answer: CovalentBondingAnswer): void {
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  for (const word of RESERVED_WORDS) {
    if (answer.prompt.includes(word)) throw new Error(`${where}: prompt draws the reserved molecule ${word}`)
  }
  const ids = new Set<string>()
  for (const stage of answer.stages) {
    if (ids.has(stage.id)) throw new Error(`${where}: repeated part ${stage.id}`)
    ids.add(stage.id)
    const expected = canonicalCbAnswer(stage.check)
    if (stage.answerText !== expected) throw new Error(`${where}: ${stage.id} stored ${stage.answerText} but the tables say ${expected}`)
    const right = gradeCbStage(answer, stage.id, stage.answerText)
    if (right.verdict !== 'correct') throw new Error(`${where}: ${stage.id} answer graded ${right.verdict} (${right.message})`)
    for (const alt of stage.accept ?? []) {
      const graded = gradeCbStage(answer, stage.id, alt)
      if (graded.verdict !== 'correct') throw new Error(`${where}: ${stage.id} accept ${alt} graded ${graded.verdict}`)
    }
    const trapTexts = new Set<string>()
    for (const trap of stage.traps) {
      if (trap.text === stage.answerText) throw new Error(`${where}: trap ${trap.id} equals the answer`)
      if (trapTexts.has(trap.text)) throw new Error(`${where}: two traps share ${trap.text}`)
      trapTexts.add(trap.text)
      const graded = gradeCbStage(answer, stage.id, trap.text)
      if (graded.verdict !== 'mistake' || graded.mistake !== trap.id) {
        throw new Error(`${where}: trap ${trap.id} (${trap.text}) graded ${graded.verdict}${graded.verdict === 'mistake' ? ` ${graded.mistake}` : ''}`)
      }
      leak(where, stage, `${trap.id} witness`, trap.witness, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, stage, `${trap.id} witness`, trap.witness, alt)
    }
    for (const surface of [stage.hint, stage.nudge]) {
      leak(where, stage, stage.id, surface, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, stage, stage.id, surface, alt)
    }
    leak(where, stage, 'prompt', answer.prompt, stage.answerText)
    for (const alt of stage.accept ?? []) leak(where, stage, 'prompt', answer.prompt, alt)
    for (const ruleId of new Set([stage.ruleCard, ...answer.ruleCards])) {
      const blob = cardBlob(ruleId)
      leak(where, stage, ruleId, blob, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, stage, ruleId, blob, alt)
    }
  }
  if (answer.trap) {
    const stage = answer.stages.find((item) => item.id === answer.trapStage)
    if (!stage || answer.trapAnswer == null) throw new Error(`${where}: promised trap has no part`)
    const graded = gradeCbStage(answer, stage.id, answer.trapAnswer)
    if (graded.verdict !== 'mistake' || graded.mistake !== answer.trap) {
      throw new Error(`${where}: promised ${answer.trap} graded ${graded.verdict}`)
    }
  } else if (answer.stages.some((stage) => stage.traps.length > 0)) {
    throw new Error(`${where}: a trap was possible but none was promised`)
  }
}

/** Every drawable formula, for the coverage test; reserved molecules stay out of all of it. */
export function drawableFormulas(): string[] {
  return MOLECULES.filter((m) => !CB_RESERVED_FORMULAS.includes(m.formula)).map((m) => m.formula)
}
