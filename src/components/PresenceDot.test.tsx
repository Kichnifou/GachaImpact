// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import PresenceDot from './PresenceDot'
import PlayerIdentity from '../social/PlayerIdentity'
import { presenceLabels } from '../social/types'

it('renders authorized presence accessibly, retains Social text and never invents PRIVATE offline presence', () => {
  const container = document.createElement('div'), root = createRoot(container)
  try {
    for (const status of ['ONLINE','AWAY','OFFLINE'] as const) {
      const presence = { access: 'ALLOWED' as const, data: status }
      act(() => root.render(<><PlayerIdentity player={{ id:'p',displayName:'Axel',elementKey:'hydro',level:10,presence }} status={presenceLabels[status]} onOpen={() => {}} /><div data-mp><strong>Axel<PresenceDot presence={presence} /></strong></div></>))
      expect(container.querySelectorAll('.presence-dot-' + status.toLowerCase())).toHaveLength(2)
      expect(container.querySelector('.social-presence-label')?.textContent).toBe(presenceLabels[status])
      expect(container.querySelector('[data-mp]')?.textContent).toBe('Axel')
      expect(container.querySelector('[data-mp] .presence-dot')?.getAttribute('aria-label')).toBe(presenceLabels[status])
    }
    act(() => root.render(<PresenceDot presence={{ access:'PRIVATE' }} />))
    expect(container.childElementCount).toBe(0)
  } finally { act(() => root.unmount()) }
})
