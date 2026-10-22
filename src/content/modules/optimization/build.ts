/**
 * Assembling an optimization problem: the parts from the draft, the promised slip, the gate, and the ProblemInstance.
 * Every draw comes from the seed; a draw the gate turns away is redrawn with the next salt (deterministic).
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs, OptimizationAnswer, ProblemInstance, TemplateDef } from '@/content/types'
import { LogSkip } from '../explog/text'
import { trigSearch } from '../trig/text'
import { finalQuadratic } from './model'
import { assertOptProblem, buildParts, type OptDraft } from './parts'
import { OPT_RULES } from './rules'
import { minus, plain, qTyped } from './text'
import { OPT_HINTS } from './words'

export const OPT_MODULE_ID = 'optimization' as const
export const VERSION = 1

const TITLES: Record<OptimizationAnswer['question'], string> = {
  wall: 'A pen against a wall',
  pens: 'Pens in a row',
  numbers: 'Two numbers',
  revenue: 'Price and revenue',
}

/** The draft, its parts, the promised slip (one of the brief's, picked by the seed), and the gate. */
export function finishDraft(d: OptDraft, pick: <T>(list: readonly T[]) => T): OptimizationAnswer {
  const built = buildParts(d)
  const chosen = built.promisable.length ? pick(built.promisable) : null
  const route = built.stages
  const answer: OptimizationAnswer = {
    type: 'optimization',
    question: d.question,
    prompt: d.prompt,
    quantity: d.model.quantity as OptimizationAnswer['quantity'],
    goal: d.goal,
    ...(d.figure ? { figure: d.figure } : {}),
    domain: d.domain,
    units: d.units,
    stages: built.stages,
    yStages: built.yStages,
    expectedDisplay: route.map((s) => `${s.label}: ${minus(s.kind === 'number' ? s.answerText : s.answerText.replace(/\^2/g, '²'))}`).join('; '),
    nudge: route[0]!.nudge,
    ruleCard: route[0]!.ruleCard,
    ruleCards: d.ruleCards,
    reveal: route.flatMap((s) => s.reveal),
    ...(chosen ? { trap: chosen.trap.id, trapStage: chosen.stage, trapAnswer: chosen.trap.text } : {}),
  }
  if (!chosen && built.stages.some((s) => s.traps.length > 0)) throw new LogSkip('no slip she could type')
  assertOptProblem(answer, d.instructions, OPT_RULES, OPT_HINTS)
  return answer
}

/** A template's generate(): draw, finish, and wrap as a ProblemInstance. */
export function optGenerate(templateId: string, salt: number, draw: (rng: Rng) => OptDraft) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    let drafted: OptDraft | null = null
    const answer = trigSearch(seed, salt, 96, (rng) => {
      drafted = draw(rng)
      return finishDraft(drafted, (list) => rng.pick(list))
    })
    const d = drafted as unknown as OptDraft
    return {
      id: problemId(OPT_MODULE_ID, templateId, VERSION, seed),
      moduleId: OPT_MODULE_ID,
      templateId,
      skill: templateId,
      genVersion: VERSION,
      seed: seed >>> 0,
      knobs,
      kind: 'optimization',
      title: TITLES[answer.question],
      instructions: d.instructions,
      statementText: plain(answer.prompt),
      vars: ['x', 'y'],
      start: null,
      canonical: [],
      answer,
      // No graph panel: a graph of the final equation would show its top. The calculator's "copy" gets the equation.
      graph: { kind: 'none', f: d.calcExpr },
      calc: d.calc,
      params: {
        question: answer.question,
        trap: answer.trap ?? '',
        trapStage: answer.trapStage ?? '',
        answer: answer.stages.map((s) => s.answerText).join(' | '),
        // a and b of the final equation in x, as she would type them into −b/(2a).
        a: qTyped(finalQuadratic(d.model, 'x').a),
        b: qTyped(finalQuadratic(d.model, 'x').b),
      },
    }
  }
}

export function template(id: string, title: string, description: string, salt: number, draw: (rng: Rng) => OptDraft): TemplateDef {
  return { id, title, description, version: VERSION, knobs: [], generate: optGenerate(id, salt, draw) }
}
