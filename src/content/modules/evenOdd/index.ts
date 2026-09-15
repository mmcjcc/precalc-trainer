import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { nextFromPath, progressFromPath } from '../progress'
import { evenOddBankTemplate } from './bank'
import { evenOddPolyTemplate } from './poly'

export const evenOddModule: ModuleDef = {
  id: 'evenOdd',
  title: 'Even / odd / neither',
  blurb: 'Write f(−x) and −f(x). Domain first, then values. Plug in the stored k.',
  order: 3,
  templates: [evenOddPolyTemplate, evenOddBankTemplate],
  ruleCards: [
    {
      id: 'f-neg-x',
      title: 'Form f(−x)',
      body: 'Replace every x with (−x). Keep the parentheses so the sign applies to the whole x.',
      example: 'f(x) = x^3 - 4x  →  f(−x) = (−x)^3 - 4(−x)',
    },
    {
      id: 'simplify-neg',
      title: 'Simplify (−x)^n',
      body: 'Even powers: (−x)^n = x^n. Odd powers: (−x)^n = −x^n. Cube roots keep the sign: cbrt(−x) = −cbrt(x).',
    },
    {
      id: 'domain-first',
      title: 'Domain first',
      body: 'If f(x) is defined and f(−x) is not (or vice versa), the function is neither. sqrt(x) and 1/(x+2) fail this test.',
    },
    {
      id: 'verdict',
      title: 'Even vs odd',
      body: 'Even: f(−x) = f(x) (mirror across the y-axis). Odd: f(−x) = −f(x) (rotate 180° about the origin).',
    },
  ],
  progress: progressFromPath,
  nextStep: nextFromPath,
}

registerModule(evenOddModule)
