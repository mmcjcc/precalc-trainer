/**
 * The graders of the optimization core: an equation part (the secondary equation, the primary equation, or the final
 * equation in one variable) and a number part (a dimension, a price, the largest area). Every equivalent equation and
 * every exact form of the number is right; a named slip is one of the template's traps for this problem, matched by
 * value; a check that cannot count (unreadable, the wrong kind of equation for the box, a unit of the wrong kind, a
 * rounding the problem did not ask for) is `invalid` and says what to fix without stating the answer.
 */
import type { ErrorPatternId } from '@/shared/types'
import { q, qEq, type Q } from '../trig/rational'
import { degenerate } from './equiv'
import { profileOf, profilePoints, sameProfile, type EquationProfile } from './profile'
import { readOptEquation, readOptNumber, type OptUnits } from './read'
import type { OptDomain, OptGrade, OptVar } from './types'

const correct = (message: string, route?: OptVar): OptGrade => (route ? { verdict: 'correct', message, route } : { verdict: 'correct', message })
const mistake = (id: ErrorPatternId, witness: string): OptGrade => ({ verdict: 'mistake', mistake: id, witness })
const wrong = (message: string): OptGrade => ({ verdict: 'wrong', message })
const invalid = (message: string): OptGrade => ({ verdict: 'invalid', message })

// ---------------------------------------------------------------------------
// Equations
// ---------------------------------------------------------------------------

/** Which equation a part asks for. */
export type OptEquationPart = 'constraint' | 'primary' | 'final'

export interface OptEquationSpec {
  part: OptEquationPart
  /** The quantity's letter, as the problem writes it: 'A', 'P', 'R', 'S'. */
  quantity: string
  /** The right equation, app syntax. For a final equation, the right one in x. */
  target: string
  /** For a final equation, the right one in y (she may put x in terms of y instead). */
  targetY?: string
  domain: OptDomain
  /** What a right answer is told, per route (the content's sentence). */
  rightMessage?: string
}

/** A slip's equation for this problem, as she would type it, and the sentence about it. */
export interface OptEquationTrap {
  id: ErrorPatternId
  equation: string
  witness: string
}

/** A read equation's profile, or why it could not be read. Kept per text, quantity and domain (a problem's own). */
type Profiled = { ok: true; profile: EquationProfile } | { ok: false; message: string }

const PROFILES = new Map<string, Profiled>()

function profiled(text: string, quantity: string, domain: OptDomain): Profiled {
  const key = `${quantity}|${domain.x.join(',')}|${domain.y.join(',')}|${text}`
  const hit = PROFILES.get(key)
  if (hit) return hit
  const r = readOptEquation(text, quantity)
  const out: Profiled = r.ok ? { ok: true, profile: profileOf(r, profilePoints(domain)) } : { ok: false, message: r.message }
  if (PROFILES.size > 20000) PROFILES.clear()
  PROFILES.set(key, out)
  return out
}

/** The problem's own equations (the right one and the slips'), read and profiled once per problem. */
function ownProfile(text: string, quantity: string, domain: OptDomain): EquationProfile {
  const p = profiled(text, quantity, domain)
  if (!p.ok) throw new Error(`the problem's own equation "${text}" cannot be read: ${p.message}`)
  return p.profile
}

/** The variable a final equation is written in (for the flow to pick the next parts), or null when it is not one. */
export function finalRoute(typed: string, quantity: string, domain: OptDomain): OptVar | null {
  const her = profiled(typed.trim(), quantity, domain)
  if (!her.ok) return null
  const r = her.profile.route
  return r === 'x' || r === 'y' ? r : null
}

export function gradeOptEquation(spec: OptEquationSpec, typed: string, traps: readonly OptEquationTrap[]): OptGrade {
  const read = profiled(typed.trim(), spec.quantity, spec.domain)
  if (!read.ok) return invalid(read.message)
  const Q = spec.quantity
  const her = read.profile
  const own = (text: string) => ownProfile(text, Q, spec.domain)
  const message = spec.rightMessage ?? 'Right.'

  if (spec.part === 'final') {
    const route = her.route
    if (route === null) {
      if (!her.hasQuantity) return invalid(`The final equation says what ${Q} is: start it with ${Q} = and write a formula in one variable.`)
      return invalid(`Solve for ${Q}: write ${Q} = a formula in one variable.`)
    }
    if (route === 'both') return invalid(`The final equation has one variable. Solve the secondary equation for one letter and put it into the primary equation, so only x (or only y) is left.`)
    if (route === 'none') return invalid(`The final equation is ${Q} as a formula in x (or in y), not a number.`)
    if (sameProfile(her, own(route === 'x' ? spec.target : (spec.targetY ?? spec.target)))) return correct(message, route)
    for (const trap of traps) {
      const t = own(trap.equation)
      if (t.route === route && sameProfile(her, t)) return mistake(trap.id, trap.witness)
    }
    return wrong(`That is not what the primary equation becomes with the secondary equation put in. Check the substitution, then every term as you multiply out.`)
  }

  if (sameProfile(her, own(spec.target))) return correct(message)
  for (const trap of traps) if (sameProfile(her, own(trap.equation))) return mistake(trap.id, trap.witness)

  if (spec.part === 'constraint') {
    if (her.hasQuantity) return invalid(`The secondary equation ties x and y together, with no ${Q} in it: it is the condition the problem gives (the fencing, the sales, or the numbers).`)
    if (her.linear && degenerate(her.linear) === 'identity') return invalid('That equation is true for every x and y. The secondary equation ties x and y together.')
    return wrong('That is not the condition this problem gives. Check each term against the figure or the words.')
  }

  // primary
  if (!her.hasQuantity) return invalid(`The primary equation says what ${Q} is: start it with ${Q} = and write it with x and y.`)
  if (her.route === null) return invalid(`Solve for ${Q}: write ${Q} = a formula in x and y.`)
  if (her.route !== 'both') {
    // One variable (or none): not the primary equation. With the secondary put in, it is the next part.
    return invalid(`The primary equation is ${Q} written with both x and y. Putting the secondary equation in comes next: that is the final equation.`)
  }
  return wrong(`That is not the ${Q} this problem asks about. Check what is being made largest (or smallest), and how many of it there are.`)
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** What kind of quantity a number part asks for, which decides the units it may carry. */
export type OptDimension = 'length' | 'area' | 'money' | 'count' | 'none'

export interface OptNumberSpec {
  /** The right value, exactly. */
  value: Q
  /** Decimal places the problem asks to round to; null when the answer is exact (a fraction is fine). */
  places: number | null
  dim: OptDimension
  /** An area has to carry its square unit (the worksheet asks for units). */
  unitRequired?: boolean
  /** The box's letter ('x', 'y', 'A', 'R'): another letter written in front ("y =" in the x box) is a note. */
  name: string
  units: OptUnits
  /** The box's words for the notes: "x", "the largest area". */
  what: string
  /** The square unit in words for the unit notes: "square feet". */
  areaWords?: string
  /** The length unit in words: "feet". */
  lengthWords?: string
  rightMessage?: string
}

export interface OptNumberTrap {
  id: ErrorPatternId
  /** The slip's value on this problem. */
  value: Q
  witness: string
}

/** Parse "100/3", "-125", "2.5", "125 ft^2" into an exact value (the content stores answers and slips this way). */
export function exactFromText(text: string, units: OptUnits = {}): Q {
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(text.trim())
  if (m) return q(Number(m[1]), m[2] ? Number(m[2]) : 1)
  const r = readOptNumber(text, units)
  if (!r.ok || !r.exact) throw new Error(`not an exact number: ${text}`)
  return r.exact
}

const num = (v: Q) => v.n / v.d

function within(value: number, target: number, places: number): boolean {
  return Math.abs(value - target) <= 0.5 * 10 ** -places + 1e-9 * Math.max(1, Math.abs(target))
}

/** The one trap her number is (exactly, or at her own rounding); null when none fits, or more than one could. */
function trapFor(traps: readonly OptNumberTrap[], exact: Q | null, value: number, places: number | null): OptNumberTrap | null {
  if (exact) {
    const hit = traps.find((t) => qEq(t.value, exact))
    if (hit) return hit
  }
  if (places === null) {
    // Arithmetic she typed that is not exact (a root, a long decimal): the value itself.
    const hits = traps.filter((t) => Math.abs(num(t.value) - value) <= 1e-9 * Math.max(1, Math.abs(value)))
    return hits.length === 1 ? hits[0]! : null
  }
  const hits = traps.filter((t) => within(value, num(t.value), places))
  return hits.length === 1 ? hits[0]! : null
}

export function gradeOptNumber(spec: OptNumberSpec, typed: string, traps: readonly OptNumberTrap[]): OptGrade {
  const her = readOptNumber(typed, spec.units)
  if (!her.ok) return invalid(her.message)
  // What is written around the number: another letter in front, or a unit of the wrong kind. These only matter when
  // the number itself is right (or rounded): a named slip or a wrong number is graded as it is.
  const u = her.unit
  let form: string | null = null
  if (her.name && her.name.toLowerCase() !== spec.name.toLowerCase()) form = `This box is for ${spec.what}. Write its value here (or ${spec.name} = the value).`
  else if (spec.dim === 'length' && u === 'area') form = `${capital(spec.what)} is a length, so its unit is ${spec.lengthWords ?? 'a length unit'}, not ${spec.areaWords ?? 'square units'}.`
  else if (spec.dim === 'area' && u === 'length') form = `An area is measured in square units: ${spec.areaWords ?? 'square units'}, not ${spec.lengthWords ?? 'a length unit'}.`
  else if (spec.dim === 'area' && u === null && spec.unitRequired) form = `Give the units with the area: ${spec.areaWords ?? 'square units'}.`
  else if ((spec.dim === 'length' || spec.dim === 'area') && (u === 'money' || u === 'count')) form = `That unit does not fit ${spec.what}.`
  else if (spec.dim === 'money' && (u === 'length' || u === 'area' || u === 'count')) form = `${capital(spec.what)} is an amount of money: dollars.`
  else if (spec.dim === 'count' && (u === 'length' || u === 'area' || u === 'money')) form = `${capital(spec.what)} is a count, not an amount of money or a length.`
  else if (spec.dim === 'none' && u !== null) form = 'These are plain numbers, with no unit.'

  const answer = spec.value
  const target = num(answer)
  const message = spec.rightMessage ?? 'Right.'
  const right =
    (her.exact !== null && qEq(her.exact, answer)) ||
    (her.exact === null && Math.abs(her.value - target) <= 1e-9 * Math.max(1, Math.abs(target))) ||
    (spec.places !== null && her.places !== null && her.places >= spec.places && within(her.value, target, spec.places))
  if (right) return form ? invalid(form) : correct(message)
  if (spec.places !== null && her.places !== null && her.places < spec.places && within(her.value, target, her.places)) {
    return invalid(`Keep ${spec.places} decimal place${spec.places === 1 ? '' : 's'}, as the problem asks: your answer is rounded too far.`)
  }
  if (spec.places === null && her.places !== null && her.places > 0 && within(her.value, target, her.places)) {
    return invalid('That is a rounded decimal. This problem keeps exact values: write the fraction, or a mixed number.')
  }
  if (her.places !== null && her.places >= 3 && Math.abs(her.value - target) <= 1e-3 * Math.max(1, Math.abs(target))) {
    return invalid('That is close, but it is a calculator’s estimate, not the exact value. Work it out exactly (a fraction is fine).')
  }
  const trap = trapFor(traps, her.exact, her.value, her.places)
  if (trap) return mistake(trap.id, trap.witness)
  return wrong('That does not match this problem. Check the equation it comes from and each number you put in.')
}

function capital(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}
