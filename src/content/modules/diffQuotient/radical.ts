import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildInstance, step } from './build'
import { shifted } from './text'

/**
 * f(x) = sqrt(x) or sqrt(x + c). Rationalize the NUMERATOR: multiply top and bottom by the conjugate
 * sqrt(x + h + c) + sqrt(x + c), leave the bottom factored, cancel h. Answer 1/(sqrt(x + h) + sqrt(x)).
 */
export const dqRadicalTemplate: TemplateDef = {
  id: 'dq.radical',
  title: 'Radical f(x) = √x',
  description: 'Multiply by the conjugate to clear the roots on top, then the h cancels. Also √(x + c).',
  version: 1,
  knobs: [],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const shift = rng.chance(0.5)
    const c = shift ? rng.intExcept(-4, 5, [0]) : 0
    const inner0 = shifted('x', c)
    const inner1 = shifted('x + h', c)
    const r0 = `sqrt(${inner0})`
    const r1 = `sqrt(${inner1})`
    const conj = `${r1} + ${r0}`
    const steps = [
      step(`(${r1} - ${r0})(${conj})/(h(${conj}))`, 'rewrite_fraction', `Multiply the top AND the bottom by the conjugate ${conj}.`, 'conjugate', 'multiplied by the conjugate'),
      step(
        `(${inner1} - ${c === 0 ? 'x' : `(${inner0})`})/(h(${conj}))`,
        'distribute',
        'Multiply out the top: (√A − √B)(√A + √B) = A − B, so the square roots on top disappear. Leave the bottom factored.',
        'conjugate',
        'roots cleared on top',
      ),
      step(`h/(h(${conj}))`, 'combine_like', 'Combine like terms on top: only h is left.', 'combine-like', 'like terms combined'),
      step(`1/(${conj})`, 'simplify', 'Cancel the h on top with the h underneath (h ≠ 0).', 'factor-h', 'h cancelled'),
    ]
    const edge = -c
    return buildInstance({
      templateId: 'dq.radical',
      version: 1,
      seed,
      knobs,
      f: r0,
      fxh: r1,
      steps,
      restrictions: ['h != 0', `x >= ${edge}`, `x + h >= ${edge}`],
      note: 'The square roots moved to the bottom, and that is fine: what matters is that no h is left underneath on its own.',
      // f(x0) = 1 and f(x0 + h0) = 2: a secant with slope 1/3.
      secant: { x0: edge + 1, h0: 3 },
      xDomain: [edge - 1, edge + 7],
      params: { c },
    })
  },
}
