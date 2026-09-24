// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageDto, ChatSendDto, DirectConversationDto } from '../api/types'
import { ApiError } from '../api/game-api'
import { elementColors } from '../utils/elementTheme'

const chat = vi.hoisted(() => ({
  messages: vi.fn(), unread: vi.fn(), read: vi.fn(), send: vi.fn(), remove: vi.fn(), mentions: vi.fn(), report: vi.fn(),
}))
const directMessages = vi.hoisted(() => ({
  players: vi.fn(), list: vi.fn(), unread: vi.fn(), messages: vi.fn(), initiate: vi.fn(), send: vi.fn(), edit: vi.fn(), remove: vi.fn(), restore: vi.fn(), accept: vi.fn(), ignore: vi.fn(), block: vi.fn(), unblock: vi.fn(), read: vi.fn(), receipts: vi.fn(), archive: vi.fn(),
}))
const social = vi.hoisted(() => ({ directory: vi.fn() }))
vi.mock('../api/game-api', () => ({
  ApiError: class ApiError extends Error { code: string; status: number | null; constructor(code: string, message: string, status: number | null) { super(message); this.code = code; this.status = status } },
  getGameApiClient: () => ({ chat, directMessages, social }),
}))
import ChatPanel from './ChatPanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const ownId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const message: ChatMessageDto = { id: '33333333-3333-4333-8333-333333333333', author: { id: otherId, displayName: 'Autre', elementKey: 'cryo' }, authorLabel: 'Autre', sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'Bonjour https://example.com/ fin', createdAt: '2026-09-22T10:00:00.000Z', submissionOrder: '1', deletedAt: null, deletionState: 'ACTIVE', replyToMessageId: null, replyPreview: null, mentionedMe: false, repliedToMe: false }
const roots: ReturnType<typeof createRoot>[] = []
const refresh = vi.fn(async () => undefined), openProfile = vi.fn()
async function mount(collapsed = false, playerElementKey: string | null = null) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  await act(async () => { root.render(<ChatPanel playerId={ownId} playerElementKey={playerElementKey} isCollapsed={collapsed} onToggle={vi.fn()} onOpenPlayers={vi.fn()} onOpenProfile={openProfile} onRefreshScopes={refresh} />) })
  return container
}
function type(container: HTMLElement, value: string) {
  const input = container.querySelector<HTMLTextAreaElement>('#chat-message')!
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const button = (node: HTMLElement, label: string) => node.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
function enableUpdates() {
  const updates = vi.fn()
  ;(chat as typeof chat & { updates?: typeof updates }).updates = updates
  return updates
}
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear()
  delete (chat as typeof chat & { updates?: unknown }).updates
  chat.messages.mockResolvedValue({ messages: [message], nextCursor: null, generation: 0 })
  chat.unread.mockResolvedValue({ unreadCount: 3, generation: 0 }); chat.read.mockResolvedValue({ changed: true, lastReadMessageId: message.id })
  chat.mentions.mockResolvedValue({ players: [] }); chat.remove.mockResolvedValue({ changed: true, id: message.id })
  chat.report.mockResolvedValue({ reported: true, duplicate: false })
  directMessages.unread.mockResolvedValue({ unreadCount: 0 })
  directMessages.players.mockResolvedValue({ players: [] })
  directMessages.list.mockResolvedValue({ conversations: [] })
  directMessages.messages.mockResolvedValue({ messages: [], nextCursor: null })
  social.directory.mockResolvedValue({ players: [], page: 1, pageSize: 20, total: 0, totalPages: 0 })
  chat.send.mockImplementation(async (content: string, key: string) => ({ message: { ...message, id: '44444444-4444-4444-8444-444444444444', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content, clientIntentKey: key }, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: ['progression', 'dailyChallenge'], dailyChallengeCompleted: false, replayed: false } satisfies ChatSendDto))
})
afterEach(() => { vi.useRealTimers(); act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren() })

describe('ChatPanel réel', () => {
  it('switches Chat/MP with crossed unread badges while preserving the Chat draft and read boundary', async () => {
    directMessages.unread.mockResolvedValue({ unreadCount: 4, conversations: [] })
    const collapsed = await mount(true)
    await act(async () => { await Promise.resolve() })
    expect(collapsed.querySelector('.chat-expand-button')?.textContent).toContain('C3M4')
    const container = await mount()
    await act(async () => { await Promise.resolve() })
    type(container, 'Brouillon conservé')
    const readsBeforeMp = chat.read.mock.calls.length
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.community-tabs [role="tab"]'))
    expect(tabs.map(item => item.textContent)).toEqual(['Chat', 'MP4'])
    await act(async () => { tabs[1]!.click(); await Promise.resolve() })
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector<HTMLTextAreaElement>('#chat-message')?.value).toBe('Brouillon conservé')
    expect(container.querySelector('.chat-community-pane')?.hasAttribute('hidden')).toBe(true)
    expect(chat.read).toHaveBeenCalledTimes(readsBeforeMp)
    expect(directMessages.read).not.toHaveBeenCalled()
  })

  it('opens a private-message target from the Chat action row', async () => {
    const container = await mount()
    expect(container.querySelector('.message-meta .chat-direct-button')).toBeNull()
    expect(container.querySelector('.message-meta')?.textContent).not.toContain('MP')
    const desktopBefore = Array.from(container.querySelectorAll('.chat-message-actions button')).map(item => item.getAttribute('aria-label'))
    expect(button(container, 'Message privé').textContent).toBe('✉')
    await act(async () => { button(container, 'Message privé').click(); await Promise.resolve() })
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('MP')
    expect(directMessages.list).toHaveBeenCalledWith(false)
    expect(directMessages.list).toHaveBeenCalledWith(true)
    expect(Array.from(container.querySelectorAll('.chat-message-actions button')).map(item => item.getAttribute('aria-label'))).toEqual(desktopBefore)
  })

  it('returns an already mounted MP panel to Conversations on every explicit MP tab click', async () => {
    const conversation: DirectConversationDto = { id: '44444444-4444-4444-8444-444444444444', other: { id: otherId, displayName: 'Autre', elementKey: 'cryo' }, archived: false, lastMessageAt: null, lastMessage: null, request: null, unreadCount: 0, readReceiptsEnabled: true, canSend: true, blockedByMe: false }
    directMessages.list.mockImplementation(async (archived: boolean) => ({ conversations: archived ? [] : [conversation] }))
    const container = await mount()
    await act(async () => { button(container, 'Message privé').click(); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.dm-thread-identity strong')?.textContent).toBe('Autre')
    const communityTabs = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.community-tabs [role="tab"]'))
    await act(async () => { communityTabs()[0]!.click() })
    await act(async () => { communityTabs()[1]!.click() })
    expect(container.querySelector('.dm-thread-identity')).toBeNull()
    expect(Array.from(container.querySelectorAll('.dm-list-tabs [role="tab"]')).map(node => node.textContent)).toEqual(['Conversations', 'Archives'])
  })

  it('shares elementColors between PLAYER avatars and pseudonyms with a readable fallback', async () => {
    const hydro = { ...message, id: '55555555-5555-4555-8555-555555555555', author: { id: '55555555-5555-4555-8555-555555555555', displayName: 'Hydro', elementKey: 'hydro' }, authorLabel: 'Hydro' }
    const fallback = { ...message, id: '66666666-6666-4666-8666-666666666666', author: { id: '66666666-6666-4666-8666-666666666666', displayName: 'Sans élément', elementKey: null }, authorLabel: 'Sans élément' }
    const invalid = { ...message, id: '99999999-9999-4999-8999-999999999999', author: { id: '99999999-9999-4999-8999-999999999999', displayName: 'Élément inconnu', elementKey: 'unknown' }, authorLabel: 'Élément inconnu' }
    chat.messages.mockResolvedValue({ messages: [message, hydro, fallback, invalid], nextCursor: null, generation: 0 })
    const container = await mount()
    const row = (label: string) => Array.from(container.querySelectorAll<HTMLElement>('.chat-message')).find(item => item.querySelector('.chat-author-button')?.textContent === label)!
    for (const [label, color] of [['Autre', elementColors.cryo], ['Hydro', elementColors.hydro], ['Sans élément', '#b794ff'], ['Élément inconnu', '#b794ff']] as const) {
      const player = row(label)
      expect(player.style.getPropertyValue('--chat-author-color')).toBe(color)
      expect(player.querySelector('.chat-avatar-button')).not.toBeNull()
      expect(player.querySelector('.chat-author-button')).not.toBeNull()
    }
  })

  it('keeps the optimistic author color through confirmation and leaves GachaImpact green', async () => {
    let confirm!: (value: ChatSendDto) => void
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>(resolve => { confirm = resolve }))
    const container = await mount(false, 'pyro')
    await act(async () => { type(container, 'Immédiat'); container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(container.querySelector<HTMLElement>('.chat-message-optimistic')?.style.getPropertyValue('--chat-author-color')).toBe(elementColors.pyro)
    await act(async () => { confirm({ message: { ...message, id: '77777777-7777-4777-8777-777777777777', author: { id: ownId, displayName: 'Vous', elementKey: 'pyro' }, authorLabel: 'Vous', content: 'Immédiat' }, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }) })
    expect(Array.from(container.querySelectorAll<HTMLElement>('.chat-message')).find(item => item.textContent?.includes('Immédiat'))?.style.getPropertyValue('--chat-author-color')).toBe(elementColors.pyro)
    chat.messages.mockResolvedValue({ messages: [{ ...message, id: '88888888-8888-4888-8888-888888888888', author: null, authorLabel: 'GachaImpact', messageType: 'SYSTEM' }], nextCursor: null, generation: 0 })
    const system = await mount()
    expect(system.querySelector('.chat-game-label')?.textContent).toBe('GachaImpact')
    expect(system.querySelector('.chat-game-label')?.closest<HTMLElement>('.chat-message')?.style.getPropertyValue('--chat-author-color')).toBe('')
  })

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

  it('keeps the specified desktop and mobile action order and anchors report confirmation under the action row', async () => {
    const container = await mount()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.chat-message-actions button')).map(item => item.getAttribute('aria-label'))).toEqual([
      'Signaler', 'Masquer ce joueur', 'Copier le message', 'Message privé', 'Mentionner', 'Répondre',
    ])
    await act(async () => { button(container, 'Actions pour le message de Autre').click() })
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.chat-message-menu [role="menuitem"]')).map(item => item.textContent)).toEqual([
      'Signaler', 'Masquer les messages de ce joueur', 'Copier le message', 'Message privé', 'Mentionner', 'Répondre',
    ])
    await act(async () => { button(container, 'Signaler').click() })
    const confirmation = container.querySelector<HTMLElement>('.chat-report-confirm')!
    expect(confirmation.parentElement).toBe(container.querySelector('.message-content'))

    chat.messages.mockResolvedValue({ messages: [{ ...message, author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi' }], nextCursor: null, generation: 0 })
    const own = await mount()
    expect(Array.from(own.querySelectorAll<HTMLButtonElement>('.chat-message-actions button')).map(item => item.getAttribute('aria-label'))).toEqual([
      'Copier le message', 'Répondre', 'Supprimer',
    ])
  })

  it('resynchronizes the latest page whenever a previously loaded collapsed Chat is reopened', async () => {
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container); roots.push(root)
    const render = (collapsed: boolean) => root.render(<ChatPanel playerId={ownId} isCollapsed={collapsed} onToggle={vi.fn()} onOpenPlayers={vi.fn()} onOpenProfile={openProfile} onRefreshScopes={refresh} />)
    await act(async () => { render(false) })
    expect(container.textContent).toContain('Bonjour')
    await act(async () => { render(true) })
    const latest = { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'Dernier pendant la réduction', createdAt: '2026-09-22T10:00:02.000Z' }
    chat.messages.mockResolvedValue({ messages: [latest], nextCursor: null, generation: 0 })
    const calls = chat.messages.mock.calls.length
    await act(async () => { render(false); await Promise.resolve() })
    expect(chat.messages.mock.calls.length).toBeGreaterThan(calls)
    expect(container.textContent).toContain('Dernier pendant la réduction')
    expect(container.textContent).not.toContain('Bonjour https://example.com/ fin')
    expect(container.querySelector<HTMLDivElement>('.message-list')?.scrollTop).toBe(container.querySelector<HTMLDivElement>('.message-list')?.scrollHeight)
  })

  it('keeps one send key through ambiguous failure and refreshes only after confirmation', async () => {
    chat.send.mockRejectedValueOnce(new Error('network'))
    const container = await mount()
    await act(async () => { type(container, '!pull 10') })
    const form = container.querySelector('form')!
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(container.textContent).toContain('Envoi non confirmé')
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('')
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => { Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Réessayer')!.click() })
    expect(chat.send).toHaveBeenCalledTimes(2)
    expect(chat.send.mock.calls[1]?.[1]).toBe(chat.send.mock.calls[0]?.[1])
    expect(refresh).toHaveBeenCalledWith(['progression', 'dailyChallenge'])
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('')
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
    expect(container.textContent).toContain('Signalement envoyé.')
  })

  it('uses Enter, enforces 500 Unicode characters and shows pending until confirmation', async () => {
    let release!: (value: ChatSendDto) => void
    const confirmed = chat.send.getMockImplementation()!('Bonjour', '00000000-0000-4000-8000-000000000000') as Promise<ChatSendDto>
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>(resolve => { release = resolve }))
    const container = await mount()
    const input = container.querySelector<HTMLTextAreaElement>('#chat-message')!
    expect(input.tagName).toBe('TEXTAREA'); expect(input.getAttribute('rows')).toBe('1'); expect(input.maxLength).toBe(1000)
    await act(async () => { type(container, '😀'.repeat(501)) })
    expect(Array.from(input.value)).toHaveLength(500)
    await act(async () => { type(container, 'Bonjour\nmonde') })
    expect(input.value).toBe('Bonjour monde')
    await act(async () => { type(container, 'Bonjour') })
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) })
    expect(input.value).toBe('')
    expect(container.textContent).toContain('Bonjour')
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(1)
    await act(async () => { await Promise.resolve() })
    expect(chat.send).toHaveBeenCalledOnce()
    expect(chat.send.mock.calls[0]?.[0]).toBe('Bonjour')
    expect(button(container, 'Envoyer le message').disabled).toBe(true)
    await act(async () => { release(await confirmed) })
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
  })

  it('auto-grows upward within its fixed composer shell and caps its internal height', async () => {
    const container = await mount(), input = container.querySelector<HTMLTextAreaElement>('#chat-message')!
    let scrollHeight = 36
    Object.defineProperty(input, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    await act(async () => { type(container, 'Court') })
    expect(input.style.height).toBe('42px')
    expect(input.classList.contains('is-expanded')).toBe(false)
    scrollHeight = 112
    await act(async () => { type(container, 'Texte long '.repeat(30)) })
    expect(input.style.height).toBe('112px')
    expect(input.classList.contains('is-expanded')).toBe(true)
    expect(input.closest('.chat-composer')?.className).toBe('chat-composer')
    scrollHeight = 220
    await act(async () => { type(container, 'Texte maximal '.repeat(40)) })
    expect(input.style.height).toBe('154px')
    expect(input.style.overflowY).toBe('auto')
  })

  it('keeps the send action as a symbol inside the integrated composer field', async () => {
    const container = await mount()
    const composer = container.querySelector<HTMLFormElement>('.chat-composer')!
    const field = container.querySelector<HTMLElement>('.chat-composer-field')!
    const input = container.querySelector<HTMLTextAreaElement>('.chat-composer-textarea')!
    const send = button(container, 'Envoyer le message')
    expect(composer.children).toHaveLength(1)
    expect(composer.firstElementChild).toBe(field)
    expect(field.querySelector('.chat-composer-textarea')).toBe(input)
    expect(field.querySelector('.chat-send-button')).toBe(send)
    expect(send.parentElement).toBe(field)
    expect(send.querySelector('.icon-glyph')?.textContent).toBe('›')
  })

  it('shows the Unicode character counter only from 450 through the strict 500 limit', async () => {
    const container = await mount(), input = container.querySelector<HTMLTextAreaElement>('#chat-message')!
    const counter = () => container.querySelector('.chat-character-count')
    await act(async () => { type(container, 'a'.repeat(449)) })
    expect(counter()).toBeNull()
    await act(async () => { type(container, 'a'.repeat(450)) })
    expect(counter()?.textContent).toBe('-50')
    await act(async () => { type(container, 'a'.repeat(451)) })
    expect(counter()?.textContent).toBe('-49')
    await act(async () => { type(container, 'a'.repeat(499)) })
    expect(counter()?.textContent).toBe('-1')
    await act(async () => { type(container, `${'a'.repeat(499)}😀x`) })
    expect(Array.from(input.value)).toHaveLength(500)
    expect(input.value.endsWith('😀')).toBe(true)
    expect(counter()?.textContent).toBe('0')
    expect(input.classList.contains('with-counter')).toBe(true)
  })

  it('autocomplete resolves a selected mention and marks a received mention in text', async () => {
    chat.messages.mockResolvedValue({ messages: [{ ...message, mentionedMe: true }], nextCursor: null, generation: 0 })
    chat.mentions.mockResolvedValue({ players: [{ id: otherId, displayName: 'Autre', elementKey: 'cryo' }] })
    const container = await mount()
    expect(container.textContent).not.toContain('Vous êtes mentionné')
    expect(container.querySelector('.chat-message-mentioned')).not.toBeNull()
    await act(async () => { type(container, 'Salut @Aut') })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
    expect(chat.mentions).toHaveBeenCalledWith('Aut')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(item => item.textContent === 'Autre')!.click() })
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(chat.send.mock.calls[0]?.[3]).toEqual([{ playerId: otherId, displayName: 'Autre' }])
  })

  it('navigates empty mention suggestions with arrows, Tab, Enter and Escape without leaving the composer', async () => {
    chat.mentions.mockResolvedValue({ players: Array.from({ length: 6 }, (_, index) => ({ id: `${index}`.padStart(8, '0') + '-0000-4000-8000-000000000000', displayName: `Joueur ${index}`, elementKey: null })) })
    const container = await mount(), input = container.querySelector<HTMLTextAreaElement>('#chat-message')!
    input.focus()
    await act(async () => { type(container, '@'); await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(chat.mentions).toHaveBeenCalledWith('')
    const dropdown = container.querySelector('.chat-mention-suggestions')!
    expect(dropdown.parentElement?.classList.contains('chat-composer-field')).toBe(true)
    expect(dropdown.querySelectorAll('[role="option"]')).toHaveLength(5)
    const selected = () => container.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')
    const press = async (key: string) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      await act(async () => { input.dispatchEvent(event); await new Promise(resolve => setTimeout(resolve, 20)) })
      expect(document.activeElement).toBe(input)
      return event.defaultPrevented
    }
    expect(selected()?.textContent).toBe('Joueur 0')
    expect(selected()?.classList.contains('selected')).toBe(true)
    expect(await press('ArrowDown')).toBe(true)
    expect(selected()?.textContent).toBe('Joueur 1')
    expect(selected()?.classList.contains('selected')).toBe(true)
    expect(await press('ArrowUp')).toBe(true)
    expect(selected()?.textContent).toBe('Joueur 0')
    expect(await press('ArrowUp')).toBe(true)
    expect(selected()?.textContent).toBe('Joueur 4')
    expect(await press('Tab')).toBe(true)
    expect(input.value).toBe('@Joueur 4 ')
    expect(input.selectionStart).toBe(input.value.length)
    expect(input.selectionEnd).toBe(input.value.length)
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0)
    await act(async () => { type(container, '@'); await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(await press('ArrowDown')).toBe(true)
    expect(await press('Enter')).toBe(true)
    expect(input.value).toBe('@Joueur 1 ')
    expect(chat.send).not.toHaveBeenCalled()
    await act(async () => { type(container, '@'); await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(await press('Escape')).toBe(true)
    expect(input.value).toBe('@')
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0)
  })

  it('focuses the composer and keeps the full reply and draft in the text-field overlay', async () => {
    const longContent = 'Message complet '.repeat(20).trim()
    chat.messages.mockResolvedValue({ messages: [{ ...message, content: longContent }], nextCursor: null, generation: 0 })
    const container = await mount(), input = container.querySelector<HTMLTextAreaElement>('#chat-message')!
    const composer = container.querySelector('.chat-composer')
    await act(async () => { button(container, 'Répondre').click(); await new Promise(resolve => setTimeout(resolve, 25)) })
    expect(document.activeElement).toBe(input)
    const reply = container.querySelector('.chat-composer-reply')!
    expect(reply.textContent).toContain('Réponse à Autre')
    expect(reply.textContent).toContain(longContent)
    expect(reply.querySelector('.chat-overlay-content')?.nextElementSibling).toBe(button(container, 'Fermer la réponse'))
    const field = reply.closest('.chat-composer-field')!
    expect(field).not.toBeNull()
    expect(field.querySelector('.chat-send-button')).toBe(button(container, 'Envoyer le message'))
    expect(field.querySelector('.chat-composer-textarea')).toBe(input)
    expect(container.querySelector('.chat-composer')?.children).toHaveLength(1)
    expect(container.querySelector('.chat-composer')).toBe(composer)
    await act(async () => { type(container, 'Brouillon conservé') })
    await act(async () => { button(container, 'Fermer la réponse').click() })
    expect(container.querySelector('.chat-composer-reply')).toBeNull()
    expect(input.value).toBe('Brouillon conservé')
    await act(async () => { type(container, '') })
    await act(async () => { button(container, 'Mentionner').click(); await new Promise(resolve => setTimeout(resolve, 25)) })
    expect(input.value).toBe('@Autre ')
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(input.value.length)
    expect(input.selectionEnd).toBe(input.value.length)
  })

  it('copies through the desktop action and the touch menu with a dismissible floating feedback', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const container = await mount()
    await act(async () => { button(container, 'Copier le message').click(); await Promise.resolve() })
    expect(writeText).toHaveBeenCalledWith(message.content)
    expect(container.querySelector('.chat-composer-accessory [role="status"]')?.textContent).toContain('Message copié.')
    await act(async () => { button(container, 'Fermer le feedback').click() })
    expect(container.querySelector('.chat-composer-accessory [role="status"]')).toBeNull()
    await act(async () => { button(container, 'Actions pour le message de Autre').click() })
    const copyItem = Array.from(container.querySelectorAll<HTMLButtonElement>('.chat-message-menu [role="menuitem"]')).find(item => item.textContent === 'Copier le message')
    expect(copyItem).toBeDefined()
    await act(async () => { copyItem!.click(); await Promise.resolve() })
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(writeText).toHaveBeenLastCalledWith(message.content)
    expect(container.querySelector('.chat-message-menu')).toBeNull()
    expect(container.querySelector('.chat-composer-accessory [role="status"]')?.textContent).toContain('Message copié.')
  })

  it('keeps copy feedback for two seconds and restarts its timer on a newer copy', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const container = await mount()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await act(async () => { button(container, 'Copier le message').click(); await Promise.resolve() })
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Message copié.')
      await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Message copié.')
      await act(async () => { button(container, 'Copier le message').click(); await Promise.resolve() })
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Message copié.')
      await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
      expect(container.querySelector('[role="status"]')).toBeNull()
    } finally { vi.useRealTimers() }
  })

  it('soft-deletes own rows and updates reply previews without exposing old content', async () => {
    const own = { ...message, author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Texte ancien' }
    chat.messages.mockResolvedValue({ messages: [own, { ...message, id: '55555555-5555-4555-8555-555555555555', content: 'Réponse', replyToMessageId: own.id, replyPreview: own.content }], nextCursor: null, generation: 0 })
    const container = await mount()
    await act(async () => { button(container, 'Actions pour le message de Moi').click() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent === 'Supprimer')!.click() })
    expect(chat.remove).toHaveBeenCalledWith(own.id)
    expect(container.textContent).toContain('Message supprimé')
    expect(container.textContent).not.toContain('Texte ancien')
  })

  it('rolls back an optimistic deletion and its reply preview when the server refuses it', async () => {
    const own = { ...message, author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Texte conservé' }
    chat.messages.mockResolvedValue({ messages: [own, { ...message, id: '55555555-5555-4555-8555-555555555555', content: 'Réponse', replyToMessageId: own.id, replyPreview: own.content }], nextCursor: null, generation: 0 })
    chat.remove.mockRejectedValueOnce(new Error('Refusée'))
    const container = await mount()
    await act(async () => { button(container, 'Actions pour le message de Moi').click() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent === 'Supprimer')!.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Texte conservé')
    expect(container.textContent).toContain('Refusée')
  })

  it('renders only server-resolved mentions in bold while retaining safe links', async () => {
    chat.messages.mockResolvedValue({ messages: [{ ...message, content: '@autre https://example.com/ @Inconnu', resolvedMentions: [{ playerId: otherId, displayName: 'Autre' }] }], nextCursor: null, generation: 0 })
    const container = await mount()
    expect(container.querySelector('.chat-inline-mention')?.textContent).toBe('@autre')
    expect(container.querySelector('.chat-inline-mention')?.textContent).not.toContain('Inconnu')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/')
  })

  it('renders complete resolved names with spaces or punctuation while retaining original text and safe URLs', async () => {
    chat.messages.mockResolvedValue({ messages: [{ ...message, content: '@Kichnifou heyo @kIcHnIfOu @Jean Dupont bonjour @Dr. Watson @E\u0301lodie https://example.com/ @Jean Dupontx <img src=x>', resolvedMentions: [
      { playerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', displayName: 'Kichnifou' },
      { playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', displayName: 'Jean Dupont' },
      { playerId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', displayName: 'Dr. Watson' },
      { playerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', displayName: 'Élodie' },
    ] }], nextCursor: null, generation: 0 })
    const container = await mount()
    expect(Array.from(container.querySelectorAll('.chat-inline-mention')).map(node => node.textContent)).toEqual(['@Kichnifou', '@kIcHnIfOu', '@Jean Dupont', '@Dr. Watson', '@E\u0301lodie'])
    expect(container.textContent).toContain('@Jean Dupontx')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/')
    expect(container.querySelector('img')).toBeNull()
  })

  it('uses incremental updates after the initial snapshot without unread polling', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const updates = vi.fn(async () => ({ messages: [], changes: [], generation: 0, reset: false }))
      ;(chat as typeof chat & { updates?: typeof updates }).updates = updates
      await mount()
      const unreadCalls = chat.unread.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(updates).toHaveBeenCalledWith(0, { createdAt: message.createdAt, id: message.id }, [message.id])
      expect(chat.unread.mock.calls).toHaveLength(unreadCalls)
    } finally { vi.useRealTimers() }
  })

  it('receives the first messages after an empty snapshot and scrolls to the newest', async () => {
    chat.messages.mockResolvedValue({ messages: [], nextCursor: null, generation: 0 })
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    const container = await mount()
    const list = container.querySelector<HTMLDivElement>('.message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 900 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    updates.mockResolvedValue({ generation: 0, reset: false, messages: [{ ...message, content: 'Premier' }, { ...message, id: '66666666-6666-4666-8666-666666666666', createdAt: '2026-09-22T10:00:01.000Z', content: 'Second' }], changes: [] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(updates).toHaveBeenCalledWith(0, null, [])
    expect(container.textContent).toContain('Premier')
    expect(container.textContent).toContain('Second')
    expect(list.scrollTop).toBe(900)
  })

  it('hides the scrollbar at the exact bottom and shows it while reading history', async () => {
    const container = await mount()
    const list = container.querySelector<HTMLDivElement>('.message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    expect(list.classList.contains('chat-scrollbar-hidden')).toBe(true)
    list.scrollTop = 500
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    expect(list.classList.contains('chat-scrollbar-hidden')).toBe(false)
    list.scrollTop = 900
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    expect(list.classList.contains('chat-scrollbar-hidden')).toBe(true)
  })

  it('reconciles an in-flight PLAYER from incremental updates and clears an ambiguous send', async () => {
    let reject!: (cause: Error) => void
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>((_resolve, fail) => { reject = fail }))
    const container = await mount()
    await act(async () => { type(container, 'Mon message') })
    act(() => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { await Promise.resolve() })
    const key = chat.send.mock.calls.at(-1)![1] as string
    const authoritative = { ...message, id: '66666666-6666-4666-8666-666666666666', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Mon message', clientIntentKey: key }
    updates.mockResolvedValue({ generation: 0, reset: false, messages: [authoritative], changes: [] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Mon message'))).toHaveLength(1)
    await act(async () => { reject(new Error('Réponse perdue')) })
    expect(container.textContent).not.toContain('Envoi non confirmé')
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Mon message'))).toHaveLength(1)
  })

  it('clears an ambiguous send after the authoritative incremental message arrives', async () => {
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    chat.send.mockRejectedValueOnce(new Error('Réponse perdue'))
    const container = await mount()
    await act(async () => { type(container, 'Ambigu') })
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(container.textContent).toContain('Envoi non confirmé')
    const key = chat.send.mock.calls.at(-1)![1] as string
    updates.mockResolvedValue({ generation: 0, reset: false, messages: [{ ...message, id: '66666666-6666-4666-8666-666666666666', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Ambigu', clientIntentKey: key }], changes: [] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(container.textContent).not.toContain('Envoi non confirmé')
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Ambigu'))).toHaveLength(1)
  })

  it('updates a distant deletion and every loaded reply preview', async () => {
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    const reply = { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'Réponse', createdAt: '2026-09-22T10:00:01.000Z', replyToMessageId: message.id, replyPreview: message.content }
    chat.messages.mockResolvedValue({ messages: [message, reply], nextCursor: null, generation: 0 })
    const container = await mount()
    updates.mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [{ ...message, deletionState: 'AUTHOR', content: null }] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(container.textContent).not.toContain('Bonjour https://example.com/ fin')
    expect(container.textContent?.match(/Message supprimé/gu)).toHaveLength(2)
  })

  it('keeps an incremental arrival when an optimistic deletion rolls back', async () => {
    let reject!: (cause: Error) => void
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    const own = { ...message, author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'À restaurer' }
    chat.messages.mockResolvedValue({ messages: [own], nextCursor: null, generation: 0 })
    chat.remove.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail }))
    const container = await mount()
    await act(async () => { button(container, 'Supprimer').click() })
    expect(container.textContent).toContain('Message supprimé')
    updates.mockResolvedValue({ generation: 0, reset: false, messages: [{ ...message, id: '66666666-6666-4666-8666-666666666666', content: 'Arrivée C', createdAt: '2026-09-22T10:00:01.000Z' }], changes: [] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    await act(async () => { reject(new Error('Refus')) })
    expect(container.textContent).toContain('À restaurer')
    expect(container.textContent).toContain('Arrivée C')
  })

  it('defers incremental arrivals at the history cap until the reader rejoins the latest page', async () => {
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    const current = Array.from({ length: 200 }, (_, index) => ({ ...message, id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`, content: `recent-${index}` }))
    const newest = { ...message, id: '88888888-8888-4888-8888-888888888888', content: 'Tout nouveau', createdAt: '2026-09-22T10:00:01.000Z' }
    chat.messages.mockResolvedValue({ messages: current, nextCursor: null, generation: 0 })
    const container = await mount()
    const list = container.querySelector<HTMLDivElement>('.message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 5000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    list.scrollTop = 300
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })) })
    updates.mockResolvedValue({ generation: 0, reset: false, messages: [newest], changes: [] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(container.textContent).toContain('recent-0')
    expect(container.textContent).not.toContain('Tout nouveau')
    expect(container.textContent).toContain('1 nouveau message ↓')
    chat.messages.mockResolvedValue({ messages: [...current.slice(-49), newest], nextCursor: null, generation: 0 })
    await act(async () => { Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('nouveau message ↓'))!.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Tout nouveau')
    expect(container.textContent).not.toContain('recent-0')
  })

  it('hides pointer actions after a click until pointer leave and re-entry', async () => {
    const container = await mount()
    const article = container.querySelector<HTMLElement>('.chat-message')!
    article.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    await act(async () => { button(container, 'Répondre').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })) })
    expect(article.dataset.hoverSuppressed).toBe('true')
    await act(async () => { article.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body })) })
    expect(article.dataset.hoverSuppressed).toBeUndefined()
    article.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    expect(article.dataset.hoverSuppressed).toBeUndefined()
  })

  it('keeps a slow 1/2/3 burst optimistic while transporting and confirming it strictly in order', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      const releases: Array<(value: ChatSendDto) => void> = []
      chat.send.mockImplementation(() => new Promise<ChatSendDto>(resolve => { releases.push(resolve) }))
      const container = await mount(), form = container.querySelector('form')!
      const submitAt = async (time: number, content: string) => {
        vi.setSystemTime(time)
        await act(async () => { type(container, content); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      }
      await submitAt(0, 'M1'); await submitAt(800, 'M2'); await submitAt(1_600, 'M3')
      expect(Array.from(container.querySelectorAll('.chat-message-optimistic p')).map(node => node.textContent)).toEqual(['M1', 'M2', 'M3'])
      expect(chat.send).toHaveBeenCalledTimes(1)
      expect(chat.send.mock.calls[0]?.[0]).toBe('M1')
      const textarea = container.querySelector<HTMLTextAreaElement>('#chat-message')!
      expect(textarea.disabled).toBe(true); expect(textarea.placeholder).toBe('Spam, veuillez attendre...')

      const resolveCall = async (index: number, content: string) => {
        const key = chat.send.mock.calls[index]![1] as string
        await act(async () => { releases[index]!({ message: { ...message, id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`, author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content, clientIntentKey: key, submissionOrder: String(index + 2), createdAt: new Date().toISOString() }, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }); await Promise.resolve(); await Promise.resolve() })
      }
      await resolveCall(0, 'M1')
      expect(chat.send).toHaveBeenCalledTimes(2); expect(chat.send.mock.calls[1]?.[0]).toBe('M2')
      await resolveCall(1, 'M2')
      await act(async () => { await vi.advanceTimersByTimeAsync(749) })
      expect(chat.send).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(chat.send).toHaveBeenCalledTimes(3); expect(chat.send.mock.calls[2]?.[0]).toBe('M3')
      await resolveCall(2, 'M3')

      expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
      for (const content of ['M1', 'M2', 'M3']) expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.querySelector('p')?.textContent === content)).toHaveLength(1)
      expect(textarea.value).toBe('')
      await act(async () => { await vi.advanceTimersByTimeAsync(2_249) }); expect(textarea.disabled).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) }); expect(textarea.disabled).toBe(false)
    } finally { vi.useRealTimers() }
  })

  it('starts active polls on a 350 ms cadence and never overlaps a slow request', async () => {
    vi.useFakeTimers()
    try {
      let release!: (value: { messages: ChatMessageDto[]; changes: ChatMessageDto[]; generation: number; reset: boolean }) => void
      const updates = enableUpdates().mockImplementation(() => new Promise(resolve => { release = resolve }))
      await mount()
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(updates).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
      expect(updates).toHaveBeenCalledTimes(1)
      await act(async () => { release({ messages: [], changes: [], generation: 0, reset: false }); await Promise.resolve(); await vi.advanceTimersByTimeAsync(0) })
      expect(updates).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
  })

  it('renders a PLAYER during a pending command but queues its network transport', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(0)
    let release!: (value: ChatSendDto) => void
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>(resolve => { release = resolve }))
    const container = await mount()
    await act(async () => { type(container, '!pull') })
    act(() => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { await Promise.resolve() })
    await act(async () => { type(container, '!banque') })
    expect(button(container, 'Envoyer le message').disabled).toBe(true)
    vi.setSystemTime(750)
    await act(async () => { type(container, 'haha') })
    expect(button(container, 'Envoyer le message').disabled).toBe(false)
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(chat.send).toHaveBeenCalledTimes(1)
    expect(Array.from(container.querySelectorAll('.chat-message-optimistic p')).map(node => node.textContent)).toContain('haha')
    const key = chat.send.mock.calls[0]![1] as string
    await act(async () => { release({ message: { ...message, id: '66666666-6666-4666-8666-666666666666', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: '!pull', messageType: 'COMMAND', clientIntentKey: key, createdAt: new Date().toISOString() }, generation: 0, result: null, results: [], xpGranted: 0, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }); await Promise.resolve(); await Promise.resolve() })
    expect(chat.send).toHaveBeenCalledTimes(2)
    expect(chat.send.mock.calls[1]![0]).toBe('haha')
    vi.useRealTimers()
  })

  it('keeps a scrolled-up reader in place, counts new rows and reads only after returning to bottom', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      let published = false
      chat.messages.mockImplementation(async () => ({ messages: published ? [message, { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'Nouveau' }] : [message], nextCursor: null, generation: 0 }))
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
        return { messages: [{ ...message, id: '77777777-7777-4777-8777-777777777777', content: 'Ancien' }], nextCursor: null, generation: 0 }
      }
      return { messages: [message], nextCursor: cursor, generation: 0 }
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
    const current = Array.from({ length: 200 }, (_, index) => ({ ...message, id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`, content: `recent-${index}`, submissionOrder: String(index + 2) }))
    chat.messages.mockImplementation(async requestedCursor => requestedCursor
      ? { messages: [{ ...message, id: '77777777-7777-4777-8777-777777777777', content: 'Ancien visible', submissionOrder: '1' }], nextCursor: null, generation: 0 }
      : { messages: current, nextCursor: cursor, generation: 0 })
    const container = await mount()
    const list = container.querySelector<HTMLDivElement>('.message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 5000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
    list.scrollTop = 50
    await act(async () => { list.dispatchEvent(new Event('scroll', { bubbles: true })); await Promise.resolve() })
    expect(container.textContent).toContain('Ancien visible')
    expect(container.querySelectorAll('.chat-message')).toHaveLength(200)
  })

  it('defers fresh rows at the history cap until the reader chooses the latest page', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const current = Array.from({ length: 200 }, (_, index) => ({ ...message, id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`, content: `recent-${index}` }))
      const newest = { ...message, id: '88888888-8888-4888-8888-888888888888', content: 'Tout nouveau' }
      let published = false
      chat.messages.mockImplementation(async () => ({ messages: published ? [...current.slice(-49), newest] : current, nextCursor: null, generation: 0 }))
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

  it('reconciles a concurrent polling result with the optimistic row without a duplicate', async () => {
    let release!: (value: ChatSendDto) => void
    const container = await mount()
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>(resolve => { release = resolve }))
    await act(async () => { type(container, 'Immédiat') })
    act(() => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('')
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(1)
    await act(async () => { await Promise.resolve() })
    const key = chat.send.mock.calls.at(-1)![1] as string
    const authoritative = { ...message, id: '44444444-4444-4444-8444-444444444444', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Immédiat', clientIntentKey: key }
    chat.messages.mockResolvedValue({ messages: [message, authoritative], nextCursor: null, generation: 0 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Immédiat'))).toHaveLength(1)
    await act(async () => { release({ message: authoritative, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }) })
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Immédiat'))).toHaveLength(1)
  })

  it('keeps a post-clear send visible when its response reveals the newer generation first', async () => {
    let release!: (value: ChatSendDto) => void
    const container = await mount()
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>(resolve => { release = resolve }))
    await act(async () => { type(container, 'Après clear immédiat') })
    act(() => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { await Promise.resolve() })
    const key = chat.send.mock.calls.at(-1)![1] as string
    const authoritative = { ...message, id: '66666666-6666-4666-8666-666666666666', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Après clear immédiat', clientIntentKey: key }
    await act(async () => { release({ message: authoritative, generation: 1, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }) })
    expect(container.textContent).not.toContain('Bonjour https://example.com/')
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Après clear immédiat'))).toHaveLength(1)
    chat.messages.mockResolvedValue({ messages: [authoritative], nextCursor: null, generation: 1 })
    chat.unread.mockResolvedValue({ unreadCount: 0, generation: 1 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Après clear immédiat'))).toHaveLength(1)
  })

  it('does not restore a stale send after polling has already observed a clear', async () => {
    let release!: (value: ChatSendDto) => void
    const container = await mount()
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>(resolve => { release = resolve }))
    await act(async () => { type(container, 'Avant clear') })
    act(() => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { await Promise.resolve() })
    const key = chat.send.mock.calls.at(-1)![1] as string
    chat.messages.mockResolvedValue({ messages: [], nextCursor: null, generation: 1 })
    chat.unread.mockResolvedValue({ unreadCount: 0, generation: 1 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    const stale = { ...message, id: '77777777-7777-4777-8777-777777777777', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Avant clear', clientIntentKey: key }
    await act(async () => { release({ message: stale, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }) })
    expect(container.querySelectorAll('.chat-message')).toHaveLength(0)
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
  })

  it('preserves a deterministic failure in the fixed accessory for recovery', async () => {
    const failure = new ApiError('CHAT_INVALID', 'Refusé', 400)
    chat.send.mockRejectedValueOnce(failure)
    const container = await mount()
    const accessory = container.querySelector('.chat-composer-accessory')
    await act(async () => { type(container, 'À récupérer') })
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(container.querySelector('.chat-composer-accessory')).toBe(accessory)
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('')
    expect(container.querySelector('.chat-failed-status')?.textContent).toContain('À récupérer')
    await act(async () => { Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Récupérer')!.click() })
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('À récupérer')
    expect(container.querySelector('textarea')?.getAttribute('autocomplete')).toBe('off')
  })

  it('dismisses a failed overlay without losing its intent and reopens for a new failure', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(0)
    chat.send.mockRejectedValueOnce(new ApiError('CHAT_INVALID', 'Refus A', 400))
      .mockRejectedValueOnce(new ApiError('CHAT_INVALID', 'Refus B', 400))
    const container = await mount(), form = container.querySelector('form')!
    await act(async () => { type(container, 'Message A') })
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    const keyA = chat.send.mock.calls[0]![1]
    expect(container.querySelector('.chat-failed-status')?.textContent).toContain('Message A')
    await act(async () => { container.querySelector<HTMLButtonElement>('.chat-failed-status [aria-label="Fermer le feedback"]')!.click() })
    expect(container.querySelector('.chat-failed-status')).toBeNull()
    expect(chat.send).toHaveBeenCalledTimes(1)
    vi.setSystemTime(750)
    await act(async () => { type(container, 'Message B') })
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(container.querySelector('.chat-failed-status')?.textContent).toContain('2 envois refusés : Message B')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.chat-failed-status button')).find(item => item.textContent === 'Récupérer')!.click() })
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('Message B')
    expect(container.querySelector('.chat-failed-status')?.textContent).toContain('Message A')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.chat-failed-status button')).find(item => item.textContent === 'Réessayer')!.click(); await Promise.resolve() })
    expect(chat.send.mock.calls[2]![0]).toBe('Message A')
    expect(chat.send.mock.calls[2]![1]).toBe(keyA)
    vi.useRealTimers()
  })

  it('reopens a dismissed ambiguous overlay and reconciles the hidden intent by client key', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(0)
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    chat.send.mockRejectedValueOnce(new Error('Réseau A')).mockRejectedValueOnce(new Error('Réseau B'))
    const container = await mount(), form = container.querySelector('form')!
    await act(async () => { type(container, 'Ambigu A') })
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    const keyA = chat.send.mock.calls[0]![1] as string
    expect(container.textContent).toContain('Envoi non confirmé.')
    await act(async () => { container.querySelector<HTMLButtonElement>('.chat-composer-accessory [aria-label="Fermer le feedback"]')!.click() })
    expect(container.textContent).not.toContain('Envoi non confirmé.')
    expect(chat.send).toHaveBeenCalledTimes(1)
    vi.setSystemTime(750)
    await act(async () => { type(container, 'Ambigu B') })
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    const keyB = chat.send.mock.calls[1]![1] as string
    expect(keyB).not.toBe(keyA)
    expect(container.textContent).toContain('2 envois non confirmés.')
    await act(async () => { container.querySelector<HTMLButtonElement>('.chat-composer-accessory [aria-label="Fermer le feedback"]')!.click() })
    updates.mockResolvedValue({ generation: 0, reset: false, messages: [{ ...message, id: '66666666-6666-4666-8666-666666666666', author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content: 'Ambigu A', clientIntentKey: keyA }], changes: [] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(item => item.textContent?.includes('Ambigu A'))).toHaveLength(1)
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(1)
    expect(chat.send).toHaveBeenCalledTimes(2)
    await act(async () => { container.querySelector<HTMLButtonElement>('.chat-composer-accessory [aria-label="Fermer le feedback"]')?.click() })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(item => item.textContent?.includes('Ambigu A'))).toHaveLength(1)
    vi.useRealTimers()
  })

  it('keeps draft B and failed A recoverable without an optimistic ghost', async () => {
    let reject!: (cause: Error) => void
    const container = await mount()
    const accessory = container.querySelector('.chat-composer-accessory')
    chat.send.mockReturnValueOnce(new Promise<ChatSendDto>((_resolve, fail) => { reject = fail }))
    await act(async () => { type(container, 'Message A') })
    act(() => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await act(async () => { await Promise.resolve() })
    const originalKey = chat.send.mock.calls[0]![1]
    await act(async () => { type(container, 'Brouillon B') })
    await act(async () => { reject(new ApiError('CHAT_INVALID', 'Refusé', 400)) })
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('Brouillon B')
    expect(container.querySelector('.chat-failed-status')?.textContent).toContain('Message A')
    expect(container.querySelector('.chat-composer-accessory')).toBe(accessory)
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent === 'Récupérer')?.disabled).toBe(true)
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent === 'Réessayer')!.click() })
    expect(chat.send.mock.calls[1]![1]).toBe(originalKey)
    expect(chat.send.mock.calls[1]![0]).toBe('Message A')
    expect((container.querySelector('#chat-message') as HTMLTextAreaElement).value).toBe('Brouillon B')
    expect(Array.from(container.querySelectorAll('.chat-message')).filter(node => node.textContent?.includes('Message A'))).toHaveLength(1)
  })

  it('discards the old snapshot and unread count on a new server generation', async () => {
    const container = await mount()
    chat.messages.mockResolvedValue({ messages: [], nextCursor: null, generation: 1 })
    chat.unread.mockResolvedValue({ unreadCount: 0, generation: 1 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(container.textContent).not.toContain('Bonjour https://example.com/')
    expect(container.querySelectorAll('.chat-message')).toHaveLength(0)
    expect(container.textContent).toContain('Aucun message')
    chat.messages.mockResolvedValue({ messages: [{ ...message, id: '99999999-9999-4999-8999-999999999999', content: 'Après clear' }], nextCursor: null, generation: 1 })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(container.textContent).toContain('Après clear')
  })

  it('keeps actions and suggestions in overlays and toggles masking contextually', async () => {
    chat.messages.mockResolvedValue({ messages: [{ ...message, repliedToMe: true }], nextCursor: null, generation: 0 })
    chat.mentions.mockResolvedValue({ players: [{ id: otherId, displayName: 'Autre', elementKey: 'cryo' }] })
    const container = await mount()
    expect(container.querySelector('.chat-message-mentioned')).not.toBeNull()
    expect(container.textContent).not.toContain('Vous êtes mentionné')
    expect(container.querySelector('.chat-avatar-button')?.closest<HTMLElement>('.chat-message')?.style.getPropertyValue('--chat-author-color')).toBe(elementColors.cryo)
    expect(container.querySelector('.chat-avatar-button small')).toBeNull()
    const action = button(container, 'Actions pour le message de Autre')
    await act(async () => { action.click() })
    expect(container.querySelector('.chat-message-menu')?.parentElement?.className).toBe('message-content')
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(container.querySelector('.chat-message-menu')).toBeNull()
    await act(async () => { action.click(); document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(container.querySelector('.chat-message-menu')).toBeNull()
    await act(async () => { button(container, 'Masquer ce joueur').click() })
    expect(container.textContent).toContain('Message masqué')
    expect(container.textContent).not.toContain('joueur masqué')
    await act(async () => { button(container, 'Démasquer ce joueur').click() })
    expect(container.textContent).toContain('Bonjour https://example.com/')
    await act(async () => { button(container, 'Répondre').click(); type(container, '@Aut') })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
    const field = container.querySelector('.chat-composer-field')!
    expect(container.querySelector('.chat-mention-suggestions')?.parentElement).toBe(field)
    expect(container.querySelector('.chat-composer-accessory')?.parentElement).toBe(field)
    expect(container.querySelector('.chat-composer-reply')).not.toBeNull()
  })

  it('silently enforces the 750 ms local pacing boundary without consuming the draft', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(0)
      const container = await mount(), form = container.querySelector('form')!
      const submit = async (value: string) => { await act(async () => { type(container, value); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() }) }
      await submit('M1')
      expect(chat.send).toHaveBeenCalledTimes(1)
      vi.setSystemTime(500); await submit('M2')
      expect(chat.send).toHaveBeenCalledTimes(1)
      expect(container.querySelector<HTMLTextAreaElement>('#chat-message')?.value).toBe('M2')
      expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
      expect(container.querySelector('[role="alert"]')).toBeNull()
      vi.setSystemTime(749); await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(1)
      vi.setSystemTime(750); await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
  })

  it('locks exactly three seconds from the third fast submission, then restores focus and accepts M4', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      const container = await mount(), form = container.querySelector('form')!
      const submit = async (value: string) => { await act(async () => { type(container, value); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() }) }
      const textarea = container.querySelector<HTMLTextAreaElement>('#chat-message')!
      textarea.focus()
      await submit('M1'); await act(async () => { await vi.advanceTimersByTimeAsync(800) }); await submit('M2'); await act(async () => { await vi.advanceTimersByTimeAsync(800) }); await submit('M3')
      expect(chat.send).toHaveBeenCalledTimes(3)
      expect(textarea.disabled).toBe(true)
      expect(textarea.placeholder).toBe('Spam, veuillez attendre...')
      expect(button(container, 'Envoyer le message').disabled).toBe(true)
      textarea.blur()
      await act(async () => { await vi.advanceTimersByTimeAsync(2_999) })
      expect(Date.now()).toBe(4_599); expect(textarea.disabled).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(Date.now()).toBe(4_600)
      expect(textarea.disabled).toBe(false)
      expect(textarea.placeholder).toBe('Écrire un message…')
      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe(textarea.value.length)
      await submit('M4')
      expect(Array.from(container.querySelectorAll('.chat-message p')).map(node => node.textContent)).toContain('M4')
      expect(textarea.value).toBe('')
    } finally { vi.useRealTimers() }
  })

  it('unlocks the composer while M3 is pending but holds M4 transport until the server-safe boundary', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      let resolveM3!: (value: ChatSendDto) => void
      const response = (content: string, key: string, createdAt = new Date(Date.now()).toISOString()): ChatSendDto => ({ message: { ...message, id: crypto.randomUUID(), author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content, clientIntentKey: key, createdAt }, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false })
      chat.send.mockImplementation((content: string, key: string) => content === 'M3' ? new Promise(resolve => { resolveM3 = resolve }) : Promise.resolve(response(content, key)))
      const container = await mount(), form = container.querySelector('form')!, textarea = container.querySelector<HTMLTextAreaElement>('#chat-message')!
      const submit = async (value: string) => { await act(async () => { type(container, value); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() }) }
      textarea.focus(); await submit('M1'); await act(async () => { await vi.advanceTimersByTimeAsync(800) }); await submit('M2'); await act(async () => { await vi.advanceTimersByTimeAsync(800) }); await submit('M3')
      expect(chat.send.mock.calls.map(call => call[0])).toEqual(['M1', 'M2', 'M3'])
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
      expect(textarea.disabled).toBe(false); expect(document.activeElement).toBe(textarea)
      await submit('M4')
      expect(Array.from(container.querySelectorAll('.chat-message p')).map(node => node.textContent)).toContain('M4')
      expect(chat.send.mock.calls.map(call => call[0])).toEqual(['M1', 'M2', 'M3'])
      await act(async () => { resolveM3(response('M3', chat.send.mock.calls[2]![1], new Date(Date.now()).toISOString())); await Promise.resolve(); await Promise.resolve() })
      await act(async () => { await vi.advanceTimersByTimeAsync(2_999) })
      expect(chat.send.mock.calls.map(call => call[0])).toEqual(['M1', 'M2', 'M3'])
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(chat.send.mock.calls.map(call => call[0])).toEqual(['M1', 'M2', 'M3', 'M4'])
      expect(new Set(Array.from(container.querySelectorAll('.chat-message p')).map(node => node.textContent).filter(text => /^M[1-4]$/.test(text ?? '')))).toEqual(new Set(['M1', 'M2', 'M3', 'M4']))
    } finally { vi.useRealTimers() }
  })

  it('treats a server pacing rejection as a silent no-op and restores the exact intent', async () => {
    chat.send.mockRejectedValueOnce(new ApiError('CHAT_PACING_LIMIT', 'limité', 429))
    const container = await mount()
    await act(async () => { button(container, 'Répondre').click(); type(container, 'Réponse conservée'); container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(container.querySelector<HTMLTextAreaElement>('#chat-message')?.value).toBe('Réponse conservée')
    expect(container.textContent).toContain('Réponse à Autre')
    expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
    expect(container.querySelector('.chat-failed-status')).toBeNull()
    expect(container.textContent).not.toContain('limité')
  })

  it('does not let a server pacing rejection move the local 750 ms boundary', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      const container = await mount(), form = container.querySelector('form')!
      await act(async () => { type(container, 'M1'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      chat.send.mockRejectedValueOnce(new ApiError('CHAT_PACING_LIMIT', 'limité', 429))
      vi.setSystemTime(750)
      await act(async () => { type(container, 'M2'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(2)
      expect(container.querySelector<HTMLTextAreaElement>('#chat-message')?.value).toBe('M2')
      expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
      expect(container.querySelector('[role="alert"]')).toBeNull()
      vi.setSystemTime(1_000)
      await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(chat.send).toHaveBeenCalledTimes(3)
    } finally { vi.useRealTimers() }
  })

  it('removes only the rejected pacing timestamp without extending 750 ms or a burst lock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      let rejectM2!: (cause: Error) => void
      chat.send.mockImplementation((content: string, key: string) => {
        if (content === 'M2') return new Promise<ChatSendDto>((_resolve, reject) => { rejectM2 = reject })
        if (content === 'M3') return Promise.reject(new ApiError('CHAT_PACING_LIMIT', 'limité', 429))
        return Promise.resolve({ message: { ...message, id: crypto.randomUUID(), author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content, clientIntentKey: key }, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false })
      })
      vi.setSystemTime(0)
      const container = await mount(), form = container.querySelector('form')!
      const submitAt = async (time: number, value?: string) => {
        vi.setSystemTime(time)
        await act(async () => { if (value !== undefined) type(container, value); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      }
      await submitAt(0, 'M1')
      await submitAt(800, 'M2')
      await submitAt(1_600, 'M3')
      expect(chat.send).toHaveBeenCalledTimes(2)
      expect(Array.from(container.querySelectorAll('.chat-message-optimistic p')).map(node => node.textContent)).toEqual(['M2', 'M3'])
      expect(container.textContent).not.toContain('limité')
      await act(async () => { rejectM2(new ApiError('CHAT_PACING_LIMIT', 'limité', 429)); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(3)
      expect(chat.send.mock.calls[2]?.[0]).toBe('M3')
      expect(container.querySelectorAll('.chat-message-optimistic')).toHaveLength(0)
      expect(container.querySelector('[role="alert"]')).toBeNull()
      await submitAt(2_400, 'M4')
      expect(chat.send).toHaveBeenCalledTimes(4)
      expect(chat.send.mock.calls[3]?.[0]).toBe('M4')
    } finally { vi.useRealTimers() }
  })

  it('does not let a deterministic non-pacing rejection move the local 750 ms boundary', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      const container = await mount(), form = container.querySelector('form')!
      await act(async () => { type(container, 'M1'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      chat.send.mockRejectedValueOnce(new ApiError('CHAT_UNAVAILABLE', 'indisponible', 404))
      vi.setSystemTime(750)
      await act(async () => { type(container, 'M2'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(2)
      vi.setSystemTime(1_000)
      await act(async () => { type(container, 'M3'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(chat.send).toHaveBeenCalledTimes(3)
    } finally { vi.useRealTimers() }
  })

  it('removes a deterministic third rejection from the local burst window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      chat.send.mockImplementation((content: string, key: string) => content === 'M3'
        ? Promise.reject(new ApiError('CHAT_INVALID', 'invalide', 400))
        : Promise.resolve({ message: { ...message, id: crypto.randomUUID(), author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content, clientIntentKey: key }, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }))
      const container = await mount(), form = container.querySelector('form')!
      const submitAt = async (time: number, value: string) => {
        vi.setSystemTime(time)
        await act(async () => { type(container, value); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      }
      await submitAt(0, 'M1'); await submitAt(800, 'M2'); await submitAt(1_600, 'M3'); await submitAt(2_400, 'M4')
      expect(chat.send).toHaveBeenCalledTimes(4)
      expect(chat.send.mock.calls[3]?.[0]).toBe('M4')
    } finally { vi.useRealTimers() }
  })

  it('removes only a late deterministic rejection and preserves a newer pacing attempt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      let rejectM2!: (cause: Error) => void
      chat.send.mockImplementation((content: string, key: string) => content === 'M2'
        ? new Promise<ChatSendDto>((_resolve, reject) => { rejectM2 = reject })
        : Promise.resolve({ message: { ...message, id: crypto.randomUUID(), author: { id: ownId, displayName: 'Moi', elementKey: 'pyro' }, authorLabel: 'Moi', content, clientIntentKey: key }, generation: 0, result: null, results: [], xpGranted: 1, refreshScopes: [], dailyChallengeCompleted: false, replayed: false }))
      const container = await mount(), form = container.querySelector('form')!
      const submitAt = async (time: number, value?: string) => {
        vi.setSystemTime(time)
        await act(async () => { if (value !== undefined) type(container, value); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      }
      await submitAt(0, 'M1'); await submitAt(800, 'M2'); await submitAt(1_600, 'M3')
      await act(async () => { rejectM2(new ApiError('CHAT_UNAVAILABLE', 'indisponible', 404)); await Promise.resolve(); await Promise.resolve() })
      await submitAt(2_200, 'M4')
      expect(chat.send).toHaveBeenCalledTimes(3)
      expect(container.querySelector<HTMLTextAreaElement>('#chat-message')?.value).toBe('M4')
      await submitAt(2_350)
      expect(chat.send).toHaveBeenCalledTimes(4)
    } finally { vi.useRealTimers() }
  })

  it('keeps an ambiguous network attempt in local pacing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(0)
      const container = await mount(), form = container.querySelector('form')!
      await act(async () => { type(container, 'M1'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      chat.send.mockRejectedValueOnce(new Error('network'))
      vi.setSystemTime(800)
      await act(async () => { type(container, 'M2'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      vi.setSystemTime(1_000)
      await act(async () => { type(container, 'M3'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(2)
      expect(container.querySelector<HTMLTextAreaElement>('#chat-message')?.value).toBe('M3')
      vi.setSystemTime(1_550)
      await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(3)
    } finally { vi.useRealTimers() }
  })

  it('does not count a confirmed clear as an accepted PLAYER or COMMAND', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      const container = await mount(), form = container.querySelector('form')!
      await act(async () => { type(container, 'M1'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      chat.send.mockResolvedValueOnce({ cleared: true, generation: 1, replayed: false })
      vi.setSystemTime(800)
      await act(async () => { type(container, '!clear'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      vi.setSystemTime(1_000)
      await act(async () => { type(container, 'M2'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
      expect(chat.send).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(550) })
      expect(chat.send).toHaveBeenCalledTimes(3)
      expect(chat.send.mock.calls[2]?.[0]).toBe('M2')
    } finally { vi.useRealTimers() }
  })

  it('delivers all 150 unknown rows from one bounded catch-up without loss or duplicates', async () => {
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    chat.messages.mockResolvedValue({ messages: [message], nextCursor: null, generation: 0, visibleMessageIds: [message.id] })
    const container = await mount()
    const unknown = Array.from({ length: 150 }, (_, index) => ({ ...message, id: `77777777-7777-4777-8777-${String(index).padStart(12, '0')}`, content: `catch-up-${index}`, submissionOrder: String(index + 2), createdAt: new Date(Date.parse(message.createdAt) + index + 1).toISOString() }))
    updates.mockResolvedValueOnce({ generation: 0, reset: false, messages: unknown, changes: [], visibleMessageIds: [message.id, ...unknown.map(item => item.id)] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); await Promise.resolve() })
    const rendered = [...container.querySelectorAll<HTMLElement>('.chat-message')]
    expect(rendered).toHaveLength(151)
    expect(new Set(rendered.map(item => item.dataset.messageId)).size).toBe(151)
    expect(rendered.map(item => item.querySelector('p')?.textContent).slice(1)).toEqual(unknown.map(item => item.content))
  })

  it('appends an authoritative late arrival without moving visible rows', async () => {
    const later = { ...message, id: '77777777-7777-4777-8777-777777777777', content: 'B', submissionOrder: '20', createdAt: '2026-09-22T10:00:00.000Z' }
    const earlier = { ...message, id: '66666666-6666-4666-8666-666666666666', content: 'A', submissionOrder: '19', createdAt: '2026-09-22T10:00:01.000Z' }
    chat.messages.mockResolvedValue({ messages: [later], nextCursor: null, generation: 0 })
    const updates = enableUpdates().mockResolvedValue({ generation: 0, reset: false, messages: [], changes: [] })
    const container = await mount()
    expect(Array.from(container.querySelectorAll('.chat-message p')).map(node => node.textContent)).toEqual(['B'])
    const existingRow = container.querySelector('.chat-message')
    updates.mockResolvedValueOnce({ generation: 0, reset: false, messages: [earlier], changes: [] })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(Array.from(container.querySelectorAll('.chat-message p')).map(node => node.textContent)).toEqual(['B', 'A'])
    expect(container.querySelectorAll('.chat-message')[0]).toBe(existingRow)
  })

  it('reopens at the local bottom before a pending network refresh can resolve', async () => {
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container); roots.push(root)
    const render = (collapsed: boolean) => root.render(<ChatPanel playerId={ownId} isCollapsed={collapsed} onToggle={vi.fn()} onOpenPlayers={vi.fn()} onOpenProfile={openProfile} onRefreshScopes={refresh} />)
    await act(async () => { render(false); await Promise.resolve() })
    const list = container.querySelector<HTMLDivElement>('.message-list')!
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 900 })
    list.scrollTop = 120
    await act(async () => { render(true) })
    let resolve!: (value: { messages: ChatMessageDto[]; nextCursor: null; generation: number }) => void
    chat.messages.mockReturnValueOnce(new Promise(value => { resolve = value }))
    await act(async () => { render(false) })
    expect(list.scrollTop).toBe(900)
    await act(async () => { resolve({ messages: [{ ...message, content: 'Snapshot récent' }], nextCursor: null, generation: 0 }); await Promise.resolve() })
    expect(list.scrollTop).toBe(900)
  })
})
