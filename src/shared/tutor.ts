/**
 * Tutor contract: what the SPA sends to the tutor sidecar (server/) and what it gets back.
 *
 * TYPES + small constants only. The SPA imports it as '@/shared/tutor'; the server imports it by
 * relative path and esbuild bundles it. Endpoints, SSE framing and how to fill a TutorContext from a
 * ProblemInstance and an Attempt: docs/progress/tutor-core.md.
 */

export type TutorProviderName = 'gemini' | 'anthropic' | 'mock'

// ---------------------------------------------------------------------------
// Limits the server enforces (the UI should enforce the question cap too)
// ---------------------------------------------------------------------------

export const TUTOR_LIMITS = {
  /** Whole request body, bytes. */
  bodyBytes: 32 * 1024,
  /** Her question, characters after trimming. */
  question: 500,
  /** Longest text field of the context (statement, a line, a lesson...). */
  field: 1000,
  /** Most lines in `work` or `canonical`. */
  lines: 40,
  /** Longest single line in `work` or `canonical`. */
  line: 400,
  /** Optional note on a flag. */
  flagNote: 500,
  /** Earlier questions on the same attempt that the server replays to the model. */
  historyTurns: 4,
} as const

// ---------------------------------------------------------------------------
// POST /api/tutor/ask
// ---------------------------------------------------------------------------

/** A named mistake exactly as the app's checker reported it (PatternHit / FunctionGrade / etc.). */
export interface TutorMistake {
  /** ErrorPatternId or engine mistake kind, e.g. "no_sign_flip". Optional. */
  id?: string
  /** "Forgot to flip the inequality" */
  title: string
  /** The rule, in the voice of her study decks. */
  lesson: string
  /** The sentence about HER numbers, e.g. "You divided by −14 and kept ≤." */
  witness?: string
}

/** The checker's latest decision on her work. */
export interface TutorVerdict {
  /**
   * accepted / rejected: a worked line (step flows). correct / wrong: a final answer or answer box.
   * parse_error: the app could not read what she typed.
   */
  status: 'accepted' | 'rejected' | 'correct' | 'wrong' | 'parse_error'
  /** What she typed that this verdict is about (app syntax). */
  line?: string
  /** The sentence the app showed her (counterexample message, grade message...). */
  message?: string
  mistake?: TutorMistake
}

/**
 * Everything the tutor knows about the problem. Only problem data and her work: never her name,
 * email or anything personal (the server never adds any either).
 */
export interface TutorContext {
  /** ProblemInstance.id */
  problemId: string
  /** Attempt.id. The server replays her earlier questions on this attempt (last few) to the model. */
  attemptId?: string
  /** ModuleId, e.g. "inequalities", "sigFigs". */
  moduleId: string
  subject: 'precalculus' | 'chemistry'
  /** ProblemKind, e.g. "inequality", "domainRange". */
  kind: string
  /** ProblemInstance.title, e.g. "Solve the inequality". */
  title: string
  /** ProblemInstance.instructions */
  instructions: string
  /** The question itself: statementText, or the answer spec's prompt for answer-only kinds. */
  statement: string
  /** Her accepted lines / answers so far, oldest first (app syntax, as she typed or normalized). */
  work: string[]
  /** The checker's latest verdict on her work, when there is one. */
  verdict?: TutorVerdict
  /**
   * Canonical path: the canonical step lines, or the reveal sentences for answer-only kinds. For the
   * model's reference only; it is told never to recite them while the problem is open.
   */
  canonical: string[]
  /** Canonical final answer, display text (reference only, same rule). */
  answer?: string
  /** She has finished the problem (completion card shown). */
  finished: boolean
  /** The app's reveal showed her the answer or the next step (rung 3, "show the answer"). */
  revealed: boolean
}

export interface TutorAskRequest {
  /** Her question in her own words. 1..TUTOR_LIMITS.question characters after trimming. */
  question: string
  context: TutorContext
}

/** Every SSE `data:` line is one of these (the `event:` name equals `type`). */
export type TutorStreamEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'done'
      /** Log id of this answer: pass it to POST /api/tutor/flag. */
      id: string
      /** Questions she has left today. */
      remaining: number
      limit: number
      /** The answer hit the length cap and may end mid-sentence. */
      truncated?: boolean
    }
  | {
      type: 'error'
      code: TutorErrorCode
      /** Friendly sentence to show her as-is. Discard any partial text already streamed. */
      message: string
      remaining?: number
    }

export type TutorErrorCode =
  /** The provider failed or is unreachable. Not counted against the daily limit. */
  | 'unavailable'
  /** The provider took too long. Not counted. */
  | 'timeout'
  /** No questions left today. */
  | 'limit'
  /** Another question from her is still being answered. */
  | 'busy'
  /** The provider's safety filter stopped the answer (counted). */
  | 'blocked'
  /** The server has no API key for the configured provider. */
  | 'not_configured'

/** Non-SSE failures (HTTP 4xx/5xx with a JSON body). nginx answers 503 {"error":"tutor offline"} when the sidecar is down. */
export interface TutorErrorBody {
  error: string
  /** e.g. "bad_request", "forbidden", "too_large", "not_found", "not_parent". */
  code?: string
}

// ---------------------------------------------------------------------------
// GET /api/tutor/status
// ---------------------------------------------------------------------------

export interface TutorStatus {
  /** The configured provider has its API key (mock is always configured). */
  configured: boolean
  provider: TutorProviderName
  /** Model id the provider uses ("mock" for the mock). */
  model: string
  /** Questions per person per day. */
  limit: number
  /** Questions this person has left today. */
  remaining: number
  /** This account may read GET /api/tutor/log. */
  isParent: boolean
  /** 'file': questions are kept in TUTOR_LOG_DIR (survives restarts). 'memory': lost on restart. */
  logging: 'file' | 'memory'
}

// ---------------------------------------------------------------------------
// GET /api/tutor/log (parent only) and POST /api/tutor/flag
// ---------------------------------------------------------------------------

export type TutorFlagReason = 'wrong' | 'inappropriate'

export interface TutorFlag {
  at: string
  /** Account that flagged it (email). */
  by: string
  reason: TutorFlagReason
  note?: string
}

export type TutorAnswerStatus = 'ok' | 'blocked' | 'error' | 'timeout' | 'aborted'

export interface TutorLogItem {
  /** Log id (the `done` event's id). */
  id: string
  /** ISO timestamp. */
  at: string
  /** Account that asked (email). Kept in the family's log only; never sent to the provider. */
  user: string
  problemId: string
  moduleId: string
  question: string
  /** The answer as streamed ('' when it failed before any text). */
  answer: string
  status: TutorAnswerStatus
  /** Counted against the daily limit. */
  counted: boolean
  finished: boolean
  revealed: boolean
  provider: TutorProviderName
  model: string
  /** Checker verdict status and mistake id at the time of the question. */
  verdict?: string
  mistake?: string
  flags: TutorFlag[]
}

export interface TutorLogResponse {
  /** Newest first. */
  items: TutorLogItem[]
  logging: 'file' | 'memory'
}

export interface TutorFlagRequest {
  /** TutorLogItem.id / the done event's id. */
  id: string
  reason: TutorFlagReason
  /** Optional, up to TUTOR_LIMITS.flagNote characters. */
  note?: string
}

export interface TutorFlagResponse {
  ok: true
}
