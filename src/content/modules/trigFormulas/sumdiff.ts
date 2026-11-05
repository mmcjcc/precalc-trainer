/**
 * ta.sumdiff — exact sin, cos, tan, csc, sec or cot of 15°, 75°, 105°, 165° (and the radian twins
 * π/12, 5π/12, 7π/12, 11π/12) from a sum or difference.
 *
 * Exclusions (a choice has one right answer, so the other one is not offered):
 *  - each item uses one split only. The other split that also equals the angle (60° − 45° when the
 *    item uses 45° − 30°, and the twins of the other three angles) is not a choice.
 *  - a special-angle split that adds up to a DIFFERENT angle is an ordinary wrong choice, not ta_bad_split.
 *  - ta_bad_split is a split that uses an angle that is not on the unit circle (50° − 35°, and the rest of BAD).
 *  - ta_cos_sign is only the sign inside cos(A ± B), so only cosine and secant items carry it.
 *    A tangent denominator flip is an ordinary wrong choice, not that id.
 *  - the value is a sum of unlike radicals. The house grader cannot store it as one TrigExact; grade.ts accepts it
 *    numerically. csc, sec and cot ask for the base formula (sin, cos, tan) and the value is the reciprocal.
 */
import type { TrigFn } from '@/engine/trig'
import { readTrigAnswer } from '@/engine/trig'
import type { TrigPart } from '@/content/types'
import { m } from '../trig/text'
import { gradeChoice, gradeExactValue, mistake } from './grade'

export type SumFn = TrigFn

const ANGLES = [15, 75, 105, 165] as const
const FNS: readonly SumFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']
const WORDINGS = ['Find the exact value of', 'Give the exact value of', 'What is the exact value of'] as const

const RADIAN: Record<(typeof ANGLES)[number], string> = {
  15: '\\frac{\\pi}{12}',
  75: '\\frac{5\\pi}{12}',
  105: '\\frac{7\\pi}{12}',
  165: '\\frac{11\\pi}{12}',
}

/**
 * Canonical exact values, ASCII hyphen and √. Checked against Math at load (see assertSumTable).
 * Reciprocals are the simplified forms: csc 15° = √6 + √2, not 4/(√6 − √2).
 */
export const SUM_EXACT: Record<string, string> = {
  sin15: '(√6-√2)/4',
  cos15: '(√6+√2)/4',
  tan15: '2-√3',
  csc15: '√6+√2',
  sec15: '√6-√2',
  cot15: '2+√3',
  sin75: '(√6+√2)/4',
  cos75: '(√6-√2)/4',
  tan75: '2+√3',
  csc75: '√6-√2',
  sec75: '√6+√2',
  cot75: '2-√3',
  sin105: '(√6+√2)/4',
  cos105: '(√2-√6)/4',
  tan105: '-2-√3',
  csc105: '√6-√2',
  sec105: '-(√6+√2)',
  cot105: '√3-2',
  sin165: '(√6-√2)/4',
  cos165: '-(√6+√2)/4',
  tan165: '√3-2',
  csc165: '√6+√2',
  sec165: '-(√6-√2)',
  cot165: '-(2+√3)',
}

function mathFn(fn: SumFn, deg: number): number {
  const x = (deg * Math.PI) / 180
  const s = Math.sin(x)
  const c = Math.cos(x)
  if (fn === 'sin') return s
  if (fn === 'cos') return c
  if (fn === 'tan') return s / c
  if (fn === 'csc') return 1 / s
  if (fn === 'sec') return 1 / c
  return c / s
}

/** Throws if a stored exact value disagrees with Math. Run at load so a bad string never reaches a student. */
export function assertSumTable(): void {
  for (const deg of ANGLES) {
    for (const fn of FNS) {
      const text = SUM_EXACT[`${fn}${deg}`]
      if (!text) throw new Error(`missing exact value ${fn}${deg}`)
      const read = readTrigAnswer(text)
      if (!read.ok || read.kind !== 'number') throw new Error(`${fn}${deg}: ${text} did not read`)
      const want = mathFn(fn, deg)
      const tol = 1e-9 * Math.max(1, Math.abs(want))
      if (Math.abs(read.approx - want) > tol) throw new Error(`${fn}${deg}: ${text} is ${read.approx}, want ${want}`)
    }
  }
}

assertSumTable()

interface Split {
  a: number
  b: number
  op: '+' | '-'
}

/** The two splits that equal each angle. An item uses one; the other is not offered. */
const SPLITS: Record<(typeof ANGLES)[number], readonly [Split, Split]> = {
  15: [
    { a: 45, b: 30, op: '-' },
    { a: 60, b: 45, op: '-' },
  ],
  75: [
    { a: 45, b: 30, op: '+' },
    { a: 120, b: 45, op: '-' },
  ],
  105: [
    { a: 60, b: 45, op: '+' },
    { a: 150, b: 45, op: '-' },
  ],
  165: [
    { a: 135, b: 30, op: '+' },
    { a: 120, b: 45, op: '+' },
  ],
}

/** Not on the unit circle: at least one angle is outside 0°, 30°, 45°, 60°, 90°, 120°, 135°, 150°, 180°. */
const BAD: readonly Split[] = [
  { a: 50, b: 35, op: '-' },
  { a: 70, b: 55, op: '-' },
  { a: 10, b: 5, op: '+' },
  { a: 50, b: 25, op: '+' },
  { a: 100, b: 25, op: '-' },
  { a: 70, b: 35, op: '+' },
  { a: 100, b: 65, op: '+' },
]

/** Unit-circle splits used as the ordinary wrong choice (they equal a different angle). */
const SPECIAL: readonly Split[] = [
  { a: 45, b: 30, op: '+' },
  { a: 45, b: 30, op: '-' },
  { a: 60, b: 45, op: '+' },
  { a: 60, b: 45, op: '-' },
  { a: 90, b: 45, op: '+' },
  { a: 90, b: 30, op: '-' },
  { a: 120, b: 45, op: '+' },
  { a: 180, b: 45, op: '-' },
]

const sameSplit = (p: Split, q: Split) => p.a === q.a && p.b === q.b && p.op === q.op

function splitLabel(s: Split): string {
  const sign = s.op === '+' ? '+' : '−'
  return `${s.a}° ${sign} ${s.b}°`
}

type Base = 'sin' | 'cos' | 'tan'

function baseOf(fn: SumFn): Base {
  if (fn === 'csc') return 'sin'
  if (fn === 'sec') return 'cos'
  if (fn === 'cot') return 'tan'
  return fn
}

function expand(base: Base, s: Split): string {
  const A = `${s.a}°`
  const B = `${s.b}°`
  if (base === 'sin') {
    const sign = s.op === '+' ? '+' : '−'
    return `sin ${A} cos ${B} ${sign} cos ${A} sin ${B}`
  }
  if (base === 'cos') {
    // cos(A + B) carries the minus; cos(A − B) carries the plus.
    const sign = s.op === '+' ? '−' : '+'
    return `cos ${A} cos ${B} ${sign} sin ${A} sin ${B}`
  }
  const num = s.op === '+' ? `tan ${A} + tan ${B}` : `tan ${A} − tan ${B}`
  const den = s.op === '+' ? `1 − tan ${A} tan ${B}` : `1 + tan ${A} tan ${B}`
  return `(${num})/(${den})`
}

function flipped(base: Base, s: Split): string {
  const A = `${s.a}°`
  const B = `${s.b}°`
  if (base === 'sin') {
    const sign = s.op === '+' ? '−' : '+'
    return `sin ${A} cos ${B} ${sign} cos ${A} sin ${B}`
  }
  if (base === 'cos') {
    const sign = s.op === '+' ? '+' : '−'
    return `cos ${A} cos ${B} ${sign} sin ${A} sin ${B}`
  }
  const num = s.op === '+' ? `tan ${A} + tan ${B}` : `tan ${A} − tan ${B}`
  const den = s.op === '+' ? `1 + tan ${A} tan ${B}` : `1 − tan ${A} tan ${B}`
  return `(${num})/(${den})`
}

/** The other function's expansion, which is ta_formula_mix. */
function mixed(base: Base, s: Split): string {
  const other: Base = base === 'sin' ? 'cos' : 'sin'
  return expand(other, s)
}

export interface SumItem {
  id: number
  fn: SumFn
  deg: number
  unit: 'deg' | 'rad'
  wording: string
  split: Split
  exact: string
  prompt: string
}

function buildCatalog(): SumItem[] {
  const out: SumItem[] = []
  let id = 0
  for (let w = 0; w < WORDINGS.length; w++) {
    for (const deg of ANGLES) {
      for (const unit of ['deg', 'rad'] as const) {
        for (let f = 0; f < FNS.length; f++) {
          const fn = FNS[f]!
          // One split per statement. The bit mixes which legitimate split is taught; the other is not a choice.
          const split = SPLITS[deg][(w + (unit === 'rad' ? 1 : 0) + f) % 2]!
          const angle = unit === 'deg' ? `${deg}^{\\circ}` : RADIAN[deg]
          const prompt = `${WORDINGS[w]} ${m(`\\${fn} ${angle}`)}.`
          out.push({ id: id++, fn, deg, unit, wording: WORDINGS[w]!, split, exact: SUM_EXACT[`${fn}${deg}`]!, prompt })
        }
      }
    }
  }
  const statements = new Set(out.map((item) => item.prompt))
  if (statements.size !== out.length) throw new Error('sumdiff catalog repeats a prompt')
  return out
}

export const SUM_CATALOG: readonly SumItem[] = buildCatalog()

const VALUE_HINT = 'Exact: a whole number, a fraction, or a radical such as a√b/c.'

function sumForms(text: string): string[] {
  const ascii = text.replace(/−/g, '-')
  const say = ascii.replace(/-/g, '−')
  const sqrt = ascii.replace(/√(\d+)/g, 'sqrt($1)')
  return [...new Set([text, ascii, say, sqrt])]
}

export function sumStages(item: SumItem): TrigPart[] {
  const base = baseOf(item.fn)
  const bad = BAD[item.id % BAD.length]!
  const other = SPECIAL.find((s) => !sameSplit(s, item.split) && !sameSplit(s, bad) && (s.op === '+' ? s.a + s.b : s.a - s.b) !== item.deg)
  if (!other) throw new Error('no ordinary wrong split')
  const formulaOk = expand(base, item.split)
  const formulaMix = mixed(base, item.split)
  const formulaFlip = flipped(base, item.split)
  if (new Set([formulaOk, formulaMix, formulaFlip]).size !== 3) throw new Error(`formula lines collided for ${item.fn} ${item.deg}`)

  const cosSign = base === 'cos'
  const formulaChoices = [
    { value: 'ok', label: formulaOk },
    { value: 'mix', label: formulaMix },
    { value: 'flip', label: formulaFlip },
  ]
  const formulaTraps = [
    mistake('ta_formula_mix', 'mix', 'That line is the other function’s formula. Sine adds the crossed products; cosine multiplies matching functions.'),
  ]
  if (cosSign) {
    formulaTraps.push(
      mistake('ta_cos_sign', 'flip', 'The sign in the middle of the cosine formula goes the other way. Adding the angles puts a minus between the products; subtracting them puts a plus.'),
    )
  }

  const who = item.fn === base ? `the ${base} formula` : `the ${base} formula (then take the reciprocal for ${item.fn})`
  const valueForms = sumForms(item.exact).filter((form) => gradeExactValue(valueProbe(item.exact), form).verdict === 'correct')

  return [
    {
      id: 'split',
      kind: 'choice',
      label: 'Split the angle',
      ask: 'Which sum or difference of unit-circle angles equals this angle?',
      formatHint: 'Choose one.',
      choices: [
        { value: 'ok', label: splitLabel(item.split) },
        { value: 'bad', label: splitLabel(bad) },
        { value: 'other', label: splitLabel(other) },
      ],
      nudge: 'Use two angles you already know from the unit circle: 30°, 45°, 60° or 90°, added or subtracted.',
      ruleCard: 'tf-sum',
      reveal: [`${item.deg}° = ${splitLabel(item.split)}.`],
      answerText: 'ok',
      forms: [],
      check: { kind: 'choice' },
      wrongNote: 'That split is not this angle. Add or subtract the two angles and see what you get.',
      traps: [mistake('ta_bad_split', 'bad', 'Those angles are not on the unit circle you have memorized. Use 30°, 45°, 60° or 90°.')],
    },
    {
      id: 'formula',
      kind: 'choice',
      label: 'Expand the formula',
      ask: `Which line is ${who}, written out for your split?`,
      formatHint: 'Choose one.',
      choices: formulaChoices,
      nudge: 'Write the sum or difference formula for this function, then put each angle in its place. Watch the sign in the middle.',
      ruleCard: 'tf-sum',
      reveal: [formulaOk],
      answerText: 'ok',
      forms: [],
      check: { kind: 'choice' },
      wrongNote: 'That is not the expansion for this function and this split. Check which formula you used and the sign in the middle.',
      traps: formulaTraps,
    },
    {
      id: 'value',
      kind: 'value',
      label: 'Exact value',
      ask: `What is the exact value of ${item.fn} of this angle?`,
      formatHint: VALUE_HINT,
      nudge: 'Multiply the unit-circle values, then combine like radicals. A reciprocal is one over that result, simplified.',
      ruleCard: 'tf-sum',
      reveal: [`The exact value is ${m(texOfExact(item.exact))}.`],
      answerText: item.exact,
      forms: valueForms.filter((form) => form !== item.exact),
      check: { kind: 'value', value: item.exact },
      wrongNote: 'That value does not match the formula. Check each unit-circle value and the sign.',
      traps: [],
    },
  ]
}

/** A stand-in part so sumForms can ask the real grader which spellings it accepts. */
function valueProbe(exact: string): TrigPart {
  return {
    id: 'value',
    kind: 'value',
    label: 'Exact value',
    ask: '',
    formatHint: '',
    nudge: '',
    ruleCard: 'tf-sum',
    reveal: [],
    answerText: exact,
    forms: [],
    check: { kind: 'value', value: exact },
    wrongNote: 'no',
    traps: [],
  }
}

/** Enough TeX for the reveal line. The reader’s own spelling is not required to be pretty. */
function texOfExact(text: string): string {
  return text
    .replace(/√(\d+)/g, '\\sqrt{$1}')
    .replace(/-/g, '-')
}

export function gradeSumPart(part: TrigPart, raw: string) {
  if (part.kind === 'choice') return gradeChoice(part, raw)
  if (part.kind === 'value') return gradeExactValue(part, raw)
  throw new Error(`sumdiff has no ${part.kind} part`)
}
