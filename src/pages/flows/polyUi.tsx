/**
 * Shared screen pieces for the three Unit 2 polynomial modules (completing the square, synthetic division,
 * zeros and rational roots): feedback for one check made of several PolyGrades, the "not an attempt" notice,
 * the hint ladder, and saving her boxes on the attempt.
 */
import type { Ref } from 'react'
import { polyGradePattern } from '@/content/modules/polynomials/patterns'
import type { PolyGrade, SquareLineGrade } from '@/engine'
import { SigFigCorrect, SigFigRejection } from '@/components/SigFigFeedback'
import { useStore } from '@/store'
import type { PatternHit } from '@/shared/types'
import { NotAnAttemptNotice } from './hintLadder'

export { ANSWER_HINT_KEY, HintLadder, NotAnAttemptNotice, useHintLadder, type LadderRung } from './hintLadder'

export type AnyPolyGrade = PolyGrade | SquareLineGrade

/** One graded part of a check: the vertex box, the axis box, a row of the division table, … */
export interface PolyPart {
  /** What the part is, shown above its card when a check has several parts. */
  label?: string
  grade: AnyPolyGrade
}

/** Unreadable, not in the form asked for, or a problem outside the model: the check is not an attempt. */
export function polyBlocked(grades: readonly AnyPolyGrade[]): boolean {
  return grades.some((g) => g.verdict === 'invalid' || g.verdict === 'unsupported')
}

export function polyAllCorrect(grades: readonly AnyPolyGrade[]): boolean {
  return grades.length > 0 && grades.every((g) => g.verdict === 'correct')
}

/** The first named mistake of a check as a catalog hit (for the rule-card rung), or null. */
export function firstPolyPattern(grades: readonly AnyPolyGrade[]): PatternHit | null {
  for (const g of grades) {
    const hit = polyGradePattern(g)
    if (hit) return hit
  }
  return null
}

/**
 * One grade in the existing feedback cards. A named mistake shows the catalog lesson with the engine's
 * witness as the sentence about her answer; a plain wrong shows the grader's message. The grader's
 * `explanation` is never shown here: it contains the answer and belongs to the last hint rung.
 */
export function PolyGradeCard({ grade, label }: PolyPart) {
  const caption = label ? <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">{label}</p> : null
  if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') return <NotAnAttemptNotice messages={[label ? `${label}: ${grade.message}` : grade.message]} />
  const hit = polyGradePattern(grade)
  return (
    <div className="space-y-1">
      {caption}
      {grade.verdict === 'correct' ? (
        <SigFigCorrect message={grade.message} />
      ) : grade.verdict === 'mistake' ? (
        <SigFigRejection message={grade.witness} patterns={hit ? [hit] : []} />
      ) : (
        <SigFigRejection message={grade.message} patterns={[]} />
      )}
    </div>
  )
}

/**
 * Feedback for one press of Check. If any part is invalid, only the notice is shown (the check was not an
 * attempt, so nothing is marked right or wrong yet); otherwise one card per part.
 */
export function PolyGradeList({ parts }: { parts: readonly PolyPart[] }) {
  if (parts.length === 0) return null
  const blocked = parts.filter((p) => p.grade.verdict === 'invalid' || p.grade.verdict === 'unsupported')
  if (blocked.length > 0) {
    return <NotAnAttemptNotice messages={blocked.map((p) => ('message' in p.grade ? (p.label ? `${p.label}: ${p.grade.message}` : p.grade.message) : ''))} />
  }
  return (
    <div className="space-y-3">
      {parts.map((part, i) => (
        <PolyGradeCard key={part.label ?? i} grade={part.grade} label={part.label} />
      ))}
    </div>
  )
}

const TEXT_BOX =
  'min-h-12 w-full max-w-xs rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50'

/**
 * One labelled answer box (48 px tall, a 16 px font so phones do not zoom). `hint` is the line under the
 * box. Never a number input: answers are exact text such as "-5/4" or "(3, -5)".
 */
export function PolyTextBox({
  id,
  label,
  hint,
  value,
  placeholder,
  disabled,
  invalid,
  onChange,
  inputRef,
}: {
  id: string
  label: string
  hint: string
  value: string
  placeholder: string
  disabled: boolean
  invalid: boolean
  onChange: (v: string) => void
  inputRef?: Ref<HTMLInputElement>
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={TEXT_BOX}
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-navy/70">
        {hint}
      </p>
    </div>
  )
}

/** A one-of-several choice as 44 px radio buttons inside a labelled group. */
export function PolyChoice({
  legend,
  name,
  options,
  value,
  disabled,
  onChange,
  firstRef,
}: {
  legend: string
  name: string
  options: readonly { value: string; label: string }[]
  value: string
  disabled: boolean
  onChange: (v: string) => void
  /** The first option's input, so a screen can move focus to the choice when it opens. */
  firstRef?: Ref<HTMLInputElement>
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <label
            key={o.value}
            className={`flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-navy ${value === o.value ? 'border-navy bg-gold-100' : 'border-navy-100 bg-white'} ${disabled ? 'opacity-60' : 'hover:border-navy'}`}
          >
            <input ref={i === 0 ? firstRef : undefined} type="radio" name={name} value={o.value} checked={value === o.value} disabled={disabled} onChange={() => onChange(o.value)} className="h-4 w-4 accent-navy" />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Store her boxes on the attempt (AttemptFinal.polyEntries) so a reload restores them. */
export function savePolyEntries(entries: Record<string, string>): void {
  useStore.getState().setFinal({ polyEntries: entries })
}
