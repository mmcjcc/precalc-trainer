/**
 * Shape and size checks for request bodies. Everything here is untrusted input from the browser:
 * unknown fields are dropped, every string is length-capped, and a bad body is a 400 naming the
 * field (never a guess). The body-size cap itself is enforced while reading (http.ts).
 */
import {
  TUTOR_IMAGE_TYPES,
  TUTOR_LIMITS,
  TUTOR_SUBJECTS,
  type TutorAskRequest,
  type TutorCardsRequest,
  type TutorContext,
  type TutorFlagRequest,
  type TutorFreeformContext,
  type TutorImageType,
  type TutorMistake,
  type TutorVerdict,
} from '../../src/shared/tutor.ts'

export class RequestError extends Error {
  constructor(
    message: string,
    readonly code: string = 'bad_request',
    readonly status: number = 400,
  ) {
    super(message)
  }
}

type Obj = Record<string, unknown>

function obj(v: unknown, field: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new RequestError(`${field} must be an object`)
  return v as Obj
}

function str(o: Obj, key: string, path: string, max: number, required: boolean): string | undefined {
  const v = o[key]
  if (v === undefined || v === null) {
    if (required) throw new RequestError(`${path}${key} is required`)
    return undefined
  }
  if (typeof v !== 'string') throw new RequestError(`${path}${key} must be a string`)
  if (v.length > max) throw new RequestError(`${path}${key} is longer than ${max} characters`, 'too_long')
  return v
}

function reqStr(o: Obj, key: string, path: string, max: number): string {
  return str(o, key, path, max, true) as string
}

function bool(o: Obj, key: string, path: string): boolean {
  const v = o[key]
  if (typeof v !== 'boolean') throw new RequestError(`${path}${key} must be true or false`)
  return v
}

function lines(o: Obj, key: string, path: string): string[] {
  const v = o[key]
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new RequestError(`${path}${key} must be an array of strings`)
  if (v.length > TUTOR_LIMITS.lines) throw new RequestError(`${path}${key} has more than ${TUTOR_LIMITS.lines} lines`, 'too_long')
  return v.map((x, i) => {
    if (typeof x !== 'string') throw new RequestError(`${path}${key}[${i}] must be a string`)
    if (x.length > TUTOR_LIMITS.line) throw new RequestError(`${path}${key}[${i}] is longer than ${TUTOR_LIMITS.line} characters`, 'too_long')
    return x
  })
}

const VERDICTS: ReadonlySet<string> = new Set(['accepted', 'rejected', 'correct', 'wrong', 'parse_error'])
const SUBJECTS: ReadonlySet<string> = new Set(TUTOR_SUBJECTS)
const ID = /^[A-Za-z0-9_.:@/#?=&+-]{1,200}$/
const WORD = /^[A-Za-z0-9_-]{1,60}$/

function mistake(v: unknown): TutorMistake | undefined {
  if (v === undefined || v === null) return undefined
  const o = obj(v, 'context.verdict.mistake')
  const p = 'context.verdict.mistake.'
  const id = str(o, 'id', p, 80, false)
  const witness = str(o, 'witness', p, TUTOR_LIMITS.field, false)
  return {
    ...(id ? { id } : {}),
    title: reqStr(o, 'title', p, 200),
    lesson: reqStr(o, 'lesson', p, TUTOR_LIMITS.field),
    ...(witness ? { witness } : {}),
  }
}

function verdict(v: unknown): TutorVerdict | undefined {
  if (v === undefined || v === null) return undefined
  const o = obj(v, 'context.verdict')
  const p = 'context.verdict.'
  const status = reqStr(o, 'status', p, 20)
  if (!VERDICTS.has(status)) throw new RequestError(`${p}status must be one of ${[...VERDICTS].join(', ')}`)
  const line = str(o, 'line', p, TUTOR_LIMITS.line, false)
  const message = str(o, 'message', p, TUTOR_LIMITS.field, false)
  const m = mistake(o.mistake)
  return {
    status: status as TutorVerdict['status'],
    ...(line ? { line } : {}),
    ...(message ? { message } : {}),
    ...(m ? { mistake: m } : {}),
  }
}

export function parseContext(v: unknown): TutorContext {
  const o = obj(v, 'context')
  const p = 'context.'
  const problemId = reqStr(o, 'problemId', p, 200)
  if (!ID.test(problemId)) throw new RequestError('context.problemId has unexpected characters')
  const attemptId = str(o, 'attemptId', p, 200, false)
  if (attemptId !== undefined && !ID.test(attemptId)) throw new RequestError('context.attemptId has unexpected characters')
  const moduleId = reqStr(o, 'moduleId', p, 60)
  if (!WORD.test(moduleId)) throw new RequestError('context.moduleId has unexpected characters')
  const kind = reqStr(o, 'kind', p, 60)
  if (!WORD.test(kind)) throw new RequestError('context.kind has unexpected characters')
  const subject = reqStr(o, 'subject', p, 20)
  if (!SUBJECTS.has(subject)) throw new RequestError(`context.subject must be one of ${TUTOR_SUBJECTS.join(', ')}`)
  const answer = str(o, 'answer', p, TUTOR_LIMITS.field, false)
  const vd = verdict(o.verdict)
  return {
    problemId,
    ...(attemptId ? { attemptId } : {}),
    moduleId,
    subject: subject as TutorContext['subject'],
    kind,
    title: reqStr(o, 'title', p, 200),
    instructions: str(o, 'instructions', p, TUTOR_LIMITS.field, false) ?? '',
    statement: reqStr(o, 'statement', p, TUTOR_LIMITS.field),
    work: lines(o, 'work', p),
    ...(vd ? { verdict: vd } : {}),
    canonical: lines(o, 'canonical', p),
    ...(answer ? { answer } : {}),
    finished: bool(o, 'finished', p),
    revealed: bool(o, 'revealed', p),
  }
}

function parseFreeform(o: Obj): TutorFreeformContext {
  const p = 'context.'
  const conversationId = reqStr(o, 'conversationId', p, 200)
  if (!ID.test(conversationId)) throw new RequestError('context.conversationId has unexpected characters')
  const className = reqStr(o, 'className', p, TUTOR_LIMITS.className).trim()
  if (!className) throw new RequestError('context.className is empty')
  if (/[\u0000-\u001f]/.test(className)) throw new RequestError('context.className has unexpected characters')
  const problem = reqStr(o, 'problem', p, TUTOR_LIMITS.freeProblem).trim()
  if (!problem) throw new RequestError('context.problem is empty')
  const tried = str(o, 'tried', p, TUTOR_LIMITS.tried, false)?.trim()
  return {
    mode: 'freeform',
    conversationId,
    className,
    problem,
    ...(tried ? { tried } : {}),
    fullSolution: bool(o, 'fullSolution', p),
  }
}

export function parseAskRequest(body: unknown): TutorAskRequest {
  const o = obj(body, 'body')
  const raw = o.question
  if (typeof raw !== 'string') throw new RequestError('question must be a string')
  const question = raw.trim()
  if (!question) throw new RequestError('question is empty')
  if (question.length > TUTOR_LIMITS.question) {
    throw new RequestError(`question is longer than ${TUTOR_LIMITS.question} characters`, 'question_too_long')
  }
  const ctx = obj(o.context, 'context')
  // Absent `mode` is a problem-page context, so a request from before this field still parses.
  if (ctx.mode !== undefined) {
    if (ctx.mode !== 'freeform') throw new RequestError('context.mode must be freeform')
    return { question, context: parseFreeform(ctx) }
  }
  return { question, context: parseContext(o.context) }
}

export function parseFlagRequest(body: unknown): TutorFlagRequest {
  const o = obj(body, 'body')
  const id = reqStr(o, 'id', '', 100)
  const reason = reqStr(o, 'reason', '', 20)
  if (reason !== 'wrong' && reason !== 'inappropriate') throw new RequestError('reason must be wrong or inappropriate')
  const note = str(o, 'note', '', TUTOR_LIMITS.flagNote, false)?.trim()
  return { id, reason, ...(note ? { note } : {}) }
}

/** The first bytes every file of the type starts with: a renamed or cut-off upload is refused here. */
function looksLike(mime: TutorImageType, bytes: Buffer): boolean {
  if (mime === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  return bytes.length > 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP'
}

/**
 * A photo of her notes. The type is one of three, the data is strict base64 of a real image of
 * that type, and the image is at most TUTOR_LIMITS.imageBytes once decoded.
 */
export function parseCardsRequest(body: unknown): TutorCardsRequest {
  const image = obj(obj(body, 'body').image, 'image')
  const mime = image.mime
  if (typeof mime !== 'string' || !(TUTOR_IMAGE_TYPES as readonly string[]).includes(mime)) {
    throw new RequestError(`image.mime must be one of ${TUTOR_IMAGE_TYPES.join(', ')}`)
  }
  const data = image.data
  if (typeof data !== 'string' || data.length === 0) throw new RequestError('image.data is required')
  if (data.length > Math.ceil(TUTOR_LIMITS.imageBytes / 3) * 4) {
    throw new RequestError(`the image is larger than ${TUTOR_LIMITS.imageBytes} bytes`, 'too_large', 413)
  }
  if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new RequestError('image.data must be base64')
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length > TUTOR_LIMITS.imageBytes) throw new RequestError(`the image is larger than ${TUTOR_LIMITS.imageBytes} bytes`, 'too_large', 413)
  if (!looksLike(mime as TutorImageType, bytes)) throw new RequestError('image.data is not an image of the type image.mime names')
  return { image: { mime: mime as TutorImageType, data } }
}

/**
 * Removes the two kinds of personal detail a student might type into a question without thinking:
 * email addresses and formatted phone numbers. Math never looks like either.
 */
export function redactPersonal(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email removed]')
    .replace(/(?<![\w.])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w.])/g, '[phone removed]')
}
