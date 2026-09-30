import { useCallback, useEffect, useState } from 'react'
import type { GiveawayStateDto } from '../api/types'
import { getGameApiClient } from '../api/game-api'
import { apiErrorMessage } from '../utils/formatters'
import AppButton from './AppButton'
import { useModalDialog } from './useModalDialog'

const announcementLabel: Record<string, string> = { OPEN: 'Ouverture', RESULT: 'Résultat du tirage', RANKING: 'Classement activité' }
const sendLabel: Record<string, string> = { PENDING: 'À envoyer', RESERVED: 'Envoi incertain après interruption', SENT: 'Envoyé', FAILED: 'Échec certain', AMBIGUOUS: 'Envoi ambigu : vérifier Twitch' }

function CloseConfirmation({ pending, onCancel, onConfirm }: { pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useModalDialog<HTMLDivElement>(onCancel)
  return <div className="giveaway-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onCancel() }}>
    <div ref={ref} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="giveaway-close-title" className="giveaway-confirm">
      <h3 id="giveaway-close-title">Fermer le Giveaway ?</h3>
      <p>La fermeture fige la session, tire le gagnant et distribue immédiatement les récompenses. Aucun nouveau tirage ne sera possible.</p>
      <div className="giveaway-actions"><AppButton disabled={pending} onClick={onCancel}>Annuler</AppButton>
        <AppButton variant="danger" disabled={pending} aria-busy={pending} onClick={onConfirm}>{pending ? 'Fermeture…' : 'Confirmer la fermeture'}</AppButton></div>
    </div>
  </div>
}

export default function GiveawayAdminPanel({ admin }: { admin: boolean }) {
  const api = getGameApiClient()
  const [state, setState] = useState<GiveawayStateDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [clock, setClock] = useState(Date.now())
  const refresh = useCallback(async () => { setState(await api.getGiveawayState()) }, [api])
  useEffect(() => {
    let alive = true
    void api.getGiveawayState().then(value => { if (alive) setState(value) }).catch(reason => { if (alive) setError(apiErrorMessage(reason)) }).finally(() => { if (alive) setLoading(false) })
    const poll = window.setInterval(() => { if (alive) void api.getGiveawayState().then(value => { if (alive) setState(value) }).catch(() => undefined) }, 10_000)
    const tick = window.setInterval(() => setClock(Date.now()), 1_000)
    return () => { alive = false; window.clearInterval(poll); window.clearInterval(tick) }
  }, [api])
  const run = async (action: () => Promise<unknown>) => {
    if (pending) return
    setPending(true); setError(null)
    try { await action(); await refresh() }
    catch (reason) { setError(apiErrorMessage(reason)); try { await refresh() } catch { /* Keep the original error. */ } }
    finally { setPending(false) }
  }
  const authorize = () => void run(async () => {
    const { url } = await api.startTwitchGiveaway()
    const target = new URL(url)
    if (target.origin !== 'https://id.twitch.tv' || target.pathname !== '/oauth2/authorize' || target.username || target.password) throw new Error('URL Twitch invalide.')
    window.location.assign(target.toString())
  })
  const session = state?.session
  const bridge = state?.bridge
  const open = session?.status === 'OPEN'
  const duration = open && session.openedAt ? Math.max(0, Math.floor((clock - Date.parse(session.openedAt)) / 1000)) : 0
  const resultAnnouncements = session?.announcements.filter(row => announcementLabel[row.kind]) ?? []

  return <section className="panel giveaway-admin-panel" aria-busy={loading || pending}>
    <header><div><span className="eyebrow">Twitch · Modération</span><h2>Giveaway / Wish</h2></div>
      <AppButton disabled={pending || loading} onClick={() => void run(refresh)}>Actualiser</AppButton></header>
    {error && <p className="configuration-error" role="alert">{error}</p>}
    {loading ? <p role="status">Chargement du Giveaway…</p> : <>
      <div className="giveaway-summary">
        <p><strong>Bridge :</strong> {bridge?.active ? '● Actif' : bridge?.pending ? 'Vérification Twitch en cours' : bridge?.error ? 'État Twitch inconnu' : bridge?.available ? 'Inactif' : 'Indisponible'}{bridge?.error ? ` · ${bridge.error}` : ''}</p>
        <p><strong>Session :</strong> {open ? 'Ouverte' : session ? 'Fermée' : 'Aucune session native'}</p>
        {session && <><p><strong>Ouvert par :</strong> {session.openedBy ?? 'Inconnu'}</p><p><strong>Ouvert le :</strong> {session.openedAt ? new Date(session.openedAt).toLocaleString('fr-FR') : 'Inconnu'}</p>
          {open && <p><strong>Durée :</strong> {Math.floor(duration / 60)} min {duration % 60} s</p>}
          <p><strong>Participants !wish :</strong> {session.participantCount}</p><p><strong>Chatters éligibles :</strong> {session.chatterCount}</p>
          {!open && <p><strong>Gagnant :</strong> {session.winner ?? 'Aucun'}</p>}</>}
      </div>
      <div className="giveaway-actions">
        <AppButton variant="primary" disabled={pending || !bridge?.active || open} onClick={() => void run(() => api.openGiveaway(crypto.randomUUID()))}>Ouvrir</AppButton>
        <AppButton variant="danger" disabled={pending || !open} onClick={() => setConfirmClose(true)}>Fermer</AppButton>
        {admin && <>{bridge?.authorized || bridge?.enabled ? <AppButton disabled={pending || open || Boolean(bridge.pending)} onClick={() => void run(() => bridge.enabled ? api.disableTwitchGiveaway() : api.enableTwitchGiveaway())}>{bridge.enabled ? 'Désactiver le bridge' : 'Activer le bridge'}</AppButton>
          : <AppButton disabled={pending || !bridge?.available} onClick={authorize}>Autoriser Twitch</AppButton>}</>}
      </div>
      <section className="giveaway-top"><h3>Top 3 {open ? 'en direct' : 'final'}</h3>{session?.top.length ? <ol>{session.top.map(row => <li key={row.playerId}><strong>{row.rank}e · {row.displayName}</strong><span>{row.messageCount} messages</span></li>)}</ol> : <p>Aucun message éligible compté.</p>}</section>
      <section className="giveaway-announcements"><h3>Annonces Twitch</h3>{resultAnnouncements.length ? <ul>{resultAnnouncements.map(row => <li key={row.id}><span><strong>{announcementLabel[row.kind]}</strong> · {sendLabel[row.state] ?? row.state}{row.errorCode ? ` (${row.errorCode})` : ''}</span>
        {row.state === 'FAILED' && <AppButton disabled={pending || !bridge?.active} onClick={() => void run(() => api.retryGiveawayAnnouncement(row.id))}>Réessayer cet envoi</AppButton>}</li>)}</ul> : <p>Aucune annonce pour cette session.</p>}</section>
    </>}
    {confirmClose && <CloseConfirmation pending={pending} onCancel={() => { if (!pending) setConfirmClose(false) }} onConfirm={() => { if (!session) return; void run(() => api.closeGiveaway(session.id, crypto.randomUUID())).finally(() => setConfirmClose(false)) }} />}
  </section>
}
