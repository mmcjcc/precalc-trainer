import { useMemo, useState } from 'react'
import { verdictFromSetAnswer } from '@/problem/tutorContext'
import type { TutorVerdict } from '@/shared/tutor'
import { getModule } from '@/content/registry'
import type { HintView, ProgressLine } from '@/problem/stepEngine'
import { useKeyedHint } from '@/problem/useKeyedHint'
import { FinalAnswerCard } from '@/components/FinalAnswerCard'
import { HintPanel } from '@/components/HintPanel'
import { NumberLineSet } from '@/components/NumberLineSet'
import { ProblemFrame } from './ProblemFrame'
import { recordSetAnswer } from './record'
import type { FlowProps } from './types'

const NUDGE =
  'Read the dots first: a filled dot is included — square bracket [ ] or ≤. An open dot is not — parenthesis ( ) or <. Then follow the shading: an arrow off the end means ∞, and ∞ always gets a parenthesis.'

/**
 * Number-line flow (BUILD_GUIDE §7): the shaded number line IS the question; she writes the set in
 * interval and set-builder notation. No worked column, no composer.
 */
export function NumberLineFlow({ instance, attempt, flags, templateTitle, completion, finish }: FlowProps) {
  const answer = instance.answer
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const hint = useKeyedHint(attempt, 0, done)
  const view = useMemo<HintView>(
    () => ({ next: null, nudge: NUDGE, card: mod.ruleCards.find((c) => c.id === 'brackets') ?? mod.ruleCards[0] ?? null, reveal: null }),
    [mod],
  )
  const [tutorVerdict, setTutorVerdict] = useState<TutorVerdict | null>(null)
  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'both notations match' : 'write both notations',
    solved: done,
    offPath: false,
  }

  if (answer.type !== 'set') {
    return <p className="text-navy">This problem has no set to read — pick another from the module page.</p>
  }

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      graphCaption="the set to write in both notations"
      nudgeText="Still here? Write the shaded set both ways below — read the dots first. The hint button is right there."
      statement={
        <div className="flex flex-col items-center gap-1 py-1">
          <NumberLineSet set={answer.set} domain={instance.graph.xDomain} caption="the set to write in both notations" className="max-w-lg" />
          <p className="text-xs text-navy/70">Filled dot = included · open dot = not included · arrow = keeps going</p>
        </div>
      }
      hints={<HintPanel rung={hint.rung} view={view} onAdvance={hint.advance} onUseLine={() => undefined} disabled={done} />}
      tutorVerdict={tutorVerdict}
      keymap={{ onHint: hint.advance }}
    >
      <FinalAnswerCard
        target={{ set: answer.set, requireInterval: answer.requireInterval, requireSetBuilder: answer.requireSetBuilder }}
        initial={{ interval: attempt?.final?.interval, set: attempt?.final?.set }}
        onGrade={(grade, texts) => {
          setTutorVerdict(verdictFromSetAnswer(grade, texts))
          recordSetAnswer(grade, texts)
          if (grade.done) finish()
        }}
        done={done}
        variable={instance.vars[0] ?? 'x'}
      />
    </ProblemFrame>
  )
}
