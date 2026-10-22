import type { MouseEvent, PointerEvent, ReactNode } from 'react'
import type { PatternHit, StepResult } from '@/shared/types'
import { rejectionView } from '@/problem/stepEngine'
import { CaughtBanner, MistakeAvatar } from './monsters/MonsterTag'
import { CaveatText, RejectionDetails } from './RejectionCard'
import { PatternLesson } from './SigFigFeedback'
import { StuckButton } from './Stuck'

/**
 * The verdict about her latest line, as the phone composer shows it: one line just above her input, where she is
 * looking, while the full card stays in the work list (behind the composer and the keypad on a phone).
 *  - ok:   "✓ Kept" (and a short note when the line was kept with a caveat)
 *  - bad:  the named mistake's title plus one sentence
 *  - info: a check that did not count (unreadable, the same line again)
 * `why` is what the "Why?" button opens in a bottom sheet: the full lesson. `pattern` is the named mistake's catalog id:
 * its monster stands beside the title (caught, the first time).
 */
export type LineVerdict =
  | { tone: 'ok'; text: string; why?: VerdictWhy }
  | { tone: 'bad'; title: string; sentence?: string; why: VerdictWhy; pattern?: string }
  | { tone: 'info'; text: string }

export interface VerdictWhy {
  title: string
  body: ReactNode
}

/** The first sentence of a text: up to a . ! or ? that ends the text or is followed by a space and a new sentence. */
export function firstSentence(text: string | undefined): string | undefined {
  const t = text?.trim()
  if (!t) return undefined
  const m = /^(.+?[.!?])(?=\s+[^\s a-z]|$)/u.exec(t)
  return m ? m[1] : t
}

export const KEPT: LineVerdict = { tone: 'ok', text: 'Kept' }

/**
 * A step engine's rejection as a composer verdict: the pattern's title with the first sentence of its lesson (the
 * rule), or, when no pattern was named, the counterexample's first sentence. "Why?" opens the work-list card's
 * whole lesson.
 */
export function stepVerdict(result: StepResult): LineVerdict {
  const v = rejectionView(result)
  const sentence = firstSentence(v.lesson) ?? firstSentence(v.witness) ?? firstSentence(v.counterexample)
  return {
    tone: 'bad',
    title: v.title,
    sentence: sentence && sentence !== v.title ? sentence : undefined,
    why: { title: v.title, body: <div className="text-navy"><RejectionDetails result={result} /></div> },
    ...(result.pattern?.id ? { pattern: result.pattern.id } : {}),
  }
}

/** The step engine's state (useStepEngine) as a composer verdict: its rejection, else a kept line, else nothing. */
export function engineVerdict(engine: { rejection: StepResult | null; kept: boolean; caveat: { restriction?: string } | null }): LineVerdict | null {
  if (engine.rejection) return stepVerdict(engine.rejection)
  if (engine.kept) return engine.caveat ? caveatVerdict(engine.caveat.restriction) : KEPT
  return null
}

/**
 * A grader's named mistake (a catalog hit with her witness) or a plain wrong message, as a composer verdict.
 * "Why?" opens the lesson, her witness and the example, as the work-list card shows them.
 */
export function patternVerdict(hit: PatternHit | null, message: string): LineVerdict {
  const title = hit?.title ?? 'Not quite'
  return {
    tone: 'bad',
    title,
    ...(hit?.id ? { pattern: hit.id } : {}),
    sentence: firstSentence(hit?.lesson) ?? firstSentence(message),
    why: {
      title,
      body: hit ? (
        <div className="text-navy">
          <PatternLesson hit={hit} witness={message} showTitle={false} />
        </div>
      ) : (
        <p className="text-sm text-navy">{message}</p>
      ),
    },
  }
}

/** A line kept with the "check for extra answers" caveat. */
export function caveatVerdict(restriction?: string): LineVerdict {
  return {
    tone: 'ok',
    text: 'Kept. Legal, but check for extra answers.',
    why: {
      title: 'Legal, but check for extra answers',
      body: (
        <p className="text-sm text-navy">
          <CaveatText restriction={restriction} />
        </p>
      ),
    },
  }
}

/** Opening the sheet from the composer leaves focus in her box, so the keypad can come back when it closes. */
const keepFocus = {
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
}

function VerdictText({ verdict }: { verdict: LineVerdict }) {
  if (verdict.tone === 'ok') {
    return (
      <p className="line-clamp-2 text-sm font-semibold text-ok">
        <span aria-hidden>✓ </span>
        {verdict.text}
      </p>
    )
  }
  if (verdict.tone === 'info') {
    return (
      <p className="line-clamp-2 text-sm text-navy/80">
        <span aria-hidden>ⓘ </span>
        {verdict.text}
      </p>
    )
  }
  return (
    <p className="line-clamp-2 text-sm text-navy">
      <MistakeAvatar pattern={verdict.pattern} size={22} className="mr-1" />
      <span aria-hidden className="font-semibold text-bad">
        ✗{' '}
      </span>
      <span className="sr-only">Not kept: </span>
      <span className="font-semibold">{verdict.title}</span>
      {verdict.sentence && <> {verdict.sentence}</>}
    </p>
  )
}

/**
 * The phone composer's status row, right above her input: the latest verdict on the left (with Why?), the
 * Stuck? chip on the right, over the Check button. No live region: the work-list card already announces.
 */
export function ComposerStatus({ verdict, onWhy, onStuck }: { verdict: LineVerdict | null; onWhy: () => void; onStuck: (() => void) | null }) {
  if (!verdict && !onStuck) return null
  const why = verdict && verdict.tone !== 'info' ? verdict.why : undefined
  return (
    <div className="mb-2" data-composer-status="">
      {/* A mistake made for the first time: its monster, caught, right where she is looking. */}
      {verdict?.tone === 'bad' && <CaughtBanner pattern={verdict.pattern} compact />}
      <div className="flex min-h-9 items-center gap-2">
        <div className="min-w-0 flex-1">{verdict && <VerdictText verdict={verdict} />}</div>
        {why && (
          <button
            type="button"
            {...keepFocus}
            onClick={onWhy}
            aria-haspopup="dialog"
            aria-label={`Why? ${why.title}`}
            className="min-h-9 shrink-0 rounded-lg px-2 text-sm font-semibold text-navy underline hover:bg-navy-50"
          >
            Why?
          </button>
        )}
        {onStuck && <StuckButton onClick={onStuck} />}
      </div>
    </div>
  )
}
