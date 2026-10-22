/**
 * uc.given: one function's value and where θ is ("sin θ = 5/13 and cos θ < 0", "θ in Quadrant III", "π/2 < θ < π"):
 * the missing coordinate first (or r, when the value is tan or cot), then one, two or three other functions, exactly.
 * The point is read off the value the textbook's way (sin θ = y/r: y = 5, r = 13). The figure is the axes with the
 * quadrants numbered until the part that settles the quadrant is answered; then the point, its terminal side and r.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart, TrigPartTrap } from '@/content/types'
import {
  exactNum,
  exactSay,
  exactTex,
  exactText,
  gcd,
  givenCoordinateSlips,
  givenPoint,
  givenRSlips,
  givenValue,
  givenValueSlips,
  q,
  qAbs,
  quadrantName,
  quadrantsWithSign,
  reciprocalFn,
  signIn,
  valueTex,
  valueText,
  type GivenPoint,
  type Q,
  type Quadrant,
  type TrigExact,
  type TrigFn,
  type TrigSlip,
} from '@/engine/trig'
import { LogSkip } from '../explog/text'
import { nspireExactKeys, tiExactKeys, ucGivenCalc } from '../trig/calc'
import { givenFigure } from '../trig/figure'
import { exactForms } from '../trig/forms'
import { m, minus, plain } from '../trig/text'
import type { UcDrafted } from './drafted'
import { GIVEN_VALUE_HINT, R_HINT } from './hints'
import { UC_RULE_IDS } from './rules'

const FN_ORDER: readonly TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']
const FN_RATIO: Record<TrigFn, ['x' | 'y' | 'r', 'x' | 'y' | 'r']> = {
  sin: ['y', 'r'],
  cos: ['x', 'r'],
  tan: ['y', 'x'],
  csc: ['r', 'y'],
  sec: ['r', 'x'],
  cot: ['x', 'y'],
}
const ROMAN: Record<Quadrant, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

export type GivenWhere = 'quadrant' | 'interval' | 'sign'

export interface GivenInput {
  fn: TrigFn
  /** The value, a fraction of whole numbers in lowest terms. */
  value: Q
  quadrant: Quadrant
  where: GivenWhere
  /** where = 'sign': the function whose sign is given. */
  signFn?: TrigFn
  /** where = 'interval': the interval's unit. */
  intervalUnit?: 'deg' | 'rad'
  asked: TrigFn[]
}

function qTex(v: Q): string {
  if (v.d === 1) return String(v.n)
  return `${v.n < 0 ? '-' : ''}\\frac{${Math.abs(v.n)}}{${v.d}}`
}

const INTERVAL_RAD = ['0', '\\frac{\\pi}{2}', '\\pi', '\\frac{3\\pi}{2}', '2\\pi']

function intervalTex(qd: Quadrant, unit: 'deg' | 'rad'): string {
  if (unit === 'deg') return `${(qd - 1) * 90}^{\\circ} < \\theta < ${qd * 90}^{\\circ}`
  return `${INTERVAL_RAD[qd - 1]} < \\theta < ${INTERVAL_RAD[qd]}`
}

const listQuadrants = (qs: Quadrant[]) => `Quadrants ${ROMAN[qs[0]!]} and ${ROMAN[qs[1]!]}`
const signWord = (s: number) => (s > 0 ? 'positive' : 'negative')

function traps(slips: readonly TrigSlip[]): TrigPartTrap[] {
  return slips.map((s) => ({ id: s.id, text: valueText(s.value), witness: s.witness }))
}

/** The uc.given problem for this value, quadrant and functions (exported for the hand-worked tests). */
export function givenProblem(o: GivenInput): UcDrafted {
  const { fn, value, quadrant: qd } = o
  const p: GivenPoint = givenPoint(fn, value, qd)
  const givenEq = `\\${fn}\\theta = ${qTex(value)}`
  const signFn = o.signFn ?? 'cos'
  const whereText =
    o.where === 'quadrant'
      ? `${m('\\theta')} is in ${quadrantName(qd)}`
      : o.where === 'interval'
        ? m(intervalTex(qd, o.intervalUnit ?? 'deg'))
        : m(`\\${signFn}\\theta ${signIn(signFn, qd) > 0 ? '>' : '<'} 0`)
  const valueSign = Math.sign(value.n)
  const whereReason =
    o.where === 'quadrant'
      ? `${m('\\theta')} is in ${quadrantName(qd)}.`
      : o.where === 'interval'
        ? `${m(intervalTex(qd, o.intervalUnit ?? 'deg'))} is ${quadrantName(qd)}.`
        : `${m(`\\${fn}\\theta`)} is ${signWord(valueSign)} in ${listQuadrants(quadrantsWithSign(fn, valueSign > 0 ? 1 : -1))}, and ${m(`\\${signFn}\\theta`)} is ${signWord(signIn(signFn, qd))} in ${listQuadrants(quadrantsWithSign(signFn, signIn(signFn, qd)))}, so ${m('\\theta')} is in ${quadrantName(qd)}.`
  const sq = (v: TrigExact) => (exactNum(v) < 0 || v.root > 1 ? `\\left(${exactTex(v)}\\right)^{2}` : `${exactTex(v)}^{2}`)
  const abs = (v: TrigExact) => (exactNum(v) < 0 ? { ...v, c: qAbs(v.c) } : v)

  const fns = FN_ORDER.filter((f) => o.asked.includes(f))
  let first: TrigPart
  let knownWords: string
  if (p.missing === 'r') {
    const ax = abs(p.x)
    const ay = abs(p.y)
    knownWords = `${m(`|x| = ${exactTex(ax)}`)} and ${m(`|y| = ${exactTex(ay)}`)}`
    const sum = exactNum(ax) ** 2 + exactNum(ay) ** 2
    const rTail = exactTex(p.r) === `\\sqrt{${Math.round(sum)}}` ? '' : ` = ${exactTex(p.r)}`
    first = {
      id: 'r',
      kind: 'value',
      label: 'r',
      ask: `For the point with ${knownWords}, what is ${m('r')}, its distance from the origin?`,
      formatHint: R_HINT,
      nudge: `${m('r = \\sqrt{x^{2} + y^{2}}')}: square each coordinate, add, and take the square root.`,
      ruleCard: UC_RULE_IDS.given,
      reveal: [`${m(`r = \\sqrt{${sq(ax)} + ${sq(ay)}} = \\sqrt{${Math.round(sum)}}${rTail}`)}, positive in every quadrant.`],
      answerText: exactText(p.r),
      forms: exactForms(p.r),
      check: { kind: 'value', value: exactText(p.r) },
      wrongNote: 'That is not r. Square each coordinate, add the squares, then take the square root.',
      traps: traps(givenRSlips(p)),
    }
  } else {
    const c = p.missing
    const other: 'x' | 'y' = c === 'x' ? 'y' : 'x'
    knownWords = `${m(`${other} = ${exactTex(p[other])}`)} and ${m(`r = ${exactTex(p.r)}`)}`
    const squared = exactNum(p.r) ** 2 - exactNum(p[other]) ** 2
    const n = Math.round(squared)
    const size = abs(p[c])
    const sizeTail = exactTex(size) === `\\sqrt{${n}}` ? `\\sqrt{${n}}` : `\\sqrt{${n}} = ${exactTex(size)}`
    first = {
      id: c,
      kind: 'value',
      label: c,
      ask: `For the point with ${knownWords}, what is ${m(c)}?`,
      formatHint: R_HINT,
      nudge: `${m('x^{2} + y^{2} = r^{2}')} gives the size of ${m(c)}; where ${m('\\theta')} is gives its sign.`,
      ruleCard: UC_RULE_IDS.given,
      reveal: [
        `${m(`${c}^{2} = r^{2} - ${other}^{2} = ${sq(p.r)} - ${sq(p[other])} = ${n}`)}, so the size of ${m(c)} is ${m(sizeTail)}.`,
        `${whereReason} There ${m(c)} is ${signWord(exactNum(p[c]))}: ${m(`${c} = ${exactTex(p[c])}`)}.`,
      ],
      answerText: exactText(p[c]),
      forms: exactForms(p[c]),
      check: { kind: 'value', value: exactText(p[c]) },
      wrongNote: `That is not ${c}. Use ${c}² = r² − ${other}², then give ${c} the sign it has in that quadrant.`,
      traps: traps(givenCoordinateSlips(p, qd)),
    }
  }

  const coord: Record<'x' | 'y' | 'r', string> = { x: exactTex(p.x), y: exactTex(p.y), r: exactTex(p.r) }
  const fnParts = fns.map((f, i): TrigPart => {
    const v = givenValue(f, p)
    if (v === 'undefined') throw new LogSkip('a value that does not exist')
    const [top, bottom] = FN_RATIO[f]
    const raw = `\\frac{${coord[top]}}{${coord[bottom]}}`
    const simplified = plain(m(raw)) === plain(m(valueTex(v))) ? '' : ` = ${valueTex(v)}`
    const reveal: string[] = []
    // With tan or cot given, the signs of x and y come from where θ is: the first value is where that shows.
    if (p.missing === 'r' && i === 0) reveal.push(`${whereReason} There ${m('x')} is ${signWord(exactNum(p.x))} and ${m('y')} is ${signWord(exactNum(p.y))}: ${m(`x = ${coord.x}`)} and ${m(`y = ${coord.y}`)}.`)
    reveal.push(`${m(`\\${f}\\theta = \\frac{${top}}{${bottom}} = ${raw}${simplified}`)}${bottom !== 'r' || p.r.root === 1 ? '' : ', with the denominator rationalized'}.`)
    const answerText = valueText(v)
    return {
      id: f,
      kind: 'value',
      label: `${f} θ`,
      ask: `What is ${m(`\\${f}\\theta`)}?`,
      formatHint: GIVEN_VALUE_HINT,
      nudge: `${m(`\\${f}\\theta = \\frac{${top}}{${bottom}}`)}. Use the signs of ${m('x')} and ${m('y')} where ${m('\\theta')} is, and rationalize a square root in the denominator.`,
      ruleCard: UC_RULE_IDS.point,
      reveal,
      answerText,
      forms: exactForms(v),
      check: { kind: 'value', value: answerText, fn: f },
      wrongNote: `That is not ${f} θ. Use ${f} θ = ${top}/${bottom} with this point’s numbers and their signs.`,
      traps: traps(givenValueSlips(f, p, qd)),
    }
  })
  if (!fnParts.length) throw new Error('uc.given asks for at least one more function')

  const names = fns.map((f) => m(`\\${f}\\theta`))
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`
  const firstName = m(first.id)
  const prompt = `${m(givenEq)} and ${whereText}. For the point on the terminal side with ${knownWords}, find ${firstName}, then the exact value${names.length > 1 ? 's' : ''} of ${list}.`
  const pointLabel = `(${minus(exactSay(p.x))}, ${minus(exactSay(p.y))})`
  const waitFor = p.missing === 'r' ? fnParts[0]!.id : p.missing
  const waitWords = p.missing === 'r' ? `${fnParts[0]!.id} θ` : p.missing
  const stages = [first, ...fnParts]
  const f0 = fnParts[0]!.id as TrigFn
  const [top0, bottom0] = FN_RATIO[f0]
  const v0 = givenValue(f0, p)
  const known = p.missing === 'r' ? [exactNum(p.x), exactNum(p.y)] : [exactNum(p[p.missing === 'x' ? 'y' : 'x'])]
  return {
    question: 'given',
    prompt,
    figure: givenFigure(exactNum(p.x), exactNum(p.y), pointLabel, waitFor, waitWords),
    stages,
    promisable: stages.flatMap((s) => s.traps),
    calc: ucGivenCalc({
      missing: p.missing,
      r: p.missing === 'r' ? null : exactNum(p.r),
      known,
      size: Math.abs(exactNum(p[p.missing])),
      ratio: { fn: f0, topKeys: tiExactKeys(p[top0]), bottomKeys: tiExactKeys(p[bottom0]), topNs: nspireExactKeys(p[top0]), bottomNs: nspireExactKeys(p[bottom0]), value: v0 === 'undefined' ? 0 : exactNum(v0) },
    }),
    calcExpr: p.missing === 'r' ? `sqrt(${Math.abs(known[0]!)}^2 + ${Math.abs(known[1]!)}^2)` : `sqrt(${exactNum(p.r)}^2 - ${Math.abs(known[0]!)}^2)`,
    ruleCards: [UC_RULE_IDS.given, UC_RULE_IDS.signs, UC_RULE_IDS.point, UC_RULE_IDS.reciprocal],
  }
}

/** Primitive Pythagorean triples, no side above 41. */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [12, 35, 37],
  [9, 40, 41],
]

const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))

function until<T>(draw: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 200; i++) {
    const v = draw()
    if (ok(v)) return v
  }
  throw new LogSkip('no value found')
}

/** The size of the given value: a leg over the hypotenuse for sin and cos, the other way for csc and sec, legs for tan and cot. */
function drawSize(rng: Rng, fn: TrigFn): Q {
  const triple = rng.chance(0.6)
  if (fn === 'tan' || fn === 'cot') {
    if (triple) {
      const [a, b] = rng.pick(TRIPLES)
      return rng.chance(0.5) ? q(a, b) : q(b, a)
    }
    // From 2 up: a coordinate of 1 makes a later ratio the other coordinate itself, which the figure then shows.
    const [n, d] = until(
      () => [rng.int(2, 9), rng.int(2, 9)] as const,
      ([x, y]) => x !== y && gcd(x, y) === 1 && !isSquare(x * x + y * y),
    )
    return q(n, d)
  }
  let leg: number
  let hyp: number
  if (triple) {
    const [a, b, c] = rng.pick(TRIPLES)
    leg = rng.chance(0.5) ? a : b
    hyp = c
  } else {
    ;[leg, hyp] = until(
      () => [rng.int(2, 8), rng.int(3, 9)] as const,
      ([x, y]) => x < y && gcd(x, y) === 1 && !isSquare(y * y - x * x),
    )
  }
  return fn === 'sin' || fn === 'cos' ? q(leg, hyp) : q(hyp, leg)
}

export function drawGiven(rng: Rng): UcDrafted {
  const fn = rng.pick(['sin', 'sin', 'cos', 'cos', 'tan', 'tan', 'csc', 'sec', 'cot'] as const)
  const sign = rng.sign()
  const quadrant = rng.pick(quadrantsWithSign(fn, sign))
  const size = drawSize(rng, fn)
  const value: Q = { n: sign * size.n, d: size.d }
  const where = rng.pick(['quadrant', 'sign', 'sign', 'interval'] as const)
  // A sign that tells the two quadrants of the value's sign apart.
  const [qa, qb] = quadrantsWithSign(fn, sign) as [Quadrant, Quadrant]
  const telling = (['sin', 'cos', 'tan', 'sin', 'cos', 'tan', 'csc', 'sec', 'cot'] as TrigFn[]).filter((g) => g !== fn && g !== reciprocalFn(fn) && signIn(g, qa) !== signIn(g, qb))
  const signFn = rng.pick(telling)
  const pool = FN_ORDER.filter((f) => f !== fn && f !== reciprocalFn(fn))
  const weighted = pool.flatMap((f) => (f === 'sin' || f === 'cos' || f === 'tan' ? [f, f, f] : [f]))
  const count = rng.pick([1, 2, 2, 3] as const)
  const asked = new Set<TrigFn>()
  for (let i = 0; i < 40 && asked.size < count; i++) asked.add(rng.pick(weighted))
  return givenProblem({ fn, value, quadrant, where, signFn, intervalUnit: rng.chance(0.5) ? 'deg' : 'rad', asked: [...asked] })
}
