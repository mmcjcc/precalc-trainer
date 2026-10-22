/**
 * The graphs of the six trig functions (Unit 5), y = A·f(B(x − C)) + D, exactly: A and D rational, B positive (a
 * rational, or a rational times π), the phase shift C in x-units (a multiple of π when B has no π, a rational when it
 * has one), so that B·C, the number in the textbook's form y = A sin(Bx − C) + D, is always a multiple of π.
 *
 * Features: the amplitude |A| (sin and cos), the period 2π/B (sin, cos, sec, csc) or π/B (tan, cot), the phase shift,
 * the midline y = D, the range, the five key points of one period from the phase shift (sin and cos), the vertical
 * asymptotes as a family x = a + k·p, and the zeros of tan and cot (when D = 0). Each feature has the slips a student
 * makes, computed for THIS wave, with a sentence about her answer that never states the right one; each builder returns
 * them in detection order, the ones equal to the answer (or to an earlier slip) left out.
 */
import { exactAbs, exactAdd, exactDiv, exactEq, exactMul, exactNeg, exactNum, exactPi, exactQ, exactSay, exactTex, exactText, isZero, tx, type TrigExact } from './exact'
import { Q0, q, qAbs, qAdd, qCmp, qDiv, qMul, qNeg, qNum, qSub, type Q } from './rational'
import type { TrigMistakeId } from './types'

export type WaveFn = 'sin' | 'cos' | 'tan' | 'cot' | 'sec' | 'csc'

/** How the equation is written: y = A sin(B(x − C)) + D, or y = A sin(Bx − C) + D. */
export type WaveForm = 'factored' | 'expanded'

export interface Wave {
  fn: WaveFn
  /** Nonzero. */
  A: Q
  /** Positive: a rational (2, 1/2) or a rational times π (π/2). */
  B: TrigExact
  /** The phase shift in x-units, exact: negative is to the left. */
  C: TrigExact
  D: Q
}

/** A family of x-values {base + k·step : k an integer}, with step > 0 and 0 ≤ base < step. */
export interface XFamily {
  base: TrigExact
  step: TrigExact
}

const PI = exactPi(q(1))
const TWO_PI = exactPi(q(2))

export const isSinusoid = (fn: WaveFn) => fn === 'sin' || fn === 'cos'

/** The period of the parent function: 2π for sin, cos, sec, csc; π for tan and cot. */
export function baseTurn(fn: WaveFn): TrigExact {
  return fn === 'tan' || fn === 'cot' ? PI : TWO_PI
}

export function wavePeriod(w: Wave): TrigExact {
  return exactDiv(baseTurn(w.fn), w.B)
}

export function waveAmplitude(w: Wave): TrigExact {
  return exactQ(qAbs(w.A))
}

/** B·C: the number subtracted from Bx in the expanded form. */
export function waveInnerShift(w: Wave): TrigExact {
  return exactMul(w.B, w.C)
}

/** Exact sum, or a throw when the terms are not alike (the generators keep x-values to one kind). */
export function addExact(a: TrigExact, b: TrigExact): TrigExact {
  const s = exactAdd(a, b)
  if (!s) throw new Error(`unlike terms: ${exactText(a)} + ${exactText(b)}`)
  return s
}

/** The ratio a/b of two like exact values (a rational), or null. */
function ratioQ(a: TrigExact, b: TrigExact): Q | null {
  if (isZero(a)) return Q0
  const r = exactDiv(a, b)
  return r.root === 1 && r.pi === 0 ? r.c : null
}

/** base reduced into [0, step). */
export function normalFamily(base: TrigExact, step: TrigExact): XFamily {
  const s = exactAbs(step)
  const r = ratioQ(base, s)
  if (r === null) throw new Error('a family needs a base and a step of one kind')
  const k = Math.floor(qNum(r))
  return { base: addExact(base, exactNeg(exactMul(exactQ(q(k)), s))), step: s }
}

/** The five key points of one period from the phase shift: midline, top or bottom, midline… (sin and cos). */
export function waveKeyPoints(w: Wave): { x: TrigExact; y: Q }[] {
  if (!isSinusoid(w.fn)) throw new Error('key points are for sin and cos')
  const quarter = exactDiv(wavePeriod(w), exactQ(q(4)))
  const s = w.fn === 'sin' ? [0, 1, 0, -1, 0] : [1, 0, -1, 0, 1]
  return s.map((k, i) => ({ x: addExact(w.C, exactMul(exactQ(q(i)), quarter)), y: qAdd(w.D, qMul(w.A, q(k))) }))
}

/**
 * The vertical asymptotes, x = a + k·p: where the inside B(x − C) is π/2 + kπ (tan, sec: where cos is zero) or kπ
 * (cot, csc: where sin is zero). Null for sin and cos.
 */
export function waveAsymptotes(w: Wave): XFamily | null {
  if (isSinusoid(w.fn)) return null
  const step = exactDiv(PI, w.B)
  const offset = w.fn === 'tan' || w.fn === 'sec' ? exactDiv(step, exactQ(q(2))) : exactQ(Q0)
  return normalFamily(addExact(w.C, offset), step)
}

/** The x-intercepts of tan and cot when D = 0: where the inside is kπ (tan) or π/2 + kπ (cot). */
export function waveZeros(w: Wave): XFamily | null {
  if ((w.fn !== 'tan' && w.fn !== 'cot') || w.D.n !== 0) return null
  const step = exactDiv(PI, w.B)
  const offset = w.fn === 'cot' ? exactDiv(step, exactQ(q(2))) : exactQ(Q0)
  return normalFamily(addExact(w.C, offset), step)
}

/** y at x, as a number (NaN on an asymptote). */
export function waveValue(w: Wave, x: number): number {
  const u = exactNum(w.B) * (x - exactNum(w.C))
  const s = Math.sin(u)
  const c = Math.cos(u)
  let f: number
  switch (w.fn) {
    case 'sin':
      f = s
      break
    case 'cos':
      f = c
      break
    case 'tan':
      f = Math.abs(c) < 1e-13 ? Number.NaN : s / c
      break
    case 'cot':
      f = Math.abs(s) < 1e-13 ? Number.NaN : c / s
      break
    case 'sec':
      f = Math.abs(c) < 1e-13 ? Number.NaN : 1 / c
      break
    case 'csc':
      f = Math.abs(s) < 1e-13 ? Number.NaN : 1 / s
      break
  }
  return qNum(w.A) * f + qNum(w.D)
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const qPlain = (v: Q) => (v.d === 1 ? String(v.n) : `${v.n}/${v.d}`)
const qTexAbs = (v: Q) => (v.d === 1 ? String(Math.abs(v.n)) : `\\frac{${Math.abs(v.n)}}{${v.d}}`)

/** A coefficient in front of a function as she would type it: "", "-", "3", "-3", "(3/2)", "-(3/2)". */
function coefText(A: Q): string {
  const sign = A.n < 0 ? '-' : ''
  const a = qAbs(A)
  if (a.n === 1 && a.d === 1) return sign
  return `${sign}${a.d === 1 ? String(a.n) : `(${qPlain(a)})`}`
}

function coefTex(A: Q): string {
  const sign = A.n < 0 ? '-' : ''
  const a = qAbs(A)
  if (a.n === 1 && a.d === 1) return sign
  return `${sign}${qTexAbs(a)}`
}

/** B times the variable: "2x", "x/2", "2x/3", "πx", "πx/2", "3πx/4". */
function bxText(B: TrigExact, v: string): string {
  const pi = B.pi === 1 ? 'π' : ''
  const n = B.c.n
  const d = B.c.d
  const top = `${n === 1 ? '' : n}${pi}${v}`
  return d === 1 ? top : `${top}/${d}`
}

function bxTex(B: TrigExact, v: string): string {
  const pi = B.pi === 1 ? '\\pi ' : ''
  const n = B.c.n
  const d = B.c.d
  const top = `${n === 1 ? '' : n}${pi}${v}`
  return d === 1 ? top : `\\frac{${top}}{${d}}`
}

/** B as a factor in front of a parenthesis: "2", "(1/2)", "π", "(π/2)". */
function bFactorText(B: TrigExact): string {
  const t = exactText(B)
  return /[/]/.test(t) ? `(${t})` : t
}

/** "x − π/4", "x + π/3", "x" (the inside of the factored form). */
function shiftedVarText(C: TrigExact, v: string): string {
  if (isZero(C)) return v
  return exactNum(C) > 0 ? `${v} - ${exactText(C)}` : `${v} + ${exactText(exactNeg(C))}`
}

function shiftedVarTex(C: TrigExact, v: string): string {
  if (isZero(C)) return v
  return exactNum(C) > 0 ? `${v} - ${exactTex(C)}` : `${v} + ${exactTex(exactNeg(C))}`
}

/** The inside of the function as she would type it. */
export function waveInsideText(w: Wave, form: WaveForm, v = 'x'): string {
  if (isZero(w.C)) return bxText(w.B, v)
  if (form === 'expanded') {
    const bc = waveInnerShift(w)
    return exactNum(bc) > 0 ? `${bxText(w.B, v)} - ${exactText(bc)}` : `${bxText(w.B, v)} + ${exactText(exactNeg(bc))}`
  }
  if (exactEq(w.B, exactQ(q(1)))) return shiftedVarText(w.C, v)
  return `${bFactorText(w.B)}(${shiftedVarText(w.C, v)})`
}

export function waveInsideTex(w: Wave, form: WaveForm, v = 'x'): string {
  if (isZero(w.C)) return bxTex(w.B, v)
  if (form === 'expanded') {
    const bc = waveInnerShift(w)
    return exactNum(bc) > 0 ? `${bxTex(w.B, v)} - ${exactTex(bc)}` : `${bxTex(w.B, v)} + ${exactTex(exactNeg(bc))}`
  }
  if (exactEq(w.B, exactQ(q(1)))) return shiftedVarTex(w.C, v)
  return `${exactTex(w.B)}\\left(${shiftedVarTex(w.C, v)}\\right)`
}

const dText = (D: Q) => (D.n === 0 ? '' : D.n > 0 ? ` + ${qPlain(D)}` : ` - ${qPlain(qNeg(D))}`)
const dTex = (D: Q) => (D.n === 0 ? '' : D.n > 0 ? ` + ${qTexAbs(D)}` : ` - ${qTexAbs(D)}`)

/** The right side as she would type it: "3sin(2(x - π/4)) + 1". */
export function waveRhsText(w: Wave, form: WaveForm, v = 'x'): string {
  return `${coefText(w.A)}${w.fn}(${waveInsideText(w, form, v)})${dText(w.D)}`
}

/** The equation as she would type it: "y = 3sin(2(x - π/4)) + 1". */
export function waveText(w: Wave, form: WaveForm, name = 'y', v = 'x'): string {
  return `${name} = ${waveRhsText(w, form, v)}`
}

/** KaTeX: "y = 3\sin\left(2\left(x - \frac{\pi}{4}\right)\right) + 1". */
export function waveTex(w: Wave, form: WaveForm, name = 'y', v = 'x'): string {
  return `${name} = ${coefTex(w.A)}\\${w.fn}\\left(${waveInsideTex(w, form, v)}\\right)${dTex(w.D)}`
}

/** For a sentence: "−π/4", "3/2". */
export function saySigned(v: TrigExact): string {
  return exactSay(v)
}

/** "x = π/4 + kπ/2" as she would type it (k·p written kπ/2, 2kπ, k/2). */
export function familyText(f: XFamily, letter = 'k'): string {
  const step = f.step
  const pi = step.pi === 1 ? 'π' : ''
  const n = step.c.n
  const d = step.c.d
  const kp = `${n === 1 ? '' : n}${letter}${pi}${d === 1 ? '' : `/${d}`}`
  return isZero(f.base) ? `x = ${kp}` : `x = ${exactText(f.base)} + ${kp}`
}

export function familyTex(f: XFamily, letter = 'k'): string {
  const step = f.step
  const pi = step.pi === 1 ? '\\pi' : ''
  const n = step.c.n
  const d = step.c.d
  const top = `${n === 1 ? '' : n}${letter}${pi}`
  const kp = d === 1 ? top : `\\frac{${top}}{${d}}`
  return isZero(f.base) ? `x = ${kp}` : `x = ${exactTex(f.base)} + ${kp}`
}

/** The range as she would type it: "[-2, 4]", "(-∞, -2] ∪ [4, ∞)", "(-∞, ∞)". */
export function waveRangeText(w: Wave): string {
  if (w.fn === 'tan' || w.fn === 'cot') return '(-∞, ∞)'
  const a = qAbs(w.A)
  const lo = qPlain(qSub(w.D, a))
  const hi = qPlain(qAdd(w.D, a))
  return isSinusoid(w.fn) ? `[${lo}, ${hi}]` : `(-∞, ${lo}] ∪ [${hi}, ∞)`
}

// ---------------------------------------------------------------------------
// Slips
// ---------------------------------------------------------------------------

export interface WaveSlip {
  id: TrigMistakeId
  value: TrigExact
  witness: string
}

export interface WaveSetSlip {
  id: TrigMistakeId
  family: XFamily
  witness: string
}

export interface WaveRangeSlip {
  id: TrigMistakeId
  text: string
  witness: string
}

export interface WavePointsSlip {
  id: TrigMistakeId
  points: { x: TrigExact; y: Q }[]
  witness: string
}

function distinctExact(answer: TrigExact, slips: readonly (WaveSlip | null)[]): WaveSlip[] {
  const out: WaveSlip[] = []
  for (const s of slips) {
    if (!s || exactEq(s.value, answer) || out.some((o) => exactEq(o.value, s.value))) continue
    out.push(s)
  }
  return out
}

const FN_WORD: Record<WaveFn, string> = { sin: 'sine', cos: 'cosine', tan: 'tangent', cot: 'cotangent', sec: 'secant', csc: 'cosecant' }

/** Slips for the amplitude: A's sign kept, the vertical shift added, the whole height from bottom to top. */
export function amplitudeSlips(w: Wave): WaveSlip[] {
  const amp = waveAmplitude(w)
  const top = qAdd(w.D, qAbs(w.A))
  return distinctExact(amp, [
    w.A.n < 0
      ? {
          id: 'trig_amplitude_negative',
          value: exactQ(w.A),
          witness: 'Your amplitude is negative: it keeps the minus sign in front of the function. The amplitude is a distance, from the midline to the highest point, so it is |A|; the minus sign only flips the graph over its midline.',
        }
      : null,
    w.D.n !== 0 && qCmp(top, Q0) > 0
      ? {
          id: 'trig_amplitude_with_d',
          value: exactQ(top),
          witness: 'Your amplitude counts the vertical shift too: that is the height of the highest point. The amplitude is measured up from the midline, so the number added at the end is not part of it.',
        }
      : null,
    {
      id: 'trig_amplitude_as_span',
      value: exactMul(amp, exactQ(q(2))),
      witness: 'That is the whole distance from the lowest point to the highest. The amplitude is half of it: from the midline up to the top.',
    },
  ])
}

/** Slips for the period: B itself, B multiplied in, the other family's period (π/B for 2π/B, and back). */
export function periodSlips(w: Wave): WaveSlip[] {
  const p = wavePeriod(w)
  const base = baseTurn(w.fn)
  const halfTurn = w.fn === 'tan' || w.fn === 'cot'
  const formula = halfTurn ? 'π/B' : '2π/B'
  return distinctExact(p, [
    {
      id: 'trig_period_as_b',
      value: w.B,
      witness: `That is B, the number multiplying x. B is how many cycles fit where the parent graph has one; the period, the length of one cycle, is ${formula}.`,
    },
    {
      id: 'trig_period_times_b',
      value: exactMul(base, w.B),
      witness: `Your period multiplies by B. A bigger B squeezes the graph, so its cycles get shorter: divide instead, ${formula}.`,
    },
    {
      id: 'trig_period_base_mixed',
      value: exactDiv(halfTurn ? TWO_PI : PI, w.B),
      witness: halfTurn
        ? `That uses 2π/B, the period of sin, cos, sec and csc. The ${FN_WORD[w.fn]} repeats twice as often: its period is π/B.`
        : `That uses π/B, the period of tan and cot. The ${FN_WORD[w.fn]} takes a full turn to repeat: its period is 2π/B.`,
    },
  ])
}

/**
 * Slips for the phase shift: in y = A sin(Bx − C) + D, C used without dividing by B; and either form, the shift the
 * wrong way (x + c read as a shift to the right).
 */
export function shiftSlips(w: Wave, form: WaveForm): WaveSlip[] {
  if (isZero(w.C)) return []
  const right = exactNum(w.C) > 0
  return distinctExact(w.C, [
    form === 'expanded' && !exactEq(w.B, exactQ(q(1)))
      ? {
          id: 'trig_shift_not_divided',
          value: waveInnerShift(w),
          witness: 'That is the number subtracted from Bx, before dividing by B. Factor B out first, Bx − C = B(x − C/B): the phase shift is C/B.',
        }
      : null,
    {
      id: 'trig_shift_wrong_way',
      value: exactNeg(w.C),
      witness: right
        ? 'Your shift goes the wrong way. Inside the function a minus sign moves the graph right: the cycle starts where the inside is zero, at a positive x.'
        : 'Your shift goes the wrong way. Inside the function a plus sign moves the graph left: the cycle starts where the inside is zero, at a negative x.',
    },
  ])
}

/** Slips for the midline: the x-axis (the vertical shift left out). */
export function midlineSlips(w: Wave): WaveSlip[] {
  if (w.D.n === 0) return []
  return [
    {
      id: 'trig_midline_zero',
      value: exactQ(Q0),
      witness: 'That is the x-axis. The number added at the end moves the whole graph up or down, and the midline with it: the midline is y = D.',
    },
  ]
}

/** Slips for the range (sin, cos, sec, csc): centred on zero (D left out); for sec and csc, the band of the sinusoid. */
export function rangeSlips(w: Wave): WaveRangeSlip[] {
  if (w.fn === 'tan' || w.fn === 'cot') return []
  const a = qAbs(w.A)
  const out: WaveRangeSlip[] = []
  if (w.D.n !== 0) {
    const centred: Wave = { ...w, D: Q0 }
    out.push({
      id: 'trig_range_ignores_d',
      text: waveRangeText(centred),
      witness: 'Your range is centred on zero. The vertical shift moves every height up or down by the same amount, so the range is centred on the midline y = D.',
    })
  }
  if (!isSinusoid(w.fn)) {
    out.push({
      id: 'trig_sec_range_as_sinusoid',
      text: `[${qPlain(qSub(w.D, a))}, ${qPlain(qAdd(w.D, a))}]`,
      witness: `That is the range of the ${w.fn === 'sec' ? 'cosine' : 'sine'} curve it is one over. Where that curve is small, its reciprocal is large: the ${FN_WORD[w.fn]} takes every height outside that band, never inside it.`,
    })
  }
  return out
}

const sameFamily = (a: XFamily, b: XFamily) => exactEq(a.base, b.base) && exactEq(a.step, b.step)

function distinctFamilies(answer: XFamily, slips: readonly (WaveSetSlip | null)[]): WaveSetSlip[] {
  const out: WaveSetSlip[] = []
  for (const s of slips) {
    if (!s || sameFamily(s.family, answer) || out.some((o) => sameFamily(o.family, s.family))) continue
    out.push(s)
  }
  return out
}

/** The family for this wave with another shift, or another kind of zero of the inside. */
function familyWith(w: Wave, C: TrigExact, atHalf: boolean): XFamily {
  const step = exactDiv(PI, w.B)
  return normalFamily(addExact(C, atHalf ? exactDiv(step, exactQ(q(2))) : exactQ(Q0)), step)
}

const halfOffset = (fn: WaveFn) => fn === 'tan' || fn === 'sec'

/**
 * Slips for the vertical asymptotes: tan's at its zeros (and cot's), sec's where sin is zero (and csc's where cos is),
 * the shift not divided by B, the shift the wrong way.
 */
export function asymptoteSlips(w: Wave, form: WaveForm): WaveSetSlip[] {
  const answer = waveAsymptotes(w)
  if (!answer) return []
  const half = halfOffset(w.fn)
  const tanLike = w.fn === 'tan' || w.fn === 'cot'
  return distinctFamilies(answer, [
    tanLike
      ? {
          id: 'trig_asymptotes_zeros_swapped',
          family: familyWith(w, w.C, !half),
          witness: `Those are where the ${FN_WORD[w.fn]} crosses its midline, the middle of each branch. The vertical asymptotes are where it has no value: where the ${w.fn === 'tan' ? 'cosine' : 'sine'} of the inside is zero.`,
        }
      : {
          id: 'trig_sec_asymptotes_at_sin_zeros',
          family: familyWith(w, w.C, !half),
          witness: `Those are the asymptotes of ${w.fn === 'sec' ? 'csc, one over sin' : 'sec, one over cos'}. ${w.fn === 'sec' ? 'sec is one over cos' : 'csc is one over sin'}, so its asymptotes are where the ${w.fn === 'sec' ? 'cosine' : 'sine'} of the inside is zero.`,
        },
    form === 'expanded' && w.B.pi === 0 && !exactEq(w.B, exactQ(q(1))) && !isZero(w.C)
      ? {
          id: 'trig_shift_not_divided',
          family: familyWith(w, waveInnerShift(w), half),
          witness: 'Your asymptotes are shifted by the number subtracted from Bx, before dividing by B. Solve for x all the way: divide every term by B.',
        }
      : null,
    !isZero(w.C)
      ? {
          id: 'trig_shift_wrong_way',
          family: familyWith(w, exactNeg(w.C), half),
          witness: 'Your asymptotes are shifted the wrong way. Solve the inside for x: moving the number across the equals sign changes its sign.',
        }
      : null,
  ])
}

/** Slips for the zeros of tan and cot (D = 0): the asymptotes given instead, the shift not divided, the wrong way. */
export function zeroSlips(w: Wave, form: WaveForm): WaveSetSlip[] {
  const answer = waveZeros(w)
  if (!answer) return []
  const atHalf = w.fn === 'cot'
  return distinctFamilies(answer, [
    {
      id: 'trig_asymptotes_zeros_swapped',
      family: familyWith(w, w.C, !atHalf),
      witness: `Those are the vertical asymptotes, where the ${FN_WORD[w.fn]} has no value. Its x-intercepts are halfway between them, where the ${w.fn === 'tan' ? 'sine' : 'cosine'} of the inside is zero.`,
    },
    form === 'expanded' && w.B.pi === 0 && !exactEq(w.B, exactQ(q(1))) && !isZero(w.C)
      ? {
          id: 'trig_shift_not_divided',
          family: familyWith(w, waveInnerShift(w), atHalf),
          witness: 'Your x-intercepts are shifted by the number subtracted from Bx, before dividing by B. Solve for x all the way: divide every term by B.',
        }
      : null,
    !isZero(w.C)
      ? {
          id: 'trig_shift_wrong_way',
          family: familyWith(w, exactNeg(w.C), atHalf),
          witness: 'Your x-intercepts are shifted the wrong way. Solve the inside for x: moving the number across the equals sign changes its sign.',
        }
      : null,
  ])
}

const samePoints = (a: { x: TrigExact; y: Q }[], b: { x: TrigExact; y: Q }[]) =>
  a.length === b.length && a.every((p) => b.some((r) => exactEq(p.x, r.x) && p.y.n === r.y.n && p.y.d === r.y.d))

/** Slips for the five key points: starting at the shift the wrong way, at the undivided shift, a reflection missed. */
export function keyPointSlips(w: Wave, form: WaveForm): WavePointsSlip[] {
  const answer = waveKeyPoints(w)
  const cands: WavePointsSlip[] = []
  if (!isZero(w.C)) {
    // With π in B the undivided shift is a multiple of π while the period has none: not a list she could write.
    if (form === 'expanded' && w.B.pi === 0 && !exactEq(w.B, exactQ(q(1)))) {
      cands.push({
        id: 'trig_shift_not_divided',
        points: waveKeyPoints({ ...w, C: waveInnerShift(w) }),
        witness: 'Your points start at the number subtracted from Bx, before dividing by B. One period starts at the phase shift, C/B.',
      })
    }
    cands.push({
      id: 'trig_shift_wrong_way',
      points: waveKeyPoints({ ...w, C: exactNeg(w.C) }),
      witness: 'Your points start on the wrong side: the phase shift goes the other way. One period starts where the inside of the function is zero.',
    })
  }
  if (w.A.n < 0) {
    cands.push({
      id: 'trig_reflection_missed',
      points: waveKeyPoints({ ...w, A: qNeg(w.A) }),
      witness: `Your highest and lowest points are swapped: the minus sign in front flips the graph over its midline, so the ${FN_WORD[w.fn]} goes down where it would go up.`,
    })
  }
  const out: WavePointsSlip[] = []
  for (const c of cands) {
    if (samePoints(c.points, answer) || out.some((o) => samePoints(o.points, c.points))) continue
    out.push(c)
  }
  return out
}

/** "(π/4, 1), (π/2, 4), …" as she would type it. */
export function pointsText(points: readonly { x: TrigExact; y: Q }[]): string {
  return points.map((p) => `(${exactText(p.x)}, ${qPlain(p.y)})`).join(', ')
}

/** Does every value of a wave lie between its lowest and highest points (for checks)? */
export function waveExtremes(w: Wave): { lo: Q; hi: Q } {
  const a = qAbs(w.A)
  return { lo: qSub(w.D, a), hi: qAdd(w.D, a) }
}

/** An exact multiple of π, for the generators: k·π. */
export function piTimes(k: Q): TrigExact {
  return exactPi(k)
}

/** A rational as an exact value. */
export function rat(n: number, d = 1): TrigExact {
  return tx(q(n, d))
}

/** k/n of a rational, for the generators. */
export function qOf(n: number, d = 1): Q {
  return qDiv(q(n), q(d))
}
