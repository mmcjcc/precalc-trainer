import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/content/rng'
import { crc32Hex, encodeStudySet, MAX_CODE_CHARS, parseStudyCode, sealStudyCode, STUDY_CODE_ERROR } from './code'

const ALPHA = ['a', 'Z', ' ', '\n', '\t', '"', '\\', "'", 'é', '你', '😀', 'ß', '<', '>', '&', '{', '}']

/** Up to `max` UTF-16 code units. An emoji in the alphabet is two, so the count is not the length. */
function randText(rng: () => number, max: number): string {
  const n = Math.floor(rng() * (max + 1))
  let out = ''
  for (let i = 0; i < n; i++) {
    const ch = ALPHA[Math.floor(rng() * ALPHA.length)]!
    if (out.length + ch.length > max) break
    out += ch
  }
  return out
}

function flipChecksum(code: string): string {
  const hex = '0123456789abcdef'
  const last = code[code.length - 1]!.toLowerCase()
  const next = hex[(hex.indexOf(last) + 1) % 16]!
  return code.slice(0, -1) + next
}

describe('share codes', () => {
  it('CRC32 of the bytes of 123456789 is cbf43926', () => {
    expect(crc32Hex(new TextEncoder().encode('123456789'))).toBe('cbf43926')
  })

  it('round-trips randomized sets, including unicode, emoji, newlines, quotes and long fields', () => {
    const sizes = [1, 2, 3, 8, 50, 200]
    for (let n = 0; n < 24; n++) {
      const rng = mulberry32(0xa11ce + n)
      const count = n < sizes.length ? sizes[n]! : 1 + Math.floor(rng() * 40)
      const short = count >= 50
      const cards = [
        { term: 'line\n"quote"\\', definition: 'emoji 😀 and 你' },
        ...Array.from({ length: count - 1 }, () => ({
          term: randText(rng, short ? 8 : n === 6 ? 500 : 40),
          definition: randText(rng, short ? 8 : n === 6 ? 500 : 40),
        })),
      ]
      let title = `T${randText(rng, 79)}`
      if (title.length > 80) title = title.slice(0, 80)
      if (/[\uD800-\uDBFF]$/.test(title)) title = title.slice(0, -1)
      const code = encodeStudySet({ title, cards })
      expect(code).toMatch(/^MTS1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/)
      expect(code.length).toBeLessThanOrEqual(MAX_CODE_CHARS)
      const parsed = parseStudyCode(code)
      expect(parsed, parsed.ok ? '' : parsed.error).toMatchObject({ ok: true, set: { title, cards } })
    }
    const maxed = encodeStudySet({ title: 'M', cards: [{ term: 'a'.repeat(500), definition: 'b'.repeat(500) }] })
    const parsed = parseStudyCode(maxed)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.set.cards[0]!.term).toHaveLength(500)
      expect(parsed.set.cards[0]!.definition).toHaveLength(500)
    }
  })

  it.each([
    ['wrong prefix', (good: string) => `NOPE.${good.slice(5)}`],
    ['truncated code', (good: string) => good.slice(0, -4)],
    ['flipped checksum', (good: string) => flipChecksum(good)],
    ['bad base64', (_good: string) => 'MTS1.!!!!.00000000'],
    ['non-string term', (_good: string) => sealStudyCode({ v: 1, title: 'T', cards: [[1, 'definition']] })],
    ['non-string definition', (_good: string) => sealStudyCode({ v: 1, title: 'T', cards: [['term', { text: 'no' }]] })],
    ['more than 200 cards', (_good: string) => sealStudyCode({ v: 1, title: 'T', cards: Array.from({ length: 201 }, () => ['a', 'b']) })],
    ['a field over 500 characters', (_good: string) => sealStudyCode({ v: 1, title: 'T', cards: [['x'.repeat(501), 'y']] })],
    ['input over 256 KB', (_good: string) => `MTS1.${'a'.repeat(MAX_CODE_CHARS)}`],
  ])('%s is rejected and does not throw', (_name, make) => {
    const good = encodeStudySet({ title: 'Cells', cards: [{ term: 'cell', definition: 'smallest unit' }] })
    const input = make(good)
    let result: ReturnType<typeof parseStudyCode> | undefined
    expect(() => {
      result = parseStudyCode(input)
    }).not.toThrow()
    expect(result?.ok).toBe(false)
    if (result && !result.ok) expect(result.error.length).toBeGreaterThan(0)
  })

  it('names the limit it hit, and a garbage paste gets the friendly message', () => {
    const tooMany = parseStudyCode(sealStudyCode({ v: 1, title: 'T', cards: Array.from({ length: 201 }, () => ['a', 'b']) }))
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.error).toMatch(/200/)
    const tooLong = parseStudyCode(sealStudyCode({ v: 1, title: 'T', cards: [['x'.repeat(501), 'y']] }))
    expect(tooLong.ok).toBe(false)
    if (!tooLong.ok) expect(tooLong.error).toMatch(/500/)
    const titled = parseStudyCode(sealStudyCode({ v: 1, title: 't'.repeat(81), cards: [] }))
    expect(titled.ok).toBe(false)
    if (!titled.ok) expect(titled.error).toMatch(/80/)
    const garbage = parseStudyCode('not a code')
    expect(garbage).toEqual({ ok: false, error: STUDY_CODE_ERROR })
    const rng = mulberry32(99)
    for (let i = 0; i < 40; i++) {
      const n = Math.floor(rng() * 80)
      let text = ''
      for (let j = 0; j < n; j++) text += String.fromCharCode(Math.floor(rng() * 512))
      expect(() => parseStudyCode(text)).not.toThrow()
      const result = parseStudyCode(text)
      expect(result.ok === true || result.error.length > 0).toBe(true)
    }
    expect(() => parseStudyCode(123 as unknown as string)).not.toThrow()
    expect(parseStudyCode(123 as unknown as string).ok).toBe(false)
  })
})
