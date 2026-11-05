import { generateProblem, getModule } from '@/content'
import { dqSolved, dqStart, gradeDqStep, gradeFxh } from '@/content/modules/diffQuotient/grade'
import { canonicalEntries as polyZerosCanonicalEntries, PZ_KEYS } from '@/content/modules/polyZeros'
import { canonicalEntries as rationalFnsCanonicalEntries, RF_KEYS } from '@/content/modules/rationalFns'
import { canonicalEntries as signChartsCanonicalEntries, SC_KEYS } from '@/content/modules/signCharts'
import type { AnswerSpec, ProblemInstance, RuleCard, TrigAnswerFields } from '@/content/types'
import { checkLogRewrite, checkLogStep, gradeLogEquation } from '@/engine'
import { verifyTrigStep } from '@/engine/trig'
import { expLogStepContext, trigIdentitiesStepContext } from '@/problem/cardSources'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { plain as optPlain } from '@/content/modules/optimization/text'
import { plain as trigPlain } from '@/content/modules/trig/text'

import { detectInverseCompletion } from '@/problem/inverse'
import { buildStepContext, classifyStep } from '@/problem/stepEngine'
import { useStore } from '@/store'

/**
 * Line-by-line problem templates where walking `mod.nextStep` from the starting line reaches completion
 * and every walked line passes that module's own step checker.
 */
export const COVERED_STEP_TEMPLATES = [
  'ineq.linear',
  'ineq.distribute',
  'ineq.fraction',
  'ineq.compound',
  'inv.linear',
  'inv.cbrt-shift',
  'inv.frac-linear',
  'inv.rational',
  'inv.mobius',
  'dq.linear',
  'dq.quadratic',
  'dq.rational',
  'dq.radical',
  'lp.expand',
  'lp.condense',
  'ee.exponential',
  'ee.logarithmic',
  'ee.quadratic',
  'ti.simplify',
  'ti.verify',
] as const

/**
 * Answer / parts templates where the sibling statement is distinct from hers and each part renders
 * cleanly with its answer and the module's own hint/rule wording as the reason.
 */
export const COVERED_PARTS_TEMPLATES = [
  'cs.vertex',
  'opt.wall',
  'opt.pens',
  'opt.numbers',
  'opt.revenue',
  'sd.table',
  'sd.value',
  'sd.factor',
  'pz.zeros',
  'pz.end',
  'pz.build',
  'pz.rational',
  'rf.features',
  'rf.asymptote',
  'rf.equation',
  'sc.poly',
  'sc.rational',
  'sc.chart',
  'cx.arith',
  'cx.divide',
  'cx.powers',
  'cx.quadratic',
  'cx.zeros',
  'eg.features',
  'eg.inverse',
  'em.interest',
  'em.halflife',
  'em.growth',
  'lf.value',
  'lf.convert',
  'lf.decimal',
  'dr.domain',
  'dr.range',
  'pt.locate',
  'pt.valence',
  'pt.trends',
  'pt.ions',
  'pt.why',
  'nm.ion',
  'nm.ionicFormula',
  'nm.ionicName',
  'nm.ionicFromName',
  'nm.molecular',
  'nm.acid',
  'nm.hydrate',
  'nm.classify',
  'ti.express',
  // Geometry. ga.words, gl3.pairs and gc.which are left off: see docs/progress/examples-parity.md.
  'gs.addition',
  'gs.midpoint',
  'gs.coord',
  'ga.addition',
  'ga.bisector',
  'ga.pairs',
  'gl.related',
  'gl.truth',
  'gl.laws',
  'gp.reason',
  'gp.algebraic',
  'gp.twocolumn',
  'gl3.solve',
  'gl3.converse',
  'gl3.slopes',
  'gpa.triangle',
  'gpa.polygon',
  'gc.parts',
  'gc.solve',
  'gi.solve',
  'gt.twocolumn',
  'gq.props',
  'gq.prove',
  'gq.coords',
  'gs.props',
  'gs.classify',
  'gz.midseg',
  'gz.isosceles',
  'gr.proportion',
  'gr.polygons',
  'gt.prove',
  'gt.solve',
  'gp.splitter',
  'gp.bisector',
  'rs.mean',
  'rs.altitude',
  'py.side',
  'py.classify',
  'py.apply',
  'sp.special',
  'tr.ratio',
  'tr.side',
  'tr.angle',
  'el.story',
  'el.two',
  // Precalc trig, Units 4–5.
  'am.convert',
  'am.coterminal',
  'am.reference',
  'am.arc',
  'rt.ratios',
  'rt.special',
  'rt.side',
  'rt.angle',
  'uc.exact',
  'uc.point',
  'uc.given',
  'uc.solve',
  'sg.features',
  'sg.equation',
  'sg.model',
  'og.features',
  'og.match',
  'it.evaluate',
  'it.compose',
  // Chemistry chapters 3–5.
  'sf.count',
  'sf.round',
  'sf.muldiv',
  'sf.addsub',
  'sf.mixed',
  'sf.sci',
  'atom.particles',
  'atom.notation',
  'atom.avgmass',
  'atom.abundance',
  'light.freq',
  'light.wavelength',
  'light.energy',
  'light.spectrum',
  'ec.full',
  'ec.shorthand',
  'ec.ion',
  'ec.identify',
  'ec.valence',
  'ec.diagram',
  'qn.meaning',
  'qn.allowed',
  'qn.count',
  'qn.name',
  'qn.shapes',
  'qn.pauli',
  // Precalc trig, Unit 6 part 2.
  'ta.sumdiff',
  'ta.double',
  'ta.half',
  'te.linear',
  'te.factor',
  // Chemistry chapter 8 (ionic and metallic bonding).
  'ib.valence',
  'ib.dots',
  'ib.transfer',
  'ib.props',
  'mb.sea',
] as const

const STEP_SET = new Set<string>(COVERED_STEP_TEMPLATES)
const PARTS_SET = new Set<string>(COVERED_PARTS_TEMPLATES)

export const COVERED_TEMPLATES = [...COVERED_STEP_TEMPLATES, ...COVERED_PARTS_TEMPLATES] as const

export interface WorkedStepLine {
  /** 1-based step number in the walk. */
  index: number
  /** App-syntax text of the walked step. */
  text: string
  /** Display text (e.g. `f(x + h) = ...` on step 1 of a difference quotient). */
  displayText: string
  /** Short stage label from `StepHint.stage`. */
  stage: string
  /** Module's own hint wording (`StepHint.nudge`). */
  nudge: string
  /** Optional rule card title from the module's `ruleCards`. */
  ruleTitle?: string
  /** Optional rule card body from the module's `ruleCards`. */
  ruleBody?: string
  /** True when the line passed the module's own checker. */
  checked: boolean
}

export interface WorkedPartItem {
  id: string
  label: string
  ask?: string
  answer: string
  why: string
  ruleTitle?: string
  ruleBody?: string
  details?: string[]
}

export interface WorkedStepsExample {
  kind: 'steps'
  sibling: ProblemInstance
  startLine: string
  lines: WorkedStepLine[]
  /** Final conclusion shown after the last line is revealed (e.g. interval/set notation or solution). */
  conclusion?: {
    label: string
    items: { label: string; value: string }[]
  }
  everyLineChecked: boolean
}

export interface WorkedPartsExample {
  kind: 'parts'
  sibling: ProblemInstance
  prompt?: string
  /**
   * Algebra lines printed above the parts. The lines are given; the reasons are the answers.
   * Shown only when the sibling's answer carries a non-empty `lines` list.
   */
  given?: { label: string; lines: string[] }
  parts: WorkedPartItem[]
}

export type WorkedExample = WorkedStepsExample | WorkedPartsExample

/**
 * Whether this problem instance offers the "Example — see one like it" button.
 * Never offered on her own typed problem (`instance.own`) or on uncovered templates.
 */
export function offersExample(instance: ProblemInstance): boolean {
  if (instance.own) return false
  return STEP_SET.has(instance.templateId) || PARTS_SET.has(instance.templateId)
}

/**
 * Append an `example_viewed` event to the store's event log without touching the active attempt's
 * `firstTry`, `revealed`, `hintsUsed`, or `steps`.
 */
export function recordExampleViewed(skill: string, moduleId: string, now = Date.now()): void {
  useStore.setState((s) => ({
    events: [...s.events, { t: 'example_viewed', skill, moduleId, at: now }],
  }))
}

function findRule(cards: readonly RuleCard[], id: string | undefined): RuleCard | undefined {
  if (!id) return undefined
  return cards.find((c) => c.id === id)
}

/** Optimization math strings as words, then drop a leftover currency mark so the panel stays plain text. */
function optText(text: string): string {
  return optPlain(text).replaceAll('$', '')
}

function withoutDollars(text: string): string {
  return text.replaceAll('$', '')
}

function withUnit(display: string, unit: string): string {
  const trimmed = display.trim()
  if (!unit || trimmed.includes(unit)) return trimmed
  return `${trimmed} ${unit}`
}

/**
 * The figure the example would draw. An empty geometry diagram and a trig figure of kind `none`
 * are not drawn, so they are not her numbers and do not count.
 */
function carriedFigure(ans: AnswerSpec): unknown {
  if (ans.type === 'geometry') return ans.figure.points.length > 0 ? ans.figure : undefined
  if (
    ans.type === 'angleMeasure' ||
    ans.type === 'rightTriangle' ||
    ans.type === 'unitCircle' ||
    ans.type === 'sinusoids' ||
    ans.type === 'otherTrigGraphs' ||
    ans.type === 'inverseTrig' ||
    ans.type === 'trigIdentities' ||
    ans.type === 'trigFormulas' ||
    ans.type === 'trigEquations'
  ) {
    return ans.figure.kind === 'none' ? undefined : ans.figure
  }
  if (ans.type === 'optimization' || ans.type === 'quantum') return ans.figure
  return undefined
}

function sameFigure(a: AnswerSpec, b: AnswerSpec): boolean {
  const fa = carriedFigure(a)
  const fb = carriedFigure(b)
  if (fa == null || fb == null) return false
  return JSON.stringify(fa) === JSON.stringify(fb)
}

function trigParts(sibling: ProblemInstance, ans: TrigAnswerFields, cards: readonly RuleCard[]): WorkedPartsExample {
  return {
    kind: 'parts',
    sibling,
    parts: ans.stages.map((stage) => {
      const rule = findRule(cards, stage.ruleCard)
      const choice = stage.kind === 'choice' ? stage.choices?.find((c) => c.value === stage.answerText)?.label : undefined
      const ask = trigPlain(stage.ask).trim()
      return {
        id: stage.id,
        label: trigPlain(stage.label),
        ...(ask ? { ask } : {}),
        answer: trigPlain(choice ?? stage.answerText),
        why: trigPlain(stage.nudge),
        ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
        details: stage.reveal.map(trigPlain),
      }
    }),
  }
}

function candidateSeed(baseSeed: number, step: number): number {
  const s = ((baseSeed >>> 0) + Math.imul(step, 0x9e3779b1)) >>> 0
  if (s === (baseSeed >>> 0)) return ((s + 1) >>> 0) || 1
  return s || 1
}

/**
 * Walk `mod.nextStep` from the sibling's starting state and verify every line against the module's
 * own step checker. Returns null if the walk fails to reach completion or any line fails the checker.
 */
function buildStepsExample(sibling: ProblemInstance): WorkedStepsExample | null {
  const mod = getModule(sibling.moduleId)
  const cards = mod.ruleCards

  if (sibling.moduleId === 'diffQuotient' && sibling.answer.type === 'diffQuotient') {
    const ans = sibling.answer
    const lines: WorkedStepLine[] = []
    let currentLine: string | null = null
    let prevDqLine = ''
    for (let guard = 0; guard < 16; guard++) {
      if (currentLine !== null && (mod.solved ? mod.solved(sibling, currentLine) : dqSolved(sibling, currentLine))) {
        break
      }
      const next = mod.nextStep(sibling, currentLine, false)
      if (!next) break
      let checked = false
      let displayText = next.text
      if (currentLine === null) {
        const g = gradeFxh(sibling, next.text)
        checked = g.ok
        displayText = `f(x + h) = ${next.text}`
        prevDqLine = dqStart(sibling, next.text)
      } else {
        const g = gradeDqStep(sibling, prevDqLine, next.text)
        checked = g.ok
        prevDqLine = next.text
      }
      if (!checked) return null
      const rule = findRule(cards, next.ruleCard)
      lines.push({
        index: lines.length + 1,
        text: next.text,
        displayText,
        stage: next.stage,
        nudge: next.nudge,
        ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
        checked,
      })
      currentLine = next.text
    }
    const done = currentLine !== null && (mod.solved ? mod.solved(sibling, currentLine) : dqSolved(sibling, currentLine))
    if (!done || lines.length === 0) return null
    return {
      kind: 'steps',
      sibling,
      startLine: `f(x) = ${ans.f}`,
      lines,
      conclusion: {
        label: 'Simplified difference quotient',
        items: [{ label: '[f(x + h) - f(x)] / h', value: ans.simplified }],
      },
      everyLineChecked: lines.every((l) => l.checked),
    }
  }

  if (sibling.moduleId === 'inequalities' && sibling.answer.type === 'set') {
    const start = sibling.start
    if (!start) return null
    const lines: WorkedStepLine[] = []
    let currentLine = start
    for (let guard = 0; guard < 16; guard++) {
      if (mod.solved?.(sibling, currentLine)) break
      const next = mod.nextStep(sibling, currentLine, false)
      if (!next) break
      const verdict = classifyStep(currentLine, next.text, buildStepContext(sibling, false))
      const checked = verdict.kind === 'accepted'
      if (!checked) return null
      const rule = findRule(cards, next.ruleCard)
      lines.push({
        index: lines.length + 1,
        text: next.text,
        displayText: next.text,
        stage: next.stage,
        nudge: next.nudge,
        ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
        checked,
      })
      currentLine = next.text
    }
    if (!mod.solved?.(sibling, currentLine) || lines.length === 0) return null
    return {
      kind: 'steps',
      sibling,
      startLine: start,
      lines,
      conclusion: {
        label: 'Solution set',
        items: [
          { label: 'Interval notation', value: sibling.answer.interval },
          { label: 'Set-builder notation', value: sibling.answer.setBuilder },
        ],
      },
      everyLineChecked: lines.every((l) => l.checked),
    }
  }

  if (sibling.moduleId === 'inverses' && sibling.answer.type === 'inverse') {
    if (!sibling.answer.oneToOne || !sibling.answer.inverse || !sibling.start) return null
    const start = sibling.start
    const lines: WorkedStepLine[] = []
    let currentLine = start
    let swapped = false
    for (let guard = 0; guard < 16; guard++) {
      if (detectInverseCompletion(currentLine, sibling.answer.inverse, sibling.seed) !== null) break
      const next = mod.nextStep(sibling, currentLine, swapped)
      if (!next) break
      const verdict = classifyStep(currentLine, next.text, buildStepContext(sibling, swapped))
      const checked = verdict.kind === 'accepted'
      if (!checked) return null
      if (verdict.result.swapped) swapped = true
      const rule = findRule(cards, next.ruleCard)
      lines.push({
        index: lines.length + 1,
        text: next.text,
        displayText: next.text,
        stage: next.stage,
        nudge: next.nudge,
        ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
        checked,
      })
      currentLine = next.text
    }
    const completion = detectInverseCompletion(currentLine, sibling.answer.inverse, sibling.seed)
    if (completion === null || lines.length === 0) return null
    return {
      kind: 'steps',
      sibling,
      startLine: start,
      lines,
      conclusion: {
        label: 'Inverse function',
        items: [{ label: 'f⁻¹(x)', value: sibling.answer.inverse }],
      },
      everyLineChecked: lines.every((l) => l.checked),
    }
  }

  if (sibling.moduleId === 'logProperties' && sibling.answer.type === 'logProperties') {
    const start = sibling.start ?? sibling.answer.expr
    const lines: WorkedStepLine[] = []
    let currentLine = start
    for (let guard = 0; guard < 16; guard++) {
      if (mod.solved?.(sibling, currentLine)) break
      const next = mod.nextStep(sibling, currentLine, false)
      if (!next) break
      const check = checkLogRewrite(currentLine, next.text, {
        assumePositive: true,
        vars: sibling.answer.vars,
      })
      if (!check.ok) return null
      const rule = findRule(cards, next.ruleCard)
      lines.push({
        index: lines.length + 1,
        text: next.text,
        displayText: next.text,
        stage: next.stage,
        nudge: next.nudge,
        ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
        checked: true,
      })
      currentLine = next.text
    }
    if (!mod.solved?.(sibling, currentLine) || lines.length === 0) return null
    return {
      kind: 'steps',
      sibling,
      startLine: start,
      lines,
      conclusion: {
        label: sibling.answer.question === 'expand' ? 'Expanded form' : 'Single logarithm',
        items: [{ label: 'Result', value: sibling.answer.answerText }],
      },
      everyLineChecked: lines.every((l) => l.checked),
    }
  }

  if (sibling.moduleId === 'trigIdentities' && sibling.answer.type === 'trigIdentities' && sibling.answer.question !== 'express') {
    const start = sibling.start ?? sibling.answer.expr
    const ctx = trigIdentitiesStepContext(sibling)
    if (!ctx) return null
    const lines: WorkedStepLine[] = []
    let currentLine = start
    for (let guard = 0; guard < 16; guard++) {
      if (mod.solved?.(sibling, currentLine)) break
      const next = mod.nextStep(sibling, currentLine, false)
      if (!next) break
      const check = verifyTrigStep(currentLine, next.text, ctx)
      if (!check.ok) return null
      const rule = findRule(cards, next.ruleCard)
      lines.push({
        index: lines.length + 1,
        text: next.text,
        displayText: next.text,
        stage: next.stage,
        nudge: next.nudge,
        ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
        checked: true,
      })
      currentLine = next.text
    }
    if (!mod.solved?.(sibling, currentLine) || lines.length === 0) return null
    return {
      kind: 'steps',
      sibling,
      startLine: start,
      lines,
      conclusion: {
        label: sibling.answer.question === 'verify' ? 'Verified identity' : 'Simplified expression',
        items: [{ label: sibling.answer.question === 'verify' ? 'Right-hand side' : 'Result', value: sibling.answer.answerText }],
      },
      everyLineChecked: lines.every((l) => l.checked),
    }
  }

  if (sibling.moduleId === 'expLogEquations' && sibling.answer.type === 'expLogEquations') {
    const start = sibling.start ?? sibling.answer.equation
    const lines: WorkedStepLine[] = []
    let currentLine = start
    const ctx = expLogStepContext(sibling) ?? { vars: ['x' as const] }
    for (let guard = 0; guard < 16; guard++) {
      const next = mod.nextStep(sibling, currentLine, false)
      if (!next) break
      const check = checkLogStep(currentLine, next.text, ctx)
      if (!check.ok) return null
      const rule = findRule(cards, next.ruleCard)
      lines.push({
        index: lines.length + 1,
        text: next.text,
        displayText: next.text,
        stage: next.stage,
        nudge: next.nudge,
        ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
        checked: true,
      })
      currentLine = next.text
    }
    if (lines.length === 0) return null
    const finalGrade = gradeLogEquation(sibling.answer.equation, sibling.answer.answerText, {
      vars: ['x'],
      ...(sibling.answer.places ? { decimal: { places: sibling.answer.places } } : {}),
    })
    if (finalGrade.verdict !== 'correct') return null
    return {
      kind: 'steps',
      sibling,
      startLine: start,
      lines,
      conclusion: {
        label: 'Solution',
        items: [{ label: 'x', value: sibling.answer.answerText }],
      },
      everyLineChecked: lines.every((l) => l.checked),
    }
  }

  return null
}

function buildPartsForAnswer(sibling: ProblemInstance, ans: AnswerSpec, cards: readonly RuleCard[]): WorkedPartsExample | null {
  switch (ans.type) {
    case 'quadratics': {
      if (sibling.templateId !== 'cs.vertex') return null
      const rule = findRule(cards, ans.ruleCard)
      const opensStr = ans.opens === 'up' ? 'Opens upward' : 'Opens downward'
      const extremumLabel = ans.extremumKind === 'minimum' ? 'Minimum value' : 'Maximum value'
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: [
          {
            id: 'vertexForm',
            label: 'Vertex form',
            answer: ans.vertexForm,
            why: ans.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: ans.reveal,
          },
          {
            id: 'vertex',
            label: 'Vertex (h, k)',
            answer: ans.vertexText,
            why: 'In a(x − h)² + k, the subtracted h is the x-coordinate and the outside k is the y-coordinate.',
          },
          {
            id: 'axis',
            label: 'Axis of symmetry',
            answer: ans.axisText,
            why: 'The axis of symmetry is the vertical line x = h through the vertex.',
          },
          {
            id: 'extremum',
            label: `${opensStr} · ${extremumLabel}`,
            answer: `${extremumLabel}: ${ans.extremumText}`,
            why:
              ans.opens === 'up'
                ? 'Since the leading coefficient a is positive, the parabola opens upward and reaches its minimum value k at the vertex.'
                : 'Since the leading coefficient a is negative, the parabola opens downward and reaches its maximum value k at the vertex.',
          },
        ],
      }
    }

    case 'optimization': {
      return {
        kind: 'parts',
        sibling,
        prompt: optPlain(ans.prompt),
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const ask = optText(stage.ask).trim()
          return {
            id: stage.id,
            label: stage.label,
            ...(ask ? { ask } : {}),
            answer: optText(stage.answerText),
            why: optText(stage.nudge),
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal.map(optText),
          }
        }),
      }
    }

    case 'polyDivision': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          let label = 'Part'
          let answer = ''
          switch (stage.id) {
            case 'row':
              label = 'Coefficient row'
              answer = ans.rows.coefficients.join(', ')
              break
            case 'grid':
              label = 'Synthetic division table'
              answer = `Box: ${ans.c} · Products: ${ans.rows.products.join(', ')} · Bottom row: ${ans.rows.bottom.join(', ')}`
              break
            case 'answers':
              label = 'Quotient and remainder'
              answer = `Quotient: ${ans.quotientText}; Remainder: ${ans.remainderText}`
              break
            case 'bottom':
              label = 'Bottom row'
              answer = ans.rows.bottom.join(', ')
              break
            case 'value':
              label = `Value f(${ans.c})`
              answer = ans.remainderText
              break
            case 'factor':
              label = `Is ${ans.divisor} a factor?`
              answer = ans.isFactor
                ? `Yes — the remainder is 0, so ${ans.divisor} is a factor`
                : `No — the remainder is ${ans.remainderText} ≠ 0`
              break
          }
          return {
            id: stage.id,
            label,
            answer,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'polyZeros': {
      const entries = polyZerosCanonicalEntries(ans)
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          let label = 'Part'
          let answer = ''
          switch (stage.id) {
            case 'zeros':
              label = 'Zeros and multiplicities'
              answer = ans.zeros.map((z) => `x = ${z.text} (multiplicity ${z.mult})`).join('; ')
              break
            case 'cross':
              label = 'Graph behavior at each zero'
              answer = ans.zeros.map((z) => `x = ${z.text}: ${z.behavior ?? 'crosses'} the x-axis`).join('; ')
              break
            case 'end':
              label = 'End behavior'
              answer = `As x → −∞, f(x) → ${ans.end?.left === 'up' ? '+∞' : '−∞'}; as x → +∞, f(x) → ${
                ans.end?.right === 'up' ? '+∞' : '−∞'
              }`
              break
            case 'formula':
              label = 'Polynomial f(x)'
              answer = `f(x) = ${entries[PZ_KEYS.formula] ?? ans.f}`
              break
            case 'candidates':
              label = 'Possible rational zeros (±p/q)'
              answer = entries[PZ_KEYS.candidates] ?? ans.candidatesText ?? ''
              break
            case 'rational':
              label = 'Actual rational zeros'
              answer = entries[PZ_KEYS.rational] ?? ans.rationalZerosText ?? ''
              break
          }
          return {
            id: stage.id,
            label,
            answer,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'rationalFns': {
      const entries = rationalFnsCanonicalEntries(ans)
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          let label = 'Part'
          const raw = entries[RF_KEYS[stage.id]] ?? ''
          let answer = raw
          switch (stage.id) {
            case 'domain':
              label = 'Domain'
              break
            case 'holes':
              label = 'Holes'
              break
            case 'va':
              label = 'Vertical asymptote(s)'
              break
            case 'asymptote':
              label = 'Horizontal or slant asymptote'
              break
            case 'xint':
              label = 'x-intercept(s)'
              break
            case 'yint':
              label = 'y-intercept'
              break
            case 'solution':
              label = 'Solution'
              answer = raw === 'none' ? 'No solution' : `x = ${raw}`
              break
          }
          return {
            id: stage.id,
            label,
            answer: answer || ans.expectedDisplay,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'signCharts': {
      const entries = signChartsCanonicalEntries(ans)
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          let label = 'Part'
          let answer = entries[SC_KEYS[stage.id]] ?? ''
          switch (stage.id) {
            case 'critical':
              label = 'Critical numbers'
              answer = answer || ans.criticalText
              break
            case 'signs': {
              label = 'Signs on each interval'
              const signParts = ans.signsText.split(',').map((s) => s.trim())
              answer = ans.intervals.map((iv, idx) => `${iv}: ${signParts[idx] ?? '+'}`).join(' · ')
              break
            }
            case 'solution':
              label = 'Solution in interval notation'
              answer = answer || ans.solutionText
              break
          }
          return {
            id: stage.id,
            label,
            answer,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'complexNums': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const labelByQuestion: Record<typeof ans.question, string> = {
            arith: 'Standard form a + bi',
            divide: 'Quotient in standard form a + bi',
            powers: 'Simplified power of i',
            quadratic: 'Solutions in standard form',
            zeros: 'All complex zeros',
          }
          return {
            id: stage.id,
            label: labelByQuestion[ans.question],
            answer: ans.expectedDisplay,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'expLogGraphs': {
      if (ans.question === 'match') return null
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          let answer = stage.answerText
          if (stage.kind === 'choice') {
            answer = stage.choices?.find((c) => c.value === stage.answerText)?.label ?? stage.answerText
          }
          return {
            id: stage.id,
            label: stage.label,
            ask: stage.ask,
            answer,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'expModels': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const unit = stage.units?.[0]
          const suffix = unit && !stage.answerText.endsWith(unit) ? ` ${unit}` : ''
          const ask = withoutDollars(stage.ask).trim()
          return {
            id: stage.id,
            label: stage.label,
            ...(ask ? { ask } : {}),
            answer: withoutDollars(`${stage.answerText}${suffix}`),
            why: withoutDollars(stage.nudge),
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal.map(withoutDollars),
          }
        }),
      }
    }

    case 'logForms': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const labelByQuestion: Record<typeof ans.question, string> = {
            value: 'Exact value',
            convert: 'Converted form',
            decimal: 'Rounded value',
          }
          return {
            id: stage.id,
            label: labelByQuestion[ans.question],
            answer: ans.answerText,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'domainRange': {
      const rule = findRule(cards, ans.ruleCard)
      return {
        kind: 'parts',
        sibling,
        prompt: sibling.instructions,
        parts: [
          {
            id: ans.question,
            label: ans.question === 'domain' ? 'Domain (interval notation)' : 'Range (interval notation)',
            answer: ans.interval,
            why: ans.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: ans.reveal,
          },
        ],
      }
    }

    case 'periodic': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const choiceText =
            stage.kind === 'choice' ? stage.choices?.find((c) => c.id === stage.answerText)?.text : undefined
          return {
            id: stage.id,
            label: stage.label,
            answer: choiceText ?? stage.answerText,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'ionicBonding': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const choiceText =
            stage.kind === 'choice' ? stage.choices?.find((c) => c.id === stage.answerText)?.text : undefined
          return {
            id: stage.id,
            label: stage.label,
            answer: choiceText ?? stage.answerText,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'trigIdentities': {
      if (ans.question !== 'express') return null
      return {
        kind: 'parts',
        sibling,
        prompt: trigPlain(ans.prompt),
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const choiceText =
            stage.kind === 'choice' ? stage.choices?.find((c) => c.value === stage.answerText)?.label : undefined
          return {
            id: stage.id,
            label: trigPlain(stage.label),
            ask: trigPlain(stage.ask),
            answer: trigPlain(choiceText ?? stage.answerText),
            why: trigPlain(stage.nudge),
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal.map(trigPlain),
          }
        }),
      }
    }

    case 'nomenclature': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          return {
            id: stage.id,
            label: stage.label,
            answer: stage.answerDisplay,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'geometry': {
      const given = ans.lines && ans.lines.length > 0 ? { label: 'Given work', lines: ans.lines } : undefined
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        ...(given ? { given } : {}),
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const ask = stage.hint.trim()
          return {
            id: stage.id,
            label: stage.label,
            ...(ask ? { ask } : {}),
            answer: stageDisplay(stage),
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    case 'angleMeasure':
    case 'rightTriangle':
    case 'unitCircle':
    case 'sinusoids':
    case 'otherTrigGraphs':
    case 'inverseTrig':
    case 'trigFormulas':
    case 'trigEquations':
      return trigParts(sibling, ans, cards)

    case 'sigFigs': {
      const rule = findRule(cards, ans.ruleCard)
      const label =
        ans.task.kind === 'count'
          ? 'Significant figures'
          : ans.task.kind === 'round'
            ? 'Rounded value'
            : ans.task.kind === 'convert'
              ? ans.task.to === 'scientific'
                ? 'Scientific notation'
                : 'Standard notation'
              : 'Result'
      const context = ans.context.trim()
      const prompt = context && context !== ans.prompt.trim() ? context : undefined
      return {
        kind: 'parts',
        sibling,
        ...(prompt ? { prompt } : {}),
        parts: [
          {
            id: 'answer',
            label,
            answer: withUnit(ans.expectedDisplay, ans.unit),
            why: ans.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: ans.reveal,
          },
        ],
      }
    }

    case 'atoms': {
      const rule = findRule(cards, ans.ruleCard)
      const q = ans.question
      const label =
        q.kind === 'particles'
          ? 'Protons, neutrons, and electrons'
          : q.kind === 'notation'
            ? 'Nuclear symbol'
            : q.kind === 'avgmass'
              ? 'Average atomic mass'
              : 'Percent abundance'
      // The isotope table is the problem. The statement only names the element, so the givens go on the prompt line.
      const prompt =
        q.kind === 'avgmass'
          ? q.isotopes.map((iso) => `${iso.label}: ${iso.mass} u, ${iso.abundance}%`).join('; ')
          : q.kind === 'abundance'
            ? q.isotopes.map((iso) => `${iso.label}: ${iso.mass} u`).join('; ')
            : ans.context.trim() || undefined
      return {
        kind: 'parts',
        sibling,
        ...(prompt ? { prompt } : {}),
        parts: [
          {
            id: q.kind,
            label,
            answer: withUnit(ans.expectedDisplay, ans.unit),
            why: ans.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: ans.reveal,
          },
        ],
      }
    }

    case 'electrons': {
      const rule = findRule(cards, ans.ruleCard)
      const q = ans.question
      let label = 'Answer'
      let answer = ans.expectedDisplay
      const extra: string[] = []
      if (ans.context.trim()) extra.push(ans.context.trim())
      if (q.kind === 'light') {
        label = q.formula === 'freq' ? 'Frequency' : q.formula === 'wavelength' ? 'Wavelength' : 'Photon energy'
        answer = withUnit(ans.expectedDisplay, q.unit)
      } else if (q.kind === 'order') {
        label = 'Order'
        extra.push(q.items.map((item) => item.label).join(', '))
      } else {
        const byAsk = {
          full: 'Full configuration',
          shorthand: 'Noble-gas shorthand',
          ion: 'Ion configuration',
          identify: 'Element',
          valence: 'Valence electrons',
          diagram: 'Orbital diagram',
        } as const
        label = byAsk[q.ask]
        if (q.ask === 'identify') extra.push(q.display)
      }
      const prompt = extra.join(' ').trim()
      return {
        kind: 'parts',
        sibling,
        ...(prompt ? { prompt } : {}),
        parts: [
          {
            id: q.kind === 'econfig' ? q.ask : q.kind,
            label,
            answer,
            why: ans.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: ans.reveal,
          },
        ],
      }
    }

    case 'quantum': {
      return {
        kind: 'parts',
        sibling,
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          const choiceText = stage.kind === 'choice' ? stage.choices?.find((c) => c.id === stage.answerText)?.text : undefined
          const ask = stage.hint.trim()
          return {
            id: stage.id,
            label: stage.label,
            ...(ask ? { ask } : {}),
            answer: choiceText ?? stage.answerText,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
          }
        }),
      }
    }

    default:
      return null
  }
}

function buildPartsExample(sibling: ProblemInstance): WorkedPartsExample | null {
  const mod = getModule(sibling.moduleId)
  const out = buildPartsForAnswer(sibling, sibling.answer, mod.ruleCards)
  if (!out || out.parts.length === 0) return null
  if (out.parts.some((p) => !p.label.trim() || !p.answer.trim() || !p.why.trim())) return null
  return out
}

/**
 * Generate a worked example for a sibling seed of the same module and template.
 * Never uses `instance.seed`, and always steps to the next seed if a candidate produces the same
 * `statementText`, the same drawn figure, or a step walk that does not complete cleanly.
 */
export function buildWorkedExample(instance: ProblemInstance, offset = 1): WorkedExample | null {
  if (!offersExample(instance)) return null
  const isStep = STEP_SET.has(instance.templateId)
  const startStep = Math.max(1, offset)
  const herStatement = instance.statementText.trim()

  for (let tries = 0; tries < 48; tries++) {
    const seed = candidateSeed(instance.seed, startStep + tries)
    if (seed === (instance.seed >>> 0)) continue
    let sibling: ProblemInstance
    try {
      sibling = generateProblem(instance.moduleId, instance.templateId, seed, instance.knobs)
    } catch {
      continue
    }
    if ((sibling.seed >>> 0) === (instance.seed >>> 0)) continue
    if (sibling.id === instance.id) continue
    if (sibling.statementText.trim() === herStatement) continue
    if (sameFigure(instance.answer, sibling.answer)) continue

    const example = isStep ? buildStepsExample(sibling) : buildPartsExample(sibling)
    if (!example) continue
    if (example.kind === 'steps' && (!example.everyLineChecked || example.lines.length === 0)) continue
    return example
  }

  return null
}
