import { useEffect, useState } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { AdminChatReport, AdminPage } from '../../api/admin-types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, AdminPager, ConfirmAction, useAdminTask } from './AdminUi'

function line(value: unknown): { id: string; content: string; createdAt: string; deletionState: string } {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return { id: String(row.id ?? ''), content: String(row.content ?? ''), createdAt: String(row.createdAt ?? ''), deletionState: String(row.deletionState ?? '') }
}

export default function GlobalChatReportsPanel() {
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [list, setList] = useState<AdminPage<AdminChatReport> | null>(null)
  const [detail, setDetail] = useState<AdminChatReport | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'moderate' | 'delete'; reportId: string; reportedName: string } | null>(null)
  const [loadError, setLoadError] = useState('')
  const task = useAdminTask(() => setReload(value => value + 1))
  useEffect(() => { let live = true
    void getGameApiClient().getAdminChatReports(page).then(value => { if (live) setList(value) })
      .catch(error => { if (live) setLoadError(apiErrorMessage(error)) })
    return () => { live = false }
  }, [page, reload])
  const open = async (id: string) => { setLoadError('')
    try { setDetail(await getGameApiClient().getAdminChatReport(id)) }
    catch (error) { setLoadError(apiErrorMessage(error)) }
  }
  const apply = async (intent: NonNullable<typeof confirm>) => {
    const success = await task.execute(JSON.stringify(intent), key => intent.kind === 'moderate'
      ? getGameApiClient().moderateAdminChatMessage(intent.reportId, key) : getGameApiClient().deleteAdminChatReport(intent.reportId, key))
    if (success) setConfirm(null)
    if (success && intent.kind === 'delete') setDetail(null)
    else if (success) void open(intent.reportId)
  }
  const context = Array.isArray(detail?.contextSnapshot) ? detail.contextSnapshot.map(line) : []
  return <section className="panel dm-reports-panel admin-chat-reports" aria-label="Signalements Chat global" aria-busy={task.pending}>
    <header><div><span className="eyebrow">Communauté</span><h2>Signalements Chat global</h2></div>{detail && <button type="button" onClick={() => setDetail(null)}>Retour</button>}</header>
    <AdminFeedback error={task.error || loadError} notice={task.notice} />
    {detail ? <><p>Message de {detail.reported.displayName}, signalé par {detail.reporter.displayName} le {new Date(detail.createdAt).toLocaleString('fr-FR')}.</p>
      <p>État source : {detail.message.deletionState}</p>
      <div className="dm-moderation-context admin-scroll-list">{context.map((entry, index) => <article key={`${entry.id}-${index}`} className={entry.id === detail.messageId ? 'target' : ''}>
        <p>{entry.content || 'Message supprimé'}</p><small>{entry.deletionState} · {entry.createdAt && new Date(entry.createdAt).toLocaleString('fr-FR')}</small></article>)}</div>
      <div className="dm-report-detail-actions"><button type="button" disabled={task.pending || detail.message.deletionState !== 'ACTIVE'} onClick={() => setConfirm({ kind: 'moderate', reportId: detail.id, reportedName: detail.reported.displayName })}>Modérer le message source</button>
        <button type="button" className="danger" disabled={task.pending} onClick={() => setConfirm({ kind: 'delete', reportId: detail.id, reportedName: detail.reported.displayName })}>Supprimer le dossier</button></div></>
      : <><div className="dm-reports-list admin-scroll-list">{list?.entries.map(report => <button type="button" className="dm-report-row" key={report.id} onClick={() => void open(report.id)}>
        <strong>{report.reported.displayName}</strong><span>Signalé par {report.reporter.displayName}</span><span>{line(report.messageSnapshot).content}</span>
        <time>{new Date(report.createdAt).toLocaleString('fr-FR')}</time></button>)}
        {!list?.entries.length && <p>Aucun signalement Chat.</p>}</div>{list && <AdminPager page={list.page} totalPages={list.totalPages} onPage={setPage} pending={task.pending} />}</>}
    {confirm && <ConfirmAction title={confirm.kind === 'moderate' ? `Modérer le message signalé de ${confirm.reportedName} ?` : `Supprimer le dossier concernant ${confirm.reportedName} ?`}
      pending={task.pending} onCancel={() => setConfirm(null)} onConfirm={() => void apply(confirm)}>
      {confirm.kind === 'moderate' ? 'Le message conservera sa place mais son contenu sera masqué pour les joueurs. Le snapshot du dossier restera intact.' : 'Seul le dossier gelé sera supprimé ; le message source restera en place.'}
    </ConfirmAction>}
  </section>
}
