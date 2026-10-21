import { useId } from 'react'
import { useStore } from '@/store'

/**
 * Opens a step-by-step problem until she closes it once (settings.seenStepGuide): how this kind of problem works. The
 * owner found the step-by-step solving easy to miss; a box that says "next line of your work" does not say that every
 * line is checked. It does not know the screen size.
 */
export function StepGuide({ pick }: { pick: boolean }) {
  const titleId = useId()
  const setSettings = useStore((s) => s.setSettings)
  return (
    <section aria-labelledby={titleId} data-step-guide="" className="space-y-2 rounded-2xl border-2 border-navy bg-white p-4 text-navy">
      <h2 id={titleId} className="text-lg font-semibold">
        Solve it step by step
      </h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Write your next line, then check it.</li>
        <li>Every line is checked, and a mistake gets named the moment you make it.</li>
        <li>When you reach the answer, it goes in the answer box.</li>
      </ol>
      {pick && (
        <p>
          Not sure what comes next? Switch to <b>Pick</b> to choose each step from three.
        </p>
      )}
      <button
        type="button"
        onClick={() => setSettings({ seenStepGuide: true })}
        className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
      >
        Got it
      </button>
    </section>
  )
}
