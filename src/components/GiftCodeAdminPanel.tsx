import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import type { AdminGiftCodeDto, AdminGiftCodeMutationDto, AdminGiftCodesDto, GiftCodeAdminQuery, GiftCodeClaimantQuery, GiftCodeClaimantsDto, GiftCodeRewardDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import AppButton from './AppButton'
import ModalCloseButton from './ModalCloseButton'
import { useModalDialog } from './useModalDialog'

const resourceOptions = [
  ['primogems', 'Primos'], ['moras', 'Moras'], ['particles_pyro', 'Particules Pyro'], ['particles_hydro', 'Particules Hydro'], ['particles_cryo', 'Particules Cryo'], ['particles_electro', 'Particules Électro'], ['particles_anemo', 'Particules Anémo'], ['particles_geo', 'Particules Géo'], ['particles_dendro', 'Particules Dendro'],
] as const
type Draft = { token: string; title: string; description: string; type: 'ONE_OFF' | 'ANNUAL'; recurringMonth: number; startsAt: string; endsAt: string; rewards: Record<string, string> }
type Props = Readonly<{
  onLoad: (query: GiftCodeAdminQuery) => Promise<AdminGiftCodesDto>
  onCreate: (input: { token?: string; title: string; description: string; type: 'ONE_OFF' | 'ANNUAL'; recurringMonth?: number; startsAt?: string; endsAt?: string; rewards: readonly { resourceKey: string; amount: string }[]; idempotencyKey: string }) => Promise<AdminGiftCodeMutationDto>
  onPublish: (codeId: string, key: string) => Promise<AdminGiftCodeMutationDto>
  onUpdate: (codeId: string, input: { token?: string; title?: string; description?: string; type?: 'ONE_OFF' | 'ANNUAL'; recurringMonth?: number; startsAt?: string; endsAt?: string; rewards?: readonly { resourceKey: string; amount: string }[]; disabled?: boolean; idempotencyKey: string }) => Promise<AdminGiftCodeMutationDto>
  onClaimants: (codeId: string, query: GiftCodeClaimantQuery) => Promise<GiftCodeClaimantsDto>
}>

type MutationIntent = { signature: string; key: string }

export default function GiftCodeAdminPanel(props: Props) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [listOpen, setListOpen] = useState(false)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [pending, setPending] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intentRef = useRef<MutationIntent | null>(null)

  const runMutation = async (signature: string, request: (key: string) => Promise<AdminGiftCodeMutationDto>) => {
    if (pending) return null
    if (intentRef.current && intentRef.current.signature !== signature) {
      setError('Réessayez d’abord la modification précédente afin de vérifier son résultat serveur.')
      return null
    }
    const intent = intentRef.current ?? { signature, key: crypto.randomUUID() }
    intentRef.current = intent
    setPending(signature); setFeedback('Enregistrement…'); setError(null)
    try {
      const result = await request(intent.key)
      intentRef.current = null
      setFeedback('Modification enregistrée.')
      setCatalogRevision((value) => value + 1)
      return result
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) intentRef.current = null
      setFeedback(null); setError(apiErrorMessage(reason)); return null
    } finally { setPending(null) }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const rewards = resourceOptions.map(([resourceKey]) => ({ resourceKey, amount: draft.rewards[resourceKey] || '0' })).filter(({ amount }) => BigInt(amount || '0') > 0n)
    const signature = `create:${JSON.stringify({ ...draft, rewards })}`
    void runMutation(signature, (idempotencyKey) => props.onCreate({ token: draft.token || undefined, title: draft.title, description: draft.description, type: draft.type, recurringMonth: draft.type === 'ANNUAL' ? draft.recurringMonth : undefined, startsAt: draft.type === 'ONE_OFF' && draft.startsAt ? localToIso(draft.startsAt) : undefined, endsAt: draft.type === 'ONE_OFF' && draft.endsAt ? localToIso(draft.endsAt) : undefined, rewards, idempotencyKey })).then((result) => { if (result) setDraft(emptyDraft()) })
  }

  return <section className="gift-code-admin" aria-label="Administration des codes cadeaux">
    <header><div><span className="eyebrow">Administrateur</span><h2>Codes cadeaux</h2></div><p>Création, publication et suivi des codes globaux.</p></header>
    {error && <p className="moderation-feedback error" role="alert">{error}</p>}
    {feedback && <p className="moderation-feedback" role="status">{feedback}</p>}
    <form className="panel gift-code-admin-form" onSubmit={submit}>
      <div className="gift-code-admin-form-heading"><h3>Création</h3><div><AppButton onClick={() => setListOpen(true)}>Liste</AppButton><AppButton disabled={Boolean(pending)} onClick={() => setDraft((current) => ({ ...current, token: `CADEAU-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }))}>Générer le code</AppButton></div></div>
      <div className="gift-code-admin-fields"><label>Code<input value={draft.token} onChange={(event) => setDraft({ ...draft, token: event.target.value.toUpperCase() })} placeholder="Saisie manuelle ou génération" /></label><label>Titre<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="wide">Description<textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Draft['type'] })}><option value="ONE_OFF">Ponctuel</option><option value="ANNUAL">Annuel</option></select></label>{draft.type === 'ANNUAL' ? <label>Mois<select value={draft.recurringMonth} onChange={(event) => setDraft({ ...draft, recurringMonth: Number(event.target.value) })}>{months.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label> : <><label>Début (vide = immédiat)<input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></label><label>Fin (vide = sans expiration)<input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></label></>}</div>
      <fieldset><legend>Récompenses</legend><div className="gift-code-admin-rewards">{resourceOptions.map(([key, label]) => <label key={key}>{label}<input inputMode="numeric" pattern="[0-9]*" value={draft.rewards[key] ?? ''} onChange={(event) => setDraft({ ...draft, rewards: { ...draft.rewards, [key]: event.target.value.replace(/\D/g, '') } })} placeholder="0" /></label>)}</div></fieldset>
      <GiftCodePreview title={draft.title || 'Aperçu du cadeau'} token={draft.token || 'CODE-À-DÉFINIR'} rewards={resourceOptions.map(([resourceKey, displayName]) => ({ resourceKey, displayName, amount: draft.rewards[resourceKey] || '0' }))} />
      <AppButton type="submit" variant="primary" disabled={Boolean(pending)}>Créer le brouillon</AppButton>
    </form>
    {listOpen && createPortal(<GiftCodeListModal revision={catalogRevision} pending={pending} onClose={() => setListOpen(false)} onLoad={props.onLoad} onMutation={runMutation} onPublish={props.onPublish} onUpdate={props.onUpdate} onClaimants={props.onClaimants} />, document.body)}
  </section>
}

const initialListQuery: GiftCodeAdminQuery = { page: 1, sort: 'createdAt', direction: 'desc' }

function GiftCodeListModal(props: Pick<Props, 'onLoad' | 'onPublish' | 'onUpdate' | 'onClaimants'> & Readonly<{ revision: number; pending: string | null; onClose: () => void; onMutation: (signature: string, request: (key: string) => Promise<AdminGiftCodeMutationDto>) => Promise<AdminGiftCodeMutationDto | null> }>) {
  const { onLoad, revision } = props
  const dialogRef = useModalDialog<HTMLElement>(props.onClose)
  const [query, setQuery] = useState<GiftCodeAdminQuery>(initialListQuery)
  const [value, setValue] = useState<AdminGiftCodesDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminGiftCodeDto | null>(null)
  const [claimantsCode, setClaimantsCode] = useState<AdminGiftCodeDto | null>(null)
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => void onLoad(query).then((next) => { if (active) { setValue(next); setError(null) } }).catch((reason) => { if (active) setError(apiErrorMessage(reason)) }), query.search ? 150 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [onLoad, revision, query])
  const updateQuery = (change: Partial<GiftCodeAdminQuery>) => setQuery((current) => ({ ...current, ...change, page: change.page ?? 1 }))
  const apply = async (signature: string, request: (key: string) => Promise<AdminGiftCodeMutationDto>) => {
    const result = await props.onMutation(signature, request)
    if (!result) return false
    setValue((current) => current ? { ...current, codes: current.codes.map((code) => code.id === result.code.id ? result.code : code) } : current)
    return true
  }
  const saveEdit = (event: FormEvent) => {
    event.preventDefault(); if (!editing) return
    const mutableIdentity = editing.locked ? {} : { token: editing.token, type: editing.type, recurringMonth: editing.type === 'ANNUAL' ? editing.recurringMonth ?? undefined : undefined, rewards: editing.rewards.map(({ resourceKey, amount }) => ({ resourceKey, amount })) }
    const signature = `update:${editing.id}:${JSON.stringify({ ...mutableIdentity, title: editing.title, description: editing.description, startsAt: editing.startsAt, endsAt: editing.endsAt })}`
    void apply(signature, (idempotencyKey) => props.onUpdate(editing.id, { ...mutableIdentity, title: editing.title, description: editing.description, startsAt: editing.type === 'ONE_OFF' && editing.startsAt ? editing.startsAt : undefined, endsAt: editing.type === 'ONE_OFF' && editing.endsAt ? editing.endsAt : undefined, idempotencyKey })).then((saved) => { if (saved) setEditing(null) })
  }
  return <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose() }}><section ref={dialogRef} tabIndex={-1} className="floating-panel gift-code-list-modal" role="dialog" aria-modal="true" aria-label="Liste des codes cadeaux">
    <header><div><span className="eyebrow">Administration</span><h2>Liste des codes</h2></div><ModalCloseButton onClose={props.onClose} /></header>
    <div className="gift-code-list-filters"><label>Recherche<input type="search" value={query.search ?? ''} onChange={(event) => updateQuery({ search: event.target.value || undefined })} placeholder="Titre ou code" /></label><Filter label="État" value={query.status ?? ''} onChange={(status) => updateQuery({ status: status as GiftCodeAdminQuery['status'] || undefined })} options={[['', 'Tous'], ['DRAFT', 'Brouillons'], ['PUBLISHED', 'Publiés'], ['DISABLED', 'Désactivés']]} /><Filter label="Type" value={query.type ?? ''} onChange={(type) => updateQuery({ type: type as GiftCodeAdminQuery['type'] || undefined })} options={[['', 'Tous'], ['ONE_OFF', 'Ponctuels'], ['ANNUAL', 'Annuels']]} /><Filter label="Disponibilité" value={query.availability ?? ''} onChange={(availability) => updateQuery({ availability: availability as GiftCodeAdminQuery['availability'] || undefined })} options={[['', 'Toutes'], ['CURRENT', 'Actuelle'], ['FUTURE', 'À venir'], ['OUTSIDE', 'Expirée ou hors période']]} /><Filter label="Tri" value={query.sort} onChange={(sort) => updateQuery({ sort: sort as GiftCodeAdminQuery['sort'] })} options={[['createdAt', 'Création'], ['publishedAt', 'Publication'], ['title', 'Titre'], ['claims', 'Récupérations']]} /><AppButton aria-label={query.direction === 'asc' ? 'Tri ascendant' : 'Tri descendant'} onClick={() => updateQuery({ direction: query.direction === 'asc' ? 'desc' : 'asc' })}>{query.direction === 'asc' ? '↑' : '↓'}</AppButton></div>
    <div className="gift-code-list-modal-body">{error && <p role="alert">{error}</p>}{!value && !error && <p role="status">Chargement…</p>}{value?.codes.map((code) => <article className="panel" key={code.id}><div className="gift-code-admin-identity"><span className={`gift-code-status ${code.status.toLowerCase()}`}>{statusLabel(code.status)}</span><h3>{code.title}</h3><code>{code.token}</code><p>{code.description}</p><small>{code.type === 'ANNUAL' ? `Annuel · ${months[(code.recurringMonth ?? 1) - 1]}` : formatAdminPeriod(code)}</small><small>Créé le {formatAdminDate(code.createdAt)} · {code.publishedAt ? `Publié le ${formatAdminDate(code.publishedAt)}` : 'Non publié'}</small></div><div className="gift-code-admin-summary"><strong>{code.claimCount} récupération{code.claimCount > 1 ? 's' : ''}</strong><span>{code.rewards.map((reward) => `${formatResourceAmount(reward.amount)} ${reward.displayName}`).join(' · ')}</span>{code.locked && <small>Identité, type et récompenses verrouillés.</small>}</div><div className="gift-code-admin-actions"><AppButton disabled={Boolean(props.pending)} onClick={() => setEditing(code)}>Modifier</AppButton>{code.status === 'DRAFT' && <AppButton variant="primary" disabled={Boolean(props.pending)} onClick={() => void apply(`publish:${code.id}`, (key) => props.onPublish(code.id, key))}>Publier</AppButton>}{code.status === 'PUBLISHED' && <AppButton variant="danger" disabled={Boolean(props.pending)} onClick={() => void apply(`disable:${code.id}`, (idempotencyKey) => props.onUpdate(code.id, { disabled: true, idempotencyKey }))}>Désactiver</AppButton>}{code.status === 'DISABLED' && <AppButton disabled={Boolean(props.pending)} onClick={() => void apply(`enable:${code.id}`, (idempotencyKey) => props.onUpdate(code.id, { disabled: false, idempotencyKey }))}>Réactiver</AppButton>}<AppButton disabled={Boolean(props.pending)} onClick={() => setClaimantsCode(code)}>Récupérations</AppButton></div></article>)}{value?.codes.length === 0 && <p>Aucun code ne correspond à ces filtres.</p>}</div>
    <footer><AppButton disabled={!value || value.page <= 1} onClick={() => updateQuery({ page: query.page - 1 })}>Précédent</AppButton><span>Page {value?.page ?? query.page} / {value?.totalPages ?? 1} · {value?.total ?? 0} code{value?.total === 1 ? '' : 's'}</span><AppButton disabled={!value || value.page >= value.totalPages} onClick={() => updateQuery({ page: query.page + 1 })}>Suivant</AppButton></footer>
    {editing && <GiftCodeEditModal editing={editing} pending={Boolean(props.pending)} onChange={setEditing} onClose={() => setEditing(null)} onSubmit={saveEdit} />}
    {claimantsCode && <GiftCodeClaimantsModal code={claimantsCode} onLoad={props.onClaimants} onClose={() => setClaimantsCode(null)} />}
  </section></div>
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>
}

function GiftCodeEditModal({ editing, pending, onChange, onClose, onSubmit }: Readonly<{ editing: AdminGiftCodeDto; pending: boolean; onChange: (value: AdminGiftCodeDto) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }>) {
  const dialogRef = useModalDialog<HTMLFormElement>(onClose)
  return <div className="modal-layer nested-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form ref={dialogRef} tabIndex={-1} className="floating-panel gift-code-edit-modal" role="dialog" aria-modal="true" aria-label="Modifier le code cadeau" onSubmit={onSubmit}>
    <header><h2>Modifier {editing.token}</h2><ModalCloseButton onClose={onClose} /></header>
    <label>Code<input disabled={editing.locked} value={editing.token} onChange={(event) => onChange({ ...editing, token: event.target.value.toUpperCase() })} /></label><label>Titre<input value={editing.title} onChange={(event) => onChange({ ...editing, title: event.target.value })} /></label><label>Description<textarea value={editing.description} onChange={(event) => onChange({ ...editing, description: event.target.value })} /></label><label>Type<select disabled={editing.locked} value={editing.type} onChange={(event) => { const type = event.target.value as AdminGiftCodeDto['type']; onChange({ ...editing, type, recurringMonth: type === 'ANNUAL' ? editing.recurringMonth ?? new Date().getMonth() + 1 : editing.recurringMonth }) }}><option value="ONE_OFF">Ponctuel</option><option value="ANNUAL">Annuel</option></select></label>
    {editing.type === 'ANNUAL' ? <label>Mois<select disabled={editing.locked} value={editing.recurringMonth ?? 1} onChange={(event) => onChange({ ...editing, recurringMonth: Number(event.target.value) })}>{months.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label> : <><label>Début<input type="datetime-local" value={isoToLocal(editing.startsAt)} onChange={(event) => onChange({ ...editing, startsAt: localToIso(event.target.value) })} /></label><label>Fin<input type="datetime-local" value={isoToLocal(editing.endsAt)} onChange={(event) => onChange({ ...editing, endsAt: localToIso(event.target.value) })} /></label></>}
    <fieldset><legend>Récompenses</legend><div className="gift-code-admin-rewards">{resourceOptions.map(([resourceKey, displayName]) => { const reward = editing.rewards.find((entry) => entry.resourceKey === resourceKey); return <label key={resourceKey}>{displayName}<input disabled={editing.locked} inputMode="numeric" pattern="[0-9]*" value={reward?.amount ?? ''} onChange={(event) => onChange({ ...editing, rewards: replaceReward(editing.rewards, resourceKey, displayName, event.target.value.replace(/\D/g, '')) })} placeholder="0" /></label> })}</div></fieldset>
    {editing.locked && <small>Le code, le type et les récompenses sont verrouillés depuis la première récupération.</small>}<GiftCodePreview title={editing.title} token={editing.token} rewards={editing.rewards} />
    <footer><AppButton onClick={onClose}>Annuler</AppButton><AppButton type="submit" variant="primary" disabled={pending}>Enregistrer</AppButton></footer>
  </form></div>
}

function GiftCodeClaimantsModal({ code, onLoad, onClose }: Readonly<{ code: AdminGiftCodeDto; onLoad: Props['onClaimants']; onClose: () => void }>) {
  const dialogRef = useModalDialog<HTMLElement>(onClose)
  const [query, setQuery] = useState<GiftCodeClaimantQuery>({ page: 1 })
  const [value, setValue] = useState<GiftCodeClaimantsDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { let active = true; const timer = window.setTimeout(() => void onLoad(code.id, query).then((next) => { if (active) { setValue(next); setError(null) } }).catch((reason) => { if (active) setError(apiErrorMessage(reason)) }), query.search ? 150 : 0); return () => { active = false; window.clearTimeout(timer) } }, [code.id, onLoad, query])
  const change = (next: Partial<GiftCodeClaimantQuery>) => setQuery((current) => ({ ...current, ...next, page: next.page ?? 1 }))
  return <div className="modal-layer nested-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} tabIndex={-1} className="floating-panel gift-code-claimants-modal" role="dialog" aria-modal="true" aria-label="Détail des récupérations"><header><div><span className="eyebrow">{code.token}</span><h2>Récupérations</h2></div><ModalCloseButton onClose={onClose} /></header><div className="gift-code-claimants-filters"><label>Joueur<input type="search" value={query.search ?? ''} onChange={(event) => change({ search: event.target.value || undefined })} placeholder="Pseudo" /></label><label>Édition<select value={query.editionKey ?? ''} onChange={(event) => change({ editionKey: event.target.value || undefined })}><option value="">Toutes</option>{code.editions.map(({ editionKey }) => <option value={editionKey} key={editionKey}>{editionKey}</option>)}</select></label></div><div className="gift-code-claimants-body">{error && <p role="alert">{error}</p>}{!value && !error && <p role="status">Chargement…</p>}{value?.claimants.map((claim) => <p key={`${claim.playerId}:${claim.editionKey}`}><strong>{claim.displayName}</strong><span>Édition {claim.editionKey} · {new Date(claim.claimedAt).toLocaleString('fr-FR')}</span></p>)}{value?.claimants.length === 0 && <p>Aucune récupération.</p>}</div><footer><AppButton disabled={!value || value.page <= 1} onClick={() => change({ page: query.page - 1 })}>Précédent</AppButton><span>Page {value?.page ?? query.page} / {value?.totalPages ?? 1} · {value?.total ?? 0}</span><AppButton disabled={!value || value.page >= value.totalPages} onClick={() => change({ page: query.page + 1 })}>Suivant</AppButton></footer></section></div>
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
