// @vitest-environment jsdom
/**
 * One problem of each kind of answer box, finished on a touch screen with the math keypad alone:
 * a number answer, a line-by-line equation (the composer), a parts flow, and a geometry part.
 * Nothing is typed with fireEvent.change: every character comes from a keypad key.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, keypad, removePointer, tap, tapBox, typeOnKeypad } from '@/components/keypadTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const FLOW_TIMEOUT = 120_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MathKeypad />
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const accepted = () => events('step_accepted') as EvOf<'step_accepted'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const textbox = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement

/** A math box on a phone: no phone keyboard, no strip; focusing it opens the keypad. */
function openOnKeypad(box: HTMLInputElement) {
  expect(box.getAttribute('inputmode')).toBe('none')
  expect(screen.queryByRole('toolbar', { name: 'Math symbols' })).toBeNull()
  tapBox(box)
  expect(keypad()).toBeTruthy()
}

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
  installPointer(true)
})

afterEach(() => {
  removePointer()
})

describe('finishing a problem with the math keypad alone', () => {
  it(
    'a number answer: an average rate of change, −1/5',
    () => {
      const p = generateProblem('piecewiseRate', 'arc.rate', 2)
      if (p.answer.type !== 'piecewiseRate' || !p.answer.rateText) throw new Error('arc.rate seed 2 has no rate')
      expect(p.answer.rateText).toBe('-1/5')
      renderAt(problemPath('piecewiseRate', 'arc.rate', 2))
      const box = textbox('Average rate of change')
      openOnKeypad(box)
      expect(typeOnKeypad(p.answer.rateText)).toBe(4)
      expect(box.value).toBe('-1/5')
      tap('check')
      expect(finals()).toMatchObject([{ correct: true, via: 'text' }])
      expect(doneEvent()).toMatchObject({ finalCorrect: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a line-by-line equation: 7^(x + 2) = 2^x, its first line in 12 taps on one keypad, then the answer',
    () => {
      const p = generateProblem('expLogEquations', 'ee.exponential', 24)
      if (p.answer.type !== 'expLogEquations') throw new Error('ee.exponential')
      expect(p.statementText).toBe('7^(x + 2) = 2^x')
      renderAt(problemPath('expLogEquations', 'ee.exponential', 24))
      const line = textbox('Next line')
      // The composer stays on top of the keypad (sticky above it on a phone).
      expect(line.closest('[data-keypad-scroll="end"]')?.className).toContain('composer-sticky')
      openOnKeypad(line)
      // ( x + 2 ) ln 7 → = x ln 2: the ln key brings its own parentheses, so the last one is already there.
      expect(typeOnKeypad('(x+2)ln(7) = x ln(2')).toBe(12)
      expect(line.value).toBe('(x+2)ln(7) = xln(2)')
      tap('check')
      expect(accepted()).toHaveLength(1)
      expect(doneEvent()).toBeUndefined()

      const answer = textbox('Answer')
      expect(answer.disabled).toBe(false)
      openOnKeypad(answer)
      typeOnKeypad('x = 2ln(7)/(ln(2) - ln(7))')
      expect(answer.value).toBe('x = 2ln(7)/(ln(2)-ln(7))')
      tap('check')
      expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      expect(doneEvent()).toMatchObject({ finalCorrect: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a parts flow: domain, range, asymptote and intercept of an exponential, one keypad box after another',
    () => {
      const p = generateProblem('expLogGraphs', 'eg.features', 3)
      if (p.answer.type !== 'expLogGraphs') throw new Error('eg.features')
      const typed = p.answer.stages.filter((s) => s.kind !== 'choice').map((s) => s.answerText)
      expect(typed).toEqual(['(-inf, inf)', '(-2, inf)', 'y = -2', '(0, -7/4)'])
      renderAt(problemPath('expLogGraphs', 'eg.features', 3))
      for (const part of p.answer.stages) {
        if (part.kind === 'choice') {
          const label = part.choices?.find((c) => c.value === part.answerText)?.label ?? part.answerText
          fireEvent.click(screen.getByRole('radio', { name: label }))
          fireEvent.click(screen.getByRole('button', { name: 'Check' }))
        } else {
          const box = textbox(part.label)
          openOnKeypad(box)
          typeOnKeypad(part.answerText)
          tap('check')
        }
        expect(finals().at(-1), part.id).toMatchObject({ correct: true, via: 'text' })
      }
      expect(doneEvent()).toMatchObject({ finalCorrect: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a geometry part: x, then an angle in degrees with the ° key from the context row',
    () => {
      const p = generateProblem('geoAngles', 'ga.bisector', 1)
      if (p.answer.type !== 'geometry') throw new Error('ga.bisector')
      expect(p.answer.stages.map((s) => s.answerText)).toEqual(['5', '52'])
      renderAt(problemPath('geoAngles', 'ga.bisector', 1))
      openOnKeypad(textbox('x'))
      typeOnKeypad('5')
      tap('check')
      expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      const angle = textbox('m∠ABC')
      // Check moved her to the next part's box, and the keypad came with it: no tap needed.
      expect(document.activeElement).toBe(angle)
      expect(angle.getAttribute('inputmode')).toBe('none')
      expect(keypad()).toBeTruthy()
      typeOnKeypad('52°')
      expect(angle.value).toBe('52°')
      tap('check')
      expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      expect(doneEvent()).toMatchObject({ finalCorrect: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
