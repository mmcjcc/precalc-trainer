/**
 * Figure specs for the fence problems (drawn by components/OptFigure). The words describe the picture and never an
 * answer: which sides are fenced and which letter each side has, no lengths, and the drawing is not to scale.
 */
import type { OptFigureSpec } from '@/content/types'
import { countWord } from './text'

export interface PenFigureOptions {
  /** Pens in the row (1 for a single pen). */
  pens: number
  /** A single pen with a divider (drawn as two halves, one side along the whole row). */
  divider?: boolean
  wall: boolean
  /** The wall's name: "stone wall", "barn". */
  wallLabel: string
  /** The letter of the sides across the row (the ends and dividers) and of the sides along it. */
  across: 'x' | 'y'
  along: 'x' | 'y'
  /** "pen", "corral", "kennel". */
  noun: string
}

export function penFigure(o: PenFigureOptions): OptFigureSpec {
  const pens = o.divider ? 2 : o.pens
  const whole = Boolean(o.divider)
  let aria: string
  if (o.divider) {
    aria = `A rectangular ${o.noun} with ${o.wall ? `the ${o.wallLabel} along its top side` : 'fence all around'}, split in two by a fence from the ${o.wallLabel} to the far side. The two ends and the dividing fence are labelled ${o.across}, and the side across from the ${o.wallLabel} is labelled ${o.along}.`
  } else if (pens === 1) {
    aria = `A rectangular ${o.noun} with the ${o.wallLabel} along its top side and fence on the other three sides. The two sides that meet the ${o.wallLabel} are labelled ${o.across}, and the side across from the ${o.wallLabel} is labelled ${o.along}.`
  } else {
    const between = pens - 1
    const fencesAcross = `the two ends and the ${between === 1 ? 'one' : countWord(between)} between neighbours`
    aria = o.wall
      ? `${capital(countWord(pens))} identical rectangular ${o.noun}s side by side along the ${o.wallLabel}, which runs along their top sides. Every fence across the row (${fencesAcross}) is labelled ${o.across}, and each ${o.noun}’s side across from the ${o.wallLabel} is labelled ${o.along}.`
      : `${capital(countWord(pens))} identical rectangular ${o.noun}s side by side in a row, sharing the fences between them. Every fence across the row (${fencesAcross}) is labelled ${o.across}, and each ${o.noun}’s top side and bottom side are labelled ${o.along}.`
  }
  return { pens, whole, wall: o.wall, wallLabel: o.wallLabel, across: o.across, along: o.along, ariaLabel: `${aria} Not drawn to scale.` }
}

function capital(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}
