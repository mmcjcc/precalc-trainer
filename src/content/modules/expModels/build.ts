import { problemId } from '@/content/registry'
import type {
  DifficultyKnobs,
  ExpModelsAnswer,
  ExpModelsStageId,
  ProblemInstance,
  RuleCardId,
  TemplateDef,
} from '@/content/types'
import type { CalcPanels, ErrorPatternId, GraphSpec } from '@/shared/types'
import { LogSkip, anyShows, catalogExample, roundPlaces, searchSeed, staticTexts } from '../explog/text'
import { gradeExpModelsStage } from './grade'
import { EM_RULES, EM_RULE_FOR, EM_RULE_IDS } from './rules'

export const EM_MODULE_ID = 'expModels' as const

const NO_GRAPH: GraphSpec = { kind: 'none' }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

interface PeriodSpec {
  n: number
  word: string
  wrongN: number
  wrongDesc: string
}

const PERIODS: readonly PeriodSpec[] = [
  { n: 4, word: 'quarterly', wrongN: 3, wrongDesc: '3 instead of 4 quarters per year' },
  { n: 12, word: 'monthly', wrongN: 4, wrongDesc: '4 instead of 12 months per year' },
  { n: 2, word: 'semiannually', wrongN: 6, wrongDesc: '6 instead of 2 semiannual periods per year' },
  { n: 365, word: 'daily', wrongN: 12, wrongDesc: '12 instead of 365 days per year' },
]

function assertSelf(instance: ProblemInstance, answer: ExpModelsAnswer): void {
  for (const stage of answer.stages) {
    const g = gradeExpModelsStage(answer, stage.id, stage.answerText)
    if (g.verdict !== 'correct') {
      throw new LogSkip(`self-check failed on ${stage.id}: ${stage.answerText}`)
    }
    const gExact = gradeExpModelsStage(answer, stage.id, stage.exactExpr)
    if (gExact.verdict !== 'correct') {
      throw new LogSkip(`exact expression rejected on ${stage.id}: ${stage.exactExpr}`)
    }
    const forms = [stage.answerText]
    const visible = staticTexts(EM_RULES, stage.formatHint, stage.nudge)
    if (anyShows(visible, forms)) {
      throw new LogSkip(`stage ${stage.id} leaked ${stage.answerText}`)
    }
    if (anyShows([instance.instructions, answer.prompt], forms)) {
      throw new LogSkip(`prompt leaked ${stage.answerText}`)
    }
    // Confirm every trap on the stage is distinct from the right answer.
    for (const trap of stage.traps) {
      if (!Number.isFinite(trap.value)) throw new LogSkip(`non-finite trap ${trap.id}`)
      const tg = gradeExpModelsStage(answer, stage.id, trap.text)
      if (tg.verdict === 'correct') {
        throw new LogSkip(`trap ${trap.id} collided with right answer on ${stage.id}`)
      }
    }
  }
  const promised = gradeExpModelsStage(answer, answer.trapStage, answer.trapAnswer)
  if (promised.verdict !== 'mistake' || promised.mistake !== answer.trap) {
    throw new LogSkip(`promised trap ${answer.trap} on ${answer.trapStage} graded ${promised.verdict}`)
  }
  const trapStageObj = answer.stages.find((s) => s.id === answer.trapStage)
  if (trapStageObj) {
    if (anyShows([catalogExample(answer.trap)], [trapStageObj.answerText])) {
      throw new LogSkip(`catalog example leaked ${trapStageObj.answerText}`)
    }
  }
}

function buildInterest(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  return searchSeed(seed, 0x656d_6901, 96, (rng) => {
    const subkind = rng.pick(['discrete_balance', 'continuous_balance', 'time_to_reach', 'doubling_time'] as const)
    const P = rng.pick([1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000] as const)
    const rPct = rng.pick([3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8] as const)
    const r = Number((rPct / 100).toFixed(4))

    if (subkind === 'discrete_balance') {
      const period = rng.pick(PERIODS)
      const { n, word, wrongN, wrongDesc } = period
      const t = rng.pick([3, 4, 5, 6, 7, 8, 9, 10] as const)
      const exactExpr = `${P} * (1 + ${r}/${n})^(${n} * ${t})`
      const exactValue = P * Math.pow(1 + r / n, n * t)
      const answerText = roundPlaces(exactValue, 2)

      const valPercent = P * Math.pow(1 + rPct / n, Math.min(n * t, 48))
      const valWrongPeriod = P * Math.pow(1 + r / wrongN, wrongN * t)
      const valSimple = P * (1 + r * t)
      const valContSwapped = P * Math.exp(r * t)
      const valMissingN = P * Math.pow(1 + r / n, t)

      const traps: ExpModelsAnswer['stages'][number]['traps'] = [
        {
          id: 'exp_rate_percent',
          text: roundPlaces(valPercent, 2),
          value: valPercent,
          witness: `Convert ${rPct}% to the decimal r = ${r} before substituting into 1 + r/n.`,
        },
        {
          id: 'exp_wrong_period',
          text: roundPlaces(valWrongPeriod, 2),
          value: valWrongPeriod,
          witness: `Compounded ${word} means n = ${n} periods per year, not ${wrongDesc}.`,
        },
        {
          id: 'exp_simple_interest',
          text: roundPlaces(valSimple, 2),
          value: valSimple,
          witness: `${roundPlaces(valSimple, 2)} is simple interest P(1 + rt). Use the compound interest formula P(1 + r/n)^(nt).`,
        },
        {
          id: 'exp_continuous_swapped',
          text: roundPlaces(valContSwapped, 2),
          value: valContSwapped,
          witness: `${roundPlaces(valContSwapped, 2)} uses continuous compounding P*e^(rt), but this account compounds ${word} (n = ${n}).`,
        },
        {
          id: 'exp_exponent_missing_factor',
          text: roundPlaces(valMissingN, 2),
          value: valMissingN,
          witness: `The exponent must be n * t = ${n} * ${t} = ${n * t} total compounding periods, not just t = ${t}.`,
        },
      ]

      const chosenTrap = rng.pick(traps)
      const ruleCard = (EM_RULE_FOR[chosenTrap.id] ?? EM_RULE_IDS.compound) as RuleCardId
      const prompt = `$${P} is invested at ${rPct}% annual interest compounded ${word}. Find the balance after ${t} years. Round to the nearest cent (2 decimal places).`
      const formulaDisplay = 'A = P(1 + r/n)^(nt)'

      const stage: ExpModelsAnswer['stages'][number] = {
        id: 'answer',
        label: 'Balance after ' + t + ' years',
        placeholder: 'e.g. 2834.71',
        formatHint: 'Round to the nearest cent (2 decimal places), or enter the exact expression.',
        answerText,
        exactExpr,
        exactValue,
        places: 2,
        isMoney: true,
        nudge: 'Write the rate as a decimal r, divide r by the compounding frequency n, and raise (1 + r/n) to the total number of periods n * t.',
        ruleCard,
        reveal: [
          `Substitute P = ${P}, r = ${r}, n = ${n}, and t = ${t} into A = P(1 + r/n)^(nt):`,
          `A = ${P}(1 + ${r}/${n})^(${n * t}) ≈ $${answerText}.`,
        ],
        traps,
      }

      const answer: ExpModelsAnswer = {
        type: 'expModels',
        question: 'interest',
        subkind,
        prompt,
        formulaDisplay,
        stages: [stage],
        expectedDisplay: `$${answerText}`,
        nudge: stage.nudge,
        ruleCard,
        ruleCards: [ruleCard, EM_RULE_IDS.compound, EM_RULE_IDS.continuousInterest, EM_RULE_IDS.solveTime].filter(
          (v, i, a) => a.indexOf(v) === i,
        ),
        reveal: stage.reveal,
        trap: chosenTrap.id,
        trapStage: 'answer',
        trapAnswer: chosenTrap.text,
      }

      const instance: ProblemInstance = {
        id: problemId(EM_MODULE_ID, 'em.interest', 1, seed),
        moduleId: EM_MODULE_ID,
        templateId: 'em.interest',
        skill: 'em.interest',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expModels',
        title: 'Compound and continuous interest',
        instructions: 'Solve the compound interest problem. You may give the rounded decimal or an exact expression.',
        statementText: prompt,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: { subkind, P, rPct, n, t, trap: chosenTrap.id },
      }
      assertSelf(instance, answer)
      return instance
    }

    if (subkind === 'continuous_balance') {
      const t = rng.pick([3, 4, 5, 6, 7, 8, 9] as const)
      const exactExpr = `${P} * e^(${r} * ${t})`
      const exactValue = P * Math.exp(r * t)
      const answerText = roundPlaces(exactValue, 2)

      const valPercent = P * Math.exp(rPct * t)
      const valSimple = P * (1 + r * t)
      const valMonthly = P * Math.pow(1 + r / 12, 12 * t)
      const valMissingT = P * Math.exp(r)

      const traps: ExpModelsAnswer['stages'][number]['traps'] = [
        {
          id: 'exp_rate_percent',
          text: roundPlaces(valPercent, 2),
          value: valPercent,
          witness: `Convert ${rPct}% to the decimal r = ${r} before multiplying by t = ${t} in the exponent.`,
        },
        {
          id: 'exp_simple_interest',
          text: roundPlaces(valSimple, 2),
          value: valSimple,
          witness: `${roundPlaces(valSimple, 2)} is simple interest P(1 + rt). Continuous compounding uses A = P * e^(rt).`,
        },
        {
          id: 'exp_continuous_swapped',
          text: roundPlaces(valMonthly, 2),
          value: valMonthly,
          witness: `${roundPlaces(valMonthly, 2)} uses periodic monthly compounding instead of continuous compounding A = P * e^(rt).`,
        },
        {
          id: 'exp_exponent_missing_factor',
          text: roundPlaces(valMissingT, 2),
          value: valMissingT,
          witness: `Multiply the rate r = ${r} by the time t = ${t} in the exponent of e^(rt).`,
        },
      ]

      const chosenTrap = rng.pick(traps)
      const ruleCard = (EM_RULE_FOR[chosenTrap.id] ?? EM_RULE_IDS.continuousInterest) as RuleCardId
      const prompt = `$${P} is invested at ${rPct}% annual interest compounded continuously. Find the balance after ${t} years. Round to the nearest cent (2 decimal places).`
      const formulaDisplay = 'A = P * e^(rt)'

      const stage: ExpModelsAnswer['stages'][number] = {
        id: 'answer',
        label: 'Balance after ' + t + ' years',
        placeholder: 'e.g. 2834.71',
        formatHint: 'Round to the nearest cent (2 decimal places), or enter the exact expression.',
        answerText,
        exactExpr,
        exactValue,
        places: 2,
        isMoney: true,
        nudge: 'Convert the percentage rate to a decimal r and evaluate P * e^(r * t).',
        ruleCard,
        reveal: [
          `Substitute P = ${P}, r = ${r}, and t = ${t} into A = P * e^(rt):`,
          `A = ${P} * e^(${r} * ${t}) ≈ $${answerText}.`,
        ],
        traps,
      }

      const answer: ExpModelsAnswer = {
        type: 'expModels',
        question: 'interest',
        subkind,
        prompt,
        formulaDisplay,
        stages: [stage],
        expectedDisplay: `$${answerText}`,
        nudge: stage.nudge,
        ruleCard,
        ruleCards: [ruleCard, EM_RULE_IDS.continuousInterest, EM_RULE_IDS.compound, EM_RULE_IDS.solveTime].filter(
          (v, i, a) => a.indexOf(v) === i,
        ),
        reveal: stage.reveal,
        trap: chosenTrap.id,
        trapStage: 'answer',
        trapAnswer: chosenTrap.text,
      }

      const instance: ProblemInstance = {
        id: problemId(EM_MODULE_ID, 'em.interest', 1, seed),
        moduleId: EM_MODULE_ID,
        templateId: 'em.interest',
        skill: 'em.interest',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expModels',
        title: 'Compound and continuous interest',
        instructions: 'Solve the compound interest problem. You may give the rounded decimal or an exact expression.',
        statementText: prompt,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: { subkind, P, rPct, t, trap: chosenTrap.id },
      }
      assertSelf(instance, answer)
      return instance
    }

    if (subkind === 'time_to_reach') {
      const period = rng.pick(PERIODS.slice(0, 3))
      const { n, word, wrongN, wrongDesc } = period
      const mult = rng.pick([1.4, 1.5, 1.6, 1.8, 2.2, 2.5] as const)
      const A = Math.round(P * mult)
      const exactExpr = `ln(${A}/${P}) / (${n} * ln(1 + ${r}/${n}))`
      const exactValue = Math.log(A / P) / (n * Math.log(1 + r / n))
      const answerText = roundPlaces(exactValue, 2)

      const valMissingN = Math.log(A / P) / Math.log(1 + r / n)
      const valContSwapped = Math.log(A / P) / r
      const valSimple = (A / P - 1) / r
      const valWrongPeriod = Math.log(A / P) / (wrongN * Math.log(1 + r / wrongN))
      const valPercent = Math.log(A / P) / (n * Math.log(1 + rPct / n))

      const traps: ExpModelsAnswer['stages'][number]['traps'] = [
        {
          id: 'exp_exponent_missing_factor',
          text: roundPlaces(valMissingN, 2),
          value: valMissingN,
          witness: `Dividing ln(${A}/${P}) by ln(1 + ${r}/${n}) gives n * t = ${roundPlaces(valMissingN, 2)} periods. Divide by n = ${n} to get t in years.`,
        },
        {
          id: 'exp_continuous_swapped',
          text: roundPlaces(valContSwapped, 2),
          value: valContSwapped,
          witness: `ln(${A}/${P}) / ${r} is for continuous compounding, not ${word} compounding (n = ${n}).`,
        },
        {
          id: 'exp_simple_interest',
          text: roundPlaces(valSimple, 2),
          value: valSimple,
          witness: `Use logarithms on A = P(1 + r/n)^(nt) rather than the simple interest formula.`,
        },
        {
          id: 'exp_wrong_period',
          text: roundPlaces(valWrongPeriod, 2),
          value: valWrongPeriod,
          witness: `Compounded ${word} means n = ${n} periods per year, not ${wrongDesc}.`,
        },
        {
          id: 'exp_rate_percent',
          text: roundPlaces(valPercent, 2),
          value: valPercent,
          witness: `Convert ${rPct}% to the decimal r = ${r} before substituting.`,
        },
      ]

      const chosenTrap = rng.pick(traps)
      const ruleCard = (EM_RULE_FOR[chosenTrap.id] ?? EM_RULE_IDS.solveTime) as RuleCardId
      const prompt = `$${P} is invested at ${rPct}% annual interest compounded ${word}. How many years will it take for the balance to reach $${A}? Round to 2 decimal places.`
      const formulaDisplay = 'A = P(1 + r/n)^(nt)'

      const stage: ExpModelsAnswer['stages'][number] = {
        id: 'answer',
        label: 'Time t (years)',
        placeholder: 'e.g. 8.42',
        formatHint: 'Round to 2 decimal places, or enter the exact logarithmic expression.',
        answerText,
        exactExpr,
        exactValue,
        places: 2,
        unit: 'years',
        nudge: 'Divide A by P first, take ln of both sides, and divide by n * ln(1 + r/n).',
        ruleCard,
        reveal: [
          `Divide by ${P}: (1 + ${r}/${n})^(${n}t) = ${A}/${P}.`,
          `Take ln and solve for t: t = ln(${A}/${P}) / (${n} * ln(1 + ${r}/${n})) ≈ ${answerText} years.`,
        ],
        traps,
      }

      const answer: ExpModelsAnswer = {
        type: 'expModels',
        question: 'interest',
        subkind,
        prompt,
        formulaDisplay,
        stages: [stage],
        expectedDisplay: `${answerText} years`,
        nudge: stage.nudge,
        ruleCard,
        ruleCards: [ruleCard, EM_RULE_IDS.solveTime, EM_RULE_IDS.compound, EM_RULE_IDS.continuousInterest].filter(
          (v, i, a) => a.indexOf(v) === i,
        ),
        reveal: stage.reveal,
        trap: chosenTrap.id,
        trapStage: 'answer',
        trapAnswer: chosenTrap.text,
      }

      const instance: ProblemInstance = {
        id: problemId(EM_MODULE_ID, 'em.interest', 1, seed),
        moduleId: EM_MODULE_ID,
        templateId: 'em.interest',
        skill: 'em.interest',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expModels',
        title: 'Compound and continuous interest',
        instructions: 'Find the time in years. You may give the rounded decimal or an exact logarithmic expression.',
        statementText: prompt,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: { subkind, P, A, rPct, n, trap: chosenTrap.id },
      }
      assertSelf(instance, answer)
      return instance
    }

    // subkind === 'doubling_time'
    const continuous = rng.pick([true, false] as const)
    if (continuous) {
      const exactExpr = `ln(2) / ${r}`
      const exactValue = Math.log(2) / r
      const answerText = roundPlaces(exactValue, 2)

      const valPercent = Math.log(2) / rPct
      const valSimple = 1 / r
      const valMonthly = Math.log(2) / (12 * Math.log(1 + r / 12))

      const traps: ExpModelsAnswer['stages'][number]['traps'] = [
        {
          id: 'exp_rate_percent',
          text: roundPlaces(valPercent, 2),
          value: valPercent,
          witness: `Write ${rPct}% as the decimal r = ${r} in t = ln(2) / r.`,
        },
        {
          id: 'exp_simple_interest',
          text: roundPlaces(valSimple, 2),
          value: valSimple,
          witness: `1 / r = ${roundPlaces(valSimple, 2)} is the simple-interest doubling time. For continuous compounding, e^(rt) = 2 gives t = ln(2) / r.`,
        },
        {
          id: 'exp_continuous_swapped',
          text: roundPlaces(valMonthly, 2),
          value: valMonthly,
          witness: `Use the continuous doubling formula t = ln(2) / r rather than monthly compounding.`,
        },
      ]

      const chosenTrap = rng.pick(traps)
      const ruleCard = (EM_RULE_FOR[chosenTrap.id] ?? EM_RULE_IDS.continuousInterest) as RuleCardId
      const prompt = `An investment earns ${rPct}% annual interest compounded continuously. Find the doubling time in years. Round to 2 decimal places.`
      const formulaDisplay = 'A = P * e^(rt)'

      const stage: ExpModelsAnswer['stages'][number] = {
        id: 'answer',
        label: 'Doubling time (years)',
        placeholder: 'e.g. 11.55',
        formatHint: 'Round to 2 decimal places, or enter the exact expression ln(2)/r.',
        answerText,
        exactExpr,
        exactValue,
        places: 2,
        unit: 'years',
        nudge: 'Set A = 2P in A = P * e^(rt), divide by P to get e^(rt) = 2, and take ln of both sides.',
        ruleCard,
        reveal: [`Setting e^(${r}t) = 2 gives t = ln(2) / ${r} ≈ ${answerText} years.`],
        traps,
      }

      const answer: ExpModelsAnswer = {
        type: 'expModels',
        question: 'interest',
        subkind,
        prompt,
        formulaDisplay,
        stages: [stage],
        expectedDisplay: `${answerText} years`,
        nudge: stage.nudge,
        ruleCard,
        ruleCards: [ruleCard, EM_RULE_IDS.continuousInterest, EM_RULE_IDS.solveTime, EM_RULE_IDS.compound].filter(
          (v, i, a) => a.indexOf(v) === i,
        ),
        reveal: stage.reveal,
        trap: chosenTrap.id,
        trapStage: 'answer',
        trapAnswer: chosenTrap.text,
      }

      const instance: ProblemInstance = {
        id: problemId(EM_MODULE_ID, 'em.interest', 1, seed),
        moduleId: EM_MODULE_ID,
        templateId: 'em.interest',
        skill: 'em.interest',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expModels',
        title: 'Compound and continuous interest',
        instructions: 'Find the doubling time in years. You may give the rounded decimal or an exact expression.',
        statementText: prompt,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: { subkind, continuous: true, rPct, trap: chosenTrap.id },
      }
      assertSelf(instance, answer)
      return instance
    }

    const period = rng.pick(PERIODS.slice(0, 3))
    const { n, word, wrongN, wrongDesc } = period
    const exactExpr = `ln(2) / (${n} * ln(1 + ${r}/${n}))`
    const exactValue = Math.log(2) / (n * Math.log(1 + r / n))
    const answerText = roundPlaces(exactValue, 2)

    const valMissingN = Math.log(2) / Math.log(1 + r / n)
    const valContSwapped = Math.log(2) / r
    const valSimple = 1 / r
    const valWrongPeriod = Math.log(2) / (wrongN * Math.log(1 + r / wrongN))

    const traps: ExpModelsAnswer['stages'][number]['traps'] = [
      {
        id: 'exp_exponent_missing_factor',
        text: roundPlaces(valMissingN, 2),
        value: valMissingN,
        witness: `Divide by n = ${n} as well: t = ln(2) / (${n} * ln(1 + ${r}/${n})).`,
      },
      {
        id: 'exp_continuous_swapped',
        text: roundPlaces(valContSwapped, 2),
        value: valContSwapped,
        witness: `ln(2) / ${r} is the continuous doubling time, but this account compounds ${word} (n = ${n}).`,
      },
      {
        id: 'exp_simple_interest',
        text: roundPlaces(valSimple, 2),
        value: valSimple,
        witness: `1 / r is simple interest doubling time. Solve (1 + r/n)^(nt) = 2 using logarithms.`,
      },
      {
        id: 'exp_wrong_period',
        text: roundPlaces(valWrongPeriod, 2),
        value: valWrongPeriod,
        witness: `Compounded ${word} means n = ${n} periods per year, not ${wrongDesc}.`,
      },
    ]

    const chosenTrap = rng.pick(traps)
    const ruleCard = (EM_RULE_FOR[chosenTrap.id] ?? EM_RULE_IDS.solveTime) as RuleCardId
    const prompt = `An investment earns ${rPct}% annual interest compounded ${word}. Find the doubling time in years. Round to 2 decimal places.`
    const formulaDisplay = 'A = P(1 + r/n)^(nt)'

    const stage: ExpModelsAnswer['stages'][number] = {
      id: 'answer',
      label: 'Doubling time (years)',
      placeholder: 'e.g. 11.58',
      formatHint: 'Round to 2 decimal places, or enter the exact logarithmic expression.',
      answerText,
      exactExpr,
      exactValue,
      places: 2,
      unit: 'years',
      nudge: 'Set (1 + r/n)^(nt) = 2, take ln of both sides, and divide by n * ln(1 + r/n).',
      ruleCard,
      reveal: [`Setting (1 + ${r}/${n})^(${n}t) = 2 gives t = ln(2) / (${n} * ln(1 + ${r}/${n})) ≈ ${answerText} years.`],
      traps,
    }

    const answer: ExpModelsAnswer = {
      type: 'expModels',
      question: 'interest',
      subkind,
      prompt,
      formulaDisplay,
      stages: [stage],
      expectedDisplay: `${answerText} years`,
      nudge: stage.nudge,
      ruleCard,
      ruleCards: [ruleCard, EM_RULE_IDS.solveTime, EM_RULE_IDS.compound, EM_RULE_IDS.continuousInterest].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      reveal: stage.reveal,
      trap: chosenTrap.id,
      trapStage: 'answer',
      trapAnswer: chosenTrap.text,
    }

    const instance: ProblemInstance = {
      id: problemId(EM_MODULE_ID, 'em.interest', 1, seed),
      moduleId: EM_MODULE_ID,
      templateId: 'em.interest',
      skill: 'em.interest',
      genVersion: 1,
      seed,
      knobs,
      kind: 'expModels',
      title: 'Compound and continuous interest',
      instructions: 'Find the doubling time in years. You may give the rounded decimal or an exact expression.',
      statementText: prompt,
      vars: ['x'],
      start: null,
      canonical: [],
      answer,
      graph: NO_GRAPH,
      calc: NO_CALC,
      params: { subkind, continuous: false, rPct, n, trap: chosenTrap.id },
    }
    assertSelf(instance, answer)
    return instance
  })
}

function buildHalflife(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  return searchSeed(seed, 0x656d_6802, 96, (rng) => {
    const subkind = rng.pick(['amount_left', 'time_to_amount', 'c14_dating', 'find_halflife'] as const)
    const formulaDisplay = 'A = A_0 * (1/2)^(t/h)'

    if (subkind === 'amount_left') {
      const A0 = rng.pick([80, 100, 120, 150, 200, 240, 300, 400] as const)
      const h = rng.pick([4, 5, 6, 8, 10, 12, 15, 20] as const)
      const t = rng.pick([3, 5, 7, 9, 11, 13, 14, 17, 19, 23] as const)
      if (t === h || Math.abs(t - h) <= 1) throw new LogSkip('keep t distinct from h')

      const exactExpr = `${A0} * (1/2)^(${t}/${h})`
      const exactValue = A0 * Math.pow(0.5, t / h)
      const answerText = roundPlaces(exactValue, 2)

      const valInverted = A0 * Math.pow(0.5, h / t)
      const valDecayed = A0 - exactValue
      const valFracBase = A0 * Math.pow(1 / h, t / h)

      const traps: ExpModelsAnswer['stages'][number]['traps'] = [
        {
          id: 'exp_halflife_inverted',
          text: roundPlaces(valInverted, 2),
          value: valInverted,
          witness: `The exponent is elapsed time divided by half-life, t/h = ${t}/${h}, not h/t = ${h}/${t}.`,
        },
        {
          id: 'exp_halflife_decayed',
          text: roundPlaces(valDecayed, 2),
          value: valDecayed,
          witness: `${roundPlaces(valDecayed, 2)} g is the amount that has decayed (A_0 - A). The formula A_0(1/2)^(t/h) gives the amount remaining: ${answerText} g.`,
        },
        {
          id: 'exp_halflife_fraction_base',
          text: roundPlaces(valFracBase, 2),
          value: valFracBase,
          witness: `The base in the half-life formula is always 1/2, with the half-life h = ${h} in the denominator of the exponent t/h.`,
        },
      ]

      const chosenTrap = rng.pick(traps)
      const prompt = `A radioactive sample has an initial mass of ${A0} g and a half-life of ${h} days. Find the mass remaining after ${t} days. Round to 2 decimal places.`

      const stage: ExpModelsAnswer['stages'][number] = {
        id: 'answer',
        label: 'Amount remaining (g)',
        placeholder: 'e.g. 35.36',
        formatHint: 'Round to 2 decimal places, or enter the exact expression.',
        answerText,
        exactExpr,
        exactValue,
        places: 2,
        unit: 'g',
        nudge: 'Substitute A_0, elapsed time t, and half-life h into A = A_0 * (1/2)^(t/h).',
        ruleCard: EM_RULE_IDS.halflife,
        reveal: [`Substitute A_0 = ${A0}, t = ${t}, and h = ${h}: A = ${A0} * (1/2)^(${t}/${h}) ≈ ${answerText} g.`],
        traps,
      }

      const answer: ExpModelsAnswer = {
        type: 'expModels',
        question: 'halflife',
        subkind,
        prompt,
        formulaDisplay,
        stages: [stage],
        expectedDisplay: `${answerText} g`,
        nudge: stage.nudge,
        ruleCard: EM_RULE_IDS.halflife,
        ruleCards: [EM_RULE_IDS.halflife, EM_RULE_IDS.solveTime, EM_RULE_IDS.growthRate],
        reveal: stage.reveal,
        trap: chosenTrap.id,
        trapStage: 'answer',
        trapAnswer: chosenTrap.text,
      }

      const instance: ProblemInstance = {
        id: problemId(EM_MODULE_ID, 'em.halflife', 1, seed),
        moduleId: EM_MODULE_ID,
        templateId: 'em.halflife',
        skill: 'em.halflife',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expModels',
        title: 'Half-life and radioactive decay',
        instructions: 'Solve the half-life problem. You may give the rounded decimal or an exact expression.',
        statementText: prompt,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: { subkind, A0, h, t, trap: chosenTrap.id },
      }
      assertSelf(instance, answer)
      return instance
    }

    if (subkind === 'time_to_amount') {
      const A0 = rng.pick([100, 120, 160, 200, 250, 300, 400] as const)
      const pctRemaining = rng.pick([15, 20, 28, 30, 35, 40, 60, 65, 70, 75] as const)
      const A = Number(((A0 * pctRemaining) / 100).toFixed(1))
      if (!Number.isInteger(A)) throw new LogSkip('keep integer A')
      const h = rng.pick([4, 6, 8, 10, 12, 15, 18, 24] as const)

      const exactExpr = `${h} * ln(${A}/${A0}) / ln(1/2)`
      const exactValue = (h * Math.log(A / A0)) / Math.log(0.5)
      const answerText = roundPlaces(exactValue, 2)

      const valInverted = (h * Math.log(0.5)) / Math.log(A / A0)
      const valDecayed = (h * Math.log((A0 - A) / A0)) / Math.log(0.5)
      const valFracBase = h * (A / A0)

      const traps: ExpModelsAnswer['stages'][number]['traps'] = [
        {
          id: 'exp_halflife_inverted',
          text: roundPlaces(valInverted, 2),
          value: valInverted,
          witness: `Solving (1/2)^(t/h) = ${A}/${A0} gives t/h = ln(${A}/${A0}) / ln(1/2), not ln(1/2) / ln(${A}/${A0}).`,
        },
        {
          id: 'exp_halflife_decayed',
          text: roundPlaces(valDecayed, 2),
          value: valDecayed,
          witness: `Use the amount remaining A = ${A} g in the ratio A/A_0 = ${A}/${A0}, not the amount decayed ${A0 - A} g.`,
        },
        {
          id: 'exp_halflife_fraction_base',
          text: roundPlaces(valFracBase, 2),
          value: valFracBase,
          witness: `Use logarithms with base 1/2 to solve (1/2)^(t/${h}) = ${A}/${A0} rather than multiplying ${h} by ${A}/${A0}.`,
        },
      ]

      const chosenTrap = rng.pick(traps)
      const prompt = `A radioactive isotope has a half-life of ${h} hours. How many hours will it take for a ${A0} g sample to decay to ${A} g? Round to 2 decimal places.`

      const stage: ExpModelsAnswer['stages'][number] = {
        id: 'answer',
        label: 'Time t (hours)',
        placeholder: 'e.g. 14.21',
        formatHint: 'Round to 2 decimal places, or enter the exact logarithmic expression.',
        answerText,
        exactExpr,
        exactValue,
        places: 2,
        unit: 'hours',
        nudge: 'Divide A by A_0, take ln of both sides, divide by ln(1/2), and multiply by the half-life h.',
        ruleCard: EM_RULE_IDS.halflife,
        reveal: [
          `Set ${A} = ${A0}(1/2)^(t/${h}), so (1/2)^(t/${h}) = ${A}/${A0}.`,
          `Solve for t: t = ${h} * ln(${A}/${A0}) / ln(1/2) ≈ ${answerText} hours.`,
        ],
        traps,
      }

      const answer: ExpModelsAnswer = {
        type: 'expModels',
        question: 'halflife',
        subkind,
        prompt,
        formulaDisplay,
        stages: [stage],
        expectedDisplay: `${answerText} hours`,
        nudge: stage.nudge,
        ruleCard: EM_RULE_IDS.halflife,
        ruleCards: [EM_RULE_IDS.halflife, EM_RULE_IDS.solveTime, EM_RULE_IDS.growthRate],
        reveal: stage.reveal,
        trap: chosenTrap.id,
        trapStage: 'answer',
        trapAnswer: chosenTrap.text,
      }

      const instance: ProblemInstance = {
        id: problemId(EM_MODULE_ID, 'em.halflife', 1, seed),
        moduleId: EM_MODULE_ID,
        templateId: 'em.halflife',
        skill: 'em.halflife',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expModels',
        title: 'Half-life and radioactive decay',
        instructions: 'Solve the half-life problem. You may give the rounded decimal or an exact expression.',
        statementText: prompt,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: { subkind, A0, A, h, trap: chosenTrap.id },
      }
      assertSelf(instance, answer)
      return instance
    }

    if (subkind === 'c14_dating') {
      const h = 5730
      const pct = rng.pick([14, 18, 22, 26, 32, 36, 40, 44, 56, 62, 68, 74, 80, 84] as const)
      const ratio = Number((pct / 100).toFixed(2))
      const decayedRatio = Number(((100 - pct) / 100).toFixed(2))

      const exactExpr = `5730 * ln(${ratio}) / ln(1/2)`
      const exactValue = (h * Math.log(ratio)) / Math.log(0.5)
      const answerText = roundPlaces(exactValue, 1)

      const valInverted = (h * Math.log(0.5)) / Math.log(ratio)
      const valDecayed = (h * Math.log(decayedRatio)) / Math.log(0.5)
      const valFracBase = h * (1 - ratio)

      const traps: ExpModelsAnswer['stages'][number]['traps'] = [
        {
          id: 'exp_halflife_inverted',
          text: roundPlaces(valInverted, 1),
          value: valInverted,
          witness: `Solving (1/2)^(t/5730) = ${ratio} gives t = 5730 * ln(${ratio}) / ln(1/2), not 5730 * ln(1/2) / ln(${ratio}).`,
        },
        {
          id: 'exp_halflife_decayed',
          text: roundPlaces(valDecayed, 1),
          value: valDecayed,
          witness: `Use the fraction of carbon-14 remaining (${ratio}), not the fraction that has decayed (${decayedRatio}).`,
        },
        {
          id: 'exp_halflife_fraction_base',
          text: roundPlaces(valFracBase, 1),
          value: valFracBase,
          witness: `Radioactive decay is exponential with base 1/2: solve (1/2)^(t/5730) = ${ratio} using logarithms.`,
        },
      ]

      const chosenTrap = rng.pick(traps)
      const prompt = `A fossilized wood sample contains ${pct}% of its original carbon-14 (half-life h = 5730 years). Estimate the age of the sample in years. Round to 1 decimal place.`

      const stage: ExpModelsAnswer['stages'][number] = {
        id: 'answer',
        label: 'Age of sample (years)',
        placeholder: 'e.g. 3954.2',
        formatHint: 'Round to 1 decimal place, or enter the exact logarithmic expression.',
        answerText,
        exactExpr,
        exactValue,
        places: 1,
        unit: 'years',
        nudge: 'Set A/A_0 equal to the remaining decimal fraction and solve (1/2)^(t/5730) = A/A_0 for t.',
        ruleCard: EM_RULE_IDS.halflife,
        reveal: [
          `With ${pct}% remaining, A/A_0 = ${ratio}, so (1/2)^(t/5730) = ${ratio}.`,
          `t = 5730 * ln(${ratio}) / ln(1/2) ≈ ${answerText} years.`,
        ],
        traps,
      }

      const answer: ExpModelsAnswer = {
        type: 'expModels',
        question: 'halflife',
        subkind,
        prompt,
        formulaDisplay,
        stages: [stage],
        expectedDisplay: `${answerText} years`,
        nudge: stage.nudge,
        ruleCard: EM_RULE_IDS.halflife,
        ruleCards: [EM_RULE_IDS.halflife, EM_RULE_IDS.solveTime, EM_RULE_IDS.growthRate],
        reveal: stage.reveal,
        trap: chosenTrap.id,
        trapStage: 'answer',
        trapAnswer: chosenTrap.text,
      }

      const instance: ProblemInstance = {
        id: problemId(EM_MODULE_ID, 'em.halflife', 1, seed),
        moduleId: EM_MODULE_ID,
        templateId: 'em.halflife',
        skill: 'em.halflife',
        genVersion: 1,
        seed,
        knobs,
        kind: 'expModels',
        title: 'Half-life and radioactive decay',
        instructions: 'Solve the carbon-14 dating problem. You may give the rounded decimal or an exact expression.',
        statementText: prompt,
        vars: ['x'],
        start: null,
        canonical: [],
        answer,
        graph: NO_GRAPH,
        calc: NO_CALC,
        params: { subkind, pct, h, trap: chosenTrap.id },
      }
      assertSelf(instance, answer)
      return instance
    }

    // subkind === 'find_halflife'
    const A0 = rng.pick([100, 120, 150, 200, 250, 300, 400] as const)
    const pctRemaining = rng.pick([15, 20, 28, 30, 35, 40, 60, 65, 70, 75] as const)
    const A = Number(((A0 * pctRemaining) / 100).toFixed(1))
    if (!Number.isInteger(A)) throw new LogSkip('keep integer A')
    const t = rng.pick([6, 8, 9, 10, 12, 14, 15, 18, 20, 24] as const)

    const exactExpr = `${t} * ln(1/2) / ln(${A}/${A0})`
    const exactValue = (t * Math.log(0.5)) / Math.log(A / A0)
    const answerText = roundPlaces(exactValue, 2)

    const valInverted = (t * Math.log(A / A0)) / Math.log(0.5)
    const valDecayed = (t * Math.log(0.5)) / Math.log((A0 - A) / A0)
    const valFracBase = t * (A / A0)

    const traps: ExpModelsAnswer['stages'][number]['traps'] = [
      {
        id: 'exp_halflife_inverted',
        text: roundPlaces(valInverted, 2),
        value: valInverted,
        witness: `From t/h = ln(${A}/${A0}) / ln(1/2), solving for h in the denominator gives h = ${t} * ln(1/2) / ln(${A}/${A0}).`,
      },
      {
        id: 'exp_halflife_decayed',
        text: roundPlaces(valDecayed, 2),
        value: valDecayed,
        witness: `Use the remaining mass A = ${A} g in A/A_0 = ${A}/${A0}, not the decayed mass ${A0 - A} g.`,
      },
      {
        id: 'exp_halflife_fraction_base',
        text: roundPlaces(valFracBase, 2),
        value: valFracBase,
        witness: `Solve (1/2)^(${t}/h) = ${A}/${A0} using logarithms rather than multiplying ${t} by ${A}/${A0}.`,
      },
    ]

    const chosenTrap = rng.pick(traps)
    const prompt = `A ${A0} g sample of a radioactive substance decays to ${A} g in ${t} days. Find the half-life of the substance in days. Round to 2 decimal places.`

    const stage: ExpModelsAnswer['stages'][number] = {
      id: 'answer',
      label: 'Half-life h (days)',
      placeholder: 'e.g. 9.32',
      formatHint: 'Round to 2 decimal places, or enter the exact logarithmic expression.',
      answerText,
      exactExpr,
      exactValue,
      places: 2,
      unit: 'days',
      nudge: 'Set (1/2)^(t/h) = A/A_0, take ln of both sides to get (t/h) * ln(1/2) = ln(A/A_0), and solve for h.',
      ruleCard: EM_RULE_IDS.halflife,
      reveal: [
        `Divide by ${A0}: (1/2)^(${t}/h) = ${A}/${A0}.`,
        `Take ln and solve for h: h = ${t} * ln(1/2) / ln(${A}/${A0}) ≈ ${answerText} days.`,
      ],
      traps,
    }

    const answer: ExpModelsAnswer = {
      type: 'expModels',
      question: 'halflife',
      subkind,
      prompt,
      formulaDisplay,
      stages: [stage],
      expectedDisplay: `${answerText} days`,
      nudge: stage.nudge,
      ruleCard: EM_RULE_IDS.halflife,
      ruleCards: [EM_RULE_IDS.halflife, EM_RULE_IDS.solveTime, EM_RULE_IDS.growthRate],
      reveal: stage.reveal,
      trap: chosenTrap.id,
      trapStage: 'answer',
      trapAnswer: chosenTrap.text,
    }

    const instance: ProblemInstance = {
      id: problemId(EM_MODULE_ID, 'em.halflife', 1, seed),
      moduleId: EM_MODULE_ID,
      templateId: 'em.halflife',
      skill: 'em.halflife',
      genVersion: 1,
      seed,
      knobs,
      kind: 'expModels',
      title: 'Half-life and radioactive decay',
      instructions: 'Find the half-life. You may give the rounded decimal or an exact expression.',
      statementText: prompt,
      vars: ['x'],
      start: null,
      canonical: [],
      answer,
      graph: NO_GRAPH,
      calc: NO_CALC,
      params: { subkind, A0, A, t, trap: chosenTrap.id },
    }
    assertSelf(instance, answer)
    return instance
  })
}

function buildGrowth(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  return searchSeed(seed, 0x656d_6703, 96, (rng) => {
    const subkind = rng.pick(['predict', 'time_to_size'] as const)
    const P0 = rng.pick([50, 80, 100, 120, 150, 200] as const)
    const ratioNum = rng.pick([15, 18, 22, 24, 25, 28, 30, 35] as const)
    const P1 = Math.round((P0 * ratioNum) / 10)
    if (P1 <= P0 + 10) throw new LogSkip('keep P1 well above P0')
    const t1 = rng.pick([4, 5, 6, 7, 8, 9, 10] as const)

    const kExactExpr = `ln(${P1}/${P0})/${t1}`
    const kExact = Math.log(P1 / P0) / t1
    const kRoundText = roundPlaces(kExact, 4)
    const kRound = Number(kRoundText)

    const kNoLogVal = P1 / P0 / t1
    const kNoLogExpr = `(${P1}/${P0})/${t1}`
    const kLogDiffVal = Math.log(P1 - P0) / t1
    const kLogDiffExpr = `ln(${P1 - P0})/${t1}`
    const kSwappedVal = t1 / Math.log(P1 / P0)
    const kSwappedExpr = `${t1}/ln(${P1}/${P0})`

    const stage1: ExpModelsAnswer['stages'][number] = {
      id: 'exact_k',
      label: 'Exact growth rate k',
      placeholder: 'e.g. ln(P_1/P_0)/t',
      formatHint: 'Write the exact expression in terms of ln, such as ln(a/b)/t.',
      answerText: kExactExpr,
      exactExpr: kExactExpr,
      exactValue: kExact,
      nudge: 'Substitute P_0, P_1, and t into P_1 = P_0 * e^(kt), divide by P_0, take ln of both sides, and divide by t.',
      ruleCard: EM_RULE_IDS.growthRate,
      reveal: [`From ${P1} = ${P0} * e^(${t1}k), e^(${t1}k) = ${P1}/${P0}, so k = ${kExactExpr}.`],
      traps: [
        {
          id: 'exp_growth_no_log',
          text: kNoLogExpr,
          value: kNoLogVal,
          exactExpr: kNoLogExpr,
          witness: `Divide ${P1} by ${P0} first, then take the natural logarithm ln(${P1}/${P0}) before dividing by ${t1}.`,
        },
        {
          id: 'exp_growth_log_diff',
          text: kLogDiffExpr,
          value: kLogDiffVal,
          exactExpr: kLogDiffExpr,
          witness: `Isolate e^(${t1}k) by dividing ${P1} by ${P0} (not subtracting ${P0} from ${P1}): use ln(${P1}/${P0}), not ln(${P1} - ${P0}).`,
        },
        {
          id: 'exp_growth_swapped',
          text: kSwappedExpr,
          value: kSwappedVal,
          exactExpr: kSwappedExpr,
          witness: `Solving ${t1}k = ln(${P1}/${P0}) for k divides ln(${P1}/${P0}) by ${t1}, not ${t1} by ln(${P1}/${P0}).`,
        },
      ],
    }

    const stage2: ExpModelsAnswer['stages'][number] = {
      id: 'rounded_k',
      label: 'Growth rate k (rounded to 4 decimal places)',
      placeholder: 'e.g. 0.1386',
      formatHint: 'Round k to 4 decimal places.',
      answerText: kRoundText,
      exactExpr: kExactExpr,
      exactValue: kExact,
      places: 4,
      nudge: 'Evaluate your exact expression for k on a calculator and round to 4 decimal places.',
      ruleCard: EM_RULE_IDS.growthRate,
      reveal: [`Evaluating ${kExactExpr} to 4 decimal places gives k ≈ ${kRoundText}.`],
      traps: [
        {
          id: 'exp_growth_no_log',
          text: roundPlaces(kNoLogVal, 4),
          value: kNoLogVal,
          witness: `Take the natural logarithm of the ratio ${P1}/${P0} before dividing by ${t1}.`,
        },
        {
          id: 'exp_growth_log_diff',
          text: roundPlaces(kLogDiffVal, 4),
          value: kLogDiffVal,
          witness: `Use the ratio ${P1}/${P0} inside the natural logarithm, not the difference ${P1} - ${P0}.`,
        },
        {
          id: 'exp_growth_swapped',
          text: roundPlaces(kSwappedVal, 4),
          value: kSwappedVal,
          witness: `Divide ln(${P1}/${P0}) by ${t1}, not ${t1} by ln(${P1}/${P0}).`,
        },
      ],
    }

    let stage3: ExpModelsAnswer['stages'][number]
    let prompt: string

    if (subkind === 'predict') {
      const t2 = t1 + rng.pick([3, 4, 5, 6] as const)
      const fExactExpr = `${P0} * e^((${kExactExpr}) * ${t2})`
      const fExactVal = P0 * Math.exp(kExact * t2)
      const fAltVal = P0 * Math.exp(kRound * t2)
      const fAnswerText = roundPlaces(fExactVal, 1)

      const valSwapped = Math.log(t2 / P0) / kExact
      const valNoLog = P0 * Math.exp(kNoLogVal * t2)
      const valLogDiff = P0 * Math.exp(kLogDiffVal * t2)

      stage3 = {
        id: 'followup',
        label: `Population at t = ${t2} hours`,
        placeholder: 'e.g. 642.5',
        formatHint: 'Round the predicted population to 1 decimal place, or enter the exact expression.',
        answerText: fAnswerText,
        exactExpr: fExactExpr,
        exactValue: fExactVal,
        altExactValue: fAltVal,
        places: 1,
        unit: 'bacteria',
        nudge: `Substitute t = ${t2} into P = ${P0} * e^(k * t) and evaluate.`,
        ruleCard: EM_RULE_IDS.growthPredict,
        reveal: [`At t = ${t2}, P(${t2}) = ${P0} * e^(${kExactExpr} * ${t2}) ≈ ${fAnswerText}.`],
        traps: [
          {
            id: 'exp_growth_swapped',
            text: roundPlaces(valSwapped, 1),
            value: valSwapped,
            witness: `t = ${t2} is a time in hours, so substitute ${t2} into the exponent of ${P0} * e^(k * t) rather than solving ${t2} = ${P0} * e^(k * t).`,
          },
          {
            id: 'exp_growth_no_log',
            text: roundPlaces(valNoLog, 1),
            value: valNoLog,
            witness: `Use the logarithmic growth rate k = ${kExactExpr} in the exponent.`,
          },
          {
            id: 'exp_growth_log_diff',
            text: roundPlaces(valLogDiff, 1),
            value: valLogDiff,
            witness: `Use k = ln(${P1}/${P0})/${t1} from the ratio of populations, not the difference.`,
          },
        ],
      }
      prompt = `A bacteria culture starts with P_0 = ${P0} bacteria and grows continuously according to P = P_0 * e^(kt). After ${t1} hours, the population is ${P1}. Find the exact growth rate k, round k to 4 decimal places, and predict the population after ${t2} hours (rounded to 1 decimal place).`
    } else {
      const mult = rng.pick([3, 4, 5] as const)
      const PTarget = P0 * mult
      if (PTarget === P1) throw new LogSkip('target equals P1')
      const fExactExpr = `ln(${PTarget}/${P0}) / (${kExactExpr})`
      const fExactVal = Math.log(PTarget / P0) / kExact
      const fAltVal = Math.log(PTarget / P0) / kRound
      const fAnswerText = roundPlaces(fExactVal, 2)

      const valSwapped = P0 * Math.exp(kExact * PTarget)
      if (!Number.isFinite(valSwapped)) throw new LogSkip('swapped trap overflowed')
      const valNoLog = Math.log(PTarget / P0) / kNoLogVal
      const valLogDiff = Math.log(PTarget / P0) / kLogDiffVal

      stage3 = {
        id: 'followup',
        label: `Time to reach ${PTarget} bacteria (hours)`,
        placeholder: 'e.g. 12.63',
        formatHint: 'Round the time to 2 decimal places, or enter the exact expression.',
        answerText: fAnswerText,
        exactExpr: fExactExpr,
        exactValue: fExactVal,
        altExactValue: fAltVal,
        places: 2,
        unit: 'hours',
        nudge: `Set P = ${PTarget} in ${PTarget} = ${P0} * e^(k * t), divide by ${P0}, take ln, and divide by k.`,
        ruleCard: EM_RULE_IDS.growthPredict,
        reveal: [`Setting ${PTarget} = ${P0} * e^(kt) gives t = ln(${PTarget}/${P0}) / k ≈ ${fAnswerText} hours.`],
        traps: [
          {
            id: 'exp_growth_swapped',
            text: roundPlaces(valSwapped, 2),
            value: valSwapped,
            witness: `${PTarget} is the target population P, not the time t. Set ${PTarget} = ${P0} * e^(kt) and solve for t = ln(${PTarget}/${P0}) / k.`,
          },
          {
            id: 'exp_growth_no_log',
            text: roundPlaces(valNoLog, 2),
            value: valNoLog,
            witness: `Use the logarithmic growth rate k = ${kExactExpr} when solving for t.`,
          },
          {
            id: 'exp_growth_log_diff',
            text: roundPlaces(valLogDiff, 2),
            value: valLogDiff,
            witness: `Use k = ln(${P1}/${P0})/${t1} from the ratio of populations.`,
          },
        ],
      }
      prompt = `A bacteria culture starts with P_0 = ${P0} bacteria and grows continuously according to P = P_0 * e^(kt). After ${t1} hours, the population is ${P1}. Find the exact growth rate k, round k to 4 decimal places, and find how many hours it takes the population to reach ${PTarget} (rounded to 2 decimal places).`
    }

    const stages = [stage1, stage2, stage3]
    const trapChoices: readonly { stage: ExpModelsStageId; id: ErrorPatternId; ans: string }[] = [
      { stage: 'exact_k', id: 'exp_growth_no_log', ans: kNoLogExpr },
      { stage: 'exact_k', id: 'exp_growth_log_diff', ans: kLogDiffExpr },
      { stage: 'followup', id: 'exp_growth_swapped', ans: stage3.traps[0]!.text },
    ]
    const chosenTrap = rng.pick(trapChoices)
    const ruleCard = (EM_RULE_FOR[chosenTrap.id] ?? EM_RULE_IDS.growthRate) as RuleCardId

    const answer: ExpModelsAnswer = {
      type: 'expModels',
      question: 'growth',
      subkind,
      prompt,
      formulaDisplay: 'P = P_0 * e^(kt)',
      stages,
      expectedDisplay: `k = ${kExactExpr} ≈ ${kRoundText}; ${stage3.answerText}`,
      nudge: stage1.nudge,
      ruleCard,
      ruleCards: [ruleCard, EM_RULE_IDS.growthRate, EM_RULE_IDS.growthPredict, EM_RULE_IDS.solveTime].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      reveal: stages.flatMap((s) => s.reveal),
      trap: chosenTrap.id,
      trapStage: chosenTrap.stage,
      trapAnswer: chosenTrap.ans,
    }

    const instance: ProblemInstance = {
      id: problemId(EM_MODULE_ID, 'em.growth', 1, seed),
      moduleId: EM_MODULE_ID,
      templateId: 'em.growth',
      skill: 'em.growth',
      genVersion: 1,
      seed,
      knobs,
      kind: 'expModels',
      title: 'Continuous exponential growth and decay',
      instructions: 'Find the exact rate constant k, its rounded value, and use the model to answer the follow-up question.',
      statementText: prompt,
      vars: ['x'],
      start: null,
      canonical: [],
      answer,
      graph: NO_GRAPH,
      calc: NO_CALC,
      params: { subkind, P0, P1, t1, trap: chosenTrap.id, trapStage: chosenTrap.stage },
    }
    assertSelf(instance, answer)
    return instance
  })
}

export const interestTemplate: TemplateDef = {
  id: 'em.interest',
  title: 'Compound and continuous interest',
  description: 'Balance, time to reach a target balance, and doubling time under periodic and continuous compounding.',
  version: 1,
  knobs: [],
  generate: buildInterest,
}

export const halflifeTemplate: TemplateDef = {
  id: 'em.halflife',
  title: 'Half-life and radioactive decay',
  description: 'Remaining mass, time to reach a given mass, carbon-14 dating, and finding the half-life from two measurements.',
  version: 1,
  knobs: [],
  generate: buildHalflife,
}

export const growthTemplate: TemplateDef = {
  id: 'em.growth',
  title: 'Continuous exponential growth and decay',
  description: 'Find the continuous growth rate k from two data points (exact and rounded) and predict size or time.',
  version: 1,
  knobs: [],
  generate: buildGrowth,
}

export const EM_TEMPLATES: readonly TemplateDef[] = [interestTemplate, halflifeTemplate, growthTemplate]
