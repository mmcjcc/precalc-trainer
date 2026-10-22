/**
 * Shared building blocks for honors Unit 7 (right triangles): the format hints, the values no template may use as an
 * answer, exact lengths (a rational times a square root, shared with the precalculus right-triangle core in
 * `@/engine/trig`), number, rounded and choice parts, the label placement and figure checks, and the last gate every
 * problem passes before it ships.
 *
 * The gate is Unit 6's, held to two Unit 7 rules: a radical binds the number it touches (a side of 6√2 does not show a
 * leg of 6, and √3 on a card does not show a side of 3), and a rounded answer may not equal a number the problem gives
 * (a 13-foot ramp that reaches 13.0 feet). Every segment label must sit nearer its own segment than any other, and a
 * label on a side of a triangle sits outside it. A generator that is refused tries again from the same seed.
 */
import { ERROR_PATTERNS } from '@/engine'
import { q as rq, tx, type TrigExact } from '@/engine/trig'
import type { GeometryAnswer, GeometryQuestion, GeometryStageId, RuleCard } from '@/content/types'
import type { ErrorPatternId, GeoFigureSpec, GeoPoint } from '@/shared/types'
import { formatQty, readGeoAnswer, sameGeoValue, simplifyRadical, type GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { assertGeoAnswer, exampleShowsAnswer, exposedExact, gradeGeoStage, isGeoMistake, stageDisplay } from './grade'
import { GEO_RULE_FOR } from './rules'
import { choiceStage, englishIssues, type ChoiceDraft5 } from './unit5Build'
import { figureLayout, layoutOf } from './unit5Layout'
import { dimLabel, figureIssues6, readTexts, settlePointSides } from './unit6Build'

// --- format hints and reserved answers ---------------------------------------------------------------------

export const X_HINT7 = 'A number, like 43 or x = 43.'
export const EXACT_HINT7 = 'A whole number or a simplest radical, like 43 or 3√11.'
export const SPECIAL_HINT7 = 'A number in simplest radical form, like 43, 3√11, or (3√11)/2.'
export const MEAN_HINT7 = 'A whole number or a simplest radical, like 43 or 3√11.'
export const PICK_HINT7 = 'Pick one.'

export type LengthUnit7 = 'ft' | 'm' | 'in' | 'yd' | 'km' | 'mi'
export type Places = 0 | 1 | 2

const PLACE_EXAMPLE: Record<Places, string> = { 0: '43', 1: '43.7', 2: '43.71' }
const PLACE_NAME: Record<Places, string> = { 0: 'whole number', 1: 'tenth', 2: 'hundredth' }

/** The hint under a rounded box: "A length to the nearest tenth, like 43.7 or 43.7 ft." */
export function roundHint7(places: Places, unit: LengthUnit7): string {
  const e = PLACE_EXAMPLE[places]
  return `A length to the nearest ${PLACE_NAME[places]}, like ${e} or ${e} ${unit}.`
}

/**
 * No Unit 7 part has one of these as its answer: the numbers of the format hints (43, 43.7, 43.71), the 0 and 1 no
 * length here is, and the 90 and 180 the cards name.
 */
export const RESERVED7_NUMBERS: ReadonlySet<number> = new Set([0, 1, 43, 43.7, 43.71, 90, 180])
/** The same for radicals: the hint examples. */
export const RESERVED7_TEXT: ReadonlySet<string> = new Set(['3√11', '(3√11)/2'])

// --- exact lengths -----------------------------------------------------------------------------------------

/** k·√m from integers, simplified: rad(1, 1, 52) is 2√13. */
export const rad = (n: number, d: number, r: number): GeoQty => simplifyRadical(n, d, r)
export const int = (n: number): GeoQty => simplifyRadical(n, 1, 1)

/** The square root of a positive rational n/d, simplified. */
export function sqrtQ(n: number, d = 1): GeoQty {
  if (n <= 0 || d <= 0) throw new Error('no square root of a length of zero or less')
  return simplifyRadical(1, d, n * d)
}

/** q² as a rational [numerator, denominator]. */
export function squareQ(q: GeoQty): [number, number] {
  const n = q.n * q.n * q.rad
  const d = q.d * q.d
  const g = gcdN(n, d)
  return [n / g, d / g]
}

export const approxQ = (q: GeoQty): number => (q.n / q.d) * Math.sqrt(q.rad)
export const sameQ = (a: GeoQty, b: GeoQty): boolean => a.n === b.n && a.d === b.d && a.rad === b.rad
export const isWholeQ = (q: GeoQty): boolean => q.rad === 1 && q.d === 1

/** The answer text she types: 7, 2√13, (14√3)/3, 9/2. */
export const qText = (q: GeoQty): string => formatQty(q)

/** For a sentence: as she types it, with a real minus sign. */
export const qSay = (q: GeoQty): string => formatQty(q).replace(/^-/, '−')

/** The end of a worked line for a square root: "28", "√181", or "√52 = 2√13". */
export function rootSay(q: GeoQty): string {
  if (isWholeQ(q)) return `${q.n}`
  const [n, d] = squareQ(q)
  const radical = d === 1 ? `√${n}` : `√(${n}/${d})`
  return radical === qSay(q) ? radical : `${radical} = ${qSay(q)}`
}

/** "5²" or "(2√3)²", for a worked line. */
export const sqSay = (q: GeoQty): string => (q.rad === 1 && q.d === 1 ? `${q.n}²` : `(${qSay(q)})²`)

export function gcdN(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x || 1
}

/** The trig core's exact value as a geometry quantity (the core writes c·√m with no π here). */
export function fromTrig(t: TrigExact): GeoQty {
  if (t.pi !== 0) throw new Error('a length has no π')
  return simplifyRadical(t.c.n, t.c.d, t.root)
}

/** A geometry quantity as the trig core's exact value. */
export function toTrig(q: GeoQty): TrigExact {
  return tx(rq(q.n, q.d), q.rad)
}

// --- parts ---------------------------------------------------------------------------------------------------

export type Stage7 = GeometryAnswer['stages'][number]

export interface TrapDraft7 {
  id: ErrorPatternId
  stage: GeometryStageId
  /** An exact slip value (for an exact part) or the slip's value before rounding (for a rounded part). */
  value: GeoQty | number
  witness: string
}

function valueText(v: GeoQty | number, places?: Places): string | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null
    return places === undefined ? null : roundedText(v, places)
  }
  if (v.n <= 0) return null
  if (places !== undefined) return roundedText(approxQ(v), places)
  return qText(v)
}

/** A positive number rounded halfway away from zero, as text with exactly `places` decimals. */
export function roundedText(v: number, places: Places): string {
  const f = 10 ** places
  const r = Math.floor(Math.abs(v) * f + 0.5 + 1e-9) / f
  return r.toFixed(places)
}

/** True when a value sits too close to a rounding boundary to round the same way on every calculator. */
export function nearHalf(v: number, places: Places): boolean {
  const f = 10 ** places
  const frac = (v * f) % 1
  return Math.abs(frac - 0.5) < 1e-4
}

/** Traps for one part: never the answer, never a value she was given, never two with the same value. */
function trapsFor7(stage: GeometryStageId, answerText: string, drafts: readonly TrapDraft7[], places: Places | undefined, givens: readonly GeoQty[]): Stage7['traps'] {
  const out: Stage7['traps'] = []
  const same = (a: string, b: string) => {
    if (places !== undefined) return Number(a) === Number(b)
    const ra = readGeoAnswer(a)
    const rb = readGeoAnswer(b)
    return ra.ok && rb.ok && sameGeoValue(ra.value, rb.value)
  }
  for (const d of drafts) {
    if (d.stage !== stage) continue
    const text = valueText(d.value, places)
    if (!text) continue
    if (same(text, answerText)) continue
    if (out.some((t) => same(t.text, text))) continue
    // A slip that lands on a length she was given reads as copying it, not as the slip.
    if (places === undefined && typeof d.value !== 'number' && givens.some((g) => sameQ(g, d.value as GeoQty))) continue
    if (places !== undefined && givens.some((g) => g.rad === 1 && Math.abs(g.n / g.d - Number(text)) < 1e-9)) continue
    out.push({ id: d.id, text, witness: d.witness })
  }
  return out
}

export function exactStage7(opts: {
  id: GeometryStageId
  label: string
  hint: string
  answer: GeoQty
  nudge: string
  ruleCard: string
  reveal: string[]
  traps: readonly TrapDraft7[]
  givens: readonly GeoQty[]
}): Stage7 {
  const answerText = qText(opts.answer)
  return {
    id: opts.id,
    kind: 'number',
    label: opts.label,
    hint: opts.hint,
    answerText,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    traps: trapsFor7(opts.id, answerText, opts.traps, undefined, opts.givens),
  }
}

export function roundStage7(opts: {
  id: GeometryStageId
  label: string
  places: Places
  unit: LengthUnit7
  /** The exact length, before rounding. */
  exact: GeoQty
  nudge: string
  ruleCard: string
  reveal: string[]
  traps: readonly TrapDraft7[]
  givens: readonly GeoQty[]
}): Stage7 {
  const answerText = roundedText(approxQ(opts.exact), opts.places)
  return {
    id: opts.id,
    kind: 'number',
    round: opts.places,
    exact: qText(opts.exact).replace(/√(\d+)/g, 'sqrt($1)'),
    lengthUnit: opts.unit,
    label: opts.label,
    hint: roundHint7(opts.places, opts.unit),
    answerText,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    traps: trapsFor7(opts.id, answerText, opts.traps, opts.places, opts.givens),
  }
}

export type ChoiceDraft7 = ChoiceDraft5

/** A pick-one part. */
export function choiceStage7(opts: {
  id: GeometryStageId
  label: string
  choices: ChoiceDraft7[]
  answerId: string
  nudge: string
  ruleCard: string
  reveal: string[]
  seed: number
  salt: number
  keepOrder?: boolean
}): Stage7 {
  return choiceStage({ ...opts, hint: PICK_HINT7 })
}

// --- what she reads ----------------------------------------------------------------------------------------

/** Every way an answer is written: as stored, with a real minus, a radical fraction without its parentheses, a whole rounded answer without its zeros. */
function spellings(display: string): string[] {
  const out = [display]
  if (display.includes('-')) out.push(display.replace(/-/g, '−'))
  const frac = /^\((\d*√\d+)\)\/(\d+)$/.exec(display)
  if (frac) out.push(`${frac[1]}/${frac[2]}`)
  const whole = /^(\d+)\.0+$/.exec(display)
  if (whole) out.push(whole[1]!)
  return out
}

/** A word answer is found whole and in any case; a number as its own token, a radical binding the number it touches. */
export function shows7(blob: string, display: string): boolean {
  const d = display.trim()
  if (!d || !blob) return false
  if (/[A-Za-z]{4}/.test(d)) return blob.toLowerCase().includes(d.toLowerCase())
  return spellings(d).some((s) => exposedExact(blob, s))
}

/** Everything on screen before she answers: the prompt, the figure's words and labels, every part's hint, nudge and note. */
export function screenTexts7(answer: GeometryAnswer): string[] {
  const out: string[] = [answer.prompt, answer.figure.ariaLabel, ...(answer.lines ?? [])]
  for (const p of answer.figure.points) out.push(p.label ?? '')
  for (const s of answer.figure.segments ?? []) if (s.label) out.push(s.label)
  for (const a of answer.figure.angles ?? []) if (a.label) out.push(a.label)
  for (const stage of answer.stages) out.push(stage.hint, stage.nudge, stage.note ?? '')
  return out
}

const NUMBER_TOKEN = /(\d+(?:\.\d+)?)?√(\d+)|\d+(?:\.\d+)?/g

/** The lengths the problem gives: every number or radical in the prompt and on the figure, exactly. */
export function givenValues7(answer: GeometryAnswer): GeoQty[] {
  const texts = [answer.prompt, ...(answer.figure.segments ?? []).map((s) => s.label ?? ''), ...(answer.figure.angles ?? []).map((a) => a.label ?? ''), ...answer.figure.points.map((p) => p.label ?? '')]
  const out: GeoQty[] = []
  for (const text of texts) {
    for (const m of text.matchAll(NUMBER_TOKEN)) {
      const read = readGeoAnswer(m[0])
      if (read.ok && read.value.kind === 'qty') out.push(read.value.q)
    }
  }
  return out
}

/** A part's answer as an exact quantity: the stored exact value, or the rounded decimal of a rounded part. */
function answerValue(stage: Stage7): { q: GeoQty; rounded: boolean } | null {
  if (stage.kind !== 'number') return null
  const r = readGeoAnswer(stage.answerText)
  if (!r.ok || r.value.kind !== 'qty') return null
  return { q: r.value.q, rounded: stage.round !== undefined }
}

/** The retries she might type on a part, whose messages must not show any answer. */
function retries(stage: Stage7): string[] {
  if (stage.kind === 'choice') return ['', 'not-a-choice']
  const out = ['???', '1001', '0.001', `${stage.answerText}°`]
  const read = readGeoAnswer(stage.answerText)
  if (!read.ok || read.value.kind !== 'qty') return out
  const q = read.value.q
  if (stage.round !== undefined) {
    if (stage.exact) out.push(stage.exact)
    if (stage.round > 0) out.push((q.n / q.d).toFixed(stage.round - 1))
    if (stage.lengthUnit) out.push(`${stage.answerText} ${stage.lengthUnit === 'ft' ? 'm' : 'ft'}`)
    return out
  }
  const v = approxQ(q)
  if (q.rad > 1) {
    out.push(v.toFixed(2), v.toFixed(3))
    // The same value with a perfect square left under the radical: the simplest-form note.
    if (q.n / q.d > 1 && q.d === 1) out.push(`sqrt(${q.n * q.n * q.rad})`)
  } else if (q.d > 1) out.push((v + 0.0004).toFixed(3))
  return out
}

/** Why this problem may not ship, or null. */
export function leakOf7(answer: GeometryAnswer, cards: readonly RuleCard[]): string | null {
  const displays = answer.stages.map((stage) => stageDisplay(stage))
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    if (RESERVED7_TEXT.has(display)) return `answer ${display} is reserved`
    const v = answerValue(stage)
    if (v && v.q.rad === 1 && RESERVED7_NUMBERS.has(v.q.n / v.q.d)) return `answer ${display} is reserved`
    if (v && !(v.q.n > 0)) return `answer ${display} is not positive`
  }
  const screenBlob = screenTexts7(answer).join('\n')
  for (const display of displays) if (shows7(screenBlob, display)) return `“${display}” is on screen before she answers`
  // An answer may not be a number the problem already gives: copying a given would be right.
  const given = givenValues7(answer)
  for (const stage of answer.stages) {
    const v = answerValue(stage)
    if (!v) continue
    const hit = v.rounded ? given.some((g) => g.rad === 1 && Math.abs(g.n / g.d - v.q.n / v.q.d) < 1e-9) : given.some((g) => sameQ(g, v.q))
    if (hit) return `${stage.id} answer ${stage.answerText} is a number the problem gives`
  }
  // A worked line shows its own answer, never a later part's.
  for (let i = 0; i < answer.stages.length; i++) {
    for (let j = i + 1; j < answer.stages.length; j++) {
      for (const line of answer.stages[i]!.reveal) if (shows7(line, displays[j]!)) return `${answer.stages[i]!.id} worked line shows the later answer ${displays[j]}`
    }
  }
  for (const [index, stage] of answer.stages.entries()) {
    const display = stageDisplay(stage)
    for (const text of retries(stage)) {
      const grade = gradeGeoStage(answer, stage.id, text)
      if (grade.verdict === 'correct') {
        if (text === '???' || text === '1001' || text === '0.001' || text === '' || text === 'not-a-choice') return `${stage.id} accepts nonsense`
        continue
      }
      // A note may quote what she typed; it must not show this part's answer or a later one (an earlier part is done).
      const said = grade.verdict === 'mistake' ? grade.witness : grade.message
      for (const other of displays.slice(index)) if (shows7(said, other)) return `${stage.id} message for “${text}” shows “${other}”`
    }
    for (const trap of stage.traps) {
      if (!isGeoMistake(trap.id)) return `${trap.id} is not a geometry mistake`
      for (const other of displays) if (shows7(trap.witness, other)) return `${stage.id} ${trap.id} witness shows “${other}”`
      const info = ERROR_PATTERNS[trap.id]
      if (shows7(`${info.title}\n${info.lesson}\n${info.example}`, display)) return `${stage.id} catalog ${trap.id} shows “${display}”`
      if (exampleShowsAnswer(info.example, display)) return `${stage.id} catalog example ${trap.id} shows ${display}`
    }
    for (const choice of stage.choices ?? []) if (answer.prompt.toLowerCase().includes(choice.text.toLowerCase())) return `the prompt prints the choice “${choice.text}”`
    for (const card of cards) {
      const example = card.example ?? ''
      if (shows7(example, display)) return `${stage.id} rule card ${card.id} example shows “${display}”`
      const result = example.split(/=|→/).pop()?.trim() ?? ''
      if (result && exampleShowsAnswer(result, display)) return `${stage.id} rule card ${card.id} result shows ${display}`
      if (!/[A-Za-z]{4}/.test(display) && shows7(card.body, display)) return `${stage.id} rule card ${card.id} body shows ${display}`
    }
  }
  return null
}

// --- figures -----------------------------------------------------------------------------------------------

type XYs = { x: number; y: number }

function distToSegment(p: XYs, a: XYs, b: XYs): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Each segment's label, as GeoFigure draws it, with the screen distance to its own segment and to the nearest other one. */
export function labelDistances(spec: GeoFigureSpec): { name: string; text: string; own: number; other: number; otherName: string; dimension: boolean }[] {
  const lay = figureLayout(spec)
  const { sx, sy } = layoutOf(spec)
  const at = (id: string): XYs => {
    const p = spec.points.find((pt) => pt.id === id)!
    return { x: sx(p.x), y: sy(p.y) }
  }
  const segs = spec.segments ?? []
  const boxes = lay.labels.filter((l) => l.kind === 'segment')
  const out: { name: string; text: string; own: number; other: number; otherName: string; dimension: boolean }[] = []
  let k = 0
  for (const seg of segs) {
    if (!seg.label) continue
    const box = boxes[k++]!
    const c = { x: (box.l + box.r) / 2, y: (box.t + box.b) / 2 }
    const own = distToSegment(c, at(seg.from), at(seg.to))
    let other = Infinity
    let otherName = ''
    for (const o of segs) {
      if (o === seg) continue
      const d = distToSegment(c, at(o.from), at(o.to))
      if (d < other) {
        other = d
        otherName = `${o.from}${o.to}`
      }
    }
    out.push({ name: `${seg.from}${seg.to}`, text: seg.label.trim(), own, other, otherName, dimension: seg.labelSide === 'below' })
  }
  return out
}

/**
 * How much nearer its own segment a label must be than any other: a label beside its segment by 10 px (so a label
 * inside a triangle never sits between two lines), a label on a dimension line, which its end ticks tie to the
 * segment, by 6 px.
 */
export const NEARER_BESIDE = 10
export const NEARER_DIMENSION = 6

/** Everything Unit 6's check finds, plus a segment label that sits nearly as near another segment as its own. */
export function figureIssues7(spec: GeoFigureSpec): string[] {
  const out = figureIssues6(spec)
  for (const d of labelDistances(spec)) {
    if (d.other < d.own + (d.dimension ? NEARER_DIMENSION : NEARER_BESIDE)) out.push(`the label ${d.text} of ${d.name} is nearly as near ${d.otherName} as its own segment`)
  }
  return out
}

function insidePolygon(pt: XYs, poly: readonly XYs[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** GeoFigure's normal for a segment's label: "above" is up the screen (left, for a nearly vertical segment). */
function sideNormal(a: XYs, b: XYs, side: 'above' | 'below'): XYs {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  let nx = -(b.y - a.y) / len
  let ny = (b.x - a.x) / len
  if (ny > 0 || (Math.abs(ny) < 0.25 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  return side === 'below' ? { x: -nx, y: -ny } : { x: nx, y: ny }
}

function onEdge(p: XYs, a: XYs, b: XYs): boolean {
  return distToSegment(p, a, b) < 0.5
}

/**
 * Give every labeled segment a side so the figure is clear and no label is misread. A piece of a longer segment (in
 * `parts`) always gets a dimension line, outside every outline. A side of an outline gets its one outside place: the
 * label beside it when "above" points out of the figure, else a dimension line. A segment inside the figure (an
 * altitude, a diagonal) tries beside it, then a dimension line. Null when no choice is clear.
 */
export function placeLabels7(spec: GeoFigureSpec, outlines: readonly (readonly string[])[], parts: ReadonlySet<number> = new Set()): GeoFigureSpec | null {
  const segs = spec.segments ?? []
  const { sx, sy } = layoutOf(spec)
  const at = (id: string): XYs => {
    const p = spec.points.find((q) => q.id === id)!
    return { x: sx(p.x), y: sy(p.y) }
  }
  const polys = outlines.map((ids) => ids.map(at))
  const outside = (pt: XYs) => !polys.some((poly) => insidePolygon(pt, poly))
  const options: ('above' | 'below')[][] = []
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!
    if (!seg.label) {
      options.push(['above'])
      continue
    }
    const a = at(seg.from)
    const b = at(seg.to)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const up = sideNormal(a, b, 'above')
    const down = sideNormal(a, b, 'below')
    const besideOut = outside({ x: mid.x + up.x * 14, y: mid.y + up.y * 14 })
    const dimOut = outside({ x: mid.x + down.x * 34, y: mid.y + down.y * 34 })
    if (parts.has(i)) {
      if (!dimOut) return null
      options.push(['below'])
      continue
    }
    const edge = polys.some((poly) => poly.some((p, k) => onEdge(a, p, poly[(k + 1) % poly.length]!) && onEdge(b, p, poly[(k + 1) % poly.length]!)))
    if (edge) {
      if (besideOut) options.push(['above'])
      else if (dimOut) options.push(['below'])
      else return null
      continue
    }
    options.push(['above', 'below'])
  }
  const total = options.reduce((n, o) => n * o.length, 1)
  for (let combo = 0; combo < total; combo++) {
    let rest = combo
    const next = segs.map((s, i) => {
      const opts = options[i]!
      const side = opts[rest % opts.length]!
      rest = Math.floor(rest / opts.length)
      if (!s.label) return { ...s }
      return { ...s, labelSide: side, label: side === 'below' ? dimLabel(s.label) : s.label.trim() }
    })
    const candidate = settlePointSides({ ...spec, segments: next })
    if (figureIssues7(candidate).length === 0) return candidate
  }
  return null
}

// --- the gate ----------------------------------------------------------------------------------------------

export interface Finish7 {
  question: GeometryQuestion
  prompt: string
  figure: GeoFigureSpec
  stages: Stage7[]
  /** Whole-number lengths the problem gives (for the shared check). */
  lengths: number[]
  title: string
  instructions: string
  params: Record<string, string | number | boolean>
  cards: readonly RuleCard[]
  /** Which slip the seed promises, most wanted first. Falls back to the first trap. */
  promise: readonly ErrorPatternId[]
  /** The part whose slip is promised when several parts have one. */
  promiseStage?: GeometryStageId
}

/** The finished problem, or null when it shows an answer, crowds or misleads in its figure, or is not English. */
export function finish7(o: Finish7): GeoBuilt | null {
  const traps = o.stages.flatMap((s) => s.traps.map((t) => ({ ...t, stage: s.id })))
  if (traps.length === 0) return refuse('no trap')
  let ordered = traps
  if (o.promiseStage) ordered = [...traps.filter((t) => t.stage === o.promiseStage), ...traps.filter((t) => t.stage !== o.promiseStage)]
  let picked = ordered[0]!
  for (const id of o.promise) {
    const hit = ordered.find((t) => t.id === id)
    if (hit) {
      picked = hit
      break
    }
  }
  const known = new Set(o.cards.map((c) => c.id))
  for (const s of o.stages) if (!known.has(s.ruleCard)) throw new Error(`${s.id}: rule card ${s.ruleCard} is not in this module`)
  const mistakeCards = traps.map((t) => GEO_RULE_FOR[t.id as keyof typeof GEO_RULE_FOR]).filter((id): id is string => Boolean(id) && known.has(id!))
  const cardIds = [...new Set([...o.stages.map((s) => s.ruleCard), ...mistakeCards])]
  const answer: GeometryAnswer = {
    type: 'geometry',
    question: o.question,
    prompt: o.prompt,
    figure: o.figure,
    stages: o.stages,
    lengths: o.lengths.filter((n) => Number.isInteger(n) && n > 0),
    angles: [],
    expectedDisplay: o.stages.map((s) => `${s.label}: ${stageDisplay(s)}`).join(' · '),
    reveal: o.stages.flatMap((s) => s.reveal),
    ruleCards: cardIds,
    trap: picked.id,
    trapStage: picked.stage,
    trapAnswer: picked.text,
  }
  for (const text of readTexts(answer)) {
    const issues = [...englishIssues(text), ...pluralIssues(text)]
    if (issues.length > 0) return refuse(`english: ${issues[0]}`)
  }
  if (o.figure.points.length > 0) {
    if (!o.figure.ariaLabel.trim()) return refuse('figure: no description')
    const issues = figureIssues7(o.figure)
    if (issues.length > 0) return refuse(`figure: ${issues[0]}`, o.figure, issues)
  }
  const leak = leakOf7(answer, o.cards)
  if (leak) return refuse(`leak: ${leak}`)
  for (const stage of o.stages) {
    if (gradeGeoStage(answer, stage.id, stage.answerText).verdict !== 'correct') return refuse(`${stage.id} answer does not grade`)
    for (const line of stage.reveal) if (answer.prompt.includes(line)) return refuse('reveal in prompt')
    for (const trap of stage.traps) {
      const g = gradeGeoStage(answer, stage.id, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) return refuse(`${stage.id} trap ${trap.id} grades ${g.verdict}`)
    }
  }
  try {
    assertGeoAnswer(o.title, answer)
  } catch (e) {
    return refuse(`shared check: ${e instanceof Error ? e.message : String(e)}`)
  }
  return { answer, title: o.title, instructions: o.instructions, params: o.params }
}

/** Unit lengths that do not agree with their number ("1 feet", "4 foot"); a decimal such as 37.1 takes the plural. */
function pluralIssues(text: string): string[] {
  const out: string[] = []
  if (/(?<![\d.])1 (?:feet|inches|meters|yards|miles|kilometers)\b/.test(text)) out.push(`a plural after 1: “${text}”`)
  if (/(?<![\d.])(?:[02-9]|\d{2,}) (?:foot|inch|meter|yard|mile|kilometer)\b(?!-)/.test(text)) out.push(`a singular after a number: “${text}”`)
  return out
}

/**
 * The trig core writes "In a 45°-45°-90° triangle"; Jurgensen's course (and the English check) say "the" before a
 * number. Only that article changes; the sentence is the core's.
 */
export function coreWords(text: string): string {
  return text.replace(/\b([Aa]) (\d)/g, (_m, a: string, d: string) => `${a === 'A' ? 'The' : 'the'} ${d}`)
}

function refuse(why: string, spec?: GeoFigureSpec, issues?: string[]): null {
  DEBUG7?.(why, spec, issues)
  return null
}

/** Set by a test to hear why the gate refused a draw (for tuning a generator); never set in the app. */
export let DEBUG7: ((why: string, spec?: GeoFigureSpec, issues?: string[]) => void) | null = null
export function setDebug7(fn: ((why: string, spec?: GeoFigureSpec, issues?: string[]) => void) | null): void {
  DEBUG7 = fn
}

// --- drawing helpers ---------------------------------------------------------------------------------------

export interface P2 {
  x: number
  y: number
}

/** Coordinates as the figure stores them: six decimals, so a small figure still has its right angles to a hundred-thousandth of a degree. */
const r6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Mirror (across the y-axis) when `reflect`, then turn by `turnDeg` about the origin. */
export function placeAll(pts: readonly P2[], turnDeg: number, reflect: boolean): P2[] {
  const t = (turnDeg * Math.PI) / 180
  return pts.map((p) => {
    const x = reflect ? -p.x : p.x
    return { x: x * Math.cos(t) - p.y * Math.sin(t), y: x * Math.sin(t) + p.y * Math.cos(t) }
  })
}

/** A labeled point, its letter set away from `center` (GeoFigure and settlePointSides move it off any line). */
export function pointOf(id: string, p: P2, center: P2, label: string = id): GeoPoint {
  const dx = p.x - center.x
  const dy = p.y - center.y
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  let side: NonNullable<GeoPoint['labelSide']>
  if (ay >= ax * 1.3) side = dy >= 0 ? 'above' : 'below'
  else if (ax >= ay * 1.3) side = dx >= 0 ? 'right' : 'left'
  else if (dx >= 0) side = dy >= 0 ? 'above-right' : 'below-right'
  else side = dy >= 0 ? 'above-left' : 'below-left'
  return { id, x: r6(p.x), y: r6(p.y), label, labelSide: side }
}

export function centerOf(pts: readonly P2[]): P2 {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
}

/** The smallest angle of a triangle, in degrees: a figure too thin to read is redrawn. */
export function smallestAngle(a: P2, b: P2, c: P2): number {
  const ang = (v: P2, p: P2, q: P2) => {
    const ux = p.x - v.x
    const uy = p.y - v.y
    const wx = q.x - v.x
    const wy = q.y - v.y
    return (Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))))) * 180) / Math.PI
  }
  return Math.min(ang(a, b, c), ang(b, a, c), ang(c, a, b))
}
