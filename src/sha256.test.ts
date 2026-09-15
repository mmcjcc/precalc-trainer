import { describe, expect, it } from 'vitest'
import { sha256hex } from './sha256'

describe('sha256hex', () => {
  it('matches SHA-256("1234")', async () => {
    expect(await sha256hex('1234')).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
  })
})
