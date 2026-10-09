import { useTutorialView } from '../tutorial/tutorial-presentation'
import { useEffect, useRef, useState } from 'react'

import type { GiftCodeClaimDto, GiftCodeDto, PlayerGiftCodesDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { useLatestRef } from '../hooks/use-latest-ref'

type Props = Readonly<{ refreshToken?: number; onLoad: () => Promise<PlayerGiftCodesDto>; onClaim: (editionId: string, idempotencyKey: string) => Promise<GiftCodeClaimDto> }>

export default function GiftCodesScreen({ refreshToken = 0, onLoad, onClaim }: Props) {
  const [normaltab, setTab] = useState<'available' | 'claimed'>('available')
  const tab = useTutorialView('codes', normaltab, ['available', 'claimed'])
  const [value, setValue] = useState<PlayerGiftCodesDto | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intents = useRef(new Map<string, string>())
  const seenRefreshToken = useRef(refreshToken)
  const loadRef = useLatestRef(onLoad)
  useEffect(() => { let active = true; void loadRef.current().then((next) => { if (active) setValue(next) }).catch((reason) => { if (active) setError(apiErrorMessage(reason)) }); return () => { active = false } }, [loadRef])
  useEffect(() => { if (seenRefreshToken.current === refreshToken) return; seenRefreshToken.current = refreshToken; let active = true; void loadRef.current().then(next => { if (active) { setValue(next); setError(null) } }).catch(reason => { if (active) setError(apiErrorMessage(reason)) }); return () => { active = false } }, [loadRef, refreshToken])
  const claim = async (editionId: string) => {
    if (pending) return
    const key = intents.current.get(editionId) ?? crypto.randomUUID()
    intents.current.set(editionId, key); setPending(editionId); setError(null)
    try { const next = await onClaim(editionId, key); intents.current.delete(editionId); setValue({ available: next.available, claimed: next.claimed }); setTab('claimed') }
    catch (reason) { if (!isAmbiguousMutationError(reason)) intents.current.delete(editionId); setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
  }
  const entries = tab === 'available' ? value?.available ?? [] : value?.claimed ?? []
  return <div className="screen-content gift-codes-screen long-screen-layout">
    <ScreenHeader eyebrow="Récompenses" title="Codes cadeaux" description="Récupérez les cadeaux actuellement proposés par GachaImpact." />
    <ScrollableScreenPanel className="gift-codes-frame" bodyClassName="gift-codes-body" fixed={<div className="gift-codes-tabs" role="tablist" aria-label="Codes cadeaux"><button type="button" role="tab" aria-selected={tab === 'available'} className={tab === 'available' ? 'active' : ''} onClick={() => setTab('available')}>Disponibles <span>{value?.available.length ?? 0}</span></button><button type="button" role="tab" aria-selected={tab === 'claimed'} className={tab === 'claimed' ? 'active' : ''} onClick={() => setTab('claimed')}>Récupérés <span>{value?.claimed.length ?? 0}</span></button></div>}>
      {error && <p className="gift-codes-feedback error" role="alert">{error}</p>}
      {!value && !error && <p data-tutorial-state="loading" className="gift-codes-empty" role="status">Chargement des codes cadeaux…</p>}
      {value && entries.length === 0 && <p className="gift-codes-empty">{tab === 'available' ? 'Aucun code cadeau disponible pour le moment.' : 'Vous n’avez encore récupéré aucun code cadeau.'}</p>}
      <div data-tutorial-anchor="codes-list" className="gift-codes-list">{entries.map((code) => <GiftCodeCard key={code.editionId} code={code} pending={pending === code.editionId} disabled={Boolean(pending)} onClaim={() => void claim(code.editionId)} />)}</div>
    </ScrollableScreenPanel>
  </div>
}

function GiftCodeCard({ code, pending, disabled, onClaim }: { code: GiftCodeDto; pending: boolean; disabled: boolean; onClaim: () => void }) {
  return <article className={`panel gift-code-card${code.claimed ? ' claimed' : ''}`}>
    <div className="gift-code-copy"><span className="eyebrow">{code.type === 'ANNUAL' ? `Édition ${code.editionKey}` : 'Code temporaire'}</span><h2>{code.title}</h2><code>{code.token}</code><p>{code.description}</p><small>{formatPeriod(code.startsAt, code.endsAt)}</small></div>
    {code.rewardBreakdown && <small className="gift-code-condition">Gains directs du Code</small>}
    <div className="gift-code-rewards" aria-label="Récompenses">{(code.rewardBreakdown?.direct ?? code.rewards).map((reward) => <span key={reward.resourceKey}><b>+{formatResourceAmount(reward.amount)}</b>{reward.displayName}</span>)}</div>
    {!!code.rewardBreakdown?.milestones.length && <><small className="gift-code-condition">Récompenses des nouveaux paliers Event</small><div className="gift-code-rewards" aria-label="Récompenses de paliers">{code.rewardBreakdown.milestones.map(reward => <span key={reward.resourceKey}><b>+{formatResourceAmount(reward.amount)}</b>{reward.displayName}</span>)}</div></>}
    {!code.claimed && code.rewards.some(({ resourceKey }) => resourceKey === 'event_points' || resourceKey === 'event_currency') && <small className="gift-code-condition">Gains Event réservés aux joueurs déjà inscrits au Festival actif au moment de la récupération. Les autres gains restent disponibles.</small>}
    {code.claimed && code.eventReward?.granted === false && <small className="gift-code-condition">Aucun gain Event accordé : inscription au Festival actif requise lors de la récupération.</small>}
    {code.claimed && code.rewards.length === 0 && <small className="gift-code-condition">Aucune récompense accordée.</small>}
    {code.claimed ? <strong className="gift-code-claimed">✓ {code.claimedAt ? `Récupéré le ${formatDate(code.claimedAt)}` : 'Récupéré (date indisponible)'}</strong> : <button type="button" className="primary-button" disabled={disabled} aria-busy={pending} onClick={onClaim}>{pending ? 'Récupération…' : 'Récupérer'}</button>}
  </article>
}

function formatPeriod(startsAt: string | null, endsAt: string | null) { if (!startsAt || !endsAt) return 'Période indisponible'; const format = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'Europe/Paris' }); if (new Date(endsAt).getUTCFullYear() >= 9999) return `Disponible depuis le ${format.format(new Date(startsAt))}, sans expiration`; return `Disponible du ${format.format(new Date(startsAt))} au ${format.format(new Date(Date.parse(endsAt) - 1))}` }
function formatDate(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(value)) }
