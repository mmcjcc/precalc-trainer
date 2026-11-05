import { useEffect, useRef, useState } from 'react'
import { mulberry32 } from '@/content/rng'
import { formatMatchTime, planBoards, tapTile, tilesFor, type MatchTile } from '@/study/match'
import { textClass } from '@/study/ui'
import { useStore } from '@/store'
import type { StudySet } from '@/store/studySets'

/** Boards of up to six pairs. Tap a term, then the definition on the same card. */
export function MatchMode({ set }: { set: StudySet }) {
  const recordStudyMatch = useStore((s) => s.recordStudyMatch)
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const learned = useRef(new Set<string>())
  const best = useStore((s) => s.studySets.find((item) => item.id === set.id)?.bestMatchMs)
  const [seed] = useState(() => (Math.random() * 0xffffffff) >>> 0)
  const boards = useState(() => planBoards(set.cards, mulberry32(seed)))[0]
  const started = useRef(Date.now())
  const finished = useRef(false)
  const [boardIndex, setBoardIndex] = useState(0)
  const [tiles, setTiles] = useState<MatchTile[]>(() => (boards[0] ? tilesFor(boards[0], mulberry32(seed + 1)) : []))
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string[]>([])
  const [doneMs, setDoneMs] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (doneMs !== null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [doneMs])

  useEffect(() => {
    if (flash.length === 0) return
    const id = window.setTimeout(() => setFlash([]), 700)
    return () => window.clearTimeout(id)
  }, [flash])

  if (set.cards.length === 0 || boards.length === 0) return <p className="text-navy">Add a card before you study.</p>

  function finish(ms: number) {
    if (finished.current) return
    finished.current = true
    recordStudyMatch(set.id, ms)
    noteStudyRound(set.id, 'match')
    setDoneMs(ms)
  }

  function onTap(key: string) {
    if (doneMs !== null) return
    const outcome = tapTile(tiles, gone, selected, key)
    if (outcome.result === 'matched') {
      const id = tiles.find((item) => item.key === key)?.cardId
      if (id && !learned.current.has(id)) {
        learned.current.add(id)
        noteStudyLearned(set.id, id)
      }
    }
    setGone(outcome.gone)
    setSelected(outcome.selected)
    setFlash(outcome.flash)
    if (outcome.gone.size === tiles.length && tiles.length > 0) {
      const next = boardIndex + 1
      if (next >= boards.length) finish(Date.now() - started.current)
      else {
        const board = boards[next]
        if (!board) return
        setBoardIndex(next)
        setTiles(tilesFor(board, mulberry32(seed + next + 1)))
        setGone(new Set())
        setSelected(null)
      }
    }
  }

  const elapsed = doneMs ?? now - started.current

  if (doneMs !== null) {
    return (
      <div className="flex flex-col gap-2">
        <p role="status" className="text-lg font-semibold text-navy">
          Matched all {set.cards.length}. Time {formatMatchTime(doneMs)}.
        </p>
        <p className="text-navy">Best {formatMatchTime(best ?? doneMs)}.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-navy/80">
        Board {boardIndex + 1} of {boards.length}. Time {formatMatchTime(elapsed)}.
        {best !== undefined ? ` Best ${formatMatchTime(best)}.` : ''}
      </p>
      <p className="text-sm text-navy/70">Tap a term, then its definition.</p>
      <ul className="grid grid-cols-2 gap-2">
        {tiles
          .filter((tile) => !gone.has(tile.key))
          .map((tile) => {
            const on = selected === tile.key
            const missed = flash.includes(tile.key)
            return (
              <li key={tile.key}>
                <button
                  type="button"
                  aria-label={`${tile.side === 'term' ? 'Term' : 'Definition'}: ${tile.text}`}
                  aria-pressed={on}
                  data-side={tile.side}
                  data-miss={missed ? '' : undefined}
                  onClick={() => onTap(tile.key)}
                  className={`flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center ${
                    missed ? 'border-bad bg-bad-100' : on ? 'border-navy bg-navy-100' : 'border-navy-100 bg-white'
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-navy/60">{tile.side === 'term' ? 'Term' : 'Definition'}</span>
                  <span className={`font-semibold text-navy ${textClass}`}>{tile.text}</span>
                </button>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
