import { useEffect } from 'react'

const NORMAL_TITLE = 'GachaImpact'
const BLINK_MS = 1_350

/** Uses the MP unread total already owned by ChatPanel. No browser notification permission is requested. */
export function useDirectMessageDocumentTitle(unreadCount: number, playerId: string) {
  useEffect(() => {
    const alert = unreadCount === 1 ? 'Vous avez 1 nouveau message !' : 'Vous avez de nouveaux messages !'
    let timer: number | undefined
    const stop = () => { window.clearInterval(timer); timer = undefined; document.title = NORMAL_TITLE }
    const update = () => {
      stop()
      // Without a reliable visibility signal, keep the normal title conservatively.
      const hidden = document.visibilityState === 'hidden' || (!document.visibilityState && document.hidden === true)
      if (unreadCount <= 0 || !hidden) return
      document.title = alert
      let showNormal = true
      timer = window.setInterval(() => { document.title = showNormal ? NORMAL_TITLE : alert; showNormal = !showNormal }, BLINK_MS)
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => { document.removeEventListener('visibilitychange', update); stop() }
  }, [playerId, unreadCount])
}
