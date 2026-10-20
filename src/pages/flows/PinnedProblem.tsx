import { useEffect, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { normalizeInput, parseExpression, parseStatement } from '@/engine'
import { safeLatex } from '@/problem/stepEngine'
import { firstSentence } from '@/components/ComposerVerdict'
import { Katex } from '@/components/Katex'

/** The problem in one line: its math as KaTeX when the statement is math, else its first sentence. */
export interface PinnedSummary {
  tex: string | null
  /** Plain text (the strip's accessible name; the line itself when there is no math). */
  text: string
}

/** Pieces of a statement split at a top-level ", " or "; " (never inside brackets: a point, an interval). */
function splitTopLevel(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1)
    else if ((c === ',' || c === ';') && depth === 0 && /\s/.test(text[i + 1] ?? '')) {
      out.push(text.slice(start, i))
      start = i + 1
    }
  }
  out.push(text.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/** g(x) = …, h(x) = …: a function's definition whose name the parser does not know. */
const DEFINITION = /^([A-Za-z])\(([a-z])\)\s*=\s*(.+)$/

function pieceTex(piece: string, vars: readonly string[]): string | null {
  const n = normalizeInput(piece)
  if (parseStatement(n, vars).ok || parseExpression(n, vars).ok) return safeLatex(piece) || null
  const def = DEFINITION.exec(piece)
  if (def && parseExpression(normalizeInput(def[3]!), vars).ok) {
    const rhs = safeLatex(def[3]!)
    return rhs ? `${def[1]}(${def[2]}) = ${rhs}` : null
  }
  return null
}

/**
 * What the pinned strip shows for a problem: its statement as math when every piece of it parses (an inequality,
 * f(x) = …, two definitions), else the first sentence of its words (a word problem, a figure's question).
 */
export function pinnedSummary(statementText: string, vars: readonly string[]): PinnedSummary {
  const text = statementText.trim()
  const all = [...new Set([...vars, 'x', 'y'])]
  const pieces = splitTopLevel(text)
  const texs = pieces.map((p) => pieceTex(p, all))
  if (pieces.length > 0 && texs.every((t) => t)) return { tex: texs.join(',\\;\\; '), text }
  return { tex: null, text: firstSentence(text) ?? text }
}

/** The page's top safe-area inset in px (the root's padding: env(safe-area-inset-top)); 0 in a browser tab. */
function safeAreaTop(): number {
  if (typeof document === 'undefined') return 0
  const root = document.getElementById('root')
  if (!root || typeof getComputedStyle !== 'function') return 0
  const v = parseFloat(getComputedStyle(root).paddingTop)
  return Number.isFinite(v) ? v : 0
}

/** Room the strip takes at the top of the screen; the card counts as gone once it is under it. */
const STRIP_ROOM = 48

/**
 * True once the element has scrolled up out of view (its bottom above the strip's room under the safe area).
 * IntersectionObserver only: without it (an old browser, jsdom) the answer is always false.
 */
export function useScrolledPast(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el || typeof IntersectionObserver !== 'function') {
      setPast(false)
      return
    }
    const top = Math.round(safeAreaTop() + STRIP_ROOM)
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (!entry) return
        setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= top + 1)
      },
      { rootMargin: `-${top}px 0px 0px 0px`, threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, enabled])
  return past
}

/** A tap on the strip leaves focus in her box (the keypad stays up, so the problem opens in a sheet). */
const keepFocus = {
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
}

/**
 * The pinned problem: a slim strip at the top of the screen (under the status bar) while the gold problem card is
 * scrolled out of view. A tap brings the card back.
 */
export function PinnedProblemStrip({
  summary,
  figure,
  onShow,
  stripRef,
}: {
  summary: PinnedSummary
  /** The card holds a figure or a graph: say so, since one line cannot show it. */
  figure: boolean
  onShow: () => void
  stripRef?: RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={stripRef} className="pinned-problem fixed inset-x-0 z-30 border-b border-gold bg-gold-100 shadow-sm" data-pinned-problem="">
      <button
        type="button"
        {...keepFocus}
        onClick={onShow}
        aria-label={figure ? `${summary.text} Show the figure` : `Show the problem: ${summary.text}`}
        className="mx-auto flex min-h-11 w-full max-w-3xl items-center gap-3 px-4 py-1 text-left text-navy"
      >
        <span className="min-w-0 flex-1 truncate text-sm">{summary.tex ? <Katex tex={summary.tex} /> : summary.text}</span>
        {figure && <span className="shrink-0 text-sm font-semibold underline">Show the figure</span>}
      </button>
    </div>
  )
}
