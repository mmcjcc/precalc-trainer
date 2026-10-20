// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { allTemplates, generateProblem } from '@/content'
import { extraInstructions, PhoneHeader, ProgressDots } from './PhoneHeader'

describe('extraInstructions: only what the title does not say', () => {
  it('drops a sentence that repeats the title', () => {
    expect(extraInstructions('(g − f)(x)', 'Find (g − f)(x).')).toBe('')
    expect(extraInstructions('Find the domain of f', 'Find the domain of f.')).toBe('')
  })

  it('keeps a sentence with something new, and only those', () => {
    expect(extraInstructions('(g − f)(6)', 'Find (g − f)(6) from the table.')).toBe('Find (g − f)(6) from the table.')
    expect(extraInstructions('Find the domain of f', 'Find the domain of f. Write it in interval notation.')).toBe('Write it in interval notation.')
    expect(extraInstructions('Solve the inequality', 'Solve for x. Give the answer in interval notation and set-builder notation.')).toBe(
      'Solve for x. Give the answer in interval notation and set-builder notation.',
    )
  })

  it('treats a plural and its singular as the same word', () => {
    expect(extraInstructions('Corresponding parts', 'Corresponding part.')).toBe('')
  })

  it('never invents text: whatever it keeps is whole sentences of the instructions', () => {
    for (const { module, template } of allTemplates()) {
      const p = generateProblem(module.id, template.id, 1, {})
      const kept = extraInstructions(p.title, p.instructions)
      if (kept) expect(p.instructions.replace(/\s+/g, ' ')).toContain(kept.split(/(?<=[.!?]) /)[0]!)
    }
  }, 120_000)
})

describe('ProgressDots', () => {
  it('one dot per part: done, current, to do, with the progress line in words for screen readers', () => {
    const { container } = render(<ProgressDots progress={{ stage: 1, total: 3, label: 'find x', solved: false, offPath: false }} />)
    expect(Array.from(container.querySelectorAll('[data-dot]')).map((d) => d.getAttribute('data-dot'))).toEqual(['done', 'current', 'todo'])
    for (const dot of container.querySelectorAll('[data-dot]')) expect(dot.getAttribute('aria-hidden')).toBe('true')
    const words = screen.getByText('stage 1 of 3 · find x')
    expect(words.className).toContain('sr-only')
    expect(words.parentElement?.getAttribute('aria-live')).toBe('polite')
  })

  it('all done once solved; a count instead of a long row of dots', () => {
    const solved = render(<ProgressDots progress={{ stage: 2, total: 2, label: 'solved', solved: true, offPath: false }} />)
    expect(Array.from(solved.container.querySelectorAll('[data-dot]')).map((d) => d.getAttribute('data-dot'))).toEqual(['done', 'done'])
    solved.unmount()
    const long = render(<ProgressDots progress={{ stage: 4, total: 14, label: 'line 5', solved: false, offPath: false }} />)
    expect(long.container.querySelectorAll('[data-dot]')).toHaveLength(0)
    expect(screen.getByText('4/14')).toBeTruthy()
  })
})

describe('PhoneHeader', () => {
  function renderHeader(instructions: string) {
    return render(
      <MemoryRouter>
        <PhoneHeader
          title="Solve the inequality"
          instructions={instructions}
          closeTo="/m/inequalities"
          closeLabel="Close, back to Inequalities"
          progress={{ stage: 0, total: 2, label: 'start', solved: false, offPath: false }}
        />
      </MemoryRouter>,
    )
  }

  it('one row: × back to the module, the title on one line, the dots', () => {
    renderHeader('Solve for x. Give the answer in interval notation and set-builder notation.')
    const close = screen.getByRole('link', { name: 'Close, back to Inequalities' })
    expect(close.getAttribute('href')).toBe('/m/inequalities')
    const title = screen.getByRole('heading', { level: 1, name: 'Solve the inequality' })
    expect(title.className).toContain('truncate')
    expect(close.parentElement).toBe(title.parentElement)
  })

  it('the instructions as one line that a tap unfolds; none when they only repeat the title', () => {
    const view = renderHeader('Solve for x. Give the answer in interval notation and set-builder notation.')
    const line = screen.getByText(/Give the answer in interval notation/)
    expect(line.className).toContain('truncate')
    fireEvent.click(line)
    expect(line.className).not.toContain('truncate')
    view.unmount()
    const { container } = renderHeader('Solve the inequality.')
    expect(container.querySelector('[data-instructions]')).toBeNull()
  })
})
