/**
 * The unit circle and the trig functions of any angle (precalculus Unit 4), drawn from the seed: the function, the
 * angle (a multiple of 30° or 45°, in degrees or radians, in any quadrant, on an axis, negative or past a turn), and
 * the point on the terminal side (from Euclid's formula for whole-number distances, or small coordinates that leave a
 * radical). Values and slips come from the trig core; every problem passes `assertTrigProblem` before it is shown.
 * The second half adds uc.given (given.ts) and uc.solve (solve.ts), assembled and checked here the same way.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef, TrigPart, TrigPartTrap, UnitCircleAnswer } from '@/content/types'
import {
  angleSay,
  angleTex,
  coterminalDeg,
  degText,
  exactAscii,
  exactNum,
  exactRational,
  exactSay,
  exactTex,
  exactText,
  fnTex,
  gcd,
  placeOf,
  placeWords,
  pointR,
  pointSlips,
  pointValue,
  q,
  qNum,
  qText,
  radiansOf,
  referenceDeg,
  rSlips,
  trigValue,
  turnsTo,
  unitPoint,
  valueSlips,
  valueTex,
  valueText,
  type AngleUnit,
  type Q,
  type TrigFn,
  type TrigSlip,
  type TrigValue,
} from '@/engine/trig'
import { LogSkip } from '../explog/text'
import { pointCalc, valueCalc } from '../trig/calc'
import { circleFigure, pointFigure } from '../trig/figure'
import { assertTrigProblem } from '../trig/parts'
import { m, minus, plain, showsNumber, trigSearch } from '../trig/text'
import type { UcDrafted } from './drafted'
import { drawGiven } from './given'
import { R_HINT, UC_HINTS, VALUE_HINT } from './hints'
import { UC_RULES, UC_RULE_IDS } from './rules'
import { drawSolve } from './solve'

export const UC_MODULE_ID = 'unitCircle' as const
const VERSION = 1

export { GIVEN_VALUE_HINT, LIST_DEG_HINT, LIST_RAD_HINT, R_HINT, UC_HINTS, VALUE_HINT } from './hints'

export const UC_INSTRUCTIONS: Record<UnitCircleAnswer['question'], string> = {
  exact: 'Give the exact value.',
  point: 'One part at a time: r first, then each function, exactly.',
  given: 'One part at a time: the missing number first, then each function, exactly.',
  solve: 'Give every angle in the range, in the unit asked, separated by commas.',
}

const TITLES: Record<UnitCircleAnswer['question'], string> = {
  exact: 'Exact values on the unit circle',
  point: 'A point on the terminal side',
  given: 'One value and the quadrant',
  solve: 'Every angle in one turn',
}

const FN_ORDER: readonly TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']

type Drafted = UcDrafted

/** Every spelling of an exact value that grades right: glyphs, keyboard, sentence, and a decimal that ends. */
export function valueForms(v: TrigValue): string[] {
  if (v === 'undefined') return ['undefined']
  const forms = [exactText(v), exactAscii(v), exactSay(v)]
  const r = exactRational(v)
  if (r && r.d !== 1) {
    let d = r.d
    while (d % 2 === 0) d /= 2
    while (d % 5 === 0) d /= 5
    if (d === 1) forms.push(String(r.n / r.d))
  }
  return [...new Set(forms)]
}

function traps(slips: readonly TrigSlip[]): TrigPartTrap[] {
  return slips.map((s) => ({ id: s.id, text: valueText(s.value), witness: s.witness }))
}

const fnCall = (fn: TrigFn, arg: string) => `${fnTex(fn)}\\left(${arg}\\right)`

// ---------------------------------------------------------------------------
// uc.exact
// ---------------------------------------------------------------------------

const RECIPROCAL: Partial<Record<TrigFn, TrigFn>> = { csc: 'sin', sec: 'cos', cot: 'tan' }

/** The worked lines: one turn, the quadrant and reference angle (or the point on the axis), the size, the sign. */
function exactReveal(fn: TrigFn, deg: Q, unit: AngleUnit, v: TrigValue): string[] {
  const at = (d: Q) => angleTex({ deg: d, unit })
  const lines: string[] = []
  const c = coterminalDeg(deg)
  const t = turnsTo(deg)
  if (t !== 0) {
    const turn = unit === 'deg' ? '360^{\\circ}' : '2\\pi'
    lines.push(`${m(`${at(deg)} ${t > 0 ? '+' : '-'} ${Math.abs(t) === 1 ? '' : `${Math.abs(t)} \\cdot `}${turn} = ${at(c)}`)}: the same terminal side, so the same value.`)
  }
  const place = placeOf(deg)
  const p = unitPoint(deg)!
  if (place.kind === 'axis') {
    lines.push(`${m(at(c))} lies on ${placeWords(place)}: the point on the unit circle is ${m(`(${exactTex(p.x)}, ${exactTex(p.y)})`)}.`)
    const parts: Record<TrigFn, [string, string, string]> = {
      sin: ['\\frac{y}{1}', exactTex(p.y), '1'],
      cos: ['\\frac{x}{1}', exactTex(p.x), '1'],
      tan: ['\\frac{y}{x}', exactTex(p.y), exactTex(p.x)],
      csc: ['\\frac{1}{y}', '1', exactTex(p.y)],
      sec: ['\\frac{1}{x}', '1', exactTex(p.x)],
      cot: ['\\frac{x}{y}', exactTex(p.x), exactTex(p.y)],
    }
    const [form, top, bottom] = parts[fn]
    if (v === 'undefined') lines.push(`${m(`${fnCall(fn, at(deg))} = ${form} = \\frac{${top}}{${bottom}}`)}: the bottom is zero, so the value is undefined.`)
    else lines.push(`${m(`${fnCall(fn, at(deg))} = ${form} = \\frac{${top}}{${bottom}} = ${valueTex(v)}`)}.`)
    return lines
  }
  const ref = referenceDeg(deg)!
  lines.push(`${m(at(c))} is in ${placeWords(place)}; its reference angle is ${m(at(ref))}.`)
  const base = RECIPROCAL[fn]
  const size = trigValue(fn, ref)!
  if (base) {
    const inner = trigValue(base, ref)!
    lines.push(`${m(`${fnCall(base, at(ref))} = ${valueTex(inner)}`)}, so ${m(`${fnCall(fn, at(ref))} = \\frac{1}{${valueTex(inner)}} = ${valueTex(size)}`)}.`)
  } else {
    lines.push(`From the special triangle, ${m(`${fnCall(fn, at(ref))} = ${valueTex(size)}`)}.`)
  }
  const positive = v !== 'undefined' && exactNum(v) > 0
  lines.push(`In ${placeWords(place)}, ${fn} is ${positive ? 'positive' : 'negative'}, so ${m(`${fnCall(fn, at(deg))} = ${valueTex(v)}`)}.`)
  return lines
}

/** The exact-value problem for this function and angle (exported for the hand-worked tests). */
export function exactProblem(o: { fn: TrigFn; deg: Q; unit: AngleUnit }): Drafted {
  const { fn, deg, unit } = o
  const v = trigValue(fn, deg)
  if (!v) throw new Error(`no exact value of ${fn} at ${qText(deg)}°`)
  const call = m(fnCall(fn, angleTex({ deg, unit })))
  const place = placeOf(deg)
  const answerText = valueText(v)
  const ref = referenceDeg(deg)
  const part: TrigPart = {
    id: 'answer',
    kind: 'value',
    label: 'Exact value',
    ask: `What is ${call}? Give the exact value.`,
    formatHint: VALUE_HINT,
    nudge:
      place.kind === 'axis'
        ? 'The terminal side is on an axis. Find the point on the unit circle there: its x-coordinate is cos and its y-coordinate is sin.'
        : `Find the reference angle and the quadrant: the special triangle gives the size, and the quadrant gives the sign.${RECIPROCAL[fn] ? ` Then turn ${RECIPROCAL[fn]} upside down.` : ''}`,
    ruleCard: place.kind === 'axis' ? UC_RULE_IDS.axes : RECIPROCAL[fn] ? UC_RULE_IDS.reciprocal : UC_RULE_IDS.special,
    reveal: exactReveal(fn, deg, unit, v),
    answerText,
    forms: valueForms(v),
    check: { kind: 'value', value: answerText, fn },
    wrongNote: place.kind === 'axis' ? 'That is not the value. Find the point on the unit circle at this angle, then the ratio.' : 'That is not the value. Find the value for the reference angle, then give it the sign of the quadrant.',
    traps: traps(valueSlips(fn, deg, unit)),
  }
  const angleWords = angleSay({ deg, unit })
  return {
    question: 'exact',
    prompt: `Find the exact value of ${call}.`,
    figure: circleFigure(qNum(deg), angleWords, ref ? { deg: qNum(ref), label: angleSay({ deg: ref, unit }) } : undefined),
    stages: [part],
    promisable: part.traps,
    calc: valueCalc(fn, unit === 'deg' ? degText(deg) : exactText(radiansOf(deg)), unit, v === 'undefined' ? null : exactNum(v)),
    calcExpr: `${fn}(${unit === 'deg' ? `${degText(deg)}°` : exactText(radiansOf(deg))})`,
    ruleCards: [UC_RULE_IDS.special, UC_RULE_IDS.signs, UC_RULE_IDS.unitCircle, UC_RULE_IDS.reciprocal, UC_RULE_IDS.axes],
  }
}

function drawExact(rng: Rng): Drafted {
  const roll = rng.int(0, 99)
  const fn: TrigFn = roll < 20 ? 'sin' : roll < 40 ? 'cos' : roll < 60 ? 'tan' : roll < 73 ? 'csc' : roll < 86 ? 'sec' : 'cot'
  const unit: AngleUnit = rng.chance(0.5) ? 'deg' : 'rad'
  let c: number
  if (rng.chance(0.12)) c = 90 * rng.int(0, 3)
  else {
    // A multiple of 15° in one turn that is a multiple of 30° or of 45° and not on an axis: the twelve special
    // angles off the axes, each as likely as the others.
    do c = 15 * rng.int(1, 23)
    while ((c % 30 !== 0 && c % 45 !== 0) || c % 90 === 0)
  }
  const turns = rng.pick([0, 0, 0, 0, 0, 1, -1] as const)
  const deg = q(c + 360 * turns)
  if (deg.n === 0 && turns === 0 && rng.chance(0.5)) throw new LogSkip('fewer problems at 0°')
  return exactProblem({ fn, deg, unit })
}

// ---------------------------------------------------------------------------
// uc.point
// ---------------------------------------------------------------------------

const FN_RATIO: Record<TrigFn, [string, 'x' | 'y' | 'r', 'x' | 'y' | 'r']> = {
  sin: ['\\frac{y}{r}', 'y', 'r'],
  cos: ['\\frac{x}{r}', 'x', 'r'],
  tan: ['\\frac{y}{x}', 'y', 'x'],
  csc: ['\\frac{r}{y}', 'r', 'y'],
  sec: ['\\frac{r}{x}', 'r', 'x'],
  cot: ['\\frac{x}{y}', 'x', 'y'],
}

/** The point problem for these coordinates and functions (exported for the hand-worked tests). */
export function pointProblem(o: { x: number; y: number; fns: TrigFn[] }): Drafted {
  const { x, y } = o
  const fns = FN_ORDER.filter((f) => o.fns.includes(f))
  const r = pointR(x, y)
  const sum = x * x + y * y
  const rTex = exactTex(r)
  const sq = (n: number) => (n < 0 ? `(${n})^{2}` : `${n}^{2}`)
  const rLine =
    r.root === 1
      ? `${m(`r = \\sqrt{${sq(x)} + ${sq(y)}} = \\sqrt{${x * x} + ${y * y}} = \\sqrt{${sum}} = ${rTex}`)}.`
      : `${m(`r = \\sqrt{${sq(x)} + ${sq(y)}} = \\sqrt{${x * x} + ${y * y}} = \\sqrt{${sum}}${exactTex(r) === `\\sqrt{${sum}}` ? '' : ` = ${rTex}`}`)}.`
  const rPart: TrigPart = {
    id: 'r',
    kind: 'value',
    label: 'r',
    ask: `What is ${m('r')}, the distance from the origin to the point?`,
    formatHint: R_HINT,
    nudge: `${m('r = \\sqrt{x^{2} + y^{2}}')}: square each coordinate, add, and take the square root.`,
    ruleCard: UC_RULE_IDS.point,
    reveal: [rLine],
    answerText: exactText(r),
    forms: valueForms(r),
    check: { kind: 'value', value: exactText(r) },
    wrongNote: 'That is not r. Square each coordinate, add the squares, then take the square root.',
    traps: traps(rSlips(x, y)),
  }
  const coord: Record<'x' | 'y' | 'r', string> = { x: String(x), y: String(y), r: rTex }
  const fnParts = fns.map((fn): TrigPart => {
    const v = pointValue(fn, x, y)
    const [form, top, bottom] = FN_RATIO[fn]
    const raw = `\\frac{${coord[top]}}{${coord[bottom]}}`
    const label = `${fn} θ`
    const needsRationalizing = bottom === 'r' && r.root > 1
    // The last "= value" only when it says something new: 7/25 stays 7/25, but 4/(−3) becomes −4/3.
    const simplified = plain(m(raw)) === plain(m(valueTex(v))) ? '' : ` = ${valueTex(v)}`
    const line = `${m(`${fnTex(fn)}\\theta = ${form} = ${raw}${simplified}`)}${needsRationalizing ? ', with the denominator rationalized' : ''}.`
    const answerText = valueText(v)
    return {
      id: fn,
      kind: 'value',
      label,
      ask: `What is ${m(`${fnTex(fn)}\\theta`)}?`,
      formatHint: VALUE_HINT,
      nudge: `${m(`${fnTex(fn)}\\theta = ${form}`)}. Keep the signs of the coordinates, and rationalize a square root in the denominator.`,
      ruleCard: UC_RULE_IDS.point,
      reveal: [line],
      answerText,
      forms: valueForms(v),
      check: { kind: 'value', value: answerText, fn },
      wrongNote: `That is not ${label}. Use ${fn} θ = ${top}/${bottom} with this point’s numbers.`,
      traps: traps(pointSlips(fn, x, y)),
    }
  })
  const stages = [rPart, ...fnParts]
  const pointTex = `(${x}, ${y})`
  const names = fns.map((f) => m(`${fnTex(f)}\\theta`))
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`
  return {
    question: 'point',
    prompt: `The point ${m(pointTex)} is on the terminal side of an angle ${m('\\theta')} in standard position. Find ${m('r')} and the exact value${names.length > 1 ? 's' : ''} of ${list}.`,
    figure: pointFigure(x, y, minus(pointTex)),
    stages,
    promisable: stages.flatMap((s) => s.traps),
    calc: pointCalc(x, y, exactNum(r)),
    calcExpr: `sqrt((${x})^2 + (${y})^2)`,
    ruleCards: [UC_RULE_IDS.point, UC_RULE_IDS.signs, UC_RULE_IDS.reciprocal],
  }
}

/** A point from the seed: a whole-number distance (Euclid's formula, scaled), or small coordinates that leave a radical. */
function drawPoint(rng: Rng): Drafted {
  let a = 0
  let b = 0
  // Redraws come from the same generator, so the seed decides everything and neither kind is skipped more often.
  if (rng.chance(0.6)) {
    for (let i = 0; i < 200; i++) {
      const mm = rng.int(2, 5)
      const nn = rng.int(1, mm - 1)
      const k = rng.pick([1, 1, 1, 2, 3] as const)
      // A primitive triple (m > n, coprime, one of them even), scaled, no farther than 30 from the origin.
      if (gcd(mm, nn) !== 1 || (mm - nn) % 2 === 0 || (mm * mm + nn * nn) * k > 30) continue
      a = (mm * mm - nn * nn) * k
      b = 2 * mm * nn * k
      break
    }
    if (rng.chance(0.5)) [a, b] = [b, a]
  } else {
    for (let i = 0; i < 200; i++) {
      a = rng.int(1, 9)
      b = rng.int(1, 9)
      // Not a 45° point, and not a whole-number distance (that is the other kind).
      if (a !== b && !Number.isInteger(Math.sqrt(a * a + b * b))) break
    }
  }
  if (!a || !b) throw new LogSkip('no point found')
  const x = rng.chance(0.5) ? -a : a
  const y = rng.chance(0.5) ? -b : b
  const count = rng.pick([1, 2, 2, 3] as const)
  const pool: TrigFn[] = ['sin', 'sin', 'sin', 'cos', 'cos', 'cos', 'tan', 'tan', 'tan', 'csc', 'sec', 'cot']
  const fns = new Set<TrigFn>()
  for (let i = 0; i < 20 && fns.size < count; i++) fns.add(rng.pick(pool))
  return pointProblem({ x, y, fns: [...fns] })
}

// ---------------------------------------------------------------------------
// Assembling and checking
// ---------------------------------------------------------------------------

function finish(d: Drafted, rng: Rng): UnitCircleAnswer {
  const chosen = d.promisable.length ? rng.pick(d.promisable) : null
  const stage = chosen ? d.stages.find((s) => s.traps.includes(chosen)) : undefined
  if (!chosen) throw new LogSkip('no slip to promise')
  const answer: UnitCircleAnswer = {
    type: 'unitCircle',
    question: d.question,
    prompt: d.prompt,
    figure: d.figure,
    stages: d.stages,
    expectedDisplay: d.stages.map((s) => `${s.label}: ${minus(s.answerText)}`).join('; '),
    nudge: d.stages[0]!.nudge,
    ruleCard: d.stages[0]!.ruleCard,
    ruleCards: d.ruleCards,
    reveal: d.stages.flatMap((s) => s.reveal),
    trap: chosen.id,
    trapStage: stage!.id,
    trapAnswer: chosen.text,
  }
  // The second half's templates use its leak matcher: √ and π belong to the number they touch.
  const second = d.question === 'given' || d.question === 'solve'
  assertTrigProblem(answer, UC_INSTRUCTIONS[d.question], UC_RULES, UC_HINTS, second ? showsNumber : undefined)
  return answer
}

function generate(templateId: string, salt: number, draw: (rng: Rng) => Drafted) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    let drafted: Drafted | null = null
    const answer = trigSearch(seed, salt, 96, (rng) => {
      drafted = draw(rng)
      return finish(drafted, rng)
    })
    const d = drafted as unknown as Drafted
    return {
      id: problemId(UC_MODULE_ID, templateId, VERSION, seed),
      moduleId: UC_MODULE_ID,
      templateId,
      skill: templateId,
      genVersion: VERSION,
      seed: seed >>> 0,
      knobs,
      kind: 'unitCircle',
      title: TITLES[answer.question],
      instructions: UC_INSTRUCTIONS[answer.question],
      statementText: plain(answer.prompt),
      vars: [],
      start: null,
      canonical: [],
      answer,
      graph: { kind: 'none', f: d.calcExpr },
      calc: d.calc,
      params: { question: answer.question, trap: answer.trap ?? '', trapStage: answer.trapStage ?? '', answer: answer.stages.map((s) => s.answerText).join(' | ') },
    }
  }
}

export const exactTemplate: TemplateDef = {
  id: 'uc.exact',
  title: 'Exact values on the unit circle',
  description: 'sin, cos, tan, csc, sec or cot of a multiple of 30° or 45°, in degrees or radians, in any quadrant, on an axis, or past a turn.',
  version: VERSION,
  knobs: [],
  generate: generate('uc.exact', 71, drawExact),
}

export const pointTemplate: TemplateDef = {
  id: 'uc.point',
  title: 'A point on the terminal side',
  description: 'r from a point on the terminal side, then one, two or three of the six functions, exactly.',
  version: VERSION,
  knobs: [],
  generate: generate('uc.point', 72, drawPoint),
}

export const givenTemplate: TemplateDef = {
  id: 'uc.given',
  title: 'One value and the quadrant',
  description: 'One function’s value and where θ is (a quadrant, an interval, or another function’s sign): the missing coordinate or r, then other functions, exactly.',
  version: VERSION,
  knobs: [],
  generate: generate('uc.given', 73, drawGiven),
}

export const solveTemplate: TemplateDef = {
  id: 'uc.solve',
  title: 'Every angle in one turn',
  description: 'Every angle in [0°, 360°) or [0, 2π) where sin, cos, tan, csc, sec or cot has a special value, as a list.',
  version: VERSION,
  knobs: [],
  generate: generate('uc.solve', 74, drawSolve),
}

export const UC_TEMPLATES = [exactTemplate, pointTemplate, givenTemplate, solveTemplate] as const

