import { useEffect, useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { AdminBannerOverview, AdminCharacter } from '../../api/admin-types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, ConfirmAction, useAdminTask } from './AdminUi'

type BannerIntent = Readonly<{ kind: 'correct'; rotationId: string; fiveStarIds: readonly string[]; fourStarIds: readonly string[]; summary: string }>
  | Readonly<{ kind: 'retry'; weekStartsAt: string }>

async function allActive(rarity: 4 | 5): Promise<AdminCharacter[]> {
  const api = getGameApiClient()
  const first = await api.getAdminCharacters({ page: 1, rarity, active: true, sort: 'name' })
  if (first.totalPages > 50) throw new Error('Catalogue trop grand pour ce sélecteur : affinez le catalogue avant une correction.')
  const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) => api.getAdminCharacters({ page: index + 2, rarity, active: true, sort: 'name' })))
  return [first, ...rest].flatMap(page => page.entries)
}

export default function BannerAdminPanel() {
  const [overview, setOverview] = useState<AdminBannerOverview | null>(null)
  const [five, setFive] = useState<AdminCharacter[]>([])
  const [four, setFour] = useState<AdminCharacter[]>([])
  const [fiveIds, setFiveIds] = useState<string[]>([])
  const [fourIds, setFourIds] = useState<string[]>([])
  const [reload, setReload] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [confirm, setConfirm] = useState<BannerIntent | null>(null)
  const task = useAdminTask(() => setReload(value => value + 1))
  useEffect(() => { let live = true
    void Promise.all([getGameApiClient().getAdminBanners(), allActive(5), allActive(4)])
      .then(([value, fives, fours]) => { if (!live) return; setOverview(value); setFive(fives); setFour(fours)
        setFiveIds(value.active?.featuredCharacters.filter(row => row.rarity === 5).sort((a, b) => a.slot - b.slot).map(row => row.characterId) ?? [])
        setFourIds(value.active?.featuredCharacters.filter(row => row.rarity === 4).sort((a, b) => a.slot - b.slot).map(row => row.characterId) ?? []) })
      .catch(error => { if (live) setLoadError(apiErrorMessage(error)) })
    return () => { live = false }
  }, [reload])
  const openCorrection = () => { if (!overview?.active || !valid) return
    const names = [...fiveIds.map(id => five.find(row => row.id === id)?.name ?? id), ...fourIds.map(id => four.find(row => row.id === id)?.name ?? id)]
    setConfirm({ kind: 'correct', rotationId: overview.active.id, fiveStarIds: [...fiveIds], fourStarIds: [...fourIds], summary: names.join(' · ') })
  }
  const apply = async (intent: BannerIntent) => {
    const success = intent.kind === 'correct'
      ? await task.execute(JSON.stringify(intent), key => getGameApiClient().correctAdminBanner(intent.rotationId,
        { fiveStarIds: [...intent.fiveStarIds], fourStarIds: [...intent.fourStarIds], idempotencyKey: key }))
      : await task.execute(`retry:${intent.weekStartsAt}`, key => getGameApiClient().retryAdminBanner(key, intent.weekStartsAt))
    if (success) setConfirm(null)
  }
  const changeSlot = (rarity: 4 | 5, index: number, id: string) => {
    const setter = rarity === 5 ? setFiveIds : setFourIds
    setter(previous => { const next = [...previous]; next[index] = id; return next })
  }
  const valid = fiveIds.length === 4 && fourIds.length === 6 && new Set([...fiveIds, ...fourIds]).size === 10
    && fiveIds.every(id => five.some(row => row.id === id)) && fourIds.every(id => four.some(row => row.id === id))
  return <div className="admin-domain" aria-label="Administration des bannières">
    <AdminFeedback error={task.error || loadError} notice={task.notice} />
    {!overview ? <p>Chargement des bannières…</p> : <>
      <section className="panel admin-editor"><h2>Bannière active</h2>{overview.active ? <>
        <p>{new Date(overview.active.startsAt).toLocaleString('fr-FR')} → {new Date(overview.active.endsAt).toLocaleString('fr-FR')} · {overview.active.status}</p>
        <p>Composition {overview.diagnostics.validComposition ? 'valide' : 'invalide'} · fenêtre {overview.diagnostics.withinWindow ? 'courante' : 'hors période'}
          {overview.diagnostics.inactiveFeatured.length ? ` · ${overview.diagnostics.inactiveFeatured.length} personnage(s) inactif(s)` : ''}</p>
        <div className="admin-banner-slots">{([5, 4] as const).map(rarity => <fieldset key={rarity}><legend>{rarity}★ · {rarity === 5 ? '4 places' : '6 places'}</legend>
          {Array.from({ length: rarity === 5 ? 4 : 6 }, (_, index) => {
            const value = rarity === 5 ? fiveIds[index] ?? '' : fourIds[index] ?? ''
            const catalog = rarity === 5 ? five : four
            const current = overview.active?.featuredCharacters.find(row => row.rarity === rarity && row.slot === index + 1)
            return <label key={index}>Place {index + 1} <small>Actuel : {current?.character.name ?? 'manquant'} · {current?.selectionSource ?? '—'}</small>
              <select value={value} onChange={event => changeSlot(rarity, index, event.target.value)}><option value="">Choisir</option>
                {catalog.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}
                {value && !catalog.some(row => row.id === value) && <option value={value}>{current?.character.name ?? value} · inactif</option>}
              </select></label>
          })}</fieldset>)}</div>
        <button type="button" disabled={task.pending || !valid || !overview.diagnostics.withinWindow} onClick={openCorrection}>Corriger la bannière active</button>
        <details><summary>Snapshot de génération et provenance</summary><pre>{JSON.stringify(overview.active.generationVoteSnapshot, null, 2)}</pre>
          <pre>{JSON.stringify(overview.active.legacyProvenance, null, 2)}</pre></details>
      </> : <p>Aucune rotation active.</p>}</section>
      <section className="panel admin-list"><h2>Cycle de vote</h2><p>{overview.voteCycle.totalVotes} vote(s). Prochaine fenêtre : {new Date(overview.currentWeek.endsAt).toLocaleString('fr-FR')}</p>
        <div className="admin-scroll-list">{overview.voteCycle.candidates.map(row => <p key={row.id}>{row.name} · {row.voteCount} vote(s)</p>)}</div>
        {overview.next && <p>Rotation connue suivante : {new Date(overview.next.startsAt).toLocaleString('fr-FR')} · {overview.next.status}</p>}
        <button type="button" disabled={task.pending} onClick={() => setConfirm({ kind: 'retry', weekStartsAt: overview.currentWeek.startsAt })}>Réessayer la génération courante</button></section>
    </>}
    {confirm?.kind === 'correct' && <ConfirmAction title="Corriger cette bannière active ?" pending={task.pending} onCancel={() => setConfirm(null)} onConfirm={() => void apply(confirm)}>
      Rotation {confirm.rotationId}. Composition confirmée : {confirm.summary}. Les Pulls, pity, garanties et Capture restent inchangés ; les cibles 5★ devenues invalides seront vidées. L’ancienne composition restera dans l’audit.
    </ConfirmAction>}
    {confirm?.kind === 'retry' && <ConfirmAction title="Réessayer la génération ?" pending={task.pending} onCancel={() => setConfirm(null)} onConfirm={() => void apply(confirm)}>
      Semaine du {new Date(confirm.weekStartsAt).toLocaleString('fr-FR')}. Le moteur officiel réutilisera le snapshot fermé et les conditions courantes. Une bannière déjà créée reste inchangée.
    </ConfirmAction>}
  </div>
}
