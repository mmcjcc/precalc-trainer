import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { OpsMistakeId } from '@/content/modules/functionOps/ops'
import { gradeLightAnswer } from '@/content/modules/electrons/grade'
import { SD_KEYS, gradeDivisionStage } from '@/content/modules/polyDivision'
import { canonicalEntries, gradeZerosStage } from '@/content/modules/polyZeros'
import { canonicalEntries as rfEntries, gradeRfStage, RF_KEYS, rfWork } from '@/content/modules/rationalFns'
import { canonicalEntries as scEntries, gradeScStage, SC_KEYS, scWork } from '@/content/modules/signCharts'
import { canonicalEntries as cxEntries, gradeCxStage, CX_KEYS, cxWork } from '@/content/modules/complexNums'
import { canonicalEntries as geoEntries, gradeGeoStage, GEO_KEYS, geoWork } from '@/content/modules/geometry'
import { gradePtStage, PT_KEYS, ptWork } from '@/content/modules/periodic'
import { gradeQnStage, QN_KEYS, qnWork } from '@/content/modules/quantumNumbers'
import { gradeEgPart } from '@/content/modules/expLogGraphs'
import { gradeEmPart } from '@/content/modules/expModels'
import { partEntries, partsWork } from '@/content/modules/explog/parts'
import { gradeAmPart } from '@/content/modules/angleMeasure'
import { gradeRtPart } from '@/content/modules/rightTriangle'
import { gradeUcPart } from '@/content/modules/unitCircle'
import { gradeSgPart } from '@/content/modules/sinusoids'
import { gradeOgPart } from '@/content/modules/otherTrigGraphs'
import { gradeItPart } from '@/content/modules/inverseTrig'
import { trigEntries } from '@/content/modules/trig/parts'
import { gradeNmStage, NM_KEYS, nmWork } from '@/content/modules/nomenclature'
import { reasonLabel } from '@/content/modules/geometry/reasons'
import { checkSquareLine, configurationMistakes, gradeAxisOfSymmetry, gradeConfiguration, gradeLogEquation, gradeLogValue, gradeVertex, squareMistakes, syntheticMistakes, vertexMistakes } from '@/engine'
import { ratToString } from '@/notation'
import { gradeFinalAnswer } from '@/problem/inequality'
import { encodeSlotStep } from '@/problem/evenOdd'
import {
  assertGeometryQuestion,
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
  verdictFromRf,
  verdictFromSc,
  verdictFromCx,
  verdictFromGeo,
  verdictFromLog,
  verdictFromPt,
  verdictFromQn,
  verdictFromExpLogPart,
  verdictFromNm,
  verdictFromTrigPart,
  verdictFromOptPart,
} from '@/problem/tutorContext'
import { gradeOptPart, optEntries, stagesFor } from '@/content/modules/optimization'
import { ERROR_PATTERNS } from '@/engine'
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

  it('describes a rational function from her boxes, with the named slip', () => {
    const instance = generateProblem('rationalFns', 'rf.features', 1)
    if (instance.answer.type !== 'rationalFns') throw new Error('expected a rationalFns problem')
    const a = instance.answer
    const entries = rfEntries(a)
    const ctx = buildTutorContext(instance, attempt('rf-1', { moduleId: 'rationalFns', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('rationalFns')
    expect(ctx.moduleId).toBe('rationalFns')
    expect(ctx.statement).toBe(`f(x) = ${a.f}. ${a.prompt}`)
    expect(ctx.work).toEqual(rfWork(a, entries))
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)

    const trap = gradeRfStage(a, a.trapStage, a.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromRf(trap)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    const bad = buildTutorContext(
      instance,
      attempt('rf-2', { moduleId: 'rationalFns', final: { polyEntries: { [RF_KEYS[a.trapStage]]: a.trapAnswer } } }),
      verdict,
      false,
    )
    expect(bad.work).toEqual([expect.stringContaining(a.trapAnswer)])
    expect(bad.verdict?.mistake?.id).toBe(a.trap)
    expect(verdictFromRf(gradeRfStage(a, a.stages[0]!.id, '???'))?.status).toBe('parse_error')
    expect(buildTutorContext(instance, attempt('rf-3', { moduleId: 'rationalFns' }), null, false).work).toEqual([])

    const eq = generateProblem('rationalFns', 'rf.equation', 1)
    if (eq.answer.type !== 'rationalFns') throw new Error('expected a rational equation')
    expect(buildTutorContext(eq, attempt('rf-4', { moduleId: 'rationalFns' }), null, true).statement).toBe(`${eq.answer.equation}. ${eq.answer.prompt}`)
    expect(buildTutorContext(eq, attempt('rf-4', { moduleId: 'rationalFns' }), verdictFromRf(gradeRfStage(eq.answer, 'solution', eq.answer.trapAnswer)), true).finished).toBe(true)
  })

  it('describes a sign-chart inequality from her boxes, with the named slip', () => {
    const instance = generateProblem('signCharts', 'sc.chart', 1)
    if (instance.answer.type !== 'signCharts') throw new Error('expected a signCharts problem')
    const a = instance.answer
    const entries = scEntries(a)
    const ctx = buildTutorContext(instance, attempt('sc-1', { moduleId: 'signCharts', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('signCharts')
    expect(ctx.moduleId).toBe('signCharts')
    expect(ctx.statement).toBe(`${a.inequality}. ${a.prompt}`)
    expect(ctx.work).toEqual(scWork(a, entries))
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)

    const trap = gradeScStage(a, a.trapStage, a.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromSc(trap)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    const bad = buildTutorContext(
      instance,
      attempt('sc-2', { moduleId: 'signCharts', final: { polyEntries: { [SC_KEYS[a.trapStage]]: a.trapAnswer } } }),
      verdict,
      false,
    )
    expect(bad.work).toEqual([expect.stringContaining(a.trapAnswer)])
    expect(bad.verdict?.mistake?.id).toBe(a.trap)
    expect(verdictFromSc(gradeScStage(a, a.stages[0]!.id, '???'))?.status).toBe('parse_error')
    expect(buildTutorContext(instance, attempt('sc-3', { moduleId: 'signCharts' }), null, false).work).toEqual([])

    const poly = generateProblem('signCharts', 'sc.poly', 1)
    if (poly.answer.type !== 'signCharts') throw new Error('expected a polynomial inequality')
    expect(buildTutorContext(poly, attempt('sc-4', { moduleId: 'signCharts' }), null, true).statement).toBe(`${poly.answer.inequality}. ${poly.answer.prompt}`)
    expect(
      buildTutorContext(poly, attempt('sc-4', { moduleId: 'signCharts' }), verdictFromSc(gradeScStage(poly.answer, 'solution', poly.answer.trapAnswer)), true).finished,
    ).toBe(true)
  })

  it('describes a complex-number problem from her box, with the named slip', () => {
    const instance = generateProblem('complexNums', 'cx.arith', 1)
    if (instance.answer.type !== 'complexNums') throw new Error('expected a complexNums problem')
    const a = instance.answer
    const entries = cxEntries(a)
    const ctx = buildTutorContext(instance, attempt('cx-1', { moduleId: 'complexNums', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('complexNums')
    expect(ctx.moduleId).toBe('complexNums')
    expect(ctx.statement).toBe(`${a.expression}. ${a.prompt}`)
    expect(ctx.work).toEqual(cxWork(a, entries))
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)

    const trap = gradeCxStage(a, a.trapStage, a.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromCx(trap)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    const bad = buildTutorContext(
      instance,
      attempt('cx-2', { moduleId: 'complexNums', final: { polyEntries: { [CX_KEYS[a.trapStage]]: a.trapAnswer } } }),
      verdict,
      false,
    )
    expect(bad.work).toEqual([expect.stringContaining(a.trapAnswer)])
    expect(bad.verdict?.mistake?.id).toBe(a.trap)
    expect(verdictFromCx(gradeCxStage(a, a.stages[0]!.id, '???'))?.status).toBe('parse_error')
    expect(buildTutorContext(instance, attempt('cx-3', { moduleId: 'complexNums' }), null, false).work).toEqual([])

    const zeros = generateProblem('complexNums', 'cx.zeros', 1)
    if (zeros.answer.type !== 'complexNums') throw new Error('expected a zeros problem')
    expect(buildTutorContext(zeros, attempt('cx-4', { moduleId: 'complexNums' }), null, true).statement).toBe(
      `f(x) = ${zeros.answer.f}. One zero is ${zeros.answer.givenZero}. ${zeros.answer.prompt}`,
    )
    expect(
      buildTutorContext(zeros, attempt('cx-4', { moduleId: 'complexNums' }), verdictFromCx(gradeCxStage(zeros.answer, 'answer', zeros.answer.trapAnswer)), true)
        .finished,
    ).toBe(true)
  })

  it('describes a geometry figure and her parts, with the named slip', () => {
    const instance = generateProblem('geoSegments', 'gs.addition', 1)
    if (instance.answer.type !== 'geometry') throw new Error('expected a geometry problem')
    const a = instance.answer
    const entries = geoEntries(a)
    const ctx = buildTutorContext(instance, attempt('geo-1', { moduleId: 'geoSegments', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('geometry')
    expect(ctx.kind).toBe('geometry')
    expect(ctx.moduleId).toBe('geoSegments')
    expect(ctx.statement).toBe(`${a.prompt} Figure: ${a.figure.ariaLabel}`)
    expect(ctx.statement).toContain('B is between A and C')
    expect(ctx.work).toEqual(geoWork(a, entries))
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)

    const trap = gradeGeoStage(a, a.trapStage, a.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromGeo(trap)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    const bad = buildTutorContext(
      instance,
      attempt('geo-2', { moduleId: 'geoSegments', final: { polyEntries: { [GEO_KEYS[a.trapStage]]: a.trapAnswer } } }),
      verdict,
      false,
    )
    expect(bad.work).toEqual([expect.stringContaining(a.trapAnswer)])
    expect(bad.verdict?.mistake?.id).toBe(a.trap)
    expect(verdictFromGeo(gradeGeoStage(a, a.stages[0]!.id, '???'))?.status).toBe('parse_error')
    expect(buildTutorContext(instance, attempt('geo-3', { moduleId: 'geoSegments' }), null, false).work).toEqual([])

    const words = generateProblem('geoAngles', 'ga.words', 1)
    if (words.answer.type !== 'geometry') throw new Error('expected a word problem')
    expect(buildTutorContext(words, attempt('geo-4', { moduleId: 'geoAngles' }), null, true).statement).toContain(words.answer.figure.ariaLabel)
    expect(buildTutorContext(words, attempt('geo-4', { moduleId: 'geoAngles' }), null, true).subject).toBe('geometry')
  })

  it('describes a Unit 2 conditional, a picked reason, and an algebraic proof', () => {
    const related = generateProblem('geoLogic', 'gl.related', 1)
    if (related.answer.type !== 'geometry') throw new Error('expected a conditional')
    const logic = related.answer
    const logicCtx = buildTutorContext(related, attempt('geo-5', { moduleId: 'geoLogic' }), null, false)
    expect(logicCtx.subject).toBe('geometry')
    expect(logicCtx.kind).toBe('geometry')
    expect(logicCtx.statement).toContain(logic.prompt)
    expect(logicCtx.statement).toContain(logic.figure.ariaLabel)
    const slip = gradeGeoStage(logic, logic.trapStage, logic.trapAnswer)
    expect(slip.verdict).toBe('mistake')
    if (slip.verdict !== 'mistake') return
    expect(verdictFromGeo(slip)?.mistake?.id).toBe('geo_converse_inverse_swapped')

    const everyday = generateProblem('geoLogic', 'gl.related', 17)
    if (everyday.answer.type !== 'geometry') throw new Error('expected an everyday conditional')
    expect(everyday.answer.figure.points).toEqual([])
    expect(buildTutorContext(everyday, attempt('geo-6', { moduleId: 'geoLogic' }), null, false).statement).toContain(everyday.answer.prompt)

    const named = generateProblem('geoProof', 'gp.reason', 1)
    if (named.answer.type !== 'geometry') throw new Error('expected a reason problem')
    const row = named.answer.stages[0]!
    const picked = buildTutorContext(
      named,
      attempt('geo-7', { moduleId: 'geoProof', final: { polyEntries: { [GEO_KEYS[row.id]]: row.answerText } } }),
      null,
      false,
    )
    expect(picked.work).toEqual([`${row.label}: ${reasonLabel(row.answerText)}`])
    expect(picked.statement).toContain(named.answer.prompt)

    const algebra = generateProblem('geoProof', 'gp.algebraic', 1)
    if (algebra.answer.type !== 'geometry') throw new Error('expected an algebraic proof')
    const shown = buildTutorContext(algebra, attempt('geo-8', { moduleId: 'geoProof' }), null, false)
    expect(algebra.answer.lines?.length).toBeGreaterThan(0)
    expect(shown.statement).toContain('Lines:')
    for (const line of algebra.answer.lines ?? []) expect(shown.statement).toContain(line)
    expect(shown.canonical.length).toBe(algebra.answer.stages.length)
  })

  it('describes a periodic-table problem and her parts, with the named slip', () => {
    const instance = generateProblem('periodic', 'pt.locate', 1)
    if (instance.answer.type !== 'periodic') throw new Error('expected a periodic-table problem')
    const a = instance.answer
    const entries: Record<string, string> = {}
    for (const stage of a.stages) entries[PT_KEYS[stage.id]] = stage.answerText
    const ctx = buildTutorContext(instance, attempt('pt-1', { moduleId: 'periodic', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('chemistry')
    expect(ctx.kind).toBe('periodic')
    expect(ctx.moduleId).toBe('periodic')
    expect(ctx.statement).toBe(a.prompt)
    expect(ctx.work).toEqual(ptWork(a, entries))
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)
    if (!a.trap || !a.trapStage || a.trapAnswer == null) throw new Error('seed 1 has no promised trap')
    const trap = gradePtStage(a, a.trapStage, a.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromPt(trap)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    const bad = buildTutorContext(
      instance,
      attempt('pt-2', { moduleId: 'periodic', final: { polyEntries: { [PT_KEYS[a.trapStage]]: a.trapAnswer } } }),
      verdict,
      false,
    )
    expect(bad.work).toEqual([expect.stringContaining(a.trapAnswer)])
    expect(bad.verdict?.mistake?.id).toBe(a.trap)
    expect(verdictFromPt(gradePtStage(a, a.stages[0]!.id, '???'))?.status).toBe('parse_error')
    expect(buildTutorContext(instance, attempt('pt-3', { moduleId: 'periodic' }), null, false).work).toEqual([])
  })

  it('describes a quantum-number problem, the figure, and the named slip', () => {
    const instance = generateProblem('quantumNumbers', 'qn.count', 1)
    if (instance.answer.type !== 'quantum') throw new Error('expected a quantum-number problem')
    const a = instance.answer
    const entries: Record<string, string> = {}
    for (const stage of a.stages) entries[QN_KEYS[stage.id]] = stage.answerText
    const ctx = buildTutorContext(instance, attempt('qn-1', { moduleId: 'quantumNumbers', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('chemistry')
    expect(ctx.kind).toBe('quantumNumbers')
    expect(ctx.moduleId).toBe('quantumNumbers')
    expect(ctx.statement).toBe(a.prompt)
    expect(ctx.work).toEqual(qnWork(a, entries))
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)
    expect(buildTutorContext(instance, attempt('qn-0', { moduleId: 'quantumNumbers' }), null, false).work).toEqual([])

    let pictured = generateProblem('quantumNumbers', 'qn.shapes', 1)
    for (let seed = 1; seed <= 40 && (pictured.answer.type !== 'quantum' || !pictured.answer.figure); seed++) {
      pictured = generateProblem('quantumNumbers', 'qn.shapes', seed)
    }
    if (pictured.answer.type !== 'quantum' || !pictured.answer.figure) throw new Error('no orbital figure in the first 40 seeds')
    const shown = buildTutorContext(pictured, attempt('qn-fig', { moduleId: 'quantumNumbers' }), null, false)
    expect(shown.statement).toContain(pictured.answer.prompt)
    expect(shown.statement).toContain(`Figure: ${pictured.answer.figure.ariaLabel}`)

    let trapped = generateProblem('quantumNumbers', 'qn.pauli', 1)
    for (let seed = 1; seed <= 40; seed++) {
      const next = generateProblem('quantumNumbers', 'qn.pauli', seed)
      if (next.answer.type === 'quantum' && next.answer.trap && next.answer.trapStage && next.answer.trapAnswer != null) {
        trapped = next
        break
      }
    }
    if (trapped.answer.type !== 'quantum' || !trapped.answer.trap || !trapped.answer.trapStage || trapped.answer.trapAnswer == null) {
      throw new Error('no promised Pauli trap in the first 40 seeds')
    }
    const trap = gradeQnStage(trapped.answer, trapped.answer.trapStage, trapped.answer.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromQn(trap)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(trapped.answer.trap)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    const bad = buildTutorContext(
      trapped,
      attempt('qn-2', { moduleId: 'quantumNumbers', final: { polyEntries: { [QN_KEYS[trapped.answer.trapStage]]: trapped.answer.trapAnswer } } }),
      verdict,
      false,
    )
    expect(bad.work).toEqual([expect.stringContaining(trapped.answer.trapAnswer)])
    expect(bad.verdict?.mistake?.id).toBe(trapped.answer.trap)
    expect(verdictFromQn(gradeQnStage(trapped.answer, trapped.answer.stages[0]!.id, '???'))?.status).toBe('parse_error')
  })

  it('describes a nomenclature problem and her parts, with the named nm_ slip', () => {
    const instance = generateProblem('ionicNames', 'nm.ionicFormula', 1)
    if (instance.answer.type !== 'nomenclature') throw new Error('expected a nomenclature problem')
    const a = instance.answer
    const entries: Record<string, string> = {}
    for (const stage of a.stages) entries[NM_KEYS[stage.id]] = stage.answerText
    const ctx = buildTutorContext(instance, attempt('nm-1', { moduleId: 'ionicNames', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('chemistry')
    expect(ctx.kind).toBe('nomenclature')
    expect(ctx.moduleId).toBe('ionicNames')
    expect(ctx.statement).toBe(a.prompt)
    expect(ctx.work).toEqual(nmWork(a, entries))
    expect(ctx.work[0]).toBe(`${a.stages[0]!.label}: ${a.stages[0]!.answerText}`)
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)
    if (!a.trap || !a.trapStage || a.trapAnswer == null) throw new Error('seed 1 has no promised trap')
    const trap = gradeNmStage(a, a.trapStage, a.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromNm(trap)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    const bad = buildTutorContext(
      instance,
      attempt('nm-2', { moduleId: 'ionicNames', final: { polyEntries: { [NM_KEYS[a.trapStage]]: a.trapAnswer } } }),
      verdict,
      false,
    )
    expect(bad.work).toEqual([expect.stringContaining(a.trapAnswer)])
    expect(bad.verdict?.mistake?.id).toBe(a.trap)
    // Not an attempt: unreadable, or a capital-letter slip, is a parse error; a problem outside the model gives no verdict.
    expect(verdictFromNm(gradeNmStage(a, a.stages[0]!.id, '???'))?.status).toBe('parse_error')
    expect(verdictFromNm({ verdict: 'unsupported', message: 'outside the model' })).toBeNull()
    expect(verdictFromNm(gradeNmStage(a, a.trapStage, a.stages.at(-1)!.answerText))?.status).toBe('correct')
    // A classify part shows the kind she picked in words.
    const classify = generateProblem('molecularAcids', 'nm.classify', 1)
    if (classify.answer.type !== 'nomenclature') throw new Error('expected a classify problem')
    const picked = buildTutorContext(classify, attempt('nm-3', { moduleId: 'molecularAcids', final: { polyEntries: { a: 'hydrate' } } }), null, false)
    expect(picked.work).toEqual(['Kind of compound: hydrate'])
    expect(buildTutorContext(instance, attempt('nm-4', { moduleId: 'ionicNames' }), null, false).work).toEqual([])
  })

  it('describes a Unit 3 transversal, a triangle, and a line', () => {
    const pairs = generateProblem('geoParallel', 'gl3.pairs', 1)
    if (pairs.answer.type !== 'geometry') throw new Error('expected a transversal')
    const pairCtx = buildTutorContext(pairs, attempt('geo-9', { moduleId: 'geoParallel' }), null, false)
    expect(pairCtx.subject).toBe('geometry')
    expect(pairCtx.kind).toBe('geometry')
    expect(pairCtx.statement).toContain(pairs.answer.prompt)
    expect(pairCtx.statement).toContain(pairs.answer.figure.ariaLabel)
    const slip = gradeGeoStage(pairs.answer, pairs.answer.trapStage, pairs.answer.trapAnswer)
    expect(slip.verdict).toBe('mistake')
    if (slip.verdict !== 'mistake') return
    expect(verdictFromGeo(slip)?.mistake?.id).toBe(pairs.answer.trap)
    const picked = buildTutorContext(
      pairs,
      attempt('geo-10', { moduleId: 'geoParallel', final: { polyEntries: { [GEO_KEYS[pairs.answer.trapStage]]: pairs.answer.trapAnswer } } }),
      verdictFromGeo(slip),
      false,
    )
    expect(picked.work.join(' ')).toContain('Corresponding')
    expect(picked.work.join(' ')).not.toContain(pairs.answer.trapAnswer)

    const triangle = generateProblem('geoPolygonAngles', 'gpa.triangle', 1)
    if (triangle.answer.type !== 'geometry') throw new Error('expected a triangle')
    const shown = buildTutorContext(
      triangle,
      attempt('geo-11', { moduleId: 'geoPolygonAngles', final: { polyEntries: geoEntries(triangle.answer) } }),
      null,
      false,
    )
    expect(shown.statement).toContain(triangle.answer.prompt)
    expect(shown.work).toEqual(geoWork(triangle.answer, geoEntries(triangle.answer)))
    expect(shown.answer).toBe(triangle.answer.expectedDisplay)
    expect(shown.canonical[0]).toBe(triangle.answer.reveal[0])

    const line = generateProblem('geoParallel', 'gl3.slopes', 2)
    if (line.answer.type !== 'geometry') throw new Error('expected a line')
    expect(line.answer.stages[0]!.kind).toBe('line')
    expect(buildTutorContext(line, attempt('geo-12', { moduleId: 'geoParallel' }), null, false).statement).toContain('y = 2x + 3')
  })

  it('describes a logarithm from her box and from her lines, with the named slip', () => {
    const instance = generateProblem('logForms', 'lf.value', 1)
    if (instance.answer.type !== 'logForms') throw new Error('expected a log value')
    const a = instance.answer
    const ctx = buildTutorContext(instance, attempt('lf-1', { moduleId: 'logForms', final: { polyEntries: { answer: a.trapAnswer } } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('logForms')
    expect(ctx.moduleId).toBe('logForms')
    expect(ctx.statement).toBe(`${a.problem}. ${a.prompt}`)
    expect(ctx.work).toEqual([a.trapAnswer])
    expect(ctx.answer).toBe(a.expectedDisplay)
    expect(ctx.canonical[0]).toBe(a.reveal[0])
    expect(ctx.finished).toBe(false)

    const trap = gradeLogValue(a.problem, a.trapAnswer)
    expect(trap.verdict).toBe('mistake')
    if (trap.verdict !== 'mistake') return
    const verdict = verdictFromLog(trap, a.trapAnswer)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(trap.mistake)
    expect(verdict?.mistake?.lesson).toBeTruthy()
    expect(verdict?.mistake?.witness).toBe(trap.witness)
    expect(verdict?.line).toBe(a.trapAnswer)
    expect(verdictFromLog(gradeLogValue(a.problem, '???'))?.status).toBe('parse_error')
    expect(buildTutorContext(instance, attempt('lf-2', { moduleId: 'logForms' }), null, false).work).toEqual([])

    const line = generateProblem('logProperties', 'lp.expand', 1)
    if (line.answer.type !== 'logProperties') throw new Error('expected an expansion')
    const worked = buildTutorContext(line, attempt('lp-1', { moduleId: 'logProperties', steps: [step(line.answer.answerText)] }), null, true)
    expect(worked.statement).toBe(`${line.answer.expr}. ${line.answer.prompt}`)
    expect(worked.work).toEqual([line.answer.answerText])
    expect(worked.answer).toBe(line.answer.expectedDisplay)
    expect(worked.finished).toBe(true)

    const eq = generateProblem('expLogEquations', 'ee.logarithmic', 1)
    if (eq.answer.type !== 'expLogEquations') throw new Error('expected an equation')
    const graded = gradeLogEquation(eq.answer.equation, eq.answer.trapAnswer!)
    const solving = buildTutorContext(
      eq,
      attempt('ee-1', {
        moduleId: 'expLogEquations',
        steps: [step(eq.answer.path[0] ?? eq.answer.equation)],
        final: { polyEntries: { answer: eq.answer.trapAnswer! } },
      }),
      verdictFromLog(graded, eq.answer.trapAnswer),
      false,
    )
    expect(solving.kind).toBe('expLogEquations')
    expect(solving.statement).toBe(`${eq.answer.equation}. ${eq.answer.prompt}`)
    expect(solving.work[0]).toBe(eq.answer.path[0])
    expect(solving.work).toContain(eq.answer.trapAnswer)
    expect(solving.answer).toBe(eq.answer.expectedDisplay)
    expect(solving.canonical[0]).toBe(eq.answer.reveal[0])
    expect(solving.verdict?.status).toBe('wrong')
    expect(solving.verdict?.mistake?.id).toBe(graded.verdict === 'mistake' ? graded.mistake : undefined)
  })

  it('describes an exp/log graph and a growth or decay word problem part by part, with the named slip', () => {
    const graph = generateProblem('expLogGraphs', 'eg.features', 1)
    if (graph.answer.type !== 'expLogGraphs') throw new Error('expected a graph')
    const g = graph.answer
    const entries = { [g.stages[0]!.id]: g.stages[0]!.answerText, [g.stages[1]!.id]: '(0, inf)' }
    const ctx = buildTutorContext(graph, attempt('eg-1', { moduleId: 'expLogGraphs', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('expLogGraphs')
    expect(ctx.statement).toBe(`${g.fnName}(x) = ${g.f}. ${g.prompt}`)
    expect(ctx.work).toEqual(partsWork(g.stages, entries))
    expect(ctx.work[0]).toBe(`${g.stages[0]!.label}: ${g.stages[0]!.answerText}`)
    expect(ctx.answer).toBe(g.expectedDisplay)
    expect(ctx.canonical[0]).toBe(g.reveal[0])
    const slip = gradeEgPart(g, g.trapStage, g.trapAnswer)
    expect(slip.verdict).toBe('mistake')
    const verdict = verdictFromExpLogPart(slip, g.trapAnswer)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(g.trap)
    expect(verdict?.mistake?.lesson).toBe(ERROR_PATTERNS[g.trap].lesson)
    expect(verdict?.line).toBe(g.trapAnswer)
    expect(verdictFromExpLogPart(gradeEgPart(g, g.stages[0]!.id, '???'))?.status).toBe('parse_error')
    expect(buildTutorContext(graph, attempt('eg-2', { moduleId: 'expLogGraphs' }), null, false).work).toEqual([])

    // A matching problem tells the tutor every candidate, since it cannot see the graphs.
    const match = generateProblem('expLogGraphs', 'eg.match', 1)
    if (match.answer.type !== 'expLogGraphs') throw new Error('expected a match')
    const m = buildTutorContext(match, attempt('eg-3', { moduleId: 'expLogGraphs', final: { polyEntries: { match: 'B' } } }), null, false)
    for (const c of match.answer.candidates ?? []) expect(m.statement).toContain(`${c.letter}: ${match.answer.fnName}(x) = ${c.f}`)
    expect(m.work[0]).toMatch(/^The matching (graph|equation): (Graph )?B$/)

    const model = generateProblem('expModels', 'em.growth', 1)
    if (model.answer.type !== 'expModels') throw new Error('expected a word problem')
    const w = model.answer
    const done = buildTutorContext(model, attempt('em-1', { moduleId: 'expModels', final: { polyEntries: partEntries(w.stages) } }), null, true)
    expect(done.kind).toBe('expModels')
    expect(done.statement).toBe(w.prompt)
    expect(done.work).toEqual(w.stages.map((s) => `${s.label}: ${s.answerText}`))
    expect(done.answer).toBe(w.expectedDisplay)
    expect(done.finished).toBe(true)
    const wrong = verdictFromExpLogPart(gradeEmPart(w, w.trapStage, w.trapAnswer), w.trapAnswer)
    expect(wrong?.mistake?.id).toBe(w.trap)
  })

  it('describes an angle problem and a unit-circle problem part by part, with words for the math and the figure, and the named trig_ slip', () => {
    const angle = generateProblem('angleMeasure', 'am.reference', 3)
    if (angle.answer.type !== 'angleMeasure') throw new Error('expected an angle problem')
    const a = angle.answer
    expect(a.stages.map((s) => s.id)).toEqual(['quadrant', 'reference'])
    const entries = { quadrant: a.stages[0]!.answerText, reference: 'pi/6' }
    const ctx = buildTutorContext(angle, attempt('am-1', { moduleId: 'angleMeasure', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('angleMeasure')
    // The statement is words: the prompt's KaTeX read back, and the figure described.
    expect(ctx.statement).toContain('17π/3')
    expect(ctx.statement).not.toMatch(/\\frac|\$/)
    expect(ctx.statement).toContain(`Figure: ${a.figure.ariaLabel}`)
    // A quadrant is said by its name, not its value.
    expect(ctx.work).toEqual([`Where the terminal side lies: ${a.stages[0]!.choices!.find((c) => c.value === a.stages[0]!.answerText)!.label}`, 'Reference angle: pi/6'])
    expect(ctx.answer).toBe(a.expectedDisplay)
    for (const line of ctx.canonical) expect(line).not.toMatch(/\\|\$/)
    const slip = gradeAmPart(a, a.trapStage!, a.trapAnswer!)
    const verdict = verdictFromTrigPart(slip, a.trapAnswer)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBe(ERROR_PATTERNS[a.trap!].lesson)
    expect(verdict?.line).toBe(a.trapAnswer)
    // Not simplest form, or a calculator decimal, is not a graded answer: a parse error for the tutor.
    expect(verdictFromTrigPart(gradeAmPart(a, 'reference', '1.047'))?.status).toBe('parse_error')
    expect(buildTutorContext(angle, attempt('am-2', { moduleId: 'angleMeasure' }), null, false).work).toEqual([])

    const circle = generateProblem('unitCircle', 'uc.point', 1)
    if (circle.answer.type !== 'unitCircle') throw new Error('expected a unit-circle problem')
    const c = circle.answer
    const done = buildTutorContext(circle, attempt('uc-1', { moduleId: 'unitCircle', final: { polyEntries: trigEntries(c.stages) } }), null, true)
    expect(done.kind).toBe('unitCircle')
    expect(done.work).toEqual(c.stages.map((s) => `${s.label}: ${s.answerText}`))
    expect(done.finished).toBe(true)
    expect(verdictFromTrigPart(gradeUcPart(c, c.trapStage!, c.trapAnswer!), c.trapAnswer)?.mistake?.id).toBe(c.trap)
    expect(verdictFromTrigPart(gradeUcPart(c, 'r', '1/√2'))?.status).toBe('parse_error')
  })

  it('describes a right-triangle problem and a list of angles part by part, in words, with the figure and the named trig_ slip', () => {
    const tri = generateProblem('rightTriangle', 'rt.side', 2)
    if (tri.answer.type !== 'rightTriangle') throw new Error('expected a right-triangle problem')
    const a = tri.answer
    const ctx = buildTutorContext(tri, attempt('rt-1', { moduleId: 'rightTriangle', final: { polyEntries: { x: '12.3' } } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('rightTriangle')
    // The prompt read back as words, and the figure (which the tutor cannot see) described.
    expect(ctx.statement).not.toMatch(/\\|\$/)
    expect(ctx.statement).toContain(`Figure: ${a.figure.ariaLabel}`)
    expect(ctx.work).toEqual(['x: 12.3'])
    expect(ctx.answer).toBe(a.expectedDisplay)
    for (const line of ctx.canonical) expect(line).not.toMatch(/\\|\$/)
    const slip = verdictFromTrigPart(gradeRtPart(a, a.trapStage!, a.trapAnswer!), a.trapAnswer)
    expect(slip?.status).toBe('wrong')
    expect(slip?.mistake?.id).toBe(a.trap)
    expect(slip?.mistake?.lesson).toBe(ERROR_PATTERNS[a.trap!].lesson)
    // A note (a degree sign on a length) is not a graded answer: a parse error for the tutor.
    expect(verdictFromTrigPart(gradeRtPart(a, 'x', '12°'))?.status).toBe('parse_error')

    const list = generateProblem('unitCircle', 'uc.solve', 3)
    if (list.answer.type !== 'unitCircle') throw new Error('expected a unit-circle problem')
    const l = list.answer
    const done = buildTutorContext(list, attempt('uc-2', { moduleId: 'unitCircle', final: { polyEntries: trigEntries(l.stages) } }), null, true)
    expect(done.kind).toBe('unitCircle')
    expect(done.work).toEqual([`Every solution: ${l.stages[0]!.answerText}`])
    expect(verdictFromTrigPart(gradeUcPart(l, 'solutions', l.trapAnswer!), l.trapAnswer)?.mistake?.id).toBe(l.trap)
    expect(verdictFromTrigPart(gradeUcPart(l, 'solutions', '1, 1'))?.status).toBe('parse_error')
  })

  it('describes Unit 5 part by part in words: the given equation, four graphs by their formulas, a reference triangle, and the named trig_ slip', { timeout: 120_000 }, () => {
    // A sinusoid's features: the given equation is in the statement, as words.
    const wave = generateProblem('sinusoids', 'sg.features', 1)
    if (wave.answer.type !== 'sinusoids') throw new Error('expected a sinusoid problem')
    const w = wave.answer
    const ctx = buildTutorContext(wave, attempt('sg-1', { moduleId: 'sinusoids', final: { polyEntries: { amplitude: '2' } } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('sinusoids')
    expect(ctx.statement).toContain('y = −2cos(2x/3 − π/3) + 3')
    expect(ctx.statement).not.toMatch(/\\|\$/)
    expect(ctx.work).toEqual(['Amplitude: 2'])
    expect(ctx.answer).toBe(w.expectedDisplay)
    for (const line of ctx.canonical) expect(line).not.toMatch(/\\|\$/)
    const slip = verdictFromTrigPart(gradeSgPart(w, w.trapStage!, w.trapAnswer!), w.trapAnswer)
    expect(slip?.status).toBe('wrong')
    expect(slip?.mistake?.id).toBe(w.trap)
    expect(slip?.mistake?.lesson).toBe(ERROR_PATTERNS[w.trap!].lesson)
    // A shift with no direction words it cannot read is not an attempt: a parse error for the tutor.
    expect(verdictFromTrigPart(gradeSgPart(w, 'shift', 'π/2 up'))?.status).toBe('parse_error')

    // Four graphs to choose from: the tutor, which cannot see them, gets each card's formula; never a formula as a name.
    const match = generateProblem('otherTrigGraphs', 'og.match', 1)
    if (match.answer.type !== 'otherTrigGraphs') throw new Error('expected a matching problem')
    const g = match.answer
    const mctx = buildTutorContext(match, attempt('og-1', { moduleId: 'otherTrigGraphs', final: { polyEntries: { match: 'A' } } }), null, false)
    expect(mctx.kind).toBe('otherTrigGraphs')
    expect(mctx.statement).toMatch(/Graphs: A: y = .+; B: y = .+; C: y = .+; D: y = .+\./)
    expect(mctx.work).toEqual(['The matching graph: Graph A'])
    expect(verdictFromTrigPart(gradeOgPart(g, 'match', g.trapAnswer!), g.trapAnswer)?.mistake?.id).toBe(g.trap)

    // A reference triangle: the quadrant by its name, then the side and the value she typed.
    let seed = 1
    let tri = generateProblem('inverseTrig', 'it.compose', seed)
    while (tri.answer.type !== 'inverseTrig' || tri.answer.stages[0]!.id !== 'quadrant') tri = generateProblem('inverseTrig', 'it.compose', ++seed)
    if (tri.answer.type !== 'inverseTrig') throw new Error('expected an inverse problem')
    const t = tri.answer
    const done = buildTutorContext(tri, attempt('it-1', { moduleId: 'inverseTrig', final: { polyEntries: trigEntries(t.stages) } }), null, true)
    expect(done.kind).toBe('inverseTrig')
    expect(done.finished).toBe(true)
    expect(done.statement).toContain(`Figure: ${t.figure.ariaLabel}`)
    expect(done.work[0]).toBe(`${t.stages[0]!.label}: ${t.stages[0]!.choices!.find((c) => c.value === t.stages[0]!.answerText)!.label}`)
    expect(done.work.slice(1)).toEqual(t.stages.slice(1).map((s) => `${s.label}: ${s.answerText}`))
    expect(verdictFromTrigPart(gradeItPart(t, t.trapStage!, t.trapAnswer!), t.trapAnswer)?.mistake?.id).toBe(t.trap)
  })

  it('describes an optimization problem part by part, in words, with the figure and the named opt_ slip, on either route', () => {
    const pen = generateProblem('optimization', 'opt.wall', 3)
    if (pen.answer.type !== 'optimization') throw new Error('expected an optimization problem')
    const a = pen.answer
    const entries = { secondary: a.stages[0]!.answerText, primary: 'A = x*y' }
    const ctx = buildTutorContext(pen, attempt('opt-1', { moduleId: 'optimization', final: { polyEntries: entries } }), null, false)
    expect(ctx.subject).toBe('precalculus')
    expect(ctx.kind).toBe('optimization')
    // The statement is words: the prompt's KaTeX read back, and the figure described.
    expect(ctx.statement).not.toMatch(/\\|\$\d*\$/)
    expect(ctx.statement).toContain(`Figure: ${a.figure!.ariaLabel}`)
    expect(ctx.work).toEqual([`Secondary equation: ${a.stages[0]!.answerText}`, 'Primary equation: A = x*y'])
    expect(ctx.answer).toBe(a.expectedDisplay)
    for (const line of ctx.canonical) expect(line).not.toMatch(/\\frac|\\left/)
    const slip = gradeOptPart(a, a.stages.find((s) => s.id === a.trapStage)!, a.trapAnswer!)
    const verdict = verdictFromOptPart(slip, a.trapAnswer)
    expect(verdict?.status).toBe('wrong')
    expect(verdict?.mistake?.id).toBe(a.trap)
    expect(verdict?.mistake?.lesson).toBe(ERROR_PATTERNS[a.trap!].lesson)
    expect(verdict?.mistake?.witness).not.toMatch(/\$/)
    expect(verdict?.line).toBe(a.trapAnswer)
    // Not an attempt (an area without its unit, an equation of the wrong kind): a parse error for the tutor.
    const maxCheck = a.stages[5]!.check
    if (maxCheck.kind !== 'number') throw new Error('not a number part')
    expect(verdictFromOptPart(gradeOptPart(a, a.stages[5]!, maxCheck.value))?.status).toBe('parse_error')
    expect(verdictFromOptPart(gradeOptPart(a, a.stages[0]!, 'A = xy + 1'))?.status).toBe('parse_error')
    expect(buildTutorContext(pen, attempt('opt-2', { moduleId: 'optimization' }), null, false).work).toEqual([])
    // Her final equation in y: the tutor sees parts 4 and 5 the y way round.
    if (a.stages[2]!.check.kind !== 'final') throw new Error('not a final part')
    const yEntries = { ...optEntries(stagesFor(a, 'y')), final: a.stages[2]!.check.y }
    const done = buildTutorContext(pen, attempt('opt-3', { moduleId: 'optimization', final: { polyEntries: yEntries } }), null, true)
    expect(done.work).toEqual(stagesFor(a, 'y').map((s) => `${s.label}: ${yEntries[s.id as keyof typeof yEntries]}`))
    expect(done.work[3]).toMatch(/^y: /)
    expect(done.finished).toBe(true)
    // A problem without a figure: the numbers.
    const nums = generateProblem('optimization', 'opt.numbers', 2)
    if (nums.answer.type !== 'optimization') throw new Error('expected an optimization problem')
    expect(buildTutorContext(nums, attempt('opt-4', { moduleId: 'optimization' }), null, false).statement).not.toMatch(/Figure:/)
  })

  it('describes a Unit 4 congruence, an isosceles triangle, and a proof without changing the geometry kind', () => {
    const cases = [
      ['geoCongruence', 'gc.parts', 1],
      ['geoCongruence', 'gc.which', 1],
      ['geoCongruence', 'gc.solve', 1],
      ['geoIsosceles', 'gi.solve', 1],
      ['geoTriangleProofs', 'gt.twocolumn', 1],
    ] as const
    for (const [moduleId, templateId, seed] of cases) {
      const instance = generateProblem(moduleId, templateId, seed)
      if (instance.answer.type !== 'geometry') throw new Error(`${templateId} is not geometry`)
      const a = instance.answer
      assertGeometryQuestion(a.question)
      const ctx = buildTutorContext(instance, attempt(`u4-${templateId}`, { moduleId }), null, false)
      expect(ctx.kind).toBe('geometry')
      expect(ctx.subject).toBe('geometry')
      expect(ctx.statement).toBe(`${a.prompt} Figure: ${a.figure.ariaLabel}`)
      expect(ctx.canonical[0]).toBe(a.reveal[0])
      const slip = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(slip.verdict).toBe('mistake')
      if (slip.verdict !== 'mistake') continue
      expect(verdictFromGeo(slip)?.mistake?.id).toBe(a.trap)
      expect(verdictFromGeo(slip)?.status).toBe('wrong')
    }

    const proof = generateProblem('geoTriangleProofs', 'gt.twocolumn', 1)
    if (proof.answer.type !== 'geometry') throw new Error('expected a proof')
    const row = proof.answer.stages[0]!
    const picked = buildTutorContext(
      proof,
      attempt('u4-proof', { moduleId: 'geoTriangleProofs', final: { polyEntries: { [GEO_KEYS[row.id]]: row.answerText } } }),
      null,
      false,
    )
    expect(picked.work).toEqual([`${row.label}: ${reasonLabel(row.answerText)}`])

    const solve = generateProblem('geoCongruence', 'gc.solve', 1)
    if (solve.answer.type !== 'geometry') throw new Error('expected a solve')
    const filled = buildTutorContext(
      solve,
      attempt('u4-solve', { moduleId: 'geoCongruence', final: { polyEntries: geoEntries(solve.answer) } }),
      null,
      false,
    )
    expect(filled.work).toEqual(geoWork(solve.answer, geoEntries(solve.answer)))
    expect(filled.answer).toBe(solve.answer.expectedDisplay)
    expect(filled.statement).not.toContain(solve.answer.stages[1]!.answerText)
  })

  it('describes the Unit 5 quadrilateral problems without changing the geometry kind', () => {
    const cases = [
      ['geoParallelograms', 'gq.props', 'parallelogramProps'],
      ['geoParallelograms', 'gq.prove', 'parallelogramProve'],
      ['geoParallelograms', 'gq.coords', 'parallelogramCoords'],
      ['geoSpecialQuads', 'gs.props', 'specialQuadProps'],
      ['geoSpecialQuads', 'gs.classify', 'quadClassify'],
      ['geoTrapezoids', 'gz.midseg', 'midsegment'],
      ['geoTrapezoids', 'gz.isosceles', 'trapezoidKite'],
    ] as const
    for (const [moduleId, templateId, question] of cases) {
      const instance = generateProblem(moduleId, templateId, 1)
      if (instance.answer.type !== 'geometry') throw new Error(`${templateId} is not geometry`)
      const a = instance.answer
      expect(a.question).toBe(question)
      assertGeometryQuestion(a.question)
      const ctx = buildTutorContext(instance, attempt(`u5-${templateId}`, { moduleId }), null, false)
      expect(ctx.kind).toBe('geometry')
      expect(ctx.subject).toBe('geometry')
      expect(ctx.statement).toBe(a.figure.ariaLabel ? `${a.prompt} Figure: ${a.figure.ariaLabel}` : a.prompt)
      expect(ctx.canonical[0]).toBe(a.reveal[0])
      for (const stage of a.stages) expect(ctx.statement).not.toContain(stage.reveal[0]!)
      const slip = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(slip.verdict).toBe('mistake')
      if (slip.verdict !== 'mistake') continue
      expect(verdictFromGeo(slip)?.mistake?.id).toBe(a.trap)
      expect(verdictFromGeo(slip)?.status).toBe('wrong')
      expect(verdictFromGeo(gradeGeoStage(a, a.stages[0]!.id, a.stages[0]!.kind === 'choice' ? '' : '???'))?.status).toBe('parse_error')
      const filled = buildTutorContext(instance, attempt(`u5-${templateId}-done`, { moduleId, final: { polyEntries: geoEntries(a) } }), null, true)
      expect(filled.work).toEqual(geoWork(a, geoEntries(a)))
      expect(filled.answer).toBe(a.expectedDisplay)
    }

    // A naming question stated in facts alone has no figure, and the tutor sees the button words she picked.
    let factsSeen = 0
    for (let seed = 1; seed <= 200 && factsSeen === 0; seed++) {
      const named = generateProblem('geoSpecialQuads', 'gs.classify', seed)
      if (named.answer.type !== 'geometry' || named.answer.figure.points.length > 0 || named.answer.stages.length !== 1) continue
      const stage = named.answer.stages[0]!
      const ctx = buildTutorContext(named, attempt('u5-facts', { moduleId: 'geoSpecialQuads', final: { polyEntries: { [GEO_KEYS[stage.id]]: stage.answerText } } }), null, false)
      expect(ctx.statement).toBe(named.answer.prompt)
      expect(ctx.statement).not.toContain('Figure:')
      expect(ctx.work).toEqual([`${stage.label}: ${stage.choices!.find((c) => c.id === stage.answerText)!.text}`])
      factsSeen += 1
    }
    expect(factsSeen).toBe(1)
  }, 120_000)

  it('describes the Unit 6 similarity problems without changing the geometry kind', () => {
    const cases = [
      ['geoRatios', 'gr.proportion', 'proportion'],
      ['geoRatios', 'gr.polygons', 'similarPolygons'],
      ['geoSimilarTriangles', 'gt.prove', 'similarProve'],
      ['geoSimilarTriangles', 'gt.solve', 'similarSolve'],
      ['geoProportionalParts', 'gp.splitter', 'splitter'],
      ['geoProportionalParts', 'gp.bisector', 'angleBisector'],
    ] as const
    for (const [moduleId, templateId, question] of cases) {
      const instance = generateProblem(moduleId, templateId, 1)
      if (instance.answer.type !== 'geometry') throw new Error(`${templateId} is not geometry`)
      const a = instance.answer
      expect(a.question).toBe(question)
      assertGeometryQuestion(a.question)
      const ctx = buildTutorContext(instance, attempt(`u6-${templateId}`, { moduleId }), null, false)
      expect(ctx.kind).toBe('geometry')
      expect(ctx.subject).toBe('geometry')
      expect(ctx.statement).toBe(a.figure.ariaLabel ? `${a.prompt} Figure: ${a.figure.ariaLabel}` : a.prompt)
      expect(ctx.canonical[0]).toBe(a.reveal[0])
      for (const stage of a.stages) expect(ctx.statement).not.toContain(stage.reveal[0]!)
      const slip = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(slip.verdict).toBe('mistake')
      if (slip.verdict !== 'mistake') continue
      expect(verdictFromGeo(slip)?.mistake?.id).toBe(a.trap)
      expect(verdictFromGeo(slip)?.status).toBe('wrong')
      expect(verdictFromGeo(gradeGeoStage(a, a.stages[0]!.id, a.stages[0]!.kind === 'choice' ? '' : '???'))?.status).toBe('parse_error')
      const filled = buildTutorContext(instance, attempt(`u6-${templateId}-done`, { moduleId, final: { polyEntries: geoEntries(a) } }), null, true)
      expect(filled.work).toEqual(geoWork(a, geoEntries(a)))
      expect(filled.answer).toBe(a.expectedDisplay)
    }

    // A proportion stated in words alone has no figure, so the tutor sees the equation and no "Figure:".
    const words = generateProblem('geoRatios', 'gr.proportion', 1)
    if (words.answer.type !== 'geometry') throw new Error('gr.proportion is not geometry')
    expect(words.answer.figure.points).toEqual([])
    const ctx = buildTutorContext(words, attempt('u6-words', { moduleId: 'geoRatios', final: { polyEntries: { x: '5' } } }), null, false)
    expect(ctx.statement).toBe(words.answer.prompt)
    expect(ctx.statement).not.toContain('Figure:')
    expect(ctx.work).toEqual(['x: 5'])
    // The tutor sees the statement she picked, not its id.
    const solve = generateProblem('geoSimilarTriangles', 'gt.solve', 1)
    if (solve.answer.type !== 'geometry') throw new Error('gt.solve is not geometry')
    const statement = solve.answer.stages[0]!
    const picked = buildTutorContext(solve, attempt('u6-statement', { moduleId: 'geoSimilarTriangles', final: { polyEntries: { [GEO_KEYS[statement.id]]: statement.answerText } } }), null, false)
    expect(picked.work).toEqual([`${statement.label}: ${statement.choices!.find((c) => c.id === statement.answerText)!.text}`])
  }, 120_000)

  it('describes the Unit 7 right-triangle problems without changing the geometry kind', () => {
    const cases = [
      ['geoRightSimilar', 'rs.mean', 'geometricMean'],
      ['geoRightSimilar', 'rs.altitude', 'rightAltitude'],
      ['geoPythagorean', 'py.side', 'pythagorean'],
      ['geoPythagorean', 'py.classify', 'pythagoreanConverse'],
      ['geoPythagorean', 'py.apply', 'pythagoreanWords'],
      ['geoSpecialRight', 'sp.special', 'specialRight'],
    ] as const
    for (const [moduleId, templateId, question] of cases) {
      const instance = generateProblem(moduleId, templateId, 1)
      if (instance.answer.type !== 'geometry') throw new Error(`${templateId} is not geometry`)
      const a = instance.answer
      expect(a.question).toBe(question)
      assertGeometryQuestion(a.question)
      const ctx = buildTutorContext(instance, attempt(`u7-${templateId}`, { moduleId }), null, false)
      expect(ctx.kind).toBe('geometry')
      expect(ctx.subject).toBe('geometry')
      // A problem in words alone (a geometric mean, three lengths to classify) has no figure, so no "Figure:".
      expect(ctx.statement).toBe(a.figure.ariaLabel ? `${a.prompt} Figure: ${a.figure.ariaLabel}` : a.prompt)
      expect(ctx.canonical[0]).toBe(a.reveal[0])
      for (const stage of a.stages) expect(ctx.statement).not.toContain(stage.reveal[0]!)
      const slip = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(slip.verdict).toBe('mistake')
      if (slip.verdict !== 'mistake') continue
      // A slip borrowed from the trig core keeps its own id for the tutor.
      expect(verdictFromGeo(slip)?.mistake?.id).toBe(a.trap)
      expect(verdictFromGeo(slip)?.status).toBe('wrong')
      expect(verdictFromGeo(gradeGeoStage(a, a.stages[0]!.id, a.stages[0]!.kind === 'choice' ? '' : '???'))?.status).toBe('parse_error')
      const filled = buildTutorContext(instance, attempt(`u7-${templateId}-done`, { moduleId, final: { polyEntries: geoEntries(a) } }), null, true)
      expect(filled.work).toEqual(geoWork(a, geoEntries(a)))
      expect(filled.answer).toBe(a.expectedDisplay)
    }
    // The tutor sees the kind of triangle she picked, not its id, and a rounded length as she typed it.
    const classify = generateProblem('geoPythagorean', 'py.classify', 1)
    if (classify.answer.type !== 'geometry') throw new Error('py.classify is not geometry')
    const pick = classify.answer.stages[0]!
    const picked = buildTutorContext(classify, attempt('u7-classify', { moduleId: 'geoPythagorean', final: { polyEntries: { [GEO_KEYS[pick.id]]: 'none' } } }), null, false)
    expect(picked.work).toEqual([`${pick.label}: Not a triangle`])
    const story = generateProblem('geoPythagorean', 'py.apply', 1)
    if (story.answer.type !== 'geometry') throw new Error('py.apply is not geometry')
    const typed = buildTutorContext(story, attempt('u7-story', { moduleId: 'geoPythagorean', final: { polyEntries: { [GEO_KEYS[story.answer.stages[0]!.id]]: '222 ft' } } }), null, false)
    expect(typed.work).toEqual([`${story.answer.stages[0]!.label}: 222 ft`])
    expect(story.answer.stages[0]!.round).toBe(0)
  }, 120_000)

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
