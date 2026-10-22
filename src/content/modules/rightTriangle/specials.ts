/**
 * rt.special: one side of a 45°-45°-90° or 30°-60°-90° triangle (a whole number, or a radical such as 4√3 or 6√2), the
 * other sides exactly, in parts. The figure marks the angles and the right angle, labels the side she is given with its
 * length and the sides she is asked for with letters (x first, then y).
 */
import type { Rng } from '@/content/rng'
import type { TrigPart } from '@/content/types'
import {
  exactAscii,
  exactInt,
  exactNum,
  exactRational,
  exactSay,
  exactTex,
  exactText,
  q,
  specialSide,
  specialSlips,
  tx,
  type RtRole,
  type SpecialRole,
  type SpecialTriangle,
  type TrigExact,
} from '@/engine/trig'
import { LogSkip } from '../explog/text'
import { nspireExactKeys, rtSpecialCalc, tiExactKeys } from '../trig/calc'
import { m } from '../trig/text'
import { exactForms, exactTraps, type Drafted } from './common'
import { RT_RULE_IDS } from './rules'
import { cornerWords, plainShape, triangleSpec } from './shapes'
import { RT_EXACT_HINT } from './words'

export interface SpecialInput {
  tri: SpecialTriangle
  given: SpecialRole
  value: TrigExact
  rightAt: 'left' | 'right'
  /** Where the 30° angle (or a 45° angle) is: the other bottom corner, or the top. */
  smallAt: 'base' | 'top'
}

/** The angle across from each side. */
const ACROSS: Record<SpecialRole, number> = { leg: 45, short: 30, long: 60, hyp: 90 }

/** The side in the figure's terms: from the small angle, the short leg is opposite and the long leg adjacent. */
const SHAPE_ROLE: Record<SpecialRole, RtRole> = { short: 'opp', long: 'adj', hyp: 'hyp', leg: 'opp' }

/** What she is asked for, in order: x, then y. */
export function askedRoles(tri: SpecialTriangle, given: SpecialRole): SpecialRole[] {
  if (tri === '45') return given === 'leg' ? ['hyp'] : ['leg']
  if (given === 'short') return ['long', 'hyp']
  if (given === 'long') return ['short', 'hyp']
  return ['short', 'long']
}

const deg = (n: number) => m(`${n}^{\\circ}`)
const TRI_TEX: Record<SpecialTriangle, string> = { '45': `${deg(45)}-${deg(45)}-${deg(90)}`, '30': `${deg(30)}-${deg(60)}-${deg(90)}` }

/** Each side in a math string, its angle in KaTeX. */
const WORDS: Record<SpecialRole, string> = {
  short: `the side across from the ${deg(30)} angle`,
  long: `the side across from the ${deg(60)} angle`,
  hyp: 'the hypotenuse',
  leg: 'the length of each leg',
}
const GIVEN_WORDS: Record<SpecialRole, string> = { ...WORDS, leg: 'one leg' }

/** The same in plain words, for the figure's description. */
const WORDS_PLAIN: Record<SpecialRole, string> = {
  short: 'the side across from the 30° angle',
  long: 'the side across from the 60° angle',
  hyp: 'the hypotenuse',
  leg: 'the length of each leg',
}
const GIVEN_PLAIN: Record<SpecialRole, string> = { ...WORDS_PLAIN, leg: 'one leg' }

function nudgeFor(tri: SpecialTriangle, from: SpecialRole, to: SpecialRole): string {
  const r2 = m('\\sqrt{2}')
  const r3 = m('\\sqrt{3}')
  const key = `${tri}:${from}>${to}`
  const n: Record<string, string> = {
    '45:leg>hyp': `In a ${TRI_TEX['45']} triangle the hypotenuse is a leg times ${r2}.`,
    '45:hyp>leg': `In a ${TRI_TEX['45']} triangle a leg is the hypotenuse divided by ${r2}. Rationalize the denominator.`,
    '30:short>long': `The long leg, across from the ${deg(60)} angle, is the short leg times ${r3}.`,
    '30:short>hyp': 'The hypotenuse is twice the short leg.',
    '30:long>short': `The long leg is the short leg times ${r3}, so divide the long leg by ${r3} and rationalize.`,
    '30:long>hyp': 'The hypotenuse is twice the short leg: use the short leg you found.',
    '30:hyp>short': `The hypotenuse is twice the short leg, the one across from the ${deg(30)} angle.`,
    '30:hyp>long': `The long leg is the short leg times ${r3}: use the short leg you found.`,
  }
  return n[key]!
}

/** The worked line for one side: the rule with this problem's numbers. */
function revealFor(tri: SpecialTriangle, from: SpecialRole, value: TrigExact, to: SpecialRole, letter: string, short: TrigExact | null): string {
  const g = exactTex(value)
  const ans = exactTex(specialSide(tri, from, value, to))
  const key = `${tri}:${from}>${to}`
  const eq = (expr: string) => (expr === ans ? `${letter} = ${ans}` : `${letter} = ${expr} = ${ans}`)
  const s = short ? exactTex(short) : ''
  const lines: Record<string, string> = {
    '45:leg>hyp': `${m(eq(`${g} \\cdot \\sqrt{2}`))}: the hypotenuse is a leg times ${m('\\sqrt{2}')}.`,
    '45:hyp>leg': `${m(eq(`\\frac{${g}}{\\sqrt{2}}`))}: a leg is the hypotenuse divided by ${m('\\sqrt{2}')}${value.root === 2 ? '' : ', with the denominator rationalized'}.`,
    '30:short>long': `${m(eq(`${g} \\cdot \\sqrt{3}`))}: the long leg is the short leg times ${m('\\sqrt{3}')}.`,
    '30:short>hyp': `${m(eq(`2 \\cdot ${g}`))}: the hypotenuse is twice the short leg.`,
    '30:long>short': `${m(eq(`\\frac{${g}}{\\sqrt{3}}`))}: the short leg is the long leg divided by ${m('\\sqrt{3}')}${value.root === 3 ? '' : ', with the denominator rationalized'}.`,
    '30:long>hyp': `${m(eq(`2 \\cdot ${s}`))}: the hypotenuse is twice the short leg.`,
    '30:hyp>short': `${m(eq(`\\frac{${g}}{2}`))}: the short leg is half the hypotenuse.`,
    '30:hyp>long': `${m(eq(`${s} \\cdot \\sqrt{3}`))}: the long leg is the short leg times ${m('\\sqrt{3}')}.`,
  }
  return lines[key]!
}

/** The special-triangle problem for this side (exported for the hand-worked tests). */
export function specialProblem(o: SpecialInput): Drafted {
  const { tri, given, value } = o
  const shape = plainShape({ theta: tri === '45' ? 45 : 30, rightAt: o.rightAt, thetaAt: o.smallAt })
  const asked = askedRoles(tri, given)
  const letters = ['x', 'y']
  const short = tri === '30' ? specialSide(tri, given, value, 'short') : null
  const stages: TrigPart[] = asked.map((to, i) => {
    const v = specialSide(tri, given, value, to)
    const letter = letters[i]!
    const answerText = exactText(v)
    return {
      id: letter,
      kind: 'value',
      label: letter,
      ask: `What is ${m(letter)}, ${WORDS[to]}? Give it exactly, in simplest radical form.`,
      formatHint: RT_EXACT_HINT,
      nudge: nudgeFor(tri, given, to),
      ruleCard: tri === '45' ? RT_RULE_IDS.special45 : RT_RULE_IDS.special30,
      reveal: [revealFor(tri, given, value, to, letter, short)],
      answerText,
      forms: exactForms(v),
      check: { kind: 'value', value: answerText },
      wrongNote: tri === '45' ? 'That is not this side. In a 45°-45°-90° triangle the legs are equal and the hypotenuse is a leg times √2.' : 'That is not this side. Find the short leg first: the hypotenuse is twice it, and the long leg is it times √3.',
      traps: exactTraps(specialSlips(tri, given, value, to)),
    }
  })

  // The figure: the given side's length, a letter on each side she is asked for (both legs x when the legs are asked).
  const sides: Partial<Record<RtRole, { text: string }>> = { [SHAPE_ROLE[given]]: { text: exactSay(value) } }
  asked.forEach((to, i) => {
    if (to === 'leg') {
      sides.opp = { text: letters[i]! }
      sides.adj = { text: letters[i]! }
    } else sides[SHAPE_ROLE[to]] = { text: letters[i]! }
  })
  const otherCorner = shape.at === 'A' ? 'B' : 'A'
  const angles = tri === '45' ? { angle: '45°', extraAngles: [{ at: otherCorner, label: '45°' }] } : { angle: '30°', extraAngles: [{ at: otherCorner, label: '60°' }] }
  const triangle = triangleSpec(shape, { sides, ...angles, ...(tri === '45' ? { equalLegs: true } : {}) })

  const find = asked.length === 1 ? m('x') : `${m('x')} and ${m('y')}`
  const prompt = `In the ${TRI_TEX[tri]} triangle shown, ${GIVEN_WORDS[given]} is ${m(exactTex(value))}. Find ${find}. Give exact answers in simplest radical form.`
  const anglesWords =
    tri === '45'
      ? 'Both acute angles are marked 45°, and tick marks show the two legs are equal.'
      : `The angle at ${cornerWords(shape, shape.at)} is marked 30° and the angle at ${cornerWords(shape, otherCorner)} is marked 60°.`
  const askedWords = asked.map((to, i) => (to === 'leg' ? `both legs are labelled ${letters[i]}` : `${WORDS_PLAIN[to]} is labelled ${letters[i]}`))
  const ariaLabel = `A right triangle with its right angle marked. ${anglesWords} ${cap(GIVEN_PLAIN[given])} is labelled ${exactSay(value)}, and ${askedWords.join(' and ')}.`

  return {
    question: 'special',
    prompt,
    figure: { kind: 'triangle', deg: 0, label: '', triangle, ariaLabel },
    stages,
    promisable: stages.flatMap((s) => s.traps),
    calc: rtSpecialCalc({
      givenKeys: tiExactKeys(value),
      givenNs: nspireExactKeys(value),
      givenAngle: ACROSS[given],
      asked: asked.map((to, i) => ({ name: letters[i]!, angle: ACROSS[to], value: exactNum(specialSide(tri, given, value, to)) })),
    }),
    calcExpr: ACROSS[given] === 90 ? `${exactAscii(value)}*sin(${ACROSS[asked[0]!]}°)` : `${exactAscii(value)}*sin(${ACROSS[asked[0]!]}°)/sin(${ACROSS[given]}°)`,
    ruleCards: tri === '45' ? [RT_RULE_IDS.special45, RT_RULE_IDS.special30, RT_RULE_IDS.pythag] : [RT_RULE_IDS.special30, RT_RULE_IDS.special45, RT_RULE_IDS.pythag],
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** No answer is a number on the rule cards (30, 45, 60, 90), or √2 or √3 alone. */
function fine(v: TrigExact): boolean {
  const r = exactRational(v)
  if (r && r.d === 1 && [30, 45, 60, 90].includes(r.n)) return false
  if ((v.root === 2 || v.root === 3) && v.c.d === 1 && Math.abs(v.c.n) === 1) return false
  return true
}

function drawValue(rng: Rng, tri: SpecialTriangle, given: SpecialRole): TrigExact {
  const whole = (lo: number, hi: number, except: number[] = []) => exactInt(rng.intExcept(lo, hi, except))
  const times = (root: number, lo: number, hi: number) => tx(q(rng.int(lo, hi)), root)
  if (tri === '45') {
    if (given === 'leg') {
      const roll = rng.int(0, 99)
      return roll < 60 ? whole(2, 14) : roll < 85 ? times(2, 2, 14) : times(3, 2, 6)
    }
    return rng.chance(0.65) ? whole(3, 28) : times(2, 2, 20)
  }
  if (given === 'short') return rng.chance(0.7) ? whole(2, 14) : times(3, 2, 9)
  if (given === 'long') return rng.chance(0.55) ? whole(2, 20, [3]) : times(3, 2, 14)
  return rng.chance(0.7) ? whole(4, 28) : times(3, 2, 9)
}

export function drawSpecial(rng: Rng): Drafted {
  const tri: SpecialTriangle = rng.chance(0.4) ? '45' : '30'
  const given: SpecialRole = tri === '45' ? (rng.chance(0.5) ? 'leg' : 'hyp') : rng.pick(['short', 'long', 'hyp'] as const)
  let value: TrigExact | null = null
  for (let i = 0; i < 200 && !value; i++) {
    const v = drawValue(rng, tri, given)
    if (fine(v) && askedRoles(tri, given).every((to) => fine(specialSide(tri, given, v, to)))) value = v
  }
  if (!value) throw new LogSkip('no side found')
  return specialProblem({ tri, given, value, rightAt: rng.chance(0.5) ? 'left' : 'right', smallAt: rng.chance(0.6) ? 'base' : 'top' })
}
