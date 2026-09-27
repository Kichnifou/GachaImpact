import { useEffect } from 'react'

const NORMAL_TITLE = 'GachaImpact'
const BLINK_MS = 1_350

/** Uses the MP unread total already owned by ChatPanel. No browser notification permission is requested. */
export function useDirectMessageDocumentTitle(unreadCount: number, playerId: string) {
  useEffect(() => {
    if (unreadCount <= 0) { document.title = NORMAL_TITLE; return () => { document.title = NORMAL_TITLE } }
    const alert = unreadCount === 1 ? 'Vous avez 1 nouveau message !' : 'Vous avez de nouveaux messages !'
    document.title = alert
    let showNormal = true
    const timer = window.setInterval(() => { document.title = showNormal ? NORMAL_TITLE : alert; showNormal = !showNormal }, BLINK_MS)
    return () => { window.clearInterval(timer); document.title = NORMAL_TITLE }
  }, [playerId, unreadCount])
}
