// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import PlayerAvatar from './PlayerAvatar'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
describe('PlayerAvatar', () => {
  it('renders an immutable catalogue avatar from our Supabase project', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co')
    const path = 'https://fixture.supabase.co/storage/v1/object/public/character-catalog/characters/00000000-0000-4000-8000-000000000001/icon/' + 'a'.repeat(64) + '.png'
    const container = document.createElement('div'), root = createRoot(container)
    try { act(() => root.render(<PlayerAvatar displayName="Aster" elementKey="hydro" avatarAssetPath={path} />)); expect(container.querySelector('img')?.getAttribute('src')).toBe(path) }
    finally { act(() => root.unmount()); vi.unstubAllEnvs() }
  })
  it('prefers an official equipped asset, then the element, then the initial on image errors', () => {
    const container = document.createElement('div'); const root = createRoot(container)
    try {
      act(() => root.render(<PlayerAvatar displayName="Élodie" elementKey="pyro" avatarAssetPath="/assets/official/avatar.webp" />))
      expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/official/avatar.webp')
      act(() => container.querySelector('img')!.dispatchEvent(new Event('error')))
      expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/genshin/elements/pyro.png')
      act(() => container.querySelector('img')!.dispatchEvent(new Event('error')))
      expect(container.querySelector('img')).toBeNull()
      expect(container.textContent).toBe('É')
    } finally { act(() => root.unmount()) }
  })
  it('ignores external and traversal asset paths', () => {
    const container = document.createElement('div'); const root = createRoot(container)
    try {
      act(() => root.render(<PlayerAvatar displayName="Aster" elementKey={null} avatarAssetPath="https://example.com/avatar.png" />))
      expect(container.querySelector('img')).toBeNull()
      expect(container.textContent).toBe('A')
      act(() => root.render(<PlayerAvatar displayName="Aster" elementKey="hydro" avatarAssetPath="/assets/../secret.png" />))
      expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/genshin/elements/hydro.png')
    } finally { act(() => root.unmount()) }
  })
})
