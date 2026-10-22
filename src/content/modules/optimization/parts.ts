/**
 * The six parts of an optimization problem, built from its model and its words: the secondary equation, the primary
 * equation, the final equation (in x, or in y), the value that gives the extreme, the other variable, and the extreme
 * value. Parts 4 and 5 come twice, once for each letter the final equation can be in. Every slip is computed for this
 * problem; a slip that gives the right answer, or the same as an earlier slip, is left out. Grading goes through
 * engine/optim; the gate (`assertOptProblem`) checks every generated problem before it is shown.
 */
import type { OptFigureSpec, OptimizationAnswer, OptimizationQuestion, OptPart, OptPartDimension, OptPartTrap, RuleCard } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { exactFromText, gradeOptEquation, gradeOptNumber, q, qAdd, qDiv, qEq, qMul, qNeg, vertexSlipValues, type OptEquationSpec, type OptGrade, type Q, type Quadratic } from '@/engine/optim'
import type { CalcPanels, ErrorPatternId } from '@/shared/types'
import { LogSkip } from '../explog/text'
import {
  binomialSlips,
  coef,
  droppedTerms,
  evalQuadratic,
  finalEquation,
  finalForms,
  finalQuadratic,
  finalWithPartner,
  lineEquation,
  negated,
  objectiveAt,
  other,
  partialDivisions,
  partnerExpr,
  partnerFrom,
  primaryEquation,
  solve,
  substituted,
  type Line,
  type MathText,
  type Objective,
  type OptModel,
  type Route,
  type Solution,
} from './model'
import { OPT_RULE_IDS } from './rules'
import { answerMatcher, commas, dollarsTex, pieces, plain, qDecimal, qMixed, qRound, qTex, qTyped, quadStandard, quadText } from './text'

export type OptPartGrade = OptGrade

// ---------------------------------------------------------------------------
// What the templates give
// ---------------------------------------------------------------------------

/** How the problem's words name one letter's value. */
export interface LetterWords {
  /** Box label and part title, plain: "x", "Price x", "Number sold y". */
  label: string
  /** In notes, plain: "x", "the price", "the number sold". */
  what: string
  dim: OptPartDimension
  /** A value as typed with its unit, for the self-check: "125 ft", "$11.50", "230 tickets". */
  unitForms: (typed: string) => string[]
  /** Words after a value in a worked line: " feet", " tickets", "" (money carries its $, plain numbers nothing). */
  unitAfter: string
}

export interface OptWords {
  /** 'area', 'combined area', 'area of each pen', 'revenue', 'product', 'sum of the squares'. */
  quantity: string
  /** 'the largest area', 'the smallest product'. */
  extremePhrase: string
  letters: Record<Route, LetterWords>
  /** Part 4's question per route (math). */
  bestAsk: Record<Route, string>
  /** Part 5's question per route (math). */
  otherAsk: Record<Route, string>
  maxLabel: string
  /** Part 6's question (math). */
  maxAsk: string
  maxDim: OptPartDimension
  maxUnitRequired: boolean
  maxUnitForms: (typed: string) => string[]
  /** The extreme value in a worked line (math). */
  maxShow: (v: Q) => string
  /** Format hints of the number parts (plain). */
  numberHint: Record<'best' | 'other' | 'max', Record<Route, string> | string>
  /** What the objective's factor counts ("pens"), for the slip of reading the other side off the final equation. */
  countNoun?: string
}

/** A slip in the secondary equation: another condition. Carried into the final equation and the other variable. */
export interface LineSlip {
  id: ErrorPatternId
  line: Line
  /** How she would type it, when the story writes it another way (revenue: "y = 300 + 20(x - 8)"), and its KaTeX. */
  text?: string
  tex?: string
  /** The sentence about her equation in part 1 (math). */
  witness: string
  /** The reason, carried into the later parts (math): "The barn side needs no fence." */
  why: string
  promise: boolean
}

/** A slip in the primary equation: another objective (one pen's area, another count). */
export interface ObjectiveSlip {
  id: ErrorPatternId
  objective: Objective
  witness: string
  why: string
  /** The sentence when the slip's value is given as the extreme (part 6). */
  maxWitness: string
  promise: boolean
}

export interface EquationPartText {
  ask: string
  nudge: string
  reveal: string[]
  formatHint: string
  rightNote: string
  wrongNote: string
}

export interface OptDraft {
  question: OptimizationQuestion
  model: OptModel
  goal: 'max' | 'min'
  prompt: string
  instructions: string
  figure?: OptFigureSpec
  domain: { x: [number, number]; y: [number, number] }
  units: OptimizationAnswer['units']
  /** Decimal places asked for every number, or null: exact answers. */
  places: number | null
  words: OptWords
  secondary: EquationPartText & {
    /** The right condition as typed, the problem's way first ("2x + y = 500", "y = 300 - 20(x - 8)"). */
    forms: string[]
    slips: LineSlip[]
    /** Other named slips of part 1: the primary written here, the fencing as an area. */
    extra: (OptPartTrap & { promise: boolean })[]
  }
  primary: EquationPartText & {
    slips: ObjectiveSlip[]
    extra: (OptPartTrap & { promise: boolean })[]
  }
  /** The partner as the story writes it (revenue: "300 - 20(x - 8)"), per route; defaults from the line. */
  partner?: Partial<Record<Route, MathText>>
  ruleCards: string[]
  calc: CalcPanels
  calcExpr: string
}

export interface BuiltParts {
  stages: OptPart[]
  yStages: OptPart[]
  /** Slips the problem may promise, with the part they are on (x route). */
  promisable: { stage: string; trap: OptPartTrap }[]
  solution: Solution
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

const AREA_WORDS: Record<string, { area: string; length: string }> = {
  ft: { area: 'square feet', length: 'feet' },
  m: { area: 'square meters', length: 'meters' },
  yd: { area: 'square yards', length: 'yards' },
}

function equationSpec(answer: Pick<OptimizationAnswer, 'quantity' | 'domain'>, part: OptPart): OptEquationSpec {
  const c = part.check
  const base = { quantity: answer.quantity, domain: answer.domain, rightMessage: part.rightNote }
  if (c.kind === 'constraint') return { ...base, part: 'constraint', target: c.equation }
  if (c.kind === 'primary') return { ...base, part: 'primary', target: c.equation }
  if (c.kind === 'final') return { ...base, part: 'final', target: c.x, targetY: c.y }
  throw new Error('a number part has no equation')
}

/** Grade her entry for one part. A plain wrong answer gets the part's own note (what to look at, never the answer). */
export function gradeOptPart(answer: Pick<OptimizationAnswer, 'quantity' | 'domain' | 'units'>, part: OptPart, raw: string): OptPartGrade {
  const c = part.check
  let g: OptGrade
  if (c.kind === 'number') {
    const words = answer.units.lengthUnit ? AREA_WORDS[answer.units.lengthUnit] : undefined
    g = gradeOptNumber(
      {
        value: exactFromText(c.value),
        places: c.places ?? null,
        dim: c.dim,
        ...(c.unitRequired ? { unitRequired: true } : {}),
        name: c.name,
        units: answer.units,
        what: c.what,
        ...(words ? { areaWords: words.area, lengthWords: words.length } : {}),
        rightMessage: part.rightNote,
      },
      raw,
      part.traps.map((t) => ({ id: t.id, value: exactFromText(t.text, answer.units), witness: t.witness })),
    )
  } else {
    g = gradeOptEquation(
      equationSpec(answer, part),
      raw,
      part.traps.map((t) => ({ id: t.id, equation: t.text, witness: t.witness })),
    )
  }
  if (g.verdict === 'wrong') return { verdict: 'wrong', message: part.wrongNote }
  return g
}

/** The parts she is on: the final equation's letter decides parts 4 and 5. */
export function stagesFor(answer: Pick<OptimizationAnswer, 'stages' | 'yStages'>, route: Route | null): OptPart[] {
  if (route !== 'y') return answer.stages
  const s = answer.stages
  return [s[0]!, s[1]!, s[2]!, answer.yStages[0]!, answer.yStages[1]!, s[5]!]
}

/** Her boxes in reading order, for the tutor: "Primary equation: A = 3xy". */
export function optWork(stages: readonly OptPart[], entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const s of stages) {
    const v = entries[s.id]?.trim()
    if (v) lines.push(`${s.label}: ${v}`)
  }
  return lines
}

/** Every part's answer as she would type it (for tests and the tutor's reference). */
export function optEntries(stages: readonly OptPart[]): Record<string, string> {
  return Object.fromEntries(stages.map((s) => [s.id, s.answerText]))
}

// ---------------------------------------------------------------------------
// Building the parts
// ---------------------------------------------------------------------------

const pretty = (s: string) => s.replace(/\^2/g, '²').replace(/-/g, '−')

/** Spellings of an equation the leak checks look for: as typed, with ², and with the sides swapped. */
function equationForms(texts: readonly string[]): string[] {
  const out: string[] = []
  for (const t of texts) {
    out.push(t, pretty(t))
    const [l, r] = t.split(' = ')
    if (l && r) out.push(`${r} = ${l}`)
  }
  return [...new Set(out)]
}

/** A number as she would type it, and every other right spelling (with commas, mixed, with its unit). */
function numberForms(v: Q, places: number | null, unitForms: (typed: string) => string[], unitRequired = false, money = false): { answerText: string; forms: string[] } {
  const exact = qTyped(v)
  // Money is dollars and cents: 22.50, and a whole number of dollars as it is.
  const cents = money && v.d !== 1 ? qRound(v, 2) : null
  // A value that is already short enough (50, 62.5) is written as it is; a longer one rounded as the problem asks.
  const shown = cents ?? (places === null || qDecimal(v, places) !== null ? exact : qRound(v, places))
  const plainForms = [...new Set([shown, exact, qMixed(v), commas(shown), ...(places !== null ? [qRound(v, places)] : [])])]
  const withUnits = plainForms.flatMap(unitForms)
  // An area carries its unit: the number alone is a note, not an answer.
  const answerText = unitRequired ? (unitForms(shown)[0] ?? shown) : shown
  const forms = [...new Set(unitRequired ? withUnits : [...plainForms, ...withUnits])].filter((f) => f !== answerText)
  return { answerText, forms }
}

/** The witness of a slip carried into a later part, its reason kept. */
const carried = (tex: string, why: string) => `That comes from $${tex}$. ${why}`

interface Candidate<T> {
  id: ErrorPatternId
  value: T
  text: string
  witness: string
  promise: boolean
}

/** Keep the first of equal candidates, drop the ones equal to the answer. */
function distinct<T>(answer: T, list: Candidate<T>[], same: (a: T, b: T) => boolean): Candidate<T>[] {
  const out: Candidate<T>[] = []
  for (const c of list) {
    if (same(c.value, answer)) continue
    if (out.some((o) => same(o.value, c.value))) continue
    out.push(c)
  }
  return out
}

const sameQuad = (a: Quadratic, b: Quadratic) => qEq(a.a, b.a) && qEq(a.b, b.b) && qEq(a.c, b.c)

/** Two conditions are the same when one is a nonzero multiple of the other. */
function sameLine(a: Line, b: Line): boolean {
  const ka = [a.a, a.b, a.c]
  const kb = [b.a, b.b, b.c]
  const i = kb.findIndex((v) => v.n !== 0)
  if (i < 0 || ka[i]!.n === 0) return false
  const k = qDiv(ka[i]!, kb[i]!)
  return ka.every((v, j) => qEq(v, qMul(k, kb[j]!)))
}

function sameObjective(a: Objective, b: Objective): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'squares' || qEq(a.k, (b as { k: Q }).k)
}

function trapOf<T>(c: Candidate<T>): OptPartTrap {
  return { id: c.id, text: c.text, witness: c.witness }
}

/** Part 1: the secondary equation. */
function secondaryPart(d: OptDraft): { part: OptPart; promisable: OptPartTrap[] } {
  const right = d.model.line
  const slips = distinct(
    right,
    d.secondary.slips.map((s) => ({ id: s.id, value: s.line, text: s.text ?? lineEquation(s.line).text, witness: s.witness, promise: s.promise })),
    sameLine,
  )
  const traps = [...slips.map(trapOf), ...d.secondary.extra.map((e) => ({ id: e.id, text: e.text, witness: e.witness }))]
  const part: OptPart = {
    id: 'secondary',
    kind: 'equation',
    label: 'Secondary equation',
    ask: d.secondary.ask,
    formatHint: d.secondary.formatHint,
    nudge: d.secondary.nudge,
    ruleCard: d.question === 'revenue' ? OPT_RULE_IDS.revenue : d.question === 'numbers' ? OPT_RULE_IDS.numbers : OPT_RULE_IDS.fences,
    reveal: d.secondary.reveal,
    answerText: d.secondary.forms[0]!,
    forms: equationForms([...d.secondary.forms, lineEquation(right).text]),
    check: { kind: 'constraint', equation: lineEquation(right).text },
    wrongNote: d.secondary.wrongNote,
    rightNote: d.secondary.rightNote,
    traps,
  }
  return { part, promisable: [...slips.filter((s) => s.promise).map(trapOf), ...d.secondary.extra.filter((e) => e.promise).map((e) => ({ id: e.id, text: e.text, witness: e.witness }))] }
}

/** Part 2: the primary equation. */
function primaryPart(d: OptDraft): { part: OptPart; promisable: OptPartTrap[] } {
  const right = d.model.objective
  const slips = distinct(
    right,
    d.primary.slips.map((s) => ({ id: s.id, value: s.objective, text: primaryEquation(d.model, s.objective).text, witness: s.witness, promise: s.promise })),
    sameObjective,
  )
  const eq = primaryEquation(d.model)
  const part: OptPart = {
    id: 'primary',
    kind: 'equation',
    label: 'Primary equation',
    ask: d.primary.ask,
    formatHint: d.primary.formatHint,
    nudge: d.primary.nudge,
    ruleCard: OPT_RULE_IDS.equations,
    reveal: d.primary.reveal,
    answerText: eq.text,
    forms: equationForms([eq.text, eq.text.replace(/(\d*)xy/, '$1yx')]),
    check: { kind: 'primary', equation: eq.text },
    wrongNote: d.primary.wrongNote,
    rightNote: d.primary.rightNote,
    traps: [...slips.map(trapOf), ...d.primary.extra.map((e) => ({ id: e.id, text: e.text, witness: e.witness }))],
  }
  return { part, promisable: [...slips.filter((s) => s.promise).map(trapOf), ...d.primary.extra.filter((e) => e.promise).map((e) => ({ id: e.id, text: e.text, witness: e.witness }))] }
}

/** A coefficient as KaTeX, a fraction kept a fraction (as in the equation it comes from): "-2", "-\frac{3}{2}". */
const coefTex = (v: Q) => (v.d === 1 ? String(v.n) : `${v.n < 0 ? '-' : ''}\\frac{${Math.abs(v.n)}}{${v.d}}`)

/** −b as the vertex formula's top: "-500", or "-\left(-22\right)" for a negative b. */
const minusB = (b: Q) => (b.n > 0 ? `-${coefTex(b)}` : `-\\left(${coefTex(b)}\\right)`)

/** The final equation's letter's partner, the story's way when it has one. */
function partnerOf(d: OptDraft, route: Route): MathText {
  return d.partner?.[route] ?? partnerExpr(d.model.line, route)
}

const goalWords = (goal: 'max' | 'min') => (goal === 'max' ? { best: 'largest', worst: 'smallest', right: 'down', wrong: 'up' } : { best: 'smallest', worst: 'largest', right: 'up', wrong: 'down' })

/** Part 3: the final equation, for one route (the slips in that letter). */
function finalTraps(d: OptDraft, route: Route): Candidate<Quadratic>[] {
  const { model } = d
  const s = other(route)
  const right = finalQuadratic(model, route)
  const Qn = model.quantity
  const g = goalWords(d.goal)
  const list: Candidate<Quadratic>[] = []
  const add = (id: ErrorPatternId, p: Quadratic, witness: string, promise: boolean) => {
    if (p.a.n === 0 && p.b.n === 0) return
    list.push({ id, value: p, text: finalEquation(Qn, p, route).text, witness, promise })
  }
  // A square of a difference written as two terms (sum of squares): named before a lost term, which it can equal.
  if (model.objective.kind === 'squares') {
    for (const p of binomialSlips(model.line, route)) add('opt_binomial_square', p, `Your final equation squares the second number’s expression as two terms. A sum or difference squared has three: the middle one is twice the product of its two pieces.`, true)
  }
  // A lost term of the right final equation.
  for (const t of droppedTerms(right)) {
    const witness =
      t.which === 'linear'
        ? `Your final equation has no term with $${route}$ on its own. Multiplying out gives one term for each piece of the sum: one with $${route}^{2}$ and one with $${route}$.`
        : t.which === 'square'
          ? `Your final equation has no $${route}^{2}$ term. Multiplying $${route}$ by a sum that has $${route}$ in it gives a term with $${route}^{2}$ as well.`
          : `Your final equation lost its number term. Squaring a sum gives one term for each pair of pieces, and two numbers multiplied make a number.`
    add('opt_term_dropped', t.p, witness, true)
  }
  // The secondary solved with not every term divided.
  for (const div of partialDivisions(model.line, route)) {
    const how = div.how === 'number' ? 'only the number was divided by' : div.how === 'term' ? `only the $${route}$ term was divided by` : 'nothing was divided by'
    add('opt_solve_divide', finalWithPartner(model.objective, div.slope, div.intercept), `When you solved the secondary equation for $${s}$, ${how} $${coefTex(coef(model.line, s))}$. Every term has to be.`, true)
  }
  // A sign lost in solving: the parabola opens the other way.
  if (model.objective.kind === 'product') {
    add(
      'opt_opens_wrong_way',
      negated(right),
      `Your parabola opens ${g.wrong}: the number with $${route}^{2}$ is ${g.wrong === 'up' ? 'positive' : 'negative'}, so its vertex would be the ${g.worst} ${d.words.quantity}, not the ${g.best}. A sign went wrong on the way: check $${s}$ from the secondary equation.`,
      true,
    )
  }
  // The primary's slips, carried in; and her worksheet's: a wrong count with a term lost as well.
  for (const slip of d.primary.slips) {
    const wrongFinal = finalQuadratic({ ...model, objective: slip.objective }, route)
    const pe = primaryEquation(model, slip.objective)
    add(slip.id, wrongFinal, `Your final equation starts from $${pe.tex}$. ${slip.why}`, false)
    for (const t of droppedTerms(wrongFinal)) {
      if (t.which !== 'linear') continue
      add('opt_term_dropped', t.p, `Your final equation has no term with $${route}$ on its own, and it starts from $${pe.tex}$. ${slip.why} Multiplying out keeps a term with $${route}$ as well.`, true)
    }
  }
  // The secondary's slips, carried in.
  for (const slip of d.secondary.slips) {
    if (coef(slip.line, s).n === 0) continue
    add(slip.id, finalQuadratic({ ...model, line: slip.line }, route), `Your final equation is built on $${slip.tex ?? lineEquation(slip.line).tex}$. ${slip.why}`, false)
  }
  return distinct(right, list, sameQuad)
}

function finalPart(d: OptDraft): { part: OptPart; traps: Record<Route, Candidate<Quadratic>[]> } {
  const { model } = d
  const Qn = model.quantity
  const fx = finalEquation(Qn, finalQuadratic(model, 'x'), 'x')
  const fy = finalEquation(Qn, finalQuadratic(model, 'y'), 'y')
  const traps = { x: finalTraps(d, 'x'), y: finalTraps(d, 'y') }
  const px = partnerOf(d, 'x')
  const sub = substituted(model, 'x', px)
  const solvedLine = `$y = ${px.tex}$`
  const part: OptPart = {
    id: 'final',
    kind: 'equation',
    label: 'Final equation',
    ask: `Write the final equation: $${Qn}$ in terms of one variable.`,
    formatHint: `${Qn} = a formula in x alone (or in y alone). Multiplied out or not, both are fine.`,
    nudge: `Solve the secondary equation for $y$ (or for $x$), then put that expression into the primary equation in its place. Keep every term as you multiply out.`,
    ruleCard: OPT_RULE_IDS.final,
    reveal: [`From the secondary equation, ${solvedLine}.`, `Put it into the primary equation: $${sub.tex} = ${quadText(finalQuadratic(model, 'x'), 'x').tex}$.`],
    answerText: fx.text,
    forms: equationForms([...finalForms(model, 'x', px), ...finalForms(model, 'y', partnerOf(d, 'y'))]),
    check: { kind: 'final', x: fx.text, y: fy.text },
    wrongNote: 'That is not what the primary equation becomes with the secondary equation put in. Check the expression you substituted, then every term as you multiply out.',
    rightNote: `Right: $${Qn}$ in one variable.`,
    traps: [...traps.x, ...traps.y].map(trapOf),
  }
  return { part, traps }
}

/** Part 4: the value that gives the extreme, in the route's letter. */
function bestPart(d: OptDraft, sol: Solution, route: Route): { part: OptPart; promisable: OptPartTrap[] } {
  const { model, words } = d
  const s = other(route)
  const t = route === 'x' ? sol.x : sol.y
  const sv = route === 'x' ? sol.y : sol.x
  const p = finalQuadratic(model, route)
  const L = words.letters[route]
  const g = goalWords(d.goal)
  const typed = (v: Q) => qTyped(v)
  const list: Candidate<Q>[] = []
  for (const slip of vertexSlipValues(p)) {
    const witness =
      slip.id === 'opt_vertex_ab_swapped'
        ? `That is $-\\frac{a}{2b}$, with $a$ and $b$ swapped. In your final equation, $a$ is the number with $${route}^{2}$ and $b$ is the number with $${route}$.`
        : slip.id === 'opt_vertex_sign'
          ? `That is $\\frac{b}{2a}$: the minus sign in front of $b$ is missing, so the answer came out with the opposite sign.`
          : `That is $-\\frac{b}{a}$: dividing by $a$ instead of $2a$ doubles the answer.`
    list.push({ id: slip.id, value: slip.value, text: typed(slip.value), witness, promise: true })
  }
  list.push({ id: 'opt_max_as_dimension', value: sol.value, text: typed(sol.value), witness: `That is ${words.extremePhrase} itself, the height of the vertex. This part asks for $${route}$, where the vertex is.`, promise: true })
  list.push({ id: 'opt_dimensions_swapped', value: sv, text: typed(sv), witness: `That is the value of $${s}$. This box is for $${route}$.`, promise: false })
  const traps = distinct(t, list, qEq)
  const { answerText, forms } = numberForms(t, d.places, L.unitForms, false, L.dim === 'money')
  const pq = quadStandard(p, route)
  const part: OptPart = {
    id: 'best',
    kind: 'number',
    label: L.label,
    ask: words.bestAsk[route],
    formatHint: typeof words.numberHint.best === 'string' ? words.numberHint.best : words.numberHint.best[route],
    nudge: `Write the final equation as $${model.quantity} = a${route}^{2} + b${route} + c$ and use $${route} = -\\frac{b}{2a}$. Or graph it on your calculator and use the ${d.goal === 'max' ? 'maximum' : 'minimum'} tool under 2nd TRACE.`,
    ruleCard: OPT_RULE_IDS.vertex,
    reveal: [
      `In $${model.quantity} = ${pq.tex}$, $a = ${coefTex(p.a)}$ and $b = ${coefTex(p.b)}$, so $${route} = -\\frac{b}{2a} = \\frac{${minusB(p.b)}}{2\\left(${coefTex(p.a)}\\right)} = ${L.dim === 'money' ? dollarsTex(t) : qTex(t)}$${L.unitAfter}.`,
      `$a$ is ${p.a.n < 0 ? 'negative' : 'positive'}: the parabola opens ${p.a.n < 0 ? 'down' : 'up'}, so this is the ${g.best} value.`,
    ],
    answerText,
    forms,
    check: { kind: 'number', value: qTyped(t), ...(d.places !== null ? { places: d.places } : {}), dim: L.dim, name: route, what: L.what },
    wrongNote: `That is not where the vertex is. Use the vertex formula on your final equation: b is the number with ${route}, a the number with ${route}².`,
    rightNote: `Right: the vertex is at that value of $${route}$.`,
    traps: traps.map(trapOf),
  }
  return { part, promisable: traps.filter((c) => c.promise).map(trapOf) }
}

/** Part 5: the other letter's value. */
function otherPart(d: OptDraft, sol: Solution, route: Route): { part: OptPart; promisable: OptPartTrap[] } {
  const { model, words } = d
  const s = other(route)
  const t = route === 'x' ? sol.x : sol.y
  const sv = route === 'x' ? sol.y : sol.x
  const L = words.letters[s]
  const list: Candidate<Q>[] = []
  // The plainest reading first: the same value typed again, or the extreme value.
  list.push({ id: 'opt_dimensions_swapped', value: t, text: qTyped(t), witness: `That is $${route}$ again. Put it into the secondary equation to get $${s}$.`, promise: true })
  list.push({ id: 'opt_max_as_dimension', value: sol.value, text: qTyped(sol.value), witness: `That is ${words.extremePhrase}, the height of the vertex, not $${s}$.`, promise: true })
  for (const div of partialDivisions(model.line, route)) {
    const val = qAdd(qMul(div.slope, t), div.intercept)
    const how = div.how === 'number' ? 'only the number was divided by' : div.how === 'term' ? `only the $${route}$ term was divided by` : 'nothing was divided by'
    list.push({ id: 'opt_solve_divide', value: val, text: qTyped(val), witness: `In solving the secondary equation for $${s}$, ${how} $${coefTex(coef(model.line, s))}$. Every term has to be.`, promise: true })
  }
  if (model.objective.kind === 'product' && !qEq(model.objective.k, q(1)) && t.n !== 0 && words.countNoun) {
    const v = qDiv(sol.value, t)
    list.push({
      id: 'opt_other_from_primary',
      value: v,
      text: qTyped(v),
      witness: `That is what multiplies $${route}$ in the final equation, so it carries the number of ${words.countNoun} with it. Put $${route}$ into the secondary equation instead.`,
      promise: true,
    })
  }
  for (const slip of d.secondary.slips) {
    const v = partnerFrom(slip.line, route, t)
    if (v === null) continue
    list.push({ id: slip.id, value: v, text: qTyped(v), witness: carried(slip.tex ?? lineEquation(slip.line).tex, slip.why), promise: false })
  }
  const traps = distinct(sv, list, qEq)
  const { answerText, forms } = numberForms(sv, d.places, L.unitForms, false, L.dim === 'money')
  const pe = partnerOf(d, route)
  const part: OptPart = {
    id: 'other',
    kind: 'number',
    label: L.label,
    ask: words.otherAsk[route],
    formatHint: typeof words.numberHint.other === 'string' ? words.numberHint.other : words.numberHint.other[route],
    nudge: `Put your value of $${route}$ into the secondary equation and solve for $${s}$.`,
    ruleCard: OPT_RULE_IDS.readBack,
    reveal: [
      `$${s} = ${pe.tex.replace(new RegExp(`(?<![A-Za-z\\\\])${route}(?![A-Za-z])`, 'g'), `\\left(${qTex(t)}\\right)`)} = ${L.dim === 'money' ? dollarsTex(sv) : qTex(sv)}$${L.unitAfter}${d.places !== null && qTyped(sv).includes('/') ? `, about $${qRound(sv, d.places)}$` : ''}.`,
    ],
    answerText,
    forms,
    check: { kind: 'number', value: qTyped(sv), ...(d.places !== null ? { places: d.places } : {}), dim: L.dim, name: s, what: L.what },
    wrongNote: `That does not fit the secondary equation with your value of ${route}. Put it in and solve for ${s} step by step.`,
    rightNote: `Right: that is $${s}$ for the ${goalWords(d.goal).best} value.`,
    traps: traps.map(trapOf),
  }
  return { part, promisable: traps.filter((c) => c.promise).map(trapOf) }
}

/** Part 6: the extreme value. */
function maxPart(d: OptDraft, sol: Solution): { part: OptPart; promisable: OptPartTrap[] } {
  const { model, words } = d
  const g = goalWords(d.goal)
  const list: Candidate<Q>[] = []
  list.push({ id: 'opt_x_as_max', value: sol.x, text: qTyped(sol.x), witness: `That is $x$, where ${words.extremePhrase} happens. ${capital(words.extremePhrase)} is the value of $${model.quantity}$ there.`, promise: true })
  list.push({ id: 'opt_x_as_max', value: sol.y, text: qTyped(sol.y), witness: `That is $y$, one of the values at the vertex. ${capital(words.extremePhrase)} is the value of $${model.quantity}$ there.`, promise: false })
  if (model.objective.kind === 'product') {
    const v = qNeg(sol.value)
    list.push({ id: 'opt_opens_wrong_way', value: v, text: qTyped(v), witness: `That is the vertex value with its sign flipped, from a parabola that opens ${g.wrong}. Yours should open ${g.right}: check the sign of your final equation.`, promise: true })
  }
  for (const slip of d.primary.slips) {
    const v = objectiveAt({ ...model, objective: slip.objective }, sol.x, sol.y)
    list.push({ id: slip.id, value: v, text: qTyped(v), witness: slip.maxWitness, promise: true })
  }
  // An area's slips are typed with the unit too, as she would (the number alone is a note about the unit).
  if (words.maxUnitRequired) for (const c of list) c.text = words.maxUnitForms(c.text)[0] ?? c.text
  const traps = distinct(sol.value, list, qEq)
  const { answerText, forms } = numberForms(sol.value, d.places, words.maxUnitForms, words.maxUnitRequired, words.maxDim === 'money')
  const px = finalQuadratic(model, 'x')
  const atX = evalQuadratic(px, sol.x)
  if (!qEq(atX, sol.value)) throw new Error('the final equation disagrees with the solution')
  const part: OptPart = {
    id: 'max',
    kind: 'number',
    label: words.maxLabel,
    ask: words.maxAsk,
    formatHint: typeof words.numberHint.max === 'string' ? words.numberHint.max : words.numberHint.max.x,
    nudge: `Put your value of $x$ into the final equation (or $x$ and $y$ into the primary equation).`,
    ruleCard: OPT_RULE_IDS.readBack,
    reveal: [`$${model.quantity} = ${substitutedAt(d, sol)} = ${qTex(sol.value)}$, so ${words.extremePhrase} is ${words.maxShow(sol.value)}.`],
    answerText,
    forms,
    check: { kind: 'number', value: qTyped(sol.value), ...(d.places !== null ? { places: d.places } : {}), dim: words.maxDim, ...(words.maxUnitRequired ? { unitRequired: true } : {}), name: model.quantity, what: words.extremePhrase },
    wrongNote: `That does not come out of the primary equation at the vertex. Put the values you found back in and work it out again.`,
    rightNote: `Right: that is ${words.extremePhrase}.`,
    traps: traps.map(trapOf),
  }
  return { part, promisable: traps.filter((c) => c.promise).map(trapOf) }
}

/** The primary equation with the solution put in, as KaTeX: "3(50)\left(33\tfrac{1}{3}\right)", "(20)^{2} + (20)^{2}". */
function substitutedAt(d: OptDraft, sol: Solution): string {
  const o = d.model.objective
  const x = `\\left(${qTex(sol.x)}\\right)`
  const y = `\\left(${qTex(sol.y)}\\right)`
  if (o.kind === 'squares') return `${x}^{2} + ${y}^{2}`
  const k = qEq(o.k, q(1)) ? '' : qTex(o.k, 'frac')
  return `${k}${x}${y}`
}

function capital(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** Every part of the problem, both routes, with the slips it may promise. */
export function buildParts(d: OptDraft): BuiltParts {
  const sol = solve(d.model)
  if (d.goal === 'max' && sol.opens !== 'down') throw new LogSkip('a maximum needs a parabola that opens down')
  if (d.goal === 'min' && sol.opens !== 'up') throw new LogSkip('a minimum needs a parabola that opens up')
  const sec = secondaryPart(d)
  const pri = primaryPart(d)
  const fin = finalPart(d)
  const best = bestPart(d, sol, 'x')
  const oth = otherPart(d, sol, 'x')
  const max = maxPart(d, sol)
  const stages = [sec.part, pri.part, fin.part, best.part, oth.part, max.part]
  const yStages = [bestPart(d, sol, 'y').part, otherPart(d, sol, 'y').part]
  const promisable: { stage: string; trap: OptPartTrap }[] = [
    ...sec.promisable.map((trap) => ({ stage: 'secondary', trap })),
    ...pri.promisable.map((trap) => ({ stage: 'primary', trap })),
    ...fin.traps.x.filter((c) => c.promise).map((c) => ({ stage: 'final', trap: trapOf(c) })),
  ]
  for (const [stage, list] of [
    ['best', best.promisable],
    ['other', oth.promisable],
    ['max', max.promisable],
  ] as const) {
    for (const trap of list) promisable.push({ stage, trap })
  }
  return { stages, yStages, promisable, solution: sol }
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/** Spellings of a part's answer that would give it away. */
export function answerForms(part: OptPart): string[] {
  return [...new Set([part.answerText, ...part.forms])].filter(Boolean)
}

/** What a part shows before she has its answer: its label, question, hint, nudge, plain note, the slips' sentences. */
export function partShownTexts(part: OptPart): string[] {
  return [part.label, part.ask, part.formatHint, part.nudge, part.wrongNote, ...part.traps.map((t) => t.witness)]
}

/** The catalog title, lesson and example of every slip this part can name. */
export function partCatalogTexts(part: OptPart): string[] {
  const ids = new Set(part.traps.map((t) => t.id))
  return [...ids].flatMap((id) => [ERROR_PATTERNS[id].title, ERROR_PATTERNS[id].lesson, ERROR_PATTERNS[id].example])
}

/**
 * Texts she can see before each part is answered, checked against that part's answer and every later one, on both
 * routes: the prompt, the instructions, the figure's words, every rule card and format hint (on screen throughout),
 * and each part's own texts and catalog entries (once it is open), its right note and its worked lines (seen before
 * the later parts).
 */
export function optLeaks(answer: Pick<OptimizationAnswer, 'prompt' | 'figure' | 'stages' | 'yStages'>, instructions: string, cards: readonly RuleCard[], hints: readonly string[]): string[] {
  const out: string[] = []
  for (const route of ['x', 'y'] as const) {
    const stages = stagesFor(answer, route)
    const later = (from: number) => stages.slice(from).flatMap(answerForms)
    const always = [answer.prompt, instructions, answer.figure?.ariaLabel ?? '', ...hints, ...cards.flatMap((c) => [c.title, c.body, c.example ?? ''])]
    const all = answerMatcher(later(0))
    for (const text of always) if (text && all(text)) out.push(`${route}: ${plain(text)}`)
    stages.forEach((part, i) => {
      const shows = answerMatcher(later(i))
      for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (text && shows(text)) out.push(`${route} ${part.id}: ${plain(text)}`)
      // Seen while the later parts are open: the right note and the worked lines of this part. A later answer she
      // already has (x = y for a sum, or 8 inside her −8) is not news.
      const known = stages.slice(0, i + 1).flatMap(answerForms)
      const news = answerMatcher(later(i + 1).filter((f) => !known.some(answerMatcher([f]))))
      for (const text of [part.rightNote, ...part.reveal]) if (text && news(text)) out.push(`${route} ${part.id} (after): ${plain(text)}`)
    })
  }
  return [...new Set(out)]
}

/** Every math string reads back as words: no TeX left over. */
export function texLeftovers(answer: Pick<OptimizationAnswer, 'prompt' | 'reveal' | 'stages' | 'yStages'>): string[] {
  const all = [answer.prompt, ...answer.reveal, ...[...answer.stages, ...answer.yStages].flatMap((s) => [s.ask, s.nudge, s.rightNote, ...s.reveal, ...s.traps.map((t) => t.witness)])]
  const bad: string[] = []
  for (const s of all) {
    if ((s.match(/(?<!\\)\$/g) ?? []).length % 2 !== 0) bad.push(`unbalanced $: ${s}`)
    const words = plain(s)
    if (/[\\{}$]/.test(words.replace(/\$\d/g, ''))) bad.push(`TeX left in: ${words}`)
    for (const p of pieces(s)) if (!p.tex && /\\/.test(p.text)) bad.push(`TeX outside $…$: ${s}`)
  }
  return bad
}

/**
 * The gate every generated problem passes; a failure skips the draw (LogSkip) and the seed tries the next one. Every
 * answer and spelling grades right, every slip as its own id, nonsense is not an attempt, the promised slip is real,
 * and nothing she sees early spells an answer.
 */
export function assertOptProblem(answer: OptimizationAnswer, instructions: string, cards: readonly RuleCard[], hints: readonly string[]): void {
  for (const part of [...answer.stages, ...answer.yStages]) {
    for (const form of [part.answerText, ...part.forms]) {
      const g = gradeOptPart(answer, part, form)
      if (g.verdict !== 'correct') throw new LogSkip(`${part.id}: “${form}” graded ${g.verdict}${g.verdict === 'invalid' || g.verdict === 'wrong' ? `: ${g.message}` : ''}`)
    }
    for (const trap of part.traps) {
      const g = gradeOptPart(answer, part, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new LogSkip(`${part.id}: trap ${trap.id} “${trap.text}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
    }
    if (gradeOptPart(answer, part, '???').verdict !== 'invalid') throw new LogSkip(`${part.id}: nonsense was graded`)
  }
  if (answer.trap) {
    const stage = answer.stages.find((s) => s.id === answer.trapStage)
    if (!stage?.traps.some((t) => t.id === answer.trap && t.text === answer.trapAnswer)) throw new LogSkip(`the promised ${answer.trap} is not a candidate`)
  }
  const leaks = optLeaks(answer, instructions, cards, hints)
  if (leaks.length) throw new LogSkip(`a text she sees early spells an answer: ${leaks[0]}`)
  const tex = texLeftovers(answer)
  if (tex.length) throw new Error(tex[0])
  for (const line of answer.reveal) if (plain(answer.prompt).includes(plain(line))) throw new LogSkip('the worked solution is in the prompt')
}
