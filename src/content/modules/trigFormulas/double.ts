/**
 * ta.double — one of sin θ or cos θ is a fraction from a primitive Pythagorean triple, and θ's quadrant
 * is given. Find the other ratio (with its sign), then sin 2θ, cos 2θ and tan 2θ.
 *
 * Exclusions:
 *  - triples are primitive, so the ratios do not repeat a scaled 3-4-5. Legs are unequal, so cos 2θ is not 0
 *    and the swapped-squares trap is a different number.
 *  - |cos θ| is never 1, so sin 2θ is never twice sin θ.
 *  - an item whose double-angle value accidentally equals the given fraction is left out (the prompt would show the answer).
 *  - a positive answer that is the digits of a negative given ("3/5" inside "−3/5") is left out for the same reason.
 */
import type { TrigPart } from '@/content/types'
import { gcd } from '@/engine/trig'
import { m, showsNumber } from '../trig/text'
import { gradeExactValue, mistake } from './grade'

export const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [9, 40, 41],
  [20, 21, 29],
  [12, 35, 37],
  [28, 45, 53],
  [11, 60, 61],
  [16, 63, 65],
]

for (const [a, b, c] of TRIPLES) {
  if (a * a + b * b !== c * c) throw new Error(`not a triple: ${a}, ${b}, ${c}`)
  if (a === b) throw new Error(`legs equal: ${a}`)
}

const QUADS = [1, 2, 3, 4] as const
const ROMAN = ['', 'I', 'II', 'III', 'IV'] as const

export function fracText(n: number, d: number): string {
  if (d < 0) {
    n = -n
    d = -d
  }
  if (d === 0) throw new Error('zero denominator')
  const g = gcd(Math.abs(n), d)
  n /= g
  d /= g
  if (d === 1) return String(n)
  return `${n}/${d}`
}

function signs(q: 1 | 2 | 3 | 4): { sin: number; cos: number } {
  return { sin: q === 1 || q === 2 ? 1 : -1, cos: q === 1 || q === 4 ? 1 : -1 }
}

export interface DoubleItem {
  id: number
  given: 'sin' | 'cos'
  quad: 1 | 2 | 3 | 4
  givenText: string
  missingText: string
  sin2: string
  cos2: string
  tan2: string
  linearTrap: string
  mixTrap: string
  signTrap: string
  prompt: string
}

function buildCatalog(): DoubleItem[] {
  const out: DoubleItem[] = []
  let id = 0
  for (const triple of TRIPLES) {
    for (const leg of [0, 1] as const) {
      for (const given of ['sin', 'cos'] as const) {
        for (const quad of QUADS) {
          const hyp = triple[2]
          const givenAbs = triple[leg]!
          const otherAbs = triple[leg === 0 ? 1 : 0]!
          const { sin: sinSign, cos: cosSign } = signs(quad)
          const sNum = sinSign * (given === 'sin' ? givenAbs : otherAbs)
          const cNum = cosSign * (given === 'cos' ? givenAbs : otherAbs)
          const givenText = fracText(given === 'sin' ? sNum : cNum, hyp)
          const missingText = fracText(given === 'sin' ? cNum : sNum, hyp)
          const sin2 = fracText(2 * sNum * cNum, hyp * hyp)
          const cos2 = fracText(cNum * cNum - sNum * sNum, hyp * hyp)
          const tanDen = cNum * cNum - sNum * sNum
          if (tanDen === 0) throw new Error('cos 2θ is 0')
          const tan2 = fracText(2 * sNum * cNum, tanDen)
          const linearTrap = fracText(2 * sNum, hyp)
          const mixTrap = fracText(-(cNum * cNum - sNum * sNum), hyp * hyp)
          const signTrap = fracText(given === 'sin' ? -cNum : -sNum, hyp)
          if (linearTrap === sin2 || mixTrap === cos2 || signTrap === missingText) continue
          const answers = [missingText, sin2, cos2, tan2]
          if (answers.some((a) => a === givenText)) continue
          const shown = givenText.startsWith('-') ? `-\\frac{${givenText.slice(1).replace('/', '}{')}}` : `\\frac{${givenText.replace('/', '}{')}}`
          const missingName = given === 'sin' ? '\\cos\\theta' : '\\sin\\theta'
          const prompt =
            `Given ${m(`\\${given}\\theta = ${shown}`)} and $\\theta$ in Quadrant ${ROMAN[quad]}, ` +
            `find ${m(missingName)}, ${m('\\sin 2\\theta')}, ${m('\\cos 2\\theta')} and ${m('\\tan 2\\theta')}.`
          // "3/5" matches inside the given "−3/5" (the minus is not a boundary). Leave those out.
          if (showsNumber([prompt], answers)) continue
          out.push({
            id: id++,
            given,
            quad,
            givenText,
            missingText,
            sin2,
            cos2,
            tan2,
            linearTrap,
            mixTrap,
            signTrap,
            prompt,
          })
        }
      }
    }
  }
  if (new Set(out.map((item) => item.prompt)).size !== out.length) throw new Error('double catalog repeats a prompt')
  if (out.length < 60) throw new Error(`double catalog has only ${out.length} items`)
  return out
}

export const DOUBLE_CATALOG: readonly DoubleItem[] = buildCatalog()

const HINT = 'Exact: a whole number, a fraction, or a radical such as a√b/c. Keep the sign.'

function formsOf(text: string): string[] {
  const say = text.replace(/-/g, '−')
  return say === text ? [] : [say]
}

export function doubleStages(item: DoubleItem): TrigPart[] {
  const missingId = item.given === 'sin' ? 'cos' : 'sin'
  const missingLabel = item.given === 'sin' ? 'cos θ' : 'sin θ'
  return [
    {
      id: missingId,
      kind: 'value',
      label: missingLabel,
      ask: `What is ${missingLabel}, including the sign the quadrant gives it?`,
      formatHint: HINT,
      nudge: 'The squares of the two ratios add to one. The sign is the quadrant’s sign for this ratio, which is not always the sign you were given.',
      ruleCard: 'tf-double',
      reveal: [`${missingLabel} = ${item.missingText.replace(/-/g, '−')}.`],
      answerText: item.missingText,
      forms: formsOf(item.missingText),
      check: { kind: 'value', value: item.missingText },
      wrongNote: 'Check the Pythagorean identity, and check the sign against the quadrant.',
      traps: [mistake('ta_quadrant_sign', item.signTrap, 'That sign belongs to a different quadrant. The coordinate you are finding has its own sign there.')],
    },
    {
      id: 'sin2',
      kind: 'value',
      label: 'sin 2θ',
      ask: 'What is sin of twice the angle?',
      formatHint: HINT,
      nudge: 'Sine of a double angle is twice the product of the two ratios, not twice the sine alone.',
      ruleCard: 'tf-double',
      reveal: [`sin 2θ = ${item.sin2.replace(/-/g, '−')}.`],
      answerText: item.sin2,
      forms: formsOf(item.sin2),
      check: { kind: 'value', value: item.sin2 },
      wrongNote: 'Use twice the product of sin θ and cos θ, signs included.',
      traps: [mistake('ta_double_linear', item.linearTrap, 'Twice the sine leaves out the cosine. The double-angle formula multiplies the two ratios and then doubles.')],
    },
    {
      id: 'cos2',
      kind: 'value',
      label: 'cos 2θ',
      ask: 'What is cos of twice the angle?',
      formatHint: HINT,
      nudge: 'Cosine of a double angle is cosine squared minus sine squared, in that order.',
      ruleCard: 'tf-double',
      reveal: [`cos 2θ = ${item.cos2.replace(/-/g, '−')}.`],
      answerText: item.cos2,
      forms: formsOf(item.cos2),
      check: { kind: 'value', value: item.cos2 },
      wrongNote: 'Square each ratio and subtract sine squared from cosine squared.',
      traps: [mistake('ta_double_mix', item.mixTrap, 'The squares are in the wrong order. Cosine of the double angle is cosine squared minus sine squared.')],
    },
    {
      id: 'tan2',
      kind: 'value',
      label: 'tan 2θ',
      ask: 'What is tan of twice the angle?',
      formatHint: HINT,
      nudge: 'Tangent of a double angle is the sine of the double angle divided by the cosine of it.',
      ruleCard: 'tf-double',
      reveal: [`tan 2θ = ${item.tan2.replace(/-/g, '−')}.`],
      answerText: item.tan2,
      forms: formsOf(item.tan2),
      check: { kind: 'value', value: item.tan2 },
      wrongNote: 'Divide sin of the double angle by cos of the double angle, and reduce.',
      traps: [],
    },
  ]
}

export function gradeDoublePart(part: TrigPart, raw: string) {
  return gradeExactValue(part, raw)
}
