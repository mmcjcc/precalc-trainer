/**
 * Independent re-solve of Honors Geometry Unit 4. Nothing here imports the generators.
 * Each problem is solved again from its prompt and from the marks the figure actually lists:
 * the congruence method from those marks, x from the two matching parts, and every proof row
 * from the facts the earlier rows established. Exactly one solution, and the triangles are real.
 */
import { describe, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec } from '@/shared/types'
import { gradeGeoStage } from './grade'
import { REASONS, type ReasonId } from './reasons'

type Q = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b))
const q = (n: bigint | number, d: bigint | number = 1n): Q => {
  let N = BigInt(n)
  let D = BigInt(d)
  if (D < 0n) [N, D] = [-N, -D]
  const g = gcd(N, D) || 1n
  return { n: N / g, d: D / g }
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
const show = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`)

type Lin = [Q, Q]
function lin(text: string): Lin {
  const s = text.replace(/\u2212/g, '-').replace(/\s+/g, '')
  const m = /^([+-]?\d*)x([+-]\d+)?$/.exec(s)
  if (m) {
    const c = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
    return [q(c), q(Number(m[2] ?? 0))]
  }
  if (/^[+-]?\d+$/.test(s)) return [q(0), q(Number(s))]
  throw new Error(`not linear: ${text}`)
}
const at = (e: Lin, x: Q) => add(mul(e[0], x), e[1])
/** The one x with left = right, or null when the two expressions never meet or always do. */
function solveEqual(a: Lin, b: Lin): Q | null {
  const c = sub(a[0], b[0])
  return c.n === 0n ? null : div(sub(b[1], a[1]), c)
}

const SEEDS = Number(process.env.GEO_SEEDS ?? 2000)
const PERMS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

function fail(msg: string): never {
  throw new Error(msg)
}
function check(cond: boolean, msg: string): void {
  if (!cond) fail(msg)
}

function load(module: string, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module as never, template, seed)
  if (p.answer.type !== 'geometry') fail(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

function problem(module: string, template: string, seed: number) {
  const p = generateProblem(module as never, template, seed)
  if (p.answer.type !== 'geometry') fail(`${template}/${seed} is ${p.answer.type}`)
  return p
}

function checkGrades(a: GeometryAnswer, where: string): void {
  for (const stage of a.stages) {
    check(gradeGeoStage(a, stage.id, stage.answerText).verdict === 'correct', `${where} ${stage.id} grades ${stage.answerText}`)
    for (const alt of stage.accept ?? []) {
      check(gradeGeoStage(a, stage.id, alt).verdict === 'correct', `${where} accept ${alt}`)
    }
  }
  const trap = gradeGeoStage(a, a.trapStage, a.trapAnswer)
  check(trap.verdict === 'mistake' && trap.mistake === a.trap, `${where} trap ${a.trapAnswer} is ${trap.verdict}`)
}

function integerSolution(left: Lin, right: Lin, where: string): number {
  const x = solveEqual(left, right)
  check(x !== null && x.d === 1n, `${where}: expected one integer, got ${x ? show(x) : 'none'}`)
  return Number(x!.n)
}

// --- figures -------------------------------------------------------------------------------------------------

interface Pt {
  id: string
  x: number
  y: number
}

function point(fig: GeoFigureSpec, id: string): Pt {
  const found = fig.points.find((p) => p.id === id)
  if (!found) fail(`missing point ${id}`)
  return found
}
function dir(fig: GeoFigureSpec, a: string, b: string): { x: number; y: number } {
  const u = point(fig, a)
  const v = point(fig, b)
  return { x: v.x - u.x, y: v.y - u.y }
}
function dist(fig: GeoFigureSpec, a: string, b: string): number {
  const d = dir(fig, a, b)
  return Math.hypot(d.x, d.y)
}
function wedge(fig: GeoFigureSpec, v: string, a: string, b: string): number {
  const V = point(fig, v)
  const A = point(fig, a)
  const B = point(fig, b)
  let d = Math.atan2(B.y - V.y, B.x - V.x) - Math.atan2(A.y - V.y, A.x - V.x)
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  return (Math.abs(d) * 180) / Math.PI
}
function opposite(fig: GeoFigureSpec, a: string, m: string, b: string): boolean {
  const d1 = dir(fig, m, a)
  const d2 = dir(fig, m, b)
  const cross = d1.x * d2.y - d1.y * d2.x
  const dot = d1.x * d2.x + d1.y * d2.y
  return Math.abs(cross) < 1e-4 && dot < 0
}
function linesParallel(fig: GeoFigureSpec, a: string, b: string, c: string, d: string): boolean {
  const ab = dir(fig, a, b)
  const cd = dir(fig, c, d)
  return Math.abs(ab.x * cd.y - ab.y * cd.x) < 1e-4
}

interface Tri {
  sides: [number, number, number]
  angles: [number, number, number]
  area: number
}
function inspect(fig: GeoFigureSpec, name: string): Tri {
  const [a, b, c] = [name[0]!, name[1]!, name[2]!]
  const A = point(fig, a)
  const B = point(fig, b)
  const C = point(fig, c)
  return {
    sides: [dist(fig, a, b), dist(fig, b, c), dist(fig, c, a)],
    angles: [wedge(fig, a, b, c), wedge(fig, b, a, c), wedge(fig, c, a, b)],
    area: Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2,
  }
}
function assertReal(fig: GeoFigureSpec, name: string, where: string): Tri {
  const t = inspect(fig, name)
  check(t.sides.every((s) => s > 0.2), `${where}: a side of ${name} is ${t.sides.map((s) => s.toFixed(2)).join(',')}`)
  check(
    t.sides[0] + t.sides[1] > t.sides[2] && t.sides[0] + t.sides[2] > t.sides[1] && t.sides[1] + t.sides[2] > t.sides[0],
    `${where}: ${name} breaks the triangle inequality`,
  )
  check(t.angles.every((n) => n > 1 && n < 179), `${where}: ${name} has a flat angle ${t.angles.map((n) => n.toFixed(1)).join(',')}`)
  const sum = t.angles[0] + t.angles[1] + t.angles[2]
  check(Math.abs(sum - 180) < 1.5, `${where}: ${name} angles sum to ${sum.toFixed(2)}`)
  check(t.area > 0.3, `${where}: ${name} area ${t.area.toFixed(3)}`)
  return t
}
function nearRight(fig: GeoFigureSpec, name: string, tol: number): boolean {
  return inspect(fig, name).angles.some((n) => Math.abs(n - 90) < tol)
}
function lengthsOk(sides: number[], where: string): void {
  check(sides.length === 3 && sides.every((s) => s > 0), `${where}: lengths ${sides.join(',')}`)
  check(sides[0]! + sides[1]! > sides[2]! && sides[0]! + sides[2]! > sides[1]! && sides[1]! + sides[2]! > sides[0]!, `${where}: stored lengths are not a triangle`)
}

function undirected(name: string): string {
  const [a, b] = [name[0]!, name[1]!]
  return a < b ? `${a}${b}` : `${b}${a}`
}
function pairKey(a: string, b: string): string {
  const x = undirected(a)
  const y = undirected(b)
  return x < y ? `${x}|${y}` : `${y}|${x}`
}
function vertexKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
function sameAngle(a: string, b: string): boolean {
  return a[1] === b[1] && [a[0], a[2]].sort().join('') === [b[0], b[2]].sort().join('')
}
function arms(name: string): string {
  return [name[0], name[2]].sort().join('')
}

interface MarkScene {
  t1: string
  t2: string
  sides: [string, string][]
  angleVerts: [string, string][]
  rights: string[]
  shared: string[]
  vertical: [string, string][]
  parallel: [string, string][]
  alt: [string, string][]
}

function listItems(text: string): string[] {
  const s = text.trim()
  return s === 'none' ? [] : s.split('; ').map((item) => item.trim())
}
function field(aria: string, label: string): string {
  const m = new RegExp(`${label}: ([^.]+)\\.`).exec(aria)
  if (!m) fail(`no “${label}” in ${aria}`)
  return m[1]!
}
function parseAria(aria: string): MarkScene {
  const names = /^Triangles ([A-Z]{3}) and ([A-Z]{3})\./.exec(aria)
  if (!names) fail(`no triangles in ${aria}`)
  const side = (item: string): [string, string] => {
    const m = /^([A-Z]{2})-([A-Z]{2}) tick ([123])$/.exec(item)
    if (!m) fail(`bad side pair ${item}`)
    return [m[1]!, m[2]!]
  }
  const verts = (item: string): [string, string] => {
    const m = /^([A-Z])-([A-Z]) arc ([123])$/.exec(item)
    if (!m) fail(`bad angle pair ${item}`)
    return [m[1]!, m[2]!]
  }
  const ends = (item: string): [string, string] => {
    const m = /^([A-Z]{3})-([A-Z]{3})$/.exec(item)
    if (!m) fail(`bad angle spec ${item}`)
    return [m[1]!, m[2]!]
  }
  const parallel = (item: string): [string, string] => {
    const m = /^([A-Z]{2})\|\|([A-Z]{2}) arrows ([12])$/.exec(item)
    if (!m) fail(`bad parallel ${item}`)
    return [m[1]!, m[2]!]
  }
  return {
    t1: names[1]!,
    t2: names[2]!,
    sides: listItems(field(aria, 'Side pairs')).map(side),
    angleVerts: listItems(field(aria, 'Angle pairs')).map(verts),
    rights: listItems(field(aria, 'Right angles')),
    shared: listItems(field(aria, 'Shared sides')),
    vertical: listItems(field(aria, 'Vertical angles')).map(ends),
    parallel: listItems(field(aria, 'Parallel lines')).map(parallel),
    alt: listItems(field(aria, 'Alternate interior angles')).map(ends),
  }
}

function tickPairs(fig: GeoFigureSpec): [string, string][] {
  const by = new Map<number, string[]>()
  for (const seg of fig.segments ?? []) {
    if (!seg.ticks) continue
    const list = by.get(seg.ticks) ?? []
    list.push(`${seg.from}${seg.to}`)
    by.set(seg.ticks, list)
  }
  const pairs: [string, string][] = []
  for (const [n, list] of by) {
    if (list.length !== 2) fail(`tick ${n} is on ${list.length} sides`)
    pairs.push([list[0]!, list[1]!])
    check(Math.abs(dist(fig, list[0]![0]!, list[0]![1]!) - dist(fig, list[1]![0]!, list[1]![1]!)) < 0.05, `tick ${n} sides differ`)
  }
  return pairs
}
function arcPairs(fig: GeoFigureSpec): [string, string][] {
  const by = new Map<number, string[]>()
  for (const mark of fig.angles ?? []) {
    if (mark.right || !mark.marks) continue
    const list = by.get(mark.marks) ?? []
    list.push(mark.vertex)
    by.set(mark.marks, list)
  }
  const pairs: [string, string][] = []
  for (const [n, list] of by) {
    if (list.length !== 2) fail(`arc ${n} is on ${list.length} angles`)
    pairs.push([list[0]!, list[1]!])
    const marks = (fig.angles ?? []).filter((mark) => mark.marks === n && !mark.right)
    check(Math.abs(wedge(fig, marks[0]!.vertex, marks[0]!.from, marks[0]!.to) - wedge(fig, marks[1]!.vertex, marks[1]!.from, marks[1]!.to)) < 0.5, `arc ${n} measures differ`)
  }
  return pairs
}
function squareVerts(fig: GeoFigureSpec): string[] {
  const verts = (fig.angles ?? []).filter((mark) => mark.right).map((mark) => mark.vertex)
  for (const mark of fig.angles ?? []) {
    if (!mark.right) continue
    check(Math.abs(wedge(fig, mark.vertex, mark.from, mark.to) - 90) < 1, `square at ${mark.vertex} is not 90°`)
  }
  return verts
}
function arrowPairs(fig: GeoFigureSpec): [string, string][] {
  const by = new Map<number, string[]>()
  for (const line of fig.lines ?? []) {
    if (!line.arrows) continue
    const list = by.get(line.arrows) ?? []
    list.push(`${line.through[0]}${line.through[1]}`)
    by.set(line.arrows, list)
  }
  const pairs: [string, string][] = []
  for (const [n, list] of by) {
    if (list.length !== 2) fail(`arrows ${n} on ${list.length} lines`)
    pairs.push([list[0]!, list[1]!])
    check(linesParallel(fig, list[0]![0]!, list[0]![1]!, list[1]![0]!, list[1]![1]!), `arrows ${n} are not parallel`)
  }
  return pairs
}
function keysOf(pairs: [string, string][], kind: 'seg' | 'vert'): string[] {
  return pairs.map(([a, b]) => (kind === 'seg' ? pairKey(a, b) : vertexKey(a, b))).sort()
}
function sameKeys(got: string[], expected: string[], where: string): void {
  check(got.join(',') === expected.join(','), `${where}: ${got.join(',')} vs ${expected.join(',')}`)
}

/** The figure shows the marks the description lists, and no others. Label-only angles are not arcs. */
function figureMatches(fig: GeoFigureSpec, scene: MarkScene, where: string): void {
  sameKeys(keysOf(tickPairs(fig), 'seg'), keysOf(scene.sides, 'seg'), `${where} ticks`)
  sameKeys(keysOf(arcPairs(fig), 'vert'), keysOf(scene.angleVerts, 'vert'), `${where} arcs`)
  sameKeys(
    squareVerts(fig).slice().sort().map((v) => `${v}|`),
    scene.rights.slice().sort().map((v) => `${v}|`),
    `${where} squares`,
  )
  sameKeys(keysOf(arrowPairs(fig), 'seg'), keysOf(scene.parallel, 'seg'), `${where} arrows`)
}

function includedEdge(i: number, j: number): number {
  const a = Math.min(i, j)
  const b = Math.max(i, j)
  if (a === 0 && b === 1) return 0
  if (a === 1 && b === 2) return 1
  return 2
}

/**
 * SSS, SAS, ASA, AAS, HL from the marks that are actually established.
 * A matched side counts as AAS only when it is not the side between the two angles,
 * so ASA does not also report AAS. A right angle is an angle match for HL only when
 * `rights` says so; it is not an arc.
 */
function methodsFrom(
  t1: string,
  t2: string,
  hitSide: (p: string, q: string) => boolean,
  hitAngle: (u: string, v: string) => boolean,
  rights: Set<string>,
): string[] {
  const A = [t1[0]!, t1[1]!, t1[2]!]
  const B = [t2[0]!, t2[1]!, t2[2]!]
  const edge = (tri: string[], i: number) => `${tri[i]!}${tri[(i + 1) % 3]!}`
  const found = new Set<string>()
  for (const perm of PERMS) {
    const map = [B[perm[0]]!, B[perm[1]]!, B[perm[2]]!]
    const matched = [0, 1, 2].filter((i) => hitSide(edge(A, i), edge(map, i)))
    const ang = [0, 1, 2].filter((i) => hitAngle(A[i]!, map[i]!))
    if (matched.length === 3) found.add('SSS')
    for (const v of [0, 1, 2]) {
      if (matched.includes((v + 2) % 3) && matched.includes(v) && ang.includes(v)) found.add('SAS')
    }
    for (const s of [0, 1, 2]) {
      if (ang.includes(s) && ang.includes((s + 1) % 3) && matched.includes(s)) found.add('ASA')
    }
    if (ang.length >= 2) {
      for (let i = 0; i < ang.length; i++) {
        for (let j = i + 1; j < ang.length; j++) {
          const inc = includedEdge(ang[i]!, ang[j]!)
          if (matched.some((s) => s !== inc)) found.add('AAS')
        }
      }
    }
    const rightAt = [0, 1, 2].filter((i) => rights.has(A[i]!))
    if (rightAt.length === 1 && rights.has(map[rightAt[0]!]!)) {
      const r = rightAt[0]!
      const others = [0, 1, 2].filter((i) => rights.has(map[i]!))
      if (others.length === 1 && others[0] === r) {
        const hyp = (r + 1) % 3
        if (matched.includes(hyp) && (matched.includes(r) || matched.includes((r + 2) % 3))) found.add('HL')
      }
    }
  }
  return [...found].sort()
}

function sideHit(sides: [string, string][], shared: string[], p: string, q: string): boolean {
  if (undirected(p) === undirected(q) && shared.some((s) => undirected(s) === undirected(p))) return true
  return sides.some(([a, b]) => (undirected(a) === undirected(p) && undirected(b) === undirected(q)) || (undirected(a) === undirected(q) && undirected(b) === undirected(p)))
}
function angleHit(verts: [string, string][], named: [string, string][], rights: string[], u: string, v: string): boolean {
  if (rights.includes(u) && rights.includes(v)) return true
  if (verts.some(([a, b]) => (a === u && b === v) || (a === v && b === u))) return true
  // The written pair runs from the first triangle to the second. The swap is another pair.
  return named.some(([a, b]) => a[1] === u && b[1] === v)
}
function methodsOfScene(scene: MarkScene): string[] {
  const named = [...scene.vertical, ...scene.alt]
  return methodsFrom(
    scene.t1,
    scene.t2,
    (p, q) => sideHit(scene.sides, scene.shared, p, q),
    (u, v) => angleHit(scene.angleVerts, named, scene.rights, u, v),
    new Set(scene.rights),
  )
}

function arced(fig: GeoFigureSpec, vertex: string): boolean {
  return (fig.angles ?? []).some((mark) => mark.vertex === vertex && Boolean(mark.marks) && !mark.right)
}
function choiceText(stage: GeometryAnswer['stages'][number]): string {
  const text = stage.choices?.find((choice) => choice.id === stage.answerText)?.text
  if (!text) fail(`no correct choice on ${stage.id}`)
  return text
}

function corrVertex(t1: string, t2: string, v: string): string {
  const i1 = t1.indexOf(v)
  if (i1 >= 0) return t2[i1]!
  const i2 = t2.indexOf(v)
  if (i2 >= 0) return t1[i2]!
  fail(`vertex ${v} is in neither ${t1} nor ${t2}`)
}
function vertexIndex(t1: string, t2: string, v: string): number {
  const i1 = t1.indexOf(v)
  return i1 >= 0 ? i1 : t2.indexOf(v)
}
function sideIndex(tri: string, name: string): number {
  const want = undirected(name)
  for (let i = 0; i < 3; i++) {
    if (undirected(`${tri[i]!}${tri[(i + 1) % 3]!}`) === want) return i
  }
  return -1
}
function sideWritten(tri: string, i: number): string {
  return i === 2 ? `${tri[0]!}${tri[2]!}` : `${tri[i]!}${tri[(i + 1) % 3]!}`
}

/** SSA as the figure shows it: two ticked sides and the angle that is not between them. */
function isSsaScene(scene: MarkScene, methods: string[]): boolean {
  if (methods.length || scene.rights.length || scene.shared.length || scene.vertical.length || scene.alt.length || scene.parallel.length) return false
  if (scene.sides.length !== 2 || scene.angleVerts.length !== 1) return false
  const ends = (name: string) => [name[0]!, name[1]!]
  const common = ends(scene.sides[0]![0]!).filter((v) => ends(scene.sides[1]![0]!).includes(v))
  return common.length === 1 && scene.angleVerts[0]![0] !== common[0]
}

/** AAA as the figure shows it: three arc pairs and nothing else. */
function isAaaScene(scene: MarkScene, methods: string[]): boolean {
  return (
    methods.length === 0 &&
    scene.angleVerts.length === 3 &&
    scene.sides.length === 0 &&
    scene.shared.length === 0 &&
    scene.rights.length === 0 &&
    scene.vertical.length === 0 &&
    scene.alt.length === 0 &&
    scene.parallel.length === 0
  )
}

/** The named mistakes the marks support. A copy of the rule, not an import of the generator. */
function trapFits(scene: MarkScene, answer: string): { choice: string; id: string }[] {
  const methods = methodsOfScene(scene)
  const out: { choice: string; id: string }[] = []
  const add = (choice: string, id: string) => {
    if (choice === answer || out.some((trap) => trap.choice === choice)) return
    out.push({ choice, id })
  }
  if (isSsaScene(scene, methods)) {
    add('SSA', 'geo_ssa_as_congruence')
    add('SAS', 'geo_sas_not_included')
    add('HL', 'geo_hl_no_right')
  }
  if (isAaaScene(scene, methods)) {
    add('AAA', 'geo_aaa_as_congruence')
    add('HL', 'geo_hl_no_right')
  }
  if (answer === 'ASA') add('AAS', 'geo_asa_aas_swapped')
  if (answer === 'AAS') add('ASA', 'geo_asa_aas_swapped')
  if (answer === 'HL') add('SAS', 'geo_sas_not_included')
  if (scene.rights.length === 0 && answer !== 'HL') add('HL', 'geo_hl_no_right')
  if (scene.shared.length > 0 && answer !== 'none') add('none', 'geo_shared_side_missed')
  if (scene.vertical.length > 0 && answer !== 'none') add('none', 'geo_vertical_angles_missed')
  return out
}

// --- algebra -------------------------------------------------------------------------------------------------

function anglesClose(got: number[], expected: number[], where: string): void {
  check(got.length === expected.length, where)
  for (let i = 0; i < got.length; i++) {
    check(Math.abs(got[i]! - expected[i]!) < 1.5, `${where}: angle ${i} is ${got[i]!.toFixed(1)}, expected ${expected[i]}`)
  }
}

describe('unit 4, solved again from the wording', () => {
  it('corresponding parts: one integer x, then the asked measure, on a real triangle', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = load('geoCongruence', 'gc.solve', seed)
      const where = `gc.solve/${seed}: ${a.prompt}`
      const fig = a.figure
      check(fig.ariaLabel.includes('No congruence marks.'), where)
      check(!(fig.segments ?? []).some((seg) => seg.ticks), `${where}: a tick is not given`)
      check(!(fig.angles ?? []).some((mark) => mark.marks || mark.right), `${where}: an arc is not given`)
      check(!(fig.lines ?? []).some((line) => line.arrows), `${where}: arrows are not given`)
      const head = /△([A-Z]{3}) ≅ △([A-Z]{3})\. (.+)\. Find x, then (?:m∠([A-Z])|([A-Z]{2}))\./.exec(a.prompt)
      check(Boolean(head), where)
      const t1 = head![1]!
      const t2 = head![2]!
      const bits = head![3]!.split(/, and |, /)
      const askedVertex = head![4]
      const askedSide = head![5]
      check(bits.length === 3, `${where}: ${head![3]}`)
      const left = assertReal(fig, t1, where)
      const right = assertReal(fig, t2, where)
      anglesClose(right.angles, left.angles, `${where} copy`)
      lengthsOk(a.lengths, where)
      if (askedVertex) {
        const clauses = bits.map((bit) => {
          const m = /^m∠([A-Z]) = (.+)$/.exec(bit.trim())
          if (!m) fail(`${where}: ${bit}`)
          return { vertex: m[1]!, expr: lin(m[2]!) }
        })
        const asked = clauses.find((clause) => clause.vertex === askedVertex)
        const corr = clauses.find((clause) => clause.vertex === corrVertex(t1, t2, askedVertex))
        const other = clauses.find((clause) => clause !== asked && clause !== corr)
        check(Boolean(asked && corr && other && new Set(clauses.map((clause) => clause.vertex)).size === 3), `${where}: the three angles`)
        const x = integerSolution(asked!.expr, corr!.expr, where)
        const measure = at(asked!.expr, q(x))
        const bait = at(other!.expr, q(x))
        check(measure.d === 1n && bait.d === 1n && at(corr!.expr, q(x)).n === measure.n, `${where}: measures are not integers`)
        const A = Number(measure.n)
        const B = Number(bait.n)
        const C = 180 - A - B
        check(A > 0 && A < 180 && B > 0 && B < 180 && C > 0 && C < 180 && B !== A, `${where}: angles ${A}, ${B}, ${C}`)
        const askedIndex = vertexIndex(t1, t2, askedVertex)
        const otherIndex = vertexIndex(t1, t2, other!.vertex)
        const stored = [0, 1, 2].map((i) => (i === askedIndex ? A : i === otherIndex ? B : C))
        check(a.stages[0]!.answerText === String(x) && a.stages[1]!.answerText === String(A), `${where}: stored ${a.stages.map((s) => s.answerText).join(',')}`)
        check(a.angles.join(',') === stored.join(','), `${where}: stored angles ${a.angles.join(',')}`)
        anglesClose(left.angles, stored, where)
        const trapX = integerSolution(asked!.expr, other!.expr, `${where} trap`)
        check(trapX !== x && String(trapX) === a.trapAnswer && a.trapStage === 'x' && a.trap === 'geo_vertices_out_of_order', `${where}: trap ${a.trapAnswer}`)
      } else if (askedSide) {
        const clauses = bits.map((bit) => {
          const m = /^([A-Z]{2}) = (.+)$/.exec(bit.trim())
          if (!m) fail(`${where}: ${bit}`)
          return { name: m[1]!, expr: lin(m[2]!) }
        })
        const asked = clauses.find((clause) => clause.name === askedSide)
        if (!asked) fail(`${where}: the asked side is not one of the three`)
        const onFirst = sideIndex(t1, asked.name) >= 0
        const idx = sideIndex(onFirst ? t1 : t2, asked.name)
        const corrTri = onFirst ? t2 : t1
        const corr = clauses.find((clause) => clause !== asked && undirected(clause.name) === undirected(sideWritten(corrTri, idx)))
        const other = clauses.find((clause) => clause !== asked && clause !== corr)
        check(idx >= 0 && Boolean(corr && other), `${where}: the three sides`)
        const x = integerSolution(asked.expr, corr!.expr, where)
        const measure = at(asked.expr, q(x))
        check(measure.d === 1n && at(corr!.expr, q(x)).n === measure.n && Number(measure.n) > 0, where)
        const result = Number(measure.n)
        check(a.stages[0]!.answerText === String(x) && a.stages[1]!.answerText === String(result), where)
        check(a.lengths.includes(result), `${where}: ${result} is not a stored length`)
        check(a.angles.every((n) => n > 0 && n < 180) && a.angles.reduce((s, n) => s + n, 0) === 180, `${where}: stored angles`)
        anglesClose(left.angles, a.angles, where)
        for (const tri of [t1, t2]) {
          const mine = clauses.filter((clause) => sideIndex(tri, clause.name) >= 0)
          if (mine.length === 3) lengthsOk(mine.map((clause) => Number(at(clause.expr, q(x)).n)), `${where} ${tri}`)
        }
        const trapX = integerSolution(asked.expr, other!.expr, `${where} trap`)
        check(trapX !== x && String(trapX) === a.trapAnswer && a.trapStage === 'x' && a.trap === 'geo_vertices_out_of_order', `${where}: trap ${a.trapAnswer}`)
      }
      checkGrades(a, `gc.solve/${seed}`)
    }
  }, 120000)

  it('isosceles and equilateral: the congruent parts give one integer, and the triangle is the one the words describe', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = load('geoIsosceles', 'gi.solve', seed)
      const where = `gi.solve/${seed}: ${a.prompt}`
      const named = /^Triangle ([A-Z]{3})\./.exec(a.figure.ariaLabel)
      check(Boolean(named), where)
      const tri = assertReal(a.figure, named![1]!, where)
      const eq = /^△([A-Z]{3}) is equilateral\. ([A-Z]{2}) = (.+?), ([A-Z]{2}) = (.+?), and ([A-Z]{2}) = (.+?)\. Find x, then ([A-Z]{2})\.$/.exec(a.prompt)
      const vertex = /^([A-Z]{2}) ≅ ([A-Z]{2}) and m∠([A-Z]) = (\d+)\. m∠([A-Z]) = (.+)\. Find x, then m∠([A-Z])\.$/.exec(a.prompt)
      const conv = /^∠([A-Z]) ≅ ∠([A-Z])\. ([A-Z]{2}) = (.+?), ([A-Z]{2}) = (.+?), and ([A-Z]{2}) = (.+?)\. Find x, then ([A-Z]{2})\.$/.exec(a.prompt)
      const thm = /^([A-Z]{2}) ≅ ([A-Z]{2})\. m∠([A-Z]) = (.+?), m∠([A-Z]) = (.+?), and m∠([A-Z]) = (.+?)\. Find x, then m∠([A-Z])\.$/.exec(a.prompt)
      check(Boolean(eq || vertex || conv || thm), where)
      if (eq) {
        check(eq[1] === named![1] && eq[8] === eq[2], `${where}: asks for a side that is not the first one`)
        const [e1, e2, e3] = [lin(eq[3]!), lin(eq[5]!), lin(eq[7]!)]
        const x12 = integerSolution(e1, e2, where)
        const x13 = integerSolution(e1, e3, where)
        const x23 = integerSolution(e2, e3, where)
        check(x12 === x13 && x13 === x23, `${where}: the three sides disagree`)
        const side = at(e1, q(x12))
        check(side.d === 1n && at(e2, q(x12)).n === side.n && at(e3, q(x12)).n === side.n, where)
        const n = Number(side.n)
        check(n !== 60 && n > 0, `${where}: side ${n}`)
        check(a.stages[0]!.answerText === String(x12) && a.stages[1]!.answerText === String(n), where)
        check(a.angles.join(',') === '60,60,60', `${where}: angles ${a.angles.join(',')}`)
        check(a.lengths.join(',') === [n, n, n].join(','), where)
        anglesClose(tri.angles, [60, 60, 60], where)
        const ticks = (a.figure.segments ?? []).filter((seg) => seg.ticks)
        check(ticks.length === 3 && new Set(ticks.map((seg) => seg.ticks)).size === 1, `${where}: equilateral ticks`)
        check(!(a.figure.angles ?? []).some((mark) => mark.marks || mark.right), `${where}: an equilateral arc`)
        check(Math.abs(tri.sides[0] - tri.sides[1]) < 0.05 && Math.abs(tri.sides[1] - tri.sides[2]) < 0.05, `${where}: drawn sides differ`)
        check(a.trap === 'geo_equilateral_angle_for_side' && a.trapStage === 'result' && a.trapAnswer === '60', where)
        check(gradeGeoStage(a, 'x', '60').verdict === 'wrong', `${where}: 60 on x`)
      } else if (vertex) {
        const [s1, s2, apex, given, asked] = [vertex[1]!, vertex[2]!, vertex[3]!, vertex[5]!, vertex[7]!]
        const shared = [...s1].filter((ch) => s2.includes(ch))
        check(shared.length === 1 && shared[0] === apex, `${where}: the congruent sides do not meet at the vertex angle`)
        const V = Number(vertex[4])
        check((180 - V) % 2 === 0, `${where}: base is not an integer`)
        const base = (180 - V) / 2
        const expr = lin(vertex[6]!)
        const x = integerSolution(expr, lin(String(base)), where)
        const got = at(expr, q(x))
        check(got.d === 1n && Number(got.n) === base && base > 0 && base < 180 && base !== V, where)
        check(asked !== apex && asked !== given && named![1]!.includes(asked) && named![1]!.includes(given), where)
        check(a.stages[0]!.answerText === String(x) && a.stages[1]!.answerText === String(base), where)
        const order = [...named![1]!].map((v) => (v === apex ? V : base))
        check(a.angles.join(',') === order.join(','), `${where}: stored ${a.angles.join(',')}`)
        anglesClose(tri.angles, order, where)
        const ticks = (a.figure.segments ?? []).filter((seg) => seg.ticks).map((seg) => undirected(`${seg.from}${seg.to}`)).sort()
        check(ticks.join(',') === [undirected(s1), undirected(s2)].sort().join(','), `${where}: ticks ${ticks.join(',')}`)
        check(!(a.figure.angles ?? []).some((mark) => mark.marks || mark.right), `${where}: a vertex-angle arc`)
        lengthsOk(a.lengths, where)
        const trapX = integerSolution(expr, lin(String(V)), `${where} trap`)
        check(trapX !== x && String(trapX) === a.trapAnswer && a.trap === 'geo_base_angles_wrong_vertex' && a.trapStage === 'x', where)
      } else if (conv) {
        const [b, c] = [conv[1]!, conv[2]!]
        const sides = [conv[3]!, conv[5]!, conv[7]!]
        const exprs = [lin(conv[4]!), lin(conv[6]!), lin(conv[8]!)]
        const asked = conv[9]!
        const opp = (v: string) => {
          const hit = sides.find((name) => !name.includes(v))
          if (!hit) fail(`${where}: no side across from ${v}`)
          return hit
        }
        const leftName = opp(b)
        const rightName = opp(c)
        const included = sides.find((name) => name.includes(b) && name.includes(c))
        if (!included) fail(`${where}: no included side`)
        const left = exprs[sides.indexOf(leftName)]!
        const right = exprs[sides.indexOf(rightName)]!
        const base = exprs[sides.indexOf(included)]!
        const x = integerSolution(left, right, where)
        const side = at(left, q(x))
        const other = at(base, q(x))
        check(side.d === 1n && other.d === 1n, where)
        const n = Number(side.n)
        const third = Number(other.n)
        check(n > 0 && third > 0 && n + n > third, `${where}: sides ${n}, ${third}`)
        check(asked === leftName || asked === rightName, `${where}: asks for ${asked}`)
        check(a.stages[0]!.answerText === String(x) && a.stages[1]!.answerText === String(n), where)
        check([...a.lengths].sort((p, r) => p - r).join(',') === [n, n, third].sort((p, r) => p - r).join(','), `${where}: lengths`)
        const arcs = (a.figure.angles ?? []).filter((mark) => mark.marks && !mark.right).map((mark) => mark.vertex).sort()
        check(arcs.join(',') === [b, c].sort().join(','), `${where}: arcs at ${arcs.join(',')}`)
        check(!(a.figure.segments ?? []).some((seg) => seg.ticks), `${where}: a converse tick`)
        check(Math.abs(tri.angles[named![1]!.indexOf(b)]! - tri.angles[named![1]!.indexOf(c)]!) < 0.5, `${where}: base angles differ`)
        anglesClose(tri.angles, a.angles, where)
        const askedExpr = exprs[sides.indexOf(asked)]!
        const trapX = integerSolution(askedExpr, base, `${where} trap`)
        check(trapX !== x && String(trapX) === a.trapAnswer && a.trap === 'geo_base_angles_wrong_vertex' && a.trapStage === 'x', where)
      } else if (thm) {
        const [s1, s2] = [thm[1]!, thm[2]!]
        const shared = [...s1].filter((ch) => s2.includes(ch))
        check(shared.length === 1, `${where}: the congruent sides do not share one vertex`)
        const apex = shared[0]!
        const bases = [s1, s2].map((name) => [...name].find((ch) => ch !== apex)!).sort()
        const letters = [thm[3]!, thm[5]!, thm[7]!]
        const exprs = [lin(thm[4]!), lin(thm[6]!), lin(thm[8]!)]
        const asked = thm[9]!
        check(letters.includes(apex) && bases.every((v) => letters.includes(v)) && bases.includes(asked), where)
        const baseExprs = bases.map((v) => exprs[letters.indexOf(v)]!)
        const apexExpr = exprs[letters.indexOf(apex)]!
        const x = integerSolution(baseExprs[0]!, baseExprs[1]!, where)
        const base = at(baseExprs[0]!, q(x))
        const vertex = at(apexExpr, q(x))
        check(base.d === 1n && vertex.d === 1n, where)
        const B = Number(base.n)
        const V = Number(vertex.n)
        check(B > 0 && B < 90 && V === 180 - 2 * B && V > 0 && V < 180, `${where}: angles ${V}, ${B}`)
        check(a.stages[0]!.answerText === String(x) && a.stages[1]!.answerText === String(B), where)
        const order = [...named![1]!].map((v) => (v === apex ? V : B))
        check(a.angles.join(',') === order.join(','), `${where}: stored ${a.angles.join(',')}`)
        anglesClose(tri.angles, order, where)
        const ticks = (a.figure.segments ?? []).filter((seg) => seg.ticks).map((seg) => undirected(`${seg.from}${seg.to}`)).sort()
        check(ticks.join(',') === [undirected(s1), undirected(s2)].sort().join(','), `${where}: ticks ${ticks.join(',')}`)
        check(!(a.figure.angles ?? []).some((mark) => mark.marks || mark.right), `${where}: a theorem arc`)
        lengthsOk(a.lengths, where)
        const trapX = integerSolution(exprs[letters.indexOf(asked)]!, apexExpr, `${where} trap`)
        check(trapX !== x && String(trapX) === a.trapAnswer && a.trap === 'geo_base_angles_wrong_vertex' && a.trapStage === 'x', where)
      }
      checkGrades(a, `gi.solve/${seed}`)
    }
  }, 120000)

  it('which method: the marks decide SSS, SAS, ASA, AAS, HL, or nothing, and the picture shows only those marks', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = load('geoCongruence', 'gc.which', seed)
      const where = `gc.which/${seed}`
      const scene = parseAria(a.figure.ariaLabel)
      figureMatches(a.figure, scene, where)
      const left = assertReal(a.figure, scene.t1, where)
      const right = assertReal(a.figure, scene.t2, where)
      const methods = methodsOfScene(scene)
      check(methods.length <= 1, `${where}: marks prove ${methods.join('+')}`)
      if (methods.includes('HL')) check(!methods.includes('SAS'), `${where}: HL was also read as SAS`)
      const text = choiceText(a.stages[0]!)
      const answerId = methods.length === 0 ? 'none' : methods[0]!
      check(text === (methods.length === 0 ? 'Not enough information' : methods[0]), `${where}: answer ${text}, marks ${methods.join(',') || 'none'}`)
      const buttons = a.stages[0]!.choices ?? []
      check(buttons.some((choice) => choice.id === 'SSA') && buttons.some((choice) => choice.id === 'AAA'), where)
      const fitted = trapFits(scene, answerId).map((trap) => `${trap.choice}=${trap.id}`).sort()
      const got = a.stages[0]!.traps.map((trap) => `${trap.text}=${trap.id}`).sort()
      check(got.join('|') === fitted.join('|'), `${where}: traps ${got.join('|')} vs ${fitted.join('|')}`)
      if (isSsaScene(scene, methods)) {
        anglesClose(right.angles, left.angles, `${where} SSA shape`)
        check(left.sides.every((s, i) => Math.abs(s - right.sides[i]!) < 0.05), `${where}: SSA triangles are not the same size`)
      }
      if (isAaaScene(scene, methods)) {
        anglesClose(right.angles, left.angles, `${where} AAA angles`)
        check(left.sides.some((s, i) => Math.abs(s - right.sides[i]!) > 0.5), `${where}: AAA triangles are the same size`)
      }
      for (const [p, q] of scene.vertical) {
        check(p[1] === q[1] && !sameAngle(p, q), `${where}: ${p}-${q} is not a pair`)
        const crossed =
          (opposite(a.figure, p[0]!, p[1]!, q[0]!) && opposite(a.figure, p[2]!, p[1]!, q[2]!)) ||
          (opposite(a.figure, p[0]!, p[1]!, q[2]!) && opposite(a.figure, p[2]!, p[1]!, q[0]!))
        check(crossed, `${where}: ${p}-${q} is not vertical`)
        check(!arced(a.figure, p[1]!), `${where}: vertical angle at ${p[1]} is drawn as an arc`)
      }
      for (const [p, q] of scene.alt) {
        check(p[1] !== q[1] && Math.abs(wedge(a.figure, p[1]!, p[0]!, p[2]!) - wedge(a.figure, q[1]!, q[0]!, q[2]!)) < 0.5, `${where}: ${p} vs ${q}`)
        check(!arced(a.figure, p[1]!) && !arced(a.figure, q[1]!), `${where}: alternate angles are drawn as arcs`)
        check(scene.parallel.length > 0, `${where}: alternate angles without parallels`)
      }
      for (const shared of scene.shared) {
        const [u, v] = [shared[0]!, shared[1]!]
        check([...scene.t1].includes(u) && [...scene.t1].includes(v) && [...scene.t2].includes(u) && [...scene.t2].includes(v), `${where}: shared ${shared}`)
        check(!(a.figure.segments ?? []).some((seg) => undirected(`${seg.from}${seg.to}`) === undirected(shared) && seg.ticks), `${where}: shared ${shared} is ticked`)
      }
      if (scene.parallel.length >= 2 && scene.rights.length === 0) {
        check(!nearRight(a.figure, scene.t1, 2) && !nearRight(a.figure, scene.t2, 2), `${where}: the parallelogram is a rectangle`)
      }
      const hlTrap = a.stages.some((stage) => stage.traps.some((trap) => trap.id === 'geo_hl_no_right'))
      if (hlTrap) check(!nearRight(a.figure, scene.t1, 2) && !nearRight(a.figure, scene.t2, 2), `${where}: HL trap on a right angle`)
      if (methods[0] === 'HL') check(scene.rights.length === 2 && squareVerts(a.figure).length === 2, `${where}: HL without two right angles`)
      checkGrades(a, where)
    }
  }, 120000)

  it('corresponding names: vertex order from the statement, or the one order the tick marks support', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = load('geoCongruence', 'gc.parts', seed)
      const where = `gc.parts/${seed}: ${a.prompt}`
      const scene = parseAria(a.figure.ariaLabel)
      figureMatches(a.figure, scene, where)
      assertReal(a.figure, scene.t1, where)
      assertReal(a.figure, scene.t2, where)
      const angleAsk = /△([A-Z]{3}) ≅ △([A-Z]{3})\. Which angle of △([A-Z]{3}) corresponds to ∠([A-Z])\?/.exec(a.prompt)
      const sideAsk = /△([A-Z]{3}) ≅ △([A-Z]{3})\. Which side of △([A-Z]{3}) corresponds to ([A-Z]{2})\?/.exec(a.prompt)
      if (angleAsk || sideAsk) {
        check(scene.sides.length === 0 && scene.angleVerts.length === 0 && scene.rights.length === 0 && scene.shared.length === 0 && scene.vertical.length === 0, `${where}: a naming problem shows marks`)
        const head = (angleAsk ?? sideAsk)!
        const t1 = head[1]!
        const t2 = head[2]!
        const asked = head[3]!
        check(asked === t1 || asked === t2, `${where}: the question asks about a third triangle`)
        const source = asked === t1 ? t2 : t1
        let expected = ''
        if (angleAsk) {
          const idx = source.indexOf(angleAsk[4]!)
          check(idx >= 0, where)
          expected = `∠${asked[idx]}`
        } else {
          const idx = sideIndex(source, sideAsk![4]!)
          check(idx >= 0, where)
          expected = sideWritten(asked, idx)
        }
        const hits = a.stages[0]!.choices?.filter((choice) => choice.text === expected) ?? []
        check(hits.length === 1 && hits[0]!.text === choiceText(a.stages[0]!), `${where}: ${expected} is not the one correct choice`)
        const order = a.stages[0]!.choices?.find((choice) => choice.trap === 'geo_vertices_out_of_order')
        check(Boolean(order) && order!.text !== expected, `${where}: the order trap is the right part`)
      } else {
        check(a.prompt === 'Which congruence statement do the marks support?', where)
        const methods = methodsOfScene(scene)
        check(methods.length === 1 && ['SSS', 'SAS', 'ASA'].includes(methods[0]!), `${where}: statement marks prove ${methods.join(',') || 'nothing'}`)
        const ratio = (sides: number[]) => {
          for (let i = 0; i < sides.length; i++) {
            for (let j = i + 1; j < sides.length; j++) {
              if (Math.abs(sides[i]! - sides[j]!) / Math.max(sides[i]!, sides[j]!) < 0.1) return false
            }
          }
          return true
        }
        const left = assertReal(a.figure, scene.t1, where)
        const rightTri = assertReal(a.figure, scene.t2, where)
        check(ratio(left.sides) && ratio(rightTri.sides), `${where}: a side is within 10% of another`)
        const preserves = (text: string) => {
          const m = /△([A-Z]{3}) ≅ △([A-Z]{3})/.exec(text)
          if (!m) return false
          const map = new Map<string, string>([...m[1]!].map((ch, i) => [ch, m[2]![i]!]))
          const sidesOk = scene.sides.every(([p, q]) => undirected(`${map.get(p[0]!) ?? ''}${map.get(p[1]!) ?? ''}`) === undirected(q))
          const anglesOk = scene.angleVerts.every(([u, v]) => map.get(u) === v)
          return sidesOk && anglesOk
        }
        const hits = a.stages[0]!.choices?.filter((choice) => preserves(choice.text)) ?? []
        check(hits.length === 1 && hits[0]!.text === choiceText(a.stages[0]!), `${where}: ${hits.map((h) => h.text).join(' | ')}`)
        const keys = (a.stages[0]!.choices ?? []).map((choice) => {
          const m = /△([A-Z]{3}) ≅ △([A-Z]{3})/.exec(choice.text)
          if (!m) return choice.text
          return [...m[1]!].map((ch, i) => `${ch}${m[2]![i]}`).sort().join('-')
        })
        check(new Set(keys).size === keys.length, `${where}: two choices name one correspondence`)
      }
      checkGrades(a, `gc.parts/${seed}`)
    }
  }, 120000)
})

// --- proofs --------------------------------------------------------------------------------------------------

interface RowFact {
  statement: string
  reason: ReasonId
  accept: string[]
}

function statementOf(stage: GeometryAnswer['stages'][number]): string {
  if (stage.kind === 'reason') {
    const note = stage.note ?? ''
    if (!note.startsWith('Statement: ')) fail(`no statement on ${stage.id}`)
    return note.slice('Statement: '.length)
  }
  return choiceText(stage)
}
function reasonOf(stage: GeometryAnswer['stages'][number]): { id: ReasonId; accept: string[] } {
  if (stage.kind === 'reason') return { id: stage.answerText as ReasonId, accept: [...(stage.accept ?? [])] }
  const reveal = stage.reveal[0] ?? ''
  const named = /supported by ([^.]+)\./.exec(reveal)
  if (!named) fail(`no reason in ${reveal}`)
  const id = REASONS.find((reason) => reason.label === named[1])?.id
  if (!id) fail(`unknown reason ${named[1]}`)
  const also = /Many books write (.+) for this step/.exec(reveal)
  const accept = also
    ? also[1]!.split(' or ').map((label) => {
        const hit = REASONS.find((reason) => reason.label === label)
        if (!hit) fail(`unknown twin ${label}`)
        return hit.id
      })
    : []
  return { id, accept }
}

const CONG_FAMILY: Record<string, string> = {
  'post-sss': 'SSS',
  'post-sas': 'SAS',
  'post-asa': 'ASA',
  'thm-aas': 'AAS',
  'post-aas': 'AAS',
  'thm-hl': 'HL',
  'post-hl': 'HL',
}

interface Facts {
  sides: [string, string][]
  angles: [string, string][]
  rights: Set<string>
  parallel: [string, string][]
  midpoints: { m: string; seg: string }[]
  segBisectors: { seg: string; at: string }[]
  rayBisectors: { ray: string; angle: string }[]
  perps: [string, string][]
}

function emptyFacts(): Facts {
  return { sides: [], angles: [], rights: new Set(), parallel: [], midpoints: [], segBisectors: [], rayBisectors: [], perps: [] }
}
function triSet(name: string): Set<string> {
  return new Set(name)
}
function isTriAngle(name: string, triangles: string[], where: string): void {
  const letters = new Set(name)
  check(triangles.some((tri) => [...tri].every((ch) => letters.has(ch)) && tri.length === letters.size), `${where}: ${name} is not an angle of the triangles`)
}
function ownAngle(name: string, triangles: string[], where: string): void {
  check(name.length === 3, `${where}: ${name}`)
  isTriAngle(name, triangles, where)
  const tri = triangles.find((item) => triSet(item).has(name[0]!) && triSet(item).has(name[1]!) && triSet(item).has(name[2]!))
  check(Boolean(tri) && triSet(tri!).size === 3, `${where}: ∠${name} uses the wrong vertex`)
}

/** The right-hand part is the image of the left-hand part under the congruence's vertex order. */
function corresponds(map: Map<string, string>, left: string, right: string): boolean {
  const sideL = /^([A-Z]{2})$/.exec(left)
  const sideR = /^([A-Z]{2})$/.exec(right)
  if (sideL && sideR) return undirected(`${map.get(sideL[1]![0]!) ?? ''}${map.get(sideL[1]![1]!) ?? ''}`) === undirected(sideR[1]!)
  const angleL = /^∠([A-Z]{3})$/.exec(left)
  const angleR = /^∠([A-Z]{3})$/.exec(right)
  if (!angleL || !angleR) return false
  const name = angleL[1]!
  const imageArms = [map.get(name[0]!), map.get(name[2]!)].sort().join('')
  return map.get(name[1]!) === angleR[1]![1] && imageArms === arms(angleR[1]!)
}

describe('unit 4 proofs, checked from the rows and the figure', () => {
  it('each congruence follows from the facts above it, and the figure draws only the given marks', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const built = problem('geoTriangleProofs', 'gt.twocolumn', seed)
      const a = built.answer as GeometryAnswer
      const where = `gt.twocolumn/${seed} ${built.params.skeleton}`
      check(/^Given: .+\. Prove: .+\.$/.test(a.prompt), `${where}: ${a.prompt}`)
      const proved = /\. Prove: (.+)\.$/.exec(a.prompt)?.[1] ?? ''
      const givenClause = /^Given: (.+)\. Prove: /.exec(a.prompt)?.[1] ?? ''
      const scene = parseAria(a.figure.ariaLabel)
      figureMatches(a.figure, scene, where)
      assertReal(a.figure, scene.t1, where)
      assertReal(a.figure, scene.t2, where)
      const triangles = [scene.t1, scene.t2]
      const facts = emptyFacts()
      const givenSides: [string, string][] = []
      const givenAngles: [string, string][] = []
      const givenRights = new Set<string>()
      const givenPerpVerts = new Set<string>()
      const givenParallel: [string, string][] = []
      let cong: { t1: string; t2: string; map: Map<string, string> } | null = null
      let proveHits = 0

      const rows: RowFact[] = a.stages.map((stage) => {
        const why = reasonOf(stage)
        return { statement: statementOf(stage), reason: why.id, accept: why.accept }
      })

      rows.forEach((row, index) => {
        const line = `${where}: “${row.statement}” (${row.reason})`
        if (row.statement.includes(' and ') && !row.statement.endsWith('are right triangles')) fail(`${line}: two facts in one row`)
        if (row.reason === 'given') check(givenClause.includes(row.statement), `${line} is not in the Given list`)
        if (row.statement === proved) {
          proveHits += 1
          check(a.stages[index]!.kind === 'reason', `${line}: the Prove line is a statement pick`)
        }
        if (row.reason === 'thm-aas') check(row.accept.join(',') === 'post-aas', `${line} accept`)
        else if (row.reason === 'thm-hl') check(row.accept.join(',') === 'post-hl', `${line} accept`)
        else check(row.accept.length === 0, `${line} should not accept ${row.accept.join(',')}`)

        if (row.reason === 'thm-cpctc') {
          check(cong !== null, `${line}: CPCTC before the triangles are proved congruent`)
          const parts = row.statement.split(' ≅ ')
          check(parts.length === 2 && corresponds(cong!.map, parts[0]!, parts[1]!), `${line}: not the image under ${cong?.t1} ≅ ${cong?.t2}`)
          return
        }
        check(cong === null, `${line}: a row after the congruence is not corresponding parts`)

        if (row.reason === 'given') {
          const one = /^([A-Z]{2}) ≅ ([A-Z]{2})$/.exec(row.statement)
          const ang = /^∠([A-Z]{3}) ≅ ∠([A-Z]{3})$/.exec(row.statement)
          const right = /^∠([A-Z]{3}) is a right angle$/.exec(row.statement)
          const parallel = /^([A-Z]{2}) ∥ ([A-Z]{2})$/.exec(row.statement)
          const perp = /^([A-Z]{2}) ⊥ ([A-Z]{2})$/.exec(row.statement)
          const mid = /^([A-Z]) is the midpoint of ([A-Z]{2})$/.exec(row.statement)
          const ray = /^Ray ([A-Z]{2}) bisects ∠([A-Z]{3})$/.exec(row.statement)
          const seg = /^Line ([A-Z]{2}) bisects ([A-Z]{2}) at ([A-Z])$/.exec(row.statement)
          if (one) {
            facts.sides.push([one[1]!, one[2]!])
            givenSides.push([one[1]!, one[2]!])
          } else if (ang) {
            ownAngle(ang[1]!, triangles, line)
            ownAngle(ang[2]!, triangles, line)
            facts.angles.push([ang[1]!, ang[2]!])
            givenAngles.push([ang[1]![1]!, ang[2]![1]!])
          } else if (right) {
            ownAngle(right[1]!, triangles, line)
            facts.rights.add(right[1]![1]!)
            givenRights.add(right[1]![1]!)
          } else if (parallel) {
            check(linesParallel(a.figure, parallel[1]![0]!, parallel[1]![1]!, parallel[2]![0]!, parallel[2]![1]!), line)
            facts.parallel.push([parallel[1]!, parallel[2]!])
            givenParallel.push([parallel[1]!, parallel[2]!])
          } else if (perp) {
            const common = [...perp[1]!].filter((ch) => perp[2]!.includes(ch))
            check(common.length === 1, `${line}: perpendiculars do not share a vertex`)
            facts.perps.push([perp[1]!, perp[2]!])
            givenPerpVerts.add(common[0]!)
          } else if (mid) {
            facts.midpoints.push({ m: mid[1]!, seg: mid[2]! })
          } else if (ray) {
            check(ray[1]![0] === ray[2]![1], `${line}: the ray does not start at the angle`)
            facts.rayBisectors.push({ ray: ray[1]!, angle: ray[2]! })
          } else if (seg) {
            facts.segBisectors.push({ seg: seg[2]!, at: seg[3]! })
          } else fail(`${line}: unrecognized given`)
        } else if (row.reason === 'cong-refl') {
          const m = /^([A-Z]{2}) ≅ ([A-Z]{2})$/.exec(row.statement)
          if (!m) fail(line)
          check(undirected(m[1]!) === undirected(m[2]!), `${line}: the two names differ`)
          check([...m[1]!].every((ch) => triangles.every((tri) => tri.includes(ch))), `${line}: a letter is missing from a triangle`)
          facts.sides.push([m[1]!, m[2]!])
        } else if (row.reason === 'def-midpoint') {
          const m = /^([A-Z]{2}) ≅ ([A-Z]{2})$/.exec(row.statement)
          if (!m) fail(line)
          const ends = new Set([...m[1]!, ...m[2]!])
          const mid = facts.midpoints.find((item) => ends.has(item.m) && undirected(item.seg) === undirected([...ends].filter((ch) => ch !== item.m).join('')))
          check(Boolean(mid), `${line}: no midpoint makes these halves`)
          check(opposite(a.figure, mid!.seg[0]!, mid!.m, mid!.seg[1]!) && Math.abs(dist(a.figure, mid!.seg[0]!, mid!.m) - dist(a.figure, mid!.m, mid!.seg[1]!)) < 0.05, `${line}: ${mid?.m} is not the midpoint`)
          facts.sides.push([m[1]!, m[2]!])
        } else if (row.reason === 'def-seg-bisector') {
          const m = /^([A-Z]) is the midpoint of ([A-Z]{2})$/.exec(row.statement)
          if (!m) fail(line)
          check(facts.segBisectors.some((item) => item.at === m[1] && undirected(item.seg) === undirected(m[2]!)), `${line}: no bisector said this`)
          check(opposite(a.figure, m[2]![0]!, m[1]!, m[2]![1]!), `${line}: ${m[1]} is not between the endpoints`)
          facts.midpoints.push({ m: m[1]!, seg: m[2]! })
        } else if (row.reason === 'def-ang-bisector') {
          const m = /^∠([A-Z]{3}) ≅ ∠([A-Z]{3})$/.exec(row.statement)
          if (!m) fail(line)
          const [l, r] = [m[1]!, m[2]!]
          check(l[1] === r[1], `${line}: the halves are at different vertices`)
          const ray = facts.rayBisectors.find((item) => item.ray[0] === l[1])
          check(Boolean(ray), `${line}: no bisector`)
          const whole = ray!.angle
          const halfArms = new Set([l[0], l[2], r[0], r[2]])
          check(halfArms.has(ray!.ray[1]!) && halfArms.has(whole[0]!) && halfArms.has(whole[2]!) && whole[1] === l[1], `${line}: the halves are not the bisector's`)
          check(Math.abs(wedge(a.figure, l[1]!, l[0]!, l[2]!) - wedge(a.figure, r[1]!, r[0]!, r[2]!)) < 0.5, `${line}: the halves differ`)
          facts.angles.push([l, r])
        } else if (row.reason === 'def-perp') {
          const m = /^∠([A-Z]{3}) is a right angle$/.exec(row.statement)
          if (!m) fail(line)
          const name = m[1]!
          const perp = facts.perps.find((item) => {
            const common = [...item[0]].filter((ch) => item[1].includes(ch))
            return common.length === 1 && common[0] === name[1] && new Set([...item[0], ...item[1]]).has(name[0]!) && new Set([...item[0], ...item[1]]).has(name[2]!)
          })
          check(Boolean(perp), `${line}: no perpendicular lines meet at this vertex`)
          check(Math.abs(wedge(a.figure, name[1]!, name[0]!, name[2]!) - 90) < 1, `${line}: the angle is not right`)
          facts.rights.add(name[1]!)
        } else if (row.reason === 'def-right-triangle') {
          const m = /^△([A-Z]{3}) and △([A-Z]{3}) are right triangles$/.exec(row.statement)
          if (!m) fail(line)
          for (const name of [m[1]!, m[2]!]) {
            check([...name].some((ch) => facts.rights.has(ch)), `${line}: ${name} has no right angle yet`)
          }
        } else if (row.reason === 'thm-vertical') {
          const m = /^∠([A-Z]{3}) ≅ ∠([A-Z]{3})$/.exec(row.statement)
          if (!m) fail(line)
          const [l, r] = [m[1]!, m[2]!]
          ownAngle(l, triangles, line)
          ownAngle(r, triangles, line)
          check(l[1] === r[1] && !sameAngle(l, r), `${line}: not a pair of distinct angles`)
          const crossed =
            (opposite(a.figure, l[0]!, l[1]!, r[0]!) && opposite(a.figure, l[2]!, l[1]!, r[2]!)) ||
            (opposite(a.figure, l[0]!, l[1]!, r[2]!) && opposite(a.figure, l[2]!, l[1]!, r[0]!))
          check(crossed, `${line}: the rays are not opposite`)
          check(!arced(a.figure, l[1]!), `${line}: the vertical angle is drawn as an arc`)
          facts.angles.push([l, r])
        } else if (row.reason === 'thm-alt-int') {
          const m = /^∠([A-Z]{3}) ≅ ∠([A-Z]{3})$/.exec(row.statement)
          if (!m) fail(line)
          const [l, r] = [m[1]!, m[2]!]
          ownAngle(l, triangles, line)
          ownAngle(r, triangles, line)
          check(l[1] !== r[1], `${line}: same vertex`)
          check(facts.parallel.length > 0, `${line}: no parallel lines yet`)
          check(Math.abs(wedge(a.figure, l[1]!, l[0]!, l[2]!) - wedge(a.figure, r[1]!, r[0]!, r[2]!)) < 0.5, `${line}: the angles differ`)
          check(!arced(a.figure, l[1]!) && !arced(a.figure, r[1]!), `${line}: drawn as arcs`)
          facts.angles.push([l, r])
        } else if (CONG_FAMILY[row.reason]) {
          const m = /^△([A-Z]{3}) ≅ △([A-Z]{3})$/.exec(row.statement)
          if (!m) fail(line)
          check(m[1] === scene.t1 && m[2] === scene.t2, `${line}: ${m[1]} ≅ ${m[2]} is not ${scene.t1} and ${scene.t2}`)
          const methods = methodsFrom(
            m[1]!,
            m[2]!,
            (p, q) => sideHit(facts.sides, [], p, q),
            (u, v) => angleHit([], facts.angles, [...facts.rights], u, v),
            facts.rights,
          )
          check(methods.join(',') === CONG_FAMILY[row.reason], `${line}: the facts prove ${methods.join('+') || 'nothing'}, not ${CONG_FAMILY[row.reason]}`)
          cong = { t1: m[1]!, t2: m[2]!, map: new Map([...m[1]!].map((ch, i) => [ch, m[2]![i]!])) }
        } else fail(`${line}: no rule for this reason`)
      })

      check(proveHits === 1, `${where}: the Prove line is not exactly one reason row`)
      check(cong !== null, `${where}: the triangles are never proved congruent`)
      sameKeys(keysOf(tickPairs(a.figure), 'seg'), keysOf(givenSides, 'seg'), `${where} ticks are not the given sides`)
      sameKeys(keysOf(arcPairs(a.figure), 'vert'), keysOf(givenAngles, 'vert'), `${where} arcs are not the given angles`)
      const squareExpected = [...new Set([...givenRights, ...givenPerpVerts])].sort()
      check(squareVerts(a.figure).slice().sort().join(',') === squareExpected.join(','), `${where}: squares ${squareVerts(a.figure).join(',')} vs ${squareExpected.join(',')}`)
      sameKeys(keysOf(arrowPairs(a.figure), 'seg'), keysOf(givenParallel, 'seg'), `${where} arrows`)
      for (const shared of scene.shared) {
        check([...shared].every((ch) => scene.t1.includes(ch) && scene.t2.includes(ch)), `${where}: shared ${shared}`)
      }
      for (const [p, q] of scene.vertical) {
        const crossed =
          (opposite(a.figure, p[0]!, p[1]!, q[0]!) && opposite(a.figure, p[2]!, p[1]!, q[2]!)) ||
          (opposite(a.figure, p[0]!, p[1]!, q[2]!) && opposite(a.figure, p[2]!, p[1]!, q[0]!))
        check(crossed && !arced(a.figure, p[1]!), `${where}: listed vertical ${p}-${q}`)
      }
      for (const [p, q] of scene.alt) {
        check(Math.abs(wedge(a.figure, p[1]!, p[0]!, p[2]!) - wedge(a.figure, q[1]!, q[0]!, q[2]!)) < 0.5, `${where}: listed alt ${p}-${q}`)
        check(!arced(a.figure, p[1]!) && !arced(a.figure, q[1]!), `${where}: listed alt is arced`)
      }
      const hlTrap = a.stages.some((stage) => stage.traps.some((trap) => trap.id === 'geo_hl_no_right'))
      const skeleton = String(built.params.skeleton)
      if (hlTrap) {
        check(skeleton !== 'hl-right' && skeleton !== 'hl-perp', `${where}: HL trap on an HL proof`)
        check(!nearRight(a.figure, scene.t1, 2) && !nearRight(a.figure, scene.t2, 2), `${where}: a right angle where HL is a trap`)
      }
      if (skeleton === 'hl-right' || skeleton === 'hl-perp') {
        check(squareVerts(a.figure).length >= 1, `${where}: HL has no square`)
        check(!hlTrap, `${where}: an HL proof offers HL as a mistake`)
      }
      checkGrades(a, where)
    }
  }, 120000)
})
