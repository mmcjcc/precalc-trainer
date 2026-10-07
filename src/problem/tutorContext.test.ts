import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { OpsMistakeId } from '@/content/modules/functionOps/ops'
import { gradeLightAnswer } from '@/content/modules/electrons/grade'
import { SD_KEYS, gradeDivisionStage } from '@/content/modules/polyDivision'
import { canonicalEntries, gradeZerosStage } from '@/content/modules/polyZeros'
import { checkSquareLine, configurationMistakes, gradeAxisOfSymmetry, gradeConfiguration, gradeVertex, squareMistakes, syntheticMistakes, vertexMistakes } from '@/engine'
import { ratToString } from '@/notation'
import { gradeFinalAnswer } from '@/problem/inequality'
import { encodeSlotStep } from '@/problem/evenOdd'
import {
  buildTutorContext,
  verdictFromSigFig,
  verdictFromFunction,
  verdictFromSetAnswer,
  verdictFromStep,
  verdictFromEconfig,
  verdictFromPoly,
  verdictFromTransform,
  verdictFromOps,
  verdictFromPw,
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

  it('describes a light calculation, including a named lt_ mistake', () => {
    let instance = generateProblem('electrons', 'light.freq', 1)
    for (let seed = 1; seed <= 40 && !(instance.answer.type === 'electrons' && instance.answer.question.kind === 'light' && instance.answer.question.wavelengthText === '620'); seed++) {
      instance = generateProblem('electrons', 'light.freq', seed)
    }
    if (instance.answer.type !== 'electrons' || instance.answer.question.kind !== 'light') throw new Error('expected a light problem')
    const grade = gradeLightAnswer(instance.answer.question, '4.8e5')
    expect(grade.pattern?.id).toBe('lt_no_conversion')
    const ctx = buildTutorContext(
      instance,
      attempt('el-1', { final: { sfText: '4.8', sfPower: '5' } }),
      verdictFromSigFig(grade),
      false,
    )
    expect(ctx.subject).toBe('chemistry')
    expect(ctx.kind).toBe('electrons')
    expect(ctx.moduleId).toBe('electrons')
    expect(ctx.statement).toContain(instance.answer.prompt)
    expect(ctx.statement).toContain('620 nm')
    expect(ctx.work).toEqual(['coefficient: 4.8', 'power: 5'])
    expect(ctx.canonical).toEqual(instance.answer.reveal)
    expect(ctx.answer).toBe(instance.answer.expectedDisplay)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake?.id).toBe('lt_no_conversion')
    expect(ctx.verdict?.mistake?.title).toBeTruthy()
    expect(ctx.verdict?.mistake?.lesson).toBeTruthy()
    expect(ctx.verdict?.mistake?.witness).toContain('620')

    const order = generateProblem('electrons', 'light.spectrum', 1)
    if (order.answer.type !== 'electrons' || order.answer.question.kind !== 'order') throw new Error('expected an ordering problem')
    const ordered = buildTutorContext(order, attempt('el-2', { final: { ltOrder: order.answer.question.order } }), null, false)
    expect(ordered.kind).toBe('electrons')
    expect(ordered.statement).toContain(order.answer.prompt)
    expect(ordered.answer).toBe(order.answer.expectedDisplay)
    expect(ordered.work[0]).toContain('order:')
    expect(ordered.canonical).toEqual(order.answer.reveal)
  })

  it('builds a transformation context and a piecewise context with the named mistake', () => {
    const described = generateProblem('transformations', 'tr.describe', 1)
    if (described.answer.type !== 'transformations') throw new Error('expected a transformation')
    const describedCtx = buildTutorContext(
      described,
      attempt('tr-1', { final: { fnEntries: { answer: 'shift left 3', steps: '[]' } } }),
      verdictFromTransform({ verdict: 'mistake', mistake: 'h_shift_reversed', witness: 'The inside moves the graph right, not left.' }),
      false,
    )
    expect(describedCtx.subject).toBe('precalculus')
    expect(describedCtx.kind).toBe('transformations')
    expect(describedCtx.moduleId).toBe('transformations')
    expect(describedCtx.statement).toContain('g(x)')
    expect(describedCtx.work).toContain('answer: shift left 3')
    expect(describedCtx.canonical).toEqual(described.answer.reveal)
    expect(describedCtx.answer).toBe(described.answer.sentences.join('; '))
    expect(describedCtx.verdict?.status).toBe('wrong')
    expect(describedCtx.verdict?.mistake).toMatchObject({
      id: 'tr_h_shift_reversed',
      witness: 'The inside moves the graph right, not left.',
    })
    expect(describedCtx.verdict?.mistake?.title).toBeTruthy()
    expect(describedCtx.verdict?.mistake?.lesson).toBeTruthy()

    const rate = generateProblem('piecewiseRate', 'arc.rate', 1)
    if (rate.answer.type !== 'piecewiseRate') throw new Error('expected a rate')
    const rateCtx = buildTutorContext(
      rate,
      attempt('pw-1', { final: { fnEntries: { answer: '15' } } }),
      verdictFromTransform({ verdict: 'mistake', mistake: 'rate_no_division', witness: '15 is the change in f. Divide by the change in x.' }),
      false,
    )
    expect(rateCtx.subject).toBe('precalculus')
    expect(rateCtx.kind).toBe('piecewiseRate')
    expect(rateCtx.statement).toContain('Average rate of change')
    expect(rateCtx.work).toEqual(['answer: 15'])
    expect(rateCtx.canonical).toEqual(rate.answer.reveal)
    expect(rateCtx.answer).toBe(rate.answer.rateText)
    expect(rateCtx.verdict?.mistake?.id).toBe('rate_no_division')
    expect(rateCtx.verdict?.mistake?.lesson).toBeTruthy()
  })

  it('answers a piecewise graph, domain, continuity, and written function, not the rate', () => {
    const graph = generateProblem('piecewiseRate', 'pw.graph', 1)
    if (graph.answer.type !== 'piecewiseRate' || graph.answer.question !== 'graph') throw new Error('expected a graph')
    const graphAnswer = (graph.answer.asks ?? []).map((ask) => `f(${ask.x}) = ${ask.valueText}`).join(' | ')
    const graphCtx = buildTutorContext(graph, attempt('pw-g'), null, false)
    expect(graphCtx.answer).toBe(graphAnswer)
    expect(graphCtx.answer).not.toContain('Average rate')
    expect(graphCtx.kind).toBe('piecewiseRate')

    const domain = generateProblem('piecewiseRate', 'pw.domain', 2)
    if (domain.answer.type !== 'piecewiseRate' || !domain.answer.domainText || !domain.answer.rangeText) throw new Error('expected a domain')
    const domainCtx = buildTutorContext(
      domain,
      attempt('pw-d'),
      verdictFromPw({ verdict: 'mistake', id: 'pw_domain_gap', witness: 'That fills a gap the pieces leave out.', message: 'That fills a gap the pieces leave out.' }),
      false,
    )
    expect(domainCtx.answer).toBe(`${domain.answer.domainText} | ${domain.answer.rangeText}`)
    expect(domainCtx.verdict?.mistake).toMatchObject({ id: 'pw_domain_gap' })
    expect(domainCtx.verdict?.mistake?.title).toBeTruthy()
    expect(domainCtx.verdict?.mistake?.lesson).toBeTruthy()

    const found = generateProblem('piecewiseRate', 'pw.continuous', 1)
    if (found.answer.type !== 'piecewiseRate' || !found.answer.kText) throw new Error('expected continuity')
    expect(buildTutorContext(found, attempt('pw-k'), null, false).answer).toBe(found.answer.kText)

    const written = generateProblem('piecewiseRate', 'pw.write', 1)
    if (written.answer.type !== 'piecewiseRate' || !written.answer.rows) throw new Error('expected a written function')
    const rows = written.answer.rows.map((row) => `${row.formula} for ${row.condition}`).join(' | ')
    expect(buildTutorContext(written, attempt('pw-w'), null, false).answer).toBe(rows)
  })

  it('describes an electron configuration, including a named ec_ mistake', () => {
    let instance = generateProblem('electrons', 'ec.shorthand', 1)
    let wrongText = ''
    for (let seed = 1; seed <= 80; seed++) {
      instance = generateProblem('electrons', 'ec.shorthand', seed)
      if (instance.answer.type !== 'electrons' || instance.answer.question.kind !== 'econfig') continue
      const q = instance.answer.question
      const cand = configurationMistakes(q.species, q.form ?? 'shorthand')?.find((c) => c.kind === 'filling_order')
      if (!cand) continue
      wrongText = cand.text
      break
    }
    if (instance.answer.type !== 'electrons' || instance.answer.question.kind !== 'econfig' || !wrongText) throw new Error('expected a shorthand problem')
    const q = instance.answer.question
    const grade = gradeConfiguration(q.species, wrongText, { form: q.form })
    expect(grade.verdict).toBe('mistake')
    if (grade.verdict !== 'mistake') return
    const ctx = buildTutorContext(instance, attempt('ec-1', { final: { ecText: wrongText } }), verdictFromEconfig([grade]), false)
    expect(ctx.subject).toBe('chemistry')
    expect(ctx.kind).toBe('electrons')
    expect(ctx.moduleId).toBe('electrons')
    expect(ctx.title).toBe('Noble-gas shorthand')
    expect(ctx.statement).toContain(instance.answer.prompt)
    expect(ctx.statement).toContain(instance.answer.context)
    expect(ctx.work).toEqual([`answer: ${wrongText}`])
    expect(ctx.canonical).toEqual(instance.answer.reveal)
    expect(ctx.answer).toBe(instance.answer.expectedDisplay)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake?.id).toBe('ec_filling_order')
    expect(ctx.verdict?.mistake?.title).toBeTruthy()
    expect(ctx.verdict?.mistake?.lesson).toBeTruthy()
    expect(ctx.verdict?.mistake?.witness).toBe(grade.witness)

    const invalid = verdictFromEconfig([{ verdict: 'invalid', message: 'Write how many electrons are in 2s, like 2s2.' }])
    expect(invalid?.status).toBe('parse_error')
    expect(invalid?.mistake).toBeUndefined()

    const diagram = generateProblem('electrons', 'ec.diagram', 1)
    if (diagram.answer.type !== 'electrons' || diagram.answer.question.kind !== 'econfig') throw new Error('expected a diagram')
    const drawn = buildTutorContext(diagram, attempt('ec-2', { final: { ecText: '2', ecDiagram: 'uu u u' } }), null, false)
    expect(drawn.statement).toContain(diagram.answer.question.subshell)
    expect(drawn.work).toEqual(['answer: 2', 'diagram: uu u u'])
    expect(drawn.answer).toBe(diagram.answer.expectedDisplay)
    expect(drawn.canonical).toEqual(diagram.answer.reveal)
    expect(drawn.instructions).toContain('unpaired')
  })

  it('describes completing the square line by line, including a named poly_ mistake', () => {
    const instance = generateProblem('quadratics', 'cs.form', 6)
    if (instance.answer.type !== 'quadratics') throw new Error('expected a quadratics problem')
    const a = instance.answer
    const cand = squareMistakes(a.f)!.find((c) => c.shadows.length === 0)!
    const grade = checkSquareLine(a.f, cand.text)
    expect(grade.verdict).toBe('mistake')
    if (grade.verdict !== 'mistake') return
    const kept = a.path[1]!.text
    const ctx = buildTutorContext(instance, attempt('cs-1', { moduleId: 'quadratics', steps: [step(kept)] }), verdictFromPoly([grade], cand.text), false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('quadratics')
    expect(ctx.moduleId).toBe('quadratics')
    expect(ctx.title).toBe('Rewrite in vertex form')
    expect(ctx.statement).toBe(`f(x) = ${a.f}. ${a.prompt}`)
    expect(ctx.work).toEqual([kept])
    expect(ctx.canonical).toEqual(a.reveal)
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.finished).toBe(false)
    expect(ctx.revealed).toBe(false)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.line).toBe(cand.text)
    expect(ctx.verdict?.mistake?.id).toBe(`poly_${cand.kind}`)
    expect(ctx.verdict?.mistake?.title).toBeTruthy()
    expect(ctx.verdict?.mistake?.lesson).toBeTruthy()
    expect(ctx.verdict?.mistake?.witness).toBe(grade.witness)

    const legal = verdictFromPoly([checkSquareLine(a.f, kept)], kept)
    expect(legal).toMatchObject({ status: 'correct', line: kept, message: 'This line is still equal to f(x).' })
    const unreadable = verdictFromPoly([checkSquareLine(a.f, `${kept} +`)])
    expect(unreadable?.status).toBe('parse_error')
    expect(unreadable?.mistake).toBeUndefined()
    const plain = verdictFromPoly([checkSquareLine(a.f, 'x + 1')])
    expect(plain?.status).toBe('wrong')
    expect(plain?.mistake).toBeUndefined()
    expect(verdictFromPoly([])).toBeNull()
  })

  it('describes the vertex question from her boxes, and one check made of several grades', () => {
    const instance = generateProblem('quadratics', 'cs.vertex', 6)
    if (instance.answer.type !== 'quadratics') throw new Error('expected a quadratics problem')
    const a = instance.answer
    const wrong = vertexMistakes(a.f)!.find((c) => c.kind === 'cs_h_sign')!
    const grades = [gradeVertex(a.f, wrong.text), gradeAxisOfSymmetry(a.f, a.axisText)]
    const final = { polyEntries: { extremumValue: a.extremumText, vertex: wrong.text, opens: a.opens, axis: a.axisText, extremumKind: a.extremumKind }, revealed: true }
    const ctx = buildTutorContext(instance, attempt('cs-2', { moduleId: 'quadratics', final }), verdictFromPoly(grades), true)
    expect(ctx.kind).toBe('quadratics')
    expect(ctx.statement).toContain(a.f)
    expect(ctx.statement).toContain(a.prompt)
    // Reading order, whatever order the boxes were stored in.
    expect(ctx.work).toEqual([`vertex: ${wrong.text}`, `axis: ${a.axisText}`, `opens: ${a.opens}`, `extremumKind: ${a.extremumKind}`, `extremumValue: ${a.extremumText}`])
    expect(ctx.canonical).toEqual(a.reveal)
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.answer).toContain('vertex')
    expect(ctx.finished).toBe(true)
    expect(ctx.revealed).toBe(true)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake?.id).toBe('poly_cs_h_sign')

    const right = verdictFromPoly([gradeVertex(a.f, a.vertexText), gradeAxisOfSymmetry(a.f, a.axisText)])
    expect(right?.status).toBe('correct')
    expect(right?.message).toContain('the vertex is')
    expect(right?.message).toContain('axis of symmetry')
    // One unreadable box makes the whole check a parse error, even beside a named mistake.
    expect(verdictFromPoly([gradeVertex(a.f, wrong.text), gradeAxisOfSymmetry(a.f, 'y = 3')])?.status).toBe('parse_error')
  })

  it('describes a synthetic-division table from her cells, row by row, with the named slip', () => {
    const instance = generateProblem('polyDivision', 'sd.table', 6)
    if (instance.answer.type !== 'polyDivision') throw new Error('expected a polyDivision problem')
    const a = instance.answer
    const row = a.rows.coefficients.join(', ')
    // The right number in the box, every product subtracted: the same bottom row as −c in the box gives.
    const sign = syntheticMistakes(a.f, a.c)!.find((c) => c.kind === 'sd_wrong_sign_c')!
    const entries: Record<string, string> = { [SD_KEYS.row]: row, [SD_KEYS.box]: a.c }
    sign.bottom.forEach((v, i) => (entries[SD_KEYS.bottom(i)] = ratToString(v)))
    sign.products.forEach((v, i) => (entries[SD_KEYS.product(i + 1)] = ratToString({ n: -v.n, d: v.d })))
    const grades = gradeDivisionStage(a, 'grid', entries).parts.map((p) => p.grade)
    const ctx = buildTutorContext(instance, attempt('sd-1', { moduleId: 'polyDivision', final: { polyEntries: entries, polyStage: 1 } }), verdictFromPoly(grades), false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('polyDivision')
    expect(ctx.moduleId).toBe('polyDivision')
    expect(ctx.title).toBe('Synthetic division')
    expect(ctx.statement).toBe(`f(x) = ${a.f}. ${a.prompt}`)
    expect(ctx.statement).toContain(a.divisor.replace(/-/g, '−'))
    expect(ctx.work).toEqual([
      `top row: ${row}`,
      `box: ${a.c}`,
      `products row: ${sign.products.map((v) => ratToString({ n: -v.n, d: v.d })).join(', ')}`,
      `bottom row: ${sign.bottom.map(ratToString).join(', ')}`,
    ])
    expect(ctx.canonical).toEqual(a.reveal)
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.answer).toContain('quotient')
    expect(ctx.finished).toBe(false)
    expect(ctx.revealed).toBe(false)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake?.id).toBe('poly_sd_subtracted')
    expect(ctx.verdict?.mistake?.lesson).toBeTruthy()
    expect(ctx.verdict?.mistake?.witness).toContain('ADDS each column')

    // An empty cell is a parse error, not a wrong answer; a part she has not reached adds no line.
    const hole = { ...entries, [SD_KEYS.bottom(1)]: '' }
    const blocked = verdictFromPoly(gradeDivisionStage(a, 'grid', hole).parts.map((p) => p.grade))
    expect(blocked?.status).toBe('parse_error')
    expect(blocked?.mistake).toBeUndefined()
    expect(buildTutorContext(instance, attempt('sd-2', { moduleId: 'polyDivision', final: { polyEntries: { row } } }), null, false).work).toEqual([`top row: ${row}`])
    expect(buildTutorContext(instance, attempt('sd-3', { moduleId: 'polyDivision' }), null, false).work).toEqual([])
  })

  it('describes f(c) and the factor question from the bottom row she typed and her answer', () => {
    const value = generateProblem('polyDivision', 'sd.value', 3)
    if (value.answer.type !== 'polyDivision') throw new Error('expected a polyDivision problem')
    const v = value.answer
    const bottom = v.rows.bottom.join(', ')
    const early = v.rows.bottom[v.degree - 1]!
    const grade = gradeDivisionStage(v, 'value', { value: early }).parts[0]!.grade
    const ctx = buildTutorContext(value, attempt('sd-4', { moduleId: 'polyDivision', final: { polyEntries: { value: early, bottom }, polyStage: 1, revealed: true } }), verdictFromPoly([grade]), true)
    expect(ctx.kind).toBe('polyDivision')
    expect(ctx.statement).toBe(`f(x) = ${v.f}. ${v.prompt}`)
    expect(ctx.work).toEqual([`bottom row: ${bottom}`, `f(${v.c}): ${early}`])
    expect(ctx.canonical).toEqual(v.reveal)
    expect(ctx.answer).toBe(v.expectedDisplay)
    expect(ctx.finished).toBe(true)
    expect(ctx.revealed).toBe(true)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake?.id).toBe('poly_sd_remainder_last_quotient')

    const factor = generateProblem('polyDivision', 'sd.factor', 2)
    if (factor.answer.type !== 'polyDivision') throw new Error('expected a polyDivision problem')
    const f = factor.answer
    const answered = f.isFactor ? 'yes' : 'no'
    const right = gradeDivisionStage(f, 'factor', { factor: answered }).parts[0]!.grade
    const done = buildTutorContext(factor, attempt('sd-5', { moduleId: 'polyDivision', final: { polyEntries: { bottom: f.rows.bottom.join(', '), factor: answered } } }), verdictFromPoly([right]), true)
    expect(done.statement).toContain('a factor of f(x)?')
    expect(done.work).toEqual([`bottom row: ${f.rows.bottom.join(', ')}`, `factor: ${answered}`])
    expect(done.answer).toContain(answered)
    expect(done.verdict?.status).toBe('correct')
    expect(verdictFromPoly([gradeDivisionStage(f, 'factor', {}).parts[0]!.grade])?.status).toBe('parse_error')
  })

  it('describes a zeros problem from her rows and her choices, with the named slip', () => {
    const instance = generateProblem('polyZeros', 'pz.zeros', 2)
    if (instance.answer.type !== 'polyZeros') throw new Error('expected a polyZeros problem')
    const a = instance.answer
    // Every zero typed with the sign of the number in its factor.
    const entries: Record<string, string> = { rows: String(a.zeros.length) }
    a.zeros.forEach((z, i) => {
      entries[`z${i}`] = z.text.startsWith('-') ? z.text.slice(1) : `-${z.text}`
      entries[`m${i}`] = String(z.mult)
    })
    const grades = gradeZerosStage(a, 'zeros', entries).parts.map((p) => p.grade)
    const ctx = buildTutorContext(instance, attempt('pz-1', { moduleId: 'polyZeros', final: { polyEntries: entries } }), verdictFromPoly(grades), false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('polyZeros')
    expect(ctx.moduleId).toBe('polyZeros')
    expect(ctx.title).toBe('Zeros and multiplicity')
    expect(ctx.statement).toBe(`f(x) = ${a.f}. ${a.prompt}`)
    expect(ctx.work).toEqual(a.zeros.map((z, i) => `zero ${i + 1}: ${entries[`z${i}`]}, multiplicity ${z.mult}`))
    expect(ctx.canonical).toEqual(a.reveal)
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.answer).toContain('multiplicity')
    expect(ctx.finished).toBe(false)
    expect(ctx.revealed).toBe(false)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake?.id).toBe('poly_zero_sign_reversed')
    expect(ctx.verdict?.mistake?.lesson).toBeTruthy()
    expect(ctx.verdict?.mistake?.witness).toContain('opposite sign')

    // An empty table is a parse error, not a wrong answer; the second part adds her choices.
    const blocked = verdictFromPoly(gradeZerosStage(a, 'zeros', {}).parts.map((p) => p.grade))
    expect(blocked?.status).toBe('parse_error')
    expect(blocked?.mistake).toBeUndefined()
    const right = canonicalEntries(a)
    const done = buildTutorContext(
      instance,
      attempt('pz-2', { moduleId: 'polyZeros', final: { polyEntries: right, polyStage: 1 } }),
      verdictFromPoly(gradeZerosStage(a, 'cross', right).parts.map((p) => p.grade)),
      true,
    )
    expect(done.work).toEqual([
      ...a.zeros.map((z, i) => `zero ${i + 1}: ${z.text}, multiplicity ${z.mult}`),
      ...a.zeros.map((z) => `at x = ${z.text}: ${z.behavior}`),
    ])
    expect(done.verdict?.status).toBe('correct')
    expect(done.finished).toBe(true)
    expect(buildTutorContext(instance, attempt('pz-3', { moduleId: 'polyZeros' }), null, false).work).toEqual([])
  })

  it('describes end behavior, a polynomial from its zeros, and rational root candidates', () => {
    const end = generateProblem('polyZeros', 'pz.end', 2)
    if (end.answer.type !== 'polyZeros') throw new Error('expected a polyZeros problem')
    const e = end.answer
    const flipped = { left: e.end!.left === 'up' ? 'down' : 'up', right: e.end!.right }
    const endVerdict = verdictFromPoly(gradeZerosStage(e, 'end', flipped).parts.map((p) => p.grade))
    const endCtx = buildTutorContext(end, attempt('pz-4', { moduleId: 'polyZeros', final: { polyEntries: flipped } }), endVerdict, false)
    expect(endCtx.statement).toBe(`f(x) = ${e.f}. ${e.prompt}`)
    expect(endCtx.work).toEqual([`left end: ${flipped.left}`, `right end: ${flipped.right}`])
    expect(endCtx.answer).toContain(`left end ${e.end!.left}`)
    expect(endCtx.verdict?.mistake?.id).toBe('poly_end_parity_swapped')

    // The zeros and the point are the statement there; the formula is the answer and stays out of it.
    const build = generateProblem('polyZeros', 'pz.build', 4)
    if (build.answer.type !== 'polyZeros') throw new Error('expected a polyZeros problem')
    const b = build.answer
    const bare = b.f.replace(/^-?\d*/, '')
    const buildVerdict = verdictFromPoly(gradeZerosStage(b, 'formula', { formula: bare }).parts.map((p) => p.grade))
    const buildCtx = buildTutorContext(build, attempt('pz-5', { moduleId: 'polyZeros', final: { polyEntries: { formula: bare }, revealed: true } }), buildVerdict, false)
    expect(buildCtx.statement).toBe(`${build.statementText} ${b.prompt}`)
    expect(buildCtx.statement).toContain(`(${b.point!.x}, ${b.point!.y})`)
    expect(buildCtx.statement).toContain('multiplicity')
    expect(buildCtx.statement).not.toContain(b.f)
    expect(buildCtx.work).toEqual([`formula: ${bare}`])
    expect(buildCtx.answer).toBe(b.expectedDisplay)
    expect(buildCtx.canonical).toEqual(b.reveal)
    expect(buildCtx.revealed).toBe(true)
    expect(buildCtx.verdict?.mistake?.id).toBe('poly_lead_coefficient_omitted')

    const rational = generateProblem('polyZeros', 'pz.rational', 1)
    if (rational.answer.type !== 'polyZeros') throw new Error('expected a polyZeros problem')
    const r = rational.answer
    const entries = { candidates: r.candidatesText!, rational: 'none' }
    const ratVerdict = verdictFromPoly(gradeZerosStage(r, 'rational', entries).parts.map((p) => p.grade))
    const ratCtx = buildTutorContext(rational, attempt('pz-6', { moduleId: 'polyZeros', final: { polyEntries: entries, polyStage: 1 } }), ratVerdict, false)
    expect(ratCtx.statement).toBe(`f(x) = ${r.f}. ${r.prompt}`)
    expect(ratCtx.work).toEqual([`possible rational zeros: ${r.candidatesText}`, 'rational zeros: none'])
    expect(ratCtx.answer).toContain('possible rational zeros ±1')
    expect(ratCtx.canonical).toEqual(r.reveal)
    expect(ratCtx.verdict?.status).toBe('wrong')
    expect(verdictFromPoly(gradeZerosStage(r, 'candidates', {}).parts.map((p) => p.grade))?.status).toBe('parse_error')
  })

  it('describes an operations-with-functions answer, her box, and the named mistake', () => {
    const instance = generateProblem('functionOps', 'ops.formula', 3)
    if (instance.answer.type !== 'functionOps') throw new Error('expected a functionOps problem')
    const a = instance.answer
    const ctx = buildTutorContext(
      instance,
      attempt('ops-1', { moduleId: 'functionOps', final: { fnEntries: { answer: a.trapAnswer } } }),
      verdictFromOps({ verdict: 'mistake', mistake: a.trap as OpsMistakeId, witness: 'That is the other order.' }),
      false,
    )
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('functionOps')
    expect(ctx.statement).toBe(instance.statementText)
    expect(ctx.statement).toContain(a.prompt)
    expect(ctx.work).toEqual([`answer: ${a.trapAnswer}`])
    expect(ctx.canonical).toEqual(a.reveal)
    expect(ctx.answer).toBe(a.answerText)
    expect(ctx.finished).toBe(false)
    expect(ctx.revealed).toBe(false)
    expect(ctx.verdict?.status).toBe('wrong')
    expect(ctx.verdict?.mistake?.id).toBe(a.trap)
    expect(ctx.verdict?.mistake?.title).toBeTruthy()
    expect(ctx.verdict?.mistake?.lesson).toBeTruthy()
    expect(ctx.verdict?.mistake?.witness).toBe('That is the other order.')
    expect(verdictFromOps({ verdict: 'invalid', message: 'Type a formula in x.' }).status).toBe('parse_error')
    expect(verdictFromOps({ verdict: 'wrong', message: 'That is not it.' }).mistake).toBeUndefined()
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
