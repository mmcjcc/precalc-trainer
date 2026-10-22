import { useLocation, useNavigate } from 'react-router-dom'
import { speakable } from '@/grapher/format'
import type { GraphItRequest } from '@/grapher/graphIt'
import { useGraphStore } from './graphStore'

/** Where the grapher came from, in the history entry's state: its "Back to the problem" goes there. */
export interface GraphFromState {
  graphFrom?: string
}

function GraphGlyph() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V4M4 20h16" />
      <path d="M6 16c3-9 6-9 9-3s3 2 5-4" />
    </svg>
  )
}

/**
 * "Graph it": opens the grapher (/graph) with this problem's function in a new row and the problem's window. The
 * problem stays as it is (her attempt is kept), and the grapher's Back, or the phone's, returns to it. Problems only
 * pass what they already show her (src/grapher/graphIt.ts).
 */
export function GraphItButton({ request, note, className }: { request: GraphItRequest; note?: string; className?: string }) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const open = () => {
    useGraphStore.getState().importRows(request)
    const state: GraphFromState = { graphFrom: `${pathname}${search}` }
    navigate('/graph', { state })
  }
  return (
    <div className={className}>
      <button
        type="button"
        onClick={open}
        data-graph-it=""
        aria-label={`Graph it: open ${speakable(request.label)} in the grapher`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-navy bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50"
      >
        <GraphGlyph />
        Graph it
      </button>
      {note && <p className="mt-1 text-xs text-navy/70">{note}</p>}
    </div>
  )
}
