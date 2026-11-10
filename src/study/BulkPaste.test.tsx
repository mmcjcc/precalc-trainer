// @vitest-environment jsdom
/**
 * The photo button in the paste box (study/BulkPaste.tsx): there only when a tutor that reads photos
 * is running, it adds the cards the tutor read to the ones she pasted, and every way it can fail is
 * a sentence on the page. The tutor, and the shrinking of the photo, are stubbed here: the server
 * side is server/src/cards.test.ts.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TutorStatus } from '@/shared/tutor'
import type { PhotoCards } from '@/tutor/api'

const tutor = vi.hoisted(() => ({
  status: null as TutorStatus | null,
  reply: { ok: true, cards: [], remaining: 0 } as PhotoCards,
  shrink: 'ok' as 'ok' | 'fail',
  sent: [] as unknown[],
}))

vi.mock('@/tutor/useTutorStatus', () => ({
  useTutorStatus: () => ({ ready: true, status: tutor.status }),
}))
vi.mock('@/tutor/api', () => ({
  cardsFromPhoto: async (image: unknown) => {
    tutor.sent.push(image)
    return tutor.reply
  },
}))
vi.mock('@/study/photo', () => ({
  shrinkPhoto: async () => {
    if (tutor.shrink === 'fail') throw new Error('unreadable')
    return { mime: 'image/jpeg', data: 'AAAA' }
  },
}))

import { BulkPaste, useBulkDraft } from './BulkPaste'

const STATUS: TutorStatus = { configured: true, provider: 'gemini', model: 'm', limit: 30, remaining: 12, isParent: false, logging: 'file', photoCards: true }

function Box({ room = 200 }: { room?: number }) {
  const draft = useBulkDraft(room)
  return (
    <div>
      <BulkPaste draft={draft} />
      <p data-testid="terms">{draft.result.cards.map((card) => card.term).join('|')}</p>
    </div>
  )
}

function choose() {
  const file = new File(['x'], 'notes.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Photo of your notes'), { target: { files: [file] } })
}

beforeEach(() => {
  tutor.status = STATUS
  tutor.reply = { ok: true, cards: [], remaining: 11 }
  tutor.shrink = 'ok'
  tutor.sent = []
})

describe('cards from a photo of her notes', () => {
  it('is not offered without a tutor, or with one that cannot read photos', () => {
    tutor.status = null
    const view = render(<Box />)
    expect(screen.queryByText(/photo of your notes/i)).toBeNull()
    view.unmount()
    tutor.status = { ...STATUS, photoCards: false }
    render(<Box />)
    expect(screen.queryByRole('button', { name: 'Take or choose a photo' })).toBeNull()
  })

  it('says what it costs, reads the photo, and adds its cards after the pasted ones', async () => {
    tutor.reply = {
      ok: true,
      remaining: 11,
      cards: [
        { term: 'Photon', definition: 'A particle of light.' },
        { term: 'Orbital', definition: 'Where an electron probably is.' },
      ],
    }
    render(<Box />)
    expect(screen.getByText(/one of today's tutor questions \(12 left\)/)).toBeTruthy()
    expect(screen.getByText(/the photo is not kept/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Paste your notes'), { target: { value: 'Quantum - the smallest step of energy' } })
    choose()
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Read 2 cards from your photo/))
    expect(tutor.sent).toEqual([{ mime: 'image/jpeg', data: 'AAAA' }])
    expect(screen.getByTestId('terms').textContent).toBe('Quantum|Photon|Orbital')
    expect(screen.getByText(/3 cards found/)).toBeTruthy()
    expect(screen.getByText(/2 from your photo/)).toBeTruthy()
    expect(screen.getByText(/\(11 left\)/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add another photo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: "Remove the photo's cards" }))
    expect(screen.getByTestId('terms').textContent).toBe('Quantum')
  })

  it('a photo with nothing readable says so and adds nothing', async () => {
    render(<Box />)
    choose()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/couldn't find any notes/))
    expect(screen.getByTestId('terms').textContent).toBe('')
  })

  it('the tutor’s own sentence is shown when it refuses', async () => {
    tutor.reply = { ok: false, message: "You've used all of today's tutor questions. They come back tomorrow." }
    render(<Box />)
    choose()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe("You've used all of today's tutor questions. They come back tomorrow."))
  })

  it('a file the device cannot open never reaches the tutor', async () => {
    tutor.shrink = 'fail'
    render(<Box />)
    choose()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/isn't a photo this device can open/))
    expect(tutor.sent).toEqual([])
  })

  it('no questions left: the button is off', () => {
    tutor.status = { ...STATUS, remaining: 0 }
    render(<Box />)
    expect((screen.getByRole('button', { name: 'Take or choose a photo' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('cards from a photo only fill the room the set has left', async () => {
    tutor.reply = { ok: true, remaining: 11, cards: Array.from({ length: 5 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` })) }
    render(<Box room={3} />)
    choose()
    await waitFor(() => expect(screen.getByTestId('terms').textContent).toBe('t0|t1|t2'))
    expect(screen.getByText(/2 cards do not fit/)).toBeTruthy()
  })
})
