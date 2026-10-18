/**
 * Expand or condense a logarithm, one expression at a time, built from the seed.
 * `expandLog` / `condenseLog` supply the finished form; a draw is kept only when that form
 * really is finished and still equal to the start, and some wrong next line is a named slip.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, CanonicalStep, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { checkLogRewrite, condenseLog, expandLog, isExpandedLog, isSingleLog } from '@/engine'
import type { CalcPanels, PropertyTag, VarName } from '@/shared/types'
import {
  CONDENSE_HINT,
  CONDENSE_NUDGE,
  EXPAND_HINT,
  EXPAND_NUDGE,
  LogSkip,
  anyShows,
  catalogExample,
  ipow,
  searchSeed,
  staticTexts,
} from '../explog/text'
import { logSame } from '../explog/anchor'
import { LP_RULES, LP_RULE_IDS, lpRuleFor } from './rules'

export const LP_MODULE_ID = 'logProperties' as const

export type LogPropertiesAnswer = Extract<AnswerSpec, { type: 'logProperties' }>

const NO_GRAPH = { kind: 'none' as const }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }
const TAG: PropertyTag = 'simplify'

interface Drawn {
  expr: string
  vars: VarName[]
  path: string[]
  answer: string
  trap: string
  trapAnswer: string
}

function varsOf(expr: string): VarName[] {
  const vars: VarName[] = []
  if (/(?<![A-Za-z])x(?![A-Za-z])/.test(expr)) vars.push('x')
  if (/(?<![A-Za-z])y(?![A-Za-z])/.test(expr)) vars.push('y')
  if (/(?<![A-Za-z])n(?![A-Za-z])/.test(expr)) vars.push('n')
  return vars.length ? vars : ['x']
}

function accepted(prev: string, next: string, vars: readonly VarName[]): boolean {
  return checkLogRewrite(prev, next, { assumePositive: true, vars: [...vars] }).ok
}

function namedSlip(prev: string, next: string, vars: readonly VarName[]): string | null {
  const r = checkLogRewrite(prev, next, { assumePositive: true, vars: [...vars] })
  if (r.ok || !r.pattern) return null
  const id = r.pattern.id
  return id.startsWith('log_') && id !== 'log_check_answers' ? id : null
}

function pickSlip(expr: string, vars: readonly VarName[], answer: string, candidates: readonly string[]): { id: string; text: string } {
  const forms = [answer]
  const hint = staticTexts(LP_RULES, EXPAND_HINT, EXPAND_NUDGE).concat(staticTexts(LP_RULES, CONDENSE_HINT, CONDENSE_NUDGE))
  for (const text of candidates) {
    if (!text || text.replace(/\s+/g, '') === answer.replace(/\s+/g, '')) continue
    const id = namedSlip(expr, text, vars)
    if (!id) continue
    if (anyShows([catalogExample(id), text], forms)) continue
    if (anyShows(hint, forms)) throw new LogSkip('a card shows the finished line')
    return { id, text }
  }
  throw new LogSkip('no named slip from the start')
}

function expandDrawn(expr: string, traps: readonly string[]): Drawn {
  const vars = varsOf(expr)
  const answer = expandLog(expr, vars)
  if (!answer || !isExpandedLog(answer, vars) || !accepted(expr, answer, vars)) throw new LogSkip('expand did not finish')
  const trap = pickSlip(expr, vars, answer, traps)
  return { expr, vars, path: [answer], answer, trap: trap.id, trapAnswer: trap.text }
}

function condenseDrawn(expr: string, traps: readonly string[], path?: readonly string[]): Drawn {
  const vars = varsOf(expr)
  const steps = path ? [...path] : []
  const answer = steps.length ? steps[steps.length - 1]! : condenseLog(expr, vars)
  if (!answer) throw new LogSkip('condense returned nothing')
  if (!isSingleLog(answer, vars) || !accepted(expr, answer, vars)) throw new LogSkip('condense did not finish')
  let prev = expr
  const walked: string[] = []
  for (const step of steps.length ? steps : [answer]) {
    if (!accepted(prev, step, vars)) throw new LogSkip('a condense step was rejected')
    // A constant written as a log of the base can be the same line. Skip it so the anchor does not
    // start already sitting on that step.
    if (logSame(step, prev, vars)) continue
    walked.push(step)
    prev = step
  }
  if (!walked.length) throw new LogSkip('condense had no new line')
  const trap = pickSlip(expr, vars, answer, traps)
  return { expr, vars, path: walked, answer, trap: trap.id, trapAnswer: trap.text }
}

function drawExpand(rng: Rng): Drawn {
  const family = rng.int(0, 5)
  const a = rng.int(2, 5)
  const b = rng.int(2, 4)
  if (family === 0) {
    return expandDrawn(`log(x^${a} * y^${b})`, [
      `log(x^${a}) * log(y^${b})`,
      `${a}log(x) * ${b}log(y)`,
      `log(x^${a} + y^${b})`,
      `(log(x))^${a} + (log(y))^${b}`,
    ])
  }
  if (family === 1) {
    const base = rng.pick([2, 3, 4, 5] as const)
    const k = rng.pick([1, 2] as const)
    const coef = ipow(base, k)
    return expandDrawn(`log_${base}(${coef} * x^${a})`, [
      `log_${base}(${coef}) * log_${base}(x^${a})`,
      `log_${base}(${coef}x^${a})`,
      `${k} * ${a}log_${base}(x)`,
      `log_${base}(${coef} + x^${a})`,
    ])
  }
  if (family === 2) {
    return expandDrawn(`ln(sqrt(x) / y^${b})`, [
      `ln(sqrt(x)) / ln(y^${b})`,
      `(1/2)ln(x) / ${b}ln(y)`,
      `ln(sqrt(x) - y^${b})`,
      `ln(sqrt(x)) * ln(y^${b})`,
    ])
  }
  if (family === 3) {
    const base = rng.pick([2, 3, 4, 5] as const)
    const coef = rng.pick([2, 3, 5, 6, 7] as const)
    return expandDrawn(`log_${base}(${coef} * x^${a} * y)`, [
      `log_${base}(${coef}) * log_${base}(x^${a}) * log_${base}(y)`,
      `log_${base}(${coef} + x^${a} + y)`,
      `${a}log_${base}(x) * log_${base}(y)`,
    ])
  }
  if (family === 4) {
    const k = rng.pick([1, 2, 3] as const)
    const coef = ipow(10, k)
    return expandDrawn(`log(${coef} * x / y^${b})`, [
      `log(${coef} * x) / log(y^${b})`,
      `log(${coef}) * log(x) - log(y^${b})`,
      `log(${coef} * x - y^${b})`,
    ])
  }
  const k = rng.int(2, 5)
  return expandDrawn(`ln(e^${k} * x)`, [`ln(e^${k}) * ln(x)`, `ln(e^${k} + x)`, `${k}ln(e) * ln(x)`])
}

function drawCondense(rng: Rng): Drawn {
  const family = rng.int(0, 3)
  if (family === 0) {
    const a = rng.int(2, 5)
    return condenseDrawn(`${a}log(x) + log(y) - log(n)`, [
      `log(${a} * x) + log(y) - log(n)`,
      `log(x^${a} + y) - log(n)`,
      `log(x)^${a} + log(y) - log(n)`,
      `${a}log(x) + log(y - n)`,
    ])
  }
  if (family === 1) {
    const d = rng.pick([2, 3] as const)
    const k = rng.int(2, 4)
    return condenseDrawn(`(1/${d})ln(x) - ${k}ln(y)`, [
      `ln(x / ${d}) - ${k}ln(y)`,
      `ln((1/${d}) * x) - ln(y^${k})`,
      `ln(x^(1/${d})) / ln(y^${k})`,
      `(1/${d})ln(x - y^${k})`,
    ])
  }
  if (family === 2) {
    const base = rng.pick([2, 3, 4, 5] as const)
    const a = rng.int(2, 4)
    const k = rng.pick([3, 5, 6, 7] as const)
    const m = rng.pick([1, 2] as const)
    const expr = `${a}log_${base}(x) - log_${base}(${k}) + ${m}`
    const asLog = `${a}log_${base}(x) - log_${base}(${k}) + log_${base}(${ipow(base, m)})`
    const single = condenseLog(asLog, ['x'])
    if (!single) throw new LogSkip('constant did not condense')
    return condenseDrawn(expr, [
      `log_${base}(${a} * x) - log_${base}(${k}) + ${m}`,
      `log_${base}(x^${a} - ${k}) + ${m}`,
      `${a}log_${base}(x) - log_${base}(${k} + ${m})`,
      `log_${base}(x)^${a} - log_${base}(${k}) + ${m}`,
    ], [asLog, single])
  }
  const c = rng.int(1, 6)
  return condenseDrawn(`log(x) + log(x + ${c})`, [
    `log(x + x + ${c})`,
    `log(2x + ${c})`,
    `log(x) * log(x + ${c})`,
    `log(x + ${c})`,
  ])
}

function assemble(question: LogPropertiesAnswer['question'], templateId: string, version: number, seed: number, knobs: DifficultyKnobs, drawn: Drawn): ProblemInstance {
  const card = lpRuleFor(drawn.trap)
  const nudge = question === 'expand' ? EXPAND_NUDGE : CONDENSE_NUDGE
  const hint = question === 'expand' ? EXPAND_HINT : CONDENSE_HINT
  const canonical: CanonicalStep[] = drawn.path.map((text, i) => ({
    text,
    tag: TAG,
    nudge,
    ruleCard: card,
    stage: `line-${i + 1}`,
  }))
  const answer: LogPropertiesAnswer = {
    type: 'logProperties',
    question,
    expr: drawn.expr,
    vars: drawn.vars,
    prompt: question === 'expand' ? 'Expand. Assume all variables are positive.' : 'Condense to a single logarithm. Assume all variables are positive.',
    path: drawn.path,
    answerText: drawn.answer,
    formatHint: hint,
    expectedDisplay: drawn.answer,
    nudge,
    ruleCard: card,
    ruleCards: [card, LP_RULE_IDS.product, LP_RULE_IDS.quotient, LP_RULE_IDS.power].filter((id, i, all) => all.indexOf(id) === i),
    reveal: drawn.path,
    trap: drawn.trap as LogPropertiesAnswer['trap'],
    trapAnswer: drawn.trapAnswer,
  }
  return {
    id: problemId(LP_MODULE_ID, templateId, version, seed),
    moduleId: LP_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: version,
    seed: seed >>> 0,
    knobs,
    kind: 'logProperties',
    title: question === 'expand' ? 'Expand a logarithm' : 'Condense to one logarithm',
    instructions: 'One line at a time. Every variable is positive.',
    statementText: drawn.expr,
    vars: drawn.vars,
    start: drawn.expr,
    canonical,
    answer,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { question, expr: drawn.expr, answer: drawn.answer, trap: drawn.trap },
  }
}

function generate(question: LogPropertiesAnswer['question'], templateId: string, version: number, salt: number) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const drawn = searchSeed(seed, salt, 40, (rng) => (question === 'expand' ? drawExpand(rng) : drawCondense(rng)))
    return assemble(question, templateId, version, seed, knobs, drawn)
  }
}

export const expandTemplate: TemplateDef = {
  id: 'lp.expand',
  title: 'Expand a logarithm',
  description: 'Expand one logarithm into a sum or difference, one checked line at a time.',
  version: 1,
  knobs: [],
  generate: generate('expand', 'lp.expand', 1, 21),
}

export const condenseTemplate: TemplateDef = {
  id: 'lp.condense',
  title: 'Condense to one logarithm',
  description: 'Condense a sum or difference of logarithms to a single log, one checked line at a time.',
  version: 1,
  knobs: [],
  generate: generate('condense', 'lp.condense', 1, 22),
}

export const LP_TEMPLATES = [expandTemplate, condenseTemplate] as const
