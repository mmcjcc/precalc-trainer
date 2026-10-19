/**
 * Building one nomenclature part from its check: the engine gives the answer (its getters), every accepted form,
 * the candidates (what each slip produces for THIS problem) and the worked explanation. Nothing here is typed
 * by hand except the wording around it.
 */
import {
  acceptedFormulas,
  classifyMistakes,
  classOfFormula,
  compoundName,
  compoundOfFormula,
  compoundOfName,
  explainClassify,
  explainFormulaFromName,
  explainIon,
  explainIonicFormula,
  explainNameFromFormula,
  formulaDisplay,
  formulaFromNameMistakes,
  formulaOfName,
  ionFormulaMistakes,
  ionicCompound,
  ionicFormula,
  ionicFormulaMistakes,
  ionNameMistakes,
  nameFromFormulaMistakes,
  nameOfFormula,
  nmIon,
  systematicName,
  type Compound,
  type IonicCompound,
  type NmMistakeCandidate,
} from '@/engine'
import type { NmCheck, NmPartKind, NmStage, NmStageId, RuleCardId } from '@/content/types'
import { formulasOf } from './leaks'

/** The four kinds a classify part offers, in a fixed order (choice id = the engine's pick). */
export const CLASS_CHOICES: readonly { id: string; text: string }[] = [
  { id: 'ionic', text: 'ionic compound' },
  { id: 'molecular', text: 'molecular compound' },
  { id: 'acid', text: 'acid' },
  { id: 'hydrate', text: 'hydrate' },
]

export interface PartDraft {
  kind: NmStage['kind']
  part: NmPartKind
  label: string
  hint: string
  nudge: string
  ruleCard: RuleCardId
  check: NmCheck
}

function ionicNames(c: IonicCompound): string[] {
  const out: string[] = []
  for (const cn of [c.cation.name, ...c.cation.otherNames]) for (const an of [c.anion.name, ...c.anion.otherNames]) out.push(`${cn} ${an}`)
  return out
}

/** Every right name of a compound as she might type it (aliases in their own words: bicarbonate, dimercury, nickel). */
export function acceptedNames(c: Compound): string[] {
  switch (c.kind) {
    case 'ionic':
      return ionicNames(c)
    case 'hydrate': {
      const water = compoundName(c).split(' ').pop()!
      return ionicNames(c.salt).map((n) => `${n} ${water}`)
    }
    case 'molecular': {
      const sys = systematicName(c)
      return sys ? [compoundName(c), sys] : [compoundName(c)]
    }
    default:
      return [compoundName(c)]
  }
}

/** The other forms: each distinct text once, the answer's own text left out (an alias spelled differently stays). */
function others(list: readonly string[], answer: string): string[] {
  return [...new Set(list)].filter((item) => item !== answer)
}

export interface BuiltPart {
  answerText: string
  answerDisplay: string
  accept: string[]
  reveal: string[]
  traps: NmMistakeCandidate[]
}

function needCandidates(list: NmMistakeCandidate[] | null, where: string): NmMistakeCandidate[] {
  if (!list) throw new Error(`${where}: the engine has no candidates (outside the model)`)
  return list
}

const PART_CACHE = new Map<string, BuiltPart>()

/**
 * The engine's answer, accepted forms, candidates and explanation for one check. Many seeds draw the same
 * compound, so each check is worked out once (the result depends on the check alone).
 */
export function buildPart(check: NmCheck): BuiltPart {
  const key = JSON.stringify(check)
  let built = PART_CACHE.get(key)
  if (!built) {
    built = buildPartUncached(check)
    PART_CACHE.set(key, built)
  }
  return built
}

function buildPartUncached(check: NmCheck): BuiltPart {
  switch (check.kind) {
    case 'ion_name': {
      const ion = nmIon(check.ion)
      return {
        answerText: ion.name,
        answerDisplay: ion.name,
        accept: [...ion.otherNames],
        reveal: explainIon(ion).steps,
        traps: needCandidates(ionNameMistakes(ion), ion.text),
      }
    }
    case 'ion_formula': {
      const ion = nmIon(check.ion)
      const charge = ion.text.slice(ion.text.indexOf('^'))
      return {
        answerText: ion.text,
        answerDisplay: formulaDisplay(ion.text),
        accept: ion.otherFormulas.map((f) => `${f}${charge}`),
        reveal: explainIon(ion).steps,
        traps: needCandidates(ionFormulaMistakes(ion), ion.name),
      }
    }
    case 'ionic_formula': {
      const formula = ionicFormula(check.cation, check.anion)
      const c = ionicCompound(nmIon(check.cation), nmIon(check.anion))
      return {
        answerText: formula,
        answerDisplay: formulaDisplay(formula),
        accept: others(acceptedFormulas(c), formula),
        reveal: explainIonicFormula(check.cation, check.anion).steps,
        traps: needCandidates(ionicFormulaMistakes(check.cation, check.anion), `${check.cation} + ${check.anion}`),
      }
    }
    case 'name': {
      const options = { inWater: check.inWater === true }
      const name = nameOfFormula(check.formula, options)
      const c = compoundOfFormula(check.formula, options)!
      return {
        answerText: name,
        answerDisplay: name,
        accept: others(acceptedNames(c), name),
        reveal: explainNameFromFormula(check.formula, options).steps,
        traps: needCandidates(nameFromFormulaMistakes(check.formula, options), check.formula),
      }
    }
    case 'formula': {
      const formula = formulaOfName(check.name)
      const c = compoundOfName(check.name)!
      return {
        answerText: formula,
        answerDisplay: formulaDisplay(formula),
        accept: others(formulasOf(c), formula),
        reveal: explainFormulaFromName(check.name).steps,
        traps: needCandidates(formulaFromNameMistakes(check.name), check.name),
      }
    }
    case 'classify': {
      const options = { inWater: check.inWater === true }
      const cls = classOfFormula(check.formula, options)
      return {
        answerText: cls,
        answerDisplay: CLASS_CHOICES.find((c) => c.id === cls)!.text,
        accept: [],
        reveal: explainClassify(check.formula, options).steps,
        traps: needCandidates(classifyMistakes(check.formula, options), check.formula),
      }
    }
  }
}

/** One finished part. */
export function stageOf(id: NmStageId, draft: PartDraft): NmStage {
  const built = buildPart(draft.check)
  const choices =
    draft.kind === 'choice'
      ? CLASS_CHOICES.map((choice) => {
          const trap = built.traps.find((t) => t.text === choice.id)
          return trap ? { id: choice.id, text: choice.text, trap: trap.id, witness: trap.witness } : { ...choice }
        })
      : undefined
  return {
    id,
    kind: draft.kind,
    part: draft.part,
    label: draft.label,
    hint: draft.hint,
    answerText: built.answerText,
    answerDisplay: built.answerDisplay,
    accept: [...built.accept],
    ...(choices ? { choices } : {}),
    nudge: draft.nudge,
    ruleCard: draft.ruleCard,
    reveal: [...built.reveal],
    traps: built.traps.map((t) => ({ id: t.id, text: t.text, witness: t.witness })),
    check: { ...draft.check },
  }
}
