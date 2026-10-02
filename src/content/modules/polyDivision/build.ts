/**
 * Synthetic division: choosing a polynomial and a divisor, checking them against the engine, and turning
 * them into a ProblemInstance. The templates pick coefficients and the box number only. The table, the
 * quotient, the remainder, the worked explanation and every candidate mistake come from
 * `src/engine/polynomials`; nothing is worked out here.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, DifficultyKnobs, ProblemInstance } from '@/content/types'
import {
  divisorText,
  gradeBottomRow,
  gradeCoefficientRow,
  gradeIsFactor,
  gradeQuotient,
  gradeRemainder,
  gradeSyntheticTable,
  polyValueAt,
  quotientMistakes,
  remainderMistakes,
  syntheticDivision,
  syntheticMistakes,
} from '@/engine'
import type { PolyMistakeKind, SyntheticTable } from '@/engine'
import { ratToString } from '@/notation'
import type { CalcPanels } from '@/shared/types'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { gradeDivisionTable } from './grade'
import { SD_RULE_IDS, sdRuleIdFor, type SdRuleKey } from './rules'

export const SD_MODULE_ID = 'polyDivision' as const

export type PolyDivisionAnswer = Extract<AnswerSpec, { type: 'polyDivision' }>
export type PolyDivisionQuestion = PolyDivisionAnswer['question']
export type PolyDivisionStage = PolyDivisionAnswer['stages'][number]
export type PolyDivisionStageId = PolyDivisionStage['id']

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

/** No cell of the table goes past this: the numbers stay easy to work by hand and fit a phone-width cell. */
const CELL_LIMIT = 60
/** A constant term the template had to choose to hit a remainder stays this small. */
const CONSTANT_LIMIT = 30

// ---------------------------------------------------------------------------
// Drawing a division
// ---------------------------------------------------------------------------

export interface SdWant {
  degree: 3 | 4
  /** A power between the leading term and the constant term is missing (its place needs her own 0). */
  missing: boolean
  /** −1 gives a divisor x + k, 1 gives x − k, 0 leaves it to the draw. */
  sign: -1 | 0 | 1
  /**
   * `free`: any remainder. `zero`: x − c is a factor. `nonzero`: it is not.
   * `zero-at-opposite`: f(c) ≠ 0 but f(−c) = 0, so testing the opposite number gives the wrong answer.
   */
  remainder: 'free' | 'zero' | 'nonzero' | 'zero-at-opposite'
}

export interface SdDraft {
  /** f from the highest power down, zeros included. */
  coefficients: number[]
  c: number
  /** The engine's table for these numbers. */
  table: SyntheticTable
}

const LEADS = [1, 1, 1, 2, 2, 3, -1, -2] as const
const BOX_SIZES = [1, 2, 2, 3, 3] as const

const small = (values: readonly { n: number; d: number }[]) => values.every((v) => v.d === 1 && Math.abs(v.n) <= CELL_LIMIT)

/**
 * Draw f and c. The leading coefficient, the middle coefficients and c are picked; the constant term is
 * picked too unless a remainder is wanted, in which case it is the one number that gives that remainder
 * (read off the engine's own table for f without its constant term). Redrawn until every cell of the
 * engine's table is a whole number of at most two digits and `accept` agrees.
 */
export function drawDivision(rng: Rng, want: SdWant, accept: (draft: SdDraft) => boolean = () => true): SdDraft {
  const n = want.degree
  for (let tries = 0; tries < 400; tries++) {
    const size = rng.pick(BOX_SIZES)
    const sign = want.sign === 0 ? (rng.chance(0.55) ? -1 : 1) : want.sign
    const c = sign * size
    const head: number[] = [rng.pick(LEADS)]
    for (let i = 1; i < n; i++) head.push(rng.intExcept(-6, 6, [0]))
    const gap = rng.int(1, n - 1)
    if (want.missing) head[gap] = 0
    const free = rng.intExcept(-9, 9, [0])

    let constant = free
    if (want.remainder === 'zero' || want.remainder === 'zero-at-opposite') {
      // The remainder of f without its constant term, at the number that has to give 0. The constant
      // term that cancels it is its opposite.
      const base = syntheticDivision([...head, 0], want.remainder === 'zero' ? c : -c)
      if (!base || base.remainder.d !== 1) continue
      constant = -base.remainder.n
    }
    if (constant === 0 || Math.abs(constant) > CONSTANT_LIMIT) continue

    const coefficients = [...head, constant]
    const table = syntheticDivision(coefficients, c)
    if (!table || table.degree !== n) continue
    if (!small(table.products) || !small(table.bottom)) continue
    if (want.remainder === 'zero' && !table.isFactor) continue
    if ((want.remainder === 'nonzero' || want.remainder === 'zero-at-opposite') && table.isFactor) continue
    if (want.remainder === 'zero-at-opposite' && polyValueAt(coefficients, -c)?.n !== 0) continue
    const draft: SdDraft = { coefficients, c, table }
    if (!accept(draft)) continue
    return draft
  }
  throw new Error('polyDivision: no division passed the filters in 400 draws')
}

// ---------------------------------------------------------------------------
// The engine's candidates, and the self-tests
// ---------------------------------------------------------------------------

/**
 * Distinct mistake kinds the engine would name on this question's screen, in its priority order.
 *
 * The table screen collects the box and the products, so a slip that hides behind another in the bottom
 * row alone (`shadows`: "subtracted each product" behind "−c in the box") counts there. The other two
 * screens take the bottom row as a list, where only the kind that keeps the row is named.
 */
export function sdTrapKinds(f: string, c: string, question: PolyDivisionQuestion): PolyMistakeKind[] {
  const kinds: PolyMistakeKind[] = []
  const add = (kind: PolyMistakeKind) => {
    if (!kinds.includes(kind)) kinds.push(kind)
  }
  for (const cand of syntheticMistakes(f, c) ?? []) {
    add(cand.kind)
    if (question === 'table') cand.shadows.forEach(add)
  }
  if (question === 'table') for (const cand of quotientMistakes(f, c) ?? []) add(cand.kind)
  if (question !== 'factor') for (const cand of remainderMistakes(f, c) ?? []) add(cand.kind)
  if (question === 'factor') {
    const g = factorSlip(f, c)
    if (g) add(g)
  }
  return kinds
}

/** The kind the engine names when the yes / no answer is the wrong one, or null when it is a plain wrong. */
export function factorSlip(f: string, c: string): PolyMistakeKind | null {
  const t = syntheticDivision(f, c)
  if (!t) return null
  const g = gradeIsFactor(f, c, !t.isFactor)
  return g.verdict === 'mistake' ? g.mistake : null
}

const checked = new Map<string, string | null>()

/**
 * The self-tests of polynomials-core.md §5 for one division, plus the things §5 says to avoid. Returns null
 * when all pass, else what failed. Cached per (f, c): the engine's answers do not change between calls.
 */
export function sdSelfTest(f: string, c: string): string | null {
  const key = `${f} | ${c}`
  const cached = checked.get(key)
  if (cached !== undefined) return cached
  const result = runSelfTest(f, c)
  checked.set(key, result)
  return result
}

function runSelfTest(f: string, c: string): string | null {
  const t = syntheticDivision(f, c)
  if (!t) return 'syntheticDivision returned null'
  if (t.c.n === 0) return 'c = 0: dividing by x'
  if (t.degree < 2) return 'a degree-1 dividend: the quotient is a constant'
  if (ratToString(t.c) !== c) return `c reads back as ${ratToString(t.c)}`
  if (t.rows.coefficients.length !== t.degree + 1 || t.rows.products.length !== t.degree || t.rows.bottom.length !== t.degree + 1) return 'the rows have the wrong lengths'
  const { coefficients, products, bottom } = t.rows
  const ok = (name: string, verdict: string) => (verdict === 'correct' ? null : `${name} is ${verdict}`)
  const failed =
    ok('the coefficient row', gradeCoefficientRow(f, coefficients).verdict) ??
    ok('the coefficient row as a list', gradeCoefficientRow(f, coefficients.join(', ')).verdict) ??
    ok('the table', gradeSyntheticTable(f, c, { bottom, products, box: c }).verdict) ??
    ok('the table cell by cell', gradeDivisionTable(f, c, { box: c, products, bottom }).grade.verdict) ??
    ok('the bottom row as a list', gradeBottomRow(f, c, bottom.join(', ')).verdict) ??
    ok('the quotient', gradeQuotient(f, c, t.quotientText).verdict) ??
    ok('the remainder', gradeRemainder(f, c, t.remainderText).verdict) ??
    ok('the value f(c)', gradeRemainder(f, c, t.remainderText, { ask: 'value' }).verdict) ??
    ok('the factor answer', gradeIsFactor(f, c, t.isFactor).verdict) ??
    ok('the factor answer in words', gradeIsFactor(f, c, t.isFactor ? 'yes' : 'no').verdict)
  if (failed) return failed
  // The hint reveals are cut out of the explanation by position: box, coefficients, bring down, one line
  // per column, the bottom row, the remainder theorem, the factor theorem.
  if (t.explanation.length !== t.degree + 6) return 'the explanation is not the box, the row, the drop, the columns and three closing lines'
  return null
}

// ---------------------------------------------------------------------------
// Parts, hints, and the instance
// ---------------------------------------------------------------------------

const NUDGE: Record<PolyDivisionStageId, string> = {
  row: 'Write one number for each power of x, starting with the highest power and ending with the constant term, signs included. Count the powers down one at a time as you go. Does f(x) have a term for every one of them?',
  grid: 'The box holds the number that makes the divisor equal 0. Bring the first coefficient straight down. Then work one column at a time: multiply the box number by the bottom number you just wrote, put the product under the next coefficient, and add that column.',
  answers: 'Everything you need is in the bottom row. One of its numbers is the remainder. The others are the coefficients of the quotient, and dividing by x − c lowers the degree by one.',
  bottom: 'Set up the table on paper: a number for every power of x in the top row, and in the box the number that makes the divisor 0 (for f(c), that is c). Bring the first coefficient down, then multiply by the box number and add, one column at a time.',
  value: 'The remainder theorem ties the two together: when f(x) is divided by x − c, the remainder is f(c). Find the remainder in your bottom row.',
  factor: 'The factor theorem: x − c is a factor of f(x) exactly when f(c) = 0. The value f(c) is the remainder, and the remainder is in your bottom row.',
}

/** The part of the problem where each slip would show up first. */
const STAGE_KINDS: Record<PolyDivisionStageId, readonly PolyMistakeKind[]> = {
  row: ['sd_missing_placeholder'],
  grid: ['sd_wrong_sign_c', 'sd_subtracted', 'sd_first_coefficient'],
  answers: ['sd_quotient_degree', 'sd_remainder_last_quotient'],
  bottom: ['sd_wrong_sign_c', 'sd_subtracted', 'sd_first_coefficient', 'sd_missing_placeholder'],
  value: ['sd_remainder_last_quotient'],
  factor: [],
}

const STAGE_CARD: Record<PolyDivisionStageId, SdRuleKey> = {
  row: 'row',
  grid: 'add',
  answers: 'read',
  bottom: 'add',
  value: 'remainder',
  factor: 'factor',
}

const QUESTION_STAGES: Record<PolyDivisionQuestion, readonly PolyDivisionStageId[]> = {
  table: ['row', 'grid', 'answers'],
  value: ['bottom', 'value'],
  factor: ['bottom', 'factor'],
}

const QUESTION_CARDS: Record<PolyDivisionQuestion, readonly SdRuleKey[]> = {
  table: ['row', 'box', 'down', 'add', 'read'],
  value: ['box', 'row', 'down', 'add', 'remainder'],
  factor: ['box', 'row', 'down', 'add', 'factor'],
}

/** Which part of a question a named slip belongs to (its rule card leads that part's hints). */
export function sdStageOf(question: PolyDivisionQuestion, kind: string): PolyDivisionStageId | null {
  return QUESTION_STAGES[question].find((id) => (STAGE_KINDS[id] as readonly string[]).includes(kind)) ?? null
}

function stageReveal(id: PolyDivisionStageId, t: SyntheticTable): string[] {
  const n = t.degree
  const e = t.explanation
  // box, coefficients, bring down, then one line per column.
  const working = e.slice(0, 3 + n)
  const bottomRow = e[3 + n]!
  switch (id) {
    case 'row': {
      const g = gradeCoefficientRow(t.f, t.rows.coefficients)
      return g.verdict === 'correct' ? g.explanation : [e[1]!]
    }
    case 'grid':
    case 'bottom':
      return working
    case 'answers':
      return [bottomRow]
    case 'value':
      return [bottomRow, e[4 + n]!]
    case 'factor':
      return [bottomRow, e[5 + n]!]
  }
}

function expectedDisplay(question: PolyDivisionQuestion, t: SyntheticTable): string {
  const bottom = `bottom row ${polyShow(t.rows.bottom.join(', '))}`
  const c = polyShow(ratToString(t.c))
  const divisor = polyShow(t.divisor)
  if (question === 'table') {
    return `top row ${polyShow(t.rows.coefficients.join(', '))}; box ${c}; products ${polyShow(t.rows.products.join(', '))}; ${bottom}; quotient ${polyShow(t.quotientText)}; remainder ${polyShow(t.remainderText)}`
  }
  if (question === 'value') return `${bottom}; f(${c}) = ${polyShow(t.remainderText)}`
  return t.isFactor ? `${bottom}; yes, ${divisor} is a factor (remainder 0)` : `${bottom}; no, ${divisor} is not a factor (remainder ${polyShow(t.remainderText)})`
}

/** The question in one line. It names the divisor or the input and nothing about how the table is filled. */
export function sdPrompt(question: PolyDivisionQuestion, c: string): string {
  const divisor = polyShow(divisorText(c))
  if (question === 'table') return `Divide f(x) by ${divisor} with synthetic division.`
  if (question === 'value') return `Use synthetic division to find f(${polyShow(c)}).`
  return `Is ${divisor} a factor of f(x)?`
}

export interface SdBuild {
  question: PolyDivisionQuestion
  templateId: string
  version: number
  seed: number
  knobs: DifficultyKnobs
  title: string
  instructions: string
  draft: SdDraft
  trap: PolyMistakeKind
  /** What the seed was built around, for tests and debugging: "placeholder", "sign", "factor", … */
  scenario: string
}

export function buildDivision(d: SdBuild): ProblemInstance {
  const t = d.draft.table
  const f = t.f
  const c = ratToString(t.c)
  const where = `${d.templateId}/${d.seed}`
  const problem = sdSelfTest(f, c)
  if (problem) throw new Error(`${where}: ${problem}`)
  // The promised trap has to be one the engine would actually name on this screen.
  if (!sdTrapKinds(f, c, d.question).includes(d.trap)) throw new Error(`${where}: trap ${d.trap} is not a candidate`)

  const primary = sdRuleIdFor(d.trap) ?? SD_RULE_IDS.add
  const ruleCards = [primary, ...QUESTION_CARDS[d.question].map((key) => SD_RULE_IDS[key]).filter((id) => id !== primary)]
  const trapStage = sdStageOf(d.question, d.trap)
  const stages: PolyDivisionStage[] = QUESTION_STAGES[d.question].map((id) => ({
    id,
    nudge: NUDGE[id],
    // The part where the promised slip lives opens on that slip's card; the others on their own.
    ruleCard: id === trapStage ? primary : SD_RULE_IDS[STAGE_CARD[id]],
    reveal: stageReveal(id, t),
  }))
  const n = t.degree
  // Finding f(c) stops at the remainder theorem; the other two questions use the whole explanation.
  const reveal = d.question === 'value' ? t.explanation.slice(0, 5 + n) : t.explanation

  return {
    id: problemId(SD_MODULE_ID, d.templateId, d.version, d.seed),
    moduleId: SD_MODULE_ID,
    templateId: d.templateId,
    skill: d.templateId,
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'polyDivision',
    title: d.title,
    instructions: d.instructions,
    statementText: f,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: {
      type: 'polyDivision',
      question: d.question,
      f,
      c,
      divisor: t.divisor,
      degree: n,
      prompt: sdPrompt(d.question, c),
      rows: { coefficients: [...t.rows.coefficients], products: [...t.rows.products], bottom: [...t.rows.bottom] },
      quotientText: t.quotientText,
      remainderText: t.remainderText,
      isFactor: t.isFactor,
      stages,
      expectedDisplay: expectedDisplay(d.question, t),
      nudge: stages[0]!.nudge,
      ruleCard: primary,
      ruleCards,
      reveal,
      trap: d.trap,
    },
    // No graph and no calculator panel: the table is hand arithmetic, and a graph of f would show its zeros.
    graph: { kind: 'none' },
    calc: NO_CALC,
    params: {
      question: d.question,
      c: d.draft.c,
      degree: n,
      trap: d.trap,
      scenario: d.scenario,
      missing: t.missingPowers.length > 0,
      isFactor: t.isFactor,
    },
  }
}
