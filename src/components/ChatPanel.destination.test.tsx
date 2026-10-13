// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DirectConversationDto } from '../api/types'
const directMessages = vi.hoisted(() => ({ list: vi.fn(), unread: vi.fn(), messages: vi.fn(), players: vi.fn(), read: vi.fn(), typing: vi.fn(), initiate: vi.fn(), send: vi.fn() }))
const chat = vi.hoisted(() => ({ messages: vi.fn(), unread: vi.fn(), read: vi.fn() }))
vi.mock('../api/game-api', () => ({ ApiError: class extends Error {}, getGameApiClient: () => ({ directMessages, chat }) }))
import ChatPanel from './ChatPanel'
import DirectMessagePanel from './DirectMessagePanel'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const own = '11111111-1111-4111-8111-111111111111', active = '77777777-7777-4777-8777-777777777777'
const old: DirectConversationDto = { id: '88888888-8888-4888-8888-888888888888', other: { id: '66666666-6666-4666-8666-666666666666', displayName: 'Ancien profil archivé', elementKey: null }, archived: false, lastMessageAt: null, lastMessage: null, request: null, unreadCount: 0, readReceiptsEnabled: true, canSend: false, blockedByMe: false }
const roots: ReturnType<typeof createRoot>[] = []
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); chat.messages.mockResolvedValue({ messages: [], nextCursor: null, generation: 0 }); chat.unread.mockResolvedValue({ unreadCount: 0, generation: 0 }); directMessages.unread.mockResolvedValue({ unreadCount: 0 }); directMessages.messages.mockResolvedValue({ messages: [], nextCursor: null }); directMessages.players.mockResolvedValue({ players: [] }); directMessages.list.mockImplementation(async (archived: boolean) => ({ conversations: archived ? [] : [old] })) })
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren() })
it.each([false, true])('opens the explicit active Profile destination after tab activation; existing pair=%s', async existing => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host); roots.push(root)
  const consumed = vi.fn(), noop = () => undefined
  const render = (intent: unknown) => root.render(<ChatPanel playerId={own} isCollapsed={false} onToggle={noop} onOpenPlayers={noop} onOpenProfile={noop} onRefreshScopes={async () => undefined} directMessageIntent={intent as never} onDirectMessageIntentConsumed={consumed} />)
  await act(async () => render(null))
  const tabs = host.querySelectorAll<HTMLButtonElement>('.community-tabs [role="tab"]')
  await act(async () => tabs[1]!.click())
  await act(async () => host.querySelector<HTMLButtonElement>('.dm-conversation-row')!.click())
  expect(host.textContent).toContain('lecture seule')
  await act(async () => tabs[0]!.click())
  const pair = { ...old, id: '99999999-9999-4999-8999-999999999999', other: { ...old.other, id: active, displayName: 'Profil actif' }, canSend: true }
  const pending: (() => void)[] = []
  directMessages.list.mockImplementation((archived: boolean) => new Promise(resolve => pending.push(() => resolve({ conversations: archived ? [] : existing ? [old, pair] : [old] }))))
  await act(async () => render({ playerId: active, token: 'profile-active', player: pair.other }))
  await act(async () => { pending.splice(0).forEach(resolve => resolve()); await Promise.resolve() })
  expect(consumed).toHaveBeenCalledWith('profile-active')
  expect(host.querySelector('.dm-thread-header')?.textContent).toContain('Profil actif')
  expect(host.textContent).not.toContain('lecture seule')
  expect(existing ? host.querySelector('#dm-message') : host.querySelector('#dm-player-search')).not.toBeNull()
  expect(directMessages.initiate).not.toHaveBeenCalled(); expect(directMessages.send).not.toHaveBeenCalled()
})

it('resumes an interrupted target retry on returning to the MP tab', async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
 const consumed=vi.fn(),unread=vi.fn(),target={id:'77777777-7777-4777-8777-777777777777',displayName:'Active synthetic B',elementKey:null};
 const render=(active:boolean,intent:unknown)=>root.render(<DirectMessagePanel playerId={own} isActive={active} intent={intent as never} onIntentConsumed={consumed} onUnreadChange={unread} onOpenProfile={vi.fn()}/>);
 directMessages.list.mockRejectedValue(new Error('Private synthetic list failure'));
 await act(async()=>render(true,{playerId:target.id,player:target,token:'initial-target'}));
 expect(consumed).toHaveBeenCalledWith('initial-target');
 expect(host.textContent).toContain('Private synthetic list failure');
 await act(async()=>render(true,null));
 const pending:(()=>void)[]=[];
 directMessages.list.mockImplementation(()=>new Promise(resolve=>pending.push(()=>resolve({conversations:[]}))));
 await act(async()=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Réessayer l’ouverture')!.click());
 await act(async()=>render(false,null));
 await act(async()=>{pending.splice(0).forEach(release=>release());await Promise.resolve()});
 await act(async()=>render(true,null));
 await act(async()=>{pending.splice(0).forEach(release=>release());await Promise.resolve()});
 expect(host.textContent).not.toContain('Ouverture de la conversation…');
 expect(host.querySelector<HTMLTextAreaElement>('#dm-message')!.disabled).toBe(false);
 expect(host.textContent).not.toContain('Réessayer l’ouverture');
 expect(directMessages.initiate).not.toHaveBeenCalled();
});
it('keeps the latest selected pair when obsolete list responses arrive last',async()=>{
 directMessages.list.mockResolvedValue({conversations:[]});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
 const consumed=vi.fn(),unread=vi.fn();
 const targetA={id:'66666666-6666-4666-8666-666666666666',displayName:'Synthetic A',elementKey:null},targetB={id:'77777777-7777-4777-8777-777777777777',displayName:'Synthetic B',elementKey:null};
 const base={archived:false,lastMessageAt:null,lastMessage:null,request:null,unreadCount:0,readReceiptsEnabled:true,canSend:true,blockedByMe:false};
 const pairA={...base,id:'88888888-8888-4888-8888-888888888888',other:targetA},pairB={...base,id:'99999999-9999-4999-8999-999999999999',other:targetB};
 const render=(intent:unknown)=>root.render(<DirectMessagePanel playerId={own} isActive intent={intent as never} onIntentConsumed={consumed} onUnreadChange={unread} onOpenProfile={vi.fn()}/>);
 await act(async()=>render(null));
 const requests:{archived:boolean;release:(conversations:DirectConversationDto[])=>void}[]=[];
 directMessages.list.mockImplementation((archived:boolean)=>new Promise(resolve=>requests.push({archived,release:conversations=>resolve({conversations})})));
 await act(async()=>render({playerId:targetA.id,player:targetA,token:'A'}));
 const first=requests.splice(0);
 await act(async()=>render({playerId:targetB.id,player:targetB,token:'B'}));
 const second=requests.splice(0);
 await act(async()=>{second.forEach(r=>r.release(r.archived?[]:[pairB]));await Promise.resolve()});
 expect(host.querySelector('.dm-thread-header')?.textContent).toContain('Synthetic B');
 await act(async()=>{first.forEach(r=>r.release(r.archived?[]:[pairA]));await Promise.resolve()});
 expect(consumed).toHaveBeenCalledWith('B');expect(consumed).not.toHaveBeenCalledWith('A');
 expect(host.querySelector('.dm-thread-header')?.textContent).toContain('Synthetic B');
 expect(host.querySelector('#dm-message')).not.toBeNull();
 expect(directMessages.initiate).not.toHaveBeenCalled();
});

it('preserves a manual destination over a cancelled external intent after tab reactivation',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);
 const consumed=vi.fn(),unread=vi.fn();
 const targetA={id:'66666666-6666-4666-8666-666666666666',displayName:'Synthetic A',elementKey:null},targetB={id:'77777777-7777-4777-8777-777777777777',displayName:'Synthetic B',elementKey:null};
 const intent={playerId:targetA.id,player:targetA,token:'external-A'};
 const render=(active:boolean)=>root.render(<DirectMessagePanel playerId={own} isActive={active} intent={intent} onIntentConsumed={consumed} onUnreadChange={unread} onOpenProfile={vi.fn()}/>);
 const pending:(()=>void)[]=[];
 directMessages.list.mockImplementation(()=>new Promise(resolve=>pending.push(()=>resolve({conversations:[]}))));
 directMessages.players.mockResolvedValue({players:[targetB]});
 await act(async()=>render(true));
 const field=host.querySelector<HTMLInputElement>('#dm-player-search')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'Synthetic B');field.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,260));});
 directMessages.list.mockResolvedValue({conversations:[]});
 await act(async()=>host.querySelector<HTMLButtonElement>('.dm-player-results button')!.click());
 expect(host.querySelector('.dm-thread-header')?.textContent).toContain('Synthetic B');
 await act(async()=>{pending.splice(0).forEach(release=>release());await Promise.resolve();});
 expect(consumed).toHaveBeenCalledWith('external-A');
 await act(async()=>render(false));await act(async()=>render(true));
 expect(host.querySelector('.dm-thread-header')?.textContent).not.toContain('Synthetic A');
 expect(host.querySelector('.dm-thread-header')?.textContent).toContain('Synthetic B');
 expect(directMessages.initiate).not.toHaveBeenCalled();
});
