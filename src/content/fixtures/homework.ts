import type { PatternId } from '../../engine/types'

export type HomeworkFixture = {
  id: string
  module: string
  old: string
  new: string
  expectedPattern: PatternId | null
  note: string
}

/** Seed corpus. Append real homework lines over time; CI runs every row. */
export const HOMEWORK: HomeworkFixture[] = [
  {
    id: 'sign-flip-legal',
    module: 'inequalities',
    old: '-14 <= -14x',
    new: '1 >= x',
    expectedPattern: null,
    note: 'divide by -14 and flip',
  },
  {
    id: 'sign-flip-legal-swapped',
    module: 'inequalities',
    old: '-14 <= -14x',
    new: 'x <= 1',
    expectedPattern: null,
    note: 'same solution set after flip + swap',
  },
  {
    id: 'sign-flip-illegal',
    module: 'inequalities',
    old: '-14 <= -14x',
    new: 'x >= 1',
    expectedPattern: 'no_sign_flip',
    note: 'divided by negative, did not flip',
  },
  {
    id: 'minus-teleport',
    module: 'properties',
    old: 'y = 1/(-x+2)',
    new: 'y = -1/(x+2)',
    expectedPattern: 'minus_teleport',
    note: 'minus teleported out of the first denominator term only',
  },
  {
    id: 'minus-teleport-legal',
    module: 'properties',
    old: 'y = 1/(-x+2)',
    new: 'y = -1/(x-2)',
    expectedPattern: null,
    note: 'factor -1 from the whole denominator',
  },
  {
    id: 'partial-dist',
    module: 'properties',
    old: 'x(y+2) = 0',
    new: 'x*y + 2 = 0',
    expectedPattern: 'partial_distribute',
    note: 'constant term missed the multiplier',
  },
  {
    id: 'partial-dist-legal',
    module: 'properties',
    old: 'x(y+2) = 0',
    new: 'x*y + 2x = 0',
    expectedPattern: null,
    note: 'full distribution',
  },
  {
    id: 'constant-fold',
    module: 'inverses',
    old: 'y = cbrt(7x+3)-1',
    new: 'y = cbrt(7x+2)',
    expectedPattern: 'const_into_radical',
    note: 'constant folded into the cube root',
  },
  {
    id: 'add-both-sides',
    module: 'inequalities',
    old: '3x - 2 <= 7',
    new: '3x <= 9',
    expectedPattern: null,
    note: 'add 2 to both sides',
  },
]
