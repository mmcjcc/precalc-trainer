/**
 * opt.wall: one rectangular pen against a wall, three sides fenced (the worksheet's pigpen), or against a wall with a
 * dividing fence from the wall to the far side. The figure names the sides x and y, sometimes x for the sides that
 * meet the wall and sometimes for the side across from it.
 */
import type { Rng } from '@/content/rng'
import { q } from '@/engine/optim'
import { LogSkip } from '../explog/text'
import { optCalc } from './calc'
import { penFigure } from './figure'
import { fenceDomain, finalQuadratic, lineEquation, objectiveExpr, primaryEquation, solve, type Line, type OptModel } from './model'
import type { LineSlip, OptDraft } from './parts'
import { OPT_RULE_IDS } from './rules'
import { countWord, linText, m, quadText } from './text'
import { allClean, fenceWords, HINT_EQ_SECONDARY, primaryHint, roundingSentence, UNIT_WORDS, type LengthUnit } from './words'

export type WallContext = 'pigpen' | 'garden' | 'dogrun' | 'play'

const CONTEXT: Record<WallContext, { noun: string; wall: string; opening: (P: string, u: string) => string }> = {
  pigpen: { noun: 'pen', wall: 'stone wall', opening: (P, u) => `A farmer has ${P} ${u} of fencing to build a rectangular pigpen against an existing stone wall. The wall is one side of the pen, so only the other three sides need fencing.` },
  garden: { noun: 'garden', wall: 'barn', opening: (P, u) => `A gardener has ${P} ${u} of fencing for a rectangular garden along the side of a barn. The barn is one side of the garden, and the fence runs along the other three.` },
  dogrun: { noun: 'dog run', wall: 'house wall', opening: (P, u) => `A family has ${P} ${u} of fencing to build a rectangular dog run against the back wall of their house. The house wall is one side, so the fence covers the other three.` },
  play: { noun: 'play area', wall: 'school wall', opening: (P, u) => `A school has ${P} ${u} of fencing for a rectangular play area against the gym’s outside wall. The wall is one side, so the fence covers the other three.` },
}

export interface WallOptions {
  P: number
  unit: LengthUnit
  divider: boolean
  /** The letter of the sides that meet the wall (the other letter is the side across from it). */
  across: 'x' | 'y'
  context: WallContext
  /** null: exact answers; a number: round to that many places. Only used when an answer is not a short decimal. */
  places: number | null
}

/** The draft for one wall problem (exported for the hand-worked tests). */
export function wallDraft(o: WallOptions): OptDraft {
  const ctx = CONTEXT[o.context]
  const u = UNIT_WORDS[o.unit]
  const along = o.across === 'x' ? 'y' : 'x'
  const n = o.divider ? 3 : 2
  const lineOf = (acrossCount: number, alongCount: number): Line =>
    o.across === 'x' ? { a: q(acrossCount), b: q(alongCount), c: q(o.P) } : { a: q(alongCount), b: q(acrossCount), c: q(o.P) }
  const line = lineOf(n, 1)
  const model: OptModel = { line, objective: { kind: 'product', k: q(1) }, quantity: 'A' }
  const sol = solve(model)
  const clean = allClean([sol.x, sol.y, sol.value])
  const places = clean ? null : o.places
  const lettering = o.divider
    ? `In the figure, $${o.across}$ is each side that meets the ${ctx.wall}, the dividing fence included, and $${along}$ is the side across from the ${ctx.wall}.`
    : `In the figure, $${o.across}$ is each side that meets the ${ctx.wall} and $${along}$ is the side across from it.`
  const divider = o.divider ? ` A fence from the ${ctx.wall} to the far side will divide the ${ctx.noun} into two parts.` : ''
  const prompt = `${ctx.opening(m(String(o.P)), u.short)}${divider} ${lettering} What dimensions give the largest area, and what is that area?${clean ? '' : ` ${roundingSentence(places)}`}`
  const right = lineEquation(line)
  const slips: LineSlip[] = [
    {
      id: 'opt_wall_fenced',
      line: lineOf(n, 2),
      witness: `Your equation puts fence along the ${ctx.wall} as well. The ${ctx.wall} is one side of the ${ctx.noun}, so that side needs no fence.`,
      why: `The ${ctx.wall} side needs no fence.`,
      promise: true,
    },
    {
      id: 'opt_wall_wrong_side',
      line: o.across === 'x' ? { a: q(1), b: q(n), c: q(o.P) } : { a: q(n), b: q(1), c: q(o.P) },
      witness: `Your equation gives the counts to the wrong letters. In the figure, $${o.across}$ is each side that meets the ${ctx.wall} and $${along}$ is the side across from it.`,
      why: `The sides that meet the ${ctx.wall} are the $${o.across}$ sides.`,
      promise: true,
    },
    ...(o.divider
      ? [
          {
            id: 'opt_pen_ends_short' as const,
            line: lineOf(2, 1),
            witness: `Your equation leaves out the dividing fence. It runs from the ${ctx.wall} to the far side, the same length as the two ends.`,
            why: 'The dividing fence is fence too.',
            promise: true,
          },
        ]
      : []),
  ]
  const fence = linText(line.a, line.b)
  const primary = primaryEquation(model)
  const d: OptDraft = {
    question: 'wall',
    model,
    goal: 'max',
    prompt,
    instructions: 'Write the secondary equation (the fencing), the primary equation (the area), and the final equation in one variable. Then find the dimensions and the largest area. Each part opens when the one before it is right.',
    figure: penFigure({ pens: 1, divider: o.divider, wall: true, wallLabel: ctx.wall, across: o.across, along, noun: ctx.noun }),
    domain: fenceDomain(line),
    units: { lengthUnit: o.unit },
    places,
    words: fenceWords({ unit: o.unit, places, extremePhrase: 'the largest area', maxLabel: 'Largest area', maxAsk: 'What is the largest area? Give it with its units.' }),
    secondary: {
      ask: `Write the secondary equation: how the ${m(String(o.P))} ${u.short} of fencing is used, in terms of $x$ and $y$.`,
      nudge: `Add up the fence in the figure, one term for each side the fence runs along. The side along the ${ctx.wall} needs no fence${o.divider ? ', and the dividing fence counts too' : ''}.`,
      reveal: [
        `The fence runs along ${countWord(n)} sides of length $${o.across}$ (${o.divider ? 'the two ends and the dividing fence' : 'the two that meet the ' + ctx.wall}) and one side of length $${along}$. The ${ctx.wall} side needs none: $${right.tex}$.`,
      ],
      formatHint: HINT_EQ_SECONDARY,
      rightNote: 'Right: that is how the fencing is used.',
      wrongNote: 'That does not add up the fence in the figure. Count each fenced side once, and leave the wall side out.',
      forms: [right.text],
      slips,
      extra: [
        {
          id: 'opt_primary_secondary_swapped',
          text: primary.text,
          witness: `That is the primary equation, the area. The secondary equation is the fencing: it adds up the fenced sides, with no $A$ in it.`,
          promise: false,
        },
        {
          id: 'opt_area_as_fence',
          text: `xy = ${o.P}`,
          witness: `Your equation makes the area $${o.P}$. The ${m(String(o.P))} ${u.short} is fencing, a length: it is what the fenced sides add up to.`,
          promise: false,
        },
      ],
    },
    primary: {
      ask: `Write the primary equation: the area $A$ of the ${ctx.noun} in terms of $x$ and $y$.`,
      nudge: 'The area of a rectangle is its length times its width.',
      reveal: [`The ${ctx.noun} is a rectangle $x$ by $y$, so $A = ${objectiveExpr(model.objective).tex}$.`],
      formatHint: primaryHint('A'),
      rightNote: 'Right: that is the area.',
      wrongNote: 'That is not the area of this rectangle. An area is length times width.',
      slips: [],
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
      quantityWords: 'the area',
      inputWords: 'the x',
    }),
    calcExpr: quadText(finalQuadratic(model, 'x'), 'x').text,
  }
  return d
}

const UNITS: readonly LengthUnit[] = ['ft', 'ft', 'ft', 'ft', 'ft', 'ft', 'm', 'm', 'yd']

export function drawWall(rng: Rng): OptDraft {
  const divider = rng.chance(0.4)
  const across: 'x' | 'y' = rng.chance(0.7) ? 'x' : 'y'
  const unit = rng.pick(UNITS)
  const context: WallContext = unit === 'm' ? 'play' : rng.pick(['pigpen', 'garden', 'dogrun', 'pigpen'] as const)
  let P: number
  if (divider) P = rng.chance(0.65) ? 6 * rng.int(15, 150) : 10 * rng.int(9, 90)
  else P = rng.chance(0.75) ? 4 * rng.int(20, 250) : 2 * rng.int(40, 500)
  if (P < 60) throw new LogSkip('too little fence')
  const places = rng.chance(0.5) ? null : rng.pick([1, 2] as const)
  return wallDraft({ P, unit, divider, across, context, places })
}

