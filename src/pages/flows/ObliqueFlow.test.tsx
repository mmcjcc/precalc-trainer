// @vitest-environment jsdom
/**
 * Oblique triangles on the screen (ObliqueFlow). Per template: the promised mistake named (title, lesson, the sentence
 * about her answer, the example) and recorded once, the fix, the records, completion with the worked lines; an
 * unreadable answer records nothing; a reload restores her entries and the part she is on. Then: a rounded-too-early
 * answer is a note that records nothing; the ambiguous case does not count its parts, or draw side a, before she has
 * said how many triangles fit; the Check buttons keep the chunky press.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { EARLY_NOTE, gradeOtPart } from '@/content/modules/obliqueTriangles'
import { answerForms } from '@/content/modules/trig/parts'
import { pieces, showsNumber } from '@/content/modules/trig/text'
import type { ObliqueAnswer, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

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

function load(templateId: string, ok: (a: ObliqueAnswer) => boolean = () => true) {
  for (let seed = 1; seed < 400; seed++) {
    const p = generateProblem('obliqueTriangles', templateId, seed)
    const a = p.answer as ObliqueAnswer
    if (a.trap && ok(a)) return { p, a, seed, path: problemPath('obliqueTriangles', templateId, seed) }
  }
  throw new Error(`${templateId}: none found`)
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement

/** Enter an answer: a typed box, or a choice's radio button. */
function enter(part: TrigPart, value: string) {
  if (part.kind === 'choice') {
    const label = part.choices!.find((c) => c.value === value)!.label
    fireEvent.click(screen.getByRole('radio', { name: label }))
  } else fireEvent.change(field(part.label), { target: { value } })
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

function heading(a: ObliqueAnswer, i: number, countHidden: boolean): string {
  const part = a.stages[i]!
  if (countHidden) return `Part ${i + 1}: ${part.label}`
  return a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${part.label}` : part.label
}

beforeEach(() => {
  resetStoreForTests()
})

const TEMPLATES = ['ot.sines', 'ot.ambiguous', 'ot.cosines', 'ot.area', 'ot.choose'] as const

describe.each(TEMPLATES)('%s on the screen', (templateId) => {
  it(
    'shows the problem with its figure, names the promised mistake, takes the fix, records both, and completes',
    () => {
      // The ambiguous case with two triangles, so the parts after the count are on the screen too.
      const { p, a, path } = load(templateId, (x) => x.question !== 'ambiguous' || x.stages.length > 1)
      const view = renderAt(path)
      expect(screen.getByText(p.instructions)).toBeTruthy()
      for (const piece of pieces(a.prompt).filter((x) => !x.tex && x.text.trim().length > 3)) expect(view.container.textContent).toContain(piece.text.trim())
      expect(view.container.querySelectorAll('.katex').length).toBeGreaterThan(0)
      expect(screen.getAllByRole('img', { name: a.oblique.before.ariaLabel }).length).toBeGreaterThan(0)
      let named = false
      for (const [i, part] of a.stages.entries()) {
        expect(screen.getByRole('heading', { name: heading(a, i, a.question === 'ambiguous' && i === 0) })).toBeTruthy()
        if (part.id === a.trapStage) {
          const before = finals().length
          enter(part, a.trapAnswer!)
          click('Check')
          const alert = screen.getByRole('alert')
          const info = ERROR_PATTERNS[a.trap!]
          expect(alert.textContent).toContain(info.title)
          expect(alert.textContent).toContain(info.lesson)
          expect(alert.textContent).toContain('Example:')
          const g = gradeOtPart(a, part.id, a.trapAnswer!)
          if (g.verdict !== 'mistake') throw new Error(`trap graded ${g.verdict}`)
          expect(alert.textContent).toContain(g.witness)
          expect(showsNumber([alert.textContent ?? ''], answerForms(part)), 'the card names the answer').toBe(false)
          expect(finals()).toHaveLength(before + 1)
          expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
          click('Check')
          expect(finals()).toHaveLength(before + 1)
          named = true
        }
        enter(part, part.answerText)
        click('Check')
        expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      }
      expect(named).toBe(true)
      expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      const worked = screen.getByRole('heading', { name: 'The answer, worked out' }).closest('section')!
      expect(worked.querySelectorAll('[data-worked-line]')).toHaveLength(a.reveal.length)
      expect(worked.querySelectorAll('.katex').length).toBeGreaterThan(0)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(templateId, (x) => x.stages.some((s) => s.kind !== 'choice'))
      renderAt(path)
      // Answer the parts before the first typed one.
      const typed = a.stages.findIndex((s) => s.kind !== 'choice')
      for (const part of a.stages.slice(0, typed)) {
        enter(part, part.answerText)
        click('Check')
      }
      const before = useStore.getState().events.length
      const part = a.stages[typed]!
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      fireEvent.change(field(part.label), { target: { value: '???' } })
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(field(part.label).getAttribute('aria-invalid')).toBe('true')
      expect(useStore.getState().events).toHaveLength(before)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries and the part she is on',
    () => {
      const { a, path } = load(templateId, (x) => x.question !== 'ambiguous' || x.stages.length > 1)
      const [first, second] = [a.stages[0]!, a.stages[1]]
      const view = renderAt(path)
      enter(first, first.kind === 'choice' ? first.answerText : 'not yet')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [first.id]: first.kind === 'choice' ? first.answerText : 'not yet' })
      const again = renderAt(path)
      if (first.kind !== 'choice') expect(field(first.label).value).toBe('not yet')
      // A one-part problem: the entry is what a reload keeps.
      if (!second) return
      if (first.kind !== 'choice') enter(first, first.answerText)
      click('Check')
      again.unmount()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
      renderAt(path)
      expect(screen.getByRole('heading', { name: heading(a, 1, false) })).toBeTruthy()
      if (second.kind !== 'choice') expect(field(second.label).value).toBe('')
    },
    FLOW_TIMEOUT,
  )
})

describe('notes and the ambiguous case', () => {
  it(
    'a number rounded too early is a note that records nothing',
    () => {
      const { a, path } = load('ot.sines', (x) => (x.early.side ?? []).length > 0)
      renderAt(path)
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      const before = useStore.getState().events.length
      enter(a.stages[1]!, a.early.side![0]!.toFixed(1))
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(EARLY_NOTE)
      expect(useStore.getState().events).toHaveLength(before)
    },
    FLOW_TIMEOUT,
  )

  it(
    'two triangles: the parts are not counted and side a is not drawn until she has said how many',
    () => {
      const { a, path } = load('ot.ambiguous', (x) => x.stages[0]!.answerText === 'two')
      const view = renderAt(path)
      expect(view.container.textContent).not.toMatch(/of 3/)
      expect(screen.getByText(/stage 0 of 1/)).toBeTruthy()
      const letters = () => [...view.container.querySelectorAll('[data-ot="figure"] svg text')].map((t) => t.textContent)
      expect(letters()).not.toContain('B')
      enter(a.stages[0]!, 'two')
      click('Check')
      expect(screen.getByRole('heading', { name: heading(a, 1, false) })).toBeTruthy()
      expect(letters()).toContain('B')
      expect(letters()).toContain('B′')
      expect(screen.getAllByRole('img', { name: a.oblique.after!.spec.ariaLabel }).length).toBeGreaterThan(0)
    },
    FLOW_TIMEOUT,
  )

  it(
    'no triangle: one part, and the problem is done once she says so',
    () => {
      const { a, path } = load('ot.ambiguous', (x) => x.stages[0]!.answerText === 'none')
      renderAt(path)
      expect(screen.getByRole('heading', { name: heading(a, 0, true) })).toBeTruthy()
      enter(a.stages[0]!, 'none')
      click('Check')
      expect(doneEvent()).toMatchObject({ finalCorrect: true })
    },
    FLOW_TIMEOUT,
  )

  it(
    'the Check buttons keep the chunky press',
    () => {
      const { path } = load('ot.cosines')
      renderAt(path)
      expect(screen.getByRole('button', { name: 'Check' }).className).toContain('btn-chunky')
    },
    FLOW_TIMEOUT,
  )
})
