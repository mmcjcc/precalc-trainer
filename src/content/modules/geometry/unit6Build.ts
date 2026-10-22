/**
 * Shared building blocks for honors Unit 6 (similarity): the format hints, the values no template may use as an
 * answer, number and choice parts, the figure checks, and the last gate every problem passes before it ships. The gate
 * refuses a problem when anything she can read before she answers (the prompt, the figure, a hint, a nudge, a witness,
 * a catalog lesson or example, a rule card) shows a part's answer, when an answer equals a number the problem gives,
 * when a figure's labels would collide at 375 px, or when a sentence does not read as English. A generator that is
 * refused tries again with new numbers from the same seed.
 */
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer, GeometryQuestion, GeometryStageId, RuleCard } from '@/content/types'
import type { ErrorPatternId, GeoFigureSpec } from '@/shared/types'
import { readGeoAnswer, sameGeoValue } from './answer'
import type { GeoBuilt } from './build'
import { exampleShowsAnswer, exposed, gradeGeoStage, isGeoMistake, stageDisplay } from './grade'
import { choiceStage, englishIssues, type ChoiceDraft5 } from './unit5Build'
import { GEO_RULE_FOR } from './rules'
import { figureIssues, figureLayout, layoutOf, segmentHitsBox, textBox, VW, type Box, type Stroke } from './unit5Layout'
import type { GeoPoint } from '@/shared/types'

export const X_HINT6 = 'A number, like 23 or x = 23.'
export const LEN_HINT6 = 'A length, like 41.'
export const DEG_HINT6 = 'Degrees, like 67, 67°, or 67 deg.'
export const RATIO_HINT6 = 'A ratio, like 9/7 or 9:7.'
export const MEAN_HINT6 = 'A number or a simplest radical, like 41 or 2√7.'
export const FT_HINT6 = 'A length in feet, like 41 or 41 ft.'
export const M_HINT6 = 'A length in meters, like 41 or 41 m.'
export const PICK_HINT6 = 'Pick one.'

/**
 * No Unit 6 part has one of these as its answer: the numbers in the format hints (23, 41, 67), the 0 and 1 that a
 * ratio of two different lengths never is, and the 90 and 180 the rule cards and lessons name.
 */
export const RESERVED6_NUMBERS: ReadonlySet<number> = new Set([0, 1, 23, 41, 67, 90, 180])
/** The same for ratios and radicals: the hint examples. */
export const RESERVED6_TEXT: ReadonlySet<string> = new Set(['9/7', '7/9', '2√7'])

/** x for the Unit 6 templates: 2 to 30 with the reserved 23 left out. */
export const X_POOL6: readonly number[] = Array.from({ length: 29 }, (_, i) => i + 2).filter((n) => !RESERVED6_NUMBERS.has(n))

export type Stage6 = GeometryAnswer['stages'][number]

export interface TrapDraft6 {
  id: ErrorPatternId
  stage: GeometryStageId
  text: string
  witness: string
}

/** The value of a part's typed text, or null when it is not a number. */
function valueOf(text: string, ratio = false) {
  const r = readGeoAnswer(text, { ratio, allowUndefined: true })
  return r.ok ? r.value : null
}

function sameText(a: string, b: string, ratio: boolean): boolean {
  const va = valueOf(a, ratio)
  const vb = valueOf(b, ratio)
  if (!va || !vb) return a.trim() === b.trim()
  return sameGeoValue(va, vb)
}

/** Traps for one number part: never the answer, and never two with the same value (the first keeps it). */
export function trapsFor6(stage: GeometryStageId, answerText: string, drafts: readonly TrapDraft6[], ratio = false): Stage6['traps'] {
  const out: Stage6['traps'] = []
  for (const d of drafts) {
    if (d.stage !== stage) continue
    if (sameText(d.text, answerText, ratio)) continue
    if (out.some((t) => sameText(t.text, d.text, ratio))) continue
    out.push({ id: d.id, text: d.text, witness: d.witness })
  }
  return out
}

export function numberStage6(opts: {
  id: GeometryStageId
  label: string
  hint: string
  answerText: string
  nudge: string
  ruleCard: string
  reveal: string[]
  traps: readonly TrapDraft6[]
  deg?: boolean
  ratio?: boolean
  lengthUnit?: 'ft' | 'm'
}): Stage6 {
  return {
    id: opts.id,
    kind: 'number',
    ...(opts.deg ? { unit: 'deg' as const } : {}),
    ...(opts.ratio ? { ratio: true } : {}),
    ...(opts.lengthUnit ? { lengthUnit: opts.lengthUnit } : {}),
    label: opts.label,
    hint: opts.hint,
    answerText: opts.answerText,
    nudge: opts.nudge,
    ruleCard: opts.ruleCard,
    reveal: opts.reveal,
    traps: trapsFor6(opts.id, opts.answerText, opts.traps, opts.ratio === true),
  }
}

export type ChoiceDraft6 = ChoiceDraft5

/** A pick-one part; the order of the choices comes from the seed. */
export function choiceStage6(opts: {
  id: GeometryStageId
  label: string
  hint?: string
  choices: ChoiceDraft6[]
  answerId: string
  nudge: string
  ruleCard: string
  reveal: string[]
  seed: number
  salt: number
  keepOrder?: boolean
}): Stage6 {
  return choiceStage({ ...opts, hint: opts.hint ?? PICK_HINT6 })
}

// --- what she reads ----------------------------------------------------------------------------------------

/** A word answer is found whole and in any case; a number or a short word is found as its own token. */
export function shows6(blob: string, display: string): boolean {
  const d = display.trim()
  if (!d || !blob) return false
  if (/[A-Za-z]{4}/.test(d)) return blob.toLowerCase().includes(d.toLowerCase())
  return exposed(blob, d) || (d.includes('-') && exposed(blob, d.replace(/-/g, '−')))
}

/** Everything on screen before she answers: the prompt, the figure's words and labels, every part's hint, nudge and note. */
export function screenTexts(answer: GeometryAnswer): string[] {
  const out: string[] = [answer.prompt, answer.figure.ariaLabel, ...(answer.lines ?? [])]
  for (const p of answer.figure.points) out.push(p.label ?? '')
  for (const s of answer.figure.segments ?? []) if (s.label) out.push(s.label)
  for (const a of answer.figure.angles ?? []) if (a.label) out.push(a.label)
  for (const l of answer.figure.lines ?? []) if (l.label) out.push(l.label)
  for (const stage of answer.stages) out.push(stage.hint, stage.nudge, stage.note ?? '')
  return out
}

/** The numbers the problem gives: every integer or decimal written in the prompt or on the figure. */
export function givenNumbers(answer: GeometryAnswer): number[] {
  const texts = [answer.prompt, ...(answer.figure.segments ?? []).map((s) => s.label ?? ''), ...(answer.figure.angles ?? []).map((a) => a.label ?? '')]
  const out: number[] = []
  for (const text of texts) for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) out.push(Number(m[0]))
  return out
}

/** A number part's answer as a JS number, or null (a radical, a pick). */
function plainNumber(stage: Stage6): number | null {
  if (stage.kind !== 'number') return null
  const r = readGeoAnswer(stage.answerText, { ratio: stage.ratio === true })
  if (!r.ok || r.value.kind !== 'qty' || r.value.q.rad !== 1) return null
  return r.value.q.n / r.value.q.d
}

/** Why this problem may not ship, or null. */
export function leakOf6(answer: GeometryAnswer, cards: readonly RuleCard[]): string | null {
  const displays = answer.stages.map((stage) => stageDisplay(stage))
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    if (RESERVED6_TEXT.has(display)) return `answer ${display} is reserved`
    const n = plainNumber(stage)
    if (n !== null && RESERVED6_NUMBERS.has(n)) return `answer ${display} is reserved`
    if (n !== null && !(n > 0)) return `answer ${display} is not positive`
  }
  const screenBlob = screenTexts(answer).join('\n')
  for (const display of displays) if (shows6(screenBlob, display)) return `“${display}” is on screen before she answers`
  // An answer may not be a number the problem already gives (copying a given would be right).
  const given = givenNumbers(answer)
  for (const stage of answer.stages) {
    const n = plainNumber(stage)
    if (n !== null && given.some((g) => Math.abs(g - n) < 1e-9)) return `${stage.id} answer ${stage.answerText} is a number the problem gives`
  }
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    const nonsense = stage.kind === 'choice' ? ['', 'not-a-choice'] : ['???', '1001', '0.001']
    const replies = nonsense.map((text) => gradeGeoStage(answer, stage.id, text))
    if (replies.some((grade) => grade.verdict === 'correct')) return `${stage.id} accepts nonsense`
    // What she is told when she retries: a degree sign on a length, the other unit, a calculator decimal.
    if (stage.kind === 'number') {
      if (stage.unit !== 'deg') replies.push(gradeGeoStage(answer, stage.id, `${stage.answerText}°`))
      if (stage.lengthUnit) replies.push(gradeGeoStage(answer, stage.id, `${stage.answerText} ${stage.lengthUnit === 'ft' ? 'm' : 'ft'}`))
      const n = plainNumber(stage)
      if (n !== null && !Number.isInteger(n)) replies.push(gradeGeoStage(answer, stage.id, (n + 0.0004).toFixed(3)))
    }
    for (const grade of replies) {
      if (grade.verdict === 'correct') continue
      const said = grade.verdict === 'mistake' ? grade.witness : grade.message
      if (shows6(said, display)) return `${stage.id} message shows “${display}”`
    }
    for (const trap of stage.traps) {
      if (!isGeoMistake(trap.id)) return `${trap.id} is not a geometry mistake`
      for (const other of displays) if (shows6(trap.witness, other)) return `${stage.id} ${trap.id} witness shows “${other}”`
      const info = ERROR_PATTERNS[trap.id]
      if (shows6(`${info.title}\n${info.lesson}\n${info.example}`, display)) return `${stage.id} catalog ${trap.id} shows “${display}”`
      if (exampleShowsAnswer(info.example, display)) return `${stage.id} catalog example ${trap.id} shows ${display}`
    }
    for (const choice of stage.choices ?? []) if (answer.prompt.includes(choice.text)) return `the prompt prints the choice “${choice.text}”`
    for (const card of cards) {
      const example = card.example ?? ''
      if (shows6(example, display)) return `${stage.id} rule card ${card.id} example shows “${display}”`
      const result = example.split(/=|→/).pop()?.trim() ?? ''
      if (result && exampleShowsAnswer(result, display)) return `${stage.id} rule card ${card.id} result shows ${display}`
      if (!/[A-Za-z]{4}/.test(display) && shows6(card.body, display)) return `${stage.id} rule card ${card.id} body shows ${display}`
    }
  }
  return null
}

// --- figures -----------------------------------------------------------------------------------------------

/** The dimension line GeoFigure draws for a "below" label: its two ends, 34 px off the segment. */
function dimensionEnds(a: { x: number; y: number }, b: { x: number; y: number }): [Stroke, { x: number; y: number }] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  let nx = -(b.y - a.y) / len
  let ny = (b.x - a.x) / len
  if (ny > 0 || (Math.abs(ny) < 0.25 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  // "below" is the other side.
  nx = -nx
  ny = -ny
  return [[a.x + nx * 34, a.y + ny * 34, b.x + nx * 34, b.y + ny * 34], { x: nx, y: ny }]
}

function crossesStroke([x1, y1, x2, y2]: Stroke, [x3, y3, x4, y4]: Stroke): boolean {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
  if (Math.abs(d) < 1e-12) return false
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d
  return t > 0 && t < 1 && u > 0 && u < 1
}

/**
 * What would make a Unit 6 figure hard to read at 375 px: everything Unit 5's check finds (a label off the figure,
 * on a line, on another label, on a dot or a mark; a dimension line through a label), plus a dimension line that
 * leaves the figure or crosses a drawn line, a segment, or another dimension line away from its own ends.
 */
export function figureIssues6(spec: GeoFigureSpec): string[] {
  const out = figureIssues(spec)
  const lay = figureLayout(spec)
  const { sx, sy } = layoutOf(spec)
  const at = (id: string) => {
    const p = spec.points.find((q) => q.id === id)!
    return { x: sx(p.x), y: sy(p.y) }
  }
  const dims: { name: string; line: Stroke }[] = []
  for (const seg of spec.segments ?? []) {
    if (!seg.label || seg.labelSide !== 'below') continue
    const [line] = dimensionEnds(at(seg.from), at(seg.to))
    dims.push({ name: `${seg.from}${seg.to}`, line })
  }
  const shrink = ([x1, y1, x2, y2]: Stroke, by: number): Stroke => {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    const ux = ((x2 - x1) / len) * by
    const uy = ((y2 - y1) / len) * by
    return [x1 + ux, y1 + uy, x2 - ux, y2 - uy]
  }
  // An angle's number with no arc has to sit inside its own angle, near the vertex, or it reads as another angle's.
  const angleLabels = lay.labels.filter((l) => l.kind === 'angle')
  let next = 0
  for (const angle of spec.angles ?? []) {
    if (!angle.label || angle.right) continue
    const box = angleLabels[next++]
    if (!box || angle.arc !== false) continue
    const c = { x: (box.l + box.r) / 2, y: (box.t + box.b) / 2 }
    const v = at(angle.vertex)
    const tri = [v, at(angle.from), at(angle.to)]
    if (!insidePolygon(c, tri) || Math.hypot(c.x - v.x, c.y - v.y) > 70) out.push(`the label ${angle.label} is not inside its angle at ${angle.vertex}`)
  }
  for (const dim of dims) {
    const [x1, y1, x2, y2] = dim.line
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ] as const) {
      if (x < 4 || y < 4 || x > lay.width - 4 || y > lay.height - 4) out.push(`the dimension line of ${dim.name} leaves the figure`)
    }
    const inner = shrink(dim.line, 9)
    for (const stroke of lay.strokes) if (crossesStroke(inner, stroke)) out.push(`the dimension line of ${dim.name} crosses a line`)
    for (const other of dims) if (other !== dim && crossesStroke(inner, shrink(other.line, 9))) out.push(`the dimension lines of ${dim.name} and ${other.name} cross`)
    for (const dot of lay.dots) if (segmentHitsBox(inner, dot, 0)) out.push(`the dimension line of ${dim.name} runs through a point`)
  }
  return out
}

/** Is the point inside the polygon (screen units)? */
function insidePolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

type Side = NonNullable<GeoPoint['labelSide']>

/** GeoFigure's offsets for a point's letter. */
const POINT_SHIFT: Record<Side, [number, number, 'start' | 'middle' | 'end']> = {
  above: [0, -12, 'middle'],
  below: [0, 16, 'middle'],
  left: [-10, 0, 'end'],
  right: [10, 0, 'start'],
  'above-left': [-8, -10, 'end'],
  'above-right': [8, -10, 'start'],
  'below-left': [-8, 14, 'end'],
  'below-right': [8, 14, 'start'],
}
const SIDE_ORDER: readonly Side[] = ['above', 'below', 'right', 'left', 'above-right', 'above-left', 'below-right', 'below-left']
const overlapping = (p: Box, q: Box) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b

/**
 * Each point's letter on a side that is clear of the drawn lines, the dimension lines, the dots, the segment labels and
 * the letters before it. GeoFigure keeps a letter's own side whenever that side is clear of its lines, dots and the
 * earlier letters, so it draws each letter exactly here; it does not know about dimension lines, which is why this is
 * done before it draws.
 */
export function settlePointSides(spec: GeoFigureSpec): GeoFigureSpec {
  const lay = figureLayout(spec)
  const { sx, sy } = layoutOf(spec)
  const segLabels = lay.labels.filter((l) => l.kind === 'segment')
  const dots: Box[] = spec.points.map((p) => ({ l: sx(p.x) - 6, t: sy(p.y) - 6, r: sx(p.x) + 6, b: sy(p.y) + 6 }))
  const boxOf = (p: GeoPoint, side: Side) => {
    const [dx, dy, anchor] = POINT_SHIFT[side]
    return textBox(sx(p.x) + dx, sy(p.y) + dy, p.label ?? p.id, 14, anchor)
  }
  const taken: Box[] = []
  const points = spec.points.map((p) => ({ ...p }))
  points.forEach((p, i) => {
    if (!p.label) return
    const prefer = p.labelSide ?? 'above'
    const fits = (side: Side) => {
      const b = boxOf(p, side)
      return (
        b.l >= 2 &&
        b.r <= VW - 2 &&
        b.t >= 2 &&
        b.b <= lay.height - 2 &&
        !lay.strokes.some((st) => segmentHitsBox(st, b, 2)) &&
        !lay.dimStrokes.some((st) => segmentHitsBox(st, b, 2)) &&
        !taken.some((t) => overlapping(t, b)) &&
        !dots.some((d, j) => j !== i && overlapping(d, b)) &&
        !segLabels.some((l) => overlapping(l, b))
      )
    }
    const side = [prefer, ...SIDE_ORDER.filter((x) => x !== prefer)].find(fits) ?? prefer
    p.labelSide = side
    taken.push(boxOf(p, side))
  })
  return { ...spec, points }
}

/**
 * GeoFigure leaves a gap of 3.8 px a character, plus 6, in a dimension line for its label. A one-character label on a
 * slanted line ("x", "4") reaches past that gap, so it is written with a space on each side: SVG drops the spaces when
 * it draws the text, and the gap is wide enough.
 */
export function dimLabel(label: string): string {
  const t = label.trim()
  return t.length === 1 ? ` ${t} ` : t
}

/**
 * Give every labeled segment a side so the whole figure is clear. Segments in `parts` (a piece of a longer segment)
 * always get a dimension line ("below"), which has to lie outside every outline; the others try a label beside the
 * segment first, then a dimension line outside the outlines. Null when no choice is clear.
 */
export function placeLabels6(spec: GeoFigureSpec, outlines: readonly (readonly string[])[], parts: ReadonlySet<number> = new Set()): GeoFigureSpec | null {
  const segs = spec.segments ?? []
  const labeled = segs.map((s, i) => (s.label ? i : -1)).filter((i) => i >= 0)
  const free = labeled.filter((i) => !parts.has(i))
  const { sx, sy } = layoutOf(spec)
  const polys = outlines.map((ids) =>
    ids.map((id) => {
      const p = spec.points.find((q) => q.id === id)!
      return { x: sx(p.x), y: sy(p.y) }
    }),
  )
  const at = (id: string) => {
    const p = spec.points.find((q) => q.id === id)!
    return { x: sx(p.x), y: sy(p.y) }
  }
  const outside = (index: number): boolean => {
    const seg = segs[index]!
    const [line] = dimensionEnds(at(seg.from), at(seg.to))
    const mid = { x: (line[0] + line[2]) / 2, y: (line[1] + line[3]) / 2 }
    return !polys.some((poly) => insidePolygon(mid, poly))
  }
  for (const index of parts) {
    if (!segs[index]?.label || !outside(index)) {
      DEBUG6?.(`labels: the piece ${segs[index]?.from}${segs[index]?.to} has no room outside`)
      return null
    }
  }
  let best: string[] | null = null
  let bestSpec: GeoFigureSpec = spec
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const next = segs.map((s) => ({ ...s }))
    let ok = true
    for (const index of parts) {
      next[index]!.labelSide = 'below'
      next[index]!.label = dimLabel(next[index]!.label!)
    }
    free.forEach((index, bit) => {
      const side = mask & (1 << bit) ? 'below' : 'above'
      next[index]!.labelSide = side
      next[index]!.label = side === 'below' ? dimLabel(next[index]!.label!) : next[index]!.label!.trim()
      if (side === 'below' && !outside(index)) ok = false
    })
    if (!ok) continue
    const candidate: GeoFigureSpec = settlePointSides({ ...spec, segments: next })
    const issues = figureIssues6(candidate)
    if (issues.length === 0) return candidate
    if (!best || issues.length < best.length) {
      best = issues
      bestSpec = candidate
    }
  }
  if (best) DEBUG6?.(`labels: ${best[0]}`, bestSpec, best)
  return null
}

// --- the gate ----------------------------------------------------------------------------------------------

export interface Finish6 {
  question: GeometryQuestion
  prompt: string
  figure: GeoFigureSpec
  stages: Stage6[]
  lengths: number[]
  angles: number[]
  title: string
  instructions: string
  params: Record<string, string | number | boolean>
  cards: readonly RuleCard[]
  /** Which slip the seed promises, most wanted first. Falls back to the first believable trap. */
  promise: readonly ErrorPatternId[]
  /** The part whose slip is promised when several parts have one. */
  promiseStage?: GeometryStageId
}

/** Every sentence she reads that the gate holds to English: the prompt, the figure's words, hints, nudges, notes, witnesses, worked lines. */
export function readTexts(answer: GeometryAnswer): string[] {
  const out = [answer.prompt, answer.figure.ariaLabel]
  for (const stage of answer.stages) {
    out.push(stage.hint, stage.nudge, ...stage.reveal, ...(stage.note ? [stage.note] : []))
    for (const trap of stage.traps) out.push(trap.witness)
    for (const choice of stage.choices ?? []) if (choice.witness) out.push(choice.witness)
  }
  return out.filter(Boolean)
}

/** The finished problem, or null when it shows an answer, crowds its figure, or does not read as English. */
export function finish6(o: Finish6): GeoBuilt | null {
  const traps = o.stages.flatMap((s) => s.traps.map((t) => ({ ...t, stage: s.id })))
  if (traps.length === 0) return null
  const first = (list: typeof traps, keep: (t: (typeof traps)[number]) => boolean) => [...list.filter(keep), ...list.filter((t) => !keep(t))]
  // A slip she would believe is promised first: a positive whole number or a pick, not a fraction or a negative.
  const believable = (t: (typeof traps)[number]) => (/^\d+$/.test(t.text) ? Number(t.text) > 0 : !/^-?\d/.test(t.text) || /^\d+(\.\d+)?$/.test(t.text))
  let ordered = first(traps, believable)
  if (o.promiseStage) ordered = first(ordered, (t) => t.stage === o.promiseStage)
  let picked = ordered[0]!
  search: for (const onlyBelievable of [true, false]) {
    for (const id of o.promise) {
      const hit = ordered.find((t) => t.id === id && (!onlyBelievable || believable(t)))
      if (hit) {
        picked = hit
        break search
      }
    }
  }
  const known = new Set(o.cards.map((c) => c.id))
  for (const s of o.stages) if (!known.has(s.ruleCard)) throw new Error(`${s.id}: rule card ${s.ruleCard} is not in this module`)
  // The part's own cards first, then the card each named slip opens, where this module has it.
  const mistakeCards = traps.map((t) => GEO_RULE_FOR[t.id as keyof typeof GEO_RULE_FOR]).filter((id): id is string => Boolean(id) && known.has(id!))
  const cardIds = [...new Set([...o.stages.map((s) => s.ruleCard), ...mistakeCards])]
  const answer: GeometryAnswer = {
    type: 'geometry',
    question: o.question,
    prompt: o.prompt,
    figure: o.figure,
    stages: o.stages,
    lengths: o.lengths,
    angles: o.angles,
    expectedDisplay: o.stages.map((s) => `${s.label}: ${stageDisplay(s)}`).join(' · '),
    reveal: o.stages.flatMap((s) => s.reveal),
    ruleCards: cardIds,
    trap: picked.id,
    trapStage: picked.stage,
    trapAnswer: picked.text,
  }
  const refuse = (why: string): null => {
    DEBUG6?.(why)
    return null
  }
  for (const text of readTexts(answer)) if (englishIssues(text).length > 0) return refuse(`english: ${englishIssues(text)[0]}`)
  if (o.figure.points.length > 0) {
    const issues = figureIssues6(o.figure)
    if (issues.length > 0) return refuse(`figure: ${issues[0]}`)
  }
  const leak = leakOf6(answer, o.cards)
  if (leak) return refuse(`leak: ${leak}`)
  for (const stage of o.stages) {
    if (gradeGeoStage(answer, stage.id, stage.answerText).verdict !== 'correct') return refuse(`${stage.id} answer does not grade`)
    for (const line of stage.reveal) if (answer.prompt.includes(line)) return refuse('reveal in prompt')
    for (const trap of stage.traps) {
      const g = gradeGeoStage(answer, stage.id, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) return refuse(`${stage.id} trap ${trap.id} grades ${g.verdict}`)
    }
  }
  return { answer, title: o.title, instructions: o.instructions, params: o.params }
}

/** Set by a test to hear why the gate refused a draw (for tuning a generator); never set in the app. */
export let DEBUG6: ((why: string, spec?: GeoFigureSpec, issues?: string[]) => void) | null = null
export function setDebug6(fn: ((why: string, spec?: GeoFigureSpec, issues?: string[]) => void) | null): void {
  DEBUG6 = fn
}
