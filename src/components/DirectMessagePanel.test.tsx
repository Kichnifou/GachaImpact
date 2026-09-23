// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DirectConversationDto, DirectMessageDto } from '../api/types'

const directMessages = vi.hoisted(() => ({
  list: vi.fn(), unread: vi.fn(), messages: vi.fn(), initiate: vi.fn(), send: vi.fn(), accept: vi.fn(), ignore: vi.fn(), block: vi.fn(), unblock: vi.fn(), read: vi.fn(), receipts: vi.fn(), archive: vi.fn(),
}))
const social = vi.hoisted(() => ({ directory: vi.fn() }))
vi.mock('../api/game-api', () => ({ getGameApiClient: () => ({ directMessages, social }) }))
import DirectMessagePanel from './DirectMessagePanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const ownId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const conversationId = '33333333-3333-4333-8333-333333333333'
const requestId = '44444444-4444-4444-8444-444444444444'
const messageId = '55555555-5555-4555-8555-555555555555'
const message: DirectMessageDto = { id: messageId, conversationId, authorPlayerId: otherId, own: false, content: 'Bonjour https://example.com/ok', createdAt: '2026-09-23T07:00:00.000Z', editedAt: null, deletedAt: null, restoredAt: null, readByOther: false, readByOtherAt: null }
const baseConversation: DirectConversationDto = { id: conversationId, other: { id: otherId, displayName: 'Aster', elementKey: 'hydro' }, archived: false, lastMessageAt: message.createdAt, lastMessage: message, request: null, unreadCount: 2, readReceiptsEnabled: true, canSend: true, blockedByMe: false }
const roots: ReturnType<typeof createRoot>[] = []
const unreadChanged = vi.fn(), openProfile = vi.fn(), intentConsumed = vi.fn()

async function settle() { await act(async () => { await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 25)) }) }
async function mount(conversation: DirectConversationDto = baseConversation, active = true, preserveListMock = false) {
  if (!preserveListMock) directMessages.list.mockImplementation(async (archived: boolean) => ({ conversations: archived ? [] : [conversation] }))
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  await act(async () => { root.render(<DirectMessagePanel playerId={ownId} isActive={active} intent={null} onIntentConsumed={intentConsumed} onUnreadChange={unreadChanged} onOpenProfile={openProfile} />) })
  await settle()
  return container
}

beforeEach(() => {
  vi.clearAllMocks()
  directMessages.list.mockImplementation(async (archived: boolean) => ({ conversations: archived ? [] : [baseConversation] }))
  directMessages.unread.mockResolvedValue({ unreadCount: 0, conversations: [] })
  directMessages.messages.mockResolvedValue({ messages: [message], nextCursor: null, windowSize: 1 })
  directMessages.read.mockResolvedValue({ lastReadMessageId: messageId, sharedReadAt: null, changed: true })
  directMessages.send.mockResolvedValue({ conversationId, messageId, replayed: false })
  directMessages.initiate.mockResolvedValue({ conversationId, messageId, requestId, state: 'PENDING', replayed: false })
  directMessages.accept.mockResolvedValue({ conversationId, requestId, state: 'ACCEPTED', replayed: false })
  directMessages.ignore.mockResolvedValue({ conversationId, requestId, state: 'REFUSED', replayed: false })
  directMessages.block.mockResolvedValue({ conversationId, blocked: true, changed: true, replayed: false })
  directMessages.unblock.mockResolvedValue({ conversationId, blocked: false, changed: true, replayed: false })
  directMessages.receipts.mockResolvedValue({ conversationId, readReceiptsEnabled: false, changed: true })
  directMessages.archive.mockResolvedValue({ conversationId, archived: true, changed: true })
  social.directory.mockResolvedValue({ players: [], page: 1, pageSize: 20, total: 0, totalPages: 0 })
})
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren() })

describe('DirectMessagePanel', () => {
  it('renders the server-owned list, unread state and archived view', async () => {
    const archived = { ...baseConversation, archived: true, unreadCount: 0 }
    directMessages.list.mockImplementation(async (isArchived: boolean) => ({ conversations: isArchived ? [archived] : [baseConversation] }))
    const container = await mount(baseConversation, true, true)
    expect(container.textContent).toContain('Aster')
    expect(container.querySelector('.dm-badge')?.textContent).toBe('2')
    await act(async () => { (Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Conversations archivées') as HTMLButtonElement).click() })
    await settle()
    expect(directMessages.list).toHaveBeenCalledWith(true)
    expect(container.textContent).toContain('Conversations')
  })

  it('shows a pending incoming request, safe links and resolves acceptance', async () => {
    const pending = { ...baseConversation, request: { id: requestId, state: 'PENDING' as const, senderPlayerId: otherId, retryAfter: null }, canSend: false }
    const container = await mount(pending)
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() })
    await settle()
    expect(container.textContent).toContain('Demande de conversation')
    const link = container.querySelector<HTMLAnchorElement>('.dm-message a')!
    expect(link.href).toBe('https://example.com/ok')
    expect(link.rel).toBe('noopener noreferrer')
    expect(directMessages.read).toHaveBeenCalledWith(conversationId, messageId)
    await act(async () => { (Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Accepter') as HTMLButtonElement).click() })
    await settle()
    expect(directMessages.accept).toHaveBeenCalledWith(conversationId, requestId, expect.any(String))
  })

  it('keeps the draft and the idempotency key for an explicit retry', async () => {
    directMessages.send.mockRejectedValueOnce(new Error('Envoi temporairement indisponible.')).mockResolvedValueOnce({ conversationId, messageId, replayed: false })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() })
    await settle()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Réessayer moi'); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await settle()
    expect(textarea.value).toBe('Réessayer moi')
    expect(container.textContent).toContain('Envoi temporairement indisponible.')
    await act(async () => { textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await settle()
    expect(directMessages.send).toHaveBeenCalledTimes(2)
    expect(directMessages.send.mock.calls[0]?.[2]).toBe(directMessages.send.mock.calls[1]?.[2])
    expect(textarea.value).toBe('')
  })

  it('keeps a denied conversation readable and exposes block/unblock and receipt controls', async () => {
    const own: DirectMessageDto = { ...message, own: true, authorPlayerId: ownId, readByOther: true, readByOtherAt: '2026-09-23T07:01:00.000Z' }
    directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
    const blocked = { ...baseConversation, canSend: false, blockedByMe: true }
    const container = await mount(blocked)
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() })
    await settle()
    expect(container.textContent).toContain('lecture seule')
    expect(container.querySelector('.dm-receipt')?.textContent).toContain('Lu')
    await act(async () => { (container.querySelector('.dm-menu-button') as HTMLButtonElement).click() })
    expect(container.textContent).toContain('Débloquer')
    expect(container.querySelector<HTMLInputElement>('.dm-conversation-menu input')?.checked).toBe(true)
    directMessages.unblock.mockRejectedValueOnce(new Error('Action refusée.'))
    await act(async () => { (Array.from(container.querySelectorAll('.dm-conversation-menu button')).find(item => item.textContent === 'Débloquer') as HTMLButtonElement).click() })
    await settle()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Action refusée.')
  })

  it('searches a Player and creates nothing until the multiline first message is sent', async () => {
    const candidate = { id: otherId, displayName: 'Aster', elementKey: 'hydro' as const }
    directMessages.list.mockResolvedValue({ conversations: [] })
    social.directory.mockResolvedValue({ players: [candidate], page: 1, pageSize: 20, total: 1, totalPages: 1 })
    const container = await mount(baseConversation, true, true)
    await act(async () => { (Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Nouveau message') as HTMLButtonElement).click() })
    const search = container.querySelector<HTMLInputElement>('#dm-player-search')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Ast'); search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 250)) })
    expect(social.directory).toHaveBeenCalledWith({ q: 'Ast', page: 1 })
    await act(async () => { (Array.from(container.querySelectorAll('.dm-player-results button')).find(item => item.textContent?.includes('Aster')) as HTMLButtonElement).click() })
    await settle()
    expect(directMessages.initiate).not.toHaveBeenCalled()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    const content = `Première ligne\n${'é'.repeat(980)}`
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, `${content}trop-long`); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(Array.from(textarea.value)).toHaveLength(1000)
    expect(textarea.hasAttribute('maxlength')).toBe(false)
    const shiftEnter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true })
    await act(async () => { textarea.dispatchEvent(shiftEnter) })
    expect(shiftEnter.defaultPrevented).toBe(false)
    expect(directMessages.initiate).not.toHaveBeenCalled()
    await act(async () => { textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) })
    await settle()
    expect(directMessages.initiate).toHaveBeenCalledWith(otherId, textarea.value || Array.from(`${content}trop-long`).slice(0, 1000).join(''), expect.any(String))
  })

  it('keeps an outgoing pending request visible without a composer', async () => {
    const pending = { ...baseConversation, request: { id: requestId, state: 'PENDING' as const, senderPlayerId: ownId, retryAfter: null }, canSend: false }
    const container = await mount(pending)
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() })
    await settle()
    expect(container.textContent).toContain('Demande envoyée')
    expect(container.querySelector('#dm-message')).toBeNull()
    expect(container.textContent).toContain('lecture seule')
  })

  it('routes receipt, archive, ignore and block actions through the authoritative API', async () => {
    const incoming = { ...baseConversation, request: { id: requestId, state: 'PENDING' as const, senderPlayerId: otherId, retryAfter: null }, canSend: false }
    const container = await mount(incoming)
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() })
    await settle()
    await act(async () => { (container.querySelector('.dm-menu-button') as HTMLButtonElement).click() })
    const receipt = container.querySelector<HTMLInputElement>('.dm-conversation-menu input')!
    await act(async () => { receipt.click() })
    await settle()
    expect(directMessages.receipts).toHaveBeenCalledWith(conversationId, false)
    await act(async () => { (Array.from(container.querySelectorAll('.dm-conversation-menu button')).find(item => item.textContent === 'Archiver') as HTMLButtonElement).click() })
    await settle()
    expect(directMessages.archive).toHaveBeenCalledWith(conversationId, true)

    const ignored = await mount(incoming)
    await act(async () => { (ignored.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { (Array.from(ignored.querySelectorAll('button')).find(item => item.textContent === 'Ignorer') as HTMLButtonElement).click() }); await settle()
    expect(directMessages.ignore).toHaveBeenCalledWith(conversationId, requestId, expect.any(String))

    const blocked = await mount(incoming)
    await act(async () => { (blocked.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { (Array.from(blocked.querySelectorAll('button')).find(item => item.textContent === 'Bloquer') as HTMLButtonElement).click() })
    expect(blocked.textContent).toContain('Bloquer ce joueur')
    await act(async () => { (Array.from(blocked.querySelectorAll('.dm-confirm button')).find(item => item.textContent === 'Confirmer') as HTMLButtonElement).click() }); await settle()
    expect(directMessages.block).toHaveBeenCalledWith(conversationId, expect.any(String))
  })
})
