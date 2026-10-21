import { useEffect, useRef, useState } from 'react'
import { motionAllowed } from './motion'

const DURATION_MS = 900

function nextFrame(cb: (t: number) => void): () => void {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    const id = window.requestAnimationFrame(cb)
    return () => window.cancelAnimationFrame(id)
  }
  const id = setTimeout(() => cb(Date.now()), 16)
  return () => clearTimeout(id)
}

/**
 * A number that counts up from 0 when it appears ("+45 XP" on the finish sheet and the set's results). While it counts,
 * what is read out (and found by tests) is the final number; the counting one is decorative. Under reduced motion it
 * is the final number at once.
 */
export function CountUp({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  // Counting only when it mounts with motion allowed; a later change of value shows at once.
  const [shown, setShown] = useState<number | null>(() => (value > 0 && motionAllowed() ? 0 : null))
  const target = useRef(value)
  target.current = value
  const counting = shown !== null
  useEffect(() => {
    if (!counting) return
    let start: number | null = null
    let cancel = () => {}
    const tick = (t: number) => {
      start ??= t
      const p = Math.min(1, (t - start) / DURATION_MS)
      if (p >= 1) {
        setShown(null)
        return
      }
      setShown(Math.round(target.current * (1 - Math.pow(1 - p, 3))))
      cancel = nextFrame(tick)
    }
    cancel = nextFrame(tick)
    return () => cancel()
  }, [counting])
  if (shown === null) {
    return (
      <>
        {prefix}
        {value}
        {suffix}
      </>
    )
  }
  return (
    <>
      <span aria-hidden="true" data-counting="">
        {prefix}
        {shown}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {value}
        {suffix}
      </span>
    </>
  )
}
