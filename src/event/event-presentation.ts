import type { EventDto } from '../api/types'

export type EventPresentation = Readonly<{
  games: readonly [string, string, string]
  currencyUnit: string
  gameAFailure: string
}>

const presentations = {
  'new-year': { games: ['Feu', 'Coffre', 'Vœu'], currencyUnit: 'Éclat de Fortune', gameAFailure: 'Pas cette fois ! La mèche du feu d’artifice s’éteint... réessaie bientôt !' },
  hearts: { games: ['Cœur', 'Cadeau', 'Mot doux'], currencyUnit: 'Cœur Étincelant', gameAFailure: 'Pas cette fois ! La magie du cœur ne prend pas encore... réessaie bientôt !' },
  spring: { games: ['Pousse', 'Racine', 'Graine'], currencyUnit: 'Bourgeon Mystique', gameAFailure: 'Pas cette fois ! Rien ne pousse encore... réessaie bientôt !' },
  bells: { games: ['Œuf', 'Panier', 'Chocolat'], currencyUnit: 'Œuf Enchanté', gameAFailure: 'Pas cette fois ! Aucun œuf enchanté en vue... réessaie bientôt !' },
  flowers: { games: ['Fleur', 'Bouquet', 'Mot printanier'], currencyUnit: 'Pétale Magique', gameAFailure: 'Pas cette fois ! La fleur rare reste introuvable... réessaie bientôt !' },
  summer: { games: ['Pêche', 'Trésor', 'Lettre'], currencyUnit: 'Coquillage Doré', gameAFailure: 'Pas cette fois ! Rien ne mord à la ligne... réessaie bientôt !' },
  stars: { games: ['Étoile', 'Constellation', 'Vœu'], currencyUnit: 'Étoile Tombée', gameAFailure: 'Pas cette fois ! Aucune étoile filante n’apparaît... réessaie bientôt !' },
  adventurers: { games: ['Expédition', 'Ruine', 'Carnet'], currencyUnit: 'Relique d’Exploration', gameAFailure: 'Pas cette fois ! L’expédition ne révèle encore rien... réessaie bientôt !' },
  harvest: { games: ['Récolte', 'Grenier', 'Panier'], currencyUnit: 'Jeton de Récolte', gameAFailure: 'Pas cette fois ! Rien n’est encore prêt à être récolté... réessaie bientôt !' },
  shadows: { games: ['Fantôme', 'Crypte', 'Sort'], currencyUnit: 'Bonbon Maudit', gameAFailure: 'Pas cette fois ! Aucun fantôme ne se montre... réessaie bientôt !' },
  mists: { games: ['Feuille', 'Relique', 'Murmure'], currencyUnit: 'Feuille Ancienne', gameAFailure: 'Pas cette fois ! La feuille disparaît dans la brume... réessaie bientôt !' },
  christmas: { games: ['Cadeau', 'Hotte', 'Carte'], currencyUnit: 'Étoile de Noël', gameAFailure: 'Pas cette fois ! Il manque encore quelque chose au cadeau... réessaie bientôt !' },
} as const satisfies Readonly<Record<string, EventPresentation>>

export function eventPresentation(festivalKey: string): EventPresentation {
  const presentation = presentations[festivalKey as keyof typeof presentations]
  if (!presentation) throw new Error(`Festival Event inconnu : ${festivalKey}`)
  return presentation
}

export function eventGameAHasRemainingWindow(event: EventDto): boolean {
  return event.gameA.windows.some(({ state }) => state === 'ACTIVE' || state === 'FUTURE')
}

export function eventGameAExpiredToday(event: EventDto): boolean {
  return event.participation.joined && !event.gameA.completedToday && !eventGameAHasRemainingWindow(event)
}

export function eventHasActionableContentToday(event: EventDto): boolean {
  if (!event.participation.joined) return event.canJoin
  return (!event.gameA.completedToday && eventGameAHasRemainingWindow(event)) || event.gameB.canAttempt
}

export function eventDailyDetail(event: EventDto): string {
  if (!event.participation.joined) return 'Participation disponible'
  if (event.gameB.canAttempt && (event.gameA.completedToday || !eventGameAHasRemainingWindow(event))) return 'Énigme du jour disponible'
  if (event.gameA.completedToday) return 'Jeu du jour réussi'
  return eventGameAHasRemainingWindow(event) ? 'Jeu du jour disponible' : 'Délai dépassé'
}
