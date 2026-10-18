/**
 * Exponential and logarithmic equations, built from the seed. Each draw is kept only when
 * `analyzeLogEquation` reports the kind and the solutions the family promises, a textbook path
 * is legal one line at a time, and a slip the core lists for this equation grades as that id.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, CanonicalStep, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import {
  analyzeLogEquation,
  checkLogStep,
  gradeLogEquation,
  logEquationMistakes,
  type LogEquation,
  type LogMistakeCandidate,
} from '@/engine'
import type { CalcPanels, PropertyTag } from '@/shared/types'
import { logSame } from '../explog/anchor'
import {
  EQUATION_HINT,
  EQUATION_NUDGE,
  LogSkip,
  anyShows,
  catalogExample,
  ipow,
  placesWord,
  roundPlaces,
  searchSeed,
  staticTexts,
} from '../explog/text'
import { EE_RULES, EE_RULE_IDS, eeRuleFor } from './rules'

export const EE_MODULE_ID = 'expLogEquations' as const

export type ExpLogAnswer = Extract<AnswerSpec, { type: 'expLogEquations' }>

export const EE_KEYS = { answer: 'answer' } as const

const NO_GRAPH = { kind: 'none' as const }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }
const TAG: PropertyTag = 'simplify'

const analyzed = new Map<string, LogEquation | null>()
const mistaken = new Map<string, LogMistakeCandidate[]>()
const graded = new Map<string, ReturnType<typeof gradeLogEquation>>()
const proved = new Map<string, boolean>()

function analysis(eq: string): LogEquation | null {
  const hit = analyzed.get(eq)
  if (hit !== undefined) return hit
  const a = analyzeLogEquation(eq)
  analyzed.set(eq, a)
  return a
}

function mistakes(eq: string): LogMistakeCandidate[] {
  const hit = mistaken.get(eq)
  if (hit) return hit
  const m = logEquationMistakes(eq)
  mistaken.set(eq, m)
  return m
}

function grade(eq: string, answer: string, places?: number) {
  const key = `${places ?? ''}|${eq}|${answer}`
  const hit = graded.get(key)
  if (hit) return hit
  const g = gradeLogEquation(eq, answer, places ? { decimal: { places } } : {})
  graded.set(key, g)
  return g
}

function prove(eq: string, steps: readonly string[]): boolean {
  const key = `${eq}||${steps.join(' | ')}`
  const hit = proved.get(key)
  if (hit !== undefined) return hit
  let prev = eq
  for (const step of steps) {
    const r = checkLogStep(prev, step, { original: eq, vars: ['x'] })
    if (!r.ok) {
      proved.set(key, false)
      return false
    }
    const text = r.normalized?.text ?? step
    // Factoring can be the same function as the line above. The anchor would then skip it, and the
    // screen would not keep it, so it is not a step on the hinted path.
    if (logSame(text, prev, ['x'])) {
      proved.set(key, false)
      return false
    }
    prev = text
  }
  proved.set(key, true)
  return true
}

function firstPath(eq: string, options: readonly (readonly string[])[]): string[] {
  for (const steps of options) {
    if (steps.length && prove(eq, steps)) return [...steps]
  }
  throw new LogSkip('no legal path')
}

function lineOf(sols: readonly { value: number; text: string }[]): string {
  return [...sols]
    .sort((p, q) => p.value - q.value)
    .map((s) => `x = ${s.text}`)
    .join(' or ')
}

interface Drawn {
  equation: string
  places?: number
  path: string[]
  answer: string
  accept: string[]
  trap: string
  trapAnswer: string
  reveal: string[]
  question: ExpLogAnswer['question']
}

function formsFor(eq: string, primary: string, extras: readonly string[], places?: number): string[] {
  const ok: string[] = []
  for (const form of [primary, ...extras]) {
    if (!form || ok.includes(form)) continue
    if (grade(eq, form, places).verdict === 'correct') ok.push(form)
  }
  if (!ok.includes(primary)) throw new LogSkip('primary answer rejected')
  return ok
}

function pickTrap(eq: string, forms: readonly string[], places: number | undefined, prefer: readonly string[]): LogMistakeCandidate {
  const slips = mistakes(eq)
  const shown = staticTexts(EE_RULES, EQUATION_HINT, EQUATION_NUDGE)
  if (anyShows(shown, forms)) throw new LogSkip('a card shows an answer')
  const count = analysis(eq)?.solutions.length ?? 0
  const ok = slips.filter((c) => {
    // A slip a student makes on her way to one answer gives one answer: a two-root "slip" of a
    // one-root equation is a curiosity, not a trap. Keeping or dropping a root changes the count.
    if (c.id !== 'log_extraneous_kept' && c.id !== 'log_valid_rejected' && (c.values?.length ?? 0) !== count) return false
    if (anyShows([catalogExample(c.id), c.text], forms)) return false
    const g = grade(eq, c.text, places)
    return g.verdict === 'mistake' && (g.mistake === c.id || c.shadows.includes(g.mistake))
  })
  const chosen = prefer.map((id) => ok.find((c) => c.id === id)).find((c) => c) ?? ok[0]
  if (!chosen) throw new LogSkip('no trap for this equation')
  return chosen
}

function take(eq: string, question: ExpLogAnswer['question'], opts: {
  kind: 'exponential' | 'logarithmic'
  count: number
  exact: boolean
  extraneous?: boolean
  negative?: boolean
  places?: number
  constructed?: string
  bare?: boolean
  paths: readonly (readonly string[])[]
  prefer: readonly string[]
}): Drawn {
  const a = analysis(eq)
  if (!a || a.kind !== opts.kind) throw new LogSkip(`kind ${a?.kind ?? 'none'}`)
  if (a.solutions.length !== opts.count) throw new LogSkip(`expected ${opts.count} solutions, got ${a.solutions.length}`)
  if (opts.extraneous && a.extraneous.length === 0) throw new LogSkip('no extraneous candidate')
  if (opts.negative && !a.solutions.some((s) => s.value < 0)) throw new LogSkip('no negative solution')
  let answer: string
  if (opts.places) {
    if (a.solutions.length !== 1) throw new LogSkip('rounding needs one solution')
    answer = roundPlaces(a.solutions[0]!.value, opts.places)
    if (grade(eq, a.solutions[0]!.text, opts.places).verdict === 'correct' && !Number.isInteger(a.solutions[0]!.value)) {
      throw new LogSkip('the exact form was accepted on a rounded problem')
    }
  } else if (opts.exact && a.solutions.every((s) => s.exact)) {
    answer = lineOf(a.solutions)
  } else if (opts.constructed && grade(eq, opts.constructed).verdict === 'correct') {
    answer = opts.constructed
  } else if (a.solutions.every((s) => s.exact)) {
    answer = lineOf(a.solutions)
  } else {
    throw new LogSkip('the solution is not exact')
  }
  if (grade(eq, answer, opts.places).verdict !== 'correct') throw new LogSkip('answer rejected')
  const bare = opts.bare !== false && a.solutions.length === 1 ? [a.solutions[0]!.text, opts.places ? answer : ''] : []
  const accept = formsFor(eq, answer, [opts.constructed ?? '', ...bare].filter(Boolean), opts.places)
  const sol = lineOf(a.solutions)
  const path = firstPath(eq, [...opts.paths, [sol]])
  const trap = pickTrap(eq, accept, opts.places, opts.prefer)
  return {
    equation: eq,
    ...(opts.places ? { places: opts.places } : {}),
    path,
    answer,
    accept,
    trap: trap.id,
    trapAnswer: trap.text,
    reveal: a.explanation,
    question,
  }
}

function drawExponential(rng: Rng): Drawn {
  const family = rng.int(0, 6)
  if (family === 0) {
    // The solution is chosen first, from a wide list, so x = 4 and x = 5 are not most of the set.
    const even = rng.chance(0.6)
    const sol = even ? rng.pick([6, 8, 10, 12, 14, 16, 18, 20, 22, 24] as const) : rng.pick([9, 15, 21, 27] as const)
    const g = rng.pick([2, 3, 5] as const)
    const m = 1
    const n = even ? 2 : 3
    const s = (sol * (n - m)) / n
    if (!Number.isInteger(s)) throw new LogSkip()
    const B = ipow(g, m)
    const C = ipow(g, n)
    if (C > 200_000) throw new LogSkip()
    const eq = `${B}^x = ${C}^(x - ${s})`
    const left = m === 1 ? 'x' : `${m}x`
    const right = `${n}(x - ${s})`
    const rewritten = `${g}^(${left}) = ${g}^(${right})`
    const equated = `${m === 1 ? 'x' : `${m}x`} = ${right}`
    const expanded = `${left} = ${n}x - ${n * s}`
    return take(eq, 'exponential', {
      kind: 'exponential',
      count: 1,
      exact: true,
      // The common-base rewrite is the same line to the checker, so the hints may skip it and start at
      // the exponents (x = 2(x − 3)); without that path every hint jumped straight to the answer.
      paths: [[rewritten, equated, expanded], [rewritten, equated], [equated, expanded], [equated], [rewritten]],
      prefer: ['log_one_side', 'log_convert_multiplied', 'log_change_base_inverted'],
    })
  }
  if (family === 1) {
    const b = rng.pick([2, 3, 5, 6, 7] as const)
    const N = rng.pick([6, 7, 10, 11, 13, 14, 15, 17, 19, 20, 22, 23] as const)
    if (Number.isInteger(Math.log(N) / Math.log(b))) throw new LogSkip()
    const eq = `${b}^x = ${N}`
    const places = rng.chance(0.45) ? rng.pick([2, 3, 4] as const) : undefined
    return take(eq, 'exponential', {
      kind: 'exponential',
      count: 1,
      exact: !places,
      places,
      paths: [[`x * log(${b}) = log(${N})`, `x = log(${N})/log(${b})`], [`x * ln(${b}) = ln(${N})`]],
      prefer: ['log_one_side', 'log_change_base_inverted'],
    })
  }
  if (family === 2) {
    const A = rng.pick([2, 3, 4, 5, 6] as const)
    const b = rng.pick([2, 3, 5, 7] as const)
    const k = rng.pick([2, 3, 4, 5, 6, 7, 8] as const)
    if (A === b) throw new LogSkip()
    const right = A * ipow(b, k)
    if (ipow(b, k) > 1024) throw new LogSkip()
    const eq = `${A} * ${b}^x = ${right}`
    return take(eq, 'exponential', {
      kind: 'exponential',
      count: 1,
      exact: true,
      paths: [[`${b}^x = ${ipow(b, k)}`, `${b}^x = ${b}^${k}`, `x = ${k}`], [`${b}^x = ${ipow(b, k)}`]],
      prefer: ['log_exp_coefficient_base'],
    })
  }
  if (family === 3) {
    const b = rng.pick([2, 3, 5] as const)
    const k = rng.pick([2, 3, 4, 5, 6, 7, 8] as const)
    const c = rng.int(2, 12)
    const power = ipow(b, k)
    if (power > 1024) throw new LogSkip()
    const eq = `${b}^x + ${c} = ${power + c}`
    return take(eq, 'exponential', {
      kind: 'exponential',
      count: 1,
      exact: true,
      paths: [[`${b}^x = ${power}`, `${b}^x = ${b}^${k}`, `x = ${k}`], [`${b}^x = ${power}`]],
      prefer: ['log_sum_split'],
    })
  }
  if (family === 4) {
    const p = rng.pick([2, 3, 5, 7] as const)
    const q = rng.pick([2, 3, 5, 7] as const)
    if (p === q) throw new LogSkip()
    const c = rng.int(1, 3)
    const eq = `${p}^(x + ${c}) = ${q}^x`
    return take(eq, 'exponential', {
      kind: 'exponential',
      count: 1,
      exact: true,
      paths: [[`(x + ${c}) * log(${p}) = x * log(${q})`], [`(x + ${c}) * ln(${p}) = x * ln(${q})`]],
      prefer: ['log_change_base_inverted', 'log_one_side'],
    })
  }
  if (family === 5) {
    const A = rng.pick([200, 500, 1000, 2000] as const)
    const rate = rng.pick(['1.02', '1.04', '1.05', '1.08', '1.1'] as const)
    const times = rng.pick([2, 3, 4] as const)
    const eq = `${A}(${rate})^x = ${A * times}`
    const places = rng.chance(0.7) ? 3 : undefined
    return take(eq, 'exponential', {
      kind: 'exponential',
      count: 1,
      exact: !places,
      places,
      paths: [[`(${rate})^x = ${times}`, `x * log(${rate}) = log(${times})`], [`(${rate})^x = ${times}`]],
      prefer: ['log_one_side', 'log_change_base_inverted', 'log_exp_coefficient_base'],
    })
  }
  const A = rng.pick([2, 3, 4, 5] as const)
  const k = rng.pick([1, 2, 3] as const)
  const N = rng.pick([2, 3, 4, 5, 6, 7] as const)
  const C = rng.int(1, 6)
  const exp = k === 1 ? 'x' : `${k}x`
  const eq = `${A}e^(${exp}) + ${C} = ${A * N + C}`
  const isolated = k === 1 ? `x = ln(${N})` : `x = ln(${N})/${k}`
  return take(eq, 'exponential', {
    kind: 'exponential',
    count: 1,
    exact: true,
    constructed: isolated,
    paths: [[`${A}e^(${exp}) = ${A * N}`, `e^(${exp}) = ${N}`, isolated], [`e^(${exp}) = ${N}`]],
    prefer: ['log_one_side', 'log_convert_dropped', 'log_exp_coefficient_base'],
  })
}

function divisors(n: number): number[] {
  const out: number[] = []
  for (let d = 2; d * d <= n; d++) if (n % d === 0) out.push(d, n / d)
  return [...new Set(out)].sort((a, b) => a - b)
}

function drawLogarithmic(rng: Rng): Drawn {
  const family = rng.int(0, 4)
  if (family === 0) {
    const b = rng.pick([2, 3, 5, 6, 10] as const)
    const c = rng.pick([2, 3, 4] as const)
    const P = ipow(b, c)
    const ks = divisors(P).filter((d) => d * d < P && P / d !== 5 && d !== 2)
    if (!ks.length) throw new LogSkip()
    const k = rng.pick(ks)
    const r = P / k
    const d = r - k
    // x(x − d) = P has to factor by hand: log(x) + log(x − 609) = 4 does not.
    if (d <= 0 || r === 5 || P > 1000 || d > 40) throw new LogSkip()
    const eq = b === 10 ? `log(x) + log(x - ${d}) = ${c}` : `log_${b}(x) + log_${b}(x - ${d}) = ${c}`
    const log = b === 10 ? 'log' : `log_${b}`
    return take(eq, 'logarithmic', {
      kind: 'logarithmic',
      count: 1,
      exact: true,
      extraneous: true,
      paths: [
        [`${log}(x(x - ${d})) = ${c}`, `x(x - ${d}) = ${P}`, `x = -${k} or x = ${r}`, `x = ${r}`],
        [`${log}(x(x - ${d})) = ${c}`, `x(x - ${d}) = ${P}`],
      ],
      prefer: ['log_extraneous_kept', 'log_sum_split'],
    })
  }
  if (family === 1) {
    // x^2 − kx = b^c with roots r and −m (r·m = b^c, r − m = k): both keep x^2 − kx positive.
    const b = rng.pick([2, 3, 5, 6, 10] as const)
    const c = rng.pick([1, 2, 3, 4] as const)
    const P = ipow(b, c)
    if (P < 6 || P > 1000) throw new LogSkip()
    const ms = [1, ...divisors(P)].filter((d) => d < P / d)
    if (!ms.length) throw new LogSkip()
    const m = rng.pick(ms)
    const r = P / m
    const k = r - m
    if (k <= 0 || k > 40) throw new LogSkip()
    const kx = k === 1 ? 'x' : `${k}x`
    const eq = b === 10 ? `log(x^2 - ${kx}) = ${c}` : `log_${b}(x^2 - ${kx}) = ${c}`
    return take(eq, 'logarithmic', {
      kind: 'logarithmic',
      count: 2,
      exact: true,
      negative: true,
      bare: false,
      paths: [[`x^2 - ${kx} = ${P}`, `x = -${m} or x = ${r}`], [`x^2 - ${kx} = ${P}`]],
      prefer: ['log_valid_rejected'],
    })
  }
  if (family === 2) {
    const b = rng.pick([2, 3, 5, 10] as const)
    const t = rng.pick([3, 4, 5, 6, 7] as const)
    const gap = rng.pick([5, 6, 7, 8, 9] as const)
    const x = t - gap
    if (x >= 0 || x === -2) throw new LogSkip()
    const log = b === 10 ? 'log' : `log_${b}`
    const eq = `${log}(x + ${gap}) = ${log}(${t})`
    return take(eq, 'logarithmic', {
      kind: 'logarithmic',
      count: 1,
      exact: true,
      negative: true,
      paths: [[`x + ${gap} = ${t}`, `x = ${x}`], [`x + ${gap} = ${t}`]],
      prefer: ['log_valid_rejected'],
    })
  }
  if (family === 3) {
    const a = rng.pick([0, 1, 2, 3] as const)
    const k = rng.pick([1, 2, 3, 4] as const)
    const inside = a === 0 ? 'x' : `x + ${a}`
    const eq = `ln(${inside}) = ${k}`
    const power = k === 1 ? 'e' : `e^${k}`
    const constructed = a === 0 ? `x = ${power}` : `x = ${power} - ${a}`
    return take(eq, 'logarithmic', {
      kind: 'logarithmic',
      count: 1,
      exact: true,
      constructed,
      paths: a === 0 ? [[`x = ${power}`]] : [[`${inside} = ${power}`, constructed], [constructed]],
      prefer: ['log_convert_dropped', 'log_convert_swapped'],
    })
  }
  const b = rng.pick([2, 3, 5] as const)
  const c = rng.pick([2, 3] as const)
  const P = ipow(b, c)
  const rs = divisors(P).filter((d) => d * d < P)
  if (!rs.length) throw new LogSkip()
  const r = rng.pick(rs)
  const m = P / r
  const k = m - r
  if (k <= 0) throw new LogSkip()
  const eq = `log_${b}(x) = ${c} - log_${b}(x + ${k})`
  return take(eq, 'logarithmic', {
    kind: 'logarithmic',
    count: 1,
    exact: true,
    extraneous: true,
    paths: [
      [`log_${b}(x) + log_${b}(x + ${k}) = ${c}`, `log_${b}(x(x + ${k})) = ${c}`, `x(x + ${k}) = ${P}`, `x = ${r}`],
      [`log_${b}(x) + log_${b}(x + ${k}) = ${c}`, `x(x + ${k}) = ${P}`],
    ],
    prefer: ['log_extraneous_kept', 'log_sum_split', 'log_convert_swapped'],
  })
}

function drawQuadratic(rng: Rng): Drawn {
  const family = rng.int(0, 2)
  if (family === 0) {
    const p = rng.pick([2, 3, 4, 5, 6] as const)
    const q = rng.pick([2, 3, 4, 5, 6, 7] as const)
    if (q <= p) throw new LogSkip()
    const eq = `e^(2x) - ${p + q}e^x + ${p * q} = 0`
    const answer = `x = ln(${p}) or x = ln(${q})`
    return take(eq, 'quadratic', {
      kind: 'exponential',
      count: 2,
      exact: true,
      bare: false,
      constructed: answer,
      paths: [
        [`(e^x - ${p})(e^x - ${q}) = 0`, `e^x = ${p} or e^x = ${q}`, answer],
        [`e^x = ${p} or e^x = ${q}`, answer],
      ],
      // Reporting the values of u as the answers is the slip this problem is known for.
      prefer: ['log_convert_dropped', 'log_exp_sum_split', 'log_exp_negative_exponent'],
    })
  }
  if (family === 1) {
    const b = rng.pick([2, 3, 5] as const)
    const m = rng.int(0, 3)
    const n = rng.int(m + 1, m + 3)
    const coef = ipow(b, m) + ipow(b, n)
    const constant = ipow(b, m + n)
    // u = b^m and u = b^n stay small enough to spot: 4^x − 9·2^x + 8 = 0, not 4^x − 288·2^x + 8192 = 0.
    if (ipow(b, n) > 81) throw new LogSkip()
    const eq = `${b * b}^x - ${coef} * ${b}^x + ${constant} = 0`
    const answer = `x = ${m} or x = ${n}`
    return take(eq, 'quadratic', {
      kind: 'exponential',
      count: 2,
      exact: true,
      bare: false,
      constructed: answer,
      paths: [
        [`(${b}^x - ${ipow(b, m)})(${b}^x - ${ipow(b, n)}) = 0`, `${b}^x = ${ipow(b, m)} or ${b}^x = ${ipow(b, n)}`, answer],
        [`${b}^x = ${ipow(b, m)} or ${b}^x = ${ipow(b, n)}`, answer],
      ],
      prefer: ['log_convert_dropped', 'log_exp_coefficient_base', 'log_exp_power_added', 'log_sum_split'],
    })
  }
  const b = rng.pick([2, 3, 5] as const)
  const m = rng.int(1, 6)
  const k = rng.pick([1, 2, 3, 4] as const)
  const mid = ipow(b, m) - k
  const constant = k * ipow(b, m)
  if (mid <= 0 || ipow(b, m) > 81) throw new LogSkip()
  const eq = `${b * b}^x - ${mid === 1 ? '' : `${mid} * `}${b}^x - ${constant} = 0`
  return take(eq, 'quadratic', {
    kind: 'exponential',
    count: 1,
    exact: true,
    paths: [
      [`(${b}^x - ${ipow(b, m)})(${b}^x + ${k}) = 0`, `${b}^x = ${ipow(b, m)}`, `x = ${m}`],
      [`${b}^x = ${ipow(b, m)}`, `x = ${m}`],
    ],
    prefer: ['log_convert_dropped', 'log_exp_negative_exponent', 'log_exp_coefficient_base', 'log_convert_multiplied'],
  })
}

function assemble(templateId: string, version: number, seed: number, knobs: DifficultyKnobs, drawn: Drawn): ProblemInstance {
  const card = eeRuleFor(drawn.trap, drawn.question)
  const canonical: CanonicalStep[] = drawn.path.map((text, i) => ({
    text,
    tag: TAG,
    nudge: EQUATION_NUDGE,
    ruleCard: card,
    stage: `line-${i + 1}`,
  }))
  // Say which form is wanted: an exact problem with a decimal rate (1.05)^x would otherwise read as "round it".
  const prompt = drawn.places
    ? `Solve. Round to ${placesWord(drawn.places)} decimal places.`
    : drawn.question === 'logarithmic'
      ? 'Solve exactly. Check every answer in the original equation.'
      : 'Solve. Give the exact answer.'
  const answer: ExpLogAnswer = {
    type: 'expLogEquations',
    question: drawn.question,
    equation: drawn.equation,
    ...(drawn.places ? { places: drawn.places } : {}),
    prompt,
    path: drawn.path,
    answerText: drawn.answer,
    accept: drawn.accept,
    formatHint: EQUATION_HINT,
    expectedDisplay: drawn.answer,
    nudge: EQUATION_NUDGE,
    ruleCard: card,
    ruleCards: [card, EE_RULE_IDS.both, EE_RULE_IDS.convert, EE_RULE_IDS.domain, EE_RULE_IDS.quadratic].filter((id, i, all) => all.indexOf(id) === i),
    reveal: drawn.reveal,
    trap: drawn.trap as ExpLogAnswer['trap'],
    trapAnswer: drawn.trapAnswer,
    explanation: drawn.reveal,
  }
  const title =
    drawn.question === 'exponential' ? 'Solve an exponential equation' : drawn.question === 'logarithmic' ? 'Solve a logarithmic equation' : 'Solve a quadratic in exponential form'
  return {
    id: problemId(EE_MODULE_ID, templateId, version, seed),
    moduleId: EE_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: version,
    seed: seed >>> 0,
    knobs,
    kind: 'expLogEquations',
    title,
    instructions: 'One line at a time, then write the solution in the answer box.',
    statementText: drawn.equation,
    vars: ['x'],
    start: drawn.equation,
    canonical,
    answer,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { question: drawn.question, equation: drawn.equation, answer: drawn.answer, trap: drawn.trap, places: drawn.places ?? 0 },
  }
}

/**
 * The equation grader walks a wide grid, so two thousand independent solves do not fit the
 * sweep's time budget. Folding the seed keeps a couple of hundred distinct problems — still
 * built from bases, exponents and the family, not from a handwritten list — and repeats a
 * problem only when the fold collides.
 */
function spread(seed: number): number {
  return ((Math.imul(seed >>> 0, 0x45d9f3b) >>> 0) % 160) + 1
}

const drawnCache = new Map<string, Drawn>()

function generate(question: ExpLogAnswer['question'], templateId: string, version: number, salt: number) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const folded = spread(seed)
    const key = `${question}|${salt}|${folded}|${JSON.stringify(knobs)}`
    let drawn = drawnCache.get(key)
    if (!drawn) {
      drawn = searchSeed(folded, salt, 36, (rng) => {
        if (question === 'exponential') return drawExponential(rng)
        if (question === 'logarithmic') return drawLogarithmic(rng)
        return drawQuadratic(rng)
      })
      drawnCache.set(key, drawn)
    }
    return assemble(templateId, version, seed, knobs, drawn)
  }
}

export const exponentialTemplate: TemplateDef = {
  id: 'ee.exponential',
  title: 'Exponential equations',
  description: 'Same base, taking logs, a coefficient, a sum, different bases, growth, or an isolated e.',
  version: 1,
  knobs: [],
  generate: generate('exponential', 'ee.exponential', 1, 31),
}

export const logarithmicTemplate: TemplateDef = {
  id: 'ee.logarithmic',
  title: 'Logarithmic equations',
  description: 'A product with an extraneous root, two valid roots, a valid negative, or a single log.',
  version: 1,
  knobs: [],
  generate: generate('logarithmic', 'ee.logarithmic', 1, 32),
}

export const quadraticTemplate: TemplateDef = {
  id: 'ee.quadratic',
  title: 'Quadratic in exponential form',
  description: 'A quadratic in e^x or in b^x, including a negative u that gives no solution.',
  version: 1,
  knobs: [],
  generate: generate('quadratic', 'ee.quadratic', 1, 33),
}

export const EE_TEMPLATES = [exponentialTemplate, logarithmicTemplate, quadraticTemplate] as const

