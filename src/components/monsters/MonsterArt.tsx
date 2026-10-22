import { memo } from 'react'
import { VIEWBOX, monsterArt, num, pathData, speciesArt, type MonsterArt as Art, type Shape } from './art'

const cache = new Map<string, Art | null>()

/** The art for an id (or a species), drawn once per session and kept: the collection shows hundreds. */
function artFor(key: { id?: string; species?: string }, silhouette: boolean, sticker: boolean): Art | null {
  const k = `${key.id ?? ''}|${key.species ?? ''}|${silhouette ? 1 : 0}${sticker ? 1 : 0}`
  if (cache.has(k)) return cache.get(k)!
  const art = key.id ? monsterArt(key.id, { silhouette, sticker }) : key.species ? speciesArt(key.species, { silhouette, sticker }) : null
  cache.set(k, art)
  return art
}

function paint(s: Shape) {
  return {
    fill: s.fill,
    ...(s.stroke ? { stroke: s.stroke, strokeWidth: num(s.sw ?? 1), strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : {}),
    ...(s.dash ? { strokeDasharray: s.dash.map(num).join(' ') } : {}),
    ...(s.opacity !== undefined ? { opacity: num(s.opacity) } : {}),
  }
}

function ShapeEl({ s }: { s: Shape }) {
  if (s.kind === 'circle') return <circle cx={num(s.cx)} cy={num(s.cy)} r={num(s.r)} {...paint(s)} />
  if (s.kind === 'ellipse') return <ellipse cx={num(s.cx)} cy={num(s.cy)} rx={num(s.rx)} ry={num(s.ry)} {...paint(s)} />
  return <path d={pathData(s.d)} {...paint(s)} />
}

/**
 * A monster drawn in code (art.ts): a variant by its catalog id, or a species' own picture. Decorative: it is hidden
 * from screen readers, and the words beside it say which monster it is and how it stands. `silhouette` draws a monster
 * not seen yet (its species' dark outline with a "?"); `sticker` adds the white border the big pictures wear.
 */
export const MonsterArt = memo(function MonsterArt({
  id,
  species,
  size,
  silhouette = false,
  sticker = false,
  className,
}: {
  id?: string
  species?: string
  size: number
  silhouette?: boolean
  sticker?: boolean
  className?: string
}) {
  const art = artFor({ id, species }, silhouette, sticker)
  if (!art) return null
  return (
    <svg
      viewBox={VIEWBOX}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      data-monster={id ?? species}
      data-silhouette={silhouette ? '' : undefined}
    >
      {art.shapes.map((s, i) => (
        <ShapeEl key={i} s={s} />
      ))}
    </svg>
  )
})
