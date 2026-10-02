/**
 * Zeros, end behavior, a polynomial from its zeros, rational root candidates: choosing a problem, checking
 * it against the engine, and turning it into a ProblemInstance. The templates pick the numbers that go into
 * the factors (or the coefficients) only. The zeros, multiplicities, ends, the formula through a point, the
 * candidate list, the worked explanation and every candidate mistake come from `src/engine/polynomials`;
 * nothing is worked out here.
 */
import { convertExpr } from '@/content/calc/format'
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, DifficultyKnobs, ProblemInstance } from '@/content/types'
import {
  analyzeFactored,
  endBehaviorMistakes,
  factoredFormText,
  gradeCrossTouch,
  gradeEndBehavior,
  gradePolynomialFromZeros,
  gradeRationalZeros,
  gradeRootCandidates,
  gradeZeros,
  makeFactored,
  parseFactored,
  polynomialFromZeros,
  polynomialFromZerosMistakes,
  rationalRootCandidates,
  rootCandidateMistakes,
  zeroMistakes,
} from '@/engine'
import type { FactorInput, FactoredAnalysis, PolyMistakeKind } from '@/engine'
import { ratToNumber, ratToString } from '@/notation'
import type { CalcPanels, GraphSpec } from '@/shared/types'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { PZ_KEYS, gradeZerosStage, zerosSpec } from './grade'
import { PZ_RULE_IDS, pzRuleIdFor, type PzRuleKey } from './rules'

export const PZ_MODULE_ID = 'polyZeros' as const

export type PolyZerosAnswer = Extract<AnswerSpec, { type: 'polyZeros' }>
export type PolyZerosQuestion = PolyZerosAnswer['question']
export type PolyZerosStage = PolyZerosAnswer['stages'][number]
export type PolyZerosStageId = PolyZerosStage['id']

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }
const NO_GRAPH: GraphSpec = { kind: 'none' }

/** Factored problems stay at degree 6 or less and zeros at denominators of 3 or less (core §5). */
export const PZ_MAX_DEGREE = 6
const MAX_DENOMINATOR = 3

/** "+-1, +-3" as it is read: "±1, ±3", with a real minus sign elsewhere. */
export function pmShow(text: string): string {
  return polyShow(text).replace(/\+−/g, '±')
}

/** Pick one item by weight. Consumes one random number. */
export function weighted<T>(rng: Rng, items: readonly { item: T; weight: number }[]): T {
  let roll = rng.next() * items.reduce((sum, i) => sum + i.weight, 0)
  for (const i of items) {
    roll -= i.weight
    if (roll < 0) return i.item
  }
  return items[items.length - 1]!.item
}

/** The largest whole number written in a polynomial's text (its exponents are small, so this is a coefficient). */
export function largestNumber(text: string): number {
  return Math.max(0, ...(text.match(/\d+/g) ?? []).map(Number))
}

// ---------------------------------------------------------------------------
// Drawing a factored polynomial
// ---------------------------------------------------------------------------

/** Factors with a number in front of x: (2x − 1), (3x + 2), … Their zeros have denominator 2 or 3. */
export const NONMONIC_FACTORS: readonly { coef: number; constant: number }[] = [
  { coef: 2, constant: -1 },
  { coef: 2, constant: 1 },
  { coef: 2, constant: -3 },
  { coef: 2, constant: 3 },
  { coef: 3, constant: -1 },
  { coef: 3, constant: 1 },
  { coef: 3, constant: -2 },
  { coef: 3, constant: 2 },
]

export interface FactoredWant {
  /** One exponent per factor, in the order the factors are drawn. Its length is the number of distinct zeros. */
  mults: readonly number[]
  /** One factor has a number in front of x. */
  nonmonic: boolean
  /** One factor is a power of x itself (a zero at 0). It is written first. */
  origin: boolean
  /** The number in front of the product, exact text: "1", "-2", "1/2". */
  lead: string
  /** Whole-number zeros are picked from −reach … reach, never 0, never two of the same size. */
  reach: number
}

export interface FactoredDraft {
  /** The factored form as it is shown, app syntax (the engine's own printing). */
  text: string
  analysis: FactoredAnalysis
  want: FactoredWant
}

/**
 * Draw a product of linear factors. Whole-number zeros never repeat a size, so no two zeros are opposites
 * (a sign slip on one would land on the other and could not be seen). Redrawn until the engine reads the
 * text back with one zero per factor, every factor's sign slip visible, and `accept` agrees.
 */
export function drawFactored(rng: Rng, want: FactoredWant, accept: (draft: FactoredDraft) => boolean = () => true): FactoredDraft {
  for (let tries = 0; tries < 300; tries++) {
    const factors: FactorInput[] = []
    const sizes: number[] = []
    want.mults.forEach((mult, i) => {
      if (want.origin && i === 0) factors.push({ zero: 0, mult })
      else if (want.nonmonic && i === (want.origin ? 1 : 0)) factors.push({ ...rng.pick(NONMONIC_FACTORS), mult })
      else {
        const size = rng.intExcept(1, want.reach, sizes)
        sizes.push(size)
        factors.push({ zero: rng.sign() * size, mult })
      }
    })
    const ordered = want.origin ? [factors[0]!, ...rng.shuffle(factors.slice(1))] : rng.shuffle(factors)
    const text = factoredFormText(makeFactored(want.lead, ordered))
    const analysis = analyzeFactored(text)
    if (!analysis || analysis.zeros.length !== want.mults.length || analysis.degree > PZ_MAX_DEGREE) continue
    // Every factor with a zero other than 0 must have a sign slip the engine can see, and no two slips may
    // give the same wrong number.
    const slips = zeroMistakes(text) ?? []
    const away = analysis.zeros.filter((z) => z.zero.n !== 0)
    if (slips.filter((c) => c.kind === 'zero_sign_reversed').length !== away.length) continue
    if (slips.some((c) => c.shadows.length > 0)) continue
    if (want.nonmonic && !slips.some((c) => c.kind === 'zero_nonmonic_factor')) continue
    // Mixed factor signs: (x + 1) next to (x − 3).
    if (away.length >= 2 && !(away.some((z) => z.zero.n > 0) && away.some((z) => z.zero.n < 0))) continue
    const draft: FactoredDraft = { text, analysis, want }
    if (!accept(draft)) continue
    return draft
  }
  throw new Error('polyZeros: no factored polynomial passed the filters in 300 draws')
}

// ---------------------------------------------------------------------------
// The engine's candidates, and the self-tests
// ---------------------------------------------------------------------------

/** What the trap list and the self-tests need to know about a problem. */
export interface PzProblem {
  question: PolyZerosQuestion
  f: string
  zeros: PolyZerosAnswer['zeros']
  point?: PolyZerosAnswer['point']
}

/**
 * Distinct mistake kinds the engine would name on this question's screen, in its priority order. Where the
 * engine has a candidate list it is read (`zeroMistakes`, `endBehaviorMistakes`,
 * `polynomialFromZerosMistakes`, `rootCandidateMistakes`). The multiplicity, crosses / touches and
 * "every sign backwards" slips have no list, so each is put to the grader as the answer that slip gives.
 */
export function pzTrapKinds(p: PzProblem): PolyMistakeKind[] {
  const kinds: PolyMistakeKind[] = []
  const add = (kind: PolyMistakeKind) => {
    if (!kinds.includes(kind)) kinds.push(kind)
  }
  const addAll = (list: readonly { kind: PolyMistakeKind; shadows: PolyMistakeKind[] }[] | null) => {
    for (const c of list ?? []) {
      add(c.kind)
      c.shadows.forEach(add)
    }
  }
  const named = (grade: { verdict: string; mistake?: PolyMistakeKind }) => {
    if (grade.verdict === 'mistake' && grade.mistake) add(grade.mistake)
  }
  switch (p.question) {
    case 'zeros': {
      addAll(zeroMistakes(p.f))
      const rows = p.zeros
      // Every multiplicity left at 1; each exponent moved to the next zero; one choice the other way.
      named(gradeZeros(p.f, rows.map((z) => ({ zero: z.text, mult: 1 }))))
      named(gradeZeros(p.f, rows.map((z, i) => ({ zero: z.text, mult: rows[(i + 1) % rows.length]!.mult }))))
      named(gradeCrossTouch(p.f, rows.map((z, i) => (i === 0 ? other(z.behavior) : (z.behavior ?? '')))))
      break
    }
    case 'end':
      addAll(endBehaviorMistakes(p.f))
      break
    case 'build':
      addAll(polynomialFromZerosMistakes(zerosSpec(p)))
      break
    case 'rational': {
      addAll(rootCandidateMistakes(p.f))
      const m = rationalRootCandidates(p.f)
      if (m && m.zeros.length > 0) named(gradeRationalZeros(p.f, m.zeros.map((z) => ratToString({ n: -z.n, d: z.d })).join(', ')))
      break
    }
  }
  return kinds
}

function other(behavior: 'crosses' | 'touches' | undefined): string {
  return behavior === 'crosses' ? 'touches' : 'crosses'
}

const checked = new Map<string, string | null>()

/**
 * The self-tests of polynomials-core.md §5 for one problem, plus the things §5 says to avoid. Returns null
 * when all pass, else what failed. Cached per problem: the engine's answers do not change between calls.
 */
export function pzSelfTest(p: PzProblem): string | null {
  const key = JSON.stringify([p.question, p.f, p.zeros, p.point ?? null])
  const cached = checked.get(key)
  if (cached !== undefined) return cached
  const result = runSelfTest(p)
  checked.set(key, result)
  return result
}

const verdictOf = (name: string, verdict: string) => (verdict === 'correct' ? null : `${name} is ${verdict}`)

function runSelfTest(p: PzProblem): string | null {
  switch (p.question) {
    case 'zeros':
    case 'end': {
      const a = analyzeFactored(p.f)
      if (p.question === 'end') {
        // Standard form is not a product of linear factors; the ends are read off its leading term.
        const ends = endBehaviorMistakes(p.f)
        if (!ends || ends.length === 0) return 'endBehaviorMistakes has no candidate'
        if (!a) return null
      }
      if (!a) return 'analyzeFactored returned null'
      if (!parseFactored(a.text)) return 'the factored form does not read back'
      if (a.degree > PZ_MAX_DEGREE) return `degree ${a.degree} is above ${PZ_MAX_DEGREE}`
      if (a.zeros.some((z) => z.zero.d > MAX_DENOMINATOR)) return 'a zero has a denominator above 3'
      // The explanation is one line per zero, then degree, leading coefficient, ends, y-intercept.
      if (a.explanation.length !== a.zeros.length + 4) return 'the explanation is not one line per zero and four closing lines'
      const slips = zeroMistakes(p.f) ?? []
      if (slips.filter((c) => c.kind === 'zero_sign_reversed').length !== a.zeros.filter((z) => z.zero.n !== 0).length) return 'two zeros are opposites: a sign slip cannot be seen'
      return (
        verdictOf('the zeros with multiplicities', gradeZeros(p.f, a.zeros.map((z) => ({ zero: z.text, mult: z.mult }))).verdict) ??
        verdictOf('the zeros as text', gradeZeros(p.f, a.zeros.map((z) => ({ zero: z.text, mult: String(z.mult) }))).verdict) ??
        verdictOf('crosses / touches', gradeCrossTouch(p.f, a.zeros.map((z) => z.behavior)).verdict) ??
        verdictOf('the end behavior', gradeEndBehavior(p.f, a.end).verdict)
      )
    }
    case 'build': {
      const spec = zerosSpec(p)
      const b = polynomialFromZeros(spec)
      if (!b) return 'polynomialFromZeros returned null'
      if (!b.point) return 'the problem has no point'
      if (b.a.n === b.a.d) return 'the number in front is 1: leaving it out could not be seen'
      if (b.degree > PZ_MAX_DEGREE) return `degree ${b.degree} is above ${PZ_MAX_DEGREE}`
      if (b.explanation.length !== 4) return 'the explanation is not four lines'
      return verdictOf('the factored formula', gradePolynomialFromZeros(spec, b.text).verdict) ?? verdictOf('the formula multiplied out', gradePolynomialFromZeros(spec, b.expandedText).verdict)
    }
    case 'rational': {
      const m = rationalRootCandidates(p.f)
      if (!m) return 'rationalRootCandidates returned null'
      if (m.f !== p.f) return `f reads back as ${m.f}`
      if (m.constant === 0) return 'the constant term is 0'
      if (Math.abs(m.constant) === Math.abs(m.leading)) return 'the constant term is ± the leading coefficient: q/p is the same list'
      if (m.explanation.length !== 3 || m.zeroExplanation.length !== 2) return 'the explanation is not three lines and two lines'
      return (
        verdictOf('the candidate list', gradeRootCandidates(p.f, m.text).verdict) ??
        verdictOf('the rational zeros', gradeRationalZeros(p.f, m.zeros.map(ratToString).join(', ') || 'none').verdict)
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Graph and calculator panels
// ---------------------------------------------------------------------------

/**
 * f on a square window that holds every zero and both axes. Shown only after she finishes: it is the
 * answer to crosses / touches and to the end behavior.
 */
export function zerosGraph(shown: string, analysis: FactoredAnalysis): GraphSpec {
  const sizes = analysis.zeros.map((z) => Math.abs(ratToNumber(z.zero)))
  const reach = Math.max(4, Math.ceil(Math.max(...sizes)) + 2)
  return { kind: 'function', f: shown, xDomain: [-reach, reach] }
}

function enterY1(f: string): CalcPanels['ti84'][number] {
  return {
    title: 'Enter Y1',
    keys: `Y= → Y1 = ${convertExpr('ti84', f)}`,
    caution: f.trimStart().startsWith('-') ? 'Start with the (−) key at the bottom, not the subtraction key.' : undefined,
  }
}

function enterF1(f: string): CalcPanels['nspire'][number] {
  return { title: 'Graph f1', keys: `Scratchpad Graph → enter f1(x) = ${convertExpr('nspire', f)}` }
}

/** Checking a zero of a factored polynomial: the table for the value, the graph for what the curve does there. */
export function zerosCalc(f: string): CalcPanels {
  return {
    ti84: [
      enterY1(f),
      {
        title: 'Test a zero in the table',
        keys: '2nd WINDOW (TBLSET) → Indpnt: Ask. 2nd GRAPH (TABLE). Type one of your zeros in the X column and press ENTER.',
        why: 'Y1 shows 0 exactly when that x is a zero. Type a fraction with the division key, and a negative number with the (−) key.',
      },
      {
        title: 'Watch the graph at that zero',
        keys: 'ZOOM → 6:ZStandard. Then 2nd TRACE (CALC) → 2:zero. Move left of the zero and press ENTER, move right of it and press ENTER, then ENTER once more for the guess.',
        why: 'Look at the curve there: it either passes through the x-axis, or comes to it and turns back.',
        caution: 'The zero tool needs the graph to change sign between your two bounds. Where the graph only touches the axis it answers NO SIGN CHANGE. That zero is still a zero: check it in the table.',
      },
    ],
    nspire: [
      enterF1(f),
      {
        title: 'Test a zero',
        keys: 'Scratchpad Calculate: type f1( one of your zeros ) and press enter.',
        why: 'The result is 0 exactly when that x is a zero.',
      },
      {
        title: 'Watch the graph at that zero',
        keys: 'Back on the graph: menu → Analyze Graph → Zero. Click left of the zero for the lower bound, then right of it for the upper bound.',
        why: 'Look at the curve there: it either passes through the x-axis, or comes to it and turns back.',
      },
    ],
  }
}

/** Testing the candidates of the rational root theorem one at a time. The steps never list them. */
export function rationalCalc(f: string): CalcPanels {
  return {
    ti84: [
      enterY1(f),
      {
        title: 'Test your candidates in the table',
        keys: '2nd WINDOW (TBLSET) → Indpnt: Ask. 2nd GRAPH (TABLE). Type a candidate in the X column and press ENTER. Do the same for each one on your list.',
        why: 'A candidate is a zero exactly when Y1 shows 0.',
        caution: 'Type a fraction with the division key, and a negative candidate with the (−) key.',
      },
    ],
    nspire: [
      enterF1(f),
      {
        title: 'Test your candidates',
        keys: 'Scratchpad Calculate: type f1( a candidate ) and press enter. Do the same for each one on your list.',
        why: 'A candidate is a zero exactly when the result is 0.',
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Parts, hints, and the instance
// ---------------------------------------------------------------------------

/** The part of the problem where each slip would show up. */
const STAGE_KINDS: Record<PolyZerosStageId, readonly PolyMistakeKind[]> = {
  zeros: ['zero_sign_reversed', 'zero_nonmonic_factor', 'multiplicity_ignored', 'multiplicity_wrong_zero'],
  cross: ['cross_touch_swapped'],
  end: ['end_sign_ignored', 'end_parity_swapped'],
  formula: ['lead_coefficient_omitted', 'zero_sign_reversed', 'multiplicity_ignored', 'multiplicity_wrong_zero'],
  candidates: ['rrt_inverted', 'rrt_no_plus_minus', 'rrt_integers_only', 'rrt_wrong_coefficients'],
  rational: ['zero_sign_reversed'],
}

const STAGE_CARD: Record<PolyZerosStageId, PzRuleKey> = {
  zeros: 'zero',
  cross: 'crossTouch',
  end: 'ends',
  formula: 'build',
  candidates: 'candidates',
  rational: 'test',
}

export const PZ_QUESTION_STAGES: Record<PolyZerosQuestion, readonly PolyZerosStageId[]> = {
  zeros: ['zeros', 'cross'],
  end: ['end'],
  build: ['formula'],
  rational: ['candidates', 'rational'],
}

const QUESTION_CARDS: Record<PolyZerosQuestion, readonly PzRuleKey[]> = {
  zeros: ['zero', 'nonmonic', 'multiplicity', 'crossTouch'],
  end: ['ends', 'degree', 'lead'],
  build: ['build', 'zero', 'multiplicity'],
  rational: ['candidates', 'test'],
}

/** Which part of a question a named slip belongs to (its rule card leads that part's hints). */
export function pzStageOf(question: PolyZerosQuestion, kind: string): PolyZerosStageId | null {
  return PZ_QUESTION_STAGES[question].find((id) => (STAGE_KINDS[id] as readonly string[]).includes(kind)) ?? null
}

export interface PzBuild {
  question: PolyZerosQuestion
  templateId: string
  version: number
  seed: number
  knobs: DifficultyKnobs
  title: string
  instructions: string
  prompt: string
  /** What the problem page and the tutor read as the statement: f in app syntax, or the whole question for pz.build. */
  statementText: string
  f: string
  form: PolyZerosAnswer['form']
  zeros: PolyZerosAnswer['zeros']
  point?: PolyZerosAnswer['point']
  end?: PolyZerosAnswer['end']
  candidatesText?: string
  rationalZerosText?: string
  /** One nudge and one reveal per part, in the order of the parts. */
  nudges: readonly string[]
  reveals: readonly (readonly string[])[]
  /** The after-finish explanation. */
  reveal: readonly string[]
  expectedDisplay: string
  trap: PolyMistakeKind
  /** What the seed was built around, for tests and debugging: "sign", "nonmonic", "parity", … */
  scenario: string
  graph?: GraphSpec
  calc?: CalcPanels
  params?: Record<string, number | string | boolean>
}

export function buildZerosProblem(d: PzBuild): ProblemInstance {
  const where = `${d.templateId}/${d.seed}`
  const problem: PzProblem = { question: d.question, f: d.f, zeros: d.zeros, ...(d.point ? { point: d.point } : {}) }
  const failed = pzSelfTest(problem)
  if (failed) throw new Error(`${where}: ${failed}`)
  // The promised trap has to be one the engine would actually name on this screen.
  if (!pzTrapKinds(problem).includes(d.trap)) throw new Error(`${where}: trap ${d.trap} is not a candidate`)

  const stageIds = PZ_QUESTION_STAGES[d.question]
  if (d.nudges.length !== stageIds.length || d.reveals.length !== stageIds.length) throw new Error(`${where}: one nudge and one reveal per part`)
  const primary = pzRuleIdFor(d.trap) ?? PZ_RULE_IDS[STAGE_CARD[stageIds[0]!]]
  const ruleCards = [primary, ...QUESTION_CARDS[d.question].map((key) => PZ_RULE_IDS[key]).filter((id) => id !== primary)]
  const trapStage = pzStageOf(d.question, d.trap)
  const stages: PolyZerosStage[] = stageIds.map((id, i) => ({
    id,
    nudge: d.nudges[i]!,
    // The part where the promised slip lives opens on that slip's card; the others on their own.
    ruleCard: id === trapStage ? primary : PZ_RULE_IDS[STAGE_CARD[id]],
    reveal: [...d.reveals[i]!],
  }))

  const answer: PolyZerosAnswer = {
    type: 'polyZeros',
    question: d.question,
    f: d.f,
    form: d.form,
    prompt: d.prompt,
    zeros: d.zeros.map((z) => ({ ...z })),
    ...(d.point ? { point: { ...d.point } } : {}),
    ...(d.end ? { end: { ...d.end } } : {}),
    ...(d.candidatesText !== undefined ? { candidatesText: d.candidatesText } : {}),
    ...(d.rationalZerosText !== undefined ? { rationalZerosText: d.rationalZerosText } : {}),
    stages,
    expectedDisplay: d.expectedDisplay,
    nudge: stages[0]!.nudge,
    ruleCard: primary,
    ruleCards,
    reveal: [...d.reveal],
    trap: d.trap,
    graph: d.graph ?? NO_GRAPH,
  }
  // The canonical answers, typed the way she would type them, have to pass this module's own check too.
  const wrong = stageIds.find((id) => gradeZerosStage(answer, id, canonicalEntries(answer)).parts.some((part) => part.grade.verdict !== 'correct'))
  if (wrong) throw new Error(`${where}: the canonical answer to part "${wrong}" does not grade correct`)

  return {
    id: problemId(PZ_MODULE_ID, d.templateId, d.version, d.seed),
    moduleId: PZ_MODULE_ID,
    templateId: d.templateId,
    skill: d.templateId,
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'polyZeros',
    title: d.title,
    instructions: d.instructions,
    statementText: d.statementText,
    vars: ['x'],
    start: null,
    canonical: [],
    answer,
    // The rail's graph panel can be opened before she finishes, so the graph of f is not put there.
    graph: NO_GRAPH,
    calc: d.calc ?? NO_CALC,
    params: { question: d.question, form: d.form, trap: d.trap, scenario: d.scenario, ...d.params },
  }
}

/** The right answer to every part as stored entries, the way she would type them. For tests and self-checks. */
export function canonicalEntries(answer: PolyZerosAnswer): Record<string, string> {
  const entries: Record<string, string> = {}
  switch (answer.question) {
    case 'zeros':
      entries[PZ_KEYS.rows] = String(answer.zeros.length)
      answer.zeros.forEach((z, i) => {
        entries[PZ_KEYS.zero(i)] = z.text
        entries[PZ_KEYS.mult(i)] = String(z.mult)
        entries[PZ_KEYS.cross(i)] = z.behavior ?? ''
      })
      break
    case 'end':
      entries[PZ_KEYS.left] = answer.end?.left ?? ''
      entries[PZ_KEYS.right] = answer.end?.right ?? ''
      break
    case 'build':
      entries[PZ_KEYS.formula] = answer.f
      break
    case 'rational':
      entries[PZ_KEYS.candidates] = answer.candidatesText ?? ''
      entries[PZ_KEYS.rational] = answer.rationalZerosText ?? ''
      break
  }
  return entries
}
