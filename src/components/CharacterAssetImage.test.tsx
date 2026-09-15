// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/gameAssets', () => ({
  DEFAULT_CHARACTER_ASSET_ORDER: ['iconPath', 'fullbodyPath', 'wishPath', 'splashPath'],
  useCharacterAssetPaths: (name: string) => name === 'Émilie' ? ['/assets/emilie-discovered.png'] : [],
}))

import CharacterAssetImage from './CharacterAssetImage'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => document.body.replaceChildren())

function render(assetPaths: readonly (string | null)[]) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(<CharacterAssetImage characterName="Émilie" className="portrait" assetPaths={assetPaths} />))
  return { container, root }
}

describe('CharacterAssetImage', () => {
  it('uses discovery when the provided participant portrait contains no usable path', () => {
    const { container, root } = render([null, ''])
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/emilie-discovered.png')
    expect(container.textContent).toBe('')
    act(() => container.querySelector('img')!.dispatchEvent(new Event('load')))
    expect(container.textContent).toBe('')
    act(() => root.unmount())
  })

  it('prioritizes Émilie explicit paths, then continues through discovery without a textual fallback', () => {
    const { container, root } = render(['/assets/broken-explicit.png'])
    const image = () => container.querySelector<HTMLImageElement>('img')
    expect(image()?.getAttribute('src')).toBe('/assets/broken-explicit.png')
    act(() => image()!.dispatchEvent(new Event('error')))
    expect(image()?.getAttribute('src')).toBe('/assets/emilie-discovered.png')
    expect(container.textContent).toBe('')
    act(() => image()!.dispatchEvent(new Event('error')))
    expect(image()).toBeNull()
    expect(container.textContent).toBe('')
    act(() => root.unmount())
  })
})
