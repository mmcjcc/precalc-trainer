import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ProblemInstance } from '@/content/types'
import { buildTutorContext } from '@/problem/tutorContext'
import type { Attempt } from '@/store'
import { TUTOR_LIMITS, type TutorStatus, type TutorStreamEvent, type TutorVerdict } from '@/shared/tutor'
import { askTutor, flagTutorAnswer } from './api'
import { loadThread, saveThread, type StoredTurn } from './threadStorage'

const NOTE =
  "This is an AI tutor. It helps you think it through, but it can make mistakes, so check with your teacher when unsure. Don't type personal information."

export function questionsLeftText(n: number): string {
  return `${n} ${n === 1 ? 'question' : 'questions'} left today`
}

type Props = {
  instance: ProblemInstance
  attempt: Attempt | null
  verdict?: TutorVerdict | null
  finished: boolean
  status: TutorStatus
}

export function TutorAskPanel({ instance, attempt, verdict, finished, status }: Props) {
  const fieldId = useId()
  const attemptId = attempt?.id
  const [bucket, setBucket] = useState<{ id: string; turns: StoredTurn[] } | null>(null)
  const [pending, setPending] = useState<{ question: string; text: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [remaining, setRemaining] = useState(status.remaining)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [flagError, setFlagError] = useState<string | null>(null)
  const [flagging, setFlagging] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const hydrated = useRef<string | null>(null)
  const turns = bucket && bucket.id === attemptId ? bucket.turns : []

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!attemptId) return
    setBucket({ id: attemptId, turns: loadThread(attemptId).turns })
    setPending(null)
  }, [attemptId])

  useEffect(() => {
    if (!bucket || bucket.id !== attemptId) return
    // The load above sets the bucket. Don't write an empty thread over nothing.
    if (hydrated.current !== bucket.id) {
      hydrated.current = bucket.id
      if (bucket.turns.length === 0 && !finished) return
    }
    saveThread(bucket.id, { turns: bucket.turns, finished })
  }, [bucket, attemptId, finished])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [turns, pending])

  const trimmed = draft.trim()
  const over = draft.length > TUTOR_LIMITS.question
  const streaming = pending !== null
  const canSend = Boolean(attemptId) && trimmed.length > 0 && !over && !streaming && remaining > 0

  async function send() {
    if (!canSend || !attemptId) return
    const question = trimmed
    const context = buildTutorContext(instance, attempt, verdict, finished)
    setDraft('')
    setFlagError(null)
    setPending({ question, text: '' })
    const ac = new AbortController()
    abortRef.current = ac
    let answer = ''
    let settled = false
    const apply = (event: TutorStreamEvent) => {
      if (!mounted.current || ac.signal.aborted) return
      if (event.type === 'delta') {
        answer += event.text
        setPending({ question, text: answer })
        return
      }
      if (typeof event.remaining === 'number') setRemaining(event.remaining)
      settled = true
      if (event.type === 'error') {
        const turn: StoredTurn = { question, answer: event.message, error: true }
        setBucket((prev) => ({ id: attemptId, turns: [...(prev?.id === attemptId ? prev.turns : []), turn] }))
        setPending(null)
        return
      }
      const turn: StoredTurn = { question, answer, id: event.id, truncated: event.truncated }
      setBucket((prev) => ({ id: attemptId, turns: [...(prev?.id === attemptId ? prev.turns : []), turn] }))
      setPending(null)
    }
    await askTutor({ question, context }, apply, ac.signal)
    if (!mounted.current || ac.signal.aborted) return
    if (!settled) {
      const turn: StoredTurn = {
        question,
        answer: 'The tutor stopped before it finished. Try asking again.',
        error: true,
      }
      setBucket((prev) => ({ id: attemptId, turns: [...(prev?.id === attemptId ? prev.turns : []), turn] }))
      setPending(null)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  async function flag(turn: StoredTurn) {
    if (!turn.id || turn.flagged || flagging) return
    const note = (notes[turn.id] ?? '').trim()
    setFlagging(turn.id)
    setFlagError(null)
    const result = await flagTutorAnswer({
      id: turn.id,
      reason: 'wrong',
      ...(note ? { note: note.slice(0, TUTOR_LIMITS.flagNote) } : {}),
    })
    if (!mounted.current) return
    setFlagging(null)
    if (!result.ok) {
      setFlagError(result.message)
      return
    }
    setBucket((prev) => {
      if (!prev || prev.id !== attemptId) return prev
      return { id: prev.id, turns: prev.turns.map((item) => (item.id === turn.id ? { ...item, flagged: true } : item)) }
    })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/80">{NOTE}</p>
      <div className="max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
        {turns.map((turn, index) => (
          <div key={`${turn.id ?? 'turn'}-${index}`} className="space-y-1">
            <p className="rounded-xl bg-gold-100 px-3 py-2 text-sm text-navy">
              <span className="font-semibold">You: </span>
              {turn.question}
            </p>
            <p className="whitespace-pre-wrap rounded-xl border border-navy-100 bg-white px-3 py-2 text-sm text-navy">
              {turn.answer}
              {turn.truncated ? <span className="mt-1 block text-navy/70">The answer was cut off there.</span> : null}
            </p>
            {turn.id && !turn.error && (
              turn.flagged ? (
                <p role="status" className="text-sm text-navy/80">
                  Thanks, flagged for a parent to review.
                </p>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-navy/70" htmlFor={`${fieldId}-note-${index}`}>
                    Optional note
                    <input
                      id={`${fieldId}-note-${index}`}
                      value={notes[turn.id] ?? ''}
                      maxLength={TUTOR_LIMITS.flagNote}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [turn.id!]: e.target.value }))}
                      className="mt-1 min-h-11 w-full rounded-lg border border-navy-100 bg-white px-3 text-sm font-normal text-navy outline-none focus:border-navy"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void flag(turn)}
                    disabled={flagging === turn.id}
                    className="min-h-11 rounded-lg border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50 disabled:opacity-50"
                  >
                    Flag this answer
                  </button>
                </div>
              )
            )}
          </div>
        ))}
        {pending && (
          <div className="space-y-1">
            <p className="rounded-xl bg-gold-100 px-3 py-2 text-sm text-navy">
              <span className="font-semibold">You: </span>
              {pending.question}
            </p>
            <p className="whitespace-pre-wrap rounded-xl border border-navy-100 bg-white px-3 py-2 text-sm text-navy" aria-busy="true">
              {pending.text || '…'}
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {flagError && (
        <p role="status" className="text-sm text-navy">
          {flagError}
        </p>
      )}
      <p className="text-sm font-semibold text-navy">{questionsLeftText(remaining)}</p>
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor={fieldId} className="block text-sm font-semibold text-navy">
          Your question
        </label>
        <textarea
          id={fieldId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          maxLength={TUTOR_LIMITS.question}
          placeholder="Ask about this problem"
          className="min-h-12 w-full resize-y rounded-xl border-2 border-navy-100 bg-white px-3 py-2 text-[max(16px,1rem)] text-navy outline-none focus:border-navy"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-sm ${over ? 'font-semibold text-bad' : 'text-navy/70'}`}>
            {draft.length}/{TUTOR_LIMITS.question}
          </span>
          <button
            type="submit"
            disabled={!canSend}
            className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
