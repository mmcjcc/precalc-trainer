/**
 * "Check my own problem" for the properties of logarithms (docs/progress/own-problem.md): her log expression to
 * expand or to condense, as a ProblemInstance exactly like the two templates make (kind 'logProperties'), or the
 * reason it is outside this module.
 *
 * The class is the templates': an expression in x, y and n (every variable positive, as the problem says) with logs of
 * one base that the logs engine expands fully (`expandLog`) or condenses to one log (`condenseLog`). The finished form
 * is the engine's, and it is kept only when the flow's own checker (`checkLogRewrite`, variables positive) keeps it
 * from her expression and calls it finished, as a generated problem's is. The path is that one line, as the templates'
 * is; the rule card is the one for the move the engine reads in it. A per-seed trap is left out.
 */
import type { CanonicalStep, ProblemInstance } from '@/content/types'
import { checkLogRewrite, condenseLog, expandLog, isExpandedLog, isSingleLog, parseExpression, parseStatement } from '@/engine'
import type { MathNode } from 'mathjs'
import { collectVars, evalNode, fnName, isOp, isUnaryMinus, nodeArgs } from '@/engine/math'
import type { VarName } from '@/shared/types'
import {
  OWN_VERSION,
  fail,
  hasLogInLog,
  letterReason,
  lettersOf,
  math,
  ownProblemId,
  ownSeed,
  parseReason,
  scanFeatures,
  screenText,
  screenTree,
  type OwnConstructor,
  type OwnKind,
  type OwnResult,
} from '@/content/own/core'
import { CONDENSE_HINT, CONDENSE_NUDGE, EXPAND_HINT, EXPAND_NUDGE } from '../explog/text'
import { logSame } from '../explog/anchor'
import { LP_MODULE_ID, type LogPropertiesAnswer } from './build'
import { LP_RULE_IDS } from './rules'

const MODULE = LP_MODULE_ID

const KINDS: readonly OwnKind[] = [
  { id: 'expand', label: 'Expand a logarithm', example: 'log(x^2 y / n)', input: 'expression', vars: ['x', 'y', 'n'] },
  { id: 'condense', label: 'Condense to one logarithm', example: '2log(x) + log(y) - log(n)', input: 'expression', vars: ['x', 'y', 'n'] },
]

const TEMPLATE_OF: Record<LogPropertiesAnswer['question'], string> = { expand: 'lp.expand', condense: 'lp.condense' }

/** The base of a log call after the parser's rewrite: log(u) is 10, log(u, b) is b, ln(u) is e. Null otherwise. */
function baseOf(n: MathNode): number | 'e' | null {
  const name = fnName(n)
  if (name === 'ln') return 'e'
  if (name !== 'log' && name !== 'log10') return null
  const args = nodeArgs(n)
  if (args.length < 2) return 10
  const b = evalNode(args[1]!, {})
  return b === 'undef' ? null : b
}

/**
 * Her sum of logs with whole numbers in it, condensed: each number m written as the log of the base to the m
 * (log₂(8) for 3), then the engine condenses the logs. Null when the logs do not share one whole-number base (or e).
 */
function condenseLogWithNumbers(root: MathNode, vars: VarName[]): string | null {
  const bases = new Set<number | 'e'>()
  let bad = false
  const visit = (n: MathNode) => {
    const b = fnName(n) ? baseOf(n) : null
    if (fnName(n) && (fnName(n) === 'ln' || fnName(n) === 'log' || fnName(n) === 'log10')) {
      if (b === null) bad = true
      else bases.add(b)
    }
    for (const a of nodeArgs(n)) visit(a)
  }
  visit(root)
  if (bad || bases.size !== 1) return null
  const base = [...bases][0]!
  if (base !== 'e' && (!Number.isInteger(base) || base < 2 || base > 10)) return null
  const pieces: string[] = []
  const walk = (n: MathNode, minus: boolean): boolean => {
    if ((isOp(n, '+') || isOp(n, '-')) && nodeArgs(n).length === 2) {
      return walk(nodeArgs(n)[0]!, minus) && walk(nodeArgs(n)[1]!, isOp(n, '-') ? !minus : minus)
    }
    if (isUnaryMinus(n)) return walk(nodeArgs(n)[0]!, !minus)
    let text: string
    if (collectVars(n).length === 0 && !fnName(n)) {
      const m = evalNode(n, {})
      if (m === 'undef' || !Number.isInteger(m) || m < 0 || m > 6) return false
      text = base === 'e' ? `ln(e^${m})` : base === 10 ? `log(${10 ** m})` : `log_${base}(${base ** m})`
    } else text = n.toString()
    pieces.push(`${pieces.length ? (minus ? ' - ' : ' + ') : minus ? '-' : ''}${text}`)
    return true
  }
  if (!walk(root, false)) return null
  return condenseLog(pieces.join(''), vars)
}

function varsOf(letters: readonly string[]): VarName[] {
  const out = (['x', 'y', 'n'] as const).filter((v) => letters.includes(v))
  return out.length ? [...out] : ['x']
}

export function buildOwnLogProperties(kindId: string, text: string): OwnResult {
  const question: LogPropertiesAnswer['question'] = kindId === 'condense' ? 'condense' : 'expand'
  const screened = screenText(text)
  if (!screened.ok) return { ok: false, reason: screened.reason }
  const expr = screened.statement
  if (/[=<>]/.test(expr)) {
    const asRelation = parseStatement(expr, ['x', 'y', 'n'])
    if (asRelation.ok) {
      return fail('equation', 'This is an equation, and here I expand or condense an expression. Equations with logs are solved in ', { module: 'expLogEquations' }, '.')
    }
  }
  const parsed = parseExpression(expr, ['x', 'y', 'n'])
  if (!parsed.ok) {
    const r = parseReason(parsed.error, expr)
    if (r.code === 'letter') {
      return letterReason(expr, { main: 'x', allowed: ['x', 'y', 'n'], together: true, here: ['the letters are ', math('x'), ', ', math('y'), ' and ', math('n')] })
    }
    return { ok: false, reason: r }
  }
  const tree = screenTree([parsed.node])
  if (tree) return { ok: false, reason: tree }
  if (hasLogInLog(parsed.node)) return fail('log_in_log', 'This has a log inside a log, and here I expand or condense logs of ', math('x'), ', ', math('y'), ' and ', math('n'), '.')
  const letters = lettersOf([parsed.node])
  const feat = letters.map((v) => scanFeatures(parsed.node, v))
  const anyLog = feat.some((f) => f.fns.includes('log')) || scanFeatures(parsed.node, 'x').constFns.includes('log')
  if (!anyLog) return fail('no_log', 'This has no log in it, and here I expand or condense logarithms.')
  if (!letters.length) {
    return fail('no_letter', 'This has no letter in it, so it is a number: working out a log’s value is in ', { module: 'logForms' }, '.')
  }
  const vars = varsOf(letters)
  const opts = { assumePositive: true, vars }

  let answerText: string | null
  if (question === 'expand') {
    if (isExpandedLog(expr, vars)) {
      return isSingleLog(expr, vars)
        ? fail('already_expanded', 'This is as expanded as it gets: a sum inside a log does not split.')
        : fail('already_expanded', 'This is a sum of logs already, so it is expanded. To write it as one log, pick “Condense to one logarithm”.')
    }
    answerText = expandLog(expr, vars)
    if (!answerText || !isExpandedLog(answerText, vars)) return fail('unsure', 'I can’t expand this one fully, so I won’t check it.')
  } else {
    if (isSingleLog(expr, vars)) return fail('already_single', 'This is one log already. To split it into a sum of logs, pick “Expand a logarithm”.')
    // A plain number joins as a log of the base (3 = log₂ 8), as the condense template writes it.
    answerText = condenseLog(expr, vars)
    if (!answerText || !isSingleLog(answerText, vars)) answerText = condenseLogWithNumbers(parsed.node, vars)
    if (!answerText || !isSingleLog(answerText, vars)) {
      return fail('cannot_condense', 'These logs don’t condense into one: they need the same base, and every other term a whole number.')
    }
  }
  // The finished form must be a line the flow's checker keeps, and a new one.
  const kept = checkLogRewrite(expr, answerText, opts)
  if (!kept.ok) return fail('unsure', 'I’m not sure my line checks work on this one, so I won’t check it.')
  if (logSame(answerText, expr, vars) && answerText.replace(/\s+/g, '') === expr.replace(/\s+/g, '')) {
    return fail('nothing_to_do', 'There is nothing to do here: it is already in the form this asks for.')
  }
  const props = kept.logMove?.properties ?? []
  const card = props.includes('quotient_rule') ? LP_RULE_IDS.quotient : props.includes('power_rule') ? LP_RULE_IDS.power : LP_RULE_IDS.product
  const nudge = question === 'expand' ? EXPAND_NUDGE : CONDENSE_NUDGE
  const canonical: CanonicalStep[] = [{ text: answerText, tag: 'simplify', nudge, ruleCard: card, stage: 'line-1' }]
  const answer: LogPropertiesAnswer = {
    type: 'logProperties',
    question,
    expr,
    vars,
    prompt: question === 'expand' ? 'Expand. Assume all variables are positive.' : 'Condense to a single logarithm. Assume all variables are positive.',
    path: [answerText],
    answerText,
    formatHint: question === 'expand' ? EXPAND_HINT : CONDENSE_HINT,
    expectedDisplay: answerText,
    nudge,
    ruleCard: card,
    ruleCards: [card, LP_RULE_IDS.product, LP_RULE_IDS.quotient, LP_RULE_IDS.power].filter((id, i, all) => all.indexOf(id) === i),
    reveal: [answerText],
  }
  const templateId = TEMPLATE_OF[question]
  const instance: ProblemInstance = {
    id: ownProblemId(MODULE, templateId, expr),
    moduleId: MODULE,
    templateId,
    skill: templateId,
    genVersion: OWN_VERSION,
    seed: ownSeed(expr),
    knobs: {},
    kind: 'logProperties',
    title: question === 'expand' ? 'Expand a logarithm' : 'Condense to one logarithm',
    instructions: 'One line at a time. Every variable is positive.',
    statementText: expr,
    vars,
    start: expr,
    canonical,
    answer,
    graph: { kind: 'none' },
    calc: { ti84: [], nspire: [] },
    params: { own: true, question, expr, answer: answerText },
    own: expr,
  }
  const asks =
    question === 'expand'
      ? ['Expand it fully, one line at a time, with every variable positive.']
      : ['Condense it to a single logarithm, one line at a time, with every variable positive.']
  return { ok: true, instance, asks }
}

export const ownLogProperties: OwnConstructor = {
  moduleId: MODULE,
  kinds: KINDS,
  build: (kindId, text) => {
    try {
      return buildOwnLogProperties(kindId, text)
    } catch {
      return fail('unsure', 'I’m not sure I can check this one, so I won’t.')
    }
  },
  kindOfTemplate: (templateId) => (templateId === 'lp.expand' ? 'expand' : templateId === 'lp.condense' ? 'condense' : null),
}
