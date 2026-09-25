import { useEffect, useState } from 'react'
import type { BankHistoryDto, BannerHistoryDto, EventHistoryDto, GachaHistoryDto, ShopEffectDto, ShopHistoryDto } from '../api/types'
import AppButton from '../components/AppButton'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import './history.css'

export type HistoryCategory = 'invocations' | 'banners' | 'bank' | 'shop' | 'event'
type BankFilter = 'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST'
type Page = GachaHistoryDto | BannerHistoryDto | BankHistoryDto | ShopHistoryDto | EventHistoryDto
type Props = {
  initialCategory?: HistoryCategory
  onInvocations: (page: number) => Promise<GachaHistoryDto>
  onBannersOrEvent: (category: 'banners' | 'event', page: number) => Promise<BannerHistoryDto | EventHistoryDto>
  onBank: (page: number, type?: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST') => Promise<BankHistoryDto>
  onShop: (page: number) => Promise<ShopHistoryDto>
}
const categories: readonly { id: HistoryCategory; label: string }[] = [
  { id: 'invocations', label: 'Invocations' }, { id: 'banners', label: 'Bannières' },
  { id: 'bank', label: 'Banque' }, { id: 'shop', label: 'Boutique' }, { id: 'event', label: 'Event' },
]
const bankFilters: readonly { id: BankFilter; label: string }[] = [
  { id: 'ALL', label: 'Tout' }, { id: 'DEPOSIT', label: 'Dépôts' },
  { id: 'WITHDRAWAL', label: 'Retraits' }, { id: 'INTEREST', label: 'Intérêts' },
]
const date = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(value))
const number = (value: number) => new Intl.NumberFormat('fr-FR').format(value)
const effectLabel = (effect: ShopEffectDto) => effect.type === 'resource_bundle' ? `+${formatResourceAmount(effect.amount)} Primos`
  : effect.type === 'ticket_pity5' ? `+${effect.grantedAmount} Pity 5★`
    : effect.type === 'ticket_other_element_particles' || effect.type === 'ticket_main_element_particles' ? `+${formatResourceAmount(effect.amount)} particules ${effect.elementKey}` : effect.label

export default function HistoryScreen({ initialCategory = 'invocations', onInvocations, onBannersOrEvent, onBank, onShop }: Props) {
  const [category, setCategory] = useState<HistoryCategory>(initialCategory)
  const [page, setPage] = useState(1)
  const [bankFilter, setBankFilter] = useState<BankFilter>('ALL')
  const [loaded, setLoaded] = useState<{ category: HistoryCategory; page: number; filter: BankFilter; value: Page } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    const promise = category === 'invocations' ? onInvocations(page)
      : category === 'bank' ? onBank(page, bankFilter === 'ALL' ? undefined : bankFilter)
        : category === 'shop' ? onShop(page) : onBannersOrEvent(category, page)
    void promise.then(value => { if (active) setLoaded({ category, page, filter: bankFilter, value }) })
      .catch(reason => { if (active) setError(apiErrorMessage(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [category, page, bankFilter, revision, onInvocations, onBannersOrEvent, onBank, onShop])

  const value = !error && loaded?.category === category && loaded.page === page && loaded.filter === bankFilter ? loaded.value : null
  const totalPages = Math.max(1, value?.totalPages ?? 1)
  const choose = (next: HistoryCategory) => { if (next === category) return; setLoading(true); setError(null); setCategory(next); setPage(1) }
  const changeFilter = (next: BankFilter) => { if (next === bankFilter) return; setLoading(true); setError(null); setBankFilter(next); setPage(1) }
  const turnPage = (next: number) => { setLoading(true); setError(null); setPage(next) }
  return <div className="screen-content history-screen long-screen-layout">
    <ScreenHeader eyebrow="ARCHIVES" title="Historique" />
    <ScrollableScreenPanel className="history-frame" bodyClassName="history-body" fixed={<div className="history-controls">
      <div className="history-tabs" role="tablist" aria-label="Catégories de l’historique">{categories.map(item => <AppButton key={item.id} role="tab" aria-selected={category === item.id} className={category === item.id ? 'active' : ''} onClick={() => choose(item.id)}>{item.label}</AppButton>)}</div>
      {category === 'bank' && <div className="history-filters" role="group" aria-label="Filtrer les opérations bancaires">{bankFilters.map(item => <AppButton key={item.id} aria-pressed={bankFilter === item.id} className={bankFilter === item.id ? 'active' : ''} onClick={() => changeFilter(item.id)}>{item.label}</AppButton>)}</div>}
    </div>} footer={value && <div className="history-pagination"><AppButton disabled={page <= 1} onClick={() => turnPage(page - 1)}>Précédent</AppButton><span>Page {page} / {totalPages}</span><AppButton disabled={page >= totalPages} onClick={() => turnPage(page + 1)}>Suivant</AppButton></div>}>
      {error && <div role="alert" className="history-error"><p>{error}</p><AppButton onClick={() => { setLoading(true); setError(null); setRevision(n => n + 1) }}>Réessayer</AppButton></div>}
      {loading && <p role="status">Chargement de l’historique…</p>}
      {!loading && !error && category === 'invocations' && value && 'results' in value && (value.results.length ? <ol className="history-list">{value.results.map((item, index) => <li key={`${item.operationId}:${item.index}:${index}`}><strong>{item.character?.name ?? (item.resourceAmount ? `${formatResourceAmount(item.resourceAmount)} ${item.resourceKey ?? ''}` : 'Résultat')}</strong><span>{item.rarity ? `${item.rarity}★ · ` : ''}{date(item.occurredAt)}</span><small>Tirage {item.operationPullCount} · Pity 5★ {item.pity5AtPull ?? '—'} · Pity 4★ {item.pity4AtPull ?? '—'}</small></li>)}</ol> : <p>Aucune invocation enregistrée.</p>)}
      {!loading && !error && category === 'banners' && value && 'category' in value && value.category === 'banners' && (value.entries.length ? <div className="history-cards">{value.entries.map(entry => <article className="history-card" key={entry.id}><h2>Bannière du {date(entry.startsAt)}</h2><p>Du {date(entry.startsAt)} au {date(entry.endsAt)} · Statut : {entry.status === "ACTIVE" ? "active" : "terminée"}</p><p><strong>Sélection :</strong> {entry.featured.filter(item => item.rarity === 5).length} personnages 5★ · {entry.featured.filter(item => item.rarity === 4).length} personnages 4★</p><ul className="history-featured">{entry.featured.map(item => <li key={item.characterId}>{item.rarity}★ · {item.name} · {item.source === "COMMUNITY_VOTE" ? "vote communautaire" : item.source === "RANDOM_FALLBACK" ? "tirage de départage" : "tirage aléatoire"}{item.rarity === 5 && item.slot === 4 ? " · slot communautaire" : ""}</li>)}</ul>{entry.generationVoteSnapshot ? <><p><strong>Choix communauté :</strong> {entry.generationVoteSnapshot.selectedCharacterName} · {entry.generationVoteSnapshot.selectionSource === 'COMMUNITY_VOTE' ? 'votes' : 'tirage de départage'}</p><ul className="history-votes">{entry.generationVoteSnapshot.candidates.map(candidate => <li key={candidate.characterId}>{candidate.characterName} <strong>{number(candidate.voteCount)} vote{candidate.voteCount > 1 ? 's' : ''}</strong></li>)}</ul></> : <p>Snapshot détaillé des votes indisponible pour cette rotation antérieure.</p>}</article>)}</div> : <p>Aucune bannière enregistrée.</p>)}
      {!loading && !error && category === 'bank' && value && 'operations' in value && (value.operations.length ? <ol className="history-list">{value.operations.map(item => <li key={item.id}><strong>{item.type === 'DEPOSIT' ? 'Dépôt' : item.type === 'WITHDRAWAL' ? 'Retrait' : 'Intérêt quotidien'} · {item.type === 'WITHDRAWAL' ? '−' : '+'}{formatResourceAmount(item.amount)} Moras</strong><span>{date(item.createdAt)}</span><small>Banque : {formatResourceAmount(item.bankBalanceAfter)} · Portefeuille : {item.walletBalanceAfter === null ? '—' : formatResourceAmount(item.walletBalanceAfter)}</small></li>)}</ol> : <p>Aucune opération enregistrée pour ce filtre.</p>)}
      {!loading && !error && category === 'shop' && value && 'purchases' in value && (value.purchases.length ? <ol className="history-list">{value.purchases.map(item => <li key={item.id}><strong>{item.displayName} × {formatResourceAmount(item.quantity)}</strong><span>{date(item.purchasedAt)}</span><small>−{formatResourceAmount(item.totalPrice)} Moras · {effectLabel(item.effect)}</small></li>)}</ol> : <p>Aucun achat enregistré.</p>)}
      {!loading && !error && category === 'event' && value && 'category' in value && value.category === 'event' && (value.entries.length ? <div className="history-cards">{value.entries.map(entry => <article className="history-card" key={entry.id}><h2>{entry.festival} · {new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "Europe/Paris" }).format(new Date(Date.UTC(entry.year, entry.month - 1, 1)))} {entry.year}</h2><p>Du {date(entry.startsAt)} au {date(entry.endsAt)} · {number(entry.participantCount)} participant{entry.participantCount > 1 ? 's' : ''}</p><h3>Top 10</h3>{entry.top.length ? <ol className="history-event-top">{entry.top.map(row => <li key={row.playerId}><span>#{row.rank} {row.displayName}</span><strong>{number(row.points)} points</strong></li>)}</ol> : <p>Aucun participant.</p>}<h3>Votre édition</h3>{entry.personal ? <p>Rang #{entry.personal.rank} · {number(entry.personal.points)} points · Paliers réclamés : {entry.personal.milestones.length ? entry.personal.milestones.join(', ') : 'aucun'} · Collection : {entry.personal.collectionAcquired ? entry.personal.collectionItemName ?? 'obtenue' : 'non obtenue'}</p> : <p>Vous n’avez pas participé à cette édition.</p>}</article>)}</div> : <p>Aucune édition terminée enregistrée.</p>)}
    </ScrollableScreenPanel>
  </div>
}
