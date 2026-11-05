/**
 * Share codes for a study set. No server and no compression: JSON, UTF-8, base64url, then a CRC32 of those bytes.
 * Parsing returns a result and does not throw. Card text is not coerced: a non-string term is a rejection.
 */
import { STUDY_LIMITS } from '@/store/studySets'

export const CODE_PREFIX = 'MTS1.'
/** Don't parse a paste longer than this. */
export const MAX_CODE_CHARS = 256 * 1024

export const STUDY_CODE_ERROR = "That code isn't a study set. Check you copied all of it."

export interface SharedStudySet {
  title: string
  cards: { term: string; definition: string }[]
}

export type ParsedStudyCode = { ok: true; set: SharedStudySet } | { ok: false; error: string }

const fail = (error = STUDY_CODE_ERROR): ParsedStudyCode => ({ ok: false, error })

/** CRC-32 (ISO-HDLC), 8 lowercase hex digits. */
export function crc32Hex(bytes: Uint8Array): string {
  let crc = 0xffffffff
  for (const b of bytes) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4))
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

/** Wrap any JSON value the way a share code wraps a set. Tests use it for codes that should be rejected. */
export function sealStudyCode(payload: unknown): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  return `${CODE_PREFIX}${bytesToBase64Url(bytes)}.${crc32Hex(bytes)}`
}

export function encodeStudySet(set: { title: string; cards: readonly { term: string; definition: string }[] }): string {
  return sealStudyCode({
    v: 1,
    title: set.title,
    cards: set.cards.map((card) => [card.term, card.definition]),
  })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseStudyCode(input: string): ParsedStudyCode {
  try {
    if (typeof input !== 'string') return fail()
    if (input.length > MAX_CODE_CHARS) return fail()
    const code = input.trim()
    if (!code.startsWith(CODE_PREFIX)) return fail()
    const rest = code.slice(CODE_PREFIX.length)
    const dot = rest.lastIndexOf('.')
    if (dot <= 0) return fail()
    const body = rest.slice(0, dot)
    const sum = rest.slice(dot + 1)
    if (!/^[0-9a-fA-F]{8}$/.test(sum)) return fail()
    const bytes = base64UrlToBytes(body)
    if (!bytes) return fail()
    if (crc32Hex(bytes).toLowerCase() !== sum.toLowerCase()) return fail()
    let raw: unknown
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return fail()
    }
    if (!isRecord(raw) || raw.v !== 1) return fail()
    if (typeof raw.title !== 'string') return fail()
    const title = raw.title
    if (title.trim().length === 0) return fail()
    if (title.length > STUDY_LIMITS.maxTitle) return { ok: false, error: `A title can be at most ${STUDY_LIMITS.maxTitle} characters.` }
    if (!Array.isArray(raw.cards)) return fail()
    if (raw.cards.length > STUDY_LIMITS.maxCards) {
      return { ok: false, error: `A set can have at most ${STUDY_LIMITS.maxCards} cards.` }
    }
    const cards: { term: string; definition: string }[] = []
    for (const row of raw.cards) {
      if (!Array.isArray(row) || row.length !== 2) return fail()
      const [term, definition] = row
      if (typeof term !== 'string' || typeof definition !== 'string') return fail()
      if (term.length > STUDY_LIMITS.maxField || definition.length > STUDY_LIMITS.maxField) {
        return { ok: false, error: `A term or a definition can be at most ${STUDY_LIMITS.maxField} characters.` }
      }
      cards.push({ term, definition })
    }
    return { ok: true, set: { title, cards } }
  } catch {
    return fail()
  }
}
