export type ScreenId =
  | 'home'
  | 'invocation'
  | 'characters-box'
  | 'characters-team'
  | 'characters-catalog'
  | 'activities-dailies'
  | 'activities-missions'
  | 'activities-combat'
  | 'activities-event'
  | 'activities-contest'
  | 'bank'
  | 'inventory'
  | 'shop'
  | 'configuration'
  | 'moderation'

export type ElementTone = 'hydro' | 'pyro' | 'cryo' | 'anemo' | 'electro' | 'geo'

export type Character = {
  id: string
  name: string
  element: string
  elementIcon: string
  tone: ElementTone
  rarity: 4 | 5
  constellation: number
  level: number
  owned: boolean
  role: string
}

export type OnlinePlayer = {
  name: string
  level: number
  status: 'En ligne' | 'Récent'
  friend: boolean
  tone: ElementTone
}

export type NotificationItem = {
  id: number
  title: string
  detail: string
  time: string
  unread: boolean
  icon: string
}
