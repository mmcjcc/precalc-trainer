/**
 * rt.angle: an acute angle from two sides with sin⁻¹, cos⁻¹ or tan⁻¹ (2nd SIN, 2nd COS, 2nd TAN on the TI-84) in
 * DEGREE mode, to the nearest tenth of a degree; a plain triangle or a word problem (the same stories as rt.side, the
 * lighthouse asking for the angle of depression). The figure labels the two sides she knows and marks θ, never its
 * measure.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart, TrigScene } from '@/content/types'
import { angleAnswer, angleSlips, linkOf, type AngleProblem, type RtNames, type RtRole } from '@/engine/trig'
import { LogSkip, roundPlaces } from '../explog/text'
import { rtAngleCalc } from '../trig/calc'
import { m } from '../trig/text'
import { LENGTH_UNITS, decimalTraps, type Drafted, type LengthUnit } from './common'
import { RT_RULE_IDS } from './rules'
import { cornerWords, plainShape, roleWords, sceneShape, triangleSpec, type Scene } from './shapes'
import { ANGLE_WORDS } from './sides'
import { STORIES, num } from './stories'
import { RT_ANGLE_HINT } from './words'

export interface AngleInput {
  scene: TrigScene
  a: { role: RtRole; value: number }
  b: { role: RtRole; value: number }
  /** A word problem: which of its angle cases. */
  caseIndex?: number
  unit?: 'cm' | 'in' | null
  rightAt?: 'left' | 'right'
  angleAt?: 'base' | 'top'
}

const ROLE_SAY: Record<RtRole, string> = { opp: 'the opposite side', adj: 'the adjacent side', hyp: 'the hypotenuse' }

/** What θ is in each story, for the question. */
const THETA_WORDS: Record<TrigScene, string> = {
  plain: '',
  ladder: 'the angle the ladder makes with the ground',
  ramp: 'the angle the ramp makes with the ground',
  kite: 'the angle of elevation of the string',
  lighthouse: 'the angle of depression',
  tree: 'the angle of elevation of the sun',
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The angle problem for these sides (exported for the hand-worked tests). */
export function angleProblem(o: AngleInput): Drafted {
  const scene = o.scene
  const story = scene === 'plain' ? null : STORIES[scene]
  const angleCase = story ? story.angles[o.caseIndex ?? 0]! : null
  if (angleCase && (angleCase.a.role !== o.a.role || angleCase.b.role !== o.b.role)) throw new Error('the case and the sides disagree')
  const unit: LengthUnit | null = story ? story.unit : o.unit ? LENGTH_UNITS[o.unit] : null
  const text = (v: number) => `${v}${unit ? ` ${unit.abbr}` : ''}`
  const third: RtRole = (['opp', 'adj', 'hyp'] as RtRole[]).find((r) => r !== o.a.role && r !== o.b.role)!
  const names: RtNames = story ? story.names : ({ [o.a.role]: `the side of ${text(o.a.value)}`, [o.b.role]: `the side of ${text(o.b.value)}`, [third]: 'the third side' } as RtNames)
  const depression = story?.depression
  const p: AngleProblem = { a: o.a, b: o.b, names, ...(depression ? { depression } : {}) }
  const value = angleAnswer(p)
  const answerText = roundPlaces(value, 1)
  const traps = decimalTraps(value, 1, angleSlips(p))
  const L = linkOf(o.a.role, o.b.role)
  const v = (r: RtRole) => (o.a.role === r ? o.a.value : o.b.value)
  const top = v(L.top)
  const bottom = v(L.bottom)

  const reveal: string[] = []
  if (depression) reveal.push(`The angle of depression ${m('\\theta')} is measured down from the horizontal at the top. It equals the angle of elevation at ${depression.low}, so find the angle at ${depression.low}.`)
  reveal.push(`From ${m('\\theta')}, ${names[L.top]} is ${ROLE_SAY[L.top]} and ${names[L.bottom]} is ${ROLE_SAY[L.bottom]}, so ${m(`\\${L.fn}\\theta = \\frac{${top}}{${bottom}}`)}.`)
  reveal.push(`${m(`\\theta = \\${L.fn}^{-1}\\left(\\frac{${top}}{${bottom}}\\right) \\approx ${value.toFixed(3)}^{\\circ}`)}, so ${m('\\theta')} is about ${m(`${answerText}^{\\circ}`)}.`)

  const part: TrigPart = {
    id: 'angle',
    kind: 'decimal',
    label: 'θ',
    ask: story ? `What is ${m('\\theta')}, ${THETA_WORDS[scene]}? Round to the nearest tenth of a degree.` : `What is ${m('\\theta')}? Round to the nearest tenth of a degree.`,
    formatHint: RT_ANGLE_HINT,
    nudge: `${depression ? 'An angle of depression equals the angle of elevation at the low point. ' : ''}From ${m('\\theta')}, name the two sides you know: opposite, adjacent or hypotenuse. Pick the ratio that uses them and undo it with the inverse, 2nd SIN, 2nd COS or 2nd TAN, in DEGREE mode.`,
    ruleCard: depression ? RT_RULE_IDS.elevation : RT_RULE_IDS.angle,
    reveal,
    answerText,
    forms: [`${answerText}°`, `${answerText} degrees`],
    check: { kind: 'decimal', value, places: 1, unit: 'deg' },
    wrongNote: 'That does not match. Name the two sides you know from θ, pick the ratio, and undo it with the inverse function in DEGREE mode.',
    traps,
  }

  const shape = story ? sceneShape(scene as Scene, value) : plainShape({ theta: value, rightAt: o.rightAt ?? 'right', thetaAt: o.angleAt ?? 'base' })
  const triangle = triangleSpec(shape, { sides: { [o.a.role]: { text: text(o.a.value) }, [o.b.role]: { text: text(o.b.value) } }, angle: 'θ' })
  const angleWords = story ? `${cap(ANGLE_WORDS[scene])} is marked θ.` : `The angle θ is at ${cornerWords(shape, shape.mark.at)}.`
  const sideWords = story
    ? `${cap(names[o.a.role])} is labelled ${text(o.a.value)}, and ${names[o.b.role]} is labelled ${text(o.b.value)}.`
    : `${cap(roleWords(o.a.role, 'θ'))} is labelled ${text(o.a.value)}, and ${roleWords(o.b.role, 'θ')} is labelled ${text(o.b.value)}.`
  const ariaLabel = `${story ? `${story.picture}.` : 'A right triangle with its right angle marked.'} ${angleWords} ${sideWords}${shape.toScale ? '' : ' Not drawn to scale.'}`

  const prompt = angleCase
    ? `${angleCase.text(num(o.a.value), num(o.b.value))} ${angleCase.question} Round to the nearest tenth of a degree.`
    : `In the right triangle shown, two sides are ${m(String(o.a.value))} and ${m(String(o.b.value))}${unit ? ` ${unit.name}` : ''}. Find ${m('\\theta')} to the nearest tenth of a degree.`

  return {
    question: 'angle',
    prompt,
    figure: { kind: 'triangle', deg: 0, label: '', triangle, ariaLabel },
    stages: [part],
    promisable: traps,
    calc: rtAngleCalc({ fn: L.fn, top, bottom, value }),
    calcExpr: `${L.fn}^-1(${top}/${bottom})`,
    ruleCards: story ? [RT_RULE_IDS.angle, RT_RULE_IDS.soh, RT_RULE_IDS.elevation] : [RT_RULE_IDS.angle, RT_RULE_IDS.soh],
  }
}

/** Not within a few hundredths of 30°, 45° or 60°: those are special triangles, worked exactly. */
const nearSpecial = (deg: number) => [30, 45, 60].some((s) => Math.abs(deg - s) < 0.06)

export function drawAngle(rng: Rng): Drafted {
  if (rng.chance(0.35)) {
    const pairs: [RtRole, RtRole][] = [
      ['opp', 'hyp'],
      ['adj', 'hyp'],
      ['opp', 'adj'],
    ]
    const [ra, rb] = rng.pick(pairs)
    for (let i = 0; i < 200; i++) {
      const va = rng.int(3, 40)
      const vb = rng.int(3, 40)
      if (va === vb) continue
      if (rb === 'hyp' && va >= vb) continue
      const deg = angleAnswer({ a: { role: ra, value: va }, b: { role: rb, value: vb }, names: { opp: '', adj: '', hyp: '' } })
      if (deg < 12 || deg > 78 || nearSpecial(deg)) continue
      return angleProblem({
        scene: 'plain',
        a: { role: ra, value: va },
        b: { role: rb, value: vb },
        unit: rng.pick(['cm', 'in', null] as const),
        rightAt: rng.chance(0.5) ? 'left' : 'right',
        angleAt: rng.chance(0.6) ? 'base' : 'top',
      })
    }
    throw new LogSkip('no triangle found')
  }
  const scene = rng.pick(['ladder', 'ramp', 'kite', 'lighthouse', 'tree'] as const)
  const story = STORIES[scene]
  const caseIndex = rng.int(0, story.angles.length - 1)
  const c = story.angles[caseIndex]!
  for (let i = 0; i < 200; i++) {
    const a = { role: c.a.role, value: rng.int(c.a.range[0], c.a.range[1]) }
    const b = { role: c.b.role, value: rng.int(c.b.range[0], c.b.range[1]) }
    const hyp = a.role === 'hyp' ? a.value : b.role === 'hyp' ? b.value : null
    const leg = a.role === 'hyp' ? b.value : a.value
    if (hyp !== null && leg >= hyp) continue
    const deg = angleAnswer({ a, b, names: story.names })
    if (deg < story.angle[0] - 2 || deg > story.angle[1] + 2 || nearSpecial(deg)) continue
    return angleProblem({ scene, a, b, caseIndex })
  }
  throw new LogSkip('no story found')
}
