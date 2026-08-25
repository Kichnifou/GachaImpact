import type { Character, InventoryCategory, NotificationItem, OnlinePlayer } from '../types'

export const player = {
  name: 'Kichnifou',
  level: 42,
  currentXp: 1260,
  requiredXp: 1260,
  primogems: 2480,
  moras: 560250,
  wishes: 15,
}

export const particles = [
  { label: 'Cryo', icon: '❄', value: 751, tone: 'cryo' },
  { label: 'Pyro', icon: '♨', value: 120, tone: 'pyro' },
  { label: 'Hydro', icon: '●', value: 80, tone: 'hydro' },
  { label: 'Electro', icon: 'ϟ', value: 99, tone: 'electro' },
  { label: 'Anémo', icon: '⌁', value: 36, tone: 'anemo' },
  { label: 'Géo', icon: '◆', value: 0, tone: 'geo' },
]

export const characters: Character[] = [
  { id: 'lyra', name: 'Lyra', element: 'Hydro', elementIcon: '●', tone: 'hydro', rarity: 5, constellation: 1, level: 90, owned: true, role: 'Soutien' },
  { id: 'kael', name: 'Kael', element: 'Cryo', elementIcon: '❄', tone: 'cryo', rarity: 5, constellation: 2, level: 90, owned: true, role: 'Dégâts' },
  { id: 'mira', name: 'Mira', element: 'Anémo', elementIcon: '⌁', tone: 'anemo', rarity: 4, constellation: 6, level: 80, owned: true, role: 'Soutien' },
  { id: 'soren', name: 'Soren', element: 'Pyro', elementIcon: '♨', tone: 'pyro', rarity: 5, constellation: 0, level: 80, owned: true, role: 'Dégâts' },
  { id: 'nova', name: 'Nova', element: 'Electro', elementIcon: 'ϟ', tone: 'electro', rarity: 4, constellation: 3, level: 70, owned: true, role: 'Sub DPS' },
  { id: 'orion', name: 'Orion', element: 'Géo', elementIcon: '◆', tone: 'geo', rarity: 4, constellation: 1, level: 60, owned: true, role: 'Protection' },
  { id: 'selene', name: 'Sélène', element: 'Cryo', elementIcon: '❄', tone: 'cryo', rarity: 5, constellation: 0, level: 1, owned: false, role: 'Dégâts' },
  { id: 'elio', name: 'Élio', element: 'Pyro', elementIcon: '♨', tone: 'pyro', rarity: 5, constellation: 0, level: 1, owned: false, role: 'Soutien' },
  { id: 'iris', name: 'Iris', element: 'Hydro', elementIcon: '●', tone: 'hydro', rarity: 4, constellation: 0, level: 1, owned: false, role: 'Soins' },
  { id: 'zephyr', name: 'Zéphyr', element: 'Anémo', elementIcon: '⌁', tone: 'anemo', rarity: 4, constellation: 0, level: 1, owned: false, role: 'Exploration' },
]

export const activeTeam = characters.slice(0, 4)

export const onlinePlayers: OnlinePlayer[] = [
  { name: 'Lumina', level: 38, status: 'En ligne', friend: true, tone: 'hydro' },
  { name: 'Nox', level: 51, status: 'En ligne', friend: false, tone: 'electro' },
  { name: 'Akitsu', level: 29, status: 'En ligne', friend: true, tone: 'pyro' },
  { name: 'Mélodie', level: 44, status: 'Récent', friend: false, tone: 'anemo' },
]

export const notifications: NotificationItem[] = [
  { id: 1, title: 'Récompense quotidienne', detail: 'Votre récompense du jour est disponible.', time: 'Maintenant', unread: true, icon: '♢' },
  { id: 2, title: 'Bannière permanente', detail: 'Votre progression est de 42 vœux sur 90.', time: 'Il y a 12 min', unread: true, icon: '✦' },
  { id: 3, title: 'Voyageur connecté', detail: 'Lumina vient de rejoindre GachaImpact.', time: 'Il y a 25 min', unread: true, icon: '●' },
]

export const inventoryCategories: InventoryCategory[] = [
  {
    id: 'currencies', label: 'Monnaies', icon: '◈', items: [
      { name: 'Primogemmes', amount: '2 480', description: 'Monnaie d’invocation', icon: '✦', tone: 'cyan' },
      { name: 'Moras', amount: '560 250', description: 'Monnaie commune', icon: '●', tone: 'gold' },
      { name: 'Astéries', amount: '42', description: 'Échange rare', icon: '✧', tone: 'violet' },
    ],
  },
  {
    id: 'particles', label: 'Particules', icon: '⌁', items: [
      { name: 'Particule Cryo', amount: '751', description: 'Affinité élémentaire', icon: '❄', tone: 'cryo' },
      { name: 'Particule Pyro', amount: '120', description: 'Affinité élémentaire', icon: '♨', tone: 'pyro' },
      { name: 'Particule Hydro', amount: '80', description: 'Affinité élémentaire', icon: '●', tone: 'hydro' },
      { name: 'Particule Électro', amount: '99', description: 'Affinité élémentaire', icon: 'ϟ', tone: 'electro' },
    ],
  },
  {
    id: 'items', label: 'Objets', icon: '◇', items: [
      { name: 'Essence astrale', amount: '18', description: 'Matériau d’évolution', icon: '◆', tone: 'blue' },
      { name: 'Fragment d’étoile', amount: '7', description: 'Objet précieux', icon: '✦', tone: 'violet' },
      { name: 'Ration d’aventure', amount: '26', description: 'Provision de voyage', icon: '□', tone: 'green' },
    ],
  },
  {
    id: 'special', label: 'Ressources spéciales', icon: '✧', items: [
      { name: 'Clé du firmament', amount: '2', description: 'Ouvre un domaine futur', icon: '⚿', tone: 'gold' },
      { name: 'Sceau ancien', amount: '5', description: 'Origine inconnue', icon: '◉', tone: 'violet' },
    ],
  },
  {
    id: 'events', label: 'Événement', icon: '♢', items: [
      { name: 'Éclat commémoratif', amount: '12', description: 'Objet d’événement fictif', icon: '❖', tone: 'cyan' },
    ],
  },
]

export const shopCategories = [
  { id: 'featured', label: 'À la une', icon: '✦' },
  { id: 'wishes', label: 'Vœux', icon: '◈' },
  { id: 'resources', label: 'Ressources', icon: '◇' },
  { id: 'special', label: 'Échanges', icon: '◆' },
]

export const shopItems = [
  { name: 'Vœu astral', detail: 'Une invocation sur la bannière permanente.', cost: '160', currency: '✦', icon: '◈', tone: 'violet' },
  { name: 'Coffre du voyageur', detail: 'Une sélection fictive de ressources utiles.', cost: '800', currency: '●', icon: '◇', tone: 'blue' },
  { name: 'Essence condensée', detail: 'Matériau fictif destiné aux évolutions.', cost: '12', currency: '✧', icon: '◆', tone: 'cyan' },
  { name: 'Éclat de constellation', detail: 'Objet rare présenté à titre d’exemple.', cost: '24', currency: '✧', icon: '✦', tone: 'gold' },
]

export const chatMessages = [
  { author: 'Kichnifou', time: '21:45', text: 'Bonsoir les voyageurs !', tone: 'player' },
  { author: 'GachaImpact', time: '21:45', text: 'Bienvenue dans le chat global de GachaImpact.', tone: 'system' },
  { author: 'Lumina', time: '21:46', text: 'La nouvelle bannière est magnifique ✦', tone: 'guest' },
  { author: 'Kichnifou', time: '21:47', text: '!pull 10', tone: 'player' },
  { author: 'GachaImpact', time: '21:47', text: 'Les commandes seront disponibles dans une prochaine étape.', tone: 'system' },
]
