/**
 * The generated art (art.ts): the same id always draws the same SVG; the SVG is well formed and every shape (strokes
 * and the sticker border included) stays inside the 100 × 100 viewBox; no two variants of a species look the same;
 * a silhouette is one dark colour with a "?" and nothing of the variant.
 */
import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '@/engine'
import { ACCESSORIES, PATTERNS, artMarkup, hashString, hsl, monsterArt, shapeBounds, speciesArt, speciesTraits, variantTraits, type MonsterArt, type Shape } from './art'
import { NOT_MONSTERS, SPECIES } from './species'

const COLOR = /^(#[0-9a-f]{6}|none)$/

function numbers(s: Shape): number[] {
  const own = s.kind === 'circle' ? [s.cx, s.cy, s.r] : s.kind === 'ellipse' ? [s.cx, s.cy, s.rx, s.ry] : s.d.flatMap((c) => c.slice(1) as number[])
  return [...own, s.sw ?? 0, s.opacity ?? 1, ...(s.dash ?? [])]
}

function expectWithinViewBox(art: MonsterArt, label: string) {
  for (const s of art.shapes) {
    const b = shapeBounds(s)
    expect(b.x0, label).toBeGreaterThanOrEqual(0)
    expect(b.y0, label).toBeGreaterThanOrEqual(0)
    expect(b.x1, label).toBeLessThanOrEqual(100)
    expect(b.y1, label).toBeLessThanOrEqual(100)
  }
}

function expectValid(art: MonsterArt, label: string) {
  expect(art.shapes.length, label).toBeGreaterThan(4)
  for (const s of art.shapes) {
    for (const n of numbers(s)) expect(Number.isFinite(n), label).toBe(true)
    expect(s.fill, label).toMatch(COLOR)
    if (s.stroke) expect(s.stroke, label).toMatch(COLOR)
    if (s.opacity !== undefined) expect(s.opacity >= 0 && s.opacity <= 1, label).toBe(true)
    if (s.kind === 'path') {
      expect(s.d[0]![0], label).toBe('M')
      for (const c of s.d) expect(c.length, label).toBe({ M: 3, L: 3, Q: 5, C: 7, Z: 1 }[c[0]])
    }
  }
  const markup = artMarkup(art)
  expect(markup.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'), label).toBe(true)
  expect(markup.endsWith('</svg>'), label).toBe(true)
  // Every shape is one self-closed element, with nothing else between them.
  expect(markup.replace(/<(path|circle|ellipse) [^<>]*\/>/g, ''), label).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>')
  expect(markup, label).not.toMatch(/NaN|undefined|Infinity/)
}

const VARIANTS = SPECIES.flatMap((s) => s.variants)
/** The hash of the Sign Flipper's first variant's SVG today. */
const PINNED = '1bf0474e'

describe('the art', () => {
  it('is deterministic: the same id gives the same SVG, call after call', () => {
    expect(hashString('')).toBe(0x811c9dc5)
    expect(hashString('no_sign_flip')).toBe(hashString('no_sign_flip'))
    expect(hsl(0, 100, 50)).toBe('#ff0000')
    expect(hsl(240, 100, 50)).toBe('#0000ff')
    for (const id of VARIANTS) expect(artMarkup(monsterArt(id)!)).toBe(artMarkup(monsterArt(id)!))
    // Computed again from scratch (a fresh copy of each species, nothing cached): the same traits.
    for (const s of SPECIES) expect(speciesTraits({ ...s })).toEqual(speciesTraits(s))
    // Pinned: her caught monsters must not change their looks by accident. Change this only on purpose.
    expect(hashString(artMarkup(monsterArt('no_sign_flip')!)).toString(16)).toBe(PINNED)
  })

  it('is valid SVG, every shape inside its viewBox: each variant, plain or as a sticker, and each silhouette', () => {
    for (const id of VARIANTS) {
      for (const sticker of [false, true]) {
        const art = monsterArt(id, { sticker })!
        expectValid(art, id)
        expectWithinViewBox(art, `${id}${sticker ? ' (sticker)' : ''}`)
      }
    }
    for (const s of SPECIES) {
      for (const opts of [{}, { sticker: true }, { silhouette: true }, { silhouette: true, sticker: true }]) {
        const art = speciesArt(s.id, opts)!
        expectValid(art, s.id)
        expectWithinViewBox(art, `${s.id} ${JSON.stringify(opts)}`)
      }
    }
  })

  it('no two variants of a species look the same: their own pattern, accessory and eyes, and their own SVG', () => {
    for (const s of SPECIES) {
      const traits = speciesTraits(s)
      const keys = s.variants.map((id) => {
        const t = traits.get(id)!
        expect(PATTERNS).toContain(t.pattern)
        expect(ACCESSORIES).toContain(t.accessory)
        return `${t.pattern}|${t.accessory}|${t.eyes}`
      })
      expect(new Set(keys).size, s.id).toBe(s.variants.length)
      const svgs = s.variants.map((id) => artMarkup(monsterArt(id)!))
      expect(new Set(svgs).size, s.id).toBe(s.variants.length)
    }
  })

  it('a variant keeps its species: its body outline is the species’ own', () => {
    for (const s of SPECIES) {
      const outline = (art: MonsterArt) => {
        const bodies = art.shapes.filter((sh) => sh.body)
        expect(bodies).toHaveLength(1)
        return JSON.stringify(bodies[0])
      }
      const plain = speciesArt(s.id)!
      for (const id of s.variants) {
        const art = monsterArt(id)!
        // The same outline; only the colour may shift.
        expect(outline(art).replace(/"fill":"#[0-9a-f]{6}"/, ''), id).toBe(outline(plain).replace(/"fill":"#[0-9a-f]{6}"/, ''))
      }
    }
  })

  it('a silhouette is the outline in one dark colour, with a "?" and none of the face', () => {
    for (const s of SPECIES) {
      const art = speciesArt(s.id, { silhouette: true })!
      const fills = new Set(art.shapes.map((sh) => sh.fill).filter((f) => f !== 'none'))
      // The ground shadow (ink), the dark outline, and the "?" (its dot).
      expect(fills.size, s.id).toBeLessThanOrEqual(3)
      expect([...fills]).not.toContain('#ffffff')
      expect(artMarkup(art)).not.toBe(artMarkup(speciesArt(s.id)!))
    }
  })

  it('nothing for an id that is not a monster', () => {
    for (const id of Object.keys(NOT_MONSTERS)) {
      expect(id in ERROR_PATTERNS).toBe(true)
      expect(monsterArt(id)).toBeNull()
      expect(variantTraits(id)).toBeNull()
    }
    expect(monsterArt('nope')).toBeNull()
    expect(speciesArt('nope')).toBeNull()
  })
})
