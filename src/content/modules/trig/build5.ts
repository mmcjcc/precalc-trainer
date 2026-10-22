/**
 * Assembling a Unit 5 problem (sinusoids, otherTrigGraphs, inverseTrig): the promised slip picked by the seed, the gate
 * every problem passes (assertTrigProblem with the second half's leak matcher, then the numbers check below), and the
 * problem instance with its graph (behind the Graph panel's gate) and calculator steps.
 *
 * THE NUMBERS CHECK (a lesson of the Unit 4 review: a 13-foot ramp reached 13.0 feet). An answer must not equal a number
 * the problem gives, or copying that number would be right: a period of π beside a phase shift of π, a model's time equal
 * to the time asked about. The exceptions are the numbers a part reads straight off the given equation, by design: the
 * amplitude is |A|, the midline is D, a factored form shows its phase shift. Each given number lists the parts that may
 * equal it (`sources`); a draw that breaks the rule is redrawn.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs, InverseTrigAnswer, OtherTrigGraphsAnswer, ProblemInstance, ProblemKind, RuleCard, SinusoidsAnswer, TrigFigureSpec, TrigPart, TrigPartTrap } from '@/content/types'
import { exactNum, readExact, readShift } from '@/engine/trig'
import type { CalcPanels, GraphSpec, ModuleId } from '@/shared/types'
import { LogSkip } from '../explog/text'
import { assertTrigProblem } from './parts'
import { minus, plain, showsNumber, trigSearch } from './text'

export type Unit5Answer = SinusoidsAnswer | OtherTrigGraphsAnswer | InverseTrigAnswer

/** A number the problem shows, and the parts whose answer may equal it (read straight off the equation). */
export interface Given {
  value: number
  sources: readonly string[]
}

export interface Drafted5<Q extends string = string> {
  question: Q
  prompt: string
  /** The given equation or expression, drawn on its own line (math). */
  display?: string
  /** The given function of x for Graph it (app syntax), where it is not the answer. */
  graphIt?: string
  figure: TrigFigureSpec
  stages: TrigPart[]
  /** The slips the problem may promise (empty: none is possible). */
  promisable: TrigPartTrap[]
  calc: CalcPanels
  ruleCards: string[]
  /** The graph behind the Graph panel's gate (it shows answers), or none. */
  graph: GraphSpec
  givens: Given[]
}

const NO_FIGURE: TrigFigureSpec = { kind: 'none', deg: 0, label: '', ariaLabel: '' }
export const noFigure = (): TrigFigureSpec => ({ ...NO_FIGURE })

/** The single number a part's answer is, when it is one (for the numbers check); null for a set, an equation, a list. */
export function answerNumber(part: TrigPart): number | null {
  const c = part.check
  switch (c.kind) {
    case 'value':
    case 'midline': {
      const v = readExact(c.value)
      return v === null || v === 'undefined' ? null : exactNum(v)
    }
    case 'decimal':
      return Number(part.answerText)
    case 'shift': {
      const r = readShift(c.value)
      return r.ok && exactNum(r.value) !== 0 ? Math.abs(exactNum(r.value)) : null
    }
    case 'principal': {
      if (c.deg === null) return null
      const [n, d] = c.deg.split('/')
      const deg = Number(n) / (d ? Number(d) : 1)
      return c.unit === 'deg' ? deg : (deg * Math.PI) / 180
    }
    default:
      return null
  }
}

/** The parts whose answer equals a given number they may not equal. */
export function givenClashes(stages: readonly TrigPart[], givens: readonly Given[]): string[] {
  const out: string[] = []
  for (const part of stages) {
    const v = answerNumber(part)
    if (v === null) continue
    const places = part.check.kind === 'decimal' ? part.check.places : null
    for (const g of givens) {
      if (g.sources.includes(part.id)) continue
      const same = places === null ? Math.abs(Math.abs(v) - Math.abs(g.value)) <= 1e-9 * Math.max(1, Math.abs(v)) : Number(g.value.toFixed(places)) === v
      if (same) out.push(`${part.id} = ${part.answerText} is a given number`)
    }
  }
  return out
}

/** The answer fields every Unit 5 arm shares, the promised slip picked by the seed. */
export function finish5<A extends Unit5Answer>(type: A['type'], d: Drafted5<A['question']>, rng: Rng, instructions: string, cards: readonly RuleCard[], hints: readonly string[]): A {
  const clashes = givenClashes(d.stages, d.givens)
  if (clashes.length) throw new LogSkip(`${d.question}: ${clashes[0]}`)
  const chosen = d.promisable.length ? rng.pick(d.promisable) : null
  const stage = chosen ? d.stages.find((s) => s.traps.includes(chosen))! : null
  const answer = {
    type,
    question: d.question,
    prompt: d.prompt,
    ...(d.display ? { display: d.display } : {}),
    ...(d.graphIt ? { graphIt: d.graphIt } : {}),
    figure: d.figure,
    stages: d.stages,
    expectedDisplay: d.stages.map((s) => `${s.label}: ${minus(s.kind === 'choice' ? (s.choices?.find((c) => c.value === s.answerText)?.label ?? s.answerText) : s.answerText)}`).join('; '),
    nudge: d.stages[0]!.nudge,
    ruleCard: d.stages[0]!.ruleCard,
    ruleCards: d.ruleCards,
    reveal: d.stages.flatMap((s) => s.reveal),
    ...(chosen && stage ? { trap: chosen.id, trapStage: stage.id, trapAnswer: chosen.text } : {}),
  } as A
  assertTrigProblem(answer, instructions, cards, hints, showsNumber)
  return answer
}

export interface Module5 {
  moduleId: ModuleId
  kind: ProblemKind
  version: number
  titles: Record<string, string>
  instructions: Record<string, string>
  cards: readonly RuleCard[]
  hints: readonly string[]
}

/** A template's generate(): the first draw for this seed that passes the gate, as a problem instance. */
export function generate5<A extends Unit5Answer>(m: Module5, type: A['type'], templateId: string, salt: number, draw: (rng: Rng) => Drafted5<A['question']>) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    let drafted: Drafted5<A['question']> | null = null
    const answer = trigSearch(seed, salt, 120, (rng) => {
      drafted = draw(rng)
      return finish5<A>(type, drafted, rng, m.instructions[drafted.question]!, m.cards, m.hints)
    })
    const d = drafted as unknown as Drafted5<A['question']>
    return {
      id: problemId(m.moduleId, templateId, m.version, seed),
      moduleId: m.moduleId,
      templateId,
      skill: templateId,
      genVersion: m.version,
      seed: seed >>> 0,
      knobs,
      kind: m.kind,
      title: m.titles[answer.question]!,
      instructions: m.instructions[answer.question]!,
      statementText: plain(`${answer.prompt}${answer.display ? ` ${answer.display}` : ''}`),
      vars: [],
      start: null,
      canonical: [],
      answer,
      graph: d.graph,
      calc: d.calc,
      params: { question: answer.question, trap: answer.trap ?? '', trapStage: answer.trapStage ?? '', answer: answer.stages.map((s) => s.answerText).join(' | ') },
    }
  }
}

/** No graph behind the gate. */
export const NO_GRAPH: GraphSpec = { kind: 'none' }
