/** The store app is for anyone's class: the course names drop the family's "Honors" (courses.test.ts has the family's). */
import { describe, expect, it, vi } from 'vitest'
import { getCourse } from './courses'

vi.mock('@/edition', () => ({
  EDITION: 'store',
  STORE: true,
  STORE_SKIPS_SUBJECTS: ['Chemistry'],
  includesSubject: (subject: string | undefined) => subject !== 'Chemistry',
}))

describe('course names in the store app', () => {
  it('are the plain class names', () => {
    expect(getCourse('precalc')?.title).toBe('Precalculus')
    expect(getCourse('geometry')?.title).toBe('Geometry')
    expect(getCourse('precalc')?.short).toBe('Precalculus')
  })
})
