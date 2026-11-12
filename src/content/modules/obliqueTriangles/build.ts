/**
 * Oblique triangles (precalculus Unit 7), drawn from the seed. A plan drawn from the seed alone fixes what the problem
 * is (AAS or ASA; how many triangles the ambiguous case has; SAS or SSS and whether the largest angle is asked and
 * obtuse; which area formula; which law starts), so the gate's redraws never tilt the mix; the numbers come from the
 * draw. Every problem passes the checks here and the gate (grade.ts) before it is shown; a draw that fails tries the
 * next draw from the same seed.
 */
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, ObliqueAnswer, ProblemInstance, TemplateDef } from '@/content/types'
import { LogSkip, roundPlaces } from '../explog/text'
import { minus, plain, trigSearch } from '../trig/text'
import { ambiguousProblem, drawAmbiguous } from './ambiguous'
import { drawHeron, drawSasArea, heronProblem, sasAreaProblem } from './area'
import { chooseProblem, drawChoose, type Law } from './choose'
import type { Drafted } from './common'
import { drawSas, drawSss, sasProblem, sssProblem } from './cosines'
import { assertObliqueProblem } from './grade'
import { OT_RULES } from './rules'
import { drawSines, sinesProblem } from './sines'
import { anglesOk, nearBoundary, sidesOk, type SsaCount } from './solve'
import { OT_HINTS, OT_INSTRUCTIONS, OT_TITLES } from './words'

export const OT_MODULE_ID = 'obliqueTriangles' as const
const VERSION = 1

/** Every drawn triangle is real: angles add to 180°, none under 15°, no right angle unless it is the right case. */
export function shapesReal(d: Pick<Drafted, 'shapes'>): boolean {
  return d.shapes.every((s) => {
    const [a, b, c] = s.sides as [number, number, number]
    if (!s.sides.every((x) => Number.isFinite(x) && x > 0)) return false
    if (s.right) {
      const sum = s.angles.reduce((t, x) => t + x, 0)
      return Math.abs(sum - 180) < 1e-6 && s.angles.filter((x) => Math.abs(x - 90) < 1e-6).length === 1 && s.angles.every((x) => x >= 15)
    }
    return anglesOk(s.angles) && sidesOk(a, b, c)
  })
}

/** Does a rounded answer equal a number the problem gives (at the tenth), or a typed angle equal one? */
export function answerIsGiven(d: Pick<Drafted, 'givens' | 'stages'>): boolean {
  return d.stages.some((s) => {
    if (s.kind === 'choice') return false
    const n = Number(s.answerText)
    return d.givens.some((g) => Math.abs(g - n) < 1e-9 || roundPlaces(g, 1) === s.answerText)
  })
}

/** Assemble a drafted problem: the checks, the promised slip picked by the seed, then the gate. */
export function finishOt(d: Drafted, rng: Rng): ObliqueAnswer {
  if (!shapesReal(d)) throw new LogSkip(`${d.question}: a triangle is not real enough`)
  if (d.rounded.some((v) => !Number.isFinite(v) || nearBoundary(v, 1))) throw new LogSkip(`${d.question}: an answer sits near a rounding boundary`)
  if (answerIsGiven(d)) throw new LogSkip(`${d.question}: an answer is a number the problem gives`)
  if (!d.promisable.length) throw new LogSkip(`${d.question}: no slip to promise`)
  const chosen = rng.pick(d.promisable)
  const stage = d.stages.find((s) => s.traps.includes(chosen))!
  const answer: ObliqueAnswer = {
    type: 'obliqueTriangles',
    question: d.question,
    prompt: d.prompt,
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: d.ariaLabel },
    oblique: d.oblique,
    early: d.early,
    stages: d.stages,
    expectedDisplay: d.stages.map((s) => `${s.label}: ${minus(s.kind === 'choice' ? (s.choices?.find((c) => c.value === s.answerText)?.label ?? s.answerText) : s.answerText)}`).join('; '),
    nudge: d.stages[0]!.nudge,
    ruleCard: d.stages[0]!.ruleCard,
    ruleCards: d.ruleCards,
    reveal: d.stages.flatMap((s) => s.reveal),
    trap: chosen.id,
    trapStage: stage.id,
    trapAnswer: chosen.text,
  }
  assertObliqueProblem(answer, OT_INSTRUCTIONS[d.question], OT_RULES, OT_HINTS)
  return answer
}

/** The plan: drawn from the seed alone, so a redraw keeps it. */
export function planRng(seed: number, templateSalt: number): Rng {
  return makeRng(mixSeed(seed, 7000 + templateSalt))
}

function generate<P>(templateId: string, salt: number, plan: (rng: Rng) => P, draw: (rng: Rng, plan: P) => Drafted) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const p = plan(planRng(seed, salt))
    let drafted: Drafted | null = null
    const answer = trigSearch(seed, salt, 160, (rng) => {
      drafted = draw(rng, p)
      return finishOt(drafted, rng)
    })
    const d = drafted as unknown as Drafted
    return {
      id: problemId(OT_MODULE_ID, templateId, VERSION, seed),
      moduleId: OT_MODULE_ID,
      templateId,
      skill: templateId,
      genVersion: VERSION,
      seed: seed >>> 0,
      knobs,
      kind: 'obliqueTriangles',
      title: OT_TITLES[answer.question],
      instructions: OT_INSTRUCTIONS[answer.question],
      statementText: plain(answer.prompt),
      vars: [],
      start: null,
      canonical: [],
      answer,
      graph: { kind: 'none', f: d.calcExpr },
      calc: d.calc,
      params: { question: answer.question, trap: answer.trap ?? '', trapStage: answer.trapStage ?? '', answer: answer.stages.map((s) => s.answerText).join(' | ') },
    }
  }
}

export const sinesTemplate: TemplateDef = {
  id: 'ot.sines',
  title: 'The law of sines',
  description: 'Two angles and a side (AAS or ASA): the third angle, then a side by the law of sines, to the nearest tenth.',
  version: VERSION,
  knobs: [],
  generate: generate('ot.sines', 701, (r) => (r.chance(0.5) ? ('AAS' as const) : ('ASA' as const)), (rng, kind) => sinesProblem(drawSines(rng, kind))),
}

export const ambiguousTemplate: TemplateDef = {
  id: 'ot.ambiguous',
  title: 'The ambiguous case (SSA)',
  description: 'Two sides and an angle across from one of them: how many triangles fit, from the height b sin A, then the angle B of each.',
  version: VERSION,
  knobs: [],
  generate: generate('ot.ambiguous', 702, (r) => r.pick(['none', 'one', 'two'] as const satisfies readonly SsaCount[]), (rng, count) => ambiguousProblem(drawAmbiguous(rng, count))),
}

interface CosinesPlan {
  sss: boolean
  largest: boolean
  /** SSS: the largest angle obtuse. */
  obtuse: boolean
  /** SAS: the angle between the two sides obtuse. */
  sasObtuse: boolean
}

export const cosinesTemplate: TemplateDef = {
  id: 'ot.cosines',
  title: 'The law of cosines',
  description: 'Two sides and the angle between them (the third side), or three sides (an angle, most often the largest).',
  version: VERSION,
  knobs: [],
  generate: generate<CosinesPlan>(
    'ot.cosines',
    703,
    (r) => {
      const sss = r.chance(0.55)
      return { sss, largest: r.chance(0.85), obtuse: r.chance(0.6), sasObtuse: r.chance(0.35) }
    },
    (rng, p) => (p.sss ? sssProblem(drawSss(rng, { largest: p.largest, obtuse: p.obtuse })) : sasProblem(drawSas(rng, p.sasObtuse))),
  ),
}

export const areaTemplate: TemplateDef = {
  id: 'ot.area',
  title: 'The area of a triangle',
  description: 'Area from two sides and the angle between them (½ab sin C), or from three sides by Heron’s formula.',
  version: VERSION,
  knobs: [],
  generate: generate('ot.area', 704, (r) => r.chance(0.55), (rng, sas) => (sas ? sasAreaProblem(drawSasArea(rng)) : heronProblem(drawHeron(rng)))),
}

export const chooseTemplate: TemplateDef = {
  id: 'ot.choose',
  title: 'Which law starts?',
  description: 'From what is given, the law of sines, the law of cosines, or neither (a right triangle); then the first unknown.',
  version: VERSION,
  knobs: [],
  generate: generate('ot.choose', 705, (r) => r.pick(['sines', 'sines', 'cosines', 'cosines', 'neither'] as const satisfies readonly Law[]), (rng, law) => chooseProblem(drawChoose(rng, law))),
}

export const OT_TEMPLATES = [sinesTemplate, ambiguousTemplate, cosinesTemplate, areaTemplate, chooseTemplate] as const
