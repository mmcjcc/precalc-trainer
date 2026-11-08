/**
 * Monster Dash: the earn-to-play mini-game. A monster she has caught runs and jumps over
 * subject-flavored obstacles (components/dash/DashGame.tsx); finishing a practice set with nothing
 * skipped earns one play that day (store/dash.ts), and the best score sticks for good. Rewards off
 * hides the game everywhere; this page then just says how to turn it on.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { monsterCollection, type MonsterEntry } from '@/components/monsters/collection'
import { MonsterArt } from '@/components/monsters/MonsterArt'
import { speciesForEdition } from '@/components/monsters/species'
import { DashGame } from '@/components/dash/DashGame'
import { STORE } from '@/edition'
import { DASH_DAY_CAP, dashBestOf, dashTokens, dayKey, useEvents, useRewards, useRewardsOn, useStore } from '@/store'

type Screen = { kind: 'menu' } | { kind: 'running'; seed: number } | { kind: 'over'; score: number; recorded: boolean }

function tokenWord(n: number): string {
  return `${n} ${n === 1 ? 'play' : 'plays'}`
}

export default function DashPage() {
  const rewardsOn = useRewardsOn()
  const events = useEvents()
  const view = useRewards()
  const rewards = useStore((s) => s.rewards)
  const noteDashRun = useStore((s) => s.noteDashRun)
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' })
  const [runner, setRunner] = useState<string | null>(null)

  const caught = useMemo(() => {
    const collection = monsterCollection(view.cards, speciesForEdition(STORE))
    const out: { entry: MonsterEntry; speciesName: string }[] = []
    for (const s of collection.species) {
      for (const m of s.monsters) if (m.status !== 'unseen') out.push({ entry: m, speciesName: s.species.name })
    }
    out.sort((a, b) => (b.entry.lastAt ?? 0) - (a.entry.lastAt ?? 0))
    return out
  }, [view.cards])

  const today = dayKey(Date.now())
  const tokens = dashTokens(events, today)
  const best = dashBestOf(rewards, events)
  const picked = runner ?? caught[0]?.entry.id ?? null

  if (!rewardsOn) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-xl font-bold text-navy">Monster Dash</h1>
        <p className="mt-2 text-navy-600">The game lives with the rewards. Turn rewards on in Settings to play.</p>
        <Link to="/settings" className="mt-3 inline-block font-semibold text-navy underline">
          Open Settings
        </Link>
      </div>
    )
  }

  const finish = (score: number) => {
    const recorded = noteDashRun({ runner: picked ?? 'monster', score })
    setScreen({ kind: 'over', score, recorded })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold text-navy">Monster Dash</h1>
        <p className="text-sm text-navy-600" data-dash-tokens>
          {tokenWord(tokens)} left today{best > 0 ? ` · best ${best}` : ''}
        </p>
      </div>

      {caught.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-navy-100 bg-white px-4 py-4">
          <p className="text-navy-600">
            Your runner is a monster you have caught. Practice, catch one red-handed, then come back and take it for a run.
          </p>
          <Link to="/monsters" className="mt-3 inline-block font-semibold text-navy underline">
            See the monsters
          </Link>
        </div>
      ) : screen.kind === 'running' ? (
        <div className="mt-4">
          <DashGame runner={picked!} seed={screen.seed} onDone={finish} />
          <p className="mt-2 text-sm text-navy-600">Tap the game, click, or press Space to jump.</p>
        </div>
      ) : (
        <>
          <section aria-label="Pick your runner" className="mt-4 rounded-2xl border border-navy-100 bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-navy">Your runner</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {caught.slice(0, 12).map(({ entry, speciesName }) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setRunner(entry.id)}
                    aria-pressed={entry.id === picked}
                    aria-label={`Run as ${speciesName}: ${entry.title}`}
                    className={`rounded-xl border px-1.5 py-1.5 hover:bg-navy-50 ${entry.id === picked ? 'border-2 border-gold bg-gold-100' : 'border-navy-100 bg-white'}`}
                  >
                    <MonsterArt id={entry.id} size={44} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {screen.kind === 'over' && (
            <div className="mt-4 rounded-2xl border border-navy-100 bg-white px-4 py-3" role="status">
              <p className="font-semibold text-navy">
                Run over — score {screen.score}
                {screen.score >= best && screen.score > 0 ? ' · new best!' : ''}
              </p>
              {!screen.recorded && <p className="mt-1 text-sm text-navy-600">That run was on the house (no plays left today).</p>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={tokens === 0}
              onClick={() => setScreen({ kind: 'running', seed: Date.now() >>> 0 })}
              className="rounded-xl bg-navy px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {screen.kind === 'over' ? 'Play again' : 'Play'} · 1 play
            </button>
            {tokens === 0 && (
              <p className="text-sm text-navy-600">
                Finish a practice set (nothing skipped) to earn a play — up to {DASH_DAY_CAP} a day.{' '}
                <Link to="/set" className="font-semibold text-navy underline">
                  Start a set
                </Link>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
