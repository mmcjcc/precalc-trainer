/**
 * Operations with functions: evaluate from a table or two graphs, or build a formula.
 * A named mistake is whatever slip, computed for THIS problem, equals her answer. A slip equal to the
 * right answer is dropped. Two slips that land on the same value are both kept for naming (the more
 * likely one wins) and neither is a seed's promised trap.
 */
import type { FunctionOpsOp } from '@/content/types'
import { polyExpr } from '@/content/modules/fnExpr'
import { composeText, evaluateExpr, gradeComposition, parseExpression, parseValueAnswer, polynomialCoefficients } from '@/engine'
import { OP_PRIORITY, opCall, type OpsMistakeId } from './rules'

export type { OpsMistakeId } from './rules'
export { OP_PRIORITY }

export interface OpsPoint {
  x: number
  y: number
}

/** The data a problem is graded from. `at` is app syntax ("-5" or "x"). */
export interface OpsData {
  question: 'table' | 'graph' | 'formula'
  op: FunctionOpsOp
  at: string
  xs?: number[]
  fv?: number[]
  gv?: number[]
  fPts?: OpsPoint[]
  gPts?: OpsPoint[]
  f?: string
  g?: string
}

export interface OpsSlip {
  id: OpsMistakeId
  /** A number, or a formula in app syntax. */
  value: number | string
  witness: string
}

export type OpsGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'mistake'; mistake: OpsMistakeId; witness: string }

export interface OpsAssessment {
  /** A number, a formula, or undefined when the asked value does not exist. */
  official: number | string | undefined
  /** "11", "undefined", or the formula. */
  officialText: string
  slips: OpsSlip[]
  reveal: string[]
}

const COMPOSE = new Set<FunctionOpsOp>(['fog', 'gof', 'fof', 'fogog'])
const PROBES = [7, -7, 9, -9, 11, 6, -6, 13, 1, -1, 0, 2, 3, 4, 5, 17]

type FnId = 'f' | 'g'

interface Read {
  fn: FnId
  x: number
  y: number
  swapped: boolean
  flipped: boolean
}

interface Run {
  value: number | undefined
  reads: Read[]
  missing?: { fn: FnId; x: number }
  denomZero: boolean
}

interface Mut {
  signN?: number
  swapN?: number
  fillMissing?: boolean
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

function snap(y: number): number {
  const r = Math.round(y)
  if (Math.abs(y - r) < 1e-8) return r
  const h = Math.round(y * 2) / 2
  if (Math.abs(y - h) < 1e-8) return h
  return y
}

/** Unicode minus for a sentence. Grader text the student types stays ASCII. */
export function showNum(n: number): string {
  const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
  return s.replace(/-/g, '−')
}

export function showExpr(text: string): string {
  return text.replace(/-/g, '−')
}

function asciiNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  const t = Math.round(n * 1000) / 1000
  return String(t)
}

function other(fn: FnId): FnId {
  return fn === 'f' ? 'g' : 'f'
}

function parenNeg(shown: string): string {
  return shown.startsWith('−') || shown.startsWith('-') ? `(${shown})` : shown
}

// ---------------------------------------------------------------------------
// Looking up f and g
// ---------------------------------------------------------------------------

function tableMap(xs: number[] | undefined, ys: number[] | undefined): Map<number, number> {
  const m = new Map<number, number>()
  if (!xs || !ys) return m
  for (let i = 0; i < xs.length; i++) m.set(xs[i]!, ys[i]!)
  return m
}

function valueOnCurve(pts: readonly OpsPoint[], x: number): number | undefined {
  if (pts.length === 0) return undefined
  const lo = pts[0]!.x
  const hi = pts[pts.length - 1]!.x
  if (x < lo - 1e-9 || x > hi + 1e-9) return undefined
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    if (x < a.x - 1e-9 || x > b.x + 1e-9) continue
    if (Math.abs(b.x - a.x) < 1e-12) return snap(a.y)
    const t = (x - a.x) / (b.x - a.x)
    return snap(a.y + t * (b.y - a.y))
  }
  return undefined
}

function lookup(data: OpsData, fn: FnId, x: number): number | undefined {
  if (data.question === 'table') {
    if (Math.abs(x - Math.round(x)) > 1e-9) return undefined
    const map = fn === 'f' ? tableMap(data.xs, data.fv) : tableMap(data.xs, data.gv)
    return map.get(Math.round(x))
  }
  const pts = fn === 'f' ? data.fPts : data.gPts
  return pts ? valueOnCurve(pts, x) : undefined
}

function domainEnds(data: OpsData, fn: FnId): { lo: number; hi: number } | null {
  const pts = fn === 'f' ? data.fPts : data.gPts
  if (!pts || pts.length === 0) return null
  return { lo: pts[0]!.x, hi: pts[pts.length - 1]!.x }
}

function missingReason(data: OpsData, fn: FnId, x: number): string {
  if (data.question === 'table') return `x = ${showNum(x)} is not in the table`
  const ends = domainEnds(data, fn)
  if (!ends) return 'no point'
  if (x < ends.lo) return `${fn} starts at x = ${showNum(ends.lo)}`
  if (x > ends.hi) return `${fn} ends at x = ${showNum(ends.hi)}`
  return 'no point'
}

function run(data: OpsData, op: FunctionOpsOp, a: number, mut: Mut = {}): Run {
  const reads: Read[] = []
  let missing: { fn: FnId; x: number } | undefined
  let filled = false
  const read = (fn: FnId, x: number): number | undefined => {
    let used: FnId = fn
    let y = lookup(data, used, x)
    let swapped = false
    if (y === undefined && mut.fillMissing && !filled) {
      filled = true
      const alt = lookup(data, other(fn), x)
      if (alt === undefined) {
        missing = { fn, x }
        return undefined
      }
      y = alt
      used = other(fn)
      swapped = true
    }
    if (y === undefined) {
      missing = { fn, x }
      return undefined
    }
    const n = reads.length + 1
    if (mut.swapN === n) {
      const alt = lookup(data, other(used), x)
      if (alt === undefined) {
        missing = { fn: other(used), x }
        return undefined
      }
      y = alt
      used = other(used)
      swapped = true
    }
    let flipped = false
    if (mut.signN === n && y !== 0) {
      y = -y
      flipped = true
    }
    reads.push({ fn: used, x, y, swapped, flipped })
    return y
  }

  const need = (v: number | undefined): v is number => v !== undefined
  let value: number | undefined
  let denomZero = false
  const f = (x: number) => read('f', x)
  const g = (x: number) => read('g', x)
  switch (op) {
    case 'f+g': {
      const fv = f(a)
      const gv = g(a)
      if (need(fv) && need(gv)) value = fv + gv
      break
    }
    case 'f-g': {
      const fv = f(a)
      const gv = g(a)
      if (need(fv) && need(gv)) value = fv - gv
      break
    }
    case 'g-f': {
      const gv = g(a)
      const fv = f(a)
      if (need(gv) && need(fv)) value = gv - fv
      break
    }
    case 'fg': {
      const fv = f(a)
      const gv = g(a)
      if (need(fv) && need(gv)) value = fv * gv
      break
    }
    case 'gg': {
      const g1 = g(a)
      const g2 = g(a)
      if (need(g1) && need(g2)) value = g1 * g2
      break
    }
    case 'fgf': {
      const f1 = f(a)
      const gv = g(a)
      const f2 = f(a)
      if (need(f1) && need(gv) && need(f2)) value = f1 * gv * f2
      break
    }
    case 'f/g': {
      const fv = f(a)
      const gv = g(a)
      if (need(fv) && need(gv)) {
        if (gv === 0) denomZero = true
        else value = fv / gv
      }
      break
    }
    case 'f+f+g': {
      const f1 = f(a)
      const f2 = f(a)
      const gv = g(a)
      if (need(f1) && need(f2) && need(gv)) value = f1 + f2 + gv
      break
    }
    case 'fog': {
      const inner = g(a)
      if (need(inner)) {
        const outer = f(inner)
        if (need(outer)) value = outer
      }
      break
    }
    case 'gof': {
      const inner = f(a)
      if (need(inner)) {
        const outer = g(inner)
        if (need(outer)) value = outer
      }
      break
    }
    case 'fof': {
      const inner = f(a)
      if (need(inner)) {
        const outer = f(inner)
        if (need(outer)) value = outer
      }
      break
    }
    case 'fogog': {
      const i1 = g(a)
      if (need(i1)) {
        const i2 = g(i1)
        if (need(i2)) {
          const outer = f(i2)
          if (need(outer)) value = outer
        }
      }
      break
    }
  }
  return { value, reads, missing, denomZero }
}

function chain(data: OpsData, fns: readonly FnId[], a: number): number | undefined {
  let x = a
  for (const fn of fns) {
    const y = lookup(data, fn, x)
    if (y === undefined) return undefined
    x = y
  }
  return x
}

// ---------------------------------------------------------------------------
// Value slips and the worked lines
// ---------------------------------------------------------------------------

function sourceWord(data: OpsData): string {
  return data.question === 'graph' ? 'graph' : 'table'
}

function callOf(data: OpsData, atShown: string): string {
  return opCall(data.op, atShown)
}

function atShown(data: OpsData): string {
  if (data.at === 'x') return 'x'
  const n = Number(data.at)
  return Number.isFinite(n) ? showNum(n) : data.at
}

function arith(op: FunctionOpsOp, ys: number[]): string {
  const s = ys.map(showNum)
  const p = (i: number) => parenNeg(s[i] ?? '')
  switch (op) {
    case 'f+g':
      return `${s[0]} + ${p(1)}`
    case 'f-g':
    case 'g-f':
      return `${s[0]} − ${p(1)}`
    case 'fg':
    case 'gg':
      return `${s[0]} · ${p(1)}`
    case 'fgf':
      return `${s[0]} · ${p(1)} · ${p(2)}`
    case 'f/g':
      return `${s[0]} / ${p(1)}`
    case 'f+f+g':
      return `${s[0]} + ${p(1)} + ${p(2)}`
    default:
      return s.join(', ')
  }
}

function revealValue(data: OpsData, result: Run, a: number): string[] {
  const call = callOf(data, atShown(data))
  const src = sourceWord(data)
  if (result.denomZero) {
    const gRead = result.reads.find((r) => r.fn === 'g')
    const gy = gRead ? showNum(gRead.y) : '0'
    return [`g(${showNum(a)}) = ${gy}, so the denominator is 0. ${call} is undefined.`]
  }
  if (result.value === undefined) {
    const miss = result.missing
    if (!miss) return [`${call} is undefined.`]
    return [`${miss.fn}(${showNum(miss.x)}) does not exist (${missingReason(data, miss.fn, miss.x)}), so ${call} is undefined.`]
  }
  const bits = result.reads.map((r, i) => `${r.fn}(${showNum(r.x)}) = ${showNum(r.y)}${i === 0 ? ` (from the ${src})` : ''}`)
  if (COMPOSE.has(data.op)) {
    return [`${bits.join(', then ')}.`, `${call} = ${showNum(result.value)}.`]
  }
  return [`${bits.join(' and ')}, so ${call} = ${arith(data.op, result.reads.map((r) => r.y))} = ${showNum(result.value)}.`]
}

function pushSlip(slips: OpsSlip[], id: OpsMistakeId, value: number | undefined, witness: string, official: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return
  if (official !== undefined && near(value, official)) return
  slips.push({ id, value, witness })
}

function valueSlips(data: OpsData, a: number, official: number | undefined): OpsSlip[] {
  const slips: OpsSlip[] = []
  const call = callOf(data, atShown(data))
  const askedInner: FnId | null = data.op === 'fog' || data.op === 'fogog' ? 'g' : data.op === 'gof' || data.op === 'fof' ? 'f' : null

  if (data.question === 'graph') {
    for (let n = 1; n <= 4; n++) {
      const r = run(data, data.op, a, { signN: n })
      const flipped = r.reads.find((rd) => rd.flipped)
      if (!flipped || r.value === undefined) continue
      const trueY = -flipped.y
      const where = trueY < 0 ? 'below the x-axis, so it is negative' : 'above the x-axis, so it stays positive'
      pushSlip(
        slips,
        'op_sign_flipped',
        r.value,
        `${flipped.fn}(${showNum(flipped.x)}) is ${where}: ${showNum(trueY)}, not ${showNum(flipped.y)}.`,
        official,
      )
    }
  }

  for (let n = 1; n <= 4; n++) {
    const r = run(data, data.op, a, { swapN: n })
    const swapped = r.reads.find((rd) => rd.swapped)
    if (!swapped || r.value === undefined) continue
    const asked = other(swapped.fn)
    const trueY = lookup(data, asked, swapped.x)
    const truth = trueY === undefined ? `${asked}(${showNum(swapped.x)}) does not exist (${missingReason(data, asked, swapped.x)})` : `${asked}(${showNum(swapped.x)}) = ${showNum(trueY)}`
    pushSlip(
      slips,
      'op_wrong_function',
      r.value,
      `That uses ${swapped.fn}(${showNum(swapped.x)}) = ${showNum(swapped.y)} where ${asked} was asked. ${truth}.`,
      official,
    )
  }

  // The asked inside value is missing: using the other function there, then continuing, is wrong-function
  // and not an order reversal (the inside value she was asked for does not exist).
  if (askedInner && lookup(data, askedInner, a) === undefined) {
    const alt = other(askedInner)
    const started = lookup(data, alt, a)
    if (started !== undefined) {
      const reversed = data.op === 'fog' ? chain(data, ['f', 'g'], a) : data.op === 'gof' ? chain(data, ['g', 'f'], a) : data.op === 'fof' ? chain(data, ['g', 'f'], a) : chain(data, ['f', 'g', 'g'], a)
      if (reversed !== undefined) {
        // The function applied right after her first value: the second entry of the chain above.
        const nextFn: FnId = data.op === 'fog' || data.op === 'fogog' ? 'g' : 'f'
        const nextY = lookup(data, nextFn, started)
        const next = nextY === undefined ? '' : `, then ${nextFn}(${showNum(started)}) = ${showNum(nextY)}`
        pushSlip(
          slips,
          'op_wrong_function',
          reversed,
          `${askedInner}(${showNum(a)}) does not exist (${missingReason(data, askedInner, a)}), so that uses ${alt}(${showNum(a)}) = ${showNum(started)}${next}.`,
          official,
        )
      }
      const filled = run(data, data.op, a, { fillMissing: true })
      if (filled.value !== undefined && (reversed === undefined || !near(filled.value, reversed))) {
        pushSlip(
          slips,
          'op_wrong_function',
          filled.value,
          `${askedInner}(${showNum(a)}) does not exist (${missingReason(data, askedInner, a)}), so that uses ${alt}(${showNum(a)}) = ${showNum(started)} and keeps going.`,
          official,
        )
      }
    }
  }

  if (data.op === 'f-g' || data.op === 'g-f') {
    const otherOp: FunctionOpsOp = data.op === 'f-g' ? 'g-f' : 'f-g'
    const r = run(data, otherOp, a)
    if (r.value !== undefined) {
      const fv = lookup(data, 'f', a)
      const gv = lookup(data, 'g', a)
      const asked = data.op === 'g-f' ? 'g − f' : 'f − g'
      const did = data.op === 'g-f' ? 'f − g' : 'g − f'
      const detail =
        official !== undefined && fv !== undefined && gv !== undefined
          ? ` ${showNum(data.op === 'g-f' ? gv : fv)} − ${parenNeg(showNum(data.op === 'g-f' ? fv : gv))} = ${showNum(official)}, not ${showNum(r.value)}.`
          : ''
      pushSlip(slips, 'op_difference_reversed', r.value, `${call} is ${asked}, not ${did}.${detail}`, official)
    }
  }

  if (data.op === 'f/g') {
    const fv = lookup(data, 'f', a)
    const gv = lookup(data, 'g', a)
    if (fv !== undefined && gv !== undefined && fv !== 0) {
      pushSlip(slips, 'op_quotient_flipped', gv / fv, `That is g/f = ${showNum(gv)}/${showNum(fv)} = ${showNum(gv / fv)}. ${call} puts f on top.`, official)
    }
  }

  if (askedInner && lookup(data, askedInner, a) !== undefined) {
    let reversed: number | undefined
    let otherName = ''
    if (data.op === 'fog') {
      reversed = chain(data, ['f', 'g'], a)
      otherName = opCall('gof', atShown(data))
    } else if (data.op === 'gof') {
      reversed = chain(data, ['g', 'f'], a)
      otherName = opCall('fog', atShown(data))
    } else if (data.op === 'fogog') {
      reversed = chain(data, ['f', 'g', 'g'], a)
      otherName = '(g ∘ g ∘ f)(' + atShown(data) + ')'
    }
    if (reversed !== undefined) {
      pushSlip(slips, 'op_order_reversed', reversed, `That is the other order, ${otherName} = ${showNum(reversed)}. ${call} does the inside function first.`, official)
    }
  }

  if (COMPOSE.has(data.op)) {
    const fv = lookup(data, 'f', a)
    const gv = lookup(data, 'g', a)
    if (fv !== undefined && gv !== undefined) {
      pushSlip(slips, 'op_product_for_composition', fv * gv, `That multiplies: ${showNum(fv)} · ${parenNeg(showNum(gv))} = ${showNum(fv * gv)}. ${call} uses the circle, so the inside value goes into the outside function.`, official)
    }
    if (data.op === 'fof' && fv !== undefined) {
      pushSlip(slips, 'op_product_for_composition', fv * fv, `That multiplies f(${showNum(a)}) by itself: ${showNum(fv)} · ${parenNeg(showNum(fv))} = ${showNum(fv * fv)}. ${call} is f of f(${showNum(a)}).`, official)
    }
  }

  if (data.op === 'fg' || data.op === 'gg' || data.op === 'fgf') {
    const fg = chain(data, ['g', 'f'], a)
    const gf = chain(data, ['f', 'g'], a)
    if (fg !== undefined) pushSlip(slips, 'op_composition_for_product', fg, `That is f(g(${showNum(a)})) = ${showNum(fg)}. ${call} has no circle, so it multiplies.`, official)
    if (gf !== undefined && (fg === undefined || !near(gf, fg))) {
      pushSlip(slips, 'op_composition_for_product', gf, `That is g(f(${showNum(a)})) = ${showNum(gf)}. ${call} has no circle, so it multiplies.`, official)
    }
    if (data.op === 'gg') {
      const gg = chain(data, ['g', 'g'], a)
      if (gg !== undefined) pushSlip(slips, 'op_composition_for_product', gg, `That is g(g(${showNum(a)})) = ${showNum(gg)}. ${call} has no circle, so it multiplies g(${showNum(a)}) by itself.`, official)
    }
  }

  return dedupe(slips)
}

function dedupe(slips: OpsSlip[]): OpsSlip[] {
  const out: OpsSlip[] = []
  for (const s of slips) {
    if (out.some((o) => o.id === s.id && sameSlip(o.value, s.value))) continue
    out.push(s)
  }
  return out
}

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

function trimPoly(a: number[]): number[] {
  let n = a.length
  while (n > 1 && a[n - 1] === 0) n--
  return a.slice(0, Math.max(1, n))
}

function intCoeffs(text: string): number[] | null {
  const c = polynomialCoefficients(text)
  if (!c) return null
  const rounded = c.map((v) => (Math.abs(v - Math.round(v)) < 1e-6 ? Math.round(v) : Number.NaN))
  if (rounded.some((v) => Number.isNaN(v))) return null
  return trimPoly(rounded)
}

function polyAdd(a: number[], b: number[]): number[] {
  const n = Math.max(a.length, b.length)
  const o: number[] = []
  for (let i = 0; i < n; i++) o.push((a[i] ?? 0) + (b[i] ?? 0))
  return trimPoly(o)
}

function polySub(a: number[], b: number[]): number[] {
  return polyAdd(a, b.map((c) => -c))
}

function polyScale(a: number[], k: number): number[] {
  return trimPoly(a.map((c) => c * k))
}

function polyMul(a: number[], b: number[]): number[] {
  if (a.length === 0 || b.length === 0) return [0]
  const o = Array<number>(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) o[i + j]! += a[i]! * b[j]!
  return trimPoly(o)
}

function polyCompose(outer: number[], inner: number[]): number[] | null {
  let acc: number[] = [0]
  let power: number[] = [1]
  for (const c of outer) {
    if (c) acc = polyAdd(acc, polyScale(power, c))
    power = polyMul(power, inner)
    if (power.length > 6) return null
  }
  return trimPoly(acc)
}

function samePoly(a: number[], b: number[]): boolean {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > 1e-6) return false
  return true
}

/**
 * Her formula against the expected one. A polynomial match is exact. Otherwise they agree at six or
 * more integers from −8 to 8, skipping points where the expected formula is undefined, so an
 * unsimplified quotient and a cancelled form of it both count.
 */
export function formulaMatches(hers: string, expected: string): boolean {
  const he = polynomialCoefficients(hers)
  const ex = polynomialCoefficients(expected)
  if (he && ex) return samePoly(he, ex)
  let agree = 0
  for (let x = -8; x <= 8; x++) {
    const ev = evaluateExpr(expected, { x })
    if (ev === 'undef') continue
    const hv = evaluateExpr(hers, { x })
    if (hv === 'undef' || !near(hv, ev)) return false
    agree++
  }
  return agree >= 6
}

function sameSlip(a: number | string, b: number | string): boolean {
  if (typeof a === 'number' && typeof b === 'number') return near(a, b)
  if (typeof a === 'string' && typeof b === 'string') return formulaMatches(a, b) || formulaMatches(b, a)
  return false
}

/** Minus reaches only the highest term of `sub`; the lower terms keep the sign they were written with. */
function minusNotDistributed(minuend: number[], sub: number[]): number[] | null {
  const nonzero = sub.filter((c) => c !== 0).length
  if (nonzero < 2) return null
  let hi = sub.length - 1
  while (hi > 0 && sub[hi] === 0) hi--
  const n = Math.max(minuend.length, hi + 1)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const m = minuend[i] ?? 0
    const s = sub[i] ?? 0
    out.push(i === hi ? m - s : m + s)
  }
  return trimPoly(out)
}

/** (px + q)^2 taken as p^2 x^2 + q^2, then the rest of a quadratic outer. q must not be 0. */
function innerNotSquared(outer: number[], inner: number[]): number[] | null {
  if (inner.length !== 2) return null
  const q = inner[0] ?? 0
  const p = inner[1] ?? 0
  if (p === 0 || q === 0) return null
  if (outer.length < 3 || outer.length > 3) return null
  const c = outer[0] ?? 0
  const b = outer[1] ?? 0
  const a = outer[2] ?? 0
  if (a === 0) return null
  return trimPoly([a * q * q + b * q + c, b * p, a * p * p])
}

function quotientText(top: string, bottom: string): string {
  return `(${top})/(${bottom})`
}

function composedText(outerC: number[] | null, innerC: number[] | null, outer: string, inner: string): string | undefined {
  if (outerC && innerC) {
    const p = polyCompose(outerC, innerC)
    if (p) return polyExpr(p)
  }
  return composeText(outer, inner)?.simplified
}

function formulaSlips(data: OpsData, official: string | undefined): OpsSlip[] {
  const f = data.f
  const g = data.g
  if (!f || !g || official === undefined) return []
  const fc = intCoeffs(f)
  const gc = intCoeffs(g)
  const slips: OpsSlip[] = []
  const call = callOf(data, 'x')
  const push = (id: OpsMistakeId, text: string | null, witness: string) => {
    if (!text) return
    if (formulaMatches(text, official) || formulaMatches(official, text)) return
    slips.push({ id, value: text, witness })
  }
  const composed = (outer: string, inner: string, oc: number[] | null, ic: number[] | null): string | null => {
    if (oc && ic) {
      const p = polyCompose(oc, ic)
      if (p) return polyExpr(p)
    }
    return composeText(outer, inner)?.simplified ?? null
  }

  if ((data.op === 'f-g' || data.op === 'g-f') && fc && gc) {
    const rev = data.op === 'f-g' ? polySub(gc, fc) : polySub(fc, gc)
    push('op_difference_reversed', polyExpr(rev), `That is the subtraction the other way around. ${call} = ${showExpr(official)}.`)
    const sub = data.op === 'f-g' ? gc : fc
    const minuend = data.op === 'f-g' ? fc : gc
    const partial = minusNotDistributed(minuend, sub)
    if (partial) {
      const text = polyExpr(partial)
      push('op_minus_not_distributed', text, `The minus sign reached only the first term, giving ${showExpr(text)}. ${call} = ${showExpr(official)}.`)
    }
  }

  if (data.op === 'f/g') {
    push('op_quotient_flipped', quotientText(g, f), `That puts g on top. ${call} puts f on top: ${showExpr(official)}.`)
    push('op_wrong_function', '1', `f/f and g/g both simplify to 1. ${call} uses f on top and g underneath.`)
  }

  if (data.op === 'fog' || data.op === 'gof') {
    const outer = data.op === 'fog' ? f : g
    const inner = data.op === 'fog' ? g : f
    const oc = data.op === 'fog' ? fc : gc
    const ic = data.op === 'fog' ? gc : fc
    const revOuter = data.op === 'fog' ? g : f
    const revInner = data.op === 'fog' ? f : g
    const rev = composed(revOuter, revInner, data.op === 'fog' ? gc : fc, data.op === 'fog' ? fc : gc)
    const otherCall = opCall(data.op === 'fog' ? 'gof' : 'fog', 'x')
    push('op_order_reversed', rev, `That is ${otherCall}, the other order. ${call} = ${showExpr(official)}.`)
    push('op_product_for_composition', `(${f})*(${g})`, `That is f(x) times g(x). ${call} puts the inside function into the outside one.`)
    const ff = composed(f, f, fc, fc)
    const gg = composed(g, g, gc, gc)
    push('op_wrong_function', ff, `That is f of f, using f where both functions belong. ${call} = ${showExpr(official)}.`)
    if (gg && ff && !formulaMatches(gg, ff)) push('op_wrong_function', gg, `That is g of g, using g where both functions belong. ${call} = ${showExpr(official)}.`)
    if (oc && ic) {
      const bad = innerNotSquared(oc, ic)
      if (bad) {
        const q = ic[0] ?? 0
        const p = ic[1] ?? 0
        const wrongSq = polyExpr([q * q, 0, p * p])
        const rightSq = polyExpr([q * q, 2 * p * q, p * p])
        push(
          'op_inner_not_squared',
          polyExpr(bad),
          `The inside was squared term by term: ${showExpr(wrongSq)} instead of ${showExpr(rightSq)}. ${call} = ${showExpr(official)}.`,
        )
      }
    }
    void outer
    void inner
  }

  if (data.op === 'fg' && fc && gc) {
    const fg = composed(f, g, fc, gc)
    const gf = composed(g, f, gc, fc)
    push('op_composition_for_product', fg, `That is f(g(x)). ${call} multiplies f(x) by g(x): ${showExpr(official)}.`)
    if (gf && (!fg || !formulaMatches(gf, fg))) push('op_composition_for_product', gf, `That is g(f(x)). ${call} multiplies f(x) by g(x): ${showExpr(official)}.`)
    push('op_wrong_function', polyExpr(polyMul(fc, fc)), `That is f(x) times f(x). ${call} multiplies f(x) by g(x).`)
    const g2 = polyExpr(polyMul(gc, gc))
    if (!formulaMatches(g2, polyExpr(polyMul(fc, fc)))) push('op_wrong_function', g2, `That is g(x) times g(x). ${call} multiplies f(x) by g(x).`)
  }

  if (data.op === 'f+g' && fc && gc) {
    const twoF = polyExpr(polyScale(fc, 2))
    const twoG = polyExpr(polyScale(gc, 2))
    push('op_wrong_function', twoF, `That uses f in both places: 2f(x) = ${showExpr(twoF)}. ${call} uses f and g.`)
    if (!formulaMatches(twoG, twoF)) push('op_wrong_function', twoG, `That uses g in both places: 2g(x) = ${showExpr(twoG)}. ${call} uses f and g.`)
  }
  if ((data.op === 'f-g' || data.op === 'g-f') && fc && gc) {
    push('op_wrong_function', '0', `That subtracts a function from itself. ${call} uses f and g.`)
  }

  return dedupe(slips)
}

function revealFormula(data: OpsData, official: string): string[] {
  const f = data.f ?? ''
  const g = data.g ?? ''
  const call = callOf(data, 'x')
  const fs = showExpr(f)
  const gs = showExpr(g)
  const ans = showExpr(official)
  switch (data.op) {
    case 'f+g':
      return [`Add like terms: (${fs}) + (${gs}) = ${ans}.`, `${call} = ${ans}.`]
    case 'f-g':
      return [`Subtract every term of g: (${fs}) − (${gs}) = ${ans}.`, `${call} = ${ans}.`]
    case 'g-f':
      return [`Subtract every term of f: (${gs}) − (${fs}) = ${ans}.`, `${call} = ${ans}.`]
    case 'fg':
      return [`Multiply: (${fs})(${gs}) = ${ans}.`, `${call} = ${ans}.`]
    case 'f/g':
      return [`The quotient is ${ans}. It can stay unsimplified.`, `${call} = ${ans}.`]
    case 'fog':
    case 'gof': {
      const outer = data.op === 'fog' ? f : g
      const inner = data.op === 'fog' ? g : f
      const built = composeText(outer, inner)
      if (!built) return [`${call} = ${ans}.`]
      return [`Put the inside function in: ${showExpr(built.unsimplified)}.`, `Simplified: ${showExpr(built.simplified)}.`]
    }
    default:
      return [`${call} = ${ans}.`]
  }
}

function officialFormula(data: OpsData): string | undefined {
  const f = data.f
  const g = data.g
  if (!f || !g) return undefined
  const fc = intCoeffs(f)
  const gc = intCoeffs(g)
  switch (data.op) {
    case 'f+g':
      return fc && gc ? polyExpr(polyAdd(fc, gc)) : undefined
    case 'f-g':
      return fc && gc ? polyExpr(polySub(fc, gc)) : undefined
    case 'g-f':
      return fc && gc ? polyExpr(polySub(gc, fc)) : undefined
    case 'fg':
      return fc && gc ? polyExpr(polyMul(fc, gc)) : undefined
    case 'f/g':
      return quotientText(f, g)
    case 'fog':
      return composedText(fc, gc, f, g)
    case 'gof':
      return composedText(gc, fc, g, f)
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Assessment, naming, grading
// ---------------------------------------------------------------------------

export function assessOps(data: OpsData, withReveal = true): OpsAssessment {
  if (data.question === 'formula') {
    const official = officialFormula(data)
    return {
      official,
      officialText: official ?? '',
      slips: formulaSlips(data, official),
      reveal: withReveal && official ? revealFormula(data, official) : [],
    }
  }
  const a = Number(data.at)
  const result = run(data, data.op, a)
  const official = result.denomZero ? undefined : result.value
  return {
    official,
    officialText: official === undefined ? 'undefined' : asciiNum(official),
    slips: valueSlips(data, a, official),
    reveal: withReveal ? revealValue(data, result, a) : [],
  }
}

function priority(id: OpsMistakeId): number {
  const i = OP_PRIORITY.indexOf(id)
  return i < 0 ? OP_PRIORITY.length : i
}

/** Slips whose value is not the right answer, one per id and value. */
export function opsSlips(data: OpsData): OpsSlip[] {
  return assessOps(data, false).slips
}

/**
 * Slips that are the only id producing their value. Sorted most likely first.
 * When the right answer does not exist, a probe number that matches nothing is added as
 * op_undefined_missed so that trap can be promised on its own.
 */
export function uniqueSlips(slips: readonly OpsSlip[], official: number | string | undefined, withUndefinedProbe = false): OpsSlip[] {
  const list = slips.slice()
  if (withUndefinedProbe && (official === undefined || official === 'undefined')) {
    const probe = PROBES.find((n) => !list.some((s) => typeof s.value === 'number' && near(s.value, n))) ?? 17
    list.push({ id: 'op_undefined_missed', value: probe, witness: '' })
  }
  const groups: OpsSlip[][] = []
  for (const s of list) {
    const g = groups.find((gr) => gr[0] && sameSlip(gr[0].value, s.value))
    if (g) g.push(s)
    else groups.push([s])
  }
  const unique = groups.filter((g) => new Set(g.map((s) => s.id)).size === 1).map((g) => g[0]!)
  unique.sort((a, b) => priority(a.id) - priority(b.id))
  return unique
}

/** The most likely unambiguous slip, or null when every candidate collides with another. */
export function pickTrap(slips: readonly OpsSlip[], official: number | string | undefined): OpsSlip | null {
  return uniqueSlips(slips, official, official === undefined)[0] ?? null
}

/** The most likely slip equal to her answer, even when another slip shares that value. */
export function nameMatching(slips: readonly OpsSlip[], hers: number | string): OpsSlip | null {
  const hits = slips.filter((s) => sameSlip(s.value, hers))
  hits.sort((a, b) => priority(a.id) - priority(b.id))
  return hits[0] ?? null
}

const UNDEFINED_WORD = /^(?:undefined|undef|dne|does\s+not\s+exist|not\s+defined)$/i

function stripLabel(text: string): string {
  const t = text.trim()
  const eq = t.indexOf('=')
  if (eq <= 0) return t
  const left = t.slice(0, eq)
  const right = t.slice(eq + 1).trim()
  if (right && /[fgxy]/i.test(left)) return right
  return t
}

function herNumber(text: string): number | undefined {
  const v = evaluateExpr(text, {})
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function counterexample(expected: string, hers: string, call: string): string {
  for (const x of [-2, -1, 0, 1, 2, 3, -3, 4, -4, 5, 6, -6]) {
    const ev = evaluateExpr(expected, { x })
    const hv = evaluateExpr(hers, { x })
    if (ev === 'undef' || hv === 'undef' || near(ev, hv)) continue
    return `At x = ${showNum(x)}, ${call} = ${showNum(ev)}, but your formula gives ${showNum(hv)}.`
  }
  return `That is not ${call}.`
}

/** Grade one answer. The right-hand side is recomputed from the table, the graphs, or the formulas. */
export function gradeFunctionOps(data: OpsData, raw: string): OpsGrade {
  const assessed = assessOps(data, false)
  const call = callOf(data, atShown(data))
  if (data.question === 'formula') {
    const body = stripLabel(raw)
    if (!body.trim()) return { verdict: 'invalid', message: 'Type a formula in x.' }
    if (UNDEFINED_WORD.test(body)) return { verdict: 'wrong', message: `${call} is a formula in x, not a single number.` }
    const parsed = parseExpression(body, ['x'])
    if (!parsed.ok) return { verdict: 'invalid', message: parsed.error.message }
    const official = assessed.official
    if (typeof official !== 'string' || !official) return { verdict: 'wrong', message: `That is not ${call}.` }
    if (formulaMatches(body, official)) return { verdict: 'correct', message: `Yes: ${call} = ${showExpr(official)}.` }
    if ((data.op === 'fog' || data.op === 'gof') && data.f && data.g) {
      const outer = data.op === 'fog' ? data.f : data.g
      const inner = data.op === 'fog' ? data.g : data.f
      const built = composeText(outer, inner)
      if (built && (formulaMatches(body, built.simplified) || formulaMatches(body, built.unsimplified))) {
        return { verdict: 'correct', message: `Yes: ${call} = ${showExpr(official)}.` }
      }
      const graded = gradeComposition(outer, inner, body)
      if (graded.verdict === 'correct') return { verdict: 'correct', message: `Yes: ${call} = ${showExpr(official)}.` }
    }
    const hit = nameMatching(assessed.slips, body)
    if (hit) return { verdict: 'mistake', mistake: hit.id, witness: hit.witness }
    return { verdict: 'wrong', message: counterexample(official, body, call) }
  }

  const parsed = parseValueAnswer(raw)
  if (!parsed.ok) return { verdict: 'invalid', message: parsed.error.message }
  if (parsed.undefined) {
    if (assessed.official === undefined) return { verdict: 'correct', message: `Yes: ${call} is undefined.` }
    return { verdict: 'wrong', message: `${call} has a value. The word undefined would mean it does not exist.` }
  }
  const hers = herNumber(parsed.text)
  if (hers === undefined) return { verdict: 'invalid', message: 'This answer is a number, or the word undefined.' }
  if (typeof assessed.official === 'number' && near(hers, assessed.official)) {
    return { verdict: 'correct', message: `Yes: ${call} = ${showNum(assessed.official)}.` }
  }
  const hit = nameMatching(assessed.slips, hers)
  if (hit) return { verdict: 'mistake', mistake: hit.id, witness: hit.witness }
  if (assessed.official === undefined) {
    const why = assessed.reveal[0] ?? `${call} is undefined.`
    return { verdict: 'mistake', mistake: 'op_undefined_missed', witness: `You gave ${showNum(hers)}. ${why}` }
  }
  if (typeof assessed.official !== 'number') {
    return { verdict: 'wrong', message: `That is not ${call}.` }
  }
  return { verdict: 'wrong', message: `That is not ${call}. ${call} = ${showNum(assessed.official)}.` }
}
