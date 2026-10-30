/**
 * Guided mode's switch and cards, shared by every line-by-line flow that offers a card source.
 * ON = pick the next line from the cards (composer typing hidden). OFF = she types, and the cards stay
 * in Hints. Flipping mid-problem does not drop her work; the setting is `settings.lineEntry`.
 */
import { useEffect, useMemo } from 'react'
import { lineCardsFor, offersLineCards, stepTypeOf } from './cardSources'
import type { LineCard } from './lineCards'
import { typeThisTime, useStore, type Attempt, type LineEntry } from '@/store'
import type { ProblemInstance } from '@/content/types'

export function useGuidedCards(opts: {
  instance: ProblemInstance
  attempt: Attempt | null
  previous: string
  live: boolean
  nextText: string | null
  /** Override the picks/hint key (even/odd slots use disjoint ranges). Default: the step count. */
  lineKey?: number
}): {
  offers: boolean
  guidedOn: boolean
  picking: boolean
  showingCards: boolean
  cards: LineCard[]
  cardsLeft: LineCard[]
  lineKey: number
  stepType: string | null
  mustType: boolean
  pickOffer: (() => void) | null
  typedNote: string | null
  endOfPath: boolean
  typing: boolean
  chooseGuide: (on: boolean) => void
  typeInstead: () => void
  backToCards: () => void
} {
  const { instance, attempt, previous, live, nextText } = opts
  const lineKey = opts.lineKey ?? attempt?.steps.length ?? 0
  const offers = offersLineCards(instance)
  const lineEntry: LineEntry = useStore((s) => s.settings.lineEntry) === 'pick' ? 'pick' : 'type'
  const guidedOn = offers && lineEntry === 'pick'
  const picking = guidedOn
  const picks = attempt?.picks?.[String(lineKey)]
  const stepType = useMemo(
    () => (offers && nextText !== null ? stepTypeOf(instance, previous, nextText) : null),
    [offers, nextText, previous, instance],
  )
  const events = useStore((s) => s.events)
  const mustType = useMemo(() => offers && typeThisTime(events, stepType), [offers, events, stepType])
  const wantCards = offers && live && nextText !== null && (picks !== undefined || !mustType)
  const cards = useMemo(
    () => (wantCards ? lineCardsFor(instance, previous, lineKey) : []),
    [wantCards, instance, previous, lineKey],
  )
  const cardsLeft = useMemo(() => cards.filter((c) => c.right || !(picks?.wrong ?? []).includes(c.text)), [cards, picks])
  const showingCards = cards.length > 0 && (picks ? !picks.typing : picking && !mustType)

  useEffect(() => {
    if (showingCards && !picks) useStore.getState().showCards(lineKey)
  }, [showingCards, picks, lineKey])

  function chooseGuide(on: boolean) {
    const next: LineEntry = on ? 'pick' : 'type'
    const s = useStore.getState()
    s.setSettings({ lineEntry: next })
    if (picks) s.typeCardLine(next === 'type', lineKey)
  }

  function typeInstead() {
    useStore.getState().typeCardLine(true, lineKey)
  }

  function backToCards() {
    useStore.getState().typeCardLine(false, lineKey)
  }

  const pickOffer = !picking && live && cards.length > 0 && !picks ? () => useStore.getState().showCards(lineKey) : null

  let typedNote: string | null = null
  let endOfPath = false
  if (offers && live && !showingCards) {
    if (picks) typedNote = 'You saw the cards for this line, so it counts as a picked line.'
    else if (picking && mustType) typedNote = 'You picked this one right twice: type it this time.'
    else if (picking && nextText === null) {
      typedNote = 'That was the last line of the path: write the solution in the answer box.'
      endOfPath = true
    } else if (picking) typedNote = 'No cards for this line: type it.'
  }

  return {
    offers,
    guidedOn,
    picking,
    showingCards,
    cards,
    cardsLeft,
    lineKey,
    stepType,
    mustType,
    pickOffer,
    typedNote,
    endOfPath,
    typing: Boolean(picks?.typing),
    chooseGuide,
    typeInstead,
    backToCards,
  }
}
