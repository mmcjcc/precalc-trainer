/**
 * Right triangle trigonometry (precalculus Unit 4, second half), drawn from the seed: the triangle's sides, the angle,
 * which ratios, the word problem's story and numbers. Answers and slips come from the trig core (engine/trig); every
 * problem passes the gate (`assertTrigProblem` with the second half's leak matcher) before it is shown, and a seed
 * whose draw fails it tries the next draw from the same seed.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, RightTriangleAnswer, TemplateDef } from '@/content/types'
import { LogSkip } from '../explog/text'
import { assertTrigProblem } from '../trig/parts'
import { minus, plain, showsNumber, trigSearch } from '../trig/text'
import { drawAngle } from './angles'
import type { Drafted } from './common'
import { drawRatios } from './ratios'
import { RT_RULES } from './rules'
import { drawSide } from './sides'
import { drawSpecial } from './specials'
import { RT_HINTS, RT_INSTRUCTIONS, RT_TITLES } from './words'

export const RT_MODULE_ID = 'rightTriangle' as const
const VERSION = 1

/** Assemble a drafted problem: the promised slip picked by the seed, then the gate. */
export function finishRt(d: Drafted, rng: Rng): RightTriangleAnswer {
  // Every problem here can promise a slip; a draw whose slips all round to the answer is redrawn.
  if (!d.promisable.length) throw new LogSkip(`${d.question}: no slip to promise`)
  // A rounded answer equal to a number she is given would be right for copying it (found in review: a 13-foot ramp at
  // 3° reaches 13.0 feet along the ground): redrawn.
  if (answerIsGiven(d)) throw new LogSkip(`${d.question}: the answer is a number the problem gives`)
  const chosen = rng.pick(d.promisable)
  const stage = d.stages.find((s) => s.traps.includes(chosen))!
  const answer: RightTriangleAnswer = {
    type: 'rightTriangle',
    question: d.question,
    prompt: d.prompt,
    figure: d.figure,
    stages: d.stages,
    expectedDisplay: d.stages.map((s) => `${s.label}: ${minus(s.answerText)}`).join('; '),
    nudge: d.stages[0]!.nudge,
    ruleCard: d.stages[0]!.ruleCard,
    ruleCards: d.ruleCards,
    reveal: d.stages.flatMap((s) => s.reveal),
    trap: chosen.id,
    trapStage: stage.id,
    trapAnswer: chosen.text,
  }
  assertTrigProblem(answer, RT_INSTRUCTIONS[d.question], RT_RULES, RT_HINTS, showsNumber)
  return answer
}

/** Does a rounded part's answer equal, at its own places, a number the prompt shows (a length or an angle)? */
export function answerIsGiven(d: Pick<Drafted, 'prompt' | 'stages'>): boolean {
  const givens = [...d.prompt.matchAll(/\$(\d+(?:\.\d+)?)(?:\^\{\\circ\})?\$/g)].map((g) => Number(g[1]))
  return d.stages.some((s) => s.check.kind === 'decimal' && givens.some((g) => Number(g.toFixed((s.check as { places: number }).places)) === Number(s.answerText)))
}

function generate(templateId: string, salt: number, draw: (rng: Rng) => Drafted) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    let drafted: Drafted | null = null
    const answer = trigSearch(seed, salt, 96, (rng) => {
      drafted = draw(rng)
      return finishRt(drafted, rng)
    })
    const d = drafted as unknown as Drafted
    return {
      id: problemId(RT_MODULE_ID, templateId, VERSION, seed),
      moduleId: RT_MODULE_ID,
      templateId,
      skill: templateId,
      genVersion: VERSION,
      seed: seed >>> 0,
      knobs,
      kind: 'rightTriangle',
      title: RT_TITLES[answer.question],
      instructions: RT_INSTRUCTIONS[answer.question],
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

export const ratiosTemplate: TemplateDef = {
  id: 'rt.ratios',
  title: 'Right-triangle ratios',
  description: 'Two sides of a right triangle: the third side first, then one, two or three of the six ratios of an acute angle, exactly.',
  version: VERSION,
  knobs: [],
  generate: generate('rt.ratios', 81, drawRatios),
}

export const specialTemplate: TemplateDef = {
  id: 'rt.special',
  title: 'Special right triangles',
  description: 'One side of a 45°-45°-90° or 30°-60°-90° triangle, a whole number or a radical; the other sides exactly.',
  version: VERSION,
  knobs: [],
  generate: generate('rt.special', 82, drawSpecial),
}

export const sideTemplate: TemplateDef = {
  id: 'rt.side',
  title: 'A side from an angle',
  description: 'A missing side from an acute angle and one side, in DEGREE mode, rounded as asked; ladders, ramps, kites, lighthouses and shadows.',
  version: VERSION,
  knobs: [],
  generate: generate('rt.side', 83, drawSide),
}

export const angleTemplate: TemplateDef = {
  id: 'rt.angle',
  title: 'An angle from two sides',
  description: 'An acute angle from two sides with sin⁻¹, cos⁻¹ or tan⁻¹, to the nearest tenth of a degree; angles of elevation and depression.',
  version: VERSION,
  knobs: [],
  generate: generate('rt.angle', 84, drawAngle),
}

export const RT_TEMPLATES = [ratiosTemplate, specialTemplate, sideTemplate, angleTemplate] as const
