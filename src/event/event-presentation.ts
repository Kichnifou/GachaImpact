import type { EventDto } from '../api/types'

export type EventPresentation = Readonly<{
  games: readonly [string, string, string]
  gameAFailure: string
}>

const presentations = {
  'new-year': { games: ['Feu', 'Coffre', 'Vœu'], gameAFailure: 'Pas cette fois ! La mèche du feu d’artifice s’éteint... réessaie bientôt !' },
  hearts: { games: ['Cœur', 'Cadeau', 'Mot doux'], gameAFailure: 'Pas cette fois ! La magie du cœur ne prend pas encore... réessaie bientôt !' },
  spring: { games: ['Pousse', 'Racine', 'Graine'], gameAFailure: 'Pas cette fois ! Rien ne pousse encore... réessaie bientôt !' },
  bells: { games: ['Œuf', 'Panier', 'Chocolat'], gameAFailure: 'Pas cette fois ! Aucun œuf enchanté en vue... réessaie bientôt !' },
  flowers: { games: ['Fleur', 'Bouquet', 'Mot printanier'], gameAFailure: 'Pas cette fois ! La fleur rare reste introuvable... réessaie bientôt !' },
  summer: { games: ['Pêche', 'Trésor', 'Lettre'], gameAFailure: 'Pas cette fois ! Rien ne mord à la ligne... réessaie bientôt !' },
  stars: { games: ['Étoile', 'Constellation', 'Vœu'], gameAFailure: 'Pas cette fois ! Aucune étoile filante n’apparaît... réessaie bientôt !' },
  adventurers: { games: ['Expédition', 'Ruine', 'Carnet'], gameAFailure: 'Pas cette fois ! L’expédition ne révèle encore rien... réessaie bientôt !' },
  harvest: { games: ['Récolte', 'Grenier', 'Panier'], gameAFailure: 'Pas cette fois ! Rien n’est encore prêt à être récolté... réessaie bientôt !' },
  shadows: { games: ['Fantôme', 'Crypte', 'Sort'], gameAFailure: 'Pas cette fois ! Aucun fantôme ne se montre... réessaie bientôt !' },
  mists: { games: ['Feuille', 'Relique', 'Murmure'], gameAFailure: 'Pas cette fois ! La feuille disparaît dans la brume... réessaie bientôt !' },
  christmas: { games: ['Cadeau', 'Hotte', 'Carte'], gameAFailure: 'Pas cette fois ! Il manque encore quelque chose au cadeau... réessaie bientôt !' },
} as const satisfies Readonly<Record<string, EventPresentation>>

export function eventPresentation(festivalKey: string): EventPresentation {
  const presentation = presentations[festivalKey as keyof typeof presentations]
  if (!presentation) throw new Error(`Festival Event inconnu : ${festivalKey}`)
  return presentation
}

export function eventCurrencyLabel(amount: number | string, currency: EventDto['festival']['currency']): string {
  return BigInt(amount) === 1n ? currency.unit : currency.label
}

export function eventGameAHasRemainingWindow(event: EventDto): boolean {
  return event.gameA.windows.some(({ state }) => state === 'ACTIVE' || state === 'FUTURE')
}

export function eventGameAExpiredToday(event: EventDto): boolean {
  return event.participation.joined && !event.gameA.completedToday && !eventGameAHasRemainingWindow(event)
}

export type EventDailyDestination = { section: 'registration' } | { section: 'games'; game: 0 | 1 | 2 }
export type EventDailyOpenIntent = Readonly<EventDailyDestination & { token: string }>

export function eventNextDailyDestination(event: EventDto): EventDailyDestination | null {
  if (event.canJoin || event.calendar?.canClaimToday || event.dailyBonus.canClaim) return { section: 'registration' }
  if (event.participation.joined && !event.gameA.completedToday) return { section: 'games', game: 0 }
  if (event.participation.joined && !event.gameB.solvedToday && event.gameB.canAttempt) return { section: 'games', game: 1 }
  if (event.gameC.canSend || event.gameC.unviewedCount > 0) return { section: 'games', game: 2 }
  return null
}

export function eventHasActionableContentToday(event: EventDto): boolean {
  return eventNextDailyDestination(event) !== null
}
