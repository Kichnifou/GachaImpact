import { useMemo, useState } from 'react'
import type { BoxCharacterDto, DailyCombatDto, MonthlyBossAttackDto, MonthlyBossCharacterDto, MonthlyBossDto, MonthlyBossHistoryDto, MonthlyBossHistoryEntryDto, MonthlyBossRecordsDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'
import GameAssetIcon from '../components/GameAssetIcon'
import BoxCharacterCard from '../components/BoxCharacterCard'
import ModalCloseButton from '../components/ModalCloseButton'
import { useModalDialog } from '../components/useModalDialog'
import { CombatBoxCharacterDetail, PlayerCombatCard, type CombatBoxBindings } from '../components/CombatPlayerFormation'

type Props = Readonly<{
  value: MonthlyBossDto
  dailyCombat?: DailyCombatDto
  box?: CombatBoxBindings
  onSetSlot: (position: number, characterId: string) => Promise<MonthlyBossDto>
  onRemoveSlot: (position: number) => Promise<MonthlyBossDto>
  onCopyActive: () => Promise<MonthlyBossDto>
  onClear: () => Promise<MonthlyBossDto>
  onAttack: (bossId: string, idempotencyKey: string) => Promise<MonthlyBossAttackDto>
  onLoadHistory: (page: number) => Promise<MonthlyBossHistoryDto>
}>

export default function MonthlyBossScreen({ value, dailyCombat, box, onSetSlot, onRemoveSlot, onCopyActive, onClear, onAttack, onLoadHistory }: Props) {
  const [picker, setPicker] = useState<number | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [calculationOpen, setCalculationOpen] = useState(false)
  const [bilanOpen, setBilanOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intent, setIntent] = useState<string | null>(null)
  const [result, setResult] = useState<MonthlyBossAttackDto['result'] | null>(null)
  const selectedIds = useMemo(() => new Set(value.loadout.slots.flatMap(({ character }) => character ? [character.id] : [])), [value.loadout.slots])
  const hpPercent = Number(BigInt(value.boss.currentHp) * 10_000n / BigInt(value.boss.maxHp)) / 100
  const mutate = async (key: string, action: () => Promise<unknown>) => { if (pending) return; setPending(key); setError(null); try { await action() } catch (reason) { setError(apiErrorMessage(reason)) } finally { setPending(null) } }
  const attack = async () => {
    if (pending) return
    const key = intent ?? crypto.randomUUID(); setIntent(key); setPending('attack'); setError(null)
    try { const next = await onAttack(value.boss.id, key); setResult(next.result); setIntent(null) }
    catch (reason) { if (!isAmbiguousMutationError(reason)) setIntent(null); setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
  }
  const status = value.status === 'DEFEATED' ? '✅ Vaincu' : 'Boss actif'
  const attackStatus = result ? `✅ Utilisée aujourd’hui · ${formatResourceAmount(result.damage)} dégâts infligés.` : value.attackState === 'USED' ? '✅ Utilisée aujourd’hui.' : value.attackState === 'DEFEATED' ? '✅ Boss vaincu ce mois-ci.' : 'Disponible'

  return <div className="monthly-boss-shell compact">
    <section className={`panel boss-identity-panel ${value.status.toLowerCase()}`}>
      <div className="boss-compact-kicker"><span>{formatMonth(value.boss.monthStart).toUpperCase()}</span><button type="button" onClick={() => setBilanOpen(true)}>Bilan →</button></div>
      <div className="boss-compact-title"><h2>{value.boss.name}</h2><div className="boss-identity-status"><strong className="boss-state-badge">{status}</strong><span className="boss-resistance"><span className="boss-resistance-label">Res :</span><span className="boss-resistance-accessible" role="img" aria-label={`Résistance ${elementLabels[value.boss.resistanceElementKey]} — dégâts ×0,5`} title={`Résistance ${elementLabels[value.boss.resistanceElementKey]} — dégâts ×0,5`}><GameAssetIcon className="boss-element-icon" src={getElementAssetPath(value.boss.resistanceElementKey)} fallback="✦" /></span></span></div></div>
      <div className="boss-hp" aria-label={`${hpPercent.toLocaleString('fr-FR')} pour cent de points de vie`}><div><span>PV</span><strong>{formatResourceAmount(value.boss.currentHp)} / {formatResourceAmount(value.boss.maxHp)}</strong><b>{hpPercent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</b></div><div className="boss-hp-track"><span style={{ width: `${hpPercent}%` }} /></div></div>
    </section>

    <section className="panel boss-command-panel compact" aria-label="Attaque du jour">
      <div className="boss-command-status"><strong>Attaque du jour</strong><span>{attackStatus}</span></div>
      <button type="button" className="small-primary-button boss-attack-button" disabled={!value.canAttack || Boolean(pending)} onClick={() => void attack()}>{pending === 'attack' ? 'Attaque…' : intent ? 'Réessayer' : 'Attaquer'}</button>
      <div className="boss-preview"><div><small>Dégâts prévus</small><strong>{value.preview ? formatResourceAmount(value.preview.totalDamage) : '—'}</strong></div><button type="button" disabled={!value.preview} onClick={() => setCalculationOpen(true)}>Détails →</button></div>
      {error && <p className="boss-feedback error" role="alert">{error}</p>}
    </section>

    {value.status === 'ALIVE' && <section className="combat-loadout-section boss-shared-loadout"><header className="combat-section-heading"><h2>Votre formation</h2><div className="combat-loadout-actions"><button type="button" disabled={Boolean(pending)} onClick={() => void mutate('copy', onCopyActive)}>Sélectionner l’équipe active</button><button type="button" disabled={Boolean(pending) || selectedIds.size === 0} onClick={() => void mutate('clear', onClear)}>Vider</button></div></header><div className="combat-card-grid combat-loadout-grid">{value.loadout.slots.map(({ position, character }) => character
      ? <PlayerCombatCard character={character} position={position} pending={Boolean(pending)} canOpenDetail={Boolean(box)} onOpenDetail={() => setDetailId(character.id)} onChange={() => setPicker(position)} onRemove={() => void mutate(`remove-${position}`, () => onRemoveSlot(position))} key={position} />
      : <button type="button" className="combat-character-card combat-empty-slot" disabled={Boolean(pending)} onClick={() => setPicker(position)} key={position}><span>{String(position).padStart(2, '0')}</span><strong>Ajouter</strong><small>Choisir un personnage</small></button>)}</div></section>}

    {picker !== null && <BossPicker value={value} position={picker} selectedIds={selectedIds} pending={Boolean(pending)} onClose={() => setPicker(null)} onSelect={(characterId) => void mutate(`slot-${picker}`, async () => { await onSetSlot(picker, characterId); setPicker(null) })} />}
    {detailId && box && <CombatBoxCharacterDetail characterId={detailId} combat={dailyCombat} bindings={box} onClose={() => setDetailId(null)} />}
    {calculationOpen && value.preview && <BossDetails value={value} onClose={() => setCalculationOpen(false)} />}
    {bilanOpen && <BossBilanModal value={value} onLoadHistory={onLoadHistory} onClose={() => setBilanOpen(false)} />}
  </div>
}

function BossBilanModal({ value, onLoadHistory, onClose }: { value: MonthlyBossDto; onLoadHistory: (page: number) => Promise<MonthlyBossHistoryDto>; onClose: () => void }) {
  const dialogRef = useModalDialog<HTMLElement>(onClose)
  const [tab, setTab] = useState<'contribution' | 'stats' | 'history'>('contribution')
  const [history, setHistory] = useState<MonthlyBossHistoryDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const loadPage = async (page: number) => { setPending(true); setError(null); try { setHistory(await onLoadHistory(page)) } catch (reason) { setError(apiErrorMessage(reason)) } finally { setPending(false) } }
  return <div className="history-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} tabIndex={-1} className="panel history-modal boss-bilan-modal" role="dialog" aria-modal="true" aria-label="Bilan Boss"><header><div><span className="eyebrow">{formatMonth(value.boss.monthStart)}</span><h2>Bilan Boss</h2></div><ModalCloseButton onClose={onClose} /></header><nav className="boss-bilan-tabs" aria-label="Sections du bilan"><button type="button" className={tab === 'contribution' ? 'active' : ''} onClick={() => setTab('contribution')}>Contribution</button><button type="button" className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>Vos statistiques Boss</button><button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); if (!history && !pending) void loadPage(1) }}>Historique</button></nav><div className="history-modal-body boss-bilan-body">
    {tab === 'contribution' && (value.status === 'DEFEATED' && value.defeatedSummary ? <DefeatedSummary value={value} /> : <LiveContribution value={value} />)}
    {tab === 'stats' && <section className="panel boss-lifetime"><h2>Vos statistiques Boss</h2><dl><Stat label="Dégâts" value={value.playerStats.totalDamage} /><Stat label="Attaques" value={value.playerStats.totalAttacks} /><Stat label="Boss participés" value={value.playerStats.totalParticipated} /><Stat label="Récompenses" value={value.playerStats.totalRewarded} /><Stat label="Coups finaux" value={value.playerStats.finalBlows} /><Stat label="Meilleur coup" value={value.playerStats.bestHit} /></dl></section>}
    {tab === 'history' && <>{error && <p role="alert">{error}</p>}<BossHistory value={history} pending={pending} onPage={loadPage} /></>}
  </div></section></div>
}

function LiveContribution({ value }: { value: MonthlyBossDto }) {
  return <section className="panel boss-ranking boss-live-contribution"><header><div><span className="eyebrow">Contribution</span><h2>Votre contribution</h2></div></header>{value.participation ? <dl className="boss-live-contribution-stats"><SummaryStat label="Rang" value={`#${value.participation.rank}`} /><SummaryStat label="Dégâts totaux" value={formatResourceAmount(value.participation.totalDamage)} /><SummaryStat label="Attaques" value={formatResourceAmount(value.participation.attackCount)} /><SummaryStat label="Meilleur coup" value={formatResourceAmount(value.participation.bestHit)} /><SummaryStat label="Part des PV max" value={`${formatBasisPoints(value.participation.contributionBasisPoints)} sur ${formatResourceAmount(value.boss.maxHp)} PV`} /></dl> : <p>Vous n’avez pas encore participé à ce Boss.</p>}<h3>Top 3</h3>{value.ranking.length ? <RankingList entries={value.ranking.slice(0, 3)} /> : <p>Aucune participation pour le moment.</p>}</section>
}

function DefeatedSummary({ value }: { value: MonthlyBossDto }) {
  const summary = value.defeatedSummary!; const records = summary.records
  return <section className="boss-defeated-grid" aria-label="Bilan mensuel du Boss vaincu">
    <article className="panel boss-summary-group"><span className="eyebrow">01</span><h2>Boss</h2><dl><SummaryStat label="Nom" value={value.boss.name} /><SummaryStat label="Mois" value={formatMonth(value.boss.monthStart)} /><SummaryStat label="Résistance" value={elementLabels[value.boss.resistanceElementKey]} /><SummaryStat label="Base" value={`${formatResourceAmount(value.boss.baseHp)} PV`} /><SummaryStat label="PV maximum" value={`${formatResourceAmount(value.boss.maxHp)} PV`} /><SummaryStat label="Victoire" value={value.boss.defeatedAt ? formatDateTime(value.boss.defeatedAt) : '—'} /><SummaryStat label="Durée" value={summary.victoryDayCount === null ? '—' : `${summary.victoryDayCount} jour${summary.victoryDayCount > 1 ? 's' : ''}`} /></dl><p className="boss-scaling-callout">{formatVictoryScaling(summary.daysRemainingAfterVictory, value.boss.nextBaseAdjustment)}</p></article>
    <article className="panel boss-summary-group"><span className="eyebrow">02</span><h2>Communauté</h2><dl><SummaryStat label="Participants" value={String(summary.community.participantCount)} /><SummaryStat label="Attaques" value={formatResourceAmount(summary.community.attackCount)} /><SummaryStat label="Dégâts totaux" value={formatResourceAmount(summary.community.totalDamage)} /><SummaryStat label="Moyenne / attaque" value={formatResourceAmount(summary.community.averageDamage)} /></dl></article>
    <article className="panel boss-summary-group boss-records-group"><span className="eyebrow">03</span><h2>Records</h2><RecordsList records={records} /><h3>Top 3 des dégâts</h3>{records.topThree.length ? <RankingList entries={records.topThree} /> : <p>Aucun classement.</p>}</article>
    <article className="panel boss-summary-group"><span className="eyebrow">04</span><h2>Votre contribution</h2>{value.participation ? <p className="boss-player-contribution">Contribution : <strong>{formatResourceAmount(value.participation.totalDamage)} dégâts</strong> · {formatResourceAmount(value.participation.attackCount)} attaque{value.participation.attackCount === '1' ? '' : 's'} · meilleur coup {formatResourceAmount(value.participation.bestHit)} · {formatBasisPoints(value.participation.contributionBasisPoints)} · #{value.participation.rank}</p> : <p>Vous n’avez pas participé à ce Boss.</p>}</article>
  </section>
}

function RankingList({ entries }: { entries: MonthlyBossRecordsDto['topThree'] }) { return <ol>{entries.map((entry) => <li key={entry.playerId}><b>#{entry.rank}</b><span>{entry.displayName}</span><strong>{formatResourceAmount(entry.totalDamage)} dégâts</strong><small>{entry.attackCount} attaque{entry.attackCount === '1' ? '' : 's'} · record {formatResourceAmount(entry.bestHit)}</small></li>)}</ol> }
function RecordsList({ records }: { records: MonthlyBossRecordsDto }) { return <dl className="boss-records-list"><SummaryStat label="Plus gros contributeur" value={records.topContributor ? `${records.topContributor.displayName} · ${formatResourceAmount(records.topContributor.totalDamage)}` : '—'} /><SummaryStat label="Plus gros coup" value={records.biggestHit ? `${records.biggestHit.displayName} · ${formatResourceAmount(records.biggestHit.damage)}` : '—'} /><SummaryStat label="Coup final" value={records.finalBlow?.displayName ?? '—'} /><SummaryStat label="Plus d’attaques" value={records.mostAttacks ? `${records.mostAttacks.displayName} · ${formatResourceAmount(records.mostAttacks.attackCount)}` : '—'} /></dl> }
function SummaryStat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function BossPicker({ value, position, selectedIds, pending, onClose, onSelect }: { value: MonthlyBossDto; position: number; selectedIds: ReadonlySet<string>; pending: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const dialogRef = useModalDialog<HTMLElement>(onClose)
  const currentId = value.loadout.slots.find((slot) => slot.position === position)?.character?.id
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section ref={dialogRef} tabIndex={-1} className="floating-panel combat-picker boss-picker" role="dialog" aria-modal="true" aria-labelledby="boss-picker-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Emplacement {position}</span><h2 id="boss-picker-title">Choisir un personnage</h2></div><ModalCloseButton onClose={onClose} /></header><div className="combat-picker-grid">{value.availableCharacters.map((character) => { const used = selectedIds.has(character.id) && character.id !== currentId; return <BoxCharacterCard character={asBossBoxCharacter(character)} disabled={pending || used} statusLabel={used ? 'Déjà sélectionné' : undefined} showFavorite={false} onOpen={() => onSelect(character.id)} onToggleFavorite={() => undefined} key={character.id} /> })}</div></section></div>
}
function asBossBoxCharacter(character: MonthlyBossCharacterDto): BoxCharacterDto { return { ...character, c6CompetitionStats: null } }
function BossDetails({ value, onClose }: { value: MonthlyBossDto; onClose: () => void }) { const dialogRef = useModalDialog<HTMLElement>(onClose); return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section ref={dialogRef} tabIndex={-1} className="floating-panel boss-details" role="dialog" aria-modal="true" aria-labelledby="boss-details-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Attaque Boss</span><h2 id="boss-details-title">Détails du calcul</h2></div><ModalCloseButton onClose={onClose} /></header><p>4★ : 500 + 150 × constellation · 5★ : 1 000 + 650 × constellation.</p><ul>{value.preview!.contributions.map((entry) => <li key={entry.characterId}><span>{entry.characterName} · C{entry.constellation}</span><strong>{formatResourceAmount(entry.damage)} dégâts{entry.resistanceApplied ? ' · résistance × 0,5' : ''}</strong></li>)}</ul><footer>Total : <strong>{formatResourceAmount(value.preview!.totalDamage)} dégâts</strong></footer></section></div> }
function BossHistory({ value, pending, onPage }: { value: MonthlyBossHistoryDto | null; pending: boolean; onPage: (page: number) => void }) {
  const [selected, setSelected] = useState<MonthlyBossHistoryEntryDto | null>(null)
  if (!value) return <section className="panel boss-history"><p>Chargement de l’historique…</p></section>
  return <section className="panel boss-history"><h2>Boss archivés</h2>{value.bosses.length ? <div>{value.bosses.map((boss) => <article key={boss.id}><div><span>{formatMonth(boss.monthStart)}</span><strong>{boss.name}</strong></div><p>{boss.status === 'DEFEATED' ? '✅ Vaincu' : `${formatResourceAmount(boss.currentHp)} PV restants`} · {boss.community.participantCount} participant{boss.community.participantCount === 1 ? '' : 's'} · {formatResourceAmount(boss.community.attackCount)} attaque{boss.community.attackCount === '1' ? '' : 's'}</p><button type="button" onClick={() => setSelected(boss)}>Détails →</button></article>)}</div> : <p>Aucun Boss archivé.</p>}<footer><button type="button" disabled={pending || value.page <= 1} onClick={() => onPage(value.page - 1)}>Précédent</button><span>{value.page} / {value.totalPages}</span><button type="button" disabled={pending || value.page >= value.totalPages} onClick={() => onPage(value.page + 1)}>Suivant</button></footer>{selected && <BossHistoryDetails boss={selected} onClose={() => setSelected(null)} />}</section>
}
function BossHistoryDetails({ boss, onClose }: { boss: MonthlyBossHistoryEntryDto; onClose: () => void }) { const dialogRef = useModalDialog<HTMLElement>(onClose); return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section ref={dialogRef} tabIndex={-1} className="floating-panel boss-history-details" role="dialog" aria-modal="true" aria-labelledby="boss-history-details-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">{formatMonth(boss.monthStart)}</span><h2 id="boss-history-details-title">{boss.name}</h2></div><ModalCloseButton onClose={onClose} /></header><div className="boss-history-details-body"><section><h3>Boss</h3><dl><SummaryStat label="Résistance" value={elementLabels[boss.resistanceElementKey]} /><SummaryStat label="Base" value={`${formatResourceAmount(boss.baseHp)} PV`} /><SummaryStat label="PV maximum" value={`${formatResourceAmount(boss.maxHp)} PV`} /><SummaryStat label="PV restants" value={`${formatResourceAmount(boss.currentHp)} PV`} /><SummaryStat label="Statut" value={boss.status === 'DEFEATED' ? 'Vaincu' : 'Non vaincu'} /></dl></section><section><h3>Communauté</h3><dl><SummaryStat label="Participants" value={String(boss.community.participantCount)} /><SummaryStat label="Attaques" value={formatResourceAmount(boss.community.attackCount)} /><SummaryStat label="Dégâts totaux" value={formatResourceAmount(boss.community.totalDamage)} /></dl></section><section><h3>Records</h3><RecordsList records={boss.records} /></section><p className="boss-scaling-callout">{boss.status === 'DEFEATED' ? formatVictoryScaling(boss.daysRemainingAfterVictory, boss.nextBaseAdjustment) : `${formatResourceAmount(boss.currentHp)} PV restants → ${formatSignedAmount(boss.nextBaseAdjustment)} baseHp le mois suivant`}</p></div></section></div> }
function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{formatResourceAmount(value)}</dd></div> }
function formatMonth(value: string) { return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) }
function formatBasisPoints(value: string) { const points = BigInt(value); return `${points / 100n},${(points % 100n).toString().padStart(2, '0')} %` }
function formatVictoryScaling(days: number | null, adjustment: string | null) { return days === null || adjustment === null ? 'Scaling du prochain Boss indisponible.' : `${days} jour${days > 1 ? 's' : ''} d’avance → ${formatSignedAmount(adjustment)} baseHp le mois prochain` }
function formatSignedAmount(value: string) { const amount = BigInt(value); return `${amount >= 0n ? '+' : '−'}${formatResourceAmount((amount < 0n ? -amount : amount).toString())}` }
