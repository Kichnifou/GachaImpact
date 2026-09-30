import { useEffect, useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { AdminAudit, AdminPage } from '../../api/admin-types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, AdminPager } from './AdminUi'

export default function AdminAuditPanel() {
  const [page, setPage] = useState(1)
  const [domain, setDomain] = useState('')
  const [action, setAction] = useState('')
  const [list, setList] = useState<AdminPage<AdminAudit> | null>(null)
  const [detail, setDetail] = useState<AdminAudit | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { let live = true; setError('')
    void getGameApiClient().getAdminAudit({ page, domain: domain || undefined, action: action || undefined })
      .then(value => { if (live) setList(value) }).catch(reason => { if (live) setError(apiErrorMessage(reason)) })
    return () => { live = false }
  }, [page, domain, action])
  const open = async (id: string) => { try { setDetail(await getGameApiClient().getAdminAuditDetail(id)) }
    catch (reason) { setError(apiErrorMessage(reason)) } }
  return <section className="panel admin-list" aria-label="Journal Admin"><header><h2>Journal Admin</h2></header><AdminFeedback error={error} />
    <div className="admin-filters"><label>Domaine<input value={domain} onChange={event => { setDomain(event.target.value); setPage(1) }} /></label>
      <label>Action<input value={action} onChange={event => { setAction(event.target.value); setPage(1) }} /></label></div>
    {detail ? <div className="admin-audit-detail"><button type="button" onClick={() => setDetail(null)}>Retour</button><h3>{detail.domain} · {detail.action}</h3>
      <p>{new Date(detail.createdAt).toLocaleString('fr-FR')} · {detail.actorName} → {detail.targetName}</p><small>Opération {detail.operationId}</small>
      <div><section><h4>Avant</h4><pre>{JSON.stringify(detail.before, null, 2)}</pre></section><section><h4>Après</h4><pre>{JSON.stringify(detail.after, null, 2)}</pre></section></div></div>
      : <><div className="admin-scroll-list">{list?.entries.map(entry => <button type="button" key={entry.id} className="admin-list-row" onClick={() => void open(entry.id)}>
        <time>{new Date(entry.createdAt).toLocaleString('fr-FR')}</time><strong>{entry.domain} · {entry.action}</strong>
        <span>{entry.actorName} → {entry.targetName}</span><small>{JSON.stringify(entry.after).slice(0, 160)}</small></button>)}
        {!list?.entries.length && <p>Aucune entrée.</p>}</div>{list && <AdminPager page={list.page} totalPages={list.totalPages} onPage={setPage} />}</>}
  </section>
}
