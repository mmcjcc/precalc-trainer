import { useEffect, useId, useRef, useState } from 'react'
import { burstConfetti } from '@/components/juice/Confetti'
import { useMotionAllowed } from '@/components/juice/motion'
import type { ChestSpot } from '@/session/quests'
import { THEMES, useRewards, useStore, type ChestReward } from '@/store'

type Phase = 'closed' | 'shaking' | 'open'

/** How long the chest shakes before its lid swings up (motion allowed only). */
export const CHEST_SHAKE_MS = 520

/**
 * The chest, drawn in code: a gold box with darker bands and a lock, its lid swinging up when it opens. Decorative: the
 * button and the words around it say everything. The outline and the lock follow the colour theme.
 */
export function ChestArt({ size = 56, phase, motion }: { size?: number; phase: Phase; motion: boolean }) {
  const box = phase === 'closed' ? (motion ? 'chest-wiggle' : '') : phase === 'shaking' && motion ? 'chest-shake' : ''
  const lid = phase === 'open' ? (motion ? 'chest-lid chest-lid-open' : 'chest-lid chest-lid-up') : 'chest-lid'
  return (
    <svg width={size} height={size * 0.875} viewBox="0 0 64 56" aria-hidden="true" focusable="false" className="chest-art shrink-0" data-chest-art="">
      <ellipse cx="32" cy="52" rx="23" ry="3" className="fill-navy-100" />
      {phase === 'open' && <circle cx="32" cy="20" r="18" className="fill-gold-100" />}
      <g className={box}>
        <rect x="8" y="24" width="48" height="26" rx="4" className="fill-gold stroke-navy" strokeWidth="2.5" />
        <rect x="15" y="24" width="6" height="26" className="fill-gold-text/40" />
        <rect x="43" y="24" width="6" height="26" className="fill-gold-text/40" />
        <rect x="27.5" y="27" width="9" height="10" rx="2" className="fill-navy" />
        <circle cx="32" cy="31" r="1.6" className="fill-gold" />
        <g className={lid}>
          <path d="M8 24 V17 Q8 9 16 9 H48 Q56 9 56 17 V24 Z" className="fill-gold stroke-navy" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="15" y="10" width="6" height="14" className="fill-gold-text/40" />
          <rect x="43" y="10" width="6" height="14" className="fill-gold-text/40" />
        </g>
      </g>
    </svg>
  )
}

/** What the chest gave, in words (also its live announcement). */
export function rewardWords(reward: ChestReward): string {
  if (reward.kind === 'xp') return `+${reward.xp} XP`
  if (reward.kind === 'rest') return 'An extra rest day for your streak'
  return `A new colour theme: ${THEMES[reward.theme].name}`
}

function RewardDetail({ reward }: { reward: ChestReward }) {
  const view = useRewards()
  const theme = useStore((s) => s.settings.theme)
  const setSettings = useStore((s) => s.setSettings)
  if (reward.kind === 'xp') return <p className="text-sm text-navy/80">Bonus XP: it counts in today’s goal.</p>
  if (reward.kind === 'rest') {
    const n = view.streak.restDays
    return (
      <p className="text-sm text-navy/80">
        A day off uses one by itself. You have {n} rest {n === 1 ? 'day' : 'days'} saved.
      </p>
    )
  }
  const name = THEMES[reward.theme].name
  if (theme === reward.theme) return <p className="text-sm text-navy/80">{name} is on. You can change it in Settings.</p>
  return (
    <div className="space-y-1">
      <p className="text-sm text-navy/80">It is yours now: pick it any time in Settings.</p>
      <button
        type="button"
        onClick={() => setSettings({ theme: reward.theme })}
        className="min-h-11 rounded-xl border-2 border-navy bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50"
      >
        Use {name} now
      </button>
    </div>
  )
}

/** One chest: a button until she opens it, then what it gave her. */
function ChestCard({ spot, reward, onOpened }: { spot: ChestSpot; reward?: ChestReward; onOpened: (reward: ChestReward) => void }) {
  const motion = useMotionAllowed()
  const [phase, setPhase] = useState<Phase>(reward ? 'open' : 'closed')
  const revealRef = useRef<HTMLDivElement>(null)
  const descId = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapped = useRef(false)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  // The button is gone once she taps it: the words of the reward take the focus (where it was the button's).
  useEffect(() => {
    if (phase !== 'closed' && tapped.current) {
      tapped.current = false
      revealRef.current?.focus({ preventScroll: true })
    }
  }, [phase])

  function open() {
    if (phase !== 'closed') return
    const s = useStore.getState()
    // Recorded at the tap: the reward is hers now, whatever happens next (a reload, leaving the page).
    const got = s.openChest(spot.day)
    if (!got) return
    tapped.current = true
    // Its sound follows the log like every other moment's (components/juice/cues.ts: the "chest" cue, Sounds on).
    onOpened(got)
    if (!motion) {
      setPhase('open')
      return
    }
    setPhase('shaking')
    timer.current = setTimeout(() => {
      timer.current = null
      setPhase('open')
      burstConfetti({ count: 40 })
    }, CHEST_SHAKE_MS)
  }

  const label = spot.when === 'today' ? 'Open today’s chest' : 'Open yesterday’s chest'
  const card = 'flex w-full items-center gap-3 rounded-2xl border-2 border-gold bg-gold-100 p-3 text-left text-navy'
  if (phase === 'closed' || !reward) {
    return (
      <button type="button" onClick={open} aria-label={label} aria-describedby={descId} className={`${card} min-h-16 hover:border-gold-text`} data-chest={spot.day} data-chest-state="closed">
        <ChestArt phase="closed" motion={motion} />
        <span className="min-w-0">
          <span className="block font-semibold">{label}</span>
          <span id={descId} className="block text-sm text-navy/80">
            {spot.when === 'today' ? 'All three quests done. Tap to open it.' : 'Yesterday’s three quests were done. It waits for you today only.'}
          </span>
        </span>
      </button>
    )
  }
  return (
    <div className={card} data-chest={spot.day} data-chest-state={phase}>
      <ChestArt phase={phase} motion={motion} />
      <div ref={revealRef} tabIndex={-1} role="status" className="min-w-0 outline-none" data-chest-reward={reward.kind}>
        {phase === 'open' ? (
          <div className={motion ? 'chest-reward-in' : undefined}>
            <p className="font-semibold">
              <span className="sr-only">{spot.when === 'today' ? 'Today’s chest: ' : 'Yesterday’s chest: '}</span>
              <span className={reward.kind === 'xp' ? 'text-2xl font-bold' : ''}>{rewardWords(reward)}</span>
            </p>
            <RewardDetail reward={reward} />
          </div>
        ) : (
          <p className="font-semibold">Opening…</p>
        )}
      </div>
    </div>
  )
}

/**
 * The chests she can open (today's, and yesterday's on the next day), each a button with the chest drawn on it; the
 * ones she opened here stay, showing what they gave. Nothing when there are none.
 */
export function ChestSpots({ chests }: { chests: readonly ChestSpot[] }) {
  const [opened, setOpened] = useState<{ spot: ChestSpot; reward: ChestReward }[]>([])
  const shown = [
    ...opened.map((o) => ({ spot: o.spot, reward: o.reward as ChestReward | undefined })),
    ...chests.filter((c) => !opened.some((o) => o.spot.day === c.day)).map((spot) => ({ spot, reward: undefined })),
  ].sort((a, b) => a.spot.day.localeCompare(b.spot.day))
  if (shown.length === 0) return null
  return (
    <div className="space-y-2" data-chests="">
      {shown.map(({ spot, reward }) => (
        <ChestCard key={spot.day} spot={spot} reward={reward} onOpened={(got) => setOpened((prev) => [...prev, { spot, reward: got }])} />
      ))}
    </div>
  )
}
