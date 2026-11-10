// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from '@/App'
import { resetWindowSize, setWindowSize, WINDOWS } from '@/components/layoutTesting'
import { encodeStudySet, STUDY_CODE_ERROR } from '@/study/code'
import { resetStoreForTests, useStore } from '@/store'
import type { Ev } from '@/store/types'
import { StudyFlashPage } from './StudyFlash'
import { StudyImportPage } from './StudyImport'
import { StudyLearnPage } from './StudyLearn'
import { StudyMatchPage } from './StudyMatch'
import { StudyPage } from './Study'
import { StudySetPage } from './StudySet'
import { StudyTestPage } from './StudyTest'

function must<T extends { ok: true }>(result: T | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error)
  return result
}

function renderStudy(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/study" element={<StudyPage />} />
        <Route path="/study/import" element={<StudyImportPage />} />
        <Route path="/study/:setId" element={<StudySetPage />} />
        <Route path="/study/:setId/flash" element={<StudyFlashPage />} />
        <Route path="/study/:setId/learn" element={<StudyLearnPage />} />
        <Route path="/study/:setId/match" element={<StudyMatchPage />} />
        <Route path="/study/:setId/test" element={<StudyTestPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function makeSet(title: string, cards: { term: string; definition: string }[]) {
  return must(useStore.getState().createStudySet({ title, cards, now: 1 })).set
}

function shownTerm(): string {
  const next = screen.getByText('Term').nextElementSibling
  if (!next?.textContent) throw new Error('no term')
  return next.textContent
}

function events(): Ev[] {
  return useStore.getState().events
}

const CELLS: Record<string, string> = {
  cell: 'smallest unit',
  mito: 'powerhouse',
  nucleus: 'control center',
  ribosome: 'makes proteins',
}

function makeCells() {
  return makeSet(
    'Cells',
    Object.entries(CELLS).map(([term, definition]) => ({ term, definition })),
  )
}

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
})

afterEach(() => {
  resetWindowSize()
})

describe('study sets', () => {
  it('creates a deck and goes straight into it', () => {
    renderStudy('/study')
    expect(screen.getByRole('heading', { name: 'Study sets' })).toBeTruthy()
    expect(screen.getByText(/You have no study sets yet/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('New set title'), { target: { value: 'Spanish' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create set' }))
    expect(screen.getByRole('heading', { name: 'Spanish' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'All study sets' })).toBeTruthy()
    expect(screen.getByText(/This set has no cards yet/)).toBeTruthy()
    expect(screen.getByLabelText('Paste your notes')).toBeTruthy()
    expect(useStore.getState().studySets.map((set) => set.title)).toEqual(['Spanish'])
  })

  it('makes a deck from pasted notes: every line is a card, shown before it is made', () => {
    renderStudy('/study')
    fireEvent.change(screen.getByLabelText('New set title'), { target: { value: 'Chem 5' } })
    fireEvent.change(screen.getByLabelText('Paste your notes (optional)'), {
      target: { value: '• Photon - a particle of light\nOrbital: where an electron probably is\nGround state - the lowest energy\narrangement of electrons' },
    })
    expect(screen.getByText(/3 cards found/)).toBeTruthy()
    expect(screen.getByText('where an electron probably is')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create set with 3 cards' }))
    expect(screen.getByRole('heading', { name: 'Chem 5' })).toBeTruthy()
    expect(useStore.getState().studySets[0]!.cards.map((card) => [card.term, card.definition])).toEqual([
      ['Photon', 'a particle of light'],
      ['Orbital', 'where an electron probably is'],
      ['Ground state', 'the lowest energy arrangement of electrons'],
    ])
    for (const mode of ['Flashcards', 'Learn', 'Match', 'Test']) expect(screen.getByRole('button', { name: new RegExp(`^${mode}`) })).toBeTruthy()
  })

  it('a paste with no title keeps the paste and says what is missing', () => {
    renderStudy('/study')
    fireEvent.change(screen.getByLabelText('Paste your notes (optional)'), { target: { value: 'a - 1\nb - 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create set with 2 cards' }))
    expect(screen.getByRole('alert').textContent).toBe('Give the set a title.')
    expect((screen.getByLabelText('Paste your notes (optional)') as HTMLTextAreaElement).value).toBe('a - 1\nb - 2')
    expect(useStore.getState().studySets).toHaveLength(0)
  })

  it('her choice of separator re-reads the paste', () => {
    renderStudy('/study')
    fireEvent.change(screen.getByLabelText('Paste your notes (optional)'), {
      target: { value: 'Ratio 1:1 - equal parts: always\nRatio 2:1 - two to one: always' },
    })
    expect(screen.getByText('Ratio 1:1')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('What separates a term from its definition'), { target: { value: 'colon' } })
    expect(screen.getByText('Ratio 1:1 - equal parts')).toBeTruthy()
    expect(screen.getAllByText('always')).toHaveLength(2)
  })

  it('pastes many cards into a set she already has, and saves them', () => {
    const set = makeSet('Notes', [{ term: 'a', definition: '1' }])
    renderStudy(`/study/${set.id}`)
    expect(screen.queryByLabelText('Paste your notes')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Paste many cards at once' }))
    expect((screen.getByRole('button', { name: 'Add cards' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Paste your notes'), { target: { value: 'b\t2\nc\t3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 cards' }))
    expect(screen.getByRole('status').textContent).toBe('Added 2 cards.')
    expect(useStore.getState().studySets[0]!.cards.map((card) => card.term)).toEqual(['a', 'b', 'c'])
    expect((screen.getByLabelText('Term 3') as HTMLTextAreaElement).value).toBe('c')
    expect(screen.queryByLabelText('Paste your notes')).toBeNull()
  })

  it('tells her when a save drops a blank card', () => {
    const set = makeSet('Notes', [])
    renderStudy(`/study/${set.id}`)
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    fireEvent.change(screen.getByLabelText('Term 1'), { target: { value: 'hola' } })
    fireEvent.change(screen.getByLabelText('Definition 1'), { target: { value: 'hello' } })
    expect(screen.getByText(/changes that are not saved yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status').textContent).toBe('1 blank card removed')
    expect(useStore.getState().studySets[0]!.cards.map((card) => card.term)).toEqual(['hola'])
    expect(screen.queryByText(/changes that are not saved yet/)).toBeNull()
  })

  it('the set page says what each mode is, and a mode saves her edits on the way in', () => {
    const set = makeSet('Cells', [{ term: 'cell', definition: 'smallest unit' }])
    renderStudy(`/study/${set.id}`)
    expect(screen.getByText('Multiple choice. Misses come back until they stick.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy the share code' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Definition 1'), { target: { value: 'the smallest unit of life' } })
    fireEvent.click(screen.getByRole('button', { name: /^Flashcards/ }))
    expect(screen.getByRole('button', { name: 'Term: cell' })).toBeTruthy()
    expect(useStore.getState().studySets[0]!.cards[0]!.definition).toBe('the smallest unit of life')
  })

  it('flashcards: flip, sort the pass, and offer the still-learning pile', () => {
    const set = makeSet('Cells', [
      { term: 'cell', definition: 'smallest unit' },
      { term: 'mito', definition: 'powerhouse' },
    ])
    renderStudy(`/study/${set.id}/flash`)
    expect(screen.getByText('1 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Term: cell' })).toBeTruthy()
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.getByRole('button', { name: 'Definition: smallest unit' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.getByText('2 of 2')).toBeTruthy()
    expect(screen.getByLabelText('1 got it, 0 still learning')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Term: mito' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Still learning' }))
    expect(screen.getByRole('status').textContent).toBe('1 got it. 1 still learning.')
    expect(screen.getByRole('button', { name: 'Practice 1 still learning' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to the set' })).toBeTruthy()
    const learned = events().filter((event) => event.t === 'study_learned')
    expect(learned).toHaveLength(1)
    expect(learned[0]).toMatchObject({ setId: set.id, cardId: set.cards[0]!.id })
    expect(events().filter((event) => event.t === 'study_round')).toEqual([expect.objectContaining({ setId: set.id, mode: 'flash' })])
  })

  it('learn: four choices, each answer is marked where she tapped, then the round ends', () => {
    const set = makeCells()
    renderStudy(`/study/${set.id}/learn`)
    expect(screen.getByText('0 of 4 learned')).toBeTruthy()
    let guard = 0
    while (!screen.queryByText(/right on the first try/) && guard < 8) {
      const term = shownTerm()
      const buttons = within(screen.getByRole('group', { name: 'Choices' })).getAllByRole('button')
      const texts = buttons.map((button) => button.textContent)
      expect(buttons).toHaveLength(4)
      expect(new Set(texts).size).toBe(4)
      expect(texts.filter((text) => text === CELLS[term]).length).toBe(1)
      for (const text of texts) expect(Object.values(CELLS)).toContain(text)
      expect(screen.queryByRole('status')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: CELLS[term]! }))
      const verdict = screen.getByRole('status')
      expect(verdict.getAttribute('data-verdict')).toBe('right')
      expect(within(verdict).getByText('Correct!')).toBeTruthy()
      const marked = within(screen.getByRole('group', { name: 'Choices' })).getAllByRole('button')
      expect(marked.every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
      expect(marked.filter((button) => button.getAttribute('data-choice') === 'right').map((button) => button.textContent)).toEqual([`✓${CELLS[term]}`])
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      guard += 1
    }
    expect(screen.getByText('Perfect round!')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('4 right on the first try. 0 needed another try.')
    expect(screen.queryByRole('button', { name: /I missed/ })).toBeNull()
    expect(events().filter((event) => event.t === 'study_learned')).toHaveLength(4)
    expect(events().filter((event) => event.t === 'study_round' && event.mode === 'learn')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Go again' }))
    expect(screen.getByText('0 of 4 learned')).toBeTruthy()
  })

  it('learn: a right answer moves on by itself after a moment', async () => {
    const set = makeCells()
    renderStudy(`/study/${set.id}/learn`)
    fireEvent.click(screen.getByRole('button', { name: CELLS[shownTerm()]! }))
    expect(screen.getByText('Correct!')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('1 of 4 learned')).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('learn: a wrong choice is marked red, the right one green, and the card comes back', () => {
    const set = makeCells()
    renderStudy(`/study/${set.id}/learn`)
    const first = shownTerm()
    const wrong = Object.values(CELLS).find((text) => text !== CELLS[first])!
    fireEvent.click(screen.getByRole('button', { name: wrong }))
    const verdict = screen.getByRole('status')
    expect(verdict.getAttribute('data-verdict')).toBe('wrong')
    expect(within(verdict).getByText('Not quite.')).toBeTruthy()
    const marked = within(screen.getByRole('group', { name: 'Choices' })).getAllByRole('button')
    expect(marked.find((button) => button.getAttribute('data-choice') === 'wrong')?.textContent).toBe(`✕${wrong}`)
    expect(marked.find((button) => button.getAttribute('data-choice') === 'right')?.textContent).toBe(`✓${CELLS[first]}`)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
    expect(events().filter((event) => event.t === 'study_learned')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('0 of 4 learned · 1 coming back')).toBeTruthy()
    let guard = 0
    while (!screen.queryByText(/right on the first try/) && guard < 8) {
      fireEvent.click(screen.getByRole('button', { name: CELLS[shownTerm()]! }))
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      guard += 1
    }
    expect(screen.getByText('Round complete!')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('3 right on the first try. 1 needed another try.')
    expect(within(screen.getByRole('list')).getByText(first)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Practice the 1 I missed' }))
    expect(screen.getByText('0 of 1 learned')).toBeTruthy()
    expect(shownTerm()).toBe(first)
  })

  it('learn with fewer than four cards shows the definition to grade herself, and a miss comes back', () => {
    const defs: Record<string, string> = { cell: 'smallest unit', mito: 'powerhouse' }
    const set = makeSet('Cells', [
      { term: 'cell', definition: 'smallest unit' },
      { term: 'mito', definition: 'powerhouse' },
    ])
    renderStudy(`/study/${set.id}/learn`)
    let wrongs = 0
    let guard = 0
    while (!screen.queryByRole('status') && guard < 6) {
      const term = shownTerm()
      expect(screen.queryByRole('group', { name: 'Choices' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Show the definition' }))
      expect(screen.getByText(defs[term]!)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: wrongs === 0 ? 'Missed it' : 'Got it' }))
      wrongs += 1
      guard += 1
    }
    expect(screen.getByRole('status').textContent).toBe('1 right on the first try. 1 needed another try.')
  })

  it('match: a right pair turns green and leaves, a wrong pair turns red and stays, and a faster time is kept', () => {
    const set = makeSet('Cells', [
      { term: 'cell', definition: 'smallest unit' },
      { term: 'mito', definition: 'powerhouse' },
    ])
    useStore.getState().recordStudyMatch(set.id, 60_000, 2)
    renderStudy(`/study/${set.id}/match`)
    expect(screen.getByText(/Best 1:00/)).toBeTruthy()
    expect(screen.getByText('Tap a term, then its definition.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Term: cell' }))
    expect(screen.getByText('Now tap its definition.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Definition: powerhouse' }))
    expect(screen.getByRole('button', { name: 'Term: cell' }).hasAttribute('data-miss')).toBe(true)
    expect(screen.getByRole('button', { name: 'Definition: powerhouse' }).hasAttribute('data-miss')).toBe(true)
    expect(screen.getAllByText('✕ Not a pair')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Term: cell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Definition: smallest unit' }))
    expect(screen.getAllByText('✓ Matched')).toHaveLength(2)
    expect((screen.getByRole('button', { name: 'Term: cell' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Term: mito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Definition: powerhouse' }))
    expect(screen.getByText('New best time!')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/Matched all 2\. Time /)
    expect(screen.getByText(/1 wrong pair\./)).toBeTruthy()
    const best = useStore.getState().studySets[0]!.bestMatchMs
    expect(typeof best).toBe('number')
    expect(best!).toBeLessThan(60_000)
    expect(events().filter((event) => event.t === 'study_learned')).toHaveLength(2)
    expect(events().filter((event) => event.t === 'study_round' && event.mode === 'match')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByRole('button', { name: 'Term: cell' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('match keeps going until every card has been paired', async () => {
    const cards = Array.from({ length: 7 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` }))
    const set = makeSet('Sevens', cards)
    renderStudy(`/study/${set.id}/match`)
    for (let i = 0; i < 7; i++) {
      // The next board follows the last pair's green moment.
      const termBtn = await waitFor(() => {
        const found = screen.getAllByRole('button').find((button) => button.getAttribute('data-side') === 'term' && !button.hasAttribute('data-matched'))
        if (!found) throw new Error('no term tile')
        return found
      })
      const term = termBtn.querySelectorAll('span')[1]?.textContent ?? ''
      const def = `d${term.slice(1)}`
      fireEvent.click(termBtn)
      const defBtn = screen.getAllByRole('button').find((button) => button.getAttribute('data-side') === 'definition' && button.querySelectorAll('span')[1]?.textContent === def)
      if (!defBtn) throw new Error(`no definition for ${term}`)
      fireEvent.click(defBtn)
    }
    expect(screen.getByRole('status').textContent).toMatch(/Matched all 7/)
    expect(screen.getByText(/No wrong pairs\./)).toBeTruthy()
    expect(events().filter((event) => event.t === 'study_round' && event.mode === 'match')).toHaveLength(1)
    expect(events().filter((event) => event.t === 'study_learned')).toHaveLength(7)
  })

  it('a test asks for the short side, says right or not on every row, and I was right flips a row', () => {
    const set = makeSet('Cells', [
      { term: 'cell', definition: 'the smallest unit of life' },
      { term: 'mitochondria', definition: 'the powerhouse of the cell' },
      { term: 'nucleus', definition: 'the control center' },
    ])
    renderStudy(`/study/${set.id}/test`)
    expect(screen.getByText('All 3 cards')).toBeTruthy()
    expect(screen.getByText(/Type the term for each one/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Answer for the smallest unit of life'), { target: { value: '  CELL ' } })
    fireEvent.change(screen.getByLabelText('Answer for the powerhouse of the cell'), { target: { value: 'mitochondira' } })
    fireEvent.change(screen.getByLabelText('Answer for the control center'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Score: 2 of 3')).toBeTruthy()
    expect(screen.getByText('✓ Right')).toBeTruthy()
    expect(screen.getByText('✓ Right - spelled "mitochondria"')).toBeTruthy()
    expect(screen.getByText('✕ Not quite')).toBeTruthy()
    expect(screen.getByText('Your answer: nope')).toBeTruthy()
    expect(screen.getByText('Answer: nucleus')).toBeTruthy()
    expect(document.querySelectorAll('[data-row="right"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-row="wrong"]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'I was right' }))
    expect(screen.getByText('Score: 3 of 3')).toBeTruthy()
    expect(screen.getByText('✓ Counted as right')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I was right' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'I was right' }))
    expect(screen.getByText('Score: 2 of 3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I was right' }).getAttribute('aria-pressed')).toBe('false')
    expect(new Set(events().filter((event) => event.t === 'study_learned').map((event) => (event.t === 'study_learned' ? event.cardId : '')))).toEqual(
      new Set(set.cards.map((card) => card.id)),
    )
    expect(events().filter((event) => event.t === 'study_round' && event.mode === 'test')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'New test' }))
    expect(screen.queryByText(/Score:/)).toBeNull()
    expect((screen.getByLabelText('Answer for the control center') as HTMLInputElement).value).toBe('')
  })

  it('a test of short definitions asks for the definition, and a blank row says so', () => {
    const set = makeSet('Unit circle', [
      { term: 'sin 30° (π/6)', definition: '1/2' },
      { term: 'sin 270° (3π/2)', definition: '-1' },
    ])
    renderStudy(`/study/${set.id}/test`)
    expect(screen.getByText(/Type the definition for each one/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Answer for sin 270° (3π/2)'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Score: 0 of 2')).toBeTruthy()
    expect(screen.getByText('✕ Left blank')).toBeTruthy()
    expect(screen.getByText('✕ Not quite')).toBeTruthy()
    expect(screen.getByText('Answer: -1')).toBeTruthy()
  })

  it('a bigger set says it is quizzing 10 cards', () => {
    const set = makeSet('Dozen', Array.from({ length: 12 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` })))
    renderStudy(`/study/${set.id}/test`)
    expect(screen.getByText('10 of 12 cards')).toBeTruthy()
    expect(screen.getAllByRole('textbox')).toHaveLength(10)
  })

  it('imports a code after a preview, and rejects a paste that is not one', () => {
    const code = encodeStudySet({
      title: 'Shared',
      cards: [
        { term: 'a', definition: '1' },
        { term: 'b', definition: '2' },
        { term: 'c', definition: '3' },
        { term: 'd', definition: '4' },
      ],
    })
    const view = renderStudy('/study/import')
    fireEvent.change(screen.getByLabelText('Share code'), { target: { value: code } })
    fireEvent.click(screen.getByRole('button', { name: 'Show the set' }))
    expect(screen.getByRole('heading', { name: 'Shared' })).toBeTruthy()
    expect(screen.getByText('4 cards')).toBeTruthy()
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('b')).toBeTruthy()
    expect(screen.getByText('c')).toBeTruthy()
    expect(screen.queryByText('d')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add to my sets' }))
    expect(screen.getByRole('link', { name: 'All study sets' })).toBeTruthy()
    expect((screen.getByLabelText('Term 4') as HTMLTextAreaElement).value).toBe('d')
    expect(useStore.getState().studySets.map((set) => ({ title: set.title, source: set.source, n: set.cards.length }))).toEqual([
      { title: 'Shared', source: 'imported', n: 4 },
    ])
    view.unmount()

    renderStudy('/study/import')
    fireEvent.change(screen.getByLabelText('Share code'), { target: { value: 'this is not a code' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show the set' }))
    expect(screen.getByRole('alert').textContent).toBe(STUDY_CODE_ERROR)
    expect(screen.queryByRole('button', { name: 'Add to my sets' })).toBeNull()
  })

  it('the study page takes a share code too', () => {
    renderStudy('/study')
    expect(screen.getByRole('heading', { name: 'Got a code from a classmate?' })).toBeTruthy()
    expect(screen.getByLabelText('Share code')).toBeTruthy()
  })

  it('adds a starter deck as an editable copy, once', () => {
    renderStudy('/study')
    expect(screen.getByRole('heading', { name: 'Starter sets' })).toBeTruthy()
    expect(screen.getByText('Polyatomic ions')).toBeTruthy()
    expect(screen.getByText('SAT transition words')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add Unit circle' }))
    const sets = useStore.getState().studySets
    expect(sets.map((set) => ({ title: set.title, source: set.source }))).toEqual([{ title: 'Unit circle', source: 'made' }])
    expect(sets[0]!.cards.length).toBeGreaterThanOrEqual(30)
    expect(sets[0]!.cards.some((card) => card.term === 'sin 30° (π/6)' && card.definition === '1/2')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Add Unit circle' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Open Unit circle' }).getAttribute('href')).toBe(`/study/${sets[0]!.id}`)
    expect(screen.getAllByRole('link', { name: /Unit circle/ })).toHaveLength(2)
  })

  it('a starter deck that cannot be added says why', () => {
    for (let i = 0; i < 100; i++) makeSet(`Filler ${i}`, [])
    renderStudy('/study')
    fireEvent.click(screen.getByRole('button', { name: 'Add Polyatomic ions' }))
    expect(screen.getByRole('alert').textContent).toContain('up to 100 study sets')
    expect(useStore.getState().studySets).toHaveLength(100)
  })

  it('renders card text as text', () => {
    const set = makeSet('Markup', [{ term: '<b>bold</b>', definition: '<img src=x>' }])
    renderStudy(`/study/${set.id}/flash`)
    expect(screen.getByText('<b>bold</b>')).toBeTruthy()
    expect(document.querySelector('b')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
  })

  it('the desktop rail marks Study', { timeout: 120_000 }, () => {
    setWindowSize(...WINDOWS.desktop)
    render(
      <MemoryRouter initialEntries={['/study']}>
        <AppShell />
      </MemoryRouter>,
    )
    expect(document.querySelector('[data-tab-bar]')).toBeNull()
    const rail = document.querySelector('[data-nav-rail]')
    expect(rail).toBeTruthy()
    const study = within(rail as HTMLElement).getByRole('link', { name: 'Study' })
    expect(study.getAttribute('href')).toBe('/study')
    expect(study.getAttribute('aria-current')).toBe('page')
    expect(study.querySelector('svg')).toBeTruthy()
  })

  it('the phone tab bar marks Study', { timeout: 120_000 }, () => {
    setWindowSize(...WINDOWS.phone)
    render(
      <MemoryRouter initialEntries={['/study']}>
        <AppShell />
      </MemoryRouter>,
    )
    expect(document.querySelector('[data-nav-rail]')).toBeNull()
    const bar = document.querySelector('[data-tab-bar]')
    expect(bar).toBeTruthy()
    const links = within(bar as HTMLElement).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Home', 'Study', 'Monsters', 'Graph', 'Progress', 'Settings'])
    const study = within(bar as HTMLElement).getByRole('link', { name: 'Study' })
    expect(study.getAttribute('href')).toBe('/study')
    expect(study.getAttribute('aria-current')).toBe('page')
    expect(study.querySelector('svg')).toBeTruthy()
  })
})
