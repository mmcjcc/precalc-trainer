/**
 * Long division of a cubic by a quadratic (her worksheet of 2026-11-10: f(x) = cubic / quadratic,
 * problems 5 to 8). Synthetic division cannot take a quadratic divisor, so the work is the long
 * form: divide the leading terms, multiply the whole divisor, subtract, twice, then read off the
 * quotient and the remainder. The templates pick the quotient, the divisor and the remainder; the
 * rounds, the worked lines and every grade come from the engine's `longDivision` / `gradeLongPart`.
 *
 * Two templates: `ld.long` draws a new division each seed, and `ld.worksheet` is the worksheet's own
 * four problems, so she can check her paper work one step at a time.
 */
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { gradeLongPart, longDivision } from '@/engine'
import { polyShow } from '@/content/modules/polynomials/patterns'
import type { CalcPanels } from '@/shared/types'
import { SD_MODULE_ID, type PolyDivisionStage } from './build'
import { LD_CARD_EXAMPLE, SD_RULE_IDS, type SdRuleKey } from './rules'

const VERSION = 1
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

/** No coefficient she meets (dividend, products, what is left) goes past this. */
const LIMIT = 20

type LdStageId = 'ldStep1' | 'ldSub1' | 'ldStep2' | 'ldSub2' | 'ldAnswer'
const STAGES: readonly LdStageId[] = ['ldStep1', 'ldSub1', 'ldStep2', 'ldSub2', 'ldAnswer']

/** Hint rung 1 for each part. None of them names a term, a product or an answer of the problem. */
const NUDGE: Record<LdStageId, string> = {
  ldStep1:
    'Look at the first term of the dividend and the first term of the divisor, and nothing else yet. What do you multiply the first term of the divisor by to get the first term of the dividend? That is the first term of the quotient. Then multiply the whole divisor by it.',
  ldSub1:
    'Picture the product written under the dividend, each term under the term with the same power. Subtract every term of the product, so each of its signs changes. The leading terms cancel, and a term with nothing under it comes down as it is.',
  ldStep2: 'The same two moves on what is left: divide its first term by the first term of the divisor, then multiply the whole divisor by the result.',
  ldSub2: 'Subtract the new product from what was left, every term of it. What remains has a lower degree than the divisor, so this is the last subtraction.',
  ldAnswer: 'The quotient is the two terms you found, added together. The remainder is what the last subtraction left.',
}

const STAGE_CARD: Record<LdStageId, SdRuleKey> = {
  ldStep1: 'ldDivide',
  ldSub1: 'ldSubtract',
  ldStep2: 'ldDivide',
  ldSub2: 'ldSubtract',
  ldAnswer: 'ldStop',
}

/** Coefficients from the highest power down, as app text: [1, 0, 1] is "x^2 + 1". */
function polyText(cs: readonly number[]): string {
  const n = cs.length - 1
  let out = ''
  cs.forEach((c, i) => {
    if (c === 0) return
    const power = n - i
    const size = Math.abs(c)
    const body = power === 0 ? `${size}` : `${size === 1 ? '' : size}${power === 1 ? 'x' : `x^${power}`}`
    out += out === '' ? `${c < 0 ? '-' : ''}${body}` : ` ${c < 0 ? '-' : '+'} ${body}`
  })
  return out || '0'
}

interface LdBuild {
  templateId: string
  seed: number
  knobs: DifficultyKnobs
  title: string
  instructions: string
  /** Highest power first. */
  dividend: readonly number[]
  divisor: readonly number[]
  /** What the problem is built around: "full", "placeholder", "signs", "worksheet". */
  scenario: string
}

/** The slip a problem leans toward, by where the division is most likely to go wrong. Plain text: the catalog has no names for these yet. */
function trapOf(divisor: readonly number[]): 'ld_columns' | 'ld_signs' {
  // A divisor that skips a power makes a product that skips a column: lining up is the hard part there.
  return divisor.slice(1, -1).some((c) => c === 0) ? 'ld_columns' : 'ld_signs'
}

/** Why the engine's division is not one this screen can ask, or null when it is. */
export function ldProblem(dividend: readonly number[], divisor: readonly number[]): string | null {
  const d = longDivision(polyText(dividend), polyText(divisor))
  if (!d) return 'longDivision returned null'
  if (d.rounds.length !== 2) return `${d.rounds.length} rounds: the screen has two`
  if (d.remainder === '0') return 'the division is exact'
  if (d.dividend !== polyText(dividend) || d.divisor !== polyText(divisor)) return 'the polynomials do not read back as they were written'
  const whole = /^-?\d+$/
  for (const r of d.rounds) {
    if (![...r.currentRow, ...r.productRow].every((c) => whole.test(c) && Math.abs(Number(c)) <= LIMIT)) return 'a coefficient is not a small whole number'
  }
  // Every box takes the engine's own answer, and the two answers are not the same polynomial.
  const ok = (what: string, verdict: string) => (verdict === 'correct' ? null : `${what} is ${verdict}`)
  const [a, b] = [d.dividend, d.divisor]
  let failed: string | null = null
  d.rounds.forEach((r, round) => {
    failed ??=
      ok(`term ${round}`, gradeLongPart(a, b, { what: 'term', round }, r.term).verdict) ??
      ok(`product ${round}`, gradeLongPart(a, b, { what: 'product', round }, r.product).verdict) ??
      ok(`difference ${round}`, gradeLongPart(a, b, { what: 'difference', round }, r.difference).verdict)
  })
  failed ??= ok('the quotient', gradeLongPart(a, b, { what: 'quotient' }, d.quotient).verdict) ?? ok('the remainder', gradeLongPart(a, b, { what: 'remainder' }, d.remainder).verdict)
  if (failed) return failed
  if (d.quotient === d.remainder) return 'the quotient and the remainder are the same polynomial'
  if (d.explanation.length !== 7) return 'the explanation is not three lines a round and the result'
  return null
}

function buildLong(b: LdBuild): ProblemInstance {
  const where = `${b.templateId}/${b.seed}`
  const problem = ldProblem(b.dividend, b.divisor)
  if (problem) throw new Error(`${where}: ${problem}`)
  const d = longDivision(polyText(b.dividend), polyText(b.divisor))!
  const trap = trapOf(b.divisor)
  const subtractCard: SdRuleKey = trap === 'ld_columns' ? 'ldColumns' : 'ldSubtract'
  const e = d.explanation
  const reveal: Record<LdStageId, string[]> = {
    ldStep1: [e[0]!, e[1]!],
    ldSub1: [e[2]!],
    ldStep2: [e[3]!, e[4]!],
    ldSub2: [e[5]!],
    ldAnswer: [e[6]!],
  }
  const stages: PolyDivisionStage[] = STAGES.map((id) => ({
    id,
    nudge: NUDGE[id],
    ruleCard: SD_RULE_IDS[id === 'ldSub1' || id === 'ldSub2' ? subtractCard : STAGE_CARD[id]],
    reveal: reveal[id],
  }))
  const primary = SD_RULE_IDS[subtractCard]
  const all: SdRuleKey[] = ['ldDivide', 'ldMultiply', 'ldSubtract', 'ldColumns', 'ldStop']
  const ruleCards = [primary, ...all.map((key) => SD_RULE_IDS[key]).filter((id) => id !== primary)]
  const f = `(${d.dividend})/(${d.divisor})`
  const rounds = d.rounds.map((r, i) => `round ${i + 1}: ${polyShow(r.term)}, product ${polyShow(r.product)}, leaving ${polyShow(r.difference)}`)

  return {
    id: problemId(SD_MODULE_ID, b.templateId, VERSION, b.seed),
    moduleId: SD_MODULE_ID,
    templateId: b.templateId,
    skill: b.templateId,
    genVersion: VERSION,
    seed: b.seed >>> 0,
    knobs: b.knobs,
    kind: 'polyDivision',
    title: b.title,
    instructions: b.instructions,
    statementText: f,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: {
      type: 'polyDivision',
      question: 'long',
      f,
      c: '',
      divisor: d.divisor,
      long: { dividend: d.dividend, rounds: d.rounds.map((r) => ({ ...r, currentRow: [...r.currentRow], productRow: [...r.productRow] })) },
      degree: b.dividend.length - 1,
      prompt: 'Divide with long division, one round at a time. Then give the quotient and the remainder.',
      rows: { coefficients: [], products: [], bottom: [] },
      quotientText: d.quotient,
      remainderText: d.remainder,
      isFactor: false,
      stages,
      expectedDisplay: `${rounds.join('; ')}; quotient ${polyShow(d.quotient)}; remainder ${polyShow(d.remainder)}`,
      nudge: stages[0]!.nudge,
      ruleCard: primary,
      ruleCards,
      reveal: [...e],
      trap,
    },
    // No graph and no calculator panel: the division is hand algebra, and a graph of f would show its slant asymptote.
    graph: { kind: 'none' },
    calc: NO_CALC,
    params: { question: 'long', degree: b.dividend.length - 1, trap, scenario: b.scenario },
  }
}

const INSTRUCTIONS =
  'Five parts, checked one at a time: divide and multiply, subtract, the same two again, then the quotient and the remainder. Every answer is a polynomial in x; type powers with ^.'

// ---------------------------------------------------------------------------
// ld.long: a new division each seed
// ---------------------------------------------------------------------------

/**
 * `full`: a divisor with all three terms. `placeholder`: the divisor skips its x term (x^2 + 1 on her
 * worksheet), so the product skips a column. `signs`: negative terms in the divisor and the quotient, so
 * the subtraction turns on its signs.
 */
const SCENARIOS: readonly { id: 'full' | 'placeholder' | 'signs'; weight: number }[] = [
  { id: 'full', weight: 4 },
  { id: 'placeholder', weight: 3 },
  { id: 'signs', weight: 3 },
]

const LEADS = [1, 1, 2, 2, 3, 4] as const

/** (ax + b)(x^2 + px + s) + (mx + n), redrawn until the engine's division is two clean rounds with every dividend term present. */
function draw(rng: Rng, scenario: (typeof SCENARIOS)[number]['id']): { dividend: number[]; divisor: number[] } {
  for (let tries = 0; tries < 400; tries++) {
    const a = rng.pick(LEADS)
    const b = scenario === 'signs' ? -rng.int(1, 5) : rng.intExcept(-5, 5, [0])
    const p = scenario === 'placeholder' ? 0 : scenario === 'signs' ? -rng.int(1, 4) : rng.intExcept(-4, 4, [0])
    const s = rng.intExcept(-5, 5, [0])
    const m = rng.chance(0.85) ? rng.intExcept(-9, 9, [0]) : 0
    const n = rng.intExcept(-9, 9, [0])
    const dividend = [a, a * p + b, a * s + b * p + m, b * s + n]
    const divisor = [1, p, s]
    if (dividend.some((c) => c === 0 || Math.abs(c) > 15)) continue
    // The rule cards work this one as their example: it is never a problem.
    if (dividend.join() === LD_CARD_EXAMPLE.dividend.join() && divisor.join() === LD_CARD_EXAMPLE.divisor.join()) continue
    if (ldProblem(dividend, divisor)) continue
    return { dividend, divisor }
  }
  throw new Error('polyDivision: no long division passed the filters in 400 draws')
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not tied to seed n of the synthetic templates.
  const rng = makeRng(mixSeed(seed, 5))
  let roll = rng.next() * SCENARIOS.reduce((sum, s) => sum + s.weight, 0)
  const scenario = SCENARIOS.find((s) => (roll -= s.weight) < 0) ?? SCENARIOS[0]!
  const { dividend, divisor } = draw(rng, scenario.id)
  return buildLong({ templateId: 'ld.long', seed, knobs, title: 'Long division', instructions: INSTRUCTIONS, dividend, divisor, scenario: scenario.id })
}

export const longTemplate: TemplateDef = {
  id: 'ld.long',
  title: 'Long division by a quadratic',
  description:
    'Divide a cubic by a quadratic, where synthetic division does not apply. She finds each term of the quotient, multiplies the whole divisor by it and subtracts, one checked step at a time, then gives the quotient and the remainder.',
  version: VERSION,
  knobs: [],
  generate,
}

// ---------------------------------------------------------------------------
// ld.worksheet: the four problems of her worksheet
// ---------------------------------------------------------------------------

/** Problems 5 to 8 of the worksheet, as printed: dividend and divisor, highest power first. */
export const LD_WORKSHEET: readonly { n: number; dividend: readonly number[]; divisor: readonly number[] }[] = [
  { n: 5, dividend: [1, 3, 2, -5], divisor: [1, 0, 1] },
  { n: 6, dividend: [2, -3, 4, 7], divisor: [1, -1, 2] },
  { n: 7, dividend: [3, 5, -2, 6], divisor: [1, 2, -3] },
  { n: 8, dividend: [4, -7, 3, -8], divisor: [1, -3, 4] },
]

function generateWorksheet(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const w = LD_WORKSHEET[(seed >>> 0) % LD_WORKSHEET.length]!
  return buildLong({
    templateId: 'ld.worksheet',
    seed,
    knobs,
    title: `Worksheet problem ${w.n}`,
    instructions: INSTRUCTIONS,
    dividend: w.dividend,
    divisor: w.divisor,
    scenario: 'worksheet',
  })
}

export const worksheetTemplate: TemplateDef = {
  id: 'ld.worksheet',
  title: 'Worksheet problems 5 to 8',
  description: 'The four long divisions from her worksheet (a cubic over a quadratic), each worked one checked step at a time. A new problem cycles to the next of the four.',
  version: VERSION,
  knobs: [],
  generate: generateWorksheet,
}
