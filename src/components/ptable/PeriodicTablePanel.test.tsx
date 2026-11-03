// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '@/engine/chem/elements'
import { PeriodicTablePanel } from './PeriodicTablePanel'
import { TRANSURANICS } from './transuranics'

function cellFor(symbol: string): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(`[data-ptable-cell="${symbol}"]`)
  if (!el) throw new Error(`missing cell for ${symbol}`)
  return el
}

function detailCard(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-ptable-detail]')
}

describe('PeriodicTablePanel', () => {
  it('renders 118 cells and every ELEMENTS and TRANSURANICS symbol appears once', () => {
    render(<PeriodicTablePanel />)
    expect(document.querySelector('[data-ptable]')).toBeTruthy()

    const cells = document.querySelectorAll<HTMLButtonElement>('[data-ptable-cell]')
    expect(cells).toHaveLength(118)

    const seen = new Set<string>()
    for (const el of [...ELEMENTS, ...TRANSURANICS]) {
      const matching = document.querySelectorAll(`[data-ptable-cell="${el.symbol}"]`)
      expect(matching).toHaveLength(1)
      const btn = matching[0] as HTMLButtonElement
      expect(btn.getAttribute('aria-label')).toBe(`${el.name}, ${el.symbol}, ${el.z}`)
      expect(btn.textContent).toContain(String(el.z))
      expect(btn.textContent).toContain(el.symbol)
      seen.add(el.symbol)
    }
    expect(seen.size).toBe(118)
  })

  it('clicking the K cell shows Potassium, 39.098, period 4, group 1, and 1+', () => {
    render(<PeriodicTablePanel />)
    expect(detailCard()).toBeNull()

    fireEvent.click(cellFor('K'))
    const detail = detailCard()
    expect(detail).toBeTruthy()
    expect(detail!.textContent).toContain('Potassium')
    expect(detail!.textContent).toContain('K')
    expect(detail!.textContent).toContain('19')
    expect(detail!.textContent).toContain('39.098')
    expect(within(detail!).getByText('Period').parentElement?.textContent).toContain('4')
    expect(within(detail!).getByText('Group').parentElement?.textContent).toContain('1')
    expect(within(detail!).getByText('Class').parentElement?.textContent).toContain('metal')
    expect(within(detail!).getByText('Common ion charge(s)').parentElement?.textContent).toContain('1+')
  })

  it('formats radioactive mass numbers in brackets for Tc ("[98]") and unbracketed standard weights for U ("238.03")', () => {
    render(<PeriodicTablePanel />)

    fireEvent.click(cellFor('Tc'))
    let detail = detailCard()!
    expect(detail.textContent).toContain('Technetium')
    expect(within(detail).getByText('Atomic mass').parentElement?.textContent).toContain('[98]')

    fireEvent.click(cellFor('U'))
    detail = detailCard()!
    expect(detail.textContent).toContain('Uranium')
    const massText = within(detail).getByText('Atomic mass').parentElement?.textContent ?? ''
    expect(massText).toContain('238.03')
    expect(massText).not.toContain('[238.03]')
    expect(within(detail).getByText('Group').parentElement?.textContent).toContain('actinide')
  })

  it('searches by symbol and name substring: "fe" selects and highlights iron; "xx" clears selection without crashing', () => {
    render(<PeriodicTablePanel />)
    const input = screen.getByLabelText('Find an element')

    fireEvent.change(input, { target: { value: 'fe' } })
    const feCell = cellFor('Fe')
    expect(feCell.getAttribute('data-highlighted')).toBe('true')
    expect(feCell.className).toContain('ring-2')
    expect(detailCard()).toBeTruthy()
    expect(detailCard()!.textContent).toContain('Iron')
    expect(detailCard()!.textContent).toContain('55.845')
    expect(detailCard()!.textContent).toContain('3+ or 2+')

    fireEvent.change(input, { target: { value: 'xx' } })
    expect(detailCard()).toBeNull()
    expect(document.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0)

    fireEvent.change(input, { target: { value: 'ium' } })
    const iumMatches = document.querySelectorAll('[data-highlighted="true"]')
    expect(iumMatches.length).toBeGreaterThan(1)
    expect(detailCard()).toBeNull()

    fireEvent.change(input, { target: { value: '' } })
    expect(document.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0)
  })

  it('omits the Common ion charge(s) row when commonCharges is empty (e.g. Ne)', () => {
    render(<PeriodicTablePanel />)
    fireEvent.click(cellFor('Ne'))
    const detail = detailCard()!
    expect(detail.textContent).toContain('Neon')
    expect(within(detail).getByText('Class').parentElement?.textContent).toContain('nonmetal')
    expect(within(detail).queryByText('Common ion charge(s)')).toBeNull()

    fireEvent.click(cellFor('H'))
    expect(within(detailCard()!).getByText('Common ion charge(s)').parentElement?.textContent).toContain('1+ or 1−')
  })

  it('places H at col 1 row 1, He at col 18 row 1, La in the lanthanide row, and Og at col 18 row 7', () => {
    render(<PeriodicTablePanel />)

    const h = cellFor('H')
    expect(h.style.gridColumn).toBe('1')
    expect(h.style.gridRow).toBe('1')

    const he = cellFor('He')
    expect(he.style.gridColumn).toBe('18')
    expect(he.style.gridRow).toBe('1')

    const la = cellFor('La')
    const lu = cellFor('Lu')
    const ac = cellFor('Ac')
    const laRow = Number(la.style.gridRow)
    const acRow = Number(ac.style.gridRow)
    expect(laRow).toBeGreaterThan(7)
    expect(Number(lu.style.gridRow)).toBe(laRow)
    expect(acRow).toBe(laRow + 1)

    fireEvent.click(la)
    expect(within(detailCard()!).getByText('Group').parentElement?.textContent).toContain('lanthanide')

    const og = cellFor('Og')
    expect(og.style.gridColumn).toBe('18')
    expect(og.style.gridRow).toBe('7')
    fireEvent.click(og)
    expect(within(detailCard()!).getByText('Class').parentElement?.textContent).toContain('metal')
  })
})
