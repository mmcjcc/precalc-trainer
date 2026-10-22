/**
 * Text for the optimization module: numbers as she would type them and as KaTeX, linear and quadratic expressions
 * from exact coefficients, and the math strings of the trig unit ($…$ pieces drawn by KaTeX, read back as words by
 * `plain` for the tutor, the leak checks and the tests).
 */
import { q, qAdd, qMul, qNeg, type Q } from '@/engine/optim'
import { anyShows } from '../explog/text'
import { texPlain } from '../trig/text'

/** One piece of KaTeX inside a math string. */
export function m(tex: string): string {
  return `$${tex}$`
}

/**
 * Split a math string into text and TeX pieces, in order. A dollar sign written \$ (money, inside the math) is part
 * of the TeX, not a delimiter.
 */
export function pieces(s: string): { tex: boolean; text: string }[] {
  const out: { tex: boolean; text: string }[] = []
  let tex = false
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === '\\' && s[i + 1] === '$') {
      cur += '\\$'
      i++
      continue
    }
    if (c === '$') {
      if (cur) out.push({ tex, text: cur })
      cur = ''
      tex = !tex
      continue
    }
    cur += c
  }
  if (cur) out.push({ tex, text: cur })
  return out
}

/** A math string as words: the TeX read back ("\frac{500}{4}" is "500/4", "\$8" is "$8"). */
export function plain(s: string): string {
  return pieces(s)
    .map((p) => (p.tex ? texPlain(p.text.replace(/\\\$/g, '＄').replace(/\{,\}/g, ',')).replace(/＄/g, '$') : p.text))
    .join('')
}

/** True when a text she sees spells one of these answers; an answer that ends a sentence counts (… is 31250.). */
export function showsAnswer(texts: readonly string[], forms: readonly string[]): boolean {
  return anyShows(texts.map(plain), forms, { sentenceEnd: true })
}

const minusSign = (s: string) => s.replace(/[−–]/g, '-')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const BEFORE = '(?<![\\d./A-Za-z_])'
const AFTER_SENTENCE = '(?![\\d/A-Za-z]|\\.\\d)'

/**
 * `showsAnswer` for many texts against the same answers, with each answer's patterns built once: the same rule
 * (a whole token, spaces ignored or kept as spaces, an answer ending a sentence counted), much faster in the sweeps.
 */
export function answerMatcher(forms: readonly string[]): (mathText: string) => boolean {
  const res = forms.map(formPatterns).filter((r): r is FormPatterns => r !== null)
  return (mathText) => {
    const { words, tight } = readBack(mathText)
    return res.some((r) => r.tight.test(tight) || r.loose.test(words))
  }
}

interface FormPatterns {
  tight: RegExp
  loose: RegExp
}

const PATTERNS = new Map<string, FormPatterns | null>()

/** The two patterns of one answer form, built once. */
function formPatterns(f: string): FormPatterns | null {
  const hit = PATTERNS.get(f)
  if (hit !== undefined) return hit
  const tight = minusSign(f).replace(/\s+/g, '')
  let out: FormPatterns | null = null
  if (tight) {
    const loose = minusSign(f).replace(/\s+/g, ' ').trim()
    out = { tight: new RegExp(`${BEFORE}${escapeRe(tight)}${AFTER_SENTENCE}`), loose: new RegExp(`${BEFORE}${escapeRe(loose).replace(/ /g, '\\s+')}${AFTER_SENTENCE}`) }
  }
  if (PATTERNS.size > 20000) PATTERNS.clear()
  PATTERNS.set(f, out)
  return out
}

const READ_BACK = new Map<string, { words: string; tight: string }>()

/** A math string as words, minus signs plain, with and without its spaces (kept: the same texts come back often). */
function readBack(mathText: string): { words: string; tight: string } {
  const hit = READ_BACK.get(mathText)
  if (hit) return hit
  const words = minusSign(plain(mathText))
  const out = { words, tight: words.replace(/\s+/g, '') }
  if (READ_BACK.size > 5000) READ_BACK.clear()
  READ_BACK.set(mathText, out)
  return out
}

const abs = (v: Q): Q => (v.n < 0 ? qNeg(v) : v)

/** The digits of a terminating decimal, or null (100/3 has none). */
export function qDecimal(v: Q, maxPlaces = 6): string | null {
  let d = v.d
  let twos = 0
  let fives = 0
  while (d % 2 === 0) {
    d /= 2
    twos++
  }
  while (d % 5 === 0) {
    d /= 5
    fives++
  }
  if (d !== 1) return null
  const places = Math.max(twos, fives)
  if (places > maxPlaces) return null
  const text = (v.n / v.d).toFixed(places)
  return places > 0 ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

/** As she would type it: "125", "-8", "11.5", or a fraction "100/3". */
export function qTyped(v: Q): string {
  return qDecimal(v, 4) ?? `${v.n}/${v.d}`
}

/** A mixed number in words: "33 1/3", "-1 2/3"; a whole number or a decimal as it is. */
export function qMixed(v: Q): string {
  const dec = qDecimal(v, 4)
  if (dec !== null) return dec
  const a = abs(v)
  const w = Math.floor(a.n / a.d)
  const r = a.n - w * a.d
  const sign = v.n < 0 ? '-' : ''
  return w === 0 ? `${sign}${r}/${a.d}` : `${sign}${w} ${r}/${a.d}`
}

/** Half-up rounding to `places`: "33.33". */
export function qRound(v: Q, places: number): string {
  const scale = 10 ** places
  const r = Math.round((v.n / v.d) * scale + (v.n >= 0 ? 1e-9 : -1e-9)) / scale
  return r.toFixed(places)
}

/** "31250" → "31,250" (a plain decimal only). */
export function commas(text: string): string {
  const mm = /^(-?)(\d+)(\.\d+)?$/.exec(text)
  if (!mm) return text
  return `${mm[1]}${mm[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${mm[3] ?? ''}`
}

/** KaTeX of a number: "31{,}250", "-8", "11.5", "33\tfrac{1}{3}" (mixed) or "\frac{1}{500}". */
export function qTex(v: Q, style: 'mixed' | 'frac' = 'mixed'): string {
  const dec = qDecimal(v, 4)
  if (dec !== null) return commas(dec).replace(/,/g, '{,}')
  const a = abs(v)
  const sign = v.n < 0 ? '-' : ''
  const w = Math.floor(a.n / a.d)
  // The thin space keeps "33 1/3" apart when the line is read back as words.
  if (style === 'mixed' && w > 0) return `${sign}${commas(String(w)).replace(/,/g, '{,}')}\\,\\tfrac{${a.n - w * a.d}}{${a.d}}`
  return `${sign}\\frac{${a.n}}{${a.d}}`
}

/** Money: "$11.50", "$2,645" (whole dollars without cents). */
export function dollars(v: Q): string {
  const cents = Math.round((v.n / v.d) * 100)
  const whole = cents % 100 === 0
  return `$${commas(whole ? String(cents / 100) : (cents / 100).toFixed(2))}`
}

export function dollarsTex(v: Q): string {
  return dollars(v).replace('$', '\\$').replace(/,/g, '{,}')
}

/** A minus sign for a sentence. */
export function minus(s: string): string {
  return s.replace(/-/g, '−')
}

// ---------------------------------------------------------------------------
// Expressions from exact coefficients
// ---------------------------------------------------------------------------

/** One term c·v^p, app syntax ("-4x^2/3", "500x", "y", "1600"); `first` keeps its sign in front. */
function termText(c: Q, v: string, p: number): string {
  const a = abs(c)
  const letters = p === 0 ? '' : p === 1 ? v : `${v}^${p}`
  const top = a.n === 1 && letters ? letters : `${a.n}${letters}`
  return a.d === 1 ? top : `${top}/${a.d}`
}

function termTex(c: Q, v: string, p: number): string {
  const a = abs(c)
  const letters = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`
  if (a.d === 1) return a.n === 1 && letters ? letters : `${a.n}${letters}`
  return `\\frac{${a.n}}{${a.d}}${letters}`
}

/** Terms joined with + and −, zero terms left out: app syntax and KaTeX. */
export function sumOf(terms: readonly { c: Q; v: string; p: number }[]): { text: string; tex: string } {
  const kept = terms.filter((t) => t.c.n !== 0)
  if (!kept.length) return { text: '0', tex: '0' }
  let text = ''
  let tex = ''
  kept.forEach((t, i) => {
    const neg = t.c.n < 0
    const sign = i === 0 ? (neg ? '-' : '') : neg ? ' - ' : ' + '
    text += sign + termText(t.c, t.v, t.p)
    tex += sign + termTex(t.c, t.v, t.p)
  })
  return { text, tex }
}

/** a·x + b·y with exact coefficients: "2x + y", "x - y", "20x + y". */
export function linText(a: Q, b: Q): { text: string; tex: string } {
  return sumOf([
    { c: a, v: 'x', p: 1 },
    { c: b, v: 'y', p: 1 },
  ])
}

/**
 * q(t) = a·t² + b·t + c in the worksheet's order: "500x - 2x^2" (a parabola opening down with no constant, so the
 * first term is not negative), else the standard order "2x^2 - 80x + 1600", "x^2 - 22x".
 */
export function quadText(p: { a: Q; b: Q; c: Q }, v: string): { text: string; tex: string } {
  if (p.c.n === 0 && p.b.n > 0 && p.a.n < 0) {
    return sumOf([
      { c: p.b, v, p: 1 },
      { c: p.a, v, p: 2 },
    ])
  }
  return sumOf([
    { c: p.a, v, p: 2 },
    { c: p.b, v, p: 1 },
    { c: p.c, v, p: 0 },
  ])
}

/** The same quadratic in standard order: "-2x^2 + 500x". */
export function quadStandard(p: { a: Q; b: Q; c: Q }, v: string): { text: string; tex: string } {
  return sumOf([
    { c: p.a, v, p: 2 },
    { c: p.b, v, p: 1 },
    { c: p.c, v, p: 0 },
  ])
}

/** A coefficient in front of a bracket: "" for 1, "-" for −1, "3", "1/2" as "(1/2)". */
export function factorText(c: Q): { text: string; tex: string } {
  if (c.n === c.d) return { text: '', tex: '' }
  if (c.n === -c.d) return { text: '-', tex: '-' }
  if (c.d === 1) return { text: String(c.n), tex: String(c.n) }
  return { text: `(${c.n}/${c.d})`, tex: `${c.n < 0 ? '-' : ''}\\frac{${Math.abs(c.n)}}{${c.d}}` }
}

/** k·(e) in app syntax and KaTeX, or e itself for k = 1. */
export function times(k: Q, e: { text: string; tex: string }): { text: string; tex: string } {
  if (k.n === k.d) return e
  const f = factorText(k)
  return { text: `${f.text}(${e.text})`, tex: `${f.tex}\\left(${e.tex}\\right)` }
}

/** Sum of two exact values (re-exported for the builders). */
export function qSum(...vs: Q[]): Q {
  return vs.reduce((s, v) => qAdd(s, v), q(0))
}

export function qTimes(...vs: Q[]): Q {
  return vs.reduce((s, v) => qMul(s, v), q(1))
}

/** Words for small counts: "two pens", "three". */
export const WORD: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' }

export function countWord(n: number): string {
  return WORD[n] ?? String(n)
}
