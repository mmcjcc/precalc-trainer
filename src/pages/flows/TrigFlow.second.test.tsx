// @vitest-environment jsdom
/**
 * The second half of Unit 4 on the screen (TrigFlow): right triangles, one value and the quadrant, every angle in one
 * turn. Per template: the promised mistake named (title, lesson, the sentence about her answer, the example) and
 * recorded once, the fix, the records, completion with the worked lines; an unreadable answer records nothing; a reload
 * restores her entries and the part she is on. Then: the figure never answers a part early; a list with one of two
 * answers is named with a count and never logged twice, whatever its order; the phone keypad alone finishes a list
 * (the grid's comma) and a rounded side.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, removePointer, tap, tapBox, typeOnKeypad } from '@/components/keypadTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { answerForms, gradeTrigPart } from '@/content/modules/trig/parts'
import { pieces, showsNumber } from '@/content/modules/trig/text'
import type { TrigAnswer, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import type { ModuleId } from '@/shared/types'
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

/** The first seed from `from` up whose problem passes `ok` (every problem here promises a slip). */
function load(module: ModuleId, templateId: string, ok: (a: TrigAnswer) => boolean = () => true, from = 1) {
  for (let seed = from; seed < from + 400; seed++) {
    const p = generateProblem(module, templateId, seed)
    const a = p.answer as TrigAnswer
    if (a.trap && ok(a)) return { p, a, seed, path: problemPath(module, templateId, seed) }
  }
  throw new Error(`${templateId}: none found`)
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement
const enter = (part: TrigPart, value: string) => fireEvent.change(field(part.label), { target: { value } })

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

beforeEach(() => {
  resetStoreForTests()
})

const TEMPLATES = [
  ['rightTriangle', 'rt.ratios'],
  ['rightTriangle', 'rt.special'],
  ['rightTriangle', 'rt.side'],
  ['rightTriangle', 'rt.angle'],
  ['unitCircle', 'uc.given'],
  ['unitCircle', 'uc.solve'],
] as const

describe.each(TEMPLATES)('%s %s on the screen', (module, templateId) => {
  it(
    'shows the problem in KaTeX with its figure, names the promised mistake, takes the fix, records both, and completes',
    () => {
      const { p, a, path } = load(module, templateId)
      const view = renderAt(path)
      expect(screen.getByText(p.instructions)).toBeTruthy()
      for (const piece of pieces(a.prompt).filter((x) => !x.tex && x.text.trim().length > 3)) expect(view.container.textContent).toContain(piece.text.trim())
      expect(view.container.querySelectorAll('.katex').length).toBeGreaterThan(0)
      expect(screen.getAllByRole('img', { name: a.figure.ariaLabel }).length).toBeGreaterThan(0)
      let named = false
      for (const [i, part] of a.stages.entries()) {
        expect(screen.getByRole('heading', { name: a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${part.label}` : part.label })).toBeTruthy()
        if (part.id === a.trapStage) {
          const before = finals().length
          enter(part, a.trapAnswer!)
          click('Check')
          const alert = screen.getByRole('alert')
          const info = ERROR_PATTERNS[a.trap!]
          expect(alert.textContent).toContain(info.title)
          expect(alert.textContent).toContain(info.lesson)
          expect(alert.textContent).toContain('Example:')
          const g = gradeTrigPart(part, a.trapAnswer!)
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
      const { a, path } = load(module, templateId)
      const part = a.stages[0]!
      renderAt(path)
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      fireEvent.change(field(part.label), { target: { value: '???' } })
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(field(part.label).getAttribute('aria-invalid')).toBe('true')
      expect(useStore.getState().events).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries and the part she is on',
    () => {
      const { a, path } = load(module, templateId)
      const part = a.stages[0]!
      const view = renderAt(path)
      enter(part, 'not yet')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [part.id]: 'not yet' })
      const again = renderAt(path)
      expect(field(part.label).value).toBe('not yet')
      const second = a.stages[1]
      if (second) {
        enter(part, part.answerText)
        click('Check')
        again.unmount()
        expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
        renderAt(path)
        expect(field(part.label).value).toBe(part.answerText)
        expect(field(part.label).disabled).toBe(true)
        expect(field(second.label).value).toBe('')
      }
    },
    FLOW_TIMEOUT,
  )
})

describe('the figure never answers a part before she has', () => {
  it(
    'rt.ratios: the third side has no label until she has found it, then its length',
    () => {
      const { a, path } = load('rightTriangle', 'rt.ratios')
      const view = renderAt(path)
      const sideLabels = () => [...view.container.querySelectorAll('[data-trig="side-label"], [data-trig="dim-label"]')].map((t) => t.textContent)
      const third = a.figure.triangle!.sides.find((s) => s.after === 'side')!
      expect(sideLabels()).not.toContain(third.label)
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      expect(sideLabels()).toContain(third.label)
    },
    FLOW_TIMEOUT,
  )

  it(
    'rt.side and rt.angle: the asked side is x and the asked angle θ, and no number in the figure is the answer',
    () => {
      for (const t of ['rt.side', 'rt.angle']) {
        const { a, path } = load('rightTriangle', t)
        const view = renderAt(path)
        const words = [...view.container.querySelectorAll('svg text')].map((x) => x.textContent ?? '')
        expect(words).toContain(t === 'rt.side' ? 'x' : 'θ')
        expect(showsNumber(words, answerForms(a.stages[0]!))).toBe(false)
        view.unmount()
      }
    },
    FLOW_TIMEOUT,
  )

  it(
    'uc.given: the point and its terminal side wait for the part that settles the quadrant',
    () => {
      const { a, path } = load('unitCircle', 'uc.given', (x) => x.stages[0]!.id !== 'r')
      const view = renderAt(path)
      const point = () => view.container.querySelector('[data-trig="point"]')
      expect(point()).toBeNull()
      expect(view.container.querySelectorAll('[data-trig="quadrant-numeral"]')).toHaveLength(4)
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      expect(point()).not.toBeNull()
      expect(view.container.querySelector('[data-trig="point-label"]')?.textContent).toBe(a.figure.point!.label)
    },
    FLOW_TIMEOUT,
  )

  it(
    'uc.given with tan or cot given: r first, and the point waits for the first value with its sign',
    () => {
      const { a, path } = load('unitCircle', 'uc.given', (x) => x.stages[0]!.id === 'r')
      const view = renderAt(path)
      const point = () => view.container.querySelector('[data-trig="point"]')
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      expect(point()).toBeNull()
      enter(a.stages[1]!, a.stages[1]!.answerText)
      click('Check')
      expect(point()).not.toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'uc.solve: no terminal side until she is done; then each answer’s',
    () => {
      const { a, path } = load('unitCircle', 'uc.solve')
      const view = renderAt(path)
      expect(view.container.querySelector('[data-trig="terminal"]')).toBeNull()
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      expect(view.container.querySelectorAll('[data-trig="terminal"]')).toHaveLength(a.figure.solve!.degs.length)
    },
    FLOW_TIMEOUT,
  )
})

describe('a list of angles', () => {
  it(
    'one of two answers is named with how many there are, never which; the same list again, in any order or spelling, is one record',
    () => {
      const { a, path } = load('unitCircle', 'uc.solve', (x) => x.stages[0]!.check.kind === 'angles' && x.stages[0]!.check.degs.length === 2 && x.stages[0]!.check.unit === 'deg')
      renderAt(path)
      const part = a.stages[0]!
      const [first, second] = part.answerText.split(', ') as [string, string]
      enter(part, first)
      click('Check')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.trig_solve_one_answer.title)
      expect(alert.textContent).toMatch(/There are two angles/)
      expect(showsNumber([alert.textContent ?? ''], [second])).toBe(false)
      expect(finals()).toHaveLength(1)
      // The same list with a degree sign: the same attempt.
      enter(part, `${first}°`)
      click('Check')
      expect(finals()).toHaveLength(1)
      // A wrong list, then the same list in the other order: one record.
      enter(part, `${second}, 1`)
      click('Check')
      expect(finals()).toHaveLength(2)
      enter(part, `1, ${second}°`)
      click('Check')
      expect(finals()).toHaveLength(2)
      // The first list again, after another one: still logged once.
      enter(part, first)
      click('Check')
      expect(screen.getByRole('alert').textContent).toMatch(/There are two angles/)
      expect(finals()).toHaveLength(2)
      enter(part, `${second}, ${first}`)
      click('Check')
      expect(finals().at(-1)).toMatchObject({ correct: true })
      expect(doneEvent()).toBeDefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the answer box reads a list back in KaTeX, commas and all',
    () => {
      const { a, path } = load('unitCircle', 'uc.solve', (x) => x.stages[0]!.check.kind === 'angles' && x.stages[0]!.check.unit === 'rad')
      renderAt(path)
      enter(a.stages[0]!, a.stages[0]!.answerText.replace(/π/g, 'pi'))
      const preview = screen.getByLabelText('Preview')
      expect(preview.querySelector('.katex')).not.toBeNull()
      expect(preview.textContent).toContain('\\pi')
    },
    FLOW_TIMEOUT,
  )
})

describe('on a phone', () => {
  it(
    'the keypad alone finishes a list (the grid’s comma, the π key) and a rounded side',
    () => {
      installPointer(true)
      resetKeypadForTests()
      try {
        const finishWith = (path: string, label: string, text: string) => {
          const view = render(
            <MemoryRouter initialEntries={[path]}>
              <MathKeypad />
              <Routes>
                <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
              </Routes>
            </MemoryRouter>,
          )
          const box = field(label)
          expect(box.getAttribute('inputmode')).toBe('none')
          tapBox(box)
          expect(keypad()).toBeTruthy()
          expect(typeOnKeypad(text)).toBeGreaterThan(0)
          tap('check')
          expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
          view.unmount()
          resetStoreForTests()
          resetKeypadForTests()
        }
        const list = load('unitCircle', 'uc.solve', (x) => x.stages[0]!.check.kind === 'angles' && x.stages[0]!.check.unit === 'rad' && x.stages[0]!.check.degs.length === 2)
        finishWith(list.path, 'Every solution', list.a.stages[0]!.answerText.replace(/π/g, 'pi'))
        const side = load('rightTriangle', 'rt.side')
        finishWith(side.path, 'x', side.a.stages[0]!.answerText)
      } finally {
        removePointer()
      }
    },
    FLOW_TIMEOUT,
  )
})
