/**
 * "Check my own problem" for the difference quotient (docs/progress/own-problem.md): her f, as a ProblemInstance
 * exactly like the templates make (kind 'diffQuotient', built by the module's own `buildInstance`), or the reason it
 * is outside this module.
 *
 * The class is the module's polynomial and fraction forms with her whole numbers: a line ax + b, a quadratic
 * ax² + bx + c, and k/(ax + b) (the template's a/(x + c), with any leading number below). The simplified difference
 * quotient and every line of the path are worked out exactly from her numbers in the templates' own steps, and each line
 * is kept only when the module's own graders (`gradeFxh`, `gradeDqStep`, the engine's `checkFxhLine` and
 * `checkDqLine`) keep it, as her typed lines are. The square root form is not taken here (see the progress log).
 */
import type { CanonicalStep, ProblemInstance } from '@/content/types'
import { parseExpression, parseStatement } from '@/engine'
import { polyDeg, ratFnOf } from '@/engine/functions/poly'
import { collectVars, symbolName } from '@/engine/math'
import { rat, ratIsInteger, ratToString } from '@/notation'
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
import { buildInstance, step } from './build'
import { dqStart, dqSolved, gradeDqStep, gradeFxh } from './grade'
import { mono, sum, times } from './text'

const MODULE = 'diffQuotient' as const

const KIND: OwnKind = {
  id: 'dq',
  label: 'Simplify the difference quotient',
  example: 'f(x) = 3x^2 - 2x + 1',
  input: 'either',
  vars: ['x'],
}

const TEMPLATES = ['dq.linear', 'dq.quadratic', 'dq.rational'] as const
/** Her whole numbers stay as the templates' do, give or take: the engine's samples were tried on numbers like these. */
const MAX_COEF = 50

const FORMS = 'here I check the difference quotient of a line, a quadratic, or a number over ax + b, like '

type Read = { ok: true; f: MathNode; text: string } | { ok: false; result: OwnResult }

function readFunction(statement: string): Read {
  if (/[=<>]/.test(statement)) {
    const rel = parseStatement(statement, ['x', 'y'])
    if (!rel.ok) return { ok: false, result: { ok: false, reason: parseReason(rel.error, statement) } }
    const rels = rel.statement.disjuncts.flat()
    const only = rels.length === 1 && rel.statement.disjuncts.length === 1 ? rels[0]! : null
    if (only && only.op === '=' && symbolName(only.lhs) === 'y' && !collectVars(only.rhs).includes('y')) {
      return { ok: true, f: only.rhs, text: statement.slice(statement.indexOf('=') + 1).trim() }
    }
    return { ok: false, result: fail('not_function', 'Type the function, like ', math('f(x) = 3x^2 - 2x + 1'), ', or just what is after the = sign.') }
  }
  const expr = parseExpression(statement, ['x'])
  if (!expr.ok) {
    const r = parseReason(expr.error, statement)
    if (r.code === 'letter') {
      const letter = /letter "([^"]+)"/.exec(expr.error.message)?.[1] ?? '?'
      return { ok: false, result: fail('letter', 'This uses the letter ', math(letter), ', and here ', math('f'), ' is written in ', math('x'), ' alone.') }
    }
    return { ok: false, result: { ok: false, reason: r } }
  }
  return { ok: true, f: expr.node, text: statement }
}

interface Shape {
  templateId: (typeof TEMPLATES)[number]
  f: string
  fxh?: string
  steps: CanonicalStep[]
  restrictions: string[]
  note: string
  secant: { x0: number; h0: number }
  xDomain: [number, number]
  params: Record<string, number>
}

function linearShape(a: number, b: number): Shape {
  const f = sum([mono(a, 1), mono(b)])
  const steps: CanonicalStep[] = []
  if (a !== 1) {
    steps.push(
      step(
        `(${sum([mono(a, 1), mono(a, 0, 1), mono(b)])} - (${f}))/h`,
        'distribute',
        a === -1 ? 'Distribute the minus into (x + h).' : `Distribute the ${a} into (x + h).`,
        'distribute',
        'f(x + h) expanded',
      ),
    )
  }
  steps.push(
    step(
      `(${sum([mono(a, 1), mono(a, 0, 1), mono(b), mono(-a, 1), mono(-b)])})/h`,
      'distribute',
      'Now the minus in front of (f(x)): it changes the sign of BOTH of its terms.',
      'minus-parens',
      'minus distributed',
    ),
    step(`${mono(a, 0, 1)}/h`, 'combine_like', 'Combine like terms on top: the x terms cancel, and so do the numbers.', 'combine-like', 'like terms combined'),
    step(String(a), 'simplify', 'Cancel the h on top with the h underneath (h ≠ 0).', 'factor-h', 'h cancelled'),
  )
  return {
    templateId: 'dq.linear',
    f,
    steps,
    restrictions: ['h != 0'],
    note: `Every secant line of a line is the line itself, so the secant slope is the line's own slope: that is why the answer is ${a}, with no h left in it.`,
    secant: { x0: 1, h0: 2 },
    xDomain: [-3, 5],
    params: { a, b },
  }
}

function quadraticShape(a: number, b: number, c: number): Shape {
  const f = sum([mono(a, 2), mono(b, 1), mono(c)])
  const fx = `(${f})`
  const bPart = b === 0 ? '' : times(b, 'x + h')
  const expanded = [mono(a, 2), mono(2 * a, 1, 1), mono(a, 0, 2), mono(b, 1), mono(b, 0, 1), mono(c)]
  const answer = sum([mono(2 * a, 1), mono(a, 0, 1), mono(b)])
  const steps: CanonicalStep[] = []
  if (a !== 1) {
    steps.push(
      step(
        `(${sum([times(a, 'x^2 + 2xh + h^2'), bPart, mono(c)])} - ${fx})/h`,
        'distribute',
        `Square the binomial first: (x + h)^2 = x^2 + 2xh + h^2. Keep the ${a === -1 ? 'minus' : a} in front for now.`,
        'square-binomial',
        'square expanded',
      ),
    )
  }
  const distributeWhat = a === 1 ? 'Expand (x + h)^2 = x^2 + 2xh + h^2' : `Distribute the ${a === -1 ? 'minus' : a} to all three terms of the square`
  steps.push(
    step(`(${sum(expanded)} - ${fx})/h`, 'distribute', `${distributeWhat}${b === 0 ? '' : ` and the ${b === -1 ? 'minus' : b} into (x + h)`}.`, a === 1 ? 'square-binomial' : 'distribute', 'f(x + h) expanded'),
    step(`(${sum([...expanded, mono(-a, 2), mono(-b, 1), mono(-c)])})/h`, 'distribute', 'Distribute the minus in front of (f(x)): every term of f(x) changes sign.', 'minus-parens', 'minus distributed'),
    step(`(${sum([mono(2 * a, 1, 1), mono(a, 0, 2), mono(b, 0, 1)])})/h`, 'combine_like', 'Combine like terms on top: everything without an h cancels.', 'combine-like', 'like terms combined'),
    step(`h(${answer})/h`, 'factor', 'Every term on top has an h. Factor it out.', 'factor-h', 'h factored out'),
    step(answer, 'simplify', 'Cancel the h on top with the h underneath (h ≠ 0).', 'factor-h', 'h cancelled'),
  )
  const x0 = Math.round(-b / (2 * a)) + 1
  return {
    templateId: 'dq.quadratic',
    f,
    steps,
    restrictions: ['h != 0'],
    note: 'Your answer still contains h: a different h picks a different secant line, with a different slope.',
    secant: { x0, h0: 2 },
    xDomain: [x0 - 4, x0 + 5],
    params: { a, b, c },
  }
}

/** k/(mx + c): the template's a/(x + c) path, with her leading number m below. */
function rationalShape(k: number, m: number, c: number): Shape {
  const d0 = sum([mono(m, 1), mono(c)])
  const d1 = sum([mono(m, 1), mono(m, 0, 1), mono(c)])
  const f = `${k}/${m === 1 && c === 0 ? 'x' : `(${d0})`}`
  const fxh = `${k}/(${d1})`
  const den = m === 1 && c === 0 ? 'x(x + h)' : `(${d0})(${d1})`
  const top1 = `${times(k, d0)} ${k > 0 ? '-' : '+'} ${times(Math.abs(k), d1)}`
  const top2 = sum([mono(k * m, 1), mono(k * c), mono(-k * m, 1), mono(-k * m, 0, 1), mono(-k * c)])
  const answer = `${-k * m}/(${den})`
  const steps = [
    step(`((${top1})/(${den}))/h`, 'rewrite_fraction', `Subtract the two fractions on top over the common denominator ${den}.`, 'common-denominator', 'fractions combined'),
    step(`((${top2})/(${den}))/h`, 'distribute', 'Distribute on top, and let the minus reach every term.', 'minus-parens', 'numerator expanded'),
    step(`(${mono(-k * m, 0, 1)}/(${den}))/h`, 'combine_like', 'Combine like terms on top: only the h term survives.', 'combine-like', 'like terms combined'),
    step(`${mono(-k * m, 0, 1)}/(h${den})`, 'rewrite_fraction', 'Dividing by h is multiplying by 1/h: the h joins the denominator.', 'common-denominator', 'divided by h'),
    step(answer, 'simplify', 'Cancel the h on top with the h underneath (h ≠ 0). Leave the denominator factored.', 'factor-h', 'h cancelled'),
  ]
  const shown = ratToString(rat(-c, m))
  const near = Math.ceil(-c / m)
  return {
    templateId: 'dq.rational',
    f,
    fxh,
    steps,
    restrictions: ['h != 0', `x != ${shown}`, `x + h != ${shown}`],
    note: 'The answer keeps its h, and x and x + h must both stay away from the vertical asymptote.',
    secant: { x0: near + 1, h0: 2 },
    xDomain: [near - 4, near + 5],
    params: { a: k, c, m },
  }
}

/** Her path, kept line by line by the module's own graders: from f, f(x + h) then each line from the one before. */
function graderKeeps(instance: ProblemInstance, steps: readonly CanonicalStep[]): boolean {
  const [fxh, ...rest] = steps
  if (!fxh || !gradeFxh(instance, fxh.text).ok) return false
  let prev = dqStart(instance, fxh.text)
  for (const s of rest) {
    if (!gradeDqStep(instance, prev, s.text).ok) return false
    prev = s.text
  }
  return dqSolved(instance, prev)
}

export function buildOwnDiffQuotient(text: string): OwnResult {
  const screened = screenText(text, { maxNumber: MAX_COEF })
  if (!screened.ok) {
    if (screened.reason.code === 'number_too_big') return fail('number_too_big', `Here I check difference quotients with numbers up to ${MAX_COEF}, as in the module’s own problems.`)
    return { ok: false, reason: screened.reason }
  }
  const statement = screened.statement
  const read = readFunction(statement)
  if (!read.ok) return read.result
  const tree = screenTree([read.f])
  if (tree) return { ok: false, reason: tree }
  if (!lettersOf([read.f]).includes('x')) return fail('constant', 'This has no ', math('x'), ' in it, so its difference quotient is 0: there is nothing to simplify.')
  const feat = scanFeatures(read.f, 'x')
  if (feat.fns.includes('sqrt') || feat.fractionalPower) {
    const what = feat.fns.includes('sqrt') ? 'a square root' : 'a fractional power'
    return fail('square_root', `This has ${what} in it, and `, FORMS, math('3x^2 - 2x + 1'), ' or ', math('3/(2x + 1)'), '.')
  }
  if (feat.fns.length || feat.varInExponent || feat.constants.length || feat.constFns.length) {
    return fail('not_form', 'This is not one of the forms I check: ', FORMS, math('3x^2 - 2x + 1'), ' or ', math('3/(2x + 1)'), '.')
  }
  const r = ratFnOf(read.f, 'x')
  if (!r) return fail('unsure', 'I can’t read this function exactly, so I won’t check it.')
  const whole = (q: { n: number; d: number } | undefined) => (q === undefined ? 0 : ratIsInteger(q) ? q.n : null)
  let shape: Shape | null = null
  if (polyDeg(r.den) === 0) {
    const scale = r.den[0]!
    const coefs = [0, 1, 2].map((i) => {
      const c = r.num[i]
      return c === undefined ? 0 : whole({ n: c.n * scale.d, d: c.d * scale.n })
    })
    if (polyDeg(r.num) > 2) return fail('higher_degree', 'This has ', math(`x^${polyDeg(r.num)}`), ' in it, and ', FORMS, math('3x^2 - 2x + 1'), '.')
    if (polyDeg(r.num) < 1) return fail('constant', 'This has no ', math('x'), ' in it once simplified, so its difference quotient is 0: there is nothing to simplify.')
    if (coefs.some((c) => c === null)) return fail('fractions', 'Here I check whole numbers in front, like ', math('3x^2 - 2x + 1'), ', as in the module’s own problems.')
    const [c0, c1, c2] = coefs as number[]
    shape = polyDeg(r.num) === 1 ? linearShape(c1!, c0!) : quadraticShape(c2!, c1!, c0!)
  } else if (polyDeg(r.den) === 1 && polyDeg(r.num) === 0) {
    // k/(mx + c), the numbers whole after clearing any fraction.
    const k = r.num[0]!
    const lead = r.den[1]!
    const tail = r.den[0] ?? { n: 0, d: 1 }
    const mults = [k.d, lead.d, tail.d]
    const L = mults.reduce((acc, d) => (acc * d) / gcd(acc, d), 1)
    // Her numbers as she wrote them (6/(4x + 2) stays 6/(4x + 2)); only a fraction inside is cleared.
    const [K, M, C] = [(k.n * L) / k.d, (lead.n * L) / lead.d, (tail.n * L) / tail.d]
    if ([K, M, C].some((v) => !Number.isInteger(v) || Math.abs(v) > MAX_COEF)) return fail('fractions', 'Here I check whole numbers, like ', math('3/(2x + 1)'), '.')
    shape = rationalShape(K, M, C)
  } else {
    return fail('not_form', 'This is not one of the forms I check: ', FORMS, math('3x^2 - 2x + 1'), ' or ', math('3/(2x + 1)'), '.')
  }
  const seed = ownSeed(statement)
  const built = buildInstance({
    templateId: shape.templateId,
    version: OWN_VERSION,
    seed,
    knobs: {},
    f: shape.f,
    ...(shape.fxh ? { fxh: shape.fxh } : {}),
    steps: shape.steps,
    restrictions: shape.restrictions,
    note: shape.note,
    secant: shape.secant,
    xDomain: shape.xDomain,
    params: shape.params,
  })
  const instance: ProblemInstance = { ...built, id: ownProblemId(MODULE, shape.templateId, statement), genVersion: OWN_VERSION, params: { ...built.params, own: true }, own: statement }
  if (!graderKeeps(instance, instance.canonical)) {
    // The answer alone, after her f(x + h) line: the last hint shows it with its rule card.
    const short = [instance.canonical[0]!, instance.canonical[instance.canonical.length - 1]!]
    const fallback: ProblemInstance = { ...instance, canonical: short }
    if (!graderKeeps(fallback, short)) return fail('unsure', 'I’m not sure my line checks work on this one, so I won’t check it.')
    return { ok: true, instance: fallback, asks: ASKS(shape.f) }
  }
  return { ok: true, instance, asks: ASKS(shape.f) }
}

const ASKS = (f: string) => [
  'Find ',
  math(`f(x + h)`),
  ' for ',
  math(`f(x) = ${f}`),
  ', then simplify the difference quotient one line at a time until no ',
  math('h'),
  ' is left underneath.',
]

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}


export const ownDiffQuotient: OwnConstructor = {
  moduleId: MODULE,
  kinds: [KIND],
  build: (_kind, text) => {
    try {
      return buildOwnDiffQuotient(text)
    } catch {
      return fail('unsure', 'I’m not sure I can check this one, so I won’t.')
    }
  },
  kindOfTemplate: (templateId) => ((TEMPLATES as readonly string[]).includes(templateId) ? KIND.id : null),
}
