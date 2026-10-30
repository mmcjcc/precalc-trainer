import { generateProblem, getModule } from '@/content'
import { dqSolved, dqStart, gradeDqStep, gradeFxh } from '@/content/modules/diffQuotient/grade'
import { canonicalEntries as polyZerosCanonicalEntries, PZ_KEYS } from '@/content/modules/polyZeros'
import { canonicalEntries as rationalFnsCanonicalEntries, RF_KEYS } from '@/content/modules/rationalFns'
import { canonicalEntries as signChartsCanonicalEntries, SC_KEYS } from '@/content/modules/signCharts'
import type { AnswerSpec, ProblemInstance, RuleCard } from '@/content/types'
import { checkLogRewrite, checkLogStep, gradeLogEquation } from '@/engine'
import { expLogStepContext } from '@/problem/cardSources'
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
        prompt: ans.prompt,
        parts: ans.stages.map((stage) => {
          const rule = findRule(cards, stage.ruleCard)
          return {
            id: stage.id,
            label: stage.label,
            ask: stage.ask,
            answer: stage.answerText,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
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
          const prefix = stage.money && !stage.answerText.startsWith('$') ? '$' : ''
          const unit = stage.units?.[0]
          const suffix = unit && !stage.answerText.endsWith(unit) ? ` ${unit}` : ''
          return {
            id: stage.id,
            label: stage.label,
            ask: stage.ask,
            answer: `${prefix}${stage.answerText}${suffix}`,
            why: stage.nudge,
            ...(rule ? { ruleTitle: rule.title, ruleBody: rule.body } : {}),
            details: stage.reveal,
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
 * `statementText` (or if a candidate's step walk does not complete cleanly).
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

    const example = isStep ? buildStepsExample(sibling) : buildPartsExample(sibling)
    if (!example) continue
    if (example.kind === 'steps' && (!example.everyLineChecked || example.lines.length === 0)) continue
    return example
  }

  return null
}
