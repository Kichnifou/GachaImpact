import { useCallback, useEffect, useRef, useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { CatalogCandidate, CatalogOverview } from '../../api/catalog-types'
import { elementKeys } from '../../api/types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, ConfirmAction, useAdminTask } from './AdminUi'
import { CatalogDialog } from './CatalogDialog'

const statusLabels: Record<string, string> = { DETECTED: 'Détecté', INCOMPLETE: 'Incomplet', OUT_OF_WINDOW: 'Hors fenêtre', CONFLICT: 'Conflit',
  ELIGIBLE: 'Éligible', PUBLISHED: 'Publié', TEMPORARY_ERROR: 'Erreur temporaire', INTERVENTION: 'Intervention requise' }
const labels: Record<string, string> = { name: 'Nom français', originalName: 'Nom original', rarity: 'Rareté', element: 'Élément', weapon: 'Arme', region: 'Région',
  numericId: 'Identité Genshin', technicalName: 'Alias technique', releaseDate: 'Sortie officielle', officialReleaseDate: 'Date officielle', title: 'Titre', constellation: 'Constellation',
  icon: 'Portrait', splash: 'Splash', wish: 'Wish', fullbody: 'Fullbody', promotion: 'Promotion' }
const date = (value?: string | null) => value ? new Date(value).toLocaleString('fr-FR') : 'Pas encore vérifié'
const sourceLink = (url: string | null) => url?.startsWith('https://') ? <a href={url} target="_blank" rel="noreferrer">Consulter la source ↗</a> : null
const errorLabels: Record<string, string> = { ABSENT: 'Information absente : nouvel essai au prochain passage.', HTTP_404: 'Ressource absente (404) : nouvel essai prévu.',
  TIMEOUT: 'Source trop lente : nouvel essai prévu.', UNAVAILABLE: 'Source indisponible : nouvel essai prévu.', SCHEMA_CHANGED: 'Format fournisseur changé : contrôle technique requis.',
  COVERAGE_UNQUALIFIED: 'Couverture insuffisante : fournisseur de secours écarté.', UNCONFIRMED: 'Information non officiellement confirmée : attendre une preuve.',
  IDENTITY_CONFLICT: 'Identité contradictoire : arbitrage ADMIN requis.', STORAGE_NOT_CONFIGURED: 'Stockage serveur à configurer avant upload ou publication.',
  ROLE_INVALID: 'Image incompatible avec ce rôle : fournir une image adaptée.', IMAGE_CORRUPT: 'Image illisible : fournir un autre fichier.', MIME_MISMATCH: 'Type de fichier incorrect.',
  BUCKET_UNAVAILABLE: 'Bucket indisponible : contrôle technique requis.', STORAGE_CAPACITY_LIMIT: 'Plafond de stockage atteint : vérifier les quotas.',
  SOURCE_NOT_ALLOWED: 'Domaine source non autorisé : contrôle technique requis.', AUTHOR_NOT_OFFICIAL: 'Auteur non officiel : annonce écartée.' }

export default function CatalogPipelinePanel({ initialId }: { initialId?: string }) {
  const [overview, setOverview] = useState<CatalogOverview | null>(null)
  const [detail, setDetail] = useState<CatalogCandidate | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('')
  const [reload, setReload] = useState(0), [detailLoading, setDetailLoading] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [role, setRole] = useState('icon'), [file, setFile] = useState<File | null>(null)
  const [reason, setReason] = useState(''), [confirm, setConfirm] = useState(false)
  const currentId = useRef<string | null>(null)
  const requestVersion = useRef(0)
  useEffect(() => () => { requestVersion.current++ }, [])
  const refresh = useCallback(() => { setReload(value => value + 1) }, [])
  const task = useAdminTask(refresh)
  const open = useCallback(async (id: string) => {
    const version = ++requestVersion.current
    setDetailLoading(true); setError('')
    try {
      const value = await getGameApiClient().getCatalogCandidate(id)
      if (version !== requestVersion.current) return
      currentId.current = id; setDetail(value); setValues({}); setFile(null); setReason('')
    } catch (cause) { if (version === requestVersion.current) setError(apiErrorMessage(cause)) } finally { if (version === requestVersion.current) setDetailLoading(false) }
  }, [])
  useEffect(() => { let live = true; setLoading(true); setError('')
    void getGameApiClient().getCatalogCandidates(search).then(value => { if (live) setOverview(value) })
      .catch(cause => { if (live) setError(apiErrorMessage(cause)) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [search, reload])
  useEffect(() => { if (initialId) void open(initialId) }, [initialId, open])
  useEffect(() => { if (currentId.current && reload) void open(currentId.current) }, [reload, open])
  const act = (mode: 'audit' | 'retry') => { if (detail) void task.execute(`${detail.id}:${mode}`, key => getGameApiClient().checkCatalogCandidate(detail.id, mode, key)) }
  const upload = async () => {
    if (!detail || !file) return
    if (file.size > 5 * 1024 * 1024) { task.setError('L’image doit faire au maximum 5 Mo.'); return }
    const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.onerror = reject; reader.readAsDataURL(file) })
    await task.execute(`${detail.id}:upload:${role}:${file.name}:${file.size}`, key => getGameApiClient().uploadCatalogImage(detail.id, { role, mime: file.type, base64: encoded, idempotencyKey: key }))
  }
  return <section className="panel admin-list catalog-pipeline" aria-label="Suivi des imports Character" aria-busy={loading}>
    <h2>Imports et candidats</h2><AdminFeedback error={error || task.error} notice={task.notice} />
    {overview && <p className="catalog-runtime">Vérification quotidienne Paris : {overview.enabled ? overview.dryRun ? 'simulation' : 'activée' : 'désactivée'} · Dernier succès : {date(overview.job?.lastSuccessAt)}<br />
      Publication automatique : {overview.publicationEnabled && overview.storageConfigured && !overview.dryRun ? 'activée' : 'désactivée'}.
      {!overview.storageConfigured && ' Stockage à configurer et valider avant tout nouvel import actif.'}</p>}
    <div className="admin-filters"><input aria-label="Rechercher un candidat" placeholder="Nom du candidat" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Statut des candidats" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <button type="button" onClick={refresh} disabled={loading}>Actualiser</button></div>
    {loading && <p role="status">Chargement des candidats…</p>}
    {!loading && overview && !overview.entries.filter(row => !filter || row.status === filter).length && <p>Aucun candidat dans cette sélection.</p>}
    <div className="admin-scroll-list">{overview?.entries.filter(row => !filter || row.status === filter).map(row => <article className="admin-list-row" key={row.id}>
      <div><strong>{row.name} · {statusLabels[row.status] ?? row.status}</strong><small>Vérifié : {date(row.checkedAt)} · Prochain passage : {date(row.nextCheckAt)}</small>
        <small>{row.missing.length ? `À compléter : ${row.missing.map(field => labels[field] ?? field).join(', ')}` : 'Informations et images requises disponibles.'}</small></div>
      <button type="button" disabled={detailLoading} onClick={() => void open(row.id)}>Consulter</button></article>)}</div>
    {detailLoading && <p role="status">Ouverture de la fiche…</p>}
    {overview && <details><summary>Derniers cycles</summary>{overview.runs.map(run => <p key={run.id}>{date(run.startedAt)} · {run.status === 'COMPLETED' ? 'Terminé' : run.status === 'FAILED' ? 'Échec, reprise prévue' : run.status === 'QUEUED' ? 'En attente' : 'En cours'}</p>)}</details>}
    {detail && <CatalogDialog title={`${detail.name} · ${statusLabels[detail.status] ?? detail.status}`} onClose={() => { requestVersion.current++; currentId.current = null; setDetail(null) }} pending={task.pending}>
      <AdminFeedback error={task.error || error} notice={task.notice} />
      <p>{detail.characterId ? 'Ce personnage appartient au catalogue actif. Les corrections de sa fiche passent par Modifier dans Catalogue.' : 'Candidat suivi, sans possession ni bannière créée.'}</p>
      <p>Prochaine vérification : {date(detail.nextCheckAt)}. {detail.missing.length ? `Manques : ${detail.missing.map(field => labels[field] ?? field).join(', ')}.` : 'Aucun manque fondamental.'}
        {detail.status === 'CONFLICT' ? ' Un ADMIN doit arbitrer les données contradictoires.' : ' Les sources manquantes seront réessayées automatiquement si la vérification quotidienne est activée.'}</p>
      <dl className="catalog-evidence">{Object.entries(detail.fields).map(([field, evidence]) => <div key={field}><dt>{labels[field] ?? field}</dt><dd><strong>{evidence.value}</strong>{evidence.conflict && ' · Conflit'}{evidence.override && ' · Correction ADMIN'}<small>{evidence.provider} · {date(evidence.fetchedAt)} · {sourceLink(evidence.url)}</small></dd></div>)}</dl>
      <div className="catalog-assets">{['icon', 'splash', 'wish', 'fullbody'].map(assetRole => {
        const asset = detail.assets.find(value => value.role === assetRole && value.status === 'AVAILABLE')
        const existing = detail.character?.[`${assetRole}Path` as 'iconPath']
        return <div key={assetRole}><strong>{labels[assetRole]}</strong><span>{asset ? `${asset.width}×${asset.height} · Disponible` : existing ? 'Disponible dans le catalogue' : 'Image validée manquante'}</span>{sourceLink(asset?.sourceUrl ?? null)}</div>
      })}</div>
      {detail.assets.some(asset => asset.role === 'promotion') && <details><summary>Visuels promotionnels — distincts des images du jeu</summary>{detail.assets.filter(asset => asset.role === 'promotion').map(asset => <p key={asset.id}>{sourceLink(asset.sourceUrl)} · Non publié comme portrait/splash</p>)}</details>}
      {!detail.characterId && <form className="catalog-metadata" onSubmit={event => { event.preventDefault(); const patch: Record<string, string | number> = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim())); if (patch.rarity) patch.rarity = Number(patch.rarity); void task.execute(`${detail.id}:metadata:${JSON.stringify(patch)}`, key => getGameApiClient().editCatalogCandidate(detail.id, patch, key)) }}>
        <h3>Correction ADMIN prioritaire</h3>{['name', 'originalName', 'weapon', 'region'].map(field => <label key={field}>{labels[field]}<input maxLength={100} placeholder={String(detail.fields[field]?.value ?? 'Non renseigné')} value={values[field] ?? ''} onChange={event => setValues(old => { const next = { ...old }; if (event.target.value.trim()) next[field] = event.target.value; else delete next[field]; return next })} /></label>)}
        <label>Rareté<select value={values.rarity ?? ''} onChange={event => setValues(old => ({ ...old, rarity: event.target.value }))}><option value="">Conserver / inconnue</option><option value="4">4★</option><option value="5">5★</option></select></label>
        <label>Élément<select value={values.element ?? ''} onChange={event => setValues(old => ({ ...old, element: event.target.value }))}><option value="">Conserver / inconnu</option>{elementKeys.map(element => <option key={element}>{element}</option>)}</select></label>
        <button type="submit" disabled={task.pending || !Object.values(values).some(Boolean)}>Enregistrer les corrections</button></form>}
      <section className="catalog-upload"><h3>Compléter une image manquante</h3>
        {!overview?.storageConfigured && <p>Upload indisponible : stockage serveur à configurer et vérifier.</p>}
        <label>Rôle<select value={role} onChange={event => setRole(event.target.value)}>{['icon', 'splash', 'wish', 'fullbody'].map(value => <option key={value}>{value}</option>)}</select></label>
        <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Image du personnage" disabled={!overview?.storageConfigured || task.pending} onChange={event => setFile(event.target.files?.[0] ?? null)} />
        <button type="button" disabled={!file || !overview?.storageConfigured || task.pending} onClick={() => { void upload().catch(cause => task.setError(apiErrorMessage(cause))) }}>Valider et téléverser</button></section>
      <div className="catalog-actions"><button type="button" disabled={task.pending || !overview?.enabled} onClick={() => act('audit')}>Réauditer les sources</button>
        <button type="button" disabled={task.pending || !overview?.enabled} onClick={() => act('retry')}>Réessayer la fiche</button></div>
      <small>Réauditer produit un rapport sans remplacer les données. Réessayer enrichit les manques avec les mêmes contrôles que le cycle quotidien.</small>
      {!detail.characterId && <section><h3>Exception hors fenêtre</h3><label>Motif de l’exception<input value={reason} minLength={10} maxLength={300} onChange={event => setReason(event.target.value)} /></label>
        <button type="button" disabled={task.pending || reason.trim().length < 10 || !overview?.publicationEnabled || !overview.storageConfigured || overview.dryRun} onClick={() => setConfirm(true)}>Autoriser l’import hors fenêtre…</button>
        <small>Confirmation et audit obligatoires. Cette exception ne contourne ni l’identité, ni les informations requises, ni les images validées.</small></section>}
      <details><summary>Dernières tentatives et erreurs</summary>{detail.attempts?.length ? detail.attempts.map(attempt => <p key={attempt.id}>{date(attempt.checkedAt)} · {attempt.provider} · {labels[attempt.field] ?? attempt.field} · {attempt.outcome}{attempt.httpStatus ? ` · HTTP ${attempt.httpStatus}` : ''}{attempt.errorCode ? ` · ${errorLabels[attempt.errorCode] ?? attempt.errorCode}` : ''} {sourceLink(attempt.sourceUrl)}</p>) : <p>Aucune tentative enregistrée.</p>}</details>
      {confirm && <ConfirmAction title={`Publier ${detail.name} hors fenêtre ?`} pending={task.pending} onCancel={() => setConfirm(false)} onConfirm={() => {
        void task.execute(`${detail.id}:override:${reason}:${detail.revision}`, key => getGameApiClient().overrideCatalogWindow(detail.id, reason, detail.revision, key)).then(success => { if (success) setConfirm(false) })
      }}>Motif : {reason}. La fiche entrera dans le catalogue actif si tous les autres contrôles réussissent.</ConfirmAction>}
    </CatalogDialog>}
  </section>
}
