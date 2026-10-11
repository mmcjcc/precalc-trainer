/**
 * Seeded rational-function problems. Each function is built from linear factors so every answer is exact.
 * The build checks its own canonical answers and its promised trap before the problem is returned.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import { problemId } from '@/content/registry'
import type { AnswerSpec, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { Unsupported } from '@/engine/functions/exact'
import { factoredText, polyDeg, polyIsZero, polyLead, polyMul } from '@/engine/functions/poly'
import type { CalcPanels } from '@/shared/types'
import { rat, ratEquals, type Rational } from '@/notation'
import {
  featureTraps,
  gradeAsymptote,
  gradeDomain,
  gradeFeatureStage,
  gradeHoles,
  gradeSolution,
  gradeVertical,
  gradeXIntercepts,
  gradeYIntercept,
  solutionTraps,
  type RfGrade,
  type RfStageId,
  type RfTrap,
} from './grade'
import {
  equationFromSides,
  equationFromText,
  featuresFrom,
  featuresFromText,
  fractionText,
  graphOfEquation,
  graphOfFeatures,
  linearFactor,
  polyFromRoots,
  P_ONE,
  P_X,
  RfSkip,
  sameRats,
  sameRational,
  type RfEquation,
  type RfFeatures,
  type RfForm,
} from './model'
import { RF_RULE_FOR, RF_RULE_IDS } from './rules'

export const RF_MODULE_ID = 'rationalFns' as const

export type RationalFnsAnswer = Extract<AnswerSpec, { type: 'rationalFns' }>

export const RF_KEYS: Record<RfStageId, string> = {
  domain: 'domain',
  va: 'va',
  holes: 'holes',
  asymptote: 'asymptote',
  xint: 'xint',
  yint: 'yint',
  solution: 'solution',
}

const NO_GRAPH = { kind: 'none' as const }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const PROMPT = {
  features: 'Find the domain, the vertical asymptotes, the holes, the horizontal or slant asymptote, the x-intercepts, and the y-intercept of f.',
  asymptote: 'Give the horizontal or slant asymptote of f.',
  equation: 'Solve the equation.',
} as const

const NUDGE: Record<RfStageId, string> = {
  domain: 'The domain is every real number except where the denominator is 0. A hole is still undefined, so it is excluded too. Write the domain in interval notation.',
  va: 'A vertical asymptote is a denominator zero that remains after shared factors cancel. A factor that cancels is a hole, not an asymptote. Write each one as an equation x = a number.',
  holes: 'A hole is where a factor cancels. Its x is that zero. Its y comes from the reduced function: 0/0 is not a height.',
  asymptote: 'If the top has a lower degree, the horizontal asymptote is y = 0. If the degrees match, it is the ratio of the leading coefficients. If the top is exactly one degree higher, divide and keep the quotient, not the remainder.',
  xint: 'The x-intercepts are the zeros of the numerator that were not canceled, written as points. A canceled zero is a hole, not an intercept.',
  yint: 'The y-intercept is the point where x = 0, when 0 is in the domain. Write it as a point.',
  solution: 'Clear the denominators and solve. Then drop any candidate that makes a denominator 0. A candidate that makes the equation true stays.',
}

const STAGE_CARD: Record<RfStageId, string> = {
  domain: RF_RULE_IDS.domain,
  va: RF_RULE_IDS.vertical,
  holes: RF_RULE_IDS.hole,
  asymptote: RF_RULE_IDS.degree,
  xint: RF_RULE_IDS.intercept,
  yint: RF_RULE_IDS.intercept,
  solution: RF_RULE_IDS.solve,
}

const QUESTION_STAGES: Record<RationalFnsAnswer['question'], RfStageId[]> = {
  features: ['domain', 'va', 'holes', 'asymptote', 'xint', 'yint'],
  asymptote: ['asymptote'],
  equation: ['solution'],
}

const STAGE_LABEL: Record<RfStageId, string> = {
  domain: 'domain',
  va: 'vertical asymptotes',
  holes: 'holes',
  asymptote: 'horizontal or slant asymptote',
  xint: 'x-intercepts',
  yint: 'y-intercept',
  solution: 'solution set',
}

const FRONTS = [1, -1, 2, -2, 3, -3] as const
const INTS = [-4, -3, -2, -1, 1, 2, 3, 4] as const
const CASES = ['bottom', 'equal', 'slant'] as const
type DegreeCase = (typeof CASES)[number]

const ROOTS: Rational[] = (() => {
  const out: Rational[] = []
  for (let d = 1; d <= 3; d++) {
    for (let n = -5; n <= 5; n++) {
      if (gcd(Math.abs(n), d) !== 1) continue
      out.push(rat(n, d))
    }
  }
  return out
})()

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

function takeRoots(rng: Rng, n: number, banned: readonly Rational[]): Rational[] {
  const avail = ROOTS.filter((r) => !banned.some((b) => ratEquals(b, r)))
  if (avail.length < n) throw new RfSkip('not enough roots')
  return rng.shuffle(avail).slice(0, n)
}

function integerPoly(p: ReturnType<typeof polyFromRoots>): boolean {
  return p.every((c) => c.d === 1)
}

function pickDegrees(rng: Rng, kind: DegreeCase, hole: boolean): { dn: number; dd: number } {
  if (kind === 'bottom') {
    const dd = hole ? rng.int(2, 3) : rng.int(1, 3)
    return { dn: rng.int(hole ? 1 : 0, dd - 1), dd }
  }
  if (kind === 'equal') {
    const d = hole ? rng.int(1, 3) : rng.int(0, 3)
    return { dn: d, dd: d }
  }
  const dd = hole ? rng.int(1, 2) : rng.int(0, 2)
  return { dn: dd + 1, dd }
}

interface DrawnFunction {
  features: RfFeatures
  text: string
  form: RfForm
  degreeCase: DegreeCase
  hole: boolean
}

function drawFunction(rng: Rng, opts: { holeChance: number; avoidNone: boolean }): DrawnFunction {
  const hole = rng.chance(opts.holeChance)
  const degreeCase = rng.pick(CASES)
  const { dn, dd } = pickDegrees(rng, degreeCase, hole)
  const shared = hole ? takeRoots(rng, 1, []) : []
  const numRoots = [...shared, ...takeRoots(rng, dn - shared.length, shared)]
  const denRoots = [...shared, ...takeRoots(rng, dd - shared.length, numRoots)]
  let frontN = rng.pick(FRONTS)
  let frontD = rng.pick(FRONTS)
  if (frontD < 0) {
    frontN = -frontN as (typeof FRONTS)[number]
    frontD = -frontD as (typeof FRONTS)[number]
  }
  const num = polyFromRoots(frontN, numRoots)
  const den = polyFromRoots(frontD, denRoots)
  if (!integerPoly(num) || !integerPoly(den)) throw new RfSkip('coefficients are not integers')
  const features = featuresFrom(num, den)
  if (opts.avoidNone && features.asymptoteKind === 'none') throw new RfSkip('no horizontal or slant asymptote')
  if (hole && features.holes.length !== 1) throw new RfSkip('expected one hole')
  if (!hole && features.holes.length !== 0) throw new RfSkip('unexpected hole')
  if (features.degreeNum < 0 || features.degreeNum > 3 || features.degreeDen < 0 || features.degreeDen > 3) throw new RfSkip('degree out of range')
  const kindOk =
    (degreeCase === 'bottom' && features.asymptoteKind === 'horizontal' && features.degreeNum < features.degreeDen) ||
    (degreeCase === 'equal' && features.asymptoteKind === 'horizontal' && features.degreeNum === features.degreeDen) ||
    (degreeCase === 'slant' && features.asymptoteKind === 'slant')
  if (!kindOk) throw new RfSkip('degree case did not come out')
  for (const x of [...features.vas, ...features.holes.map((h) => h.x), ...features.xIntercepts.map((p) => p.x)]) {
    if (x.d > 3) throw new RfSkip('a zero has a large denominator')
  }
  const form: RfForm = rng.chance(0.5) ? 'factored' : 'standard'
  if (form === 'factored' && polyDeg(num) >= 1 && !factoredText(num)) throw new RfSkip('numerator would not factor')
  if (form === 'factored' && polyDeg(den) >= 1 && !factoredText(den)) throw new RfSkip('denominator would not factor')
  const text = fractionText(num, den, form)
  const back = featuresFromText(text)
  if (!sameRational({ num, den }, { num: back.num, den: back.den })) throw new RfSkip('the displayed function does not parse back')
  return { features, text, form, degreeCase, hole }
}

function modelOf(answer: RationalFnsAnswer): { features?: RfFeatures; equation?: RfEquation } {
  if (answer.question === 'equation') return { equation: equationFromText(answer.equation) }
  return { features: featuresFromText(answer.f) }
}

export function gradeRfStage(answer: RationalFnsAnswer, stage: RfStageId, text: string): RfGrade {
  try {
    const model = modelOf(answer)
    if (answer.question === 'equation') {
      if (stage !== 'solution' || !model.equation) return { verdict: 'invalid', message: 'That part is not part of this problem.' }
      return gradeSolution(model.equation, text)
    }
    if (!model.features || stage === 'solution') return { verdict: 'invalid', message: 'That part is not part of this problem.' }
    return gradeFeatureStage(model.features, stage, text)
  } catch (e) {
    if (e instanceof RfSkip || e instanceof Unsupported || e instanceof RangeError) {
      return { verdict: 'invalid', message: 'This problem could not be checked exactly.' }
    }
    throw e
  }
}

export function canonicalEntries(answer: RationalFnsAnswer): Record<string, string> {
  const model = modelOf(answer)
  if (model.equation) return { [RF_KEYS.solution]: model.equation.solutionText }
  const f = model.features!
  return {
    [RF_KEYS.domain]: f.domainText,
    [RF_KEYS.va]: f.vaText,
    [RF_KEYS.holes]: f.holesText,
    [RF_KEYS.asymptote]: f.asymptoteText,
    [RF_KEYS.xint]: f.xIntText,
    [RF_KEYS.yint]: f.yIntText,
  }
}

export function rfWork(answer: RationalFnsAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const text = entries[RF_KEYS[stage.id]]
    if (text?.trim()) lines.push(`${STAGE_LABEL[stage.id]}: ${text.trim()}`)
  }
  return lines
}

function trapsFor(answer: RationalFnsAnswer, stage: RfStageId): RfTrap[] {
  const model = modelOf(answer)
  if (model.equation) return stage === 'solution' ? solutionTraps(model.equation) : []
  if (!model.features || stage === 'solution') return []
  return featureTraps(model.features, stage)
}

function assertSelf(where: string, answer: RationalFnsAnswer): void {
  const entries = canonicalEntries(answer)
  for (const stage of answer.stages) {
    const g = gradeRfStage(answer, stage.id, entries[RF_KEYS[stage.id]] ?? '')
    if (g.verdict !== 'correct') throw new Error(`${where}: the canonical ${stage.id} answer does not grade correct (${g.verdict})`)
  }
  const trap = gradeRfStage(answer, answer.trapStage, answer.trapAnswer)
  if (trap.verdict !== 'mistake' || trap.mistake !== answer.trap) {
    throw new Error(`${where}: trap ${answer.trap} on ${answer.trapStage} graded ${trap.verdict}${trap.verdict === 'mistake' ? ` ${trap.mistake}` : ''}`)
  }
  const live = trapsFor(answer, answer.trapStage)
  if (!live.some((t) => t.id === answer.trap)) throw new Error(`${where}: promised trap ${answer.trap} is not a candidate`)
}

function finishAssemble(
  d: {
    question: RationalFnsAnswer['question']
    templateId: string
    version: number
    seed: number
    knobs: DifficultyKnobs
    title: string
    instructions: string
    form: string
    trapStage: RfStageId
    params: Record<string, number | string | boolean>
  },
  answer: RationalFnsAnswer,
  stages: RfStageId[],
  primary: string,
): ProblemInstance {
  answer.trapStage = d.trapStage
  answer.stages = stages.map((id) => ({
    id,
    nudge: NUDGE[id],
    ruleCard: id === d.trapStage ? primary : STAGE_CARD[id],
    reveal: answer.stages.find((s) => s.id === id)?.reveal ?? answer.reveal,
  }))
  answer.nudge = answer.stages[0]!.nudge
  const entries = canonicalEntries(answer)
  answer.expectedDisplay = stages.map((id) => `${STAGE_LABEL[id]}: ${entries[RF_KEYS[id]]}`).join(' | ')
  const where = `${d.templateId}/${d.seed}`
  assertSelf(where, answer)
  return {
    id: problemId(RF_MODULE_ID, d.templateId, d.version, d.seed),
    moduleId: RF_MODULE_ID,
    templateId: d.templateId,
    skill: d.templateId,
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'rationalFns',
    title: d.title,
    instructions: d.instructions,
    statementText: d.question === 'equation' ? answer.equation : answer.f,
    vars: ['x'],
    start: null,
    canonical: [],
    answer,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { question: d.question, form: d.form, trap: answer.trap, trapStage: d.trapStage, ...d.params },
  }
}

function buildFunctionProblem(
  question: 'features' | 'asymptote',
  templateId: string,
  version: number,
  seed: number,
  knobs: DifficultyKnobs,
  drawn: DrawnFunction,
  rng: Rng,
): ProblemInstance {
  const stages = QUESTION_STAGES[question]
  const pool = stages.flatMap((stage) => (stage === 'solution' ? [] : featureTraps(drawn.features, stage).map((trap) => ({ trap, stage }))))
  if (pool.length === 0) throw new RfSkip('no trap')
  const chosen = rng.pick(pool)
  const primary = RF_RULE_FOR[chosen.trap.id]
  const reveal = stages.flatMap((id) => drawn.features.explain[id as keyof RfFeatures['explain']] ?? [])
  const answer: RationalFnsAnswer = {
    type: 'rationalFns',
    question,
    f: drawn.text,
    equation: '',
    prompt: PROMPT[question],
    stages: stages.map((id) => ({
      id,
      nudge: NUDGE[id],
      ruleCard: id === chosen.stage ? primary : STAGE_CARD[id],
      reveal: [...(drawn.features.explain[id as keyof RfFeatures['explain']] ?? [])],
    })),
    expectedDisplay: '',
    nudge: NUDGE[stages[0]!],
    ruleCard: primary,
    ruleCards: [primary, ...stages.map((id) => STAGE_CARD[id]).filter((id, i, all) => all.indexOf(id) === i && id !== primary)],
    reveal,
    trap: chosen.trap.id,
    trapStage: chosen.stage,
    trapAnswer: chosen.trap.text,
    graph: graphOfFeatures(drawn.features),
  }
  return finishAssemble(
    {
      question,
      templateId,
      version,
      seed,
      knobs,
      title: question === 'features' ? 'Features of a rational function' : 'Asymptote of a rational function',
      instructions: question === 'features' ? 'Give each part, then check it before the next one.' : 'Give the horizontal or slant asymptote.',
      form: drawn.form,
      trapStage: chosen.stage,
      params: { hole: drawn.hole, degreeCase: drawn.degreeCase, extraneous: false },
    },
    answer,
    stages,
    primary,
  )
}

type Family = 'const' | 'linear' | 'same' | 'none' | 'valid'

function pickFamily(rng: Rng): Family {
  const x = rng.next()
  if (x < 0.4) return 'const'
  if (x < 0.6) return 'linear'
  if (x < 0.75) return 'same'
  if (x < 0.9) return 'none'
  return 'valid'
}

function rootPoly(n: number): ReturnType<typeof linearFactor> {
  return linearFactor(rat(n))
}

interface DrawnEquation {
  text: string
  left: string
  right: string
  equation: RfEquation
  family: Family
  form: RfForm
}

function drawEquation(rng: Rng): DrawnEquation {
  const family = pickFamily(rng)
  const form: RfForm = rng.chance(0.5) ? 'factored' : 'standard'
  const s = rng.pick(INTS)
  const e = rng.pick(INTS.filter((n) => n !== s))
  let leftN = rootPoly(s)
  let leftD = rootPoly(e)
  let rightN = P_ONE
  let rightD = P_ONE
  if (family === 'const') {
    const k = rng.pick([-3, -2, -1, 1, 2, 3] as const)
    const u = s - k
    if (u === e || u === s) throw new RfSkip('constant family collided')
    leftN = polyMul(rootPoly(e), rootPoly(u))
    leftD = rootPoly(e)
    rightN = [rat(k)]
    rightD = P_ONE
  } else if (family === 'linear') {
    leftN = polyMul(rootPoly(e), [rat(-s), rat(2)])
    leftD = rootPoly(e)
    rightN = P_X
    rightD = P_ONE
  } else if (family === 'same') {
    leftN = [rat(-(2 * s + e)), rat(3)]
    rightN = [rat(-(s + e)), rat(2)]
    leftD = rootPoly(e)
    rightD = rootPoly(e)
  } else if (family === 'none') {
    const k = rng.pick([-3, -2, -1, 1, 2, 3] as const)
    const u = e - k
    if (u === e) throw new RfSkip('no-solution family collided')
    leftN = polyMul(rootPoly(e), rootPoly(u))
    leftD = rootPoly(e)
    rightN = [rat(k)]
    rightD = P_ONE
  } else {
    leftN = rootPoly(s)
    leftD = rootPoly(e)
    rightN = []
    rightD = P_ONE
  }
  const analyzed = equationFromSides({ num: leftN, den: leftD }, { num: rightN, den: rightD })
  if (family === 'none' && analyzed.solutions.length !== 0) throw new RfSkip('expected no solution')
  if (family !== 'none' && !sameRats(analyzed.solutions, [rat(s)])) throw new RfSkip('solution was not the one built')
  if (!analyzed.excluded.some((x) => ratEquals(x, rat(e)))) throw new RfSkip('the excluded value disappeared')
  const left = fractionText(leftN, leftD, form)
  const right = fractionText(rightN, rightD, form)
  const text = `${left} = ${right}`
  const back = equationFromText(text)
  if (!sameRats(back.solutions, analyzed.solutions) || !sameRats(back.excluded, analyzed.excluded)) {
    throw new RfSkip('the displayed equation does not parse back')
  }
  if (polyIsZero(leftD) || (polyDeg(leftD) === 0 && polyLead(leftD).n === 0)) throw new RfSkip('bad denominator')
  return { text, left, right, equation: back, family, form }
}

function buildEquationProblem(templateId: string, version: number, seed: number, knobs: DifficultyKnobs, drawn: DrawnEquation, rng: Rng): ProblemInstance {
  const traps = solutionTraps(drawn.equation)
  if (traps.length === 0) throw new RfSkip('no trap')
  const trap = rng.pick(traps)
  const primary = RF_RULE_FOR[trap.id]
  const extraneous = drawn.equation.candidates.some((c) => drawn.equation.excluded.some((e) => ratEquals(c, e)))
  const answer: RationalFnsAnswer = {
    type: 'rationalFns',
    question: 'equation',
    f: '',
    equation: drawn.text,
    prompt: PROMPT.equation,
    stages: [
      {
        id: 'solution',
        nudge: NUDGE.solution,
        ruleCard: primary,
        reveal: [...drawn.equation.explain],
      },
    ],
    expectedDisplay: '',
    nudge: NUDGE.solution,
    ruleCard: primary,
    ruleCards: [primary],
    reveal: [...drawn.equation.explain],
    trap: trap.id,
    trapStage: 'solution',
    trapAnswer: trap.text,
    graph: graphOfEquation(drawn.left, drawn.right, drawn.equation),
  }
  return finishAssemble(
    {
      question: 'equation',
      templateId,
      version,
      seed,
      knobs,
      title: 'Solve a rational equation',
      instructions: 'Give the solution set.',
      form: drawn.form,
      trapStage: 'solution',
      params: { hole: false, family: drawn.family, extraneous, degreeCase: 'equation' },
    },
    answer,
    ['solution'],
    primary,
  )
}

function generateKind(question: 'features' | 'asymptote', templateId: string, version: number, salt: number, holeChance: number) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const rng = makeRng(mixSeed(seed, salt))
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const drawn = drawFunction(rng, { holeChance, avoidNone: true })
        return buildFunctionProblem(question, templateId, version, seed, knobs, drawn, rng)
      } catch (e) {
        if (e instanceof RfSkip || e instanceof Unsupported || e instanceof RangeError) continue
        throw e
      }
    }
    throw new Error(`${templateId}: no function passed the filters in 80 draws (seed ${seed})`)
  }
}

function generateEquation(templateId: string, version: number, salt: number) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const rng = makeRng(mixSeed(seed, salt))
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        return buildEquationProblem(templateId, version, seed, knobs, drawEquation(rng), rng)
      } catch (e) {
        if (e instanceof RfSkip || e instanceof Unsupported || e instanceof RangeError) continue
        throw e
      }
    }
    throw new Error(`${templateId}: no equation passed the filters in 80 draws (seed ${seed})`)
  }
}

export const featuresTemplate: TemplateDef = {
  id: 'rf.features',
  title: 'Domain, asymptotes, holes, intercepts',
  description: 'For f(x) = p(x)/q(x), give the domain, the vertical asymptotes, the holes, the horizontal or slant asymptote, and both intercepts.',
  version: 1,
  knobs: [],
  generate: generateKind('features', 'rf.features', 1, 41, 0.5),
}

export const asymptoteTemplate: TemplateDef = {
  id: 'rf.asymptote',
  title: 'Horizontal or slant asymptote',
  description: 'Give only the horizontal or slant asymptote: y = 0, the ratio of the leading coefficients, or the quotient when the top is one degree higher.',
  version: 1,
  knobs: [],
  generate: generateKind('asymptote', 'rf.asymptote', 1, 42, 0.35),
}

export const equationTemplate: TemplateDef = {
  id: 'rf.equation',
  title: 'Solve a rational equation',
  description: 'Solve an equation with one or two rational expressions and give the solution set. A value that makes a denominator 0 is not a solution.',
  version: 1,
  knobs: [],
  generate: generateEquation('rf.equation', 1, 43),
}

export const RF_TEMPLATES = [featuresTemplate, asymptoteTemplate, equationTemplate] as const

/** Re-export the stage graders the hand tests call by name. */
export { gradeAsymptote, gradeDomain, gradeHoles, gradeVertical, gradeXIntercepts, gradeYIntercept }
