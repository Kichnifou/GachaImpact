// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DirectConversationDto, DirectMessageDto, DirectMessageMutationDto, DirectMessageReportPreviewDto } from '../api/types'

const directMessages = vi.hoisted(() => ({
  players: vi.fn(), list: vi.fn(), unread: vi.fn(), messages: vi.fn(), history: vi.fn(), historySearch: vi.fn(), historyDate: vi.fn(), initiate: vi.fn(), send: vi.fn(), edit: vi.fn(), remove: vi.fn(), restore: vi.fn(), accept: vi.fn(), ignore: vi.fn(), block: vi.fn(), unblock: vi.fn(), read: vi.fn(), receipts: vi.fn(), archive: vi.fn(), reportPreview: vi.fn(), report: vi.fn(),
}))
const social = vi.hoisted(() => ({ directory: vi.fn() }))
vi.mock('../api/game-api', () => ({
  ApiError: class ApiError extends Error { code: string; status: number | null; constructor(code: string, message: string, status: number | null) { super(message); this.code = code; this.status = status } },
  getGameApiClient: () => ({ directMessages, social }),
}))
import { directMessageReceiptLabel } from '../direct-messages/receipt-label'
import { ApiError } from '../api/game-api'
import DirectMessagePanel from './DirectMessagePanel'

const appCss = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const ownId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const conversationId = '33333333-3333-4333-8333-333333333333'
const requestId = '44444444-4444-4444-8444-444444444444'
const messageId = '55555555-5555-4555-8555-555555555555'
const message: DirectMessageDto = { id: messageId, conversationId, authorPlayerId: otherId, own: false, clientIntentKey: null, content: 'Bonjour https://example.com/ok', createdAt: '2026-09-23T07:00:00.000Z', submissionOrder: '1', editedAt: null, deletedAt: null, restoredAt: null, replyToMessageId: null, replyPreview: null, readByOther: false, readByOtherAt: null }
const reportLine = { id: messageId, authorPlayerId: otherId, authorDisplayName: 'Aster', content: 'Bonjour https://example.com/ok', createdAt: message.createdAt, submissionOrder: '1', editedAt: null, deletedAt: null, replyToMessageId: null, replyPreview: null }
const reportPreview: DirectMessageReportPreviewDto = { message: reportLine, context: [reportLine], snapshotFingerprint: 'a'.repeat(64), alreadyReported: false }
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
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Ast'); search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 80)) })
  await act(async () => { (Array.from(container.querySelectorAll('.dm-player-results button')).find(item => item.textContent?.includes('Aster')) as HTMLButtonElement).click() })
  await settle()
}

beforeEach(() => {
  vi.clearAllMocks()
  directMessages.list.mockImplementation(async (archived: boolean) => ({ conversations: archived ? [] : [baseConversation] }))
  directMessages.unread.mockResolvedValue({ unreadCount: 0, conversations: [] })
  directMessages.players.mockResolvedValue({ players: [] })
  directMessages.messages.mockResolvedValue({ messages: [message], nextCursor: null, windowSize: 1 })
  directMessages.history.mockResolvedValue({ messages: [{ ...message, canRestore: false }], olderCursor: null, newerCursor: null })
  directMessages.historySearch.mockResolvedValue({ results: [], nextCursor: null })
  directMessages.historyDate.mockResolvedValue({ anchor: { messageId, submissionOrder: message.submissionOrder, createdAt: message.createdAt } })
  directMessages.read.mockResolvedValue({ lastReadMessageId: messageId, sharedReadAt: null, changed: true })
  directMessages.send.mockResolvedValue({ conversationId, messageId, replayed: false })
  directMessages.edit.mockResolvedValue({ conversationId, messageId, replayed: false, message: { id: messageId, content: message.content, editedAt: message.editedAt, deletedAt: message.deletedAt, restoredAt: message.restoredAt } })
  directMessages.remove.mockResolvedValue({ conversationId, messageId, replayed: false, message: { id: messageId, content: null, editedAt: message.editedAt, deletedAt: '2026-09-23T08:00:00.000Z', restoredAt: null } })
  directMessages.restore.mockResolvedValue({ conversationId, messageId, replayed: false, message: { id: messageId, content: 'Texte restauré', editedAt: message.editedAt, deletedAt: null, restoredAt: '2026-09-23T08:05:00.000Z' } })
  directMessages.initiate.mockResolvedValue({ conversationId, messageId, requestId, state: 'PENDING', replayed: false })
  directMessages.accept.mockResolvedValue({ conversationId, requestId, state: 'ACCEPTED', replayed: false })
  directMessages.ignore.mockResolvedValue({ conversationId, requestId, state: 'REFUSED', replayed: false })
  directMessages.block.mockResolvedValue({ conversationId, blocked: true, changed: true, replayed: false })
  directMessages.unblock.mockResolvedValue({ conversationId, blocked: false, changed: true, replayed: false })
  directMessages.receipts.mockResolvedValue({ conversationId, readReceiptsEnabled: false, changed: true })
  directMessages.archive.mockResolvedValue({ conversationId, archived: true, changed: true })
  directMessages.reportPreview.mockResolvedValue(reportPreview)
  directMessages.report.mockResolvedValue({ reported: true, duplicate: false })
  social.directory.mockResolvedValue({ players: [], page: 1, pageSize: 20, total: 0, totalPages: 0 })
})
afterEach(() => { vi.restoreAllMocks(); act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren() })

describe('DirectMessagePanel', () => {
  it('uses discreet two-column tabs and no dimmed optimistic bubble style', () => {
    expect(appCss).toContain('.dm-list-tabs { display: grid; grid-template-columns: 1fr 1fr; align-items: end;')
    expect(appCss).toContain('.dm-list-tabs button { text-align: center; }')
    expect(appCss).not.toContain('.dm-list-tabs button:first-child { text-align: left; }')
    expect(appCss).not.toContain('.dm-list-tabs button:last-child { text-align: right; }')
    expect(appCss).toContain('.dm-list-tabs button[aria-selected="true"]::after')
    expect(appCss).not.toContain('.dm-message.pending { opacity:')
    expect(appCss).toContain('.dm-message-actions { position: absolute;')
    expect(appCss).toContain('.dm-message-delete-confirm { position: absolute;')
    expect(appCss).toContain('.dm-report-overlay { position: fixed;')
    expect(appCss).toContain('.dm-composer-reply { display: flex;')
    expect(appCss).toContain('.dm-history-result { grid-template-columns: minmax(0, 1fr); }')
    expect(appCss).toContain('.direct-community-pane { height: min(520px, 70dvh); }')
    expect(appCss).toContain('.direct-community-pane { overflow: hidden; }')
    expect(appCss).toContain('.dm-message-list { min-height: 0; flex: 1; overflow-y: auto;')
    expect(appCss).toContain('.dm-composer-wrap { flex: 0 0 auto;')
  })

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

  it('opens the loaded live thread at the bottom while retaining its own scroll owner and composer', async () => {
    let load!: (value: { messages: DirectMessageDto[]; nextCursor: null; windowSize: number }) => void
    directMessages.messages.mockReturnValueOnce(new Promise(resolve => { load = resolve }))
    const container = await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() })
    const list = container.querySelector<HTMLDivElement>('.dm-message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1_000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 300 })
    await act(async () => { load({ messages: [message], nextCursor: null, windowSize: 1 }); await Promise.resolve() }); await settle()
    expect(list.scrollTop).toBe(1_000)
    expect(container.querySelector('.dm-composer-wrap #dm-message')).not.toBeNull()
    list.scrollTop = 100
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    expect(list.scrollTop).toBe(100)
    list.scrollTop = 700
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    expect(list.scrollTop).toBe(700)
  })

  it('lets M2 queue visibly while M1 travels, then promotes M2 and frees the composer for M3', async () => {
    let finishFirst!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    let finishSecond!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve })).mockReturnValueOnce(new Promise(resolve => { finishSecond = resolve }))
    const container = await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() }); await settle()
    const field = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    const write = async (value: string) => act(async () => { field.focus(); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    await write('M1')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle()
    expect(directMessages.send).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.dm-message.pending')?.textContent).toContain('M1')
    expect(field.disabled).toBe(false)
    expect(document.activeElement).toBe(field)
    await write('M2')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(field.value).toBe('M2')
    expect(field.disabled).toBe(true)
    expect(container.querySelector('.dm-composer-wrap')?.classList.contains('queued')).toBe(true)
    expect(directMessages.send).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain('M2Envoi')
    await act(async () => { finishFirst({ conversationId, messageId: '77777777-7777-4777-8777-777777777777', replayed: false }); await Promise.resolve() }); await settle()
    expect(directMessages.send).toHaveBeenCalledTimes(2)
    expect(directMessages.send.mock.calls[1]?.[1]).toBe('M2')
    expect(container.querySelectorAll('.dm-message.pending')).toHaveLength(1)
    expect(container.querySelector('.dm-message.pending')?.textContent).toContain('M2')
    expect(field.value).toBe('')
    expect(field.disabled).toBe(false)
    expect(document.activeElement).toBe(field)
    await write('M3')
    expect(field.value).toBe('M3')
    await act(async () => { finishSecond({ conversationId, messageId: '88888888-8888-4888-8888-888888888888', replayed: false }); await Promise.resolve() }); await settle()
  })

  it('releases queued M2 as an editable reply after M1 fails, and recovers M1 with its original key', async () => {
    let failFirst!: (reason: Error) => void
    directMessages.send.mockReturnValueOnce(new Promise((_resolve, reject) => { failFirst = reject }))
    const container = await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() }); await settle()
    const field = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    const write = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    await write('M1')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    const firstKey = directMessages.send.mock.calls[0]?.[2]
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Répondre au message"]')!.click() })
    await write('M2')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(field.disabled).toBe(true)
    await act(async () => { failFirst(new Error('M1 échoué')); await Promise.resolve() }); await settle()
    expect(directMessages.send).toHaveBeenCalledTimes(1)
    expect(field.disabled).toBe(false)
    expect(field.value).toBe('M2')
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Aster')
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-recover-send')!.click() })
    expect(field.value).toBe('M1')
    expect(container.querySelector('.dm-composer-reply')).toBeNull()
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle()
    expect(directMessages.send.mock.calls[1]?.[2]).toBe(firstKey)
  })

  it('keeps the reply target and the queued idempotency key when M2 starts', async () => {
    let finishFirst!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    let finishSecond!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve })).mockReturnValueOnce(new Promise(resolve => { finishSecond = resolve }))
    const container = await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() }); await settle()
    const field = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    const write = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    await write('M1')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Répondre au message"]')!.click() })
    await write('M2 avec réponse')
    const queuedKey = crypto.randomUUID()
    const keySpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(queuedKey)
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(keySpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Bonjour')
    expect(field.disabled).toBe(true)
    await act(async () => { finishFirst({ conversationId, messageId: '77777777-7777-4777-8777-777777777777', replayed: false }); await Promise.resolve() }); await settle()
    expect(directMessages.send.mock.calls[1]?.[3]).toBe(messageId)
    expect(directMessages.send.mock.calls[1]?.[2]).toBe(queuedKey)
    expect(keySpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.dm-message.pending .dm-reply-preview')?.textContent).toContain('Bonjour')
    expect(container.querySelector('.dm-composer-reply')).toBeNull()
    keySpy.mockRestore()
    await act(async () => { finishSecond({ conversationId, messageId: '88888888-8888-4888-8888-888888888888', replayed: false }); await Promise.resolve() }); await settle()
  })

  it('freezes reply actions while M2 is queued, then restores them when M2 starts', async () => {
    const replyB: DirectMessageDto = { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'Cible B', submissionOrder: '2' }
    const ownReply: DirectMessageDto = { ...message, id: '99999999-9999-4999-8999-999999999999', authorPlayerId: ownId, own: true, content: 'Cible personnelle', submissionOrder: '3' }
    directMessages.messages.mockResolvedValue({ messages: [message, replyB, ownReply], nextCursor: null, windowSize: 3 })
    let finishFirst!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    let finishSecond!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve })).mockReturnValueOnce(new Promise(resolve => { finishSecond = resolve }))
    const container = await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() }); await settle()
    const field = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    const write = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    const replyButton = (id: string) => container.querySelector<HTMLButtonElement>(`[data-message-id="${id}"] [aria-label="Répondre au message"]`)!
    await write('M1')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { replyButton(messageId).click() })
    await write('M2')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Bonjour')
    expect(replyButton(replyB.id).disabled).toBe(true)
    expect(replyButton(ownReply.id).disabled).toBe(true)
    await act(async () => { replyButton(replyB.id).click() })
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Bonjour')
    expect(container.querySelector('.dm-composer-reply')?.textContent).not.toContain('Cible B')
    await act(async () => { finishFirst({ conversationId, messageId: '77777777-7777-4777-8777-777777777777', replayed: false }); await Promise.resolve() }); await settle()
    expect(directMessages.send.mock.calls[1]?.[3]).toBe(messageId)
    expect(replyButton(replyB.id).disabled).toBe(false)
    expect(replyButton(ownReply.id).disabled).toBe(false)
    await act(async () => { replyButton(replyB.id).click() })
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Cible B')
    await act(async () => { finishSecond({ conversationId, messageId: '88888888-8888-4888-8888-888888888888', replayed: false }); await Promise.resolve() }); await settle()
  })

  it('restores reply actions when a queued M2 becomes a draft after M1 fails', async () => {
    const replyB: DirectMessageDto = { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'Cible B', submissionOrder: '2' }
    directMessages.messages.mockResolvedValue({ messages: [message, replyB], nextCursor: null, windowSize: 2 })
    let failFirst!: (reason: Error) => void
    directMessages.send.mockReturnValueOnce(new Promise((_resolve, reject) => { failFirst = reject }))
    const container = await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() }); await settle()
    const field = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    const write = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    const replyButton = (id: string) => container.querySelector<HTMLButtonElement>(`[data-message-id="${id}"] [aria-label="Répondre au message"]`)!
    await write('M1')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { replyButton(messageId).click() })
    await write('M2')
    await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(replyButton(replyB.id).disabled).toBe(true)
    await act(async () => { failFirst(new Error('M1 échoué')); await Promise.resolve() }); await settle()
    expect(field.value).toBe('M2')
    expect(replyButton(replyB.id).disabled).toBe(false)
    await act(async () => { replyButton(replyB.id).click() })
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Cible B')
  })

  it('never sends a queued message after leaving its session and recovers it in its origin', async () => {
    const b = { ...baseConversation, id: '66666666-6666-4666-8666-666666666666', other: { ...baseConversation.other, displayName: 'Beryl' }, unreadCount: 0 }
    directMessages.list.mockResolvedValue({ conversations: [baseConversation, b] })
    let finishFirst!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve }))
    const container = await mount(baseConversation, true, true)
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0].click() }); await settle()
    const field = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    for (const value of ['M1', 'M2']) {
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
      await act(async () => { field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    }
    expect(field.disabled).toBe(true)
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[1].click() }); await settle()
    await act(async () => { finishFirst({ conversationId, messageId, replayed: false }); await Promise.resolve() }); await settle()
    expect(directMessages.send).toHaveBeenCalledTimes(1)
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('')
    expect(container.querySelector('.dm-recover-send')).toBeNull()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0].click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-recover-send')!.click() })
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('M2')
    await act(async () => { container.querySelector<HTMLTextAreaElement>('#dm-message')!.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle()
    expect(directMessages.send.mock.calls[1]?.[1]).toBe('M2')
  })

  it('does not inject a late failed send or reply from A into B', async () => {
    const bId = '66666666-6666-4666-8666-666666666666'
    const b = { ...baseConversation, id: bId, other: { ...baseConversation.other, displayName: 'Beryl' }, unreadCount: 0 }
    directMessages.list.mockResolvedValue({ conversations: [baseConversation, b] })
    let rejectA!: (reason: Error) => void
    directMessages.send.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectA = reject }))
    const container = await mount(baseConversation, true, true)
    await act(async () => { (container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0]).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Répondre au message"]')!.click() })
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Secret A'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { (container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[1]).click() }); await settle()
    const bComposer = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { bComposer.focus(); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(bComposer, 'Texte B'); bComposer.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { rejectA(new Error('Échec A')); await Promise.resolve() }); await settle()
    expect(bComposer.value).toBe('Texte B')
    expect(container.querySelector('.dm-composer-reply')).toBeNull()
    expect(document.activeElement).toBe(bComposer)
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { (container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0]).click() }); await settle()
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('')
    expect(container.querySelector('.dm-composer-reply')).toBeNull()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-composer-wrap > button')!.click() })
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('Secret A')
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Aster')
    const originalKey = directMessages.send.mock.calls[0]?.[2]
    await act(async () => { container.querySelector<HTMLTextAreaElement>('#dm-message')!.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle()
    expect(directMessages.send.mock.calls[1]?.[2]).toBe(originalKey)
  })

  it('does not reactivate an old rollback after A to B to A, and keeps a newer draft', async () => {
    const b = { ...baseConversation, id: '66666666-6666-4666-8666-666666666666', other: { ...baseConversation.other, displayName: 'Beryl' }, unreadCount: 0 }
    directMessages.list.mockResolvedValue({ conversations: [baseConversation, b] })
    let rejectA!: (reason: Error) => void
    directMessages.send.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectA = reject }))
    const container = await mount(baseConversation, true, true)
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0].click() }); await settle()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Ancien A'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[1].click() })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0].click() }); await settle()
    const current = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(current, 'Nouveau A'); current.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { rejectA(new Error('Échec ancien')); await Promise.resolve() }); await settle()
    expect(current.value).toBe('Nouveau A')
    expect(container.querySelector('.dm-composer-wrap > button')?.textContent).toContain('Récupérer')
  })

  it('ignores a late successful send after navigation', async () => {
    const b = { ...baseConversation, id: '66666666-6666-4666-8666-666666666666', other: { ...baseConversation.other, displayName: 'Beryl' }, unreadCount: 0 }
    directMessages.list.mockResolvedValue({ conversations: [baseConversation, b] })
    let resolveA!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise(resolve => { resolveA = resolve }))
    const container = await mount(baseConversation, true, true)
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0].click() }); await settle()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Ancien A'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[1].click() }); await settle()
    const bComposer = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { bComposer.focus(); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(bComposer, 'Texte B'); bComposer.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { resolveA({ conversationId, messageId, replayed: false }); await Promise.resolve() }); await settle()
    expect(bComposer.value).toBe('Texte B')
    expect(document.activeElement).toBe(bComposer)
    expect(container.querySelector('.dm-composer-wrap > button')).toBeNull()
  })

  it('does not release a newer B send when the earlier A send finishes', async () => {
    const bId = '66666666-6666-4666-8666-666666666666'
    const b = { ...baseConversation, id: bId, other: { ...baseConversation.other, displayName: 'Beryl' }, unreadCount: 0 }
    directMessages.list.mockResolvedValue({ conversations: [baseConversation, b] })
    let rejectA!: (reason: Error) => void
    let resolveB!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectA = reject })).mockReturnValueOnce(new Promise(resolve => { resolveB = resolve }))
    const container = await mount(baseConversation, true, true)
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[0].click() }); await settle()
    const aComposer = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(aComposer, 'A'); aComposer.dispatchEvent(new Event('input', { bubbles: true })); aComposer.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { container.querySelectorAll<HTMLButtonElement>('.dm-conversation-row-open')[1].click() }); await settle()
    const bComposer = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(bComposer, 'B'); bComposer.dispatchEvent(new Event('input', { bubbles: true })); bComposer.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(directMessages.send).toHaveBeenCalledTimes(2)
    expect(bComposer.disabled).toBe(false)
    await act(async () => { rejectA(new Error('Échec A')); await Promise.resolve() }); await settle()
    expect(bComposer.disabled).toBe(false)
    expect(bComposer.value).toBe('')
    await act(async () => { resolveB({ conversationId: bId, messageId, replayed: false }); await Promise.resolve() }); await settle()
    expect(bComposer.disabled).toBe(false)
  })

  it('does not select a late initiated conversation after leaving the new message flow', async () => {
    directMessages.list.mockResolvedValue({ conversations: [] })
    directMessages.players.mockResolvedValue({ players: [{ id: otherId, displayName: 'Aster', elementKey: null }] })
    let finish!: (value: { conversationId: string; messageId: string; requestId: string; state: 'PENDING'; replayed: boolean }) => void
    directMessages.initiate.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const container = await mount(baseConversation, true, true)
    await openNewMessageTarget(container)
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Premier message'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { finish({ conversationId, messageId, requestId, state: 'PENDING', replayed: false }); await Promise.resolve() }); await settle()
    expect(container.querySelector('.dm-conversation-list')).not.toBeNull()
    expect(container.querySelector('.dm-thread-identity')).toBeNull()
  })

  it('keeps a late initiation failure recoverable only after explicitly reopening its target', async () => {
    directMessages.list.mockResolvedValue({ conversations: [] })
    directMessages.players.mockResolvedValue({ players: [{ id: otherId, displayName: 'Aster', elementKey: null }] })
    let reject!: (reason: Error) => void
    directMessages.initiate.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail }))
    const container = await mount(baseConversation, true, true)
    await openNewMessageTarget(container)
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Premier message'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    const originalKey = directMessages.initiate.mock.calls[0]?.[2]
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { reject(new Error('Échec tardif')); await Promise.resolve() }); await settle()
    expect(container.querySelector('.dm-conversation-list')).not.toBeNull()
    expect(container.textContent).not.toContain('Échec tardif')
    await openNewMessageTarget(container)
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('')
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-recover-send')!.click() })
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('Premier message')
    await act(async () => { container.querySelector<HTMLTextAreaElement>('#dm-message')!.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle()
    expect(directMessages.initiate.mock.calls[1]?.[2]).toBe(originalKey)
  })

  it('keeps a newer reply intent when the previous send fails in the same conversation', async () => {
    let reject!: (reason: Error) => void
    directMessages.send.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail }))
    const container = await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() }); await settle()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Ancien texte'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Répondre au message"]')!.click() })
    await act(async () => { reject(new Error('Échec ancien')); await Promise.resolve() }); await settle()
    expect(textarea.value).toBe('')
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Aster')
    expect(container.querySelector('.dm-recover-send')).not.toBeNull()
  })

  it('restores composer focus and the end caret after success or failure without stealing a voluntary focus move', async () => {
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    const write = async (value: string) => act(async () => {
      textarea.focus()
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await write('Succès')
    const sendButton = container.querySelector<HTMLButtonElement>('.dm-send')!
    await act(async () => { sendButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); sendButton.click() }); await settle()
    expect(document.activeElement).toBe(textarea); expect(textarea.selectionStart).toBe(0); expect(textarea.selectionEnd).toBe(0)

    directMessages.send.mockRejectedValueOnce(new Error('Échec contrôlé'))
    await write('Texte restauré')
    await act(async () => { textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle()
    expect(textarea.value).toBe('Texte restauré'); expect(document.activeElement).toBe(textarea); expect(textarea.selectionEnd).toBe(textarea.value.length)

    let finish!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await write('Ne pas voler')
    await act(async () => { textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    const back = container.querySelector<HTMLButtonElement>('.dm-back')!
    act(() => back.focus())
    await act(async () => { finish({ conversationId, messageId, replayed: false }); await Promise.resolve() }); await settle()
    expect(document.activeElement).toBe(back)
  })

  it('selects, previews and optimistically sends a persistent reply, then restores it safely on failure', async () => {
    let finish!: (value: { conversationId: string; messageId: string; replayed: boolean }) => void
    directMessages.send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Répondre au message"]')!.click() })
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Réponse à Aster')
    const textarea = container.querySelector<HTMLTextAreaElement>('#dm-message')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Ma réponse'); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(directMessages.send).toHaveBeenCalledWith(conversationId, 'Ma réponse', expect.any(String), messageId)
    expect(container.querySelector('[data-message-id^="optimistic:"] .dm-reply-preview')?.textContent).toContain('Bonjour')
    expect(container.querySelector('.dm-composer-reply')).toBeNull()
    await act(async () => { finish({ conversationId, messageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', replayed: false }); await Promise.resolve() }); await settle()

    directMessages.send.mockRejectedValueOnce(new Error('Réponse refusée'))
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Répondre au message"]')!.click() })
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Nouvel essai'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await settle()
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Réponse à Aster')
    expect(textarea.value).toBe('Nouvel essai')
  })

  it('returns from history to the recent composer when replying', async () => {
    directMessages.history.mockResolvedValue({ messages: [{ ...message, canRestore: false }], olderCursor: null, newerCursor: null })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Répondre au message"]')!.click() }); await settle()
    expect(container.querySelector('.dm-history')).toBeNull()
    expect(container.querySelector('.dm-composer-reply')?.textContent).toContain('Réponse à Aster')
    expect(document.activeElement).toBe(container.querySelector('#dm-message'))
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
    directMessages.players.mockResolvedValue({ players: [candidate] })
    const container = await mount(baseConversation, true, true)
    await act(async () => { (Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Nouveau message') as HTMLButtonElement).click() })
    const search = container.querySelector<HTMLInputElement>('#dm-player-search')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Ast'); search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 80)) })
    expect(directMessages.players).toHaveBeenCalledWith('Ast')
    expect(social.directory).not.toHaveBeenCalled()
    await act(async () => { (Array.from(container.querySelectorAll('.dm-player-results button')).find(item => item.textContent?.includes('Aster')) as HTMLButtonElement).click() })
    await settle()
    expect(directMessages.players).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.dm-player-results')).toBeNull()
    expect(container.textContent).toContain('Écrivez le premier message.')
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

  it('replaces an old search with a deep-linked target and ignores the late old result', async () => {
    const oldTarget = { id: otherId, displayName: 'MynonymeTest2', elementKey: 'hydro' as const }
    const linkedTarget = { id: '66666666-6666-4666-8666-666666666666', displayName: 'MynonymeTest3', elementKey: 'pyro' as const }
    let release!: (value: { players: readonly typeof oldTarget[] }) => void
    directMessages.list.mockResolvedValue({ conversations: [] })
    directMessages.players.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container); roots.push(root)
    const render = (intent: Parameters<typeof DirectMessagePanel>[0]['intent']) => root.render(<DirectMessagePanel playerId={ownId} isActive intent={intent} onIntentConsumed={intentConsumed} onUnreadChange={unreadChanged} onOpenProfile={openProfile} />)
    await act(async () => { render(null); await Promise.resolve() }); await settle()
    await act(async () => { (Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Nouveau message') as HTMLButtonElement).click() })
    const search = container.querySelector<HTMLInputElement>('#dm-player-search')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, oldTarget.displayName); search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 80)) })
    expect(directMessages.players).toHaveBeenCalledTimes(1)
    await act(async () => { render({ playerId: linkedTarget.id, player: linkedTarget, token: 'deep-link-3' }); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector<HTMLInputElement>('#dm-player-search')?.value).toBe(linkedTarget.displayName)
    expect(container.textContent).not.toContain(oldTarget.displayName)
    expect(container.querySelector('.dm-player-results')).toBeNull()
    expect(container.textContent).toContain('Écrivez le premier message.')
    expect(container.textContent).not.toContain('La conversation ne sera créée qu’à son envoi.')
    expect(container.querySelector('#dm-message')).not.toBeNull()
    expect(directMessages.players).toHaveBeenCalledTimes(1)
    await act(async () => { release({ players: [oldTarget] }); await Promise.resolve() })
    expect(container.textContent).not.toContain(oldTarget.displayName)
    expect(container.querySelector('.dm-player-results')).toBeNull()
  })

  it('shows the first message optimistically and adopts a pending conversation without a flash or duplicate', async () => {
    const candidate = { id: otherId, displayName: 'Aster', elementKey: 'hydro' as const }
    let confirm!: (value: { conversationId: string; messageId: string; requestId: string; state: 'PENDING'; replayed: boolean }) => void
    directMessages.list.mockResolvedValue({ conversations: [] })
    directMessages.messages.mockReturnValue(new Promise(() => undefined))
    directMessages.initiate.mockReturnValueOnce(new Promise(resolve => { confirm = resolve }))
    directMessages.players.mockResolvedValue({ players: [candidate] })
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
    directMessages.players.mockResolvedValue({ players: [candidate] })
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
    directMessages.players.mockResolvedValue({ players: [candidate] })
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
    expect(container.querySelector(`[data-message-id="${sentId}"] .dm-message-bubble p`)?.textContent).toBe('Instantané')
    expect(container.querySelector('.dm-latest-status')?.textContent).toBe('Envoyé')
  })

  it('exposes edit/delete only on own messages and edits inline without moving or duplicating the row', async () => {
    let projectedOwn: DirectMessageDto = { ...message, id: '77777777-7777-4777-8777-777777777777', authorPlayerId: ownId, own: true, content: 'Mon texte', submissionOrder: '2' }
    const conversation = { ...baseConversation, lastMessage: projectedOwn, lastMessageAt: projectedOwn.createdAt }
    directMessages.messages.mockImplementation(async () => ({ messages: [message, projectedOwn], nextCursor: null, windowSize: 2 }))
    directMessages.edit.mockImplementation(async (_conversation: string, _message: string, content: string) => {
      projectedOwn = { ...projectedOwn, content, editedAt: '2026-09-23T08:00:00.000Z' }
      return { conversationId, messageId: projectedOwn.id, replayed: false, message: { id: projectedOwn.id, content: projectedOwn.content, editedAt: projectedOwn.editedAt, deletedAt: projectedOwn.deletedAt, restoredAt: projectedOwn.restoredAt } }
    })
    const container = await mount(conversation)
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const otherRow = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!, ownRow = container.querySelector<HTMLElement>(`[data-message-id="${projectedOwn.id}"]`)!
    expect(otherRow.querySelector('[aria-label="Modifier le message"]')).toBeNull()
    expect(ownRow.textContent).not.toContain('⋯')
    expect(Array.from(ownRow.querySelectorAll('.dm-message-actions button')).map(button => button.getAttribute('aria-label'))).toEqual(['Modifier le message', 'Répondre au message', 'Supprimer le message'])
    await act(async () => { ownRow.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    const editor = ownRow.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    expect(editor.value).toBe('Mon texte')
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(editor, 'Annulé'); editor.dispatchEvent(new Event('input', { bubbles: true })); (Array.from(ownRow.querySelectorAll('button')).find(button => button.textContent === 'Annuler') as HTMLButtonElement).click() })
    expect(directMessages.edit).not.toHaveBeenCalled()
    await act(async () => { ownRow.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    const reopened = ownRow.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reopened, 'Texte corrigé'); reopened.dispatchEvent(new Event('input', { bubbles: true })); (Array.from(ownRow.querySelectorAll('button')).find(button => button.textContent === 'Sauvegarder') as HTMLButtonElement).click() })
    await settle()
    expect(directMessages.edit).toHaveBeenCalledWith(conversationId, projectedOwn.id, 'Texte corrigé', expect.any(String))
    expect(container.querySelector(`[data-message-id="${projectedOwn.id}"] .dm-message-bubble p`)?.textContent).toBe('Texte corrigé')
    expect(container.querySelector(`[data-message-id="${projectedOwn.id}"] .dm-message-edited`)?.textContent).toBe('Modifié')
    expect(container.querySelectorAll(`[data-message-id="${projectedOwn.id}"]`)).toHaveLength(1)
  })

  it('scrolls the complete near-bottom editor into the thread viewport and focuses its text end', async () => {
    const own: DirectMessageDto = { ...message, id: '77777777-7777-4777-8777-777777777777', authorPlayerId: ownId, own: true, content: 'Texte à modifier', submissionOrder: '2' }
    directMessages.messages.mockResolvedValue({ messages: [message, own], nextCursor: null, windowSize: 2 })
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const list = container.querySelector<HTMLDivElement>('.dm-message-list')!; list.scrollTop = 20
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('dm-message-list')) return { top: 0, bottom: 100, left: 0, right: 300, width: 300, height: 100, x: 0, y: 0, toJSON: () => ({}) }
      if (this.classList.contains('dm-message-edit')) return { top: 70, bottom: 160, left: 100, right: 300, width: 200, height: 90, x: 100, y: 70, toJSON: () => ({}) }
      return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }
    })
    const row = container.querySelector<HTMLElement>(`[data-message-id="${own.id}"]`)!
    await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    const textarea = row.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    expect(list.scrollTop).toBe(80)
    expect(document.activeElement).toBe(textarea)
    expect(textarea.selectionStart).toBe(textarea.value.length)
    expect(Array.from(row.querySelectorAll('button')).map(button => button.textContent)).toEqual(['Sauvegarder', 'Annuler'])
    rect.mockRestore()
  })

  for (const surface of ['recent', 'history'] as const) {
    it(`scrolls only the ${surface} message owner just enough to reveal a delete confirmation`, async () => {
      const own = { ...message, authorPlayerId: ownId, own: true, content: 'À supprimer', canRestore: false }
      directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
      directMessages.history.mockResolvedValue({ messages: [own], olderCursor: null, newerCursor: null })
      const container = await mount({ ...baseConversation, lastMessage: own })
      await act(async () => { container.querySelector<HTMLButtonElement>('.dm-conversation-row-open')!.click() }); await settle()
      if (surface === 'history') {
        await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
        await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet')!.click() }); await settle()
      }
      const owner = container.querySelector<HTMLDivElement>(surface === 'history' ? '.dm-history-body' : '.dm-message-list')!
      owner.scrollTop = 20
      const globalScroll = vi.spyOn(window, 'scrollTo')
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        if (this === owner) return { top: 0, bottom: 100, left: 0, right: 300, width: 300, height: 100, x: 0, y: 0, toJSON: () => ({}) }
        if (this.classList.contains('dm-message-delete-confirm')) return { top: 85, bottom: 130, left: 0, right: 160, width: 160, height: 45, x: 0, y: 85, toJSON: () => ({}) }
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }
      })
      const row = owner.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
      expect(row.querySelector('.dm-message-bubble > .dm-message-actions')).not.toBeNull()
      await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
      expect(owner.scrollTop).toBe(50)
      expect(globalScroll).not.toHaveBeenCalled()
      await act(async () => { row.querySelector<HTMLButtonElement>('.dm-message-delete-confirm button:last-child')!.click() })
      owner.scrollTop = 20
      rect.mockImplementation(function (this: HTMLElement) {
        if (this === owner) return { top: 0, bottom: 100, left: 0, right: 300, width: 300, height: 100, x: 0, y: 0, toJSON: () => ({}) }
        if (this.classList.contains('dm-message-delete-confirm')) return { top: 30, bottom: 80, left: 0, right: 160, width: 160, height: 50, x: 0, y: 30, toJSON: () => ({}) }
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }
      })
      await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
      expect(owner.scrollTop).toBe(20)
      rect.mockRestore(); globalScroll.mockRestore()
    })
  }

  it('saves edit on Enter, inserts a newline on Ctrl+Enter and ignores composing Enter', async () => {
    let own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Texte initial' }
    directMessages.messages.mockImplementation(async () => ({ messages: [own], nextCursor: null, windowSize: 1 }))
    directMessages.edit.mockImplementation(async (_conversationId: string, _messageId: string, content: string) => {
      own = { ...own, content, editedAt: '2026-09-24T08:00:00.000Z' }
      return { conversationId, messageId, replayed: false, message: { id: messageId, content, editedAt: own.editedAt, deletedAt: null, restoredAt: null } }
    })
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const openEditor = async () => { await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() }); return container.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')! }
    let textarea = await openEditor()
    await act(async () => { textarea.setSelectionRange(textarea.value.length, textarea.value.length); const shortcut = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); Object.defineProperty(shortcut, 'ctrlKey', { value: true }); textarea.dispatchEvent(shortcut) })
    expect(textarea.value).toBe('Texte initial\n'); expect(directMessages.edit).not.toHaveBeenCalled()
    await act(async () => { const composing = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); Object.defineProperty(composing, 'isComposing', { value: true }); textarea.dispatchEvent(composing) })
    expect(directMessages.edit).not.toHaveBeenCalled(); expect(container.querySelector('.dm-message-edit')).not.toBeNull()
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Texte validé'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await Promise.resolve() }); await settle()
    expect(directMessages.edit).toHaveBeenCalledWith(conversationId, messageId, 'Texte validé', expect.any(String))
    expect(container.querySelector('.dm-message-bubble p')?.textContent).toBe('Texte validé')
  })

  it('closes the editor and publishes the optimistic edit before an Enter mutation resolves', async () => {
    const own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Ancien' }
    directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
    directMessages.edit.mockReturnValue(new Promise(() => undefined))
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    const textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Nouveau'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(container.querySelector('.dm-message-edit')).toBeNull()
    expect(container.textContent).not.toContain('Sauvegarder'); expect(container.textContent).not.toContain('Annuler')
    expect(container.querySelector('.dm-message-bubble p')?.textContent).toBe('Nouveau')
    expect(directMessages.edit).toHaveBeenCalledTimes(1)
  })

  it('closes the editor before a Save click resolves and keeps one authoritative row', async () => {
    let resolveEdit!: (value: DirectMessageMutationDto) => void
    let own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Ancien' }
    directMessages.messages.mockImplementation(async () => ({ messages: [own], nextCursor: null, windowSize: 1 }))
    directMessages.edit.mockReturnValue(new Promise(resolve => { resolveEdit = resolve }))
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    const textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Nouveau'); textarea.dispatchEvent(new Event('input', { bubbles: true })); (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-message-edit button')).find(button => button.textContent === 'Sauvegarder'))!.click(); await Promise.resolve() })
    expect(container.querySelector('.dm-message-edit')).toBeNull(); expect(container.querySelector('.dm-message-bubble p')?.textContent).toBe('Nouveau'); expect(directMessages.edit).toHaveBeenCalledTimes(1)
    await act(async () => { own = { ...own, content: 'Nouveau', editedAt: '2026-09-24T09:00:00.000Z' }; resolveEdit({ conversationId, messageId, replayed: false, message: { id: messageId, content: 'Nouveau', editedAt: own.editedAt, deletedAt: null, restoredAt: null } }); await Promise.resolve() }); await settle()
    expect(container.querySelector('.dm-message-edit')).toBeNull(); expect(container.querySelector('.dm-message-bubble p')?.textContent).toBe('Nouveau'); expect(container.querySelectorAll(`[data-message-id="${messageId}"]`)).toHaveLength(1)
  })

  it('keeps the editor closed when a deterministic edit refusal rolls back', async () => {
    let rejectEdit!: (reason: Error) => void
    const own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Ancien' }
    directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
    directMessages.edit.mockReturnValue(new Promise((_resolve, reject) => { rejectEdit = reject }))
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    const textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Nouveau'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(container.querySelector('.dm-message-edit')).toBeNull(); expect(container.querySelector('.dm-message-bubble p')?.textContent).toBe('Nouveau')
    await act(async () => { rejectEdit(new ApiError('DIRECT_MESSAGE_UNAVAILABLE', 'Refusée', 409)); await Promise.resolve(); await Promise.resolve() }); await settle()
    expect(container.querySelector('.dm-message-edit')).toBeNull(); expect(container.querySelector('.dm-message-bubble p')?.textContent).toBe('Ancien'); expect(container.querySelector('.dm-message-action-error')?.textContent).toContain('Refusée')
  })

  it('cancels edit outside while clicks inside the editor still reach Save', async () => {
    const own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Original' }
    directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
    directMessages.edit.mockImplementation(async (_conversationId: string, _messageId: string, content: string) => ({ conversationId, messageId, replayed: false, message: { id: messageId, content, editedAt: '2026-09-24T08:00:00.000Z', deletedAt: null, restoredAt: null } }))
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    let textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Abandonné'); textarea.dispatchEvent(new Event('input', { bubbles: true })); container.querySelector('.dm-message-list')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) })
    expect(container.querySelector('.dm-message-edit')).toBeNull(); expect(container.querySelector('.dm-message-bubble p')?.textContent).toBe('Original'); expect(directMessages.edit).not.toHaveBeenCalled()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Modifier le message"]')!.click() })
    textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="Modifier le message"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Sauvé'); textarea.dispatchEvent(new Event('input', { bubbles: true })); const save = Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-message-edit button')).find(button => button.textContent === 'Sauvegarder')!; save.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); save.click(); await Promise.resolve() }); await settle()
    expect(directMessages.edit).toHaveBeenCalledWith(conversationId, messageId, 'Sauvé', expect.any(String))
  })

  it('toggles author actions on coarse tap and closes actions or delete confirmation outside and on Escape', async () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query === '(pointer: coarse)', media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as unknown as MediaQueryList)
    const own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Stable' }
    directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const row = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!, bubble = row.querySelector<HTMLElement>('.dm-message-bubble')!
    await act(async () => { bubble.click() }); expect(row.classList.contains('actions-open')).toBe(true)
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) }); expect(row.classList.contains('actions-open')).toBe(false)
    await act(async () => { bubble.click() }); expect(row.classList.contains('actions-open')).toBe(true)
    await act(async () => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) }); expect(row.classList.contains('actions-open')).toBe(false)

    const before = bubble.getBoundingClientRect()
    await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
    const confirmation = row.querySelector<HTMLElement>('.dm-message-delete-confirm')!
    expect(confirmation.parentElement).toBe(row.querySelector('.dm-message-content'))
    expect(bubble.getBoundingClientRect()).toEqual(before)
    await act(async () => { bubble.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) })
    expect(row.querySelector('.dm-message-delete-confirm')).toBeNull()
    expect(directMessages.remove).not.toHaveBeenCalled()
    matchMedia.mockRestore()
  })

  it('confirms deletion in place, hides delivery status and previews the deleted last message explicitly', async () => {
    let projectedOwn: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'À supprimer', readByOther: true, readByOtherAt: '2026-09-23T07:05:00.000Z' }
    let conversation: DirectConversationDto = { ...baseConversation, lastMessage: projectedOwn }
    directMessages.messages.mockImplementation(async () => ({ messages: [projectedOwn], nextCursor: null, windowSize: 1 }))
    directMessages.list.mockImplementation(async (archived: boolean) => ({ conversations: archived ? [] : [conversation] }))
    directMessages.remove.mockImplementation(async () => {
      projectedOwn = { ...projectedOwn, content: null, deletedAt: '2026-09-23T08:00:00.000Z' }; conversation = { ...conversation, lastMessage: projectedOwn }
      return { conversationId, messageId, replayed: false, message: { id: messageId, content: null, editedAt: projectedOwn.editedAt, deletedAt: projectedOwn.deletedAt, restoredAt: projectedOwn.restoredAt } }
    })
    const container = await mount(conversation, true, true)
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    expect(container.querySelector('.dm-latest-status')).not.toBeNull()
    const ownRow = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
    await act(async () => { ownRow.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
    expect(ownRow.textContent).toContain('Supprimer ce message ?')
    await act(async () => { (Array.from(ownRow.querySelectorAll('.dm-message-delete-confirm button')).find(button => button.textContent === 'Confirmer') as HTMLButtonElement).click() }); await settle()
    expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-bubble p`)?.textContent).toBe('Message supprimé')
    expect(container.querySelectorAll(`[data-message-id="${messageId}"]`)).toHaveLength(1)
    expect(container.querySelector('.dm-latest-status')).toBeNull()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() }); await settle()
    expect(container.querySelector('.dm-conversation-copy small')?.textContent).toBe('Message supprimé')
  })

  it('restores only an own deleted message and keeps the same row identity', async () => {
    let ownDeleted: DirectMessageDto = { ...message, id: '77777777-7777-4777-8777-777777777777', authorPlayerId: ownId, own: true, content: null, submissionOrder: '2', deletedAt: '2026-09-23T08:00:00.000Z' }
    const otherDeleted: DirectMessageDto = { ...message, content: null, deletedAt: '2026-09-23T07:30:00.000Z' }
    const conversation = { ...baseConversation, lastMessage: ownDeleted }
    directMessages.messages.mockResolvedValueOnce({ messages: [otherDeleted, ownDeleted], nextCursor: null, windowSize: 2 }).mockReturnValue(new Promise(() => undefined))
    directMessages.restore.mockImplementation(async () => {
      ownDeleted = { ...ownDeleted, content: 'Texte restauré', deletedAt: null, restoredAt: '2026-09-23T08:05:00.000Z' }
      return { conversationId, messageId: ownDeleted.id, replayed: false, message: { id: ownDeleted.id, content: ownDeleted.content, editedAt: ownDeleted.editedAt, deletedAt: ownDeleted.deletedAt, restoredAt: ownDeleted.restoredAt } }
    })
    const container = await mount(conversation)
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    expect(container.querySelector(`[data-message-id="${messageId}"] [aria-label="Restaurer le message"]`)).toBeNull()
    const ownRow = container.querySelector<HTMLElement>(`[data-message-id="${ownDeleted.id}"]`)!
    expect(ownRow.textContent).not.toContain('⋯')
    expect(Array.from(ownRow.querySelectorAll('.dm-message-actions button')).map(button => button.getAttribute('aria-label'))).toEqual(['Restaurer le message'])
    await act(async () => { ownRow.querySelector<HTMLButtonElement>('[aria-label="Restaurer le message"]')!.click() }); await settle()
    expect(directMessages.restore).toHaveBeenCalledWith(conversationId, ownDeleted.id, expect.any(String))
    expect(container.querySelector(`[data-message-id="${ownDeleted.id}"] .dm-message-bubble p`)?.textContent).toBe('Texte restauré')
    expect(container.querySelectorAll(`[data-message-id="${ownDeleted.id}"]`)).toHaveLength(1)
  })

  it('closes delete confirmation before a slow mutation settles and keeps it closed after success', async () => {
    let own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Suppression lente' }
    let resolveDelete!: (value: DirectMessageMutationDto) => void
    directMessages.messages.mockImplementation(async () => ({ messages: [own], nextCursor: null, windowSize: 1 }))
    directMessages.remove.mockReturnValue(new Promise(resolve => { resolveDelete = resolve }))
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const row = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!, bubble = row.querySelector<HTMLElement>('.dm-message-bubble')!, before = bubble.getBoundingClientRect()
    await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
    expect(row.querySelector('.dm-message-delete-confirm')).not.toBeNull()
    await act(async () => { row.querySelector<HTMLButtonElement>('.dm-message-delete-confirm button')!.click(); await Promise.resolve() })
    const optimisticRow = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
    expect(optimisticRow.querySelector('.dm-message-delete-confirm')).toBeNull()
    expect(optimisticRow.querySelector('.dm-message-bubble p')?.textContent).toBe('Message supprimé')
    expect(directMessages.remove).toHaveBeenCalledTimes(1); expect(bubble.getBoundingClientRect()).toEqual(before)
    await act(async () => { own = { ...own, content: null, deletedAt: '2026-09-24T08:00:00.000Z' }; resolveDelete({ conversationId, messageId, replayed: false, message: { id: messageId, content: null, editedAt: null, deletedAt: own.deletedAt, restoredAt: null } }); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-delete-confirm`)).toBeNull(); expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-bubble p`)?.textContent).toBe('Message supprimé')
  })

  it('keeps delete confirmation closed when a deterministic refusal rolls back the tombstone', async () => {
    const own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Contenu original' }
    let rejectDelete!: (reason: Error) => void
    directMessages.messages.mockResolvedValue({ messages: [own], nextCursor: null, windowSize: 1 })
    directMessages.remove.mockReturnValue(new Promise((_resolve, reject) => { rejectDelete = reject }))
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const row = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
    await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-message-delete-confirm button')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-delete-confirm`)).toBeNull(); expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-bubble p`)?.textContent).toBe('Message supprimé')
    await act(async () => { rejectDelete(new ApiError('DIRECT_MESSAGE_UNAVAILABLE', 'Refusée', 409)); await Promise.resolve(); await Promise.resolve() }); await settle()
    expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-bubble p`)?.textContent).toBe('Contenu original')
    expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-delete-confirm`)).toBeNull(); expect(container.querySelector('.dm-message-action-error')?.textContent).toContain('Refusée')
  })

  it('restores a just-deleted local content immediately and rolls it back on a deterministic refusal', async () => {
    let own: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Contenu éphémère' }
    directMessages.messages.mockImplementation(async () => ({ messages: [own], nextCursor: null, windowSize: 1 }))
    directMessages.remove.mockImplementation(async () => {
      own = { ...own, content: null, deletedAt: '2026-09-23T08:00:00.000Z', restoredAt: null }
      return { conversationId, messageId, replayed: false, message: { id: messageId, content: null, editedAt: null, deletedAt: own.deletedAt, restoredAt: null } }
    })
    let rejectRestore!: (reason: Error) => void
    directMessages.restore.mockReturnValue(new Promise((_resolve, reject) => { rejectRestore = reject }))
    const container = await mount({ ...baseConversation, lastMessage: own })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    let row = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
    await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
    await act(async () => { row.querySelector<HTMLButtonElement>('.dm-message-delete-confirm button')!.click() }); await settle()
    expect(row.querySelector('.dm-message-bubble p')?.textContent).toBe('Message supprimé')
    row = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
    await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Restaurer le message"]')!.click(); await Promise.resolve() })
    expect(row.querySelector('.dm-message-bubble p')?.textContent).toBe('Contenu éphémère')
    await act(async () => { rejectRestore(new ApiError('DIRECT_MESSAGE_UNAVAILABLE', 'Refusée', 409)); await Promise.resolve(); await Promise.resolve() }); await settle()
    row = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
    expect(row.querySelector('.dm-message-bubble p')?.textContent).toBe('Message supprimé')
  })

  it('rolls back a deterministic deletion and reuses the key after an ambiguous deletion', async () => {
    let projectedOwn: DirectMessageDto = { ...message, authorPlayerId: ownId, own: true, content: 'Conserver' }
    directMessages.messages.mockImplementation(async () => ({ messages: [projectedOwn], nextCursor: null, windowSize: 1 }))
    directMessages.remove.mockRejectedValueOnce(new ApiError('DIRECT_MESSAGE_UNAVAILABLE', 'Refusée', 409))
      .mockRejectedValueOnce(new Error('Réponse perdue'))
      .mockImplementationOnce(async () => { projectedOwn = { ...projectedOwn, content: null, deletedAt: '2026-09-23T08:00:00.000Z' }; return { conversationId, messageId, replayed: true, message: { id: messageId, content: null, editedAt: projectedOwn.editedAt, deletedAt: projectedOwn.deletedAt, restoredAt: projectedOwn.restoredAt } } })
    const container = await mount({ ...baseConversation, lastMessage: projectedOwn })
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const confirmDelete = async () => {
      const row = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)!
      await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
      await act(async () => { (Array.from(row.querySelectorAll('.dm-message-delete-confirm button')).find(button => button.textContent === 'Confirmer') as HTMLButtonElement).click() }); await settle()
    }
    await confirmDelete()
    expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-bubble p`)?.textContent).toBe('Conserver')
    await confirmDelete()
    expect(container.querySelector(`[data-message-id="${messageId}"] .dm-message-bubble p`)?.textContent).toBe('Message supprimé')
    const ambiguousKey = directMessages.remove.mock.calls[1]?.[2]
    await act(async () => { (Array.from(container.querySelectorAll('.dm-message-action-error button')).find(button => button.textContent === 'Réessayer') as HTMLButtonElement).click() }); await settle()
    expect(directMessages.remove.mock.calls[2]?.[2]).toBe(ambiguousKey)
    expect(container.querySelectorAll(`[data-message-id="${messageId}"]`)).toHaveLength(1)
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

  it('opens full history without marking it read and returns to the live draft and scroll', async () => {
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const composer = container.querySelector<HTMLTextAreaElement>('#dm-message')!, live = container.querySelector<HTMLDivElement>('.dm-message-list')!
    live.scrollTop = 73
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(composer, 'Brouillon conservÃ©'); composer.dispatchEvent(new Event('input', { bubbles: true })) })
    directMessages.read.mockClear()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    expect(container.querySelector('.dm-history')).not.toBeNull(); expect(container.textContent).toContain('conversation avec Aster')
    expect(directMessages.history).toHaveBeenCalledWith(conversationId, {}); expect(directMessages.read).not.toHaveBeenCalled()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-history-recent')!.click() })
    expect(container.querySelector<HTMLTextAreaElement>('#dm-message')?.value).toBe('Brouillon conservÃ©')
    expect(container.querySelector<HTMLDivElement>('.dm-message-list')?.scrollTop).toBe(73)
  })

  it('searches history serially and jumps to search and date anchors with a highlight', async () => {
    const found = { ...message, id: '99999999-9999-4999-8999-999999999999', content: 'Aiguille historique', submissionOrder: '42', canRestore: false }
    directMessages.historySearch.mockResolvedValue({ results: [found], nextCursor: null })
    directMessages.history.mockImplementation(async (_id: string, cursor: { aroundOrder?: string } = {}) => ({ messages: cursor.aroundOrder ? [found] : [{ ...message, canRestore: false }], olderCursor: cursor.aroundOrder ? '40' : null, newerCursor: cursor.aroundOrder ? '44' : null }))
    directMessages.historyDate.mockResolvedValue({ anchor: { messageId: found.id, submissionOrder: found.submissionOrder, createdAt: found.createdAt } })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    const search = container.querySelector<HTMLInputElement>('.dm-history-tools input[type="search"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'aiguille'); search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 230)) }); await settle()
    expect(directMessages.historySearch).toHaveBeenCalledWith(conversationId, 'aiguille', undefined)
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-history-results button')!.click() }); await settle()
    expect(directMessages.history).toHaveBeenCalledWith(conversationId, { aroundOrder: '42' })
    expect(container.querySelector(`[data-message-id="${found.id}"]`)?.classList.contains('dm-history-highlight')).toBe(true)
    const date = container.querySelector<HTMLInputElement>('.dm-history-tools input[type="date"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(date, '2026-09-24'); date.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-history-tools button')).find(button => button.textContent === 'Aller'))!.click(); await Promise.resolve() }); await settle()
    expect(directMessages.historyDate).toHaveBeenCalledWith(conversationId, new Date('2026-09-24T00:00:00').toISOString())
  })

  it('loads older history automatically and preserves the visible prepend anchor', async () => {
    const older = { ...message, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', content: 'Plus ancien', submissionOrder: '99', canRestore: false }
    const recent = { ...message, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', content: 'Plus récent', submissionOrder: '100', canRestore: false }
    let height = 200
    directMessages.history.mockImplementation(async (_id: string, cursor: { beforeOrder?: string } = {}) => {
      if (cursor.beforeOrder) { height = 320; return { messages: [older], olderCursor: null, newerCursor: null } }
      return { messages: [recent], olderCursor: '100', newerCursor: null }
    })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    const owner = container.querySelector<HTMLDivElement>('.dm-history-body')!
    Object.defineProperty(owner, 'scrollHeight', { configurable: true, get: () => height })
    Object.defineProperty(owner, 'clientHeight', { configurable: true, value: 100 })
    owner.scrollTop = 20
    await act(async () => { owner.dispatchEvent(new Event('scroll', { bubbles: true })); await Promise.resolve() }); await settle()
    expect(directMessages.history).toHaveBeenCalledWith(conversationId, { beforeOrder: '100' })
    expect(Array.from(owner.querySelectorAll('.dm-message p')).map(node => node.textContent)).toEqual(['Plus ancien', 'Plus récent'])
    expect(owner.scrollTop).toBe(140)
  })

  it('loads newer history automatically after a search jump', async () => {
    const found = { ...message, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', content: 'Ancre', submissionOrder: '42', canRestore: false }
    const newer = { ...message, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', content: 'Après ancre', submissionOrder: '45', canRestore: false }
    directMessages.historySearch.mockResolvedValue({ results: [found], nextCursor: null })
    directMessages.history.mockImplementation(async (_id: string, cursor: { aroundOrder?: string; afterOrder?: string } = {}) => {
      if (cursor.aroundOrder) return { messages: [found], olderCursor: '40', newerCursor: '44' }
      if (cursor.afterOrder) return { messages: [newer], olderCursor: null, newerCursor: null }
      return { messages: [{ ...message, canRestore: false }], olderCursor: null, newerCursor: null }
    })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    const search = container.querySelector<HTMLInputElement>('.dm-history-tools input[type="search"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'ancre'); search.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 230)) }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-history-results button')!.click() }); await settle()
    const owner = container.querySelector<HTMLDivElement>('.dm-history-body')!
    Object.defineProperty(owner, 'scrollHeight', { configurable: true, value: 300 })
    Object.defineProperty(owner, 'clientHeight', { configurable: true, value: 100 })
    owner.scrollTop = 201
    await act(async () => { owner.dispatchEvent(new Event('scroll', { bubbles: true })); await Promise.resolve() }); await settle()
    expect(directMessages.history).toHaveBeenCalledWith(conversationId, { afterOrder: '44' })
    expect(owner.textContent).toContain('Après ancre')
  })

  it('clears the isolated history cache when the authenticated Player changes', async () => {
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    expect(directMessages.history).toHaveBeenCalledTimes(1)
    const root = roots.at(-1)!
    await act(async () => { root.render(<DirectMessagePanel playerId={otherId} isActive intent={null} onIntentConsumed={intentConsumed} onUnreadChange={unreadChanged} onOpenProfile={openProfile} />) }); await settle()
    expect(directMessages.history).toHaveBeenCalledTimes(2)
  })

  it('reuses author actions in history and hides Restore when canRestore is false', async () => {
    const unavailable = { ...message, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', authorPlayerId: ownId, own: true, content: null, deletedAt: '2026-09-20T08:00:00.000Z', submissionOrder: '1', canRestore: false }
    const available = { ...unavailable, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', submissionOrder: '2', canRestore: true }
    directMessages.history.mockResolvedValue({ messages: [unavailable, available], olderCursor: null, newerCursor: null })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    expect(container.querySelector(`[data-message-id="${unavailable.id}"] [aria-label="Restaurer le message"]`)).toBeNull()
    const restore = container.querySelector<HTMLButtonElement>(`[data-message-id="${available.id}"] [aria-label="Restaurer le message"]`)!
    expect(restore).not.toBeNull(); await act(async () => { restore.click(); await Promise.resolve() }); await settle()
    expect(directMessages.restore).toHaveBeenCalledWith(conversationId, available.id, expect.any(String))
  })

  it('keeps the original history rollback across an ambiguous delete retry', async () => {
    const historical = { ...message, authorPlayerId: ownId, own: true, content: 'Archive originale', canRestore: false }
    directMessages.history.mockResolvedValue({ messages: [historical], olderCursor: null, newerCursor: null })
    directMessages.remove.mockRejectedValueOnce(new Error('Réponse perdue')).mockRejectedValueOnce(new ApiError('DIRECT_MESSAGE_UNAVAILABLE', 'Refusée', 409))
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    const row = container.querySelector<HTMLElement>(`[data-message-id="${historical.id}"]`)!
    await act(async () => { row.querySelector<HTMLButtonElement>('[aria-label="Supprimer le message"]')!.click() })
    await act(async () => { row.querySelector<HTMLButtonElement>('.dm-message-delete-confirm button')!.click() }); await settle()
    expect(row.querySelector('.dm-message-bubble p')?.textContent).toBe('Message supprimé')
    const operationKey = directMessages.remove.mock.calls[0]?.[2]
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-message-action-error button')).find(button => button.textContent === 'Réessayer'))!.click() }); await settle()
    expect(directMessages.remove.mock.calls[1]?.[2]).toBe(operationKey)
    expect(row.querySelector('.dm-message-bubble p')?.textContent).toBe('Archive originale')
    expect(row.querySelector('.dm-message-delete-confirm')).toBeNull()
  })

  it('offers report only for another active authoritative message in live and full history', async () => {
    const own = { ...message, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', own: true, authorPlayerId: ownId }
    const deleted = { ...message, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', content: null, deletedAt: '2026-09-24T08:00:00.000Z' }
    directMessages.messages.mockResolvedValue({ messages: [message, own, deleted], nextCursor: null, windowSize: 3 })
    directMessages.history.mockResolvedValue({ messages: [{ ...message, canRestore: false }], olderCursor: null, newerCursor: null })
    const container = await mount()
    await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    expect(container.querySelectorAll('[aria-label="Signaler le message"]')).toHaveLength(1)
    expect(container.querySelector(`[data-message-id="${own.id}"] [aria-label="Signaler le message"]`)).toBeNull()
    expect(container.querySelector(`[data-message-id="${deleted.id}"] [aria-label="Signaler le message"]`)).toBeNull()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-menu-button')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    expect(container.querySelector('[aria-label="Signaler le message"]')).not.toBeNull()
  })

  it('keeps a stable condensed preview, highlights the target and supports cancel, outside click and Escape', async () => {
    const context = Array.from({ length: 3 }, (_, index) => ({ ...reportLine, id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`, content: `Contexte ${index}`, submissionOrder: String(index + 1) }))
    const target = context[1]!
    directMessages.reportPreview.mockResolvedValue({ ...reportPreview, message: target, context })
    const container = await mount(); await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const flag = container.querySelector<HTMLButtonElement>('[aria-label="Signaler le message"]')!
    await act(async () => { flag.click() }); await settle()
    expect(directMessages.reportPreview).toHaveBeenCalledWith(conversationId, messageId)
    expect(container.querySelectorAll('.dm-report-context article')).toHaveLength(3)
    expect(container.querySelector('.dm-report-context article.target')?.textContent).toContain('Contexte 1')
    expect(container.textContent).toContain('jusqu’à 10 messages avant et après')
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-report-dialog footer button')).every(button => button.offsetParent !== null || document.contains(button))).toBe(true)
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-report-dialog button')).find(button => button.textContent === 'Annuler'))!.click() })
    expect(container.querySelector('.dm-report-overlay')).toBeNull(); expect(directMessages.report).not.toHaveBeenCalled()
    await act(async () => { flag.click() }); await settle(); await act(async () => { container.querySelector<HTMLElement>('.dm-report-overlay')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) })
    expect(container.querySelector('.dm-report-overlay')).toBeNull()
    await act(async () => { flag.click() }); await settle(); act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('.dm-report-overlay')).toBeNull()
  })

  it('reports, distinguishes duplicates and forces a new human confirmation after stale refresh', async () => {
    const container = await mount(); await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLButtonElement).click() }); await settle()
    const open = async () => { await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Signaler le message"]')!.click() }); await settle() }
    const confirm = async () => { await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-report-dialog button')).find(button => button.textContent === 'Confirmer'))!.click() }); await settle() }
    await open(); await confirm(); expect(container.textContent).toContain('Message signal')
    directMessages.report.mockResolvedValueOnce({ reported: true, duplicate: true })
    await open(); await confirm(); expect(container.textContent).toContain('Message d')
    const refreshed = { ...reportPreview, snapshotFingerprint: 'b'.repeat(64), context: [{ ...reportLine, content: 'Contexte actualisÃ©' }] }
    directMessages.report.mockRejectedValueOnce(new ApiError('DIRECT_MESSAGE_REPORT_PREVIEW_STALE', 'Stale', 409)).mockResolvedValueOnce({ reported: true, duplicate: false })
    directMessages.reportPreview.mockResolvedValueOnce(reportPreview).mockResolvedValueOnce(refreshed)
    await open(); await confirm()
    expect(container.querySelector('.dm-report-notice')).not.toBeNull()
    expect(container.textContent).toContain('Contexte actualis'); expect(directMessages.report).toHaveBeenCalledTimes(3)
    await confirm(); expect(directMessages.report).toHaveBeenCalledTimes(4); expect(directMessages.report.mock.calls.at(-1)?.[2]).toBe(refreshed.snapshotFingerprint)
  })

  it('dismisses successful report feedback at exactly three seconds without dismissing errors', async () => {
    const container = await mount(); await act(async () => { (container.querySelector('.dm-conversation-row') as HTMLElement).click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Signaler le message"]')!.click() }); await settle()
    vi.useFakeTimers()
    try {
      await act(async () => {
        (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-report-dialog button')).find(button => button.textContent === 'Confirmer'))!.click()
        await Promise.resolve(); await Promise.resolve()
      })
      expect(container.textContent).toContain('Message signalé.')
      await act(async () => { await vi.advanceTimersByTimeAsync(2_999) })
      expect(container.textContent).toContain('Message signalé.')
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(container.textContent).not.toContain('Message signalé.')
    } finally { vi.useRealTimers() }
  })

  it('shares the exact conversation menu in Conversations and Archives without opening or reading the thread', async () => {
    const archived = { ...baseConversation, id: '66666666-6666-4666-8666-666666666666', archived: true, unreadCount: 0 }
    directMessages.list.mockImplementation(async (isArchived: boolean) => ({ conversations: isArchived ? [archived] : [baseConversation] }))
    const container = await mount(baseConversation, true, true)
    directMessages.read.mockClear(); directMessages.messages.mockClear()
    const menuButton = container.querySelector<HTMLButtonElement>('.dm-list-menu-button')!
    expect(menuButton.getAttribute('aria-label')).toBe('Actions de conversation avec Aster')
    await act(async () => { menuButton.click() })
    expect(container.querySelector('.dm-thread-header')).toBeNull()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).map(button => button.textContent)).toEqual(['Historique complet', 'Archiver', 'Bloquer', 'Profil'])
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Historique complet'))!.click() }); await settle()
    expect(container.querySelector('.dm-history')).not.toBeNull(); expect(directMessages.read).not.toHaveBeenCalled()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-back')!.click() })
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-list-tabs button')).find(button => button.textContent === 'Archives'))!.click() }); await settle()
    await act(async () => { container.querySelector<HTMLButtonElement>('.dm-list-menu-button')!.click() })
    expect(container.textContent).toContain('Désarchiver')
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('.dm-conversation-menu')).toBeNull()
  })

  it('runs receipts, profile, block confirmation, archive and outside close directly from the list menu', async () => {
    const container = await mount()
    const openMenu = async () => { await act(async () => { container.querySelector<HTMLButtonElement>('.dm-list-menu-button')!.click() }) }
    await openMenu()
    await act(async () => { container.querySelector<HTMLInputElement>('.dm-conversation-menu input')!.click(); await Promise.resolve() })
    expect(directMessages.receipts).toHaveBeenCalledWith(conversationId, false); expect(container.querySelector('.dm-conversation-menu')).toBeNull()
    await openMenu()
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Profil'))!.click() })
    expect(openProfile).toHaveBeenCalledWith(otherId); expect(container.querySelector('.dm-conversation-menu')).toBeNull()
    await openMenu()
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Bloquer'))!.click() })
    expect(container.querySelector('[aria-label="Confirmer le blocage"]')).not.toBeNull(); expect(directMessages.block).not.toHaveBeenCalled()
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-confirm button')).find(button => button.textContent === 'Confirmer'))!.click(); await Promise.resolve() })
    expect(directMessages.block).toHaveBeenCalledWith(conversationId, expect.any(String))
    await openMenu(); act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    expect(container.querySelector('.dm-conversation-menu')).toBeNull()
    await openMenu()
    await act(async () => { (Array.from(container.querySelectorAll<HTMLButtonElement>('.dm-conversation-menu button')).find(button => button.textContent === 'Archiver'))!.click(); await Promise.resolve() })
    expect(directMessages.archive).toHaveBeenCalledWith(conversationId, true)
  })
})
