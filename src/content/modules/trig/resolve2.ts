/**
 * Test helper (imported by tests only): the second half's problems worked out again from what she sees, with Math and
 * this file's own reading of the words: the figure's labels and where they sit (which corner has the right angle,
 * which the marked angle, which side a label is on), the prompt's numbers and rounding, each part's own label. Nothing
 * here asks the generators or the trig core for an answer.
 */
import type { TrigAnswer, TrigPart, TrigTriangleSpec } from '@/content/types'
import { plain } from './text'

const RAD = Math.PI / 180

/** The number an answer names, by a pattern of its own: "-12/13", "5√3", "2√13/13", "18.8", "4π/3". */
export function numberOf2(text: string): number {
  const t = text.trim().replace(/[−–]/g, '-')
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  const mt = /^(-?)(\d*)(?:√(\d+))?(π)?(?:\/(\d+))?$/.exec(t)
  if (!mt || (!mt[2] && !mt[3] && !mt[4])) return Number.NaN
  const sign = mt[1] ? -1 : 1
  const coef = mt[2] ? Number(mt[2]) : 1
  const root = mt[3] ? Math.sqrt(Number(mt[3])) : 1
  const pi = mt[4] ? Math.PI : 1
  const den = mt[5] ? Number(mt[5]) : 1
  return (sign * coef * root * pi) / den
}

/** A label's number: "20 ft" is 20, "4√3" is 4√3; a letter is NaN. */
const labelNumber = (label: string) => numberOf2(label.replace(/\s*[a-z]+$/i, ''))

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))

function fn6(fn: string, t: number): number {
  switch (fn) {
    case 'sin':
      return Math.sin(t)
    case 'cos':
      return Math.cos(t)
    case 'tan':
      return Math.tan(t)
    case 'csc':
      return 1 / Math.sin(t)
    case 'sec':
      return 1 / Math.cos(t)
    default:
      return Math.cos(t) / Math.sin(t)
  }
}

/** The triangle's angle at each corner, in degrees, from the figure's own marks (the right angle, labelled angles). */
function cornerAngles(tri: TrigTriangleSpec): Record<string, number> | null {
  const out: Record<string, number> = { [tri.right]: 90 }
  for (const a of tri.angles) {
    const v = Number(/^(\d+(?:\.\d+)?)°$/.exec(a.label)?.[1] ?? Number.NaN)
    if (!Number.isFinite(v)) continue
    // From the horizontal at a top corner: the triangle's angle there is the rest of the right angle.
    out[a.at] = a.fromHorizontal ? 90 - v : v
  }
  const ids = tri.corners.map((c) => c.id)
  const known = ids.filter((id) => out[id] !== undefined)
  if (known.length === 2) {
    const missing = ids.find((id) => out[id] === undefined)!
    out[missing] = 180 - known.reduce((s, id) => s + out[id]!, 0)
  }
  return ids.every((id) => out[id] !== undefined) ? out : null
}

/** The corner across from a side. */
const across = (tri: TrigTriangleSpec, from: string, to: string) => tri.corners.find((c) => c.id !== from && c.id !== to)!.id

/** Places asked, from the prompt's or the question's words. */
function placesOf(words: string): number | null {
  if (/nearest tenth/.test(words)) return 1
  if (/nearest hundredth/.test(words)) return 2
  if (/nearest (whole number|foot|meter|centimeter|inch)/.test(words)) return 0
  return null
}

function expect(bad: string[], part: TrigPart, want: number, places?: number) {
  const got = numberOf2(part.answerText)
  const ok = places === undefined ? close(got, want) : Math.abs(got - Number(want.toFixed(places))) < 1e-9
  if (!ok) bad.push(`${part.id}: ${part.answerText} but ${places === undefined ? want : want.toFixed(places)}`)
}

/** A right-triangle problem again from the figure and the words. */
function resolveTriangle(a: TrigAnswer): string[] {
  const bad: string[] = []
  const tri = a.figure.triangle
  if (!tri) return ['no triangle in the figure']
  const words = plain(a.prompt)
  const labelOf = (from: string, to: string) => tri.sides.find((s) => (s.from === from && s.to === to) || (s.from === to && s.to === from))
  if (a.question === 'ratios') {
    // θ's corner, the right angle, and the sides named from θ by where they are.
    const V = tri.angles.find((x) => x.label === 'θ')!.at
    const R = tri.right
    const W = tri.corners.find((c) => c.id !== V && c.id !== R)!.id
    const len: Record<'opp' | 'adj' | 'hyp', number> = { opp: Number.NaN, adj: Number.NaN, hyp: Number.NaN }
    const sideOf: Record<'opp' | 'adj' | 'hyp', [string, string]> = { opp: [R, W], adj: [V, R], hyp: [V, W] }
    let unknown: 'opp' | 'adj' | 'hyp' | null = null
    for (const role of ['opp', 'adj', 'hyp'] as const) {
      const l = labelOf(...sideOf[role])
      if (!l || l.after) unknown = role
      else len[role] = labelNumber(l.label)
    }
    if (!unknown) return ['no unknown side']
    len[unknown] = unknown === 'hyp' ? Math.hypot(len.opp, len.adj) : Math.sqrt(len.hyp ** 2 - (unknown === 'opp' ? len.adj : len.opp) ** 2)
    const ratio: Record<string, number> = { sin: len.opp / len.hyp, cos: len.adj / len.hyp, tan: len.opp / len.adj, csc: len.hyp / len.opp, sec: len.hyp / len.adj, cot: len.adj / len.opp }
    for (const part of a.stages) expect(bad, part, part.id === 'side' ? len[unknown] : ratio[part.id]!)
    return bad
  }
  const angles = cornerAngles(tri)
  if (a.question === 'special' || a.question === 'side') {
    if (!angles) return ['the figure’s angles do not settle the triangle']
    // Law of sines in a right triangle: each side is the hypotenuse times the sine of the angle across from it.
    const given = tri.sides.find((s) => Number.isFinite(labelNumber(s.label)))!
    const hyp = labelNumber(given.label) / Math.sin(angles[across(tri, given.from, given.to)]! * RAD)
    for (const part of a.stages) {
      const lettered = tri.sides.find((s) => s.label === part.id)
      if (!lettered) {
        bad.push(`${part.id}: no side is labelled ${part.id}`)
        continue
      }
      const want = hyp * Math.sin(angles[across(tri, lettered.from, lettered.to)]! * RAD)
      if (a.question === 'special') expect(bad, part, want)
      else expect(bad, part, want, placesOf(words) ?? Number.NaN)
    }
    return bad
  }
  // rt.angle: θ from the two labelled sides, at θ's corner (or from the horizontal at the top).
  const mark = tri.angles.find((x) => x.label === 'θ')!
  const V = mark.at
  const R = tri.right
  const W = tri.corners.find((c) => c.id !== V && c.id !== R)!.id
  const lengthOf = (from: string, to: string) => {
    const l = labelOf(from, to)
    return l ? labelNumber(l.label) : Number.NaN
  }
  const opp = lengthOf(R, W)
  const adj = lengthOf(V, R)
  const hyp = lengthOf(V, W)
  let atV: number
  if (Number.isFinite(opp) && Number.isFinite(adj)) atV = Math.atan(opp / adj) / RAD
  else if (Number.isFinite(opp) && Number.isFinite(hyp)) atV = Math.asin(opp / hyp) / RAD
  else atV = Math.acos(adj / hyp) / RAD
  const theta = mark.fromHorizontal ? 90 - atV : atV
  for (const part of a.stages) expect(bad, part, theta, 1)
  return bad
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

/** uc.given again from the prompt's words: θ from the value and where it is, then every part at θ. */
function resolveGiven(a: TrigAnswer): string[] {
  const words = plain(a.prompt).replace(/−/g, '-')
  const m = /^(sin|cos|tan|csc|sec|cot) θ = (-?[\d/]+) and (.+?)\. For the point on the terminal side with (.+?), find/.exec(words)
  if (!m) return [`cannot read: ${words}`]
  const fn = m[1]!
  const value = numberOf2(m[2]!)
  const where = m[3]!
  // Where θ is: a quadrant by name, an interval, or another function's sign.
  let quadrants = [1, 2, 3, 4]
  const named = /Quadrant (I|II|III|IV)\b/.exec(where)
  if (named) quadrants = [ROMAN[named[1]!]!]
  const interval = /^(.+) < θ < (.+)$/.exec(where)
  if (interval) {
    const lo = interval[1]!.includes('π') || interval[1] === '0' ? numberOf2(interval[1]!.replace('°', '')) / RAD : Number(interval[1]!.replace('°', ''))
    quadrants = [Math.round(lo / 90) + 1]
  }
  const sign = /^(sin|cos|tan|csc|sec|cot) θ ([<>]) 0$/.exec(where)
  // Every θ in one turn with fn(θ) = value, kept to the quadrants allowed and the sign condition.
  const base = fn === 'csc' || fn === 'sin' ? 'sin' : fn === 'sec' || fn === 'cos' ? 'cos' : 'tan'
  const v = fn === 'csc' || fn === 'sec' || fn === 'cot' ? 1 / value : value
  const t0 = base === 'sin' ? Math.asin(v) : base === 'cos' ? Math.acos(v) : Math.atan(v)
  const candidates = [t0, Math.PI - t0, Math.PI + t0, -t0, 2 * Math.PI - t0, t0 + 2 * Math.PI].map((t) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
  const quadrantOf = (t: number) => Math.floor(t / (Math.PI / 2)) + 1
  const theta = candidates.find((t) => close(fn6(fn, t), value, 1e-9) && quadrants.includes(quadrantOf(t)) && (!sign || (sign[2] === '>' ? fn6(sign[1]!, t) > 0 : fn6(sign[1]!, t) < 0)))
  if (theta === undefined) return [`no θ for ${words}`]
  const bad: string[] = []
  const pair = m[4]!
  const rGiven = /r = (\d+)/.exec(pair)
  const abs = /\|x\| = (\d+) and \|y\| = (\d+)/.exec(pair)
  for (const part of a.stages) {
    if (part.id === 'x' && rGiven) expect(bad, part, Number(rGiven[1]) * Math.cos(theta))
    else if (part.id === 'y' && rGiven) expect(bad, part, Number(rGiven[1]) * Math.sin(theta))
    else if (part.id === 'r' && abs) expect(bad, part, Math.hypot(Number(abs[1]), Number(abs[2])))
    else expect(bad, part, fn6(part.id, theta))
  }
  return bad
}

/** uc.solve again: every whole degree of one turn tried with Math against the prompt's equation. */
function resolveSolve(a: TrigAnswer): string[] {
  const words = plain(a.prompt).replace(/−/g, '-')
  const m = /^Solve (sin|cos|tan|csc|sec|cot) θ = (\S+) for θ in \[0°?, (360°|2π)\)/.exec(words)
  if (!m) return [`cannot read: ${words}`]
  const fn = m[1]!
  const value = numberOf2(m[2]!)
  const unit = m[3] === '2π' ? 'rad' : 'deg'
  const want: number[] = []
  for (let d = 0; d < 360; d++) {
    const v = fn6(fn, d * RAD)
    if (Number.isFinite(v) && Math.abs(v) < 1e7 && close(v, value, 1e-9)) want.push(d)
  }
  const part = a.stages[0]!
  const got = part.answerText.split(/\s*,\s*/).map((t) => (unit === 'rad' ? Math.round(numberOf2(t) / RAD) : numberOf2(t)))
  if (got.join(',') !== want.join(',')) return [`solutions: ${part.answerText} but ${want.join(', ')} degrees`]
  if (unit === 'rad' && !part.answerText.includes('π')) return ['radians without π']
  return []
}

/** The second half's re-solve, or null for a first-half problem. */
export function resolveSecondHalf(a: TrigAnswer): string[] | null {
  if (a.type === 'rightTriangle') return resolveTriangle(a)
  if (a.type === 'unitCircle' && a.question === 'given') return resolveGiven(a)
  if (a.type === 'unitCircle' && a.question === 'solve') return resolveSolve(a)
  return null
}
