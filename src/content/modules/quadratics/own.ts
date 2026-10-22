/**
 * "Check my own problem" for completing the square (docs/progress/own-problem.md): her quadratic, rewritten in vertex
 * form line by line, as a ProblemInstance exactly like the cs.form template makes (kind 'quadratics', question
 * 'form'), or the reason it is outside this module.
 *
 * The class is the template's: a quadratic ax² + bx + c in x with exact numbers and b ≠ 0 (with no x term it is vertex
 * form already). Everything is the engine's (src/engine/polynomials), as for a generated problem: the vertex form, the
 * vertex, the worked lines with their reasons (hint rung 3 and the worked solution), and the named slips; her quadratic
 * must pass the same self-test every template draw passes (`quadSelfTest`). The trap is the first slip the engine
 * lists for her quadratic.
 */
import type { ProblemInstance } from '@/content/types'
import { completeSquare, isVertexForm, parseExpression, parseStatement } from '@/engine'
import { polyDeg, ratFnOf } from '@/engine/functions/poly'
import { collectVars, symbolName } from '@/engine/math'
import { ratToString } from '@/notation'
import type { MathNode } from 'mathjs'
import {
  OWN_VERSION,
  fail,
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
import { polyShow } from '@/content/modules/polynomials/patterns'
import { QD_MODULE_ID, parabolaGraph, quadSelfTest, quadTrapKinds, type QuadraticsAnswer } from './build'
import { CS_RULE_IDS, csRuleIdFor } from './rules'

const MODULE = QD_MODULE_ID
const TEMPLATE = 'cs.form'

const KIND: OwnKind = {
  id: 'form',
  label: 'Rewrite in vertex form',
  example: '2x^2 - 12x + 13',
  input: 'either',
  vars: ['x'],
}

// The template's own nudges (form.ts), for a quadratic with a = 1 and with another a.
const NUDGE_MONIC =
  'Look at the x-term. Take half of its coefficient and square that half: add the square to make a perfect square, and subtract it again in the same line so nothing changes. Then write the first three terms as ( )^2 and tidy up the constants.'
const NUDGE_LEAD =
  'Start by factoring the number in front of x^2 out of the two x-terms only. Inside the parentheses, add and subtract the square of half the x-coefficient. When the subtracted number comes out of the parentheses, it is multiplied by the number in front.'

const HERE = 'here I complete the square on a quadratic, like '

type Read = { ok: true; f: MathNode; text: string } | { ok: false; result: OwnResult }

/** f(x) = Q, y = Q, or Q alone. */
function readQuadratic(statement: string): Read {
  if (/[=<>]/.test(statement)) {
    const rel = parseStatement(statement, ['x', 'y'])
    if (!rel.ok) {
      const r = parseReason(rel.error, statement)
      return { ok: false, result: { ok: false, reason: r } }
    }
    const rels = rel.statement.disjuncts.flat()
    const only = rels.length === 1 && rel.statement.disjuncts.length === 1 ? rels[0]! : null
    if (only && only.op === '=' && symbolName(only.lhs) === 'y' && !collectVars(only.rhs).includes('y')) {
      return { ok: true, f: only.rhs, text: statement.slice(statement.indexOf('=') + 1).trim() }
    }
    return {
      ok: false,
      result: fail('equation', 'This is an equation, and ', HERE, math('2x^2 - 12x + 13'), ': type the quadratic itself. Solving a quadratic equation is in ', { module: 'polyZeros' }, '.'),
    }
  }
  const expr = parseExpression(statement, ['x'])
  if (!expr.ok) {
    const r = parseReason(expr.error, statement)
    if (r.code === 'letter') {
      const letter = /letter "([^"]+)"/.exec(expr.error.message)?.[1] ?? '?'
      return { ok: false, result: fail('letter', 'This uses the letter ', math(letter), ', and here the quadratic is in ', math('x'), '.') }
    }
    return { ok: false, result: { ok: false, reason: r } }
  }
  return { ok: true, f: expr.node, text: statement }
}

export function buildOwnQuadratic(text: string): OwnResult {
  const screened = screenText(text)
  if (!screened.ok) return { ok: false, reason: screened.reason }
  const statement = screened.statement
  const read = readQuadratic(statement)
  if (!read.ok) return read.result
  const tree = screenTree([read.f])
  if (tree) return { ok: false, reason: tree }
  const letters = lettersOf([read.f])
  if (!letters.includes('x')) return fail('no_variable', 'This has no ', math('x'), ' in it, so there is no square to complete.')
  const feat = scanFeatures(read.f, 'x')
  if (feat.fns.length || feat.varInExponent || feat.varInDenominator || feat.fractionalPower || feat.constants.length || feat.constFns.length) {
    return fail('not_polynomial', 'This is not a quadratic polynomial, and ', HERE, math('2x^2 - 12x + 13'), '.')
  }
  const r = ratFnOf(read.f, 'x')
  if (!r || polyDeg(r.den) !== 0) return fail('not_polynomial', 'This is not a quadratic polynomial, and ', HERE, math('2x^2 - 12x + 13'), '.')
  const degree = polyDeg(r.num)
  if (degree < 2) return fail('linear', 'This has no ', math('x^2'), ' term, so there is no square to complete.')
  if (degree > 2) {
    return fail('higher_degree', 'This has ', math(`x^${degree}`), ' in it, and ', HERE, math('2x^2 - 12x + 13'), '. Higher powers are in ', { module: 'polyZeros' }, '.')
  }
  if (isVertexForm(read.text)) return fail('already_vertex', 'This is in vertex form already, ', math('a(x - h)^2 + k'), ', so there is nothing to complete.')
  const m = completeSquare(read.text)
  if (!m) return fail('unsure', 'I can’t complete the square on this one exactly, so I won’t check it.')
  if (m.path.length < 2) return fail('no_x_term', 'There is no ', math('x'), ' term, so this is vertex form already, with its vertex on the ', math('y'), '-axis.')
  const f = m.f
  const seed = ownSeed(statement)
  // The same self-test every template draw passes: every engine line legal, every grader right on its own answers.
  const problem = quadSelfTest(f, seed)
  if (problem) return fail('unsure', 'I’m not sure my checks work on this one, so I won’t check it.')
  const traps = quadTrapKinds(f, 'form')
  if (!traps.length) return fail('unsure', 'I’m not sure my checks work on this one, so I won’t check it.')
  const trap = traps[0]!
  const monic = m.a.n === 1 && m.a.d === 1
  const primary = csRuleIdFor(trap) ?? CS_RULE_IDS.half
  const others = monic
    ? [CS_RULE_IDS.half, CS_RULE_IDS.balance, CS_RULE_IDS.vertex]
    : [CS_RULE_IDS.factor, CS_RULE_IDS.half, CS_RULE_IDS.balance, CS_RULE_IDS.scale, CS_RULE_IDS.vertex]
  const steps = m.path.slice(1)
  const closing = m.explanation.slice(steps.length)
  const extremumText = ratToString(m.extremum.value)
  const answer: QuadraticsAnswer = {
    type: 'quadratics',
    question: 'form',
    f,
    prompt: 'Write f(x) in vertex form.',
    vertexForm: m.vertexForm,
    vertexText: m.vertexText,
    axisText: m.axisText,
    opens: m.opens,
    extremumKind: m.extremum.kind,
    extremumText,
    path: m.path.map((line) => ({ text: line.text, reason: line.reason })),
    expectedDisplay: polyShow(m.vertexForm),
    nudge: monic ? NUDGE_MONIC : NUDGE_LEAD,
    ruleCard: primary,
    ruleCards: [primary, ...others.filter((id) => id !== primary)],
    reveal: [...steps.map((line) => `${line.reason} You now have ${polyShow(line.text)}.`), closing[0]!],
    trap,
    graph: parabolaGraph(m),
  }
  const instance: ProblemInstance = {
    id: ownProblemId(MODULE, TEMPLATE, statement),
    moduleId: MODULE,
    templateId: TEMPLATE,
    skill: TEMPLATE,
    genVersion: OWN_VERSION,
    seed,
    knobs: {},
    kind: 'quadratics',
    title: 'Rewrite in vertex form',
    instructions: 'Type one line of your work at a time. Every line is checked, and the problem is finished when a line is in vertex form, a(x − h)^2 + k.',
    statementText: f,
    vars: ['x'],
    start: f,
    canonical: [],
    answer,
    graph: { kind: 'none' },
    calc: { ti84: [], nspire: [] },
    params: { own: true, question: 'form', trap },
    own: statement,
  }
  return {
    ok: true,
    instance,
    asks: ['Rewrite ', math(`f(x) = ${f}`), ' in vertex form, ', math('a(x - h)^2 + k'), ', one checked line at a time.'],
  }
}

export const ownQuadratics: OwnConstructor = {
  moduleId: MODULE,
  kinds: [KIND],
  build: (_kind, text) => {
    try {
      return buildOwnQuadratic(text)
    } catch {
      return fail('unsure', 'I’m not sure I can check this one, so I won’t.')
    }
  },
  kindOfTemplate: (templateId) => (templateId === TEMPLATE ? KIND.id : null),
}
