export type ScreenId =
  | 'home'
  | 'invocation'
  | 'box'
  | 'characters'
  | 'team'
  | 'inventory'
  | 'shop'

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

export type InventoryCategory = {
  id: string
  label: string
  icon: string
  items: Array<{
    name: string
    amount: string
    description: string
    icon: string
    tone: string
  }>
}
