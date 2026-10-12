// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { graphicalCommands } from '../../server/src/domain/chat/structured-result'
import ChatResult from './ChatResult'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it.each(graphicalCommands)('renders authoritative %s data without executing an action', command => {
  const container = document.createElement('div'), root = createRoot(container)
  try {
    act(() => root.render(<ChatResult value={{ version: 1, command, title: 'Résultat figé', source: { channel: 'INTERNAL_CHAT', commandMessageId: 'id' }, characters: [{ id: 'furina', name: 'Furina', portrait: '/assets/characters/furina.png', rarity: 5, constellation: 2, previousConstellation: 1, isNew: true }], facts: ['Coût figé : 160 Primos'] }} />))
    expect(container.querySelector('section')?.getAttribute('aria-label')).toContain('!' + command)
    expect(container.textContent).toContain('C1 → C2')
    expect(container.textContent).toContain('Nouveau')
    expect(container.textContent).toContain('Coût figé : 160 Primos')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/characters/furina.png')
    expect(container.querySelector('button')).toBeNull()
    act(() => root.render(<ChatResult value={{ version: 0 }} />))
    expect(container.innerHTML).toBe('')
  } finally { act(() => root.unmount()) }
})
