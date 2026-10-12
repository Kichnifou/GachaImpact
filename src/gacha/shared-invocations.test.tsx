// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mergeSharedSession } from './use-shared-invocations';
import { sharedGachaView, sharedSequenceView } from './shared-invocation-presentation';
import type { SharedSession } from '../api/shared-invocations-types';
import InvocationSequence from '../components/InvocationSequence';
import InvocationScreen from '../screens/InvocationScreen';
import BannerHero from '../components/BannerHero';
import type { SharedInvocationController } from './use-shared-invocations';
const hero = { id: 'target', name: 'Diffusion', rarity: 5 as const, elementKey: 'hydro' as const, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null };
const result = { index: 1, resultType: 'resource' as const, character: null, rarity: null, resourceKey: 'moras', resourceAmount: '5000', wasNewCharacter: null, constellationAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null };
const session: SharedSession = { id: 'session', seq: 5, status: 'ACTIVE', authoritative: false, expiresAt: '2026-10-11T20:00:00Z', snapshot: { displayName: 'Diffuseur consenti', avatarPath: null, gacha: { banner: { id: 'banner', startsAt: '2026-10-05T00:00:00Z', endsAt: '2026-10-12T00:00:00Z', featuredFiveStars: [hero], featuredFourStars: [] }, playerState: { selectedBannerCharacterId: hero.id, pity5: 42, pity4: 3, guaranteedFeatured5: true, captureProgress: 2 } }, presentation: { phase: 'reveal', index: 4, pull: { operation: { id: 'actual-operation', pullCount: 10, createdAt: '2026-10-11T19:00:00Z' }, results: Array.from({ length: 10 }, (_, i) => ({ ...result, index: i + 1 })) } } }, reactions: [] };
(globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;
const roots: ReturnType<typeof createRoot>[] = [];
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ matched: [], unmatched: [] }) }))));
afterEach(() => {
    act(() => roots.splice(0).forEach(root => root.unmount()));
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
function mount(node: React.ReactNode) {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    act(() => root.render(node));
    return host;
}
it('ignores older sequence snapshots and keeps the committed current late-join index', () => {
    expect(mergeSharedSession(session, { ...session, seq: 4 })).toBe(session);
    const p = sharedSequenceView(session);
    expect(p.phase).toBe('reveal');
    if (p.phase === 'reveal') {
        expect(p.resultIndex).toBe(4);
        expect(p.pull.operation.id).toBe('actual-operation');
        expect(p.pull.results).toHaveLength(10);
    }
    expect(sharedGachaView(session).playerState).toMatchObject({ pity5: 42, pity4: 3, guaranteedFeatured5: true, captureProgress: 2 });
});
it('renders spectators without reveal, skip, close or keyboard authority', () => {
    vi.useFakeTimers();
    const state = sharedSequenceView(session);
    if (state.phase === 'idle')
        throw Error('Expected real sequence');
    const advance = vi.fn(), skip = vi.fn(), close = vi.fn();
    const host = mount(<InvocationSequence state={state} readOnly onAdvance={advance} onSkip={skip} onClose={close}/>);
    act(() => vi.advanceTimersByTime(3000));
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('[role="button"]')).toBeNull();
    act(() => {
        host.querySelector('.invocation-sequence')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(advance).not.toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Résultat 5 / 10');
});
it('preserves stop/reactions during pause and never calls the personal pull or target callback', () => {
    const watch = vi.fn(async () => {
    }), react = vi.fn(async () => {
    }), onPull = vi.fn(), onSetTarget = vi.fn();
    const shared = { enabled: true, pending: false, error: '', state: { broadcasting: null, watching: { ...session, status: 'PAUSED' } }, watch, react } as unknown as SharedInvocationController;
    const host = mount(<InvocationScreen gacha={sharedGachaView(session)} teams={{ teams: [], availableCharacters: [], passiveReference: [] }} onSetTarget={onSetTarget} onPull={onPull} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>);
    expect(host.textContent).toContain('En pause');
    expect(host.querySelector('.shared-invocation-paused')).toBeNull();
    const stop = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Arrêter');
    expect(stop?.disabled).toBe(false);
    act(() => stop!.click());
    expect(watch).toHaveBeenCalledWith(null);
    const emoji = host.querySelector<HTMLButtonElement>('[aria-label="Réagir 🎉"]');
    act(() => emoji!.click());
    expect(react).toHaveBeenCalledWith('🎉');
    expect(onPull).not.toHaveBeenCalled();
    expect(onSetTarget).not.toHaveBeenCalled();
});

it('restores the broadcaster receipt after F5 and rotation with a null personal target, then returns to the current banner on close', () => {
    const own = { ...session, authoritative: true }, receipt = sharedGachaView(session), currentHero = { ...receipt.banner.featuredFiveStars[0], id: 'current-target', name: 'Rotation actuelle' };
    const personal = { banner: { ...receipt.banner, id: 'current-banner', featuredFiveStars: [currentHero] }, playerState: { ...receipt.playerState, selectedBannerCharacterId: null } };
    const shared = { enabled: true, pending: false, personalReady: true, error: '', state: { broadcasting: own, watching: null }, advance: vi.fn() } as unknown as SharedInvocationController;
    const render = () => <InvocationScreen gacha={personal} teams={{ teams: [], availableCharacters: [], passiveReference: [] }} onSetTarget={vi.fn()} onPull={vi.fn()} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>;
    const host = mount(render());
    expect(host.textContent).toContain('Résultat 5 / 10');
    expect(host.textContent).not.toContain('Choisissez votre cible');
    expect(host.querySelectorAll('.pull-result-card')).toHaveLength(1);
    shared.state = { broadcasting: { ...own, seq: 6, snapshot: { ...own.snapshot, presentation: { phase: 'idle', index: 0, pull: null } } }, watching: null };
    act(() => roots.at(-1)!.render(render()));
    expect(host.textContent).toContain('Choisissez votre cible');
    expect(host.textContent).toContain('Rotation actuelle');
    expect(host.textContent).not.toContain('Résultat 5 / 10');
});

it('prioritizes a committed sequence over a target picker even when the displayed target is absent', () => {
    const receipt = sharedGachaView(session), personal = { ...receipt, playerState: { ...receipt.playerState, selectedBannerCharacterId: null } };
    const host = mount(<BannerHero gacha={personal} onSetTarget={vi.fn()} sharedSequence={sharedSequenceView(session)} onSharedSequenceAction={vi.fn()}/>);
    expect(host.textContent).toContain('Résultat 5 / 10');
    expect(host.textContent).not.toContain('Choisissez votre cible');
});

it('provides a keyboard focus target for the complete summary without turning scrolling into a close action', () => {
    vi.useFakeTimers();
    const state = sharedSequenceView({ ...session, snapshot: { ...session.snapshot, presentation: { ...session.snapshot.presentation, phase: 'summary' } } });
    if (state.phase === 'idle') throw Error('Expected committed summary');
    const close = vi.fn(), host = mount(<InvocationSequence state={state} onAdvance={vi.fn()} onSkip={vi.fn()} onClose={close}/>);
    act(() => vi.advanceTimersByTime(1100));
    const region = host.querySelector<HTMLElement>('[role="region"]')!;
    region.focus();
    expect(document.activeElement).toBe(region);
    expect(region.tabIndex).toBe(0);
    expect(region.querySelectorAll('.pull-result-card')).toHaveLength(10);
    act(() => {
        for (const key of ['PageDown', 'End', ' ']) region.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });
    expect(close).not.toHaveBeenCalled();
});

it('keeps exactly one audience through repeated stop/start and clears its portals on stop', async () => {
    const own = { ...session, authoritative: true, snapshot: { ...session.snapshot, presentation: { phase: 'idle' as const, index: 0, pull: null } } };
    const shared = { enabled: true, pending: false, error: '', state: { broadcasting: null, watching: null }, api: { spectators: vi.fn(async () => ({sessionId: own.id, total: 7, page: 1, totalPages: 1, preview: [], players: []})) } } as unknown as SharedInvocationController;
    const render = () => <InvocationScreen gacha={sharedGachaView(own)} teams={{teams: [], availableCharacters: [], passiveReference: []}} onSetTarget={vi.fn()} onPull={vi.fn()} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>;
    const host = mount(render());
    for (let i = 0; i < 4; i++) {
        shared.state = { broadcasting: {...own, id: `session-${i}`}, watching: null };
        await act(async () => roots.at(-1)!.render(render()));
        expect(host.querySelectorAll('.shared-invocation-status')).toHaveLength(1);
        const count = host.querySelector<HTMLButtonElement>('.shared-spectator-count')!;
        act(() => count.focus());
        expect(document.querySelector('.shared-spectator-preview')).not.toBeNull();
        shared.state = {broadcasting: null, watching: null};
        await act(async () => roots.at(-1)!.render(render()));
        expect(host.querySelectorAll('.shared-invocation-status')).toHaveLength(0);
        expect(document.querySelector('.shared-spectator-preview')).toBeNull();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    }
});

it('retains the same-session count through receipt remount and silent refresh, expires it and fences another session',async()=>{
    vi.useFakeTimers();
    const owned={...session,authoritative:true,snapshot:{...session.snapshot,presentation:{phase:'idle' as const,index:0,pull:null}}};
    let resolve!: (value:unknown)=>void;
    const spectators=vi.fn().mockResolvedValueOnce({sessionId:session.id,total:7,page:1,totalPages:1,preview:[],players:[]}).mockImplementation(()=>new Promise(r=>{resolve=r}));
    const shared={enabled:true,pending:false,error:'',state:{broadcasting:owned,watching:null},api:{spectators}} as unknown as SharedInvocationController;
    const render=()=> <InvocationScreen ownerKey="owner" gacha={sharedGachaView(owned)} teams={{teams:[],availableCharacters:[],passiveReference:[]}} onSetTarget={vi.fn()} onPull={vi.fn()} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>;
    const host=mount(render());await act(async()=>{await Promise.resolve()});
    expect(host.querySelector('.shared-spectator-count')?.textContent).toContain('7 spectateurs');
    shared.state={broadcasting:{...session,authoritative:true},watching:null};
    await act(async()=>roots.at(-1)!.render(render()));
    expect(host.querySelector('.shared-spectator-count')?.textContent).toContain('7 spectateurs');
    act(()=>host.querySelector<HTMLButtonElement>('.shared-spectator-count')!.click());
    expect(host.querySelector('.shared-spectator-count')?.textContent).toContain('7 spectateurs');
    await act(async()=>vi.advanceTimersByTime(15000));
    expect(host.querySelector('.shared-spectator-count')?.textContent).toContain('Spectateurs…');
    shared.state={broadcasting:{...session,id:'different',authoritative:true},watching:null};
    await act(async()=>roots.at(-1)!.render(render()));
    await act(async()=>resolve({sessionId:session.id,total:99,page:1,totalPages:1,preview:[],players:[]}));
    expect(host.querySelector('.shared-spectator-count')?.textContent).not.toContain('99');
});

it('starts and stops directly in one click and keeps sharing absent from target selection', async () => {
    const start = vi.fn(async () => true), stop = vi.fn(async () => true);
    const own = {...session, authoritative: true, snapshot: {...session.snapshot, presentation: {phase:'idle' as const,index:0,pull:null}}};
    const shared = {enabled:true,pending:false,error:'',state:{broadcasting:null,watching:null},start,stop} as unknown as SharedInvocationController;
    const render = () => <InvocationScreen gacha={sharedGachaView(own)} teams={{teams:[],availableCharacters:[],passiveReference:[]}} onSetTarget={vi.fn()} onPull={vi.fn()} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>;
    const host=mount(render());
    await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Diffuser')!.click());
    expect(start).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    shared.state={broadcasting:own,watching:null};await act(async()=>roots.at(-1)!.render(render()));
    await act(async()=>host.querySelector<HTMLButtonElement>('.shared-invocation-button')!.click());expect(stop).toHaveBeenCalledOnce();
    shared.state={broadcasting:null,watching:null};await act(async()=>roots.at(-1)!.render(render()));
    act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Changer')!.click());
    expect(host.textContent).toContain('Choisissez votre cible');
    expect(host.querySelector('.shared-invocation-controls')).toBeNull();
});

it('preserves the loaded personal splash node through own idle start/stop, and resets it for a viewer identity', async () => {
    const own = {...session, authoritative:true, snapshot:{...session.snapshot,presentation:{phase:'idle' as const,index:0,pull:null}}};
    const projected=sharedGachaView(own),personal={...projected,banner:{...projected.banner,featuredFiveStars:projected.banner.featuredFiveStars.map(character=>({...character,splashPath:'/assets/genshin/characters/splash/10000042.png'}))}};
    const shared={enabled:true,pending:false,error:'',personalReady:true,state:{broadcasting:null,watching:null}} as unknown as SharedInvocationController;
    const render=()=> <InvocationScreen gacha={personal} teams={{teams:[],availableCharacters:[],passiveReference:[]}} onSetTarget={vi.fn()} onPull={vi.fn()} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>;
    const host=mount(render()),image=host.querySelector('img.banner-character-asset');expect(image).not.toBeNull();
    act(()=>image!.dispatchEvent(new Event('load')));expect(host.querySelector('.celestial-star')).toBeNull();
    for(let i=0;i<3;i++){
        shared.state={broadcasting:{...own,id:`own-${i}`},watching:null};await act(async()=>roots.at(-1)!.render(render()));expect(host.querySelector('img.banner-character-asset')).toBe(image);expect(host.querySelector('.celestial-star')).toBeNull();
        shared.state={broadcasting:null,watching:null};await act(async()=>roots.at(-1)!.render(render()));expect(host.querySelector('img.banner-character-asset')).toBe(image);
    }
    shared.state={broadcasting:null,watching:{...own,authoritative:false}};await act(async()=>roots.at(-1)!.render(render()));expect(host.querySelector('img.banner-character-asset')).not.toBe(image);
});

it('offers only personal history immediately after confirmed watch exit while fresh-state mutations stay fenced',async()=>{
    const idleSession={...session,snapshot:{...session.snapshot,presentation:{phase:'idle' as const,index:0,pull:null}}};
    const history=vi.fn(async()=>({results:[],page:1,pageSize:10 as const,totalResults:0,totalPages:0,hasPrevious:false,hasNext:false})),onPull=vi.fn(),onSetTarget=vi.fn();
    const shared={enabled:true,pending:false,error:'',personalReady:true,state:{broadcasting:null,watching:idleSession}} as unknown as SharedInvocationController;
    const render=()=> <InvocationScreen gacha={sharedGachaView(idleSession)} teams={{teams:[],availableCharacters:[],passiveReference:[]}} onSetTarget={onSetTarget} onPull={onPull} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={history} shared={shared}/>;
    const host=mount(render());expect(host.querySelector('.detail')).toBeNull();
    shared.state={broadcasting:null,watching:null};shared.personalReady=false;await act(async()=>roots.at(-1)!.render(render()));
    const details=host.querySelector<HTMLButtonElement>('.detail');expect(details?.textContent).toBe('Détails');expect(details?.disabled).toBe(false);
    expect([...host.querySelectorAll<HTMLButtonElement>('.wish-button')].every(b=>b.disabled)).toBe(true);
    expect([...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Changer')?.disabled).toBe(true);
    await act(async()=>details!.click());expect(history).toHaveBeenCalledWith(1);expect(onPull).not.toHaveBeenCalled();expect(onSetTarget).not.toHaveBeenCalled();
});

it('never renders a pending-pull retry in the scene and never resumes an uncommitted intent automatically',()=>{
    const own={...session,authoritative:true,pendingPull:{key:'immutable-intent',count:10 as const},snapshot:{...session.snapshot,presentation:{phase:'idle' as const,index:0,pull:null}}};
    const resume=vi.fn(),shared={enabled:true,pending:false,error:'',personalReady:true,state:{broadcasting:own,watching:null},resume} as unknown as SharedInvocationController;
    const host=mount(<InvocationScreen gacha={sharedGachaView(own)} teams={{teams:[],availableCharacters:[],passiveReference:[]}} onSetTarget={vi.fn()} onPull={vi.fn()} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>);
    expect(host.textContent).not.toContain('Invocation en attente');expect(host.textContent).not.toContain('Réessayer cette Invocation');expect(resume).not.toHaveBeenCalled();expect(shared.state.broadcasting?.pendingPull).toEqual({key:'immutable-intent',count:10});
});

it('reuses only the matching primary invocation button for an explicit preserved intent, including failure and busy guards',async()=>{
    const own={...session,authoritative:true,pendingPull:{key:'immutable-intent',count:10 as const},snapshot:{...session.snapshot,presentation:{phase:'idle' as const,index:0,pull:null}}};
    const resume=vi.fn(async()=>false),pull=vi.fn(),shared={enabled:true,pending:false,error:'',personalReady:true,state:{broadcasting:own,watching:null},resume} as unknown as SharedInvocationController;
    const render=()=> <InvocationScreen ownerKey="owner" gacha={sharedGachaView(own)} teams={{teams:[],availableCharacters:[],passiveReference:[]}} onSetTarget={vi.fn()} onPull={pull} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={vi.fn()} shared={shared}/>;
    const host=mount(render()),buttons=()=>[...host.querySelectorAll<HTMLButtonElement>('.wish-button')];
    expect(buttons()).toHaveLength(2);expect(buttons()[0].disabled).toBe(true);expect(buttons()[1].disabled).toBe(false);
    await act(async()=>buttons()[1].click());expect(resume).toHaveBeenCalledOnce();expect(pull).not.toHaveBeenCalled();expect(shared.state.broadcasting?.pendingPull).toEqual({key:'immutable-intent',count:10});
    shared.pending=true;await act(async()=>roots.at(-1)!.render(render()));expect(buttons().every(b=>b.disabled)).toBe(true);
    shared.pending=false;shared.personalReady=false;await act(async()=>roots.at(-1)!.render(render()));expect(buttons().every(b=>b.disabled)).toBe(true);
    shared.personalReady=true;shared.state={broadcasting:{...own,authoritative:false},watching:null};await act(async()=>roots.at(-1)!.render(render()));expect(buttons().every(b=>b.disabled)).toBe(true);expect(host.querySelector('.detail')).toBeNull();
    shared.state={broadcasting:null,watching:{...own,authoritative:false}};await act(async()=>roots.at(-1)!.render(render()));expect(buttons().every(b=>b.disabled)).toBe(true);expect(host.querySelector('.detail')).toBeNull();expect(resume).toHaveBeenCalledOnce();expect(pull).not.toHaveBeenCalled();
});
