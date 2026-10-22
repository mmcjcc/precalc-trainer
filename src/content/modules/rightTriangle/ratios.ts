/**
 * rt.ratios: two sides of a right triangle (whole numbers), the third side first, then one, two or three of the six
 * ratios of the marked acute angle θ, exactly. The third side may be a radical (legs 2 and 3: √13). The figure labels
 * the two sides she is given and θ; the third side gets its length only once she has found it.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart } from '@/content/types'
import {
  RATIO_SIDES,
  exactInt,
  exactNum,
  exactSay,
  exactTex,
  exactText,
  hypotenuseOf,
  hypotenuseSlips,
  legOf,
  legSlips,
  rtRatio,
  rtRatioSlips,
  type RtRole,
  type RtSides,
  type TrigExact,
  type TrigFn,
} from '@/engine/trig'
import { LogSkip } from '../explog/text'
import { rtRatiosCalc, nspireExactKeys, tiExactKeys } from '../trig/calc'
import { m, plain } from '../trig/text'
import { exactForms, exactTraps, type Drafted } from './common'
import { RT_RULE_IDS } from './rules'
import { cornerWords, plainShape, roleWords, triangleSpec } from './shapes'
import { RT_EXACT_HINT } from './words'

const FN_ORDER: readonly TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']
const WORD: Record<RtRole, string> = { opp: 'opposite', adj: 'adjacent', hyp: 'hypotenuse' }

export interface RatiosInput {
  /** Exactly two of the three sides, named from θ: whole numbers. */
  given: Partial<Record<RtRole, number>>
  fns: TrigFn[]
  rightAt: 'left' | 'right'
  thetaAt: 'base' | 'top'
}

/** The ratios problem for these sides (exported for the hand-worked tests). */
export function ratiosProblem(o: RatiosInput): Drafted {
  const roles: RtRole[] = ['opp', 'adj', 'hyp']
  const missing = roles.find((r) => o.given[r] === undefined)
  if (!missing || roles.filter((r) => o.given[r] !== undefined).length !== 2) throw new Error('two sides are given')
  const known: Partial<Record<RtRole, TrigExact>> = {}
  for (const r of roles) if (o.given[r] !== undefined) known[r] = exactInt(o.given[r]!)
  const otherLeg: RtRole = missing === 'opp' ? 'adj' : 'opp'
  const third = missing === 'hyp' ? hypotenuseOf(known.opp!, known.adj!) : legOf(known[otherLeg]!, known.hyp!)
  const sides = { ...known, [missing]: third } as RtSides
  const theta = (Math.atan2(exactNum(sides.opp), exactNum(sides.adj)) * 180) / Math.PI
  const shape = plainShape({ theta, rightAt: o.rightAt, thetaAt: o.thetaAt })
  const fns = FN_ORDER.filter((f) => o.fns.includes(f))

  // Part 1: the third side, by the Pythagorean theorem.
  const thirdText = exactText(third)
  const sq = (v: number) => `${v}^{2}`
  let thirdReveal: string
  if (missing === 'hyp') {
    const a = o.given.opp!
    const b = o.given.adj!
    const sum = a * a + b * b
    const tail = exactTex(third) === `\\sqrt{${sum}}` ? '' : ` = ${exactTex(third)}`
    thirdReveal = `The two sides you know are the legs, so the third side is the hypotenuse ${m('c')}: ${m(`c^{2} = ${sq(a)} + ${sq(b)} = ${a * a} + ${b * b} = ${sum}`)}, so ${m(`c = \\sqrt{${sum}}${tail}`)}.`
  } else {
    const h = o.given.hyp!
    const a = o.given[otherLeg]!
    const diff = h * h - a * a
    const tail = exactTex(third) === `\\sqrt{${diff}}` ? '' : ` = ${exactTex(third)}`
    thirdReveal = `${m(String(h))} is the hypotenuse, across from the right angle, so the third side is a leg ${m('b')}: ${m(`b^{2} = ${sq(h)} - ${sq(a)} = ${h * h} - ${a * a} = ${diff}`)}, so ${m(`b = \\sqrt{${diff}}${tail}`)}.`
  }
  const sidePart: TrigPart = {
    id: 'side',
    kind: 'value',
    label: 'Third side',
    ask: 'What is the length of the third side, the side with no label? Give it exactly.',
    formatHint: RT_EXACT_HINT,
    nudge: `Use the Pythagorean theorem, ${m('a^{2} + b^{2} = c^{2}')}, with ${m('c')} the hypotenuse, the side across from the right angle. Simplify the radical.`,
    ruleCard: RT_RULE_IDS.pythag,
    reveal: [thirdReveal],
    answerText: thirdText,
    forms: exactForms(third),
    check: { kind: 'value', value: thirdText },
    wrongNote: 'That is not the third side. Find which side is the hypotenuse, then use the Pythagorean theorem.',
    traps: exactTraps(missing === 'hyp' ? hypotenuseSlips(known.opp!, known.adj!) : legSlips(known[otherLeg]!, known.hyp!)),
  }

  // Then each ratio of θ.
  const fnParts = fns.map((fn): TrigPart => {
    const [top, bottom] = RATIO_SIDES[fn]
    const v = rtRatio(fn, sides)
    const raw = `\\frac{${exactTex(sides[top])}}{${exactTex(sides[bottom])}}`
    const simplified = plain(m(raw)) === plain(m(exactTex(v))) ? '' : ` = ${exactTex(v)}`
    const rationalized = sides[bottom].root > 1 ? ', with the denominator rationalized' : ''
    const answerText = exactText(v)
    return {
      id: fn,
      kind: 'value',
      label: `${fn} θ`,
      ask: `What is ${m(`\\${fn}\\theta`)}? Give the exact value.`,
      formatHint: RT_EXACT_HINT,
      nudge: `${m(`\\${fn}\\theta = \\frac{\\text{${WORD[top]}}}{\\text{${WORD[bottom]}}}`)}. Name each side from ${m('\\theta')}, and rationalize a square root in the denominator.`,
      ruleCard: fn === 'csc' || fn === 'sec' || fn === 'cot' ? RT_RULE_IDS.reciprocal : RT_RULE_IDS.soh,
      reveal: [`${m(`\\${fn}\\theta = \\frac{\\text{${WORD[top]}}}{\\text{${WORD[bottom]}}} = ${raw}${simplified}`)}${rationalized}.`],
      answerText,
      forms: exactForms(v),
      check: { kind: 'value', value: answerText, fn },
      wrongNote: `That is not ${fn} θ. Name the sides from θ (opposite, adjacent, hypotenuse) and use ${fn} θ = ${WORD[top]}/${WORD[bottom]}.`,
      traps: exactTraps(rtRatioSlips(fn, sides)),
    }
  })

  const names = fns.map((f) => m(`\\${f}\\theta`))
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`
  const givenWords =
    missing === 'hyp'
      ? `the legs are ${m(String(Math.min(o.given.opp!, o.given.adj!)))} and ${m(String(Math.max(o.given.opp!, o.given.adj!)))}`
      : `one leg is ${m(String(o.given[otherLeg]!))} and the hypotenuse is ${m(String(o.given.hyp!))}`
  const prompt = `In the right triangle shown, ${givenWords}. Find the third side, then the exact value${names.length > 1 ? 's' : ''} of ${list}.`

  const labels: Partial<Record<RtRole, { text: string; after?: string }>> = {}
  for (const r of roles) labels[r] = r === missing ? { text: exactSay(third), after: 'side' } : { text: String(o.given[r]!) }
  const corner = cornerWords(shape, shape.at)
  const said = roles.filter((r) => r !== missing).map((r) => `${cap(roleWords(r, 'θ'))} is labelled ${o.given[r]!}.`)
  const ariaLabel = `A right triangle with its right angle marked and the angle θ at ${corner}. ${said.join(' ')} The third side has no label.${shape.toScale ? '' : ' Not drawn to scale.'}`

  const first = fnParts[0]!
  const [top, bottom] = RATIO_SIDES[first.id as TrigFn]
  return {
    question: 'ratios',
    prompt,
    figure: { kind: 'triangle', deg: 0, label: '', triangle: triangleSpec(shape, { sides: labels, angle: 'θ' }), ariaLabel },
    stages: [sidePart, ...fnParts],
    promisable: [sidePart, ...fnParts].flatMap((s) => s.traps),
    calc: rtRatiosCalc({
      a: missing === 'hyp' ? o.given.opp! : o.given[otherLeg]!,
      b: missing === 'hyp' ? o.given.adj! : o.given.hyp!,
      hypGiven: missing !== 'hyp',
      third: exactNum(third),
      ratio: { fn: first.id, topKeys: tiExactKeys(sides[top]), bottomKeys: tiExactKeys(sides[bottom]), topNs: nspireExactKeys(sides[top]), bottomNs: nspireExactKeys(sides[bottom]), value: exactNum(rtRatio(first.id as TrigFn, sides)) },
    }),
    calcExpr: missing === 'hyp' ? `sqrt(${o.given.opp!}^2 + ${o.given.adj!}^2)` : `sqrt(${o.given.hyp!}^2 - ${o.given[otherLeg]!}^2)`,
    ruleCards: [RT_RULE_IDS.soh, RT_RULE_IDS.pythag, RT_RULE_IDS.reciprocal],
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Pythagorean triples with every side at most 41 and none of them 30 (a number on the rule cards). */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [9, 12, 15],
  [12, 16, 20],
  [15, 20, 25],
  [21, 28, 35],
  [24, 32, 40],
  [5, 12, 13],
  [10, 24, 26],
  [15, 36, 39],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [12, 35, 37],
  [9, 40, 41],
]

/** Draw until `ok`, from the same generator (a redraw keeps the seed deciding everything). */
function until<T>(draw: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 200; i++) {
    const v = draw()
    if (ok(v)) return v
  }
  throw new LogSkip('no value found')
}

const isSquare = (n: number) => Number.isInteger(Math.sqrt(n))

/**
 * Two legs, or a leg and the hypotenuse; from a Pythagorean triple (every side whole) or from small whole numbers that
 * leave the third side a radical. The legs are never equal (that is the special-triangle template).
 */
export function drawRatios(rng: Rng): Drafted {
  const legsKnown = rng.chance(0.5)
  let given: Partial<Record<RtRole, number>>
  if (rng.chance(0.55)) {
    const [p, r, c] = rng.pick(TRIPLES)
    const [a, b] = rng.chance(0.5) ? [p, r] : [r, p]
    given = legsKnown ? { opp: a, adj: b } : rng.chance(0.5) ? { opp: a, hyp: c } : { adj: b, hyp: c }
  } else if (legsKnown) {
    // From 2 up: a side of 1 makes a ratio equal the other side (tan θ = 9/1), which the figure already shows.
    const [a, b] = until(
      () => [rng.int(2, 9), rng.int(2, 9)] as const,
      ([x, y]) => x !== y && !isSquare(x * x + y * y),
    )
    given = { opp: a, adj: b }
  } else {
    const [a, c] = until(
      () => [rng.int(2, 9), rng.int(3, 12)] as const,
      ([x, y]) => x < y && !isSquare(y * y - x * x),
    )
    given = rng.chance(0.5) ? { opp: a, hyp: c } : { adj: a, hyp: c }
  }
  return ratiosProblem({ given, fns: drawFns(rng), rightAt: rng.chance(0.5) ? 'left' : 'right', thetaAt: rng.chance(0.65) ? 'base' : 'top' })
}

function drawFns(rng: Rng): TrigFn[] {
  const count = rng.pick([1, 2, 2, 3] as const)
  const pool: TrigFn[] = ['sin', 'sin', 'sin', 'cos', 'cos', 'cos', 'tan', 'tan', 'tan', 'csc', 'sec', 'cot']
  const fns = new Set<TrigFn>()
  for (let i = 0; i < 30 && fns.size < count; i++) fns.add(rng.pick(pool))
  return [...fns]
}
