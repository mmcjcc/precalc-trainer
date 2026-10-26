// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OrbitalId } from '@/content/types'
import { OrbitalFigure } from './OrbitalFigure'

const PICTURES: { id: OrbitalId; aria: string; lobes: number; sphere: boolean; ring: boolean; forbidden: RegExp }[] = [
  { id: 's', aria: 'A sphere, the same in every direction', lobes: 0, sphere: true, ring: false, forbidden: /\bs\b/ },
  { id: 'px', aria: 'Two lobes, along the x axis', lobes: 2, sphere: false, ring: false, forbidden: /\bpx\b/ },
  { id: 'py', aria: 'Two lobes, along the y axis', lobes: 2, sphere: false, ring: false, forbidden: /\bpy\b/ },
  { id: 'pz', aria: 'Two lobes, along the z axis', lobes: 2, sphere: false, ring: false, forbidden: /\bpz\b/ },
  { id: 'dxy', aria: 'Four lobes, between the x and y axes', lobes: 4, sphere: false, ring: false, forbidden: /\bdxy\b/ },
  { id: 'dxz', aria: 'Four lobes, between the x and z axes', lobes: 4, sphere: false, ring: false, forbidden: /\bdxz\b/ },
  { id: 'dyz', aria: 'Four lobes, between the y and z axes', lobes: 4, sphere: false, ring: false, forbidden: /\bdyz\b/ },
  { id: 'dx2y2', aria: 'Four lobes, along the x and y axes', lobes: 4, sphere: false, ring: false, forbidden: /dx²−y²|dx2-y2|dx2y2/ },
  { id: 'dz2', aria: 'Two lobes along the z axis, with a ring in the xy plane', lobes: 2, sphere: false, ring: true, forbidden: /dz²|dz2/ },
]

describe('OrbitalFigure', () => {
  it.each(PICTURES)('$id draws labelled axes and describes the picture, not the name', (picture) => {
    const view = render(<OrbitalFigure orbital={picture.id} />)
    const fig = view.getByRole('img')
    expect(fig.getAttribute('aria-label')).toBe(picture.aria)
    expect(fig.getAttribute('aria-label') ?? '').not.toMatch(picture.forbidden)
    const labels = [...fig.querySelectorAll('text')].map((node) => node.textContent)
    expect(labels.sort()).toEqual(['x', 'y', 'z'])
    expect(fig.querySelectorAll('[data-lobe]')).toHaveLength(picture.lobes)
    expect(fig.querySelectorAll('[data-sphere]')).toHaveLength(picture.sphere ? 1 : 0)
    expect(fig.querySelectorAll('[data-ring]')).toHaveLength(picture.ring ? 1 : 0)
  })
})
