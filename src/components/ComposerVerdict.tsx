import type { MouseEvent, PointerEvent, ReactNode } from 'react'
import type { PatternHit, StepResult } from '@/shared/types'
import { rejectionView } from '@/problem/stepEngine'
import { COMBO_SHOWS_AT } from '@/session/combo'
import { useComposerFold } from './Composer'
import { Flame } from './juice/Flame'
import { CaughtBadge, CaughtBanner, MistakeAvatar } from './monsters/MonsterTag'
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

function VerdictText({ verdict, oneLine = false }: { verdict: LineVerdict; oneLine?: boolean }) {
  // One line (folded, with the keypad up): the same words, cut at the edge; the full text stays for screen readers.
  const lines = oneLine ? 'truncate' : 'line-clamp-2'
  if (verdict.tone === 'ok') {
    return (
      <p className={`${lines} text-sm font-semibold text-ok`}>
        <span aria-hidden>✓ </span>
        {verdict.text}
      </p>
    )
  }
  if (verdict.tone === 'info') {
    return (
      <p className={`${lines} text-sm text-navy/80`}>
        <span aria-hidden>ⓘ </span>
        {verdict.text}
      </p>
    )
  }
  return (
    <p className={`${lines} text-sm text-navy`}>
      {oneLine && <CaughtBadge pattern={verdict.pattern} />}
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

/** The folded line's switch: ⌄ shows the extras (the tools, the nudge, the whole verdict), ⌃ folds them again. */
function FoldToggle({ folded, onToggle }: { folded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      {...keepFocus}
      onClick={onToggle}
      aria-expanded={!folded}
      aria-label={folded ? 'More: tools, hints and notes' : 'Less'}
      data-fold-toggle=""
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-navy hover:bg-navy-50"
    >
      <svg aria-hidden focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={folded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
      </svg>
    </button>
  )
}

/** The combo in the folded line: its flame and the count (the pill comes back when the line unfolds). */
function ComboMini({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-gold bg-gold-100 px-1.5 text-sm font-semibold text-navy" data-combo-mini={count}>
      <Flame px={14} />
      {count}
      <span className="sr-only"> in a row</span>
    </span>
  )
}

/**
 * The phone composer's status row, right above her input: the latest verdict on the left (with Why?), the
 * Stuck? chip on the right, over the Check button. No live region: the work-list card already announces.
 * With the keypad up the composer folds its extras (components/Composer.tsx): this row is then the one line they fold
 * to, the verdict cut to one line (or the idle nudge when there is no verdict), the combo as its flame and count, Why?,
 * Stuck? and ⌄; a tap on the line or on ⌄ unfolds it.
 */
export function ComposerStatus({
  verdict,
  onWhy,
  onStuck,
  nudge,
  combo = 0,
}: {
  verdict: LineVerdict | null
  onWhy: () => void
  onStuck: (() => void) | null
  /** The idle nudge, shown in the folded line when there is no verdict (its banner is folded away). */
  nudge?: string | null
  /** The combo, shown in the folded line from 3 (its pill is folded away). */
  combo?: number
}) {
  const fold = useComposerFold()
  if (!verdict && !onStuck && !fold.foldable) return null
  const why = verdict && verdict.tone !== 'info' ? verdict.why : undefined
  const whyButton = why && (
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
  )
  if (fold.folded) {
    return (
      <div className="mb-1.5" data-composer-status="" data-folded="">
        <div className="flex h-9 items-center gap-1.5">
          {combo >= COMBO_SHOWS_AT && <ComboMini count={combo} />}
          {/* A tap on the words unfolds the extras, as on the phone header's instructions; focus stays in her box. */}
          <div {...keepFocus} onClick={fold.toggle} className="min-w-0 flex-1 cursor-pointer" data-fold-line="">
            {verdict ? (
              <VerdictText verdict={verdict} oneLine />
            ) : nudge ? (
              <p className="truncate text-sm text-navy/80">{nudge}</p>
            ) : null}
          </div>
          {whyButton}
          {onStuck && <StuckButton onClick={onStuck} />}
          <FoldToggle folded onToggle={fold.toggle} />
        </div>
      </div>
    )
  }
  return (
    <div className="mb-2" data-composer-status="">
      {/* A mistake made for the first time: its monster, caught, right where she is looking. */}
      {verdict?.tone === 'bad' && <CaughtBanner pattern={verdict.pattern} compact />}
      <div className="flex min-h-9 items-center gap-2">
        <div className="min-w-0 flex-1">{verdict && <VerdictText verdict={verdict} />}</div>
        {whyButton}
        {onStuck && <StuckButton onClick={onStuck} />}
        {fold.foldable && <FoldToggle folded={false} onToggle={fold.toggle} />}
      </div>
    </div>
  )
}
