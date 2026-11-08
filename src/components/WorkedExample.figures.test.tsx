// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer, TrigAnswer } from '@/content/types'
import { buildWorkedExample } from '@/problem/workedExample'
import { WorkedExample } from './WorkedExample'

function figureJson(answer: GeometryAnswer | TrigAnswer): string {
  return JSON.stringify(answer.figure)
}

describe('WorkedExample figures', () => {
  it('draws the sibling geometry figure, not hers, and shows the part answers', () => {
    const instance = generateProblem('geoSegments', 'gs.addition', 42)
    if (instance.answer.type !== 'geometry') throw new Error('expected geometry')
    const ex = buildWorkedExample(instance)
    expect(ex).not.toBeNull()
    if (!ex || ex.sibling.answer.type !== 'geometry') throw new Error('expected a geometry example')

    expect(figureJson(instance.answer)).not.toBe(figureJson(ex.sibling.answer))

    const { container } = render(<WorkedExample instance={instance} />)
    const figure = container.querySelector('[data-example-figure]')
    const svg = figure?.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-label')).toBe(ex.sibling.answer.figure.ariaLabel)
    expect(svg?.getAttribute('aria-label')).not.toBe(instance.answer.figure.ariaLabel)

    const answers = container.querySelectorAll('[data-example-part-answer]')
    expect(answers.length).toBeGreaterThan(0)
    for (const answer of answers) expect(answer.textContent?.trim().length).toBeGreaterThan(0)
  })

  it('draws the sibling trig figure in its initial state, not hers, and shows the part answers', () => {
    const instance = generateProblem('angleMeasure', 'am.convert', 42)
    if (instance.answer.type !== 'angleMeasure') throw new Error('expected angle measure')
    const ex = buildWorkedExample(instance)
    expect(ex).not.toBeNull()
    if (!ex || ex.sibling.answer.type !== 'angleMeasure') throw new Error('expected an angle-measure example')

    expect(figureJson(instance.answer)).not.toBe(figureJson(ex.sibling.answer))

    const { container } = render(<WorkedExample instance={instance} />)
    const figure = container.querySelector('[data-example-figure]')
    const svg = figure?.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-label')).toBe(ex.sibling.answer.figure.ariaLabel)
    expect(svg?.getAttribute('aria-label')).not.toBe(instance.answer.figure.ariaLabel)
    expect(container.querySelector('[data-trig="reference"]')).toBeNull()

    const answers = container.querySelectorAll('[data-example-part-answer]')
    expect(answers.length).toBeGreaterThan(0)
    for (const answer of answers) expect(answer.textContent?.trim().length).toBeGreaterThan(0)
  })

  it('draws the sibling circle for each Unit 8 template', () => {
    const templates = [
      ['geoTangentChords', 'tc.tangent'],
      ['geoTangentChords', 'tc.arcs'],
      ['geoTangentChords', 'tc.chords'],
      ['geoCircleAngles', 'ia.inscribed'],
      ['geoCircleAngles', 'ia.inside'],
      ['geoCircleAngles', 'ia.outside'],
      ['geoCircleMeasures', 'cm.lengths'],
      ['geoCircleMeasures', 'cm.equation'],
    ] as const
    for (const [moduleId, templateId] of templates) {
      const instance = generateProblem(moduleId, templateId, 42)
      if (instance.answer.type !== 'geometry') throw new Error(templateId)
      const ex = buildWorkedExample(instance)
      expect(ex, templateId).not.toBeNull()
      if (!ex || ex.sibling.answer.type !== 'geometry') throw new Error(templateId)
      expect(figureJson(instance.answer)).not.toBe(figureJson(ex.sibling.answer))
      const { container, unmount } = render(<WorkedExample instance={instance} />)
      const figure = container.querySelector('[data-example-figure]')
      const circle = figure?.querySelector('[data-geo="circle"]')
      expect(circle, templateId).toBeTruthy()
      expect(figure?.querySelector('svg')?.getAttribute('aria-label')).toBe(ex.sibling.answer.figure.ariaLabel)
      unmount()
    }
  })
})
