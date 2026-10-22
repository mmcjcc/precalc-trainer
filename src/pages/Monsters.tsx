import { useCallback, useId, useMemo, useState } from 'react'
import { useMotionAllowed } from '@/components/juice/motion'
import { monsterCollection, monsterStateWords, tallyLine, type MonsterEntry, type SpeciesEntry } from '@/components/monsters/collection'
import { MonsterArt } from '@/components/monsters/MonsterArt'
import { MonsterCardDialog, RareSparkles, SquashPips } from '@/components/monsters/MonsterCard'
import { speciesForEdition } from '@/components/monsters/species'
import { useBreakpoint } from '@/components/useBreakpoint'
import { STORE } from '@/edition'
import { useRewards, useRewardsOn } from '@/store'

/** A monster's tile in words (its accessible name): rare or not, its species, its mistake, how it stands. */
export function tileName(species: string, m: MonsterEntry): string {
  return `${m.rare ? 'Rare. ' : ''}${species}: ${m.title}. ${monsterStateWords(m)}.`
}

function speciesCounts(entry: SpeciesEntry): string {
  if (entry.squashed + entry.onTheLoose === 0) return 'None caught yet'
  return `${entry.squashed} squashed · ${entry.onTheLoose} on the loose`
}

function MonsterTile({ m, speciesName, motion, onOpen }: { m: MonsterEntry; speciesName: string; motion: boolean; onOpen: (id: string, from: HTMLElement) => void }) {
  if (m.status === 'unseen') {
    // Not seen yet: its species' dark outline with a "?" (one line per species tells a screen reader how many).
    return (
      <li aria-hidden="true" data-monster-tile={m.id} data-status="unseen">
        <span className="flex min-h-[5.5rem] items-center justify-center rounded-xl border border-dashed border-navy-100 bg-navy-50">
          <MonsterArt id={m.id} size={56} silhouette />
        </span>
      </li>
    )
  }
  const squashed = m.status === 'squashed'
  return (
    <li data-monster-tile={m.id} data-status={m.status} data-rare={m.rare ? '' : undefined}>
      <button
        type="button"
        onClick={(e) => onOpen(m.id, e.currentTarget)}
        aria-haspopup="dialog"
        aria-label={tileName(speciesName, m)}
        className={`relative flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 hover:bg-navy-50 ${
          squashed ? 'border-2 border-gold bg-gold-100' : 'border border-navy-100 bg-white'
        } ${m.rare ? 'monster-rare' : ''}`}
      >
        <MonsterArt id={m.id} size={56} />
        <span className="flex items-center gap-1">
          <SquashPips pips={m.pips} squashed={squashed} />
          {m.count > 1 && <span className="text-[11px] font-semibold leading-none text-navy/80">×{m.count}</span>}
        </span>
        {m.rare && <RareSparkles motion={motion} />}
      </button>
    </li>
  )
}

function SpeciesSection({ entry, motion, onOpen }: { entry: SpeciesEntry; motion: boolean; onOpen: (id: string, from: HTMLElement) => void }) {
  const titleId = useId()
  const { species, monsters } = entry
  const seen = entry.squashed + entry.onTheLoose
  const unseen = monsters.length - seen
  // A species she has met is open; the others are one line each, their outline in the dark. The tiles are drawn only
  // while it is open (a closed details keeps its content in the page: hundreds of pictures on a phone).
  const [open, setOpen] = useState(seen > 0)
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-navy-100 bg-white" data-species={species.id}>
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl p-3 hover:bg-navy-50 [&::-webkit-details-marker]:hidden">
          <MonsterArt species={species.id} size={52} silhouette={seen === 0} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <h2 id={titleId} className="font-semibold text-navy">
              {species.name}
            </h2>
            <span className="block text-sm text-navy/80">{species.personality}</span>
            <span className="mt-0.5 block text-sm font-semibold text-navy" data-species-counts="">
              {speciesCounts(entry)}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-lg text-navy/70">
            ›
          </span>
        </summary>
        {open && (
          <div className="px-3 pb-3">
            <ul aria-label={`${species.name}: its monsters`} className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {monsters.map((m) => (
                <MonsterTile key={m.id} m={m} speciesName={species.name} motion={motion} onOpen={onOpen} />
              ))}
            </ul>
            {unseen > 0 && <p className="sr-only">{unseen === 1 ? '1 more not caught yet' : `${unseen} more not caught yet`}</p>}
          </div>
        )}
      </details>
    </section>
  )
}

/**
 * The Monsters tab (docs/progress/phone-monsters.md): every named mistake is a monster. Making a mistake catches it,
 * three clean problems of its type squash it, and the collection fills in, species by species: caught in colour with
 * how many times and its squash pips, squashed in a gold frame, not seen yet as a dark outline with a "?". A tile opens
 * the monster's card. The store app shows the math species; rewards off, it is the same collection with no XP.
 */
export function MonstersPage() {
  const view = useRewards()
  const rewards = useRewardsOn()
  const motion = useMotionAllowed()
  const phone = useBreakpoint() === 'mobile'
  const collection = useMemo(() => monsterCollection(view.cards, speciesForEdition(STORE)), [view.cards])
  const [open, setOpen] = useState<{ id: string; from: HTMLElement } | null>(null)
  const onOpen = useCallback((id: string, from: HTMLElement) => setOpen({ id, from }), [])
  const close = useCallback(() => setOpen(null), [])
  const shown = open ? collection.species.flatMap((s) => s.monsters.map((m) => ({ m, s }))).find((x) => x.m.id === open.id) : undefined
  const none = collection.squashed + collection.onTheLoose === 0

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-navy">Monsters</h1>
        <p className="max-w-2xl text-navy/80">
          Every mistake the checker names is a monster. Make one and you catch it; three clean problems of that type squash
          it.
        </p>
        <p className="text-lg font-semibold text-navy" data-monster-tally="">
          {tallyLine(collection)}
        </p>
        {none && (
          <p className="max-w-2xl text-sm text-navy/80">
            None caught yet. The first time the checker names one of your mistakes, its monster shows up right there in the
            check, and lands here.
          </p>
        )}
      </header>
      <div className="space-y-3">
        {collection.species.map((entry) => (
          <SpeciesSection key={entry.species.id} entry={entry} motion={motion} onOpen={onOpen} />
        ))}
      </div>
      {open && shown && (
        <MonsterCardDialog
          monster={shown.m}
          species={shown.s.species}
          variant={phone ? 'sheet' : 'modal'}
          rewards={rewards}
          motion={motion}
          returnFocus={open.from}
          onClose={close}
        />
      )}
    </div>
  )
}

export default MonstersPage
