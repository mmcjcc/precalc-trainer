/**
 * Factoring polynomials: drawing a problem from the seed, the slips it has, the hints, and the self-checks run on
 * every generated seed. The complete factorization is the engine's (`factorOverIntegers`); the templates pick the
 * numbers that go into the pattern, and every slip is checked to grade as its own id.
 *
 * Reserved for the examples on rule cards and catalog entries (never drawn, and tested): 7 as a common factor or
 * a leading coefficient, 10 as a cube root, 11 and 12 anywhere, and the quartic x^4 − 10000 (n = 10 in m^4x^4 − n^4; no square or cube draws 10 either).
 */
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, FactoringQuestion, FactoringShape, FactoringStageId, ProblemInstance, TemplateDef } from '@/content/types'
import { factorOverIntegers, readProduct } from '@/engine'
import { polyEquals, polyToText, type Poly } from '@/engine/functions/poly'
import { readPoly } from '@/engine/polynomials/common'
import type { ErrorPatternId } from '@/shared/types'
import { FA_KEYS, canonicalEntries, faShow, gcfText, gradeFactoringStage, type FactoringAnswer } from './grade'
import { FA_RULES, FA_RULE_IDS, faRuleIdFor, type FaRuleKey } from './rules'

export const FA_MODULE_ID = 'factoring' as const

/** Numbers the examples use. No draw uses them (factoring.test.ts). */
export const FA_RESERVED = { gcfNumber: 7, leading: 7, cubeRoot: 10, anywhere: [11, 12], quarticN: 10 } as const

type Slip = FactoringAnswer['slips'][number]

// ---------------------------------------------------------------------------
// Text helpers (app syntax)
// ---------------------------------------------------------------------------

function poly(text: string): Poly {
  const p = readPoly(text)
  if (!p) throw new Error(`factoring: cannot read ${text}`)
  return p.poly
}

/** Standard form of any polynomial text: "(x + 2)(x - 2)" → "x^2 - 4". */
export function std(text: string): string {
  return polyToText(poly(text))
}

/** m·x + q, app syntax: "x - 2", "2x + 3", "x". */
export function lin(m: number, q: number): string {
  const head = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`
  if (q === 0) return head
  return q > 0 ? `${head} + ${q}` : `${head} - ${-q}`
}

/** A signed number as a factor in a sentence: "3", "(−3)". */
function par(n: number): string {
  return n < 0 ? `(−${-n})` : `${n}`
}

/** A number in a sentence, with the real minus sign. */
function num(n: number): string {
  return n < 0 ? `−${-n}` : `${n}`
}

/** "3x", "−x", "x" in a sentence. */
function xs(c: number): string {
  return c === 1 ? 'x' : c === -1 ? '−x' : `${num(c)}x`
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x
}

function weighted<T>(rng: Rng, items: readonly [T, number][]): T {
  let roll = rng.next() * items.reduce((s, [, w]) => s + w, 0)
  for (const [item, w] of items) {
    roll -= w
    if (roll < 0) return item
  }
  return items[items.length - 1]![0]
}

function smallestPrime(n: number): number {
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return p
  return n
}

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

const NUDGE = {
  gcf: 'Find the biggest number that divides every coefficient, and the lowest power of x that appears in every term. Take both out together, then divide each term by what you took out.',
  squares: 'Count the terms and look at the signs. Two squares with a minus between them have a pattern, and so do a square, a middle term and a square. Two squares with a plus between them and nothing else do not factor.',
  cubed: 'Write each term as something cubed. For the number in front, ask which number multiplied by itself three times gives it; the cube root of x^3 is x.',
  cubedGcf: 'Take the common factor out first. Then write each term inside the parentheses as something cubed: which number multiplied by itself three times gives the number in front?',
  cubes: 'Use the pattern you wrote at the top of the worksheet: same, opposite, always plus. The binomial is made of the two cube roots, and the trinomial is built from them.',
  triMonic: 'Look for two numbers that multiply to the last term and add to the middle coefficient. The signs of the last and middle terms tell you their signs.',
  triLead: 'The first terms of the two binomials multiply to the first term, and their last terms multiply to the last term. Try the pairs until the outer and inner products add to the middle term.',
  pairs: 'Split the four terms into the first two and the last two, and take the greatest common factor out of each pair. When the third term is negative, take out a negative number, so both pairs show the same binomial.',
  groupProduct: 'Both pairs now share a binomial: take it out, and keep what is left of each pair as the other factor. Then look at that factor: can it be factored again?',
  complete: 'Take out any common factor first. Then count the terms of what is left and use the pattern that fits, and check every factor again at the end.',
} as const

const QUESTION_CARDS: Record<FactoringQuestion, readonly FaRuleKey[]> = {
  gcf: ['gcf', 'gcfOne'],
  squares: ['squares', 'dos', 'pst', 'sos'],
  cubes: ['cubes', 'cubeRoots', 'gcf'],
  trinomial: ['tri', 'triA', 'signs'],
  grouping: ['group', 'groupSign', 'dos', 'complete'],
  complete: ['complete', 'gcf', 'dos', 'cubes', 'tri', 'sos'],
}

/** Instructions say how to type, with an example no problem can be (11 and 12 are reserved). */
const INSTRUCTIONS: Record<FactoringQuestion, string> = {
  gcf: 'Type the factored form as a product, like 3x(x - 11). Use ^ for powers.',
  squares: 'Type the factored form as a product, like (x - 11)(x + 12), or choose that it does not factor over the integers.',
  cubes: 'First say what is cubed in each term. Then type the factored form as a product, like (x - 11)(x^2 + 12).',
  trinomial: 'Type the factored form as a product of two binomials, like (x - 11)(x + 12).',
  grouping: 'Factor each pair, then type the factored form as a product, like (x - 11)(x^2 + 12).',
  complete: 'Type the factored form as a product, like 3x(x - 11)(x + 12). Keep going until no factor can be factored again.',
}

const PROMPTS: Record<FactoringQuestion, readonly string[]> = {
  gcf: ['Factor out the greatest common factor.', 'Factor by taking out the greatest common factor.', 'Write the polynomial as its greatest common factor times what is left.'],
  squares: ['Factor completely over the integers, or say that it does not factor.', 'Factor if you can. If it does not factor over the integers, say so.', 'Factor over the integers, or choose that it does not factor.'],
  cubes: ['Factor completely.', 'Factor the polynomial completely over the integers.', 'Factor completely, using the pattern for cubes.', 'Write the polynomial as a product of factors that do not factor further.'],
  trinomial: ['Factor the trinomial.', 'Factor completely over the integers.', 'Write the trinomial as a product of two binomials.'],
  grouping: ['Factor by grouping.', 'Factor the four terms by grouping, completely.', 'Group the terms in pairs and factor completely.'],
  complete: ['Factor completely.', 'Factor completely over the integers.', 'Factor until no factor can be factored again.'],
}

const TITLES: Record<FactoringQuestion, string> = {
  gcf: 'Greatest common factor',
  squares: 'Squares: difference, perfect square, or neither',
  cubes: 'Sum or difference of cubes',
  trinomial: 'Factoring trinomials',
  grouping: 'Factoring by grouping',
  complete: 'Factor completely',
}

// ---------------------------------------------------------------------------
// Building the instance, and the checks run on every seed
// ---------------------------------------------------------------------------

interface FaDraft {
  question: FactoringQuestion
  f: string
  shape: FactoringShape
  prime?: boolean
  cubed?: FactoringAnswer['cubed']
  pairs?: FactoringAnswer['pairs']
  choiceOrder?: FactoringAnswer['choiceOrder']
  stages: { id: FactoringStageId; nudge: string; card: FaRuleKey; reveal: string[] }[]
  slips: Slip[]
  /** Closing lines of the explanation after the stages' own. */
  closing?: string[]
}

interface FaTemplateSpec {
  question: FactoringQuestion
  templateId: string
  salt: number
  draw: (rng: Rng) => FaDraft
}

/** Slips with a product equal to another's (or the right answer, for a slip that should differ) are dropped. */
function keepDistinct(slips: Slip[], f: Poly): Slip[] {
  const kept: Slip[] = []
  const same = new Set<ErrorPatternId>(['fa_stopped_early', 'fa_gcf_not_greatest'])
  for (const s of slips) {
    const key = Object.keys(s.entries).find((k) => k !== FA_KEYS.choice)!
    const r = readProduct(s.entries[key]!)
    if (!r.ok) continue
    if (s.stage === 'product' && !same.has(s.id) && polyEquals(r.poly, f)) continue
    const twin = kept.find((k) => {
      if (k.stage !== s.stage) return false
      const kk = Object.keys(k.entries).find((x) => x !== FA_KEYS.choice)!
      if (kk !== key) return false
      const kr = readProduct(k.entries[kk]!)
      return kr.ok && polyEquals(kr.poly, r.poly) && !same.has(k.id) && !same.has(s.id)
    })
    if (twin) continue
    kept.push(s)
  }
  return kept
}

/** Every answer a part checks, compact (no spaces, ASCII), for the leak checks. */
export function stageAnswers(answer: FactoringAnswer, stage: FactoringStageId): string[] {
  const compact = (t: string) => t.replace(/\s+/g, '').replace(/−/g, '-')
  switch (stage) {
    case 'cubed': {
      // The two terms written as cubes: "(2x)^3" and "3^3" (x^3 itself is in the polynomial, so it is not checked).
      const c = answer.cubed!
      const out = [compact(`${c.second}^3`)]
      if (answer.shape.m >= 2) out.push(compact(`(${c.first})^3`))
      return out
    }
    case 'pairs':
      return [compact(answer.pairs!.firstAnswer), compact(answer.pairs!.secondAnswer)]
    case 'product':
      return answer.prime ? [] : [compact(answer.answerText)]
  }
}

/** Does `text` hold one of the answers? Compared compact, so spacing and the minus sign do not hide it. */
export function leaks(text: string, answers: readonly string[]): boolean {
  const t = text.replace(/\s+/g, '').replace(/−/g, '-')
  return answers.some((a) => a.length > 0 && t.includes(a))
}

/** The checks every generated problem passes; null when all pass, else what failed. */
export function faSelfTest(answer: FactoringAnswer): string | null {
  const full = factorOverIntegers(answer.f)
  if (!full) return 'the engine cannot factor f'
  if (answer.prime !== full.prime) return `prime is ${answer.prime}, the engine says ${full.prime}`
  if (!answer.prime && answer.answerText !== full.text) return `the answer ${answer.answerText} is not the engine's ${full.text}`
  // The answers, typed the way she would type them, pass the module's own grading.
  const right = canonicalEntries(answer)
  for (const st of answer.stages) {
    const g = gradeFactoringStage(answer, st.id, right)
    const bad = g.parts.find((p) => p.grade.verdict !== 'correct')
    if (bad) return `the canonical ${st.id} (${bad.key}) grades ${bad.grade.verdict}`
  }
  // Every slip is a real candidate: it grades as exactly its id at its own part.
  const values = new Map<string, string>()
  for (const s of answer.slips) {
    const entries = { ...right, ...s.entries }
    const g = gradeFactoringStage(answer, s.stage, entries)
    const named = g.parts.filter((p) => p.grade.verdict === 'mistake')
    if (named.length !== 1 || named[0]!.grade.verdict !== 'mistake' || named[0]!.grade.mistake !== s.id) {
      return `slip ${s.id} at ${s.stage} grades ${g.parts.map((p) => (p.grade.verdict === 'mistake' ? p.grade.mistake : p.grade.verdict)).join('/')}`
    }
    if (g.parts.some((p) => p.grade.verdict !== 'mistake' && p.grade.verdict !== 'correct')) return `slip ${s.id} leaves another box not correct`
    const key = JSON.stringify([s.stage, s.entries])
    if (values.has(key)) return `slips ${values.get(key)} and ${s.id} are the same answer`
    values.set(key, s.id)
    if (Object.entries(s.entries).every(([k, v]) => k === FA_KEYS.choice || v === right[k])) return `slip ${s.id} types the right answer`
  }
  if (answer.trap && !answer.slips.some((s) => s.id === answer.trap && s.stage === answer.trapStage)) return `trap ${answer.trap} is not a slip`
  // No hint, prompt or rule card a part shows holds that part's answer.
  const cards = new Map(FA_RULES.map((c) => [c.id, c]))
  for (const st of answer.stages) {
    const ans = stageAnswers(answer, st.id)
    if (leaks(st.nudge, ans)) return `the ${st.id} nudge holds the answer`
    if (leaks(answer.prompt, ans)) return 'the prompt holds the answer'
    for (const id of answer.ruleCards) {
      const c = cards.get(id)
      if (c && leaks(`${c.title} ${c.body} ${c.example ?? ''}`, ans)) return `rule card ${id} holds the ${st.id} answer`
    }
  }
  return null
}

function buildInstance(spec: FaTemplateSpec, seed: number, knobs: DifficultyKnobs): ProblemInstance {
  const rng = makeRng(mixSeed(seed, spec.salt))
  const d = spec.draw(rng)
  const where = `${spec.templateId}/${seed}`
  const full = factorOverIntegers(d.f)
  if (!full) throw new Error(`${where}: the engine cannot factor ${d.f}`)
  const prompt = rng.pick(PROMPTS[spec.question])
  const slips = keepDistinct(d.slips, poly(d.f))
  // The trap: one of this problem's slips, picked by the seed.
  const ids = [...new Set(slips.map((s) => s.id))]
  const trap = ids.length ? rng.pick(ids) : undefined
  const trapStage = trap ? slips.find((s) => s.id === trap)!.stage : undefined
  const primaryKey = trap ? faRuleIdFor(trap) : null
  const stages: FactoringAnswer['stages'] = d.stages.map((st) => ({
    id: st.id,
    nudge: st.nudge,
    ruleCard: trap && st.id === trapStage && primaryKey ? primaryKey : FA_RULE_IDS[st.card],
    reveal: [...st.reveal],
  }))
  const primary = stages.find((s) => s.id === trapStage)?.ruleCard ?? stages[0]!.ruleCard
  const ruleCards = [primary, ...QUESTION_CARDS[spec.question].map((k) => FA_RULE_IDS[k]).filter((id) => id !== primary)]
  const prime = Boolean(d.prime)
  const f = d.f
  const expectedDisplay = prime ? `${faShow(f)} does not factor over the integers.` : `${faShow(f)} = ${faShow(full.text)}`
  const answer: FactoringAnswer = {
    type: 'factoring',
    question: spec.question,
    f,
    prompt,
    answerText: prime ? '' : full.text,
    prime,
    shape: d.shape,
    ...(d.choiceOrder ? { choiceOrder: d.choiceOrder } : {}),
    ...(d.pairs ? { pairs: d.pairs } : {}),
    ...(d.cubed ? { cubed: d.cubed } : {}),
    stages,
    slips,
    expectedDisplay,
    nudge: stages[0]!.nudge,
    ruleCard: primary,
    ruleCards,
    reveal: [...stages.flatMap((s) => s.reveal), ...(d.closing ?? [])],
    ...(trap ? { trap, trapStage } : {}),
  }
  const failed = faSelfTest(answer)
  if (failed) throw new Error(`${where}: ${failed}`)
  return {
    id: problemId(FA_MODULE_ID, spec.templateId, 1, seed),
    moduleId: FA_MODULE_ID,
    templateId: spec.templateId,
    skill: spec.templateId,
    genVersion: 1,
    seed: seed >>> 0,
    knobs,
    kind: 'factoring',
    title: TITLES[spec.question],
    instructions: INSTRUCTIONS[spec.question],
    statementText: f,
    vars: ['x'],
    start: null,
    canonical: [],
    answer,
    graph: { kind: 'none' },
    calc: { ti84: [], nspire: [] },
    params: { question: spec.question, core: d.shape.core, trap: trap ?? 'none', g: d.shape.g, e: d.shape.e },
  }
}

function template(spec: FaTemplateSpec, title: string, description: string): TemplateDef {
  return { id: spec.templateId, title, description, version: 1, knobs: [], generate: (seed, knobs) => buildInstance(spec, seed, knobs) }
}

const shapeOf = (s: Partial<FactoringShape> & Pick<FactoringShape, 'core' | 'inner'>): FactoringShape => ({ g: 1, e: 0, m: 1, n: 0, s: 1, k: [], ...s })

const product = (id: ErrorPatternId, text: string, extra: Record<string, string> = {}): Slip => ({ id, stage: 'product', entries: { ...extra, [FA_KEYS.product]: text } })

// ---------------------------------------------------------------------------
// fa.gcf
// ---------------------------------------------------------------------------

const GCF_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10] as const

function drawGcf(rng: Rng): FaDraft {
  const mode = weighted<'number' | 'power' | 'both'>(rng, [
    ['number', 3],
    ['power', 2.5],
    ['both', 4.5],
  ])
  const g = mode === 'power' ? 1 : rng.pick(GCF_NUMBERS)
  const e = mode === 'number' ? 0 : rng.int(1, 3)
  const one = rng.chance(0.45)
  let inner = ''
  let c0 = 0
  for (let tries = 0; tries < 200; tries++) {
    const deg = rng.chance(0.5) ? 1 : 2
    const lead = rng.int(1, 9)
    c0 = one ? rng.sign() : rng.sign() * rng.int(2, 9)
    const c1 = deg === 2 ? (rng.chance(0.25) ? 0 : rng.sign() * rng.int(1, 9)) : 0
    if (gcd(gcd(lead, c1), c0) !== 1) continue
    if (lead === FA_RESERVED.leading) continue
    inner = deg === 1 ? lin(lead, c0) : std(`${lead}x^2 + ${c1}x + ${c0}`)
    if (deg === 2 && !factorOverIntegers(inner)?.prime) continue
    break
  }
  const G = gcfText(g, e)
  const f = std(`${G || '1'}(${inner})`)
  const slips: Slip[] = []
  if (g >= 2) {
    const p = smallestPrime(g)
    const out = gcfText(g / p, e)
    if (out) slips.push(product('fa_gcf_not_greatest', `${out}(${std(`${p}(${inner})`)})`))
  }
  if (e >= 1 && gcfText(g, e - 1)) slips.push(product('fa_gcf_not_greatest', `${gcfText(g, e - 1)}(${std(`x(${inner})`)})`))
  if (Math.abs(c0) === 1) slips.push(product('fa_gcf_dropped_one', `${G}(${std(`${inner} - (${c0})`)})`))
  const Gs = faShow(G)
  return {
    question: 'gcf',
    f,
    shape: shapeOf({ core: 'gcf', g, e, inner }),
    stages: [
      {
        id: 'product',
        nudge: NUDGE.gcf,
        card: 'gcf',
        reveal: [
          g > 1 && e > 0
            ? `${g} is the biggest number that divides every coefficient, and ${e === 1 ? 'x' : `x^${e}`} is the lowest power of x in every term, so the greatest common factor is ${Gs}.`
            : g > 1
              ? `${g} is the biggest number that divides every coefficient, and not every term has an x, so the greatest common factor is ${g}.`
              : `No number bigger than 1 divides every coefficient, and ${Gs} is the lowest power of x in every term, so the greatest common factor is ${Gs}.`,
          `Divide each term by ${Gs} and keep what is left inside the parentheses: ${faShow(inner)}.`,
          `${faShow(f)} = ${Gs}(${faShow(inner)}).`,
          `Nothing divides every term of ${faShow(inner)} any more, and it does not factor further over the integers.`,
        ],
      },
    ],
    slips,
  }
}

// ---------------------------------------------------------------------------
// fa.squares
// ---------------------------------------------------------------------------

function drawRootPair(rng: Rng, ms: readonly [number, number][], nMax: number): { m: number; n: number } {
  const m = weighted(rng, ms)
  const bad: number[] = []
  for (let n = 1; n <= nMax; n++) if (gcd(m, n) !== 1) bad.push(n)
  const n = rng.intExcept(1, nMax, bad)
  return { m, n }
}

function drawSquares(rng: Rng): FaDraft {
  const core = weighted<'dos' | 'pst' | 'sos'>(rng, [
    ['dos', 45],
    ['pst', 35],
    ['sos', 20],
  ])
  const { m, n } = drawRootPair(
    rng,
    [
      [1, 40],
      [2, 20],
      [3, 15],
      [4, 12],
      [5, 13],
    ],
    9,
  )
  const s = rng.sign()
  const choiceOrder = rng.shuffle(['factors', 'prime'] as const)
  const A = m === 1 ? 'x' : `${m}x`
  const As = m === 1 ? 'x' : `(${m}x)`
  const factors = { [FA_KEYS.choice]: 'factors' }
  let f: string
  let reveal: string[]
  const slips: Slip[] = []
  if (core === 'dos') {
    f = std(`${m * m}x^2 - ${n * n}`)
    reveal = [
      `${faShow(f)} = ${As}^2 − ${n}^2: two squares with a minus between them, a difference of two squares.`,
      `a^2 − b^2 = (a + b)(a − b) with a = ${A} and b = ${n}, so ${faShow(f)} = (${faShow(lin(m, n))})(${faShow(lin(m, -n))}).`,
    ]
    slips.push(product('fa_diff_as_square', `(${lin(m, -n)})^2`, factors), product('fa_diff_as_square', `(${lin(m, n)})^2`, factors))
  } else if (core === 'pst') {
    f = std(`(${lin(m, s * n)})^2`)
    reveal = [
      `The first and last terms are squares, ${As}^2 and ${n}^2, and the middle term is 2 · ${A} · ${n} = ${2 * m * n}x, with a ${s > 0 ? 'plus' : 'minus'} sign: a perfect-square trinomial.`,
      `So ${faShow(f)} = (${faShow(lin(m, s * n))})^2.`,
    ]
    slips.push(product('fa_square_sign', `(${lin(m, -s * n)})^2`, factors))
  } else {
    f = std(`${m * m}x^2 + ${n * n}`)
    reveal = [
      `${faShow(f)} = ${As}^2 + ${n}^2: two squares with a plus between them and no middle term.`,
      '(a + b)(a − b) gives a minus sign and (a + b)^2 gives a middle term, so no product with whole-number coefficients multiplies out to it: it does not factor over the integers.',
    ]
    slips.push(
      product('fa_sum_of_squares', `(${lin(m, n)})(${lin(m, -n)})`, factors),
      product('fa_sum_of_squares', `(${lin(m, n)})^2`, factors),
      product('fa_sum_of_squares', `(${lin(m, -n)})^2`, factors),
    )
  }
  return {
    question: 'squares',
    f,
    shape: shapeOf({ core, m, n, s: core === 'pst' ? s : core === 'dos' ? -1 : 1, inner: f }),
    prime: core === 'sos',
    choiceOrder: [...choiceOrder],
    stages: [{ id: 'product', nudge: NUDGE.squares, card: 'squares', reveal }],
    slips,
  }
}

// ---------------------------------------------------------------------------
// fa.cubes (and the cube slips that fa.complete reuses)
// ---------------------------------------------------------------------------

/** The trinomial of the cube pattern for (mx)^3 + s·n^3 with a middle sign `mid` (−s is right) and a last sign. */
function cubeTri(m: number, n: number, mid: number, last: number): string {
  return std(`${m * m}x^2 + ${mid * m * n}x + ${last * n * n}`)
}

function cubeSlips(G: string, m: number, n: number, s: 1 | -1): Slip[] {
  const A = lin(m, s * n)
  return [
    product('fa_cube_middle_sign', `${G}(${A})(${cubeTri(m, n, s, 1)})`),
    product('fa_cube_middle_doubled', `${G}(${A})(${cubeTri(m, n, -2 * s, 1)})`),
    product('fa_cube_last_negative', `${G}(${A})(${cubeTri(m, n, -s, -1)})`),
    product('fa_cube_binomial_cubed', `${G}(${A})^3`),
  ]
}

function cubeReveal(f: string, G: string, inner: string, m: number, n: number, s: 1 | -1): { cubed: string[]; product: string[] } {
  const A = m === 1 ? 'x' : `${m}x`
  const As = m === 1 ? 'x' : `(${m}x)`
  const sign = s > 0 ? '+' : '−'
  const take = G ? [`Take out the common factor first: ${faShow(f)} = ${faShow(G)}(${faShow(inner)}).`] : []
  const tri = faShow(cubeTri(m, n, -s, 1))
  return {
    cubed: [...take, `${faShow(inner)} = ${As}^3 ${sign} ${n}^3, so the two things cubed are ${A} and ${n}.`],
    product: [
      `Same: the binomial has the same sign as the cubes, (${faShow(lin(m, s * n))}).`,
      `Opposite: the middle term of the trinomial takes the other sign: ${s > 0 ? '−' : '+'}${A} · ${n} = ${s > 0 ? '−' : '+'}${m * n === 1 ? '' : m * n}x.`,
      `Always plus: the last term is ${n}^2 = ${n * n}, and the first is ${As}^2 = ${m * m === 1 ? '' : m * m}x^2.`,
      `${faShow(f)} = ${G ? faShow(G) : ''}(${faShow(lin(m, s * n))})(${tri}).`,
      `The trinomial ${tri} does not factor further over the integers.`,
    ],
  }
}

/** (mx)^3 ± n^3: m = 1 with n = 1..6, m = 2 with n odd, m = 3 with n not a multiple of 3. */
const CUBE_PAIRS: readonly { m: number; n: number }[] = [1, 2, 3].flatMap((m) =>
  [1, 2, 3, 4, 5, 6].filter((n) => gcd(m, n) === 1).map((n) => ({ m, n })),
)

function drawCubes(rng: Rng): FaDraft {
  const withGcf = rng.chance(0.25)
  const common = withGcf
    ? rng.pick([
        { g: 2, e: 0 },
        { g: 3, e: 0 },
        { g: 4, e: 0 },
        { g: 5, e: 0 },
        { g: 1, e: 1 },
        { g: 2, e: 1 },
      ] as const)
    : { g: 1, e: 0 }
  // The 13 pairs (m, n) with n prime to m, equally likely: no pair of cube roots is drawn too often.
  const { m, n } = rng.pick(CUBE_PAIRS)
  const s = rng.sign()
  const G = gcfText(common.g, common.e)
  const inner = std(`${m ** 3}x^3 + ${s * n ** 3}`)
  const f = std(`${G || '1'}(${inner})`)
  const first = m === 1 ? 'x' : `${m}x`
  const slips: Slip[] = cubeSlips(G, m, n, s)
  if (m >= 2) {
    slips.push(product('fa_cube_root_coefficient', `${G}(${lin(m ** 3, s * n)})(${std(`${m ** 6}x^2 + ${-s * m ** 3 * n}x + ${n * n}`)})`))
    slips.push({ id: 'fa_cube_root_coefficient', stage: 'cubed', entries: { [FA_KEYS.cube1]: `${m ** 3}x`, [FA_KEYS.cube2]: `${n}` } })
  }
  if (n >= 2) slips.push({ id: 'fa_cube_root_coefficient', stage: 'cubed', entries: { [FA_KEYS.cube1]: first, [FA_KEYS.cube2]: `${n ** 3}` } })
  if (G) slips.push(product('fa_stopped_early', `${G}(${inner})`))
  const r = cubeReveal(f, G, inner, m, n, s)
  return {
    question: 'cubes',
    f,
    shape: shapeOf({ core: 'cubes', g: common.g, e: common.e, m, n, s, inner }),
    cubed: { first, second: `${n}` },
    stages: [
      { id: 'cubed', nudge: G ? NUDGE.cubedGcf : NUDGE.cubed, card: 'cubeRoots', reveal: r.cubed },
      { id: 'product', nudge: NUDGE.cubes, card: 'cubes', reveal: r.product },
    ],
    slips,
  }
}

// ---------------------------------------------------------------------------
// fa.trinomial
// ---------------------------------------------------------------------------

function factorPairs(a: number): [number, number][] {
  const out: [number, number][] = []
  for (let d = 1; d <= a; d++) if (a % d === 0) out.push([d, a / d])
  return out
}

function drawTrinomial(rng: Rng): FaDraft {
  const monic = rng.chance(0.45)
  const pattern = rng.int(0, 3)
  const bPos = pattern % 2 === 0
  const cPos = pattern < 2
  let p0 = 1
  let p1 = 1
  let q0 = 0
  let q1 = 0
  if (monic) {
    const sb = bPos ? 1 : -1
    if (cPos) {
      const a = rng.int(1, 9)
      const b = rng.intExcept(1, 9, [a])
      q0 = sb * a
      q1 = sb * b
    } else {
      const big = rng.int(2, 9)
      const small = rng.int(1, big - 1)
      q0 = sb * big
      q1 = -sb * small
    }
  } else {
    const a = rng.int(2, 6)
    for (let tries = 0; tries < 400; tries++) {
      ;[p0, p1] = rng.pick(factorPairs(a))
      q0 = rng.sign() * rng.int(1, 9)
      q1 = rng.sign() * rng.int(1, 9)
      const b = p0 * q1 + p1 * q0
      const c = q0 * q1
      if (gcd(p0, q0) !== 1 || gcd(p1, q1) !== 1) continue
      if (b === 0 || b > 0 !== bPos || c > 0 !== cPos || Math.abs(b) > 45) continue
      if (p0 === p1 && q0 === q1) continue
      break
    }
  }
  const a = p0 * p1
  const b = p0 * q1 + p1 * q0
  const c = q0 * q1
  const f = std(`(${lin(p0, q0)})(${lin(p1, q1)})`)
  const slips: Slip[] = [product('fa_tri_signs_swapped', `(${lin(p0, -q0)})(${lin(p1, -q1)})`)]
  // Another pair with the right first and last terms and a middle term that is neither b nor −b.
  const pairs: string[] = []
  const seen = new Set<number>()
  for (const [r0, r1] of factorPairs(a)) {
    for (let s0 = -Math.abs(c); s0 <= Math.abs(c); s0++) {
      if (s0 === 0 || c % s0 !== 0) continue
      const s1 = c / s0
      const mid = r0 * s1 + r1 * s0
      if (mid === b || mid === -b || seen.has(mid)) continue
      if (gcd(r0, s0) !== 1 || gcd(r1, s1) !== 1) continue
      seen.add(mid)
      pairs.push(`(${lin(r0, s0)})(${lin(r1, s1)})`)
    }
  }
  if (pairs.length) slips.push(product('fa_tri_wrong_pair', rng.pick(pairs)))
  const ans = faShow(factorOverIntegers(f)!.text)
  const reveal = monic
    ? [`Look for two numbers that multiply to ${num(c)} and add to ${num(b)}: ${num(q0)} and ${num(q1)}, since ${par(q0)} · ${par(q1)} = ${num(c)} and ${par(q0)} + ${par(q1)} = ${num(b)}.`, `${faShow(f)} = ${ans}.`]
    : [
        `The first terms multiply to ${a}x^2: ${xs(p0)} and ${xs(p1)}. The last terms multiply to ${num(c)}: ${num(q0)} and ${num(q1)}.`,
        `Check the middle term: the outer product is ${xs(p0)} · ${par(q1)} = ${xs(p0 * q1)}, the inner product is ${par(q0)} · ${xs(p1)} = ${xs(p1 * q0)}, and together they make ${xs(b)}.`,
        `${faShow(f)} = ${ans}.`,
      ]
  return {
    question: 'trinomial',
    f,
    shape: shapeOf({ core: 'tri', k: [p0, q0, p1, q1], inner: f }),
    stages: [{ id: 'product', nudge: monic ? NUDGE.triMonic : NUDGE.triLead, card: monic ? 'tri' : 'triA', reveal }],
    slips,
  }
}

// ---------------------------------------------------------------------------
// fa.grouping
// ---------------------------------------------------------------------------

function drawGrouping(rng: Rng): FaDraft {
  const t = rng.sign() * rng.int(1, 6)
  const scenario = weighted<'square' | 'plus' | 'minus'>(rng, [
    ['square', 35],
    ['plus', 35],
    ['minus', 30],
  ])
  const k = scenario === 'square' ? rng.intExcept(2, 6, [Math.abs(t)]) : 0
  const u = scenario === 'square' ? -k * k : scenario === 'plus' ? rng.int(2, 9) : -rng.pick([2, 3, 5, 6, 7, 8])
  const binom = lin(1, t)
  const f = std(`(${binom})(x^2 + ${u})`)
  const first = std(`x^3 + ${t}x^2`)
  const second = std(`${u}x + ${t * u}`)
  const firstAnswer = `x^2(${binom})`
  const secondAnswer = `${u}(${binom})`
  const slips: Slip[] = [{ id: 'fa_gcf_not_greatest', stage: 'pairs', entries: { [FA_KEYS.pair1]: `x(${std(`x^2 + ${t}x`)})`, [FA_KEYS.pair2]: secondAnswer } }]
  if (u < 0) slips.push({ id: 'fa_group_sign', stage: 'pairs', entries: { [FA_KEYS.pair1]: firstAnswer, [FA_KEYS.pair2]: `${u}(${lin(1, -t)})` } })
  const rest = std(`x^2 + ${u}`)
  if (scenario === 'square') {
    slips.push(product('fa_stopped_early', `(${binom})(${rest})`))
    slips.push(product('fa_diff_as_square', `(${binom})(${lin(1, -k)})^2`))
  }
  const ans = faShow(factorOverIntegers(f)!.text)
  return {
    question: 'grouping',
    f,
    shape: shapeOf({ core: 'group', k: [t, u], inner: f }),
    pairs: { first, second, firstAnswer, secondAnswer },
    stages: [
      {
        id: 'pairs',
        nudge: NUDGE.pairs,
        card: 'group',
        reveal: [
          `Group the first two terms and the last two: (${faShow(first)}) + (${faShow(second)}).`,
          `${faShow(first)} = ${faShow(firstAnswer)}.`,
          `${faShow(second)} = ${faShow(secondAnswer)}${u < 0 ? ': taking out a negative number changes both signs inside' : ''}.`,
        ],
      },
      {
        id: 'product',
        nudge: NUDGE.groupProduct,
        card: 'group',
        reveal: [
          `Both pairs share (${faShow(binom)}): ${faShow(firstAnswer)} + ${faShow(secondAnswer)} = (${faShow(binom)})(${faShow(rest)}).`,
          scenario === 'square'
            ? `${faShow(rest)} = x^2 − ${k}^2 is a difference of two squares: (x + ${k})(x − ${k}).`
            : `${faShow(rest)} does not factor over the integers${u < 0 ? `: ${-u} is not a perfect square` : ': it is a sum of two squares'}.`,
          `${faShow(f)} = ${ans}.`,
        ],
      },
    ],
    slips,
  }
}

// ---------------------------------------------------------------------------
// fa.complete
// ---------------------------------------------------------------------------

function drawComplete(rng: Rng): FaDraft {
  const scenario = weighted<'gcfDos' | 'gcfCubes' | 'dos2' | 'quartic' | 'gcfTri'>(rng, [
    ['gcfDos', 25],
    ['gcfCubes', 20],
    ['dos2', 15],
    ['quartic', 20],
    ['gcfTri', 20],
  ])
  const slips: Slip[] = []
  let f: string
  let shape: FactoringShape
  let reveal: string[]
  const finish = (ff: string) => `${faShow(ff)} = ${faShow(factorOverIntegers(ff)!.text)}.`
  switch (scenario) {
    case 'gcfDos': {
      const { g, e } = rng.pick([
        { g: 2, e: 0 },
        { g: 3, e: 0 },
        { g: 4, e: 0 },
        { g: 5, e: 0 },
        { g: 2, e: 1 },
        { g: 3, e: 1 },
        { g: 1, e: 1 },
        { g: 5, e: 1 },
      ] as const)
      const { m, n } = drawRootPair(
        rng,
        [
          [1, 50],
          [2, 25],
          [3, 25],
        ],
        6,
      )
      const G = gcfText(g, e)
      const inner = std(`${m * m}x^2 - ${n * n}`)
      f = std(`${G}(${inner})`)
      shape = shapeOf({ core: 'dos', g, e, m, n, s: -1, inner })
      slips.push(product('fa_stopped_early', `${G}(${inner})`), product('fa_diff_as_square', `${G}(${lin(m, -n)})^2`))
      reveal = [`Take out the common factor first: ${faShow(f)} = ${faShow(G)}(${faShow(inner)}).`, `${faShow(inner)} is a difference of two squares: (${faShow(lin(m, n))})(${faShow(lin(m, -n))}).`, finish(f)]
      break
    }
    case 'gcfCubes': {
      const { g, e } = rng.pick([
        { g: 2, e: 0 },
        { g: 3, e: 0 },
        { g: 4, e: 0 },
        { g: 1, e: 1 },
        { g: 2, e: 1 },
      ] as const)
      const n = rng.int(1, 5)
      const s = rng.sign()
      const G = gcfText(g, e)
      const inner = std(`x^3 + ${s * n ** 3}`)
      f = std(`${G}(${inner})`)
      shape = shapeOf({ core: 'cubes', g, e, m: 1, n, s, inner })
      slips.push(product('fa_stopped_early', `${G}(${inner})`), ...cubeSlips(G, 1, n, s))
      const r = cubeReveal(f, G, inner, 1, n, s)
      reveal = [...r.cubed, ...r.product]
      break
    }
    case 'dos2': {
      const [m, n] = rng.pick([
        [1, 1],
        [1, 2],
        [1, 3],
        [2, 1],
        [2, 3],
        [3, 1],
        [3, 2],
      ] as const)
      const g = rng.pick([1, 1, 2, 3])
      const G = gcfText(g, 0)
      const inner = std(`${m ** 4}x^4 - ${n ** 4}`)
      f = std(`${G || '1'}(${inner})`)
      shape = shapeOf({ core: 'dos2', g, m, n, s: -1, inner })
      const plus = std(`${m * m}x^2 + ${n * n}`)
      const minus = std(`${m * m}x^2 - ${n * n}`)
      slips.push(
        product('fa_stopped_early', `${G}(${plus})(${minus})`),
        product('fa_diff_as_square', `${G}(${plus})(${lin(m, -n)})^2`),
        product('fa_sum_of_squares', `${G}(${lin(m, n)})(${lin(m, -n)})(${lin(m, n)})(${lin(m, -n)})`),
      )
      reveal = [
        ...(G ? [`Take out the common factor first: ${faShow(f)} = ${G}(${faShow(inner)}).`] : []),
        `${faShow(inner)} is a difference of two squares: (${faShow(plus)})(${faShow(minus)}).`,
        `${faShow(minus)} is a difference of two squares again: (${faShow(lin(m, n))})(${faShow(lin(m, -n))}). ${faShow(plus)} is a sum of two squares and does not factor.`,
        finish(f),
      ]
      break
    }
    case 'quartic': {
      const a = rng.int(1, 4)
      const plus = rng.chance(0.4)
      const b = rng.intExcept(1, 5, [a])
      const u0 = -a * a
      const u1 = plus ? b * b : -b * b
      const left = std(`x^2 + ${u0}`)
      const right = std(`x^2 + ${u1}`)
      f = std(`(${left})(${right})`)
      shape = shapeOf({ core: 'quartic', k: [u0, u1], inner: f })
      slips.push(product('fa_stopped_early', `(${left})(${right})`))
      reveal = [
        `Read it as a trinomial in x^2: two numbers that multiply to ${num(u0 * u1)} and add to ${num(u0 + u1)} are ${num(u0)} and ${num(u1)}, so ${faShow(f)} = (${faShow(left)})(${faShow(right)}).`,
        `${faShow(left)} is a difference of two squares: (x + ${a})(x − ${a}). ${plus ? `${faShow(right)} is a sum of two squares and does not factor.` : `So is ${faShow(right)}: (x + ${b})(x − ${b}).`}`,
        finish(f),
      ]
      break
    }
    case 'gcfTri': {
      const { g, e } = rng.pick([
        { g: 2, e: 0 },
        { g: 3, e: 0 },
        { g: 4, e: 0 },
        { g: 1, e: 1 },
        { g: 2, e: 1 },
        { g: 3, e: 1 },
      ] as const)
      const p = rng.sign() * rng.int(1, 7)
      const q = rng.sign() * rng.intExcept(1, 7, [Math.abs(p)])
      const G = gcfText(g, e)
      const inner = std(`(${lin(1, p)})(${lin(1, q)})`)
      f = std(`${G}(${inner})`)
      shape = shapeOf({ core: 'tri', g, e, k: [1, p, 1, q], inner })
      slips.push(product('fa_stopped_early', `${G}(${inner})`), product('fa_tri_signs_swapped', `${G}(${lin(1, -p)})(${lin(1, -q)})`))
      reveal = [
        `Take out the common factor first: ${faShow(f)} = ${faShow(G)}(${faShow(inner)}).`,
        `Two numbers that multiply to ${num(p * q)} and add to ${num(p + q)}: ${num(p)} and ${num(q)}, so ${faShow(inner)} = (${faShow(lin(1, p))})(${faShow(lin(1, q))}).`,
        finish(f),
      ]
      break
    }
  }
  return { question: 'complete', f, shape, stages: [{ id: 'product', nudge: NUDGE.complete, card: 'complete', reveal }], slips }
}

// ---------------------------------------------------------------------------
// The six templates
// ---------------------------------------------------------------------------

export const FA_TEMPLATE_IDS = ['fa.gcf', 'fa.squares', 'fa.cubes', 'fa.trinomial', 'fa.grouping', 'fa.complete'] as const

export const FA_TEMPLATES: TemplateDef[] = [
  template({ question: 'gcf', templateId: 'fa.gcf', salt: 801, draw: drawGcf }, 'Greatest common factor', 'Factor out the greatest common monomial factor: a number, a power of x, or both.'),
  template({ question: 'squares', templateId: 'fa.squares', salt: 802, draw: drawSquares }, 'Squares', 'A difference of two squares, a perfect-square trinomial, or a sum of two squares, which does not factor.'),
  template({ question: 'cubes', templateId: 'fa.cubes', salt: 833, draw: drawCubes }, 'Sum or difference of cubes', 'What is cubed in each term, then the factored form; sometimes a common factor first.'),
  template({ question: 'trinomial', templateId: 'fa.trinomial', salt: 804, draw: drawTrinomial }, 'Trinomials', 'x^2 + bx + c and ax^2 + bx + c, every sign pattern.'),
  template({ question: 'grouping', templateId: 'fa.grouping', salt: 805, draw: drawGrouping }, 'Grouping', 'Four terms: the pairs, then the product, finished completely.'),
  template({ question: 'complete', templateId: 'fa.complete', salt: 806, draw: drawComplete }, 'Factor completely', 'A common factor and then a pattern, or a pattern twice.'),
]
