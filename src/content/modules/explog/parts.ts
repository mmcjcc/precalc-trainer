/**
 * Checking one part of a second-half Unit 3 problem: the graph features, a matching pick, an inverse, and the
 * numbers of a growth or decay word problem. The readers are the app's own: parseSetAnswer for intervals, the
 * parser for numbers and formulas, gradeLogValue for exact values and, with { decimal }, for rounded ones. A
 * named mistake is a trap the template computed for THIS problem. A message she can retry on never states the
 * answer.
 */
import type { ExpLogPart, ExpLogPartTrap } from '@/content/types'
import { ERROR_PATTERNS, compileExpr, exactEquals, exactLogValue, gradeLogValue, niceNumber, parseExpression, parseSetAnswer } from '@/engine'
import { setsEqual } from '@/notation'
import type { ErrorPatternId, SolutionSet } from '@/shared/types'
import { anyShows } from './text'

export type PartGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

const correct = (message: string): PartGrade => ({ verdict: 'correct', message })
const mistake = (trap: ExpLogPartTrap): PartGrade => ({ verdict: 'mistake', mistake: trap.id, witness: trap.witness })
const wrong = (message: string): PartGrade => ({ verdict: 'wrong', message })
const invalid = (message: string): PartGrade => ({ verdict: 'invalid', message })

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }

/** App syntax → reading text: − for minus, ∞, · for *, log₂( for log_2(. */
export function say(text: string): string {
  return text
    .replace(/ \* /g, '·')
    .replace(/log_(\d+)(?=\()/g, (_m, d: string) => `log${[...d].map((c) => SUB[c] ?? c).join('')}`)
    .replace(/(?<![A-Za-z])inf(?![A-Za-z])/g, '∞')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/-/g, '−')
}

const close = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b))

/** The value of a constant expression she typed ("13/4", "e^2 + 3", "-2"), or why it cannot be read. */
export function numberOf(text: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = text.trim()
  if (!t) return { ok: false, message: 'Type your answer first.' }
  const p = parseExpression(t, [])
  if (!p.ok) return { ok: false, message: p.error.message }
  const v = evaluator(p.text)({})
  if (v === 'undef' || !Number.isFinite(v)) return { ok: false, message: 'That number is undefined as written. Check each log’s input.' }
  return { ok: true, value: v }
}

/** "1647.01" → "1,647.01" (a plain decimal only). */
export function withCommas(text: string): string {
  const m = /^(-?)(\d+)(\.\d+)?$/.exec(text)
  if (!m) return text
  return `${m[1]}${m[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${m[3] ?? ''}`
}

/** "3.25" → 2 places; anything that is not a plain decimal → null. */
function decimalPlaces(text: string): number | null {
  const m = /^[-+]?(\d*)\.(\d+)$/.exec(text.trim())
  return m ? m[2]!.length : null
}

function unminus(text: string): string {
  return text.replace(/[−–]/g, '-')
}

/** Inner text of one pair of outer parentheses, if the whole text is wrapped in them. */
function unwrap(text: string): string {
  const t = text.trim()
  if (!t.startsWith('(') || !t.endsWith(')')) return t
  let depth = 0
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth++
    else if (t[i] === ')') {
      depth--
      if (depth === 0 && i < t.length - 1) return t
    }
  }
  return t.slice(1, -1)
}

/** Split at commas outside parentheses. */
function topCommas(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i))
      start = i + 1
    }
  }
  out.push(text.slice(start))
  return out.map((s) => s.trim())
}

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

function setOf(text: string): SolutionSet | null {
  const p = parseSetAnswer(unminus(text))
  return p.ok ? p.set : null
}

/** "x ∈ ℝ", "{y | y in R}": every real number, the way some books write it. */
const IN_REALS = /^\{?\s*(?:[xy]\s*\|\s*)?[xy]\s*(?:∈|in)\s*(?:ℝ|R|the\s+reals|all\s+real\s+numbers)\s*\}?$/i

function gradeInterval(part: ExpLogPart, raw: string): PartGrade {
  const t = unminus(raw).trim()
  if (!t) return invalid('Type your answer first.')
  const her = parseSetAnswer(IN_REALS.test(t) ? 'all real numbers' : t)
  // The reader's own note sends a condition to a set-builder box; this screen has one box for every form.
  if (!her.ok) return invalid(/set-builder box/.test(her.error.message) ? 'Write it in interval notation, like (a, ∞), or as an inequality, like x > a.' : her.error.message)
  const target = setOf(part.answerText)
  if (target && setsEqual(her.set, target)) return correct(`Correct: the ${part.label.toLowerCase()} is ${say(part.answerText)}.`)
  for (const trap of part.traps) {
    const s = setOf(trap.text)
    if (s && setsEqual(her.set, s)) return mistake(trap)
  }
  return wrong(WRONG[part.id] ?? 'That is not it. Check it against the formula.')
}

// ---------------------------------------------------------------------------
// Lines: x = h, y = k
// ---------------------------------------------------------------------------

interface Line {
  axis: 'x' | 'y'
  value: number
}

function readLine(raw: string): { ok: true; line: Line } | { ok: false; message: string } {
  const t = unminus(raw).trim()
  if (!t) return { ok: false, message: 'Type your answer first.' }
  const m = /^([xy])\s*=\s*(.+)$/i.exec(t) ?? /^(.+?)\s*=\s*([xy])$/i.exec(t)
  if (!m) return { ok: false, message: 'Write the asymptote as the equation of a line: y = a number, or x = a number.' }
  const axisFirst = /^[xy]$/i.test(m[1]!)
  const axis = (axisFirst ? m[1]! : m[2]!).toLowerCase() as 'x' | 'y'
  const side = axisFirst ? m[2]! : m[1]!
  if (/(?<![A-Za-z])[xy](?![A-Za-z])/i.test(side)) return { ok: false, message: 'These asymptotes are flat or straight up: y = a number, or x = a number.' }
  const n = numberOf(side)
  if (!n.ok) return { ok: false, message: n.message }
  return { ok: true, line: { axis, value: n.value } }
}

function sameLine(a: Line, b: Line): boolean {
  return a.axis === b.axis && close(a.value, b.value, 1e-12)
}

function gradeLine(part: ExpLogPart, raw: string): PartGrade {
  const her = readLine(raw)
  if (!her.ok) return invalid(her.message)
  const target = readLine(part.answerText)
  if (target.ok && sameLine(her.line, target.line)) return correct(`Correct: the asymptote is ${say(part.answerText)}.`)
  for (const trap of part.traps) {
    const l = readLine(trap.text)
    if (l.ok && sameLine(her.line, l.line)) return mistake(trap)
  }
  return wrong(WRONG[part.id] ?? 'That is not the asymptote.')
}

// ---------------------------------------------------------------------------
// Exact points
// ---------------------------------------------------------------------------

interface Point {
  x: number
  y: number
  xText: string
  yText: string
}

function readPoint(raw: string): { ok: true; point: Point } | { ok: false; message: string } {
  const t = unminus(raw).trim()
  if (!t) return { ok: false, message: 'Type your answer first.' }
  const parts = topCommas(unwrap(t))
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, message: 'Write the intercept as a point with two coordinates, like (x, y).' }
  const x = numberOf(parts[0])
  if (!x.ok) return { ok: false, message: x.message }
  const y = numberOf(parts[1])
  if (!y.ok) return { ok: false, message: y.message }
  return { ok: true, point: { x: x.value, y: y.value, xText: parts[0], yText: parts[1] } }
}

/** A coordinate typed as a calculator decimal near the exact value: not an attempt. */
function roundedCoordinate(text: string, value: number, target: number): boolean {
  const places = decimalPlaces(text)
  if (places === null || close(value, target, 1e-12)) return false
  return Math.abs(value - target) <= 0.5 * 10 ** -places + 1e-12
}

function gradePoint(part: ExpLogPart, raw: string): PartGrade {
  const her = readPoint(raw)
  if (!her.ok) return invalid(her.message)
  const target = readPoint(part.answerText)
  if (!target.ok) return invalid('This point could not be checked.')
  const p = her.point
  const q = target.point
  if (close(p.x, q.x, 1e-12) && close(p.y, q.y, 1e-12)) return correct(`Correct: the intercept is ${say(part.answerText)}.`)
  if (roundedCoordinate(p.xText, p.x, q.x) || roundedCoordinate(p.yText, p.y, q.y)) {
    return invalid('That coordinate is a rounded calculator decimal. Give the exact point: keep fractions, powers and e as they are.')
  }
  for (const trap of part.traps) {
    const r = readPoint(trap.text)
    if (r.ok && close(p.x, r.point.x, 1e-9) && close(p.y, r.point.y, 1e-9)) return mistake(trap)
  }
  // A point on the other axis: said by which intercept the part asks for (the answer itself may be (0, 0)).
  const yIntercept = part.label.startsWith('y')
  if (yIntercept && p.y === 0 && p.x !== 0) return wrong('That point is on the x-axis. The y-intercept is where the graph crosses the y-axis, at x = 0.')
  if (!yIntercept && p.x === 0 && p.y !== 0) return wrong('That point is on the y-axis. The x-intercept is where the graph crosses the x-axis, at y = 0.')
  return wrong(WRONG[part.id] ?? 'That point is not the intercept.')
}

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

function gradeChoice(part: ExpLogPart, raw: string): PartGrade {
  const t = raw.trim().toLowerCase()
  if (!t) return invalid('Pick one of the choices first.')
  const hit = (part.choices ?? []).find((c) => c.value.toLowerCase() === t || c.label.toLowerCase() === t)
  if (!hit) return invalid('Pick one of the choices.')
  if (hit.value === part.answerText) return correct(`Correct: ${hit.label}.`)
  const trap = part.traps.find((tr) => tr.text === hit.value)
  if (trap) return mistake(trap)
  return wrong(WRONG[part.id] ?? 'That is not the one.')
}

// ---------------------------------------------------------------------------
// Inverse functions, by composition
// ---------------------------------------------------------------------------

/** What the inverse check needs to know about f. */
export interface InverseCheck {
  /** f in app syntax. */
  f: string
  /** x-values inside the domain of f. */
  domainSamples: number[]
  /** y-values inside the range of f (the domain of f⁻¹). */
  rangeSamples: number[]
  /** Points (x, f(x)) with rational coordinates, in app syntax, for exact spot checks. */
  spots: { x: string; y: string }[]
  /** Extra x-values where a slip's formula may be defined, to compare her formula with it. */
  probes: number[]
}

const LHS = /^\s*(?:y|[fg]\s*(?:\^\s*\(?\s*-\s*1\s*\)?|⁻¹|inv|-1)\s*\(\s*x\s*\))\s*=\s*/i
const LETTER_Y = /(?<![A-Za-z])y(?![A-Za-z])/
const LETTER_X = /(?<![A-Za-z_])x(?![A-Za-z_])/

/** Her formula for f⁻¹ without its left side, or why it is not one. */
export function inverseFormula(raw: string): { ok: true; text: string } | { ok: false; message: string } {
  const t = unminus(raw).trim()
  if (!t) return { ok: false, message: 'Type your answer first.' }
  let body = t
  const lhs = LHS.exec(t)
  if (lhs) body = t.slice(lhs[0].length)
  else if (t.includes('=')) {
    if (/^\s*x\s*=/.test(t)) return { ok: false, message: 'Solve for y: after you swap x and y, get y by itself and write y = … in terms of x.' }
    return { ok: false, message: 'Write the inverse as y = … or f^-1(x) = …, in terms of x.' }
  }
  if (LETTER_Y.test(body)) return { ok: false, message: 'Write f⁻¹ in terms of x: swap x and y, then solve for y.' }
  const p = parseExpression(body, ['x'])
  if (!p.ok) return { ok: false, message: p.error.message }
  if (!LETTER_X.test(p.text)) return { ok: false, message: 'f⁻¹(x) is a formula in x, not a number.' }
  return { ok: true, text: p.text }
}

const compiled = new Map<string, ReturnType<typeof compileExpr>>()

function evaluator(text: string): ReturnType<typeof compileExpr> {
  let fn = compiled.get(text)
  if (!fn) {
    if (compiled.size > 2000) compiled.clear()
    fn = compileExpr(text)
    compiled.set(text, fn)
  }
  return fn
}

/** A formula in x at one x, or null where it is undefined. */
export function at(text: string, x: number): number | null {
  const v = evaluator(text)({ x })
  return v === 'undef' || !Number.isFinite(v) ? null : v
}

/** Her formula at an exact x, through the exact model: null when it is outside the model. */
function exactAt(text: string, x: string): ReturnType<typeof exactLogValue> {
  const substituted = text.replace(new RegExp(LETTER_X.source, 'g'), `(${x})`)
  const p = parseExpression(substituted, [])
  if (!p.ok) return 'undef'
  return exactLogValue(p.node)
}

/** g undoes f: g(f(x)) = x on the domain of f, f(g(y)) = y on the range of f, and exactly at the spot points. */
export function isInverse(g: string, check: InverseCheck): boolean {
  for (const x of check.domainSamples) {
    const y = at(check.f, x)
    if (y === null) continue
    const back = at(g, y)
    if (back === null || !close(back, x, 1e-7)) return false
  }
  for (const y of check.rangeSamples) {
    const x = at(g, y)
    if (x === null) return false
    const fx = at(check.f, x)
    if (fx === null || !close(fx, y, 1e-7)) return false
  }
  for (const spot of check.spots) {
    const v = exactAt(g, spot.y)
    if (v === null) continue
    if (v === 'undef') return false
    const want = parseExpression(spot.x, [])
    const wv = want.ok ? exactLogValue(want.node) : null
    if (wv && wv !== 'undef' && !exactEquals(v, wv)) return false
  }
  return true
}

/** The same function as a slip's formula wherever the slip is defined (at least three of the points). */
function sameFormula(g: string, slip: string, points: readonly number[]): boolean {
  let compared = 0
  for (const x of points) {
    const s = at(slip, x)
    if (s === null) continue
    const v = at(g, x)
    if (v === null || !close(v, s, 1e-7)) return false
    compared++
  }
  return compared >= 3
}

function gradeFormula(part: ExpLogPart, raw: string, check: InverseCheck | undefined): PartGrade {
  if (!check) return invalid('This part could not be checked.')
  const her = inverseFormula(raw)
  if (!her.ok) return invalid(her.message)
  if (isInverse(her.text, check)) return correct(`Correct: f⁻¹(x) = ${say(part.answerText)}.`)
  const points = [...check.rangeSamples, ...check.probes]
  for (const trap of part.traps) {
    if (sameFormula(her.text, trap.text, points)) return mistake(trap)
  }
  // A check she can redo: one point of f and what her formula does with it. It names no formula.
  const spot = check.spots[0]
  if (spot) {
    const y = Number(compileExpr(spot.y)({}))
    const back = at(her.text, y)
    const xs = say(spot.x)
    const ys = say(spot.y)
    const gave = back === null ? `your formula is undefined at x = ${ys}` : `your formula gives ${say(niceNumber(back))} at x = ${ys}`
    return wrong(`That is not the inverse. f sends ${xs} to ${ys}, so f⁻¹ has to send ${ys} back to ${xs}, but ${gave}.`)
  }
  return wrong('That is not the inverse: f⁻¹(f(x)) has to give back x.')
}

// ---------------------------------------------------------------------------
// Numbers: exact values and rounded decimals (gradeLogValue)
// ---------------------------------------------------------------------------

const UNIT_TAIL = (units: readonly string[]) => new RegExp(`\\s*(?:${units.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\.?\\s*$`, 'i')

/** Her number without "t =", a dollar sign, thousands commas, or a unit word. */
export function cleanNumber(raw: string, part: Pick<ExpLogPart, 'money' | 'units'>): string {
  let t = unminus(raw).trim()
  t = t.replace(/^(?:about|approximately|approx\.?)\s+/i, '')
  t = t.replace(/^[A-Za-z]{1,2}\s*(?:\(\s*[\w.]+\s*\))?\s*(?:=|≈)\s*/, '')
  t = t.replace(/^≈\s*/, '')
  if (part.money) t = t.replace(/^\$\s*/, '').replace(/^-\s*\$\s*/, '-').replace(/\s*dollars?\.?$/i, '')
  if (part.units?.length) t = t.replace(UNIT_TAIL(part.units), '')
  const grouped = /^([-+]?)(\d{1,3}(?:,\d{3})+)(\.\d+)?$/.exec(t)
  if (grouped) t = `${grouped[1]}${grouped[2]!.replace(/,/g, '')}${grouped[3] ?? ''}`
  return t.trim()
}

/**
 * The one slip whose value she typed, to the places asked (or, for a coarser answer, to her own places).
 * When a coarse answer fits more than one slip, none is named: it could be either.
 */
function trapByValue(part: ExpLogPart, value: number, tol: number): ExpLogPartTrap | null {
  const hits = part.traps.filter((trap) => (trap.values ?? []).some((v) => Math.abs(value - v) <= tol))
  return hits.length === 1 ? hits[0]! : null
}

function placesPhrase(part: ExpLogPart): string {
  if (part.money) return 'to the nearest cent'
  const p = part.places ?? 0
  return p === 0 ? 'to a whole number' : `to ${p} decimal place${p === 1 ? '' : 's'}`
}

function gradeExact(part: ExpLogPart, raw: string): PartGrade {
  const t = cleanNumber(raw, part)
  if (!t) return invalid('Type your answer first.')
  const forms = part.closedForms ?? []
  let unreadable: string | null = null
  for (const form of forms) {
    const g = gradeLogValue(form, t)
    if (g.verdict === 'correct') return correct(`Correct: ${say(t)} is the exact value.`)
    if (g.verdict === 'invalid' && g.reason === 'not_exact') {
      return invalid('That is a calculator decimal. This part asks for the exact value: keep the ln in it. The next part rounds it.')
    }
    if (g.verdict === 'invalid' && g.reason === 'unreadable') unreadable = g.message
  }
  if (unreadable) return invalid(unreadable)
  const n = numberOf(t)
  if (!n.ok) return invalid(n.message)
  for (const trap of part.traps) {
    if ((trap.values ?? []).some((v) => close(n.value, v, 1e-9))) return mistake(trap)
  }
  return wrong(WRONG[part.id] ?? 'That is not the exact value.')
}

function gradeDecimal(part: ExpLogPart, raw: string): PartGrade {
  const t = cleanNumber(raw, part)
  if (!t) return invalid('Type your answer first.')
  const places = part.places ?? 0
  const decimal = { places }
  let rounded = false
  let exactForm = false
  let unreadable: string | null = null
  for (const form of part.closedForms ?? []) {
    const g = gradeLogValue(form, t, { decimal })
    if (g.verdict === 'correct') return correct(`Correct: ${part.money ? `$${withCommas(t)}` : say(withCommas(t))}${part.units?.[0] ? ` ${part.units[0]}` : ''}.`)
    if (g.verdict === 'invalid') {
      if (g.reason === 'not_rounded') rounded = true
      else if (g.reason === 'not_in_form') exactForm = true
      else unreadable = g.message
    }
  }
  if (rounded) return invalid(part.money ? 'Give the amount to the nearest cent: two decimal places.' : `Keep ${places} decimal place${places === 1 ? '' : 's'}: your answer is rounded too far.`)
  if (exactForm) return invalid(`That is the exact value. This problem asks you to round it: work it out on the calculator and round ${placesPhrase(part)}.`)
  if (unreadable) return invalid(part.money ? `${unreadable} Type the amount in dollars and cents, with or without $ and commas.` : unreadable)
  const n = numberOf(t)
  if (!n.ok) return invalid(n.message)
  // Her own precision: a plain decimal's places, 0 for a whole number, and the places asked for an expression.
  const herPlaces = decimalPlaces(t) ?? (/^[-+]?\d+$/.test(t) ? 0 : places)
  const tol = Math.max(0.5 * 10 ** -places, 0.5 * 10 ** -herPlaces) + 1e-9
  const trap = trapByValue(part, n.value, tol)
  if (trap) return mistake(trap)
  return wrong(WRONG[part.id] ?? 'That does not match this problem.')
}

// ---------------------------------------------------------------------------

/** Plain wrong answers: what to look at, never the answer. */
const WRONG: Record<string, string> = {
  domain: 'That is not the domain. Ask which x-values the formula can take.',
  range: 'That is not the range. Ask which heights the graph reaches, and which side of the asymptote it is on.',
  asymptote: 'That is not the asymptote. An exponential levels off toward a horizontal line; a log runs along a vertical line where its input is 0.',
  intercept: 'That point is not where the graph crosses the axis. Put the coordinate you know into the formula and keep every shift.',
  behavior: 'Look at the base and the sign of a together.',
  match: 'Compare the asymptote, the side of it the curve is on, and whether it rises or falls.',
  k: 'That is not k. Divide both sides by P₀, take ln of both sides, then divide by the time.',
  kRounded: 'That is not k rounded. Work out your exact k on the calculator, then round to four decimal places.',
  answer: 'That does not match this problem. Check which formula fits the words, then each number you put in.',
  follow: 'That does not match the model. Put your k into P = P₀e^(kt) and check each number.',
}

/** Grade her entry for one part. `inverse` is needed for a formula part. */
export function gradeExpLogPart(part: ExpLogPart, raw: string, inverse?: InverseCheck): PartGrade {
  switch (part.kind) {
    case 'interval':
      return gradeInterval(part, raw)
    case 'line':
      return gradeLine(part, raw)
    case 'point':
      return gradePoint(part, raw)
    case 'choice':
      return gradeChoice(part, raw)
    case 'formula':
      return gradeFormula(part, raw, inverse)
    case 'exact':
      return gradeExact(part, raw)
    case 'decimal':
      return gradeDecimal(part, raw)
  }
}

/** Her boxes in reading order, for the tutor: "Domain: (-inf, inf)". */
export function partsWork(stages: readonly ExpLogPart[], entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const s of stages) {
    const v = entries[s.id]?.trim()
    if (!v) continue
    const label = s.kind === 'choice' ? (s.choices?.find((c) => c.value === v)?.label ?? v) : v
    lines.push(`${s.label}: ${label}`)
  }
  return lines
}

/** Every entry that grades right, part by part (for tests and the tutor's reference). */
export function partEntries(stages: readonly ExpLogPart[]): Record<string, string> {
  return Object.fromEntries(stages.map((s) => [s.id, s.answerText]))
}

/** The texts a part may show before she has its answer: the ask, the hint, the nudge, the traps' sentences, the plain notes. */
export function partShownTexts(part: ExpLogPart): string[] {
  return [part.label, part.ask, part.formatHint, part.nudge, ...part.traps.map((t) => t.witness), WRONG[part.id] ?? '', ...(part.choices ?? []).map((c) => c.label)]
}

/** The catalog title, lesson and example of every slip this part can name. */
export function partCatalogTexts(part: ExpLogPart): string[] {
  const ids = new Set(part.traps.map((tr) => tr.id))
  return [...ids].flatMap((id) => [ERROR_PATTERNS[id].title, ERROR_PATTERNS[id].lesson, ERROR_PATTERNS[id].example])
}

/**
 * What she can see before she has answered each part, checked against the answers still to come. The prompt,
 * the instructions and every rule card are on screen throughout; a part's own texts (its question, hint, nudge,
 * the sentences and catalog entries of its traps, its plain note) only once it is open, when the parts before it
 * are done. A choice's options are on screen by design, so a choice part's answer is not searched for.
 */
export function leaks(prompt: string, instructions: string, stages: readonly ExpLogPart[], forms: (part: ExpLogPart) => string[], cards: readonly string[]): string[] {
  const out: string[] = []
  const hidden = (from: number) => stages.slice(from).filter((s) => s.kind !== 'choice').flatMap(forms)
  for (const text of [prompt, instructions, ...cards]) if (anyShows([text], hidden(0))) out.push(text)
  stages.forEach((part, i) => {
    for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (anyShows([text], hidden(i))) out.push(`${part.id}: ${text}`)
  })
  return out
}
