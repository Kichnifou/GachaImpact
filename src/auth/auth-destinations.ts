export const recoveryPath = '/auth/recovery'

export function confirmationDestination(origin = location.origin) {
  const allowed = ['https://gachaimpact.pages.dev', 'https://gachaimpact.fr', ...(import.meta.env.DEV ? ['http://localhost:5173'] : [])]
  if (!allowed.includes(origin)) throw new Error('Cette demande est disponible depuis le site officiel du jeu.')
  return origin
}

export function recoveryDestination(origin = location.origin) {
  return `${confirmationDestination(origin)}${recoveryPath}`
}
