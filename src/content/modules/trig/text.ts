/**
 * Text for the trig modules. A "math" string holds KaTeX between dollar signs ("Convert $150^{\circ}$ to radians.");
 * the flow draws each piece with KaTeX and `plain` reads the same string as words for the tutor, the leak checks and
 * the tests. Only the TeX this unit writes is read back: \frac, \sqrt, \pi, \theta, ^{\circ}, powers, \left( \right),
 * \sin … \cot, \cdot, \text, spacing.
 */
import type { Rng } from '@/content/rng'
import { makeRng, mixSeed } from '@/content/rng'
import { anyShows, LogSkip } from '../explog/text'

/** Why draws were skipped, for the generators' own tests (null: not collecting). */
let skipLog: string[] | null = null

export function collectSkips(on: boolean): string[] {
  const out = skipLog ?? []
  skipLog = on ? [] : null
  return out
}

/** The first draw for this seed that passes every check (LogSkip means try the next salt). Deterministic. */
export function trigSearch<T>(seed: number, salt: number, tries: number, build: (rng: Rng) => T): T {
  for (let n = 0; n < tries; n++) {
    try {
      return build(makeRng(mixSeed(seed, salt + n * 97)))
    } catch (e) {
      if (e instanceof LogSkip) {
        skipLog?.push(e.message)
        continue
      }
      throw e
    }
  }
  throw new Error(`no trig problem for seed ${seed} (salt ${salt})`)
}

/** One piece of KaTeX inside a math string. */
export function m(tex: string): string {
  return `$${tex}$`
}

/** Split a math string into text and TeX pieces, in order. */
export function pieces(s: string): { tex: boolean; text: string }[] {
  const out: { tex: boolean; text: string }[] = []
  const parts = s.split('$')
  parts.forEach((p, i) => {
    if (p) out.push({ tex: i % 2 === 1, text: p })
  })
  return out
}

function group(s: string): string {
  return /^[−-]?[\dπθa-z.°²³]+$|^[−-]?\d*√\d+$/i.test(s) ? s : `(${s})`
}

/** The TeX this unit writes, as words: \frac{5\pi}{6} → 5π/6, 150^{\circ} → 150°, \sin\left(x\right) → sin(x). */
export function texPlain(tex: string): string {
  let s = tex
  s = s.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')').replace(/\\left\[/g, '[').replace(/\\right\)/g, ')').replace(/\\right\]/g, ']')
  s = s.replace(/\\text\{([^{}]*)\}/g, '$1')
  s = s.replace(/\^\{\\circ\}/g, '°').replace(/\^\\circ/g, '°')
  s = s.replace(/\\pi/g, 'π').replace(/\\theta/g, 'θ').replace(/\\alpha/g, 'α')
  s = s.replace(/\\(sin|cos|tan|csc|sec|cot)\s*(?=[θA-Za-z0-9])/g, '$1 ').replace(/\\(sin|cos|tan|csc|sec|cot)(?![a-z])/g, '$1')
  s = s.replace(/\\cdot/g, '·').replace(/\\times/g, '×').replace(/\\approx/g, '≈').replace(/\\le(?![a-z])/g, '≤').replace(/\\ge(?![a-z])/g, '≥')
  s = s.replace(/\\(?:,|;|!|quad)/g, ' ')
  s = s.replace(/\^\{2\}/g, '²').replace(/\^2(?!\d)/g, '²').replace(/\^\{3\}/g, '³')
  // Square roots, innermost first: √3, or √(x² + y²) for more than a number.
  for (let i = 0; i < 6 && /\\sqrt\{/.test(s); i++) {
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_m, inner: string) => (/^\d+$/.test(inner) ? `√${inner}` : `√(${inner})`))
  }
  s = s.replace(/\^\{([^{}]*)\}/g, '^$1')
  for (let i = 0; i < 6 && /\\[dt]?frac\{/.test(s); i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => `${group(a.trim())}/${group(b.trim())}`)
  }
  s = s.replace(/[{}]/g, '').replace(/-/g, '−').replace(/\s+/g, ' ')
  return s.trim()
}

/** A math string as words. */
export function plain(s: string): string {
  return pieces(s)
    .map((p) => (p.tex ? texPlain(p.text) : p.text))
    .join('')
}

/** True when a text she sees spells one of these answers; an answer that ends a sentence counts (… = −1/2.). */
export function showsAnswer(texts: readonly string[], forms: readonly string[]): boolean {
  return anyShows(texts.map(plain), forms, { sentenceEnd: true })
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The second half's leak check: `showsAnswer` with √ and π bound to the number they touch, so a side given as 6√2
 * does not show a leg of 6, √3 in a rule does not show a side of 3, and 5π/6 does not show π/6; 6√2 itself, −12 in
 * "(−12, 5)", 240 in "240°" and an answer ending a sentence ("x = 5√3.") still count.
 */
export function showsNumber(texts: readonly string[], forms: readonly string[]): boolean {
  const norm = (s: string) => s.replace(/[−–]/g, '-')
  const words = texts.map((t) => norm(plain(t)))
  return forms.some((form) => {
    const f = norm(form).trim()
    if (!f) return false
    const tight = f.replace(/\s+/g, '')
    const before = '(?<![\\d./A-Za-z_√π])'
    const after = '(?![\\d/A-Za-z√π]|\\.\\d)'
    const tightRe = new RegExp(`${before}${escapeRe(tight)}${after}`)
    const looseRe = new RegExp(`${before}${escapeRe(f.replace(/\s+/g, ' ')).replace(/ /g, '\\s+')}${after}`)
    return words.some((w) => tightRe.test(w.replace(/\s+/g, '')) || looseRe.test(w))
  })
}

/** A minus sign for a sentence. */
export function minus(s: string): string {
  return s.replace(/-/g, '−')
}
