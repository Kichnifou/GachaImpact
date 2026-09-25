import { useEffect, useState } from "react";
import { getGameApiClient } from "../api/game-api";
import type {
  DirectMessageReportDetailDto,
  DirectMessageReportPageDto,
  DirectMessageReportSummaryDto,
} from "../api/types";
import { apiErrorMessage } from "../utils/formatters";

export default function DirectMessageReportsPanel() {
  const [page, setPage] = useState(1),
    [reload, setReload] = useState(0),
    [list, setList] = useState<DirectMessageReportPageDto | null>(null);
  const [detail, setDetail] = useState<DirectMessageReportDetailDto | null>(null),
    [deleteTarget, setDeleteTarget] = useState<DirectMessageReportSummaryDto | null>(null),
    [pending, setPending] = useState(true),
    [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void getGameApiClient().getDirectMessageReports(page)
      .then((value) => { if (current) setList(value); })
      .catch((reason) => { if (current) setError(apiErrorMessage(reason)); })
      .finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [page, reload]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const open = async (id: string) => {
    setPending(true);
    setError("");
    try { setDetail(await getGameApiClient().getDirectMessageReport(id)); }
    catch (reason) { setError(apiErrorMessage(reason)); }
    finally { setPending(false); }
  };
  const changePage = (next: number) => {
    setPending(true);
    setError("");
    setPage(next);
  };
  const remove = async (report: DirectMessageReportSummaryDto) => {
    setDeleteTarget(null);
    setPending(true);
    setError("");
    try {
      await getGameApiClient().deleteDirectMessageReport(report.id);
      setDetail((current) => (current?.id === report.id ? null : current));
      const previousPage = page > 1 && list?.reports.length === 1;
      setList((current) => current ? {
        ...current,
        reports: current.reports.filter((item) => item.id !== report.id),
        total: Math.max(0, current.total - 1),
        totalPages: Math.max(1, Math.ceil(Math.max(0, current.total - 1) / current.pageSize)),
      } : current);
      if (previousPage) setPage((current) => current - 1);
      else setReload((current) => current + 1);
    } catch (reason) { setError(apiErrorMessage(reason)); }
    finally { setPending(false); }
  };

  const confirmation = deleteTarget && (
    <div className="moderation-delete-overlay" onPointerDown={(event) => {
      if (event.target === event.currentTarget) setDeleteTarget(null);
    }}>
      <div className="moderation-delete-confirm" role="dialog" aria-modal="true" aria-label="Supprimer ce signalement ?">
        <strong>Supprimer ce signalement ?</strong>
        <div>
          <button type="button" onClick={() => void remove(deleteTarget)}>Confirmer</button>
          <button type="button" onClick={() => setDeleteTarget(null)}>Annuler</button>
        </div>
      </div>
    </div>
  );

  if (detail)
    return (
      <section className="panel dm-reports-panel" aria-label="Détail du signalement MP" aria-busy={pending}>
        <header>
          <div>
            <span className="eyebrow">Signalement MP</span>
            <h2>{detail.reported.displayName}</h2>
            <small>Signalé par {detail.reporter.displayName} · {new Date(detail.createdAt).toLocaleString("fr-FR")}</small>
          </div>
          <div className="dm-report-detail-actions">
            <button type="button" onClick={() => setDetail(null)}>Retour à la liste</button>
            <button type="button" className="danger" onClick={() => setDeleteTarget(detail)}>Supprimer</button>
          </div>
        </header>
        {error && <p className="moderation-feedback error" role="alert">{error}</p>}
        <div className="dm-moderation-context">
          {detail.context.map((line) => (
            <article key={line.id} className={line.id === detail.message.id ? "target" : ""}>
              <strong>{line.authorDisplayName}</strong>
              {line.replyToMessageId && <div className="dm-reply-preview">↳ {line.replyPreview ?? "Message supprimé"}</div>}
              <p>{line.content ?? "Message supprimé"}</p>
              <time dateTime={line.createdAt}>{new Date(line.createdAt).toLocaleString("fr-FR")}</time>
            </article>
          ))}
        </div>
        {confirmation}
      </section>
    );

  return (
    <section className="panel dm-reports-panel" aria-label="Signalements MP" aria-busy={pending}>
      <header>
        <div><span className="eyebrow">Communauté</span><h2>Signalements MP</h2></div>
        <span className="dm-report-source">MP</span>
      </header>
      {error && <p className="moderation-feedback error" role="alert">{error}</p>}
      <div className="dm-reports-list">
        {!list && pending ? <p>Chargement…</p> : list?.reports.length ? list.reports.map((report) => (
          <div className="dm-report-row" key={report.id}>
            <button type="button" className="dm-report-open" onClick={() => void open(report.id)}>
              <span><strong>{report.reported.displayName}</strong><small>Signalé par {report.reporter.displayName}</small></span>
              <span className="dm-report-excerpt">{report.message.content ?? "Message supprimé"}</span>
              <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("fr-FR")}</time><b>MP</b>
            </button>
            <button type="button" className="dm-report-delete" aria-label={`Supprimer le signalement de ${report.reported.displayName}`} onClick={() => setDeleteTarget(report)}>×</button>
          </div>
        )) : <p>Aucun signalement MP.</p>}
      </div>
      {list && <footer>
        <button type="button" disabled={pending || list.page <= 1} onClick={() => changePage(list.page - 1)}>Précédent</button>
        <span>Page {list.page} / {list.totalPages}</span>
        <button type="button" disabled={pending || list.page >= list.totalPages} onClick={() => changePage(list.page + 1)}>Suivant</button>
      </footer>}
      {confirmation}
    </section>
  );
}
