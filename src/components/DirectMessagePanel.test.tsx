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
import { directMessageReceiptLabel } from '../direct-messages/receipt-label'
import DirectMessagePanel from './DirectMessagePanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const ownId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const conversationId = '33333333-3333-4333-8333-333333333333'
const requestId = '44444444-4444-4444-8444-444444444444'
const messageId = '55555555-5555-4555-8555-555555555555'
const message: DirectMessageDto = { id: messageId, conversationId, authorPlayerId: otherId, own: false, clientIntentKey: null, content: 'Bonjour https://example.com/ok', createdAt: '2026-09-23T07:00:00.000Z', submissionOrder: '1', editedAt: null, deletedAt: null, restoredAt: null, readByOther: false, readByOtherAt: null }
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

async function openNewMessageTarget(container: HTMLElement) {
  await act(async () => { (Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Nouveau message') as HTMLButtonElement).click() })
  const search = container.querySelector<HTMLInputElement>('#dm-player-search')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Ast'); search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 250)) })
  await act(async () => { (Array.from(container.querySelectorAll('.dm-player-results button')).find(item => item.textContent?.includes('Aster')) as HTMLButtonElement).click() })
  await settle()
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
  it('formats the single read status at the validated deterministic thresholds', () => {
    const now = Date.parse('2026-09-23T12:00:00.000Z')
    expect(directMessageReceiptLabel(new Date(now - 59 * 60_000).toISOString(), now)).toBe('Lu ✓')
    expect(directMessageReceiptLabel(new Date(now - 60 * 60_000).toISOString(), now)).toBe('Lu il y a 1h')
    expect(directMessageReceiptLabel(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe('Lu il y a 2j')
    expect(directMessageReceiptLabel(new Date(now - 30 * 86_400_000).toISOString(), now)).toBe('Lu il y a 1 mois')
    expect(directMessageReceiptLabel(new Date(now - 730 * 86_400_000).toISOString(), now)).toBe('Lu il y a 2 ans')
  })

  it('renders the server-owned list, unread state and archived view', async () => {
    const archived = { ...baseConversation, archived: true, unreadCount: 0 }
    directMessages.list.mockImplementation(async (isArchived: boolean) => ({ conversations: isArchived ? [archived] : [baseConversation] }))
    const container = await mount(baseConversation, true, true)
    expect(container.textContent).toContain('Aster')
    expect(container.querySelector('.dm-badge')?.textContent).toBe('2')
    await act(async () => { (Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Archives') as HTMLButtonElement).click() })
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

  it('clears the conversation and total unread badges immediately on opening the thread', async () => {
    directMessages.read.mockReturnValueOnce(new Promise(() => undefined))
    const container = await mount()
    expect(container.querySelector('.dm-badge')?.textContent).toBe('2')
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() })
    expect(unreadChanged.mock.calls.at(-1)?.[0]).toBe(0)
    expect(container.querySelector('.dm-badge')).toBeNull()
  })

  it('seeds a conversation from the list immediately while its refresh is pending', async () => {
    directMessages.messages.mockReturnValue(new Promise(() => undefined))
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() })
    expect(container.querySelector('.dm-thread-identity strong')?.textContent).toBe('Aster')
    expect(container.querySelector('.dm-message p')?.textContent).toContain('Bonjour')
    expect(directMessages.messages).toHaveBeenCalledWith(conversationId)
  })

  it('polls an open conversation at 500 ms start-to-start without overlapping a slow request', async () => {
    vi.useFakeTimers()
    try {
      let release!: (value: { messages: DirectMessageDto[]; nextCursor: null; windowSize: number }) => void
      directMessages.messages.mockImplementationOnce(() => new Promise(resolve => { release = resolve })).mockResolvedValue({ messages: [message], nextCursor: null, windowSize: 1 })
      const container = document.createElement('div'); document.body.append(container)
      const root = createRoot(container); roots.push(root)
      await act(async () => { root.render(<DirectMessagePanel playerId={ownId} isActive intent={null} onIntentConsumed={intentConsumed} onUnreadChange={unreadChanged} onOpenProfile={openProfile} />); await Promise.resolve(); await Promise.resolve() })
      await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click(); await Promise.resolve() })
      expect(directMessages.messages).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
      expect(directMessages.messages).toHaveBeenCalledTimes(1)
      await act(async () => { release({ messages: [message], nextCursor: null, windowSize: 1 }); await Promise.resolve(); await vi.advanceTimersByTimeAsync(500) })
      expect(directMessages.messages.mock.calls.length).toBeGreaterThanOrEqual(2)
    } finally { vi.useRealTimers() }
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
    expect(container.querySelector('.dm-latest-status')?.textContent).toContain('Lu')
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

  it('shows the first message optimistically and adopts a pending conversation without a flash or duplicate', async () => {
    const candidate = { id: otherId, displayName: 'Aster', elementKey: 'hydro' as const }
    let confirm!: (value: { conversationId: string; messageId: string; requestId: string; state: 'PENDING'; replayed: boolean }) => void
    directMessages.list.mockResolvedValue({ conversations: [] })
    directMessages.messages.mockReturnValue(new Promise(() => undefined))
    directMessages.initiate.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
    social.directory.mockResolvedValue({ players: [candidate], page: 1, pageSize: 20, total: 1, totalPages: 1 })
    const container = await mount(baseConversation, true, true)
    await openNewMessageTarget(container)
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Bonjour'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(container.querySelector('.dm-thread-identity strong')?.textContent).toBe('Aster')
    expect(container.querySelector('#dm-player-search')).toBeNull()
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Bonjour')).toHaveLength(1)
    expect(container.querySelector('.dm-message time')).toBeNull()
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Envoi...')
    expect(container.querySelector('#dm-message')).toBeNull()
    await act(async () => { confirm({ conversationId, messageId, requestId, state: 'PENDING', replayed: false }); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Bonjour')).toHaveLength(1)
    expect(container.querySelector(`[data-message-id="${messageId}"]`)).not.toBeNull()
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Envoyé')
    expect(container.textContent).toContain('Demande envoyée')
    expect(container.querySelector('#dm-message')).toBeNull()
    expect(directMessages.messages).toHaveBeenCalledWith(conversationId)
  })

  it('adopts an accepted first message once and enables the normal composer', async () => {
    const candidate = { id: otherId, displayName: 'Aster', elementKey: 'hydro' as const }
    let confirm!: (value: { conversationId: string; messageId: string; requestId: null; state: 'ACCEPTED'; replayed: boolean }) => void
    directMessages.list.mockResolvedValue({ conversations: [] })
    directMessages.messages.mockReturnValue(new Promise(() => undefined))
    directMessages.initiate.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
    social.directory.mockResolvedValue({ players: [candidate], page: 1, pageSize: 20, total: 1, totalPages: 1 })
    const container = await mount(baseConversation, true, true)
    await openNewMessageTarget(container)
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Bonjour'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    await act(async () => { confirm({ conversationId, messageId, requestId: null, state: 'ACCEPTED', replayed: false }); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Bonjour')).toHaveLength(1)
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Envoyé')
    expect(container.textContent).not.toContain('Demande envoyée')
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')).not.toBeNull()
  })

  it('removes a failed provisional first message, restores the draft and reuses its intent key', async () => {
    const candidate = { id: otherId, displayName: 'Aster', elementKey: 'hydro' as const }
    directMessages.list.mockResolvedValue({ conversations: [] })
    directMessages.initiate.mockRejectedValueOnce(new Error('Initiation refusée.')).mockReturnValueOnce(new Promise(() => undefined))
    social.directory.mockResolvedValue({ players: [candidate], page: 1, pageSize: 20, total: 1, totalPages: 1 })
    const container = await mount(baseConversation, true, true)
    await openNewMessageTarget(container)
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Bonjour'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await settle()
    expect(container.querySelector('#dm-player-search')).not.toBeNull()
    expect(container.querySelector('.dm-message')).toBeNull()
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('Bonjour')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Initiation refusée.')
    const retry = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { retry.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(directMessages.initiate).toHaveBeenCalledTimes(2)
    expect(directMessages.initiate.mock.calls[0]?.[2]).toBe(directMessages.initiate.mock.calls[1]?.[2])
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Bonjour')).toHaveLength(1)
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

  it('uses the same identity initial in the list and header, never an element abbreviation', async () => {
    const container = await mount()
    expect(container.querySelector('.dm-conversation-row .dm-avatar')?.textContent).toBe('A')
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    expect(container.querySelector('.dm-thread-identity .dm-avatar')?.textContent).toBe('A')
    expect(container.textContent).not.toContain('Hy')
  })

  it('renders one optimistic bubble immediately, reconciles it in place and keeps status outside the bubble', async () => {
    let confirm!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    const sentId = '88888888-8888-4888-8888-888888888888'
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Instantané'); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(textarea.value).toBe('Instantané')
    await act(async () => { textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(directMessages.send).toHaveBeenCalledTimes(1)
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Instantané')).toHaveLength(1)
    expect(container.querySelector('.dm-message.pending')?.textContent).toBe('Instantané')
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Envoi...')
    expect(container.querySelector('.dm-message time')).toBeNull()
    await act(async () => { confirm({ conversationId, messageId: sentId, replayed: false }); await Promise.resolve() })
    expect(container.querySelector('.dm-message.pending')).toBeNull()
    expect(container.querySelector(`[data-message-id="${sentId}"]`)?.textContent).toBe('Instantané')
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Envoyé')
  })

  it('keeps a fresher polling projection when the POST acknowledgement arrives later', async () => {
    let confirm!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Race'); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(textarea.value).toBe('Race')
    await act(async () => { textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    const key = directMessages.send.mock.calls[0]?.[2] as string
    const serverCreatedAt = '2026-09-23T09:00:00.000Z', serverReadAt = new Date().toISOString()
    const serverMessage: DirectMessageDto = { ...message, id: '88888888-8888-4888-8888-888888888888', authorPlayerId: ownId, own: true, clientIntentKey: key, content: 'Race', createdAt: serverCreatedAt, submissionOrder: '123', readByOther: true, readByOtherAt: serverReadAt }
    directMessages.messages.mockResolvedValue({ messages: [message, serverMessage], nextCursor: null, windowSize: 2 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() }); await settle()
    let row = container.querySelector<HTMLElement>(`[data-message-id="${serverMessage.id}"]`)!
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Race')).toHaveLength(1)
    expect(row.dataset.submissionOrder).toBe('123')
    expect(row.dataset.readByOther).toBe('true')
    expect(row.dataset.readByOtherAt).toBe(serverReadAt)
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Lu ✓')
    await act(async () => { confirm({ conversationId, messageId: serverMessage.id, replayed: false }); await Promise.resolve() })
    row = container.querySelector<HTMLElement>(`[data-message-id="${serverMessage.id}"]`)!
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Race')).toHaveLength(1)
    expect(row.dataset.submissionOrder).toBe('123')
    expect(row.dataset.readByOther).toBe('true')
    expect(row.dataset.readByOtherAt).toBe(serverReadAt)
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Lu ✓')
  })

  it('keeps two intentionally identical messages distinct through intent reconciliation', async () => {
    directMessages.send
      .mockResolvedValueOnce({ conversationId, messageId: '77777777-7777-4777-8777-777777777777', replayed: false })
      .mockResolvedValueOnce({ conversationId, messageId: '88888888-8888-4888-8888-888888888888', replayed: false })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    for (const content of ['Même texte', 'Même texte']) {
      const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, content); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    }
    expect(Array.from(container.querySelectorAll('.dm-message p')).filter(node => node.textContent === 'Même texte')).toHaveLength(2)
    expect(new Set(Array.from(container.querySelectorAll<HTMLElement>('.dm-message')).map(node => node.dataset.messageId)).size).toBe(container.querySelectorAll('.dm-message').length)
  })

  it('forces the bottom for an own optimistic send and only hides the scrollbar there', async () => {
    let confirm!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const list = container.querySelector<HTMLDivElement>('.dm-message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1_000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    list.scrollTop = 200
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    expect(list.classList.contains('dm-scrollbar-hidden')).toBe(false)
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Retour au bas'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(list.scrollTop).toBe(1_000)
    expect(list.classList.contains('dm-scrollbar-hidden')).toBe(true)
    await act(async () => { confirm({ conversationId, messageId: '99999999-9999-4999-8999-999999999999', replayed: false }); await Promise.resolve() })
  })

  it('does not move a reader who scrolled up when a received message is appended', async () => {
    const reply = { ...message, id: '88888888-8888-4888-8888-888888888888', content: 'Nouveau reçu', submissionOrder: '2' }
    directMessages.messages.mockResolvedValue({ messages: [message], nextCursor: null, windowSize: 1 })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const list = container.querySelector<HTMLDivElement>('.dm-message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1_000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    list.scrollTop = 250
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    directMessages.messages.mockResolvedValue({ messages: [message, reply], nextCursor: null, windowSize: 2 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() }); await settle()
    expect(list.scrollTop).toBe(250)
    expect(container.textContent).toContain('1 nouveau message ↓')
  })

  it('keeps a reader at the bottom when a received message is appended', async () => {
    const reply = { ...message, id: '88888888-8888-4888-8888-888888888888', content: 'Nouveau reçu', submissionOrder: '2' }
    directMessages.messages.mockResolvedValue({ messages: [message], nextCursor: null, windowSize: 1 })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const list = container.querySelector<HTMLDivElement>('.dm-message-list')!
    let height = 1_000
    Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => height })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    list.scrollTop = 900
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    height = 1_100
    directMessages.messages.mockResolvedValue({ messages: [message, reply], nextCursor: null, windowSize: 2 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() }); await settle()
    expect(list.scrollTop).toBe(1_100)
    expect(list.classList.contains('dm-scrollbar-hidden')).toBe(true)
  })

  it('lets a received reply supersede the former outgoing delivery status', async () => {
    const own: DirectMessageDto = { ...message, id: '77777777-7777-4777-8777-777777777777', own: true, authorPlayerId: ownId, content: 'Avant', submissionOrder: '1', readByOther: true, readByOtherAt: '2026-09-23T07:01:00.000Z' }
    const reply: DirectMessageDto = { ...message, id: '88888888-8888-4888-8888-888888888888', content: 'Réponse', submissionOrder: '2' }
    directMessages.messages.mockResolvedValue({ messages: [own, reply], nextCursor: null, windowSize: 2 })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    expect(container.querySelector('.dm-latest-status')).toBeNull()
  })

  it('replaces a stale receipt projection with the fresh server object without F5', async () => {
    const own: DirectMessageDto = { ...message, own: true, authorPlayerId: ownId, content: 'À lire', readByOther: false }
    directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Envoyé')
    directMessages.messages.mockResolvedValue({ messages: [{ ...own, readByOther: true, readByOtherAt: new Date().toISOString() }], nextCursor: null, windowSize: 1 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() }); await settle()
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Lu ✓')
  })

  it('updates the receipt checkbox immediately and rolls it back on a deterministic error', async () => {
    let reject!: (reason: Error) => void
    directMessages.receipts.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail }))
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { (container.querySelector('.dm-menu-button') as HTMLButtonElement).click() })
    const receipt = container.querySelector<HTMLInputElement>('.dm-conversation-menu input')!
    await act(async () => { receipt.click() })
    expect(receipt.checked).toBe(false)
    await act(async () => { reject(new Error('Réglage refusé.')); await Promise.resolve() })
    await settle()
    expect(container.querySelector<HTMLInputElement>('.dm-conversation-menu input')?.checked).toBe(true)
  })

  it('appends a late private message without moving already visible rows', async () => {
    const later = { ...message, id: '77777777-7777-4777-8777-777777777777', content: 'B', submissionOrder: '20', createdAt: '2026-09-23T07:00:00.000Z' }
    const earlier = { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'A', submissionOrder: '19', createdAt: '2026-09-23T07:00:01.000Z' }
    directMessages.messages.mockResolvedValue({ messages: [later], nextCursor: null, windowSize: 1 })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    expect(Array.from(container.querySelectorAll('.dm-message p')).map(node => node.textContent)).toEqual(['B'])
    const existingRow = container.querySelector('.dm-message')
    directMessages.messages.mockResolvedValue({ messages: [earlier], nextCursor: null, windowSize: 2 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() }); await settle()
    expect(Array.from(container.querySelectorAll('.dm-message p')).map(node => node.textContent)).toEqual(['B', 'A'])
    expect(container.querySelectorAll('.dm-message')[0]).toBe(existingRow)
  })
})
