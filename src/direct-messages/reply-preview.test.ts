import { describe, expect, it } from 'vitest'
import type { DirectMessageDto } from '../api/types'
import { applyDirectMessageProjection } from './reply-preview'

const target: DirectMessageDto = {
  id: '11111111-1111-4111-8111-111111111111', conversationId: '22222222-2222-4222-8222-222222222222', authorPlayerId: '33333333-3333-4333-8333-333333333333', own: true,
  clientIntentKey: null, content: 'Texte initial', createdAt: '2026-09-25T08:00:00.000Z', submissionOrder: '1', editedAt: null, deletedAt: null, restoredAt: null,
  replyToMessageId: null, replyPreview: null, readByOther: false, readByOtherAt: null,
}
const reply: DirectMessageDto = { ...target, id: '44444444-4444-4444-8444-444444444444', content: 'Réponse', submissionOrder: '2', replyToMessageId: target.id, replyPreview: target.content }

describe('direct-message reply previews', () => {
  it('follows target edits, deletion and restoration without copying a stale preview', () => {
    const edited = { ...target, content: 'Texte corrigé', editedAt: '2026-09-25T08:01:00.000Z' }
    let projected = applyDirectMessageProjection([target, reply], edited)
    expect(projected[1]?.replyPreview).toBe('Texte corrigé')
    projected = applyDirectMessageProjection(projected, { ...edited, content: null, deletedAt: '2026-09-25T08:02:00.000Z' })
    expect(projected[1]?.replyPreview).toBe('Message supprimé')
    projected = applyDirectMessageProjection(projected, { ...edited, deletedAt: null, restoredAt: '2026-09-25T08:03:00.000Z' })
    expect(projected[1]?.replyPreview).toBe('Texte corrigé')
  })
})
