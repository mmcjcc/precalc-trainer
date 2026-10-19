import type { ExpModelsAnswer, ExpModelsStageId } from '@/content/types'
import { compileExpr, evaluateExpr, logValue, parseExpression } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { roundPlaces } from '../explog/text'

export type EmGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

export const EM_KEYS: Record<ExpModelsStageId, string> = {
  answer: 'answer',
  exact_k: 'exact_k',
  rounded_k: 'rounded_k',
  followup: 'followup',
}

function correct(message: string): EmGrade {
  return { verdict: 'correct', message }
}

function mistake(id: ErrorPatternId, witness: string): EmGrade {
  return { verdict: 'mistake', mistake: id, witness }
}

function wrong(message: string): EmGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): EmGrade {
  return { verdict: 'invalid', message }
}

function cleanModelInput(raw: string, isMoney?: boolean): string {
  let s = raw.trim()
  if (!s) return ''
  s = s.replace(/^[AthkP]\s*=\s*/i, '').trim()
  if (isMoney) {
    s = s.replace(/^\$\s*/, '').replace(/\s*dollars?$/i, '').trim()
  }
  // Strip thousands commas inside digit groups (e.g. 2,834.71 -> 2834.71) without touching log(a, b).
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
  }
  s = s
    .replace(/\s*(?:years?|yrs?|days?|hours?|hrs?|minutes?|mins?|g|mg|grams?|bacteria|cells|people|%)\.?$/i, '')
    .trim()
  return s
}

export function evalModelValue(cleaned: string): number | null {
  if (!cleaned) return null
  const lv = logValue(cleaned)
  if (lv && Number.isFinite(lv.value)) return lv.value
  const parsed = parseExpression(cleaned, [])
  if (!parsed.ok) return null
  try {
    const fn = compileExpr(parsed.node)
    const val = evaluateExpr(fn, {})
    return Number.isFinite(val) ? val : null
  } catch {
    return null
  }
}

export function gradeExpModelsStage(answer: ExpModelsAnswer, stageId: ExpModelsStageId, raw: string): EmGrade {
  const stage = answer.stages.find((s) => s.id === stageId)
  if (!stage) return invalid('Unknown stage.')
  const cleaned = cleanModelInput(raw, stage.isMoney)
  if (!cleaned) return invalid('Type your answer first.')

  const val = evalModelValue(cleaned)
  if (val === null) {
    return invalid('Enter a number or an exact mathematical expression.')
  }

  // Exact expression stage (e.g. exact_k = ln(P1/P0)/t)
  if (stage.places === undefined) {
    const hasLog = /l(?:n|og)/i.test(cleaned)
    const exactTol = 1e-9 * Math.max(1, Math.abs(stage.exactValue))
    if (hasLog && Math.abs(val - stage.exactValue) <= exactTol) {
      return correct('The exact growth rate constant is right.')
    }
    // Check named traps (including exp_growth_no_log which has no log).
    for (const trap of stage.traps) {
      const trapTol = 1e-6 * Math.max(1, Math.abs(trap.value))
      if (Math.abs(val - trap.value) <= trapTol) {
        return mistake(trap.id, trap.witness)
      }
    }
    if (!hasLog && Math.abs(val - stage.exactValue) <= 5e-3) {
      return invalid('Give the exact expression using ln, such as ln(a)/t, before rounding in the next part.')
    }
    return wrong('That does not equal the exact rate constant k.')
  }

  // Numeric / rounded stage: accepts any equal exact expression OR any value within 0.5 ulp of the requested rounding place.
  const ulp = 0.5 * 10 ** -stage.places + 1e-9
  const exactTol = 1e-9 * Math.max(1, Math.abs(stage.exactValue))
  const roundedTarget = Number(roundPlaces(stage.exactValue, stage.places))

  if (
    Math.abs(val - stage.exactValue) <= ulp ||
    Math.abs(val - roundedTarget) <= ulp ||
    Math.abs(val - stage.exactValue) <= exactTol ||
    (stage.altExactValue !== undefined &&
      (Math.abs(val - stage.altExactValue) <= ulp ||
        Math.abs(val - Number(roundPlaces(stage.altExactValue, stage.places))) <= ulp))
  ) {
    return correct('That is right.')
  }

  for (const trap of stage.traps) {
    const trapRounded = Number(roundPlaces(trap.value, stage.places))
    const trapTol = Math.max(ulp, 1e-6 * Math.max(1, Math.abs(trap.value)))
    if (Math.abs(val - trap.value) <= trapTol || Math.abs(val - trapRounded) <= ulp) {
      return mistake(trap.id, trap.witness)
    }
  }

  return wrong('That value does not match the model.')
}

export function canonicalModelEntries(answer: ExpModelsAnswer): Record<string, string> {
  const out: Record<string, string> = {}
  for (const stage of answer.stages) {
    out[EM_KEYS[stage.id]] = stage.answerText
  }
  return out
}

export function emWork(answer: ExpModelsAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const val = entries[EM_KEYS[stage.id]]?.trim()
    if (val) lines.push(`${stage.label}: ${val}`)
  }
  return lines
}
