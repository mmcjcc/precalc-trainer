/**
 * opt.pens: n identical pens side by side (n = 2, 3, 4) sharing the fences between them, as on the worksheet: n + 1
 * fences across the row and 2n along it, or n along it when a wall runs down the other long side. The problem asks
 * for the largest combined area, or the largest area of each pen.
 */
import type { Rng } from '@/content/rng'
import { q } from '@/engine/optim'
import { LogSkip } from '../explog/text'
import { optCalc } from './calc'
import { penFigure } from './figure'
import { fenceDomain, finalQuadratic, lineEquation, primaryEquation, solve, type Line, type OptModel } from './model'
import type { LineSlip, ObjectiveSlip, OptDraft } from './parts'
import { OPT_RULE_IDS } from './rules'
import { countWord, linText, m, quadText } from './text'
import { allClean, fenceWords, HINT_EQ_SECONDARY, primaryHint, roundingSentence, UNIT_WORDS, type LengthUnit } from './words'

export type PensContext = 'corral' | 'kennel' | 'plot' | 'pen'

const CONTEXT: Record<PensContext, { noun: string; who: string; wall: string }> = {
  corral: { noun: 'corral', who: 'A rancher', wall: 'barn' },
  kennel: { noun: 'kennel', who: 'An animal shelter', wall: 'shelter wall' },
  plot: { noun: 'garden plot', who: 'A community garden', wall: 'brick wall' },
  pen: { noun: 'pen', who: 'A farmer', wall: 'stone wall' },
}

export interface PensOptions {
  n: number
  P: number
  unit: LengthUnit
  wall: boolean
  /** The letter of the fences across the row (the ends and the ones between neighbours). */
  across: 'x' | 'y'
  /** The combined area of all the pens, or the area of each one. */
  ask: 'combined' | 'each'
  context: PensContext
  places: number | null
}

/** The draft for one row-of-pens problem (exported for the hand-worked tests). */
export function pensDraft(o: PensOptions): OptDraft {
  const ctx = CONTEXT[o.context]
  const u = UNIT_WORDS[o.unit]
  const along = o.across === 'x' ? 'y' : 'x'
  const N = o.n
  const nounN = `${ctx.noun}s`
  const lineOf = (acrossCount: number, alongCount: number): Line =>
    o.across === 'x' ? { a: q(acrossCount), b: q(alongCount), c: q(o.P) } : { a: q(alongCount), b: q(acrossCount), c: q(o.P) }
  const alongCount = o.wall ? N : 2 * N
  const line = lineOf(N + 1, alongCount)
  const k = o.ask === 'combined' ? N : 1
  const model: OptModel = { line, objective: { kind: 'product', k: q(k) }, quantity: 'A' }
  const sol = solve(model)
  const clean = allClean([sol.x, sol.y, sol.value])
  const places = clean ? null : o.places
  const right = lineEquation(line)
  const primary = primaryEquation(model)
  const between = N - 1
  // "both corrals", "all three corrals"
  const allOf = N === 2 ? `both ${nounN}` : `all ${countWord(N)} ${nounN}`
  const capitalAllOf = allOf[0]!.toUpperCase() + allOf.slice(1)
  const betweenWords = N === 2 ? 'the two ends and the one between them' : `the two ends and the ones between ${nounN}`
  const opening = o.wall
    ? `${ctx.who} has ${m(String(o.P))} ${u.short} of fencing to build ${countWord(N)} identical rectangular ${nounN} side by side along a ${ctx.wall}. The ${ctx.wall} is the back of every ${ctx.noun}, so it needs no fence, and neighbours share the fence between them.`
    : `${ctx.who} has ${m(String(o.P))} ${u.short} of fencing to build ${countWord(N)} identical rectangular ${nounN} side by side in a row, sharing the fences between neighbours.`
  const lettering = o.wall
    ? `In the figure, $${o.across}$ is each fence across the row, from the ${ctx.wall} to the front (${betweenWords}), and $${along}$ is the front side of each ${ctx.noun}.`
    : `In the figure, $${o.across}$ is each fence across the row (${betweenWords}) and $${along}$ is the length of each ${ctx.noun} along the row.`
  const question = o.ask === 'combined' ? `What dimensions of each ${ctx.noun} give the largest combined area, and what is that area?` : `What dimensions give each ${ctx.noun} the largest area, and what is that area?`
  const prompt = `${opening} ${lettering} ${question}${clean ? '' : ` ${roundingSentence(places)}`}`

  const slips: LineSlip[] = [
    {
      id: 'opt_pen_ends_short',
      line: lineOf(N, alongCount),
      witness: `Your equation has ${countWord(N)} fences across the row, one for each ${ctx.noun}. Count them in the figure: the two ends, and one between each pair of neighbours.`,
      why: `The fences across the row are one more than the number of ${nounN}.`,
      promise: true,
    },
    o.wall
      ? {
          id: 'opt_wall_fenced',
          line: lineOf(N + 1, 2 * N),
          witness: `Your equation puts fence along the ${ctx.wall} as well. The ${ctx.wall} is the back of every ${ctx.noun}, so that side needs no fence.`,
          why: `The ${ctx.wall} side needs no fence.`,
          promise: true,
        }
      : {
          id: 'opt_pen_long_short',
          line: lineOf(N + 1, N),
          witness: `Your equation has ${countWord(N)} sides along the row, the top edge only. The bottom edge has a side for every ${ctx.noun} as well.`,
          why: `Every ${ctx.noun} has a side on the top edge and another on the bottom edge.`,
          promise: true,
        },
  ]

  const objectiveSlips: ObjectiveSlip[] =
    o.ask === 'combined'
      ? [
          {
            id: 'opt_area_one_pen',
            objective: { kind: 'product', k: q(1) },
            witness: `Your $A$ is the area of one ${ctx.noun}. The problem asks for ${allOf} together.`,
            why: `${capitalAllOf} together have ${N === 2 ? 'twice' : `${countWord(N)} times`} the area of one.`,
            maxWitness: `That is the area of one ${ctx.noun}. The question asks for the combined area of ${allOf}.`,
            promise: true,
          },
          ...[N - 1, N + 1]
            .filter((c) => c >= 2)
            .map((c) => ({
              id: 'opt_area_wrong_count' as const,
              objective: { kind: 'product' as const, k: q(c) },
              witness: `Your $A$ counts ${countWord(c)} ${nounN}. This problem has ${countWord(N)}.`,
              why: `This problem has ${countWord(N)} ${nounN}.`,
              maxWitness: `That is the area of ${countWord(c)} ${nounN}. This problem has ${countWord(N)}.`,
              promise: true,
            })),
        ]
      : [
          {
            id: 'opt_area_wrong_count',
            objective: { kind: 'product', k: q(N) },
            witness: `Your $A$ is the area of ${allOf} together. The problem asks for the area of each one.`,
            why: `The problem asks for the area of each ${ctx.noun}, one at a time.`,
            maxWitness: `That is the combined area of ${allOf}. The question asks for the area of each one.`,
            promise: true,
          },
        ]

  const fence = linText(line.a, line.b)
  const extremePhrase = o.ask === 'combined' ? 'the largest combined area' : `the largest area of each ${ctx.noun}`
  return {
    question: 'pens',
    model,
    goal: 'max',
    prompt,
    instructions: `Write the secondary equation (the fencing), the primary equation (the ${o.ask === 'combined' ? 'combined area' : `area of each ${ctx.noun}`}), and the final equation in one variable. Then find the dimensions and the largest area. Each part opens when the one before it is right.`,
    figure: penFigure({ pens: N, wall: o.wall, wallLabel: ctx.wall, across: o.across, along, noun: ctx.noun }),
    domain: fenceDomain(line),
    units: { lengthUnit: o.unit },
    places,
    words: fenceWords({
      unit: o.unit,
      places,
      extremePhrase,
      maxLabel: o.ask === 'combined' ? 'Largest combined area' : `Largest area of each ${ctx.noun}`,
      maxAsk: o.ask === 'combined' ? `What is the largest combined area of the ${countWord(N)} ${nounN}? Give it with its units.` : `What is the largest area of each ${ctx.noun}? Give it with its units.`,
      ...(o.ask === 'combined' ? { countNoun: nounN } : {}),
    }),
    secondary: {
      ask: `Write the secondary equation: how the ${m(String(o.P))} ${u.short} of fencing is used, in terms of $x$ and $y$.`,
      nudge: o.wall
        ? `Count the fences in the figure: the ones across the row (the two ends and the ones between neighbours) and the ones along the front of every ${ctx.noun}. The ${ctx.wall} needs none. Then add them up.`
        : `Count the fences in the figure: the ones across the row (the two ends and the ones between neighbours) and the ones along it (the top and the bottom of every ${ctx.noun}). Then add them up.`,
      reveal: [
        `Across the row: ${countWord(N + 1)} fences of length $${o.across}$, the two ends and ${countWord(between)} between. Along it: ${countWord(alongCount)} of length $${along}$, ${o.wall ? `one at the front of each ${ctx.noun}` : `the top and the bottom of each ${ctx.noun}`}. So $${right.tex}$.`,
      ],
      formatHint: HINT_EQ_SECONDARY,
      rightNote: 'Right: that is how the fencing is used.',
      wrongNote: 'That does not add up the fence in the figure. Count the fences across the row and along it, each one once.',
      forms: [right.text],
      slips,
      extra: [
        {
          id: 'opt_primary_secondary_swapped',
          text: primary.text,
          witness: 'That is the primary equation, the area. The secondary equation is the fencing: it adds up the fenced sides, with no $A$ in it.',
          promise: false,
        },
        {
          id: 'opt_area_as_fence',
          text: `${k === 1 ? '' : k}xy = ${o.P}`,
          witness: `Your equation makes the area $${o.P}$. The ${m(String(o.P))} ${u.short} is fencing, a length: it is what the fences add up to.`,
          promise: false,
        },
      ],
    },
    primary: {
      ask:
        o.ask === 'combined'
          ? `Write the primary equation: the combined area $A$ of the ${countWord(N)} ${nounN}, in terms of $x$ and $y$.`
          : `Write the primary equation: the area $A$ of each ${ctx.noun}, in terms of $x$ and $y$.`,
      nudge: o.ask === 'combined' ? `Each ${ctx.noun} is $x$ by $y$. The combined area is that many times the area of one.` : `Each ${ctx.noun} is $x$ by $y$: its area is its length times its width.`,
      reveal: [o.ask === 'combined' ? `Each ${ctx.noun} has area $xy$, and there are ${countWord(N)} of them: $${primary.tex}$.` : `Each ${ctx.noun} is $x$ by $y$, so $${primary.tex}$.`],
      formatHint: primaryHint('A'),
      rightNote: 'Right: that is the area.',
      wrongNote: o.ask === 'combined' ? `That is not the combined area. Each ${ctx.noun} is x by y: count the ${nounN}.` : `That is not the area of one ${ctx.noun}. Each ${ctx.noun} is x by y.`,
      slips: objectiveSlips,
      extra: [
        {
          id: 'opt_area_as_fence',
          text: `A = ${fence.text}`,
          witness: 'Your $A$ adds up the fence: that is a length, the fencing. The area of a rectangle is length times width.',
          promise: false,
        },
        {
          id: 'opt_primary_secondary_swapped',
          text: right.text,
          witness: 'That is the secondary equation, the fencing. The primary equation says what $A$, the area, is.',
          promise: false,
        },
      ],
    },
    ruleCards: [OPT_RULE_IDS.fences, OPT_RULE_IDS.equations, OPT_RULE_IDS.final, OPT_RULE_IDS.vertex, OPT_RULE_IDS.readBack],
    calc: optCalc({
      final: finalQuadratic(model, 'x'),
      goal: 'max',
      xWindow: [0, fenceDomain(line).x[1]],
      value: sol.value,
      ends: [0, 0],
      quantityWords: o.ask === 'combined' ? 'the combined area' : 'the area of each pen',
      inputWords: 'the x',
    }),
    calcExpr: quadText(finalQuadratic(model, 'x'), 'x').text,
  }
}

/** The fence length that makes every answer a whole number, for n pens with or without a wall. */
function cleanStep(n: number, wall: boolean): number {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a)
  const lcm = (a: number, b: number) => (a * b) / g(a, b)
  return wall ? lcm(2 * (n + 1), 2 * n) : lcm(2 * (n + 1), 4 * n)
}

export function drawPens(rng: Rng): OptDraft {
  const n = rng.pick([2, 2, 3, 3, 3, 4] as const)
  const wall = rng.chance(0.25)
  const across: 'x' | 'y' = rng.chance(0.8) ? 'x' : 'y'
  const ask = rng.chance(0.65) ? 'combined' : 'each'
  const unit: LengthUnit = rng.chance(0.8) ? 'ft' : 'm'
  const context = rng.pick(['corral', 'kennel', 'plot', 'pen'] as const)
  let P: number
  if (rng.chance(0.55)) {
    const step = cleanStep(n, wall)
    const lo = Math.ceil(120 / step)
    const hi = Math.max(lo, Math.floor(1500 / step))
    P = step * rng.int(lo, hi)
  } else {
    P = rng.pick([50, 100] as const) * rng.int(2, 12)
  }
  if (P < 100) throw new LogSkip('too little fence')
  const places = rng.chance(0.5) ? null : 2
  return pensDraft({ n, P, unit, wall, across, ask, context, places })
}
