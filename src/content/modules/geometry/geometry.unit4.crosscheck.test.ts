/**
 * Independent re-solve of Honors Geometry Unit 4 (written by the reviewer, not the generator's author).
 * Every problem is solved again from what the student sees: the congruence statement and the given
 * expressions in the prompt, and the marks actually drawn in the figure (ticks, arcs, right-angle squares,
 * parallel arrows). Shared sides, vertical angles and alternate interior angles are found from the
 * figure's coordinates, never from the generator's own lists. The stored answers, the promised slips and
 * every choice or reason that grades as a named mistake must agree with that reading.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec, ModuleId } from '@/shared/types'
import { gradeGeoStage } from './grade'
import { REASONS } from './reasons'

const SEEDS = Number(process.env.GEO4_SEEDS ?? 400)
const HEAVY = 120000

function problem(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const a = generateProblem(module, template, seed).answer
  if (a.type !== 'geometry') throw new Error(`${template}/${seed} is not geometry`)
  return a as GeometryAnswer
}

// ---------- exact numbers ----------------------------------------------------------------------

type Q = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b))
const q = (n: bigint | number, d: bigint | number = 1n): Q => {
  let N = BigInt(n)
  let D = BigInt(d)
  if (D === 0n) throw new Error('division by zero')
  if (D < 0n) [N, D] = [-N, -D]
  const g = gcd(N, D) || 1n
  return { n: N / g, d: D / g }
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
const eqQ = (a: Q, b: Q) => a.n === b.n && a.d === b.d
const show = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`)
const num = (a: Q) => Number(a.n) / Number(a.d)
const pos = (a: Q) => a.n > 0n
const readQ = (text: string): Q => {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '').replace(/°$/, '').replace(/^x=/, '')
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s)
  if (!m) throw new Error(`not a number: ${text}`)
  return q(BigInt(m[1]!), BigInt(m[2] ?? 1))
}

/** "2x + 10", "x − 1", "−3x + 40", "40 − 3x", "5x", "65", "(2x + 20)°" as [coefficient of x, constant]. */
type Lin = [Q, Q]
function lin(text: string): Lin {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '').replace(/°$/, '').replace(/^\((.*)\)$/, '$1')
  const coef = (c: string) => (c === '' || c === '+' ? 1n : c === '-' ? -1n : BigInt(c))
  let m = /^([+-]?\d*)x([+-]\d+)?$/.exec(s)
  if (m) return [q(coef(m[1]!)), q(BigInt(m[2] ?? 0))]
  m = /^([+-]?\d+)([+-]\d*)x$/.exec(s)
  if (m) return [q(coef(m[2]!)), q(BigInt(m[1]!))]
  m = /^([+-]?\d+)$/.exec(s)
  if (m) return [q(0), q(BigInt(m[1]!))]
  throw new Error(`not a linear expression: ${text}`)
}
const at = (l: Lin, x: Q) => add(mul(l[0], x), l[1])
/** x with a = b, or null when the x terms cancel. */
function solveLin(a: Lin, b: Lin): Q | null {
  const dc = sub(a[0], b[0])
  if (dc.n === 0n) return null
  return div(sub(b[1], a[1]), dc)
}

// ---------- the figure, from its coordinates -----------------------------------------------------

type Fig = GeoFigureSpec
type Pt = { x: number; y: number }
function P(fig: Fig, id: string): Pt {
  const p = fig.points.find((item) => item.id === id)
  if (!p) throw new Error(`the figure has no point ${id}`)
  return { x: p.x, y: p.y }
}
const dir = (a: Pt, b: Pt): Pt => ({ x: b.x - a.x, y: b.y - a.y })
const crs = (u: Pt, v: Pt) => u.x * v.y - u.y * v.x
const dt = (u: Pt, v: Pt) => u.x * v.x + u.y * v.y
const nrm = (u: Pt) => Math.hypot(u.x, u.y)
const sinOf = (u: Pt, v: Pt) => crs(u, v) / (nrm(u) * nrm(v))
const parallelDir = (u: Pt, v: Pt) => Math.abs(sinOf(u, v)) < 2e-3
const sameDir = (u: Pt, v: Pt) => parallelDir(u, v) && dt(u, v) > 0
const oppDir = (u: Pt, v: Pt) => parallelDir(u, v) && dt(u, v) < 0
const dist = (fig: Fig, a: string, b: string) => nrm(dir(P(fig, a), P(fig, b)))
function degAt(fig: Fig, v: string, a: string, b: string): number {
  const u = dir(P(fig, v), P(fig, a))
  const w = dir(P(fig, v), P(fig, b))
  return (Math.acos(Math.max(-1, Math.min(1, dt(u, w) / (nrm(u) * nrm(w))))) * 180) / Math.PI
}

/** An angle as she sees it: a vertex and its two rays. */
interface Ang {
  v: string
  r1: Pt
  r2: Pt
  name: string
}
function ang(fig: Fig, v: string, a: string, b: string): Ang {
  const V = P(fig, v)
  return { v, r1: dir(V, P(fig, a)), r2: dir(V, P(fig, b)), name: `∠${a}${v}${b}` }
}
const sameAng = (x: Ang, y: Ang) =>
  x.v === y.v && ((sameDir(x.r1, y.r1) && sameDir(x.r2, y.r2)) || (sameDir(x.r1, y.r2) && sameDir(x.r2, y.r1)))
/** The angle of triangle T at its k-th vertex. */
const triAng = (fig: Fig, T: readonly string[], k: number) => ang(fig, T[k]!, T[(k + 1) % 3]!, T[(k + 2) % 3]!)
const segKey = (a: string, b: string) => (a < b ? `${a}${b}` : `${b}${a}`)
const sameSeg = (a: readonly [string, string], b: readonly [string, string]) => segKey(a[0], a[1]) === segKey(b[0], b[1])

/** Two angles at one vertex whose rays are pairwise opposite. */
function vertical(x: Ang, y: Ang): boolean {
  return x.v === y.v && ((oppDir(x.r1, y.r1) && oppDir(x.r2, y.r2)) || (oppDir(x.r1, y.r2) && oppDir(x.r2, y.r1)))
}

type LineRef = { a: string; b: string; tag: string }
function onLine(fig: Fig, line: LineRef, point: Pt, along: Pt): boolean {
  const A = P(fig, line.a)
  const d = dir(A, P(fig, line.b))
  if (!parallelDir(d, along)) return false
  return Math.abs(crs(d, dir(A, point))) / nrm(d) < 1e-2
}
/**
 * Alternate interior angles: the transversal joins the two vertices, and the other rays run along two
 * different lines of the same parallel pair (same tag) in opposite directions.
 */
function altInterior(fig: Fig, lines: LineRef[], x: Ang, y: Ang): boolean {
  if (x.v === y.v) return false
  const X = P(fig, x.v)
  const Y = P(fig, y.v)
  const other = (g: Ang, t: Pt) => (sameDir(g.r1, t) ? g.r2 : sameDir(g.r2, t) ? g.r1 : null)
  const ox = other(x, dir(X, Y))
  const oy = other(y, dir(Y, X))
  if (!ox || !oy || !oppDir(ox, oy)) return false
  const lx = lines.find((l) => onLine(fig, l, X, ox))
  const ly = lines.find((l) => onLine(fig, l, Y, oy))
  if (!lx || !ly || lx.tag !== ly.tag) return false
  // two different lines of the pair, not one line through both vertices
  return !onLine(fig, lx, Y, oy)
}

// ---------- what the figure marks ---------------------------------------------------------------

interface Marks {
  tick(a: string, b: string): number | undefined
  arc(x: Ang): number | undefined
  right(x: Ang): boolean
  lines: LineRef[]
  anyRight: boolean
}
function marksOf(fig: Fig): Marks {
  const ticks = new Map<string, number>()
  for (const s of fig.segments ?? []) {
    if (!s.ticks) continue
    const k = segKey(s.from, s.to)
    if (ticks.has(k) && ticks.get(k) !== s.ticks) throw new Error(`segment ${k} carries two tick counts`)
    ticks.set(k, s.ticks)
  }
  const marks = (fig.angles ?? []).map((m) => ({ a: ang(fig, m.vertex, m.from, m.to), arcs: m.right ? undefined : m.marks, right: Boolean(m.right) }))
  return {
    tick: (a, b) => ticks.get(segKey(a, b)),
    arc: (x) => marks.find((m) => !m.right && m.arcs && sameAng(m.a, x))?.arcs,
    right: (x) => marks.some((m) => m.right && sameAng(m.a, x)),
    lines: (fig.lines ?? []).filter((l) => l.arrows).map((l) => ({ a: l.through[0], b: l.through[1], tag: String(l.arrows) })),
    anyRight: marks.some((m) => m.right),
  }
}

interface Facts {
  seg(a: readonly [string, string], b: readonly [string, string]): boolean
  ang(x: Ang, y: Ang): boolean
  right(x: Ang): boolean
}

/** What the drawn marks give. `reflexive: false` or `vertical: false` forgets those (for the "missed" slips). */
function figureFacts(fig: Fig, opts: { reflexive?: boolean; vertical?: boolean } = {}): Facts {
  const M = marksOf(fig)
  return {
    seg: (a, b) => {
      if (sameSeg(a, b)) return opts.reflexive !== false
      const t = M.tick(a[0], a[1])
      return t !== undefined && t === M.tick(b[0], b[1])
    },
    ang: (x, y) => {
      if (sameAng(x, y)) return opts.reflexive !== false
      const ax = M.arc(x)
      if (ax !== undefined && ax === M.arc(y)) return true
      if (M.right(x) && M.right(y)) return true
      if (opts.vertical !== false && vertical(x, y)) return true
      return altInterior(fig, M.lines, x, y)
    },
    right: (x) => M.right(x),
  }
}

// ---------- deciding congruence ------------------------------------------------------------------

type Method = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'HL'
const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const

interface Parts {
  sc: boolean[]
  ac: boolean[]
  r1: boolean[]
  r2: boolean[]
}
/** Under T1[k] -> B[k]: side k joins vertices k and k+1; angle k sits at vertex k. */
function partsUnder(fig: Fig, T1: readonly string[], B: readonly string[], F: Facts): Parts {
  const A1 = [0, 1, 2].map((k) => triAng(fig, T1, k))
  const A2 = [0, 1, 2].map((k) => triAng(fig, B, k))
  return {
    sc: [0, 1, 2].map((k) => F.seg([T1[k]!, T1[(k + 1) % 3]!], [B[k]!, B[(k + 1) % 3]!])),
    ac: [0, 1, 2].map((k) => F.ang(A1[k]!, A2[k]!)),
    r1: A1.map((g) => F.right(g)),
    r2: A2.map((g) => F.right(g)),
  }
}
function methodsOfParts({ sc, ac, r1, r2 }: Parts): Method[] {
  const out = new Set<Method>()
  if (sc.every(Boolean)) out.add('SSS')
  for (let k = 0; k < 3; k++) {
    const k1 = (k + 1) % 3
    const k2 = (k + 2) % 3
    if (sc[k2] && sc[k] && ac[k]) out.add('SAS') // the sides at vertex k and the angle between them
    if (sc[k] && ac[k] && ac[k1]) out.add('ASA') // the angles at the ends of side k
    if (ac[k] && ac[k1] && (sc[k1] || sc[k2])) out.add('AAS') // the same two angles, another side
    if (r1[k] && r2[k] && sc[k1] && (sc[k] || sc[k2])) out.add('HL') // right angle at k: side k1 is the hypotenuse
  }
  return [...out]
}
/** Two pairs of sides and an angle that is not between them, under this correspondence. */
function ssaOfParts({ sc, ac }: Parts): boolean {
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3 // sides i and j meet at vertex j
    if (!sc[i] || !sc[j]) continue
    for (let k = 0; k < 3; k++) if (k !== j && ac[k]) return true
  }
  return false
}
const imageOf = (T2: readonly string[], perm: readonly number[]) => [T2[perm[0]!]!, T2[perm[1]!]!, T2[perm[2]!]!]

interface Decision {
  methods: Set<Method>
  perms: (readonly number[])[]
  ssa: boolean
  anySide: boolean
  allAngles: boolean
}
function decide(fig: Fig, T1: readonly string[], T2: readonly string[], F: Facts): Decision {
  const out: Decision = { methods: new Set(), perms: [], ssa: false, anySide: false, allAngles: false }
  for (const perm of PERMS) {
    const parts = partsUnder(fig, T1, imageOf(T2, perm), F)
    const ms = methodsOfParts(parts)
    if (ms.length) out.perms.push(perm)
    for (const m of ms) out.methods.add(m)
    if (ssaOfParts(parts)) out.ssa = true
    if (parts.sc.some(Boolean)) out.anySide = true
    if (parts.ac.every(Boolean)) out.allAngles = true
  }
  return out
}

/** "△ABC ≅ △UTS" as the map from T1's letters to T2's, whichever triangle it names first; null if neither. */
function statementMap(text: string, T1: readonly string[], T2: readonly string[]): Map<string, string> | null {
  const m = /^△([A-Z]{3}) ≅ △([A-Z]{3})$/.exec(text.trim())
  if (!m) return null
  const L = [...m[1]!]
  const R = [...m[2]!]
  const set = (a: readonly string[]) => [...a].sort().join('')
  if (set(L) === set(T1) && set(R) === set(T2)) return new Map(L.map((c, i) => [c, R[i]!]))
  if (set(L) === set(T2) && set(R) === set(T1)) return new Map(R.map((c, i) => [c, L[i]!]))
  return null
}
const permMap = (T1: readonly string[], T2: readonly string[], perm: readonly number[]) =>
  new Map(T1.map((c, k) => [c, T2[perm[k]!]!]))
const sameMap = (a: Map<string, string>, b: Map<string, string>) => [...a].every(([k, v]) => b.get(k) === v)

function trianglesOf(aria: string): [string[], string[]] {
  const m = /^Triangles? ([A-Z]{3}) and ([A-Z]{3})\./.exec(aria)
  if (!m) throw new Error(`no triangles in “${aria.slice(0, 60)}”`)
  return [[...m[1]!], [...m[2]!]]
}

// ---------- the description lists exactly the drawn marks -----------------------------------------

function ariaAgrees(where: string, a: GeometryAnswer, T1: string[], T2: string[]): string[] {
  const bad: string[] = []
  const fig = a.figure
  const field = (name: string) => {
    const m = new RegExp(`${name}: ([^.]*)\\.`).exec(fig.ariaLabel)
    if (!m) return null
    return m[1] === 'none' ? [] : m[1]!.split('; ')
  }
  const sides = field('Side pairs')
  const ticked = (fig.segments ?? []).filter((s) => s.ticks)
  if (sides) {
    const listed = new Set<string>()
    for (const item of sides) {
      const m = /^([A-Z]{2})-([A-Z]{2}) tick (\d)$/.exec(item)
      if (!m) {
        bad.push(`${where}: side pair “${item}”`)
        continue
      }
      for (const s of [m[1]!, m[2]!]) {
        listed.add(segKey(s[0]!, s[1]!))
        const seg = ticked.find((t) => segKey(t.from, t.to) === segKey(s[0]!, s[1]!))
        if (!seg || String(seg.ticks) !== m[3]) bad.push(`${where}: the description gives ${s} ${m[3]} ticks, the figure ${seg?.ticks ?? 0}`)
      }
    }
    for (const t of ticked) if (!listed.has(segKey(t.from, t.to))) bad.push(`${where}: ${t.from}${t.to} has ticks the description leaves out`)
  }
  const rights = field('Right angles')
  const squares = (fig.angles ?? []).filter((g) => g.right).map((g) => g.vertex)
  if (rights && [...rights].sort().join() !== [...squares].sort().join()) bad.push(`${where}: right angles ${rights} vs drawn ${squares}`)
  const arcs = field('Angle pairs')
  const arced = (fig.angles ?? []).filter((g) => !g.right && g.marks)
  if (arcs) {
    const listed = arcs.flatMap((item) => {
      const m = /^([A-Z])-([A-Z]) arc (\d)$/.exec(item)
      if (!m) {
        bad.push(`${where}: angle pair “${item}”`)
        return []
      }
      return [`${m[1]}${m[3]}`, `${m[2]}${m[3]}`]
    })
    const drawn = arced.map((g) => `${g.vertex}${g.marks}`)
    if ([...listed].sort().join() !== [...drawn].sort().join()) bad.push(`${where}: arcs listed ${listed} vs drawn ${drawn}`)
  }
  const shared = field('Shared sides')
  if (shared) {
    const common: string[] = []
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (sameSeg([T1[i]!, T1[(i + 1) % 3]!], [T2[j]!, T2[(j + 1) % 3]!])) common.push(segKey(T1[i]!, T1[(i + 1) % 3]!))
      }
    }
    const listed = shared.map((s) => segKey(s[0]!, s[1]!))
    if ([...listed].sort().join() !== [...common].sort().join()) bad.push(`${where}: shared sides listed ${listed} vs the triangles' common sides ${common}`)
  }
  const vert = field('Vertical angles')
  if (vert) {
    let found = 0
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (vertical(triAng(fig, T1, i), triAng(fig, T2, j))) found++
    if (found !== vert.length) bad.push(`${where}: ${vert.length} vertical pair(s) listed, ${found} in the figure`)
  }
  return bad
}

// ---------- gc.which -------------------------------------------------------------------------------

const BUTTON: Record<string, Method | 'none'> = { SSS: 'SSS', SAS: 'SAS', ASA: 'ASA', AAS: 'AAS', HL: 'HL', none: 'none' }

function checkWhich(where: string, a: GeometryAnswer): { answer: string; bad: string[] } {
  const bad: string[] = []
  const [T1, T2] = trianglesOf(a.figure.ariaLabel)
  bad.push(...ariaAgrees(where, a, T1, T2))
  const D = decide(a.figure, T1, T2, figureFacts(a.figure))
  if (D.methods.size > 1) bad.push(`${where}: the marks prove ${[...D.methods].join(' and ')}: ambiguous`)
  const mine = D.methods.size === 0 ? 'none' : [...D.methods][0]!
  const stage = a.stages[0]!
  if (BUTTON[stage.answerText] !== mine) bad.push(`${where}: stored ${stage.answerText}, the marks give ${mine}`)
  const noReflexive = decide(a.figure, T1, T2, figureFacts(a.figure, { reflexive: false })).methods.size === 0
  const noVertical = decide(a.figure, T1, T2, figureFacts(a.figure, { vertical: false })).methods.size === 0
  const M = marksOf(a.figure)
  for (const c of stage.choices ?? []) {
    const g = gradeGeoStage(a, stage.id, c.id)
    if (c.id === stage.answerText) continue
    if (g.verdict !== 'mistake') continue
    let ok = false
    switch (g.mistake) {
      case 'geo_ssa_as_congruence':
        ok = c.id === 'SSA' && mine === 'none' && D.ssa
        break
      case 'geo_aaa_as_congruence':
        ok = c.id === 'AAA' && mine === 'none' && D.allAngles && !D.anySide
        break
      case 'geo_sas_not_included':
        ok = c.id === 'SAS' && (mine === 'none' || mine === 'HL') && D.ssa
        break
      case 'geo_asa_aas_swapped':
        ok = (mine === 'ASA' && c.id === 'AAS') || (mine === 'AAS' && c.id === 'ASA')
        break
      case 'geo_hl_no_right':
        ok = c.id === 'HL' && !M.anyRight
        break
      case 'geo_shared_side_missed':
        ok = c.id === 'none' && mine !== 'none' && noReflexive
        break
      case 'geo_vertical_angles_missed' as string:
        ok = c.id === 'none' && mine !== 'none' && noVertical
        break
      default:
        ok = false
    }
    if (!ok) bad.push(`${where}: picking ${c.id} is named ${g.mistake}, which these marks do not support (answer ${mine})`)
  }
  return { answer: mine, bad }
}

// ---------- gc.parts ---------------------------------------------------------------------------

function checkParts(where: string, a: GeometryAnswer): { kind: 'name' | 'statement'; alphabetical: boolean; bad: string[] } {
  const bad: string[] = []
  const stage = a.stages[0]!
  const right = stage.choices?.find((c) => c.id === stage.answerText)?.text ?? ''
  const named =
    /^△([A-Z]{3}) ≅ △([A-Z]{3})\. Which (angle|side) of △([A-Z]{3}) corresponds to (?:∠([A-Z])|([A-Z]{2}))\?$/.exec(a.prompt) ??
    /^△([A-Z]{3}) ≅ △([A-Z]{3})\. Which (angle|side) matches ()(?:∠([A-Z])|([A-Z]{2}))\?$/.exec(a.prompt)
  if (named) {
    const L = [...named[1]!]
    const R = [...named[2]!]
    const there = new Map<string, string>()
    L.forEach((c, i) => there.set(c, R[i]!))
    R.forEach((c, i) => there.set(c, L[i]!))
    const target = named[4] ? [...named[4]] : null
    const expect1 = named[5] ? `∠${there.get(named[5])}` : null
    const side = named[6]
    const expectSide = side ? [there.get(side[0]!)!, there.get(side[1]!)!] : null
    const is = (text: string) =>
      expect1 ? text === expect1 : expectSide ? /^[A-Z]{2}$/.test(text) && sameSeg([text[0]!, text[1]!], expectSide as [string, string]) : false
    if (!is(right)) bad.push(`${where}: stored ${right}, the statement gives ${expect1 ?? expectSide?.join('')}`)
    for (const c of stage.choices ?? []) if (c.id !== stage.answerText && is(c.text)) bad.push(`${where}: ${c.text} is also right`)
    const answerLetters = expect1 ? [expect1[1]!] : expectSide ?? []
    if (target && !answerLetters.every((ch) => target.includes(ch))) bad.push(`${where}: the answer is not in △${target.join('')}`)
    const home = (answerLetters.every((ch) => L.includes(ch)) ? L : R) as string[]
    for (const c of stage.choices ?? []) {
      const g = gradeGeoStage(a, stage.id, c.id)
      if (g.verdict !== 'mistake') continue
      const letters = c.text.startsWith('∠') ? [c.text[1]!] : [...c.text]
      const inHome = letters.every((ch) => home.includes(ch))
      if (g.mistake !== 'geo_vertices_out_of_order' || !inHome) bad.push(`${where}: ${c.text} is named ${g.mistake}`)
    }
    // Pairing by the alphabet: the k-th letter in order with the k-th letter in order.
    const sortL = [...L].sort()
    const sortR = [...R].sort()
    const alpha = L.every((c, i) => sortR[sortL.indexOf(c)] === R[i])
    return { kind: 'name', alphabetical: alpha, bad }
  }
  // Mode B: the marks decide the correspondence.
  const [T1, T2] = trianglesOf(a.figure.ariaLabel)
  bad.push(...ariaAgrees(where, a, T1, T2))
  const D = decide(a.figure, T1, T2, figureFacts(a.figure))
  if (D.perms.length !== 1) bad.push(`${where}: the marks allow ${D.perms.length} correspondences`)
  const truth = D.perms[0] ? permMap(T1, T2, D.perms[0]) : null
  const rightMap = statementMap(right, T1, T2)
  if (!truth || !rightMap || !sameMap(rightMap, truth)) bad.push(`${where}: stored “${right}” is not the correspondence the marks force`)
  for (const c of stage.choices ?? []) {
    if (c.id === stage.answerText) continue
    const m = statementMap(c.text, T1, T2)
    if (!m) bad.push(`${where}: “${c.text}” does not name the two triangles`)
    else if (truth && sameMap(m, truth)) bad.push(`${where}: “${c.text}” names the same correspondence as the answer`)
  }
  const sortedTruth = truth ? [...T1].sort().every((c, i) => truth.get(c) === [...T2].sort()[i]) : false
  return { kind: 'statement', alphabetical: sortedTruth, bad }
}

// ---------- gc.solve and gi.solve ------------------------------------------------------------------

type PartName = { kind: 'angle'; v: string } | { kind: 'side'; p: string; q: string }
function readPart(text: string): PartName {
  const m = /^m∠([A-Z])$/.exec(text)
  if (m) return { kind: 'angle', v: m[1]! }
  const s = /^([A-Z])([A-Z])$/.exec(text)
  if (s) return { kind: 'side', p: s[1]!, q: s[2]! }
  throw new Error(`not a part: ${text}`)
}
const partKey = (p: PartName) => (p.kind === 'angle' ? `∠${p.v}` : segKey(p.p, p.q))
function givens(body: string): { part: PartName; expr: Lin; text: string }[] {
  return [...body.matchAll(/(m∠[A-Z]|\b[A-Z]{2}\b) = ([^,.]+)/g)].map((m) => ({ part: readPart(m[1]!), expr: lin(m[2]!.trim()), text: m[1]! }))
}

function checkSolve(where: string, a: GeometryAnswer): { x: string; bad: string[] } {
  const bad: string[] = []
  const st = /^△([A-Z]{3}) ≅ △([A-Z]{3})\. (.*) Find x, then (m∠[A-Z]|[A-Z]{2})\.$/.exec(a.prompt)
  if (!st) return { x: '', bad: [`${where}: unreadable prompt “${a.prompt}”`] }
  const L = [...st[1]!]
  const R = [...st[2]!]
  const there = new Map<string, string>()
  L.forEach((c, i) => there.set(c, R[i]!))
  R.forEach((c, i) => there.set(c, L[i]!))
  const image = (p: PartName): string => (p.kind === 'angle' ? `∠${there.get(p.v)}` : segKey(there.get(p.p)!, there.get(p.q)!))
  const parts = givens(st[3]!)
  const target = readPart(st[4]!)
  if (parts.length !== 3) bad.push(`${where}: ${parts.length} given parts`)
  const pairs: [number, number][] = []
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (image(parts[i]!.part) === partKey(parts[j]!.part)) pairs.push([i, j])
  if (pairs.length !== 1) return { x: '', bad: [...bad, `${where}: ${pairs.length} corresponding pairs among the givens`] }
  const [i, j] = pairs[0]!
  const x = solveLin(parts[i]!.expr, parts[j]!.expr)
  if (!x) return { x: '', bad: [...bad, `${where}: the corresponding parts are equal for every x or none`] }
  const tIndex = parts.findIndex((p) => partKey(p.part) === partKey(target))
  if (tIndex !== i && tIndex !== j) bad.push(`${where}: the asked part is not in the corresponding pair`)
  const xs = a.stages.find((s) => s.id === 'x')!
  const rs = a.stages.find((s) => s.id === 'result')!
  if (!eqQ(readQ(xs.answerText), x)) bad.push(`${where}: stored x = ${xs.answerText}, the wording gives ${show(x)}`)
  const value = at(parts[tIndex]!.expr, x)
  if (!eqQ(readQ(rs.answerText), value)) bad.push(`${where}: stored ${st[4]} = ${rs.answerText}, the wording gives ${show(value)}`)
  // Every given part is a positive measure, and the triangles are real.
  const known = new Map<string, Q>()
  for (const p of parts) {
    const v = at(p.expr, x)
    if (!pos(v)) bad.push(`${where}: ${p.text} is ${show(v)} at x = ${show(x)}`)
    known.set(partKey(p.part), v)
    known.set(image(p.part), v)
  }
  for (const T of [L, R]) {
    if (target.kind === 'angle') {
      const angles = T.map((v) => known.get(`∠${v}`)).filter((v): v is Q => v !== undefined)
      const sum = angles.reduce((s, v) => add(s, v), q(0))
      if (angles.length === 3 ? !eqQ(sum, q(180)) : num(sum) >= 180) bad.push(`${where}: the angles of △${T.join('')} sum to ${show(sum)} with ${angles.length} known`)
      // The drawing shows those measures.
      for (const v of T) {
        const k = known.get(`∠${v}`)
        if (!k) continue
        const i2 = T.indexOf(v)
        const drawn = degAt(a.figure, v, T[(i2 + 1) % 3]!, T[(i2 + 2) % 3]!)
        if (Math.abs(drawn - num(k)) > 2) bad.push(`${where}: ∠${v} is ${show(k)} but drawn ${drawn.toFixed(1)}`)
      }
    } else {
      const sides = [0, 1, 2].map((k) => known.get(segKey(T[k]!, T[(k + 1) % 3]!))).filter((v): v is Q => v !== undefined)
      if (sides.length === 3) {
        const [p, r, s] = sides.map(num) as [number, number, number]
        if (p + r <= s || p + s <= r || r + s <= p) bad.push(`${where}: sides ${p}, ${r}, ${s} are not a triangle`)
      }
    }
  }
  // The promised slip: the asked part set equal to the part that does not correspond to it.
  if (a.trap === 'geo_vertices_out_of_order' && a.trapStage === 'x') {
    const k = [0, 1, 2].find((n) => n !== i && n !== j)!
    const wrong = solveLin(parts[tIndex]!.expr, parts[k]!.expr)
    if (!wrong || !eqQ(wrong, readQ(a.trapAnswer)) || eqQ(wrong, x)) bad.push(`${where}: trap x = ${a.trapAnswer}, the slip gives ${wrong ? show(wrong) : 'nothing'}`)
  }
  return { x: show(x), bad }
}

function checkIsosceles(where: string, a: GeometryAnswer): { x: string; family: string; bad: string[] } {
  const bad: string[] = []
  const xs = a.stages.find((s) => s.id === 'x')!
  const rs = a.stages.find((s) => s.id === 'result')!
  const tail = /Find x, then (m∠[A-Z]|[A-Z]{2})\.$/.exec(a.prompt)
  if (!tail) return { x: '', family: '?', bad: [`${where}: unreadable prompt “${a.prompt}”`] }
  const target = readPart(tail[1]!)
  const tri = /Triangle ([A-Z]{3})\./.exec(a.figure.ariaLabel)
  const T = tri ? [...tri[1]!] : []
  if (T.length !== 3) bad.push(`${where}: no triangle in the description`)
  const parts = givens(a.prompt.slice(0, tail.index))
  const exprOf = (key: string) => parts.find((p) => partKey(p.part) === key)?.expr
  const opposite = (key: string): string => {
    if (key.startsWith('∠')) {
      const v = key[1]!
      const [p, r] = T.filter((c) => c !== v) as [string, string]
      return segKey(p, r)
    }
    return `∠${T.find((c) => !key.includes(c))}`
  }
  let x: Q | null = null
  let family = '?'
  let trapXs: Q[] = []
  let sides = /^([A-Z]{2}) ≅ ([A-Z]{2})(?: and m∠([A-Z]) = (\d+))?\./.exec(a.prompt) ?? /^([A-Z]{2}) and ([A-Z]{2}) match\.()()/.exec(a.prompt)
  const angles = /^∠([A-Z]) ≅ ∠([A-Z])\./.exec(a.prompt) ?? /^∠([A-Z]) and ∠([A-Z]) match\./.exec(a.prompt)
  const equi = /^△([A-Z]{3}) is equilateral\./.exec(a.prompt) ?? /^([A-Z]{2}), ([A-Z]{2}), and ([A-Z]{2}) all match\./.exec(a.prompt)
  if (equi) sides = null
  if (sides) {
    family = sides[4] ? 'vertex' : 'theorem'
    const s1 = segKey(sides[1]![0]!, sides[1]![1]!)
    const s2 = segKey(sides[2]![0]!, sides[2]![1]!)
    const b1 = opposite(s1)
    const b2 = opposite(s2)
    const apex = `∠${T.find((c) => s1.includes(c) && s2.includes(c))}`
    const e1 = exprOf(b1)
    const e2 = exprOf(b2)
    const eApex = exprOf(apex)
    if (sides[4]) {
      const apexValue = q(BigInt(sides[4]))
      const e = e1 ?? e2
      if (!e) bad.push(`${where}: no base angle given`)
      else {
        x = solveLin(e, [q(0), div(sub(q(180), apexValue), q(2))])
        // The slip: the base angle set equal to the vertex angle.
        trapXs = [solveLin(e, [q(0), apexValue])].filter((v): v is Q => v !== null)
      }
      if (`∠${sides[3]}` !== apex) bad.push(`${where}: the given vertex angle is not the vertex angle`)
    } else if (e1 && e2) {
      x = solveLin(e1, e2)
      if (x && eApex && !eqQ(add(at(eApex, x), add(at(e1, x), at(e2, x))), q(180))) bad.push(`${where}: the angles do not sum to 180 at x = ${show(x)}`)
      if (eApex) trapXs = [solveLin(eApex, e1), solveLin(eApex, e2)].filter((v): v is Q => v !== null)
    } else if ((e1 || e2) && eApex) {
      const e = (e1 ?? e2)!
      x = solveLin([add(eApex[0], mul(q(2), e[0])), add(eApex[1], mul(q(2), e[1]))], [q(0), q(180)])
      trapXs = [solveLin(eApex, e)].filter((v): v is Q => v !== null)
    } else bad.push(`${where}: not enough angles given`)
    if (x) for (const key of [b1, b2, apex]) {
      const e = exprOf(key)
      if (e && !pos(at(e, x))) bad.push(`${where}: ${key} is not positive`)
    }
  } else if (angles) {
    family = 'converse'
    const a1 = `∠${angles[1]}`
    const a2 = `∠${angles[2]}`
    const l1 = exprOf(opposite(a1))
    const l2 = exprOf(opposite(a2))
    const baseKey = segKey(angles[1]!, angles[2]!)
    const eb = exprOf(baseKey)
    if (!l1 || !l2) bad.push(`${where}: the sides across from the congruent angles are not both given`)
    else {
      x = solveLin(l1, l2)
      if (eb) trapXs = [solveLin(l1, eb), solveLin(l2, eb)].filter((v): v is Q => v !== null)
      if (x && eb) {
        const leg = num(at(l1, x))
        const base = num(at(eb, x))
        if (!(leg > 0 && base > 0 && 2 * leg > base)) bad.push(`${where}: legs ${leg} and base ${base} are not a triangle`)
      }
    }
  } else if (equi) {
    family = 'equilateral'
    const exprs = parts.filter((p) => p.part.kind === 'side').map((p) => p.expr)
    const xsAll = exprs.slice(1).map((e) => solveLin(exprs[0]!, e))
    if (xsAll.length < 1 || xsAll.some((v) => !v)) bad.push(`${where}: equilateral sides do not fix x`)
    else {
      x = xsAll[0]!
      if (xsAll.some((v) => !eqQ(v!, x!))) bad.push(`${where}: equilateral sides disagree on x`)
    }
  } else bad.push(`${where}: unreadable givens “${a.prompt}”`)
  if (!x) return { x: '', family, bad: [...bad, `${where}: no unique x`] }
  if (!eqQ(readQ(xs.answerText), x)) bad.push(`${where}: stored x = ${xs.answerText}, the wording gives ${show(x)}`)
  // The asked part: given, or (vertex family) the other base angle.
  const te = exprOf(partKey(target))
  let value: Q | null = te ? at(te, x) : null
  if (!value && family === 'vertex' && sides) {
    const s1 = segKey(sides[1]![0]!, sides[1]![1]!)
    const s2 = segKey(sides[2]![0]!, sides[2]![1]!)
    const base = [opposite(s1), opposite(s2)]
    const e = exprOf(base[0]!) ?? exprOf(base[1]!)
    if (base.includes(partKey(target)) && e) value = at(e, x)
  }
  if (!value) bad.push(`${where}: the asked part has no value`)
  else if (!eqQ(readQ(rs.answerText), value)) bad.push(`${where}: stored ${tail[1]} = ${rs.answerText}, the wording gives ${show(value)}`)
  if (a.trap === 'geo_base_angles_wrong_vertex') {
    const t = readQ(a.trapAnswer)
    if (!trapXs.some((v) => eqQ(v, t)) || eqQ(t, x)) bad.push(`${where}: trap x = ${a.trapAnswer} is not the vertex slip (${trapXs.map(show).join(', ')})`)
  }
  if (a.trap === 'geo_equilateral_angle_for_side' && (family !== 'equilateral' || a.trapAnswer !== '60' || a.trapStage !== 'result')) bad.push(`${where}: equilateral trap misplaced`)
  return { x: show(x), family, bad }
}

// ---------- gt.twocolumn ---------------------------------------------------------------------------

type Fact =
  | { k: 'seg'; a: [string, string]; b: [string, string] }
  | { k: 'ang'; a: Ang; b: Ang }
  | { k: 'tri'; L: string[]; R: string[] }
  | { k: 'par'; a: [string, string]; b: [string, string] }
  | { k: 'perp'; a: [string, string]; b: [string, string] }
  | { k: 'mid'; m: string; s: [string, string] }
  | { k: 'angBis'; ray: [string, string]; angle: [string, string, string] }
  | { k: 'segBis'; line: [string, string]; s: [string, string]; at: string }
  | { k: 'right'; a: Ang }
  | { k: 'rightTris'; t1: string[]; t2: string[] }

const pair = (s: string): [string, string] => [s[0]!, s[1]!]
function parseFact(fig: Fig, text: string): Fact | null {
  const t = text.trim()
  let m = /^([A-Z]{2}) ≅ ([A-Z]{2})$/.exec(t)
  if (m) return { k: 'seg', a: pair(m[1]!), b: pair(m[2]!) }
  m = /^∠([A-Z])([A-Z])([A-Z]) ≅ ∠([A-Z])([A-Z])([A-Z])$/.exec(t)
  if (m) return { k: 'ang', a: ang(fig, m[2]!, m[1]!, m[3]!), b: ang(fig, m[5]!, m[4]!, m[6]!) }
  m = /^△([A-Z]{3}) ≅ △([A-Z]{3})$/.exec(t)
  if (m) return { k: 'tri', L: [...m[1]!], R: [...m[2]!] }
  m = /^([A-Z]{2}) ∥ ([A-Z]{2})$/.exec(t)
  if (m) return { k: 'par', a: pair(m[1]!), b: pair(m[2]!) }
  m = /^([A-Z]{2}) ⊥ ([A-Z]{2})$/.exec(t)
  if (m) return { k: 'perp', a: pair(m[1]!), b: pair(m[2]!) }
  m = /^([A-Z]) is the midpoint of ([A-Z]{2})$/.exec(t)
  if (m) return { k: 'mid', m: m[1]!, s: pair(m[2]!) }
  m = /^Ray ([A-Z]{2}) bisects ∠([A-Z])([A-Z])([A-Z])$/.exec(t)
  if (m) return { k: 'angBis', ray: pair(m[1]!), angle: [m[2]!, m[3]!, m[4]!] }
  m = /^Line ([A-Z]{2}) bisects ([A-Z]{2}) at ([A-Z])$/.exec(t)
  if (m) return { k: 'segBis', line: pair(m[1]!), s: pair(m[2]!), at: m[3]! }
  m = /^∠([A-Z])([A-Z])([A-Z]) is a right angle$/.exec(t)
  if (m) return { k: 'right', a: ang(fig, m[2]!, m[1]!, m[3]!) }
  m = /^△([A-Z]{3}) and △([A-Z]{3}) are right triangles$/.exec(t)
  if (m) return { k: 'rightTris', t1: [...m[1]!], t2: [...m[2]!] }
  return null
}

function rowFacts(_fig: Fig, known: Fact[]): Facts {
  return {
    seg: (a, b) => known.some((f) => f.k === 'seg' && ((sameSeg(f.a, a) && sameSeg(f.b, b)) || (sameSeg(f.a, b) && sameSeg(f.b, a)))),
    ang: (x, y) => known.some((f) => f.k === 'ang' && ((sameAng(f.a, x) && sameAng(f.b, y)) || (sameAng(f.a, y) && sameAng(f.b, x)))),
    right: (x) => known.some((f) => f.k === 'right' && sameAng(f.a, x)),
  }
}

const METHOD_OF: Record<string, Method> = {
  'post-sss': 'SSS',
  'post-sas': 'SAS',
  'post-asa': 'ASA',
  'post-aas': 'AAS',
  'thm-aas': 'AAS',
  'post-hl': 'HL',
  'thm-hl': 'HL',
}

/** The triangle-congruence facts so far, as maps from each listed vertex to its partner (both ways). */
function triMaps(known: Fact[]): Map<string, string>[] {
  return known.flatMap((f) => {
    if (f.k !== 'tri') return []
    const fwd = new Map(f.L.map((c, i) => [c, f.R[i]!]))
    const back = new Map(f.R.map((c, i) => [c, f.L[i]!]))
    return [fwd, back]
  })
}

/** Why is this fact true by this reason, from the rows above? null when it is, else what is missing. */
function justify(fig: Fig, fact: Fact, reason: string, known: Fact[], givenList: string[] | null, text: string): string | null {
  const F = rowFacts(fig, known)
  switch (reason) {
    case 'given':
      return givenList === null || givenList.includes(text) ? null : 'not in the Given list'
    case 'cong-refl':
      if (fact.k === 'seg') return sameSeg(fact.a, fact.b) ? null : 'not the same segment'
      if (fact.k === 'ang') return sameAng(fact.a, fact.b) ? null : 'not the same angle'
      return 'not a congruence'
    case 'thm-vertical':
      return fact.k === 'ang' && vertical(fact.a, fact.b) ? null : 'not vertical angles'
    case 'thm-alt-int': {
      if (fact.k !== 'ang') return 'not an angle pair'
      const lines: LineRef[] = known.flatMap((f, n) => (f.k === 'par' ? [{ a: f.a[0], b: f.a[1], tag: `p${n}` }, { a: f.b[0], b: f.b[1], tag: `p${n}` }] : []))
      return altInterior(fig, lines, fact.a, fact.b) ? null : 'not alternate interior angles of lines shown parallel above'
    }
    case 'def-midpoint': {
      if (fact.k !== 'seg') return 'not a segment pair'
      const ok = known.some((f) => f.k === 'mid' && ((sameSeg(fact.a, [f.s[0], f.m]) && sameSeg(fact.b, [f.m, f.s[1]])) || (sameSeg(fact.b, [f.s[0], f.m]) && sameSeg(fact.a, [f.m, f.s[1]]))))
      return ok ? null : 'no midpoint above gives these halves'
    }
    case 'def-seg-bisector':
      return fact.k === 'mid' && known.some((f) => f.k === 'segBis' && f.at === fact.m && sameSeg(f.s, fact.s)) ? null : 'no segment bisector above'
    case 'def-ang-bisector': {
      if (fact.k !== 'ang') return 'not an angle pair'
      const ok = known.some((f) => {
        if (f.k !== 'angBis') return false
        const [p, v, r] = f.angle
        if (f.ray[0] !== v) return false
        const h1 = ang(fig, v, p, f.ray[1])
        const h2 = ang(fig, v, f.ray[1], r)
        return (sameAng(fact.a, h1) && sameAng(fact.b, h2)) || (sameAng(fact.a, h2) && sameAng(fact.b, h1))
      })
      return ok ? null : 'no angle bisector above gives these halves'
    }
    case 'def-perp': {
      if (fact.k !== 'right') return 'not a right angle'
      const ok = known.some((f) => {
        if (f.k !== 'perp') return false
        const meet = f.a.find((c) => f.b.includes(c))
        if (!meet || meet !== fact.a.v) return false
        const u = f.a.find((c) => c !== meet)!
        const w = f.b.find((c) => c !== meet)!
        return sameAng(fact.a, ang(fig, meet, u, w))
      })
      return ok ? null : 'no perpendicular lines above meet in this angle'
    }
    case 'def-right-triangle': {
      if (fact.k !== 'rightTris') return 'not a right-triangle statement'
      const hasRight = (T: string[]) => [0, 1, 2].some((k) => F.right(triAng(fig, T, k)))
      return hasRight(fact.t1) && hasRight(fact.t2) ? null : 'a triangle has no right angle above'
    }
    case 'thm-right-cong':
      return fact.k === 'ang' && F.right(fact.a) && F.right(fact.b) ? null : 'not two right angles'
    case 'thm-cpctc': {
      const maps = triMaps(known)
      if (!maps.length) return 'no congruent triangles above'
      if (fact.k === 'seg') {
        const ok = maps.some((m) => m.has(fact.a[0]) && m.has(fact.a[1]) && sameSeg([m.get(fact.a[0])!, m.get(fact.a[1])!], fact.b))
        return ok ? null : 'these sides do not correspond'
      }
      if (fact.k === 'ang') {
        const tris = known.filter((f): f is Extract<Fact, { k: 'tri' }> => f.k === 'tri')
        const ok = tris.some((t) =>
          [0, 1, 2].some((k) => {
            const x = triAng(fig, t.L, k)
            const y = triAng(fig, t.R, k)
            return (sameAng(fact.a, x) && sameAng(fact.b, y)) || (sameAng(fact.a, y) && sameAng(fact.b, x))
          }),
        )
        return ok ? null : 'these angles do not correspond'
      }
      return 'not a pair of parts'
    }
    default: {
      const method = METHOD_OF[reason]
      if (!method) return `unknown reason ${reason}`
      if (fact.k !== 'tri') return 'not a triangle congruence'
      const ms = methodsOfParts(partsUnder(fig, fact.L, fact.R, F))
      if (!ms.includes(method)) return `the rows above give ${ms.join(', ') || 'nothing'} under this vertex order, not ${method}`
      // The drawn triangles agree with the stated order.
      for (let k = 0; k < 3; k++) {
        const l1 = dist(fig, fact.L[k]!, fact.L[(k + 1) % 3]!)
        const l2 = dist(fig, fact.R[k]!, fact.R[(k + 1) % 3]!)
        if (Math.abs(l1 - l2) > 0.03 * Math.max(l1, l2)) return `the figure does not match ${fact.L.join('')} with ${fact.R.join('')}`
      }
      return null
    }
  }
}

interface RowView {
  text: string
  reason: string
  accept: string[]
  stage: GeometryAnswer['stages'][number]
}
const LABEL_TO_ID = new Map<string, string>(REASONS.map((r) => [r.label as string, r.id as string]))
function rowsOf(a: GeometryAnswer): RowView[] {
  return a.stages.map((stage) => {
    const line = stage.reveal.find((r) => /^Row \d+ says “/.test(r)) ?? ''
    const m = /^Row \d+ says “(.*)”, supported by (.*?)\.(?: |$)/.exec(line)
    if (!m) throw new Error(`no row line in “${line}”`)
    const reason = stage.kind === 'reason' ? stage.answerText : LABEL_TO_ID.get(m[2]!) ?? `?${m[2]}`
    return { text: m[1]!, reason, accept: stage.accept ?? [], stage }
  })
}

function checkProof(where: string, a: GeometryAnswer): { skeleton: string; letters: string; bad: string[] } {
  const bad: string[] = []
  const fig = a.figure
  const gp = /Given: (.*?)\. Prove: (.*?)\.?$/.exec(a.prompt)
  const givenList = gp ? gp[1]!.split(/, (?:and )?/).map((s) => s.trim()) : null
  const prove = gp ? gp[2]!.trim() : null
  const rows = rowsOf(a)
  const known: Fact[] = []
  rows.forEach((row, index) => {
    const at1 = `${where} row ${index + 1} “${row.text}”`
    const fact = parseFact(fig, row.text)
    if (!fact) {
      bad.push(`${at1}: unreadable statement`)
      return
    }
    const why = justify(fig, fact, row.reason, known, givenList, row.text)
    if (why) bad.push(`${at1} by ${row.reason}: ${why}`)
    const stage = row.stage
    if (stage.kind === 'choice') {
      let valid = 0
      for (const c of stage.choices ?? []) {
        const f = parseFact(fig, c.text)
        const fine = f !== null && justify(fig, f, row.reason, known, givenList, c.text) === null
        if (fine) valid++
        if (fine && c.id !== stage.answerText) bad.push(`${at1}: choice “${c.text}” is also right`)
        const g = gradeGeoStage(a, stage.id, c.id)
        if (g.verdict === 'mistake') {
          if (g.mistake !== 'geo_vertices_out_of_order') bad.push(`${at1}: choice “${c.text}” named ${g.mistake}`)
          else if (!f || f.k !== fact.k) bad.push(`${at1}: “${c.text}” is not the same kind of statement, yet named out of order`)
          else if (f.k === 'tri' && fact.k === 'tri') {
            if ([...f.L].sort().join() + [...f.R].sort().join() !== [...fact.L].sort().join() + [...fact.R].sort().join()) bad.push(`${at1}: “${c.text}” names other triangles`)
          } else if (f.k === 'seg' || f.k === 'ang') {
            const tris = known.filter((k): k is Extract<Fact, { k: 'tri' }> => k.k === 'tri')
            const sideOf = (s: [string, string]) => tris.some((t) => [t.L, t.R].some((T) => [0, 1, 2].some((k) => sameSeg(s, [T[k]!, T[(k + 1) % 3]!]))))
            const angOf = (g: Ang) => tris.some((t) => [t.L, t.R].some((T) => [0, 1, 2].some((k) => sameAng(g, triAng(fig, T, k)))))
            const parts = f.k === 'seg' ? sideOf(f.a) && sideOf(f.b) : angOf(f.a) && angOf(f.b)
            if (!parts) bad.push(`${at1}: “${c.text}” is not a pair of parts of the two triangles, yet named out of order`)
          }
        }
      }
      if (valid !== 1) bad.push(`${at1}: ${valid} choices are right`)
    } else {
      // Every reason she could pick: a named mistake must be exactly that slip here.
      for (const r of REASONS) {
        const id = r.id as string
        if (id === row.reason || row.accept.includes(id)) continue
        const g = gradeGeoStage(a, stage.id, id)
        if (g.verdict === 'correct') bad.push(`${at1}: ${id} also graded correct`)
        if (g.verdict !== 'mistake') continue
        const F = rowFacts(fig, known)
        let ok = false
        switch (g.mistake) {
          case 'geo_cpctc_too_soon':
            ok = id === 'thm-cpctc' && fact.k === 'tri'
            break
          case 'geo_hl_no_right':
            ok = METHOD_OF[id] === 'HL' && fact.k === 'tri' && ![fact.L, fact.R].some((T) => [0, 1, 2].some((k) => F.right(triAng(fig, T, k))))
            break
          case 'geo_asa_aas_swapped':
            ok = (METHOD_OF[row.reason] === 'ASA' && METHOD_OF[id] === 'AAS') || (METHOD_OF[row.reason] === 'AAS' && METHOD_OF[id] === 'ASA')
            break
          case 'geo_sas_not_included': {
            // She would pair the two right angles too: all right angles are congruent.
            const lenient: Facts = { ...F, ang: (x, y) => F.ang(x, y) || (F.right(x) && F.right(y)) }
            ok = METHOD_OF[id] === 'SAS' && fact.k === 'tri' && ssaOfParts(partsUnder(fig, fact.L, fact.R, lenient))
            break
          }
          case 'geo_shared_side_missed':
            ok = row.reason === 'cong-refl' && id === 'given'
            break
          case 'geo_linear_for_vertical':
            ok = row.reason === 'thm-vertical' && id === 'post-linear-pair'
            break
          case 'geo_reflexive_for_symmetric':
            ok = false
            break
          default:
            // Unit 2's named reason swaps were reviewed with Unit 2; flag only the ones that cannot apply here.
            ok = !String(g.mistake).startsWith('geo_') || !['post-sss', 'post-sas', 'post-asa', 'post-aas', 'thm-aas', 'post-hl', 'thm-hl', 'thm-cpctc'].includes(row.reason)
        }
        if (!ok) bad.push(`${at1}: picking ${id} is named ${g.mistake}, which does not fit this row`)
      }
    }
    known.push(fact)
  })
  if (prove !== null && rows.length && rows[rows.length - 1]!.text !== prove) bad.push(`${where}: the last row is “${rows[rows.length - 1]!.text}”, Prove is “${prove}”`)
  if (givenList) {
    for (const g of givenList) if (!rows.some((r) => r.text === g && r.reason === 'given')) bad.push(`${where}: given “${g}” is never used`)
  }
  // The figure marks only what is given (a midpoint, bisector or perpendicular given may be marked).
  const givenFacts = rows.filter((r) => r.reason === 'given').map((r) => parseFact(fig, r.text)).filter((f): f is Fact => f !== null)
  const allowedSeg = (s: [string, string], t: [string, string]) =>
    givenFacts.some((f) => (f.k === 'seg' && ((sameSeg(f.a, s) && sameSeg(f.b, t)) || (sameSeg(f.a, t) && sameSeg(f.b, s)))) ||
      (f.k === 'mid' && [s, t].every((x) => sameSeg(x, [f.s[0], f.m]) || sameSeg(x, [f.m, f.s[1]]))) ||
      (f.k === 'segBis' && [s, t].every((x) => sameSeg(x, [f.s[0], f.at]) || sameSeg(x, [f.at, f.s[1]]))))
  const byTick = new Map<number, [string, string][]>()
  for (const s of fig.segments ?? []) if (s.ticks) byTick.set(s.ticks, [...(byTick.get(s.ticks) ?? []), [s.from, s.to]])
  for (const [n, list] of byTick) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (!allowedSeg(list[i]!, list[j]!)) bad.push(`${where}: ticks ${n} on ${list[i]!.join('')} and ${list[j]!.join('')} are not given`)
    }
  }
  const angMarks = (fig.angles ?? []).filter((g) => !g.right && g.marks).map((g) => ({ n: g.marks!, a: ang(fig, g.vertex, g.from, g.to) }))
  for (let i = 0; i < angMarks.length; i++) {
    for (let j = i + 1; j < angMarks.length; j++) {
      if (angMarks[i]!.n !== angMarks[j]!.n) continue
      const x = angMarks[i]!.a
      const y = angMarks[j]!.a
      const ok = givenFacts.some((f) => (f.k === 'ang' && ((sameAng(f.a, x) && sameAng(f.b, y)) || (sameAng(f.a, y) && sameAng(f.b, x)))) ||
        (f.k === 'angBis' && [x, y].every((g) => sameAng(g, ang(fig, f.angle[1], f.angle[0], f.ray[1])) || sameAng(g, ang(fig, f.angle[1], f.ray[1], f.angle[2])))))
      if (!ok) bad.push(`${where}: arcs on ${x.name} and ${y.name} are not given`)
    }
  }
  for (const g of (fig.angles ?? []).filter((m) => m.right)) {
    const x = ang(fig, g.vertex, g.from, g.to)
    const ok = givenFacts.some((f) => (f.k === 'right' && sameAng(f.a, x)) || (f.k === 'perp' && [f.a, f.b].every((l) => l.includes(g.vertex))))
    if (!ok) bad.push(`${where}: the right angle at ${g.vertex} is not given`)
  }
  const letters = [...new Set(fig.points.map((p) => p.id))].sort().join('')
  return { skeleton: String(rows.map((r) => r.reason).join(',')), letters, bad }
}

// ---------- the sweeps -------------------------------------------------------------------------

function sweep<T>(module: ModuleId, template: string, check: (where: string, a: GeometryAnswer) => T & { bad: string[] }): T[] {
  const bad: string[] = []
  const out: T[] = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    const where = `${template}/${seed}`
    let r: T & { bad: string[] }
    try {
      r = check(where, problem(module, template, seed))
    } catch (e) {
      bad.push(`${where}: ${(e as Error).message}`)
      continue
    }
    bad.push(...r.bad)
    out.push(r)
  }
  expect(bad.slice(0, Number(process.env.GEO4_SHOW ?? 15)), `${bad.length} problems`).toEqual([])
  return out
}

describe('Unit 4 solved again from what she sees', () => {
  it('gc.which: the drawn marks decide one method, and every named pick is that slip', () => {
    const got = sweep('geoCongruence', 'gc.which', checkWhich)
    const counts = new Map<string, number>()
    for (const r of got) counts.set(r.answer, (counts.get(r.answer) ?? 0) + 1)
    for (const m of ['SSS', 'SAS', 'ASA', 'AAS', 'HL', 'none']) {
      const share = (counts.get(m) ?? 0) / got.length
      expect(share, `${m}: ${counts.get(m) ?? 0} of ${got.length}`).toBeGreaterThan(0.1)
      expect(share, `${m}: ${counts.get(m) ?? 0} of ${got.length}`).toBeLessThan(0.25)
    }
  }, HEAVY)

  it('gc.parts: the statement or the marks give the part, and no second choice is right', () => {
    const got = sweep('geoCongruence', 'gc.parts', checkParts)
    const alpha = got.filter((r) => r.alphabetical).length / got.length
    expect(alpha, 'share where pairing letters by the alphabet is right').toBeLessThanOrEqual(0.25)
  }, HEAVY)

  it('gc.solve: one corresponding pair, one x, real triangles, the slip is the other part', () => {
    const got = sweep('geoCongruence', 'gc.solve', checkSolve)
    const xs = new Map<string, number>()
    for (const r of got) xs.set(r.x, (xs.get(r.x) ?? 0) + 1)
    expect(xs.size, [...xs.keys()].join(' ')).toBeGreaterThanOrEqual(10)
    expect(Math.max(...xs.values()) / got.length).toBeLessThan(0.2)
  }, HEAVY)

  it('gi.solve: base angles across from the congruent sides, one x, real triangles', () => {
    const got = sweep('geoIsosceles', 'gi.solve', checkIsosceles)
    const xs = new Map<string, number>()
    for (const r of got) xs.set(r.x, (xs.get(r.x) ?? 0) + 1)
    expect(xs.size, [...xs.keys()].join(' ')).toBeGreaterThanOrEqual(10)
    expect(Math.max(...xs.values()) / got.length).toBeLessThan(0.2)
  }, HEAVY)

  it('gt.twocolumn: every row follows from the rows above by its reason, with one right choice', () => {
    const got = sweep('geoTriangleProofs', 'gt.twocolumn', checkProof)
    expect(new Set(got.map((r) => r.letters)).size).toBeGreaterThanOrEqual(20)
    expect(new Set(got.map((r) => r.skeleton)).size).toBeGreaterThanOrEqual(12)
  }, HEAVY)
})
