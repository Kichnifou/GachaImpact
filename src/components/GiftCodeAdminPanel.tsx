import { useEffect, useState, type FormEvent } from 'react'

import type { AdminGiftCodeDto, AdminGiftCodesDto, GiftCodeClaimantsDto, GiftCodeRewardDto } from '../api/types'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { useModalDialog } from './useModalDialog'

const resourceOptions = [
  ['primogems', 'Primos'], ['moras', 'Moras'], ['particles_pyro', 'Particules Pyro'], ['particles_hydro', 'Particules Hydro'], ['particles_cryo', 'Particules Cryo'], ['particles_electro', 'Particules Électro'], ['particles_anemo', 'Particules Anémo'], ['particles_geo', 'Particules Géo'], ['particles_dendro', 'Particules Dendro'],
] as const
type Draft = { token: string; title: string; description: string; type: 'ONE_OFF' | 'ANNUAL'; recurringMonth: number; startsAt: string; endsAt: string; rewards: Record<string, string> }
type Props = Readonly<{
  onLoad: () => Promise<AdminGiftCodesDto>
  onCreate: (input: { token?: string; title: string; description: string; type: 'ONE_OFF' | 'ANNUAL'; recurringMonth?: number; startsAt?: string; endsAt?: string; rewards: readonly { resourceKey: string; amount: string }[]; idempotencyKey: string }) => Promise<AdminGiftCodesDto>
  onPublish: (codeId: string, key: string) => Promise<AdminGiftCodesDto>
  onUpdate: (codeId: string, input: { token?: string; title?: string; description?: string; type?: 'ONE_OFF' | 'ANNUAL'; recurringMonth?: number; startsAt?: string; endsAt?: string; rewards?: readonly { resourceKey: string; amount: string }[]; disabled?: boolean; idempotencyKey: string }) => Promise<AdminGiftCodesDto>
  onClaimants: (codeId: string) => Promise<GiftCodeClaimantsDto>
}>

export default function GiftCodeAdminPanel(props: Props) {
  const { onLoad } = props
  const [value, setValue] = useState<AdminGiftCodesDto | null>(null)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [editing, setEditing] = useState<AdminGiftCodeDto | null>(null)
  const [claimants, setClaimants] = useState<GiftCodeClaimantsDto | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { let active = true; void onLoad().then((next) => { if (active) setValue(next) }).catch((reason) => { if (active) setError(apiErrorMessage(reason)) }); return () => { active = false } }, [onLoad])
  const run = async (request: () => Promise<AdminGiftCodesDto>) => { if (pending) return false; setPending(true); setError(null); try { setValue(await request()); return true } catch (reason) { setError(apiErrorMessage(reason)); return false } finally { setPending(false) } }
  const submit = (event: FormEvent) => { event.preventDefault(); const rewards = resourceOptions.map(([resourceKey]) => ({ resourceKey, amount: draft.rewards[resourceKey] || '0' })).filter(({ amount }) => BigInt(amount || '0') > 0n); void run(async () => { const next = await props.onCreate({ token: draft.token || undefined, title: draft.title, description: draft.description, type: draft.type, recurringMonth: draft.type === 'ANNUAL' ? draft.recurringMonth : undefined, startsAt: draft.type === 'ONE_OFF' && draft.startsAt ? localToIso(draft.startsAt) : undefined, endsAt: draft.type === 'ONE_OFF' && draft.endsAt ? localToIso(draft.endsAt) : undefined, rewards, idempotencyKey: crypto.randomUUID() }); setDraft(emptyDraft()); return next }) }
  const saveEdit = (event: FormEvent) => { event.preventDefault(); if (!editing) return; const mutableIdentity = editing.locked ? {} : { token: editing.token, type: editing.type, recurringMonth: editing.type === 'ANNUAL' ? editing.recurringMonth ?? undefined : undefined, rewards: editing.rewards.map(({ resourceKey, amount }) => ({ resourceKey, amount })) }; void run(() => props.onUpdate(editing.id, { ...mutableIdentity, title: editing.title, description: editing.description, startsAt: editing.type === 'ONE_OFF' && editing.startsAt ? editing.startsAt : undefined, endsAt: editing.type === 'ONE_OFF' && editing.endsAt ? editing.endsAt : undefined, idempotencyKey: crypto.randomUUID() })).then((saved) => { if (saved) setEditing(null) }) }
  return <section className="gift-code-admin" aria-label="Administration des codes cadeaux">
    <header><div><span className="eyebrow">Administrateur</span><h2>Codes cadeaux</h2></div><p>Création, publication et suivi des codes globaux.</p></header>
    {error && <p className="moderation-feedback error" role="alert">{error}</p>}
    <form className="panel gift-code-admin-form" onSubmit={submit}>
      <div className="gift-code-admin-form-heading"><h3>Nouveau brouillon</h3><button type="button" disabled={pending} onClick={() => setDraft((current) => ({ ...current, token: `CADEAU-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }))}>Générer le code</button></div>
      <div className="gift-code-admin-fields"><label>Code<input value={draft.token} onChange={(event) => setDraft({ ...draft, token: event.target.value.toUpperCase() })} placeholder="Saisie manuelle ou génération" /></label><label>Titre<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="wide">Description<textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Draft['type'] })}><option value="ONE_OFF">Ponctuel</option><option value="ANNUAL">Annuel</option></select></label>{draft.type === 'ANNUAL' ? <label>Mois<select value={draft.recurringMonth} onChange={(event) => setDraft({ ...draft, recurringMonth: Number(event.target.value) })}>{months.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label> : <><label>Début (vide = immédiat)<input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label><label>Fin (vide = sans expiration)<input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label></>}</div>
      <fieldset><legend>Récompenses</legend><div className="gift-code-admin-rewards">{resourceOptions.map(([key, label]) => <label key={key}>{label}<input inputMode="numeric" pattern="[0-9]*" value={draft.rewards[key] ?? ''} onChange={(event) => setDraft({ ...draft, rewards: { ...draft.rewards, [key]: event.target.value.replace(/\D/g, '') } })} placeholder="0" /></label>)}</div></fieldset>
      <GiftCodePreview title={draft.title || 'Aperçu du cadeau'} token={draft.token || 'CODE-À-DÉFINIR'} rewards={resourceOptions.map(([resourceKey, displayName]) => ({ resourceKey, displayName, amount: draft.rewards[resourceKey] || '0' }))} />
      <button className="primary-button" disabled={pending}>Créer le brouillon</button>
    </form>
    <div className="gift-code-admin-list">{value?.codes.map((code) => <article className="panel" key={code.id}><div className="gift-code-admin-identity"><span className={`gift-code-status ${code.status.toLowerCase()}`}>{statusLabel(code.status)}</span><h3>{code.title}</h3><code>{code.token}</code><p>{code.description}</p><small>{code.type === 'ANNUAL' ? `Annuel · ${months[(code.recurringMonth ?? 1) - 1]}` : formatAdminPeriod(code)}</small><small>Créé le {formatAdminDate(code.createdAt)} · {code.publishedAt ? `Publié le ${formatAdminDate(code.publishedAt)}` : 'Non publié'}</small></div><div className="gift-code-admin-summary"><strong>{code.claimCount} récupération{code.claimCount > 1 ? 's' : ''}</strong><span>{code.rewards.map((reward) => `${formatResourceAmount(reward.amount)} ${reward.displayName}`).join(' · ')}</span>{code.locked && <small>Identité, type et récompenses verrouillés.</small>}</div><div className="gift-code-admin-actions"><button type="button" disabled={pending} onClick={() => setEditing(code)}>Modifier</button>{code.status === 'DRAFT' && <button type="button" className="primary-button" disabled={pending} onClick={() => void run(() => props.onPublish(code.id, crypto.randomUUID()))}>Publier</button>}{code.status === 'PUBLISHED' && <button type="button" className="danger-button" disabled={pending} onClick={() => void run(() => props.onUpdate(code.id, { disabled: true, idempotencyKey: crypto.randomUUID() }))}>Désactiver</button>}{code.status === 'DISABLED' && <button type="button" disabled={pending} onClick={() => void run(() => props.onUpdate(code.id, { disabled: false, idempotencyKey: crypto.randomUUID() }))}>Réactiver</button>}<button type="button" disabled={pending} onClick={() => { setError(null); void props.onClaimants(code.id).then(setClaimants).catch((reason) => setError(apiErrorMessage(reason))) }}>Récupérations</button></div></article>)}</div>
    {editing && <GiftCodeEditModal editing={editing} pending={pending} onChange={setEditing} onClose={() => setEditing(null)} onSubmit={saveEdit} />}
    {claimants && <GiftCodeClaimantsModal value={claimants} onClose={() => setClaimants(null)} />}
  </section>
}

function GiftCodeEditModal({ editing, pending, onChange, onClose, onSubmit }: Readonly<{ editing: AdminGiftCodeDto; pending: boolean; onChange: (value: AdminGiftCodeDto) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }>) {
  const dialogRef = useModalDialog<HTMLFormElement>(onClose)
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form ref={dialogRef} tabIndex={-1} className="floating-panel gift-code-edit-modal" role="dialog" aria-modal="true" aria-label="Modifier le code cadeau" onSubmit={onSubmit}>
    <header><h2>Modifier {editing.token}</h2><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
    <label>Code<input disabled={editing.locked} value={editing.token} onChange={(event) => onChange({ ...editing, token: event.target.value.toUpperCase() })} /></label>
    <label>Titre<input value={editing.title} onChange={(event) => onChange({ ...editing, title: event.target.value })} /></label>
    <label>Description<textarea value={editing.description} onChange={(event) => onChange({ ...editing, description: event.target.value })} /></label>
    <label>Type<select disabled={editing.locked} value={editing.type} onChange={(event) => { const type = event.target.value as AdminGiftCodeDto['type']; onChange({ ...editing, type, recurringMonth: type === 'ANNUAL' ? editing.recurringMonth ?? new Date().getMonth() + 1 : editing.recurringMonth }) }}><option value="ONE_OFF">Ponctuel</option><option value="ANNUAL">Annuel</option></select></label>
    {editing.type === 'ANNUAL' ? <label>Mois<select disabled={editing.locked} value={editing.recurringMonth ?? 1} onChange={(event) => onChange({ ...editing, recurringMonth: Number(event.target.value) })}>{months.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label> : <><label>Début<input type="datetime-local" value={isoToLocal(editing.startsAt)} onChange={(event) => onChange({ ...editing, startsAt: localToIso(event.target.value) })} /></label><label>Fin<input type="datetime-local" value={isoToLocal(editing.endsAt)} onChange={(event) => onChange({ ...editing, endsAt: localToIso(event.target.value) })} /></label></>}
    <fieldset><legend>Récompenses</legend><div className="gift-code-admin-rewards">{resourceOptions.map(([resourceKey, displayName]) => { const reward = editing.rewards.find((entry) => entry.resourceKey === resourceKey); return <label key={resourceKey}>{displayName}<input disabled={editing.locked} inputMode="numeric" pattern="[0-9]*" value={reward?.amount ?? ''} onChange={(event) => onChange({ ...editing, rewards: replaceReward(editing.rewards, resourceKey, displayName, event.target.value.replace(/\D/g, '')) })} placeholder="0" /></label> })}</div></fieldset>
    {editing.locked && <small>Le code, le type et les récompenses sont verrouillés depuis la première récupération.</small>}
    <GiftCodePreview title={editing.title} token={editing.token} rewards={editing.rewards} />
    <footer><button type="button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={pending}>Enregistrer</button></footer>
  </form></div>
}

function GiftCodeClaimantsModal({ value, onClose }: Readonly<{ value: GiftCodeClaimantsDto; onClose: () => void }>) {
  const dialogRef = useModalDialog<HTMLElement>(onClose)
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} tabIndex={-1} className="floating-panel gift-code-claimants-modal" role="dialog" aria-modal="true" aria-label="Détail des récupérations"><header><div><span className="eyebrow">{value.code.token}</span><h2>Récupérations</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header><div>{value.claimants.length ? value.claimants.map((claim) => <p key={`${claim.playerId}:${claim.editionKey}`}><strong>{claim.displayName}</strong><span>Édition {claim.editionKey} · {new Date(claim.claimedAt).toLocaleString('fr-FR')}</span></p>) : <p>Aucune récupération.</p>}</div></section></div>
}

function GiftCodePreview({ title, token, rewards }: { title: string; token: string; rewards: readonly GiftCodeRewardDto[] }) { const visible = rewards.filter(({ amount }) => BigInt(amount || '0') > 0n); return <div className="gift-code-admin-preview"><span className="eyebrow">Aperçu joueur</span><strong>{title}</strong><code>{token}</code><p>{visible.length ? visible.map((reward) => `+${formatResourceAmount(reward.amount)} ${reward.displayName}`).join(' · ') : 'Ajoutez au moins une récompense.'}</p></div> }
function replaceReward(rewards: readonly GiftCodeRewardDto[], resourceKey: GiftCodeRewardDto['resourceKey'], displayName: string, amount: string): readonly GiftCodeRewardDto[] { return [...rewards.filter((reward) => reward.resourceKey !== resourceKey), ...(amount && BigInt(amount) > 0n ? [{ resourceKey, displayName, amount }] : [])] }
function emptyDraft(): Draft { return { token: '', title: '', description: '', type: 'ONE_OFF', recurringMonth: new Date().getMonth() + 1, startsAt: '', endsAt: '', rewards: {} } }
function localToIso(value: string) { return new Date(value).toISOString() }
function isoToLocal(value: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }
function statusLabel(status: AdminGiftCodeDto['status']) { return status === 'DRAFT' ? 'Brouillon' : status === 'PUBLISHED' ? 'Publié' : 'Désactivé' }
function formatAdminDate(value: string) { return new Date(value).toLocaleString('fr-FR') }
function formatAdminPeriod(code: AdminGiftCodeDto) { return code.startsAt && code.endsAt ? `${new Date(code.startsAt).toLocaleString('fr-FR')} → ${new Date(code.endsAt).toLocaleString('fr-FR')}` : 'Période à définir' }
const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] as const
