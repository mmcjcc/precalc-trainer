import type { AtomBox, AtomGrade } from '@/shared/types'
import { PatternLesson } from './SigFigFeedback'

/**
 * Wrong-answer card for the atomic-structure boxes, in the existing rejection styling (✗ + words,
 * never color alone): each named mistake with its lesson, her own numbers and the wrong → right
 * example; then any box that went wrong without a named mistake, with its plain sentence.
 */
export function AtomRejection({ grade, labels }: { grade: AtomGrade; labels: Partial<Record<AtomBox, string>> }) {
  const plain: { box: AtomBox; message: string }[] = []
  for (const b of grade.boxes) {
    if (b.status !== 'wrong' || b.pattern) continue
    if (plain.some((p) => p.message === b.message)) continue
    plain.push({ box: b.box, message: b.message })
  }
  const single = grade.patterns.length === 1 && plain.length === 0 ? grade.patterns[0]! : null
  const heading = single ? `Not quite: ${single.title}` : grade.patterns.length + plain.length > 1 ? 'Not quite: a few things to look at' : 'Not quite'
  const sameForAll = plain.length === 1 && grade.boxes.filter((b) => b.status === 'wrong' && !b.pattern).length > 1
  return (
    <div role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-navy">
      <p className="font-semibold">
        <span aria-hidden>✗ </span>
        {heading}
      </p>
      {grade.patterns.length > 0 && (
        <div className="mt-2 space-y-3">
          {grade.patterns.map((hit) => (
            <PatternLesson key={hit.id} hit={hit} witness={hit.witness} heading={single ? 'p' : 'h3'} />
          ))}
        </div>
      )}
      {plain.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {plain.map((p) => (
            <li key={p.box}>
              {!sameForAll && <span className="font-semibold">{labels[p.box] ?? p.box}: </span>}
              {p.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** ✓ / ✗ beside a box after a check (words for screen readers, never color alone). */
export function BoxMark({ status }: { status: 'correct' | 'wrong' | null }) {
  if (status === null) return null
  return status === 'correct' ? (
    <span className="text-sm font-semibold text-ok">
      <span aria-hidden>✓</span>
      <span className="sr-only">right</span>
    </span>
  ) : (
    <span className="text-sm font-semibold text-bad">
      <span aria-hidden>✗</span>
      <span className="sr-only">look again</span>
    </span>
  )
}
