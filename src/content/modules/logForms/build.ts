/**
 * Logarithms and exponential form. Each problem is drawn from the seed (bases, exponents, which
 * family, how many decimal places). The engine grades it and lists the slips; a draw whose slips
 * collide with the answer, or whose answer sits in a card she can still see, is discarded.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { convertForm, convertMistakes, gradeConvertForm, gradeLogValue, logValue, logValueMistakes, type LogMistakeCandidate } from '@/engine'
import type { CalcPanels } from '@/shared/types'
import {
  CONVERT_HINT,
  CONVERT_NUDGE,
  DECIMAL_HINT,
  LogSkip,
  VALUE_HINT,
  VALUE_NUDGE,
  anyShows,
  catalogExample,
  changeOfBaseNudge,
  gcd,
  ipow,
  keyNudge,
  numberForms,
  placesWord,
  reserved,
  roundPlaces,
  searchSeed,
  staticTexts,
} from '../explog/text'
import { LF_RULES, LF_RULE_IDS, lfRuleFor } from './rules'

export const LF_MODULE_ID = 'logForms' as const

export type LogFormsAnswer = Extract<AnswerSpec, { type: 'logForms' }>

export const LF_KEYS = { answer: 'answer' } as const

const NO_GRAPH = { kind: 'none' as const }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const BASES = [2, 3, 4, 5, 6, 7, 8, 9] as const

interface Drawn {
  problem: string
  answer: string
  forms: string[]
  places?: number
  prompt: string
  nudge: string
  reveal: string[]
  trap: string
  trapAnswer: string
}

function leakTexts(nudge: string, hint: string): string[] {
  return staticTexts(LF_RULES, hint, nudge)
}

function pickTrap(cands: readonly LogMistakeCandidate[], forms: readonly string[], nudge: string, hint: string, prefer?: string): LogMistakeCandidate {
  const shown = leakTexts(nudge, hint)
  const ok = cands.filter((c) => !anyShows([catalogExample(c.id), c.text], forms) && !anyShows(shown, forms))
  const chosen = (prefer && ok.find((c) => c.id === prefer)) || ok[0]
  if (!chosen) throw new LogSkip('no trap that stays off the answer')
  if (anyShows([chosen.text], forms)) throw new LogSkip('trap equals the answer')
  return chosen
}

function confirmTrap(problem: string, trap: LogMistakeCandidate, places?: number): void {
  const opts = places ? { decimal: { places } } : {}
  const g = gradeLogValue(problem, trap.text, opts)
  if (g.verdict !== 'mistake' || (g.mistake !== trap.id && !trap.shadows.includes(g.mistake))) {
    throw new LogSkip(`trap ${trap.id} graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
  }
}

function exactValue(problem: string, prefer?: string): Drawn {
  const value = logValue(problem)
  if (!value?.exactText) throw new LogSkip('not an exact value')
  if (reserved(value.value) || numberForms(value.exactText).some((f) => reserved(Number(f)))) throw new LogSkip('reserved')
  const forms = numberForms(value.exactText)
  const g = gradeLogValue(problem, value.exactText)
  if (g.verdict !== 'correct') throw new LogSkip('exact answer rejected')
  for (const form of forms) {
    if (gradeLogValue(problem, form).verdict !== 'correct') throw new LogSkip(`form ${form} rejected`)
  }
  const approx = gradeLogValue(problem, roundPlaces(value.value + 0.4, 3))
  if (approx.verdict === 'correct') throw new LogSkip('a nearby decimal graded correct')
  const nudge = VALUE_NUDGE
  const trap = pickTrap(logValueMistakes(problem), forms, nudge, VALUE_HINT, prefer)
  confirmTrap(problem, trap)
  return {
    problem,
    answer: value.exactText,
    forms,
    prompt: 'Evaluate. Give the exact value.',
    nudge,
    reveal: g.explanation,
    trap: trap.id,
    trapAnswer: trap.text,
  }
}

function decimalValue(problem: string, places: number, nudge: string, require: readonly string[]): Drawn {
  const value = logValue(problem)
  if (!value || !Number.isFinite(value.value)) throw new LogSkip('undefined')
  if (Math.abs(value.value - Math.round(value.value)) < 1e-9) throw new LogSkip('that value is an integer')
  const answer = roundPlaces(value.value, places)
  if (reserved(Number(answer))) throw new LogSkip('reserved')
  const opts = { decimal: { places } }
  const g = gradeLogValue(problem, answer, opts)
  if (g.verdict !== 'correct') throw new LogSkip('rounded answer rejected')
  if (value.exactText && gradeLogValue(problem, value.exactText, opts).verdict === 'correct') throw new LogSkip('exact form accepted on a rounded problem')
  const slips = logValueMistakes(problem, opts)
  const rounded = new Map<string, string>()
  for (const id of require) {
    const hit = slips.find((c) => c.id === id)
    if (!hit?.values?.length) throw new LogSkip(`missing ${id}`)
    const text = roundPlaces(hit.values[0]!, places)
    if (text === answer) throw new LogSkip(`${id} rounds to the answer`)
    for (const prev of rounded.values()) if (prev === text) throw new LogSkip(`${id} collides at this rounding`)
    rounded.set(id, text)
  }
  const forms = [answer]
  if (anyShows(leakTexts(nudge, DECIMAL_HINT), forms)) throw new LogSkip('hint shows the rounding')
  const trap = pickTrap(slips, forms, nudge, DECIMAL_HINT, require[0])
  confirmTrap(problem, trap, places)
  return {
    problem,
    answer,
    forms,
    places,
    prompt: `Give the value to ${placesWord(places)} decimal places.`,
    nudge,
    reveal: g.explanation,
    trap: trap.id,
    trapAnswer: trap.text,
  }
}

// Textbook sizes: a power she can recognize without a calculator (up to 2^10, 3^6, 5^4, 10^6).
const MAX_POWER = 1024

function powerProblem(rng: Rng): string {
  if (rng.chance(0.25)) return `log(${ipow(10, rng.pick([2, 3, 4, 5, 6] as const))})`
  const b = rng.pick(BASES)
  const k = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10] as const)
  const arg = ipow(b, k)
  if (arg > MAX_POWER || reserved(b) || reserved(k) || reserved(arg)) throw new LogSkip()
  return `log_${b}(${arg})`
}

function fractionProblem(rng: Rng): string {
  const b = rng.pick([2, 3, 5] as const)
  const q = rng.pick([2, 3, 4] as const)
  const p = rng.pick([1, 2, 3, 4, 5, 7] as const)
  if (gcd(p, q) !== 1) throw new LogSkip()
  const base = ipow(b, q)
  const arg = ipow(b, p)
  if (base > 625 || arg > MAX_POWER) throw new LogSkip()
  return `log_${base}(${arg})`
}

function negativePower(rng: Rng): string {
  if (rng.chance(0.3)) {
    const k = rng.pick([1, 2, 3, 4] as const)
    return `log(${(10 ** -k).toFixed(k)})`
  }
  const b = rng.pick([2, 3, 4, 5, 6, 7, 8] as const)
  const k = rng.pick([1, 2, 3, 4, 5] as const)
  const arg = ipow(b, k)
  if (arg > 625) throw new LogSkip()
  return `log_${b}(1/${arg})`
}

function unitBase(rng: Rng): string {
  const b = rng.pick([2, 3, 4, 5] as const)
  const k = rng.pick([1, 2, 3, 4, 5] as const)
  if (ipow(b, k) > 256) throw new LogSkip()
  return `log_(1/${b})(${ipow(b, k)})`
}

/** n is b^k for some whole k ≥ 0. */
function powerOf(n: number, b: number): boolean {
  let m = n
  while (m > 1 && m % b === 0) m /= b
  return m === 1
}

function sumProblem(rng: Rng): string {
  // Two logs that cannot be evaluated one at a time but combine into a power of the base:
  // log_6(4) + log_6(9) = 2, log_2(40) − log_2(5) = 3.
  const b = rng.pick([2, 3, 6, 10, 12] as const)
  const k = rng.pick([1, 2, 3] as const)
  const arg = ipow(b, k)
  if (rng.chance(0.4)) {
    const d = rng.pick([3, 5, 6, 7] as const)
    if (powerOf(d, b)) throw new LogSkip()
    return `log_${b}(${arg * d}) - log_${b}(${d})`
  }
  const divisors: number[] = []
  for (let m = 2; m * m < arg; m++) if (arg % m === 0 && !powerOf(m, b)) divisors.push(m)
  if (!divisors.length) throw new LogSkip()
  const m = rng.pick(divisors)
  return `log_${b}(${m}) + log_${b}(${arg / m})`
}

function inverseProblem(rng: Rng): string {
  const kind = rng.int(0, 2)
  const uncommon = [11, 12, 13, 14, 15, 17, 19, 21, 22, 23, 26, 28, 33, 34] as const
  if (kind === 0) return `e^(ln(${rng.pick(uncommon)}))`
  if (kind === 1) return `10^(log(${rng.pick(uncommon)}))`
  return `ln(e^${rng.pick([9, 11, 12, 13, 14] as const)})`
}

function drawExact(rng: Rng): Drawn {
  // Fractions are half the draws: each reduced p/q is its own answer, so no integer piles up.
  const family = rng.int(0, 9)
  const problem =
    family < 5 ? fractionProblem(rng) : family < 7 ? negativePower(rng) : family === 7 ? unitBase(rng) : family === 8 ? powerProblem(rng) : rng.chance(0.5) ? sumProblem(rng) : inverseProblem(rng)
  return exactValue(problem)
}

function drawDecimal(rng: Rng): Drawn {
  const places = rng.int(2, 4)
  if (rng.chance(0.55)) {
    const b = rng.pick([2, 3, 5, 6, 7, 8, 11, 12] as const)
    const arg = rng.pick([10, 11, 13, 15, 17, 19, 20, 22, 23, 26, 28, 30, 35, 40, 50] as const)
    if (reserved(b) || reserved(arg)) throw new LogSkip()
    return decimalValue(`log_${b}(${arg})`, places, changeOfBaseNudge(String(arg), String(b), places), ['log_change_base_inverted', 'log_quotient_as_quotient'])
  }
  const kind = rng.chance(0.5) ? 'ln' : 'log'
  const arg = rng.pick([2, 3, 6, 8, 11, 12, 13, 15, 17, 19, 20, 22, 23, 26, 28] as const)
  return decimalValue(`${kind}(${arg})`, places, keyNudge(kind, String(arg), places), ['log_ln_confused'])
}

function drawConvert(rng: Rng): Drawn {
  const family = rng.int(0, 4)
  let given: string
  if (family === 0) {
    const b = rng.pick(BASES)
    const k = rng.pick([2, 3, 4, 5, 6] as const)
    const arg = ipow(b, k)
    if (arg > 4096) throw new LogSkip()
    given = `${b}^${k} = ${arg}`
  } else if (family === 1) {
    const b = rng.pick(BASES)
    const k = rng.pick([2, 3, 4, 5, 6] as const)
    const arg = ipow(b, k)
    if (arg > 4096) throw new LogSkip()
    given = `log_${b}(${arg}) = ${k}`
  } else if (family === 2) {
    const k = rng.pick([1, 2, 3] as const)
    const n = rng.pick([3, 5, 6, 7, 11, 13, 15, 17] as const)
    const exp = k === 1 ? 'x' : `${k}x`
    given = `e^(${exp}) = ${n}`
  } else if (family === 3) {
    const k = rng.pick([1, 2, 3] as const)
    const arg = k === 1 ? '0.1' : k === 2 ? '0.01' : '0.001'
    given = `10^(-${k}) = ${arg}`
  } else {
    const b = rng.pick([2, 3, 4, 5, 6, 7] as const)
    const k = rng.pick([1, 2, 3] as const)
    const n = ipow(b, rng.pick([2, 3, 4] as const))
    const exp = k === 1 ? 'x' : `${k}x`
    given = rng.chance(0.5) ? `log_${b}(${n}) = ${exp}` : `${b}^(${exp}) = ${n}`
  }
  const answer = convertForm(given)
  if (!answer) throw new LogSkip('not a form the engine converts')
  const g = gradeConvertForm(given, answer)
  if (g.verdict !== 'correct') throw new LogSkip('convert answer rejected')
  const forms = [answer, answer.replace(/\s+/g, '')]
  const mistakes = convertMistakes(given)
  const trap = pickTrap(mistakes, forms, CONVERT_NUDGE, CONVERT_HINT, 'log_convert_swapped')
  const graded = gradeConvertForm(given, trap.text)
  if (graded.verdict !== 'mistake' || (graded.mistake !== trap.id && !trap.shadows.includes(graded.mistake))) {
    throw new LogSkip('convert trap did not grade')
  }
  return {
    problem: given,
    answer,
    forms,
    prompt: 'Rewrite in the other form.',
    nudge: CONVERT_NUDGE,
    reveal: g.explanation,
    trap: trap.id,
    trapAnswer: trap.text,
  }
}

function assemble(question: LogFormsAnswer['question'], templateId: string, version: number, seed: number, knobs: DifficultyKnobs, drawn: Drawn): ProblemInstance {
  const card = lfRuleFor(drawn.trap)
  const answer: LogFormsAnswer = {
    type: 'logForms',
    question,
    problem: drawn.problem,
    prompt: drawn.prompt,
    answerText: drawn.answer,
    ...(drawn.places ? { places: drawn.places } : {}),
    formatHint: question === 'decimal' ? DECIMAL_HINT : question === 'convert' ? CONVERT_HINT : VALUE_HINT,
    stages: [{ id: 'answer', nudge: drawn.nudge, ruleCard: card, reveal: drawn.reveal }],
    expectedDisplay: drawn.answer,
    nudge: drawn.nudge,
    ruleCard: card,
    ruleCards: [card, LF_RULE_IDS.definition, LF_RULE_IDS.inverse, LF_RULE_IDS.change].filter((id, i, all) => all.indexOf(id) === i),
    reveal: drawn.reveal,
    trap: drawn.trap as LogFormsAnswer['trap'],
    trapAnswer: drawn.trapAnswer,
  }
  const title = question === 'value' ? 'Evaluate a logarithm' : question === 'convert' ? 'Rewrite the form' : 'Change of base on the calculator'
  const instructions =
    question === 'decimal'
      ? `Round to ${placesWord(drawn.places ?? 3)} decimal places.`
      : question === 'convert'
        ? 'Rewrite the equation in the other form.'
        : 'Give the exact value.'
  return {
    id: problemId(LF_MODULE_ID, templateId, version, seed),
    moduleId: LF_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: version,
    seed: seed >>> 0,
    knobs,
    kind: 'logForms',
    title,
    instructions,
    statementText: drawn.problem,
    vars: question === 'convert' ? ['x'] : [],
    start: null,
    canonical: [],
    answer,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { question, problem: drawn.problem, answer: drawn.answer, trap: drawn.trap, places: drawn.places ?? 0 },
  }
}

function generate(question: LogFormsAnswer['question'], templateId: string, version: number, salt: number) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const drawn = searchSeed(seed, salt, 48, (rng) => {
      if (question === 'value') return drawExact(rng)
      if (question === 'decimal') return drawDecimal(rng)
      return drawConvert(rng)
    })
    return assemble(question, templateId, version, seed, knobs, drawn)
  }
}

export const valueTemplate: TemplateDef = {
  id: 'lf.value',
  title: 'Evaluate a logarithm',
  description: 'An exact value: a power, a fraction, a negative exponent, a sum of logs, or an inverse property.',
  version: 1,
  knobs: [],
  generate: generate('value', 'lf.value', 1, 11),
}

export const convertTemplate: TemplateDef = {
  id: 'lf.convert',
  title: 'Rewrite in the other form',
  description: 'Exponential form to logarithmic form, or the other way, including a variable exponent.',
  version: 1,
  knobs: [],
  generate: generate('convert', 'lf.convert', 1, 12),
}

export const decimalTemplate: TemplateDef = {
  id: 'lf.decimal',
  title: 'Change of base on the calculator',
  description: 'A logarithm that is not a whole number, rounded to two, three, or four decimal places.',
  version: 1,
  knobs: [],
  generate: generate('decimal', 'lf.decimal', 1, 13),
}

export const LF_TEMPLATES = [valueTemplate, convertTemplate, decimalTemplate] as const

/** What she typed, for the tutor. */
export function logFormsWork(_answer: LogFormsAnswer, entries: Record<string, string> | undefined): string[] {
  const text = entries?.[LF_KEYS.answer]?.trim()
  return text ? [text] : []
}
