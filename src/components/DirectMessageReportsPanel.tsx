import { useEffect, useState } from "react";
import { getGameApiClient } from "../api/game-api";
import type {
  DirectMessageReportDetailDto,
  DirectMessageReportPageDto,
} from "../api/types";
import { apiErrorMessage } from "../utils/formatters";

export default function DirectMessageReportsPanel() {
  const [page, setPage] = useState(1),
    [list, setList] = useState<DirectMessageReportPageDto | null>(null);
  const [detail, setDetail] = useState<DirectMessageReportDetailDto | null>(
      null,
    ),
    [pending, setPending] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void getGameApiClient()
      .getDirectMessageReports(page)
      .then((value) => {
        if (current) setList(value);
      })
      .catch((reason) => {
        if (current) setError(apiErrorMessage(reason));
      })
      .finally(() => {
        if (current) setPending(false);
      });
    return () => {
      current = false;
    };
  }, [page]);
  const open = async (id: string) => {
    setPending(true);
    setError("");
    try {
      setDetail(await getGameApiClient().getDirectMessageReport(id));
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setPending(false);
    }
  };
  const changePage = (next: number) => {
    setPending(true);
    setError("");
    setPage(next);
  };
  if (detail)
    return (
      <section
        className="panel dm-reports-panel"
        aria-label="Détail du signalement MP"
      >
        <header>
          <div>
            <span className="eyebrow">Signalement MP</span>
            <h2>{detail.reported.displayName}</h2>
            <small>
              Signalé par {detail.reporter.displayName} ·{" "}
              {new Date(detail.createdAt).toLocaleString("fr-FR")}
            </small>
          </div>
          <button type="button" onClick={() => setDetail(null)}>
            Retour à la liste
          </button>
        </header>
        <div className="dm-moderation-context">
          {detail.context.map((line) => (
            <article
              key={line.id}
              className={line.id === detail.message.id ? "target" : ""}
            >
              <strong>{line.authorDisplayName}</strong>
              <p>{line.content ?? "Message supprimé"}</p>
              <time dateTime={line.createdAt}>
                {new Date(line.createdAt).toLocaleString("fr-FR")}
              </time>
            </article>
          ))}
        </div>
      </section>
    );
  return (
    <section
      className="panel dm-reports-panel"
      aria-label="Signalements MP"
      aria-busy={pending}
    >
      <header>
        <div>
          <span className="eyebrow">Communauté</span>
          <h2>Signalements MP</h2>
        </div>
        <span className="dm-report-source">MP</span>
      </header>
      {error && (
        <p className="moderation-feedback error" role="alert">
          {error}
        </p>
      )}
      <div className="dm-reports-list">
        {!list && pending ? (
          <p>Chargement…</p>
        ) : list?.reports.length ? (
          list.reports.map((report) => (
            <button
              type="button"
              key={report.id}
              onClick={() => void open(report.id)}
            >
              <span>
                <strong>{report.reported.displayName}</strong>
                <small>Signalé par {report.reporter.displayName}</small>
              </span>
              <span className="dm-report-excerpt">
                {report.message.content ?? "Message supprimé"}
              </span>
              <time dateTime={report.createdAt}>
                {new Date(report.createdAt).toLocaleString("fr-FR")}
              </time>
              <b>MP</b>
            </button>
          ))
        ) : (
          <p>Aucun signalement MP.</p>
        )}
      </div>
      {list && (
        <footer>
          <button
            type="button"
            disabled={pending || list.page <= 1}
            onClick={() => changePage(list.page - 1)}
          >
            Précédent
          </button>
          <span>
            Page {list.page} / {list.totalPages}
          </span>
          <button
            type="button"
            disabled={pending || list.page >= list.totalPages}
            onClick={() => changePage(list.page + 1)}
          >
            Suivant
          </button>
        </footer>
      )}
    </section>
  );
}
