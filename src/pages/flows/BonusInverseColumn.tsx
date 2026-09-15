import { useCallback, useMemo, useState } from 'react'
import { getModule } from '@/content/registry'
import type { ProblemInstance } from '@/content/types'
import type { ParseError, StepResult } from '@/shared/types'
import type { AttemptStep } from '@/store'
import { detectInverseCompletion } from '@/problem/inverse'
import { buildStepContext, classifyStep, hintView, liveParseError } from '@/problem/stepEngine'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { RejectionCard } from '@/components/RejectionCard'
import { WorkedColumn } from '@/components/WorkedColumn'
import { safeLatex } from '@/problem/stepEngine'

type Props = { instance: ProblemInstance; bonusInverse: string }

/**
 * Optional bonus after the not-one-to-one verdict: work the inverse relation anyway (keeping ±) and
 * see which branch survives on the restricted domain. Local state only — the attempt is already
 * finished, so nothing here counts toward progress.
 */
export function BonusInverseColumn({ instance, bonusInverse }: Props) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<AttemptStep[]>([])
  const [swapped, setSwapped] = useState(false)
  const [draft, setDraft] = useState('')
  const [rejection, setRejection] = useState<StepResult | null>(null)
  const [parseError, setParseError] = useState<ParseError | null>(null)
  const [showNudge, setShowNudge] = useState(false)
  const current = lines.length ? lines[lines.length - 1]!.text : instance.start
  const ctx = useMemo(() => buildStepContext(instance, swapped), [instance, swapped])
  const hint = useMemo(() => hintView(instance, current, swapped), [instance, current, swapped])
  const finished = useMemo(() => {
    if (detectInverseCompletion(current, bonusInverse, instance.seed)) return true
    const info = getModule(instance.moduleId).progress(instance, current, swapped)
    const path = info.path === 'alt' ? (instance.canonicalAlt ?? []) : instance.canonical
    return info.path !== 'none' && info.anchorIndex === path.length - 1 && lines.length > 0
  }, [current, bonusInverse, instance, swapped, lines.length])
  const validate = useCallback((t: string) => liveParseError(t, instance.vars), [instance.vars])

  function submit() {
    const outcome = classifyStep(current ?? '', draft, ctx)
    if (outcome.kind === 'parse') {
      setParseError(outcome.error)
      return
    }
    if (outcome.kind === 'rejected') {
      setRejection(outcome.result)
      return
    }
    setLines((ls) => [
      ...ls,
      { idx: ls.length, text: outcome.text, latex: outcome.latex, accepted: true, firstTry: true, revealed: false, property: 'off', propertyTag: outcome.result.detected?.tag },
    ])
    if (outcome.result.swapped) setSwapped(true)
    setRejection(null)
    setParseError(null)
    setShowNudge(false)
    setDraft('')
  }

  function undo() {
    const last = lines[lines.length - 1]
    if (!last) return
    setLines((ls) => ls.slice(0, -1))
    if (last.propertyTag === 'swap_xy') setSwapped(false)
    setRejection(null)
    setDraft(last.text)
  }

  if (!open) {
    return (
      <section className="space-y-2 rounded-2xl border border-gold bg-gold-100 p-4">
        <h2 className="font-semibold text-navy">Bonus (optional): half a parabola does have an inverse</h2>
        <p className="text-sm text-navy">
          Keep only one side of the vertex and every output comes from one input again. Work the inverse steps with the ± kept, then pick the
          branch that matches the restricted domain.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
          Try the bonus
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gold bg-white p-4" aria-label="Bonus inverse steps">
      <h2 className="font-semibold text-navy">Bonus: the inverse on the restricted domain</h2>
      <p className="text-xs text-navy/70">Not graded — the problem is already complete.</p>
      <WorkedColumn start={instance.start} steps={lines} onUndo={undo} canUndo={lines.length > 0} />
      {rejection && <RejectionCard result={rejection} />}
      {finished ? (
        <p role="status" className="rounded-xl bg-ok-100 px-3 py-2 text-sm text-navy">
          <span aria-hidden>✓ </span>
          Both branches are there. Keep the one that matches the restricted domain: <Katex tex={`f^{-1}(x) = ${safeLatex(bonusInverse)}`} />
        </p>
      ) : (
        <>
          <MathInput
            value={draft}
            onChange={(v) => {
              setDraft(v)
              setParseError(null)
            }}
            onSubmit={submit}
            validate={validate}
            error={parseError}
            label="Bonus line"
            placeholder="Next line, like x = (y - 2)^2 + 1"
          />
          <div className="space-y-2">
            <button type="button" onClick={() => setShowNudge(true)} className="min-h-10 rounded-lg bg-gold px-3 text-sm font-semibold text-navy hover:bg-gold/80">
              Nudge me
            </button>
            {showNudge && <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy">{hint.nudge}</p>}
          </div>
        </>
      )}
    </section>
  )
}
