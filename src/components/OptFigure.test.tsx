// @vitest-environment jsdom
/**
 * The pens' figure. Every figure the two fence templates make (300 seeds each) is laid out and rendered: every label
 * stays off every drawn line (fences, the wall and its hatching), off the other labels and inside the figure; the
 * rendered text sits where the layout puts it; the letters drawn count the fences the way the figure shows them (one
 * more across the row than there are pens, one per pen on each fenced edge); no text is a number; and the drawing is
 * never to scale: its proportions stay at least 20% away from the best pen's, so it cannot hint at the answer.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { penFigure } from '@/content/modules/optimization/figure'
import type { OptimizationAnswer } from '@/content/types'
import { exactFromText } from '@/engine/optim'
import { drawnPen, OptFigure, optFigureLayout, type FigLabel, type FigLine } from './OptFigure'

const HEAVY = 120_000

/** Does the segment pass through the label's box grown by `margin`? (Liang–Barsky clipping.) */
function crosses(s: FigLine, b: FigLabel, margin: number): boolean {
  const l = b.x - b.w - margin
  const r = b.x + b.w + margin
  const t = b.y - b.h - margin
  const btm = b.y + b.h + margin
  let lo = 0
  let hi = 1
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  for (const [p, qq] of [
    [-dx, s.x1 - l],
    [dx, r - s.x1],
    [-dy, s.y1 - t],
    [dy, btm - s.y1],
  ] as const) {
    if (p === 0) {
      if (qq < 0) return false
    } else if (p < 0) lo = Math.max(lo, qq / p)
    else hi = Math.min(hi, qq / p)
    if (lo > hi) return false
  }
  return true
}

const apart = (a: FigLabel, b: FigLabel) => a.x + a.w <= b.x - b.w || b.x + b.w <= a.x - a.w || a.y + a.h <= b.y - b.h || b.y + b.h <= a.y - a.h

describe('the figure of one pen against a wall', () => {
  it('draws the three fenced sides with their letters, the wall hatched and named, and says so in words', () => {
    const spec = penFigure({ pens: 1, wall: true, wallLabel: 'stone wall', across: 'x', along: 'y', noun: 'pen' })
    const { container } = render(<OptFigure spec={spec} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/stone wall along its top side/)
    expect(container.querySelectorAll('[data-opt="fence"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-opt="fence"][data-letter="x"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-opt="fence"][data-letter="y"]')).toHaveLength(1)
    expect(container.querySelector('[data-opt="wall"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-opt="hatch"]').length).toBeGreaterThan(5)
    expect(container.querySelector('[data-opt="wall-label"]')?.textContent).toBe('stone wall')
    expect(screen.getByText('Not drawn to scale.')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/NaN/)
  })

  it('a divided pen: three fences across, one side along the whole row, its letter on a dimension line end to end', () => {
    const spec = penFigure({ pens: 1, divider: true, wall: true, wallLabel: 'barn', across: 'x', along: 'y', noun: 'garden' })
    const { container } = render(<OptFigure spec={spec} />)
    expect(container.querySelectorAll('[data-opt="fence"][data-kind="across"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-opt="fence"][data-kind="along"]')).toHaveLength(1)
    // The letter names the whole side: centred on it, on a dimension line from one end of the row to the other.
    const L = optFigureLayout(spec)
    const y = L.labels.find((lb) => lb.text === 'y')!
    expect(y.x).toBeCloseTo(L.box.x + L.box.w / 2, 6)
    const dimXs = L.dims.flatMap((d) => [d.x1, d.x2])
    expect(Math.min(...dimXs)).toBeCloseTo(L.box.x, 6)
    expect(Math.max(...dimXs)).toBeCloseTo(L.box.x + L.box.w, 6)
    expect(container.querySelectorAll('[data-opt="dim"]').length).toBe(L.dims.length)
    // Pens in a row keep one letter per pen and no dimension line.
    expect(optFigureLayout(penFigure({ pens: 3, wall: false, wallLabel: 'barn', across: 'x', along: 'y', noun: 'corral' })).dims).toEqual([])
  })

  it('three pens in a row: four fences across, three on top and three on the bottom', () => {
    const spec = penFigure({ pens: 3, wall: false, wallLabel: 'barn', across: 'x', along: 'y', noun: 'corral' })
    const { container } = render(<OptFigure spec={spec} />)
    expect(container.querySelectorAll('[data-opt="fence"][data-letter="x"]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-opt="fence"][data-letter="y"]')).toHaveLength(6)
    expect(container.querySelector('[data-opt="wall"]')).toBeNull()
  })
})

describe.each(['opt.wall', 'opt.pens'] as const)('%s: every figure over 300 seeds', (templateId) => {
  it(
    'labels clear of every line and of each other, inside the figure, counted as drawn, no numbers, never to scale',
    () => {
      const problems: string[] = []
      for (let seed = 1; seed <= 300 && problems.length < 10; seed++) {
        const a = generateProblem('optimization', templateId, seed).answer as OptimizationAnswer
        const spec = a.figure!
        const L = optFigureLayout(spec)
        const lines = [...L.fences, ...L.hatch, ...L.dims, ...(L.wall ? [L.wall] : [])]
        for (const lb of L.labels) {
          if (lines.some((s) => crosses(s, lb, 1))) problems.push(`${seed}: ${lb.text} sits on a line`)
          if (lb.x - lb.w < 0 || lb.x + lb.w > L.width || lb.y - lb.h < 0 || lb.y + lb.h > L.height) problems.push(`${seed}: ${lb.text} leaves the figure`)
        }
        for (let i = 0; i < L.labels.length; i++) for (let j = i + 1; j < L.labels.length; j++) if (!apart(L.labels[i]!, L.labels[j]!)) problems.push(`${seed}: two labels overlap`)
        // The rendered text is where the layout says.
        const { container, unmount } = render(<OptFigure spec={spec} />)
        const texts = [...container.querySelectorAll('text')]
        texts.forEach((t, i) => {
          const lb = L.labels[i]!
          if (Math.abs(Number(t.getAttribute('x')) - lb.x) > 0.01 || Math.abs(Number(t.getAttribute('y')) - lb.y) > 0.01 || t.textContent !== lb.text) problems.push(`${seed}: label ${i} drawn elsewhere`)
        })
        // Counted from the drawing: the fences across and along, each with its letter.
        const across = texts.filter((t) => t.textContent === spec.across && L.labels[texts.indexOf(t)]!.kind === 'letter')
        const acrossFences = container.querySelectorAll(`[data-opt="fence"][data-kind="across"][data-letter="${spec.across}"]`).length
        const alongFences = container.querySelectorAll(`[data-opt="fence"][data-kind="along"][data-letter="${spec.along}"]`).length
        if (acrossFences !== spec.pens + 1) problems.push(`${seed}: ${acrossFences} fences across`)
        if (alongFences !== (spec.whole ? 1 : spec.pens) * (spec.wall ? 1 : 2)) problems.push(`${seed}: ${alongFences} fences along`)
        if (across.length < acrossFences) problems.push(`${seed}: an across fence without its letter`)
        if (/\d/.test(container.textContent ?? '') || /\d/.test(spec.ariaLabel)) problems.push(`${seed}: a number in the figure`)
        unmount()
        // Never to scale: the drawn pen's proportions are at least 20% away from the best pen's.
        const value = (id: 'best' | 'other') => {
          const p = a.stages.find((s) => s.id === id)!
          if (p.check.kind !== 'number') throw new Error('not a number')
          const v = exactFromText(p.check.value, a.units)
          return v.n / v.d
        }
        const sides = { x: value('best'), y: value('other') }
        const best = sides[spec.along] / sides[spec.across]
        const d = drawnPen(spec)
        const drawn = (spec.whole ? d.penWidth * 2 : d.penWidth) / d.height
        if (Math.abs(Math.log(drawn / best)) < Math.log(1.2)) problems.push(`${seed}: drawn ${drawn.toFixed(2)} against the best ${best.toFixed(2)}`)
      }
      expect(problems).toEqual([])
    },
    HEAVY,
  )
})
