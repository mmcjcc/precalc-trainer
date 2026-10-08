import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { insertToken, type StripKey } from '@/components/symbolStrip'
import { COURSES, unitsWithModules } from '@/content'
import { TUTOR_LIMITS, type TutorAskRequest, type TutorFreeformContext } from '@/shared/tutor'
import { safeRead, safeWrite } from '@/store/storage'
import { TutorChatPanel } from '@/tutor/TutorChat'
import { useTutorStatus } from '@/tutor/useTutorStatus'

const OTHER = 'Other math or science'
const FULL_SOLUTION_QUESTION = 'Show me the full solution'
const SESSION_KEY = 'pct.tutor.ask-session'

interface AskClass {
  id: string
  label: string
}

interface Session {
  id: string
  classId: string
  courseLabel: string
  problem: string
  tried: string
}

function askClasses(): AskClass[] {
  const visible = COURSES.filter((course) => unitsWithModules(course).length > 0)
  return [...visible.map((course) => ({ id: course.id, label: course.title })), { id: 'other', label: OTHER }]
}

function newConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

function loadSession(): Session | null {
  const saved = safeRead<Session>(SESSION_KEY)
  if (!saved || typeof saved !== 'object') return null
  if (typeof saved.id !== 'string' || typeof saved.problem !== 'string' || typeof saved.courseLabel !== 'string') return null
  if (!/^[A-Za-z0-9_.:@/#?=&+-]{1,200}$/.test(saved.id)) return null
  return {
    id: saved.id,
    classId: typeof saved.classId === 'string' ? saved.classId : 'other',
    courseLabel: saved.courseLabel,
    problem: saved.problem,
    tried: typeof saved.tried === 'string' ? saved.tried : '',
  }
}

function ProblemBox({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  function insert(key: StripKey) {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? start
    const next = insertToken(value, start, end, key)
    onChange(next.value)
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      node.setSelectionRange(next.caret, next.caret)
    })
  }
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        Problem
      </label>
      <textarea
        id={id}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        maxLength={TUTOR_LIMITS.freeProblem}
        placeholder="Type a problem from your homework"
        className="min-h-24 w-full resize-y rounded-xl border-2 border-navy-100 bg-white px-3 py-2 text-[max(16px,1rem)] text-navy outline-none focus:border-navy"
      />
      <SymbolStrip onInsert={insert} />
      <p className={`text-sm ${value.length >= TUTOR_LIMITS.freeProblem ? 'font-semibold text-bad' : 'text-navy/70'}`}>
        {value.length}/{TUTOR_LIMITS.freeProblem}
      </p>
    </div>
  )
}

/** `hasStatus` is false when the status request failed (offline). A body with configured: false is "not set up". */
function offlineSentence(hasStatus: boolean): string {
  return hasStatus ? "The tutor isn't set up yet." : 'The tutor is offline right now.'
}

/** Homework she types herself. The tutor coaches first; the full solution waits for two questions. */
export function AskAnythingPage() {
  const tutor = useTutorStatus()
  const classes = askClasses()
  const classField = useId()
  const triedField = useId()
  const [classId, setClassId] = useState(() => loadSession()?.classId ?? classes[0]?.id ?? 'other')
  const [problem, setProblem] = useState(() => loadSession()?.problem ?? '')
  const [tried, setTried] = useState(() => loadSession()?.tried ?? '')
  const [session, setSession] = useState<Session | null>(() => loadSession())

  if (!tutor.ready) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-navy">Ask about any problem</h1>
        <p role="status" className="mt-3 text-navy/70">
          Loading…
        </p>
      </div>
    )
  }

  const status = tutor.status
  if (!status?.configured) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold text-navy">Ask about any problem</h1>
        <p className="text-navy">{offlineSentence(status !== null)}</p>
        <Link to="/" className="inline-flex min-h-11 items-center font-semibold text-navy underline">
          Practice modules
        </Link>
      </div>
    )
  }

  const courseLabel = classes.find((c) => c.id === classId)?.label ?? OTHER
  const problemText = problem.trim()
  const triedText = tried.trim()
  const unchanged =
    session !== null &&
    session.problem === problemText &&
    session.tried === triedText &&
    session.courseLabel === courseLabel
  const canStart =
    problemText.length > 0 &&
    problemText.length <= TUTOR_LIMITS.freeProblem &&
    triedText.length <= TUTOR_LIMITS.tried &&
    !unchanged

  function start() {
    if (!canStart) return
    const next: Session =
      session && session.problem === problemText
        ? { ...session, classId, courseLabel, tried: triedText }
        : { id: newConversationId(), classId, courseLabel, problem: problemText, tried: triedText }
    setSession(next)
    safeWrite(SESSION_KEY, next)
  }

  function makeBody(question: string, fullSolution: boolean): TutorAskRequest {
    const context: TutorFreeformContext = {
      mode: 'freeform',
      conversationId: session?.id ?? '',
      className: session?.courseLabel ?? courseLabel,
      problem: session?.problem ?? problemText,
      ...(session?.tried ? { tried: session.tried } : {}),
      fullSolution,
    }
    return { question, context }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-navy">Ask about any problem</h1>
        <p className="text-navy/80">
          Type a problem from your homework. The tutor coaches one step at a time, and you try each step yourself.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-navy-100 bg-white p-4">
        <div className="space-y-1">
          <label htmlFor={classField} className="block text-sm font-semibold text-navy">
            Class
          </label>
          <select
            id={classField}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="min-h-11 w-full rounded-xl border-2 border-navy-100 bg-white px-3 text-[max(16px,1rem)] text-navy outline-none focus:border-navy"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <ProblemBox value={problem} onChange={setProblem} />
        <div className="space-y-1">
          <label htmlFor={triedField} className="block text-sm font-semibold text-navy">
            What I've tried (optional)
          </label>
          <textarea
            id={triedField}
            value={tried}
            onChange={(e) => setTried(e.target.value)}
            rows={3}
            maxLength={TUTOR_LIMITS.tried}
            placeholder="A line or two of what you already did"
            className="min-h-12 w-full resize-y rounded-xl border-2 border-navy-100 bg-white px-3 py-2 text-[max(16px,1rem)] text-navy outline-none focus:border-navy"
          />
        </div>
        <button
          type="button"
          onClick={start}
          disabled={!canStart}
          className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50"
        >
          Start
        </button>
        {session && !unchanged && (
          <p className="text-sm text-navy/80">Press Start to ask about this problem instead.</p>
        )}
      </div>

      {session && (
        <section className="space-y-3" aria-label="Conversation">
          <p className="text-sm text-navy/80">
            Asking about this problem
            {session.problem !== problemText ? ' (press Start after you edit it)' : ''}.
          </p>
          <TutorChatPanel
            key={session.id}
            threadId={session.id}
            status={status}
            makeBody={(question) => makeBody(question, false)}
            placeholder="Ask about this problem"
            belowThread={({ turns, streaming, sendQuestion }) =>
              turns.length >= 2 ? (
                <button
                  type="button"
                  disabled={streaming}
                  onClick={() => sendQuestion(FULL_SOLUTION_QUESTION, makeBody(FULL_SOLUTION_QUESTION, true))}
                  className="min-h-11 rounded-xl border border-navy bg-white px-4 font-semibold text-navy hover:bg-navy-50 disabled:opacity-50"
                >
                  Show me the full solution
                </button>
              ) : null
            }
          />
        </section>
      )}
    </div>
  )
}

export default AskAnythingPage
