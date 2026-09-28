import { describe, expect, it } from 'vitest'
import { splitDomain } from './graphBreaks'

describe('splitDomain', () => {
  it('leaves a window alone when nothing breaks it', () => {
    expect(splitDomain(-8, 8)).toEqual([[-8, 8]])
    expect(splitDomain(-8, 8, [])).toEqual([[-8, 8]])
    expect(splitDomain(-8, 8, [-8, 8, 20])).toEqual([[-8, 8]])
  })

  it('cuts 1/x at x = 0 so the branches are separate spans', () => {
    expect(splitDomain(-8, 8, [0])).toEqual([
      [-8, 0],
      [0, 8],
    ])
  })

  it('cuts f and g at different asymptotes, and ignores duplicates', () => {
    expect(splitDomain(-10, 10, [0, 3, 3])).toEqual([
      [-10, 0],
      [0, 3],
      [3, 10],
    ])
  })
})
