import type { StepResult } from '@/shared/types'
import { rejectionView, type ExampleSegment } from '@/problem/stepEngine'
import { CaughtBanner, MistakeAvatar } from './monsters/MonsterTag'
import { Katex } from './Katex'
import { StuckChip } from './Stuck'

function Segment({ seg }: { seg: ExampleSegment }) {
  if (seg.latex) return <Katex tex={seg.latex} />
  return <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm text-navy ring-1 ring-navy-100">{seg.text}</code>
}

/**
 * The lesson under a rejection's title: the catalog lesson, the sentence about her own line, the wrong → right
 * example (each part as math only when it parses), and the counterexample with both sides' values. The card in
 * the work list and the phone composer's "Why?" sheet both show it.
 */
export function RejectionDetails({ result }: { result: StepResult }) {
  const v = rejectionView(result)
  return (
    <>
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
    </>
  )
}

/**
 * Rejection feedback: pattern title + lesson (plain text), the wrong → right example (each part as
 * math only when it parses), and the counterexample with both sides' values. ✗ + words, never
 * color alone. On a phone, in a column without the composer (even/odd), the Stuck? chip sits under it;
 * where the composer is open the composer carries the chip and the card stays as it is. A named mistake shows its
 * monster (components/monsters): caught the first time, its small avatar after that.
 */
export function RejectionCard({ result }: { result: StepResult }) {
  const v = rejectionView(result)
  const pattern = result.pattern?.id
  return (
    <>
      <div role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-navy">
        <CaughtBanner pattern={pattern} />
        <p className="font-semibold">
          <MistakeAvatar pattern={pattern} className="mr-1.5" />
          <span aria-hidden>✗ </span>
          Not accepted: {v.title}
        </p>
        <RejectionDetails result={result} />
      </div>
      <StuckChip />
    </>
  )
}

/** Accepted-with-caveat banner for squaring / multiplying by a variable expression. */
export function CaveatBanner({ restriction }: { restriction?: string }) {
  return (
    <div className="rounded-xl border border-gold bg-gold-100 px-3 py-2 text-sm text-navy" role="status">
      <span aria-hidden>⚠ </span>
      <span className="font-semibold">Legal, but check for extra answers. </span>
      <CaveatText restriction={restriction} />
    </div>
  )
}

/** The caveat's explanation (the banner's body; also the phone composer's "Why?" sheet for a kept line). */
export function CaveatText({ restriction }: { restriction?: string }) {
  return (
    <>
      That move can add solutions that the original never had — plug every answer back into the original at the end.
      {restriction && (
        <>
          {' '}
          Keep the restriction <code className="rounded bg-white px-1 font-mono">{restriction}</code>.
        </>
      )}
    </>
  )
}
