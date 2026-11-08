/**
 * The runner's sprite: her monster's own art (components/monsters/art.ts), rasterized once per run
 * onto a tiny canvas so the game draws it chunky and 8-bit (nearest-neighbor back up). Rasterizing
 * an SVG needs a real browser Image; where that fails (jsdom, a blocked data URL), the game falls
 * back to a drawn pixel blob in the app's navy, so a run never breaks on art.
 */
import { artMarkup, monsterArt, speciesArt } from '@/components/monsters/art'

/** The sprite's edge in its own pixels; the game scales it up with smoothing off. */
export const SPRITE_PX = 24

/**
 * Draw the monster onto a SPRITE_PX canvas. `runner` is a catalog id (a variant she caught); a
 * species id works as the fallback picture. Resolves null when the art or the browser cannot.
 */
export function loadDashSprite(runner: string): Promise<HTMLCanvasElement | null> {
  const art = monsterArt(runner) ?? speciesArt(runner)
  if (!art) return Promise.resolve(null)
  const svg = artMarkup(art)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = SPRITE_PX
          canvas.height = SPRITE_PX
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(null)
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(img, 0, 0, SPRITE_PX, SPRITE_PX)
          resolve(canvas)
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    } catch {
      resolve(null)
    }
  })
}
