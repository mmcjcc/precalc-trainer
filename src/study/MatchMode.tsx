import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { mulberry32 } from '@/content/rng'
import { celebrateRound, MATCH_PAUSE_MS, soundRight, soundWrong } from '@/study/effects'
import { formatMatchTime, planBoards, tapTile, tilesFor, type MatchTile } from '@/study/match'
import { btnPrimary, btnSecondary, textClass } from '@/study/ui'
import { useStore } from '@/store'
import type { StudySet } from '@/store/studySets'

function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

/**
 * Boards of up to six pairs. Tap a term, then the definition on the same card. A right pair turns green for a
 * moment before it leaves; a wrong pair turns red, shakes and stays. The clock stops on the last right tap.
 */
export function MatchMode({ set }: { set: StudySet }) {
  const [round, setRound] = useState(0)
  return <Board key={round} set={set} onAgain={() => setRound((n) => n + 1)} />
}

function Board({ set, onAgain }: { set: StudySet; onAgain: () => void }) {
  const recordStudyMatch = useStore((s) => s.recordStudyMatch)
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const learned = useRef(new Set<string>())
  const best = useStore((s) => s.studySets.find((item) => item.id === set.id)?.bestMatchMs)
  const [bestBefore] = useState(best)
  const [seed] = useState(newSeed)
  const boards = useState(() => planBoards(set.cards, mulberry32(seed)))[0]
  const started = useRef(Date.now())
  const finished = useRef(false)
  const streak = useRef(0)
  const [boardIndex, setBoardIndex] = useState(0)
  const [tiles, setTiles] = useState<MatchTile[]>(() => (boards[0] ? tilesFor(boards[0], mulberry32(seed + 1)) : []))
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string[]>([])
  const [leaving, setLeaving] = useState<string[]>([])
  const [misses, setMisses] = useState(0)
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

  useEffect(() => {
    if (leaving.length === 0) return
    const id = window.setTimeout(() => setLeaving([]), MATCH_PAUSE_MS)
    return () => window.clearTimeout(id)
  }, [leaving])

  const turning = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (turning.current !== null) window.clearTimeout(turning.current)
    },
    [],
  )

  if (set.cards.length === 0 || boards.length === 0) return <p className="text-navy">Add a card before you study.</p>

  function finish(ms: number) {
    if (finished.current) return
    finished.current = true
    recordStudyMatch(set.id, ms)
    noteStudyRound(set.id, 'match')
    celebrateRound(bestBefore === undefined || ms < bestBefore)
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
      streak.current += 1
      soundRight(streak.current)
      setLeaving(tiles.filter((item) => item.cardId === id).map((item) => item.key))
    } else if (outcome.result === 'missed') {
      streak.current = 0
      soundWrong()
      setMisses((n) => n + 1)
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
        // The board's last pair gets its green moment too; the next board follows it.
        turning.current = window.setTimeout(() => {
          turning.current = null
          setBoardIndex(next)
          setTiles(tilesFor(board, mulberry32(seed + next + 1)))
          setGone(new Set())
          setSelected(null)
          setLeaving([])
        }, MATCH_PAUSE_MS)
      }
    }
  }

  const elapsed = doneMs ?? now - started.current

  if (doneMs !== null) {
    const newBest = bestBefore === undefined || doneMs < bestBefore
    return (
      <div className="study-in flex flex-col gap-4" data-study-done="">
        <div className="rounded-2xl border border-ok bg-ok-100 p-5 text-center">
          <p className="text-2xl font-semibold text-navy">{newBest ? 'New best time!' : 'All matched!'}</p>
          <p role="status" className="mt-1 text-lg font-semibold text-navy">
            Matched all {set.cards.length}. Time {formatMatchTime(doneMs)}.
          </p>
          <p className="mt-1 text-navy">
            Best {formatMatchTime(best ?? doneMs)}. {misses === 0 ? 'No wrong pairs.' : `${misses} wrong ${misses === 1 ? 'pair' : 'pairs'}.`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className={btnPrimary} onClick={onAgain}>
            Play again
          </button>
          <Link to={`/study/${set.id}`} className={btnSecondary}>
            Back to the set
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-navy/80">
        Board {boardIndex + 1} of {boards.length}. Time {formatMatchTime(elapsed)}.
        {best !== undefined ? ` Best ${formatMatchTime(best)}.` : ''}
      </p>
      <p className="text-sm text-navy/70">{selected ? 'Now tap its definition.' : 'Tap a term, then its definition.'}</p>
      <ul className="grid grid-cols-2 gap-2">
        {tiles
          .filter((tile) => !gone.has(tile.key) || leaving.includes(tile.key))
          .map((tile) => {
            const on = selected === tile.key
            const missed = flash.includes(tile.key)
            const matched = leaving.includes(tile.key)
            return (
              <li key={tile.key}>
                <button
                  type="button"
                  aria-label={`${tile.side === 'term' ? 'Term' : 'Definition'}: ${tile.text}`}
                  aria-pressed={on}
                  disabled={matched}
                  data-side={tile.side}
                  data-miss={missed ? '' : undefined}
                  data-matched={matched ? '' : undefined}
                  onClick={() => onTap(tile.key)}
                  className={`flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center ${
                    matched
                      ? 'study-pop border-2 border-ok bg-ok-100'
                      : missed
                        ? 'study-shake border-2 border-bad bg-bad-100'
                        : on
                          ? 'border-2 border-navy bg-navy-100'
                          : 'border-navy-100 bg-white hover:bg-navy-50'
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-navy/60">
                    {matched ? '✓ Matched' : missed ? '✕ Not a pair' : tile.side === 'term' ? 'Term' : 'Definition'}
                  </span>
                  <span className={`font-semibold text-navy ${textClass}`}>{tile.text}</span>
                </button>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
