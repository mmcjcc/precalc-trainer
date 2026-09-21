import { makeRng } from '@/content/rng'
import type { CanonicalStep, DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildInstance, step } from './build'
import { mono, sum, times } from './text'

type Shape = 'full' | 'noLinear' | 'noConst'

/**
 * f(x) = ax^2 + bx + c with a = ±1 common, missing terms, negatives. Answer: 2ax + ah + b (it still
 * contains h). Path: square the binomial (keeping a), distribute a and b, distribute the minus,
 * combine, factor out h, cancel.
 */
export const dqQuadraticTemplate: TemplateDef = {
  id: 'dq.quadratic',
  title: 'Quadratic f(x) = ax² + bx + c',
  description: 'Square the binomial, subtract ALL of f(x), factor out h. The answer keeps an h.',
  version: 1,
  knobs: [{ key: 'negativeLead', label: 'Negative x² coefficient (the minus trap)', default: undefined }],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const negative = knobs.negativeLead === true || (knobs.negativeLead !== false && rng.chance(0.35))
    const mag = rng.pick([1, 1, 2, 3, 4, 5])
    const a = negative ? -mag : mag
    const shape = rng.pick<Shape>(['full', 'full', 'noLinear', 'noConst'])
    const b = shape === 'noLinear' ? 0 : rng.intExcept(-6, 6, [0])
    const c = shape === 'noConst' ? 0 : rng.intExcept(-9, 9, [0])
    const f = sum([mono(a, 2), mono(b, 1), mono(c)])
    const fx = `(${f})`
    const bPart = b === 0 ? '' : times(b, 'x + h')
    const expanded = [mono(a, 2), mono(2 * a, 1, 1), mono(a, 0, 2), mono(b, 1), mono(b, 0, 1), mono(c)]
    const answer = sum([mono(2 * a, 1), mono(a, 0, 1), mono(b)])
    const steps: CanonicalStep[] = []
    if (a !== 1) {
      steps.push(
        step(
          `(${sum([times(a, 'x^2 + 2xh + h^2'), bPart, mono(c)])} - ${fx})/h`,
          'distribute',
          `Square the binomial first: (x + h)^2 = x^2 + 2xh + h^2. Keep the ${a === -1 ? 'minus' : a} in front for now.`,
          'square-binomial',
          'square expanded',
        ),
      )
    }
    const distributeWhat = a === 1 ? 'Expand (x + h)^2 = x^2 + 2xh + h^2' : `Distribute the ${a === -1 ? 'minus' : a} to all three terms of the square`
    steps.push(
      step(
        `(${sum(expanded)} - ${fx})/h`,
        'distribute',
        `${distributeWhat}${b === 0 ? '' : ` and the ${b === -1 ? 'minus' : b} into (x + h)`}.`,
        a === 1 ? 'square-binomial' : 'distribute',
        'f(x + h) expanded',
      ),
      step(
        `(${sum([...expanded, mono(-a, 2), mono(-b, 1), mono(-c)])})/h`,
        'distribute',
        'Distribute the minus in front of (f(x)): every term of f(x) changes sign.',
        'minus-parens',
        'minus distributed',
      ),
      step(
        `(${sum([mono(2 * a, 1, 1), mono(a, 0, 2), mono(b, 0, 1)])})/h`,
        'combine_like',
        'Combine like terms on top: everything without an h cancels.',
        'combine-like',
        'like terms combined',
      ),
      step(`h(${answer})/h`, 'factor', 'Every term on top has an h. Factor it out.', 'factor-h', 'h factored out'),
      step(answer, 'simplify', 'Cancel the h on top with the h underneath (h ≠ 0).', 'factor-h', 'h cancelled'),
    )
    // Secant on one side of the vertex, so its slope is clearly not zero.
    const x0 = Math.round(-b / (2 * a)) + 1
    return buildInstance({
      templateId: 'dq.quadratic',
      version: 1,
      seed,
      knobs,
      f,
      steps,
      restrictions: ['h != 0'],
      note: 'Your answer still contains h: a different h picks a different secant line, with a different slope.',
      secant: { x0, h0: 2 },
      xDomain: [x0 - 4, x0 + 5],
      params: { a, b, c, shape },
    })
  },
}
