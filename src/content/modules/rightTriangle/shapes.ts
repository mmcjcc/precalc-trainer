/**
 * The right triangles the templates draw (components/TrigFigure draws them): a plain triangle with its right angle at
 * a bottom corner and the marked angle at the other bottom corner or at the top, or a scene (a ladder against a wall,
 * a ramp, a kite on its string, a tree and its shadow, a lighthouse and a boat). Each shape knows which side is
 * opposite, adjacent and the hypotenuse from the angle its roles are named from, so the template labels sides by
 * role. The marked angle is drawn at its true size when it is between 24° and 66° (15° and 72° in a scene); outside
 * that it is drawn steeper or flatter so the labels fit, and the figure says it is not to scale.
 */
import type { TrigScene, TrigTriangleSpec } from '@/content/types'
import type { RtRole } from '@/engine/trig'

export interface Shape {
  corners: { id: string; x: number; y: number }[]
  /** The right angle's corner. */
  right: string
  /** The corner of the angle the roles are named from. */
  at: string
  /** Each role's side, as its two corners. */
  sides: Record<RtRole, [string, string]>
  /** The marked angle: at `at`, or (lighthouse) at the top, measured from the horizontal. */
  mark: { at: string; fromHorizontal: boolean }
  toScale: boolean
  scene: TrigScene
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const rad = (d: number) => (d * Math.PI) / 180
const r2 = (v: number) => Number(v.toFixed(3))

/** A plain right triangle: the right angle C at a bottom corner, A the other bottom corner, B above C. θ at A or B. */
export function plainShape(o: { theta: number; rightAt: 'left' | 'right'; thetaAt: 'base' | 'top' }): Shape {
  const alpha = o.thetaAt === 'base' ? o.theta : 90 - o.theta
  const drawn = clamp(alpha, 24, 66)
  const w = 100 * Math.cos(rad(drawn))
  const h = 100 * Math.sin(rad(drawn))
  const sx = o.rightAt === 'right' ? -1 : 1
  const at = o.thetaAt === 'base' ? 'A' : 'B'
  return {
    corners: [
      { id: 'A', x: r2(sx * w), y: 0 },
      { id: 'B', x: 0, y: r2(h) },
      { id: 'C', x: 0, y: 0 },
    ],
    right: 'C',
    at,
    sides: at === 'A' ? { opp: ['B', 'C'], adj: ['A', 'C'], hyp: ['A', 'B'] } : { opp: ['A', 'C'], adj: ['B', 'C'], hyp: ['A', 'B'] },
    mark: { at, fromHorizontal: false },
    toScale: Math.abs(drawn - alpha) < 0.5,
    scene: 'plain',
  }
}

export type Scene = Exclude<TrigScene, 'plain'>

/**
 * A scene's triangle, with θ the angle at the low corner (the angle of elevation, the ladder's or ramp's angle with
 * the ground); for the lighthouse the marked angle is the angle of depression at the top, which equals θ.
 */
export function sceneShape(scene: Scene, theta: number): Shape {
  const drawn = clamp(theta, 15, 72)
  const w = r2(100 * Math.cos(rad(drawn)))
  const h = r2(100 * Math.sin(rad(drawn)))
  const toScale = Math.abs(drawn - theta) < 0.5
  if (scene === 'lighthouse') {
    return {
      corners: [
        { id: 'B', x: 0, y: 0 },
        { id: 'S', x: w, y: 0 },
        { id: 'O', x: 0, y: h },
      ],
      right: 'B',
      at: 'S',
      sides: { opp: ['B', 'O'], adj: ['B', 'S'], hyp: ['O', 'S'] },
      mark: { at: 'O', fromHorizontal: true },
      toScale,
      scene,
    }
  }
  const ids: Record<Exclude<Scene, 'lighthouse'>, [string, string, string]> = {
    ladder: ['F', 'W', 'T'],
    ramp: ['B', 'R', 'T'],
    kite: ['P', 'G', 'K'],
    tree: ['S', 'B', 'T'],
  }
  const [low, right, top] = ids[scene]
  return {
    corners: [
      { id: low, x: 0, y: 0 },
      { id: right, x: w, y: 0 },
      { id: top, x: w, y: h },
    ],
    right,
    at: low,
    sides: { opp: [right, top], adj: [low, right], hyp: [low, top] },
    mark: { at: low, fromHorizontal: false },
    toScale,
    scene,
  }
}

/** Which sides are drawn on a dimension line in each scene: a length along part of a wall, a tower, a tree, the ground. */
const DIMENSION: Record<TrigScene, RtRole[]> = {
  plain: [],
  ladder: ['opp', 'adj'],
  ramp: ['adj'],
  kite: ['adj'],
  tree: ['opp', 'adj'],
  lighthouse: ['opp', 'adj'],
}

export interface ShapeLabels {
  /** Each labelled side: a length she is given ("20 ft", "4√3") or a letter for what she is asked; `after` a part id. */
  sides: Partial<Record<RtRole, { text: string; after?: string }>>
  /** The marked angle's label: "70°", "θ". Other angles (the special triangles) with their corners. */
  angle?: string
  extraAngles?: { at: string; label: string }[]
  equalLegs?: boolean
}

/** The figure's triangle for this shape and these labels. */
export function triangleSpec(shape: Shape, labels: ShapeLabels): TrigTriangleSpec {
  const sides: TrigTriangleSpec['sides'] = []
  for (const role of ['opp', 'adj', 'hyp'] as RtRole[]) {
    const l = labels.sides[role]
    if (!l) continue
    const [from, to] = shape.sides[role]
    sides.push({ from, to, label: l.text, ...(l.after ? { after: l.after } : {}), ...(DIMENSION[shape.scene].includes(role) ? { dimension: true } : {}) })
  }
  const angles: TrigTriangleSpec['angles'] = []
  if (labels.angle) angles.push({ at: shape.mark.at, label: labels.angle, ...(shape.mark.fromHorizontal ? { fromHorizontal: true } : {}) })
  for (const a of labels.extraAngles ?? []) angles.push({ at: a.at, label: a.label })
  return {
    corners: shape.corners,
    right: shape.right,
    sides,
    angles,
    ...(labels.equalLegs ? { equalLegs: true } : {}),
    scene: shape.scene,
    toScale: shape.toScale,
  }
}

/** Where a plain triangle's corner is, in words: "the bottom left", "the top". */
export function cornerWords(shape: Shape, id: string): string {
  const c = shape.corners.find((p) => p.id === id)!
  const others = shape.corners.filter((p) => p.id !== id)
  const top = c.y > Math.max(...others.map((p) => p.y))
  if (top) return 'the top'
  const left = c.x < Math.max(...others.map((p) => p.x))
  return left ? 'the bottom left' : 'the bottom right'
}

/** A role in words, from the angle at `shape.at` called `name`: "the side across from θ". */
export function roleWords(role: RtRole, name: string): string {
  if (role === 'opp') return `the side across from ${name}`
  if (role === 'adj') return `the leg between ${name} and the right angle`
  return 'the hypotenuse, across from the right angle'
}
