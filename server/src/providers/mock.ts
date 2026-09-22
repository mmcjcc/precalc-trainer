/**
 * TUTOR_PROVIDER=mock: a canned coaching reply built from the request, streamed word by word, with
 * no network and no key. For local development, CI and UI tests. Every reply starts with
 * "(Mock tutor)" so nobody mistakes it for a real answer.
 *
 * Test hooks, typed anywhere in the question:
 *   [mock-error]    fails like an unreachable provider   -> error event "unavailable" (not counted)
 *   [mock-blocked]  fails like a safety block             -> error event "blocked" (counted)
 *   [mock-hang]     never answers, until the request times out or is closed
 *   [mock-long]     a reply long enough to test scrolling
 */
import type { ProviderRequest } from '../prompt.ts'
import { ProviderError, type ProviderResult, type TutorProvider } from './types.ts'

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new ProviderError('aborted', 'aborted'))
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new ProviderError('aborted', 'aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function between(text: string, open: string, close: string): string {
  const a = text.lastIndexOf(open)
  if (a < 0) return ''
  const b = text.indexOf(close, a + open.length)
  return (b < 0 ? text.slice(a + open.length) : text.slice(a + open.length, b)).trim()
}

function field(block: string, label: string): string {
  const line = block.split('\n').find((l) => l.trimStart().startsWith(label))
  return line ? line.trimStart().slice(label.length).trim() : ''
}

/** The canned reply: names the checker's mistake when there is one, and respects OPEN / FINISHED. */
export function mockReply(req: ProviderRequest): string {
  const last = req.turns[req.turns.length - 1]?.text ?? ''
  const block = between(last, '<problem>', '</problem>')
  const mistake = field(block, 'Named mistake:')
  const lesson = field(block, 'Lesson:')
  const witness = field(block, 'About her numbers:')
  const open = block.includes('Status: OPEN')
  const parts = ['(Mock tutor)']
  if (mistake) {
    parts.push(`The checker named this one: ${mistake}.`)
    if (lesson) parts.push(lesson)
    if (witness) parts.push(witness)
  } else {
    parts.push('Good question. Start from what the problem is asking and look at your last line.')
  }
  parts.push(open ? 'What single move gets you one step closer? Try it and check it.' : 'You finished it, so here is the idea from start to end: each step kept the statement equivalent.')
  if (req.turns.length > 1) parts.push(`(I can see ${Math.floor(req.turns.length / 2)} earlier question(s) on this problem.)`)
  return parts.join(' ')
}

export function createMockProvider(opts: { delayMs: number }): TutorProvider {
  return {
    name: 'mock',
    model: 'mock',
    configured: true,
    async check() {},
    async stream(req, onText, signal): Promise<ProviderResult> {
      const question = between(req.turns[req.turns.length - 1]?.text ?? '', '<question>', '</question>')
      if (question.includes('[mock-error]')) {
        await sleep(opts.delayMs, signal)
        throw new ProviderError('unavailable', 'mock_error')
      }
      if (question.includes('[mock-blocked]')) {
        await sleep(opts.delayMs, signal)
        throw new ProviderError('blocked', 'mock_blocked')
      }
      if (question.includes('[mock-hang]')) {
        await sleep(24 * 60 * 60 * 1000, signal)
      }
      let reply = mockReply(req)
      if (question.includes('[mock-long]')) reply = Array.from({ length: 12 }, () => reply).join('\n\n')
      const words = reply.split(/(?<= )/)
      for (const w of words) {
        await sleep(opts.delayMs, signal)
        onText(w)
      }
      return { truncated: false }
    },
  }
}
