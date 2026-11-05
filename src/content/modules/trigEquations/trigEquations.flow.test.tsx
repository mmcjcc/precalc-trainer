// @vitest-environment jsdom
/**
 * trigEquations on the screen: the promised mistake is named, the fix is accepted, the problem finishes,
 * and a reload keeps the part she is on.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { TrigEquationsAnswer, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '@/pages/Problem'
import { gradeTePart } from './index'

const FLOW_TIMEOUT = 120_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement

function enter(part: TrigPart, value: string) {
  if (part.kind === 'choice') {
    const label = part.choices?.find((c) => c.value === value)?.label ?? value
    fireEvent.click(screen.getByRole('radio', { name: label }))
  } else {
    fireEvent.change(field(part.label), { target: { value } })
  }
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
const finals = () => events('final_answer')
const doneEvent = () => events('problem_done')[0]

beforeEach(() => {
  resetStoreForTests()
})

const TEMPLATES = ['te.linear', 'te.factor'] as const

describe.each(TEMPLATES)('trigEquations %s on the screen', (templateId) => {
  it('names the promised mistake, takes the fix, and finishes', () => {
    const p = generateProblem('trigEquations', templateId, 1)
    if (p.answer.type !== 'trigEquations') throw new Error('kind')
    const a = p.answer as TrigEquationsAnswer
    renderAt(problemPath('trigEquations', templateId, 1))
    expect(screen.getByText(p.instructions)).toBeTruthy()
    expect(document.querySelectorAll('.katex').length).toBeGreaterThan(0)
    let named = false
    for (const [i, part] of a.stages.entries()) {
      expect(screen.getByRole('heading', { name: `Part ${i + 1} of ${a.stages.length}: ${part.label}` })).toBeTruthy()
      if (part.id === a.trapStage) {
        const before = finals().length
        enter(part, a.trapAnswer!)
        click('Check')
        const alert = screen.getByRole('alert')
        const info = ERROR_PATTERNS[a.trap!]
        expect(alert.textContent).toContain(info.title)
        expect(alert.textContent).toContain(info.lesson)
        expect(alert.textContent).toContain('Example:')
        const g = gradeTePart(a, part.id, a.trapAnswer!)
        if (g.verdict !== 'mistake') throw new Error(`trap graded ${g.verdict}`)
        expect(g.mistake).toBe(a.trap)
        expect(alert.textContent).toContain(g.witness)
        expect(finals()).toHaveLength(before + 1)
        expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap })
        click('Check')
        expect(finals()).toHaveLength(before + 1)
        named = true
      }
      enter(part, part.answerText)
      click('Check')
      expect(finals().at(-1)).toMatchObject({ correct: true })
    }
    expect(named).toBe(true)
    expect(doneEvent()).toMatchObject({ finalCorrect: false })
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  }, FLOW_TIMEOUT)

  it('a reload keeps what she typed and the part she is on', () => {
    const p = generateProblem('trigEquations', templateId, 2)
    if (p.answer.type !== 'trigEquations') throw new Error('kind')
    const a = p.answer as TrigEquationsAnswer
    const path = problemPath('trigEquations', templateId, 2)
    const first = a.stages[0]!
    const view = renderAt(path)
    const draft = first.kind === 'choice' ? first.choices!.find((c) => c.value !== first.answerText)!.value : 'not yet'
    enter(first, draft)
    view.unmount()
    expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [first.id]: draft })
    const again = renderAt(path)
    if (first.kind === 'choice') {
      const label = first.choices!.find((c) => c.value === draft)!.label
      expect((screen.getByRole('radio', { name: label }) as HTMLInputElement).checked).toBe(true)
    } else {
      expect(field(first.label).value).toBe(draft)
    }
    enter(first, first.answerText)
    click('Check')
    again.unmount()
    expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
    renderAt(path)
    const second = a.stages[1]!
    expect(screen.getByRole('heading', { name: `Part 2 of ${a.stages.length}: ${second.label}` })).toBeTruthy()
  }, FLOW_TIMEOUT)
})