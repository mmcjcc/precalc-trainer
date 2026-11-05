/**
 * te.linear — one trig function, linear in that function, solved on [0, 2π).
 *
 * Exclusions (so the two named slips are real, and the prompt does not already show the isolated equation):
 *  - sin ±1, sin 0, cos ±1 and tan 0 are left out. Each is one solution, or the reference angle is 0,
 *    so "only one quadrant" would be the whole answer.
 *  - cos 0 is kept (two solutions, π/2 and 3π/2, reference π/2). Its wraps never put a bare 0 on the page,
 *    because 0 would be the answer of the isolate step.
 *  - no wrap is "2 sin x = 1". The right side is never the numerator of the reduced value sitting alone
 *    next to the function. Every wrap still has a constant to move, so the sign slip is teachable.
 *  - tan x = ±2 is not used; tangent of 2 is a real angle, not "no solution".
 */
import type { TrigPart } from '@/content/types'
import { gcd, listText, q, readExact, solveAnswer, type TrigFn } from '@/engine/trig'
import { m, plain } from '../trig/text'
import { LIST_RAD_HINT } from '../unitCircle/hints'
import { gradeIsolate, gradeRadianList, gradeReference, mistake } from '../trigFormulas/grade'

const VALUE_HINT = 'An equation: the function, an equals sign, and the exact value.'
const RAD_HINT = 'Radians: an exact multiple of π.'

interface Mag {
  fn: 'sin' | 'cos' | 'tan'
  /** +1 or -1. Zero cosine is a separate row (sign 0). */
  sign: 1 | -1 | 0
  num: number
  den: number
  root: number
  wrap: 0 | 1 | 2 | 3
}

function scaledText(n: number, d: number, root: number): string {
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(Math.abs(n), d)
  n /= g
  d /= g
  if (n === 0) return '0'
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  if (root === 1) return d === 1 ? `${sign}${a}` : `${sign}${a}/${d}`
  const coef = a === 1 ? '' : String(a)
  const body = `${coef}√${root}`
  return d === 1 ? `${sign}${body}` : `${sign}${body}/${d}`
}

function numPlain(abs: number, root: number): string {
  if (root === 1) return String(abs)
  return abs === 1 ? `√${root}` : `${abs}√${root}`
}

function numTex(abs: number, root: number): string {
  if (abs === 0) return '0'
  if (root === 1) return String(abs)
  const rad = `\\sqrt{${root}}`
  return abs === 1 ? rad : `${abs}${rad}`
}

function signedPlain(n: number, root: number): string {
  if (n === 0) return '0'
  const body = numPlain(Math.abs(n), root)
  return n < 0 ? `−${body}` : body
}

/** A·fn(x) + B·√root = C·√root, with A > 0. */
function coeffs(row: Mag): { A: number; B: number; C: number } {
  if (row.sign === 0) {
    const zero = [
      { A: 2, B: 1, C: 1 },
      { A: 3, B: -1, C: -1 },
      { A: 4, B: 2, C: 2 },
      { A: 5, B: -3, C: -3 },
    ]
    return zero[row.wrap]!
  }
  const { num, den, wrap, sign } = row
  if (sign > 0) {
    if (wrap === 0) return { A: den, B: -num, C: 0 }
    if (wrap === 1) return { A: den, B: num, C: 2 * num }
    if (wrap === 2) return { A: 2 * den, B: -2 * num, C: 0 }
    return { A: 2 * den, B: num, C: 3 * num }
  }
  if (wrap === 0) return { A: den, B: num, C: 0 }
  if (wrap === 1) return { A: den, B: -num, C: -2 * num }
  if (wrap === 2) return { A: 2 * den, B: 2 * num, C: 0 }
  return { A: 2 * den, B: -num, C: -3 * num }
}

function equationPlain(fn: string, A: number, B: number, C: number, root: number): string {
  let left = A === 1 ? `${fn} x` : `${A}${fn} x`
  if (B !== 0) left += ` ${B > 0 ? '+' : '−'} ${numPlain(Math.abs(B), root)}`
  return `${left} = ${signedPlain(C, root)}`
}

function equationTex(fn: string, A: number, B: number, C: number, root: number): string {
  let left = A === 1 ? `\\${fn} x` : `${A}\\${fn} x`
  if (B !== 0) left += ` ${B > 0 ? '+' : '-'} ${numTex(Math.abs(B), root)}`
  const right = C < 0 ? `-${numTex(Math.abs(C), root)}` : C === 0 ? '0' : numTex(C, root)
  return `${left} = ${right}`
}

function refDegrees(fn: TrigFn, value: number): number {
  const v = Math.abs(value)
  const near = (target: number) => Math.abs(v - target) <= 1e-9 * Math.max(1, Math.abs(target))
  if (fn === 'tan') {
    if (near(1)) return 45
    if (near(Math.sqrt(3))) return 60
    if (near(Math.sqrt(3) / 3)) return 30
  } else if (fn === 'cos') {
    // Cosine is the complement of sine: |cos| = 1/2 is 60°, |cos| = √3/2 is 30°, and cos 0 is 90°.
    if (near(0)) return 90
    if (near(1 / 2)) return 60
    if (near(Math.sqrt(2) / 2)) return 45
    if (near(Math.sqrt(3) / 2)) return 30
  } else {
    if (near(0)) return 90
    if (near(1 / 2)) return 30
    if (near(Math.sqrt(2) / 2)) return 45
    if (near(Math.sqrt(3) / 2)) return 60
  }
  throw new Error(`no reference angle for ${fn} = ${value}`)
}

function qStr(n: number, d: number): string {
  return d === 1 ? String(n) : `${n}/${d}`
}

export interface LinearItem {
  id: number
  fn: 'sin' | 'cos' | 'tan'
  valueText: string
  slipText: string
  plainEq: string
  refText: string
  refDeg: string
  solutions: string
  solutionDegs: string[]
  one: string
  prompt: string
}

const MAGS: readonly Omit<Mag, 'wrap'>[] = [
  ...(['sin', 'cos'] as const).flatMap((fn) =>
    [1, -1].flatMap((sign) =>
      [
        { num: 1, den: 2, root: 1 },
        { num: 1, den: 2, root: 2 },
        { num: 1, den: 2, root: 3 },
      ].map((mag) => ({ fn, sign: sign as 1 | -1, ...mag })),
    ),
  ),
  { fn: 'cos', sign: 0, num: 0, den: 1, root: 1 },
  ...([1, -1] as const).flatMap((sign) =>
    [
      { num: 1, den: 1, root: 1 },
      { num: 1, den: 1, root: 3 },
      { num: 1, den: 3, root: 3 },
    ].map((mag) => ({ fn: 'tan' as const, sign, ...mag })),
  ),
]

function buildCatalog(): LinearItem[] {
  const out: LinearItem[] = []
  const seen = new Set<string>()
  let id = 0
  for (const mag of MAGS) {
    for (const wrap of [0, 1, 2, 3] as const) {
      const row: Mag = { ...mag, wrap }
      const { A, B, C } = coeffs(row)
      if (B === 0) throw new Error('a wrap with nothing to move')
      const root = row.sign === 0 ? 1 : row.root
      const valueText = scaledText(C - B, A, root)
      const slipText = scaledText(C + B, A, root)
      if (row.sign !== 0 && valueText !== scaledText(row.sign * row.num, row.den, row.root)) {
        throw new Error(`wrap gave ${valueText} for ${row.fn} ${row.sign} ${row.num}/${row.den} √${row.root} wrap ${wrap}`)
      }
      if (valueText === slipText) throw new Error(`sign slip equals the answer: ${valueText}`)
      const exact = readExact(valueText)
      if (!exact || exact === 'undefined') throw new Error(`unreadable value ${valueText}`)
      const solved = solveAnswer(row.fn, exact)
      if (solved.length < 2) throw new Error(`${row.fn} ${valueText} has ${solved.length} solution(s)`)
      const plainEq = equationPlain(row.fn, A, B, C, root)
      // Already-isolated ("sin x = …") is the isolate step's answer. A bare includes(valueText) is wrong
      // here: the value "1" is a substring of a coefficient, and the wraps still have a constant to move.
      if (plainEq.includes(`${row.fn} x =`)) throw new Error(`prompt is already isolated: ${plainEq}`)
      const prompt = `Solve ${m(equationTex(row.fn, A, B, C, root))} for $x$ in $[0, 2\\pi)$.`
      const statement = plain(prompt)
      if (!statement.includes(plainEq)) throw new Error(`plain text drifted:\n${statement}\n${plainEq}`)
      if (seen.has(statement)) throw new Error(`duplicate linear statement ${statement}`)
      seen.add(statement)
      // Reference from the absolute value, not from the first solution (210° still has reference 30°).
      const magnitude = Math.abs((exact.c.n / exact.c.d) * Math.sqrt(exact.root))
      const refDeg = refDegrees(row.fn, magnitude)
      out.push({
        id: id++,
        fn: row.fn,
        valueText,
        slipText,
        plainEq,
        refText: listText([q(refDeg)], 'rad'),
        refDeg: String(refDeg),
        solutions: listText(solved, 'rad'),
        solutionDegs: solved.map((deg) => qStr(deg.n, deg.d)),
        one: listText([solved[0]!], 'rad'),
        prompt,
      })
    }
  }
  if (out.length < 60) throw new Error(`linear catalog has only ${out.length}`)
  return out
}

export const LINEAR_CATALOG: readonly LinearItem[] = buildCatalog()

export function linearStages(item: LinearItem): TrigPart[] {
  return [
    {
      id: 'isolate',
      kind: 'value',
      label: 'Isolated equation',
      ask: 'Isolate the trig function. Write the equation with the function on one side.',
      formatHint: VALUE_HINT,
      nudge: 'Move the constant across the equals sign, and change its sign when you do. Then divide by the number in front of the function.',
      ruleCard: 'te-isolate',
      reveal: [`${item.fn} x = ${item.valueText.replace(/-/g, '−')}.`],
      answerText: `${item.fn} x = ${item.valueText}`,
      forms: [`${item.fn}(x) = ${item.valueText}`, `${item.valueText} = ${item.fn} x`, `${item.fn} x = ${item.valueText.replace(/-/g, '−')}`],
      check: { kind: 'value', value: item.valueText, fn: item.fn },
      wrongNote: 'Get the function by itself. A constant changes sign when it moves across the equals sign.',
      traps: [
        mistake(
          'term_across_sign',
          `${item.fn} x = ${item.slipText}`,
          'Moving that constant across the equals sign flips its sign. Check which way it should go.',
        ),
      ],
    },
    {
      id: 'reference',
      kind: 'angle',
      label: 'Reference angle',
      ask: 'What is the reference angle, in radians?',
      formatHint: RAD_HINT,
      nudge: 'The reference angle is the acute angle with this absolute value. Write it as a fraction times π, not in degrees.',
      ruleCard: 'te-solve',
      reveal: [`The reference angle is ${item.refText}.`],
      answerText: item.refText,
      forms: [`${item.refText.replace('π', 'pi')}`],
      check: { kind: 'angle', unit: 'rad', deg: item.refDeg },
      wrongNote: 'Match the absolute value to 30°, 45°, 60° or 90°, then write that angle in radians.',
      traps: [
        mistake('te_deg_rad', item.refDeg, 'That number is the reference angle in degrees. This answer is in radians: a fraction times π.'),
      ],
    },
    {
      id: 'solutions',
      kind: 'angles',
      label: 'Solutions',
      ask: 'List every solution on [0, 2π). Separate the angles with commas.',
      formatHint: LIST_RAD_HINT,
      nudge: 'Put the reference angle into every quadrant where this function has the sign you isolated. One quadrant is not the whole list.',
      ruleCard: 'te-solve',
      reveal: [`${item.fn} x = ${item.valueText.replace(/-/g, '−')} at ${item.solutions}.`],
      answerText: item.solutions,
      forms: [item.solutionDegs.length > 1 ? [...item.solutions.split(', ')].reverse().join(', ') : item.solutions].filter((form) => form !== item.solutions),
      check: { kind: 'angles', unit: 'rad', degs: item.solutionDegs, fn: item.fn, value: item.valueText },
      wrongNote: 'Check the quadrants for this sign, and stay inside one full turn.',
      traps: [
        mistake('te_one_quadrant', item.one, 'That is one angle where it works. There is another one before a full turn is over.'),
      ],
    },
  ]
}

export function gradeLinearPart(part: TrigPart, raw: string) {
  if (part.id === 'isolate') return gradeIsolate(part, raw)
  if (part.kind === 'angle') return gradeReference(part, raw)
  if (part.kind === 'angles') return gradeRadianList(part, raw, false)
  throw new Error(`linear has no ${part.kind} part`)
}
