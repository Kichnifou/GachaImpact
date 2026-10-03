import type { DailyChallengeDto, DailyCombatDto, DailyRewardTodayDto, EventDto, FavorDto, MonthlyBossDto, WheelTodayDto } from '../api/types'
import type { FriendsSnapshot } from '../social/types'
import type { ExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import { expeditionOverview, formatRemainingSeconds } from '../expedition/expedition-presentation'
import { expeditionRemainingSeconds } from '../expedition/expedition-client-snapshot'
import { eventCurrencyLabel, eventHasActionableContentToday, eventNextDailyDestination, type EventDailyDestination } from '../event/event-presentation'
import { dailyChallengeProgressSentence } from '../daily-challenge/presentation'
import { formatDailyRewardDetails } from '../daily-reward/presentation'
import { elementLabels, formatResourceAmount, formatWheelOverviewResult } from '../utils/formatters'
import type { ElementKey } from '../api/types'

export const dailyIds = ['favor', 'reward', 'wheel', 'challenge', 'combat', 'boss', 'expedition', 'friendship', 'event'] as const
export type DailyId = typeof dailyIds[number]
export type DailyState = 'available' | 'in_progress' | 'waiting' | 'completed' | 'unavailable' | 'ineligible' | 'unknown' | 'error'
export type DailyDestination = { kind: 'overview' | 'wheel' | 'challenge' | 'combat' | 'boss' | 'expedition' | 'friends' } | { kind: 'event'; destination: EventDailyDestination }
export type DailyItem = Readonly<{
  id: DailyId; title: string; icon: string; state: DailyState; status: string; businessDate: string | null
  actionable: boolean; detail?: string; obtained?: string; damage?: string; destination?: DailyDestination; deadline?: string
}>
export type DailySources = Readonly<{
  elementKey?: ElementKey
  favor?: FavorDto | null; reward?: DailyRewardTodayDto | null; wheel?: WheelTodayDto | null
  challenge?: DailyChallengeDto | null; combat?: DailyCombatDto | null; boss?: MonthlyBossDto | null
  expedition?: ExpeditionClientSnapshot | null; monotonicNow?: number; event?: EventDto | null
  friendship?: FriendsSnapshot['summary'] | null; friendshipDate?: string
  errors?: Partial<Record<DailyId, string | boolean>>
}>
const names: Record<DailyId, [string, string]> = {
  favor: ['Faveur de l’Astre', '✧'], reward: ['Récompense quotidienne', '✦'], wheel: ['Roue', '◉'], challenge: ['Défi', '◇'],
  combat: ['Combat', '⚔'], boss: ['Boss', '◆'], expedition: ['Expédition', '➤'], friendship: ['Amitié', '♡'], event: ['Événement', '✺'],
}

/** Only server DTO dates establish the current business day; never manufacture availability at midnight. */
export function confirmedDailyDate(source: DailySources): string | null {
  const dates = [source.reward?.businessDate, source.wheel?.businessDate, source.challenge?.businessDate, source.combat?.businessDate,
    source.boss?.businessDate, source.expedition?.value.businessDate, source.event?.businessDate, source.favor?.businessDate, source.friendshipDate]
  return dates.filter((date): date is string => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date))).sort().at(-1) ?? null
}

export function projectDailies(source: DailySources): DailyItem[] {
  const day = confirmedDailyDate(source)
  const row = (id: DailyId, date?: string | null, destination?: DailyDestination): DailyItem => ({ id, title: names[id][0], icon: names[id][1],
    state: source.errors?.[id] ? 'error' : 'unknown', status: source.errors?.[id] ? 'Lecture indisponible.' : 'Synchronisation…', businessDate: date ?? null, actionable: false, destination })
  const known = (_id: DailyId, date: string | undefined | null) => Boolean(date)
  const update = (base: DailyItem, state: DailyState, status: string, detail?: string, actionable = state === 'available'): DailyItem => ({ ...base, state, status, detail, actionable })

  const f = source.favor
  let favor = row('favor', f?.businessDate, { kind: 'overview' })
  if (f && known('favor', f.businessDate)) favor = !f.active || f.claimStatus === 'UNAVAILABLE'
    ? update(favor, 'unavailable', 'Aucune Faveur active.')
    : f.claimedToday ? { ...update(favor, 'completed', '✅ Terminé', `${f.daysRemaining} jour${f.daysRemaining > 1 ? 's' : ''} restant${f.daysRemaining > 1 ? 's' : ''}`), obtained: `+${formatResourceAmount(f.dailyPrimogems)} Primogemmes` }
      : update(favor, 'waiting', 'Présence en cours de traitement.', `${f.daysRemaining} jour${f.daysRemaining > 1 ? 's' : ''} restant${f.daysRemaining > 1 ? 's' : ''}`)

  const r = source.reward
  let reward = row('reward', r?.businessDate, { kind: 'overview' })
  if (r && known('reward', r.businessDate)) reward = r.claimed
    ? { ...update(reward, 'completed', '✅ Terminé', 'Récompense récupérée.'), obtained: source.elementKey ? formatDailyRewardDetails(r, source.elementKey) : undefined }
    : update(reward, 'available', 'Disponible.')
  const w = source.wheel
  let wheel = row('wheel', w?.businessDate, { kind: 'wheel' })
  if (w && known('wheel', w.businessDate)) wheel = w.spun
    ? { ...update(wheel, 'completed', '✅ Terminé', 'Roue utilisée.'), obtained: w.result ? formatWheelOverviewResult(w.result) : undefined }
    : update(wheel, 'available', 'Une tentative disponible.')
  const c = source.challenge
  let challenge = row('challenge', c?.businessDate, { kind: 'challenge' })
  if (c && known('challenge', c.businessDate)) challenge = c.assigned && c.challenge
    ? c.status === 'COMPLETED' ? { ...update(challenge, 'completed', '✅ Terminé', dailyChallengeProgressSentence(c.challenge)), obtained: `+${formatResourceAmount(c.challenge.rewardPrimogems)} Primogemmes` }
      : update(challenge, 'in_progress', `${c.challenge.displayName} · ${c.challenge.progress} / ${c.challenge.target}`, dailyChallengeProgressSentence(c.challenge), true)
    : update(challenge, 'available', `Disponible — ${formatResourceAmount(c.purchaseCost)} Moras`, 'Objectif révélé après achat.')
  const combatValue = source.combat
  let combat = row('combat', combatValue?.businessDate, { kind: 'combat' })
  if (combatValue && known('combat', combatValue.businessDate)) combat = combatValue.status === 'COMPLETED'
    ? { ...update(combat, 'completed', '✅ Terminé', 'Victoire obtenue.'), obtained: `+${formatResourceAmount(combatValue.reward.primogems)} Primogemmes · +${formatResourceAmount(combatValue.reward.moras)} Moras` }
    : combatValue.status === 'BLOCKED' ? update(combat, 'ineligible', 'Bloqué', 'Moins de 4 personnages disponibles.')
      : combatValue.status === 'IN_PROGRESS' ? update(combat, 'in_progress', 'En cours', `${combatValue.koCharacterIds.length} personnages KO.`, true)
        : update(combat, 'available', combatValue.canFight ? 'Prêt à combattre' : 'Formation à préparer', 'Préparez votre formation dans Combat.')
  const b = source.boss
  let boss = row('boss', b?.businessDate, { kind: 'boss' })
  if (b && known('boss', b.businessDate)) boss = b.attackState === 'AVAILABLE'
    ? b.availableCharacters.length < 4 ? update(boss, 'ineligible', 'Formation indisponible.', 'Moins de 4 personnages éligibles.') : update(boss, 'available', b.canAttack ? 'À faire' : 'Formation à préparer', 'Une attaque disponible.')
    : update(boss, 'completed', '✅ Terminé', b.attackState === 'DEFEATED' ? 'Boss vaincu ce mois-ci.' : 'Attaque effectuée.')
  if (b?.todayDamage != null && known('boss', b.businessDate)) boss = { ...boss, damage: formatResourceAmount(b.todayDamage) }
  const x = source.expedition, xv = x?.value
  let expedition = row('expedition', xv?.businessDate, { kind: 'expedition' })
  if (x && xv && known('expedition', xv.businessDate)) {
    const presentation = expeditionOverview(xv, 0)
    expedition = xv.operationalStatus === 'RUNNING'
      ? { ...update(expedition, xv.startedOnCurrentBusinessDate ? 'completed' : 'in_progress', xv.startedOnCurrentBusinessDate ? '✅ Terminé' : 'En cours', `${xv.activeCharacter?.name ?? 'Personnage'} · ${formatRemainingSeconds(expeditionRemainingSeconds(x, source.monotonicNow ?? x.observedAt))}`, false), deadline: xv.readyAt ?? undefined }
      : xv.operationalStatus === 'READY' ? update(expedition, 'available', 'À récupérer', presentation.detail)
        : xv.departureUsedToday ? update(expedition, 'completed', presentation.status, presentation.detail)
          : xv.canStartToday ? update(expedition, 'available', presentation.status, presentation.detail)
            : update(expedition, 'ineligible', 'Départ indisponible.', 'Consultez les personnages éligibles dans la Box.')
  }
  if (xv?.todayReward) {
    const value = xv.todayReward, amount = formatResourceAmount(value.amount)
    expedition = { ...expedition, obtained: value.kind === 'primogems' ? `+${amount} Primogemmes` : value.kind === 'moras' ? `+${amount} Moras` : `+${amount} particules ${elementLabels[value.resourceKey.replace('particles_', '') as ElementKey] ?? ''}` }
  }
  const a = source.friendship
  let friendship = row('friendship', source.friendshipDate, { kind: 'friends' })
  if (a && known('friendship', source.friendshipDate)) friendship = !a.activeFriends ? update(friendship, 'unavailable', 'Aucun ami actif.')
    : a.available > 0 ? update(friendship, 'available', `${a.available} cœur(s) à envoyer`, `${a.alreadySent} / ${a.activeFriends} envoi(s) effectué(s)`)
      : a.alreadySent === a.activeFriends ? update(friendship, 'completed', '✅ Terminé', 'Tous les cœurs ont été envoyés.')
        : update(friendship, 'unavailable', 'Aucun envoi disponible.')
  if (a?.earnedPrimogemsToday && BigInt(a.earnedPrimogemsToday) > 0n && known('friendship', source.friendshipDate)) friendship = { ...friendship, obtained: `+${formatResourceAmount(a.earnedPrimogemsToday)} Primogemmes` }
  const e = source.event
  let event = row('event', e?.businessDate, { kind: 'event', destination: { section: 'registration' } })
  if (e && known('event', e.businessDate)) {
    const destination = eventNextDailyDestination(e)
    event = { ...event, icon: e.festival.emoji, detail: `${e.festival.title} · ${formatResourceAmount(e.currency.amount)} ${eventCurrencyLabel(e.currency.amount, e.festival.currency)}`,
      destination: destination ? { kind: 'event', destination } : undefined }
    if (!eventHasActionableContentToday(e)) event = { ...event, state: 'completed', status: '✅ Terminé' }
    else if (destination?.section === 'games' && destination.game === 0 && !e.gameA.canAttempt) {
      const deadline = e.gameA.windows.find(window => window.state === 'FUTURE')?.startAt
      const next = deadline ? `Prochaine fenêtre à ${new Date(deadline).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}.` : e.gameA.cooldownRemainingMs > 0 ? 'La tentative sera relue après le délai du Jeu A.' : 'Aucune fenêtre de tentative disponible pour le moment.'
      event = { ...event, state: 'waiting', status: 'En attente du Jeu A.', detail: `${event.detail} · ${next}`, deadline }
    }
    else event = { ...event, state: 'available', status: `${e.festival.emoji} ${e.festival.title}`, actionable: true }
  }
  return [favor, reward, wheel, challenge, combat, boss, expedition, friendship, event].map(item => source.errors?.[item.id]
    ? { ...item, state: 'error' as const, status: 'Lecture indisponible.', actionable: false }
    : item.businessDate !== day ? { ...item, state: 'unknown' as const, status: 'Actualisation du jour…', actionable: false } : item)
}

export function dailySuggestions(items: readonly DailyItem[], hidden: readonly DailyId[] = []) {
  const visible = items.filter(item => !hidden.includes(item.id))
  const actionable = visible.filter(item => item.actionable)
  const priority = (item: DailyItem) => item.id === 'reward' ? -2 : item.id === 'expedition' && item.status === 'À récupérer' ? -1 : dailyIds.indexOf(item.id)
  return [...actionable.sort((a, b) => priority(a) - priority(b)), ...visible.filter(item => !item.actionable && (item.state === 'waiting' || item.state === 'in_progress')),
    ...visible.filter(item => item.state === 'unknown' || item.state === 'error')]
}

/** Home action cards retain the tracker's priority, but never advertise waiting or failed reads as actions. */
export function dailyActionableSuggestions(items: readonly DailyItem[], hidden: readonly DailyId[] = []) {
  return dailySuggestions(items, hidden).filter(item => item.actionable && item.state !== 'unknown' && item.state !== 'error')
}

/** Compact progress information shares the masks and stays separate from the confirmed action cards. */
export function dailyOngoingItems(items: readonly DailyItem[], hidden: readonly DailyId[] = [], actionIds: readonly DailyId[] = []) {
  return items.filter(item => !hidden.includes(item.id) && !actionIds.includes(item.id) && (item.state === 'in_progress' || item.state === 'waiting'))
}

export function dailySummaryMessage(items: readonly DailyItem[], hidden: readonly DailyId[] = []) {
  const visible = items.filter(item => !hidden.includes(item.id))
  const available = visible.filter(item => item.actionable).length
  if (available) return `${available} activité${available > 1 ? 's' : ''} disponible${available > 1 ? 's' : ''}`
  if (!visible.length || hidden.length > 0 && dailySuggestions(items, hidden).length === 0 && dailySuggestions(items).length > 0) return 'Aucune activité affichée'
  if (visible.some(item => item.state === 'unknown' || item.state === 'error')) return 'État du jour incomplet'
  if (visible.some(item => item.state === 'waiting' || item.state === 'in_progress')) return 'Rien à faire pour le moment'
  if (visible.some(item => item.state === 'unavailable' || item.state === 'ineligible')) return 'Aucune activité disponible pour le moment'
  return 'Tout est bon, tu es à jour'
}
