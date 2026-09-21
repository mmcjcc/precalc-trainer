import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildInstance, step } from './build'
import { mono, sum } from './text'

/**
 * f(x) = ax + b, a and b nonzero integers (negatives included). Answer: a. Her Day 5 homework
 * (f(x) = 5x − 2) is exactly this path: distribute the 5, distribute the minus, combine, cancel.
 */
export const dqLinearTemplate: TemplateDef = {
  id: 'dq.linear',
  title: 'Linear f(x) = ax + b',
  description: 'The difference quotient of a line. The minus in front of f(x) must reach both terms.',
  version: 1,
  knobs: [{ key: 'negativeLead', label: 'Negative slope', default: undefined }],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const negative = knobs.negativeLead === true || (knobs.negativeLead !== false && rng.chance(0.4))
    const mag = rng.pick([1, 2, 3, 4, 5, 5, 6, 7, 8])
    const a = negative ? -mag : mag
    const b = rng.intExcept(-9, 9, [0])
    const f = sum([mono(a, 1), mono(b)])
    const steps = []
    if (a !== 1) {
      steps.push(
        step(
          `(${sum([mono(a, 1), mono(a, 0, 1), mono(b)])} - (${f}))/h`,
          'distribute',
          a === -1 ? 'Distribute the minus into (x + h).' : `Distribute the ${a} into (x + h).`,
          'distribute',
          'f(x + h) expanded',
        ),
      )
    }
    steps.push(
      step(
        `(${sum([mono(a, 1), mono(a, 0, 1), mono(b), mono(-a, 1), mono(-b)])})/h`,
        'distribute',
        'Now the minus in front of (f(x)): it changes the sign of BOTH of its terms.',
        'minus-parens',
        'minus distributed',
      ),
      step(`${mono(a, 0, 1)}/h`, 'combine_like', 'Combine like terms on top: the x terms cancel, and so do the numbers.', 'combine-like', 'like terms combined'),
      step(String(a), 'simplify', 'Cancel the h on top with the h underneath (h ≠ 0).', 'factor-h', 'h cancelled'),
    )
    return buildInstance({
      templateId: 'dq.linear',
      version: 1,
      seed,
      knobs,
      f,
      steps,
      restrictions: ['h != 0'],
      note: `Every secant line of a line is the line itself, so the secant slope is the line's own slope: that is why the answer is ${a}, with no h left in it.`,
      secant: { x0: 1, h0: 2 },
      xDomain: [-3, 5],
      params: { a, b },
    })
  },
}
