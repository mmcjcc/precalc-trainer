/**
 * The graders. Each returns an NmGrade (types.ts) and never throws. The order of the checks:
 *  1. the problem: outside the model → `unsupported`;
 *  2. her text: unreadable, wrong case, or the wrong form (a formula where a name is asked, a name where a
 *     formula is asked, an Arabic numeral for a charge, a classical name, an ion with no charge, extra
 *     parentheses, a subscript of 1) → `invalid`, not an attempt;
 *  3. every right way of writing the answer → `correct`;
 *  4. the slips' variants, in priority order (nameSlips.ts, formulaSlips.ts): her answer equals what that slip
 *     produces for this problem → `mistake`;
 *  5. formulas only: the structural rules (formulaSlips.ts) → `mistake`;
 *  6. otherwise → `wrong`, with a plain sentence that does not give the answer.
 * Every `…Mistakes` function lists one candidate per slip (its representative variant), keeps only candidates
 * that grade as their own id, and folds two slips with the same text into one candidate with `shadows`.
 */
import { ELEMENTS } from '../chem/elements'
import { patternHit } from '../matchers/catalog'
import {
  acceptedFormulas,
  acceptedNameKeys,
  compoundClass,
  compoundName,
  hydrogenCompoundOf,
  ionicCompound,
  ionPairProblem,
  systematicName,
} from './compounds'
import { flatAtoms, readFormula, readIon, simpleParts } from './formula'
import { formulaRule, formulaSlips } from './formulaSlips'
import {
  ateItePartner,
  hydrogenSiblings,
  ideSlipIon,
  ionDisplay,
  ionOfReading,
  nmIons,
  perHypoVariants,
  resolveIon,
} from './ions'
import { nameSlips, otherChargesOf, ionNameSlips, type Slip } from './nameSlips'
import { nameKey, readName } from './names'
import { compoundOfReading, readCompoundFormula, readCompoundName } from './read'
import { capitalized, chargeText, chargeWords, formulaDisplay } from './text'
import type {
  Compound,
  CompoundClass,
  FormulaPart,
  FormulaProblemOptions,
  IonLike,
  IonReading,
  NmGrade,
  NmIon,
  NmMistakeCandidate,
  NmMistakeId,
  NmParseError,
} from './types'

const fd = formulaDisplay

const mistake = (id: NmMistakeId, witness: string): NmGrade => ({ verdict: 'mistake', mistake: id, pattern: patternHit(id, witness), witness })
const wrong = (message: string): NmGrade => ({ verdict: 'wrong', message })
const correct = (message: string): NmGrade => ({ verdict: 'correct', message })
const unsupported = (message: string): NmGrade => ({ verdict: 'unsupported', message })

function invalid(e: Pick<NmParseError, 'reason' | 'message'> & { position?: number; length?: number }): NmGrade {
  const out: NmGrade = { verdict: 'invalid', reason: e.reason, message: e.message }
  if (e.position !== undefined) out.position = e.position
  if (e.length !== undefined) out.length = e.length
  return out
}

// --- what kind of text she typed ----------------------------------------------------------------------

const NAME_WORDS: ReadonlySet<string> = new Set([
  ...ELEMENTS.map((e) => e.name),
  ...nmIons().flatMap((i) => [i.name, ...i.otherNames].flatMap((n) => nameKey(n).replace(/\([ivx]+\)/g, '').split(' '))),
  'acid',
  'water',
  'ammonia',
  'methane',
  'ion',
  'aluminium',
  'sulphur',
])

/** True when her text reads as words of a name (for "a name where a formula was asked"). */
function looksLikeName(text: string): boolean {
  const words = (text ?? '').toLowerCase().match(/[a-z]+/g) ?? []
  return words.some((w) => NAME_WORDS.has(w) || (w.length > 4 && /(?:ide|ate|ite|ic|ous|hydrate)$/.test(w)))
}

/** True when her text is a formula (for "a formula where a name was asked"). */
function looksLikeFormula(text: string): boolean {
  return /[A-Z]/.test(text ?? '') && (readFormula(text).ok || (readIon(text).ok && !looksLikeName(text)))
}

function withoutState(text: string): string {
  return text.replace(/\((?:aq|s|l|g)\)$/, '')
}

/** Position of the first letter whose case differs from the right text (letters compared in order). */
function casePosition(raw: string, right: string): number | undefined {
  const rightLetters = right.replace(/[^A-Za-z]/g, '')
  let j = 0
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (!/[A-Za-z]/.test(ch)) continue
    const r = rightLetters[j++]
    if (r !== undefined && r !== ch) return i
  }
  return undefined
}

const CASE_MESSAGE =
  'Check the capital letters. Each symbol starts with a capital letter and its second letter is lowercase: Co is cobalt, but CO is carbon and oxygen.'

/** Her parts with parentheses taken off where the textbook puts none (a group of one, a group around one atom). */
function unwrapExtraParens(parts: readonly FormulaPart[]): FormulaPart[] {
  const out: FormulaPart[] = []
  for (const p of parts) {
    if (p.type === 'element') out.push(p)
    else if (p.count === 1) out.push(...unwrapExtraParens(p.parts))
    else if (p.parts.length === 1 && p.parts[0]!.type === 'element') out.push({ ...p.parts[0]!, count: p.parts[0]!.count * p.count })
    else out.push({ ...p, parts: unwrapExtraParens(p.parts) })
  }
  return out
}

function partsText(parts: readonly FormulaPart[]): string {
  return parts.map((p) => (p.type === 'element' ? p.symbol : `(${partsText(p.parts)})`) + (p.count === 1 ? '' : String(p.count))).join('')
}

function firstVariant(slips: readonly Slip[], matches: (key: string) => boolean, right: (key: string) => boolean): NmGrade | null {
  for (const slip of slips) for (const v of slip.variants) if (matches(v.key) && !right(v.key)) return mistake(slip.id, v.witness)
  return null
}

/** One candidate per slip (see the file comment). */
function candidatesOf(slips: readonly Slip[], grade: (text: string) => NmGrade, right: (key: string) => boolean): NmMistakeCandidate[] {
  const out: NmMistakeCandidate[] = []
  const byKey = new Map<string, NmMistakeCandidate>()
  for (const slip of slips) {
    for (const v of slip.variants) {
      if (right(v.key)) continue
      const twin = byKey.get(v.key)
      if (twin) {
        if (twin.id !== slip.id && !twin.shadows.includes(slip.id)) twin.shadows.push(slip.id)
        break
      }
      const g = grade(v.text)
      if (g.verdict === 'mistake' && g.mistake === slip.id) {
        const c: NmMistakeCandidate = { id: slip.id, text: v.text, witness: g.witness, shadows: [] }
        out.push(c)
        byKey.set(v.key, c)
        break
      }
    }
  }
  return out
}

// --- the problems ------------------------------------------------------------------------------------

interface FormulaProblem {
  compound: Compound
  /** The formula as display text: 'Fe₂(SO₄)₃'. */
  label: string
}

function formulaProblem(formula: string, options: FormulaProblemOptions): FormulaProblem | string {
  const r = readCompoundFormula(formula, options)
  if (!r.ok) return r.message
  const p = readFormula(formula)
  return { compound: r.compound, label: fd(p.ok ? p.value.text : formula) }
}

/** The right name keys; a hydrogen compound not in water may also be named as its acid (CK-12 calls HCl hydrochloric acid). */
function rightNameKeys(c: Compound): string[] {
  if (c.kind !== 'hydrogen') return acceptedNameKeys(c)
  return [...acceptedNameKeys(c), ...acceptedNameKeys(hydrogenCompoundOf(c.anion, true)!)]
}

// --- name from formula -------------------------------------------------------------------------------

function nameCorrect(c: Compound, label: string, key: string): string {
  const name = compoundName(c)
  if (c.kind === 'hydrogen' && !acceptedNameKeys(c).includes(key))
    return `Correct: dissolved in water, ${label} is ${compoundName(hydrogenCompoundOf(c.anion, true)!)}. Written without (aq), it is the pure compound, ${name}.`
  const sys = systematicName(c)
  if (sys && key === nameKey(sys)) return `Correct: ${label} is ${sys}, better known as ${name}.`
  const cat = c.kind === 'ionic' ? c.cation : c.kind === 'hydrate' ? c.salt.cation : null
  if (cat?.numeralOptional && !key.includes(`${cat.metalName}(`))
    return `Correct: ${label} is ${name.replace(cat.name, cat.metalName!)}. The textbook writes ${name}: nickel forms only Ni²⁺ at this level, so both are right.`
  return `Correct: ${label} is ${name}.`
}

/** Common misspellings of element words: her key with one fixed is a right key → say so. */
const SPELLINGS: readonly [RegExp, string, string][] = [
  [/phosphorous(?= (?!acid))/, 'phosphorus', 'the element is spelled phosphorus; phosphorous, with -ous, appears only in an acid’s name'],
  [/flour/g, 'fluor', 'fluorine and fluoride are spelled f-l-u-o'],
  [/sulfer/g, 'sulfur', 'sulfur is spelled with -ur'],
  [/clor/g, 'chlor', 'chlorine and chloride start with chl-'],
]

/**
 * Her chemistry is right but the name is incomplete or misspelled: not an attempt (the message would otherwise
 * give the answer away, which a `wrong` message never does).
 */
function formProblem(c: Compound, key: string): NmGrade | null {
  const right = rightNameKeys(c)
  if (right.includes(`${key} acid`)) return invalid({ reason: 'not_in_form', message: 'An acid’s name ends with the word acid.' })
  for (const [re, fix, why] of SPELLINGS) if (right.includes(key.replace(re, fix))) return invalid({ reason: 'unreadable', message: `Check the spelling: ${why}.` })
  return null
}

function nameWrong(c: Compound, label: string, key: string): string {
  if (c.kind === 'ionic' || c.kind === 'hydrate') {
    const s = c.kind === 'ionic' ? c : c.salt
    const catKeys = [s.cation.name, ...s.cation.otherNames].map(nameKey)
    const anKeys = [s.anion.name, ...s.anion.otherNames].map(nameKey)
    if (catKeys.some((k) => key.startsWith(`${k} `)))
      return `The cation part is right, but the rest is not: check what the anion in ${label} is called${c.kind === 'hydrate' ? ', and the water part' : ''}.`
    if (anKeys.some((k) => key.endsWith(` ${k}`) || key.includes(` ${k} `))) return `The anion part is right, but the cation is not the one in ${label}.`
    return `That is not the name of ${label}. Name the cation first, then the anion${c.kind === 'hydrate' ? ', then the water: a Greek prefix and hydrate' : ''}.`
  }
  if (c.kind === 'molecular')
    return `That is not the name of ${label}. Name the first element with a prefix for its number of atoms (none for one), then the second element with a prefix and the ending -ide.`
  if (c.kind === 'acid' || c.kind === 'hydrogen')
    return `That is not the name of ${label}. An acid is named from its anion: -ide becomes hydro-…-ic acid, -ate becomes -ic acid, and -ite becomes -ous acid.`
  return `That is not the name of ${label}.`
}

/**
 * Grade her name for a compound given as a formula. `options.inWater`: the problem says the compound is in
 * water (HCl then means hydrochloric acid even without (aq)).
 */
export function gradeNameFromFormula(formula: string, herName: string, options: FormulaProblemOptions = {}): NmGrade {
  const p = formulaProblem(formula, options)
  if (typeof p === 'string') return unsupported(p)
  return gradeNameAnswer(p, herName)
}

/** Grades her name for a problem already read; `slips` are passed in when a candidate list grades many names. */
function gradeNameAnswer(p: FormulaProblem, herName: string, slips?: readonly Slip[]): NmGrade {
  const raw = herName ?? ''
  if (raw.trim() !== '' && looksLikeFormula(raw))
    return invalid({ reason: 'not_in_form', message: 'This question asks for the name, written in words. You typed a formula.', position: 0, length: raw.length })
  const r = readName(raw)
  if (!r.ok) return invalid(r.error)
  const key = r.value.key
  const right = rightNameKeys(p.compound)
  if (right.includes(key)) return correct(nameCorrect(p.compound, p.label, key))
  return (
    firstVariant(slips ?? nameSlips(p.compound, p.label), (k) => k === key, (k) => right.includes(k)) ??
    formProblem(p.compound, key) ??
    wrong(nameWrong(p.compound, p.label, key))
  )
}

/** What each naming slip produces for this formula (null when the problem is outside the model). */
export function nameFromFormulaMistakes(formula: string, options: FormulaProblemOptions = {}): NmMistakeCandidate[] | null {
  const p = formulaProblem(formula, options)
  if (typeof p === 'string') return null
  const right = rightNameKeys(p.compound)
  const slips = nameSlips(p.compound, p.label)
  return candidatesOf(slips, (t) => gradeNameAnswer(p, t, slips), (k) => right.includes(k))
}

// --- formula from name (and from two ions) -------------------------------------------------------------

function formulaWrong(c: Compound, label: string, herText: string, her: ReturnType<typeof readFormula>): string {
  const other = her.ok ? compoundOfReading(her.value) : null
  const named = other && other.ok ? ` ${fd(herText)} is ${compoundName(other.compound)}.` : ''
  if (c.kind === 'molecular') return `Your formula is not ${label}: each prefix in the name gives the subscript of its element.${named}`
  if (c.kind === 'acid') return `Your formula is not ${label}: write H first, as many as the anion’s charge, then the anion.${named}`
  return `Your formula is not ${label}.${named} Find each ion’s formula and charge, then balance the charges.`
}

function gradeFormulaAnswer(c: Compound, label: string, raw: string, fromName: boolean, slips?: readonly Slip[]): NmGrade {
  const verb = fromName ? 'is' : 'make'
  const text0 = raw ?? ''
  const parsed = readFormula(text0)
  if (!parsed.ok && looksLikeName(text0))
    return invalid({ reason: 'not_in_form', message: 'This question asks for the formula: element symbols and subscripts, not the name.', position: 0, length: text0.length })
  if (!parsed.ok) return invalid(parsed.error)
  const her = parsed.value
  const text = withoutState(her.text)
  const accepted = acceptedFormulas(c)
  if (c.kind === 'acid' && c.binary && her.state && her.state !== 'aq')
    return invalid({ reason: 'not_in_form', message: `${capitalized(label)} is the compound dissolved in water, written (aq). (${her.state}) would be the pure compound.` })
  if (accepted.includes(text)) return correct(`Correct: ${label} ${verb} ${fd(her.text)}.`)
  const caseTwin = accepted.find((a) => a.toLowerCase() === text.toLowerCase())
  if (caseTwin) {
    const at = casePosition(text0, caseTwin)
    return invalid(at === undefined ? { reason: 'case', message: CASE_MESSAGE } : { reason: 'case', message: CASE_MESSAGE, position: at, length: 1 })
  }
  const unwrapped = partsText(unwrapExtraParens(her.parts)) + (her.waters === null ? '' : `·${her.waters === 1 ? '' : her.waters}H2O`)
  if (unwrapped !== text && accepted.includes(unwrapped))
    return invalid({
      reason: 'not_in_form',
      message: 'Parentheses go around a polyatomic ion only when there is more than one of it, and never around a one-atom ion. Take out the extra parentheses.',
    })
  const right = (k: string) => accepted.includes(k)
  const slip = firstVariant(slips ?? formulaSlips(c, label, fromName), (k) => k === text, right)
  if (slip) return slip
  const rule = formulaRule(c, her.parts, her.waters)
  if (rule) return mistake(rule.id, rule.witness)
  return wrong(formulaWrong(c, label, her.text, parsed))
}

/** Grade her formula for a compound given by name. */
export function gradeFormulaFromName(name: string, herFormula: string): NmGrade {
  const p = readCompoundName(name)
  if (!p.ok) return unsupported(p.message)
  return gradeFormulaAnswer(p.compound, compoundName(p.compound), herFormula, true)
}

/** What each formula-writing slip produces for this name (null when outside the model). */
export function formulaFromNameMistakes(name: string): NmMistakeCandidate[] | null {
  const p = readCompoundName(name)
  if (!p.ok) return null
  const c = p.compound
  const accepted = acceptedFormulas(c)
  const slips = formulaSlips(c, compoundName(c), true)
  return candidatesOf(slips, (t) => gradeFormulaAnswer(c, compoundName(c), t, true, slips), (k) => accepted.includes(k))
}

function ionPair(cation: IonLike, anion: IonLike): { compound: Compound; label: string } | string {
  const cat = resolveIon(cation)
  const an = resolveIon(anion)
  const shown = (i: IonLike) => String(typeof i === 'string' ? i : i?.text)
  if (!cat || !an) return `${shown(!cat ? cation : anion)} is not an ion of the model.`
  const problem = ionPairProblem(cat, an)
  if (problem) return problem
  return { compound: ionicCompound(cat, an), label: `${ionDisplay(cat)} and ${ionDisplay(an)}` }
}

/** Grade her formula for the compound of a cation and an anion ('Fe3+', 'SO4 2-', names, or NmIons). */
export function gradeIonicFormula(cation: IonLike, anion: IonLike, herFormula: string): NmGrade {
  const p = ionPair(cation, anion)
  if (typeof p === 'string') return unsupported(p)
  return gradeFormulaAnswer(p.compound, p.label, herFormula, false)
}

/** What each slip produces for the formula of a cation and an anion (null when outside the model). */
export function ionicFormulaMistakes(cation: IonLike, anion: IonLike): NmMistakeCandidate[] | null {
  const p = ionPair(cation, anion)
  if (typeof p === 'string') return null
  const accepted = acceptedFormulas(p.compound)
  const slips = formulaSlips(p.compound, p.label, false)
  return candidatesOf(slips, (t) => gradeFormulaAnswer(p.compound, p.label, t, false, slips), (k) => accepted.includes(k))
}

// --- single ions -------------------------------------------------------------------------------------

function ionProblem(ion: IonLike): NmIon | string {
  const found = resolveIon(ion)
  return found ?? `${typeof ion === 'string' ? ion : ion?.text} is not an ion of the model.`
}

/** Grade her name for an ion given by its formula ('SO4 2-', 'Fe3+'). "sulfate ion" is accepted like "sulfate". */
export function gradeIonName(ion: IonLike, herName: string): NmGrade {
  const I = ionProblem(ion)
  if (typeof I === 'string') return unsupported(I)
  const raw = herName ?? ''
  if (raw.trim() !== '' && looksLikeFormula(raw))
    return invalid({ reason: 'not_in_form', message: 'This question asks for the name of the ion, written in words. You typed a formula.', position: 0, length: raw.length })
  const r = readName(raw)
  if (!r.ok) return invalid(r.error)
  const key = r.value.key.replace(/ ion$/, '')
  const right = [I.name, ...I.otherNames].map(nameKey)
  const label = ionDisplay(I)
  if (right.includes(key)) return correct(`Correct: ${label} is ${I.role === 'cation' && I.kind === 'monatomic' ? `the ${I.name} ion` : I.name}.`)
  const slip = firstVariant(ionNameSlips(I), (k) => k === key, (k) => right.includes(k))
  if (slip) return slip
  const hint =
    I.kind === 'polyatomic'
      ? ' Its name is in the polyatomic ion table.'
      : I.role === 'cation'
        ? ' A one-atom cation is named after its element.'
        : ' A one-atom anion is named from its element, with the ending -ide.'
  return wrong(`That is not the name of ${label}.${hint}`)
}

export function ionNameMistakes(ion: IonLike): NmMistakeCandidate[] | null {
  const I = resolveIon(ion)
  if (!I) return null
  const right = [I.name, ...I.otherNames].map(nameKey)
  return candidatesOf(ionNameSlips(I), (t) => gradeIonName(I, t), (k) => right.includes(k))
}

const ionText = (formula: string, charge: number) => `${formula}^${chargeText(charge)}`

/** The slips for writing an ion's formula (keys are reading texts: 'NO2^-'). */
function ionFormulaSlips(I: NmIon): Slip[] {
  const slips: Slip[] = []
  const add = (id: NmMistakeId, text: string, witness: string) => {
    const last = slips[slips.length - 1]
    const v = { text, key: text, witness }
    if (last && last.id === id) last.variants.push(v)
    else slips.push({ id, variants: [v] })
  }
  if (I.formula === 'Hg2') add('nm_unit_ion_reduced', 'Hg^+', 'Your ion is a single mercury atom. Mercury(I) is two mercury atoms that stay together as one ion and share a 2+ charge.')
  if (I.formula === 'O2') {
    add('nm_unit_ion_reduced', 'O^2-', 'O²⁻ is oxide, one oxygen atom. Peroxide is two oxygen atoms bonded into one ion, with a 2− charge in all.')
    add('nm_unit_ion_reduced', 'O^-', 'Your ion splits peroxide in half. Peroxide is two oxygen atoms that stay together as one ion, with a 2− charge in all.')
  }
  const ide = ideSlipIon(I)
  if (ide) add('nm_ide_for_polyatomic', ide.text, `${ionDisplay(ide)} is ${ide.name}, a one-atom ion. ${capitalized(I.name)} is a polyatomic ion with oxygen in it.`)
  for (const s of hydrogenSiblings(I))
    add('nm_hydrogen_prefix_wrong', s.text, `${ionDisplay(s)} is ${s.name}. The name ${I.name} says how many H atoms the ion carries.`)
  if (I.kind === 'polyatomic' && I.formula !== 'O2' && I.formula !== 'Hg2') {
    const shown = [ateItePartner(I), ...perHypoVariants(I)].filter((v): v is NmIon => v !== null)
    for (const v of shown)
      add(
        'nm_polyatomic_formula_wrong',
        ionText(v.formula, I.charge),
        `${fd(v.formula)} is ${v.name}, not ${I.name}.${ateItePartner(I)?.text === v.text ? ' -ate has one more oxygen than -ite.' : ' per- means one oxygen more than -ate, and hypo- one fewer than -ite.'}`,
      )
    if (I.formula === 'NH4') add('nm_polyatomic_formula_wrong', ionText('NH3', 1), 'NH₃ is ammonia, a molecule. The ammonium ion has its own formula in the table.')
  }
  const reps =
    I.numeral !== null
      ? otherChargesOf(I).filter((o) => o.formula === I.formula).map((o) => o.charge)
      : [Math.abs(I.charge) > 1 ? Math.sign(I.charge) : 2 * Math.sign(I.charge)]
  for (const q of reps) add('nm_ion_charge_wrong', ionText(I.formula, q), chargeWitness(I, q))
  return slips
}

function chargeWitness(I: NmIon, q: number): string {
  return I.numeral !== null
    ? `Your ion has a ${chargeWords(q)} charge, but the Roman numeral in ${I.name} is the charge itself.`
    : `Your ion has a ${chargeWords(q)} charge, but ${I.name} has a different one: an ion’s charge comes with its formula in the table.`
}

/** The same elements in the same order as one of the ion's formulas (other counts allowed). */
function sameSymbolsAs(parts: readonly FormulaPart[], I: NmIon): 'same' | 'symbols' | null {
  if (parts.some((p) => p.type !== 'element')) return null
  const mine = flatAtoms(parts)
  for (const f of [I.formula, ...I.otherFormulas]) {
    const s = simpleParts(f)
    if (s.length !== mine.length || !s.every((p, i) => p.symbol === mine[i]![0])) continue
    return s.every((p, i) => p.count === mine[i]![1]) ? 'same' : 'symbols'
  }
  return null
}

/** Grade her formula (with its charge) for an ion given by name ('sulfate', 'iron(III)') or formula. */
export function gradeIonFormula(ion: IonLike, herFormula: string): NmGrade {
  const I = ionProblem(ion)
  if (typeof I === 'string') return unsupported(I)
  const raw = herFormula ?? ''
  const parsed = readIon(raw)
  if (!parsed.ok && looksLikeName(raw))
    return invalid({ reason: 'not_in_form', message: 'This question asks for the formula of the ion, with its charge, not its name.', position: 0, length: raw.length })
  if (!parsed.ok) return invalid(parsed.error)
  const readings: IonReading[] = parsed.value
  if (readings.every((x) => x.charge === null))
    return invalid({ reason: 'not_in_form', message: 'An ion’s formula includes its charge: write it after the formula, with ^ or as a superscript.' })
  if (readings.some((x) => ionOfReading(x)?.text === I.text)) return correct(`Correct: ${I.name} is ${ionDisplay(I)}.`)
  const rights = [I.formula, ...I.otherFormulas].map((f) => ionText(f, I.charge).toLowerCase())
  if (readings.some((x) => rights.includes(x.text.toLowerCase()))) return invalid({ reason: 'case', message: CASE_MESSAGE })
  const slip = firstVariant(ionFormulaSlips(I), (k) => readings.some((x) => x.text === k), () => false)
  if (slip) return slip
  for (const x of readings) {
    if (x.charge === null) continue
    const same = sameSymbolsAs(x.parts, I)
    if (same === 'same' && x.charge !== I.charge) return mistake('nm_ion_charge_wrong', chargeWitness(I, x.charge))
    if (same === 'symbols' && x.charge === I.charge && I.kind === 'polyatomic')
      return mistake('nm_polyatomic_formula_wrong', `${fd(partsText(x.parts))} is not the formula of ${I.name}: check the table for the number of each atom in the ion.`)
  }
  return wrong(
    I.kind === 'polyatomic'
      ? `That is not the formula of ${I.name}: check the table for its atoms and its charge.`
      : `That is not the formula of the ${I.name} ion: its symbol comes from the periodic table, and its charge from the element’s group or the Roman numeral.`,
  )
}

export function ionFormulaMistakes(ion: IonLike): NmMistakeCandidate[] | null {
  const I = resolveIon(ion)
  if (!I) return null
  return candidatesOf(ionFormulaSlips(I), (t) => gradeIonFormula(I, t), () => false)
}

// --- classify ----------------------------------------------------------------------------------------

const PICKS: Readonly<Record<string, CompoundClass>> = {
  ionic: 'ionic',
  'ionic compound': 'ionic',
  molecular: 'molecular',
  'molecular compound': 'molecular',
  'binary molecular': 'molecular',
  'binary molecular compound': 'molecular',
  covalent: 'molecular',
  'covalent compound': 'molecular',
  acid: 'acid',
  'an acid': 'acid',
  hydrate: 'hydrate',
  'a hydrate': 'hydrate',
}

const classPhrase = (k: CompoundClass) => (k === 'acid' ? 'an acid' : k === 'hydrate' ? 'a hydrate' : `${k === 'ionic' ? 'an ionic' : 'a molecular'} compound`)

function classReason(c: Compound): string {
  switch (c.kind) {
    case 'ionic':
      return `it is made of ions, ${ionDisplay(c.cation)} and ${ionDisplay(c.anion)}`
    case 'hydrate':
      return 'it is an ionic compound with water molecules in its crystals'
    case 'acid':
      return 'it is hydrogen with an anion, and in water it releases H⁺ ions'
    default:
      return 'its atoms are nonmetals that share electrons'
  }
}

/** Grade her pick ('ionic', 'molecular', 'acid', 'hydrate'; 'ionic compound', 'covalent' … accepted) for a formula. */
export function gradeClassify(formula: string, herPick: string, options: FormulaProblemOptions = {}): NmGrade {
  const p = formulaProblem(formula, options)
  if (typeof p === 'string') return unsupported(p)
  const pick = PICKS[(herPick ?? '').trim().toLowerCase().replace(/\s+/g, ' ')]
  if (!pick) return invalid({ reason: 'unreadable', message: 'Pick one: ionic, molecular, acid or hydrate.' })
  const c = p.compound
  const right = compoundClass(c)
  if (pick === right || (c.kind === 'hydrogen' && pick === 'acid'))
    return correct(
      c.kind === 'hydrogen' && pick === 'acid'
        ? `Correct: dissolved in water, ${p.label} is an acid. Written without (aq), it is a molecular compound.`
        : `Correct: ${p.label} is ${classPhrase(right)}: ${classReason(c)}.`,
    )
  if (c.kind === 'ionic' && c.cation.formula === 'NH4' && pick === 'molecular')
    return mistake('nm_class_ammonium_molecular', `${p.label} has no metal, but NH₄⁺ is a polyatomic cation: a compound made of ions is ionic even when every element in it is a nonmetal.`)
  if (c.kind === 'hydrate' && pick === 'ionic')
    return mistake('nm_class_hydrate_ignored', `${p.label} is an ionic compound with water in its crystals: the ·${c.waters === 1 ? '' : c.waters}H₂O part makes it a hydrate.`)
  if (c.kind === 'acid' && (pick === 'molecular' || pick === 'ionic'))
    return mistake(
      'nm_class_acid_ignored',
      pick === 'ionic'
        ? `${p.label} starts with H, not a metal: hydrogen with an anion, dissolved in water, is an acid.`
        : `${p.label} is hydrogen with an anion${c.binary ? ', dissolved in water' : ''}: in water it releases H⁺ ions, which makes it an acid.`,
    )
  return wrong(
    `${p.label} is not ${classPhrase(pick)}. Look at what it is made of: a metal ion or NH₄⁺ makes it ionic, two nonmetals make it molecular, H with an anion in water makes it an acid, and water after a dot makes it a hydrate.`,
  )
}

export function classifyMistakes(formula: string, options: FormulaProblemOptions = {}): NmMistakeCandidate[] | null {
  const p = formulaProblem(formula, options)
  if (typeof p === 'string') return null
  const out: NmMistakeCandidate[] = []
  for (const pick of ['molecular', 'ionic'] as const) {
    const g = gradeClassify(formula, pick, options)
    if (g.verdict === 'mistake' && !out.some((o) => o.id === g.mistake)) out.push({ id: g.mistake, text: pick, witness: g.witness, shadows: [] })
  }
  return out
}
