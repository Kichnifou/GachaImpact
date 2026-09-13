import { useEffect, useMemo, useState } from 'react'
import type { MonthlyBossAttackDto, MonthlyBossDto, MonthlyBossHistoryDto } from '../api/types'
import CharacterAssetImage from '../components/CharacterAssetImage'
import GameAssetIcon from '../components/GameAssetIcon'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'

type Props = Readonly<{
  value: MonthlyBossDto
  onSetSlot: (position: number, characterId: string) => Promise<MonthlyBossDto>
  onRemoveSlot: (position: number) => Promise<MonthlyBossDto>
  onCopyActive: () => Promise<MonthlyBossDto>
  onClear: () => Promise<MonthlyBossDto>
  onAttack: (bossId: string, idempotencyKey: string) => Promise<MonthlyBossAttackDto>
  onLoadHistory: (page: number) => Promise<MonthlyBossHistoryDto>
}>

export default function MonthlyBossScreen({ value, onSetSlot, onRemoveSlot, onCopyActive, onClear, onAttack, onLoadHistory }: Props) {
  const [section, setSection] = useState<'current' | 'history'>('current')
  const [picker, setPicker] = useState<number | null>(null)
  const [details, setDetails] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intent, setIntent] = useState<string | null>(null)
  const [result, setResult] = useState<MonthlyBossAttackDto['result'] | null>(null)
  const [history, setHistory] = useState<MonthlyBossHistoryDto | null>(null)
  const selectedIds = useMemo(() => new Set(value.loadout.slots.flatMap(({ character }) => character ? [character.id] : [])), [value.loadout.slots])
  const hpPercent = Number(BigInt(value.boss.currentHp) * 10_000n / BigInt(value.boss.maxHp)) / 100

  useEffect(() => { if (section === 'history' && !history) void onLoadHistory(1).then(setHistory).catch((reason) => setError(apiErrorMessage(reason))) }, [history, onLoadHistory, section])
  const mutate = async (key: string, action: () => Promise<unknown>) => { if (pending) return; setPending(key); setError(null); try { await action() } catch (reason) { setError(apiErrorMessage(reason)) } finally { setPending(null) } }
  const attack = async () => {
    if (pending) return
    const key = intent ?? crypto.randomUUID(); setIntent(key); setPending('attack'); setError(null)
    try { const next = await onAttack(value.boss.id, key); setResult(next.result); setIntent(null) }
    catch (reason) { if (!isAmbiguousMutationError(reason)) setIntent(null); setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
  }
  const loadPage = async (page: number) => { setPending('history'); setError(null); try { setHistory(await onLoadHistory(page)) } catch (reason) { setError(apiErrorMessage(reason)) } finally { setPending(null) } }

  return <div className="monthly-boss-shell">
    <nav className="boss-inner-tabs" aria-label="Sections Boss"><button type="button" className={section === 'current' ? 'active' : ''} onClick={() => setSection('current')}>Boss actuel</button><button type="button" className={section === 'history' ? 'active' : ''} onClick={() => setSection('history')}>Historique</button></nav>
    {section === 'history' ? <BossHistory value={history} pending={pending === 'history'} onPage={loadPage} /> : <>
      <section className={`panel boss-identity-panel ${value.status.toLowerCase()}`}>
        <div className="boss-identity-copy"><span className="eyebrow">{formatMonth(value.boss.monthStart)}</span><h2>{value.boss.name}</h2><p><ElementBadge element={value.boss.resistanceElementKey} /> Résistance {elementLabels[value.boss.resistanceElementKey]} · dégâts correspondants divisés par deux.</p></div>
        <strong className="boss-state-badge">{value.status === 'DEFEATED' ? '✅ Vaincu' : 'Boss actif'}</strong>
        <div className="boss-hp" aria-label={`${hpPercent.toLocaleString('fr-FR')} pour cent de points de vie`}><div><span>PV</span><strong>{formatResourceAmount(value.boss.currentHp)} / {formatResourceAmount(value.boss.maxHp)}</strong><b>{hpPercent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</b></div><div className="boss-hp-track"><span style={{ width: `${hpPercent}%` }} /></div></div>
        {value.status === 'DEFEATED' && <p className="boss-defeat-summary">Vaincu {value.boss.finalBlowPlayer ? `par ${value.boss.finalBlowPlayer.displayName}` : ''}. Les récompenses ont été versées automatiquement à chaque participant.{value.boss.nextBaseAdjustment !== null ? ` Base du prochain Boss : +${formatResourceAmount(value.boss.nextBaseAdjustment)} PV.` : ''}</p>}
      </section>

      <section className="panel boss-command-panel">
        <div><strong>Attaque du jour</strong><span>{value.attackState === 'AVAILABLE' ? 'Disponible' : value.attackState === 'USED' ? '✅ Utilisée aujourd’hui' : '✅ Boss vaincu ce mois-ci'}</span></div>
        {value.status === 'ALIVE' ? <div className="boss-preview"><small>Dégâts prévus</small><strong>{value.preview ? formatResourceAmount(value.preview.totalDamage) : '—'}</strong><button type="button" disabled={!value.preview} onClick={() => setDetails(true)}>Détails du calcul →</button></div> : <div className="boss-reward-reminder"><small>Récompense communautaire</small><strong>{formatResourceAmount(value.reward.primogems)} Primos · {formatResourceAmount(value.reward.moras)} Moras</strong><span>Versement automatique effectué.</span></div>}
        <button type="button" className="small-primary-button boss-attack-button" disabled={!value.canAttack || Boolean(pending)} onClick={() => void attack()}>{pending === 'attack' ? 'Attaque…' : intent ? 'Réessayer' : 'Attaquer'}</button>
        <p className={`boss-feedback${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}>{error ?? (result ? `${result.defeated ? '✅ Coup final · ' : ''}${formatResourceAmount(result.damage)} dégâts infligés.` : value.canAttack ? 'Formation prête.' : value.attackState === 'AVAILABLE' ? 'Sélectionnez exactement 4 personnages.' : '')}</p>
      </section>

      {value.status === 'ALIVE' && <section className="boss-loadout-section"><header><h2>Votre formation Boss</h2><div><button type="button" disabled={Boolean(pending)} onClick={() => void mutate('copy', onCopyActive)}>Sélectionner l’équipe active</button><button type="button" disabled={Boolean(pending) || selectedIds.size === 0} onClick={() => void mutate('clear', onClear)}>Vider</button></div></header><div className="boss-loadout-grid">{value.loadout.slots.map(({ position, character }) => character ? <article className={`boss-character-card ${character.elementKey}`} key={position}><CharacterAssetImage characterName={character.name} assetPaths={[character.fullbodyPath, character.wishPath, character.splashPath, character.iconPath]} className="boss-character-image" fallback={<span>{character.name.slice(0, 1)}</span>} alt="" /><div><strong>{character.name}</strong><span>{'★'.repeat(character.rarity)} · C{character.constellation}</span></div><div><button type="button" disabled={Boolean(pending)} onClick={() => setPicker(position)}>Changer</button><button type="button" disabled={Boolean(pending)} onClick={() => void mutate(`remove-${position}`, () => onRemoveSlot(position))}>Retirer</button></div></article> : <button type="button" className="boss-character-card boss-empty-slot" disabled={Boolean(pending)} onClick={() => setPicker(position)} key={position}><span>{String(position).padStart(2, '0')}</span><strong>Ajouter</strong><small>Choisir un personnage</small></button>)}</div></section>}

      <section className="panel boss-ranking"><header><div><span className="eyebrow">Contribution</span><h2>Classement du mois</h2></div>{value.participation && <strong>Votre place : #{value.participation.rank}</strong>}</header>{value.ranking.length ? <ol>{value.ranking.map((entry) => <li key={entry.playerId}><b>#{entry.rank}</b><span>{entry.displayName}</span><strong>{formatResourceAmount(entry.totalDamage)} dégâts</strong><small>{entry.attackCount} attaque{entry.attackCount === '1' ? '' : 's'} · record {formatResourceAmount(entry.bestHit)}</small></li>)}</ol> : <p>Aucune participation pour le moment.</p>}</section>
      <section className="panel boss-lifetime"><h2>Vos statistiques Boss</h2><dl><Stat label="Dégâts" value={value.playerStats.totalDamage} /><Stat label="Attaques" value={value.playerStats.totalAttacks} /><Stat label="Boss participés" value={value.playerStats.totalParticipated} /><Stat label="Récompenses" value={value.playerStats.totalRewarded} /><Stat label="Coups finaux" value={value.playerStats.finalBlows} /><Stat label="Meilleur coup" value={value.playerStats.bestHit} /></dl></section>
    </>}
    {picker !== null && <BossPicker value={value} position={picker} selectedIds={selectedIds} pending={Boolean(pending)} onClose={() => setPicker(null)} onSelect={(characterId) => void mutate(`slot-${picker}`, async () => { await onSetSlot(picker, characterId); setPicker(null) })} />}
    {details && value.preview && <BossDetails value={value} onClose={() => setDetails(false)} />}
  </div>
}

function BossPicker({ value, position, selectedIds, pending, onClose, onSelect }: { value: MonthlyBossDto; position: number; selectedIds: ReadonlySet<string>; pending: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const currentId = value.loadout.slots.find((slot) => slot.position === position)?.character?.id
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel boss-picker" role="dialog" aria-modal="true" aria-labelledby="boss-picker-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Emplacement {position}</span><h2 id="boss-picker-title">Choisir un personnage</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button></header><div className="boss-picker-grid">{value.availableCharacters.map((character) => { const used = selectedIds.has(character.id) && character.id !== currentId; return <button type="button" disabled={pending || used} onClick={() => onSelect(character.id)} key={character.id}><CharacterAssetImage className="boss-picker-image" characterName={character.name} assetPaths={[character.iconPath, character.wishPath]} alt="" fallback={<span>{character.name.slice(0, 1)}</span>} /><strong>{character.name}</strong><small>{'★'.repeat(character.rarity)} · C{character.constellation}{used ? ' · Déjà sélectionné' : ''}</small></button> })}</div></section></div>
}
function BossDetails({ value, onClose }: { value: MonthlyBossDto; onClose: () => void }) { return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel boss-details" role="dialog" aria-modal="true" aria-labelledby="boss-details-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Attaque Boss</span><h2 id="boss-details-title">Détails du calcul</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button></header><p>4★ : 500 + 150 × constellation · 5★ : 1 000 + 650 × constellation.</p><ul>{value.preview!.contributions.map((entry) => <li key={entry.characterId}><span>{entry.characterName} · C{entry.constellation}</span><strong>{formatResourceAmount(entry.damage)} dégâts{entry.resistanceApplied ? ' · résistance × 0,5' : ''}</strong></li>)}</ul><footer>Total : <strong>{formatResourceAmount(value.preview!.totalDamage)} dégâts</strong></footer></section></div> }
function BossHistory({ value, pending, onPage }: { value: MonthlyBossHistoryDto | null; pending: boolean; onPage: (page: number) => void }) { if (!value) return <section className="panel boss-history"><p>Chargement de l’historique…</p></section>; return <section className="panel boss-history"><h2>Boss archivés</h2>{value.bosses.length ? <div>{value.bosses.map((boss) => <article key={boss.id}><div><span>{formatMonth(boss.monthStart)}</span><strong>{boss.name}</strong></div><p>{boss.defeatedAt ? '✅ Vaincu' : `${formatResourceAmount(boss.currentHp)} PV restants`} · {boss.participantCount} participant{boss.participantCount > 1 ? 's' : ''}</p>{boss.finalBlowPlayer && <small>Coup final : {boss.finalBlowPlayer.displayName}</small>}</article>)}</div> : <p>Aucun Boss archivé.</p>}<footer><button type="button" disabled={pending || value.page <= 1} onClick={() => onPage(value.page - 1)}>Précédent</button><span>{value.page} / {value.totalPages}</span><button type="button" disabled={pending || value.page >= value.totalPages} onClick={() => onPage(value.page + 1)}>Suivant</button></footer></section> }
function ElementBadge({ element }: { element: MonthlyBossDto['boss']['resistanceElementKey'] }) { return <GameAssetIcon className="boss-element-icon" src={getElementAssetPath(element)} fallback="✦" /> }
function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{formatResourceAmount(value)}</dd></div> }
function formatMonth(value: string) { return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
