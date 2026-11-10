/**
 * The size a notes photo is sent at (study/photo.ts). The drawing itself needs a real browser
 * canvas; what is checked here is the arithmetic, and that each fallback is smaller than the last.
 */
import { describe, expect, it } from 'vitest'
import { fitWithin, PHOTO_EDGES } from './photo'

describe('shrinking a photo', () => {
  it('fits the longer side and keeps the shape', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(2000, 2000, 1600)).toEqual({ width: 1600, height: 1600 })
  })

  it('never enlarges a small photo, and never rounds a side to nothing', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(5000, 2, 1600)).toEqual({ width: 1600, height: 1 })
  })

  it('a photo with no size has none', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 })
    expect(fitWithin(Number.NaN, 10, 1600)).toEqual({ width: 0, height: 0 })
  })

  it('each fallback is a smaller photo at a lower quality', () => {
    for (let i = 1; i < PHOTO_EDGES.length; i++) {
      expect(PHOTO_EDGES[i]!.edge).toBeLessThan(PHOTO_EDGES[i - 1]!.edge)
      expect(PHOTO_EDGES[i]!.quality).toBeLessThan(PHOTO_EDGES[i - 1]!.quality)
    }
  })
})
