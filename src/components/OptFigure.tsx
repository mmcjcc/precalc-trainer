/**
 * The figure of a fence problem from an OptFigureSpec: the pen (or the row of pens) as rectangles, a hatched wall
 * along the top when there is one, and every fenced side labelled with its letter, as on the worksheet. It is never
 * drawn to scale (the proportions are fixed by the number of pens, and kept away from the best ones, so the drawing
 * cannot hint at the answer) and carries no number. The layout is a pure function (`optFigureLayout`), so a test can
 * check every label against every drawn line.
 */
import type { OptFigureSpec } from '@/content/types'

const NAVY = 'var(--color-navy)'
const INK = 'var(--color-ink)'
const WALL = 'var(--color-navy)'
const FILL = 'var(--color-gold-100)'
const HALO = { stroke: 'white', strokeWidth: 4, strokeLinejoin: 'round', paintOrder: 'stroke' } as const

export const FIG_WIDTH = 360

export interface FigLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface FigFence extends FigLine {
  letter: 'x' | 'y'
  kind: 'across' | 'along'
}

export interface FigLabel {
  /** Centre of the text. */
  x: number
  y: number
  text: string
  kind: 'letter' | 'wall'
  /** Half the text's width and height, for the overlap checks. */
  w: number
  h: number
}

export interface FigureLayout {
  width: number
  height: number
  /** The row's outer box (the pens' fill). */
  box: { x: number; y: number; w: number; h: number }
  fences: FigFence[]
  wall: FigLine | null
  hatch: FigLine[]
  labels: FigLabel[]
}

/** The size of one pen as drawn: fixed per kind of figure, away from the proportions of the best pen. */
export function drawnPen(spec: Pick<OptFigureSpec, 'pens' | 'whole' | 'wall'>): { penWidth: number; height: number } {
  if (spec.whole) return { penWidth: 121, height: 110 }
  if (spec.pens === 1) return { penWidth: 160, height: 110 }
  if (spec.wall) {
    const width = spec.pens === 2 ? 240 : spec.pens === 3 ? 270 : 280
    const penWidth = width / spec.pens
    return { penWidth, height: Math.round(penWidth / 0.85) }
  }
  const penWidth = 280 / spec.pens
  return { penWidth, height: penWidth }
}

const LETTER = { w: 6, h: 9 }
const WALL_LABEL_H = 8
const TOP_PLAIN = 30
const TOP_WALL = 44
const BOTTOM = 34

export function optFigureLayout(spec: OptFigureSpec): FigureLayout {
  const n = spec.pens
  const { penWidth, height } = drawnPen(spec)
  const W = penWidth * n
  const H = height
  const x0 = (FIG_WIDTH - W) / 2
  const y0 = spec.wall ? TOP_WALL : TOP_PLAIN
  const fences: FigFence[] = []
  const labels: FigLabel[] = []
  // Across the row: the two ends and every fence between neighbours.
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * penWidth
    fences.push({ x1: x, y1: y0, x2: x, y2: y0 + H, letter: spec.across, kind: 'across' })
    const lx = i === 0 ? x - 16 : i === n ? x + 16 : x + 14
    labels.push({ x: lx, y: y0 + H / 2, text: spec.across, kind: 'letter', ...LETTER })
  }
  // Along the row: each pen's side on every fenced edge (one side for the whole row when the pen is divided).
  const edges = spec.wall ? [y0 + H] : [y0, y0 + H]
  const runs = spec.whole ? [[x0, x0 + W]] : Array.from({ length: n }, (_, i) => [x0 + i * penWidth, x0 + (i + 1) * penWidth])
  for (const y of edges) {
    for (const [a, b] of runs) {
      fences.push({ x1: a!, y1: y, x2: b!, y2: y, letter: spec.along, kind: 'along' })
      // A divided pen's one side is labelled off its middle, where the dividing fence meets it.
      const lx = spec.whole ? a! + (b! - a!) / 4 : (a! + b!) / 2
      labels.push({ x: lx, y: y === y0 ? y - 16 : y + 17, text: spec.along, kind: 'letter', ...LETTER })
    }
  }
  let wall: FigLine | null = null
  const hatch: FigLine[] = []
  if (spec.wall) {
    wall = { x1: x0 - 12, y1: y0, x2: x0 + W + 12, y2: y0 }
    for (let x = x0 - 8; x <= x0 + W + 8; x += 10) hatch.push({ x1: x, y1: y0 - 1, x2: x + 7, y2: y0 - 10 })
    const text = spec.wallLabel
    labels.push({ x: FIG_WIDTH / 2, y: y0 - 22, text, kind: 'wall', w: text.length * 3.6 + 3, h: WALL_LABEL_H })
  }
  return { width: FIG_WIDTH, height: y0 + H + BOTTOM, box: { x: x0, y: y0, w: W, h: H }, fences, wall, hatch, labels }
}

const f = (n: number) => Number(n.toFixed(2))

export function OptFigure({ spec }: { spec: OptFigureSpec }) {
  const L = optFigureLayout(spec)
  return (
    <figure className="mx-auto w-full max-w-[360px] overflow-hidden">
      <svg role="img" aria-label={spec.ariaLabel} viewBox={`0 0 ${L.width} ${L.height}`} width="100%" className="block h-auto max-w-full">
        <rect data-opt="pens" x={f(L.box.x)} y={f(L.box.y)} width={f(L.box.w)} height={f(L.box.h)} fill={FILL} stroke="none" />
        {L.hatch.map((h, i) => (
          <line key={`h${i}`} data-opt="hatch" x1={f(h.x1)} y1={f(h.y1)} x2={f(h.x2)} y2={f(h.y2)} stroke={WALL} strokeOpacity={0.55} strokeWidth={1.5} />
        ))}
        {L.wall && <line data-opt="wall" x1={f(L.wall.x1)} y1={f(L.wall.y1)} x2={f(L.wall.x2)} y2={f(L.wall.y2)} stroke={WALL} strokeWidth={4} strokeLinecap="square" />}
        {L.fences.map((fe, i) => (
          <line key={`f${i}`} data-opt="fence" data-letter={fe.letter} data-kind={fe.kind} x1={f(fe.x1)} y1={f(fe.y1)} x2={f(fe.x2)} y2={f(fe.y2)} stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
        ))}
        {L.labels.map((lb, i) => (
          <text
            key={`l${i}`}
            data-opt={lb.kind === 'wall' ? 'wall-label' : 'label'}
            x={f(lb.x)}
            y={f(lb.y)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={INK}
            fontSize={lb.kind === 'wall' ? 12 : 16}
            fontWeight={600}
            fontStyle={lb.kind === 'wall' ? undefined : 'italic'}
            {...HALO}
          >
            {lb.text}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-navy/70">Not drawn to scale.</figcaption>
    </figure>
  )
}
