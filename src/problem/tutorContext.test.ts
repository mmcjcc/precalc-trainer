import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { gradeFinalAnswer } from '@/problem/inequality'
import { encodeSlotStep } from '@/problem/evenOdd'
import {
  buildTutorContext,
  verdictFromFunction,
  verdictFromSetAnswer,
  verdictFromStep,
} from '@/problem/tutorContext'
import type { Attempt, AttemptStep } from '@/store'
import type { StepResult } from '@/shared/types'

function step(text: string, revealed = false): AttemptStep {
  return { idx: 0, text, accepted: true, firstTry: !revealed, revealed, property: 'skipped' }
}

function attempt(id: string, over: Partial<Attempt> = {}): Attempt {
  return {
    id,
    problemId: 'p',
    moduleId: 'inequalities',
    templateId: 't',
    skill: 't',
    seed: '1',
    difficulty: '',
    genVersion: 1,
    mode: 'normal',
    startedAt: '2026-09-21T12:00:00.000Z',
    lastActiveAt: '2026-09-21T12:00:00.000Z',
    steps: [],
    hintsUsed: {},
    draft: '',
    nudged: false,
    swapped: false,
    currentRejections: 0,
    activeSecs: 0,
    ...over,
  }
}

function keysOf(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) keysOf(item, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      out.push(key)
      keysOf(inner, out)
    }
  }
  return out
}

describe('buildTutorContext', () => {
  it('builds a step-flow context from her lines, the canonical path, and a rejection', () => {
    const instance = generateProblem('inequalities', 'ineq.linear', 4)
    const verdict = verdictFromStep(
      {
        ok: false,
        verdict: 'not_equivalent',
        acceptableChips: [],
        pattern: {
          id: 'no_sign_flip',
          title: 'Forgot to flip the inequality',
          lesson: 'Dividing by a negative flips the inequality sign.',
          example: '−2x < 4 → x > −2',
          witness: 'You divided by −2 and kept <.',
        },
        counterexample: {
          point: { x: 0 },
          pointDisplay: 'x = 0',
          oldTruth: true,
          newTruth: false,
          message: 'At x = 0 your old line is TRUE but your new line is FALSE.',
        },
      } satisfies StepResult,
      '3x < 9',
    )
    const ctx = buildTutorContext(
      instance,
      attempt('attempt-1', { steps: [step('3x <= 9'), step('x <= 3', true)] }),
      verdict,
      false,
    )
    expect(ctx.problemId).toBe(instance.id)
    expect(ctx.attemptId).toBe('attempt-1')
    expect(ctx.moduleId).toBe('inequalities')
    expect(ctx.kind).toBe('inequality')
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.statement).toBe(instance.statementText)
    expect(ctx.instructions).toBe(instance.instructions)
    expect(ctx.work).toEqual(['3x <= 9', 'x <= 3'])
    expect(ctx.canonical).toEqual(instance.canonical.map((c) => c.text))
    expect(ctx.canonical.length).toBeGreaterThan(0)
    expect(ctx.finished).toBe(false)
    expect(ctx.revealed).toBe(true)
    expect(ctx.verdict).toMatchObject({
      status: 'rejected',
      line: '3x < 9',
      message: 'At x = 0 your old line is TRUE but your new line is FALSE.',
      mistake: {
        id: 'no_sign_flip',
        title: 'Forgot to flip the inequality',
        lesson: 'Dividing by a negative flips the inequality sign.',
        witness: 'You divided by −2 and kept <.',
      },
    })
    if (instance.answer.type === 'set') expect(ctx.answer).toBe(`${instance.answer.interval} ; ${instance.answer.setBuilder}`)
  })

  it('prefixes even/odd slot lines and leaves the canonical steps as the reference', () => {
    const instance = generateProblem('evenOdd', 'evenOdd.poly', 2)
    const ctx = buildTutorContext(
      instance,
      attempt('eo-1', {
        steps: [step(encodeSlotStep('A', '(-x)^2')), step(encodeSlotStep('B', '-(x^2)'))],
      }),
      null,
      false,
    )
    expect(ctx.kind).toBe('evenOdd')
    expect(ctx.work).toEqual(['f(-x): (-x)^2', '-f(x): -(x^2)'])
    expect(ctx.canonical).toEqual(instance.canonical.map((c) => c.text))
    if (instance.answer.type === 'parity') expect(ctx.answer).toBe(instance.answer.verdict)
    expect(ctx.verdict).toBeUndefined()
  })

  it('builds an answer-only context from the boxes she filled and the reveal sentences', () => {
    const instance = generateProblem('domainRange', 'dr.domain', 5)
    if (instance.answer.type !== 'domainRange') throw new Error('expected a domain problem')
    const ctx = buildTutorContext(
      instance,
      attempt('dr-1', { final: { fnEntries: { answer: '(-inf, 3) U (3, inf)', f: '' } } }),
      verdictFromFunction({
        verdict: 'mistake',
        mistake: 'domain_forgot_denominator',
        witness: 'The denominator x - 3 can be 0.',
      }),
      false,
    )
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.statement).toBe(`Find the domain of ${instance.statementText}`)
    expect(ctx.work).toEqual(['answer: (-inf, 3) U (3, inf)'])
    expect(ctx.canonical).toEqual(instance.answer.reveal)
    expect(ctx.answer).toBe(instance.answer.interval)
    expect(ctx.finished).toBe(false)
    expect(ctx.revealed).toBe(false)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake).toMatchObject({
      id: 'fn_domain_forgot_denominator',
      witness: 'The denominator x - 3 can be 0.',
    })
    expect(ctx.verdict?.mistake?.title).toBeTruthy()
    expect(ctx.verdict?.mistake?.lesson).toBeTruthy()
  })

  it('marks a finished chemistry problem and describes a graph in words', () => {
    const sig = generateProblem('sigFigs', 'sf.muldiv', 7)
    if (sig.answer.type !== 'sigFigs') throw new Error('expected significant figures')
    const finished = buildTutorContext(
      sig,
      attempt('sf-1', { final: { sfText: '3.0', sfPower: '', revealed: true } }),
      { status: 'correct', message: 'That measurement is right.' },
      true,
    )
    expect(finished.subject).toBe('chemistry')
    expect(finished.statement).toContain(sig.answer.prompt)
    if (sig.answer.context.trim()) expect(finished.statement).toContain(sig.answer.context.trim())
    expect(finished.work).toEqual(['coefficient: 3.0'])
    expect(finished.canonical).toEqual(sig.answer.reveal)
    expect(finished.answer).toBe(sig.answer.expectedDisplay)
    expect(finished.finished).toBe(true)
    expect(finished.revealed).toBe(true)

    const graph = generateProblem('graphFeatures', 'gf.features', 3)
    if (graph.answer.type !== 'graphFeatures') throw new Error('expected a graph problem')
    const described = buildTutorContext(graph, null, null, false)
    expect(described.statement).toContain(`${graph.answer.shape} shape`)
    expect(described.statement).toContain(`left end ${graph.answer.leftEnd}`)
    expect(described.statement).toContain(`right end ${graph.answer.rightEnd}`)
    for (const turn of graph.answer.turns) {
      expect(described.statement).toContain(`(${turn.x}, ${turn.y}) ${turn.kind}`)
    }
    expect(described.work).toEqual([])
    expect(described.attemptId).toBeUndefined()
    expect(described.canonical).toEqual(graph.answer.reveal)
  })

  it('turns a matching set answer into correct and a mismatch into the named mistake', () => {
    const instance = generateProblem('inequalities', 'ineq.linear', 8)
    if (instance.answer.type !== 'set') throw new Error('expected a set answer')
    const target = {
      set: instance.answer.set,
      requireInterval: instance.answer.requireInterval,
      requireSetBuilder: instance.answer.requireSetBuilder,
    }
    const right = verdictFromSetAnswer(gradeFinalAnswer(instance.answer.interval, instance.answer.setBuilder, target), {
      interval: instance.answer.interval,
      set: instance.answer.setBuilder,
    })
    expect(right?.status).toBe('correct')
    const wrong = verdictFromSetAnswer(gradeFinalAnswer(instance.answer.interval, '{x | x > 999}', target), {
      interval: instance.answer.interval,
      set: '{x | x > 999}',
    })
    expect(wrong?.status === 'wrong' || wrong?.status === 'parse_error').toBe(true)
    if (wrong?.mistake) {
      expect(wrong.mistake.title).toBeTruthy()
      expect(wrong.mistake.lesson).toBeTruthy()
    }
  })

  it('never adds a name, email, or account field', () => {
    const instance = generateProblem('inequalities', 'ineq.linear', 4)
    const ctx = buildTutorContext(instance, attempt('attempt-1', { steps: [step('x <= 3')] }), null, true)
    const keys = keysOf(ctx)
    expect(keys).not.toContain('email')
    expect(keys).not.toContain('name')
    expect(keys).not.toContain('user')
    expect(keys).not.toContain('student')
  })
})
