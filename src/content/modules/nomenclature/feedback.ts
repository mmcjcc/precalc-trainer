/**
 * What the screen shows for a grade, while she can still act on it. Grading is the engine's; this file only makes
 * sure nothing shown before she finishes gives the part's answer away:
 *
 *  - a named mistake shows the catalog's title, lesson and example line and the engine's sentence about her
 *    answer. A lesson sentence that shows the answer is cut to its general part (the words before a colon) or
 *    dropped; a title or sentence that shows it is replaced by this file's wording for that slip;
 *  - the example line is the catalog's when it contains no answer the templates can generate for that kind of
 *    part and not this part's deciding piece; otherwise the first of this file's examples that passes the same
 *    test, built from ions and compounds no template asks about; otherwise none. A single-ion part only shows an
 *    example about another single ion (a compound in an example would print the ion's formula);
 *  - a plain wrong or not-an-attempt message that shows the answer is replaced by a general one.
 *
 * Classify parts always use this file's wording: the catalog's three class entries, and the engine's sentences
 * for them, name the right kind of compound, which on a four-way choice is the answer.
 */
import { ERROR_PATTERNS, formulaDisplay, resolveIon, type NmGrade, type NmMistakeId } from '@/engine'
import type { NmPartKind, NmStage } from '@/content/types'
import { leaksTo, stageKeys, type PartKeys } from './leaks'
import { showsAnyAnswer } from './universe'

/**
 * Example lines for compound, acid and classify parts, for when the catalog's would show an answer. Each uses only
 * what no template asks about there: cesium, beryllium and gold compounds, selenium species, iodine oxides, the
 * name of phosphorous acid, sodium thiosulfate, ammonium iodide (the tests check each against every answer).
 */
export const NM_EXAMPLES: Readonly<Partial<Record<NmMistakeId, readonly string[]>>> = {
  nm_charges_unbalanced: ['gold(III) chloride: AuCl₂ ✗ (3+ and 2−) → AuCl₃'],
  nm_not_lowest_ratio: ['beryllium oxide: Be₂O₂ ✗ → BeO'],
  nm_parentheses_missing: ['beryllium nitrate: BeNO₃₂ ✗ → Be(NO₃)₂'],
  nm_crisscross_reversed: ['beryllium nitride (Be²⁺, N³⁻): Be₂N₃ ✗ → Be₃N₂', 'cesium selenide (Cs⁺, Se²⁻): CsSe₂ ✗ → Cs₂Se'],
  nm_numeral_as_subscript: ['gold(III) chloride: Au₃Cl ✗ → AuCl₃'],
  nm_unit_ion_reduced: ['cesium peroxide: CsO ✗ → Cs₂O₂'],
  nm_polyatomic_formula_wrong: ['cesium nitrate: CsNO₂ ✗ → CsNO₃'],
  nm_anion_first: ['SeCs₂ ✗ → Cs₂Se;  selenide cesium ✗ → cesium selenide'],
  nm_prefix_on_ionic: ['BeCl₂: beryllium dichloride ✗ → beryllium chloride'],
  nm_numeral_missing: ['AuCl₃: gold chloride ✗ → gold(III) chloride'],
  nm_numeral_wrong: ['AuCl₃: gold(I) chloride ✗ → gold(III) chloride'],
  nm_numeral_on_fixed: ['CsF: cesium(I) fluoride ✗ → cesium fluoride'],
  nm_ide_for_polyatomic: ['CsNO₃: cesium nitride ✗ → cesium nitrate', 'Cs₂CO₃: cesium carbide ✗ → cesium carbonate'],
  nm_ate_ite_swapped: ['Cs₂SO₄: cesium sulfite ✗ → cesium sulfate'],
  nm_per_hypo_wrong: ['CsClO: cesium chlorite ✗ → cesium hypochlorite'],
  nm_element_name_for_anion: ['CsI: cesium iodine ✗ → cesium iodide'],
  nm_hydrogen_prefix_wrong: ['CsHCO₃: cesium carbonate ✗ → cesium hydrogen carbonate'],
  nm_prefix_missing: ['I₂O₅: iodine oxide ✗ → diiodine pentoxide'],
  nm_mono_on_first: ['SeO₃: monoselenium trioxide ✗ → selenium trioxide'],
  nm_molecular_reduced: ['diiodine tetroxide: IO₂ ✗ → I₂O₄'],
  nm_stock_on_molecular: ['I₂O₅: iodine(V) oxide ✗ → diiodine pentoxide'],
  nm_hydro_on_oxyacid: ['H₂SeO₄: hydroselenic acid ✗ → selenic acid'],
  nm_hydro_missing: ['H₂Se(aq): selenic acid ✗ → hydroselenic acid'],
  nm_ic_ous_swapped: ['H₂SeO₃: selenic acid ✗ → selenous acid'],
  nm_acid_root: ['H₃PO₃: phosphous acid ✗ → phosphorous acid'],
  nm_acid_named_as_salt: ['H₂Se(aq): hydrogen selenide ✗ → hydroselenic acid'],
  nm_acid_anion_ending: ['H₂SeO₄: selenate acid ✗ → selenic acid'],
  nm_hydrate_count_wrong: ['Na₂S₂O₃·5H₂O: sodium thiosulfate tetrahydrate ✗ → sodium thiosulfate pentahydrate'],
  nm_class_ammonium_molecular: ['NH₄I named with prefixes ✗ → NH₄⁺ is a cation: name its ions'],
  nm_class_hydrate_ignored: ['Na₂S₂O₃·5H₂O named as Na₂S₂O₃ ✗ → name the ·5H₂O too'],
  nm_class_acid_ignored: ['H₂Se(aq) named with prefixes ✗ → H first, in water: name it from its anion'],
}

/** Example lines for single-ion parts: another ion, one no template asks about (gold, cesium, silicate, bromate, selenide). */
export const NM_ION_EXAMPLES: Readonly<Partial<Record<NmMistakeId, readonly string[]>>> = {
  nm_numeral_missing: ['Au³⁺: gold ✗ → gold(III)'],
  nm_numeral_wrong: ['Au⁺: gold(III) ✗ → gold(I)'],
  nm_numeral_on_fixed: ['Cs⁺: cesium(I) ✗ → cesium'],
  nm_ide_for_polyatomic: ['SiO₃²⁻: silicide ✗ → silicate'],
  nm_ate_ite_swapped: ['BrO₃⁻: bromite ✗ → bromate'],
  nm_per_hypo_wrong: ['BrO⁻: bromite ✗ → hypobromite'],
  nm_element_name_for_anion: ['Se²⁻: selenium ✗ → selenide'],
  nm_hydrogen_prefix_wrong: ['HSe⁻: selenide ✗ → hydrogen selenide'],
  nm_polyatomic_formula_wrong: ['silicate: SiO₂²⁻ ✗ → SiO₃²⁻'],
  nm_ion_charge_wrong: ['silicate: SiO₃⁻ ✗ → SiO₃²⁻', 'gold(III): Au⁺ ✗ → Au³⁺'],
}

/** Titles for the slips whose catalog title can show the answer (a single ion's formula; the four kinds). */
const SAFE_TITLE: Readonly<Partial<Record<NmMistakeId, string>>> = {
  nm_unit_ion_reduced: 'Two-atom ions stay whole',
  nm_class_ammonium_molecular: 'Ammonium is a cation',
  nm_class_hydrate_ignored: 'The water after the dot counts',
  nm_class_acid_ignored: 'H first, dissolved in water',
}

/** Lessons for when nothing of the catalog's is left after the sentences that show the answer are cut. */
const SAFE_LESSON: Readonly<Partial<Record<NmMistakeId, string>>> = {
  nm_unit_ion_reduced: 'Some ions are two atoms bonded together, with one charge for the pair. The 2 inside belongs to the ion, so it is never divided out or split.',
  nm_class_ammonium_molecular:
    'NH₄⁺ is a polyatomic cation, so a compound with it is made of ions even when every element in it is a nonmetal. It is named like a metal compound: the cation first, then the anion, with no prefixes.',
  nm_class_hydrate_ignored: 'A formula that ends in a dot and water has water molecules held in its crystals. The water is part of the compound, and the name counts it with a Greek prefix.',
  nm_class_acid_ignored: 'A formula that starts with H, with an anion, releases H⁺ ions in water. With (aq), or with an anion that has oxygen, it is named from the anion’s ending: -ide, -ate or -ite.',
}

const CLASS_IDS: ReadonlySet<NmMistakeId> = new Set(['nm_class_ammonium_molecular', 'nm_class_hydrate_ignored', 'nm_class_acid_ignored'])

const ION_PARTS: ReadonlySet<NmPartKind> = new Set(['ion-name', 'ion-formula'])

function labelOf(stage: NmStage): string {
  const check = stage.check
  return check.kind === 'classify' || check.kind === 'name' ? formulaDisplay(check.formula) : ''
}

/** A sentence about her answer for when the engine's would show the answer. */
function safeWitness(id: NmMistakeId, stage: NmStage): string {
  const label = labelOf(stage)
  const check = stage.check
  switch (id) {
    case 'nm_class_ammonium_molecular':
      return `${label} has no metal, but NH₄⁺ is a polyatomic cation: the compound is made of ions, so it is not named with prefixes.`
    case 'nm_class_hydrate_ignored':
      return `${label} is made of ions, but the water after the dot is part of it too: water molecules held in its crystals.`
    case 'nm_class_acid_ignored':
      return check.kind === 'classify' && /\(aq\)$/.test(check.formula)
        ? `${label} starts with H and is dissolved in water: there it releases H⁺ ions, so it is named from its anion.`
        : `${label} starts with H, with an anion that has oxygen: it releases H⁺ ions in water, so it is named from its anion.`
    case 'nm_numeral_on_fixed': {
      const ion = check.kind === 'ion_name' ? resolveIon(check.ion) : null
      return ion?.kind === 'polyatomic'
        ? 'This ion has only one charge, so its name never takes a Roman numeral. The numeral is only for metals with more than one charge.'
        : 'This metal forms only one ion, so its name never takes a Roman numeral. The numeral is only for metals with more than one charge.'
    }
    default:
      return 'Your answer has the slip named above. Look at the rule card, then try this part again.'
  }
}

/** A lesson with every sentence that shows the answer cut to its general part (before a colon) or dropped. */
export function safeLesson(lesson: string, keys: PartKeys, herText?: string): string {
  const kept: string[] = []
  for (const sentence of lesson.split(/(?<=\.)\s+/)) {
    if (!leaksTo(sentence, keys, herText)) {
      kept.push(sentence)
      continue
    }
    const colon = sentence.indexOf(':')
    if (colon > 0) {
      const head = `${sentence.slice(0, colon).trim()}.`
      if (!leaksTo(head, keys, herText)) kept.push(head)
    }
  }
  return kept.join(' ')
}

const EXAMPLE_CACHE = new Map<string, readonly string[]>()

/** The example lines this slip can show on this kind of part at all (none contains an answer of that kind), best first. */
export function examplesFor(id: NmMistakeId, part: NmPartKind): readonly string[] {
  const cacheKey = `${id}|${part}`
  let list = EXAMPLE_CACHE.get(cacheKey)
  if (!list) {
    const candidates = ION_PARTS.has(part) ? (NM_ION_EXAMPLES[id] ?? []) : [...(CLASS_IDS.has(id) ? [] : [ERROR_PATTERNS[id].example]), ...(NM_EXAMPLES[id] ?? [])]
    list = candidates.filter((e) => e && !showsAnyAnswer(e, part))
    EXAMPLE_CACHE.set(cacheKey, list)
  }
  return list
}

/** The example line to show for this slip on this part: '' when none is safe. */
export function exampleFor(id: NmMistakeId, stage: NmStage, herText?: string, keys: PartKeys = stageKeys(stage)): string {
  return examplesFor(id, stage.part).find((e) => !leaksTo(e, keys, herText)) ?? ''
}

export type NmShown =
  | { kind: 'correct'; message: string }
  | { kind: 'mistake'; id: NmMistakeId; title: string; lesson: string; witness: string; example: string }
  | { kind: 'wrong'; message: string }
  | { kind: 'invalid'; message: string; position?: number; length?: number }

/** Not-an-attempt messages for when the engine's would show the answer (its case note names CO, Co and the like). */
const INVALID_FALLBACK: Readonly<Record<'unreadable' | 'case' | 'not_in_form', string>> = {
  case: 'Check the capital letters: each element symbol starts with a capital letter, and a second letter is lowercase.',
  not_in_form: 'This is not written in the form the question asks for.',
  unreadable: 'This could not be read. Check what you typed and try again.',
}

/**
 * A reader's or grader's note about her text (shown under the box as she types, or as not-an-attempt), or a general
 * one when the note would show this part's answer: the engine's case note names Co and CO, the answer to "carbon
 * monoxide".
 */
export function safeNote(stage: NmStage, message: string, reason: 'unreadable' | 'case' | 'not_in_form', herText = ''): string {
  if (stage.part === 'class') return 'Choose one of the four kinds.'
  return leaksTo(message, stageKeys(stage), herText) ? INVALID_FALLBACK[reason] : message
}

function classifyWrong(label: string): string {
  return `Look at what ${label} is made of, and check in order: water written after a dot, H written first and dissolved in water, a metal ion or NH₄⁺ with an anion, or only nonmetals sharing electrons.`
}

/**
 * What the screen shows for a grade of this part, given what she typed (her own words quoted back give nothing
 * away). The grade itself is recorded unchanged.
 */
export function nmShown(stage: NmStage, grade: NmGrade, herText = ''): NmShown {
  const keys = stageKeys(stage)
  const shows = (text: string) => leaksTo(text, keys, herText)
  switch (grade.verdict) {
    case 'correct':
      return { kind: 'correct', message: grade.message }
    case 'unsupported':
      return { kind: 'invalid', message: 'This problem cannot be checked. Pick another one from the module page.' }
    case 'invalid': {
      const message = safeNote(stage, grade.message, grade.reason, herText)
      return {
        kind: 'invalid',
        message,
        ...(grade.position !== undefined ? { position: grade.position } : {}),
        ...(grade.length !== undefined ? { length: grade.length } : {}),
      }
    }
    case 'wrong':
      if (stage.part === 'class') return { kind: 'wrong', message: classifyWrong(labelOf(stage)) }
      return { kind: 'wrong', message: shows(grade.message) ? 'That is not this part’s answer. Look at the rule card, then try again.' : grade.message }
    case 'mistake': {
      const id = grade.mistake
      const info = ERROR_PATTERNS[id]
      const classSlip = CLASS_IDS.has(id)
      const title = classSlip || shows(info.title) ? (SAFE_TITLE[id] ?? 'Look at this part again') : info.title
      let lesson = classSlip ? '' : safeLesson(info.lesson, keys, herText)
      const fallback = SAFE_LESSON[id]
      if (!lesson && fallback && !shows(fallback)) lesson = fallback
      const witness = classSlip || shows(grade.witness) ? safeWitness(id, stage) : grade.witness
      return { kind: 'mistake', id, title, lesson, witness, example: exampleFor(id, stage, herText, keys) }
    }
  }
}
