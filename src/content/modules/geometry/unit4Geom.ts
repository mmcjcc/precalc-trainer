/**
 * Shared geometry for honors Unit 4. Letters, correspondences, placement, and the
 * method a figure's marks actually prove. A later test reads the same marks from the aria.
 */
import type { GeoPoint } from '@/shared/types'
import type { Rng } from '@/content/rng'

/** Capitals that are not I, O, J, K, L, M, or X. M is the midpoint; x is the unknown. */
export const LETTERS = 'ABCDEFGHNPQRSTUVWYZ'

export const PERMS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

export type Tick = 1 | 2 | 3
export type Method = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'HL'
type Pair = [string, string]

export interface SideMark {
  a: Pair
  b: Pair
  tick: Tick
}
export interface AnglePair {
  a: string
  b: string
  arc: Tick
}
export interface Scene {
  t1: [string, string, string]
  t2: [string, string, string]
  sides: SideMark[]
  angles: AnglePair[]
  rights: string[]
  shared: Pair[]
  vertical: string[]
  parallel: { line: string; arrows: 1 | 2 }[]
  alt: string[]
}

export function pickLetters(rng: Rng, n: number): string[] {
  const pool = LETTERS.split('')
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const at = rng.int(0, pool.length - 1)
    out.push(pool.splice(at, 1)[0]!)
  }
  return out
}

export function applyPerm(items: readonly string[], perm: readonly [number, number, number]): [string, string, string] {
  return [items[perm[0]]!, items[perm[1]]!, items[perm[2]]!]
}

export function sideName(tri: string, i: number): string {
  return `${tri[i]!}${tri[(i + 1) % 3]!}`
}

/** Previous vertex, this vertex, next vertex: the textbook three-letter name. */
export function angleTok(tri: string, i: number): string {
  return `${tri[(i + 2) % 3]!}${tri[i]!}${tri[(i + 1) % 3]!}`
}

export function emptyScene(t1: [string, string, string], t2: [string, string, string]): Scene {
  return { t1, t2, sides: [], angles: [], rights: [], shared: [], vertical: [], parallel: [], alt: [] }
}

function segKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`
}

function angleVertex(name: string): string {
  if (name.length === 1 || name.length === 3) return name[name.length === 1 ? 0 : 1]!
  throw new Error(`bad angle name ${name}`)
}

/** Left angle is in the first triangle. The swapped vertices are a different pair. */
function namedAngles(list: string[], u: string, v: string): boolean {
  return list.some((spec) => {
    const [left, right] = spec.split('-')
    if (!left || !right) return false
    return angleVertex(left) === u && angleVertex(right) === v
  })
}

function includedSide(va: number, vb: number): number {
  const a = Math.min(va, vb)
  const b = Math.max(va, vb)
  if (a === 0 && b === 1) return 0
  if (a === 1 && b === 2) return 1
  return 2
}

/** Which methods the marks actually prove, over every correspondence. Empty means not enough. */
export function methodsOf(scene: Scene): Method[] {
  const found = new Set<Method>()
  const sideHit = (p: Pair, q: Pair) => {
    const A = segKey(p[0], p[1])
    const B = segKey(q[0], q[1])
    if (scene.shared.some((s) => segKey(s[0], s[1]) === A && A === B)) return true
    return scene.sides.some((s) => {
      const x = segKey(s.a[0], s.a[1])
      const y = segKey(s.b[0], s.b[1])
      return (x === A && y === B) || (x === B && y === A)
    })
  }
  const angleHit = (u: string, v: string) => {
    if (scene.rights.includes(u) && scene.rights.includes(v)) return true
    if (scene.angles.some((g) => (g.a === u && g.b === v) || (g.a === v && g.b === u))) return true
    return namedAngles(scene.vertical, u, v) || namedAngles(scene.alt, u, v)
  }
  const t1 = [...scene.t1]
  for (const perm of PERMS) {
    const map = [scene.t2[perm[0]]!, scene.t2[perm[1]]!, scene.t2[perm[2]]!]
    const matched = [0, 1, 2].filter((i) => sideHit([t1[i]!, t1[(i + 1) % 3]!], [map[i]!, map[(i + 1) % 3]!]))
    const ang = [0, 1, 2].filter((i) => angleHit(t1[i]!, map[i]!))
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
          const included = includedSide(ang[i]!, ang[j]!)
          if (matched.some((s) => s !== included)) found.add('AAS')
        }
      }
    }
    const rightAt = [0, 1, 2].filter((i) => scene.rights.includes(t1[i]!))
    if (rightAt.length === 1 && scene.rights.includes(map[rightAt[0]!]!)) {
      const r = rightAt[0]!
      const others = [0, 1, 2].filter((i) => scene.rights.includes(map[i]!))
      if (others.length === 1 && others[0] === r) {
        const hyp = (r + 1) % 3
        if (matched.includes(hyp) && (matched.includes(r) || matched.includes((r + 2) % 3))) found.add('HL')
      }
    }
  }
  return [...found].sort()
}

/** How many of the six correspondences preserve every listed mark. */
export function preservingCount(scene: Scene): number {
  const t1 = [...scene.t1]
  let count = 0
  for (const perm of PERMS) {
    const map = [scene.t2[perm[0]]!, scene.t2[perm[1]]!, scene.t2[perm[2]]!]
    const edgeOk = scene.sides.every((s) => {
      const i = [0, 1, 2].find((k) => segKey(t1[k]!, t1[(k + 1) % 3]!) === segKey(s.a[0], s.a[1]))
      if (i === undefined) return false
      return segKey(map[i]!, map[(i + 1) % 3]!) === segKey(s.b[0], s.b[1])
    })
    const sharedOk = scene.shared.every((s) => {
      const key = segKey(s[0], s[1])
      const i = [0, 1, 2].find((k) => segKey(t1[k]!, t1[(k + 1) % 3]!) === key)
      return i !== undefined && segKey(map[i]!, map[(i + 1) % 3]!) === key
    })
    const angOk = scene.angles.every((g) => {
      const i = t1.indexOf(g.a)
      return i >= 0 && map[i] === g.b
    })
    const rightOk = scene.rights.filter((r) => t1.includes(r)).every((r) => scene.rights.includes(map[t1.indexOf(r)]!))
    const namedOk = [...scene.vertical, ...scene.alt].every((spec) => {
      const [left, right] = spec.split('-')
      if (!left || !right) return false
      const i = t1.indexOf(angleVertex(left))
      return i >= 0 && map[i] === angleVertex(right)
    })
    if (edgeOk && sharedOk && angOk && rightOk && namedOk) count += 1
  }
  return count
}

function listOrNone(items: string[]): string {
  return items.length ? items.join('; ') : 'none'
}

export function ariaOf(scene: Scene): string {
  const sides = scene.sides.map((s) => `${s.a[0]}${s.a[1]}-${s.b[0]}${s.b[1]} tick ${s.tick}`)
  const angles = scene.angles.map((g) => `${g.a}-${g.b} arc ${g.arc}`)
  const shared = scene.shared.map((s) => `${s[0]}${s[1]}`)
  const parallel = scene.parallel.map((p) => `${p.line} arrows ${p.arrows}`)
  return [
    `Triangles ${scene.t1.join('')} and ${scene.t2.join('')}.`,
    `Side pairs: ${listOrNone(sides)}.`,
    `Angle pairs: ${listOrNone(angles)}.`,
    `Right angles: ${listOrNone(scene.rights)}.`,
    `Shared sides: ${listOrNone(shared)}.`,
    `Vertical angles: ${listOrNone(scene.vertical)}.`,
    `Parallel lines: ${listOrNone(parallel)}.`,
    `Alternate interior angles: ${listOrNone(scene.alt)}.`,
  ].join(' ')
}

/** Sorted vertex pairs. Two writings of the same correspondence share a key. */
export function congKey(text: string): string | null {
  const m = /△([A-Z]{3}) ≅ △([A-Z]{3})/.exec(text)
  if (!m) return null
  return [...m[1]!]
    .map((ch, i) => `${ch}${m[2]![i]!}`)
    .sort()
    .join('-')
}

export function sameCongruence(a: string, b: string): boolean {
  const ka = congKey(a)
  const kb = congKey(b)
  return ka !== null && ka === kb
}

export function pt(id: string, x: number, y: number, side: NonNullable<GeoPoint['labelSide']>): GeoPoint {
  return { id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, label: id, labelSide: side }
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function wedge(v: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x)
  const a2 = Math.atan2(b.y - v.y, b.x - v.x)
  let d = a2 - a1
  while (d <= -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  return (Math.abs(d) * 180) / Math.PI
}

export function byId(points: GeoPoint[], id: string): GeoPoint {
  const found = points.find((p) => p.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

function outward(dx: number, dy: number): NonNullable<GeoPoint['labelSide']> {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ay >= ax * 1.3) return dy >= 0 ? 'above' : 'below'
  if (ax >= ay * 1.3) return dx >= 0 ? 'right' : 'left'
  if (dx >= 0 && dy >= 0) return 'above-right'
  if (dx < 0 && dy >= 0) return 'above-left'
  if (dx >= 0) return 'below-right'
  return 'below-left'
}

function labelOutward(points: GeoPoint[]): GeoPoint[] {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  return points.map((p) => ({ ...p, labelSide: outward(p.x - cx, p.y - cy) }))
}

/** Triangle with the given angles at the first and second vertices. Base is `scale`. */
export function placeLocal(ids: [string, string, string], ang0: number, ang1: number, scale: number): GeoPoint[] {
  const ang2 = 180 - ang0 - ang1
  const reach = (scale * Math.sin(rad(ang1))) / Math.sin(rad(ang2))
  return labelOutward([
    pt(ids[0], 0, 0, 'below'),
    pt(ids[1], scale, 0, 'below'),
    pt(ids[2], reach * Math.cos(rad(ang0)), reach * Math.sin(rad(ang0)), 'above'),
  ])
}

/** Right angle at the third vertex, legs along the axes, so the square is an exact right angle. */
export function placeRight(ids: [string, string, string], rise: number, run: number): GeoPoint[] {
  return labelOutward([
    pt(ids[0], 0, rise, 'above'),
    pt(ids[1], run, 0, 'below'),
    pt(ids[2], 0, 0, 'left'),
  ])
}

function centroid(points: GeoPoint[]): { x: number; y: number } {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  }
}

function spin(points: GeoPoint[], rotDeg: number, reflect: boolean): GeoPoint[] {
  const c = centroid(points)
  const turned = points.map((p) => {
    const x = reflect ? 2 * c.x - p.x : p.x
    const y = p.y
    const dx = x - c.x
    const dy = y - c.y
    const t = rad(rotDeg)
    return pt(p.id, c.x + dx * Math.cos(t) - dy * Math.sin(t), c.y + dx * Math.sin(t) + dy * Math.cos(t), 'above')
  })
  return labelOutward(turned)
}

function shiftBeside(points: GeoPoint[], leftMax: number, gap: number): GeoPoint[] {
  const minX = Math.min(...points.map((p) => p.x))
  const dx = leftMax + gap - minX
  return labelOutward(points.map((p) => pt(p.id, p.x + dx, p.y, 'above')))
}

export function maxX(points: GeoPoint[]): number {
  return Math.max(...points.map((p) => p.x))
}

/**
 * Two copies of one triangle. The second is reflected about half the time and rotated,
 * then set beside the first so the boxes do not overlap.
 */
export function placePair(
  t1: [string, string, string],
  t2: [string, string, string],
  ang0: number,
  ang1: number,
  scale: number,
  rotDeg: number,
  reflect: boolean,
  gap: number,
): GeoPoint[] {
  const left = placeLocal(t1, ang0, ang1, scale)
  const raw = placeLocal(t2, ang0, ang1, scale)
  const right = shiftBeside(spin(raw, rotDeg, reflect), maxX(left), gap)
  return [...left, ...right]
}

export function placeRightPair(
  t1: [string, string, string],
  t2: [string, string, string],
  rise: number,
  run: number,
  rotDeg: number,
  reflect: boolean,
  gap: number,
): GeoPoint[] {
  const left = placeRight(t1, rise, run)
  const raw = placeRight(t2, rise, run)
  const right = shiftBeside(spin(raw, rotDeg, reflect), maxX(left), gap)
  return [...left, ...right]
}

/** A second copy at a different size, still rotated, for AAA and two-angles-only. */
export function placeScaledPair(
  t1: [string, string, string],
  t2: [string, string, string],
  ang0: number,
  ang1: number,
  scaleLeft: number,
  scaleRight: number,
  rotDeg: number,
  reflect: boolean,
  gap: number,
): GeoPoint[] {
  const left = placeLocal(t1, ang0, ang1, scaleLeft)
  const raw = placeLocal(t2, ang0, ang1, scaleRight)
  const right = shiftBeside(spin(raw, rotDeg, reflect), maxX(left), gap)
  return [...left, ...right]
}

export function dist(points: GeoPoint[], a: string, b: string): number {
  const u = byId(points, a)
  const v = byId(points, b)
  return Math.hypot(u.x - v.x, u.y - v.y)
}

export function triArea(points: GeoPoint[], a: string, b: string, c: string): number {
  const A = byId(points, a)
  const B = byId(points, b)
  const C = byId(points, c)
  return Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2
}

/** No two sides within 10% of each other, from the sines of the angles. */
export function scaleneAngles(angles: readonly number[]): boolean {
  const s = angles.map((a) => Math.sin(rad(a)))
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      const mx = Math.max(s[i]!, s[j]!)
      if (mx === 0 || Math.abs(s[i]! - s[j]!) / mx <= 0.1) return false
    }
  }
  const sorted = [...angles].sort((a, b) => a - b)
  if (sorted[0]! < 28) return false
  if (angles.some((a) => Math.abs(a - 90) < 8)) return false
  if (sorted[1]! - sorted[0]! < 8 || sorted[2]! - sorted[1]! < 8) return false
  return Math.abs(angles[0]! + angles[1]! + angles[2]! - 180) < 0.01
}

export const SCALENE: readonly (readonly [number, number, number])[] = [
  [32, 50, 98],
  [40, 58, 82],
  [34, 62, 84],
  [36, 48, 96],
  [42, 56, 82],
  [40, 56, 84],
  [33, 70, 77],
  [44, 54, 82],
]

export function anglesAt(points: GeoPoint[], ids: [string, string, string]): [number, number, number] {
  const [A, B, C] = ids
  return [wedge(byId(points, A), byId(points, B), byId(points, C)), wedge(byId(points, B), byId(points, A), byId(points, C)), wedge(byId(points, C), byId(points, A), byId(points, B))]
}
