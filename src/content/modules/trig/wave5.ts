/**
 * Shared by the Unit 5 graph templates (sinusoids, otherTrigGraphs): drawing a wave's numbers from the seed, and
 * writing its answers the way she types them (a phase shift with its direction, a range, a family of x-values).
 */
import type { Rng } from '@/content/rng'
import {
  exactAscii,
  exactDiv,
  exactNeg,
  exactNum,
  exactSay,
  exactTex,
  exactText,
  familyText,
  isZero,
  q,
  qAbs,
  tx,
  waveInsideText,
  type Q,
  type TrigExact,
  type Wave,
  type XFamily,
} from '@/engine/trig'
import { LogSkip } from '../explog/text'

export const qText = (v: Q): string => (v.d === 1 ? String(v.n) : `${v.n}/${v.d}`)
export const qSay = (v: Q): string => qText(v).replace(/-/g, '−')
export const qTex = (v: Q): string => (v.d === 1 ? String(v.n) : `${v.n < 0 ? '-' : ''}\\frac{${Math.abs(v.n)}}{${v.d}}`)
export const exactOfQ = (v: Q): TrigExact => tx(v)

/** An amplitude-like coefficient: a whole number or a half, negative with probability `negative`. */
export function drawA(rng: Rng, pool: readonly [number, number][], negative: number): Q {
  const [n, d] = rng.pick(pool)
  return q(rng.chance(negative) ? -n : n, d)
}

/** B: a rational (2, 1/2, 2/3 …) or, with probability `piChance`, a rational times π (π/2 …). */
export function drawB(rng: Rng, rational: readonly [number, number][], withPi: readonly [number, number][], piChance: number): TrigExact {
  if (rng.chance(piChance)) {
    const [n, d] = rng.pick(withPi)
    return tx(q(n, d), 1, 1)
  }
  const [n, d] = rng.pick(rational)
  return tx(q(n, d))
}

/** The number subtracted from Bx (a multiple of π, never zero): ±π/6, ±π/4, ±π/3, ±π/2, ±2π/3, ±3π/4, ±π … */
export function drawInner(rng: Rng): TrigExact {
  const [n, d] = rng.pick([
    [1, 6],
    [1, 4],
    [1, 3],
    [1, 2],
    [1, 2],
    [2, 3],
    [3, 4],
    [5, 6],
    [1, 1],
    [3, 2],
    [5, 4],
    [4, 3],
  ] as const)
  return tx(q(rng.chance(0.5) ? -n : n, d), 1, 1)
}

/** The phase shift C from the number subtracted from Bx: C = (BC)/B. Redrawn when it is not a tidy number. */
export function shiftOf(B: TrigExact, inner: TrigExact): TrigExact {
  const C = exactDiv(inner, B)
  if (C.root !== 1 || C.c.d > 24 || Math.abs(C.c.n) > 30) throw new LogSkip('an untidy phase shift')
  return C
}

const dirWord = (v: TrigExact) => (exactNum(v) < 0 ? 'left' : 'right')
const size = (v: TrigExact) => (exactNum(v) < 0 ? exactNeg(v) : v)

/** A phase shift as she would type it: "π/4 right", "π/3 left", "none". */
export function shiftText(C: TrigExact): string {
  if (isZero(C)) return 'none'
  return `${exactText(size(C))} ${dirWord(C)}`
}

/** Every spelling of the shift that grades right. */
export function shiftForms(C: TrigExact): string[] {
  if (isZero(C)) return ['no phase shift', '0']
  const s = size(C)
  const t = exactText(s)
  const a = exactAscii(s)
  const d = dirWord(C)
  const forms = [`${t} to the ${d}`, `${d} ${t}`, `${a} ${d}`, exactText(C)]
  if (exactNum(C) < 0) forms.push(exactAscii(C))
  return [...new Set(forms)]
}

/** For a sentence: "π/4 to the right". */
export function shiftSay(C: TrigExact): string {
  return isZero(C) ? 'none' : `${exactSay(size(C))} to the ${dirWord(C)}`
}

export function shiftTex(C: TrigExact): string {
  return isZero(C) ? '\\text{none}' : `${exactTex(size(C))}\\text{ to the ${dirWord(C)}}`
}

/** A range as she would type it, and its other spellings. */
export function rangeForms(text: string): string[] {
  const out = [text.replace(/-/g, '−'), text.replace(/∞/g, 'inf').replace(/∪/g, 'U')]
  const band = /^\[(-?[\d/]+), (-?[\d/]+)\]$/.exec(text)
  if (band) out.push(`${band[1]} <= y <= ${band[2]}`)
  return [...new Set(out.filter((f) => f !== text))]
}

/** A range's KaTeX: [−2, 4], (−∞, −1] ∪ [3, ∞). */
export function rangeTex(text: string): string {
  return text
    .replace(/(-?)(\d+)\/(\d+)/g, (_m, s: string, n: string, d: string) => `${s}\\frac{${n}}{${d}}`)
    .replace(/∞/g, '\\infty')
    .replace(/∪/g, '\\cup')
}

/** A family as she would type it, its other spellings, and its first members (for the leak checks). */
export function familyForms(f: XFamily): { text: string; forms: string[]; leak: string[] } {
  const text = familyText(f)
  // The family without "x =" grades right too; a bare "k" is left out of the spellings (every hint says "k").
  const bare = text.replace(/^x = /, '')
  const forms = [...(/[\dπ]/.test(bare) ? [bare] : []), familyText(f, 'n'), text.replace(/π/g, 'pi')]
  const second = exactText(tx(q(f.base.c.n * f.step.c.d + f.step.c.n * f.base.c.d, f.base.c.d * f.step.c.d), 1, f.step.pi))
  const members = [isZero(f.base) ? '0' : exactText(f.base), second]
  const leak = members.flatMap((v) => [v, `x = ${v}`])
  return { text, forms: [...new Set(forms.filter((x) => x !== text))], leak }
}

export const absQ = qAbs

/**
 * The wave as the grapher reads it (Graph it): sec, csc and cot as A over cos, sin and tan, π as pi.
 * "3sin(2x - pi/2) + 1", "2/cos(3x - pi) + 1".
 */
export function graphItText(w: Wave): string {
  const inside = waveInsideText(w, 'expanded').replace(/π/g, 'pi')
  const d = w.D.n === 0 ? '' : w.D.n > 0 ? ` + ${qText(w.D)}` : ` - ${qText(qAbs(w.D))}`
  const a = w.A
  const aAbs = qAbs(a)
  const sign = a.n < 0 ? '-' : ''
  const base: Record<string, string> = { csc: 'sin', sec: 'cos', cot: 'tan' }
  if (base[w.fn]) return `${sign}${aAbs.d === 1 ? aAbs.n : `(${qText(aAbs)})`}/${base[w.fn]}(${inside})${d}`
  const coef = aAbs.n === 1 && aAbs.d === 1 ? sign : `${sign}${aAbs.d === 1 ? aAbs.n : `(${qText(aAbs)})`}`
  return `${coef}${w.fn}(${inside})${d}`
}
