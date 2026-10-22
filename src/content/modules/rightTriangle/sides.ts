/**
 * rt.side: a missing side from an acute angle in degrees and one side, on the calculator in DEGREE mode, rounded as
 * asked; a plain triangle or a word problem (a ladder, a ramp, a kite string, a lighthouse and a boat, a tree's
 * shadow). The figure shows the situation, the side she knows with its length, the angle, and x on the side she is
 * asked for.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart, TrigScene } from '@/content/types'
import { linkOf, sideAnswer, sideSlips, type RtNames, type RtRole, type SideProblem } from '@/engine/trig'
import { roundPlaces } from '../explog/text'
import { rtSideCalc } from '../trig/calc'
import { m } from '../trig/text'
import { LENGTH_UNITS, decimalTraps, roundingWords, type Drafted, type LengthUnit } from './common'
import { RT_RULE_IDS } from './rules'
import { cornerWords, plainShape, roleWords, sceneShape, triangleSpec, type Scene } from './shapes'
import { STORIES, num } from './stories'
import { RT_SIDE_HINT } from './words'

export interface SideInput {
  scene: TrigScene
  /** The acute angle at the low end, whole degrees (for the lighthouse: the angle of depression, which equals it). */
  deg: number
  known: { role: RtRole; value: number }
  asked: RtRole
  places: number
  /** A word problem: which of its side cases. */
  caseIndex?: number
  /** A plain triangle: its unit (or none), the right angle's corner and the marked angle's corner. */
  unit?: 'cm' | 'in' | null
  rightAt?: 'left' | 'right'
  angleAt?: 'base' | 'top'
}

const ROLE_SAY: Record<RtRole, string> = { opp: 'the opposite side', adj: 'the adjacent side', hyp: 'the hypotenuse' }

/** How each scene's angle is said, for the figure's words. */
export const ANGLE_WORDS: Record<TrigScene, string> = {
  plain: '',
  ladder: 'the angle between the ladder and the ground',
  ramp: 'the angle between the ramp and the ground',
  kite: 'the angle between the string and the ground',
  lighthouse: 'the angle of depression, from the dashed horizontal line down to the line of sight,',
  tree: 'the angle between the sun’s ray and the ground, at the tip of the shadow',
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The side problem for these numbers (exported for the hand-worked tests). */
export function sideProblem(o: SideInput): Drafted {
  const { deg, known, asked, places } = o
  const scene = o.scene
  const story = scene === 'plain' ? null : STORIES[scene]
  const sideCase = story ? story.sides[o.caseIndex ?? 0]! : null
  if (sideCase && (sideCase.known !== known.role || sideCase.asked !== asked)) throw new Error('the case and the sides disagree')
  const unit: LengthUnit | null = story ? story.unit : o.unit ? LENGTH_UNITS[o.unit] : null
  const third: RtRole = (['opp', 'adj', 'hyp'] as RtRole[]).find((r) => r !== known.role && r !== asked)!
  const knownText = `${known.value}${unit ? ` ${unit.abbr}` : ''}`
  const names: RtNames = story ? story.names : ({ [asked]: 'x', [known.role]: `the side of ${knownText}`, [third]: 'the third side' } as RtNames)
  const depression = story?.depression
  const p: SideProblem = { deg, known, asked, names, ...(depression ? { depression } : {}) }
  const value = sideAnswer(p)
  const answerText = roundPlaces(value, places)
  const traps = decimalTraps(value, places, sideSlips(p))
  const L = linkOf(known.role, asked)
  const multiply = asked === L.top
  const A = `${deg}^{\\circ}`
  const rounding = roundingWords(places, unit)
  const unitWords = unit ? ` ${unit.name}` : ''

  const sideTex = (r: RtRole) => (r === asked ? 'x' : String(known.value))
  const reveal: string[] = []
  if (depression) reveal.push(`The angle of depression is measured down from the horizontal at the top. It equals the angle of elevation at ${depression.low}, so the angle at ${depression.low} is ${m(A)}.`)
  reveal.push(
    `From the ${m(A)} angle, ${story ? names[asked] : m('x')} is ${ROLE_SAY[asked]} and ${names[known.role]} is ${ROLE_SAY[known.role]}, so use ${L.fn}: ${m(`\\${L.fn} ${A} = \\frac{${sideTex(L.top)}}{${sideTex(L.bottom)}}`)}.`,
  )
  reveal.push(
    `${m(multiply ? `x = ${known.value} \\cdot \\${L.fn} ${A} \\approx ${value.toFixed(places + 2)}` : `x = \\frac{${known.value}}{\\${L.fn} ${A}} \\approx ${value.toFixed(places + 2)}`)}, so ${m('x')} is about ${m(answerText)}${unitWords}.`,
  )

  const part: TrigPart = {
    id: 'x',
    kind: 'decimal',
    label: 'x',
    ask: story ? `What is ${m('x')}, ${names[asked]}? ${rounding}` : `What is ${m('x')}? ${rounding}`,
    formatHint: RT_SIDE_HINT,
    nudge: `${depression ? 'An angle of depression equals the angle of elevation at the low point. ' : ''}From the angle you know, name the side you know and ${m('x')}: opposite, adjacent or hypotenuse. Pick the ratio that uses those two, solve for ${m('x')}, and work it out in DEGREE mode.`,
    ruleCard: depression ? RT_RULE_IDS.elevation : RT_RULE_IDS.side,
    reveal,
    answerText,
    forms: unit ? [`${answerText} ${unit.abbr}`, `${answerText} ${unit.name}`] : [],
    check: { kind: 'decimal', value, places, ...(unit ? { units: unit.words } : {}) },
    wrongNote: 'That does not match. Name the sides from the angle you know, pick the ratio with the side you know and x, and work it out in DEGREE mode.',
    traps,
  }

  const shape = story ? sceneShape(scene as Scene, deg) : plainShape({ theta: deg, rightAt: o.rightAt ?? 'right', thetaAt: o.angleAt ?? 'base' })
  const triangle = triangleSpec(shape, { sides: { [known.role]: { text: knownText }, [asked]: { text: 'x' } }, angle: `${deg}°` })
  const angleWords = story ? `${cap(ANGLE_WORDS[scene])} is marked ${deg}°.` : `The angle at ${cornerWords(shape, shape.mark.at)} is marked ${deg}°.`
  const sideWords = story
    ? `${cap(names[known.role])} is labelled ${knownText}, and ${names[asked]} is labelled x.`
    : `${cap(roleWords(known.role, `the ${deg}° angle`))} is labelled ${knownText}, and ${roleWords(asked, `the ${deg}° angle`)} is labelled x.`
  const ariaLabel = `${story ? `${story.picture}.` : 'A right triangle with its right angle marked.'} ${angleWords} ${sideWords}${shape.toScale ? '' : ' Not drawn to scale.'}`

  const prompt = sideCase
    ? `${sideCase.text(num(known.value), m(A))} ${sideCase.question} ${rounding}`
    : `In the right triangle shown, one acute angle is ${m(A)} and one side is ${m(String(known.value))}${unitWords}. Find ${m('x')}. ${rounding}`

  return {
    question: 'side',
    prompt,
    figure: { kind: 'triangle', deg: 0, label: '', triangle, ariaLabel },
    stages: [part],
    promisable: traps,
    calc: rtSideCalc({ fn: L.fn, angle: deg, known: known.value, multiply, value }),
    calcExpr: `${known.value}${multiply ? '*' : '/'}${L.fn}(${deg}°)`,
    ruleCards: story ? [RT_RULE_IDS.side, RT_RULE_IDS.soh, RT_RULE_IDS.elevation] : [RT_RULE_IDS.side, RT_RULE_IDS.soh],
  }
}

/** Not 30°, 45° or 60°: those are special triangles, and an exact answer would read as "rounded too far". */
const SPECIAL = [30, 45, 60]

export function drawSide(rng: Rng): Drafted {
  const places = rng.pick([0, 1, 1, 1, 2] as const)
  if (rng.chance(0.35)) {
    const roles: RtRole[] = ['opp', 'adj', 'hyp']
    const knownRole = rng.pick(roles)
    const asked = rng.pick(roles.filter((r) => r !== knownRole))
    return sideProblem({
      scene: 'plain',
      deg: rng.intExcept(15, 75, SPECIAL),
      known: { role: knownRole, value: rng.int(4, 40) },
      asked,
      places,
      unit: rng.pick(['cm', 'in', null] as const),
      rightAt: rng.chance(0.5) ? 'left' : 'right',
      angleAt: rng.chance(0.6) ? 'base' : 'top',
    })
  }
  const scene = rng.pick(['ladder', 'ramp', 'kite', 'lighthouse', 'tree'] as const)
  const story = STORIES[scene]
  const caseIndex = rng.int(0, story.sides.length - 1)
  const c = story.sides[caseIndex]!
  return sideProblem({
    scene,
    deg: rng.intExcept(story.angle[0], story.angle[1], SPECIAL),
    known: { role: c.known, value: rng.int(c.range[0], c.range[1]) },
    asked: c.asked,
    places,
    caseIndex,
  })
}
