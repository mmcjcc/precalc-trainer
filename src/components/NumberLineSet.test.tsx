// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SolutionSet } from '@/shared/types'
import { NumberLineSet } from './NumberLineSet'
import { describeSet } from './setDescribe'

const r = (n: number, d = 1) => ({ n, d })

const twoRays: SolutionSet = {
  pieces: [
    { lo: '-inf', hi: r(-2), loClosed: false, hiClosed: true },
    { lo: r(5), hi: 'inf', loClosed: false, hiClosed: false },
  ],
  points: [],
}

describe('describeSet (aria text)', () => {
  it('spells out dots, rays, segments and points in reading order', () => {
    expect(describeSet(twoRays)).toBe('Number line: closed dot at -2, ray to the left; open dot at 5, ray to the right')
    expect(
      describeSet({ pieces: [{ lo: r(-3, 5), hi: r(1), loClosed: true, hiClosed: false }], points: [r(3)] }),
    ).toBe('Number line: segment from -3/5 (closed dot) to 1 (open dot); isolated point at 3')
    expect(describeSet({ pieces: [], points: [] })).toBe('Number line: empty set, nothing shaded')
    expect(describeSet({ pieces: [{ lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false }], points: [] })).toBe(
      'Number line: the whole number line shaded',
    )
  })
})

describe('<NumberLineSet>', () => {
  it('renders an image with the generated label and the right dot kinds', () => {
    render(<NumberLineSet set={twoRays} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toBe('Number line: closed dot at -2, ray to the left; open dot at 5, ray to the right')
    const dots = [...img.querySelectorAll('circle')].map((c) => c.getAttribute('data-dot'))
    expect(dots).toEqual(['closed', 'open'])
    // two shaded strokes (the rays)
    expect(img.querySelectorAll('line[stroke-width="6"]')).toHaveLength(2)
  })

  it('appends a caption to the label and labels fractional endpoints', () => {
    render(
      <NumberLineSet
        set={{ pieces: [{ lo: r(3, 5), hi: 'inf', loClosed: true, hiClosed: false }], points: [] }}
        caption="This is x >= 3/5"
      />,
    )
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toBe('Number line: closed dot at 3/5, ray to the right. This is x >= 3/5')
    expect(img.textContent).toContain('3/5')
  })

  it('shows the empty-set note when nothing is shaded', () => {
    render(<NumberLineSet set={{ pieces: [], points: [] }} />)
    expect(screen.getByRole('img').textContent).toContain('nothing shaded')
  })
})
