import { useEffect, useId, useState } from 'react'
import { formatNumber } from '@/grapher/format'
import { DEFAULT_SLIDER, type SliderState } from '@/grapher/state'
import { useGraphStore } from './graphStore'
import { NumberBox } from './NumberBox'

function SliderRow({ letter, state }: { letter: string; state: SliderState }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const set = (change: Partial<SliderState>) => useGraphStore.getState().setSlider(letter, change)
  return (
    <li className="rounded-xl border border-navy-100 bg-white px-2 py-1.5" data-slider={letter}>
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-value`} className="shrink-0 font-mono text-lg italic text-navy">
          {letter} =
        </label>
        <NumberBox id={`${id}-value`} label={`${letter}, its value`} value={state.value} onCommit={(value) => set({ value })} />
        <input
          type="range"
          aria-label={`${letter}, slider from ${formatNumber(state.min)} to ${formatNumber(state.max)}`}
          aria-valuetext={formatNumber(state.value)}
          min={state.min}
          max={state.max}
          step={state.step}
          value={state.value}
          onChange={(e) => set({ value: Number(e.target.value) })}
          className="h-11 min-w-0 flex-1 accent-[var(--color-navy)]"
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-range`}
          aria-label={`${letter}: range and step`}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-navy/70 hover:bg-navy-50"
        >
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="9" cy="6" r="1.8" fill="currentColor" />
            <circle cx="15" cy="12" r="1.8" fill="currentColor" />
            <circle cx="7" cy="18" r="1.8" fill="currentColor" />
          </svg>
        </button>
      </div>
      {open && (
        <div id={`${id}-range`} className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-navy">
          <span className="flex items-center gap-1.5">
            from
            <NumberBox label={`${letter}, smallest value`} value={state.min} onCommit={(min) => (min < state.max ? set({ min, value: Math.max(min, state.value) }) : undefined)} className="w-16" />
          </span>
          <span className="flex items-center gap-1.5">
            to
            <NumberBox label={`${letter}, largest value`} value={state.max} onCommit={(max) => (max > state.min ? set({ max, value: Math.min(max, state.value) }) : undefined)} className="w-16" />
          </span>
          <span className="flex items-center gap-1.5">
            step
            <NumberBox label={`${letter}, step`} value={state.step} onCommit={(step) => (step > 0 ? set({ step }) : undefined)} className="w-16" />
          </span>
        </div>
      )}
    </li>
  )
}

/** A slider row for every letter the rows use that no row gives a value (a, b, h, k...). */
export function SliderList({ letters }: { letters: readonly string[] }) {
  const sliders = useGraphStore((s) => s.sliders)
  const ensure = useGraphStore((s) => s.ensureSliders)
  useEffect(() => ensure(letters), [letters, ensure])
  if (letters.length === 0) return null
  return (
    <section aria-labelledby="graph-sliders-title" className="space-y-1.5">
      <h2 id="graph-sliders-title" className="text-sm font-semibold text-navy">
        Sliders
      </h2>
      <ul className="space-y-1.5">
        {letters.map((l) => (
          <SliderRow key={l} letter={l} state={sliders[l] ?? DEFAULT_SLIDER} />
        ))}
      </ul>
    </section>
  )
}
