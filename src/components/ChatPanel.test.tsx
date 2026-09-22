// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageDto, ChatSendDto } from '../api/types'

const chat = vi.hoisted(() => ({
  messages: vi.fn(), unread: vi.fn(), read: vi.fn(), send: vi.fn(), remove: vi.fn(), mentions: vi.fn(), report: vi.fn(),
}))
vi.mock('../api/game-api', () => ({
  ApiError: class ApiError extends Error { status: number | null = null },
  getGameApiClient: () => ({ chat }),
}))
import ChatPanel from './ChatPanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const ownId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const message: ChatMessageDto = { id: '33333333-3333-4333-8333-333333333333', author: { id: otherId, displayName: 'Autre', elementKey: 'cryo' }, authorLabel: 'Autre', sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'Bonjour https://example.com/ fin', createdAt: '2026-09-22T10:00:00.000Z', deletedAt: null, deletionState: 'ACTIVE', replyToMessageId: null, replyPreview: null, mentionedMe: false }
const roots: ReturnType<typeof createRoot>[] = []
const refresh = vi.fn(async () => undefined), openProfile = vi.fn()
async function mount(collapsed = false) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  await act(async () => { root.render(<ChatPanel playerId={ownId} isCollapsed={collapsed} onToggle={vi.fn()} onOpenPlayers={vi.fn()} onOpenProfile={openProfile} onRefreshScopes={refresh} />) })
  return container
}
function type(container: HTMLElement, value: string) {
  const input = container.querySelector<HTMLInputElement>('#chat-message')!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const button = (node: HTMLElement, label: string) => node.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear()
  chat.messages.mockResolvedValue({ messages: [message], nextCursor: null })
  chat.unread.mockResolvedValue({ unreadCount: 3 }); chat.read.mockResolvedValue({ changed: true, lastReadMessageId: message.id })
  chat.mentions.mockResolvedValue({ players: [] }); chat.remove.mockResolvedValue({ changed: true, id: message.id })
  chat.report.mockResolvedValue({ reported: true, duplicate: false })
  chat.send.mockResolvedValue({ message: { ...message, id: '44444444-4444-4444-8444-444444444444', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Salut' }, result: null, results: [], xpGranted: 1, refreshScopes: ['progression', 'dailyChallenge'], dailyChallengeCompleted: false, replayed: false } satisfies ChatSendDto)
})
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren() })

describe('ChatPanel réel', () => {
  it('loads server messages, safe URLs and collapsed unread without marking collapsed messages read', async () => {
    const opened = await mount()
    expect(opened.textContent).toContain('Bonjour')
    expect(opened.textContent).not.toContain('Aperçu visuel')
    expect(opened.querySelector('a')?.getAttribute('href')).toBe('https://example.com/')
    expect(opened.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer')
    const collapsed = await mount(true)
    expect(collapsed.textContent).toContain('3')
    expect(chat.read).toHaveBeenCalledTimes(1)
  })

  it('keeps one send key through ambiguous failure and refreshes only after confirmation', async () => {
    chat.send.mockRejectedValueOnce(new Error('network'))
    const container = await mount()
    await act(async () => { type(container, '!pull 10') })
    const form = container.querySelector('form')!
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(container.textContent).toContain('Envoi non confirmé')
    expect((container.querySelector('#chat-message') as HTMLInputElement).value).toBe('!pull 10')
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(chat.send).toHaveBeenCalledTimes(2)
    expect(chat.send.mock.calls[1]?.[1]).toBe(chat.send.mock.calls[0]?.[1])
    expect(refresh).toHaveBeenCalledWith(['progression', 'dailyChallenge'])
    expect((container.querySelector('#chat-message') as HTMLInputElement).value).toBe('')
  })

  it('opens profile, replies, masks one author, reveals one row and reports privately', async () => {
    const container = await mount()
    await act(async () => { button(container, 'Profil de Autre').click() })
    expect(openProfile).toHaveBeenCalledWith(otherId)
    await act(async () => { button(container, 'Actions pour le message de Autre').click() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent === 'Répondre')!.click() })
    expect(container.textContent).toContain('Réponse à Autre')
    await act(async () => { type(container, 'Réponse') })
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(chat.send.mock.calls[0]?.[2]).toBe(message.id)
    await act(async () => { button(container, 'Actions pour le message de Autre').click() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent?.startsWith('Masquer'))!.click() })
    expect(container.textContent).toContain('Message masqué')
    await act(async () => { Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Afficher')!.click() })
    expect(container.textContent).toContain('Bonjour')
    await act(async () => { button(container, 'Actions pour le message de Autre').click() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent === 'Signaler')!.click() })
    await act(async () => { Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Confirmer')!.click() })
    expect(chat.report).toHaveBeenCalledWith(message.id)
    expect(container.textContent).toContain('Message signalé.')
  })

  it('uses Enter, enforces 500 Unicode characters and shows pending until confirmation', async () => {
    let release!: (value: ChatSendDto) => void
    const confirmed = chat.send.getMockImplementation()!() as Promise<ChatSendDto>
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>(resolve => { release = resolve }))
    const container = await mount()
    const input = container.querySelector<HTMLInputElement>('#chat-message')!
    expect(input.type).toBe('text'); expect(input.maxLength).toBe(1000)
    await act(async () => { type(container, '😀'.repeat(501)) })
    expect(Array.from(input.value)).toHaveLength(500)
    await act(async () => { type(container, 'Bonjour') })
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) })
    expect(chat.send).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('Envoi en cours')
    expect(button(container, 'Envoyer le message').disabled).toBe(true)
    await act(async () => { release(await confirmed) })
    expect(container.textContent).not.toContain('Envoi en cours')
  })

  it('autocomplete resolves a selected mention and marks a received mention in text', async () => {
    chat.messages.mockResolvedValue({ messages: [{ ...message, mentionedMe: true }], nextCursor: null })
    chat.mentions.mockResolvedValue({ players: [{ id: otherId, displayName: 'Autre', elementKey: 'cryo' }] })
    const container = await mount()
    expect(container.textContent).toContain('Vous êtes mentionné')
    expect(container.querySelector('.chat-message-mentioned')).not.toBeNull()
    await act(async () => { type(container, 'Salut @Aut') })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
    expect(chat.mentions).toHaveBeenCalledWith('Aut')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(item => item.textContent === 'Autre')!.click() })
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(chat.send.mock.calls[0]?.[3]).toEqual([{ playerId: otherId, displayName: 'Autre' }])
  })

  it('soft-deletes own rows and updates reply previews without exposing old content', async () => {
    const own = { ...message, author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Texte ancien' }
    chat.messages.mockResolvedValue({ messages: [own, { ...message, id: '55555555-5555-4555-8555-555555555555', content: 'Réponse', replyToMessageId: own.id, replyPreview: own.content }], nextCursor: null })
    const container = await mount()
    await act(async () => { button(container, 'Actions pour le message de Moi').click() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent === 'Supprimer')!.click() })
    expect(chat.remove).toHaveBeenCalledWith(own.id)
    expect(container.textContent).toContain('Message supprimé')
    expect(container.textContent).not.toContain('Texte ancien')
  })

  it('keeps a scrolled-up reader in place, counts new rows and reads only after returning to bottom', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      let published = false
      chat.messages.mockImplementation(async () => ({ messages: published ? [message, { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'Nouveau' }] : [message], nextCursor: null }))
      const container = await mount()
      await act(async () => { await vi.advanceTimersByTimeAsync(20) })
      const list = container.querySelector<HTMLDivElement>('.message-list')!
      Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 })
      Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
      expect(list.scrollHeight).toBe(1000)
      expect(list.clientHeight).toBe(100)
      list.scrollTop = 300
      await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
      const readBefore = chat.read.mock.calls.length
      published = true
      await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
      expect(list.scrollTop).toBe(300)
      expect(container.textContent).toContain('1 nouveau message ↓')
      expect(chat.read.mock.calls.length).toBe(readBefore)
      await act(async () => { Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('nouveau message ↓'))!.click() })
      expect(list.scrollTop).toBe(1000)
      expect(chat.read.mock.calls.at(-1)?.[0]).toBe('66666666-6666-4666-8666-666666666666')
    } finally { vi.useRealTimers() }
  })

  it('prepends older history while preserving the exact scroll offset', async () => {
    const cursor = { createdAt: message.createdAt, id: message.id }
    let height = 1000
    chat.messages.mockImplementation(async requestedCursor => {
      if (requestedCursor) {
        height = 1500
        return { messages: [{ ...message, id: '77777777-7777-4777-8777-777777777777', content: 'Ancien' }], nextCursor: null }
      }
      return { messages: [message], nextCursor: cursor }
    })
    const container = await mount()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    const list = container.querySelector<HTMLDivElement>('.message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => height })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    list.scrollTop = 50
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })); await Promise.resolve() })
    expect(chat.messages).toHaveBeenCalledWith(cursor)
    expect(container.textContent).toContain('Ancien')
    expect(list.scrollHeight).toBe(1500)
    expect(list.scrollTop).toBe(550)
  })

  it('keeps a new older page visible when the bounded history window is full', async () => {
    const cursor = { createdAt: message.createdAt, id: message.id }
    const current = Array.from({ length: 350 }, (_, index) => ({ ...message, id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`, content: `recent-${index}` }))
    chat.messages.mockImplementation(async requestedCursor => requestedCursor
      ? { messages: [{ ...message, id: '77777777-7777-4777-8777-777777777777', content: 'Ancien visible' }], nextCursor: null }
      : { messages: current, nextCursor: cursor })
    const container = await mount()
    const list = container.querySelector<HTMLDivElement>('.message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 5000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    list.scrollTop = 50
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })); await Promise.resolve() })
    expect(container.textContent).toContain('Ancien visible')
    expect(container.querySelectorAll('.chat-message')).toHaveLength(350)
  })

  it('defers fresh rows at the history cap until the reader chooses the latest page', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const current = Array.from({ length: 350 }, (_, index) => ({ ...message, id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`, content: `recent-${index}` }))
      const newest = { ...message, id: '88888888-8888-4888-8888-888888888888', content: 'Tout nouveau' }
      let published = false
      chat.messages.mockImplementation(async () => ({ messages: published ? [...current.slice(-49), newest] : current, nextCursor: null }))
      const container = await mount()
      const list = container.querySelector<HTMLDivElement>('.message-list')!
      Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 5000 })
      Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
      list.scrollTop = 300
      await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
      published = true
      await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
      expect(list.scrollTop).toBe(300)
      expect(container.textContent).toContain('recent-0')
      expect(container.textContent).toContain('1 nouveau message ↓')
      expect(container.textContent).not.toContain('Tout nouveau')
      await act(async () => { Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('nouveau message ↓'))!.click(); await Promise.resolve() })
      expect(container.textContent).toContain('Tout nouveau')
      expect(container.textContent).not.toContain('recent-0')
    } finally { vi.useRealTimers() }
  })

  it('pauses polling while hidden, refreshes on return and clears timers on logout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const container = await mount()
      let hidden = false
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
      hidden = true
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
      const count = chat.messages.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
      expect(chat.messages).toHaveBeenCalledTimes(count)
      hidden = false
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
      expect(chat.messages.mock.calls.length).toBeGreaterThan(count)
      act(() => roots.splice(0).forEach(root => root.unmount()))
      const afterUnmount = chat.messages.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
      expect(chat.messages).toHaveBeenCalledTimes(afterUnmount)
      expect(container.isConnected).toBe(true)
    } finally { vi.useRealTimers(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }) }
  })
})
