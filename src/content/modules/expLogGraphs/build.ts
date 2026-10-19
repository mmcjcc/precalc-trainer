import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type {
  DifficultyKnobs,
  ExpLogGraphsAnswer,
  ExpLogGraphsStageId,
  ExpLogMatchCandidate,
  ProblemInstance,
  RuleCardId,
  TemplateDef,
} from '@/content/types'
import { compileExpr, evaluateExpr, parseExpression } from '@/engine'
import type { CalcPanels, ErrorPatternId, GraphSpec } from '@/shared/types'
import { LogSkip, anyShows, catalogExample, frac, ipow, searchSeed, staticTexts } from '../explog/text'
import { gradeExpLogGraphsStage } from './grade'
import { EG_RULES, EG_RULE_FOR, EG_RULE_IDS } from './rules'

export const EG_MODULE_ID = 'expLogGraphs' as const

const NO_GRAPH: GraphSpec = { kind: 'none' }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

interface BaseChoice {
  text: string
  num: number
  den: number
  value: number
}

const EXP_BASES: readonly BaseChoice[] = [
  { text: '2', num: 2, den: 1, value: 2 },
  { text: '3', num: 3, den: 1, value: 3 },
  { text: '4', num: 4, den: 1, value: 4 },
  { text: '5', num: 5, den: 1, value: 5 },
  { text: '1/2', num: 1, den: 2, value: 0.5 },
  { text: '1/3', num: 1, den: 3, value: 1 / 3 },
  { text: '1/4', num: 1, den: 4, value: 0.25 },
  { text: 'e', num: 0, den: 1, value: Math.E },
]

const LOG_FEATURE_BASES: readonly BaseChoice[] = [
  { text: '2', num: 2, den: 1, value: 2 },
  { text: '3', num: 3, den: 1, value: 3 },
  { text: '4', num: 4, den: 1, value: 4 },
  { text: '5', num: 5, den: 1, value: 5 },
  { text: '10', num: 10, den: 1, value: 10 },
]

const INV_BASES: readonly BaseChoice[] = [
  { text: '2', num: 2, den: 1, value: 2 },
  { text: '3', num: 3, den: 1, value: 3 },
  { text: '4', num: 4, den: 1, value: 4 },
  { text: '5', num: 5, den: 1, value: 5 },
  { text: '10', num: 10, den: 1, value: 10 },
  { text: 'e', num: 0, den: 1, value: Math.E },
]

export function xShiftText(h: number): string {
  if (h === 0) return 'x'
  return h > 0 ? `x - ${h}` : `x + ${-h}`
}

export function kSuffix(k: number): string {
  if (k === 0) return ''
  return k > 0 ? ` + ${k}` : ` - ${-k}`
}

export function expFormula(a: number, baseText: string, h: number, k: number): string {
  const expPart = h === 0 ? 'x' : `(${xShiftText(h)})`
  const baseFormatted = baseText.includes('/') ? `(${baseText})` : baseText
  const powerPart = `${baseFormatted}^${expPart}`
  const core = a === 1 ? powerPart : a === -1 ? `-${powerPart}` : `${a} * ${powerPart}`
  return `${core}${kSuffix(k)}`
}

export function logFormula(a: number, baseText: string, h: number, k: number): string {
  const arg = xShiftText(h)
  const logName = baseText === 'e' ? 'ln' : baseText === '10' ? 'log' : `log_${baseText}`
  const logCall = `${logName}(${arg})`
  const core = a === 1 ? logCall : a === -1 ? `-${logCall}` : `${a} * ${logCall}`
  return `${core}${kSuffix(k)}`
}

function exactPowerFrac(num: number, den: number, exp: number): { n: number; d: number } {
  if (exp === 0) return { n: 1, d: 1 }
  if (exp > 0) return { n: ipow(num, exp), d: ipow(den, exp) }
  return { n: ipow(den, -exp), d: ipow(num, -exp) }
}

function makeGraphSpec(
  family: 'exp' | 'log',
  f: string,
  h: number,
  k: number,
  dot?: { x: number; y: number },
  finv?: string,
): GraphSpec {
  const bound = Math.max(8, Math.ceil(Math.abs(h) + 5), Math.ceil(Math.abs(k) + 5))
  return {
    kind: 'function',
    f,
    fBreaks: family === 'log' ? [h] : undefined,
    finv,
    showIdentity: Boolean(finv),
    guides: [family === 'exp' ? { expr: String(k) } : { x: h }],
    dots: dot && Number.isFinite(dot.x) && Number.isFinite(dot.y) && Math.abs(dot.x) <= bound && Math.abs(dot.y) <= bound
      ? [{ x: dot.x, y: dot.y, closed: true }]
      : undefined,
    xDomain: [-bound, bound],
    yDomain: [-bound, bound],
  }
}

function assertSelf(instance: ProblemInstance, answer: ExpLogGraphsAnswer): void {
  for (const stage of answer.stages) {
    const g = gradeExpLogGraphsStage(answer, stage.id, stage.answerText)
    if (g.verdict !== 'correct') {
      throw new LogSkip(`self-check failed for ${stage.id}: ${stage.answerText}`)
    }
    const checkForms = stage.id === 'match' || stage.id === 'behavior' ? [] : [stage.answerText]
    if (checkForms.length > 0) {
      const visible = staticTexts(EG_RULES, stage.formatHint, stage.nudge)
      if (anyShows(visible, checkForms)) {
        throw new LogSkip(`stage ${stage.id} leaked answer ${stage.answerText}`)
      }
      if (anyShows([instance.instructions, answer.prompt], checkForms)) {
        throw new LogSkip(`prompt leaked answer ${stage.answerText}`)
      }
    }
  }
  const trapGrade = gradeExpLogGraphsStage(answer, answer.trapStage, answer.trapAnswer)
  if (trapGrade.verdict !== 'mistake' || trapGrade.mistake !== answer.trap) {
    throw new LogSkip(`promised trap ${answer.trap} on ${answer.trapStage} graded ${trapGrade.verdict}`)
  }
  const ex = catalogExample(answer.trap)
  const trapStageObj = answer.stages.find((s) => s.id === answer.trapStage)
  if (trapStageObj && trapStageObj.id !== 'match' && trapStageObj.id !== 'behavior') {
    if (anyShows([ex], [trapStageObj.answerText])) {
      throw new LogSkip(`catalog example for ${answer.trap} leaked ${trapStageObj.answerText}`)
    }
  }
}

function buildFeatures(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  return searchSeed(seed, 0x6567_6601, 64, (rng) => {
    const family: 'exp' | 'log' = rng.pick(['exp', 'log'] as const)
    const a = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4] as const)

    if (family === 'exp') {
      const base = rng.pick(EXP_BASES)
      const h = base.text === 'e' ? 0 : rng.pick([-2, -1, 1, 2] as const)
      const k = rng.pick([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6] as const)
      const f = expFormula(a, base.text, h, k)
      const equation = `f(x) = ${f}`

      // Exact y-intercept at x = 0: a * b^(-h) + k
      const pow = base.text === 'e' ? { n: 1, d: 1 } : exactPowerFrac(base.num, base.den, -h)
      const yNum = a * pow.n + k * pow.d
      const yDen = pow.d
      const yIntText = frac(yNum, yDen)
      const yIntVal = yNum / yDen
      const interceptText = `(0, ${yIntText})`
      const unshiftedIntText = h === 0 ? `(0, ${a})` : `(0, ${a + k})`
      if (unshiftedIntText === interceptText) throw new LogSkip('intercept trap collides with answer')

      const domainText = '(-inf, inf)'
      const rangeText = a > 0 ? `(${k}, inf)` : `(-inf, ${k})`
      const flippedRangeText = a > 0 ? `(-inf, ${k})` : `(${k}, inf)`
      const asymptoteText = `y = ${k}`
      const isIncreasing = (base.value > 1 && a > 0) || (base.value < 1 && a < 0)
      const behaviorText = isIncreasing ? 'increasing' : 'decreasing'
      const flippedBehaviorText = isIncreasing ? 'decreasing' : 'increasing'

      const stages: ExpLogGraphsAnswer['stages'] = [
        {
          id: 'domain',
          label: 'Domain',
          placeholder: 'e.g. (-inf, inf)',
          formatHint: 'Interval notation, such as (-inf, inf) or (a, inf).',
          answerText: domainText,
          nudge: 'Ask which real values of x can be substituted into the exponent x - h.',
          ruleCard: EG_RULE_IDS.domain,
          reveal: [`Every real number x can be used in the exponent, so the domain is ${domainText}.`],
          traps: [
            {
              id: 'exp_domain_closed',
              text: `[${k}, inf)`,
              witness: 'Every real input x is valid in an exponential function; the horizontal asymptote bounds the range, not the domain.',
            },
            {
              id: 'exp_range_reflection',
              text: rangeText,
              witness: `${rangeText} is the range of f(x). The domain of an exponential function is all real numbers (-inf, inf).`,
            },
          ],
        },
        {
          id: 'range',
          label: 'Range',
          placeholder: 'e.g. (k, inf)',
          formatHint: 'Interval notation with an open parenthesis at the asymptote boundary.',
          answerText: rangeText,
          nudge: 'Since the power is always positive, check the sign of the leading coefficient a and the vertical shift k.',
          ruleCard: EG_RULE_IDS.range,
          reveal: [
            `Because ${base.text}^(${xShiftText(h)}) > 0 and a = ${a} is ${a > 0 ? 'positive' : 'negative'}, the outputs stay strictly ${a > 0 ? 'above' : 'below'} y = ${k}: range ${rangeText}.`,
          ],
          traps: [
            {
              id: 'exp_range_reflection',
              text: flippedRangeText,
              witness: a < 0
                ? `Because the leading factor a = ${a} is negative, the curve lies below y = ${k}, so the range is ${rangeText}.`
                : `Because the leading factor a = ${a} is positive, the curve lies above y = ${k}, so the range is ${rangeText}.`,
            },
            {
              id: 'exp_asymptote_unshifted',
              text: a > 0 ? '(0, inf)' : '(-inf, 0)',
              witness: `The vertical shift moves the horizontal boundary from 0 to ${k}.`,
            },
            {
              id: 'exp_domain_closed',
              text: a > 0 ? `[${k}, inf)` : `(-inf, ${k}]`,
              witness: `The graph approaches y = ${k} without ever reaching it, so use an open parenthesis at ${k}.`,
            },
          ],
        },
        {
          id: 'asymptote',
          label: 'Horizontal asymptote',
          placeholder: 'e.g. y = c',
          formatHint: 'Write the equation of the horizontal line, starting with y =.',
          answerText: asymptoteText,
          nudge: 'As the power term approaches 0 on one end of the x-axis, what constant value does f(x) approach?',
          ruleCard: EG_RULE_IDS.asymptote,
          reveal: [`As ${base.text}^(${xShiftText(h)}) approaches 0, f(x) approaches ${k}, so the horizontal asymptote is ${asymptoteText}.`],
          traps: [
            {
              id: 'exp_asymptote_unshifted',
              text: 'y = 0',
              witness: `The unshifted exponential approaches y = 0, but the vertical shift moves the horizontal asymptote to ${asymptoteText}.`,
            },
            {
              id: 'exp_asymptote_axis',
              text: `x = ${k}`,
              witness: `An exponential function has a horizontal asymptote y = ${k}, not a vertical line x = ${k}.`,
            },
            {
              id: 'exp_asymptote_sign',
              text: `y = ${-k}`,
              witness: `The vertical shift is ${k}, so the horizontal asymptote is ${asymptoteText}, not y = ${-k}.`,
            },
          ],
        },
        {
          id: 'intercept',
          label: 'y-intercept',
          placeholder: 'e.g. (0, y)',
          formatHint: 'Write the exact point as an ordered pair (0, y).',
          answerText: interceptText,
          nudge: 'Substitute x = 0 into f(x), evaluate the power at x = 0, and add the vertical shift.',
          ruleCard: EG_RULE_IDS.intercept,
          reveal: [`At x = 0, f(0) = ${a} * (${base.text})^(${-h})${kSuffix(k)} = ${yIntText}, giving the y-intercept ${interceptText}.`],
          traps: [
            {
              id: 'exp_intercept_shift',
              text: unshiftedIntText,
              witness: h === 0
                ? `At x = 0, the power is 1, and adding the vertical shift ${k} gives ${interceptText}.`
                : `At x = 0, the exponent is 0 - (${h}) = ${-h}, not 0, so the y-intercept is ${interceptText}.`,
            },
          ],
        },
        {
          id: 'behavior',
          label: 'Behavior',
          placeholder: 'increasing or decreasing',
          formatHint: 'Choose one option or type your answer.',
          answerText: behaviorText,
          choices: [
            { id: 'increasing', label: 'Increasing' },
            { id: 'decreasing', label: 'Decreasing' },
          ],
          nudge: 'Check whether the base b is above or below 1, and whether the leading factor a reflects the curve across y = k.',
          ruleCard: EG_RULE_IDS.behavior,
          reveal: [
            `With base ${base.text} (${base.value > 1 ? 'b > 1' : '0 < b < 1'}) and leading factor a = ${a} (${a > 0 ? 'a > 0' : 'a < 0'}), the function is ${behaviorText} on (-inf, inf).`,
          ],
          traps: [
            {
              id: 'exp_monotonicity_flipped',
              text: flippedBehaviorText,
              witness: `Consider both the base b = ${base.text} and the sign of the coefficient a = ${a}: together they make f(x) ${behaviorText}.`,
            },
          ],
        },
      ]

      const trapChoices: readonly { stage: ExpLogGraphsStageId; id: ErrorPatternId; ans: string }[] = [
        { stage: 'asymptote', id: 'exp_asymptote_unshifted', ans: 'y = 0' },
        { stage: 'asymptote', id: 'exp_asymptote_axis', ans: `x = ${k}` },
        { stage: 'range', id: 'exp_range_reflection', ans: flippedRangeText },
        { stage: 'intercept', id: 'exp_intercept_shift', ans: unshiftedIntText },
        { stage: 'behavior', id: 'exp_monotonicity_flipped', ans: flippedBehaviorText },
      ]
      const chosenTrap = rng.pick(trapChoices)
      const ruleCard = (EG_RULE_FOR[chosenTrap.id] ?? EG_RULE_IDS.asymptote) as RuleCardId
      const allRules: RuleCardId[] = [
        ruleCard,
        ...[EG_RULE_IDS.domain, EG_RULE_IDS.range, EG_RULE_IDS.asymptote, EG_RULE_IDS.intercept, EG_RULE_IDS.behavior].filter(
          (id) => id !== ruleCard,
        ),
      ]

      const answer: ExpLogGraphsAnswer = {
        type: 'expLogGraphs',
        question: 'features',
        family: 'exp',
        fnName: 'f',
        f,
        equation,
        a,
        baseText: base.text,
        baseValue: base.value,
        h,
        k,
        prompt: 'Find the domain, range, horizontal asymptote, y-intercept, and behavior of f(x).',
        stages,
        expectedDisplay: `domain ${domainText}; range ${rangeText}; asymptote ${asymptoteText}; y-intercept ${interceptText}; ${behaviorText}`,
        nudge: stages[0]!.nudge,
        ruleCard,
        ruleCards: allRules,
        reveal: stages.flatMap((s) => s.reveal),
        trap: chosenTrap.id,
        trapStage: chosenTrap.stage,
        trapAnswer: chosenTrap.ans,
        graph: makeGraphSpec('exp', f, h, k, { x: 0, y: yIntVal }),
      }

      const instance: ProblemInstance = {
        id: problemId(EG_MODULE_ID, 'eg.features', 1, seed),
        moduleId: EG_MODULE_ID,
        templateId: 'eg.features',
        skill: 'eg.features',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expLogGraphs',
        title: 'Features of exponential and logarithmic graphs',
        instructions: 'Give the domain, range, asymptote, intercept, and behavior one part at a time.',
        statementText: equation,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: {
          family,
          a,
          base: base.text,
          h,
          k,
          trap: chosenTrap.id,
          trapStage: chosenTrap.stage,
        },
      }
      assertSelf(instance, answer)
      return instance
    }

    // family === 'log'
    const base = rng.pick(LOG_FEATURE_BASES)
    const h = rng.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5] as const)
    const m = rng.pick([-2, -1, 1, 2] as const)
    if (base.num === 10 && Math.abs(m) > 1) throw new LogSkip('keep base-10 intercept compact')
    const k = -m * a
    const f = logFormula(a, base.text, h, k)
    const equation = `g(x) = ${f}`

    // Exact x-intercept where g(x) = 0 -> log_b(x - h) = -k/a = m -> x = h + b^m
    const pow = exactPowerFrac(base.num, base.den, m)
    const xNum = h * pow.d + pow.n
    const xDen = pow.d
    const xIntText = frac(xNum, xDen)
    const xIntVal = xNum / xDen
    const interceptText = `(${xIntText}, 0)`
    const unshiftedIntText = `(${h + 1}, 0)`
    if (unshiftedIntText === interceptText) throw new LogSkip('log intercept trap collides')

    const domainText = `(${h}, inf)`
    const closedDomainText = `[${h}, inf)`
    const rangeText = '(-inf, inf)'
    const asymptoteText = `x = ${h}`
    const signFlipAsymptote = `x = ${-h}`
    const isIncreasing = a > 0
    const behaviorText = isIncreasing ? 'increasing' : 'decreasing'
    const flippedBehaviorText = isIncreasing ? 'decreasing' : 'increasing'

    const stages: ExpLogGraphsAnswer['stages'] = [
      {
        id: 'domain',
        label: 'Domain',
        placeholder: 'e.g. (h, inf)',
        formatHint: 'Interval notation with an open parenthesis where the input to the log is 0.',
        answerText: domainText,
        nudge: 'Set the expression inside the logarithm strictly greater than 0 and solve for x.',
        ruleCard: EG_RULE_IDS.domain,
        reveal: [`The logarithm requires ${xShiftText(h)} > 0, so x > ${h} and the domain is ${domainText}.`],
        traps: [
          {
            id: 'exp_domain_closed',
            text: closedDomainText,
            witness: `At x = ${h} the input to the logarithm is 0, where the logarithm is undefined. Use an open parenthesis: ${domainText}.`,
          },
          {
            id: 'exp_asymptote_sign',
            text: `(${-h}, inf)`,
            witness: `Solving ${xShiftText(h)} > 0 gives x > ${h}, not x > ${-h}.`,
          },
        ],
      },
      {
        id: 'range',
        label: 'Range',
        placeholder: 'e.g. (-inf, inf)',
        formatHint: 'Interval notation for all possible output values y.',
        answerText: rangeText,
        nudge: 'Consider what output values a logarithm produces as its input ranges over (0, inf).',
        ruleCard: EG_RULE_IDS.range,
        reveal: [`Every logarithmic function takes all real numbers as outputs, so the range is ${rangeText}.`],
        traps: [
          {
            id: 'exp_range_reflection',
            text: domainText,
            witness: `${domainText} is the domain of g(x). Its outputs span all real numbers ${rangeText}.`,
          },
          {
            id: 'exp_asymptote_unshifted',
            text: '(0, inf)',
            witness: `A logarithm produces negative, zero, and positive outputs, so its range is ${rangeText}.`,
          },
        ],
      },
      {
        id: 'asymptote',
        label: 'Vertical asymptote',
        placeholder: 'e.g. x = c',
        formatHint: 'Write the equation of the vertical line, starting with x =.',
        answerText: asymptoteText,
        nudge: 'Set the expression inside the logarithm equal to 0 to find the vertical boundary line.',
        ruleCard: EG_RULE_IDS.asymptote,
        reveal: [`Setting ${xShiftText(h)} = 0 gives the vertical asymptote ${asymptoteText}.`],
        traps: [
          {
            id: 'exp_asymptote_sign',
            text: signFlipAsymptote,
            witness: `Set ${xShiftText(h)} = 0 and solve for x: the vertical asymptote is ${asymptoteText}, not ${signFlipAsymptote}.`,
          },
          {
            id: 'exp_asymptote_unshifted',
            text: 'x = 0',
            witness: `The horizontal shift moves the vertical asymptote from x = 0 to ${asymptoteText}.`,
          },
          {
            id: 'exp_asymptote_axis',
            text: `y = ${h}`,
            witness: `A logarithmic function has a vertical asymptote x = ${h}, not a horizontal line y = ${h}.`,
          },
        ],
      },
      {
        id: 'intercept',
        label: 'x-intercept',
        placeholder: 'e.g. (x, 0)',
        formatHint: 'Write the exact point as an ordered pair (x, 0).',
        answerText: interceptText,
        nudge: 'Set g(x) = 0, isolate the logarithm, and rewrite in exponential form to solve for x.',
        ruleCard: EG_RULE_IDS.intercept,
        reveal: [
          `Setting ${f} = 0 gives log_${base.text}(${xShiftText(h)}) = ${m}, so ${xShiftText(h)} = ${base.text}^(${m}) = ${frac(pow.n, pow.d)} and x = ${xIntText}: ${interceptText}.`,
        ],
        traps: [
          {
            id: 'exp_intercept_shift',
            text: unshiftedIntText,
            witness: `Because of the vertical shift ${k}, the logarithm equals ${m} at the x-intercept rather than 0, giving ${interceptText}.`,
          },
        ],
      },
      {
        id: 'behavior',
        label: 'Behavior',
        placeholder: 'increasing or decreasing',
        formatHint: 'Choose one option or type your answer.',
        answerText: behaviorText,
        choices: [
          { id: 'increasing', label: 'Increasing' },
          { id: 'decreasing', label: 'Decreasing' },
        ],
        nudge: 'Check whether the base b is above 1 and whether the leading factor a reflects the curve vertically.',
        ruleCard: EG_RULE_IDS.behavior,
        reveal: [
          `With base ${base.text} > 1 and leading coefficient a = ${a} (${a > 0 ? 'a > 0' : 'a < 0'}), g(x) is ${behaviorText} on ${domainText}.`,
        ],
        traps: [
          {
            id: 'exp_monotonicity_flipped',
            text: flippedBehaviorText,
            witness: `With base ${base.text} > 1 and leading factor a = ${a}, the function is ${behaviorText} on its domain.`,
          },
        ],
      },
    ]

    const trapChoices: readonly { stage: ExpLogGraphsStageId; id: ErrorPatternId; ans: string }[] = [
      { stage: 'domain', id: 'exp_domain_closed', ans: closedDomainText },
      { stage: 'asymptote', id: 'exp_asymptote_sign', ans: signFlipAsymptote },
      { stage: 'asymptote', id: 'exp_asymptote_axis', ans: `y = ${h}` },
      { stage: 'intercept', id: 'exp_intercept_shift', ans: unshiftedIntText },
      { stage: 'behavior', id: 'exp_monotonicity_flipped', ans: flippedBehaviorText },
    ]
    const chosenTrap = rng.pick(trapChoices)
    const ruleCard = (EG_RULE_FOR[chosenTrap.id] ?? EG_RULE_IDS.domain) as RuleCardId
    const allRules: RuleCardId[] = [
      ruleCard,
      ...[EG_RULE_IDS.domain, EG_RULE_IDS.range, EG_RULE_IDS.asymptote, EG_RULE_IDS.intercept, EG_RULE_IDS.behavior].filter(
        (id) => id !== ruleCard,
      ),
    ]

    const answer: ExpLogGraphsAnswer = {
      type: 'expLogGraphs',
      question: 'features',
      family: 'log',
      fnName: 'g',
      f,
      equation,
      a,
      baseText: base.text,
      baseValue: base.value,
      h,
      k,
      prompt: 'Find the domain, range, vertical asymptote, x-intercept, and behavior of g(x).',
      stages,
      expectedDisplay: `domain ${domainText}; range ${rangeText}; asymptote ${asymptoteText}; x-intercept ${interceptText}; ${behaviorText}`,
      nudge: stages[0]!.nudge,
      ruleCard,
      ruleCards: allRules,
      reveal: stages.flatMap((s) => s.reveal),
      trap: chosenTrap.id,
      trapStage: chosenTrap.stage,
      trapAnswer: chosenTrap.ans,
      graph: makeGraphSpec('log', f, h, k, { x: xIntVal, y: 0 }),
    }

    const instance: ProblemInstance = {
      id: problemId(EG_MODULE_ID, 'eg.features', 1, seed),
      moduleId: EG_MODULE_ID,
      templateId: 'eg.features',
      skill: 'eg.features',
      genVersion: 1,
      seed,
      knobs,
      kind: 'expLogGraphs',
      title: 'Features of exponential and logarithmic graphs',
      instructions: 'Give the domain, range, asymptote, intercept, and behavior one part at a time.',
      statementText: equation,
      vars: ['x'],
      start: null,
      canonical: [],
      answer,
      graph: NO_GRAPH,
      calc: NO_CALC,
      params: {
        family,
        a,
        base: base.text,
        h,
        k,
        trap: chosenTrap.id,
        trapStage: chosenTrap.stage,
      },
    }
    assertSelf(instance, answer)
    return instance
  })
}

function flipExpBase(baseText: string): string {
  if (baseText === '2') return '1/2'
  if (baseText === '3') return '1/3'
  if (baseText === '4') return '1/4'
  if (baseText === '5') return '1/5'
  if (baseText === '1/2') return '2'
  if (baseText === '1/3') return '3'
  if (baseText === '1/4') return '4'
  return '1/2'
}

function buildMatch(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  return searchSeed(seed, 0x6567_6d02, 64, (rng) => {
    const family: 'exp' | 'log' = rng.pick(['exp', 'log'] as const)
    const matchMode: 'graph' | 'equation' = rng.pick(['graph', 'equation'] as const)
    const fnName: 'f' | 'g' = family === 'exp' ? 'f' : 'g'
    const h = rng.pick([-3, -2, -1, 1, 2, 3] as const)
    const k = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4] as const)

    let a: number
    let base: BaseChoice
    let fTarget: string
    let fSign: string
    let fBase: string
    let fShift: string
    let shiftH: number

    if (family === 'exp') {
      a = rng.pick([-3, -2, -1, 1, 2, 3] as const)
      base = rng.pick(EXP_BASES)
      fTarget = expFormula(a, base.text, h, k)
      fSign = expFormula(-a, base.text, h, k)
      fBase = expFormula(a, flipExpBase(base.text), h, k)
      shiftH = -h
      fShift = expFormula(a, base.text, shiftH, k)
    } else {
      a = rng.pick([-3, -2, 2, 3] as const)
      base = rng.pick(LOG_FEATURE_BASES)
      fTarget = logFormula(a, base.text, h, k)
      fSign = logFormula(-a, base.text, h, k)
      // Base 1/b with unit magnitude vs stretched reflection keeps all 4 curves visually and numerically distinct.
      fBase = logFormula(a > 0 ? -1 : 1, base.text, h, k)
      shiftH = -h
      fShift = logFormula(a, base.text, shiftH, k)
    }

    const rawSpecs: {
      f: string
      hVal: number
      kVal: number
      mistake?: ErrorPatternId
      witness?: string
    }[] = [
      { f: fTarget, hVal: h, kVal: k },
      {
        f: fSign,
        hVal: h,
        kVal: k,
        mistake: 'exp_graph_sign',
        witness: `That candidate reflects the curve across y = ${k} by using leading coefficient ${-a} instead of ${a}.`,
      },
      {
        f: fBase,
        hVal: h,
        kVal: k,
        mistake: 'exp_graph_base',
        witness: `That candidate swaps growth and decay for the base instead of matching base ${base.text} with coefficient ${a}.`,
      },
      {
        f: fShift,
        hVal: shiftH,
        kVal: k,
        mistake: 'exp_graph_shift',
        witness: `That candidate shifts horizontally to h = ${shiftH} instead of h = ${h}.`,
      },
    ]

    const shuffled = rng.shuffle(rawSpecs)
    const ids = ['A', 'B', 'C', 'D'] as const
    const candidates: ExpLogMatchCandidate[] = shuffled.map((item, idx) => {
      const id = ids[idx]!
      const eq = `${fnName}(x) = ${item.f}`
      return {
        id,
        f: item.f,
        equation: eq,
        graph: makeGraphSpec(family, item.f, item.hVal, item.kVal),
        ...(item.mistake ? { mistake: item.mistake, witness: item.witness } : {}),
      }
    })

    // Confirm all 4 candidate formulas are pairwise distinct.
    const evalFns = candidates.map((c) => {
      const p = parseExpression(c.f, ['x'])
      if (!p.ok) throw new LogSkip('candidate parse failed')
      const fn = compileExpr(p.node)
      return (x: number) => evaluateExpr(fn, { x })
    })
    const probeXs = [Math.max(h, -h) + 0.7, Math.max(h, -h) + 1.9, Math.max(h, -h) + 3.1]
    for (let i = 0; i < evalFns.length; i++) {
      for (let j = i + 1; j < evalFns.length; j++) {
        const same = probeXs.every((x) => Math.abs(evalFns[i]!(x) - evalFns[j]!(x)) < 1e-6)
        if (same) throw new LogSkip('duplicate candidate curve')
      }
    }

    const rightCandidate = candidates.find((c) => !c.mistake)!
    const distractors = candidates.filter((c) => c.mistake)
    const chosenDistractor = rng.pick(distractors)
    const chosenTrap = chosenDistractor.mistake!

    const equation = `${fnName}(x) = ${fTarget}`
    const stage: ExpLogGraphsAnswer['stages'][number] = {
      id: 'match',
      label: matchMode === 'graph' ? 'Matching graph' : 'Matching equation',
      placeholder: 'A, B, C, or D',
      formatHint: 'Select one of the four options.',
      answerText: rightCandidate.id,
      choices: candidates.map((c) => ({
        id: c.id,
        label: matchMode === 'graph' ? `Graph ${c.id}` : `${c.id}: ${c.equation}`,
      })),
      nudge: 'Check the asymptote line first, then which side of the asymptote the curve lies on, and finally one point on the curve.',
      ruleCard: EG_RULE_IDS.match,
      reveal: [
        family === 'exp'
          ? `${equation} has horizontal asymptote y = ${k}, lies ${a > 0 ? 'above' : 'below'} y = ${k}, and passes through (${h}, ${a + k}), which matches ${rightCandidate.id}.`
          : `${equation} has vertical asymptote x = ${h} and passes through (${h + 1}, ${k}), which matches ${rightCandidate.id}.`,
      ],
      traps: distractors.map((d) => ({
        id: d.mistake!,
        text: d.id,
        witness: d.witness!,
      })),
    }

    const answer: ExpLogGraphsAnswer = {
      type: 'expLogGraphs',
      question: 'match',
      family,
      fnName,
      f: fTarget,
      equation,
      a,
      baseText: base.text,
      baseValue: base.value,
      h,
      k,
      matchMode,
      candidates,
      prompt:
        matchMode === 'graph'
          ? `Choose the graph (A, B, C, or D) that matches ${equation}.`
          : 'Choose the equation (A, B, C, or D) that matches the shown graph.',
      stages: [stage],
      expectedDisplay: rightCandidate.id,
      nudge: stage.nudge,
      ruleCard: EG_RULE_IDS.match,
      ruleCards: [EG_RULE_IDS.match, EG_RULE_IDS.asymptote, EG_RULE_IDS.behavior, EG_RULE_IDS.range],
      reveal: stage.reveal,
      trap: chosenTrap,
      trapStage: 'match',
      trapAnswer: chosenDistractor.id,
      graph: rightCandidate.graph,
    }

    const instance: ProblemInstance = {
      id: problemId(EG_MODULE_ID, 'eg.match', 1, seed),
      moduleId: EG_MODULE_ID,
      templateId: 'eg.match',
      skill: 'eg.match',
      genVersion: 1,
      seed,
      knobs,
      kind: 'expLogGraphs',
      title: 'Match exponential and logarithmic graphs',
      instructions:
        matchMode === 'graph'
          ? 'Pick the graph that matches the given function.'
          : 'Pick the equation that matches the given graph.',
      statementText: equation,
      vars: ['x'],
      start: null,
      canonical: [],
      answer,
      graph: NO_GRAPH,
      calc: NO_CALC,
      params: {
        family,
        matchMode,
        a,
        base: base.text,
        h,
        k,
        trap: chosenTrap,
        trapStage: 'match',
      },
    }
    assertSelf(instance, answer)
    return instance
  })
}

function buildInverse(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  return searchSeed(seed, 0x6567_6903, 64, (rng) => {
    const family: 'exp' | 'log' = rng.pick(['exp', 'log'] as const)
    const fnName: 'f' | 'g' = family === 'exp' ? 'f' : 'g'
    const a = rng.pick([1, 1, 1, -1, 2, -2, 3] as const)
    const base = rng.pick(INV_BASES)
    const h = rng.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5] as const)
    const k = rng.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5] as const)
    if (Math.abs(h) === Math.abs(k)) throw new LogSkip('keep |h| != |k| so shift traps stay distinct')

    const f = family === 'exp' ? expFormula(a, base.text, h, k) : logFormula(a, base.text, h, k)
    const equation = `y = ${f}`
    const innerX = xShiftText(k)
    const scaledX = a === 1 ? innerX : a === -1 ? `-(${innerX})` : `(${innerX})/${a}`
    const wrongInnerX = xShiftText(h)
    const wrongScaledX = a === 1 ? wrongInnerX : a === -1 ? `-(${wrongInnerX})` : `(${wrongInnerX})/${a}`
    const signFlipInnerX = xShiftText(-k)
    const signFlipScaledX = a === 1 ? signFlipInnerX : a === -1 ? `-(${signFlipInnerX})` : `(${signFlipInnerX})/${a}`

    let inverseExpr: string
    let shiftTrap1: string
    let shiftTrap2: string
    let swapTrap1: string
    let swapTrap2: string

    if (family === 'exp') {
      const logName = base.text === 'e' ? 'ln' : base.text === '10' ? 'log' : `log_${base.text}`
      inverseExpr = `${logName}(${scaledX})${kSuffix(h)}`
      shiftTrap1 = `${logName}(${wrongScaledX})${kSuffix(k)}`
      shiftTrap2 = `${logName}(${signFlipScaledX})${kSuffix(-h)}`
      swapTrap1 = `(${scaledX})^${base.text}${kSuffix(h)}`
      swapTrap2 = `log_(${scaledX})(${base.text})${kSuffix(h)}`
    } else {
      const expArg = a === 1 ? `(${innerX})` : a === -1 ? `(-(${innerX}))` : `((${innerX})/${a})`
      const wrongExpArg = a === 1 ? `(${wrongInnerX})` : a === -1 ? `(-(${wrongInnerX}))` : `((${wrongInnerX})/${a})`
      const signFlipExpArg =
        a === 1 ? `(${signFlipInnerX})` : a === -1 ? `(-(${signFlipInnerX}))` : `((${signFlipInnerX})/${a})`
      inverseExpr = `${base.text}^${expArg}${kSuffix(h)}`
      shiftTrap1 = `${base.text}^${wrongExpArg}${kSuffix(k)}`
      shiftTrap2 = `${base.text}^${signFlipExpArg}${kSuffix(-h)}`
      swapTrap1 = `(${scaledX})^${base.text}${kSuffix(h)}`
      const logName = base.text === 'e' ? 'ln' : base.text === '10' ? 'log' : `log_${base.text}`
      swapTrap2 = `${logName}(${scaledX})${kSuffix(h)}`
    }
    const recipTrap = `1 / (${f})`
    const inverseEquation = `y = ${inverseExpr}`

    const traps: ExpLogGraphsAnswer['stages'][number]['traps'] = [
      {
        id: 'exp_inverse_shift',
        text: shiftTrap1,
        witness: `After swapping x and y in ${equation}, undo the outside shift ${k > 0 ? `+ ${k}` : `- ${-k}`} first (so ${innerX} is inside) and undo ${xShiftText(h)} last (so ${kSuffix(h).trim()} is outside).`,
      },
      {
        id: 'exp_inverse_shift',
        text: shiftTrap2,
        witness: `Check the signs when undoing the shifts: subtracting ${k} gives ${innerX}, and solving for y gives ${kSuffix(h).trim()} outside.`,
      },
      {
        id: 'exp_inverse_swapped',
        text: swapTrap1,
        witness:
          family === 'exp'
            ? `The inverse of a base-${base.text} exponential is a base-${base.text} logarithm, not a power with ${base.text} in the exponent.`
            : `The inverse of a base-${base.text} logarithm is a base-${base.text} exponential ${base.text}^(...), with ${base.text} as the base.`,
      },
      {
        id: 'exp_inverse_swapped',
        text: swapTrap2,
        witness: `Keep the base ${base.text} as the base when converting between exponential and logarithmic form.`,
      },
      {
        id: 'exp_inverse_reciprocal',
        text: recipTrap,
        witness: `1 / (${f}) is the multiplicative reciprocal, not the inverse function. Swap x and y and solve for y.`,
      },
    ]

    const primaryTraps: readonly { id: ErrorPatternId; text: string }[] = [
      { id: 'exp_inverse_shift', text: shiftTrap1 },
      { id: 'exp_inverse_swapped', text: swapTrap1 },
      { id: 'exp_inverse_reciprocal', text: recipTrap },
    ]
    const chosenTrap = rng.pick(primaryTraps)

    const stage: ExpLogGraphsAnswer['stages'][number] = {
      id: 'inverse',
      label: 'Inverse function',
      placeholder: 'e.g. log_2(x - 3) + 1',
      formatHint: 'Write the formula in x, or y = ..., using log_b(...), ln(...), or b^(...).',
      answerText: inverseExpr,
      nudge: 'Swap x and y, isolate the exponential or logarithmic term first, convert to the inverse form with the same base, and solve for y.',
      ruleCard: EG_RULE_IDS.inverse,
      reveal: [
        `Start with ${equation} and swap x and y: x = ${f.replace(/x/g, 'y')}.`,
        `Isolate the ${family === 'exp' ? 'exponential' : 'logarithm'} and convert with base ${base.text} to get ${inverseEquation}.`,
      ],
      traps,
    }

    const answer: ExpLogGraphsAnswer = {
      type: 'expLogGraphs',
      question: 'inverse',
      family,
      fnName,
      f,
      equation,
      a,
      baseText: base.text,
      baseValue: base.value,
      h,
      k,
      inverseExpr,
      inverseEquation,
      prompt: `Find the inverse of ${equation}.`,
      stages: [stage],
      expectedDisplay: inverseEquation,
      nudge: stage.nudge,
      ruleCard: EG_RULE_IDS.inverse,
      ruleCards: [EG_RULE_IDS.inverse, EG_RULE_IDS.domain, EG_RULE_IDS.range, EG_RULE_IDS.asymptote],
      reveal: stage.reveal,
      trap: chosenTrap.id,
      trapStage: 'inverse',
      trapAnswer: chosenTrap.text,
      graph: makeGraphSpec(family, f, h, k, undefined, inverseExpr),
    }

    const instance: ProblemInstance = {
      id: problemId(EG_MODULE_ID, 'eg.inverse', 1, seed),
      moduleId: EG_MODULE_ID,
      templateId: 'eg.inverse',
      skill: 'eg.inverse',
      genVersion: 1,
      seed,
      knobs,
      kind: 'expLogGraphs',
      title: 'Inverse of an exponential or logarithmic function',
      instructions: 'Find the inverse function in terms of x.',
      statementText: equation,
      vars: ['x'],
      start: null,
      canonical: [],
      answer,
      graph: NO_GRAPH,
      calc: NO_CALC,
      params: {
        family,
        a,
        base: base.text,
        h,
        k,
        trap: chosenTrap.id,
        trapStage: 'inverse',
      },
    }
    assertSelf(instance, answer)
    return instance
  })
}

export const featuresTemplate: TemplateDef = {
  id: 'eg.features',
  title: 'Features of exponential and logarithmic graphs',
  description: 'Domain, range, asymptote, intercept, and increasing/decreasing behavior of exponential and logarithmic functions.',
  version: 1,
  knobs: [],
  generate: buildFeatures,
}

export const matchTemplate: TemplateDef = {
  id: 'eg.match',
  title: 'Match exponential and logarithmic graphs',
  description: 'Match an exponential or logarithmic function to its graph (or a graph to its equation) among four candidates.',
  version: 1,
  knobs: [],
  generate: buildMatch,
}

export const inverseTemplate: TemplateDef = {
  id: 'eg.inverse',
  title: 'Inverse of an exponential or logarithmic function',
  description: 'Find the inverse of a shifted exponential or logarithmic function, graded by function composition.',
  version: 1,
  knobs: [],
  generate: buildInverse,
}

export const EG_TEMPLATES: readonly TemplateDef[] = [featuresTemplate, matchTemplate, inverseTemplate]
