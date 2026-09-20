import type { PatternHit } from '@/shared/types'

/** Split a catalog example ("0.00450 → 6 figures ✗ → 3 figures") into arrow-joined plain segments. */
function ExampleLine({ example }: { example: string }) {
  const parts = example
    .split('→')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-navy/70">Example:</span>
      {parts.map((seg, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>→</span>}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm text-navy ring-1 ring-navy-100">{seg}</code>
        </span>
      ))}
    </p>
  )
}

/** One named mistake: title, lesson, the witness about her numbers, and the wrong → right example. */
export function PatternLesson({ hit, witness, heading = 'p' }: { hit: PatternHit; witness?: string; heading?: 'p' | 'h3' }) {
  const Title = heading
  return (
    <div>
      <Title className="font-semibold">{hit.title}</Title>
      {hit.lesson && <p className="mt-1 text-sm">{hit.lesson}</p>}
      {witness && <p className="mt-1 text-sm font-medium">{witness}</p>}
      {hit.example && <ExampleLine example={hit.example} />}
    </div>
  )
}

/**
 * Wrong-answer card in the existing rejection styling (✗ + words, never color alone): the named
 * mistake(s) with lesson, example and witness, or the grader's plain message when nothing matched.
 */
export function SigFigRejection({ message, patterns }: { message: string; patterns: PatternHit[] }) {
  const single = patterns.length === 1 ? patterns[0]! : null
  return (
    <div role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-navy">
      <p className="font-semibold">
        <span aria-hidden>✗ </span>
        {single ? `Not quite: ${single.title}` : patterns.length > 1 ? `Not quite: ${patterns.length} things to look at` : 'Not quite'}
      </p>
      {single ? (
        <>
          {single.lesson && <p className="mt-1 text-sm">{single.lesson}</p>}
          <p className="mt-1 text-sm font-medium">{message}</p>
          {single.example && <ExampleLine example={single.example} />}
        </>
      ) : patterns.length > 1 ? (
        <div className="mt-2 space-y-3">
          {patterns.map((hit) => (
            <PatternLesson key={hit.id} hit={hit} witness={hit.witness} heading="h3" />
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm">{message}</p>
      )}
    </div>
  )
}

/** Right-answer card: the grader's sentence plus any gentle note. */
export function SigFigCorrect({ message, note }: { message: string; note?: string }) {
  return (
    <div role="status" className="rounded-2xl border border-ok bg-ok-100 p-3 text-navy">
      <p className="font-semibold">
        <span aria-hidden>✓ </span>
        {message}
      </p>
      {note && <p className="mt-1 text-sm">{note}</p>}
    </div>
  )
}

/** The engine's worked explanation, one sentence per line. */
export function SigFigExplanation({ steps, title = 'How it works out' }: { steps: readonly string[]; title?: string }) {
  if (steps.length === 0) return null
  return (
    <section className="rounded-2xl border border-navy-100 bg-navy-50 p-3 text-navy" aria-label={title}>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">{title}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  )
}
