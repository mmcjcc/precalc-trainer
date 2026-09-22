/** Small HTTP helpers: capped body reading, JSON replies, Server-Sent Events framing. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TutorErrorBody, TutorStreamEvent } from '../../src/shared/tutor.ts'
import { RequestError } from './validate.ts'

/**
 * Reads the whole body, refusing more than `max` bytes (413) as soon as the declared length or the
 * running total says so, without buffering the excess.
 */
export function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > max) {
      req.resume()
      reject(new RequestError(`body is larger than ${max} bytes`, 'too_large', 413))
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    let done = false
    req.on('data', (chunk: Buffer) => {
      if (done) return
      size += chunk.length
      if (size > max) {
        done = true
        chunks.length = 0
        reject(new RequestError(`body is larger than ${max} bytes`, 'too_large', 413))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!done) {
        done = true
        resolve(Buffer.concat(chunks).toString('utf8'))
      }
    })
    req.on('error', (err) => {
      if (!done) {
        done = true
        reject(err)
      }
    })
  })
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new RequestError('body is not valid JSON')
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
    ...extra,
  })
  res.end(text)
}

export function sendError(res: ServerResponse, status: number, error: string, code: string): void {
  const body: TutorErrorBody = { error, code }
  // A refused over-size upload may still be arriving: close the connection after answering.
  sendJson(res, status, body, status === 413 ? { Connection: 'close' } : {})
}

/** Starts an event stream. nginx is told not to buffer it (X-Accel-Buffering) on top of proxy_buffering off. */
export function startEventStream(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  })
  res.flushHeaders()
}

/** One SSE frame: `event: <type>` and one `data:` line of JSON (JSON never contains a raw newline). */
export function formatEvent(event: TutorStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/** A comment line: keeps proxies from timing out an idle stream while the model thinks. Clients ignore it. */
export const HEARTBEAT = ': keep-alive\n\n'
