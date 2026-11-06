// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
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

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
})

afterEach(() => {
  resetWindowSize()
})

describe('study sets', () => {
  it('creates a deck and lists it', () => {
    renderStudy('/study')
    expect(screen.getByRole('heading', { name: 'Study sets' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('New set title'), { target: { value: 'Spanish' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create set' }))
    expect(screen.getByRole('link', { name: /Spanish/ })).toBeTruthy()
    expect(screen.getByText('0 cards')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the import page' })).toBeTruthy()
    expect(screen.getByLabelText('Share code')).toBeTruthy()
    expect(useStore.getState().studySets.map((set) => set.title)).toEqual(['Spanish'])
  })

  it('tells her when a save drops a blank card', () => {
    const set = makeSet('Notes', [])
    renderStudy(`/study/${set.id}`)
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    fireEvent.change(screen.getByLabelText('Term 1'), { target: { value: 'hola' } })
    fireEvent.change(screen.getByLabelText('Definition 1'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status').textContent).toBe('1 blank card removed')
    expect(useStore.getState().studySets[0]!.cards.map((card) => card.term)).toEqual(['hola'])
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
    expect(screen.getByRole('button', { name: 'Term: mito' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Still learning' }))
    expect(screen.getByRole('status').textContent).toBe('1 got it. 1 still learning.')
    expect(screen.getByRole('button', { name: 'Practice 1 still learning' })).toBeTruthy()
    const learned = events().filter((event) => event.t === 'study_learned')
    expect(learned).toHaveLength(1)
    expect(learned[0]).toMatchObject({ setId: set.id, cardId: set.cards[0]!.id })
    expect(events().filter((event) => event.t === 'study_round')).toEqual([expect.objectContaining({ setId: set.id, mode: 'flash' })])
  })

  it('learn: four choices, then a round of the cards that were missed', () => {
    const defs: Record<string, string> = {
      cell: 'smallest unit',
      mito: 'powerhouse',
      nucleus: 'control center',
      ribosome: 'makes proteins',
    }
    const set = makeSet('Cells', Object.entries(defs).map(([term, definition]) => ({ term, definition })))
    renderStudy(`/study/${set.id}/learn`)
    let guard = 0
    while (!screen.queryByText(/right on the first try/) && guard < 8) {
      const term = shownTerm()
      const buttons = within(screen.getByRole('group', { name: 'Choices' })).getAllByRole('button')
      const texts = buttons.map((button) => button.textContent)
      expect(buttons).toHaveLength(4)
      expect(new Set(texts).size).toBe(4)
      expect(texts.filter((text) => text === defs[term]).length).toBe(1)
      for (const text of texts) expect(Object.values(defs)).toContain(text)
      fireEvent.click(screen.getByRole('button', { name: defs[term]! }))
      guard += 1
    }
    expect(screen.getByRole('status').textContent).toBe('4 right on the first try. 0 needed another try.')
    expect(events().filter((event) => event.t === 'study_learned')).toHaveLength(4)
    expect(events().some((event) => event.t === 'study_round' && event.mode === 'learn')).toBe(true)
  })

  it('learn with fewer than four cards reveals the definition, and a miss comes back', () => {
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
      fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
      expect(screen.getByText(defs[term]!)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: wrongs === 0 ? 'Wrong' : 'Right' }))
      wrongs += 1
      guard += 1
    }
    expect(screen.getByRole('status').textContent).toBe('1 right on the first try. 1 needed another try.')
  })

  it('match: pairs clear, the next board follows, and a faster time is kept', () => {
    const set = makeSet('Cells', [
      { term: 'cell', definition: 'smallest unit' },
      { term: 'mito', definition: 'powerhouse' },
    ])
    useStore.getState().recordStudyMatch(set.id, 60_000, 2)
    renderStudy(`/study/${set.id}/match`)
    expect(screen.getByText(/Best 1:00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Term: cell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Definition: smallest unit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Term: mito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Definition: powerhouse' }))
    expect(screen.getByRole('status').textContent).toMatch(/Matched all 2\. Time /)
    const best = useStore.getState().studySets[0]!.bestMatchMs
    expect(typeof best).toBe('number')
    expect(best!).toBeLessThan(60_000)
    expect(events().filter((event) => event.t === 'study_learned')).toHaveLength(2)
    expect(events().filter((event) => event.t === 'study_round' && event.mode === 'match')).toHaveLength(1)
  })

  it('match keeps going until every card has been paired', () => {
    const cards = Array.from({ length: 7 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` }))
    const set = makeSet('Sevens', cards)
    renderStudy(`/study/${set.id}/match`)
    for (let i = 0; i < 7; i++) {
      const termBtn = screen.getAllByRole('button').find((button) => button.getAttribute('data-side') === 'term')
      if (!termBtn) throw new Error('no term tile')
      const term = termBtn.querySelectorAll('span')[1]?.textContent ?? ''
      const def = `d${term.slice(1)}`
      fireEvent.click(termBtn)
      const defBtn = screen.getAllByRole('button').find((button) => button.getAttribute('data-side') === 'definition' && button.querySelectorAll('span')[1]?.textContent === def)
      if (!defBtn) throw new Error(`no definition for ${term}`)
      fireEvent.click(defBtn)
    }
    expect(screen.getByRole('status').textContent).toMatch(/Matched all 7/)
    expect(events().filter((event) => event.t === 'study_round' && event.mode === 'match')).toHaveLength(1)
    expect(events().filter((event) => event.t === 'study_learned')).toHaveLength(7)
  })

  it('a test ignores spacing and case, and I was right flips that row', () => {
    const set = makeSet('Cells', [
      { term: 'cell', definition: 'smallest unit' },
      { term: 'mito', definition: 'powerhouse' },
    ])
    renderStudy(`/study/${set.id}/test`)
    expect(screen.getByText('All 2 cards')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Definition for cell'), { target: { value: '  SMALLEST   unit ' } })
    fireEvent.change(screen.getByLabelText('Definition for mito'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Score: 1 of 2')).toBeTruthy()
    expect(screen.getByText('Your answer: nope')).toBeTruthy()
    expect(screen.getByText('Definition: powerhouse')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'I was right' }))
    expect(screen.getByText('Score: 2 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I was right' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'I was right' }))
    expect(screen.getByText('Score: 1 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I was right' }).getAttribute('aria-pressed')).toBe('false')
    expect(events().filter((event) => event.t === 'study_learned').map((event) => (event.t === 'study_learned' ? event.cardId : ''))).toEqual([
      set.cards[0]!.id,
      set.cards[1]!.id,
    ])
    expect(events().filter((event) => event.t === 'study_round' && event.mode === 'test')).toHaveLength(1)
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
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('alert').textContent).toBe(STUDY_CODE_ERROR)
    expect(screen.queryByRole('button', { name: 'Add to my sets' })).toBeNull()
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
    expect(screen.getByText('In your sets')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Unit circle/ })).toBeTruthy()
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
