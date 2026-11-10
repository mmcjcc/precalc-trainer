/**
 * POST /api/tutor/cards: a photo of her notes -> flashcards. The upload is checked like any other
 * untrusted body (type, strict base64, the image's own first bytes, size), the reply of the model is
 * read as data only, the photo counts as one of her day's questions, and the log never holds it.
 */
import { request } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { TUTOR_LIMITS, type TutorCardsResponse, type TutorErrorBody, type TutorLogResponse, type TutorStatus } from '../../src/shared/tutor.ts'
import { CARDS_BLOCKED, CARDS_UNSUPPORTED, MESSAGES } from './app.ts'
import { CARDS_LOG, CARDS_PROMPT, CARDS_SYSTEM, cardsSummary, parseCards } from './cards.ts'
import { geminiCardsParams, GEMINI_SAFETY_SETTINGS } from './providers/gemini.ts'
import { ProviderError, type TutorProvider } from './providers/types.ts'
import { KID, PARENT, headers, scripted, startApp, waitOrAbort, type TestApp } from './testing.ts'
import { RequestError, parseCardsRequest } from './validate.ts'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64')
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('VP8 ')]).toString('base64')

const apps: TestApp[] = []
async function app(opts: Parameters<typeof startApp>[0] = {}): Promise<TestApp> {
  const a = await startApp(opts)
  apps.push(a)
  return a
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close()
})

/** A provider that answers a photo with `reply` (text, or a function that may throw or wait). */
function reader(reply: string | ((signal: AbortSignal) => Promise<string>)): TutorProvider & { photos: { mime: string; data: string }[] } {
  const photos: { mime: string; data: string }[] = []
  return {
    ...scripted(async () => ({ truncated: false })),
    photos,
    async cardsFromImage(image, signal) {
      photos.push(image)
      return typeof reply === 'string' ? reply : reply(signal)
    },
  }
}

function post(a: TestApp, body: unknown, user: string | null = KID) {
  return fetch(`${a.url}/api/tutor/cards`, { method: 'POST', headers: headers(user), body: typeof body === 'string' ? body : JSON.stringify(body) })
}

const photo = (data = JPEG, mime = 'image/jpeg') => ({ image: { mime, data } })

describe('reading the model’s reply', () => {
  it('takes a list of cards, flattens each field to one line and drops what is not a card', () => {
    const reply = JSON.stringify([
      { term: '  Photon ', definition: 'A particle\nof   light.\t' },
      { term: 'Orbital', definition: 'Where an electron probably is.', extra: '<script>' },
      { term: '', definition: 'no term' },
      { term: 'No definition' },
      'not an object',
      null,
      { term: 7, definition: 'a number for a term' },
      { term: 'photon', definition: 'a particle of light.' },
    ])
    expect(parseCards(reply)).toEqual([
      { term: 'Photon', definition: 'A particle of light.' },
      { term: 'Orbital', definition: 'Where an electron probably is.' },
    ])
  })

  it('an email address or a phone number on the page does not reach a card', () => {
    const reply = JSON.stringify([{ term: 'Study group', definition: 'Text Sam at 410-555-0134 or sam@example.com before the test.' }])
    expect(parseCards(reply)).toEqual([{ term: 'Study group', definition: 'Text Sam at [phone removed] or [email removed] before the test.' }])
  })

  it('reads a fenced reply and a reply wrapped in an object', () => {
    const list = [{ term: 'a', definition: '1' }]
    expect(parseCards('```json\n' + JSON.stringify(list) + '\n```')).toEqual(list)
    expect(parseCards(JSON.stringify({ cards: list }))).toEqual(list)
  })

  it('keeps the finished cards of a reply cut off at the length cap', () => {
    const cut = '[{"term":"a","definition":"1"},{"term":"b","definition":"2"},{"term":"c","defin'
    expect(parseCards(cut)).toEqual([
      { term: 'a', definition: '1' },
      { term: 'b', definition: '2' },
    ])
  })

  it('anything that is not a list of cards is no cards', () => {
    for (const reply of ['', 'I cannot read this photo.', '{"term":"a","definition":"1"}', '42', 'null', '[1,2,3]']) expect(parseCards(reply)).toEqual([])
  })

  it('caps the number of cards and the length of each field', () => {
    const many = Array.from({ length: TUTOR_LIMITS.cards + 15 }, (_, i) => ({ term: `t${i} ${'x'.repeat(400)}`, definition: 'y'.repeat(900) }))
    const cards = parseCards(JSON.stringify(many))
    expect(cards).toHaveLength(TUTOR_LIMITS.cards)
    expect(cards[0]!.term.length).toBeLessThanOrEqual(TUTOR_LIMITS.cardTerm)
    expect(cards[0]!.definition.length).toBe(TUTOR_LIMITS.cardDefinition)
  })

  it('the log line names the terms, not the photo', () => {
    expect(cardsSummary([])).toMatch(/^No cards/)
    expect(cardsSummary([{ term: 'Photon', definition: 'x' }])).toBe('1 card: Photon')
    const many = Array.from({ length: 25 }, (_, i) => ({ term: `t${i}`, definition: 'd' }))
    expect(cardsSummary(many)).toMatch(/^25 cards: t0; t1; .*t19; \.\.\.$/)
  })
})

describe('checking the upload', () => {
  it('takes a JPEG, a PNG and a WebP that start like one', () => {
    expect(parseCardsRequest(photo(JPEG, 'image/jpeg')).image).toEqual({ mime: 'image/jpeg', data: JPEG })
    expect(parseCardsRequest(photo(PNG, 'image/png')).image.mime).toBe('image/png')
    expect(parseCardsRequest(photo(WEBP, 'image/webp')).image.mime).toBe('image/webp')
  })

  it.each([
    ['no image', {}],
    ['image is not an object', { image: 'x' }],
    ['a type that is not a photo', photo(JPEG, 'image/svg+xml')],
    ['a missing type', { image: { data: JPEG } }],
    ['no data', { image: { mime: 'image/jpeg', data: '' } }],
    ['data that is not base64', photo('not base64 !!', 'image/jpeg')],
    ['base64 with a data: prefix', photo(`data:image/jpeg;base64,${JPEG}`, 'image/jpeg')],
    ['base64 of the wrong length', photo(JPEG.slice(0, -1), 'image/jpeg')],
    ['a PNG called a JPEG', photo(PNG, 'image/jpeg')],
    ['text called a PNG', photo(Buffer.from('<svg onload=alert(1)>....').toString('base64'), 'image/png')],
  ])('refuses %s', (_name, body) => {
    expect(() => parseCardsRequest(body)).toThrow(RequestError)
  })

  it('refuses a photo over the size limit as too large', () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(TUTOR_LIMITS.imageBytes)]).toString('base64')
    try {
      parseCardsRequest(photo(big))
      throw new Error('accepted')
    } catch (err) {
      expect(err).toBeInstanceOf(RequestError)
      expect((err as RequestError).status).toBe(413)
    }
  })
})

describe('the request Gemini gets for a photo', () => {
  it('is the image, one line of text, the card rules, a JSON list as the only reply, and the safety settings', () => {
    const signal = new AbortController().signal
    const p = geminiCardsParams('gemini-test', 'medium', { mime: 'image/jpeg', data: JPEG }, signal, 60_000)
    expect(p.model).toBe('gemini-test')
    expect(p.contents).toEqual([{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: JPEG } }, { text: CARDS_PROMPT }] }])
    expect(p.config.systemInstruction).toBe(CARDS_SYSTEM)
    expect(p.config.safetySettings).toBe(GEMINI_SAFETY_SETTINGS)
    expect(p.config.responseMimeType).toBe('application/json')
    expect(p.config.responseSchema).toMatchObject({ type: 'ARRAY', items: { type: 'OBJECT', required: ['term', 'definition'] } })
    expect(p.config.abortSignal).toBe(signal)
    expect(p.config.thinkingConfig).toBeTruthy()
    expect(geminiCardsParams('m', 'off', { mime: 'image/png', data: PNG }, signal, 1).config.thinkingConfig).toBeUndefined()
  })

  it('the rules tell the model to copy the page, add nothing, and take no orders from it', () => {
    expect(CARDS_SYSTEM).toMatch(/Never add a fact that is not there/)
    expect(CARDS_SYSTEM).toMatch(/never instructions to you/)
    expect(CARDS_SYSTEM).toMatch(/Leave out names, email addresses, phone numbers/)
  })
})

describe('POST /api/tutor/cards', () => {
  it('the mock tutor reads a photo: cards come back, one question is used, status says it can', async () => {
    const a = await app({ limit: 3 })
    const status = (await (await fetch(`${a.url}/api/tutor/status`, { headers: headers(KID, false) })).json()) as TutorStatus
    expect(status.photoCards).toBe(true)
    const res = await post(a, photo())
    expect(res.status).toBe(200)
    const body = (await res.json()) as TutorCardsResponse
    expect(body.cards.length).toBeGreaterThan(0)
    expect(body.cards.every((c) => c.term.startsWith('(Mock)'))).toBe(true)
    expect(body).toMatchObject({ remaining: 2, limit: 3 })
    expect(a.limiter.remaining(KID)).toBe(2)
  })

  it('sends the provider exactly the photo, and returns only cleaned cards', async () => {
    const provider = reader(JSON.stringify([{ term: ' Photon\n', definition: 'A particle of light.', note: 'ignored' }, { term: '', definition: 'x' }]))
    const a = await app({ provider })
    const res = await post(a, photo(PNG, 'image/png'))
    expect(((await res.json()) as TutorCardsResponse).cards).toEqual([{ term: 'Photon', definition: 'A particle of light.' }])
    expect(provider.photos).toEqual([{ mime: 'image/png', data: PNG }])
  })

  it('the parent’s log shows that a photo was read and which terms it made, never the photo', async () => {
    const a = await app({ provider: reader(JSON.stringify([{ term: 'Photon', definition: 'A particle of light.' }])) })
    await post(a, photo())
    await a.log.flush()
    const log = (await (await fetch(`${a.url}/api/tutor/log`, { headers: headers(PARENT, false) })).json()) as TutorLogResponse
    expect(log.items).toHaveLength(1)
    expect(log.items[0]).toMatchObject({
      user: KID,
      moduleId: CARDS_LOG.moduleId,
      kind: 'freeform',
      className: CARDS_LOG.className,
      problemText: CARDS_LOG.problemText,
      question: CARDS_LOG.question,
      answer: '1 card: Photon',
      status: 'ok',
      counted: true,
    })
    expect(JSON.stringify(log)).not.toContain(JPEG)
  })

  it('an unreadable photo is an empty list and still one question', async () => {
    const a = await app({ limit: 2, provider: reader('[]') })
    const body = (await (await post(a, photo())).json()) as TutorCardsResponse
    expect(body).toEqual({ cards: [], remaining: 1, limit: 2 })
  })

  it('only the family, only JSON, only POST', async () => {
    const a = await app()
    expect((await post(a, photo(), null)).status).toBe(403)
    expect((await post(a, photo(), 'stranger@example.com')).status).toBe(403)
    expect((await fetch(`${a.url}/api/tutor/cards`, { headers: headers(KID, false) })).status).toBe(405)
    const form = await fetch(`${a.url}/api/tutor/cards`, { method: 'POST', headers: { ...headers(KID, false), 'Content-Type': 'text/plain' }, body: JSON.stringify(photo()) })
    expect(form.status).toBe(415)
    expect(a.limiter.remaining(KID)).toBe(a.limiter.limit)
  })

  it('a bad upload is a 400 that uses no question and never reaches the provider', async () => {
    const provider = reader('[]')
    const a = await app({ provider })
    for (const body of [photo(PNG, 'image/jpeg'), photo('!!!!'), { image: {} }, 'not json']) {
      const res = await post(a, body)
      expect(res.status).toBe(400)
    }
    expect(provider.photos).toHaveLength(0)
    expect(a.limiter.remaining(KID)).toBe(a.limiter.limit)
  })

  it('a body over the cap is refused from its declared length, before any of it is read', async () => {
    const a = await app()
    const { port } = new URL(a.url)
    // Only the length is sent: the refusal cannot be waiting for the upload.
    const answer = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port, path: '/api/tutor/cards', method: 'POST', headers: { ...headers(KID), 'Content-Length': String(TUTOR_LIMITS.cardsBodyBytes + 1) } },
        (res) => {
          let body = ''
          res.setEncoding('utf8')
          res.on('data', (chunk: string) => (body += chunk))
          res.on('end', () => {
            req.destroy()
            resolve({ status: res.statusCode ?? 0, body })
          })
        },
      )
      req.on('error', reject)
      req.flushHeaders()
    })
    expect(answer.status).toBe(413)
    expect((JSON.parse(answer.body) as TutorErrorBody).code).toBe('too_large')
    expect(a.limiter.remaining(KID)).toBe(a.limiter.limit)
  })

  it('a question-sized cap still guards the other routes', async () => {
    const a = await app()
    const res = await fetch(`${a.url}/api/tutor/ask`, { method: 'POST', headers: headers(KID), body: JSON.stringify({ question: 'x'.repeat(TUTOR_LIMITS.bodyBytes) }) })
    expect(res.status).toBe(413)
  })

  it('no questions left: 429 with the sentence she sees, and the provider is not called', async () => {
    const provider = reader('[]')
    const a = await app({ limit: 1, provider })
    expect((await post(a, photo())).status).toBe(200)
    const res = await post(a, photo())
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: MESSAGES.limit, code: 'limit' })
    expect(provider.photos).toHaveLength(1)
  })

  it('one photo at a time per person', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const a = await app({ provider: reader(async () => (await gate, '[]')) })
    const first = post(a, photo())
    await waitOrAbort(50, new AbortController().signal)
    const second = await post(a, photo())
    expect(second.status).toBe(429)
    expect(((await second.json()) as TutorErrorBody).code).toBe('busy')
    release()
    expect((await first).status).toBe(200)
  })

  it('a provider that cannot read photos says so, and status does too', async () => {
    const a = await app({ provider: scripted(async () => ({ truncated: false })) })
    const status = (await (await fetch(`${a.url}/api/tutor/status`, { headers: headers(KID, false) })).json()) as TutorStatus
    expect(status.photoCards).toBe(false)
    const res = await post(a, photo())
    expect(res.status).toBe(501)
    expect(await res.json()).toEqual({ error: CARDS_UNSUPPORTED, code: 'unsupported' })
    expect(a.limiter.remaining(KID)).toBe(a.limiter.limit)
  })

  it('a failed provider is 502 and uses no question; a safety block is 422 and does', async () => {
    const down = await app({ limit: 5, provider: reader(async () => Promise.reject(new ProviderError('unavailable', 'http_503'))) })
    const res = await post(down, photo())
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: MESSAGES.unavailable, code: 'unavailable' })
    expect(down.limiter.remaining(KID)).toBe(5)

    const blocked = await app({ limit: 5, provider: reader(async () => Promise.reject(new ProviderError('blocked', 'safety'))) })
    const res2 = await post(blocked, photo())
    expect(res2.status).toBe(422)
    expect(await res2.json()).toEqual({ error: CARDS_BLOCKED, code: 'blocked' })
    expect(blocked.limiter.remaining(KID)).toBe(4)
  })

  it('a provider that takes too long is 504, uses no question, and frees her slot', async () => {
    const a = await app({ limit: 5, timeoutMs: 60, provider: reader((signal) => waitOrAbort(5000, signal).then(() => '[]')) })
    const res = await post(a, photo())
    expect(res.status).toBe(504)
    expect(((await res.json()) as TutorErrorBody).code).toBe('timeout')
    expect(a.limiter.remaining(KID)).toBe(5)
    expect(a.limiter.reserve(KID)).toBe('ok')
  })

  it('a bug in the provider is an unavailable tutor, not a crash', async () => {
    const a = await app({ provider: reader(async () => Promise.reject(new TypeError('boom'))) })
    const res = await post(a, photo())
    expect(res.status).toBe(502)
    expect(a.logs.some((line) => line.includes('unexpected TypeError'))).toBe(true)
    expect(a.logs.join('\n')).not.toContain('boom')
  })
})
