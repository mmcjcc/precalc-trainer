import { describe, expect, it } from 'vitest'
import { tokenizeKeys } from './calcKeys'

describe('tokenizeKeys', () => {
  it('renders key names as keycaps, assignments as code, arrows between segments', () => {
    expect(tokenizeKeys('Y= → Y1 = ³√(7X+3)-1')).toEqual([
      { kind: 'kbd', text: 'Y=' },
      { kind: 'arrow', text: '→' },
      { kind: 'code', text: 'Y1 = ³√(7X+3)-1' },
    ])
  })

  it('keeps prose as text and picks out menu items', () => {
    expect(tokenizeKeys('ZOOM → 6:ZStandard, then ZOOM → 5:ZSquare')).toEqual([
      { kind: 'kbd', text: 'ZOOM' },
      { kind: 'arrow', text: '→' },
      { kind: 'kbd', text: '6:ZStandard' },
      { kind: 'text', text: ', then' },
      { kind: 'kbd', text: 'ZOOM' },
      { kind: 'arrow', text: '→' },
      { kind: 'kbd', text: '5:ZSquare' },
    ])
  })

  it('handles Nspire wording', () => {
    const t = tokenizeKeys('menu → Window/Zoom → Zoom – Standard')
    expect(t[0]).toEqual({ kind: 'kbd', text: 'menu' })
    expect(t.filter((x) => x.kind === 'text').map((x) => x.text)).toEqual(['Window/Zoom', 'Zoom – Standard'])
  })
})
