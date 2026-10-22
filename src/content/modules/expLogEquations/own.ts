/**
 * "Check my own problem" for exponential and logarithmic equations (docs/progress/own-problem.md): her equation as a
 * ProblemInstance exactly like the three templates make (kind 'expLogEquations'), or the reason it is outside this
 * module.
 *
 * The class is what the logs engine solves: one equation in x with x in an exponent or inside a log (one base or two,
 * a log on each side, a quadratic in disguise). For the exact answer the engine must find the solutions exactly; with
 * the answer rounded (she picks 1 to 4 decimal places, as her homework asks) one solution is enough, found exactly or
 * only as a decimal, and the answer is written as the module's rounded templates write theirs (`places`, "Solve. Round
 * to three decimal places.", the rounded value). The answer, the extraneous roots and the worked solution are the
 * engine's own (`analyzeLogEquation`), never a template's numbers; the hint path is the engine's worked lines, each
 * kept only when the flow's own checker (`checkLogStep`, with her equation as the original and the places she asked
 * for) keeps it, ending with the solution. Her answer is graded by `gradeLogEquation`, as a generated problem's is. The
 * per-seed trap is left out unless the engine's analysis names one (an extraneous root she might keep) and it grades
 * as that slip.
 */
import type { CanonicalStep, ProblemInstance } from '@/content/types'
import { analyzeLogEquation, checkLogStep, gradeLogEquation, normalizeInput, parseStatement, sameLogLine, statementHolds, type LogEquation } from '@/engine'
import { polyDeg, ratFnOf } from '@/engine/functions/poly'
import { collectVars, nodeArgs } from '@/engine/math'
import { ratDiv, ratNeg } from '@/notation'
import type { MathNode } from 'mathjs'
import type { ErrorPatternId } from '@/shared/types'
import {
  OWN_PLACES,
  OWN_VERSION,
  fail,
  fnWords,
  hasLogInLog,
  letterReason,
  lettersOf,
  math,
  ownFlags,
  ownProblemId,
  ownSeed,
  parseReason,
  scanFeatures,
  screenText,
  screenTree,
  type OwnConstructor,
  type OwnKind,
  type OwnOptions,
  type OwnPart,
  type OwnResult,
} from '@/content/own/core'
import { ZERO, factor, isMinusOne, isOne, plus } from '@/content/own/print'
import { EQUATION_HINT, EQUATION_NUDGE, placesWord, roundPlaces } from '../explog/text'
import { EE_MODULE_ID, type ExpLogAnswer } from './build'
import { EE_RULE_IDS } from './rules'

const MODULE = EE_MODULE_ID

const KIND: OwnKind = {
  id: 'solve',
  label: 'Solve an exponential or log equation',
  example: 'log(x) + log(x - 3) = 1',
  input: 'relation',
  vars: ['x'],
}

const TEMPLATE_OF: Record<ExpLogAnswer['question'], string> = {
  exponential: 'ee.exponential',
  logarithmic: 'ee.logarithmic',
  quadratic: 'ee.quadratic',
}

const TITLE: Record<ExpLogAnswer['question'], string> = {
  exponential: 'Solve an exponential equation',
  logarithmic: 'Solve a logarithmic equation',
  quadratic: 'Solve a quadratic in exponential form',
}

/** The engine's wide grid reaches 10⁷; her solutions stay well inside it. */
const MAX_SOLUTION = 1e6
/** Worked lines tried before the solution line (each is one call to the checker). */
const MAX_LINES = 2

const HERE = 'here I solve equations with x in an exponent or inside a log'

/** Where x sits: in an exponent, inside a log, or out in the open. */
function placesOfX(root: MathNode): { exponent: boolean; log: boolean; outside: boolean } {
  const out = { exponent: false, log: false, outside: false }
  const visit = (n: MathNode, inside: boolean) => {
    if (n.type === 'ParenthesisNode') return visit((n as unknown as { content: MathNode }).content, inside)
    if (n.type === 'SymbolNode') {
      if ((n as unknown as { name: string }).name === 'x' && !inside) out.outside = true
      return
    }
    const name = n.type === 'FunctionNode' ? ((n as unknown as { fn: { name?: string } }).fn?.name ?? '') : ''
    if (name === 'log' || name === 'ln' || name === 'log10' || name === 'log2') {
      if (collectVars(n).includes('x')) out.log = true
      for (const a of nodeArgs(n)) visit(a, true)
      return
    }
    if (name === 'exp') {
      if (collectVars(n).includes('x')) out.exponent = true
      for (const a of nodeArgs(n)) visit(a, true)
      return
    }
    if (n.type === 'OperatorNode' && (n as unknown as { op: string }).op === '^') {
      const [base, exp] = nodeArgs(n)
      if (exp && collectVars(exp).includes('x')) {
        out.exponent = true
        visit(exp, true)
        if (base) visit(base, inside)
        return
      }
    }
    for (const a of nodeArgs(n)) visit(a, inside)
  }
  visit(root, false)
  return out
}

/** Why an equation with no x in an exponent or a log is not here, and where it is. */
function noExpLog(sides: readonly MathNode[]): OwnResult {
  const diff = sides
  const feat = scanFeatures(diff[0]!, 'x')
  const feat2 = scanFeatures(diff[1]!, 'x')
  if (feat.varInDenominator || feat2.varInDenominator) {
    return fail('rational', 'This has no ', math('x'), ` in an exponent or inside a log, and ${HERE}. Equations with `, math('x'), ' in a denominator are in ', { module: 'rationalFns' }, '.')
  }
  const r1 = ratFnOf(diff[0]!, 'x')
  const r2 = ratFnOf(diff[1]!, 'x')
  const degree = Math.max(r1 ? polyDeg(r1.num) : 0, r2 ? polyDeg(r2.num) : 0)
  if (degree >= 2) {
    return fail('polynomial', 'This has no ', math('x'), ` in an exponent or inside a log, and ${HERE}. Zeros of polynomials are in `, { module: 'polyZeros' }, '.')
  }
  return fail('no_exp_log', 'This has no ', math('x'), ` in an exponent or inside a log, and ${HERE}.`)
}

function lineOf(sols: readonly { value: number; text: string }[]): string {
  return [...sols]
    .sort((p, q) => p.value - q.value)
    .map((s) => `x = ${s.text}`)
    .join(' or ')
}

/**
 * The formula at the end of one of the engine's worked sentences ("Combine the logs …: x(x − 3) = 10."), as a line.
 * A line in u ("Solve for u: u = 2 or u = 3.") is written back in x with the engine's own u (e^x = 2 or e^x = 3).
 */
/** e to the first power written as e (the engine writes e^1 = x + 1; a person writes e = x + 1). */
function tidyE(text: string): string {
  return text.replace(/(?<![A-Za-z])e\^(?:1|\(1\))(?![\d.])/g, 'e')
}

function workedLine(sentence: string, u: string | null): string | null {
  const at = sentence.lastIndexOf(': ')
  if (at < 0) return null
  let text = sentence.slice(at + 2).trim()
  if (text.endsWith('.')) text = text.slice(0, -1)
  // The sentence is display text (−, ·): the app's syntax first.
  text = tidyE(normalizeInput(text).replace(/\s+/g, ' ').trim())
  if (u && /(?<![A-Za-z])u(?![A-Za-z])/.test(text)) {
    const power = /^[A-Za-z0-9.]+\^(\w+|\([^()]*\))$/.test(u) ? u : `(${u})`
    text = text.replace(/(?<![A-Za-z])u(?![A-Za-z])/g, power)
  }
  const parsed = parseStatement(text, ['x'])
  if (!parsed.ok) return null
  const rels = parsed.statement.disjuncts.flat()
  if (!rels.length || rels.some((r) => r.op !== '=')) return null
  return text
}

/** The line is true at every one of these values of x (each branch of an "or" line counts). */
function holdsAt(line: string, xs: readonly number[]): boolean {
  const p = parseStatement(line, ['x'])
  if (!p.ok) return false
  return xs.every((x) => statementHolds(p.statement, { x }) === true)
}

/** One solution written exactly from the engine's own log-free equation (x + 3 = e^2 → x = e^2 − 3), or null. */
function exactFromAlgebraic(a: LogEquation, equation: string): string | null {
  if (!a.algebraic || a.solutions.length !== 1) return null
  const p = parseStatement(a.algebraic, ['x'])
  if (!p.ok) return null
  const rels = p.statement.disjuncts.flat()
  if (rels.length !== 1) return null
  const rel = rels[0]!
  const [side, other, otherSrc] = collectVars(rel.rhs).includes('x') ? [rel.rhs, rel.lhs, rel.lhsSrc] : [rel.lhs, rel.rhs, rel.rhsSrc]
  if (collectVars(other).includes('x')) return null
  const lin = ratFnOf(side, 'x')
  if (!lin || polyDeg(lin.den) !== 0 || polyDeg(lin.num) !== 1) return null
  // The side is P·x + Q: x = (other − Q)/P.
  const P = ratDiv(lin.num[1]!, lin.den[0]!)
  const Q = ratDiv(lin.num[0] ?? ZERO, lin.den[0]!)
  const src = tidyE(otherSrc.trim())
  const atom = /^[^+\-]*$/.test(src.replace(/^-/, '')) ? src : `(${src})`
  const top = plus(atom, ratNeg(Q))
  const text = isOne(P) ? `x = ${top}` : isMinusOne(P) ? `x = -(${top})` : `x = (${top})/${factor(P)}`
  const g = gradeLogEquation(equation, text)
  return g.verdict === 'correct' ? text : null
}

/** The answer she will be asked for, and the hint path's last line. */
interface Answer {
  /** What the answer box shows as the answer (`answerText`). */
  text: string
  /** Spellings the answer box takes, the answer first. */
  accept: string[]
  /** The solution as a line, the hint path's last. */
  last: string
}

/** The exact answer: the engine's solutions, or one written from its own log-free line; null when neither is exact. */
function exactAnswer(a: LogEquation, equation: string): Answer | null {
  let text = lineOf(a.solutions)
  if (a.solutions.some((s) => !s.exact)) {
    const exact = exactFromAlgebraic(a, equation)
    if (!exact) return null
    text = exact
  }
  if (gradeLogEquation(equation, text).verdict !== 'correct') return null
  // Spellings the answer box takes: the whole line, and the bare number when there is one solution.
  const accept = [text]
  if (a.solutions.length === 1) {
    const bare = text.replace(/^\s*x\s*=\s*/, '')
    if (bare !== text && gradeLogEquation(equation, bare).verdict === 'correct') accept.push(bare)
  }
  return { text, accept, last: text }
}

/**
 * One solution rounded, as the module's rounded templates write theirs: the value to `places` (2.727), and the
 * spellings that grade right with those places (the exact value too where it is a whole number). The path ends with the
 * solution as a line: exact where the engine writes it exactly, as the templates' paths do, else rounded (the flow's
 * checker keeps x = 2.928 on a rounded problem). Null for several solutions, or when the grader would not take it.
 */
function roundedAnswer(a: LogEquation, equation: string, places: number): Answer | null {
  if (a.solutions.length !== 1) return null
  const s = a.solutions[0]!
  const text = roundPlaces(s.value, places)
  const decimal = { decimal: { places } }
  if (gradeLogEquation(equation, text, decimal).verdict !== 'correct') return null
  const accept = [text]
  if (s.text !== text && gradeLogEquation(equation, s.text, decimal).verdict === 'correct') accept.push(s.text)
  const exactLine = s.exact ? `x = ${s.text}` : exactFromAlgebraic(a, equation)
  return { text, accept, last: exactLine ?? `x = ${text}` }
}

/** "x = −0.928 or x = 2.928": the values rounded, smallest first. */
function roundedLine(sols: readonly { value: number }[], places: number): string {
  return [...sols]
    .sort((p, q) => p.value - q.value)
    .map((s) => `x = ${roundPlaces(s.value, places)}`)
    .join(' or ')
}

function placesWords(places: number): string {
  return `${placesWord(places)} decimal place${places === 1 ? '' : 's'}`
}

export function buildOwnExpLogEquation(text: string, options: OwnOptions = {}): OwnResult {
  const places = options.places !== undefined && (OWN_PLACES as readonly number[]).includes(options.places) ? options.places : undefined
  const screened = screenText(text)
  if (!screened.ok) return { ok: false, reason: screened.reason }
  const equation = screened.statement
  if (equation.includes('+-')) return fail('plus_minus', 'This has ±; type each equation on its own.')
  const parsed = parseStatement(equation, ['x'])
  if (!parsed.ok) {
    if (/needs both sides and/.test(parsed.error.message)) return fail('no_relation', 'This has no = sign; type the whole equation, with something on each side.')
    const r = parseReason(parsed.error, equation)
    if (r.code === 'letter') return letterReason(equation, { main: 'x', allowed: ['x'], here: ['the equation is in ', math('x'), ' alone'] })
    return { ok: false, reason: r }
  }
  const rels = parsed.statement.disjuncts.flat()
  if (parsed.statement.disjuncts.length !== 1 || rels.length !== 1) return fail('several', 'Type one equation, with one = sign.')
  const rel = rels[0]!
  if (rel.op !== '=') return fail('inequality', 'This is an inequality, and here I solve equations, with =.')
  const sides = [rel.lhs, rel.rhs]
  const tree = screenTree(sides)
  if (tree) return { ok: false, reason: tree }
  if (sides.some(hasLogInLog)) return fail('log_in_log', 'This has a log inside a log, and I can’t solve that exactly here.')
  const letters = lettersOf(sides)
  if (!letters.includes('x')) return fail('no_variable', 'This has no ', math('x'), ' in it, so there is nothing to solve for.')

  const where = sides.map(placesOfX)
  const exponent = where.some((w) => w.exponent)
  const log = where.some((w) => w.log)
  const outside = where.some((w) => w.outside)
  const feat = [scanFeatures(rel.lhs, 'x'), scanFeatures(rel.rhs, 'x')]
  const others = feat.flatMap((f) => f.fns).filter((f) => f !== 'log' && f !== 'exp')
  if (others.length) {
    return fail('function', `This has ${fnWords(others[0]!)} of `, math('x'), ` in it, and ${HERE}.`)
  }
  if (!exponent && !log) return noExpLog(sides)
  if (outside) {
    return fail(
      exponent ? 'mixed_exponent' : 'mixed_log',
      'I can’t solve this one exactly: ',
      math('x'),
      exponent ? ' is both in an exponent and outside it.' : ' is both inside a log and outside it.',
    )
  }
  if (exponent && log) return fail('exp_and_log', 'I can’t solve this one exactly: ', math('x'), ' is both in an exponent and inside a log.')

  let a: LogEquation | null
  try {
    a = analyzeLogEquation(equation)
  } catch {
    a = null
  }
  if (!a || a.kind === 'other') return fail('unsure', 'I can’t solve this one, so I won’t check it.')
  if (!a.solutions.length) return fail('no_solution', 'I find no solution to this one, and here I check equations that have at least one.')
  if (a.solutions.some((s) => !Number.isFinite(s.value) || Math.abs(s.value) > MAX_SOLUTION)) {
    return fail('far_answer', 'The answer to this one is a very large number, beyond what I can check reliably.')
  }
  // The flow's checker, as the flow calls it (cardSources.expLogStepContext): her equation, its seed, her places.
  const seed = ownSeed(equation)
  const ctxFor = (p?: number) => ({ original: equation, vars: ['x' as const], seed, ...(p ? { decimal: { places: p } } : {}) })
  const ctx = ctxFor(places)

  let answer: Answer | null
  if (places) {
    if (a.solutions.length > 1) {
      // As the rounded templates: one solution. Say to pick the exact answer only when that one checks.
      const count = `This one has ${a.solutions.length === 2 ? 'two' : 'several'} solutions, and here I check a rounded answer when there is one`
      return exactAnswer(a, equation)
        ? fail('round_several', `${count}; pick “Exact answer” to check it exactly.`)
        : fail('round_several', `${count}, so I won’t check it.`)
    }
    answer = roundedAnswer(a, equation, places)
    if (!answer) return fail('unsure', 'I’m not sure I can grade this one rounded, so I won’t check it.')
  } else {
    answer = exactAnswer(a, equation)
    if (!answer) {
      // Rounded, it may be one: say so only when it is (one solution, graded and kept by the line checker).
      const rounded = roundedAnswer(a, equation, 3)
      return rounded && checkLogStep(equation, rounded.last, ctxFor(3)).ok
        ? fail('not_exact', 'I can’t write the answer to this one exactly. If it asks you to round, pick how many decimal places, and I can check it.')
        : fail('not_exact', 'I can’t write the answer to this one exactly, so I won’t check it.')
    }
  }
  const answerText = answer.text

  const question: ExpLogAnswer['question'] = a.explanation.some((s) => s.startsWith('Let u = ')) ? 'quadratic' : a.kind
  const extraneous = a.extraneous.length > 0
  const card =
    question === 'quadratic' ? EE_RULE_IDS.quadratic : question === 'logarithmic' ? (extraneous ? EE_RULE_IDS.domain : EE_RULE_IDS.convert) : EE_RULE_IDS.both

  // Her right last line must be one the flow's checker keeps. Where it is not (a double root its grid can miss), the
  // engine is unsure, and so is this: it would refuse her right line.
  if (!checkLogStep(equation, answer.last, ctx).ok) return fail('unsure', 'I’m not sure my line checks work on this one, so I won’t check it.')

  // The hint path: at most two of the engine's own worked lines that the flow's checker keeps, then the solution. A
  // line is only put to the checker when it holds at every solution (a line it would refuse costs the most to check).
  const candidates: string[] = []
  const squash = (t: string) => t.replace(/\s+/g, '')
  const add = (line: string | null) => {
    if (line && squash(line) !== squash(answer.last) && squash(line) !== squash(answerText) && !candidates.some((c) => squash(c) === squash(line))) candidates.push(line)
  }
  let u: string | null = null
  for (const sentence of a.explanation) {
    const named = /^Let u = ([^:]+):/.exec(sentence)
    if (named) u = normalizeInput(named[1]!.trim())
    // Taking logs of both sides and the unsimplified quotient are left to her: the lines around them say enough.
    else if (!/^(Take |Solve for x:|Solution:|Domain:|Write )/.test(sentence)) add(workedLine(sentence, u))
  }
  add(a.algebraic)
  if (extraneous) add(lineOf(a.candidates))
  const roots = a.solutions.map((s) => s.value)
  const path: string[] = []
  let prev = equation
  for (const line of candidates) {
    if (path.length >= MAX_LINES) break
    if (!holdsAt(line, roots)) continue
    const r = checkLogStep(prev, line, ctx)
    if (!r.ok) continue
    const kept = r.normalized?.text ?? line
    if (sameLogLine(kept, prev, ['x'])) continue
    path.push(line)
    prev = kept
  }
  if (path.length && !checkLogStep(prev, answer.last, ctx).ok) path.length = 0
  path.push(answer.last)

  const canonical: CanonicalStep[] = path.map((line, i) => ({ text: line, tag: 'simplify', nudge: EQUATION_NUDGE, ruleCard: card, stage: `line-${i + 1}` }))
  // Keeping the extraneous root: the trap only when it grades as that slip, with her places.
  let trap: { trap?: ErrorPatternId; trapAnswer?: string } = {}
  if (extraneous) {
    const trapAnswer = places ? roundedLine(a.candidates, places) : lineOf(a.candidates)
    const g = gradeLogEquation(equation, trapAnswer, places ? { decimal: { places } } : {})
    if (g.verdict === 'mistake' && g.mistake === 'log_extraneous_kept') trap = { trap: 'log_extraneous_kept', trapAnswer }
  }
  // The prompt in the templates' words: a rounded template says "Solve. Round to three decimal places."
  const prompt = places
    ? question === 'logarithmic'
      ? `Solve. Round to ${placesWords(places)}. Check every answer in the original equation.`
      : `Solve. Round to ${placesWords(places)}.`
    : question === 'logarithmic'
      ? 'Solve exactly. Check every answer in the original equation.'
      : 'Solve. Give the exact answer.'
  const spec: ExpLogAnswer = {
    type: 'expLogEquations',
    question,
    equation,
    ...(places ? { places } : {}),
    prompt,
    path,
    answerText,
    accept: answer.accept,
    formatHint: EQUATION_HINT,
    expectedDisplay: answerText,
    nudge: EQUATION_NUDGE,
    ruleCard: card,
    ruleCards: [card, EE_RULE_IDS.both, EE_RULE_IDS.convert, EE_RULE_IDS.domain, EE_RULE_IDS.quadratic].filter((id, i, all) => all.indexOf(id) === i),
    reveal: a.explanation,
    ...trap,
    explanation: a.explanation,
  }
  const templateId = TEMPLATE_OF[question]
  const instance: ProblemInstance = {
    id: ownProblemId(MODULE, templateId, equation, ownFlags({ places })),
    moduleId: MODULE,
    templateId,
    skill: templateId,
    genVersion: OWN_VERSION,
    seed,
    knobs: {},
    kind: 'expLogEquations',
    title: TITLE[question],
    instructions: 'One line at a time, then write the solution in the answer box.',
    statementText: equation,
    vars: ['x'],
    start: equation,
    canonical,
    answer: spec,
    graph: { kind: 'none' },
    calc: { ti84: [], nspire: [] },
    params: { own: true, question, equation, answer: answerText, places: places ?? 0 },
    own: equation,
  }
  const asks: OwnPart[] = places
    ? question === 'logarithmic'
      ? ['Solve for ', math('x'), ` one line at a time, check every answer in the original equation, and round the solution to ${placesWords(places)}.`]
      : ['Solve for ', math('x'), ` one line at a time, then round the solution to ${placesWords(places)} in the answer box.`]
    : question === 'logarithmic'
      ? ['Solve for ', math('x'), ' exactly, one line at a time, and check every answer in the original equation.']
      : ['Solve for ', math('x'), ' exactly, one line at a time, then write the solution in the answer box.']
  return { ok: true, instance, asks }
}

export const ownExpLogEquations: OwnConstructor = {
  moduleId: MODULE,
  kinds: [KIND],
  rounding: true,
  build: (_kind, text, options) => {
    try {
      return buildOwnExpLogEquation(text, options)
    } catch {
      return fail('unsure', 'I’m not sure I can check this one, so I won’t.')
    }
  },
  kindOfTemplate: (templateId) => (Object.values(TEMPLATE_OF).includes(templateId) ? KIND.id : null),
}
