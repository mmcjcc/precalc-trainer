/**
 * Grades one part of a nomenclature problem with the engine's grader for the part's `check`. Her text goes to the
 * engine exactly as she typed it, so every spelling the engine accepts (case, spaces, aluminium, sulphate,
 * monooxide, bicarbonate, nickel without (II), HCl with or without (aq), CuSO4*5H2O, SO4 2-) is right here too.
 */
import {
  gradeClassify,
  gradeFormulaFromName,
  gradeIonFormula,
  gradeIonicFormula,
  gradeIonName,
  gradeNameFromFormula,
  NM_MISTAKE_IDS,
  type NmGrade,
  type NmMistakeId,
} from '@/engine'
import type { NmCheck, NmStageId, NomenclatureAnswer } from '@/content/types'

export type { NmGrade, NmMistakeId }
export { NM_MISTAKE_IDS }

/** Where each part's text is kept on the attempt (AttemptFinal.polyEntries). */
export const NM_KEYS: Record<NmStageId, string> = { a: 'a', b: 'b', c: 'c' }

/** The engine's grade of her text for one check. */
export function gradeCheck(check: NmCheck, text: string): NmGrade {
  switch (check.kind) {
    case 'ion_name':
      return gradeIonName(check.ion, text)
    case 'ion_formula':
      return gradeIonFormula(check.ion, text)
    case 'ionic_formula':
      return gradeIonicFormula(check.cation, check.anion, text)
    case 'name':
      return gradeNameFromFormula(check.formula, text, { inWater: check.inWater === true })
    case 'formula':
      return gradeFormulaFromName(check.name, text)
    case 'classify':
      return gradeClassify(check.formula, text, { inWater: check.inWater === true })
    default: {
      const never: never = check
      return never
    }
  }
}

/** Grade one part. A part that does not exist is not an attempt. */
export function gradeNmStage(answer: NomenclatureAnswer, stageId: NmStageId, text: string): NmGrade {
  const stage = answer.stages.find((s) => s.id === stageId)
  if (!stage) return { verdict: 'invalid', reason: 'unreadable', message: 'This part is not in the problem.' }
  return gradeCheck(stage.check, text)
}

/** Her parts as lines for the tutor: "Name: iron(III) sulfate". */
export function nmWork(answer: NomenclatureAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const value = entries[NM_KEYS[stage.id]]?.trim()
    if (!value) continue
    const shown = stage.kind === 'choice' ? (stage.choices?.find((c) => c.id === value)?.text ?? value) : value
    lines.push(`${stage.label}: ${shown}`)
  }
  return lines
}

/** A grade that is not an attempt: unreadable, the wrong case, the wrong form, or a problem outside the model. */
export function notAnAttempt(grade: NmGrade): boolean {
  return grade.verdict === 'invalid' || grade.verdict === 'unsupported'
}
