/**
 * Mapping a point: if (p, q) is on f then (p/b + h, a·q + k) is on g(x) = a·f(b(x − h)) + k.
 *
 * `gradeMappedPoint` reads her "(x, y)" exactly and names a mistake by computing what each mistake would
 * give for this point and comparing exactly: shift direction reversed (p/b − h, or a·q − k), multiplied by b
 * instead of dividing (b·p + h), divided y by a (q/a + k), the unfactored shift (for f(bx − c) she used c
 * instead of c/b), the order of operations (a·(q + k); (p + h)/b), a and b swapped between the coordinates,
 * a reflection applied to the wrong coordinate or left out. When two mistakes give the same point the
 * earlier kind wins and the later ones are listed in `shadows` (templates can avoid such points).
 */
import type { ParseError, Rational } from '@/shared/types'
import { rat, ratAbs, ratAdd, ratCompare, ratDiv, ratMul, ratNeg, ratSub, ratToNumber } from '@/notation/rational'
import { exactEval, surdRational, Unsupported, type ExactValue } from '../functions/exact'
import { parseExpression } from '../parse'
import { hasUnfactoredForm, insideText, mapPoint, specProblem, unfactoredConstant } from './spec'
import { isOne, plusText, pointPretty, pointText, pretty, rf, rp, shiftWords, toPoint } from './text'
import type { ExactPoint, PointLike, PointMistakeCandidate, StatementForm, TransformGrade, TransformMistakeKind, TransformSpec } from './types'

// ---------------------------------------------------------------------------
// Reading her point
// ---------------------------------------------------------------------------

export type PointAnswerParse =
  | {
      ok: true
      /** Each coordinate exactly; null when it is a number outside the rationals (sqrt(2), pi): never correct. */
      x: Rational | null
      y: Rational | null
      xText: string
      yText: string
    }
  | { ok: false; error: ParseError }

function fail(message: string, position: number, length?: number): PointAnswerParse {
  return { ok: false, error: length ? { message, position, length } : { message, position } }
}

function matchingClose(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

const X_LETTER = /(?<![A-Za-z])x(?![A-Za-z])/

/**
 * Her point: "(5, -3)", "5, -3", "( 1/2 , -0.5 )", "(-3/2, 4)". Each coordinate is a number or a constant
 * expression ("7/2", "2.5", "-4/2 + 3"), read exactly (0.1 is 1/10). Errors point into the text.
 */
export function parsePointAnswer(text: string): PointAnswerParse {
  const raw = text ?? ''
  let start = 0
  let end = raw.length
  while (start < end && /\s/.test(raw[start]!)) start++
  while (end > start && /\s/.test(raw[end - 1]!)) end--
  if (start === end) return fail('Type the point first, like (5, -3).', 0)
  if (raw[start] === '(' && raw[end - 1] === ')' && matchingClose(raw, start) === end - 1) {
    start++
    end--
  }
  const commas: number[] = []
  let depth = 0
  for (let i = start; i < end; i++) {
    const c = raw[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth < 0) return fail('There is a ) without a matching (.', i, 1)
    } else if (c === ',' && depth === 0) commas.push(i)
  }
  if (depth > 0) return fail('A closing ) is missing.', end)
  if (!commas.length) {
    const semi = raw.indexOf(';', start)
    const message = 'Write the point as (x, y) with a comma between the coordinates, like (5, -3).'
    return semi >= 0 && semi < end ? fail(message, semi, 1) : fail(message, end)
  }
  if (commas.length > 1) return fail('A point has two coordinates, (x, y): there is an extra comma here.', commas[1]!, 1)
  const spans: [number, number][] = [
    [start, commas[0]!],
    [commas[0]! + 1, end],
  ]
  const values: (Rational | null)[] = []
  const texts: string[] = []
  for (let i = 0; i < 2; i++) {
    const [s0, s1] = spans[i]!
    const part = raw.slice(s0, s1)
    const lead = part.length - part.trimStart().length
    const body = part.trim()
    const which = i === 0 ? 'x' : 'y'
    if (!body) return fail(`The ${which}-coordinate is missing: write the point as (x, y).`, s0)
    const p = parseExpression(body, ['x'])
    if (!p.ok) return { ok: false, error: { ...p.error, position: s0 + lead + p.error.position } }
    const xAt = body.search(X_LETTER)
    if (xAt >= 0) return fail('Each coordinate is a number: work it out so no x is left.', s0 + lead + xAt, 1)
    let v: ExactValue | null
    try {
      v = exactEval(p.node, null)
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e
      v = null
    }
    if (v === 'undef') return fail(`The ${which}-coordinate is undefined as written (a division by 0?).`, s0 + lead, body.length)
    values.push(v === null ? null : surdRational(v))
    texts.push(body)
  }
  return { ok: true, x: values[0]!, y: values[1]!, xText: texts[0]!, yText: texts[1]! }
}

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

interface PtCtx {
  spec: TransformSpec
  form: StatementForm
  p: Rational
  q: Rational
  /** The right image. */
  X: Rational
  Y: Rational
}

/** "4 ÷ 2 + 3" (the x computation with divisor d and shift s), display text. */
function xCalc(p: Rational, d: Rational, s: Rational): string {
  const base = isOne(d) ? rp(p) : `${rp(p)} ÷ ${rf(d)}`
  return plusText(base, s)
}

/** A leading factor: integers bare ("−2"), fractions in parentheses ("(1/2)"). */
function lead(r: Rational): string {
  return r.d === 1 ? rp(r) : `(${rp(r)})`
}

/** "−2·1 + 1" (the y computation with factor m and shift s), display text. */
function yCalc(q: Rational, m: Rational, s: Rational): string {
  const base = isOne(m) ? rp(q) : `${lead(m)}·${rf(q)}`
  return plusText(base, s)
}

function xRule(spec: TransformSpec): string {
  const parts: string[] = []
  if (!isOne(spec.b)) parts.push(`divide by ${rp(spec.b)}`)
  if (spec.h.n !== 0) parts.push(spec.h.n > 0 ? `add ${rp(spec.h)}` : `subtract ${rp(ratAbs(spec.h))}`)
  return parts.length ? parts.join(', then ') : 'keep it'
}

function yRule(spec: TransformSpec): string {
  const parts: string[] = []
  if (!isOne(spec.a)) parts.push(`multiply by ${rp(spec.a)}`)
  if (spec.k.n !== 0) parts.push(spec.k.n > 0 ? `add ${rp(spec.k)}` : `subtract ${rp(ratAbs(spec.k))}`)
  return parts.length ? parts.join(', then ') : 'keep it'
}

/** ": calc = value" after a sentence, or nothing when there is nothing to compute. */
function tailOf(calc: string, value: Rational): string {
  return calc === rp(value) ? '' : `: ${calc} = ${rp(value)}`
}

/** "calc = value", or just "value" when there is nothing to compute ("4", not "4 = 4"). */
function worked(calc: string, value: Rational): string {
  return calc === rp(value) ? calc : `${calc} = ${rp(value)}`
}

function correctX(c: PtCtx): string {
  return `x = ${worked(xCalc(c.p, c.spec.b, c.spec.h), c.X)}`
}

function correctY(c: PtCtx): string {
  return `y = ${worked(yCalc(c.q, c.spec.a, c.spec.k), c.Y)}`
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

interface RawCandidate {
  kind: TransformMistakeKind
  point: ExactPoint
  witness: string
}

function rawCandidates(c: PtCtx): RawCandidate[] {
  const { spec, form, p, q, X, Y } = c
  const { a, b, h, k } = spec
  const out: RawCandidate[] = []
  const inside = pretty(insideText(spec, form))

  const reversed = (): void => {
    if (h.n === 0) return
    const x = ratSub(ratDiv(p, b), h)
    const add = h.n > 0 ? `add ${rp(h)} to` : `subtract ${rp(ratAbs(h))} from`
    const hers = h.n > 0 ? `subtracts ${rp(h)}` : `adds ${rp(ratAbs(h))}`
    out.push({
      kind: 'h_shift_reversed',
      point: { x, y: Y },
      witness: `The inside of f, ${inside}, is 0 at x = ${rp(h)}, so the graph shifts ${shiftWords(h, 'h')}: ${add} the x-coordinate. ${correctX(c)}. Your x-coordinate, ${rp(x)}, ${hers}.`,
    })
  }
  const vReversed = (): void => {
    if (k.n === 0) return
    const y = ratSub(ratMul(a, q), k)
    const sign = k.n > 0 ? `+ ${rp(k)}` : `− ${rp(ratAbs(k))}`
    out.push({
      kind: 'v_shift_reversed',
      point: { x: X, y },
      witness: `The ${sign} after f moves every point ${shiftWords(k, 'v')}: ${correctY(c)}. Your y-coordinate, ${rp(y)}, moves it ${shiftWords(ratNeg(k), 'v')}.`,
    })
  }
  const unfactored = (): void => {
    if (!hasUnfactoredForm(spec)) return
    const cst = unfactoredConstant(spec)
    const x = ratAdd(ratDiv(p, b), cst)
    const fac = pretty(insideText(spec, 'factored'))
    const unf = pretty(insideText(spec, 'unfactored'))
    const intro =
      form === 'unfactored'
        ? `Factor ${rp(b)} out first: ${unf} = ${fac}, so the shift is ${shiftWords(h, 'h')}, not ${shiftWords(cst, 'h')}.`
        : `In ${fac} the shift is ${shiftWords(h, 'h')}, not ${shiftWords(cst, 'h')} (${rp(cst)} belongs to the multiplied-out inside ${unf}).`
    out.push({
      kind: 'unfactored_shift',
      point: { x, y: Y },
      witness: `${intro} ${correctX(c)}. Your x-coordinate, ${rp(x)}, used ${rp(cst)}: ${xCalc(p, b, cst)} = ${rp(x)}.`,
    })
  }
  const missingReflection = (): void => {
    if (a.n < 0) {
      const A = ratAbs(a)
      const y = ratAdd(ratMul(A, q), k)
      out.push({
        kind: 'missing_reflection',
        point: { x: X, y },
        witness: `The minus sign in front of f (a = ${rp(a)}) flips the point over the x-axis: ${correctY(c)}. Your y-coordinate, ${rp(y)}, leaves out the minus sign${tailOf(yCalc(q, A, k), y)}.`,
      })
    }
    if (b.n < 0) {
      const B = ratAbs(b)
      const x = ratAdd(ratDiv(p, B), h)
      out.push({
        kind: 'missing_reflection',
        point: { x, y: Y },
        witness: `The minus sign on x inside f (b = ${rp(b)}) flips the point over the y-axis: ${correctX(c)}. Your x-coordinate, ${rp(x)}, leaves out the minus sign${tailOf(xCalc(p, B, h), x)}.`,
      })
    }
  }
  const wrongAxis = (): void => {
    if ((a.n < 0) === (b.n < 0)) return
    const x = ratAdd(ratDiv(p, ratNeg(b)), h)
    const y = ratAdd(ratMul(ratNeg(a), q), k)
    const hersPt = pointPretty({ x, y })
    const right = pointPretty({ x: X, y: Y })
    const witness =
      a.n < 0
        ? `The minus sign in front of f changes the sign of y, not x: it reflects over the x-axis. The point is ${right}; yours, ${hersPt}, flips x instead.`
        : `The minus sign on x inside f changes the sign of x, not y: it reflects over the y-axis. The point is ${right}; yours, ${hersPt}, flips y instead.`
    out.push({ kind: 'reflection_wrong_axis', point: { x, y }, witness })
  }
  const hInverted = (): void => {
    if (isOne(ratAbs(b))) return
    const x = ratAdd(ratMul(b, p), h)
    const how = ratCompare(ratAbs(b), rat(1)) > 0 ? 'squeezes the graph toward the y-axis' : 'spreads the graph away from the y-axis'
    out.push({
      kind: 'h_factor_inverted',
      point: { x, y: Y },
      witness: `The ${rp(b)} multiplying x inside f ${how}: DIVIDE the x-coordinate by ${rp(b)}. ${correctX(c)}. Your x-coordinate, ${rp(x)}, multiplies by ${rp(b)}: ${plusText(`${lead(b)}·${rf(p)}`, h)} = ${rp(x)}.`,
    })
  }
  const vInverted = (): void => {
    if (isOne(ratAbs(a))) return
    const y = ratAdd(ratDiv(q, a), k)
    out.push({
      kind: 'v_factor_inverted',
      point: { x: X, y },
      witness: `The ${rp(a)} in front of f MULTIPLIES every y-value by ${rp(a)}: ${correctY(c)}. Your y-coordinate, ${rp(y)}, divides by ${rp(a)}: ${plusText(`${rp(q)} ÷ ${rf(a)}`, k)} = ${rp(y)}.`,
    })
  }
  const hOrder = (): void => {
    if (form !== 'factored' || isOne(b) || h.n === 0) return
    const x = ratDiv(ratAdd(p, h), b)
    out.push({
      kind: 'h_order',
      point: { x, y: Y },
      witness: `Divide by ${rp(b)} FIRST, then shift (solve ${pretty(insideText(spec, 'factored'))} = ${rp(p)}): ${correctX(c)}. Your x-coordinate, ${rp(x)}, shifts first: (${plusText(rp(p), h)}) ÷ ${rf(b)} = ${rp(x)}.`,
    })
  }
  const vOrder = (): void => {
    if (isOne(a) || k.n === 0) return
    const y = ratMul(a, ratAdd(q, k))
    out.push({
      kind: 'v_order',
      point: { x: X, y },
      witness: `Multiply by ${rp(a)} FIRST, then shift: ${correctY(c)}. Your y-coordinate, ${rp(y)}, shifts first: ${lead(a)}·(${plusText(rp(q), k)}) = ${rp(y)}.`,
    })
  }
  const swapped = (): void => {
    if (ratCompare(a, b) === 0) return
    const why = `${rp(a)} is in front of f, so it acts on y (${correctY(c)}); ${rp(b)} is inside f with x, so it acts on x (${correctX(c)}).`
    const p1 = { x: ratAdd(ratDiv(p, a), h), y: ratAdd(ratMul(b, q), k) }
    const p2 = { x: ratAdd(ratMul(a, p), h), y: ratAdd(ratDiv(q, b), k) }
    for (const pt of [p1, p2]) {
      out.push({ kind: 'factors_swapped', point: pt, witness: `${why} Your point ${pointPretty(pt)} uses ${rp(a)} on x and ${rp(b)} on y.` })
    }
  }

  const order = form === 'unfactored' ? [unfactored, reversed, vReversed] : [reversed, vReversed, unfactored]
  for (const f of [...order, missingReflection, wrongAxis, hInverted, vInverted, hOrder, vOrder, swapped]) f()
  return out
}

function samePoint(u: ExactPoint, v: ExactPoint): boolean {
  return ratCompare(u.x, v.x) === 0 && ratCompare(u.y, v.y) === 0
}

function candidatesFor(c: PtCtx): PointMistakeCandidate[] {
  const right: ExactPoint = { x: c.X, y: c.Y }
  const kept: PointMistakeCandidate[] = []
  for (const r of rawCandidates(c)) {
    if (samePoint(r.point, right)) continue
    const twin = kept.find((k) => samePoint(k.point, r.point))
    if (twin) {
      if (twin.kind !== r.kind && !twin.shadows.includes(r.kind)) twin.shadows.push(r.kind)
      continue
    }
    kept.push({ kind: r.kind, point: r.point, text: pointText(r.point), witness: r.witness, shadows: [] })
  }
  return kept
}

function context(spec: TransformSpec, point: PointLike, form: StatementForm): PtCtx | null {
  if (specProblem(spec)) return null
  const pt = toPoint(point)
  if (!pt) return null
  const img = mapPoint(spec, pt)
  return { spec, form, p: pt.x, q: pt.y, X: img.x, Y: img.y }
}

/**
 * What each point mistake gives for (p, q) on f, in priority order, each different from the right image
 * and from the others (a later kind giving the same point is listed in the earlier one's `shadows`).
 * Null for an invalid spec or point.
 */
export function mappedPointMistakes(
  spec: TransformSpec,
  point: PointLike,
  options: { form?: StatementForm } = {},
): PointMistakeCandidate[] | null {
  const c = context(spec, point, options.form ?? 'factored')
  return c ? candidatesFor(c) : null
}

/** A rounded-decimal note: "7/3 is not 2.33: give the exact value." */
function roundedNote(text: string, her: Rational | null, right: Rational): string {
  if (!her || !/\./.test(text) || right.d === 1) return ''
  let d = right.d
  while (d % 2 === 0) d /= 2
  while (d % 5 === 0) d /= 5
  if (d === 1) return ''
  const close = Math.abs(ratToNumber(her) - ratToNumber(right)) <= 0.01 * Math.max(1, Math.abs(ratToNumber(right)))
  return close ? ` ${pretty(text)} is a rounded decimal: give the exact value, ${rp(right)}.` : ''
}

/**
 * Grade her image of (p, q) under g. `form` says how the problem wrote the inside of f: 'unfactored'
 * (f(2x − 6)) makes "used 6 instead of 3" the unfactored-shift trap.
 */
export function gradeMappedPoint(
  spec: TransformSpec,
  point: PointLike,
  answer: string,
  options: { form?: StatementForm } = {},
): TransformGrade {
  const problem = specProblem(spec)
  if (problem) return { verdict: 'unsupported', message: `This transformation is not valid: ${problem}.` }
  const c = context(spec, point, options.form ?? 'factored')
  if (!c) return { verdict: 'unsupported', message: 'The point on f does not have numeric coordinates.' }
  const her = parsePointAnswer(answer)
  if (!her.ok) return { verdict: 'invalid', message: her.error.message, position: her.error.position, length: her.error.length }
  const xOk = her.x !== null && ratCompare(her.x, c.X) === 0
  const yOk = her.y !== null && ratCompare(her.y, c.Y) === 0
  const from = pointPretty({ x: c.p, y: c.q })
  const to = pointPretty({ x: c.X, y: c.Y })
  if (xOk && yOk) return { verdict: 'correct', message: `Correct: ${from} on f moves to ${to} on g (${correctX(c)}, ${correctY(c)}).` }
  if (her.x !== null && her.y !== null) {
    const hp = { x: her.x, y: her.y }
    const hit = candidatesFor(c).find((k) => samePoint(k.point, hp))
    if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness }
  }
  let message: string
  if (xOk) message = `Your x-coordinate ${rp(c.X)} is right. For y, ${yRule(c.spec)}: ${correctY(c)}.${roundedNote(her.yText, her.y, c.Y)}`
  else if (yOk) message = `Your y-coordinate ${rp(c.Y)} is right. For x, ${xRule(c.spec)}: ${correctX(c)}.${roundedNote(her.xText, her.x, c.X)}`
  else {
    message = `${from} on f moves to ${to} on g. For x, ${xRule(c.spec)}: ${correctX(c)}. For y, ${yRule(c.spec)}: ${correctY(c)}.${roundedNote(her.xText, her.x, c.X)}${roundedNote(her.yText, her.y, c.Y)}`
  }
  return { verdict: 'wrong', message }
}
