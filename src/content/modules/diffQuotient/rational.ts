import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildInstance, step } from './build'
import { mono, shifted, sum, times } from './text'

/**
 * f(x) = a/x or a/(x + c). Path: combine the fractions on top over (x + c)(x + h + c), distribute,
 * combine (only −ah survives), divide by h, cancel. Answer: −a/(x(x + h)) or −a/((x + c)(x + h + c)).
 */
export const dqRationalTemplate: TemplateDef = {
  id: 'dq.rational',
  title: 'Rational f(x) = a/x',
  description: 'Combine the fractions on top first, then the h cancels. Also a/(x + c).',
  version: 1,
  knobs: [{ key: 'negativeLead', label: 'Negative numerator', default: undefined }],
  generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
    const rng = makeRng(seed)
    const negative = knobs.negativeLead === true || (knobs.negativeLead !== false && rng.chance(0.3))
    const a = (negative ? -1 : 1) * rng.pick([1, 2, 3, 4, 5, 6])
    const shift = rng.chance(0.5)
    const c = shift ? rng.intExcept(-5, 5, [0]) : 0
    const d0 = shifted('x', c)
    const d1 = shifted('x + h', c)
    const f = `${a}/${c === 0 ? 'x' : `(${d0})`}`
    const fxh = `${a}/(${d1})`
    const den = c === 0 ? 'x(x + h)' : `(${d0})(${d1})`
    const top1 = `${times(a, d0)} ${a > 0 ? '-' : '+'} ${times(Math.abs(a), d1)}`
    const top2 = sum([mono(a, 1), mono(a * c), mono(-a, 1), mono(-a, 0, 1), mono(-a * c)])
    const answer = `${-a}/(${den})`
    const steps = [
      step(`((${top1})/(${den}))/h`, 'rewrite_fraction', `Subtract the two fractions on top over the common denominator ${den}.`, 'common-denominator', 'fractions combined'),
      step(`((${top2})/(${den}))/h`, 'distribute', 'Distribute on top, and let the minus reach every term.', 'minus-parens', 'numerator expanded'),
      step(`(${mono(-a, 0, 1)}/(${den}))/h`, 'combine_like', 'Combine like terms on top: only the h term survives.', 'combine-like', 'like terms combined'),
      step(`${mono(-a, 0, 1)}/(h${den})`, 'rewrite_fraction', 'Dividing by h is multiplying by 1/h: the h joins the denominator.', 'common-denominator', 'divided by h'),
      step(answer, 'simplify', 'Cancel the h on top with the h underneath (h ≠ 0). Leave the denominator factored.', 'factor-h', 'h cancelled'),
    ]
    const excluded = -c
    return buildInstance({
      templateId: 'dq.rational',
      version: 1,
      seed,
      knobs,
      f,
      fxh,
      steps,
      restrictions: ['h != 0', `x != ${excluded}`, `x + h != ${excluded}`],
      note: 'The answer keeps its h, and x and x + h must both stay away from the vertical asymptote.',
      // Both points on the right-hand branch, one and three units past the asymptote.
      secant: { x0: excluded + 1, h0: 2 },
      xDomain: [excluded - 4, excluded + 5],
      params: { a, c },
    })
  },
}
