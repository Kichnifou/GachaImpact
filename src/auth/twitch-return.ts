// Navigation hints only. The authenticated backend owns linking and Player selection.
const contextKey = 'gachaimpact:twitch-link-return:v1'
const maxAge = 15 * 60_000
export function readTwitchReturn(): string | null {
  const outcome = new URL(location.href).searchParams.get('twitch')
  return outcome && /^(connected|profile-recovered|progression-choice|error|[A-Z][A-Z0-9_]{0,100}|(?:runtime|favor-runtime|gift-supreme|giveaway)-(?:activated|error))$/.test(outcome) ? outcome : null
}
export function rememberTwitchLink(userId: string, playerId: string) {
  try { sessionStorage.setItem(contextKey, JSON.stringify({ userId, playerId, createdAt: Date.now() })) } catch { /* OAuth still works when storage is unavailable. */ }
}
export function twitchReturnContext(userId: string): 'initiated' | 'unrecorded' | 'stale' {
  try {
    const raw = sessionStorage.getItem(contextKey)
    if (!raw) return 'unrecorded'
    const value = JSON.parse(raw)
    return value.userId === userId && typeof value.playerId === 'string' && Number.isFinite(value.createdAt) && Date.now() >= value.createdAt && Date.now() - value.createdAt <= maxAge ? 'initiated' : 'stale'
  } catch { return 'stale' }
}
export function forgetTwitchReturnContext() {
  try { sessionStorage.removeItem(contextKey) } catch { /* No persistent authority is stored here. */ }
}
export function twitchReturnChangedPlayer(userId: string, playerId: string): boolean {
  if (twitchReturnContext(userId) !== 'initiated') return false
  try { return JSON.parse(sessionStorage.getItem(contextKey)!).playerId !== playerId } catch { return false }
}
export function clearTwitchReturn(home = false) {
  const url = new URL(location.href)
  url.searchParams.delete('twitch')
  if (home) url.hash = 'home'
  history.replaceState(history.state, '', url)
  forgetTwitchReturnContext()
}
