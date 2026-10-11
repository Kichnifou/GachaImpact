// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { mergeSharedSession } from './use-shared-invocations';
import { sharedGachaView, sharedSequenceView } from './shared-invocation-presentation';
import type { SharedSession } from '../api/shared-invocations-types';
import InvocationSequence from '../components/InvocationSequence';
import InvocationScreen from '../screens/InvocationScreen';
import type { SharedInvocationController } from './use-shared-invocations';
const hero = { id: 'target', name: 'Diffusion', rarity: 5 as const, elementKey: 'hydro' as const, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null };
const result = { index: 1, resultType: 'resource' as const, character: null, rarity: null, resourceKey: 'moras', resourceAmount: '5000', wasNewCharacter: null, constellationAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null };
const session: SharedSession = { id: 'session', seq: 5, status: 'ACTIVE', authoritative: false, expiresAt: '2026-10-11T20:00:00Z', snapshot: { displayName: 'Diffuseur consenti', avatarPath: null, gacha: { banner: { id: 'banner', startsAt: '2026-10-05T00:00:00Z', endsAt: '2026-10-12T00:00:00Z', featuredFiveStars: [hero], featuredFourStars: [] }, playerState: { selectedBannerCharacterId: hero.id, pity5: 42, pity4: 3, guaranteedFeatured5: true, captureProgress: 2 } }, presentation: { phase: 'reveal', index: 4, pull: { operation: { id: 'actual-operation', pullCount: 10, createdAt: '2026-10-11T19:00:00Z' }, results: Array.from({ length: 10 }, (_, i) => ({ ...result, index: i + 1 })) } } }, reactions: [] };
(globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
    act(() => roots.splice(0).forEach(root => root.unmount()));
    document.body.replaceChildren();
    vi.useRealTimers();
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
    expect(host.textContent).toContain('Diffusion en pause');
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
