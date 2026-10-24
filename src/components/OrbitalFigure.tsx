/**
 * One orbital in a fixed oblique view: z up, y to the right, x toward the viewer.
 * Decorative art. The accessible name describes the picture and never the orbital's name.
 */
import type { OrbitalId } from '@/content/types'
import { orbitalAlt } from '@/content/modules/quantumNumbers/facts'

const O = { x: 188, y: 176 }
// The textbook's oblique view (as in her class notes): y straight to the right, x shorter toward the lower left, z up.
// Review 2026-10-23: with x steep and y sloping down, the x + y direction drew nearly straight down, so dxy's lobes
// looked as if they lay along the z axis.
const X = { x: -66, y: 50 }
const Y = { x: 132, y: 0 }
const Z = { x: 0, y: -118 }

function unit(a: number, b: number, c: number): [number, number, number] {
  const len = Math.hypot(a, b, c) || 1
  return [a / len, b / len, c / len]
}

function screenOf(a: number, b: number, c: number): { x: number; y: number } {
  const [x, y, z] = unit(a, b, c)
  return { x: x * X.x + y * Y.x + z * Z.x, y: x * X.y + y * Y.y + z * Z.y }
}

function Lobe({ a, b, c, rx, ry, fill }: { a: number; b: number; c: number; rx: number; ry: number; fill: string }) {
  const dir = screenOf(a, b, c)
  const cx = O.x + dir.x * 0.5
  const cy = O.y + dir.y * 0.5
  const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI
  return (
    <ellipse
      data-lobe=""
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill={fill}
      fillOpacity={0.55}
      stroke="var(--color-navy)"
      strokeWidth={2}
      transform={`rotate(${angle} ${cx} ${cy})`}
    />
  )
}

function Axes() {
  const arms = [
    { v: X, label: 'x' },
    { v: Y, label: 'y' },
    { v: Z, label: 'z' },
  ]
  return (
    <g aria-hidden="true">
      {arms.map((arm) => {
        const x1 = O.x - arm.v.x * 1.08
        const y1 = O.y - arm.v.y * 1.08
        const x2 = O.x + arm.v.x * 1.12
        const y2 = O.y + arm.v.y * 1.12
        return <line key={arm.label} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-ink)" strokeWidth={1.5} />
      })}
    </g>
  )
}

function Labels() {
  const arms = [
    { v: X, label: 'x' },
    { v: Y, label: 'y' },
    { v: Z, label: 'z' },
  ]
  return (
    <g>
      {arms.map((arm) => (
        <text
          key={arm.label}
          x={O.x + arm.v.x * 1.24}
          y={O.y + arm.v.y * 1.24}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-ink)"
          fontStyle="italic"
          fontSize={18}
          stroke="var(--color-navy-50)"
          strokeWidth={4}
          paintOrder="stroke"
        >
          {arm.label}
        </text>
      ))}
    </g>
  )
}

function lobesOf(id: OrbitalId): [number, number, number][] {
  switch (id) {
    case 's':
      return []
    case 'px':
      return [
        [1, 0, 0],
        [-1, 0, 0],
      ]
    case 'py':
      return [
        [0, 1, 0],
        [0, -1, 0],
      ]
    case 'pz':
      return [
        [0, 0, 1],
        [0, 0, -1],
      ]
    case 'dxy':
      return [
        [1, 1, 0],
        [1, -1, 0],
        [-1, 1, 0],
        [-1, -1, 0],
      ]
    case 'dxz':
      return [
        [1, 0, 1],
        [1, 0, -1],
        [-1, 0, 1],
        [-1, 0, -1],
      ]
    case 'dyz':
      return [
        [0, 1, 1],
        [0, 1, -1],
        [0, -1, 1],
        [0, -1, -1],
      ]
    case 'dx2y2':
      return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
      ]
    case 'dz2':
      return [
        [0, 0, 1],
        [0, 0, -1],
      ]
  }
}

export function OrbitalFigure({ orbital }: { orbital: OrbitalId }) {
  const fill = orbital === 's' ? 'var(--color-gold)' : orbital.startsWith('d') || orbital === 'dz2' ? 'var(--color-coral)' : 'var(--color-navy)'
  const dirs = lobesOf(orbital)
  const rx = dirs.length > 2 ? 28 : 34
  const ry = dirs.length > 2 ? 14 : 16
  return (
    <svg role="img" aria-label={orbitalAlt(orbital)} viewBox="0 0 400 340" className="mx-auto w-full max-w-sm">
      <Axes />
      {orbital === 's' && (
        <circle data-sphere="" cx={O.x} cy={O.y} r={48} fill="var(--color-gold)" fillOpacity={0.85} stroke="var(--color-navy)" strokeWidth={2} />
      )}
      {orbital === 'dz2' && (
        <ellipse
          data-ring=""
          cx={O.x}
          cy={O.y}
          rx={74}
          ry={24}
          fill="none"
          stroke="var(--color-gold-text)"
          strokeWidth={10}
          transform={`rotate(13 ${O.x} ${O.y})`}
        />
      )}
      {dirs.map(([a, b, c]) => (
        <Lobe key={`${a},${b},${c}`} a={a!} b={b!} c={c!} rx={rx} ry={ry} fill={fill} />
      ))}
      <Labels />
    </svg>
  )
}
