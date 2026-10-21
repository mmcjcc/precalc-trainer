// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, removePointer, tap, tapBox, typeOnKeypad } from '@/components/keypadTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { answerForms, gradeTrigPart } from '@/content/modules/trig/parts'
import { pieces, showsAnswer } from '@/content/modules/trig/text'
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

/** The first seed from 1 up whose problem promises a slip (every template has them; a few problems cannot). */
function load(module: ModuleId, templateId: string, from = 1) {
  for (let seed = from; seed < from + 50; seed++) {
    const p = generateProblem(module, templateId, seed)
    const a = p.answer as TrigAnswer
    if (a.trap) return { p, a, seed, path: problemPath(module, templateId, seed) }
  }
  throw new Error(`${templateId}: no seed with a slip`)
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
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

beforeEach(() => {
  resetStoreForTests()
})

const TEMPLATES = [
  ['angleMeasure', 'am.convert'],
  ['angleMeasure', 'am.coterminal'],
  ['angleMeasure', 'am.reference'],
  ['angleMeasure', 'am.arc'],
  ['unitCircle', 'uc.exact'],
  ['unitCircle', 'uc.point'],
] as const

describe.each(TEMPLATES)('%s %s on the screen', (module, templateId) => {
  it(
    'shows the problem in KaTeX with its figure, names the promised mistake, takes the fix, records both, and completes',
    () => {
      const { p, a, path } = load(module, templateId)
      const view = renderAt(path)
      expect(screen.getByText(p.instructions)).toBeTruthy()
      // The prompt's words are on the page, its math is drawn by KaTeX, and the figure is there with its words.
      for (const piece of pieces(a.prompt).filter((x) => !x.tex && x.text.trim().length > 3)) expect(view.container.textContent).toContain(piece.text.trim())
      expect(view.container.querySelectorAll('.katex').length).toBeGreaterThan(0)
      // Where she is asked where the terminal side lies, the angle is drawn (and described) once she has said.
      const waits = a.stages.some((s) => s.id === 'quadrant')
      const figureName = waits ? /drawn once you have said where its terminal side lies/ : a.figure.ariaLabel
      expect(screen.getAllByRole('img', { name: figureName }).length).toBeGreaterThan(0)
      expect(screen.queryByRole('heading', { name: 'The answer, worked out' })).toBeNull()
      let named = false
      for (const [i, part] of a.stages.entries()) {
        expect(screen.getByRole('heading', { name: a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${part.label}` : part.label })).toBeTruthy()
        if (a.stages[i + 1]) expect(screen.queryByRole('heading', { name: new RegExp(`^Part ${i + 2} of`) })).toBeNull()
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
          expect(showsAnswer([alert.textContent ?? ''], answerForms(part)), 'the card names the answer').toBe(false)
          expect(finals()).toHaveLength(before + 1)
          expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
          // The same answer again is the same attempt.
          click('Check')
          expect(finals()).toHaveLength(before + 1)
          expect(doneEvent()).toBeUndefined()
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
      expect(useStore.getState().events).toEqual([])
      if (part.kind !== 'choice') {
        expect(field(part.label).getAttribute('aria-invalid')).toBe('true')
        fireEvent.change(field(part.label), { target: { value: '???' } })
        expect(screen.queryByRole('alert')).toBeNull()
        click('Check')
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      }
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries and the part she is on',
    () => {
      const { a, path } = load(module, templateId)
      const part = a.stages[0]!
      const view = renderAt(path)
      const draft = part.kind === 'choice' ? part.choices![0]!.value : 'not yet'
      enter(part, draft)
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [part.id]: draft })
      const again = renderAt(path)
      if (part.kind === 'choice') expect((screen.getByRole('radio', { name: part.choices![0]!.label }) as HTMLInputElement).checked).toBe(true)
      else expect(field(part.label).value).toBe(draft)
      const second = a.stages[1]
      if (second) {
        enter(part, part.answerText)
        click('Check')
        again.unmount()
        expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
        renderAt(path)
        if (part.kind !== 'choice') {
          expect(field(part.label).value).toBe(part.answerText)
          expect(field(part.label).disabled).toBe(true)
        }
        if (second.kind !== 'choice') expect(field(second.label).value).toBe('')
        expect(screen.queryByRole('heading', { name: /^Part 3 of/ })).toBeNull()
      }
    },
    FLOW_TIMEOUT,
  )
})

describe('the trig screens', () => {
  it(
    'a form that is not simplest radical form, a calculator decimal and the wrong unit are notes, not attempts',
    () => {
      const exact = load('unitCircle', 'uc.exact')
      renderAt(exact.path)
      const part = exact.a.stages[0]!
      for (const typed of ['1/√2', '0.7071', '30°']) {
        enter(part, typed)
        click('Check')
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      }
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'the angle appears on the figure once she has said where it lies, and the reference angle once she has answered it',
    () => {
      let found: ReturnType<typeof load> | null = null
      for (let from = 1; from < 200 && !found; from++) {
        const l = load('angleMeasure', 'am.reference', from)
        if (l.a.stages.length === 2) found = l
      }
      const { a, path } = found!
      const view = renderAt(path)
      const figureRef = () => view.container.querySelector('[data-trig="reference"]')
      const terminal = () => view.container.querySelector('[data-trig="terminal"]')
      // Drawn, the angle would answer the quadrant: the unit circle and its axes only.
      expect(terminal()).toBeNull()
      expect(view.container.querySelector('[data-trig="unit-circle"]')).not.toBeNull()
      expect(view.container.querySelector('[data-trig="angle-arc"], [data-trig="spiral"]')).toBeNull()
      expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/drawn once you have said where its terminal side lies/)
      expect(figureRef()).toBeNull()
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      expect(terminal()).not.toBeNull()
      expect(figureRef()).toBeNull()
      enter(a.stages[1]!, a.stages[1]!.answerText)
      click('Check')
      expect(figureRef()).not.toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the hint ladder: the nudge and the rule never show the answer; the third rung shows the worked lines and marks it shown',
    () => {
      const { a, path } = load('unitCircle', 'uc.exact')
      const part = a.stages[0]!
      const view = renderAt(path)
      const hints = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
      click('Nudge me')
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(showsAnswer([hints().textContent ?? ''], answerForms(part))).toBe(false)
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      expect(within(hints()).getAllByText((_, el) => el?.getAttribute('data-worked-line') !== null && el?.tagName === 'LI').length).toBe(part.reveal.length)
      expect(view.container.querySelectorAll('[data-worked-line] .katex').length).toBeGreaterThan(0)
      expect(finals()).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'on a phone the math keypad alone finishes them: √ and π from the context row, and the word for no value in one tap',
    () => {
      installPointer(true)
      resetKeypadForTests()
      try {
        const find = (module: ModuleId, templateId: string, ok: (a: TrigAnswer) => boolean) => {
          for (let seed = 1; seed < 400; seed++) {
            const a = generateProblem(module, templateId, seed).answer as TrigAnswer
            if (ok(a)) return { a, path: problemPath(module, templateId, seed) }
          }
          throw new Error(`${templateId}: none found`)
        }
        const finishWith = (path: string, label: string, type: () => void) => {
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
          type()
          tap('check')
          expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
          view.unmount()
          resetStoreForTests()
          resetKeypadForTests()
        }
        const radical = find('unitCircle', 'uc.exact', (a) => a.stages[0]!.answerText === '√3/2')
        finishWith(radical.path, 'Exact value', () => expect(typeOnKeypad('sqrt(3)/2')).toBeGreaterThan(0))
        const none = find('unitCircle', 'uc.exact', (a) => a.stages[0]!.answerText === 'undefined')
        finishWith(none.path, 'Exact value', () => tap('undefined'))
        const radians = find('angleMeasure', 'am.coterminal', (a) => a.stages[0]!.answerText === '11π/6')
        finishWith(radians.path, 'Coterminal angle', () => typeOnKeypad('11pi/6'))
        const degrees = find('angleMeasure', 'am.convert', (a) => a.stages[0]!.check.kind === 'angle' && a.stages[0]!.check.unit === 'deg')
        finishWith(degrees.path, 'In degrees', () => typeOnKeypad(`${degrees.a.stages[0]!.answerText}°`))
      } finally {
        removePointer()
      }
    },
    FLOW_TIMEOUT,
  )

  it(
    'the answer box reads her entry back in KaTeX as she types',
    () => {
      const { a, path } = load('unitCircle', 'uc.exact')
      renderAt(path)
      enter(a.stages[0]!, 'sqrt(3)/2')
      const preview = screen.getByLabelText('Preview')
      expect(preview.querySelector('.katex')).not.toBeNull()
      // KaTeX's MathML keeps the TeX it drew: the reader turned sqrt(3)/2 into a fraction with a square root.
      expect(preview.textContent).toContain('\\frac{\\sqrt{3}}{2}')
    },
    FLOW_TIMEOUT,
  )
})
