/**
 * Cards, hints and catalog examples stay on screen while she can still answer.
 * None of them may spell an answer that seed produces, including seed 1.
 * The sweep only generates: it does not grade again.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ProblemInstance, RuleCard } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import {
  CONDENSE_HINT,
  CONDENSE_NUDGE,
  CONVERT_HINT,
  CONVERT_NUDGE,
  DECIMAL_HINT,
  EQUATION_HINT,
  EQUATION_NUDGE,
  EXPAND_HINT,
  EXPAND_NUDGE,
  VALUE_HINT,
  VALUE_NUDGE,
  anyShows,
  numberForms,
} from './explog/text'
import { EE_RULES } from './expLogEquations/rules'
import { LF_RULES } from './logForms/rules'
import { LP_RULES } from './logProperties/rules'

const SWEEP = 2000
// Exponential equations are the slow generate. Beside the rest of the suite the sweep crosses two minutes.
const LOOP_TIMEOUT = 240_000

const SHARED = [VALUE_HINT, VALUE_NUDGE, CONVERT_HINT, CONVERT_NUDGE, DECIMAL_HINT, EXPAND_HINT, EXPAND_NUDGE, CONDENSE_HINT, CONDENSE_NUDGE, EQUATION_HINT, EQUATION_NUDGE]

function formsOf(p: ProblemInstance): string[] {
  const a = p.answer
  if (a.type === 'logForms') return a.question === 'value' ? numberForms(a.answerText) : [a.answerText, a.answerText.replace(/\s+/g, '')]
  if (a.type === 'logProperties') return [a.answerText]
  if (a.type === 'expLogEquations') return [a.answerText, ...a.accept]
  return []
}

function cardTexts(rules: readonly RuleCard[]): string[] {
  return rules.flatMap((rule) => [rule.title, rule.body, rule.example ?? ''])
}

describe.each([
  ['logForms', 'lf.value', LF_RULES, VALUE_HINT, VALUE_NUDGE],
  ['logForms', 'lf.convert', LF_RULES, CONVERT_HINT, CONVERT_NUDGE],
  ['logForms', 'lf.decimal', LF_RULES, DECIMAL_HINT, ''],
  ['logProperties', 'lp.expand', LP_RULES, EXPAND_HINT, EXPAND_NUDGE],
  ['logProperties', 'lp.condense', LP_RULES, CONDENSE_HINT, CONDENSE_NUDGE],
  ['expLogEquations', 'ee.exponential', EE_RULES, EQUATION_HINT, EQUATION_NUDGE],
  ['expLogEquations', 'ee.logarithmic', EE_RULES, EQUATION_HINT, EQUATION_NUDGE],
  ['expLogEquations', 'ee.quadratic', EE_RULES, EQUATION_HINT, EQUATION_NUDGE],
] as const)('%s/%s cards over 2000 seeds', (moduleId, templateId, rules, hint, nudge) => {
  it(
    'no rule card, format hint, nudge, or promised-trap example contains that problem’s answer',
    () => {
      const clashes: string[] = []
      const seed1 = generateProblem(moduleId, templateId, 1)
      const seed1Forms = formsOf(seed1)
      const unconditional = [...cardTexts(rules), hint, ...SHARED]
      if (anyShows(unconditional, seed1Forms)) clashes.push(`seed 1 ${templateId} ${seed1Forms.join(' | ')} is in a card or a shared hint`)
      for (let seed = 1; seed <= SWEEP; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const forms = formsOf(p)
        const a = p.answer
        const ownNudge = 'nudge' in a ? a.nudge : nudge
        const ownHint = 'formatHint' in a ? a.formatHint : hint
        const shown = [...cardTexts(rules), ownHint, ownNudge]
        if (anyShows(shown, forms)) clashes.push(`${templateId}/${seed} shown text contains ${forms[0]}`)
        if ('trap' in a && a.trap) {
          const example = ERROR_PATTERNS[a.trap as keyof typeof ERROR_PATTERNS]?.example ?? ''
          if (anyShows([example], forms)) clashes.push(`${templateId}/${seed} ${a.trap} example contains ${forms[0]}: ${example}`)
        }
        if (clashes.length > 12) break
      }
      expect(clashes).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})
