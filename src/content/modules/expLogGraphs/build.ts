/**
 * Graphs of exponential and logarithmic functions, drawn from the seed (family, base, a, h, k). Every draw is
 * kept only when each part's answer, each spelling it accepts, and each trap grade as promised, and when no
 * text she can see before she answers spells an answer.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AnswerSpec, DifficultyKnobs, ExpLogPart, ExpLogPartTrap, ProblemInstance, TemplateDef } from '@/content/types'
import type { CalcPanels, ErrorPatternId, GraphSpec } from '@/shared/types'
import { at, gradeExpLogPart, leaks, say, type InverseCheck, type PartGrade } from '../explog/parts'
import { LogSkip, frac, searchSeed } from '../explog/text'
import {
  asymptoteText,
  baseOf,
  curveGraph,
  curveSay,
  curveTex,
  curveText,
  domainText,
  flipBase,
  increasing,
  inside,
  interceptExponent,
  interceptPoint,
  logName,
  plus,
  powerFraction,
  rangeText,
  valueAt,
  windowFor,
  xIntercept,
  yIntercept,
  type Base,
  type Curve,
  type Family,
} from './curve'
import { EG_RULES, EG_RULE_IDS } from './rules'

export const EG_MODULE_ID = 'expLogGraphs' as const

export type ExpLogGraphsAnswer = Extract<AnswerSpec, { type: 'expLogGraphs' }>

const NO_GRAPH: GraphSpec = { kind: 'none' }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }
const VERSION = 1

export const INTERVAL_HINT = 'Interval notation, an inequality, or words such as all real numbers.'
export const LINE_HINT = 'The equation of a line: y = a number, or x = a number.'
export const POINT_HINT = 'A point (x, y) with exact coordinates. Fractions, powers and e are fine.'
export const CHOICE_HINT = 'Pick one.'
export const FORMULA_HINT = 'A formula in x. You may start with y = or f^-1(x) =.'
export const INSTRUCTIONS: Record<ExpLogGraphsAnswer['question'], string> = {
  features: 'One part at a time. Each part opens when the one before it is right.',
  match: 'Pick the one that matches.',
  inverse: 'Write f⁻¹(x) as a formula in x.',
}

const t = (id: ErrorPatternId, text: string, witness: string): ExpLogPartTrap => ({ id, text, witness })

/** "x − 3" for a sentence. */
const sayIn = (h: number) => say(inside(h))
/** "+ 3" or "− 3" as words in a sentence. */
const shiftWord = (k: number) => (k > 0 ? `+ ${k}` : `− ${-k}`)

/** The traps that differ from the answer and from each other (the earlier one keeps a shared answer). */
function distinctTraps(part: ExpLogPart, same: (a: string, b: string) => boolean): ExpLogPart {
  const kept: ExpLogPartTrap[] = []
  for (const trap of part.traps) {
    if (same(trap.text, part.answerText)) continue
    if (kept.some((k) => same(k.text, trap.text))) continue
    kept.push(trap)
  }
  return { ...part, traps: kept }
}

function sameByGrade(part: ExpLogPart): (a: string, b: string) => boolean {
  // Two texts are the same answer when one grades correct against the other.
  return (a, b) => gradeExpLogPart({ ...part, answerText: b, traps: [] }, a).verdict === 'correct'
}

/** "(3, inf)" → "x > 3"; "(-inf, -2)" → "y < -2"; "[3, inf)" → "x >= 3". */
function inequalityOf(interval: string, letter: 'x' | 'y'): string | null {
  const m = /^([([])(-?inf|-?\d+(?:\/\d+)?), (-?inf|-?\d+(?:\/\d+)?)([)\]])$/.exec(interval)
  if (!m) return null
  const [, open, lo, hi, close] = m
  if (lo === '-inf' && hi === 'inf') return null
  if (lo === '-inf') return `${letter} ${close === ']' ? '<=' : '<'} ${hi}`
  if (hi === 'inf') return `${letter} ${open === '[' ? '>=' : '>'} ${lo}`
  return null
}

/** Every spelling of an interval answer that grades right. */
function intervalForms(text: string, letter: 'x' | 'y'): string[] {
  if (text === '(-inf, inf)') return [text, '(-∞, ∞)', 'all real numbers', 'R']
  const ineq = inequalityOf(text, letter)
  return [text, text.replace(/inf/g, '∞'), ...(ineq ? [ineq] : [])]
}

/** A terminating decimal of a fraction coordinate, so (0, 3.25) is right for (0, 13/4). */
function decimalOf(text: string): string | null {
  const m = /^(-?\d+)\/(\d+)$/.exec(text)
  if (!m) return null
  let d = Number(m[2])
  while (d % 2 === 0) d /= 2
  while (d % 5 === 0) d /= 5
  if (d !== 1) return null
  return String(Number(m[1]) / Number(m[2]))
}

// ---------------------------------------------------------------------------
// Drawing a curve
// ---------------------------------------------------------------------------

const EXP_WHOLE = ['2', '3', '4', '5'] as const
const EXP_UNIT = ['1/2', '1/3', '1/4', '1/5'] as const
const EXP_FRACTION = ['2/3', '3/2', '3/4', '4/3', '2/5', '5/2'] as const
const LOG_WHOLE = ['2', '3', '4', '5', '10'] as const
const LOG_UNIT = ['1/2', '1/3'] as const

function drawA(rng: Rng): number {
  return rng.sign() * rng.pick([1, 1, 2, 3] as const)
}

function drawExpBase(rng: Rng): Base {
  const r = rng.int(0, 99)
  if (r < 35) return baseOf(rng.pick(EXP_WHOLE))
  if (r < 55) return baseOf(rng.pick(EXP_UNIT))
  if (r < 72) return baseOf(rng.pick(EXP_FRACTION))
  return baseOf('e')
}

function drawLogBase(rng: Rng): Base {
  const r = rng.int(0, 99)
  if (r < 62) return baseOf(rng.pick(LOG_WHOLE))
  if (r < 82) return baseOf('e')
  return baseOf(rng.pick(LOG_UNIT))
}

/** A textbook-sized exponential for features: |a| ≤ 3, |h| ≤ 3, k ≠ 0, and an intercept with small numbers. */
function drawExponential(rng: Rng): Curve {
  const base = drawExpBase(rng)
  const a = drawA(rng)
  const h = base.e ? rng.int(-2, 2) : rng.int(-3, 3)
  const k = rng.intExcept(-6, 6, [0])
  const c: Curve = { family: 'exponential', a, base, h, k }
  if (!base.e) {
    // 2^(−3) = 1/8, 3^3 = 27, (3/2)^2 = 9/4: powers she can work out by hand.
    const [n, d] = powerFraction(base, -h)
    if (n > 27 || d > 27) throw new LogSkip('intercept too large for a textbook')
    if (Math.abs(yIntercept(c).value) > 40) throw new LogSkip('intercept too far out')
  }
  return c
}

/** A textbook-sized log for features: h ≠ 0, and an x-intercept h + b^m with a whole m = −k/a. */
function drawLogarithmic(rng: Rng): Curve {
  const base = drawLogBase(rng)
  const a = drawA(rng)
  const h = rng.intExcept(-6, 6, [0])
  const m = base.text === '10' ? rng.int(-1, 1) : base.e ? rng.pick([-1, 0, 1, 1, 2] as const) : rng.int(-2, 3)
  const c: Curve = { family: 'logarithmic', a, base, h, k: -a * m + 0 }
  if (!base.e) {
    const [n, d] = powerFraction(base, m)
    if (n > 32 || d > 32) throw new LogSkip('intercept too large for a textbook')
  }
  return c
}

// ---------------------------------------------------------------------------
// eg.features
// ---------------------------------------------------------------------------

function featureParts(c: Curve): ExpLogPart[] {
  const fn = c.family === 'exponential' ? 'f' : 'g'
  const exp = c.family === 'exponential'
  const b = say(c.base.text)
  const power = exp ? say(curveText({ ...c, a: 1, k: 0 })) : ''
  const domain = domainText(c)
  const range = rangeText(c)
  const asym = asymptoteText(c)
  const up = increasing(c)

  const domainPart: ExpLogPart = exp
    ? {
        id: 'domain',
        kind: 'interval',
        label: 'Domain',
        ask: `What is the domain of ${fn}?`,
        formatHint: INTERVAL_HINT,
        nudge: 'Ask which x-values you can put into the exponent. Is there any x the formula refuses?',
        ruleCard: EG_RULE_IDS.domain,
        reveal: [`Any number can go into the exponent of ${power}, so ${fn} is defined for every real x.`, `Domain: ${say(domain)}.`],
        answerText: domain,
        traps: [
          t('exp_domain_range_swapped', range, 'Your interval stops at the height of the asymptote, so it describes outputs. The domain lists inputs: which x-values can go into an exponent?'),
        ],
      }
    : {
        id: 'domain',
        kind: 'interval',
        label: 'Domain',
        ask: `What is the domain of ${fn}?`,
        formatHint: INTERVAL_HINT,
        nudge: 'A log needs a positive input. Set the inside greater than 0 and solve for x.',
        ruleCard: EG_RULE_IDS.domain,
        reveal: [`The input ${sayIn(c.h)} has to be positive: ${sayIn(c.h)} > 0 gives x > ${say(String(c.h))}.`, `Domain: ${say(domain)}.`],
        answerText: domain,
        traps: [
          t('exp_endpoint_closed', `[${c.h}, inf)`, `Your interval includes ${say(String(c.h))} itself. There the input ${sayIn(c.h)} is 0, and the log of 0 is undefined: the input has to be strictly positive.`),
          t('exp_shift_sign', `(${-c.h}, inf)`, `Your interval starts at ${say(String(-c.h))}, but there the input ${sayIn(c.h)} is ${say(String(-2 * c.h))}. Set the input greater than 0 and solve for x.`),
          t('exp_asymptote_unshifted', '(0, inf)', `Your interval is the domain of a log of x alone. Here the input is ${sayIn(c.h)}, so the boundary moves with the shift.`),
          t('exp_domain_range_swapped', '(-inf, inf)', 'A log cannot take every input: its input has to be positive, so some x-values are left out.'),
        ],
      }

  const rangePart: ExpLogPart = exp
    ? {
        id: 'range',
        kind: 'interval',
        label: 'Range',
        ask: `What is the range of ${fn}?`,
        formatHint: INTERVAL_HINT,
        nudge: 'b^(x − h) is always positive. Multiply by a, then add k: which side of k do the outputs land on, and is k itself reached?',
        ruleCard: EG_RULE_IDS.domain,
        reveal: [
          `${power} is always positive, so ${say(String(c.a))}·${power} is always ${c.a > 0 ? 'positive' : 'negative'}.`,
          `The ${shiftWord(c.k)} moves every output to ${c.a > 0 ? 'above' : 'below'} ${say(String(c.k))}, and none of them equals ${say(String(c.k))}.`,
          `Range: ${say(range)}.`,
        ],
        answerText: range,
        traps: [
          t(
            'exp_sign_of_a',
            c.a > 0 ? `(-inf, ${c.k})` : `(${c.k}, inf)`,
            c.a > 0
              ? `Your interval puts the outputs on the other side of the asymptote from b^(x − h). Here a = ${say(String(c.a))} is positive, so a·b^(x − h) has the sign of b^(x − h), which is never negative.`
              : `Your interval puts the outputs on the side where b^(x − h) alone would put them. Here a = ${say(String(c.a))} is negative: it flips every output to the other side of the asymptote.`,
          ),
          t(
            'exp_asymptote_unshifted',
            c.a > 0 ? '(0, inf)' : '(-inf, 0)',
            `Your interval stops at 0, where b^(x − h) levels off before the shift. The ${shiftWord(c.k)} moves every output, so the boundary moves too.`,
          ),
          t(
            'exp_endpoint_closed',
            c.a > 0 ? `[${c.k}, inf)` : `(-inf, ${c.k}]`,
            `Your interval includes ${say(String(c.k))}. The graph gets as close as you like to its asymptote but never reaches it, so ${say(String(c.k))} itself is not an output.`,
          ),
          t('exp_domain_range_swapped', '(-inf, inf)', 'An exponential takes every input, but its outputs never cross its asymptote, so they do not reach every height.'),
        ],
      }
    : {
        id: 'range',
        kind: 'interval',
        label: 'Range',
        ask: `What is the range of ${fn}?`,
        formatHint: INTERVAL_HINT,
        nudge: 'Near its asymptote a log heads down without end, and as x grows it keeps climbing. Which heights does it reach?',
        ruleCard: EG_RULE_IDS.domain,
        reveal: [`As x moves toward the asymptote the log heads off without end, and as x grows it keeps going the other way, so ${fn} reaches every height.`, `Range: ${say(range)}.`],
        answerText: range,
        traps: [t('exp_domain_range_swapped', domain, 'Your interval lists the x-values the log accepts: its inputs. The range lists the heights the graph reaches.')],
      }

  const asymptotePart: ExpLogPart = exp
    ? {
        id: 'asymptote',
        kind: 'line',
        label: 'Asymptote',
        ask: `What is the asymptote of ${fn}? Give its equation.`,
        formatHint: LINE_HINT,
        nudge: 'As x runs far one way, b^(x − h) shrinks toward 0. What number does the whole function get close to then?',
        ruleCard: EG_RULE_IDS.asymptote,
        reveal: [`As x → ${c.base.value > 1 ? '−∞' : '∞'}, ${power} → 0, so ${fn}(x) → ${say(String(c.k))}.`, `Asymptote: ${say(asym)}.`],
        answerText: asym,
        traps: [
          t('exp_asymptote_unshifted', 'y = 0', `y = 0 is where b^(x − h) levels off before the shift. The ${shiftWord(c.k)} moves the whole graph, the asymptote with it.`),
          t('exp_asymptote_axis', `x = ${c.k}`, `x = ${say(String(c.k))} is an upright line. An exponential levels off toward a flat line, and a flat line is y = a number.`),
          t('exp_asymptote_axis', `x = ${c.h}`, `x = ${say(String(c.h))} is an upright line, the kind a log has. An exponential levels off toward a flat line, y = a number.`),
        ],
      }
    : {
        id: 'asymptote',
        kind: 'line',
        label: 'Asymptote',
        ask: `What is the asymptote of ${fn}? Give its equation.`,
        formatHint: LINE_HINT,
        nudge: 'The graph of a log runs along the line where its input is 0.',
        ruleCard: EG_RULE_IDS.asymptote,
        reveal: [`The input ${sayIn(c.h)} is 0 at x = ${say(String(c.h))}, and the graph runs along that line.`, `Asymptote: ${say(asym)}.`],
        answerText: asym,
        traps: [
          t('exp_shift_sign', `x = ${-c.h}`, `At x = ${say(String(-c.h))} the input ${sayIn(c.h)} is ${say(String(-2 * c.h))}, not 0. The asymptote is where the input is 0.`),
          t('exp_asymptote_unshifted', 'x = 0', `x = 0 is where a log of x alone has its asymptote. Here the input is ${sayIn(c.h)}, and it is 0 somewhere else.`),
          t('exp_asymptote_axis', `y = ${c.h}`, `y = ${say(String(c.h))} is a flat line. A log runs along an upright line: x = a number.`),
          t('exp_asymptote_axis', `y = ${c.k}`, `y = ${say(String(c.k))} is a flat line, the kind an exponential has. A log’s asymptote is upright: x = a number.`),
        ],
      }

  const interceptPart: ExpLogPart = exp ? expIntercept(c, fn) : logIntercept(c, fn)

  const behaviorTrapId: ErrorPatternId = c.a < 0 ? 'exp_sign_of_a' : 'exp_base_direction'
  const behaviorWitness =
    c.a < 0
      ? 'A negative a flips the graph over its asymptote, so it runs the opposite way from b^(x − h) alone.'
      : c.base.value > 1
        ? 'With a > 0 the graph runs the way the base does, and a base above 1 gives larger values for larger x.'
        : 'With a > 0 the graph runs the way the base does, and a base between 0 and 1 gives smaller values for larger x.'
  const behaviorPart: ExpLogPart = {
    id: 'behavior',
    kind: 'choice',
    label: 'Increasing or decreasing',
    ask: `Is ${fn} increasing or decreasing?`,
    formatHint: CHOICE_HINT,
    choices: [
      { value: 'increasing', label: 'Increasing' },
      { value: 'decreasing', label: 'Decreasing' },
    ],
    nudge: 'Look at the base first: above 1, or between 0 and 1? Then look at the sign of a.',
    ruleCard: EG_RULE_IDS.direction,
    reveal: [
      `The base ${b} is ${c.base.value > 1 ? 'above 1, so on its own it rises' : 'between 0 and 1, so on its own it falls'}.`,
      `a = ${say(String(c.a))} is ${c.a > 0 ? 'positive, so it keeps that direction' : 'negative, so it flips that direction'}.`,
      `${fn} is ${up ? 'increasing' : 'decreasing'}.`,
    ],
    answerText: up ? 'increasing' : 'decreasing',
    traps: [t(behaviorTrapId, up ? 'decreasing' : 'increasing', behaviorWitness)],
  }

  return [domainPart, rangePart, asymptotePart, interceptPart, behaviorPart].map((p) => distinctTraps(p, sameByGrade(p)))
}

/** b^m written for a sentence: "3^2", "(1/2)^(−1)", "e", "e^(−1)". */
function powerSay(b: Base, m: number): string {
  if (b.e && m === 1) return 'e'
  const base = b.e ? 'e' : b.q === 1 ? b.text : `(${b.text})`
  return say(`${base}^${m < 0 ? `(${m})` : m}`)
}

/** "2·3^(−1)", "−e^2", "(1/2)^3": a·b^m for a sentence. */
function scaledPowerSay(a: number, b: Base, m: number): string {
  const p = powerSay(b, m)
  return a === 1 ? p : a === -1 ? `−${p}` : `${say(String(a))}·${p}`
}

function expIntercept(c: Curve, fn: string): ExpLogPart {
  const y = yIntercept(c)
  const traps: ExpLogPartTrap[] = []
  const pointOf = (text: string) => `(0, ${text})`
  if (c.h !== 0) {
    traps.push(t('exp_intercept_shift', pointOf(String(c.a + c.k)), `Your point uses b^0 = 1, as if the exponent were 0 at x = 0. At x = 0 the exponent ${sayIn(c.h)} is ${say(String(-c.h))}.`))
    const flipped = yIntercept({ ...c, h: -c.h })
    traps.push(t('exp_shift_sign', pointOf(flipped.text), `Your point uses the exponent ${say(String(c.h))}, the shift with its sign flipped. At x = 0, ${sayIn(c.h)} is ${say(String(-c.h))}.`))
  }
  const noK = yIntercept({ ...c, k: 0 })
  traps.push(t('exp_intercept_shift', pointOf(noK.text), `Your point leaves out the ${shiftWord(c.k)}. ${fn}(0) is the whole formula at x = 0, the vertical shift included.`))
  return {
    id: 'intercept',
    kind: 'point',
    label: 'y-intercept',
    ask: 'What is the y-intercept? Give it as an exact point.',
    formatHint: POINT_HINT,
    nudge: 'The y-intercept is where x = 0. Put x = 0 into every part of the formula, shifts included.',
    ruleCard: EG_RULE_IDS.intercept,
    reveal: [`${fn}(0) = ${scaledPowerSay(c.a, c.base, -c.h)}${say(plus(c.k))} = ${say(y.text)}.`, `y-intercept: (0, ${say(y.text)}).`],
    answerText: pointOf(y.text),
    traps,
  }
}

function logIntercept(c: Curve, fn: string): ExpLogPart {
  const x = xIntercept(c)
  const m = interceptExponent(c)
  const b = c.base
  const traps: ExpLogPartTrap[] = []
  const pointOf = (text: string) => `(${text}, 0)`
  if (m !== 0) {
    traps.push(t('exp_intercept_shift', pointOf(String(c.h + 1)), `Your point is where the log itself is 0. With the ${shiftWord(c.k)}, ${fn}(x) = 0 asks for the log to equal ${say(String(m))} instead.`))
  }
  const flipped = xIntercept({ ...c, h: -c.h })
  traps.push(t('exp_shift_sign', pointOf(flipped.text), `Your point moves the wrong way from the power: if ${sayIn(c.h)} = u, then x = u ${c.h > 0 ? '+' : '−'} ${Math.abs(c.h)}.`))
  traps.push(t('log_convert_dropped', pointOf(String(c.h + m)), `Your point solves ${sayIn(c.h)} = ${say(String(m))}, as if the log were erased. A log equal to ${say(String(m))} means its input is the base to the power ${say(String(m))}.`))
  const logW = say(`${logName(b)}(${inside(c.h)})`)
  const isolate = c.k === 0 ? `${logW} = 0` : c.a === 1 ? `${logW} = ${say(String(m))}` : `${say(String(c.a))}·${logW} = ${say(String(-c.k))}, so ${logW} = ${say(String(m))}`
  return {
    id: 'intercept',
    kind: 'point',
    label: 'x-intercept',
    ask: 'What is the x-intercept? Give it as an exact point.',
    formatHint: POINT_HINT,
    nudge: 'The x-intercept is where the function equals 0. Isolate the log, then rewrite it as a power of the base.',
    ruleCard: EG_RULE_IDS.intercept,
    reveal: [`Set ${fn}(x) = 0: ${isolate}.`, `Rewrite as a power: ${sayIn(c.h)} = ${powerSay(b, m)}, so x = ${say(x.text)}.`, `x-intercept: (${say(x.text)}, 0).`],
    answerText: pointOf(x.text),
    traps,
  }
}

/** Every spelling of each part's answer that has to grade right. */
function acceptedForms(part: ExpLogPart, c: Curve): string[] {
  if (part.kind === 'interval') return intervalForms(part.answerText, part.id === 'range' ? 'y' : 'x')
  if (part.kind === 'line') return [part.answerText, part.answerText.replace(/\s+/g, '')]
  if (part.kind === 'point') {
    const forms = [part.answerText]
    const inner = /^\((.*), (.*)\)$/.exec(part.answerText)
    if (inner) {
      forms.push(`${inner[1]}, ${inner[2]}`)
      const dx = decimalOf(inner[1]!)
      const dy = decimalOf(inner[2]!)
      if (dx || dy) forms.push(`(${dx ?? inner[1]}, ${dy ?? inner[2]})`)
    }
    if (c.base.e && c.family === 'exponential' && c.h === 1) forms.push(`(0, ${c.a}/e${plus(c.k)})`)
    return forms
  }
  if (part.kind === 'choice') return [part.answerText, part.answerText[0]!.toUpperCase() + part.answerText.slice(1)]
  return [part.answerText]
}

const PROMISES: Record<Family, { stage: string; id: ErrorPatternId; weight: number; when?: (c: Curve) => boolean }[]> = {
  exponential: [
    { stage: 'asymptote', id: 'exp_asymptote_unshifted', weight: 3 },
    { stage: 'range', id: 'exp_sign_of_a', weight: 3, when: (c) => c.a < 0 },
    { stage: 'range', id: 'exp_endpoint_closed', weight: 1 },
    { stage: 'intercept', id: 'exp_intercept_shift', weight: 2 },
    { stage: 'domain', id: 'exp_domain_range_swapped', weight: 1 },
    { stage: 'behavior', id: 'exp_sign_of_a', weight: 1, when: (c) => c.a < 0 },
  ],
  logarithmic: [
    { stage: 'asymptote', id: 'exp_shift_sign', weight: 3 },
    { stage: 'domain', id: 'exp_endpoint_closed', weight: 3 },
    { stage: 'asymptote', id: 'exp_asymptote_unshifted', weight: 1 },
    { stage: 'intercept', id: 'exp_intercept_shift', weight: 2 },
    { stage: 'range', id: 'exp_domain_range_swapped', weight: 1 },
    { stage: 'behavior', id: 'exp_base_direction', weight: 1, when: (c) => c.a > 0 && c.base.value < 1 },
  ],
}

function promise(rng: Rng, c: Curve, parts: readonly ExpLogPart[]): { stage: string; trap: ExpLogPartTrap } {
  const pool: { stage: string; trap: ExpLogPartTrap }[] = []
  for (const p of PROMISES[c.family]) {
    if (p.when && !p.when(c)) continue
    const part = parts.find((s) => s.id === p.stage)
    const trap = part?.traps.find((tr) => tr.id === p.id)
    if (trap) for (let i = 0; i < p.weight; i++) pool.push({ stage: p.stage, trap })
  }
  if (!pool.length) throw new LogSkip('no trap to promise')
  return rng.pick(pool)
}

// ---------------------------------------------------------------------------
// Checking a draw
// ---------------------------------------------------------------------------

function cardTexts(): string[] {
  return EG_RULES.flatMap((r) => [r.title, r.body, r.example ?? ''])
}

/** Every answer, every accepted spelling and every trap grades as promised, and nothing shown spells an answer. */
function validate(answer: ExpLogGraphsAnswer, forms: Map<string, string[]>, instructions: string): void {
  const check = answer.question === 'inverse' ? inverseCheck(curveOf(answer)) : undefined
  for (const part of answer.stages) {
    for (const form of forms.get(part.id) ?? [part.answerText]) {
      const g = gradeExpLogPart(part, form, check)
      if (g.verdict !== 'correct') throw new LogSkip(`${part.id}: “${form}” graded ${g.verdict}`)
    }
    for (const trap of part.traps) {
      const g = gradeExpLogPart(part, trap.text, check)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) throw new LogSkip(`${part.id}: trap ${trap.id} “${trap.text}” graded ${g.verdict}`)
    }
  }
  const promised = answer.stages.find((s) => s.id === answer.trapStage)
  const g = promised ? gradeExpLogPart(promised, answer.trapAnswer, check) : null
  if (!g || g.verdict !== 'mistake' || g.mistake !== answer.trap) throw new LogSkip('the promised trap does not grade as itself')
  const found = leaks(answer.prompt, instructions, answer.stages, (s) => forms.get(s.id) ?? [s.answerText], cardTexts())
  if (found.length) throw new LogSkip(`a text she sees before answering spells an answer: ${found[0]}`)
}

export function curveOf(answer: Pick<ExpLogGraphsAnswer, 'family' | 'a' | 'base' | 'h' | 'k'>): Curve {
  return { family: answer.family, a: answer.a, base: baseOf(answer.base), h: answer.h, k: answer.k }
}

// ---------------------------------------------------------------------------
// Assembling an instance
// ---------------------------------------------------------------------------

interface Drawn {
  answer: ExpLogGraphsAnswer
  forms: Map<string, string[]>
}

function assemble(templateId: string, seed: number, knobs: DifficultyKnobs, drawn: Drawn, title: string): ProblemInstance {
  const a = drawn.answer
  return {
    id: problemId(EG_MODULE_ID, templateId, VERSION, seed),
    moduleId: EG_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: VERSION,
    seed: seed >>> 0,
    knobs,
    kind: 'expLogGraphs',
    title,
    instructions: INSTRUCTIONS[a.question],
    statementText: `${a.fnName}(x) = ${a.f}`,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: a,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: { question: a.question, family: a.family, a: a.a, base: a.base, h: a.h, k: a.k, trap: a.trap, trapStage: a.trapStage, ...(a.matchMode ? { matchMode: a.matchMode } : {}) },
  }
}

function common(c: Curve): Pick<ExpLogGraphsAnswer, 'type' | 'family' | 'fnName' | 'f' | 'tex' | 'a' | 'base' | 'h' | 'k'> {
  const fnName = c.family === 'exponential' ? 'f' : 'g'
  return { type: 'expLogGraphs', family: c.family, fnName, f: curveText(c), tex: curveTex(c, fnName), a: c.a, base: c.base.text, h: c.h, k: c.k }
}

/** The features problem of one curve (exported for the hand-worked tests). */
export function featuresAnswer(c: Curve, pick: (parts: readonly ExpLogPart[]) => { stage: string; trap: ExpLogPartTrap }): Drawn {
  const parts = featureParts(c)
  const chosen = pick(parts)
  const fn = c.family === 'exponential' ? 'f' : 'g'
  const point = interceptPoint(c)
  const half = windowFor(c, point)
  const answer: ExpLogGraphsAnswer = {
    ...common(c),
    question: 'features',
    prompt: `Find the domain, the range, the asymptote, the ${c.family === 'exponential' ? 'y' : 'x'}-intercept as an exact point, and whether ${fn} is increasing or decreasing.`,
    stages: parts,
    expectedDisplay: parts.map((p) => `${p.label}: ${p.kind === 'choice' ? p.answerText : say(p.answerText)}`).join('; '),
    nudge: parts[0]!.nudge,
    ruleCard: parts[0]!.ruleCard,
    ruleCards: [EG_RULE_IDS.domain, EG_RULE_IDS.asymptote, EG_RULE_IDS.intercept, EG_RULE_IDS.direction],
    reveal: parts.flatMap((p) => p.reveal),
    trap: chosen.trap.id,
    trapStage: chosen.stage,
    trapAnswer: chosen.trap.text,
    graph: curveGraph(c, { half, dot: { x: point.x, y: point.y } }),
  }
  const forms = new Map(parts.map((p) => [p.id, acceptedForms(p, c)]))
  return { answer, forms }
}

function drawFeatures(rng: Rng): Drawn {
  const c = rng.chance(0.55) ? drawExponential(rng) : drawLogarithmic(rng)
  const drawn = featuresAnswer(c, (parts) => promise(rng, c, parts))
  validate(drawn.answer, drawn.forms, INSTRUCTIONS[drawn.answer.question])
  return drawn
}

// ---------------------------------------------------------------------------
// eg.match
// ---------------------------------------------------------------------------

const LETTERS = ['A', 'B', 'C', 'D'] as const

interface Candidate {
  curve: Curve
  trap?: { id: ErrorPatternId; graphWitness: (letter: string) => string; equationWitness: (letter: string) => string }
}

/** Two graphs a student can tell apart in the window: somewhere at least a unit apart, on screen. */
function apart(p: Curve, q: Curve, half: number): boolean {
  let seen = 0
  for (let x = -half; x <= half; x += 0.1) {
    const u = valueAt(p, x)
    const v = valueAt(q, x)
    const onScreen = (w: number) => Number.isFinite(w) && Math.abs(w) <= half
    if (!onScreen(u) && !onScreen(v)) continue
    if (!Number.isFinite(u) || !Number.isFinite(v) || Math.abs(u - v) >= 1) seen++
  }
  return seen >= 6
}

function matchCandidates(rng: Rng, c: Curve, mode: 'graph' | 'equation'): Candidate[] {
  const out: Candidate[] = [{ curve: c }]
  const signWord = (a: number) => say(String(a))
  const hWords = (h: number) => `x ${h > 0 ? '−' : '+'} ${Math.abs(h)}`
  if (c.family === 'exponential') {
    out.push({
      curve: { ...c, a: -c.a },
      trap: {
        id: 'exp_sign_of_a',
        graphWitness: (l) => `Graph ${l} sits on the other side of its asymptote from where b^(x − h) puts it: its a has the opposite sign.`,
        equationWitness: (l) => `${l} has a = ${signWord(-c.a)}, the opposite sign, so its graph sits on the other side of the asymptote.`,
      },
    })
    const flipped = flipBase(c.base)
    out.push({
      curve: { ...c, base: flipped },
      trap: {
        id: 'exp_base_direction',
        graphWitness: (l) => `Graph ${l} runs the other way: its base is on the other side of 1.`,
        equationWitness: (l) => `${l} has the base ${say(flipped.text)}, on the other side of 1, so its graph runs the other way.`,
      },
    })
    out.push({
      curve: { ...c, h: -c.h },
      trap: {
        id: 'exp_shift_sign',
        graphWitness: (l) => `Graph ${l} is shifted the other way: it is the graph with ${hWords(-c.h)} in the exponent.`,
        equationWitness: (l) => `${l} has ${hWords(-c.h)} in the exponent, which shifts the graph the other way.`,
      },
    })
    return out
  }
  const written = mode === 'equation' && !c.base.e && rng.chance(0.5) ? 'base' : 'sign'
  if (written === 'base') {
    const flipped = flipBase(c.base)
    out.push({
      curve: { ...c, base: flipped },
      trap: {
        id: 'exp_base_direction',
        graphWitness: (l) => `Graph ${l} is flipped over: its base is on the other side of 1.`,
        equationWitness: (l) => `${l} has the base ${say(flipped.text)}, on the other side of 1, which flips the graph over.`,
      },
    })
  } else {
    out.push({
      curve: { ...c, a: -c.a },
      trap: {
        id: 'exp_sign_of_a',
        graphWitness: (l) => `Graph ${l} is flipped over its asymptote: its a has the opposite sign.`,
        equationWitness: (l) => `${l} has a = ${signWord(-c.a)}, the opposite sign, which flips the graph over.`,
      },
    })
  }
  out.push({
    curve: { ...c, h: -c.h },
    trap: {
      id: 'exp_shift_sign',
      graphWitness: (l) => `Graph ${l} is shifted the other way: its asymptote is on the other side of the y-axis.`,
      equationWitness: (l) => `${l} has ${hWords(-c.h)} inside the log, which shifts the graph the other way.`,
    },
  })
  out.push({
    curve: { ...c, k: -c.k },
    trap: {
      id: 'exp_shift_sign',
      graphWitness: (l) => `Graph ${l} is moved ${c.k > 0 ? 'down' : 'up'} where the formula's ${shiftWord(c.k)} moves it ${c.k > 0 ? 'up' : 'down'}.`,
      equationWitness: (l) => `${l} has ${shiftWord(-c.k)} at the end, which moves the graph the other way.`,
    },
  })
  return out
}

function drawMatchCurve(rng: Rng): Curve {
  if (rng.chance(0.5)) {
    const base = baseOf(rng.pick(['2', '3', '4', '1/2', '1/3', '1/4'] as const))
    return { family: 'exponential', a: rng.sign() * rng.pick([1, 1, 2] as const), base, h: rng.sign() * rng.int(1, 3), k: rng.intExcept(-4, 4, [0]) }
  }
  const base = baseOf(rng.pick(['2', '3', '4', 'e'] as const))
  return { family: 'logarithmic', a: rng.sign() * rng.pick([1, 1, 2] as const), base, h: rng.sign() * rng.int(1, 4), k: rng.intExcept(-3, 3, [0]) }
}

function drawMatch(rng: Rng): Drawn {
  const c = drawMatchCurve(rng)
  const mode = rng.chance(0.5) ? 'graph' : 'equation'
  const cands = matchCandidates(rng, c, mode)
  const half = Math.max(6, Math.abs(c.h) + 3, Math.abs(c.k) + 3)
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      if (!apart(cands[i]!.curve, cands[j]!.curve, half)) throw new LogSkip('two candidate graphs look alike')
    }
  }
  const order = rng.shuffle(cands)
  const fn = c.family === 'exponential' ? 'f' : 'g'
  const right = LETTERS[order.findIndex((x) => !x.trap)]!
  const traps: ExpLogPartTrap[] = []
  order.forEach((cand, i) => {
    if (!cand.trap) return
    const letter = LETTERS[i]!
    traps.push(t(cand.trap.id, letter, mode === 'graph' ? cand.trap.graphWitness(letter) : cand.trap.equationWitness(letter)))
  })
  const exp = c.family === 'exponential'
  const anchor = exp ? { x: c.h, y: c.a + c.k } : { x: c.h + 1, y: c.k }
  const side = exp ? `a = ${say(String(c.a))} is ${c.a > 0 ? 'positive, so the curve is above it' : 'negative, so the curve is below it'}` : `a = ${say(String(c.a))}`
  const part: ExpLogPart = {
    id: 'match',
    kind: 'choice',
    label: mode === 'graph' ? 'The matching graph' : 'The matching equation',
    ask: mode === 'graph' ? `Which graph shows ${fn}?` : 'Which equation matches the graph?',
    formatHint: 'Pick one letter.',
    choices: LETTERS.map((l) => ({ value: l, label: mode === 'graph' ? `Graph ${l}` : l })),
    nudge: 'Find the asymptote first, then which side of it the curve is on, then whether it rises or falls. One point settles a shift.',
    ruleCard: EG_RULE_IDS.match,
    reveal: [
      `${say(`${fn}(x) = ${curveText(c)}`)} has the asymptote ${say(asymptoteText(c))}.`,
      exp ? `${side}.` : `${side}, and the base ${say(c.base.text)} is above 1.`,
      `It is ${increasing(c) ? 'increasing' : 'decreasing'} and passes through (${say(String(anchor.x))}, ${say(String(anchor.y))}).`,
      mode === 'graph' ? `That is graph ${right}.` : `That is equation ${right}.`,
    ],
    answerText: right,
    traps,
  }
  const candidates = order.map((cand, i) => ({
    letter: LETTERS[i]!,
    f: curveText(cand.curve),
    tex: curveTex(cand.curve, fn),
    graph: curveGraph(cand.curve, { half, ariaLabel: `Graph ${LETTERS[i]}` }),
  }))
  const promised = rng.pick(traps)
  const answer: ExpLogGraphsAnswer = {
    ...common(c),
    question: 'match',
    prompt: mode === 'graph' ? `Which of the four graphs is the graph of ${fn}?` : 'Which of the four equations matches the graph?',
    matchMode: mode,
    candidates,
    stages: [part],
    expectedDisplay: `${right}: ${say(`${fn}(x) = ${curveText(c)}`)}`,
    nudge: part.nudge,
    ruleCard: EG_RULE_IDS.match,
    ruleCards: [EG_RULE_IDS.match, EG_RULE_IDS.asymptote, EG_RULE_IDS.direction],
    reveal: part.reveal,
    trap: promised.id,
    trapStage: 'match',
    trapAnswer: promised.text,
    graph: mode === 'equation' ? curveGraph(c, { half, ariaLabel: 'The graph to match' }) : curveGraph(c, { half }),
  }
  const drawn = { answer, forms: new Map([[part.id, acceptedForms(part, c)]]) }
  validate(answer, drawn.forms, INSTRUCTIONS.match)
  return drawn
}

// ---------------------------------------------------------------------------
// eg.inverse
// ---------------------------------------------------------------------------

/** (x − k)/a, as the input of the inverse: "x - 3", "3 - x", "(x - 3)/2", "(3 - x)/2". */
function undoOutside(a: number, k: number): string {
  const diff = a > 0 ? inside(k) : k === 0 ? '-x' : `${k} - x`
  const m = Math.abs(a)
  return m === 1 ? diff : `(${diff})/${m}`
}

/** The inverse of a curve, app syntax. */
export function inverseText(c: Curve): string {
  const input = undoOutside(c.a, c.k)
  if (c.family === 'exponential') return `${logName(c.base)}(${input})${plus(c.h)}`
  const b = c.base.e ? 'e' : c.base.q === 1 ? c.base.text : `(${c.base.text})`
  return `${b}^(${input})${plus(c.h)}`
}

/** Where the inverse check samples f, and the exact points it tests. */
export function inverseCheck(c: Curve): InverseCheck {
  const f = curveText(c)
  const exp = c.family === 'exponential'
  const sign = c.a > 0 ? 1 : -1
  const domainSamples = (exp ? [-2, -1, -0.5, 0.5, 1, 2, 3] : [0.2, 0.5, 1, 2, 4, 9]).map((d) => c.h + d)
  const rangeSamples = exp ? [0.25, 0.5, 1, 2.5, 6, 15].map((s) => c.k + sign * s) : [-5, -2, -0.5, 0.5, 2, 5].map((s) => c.k + s)
  const spots: { x: string; y: string }[] = []
  if (exp) {
    spots.push({ x: String(c.h), y: String(c.a + c.k) })
    if (!c.base.e) spots.push({ x: String(c.h + 1), y: frac(c.a * c.base.p + c.k * c.base.q, c.base.q) })
  } else {
    spots.push({ x: String(c.h + 1), y: String(c.k) })
    if (!c.base.e && c.base.q === 1) spots.push({ x: String(c.h + c.base.p), y: String(c.a + c.k) })
  }
  return { f, domainSamples, rangeSamples, spots, probes: [-7.5, -4.25, -2.5, -1.2, -0.4, 0.3, 1.1, 2.6, 4.4, 6.8, 9.5] }
}

function inverseReveal(c: Curve): string[] {
  const fn = say(curveText(c))
  const swapped = say(curveText(c).replace(/(?<![A-Za-z])x(?![A-Za-z])/g, 'y'))
  const lines = [`y = ${fn}`, `Swap x and y: x = ${swapped}.`]
  const exp = c.family === 'exponential'
  const core = exp ? curveText({ ...c, a: 1, k: 0 }) : `${logName(c.base)}(${inside(c.h)})`
  const coreY = say(core.replace(/(?<![A-Za-z])x(?![A-Za-z])/g, 'y'))
  const left = c.k === 0 ? 'x' : inside(c.k)
  if (c.k !== 0) lines.push(`${c.k > 0 ? 'Subtract' : 'Add'} ${Math.abs(c.k)}: ${say(left)} = ${c.a === 1 ? '' : c.a === -1 ? '−' : `${say(String(c.a))}·`}${coreY}.`)
  if (c.a !== 1) lines.push(`Divide by ${say(String(c.a))}: ${say(undoOutside(c.a, c.k))} = ${coreY}.`)
  const yIn = say(inside(c.h).replace('x', 'y'))
  if (exp) {
    lines.push(`Rewrite the power as a log with base ${say(c.base.text)}: ${yIn} = ${say(`${logName(c.base)}(${undoOutside(c.a, c.k)})`)}.`)
  } else {
    const b = c.base.e ? 'e' : c.base.q === 1 ? c.base.text : `(${c.base.text})`
    lines.push(`Rewrite the log as a power of ${say(c.base.text)}: ${yIn} = ${say(`${b}^(${undoOutside(c.a, c.k)})`)}.`)
  }
  if (c.h !== 0) lines.push(`${c.h > 0 ? 'Add' : 'Subtract'} ${Math.abs(c.h)}: y = ${say(inverseText(c))}.`)
  lines.push(`f⁻¹(x) = ${say(inverseText(c))}.`)
  return lines
}

/** The inverse problem of one curve (exported for the hand-worked tests). */
export function inverseAnswer(c: Curve, pick: (traps: readonly ExpLogPartTrap[]) => ExpLogPartTrap): Drawn {
  const inv = inverseText(c)
  const exp = c.family === 'exponential'
  const input = undoOutside(c.a, c.k)
  const traps: ExpLogPartTrap[] = []
  const copied = exp ? `${logName(c.base)}(${undoOutside(c.a, c.h)})${plus(c.k)}` : `${c.base.e ? 'e' : c.base.q === 1 ? c.base.text : `(${c.base.text})`}^(${undoOutside(c.a, c.h)})${plus(c.k)}`
  traps.push(
    t(
      'exp_inverse_shift',
      copied,
      'Your formula keeps each shift where it was in f. When x and y trade places, the number added outside ends up inside, and the shift inside ends up outside.',
    ),
  )
  if (exp) {
    traps.push(
      t(
        'exp_inverse_base_swapped',
        `log_(${input})(${c.base.text})${plus(c.h)}`,
        `In your log, the base and the input traded places: ${say(c.base.text)} went inside. The base of the power in f is the base of the log.`,
      ),
    )
  } else if (!c.base.e && c.base.q === 1 && c.base.p <= 5) {
    traps.push(
      t(
        'exp_inverse_base_swapped',
        `(${input})^${c.base.p}${plus(c.h)}`,
        `Your formula raises the input to the power ${c.base.p}. Undoing a log with base ${c.base.p} means ${c.base.p} raised to a power: the base stays the base.`,
      ),
    )
  }
  traps.push(t('exp_inverse_reciprocal', `1/(${curveText(c)})`, 'Your formula is 1/f(x), the reciprocal of f. The inverse undoes f instead: f⁻¹(f(x)) gives back x.'))
  const part: ExpLogPart = {
    id: 'inverse',
    kind: 'formula',
    label: 'f⁻¹(x)',
    ask: 'Find f⁻¹(x), the inverse of f.',
    formatHint: FORMULA_HINT,
    nudge: 'Swap x and y. Then get the power (or the log) by itself and rewrite it in the other form, with the same base.',
    ruleCard: EG_RULE_IDS.inverse,
    reveal: inverseReveal(c),
    answerText: inv,
    traps,
  }
  // Traps are different formulas; the draw then checks that each one grades as itself.
  const kept = distinctTraps(part, (p, q) => p.replace(/\s+/g, '') === q.replace(/\s+/g, ''))
  const chosen = pick(kept.traps)
  const half = Math.max(8, Math.abs(c.h) + Math.abs(c.k) + 3)
  const answer: ExpLogGraphsAnswer = {
    ...common(c),
    fnName: 'f',
    tex: curveTex(c, 'f'),
    question: 'inverse',
    prompt: 'Find the inverse function, f⁻¹(x).',
    stages: [kept],
    expectedDisplay: `f⁻¹(x) = ${say(inv)}`,
    nudge: kept.nudge,
    ruleCard: EG_RULE_IDS.inverse,
    ruleCards: [EG_RULE_IDS.inverse, EG_RULE_IDS.domain],
    reveal: kept.reveal,
    trap: chosen.id,
    trapStage: 'inverse',
    trapAnswer: chosen.text,
    graph: curveGraph(c, { half: Math.min(half, 14), finv: inv }),
  }
  const alternates = [inv, `y = ${inv}`, `f^-1(x) = ${inv}`]
  if (exp && !c.base.e && c.base.text !== '10') alternates.push(`ln(${input})/ln(${c.base.text})${plus(c.h)}`)
  return { answer, forms: new Map([['inverse', alternates]]) }
}

function drawInverseCurve(rng: Rng): Curve {
  const family: Family = rng.chance(0.5) ? 'exponential' : 'logarithmic'
  const base = baseOf(rng.pick(['2', '2', '3', '3', '4', '5', '10', 'e', 'e'] as const))
  const a = rng.pick([1, 1, 1, 1, 2, 3, -1, -2] as const)
  const h = rng.intExcept(-6, 6, [0])
  const k = rng.intExcept(-6, 6, [0, h])
  return { family, a, base, h, k }
}

function drawInverse(rng: Rng): Drawn {
  const c = drawInverseCurve(rng)
  const drawn = inverseAnswer(c, (traps) => rng.pick(traps))
  // Every trap is a different function from the inverse and from each other.
  const check = inverseCheck(c)
  for (const trap of drawn.answer.stages[0]!.traps) {
    const ys = check.rangeSamples.filter((y) => at(trap.text, y) !== null)
    if (ys.length < 3) throw new LogSkip(`trap ${trap.id} is undefined on the range of f`)
  }
  validate(drawn.answer, drawn.forms, INSTRUCTIONS[drawn.answer.question])
  return drawn
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function generate(templateId: string, salt: number, title: string, draw: (rng: Rng) => Drawn) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const drawn = searchSeed(seed, salt, 64, (rng) => draw(rng))
    return assemble(templateId, seed, knobs, drawn, title)
  }
}

export const featuresTemplate: TemplateDef = {
  id: 'eg.features',
  title: 'Features of the graph',
  description: 'Domain, range, asymptote, an exact intercept, and increasing or decreasing, for a·b^(x − h) + k or a·log_b(x − h) + k.',
  version: VERSION,
  knobs: [],
  generate: generate('eg.features', 41, 'Features of an exponential or log graph', drawFeatures),
}

export const matchTemplate: TemplateDef = {
  id: 'eg.match',
  title: 'Match the graph',
  description: 'Four graphs, or four equations, that differ by the sign of a, the base above or below 1, and the direction of a shift.',
  version: VERSION,
  knobs: [],
  generate: generate('eg.match', 42, 'Match an exponential or log graph', drawMatch),
}

export const inverseTemplate: TemplateDef = {
  id: 'eg.inverse',
  title: 'Inverse of an exponential or log',
  description: 'f⁻¹ of a shifted exponential is a log, and of a shifted log an exponential, checked by composing it with f.',
  version: VERSION,
  knobs: [],
  generate: generate('eg.inverse', 43, 'Find the inverse function', drawInverse),
}

export const EG_TEMPLATES = [featuresTemplate, matchTemplate, inverseTemplate] as const

/** Grade her entry for one part of a graphs problem. */
export function gradeEgPart(answer: ExpLogGraphsAnswer, stageId: string, text: string): PartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeExpLogPart(part, text, part.kind === 'formula' ? inverseCheck(curveOf(answer)) : undefined)
}

/** What she typed, part by part, for the tutor. */
export { partsWork as egWork } from '../explog/parts'

/** The curve's reading text, for sentences elsewhere. */
export { curveSay }
