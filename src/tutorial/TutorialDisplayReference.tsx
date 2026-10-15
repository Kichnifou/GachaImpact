import { useEffect, useRef, useState } from 'react'

// Requested only when this tutorial step is mounted. The revision renews CDN/browser caches.
export const tutorialReferenceUrl = '/assets/tutorial/display-reference.webp?v=r1094'
export default function TutorialDisplayReference() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    const timeout = window.setTimeout(() => setState(current => current === 'loading' ? 'error' : current), 8000)
    return () => { active.current = false; window.clearTimeout(timeout) }
  }, [])
  return <figure className={`tutorial-reference tutorial-reference-${state}`} aria-busy={state === 'loading'}>
    {state === 'loading' && <p role="status">Chargement de l’image de référence…</p>}
    {state === 'error' ? <p role="status">L’image de référence n’a pas pu être chargée. Vous pouvez poursuivre le tutoriel.</p> :
      <img src={tutorialReferenceUrl} width="1600" height="791" loading="eager" fetchPriority="high" decoding="async" hidden={state !== 'ready'}
        alt="Capture de référence de l’Accueil : sidebar complète à gauche, bannière et raccourcis au centre, Communauté à droite."
        onLoad={async event => {
          const img = event.currentTarget
          try { await img.decode(); if (active.current) setState(current => current === 'loading' ? 'ready' : current) }
          catch { if (active.current) setState('error') }
        }} onError={() => setState('error')} />}
  </figure>
}
