import { useEffect, type ReactNode } from 'react'

type Props = {
  title: string
  category: string
  labelledBy: string
  page: number
  totalPages: number
  loading: boolean
  onPageChange: (page: number) => void
  onClose: () => void
  children: ReactNode
}

function HistoryModalShell({ title, category, labelledBy, page, totalPages, loading, onPageChange, onClose, children }: Props) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose])

  const safeTotalPages = Math.max(totalPages, 1)
  return <div className="history-modal-overlay" onMouseDown={onClose}>
    <section className="history-modal panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="eyebrow">{category}</span><h2 id={labelledBy}>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer l’historique"><span className="icon-glyph">×</span></button></header>
      <div className="history-modal-body">{children}</div>
      <footer className="history-modal-pagination bank-history-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>Précédent</button><span>Page {page} / {safeTotalPages}</span><button type="button" disabled={page >= safeTotalPages || loading} onClick={() => onPageChange(page + 1)}>Suivant</button></footer>
    </section>
  </div>
}

export function HistoryTablePlaceholders({ count, colSpan }: { count: number; colSpan: number }) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => <tr className="history-empty-row" aria-hidden="true" key={`empty-${index}`}><td colSpan={colSpan}>&nbsp;</td></tr>)
}

export default HistoryModalShell
