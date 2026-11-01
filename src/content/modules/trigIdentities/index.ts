/**
 * Precalculus Unit 6 ("Analytic trigonometry"), Part 1: Fundamental trig identities.
 *
 * Templates:
 *  - `ti.express` (PARTS): write one trig function of θ in terms of another in a given quadrant.
 *  - `ti.simplify` (STEP BY STEP): simplify a trig expression in x to a single trig function or a constant.
 *  - `ti.verify` (STEP BY STEP): verify an identity by transforming the left side into the right side.
 */
import type {
  CanonicalStep,
  DifficultyKnobs,
  ModuleDef,
  ProblemInstance,
  ProgressInfo,
  RuleCard,
  TemplateDef,
  TrigFigureSpec,
  TrigIdentitiesAnswer,
  TrigPart,
} from '@/content/types'
import { problemId as makeProblemId, registerModule } from '@/content/registry'
import { mulberry32 as makeRng, mixSeed } from '@/content/rng'
import type { TrigPartGrade } from '../trig/parts'
import {
  detectTrigStepFamily,
  gradeTiExpressExpr,
  isSimplifiedTrig,
  readTrigIdentityExpr,
  sameTrigExpr,
  trigIdentitySlips,
  trigIdentityToLatex,
  verifyTrigStep,
  type ExpressPairSpec,
  type ExpressPartGrade,
  type TrigFn,
  type Quadrant,
} from '@/engine/trig'
import type { CalcPanels, GraphSpec } from '@/shared/types'

export type { TrigIdentitiesAnswer }

const GEN_VERSION = 1

const EMPTY_GRAPH: GraphSpec = {
  kind: 'none',
}

const EMPTY_CALC: CalcPanels = {
  ti84: [],
  nspire: [],
}

const NO_FIGURE: TrigFigureSpec = {
  kind: 'none',
  deg: 0,
  label: '',
  ariaLabel: '',
}

// ---------------------------------------------------------------------------
// Rule cards
// ---------------------------------------------------------------------------

export const TI_RULE_CARDS: RuleCard[] = [
  {
    id: 'ti-fundamental',
    title: 'The eight fundamental identities',
    body:
      'The eight fundamental identities tie the six trig functions together for every angle where both sides are defined.\n' +
      '• Reciprocal identities: csc x = 1/sin x, sec x = 1/cos x, cot x = 1/tan x\n' +
      '• Quotient identities: tan x = sin x/cos x, cot x = cos x/sin x\n' +
      '• Pythagorean identities: sin²x + cos²x = 1, 1 + tan²x = sec²x, 1 + cot²x = csc²x',
    example: 'tan x cos x = (sin x/cos x) cos x = sin x',
  },
  {
    id: 'ti-express',
    title: 'Writing one trig function in terms of another',
    body:
      'Pick the Pythagorean identity (and, when needed, the reciprocal or quotient identities) that links the two functions. Solve for the squared function, take the square root, and use the given quadrant to choose + or − (All Students Take Calculus: all positive in Quadrant I, sin/csc in II, tan/cot in III, cos/sec in IV).',
    example: 'sin²θ + cos²θ = 1 → sin θ = −√(1 − cos²θ) in Quadrant III',
  },
  {
    id: 'ti-simplify',
    title: 'How to simplify a trig expression',
    body:
      'To simplify a trig expression to a single trig function or a constant, use the fundamental identities (reciprocal identities, quotient identities, and Pythagorean identities) together with algebra: rewrite in terms of sin x and cos x, combine fractions over a common denominator, factor, or replace a Pythagorean pair.',
    example: 'cos x + sin x tan x = cos x + sin²x/cos x = (cos²x + sin²x)/cos x = 1/cos x = sec x',
  },
  {
    id: 'ti-verify',
    title: 'How to verify the identity',
    body:
      'To verify the identity, work ONE side until it becomes the other; never move terms across the equals sign (an identity is not an equation you already know to be true — you are proving it). Start with the more complicated side and apply reciprocal identities, quotient identities, Pythagorean identities, and algebra one line at a time until your line matches the right side.',
    example: 'sec x − cos x = 1/cos x − cos x = (1 − cos²x)/cos x = sin²x/cos x = sin x tan x',
  },
]

// ---------------------------------------------------------------------------
// 1. ti.express (PARTS)
// ---------------------------------------------------------------------------

interface ExpressTemplatePair {
  targetFn: TrigFn
  givenFn: TrigFn
  quadrants: readonly Quadrant[]
  identityText: 'sin²θ + cos²θ = 1' | '1 + tan²θ = sec²θ' | '1 + cot²θ = csc²θ'
  identityLatex: string
  positiveExpr: string
  negativeExpr: string
  positiveLatex: string
  negativeLatex: string
  wrongSignRadicand: string
  noSquareRadicand: string
  solveLineLatex: string
}

const EXPRESS_PAIRS: readonly ExpressTemplatePair[] = [
  {
    targetFn: 'sin',
    givenFn: 'cos',
    quadrants: [1, 2, 3, 4],
    identityText: 'sin²θ + cos²θ = 1',
    identityLatex: '\\sin^{2}\\theta + \\cos^{2}\\theta = 1',
    positiveExpr: '√(1 − cos²θ)',
    negativeExpr: '−√(1 − cos²θ)',
    positiveLatex: '\\sqrt{1 - \\cos^{2}\\theta}',
    negativeLatex: '-\\sqrt{1 - \\cos^{2}\\theta}',
    wrongSignRadicand: '√(1 + cos²θ)',
    noSquareRadicand: '√(1 − cos θ)',
    solveLineLatex: '\\sin^{2}\\theta = 1 - \\cos^{2}\\theta',
  },
  {
    targetFn: 'cos',
    givenFn: 'sin',
    quadrants: [1, 2, 3, 4],
    identityText: 'sin²θ + cos²θ = 1',
    identityLatex: '\\sin^{2}\\theta + \\cos^{2}\\theta = 1',
    positiveExpr: '√(1 − sin²θ)',
    negativeExpr: '−√(1 − sin²θ)',
    positiveLatex: '\\sqrt{1 - \\sin^{2}\\theta}',
    negativeLatex: '-\\sqrt{1 - \\sin^{2}\\theta}',
    wrongSignRadicand: '√(1 + sin²θ)',
    noSquareRadicand: '√(1 − sin θ)',
    solveLineLatex: '\\cos^{2}\\theta = 1 - \\sin^{2}\\theta',
  },
  {
    targetFn: 'sec',
    givenFn: 'tan',
    quadrants: [1, 2, 3, 4],
    identityText: '1 + tan²θ = sec²θ',
    identityLatex: '1 + \\tan^{2}\\theta = \\sec^{2}\\theta',
    positiveExpr: '√(1 + tan²θ)',
    negativeExpr: '−√(1 + tan²θ)',
    positiveLatex: '\\sqrt{1 + \\tan^{2}\\theta}',
    negativeLatex: '-\\sqrt{1 + \\tan^{2}\\theta}',
    wrongSignRadicand: '√(1 − tan²θ)',
    noSquareRadicand: '√(1 + tan θ)',
    solveLineLatex: '\\sec^{2}\\theta = 1 + \\tan^{2}\\theta',
  },
  {
    targetFn: 'tan',
    givenFn: 'sec',
    quadrants: [1, 2, 3, 4],
    identityText: '1 + tan²θ = sec²θ',
    identityLatex: '1 + \\tan^{2}\\theta = \\sec^{2}\\theta',
    positiveExpr: '√(sec²θ − 1)',
    negativeExpr: '−√(sec²θ − 1)',
    positiveLatex: '\\sqrt{\\sec^{2}\\theta - 1}',
    negativeLatex: '-\\sqrt{\\sec^{2}\\theta - 1}',
    wrongSignRadicand: '√(sec²θ + 1)',
    noSquareRadicand: '√(sec θ − 1)',
    solveLineLatex: '\\tan^{2}\\theta = \\sec^{2}\\theta - 1',
  },
  {
    targetFn: 'csc',
    givenFn: 'cot',
    quadrants: [1, 2, 3, 4],
    identityText: '1 + cot²θ = csc²θ',
    identityLatex: '1 + \\cot^{2}\\theta = \\csc^{2}\\theta',
    positiveExpr: '√(1 + cot²θ)',
    negativeExpr: '−√(1 + cot²θ)',
    positiveLatex: '\\sqrt{1 + \\cot^{2}\\theta}',
    negativeLatex: '-\\sqrt{1 + \\cot^{2}\\theta}',
    wrongSignRadicand: '√(1 − cot²θ)',
    noSquareRadicand: '√(1 + cot θ)',
    solveLineLatex: '\\csc^{2}\\theta = 1 + \\cot^{2}\\theta',
  },
  {
    targetFn: 'cot',
    givenFn: 'csc',
    quadrants: [1, 2, 3, 4],
    identityText: '1 + cot²θ = csc²θ',
    identityLatex: '1 + \\cot^{2}\\theta = \\csc^{2}\\theta',
    positiveExpr: '√(csc²θ − 1)',
    negativeExpr: '−√(csc²θ − 1)',
    positiveLatex: '\\sqrt{\\csc^{2}\\theta - 1}',
    negativeLatex: '-\\sqrt{\\csc^{2}\\theta - 1}',
    wrongSignRadicand: '√(csc²θ + 1)',
    noSquareRadicand: '√(csc θ − 1)',
    solveLineLatex: '\\cot^{2}\\theta = \\csc^{2}\\theta - 1',
  },
  {
    targetFn: 'sec',
    givenFn: 'sin',
    quadrants: [1, 2, 3, 4],
    identityText: 'sin²θ + cos²θ = 1',
    identityLatex: '\\sin^{2}\\theta + \\cos^{2}\\theta = 1',
    positiveExpr: '1 / √(1 − sin²θ)',
    negativeExpr: '−1 / √(1 − sin²θ)',
    positiveLatex: '\\frac{1}{\\sqrt{1 - \\sin^{2}\\theta}}',
    negativeLatex: '-\\frac{1}{\\sqrt{1 - \\sin^{2}\\theta}}',
    wrongSignRadicand: '1 / √(1 + sin²θ)',
    noSquareRadicand: '1 / √(1 − sin θ)',
    solveLineLatex: '\\sec\\theta = \\frac{1}{\\cos\\theta},\\quad \\cos^{2}\\theta = 1 - \\sin^{2}\\theta',
  },
  {
    targetFn: 'csc',
    givenFn: 'cos',
    quadrants: [1, 2, 3, 4],
    identityText: 'sin²θ + cos²θ = 1',
    identityLatex: '\\sin^{2}\\theta + \\cos^{2}\\theta = 1',
    positiveExpr: '1 / √(1 − cos²θ)',
    negativeExpr: '−1 / √(1 − cos²θ)',
    positiveLatex: '\\frac{1}{\\sqrt{1 - \\cos^{2}\\theta}}',
    negativeLatex: '-\\frac{1}{\\sqrt{1 - \\cos^{2}\\theta}}',
    wrongSignRadicand: '1 / √(1 + cos²θ)',
    noSquareRadicand: '1 / √(1 − cos θ)',
    solveLineLatex: '\\csc\\theta = \\frac{1}{\\sin\\theta},\\quad \\sin^{2}\\theta = 1 - \\cos^{2}\\theta',
  },
  {
    targetFn: 'tan',
    givenFn: 'sin',
    quadrants: [1, 2],
    identityText: 'sin²θ + cos²θ = 1',
    identityLatex: '\\sin^{2}\\theta + \\cos^{2}\\theta = 1',
    positiveExpr: 'sin θ / √(1 − sin²θ)',
    negativeExpr: '−sin θ / √(1 − sin²θ)',
    positiveLatex: '\\frac{\\sin\\theta}{\\sqrt{1 - \\sin^{2}\\theta}}',
    negativeLatex: '-\\frac{\\sin\\theta}{\\sqrt{1 - \\sin^{2}\\theta}}',
    wrongSignRadicand: 'sin θ / √(1 + sin²θ)',
    noSquareRadicand: 'sin θ / √(1 − sin θ)',
    solveLineLatex: '\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta},\\quad \\cos^{2}\\theta = 1 - \\sin^{2}\\theta',
  },
  {
    targetFn: 'cot',
    givenFn: 'cos',
    quadrants: [1, 4],
    identityText: 'sin²θ + cos²θ = 1',
    identityLatex: '\\sin^{2}\\theta + \\cos^{2}\\theta = 1',
    positiveExpr: 'cos θ / √(1 − cos²θ)',
    negativeExpr: '−cos θ / √(1 − cos²θ)',
    positiveLatex: '\\frac{\\cos\\theta}{\\sqrt{1 - \\cos^{2}\\theta}}',
    negativeLatex: '-\\frac{\\cos\\theta}{\\sqrt{1 - \\cos^{2}\\theta}}',
    wrongSignRadicand: 'cos θ / √(1 + cos²θ)',
    noSquareRadicand: 'cos θ / √(1 − cos θ)',
    solveLineLatex: '\\cot\\theta = \\frac{\\cos\\theta}{\\sin\\theta},\\quad \\sin^{2}\\theta = 1 - \\cos^{2}\\theta',
  },
]

const QUADRANT_ROMAN: Record<Quadrant, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

function signOfFnInQuadrant(fn: TrigFn, q: Quadrant): '+' | '−' {
  if (q === 1) return '+'
  if (q === 2) return fn === 'sin' || fn === 'csc' ? '+' : '−'
  if (q === 3) return fn === 'tan' || fn === 'cot' ? '+' : '−'
  return fn === 'cos' || fn === 'sec' ? '+' : '−'
}

export function buildExpressSpec(targetFn: TrigFn, givenFn: TrigFn, quadrant: Quadrant): ExpressPairSpec {
  const pair = EXPRESS_PAIRS.find((p) => p.targetFn === targetFn && p.givenFn === givenFn)
  if (!pair) throw new Error(`Unsupported express pair: ${targetFn} in terms of ${givenFn}`)
  const signText = signOfFnInQuadrant(targetFn, quadrant)
  const answerText = signText === '+' ? pair.positiveExpr : pair.negativeExpr
  const answerLatex = signText === '+' ? pair.positiveLatex : pair.negativeLatex
  return {
    targetFn,
    givenFn,
    quadrant,
    identityText: pair.identityText,
    signText,
    answerText,
    answerLatex,
  }
}

function toTrigPartGrade(g: ExpressPartGrade): TrigPartGrade {
  if (g.verdict === 'correct') return { verdict: 'correct', message: 'Right.' }
  if (g.verdict === 'mistake') return { verdict: 'mistake', mistake: g.id, witness: g.witness }
  return g
}

export function gradeTiPart(answer: TrigIdentitiesAnswer, stageId: string, raw: string): TrigPartGrade {
  const stage = answer.stages.find((s) => s.id === stageId)
  if (!stage) return { verdict: 'invalid', message: 'Unknown part.' }
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { verdict: 'invalid', message: 'Choose or type an answer first.' }

  if (stage.kind === 'choice') {
    if (trimmed === stage.answerText) return { verdict: 'correct', message: 'Right.' }
    const trap = stage.traps.find((t) => t.text === trimmed)
    if (trap) return { verdict: 'mistake', mistake: trap.id, witness: trap.witness }
    return { verdict: 'wrong', message: stage.wrongNote }
  }

  if (answer.expressSpec) {
    return toTrigPartGrade(gradeTiExpressExpr(answer.expressSpec, trimmed))
  }
  return { verdict: 'wrong', message: stage.wrongNote }
}

function generateExpress(seed: number, knobs: DifficultyKnobs): ProblemInstance {
  const rng = makeRng(mixSeed(seed, 0x65787072))
  // Pick quadrant uniformly first so each quadrant is ~25% (within 15–35%)
  const quadrants: readonly Quadrant[] = [1, 2, 3, 4]
  const quadrant = quadrants[Math.floor(rng() * quadrants.length)]!
  const validPairs = EXPRESS_PAIRS.filter((p) => p.quadrants.includes(quadrant))
  const pair = validPairs[Math.floor(rng() * validPairs.length)]!
  const spec = buildExpressSpec(pair.targetFn, pair.givenFn, quadrant)
  const qRoman = QUADRANT_ROMAN[quadrant]

  const wrongIdText =
    pair.identityText === 'sin²θ + cos²θ = 1'
      ? 'sin²θ − cos²θ = 1'
      : pair.identityText === '1 + tan²θ = sec²θ'
        ? '1 − tan²θ = sec²θ'
        : '1 − cot²θ = csc²θ'

  const identityStage: TrigPart = {
    id: 'identity',
    kind: 'choice',
    label: 'Pythagorean identity',
    ask: `Which Pythagorean identity ties $\\${pair.targetFn}\\theta$ and $\\${pair.givenFn}\\theta$ together?`,
    formatHint: 'Pick one of the Pythagorean identities.',
    choices: [
      { value: 'sin²θ + cos²θ = 1', label: 'sin²θ + cos²θ = 1' },
      { value: '1 + tan²θ = sec²θ', label: '1 + tan²θ = sec²θ' },
      { value: '1 + cot²θ = csc²θ', label: '1 + cot²θ = csc²θ' },
      { value: wrongIdText, label: wrongIdText },
    ],
    nudge: 'Match the pair of functions to one of the three Pythagorean identities.',
    ruleCard: 'ti-express',
    reveal: [`The Pythagorean identity that connects this pair is $${pair.identityLatex}$.`],
    answerText: pair.identityText,
    forms: [pair.identityText],
    check: { kind: 'choice' },
    wrongNote: 'Pick the Pythagorean identity that uses these functions.',
    traps: [
      {
        id: 'trig_pythag_sign',
        text: wrongIdText,
        witness: `Check the sign in the Pythagorean identity: ${pair.identityText}.`,
      },
    ],
  }

  const wrongSign: '+' | '−' = spec.signText === '+' ? '−' : '+'
  const signStage: TrigPart = {
    id: 'sign',
    kind: 'choice',
    label: `Sign in Quadrant ${qRoman}`,
    ask: `What is the sign of $\\${pair.targetFn}\\theta$ in Quadrant ${qRoman}?`,
    formatHint: 'Choose Positive (+) or Negative (−).',
    choices: [
      { value: '+', label: 'Positive (+)' },
      { value: '−', label: 'Negative (−)' },
    ],
    nudge: 'Use All Students Take Calculus to check which functions are positive in each quadrant.',
    ruleCard: 'ti-express',
    reveal: [
      `In Quadrant ${qRoman}, $\\${pair.targetFn}\\theta$ is ${spec.signText === '+' ? 'positive ($+$)' : 'negative ($-$)'}.`,
    ],
    answerText: spec.signText,
    forms: [spec.signText],
    check: { kind: 'choice' },
    wrongNote: `Check whether ${pair.targetFn} θ is positive or negative in Quadrant ${qRoman}.`,
    traps: [
      {
        id: 'trig_identity_sign_lost',
        text: wrongSign,
        witness: `In Quadrant ${qRoman}, ${pair.targetFn} θ is ${spec.signText === '+' ? 'positive' : 'negative'}.`,
      },
    ],
  }

  const oppSignExpr = spec.signText === '+' ? pair.negativeExpr : pair.positiveExpr
  const signedWrongPythag = spec.signText === '+' ? pair.wrongSignRadicand : `−${pair.wrongSignRadicand}`
  const signedNoSquare = spec.signText === '+' ? pair.noSquareRadicand : `−${pair.noSquareRadicand}`

  const exprTraps = [
    {
      id: 'trig_identity_sign_lost' as const,
      text: oppSignExpr,
      witness: `In Quadrant ${qRoman}, ${pair.targetFn} θ is ${spec.signText === '+' ? 'positive' : 'negative'}.`,
    },
    {
      id: 'trig_pythag_sign' as const,
      text: signedWrongPythag,
      witness: `Check the sign inside the radical from ${pair.identityText}.`,
    },
    {
      id: 'trig_pythag_no_square' as const,
      text: signedNoSquare,
      witness: `Keep the square on ${pair.givenFn}²θ inside the radical.`,
    },
  ]

  const pickedTrap = exprTraps[Math.floor(rng() * exprTraps.length)]!

  const exprStage: TrigPart = {
    id: 'expr',
    kind: 'function',
    label: `${pair.targetFn} θ in terms of ${pair.givenFn} θ`,
    ask: `Write $\\${pair.targetFn}\\theta$ in terms of $\\${pair.givenFn}\\theta$ for $\\theta$ in Quadrant ${qRoman}.`,
    formatHint: `Write an exact expression in ${pair.givenFn} θ using √(...) for the square root.`,
    nudge: `Solve $${pair.identityLatex}$ for $\\${pair.targetFn}\\theta$ and attach the Quadrant ${qRoman} sign.`,
    ruleCard: 'ti-express',
    reveal: [
      `From $${pair.solveLineLatex}$, taking the square root in Quadrant ${qRoman} gives $\\${pair.targetFn}\\theta = ${spec.answerLatex}$.`,
    ],
    answerText: spec.answerText,
    forms: [spec.answerText, spec.answerText.replace(/\s+/g, '')],
    check: {
      kind: 'function',
      answer: spec.answerText,
      variable: 't',
      exactAt: [],
      samples: { lo: 0.2, hi: 1.3, n: 12 },
      bare: true,
    },
    wrongNote: `Solve ${pair.identityText} for ${pair.targetFn} θ and use the Quadrant ${qRoman} sign.`,
    traps: exprTraps,
  }

  const stages = [identityStage, signStage, exprStage]
  const reveal = stages.flatMap((s) => s.reveal)
  const statementText = `Write ${pair.targetFn} θ in terms of ${pair.givenFn} θ, if θ is in Quadrant ${qRoman}.`
  const prompt = `Write $\\${pair.targetFn}\\theta$ in terms of $\\${pair.givenFn}\\theta$, if $\\theta$ is in Quadrant ${qRoman}.`

  const answer: TrigIdentitiesAnswer = {
    type: 'trigIdentities',
    question: 'express',
    prompt,
    expr: `${pair.targetFn} θ`,
    path: [spec.answerText],
    answerText: spec.answerText,
    answerLatex: spec.answerLatex,
    formatHint: exprStage.formatHint,
    figure: NO_FIGURE,
    stages,
    expectedDisplay: `${pair.identityText}; ${spec.signText}; ${spec.answerText}`,
    nudge: exprStage.nudge,
    ruleCard: 'ti-express',
    ruleCards: ['ti-express', 'ti-fundamental'],
    reveal,
    trap: pickedTrap.id,
    trapStage: 'expr',
    trapAnswer: pickedTrap.text,
    expressSpec: spec,
  }

  // Self-verify promised trap at generation
  const checkTrap = gradeTiPart(answer, 'expr', pickedTrap.text)
  if (checkTrap.verdict !== 'mistake' || checkTrap.mistake !== pickedTrap.id) {
    throw new Error(`ti.express trap check failed for ${statementText}: expected ${pickedTrap.id}, got ${JSON.stringify(checkTrap)}`)
  }

  return {
    id: makeProblemId('trigIdentities', 'ti.express', GEN_VERSION, seed),
    moduleId: 'trigIdentities',
    templateId: 'ti.express',
    skill: 'ti.express',
    genVersion: GEN_VERSION,
    seed,
    knobs,
    kind: 'trigIdentities',
    title: 'Write one trig function in terms of another',
    instructions: 'Choose the Pythagorean identity and the sign in the given quadrant, then write the exact expression in θ.',
    statementText,
    vars: ['x'],
    start: null,
    canonical: [],
    answer,
    graph: EMPTY_GRAPH,
    calc: EMPTY_CALC,
    params: {
      targetFn: pair.targetFn,
      givenFn: pair.givenFn,
      quadrant,
    },
  }
}

// ---------------------------------------------------------------------------
// 2. ti.simplify (STEP BY STEP)
// ---------------------------------------------------------------------------

interface StepSpecItem {
  expr: string
  target?: string
  steps: { text: string; why: string }[]
  nudge: string
}

const SIMPLIFY_POOL: readonly StepSpecItem[] = [
  {
    expr: 'tan x cos x',
    steps: [
      { text: '(sin x / cos x) cos x', why: 'Use the quotient identity tan x = sin x / cos x.' },
      { text: 'sin x', why: 'Cancel the common factor cos x.' },
    ],
    nudge: 'Rewrite tan x in terms of sin x and cos x using the quotient identity.',
  },
  {
    expr: 'cot x sin x',
    steps: [
      { text: '(cos x / sin x) sin x', why: 'Use the quotient identity cot x = cos x / sin x.' },
      { text: 'cos x', why: 'Cancel the common factor sin x.' },
    ],
    nudge: 'Rewrite cot x in terms of cos x and sin x using the quotient identity.',
  },
  {
    expr: 'sec x cot x sin x',
    steps: [
      { text: '(1 / cos x)(cos x / sin x) sin x', why: 'Rewrite sec x and cot x in terms of sin x and cos x.' },
      { text: '1', why: 'Cancel cos x and sin x in the numerator and denominator.' },
    ],
    nudge: 'Rewrite sec x and cot x in terms of sin x and cos x.',
  },
  {
    expr: 'csc x tan x cos x',
    steps: [
      { text: '(1 / sin x)(sin x / cos x) cos x', why: 'Rewrite csc x and tan x in terms of sin x and cos x.' },
      { text: '1', why: 'Cancel sin x and cos x in the numerator and denominator.' },
    ],
    nudge: 'Rewrite csc x and tan x in terms of sin x and cos x.',
  },
  {
    expr: '(1 − cos²x) / sin x',
    steps: [
      { text: 'sin²x / sin x', why: 'Use the Pythagorean identity 1 − cos²x = sin²x.' },
      { text: 'sin x', why: 'Cancel one factor of sin x.' },
    ],
    nudge: 'Replace 1 − cos²x using the Pythagorean identity sin²x + cos²x = 1.',
  },
  {
    expr: '(1 − sin²x) / cos x',
    steps: [
      { text: 'cos²x / cos x', why: 'Use the Pythagorean identity 1 − sin²x = cos²x.' },
      { text: 'cos x', why: 'Cancel one factor of cos x.' },
    ],
    nudge: 'Replace 1 − sin²x using the Pythagorean identity sin²x + cos²x = 1.',
  },
  {
    expr: 'cot x sec x',
    steps: [
      { text: '(cos x / sin x)(1 / cos x)', why: 'Rewrite cot x and sec x in terms of sin x and cos x.' },
      { text: '1 / sin x', why: 'Cancel the common factor cos x.' },
      { text: 'csc x', why: 'Use the reciprocal identity 1 / sin x = csc x.' },
    ],
    nudge: 'Rewrite cot x and sec x in terms of sin x and cos x, then cancel.',
  },
  {
    expr: 'tan x csc x',
    steps: [
      { text: '(sin x / cos x)(1 / sin x)', why: 'Rewrite tan x and csc x in terms of sin x and cos x.' },
      { text: '1 / cos x', why: 'Cancel the common factor sin x.' },
      { text: 'sec x', why: 'Use the reciprocal identity 1 / cos x = sec x.' },
    ],
    nudge: 'Rewrite tan x and csc x in terms of sin x and cos x, then cancel.',
  },
  {
    expr: 'csc²x − cot²x',
    steps: [
      { text: '(1 + cot²x) − cot²x', why: 'Use the Pythagorean identity csc²x = 1 + cot²x.' },
      { text: '1', why: 'Combine the cot²x terms.' },
    ],
    nudge: 'Use the Pythagorean identity that connects csc²x and cot²x.',
  },
  {
    expr: 'sec²x − tan²x',
    steps: [
      { text: '(1 + tan²x) − tan²x', why: 'Use the Pythagorean identity sec²x = 1 + tan²x.' },
      { text: '1', why: 'Combine the tan²x terms.' },
    ],
    nudge: 'Use the Pythagorean identity that connects sec²x and tan²x.',
  },
  {
    expr: 'cos x + sin x tan x',
    steps: [
      { text: 'cos x + sin x (sin x / cos x)', why: 'Rewrite tan x as sin x / cos x.' },
      { text: '(cos²x + sin²x) / cos x', why: 'Combine over the common denominator cos x.' },
      { text: '1 / cos x', why: 'Use the Pythagorean identity cos²x + sin²x = 1.' },
      { text: 'sec x', why: 'Use the reciprocal identity 1 / cos x = sec x.' },
    ],
    nudge: 'Rewrite tan x as sin x / cos x, then combine the two terms over the common denominator cos x.',
  },
  {
    expr: 'sin x + cos x cot x',
    steps: [
      { text: 'sin x + cos x (cos x / sin x)', why: 'Rewrite cot x as cos x / sin x.' },
      { text: '(sin²x + cos²x) / sin x', why: 'Combine over the common denominator sin x.' },
      { text: '1 / sin x', why: 'Use the Pythagorean identity sin²x + cos²x = 1.' },
      { text: 'csc x', why: 'Use the reciprocal identity 1 / sin x = csc x.' },
    ],
    nudge: 'Rewrite cot x as cos x / sin x, then combine the two terms over the common denominator sin x.',
  },
  {
    expr: 'cos²x (1 + tan²x)',
    steps: [
      { text: 'cos²x sec²x', why: 'Use the Pythagorean identity 1 + tan²x = sec²x.' },
      { text: 'cos²x (1 / cos²x)', why: 'Use the reciprocal identity sec²x = 1 / cos²x.' },
      { text: '1', why: 'Multiply cos²x by its reciprocal.' },
    ],
    nudge: 'Replace 1 + tan²x using a Pythagorean identity first.',
  },
  {
    expr: 'sin²x (1 + cot²x)',
    steps: [
      { text: 'sin²x csc²x', why: 'Use the Pythagorean identity 1 + cot²x = csc²x.' },
      { text: 'sin²x (1 / sin²x)', why: 'Use the reciprocal identity csc²x = 1 / sin²x.' },
      { text: '1', why: 'Multiply sin²x by its reciprocal.' },
    ],
    nudge: 'Replace 1 + cot²x using a Pythagorean identity first.',
  },
  {
    expr: 'sin x sec x',
    steps: [
      { text: 'sin x (1 / cos x)', why: 'Use the reciprocal identity sec x = 1 / cos x.' },
      { text: 'sin x / cos x', why: 'Multiply to form a single quotient.' },
      { text: 'tan x', why: 'Use the quotient identity sin x / cos x = tan x.' },
    ],
    nudge: 'Rewrite sec x using its reciprocal identity.',
  },
  {
    expr: 'cos x csc x',
    steps: [
      { text: 'cos x (1 / sin x)', why: 'Use the reciprocal identity csc x = 1 / sin x.' },
      { text: 'cos x / sin x', why: 'Multiply to form a single quotient.' },
      { text: 'cot x', why: 'Use the quotient identity cos x / sin x = cot x.' },
    ],
    nudge: 'Rewrite csc x using its reciprocal identity.',
  },
  {
    expr: '(sec²x − 1) / tan x',
    steps: [
      { text: 'tan²x / tan x', why: 'Use the Pythagorean identity sec²x − 1 = tan²x.' },
      { text: 'tan x', why: 'Cancel one factor of tan x.' },
    ],
    nudge: 'Replace sec²x − 1 using the Pythagorean identity 1 + tan²x = sec²x.',
  },
  {
    expr: '(csc²x − 1) / cot x',
    steps: [
      { text: 'cot²x / cot x', why: 'Use the Pythagorean identity csc²x − 1 = cot²x.' },
      { text: 'cot x', why: 'Cancel one factor of cot x.' },
    ],
    nudge: 'Replace csc²x − 1 using the Pythagorean identity 1 + cot²x = csc²x.',
  },
  {
    expr: 'sec x / csc x',
    steps: [
      { text: '(1 / cos x) / (1 / sin x)', why: 'Rewrite sec x and csc x using reciprocal identities.' },
      { text: 'sin x / cos x', why: 'Multiply by the reciprocal of the denominator.' },
      { text: 'tan x', why: 'Use the quotient identity sin x / cos x = tan x.' },
    ],
    nudge: 'Rewrite sec x and csc x in terms of cos x and sin x.',
  },
  {
    expr: 'csc x / sec x',
    steps: [
      { text: '(1 / sin x) / (1 / cos x)', why: 'Rewrite csc x and sec x using reciprocal identities.' },
      { text: 'cos x / sin x', why: 'Multiply by the reciprocal of the denominator.' },
      { text: 'cot x', why: 'Use the quotient identity cos x / sin x = cot x.' },
    ],
    nudge: 'Rewrite csc x and sec x in terms of sin x and cos x.',
  },
  {
    expr: '(sec x − cos x) cot x',
    steps: [
      { text: '((1 − cos²x) / cos x)(cos x / sin x)', why: 'Rewrite in terms of sin x and cos x over a common denominator.' },
      { text: 'sin²x / sin x', why: 'Use 1 − cos²x = sin²x and cancel cos x.' },
      { text: 'sin x', why: 'Cancel one factor of sin x.' },
    ],
    nudge: 'Rewrite sec x and cot x in terms of sin x and cos x.',
  },
  {
    expr: '(csc x − sin x) tan x',
    steps: [
      { text: '((1 − sin²x) / sin x)(sin x / cos x)', why: 'Rewrite in terms of sin x and cos x over a common denominator.' },
      { text: 'cos²x / cos x', why: 'Use 1 − sin²x = cos²x and cancel sin x.' },
      { text: 'cos x', why: 'Cancel one factor of cos x.' },
    ],
    nudge: 'Rewrite csc x and tan x in terms of sin x and cos x.',
  },
  {
    expr: 'tan²x cos²x + cos²x',
    steps: [
      { text: 'sin²x + cos²x', why: 'Use tan²x cos²x = (sin²x / cos²x) cos²x = sin²x.' },
      { text: '1', why: 'Use the Pythagorean identity sin²x + cos²x = 1.' },
    ],
    nudge: 'Simplify tan²x cos²x first, or factor out cos²x.',
  },
  {
    expr: 'cot²x sin²x + sin²x',
    steps: [
      { text: 'cos²x + sin²x', why: 'Use cot²x sin²x = (cos²x / sin²x) sin²x = cos²x.' },
      { text: '1', why: 'Use the Pythagorean identity cos²x + sin²x = 1.' },
    ],
    nudge: 'Simplify cot²x sin²x first, or factor out sin²x.',
  },
  {
    expr: '(1 − cos²x) csc x',
    steps: [
      { text: 'sin²x (1 / sin x)', why: 'Use 1 − cos²x = sin²x and csc x = 1 / sin x.' },
      { text: 'sin x', why: 'Cancel one factor of sin x.' },
    ],
    nudge: 'Replace 1 − cos²x using the Pythagorean identity and rewrite csc x as 1 / sin x.',
  },
  {
    expr: '(1 − sin²x) sec x',
    steps: [
      { text: 'cos²x (1 / cos x)', why: 'Use 1 − sin²x = cos²x and sec x = 1 / cos x.' },
      { text: 'cos x', why: 'Cancel one factor of cos x.' },
    ],
    nudge: 'Replace 1 − sin²x using the Pythagorean identity and rewrite sec x as 1 / cos x.',
  },
  {
    expr: '(sec²x − 1) cot x',
    steps: [
      { text: 'tan²x (1 / tan x)', why: 'Use sec²x − 1 = tan²x and cot x = 1 / tan x.' },
      { text: 'tan x', why: 'Cancel one factor of tan x.' },
    ],
    nudge: 'Replace sec²x − 1 using the Pythagorean identity 1 + tan²x = sec²x.',
  },
  {
    expr: '(csc²x − 1) tan x',
    steps: [
      { text: 'cot²x (1 / cot x)', why: 'Use csc²x − 1 = cot²x and tan x = 1 / cot x.' },
      { text: 'cot x', why: 'Cancel one factor of cot x.' },
    ],
    nudge: 'Replace csc²x − 1 using the Pythagorean identity 1 + cot²x = csc²x.',
  },
]

// ---------------------------------------------------------------------------
// 3. ti.verify (STEP BY STEP)
// ---------------------------------------------------------------------------

const VERIFY_POOL: readonly StepSpecItem[] = [
  {
    expr: 'sec x − cos x',
    target: 'sin x tan x',
    steps: [
      { text: '(1 / cos x) − cos x', why: 'Rewrite sec x as 1 / cos x.' },
      { text: '(1 − cos²x) / cos x', why: 'Combine over the common denominator cos x.' },
      { text: 'sin²x / cos x', why: 'Use the Pythagorean identity 1 − cos²x = sin²x.' },
      { text: 'sin x tan x', why: 'Factor sin²x / cos x as sin x (sin x / cos x) = sin x tan x.' },
    ],
    nudge: 'Rewrite sec x as 1 / cos x and combine the two terms over the common denominator cos x.',
  },
  {
    expr: 'csc x − sin x',
    target: 'cos x cot x',
    steps: [
      { text: '(1 / sin x) − sin x', why: 'Rewrite csc x as 1 / sin x.' },
      { text: '(1 − sin²x) / sin x', why: 'Combine over the common denominator sin x.' },
      { text: 'cos²x / sin x', why: 'Use the Pythagorean identity 1 − sin²x = cos²x.' },
      { text: 'cos x cot x', why: 'Factor cos²x / sin x as cos x (cos x / sin x) = cos x cot x.' },
    ],
    nudge: 'Rewrite csc x as 1 / sin x and combine the two terms over the common denominator sin x.',
  },
  {
    expr: 'tan x + cot x',
    target: 'sec x csc x',
    steps: [
      { text: '(sin x / cos x) + (cos x / sin x)', why: 'Rewrite tan x and cot x using quotient identities.' },
      { text: '(sin²x + cos²x) / (sin x cos x)', why: 'Combine the fractions over the common denominator sin x cos x.' },
      { text: '1 / (sin x cos x)', why: 'Use the Pythagorean identity sin²x + cos²x = 1.' },
      { text: 'sec x csc x', why: 'Use the reciprocal identities 1 / cos x = sec x and 1 / sin x = csc x.' },
    ],
    nudge: 'Rewrite tan x and cot x in terms of sin x and cos x, then find a common denominator.',
  },
  {
    expr: '(1 + sin x)(1 − sin x)',
    target: 'cos²x',
    steps: [
      { text: '1 − sin²x', why: 'Multiply the sum and difference to get a difference of squares.' },
      { text: 'cos²x', why: 'Use the Pythagorean identity 1 − sin²x = cos²x.' },
    ],
    nudge: 'Multiply out (1 + sin x)(1 − sin x) first.',
  },
  {
    expr: '(1 + cos x)(1 − cos x)',
    target: 'sin²x',
    steps: [
      { text: '1 − cos²x', why: 'Multiply the sum and difference to get a difference of squares.' },
      { text: 'sin²x', why: 'Use the Pythagorean identity 1 − cos²x = sin²x.' },
    ],
    nudge: 'Multiply out (1 + cos x)(1 − cos x) first.',
  },
  {
    expr: '(sec²x − 1) / sec²x',
    target: 'sin²x',
    steps: [
      { text: 'tan²x / sec²x', why: 'Use the Pythagorean identity sec²x − 1 = tan²x.' },
      { text: '(sin²x / cos²x) / (1 / cos²x)', why: 'Rewrite tan²x and sec²x in terms of sin x and cos x.' },
      { text: 'sin²x', why: 'Cancel the common denominator cos²x.' },
    ],
    nudge: 'Replace sec²x − 1 using the Pythagorean identity 1 + tan²x = sec²x.',
  },
  {
    expr: '(csc²x − 1) / csc²x',
    target: 'cos²x',
    steps: [
      { text: 'cot²x / csc²x', why: 'Use the Pythagorean identity csc²x − 1 = cot²x.' },
      { text: '(cos²x / sin²x) / (1 / sin²x)', why: 'Rewrite cot²x and csc²x in terms of cos x and sin x.' },
      { text: 'cos²x', why: 'Cancel the common denominator sin²x.' },
    ],
    nudge: 'Replace csc²x − 1 using the Pythagorean identity 1 + cot²x = csc²x.',
  },
  {
    expr: '(sec x + 1)(sec x − 1)',
    target: 'tan²x',
    steps: [
      { text: 'sec²x − 1', why: 'Multiply the sum and difference to get sec²x − 1.' },
      { text: 'tan²x', why: 'Use the Pythagorean identity sec²x − 1 = tan²x.' },
    ],
    nudge: 'Multiply out (sec x + 1)(sec x − 1) first.',
  },
  {
    expr: '(csc x + 1)(csc x − 1)',
    target: 'cot²x',
    steps: [
      { text: 'csc²x − 1', why: 'Multiply the sum and difference to get csc²x − 1.' },
      { text: 'cot²x', why: 'Use the Pythagorean identity csc²x − 1 = cot²x.' },
    ],
    nudge: 'Multiply out (csc x + 1)(csc x − 1) first.',
  },
  {
    expr: 'sin x (csc x − sin x)',
    target: 'cos²x',
    steps: [
      { text: 'sin x (1 / sin x) − sin²x', why: 'Distribute sin x and rewrite csc x as 1 / sin x.' },
      { text: '1 − sin²x', why: 'Simplify sin x (1 / sin x) to 1.' },
      { text: 'cos²x', why: 'Use the Pythagorean identity 1 − sin²x = cos²x.' },
    ],
    nudge: 'Rewrite csc x as 1 / sin x and distribute sin x.',
  },
  {
    expr: 'cos x (sec x − cos x)',
    target: 'sin²x',
    steps: [
      { text: 'cos x (1 / cos x) − cos²x', why: 'Distribute cos x and rewrite sec x as 1 / cos x.' },
      { text: '1 − cos²x', why: 'Simplify cos x (1 / cos x) to 1.' },
      { text: 'sin²x', why: 'Use the Pythagorean identity 1 − cos²x = sin²x.' },
    ],
    nudge: 'Rewrite sec x as 1 / cos x and distribute cos x.',
  },
  {
    expr: 'sin²x + tan²x sin²x',
    target: 'tan²x',
    steps: [
      { text: 'sin²x (1 + tan²x)', why: 'Factor out the common factor sin²x.' },
      { text: 'sin²x sec²x', why: 'Use the Pythagorean identity 1 + tan²x = sec²x.' },
      { text: 'sin²x / cos²x', why: 'Rewrite sec²x as 1 / cos²x.' },
      { text: 'tan²x', why: 'Use the quotient identity sin²x / cos²x = tan²x.' },
    ],
    nudge: 'Factor out sin²x from both terms on the left side.',
  },
  {
    expr: 'cos²x + cot²x cos²x',
    target: 'cot²x',
    steps: [
      { text: 'cos²x (1 + cot²x)', why: 'Factor out the common factor cos²x.' },
      { text: 'cos²x csc²x', why: 'Use the Pythagorean identity 1 + cot²x = csc²x.' },
      { text: 'cos²x / sin²x', why: 'Rewrite csc²x as 1 / sin²x.' },
      { text: 'cot²x', why: 'Use the quotient identity cos²x / sin²x = cot²x.' },
    ],
    nudge: 'Factor out cos²x from both terms on the left side.',
  },
  {
    expr: '(1 + tan²x) / csc²x',
    target: 'tan²x',
    steps: [
      { text: 'sec²x / csc²x', why: 'Use the Pythagorean identity 1 + tan²x = sec²x.' },
      { text: '(1 / cos²x) / (1 / sin²x)', why: 'Rewrite sec²x and csc²x using reciprocal identities.' },
      { text: 'sin²x / cos²x', why: 'Multiply by the reciprocal of the denominator.' },
      { text: 'tan²x', why: 'Use the quotient identity sin²x / cos²x = tan²x.' },
    ],
    nudge: 'Replace 1 + tan²x with sec²x, then rewrite in terms of sin x and cos x.',
  },
  {
    expr: '(1 + cot²x) / sec²x',
    target: 'cot²x',
    steps: [
      { text: 'csc²x / sec²x', why: 'Use the Pythagorean identity 1 + cot²x = csc²x.' },
      { text: '(1 / sin²x) / (1 / cos²x)', why: 'Rewrite csc²x and sec²x using reciprocal identities.' },
      { text: 'cos²x / sin²x', why: 'Multiply by the reciprocal of the denominator.' },
      { text: 'cot²x', why: 'Use the quotient identity cos²x / sin²x = cot²x.' },
    ],
    nudge: 'Replace 1 + cot²x with csc²x, then rewrite in terms of sin x and cos x.',
  },
  {
    expr: 'sec²x + csc²x',
    target: 'sec²x csc²x',
    steps: [
      { text: '(1 / cos²x) + (1 / sin²x)', why: 'Rewrite sec²x and csc²x using reciprocal identities.' },
      { text: '(sin²x + cos²x) / (sin²x cos²x)', why: 'Combine over the common denominator sin²x cos²x.' },
      { text: '1 / (sin²x cos²x)', why: 'Use the Pythagorean identity sin²x + cos²x = 1.' },
      { text: 'sec²x csc²x', why: 'Use the reciprocal identities 1 / cos²x = sec²x and 1 / sin²x = csc²x.' },
    ],
    nudge: 'Rewrite sec²x and csc²x in terms of cos²x and sin²x, then combine the fractions.',
  },
  {
    expr: '(1 − cos²x) / tan x',
    target: 'sin x cos x',
    steps: [
      { text: 'sin²x / tan x', why: 'Use the Pythagorean identity 1 − cos²x = sin²x.' },
      { text: 'sin²x / (sin x / cos x)', why: 'Rewrite tan x as sin x / cos x.' },
      { text: 'sin x cos x', why: 'Multiply by cos x / sin x and cancel one factor of sin x.' },
    ],
    nudge: 'Replace 1 − cos²x with sin²x and rewrite tan x as sin x / cos x.',
  },
  {
    expr: '(1 − sin²x) / cot x',
    target: 'sin x cos x',
    steps: [
      { text: 'cos²x / cot x', why: 'Use the Pythagorean identity 1 − sin²x = cos²x.' },
      { text: 'cos²x / (cos x / sin x)', why: 'Rewrite cot x as cos x / sin x.' },
      { text: 'sin x cos x', why: 'Multiply by sin x / cos x and cancel one factor of cos x.' },
    ],
    nudge: 'Replace 1 − sin²x with cos²x and rewrite cot x as cos x / sin x.',
  },
  {
    expr: 'sec x − sec x sin²x',
    target: 'cos x',
    steps: [
      { text: 'sec x (1 − sin²x)', why: 'Factor out the common factor sec x.' },
      { text: 'sec x cos²x', why: 'Use the Pythagorean identity 1 − sin²x = cos²x.' },
      { text: '(1 / cos x) cos²x', why: 'Rewrite sec x as 1 / cos x.' },
      { text: 'cos x', why: 'Cancel one factor of cos x.' },
    ],
    nudge: 'Factor sec x out of both terms on the left side.',
  },
  {
    expr: 'csc x − csc x cos²x',
    target: 'sin x',
    steps: [
      { text: 'csc x (1 − cos²x)', why: 'Factor out the common factor csc x.' },
      { text: 'csc x sin²x', why: 'Use the Pythagorean identity 1 − cos²x = sin²x.' },
      { text: '(1 / sin x) sin²x', why: 'Rewrite csc x as 1 / sin x.' },
      { text: 'sin x', why: 'Cancel one factor of sin x.' },
    ],
    nudge: 'Factor csc x out of both terms on the left side.',
  },
  {
    expr: '(cos x / sin x) + (sin x / cos x)',
    target: 'sec x csc x',
    steps: [
      { text: '(cos²x + sin²x) / (sin x cos x)', why: 'Combine the two fractions over the common denominator sin x cos x.' },
      { text: '1 / (sin x cos x)', why: 'Use the Pythagorean identity cos²x + sin²x = 1.' },
      { text: 'sec x csc x', why: 'Use the reciprocal identities 1 / cos x = sec x and 1 / sin x = csc x.' },
    ],
    nudge: 'Combine the two fractions over the common denominator sin x cos x.',
  },
  {
    expr: 'sin x tan x + cos x',
    target: 'sec x',
    steps: [
      { text: 'sin x (sin x / cos x) + cos x', why: 'Rewrite tan x as sin x / cos x.' },
      { text: '(sin²x + cos²x) / cos x', why: 'Combine over the common denominator cos x.' },
      { text: '1 / cos x', why: 'Use the Pythagorean identity sin²x + cos²x = 1.' },
      { text: 'sec x', why: 'Use the reciprocal identity 1 / cos x = sec x.' },
    ],
    nudge: 'Rewrite tan x as sin x / cos x and combine over the common denominator cos x.',
  },
  {
    expr: 'cos x cot x + sin x',
    target: 'csc x',
    steps: [
      { text: 'cos x (cos x / sin x) + sin x', why: 'Rewrite cot x as cos x / sin x.' },
      { text: '(cos²x + sin²x) / sin x', why: 'Combine over the common denominator sin x.' },
      { text: '1 / sin x', why: 'Use the Pythagorean identity cos²x + sin²x = 1.' },
      { text: 'csc x', why: 'Use the reciprocal identity 1 / sin x = csc x.' },
    ],
    nudge: 'Rewrite cot x as cos x / sin x and combine over the common denominator sin x.',
  },
  {
    expr: 'tan x (cot x + tan x)',
    target: 'sec²x',
    steps: [
      { text: 'tan x (1 / tan x) + tan²x', why: 'Distribute tan x and rewrite cot x as 1 / tan x.' },
      { text: '1 + tan²x', why: 'Simplify tan x (1 / tan x) to 1.' },
      { text: 'sec²x', why: 'Use the Pythagorean identity 1 + tan²x = sec²x.' },
    ],
    nudge: 'Distribute tan x across the parentheses.',
  },
  {
    expr: 'cot x (tan x + cot x)',
    target: 'csc²x',
    steps: [
      { text: 'cot x (1 / cot x) + cot²x', why: 'Distribute cot x and rewrite tan x as 1 / cot x.' },
      { text: '1 + cot²x', why: 'Simplify cot x (1 / cot x) to 1.' },
      { text: 'csc²x', why: 'Use the Pythagorean identity 1 + cot²x = csc²x.' },
    ],
    nudge: 'Distribute cot x across the parentheses.',
  },
  {
    expr: 'tan²x − sin²x',
    target: 'tan²x sin²x',
    steps: [
      { text: '(sin²x / cos²x) − sin²x', why: 'Rewrite tan²x as sin²x / cos²x.' },
      { text: 'sin²x (sec²x − 1)', why: 'Factor out sin²x and use 1 / cos²x = sec²x.' },
      { text: 'tan²x sin²x', why: 'Use the Pythagorean identity sec²x − 1 = tan²x.' },
    ],
    nudge: 'Rewrite tan²x in terms of sin²x and cos²x, then factor out sin²x.',
  },
  {
    expr: 'cot²x − cos²x',
    target: 'cot²x cos²x',
    steps: [
      { text: '(cos²x / sin²x) − cos²x', why: 'Rewrite cot²x as cos²x / sin²x.' },
      { text: 'cos²x (csc²x − 1)', why: 'Factor out cos²x and use 1 / sin²x = csc²x.' },
      { text: 'cot²x cos²x', why: 'Use the Pythagorean identity csc²x − 1 = cot²x.' },
    ],
    nudge: 'Rewrite cot²x in terms of cos²x and sin²x, then factor out cos²x.',
  },
  {
    expr: '(1 − cos²x)(1 + cot²x)',
    target: 'sin²x csc²x',
    steps: [
      { text: 'sin²x (1 + cot²x)', why: 'Use the Pythagorean identity 1 − cos²x = sin²x.' },
      { text: 'sin²x csc²x', why: 'Use the Pythagorean identity 1 + cot²x = csc²x.' },
    ],
    nudge: 'Replace each parenthesized factor with its Pythagorean partner.',
  },
]

function buildStepProblem(
  kind: 'simplify' | 'verify',
  templateId: 'ti.simplify' | 'ti.verify',
  pool: readonly StepSpecItem[],
  seed: number,
  knobs: DifficultyKnobs,
): ProblemInstance {
  const rng = makeRng(mixSeed(seed, kind === 'simplify' ? 0x73696d70 : 0x76657269))
  const item = pool[Math.floor(rng() * pool.length)]!
  const answerText = item.target ?? item.steps.at(-1)!.text
  const answerLatex = trigIdentityToLatex(answerText, 'x')

  const ruleCardId = kind === 'verify' ? 'ti-verify' : 'ti-simplify'
  const canonical: CanonicalStep[] = item.steps.map((s, idx) => {
    const prev = idx === 0 ? item.expr : item.steps[idx - 1]!.text
    const fam = detectTrigStepFamily(prev, s.text, 'x')
    const stepNudge =
      idx === 0
        ? item.nudge
        : fam === 'pythagorean'
          ? 'Apply a Pythagorean identity to replace the squared trig expression.'
          : fam === 'reciprocal'
            ? 'Use a reciprocal identity to rewrite between sin/csc, cos/sec, or tan/cot.'
            : fam === 'quotient'
              ? 'Use a quotient identity to rewrite between the tangent or cotangent and the sine and cosine.'
              : 'Simplify the algebraic fraction or factor and cancel common factors.'
    return {
      text: s.text,
      tag: 'simplify',
      nudge: stepNudge,
      ruleCard: ruleCardId,
      stage: `line-${idx + 1}`,
    }
  })

  // Self-verify canonical walk at generation
  const ctx = {
    kind,
    variable: 'x' as const,
    start: item.expr,
    target: answerText,
    seed,
  }
  const allLines = [item.expr, ...canonical.map((c) => c.text)]
  if (allLines.length > 6) {
    throw new Error(`${templateId} walk exceeds 6 lines: ${allLines.length}`)
  }
  for (let i = 0; i < canonical.length; i++) {
    const prev = i === 0 ? item.expr : canonical[i - 1]!.text
    const next = canonical[i]!.text
    if (sameTrigExpr(prev, next, 'x')) {
      throw new Error(`${templateId} has consecutive identical lines: ${prev} -> ${next}`)
    }
    const stepRes = verifyTrigStep(prev, next, ctx)
    if (!stepRes.ok) {
      throw new Error(`${templateId} canonical step failed verifyTrigStep: ${prev} -> ${next} (${stepRes.message})`)
    }
    if (i === canonical.length - 1 && !stepRes.done) {
      throw new Error(`${templateId} final line did not trigger done: ${next}`)
    }
  }

  // Pick a promised slip from trigIdentitySlips on the starting expression
  const slips = trigIdentitySlips(item.expr, ctx)
  if (slips.length === 0) {
    throw new Error(`${templateId} generated no slips for ${item.expr}`)
  }
  const chosenSlip = slips[Math.floor(rng() * slips.length)]!
  const trapCheck = verifyTrigStep(item.expr, chosenSlip.text, ctx)
  if (trapCheck.ok || trapCheck.pattern?.id !== chosenSlip.mistake) {
    throw new Error(
      `${templateId} promised slip failed for ${item.expr}: ${chosenSlip.text} expected ${chosenSlip.mistake}, got ${trapCheck.pattern?.id}`,
    )
  }

  const statementText = kind === 'verify' ? `${item.expr} = ${answerText}` : item.expr
  const prompt =
    kind === 'verify'
      ? 'Verify the identity by transforming the left side into the right side, one step at a time.'
      : 'Simplify the trigonometric expression to a single trig function or a constant.'
  const reveal = [
    `Start with ${item.expr}`,
    ...item.steps.map((s) => `= ${s.text}  (${s.why})`),
  ]

  const answer: TrigIdentitiesAnswer = {
    type: 'trigIdentities',
    question: kind,
    prompt,
    expr: item.expr,
    target: answerText,
    path: canonical.map((c) => c.text),
    answerText,
    answerLatex,
    formatHint:
      kind === 'verify'
        ? `Rewrite the left side step by step until your line is ${answerText}.`
        : 'Type an equivalent trig expression in x, such as sin x, sec x, or 1.',
    figure: NO_FIGURE,
    stages: [],
    expectedDisplay: answerText,
    nudge: item.nudge,
    ruleCard: kind === 'verify' ? 'ti-verify' : 'ti-simplify',
    ruleCards: [kind === 'verify' ? 'ti-verify' : 'ti-simplify', 'ti-fundamental'],
    reveal,
    trap: chosenSlip.mistake,
    trapAnswer: chosenSlip.text,
  }

  return {
    id: makeProblemId('trigIdentities', templateId, GEN_VERSION, seed),
    moduleId: 'trigIdentities',
    templateId,
    skill: templateId,
    genVersion: GEN_VERSION,
    seed,
    knobs,
    kind: 'trigIdentities',
    title: kind === 'verify' ? 'Verify a trig identity' : 'Simplify a trig expression',
    instructions: prompt,
    statementText,
    vars: ['x'],
    start: item.expr,
    canonical,
    answer,
    graph: EMPTY_GRAPH,
    calc: EMPTY_CALC,
    params: {
      expr: item.expr,
      target: answerText,
    },
  }
}

// ---------------------------------------------------------------------------
// Module progress, nextStep, and solved
// ---------------------------------------------------------------------------

function anchorOf(instance: ProblemInstance, currentLine: string | null): number {
  const start = instance.start ?? ''
  const line = (currentLine ?? start).trim()
  if (!line || sameTrigExpr(line, start, 'x')) return -1
  for (let i = instance.canonical.length - 1; i >= 0; i--) {
    if (sameTrigExpr(line, instance.canonical[i]!.text, 'x')) return i
  }
  return -2 // off-walk
}

function progress(instance: ProblemInstance, currentLine: string | null): ProgressInfo {
  const total = Math.max(1, instance.canonical.length)
  if (instance.answer.type === 'trigIdentities' && instance.answer.question === 'express') {
    return { stage: 0, total: 3, label: 'Fundamental identity', anchorIndex: -1, path: 'none' }
  }
  const idx = anchorOf(instance, currentLine)
  if (idx === -1) {
    return { stage: 0, total, label: 'Start', anchorIndex: -1, path: 'canonical' }
  }
  if (idx >= 0) {
    const done = idx === instance.canonical.length - 1
    return {
      stage: idx + 1,
      total,
      label: done ? 'Complete' : `Step ${idx + 1} of ${total}`,
      anchorIndex: idx,
      path: 'canonical',
    }
  }
  if (solved(instance, currentLine)) {
    return { stage: total, total, label: 'Complete', anchorIndex: total - 1, path: 'none' }
  }
  return { stage: 1, total, label: 'In progress', anchorIndex: -1, path: 'none' }
}

function nextStep(instance: ProblemInstance, currentLine: string | null): CanonicalStep | null {
  if (instance.canonical.length === 0) return null
  const idx = anchorOf(instance, currentLine)
  if (idx === -1) return instance.canonical[0] ?? null
  if (idx >= 0) return instance.canonical[idx + 1] ?? null
  return null
}

function solved(instance: ProblemInstance, currentLine: string | null): boolean {
  if (!currentLine || instance.answer.type !== 'trigIdentities') return false
  const a = instance.answer
  if (a.question === 'express') return false
  const read = readTrigIdentityExpr(currentLine, { variable: 'x' })
  if (!read.ok) return false
  if (a.question === 'verify') {
    if (sameTrigExpr(currentLine, instance.start ?? a.expr, 'x')) return false
    return sameTrigExpr(read.node, a.answerText, 'x')
  }
  return isSimplifiedTrig(read.node, 'x')
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'ti.express',
    title: 'Write one trig function in terms of another',
    description: 'Use a Pythagorean identity and the sign in the given quadrant to write one trig function of θ in terms of another.',
    version: GEN_VERSION,
    knobs: [],
    generate: generateExpress,
  },
  {
    id: 'ti.simplify',
    title: 'Simplify a trig expression',
    description: 'Use reciprocal, quotient, and Pythagorean identities to simplify an expression in x to a single trig function or a constant.',
    version: GEN_VERSION,
    knobs: [],
    generate: (seed, knobs) => buildStepProblem('simplify', 'ti.simplify', SIMPLIFY_POOL, seed, knobs),
  },
  {
    id: 'ti.verify',
    title: 'Verify a trig identity',
    description: 'Transform the left side of an identity into the right side one line at a time using fundamental trig identities.',
    version: GEN_VERSION,
    knobs: [],
    generate: (seed, knobs) => buildStepProblem('verify', 'ti.verify', VERIFY_POOL, seed, knobs),
  },
]

export const trigIdentitiesModule: ModuleDef = {
  id: 'trigIdentities',
  title: 'Fundamental trig identities',
  blurb: 'Reciprocal, quotient, and Pythagorean identities: write one trig function in terms of another, simplify trig expressions, and verify identities step by step.',
  order: 5.998,
  templates: TEMPLATES,
  ruleCards: TI_RULE_CARDS,
  progress,
  nextStep,
  solved,
}

registerModule(trigIdentitiesModule)
