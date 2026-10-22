// @vitest-environment jsdom
/**
 * The second half's figures, drawn: a right triangle labelled with what she is given, the angle and the right angle
 * marked, the asked side a letter, a side she finds labelled only once found; a uc.given point that waits for the part
 * that settles its quadrant; a uc.solve circle whose angles appear only when she is done, labelled clear of the axes.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { givenFigure, solveFigure } from '@/content/modules/trig/figure'
import type { TrigAnswer } from '@/content/types'
import { labelHalfSize, solveLabelAt, TrigFigure } from './TrigFigure'

const LOOP_TIMEOUT = 120_000
const all = (c: HTMLElement, name: string) => [...c.querySelectorAll(`[data-trig="${name}"]`)]
const texts = (c: HTMLElement) => [...c.querySelectorAll('text')].map((t) => t.textContent ?? '')

function firstWhere(templateId: string, ok: (a: TrigAnswer) => boolean): TrigAnswer {
  for (let seed = 1; seed < 400; seed++) {
    const a = generateProblem('rightTriangle', templateId, seed).answer as TrigAnswer
    if (ok(a)) return a
  }
  throw new Error(`${templateId}: none found`)
}

describe('a right triangle', () => {
  it('rt.ratios: the two sides she is given, θ and the right angle; the third side gets its length once she has found it', { timeout: LOOP_TIMEOUT }, () => {
    const a = firstWhere('rt.ratios', () => true)
    const tri = a.figure.triangle!
    const before = render(<TrigFigure spec={a.figure} answered={[]} />)
    expect(all(before.container, 'tri-side')).toHaveLength(3)
    expect(all(before.container, 'right-mark')).toHaveLength(1)
    expect(all(before.container, 'angle-label').map((t) => t.textContent)).toEqual(['θ'])
    const third = tri.sides.find((s) => s.after === 'side')!
    expect(texts(before.container)).not.toContain(third.label)
    for (const s of tri.sides.filter((x) => !x.after)) expect(texts(before.container)).toContain(s.label)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(a.figure.ariaLabel)
    before.unmount()
    const after = render(<TrigFigure spec={a.figure} answered={['side']} />)
    expect(texts(after.container)).toContain(third.label)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(`now labelled ${third.label}`)
  })

  it('rt.special: both acute angles marked, the given side’s length, x and y on the sides she is asked for, ticks on equal legs', { timeout: LOOP_TIMEOUT }, () => {
    const t30 = firstWhere('rt.special', (a) => a.stages.length === 2)
    const v = render(<TrigFigure spec={t30.figure} />)
    expect(all(v.container, 'angle-label').map((t) => t.textContent).sort()).toEqual(['30°', '60°'])
    expect(texts(v.container)).toEqual(expect.arrayContaining(['x', 'y']))
    for (const part of t30.stages) expect(texts(v.container)).not.toContain(part.answerText)
    v.unmount()
    const t45 = firstWhere('rt.special', (a) => a.prompt.includes('45^{\\circ}'))
    const w = render(<TrigFigure spec={t45.figure} />)
    expect(all(w.container, 'angle-label').map((t) => t.textContent)).toEqual(['45°', '45°'])
    expect(all(w.container, 'equal-tick')).toHaveLength(2)
  })

  it('rt.side: the scene, the asked side as x, the given side and angle; a dimension line for a height up a wall', { timeout: LOOP_TIMEOUT }, () => {
    const ladder = firstWhere('rt.side', (a) => a.figure.triangle!.scene === 'ladder' && a.figure.triangle!.sides.some((s) => s.label === 'x' && s.dimension))
    const v = render(<TrigFigure spec={ladder.figure} />)
    expect(all(v.container, 'scene-wall')).toHaveLength(1)
    expect(all(v.container, 'scene-ladder').length).toBe(2)
    expect(all(v.container, 'dimension').length).toBeGreaterThan(0)
    expect(all(v.container, 'dim-label').map((t) => t.textContent)).toContain('x')
    expect(texts(v.container)).not.toContain(ladder.stages[0]!.answerText)
    v.unmount()
    const lighthouse = firstWhere('rt.side', (a) => a.figure.triangle!.scene === 'lighthouse')
    const w = render(<TrigFigure spec={lighthouse.figure} />)
    // The angle of depression is measured from a horizontal line at the top.
    expect(all(w.container, 'horizontal')).toHaveLength(1)
    const at = all(w.container, 'angle-arc')[0]!.getAttribute('data-at')
    expect(at).toBe('O')
    expect(all(w.container, 'scene-tower')).toHaveLength(1)
    expect(all(w.container, 'scene-boat')).toHaveLength(1)
  })

  it('rt.angle: θ is a letter, never its measure; a figure drawn steeper than the angle says it is not to scale', { timeout: LOOP_TIMEOUT }, () => {
    const a = firstWhere('rt.angle', () => true)
    const v = render(<TrigFigure spec={a.figure} />)
    expect(all(v.container, 'angle-label').map((t) => t.textContent)).toEqual(['θ'])
    expect(v.container.textContent).not.toContain(a.stages[0]!.answerText)
    v.unmount()
    const ramp = firstWhere('rt.side', (x) => x.figure.triangle!.scene === 'ramp')
    expect(ramp.figure.triangle!.toScale).toBe(false)
    render(<TrigFigure spec={ramp.figure} />)
    expect(screen.getByText('Not drawn to scale.')).toBeTruthy()
  })
})

describe('one value and the quadrant', () => {
  it('the point waits for the part that settles its quadrant: until then the axes and the quadrants numbered', () => {
    const spec = givenFigure(-12, 5, '(−12, 5)', 'x', 'x')
    const before = render(<TrigFigure spec={spec} answered={[]} />)
    expect(before.container.querySelector('[data-trig="point"]')).toBeNull()
    expect(before.container.querySelector('[data-trig="terminal"]')).toBeNull()
    expect(all(before.container, 'quadrant-numeral').map((t) => t.textContent)).toEqual(['I', 'II', 'III', 'IV'])
    // Each numeral sits inside its quadrant, clear of both axes.
    for (const t of all(before.container, 'quadrant-numeral')) {
      const { w, h } = labelHalfSize(t.textContent ?? '')
      expect(Math.abs(Number(t.getAttribute('x')) - 160)).toBeGreaterThan(w + 20)
      expect(Math.abs(Number(t.getAttribute('y')) - 160)).toBeGreaterThan(h + 20)
    }
    expect(texts(before.container)).not.toContain('(−12, 5)')
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(spec.ariaLabel)
    before.unmount()
    const after = render(<TrigFigure spec={spec} answered={['x']} />)
    expect(after.container.querySelector('[data-trig="point"]')).not.toBeNull()
    expect(after.container.querySelector('[data-trig="point-label"]')?.textContent).toBe('(−12, 5)')
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/point \(−12, 5\)/)
    after.unmount()
    const done = render(<TrigFigure spec={spec} done />)
    expect(done.container.querySelector('[data-trig="point"]')).not.toBeNull()
  })
})

describe('every angle in one turn', () => {
  it('the angles are drawn only once she is done', () => {
    const spec = solveFigure([240, 300], ['240°', '300°'])
    const before = render(<TrigFigure spec={spec} />)
    expect(before.container.querySelector('[data-trig="terminal"]')).toBeNull()
    expect(before.container.querySelector('[data-trig="unit-circle"]')).not.toBeNull()
    expect(texts(before.container).join(' ')).not.toMatch(/240|300/)
    before.unmount()
    const done = render(<TrigFigure spec={spec} done />)
    expect(all(done.container, 'terminal')).toHaveLength(2)
    expect(all(done.container, 'solution-label').map((t) => t.textContent)).toEqual(['240°', '300°'])
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/240° and 300°/)
  })

  it('every special angle’s label, in either unit, stays clear of both axes and inside the figure', () => {
    const NAMES: Record<number, string> = { 30: 'π/6', 45: 'π/4', 60: 'π/3', 90: 'π/2', 120: '2π/3', 135: '3π/4', 150: '5π/6', 180: 'π', 210: '7π/6', 225: '5π/4', 240: '4π/3', 270: '3π/2', 300: '5π/3', 315: '7π/4', 330: '11π/6' }
    for (const [deg, rad] of Object.entries(NAMES)) {
      for (const text of [`${deg}°`, rad]) {
        const at = solveLabelAt(Number(deg), text)
        const { w, h } = labelHalfSize(text)
        expect(Math.abs(at.y - 160) >= h, `${text}: on the x-axis`).toBe(true)
        expect(Math.abs(at.x - 160) >= w, `${text}: on the y-axis`).toBe(true)
        expect(at.x - w >= 0 && at.x + w <= 320 && at.y - h >= 0 && at.y + h <= 320, `${text}: inside`).toBe(true)
        // Outside the circle, clear of the point and its terminal side.
        expect(Math.hypot(at.x - 160, at.y - 160)).toBeGreaterThan(104 + Math.min(w, h))
      }
    }
  })
})
