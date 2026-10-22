// @vitest-environment jsdom
/**
 * Unit 5's figures (components/TrigFigure): no figure where the graph waits behind the Graph panel's gate, the graph she
 * reads, the four cards of og.match named only by their letters, and the reference triangle of it.compose: its sides
 * labelled solid, each label off the sides and off the others (300 seeds), the side she finds only once she has found
 * it, and a negative angle turning clockwise.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { TrigAnswer, TrigFigureSpec } from '@/content/types'
import { labelHalfSize, legLabelsAt, TrigFigure } from './TrigFigure'
import { segHitsBox } from './trigTriangle'

const LOOP_TIMEOUT = 120_000
const CX = 160
const CY = 160

const answerOf = (moduleId: 'sinusoids' | 'otherTrigGraphs' | 'inverseTrig', templateId: string, seed: number) => generateProblem(moduleId, templateId, seed).answer as TrigAnswer

function firstWith(templateId: string, ok: (a: TrigAnswer) => boolean): TrigAnswer {
  const module = templateId.startsWith('sg') ? 'sinusoids' : templateId.startsWith('og') ? 'otherTrigGraphs' : 'inverseTrig'
  for (let seed = 1; seed < 400; seed++) {
    const a = answerOf(module, templateId, seed)
    if (ok(a)) return a
  }
  throw new Error(`${templateId}: none found`)
}

describe('the kinds Unit 5 adds', () => {
  it('none draws nothing; graph draws the graph she reads; match draws four cards named by their letters', { timeout: LOOP_TIMEOUT }, () => {
    const none: TrigFigureSpec = { kind: 'none', deg: 0, label: '', ariaLabel: '' }
    expect(render(<TrigFigure spec={none} />).container.innerHTML).toBe('')
    const eq = firstWith('sg.equation', (a) => a.figure.kind === 'graph')
    const graph = render(<TrigFigure spec={eq.figure} />)
    expect(graph.container.querySelectorAll('[data-trig-graph]')).toHaveLength(1)
    expect(graph.container.querySelectorAll('[data-trig="marker"]')).toHaveLength(2)
    const match = firstWith('og.match', () => true)
    const cards = render(<TrigFigure spec={match.figure} />)
    const figures = cards.container.querySelectorAll('[data-trig="match"] > figure')
    expect([...figures].map((f) => f.querySelector('figcaption')!.textContent)).toEqual(['Graph A', 'Graph B', 'Graph C', 'Graph D'])
    expect([...figures].map((f) => f.querySelector('svg')!.getAttribute('aria-label'))).toEqual(['Graph A', 'Graph B', 'Graph C', 'Graph D'])
    expect(cards.container.innerHTML).not.toMatch(/NaN/)
  })
})

describe('the reference triangle', () => {
  it(
    'over 300 seeds: each side label off the three sides, off the other labels and inside the figure',
    () => {
      let triangles = 0
      for (let seed = 1; seed <= 300; seed++) {
        const a = answerOf('inverseTrig', 'it.compose', seed)
        if (!a.figure.legs) continue
        triangles++
        const pt = a.figure.point!
        const scale = 96 / Math.max(Math.abs(pt.x), Math.abs(pt.y))
        const P = { x: CX + pt.x * scale, y: CY - pt.y * scale }
        const texts = { x: a.figure.legs.x!.label, y: a.figure.legs.y!.label, r: a.figure.legs.r!.label }
        const at = legLabelsAt(P, texts)
        const boxes = (['x', 'y', 'r'] as const).map((k) => {
          const { w, h } = labelHalfSize(texts[k])
          return { k, box: { l: at[k].x - w, r: at[k].x + w, t: at[k].y - h, b: at[k].y + h } }
        })
        const sides = [
          { a: { x: CX, y: CY }, b: { x: P.x, y: CY } },
          { a: { x: P.x, y: CY }, b: P },
          { a: { x: CX, y: CY }, b: P },
        ]
        for (const { k, box } of boxes) {
          expect(box.l >= 0 && box.t >= 0 && box.r <= 320 && box.b <= 320, `${seed} ${k} inside`).toBe(true)
          for (const s of sides) expect(segHitsBox(s, box), `${seed}: the ${k} label “${texts[k]}” on a side`).toBe(false)
        }
        for (let i = 0; i < 3; i++)
          for (let j = i + 1; j < 3; j++) {
            const p = boxes[i]!.box
            const q = boxes[j]!.box
            expect(p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b, `${seed}: ${boxes[i]!.k} and ${boxes[j]!.k} overlap`).toBe(false)
          }
      }
      expect(triangles).toBeGreaterThan(40)
    },
    LOOP_TIMEOUT,
  )

  it('draws nothing of the triangle before the quadrant, then two sides, then the side she found; Quadrant IV turns clockwise', { timeout: LOOP_TIMEOUT }, () => {
    const a = firstWith('it.compose', (x) => !!x.figure.legs && x.stages[0]!.answerText === 'Q4')
    const side = a.stages[1]!.id as 'x' | 'y' | 'r'
    const labels = (answered: string[]) => {
      const view = render(<TrigFigure spec={a.figure} answered={answered} />)
      const out = [...view.container.querySelectorAll('[data-trig^="leg-"]')].map((t) => t.textContent).filter(Boolean)
      const arc = view.container.querySelector('[data-trig="angle-arc"]')?.getAttribute('data-direction') ?? null
      view.unmount()
      return { out, arc }
    }
    expect(labels([]).out).toEqual([])
    const two = labels(['quadrant'])
    expect(two.out).toHaveLength(2)
    expect(two.out).not.toContain(a.figure.legs![side]!.label)
    expect(two.arc).toBe('clockwise')
    expect(labels(['quadrant', side]).out).toContain(a.figure.legs![side]!.label)
    // The sides are drawn solid: the drop is not dashed on a reference triangle.
    const view = render(<TrigFigure spec={a.figure} answered={['quadrant']} />)
    expect(view.container.querySelector('[data-trig="drop"]')!.getAttribute('stroke-dasharray')).toBeNull()
    expect(view.container.querySelector('[data-trig="leg-x"]')).not.toBeNull()
  })
})
