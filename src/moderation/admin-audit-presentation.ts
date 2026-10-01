const domains: Record<string, string> = {
  roles: 'Rôles', resources: 'Ressources', progression: 'Progression', gacha: 'Invocation', objects: 'Objets',
  characters: 'Personnages', possessions: 'Possessions', banners: 'Bannières', event: 'Événements', events: 'Événements',
  'global-chat': 'Chat global', 'gift-codes': 'Codes cadeaux', giveaway: 'Giveaway',
}
const actions: Record<string, string> = {
  'grant-tester': 'Testeur attribué', 'revoke-tester': 'Testeur retiré', 'grant-moderator': 'Modérateur attribué',
  'revoke-moderator': 'Modérateur retiré', 'grant-admin': 'Administrateur attribué', 'revoke-admin': 'Administrateur retiré',
  'adjust-resource': 'Ajustement', 'prepare-next-level': 'Préparation du prochain niveau', 'set-state': 'État Gacha modifié',
  'set-xp': 'XP modifiée',
  'set-stella': 'Quantité de Stella modifiée', 'moderate-message': 'Message modéré', 'delete-report': 'Signalement supprimé',
  create: 'Création', update: 'Modification', disable: 'Désactivation', enable: 'Activation', publish: 'Publication',
  add: 'Personnage ajouté', remove: 'Personnage retiré', constellation: 'Constellation modifiée',
  'correct-active': 'Bannière active corrigée', 'retry-generation': 'Génération relancée', 'update-definition': 'Définition modifiée',
  open: 'Ouverture', close: 'Clôture',
}
export function humanizeAuditKey(value: string) {
  const text = value.replace(/[-_]+/g, ' ').trim()
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1)
}
export function adminAuditTitle(domain: string, action: string) {
  return `${adminAuditDomain(domain)} · ${adminAuditAction(action)}`
}
export const adminAuditDomain = (domain: string) => domains[domain] ?? humanizeAuditKey(domain)
export const adminAuditAction = (action: string) => actions[action] ?? humanizeAuditKey(action)
