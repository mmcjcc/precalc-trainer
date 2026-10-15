/**
 * Seeded complex-number problems. Each one is built from small integer parts so the answer is exact.
 * The build checks its own answers and its promised trap before the problem is returned.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import { problemId } from '@/content/registry'
import type { AnswerSpec, ComplexNumsQuestion, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { Unsupported } from '@/engine/functions/exact'
import { polyDivmod, polyIsZero, polyMul, polyToText, type Poly } from '@/engine/functions/poly'
import type { CalcPanels } from '@/shared/types'
import { rat, ratDiv, ratNeg } from '@/notation'
import {
  CxSkip,
  cx,
  cxAdd,
  cxConj,
  cxDiv,
  cxIPower,
  cxIsZero,
  cxMul,
  cxSqrt,
  cxSub,
  formatCx,
  formatPair,
  show,
  showCx,
  splitSquare,
  type Cx,
} from './arith'
import { parseCxAnswer } from './parse'
import {
  expectedText,
  gradeModel,
  trapsFor,
  type CxModel,
  type CxOp,
  type CxPowerKind,
  type CxTrap,
} from './grade'
import { CX_RULE_FOR, CX_RULE_IDS } from './rules'

export const CX_MODULE_ID = 'complexNums' as const

export type ComplexNumsAnswer = Extract<AnswerSpec, { type: 'complexNums' }>

export const CX_KEYS = { answer: 'answer' } as const

const NO_GRAPH = { kind: 'none' as const }
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

const PROMPT: Record<ComplexNumsQuestion, string> = {
  arith: 'Simplify.',
  divide: 'Simplify.',
  powers: 'Simplify.',
  quadratic: 'Solve the equation.',
  zeros: 'Find all zeros of f.',
}

const INSTRUCTIONS: Record<ComplexNumsQuestion, string> = {
  arith: 'Write the answer in standard form a + bi.',
  divide: 'Write the answer in standard form a + bi.',
  powers: 'Write the answer in standard form a + bi.',
  quadratic: 'Give both solutions, in standard form.',
  zeros: 'Give every zero, in standard form.',
}

const NUDGE: Record<ComplexNumsQuestion, string> = {
  arith: 'Write each number as a + bi. Add or subtract the real parts and the imaginary parts separately. For a product, there are four terms and i² = −1.',
  divide: 'Multiply the top and the bottom by the conjugate of the bottom, so the bottom becomes a real number, then write a + bi.',
  powers: 'Powers of i repeat every four: i, −1, −i, 1. A square root of a negative is i times a real square root, and i² = −1.',
  quadratic: 'Use the quadratic formula. When b² − 4ac is negative, the square root is imaginary.',
  zeros: 'A polynomial with real coefficients has conjugate zeros in pairs. Divide out the quadratic factor from that pair, then find the rest.',
}

const STAGE_CARD: Record<ComplexNumsQuestion, string> = {
  arith: CX_RULE_IDS.iSquared,
  divide: CX_RULE_IDS.conjugate,
  powers: CX_RULE_IDS.cycle,
  quadratic: CX_RULE_IDS.discriminant,
  zeros: CX_RULE_IDS.pair,
}

const TITLE: Record<ComplexNumsQuestion, string> = {
  arith: 'Add, subtract or multiply',
  divide: 'Divide complex numbers',
  powers: 'Powers of i and square roots',
  quadratic: 'Quadratic with complex roots',
  zeros: 'Zeros from a complex zero',
}

function gaussian(rng: Rng, imagNonzero: boolean): Cx {
  const re = rng.int(-6, 6)
  const im = imagNonzero ? rng.intExcept(-6, 6, [0]) : rng.int(-6, 6)
  if (re === 0 && im === 0) return gaussian(rng, imagNonzero)
  return cx(re, im)
}

function formatBinom(z: Cx): string {
  return `(${formatCx(z)})`
}

function arithExpr(z1: Cx, z2: Cx, op: CxOp): string {
  if (op === '*') return `${formatBinom(z1)}${formatBinom(z2)}`
  const join = op === '+' ? ' + ' : ' - '
  return `${formatBinom(z1)}${join}${formatBinom(z2)}`
}

function evalArith(z1: Cx, z2: Cx, op: CxOp): Cx {
  if (op === '+') return cxAdd(z1, z2)
  if (op === '-') return cxSub(z1, z2)
  return cxMul(z1, z2)
}

function explainArith(z1: Cx, z2: Cx, op: CxOp, ans: Cx): string[] {
  const e = arithExpr(z1, z2, op)
  if (op === '+' || op === '-') {
    const verb = op === '+' ? 'Add' : 'Subtract'
    return [
      `${show(e)}.`,
      `${verb} the real parts and the imaginary parts: ${showCx(ans)}.`,
    ]
  }
  const ac = z1.re.n * z2.re.n
  const ad = z1.re.n * z2.im.n
  const bc = z1.im.n * z2.re.n
  const bd = z1.im.n * z2.im.n
  return [
    `${show(e)} = (${showCx(z1).replace(/[()]/g, '')})(${showCx(z2).replace(/[()]/g, '')}).`,
    `First ${z1.re.n}·${z2.re.n} = ${ac}, outer ${z1.re.n}·(${z2.im.n}i) = ${ad}i, inner (${z1.im.n}i)·${z2.re.n} = ${bc}i, last (${z1.im.n}i)(${z2.im.n}i) = ${bd}i².`,
    `i² = −1, so ${bd}i² = ${-bd}. Combining gives ${showCx(ans)}.`,
  ]
}

function explainDivide(z1: Cx, z2: Cx, ans: Cx): string[] {
  const conj = cxConj(z2)
  const num = cxMul(z1, conj)
  const den = cxMul(z2, conj)
  return [
    `${show(formatBinom(z1))}/${show(formatBinom(z2))}. Multiply top and bottom by ${showCx(conj)}.`,
    `The numerator is ${showCx(num)}. The denominator is ${showCx(den)}.`,
    `So the quotient is ${showCx(ans)}.`,
  ]
}

function explainPower(p: CxModel): string[] {
  if (p.powerKind === 'power' && p.powerN !== undefined) {
    const n = p.powerN
    const r = ((n % 4) + 4) % 4
    const names = ['1', 'i', '−1', '−i']
    if (n < 0) {
      return [
        `i^(${n}) = 1/i^(${-n}). ${-n} = 4·${Math.floor(-n / 4)} + ${((-n % 4) + 4) % 4}, so i^(${-n}) = ${names[((-n % 4) + 4) % 4]}.`,
        `The reciprocal is ${showCx(p.values[0]!)}.`,
      ]
    }
    return [
      `${n} = 4·${Math.floor(n / 4)} + ${r}, so i^${n} = i^${r} = ${names[r]}.`,
      `The value is ${showCx(p.values[0]!)}.`,
    ]
  }
  if (p.powerKind === 'sqrt' && p.radicand !== undefined) {
    const sp = splitSquare(p.radicand)
    return [
      `√(−${p.radicand}) = i√${p.radicand}.`,
      `${p.radicand} = ${sp.coeff}² · ${sp.rad}, so √${p.radicand} = ${sp.coeff}${sp.rad === 1 ? '' : `√${sp.rad}`}.`,
      `The value is ${showCx(p.values[0]!)}.`,
    ]
  }
  if (p.powerKind === 'product' && p.radicand !== undefined && p.radicandB !== undefined) {
    return [
      `√(−${p.radicand}) · √(−${p.radicandB}) = (i√${p.radicand})(i√${p.radicandB}) = i² √${p.radicand * p.radicandB}.`,
      `i² = −1, so the product is ${showCx(p.values[0]!)}.`,
    ]
  }
  return [`The value is ${show(formatPair(p.values))}.`]
}

function explainQuadratic(p: CxModel): string[] {
  const a = p.quadA!
  const b = p.quadB!
  const c = p.quadC!
  const d = b * b - 4 * a * c
  const k = Math.round(Math.sqrt(-d))
  return [
    `${show(p.expression)}. a = ${a}, b = ${b}, c = ${c}.`,
    `The discriminant is ${b}² − 4·${a}·${c} = ${d} = −${-d}.`,
    `√(${d}) = ${k}i. Then x = (${-b} ± ${k}i)/(${2 * a}) = ${show(formatPair(p.values))}.`,
  ]
}

function explainZeros(p: CxModel): string[] {
  const given = p.given!
  const conj = cxConj(given)
  const a = given.re.n
  const b = given.im.n
  const quad = `x^2 - ${2 * a}x + ${a * a + b * b}`
  return [
    `f(x) = ${show(p.f)}. One zero is ${show(p.givenZero)}, so ${showCx(conj)} is a zero too.`,
    `The quadratic factor is (x − (${showCx(given)}))(x − (${showCx(conj)})) = ${show(quad)}.`,
    `Dividing f by that quadratic leaves the remaining zeros ${p.reals!.map((z) => showCx(z)).join(', ')}.`,
    `The zeros are ${show(formatPair(p.values))}.`,
  ]
}

function explain(p: CxModel): string[] {
  if (p.kind === 'arith' && p.z1 && p.z2 && p.op) return explainArith(p.z1, p.z2, p.op, p.values[0]!)
  if (p.kind === 'divide' && p.z1 && p.z2) return explainDivide(p.z1, p.z2, p.values[0]!)
  if (p.kind === 'powers') return explainPower(p)
  if (p.kind === 'quadratic') return explainQuadratic(p)
  return explainZeros(p)
}

function drawArith(rng: Rng): CxModel {
  const op: CxOp = rng.pick(['+', '-', '*', '*', '*'])
  const z1 = gaussian(rng, op === '*')
  const z2 = gaussian(rng, op === '*')
  if (op === '*' && (z1.im.n === 0 || z2.im.n === 0)) throw new CxSkip('product needs two imaginary parts')
  if (op === '*' && z1.im.n * z2.im.n === 0) throw new CxSkip('i² slip needs bd ≠ 0')
  const ans = evalArith(z1, z2, op)
  const expression = arithExpr(z1, z2, op)
  return {
    kind: 'arith',
    values: [ans],
    expression,
    f: '',
    givenZero: '',
    op,
    z1,
    z2,
  }
}

function drawDivide(rng: Rng): CxModel {
  const z1 = gaussian(rng, true)
  const z2 = gaussian(rng, true)
  if (cxIsZero(z2) || z2.im.n === 0) throw new CxSkip('denominator should not be real')
  const ans = cxDiv(z1, z2)
  if (ans.re.d > 25 || ans.im.d > 25) throw new CxSkip('denominator too large')
  const expression = `${formatBinom(z1)}/${formatBinom(z2)}`
  return {
    kind: 'divide',
    values: [ans],
    expression,
    f: '',
    givenZero: '',
    z1,
    z2,
  }
}

const SQRT_KS = [2, 3, 7, 8, 12, 18, 20, 27, 32, 48, 50, 72, 75, 4, 9, 16, 36]
const PRODUCT_PAIRS: readonly [number, number][] = [
  [4, 9],
  [4, 16],
  [9, 16],
  [4, 36],
  [8, 18],
  [12, 3],
  [8, 2],
  [12, 12],
  [18, 8],
  [20, 5],
  [32, 2],
  [50, 8],
]

function drawPowers(rng: Rng): CxModel {
  const kind: CxPowerKind = rng.pick(['power', 'power', 'sqrt', 'product'])
  if (kind === 'power') {
    const negative = rng.chance(0.25)
    const n = negative ? -rng.int(1, 12) : rng.int(0, 31)
    if (n === 1 || n === 0) {
      // i^0 and i^1 still teach the cycle; keep some
    }
    const ans = cxIPower(n)
    const expression = n < 0 ? `i^(${n})` : `i^${n}`
    return {
      kind: 'powers',
      values: [ans],
      expression,
      f: '',
      givenZero: '',
      powerN: n,
      powerKind: 'power',
    }
  }
  if (kind === 'sqrt') {
    const k = rng.pick(SQRT_KS)
    const ans = cxSqrt(cx(-k))
    return {
      kind: 'powers',
      values: [ans],
      expression: `sqrt(-${k})`,
      f: '',
      givenZero: '',
      powerKind: 'sqrt',
      radicand: k,
    }
  }
  const pair = rng.pick(PRODUCT_PAIRS)
  const ans = cxMul(cxSqrt(cx(-pair[0])), cxSqrt(cx(-pair[1])))
  return {
    kind: 'powers',
    values: [ans],
    expression: `sqrt(-${pair[0]}) * sqrt(-${pair[1]})`,
    f: '',
    givenZero: '',
    powerKind: 'product',
    radicand: pair[0],
    radicandB: pair[1],
  }
}

function drawQuadratic(rng: Rng): CxModel {
  const a = rng.pick([1, 1, 1, 2])
  const b = rng.intExcept(-8, 8, [0])
  const k = rng.int(1, 8)
  const fourA = 4 * a
  const discAbs = k * k
  // D = b² − 4ac = −k²  ⇒  4ac = b² + k²  ⇒  c = (b² + k²)/(4a)
  if ((b * b + discAbs) % fourA !== 0) throw new CxSkip('c not integer')
  const c = (b * b + discAbs) / fourA
  if (c === 0) throw new CxSkip('c is 0')
  const twoA = 2 * a
  const re = ratDiv(ratNeg(rat(b)), rat(twoA))
  const im = ratDiv(rat(k), rat(twoA))
  const z1 = cx(re, im)
  const z2 = cx(re, ratNeg(im))
  const ax = a === 1 ? 'x^2' : `${a}x^2`
  const bx = b === 1 ? ' + x' : b === -1 ? ' - x' : b > 0 ? ` + ${b}x` : ` - ${-b}x`
  const cxTerm = c > 0 ? ` + ${c}` : ` - ${-c}`
  const expression = `${ax}${bx}${cxTerm} = 0`
  return {
    kind: 'quadratic',
    values: [z1, z2],
    expression,
    f: '',
    givenZero: '',
    quadA: a,
    quadB: b,
    quadC: c,
  }
}

function polyOf(coeffsHighToLow: number[]): Poly {
  const lowToHigh = coeffsHighToLow.slice().reverse().map((n) => rat(n))
  let end = lowToHigh.length
  while (end > 0 && lowToHigh[end - 1]!.n === 0) end--
  return lowToHigh.slice(0, end)
}

function drawZeros(rng: Rng): CxModel {
  const a = rng.intExcept(-4, 4, [0])
  const b = rng.intExcept(-5, 5, [0])
  const given = cx(a, b)
  const quad = polyOf([1, -2 * a, a * a + b * b])
  const nReals = rng.chance(0.3) ? 2 : 1
  const reals: Cx[] = []
  const used = new Set<number>([a])
  let linear: Poly = [rat(1)]
  for (let i = 0; i < nReals; i++) {
    const r = rng.intExcept(-5, 5, [...used, 0])
    used.add(r)
    reals.push(cx(r, 0))
    linear = polyMul(linear, polyOf([1, -r]))
  }
  const fPoly = polyMul(linear, quad)
  const { q, r } = polyDivmod(fPoly, quad)
  if (!polyIsZero(r)) throw new CxSkip('quadratic did not divide')
  if (polyIsZero(q)) throw new CxSkip('zero quotient')
  const f = polyToText(fPoly)
  const values = [...reals, given, cxConj(given)]
  return {
    kind: 'zeros',
    values,
    expression: '',
    f,
    givenZero: formatCx(given),
    given,
    reals,
  }
}

function drawFor(question: ComplexNumsQuestion, rng: Rng): CxModel {
  if (question === 'arith') return drawArith(rng)
  if (question === 'divide') return drawDivide(rng)
  if (question === 'powers') return drawPowers(rng)
  if (question === 'quadratic') return drawQuadratic(rng)
  return drawZeros(rng)
}

export function canonicalEntries(answer: ComplexNumsAnswer): Record<string, string> {
  return { [CX_KEYS.answer]: answer.expectedDisplay }
}

export function cxWork(_answer: ComplexNumsAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const text = entries[CX_KEYS.answer]
  if (text?.trim()) return [text.trim()]
  return []
}

export function modelOf(answer: ComplexNumsAnswer): CxModel {
  const values = parseExpected(answer.expectedDisplay, answer.question)
  const model: CxModel = {
    kind: answer.question,
    values,
    expression: answer.expression,
    f: answer.f,
    givenZero: answer.givenZero,
  }
  fillModel(model, answer)
  return model
}

export function gradeCxStage(answer: ComplexNumsAnswer, _stage: 'answer', text: string) {
  return gradeModel(modelOf(answer), text)
}

function assertSelf(where: string, answer: ComplexNumsAnswer, model: CxModel): void {
  const g = gradeModel(model, expectedText(model))
  if (g.verdict !== 'correct') throw new Error(`${where}: the canonical answer does not grade correct (${g.verdict})`)
  const trap = gradeModel(model, answer.trapAnswer)
  if (trap.verdict !== 'mistake' || trap.mistake !== answer.trap) {
    throw new Error(`${where}: trap ${answer.trap} graded ${trap.verdict}${trap.verdict === 'mistake' ? ` ${trap.mistake}` : ''}`)
  }
  const live = trapsFor(model)
  if (!live.some((t) => t.id === answer.trap && t.text === answer.trapAnswer)) {
    throw new Error(`${where}: promised trap ${answer.trap} is not a candidate`)
  }
}

function assemble(
  question: ComplexNumsQuestion,
  templateId: string,
  version: number,
  seed: number,
  knobs: DifficultyKnobs,
  model: CxModel,
  rng: Rng,
): ProblemInstance {
  const pool = trapsFor(model)
  if (pool.length === 0) throw new CxSkip('no trap')
  const trap: CxTrap = rng.pick(pool)
  const primary = CX_RULE_FOR[trap.id]
  const reveal = explain(model)
  const expectedDisplay = expectedText(model)
  const answer: ComplexNumsAnswer = {
    type: 'complexNums',
    question,
    expression: model.expression,
    f: model.f,
    givenZero: model.givenZero,
    prompt: PROMPT[question],
    stages: [
      {
        id: 'answer',
        nudge: NUDGE[question],
        ruleCard: primary,
        reveal: [...reveal],
      },
    ],
    expectedDisplay,
    nudge: NUDGE[question],
    ruleCard: primary,
    ruleCards: [primary, STAGE_CARD[question]].filter((id, i, all) => all.indexOf(id) === i),
    reveal,
    trap: trap.id,
    trapStage: 'answer',
    trapAnswer: trap.text,
  }
  assertSelf(`${templateId}/${seed}`, answer, model)
  const statementText =
    question === 'zeros' ? `f(x) = ${model.f}` : question === 'quadratic' ? model.expression : model.expression
  return {
    id: problemId(CX_MODULE_ID, templateId, version, seed),
    moduleId: CX_MODULE_ID,
    templateId,
    skill: templateId,
    genVersion: version,
    seed: seed >>> 0,
    knobs,
    kind: 'complexNums',
    title: TITLE[question],
    instructions: INSTRUCTIONS[question],
    statementText,
    vars: question === 'quadratic' || question === 'zeros' ? ['x'] : ['x'],
    start: null,
    canonical: [],
    answer,
    graph: NO_GRAPH,
    calc: NO_CALC,
    params: {
      question,
      trap: answer.trap,
      op: model.op ?? '',
      powerKind: model.powerKind ?? '',
      powerN: model.powerN ?? 0,
      expression: model.expression,
      f: model.f,
      givenZero: model.givenZero,
      expected: expectedDisplay,
      trapAnswer: trap.text,
      z1: model.z1 ? formatCx(model.z1) : '',
      z2: model.z2 ? formatCx(model.z2) : '',
      radicand: model.radicand ?? 0,
      radicandB: model.radicandB ?? 0,
      quadA: model.quadA ?? 0,
      quadB: model.quadB ?? 0,
      quadC: model.quadC ?? 0,
      givenRe: model.given?.re.n ?? 0,
      givenIm: model.given?.im.n ?? 0,
      realCount: model.reals?.length ?? 0,
    },
  }
}

function mustOne(text: string): Cx {
  const p = parseCxAnswer(text)
  if (!p.ok || p.values.length !== 1) throw new Error(`expected one complex, got ${text}`)
  return p.values[0]!
}

function parseExpected(text: string, question: ComplexNumsQuestion): Cx[] {
  const p = parseCxAnswer(text)
  if (!p.ok) throw new Error(`canonical ${question} answer did not parse: ${p.message} (${text})`)
  return p.values
}

function generateQuestion(question: ComplexNumsQuestion, templateId: string, version: number, salt: number) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    const rng = makeRng(mixSeed(seed, salt))
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        return assemble(question, templateId, version, seed, knobs, drawFor(question, rng), rng)
      } catch (e) {
        if (e instanceof CxSkip || e instanceof Unsupported || e instanceof RangeError) continue
        throw e
      }
    }
    throw new Error(`${templateId}: no problem passed the filters in 80 draws (seed ${seed})`)
  }
}

export const arithTemplate: TemplateDef = {
  id: 'cx.arith',
  title: 'Add, subtract or multiply',
  description: 'Add, subtract or multiply two complex numbers and write the answer in standard form a + bi.',
  version: 1,
  knobs: [],
  generate: generateQuestion('arith', 'cx.arith', 1, 71),
}

export const divideTemplate: TemplateDef = {
  id: 'cx.divide',
  title: 'Divide complex numbers',
  description: 'Divide by a complex number and write the answer in standard form a + bi.',
  version: 1,
  knobs: [],
  generate: generateQuestion('divide', 'cx.divide', 1, 72),
}

export const powersTemplate: TemplateDef = {
  id: 'cx.powers',
  title: 'Powers of i and square roots',
  description: 'Simplify a power of i or a square root of a negative number.',
  version: 1,
  knobs: [],
  generate: generateQuestion('powers', 'cx.powers', 1, 73),
}

export const quadraticTemplate: TemplateDef = {
  id: 'cx.quadratic',
  title: 'Quadratic with complex roots',
  description: 'Solve a quadratic equation whose discriminant is negative.',
  version: 1,
  knobs: [],
  generate: generateQuestion('quadratic', 'cx.quadratic', 1, 74),
}

export const zerosTemplate: TemplateDef = {
  id: 'cx.zeros',
  title: 'Zeros from a complex zero',
  description: 'A polynomial with real coefficients and one given complex zero: find all zeros.',
  version: 1,
  knobs: [],
  generate: generateQuestion('zeros', 'cx.zeros', 1, 75),
}

export const CX_TEMPLATES = [arithTemplate, divideTemplate, powersTemplate, quadraticTemplate, zerosTemplate] as const

function fillModel(model: CxModel, answer: ComplexNumsAnswer): void {
  if (model.kind === 'zeros') {
    model.given = mustOne(answer.givenZero)
    model.reals = model.values.filter((z) => z.im.n === 0)
    return
  }
  if (model.kind === 'quadratic') {
    const m = answer.expression.replace(/\s+/g, '').match(/^(-?\d*)x\^2(?:([+-]\d*)x)?([+-]\d+)=0$/)
    if (m) {
      model.quadA = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
      model.quadB = m[2] === undefined ? 0 : m[2] === '+' || m[2] === '' ? 1 : m[2] === '-' ? -1 : Number(m[2])
      model.quadC = Number(m[3])
    }
    return
  }
  if (model.kind === 'powers') {
    const pow = answer.expression.match(/^i\^\(?(-?\d+)\)?$/)
    if (pow) {
      model.powerKind = 'power'
      model.powerN = Number(pow[1])
      return
    }
    const prod = answer.expression.match(/^sqrt\(-(\d+)\) \* sqrt\(-(\d+)\)$/)
    if (prod) {
      model.powerKind = 'product'
      model.radicand = Number(prod[1])
      model.radicandB = Number(prod[2])
      return
    }
    const sq = answer.expression.match(/^sqrt\(-(\d+)\)$/)
    if (sq) {
      model.powerKind = 'sqrt'
      model.radicand = Number(sq[1])
    }
    return
  }
  if (model.kind === 'arith' || model.kind === 'divide') {
    parseTwo(model, answer.expression, model.kind === 'divide')
  }
}

function parseTwo(model: CxModel, expression: string, divide: boolean): void {
  if (divide) {
    const slash = splitTop(expression, '/')
    if (slash) {
      model.z1 = mustOne(slash[0])
      model.z2 = mustOne(slash[1])
    }
    return
  }
  const product = expression.match(/^\((.+)\)\((.+)\)$/)
  if (product) {
    model.op = '*'
    model.z1 = mustOne(product[1]!)
    model.z2 = mustOne(product[2]!)
    return
  }
  const plus = splitTop(expression, ' + ')
  if (plus) {
    model.op = '+'
    model.z1 = mustOne(plus[0])
    model.z2 = mustOne(plus[1])
    return
  }
  const minus = splitTop(expression, ' - ')
  if (minus) {
    model.op = '-'
    model.z1 = mustOne(minus[0])
    model.z2 = mustOne(minus[1])
  }
}

function splitTop(text: string, sep: string): [string, string] | null {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && text.slice(i, i + sep.length) === sep && i > 0) {
      return [text.slice(0, i), text.slice(i + sep.length)]
    }
  }
  return null
}
