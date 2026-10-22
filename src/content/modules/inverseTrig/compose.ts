/**
 * it.compose: compositions with the inverse functions.
 *  - sin(arcsin 0.3) = 0.3, and no value at all for sin(arcsin 2) (the "No value" button): the inverse property, the
 *    one place an answer is the number given, by design;
 *  - arcsin(sin(5π/6)) = π/6, not 5π/6: the inside angle outside the range;
 *  - cos(arctan(3/4)) = 4/5 and tan(arcsin(−5/13)) = −5/12 with a reference triangle: where θ is (the range of the
 *    inverse decides the quadrant), the third side of the point on its terminal side, then the value;
 *  - sometimes an algebraic expression in x (cos(arcsin x) = √(1 − x²)), graded by equivalence on the domain.
 * The reference triangle never labels the side she finds before she has found it.
 */
import type { Rng } from '@/content/rng'
import type { TrigFigureSpec, TrigPart, TrigPartTrap } from '@/content/types'
import {
  INV_BASE,
  RANGE_WORDS,
  angleIn,
  cancelSlips,
  cancelValue,
  exactNum,
  exactSay,
  exactTex,
  exactText,
  givenCoordinateSlips,
  givenPoint,
  givenRSlips,
  givenValue,
  givenValueSlips,
  q,
  readExact,
  valueText,
  type InvFn,
  type Q,
  type Quadrant,
  type TrigExact,
  type TrigFn,
} from '@/engine/trig'
import { LogSkip } from '../explog/text'
import { composeCalc } from '../trig/calc5'
import { distinctFunctionTraps, functionCheck, sameForms } from '../trig/fn5'
import { exactForms } from '../trig/forms'
import { niceStep, plainGraph } from '../trig/graph5'
import { m, plain } from '../trig/text'
import { invTex, inverseGraph, type ItDrafted } from './evaluate'
import { IT_RULE_IDS } from './rules'
import { IT_EXPRESSION_HINT, IT_QUADRANT_HINT, IT_RAD_HINT, IT_RATIO_HINT, IT_SIDE_HINT, IT_VALUE_HINT } from './words'

const ROMAN: Record<Quadrant, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }
const FN_KEY: Record<string, string> = { sin: 'SIN', cos: 'COS', tan: 'TAN' }
const BASE_WORD: Record<InvFn, string> = { asin: 'sine', acos: 'cosine', atan: 'tangent' }
const outerTex = (g: TrigFn, inner: string) => `\\${g}\\left(${inner}\\right)`
/** The outer function of an inner one, as the grapher reads it: csc, sec and cot as one over sin, cos and tan. */
const outerOf = (g: TrigFn, inner: string) => (g === 'csc' ? `1/sin(${inner})` : g === 'sec' ? `1/cos(${inner})` : g === 'cot' ? `1/tan(${inner})` : `${g}(${inner})`)

/** A value's KaTeX, a decimal kept as written. */
const valueTexOf = (text: string, v: TrigExact) => (/\./.test(text) ? text : exactTex(v))

/** The core's slip sentences, with no sentence starting on a symbol: "θ is in …" → "The angle θ is in …". */
const sentence = (s: string) => s.replace(/(^|[.!?] )θ /g, '$1The angle θ ')

// ---------------------------------------------------------------------------
// sin(arcsin v), cos(arccos v), tan(arctan v)
// ---------------------------------------------------------------------------

export interface IdentityInput {
  fn: InvFn
  input: string
  notation: 0 | 1
}

export function identityProblem(o: IdentityInput): ItDrafted {
  const v = readExact(o.input)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${o.input}`)
  const base = INV_BASE[o.fn]
  const x = exactNum(v)
  const outside = o.fn !== 'atan' && Math.abs(x) > 1
  const vTex = valueTexOf(o.input, v)
  const display = m(outerTex(base, invTex(o.fn, vTex, o.notation)))
  const answerText = outside ? 'no value' : o.input
  const part: TrigPart = {
    id: 'value',
    kind: 'value',
    label: 'Value',
    ask: 'What is the value of the expression?',
    formatHint: IT_VALUE_HINT,
    nudge: `${m(`\\${base}`)} undoes ${m(`\\${o.fn === 'asin' ? 'arcsin' : o.fn === 'acos' ? 'arccos' : 'arctan'}`)} for every input the inverse takes. Check the input first.`,
    ruleCard: IT_RULE_IDS.cancel,
    reveal: outside
      ? [`A ${BASE_WORD[o.fn]} is never more than ${m('1')} or less than ${m('-1')}, so the inside, ${m(invTex(o.fn, vTex, o.notation))}, has no angle: the whole expression has no value.`]
      : [`The input ${m(vTex)} is one the inverse takes, so ${m(`\\${base}`)} undoes it: the value is ${m(vTex)}.`],
    answerText,
    forms: outside ? ['undefined', 'DNE'] : [...new Set([exactText(v), ...exactForms(v)])].filter((f) => f !== o.input),
    check: { kind: 'value', value: outside ? 'undefined' : exactText(v) },
    wrongNote: outside ? 'That is not it. Look at the inside first: can the inverse take that input?' : 'That is not the value. The function undoes its inverse here.',
    traps: outside ? [{ id: 'trig_inverse_outside_domain', text: exactText(v), witness: `You undid the inverse, but the inverse never started: a ${BASE_WORD[o.fn]} is never more than 1 or less than −1, so ${o.fn === 'asin' ? 'arcsin' : 'arccos'} only takes inputs from −1 to 1. Is this input one of them?` }] : [],
    noValue: true,
  }
  return {
    question: 'compose',
    prompt: 'Find the exact value of the expression below.',
    display,
    graphIt: `${base}(${o.fn}(x))`,
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: '' },
    stages: [part],
    promisable: part.traps,
    calc: composeCalc({ ti: `${FN_KEY[base]}( 2nd ${FN_KEY[base]} (${FN_KEY[base]}⁻¹) ${tiNum(o.input)} ) )`, ns: `${base}(${base}⁻¹(${o.input.replace(/-/g, '−')}))`, value: outside ? null : x, exact: true }),
    ruleCards: [IT_RULE_IDS.cancel, IT_RULE_IDS.ranges, IT_RULE_IDS.outside],
    // y = x where the inverse takes x; arctan's window holds its input (tan(arctan 12) = 12 is drawn at (12, 12)).
    graph: (() => {
      const reach = o.fn === 'atan' ? Math.max(4, Math.ceil(Math.abs(x)) + 2) : 2
      const step = niceStep(2 * reach, 10)
      return plainGraph((t) => (o.fn !== 'atan' && Math.abs(t) > 1 ? Number.NaN : t), {
        window: [-reach, reach],
        yWindow: [-reach, reach],
        ticks: { xStep: step, yStep: step },
        ...(outside ? {} : { markers: [{ x, y: x, label: `(${exactSay(v)}, ${exactSay(v)})` }] }),
      })
    })(),
    // The inverse property gives back the number given: the one answer allowed to equal it.
    givens: [{ value: x, sources: ['value'] }],
  }
}

function tiNum(text: string): string {
  return text.replace(/^-/, '(−) ').replace(/√(\d+)/g, '2nd x² (√) $1 )').replace(/\//g, ' ÷ ')
}

// ---------------------------------------------------------------------------
// arcsin(sin θ), arccos(cos θ), arctan(tan θ)
// ---------------------------------------------------------------------------

export interface CancelInput {
  fn: InvFn
  /** The inside angle in degrees (written in radians). */
  theta: number
  notation: 0 | 1
}

export function cancelProblem(o: CancelInput): ItDrafted {
  const base = INV_BASE[o.fn]
  const thetaQ = q(o.theta)
  const p = cancelValue(o.fn, thetaQ)
  if (!p) throw new LogSkip('no value inside')
  const thetaRad = angleIn(thetaQ, 'rad')
  const answer = angleIn(p, 'rad')
  const inner = outerTex(base, exactTex(thetaRad))
  const display = m(invTex(o.fn, inner, o.notation))
  const val = (() => {
    const t = (o.theta * Math.PI) / 180
    return base === 'sin' ? Math.sin(t) : base === 'cos' ? Math.cos(t) : Math.tan(t)
  })()
  const part: TrigPart = {
    id: 'value',
    kind: 'principal',
    label: 'Value',
    ask: 'What is the value, in radians?',
    formatHint: IT_RAD_HINT,
    nudge: `The inverse undoes ${m(`\\${base}`)} only for angles on ${RANGE_WORDS[o.fn]}. Is the angle inside there? If not, find its ${m(`\\${base}`)} first.`,
    ruleCard: IT_RULE_IDS.cancel,
    reveal: [
      `The angle ${m(exactTex(thetaRad))} is not on ${RANGE_WORDS[o.fn]}, so the inverse does not just undo ${m(`\\${base}`)}.`,
      `The angle there with the same ${BASE_WORD[o.fn]} is ${m(exactTex(answer))}: ${m(`${invTex(o.fn, inner, o.notation)} = ${exactTex(answer)}`)}.`,
    ],
    answerText: exactText(answer),
    forms: exactForms(answer).filter((f) => f !== exactText(answer)),
    check: { kind: 'principal', unit: 'rad', deg: String(p.n / p.d) },
    wrongNote: `That is not the value. Find ${m(`\\${base}`)} of the inside angle, then the angle with that ${BASE_WORD[o.fn]} on ${RANGE_WORDS[o.fn]}.`,
    traps: cancelSlips(o.fn, thetaQ).map((s) => ({ id: s.id, text: exactText(angleIn(s.deg, 'rad')), witness: s.witness })),
    noValue: true,
  }
  return {
    question: 'compose',
    prompt: 'Find the exact value of the expression below, in radians.',
    display,
    graphIt: `${o.fn}(${base}(x))`,
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: '' },
    stages: [part],
    promisable: part.traps,
    calc: composeCalc({ ti: `2nd ${FN_KEY[base]} (${FN_KEY[base]}⁻¹) ${FN_KEY[base]}( ${tiNum(exactText(thetaRad))} ) ) → ENTER`.replace(/ → ENTER$/, ''), ns: `${base}⁻¹(${base}(${exactText(thetaRad).replace(/-/g, '−')}))`, value: exactNum(answer), exact: true }),
    ruleCards: [IT_RULE_IDS.cancel, IT_RULE_IDS.ranges, IT_RULE_IDS.special],
    graph: inverseGraph(o.fn, { x: val, y: exactNum(answer), label: `(${Number(val.toFixed(3)).toString().replace('-', '−')}, ${exactSay(answer)})` }, Math.abs(val)),
    givens: [{ value: exactNum(thetaRad), sources: [] }],
  }
}

// ---------------------------------------------------------------------------
// cos(arctan(3/4)) with a reference triangle
// ---------------------------------------------------------------------------

export interface TriangleInput {
  fn: InvFn
  /** The inner input, a fraction of whole numbers in lowest terms (not a special value). */
  value: Q
  outer: TrigFn
  notation: 0 | 1
}

/** Where the inverse puts θ: arcsin and arctan Quadrant I or IV, arccos I or II. */
export function quadrantOf(fn: InvFn, v: Q): Quadrant {
  if (v.n > 0) return 1
  return fn === 'acos' ? 2 : 4
}

/** The quadrant slips: the unit circle's other angle, arcsin's way for arccos, the sign dropped. */
function quadrantTraps(fn: InvFn, v: Q): TrigPartTrap[] {
  const word = fn === 'asin' ? 'arcsin' : fn === 'acos' ? 'arccos' : 'arctan'
  const other = (qd: Quadrant): TrigPartTrap => ({
    id: 'trig_inverse_other_angle',
    text: `Q${qd}`,
    witness: `Quadrant ${ROMAN[qd]} has an angle with this ${BASE_WORD[fn]} too, but ${word} only gives angles on ${RANGE_WORDS[fn]}.`,
  })
  const dropped: TrigPartTrap = {
    id: 'trig_inverse_sign_dropped',
    text: 'Q1',
    witness: `Quadrant I is where the angle for the positive input is. This input is negative, and its sign moves the angle out of Quadrant I.`,
  }
  if (v.n > 0) return [other(fn === 'asin' ? 2 : fn === 'acos' ? 4 : 3)]
  if (fn === 'asin') return [other(3), dropped]
  if (fn === 'atan') return [other(2), dropped]
  return [
    { id: 'trig_arccos_range_as_arcsin', text: 'Q4', witness: 'Quadrant IV is where arcsin puts a negative input, but arccos never gives a negative angle: its angles are on the top half of the unit circle.' },
    other(3),
    dropped,
  ]
}

const COORD_WORDS: Record<'x' | 'y' | 'r', string> = { x: 'x', y: 'y', r: 'r' }

export function triangleProblem(o: TriangleInput): ItDrafted {
  const base = INV_BASE[o.fn]
  const qd = quadrantOf(o.fn, o.value)
  const p = givenPoint(base, o.value, qd)
  const vText = o.value.d === 1 ? String(o.value.n) : `${o.value.n}/${o.value.d}`
  const vTex = o.value.d === 1 ? String(o.value.n) : `${o.value.n < 0 ? '-' : ''}\\frac{${Math.abs(o.value.n)}}{${o.value.d}}`
  const innerTex = invTex(o.fn, vTex, o.notation)
  const display = m(outerTex(o.outer, innerTex))
  const known = (['x', 'y', 'r'] as const).filter((c) => c !== p.missing)
  const knownTex = known.map((c) => m(`${c} = ${exactTex(p[c])}`)).join(' and ')

  const quadrant: TrigPart = {
    id: 'quadrant',
    kind: 'choice',
    label: 'Quadrant of θ',
    ask: `Let ${m(`\\theta = ${innerTex}`)}. Which quadrant is ${m('\\theta')} in?`,
    formatHint: IT_QUADRANT_HINT,
    choices: ([1, 2, 3, 4] as Quadrant[]).map((k) => ({ value: `Q${k}`, label: `Quadrant ${ROMAN[k]}` })),
    nudge: `${m(`\\${o.fn === 'asin' ? 'arcsin' : o.fn === 'acos' ? 'arccos' : 'arctan'}`)} gives angles on ${RANGE_WORDS[o.fn]}. The sign of the input picks the quadrant there.`,
    ruleCard: IT_RULE_IDS.triangle,
    reveal: [`${m(`\\${base}\\theta = ${vTex}`)} is ${o.value.n > 0 ? 'positive' : 'negative'}, and ${m('\\theta')} is on ${RANGE_WORDS[o.fn]}: Quadrant ${ROMAN[qd]}.`],
    answerText: `Q${qd}`,
    forms: [],
    check: { kind: 'choice' },
    wrongNote: 'That is not where θ is. The range of the inverse function, and the sign of its input, decide.',
    traps: quadrantTraps(o.fn, o.value),
  }

  const c = p.missing
  const known0 = known[0]!
  const known1 = known[1]!
  const sq = (v: TrigExact) => (exactNum(v) < 0 || v.root > 1 ? `\\left(${exactTex(v)}\\right)^{2}` : `${exactTex(v)}^{2}`)
  const sideReveal =
    c === 'r'
      ? `${m(`r = \\sqrt{${sq(p.x)} + ${sq(p.y)}} = ${exactTex(p.r)}`)}, never negative.`
      : `${m(`${c}^{2} = r^{2} - ${known.find((k) => k !== 'r')}^{2} = ${sq(p.r)} - ${sq(p[known.find((k) => k !== 'r')!])}`)}, so ${m(`${c} = ${exactTex(p[c])}`)}, with the sign it has in Quadrant ${ROMAN[qd]}.`
  const side: TrigPart = {
    id: c,
    kind: 'value',
    label: COORD_WORDS[c],
    ask: `${m(`\\${base}\\theta = ${vTex}`)} gives the point on the terminal side of ${m('\\theta')} with ${knownTex}. What is ${m(c)}?`,
    formatHint: IT_SIDE_HINT,
    nudge: c === 'r' ? `${m('r = \\sqrt{x^{2} + y^{2}}')}, the distance from the origin, never negative.` : `${m('x^{2} + y^{2} = r^{2}')} gives the size of ${m(c)}; the quadrant gives its sign.`,
    ruleCard: IT_RULE_IDS.triangle,
    reveal: [sideReveal],
    answerText: exactText(p[c]),
    forms: exactForms(p[c]).filter((f) => f !== exactText(p[c])),
    check: { kind: 'value', value: exactText(p[c]) },
    wrongNote: `That is not ${c}. Use x² + y² = r², and the sign ${c} has in θ’s quadrant.`,
    traps: (c === 'r' ? givenRSlips(p) : givenCoordinateSlips(p, qd)).map((s) => ({ id: s.id, text: valueText(s.value), witness: sentence(s.witness) })),
  }

  const val = givenValue(o.outer, p)
  if (val === 'undefined') throw new LogSkip('a value that does not exist')
  const RATIO: Record<TrigFn, [string, string]> = { sin: ['y', 'r'], cos: ['x', 'r'], tan: ['y', 'x'], csc: ['r', 'y'], sec: ['r', 'x'], cot: ['x', 'y'] }
  const [top, bottom] = RATIO[o.outer]
  const coord = { x: exactTex(p.x), y: exactTex(p.y), r: exactTex(p.r) } as Record<string, string>
  const value: TrigPart = {
    id: o.outer,
    kind: 'value',
    label: `${o.outer} θ`,
    ask: `What is ${m(outerTex(o.outer, innerTex))}?`,
    formatHint: IT_RATIO_HINT,
    nudge: `${m(`\\${o.outer}\\theta = \\frac{${top}}{${bottom}}`)} at the point, with its signs. Rationalize a square root in the denominator.`,
    ruleCard: IT_RULE_IDS.triangle,
    reveal: [(() => {
      const raw = `\\frac{${coord[top]}}{${coord[bottom]}}`
      const tail = plain(m(raw)) === plain(m(exactTex(val))) ? '' : ` = ${exactTex(val)}`
      return `${m(`\\${o.outer}\\theta = \\frac{${top}}{${bottom}} = ${raw}${tail}`)}.`
    })()],
    answerText: exactText(val),
    forms: exactForms(val).filter((f) => f !== exactText(val)),
    check: { kind: 'value', value: exactText(val), fn: o.outer },
    wrongNote: `That is not the value. Use ${o.outer} θ = ${top}/${bottom} with this point’s numbers and their signs.`,
    traps: givenValueSlips(o.outer, p, qd).map((s) => ({ id: s.id, text: valueText(s.value), witness: sentence(s.witness) })),
  }

  const thetaDeg = (Math.atan2(exactNum(p.y), exactNum(p.x)) * 180) / Math.PI
  const legLabel = (k: 'x' | 'y' | 'r') => ({ label: exactSay(p[k]).replace(/-/g, '−'), ...(k === c ? { after: c } : {}) })
  const figure: TrigFigureSpec = {
    kind: 'point',
    deg: thetaDeg,
    label: 'θ',
    point: { x: exactNum(p.x), y: exactNum(p.y), label: '' },
    legs: { x: legLabel('x'), y: legLabel('y'), r: legLabel('r') },
    waitFor: 'quadrant',
    ariaLabel: 'Axes with the four quadrants numbered I to IV. The angle θ and its reference triangle are drawn once you have said which quadrant θ is in.',
  }
  const exactV = exactNum(val)
  const tiInner = `2nd ${FN_KEY[base]} (${FN_KEY[base]}⁻¹) ${tiNum(vText)} )`
  const outerKey = o.outer === 'csc' || o.outer === 'sec' || o.outer === 'cot' ? `1 ÷ ${FN_KEY[o.outer === 'csc' ? 'sin' : o.outer === 'sec' ? 'cos' : 'tan']}(` : `${FN_KEY[o.outer]}(`
  return {
    question: 'compose',
    prompt: 'Find the exact value of the expression below, with a reference triangle.',
    display,
    graphIt: outerOf(o.outer, `${o.fn}(x)`),
    figure,
    stages: [quadrant, side, value],
    promisable: [...quadrant.traps, ...side.traps, ...value.traps],
    calc: composeCalc({ ti: `${outerKey} ${tiInner} )`, ns: `${o.outer}(${base}⁻¹(${vText.replace(/-/g, '−')}))`, value: exactV, exact: true }),
    ruleCards: [IT_RULE_IDS.triangle, IT_RULE_IDS.ranges],
    graph: { kind: 'none' },
    givens: [
      { value: Math.abs(o.value.n), sources: [] },
      { value: o.value.d, sources: [] },
      { value: Math.abs(exactNum(p[known0])), sources: [] },
      { value: Math.abs(exactNum(p[known1])), sources: [] },
      { value: exactNum({ c: o.value, root: 1, pi: 0 }), sources: [] },
    ],
  }
}

// ---------------------------------------------------------------------------
// An algebraic expression in x
// ---------------------------------------------------------------------------

/** A piece of an answer in u (the inside of the inverse): 1, u, √(1 − u²), √(1 + u²). */
type Piece = '1' | 'u' | 'm' | 'p'

interface AlgShape {
  outer: TrigFn
  inner: InvFn
  answer: [Piece, Piece]
  traps: { id: TrigPartTrap['id']; shape: [Piece, Piece]; sign?: -1; witness: string }[]
}

const SIGN_WITNESS = (where: string) => `Your expression has the wrong sign. The angle θ is in ${where}, where this function is positive for a positive input: keep the square root positive.`

export const ALG_SHAPES: readonly AlgShape[] = [
  {
    outer: 'cos',
    inner: 'asin',
    answer: ['m', '1'],
    traps: [
      { id: 'trig_sign_quadrant', shape: ['m', '1'], sign: -1, witness: SIGN_WITNESS('Quadrant I or IV') },
      { id: 'trig_pythag_added', shape: ['p', '1'], witness: 'Your expression adds the squares. The hypotenuse is 1 and the opposite side is the input, so the adjacent side comes from subtracting the squares.' },
      { id: 'trig_sin_cos_swapped', shape: ['u', '1'], witness: 'That is sin θ, the input itself. cos θ is the adjacent side over the hypotenuse.' },
    ],
  },
  {
    outer: 'sin',
    inner: 'acos',
    answer: ['m', '1'],
    traps: [
      { id: 'trig_sign_quadrant', shape: ['m', '1'], sign: -1, witness: SIGN_WITNESS('Quadrant I or II') },
      { id: 'trig_pythag_added', shape: ['p', '1'], witness: 'Your expression adds the squares. The hypotenuse is 1 and the adjacent side is the input, so the opposite side comes from subtracting the squares.' },
      { id: 'trig_sin_cos_swapped', shape: ['u', '1'], witness: 'That is cos θ, the input itself. sin θ is the opposite side over the hypotenuse.' },
    ],
  },
  {
    outer: 'tan',
    inner: 'asin',
    answer: ['u', 'm'],
    traps: [
      { id: 'trig_tan_inverted', shape: ['m', 'u'], witness: 'That is cot θ, the adjacent side over the opposite. tan θ is opposite over adjacent.' },
      { id: 'trig_pythag_added', shape: ['u', 'p'], witness: 'Your adjacent side adds the squares. With the hypotenuse 1 and the opposite side the input, the adjacent side comes from subtracting the squares.' },
    ],
  },
  {
    outer: 'tan',
    inner: 'acos',
    answer: ['m', 'u'],
    traps: [
      { id: 'trig_tan_inverted', shape: ['u', 'm'], witness: 'That is cot θ, the adjacent side over the opposite. tan θ is opposite over adjacent.' },
      { id: 'trig_pythag_added', shape: ['p', 'u'], witness: 'Your opposite side adds the squares. With the hypotenuse 1 and the adjacent side the input, the opposite side comes from subtracting the squares.' },
    ],
  },
  {
    outer: 'sec',
    inner: 'atan',
    answer: ['p', '1'],
    traps: [
      { id: 'trig_reciprocal_missing', shape: ['1', 'p'], witness: 'That is cos θ. sec θ is its reciprocal: the hypotenuse over the adjacent side.' },
      { id: 'trig_pythag_subtracted', shape: ['m', '1'], witness: 'Your hypotenuse subtracts the squares. The legs are the input and 1, so the hypotenuse comes from adding their squares.' },
      { id: 'trig_sign_quadrant', shape: ['p', '1'], sign: -1, witness: SIGN_WITNESS('Quadrant I or IV') },
    ],
  },
  {
    outer: 'cos',
    inner: 'atan',
    answer: ['1', 'p'],
    traps: [
      { id: 'trig_reciprocal_missing', shape: ['p', '1'], witness: 'That is sec θ, the hypotenuse over the adjacent side. cos θ is its reciprocal: adjacent over hypotenuse.' },
      { id: 'trig_sin_cos_swapped', shape: ['u', 'p'], witness: 'That is sin θ, the opposite side over the hypotenuse. cos θ uses the adjacent side, 1.' },
      { id: 'trig_pythag_subtracted', shape: ['1', 'm'], witness: 'Your hypotenuse subtracts the squares. The legs are the input and 1, so the hypotenuse comes from adding their squares.' },
    ],
  },
  {
    outer: 'sin',
    inner: 'atan',
    answer: ['u', 'p'],
    traps: [
      { id: 'trig_sin_cos_swapped', shape: ['1', 'p'], witness: 'That is cos θ, the adjacent side over the hypotenuse. sin θ uses the opposite side, the input.' },
      { id: 'trig_pythag_subtracted', shape: ['u', 'm'], witness: 'Your hypotenuse subtracts the squares. The legs are the input and 1, so the hypotenuse comes from adding their squares.' },
    ],
  },
  {
    outer: 'sec',
    inner: 'asin',
    answer: ['1', 'm'],
    traps: [
      { id: 'trig_reciprocal_missing', shape: ['m', '1'], witness: 'That is cos θ. sec θ is its reciprocal: the hypotenuse over the adjacent side.' },
      { id: 'trig_reciprocal_mixed', shape: ['1', 'u'], witness: 'That is csc θ, one over sin θ. sec θ goes with cos θ: the hypotenuse over the adjacent side.' },
      { id: 'trig_pythag_added', shape: ['1', 'p'], witness: 'Your adjacent side adds the squares. With the hypotenuse 1 and the opposite side the input, it comes from subtracting the squares.' },
    ],
  },
  {
    outer: 'cot',
    inner: 'asin',
    answer: ['m', 'u'],
    traps: [
      { id: 'trig_tan_inverted', shape: ['u', 'm'], witness: 'That is tan θ, opposite over adjacent. cot θ is the other way up: adjacent over opposite.' },
      { id: 'trig_pythag_added', shape: ['p', 'u'], witness: 'Your adjacent side adds the squares. With the hypotenuse 1 and the opposite side the input, it comes from subtracting the squares.' },
    ],
  },
]

/** The pieces in x for u = x (c = 1), u = x/c (scale 'div') or u = cx (scale 'mul'), with a factor pulled out. */
function pieceText(p: Piece, c: number, scale: 'div' | 'mul'): { text: string; factor: Q } {
  const c2 = c * c
  if (p === '1') return { text: '1', factor: q(1) }
  if (c === 1) return { text: p === 'u' ? 'x' : p === 'm' ? '√(1 - x^2)' : '√(1 + x^2)', factor: q(1) }
  if (scale === 'div') {
    if (p === 'u') return { text: 'x', factor: q(1, c) }
    return { text: `√(${c2} ${p === 'm' ? '-' : '+'} x^2)`, factor: q(1, c) }
  }
  if (p === 'u') return { text: `${c}x`, factor: q(1) }
  return { text: `√(1 ${p === 'm' ? '-' : '+'} ${c2}x^2)`, factor: q(1) }
}

/** N/D in x, as she would type it, the factor written in front or underneath: √(4 - x^2)/2, x/√(9 - x^2), 2/√(4 + x^2). */
export function algText(shape: [Piece, Piece], c: number, scale: 'div' | 'mul', sign: 1 | -1 = 1): string {
  const n = pieceText(shape[0], c, scale)
  const d = pieceText(shape[1], c, scale)
  const f = q(n.factor.n * d.factor.d, n.factor.d * d.factor.n)
  const minus = sign < 0 ? '-' : ''
  const wrapD = (t: string) => (/^[\dx]+$|^√\(.*\)$/.test(t) ? t : `(${t})`)
  let top = n.text
  let bottom = d.text
  if (f.d !== 1) bottom = bottom === '1' ? String(f.d) : `${f.d}${bottom}`
  if (f.n !== 1) top = top === '1' ? String(f.n) : `${f.n}${top}`
  if (bottom === '1') return `${minus}${top}`
  return `${minus}${top}/${wrapD(bottom)}`
}

export interface AlgebraicInput {
  shape: number
  c: number
  scale: 'div' | 'mul'
  notation: 0 | 1
}

export function algebraicProblem(o: AlgebraicInput): ItDrafted {
  const s = ALG_SHAPES[o.shape]!
  const uTex = o.c === 1 ? 'x' : o.scale === 'div' ? `\\frac{x}{${o.c}}` : `${o.c}x`
  const uText = o.c === 1 ? 'x' : o.scale === 'div' ? `x/${o.c}` : `${o.c}x`
  const inner = invTex(s.inner, uTex, o.notation)
  const display = m(outerTex(s.outer, inner))
  const reach = o.scale === 'div' ? o.c : 1 / o.c
  const bounded = s.inner !== 'atan'
  const lo = bounded ? -reach : -3
  const hi = bounded ? reach : 3
  // Points where every candidate is exact: u = ±1/2, ±3/5, and zero where the answer has no u underneath.
  const us = s.answer[1] === 'u' ? [q(1, 2), q(-1, 2), q(3, 5), q(-4, 5)] : [q(0), q(1, 2), q(-1, 2), q(3, 5), q(-4, 5)]
  const xs = us.map((u) => (o.scale === 'div' ? q(u.n * o.c, u.d) : q(u.n, u.d * o.c)))
  const answerText = algText(s.answer, o.c, o.scale)
  const check = { ...functionCheck(answerText, 'x', xs.map((x) => ({ c: x, root: 1, pi: 0 })), bounded ? lo * 0.999 : lo, bounded ? hi * 0.999 : hi, true), algebraic: true }
  const traps = distinctFunctionTraps(
    check,
    s.traps.map((t) => ({ id: t.id, text: algText(t.shape, o.c, o.scale, t.sign ?? 1), witness: t.witness.replace(/u²/g, o.c === 1 ? 'x²' : `(${uText})²`).replace(/\bu\b/g, uText) })),
  )
  const forms = sameForms(check, [answerText.replace(/√\(([^()]*)\)/g, 'sqrt($1)'), answerText.replace(/\^2/g, '²')])
  const part: TrigPart = {
    id: 'expression',
    kind: 'function',
    label: 'Expression',
    ask: 'What is the expression, written without trig functions?',
    formatHint: IT_EXPRESSION_HINT,
    nudge: `Let ${m(`\\theta = ${inner}`)}: ${m(`\\${INV_BASE[s.inner]}\\theta = ${uTex}`)}. Draw θ’s right triangle with that ratio, find the third side, then read ${m(`\\${s.outer}\\theta`)} off it.`,
    ruleCard: IT_RULE_IDS.algebraic,
    reveal: [
      `Let ${m(`\\theta = ${inner}`)}, so ${m(`\\${INV_BASE[s.inner]}\\theta = ${uTex}`)}: a right triangle with ${s.inner === 'atan' ? `legs ${m(uTex)} and ${m('1')}` : `${s.inner === 'asin' ? 'opposite side' : 'adjacent side'} ${m(uTex)} and hypotenuse ${m('1')}`}.`,
      `Then ${m(`\\${s.outer}\\theta = ${answerText.replace(/√\(([^()]*)\)/g, '\\sqrt{$1}').replace(/\^2/g, '^{2}')}`)}.`,
    ],
    answerText,
    forms,
    check,
    wrongNote: 'That is not the same expression. Draw θ’s triangle, find the third side, and read the function off it.',
    traps,
  }
  const f = (x: number) => {
    const u = o.scale === 'div' ? x / o.c : x * o.c
    const t = s.inner === 'asin' ? (Math.abs(u) > 1 ? Number.NaN : Math.asin(u)) : s.inner === 'acos' ? (Math.abs(u) > 1 ? Number.NaN : Math.acos(u)) : Math.atan(u)
    const sv = Math.sin(t)
    const cv = Math.cos(t)
    return s.outer === 'sin' ? sv : s.outer === 'cos' ? cv : s.outer === 'tan' ? sv / cv : s.outer === 'sec' ? 1 / cv : s.outer === 'csc' ? 1 / sv : cv / sv
  }
  return {
    question: 'compose',
    prompt: 'Write the expression below as an algebraic expression in x.',
    display,
    graphIt: outerOf(s.outer, `${s.inner}(${uText})`),
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: '' },
    stages: [part],
    promisable: traps,
    calc: { ti84: [], nspire: [] },
    ruleCards: [IT_RULE_IDS.algebraic, IT_RULE_IDS.triangle],
    graph: plainGraph(f, { window: [lo - 0.25 * (hi - lo), hi + 0.25 * (hi - lo)], yWindow: [-3, 3], ticks: { xStep: (hi - lo) / 4 >= 1 ? 1 : 0.5, yStep: 1 } }),
    givens: [],
  }
}

// ---------------------------------------------------------------------------
// Drawing from the seed
// ---------------------------------------------------------------------------

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [12, 35, 37],
]

/** A non-special input: legs over the hypotenuse for arcsin and arccos, legs over legs for arctan; a triple or a radical. */
function drawRatio(rng: Rng, fn: InvFn): Q {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  if (rng.chance(0.65)) {
    const [a, b, c] = rng.pick(TRIPLES)
    if (fn === 'atan') return rng.chance(0.5) ? q(a, b) : q(b, a)
    return q(rng.chance(0.5) ? a : b, c)
  }
  for (let i = 0; i < 80; i++) {
    const n = rng.int(2, 8)
    const d = rng.int(3, 9)
    if (gcd(n, d) !== 1 || n === d) continue
    if (fn !== 'atan' && n >= d) continue
    const sq = fn === 'atan' ? n * n + d * d : d * d - n * n
    if (Number.isInteger(Math.sqrt(sq))) continue
    return q(n, d)
  }
  throw new LogSkip('no ratio')
}

const CANCEL_THETAS: Record<InvFn, readonly number[]> = {
  asin: [120, 135, 150, 210, 225, 240, 300, 315, 330, -120, -135, -150, -210, -240],
  acos: [-30, -45, -60, -120, -135, -150, 210, 225, 240, 300, 315, 330],
  atan: [120, 135, 150, 210, 225, 240, 300, 315, 330, -120, -135, -150],
}

const IDENTITY_IN: Record<InvFn, { inside: readonly string[]; outside: readonly string[] }> = {
  asin: { inside: ['2/3', '-3/4', '0.3', '-0.45', '4/5', '-2/7', '√5/3', '0.6'], outside: ['2', '-3/2', '5/4', '-4/3', '√3', '3'] },
  acos: { inside: ['2/3', '-3/4', '0.3', '-0.45', '4/5', '-2/7', '√5/3', '-0.6'], outside: ['2', '-3/2', '5/4', '-4/3', '√2', '-3'] },
  atan: { inside: ['7', '-5/2', '3/4', '-4', '√5', '12', '-0.8'], outside: [] },
}

export function drawCompose(rng: Rng): ItDrafted {
  const kind = rng.pick(['identity', 'identity', 'identity', 'cancel', 'cancel', 'cancel', 'cancel', 'cancel', 'cancel', 'triangle', 'triangle', 'triangle', 'triangle', 'triangle', 'triangle', 'triangle', 'triangle', 'algebraic', 'algebraic', 'algebraic'] as const)
  const fn = rng.pick(['asin', 'acos', 'atan'] as const)
  const notation = rng.chance(0.5) ? 0 : 1
  if (kind === 'identity') {
    const pool = IDENTITY_IN[fn]
    const outside = pool.outside.length > 0 && rng.chance(0.45)
    return identityProblem({ fn, input: rng.pick(outside ? pool.outside : pool.inside), notation })
  }
  if (kind === 'cancel') return cancelProblem({ fn, theta: rng.pick(CANCEL_THETAS[fn]), notation })
  if (kind === 'triangle') {
    const size = drawRatio(rng, fn)
    const value = rng.chance(0.5) ? size : q(-size.n, size.d)
    const base = INV_BASE[fn]
    const recip: Record<string, string> = { sin: 'csc', cos: 'sec', tan: 'cot' }
    const outers = (['sin', 'cos', 'tan', 'csc', 'sec', 'cot'] as TrigFn[]).filter((g) => g !== base && g !== recip[base])
    const weighted = outers.flatMap((g) => (g === 'sin' || g === 'cos' || g === 'tan' ? [g, g, g] : [g]))
    return triangleProblem({ fn, value, outer: rng.pick(weighted), notation })
  }
  const shape = rng.int(0, ALG_SHAPES.length - 1)
  const scaled = rng.chance(0.4)
  return algebraicProblem({ shape, c: scaled ? rng.pick([2, 3]) : 1, scale: rng.chance(0.6) ? 'div' : 'mul', notation })
}

