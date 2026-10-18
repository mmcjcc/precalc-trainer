/**
 * Unit 3 solved again from the wording, over 2000 seeds. The angle numbers are classified from the
 * positions in the figure's description, not from the generator's table. A prompt true for every x,
 * a slope with two answers, or a note that contains the answer fails here.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec, ModuleId } from '@/shared/types'
import { rat, ratAdd, ratDiv, ratMul, ratSub, ratToString, type Rational } from '@/notation'
import { containsAnswer, exampleShowsAnswer, gradeGeoStage, stageDisplay } from './grade'
import { lineSlope, readLine, sameLine, type LineEq } from './lines'
import { PARALLEL_RULES, POLYGON_RULES } from './unit3Rules'

const HEAVY = 120_000
const SEEDS = 2000

const TEMPLATES = [
  ['geoParallel', 'gl3.pairs', PARALLEL_RULES],
  ['geoParallel', 'gl3.solve', PARALLEL_RULES],
  ['geoParallel', 'gl3.converse', PARALLEL_RULES],
  ['geoParallel', 'gl3.slopes', PARALLEL_RULES],
  ['geoPolygonAngles', 'gpa.triangle', POLYGON_RULES],
  ['geoPolygonAngles', 'gpa.polygon', POLYGON_RULES],
] as const

type Rel = 'corr' | 'alt-int' | 'alt-ext' | 'ssi' | 'vert' | 'linear' | 'none'
type Lin = [Rational, Rational]

function problem(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error('not geometry')
  return p.answer
}

/** Upper crossing: 1 upper-left, 2 upper-right, 3 lower-right, 4 lower-left. Lower crossing: 5–8 the same way. */
function slot(n: number): { cross: 0 | 1; side: 'L' | 'R'; band: 'above' | 'below' } {
  if (n < 1 || n > 8) throw new Error(`angle ${n}`)
  const i = (n - 1) % 4
  return {
    cross: n <= 4 ? 0 : 1,
    side: i === 0 || i === 3 ? 'L' : 'R',
    band: i <= 1 ? 'above' : 'below',
  }
}

/** Between the two lines: below the upper line, or above the lower line. */
function interior(n: number): boolean {
  const s = slot(n)
  return (s.cross === 0 && s.band === 'below') || (s.cross === 1 && s.band === 'above')
}

function relation(a: number, b: number): Rel {
  const A = slot(a)
  const B = slot(b)
  if (A.cross === B.cross) {
    const side = A.side === B.side
    const band = A.band === B.band
    if (side && band) throw new Error('the same angle')
    if (!side && !band) return 'vert'
    return 'linear'
  }
  if (A.side === B.side && A.band === B.band) return 'corr'
  const inn = interior(a) && interior(b)
  const out = !interior(a) && !interior(b)
  if (inn && A.side !== B.side) return 'alt-int'
  if (out && A.side !== B.side) return 'alt-ext'
  if (inn && A.side === B.side) return 'ssi'
  return 'none'
}

function parallelFact(rel: Rel): boolean {
  return rel === 'corr' || rel === 'alt-int' || rel === 'alt-ext' || rel === 'ssi'
}

function lin(text: string): Lin {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '')
  const m = /^([+-]?\d*)x([+-]\d+)?$/.exec(s)
  if (m) {
    const c = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
    return [rat(c), rat(Number(m[2] ?? 0))]
  }
  if (/^[+-]?\d+$/.test(s)) return [rat(0), rat(Number(s))]
  throw new Error(`not a linear expression: ${text}`)
}

const at = (e: Lin, x: Rational) => ratAdd(ratMul(e[0], x), e[1])
const plus = (a: Lin, b: Lin): Lin => [ratAdd(a[0], b[0]), ratAdd(a[1], b[1])]

/** The one x with left = right, or null when every x works or none does. */
function solve(left: Lin, right: Lin): Rational | null {
  const c = ratSub(left[0], right[0])
  if (c.n === 0) return null
  return ratDiv(ratSub(right[1], left[1]), c)
}

function one(left: Lin, right: Lin, where: string): Rational {
  const x = solve(left, right)
  expect(x, `no single solution: ${where}`).not.toBeNull()
  return x!
}

function perpSlope(m: Rational | null): Rational | null {
  if (m === null) return rat(0)
  if (m.n === 0) return null
  return rat(-m.d, m.n)
}

function slopeText(m: Rational | null): string {
  return m === null ? 'undefined' : ratToString(m)
}

function parseLine(text: string, where: string): LineEq {
  const read = readLine(text)
  expect(read.ok, `${where}: ${text}`).toBe(true)
  if (!read.ok) throw new Error(text)
  return read.line
}

function slopeOf(text: string, where: string): Rational | null {
  return lineSlope(parseLine(text, where))
}

/** The one line through (px, py) with this slope. Vertical when the slope is missing. */
function lineThrough(slope: Rational | null, px: number, py: number): LineEq {
  if (slope === null) return parseLine(`x = ${px}`, 'vertical')
  if (slope.n === 0) return parseLine(`y = ${py}`, 'horizontal')
  return parseLine(`y - (${py}) = (${slope.n}/${slope.d})*(x - (${px}))`, 'through')
}

function integerText(text: string): number | null {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '')
  return /^-?\d+$/.test(s) ? Number(s) : null
}

function wedge(v: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x)
  const a2 = Math.atan2(b.y - v.y, b.x - v.x)
  let d = a2 - a1
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  return (Math.abs(d) * 180) / Math.PI
}

function point(fig: GeoFigureSpec, id: string): { x: number; y: number } {
  const p = fig.points.find((item) => item.id === id)
  if (!p) throw new Error(`missing ${id}`)
  return p
}

function labeled(fig: GeoFigureSpec, label: string): number {
  const ang = (fig.angles ?? []).find((item) => item.label === label)
  if (!ang) throw new Error(`no angle labeled ${label}`)
  return wedge(point(fig, ang.vertex), point(fig, ang.from), point(fig, ang.to))
}

function near(got: number, want: number, where: string) {
  expect(Math.abs(got - want), `${where}: drew ${got}, want ${want}`).toBeLessThan(1.5)
}

function openAngle(n: number, where: string) {
  expect(n > 0 && n < 180, `${where} angle ${n}`).toBe(true)
}

function stageText(answer: GeometryAnswer, label: string): string {
  const stage = answer.stages.find((item) => item.label === label)
  if (!stage) throw new Error(`no part “${label}”`)
  return stage.answerText
}

function pairMeasures(fig: GeoFigureSpec): { a: number; b: number } {
  const a = labeled(fig, '3')
  const b = labeled(fig, '7')
  return { a, b }
}

function convexCount(fig: GeoFigureSpec): number {
  const vs = fig.points.filter((p) => /^V\d+$/.test(p.id)).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
  expect(vs.length).toBeGreaterThanOrEqual(3)
  let sign = 0
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i]!
    const b = vs[(i + 1) % vs.length]!
    const c = vs[(i + 2) % vs.length]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    expect(Math.abs(cross), 'flat polygon').toBeGreaterThan(1e-4)
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else expect(s, 'not convex').toBe(sign)
  }
  return vs.length
}

function drawnSlope(fig: GeoFigureSpec, index: number): Rational | null {
  const line = fig.lines?.[index]
  if (!line) throw new Error(`no drawn line ${index}`)
  const a = point(fig, line.through[0])
  const b = point(fig, line.through[1])
  if (Math.abs(b.x - a.x) < 0.02) {
    expect(Math.abs(b.y - a.y)).toBeGreaterThan(0.5)
    return null
  }
  const rise = b.y - a.y
  const run = b.x - a.x
  return rat(Math.round((rise / run) * 1000), 1000)
}

function slopesAgree(drawn: Rational | null, want: Rational | null, where: string) {
  if (want === null || drawn === null) {
    expect(drawn, where).toBeNull()
    expect(want, where).toBeNull()
    return
  }
  expect(Math.abs(drawn.n / drawn.d - want.n / want.d), where).toBeLessThan(0.02)
}

function leaks(answer: GeometryAnswer, cards: readonly { title: string; body: string; example?: string }[]): string[] {
  const errors: string[] = []
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    const garbage = stage.kind === 'choice' ? ['', 'not-a-listed-choice'] : ['???', '1001', 'banana']
    for (const raw of garbage) {
      const grade = gradeGeoStage(answer, stage.id, raw)
      if (grade.verdict === 'correct') continue
      const said = grade.verdict === 'mistake' ? grade.witness : grade.message
      if (containsAnswer(said, display)) errors.push(`${stage.id} message contains “${display}”`)
    }
    for (const trap of stage.traps) {
      if (containsAnswer(trap.witness, display)) errors.push(`${stage.id} witness contains “${display}”`)
      const info = ERROR_PATTERNS[trap.id]
      const blob = `${info.title}\n${info.lesson}\n${info.example}`
      if (containsAnswer(blob, display) || exampleShowsAnswer(info.example, display)) {
        errors.push(`${stage.id} catalog ${trap.id} contains “${display}”`)
      }
    }
    for (const card of cards) {
      const blob = `${card.title}\n${card.body}\n${card.example ?? ''}`
      const result = (card.example ?? '').split(/=|→/).pop()?.trim() ?? ''
      if (containsAnswer(blob, display) || (result && exampleShowsAnswer(result, display))) {
        errors.push(`${stage.id} rule card contains “${display}”`)
      }
    }
    for (const said of [stage.hint, stage.nudge, stage.note ?? '']) {
      if (containsAnswer(said, display)) errors.push(`${stage.id} shows “${display}” in ${said}`)
    }
  }
  return errors
}

function auditPairs(answer: GeometryAnswer) {
  const m = /^Lines m and n are cut by a transversal\. What is the relationship between ∠(\d) and ∠(\d)\?$/.exec(answer.prompt)
  if (!m) throw new Error(`unread pairs: ${answer.prompt}`)
  const a = Number(m[1])
  const b = Number(m[2])
  expect(stageText(answer, 'The relationship')).toBe(relation(a, b))
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) openAngle(labeled(answer.figure, String(n)), answer.prompt)
  const gap = Math.abs(pairMeasures(answer.figure).a - pairMeasures(answer.figure).b)
  expect(gap, answer.prompt).toBeGreaterThan(2)
}

function auditSolve(answer: GeometryAnswer) {
  const m = /^Lines m and n are parallel and are cut by a transversal\. ∠(\d) = \(([^)]+)\)° and ∠(\d) = \(([^)]+)\)°\. Find x, then m∠(\d)\.$/.exec(answer.prompt)
  if (!m) throw new Error(`unread solve: ${answer.prompt}`)
  const a = Number(m[1])
  const left = lin(m[2]!)
  const b = Number(m[3])
  const right = lin(m[4]!)
  const ask = Number(m[5])
  const rel = relation(a, b)
  expect(parallelFact(rel), answer.prompt).toBe(true)
  const x = rel === 'ssi' ? one(plus(left, right), [rat(0), rat(180)], answer.prompt) : one(left, right, answer.prompt)
  expect(ask === a || ask === b, answer.prompt).toBe(true)
  const asked = at(ask === a ? left : right, x)
  expect(asked.d, answer.prompt).toBe(1)
  openAngle(asked.n, answer.prompt)
  openAngle(at(left, x).n, answer.prompt)
  openAngle(at(right, x).n, answer.prompt)
  expect(stageText(answer, 'x')).toBe(ratToString(x))
  expect(stageText(answer, `m∠${ask}`)).toBe(ratToString(asked))
  const drawn = pairMeasures(answer.figure)
  expect(Math.abs(drawn.a - drawn.b), answer.prompt).toBeLessThan(1.5)
  near(labeled(answer.figure, String(a)), at(left, x).n, answer.prompt)
  near(labeled(answer.figure, String(b)), at(right, x).n, answer.prompt)
}

function fits(rel: Rel, left: number, right: number): boolean {
  if (rel === 'ssi') return left + right === 180
  if (parallelFact(rel)) return left === right
  return false
}

/**
 * What two given measures show. A deciding pair settles it both ways: parallel when the measures fit,
 * not parallel when they do not (parallel lines would make them fit). Two angles at one crossing fit
 * whatever the lines do, so they cannot tell.
 */
function verdictOf(rel: Rel, left: number, right: number): 'yes' | 'no' | 'cant' {
  if (!parallelFact(rel)) return 'cant'
  return fits(rel, left, right) ? 'yes' : 'no'
}

function auditConverse(answer: GeometryAnswer) {
  const numbers = /^∠(\d) = (\d+)° and ∠(\d) = (\d+)°\. Are lines m and n parallel\? Name the angle pair that decides it\.$/.exec(answer.prompt)
  const findX = /^∠(\d) = \(([^)]+)\)° and ∠(\d) = \(([^)]+)\)°\. Find x so that lines m and n are parallel, and name the fact that decides it\.$/.exec(answer.prompt)
  if (numbers) {
    const a = Number(numbers[1])
    const left = Number(numbers[2])
    const b = Number(numbers[3])
    const right = Number(numbers[4])
    openAngle(left, answer.prompt)
    openAngle(right, answer.prompt)
    const rel = relation(a, b)
    // Any other pair at the two crossings decides the lines in two steps, so it is never asked here.
    expect(rel, answer.prompt).not.toBe('none')
    // A figure exists only if vertical angles match and a linear pair adds to 180.
    if (rel === 'vert') expect(left, answer.prompt).toBe(right)
    if (rel === 'linear') expect(left + right, answer.prompt).toBe(180)
    const verdict = verdictOf(rel, left, right)
    expect(stageText(answer, 'Parallel?')).toBe(verdict)
    expect(stageText(answer, 'The angle pair')).toBe(parallelFact(rel) ? rel : 'none')
    near(labeled(answer.figure, String(a)), left, answer.prompt)
    near(labeled(answer.figure, String(b)), right, answer.prompt)
    // ∠3 and ∠7 correspond, so they are drawn equal exactly when the lines are drawn parallel.
    // A can't-tell figure may be drawn either way.
    const gap = Math.abs(pairMeasures(answer.figure).a - pairMeasures(answer.figure).b)
    if (verdict === 'yes') expect(gap, answer.prompt).toBeLessThan(1.5)
    if (verdict === 'no') expect(gap, answer.prompt).toBeGreaterThan(0.8)
    return
  }
  if (!findX) throw new Error(`unread converse: ${answer.prompt}`)
  const a = Number(findX[1])
  const left = lin(findX[2]!)
  const b = Number(findX[3])
  const right = lin(findX[4]!)
  const rel = relation(a, b)
  expect(parallelFact(rel), answer.prompt).toBe(true)
  const x = rel === 'ssi' ? one(plus(left, right), [rat(0), rat(180)], answer.prompt) : one(left, right, answer.prompt)
  const leftM = at(left, x)
  const rightM = at(right, x)
  expect(leftM.d === 1 && rightM.d === 1, answer.prompt).toBe(true)
  openAngle(leftM.n, answer.prompt)
  openAngle(rightM.n, answer.prompt)
  expect(fits(rel, leftM.n, rightM.n), answer.prompt).toBe(true)
  expect(stageText(answer, 'x')).toBe(ratToString(x))
  expect(stageText(answer, 'The fact')).toBe(rel)
  const drawn = pairMeasures(answer.figure)
  expect(Math.abs(drawn.a - drawn.b), answer.prompt).toBeLessThan(1.5)
  near(labeled(answer.figure, String(a)), leftM.n, answer.prompt)
  near(labeled(answer.figure, String(b)), rightM.n, answer.prompt)
}

function relationOf(m1: Rational | null, m2: Rational | null): 'par' | 'perp' | 'neither' {
  const same = slopeText(m1) === slopeText(m2)
  const right =
    (m1 === null && m2?.n === 0) ||
    (m2 === null && m1?.n === 0) ||
    (m1 !== null && m2 !== null && ratToString(ratMul(m1, m2)) === '-1')
  expect(same && right, 'a line cannot be both').toBe(false)
  if (same) return 'par'
  if (right) return 'perp'
  return 'neither'
}

function auditSlopes(answer: GeometryAnswer) {
  const through = /^What is the slope of a line (parallel|perpendicular) to the line through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)\?$/.exec(answer.prompt)
  const equation = /^What is an equation of the line that passes through \((-?\d+), (-?\d+)\) and is (parallel|perpendicular) to the line (.+)\?$/.exec(answer.prompt)
  const compare = /^The line (.+?) and the line (.+) are drawn\. Are the lines parallel, perpendicular, or neither\?$/.exec(answer.prompt)
  const slope = /^What is the slope of a line (parallel|perpendicular) to the line (.+)\?$/.exec(answer.prompt)
  if (through) {
    const word = through[1]!
    const x1 = Number(through[2])
    const y1 = Number(through[3])
    const x2 = Number(through[4])
    const y2 = Number(through[5])
    expect(x1 === x2, answer.prompt).toBe(false)
    const m = rat(y2 - y1, x2 - x1)
    const want = word === 'parallel' ? m : perpSlope(m)
    expect(stageText(answer, 'Slope')).toBe(slopeText(want))
    slopesAgree(drawnSlope(answer.figure, 0), m, answer.prompt)
    return
  }
  if (equation) {
    const px = Number(equation[1])
    const py = Number(equation[2])
    const word = equation[3]!
    const given = slopeOf(equation[4]!, answer.prompt)
    const want = word === 'parallel' ? given : perpSlope(given)
    const line = lineThrough(want, px, py)
    const stored = parseLine(stageText(answer, 'Equation'), answer.prompt)
    expect(sameLine(stored, line), answer.prompt).toBe(true)
    slopesAgree(drawnSlope(answer.figure, 0), given, answer.prompt)
    const p = answer.figure.points.find((item) => item.label === 'P')
    expect(p, answer.prompt).toBeTruthy()
    expect(Math.abs(p!.x - px) + Math.abs(p!.y - py)).toBeLessThan(0.05)
    return
  }
  if (compare) {
    const m1 = slopeOf(compare[1]!, answer.prompt)
    const m2 = slopeOf(compare[2]!, answer.prompt)
    expect(stageText(answer, 'The lines')).toBe(relationOf(m1, m2))
    slopesAgree(drawnSlope(answer.figure, 0), m1, answer.prompt)
    slopesAgree(drawnSlope(answer.figure, 1), m2, answer.prompt)
    return
  }
  if (!slope) throw new Error(`unread slopes: ${answer.prompt}`)
  const given = slopeOf(slope[2]!, answer.prompt)
  const want = slope[1] === 'parallel' ? given : perpSlope(given)
  expect(stageText(answer, 'Slope')).toBe(slopeText(want))
  slopesAgree(drawnSlope(answer.figure, 0), given, answer.prompt)
}

function auditTriangle(answer: GeometryAnswer) {
  const sum = /^In △ABC, m∠A = \(([^)]+)\)°, m∠B = \(([^)]+)\)°, and m∠C = \(([^)]+)\)°\. Find x, then m∠([ABC])\.$/.exec(answer.prompt)
  const exterior = /^The exterior angle at C of △ABC measures \(([^)]+)\)°\. The remote interior angles measure \(([^)]+)\)° and \(([^)]+)\)°\. Find x, then the exterior angle\.$/.exec(answer.prompt)
  if (sum) {
    const exprs = [lin(sum[1]!), lin(sum[2]!), lin(sum[3]!)] as const
    const x = one(plus(plus(exprs[0], exprs[1]), exprs[2]), [rat(0), rat(180)], answer.prompt)
    const angles = exprs.map((e) => at(e, x))
    for (const angle of angles) {
      expect(angle.d, answer.prompt).toBe(1)
      openAngle(angle.n, answer.prompt)
    }
    const names = ['A', 'B', 'C'] as const
    const ask = names.indexOf(sum[4] as 'A' | 'B' | 'C')
    expect(stageText(answer, 'x')).toBe(ratToString(x))
    expect(stageText(answer, `m∠${names[ask]}`)).toBe(ratToString(angles[ask]!))
    near(labeled(answer.figure, `(${sum[1]})°`), angles[0]!.n, 'A')
    near(labeled(answer.figure, `(${sum[2]})°`), angles[1]!.n, 'B')
    near(labeled(answer.figure, `(${sum[3]})°`), angles[2]!.n, 'C')
    expect(answer.figure.points.some((p) => p.id === 'D'), answer.prompt).toBe(false)
    return
  }
  if (!exterior) throw new Error(`unread triangle: ${answer.prompt}`)
  const remote1 = lin(exterior[2]!)
  const remote2 = lin(exterior[3]!)
  const ext = lin(exterior[1]!)
  const x = one(plus(remote1, remote2), ext, answer.prompt)
  const A = at(remote1, x)
  const B = at(remote2, x)
  const E = at(ext, x)
  expect(A.d === 1 && B.d === 1 && E.d === 1, answer.prompt).toBe(true)
  openAngle(A.n, answer.prompt)
  openAngle(B.n, answer.prompt)
  openAngle(E.n, answer.prompt)
  const C = 180 - E.n
  openAngle(C, answer.prompt)
  expect(stageText(answer, 'x')).toBe(ratToString(x))
  expect(stageText(answer, 'The exterior angle')).toBe(ratToString(E))
  near(labeled(answer.figure, `(${exterior[2]})°`), A.n, 'remote A')
  near(labeled(answer.figure, `(${exterior[3]})°`), B.n, 'remote B')
  near(labeled(answer.figure, `(${exterior[1]})°`), E.n, 'exterior')
  expect(answer.figure.points.some((p) => p.id === 'D'), answer.prompt).toBe(true)
}

function markedDegrees(fig: GeoFigureSpec): number | null {
  const label = (fig.angles ?? []).find((ang) => ang.label)?.label ?? ''
  const m = /^(\d+)°$/.exec(label)
  return m ? Number(m[1]) : null
}

function auditPolygon(answer: GeometryAnswer) {
  const sum = /^What is the sum of the interior angles of a convex (\d+)-gon\?$/.exec(answer.prompt)
  const eachInt = /^What is each interior angle of a regular (\d+)-gon\?$/.exec(answer.prompt)
  const eachExt = /^What is each exterior angle of a regular (\d+)-gon\?$/.exec(answer.prompt)
  const extSum = /^What is the sum of the exterior angles of a convex (\d+)-gon, one at each vertex\?$/.exec(answer.prompt)
  const sidesExt = /^Each exterior angle of a regular polygon measures (\d+)°\. How many sides does it have\?$/.exec(answer.prompt)
  const sidesInt = /^Each interior angle of a regular polygon measures (\d+)°\. How many sides does it have\?$/.exec(answer.prompt)
  const nOf = (raw: string) => {
    const n = Number(raw)
    expect(n >= 3 && n <= 20, answer.prompt).toBe(true)
    expect(convexCount(answer.figure), answer.prompt).toBe(n)
    return n
  }
  if (sum) {
    const n = nOf(sum[1]!)
    expect(stageText(answer, 'The sum')).toBe(String((n - 2) * 180))
    return
  }
  if (eachInt) {
    const n = nOf(eachInt[1]!)
    expect(stageText(answer, 'Each angle')).toBe(ratToString(rat((n - 2) * 180, n)))
    return
  }
  if (eachExt) {
    const n = nOf(eachExt[1]!)
    const value = rat(360, n)
    expect(stageText(answer, 'Each angle')).toBe(ratToString(value))
    if (value.d === 1) openAngle(value.n, answer.prompt)
    return
  }
  if (extSum) {
    nOf(extSum[1]!)
    expect(stageText(answer, 'The sum')).toBe('360')
    return
  }
  if (sidesExt) {
    const degrees = Number(sidesExt[1])
    openAngle(degrees, answer.prompt)
    expect(360 % degrees, answer.prompt).toBe(0)
    const n = 360 / degrees
    expect(n >= 3 && n <= 20, answer.prompt).toBe(true)
    expect(stageText(answer, 'The number of sides')).toBe(String(n))
    expect(convexCount(answer.figure), answer.prompt).toBe(n)
    expect(markedDegrees(answer.figure), answer.prompt).toBe(degrees)
    return
  }
  if (!sidesInt) throw new Error(`unread polygon: ${answer.prompt}`)
  const degrees = Number(sidesInt[1])
  openAngle(degrees, answer.prompt)
  const turn = 180 - degrees
  expect(turn > 0 && 360 % turn === 0, answer.prompt).toBe(true)
  const n = 360 / turn
  expect(n >= 3 && n <= 20, answer.prompt).toBe(true)
  expect(stageText(answer, 'The number of sides')).toBe(String(n))
  expect(convexCount(answer.figure), answer.prompt).toBe(n)
  expect(markedDegrees(answer.figure), answer.prompt).toBe(degrees)
  expect(String(n), answer.prompt).not.toBe(String(degrees))
}

const TEXTBOOK: { a: number; b: number; rel: Rel }[] = [
  { a: 1, b: 5, rel: 'corr' },
  { a: 2, b: 6, rel: 'corr' },
  { a: 3, b: 7, rel: 'corr' },
  { a: 4, b: 8, rel: 'corr' },
  { a: 3, b: 5, rel: 'alt-int' },
  { a: 4, b: 6, rel: 'alt-int' },
  { a: 1, b: 7, rel: 'alt-ext' },
  { a: 2, b: 8, rel: 'alt-ext' },
  { a: 3, b: 6, rel: 'ssi' },
  { a: 4, b: 5, rel: 'ssi' },
  { a: 1, b: 3, rel: 'vert' },
  { a: 2, b: 4, rel: 'vert' },
  { a: 5, b: 7, rel: 'vert' },
  { a: 6, b: 8, rel: 'vert' },
  { a: 1, b: 2, rel: 'linear' },
  { a: 2, b: 3, rel: 'linear' },
  { a: 3, b: 4, rel: 'linear' },
  { a: 1, b: 4, rel: 'linear' },
  { a: 5, b: 6, rel: 'linear' },
  { a: 6, b: 7, rel: 'linear' },
  { a: 7, b: 8, rel: 'linear' },
  { a: 5, b: 8, rel: 'linear' },
  { a: 1, b: 8, rel: 'none' },
  { a: 2, b: 7, rel: 'none' },
  { a: 1, b: 6, rel: 'none' },
]

describe('the eight angles, classified from where they sit', () => {
  it('names each of the 28 pairs once, and the textbook pairs keep their names', () => {
    const seen = new Map<string, Rel>()
    for (let a = 1; a <= 8; a++) {
      for (let b = a + 1; b <= 8; b++) seen.set(`${a},${b}`, relation(a, b))
    }
    expect(seen.size).toBe(28)
    const counts: Record<Rel, number> = { corr: 0, 'alt-int': 0, 'alt-ext': 0, ssi: 0, vert: 0, linear: 0, none: 0 }
    for (const rel of seen.values()) counts[rel] += 1
    expect(counts).toEqual({ corr: 4, 'alt-int': 2, 'alt-ext': 2, ssi: 2, vert: 4, linear: 8, none: 6 })
    for (const row of TEXTBOOK) expect(seen.get(`${row.a},${row.b}`), `${row.a},${row.b}`).toBe(row.rel)
  })
})

describe('unit 3, solved again from the wording', () => {
  it.each(TEMPLATES)('%s/%s agrees over 2000 seeds', (module, template, cards) => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const answer = problem(module, template, seed)
      const where = `${template}/${seed}`
      if (template === 'gl3.pairs') auditPairs(answer)
      else if (template === 'gl3.solve') auditSolve(answer)
      else if (template === 'gl3.converse') auditConverse(answer)
      else if (template === 'gl3.slopes') auditSlopes(answer)
      else if (template === 'gpa.triangle') auditTriangle(answer)
      else auditPolygon(answer)
      expect(leaks(answer, cards), where).toEqual([])
      for (const n of answer.angles) openAngle(n, where)
    }
  }, HEAVY)

  it('a reserved story number is never the answer, so the worked examples stay someone else\'s', () => {
    for (const [module, template] of TEMPLATES) {
      for (let seed = 1; seed <= 50; seed++) {
        const answer = problem(module, template, seed)
        for (const stage of answer.stages) {
          const display = stageDisplay(stage)
          expect(display, `${template}/${seed}`).not.toBe('4')
          expect(display).not.toBe('-4')
          expect(display).not.toBe('x = 4')
          expect(integerText(display), `${template}/${seed} ${display}`).not.toBe(4)
        }
      }
    }
  })
})
