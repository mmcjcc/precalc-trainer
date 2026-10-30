// @vitest-environment jsdom
/**
 * Guided mode on an exponential equation: each next line picked from three cards (the path's next line and two of
 * the engine's named slips of her line), on a wide screen and on a phone. The cards come from the same builder the
 * page uses (`lineCardsFor`, cached), so a test can tell which card is the right one.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { resetKeypadForTests } from '@/components/keypadStore'
import { installPointer, queryKeypad, removePointer } from '@/components/keypadTesting'
import { MathKeypad } from '@/components/MathKeypad'
import { lineCardsFor, stepTypeOf } from '@/problem/cardSources'
import type { LineCard } from '@/problem/lineCards'
import { problemPath } from '@/problem/url'
import { emptyRewards, mastery, resetStoreForTests, STORAGE_KEYS, useStore, xpAwards, type Ev } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MathKeypad />
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/m/:moduleId" element={<p>module page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The first seed of a template whose equation reads `statement`. */
function problemWith(templateId: string, statement: string): { p: ProblemInstance; seed: number } {
  for (let seed = 1; seed < 400; seed++) {
    const p = generateProblem('expLogEquations', templateId, seed)
    if (p.statementText === statement) return { p, seed }
  }
  throw new Error(`no ${statement} in 400 seeds`)
}

const ofType = <T extends Ev['t']>(t: T) => useStore.getState().events.filter((e): e is Extract<Ev, { t: T }> => e.t === t)

/** The cards for the line she is on, as the page builds them. */
function cardsNow(p: ProblemInstance): LineCard[] {
  const steps = useStore.getState().attempt?.steps ?? []
  return lineCardsFor(p, steps.at(-1)?.text ?? p.start!, steps.length)
}

const rightCard = (p: ProblemInstance) => cardsNow(p).find((c) => c.right)!
const wrongCards = (p: ProblemInstance) => cardsNow(p).filter((c) => !c.right)
/** The card buttons on the screen, in their order. */
const shownCards = () => {
  const group = document.querySelector('[data-line-cards]')
  return group ? within(group as HTMLElement).queryAllByRole('listitem').map((li) => li.querySelector('button')!.getAttribute('aria-label')) : []
}
const pick = (card: LineCard) => fireEvent.click(screen.getByRole('button', { name: card.text }))
const lineBox = () => screen.queryByRole('textbox', { name: 'Next line' }) as HTMLInputElement | null

function typeLine(text: string) {
  fireEvent.change(lineBox()!, { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Check this line' }))
}

function typeAnswer(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Answer' }), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Check the answer' }))
}

beforeEach(() => {
  resetStoreForTests()
  resetKeypadForTests()
})

describe('Guided mode on a wide screen', () => {
  it(
    'the switch: Type by default, Pick says what it means, and the choice is remembered',
    () => {
      const { seed } = problemWith('ee.exponential', '3^x = 13')
      const view = renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      const guide = screen.getByRole('switch', { name: 'Guide me' })
      expect(guide.getAttribute('aria-checked')).toBe('false')
      expect(screen.getByText('Off: type your lines. Cards stay in Hints.')).toBeTruthy()
      expect(lineBox()).toBeTruthy()
      expect(shownCards()).toEqual([])
      fireEvent.click(guide)
      expect(useStore.getState().settings.lineEntry).toBe('pick')
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)!)).toMatchObject({ lineEntry: 'pick' })
      expect(guide.getAttribute('aria-checked')).toBe('true')
      expect(shownCards()).toHaveLength(3)
      expect(lineBox()).toBeNull()
      // Back to typing on the same line: the box, and a word on why this line still counts as picked.
      fireEvent.click(screen.getByRole('switch', { name: 'Guide me' }))
      expect(lineBox()).toBeTruthy()
      expect(document.querySelector('[data-typed-note]')!.textContent).toBe('You saw the cards for this line, so it counts as a picked line.')
      fireEvent.click(screen.getByRole('switch', { name: 'Guide me' }))
      expect(shownCards()).toHaveLength(3)
      view.unmount()
      const again = renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      expect(screen.getByRole('switch', { name: 'Guide me' }).getAttribute('aria-checked')).toBe('true')
      expect(shownCards()).toHaveLength(3)
      // A type with no card source has no switch.
      again.unmount()
      resetStoreForTests()
      renderAt(problemPath('numberLine', 'nl.read', 1))
      expect(screen.queryByRole('switch', { name: 'Guide me' })).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'right on the first pick, twice: each line added as if typed (via card, its step type), +4 each; the answer is typed; out of mastery',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick' })
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      // Three cards in the builder's order, KaTeX on each, the answer box shut.
      expect(shownCards()).toEqual(cardsNow(p).map((c) => c.text))
      expect(document.querySelectorAll('[data-line-cards] .katex')).toHaveLength(3)
      expect((screen.getByRole('textbox', { name: 'Answer' }) as HTMLInputElement).disabled).toBe(true)
      expect(screen.getByRole('button', { name: 'Type it yourself instead' })).toBeTruthy()

      // A keyboard: focus on the right card, Enter. Focus must not ride on the right card into the next line.
      screen.getByRole('button', { name: rightCard(p).text }).focus()
      pick(rightCard(p))
      expect(document.activeElement?.getAttribute('aria-label')).toBe(shownCards()[0])
      expect(ofType('step_accepted')).toMatchObject([{ stepIdx: 0, via: 'card', rule: stepTypeOf(p, p.start!, p.canonical[0]!.text)!, firstTry: true, revealed: false }])
      // The step type is what the move does: here taking logs and the power rule.
      expect(ofType('step_accepted')[0]!.rule).toMatch(/take_log/)
      expect(useStore.getState().attempt?.steps[0]).toMatchObject({ via: 'card', text: 'x*log(3) = log(13)' })
      expect(screen.getByRole('status').textContent).toContain('Kept')
      // The next line's cards, built from her new line.
      expect(shownCards()).toEqual(cardsNow(p).map((c) => c.text))
      expect(rightCard(p).text).toBe(p.canonical[1]!.text)
      pick(rightCard(p))
      expect(ofType('step_accepted')).toHaveLength(2)
      expect(ofType('step_accepted')[1]).toMatchObject({ via: 'card', firstTry: true })

      // The picked line is the solution, but the answer is typed: the box stays empty.
      const answer = screen.getByRole('textbox', { name: 'Answer' }) as HTMLInputElement
      expect(answer.disabled).toBe(false)
      expect(answer.value).toBe('')
      typeAnswer(p.answer.type === 'expLogEquations' ? p.answer.answerText : '')
      const done = ofType('problem_done')[0]!
      expect(done).toMatchObject({ steps: 2, picked: 2, finalCorrect: true })
      // Rewards off (the family app): the completion card says why it does not count.
      expect(document.querySelector('[data-picked-note]')!.textContent).toContain('You picked 2 lines from cards, so this problem does not count toward mastery')
      expect(mastery(useStore.getState().events, p.skill).count).toBe(0)
      const awards = xpAwards(useStore.getState().events, emptyRewards()).map((a) => [a.kind, a.xp])
      expect(awards).toEqual([
        ['line_picked', 4],
        ['line_picked', 4],
        ['part', 10],
        ['finish', 20],
        ['no_hints', 10],
      ])
    },
    FLOW_TIMEOUT,
  )

  it(
    'rewards on: the finish shows the picked lines at +4 and says the ring does not move',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick', rewards: true })
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      pick(rightCard(p))
      pick(rightCard(p))
      typeAnswer(p.answer.type === 'expLogEquations' ? p.answer.answerText : '')
      const earned = screen.getByRole('list', { name: 'XP earned' })
      expect(earned.textContent).toContain('2 lines picked right+8')
      expect(earned.textContent).toContain('A part right first try+10')
      expect(document.querySelector('[data-finish-rewards] [data-picked-note]')!.textContent).toContain('does not move the ring')
      // Said once: the completion card leaves it to the rewards.
      expect(document.querySelectorAll('[data-picked-note]')).toHaveLength(1)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a wrong pick names its mistake with Why?, is logged as that step_rejected with via card, leaves the cards; then right pays 0',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick' })
      const view = renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      const wrong = wrongCards(p)[0]!
      const title = ERROR_PATTERNS[wrong.mistake as ErrorPatternId].title
      pick(wrong)
      expect(ofType('step_rejected')).toMatchObject([{ stepIdx: 0, pattern: wrong.mistake, via: 'card' }])
      expect(ofType('step_accepted')).toEqual([])
      // The same lesson a typed slip shows, with the line she picked.
      expect(screen.getByRole('alert').textContent).toContain(`Not accepted: ${title}`)
      expect(document.querySelector('[data-picked-line]')!.textContent).toContain('You picked')
      expect(document.querySelector('[data-picked-line] [aria-label]')!.getAttribute('aria-label')).toBe(wrong.text)
      // She picks again from the cards left (still in their order), also after a reload; focus is on the first of them.
      const left = cardsNow(p).filter((c) => c.text !== wrong.text).map((c) => c.text)
      expect(shownCards()).toEqual(left)
      expect(document.activeElement?.getAttribute('aria-label')).toBe(left[0])
      view.unmount()
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      expect(shownCards()).toEqual(left)
      pick(rightCard(p))
      expect(ofType('step_accepted')).toMatchObject([{ stepIdx: 0, via: 'card', firstTry: false }])
      // The mistake counts like a typed one; the line pays nothing.
      const awards = xpAwards(useStore.getState().events, emptyRewards())
      expect(awards).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'Type it yourself instead: the keypad box for that line, which still counts as picked; back to the cards; the next line has cards',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick' })
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      fireEvent.click(screen.getByRole('button', { name: 'Type it yourself instead' }))
      expect(shownCards()).toEqual([])
      expect(lineBox()).toBeTruthy()
      expect(document.querySelector('[data-typed-note]')!.textContent).toBe('You saw the cards for this line, so it counts as a picked line.')
      fireEvent.click(screen.getByRole('button', { name: 'Back to the cards' }))
      expect(shownCards()).toHaveLength(3)
      fireEvent.click(screen.getByRole('button', { name: 'Type it yourself instead' }))
      // A typed slip is a typed rejection (no via).
      typeLine('x = 13')
      expect(ofType('step_rejected')).toMatchObject([{ pattern: 'log_convert_dropped' }])
      expect(ofType('step_rejected')[0]).not.toHaveProperty('via')
      typeLine(p.canonical[0]!.text)
      expect(ofType('step_accepted')).toMatchObject([{ via: 'card', firstTry: false }])
      // The next line: cards again (Pick is still on).
      expect(shownCards()).toEqual(cardsNow(p).map((c) => c.text))
      expect(lineBox()).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a line with no cards is typed, with a word on why: her own legal route is off the path',
    () => {
      const { seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick' })
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      fireEvent.click(screen.getByRole('button', { name: 'Type it yourself instead' }))
      typeLine('x*ln(3) = ln(13)')
      expect(ofType('step_accepted')).toMatchObject([{ via: 'card', firstTry: true }])
      expect(shownCards()).toEqual([])
      expect(document.querySelector('[data-typed-note]')!.textContent).toBe('No cards for this line: type it.')
      expect(screen.queryByRole('button', { name: 'Back to the cards' })).toBeNull()
      typeLine('x = ln(13)/ln(3)')
      expect(ofType('step_accepted')[1]).not.toHaveProperty('via')
    },
    FLOW_TIMEOUT,
  )

  it(
    'while she types, the hints offer the cards for one line first; then back to typing',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      const offer = screen.getByRole('button', { name: 'Pick the next line' })
      // First in the hints, before the ladder.
      expect(offer.compareDocumentPosition(screen.getByRole('button', { name: 'Nudge me' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      fireEvent.click(offer)
      expect(shownCards()).toEqual(cardsNow(p).map((c) => c.text))
      expect(lineBox()).toBeNull()
      expect(screen.queryByRole('button', { name: 'Pick the next line' })).toBeNull()
      pick(rightCard(p))
      expect(ofType('step_accepted')).toMatchObject([{ via: 'card', firstTry: true }])
      // Back to typing, and the offer is there for the new line.
      expect(lineBox()).toBeTruthy()
      expect(shownCards()).toEqual([])
      expect(screen.getByRole('button', { name: 'Pick the next line' })).toBeTruthy()
      expect(useStore.getState().settings.lineEntry).toBeUndefined()
      typeLine(p.canonical[1]!.text)
      expect(ofType('step_accepted')[1]).not.toHaveProperty('via')
      expect(ofType('step_accepted')[1]).toMatchObject({ rule: stepTypeOf(p, p.canonical[0]!.text, p.canonical[1]!.text)! })
    },
    FLOW_TIMEOUT,
  )

  it(
    'a step type picked right twice is typed the next time it comes up, in any problem, with a note; typing it starts the count again',
    () => {
      // 3e^(2x) + 2 = 14: two lines that work on both sides (3e^(2x) = 12, e^(2x) = 4), then one that rewrites.
      const a = problemWith('ee.exponential', '3e^(2x) + 2 = 14')
      const [l1, l2] = a.p.canonical
      expect([stepTypeOf(a.p, a.p.start!, l1!.text), stepTypeOf(a.p, l1!.text, l2!.text)]).toEqual(['both_sides', 'both_sides'])
      useStore.getState().setSettings({ lineEntry: 'pick' })
      const first = renderAt(problemPath('expLogEquations', 'ee.exponential', a.seed))
      pick(rightCard(a.p))
      pick(rightCard(a.p))
      expect(ofType('step_accepted').map((e) => e.via)).toEqual(['card', 'card'])
      // The third line is another kind of step: its cards are there.
      expect(shownCards()).toEqual(cardsNow(a.p).map((c) => c.text))
      first.unmount()
      useStore.getState().leaveAttempt()

      // 1000(1.02)^x = 3000 starts with a both-sides step: typed this time, with a note, and no cards in the hints.
      const b = problemWith('ee.exponential', '1000(1.02)^x = 3000')
      renderAt(problemPath('expLogEquations', 'ee.exponential', b.seed))
      expect(shownCards()).toEqual([])
      expect(document.querySelector('[data-typed-note]')!.textContent).toBe('You picked this one right twice: type it this time.')
      expect(screen.queryByRole('button', { name: 'Pick the next line' })).toBeNull()
      typeLine(b.p.canonical[0]!.text)
      const typed = ofType('step_accepted').at(-1)!
      expect(typed).not.toHaveProperty('via')
      expect(typed).toMatchObject({ rule: 'both_sides', firstTry: true })
      // Typing it started the count again, and the next line (taking logs) has its cards.
      expect(shownCards()).toEqual(cardsNow(b.p).map((c) => c.text))
    },
    FLOW_TIMEOUT,
  )

  it(
    'at the end of the path the note offers "Go to the answer box", which puts her in the box',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick' })
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      pick(rightCard(p))
      expect(screen.queryByRole('button', { name: 'Go to the answer box' })).toBeNull()
      pick(rightCard(p))
      expect(document.querySelector('[data-typed-note]')!.textContent).toContain('That was the last line of the path')
      fireEvent.click(screen.getByRole('button', { name: 'Go to the answer box' }))
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Answer' }))
    },
    FLOW_TIMEOUT,
  )
})

describe('Guided mode on a phone', () => {
  beforeEach(() => installPointer(true))
  afterEach(() => removePointer())

  it(
    'Stuck? first offers "Pick the next line" (the ladder under it unchanged); taking it closes the sheet and shows the cards',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      const status = () => document.querySelector<HTMLElement>('[data-composer-status]')!
      fireEvent.click(within(status()).getByRole('button', { name: 'Stuck?' }))
      const sheet = screen.getByRole('dialog', { name: 'Hints' })
      const offer = within(sheet).getByRole('button', { name: 'Pick the next line' })
      // The ladder took the request as before: the nudge is shown.
      expect(within(sheet).getByText('Nudge')).toBeTruthy()
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 1 })
      fireEvent.click(offer)
      expect(screen.queryByRole('dialog', { name: 'Hints' })).toBeNull()
      expect(shownCards()).toEqual(cardsNow(p).map((c) => c.text))
      // A wrong pick: the composer names the mistake right above the cards, with Why?.
      const wrong = wrongCards(p)[0]!
      pick(wrong)
      const title = ERROR_PATTERNS[wrong.mistake as ErrorPatternId].title
      expect(status().textContent).toContain(title)
      expect(within(status()).getByRole('button', { name: `Why? ${title}` })).toBeTruthy()
      pick(rightCard(p))
      expect(ofType('step_accepted')).toMatchObject([{ via: 'card', firstTry: false }])
      expect(lineBox()).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'Pick: the cards sit in the composer with no keypad; Type it yourself instead brings the box and the keypad up',
    () => {
      const { seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick' })
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      const composer = document.querySelector<HTMLElement>('[data-keypad-region]')!
      expect(composer.querySelector('[data-line-cards]')).toBeTruthy()
      expect(queryKeypad()).toBeNull()
      fireEvent.click(within(composer).getByRole('button', { name: 'Type it yourself instead' }))
      expect(document.activeElement).toBe(lineBox())
      expect(queryKeypad()).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'at the end of the path, "Go to the answer box" in the composer opens the keypad on the answer box',
    () => {
      const { p, seed } = problemWith('ee.exponential', '3^x = 13')
      useStore.getState().setSettings({ lineEntry: 'pick' })
      renderAt(problemPath('expLogEquations', 'ee.exponential', seed))
      pick(rightCard(p))
      pick(rightCard(p))
      const composer = document.querySelector<HTMLElement>('[data-keypad-region]')!
      expect(queryKeypad()).toBeNull()
      fireEvent.click(within(composer).getByRole('button', { name: 'Go to the answer box' }))
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Answer' }))
      expect(queryKeypad()).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})

describe('Guide me on an inequality', () => {
  it(
    'the switch shows; ON renders cards and a pick is logged like a typed line; flipping mid-problem keeps her work',
    () => {
      const p = generateProblem('inequalities', 'ineq.linear', 12345)
      useStore.getState().setSettings({ lineEntry: 'pick' })
      renderAt(problemPath('inequalities', 'ineq.linear', 12345))
      expect(screen.getByRole('switch', { name: 'Guide me' }).getAttribute('aria-checked')).toBe('true')
      const cards = lineCardsFor(p, p.start!, 0)
      expect(cards.length).toBeGreaterThan(0)
      expect(shownCards()).toEqual(cards.map((c) => c.text))
      const right = cards.find((c) => c.right)!
      fireEvent.click(screen.getByRole('button', { name: right.text }))
      expect(ofType('step_accepted')).toMatchObject([{ stepIdx: 0, via: 'card' }])
      const kept = useStore.getState().attempt?.steps[0]?.text
      expect(kept).toBeTruthy()
      fireEvent.click(screen.getByRole('switch', { name: 'Guide me' }))
      expect(useStore.getState().settings.lineEntry).toBe('type')
      expect(useStore.getState().attempt?.steps[0]?.text).toBe(kept)
      expect(lineBox()).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the switch shows on types with a source and not on types without',
    () => {
      const withSource = [
        problemPath('logProperties', 'lp.expand', 1),
        problemPath('quadratics', 'cs.form', 1),
        problemPath('diffQuotient', 'dq.linear', 1),
        problemPath('evenOdd', 'evenOdd.poly', 1),
      ]
      for (const path of withSource) {
        const view = renderAt(path)
        expect(screen.getAllByRole('switch', { name: 'Guide me' }).length, path).toBeGreaterThan(0)
        view.unmount()
      }
      const vertex = renderAt(problemPath('quadratics', 'cs.vertex', 1))
      expect(screen.queryByRole('switch', { name: 'Guide me' })).toBeNull()
      vertex.unmount()
      const none = renderAt(problemPath('numberLine', 'nl.read', 1))
      expect(screen.queryByRole('switch', { name: 'Guide me' })).toBeNull()
      none.unmount()
    },
    FLOW_TIMEOUT,
  )
})
