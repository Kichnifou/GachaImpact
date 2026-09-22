import type { ChatRefreshScope } from '../api/types'

export type ChatRefreshHandlers = Partial<Record<ChatRefreshScope, () => Promise<unknown>>>

/** A confirmed Chat send owns its outcome; failed secondary reads can be retried independently. */
export async function runChatRefreshScopes(scopes: readonly ChatRefreshScope[], handlers: ChatRefreshHandlers) {
  const results = await Promise.allSettled([...new Set(scopes)].flatMap(scope => handlers[scope] ? [handlers[scope]!()] : []))
  if (results.some(result => result.status === 'rejected')) throw new Error('Une projection n’a pas pu être rechargée.')
}
