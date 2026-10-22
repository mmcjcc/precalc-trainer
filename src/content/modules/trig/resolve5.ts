/**
 * Test helper (imported by tests only): Unit 5's problems worked out again from what she sees, with mathjs and Math
 * and this file's own reading of the words: the given equation as she reads it (its KaTeX read back as words), a graph's
 * labelled points and its drawn curve, the four matching cards' curves, a description's or a story's numbers. Nothing
 * here asks the generators or the trig core for an answer; the app's grader is used only to confirm that the answers
 * worked out here are graded right.
 */
import { evaluate } from 'mathjs'
import type { TrigAnswer, TrigPart } from '@/content/types'
import { gradeTrigPart } from './parts'
import { plain } from './text'

const PI = Math.PI

/** Words and glyphs as mathjs reads them: π → pi, √3 → sqrt(3), sin⁻¹ and sin^−1 → asin, − → -. */
export function toMath(s: string): string {
  return s
    .replace(/[−–]/g, '-')
    .replace(/(sin|cos|tan)(?:⁻¹|\^-1)/g, 'a$1')
    .replace(/arc(sin|cos|tan)/g, 'a$1')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√(\d+)/g, 'sqrt($1)')
    // In brackets, so that "π(x + 1)" and "πx" read as products, not as a call of pi or a name "pix".
    .replace(/π/g, '(pi)')
    .replace(/²/g, '^2')
}

/** The value of a number as written: "5π/2", "−√3/2", "0.35", "3/2". */
export function valueOf(text: string): number {
  return Number(evaluate(toMath(text.trim())))
}

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

/** The balanced content of the first call of one of these function names: "sin(…)" → "…". */
function callInside(text: string, names: RegExp): { name: string; inside: string } | null {
  const m = names.exec(text)
  if (!m) return null
  let depth = 0
  const start = m.index + m[0].length
  for (let i = start - 1; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') {
      depth--
      if (depth === 0) return { name: m[1]!, inside: text.slice(start, i) }
    }
  }
  return null
}

/** A function of x from its words. */
function fnOf(text: string, v = 'x'): (x: number) => number {
  const expr = toMath(text)
  return (x: number) => {
    try {
      const r = evaluate(expr, { [v]: x })
      return typeof r === 'number' ? r : Number.NaN
    } catch {
      return Number.NaN
    }
  }
}

/**
 * The given line as she reads it: the KaTeX read back as words, with each simple stacked fraction kept whole in
 * brackets (on screen \frac{\pi}{4}(x + 2) is a stacked π over 4 times the bracket; as flat text "π/4(x + 2)" would
 * read as π over 4(x + 2)).
 */
const seen = (a: TrigAnswer) => plain((a.display ?? '').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '\\left(\\frac{$1}{$2}\\right)'))

/** The equation's right side, as she reads it. */
const rhsOf = (a: TrigAnswer) => seen(a).replace(/^y = /, '')

/** A shift as she would say it, signed: "5π/2 right" → +, "π/3 left" → −, "none" → 0. */
function signedShift(text: string): number {
  if (/none/.test(text)) return 0
  const m = /^(.*?)\s*(right|left)$/.exec(text.trim())
  if (m) return (m[2] === 'left' ? -1 : 1) * valueOf(m[1]!)
  return valueOf(text)
}

function expect(bad: string[], ok: boolean, what: string) {
  if (!ok) bad.push(what)
}

const part = (a: TrigAnswer, id: string) => a.stages.find((s) => s.id === id)

/** The two numbers of an interval "[−2, 4]" or the two ends of a union "(−∞, −1] ∪ [3, ∞)". */
function ends(text: string): [number, number] | null {
  const t = text.replace(/[−–]/g, '-')
  const band = /^\[(-?[\d./]+), (-?[\d./]+)\]$/.exec(t)
  if (band) return [valueOf(band[1]!), valueOf(band[2]!)]
  const union = /^\(-∞, (-?[\d./]+)\] ∪ \[(-?[\d./]+), ∞\)$/.exec(t)
  if (union) return [valueOf(union[1]!), valueOf(union[2]!)]
  return null
}

/** "x = π/4 + kπ/2" → base and step; "x = π/4, x = 3π/4" → the values. */
function familyOf(text: string): { base: number; step: number } | null {
  const t = text.replace(/^x = /, '')
  if (!/k/.test(t)) return null
  const f = fnOf(t.replace(/k/g, '(k)'), 'k')
  return { base: f(0), step: Math.abs(f(1) - f(0)) }
}
const listOf = (text: string) => text.split(/,\s*/).map((s) => valueOf(s.replace(/^x = /, ''))).sort((p, q) => p - q)
const inFamily = (x: number, f: { base: number; step: number }) => {
  const k = (x - f.base) / f.step
  return Math.abs(k - Math.round(k)) < 1e-7
}

/** Every disagreement between this file's solution and the problem's answers (empty: all agree). */
export function resolveUnit5(a: TrigAnswer): string[] {
  const bad: string[] = []
  if (a.type === 'sinusoids' && a.question === 'features') sinusoidFeatures(a, bad)
  else if (a.type === 'sinusoids' && a.question === 'equation') sinusoidEquation(a, bad)
  else if (a.type === 'sinusoids' && a.question === 'model') model(a, bad)
  else if (a.type === 'otherTrigGraphs' && a.question === 'features') otherFeatures(a, bad)
  else if (a.type === 'otherTrigGraphs' && a.question === 'match') match(a, bad)
  else if (a.type === 'inverseTrig' && a.question === 'evaluate') evaluateInverse(a, bad)
  else if (a.type === 'inverseTrig' && a.question === 'compose') compose(a, bad)
  return bad
}

// ---------------------------------------------------------------------------
// sg.features
// ---------------------------------------------------------------------------

function sinusoidFeatures(a: TrigAnswer, bad: string[]) {
  const rhs = rhsOf(a)
  const y = fnOf(rhs)
  const call = callInside(rhs, /(sin|cos)\(/)
  if (!call) return void bad.push(`cannot read ${rhs}`)
  const g = fnOf(call.inside)
  const B = g(1) - g(0)
  const shift = -g(0) / B
  const P = (2 * PI) / B
  // The period checked against the function itself: one period on, the same height; half a period on, not.
  expect(bad, [0.1, 0.37, 1.3].every((x) => close(y(x + P), y(x), 1e-7)) && [0.1, 0.37].some((x) => !close(y(x + P / 2), y(x), 1e-6)), 'the period does not repeat the graph')
  let hi = -Infinity
  let lo = Infinity
  for (let i = 0; i <= 4000; i++) {
    const v = y(shift + (P * i) / 4000)
    hi = Math.max(hi, v)
    lo = Math.min(lo, v)
  }
  const amp = (hi - lo) / 2
  const mid = (hi + lo) / 2
  for (const p of a.stages) {
    if (p.id === 'amplitude') expect(bad, close(valueOf(p.answerText), amp, 1e-6), `amplitude ${p.answerText} but ${amp}`)
    if (p.id === 'period') expect(bad, close(valueOf(p.answerText), P, 1e-9), `period ${p.answerText} but ${P}`)
    if (p.id === 'shift') expect(bad, close(signedShift(p.answerText), shift, 1e-9) || (Math.abs(shift) < 1e-12 && p.answerText === 'none'), `shift ${p.answerText} but ${shift}`)
    if (p.id === 'midline') expect(bad, close(valueOf(p.answerText.replace(/^y = /, '')), mid, 1e-6), `midline ${p.answerText} but ${mid}`)
    if (p.id === 'range') {
      const e = ends(p.answerText)
      expect(bad, !!e && close(e[0], lo, 1e-6) && close(e[1], hi, 1e-6), `range ${p.answerText} but [${lo}, ${hi}]`)
    }
    if (p.id === 'keypoints') {
      const pts = [...p.answerText.matchAll(/\(([^,]+), ([^)]+)\)/g)].map((m) => [valueOf(m[1]!), valueOf(m[2]!)] as const).sort((u, v) => u[0] - v[0])
      const mine = [0, 1, 2, 3, 4].map((k) => [shift + (k * P) / 4, y(shift + (k * P) / 4)] as const)
      expect(bad, pts.length === 5 && pts.every((pt, i) => close(pt[0], mine[i]![0], 1e-9) && close(pt[1], mine[i]![1], 1e-6)), `key points ${p.answerText}`)
    }
  }
}

// ---------------------------------------------------------------------------
// sg.equation: from the labelled points, or from the words
// ---------------------------------------------------------------------------

/** A number as a short exact spelling when it is a simple fraction (or a fraction of π); else full precision. */
export function spell(v: number): string {
  for (const [unit, mark] of [
    [1, ''],
    [PI, 'π'],
  ] as const) {
    const r = v / unit
    for (let d = 1; d <= 48; d++) {
      const n = Math.round(r * d)
      if (Math.abs(r * d - n) < 1e-9) {
        if (n === 0) return '0'
        const sign = n < 0 ? '-' : ''
        const an = Math.abs(n)
        const top = mark ? `${an === 1 ? '' : an}${mark}` : String(an)
        return d === 1 ? `${sign}${top}` : `${sign}${top}/${d}`
      }
    }
  }
  return String(v)
}

function sinusoidEquation(a: TrigAnswer, bad: string[]) {
  const p = part(a, 'equation')!
  const forms: string[] = []
  let mine: (x: number) => number
  const g = a.figure.kind === 'graph' ? a.figure.graph : null
  if (g) {
    // The two labelled points: a highest and a lowest, half a period apart.
    const pts = (g.markers ?? []).map((m) => {
      const mm = /^\((.+), (.+)\)$/.exec(m.label)!
      return { x: valueOf(mm[1]!), y: valueOf(mm[2]!), xText: mm[1]!.replace(/−/g, '-'), yText: mm[2]!.replace(/−/g, '-') }
    })
    if (pts.length !== 2) return void bad.push('the graph does not label two points')
    const [top, bottom] = pts[0]!.y > pts[1]!.y ? [pts[0]!, pts[1]!] : [pts[1]!, pts[0]!]
    const A = (top.y - bottom.y) / 2
    const D = (top.y + bottom.y) / 2
    const half = Math.abs(top.x - bottom.x)
    const B = PI / half
    mine = (x) => A * Math.cos(B * (x - top.x)) + D
    const Bs = `(${spell(B)})`
    forms.push(`y = ${spell(A)}cos(${Bs}(x - (${top.xText}))) + (${spell(D)})`)
    forms.push(`y = ${spell(A)}sin(${Bs}(x - (${top.xText})) + π/2) + (${spell(D)})`)
    forms.push(`y = -${spell(A)}cos(${Bs}(x - (${bottom.xText}))) + (${spell(D)})`)
    // The drawn curve is this graph: every sample on it.
    const drawn = (g.runs ?? []).flat()
    expect(bad, drawn.length > 50 && drawn.every((s) => !Number.isFinite(s.y) || close(s.y, mine(s.x), 1e-6)), 'the drawn curve is not the graph of the labelled points')
  } else {
    const words = plain(a.prompt).replace(/−/g, '-')
    const m = /a (sine|cosine) curve with amplitude (\S+) and period ([^,.]+?)(?:, shifted (.+))?\.$/.exec(words)
    if (!m) return void bad.push(`cannot read the description: ${words}`)
    const fn = m[1] === 'sine' ? 'sin' : 'cos'
    const A = valueOf(m[2]!)
    const P = valueOf(m[3]!)
    let s = 0
    let D = 0
    const shift = /(\S+) to the (right|left)/.exec(m[4] ?? '')
    if (shift) s = (shift[2] === 'left' ? -1 : 1) * valueOf(shift[1]!)
    const vert = /(\S+) units? (up|down)/.exec(m[4] ?? '')
    if (vert) D = (vert[2] === 'down' ? -1 : 1) * valueOf(vert[1]!)
    const B = (2 * PI) / P
    mine = (x) => A * (fn === 'sin' ? Math.sin(B * (x - s)) : Math.cos(B * (x - s))) + D
    const Bs = `(2π/(${m[3]!.trim()}))`
    forms.push(`y = ${m[2]}${fn}(${Bs}(x - (${spell(s)}))) + (${spell(D)})`)
    forms.push(`y = ${m[2]}${fn === 'sin' ? 'cos' : 'sin'}(${Bs}(x - (${spell(s)})) ${fn === 'sin' ? '- π/2' : '+ π/2'}) + (${spell(D)})`)
    forms.push(`y = -${m[2]}${fn}(${Bs}(x - (${spell(s)})) + π) + (${spell(D)})`)
  }
  // Her right answer in three different equivalent forms is right; the problem's own answer is this function.
  for (const f of forms) {
    const r = gradeTrigPart(p, f)
    expect(bad, r.verdict === 'correct', `the equivalent form “${f}” graded ${r.verdict}`)
  }
  const xs = [-2.3, -0.71, 0.4, 1.37, 2.9, 4.1]
  const theirs = fnOf(p.answerText.replace(/^y = /, ''))
  expect(bad, xs.every((x) => close(theirs(x), mine(x), 1e-9)), `the answer ${p.answerText} is not the graph`)
  // Every promised slip is a different function.
  for (const t of p.traps) {
    const f = fnOf(t.text.replace(/^y = /, ''))
    expect(bad, xs.some((x) => !close(f(x), mine(x), 1e-6)), `the slip ${t.id} “${t.text}” is the answer`)
  }
}

// ---------------------------------------------------------------------------
// sg.model
// ---------------------------------------------------------------------------

const n = (s: string) => Number(s.replace(/−/g, '-'))
/** A worked-out number as she would write it: 1.7999999999999998 → "1.8". */
const fix = (v: number) => String(Number(v.toFixed(9)))

function model(a: TrigAnswer, bad: string[]) {
  const words = plain(a.prompt)
  let f: ((t: number) => number) | null = null
  let text = ''
  let period = 0
  let mm: RegExpExecArray | null
  if ((mm = /Ferris wheel is (\d+) (?:meters|feet) across\. (?:Riders board at its lowest point, from a platform (\d+) \w+ above the ground|Its center is (\d+) \w+ above the ground)\. It makes one full turn every (\d+) (?:minutes?|seconds?)\. (A rider boards at the bottom|The timer starts)/.exec(words))) {
    const r = n(mm[1]!) / 2
    const c = mm[2] ? n(mm[2]) + r : n(mm[3]!)
    period = n(mm[4]!)
    const bottom = mm[5]!.startsWith('A rider')
    f = (t) => (bottom ? c - r * Math.cos((2 * PI * t) / period) : c + r * Math.sin((2 * PI * t) / period))
    text = bottom ? `h(t) = ${fix(c)} - ${fix(r)}cos(2πt/${period})` : `h(t) = ${fix(c)} + ${fix(r)}sin(2πt/${period})`
  } else if ((mm = /deepest, ([\d.]+) (?:feet|foot), ([\d.]+) hours? after midnight\. The next low tide, ([\d.]+) (?:feet|foot) deep, comes ([\d.]+) hours? later/.exec(words))) {
    const H = n(mm[1]!)
    const t0 = n(mm[2]!)
    const L = n(mm[3]!)
    period = 2 * n(mm[4]!)
    f = (t) => (H + L) / 2 + ((H - L) / 2) * Math.cos((2 * PI * (t - t0)) / period)
    text = `d(t) = ${fix((H + L) / 2)} + ${fix((H - L) / 2)}cos(2π(t - ${t0})/${fix(period)})`
  } else if ((mm = /longest day of the year, day (\d+), has ([\d.]+) hours of daylight, and the shortest day, about half a year later, has ([\d.]+) hours/.exec(words))) {
    const N = n(mm[1]!)
    const H = n(mm[2]!)
    const L = n(mm[3]!)
    period = 365
    f = (t) => (H + L) / 2 + ((H - L) / 2) * Math.cos((2 * PI * (t - N)) / 365)
    text = `H(t) = ${fix((H + L) / 2)} + ${fix((H - L) / 2)}cos(2π(t - ${N})/365)`
  } else if ((mm = /average daily high is (\d+)°F in July, the warmest month, and (\d+)°F in January/.exec(words))) {
    const H = n(mm[1]!)
    const L = n(mm[2]!)
    period = 12
    f = (t) => (H + L) / 2 + ((H - L) / 2) * Math.cos((PI * (t - 7)) / 6)
    text = `T(t) = ${fix((H + L) / 2)} + ${fix((H - L) / 2)}cos(π(t - 7)/6)`
  } else if ((mm = /temperature is lowest, (\d+)°F, at (\d+) a\.m\., and highest, (\d+)°F, twelve hours later/.exec(words))) {
    const L = n(mm[1]!)
    const t0 = n(mm[2]!)
    const H = n(mm[3]!)
    period = 24
    f = (t) => (H + L) / 2 - ((H - L) / 2) * Math.cos((PI * (t - t0)) / 12)
    text = `T(t) = ${fix((H + L) / 2)} - ${fix((H - L) / 2)}cos(π(t - ${t0})/12)`
  }
  if (!f) return void bad.push(`cannot read the story: ${words}`)
  const modelPart = part(a, 'model')!
  const r = gradeTrigPart(modelPart, text)
  expect(bad, r.verdict === 'correct', `my model “${text}” graded ${r.verdict}`)
  const places = (ask: string) => (/nearest hundredth/.test(ask) ? 2 : /nearest tenth/.test(ask) ? 1 : 0)
  const valuePart = part(a, 'value')!
  const ask = plain(valuePart.ask)
  const at = n((/(?:t = |day )([\d.]+)/.exec(ask) ?? [])[1] ?? 'NaN')
  expect(bad, f(at).toFixed(places(ask)) === Number(valuePart.answerText).toFixed(places(ask)), `value ${valuePart.answerText} but ${f(at)}`)
  const timePart = part(a, 'time')!
  const tAsk = plain(timePart.ask)
  const target = n((/first (?:have )?([\d.]+)/.exec(tAsk) ?? [])[1] ?? 'NaN')
  // The first time after zero the model reaches the target: a fine scan, then halving.
  const step = period / 20000
  let first = Number.NaN
  for (let i = 1; i <= 40000 && Number.isNaN(first); i++) {
    const t1 = (i - 1) * step
    const t2 = i * step
    if (Math.sign(f(t1) - target) !== Math.sign(f(t2) - target)) {
      let lo = t1
      let hi = t2
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2
        if (Math.sign(f(mid) - target) === Math.sign(f(lo) - target)) lo = mid
        else hi = mid
      }
      first = (lo + hi) / 2
    }
  }
  expect(bad, first.toFixed(places(tAsk)) === Number(timePart.answerText).toFixed(places(tAsk)), `first time ${timePart.answerText} but ${first}`)
}

// ---------------------------------------------------------------------------
// og.features, og.match
// ---------------------------------------------------------------------------

function otherFeatures(a: TrigAnswer, bad: string[]) {
  const rhs = rhsOf(a)
  const call = callInside(rhs, /(tan|cot|sec|csc)\(/)
  if (!call) return void bad.push(`cannot read ${rhs}`)
  const g = fnOf(call.inside)
  const B = g(1) - g(0)
  const c = -g(0)
  const fn = call.name
  const period = (fn === 'tan' || fn === 'cot' ? PI : 2 * PI) / B
  // Where the function under it is zero: cos for tan and sec, sin for cot and csc.
  const asymAt = (k: number) => ((fn === 'tan' || fn === 'sec' ? PI / 2 : 0) + k * PI + c) / B
  const zeroAt = (k: number) => ((fn === 'tan' ? 0 : PI / 2) + k * PI + c) / B
  const y = fnOf(rhs)
  for (const p of a.stages) {
    if (p.id === 'period') expect(bad, close(valueOf(p.answerText), period), `period ${p.answerText} but ${period}`)
    if (p.id === 'asymptotes' || p.id === 'zeros') {
      const at = p.id === 'asymptotes' ? asymAt : zeroAt
      const c2 = p.check
      if (c2.kind === 'family' && c2.between) {
        const mine: number[] = []
        for (let k = -40; k <= 40; k++) {
          const x = at(k)
          if (x > c2.between[0] && x < c2.between[1]) mine.push(x)
        }
        const theirs = listOf(p.answerText)
        mine.sort((u, v) => u - v)
        expect(bad, theirs.length === mine.length && theirs.every((t, i) => close(t, mine[i]!)), `${p.id} ${p.answerText} but ${mine.join(', ')}`)
      } else {
        const fam = familyOf(p.answerText)
        const mineStep = PI / B
        expect(bad, !!fam && close(fam.step, mineStep) && [-3, -1, 0, 2, 5].every((k) => inFamily(at(k), fam)), `${p.id} ${p.answerText}`)
      }
      // And the function really has no value there (or is zero there).
      if (p.id === 'asymptotes') expect(bad, Math.abs(y(asymAt(1) + 1e-9)) > 1e5, 'no asymptote where one should be')
      else expect(bad, Math.abs(y(zeroAt(1))) < 1e-9, 'no zero where one should be')
    }
    if (p.id === 'range') {
      const v1 = y((0 + c) / B)
      const v2 = y((PI + c) / B)
      const vs = fn === 'sec' ? [v1, v2] : [y((PI / 2 + c) / B), y((3 * PI / 2 + c) / B)]
      const lo = Math.min(...vs)
      const hi = Math.max(...vs)
      const e = ends(p.answerText)
      expect(bad, !!e && close(e[0], lo, 1e-9) && close(e[1], hi, 1e-9), `range ${p.answerText} but (−∞, ${lo}] ∪ [${hi}, ∞)`)
    }
  }
}

function match(a: TrigAnswer, bad: string[]) {
  const y = fnOf(rhsOf(a))
  const matching: string[] = []
  for (const g of a.figure.graphs ?? []) {
    const [lo, hi] = g.graph.yDomain ?? [-10, 10]
    const pts = (g.graph.runs ?? []).flat().filter((s) => Number.isFinite(s.y) && s.y > lo && s.y < hi)
    if (pts.length > 40 && pts.every((s) => close(s.y, y(s.x), 1e-6))) matching.push(g.letter)
    expect(bad, g.graph.ariaLabel === `Graph ${g.letter}`, `card ${g.letter} announces something: ${g.graph.ariaLabel}`)
  }
  expect(bad, matching.length === 1, `cards matching the equation: ${matching.join(', ') || 'none'}`)
  expect(bad, matching[0] === part(a, 'match')!.answerText, `the matching card is ${matching[0]} but the answer is ${part(a, 'match')!.answerText}`)
}

// ---------------------------------------------------------------------------
// it.evaluate, it.compose
// ---------------------------------------------------------------------------

const INV: Record<string, (x: number) => number> = { asin: Math.asin, acos: Math.acos, atan: Math.atan }
const FN: Record<string, (x: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan, csc: (t) => 1 / Math.sin(t), sec: (t) => 1 / Math.cos(t), cot: (t) => 1 / Math.tan(t) }

function evaluateInverse(a: TrigAnswer, bad: string[]) {
  const d = toMath(seen(a))
  const call = callInside(d, /(asin|acos|atan)\(/)
  if (!call) return void bad.push(`cannot read ${d}`)
  const v = Number(evaluate(call.inside))
  const p = a.stages[0]!
  const angle = INV[call.name]!(v)
  const words = plain(a.prompt)
  if (Number.isNaN(angle)) return void expect(bad, p.answerText === 'no value', `no value, but ${p.answerText}`)
  if (p.check.kind === 'decimal') return void expect(bad, angle.toFixed(3) === p.answerText, `${p.answerText} but ${angle}`)
  const want = /in degrees/.test(words) ? (angle * 180) / PI : angle
  expect(bad, close(valueOf(p.answerText), want, 1e-9), `${p.answerText} but ${want}`)
}

function compose(a: TrigAnswer, bad: string[]) {
  const d = toMath(seen(a))
  const outer = callInside(d, /^(sin|cos|tan|csc|sec|cot|asin|acos|atan)\(/)
  if (!outer) return void bad.push(`cannot read ${d}`)
  const inner = callInside(outer.inside, /^(sin|cos|tan|csc|sec|cot|asin|acos|atan)\(/)
  if (!inner) return void bad.push(`cannot read ${outer.inside}`)
  const o = outer.name
  const i = inner.name
  const algebraic = /x/.test(inner.inside)
  if (algebraic) {
    const p = a.stages[0]!
    const u = fnOf(inner.inside)
    const mine = (x: number) => FN[o]!(INV[i]!(u(x)))
    const theirs = fnOf(p.answerText)
    const xs = [-0.93, -0.61, -0.27, 0.13, 0.42, 0.77].map((t) => (i === 'atan' ? t * 3 : t / Math.abs(u(1) - u(0)) ))
    expect(bad, xs.every((x) => !Number.isFinite(mine(x)) || close(theirs(x), mine(x), 1e-9)), `the expression ${p.answerText} is not ${o}(${i}(${inner.inside}))`)
    return
  }
  const v = Number(evaluate(inner.inside))
  if (o.startsWith('a')) {
    // arcsin(sin θ): the angle the inverse gives for the inside's value.
    const theta = v
    const want = INV[o]!(FN[i]!(theta))
    return void expect(bad, close(valueOf(a.stages[0]!.answerText), want, 1e-9), `${a.stages[0]!.answerText} but ${want}`)
  }
  const theta = INV[i]!(v)
  if (a.stages.length === 1) {
    // sin(arcsin v): the value, or none when the inside has no angle.
    const p = a.stages[0]!
    if (Number.isNaN(theta)) return void expect(bad, p.answerText === 'no value', `no value, but ${p.answerText}`)
    return void expect(bad, close(valueOf(p.answerText), FN[o]!(theta), 1e-9), `${p.answerText} but ${FN[o]!(theta)}`)
  }
  // A reference triangle: the quadrant, the third side of the point, the value.
  const qd = theta > PI / 2 ? 'Q2' : theta > 0 ? 'Q1' : 'Q4'
  expect(bad, part(a, 'quadrant')?.answerText === qd, `quadrant ${part(a, 'quadrant')?.answerText} but ${qd}`)
  const side = a.stages[1]!
  const known = [...plain(side.ask).matchAll(/([xyr]) = (−?[\d√./]+)/g)].map((m) => [m[1]!, valueOf(m[2]!)] as const)
  const r = known.find((k) => k[0] === 'r')?.[1] ?? Math.hypot(...known.map((k) => k[1]))
  const want = side.id === 'x' ? r * Math.cos(theta) : side.id === 'y' ? r * Math.sin(theta) : r
  expect(bad, close(valueOf(side.answerText), want, 1e-9), `${side.id} ${side.answerText} but ${want}`)
  const value = a.stages[2]!
  expect(bad, close(valueOf(value.answerText), FN[o]!(theta), 1e-9), `${value.id} ${value.answerText} but ${FN[o]!(theta)}`)
}

/** The part a check concerns, for the tests' messages. */
export function partLabel(p: TrigPart): string {
  return `${p.id} (${p.kind})`
}
