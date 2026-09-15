import type { StepResult } from '@/shared/types'
import { rejectionView, type ExampleSegment } from '@/problem/stepEngine'
import { Katex } from './Katex'

function Segment({ seg }: { seg: ExampleSegment }) {
  if (seg.latex) return <Katex tex={seg.latex} />
  return <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm text-navy ring-1 ring-navy-100">{seg.text}</code>
}

/**
 * Rejection feedback: pattern title + lesson (plain text), the wrong → right example (each part as
 * math only when it parses), and the counterexample with both sides' values. ✗ + words, never
 * color alone.
 */
export function RejectionCard({ result }: { result: StepResult }) {
  const v = rejectionView(result)
  return (
    <div role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-navy">
      <p className="font-semibold">
        <span aria-hidden>✗ </span>
        Not accepted: {v.title}
      </p>
      {v.lesson && <p className="mt-1 text-sm">{v.lesson}</p>}
      {v.witness && <p className="mt-1 text-sm font-medium">{v.witness}</p>}
      {v.example.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-navy/70">Example:</span>
          {v.example.map((seg, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>→</span>}
              <Segment seg={seg} />
            </span>
          ))}
        </p>
      )}
      {v.counterexample && <p className="mt-2 text-sm">{v.counterexample}</p>}
      {v.sideValues.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-navy/80">
          {v.sideValues.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Accepted-with-caveat banner for squaring / multiplying by a variable expression. */
export function CaveatBanner({ restriction }: { restriction?: string }) {
  return (
    <div className="rounded-xl border border-gold bg-gold-100 px-3 py-2 text-sm text-navy" role="status">
      <span aria-hidden>⚠ </span>
      <span className="font-semibold">Legal, but check for extra answers. </span>
      That move can add solutions that the original never had — plug every answer back into the original at the end.
      {restriction && (
        <>
          {' '}
          Keep the restriction <code className="rounded bg-white px-1 font-mono">{restriction}</code>.
        </>
      )}
    </div>
  )
}
