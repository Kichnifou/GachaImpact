import type { DirectConversationDto, DirectMessageDto } from '../api/types'

export const deletedDirectMessageReplyPreview = 'Message supprimé'

export function replyPreviewFor(message: Pick<DirectMessageDto, 'content' | 'deletedAt'>) {
  return message.deletedAt || message.content === null ? deletedDirectMessageReplyPreview : message.content
}

export function applyDirectMessageProjection<T extends DirectMessageDto>(items: readonly T[], target: DirectMessageDto): readonly T[] {
  const preview = replyPreviewFor(target)
  return items.map(message => {
    if (message.id === target.id) return target as T
    return message.replyToMessageId === target.id ? { ...message, replyPreview: preview } : message
  })
}

export function applyDirectMessageProjectionToConversations(items: readonly DirectConversationDto[], target: DirectMessageDto) {
  return items.map(conversation => {
    if (!conversation.lastMessage) return conversation
    const [lastMessage] = applyDirectMessageProjection([conversation.lastMessage], target)
    return lastMessage === conversation.lastMessage ? conversation : { ...conversation, lastMessage }
  })
}
