/**
 * When a text shows an answer. Everything she sees while she can still act (a hint, a nudge, a rule card, a named
 * mistake's title, lesson, sentence about her answer and example line, a plain "wrong" message) is checked with
 * these before it is shown, and every generated problem is checked with them before it ships.
 *
 * A text shows an answer when it contains it as:
 *  - a whole formula (Fe₂(SO₄)₃ or Fe2(SO4)3; not the start of Fe₂(SO₄)₃·5H₂O or NaCl₂), or a whole ion with its
 *    charge (SO₄²⁻, SO4^2-);
 *  - a whole name in any spelling the engine accepts (its name key: case, spacing, aluminium, sulphate, monooxide,
 *    bicarbonate …). A name inside a longer ion name is another ion: 'sulfate' in 'hydrogen sulfate' does not count;
 *  - the class word, for a classify part ('ionic', 'molecular' or 'covalent', 'acid', 'hydrate').
 *
 * `stageKeys` adds, for a name or formula, the piece that decides it: the polyatomic ion's name and the metal's
 * numeral in an ionic name, the salt and the hydrate word in a hydrate's name, the root word of an acid's name, the
 * ions' formulas when the compound was given by name.
 */
import {
  acceptedFormulas,
  acceptedNameKeys,
  chemicalNameKey,
  compoundFormula,
  compoundOfFormula,
  compoundOfName,
  formulaDisplay,
  greekPrefix,
  resolveIon,
  type Compound,
  type IonicCompound,
  type NmIon,
} from '@/engine'
import type { NmStage } from '@/content/types'

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻'

const gluedBefore = (ch: string | undefined) => ch !== undefined && (/[A-Za-z0-9)·]/.test(ch) || SUBSCRIPTS.includes(ch))
const gluedAfter = (ch: string | undefined) => ch !== undefined && (/[A-Za-z0-9(·^]/.test(ch) || SUBSCRIPTS.includes(ch) || SUPERSCRIPTS.includes(ch))

/** True when the formula (app text: 'Fe2(SO4)3', 'SO4^2-', 'HCl(aq)') is in the text as a whole formula, ASCII or display. */
export function showsFormula(text: string, formula: string): boolean {
  if (!formula) return false
  for (const form of new Set([formula, formulaDisplay(formula)])) {
    for (let i = text.indexOf(form); i >= 0; i = text.indexOf(form, i + 1)) {
      if (!gluedBefore(text[i - 1]) && !gluedAfter(text[i + form.length])) return true
    }
  }
  return false
}

/** Free text in the engine's name-key form (punctuation, digits and formulas become spaces first). */
export function nameTextKey(text: string): string {
  return chemicalNameKey(text.replace(/[^A-Za-z\s()\-‐-―−]/g, ' '))
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** True when the name key is in the text as a whole name: not inside a longer word, and not the rest of a hydrogen ion's name. */
export function showsName(text: string, key: string, textKey = nameTextKey(text)): boolean {
  if (!key || !textKey.includes(key)) return false
  const re = new RegExp(`(?<![a-z])${escape(key)}(?![a-z])`, 'g')
  const hydrogenName = /^(?:di)?hydrogen /.test(key)
  for (let m = re.exec(textKey); m; m = re.exec(textKey)) {
    if (!hydrogenName && /hydrogen $/.test(textKey.slice(0, m.index))) continue
    return true
  }
  return false
}

/** True when the word is in the text as a whole word, any case. */
export function showsWord(text: string, word: string): boolean {
  return new RegExp(`(?<![a-z])${escape(word.toLowerCase())}(?![a-z])`).test(text.toLowerCase())
}

/** What a text must not contain for one part: formulas (app text), name keys, and class words. */
export interface LeakKeys {
  formulas: string[]
  names: string[]
  words: string[]
}

export function leaks(text: string, keys: LeakKeys): boolean {
  if (!text) return false
  if (keys.formulas.some((f) => showsFormula(text, f))) return true
  if (keys.words.some((w) => showsWord(text, w))) return true
  if (keys.names.length === 0) return false
  const t = nameTextKey(text)
  return keys.names.some((k) => showsName(text, k, t))
}

const uniq = <T>(xs: readonly T[]) => [...new Set(xs)]

function ionNames(ion: NmIon): string[] {
  return [ion.name, ...ion.otherNames].map(chemicalNameKey)
}

function ionTexts(ion: NmIon): string[] {
  const charge = ion.text.slice(ion.text.indexOf('^'))
  return [ion.formula, ...ion.otherFormulas].map((f) => `${f}${charge}`)
}

/** The deciding pieces of an ionic name: a polyatomic ion's name, a metal's name with its numeral. */
function ionicNamePieces(c: IonicCompound): string[] {
  const out: string[] = []
  for (const ion of [c.cation, c.anion]) if (ion.kind === 'polyatomic') out.push(...ionNames(ion))
  if (c.cation.numeral !== null && !c.cation.numeralOptional) out.push(chemicalNameKey(c.cation.name))
  return out
}

/** Every right formula of a compound (app text); a binary acid with and without (aq). */
export function formulasOf(c: Compound): string[] {
  const out = acceptedFormulas(c)
  if (c.kind === 'acid' && c.binary) out.push(...out.map((f) => `${f}(aq)`))
  return uniq([compoundFormula(c), ...out])
}

/** Every accepted name of a compound, as keys. */
export function nameKeysOf(c: Compound): string[] {
  return acceptedNameKeys(c)
}

function compoundOfStage(stage: NmStage): Compound | null {
  const check = stage.check
  if (check.kind === 'name' || check.kind === 'classify') return compoundOfFormula(check.formula, { inWater: check.inWater === true })
  if (check.kind === 'formula') return compoundOfName(check.name)
  return null
}

/** A part's leak keys: the answer in every accepted form, and the pieces that decide it. */
export interface PartKeys {
  answers: LeakKeys
  pieces: LeakKeys
}

const KEY_CACHE = new Map<string, PartKeys>()

/** What one part's texts must not contain: its answer in every accepted form, and the pieces that decide it. */
export function stageKeys(stage: NmStage): PartKeys {
  const memo = JSON.stringify([stage.part, stage.kind, stage.answerText, stage.accept, stage.check])
  let keys = KEY_CACHE.get(memo)
  if (!keys) {
    keys = stageKeysUncached(stage)
    KEY_CACHE.set(memo, keys)
  }
  return keys
}

const empty = (): LeakKeys => ({ formulas: [], names: [], words: [] })

function stageKeysUncached(stage: NmStage): PartKeys {
  const answers = empty()
  const pieces = empty()
  const check = stage.check
  switch (stage.part) {
    case 'class':
      answers.words = stage.answerText === 'molecular' ? ['molecular', 'covalent'] : [stage.answerText]
      return { answers, pieces }
    case 'ion-name': {
      const ion = check.kind === 'ion_name' ? resolveIon(check.ion) : null
      answers.names = uniq([chemicalNameKey(stage.answerText), ...stage.accept.map(chemicalNameKey), ...(ion ? ionNames(ion) : [])])
      return { answers, pieces }
    }
    case 'ion-formula': {
      const ion = check.kind === 'ion_formula' ? resolveIon(check.ion) : null
      answers.formulas = uniq([stage.answerText, ...stage.accept, ...(ion ? ionTexts(ion) : [])])
      return { answers, pieces }
    }
    default:
      break
  }
  const c = compoundOfStage(stage)
  if (stage.kind === 'name') {
    answers.names = uniq([chemicalNameKey(stage.answerText), ...stage.accept.map(chemicalNameKey), ...(c ? nameKeysOf(c) : [])])
    if (c?.kind === 'ionic') pieces.names.push(...ionicNamePieces(c))
    if (c?.kind === 'hydrate') pieces.names.push(...nameKeysOf(c.salt), ...ionicNamePieces(c.salt), chemicalNameKey(`${greekPrefix(c.waters)}hydrate`))
    if (c?.kind === 'acid') pieces.names.push(...nameKeysOf(c).map((k) => k.replace(/ acid$/, '')))
    pieces.names = uniq(pieces.names)
    return { answers, pieces }
  }
  answers.formulas = uniq([stage.answerText, ...stage.accept, ...(c ? formulasOf(c) : [])])
  // Given by name, the ions' formulas decide the answer; given as two ions, they are printed in the problem.
  if (check.kind === 'formula' && c) {
    const salt = c.kind === 'hydrate' ? c.salt : c.kind === 'ionic' ? c : null
    if (salt) pieces.formulas.push(...ionTexts(salt.cation), ...ionTexts(salt.anion))
    if (c.kind === 'hydrate') pieces.formulas.push(...formulasOf(c.salt))
    if (c.kind === 'acid') pieces.formulas.push(...ionTexts(c.anion))
  }
  pieces.formulas = uniq(pieces.formulas)
  return { answers, pieces }
}

const SUB_TO_DIGIT: Readonly<Record<string, string>> = Object.fromEntries([...SUBSCRIPTS].map((d, i) => [d, String(i)]))

/** Her text as a plain formula (Unicode subscripts as digits, no spaces), for "did she write this ion herself". */
function plainFormula(text: string): string {
  return [...text].map((ch) => SUB_TO_DIGIT[ch] ?? ch).join('').replace(/\s+/g, '')
}

/** The pieces she did not write herself: quoting her own words back gives nothing away. */
function piecesNotTyped(pieces: LeakKeys, herText: string | undefined): LeakKeys {
  if (!herText) return pieces
  const herKey = nameTextKey(herText)
  const herFormula = plainFormula(herText)
  return {
    names: pieces.names.filter((k) => !showsName(herText, k, herKey)),
    formulas: pieces.formulas.filter((f) => !herFormula.includes(f.split('^')[0]!)),
    words: pieces.words,
  }
}

/**
 * True when the text shows this part's answer, in any accepted form, or a piece that decides it. Pass her text when
 * the text is about her answer: a piece she wrote herself (the anion's name she put first) is no news to her.
 */
export function leaksTo(text: string, keys: PartKeys, herText?: string): boolean {
  return leaks(text, keys.answers) || leaks(text, piecesNotTyped(keys.pieces, herText))
}
