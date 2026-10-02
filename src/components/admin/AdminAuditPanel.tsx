import { useEffect, useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { AdminAudit, AdminAuditPage } from '../../api/admin-types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, AdminPager } from './AdminUi'
import { adminAuditTitle, adminAuditDomain, adminAuditAction } from '../../moderation/admin-audit-presentation'

export default function AdminAuditPanel() {
  const [page, setPage] = useState(1)
  const [domain, setDomain] = useState('')
  const [action, setAction] = useState('')
  const [list, setList] = useState<AdminAuditPage | null>(null)
  const [detail, setDetail] = useState<AdminAudit | null>(null)
  const [error, setError] = useState('')
  const facets = list?.facets ?? []
  const domains = [...new Set([...facets.map(entry => entry.domain), ...(domain ? [domain] : [])])].sort()
  const actions = [...new Set([...facets.filter(entry => !domain || entry.domain === domain).map(entry => entry.action), ...(action ? [action] : [])])].sort()
  useEffect(() => { let live = true; setError('')
    void getGameApiClient().getAdminAudit({ page, domain: domain || undefined, action: action || undefined })
      .then(value => { if (live) setList(value) }).catch(reason => { if (live) setError(apiErrorMessage(reason)) })
    return () => { live = false }
  }, [page, domain, action])
  const open = async (id: string) => { try { setDetail(await getGameApiClient().getAdminAuditDetail(id)) }
    catch (reason) { setError(apiErrorMessage(reason)) } }
  return <section className="panel admin-list" aria-label="Journal Admin"><AdminFeedback error={error} />
    <div className="admin-filters"><label>Domaine<select aria-label="Domaine" value={domain} onChange={event => {
      const next = event.target.value; setDomain(next); setPage(1)
      if (action && !facets.some(entry => (!next || entry.domain === next) && entry.action === action)) setAction('')
    }}><option value="">Tous les domaines</option>{domains.map(value => <option key={value} value={value}>{adminAuditDomain(value)}</option>)}</select></label>
      <label>Action<select aria-label="Action" value={action} onChange={event => { setAction(event.target.value); setPage(1) }}><option value="">Toutes les actions</option>
        {actions.map(value => <option key={value} value={value}>{adminAuditAction(value)}</option>)}</select></label></div>
    {detail ? <div className="admin-audit-detail"><header className="admin-audit-heading"><div><button type="button" onClick={() => setDetail(null)}>Retour</button></div><h3>{adminAuditTitle(detail.domain, detail.action)}</h3>
      <p>{new Date(detail.createdAt).toLocaleString('fr-FR')} · {detail.actorName} → {detail.targetName}</p><small>Opération {detail.operationId}</small></header>
      <div className="admin-audit-values"><section><h4>Avant</h4><pre>{JSON.stringify(detail.before, null, 2)}</pre></section><section><h4>Après</h4><pre>{JSON.stringify(detail.after, null, 2)}</pre></section></div></div>
      : <><div className="admin-scroll-list">{list?.entries.map(entry => <button type="button" key={entry.id} className="admin-list-row" onClick={() => void open(entry.id)}>
        <time dateTime={entry.createdAt}><span>{new Date(entry.createdAt).toLocaleDateString('fr-FR')}</span><span>{new Date(entry.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></time><strong>{adminAuditTitle(entry.domain, entry.action)}</strong>
        <span className="admin-audit-participants">{entry.actorName} → {entry.targetName}</span></button>)}
        {!list?.entries.length && <p>Aucune entrée.</p>}</div>{list && <AdminPager page={list.page} totalPages={list.totalPages} onPage={setPage} />}</>}
  </section>
}
