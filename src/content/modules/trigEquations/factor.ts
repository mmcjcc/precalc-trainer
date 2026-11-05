/**
 * te.factor — a quadratic in one trig function, solved on one full turn.
 *
 * The clean path always factors. It never divides both sides by sin x, cos x or tan x.
 * Factoring the function out is a wrong choice on the factor stage, so te_lost_solution
 * (dropping the angles where that factor is zero) is teachable.
 *
 * Exclusions:
 *  - no item whose roots are both outside [-1, 1]. One factor may be sin x = ±2 or cos x = ±2
 *    (te_no_solution); the other factor still has angles. Tangent of ±2 is a real angle, so
 *    tangent is never a "no solution" item.
 *  - the swapped factor order is not a wrong choice. It is the same factorization.
 *  - when the solution list contains the angle 0 (sin x = 0, tan x = 0, cos x = 1), the prompt,
 *    the instructions and the rule card do not write a bare 0. The range [0, 2π) would show that
 *    answer, which is why uc.solve leaves those values out. These items still ask for one full
 *    turn from the positive x-axis; they say "zero" instead of the digit.
 *  - a sign-flipped equation pair that is the same set of roots (±1/2) is not offered. The wrong
 *    pair is then "fn x = 2 or fn x = −2", which is never the real pair.
 *  - tangent is not given a root of ±1/2. That value is a real angle, but it is not on the
 *    special-angle table, so there is no exact list in the uc.solve grammar. Tangent items are the
 *    shapes whose roots are 0 or ±1 (tan² x − 1 = 0, and tan x times (tan x ± 1) = 0). The famous
 *    2sin² x − sin x − 1 = 0 has cosine twins; its tangent twin would ask for tan x = −1/2 and is left out.
 */
import type { TrigPart } from '@/content/types'
import { listText, q, qText, readExact, solveAnswer, type Q, type TrigFn } from '@/engine/trig'
import { m, plain } from '../trig/text'
import { LIST_RAD_HINT } from '../unitCircle/hints'
import { fracText } from '../trigFormulas/double'
import { close, gradeChoice, gradeRadianList, mistake, radianListDegrees, sameDegrees } from '../trigFormulas/grade'

type Fn = 'sin' | 'cos' | 'tan'
type Kind = 'classic' | 'lost' | 'nosol'

interface Shape {
  kind: Kind
  /** (p u + q)(r u + s), both leading coefficients positive. */
  p: number
  q: number
  r: number
  s: number
  fns: readonly Fn[]
}

const CLASSIC: readonly Shape[] = [
  { kind: 'classic', p: 2, q: 1, r: 1, s: -1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'classic', p: 2, q: -1, r: 1, s: -1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'classic', p: 1, q: -1, r: 1, s: 1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'classic', p: 2, q: -1, r: 1, s: 1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'classic', p: 2, q: 1, r: 1, s: 1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'classic', p: 2, q: -1, r: 2, s: 1, fns: ['sin', 'cos', 'tan'] },
]

/** One factor is the function itself (or a constant times it), so dividing would drop its zeros. */
const LOST: readonly Shape[] = [
  { kind: 'lost', p: 1, q: 0, r: 2, s: -1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'lost', p: 1, q: 0, r: 2, s: 1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'lost', p: 1, q: 0, r: 1, s: -1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'lost', p: 1, q: 0, r: 1, s: 1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'lost', p: 2, q: 0, r: 1, s: -1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'lost', p: 2, q: 0, r: 1, s: 1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'lost', p: 2, q: 0, r: 2, s: -1, fns: ['sin', 'cos', 'tan'] },
  { kind: 'lost', p: 2, q: 0, r: 2, s: 1, fns: ['sin', 'cos', 'tan'] },
]

/** One root is ±2 (no angle for sine or cosine). The other root is a special value in range. */
const NOSOL: readonly Shape[] = [
  { kind: 'nosol', p: 1, q: -2, r: 1, s: -1, fns: ['sin', 'cos'] },
  { kind: 'nosol', p: 1, q: -2, r: 2, s: -1, fns: ['sin', 'cos'] },
  { kind: 'nosol', p: 1, q: -2, r: 2, s: 1, fns: ['sin', 'cos'] },
  { kind: 'nosol', p: 1, q: -2, r: 1, s: 1, fns: ['sin', 'cos'] },
  { kind: 'nosol', p: 1, q: 2, r: 1, s: -1, fns: ['sin', 'cos'] },
  { kind: 'nosol', p: 1, q: 2, r: 2, s: -1, fns: ['sin', 'cos'] },
  { kind: 'nosol', p: 1, q: 2, r: 2, s: 1, fns: ['sin', 'cos'] },
  { kind: 'nosol', p: 1, q: 2, r: 1, s: 1, fns: ['sin', 'cos'] },
]

const WORDINGS = [0, 1] as const

export interface FactorItem {
  id: number
  kind: Kind
  fn: Fn
  /** True when the angle 0 is a solution, so visible text must not contain a bare 0. */
  hideZero: boolean
  prompt: string
  plainEq: string
}

interface Solved {
  p: number
  q: number
  root: string
  degs: Q[]
  impossible: boolean
}

function rootValue(p: number, q: number): number {
  return -q / p
}

/** 0 and ±1 are the rational special-angle tangent values this factoring can hit. ±1/2 is not. */
function tanRootsAreSpecial(shape: Shape): boolean {
  const roots = [rootValue(shape.p, shape.q), rootValue(shape.r, shape.s)]
  return roots.every((value) => Math.abs(value) < 1e-9 || Math.abs(Math.abs(value) - 1) < 1e-9)
}

/** Same order the catalog is built in. Tangent skips a shape whose root is off the special-angle table. */
function catalogPairs(): { shape: Shape; fn: Fn }[] {
  const rows: { shape: Shape; fn: Fn }[] = []
  for (const shape of [...CLASSIC, ...LOST, ...NOSOL]) {
    for (const fn of shape.fns) {
      if (fn === 'tan' && !tanRootsAreSpecial(shape)) continue
      rows.push({ shape, fn })
    }
  }
  return rows
}

function polyOf(p: number, q: number, r: number, s: number): { a: number; b: number; c: number } {
  return { a: p * r, b: p * s + q * r, c: q * s }
}

function polyTex(a: number, b: number, c: number, fn: Fn): string {
  const square = `\\${fn}^{2} x`
  const linear = `\\${fn} x`
  const bits: string[] = []
  const push = (coef: number, body: string) => {
    if (coef === 0) return
    const abs = Math.abs(coef)
    const mag = body === '' ? String(abs) : abs === 1 ? body : `${abs}${body}`
    bits.push(bits.length === 0 ? (coef < 0 ? `-${mag}` : mag) : `${coef < 0 ? '-' : '+'} ${mag}`)
  }
  push(a, square)
  push(b, linear)
  push(c, '')
  if (bits.length === 0) throw new Error('zero polynomial')
  return bits.join(' ')
}

function factorPhrase(fn: Fn, p: number, q: number): string {
  const u = `${fn} x`
  if (q === 0) return p === 1 ? `(${u})` : `(${p}${u})`
  const sign = q > 0 ? '+' : '−'
  const lead = p === 1 ? u : `${p}${u}`
  return `(${lead} ${sign} ${Math.abs(q)})`
}

function productPhrase(fn: Fn, p: number, q: number, r: number, s: number): string {
  return `${factorPhrase(fn, p, q)}${factorPhrase(fn, r, s)}`
}

function eqPhrase(fn: Fn, root: string): string {
  return `${fn} x = ${root.replace(/-/g, '−')}`
}

function pairPhrase(fn: Fn, left: string, right: string): string {
  return `${eqPhrase(fn, left)} or ${eqPhrase(fn, right)}`
}

function solveRoot(fn: Fn, p: number, q: number): Solved {
  const root = fracText(-q, p)
  const exact = readExact(root)
  if (!exact || exact === 'undefined') throw new Error(`unreadable root ${root}`)
  const degs = solveAnswer(fn, exact)
  const mag = Math.abs(rootValue(p, q))
  const impossible = fn !== 'tan' && mag > 1 + 1e-9
  if (impossible && degs.length > 0) throw new Error(`${fn} ${root} should have no angle`)
  if (!impossible && degs.length === 0) throw new Error(`${fn} ${root} should have an angle`)
  return { p, q, root, degs, impossible }
}

function degNums(degs: readonly Q[]): number[] {
  return degs.map((d) => d.n / d.d)
}

function assertRoundTrip(text: string, degs: readonly Q[]): void {
  const back = radianListDegrees(text)
  if (!back.ok) throw new Error(`list ${text} did not read: ${back.message}`)
  if (!sameDegrees(back.degs, degNums(degs))) throw new Error(`list ${text} came back ${back.degs.join(', ')}`)
}

function listOf(degs: readonly Q[]): string {
  const text = listText(degs, 'rad')
  assertRoundTrip(text, degs)
  return text
}

function merged(parts: readonly Q[][]): Q[] {
  const all = parts.flat()
  all.sort((a, b) => a.n / a.d - b.n / b.d)
  const out: Q[] = []
  for (const d of all) {
    if (!out.some((have) => Math.abs(have.n / have.d - d.n / d.d) < 1e-6)) out.push(d)
  }
  return out
}

function fnAt(fn: Fn, deg: number): number {
  const r = (deg * Math.PI) / 180
  if (fn === 'sin') return Math.sin(r)
  if (fn === 'cos') return Math.cos(r)
  return Math.tan(r)
}

const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]

function assertCovers(fn: Fn, a: number, b: number, c: number, degs: readonly Q[]): void {
  const got = degNums(degs)
  for (const deg of SPECIAL) {
    if (fn === 'tan' && (deg === 90 || deg === 270)) continue
    const u = fnAt(fn, deg)
    const hit = close(a * u * u + b * u + c, 0)
    const listed = got.some((d) => Math.abs(d - deg) < 1e-6)
    if (hit !== listed) throw new Error(`${fn} poly ${a},${b},${c} at ${deg}°: equation ${hit}, listed ${listed}`)
  }
  for (const deg of got) {
    const u = fnAt(fn, deg)
    if (!close(a * u * u + b * u + c, 0)) throw new Error(`listed ${deg}° does not satisfy ${fn}`)
  }
}

function rangeWords(hideZero: boolean): string {
  return hideZero
    ? 'one full turn from the positive x-axis up to but not including a full turn'
    : '[0, 2π)'
}

function promptFor(eqTex: string, wording: 0 | 1, hideZero: boolean): string {
  const eq = m(eqTex)
  if (hideZero) {
    return wording === 0
      ? `Solve ${eq}, set equal to zero, for $x$ in one full turn from the positive x-axis up to but not including a full turn.`
      : `Find every $x$ in one full turn from the positive x-axis up to but not including a full turn that makes ${eq} equal to zero.`
  }
  return wording === 0
    ? `Solve ${eq} for $x$ in $[0, 2\\pi)$.`
    : `Find every $x$ in $[0, 2\\pi)$ that satisfies ${eq}.`
}

const BOGUS = [30, 45, 60, 150, 210] as const

function bogusAngle(taken: readonly Q[]): Q {
  const have = degNums(taken)
  const deg = BOGUS.find((d) => !have.some((h) => Math.abs(h - d) < 1e-6))
  if (deg === undefined) throw new Error('no bogus angle left')
  return q(deg)
}

function reversed(text: string): string[] {
  const parts = text.split(', ')
  if (parts.length < 2) return []
  return [[...parts].reverse().join(', ')]
}

function anglePart(id: string, label: string, ask: string, fn: Fn, root: string, degs: readonly Q[], traps: TrigPart['traps']): TrigPart {
  const answerText = listOf(degs)
  const one = degs.length >= 2 ? listOf([degs[0]!]) : ''
  // A one-angle trap that is already another slip (the lost-solution list can be a single angle) stays that slip.
  const named =
    one && !traps.some((t) => t.text === one)
      ? [mistake('te_one_quadrant', one, 'That is one angle where it works. There is another one before a full turn is over.')]
      : []
  return {
    id,
    kind: 'angles',
    label,
    ask,
    formatHint: LIST_RAD_HINT,
    nudge: 'Use the reference angle in every quadrant where this function has the sign of the value. One quadrant is not the whole list.',
    ruleCard: 'te-factor',
    reveal: [`${eqPhrase(fn, root)} at ${answerText.replace(/-/g, '−')}.`],
    answerText,
    forms: reversed(answerText),
    check: { kind: 'angles', unit: 'rad', degs: degs.map(qText), fn: fn as TrigFn, value: root },
    wrongNote: 'Check the quadrants for this sign, and stay inside one full turn.',
    traps: [...named, ...traps],
  }
}

function nonePart(id: string, label: string, fn: Fn, taken: readonly Q[]): TrigPart {
  const bogus = bogusAngle(taken)
  const bogusText = listOf([bogus])
  return {
    id,
    kind: 'choice',
    label,
    ask: `This factor asks ${fn} for a number past 1. What are its solutions?`,
    formatHint: 'Choose one.',
    choices: [
      { value: 'none', label: 'no solution' },
      { value: 'bogus', label: bogusText },
    ],
    nudge: 'Sine and cosine never go past 1 or below −1. A factor that asks for a number past that has no angle.',
    ruleCard: 'te-factor',
    reveal: [`${fn} never equals a number past 1, so this factor has no solution.`],
    answerText: 'none',
    forms: [],
    check: { kind: 'choice' },
    wrongNote: 'Sine and cosine stay between −1 and 1. A value past that is not an angle.',
    traps: [
      mistake('te_no_solution', 'bogus', 'Sine and cosine never reach a number past 1, so that factor has no angle. Leave it out of the list.'),
    ],
  }
}

export function factorStages(shape: Shape, fn: Fn): TrigPart[] {
  const left = solveRoot(fn, shape.p, shape.q)
  const right = solveRoot(fn, shape.r, shape.s)
  const { a, b, c } = polyOf(shape.p, shape.q, shape.r, shape.s)
  const good = [left, right].filter((s) => !s.impossible)
  const all = merged(good.map((s) => s.degs))
  if (all.length === 0) throw new Error('no solution at all')
  assertCovers(fn, a, b, c, all)
  const hideZero = degNums(all).some((d) => Math.abs(d) < 1e-6)
  const span = rangeWords(hideZero)

  const correct = productPhrase(fn, shape.p, shape.q, shape.r, shape.s)
  const wrongs: { label: string; value: string }[] = []
  if (shape.q !== 0) wrongs.push({ value: 'flipL', label: productPhrase(fn, shape.p, -shape.q, shape.r, shape.s) })
  if (shape.s !== 0) wrongs.push({ value: 'flipR', label: productPhrase(fn, shape.p, shape.q, shape.r, -shape.s) })
  if (shape.kind === 'lost') wrongs.push({ value: 'divide', label: `Divide both sides by ${fn} x` })
  if (new Set([correct, ...wrongs.map((w) => w.label)]).size !== wrongs.length + 1) {
    throw new Error(`factor choices collided for ${correct}`)
  }
  const factorTraps =
    shape.kind === 'lost'
      ? [
          mistake(
            'te_lost_solution',
            'divide',
            'Dividing by the function throws away the angles where that factor is zero. Factor it out instead.',
          ),
        ]
      : []

  const roots = [left.root, right.root]
  const flipped = [fracText(shape.q, shape.p), fracText(shape.s, shape.r)]
  const sameRoots = [...roots].sort().join('|') === [...flipped].sort().join('|')
  const badPair = sameRoots ? pairPhrase(fn, '2', '-2') : pairPhrase(fn, flipped[0]!, flipped[1]!)
  const goodPair = pairPhrase(fn, left.root, right.root)
  const onlyFirst = eqPhrase(fn, left.root)
  if (new Set([goodPair, badPair, onlyFirst]).size !== 3) throw new Error(`equation choices collided for ${goodPair}`)

  const lostOnly = shape.kind === 'lost' ? (left.impossible ? right : left.q === 0 ? right : left) : null
  const dropped = lostOnly ? listOf(lostOnly.degs) : ''
  const full = listOf(all)
  if (dropped && dropped === full) throw new Error('dropping a factor did not change the list')

  const extra = shape.kind === 'nosol' ? merged([all, [bogusAngle(all)]]) : []
  const extraText = extra.length ? listOf(extra) : ''

  const askList = `List every solution on ${span}. Separate the angles with commas.`

  const first = left.impossible
    ? nonePart('first', 'First factor', fn, right.degs)
    : anglePart('first', 'First factor', askList, fn, left.root, left.degs, [])
  const second = right.impossible
    ? nonePart('second', 'Second factor', fn, left.degs)
    : anglePart('second', 'Second factor', askList, fn, right.root, right.degs, [])

  const allTraps = [
    ...(dropped ? [mistake('te_lost_solution', dropped, 'That list is only one factor. The other factor is zero at more angles, and dividing would have thrown those away.')] : []),
    ...(extraText ? [mistake('te_no_solution', extraText, 'One of those angles came from a factor with no solution. Sine and cosine never go past 1.')] : []),
  ]

  return [
    {
      id: 'factor',
      kind: 'choice',
      label: 'Factored form',
      ask: 'Which product is this equation, ready to set each factor equal to zero?',
      formatHint: 'Choose one.',
      choices: [{ value: 'ok', label: correct }, ...wrongs.map((w) => ({ value: w.value, label: w.label }))],
      nudge: 'Treat the trig function as the variable and factor. Do not divide both sides by the function: that throws an angle away.',
      ruleCard: 'te-factor',
      reveal: [`Factored: ${correct}.`],
      answerText: 'ok',
      forms: [],
      check: { kind: 'choice' },
      wrongNote: 'That product is not this equation. Check the signs, and do not divide by the function.',
      traps: factorTraps,
    },
    {
      id: 'equations',
      kind: 'choice',
      label: 'Two equations',
      ask: 'Which pair of equations comes from setting each factor equal to zero?',
      formatHint: 'Choose one.',
      choices: [
        { value: 'ok', label: goodPair },
        { value: 'bad', label: badPair },
        { value: 'one', label: onlyFirst },
      ],
      nudge: 'Each factor equals zero on its own. Keep both equations, signs included.',
      ruleCard: 'te-factor',
      reveal: [goodPair],
      answerText: 'ok',
      forms: [],
      check: { kind: 'choice' },
      wrongNote: 'Set each factor equal to zero. Both equations belong in the pair, with the signs the factors have.',
      traps: [],
    },
    first,
    second,
    anglePart('all', 'Every solution', askList, fn, good[0]!.root, all, allTraps),
  ]
}

function buildCatalog(): FactorItem[] {
  const out: FactorItem[] = []
  const seen = new Set<string>()
  const keys = new Set<string>()
  let id = 0
  for (const { shape, fn } of catalogPairs()) {
      const { a, b, c } = polyOf(shape.p, shape.q, shape.r, shape.s)
      const stagesProbe = factorStages(shape, fn)
      const all = stagesProbe.find((s) => s.id === 'all')!
      const hideZero = all.answerText.split(', ').includes('0') || all.forms.some((f) => f.split(', ').includes('0'))
      if (shape.kind === 'lost' && !stagesProbe[0]!.traps.some((t) => t.id === 'te_lost_solution')) {
        throw new Error('a lost item has no divide choice')
      }
      if (stagesProbe[0]!.answerText !== 'ok') throw new Error('the clean path is not factoring')
      if (stagesProbe[0]!.choices?.some((c) => c.value === 'ok' && c.label.startsWith('Divide'))) {
        throw new Error('the correct choice divides')
      }
      const eq = hideZero ? polyTex(a, b, c, fn) : `${polyTex(a, b, c, fn)} = 0`
      if (hideZero && /0/.test(plain(m(eq)))) throw new Error(`hidden-zero equation still shows a digit 0: ${eq}`)
      for (const wording of WORDINGS) {
        const key = `${fn}|${a}|${b}|${c}|${wording}`
        if (keys.has(key)) throw new Error(`duplicate factor key ${key}`)
        keys.add(key)
        const prompt = promptFor(eq, wording, hideZero)
        const statement = plain(prompt)
        if (seen.has(statement)) throw new Error(`duplicate factor statement ${statement}`)
        if (hideZero && /0/.test(statement)) throw new Error(`hidden-zero prompt shows a digit 0: ${statement}`)
        seen.add(statement)
        out.push({ id: id++, kind: shape.kind, fn, hideZero, prompt, plainEq: plain(m(eq)) })
      }
  }
  if (out.length < 60) throw new Error(`factor catalog has only ${out.length}`)
  const lost = out.filter((item) => item.kind === 'lost').length
  const nosol = out.filter((item) => item.kind === 'nosol').length
  const tan = out.filter((item) => item.fn === 'tan').length
  if (lost < 12 || nosol < 12 || tan < 8) throw new Error(`factor catalog lost ${lost}, nosol ${nosol}, tan ${tan}`)
  return out
}

export const FACTOR_CATALOG: readonly FactorItem[] = buildCatalog()

/** The shape and function a catalog row was built from, in the same order as FACTOR_CATALOG. */
export function factorShapeAt(index: number): { shape: Shape; fn: Fn } {
  const rows: { shape: Shape; fn: Fn }[] = []
  for (const pair of catalogPairs()) for (const _w of WORDINGS) rows.push(pair)
  return rows[index]!
}

export function gradeFactorPart(part: TrigPart, raw: string) {
  if (part.kind === 'choice') return gradeChoice(part, raw)
  if (part.kind === 'angles') return gradeRadianList(part, raw, part.id === 'all')
  throw new Error(`factor has no ${part.kind} part`)
}
