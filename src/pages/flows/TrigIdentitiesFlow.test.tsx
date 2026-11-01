// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { TrigIdentitiesAnswer, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { lineCardsFor } from '@/problem/cardSources'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

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

function enterPart(part: TrigPart, value: string) {
  if (part.kind === 'choice') {
    const label = part.choices?.find((c) => c.value === value)?.label ?? value
    fireEvent.click(screen.getByRole('radio', { name: label }))
  } else {
    fireEvent.change(field(part.label), { target: { value } })
  }
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const accepted = () => events('step_accepted') as EvOf<'step_accepted'>[]
const rejected = () => events('step_rejected') as EvOf<'step_rejected'>[]
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

beforeEach(() => {
  resetStoreForTests()
})

describe('TrigIdentitiesFlow — ti.express (parts)', () => {
  it(
    'completes canonically across all 3 parts, names the promised trap, ignores unreadable input, and restores draft on reload',
    () => {
      const p = generateProblem('trigIdentities', 'ti.express', 1)
      const a = p.answer as TrigIdentitiesAnswer
      const path = problemPath('trigIdentities', 'ti.express', 1)
      const view = renderAt(path)

      // Part 1: choice
      const part0 = a.stages[0]!
      enterPart(part0, part0.answerText)
      click('Check')
      expect(finals()).toHaveLength(1)
      expect(finals()[0]).toMatchObject({ correct: true })

      // Part 2: choice
      const part1 = a.stages[1]!
      enterPart(part1, part1.answerText)
      click('Check')
      expect(finals()).toHaveLength(2)

      // Part 3: unreadable input records nothing
      const part2 = a.stages[2]!
      enterPart(part2, '???')
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
      expect(finals()).toHaveLength(2)

      // Reload restores draft and stage
      enterPart(part2, 'draft-expr')
      view.unmount()
      renderAt(path)
      expect(field(part2.label).value).toBe('draft-expr')

      // Promised trap on Part 3 names the exact trig_ mistake
      enterPart(part2, a.trapAnswer!)
      click('Check')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS[a.trap!].title)
      expect(finals()).toHaveLength(3)
      expect(finals()[2]).toMatchObject({ correct: false, pattern: a.trap })

      // Canonical final expression finishes the problem
      enterPart(part2, part2.answerText)
      click('Check')
      expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})

describe.each(['ti.simplify', 'ti.verify'] as const)('TrigIdentitiesFlow — %s (step by step)', (templateId) => {
  it(
    'names the promised slip, ignores unreadable input, restores draft on reload, and completes the canonical walk',
    () => {
      const p = generateProblem('trigIdentities', templateId, 1)
      const a = p.answer as TrigIdentitiesAnswer
      const path = problemPath('trigIdentities', templateId, 1)
      const view = renderAt(path)

      // Unreadable input records nothing
      fireEvent.change(field('Next line'), { target: { value: '???' } })
      click('Check this line')
      expect(screen.getByRole('alert').textContent).toContain('This doesn’t count as an attempt')
      expect(useStore.getState().events).toEqual([])

      // Reload restores draft
      fireEvent.change(field('Next line'), { target: { value: 'sin x + cos x' } })
      view.unmount()
      expect(useStore.getState().attempt?.draft).toBe('sin x + cos x')
      renderAt(path)
      expect(field('Next line').value).toBe('sin x + cos x')

      // Promised trap names the exact trig_ mistake
      fireEvent.change(field('Next line'), { target: { value: a.trapAnswer! } })
      click('Check this line')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS[a.trap!].title)
      expect(rejected()).toMatchObject([{ pattern: a.trap }])

      // Walk canonical steps to completion
      for (const step of p.canonical) {
        fireEvent.change(field('Next line'), { target: { value: step.text } })
        click('Check this line')
      }
      expect(accepted()).toHaveLength(p.canonical.length)
      expect(doneEvent()).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'supports Guide Me cards: picking a wrong card names its mistake, picking the right card advances the walk',
    () => {
      const p = generateProblem('trigIdentities', templateId, 2)
      const cards = lineCardsFor(p, p.start!, 0)
      expect(cards.length).toBeGreaterThanOrEqual(2)
      const wrongCard = cards.find((c) => !c.right)!
      const rightCard = cards.find((c) => c.right)!

      renderAt(problemPath('trigIdentities', templateId, 2))
      click('Pick the next line')

      // Pick wrong card
      fireEvent.click(screen.getByRole('button', { name: new RegExp(wrongCard.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS[wrongCard.mistake as keyof typeof ERROR_PATTERNS].title)
      expect(rejected()).toMatchObject([{ pattern: wrongCard.mistake, via: 'card' }])

      // Pick right card
      fireEvent.click(screen.getByRole('button', { name: new RegExp(rightCard.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))
      expect(accepted()).toHaveLength(1)
      expect(accepted()[0]).toMatchObject({ via: 'card' })
    },
    FLOW_TIMEOUT,
  )
})
