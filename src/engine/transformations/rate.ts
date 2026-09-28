/**
 * Average rate of change of f on [a, b]: (f(b) − f(a)) / (b − a), exactly.
 *
 * f is a polynomial or rational function (or any formula whose values at a and b are rational: sqrt(x) on
 * [1, 4] works). Null when f does not parse, a = b, f is undefined at a or b, or a value is not rational —
 * never a float guess.
 *
 * Named mistakes: the subtractions in opposite orders (sign flipped), forgot to divide by b − a, the ratio
 * upside down (run over rise), divided by b instead of b − a.
 */
import type { Rational } from '@/shared/types'
import { ratCompare, ratDiv, ratNeg, ratSub, ratToNumber } from '@/notation/rational'
import type { MathNode } from '../math'
import { parseValueAnswer } from '../functions/answer'
import { parseFunction } from '../functions/common'
import { exactEval, surdRational } from '../functions/exact'
import { showNode, substituteValueText } from '../functions/text'
import { pretty, rf, rp, rt, toRational } from './text'
import type { AverageRate, RateMistakeCandidate, RatLike, TransformGrade, TransformMistakeKind } from './types'

function rationalAt(node: MathNode, t: Rational): Rational | null {
  try {
    const v = exactEval(node, t)
    return v === 'undef' ? null : surdRational(v)
  } catch {
    return null
  }
}

/** "16 − (−1)": a minus b with b in parentheses when negative. */
function minus(a: Rational, b: Rational): string {
  return `${rp(a)} − ${b.n < 0 ? `(${rp(b)})` : rp(b)}`
}

interface Model {
  f: string
  rate: AverageRate
}

function model(f: string, a: RatLike, b: RatLike): Model | null {
  const p = parseFunction(f ?? '')
  const ra = toRational(a)
  const rb = toRational(b)
  if (!p.ok || !ra || !rb || ratCompare(ra, rb) === 0) return null
  const fa = rationalAt(p.node, ra)
  const fb = rationalAt(p.node, rb)
  if (!fa || !fb) return null
  const text = showNode(p.node)
  const rise = ratSub(fb, fa)
  const run = ratSub(rb, ra)
  const rate = ratDiv(rise, run)
  const subA = substituteValueText(text, rt(ra))
  const subB = substituteValueText(text, rt(rb))
  const val = (sub: string, v: Rational) => (sub === rt(v) ? pretty(sub) : `${pretty(sub)} = ${rp(v)}`)
  const quotient = `${rise.d === 1 ? rp(rise) : `(${rp(rise)})`}/${rf(run)}`
  const tail = ` = ${rp(rate)}`
  return {
    f: text,
    rate: {
      a: ra,
      b: rb,
      fa,
      fb,
      rise,
      run,
      rate,
      text: rt(rate),
      steps: [
        `f(${rp(rb)}) = ${val(subB, fb)} and f(${rp(ra)}) = ${val(subA, fa)}.`,
        `Average rate of change = (f(${rp(rb)}) − f(${rp(ra)}))/(${minus(rb, ra)}) = (${minus(fb, fa)})/(${minus(rb, ra)}) = ${quotient}${tail}.`,
      ],
    },
  }
}

/** (f(b) − f(a)) / (b − a) exactly, with reading lines; null outside the exact model (see the file comment). */
export function averageRateOfChange(f: string, a: RatLike, b: RatLike): AverageRate | null {
  return model(f, a, b)?.rate ?? null
}

function candidates(m: Model): RateMistakeCandidate[] {
  const { a, b, fa, fb, rise, run, rate } = m.rate
  const A = rp(a)
  const B = rp(b)
  const right = `(f(${B}) − f(${A}))/(${minus(b, a)}) = (${minus(fb, fa)})/(${minus(b, a)}) = ${rp(rate)}`
  const raw: { kind: TransformMistakeKind; value: Rational | null; witness: (v: Rational) => string }[] = [
    {
      kind: 'rate_sign_flipped',
      value: ratNeg(rate),
      witness: (v) => `Subtract in the same order on top and bottom: ${right}. Your ${rp(v)} has the opposite sign, which is what you get when the top subtracts one way and the bottom the other way.`,
    },
    {
      kind: 'rate_no_division',
      value: rise,
      witness: (v) => `${rp(v)} is the change in f, f(${B}) − f(${A}) = ${minus(fb, fa)} = ${rp(v)}. Divide it by the change in x, ${minus(b, a)} = ${rp(run)}: ${right}.`,
    },
    {
      kind: 'rate_inverted',
      value: rise.n === 0 ? null : ratDiv(run, rise),
      witness: (v) => `Rate of change is the change in y over the change in x (rise over run): ${right}. Your ${rp(v)} is run over rise, (${minus(b, a)})/(${minus(fb, fa)}).`,
    },
    {
      kind: 'rate_divided_by_b',
      value: b.n === 0 ? null : ratDiv(rise, b),
      witness: (v) => `Divide by the change in x, ${minus(b, a)} = ${rp(run)}, not by ${B}: ${right}. Your ${rp(v)} is (${minus(fb, fa)})/${rf(b)}.`,
    },
  ]
  const kept: RateMistakeCandidate[] = []
  for (const r of raw) {
    if (!r.value || ratCompare(r.value, rate) === 0) continue
    const twin = kept.find((k) => ratCompare(k.value, r.value!) === 0)
    if (twin) {
      if (!twin.shadows.includes(r.kind)) twin.shadows.push(r.kind)
      continue
    }
    kept.push({ kind: r.kind, value: r.value, text: rt(r.value), witness: r.witness(r.value), shadows: [] })
  }
  return kept
}

/** What each rate mistake gives, in priority order (distinct from the answer and each other); null outside the model. */
export function averageRateMistakes(f: string, a: RatLike, b: RatLike): RateMistakeCandidate[] | null {
  const m = model(f, a, b)
  return m ? candidates(m) : null
}

/** Grade her average rate of change: a number, compared exactly ("5", "15/3", "-1.5"). */
export function gradeAverageRate(f: string, a: RatLike, b: RatLike, answer: string): TransformGrade {
  const m = model(f, a, b)
  if (!m) return { verdict: 'unsupported', message: `The average rate of change of ${f} on [${String(a)}, ${String(b)}] is outside what the checker can compute exactly.` }
  const ans = parseValueAnswer(answer ?? '')
  if (!ans.ok) return { verdict: 'invalid', message: ans.error.message, position: ans.error.position, length: ans.error.length }
  const steps = m.rate.steps.join(' ')
  if (ans.undefined) return { verdict: 'wrong', message: `The average rate of change is a number here: ${steps}` }
  let her: Rational | null = null
  try {
    const v = exactEval(ans.node, null)
    if (v === 'undef') return { verdict: 'invalid', message: 'That value is undefined as written. Check for a division by 0.' }
    her = surdRational(v)
  } catch {
    her = null
  }
  if (her && ratCompare(her, m.rate.rate) === 0) return { verdict: 'correct', message: `Correct: ${steps}` }
  if (her) {
    const hit = candidates(m).find((c) => ratCompare(c.value, her!) === 0)
    if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness }
  }
  const herText = her ? rp(her) : pretty(ans.text)
  const rounded =
    her && /\./.test(ans.text) && Math.abs(ratToNumber(her) - ratToNumber(m.rate.rate)) <= 0.01 * Math.max(1, Math.abs(ratToNumber(m.rate.rate)))
      ? ` ${pretty(ans.text)} is a rounded decimal: give the exact value, ${rp(m.rate.rate)}.`
      : ''
  return { verdict: 'wrong', message: `${steps} Your answer, ${herText}, is not ${rp(m.rate.rate)}.${rounded}` }
}
