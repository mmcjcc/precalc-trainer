// @vitest-environment jsdom
/**
 * The art on the page (MonsterArt.tsx): each variant's SVG parses as SVG (no parser error), the component draws the
 * same shapes as the pure model, and it is decorative (hidden from screen readers, never focusable).
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { artMarkup, monsterArt, pathData, speciesArt } from './art'
import { MonsterArt } from './MonsterArt'
import { SPECIES } from './species'

const SVG_NS = 'http://www.w3.org/2000/svg'

describe('the art as SVG', () => {
  it('every variant, every silhouette and sticker parses as SVG, one element per shape', () => {
    const parser = new DOMParser()
    const check = (markup: string, shapes: number) => {
      const doc = parser.parseFromString(markup, 'image/svg+xml')
      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
      expect(doc.documentElement.namespaceURI).toBe(SVG_NS)
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 100 100')
      expect(doc.documentElement.children).toHaveLength(shapes)
    }
    for (const s of SPECIES) {
      for (const id of s.variants) {
        const art = monsterArt(id)!
        check(artMarkup(art), art.shapes.length)
      }
      for (const opts of [{ silhouette: true }, { sticker: true }]) {
        const art = speciesArt(s.id, opts)!
        check(artMarkup(art), art.shapes.length)
      }
    }
  })

  it('the component draws the model’s shapes, decorative', () => {
    const { container } = render(<MonsterArt id="no_sign_flip" size={64} className="x" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.getAttribute('width')).toBe('64')
    expect(svg.getAttribute('data-monster')).toBe('no_sign_flip')
    const art = monsterArt('no_sign_flip')!
    expect(svg.children).toHaveLength(art.shapes.length)
    const paths = [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'))
    expect(paths).toEqual(art.shapes.filter((s) => s.kind === 'path').map((s) => (s.kind === 'path' ? pathData(s.d) : '')))
  })

  it('a silhouette is its species’ own; nothing for an id that is not a monster', () => {
    const { container } = render(
      <>
        <MonsterArt id="flip_on_add" size={40} silhouette />
        <MonsterArt id="abandoned" size={40} />
        <MonsterArt species="log" size={40} />
      </>,
    )
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(2)
    expect(svgs[0]!.hasAttribute('data-silhouette')).toBe(true)
    expect(svgs[0]!.innerHTML).toBe(render(<MonsterArt id="no_sign_flip" size={40} silhouette />).container.querySelector('svg')!.innerHTML)
    expect(svgs[1]!.getAttribute('data-monster')).toBe('log')
  })
})
