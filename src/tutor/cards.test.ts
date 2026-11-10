/**
 * cardsFromPhoto (tutor/api.ts): what the app sends for a photo of her notes and how each answer of
 * the server becomes cards or one sentence to show her. It never throws.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardsFromPhoto } from './api'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const IMAGE = { mime: 'image/jpeg', data: 'AAAA' } as const

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cards from a photo: the request and its answers', () => {
  it('posts the photo as JSON and returns the cards and the questions left', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json({ cards: [{ term: 'Photon', definition: 'A particle of light.' }], remaining: 4, limit: 30 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await cardsFromPhoto(IMAGE)).toEqual({ ok: true, cards: [{ term: 'Photon', definition: 'A particle of light.' }], remaining: 4 })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/tutor/cards')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual({ image: IMAGE })
  })

  it('drops anything in the list that is not a card', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ cards: [{ term: 'a', definition: '1' }, null, { term: 2, definition: 'x' }, 'nope'], remaining: 1, limit: 30 })))
    expect(await cardsFromPhoto(IMAGE)).toEqual({ ok: true, cards: [{ term: 'a', definition: '1' }], remaining: 1 })
  })

  it.each([
    ['limit', 429, "You've used all of today's tutor questions. They come back tomorrow."],
    ['busy', 429, 'The tutor is still answering your last question.'],
    ['blocked', 422, "I can't make cards from that photo. Try a photo of your class notes."],
    ['timeout', 504, 'The tutor took too long to answer. Try asking again.'],
    ['unsupported', 501, "The tutor can't read photos with its current setup."],
  ])('shows the server’s own sentence for %s', async (code, status, error) => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error, code }, status)))
    expect(await cardsFromPhoto(IMAGE)).toEqual({ ok: false, message: error })
  })

  it('a technical refusal becomes a plain sentence, never the server’s wording', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'image.data must be base64', code: 'bad_request' }, 400)))
    const result = await cardsFromPhoto(IMAGE)
    expect(result).toEqual({ ok: false, message: "That photo couldn't be read. Try another one." })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    expect(await cardsFromPhoto(IMAGE)).toEqual({ ok: false, message: "That photo couldn't be read. Try another one." })
  })

  it('too big, offline, and a dropped connection each say so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'body is larger', code: 'too_large' }, 413)))
    expect(await cardsFromPhoto(IMAGE)).toMatchObject({ ok: false, message: expect.stringMatching(/too big to send/) })
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'tutor offline' }, 503)))
    expect(await cardsFromPhoto(IMAGE)).toEqual({ ok: false, message: 'The tutor is offline right now.' })
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('network'))))
    expect(await cardsFromPhoto(IMAGE)).toEqual({ ok: false, message: 'The tutor is offline right now.' })
  })

  it('a 200 that is not the answer is an unavailable tutor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ nope: true })))
    expect(await cardsFromPhoto(IMAGE)).toMatchObject({ ok: false })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    expect(await cardsFromPhoto(IMAGE)).toMatchObject({ ok: false })
  })
})
