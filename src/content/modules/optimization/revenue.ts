/**
 * opt.revenue: price and sales. Each $1 increase in the price loses k sales, or each $0.50 decrease brings m more;
 * x is the price in dollars and y the number sold, so the secondary equation is the sales line, the primary is
 * R = xy, and the final equation is R in terms of the price. The price that gives the largest revenue, the number
 * sold there, and that revenue.
 */
import type { Rng } from '@/content/rng'
import { q, qAdd, qMul, type Q } from '@/engine/optim'
import { LogSkip } from '../explog/text'
import { optCalc } from './calc'
import { finalQuadratic, lineEquation, primaryEquation, solve, type Line, type MathText, type OptModel } from './model'
import type { LineSlip, OptDraft, OptWords } from './parts'
import { OPT_RULE_IDS } from './rules'
import { commas, dollarsTex, m, qTex, quadText, sumOf } from './text'
import { countLetter, HINT_COUNT, HINT_EQ_SECONDARY, HINT_MONEY, priceLetter, primaryHint } from './words'

export type RevenueItem = 'tickets' | 'bikes' | 'shirts' | 'boxes'

const ITEMS: Record<RevenueItem, { nouns: [string, string]; opening: (q0: string, p0: string) => string; per: string; done: string }> = {
  tickets: { nouns: ['tickets', 'ticket'], opening: (q0, p0) => `A theater sells ${q0} tickets a night at ${p0} each.`, per: 'ticket price', done: 'sold' },
  bikes: { nouns: ['bikes', 'bike'], opening: (q0, p0) => `A bike shop rents out ${q0} bikes a day at ${p0} each.`, per: 'daily rental price', done: 'rented' },
  shirts: { nouns: ['shirts', 'shirt'], opening: (q0, p0) => `A school store sells ${q0} shirts a month at ${p0} each.`, per: 'shirt price', done: 'sold' },
  boxes: { nouns: ['boxes', 'box'], opening: (q0, p0) => `A bakery sells ${q0} boxes of cookies a day at ${p0} a box.`, per: 'price of a box', done: 'sold' },
}

export interface RevenueOptions {
  item: RevenueItem
  /** Sold now, at the starting price. */
  q0: number
  /** The starting price, in dollars (a whole number or a half). */
  p0: Q
  /** 'up': each $1 increase loses `k`; 'down': each $0.50 decrease adds `k`. */
  change: 'up' | 'down'
  k: number
}

const money = (v: Q) => m(dollarsTex(v))
const plainDollars = (v: Q) => (v.d === 1 ? String(v.n) : (v.n / v.d).toFixed(2))

/** The draft for one revenue problem (exported for the hand-worked tests). */
export function revenueDraft(o: RevenueOptions): OptDraft {
  const it = ITEMS[o.item]
  const [items] = it.nouns
  const p0 = o.p0
  const perDollar = o.change === 'up' ? q(o.k) : q(2 * o.k)
  // y = q0 − perDollar·(x − p0)  ⇔  perDollar·x + y = q0 + perDollar·p0
  const line: Line = { a: perDollar, b: q(1), c: qAdd(q(o.q0), qMul(perDollar, p0)) }
  const model: OptModel = { line, objective: { kind: 'product', k: q(1) }, quantity: 'R' }
  const sol = solve(model)
  if (sol.y.d !== 1 || sol.y.n <= 0) throw new LogSkip('the number sold is not a whole number')
  if (Math.round((sol.x.n / sol.x.d) * 100) !== (sol.x.n / sol.x.d) * 100) throw new LogSkip('the best price is not in cents')
  if (o.change === 'up' && !(sol.x.n / sol.x.d > p0.n / p0.d)) throw new LogSkip('the best price is not an increase')
  if (o.change === 'down' && !(sol.x.n / sol.x.d < p0.n / p0.d)) throw new LogSkip('the best price is not a decrease')
  const p0Text = plainDollars(p0)
  // The sales line as the story writes it: "300 - 20(x - 8)" or "300 + 30(8 - x)".
  const partnerX: MathText =
    o.change === 'up'
      ? { text: `${o.q0} - ${o.k}(x - ${p0Text})`, tex: `${o.q0} - ${o.k}\\left(x - ${qTex(p0)}\\right)` }
      : { text: `${o.q0} + ${2 * o.k}(${p0Text} - x)`, tex: `${o.q0} + ${2 * o.k}\\left(${qTex(p0)} - x\\right)` }
  const yForm = `y = ${partnerX.text}`
  const right = lineEquation(line)
  const simple = sumOf([
    { c: line.c, v: '', p: 0 },
    { c: q(-perDollar.n), v: 'x', p: 1 },
  ])
  const prompt = `${it.opening(m(String(o.q0)), money(p0))} ${o.change === 'up' ? `For each ${money(q(1))} increase in the price, ${m(String(o.k))} fewer ${items} are ${it.done}.` : `For each ${money(q(1, 2))} decrease in the price, ${m(String(o.k))} more ${items} are ${it.done}.`} Let $x$ be the ${it.per} in dollars and $y$ the number of ${items} ${it.done}. What price gives the largest revenue, how many ${items} are ${it.done} at that price, and what is that revenue?`
  const slips: LineSlip[] =
    o.change === 'up'
      ? [
          {
            id: 'opt_revenue_wrong_way',
            line: { a: q(-o.k), b: q(1), c: qAdd(q(o.q0), qMul(q(-o.k), p0)) },
            text: `y = ${o.q0} + ${o.k}(x - ${p0Text})`,
            tex: `y = ${o.q0} + ${o.k}\\left(x - ${qTex(p0)}\\right)`,
            witness: `Your sales go up when the price goes up. Each ${money(q(1))} more in price sells ${m(String(o.k))} fewer ${items}.`,
            why: 'A higher price sells fewer, not more.',
            promise: true,
          },
          {
            id: 'opt_revenue_whole_price',
            line: { a: q(o.k), b: q(1), c: q(o.q0) },
            text: `y = ${o.q0} - ${o.k}x`,
            tex: `y = ${o.q0} - ${o.k}x`,
            witness: `Your sales drop for every dollar of the price, counted from ${money(q(0))}. They drop for each dollar above the starting price, ${money(p0)}.`,
            why: 'The drop counts from the starting price.',
            promise: true,
          },
        ]
      : [
          {
            id: 'opt_revenue_steps',
            line: { a: q(o.k), b: q(1), c: qAdd(q(o.q0), qMul(q(o.k), p0)) },
            text: `y = ${o.q0} + ${o.k}(${p0Text} - x)`,
            tex: `y = ${o.q0} + ${o.k}\\left(${qTex(p0)} - x\\right)`,
            witness: `Your sales change by ${m(String(o.k))} for each dollar, but the step here is ${money(q(1, 2))}: every dollar off the price is two steps.`,
            why: 'Every dollar off the price is two steps.',
            promise: true,
          },
          {
            id: 'opt_revenue_wrong_way',
            line: { a: q(-2 * o.k), b: q(1), c: qAdd(q(o.q0), qMul(q(-2 * o.k), p0)) },
            text: `y = ${o.q0} - ${2 * o.k}(${p0Text} - x)`,
            tex: `y = ${o.q0} - ${2 * o.k}\\left(${qTex(p0)} - x\\right)`,
            witness: `Your sales go down when the price goes down. Each ${money(q(1, 2))} off the price sells ${m(String(o.k))} more ${items}.`,
            why: 'A lower price sells more, not fewer.',
            promise: true,
          },
        ]
  const primary = primaryEquation(model)
  const words: OptWords = {
    quantity: 'revenue',
    extremePhrase: 'the largest revenue',
    letters: { x: priceLetter('Price x'), y: countLetter('Number sold y', it.nouns) },
    bestAsk: { x: 'What price $x$ gives the largest revenue?', y: `What number ${it.done}, $y$, gives the largest revenue?` },
    otherAsk: { x: `How many ${items} are ${it.done} at that price?`, y: `What is the price $x$ for that number ${it.done}?` },
    maxLabel: 'Largest revenue',
    maxAsk: 'What is the largest revenue?',
    maxDim: 'money',
    maxUnitRequired: false,
    maxUnitForms: (t) => [`$${t}`, `$${commas(t)}`, `${t} dollars`],
    maxShow: (v) => money(v),
    numberHint: { best: { x: HINT_MONEY, y: HINT_COUNT }, other: { x: HINT_COUNT, y: HINT_MONEY }, max: HINT_MONEY },
  }
  const final = finalQuadratic(model, 'x')
  const zeroSales = line.c.n / line.c.d / (perDollar.n / perDollar.d)
  return {
    question: 'revenue',
    model,
    goal: 'max',
    prompt,
    instructions: 'Write the secondary equation (the number sold, from the price), the primary equation (the revenue), and the final equation in one variable. Then find the price, the number sold and the largest revenue. Each part opens when the one before it is right.',
    domain: { x: [0, zeroSales], y: [0, line.c.n / line.c.d] },
    units: { money: true, count: [...it.nouns] },
    places: null,
    words,
    secondary: {
      ask: `Write the secondary equation: the number ${it.done}, $y$, in terms of the price $x$.`,
      nudge:
        o.change === 'up'
          ? `Start from the ${m(String(o.q0))} ${it.done} now and take away ${m(String(o.k))} for every dollar the price $x$ is above ${money(p0)}.`
          : `Start from the ${m(String(o.q0))} ${it.done} now and add ${m(String(o.k))} for every ${money(q(1, 2))} the price $x$ is below ${money(p0)}.`,
      reveal: [
        o.change === 'up'
          ? `Each dollar above ${money(p0)} loses ${m(String(o.k))} ${items}: $y = ${partnerX.tex}$, which is $y = ${simple.tex}$.`
          : `Each ${money(q(1, 2))} below ${money(p0)} adds ${m(String(o.k))} ${items}, so each dollar adds ${m(String(2 * o.k))}: $y = ${partnerX.tex}$, which is $y = ${simple.tex}$.`,
      ],
      formatHint: HINT_EQ_SECONDARY,
      rightNote: `Right: that is the number of ${items} ${it.done} at price $x$.`,
      wrongNote: `That is not how the number ${it.done} changes with the price. Start from the number ${it.done} now and change it for every step the price moves.`,
      forms: [yForm, right.text, `y = ${simple.text}`],
      slips,
      extra: [
        {
          id: 'opt_primary_secondary_swapped',
          text: primary.text,
          witness: 'That is the primary equation, the revenue. The secondary equation says how the number sold depends on the price, with no $R$ in it.',
          promise: false,
        },
      ],
    },
    primary: {
      ask: 'Write the primary equation: the revenue $R$ in terms of $x$ and $y$.',
      nudge: 'Revenue is the price of one times the number sold.',
      reveal: [`The price times the number sold: $${primary.tex}$.`],
      formatHint: primaryHint('R'),
      rightNote: 'Right: that is the revenue.',
      wrongNote: 'That is not the revenue. Revenue is the price times the number sold.',
      slips: [],
      extra: [
        {
          id: 'opt_primary_secondary_swapped',
          text: yForm,
          witness: 'That is the secondary equation, the number sold. The primary equation says what $R$, the revenue, is.',
          promise: false,
        },
      ],
    },
    partner: { x: partnerX },
    ruleCards: [OPT_RULE_IDS.revenue, OPT_RULE_IDS.equations, OPT_RULE_IDS.final, OPT_RULE_IDS.vertex, OPT_RULE_IDS.readBack],
    calc: optCalc({ final, goal: 'max', xWindow: [0, Number(zeroSales.toFixed(4))], value: sol.value, ends: [0, 0], quantityWords: 'the revenue', inputWords: 'the price' }),
    calcExpr: quadText(final, 'x').text,
  }
}

const STARTS = [5, 6, 8, 10, 12, 15, 18, 20, 25]

export function drawRevenue(rng: Rng): OptDraft {
  const item = rng.pick(['tickets', 'bikes', 'shirts', 'boxes'] as const)
  const change = rng.chance(0.65) ? 'up' : 'down'
  if (change === 'up') {
    const k = rng.pick([2, 4, 5, 6, 8, 10, 12, 15, 20, 25] as const)
    // With an odd k, whole-dollar prices keep the counts whole (k·price is the number sold at the best price).
    const halves = k % 2 === 0
    const p0 = q(rng.pick(STARTS) * 2 + (halves && rng.chance(0.25) ? 1 : 0), 2)
    // The best price: some half dollars (whole dollars for an odd k) above the start.
    const best = qAdd(p0, halves ? q(rng.int(1, 24), 2) : q(rng.int(1, 12)))
    const y = qMul(q(k), best)
    if (y.d !== 1) throw new LogSkip('k times the price is not whole')
    const q0 = 2 * y.n - k * (p0.n / p0.d)
    if (!Number.isInteger(q0) || q0 < 20) throw new LogSkip('a starting count that is not whole')
    return revenueDraft({ item, q0, p0, change, k })
  }
  const p0 = q(rng.pick(STARTS) * 2 + (rng.chance(0.25) ? 1 : 0), 2)
  const k = rng.pick([2, 3, 4, 5, 6, 8, 10, 12, 15] as const)
  const best = qAdd(p0, q(-rng.int(1, Math.max(1, Math.floor((p0.n / p0.d) * 2 * 0.45))), 2))
  if (best.n <= 0) throw new LogSkip('a price below nothing')
  // y = 2k·x at the best price
  const y = qMul(q(2 * k), best)
  if (y.d !== 1) throw new LogSkip('the number sold is not whole')
  const q0 = 2 * y.n - 2 * k * (p0.n / p0.d)
  if (!Number.isInteger(q0) || q0 < 20) throw new LogSkip('a starting count that is not whole')
  return revenueDraft({ item, q0, p0, change, k })
}

