/**
 * ta.half — cos θ is a rational fraction (never 0, 1 or −1) and θ lies in a range. Find sin, cos or tan of θ/2.
 *
 * Exclusions:
 *  - cos θ is ±1 or 0, so the swapped formula (1 + cos versus 1 − cos) is a different number, and θ/2 is defined.
 *  - the asked function is one whose sign in θ's quadrant disagrees with its sign in θ/2's quadrant,
 *    so copying the sign from θ is actually wrong.
 *  - positive cosine only with θ in quadrant IV (between 3π/2 and 2π). Negative cosine with θ in quadrant II,
 *    quadrant III, or the negative-angle twin of quadrant III (between −π and −π/2).
 *  - the value is one term (a fraction or a single radical), so the house grader can check it after the trap is claimed.
 *  - a value that is the digits of the given cosine ("3/5" inside "−3/5") is left out; the prompt would show it.
 */
import type { TrigPart } from '@/content/types'
import { gcd } from '@/engine/trig'
import { m, showsNumber } from '../trig/text'
import { gradeChoice, gradeExactValue, mistake } from './grade'
import { fracText } from './double'

const COS_ABS: readonly (readonly [number, number])[] = [
  [3, 5],
  [4, 5],
  [5, 13],
  [12, 13],
  [8, 17],
  [15, 17],
  [7, 25],
  [24, 25],
  [9, 41],
  [40, 41],
  [20, 29],
  [21, 29],
  [12, 37],
  [35, 37],
]

type Quad = 1 | 2 | 3 | 4
type HalfFn = 'sin' | 'cos' | 'tan'

interface RangeSpec {
  id: string
  /** cos θ's sign on this range. */
  sign: 1 | -1
  thetaQ: Quad
  halfQ: Quad
  lo: string
  hi: string
  fns: readonly HalfFn[]
}

/**
 * θ/2's quadrant is not θ's, and the asked functions are exactly the ones whose signs disagree.
 * Quadrant I: all positive. II: sine. III: tangent. IV: cosine.
 */
const RANGES: readonly RangeSpec[] = [
  { id: 'q2', sign: -1, thetaQ: 2, halfQ: 1, lo: '\\frac{\\pi}{2}', hi: '\\pi', fns: ['cos', 'tan'] },
  { id: 'q3', sign: -1, thetaQ: 3, halfQ: 2, lo: '\\pi', hi: '\\frac{3\\pi}{2}', fns: ['sin', 'tan'] },
  { id: 'q4', sign: 1, thetaQ: 4, halfQ: 2, lo: '\\frac{3\\pi}{2}', hi: '2\\pi', fns: ['sin', 'cos'] },
  { id: 'q3n', sign: -1, thetaQ: 3, halfQ: 4, lo: '-\\pi', hi: '-\\frac{\\pi}{2}', fns: ['cos', 'tan'] },
]

const QUAD_NAME = ['', 'Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV']

function positive(fn: HalfFn, q: Quad): boolean {
  if (q === 1) return true
  if (q === 2) return fn === 'sin'
  if (q === 3) return fn === 'tan'
  return fn === 'cos'
}

/** √(n/d) in simplest radical form, positive. */
export function sqrtRational(n: number, d: number): string {
  if (n < 0 || d <= 0) throw new Error(`sqrt of ${n}/${d}`)
  if (n === 0) return '0'
  const g = gcd(n, d)
  n /= g
  d /= g
  let rad = n * d
  let coeff = 1
  for (let k = 2; k * k <= rad; k++) {
    while (rad % (k * k) === 0) {
      rad /= k * k
      coeff *= k
    }
  }
  const g2 = gcd(coeff, d)
  coeff /= g2
  d /= g2
  if (rad === 1) return fracText(coeff, d)
  const body = coeff === 1 ? `√${rad}` : `${coeff}√${rad}`
  return d === 1 ? body : `${body}/${d}`
}

function signed(sign: number, mag: string): string {
  if (sign > 0 || mag === '0') return mag
  return `-${mag}`
}

export interface HalfItem {
  id: number
  fn: HalfFn
  cosText: string
  halfQ: Quad
  thetaQ: Quad
  sign: '+' | '−'
  value: string
  swap: string
  rangeId: string
  lo: string
  hi: string
  prompt: string
}

function magnitude(fn: HalfFn, num: number, den: number): string {
  // cos = num/den. sin half √((1−cos)/2), cos half √((1+cos)/2), tan half √((1−cos)/(1+cos)).
  if (fn === 'sin') return sqrtRational(den - num, 2 * den)
  if (fn === 'cos') return sqrtRational(den + num, 2 * den)
  if (den + num === 0 || den - num === 0) throw new Error('half angle of ±1')
  return sqrtRational(den - num, den + num)
}

function buildCatalog(): HalfItem[] {
  const out: HalfItem[] = []
  let id = 0
  for (const [a, b] of COS_ABS) {
    for (const range of RANGES) {
      if (range.sign > 0 && range.id !== 'q4') continue
      const num = range.sign * a
      const den = b
      const cosText = fracText(num, den)
      for (const fn of range.fns) {
        if (positive(fn, range.halfQ) === positive(fn, range.thetaQ)) {
          throw new Error(`${fn} signs agree on ${range.id}; it should not be asked`)
        }
        const mag = magnitude(fn, num, den)
        const swapMag = fn === 'sin' ? magnitude('cos', num, den) : fn === 'cos' ? magnitude('sin', num, den) : sqrtRational(den + num, den - num)
        const sign = positive(fn, range.halfQ) ? 1 : -1
        const value = signed(sign, mag)
        const swap = signed(sign, swapMag)
        if (value === swap) continue
        if (value === cosText || swap === cosText) continue
        const shown = cosText.startsWith('-') ? `-\\frac{${a}}{${b}}` : `\\frac{${a}}{${b}}`
        const prompt =
          `Given ${m(`\\cos\\theta = ${shown}`)} and $\\theta$ between ${m(range.lo)} and ${m(range.hi)}, ` +
          `find ${m(`\\${fn}\\frac{\\theta}{2}`)}.`
        // "3/5" matches inside the given "−3/5". Leave the item out rather than show the answer.
        if (showsNumber([prompt], [value])) continue
        out.push({
          id: id++,
          fn,
          cosText,
          halfQ: range.halfQ,
          thetaQ: range.thetaQ,
          sign: sign > 0 ? '+' : '−',
          value,
          swap,
          rangeId: range.id,
          lo: range.lo,
          hi: range.hi,
          prompt,
        })
      }
    }
  }
  if (new Set(out.map((item) => item.prompt)).size !== out.length) throw new Error('half catalog repeats a prompt')
  if (out.length < 60) throw new Error(`half catalog has only ${out.length} items`)
  return out
}

export const HALF_CATALOG: readonly HalfItem[] = buildCatalog()

const HINT = 'Exact: a whole number, a fraction, or a radical such as a√b/c. Keep the sign.'

function formsOf(text: string): string[] {
  const say = text.replace(/-/g, '−')
  const sqrt = text.replace(/√(\d+)/g, 'sqrt($1)')
  return [...new Set([say, sqrt])].filter((form) => form !== text)
}

export function halfStages(item: HalfItem): TrigPart[] {
  const wrongSign = item.sign === '+' ? '−' : '+'
  return [
    {
      id: 'quadrant',
      kind: 'choice',
      label: 'Quadrant of θ/2',
      ask: 'Which quadrant does θ/2 land in?',
      formatHint: 'Choose one.',
      choices: [1, 2, 3, 4].map((q) => ({ value: String(q), label: QUAD_NAME[q]! })),
      nudge: 'Cut the given range in half. The quadrant of θ/2 is not the quadrant of θ.',
      ruleCard: 'tf-half',
      reveal: [`θ/2 is in ${QUAD_NAME[item.halfQ]}.`],
      answerText: String(item.halfQ),
      forms: [],
      check: { kind: 'choice' },
      wrongNote: 'Halve the ends of the interval and see which quadrant that is.',
      traps: [],
    },
    {
      id: 'sign',
      kind: 'choice',
      label: 'Sign',
      ask: `Is ${item.fn}(θ/2) positive or negative?`,
      formatHint: 'Choose one.',
      choices: [
        { value: '+', label: 'positive' },
        { value: '−', label: 'negative' },
      ],
      nudge: 'The sign is the sign of this function in the quadrant θ/2 landed in, not the sign it had for θ.',
      ruleCard: 'tf-half',
      reveal: [`${item.fn}(θ/2) is ${item.sign === '+' ? 'positive' : 'negative'}.`],
      answerText: item.sign,
      forms: [],
      check: { kind: 'choice' },
      wrongNote: 'Use the quadrant of the half angle, not the quadrant of θ.',
      traps: [mistake('ta_half_sign', wrongSign, 'That is the sign for θ, not for θ/2. The half angle is in a different quadrant.')],
    },
    {
      id: 'value',
      kind: 'value',
      label: 'Exact value',
      ask: `What is the exact value of ${item.fn}(θ/2)?`,
      formatHint: HINT,
      nudge: 'Sine of a half angle takes one minus cosine under the root; cosine takes one plus cosine. Tangent is the quotient of those two, one minus over one plus. Then attach the sign you chose.',
      ruleCard: 'tf-half',
      reveal: [`${item.fn}(θ/2) = ${item.value.replace(/-/g, '−')}.`],
      answerText: item.value,
      forms: formsOf(item.value),
      check: { kind: 'value', value: item.value },
      wrongNote: 'Check which of one minus cosine or one plus cosine belongs under the root, then simplify.',
      traps: [mistake('ta_half_swap', item.swap, 'The plus and the minus swapped places. Sine of a half angle uses one minus cosine; cosine uses one plus cosine; tangent puts one minus on top.')],
    },
  ]
}

export function gradeHalfPart(part: TrigPart, raw: string) {
  if (part.kind === 'choice') return gradeChoice(part, raw)
  return gradeExactValue(part, raw)
}
