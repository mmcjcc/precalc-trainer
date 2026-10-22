/**
 * Monster art, drawn in code (docs/progress/phone-monsters.md): no image files, nothing to download or license.
 * Flat, bold sticker art: a species (species.ts `look`) fixes the body, the colours, what grows on top, the eyes, the
 * mouth, the feet and its own sign; each variant (a catalog id) adds deterministic extras chosen from its id (a
 * pattern, something it wears, how many eyes, a small colour shift, where it looks), so every variant is
 * recognisably its species and different from its siblings. Pure: the same id always gives the same shapes.
 *
 * Everything sits in a 0..100 box (`VIEWBOX`), strokes and the white sticker border included (art.test.ts checks
 * every shape's bounds). Transforms are baked into the coordinates (the Upside-Downer is drawn flipped), so a shape's
 * bounds are its points. An unseen variant is its species' silhouette with a "?".
 */
import { speciesById, speciesOf, type BodyShape, type EyeStyle, type Species, type SpeciesLook } from './species'

export const VIEWBOX = '0 0 100 100'

// ---------------------------------------------------------------------------------------------------------------
// The shape model
// ---------------------------------------------------------------------------------------------------------------

export type Cmd = ['M', number, number] | ['L', number, number] | ['Q', number, number, number, number] | ['C', number, number, number, number, number, number] | ['Z']

interface Paint {
  fill: string
  stroke?: string
  sw?: number
  opacity?: number
  /** Dashes along the stroke. */
  dash?: readonly number[]
  /** Part of the outline: it gets the white sticker border. */
  solid?: boolean
  /** The body itself (every variant of a species has the same one). */
  body?: true
}

export type Shape =
  | (Paint & { kind: 'path'; d: Cmd[] })
  | (Paint & { kind: 'circle'; cx: number; cy: number; r: number })
  | (Paint & { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number })

export interface MonsterArt {
  shapes: Shape[]
}

export interface ArtOptions {
  /** The dark outline with a "?" (a variant not seen yet). */
  silhouette?: boolean
  /** A white sticker border around the outline (the big pictures; small avatars leave it out). */
  sticker?: boolean
}

/** The traits a variant adds to its species. */
export type Pattern = 'none' | 'spots' | 'stripes' | 'belly' | 'freckles' | 'zigzag' | 'patch'
export type Accessory = 'none' | 'beanie' | 'cap' | 'headphones' | 'glasses' | 'shades' | 'bandaid' | 'earring' | 'headband' | 'pencil' | 'sticker'

export interface Traits {
  pattern: Pattern
  accessory: Accessory
  eyes: 1 | 2 | 3
  /** Hue and lightness shift of the body colour. */
  hueShift: number
  lightShift: number
  /** Horns, ears and antennae a little smaller or bigger. */
  topScale: number
  /** Where the pupils look: −1 left, 0 ahead, 1 right. */
  look: -1 | 0 | 1
  mouthScale: number
}

export const PATTERNS: readonly Pattern[] = ['none', 'spots', 'stripes', 'belly', 'freckles', 'zigzag', 'patch']
export const ACCESSORIES: readonly Accessory[] = ['none', 'beanie', 'cap', 'headphones', 'glasses', 'shades', 'bandaid', 'earring', 'headband', 'pencil', 'sticker']

const INK = '#1a1f36'
const WHITE = '#ffffff'
const MOUTH = '#4a1830'
const TONGUE = '#f27a93'
const GOLD = '#f2c94c'
const GOLD_DARK = '#b98a12'
const SHADOW_SILHOUETTE = '#2b3256'
const OUTLINE = 3

// ---------------------------------------------------------------------------------------------------------------
// Deterministic choices
// ---------------------------------------------------------------------------------------------------------------

/** FNV-1a, 32 bits. */
export function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A small seeded generator (mulberry32): the same seed, the same sequence. */
function generator(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length) % list.length]!
}

/** Accessories that would cover a species' own sign. */
function blockedAccessories(look: SpeciesLook): Set<Accessory> {
  const out = new Set<Accessory>()
  if (look.mark === 'mask' || look.mark === 'disguise' || look.mark === 'monocle') {
    out.add('glasses')
    out.add('shades')
  }
  if (look.eyes === 'hollow') out.add('shades')
  if (look.top === 'hardhat' || look.top === 'beam' || look.top === 'radical') {
    out.add('beanie')
    out.add('cap')
    out.add('pencil')
  }
  if (look.top === 'mohawk' || look.top === 'sprout') out.add('beanie')
  if (look.body === 'log') {
    out.add('headphones')
    out.add('pencil')
  }
  if (look.flip) out.add('pencil')
  return out
}

function blockedPatterns(look: SpeciesLook): Set<Pattern> {
  const out = new Set<Pattern>()
  // A belly sign of its own leaves no room for a belly patch or a zigzag across it.
  if (['coin', 'zero', 'grid', 'nametag', 'therefore', 'swirl', 'fraction'].includes(look.mark)) {
    out.add('belly')
    out.add('zigzag')
  }
  if (look.mark === 'stitches') out.add('patch')
  return out
}

function traitsFrom(rnd: () => number, look: SpeciesLook): Traits {
  const accessories = ACCESSORIES.filter((a) => !blockedAccessories(look).has(a))
  const patterns = PATTERNS.filter((p) => !blockedPatterns(look).has(p))
  return {
    pattern: pick(rnd, patterns),
    accessory: pick(rnd, accessories),
    eyes: pick(rnd, [1, 2, 2, 3] as const),
    hueShift: pick(rnd, [-12, -6, 0, 6, 12]),
    lightShift: pick(rnd, [-5, 0, 5]),
    topScale: pick(rnd, [0.85, 1, 1.15]),
    look: pick(rnd, [-1, 0, 1] as const),
    mouthScale: pick(rnd, [0.9, 1, 1.12]),
  }
}

function traitKey(t: Traits): string {
  return `${t.pattern}|${t.accessory}|${t.eyes}`
}

const traitCache = new WeakMap<Species, Map<string, Traits>>()

/**
 * The traits of every variant of a species, from each id: a variant's pattern, accessory and eye count are never the
 * same as an earlier sibling's (a clash draws again from the id with a counter), so no two variants look alike.
 */
export function speciesTraits(species: Species): Map<string, Traits> {
  const hit = traitCache.get(species)
  if (hit) return hit
  const out = new Map<string, Traits>()
  const used = new Set<string>()
  for (const id of species.variants) {
    let traits = traitsFrom(generator(hashString(`${species.id}:${id}`)), species.look)
    for (let k = 1; used.has(traitKey(traits)) && k < 500; k++) {
      traits = traitsFrom(generator(hashString(`${species.id}:${id}#${k}`)), species.look)
    }
    used.add(traitKey(traits))
    out.set(id, traits)
  }
  traitCache.set(species, out)
  return out
}

/** A variant's traits, or null when the id is not a monster. */
export function variantTraits(patternId: string): Traits | null {
  const species = speciesOf(patternId)
  return species ? (speciesTraits(species).get(patternId) ?? null) : null
}

const PLAIN: Traits = { pattern: 'none', accessory: 'none', eyes: 2, hueShift: 0, lightShift: 0, topScale: 1, look: 0, mouthScale: 1 }

// ---------------------------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** HSL (degrees, percent, percent) to #rrggbb. */
export function hsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const lig = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lig - c / 2
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x]
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

interface Palette {
  body: string
  shade: string
  light: string
  accent: string
  accentDark: string
  accentLight: string
}

function paletteOf(look: SpeciesLook, t: Traits): Palette {
  const h = look.hue + t.hueShift
  const l = look.light + t.lightShift
  return {
    body: hsl(h, look.sat, l),
    shade: hsl(h, look.sat + 4, l - 14),
    light: hsl(h, look.sat - 10, Math.min(94, l + 22)),
    accent: hsl(look.accent, 70, 58),
    accentDark: hsl(look.accent, 64, 40),
    accentLight: hsl(look.accent, 70, 82),
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------------------------------------------

/** Where a body puts its face and its parts. */
interface Frame {
  outline: Cmd[]
  /** Center and half-sizes of the body (for patterns, arms, feet). */
  cx: number
  cy: number
  rx: number
  ry: number
  top: number
  bottom: number
  /** The left and right edge of the body at height y (inside its outline). */
  span: (y: number) => [number, number]
  eyeY: number
  eyeDX: number
  eyeR: number
  mouthY: number
  mouthW: number
  /** The middle of the face (the log's face is off to one side). */
  faceX: number
  /** The top of the head and its half-width there (where horns, ears and hats sit). */
  headX: number
  headY: number
  headW: number
  /** The oval the body is drawn from, when it is one (the Sign Flipper's two-tone half follows it). */
  oval?: OvalSpec
}

interface OvalSpec {
  cx: number
  cy: number
  rx: number
  ryTop: number
  ryBot: number
  /** How square the upper and lower halves are (0.55 is round). */
  kTop: number
  kBot: number
  /** How wide the top and the bottom stay (1 = like an ellipse; less narrows it there). */
  wTop?: number
  wBot?: number
}

function oval(o: OvalSpec): Cmd[] {
  const wt = o.wTop ?? 1
  const wb = o.wBot ?? 1
  const { cx, cy, rx } = o
  const t = cy - o.ryTop
  const b = cy + o.ryBot
  return [
    ['M', cx, t],
    ['C', cx + rx * o.kTop * wt, t, cx + rx, cy - o.ryTop * o.kTop, cx + rx, cy],
    ['C', cx + rx, cy + o.ryBot * o.kBot, cx + rx * o.kBot * wb, b, cx, b],
    ['C', cx - rx * o.kBot * wb, b, cx - rx, cy + o.ryBot * o.kBot, cx - rx, cy],
    ['C', cx - rx, cy - o.ryTop * o.kTop, cx - rx * o.kTop * wt, t, cx, t],
    ['Z'],
  ]
}

/** The right (or left) half of an oval, closed along its middle. */
function ovalHalf(o: OvalSpec, side: 1 | -1): Cmd[] {
  const wt = o.wTop ?? 1
  const wb = o.wBot ?? 1
  const { cx, cy, rx } = o
  const t = cy - o.ryTop
  const b = cy + o.ryBot
  const s = side
  return [
    ['M', cx, t],
    ['C', cx + s * rx * o.kTop * wt, t, cx + s * rx, cy - o.ryTop * o.kTop, cx + s * rx, cy],
    ['C', cx + s * rx, cy + o.ryBot * o.kBot, cx + s * rx * o.kBot * wb, b, cx, b],
    ['Z'],
  ]
}

function ovalSpan(o: OvalSpec): (y: number) => [number, number] {
  return (y) => {
    const ry = y < o.cy ? o.ryTop : o.ryBot
    const f = clamp((y - o.cy) / ry, -1, 1)
    // An ellipse's half-width, kept a little inside (the squarer curve is wider than this).
    const w = o.rx * Math.sqrt(Math.max(0, 1 - f * f)) * 0.96
    return [o.cx - w, o.cx + w]
  }
}

function roundedPoly(points: readonly [number, number][], r: number): Cmd[] {
  const n = points.length
  const cmds: Cmd[] = []
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    const prev = points[(i + n - 1) % n]!
    const next = points[(i + 1) % n]!
    const toPrev = norm(prev[0] - p[0], prev[1] - p[1])
    const toNext = norm(next[0] - p[0], next[1] - p[1])
    const a: [number, number] = [p[0] + toPrev[0] * r, p[1] + toPrev[1] * r]
    const b: [number, number] = [p[0] + toNext[0] * r, p[1] + toNext[1] * r]
    if (i === 0) cmds.push(['M', a[0], a[1]])
    else cmds.push(['L', a[0], a[1]])
    cmds.push(['Q', p[0], p[1], b[0], b[1]])
  }
  cmds.push(['Z'])
  return cmds
}

function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}

function boxFrame(x0: number, y0: number, x1: number, y1: number, r: number): Pick<Frame, 'outline' | 'span'> {
  return {
    outline: [
      ['M', x0 + r, y0],
      ['L', x1 - r, y0],
      ['Q', x1, y0, x1, y0 + r],
      ['L', x1, y1 - r],
      ['Q', x1, y1, x1 - r, y1],
      ['L', x0 + r, y1],
      ['Q', x0, y1, x0, y1 - r],
      ['L', x0, y0 + r],
      ['Q', x0, y0, x0 + r, y0],
      ['Z'],
    ],
    span: (y) => {
      const inset = y < y0 + r ? r - Math.sqrt(Math.max(0, r * r - (y0 + r - y) ** 2)) : y > y1 - r ? r - Math.sqrt(Math.max(0, r * r - (y - (y1 - r)) ** 2)) : 0
      return [x0 + inset + 1, x1 - inset - 1]
    },
  }
}

function frameOf(body: BodyShape, high = false): Frame {
  const f = bodyFrame(body)
  return high ? { ...f, eyeY: f.eyeY - 5, mouthY: f.mouthY - 6 } : f
}

function bodyFrame(body: BodyShape): Frame {
  const base = { eyeY: 50, eyeDX: 10.5, eyeR: 7, mouthY: 65, mouthW: 16, faceX: 50, headX: 50 }
  switch (body) {
    case 'blob': {
      const o: OvalSpec = { cx: 50, cy: 59, rx: 28, ryTop: 27, ryBot: 24, kTop: 0.6, kBot: 0.7, wTop: 0.92 }
      return { ...base, oval: o, outline: oval(o), span: ovalSpan(o), cx: 50, cy: 59, rx: 28, ry: 25, top: 32, bottom: 83, headY: 32, headW: 17 }
    }
    case 'round': {
      const o: OvalSpec = { cx: 50, cy: 58, rx: 27, ryTop: 27, ryBot: 26, kTop: 0.56, kBot: 0.58 }
      return { ...base, oval: o, outline: oval(o), span: ovalSpan(o), cx: 50, cy: 58, rx: 27, ry: 26, top: 31, bottom: 84, eyeY: 51, headY: 31, headW: 16 }
    }
    case 'bean': {
      const o: OvalSpec = { cx: 50, cy: 58, rx: 23, ryTop: 30, ryBot: 26, kTop: 0.62, kBot: 0.7 }
      return { ...base, oval: o, outline: oval(o), span: ovalSpan(o), cx: 50, cy: 58, rx: 23, ry: 27, top: 28, bottom: 84, eyeY: 48, eyeDX: 9, eyeR: 6.5, mouthY: 63, mouthW: 14, headY: 28, headW: 13 }
    }
    case 'pear': {
      const o: OvalSpec = { cx: 50, cy: 62, rx: 29, ryTop: 31, ryBot: 22, kTop: 0.5, kBot: 0.72, wTop: 0.62 }
      return { ...base, oval: o, outline: oval(o), span: ovalSpan(o), cx: 50, cy: 62, rx: 29, ry: 25, top: 31, bottom: 84, eyeY: 52, eyeDX: 10, mouthY: 67, headY: 31, headW: 12 }
    }
    case 'drop': {
      const outline: Cmd[] = [
        ['M', 50, 25],
        ['C', 57, 37, 78, 47, 78, 63],
        ['C', 78, 77, 66, 85, 50, 85],
        ['C', 34, 85, 22, 77, 22, 63],
        ['C', 22, 47, 43, 37, 50, 25],
        ['Z'],
      ]
      const span = (y: number): [number, number] => {
        const w = y < 63 ? clamp(((y - 25) / 38) * 26, 0, 26) : 26 * Math.sqrt(Math.max(0, 1 - ((y - 63) / 22) ** 2))
        return [50 - w * 0.95, 50 + w * 0.95]
      }
      return { ...base, outline, span, cx: 50, cy: 63, rx: 27, ry: 21, top: 25, bottom: 85, eyeY: 57, eyeDX: 10, eyeR: 6.5, mouthY: 70, mouthW: 15, headY: 30, headW: 6 }
    }
    case 'box': {
      const b = boxFrame(24, 33, 76, 83, 12)
      return { ...base, ...b, cx: 50, cy: 58, rx: 26, ry: 25, top: 33, bottom: 83, eyeY: 51, headY: 33, headW: 18 }
    }
    case 'chopped': {
      // A box with its top right corner cut off.
      const outline: Cmd[] = [
        ['M', 34, 33],
        ['L', 60, 33],
        ['L', 76, 49],
        ['L', 76, 73],
        ['Q', 76, 83, 66, 83],
        ['L', 34, 83],
        ['Q', 24, 83, 24, 73],
        ['L', 24, 43],
        ['Q', 24, 33, 34, 33],
        ['Z'],
      ]
      const span = (y: number): [number, number] => {
        const left = y < 43 ? 24 + (10 - Math.sqrt(Math.max(0, 100 - (43 - y) ** 2))) : y > 73 ? 24 + (10 - Math.sqrt(Math.max(0, 100 - (y - 73) ** 2))) : 24
        const right = y < 49 ? 60 + (y - 33) : y > 73 ? 76 - (10 - Math.sqrt(Math.max(0, 100 - (y - 73) ** 2))) : 76
        return [left + 1, right - 1]
      }
      return { ...base, outline, span, cx: 50, cy: 58, rx: 26, ry: 25, top: 33, bottom: 83, eyeY: 52, eyeDX: 10, headX: 44, headY: 33, headW: 14 }
    }
    case 'ghost': {
      const outline: Cmd[] = [
        ['M', 24, 52],
        ['C', 24, 35, 36, 25, 50, 25],
        ['C', 64, 25, 76, 35, 76, 52],
        ['L', 76, 80],
        ['Q', 71.7, 87, 67.3, 80],
        ['Q', 63, 73, 58.7, 80],
        ['Q', 54.3, 87, 50, 80],
        ['Q', 45.7, 73, 41.3, 80],
        ['Q', 37, 87, 32.7, 80],
        ['Q', 28.3, 73, 24, 80],
        ['Z'],
      ]
      const span = (y: number): [number, number] => {
        if (y >= 52) return [25, 75]
        const f = (52 - y) / 27
        const w = 26 * Math.sqrt(Math.max(0, 1 - f * f)) * 0.95
        return [50 - w, 50 + w]
      }
      return { ...base, outline, span, cx: 50, cy: 54, rx: 26, ry: 24, top: 25, bottom: 80, eyeY: 47, mouthY: 61, headY: 25, headW: 16 }
    }
    case 'tri': {
      const outline = roundedPoly(
        [
          [50, 26],
          [81, 83],
          [19, 83],
        ],
        8,
      )
      const span = (y: number): [number, number] => {
        const w = clamp(((y - 26) / 57) * 31, 0, 31) * 0.86
        return [50 - w, 50 + w]
      }
      return { ...base, outline, span, cx: 50, cy: 64, rx: 27, ry: 19, top: 26, bottom: 83, eyeY: 61, eyeDX: 8.5, eyeR: 6, mouthY: 73, mouthW: 13, headY: 32, headW: 6 }
    }
    case 'spiky': {
      const pts: [number, number][] = []
      const n = 14
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 === 0 ? 31 : 25.5
        pts.push([50 + Math.cos(a) * r, 58 + Math.sin(a) * r * 0.95])
      }
      const outline = roundedPoly(pts, 2)
      const span = (y: number): [number, number] => {
        const f = clamp((y - 58) / 24, -1, 1)
        const w = 24 * Math.sqrt(Math.max(0, 1 - f * f))
        return [50 - w, 50 + w]
      }
      return { ...base, outline, span, cx: 50, cy: 58, rx: 25, ry: 24, top: 30, bottom: 87, eyeY: 52, headY: 33, headW: 12 }
    }
    case 'hex': {
      const outline = roundedPoly(
        [
          [36, 32],
          [64, 32],
          [79, 58],
          [64, 84],
          [36, 84],
          [21, 58],
        ],
        5,
      )
      const span = (y: number): [number, number] => {
        const w = y < 58 ? 14 + ((y - 32) / 26) * 15 : 14 + ((84 - y) / 26) * 15
        return [50 - w * 0.95, 50 + w * 0.95]
      }
      return { ...base, outline, span, cx: 50, cy: 58, rx: 27, ry: 25, top: 32, bottom: 84, eyeY: 52, headY: 32, headW: 13 }
    }
    case 'cloud': {
      // Bumps around an ellipse.
      const pts: [number, number][] = []
      const n = 9
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2
        pts.push([50 + Math.cos(a) * 27, 58 + Math.sin(a) * 23])
      }
      const outline: Cmd[] = [['M', pts[0]![0], pts[0]![1]]]
      for (let i = 0; i < n; i++) {
        const p = pts[i]!
        const q = pts[(i + 1) % n]!
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
        const out = norm(mid[0]! - 50, mid[1]! - 58)
        outline.push(['Q', mid[0]! + out[0] * 9, mid[1]! + out[1] * 9, q[0], q[1]])
      }
      outline.push(['Z'])
      const span = (y: number): [number, number] => {
        const f = clamp((y - 58) / 23, -1, 1)
        const w = 27 * Math.sqrt(Math.max(0, 1 - f * f))
        return [50 - w, 50 + w]
      }
      return { ...base, outline, span, cx: 50, cy: 58, rx: 28, ry: 24, top: 30, bottom: 86, eyeY: 53, mouthY: 66, headY: 32, headW: 14 }
    }
    case 'log': {
      // A log lying down, its cut end to the left, its face on the bark.
      const outline: Cmd[] = [
        ['M', 22, 38],
        ['L', 72, 38],
        ['C', 82, 38, 88, 48, 88, 60],
        ['C', 88, 72, 82, 82, 72, 82],
        ['L', 22, 82],
        ['C', 15, 82, 12, 72, 12, 60],
        ['C', 12, 48, 15, 38, 22, 38],
        ['Z'],
      ]
      const span = (y: number): [number, number] => {
        const f = clamp((y - 60) / 22, -1, 1)
        const w = Math.sqrt(Math.max(0, 1 - f * f))
        return [13 + 9 * (1 - w) + 9, 72 + 15 * w * 0.9]
      }
      return {
        ...base,
        outline,
        span,
        cx: 54,
        cy: 60,
        rx: 34,
        ry: 21,
        top: 38,
        bottom: 82,
        eyeY: 55,
        eyeDX: 8.5,
        eyeR: 6,
        mouthY: 69,
        mouthW: 13,
        faceX: 62,
        headX: 62,
        headY: 38,
        headW: 14,
      }
    }
    case 'lean': {
      // A blob leaning to the right (its points skewed: the further up, the further right).
      const o: OvalSpec = { cx: 48, cy: 59, rx: 25, ryTop: 27, ryBot: 24, kTop: 0.6, kBot: 0.68 }
      const skew = (x: number, y: number): [number, number] => [x + (59 - y) * 0.16, y]
      const outline = oval(o).map((c): Cmd => skewCmd(c, skew))
      const inner = ovalSpan(o)
      const span = (y: number): [number, number] => {
        const [l, r] = inner(y)
        const dx = (59 - y) * 0.16
        return [l + dx, r + dx]
      }
      return { ...base, outline, span, cx: 49, cy: 59, rx: 25, ry: 25, top: 32, bottom: 83, eyeY: 50, eyeDX: 10, faceX: 51.5, headX: 53, headY: 32, headW: 14 }
    }
  }
}

function skewCmd(c: Cmd, f: (x: number, y: number) => [number, number]): Cmd {
  switch (c[0]) {
    case 'M':
    case 'L': {
      const [x, y] = f(c[1], c[2])
      return [c[0], x, y]
    }
    case 'Q': {
      const [x1, y1] = f(c[1], c[2])
      const [x, y] = f(c[3], c[4])
      return ['Q', x1, y1, x, y]
    }
    case 'C': {
      const [x1, y1] = f(c[1], c[2])
      const [x2, y2] = f(c[3], c[4])
      const [x, y] = f(c[5], c[6])
      return ['C', x1, y1, x2, y2, x, y]
    }
    case 'Z':
      return c
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------------------------------------------

class Pen {
  readonly shapes: Shape[] = []
  path(d: Cmd[], paint: Paint): void {
    this.shapes.push({ kind: 'path', d, ...paint })
  }
  circle(cx: number, cy: number, r: number, paint: Paint): void {
    this.shapes.push({ kind: 'circle', cx, cy, r, ...paint })
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, paint: Paint): void {
    this.shapes.push({ kind: 'ellipse', cx, cy, rx, ry, ...paint })
  }
  /** A line drawn twice: the ink under, the colour on top (a stroke with an outline). */
  outlinedLine(d: Cmd[], color: string, width: number, solid = true): void {
    this.path(d, { fill: 'none', stroke: INK, sw: width + OUTLINE * 1.6, solid })
    this.path(d, { fill: 'none', stroke: color, sw: width })
  }
  line(d: Cmd[], width = 2.6, color = INK, opacity?: number, solid?: boolean): void {
    this.path(d, { fill: 'none', stroke: color, sw: width, ...(opacity !== undefined ? { opacity } : {}), ...(solid ? { solid } : {}) })
  }
}

const solidInk = (fill: string, solid = true): Paint => ({ fill, stroke: INK, sw: OUTLINE, solid })

/** A rotated ellipse as a path (four cubic arcs). */
function ellipsePath(cx: number, cy: number, rx: number, ry: number, angleDeg: number): Cmd[] {
  const a = (angleDeg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const k = 0.5523
  const p = (x: number, y: number): [number, number] => [cx + x * cos - y * sin, cy + x * sin + y * cos]
  const pts = [
    p(rx, 0),
    p(rx, ry * k),
    p(rx * k, ry),
    p(0, ry),
    p(-rx * k, ry),
    p(-rx, ry * k),
    p(-rx, 0),
    p(-rx, -ry * k),
    p(-rx * k, -ry),
    p(0, -ry),
    p(rx * k, -ry),
    p(rx, -ry * k),
  ]
  const d: Cmd[] = [['M', pts[0]![0], pts[0]![1]]]
  for (let i = 0; i < 4; i++) {
    const c1 = pts[i * 3 + 1]!
    const c2 = pts[i * 3 + 2]!
    const e = pts[(i * 3 + 3) % 12]!
    d.push(['C', c1[0], c1[1], c2[0], c2[1], e[0], e[1]])
  }
  d.push(['Z'])
  return d
}

function polygon(points: readonly [number, number][]): Cmd[] {
  const d: Cmd[] = points.map((p, i): Cmd => [i === 0 ? 'M' : 'L', p[0], p[1]])
  d.push(['Z'])
  return d
}

function star(cx: number, cy: number, outer: number, inner: number, n = 5, rot = -90): Cmd[] {
  const pts: [number, number][] = []
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180
    const r = i % 2 === 0 ? outer : inner
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return polygon(pts)
}

// ---------------------------------------------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------------------------------------------

interface Ctx {
  pen: Pen
  f: Frame
  pal: Palette
  look: SpeciesLook
  t: Traits
  rnd: () => number
}

/** Things on top of the head, drawn behind the body so it covers their roots. */
function drawTopBack(c: Ctx): void {
  const { pen, f, pal, t, look } = c
  const s = t.topScale
  const hx = f.headX
  const hy = f.headY
  const w = f.headW
  switch (look.top) {
    case 'horns': {
      for (const side of [-1, 1] as const) {
        const bx = hx + side * w * 0.8
        const by = hy + 6
        const tip: [number, number] = [hx + side * (w * 0.8 + 10 * s), hy - 14 * s]
        pen.path(
          [
            ['M', bx - side * 5, by],
            ['Q', bx - side * 4, hy - 6 * s, tip[0], tip[1]],
            ['Q', bx + side * 7, hy - 2 * s, bx + side * 5, by + 2],
            ['Z'],
          ],
          solidInk(pal.accentLight),
        )
      }
      return
    }
    case 'horn': {
      pen.path(
        [
          ['M', hx - 6, hy + 5],
          ['Q', hx - 3, hy - 9 * s, hx + 2, hy - 18 * s],
          ['Q', hx + 5, hy - 6 * s, hx + 7, hy + 5],
          ['Z'],
        ],
        solidInk(pal.accentLight),
      )
      return
    }
    case 'ears': {
      for (const side of [-1, 1] as const) {
        const bx = hx + side * w * 0.95
        const tip: [number, number] = [hx + side * (w + 12 * s), hy - 11 * s]
        pen.path(
          [
            ['M', bx - side * 7, hy + 6],
            ['Q', bx, hy - 4 * s, tip[0], tip[1]],
            ['Q', bx + side * 7, hy + 2, bx + side * 4, hy + 12],
            ['Z'],
          ],
          solidInk(pal.body),
        )
        pen.path(
          [
            ['M', bx - side * 3, hy + 6],
            ['Q', bx + side * 1, hy - 1 * s, tip[0] - side * 3, tip[1] + 4],
            ['Q', bx + side * 4, hy + 3, bx + side * 2, hy + 9],
            ['Z'],
          ],
          { fill: pal.accentLight, opacity: 0.9 },
        )
      }
      return
    }
    case 'roundEars': {
      for (const side of [-1, 1] as const) {
        const ex = hx + side * (w + 2)
        const ey = hy + 1
        pen.circle(ex, ey, 8 * s, solidInk(pal.shade))
        pen.circle(ex, ey, 4.2 * s, { fill: pal.light })
      }
      return
    }
    case 'antennae':
    case 'curls': {
      for (const side of [-1, 1] as const) {
        const bx = hx + side * w * 0.5
        const tx = hx + side * (w * 0.5 + 9 * s)
        const ty = hy - 15 * s
        if (look.top === 'curls') {
          pen.line(
            [
              ['M', bx, hy + 4],
              ['C', bx, hy - 8 * s, tx + side * 6, ty - 2, tx, ty + 4],
              ['C', tx - side * 4, ty + 8, tx - side * 6, ty, tx - side * 1, ty - 1],
            ],
            3,
            INK,
            undefined,
            true,
          )
        } else {
          pen.line(
            [
              ['M', bx, hy + 4],
              ['Q', bx + side * 2, hy - 8 * s, tx, ty],
            ],
            3,
            INK,
            undefined,
            true,
          )
          pen.circle(tx, ty, 4.2, solidInk(pal.accent))
        }
      }
      return
    }
    case 'bulb': {
      pen.line(
        [
          ['M', hx, hy + 4],
          ['L', hx, hy - 12 * s],
        ],
        3,
        INK,
        undefined,
        true,
      )
      pen.circle(hx, hy - 12 * s - 4, 5, solidInk(pal.accent))
      pen.circle(hx - 1.6, hy - 12 * s - 5.6, 1.4, { fill: WHITE, opacity: 0.8 })
      return
    }
    case 'mohawk': {
      const n = 4
      const pts: [number, number][] = [[hx - w * 0.7, hy + 6]]
      for (let i = 0; i < n; i++) {
        const x0 = hx - w * 0.7 + (i * (w * 1.4)) / n
        const x1 = hx - w * 0.7 + ((i + 1) * (w * 1.4)) / n
        pts.push([(x0 + x1) / 2 + 2, hy - (10 + (i % 2) * 3) * s])
        pts.push([x1, hy + 2])
      }
      pts.push([hx + w * 0.7, hy + 6])
      pen.path(roundedPoly(pts, 1.5), solidInk(pal.accent))
      return
    }
    case 'spikes': {
      for (const dx of [-w * 0.6, 0, w * 0.6]) {
        const x = hx + dx
        pen.path(
          [
            ['M', x - 6, hy + 5],
            ['Q', x - 2, hy - 6 * s, x, hy - 9 * s],
            ['Q', x + 2, hy - 6 * s, x + 6, hy + 5],
            ['Z'],
          ],
          solidInk(pal.accent),
        )
      }
      return
    }
    case 'tuft': {
      for (const [dx, h] of [
        [-4, 10],
        [0, 13],
        [4, 9],
      ] as const) {
        pen.line(
          [
            ['M', hx + dx * 0.5, hy + 3],
            ['Q', hx + dx, hy - h * 0.6 * s, hx + dx * 2.2, hy - h * s],
          ],
          3,
          INK,
          undefined,
          true,
        )
      }
      return
    }
    case 'sprout': {
      pen.line(
        [
          ['M', hx, hy + 3],
          ['Q', hx - 1, hy - 6, hx + 1, hy - 11 * s],
        ],
        2.8,
        INK,
        undefined,
        true,
      )
      pen.path(
        [
          ['M', hx + 1, hy - 8 * s],
          ['Q', hx + 8, hy - 18 * s, hx + 15, hy - 12 * s],
          ['Q', hx + 8, hy - 5 * s, hx + 1, hy - 8 * s],
          ['Z'],
        ],
        solidInk(hsl(110, 55, 48)),
      )
      pen.path(
        [
          ['M', hx, hy - 6 * s],
          ['Q', hx - 6, hy - 14 * s, hx - 12, hy - 9 * s],
          ['Q', hx - 6, hy - 3 * s, hx, hy - 6 * s],
          ['Z'],
        ],
        solidInk(hsl(110, 55, 56)),
      )
      return
    }
    case 'radical': {
      // A crest shaped like a root sign: the tick, the V, the long stroke up and the bar over the head.
      const d: Cmd[] = [
        ['M', hx - 16, hy - 2],
        ['L', hx - 11.5, hy - 6],
        ['L', hx - 6, hy + 2],
        ['L', hx + 1, hy - 15 * s],
        ['L', hx + 17, hy - 15 * s],
        ['L', hx + 17, hy - 11 * s],
      ]
      pen.outlinedLine(d, pal.accent, 4.6)
      return
    }
    case 'hardhat':
    case 'beam':
    case 'none':
      return
  }
}

/** Things worn on top that sit over the body (the hard hat, the balance beam). */
function drawTopFront(c: Ctx): void {
  const { pen, f, pal, look, t } = c
  const hx = f.headX
  const hy = f.headY
  if (look.top === 'hardhat') {
    pen.path(
      [
        ['M', hx - 17, hy + 7],
        ['C', hx - 16, hy - 9, hx + 16, hy - 9, hx + 17, hy + 7],
        ['Z'],
      ],
      solidInk(GOLD),
    )
    pen.path(
      [
        ['M', hx - 21, hy + 7],
        ['L', hx + 21, hy + 7],
        ['Q', hx + 22, hy + 11, hx + 18, hy + 11],
        ['L', hx - 18, hy + 11],
        ['Q', hx - 22, hy + 11, hx - 21, hy + 7],
        ['Z'],
      ],
      solidInk(GOLD_DARK),
    )
    pen.line(
      [
        ['M', hx, hy - 5],
        ['L', hx, hy + 6],
      ],
      2.4,
      GOLD_DARK,
    )
  }
  if (look.top === 'beam') {
    // A balance on its head, tipped: the post, the beam, a pan on each end.
    const s = t.topScale
    const py = hy - 10 * s
    pen.line(
      [
        ['M', hx, hy + 3],
        ['L', hx, py],
      ],
      3.2,
    )
    const l: [number, number] = [hx - 18, py + 6]
    const r: [number, number] = [hx + 18, py - 6]
    pen.outlinedLine(
      [
        ['M', l[0], l[1]],
        ['L', r[0], r[1]],
      ],
      pal.accent,
      3,
    )
    for (const [x, y] of [l, r]) {
      pen.line(
        [
          ['M', x, y],
          ['L', x - 5.5, y + 8],
          ['M', x, y],
          ['L', x + 5.5, y + 8],
        ],
        1.6,
      )
      pen.path(
        [
          ['M', x - 8, y + 8],
          ['L', x + 8, y + 8],
          ['Q', x + 7, y + 14, x, y + 14],
          ['Q', x - 7, y + 14, x - 8, y + 8],
          ['Z'],
        ],
        solidInk(pal.accentLight),
      )
    }
    pen.path(
      polygon([
        [hx, py - 1],
        [hx + 3.6, py + 5],
        [hx - 3.6, py + 5],
      ]),
      solidInk(INK),
    )
  }
}

function drawArms(c: Ctx, layer: 'back' | 'front'): void {
  const { pen, f, pal, look } = c
  const y = f.cy + 6
  const [left, right] = f.span(y)
  switch (look.arms) {
    case 'stubs':
      if (layer !== 'back') return
      for (const side of [-1, 1] as const) {
        const x = side < 0 ? left : right
        pen.path(ellipsePath(x + side * 2, y + 2, 7, 4.6, side * 28), solidInk(pal.body))
      }
      return
    case 'up':
      if (layer !== 'back') return
      for (const side of [-1, 1] as const) {
        const x = side < 0 ? left : right
        pen.path(ellipsePath(x + side * 4, y - 9, 7.5, 4.4, side * -48), solidInk(pal.body))
      }
      return
    case 'brackets': {
      if (layer !== 'front') return
      // A [ and a ] for arms, held out at the sides.
      for (const side of [-1, 1] as const) {
        const x = side < 0 ? left - 5 : right + 5
        const top = y - 12
        const bot = y + 10
        const lip = side < 0 ? 5 : -5
        pen.outlinedLine(
          [
            ['M', x + lip, top],
            ['L', x, top],
            ['L', x, bot],
            ['L', x + lip, bot],
          ],
          pal.accent,
          3.4,
        )
      }
      return
    }
    case 'crossed': {
      if (layer !== 'front') return
      const cy = f.cy + 13
      pen.path(ellipsePath(f.cx, cy, 15, 4.4, 24), solidInk(pal.body))
      pen.path(ellipsePath(f.cx, cy, 15, 4.4, -24), solidInk(pal.body))
      return
    }
    case 'none':
      return
  }
}

function drawFeet(c: Ctx, layer: 'back' | 'front'): void {
  const { pen, f, pal, look } = c
  switch (look.feet) {
    case 'stubs':
    case 'claws': {
      if (layer !== 'front') return
      for (const side of [-1, 1] as const) {
        const x = f.cx + side * 11
        const y = f.bottom - 1
        pen.ellipse(x, y, 8, 4.6, solidInk(pal.shade))
        if (look.feet === 'claws') {
          for (const dx of [-3.5, 0, 3.5]) {
            pen.line(
              [
                ['M', x + dx, y + 2],
                ['L', x + dx, y + 4.6],
              ],
              1.6,
              WHITE,
            )
          }
        }
      }
      return
    }
    case 'tentacles': {
      if (layer !== 'back') return
      for (const dx of [-15, -5, 5, 15]) {
        const x = f.cx + dx
        const top = f.bottom - 8
        const wave = dx < 0 ? -1 : 1
        pen.path(
          [
            ['M', x - 4, top],
            ['C', x - 5, top + 6, x + wave * 4, top + 8, x + wave * 2, top + 13],
            ['Q', x + wave * 1, top + 15, x + wave * -1, top + 13],
            ['C', x + wave * 1, top + 9, x + 4, top + 6, x + 4, top],
            ['Z'],
          ],
          solidInk(pal.shade),
        )
      }
      return
    }
    case 'skate': {
      if (layer !== 'front') return
      const y = f.bottom + 2
      pen.path(
        [
          ['M', f.cx - 22, y - 2],
          ['L', f.cx + 22, y - 2],
          ['Q', f.cx + 27, y - 2, f.cx + 27, y - 5],
          ['L', f.cx + 27, y + 1],
          ['Q', f.cx + 26, y + 3, f.cx + 22, y + 3],
          ['L', f.cx - 22, y + 3],
          ['Q', f.cx - 26, y + 3, f.cx - 27, y + 1],
          ['L', f.cx - 27, y - 5],
          ['Q', f.cx - 27, y - 2, f.cx - 22, y - 2],
          ['Z'],
        ],
        solidInk(c.pal.accent),
      )
      for (const dx of [-15, 15]) pen.circle(f.cx + dx, y + 6, 3, solidInk(WHITE))
      return
    }
    case 'none':
      return
  }
}

function drawBody(c: Ctx): void {
  const { pen, f, pal, look } = c
  const dash = look.mark === 'dashed' ? [7, 4] : undefined
  pen.path(f.outline, { fill: pal.body, stroke: INK, sw: OUTLINE, solid: true, body: true, ...(dash ? { dash } : {}) })
  if (look.mark === 'split' && f.oval) {
    // Half the body in the accent colour: a sign flipped.
    pen.path(ovalHalf(f.oval, 1), { fill: hsl(look.accent, 62, 60) })
    pen.path(f.outline, { fill: 'none', stroke: INK, sw: OUTLINE })
  }
  // A soft highlight on the upper left.
  const hy = f.top + (f.eyeY - f.top) * 0.45
  const [l] = f.span(hy)
  pen.path(ellipsePath(Math.max(l + 7, f.cx - f.rx * 0.48), hy + 2, 5.5, 3, -30), { fill: WHITE, opacity: 0.32 })
}

function insideSpot(c: Ctx, angle: number, radial: number): [number, number] {
  const { f } = c
  const y = f.cy + Math.sin(angle) * f.ry * radial
  const [l, r] = f.span(y)
  const half = (r - l) / 2
  const mid = (r + l) / 2
  return [mid + Math.cos(angle) * half * radial, y]
}

function drawPattern(c: Ctx): void {
  const { pen, f, t, rnd } = c
  const tint: Paint = { fill: INK, opacity: 0.22 }
  switch (t.pattern) {
    case 'spots': {
      const n = 3 + Math.floor(rnd() * 3)
      for (let i = 0; i < n; i++) {
        // On the sides and below the face, never over the eyes.
        const a = (Math.PI * (0.12 + (0.76 * (i + rnd() * 0.6)) / n))
        const [x, y] = insideSpot(c, a, 0.66 + rnd() * 0.12)
        pen.circle(x, y, 2.8 + rnd() * 2, tint)
      }
      return
    }
    case 'stripes': {
      for (const k of [0.42, 0.62, 0.8]) {
        const y = f.cy + f.ry * k
        const [l, r] = f.span(y)
        if (r - l < 12) continue
        for (const side of [-1, 1] as const) {
          const edge = side < 0 ? l + 1.5 : r - 1.5
          pen.line(
            [
              ['M', edge, y - 2],
              ['Q', edge - side * 4, y - 1, edge - side * 7.5, y + 1.5],
            ],
            3,
            INK,
            0.26,
          )
        }
      }
      return
    }
    case 'belly': {
      const y = f.cy + f.ry * 0.42
      const [l, r] = f.span(y)
      const rx = Math.min(f.rx * 0.5, (r - l) / 2 - 3)
      pen.ellipse(f.faceX, y, rx, f.ry * 0.3, { fill: WHITE, opacity: 0.4 })
      return
    }
    case 'freckles': {
      const xs = [f.faceX - f.eyeDX, f.faceX + f.eyeDX]
      for (const x of xs) {
        const y = f.eyeY + f.eyeR + 4
        for (const dx of [-2.6, 0, 2.6]) pen.circle(x + dx, y + (dx === 0 ? 1.4 : 0), 0.9, { fill: INK, opacity: 0.35 })
      }
      return
    }
    case 'zigzag': {
      const y = f.cy + f.ry * 0.62
      const [l, r] = f.span(y)
      const x0 = l + 4
      const x1 = r - 4
      const n = 6
      const d: Cmd[] = [['M', x0, y]]
      for (let i = 1; i <= n; i++) d.push(['L', x0 + ((x1 - x0) * i) / n, y + (i % 2 === 1 ? -3.2 : 0)])
      pen.line(d, 2.8, WHITE, 0.75)
      return
    }
    case 'patch': {
      const y = f.cy - f.ry * 0.05
      const [l] = f.span(y)
      pen.circle(l + 8, y, 5.5, { fill: WHITE, opacity: 0.4 })
      return
    }
    case 'none':
      return
  }
}

/** Where the eyes go for 1, 2 or 3 eyes. */
function eyeSpots(c: Ctx): { x: number; y: number; r: number }[] {
  const { f, t } = c
  if (t.eyes === 1) return [{ x: f.faceX, y: f.eyeY, r: f.eyeR * 1.35 }]
  const two = [
    { x: f.faceX - f.eyeDX, y: f.eyeY, r: f.eyeR },
    { x: f.faceX + f.eyeDX, y: f.eyeY, r: f.eyeR },
  ]
  if (t.eyes === 2) return two
  return [
    { x: f.faceX - f.eyeDX - 1, y: f.eyeY + 1.5, r: f.eyeR * 0.88 },
    { x: f.faceX + f.eyeDX + 1, y: f.eyeY + 1.5, r: f.eyeR * 0.88 },
    { x: f.faceX, y: f.eyeY - f.eyeR * 1.35, r: f.eyeR * 0.7 },
  ]
}

function drawEye(c: Ctx, e: { x: number; y: number; r: number }, index: number): void {
  const { pen, pal, t } = c
  let style: EyeStyle = c.look.eyes
  if (style === 'squint' && index !== 0) style = 'round'
  if (style === 'mismatch') style = index === 1 ? 'mismatch' : 'round'
  const { x, y } = e
  const r = style === 'wide' ? e.r * 1.15 : e.r
  const look = style === 'side' ? 1 : t.look
  const px = x + look * r * 0.28
  const pupil = style === 'wide' ? r * 0.36 : r * 0.47
  const eyeWhite = () => {
    pen.circle(x, y, r, { fill: WHITE, stroke: INK, sw: 2.4 })
  }
  const pupilAt = (cx: number, cy: number, pr: number) => {
    pen.circle(cx, cy, pr, { fill: INK })
    pen.circle(cx - pr * 0.35, cy - pr * 0.4, pr * 0.34, { fill: WHITE })
  }
  switch (style) {
    case 'round':
    case 'wide':
    case 'side':
      eyeWhite()
      pupilAt(px, y + (style === 'side' ? 0.5 : 0.6), pupil)
      return
    case 'half': {
      eyeWhite()
      pupilAt(px, y + r * 0.3, pupil)
      // The lid: the top half of the eye in the body's shade, its edge a little below the middle.
      pen.path(
        [
          ['M', x - r - 0.6, y + r * 0.05],
          ['C', x - r - 0.6, y - r * 1.38, x + r + 0.6, y - r * 1.38, x + r + 0.6, y + r * 0.05],
          ['Z'],
        ],
        { fill: pal.shade, stroke: INK, sw: 2.2 },
      )
      return
    }
    case 'angry': {
      eyeWhite()
      pupilAt(px, y + 1, pupil)
      const inward = x < c.f.faceX ? 1 : -1
      if (c.t.eyes === 1) {
        pen.line(
          [
            ['M', x - r - 1, y - r - 2],
            ['L', x, y - r + 1.5],
            ['L', x + r + 1, y - r - 2],
          ],
          3,
        )
      } else {
        pen.line(
          [
            ['M', x - inward * (r + 1), y - r - 3.5],
            ['L', x + inward * (r * 0.7), y - r + 0.5],
          ],
          3.2,
        )
      }
      return
    }
    case 'squint':
      pen.line(
        [
          ['M', x - r, y + 0.5],
          ['Q', x, y - r * 0.7, x + r, y + 0.5],
        ],
        3,
      )
      pen.line(
        [
          ['M', x - r * 0.8, y + 2.5],
          ['L', x + r * 0.8, y + 2.5],
        ],
        2,
      )
      return
    case 'sleepy':
      pen.line(
        [
          ['M', x - r, y - 0.5],
          ['Q', x, y + r * 0.9, x + r, y - 0.5],
        ],
        3,
      )
      for (const dx of [-0.65, 0, 0.65]) {
        pen.line(
          [
            ['M', x + dx * r, y + r * (dx === 0 ? 0.42 : 0.3)],
            ['L', x + dx * r * 1.25, y + r * 0.85],
          ],
          1.6,
        )
      }
      return
    case 'hollow':
      pen.ellipse(x, y, r * 0.78, r * 1.05, { fill: INK, opacity: 0.88 })
      pen.circle(x - r * 0.25, y - r * 0.38, r * 0.2, { fill: WHITE, opacity: 0.85 })
      return
    case 'mismatch':
      pen.line(
        [
          ['M', x - r * 0.75, y - r * 0.75],
          ['L', x + r * 0.75, y + r * 0.75],
          ['M', x + r * 0.75, y - r * 0.75],
          ['L', x - r * 0.75, y + r * 0.75],
        ],
        3,
      )
      return
    case 'spiral': {
      eyeWhite()
      const d: Cmd[] = [['M', x, y]]
      const turns = 1.75
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        const a = (i / steps) * turns * Math.PI * 2
        const rr = (i / steps) * r * 0.78
        d.push(['L', x + Math.cos(a) * rr, y + Math.sin(a) * rr])
      }
      pen.line(d, 1.7)
      return
    }
  }
}

function drawEyes(c: Ctx): void {
  eyeSpots(c).forEach((e, i) => drawEye(c, e, i))
}

function drawMouth(c: Ctx): void {
  const { pen, f, t, look } = c
  const x = f.faceX
  const y = f.mouthY
  const w = f.mouthW * t.mouthScale
  const h = w / 2
  switch (look.mouth) {
    case 'smirk':
      pen.line(
        [
          ['M', x - h, y - 0.5],
          ['Q', x - 1, y + 5, x + h, y - 3.5],
        ],
        2.8,
      )
      pen.line(
        [
          ['M', x + h - 1.5, y - 5],
          ['L', x + h + 1.2, y - 2.6],
        ],
        2.2,
      )
      return
    case 'grin':
    case 'tongue': {
      pen.path(
        [
          ['M', x - h, y - 1.5],
          ['Q', x, y - 0.5, x + h, y - 1.5],
          ['Q', x + h - 1, y + h * 1.05, x, y + h * 1.05],
          ['Q', x - h + 1, y + h * 1.05, x - h, y - 1.5],
          ['Z'],
        ],
        { fill: MOUTH, stroke: INK, sw: 2.4 },
      )
      if (look.mouth === 'grin') {
        pen.ellipse(x, y + h * 0.72, h * 0.5, h * 0.24, { fill: TONGUE })
      } else {
        pen.path(
          [
            ['M', x - h * 0.42, y + h * 0.5],
            ['L', x + h * 0.42, y + h * 0.5],
            ['L', x + h * 0.42, y + h * 1.3],
            ['Q', x + h * 0.42, y + h * 1.8, x, y + h * 1.8],
            ['Q', x - h * 0.42, y + h * 1.8, x - h * 0.42, y + h * 1.3],
            ['Z'],
          ],
          { fill: TONGUE, stroke: INK, sw: 2 },
        )
        pen.line(
          [
            ['M', x, y + h * 0.8],
            ['L', x, y + h * 1.35],
          ],
          1.2,
          MOUTH,
          0.6,
        )
      }
      return
    }
    case 'fangs': {
      pen.line(
        [
          ['M', x - h, y - 1],
          ['Q', x, y + 5, x + h, y - 1],
        ],
        2.8,
      )
      for (const side of [-1, 1] as const) {
        const fx = x + side * h * 0.45
        pen.path(
          polygon([
            [fx - 2.2, y + 1.2],
            [fx + 2.2, y + 1.4],
            [fx, y + 6.2],
          ]),
          { fill: WHITE, stroke: INK, sw: 1.6 },
        )
      }
      return
    }
    case 'zigzag': {
      const d: Cmd[] = [['M', x - h, y]]
      const n = 5
      for (let i = 1; i <= n; i++) d.push(['L', x - h + (w * i) / n, y + (i % 2 === 1 ? 3 : 0)])
      pen.line(d, 2.6)
      return
    }
    case 'o':
      pen.ellipse(x, y + 1.5, 3.6, 4.4, { fill: MOUTH, stroke: INK, sw: 2.2 })
      return
    case 'flat':
      pen.line(
        [
          ['M', x - h * 0.8, y + 1],
          ['L', x + h * 0.8, y + 0.2],
        ],
        2.8,
      )
      return
    case 'teeth': {
      const top = y - 2
      const bot = y + h * 0.95
      pen.path(
        [
          ['M', x - h, top],
          ['L', x + h, top],
          ['Q', x + h, bot, x, bot],
          ['Q', x - h, bot, x - h, top],
          ['Z'],
        ],
        { fill: MOUTH, stroke: INK, sw: 2.4 },
      )
      const tw = w / 4
      for (let i = 0; i < 4; i++) {
        const tx = x - h + i * tw
        pen.path(
          [
            ['M', tx + 0.6, top + 0.8],
            ['L', tx + tw - 0.6, top + 0.8],
            ['L', tx + tw - 0.9, top + 3.6],
            ['L', tx + 0.9, top + 3.6],
            ['Z'],
          ],
          { fill: WHITE },
        )
      }
      return
    }
    case 'buck': {
      pen.line(
        [
          ['M', x - h, y - 1],
          ['Q', x, y + 4, x + h, y - 1],
        ],
        2.8,
      )
      for (const dx of [-2.3, 2.3]) {
        pen.path(
          [
            ['M', x + dx - 2, y + 1.6],
            ['L', x + dx + 2, y + 1.6],
            ['L', x + dx + 2, y + 6],
            ['L', x + dx - 2, y + 6],
            ['Z'],
          ],
          { fill: WHITE, stroke: INK, sw: 1.6 },
        )
      }
      return
    }
  }
}

/**
 * The layers a species' sign is drawn in: behind the body, on the body under the face, on the belly in front of the
 * feet, or in front of everything.
 */
type MarkLayer = 'back' | 'body' | 'belly' | 'front'

/** The species' own sign. */
function drawMark(c: Ctx, layer: MarkLayer): void {
  const { pen, f, pal, look } = c
  // Below the mouth and above the feet.
  const bellyY = (f.mouthY + f.mouthW * 0.55 + (f.bottom - 5)) / 2
  switch (look.mark) {
    case 'split':
      if (layer !== 'body') return
      // A plus and a minus, one on each cheek.
      pen.line(
        [
          ['M', f.faceX - f.eyeDX - 9, f.eyeY + 10],
          ['L', f.faceX - f.eyeDX - 3, f.eyeY + 10],
          ['M', f.faceX - f.eyeDX - 6, f.eyeY + 7],
          ['L', f.faceX - f.eyeDX - 6, f.eyeY + 13],
        ],
        2.4,
        WHITE,
        0.85,
      )
      pen.line(
        [
          ['M', f.faceX + f.eyeDX + 3, f.eyeY + 10],
          ['L', f.faceX + f.eyeDX + 9, f.eyeY + 10],
        ],
        2.4,
        WHITE,
        0.85,
      )
      return
    case 'cut':
      if (layer !== 'body') return
      pen.path(
        [
          ['M', 58, 39],
          ['L', 70, 51],
        ],
        { fill: 'none', stroke: INK, sw: 1.6, dash: [2.5, 2.5], opacity: 0.55 },
      )
      return
    case 'fraction':
      if (layer !== 'belly') return
      // A division sign on the belly.
      pen.line(
        [
          ['M', f.cx - 6, bellyY],
          ['L', f.cx + 6, bellyY],
        ],
        2.6,
        WHITE,
        0.9,
      )
      pen.circle(f.cx, bellyY - 4.2, 1.6, { fill: WHITE, opacity: 0.9 })
      pen.circle(f.cx, bellyY + 4.2, 1.6, { fill: WHITE, opacity: 0.9 })
      return
    case 'superscript': {
      if (layer !== 'front') return
      // A little exponent 2 floating up at the right.
      const x = Math.min(84, f.cx + f.rx + 2)
      const y = f.top + 2
      pen.circle(x, y, 8, solidInk(pal.accentLight))
      pen.line(
        [
          ['M', x - 3.2, y - 1.8],
          ['Q', x - 3, y - 5, x, y - 5],
          ['Q', x + 3.2, y - 5, x + 3.2, y - 2.2],
          ['Q', x + 3.2, y + 0.2, x - 3.4, y + 4.4],
          ['L', x + 3.6, y + 4.4],
        ],
        2.2,
      )
      return
    }
    case 'rings': {
      if (layer !== 'body') return
      // The log's cut end, with its rings, and a crack down from the top.
      pen.ellipse(21, 60, 7.5, 20, { fill: hsl(36, 60, 72), stroke: INK, sw: 2.4 })
      pen.ellipse(21, 60, 4.4, 12, { fill: 'none', stroke: hsl(26, 45, 45), sw: 1.6 })
      pen.ellipse(21, 60, 1.8, 5, { fill: 'none', stroke: hsl(26, 45, 45), sw: 1.4 })
      pen.line(
        [
          ['M', 46, 39],
          ['L', 43, 45],
          ['L', 47, 49],
          ['L', 44, 55],
        ],
        2,
      )
      for (const y of [72, 77]) {
        pen.line(
          [
            ['M', 36, y],
            ['Q', 46, y + 1.5, 56, y],
          ],
          1.6,
          INK,
          0.3,
        )
      }
      return
    }
    case 'mask': {
      if (layer !== 'body') return
      const y = f.eyeY
      const [l, r] = f.span(y)
      pen.path(
        [
          ['M', l + 1, y - 2],
          ['Q', f.cx, y - 13, r - 1, y - 2],
          ['Q', r - 1, y + 9, f.cx + 4, y + 7],
          ['Q', f.cx, y + 4, f.cx - 4, y + 7],
          ['Q', l + 1, y + 9, l + 1, y - 2],
          ['Z'],
        ],
        { fill: INK, opacity: 0.92 },
      )
      // The mask's ties flying out at the side.
      pen.path(
        [
          ['M', r - 1, y - 2],
          ['Q', r + 6, y - 6, r + 9, y - 3],
          ['Q', r + 5, y - 1, r - 1, y + 1],
          ['Z'],
        ],
        { fill: INK, opacity: 0.92 },
      )
      return
    }
    case 'coin': {
      if (layer !== 'belly') return
      const y = bellyY
      pen.circle(f.cx, y, 7.5, solidInk(GOLD, false))
      pen.circle(f.cx - 2.6, y - 2.6, 1.5, { fill: 'none', stroke: GOLD_DARK, sw: 1.4 })
      pen.circle(f.cx + 2.6, y + 2.6, 1.5, { fill: 'none', stroke: GOLD_DARK, sw: 1.4 })
      pen.line(
        [
          ['M', f.cx + 3.4, y - 3.8],
          ['L', f.cx - 3.4, y + 3.8],
        ],
        1.5,
        GOLD_DARK,
      )
      return
    }
    case 'fence': {
      if (layer !== 'front') return
      // A picket fence across the front, the monster behind it mid-jump.
      const y0 = f.bottom - 12
      const y1 = f.bottom + 5
      const xs = [26, 38, 50, 62, 74]
      pen.path(
        [
          ['M', 20, y0 + 5],
          ['L', 80, y0 + 5],
          ['L', 80, y0 + 9],
          ['L', 20, y0 + 9],
          ['Z'],
        ],
        solidInk(hsl(36, 50, 88)),
      )
      for (const x of xs) {
        pen.path(
          [
            ['M', x - 3.6, y1],
            ['L', x - 3.6, y0],
            ['L', x, y0 - 4.5],
            ['L', x + 3.6, y0],
            ['L', x + 3.6, y1],
            ['Z'],
          ],
          solidInk(hsl(36, 50, 94)),
        )
      }
      return
    }
    case 'monocle': {
      if (layer !== 'front') return
      const spots = eyeSpots(c)
      const e = spots[spots.length > 1 ? 1 : 0]!
      const r = e.r + 2.8
      pen.circle(e.x, e.y, r, { fill: 'none', stroke: GOLD_DARK, sw: 2.4 })
      pen.path(
        [
          ['M', e.x + r * 0.7, e.y + r * 0.7],
          ['Q', e.x + r + 2, e.y + r + 8, e.x + r - 2, e.y + r + 14],
        ],
        { fill: 'none', stroke: GOLD_DARK, sw: 1.4, dash: [1.6, 1.6] },
      )
      return
    }
    case 'speed': {
      if (layer !== 'back') return
      // A shifted copy of itself, and speed lines: it has just slid over.
      pen.path(
        f.outline.map((cmd) => skewCmd(cmd, (x, y) => [x - 7, y])),
        { fill: pal.light, opacity: 0.55 },
      )
      for (const [y, len] of [
        [48, 9],
        [58, 12],
        [68, 8],
      ] as const) {
        pen.line(
          [
            ['M', 10, y],
            ['L', 10 + len, y],
          ],
          2.6,
          INK,
          0.45,
        )
      }
      return
    }
    case 'stitches': {
      if (layer !== 'body') return
      // A patch of another colour sewn on, its seam stitched.
      const x = f.cx + 6
      pen.path(
        [
          ['M', x, f.top + 1.5],
          ['L', 74.5, f.top + 1.5],
          ['L', 74.5, f.cy - 5],
          ['L', x, f.cy - 5],
          ['Z'],
        ],
        { fill: pal.accentLight, opacity: 0.85 },
      )
      pen.path(
        [
          ['M', x, f.top + 2],
          ['L', x, f.cy - 5],
          ['L', 74, f.cy - 5],
        ],
        { fill: 'none', stroke: INK, sw: 1.4, dash: [2, 2] },
      )
      for (let y = f.top + 5; y < f.cy - 6; y += 4.5) {
        pen.line(
          [
            ['M', x - 1.8, y],
            ['L', x + 1.8, y],
          ],
          1.4,
        )
      }
      return
    }
    case 'bolts': {
      if (layer !== 'back') return
      for (const side of [-1, 1] as const) {
        const x = side < 0 ? 19 : 81
        const y = f.cy + 2
        pen.path(
          [
            ['M', x - 3.5, y - 3.5],
            ['L', x + 3.5, y - 3.5],
            ['L', x + 3.5, y + 3.5],
            ['L', x - 3.5, y + 3.5],
            ['Z'],
          ],
          solidInk(pal.accentLight),
        )
        pen.circle(x + side * 3.6, y, 2.2, solidInk(pal.accent))
      }
      return
    }
    case 'hole': {
      if (layer === 'back') {
        pen.ellipse(f.cx, f.bottom - 1, 31, 7, { fill: INK, solid: true, stroke: INK, sw: OUTLINE })
        return
      }
      if (layer !== 'front') return
      // The near lip of the hole in front of the body, with clods of dirt.
      pen.path(
        [
          ['M', f.cx - 33, f.bottom - 2],
          ['Q', f.cx, f.bottom + 8, f.cx + 33, f.bottom - 2],
          ['Q', f.cx + 34, f.bottom + 5, f.cx + 26, f.bottom + 6.5],
          ['Q', f.cx, f.bottom + 9, f.cx - 26, f.bottom + 6.5],
          ['Q', f.cx - 34, f.bottom + 5, f.cx - 33, f.bottom - 2],
          ['Z'],
        ],
        solidInk(hsl(30, 40, 38)),
      )
      for (const [dx, dy, r] of [
        [-36, -6, 2.4],
        [35, -8, 2],
        [-30, -12, 1.5],
      ] as const) {
        pen.circle(f.cx + dx, f.bottom + dy, r, solidInk(hsl(30, 40, 38)))
      }
      return
    }
    case 'dashed': {
      if (layer !== 'front') return
      // A sparkle: it might not be real.
      const x = Math.min(84, f.cx + f.rx + 1)
      const y = f.top + 2
      pen.path(star(x, y, 7, 2.6, 4, -90), solidInk(GOLD))
      pen.path(star(14.5, f.cy + 14, 4.5, 1.6, 4, -90), solidInk(c.pal.accentLight))
      return
    }
    case 'ruler': {
      if (layer !== 'body') return
      // Tick marks down its left side.
      for (let i = 0; i < 8; i++) {
        const y = f.top + 9 + i * 5
        const [l] = f.span(y)
        pen.line(
          [
            ['M', l + 1.5, y],
            ['L', l + (i % 2 === 0 ? 7 : 4.5), y],
          ],
          1.8,
        )
      }
      return
    }
    case 'arc': {
      if (layer !== 'body') return
      // An angle mark in the bottom left corner.
      pen.path(
        [
          ['M', 37, 81],
          ['Q', 35, 73, 30.5, 71],
        ],
        { fill: 'none', stroke: WHITE, sw: 2.4, opacity: 0.9 },
      )
      pen.circle(33, 77, 1.3, { fill: WHITE, opacity: 0.9 })
      return
    }
    case 'arrow': {
      if (layer !== 'back') return
      // An implies-arrow for a tail, sticking out at the right.
      const y = f.cy + 10
      for (const dy of [-2.6, 2.6]) {
        pen.outlinedLine(
          [
            ['M', f.cx + 18, y + dy],
            ['L', 84, y + dy],
          ],
          pal.accent,
          2.2,
        )
      }
      pen.path(
        polygon([
          [82, y - 7.5],
          [90.5, y],
          [82, y + 7.5],
        ]),
        solidInk(pal.accent),
      )
      return
    }
    case 'therefore': {
      if (layer !== 'belly') return
      // A "therefore" sign (three dots) on the belly, in gold: the reason it took.
      const y = bellyY
      for (const [dx, dy] of [
        [0, -3.5],
        [-4, 3],
        [4, 3],
      ] as const) {
        pen.circle(f.cx + dx, y + dy, 2.3, solidInk(GOLD, false))
      }
      return
    }
    case 'disguise': {
      if (layer !== 'front') return
      // Fake glasses, a big nose and a moustache.
      const spots = eyeSpots(c).slice(0, 2)
      for (const e of spots) pen.circle(e.x, e.y, e.r + 2.4, { fill: 'none', stroke: INK, sw: 3 })
      if (spots.length === 2) {
        pen.line(
          [
            ['M', spots[0]!.x + spots[0]!.r + 2.4, f.eyeY],
            ['L', spots[1]!.x - spots[1]!.r - 2.4, f.eyeY],
          ],
          3,
        )
      }
      const ny = f.eyeY + f.eyeR + 3
      pen.ellipse(f.faceX, ny, 4.4, 3.6, solidInk(hsl(look.hue, look.sat, look.light - 8), false))
      pen.path(
        [
          ['M', f.faceX, ny + 3],
          ['Q', f.faceX - 5, ny + 1.5, f.faceX - 10, ny + 4.5],
          ['Q', f.faceX - 6, ny + 7.5, f.faceX, ny + 5],
          ['Q', f.faceX + 6, ny + 7.5, f.faceX + 10, ny + 4.5],
          ['Q', f.faceX + 5, ny + 1.5, f.faceX, ny + 3],
          ['Z'],
        ],
        { fill: INK },
      )
      return
    }
    case 'swirl': {
      if (layer !== 'belly') return
      const cx = f.cx
      const cy = bellyY
      const d: Cmd[] = [['M', cx, cy]]
      for (let i = 1; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 3.4
        const rr = (i / 14) * 7
        d.push(['L', cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85])
      }
      pen.line(d, 2, WHITE, 0.85)
      return
    }
    case 'zero': {
      if (layer !== 'belly') return
      pen.ellipse(f.cx, bellyY, 6, 8, { fill: pal.light, stroke: INK, sw: 3 })
      pen.ellipse(f.cx, bellyY, 2.2, 4, { fill: pal.shade, stroke: INK, sw: 1.6 })
      return
    }
    case 'case': {
      if (layer !== 'front') return
      // A briefcase held at its side: what it smuggles.
      const x = 72
      const y = f.cy + 8
      pen.path(
        [
          ['M', x + 2, y - 4],
          ['Q', x + 2, y - 9, x + 7, y - 9],
          ['Q', x + 12, y - 9, x + 12, y - 4],
        ],
        { fill: 'none', stroke: INK, sw: 2.4 },
      )
      pen.path(
        [
          ['M', x - 3, y - 4],
          ['L', x + 17, y - 4],
          ['L', x + 17, y + 11],
          ['L', x - 3, y + 11],
          ['Z'],
        ],
        solidInk(hsl(26, 40, 34)),
      )
      pen.line(
        [
          ['M', x - 3, y + 2],
          ['L', x + 17, y + 2],
        ],
        1.4,
        INK,
        0.6,
      )
      pen.path(
        [
          ['M', x + 5, y],
          ['L', x + 9, y],
          ['L', x + 9, y + 4],
          ['L', x + 5, y + 4],
          ['Z'],
        ],
        { fill: GOLD, stroke: INK, sw: 1 },
      )
      return
    }
    case 'orbiters': {
      if (layer !== 'front') return
      // A proton, a neutron and an electron it has pocketed, floating round its head.
      const parts: [number, number, string][] = [
        [16, 38, hsl(2, 70, 58)],
        [84, 34, hsl(212, 70, 58)],
        [86, 54, hsl(0, 0, 78)],
      ]
      for (const [x, y, color] of parts) pen.circle(x, y, 4.2, solidInk(color))
      pen.line(
        [
          ['M', 14, 38],
          ['L', 18, 38],
          ['M', 16, 36],
          ['L', 16, 40],
        ],
        1.4,
        WHITE,
      )
      pen.line(
        [
          ['M', 82, 34],
          ['L', 86, 34],
        ],
        1.4,
        WHITE,
      )
      return
    }
    case 'orbit': {
      const ring = ellipsePath(f.cx, f.cy + 14, 36, 8, -10)
      if (layer === 'back') {
        pen.path(ring, { fill: 'none', stroke: INK, sw: 5.2, solid: true })
        pen.path(ring, { fill: 'none', stroke: pal.accent, sw: 2.6 })
        return
      }
      if (layer !== 'front') return
      // The front half of the ring passes over the body; an electron rides it.
      const a = (-10 * Math.PI) / 180
      const pt = (deg: number): [number, number] => {
        const t = (deg * Math.PI) / 180
        const x = Math.cos(t) * 36
        const y = Math.sin(t) * 8
        return [f.cx + x * Math.cos(a) - y * Math.sin(a), f.cy + 14 + x * Math.sin(a) + y * Math.cos(a)]
      }
      const d: Cmd[] = [['M', ...pt(10)]]
      for (let deg = 25; deg <= 170; deg += 15) d.push(['L', ...pt(deg)])
      pen.path(d, { fill: 'none', stroke: INK, sw: 5.2 })
      pen.path(d, { fill: 'none', stroke: pal.accent, sw: 2.6 })
      const [ex, ey] = pt(60)
      pen.circle(ex, ey, 3.4, solidInk(hsl(212, 70, 60)))
      return
    }
    case 'grid': {
      if (layer !== 'belly') return
      // A few cells of the periodic table on its belly.
      const cell = 4.4
      const y = bellyY - cell + 1.5
      const cols = 4
      const x0 = f.cx - (cols * cell) / 2
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < cols; col++) {
          if (row === 0 && (col === 1 || col === 2)) continue
          const x = x0 + col * cell
          const yy = y + row * cell
          pen.path(
            [
              ['M', x, yy],
              ['L', x + cell, yy],
              ['L', x + cell, yy + cell],
              ['L', x, yy + cell],
              ['Z'],
            ],
            { fill: (row + col) % 2 === 0 ? pal.light : WHITE, stroke: INK, sw: 1.2 },
          )
        }
      }
      return
    }
    case 'charges': {
      if (layer !== 'front') return
      // A + on one fist and a − on the other, crossed in front.
      const y = f.cy + 13
      for (const side of [-1, 1] as const) {
        const x = f.cx + side * 14
        const yy = y + side * -6
        pen.circle(x, yy, 4.6, solidInk(side < 0 ? hsl(2, 70, 60) : hsl(212, 70, 60)))
        pen.line(
          side < 0
            ? [
                ['M', x - 2.4, yy],
                ['L', x + 2.4, yy],
                ['M', x, yy - 2.4],
                ['L', x, yy + 2.4],
              ]
            : [
                ['M', x - 2.4, yy],
                ['L', x + 2.4, yy],
              ],
          1.6,
          WHITE,
        )
      }
      return
    }
    case 'nametag': {
      if (layer !== 'belly') return
      // "Hello, my name is" with a scribble for a name.
      const y = bellyY - 5
      const x0 = f.cx - 9
      const x1 = f.cx + 9
      pen.path(
        [
          ['M', x0, y],
          ['L', x1, y],
          ['L', x1, y + 11],
          ['L', x0, y + 11],
          ['Z'],
        ],
        { fill: WHITE, stroke: INK, sw: 1.6 },
      )
      pen.path(
        [
          ['M', x0, y],
          ['L', x1, y],
          ['L', x1, y + 3.4],
          ['L', x0, y + 3.4],
          ['Z'],
        ],
        { fill: hsl(4, 70, 56) },
      )
      pen.line(
        [
          ['M', x0 + 2.5, y + 7.8],
          ['Q', x0 + 5, y + 5, x0 + 7, y + 8],
          ['Q', x0 + 9, y + 10, x0 + 11, y + 6.6],
          ['Q', x0 + 13, y + 5, x0 + 15.5, y + 8],
        ],
        1.3,
      )
      return
    }
    case 'scales':
    case 'none':
      return
  }
}

function drawAccessory(c: Ctx): void {
  const { pen, f, t } = c
  const hx = f.headX
  const hy = f.headY
  const w = Math.max(f.headW, 11)
  const spots = eyeSpots(c)
  const capColor = hsl(c.look.accent + 150, 55, 52)
  switch (t.accessory) {
    case 'beanie': {
      pen.path(
        [
          ['M', hx - w - 2, hy + 8],
          ['C', hx - w - 1, hy - 9, hx + w + 1, hy - 9, hx + w + 2, hy + 8],
          ['Z'],
        ],
        solidInk(capColor),
      )
      pen.path(
        [
          ['M', hx - w - 3, hy + 4],
          ['L', hx + w + 3, hy + 4],
          ['L', hx + w + 3, hy + 10],
          ['L', hx - w - 3, hy + 10],
          ['Z'],
        ],
        solidInk(hsl(c.look.accent + 150, 50, 40)),
      )
      for (let x = hx - w; x <= hx + w; x += 4) {
        pen.line(
          [
            ['M', x, hy + 5.5],
            ['L', x, hy + 8.5],
          ],
          1.2,
          WHITE,
          0.45,
        )
      }
      pen.circle(hx, hy - 5, 3.6, solidInk(WHITE))
      return
    }
    case 'cap': {
      pen.path(
        [
          ['M', hx - w, hy + 6],
          ['C', hx - w, hy - 7, hx + w, hy - 7, hx + w, hy + 6],
          ['Z'],
        ],
        solidInk(capColor),
      )
      // The brim, turned to the side.
      pen.path(
        [
          ['M', hx + w - 3, hy + 3],
          ['Q', hx + w + 9, hy + 1, hx + w + 12, hy + 5],
          ['Q', hx + w + 6, hy + 8, hx + w - 3, hy + 7],
          ['Z'],
        ],
        solidInk(hsl(c.look.accent + 150, 50, 40)),
      )
      pen.circle(hx, hy - 3.6, 1.6, { fill: INK })
      return
    }
    case 'headphones': {
      const y = f.eyeY - 2
      const [l, r] = f.span(y)
      pen.path(
        [
          ['M', l - 1, y],
          ['C', l - 1, f.top - 12, r + 1, f.top - 12, r + 1, y],
        ],
        { fill: 'none', stroke: INK, sw: 5.4, solid: true },
      )
      pen.path(
        [
          ['M', l - 1, y],
          ['C', l - 1, f.top - 12, r + 1, f.top - 12, r + 1, y],
        ],
        { fill: 'none', stroke: capColor, sw: 2.4 },
      )
      for (const x of [l - 1, r + 1]) {
        pen.path(ellipsePath(x, y + 2, 4.6, 7, 0), solidInk(capColor))
      }
      return
    }
    case 'glasses': {
      const eyes = spots.slice(0, 2)
      for (const e of eyes) pen.circle(e.x, e.y, e.r + 2.2, { fill: 'none', stroke: INK, sw: 2.2 })
      if (eyes.length === 2) {
        pen.line(
          [
            ['M', eyes[0]!.x + eyes[0]!.r + 2.2, eyes[0]!.y - 1],
            ['Q', f.faceX, eyes[0]!.y - 4, eyes[1]!.x - eyes[1]!.r - 2.2, eyes[1]!.y - 1],
          ],
          2,
        )
      }
      return
    }
    case 'shades': {
      const eyes = spots.slice(0, 2)
      for (const e of eyes) {
        pen.path(
          [
            ['M', e.x - e.r - 2.4, e.y - e.r * 0.55],
            ['L', e.x + e.r + 2.4, e.y - e.r * 0.55],
            ['Q', e.x + e.r + 2, e.y + e.r * 1.1, e.x, e.y + e.r * 1.05],
            ['Q', e.x - e.r - 2, e.y + e.r * 1.1, e.x - e.r - 2.4, e.y - e.r * 0.55],
            ['Z'],
          ],
          { fill: INK, stroke: INK, sw: 1.4 },
        )
        pen.line(
          [
            ['M', e.x - e.r * 0.6, e.y - e.r * 0.1],
            ['L', e.x - e.r * 0.1, e.y + e.r * 0.5],
          ],
          1.4,
          WHITE,
          0.6,
        )
      }
      if (eyes.length === 2) {
        pen.line(
          [
            ['M', eyes[0]!.x + eyes[0]!.r + 2, eyes[0]!.y - eyes[0]!.r * 0.4],
            ['L', eyes[1]!.x - eyes[1]!.r - 2, eyes[1]!.y - eyes[1]!.r * 0.4],
          ],
          2,
        )
      }
      return
    }
    case 'bandaid': {
      const e = spots[spots.length > 1 ? 1 : 0]!
      const x = e.x + 3
      const y = e.y + e.r + 6
      pen.path(ellipsePath(x, y, 6.2, 2.6, -28), { fill: hsl(30, 60, 80), stroke: INK, sw: 1.4 })
      pen.path(ellipsePath(x, y, 6.2, 2.6, 28), { fill: hsl(30, 60, 80), stroke: INK, sw: 1.4 })
      pen.circle(x, y, 1, { fill: INK, opacity: 0.4 })
      return
    }
    case 'earring': {
      const y = f.eyeY + 8
      const [, r] = f.span(y)
      pen.circle(r + 1.6, y + 3.2, 2.8, { fill: 'none', stroke: GOLD_DARK, sw: 1.8 })
      return
    }
    case 'headband': {
      const y = Math.max(f.top + 6, f.eyeY - f.eyeR - 6)
      const [l, r] = f.span(y + 2)
      if (r - l < 16) return
      pen.path(
        [
          ['M', l, y],
          ['Q', f.cx, y - 3, r, y],
          ['L', r, y + 4.5],
          ['Q', f.cx, y + 1.5, l, y + 4.5],
          ['Z'],
        ],
        { fill: WHITE, stroke: INK, sw: 1.6 },
      )
      pen.path(
        [
          ['M', l, y + 1.4],
          ['Q', f.cx, y - 1.6, r, y + 1.4],
          ['L', r, y + 3],
          ['Q', f.cx, y, l, y + 3],
          ['Z'],
        ],
        { fill: capColor },
      )
      return
    }
    case 'pencil': {
      // Tucked behind its head, sticking up at the right.
      const x = hx + w * 0.7
      const y = hy + 4
      const a = (35 * Math.PI) / 180
      const dir: [number, number] = [Math.sin(a), -Math.cos(a)]
      const n: [number, number] = [Math.cos(a), Math.sin(a)]
      const p = (along: number, across: number): [number, number] => [x + dir[0] * along + n[0] * across, y + dir[1] * along + n[1] * across]
      pen.path(polygon([p(-2, -2.6), p(16, -2.6), p(16, 2.6), p(-2, 2.6)]), solidInk(GOLD))
      pen.path(polygon([p(16, -2.6), p(20, -2.6), p(20, 2.6), p(16, 2.6)]), solidInk(TONGUE))
      pen.path(polygon([p(-2, -2.6), p(-2, 2.6), p(-7, 0)]), solidInk(hsl(36, 60, 80)))
      return
    }
    case 'sticker': {
      const y = f.cy + f.ry * 0.5
      const [, r] = f.span(y)
      pen.path(star(r - 8, y, 5.4, 2.4), { fill: GOLD, stroke: INK, sw: 1.6 })
      return
    }
    case 'none':
      return
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------------------------------------------

function flipShape(s: Shape): Shape {
  const fy = (y: number) => 100 - y
  if (s.kind === 'circle') return { ...s, cy: fy(s.cy) }
  if (s.kind === 'ellipse') return { ...s, cy: fy(s.cy) }
  return { ...s, d: s.d.map((c) => skewCmd(c, (x, y) => [x, fy(y)])) }
}

function questionMark(pen: Pen, f: Frame): void {
  const x = f.faceX
  const y = f.cy - 4
  const d: Cmd[] = [
    ['M', x - 7, y - 6],
    ['Q', x - 7, y - 14, x, y - 14],
    ['Q', x + 7.5, y - 14, x + 7.5, y - 7],
    ['Q', x + 7.5, y - 2, x, y + 1],
    ['L', x, y + 6],
  ]
  pen.path(d, { fill: 'none', stroke: hsl(230, 30, 88), sw: 5.4 })
  pen.circle(x, y + 13, 3.2, { fill: hsl(230, 30, 88) })
}

function draw(species: Species, t: Traits, seed: number, opts: ArtOptions): MonsterArt {
  const look = species.look
  const f = frameOf(look.body, look.face === 'high')
  const pen = new Pen()
  const c: Ctx = { pen, f, pal: paletteOf(look, t), look, t, rnd: generator(seed) }

  drawTopBack(c)
  drawMark(c, 'back')
  drawArms(c, 'back')
  drawFeet(c, 'back')
  drawBody(c)
  if (!opts.silhouette) {
    drawPattern(c)
    drawMark(c, 'body')
  }
  drawFeet(c, 'front')
  if (!opts.silhouette) drawMark(c, 'belly')
  drawArms(c, 'front')
  drawTopFront(c)
  if (!opts.silhouette) {
    drawEyes(c)
    drawMouth(c)
  }
  drawMark(c, 'front')
  if (!opts.silhouette) drawAccessory(c)

  let shapes = pen.shapes
  if (look.flip) shapes = shapes.map(flipShape)

  if (opts.silhouette) {
    // Only the outline, in one dark colour, with a "?" over it.
    shapes = shapes.filter((s) => s.solid).map((s) => ({ ...s, fill: s.fill === 'none' ? 'none' : SHADOW_SILHOUETTE, stroke: SHADOW_SILHOUETTE, opacity: undefined, dash: undefined }))
    const q = new Pen()
    questionMark(q, look.flip ? { ...f, cy: 103 - f.cy } : f)
    shapes = [...shapes, ...q.shapes]
  }

  const ground: Shape = { kind: 'ellipse', cx: 50, cy: 92, rx: 25, ry: 3.4, fill: INK, opacity: 0.14 }
  shapes = [ground, ...shapes]

  if (opts.sticker) {
    // A white border round the outline, drawn under everything (sticker art).
    const border = shapes
      .filter((s) => s.solid)
      .map((s): Shape => ({ ...s, fill: s.fill === 'none' ? 'none' : WHITE, stroke: WHITE, sw: (s.sw ?? 0) + 6, opacity: undefined, dash: undefined, solid: undefined, body: undefined }))
    shapes = [ground, ...border, ...shapes.slice(1)]
  }
  return { shapes }
}

/**
 * A variant's picture (the catalog id), or null when the id is not a monster. Its silhouette is its species' own (a
 * variant not seen yet gives nothing of itself away).
 */
export function monsterArt(patternId: string, opts: ArtOptions = {}): MonsterArt | null {
  const species = speciesOf(patternId)
  if (!species) return null
  if (opts.silhouette) return speciesArt(species.id, opts)
  const traits = speciesTraits(species).get(patternId)!
  return draw(species, traits, hashString(`${species.id}:${patternId}:extras`), opts)
}

/** A species' own picture, with nothing a variant adds (its header in the collection). */
export function speciesArt(speciesId: string, opts: ArtOptions = {}): MonsterArt | null {
  const species = speciesById(speciesId)
  if (!species) return null
  return draw(species, PLAIN, hashString(`${species.id}:plain`), opts)
}

// ---------------------------------------------------------------------------------------------------------------
// Markup and bounds (tests, and anything that wants the SVG as text)
// ---------------------------------------------------------------------------------------------------------------

/** A number as SVG writes it: two decimals at most. */
export function num(v: number): string {
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

export function pathData(d: readonly Cmd[]): string {
  return d.map((c) => (c[0] === 'Z' ? 'Z' : `${c[0]}${c.slice(1).map((v) => num(v as number)).join(' ')}`)).join('')
}

function paintAttrs(s: Paint): string {
  const out = [`fill="${s.fill}"`]
  if (s.stroke) out.push(`stroke="${s.stroke}"`, `stroke-width="${num(s.sw ?? 1)}"`, 'stroke-linecap="round"', 'stroke-linejoin="round"')
  if (s.dash) out.push(`stroke-dasharray="${s.dash.map(num).join(' ')}"`)
  if (s.opacity !== undefined) out.push(`opacity="${num(s.opacity)}"`)
  return out.join(' ')
}

export function shapeMarkup(s: Shape): string {
  if (s.kind === 'circle') return `<circle cx="${num(s.cx)}" cy="${num(s.cy)}" r="${num(s.r)}" ${paintAttrs(s)}/>`
  if (s.kind === 'ellipse') return `<ellipse cx="${num(s.cx)}" cy="${num(s.cy)}" rx="${num(s.rx)}" ry="${num(s.ry)}" ${paintAttrs(s)}/>`
  return `<path d="${pathData(s.d)}" ${paintAttrs(s)}/>`
}

/** The whole picture as SVG text. */
export function artMarkup(art: MonsterArt): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${art.shapes.map(shapeMarkup).join('')}</svg>`
}

/** A shape's box, its stroke included (curves stay inside their control points). */
export function shapeBounds(s: Shape): { x0: number; y0: number; x1: number; y1: number } {
  const half = s.stroke && s.stroke !== 'none' ? (s.sw ?? 1) / 2 : 0
  if (s.kind === 'circle') return { x0: s.cx - s.r - half, y0: s.cy - s.r - half, x1: s.cx + s.r + half, y1: s.cy + s.r + half }
  if (s.kind === 'ellipse') return { x0: s.cx - s.rx - half, y0: s.cy - s.ry - half, x1: s.cx + s.rx + half, y1: s.cy + s.ry + half }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const c of s.d) {
    for (let i = 1; i + 1 < c.length; i += 2) {
      const x = c[i] as number
      const y = c[i + 1] as number
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  return { x0: x0 - half, y0: y0 - half, x1: x1 + half, y1: y1 + half }
}
