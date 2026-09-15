import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { nextFromPath, progressFromPath } from '../progress'
import { inverseCbrtTemplate } from './cbrt'
import { inverseFracLinearTemplate } from './fracLinear'
import { inverseLinearTemplate } from './linear'
import { inverseMobiusTemplate } from './mobius'
import { inverseQuadraticNotTemplate } from './quadraticNot'
import { inverseRationalTemplate } from './rational'

export const INV_RULES = [
  {
    id: 'swap-xy',
    title: 'Swap x and y',
    body: 'The inverse relation is the original with x and y traded. Do this once, then undo the operations.',
    example: 'y = cbrt(x+1)  →  x = cbrt(y+1)',
  },
  {
    id: 'add-sub',
    title: 'Add or subtract both sides',
    body: 'Undo a shift by adding or subtracting the same number on both sides.',
  },
  {
    id: 'cube-both',
    title: 'Cube both sides',
    body: 'Cubing undoes a cube root. Cube roots keep the sign: cbrt(−8) = −2.',
    example: 'x = cbrt(y+1)  →  x^3 = y+1',
  },
  {
    id: 'mul-div',
    title: 'Multiply or divide both sides',
    body: 'Undo a coefficient by multiplying or dividing both sides.',
  },
  {
    id: 'swap-sides',
    title: 'Swap sides',
    body: 'Equals does not care which side is left. Inequalities would flip; equations do not.',
  },
]

export const inversesModule: ModuleDef = {
  id: 'inverses',
  title: 'Inverses',
  blurb: 'Swap x and y, then undo. Check with a stored integer: f(f⁻¹(k)) = k.',
  order: 4,
  templates: [
    inverseLinearTemplate,
    inverseCbrtTemplate,
    inverseFracLinearTemplate,
    inverseRationalTemplate,
    inverseMobiusTemplate,
    inverseQuadraticNotTemplate,
  ],
  ruleCards: INV_RULES,
  progress: progressFromPath,
  nextStep: nextFromPath,
}

registerModule(inversesModule)
