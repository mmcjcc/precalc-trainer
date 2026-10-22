/**
 * Hand-worked optimization problems, the worksheet's first, through the problem builders and the part grader: the
 * equations she writes, the vertex, the other side, the largest value, and her own two slips named as their ids.
 * Every expected value here was worked out by hand (and is checked again here against the grader, not the builder).
 */
import { describe, expect, it } from 'vitest'
import { q } from '@/engine/optim'
import type { OptimizationAnswer, OptPart } from '@/content/types'
import { finishDraft } from './build'
import { numbersDraft, type NumbersOptions } from './numbers'
import { gradeOptPart, stagesFor } from './parts'
import { pensDraft, type PensOptions } from './pens'
import { revenueDraft, type RevenueOptions } from './revenue'
import { wallDraft, type WallOptions } from './wall'

const first = <T,>(list: readonly T[]) => list[0]!
const wall = (o: Partial<WallOptions> & Pick<WallOptions, 'P'>) => finishDraft(wallDraft({ unit: 'ft', divider: false, across: 'x', context: 'pigpen', places: null, ...o }), first)
const pens = (o: Partial<PensOptions> & Pick<PensOptions, 'n' | 'P'>) =>
  finishDraft(pensDraft({ unit: 'ft', wall: false, across: 'x', ask: 'combined', context: 'corral', places: null, ...o }), first)
const numbers = (o: NumbersOptions) => finishDraft(numbersDraft(o), first)
const revenue = (o: RevenueOptions) => finishDraft(revenueDraft(o), first)

function part(a: OptimizationAnswer, id: string, route: 'x' | 'y' = 'x'): OptPart {
  const p = stagesFor(a, route).find((s) => s.id === id)
  if (!p) throw new Error(`no part ${id}`)
  return p
}

const grade = (a: OptimizationAnswer, id: string, typed: string, route: 'x' | 'y' = 'x') => gradeOptPart(a, part(a, id, route), typed)
const right = (a: OptimizationAnswer, id: string, typed: string, route: 'x' | 'y' = 'x') => expect(grade(a, id, typed, route).verdict, `${id}: ${typed}`).toBe('correct')
const named = (a: OptimizationAnswer, id: string, typed: string, mistake: string, route: 'x' | 'y' = 'x') => expect(grade(a, id, typed, route), `${id}: ${typed}`).toMatchObject({ verdict: 'mistake', mistake })
const note = (a: OptimizationAnswer, id: string, typed: string) => expect(grade(a, id, typed).verdict, `${id}: ${typed}`).toBe('invalid')

describe('the worksheet: a pigpen against a stone wall, 500 ft of fencing', () => {
  const a = wall({ P: 500 })

  it('1. secondary 500 = 2x + y, in any equivalent form', () => {
    for (const t of ['500 = 2x + y', '2x + y = 500', 'y = 500 - 2x', 'y = 500 − 2x', 'x = (500 - y)/2', '4x + 2y = 1000']) right(a, 'secondary', t)
  })

  it('2. primary A = xy; final A = x(500 − 2x), multiplied out or not', () => {
    for (const t of ['A = xy', 'A = x*y', 'xy = A']) right(a, 'primary', t)
    for (const t of ['A = x(500 - 2x)', 'A = 500x - 2x^2', 'A = 500x − 2x²', 'A = -2x^2 + 500x', 'A(x) = 2x(250 - x)']) right(a, 'final', t)
  })

  it('3. x = 125 ft, y = 250 ft, and the largest area 31,250 ft²', () => {
    for (const t of ['125', 'x = 125', '125 ft', '-500/(2(-2))']) right(a, 'best', t)
    for (const t of ['250', 'y = 250 ft', '250 feet']) right(a, 'other', t)
    for (const t of ['31250 ft^2', '31,250 ft²', '31,250 square feet', 'A = 31250 sq ft']) right(a, 'max', t)
  })

  it('4. her first slip: −(−2)/(2·500), a and b swapped in −b/(2a)', () => {
    named(a, 'best', '-(-2)/(2*500)', 'opt_vertex_ab_swapped')
    named(a, 'best', '−(−2)/(2·500)', 'opt_vertex_ab_swapped')
    named(a, 'best', '0.002', 'opt_vertex_ab_swapped')
  })

  it('5. the other vertex slips, and an answer in the wrong box', () => {
    named(a, 'best', '-125', 'opt_vertex_sign')
    named(a, 'best', '250', 'opt_vertex_no_two')
    named(a, 'best', '31250', 'opt_max_as_dimension')
    named(a, 'other', '125', 'opt_dimensions_swapped')
    named(a, 'max', '125 ft^2', 'opt_x_as_max')
    named(a, 'max', '-31250 ft^2', 'opt_opens_wrong_way')
  })

  it('6. the fencing slips: the wall fenced, the wall side in the wrong place, the primary in the secondary box', () => {
    named(a, 'secondary', '2x + 2y = 500', 'opt_wall_fenced')
    named(a, 'secondary', 'x + 2y = 500', 'opt_wall_wrong_side')
    named(a, 'secondary', 'A = xy', 'opt_primary_secondary_swapped')
    named(a, 'primary', 'A = 2x + y', 'opt_area_as_fence')
  })

  it('7. a lost term or the wrong sign in the final equation', () => {
    named(a, 'final', 'A = -2x^2', 'opt_term_dropped')
    named(a, 'final', 'A = 500x', 'opt_term_dropped')
    named(a, 'final', 'A = 2x^2 - 500x', 'opt_opens_wrong_way')
  })

  it('8. the area needs its square unit; a length unit, or a rounding the problem did not ask for, is a note', () => {
    note(a, 'max', '31250')
    note(a, 'max', '31250 ft')
    note(a, 'best', '125 ft^2')
    note(a, 'best', 'y = 125')
    note(a, 'best', '124.9999')
  })

  it('9. the final equation in y: A = y(500 − y)/2, then y first and x second', () => {
    expect(grade(a, 'final', 'A = y(500 - y)/2')).toMatchObject({ verdict: 'correct', route: 'y' })
    right(a, 'best', '250', 'y')
    right(a, 'other', '125', 'y')
    named(a, 'best', '125', 'opt_dimensions_swapped', 'y')
  })
})

describe('the worksheet: three corrals side by side, 400 ft of fencing (4x + 6y = 400)', () => {
  const a = pens({ n: 3, P: 400 })

  it('10. secondary 4x + 6y = 400 and primary A = 3xy', () => {
    for (const t of ['400 = 4x + 6y', 'y = (400 - 4x)/6', '2x + 3y = 200']) right(a, 'secondary', t)
    right(a, 'primary', 'A = 3xy')
  })

  it('11. final A = 200x − 2x²; x = 50 ft, y = 33⅓ ft, 5,000 ft² in all', () => {
    for (const t of ['A = 200x - 2x^2', 'A = 3x(400 - 4x)/6', 'A = x(400 - 4x)/2']) right(a, 'final', t)
    right(a, 'best', '50')
    for (const t of ['100/3', '33 1/3', '33⅓', '33 1/3 ft']) right(a, 'other', t)
    right(a, 'max', '5000 ft^2')
    right(a, 'max', '5,000 square feet')
  })

  it('12. her second slip: A = 2xy for three pens, then the 400x/3 term dropped', () => {
    named(a, 'primary', 'A = 2xy', 'opt_area_wrong_count')
    named(a, 'final', 'A = -4x^2/3', 'opt_term_dropped')
    named(a, 'final', 'A = (400x - 4x^2)/3', 'opt_area_wrong_count')
  })

  it('13. the shared fences miscounted; one pen’s area; y read off the final equation', () => {
    named(a, 'secondary', '3x + 6y = 400', 'opt_pen_ends_short')
    named(a, 'secondary', '4x + 3y = 400', 'opt_pen_long_short')
    named(a, 'primary', 'A = xy', 'opt_area_one_pen')
    named(a, 'other', '100', 'opt_other_from_primary')
    named(a, 'max', '5000/3 ft^2', 'opt_area_one_pen')
  })

  it('14. an exact answer: 33.33 is a rounding the problem did not ask for', () => {
    note(a, 'other', '33.33')
    const rounded = pens({ n: 3, P: 400, places: 2 })
    right(rounded, 'other', '33.33')
    right(rounded, 'other', '33.333')
    note(rounded, 'other', '33.3')
  })
})

describe('more fences, worked by hand', () => {
  it('15. two corrals, 600 ft: 3x + 4y = 600, x = 100, y = 75, 15,000 ft²', () => {
    const a = pens({ n: 2, P: 600 })
    right(a, 'secondary', '3x + 4y = 600')
    right(a, 'primary', 'A = 2xy')
    right(a, 'final', 'A = 300x - 3x^2/2')
    right(a, 'best', '100')
    right(a, 'other', '75')
    right(a, 'max', '15000 ft^2')
    named(a, 'primary', 'A = 3xy', 'opt_area_wrong_count')
  })

  it('16. a divided pen against a barn, 600 ft: 3x + y = 600, x = 100, y = 300, 30,000 ft²', () => {
    const a = wall({ P: 600, divider: true, context: 'garden' })
    right(a, 'secondary', '3x + y = 600')
    right(a, 'final', 'A = 600x - 3x^2')
    right(a, 'best', '100')
    right(a, 'other', '300')
    right(a, 'max', '30000 ft^2')
    named(a, 'secondary', '2x + y = 600', 'opt_pen_ends_short')
  })

  it('17. x along the wall, 400 ft: x + 2y = 400, x = 200, y = 100, 20,000 ft²', () => {
    const a = wall({ P: 400, across: 'y' })
    right(a, 'secondary', 'x + 2y = 400')
    right(a, 'best', '200')
    right(a, 'other', '100')
    right(a, 'max', '20000 ft^2')
    named(a, 'secondary', '2x + y = 400', 'opt_wall_wrong_side')
  })

  it('18. three kennels along a wall, 480 ft: 4x + 3y = 480, x = 60, y = 80, 14,400 ft² in all', () => {
    const a = pens({ n: 3, P: 480, wall: true, context: 'kennel' })
    right(a, 'secondary', '4x + 3y = 480')
    right(a, 'best', '60')
    right(a, 'other', '80')
    right(a, 'max', '14400 ft^2')
    named(a, 'secondary', '4x + 6y = 480', 'opt_wall_fenced')
  })

  it('19. each of two pens, 600 ft: A = xy for one pen, x = 100, y = 75, 7,500 ft² each', () => {
    const a = pens({ n: 2, P: 600, ask: 'each' })
    right(a, 'primary', 'A = xy')
    right(a, 'best', '100')
    right(a, 'max', '7500 ft^2')
    named(a, 'primary', 'A = 2xy', 'opt_area_wrong_count')
    named(a, 'max', '15000 ft^2', 'opt_area_wrong_count')
  })
})

describe('two numbers, worked by hand', () => {
  it('20. a sum of 40, largest product: x = y = 20, P = 400', () => {
    const a = numbers({ condition: 'sum', goal: 'product', s: 40, places: null })
    right(a, 'secondary', 'x + y = 40')
    right(a, 'primary', 'P = xy')
    right(a, 'final', 'P = x(40 - x)')
    right(a, 'best', '20')
    right(a, 'other', '20')
    right(a, 'max', '400')
  })

  it('21. twice the first plus the second is 40: x = 10, y = 20, P = 200; the multiple on the wrong number is named', () => {
    const a = numbers({ condition: 'twice', goal: 'product', s: 40, places: null })
    right(a, 'secondary', '2x + y = 40')
    named(a, 'secondary', 'x + 2y = 40', 'opt_coefficients_swapped')
    right(a, 'best', '10')
    right(a, 'other', '20')
    right(a, 'max', '200')
  })

  it('22. the first is 16 more than the second, smallest product: x = 8, y = −8, P = −64', () => {
    const a = numbers({ condition: 'apart', goal: 'product', s: 16, places: null })
    right(a, 'secondary', 'x - y = 16')
    right(a, 'secondary', 'y = x - 16')
    named(a, 'secondary', 'y - x = 16', 'opt_coefficients_swapped')
    right(a, 'final', 'P = x(x - 16)')
    right(a, 'best', '8')
    right(a, 'other', '-8')
    right(a, 'max', '-64')
    named(a, 'final', 'P = 16x - x^2', 'opt_opens_wrong_way')
  })

  it('23. a sum of 40, smallest sum of squares: x = y = 20, S = 800; (40 − x)² as two terms is named', () => {
    const a = numbers({ condition: 'sum', goal: 'squares', s: 40, places: null })
    right(a, 'primary', 'S = x^2 + y^2')
    named(a, 'primary', 'S = (x + y)^2', 'opt_binomial_square')
    right(a, 'final', 'S = x^2 + (40 - x)^2')
    right(a, 'final', 'S = 2x^2 - 80x + 1600')
    named(a, 'final', 'S = x^2 + 1600 + x^2', 'opt_binomial_square')
    // (40 − x)² as 1600 − x² cancels the x² away: what is left is a number, which the final part says is not a formula.
    note(a, 'final', 'S = x^2 + 1600 - x^2')
    right(a, 'best', '20')
    right(a, 'max', '800')
  })

  it('24. twice the first plus the second is 50, smallest sum of squares: x = 20, y = 10, S = 500', () => {
    const a = numbers({ condition: 'twice', goal: 'squares', s: 50, places: null })
    right(a, 'final', 'S = 5x^2 - 200x + 2500')
    right(a, 'best', '20')
    right(a, 'other', '10')
    right(a, 'max', '500')
  })
})

describe('price and revenue, worked by hand', () => {
  it('25. 300 tickets at $8, 20 fewer for each $1 more: x = $11.50, 230 tickets, $2,645', () => {
    const a = revenue({ item: 'tickets', q0: 300, p0: q(8), change: 'up', k: 20 })
    for (const t of ['y = 300 - 20(x - 8)', 'y = 460 - 20x', '20x + y = 460']) right(a, 'secondary', t)
    right(a, 'primary', 'R = xy')
    right(a, 'final', 'R = x(300 - 20(x - 8))')
    right(a, 'final', 'R = 460x - 20x^2')
    for (const t of ['11.50', '$11.50', '11.5', '23/2']) right(a, 'best', t)
    for (const t of ['230', '230 tickets']) right(a, 'other', t)
    for (const t of ['2645', '$2,645', '$2,645.00', '2645 dollars']) right(a, 'max', t)
  })

  it('26. the sales changed the wrong way, or counted from $0', () => {
    const a = revenue({ item: 'tickets', q0: 300, p0: q(8), change: 'up', k: 20 })
    named(a, 'secondary', 'y = 300 + 20(x - 8)', 'opt_revenue_wrong_way')
    named(a, 'secondary', 'y = 300 - 20x', 'opt_revenue_whole_price')
    named(a, 'best', '23', 'opt_vertex_no_two')
    named(a, 'max', '11.5', 'opt_x_as_max')
  })

  it('27. 60 bikes at $8, 6 more for each $0.50 off: x = $6.50, 78 bikes, $507; a dollar counted as one step is named', () => {
    const a = revenue({ item: 'bikes', q0: 60, p0: q(8), change: 'down', k: 6 })
    right(a, 'secondary', 'y = 60 + 12(8 - x)')
    right(a, 'secondary', 'y = 156 - 12x')
    named(a, 'secondary', 'y = 60 + 6(8 - x)', 'opt_revenue_steps')
    named(a, 'secondary', 'y = 60 - 12(8 - x)', 'opt_revenue_wrong_way')
    right(a, 'best', '6.50')
    right(a, 'other', '78')
    right(a, 'max', '$507')
  })
})
