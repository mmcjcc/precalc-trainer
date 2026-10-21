/**
 * "Step by step" on a module that is solved one checked line at a time (src/problem/solveStyle.ts), so she can tell
 * from Home and the module page which problems check every line. "Pick or type" where she can also choose each next
 * line from cards. It does not know the screen size.
 */
export function StepBadge({ pick }: { pick: boolean }) {
  return (
    <span data-step-badge="" className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        <path d="M1 12 H5 V8 H9 V4 H13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pick ? 'Step by step · pick or type' : 'Step by step'}
    </span>
  )
}
