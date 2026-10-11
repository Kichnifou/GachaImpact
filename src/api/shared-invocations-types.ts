import type { GachaCharacterDto, GachaPullResultItemDto } from './types';
export const sharedInvocationEmojis = ['🎉', '✨', '❤️', '😮', '👏'] as const;
export type SharedCharacter = Pick<GachaCharacterDto, 'id' | 'name' | 'rarity' | 'elementKey' | 'iconPath' | 'splashPath' | 'wishPath' | 'fullbodyPath'>;
export type SharedState = {
    selectedBannerCharacterId: string | null;
    pity5: number;
    pity4: number;
    guaranteedFeatured5: boolean;
    captureProgress: number;
};
export type SharedPull = {
    operation: {
        id: string;
        pullCount: 1 | 10;
        createdAt: string;
    };
    results: readonly Omit<GachaPullResultItemDto, 'copiesAfter' | 'passiveEffects'>[];
};
export type SharedSession = {
    id: string;
    seq: number;
    status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    authoritative: boolean;
    pendingPull?: {
        key: string;
        count: 1 | 10;
    };
    expiresAt: string;
    snapshot: {
        displayName: string;
        avatarPath: string | null;
        gacha: {
            banner: {
                id: string;
                startsAt: string;
                endsAt: string;
                featuredFiveStars: readonly SharedCharacter[];
                featuredFourStars: readonly SharedCharacter[];
            };
            playerState: SharedState;
        };
        presentation: {
            phase: 'idle' | 'intro' | 'reveal' | 'summary';
            index: number;
            pull: SharedPull | null;
        };
    };
    reactions: readonly {
        id: string;
        emoji: string;
        expiresAt: string;
    }[];
};
export type SharedInvocationState = {
    broadcasting: SharedSession | null;
    watching: SharedSession | null;
    cursor?: string;
    unchanged?: boolean;
};
export type SharedInvocationList = {
    sessions: readonly {
        id: string;
        displayName: string;
        avatarPath: string | null;
        status: 'ACTIVE' | 'PAUSED';
    }[];
};
export type SharedInvocationApi = {
    list: () => Promise<SharedInvocationList>;
    state: (tabId: string, cursor?: string) => Promise<SharedInvocationState>;
    start: (tabId: string) => Promise<SharedInvocationState>;
    watch: (tabId: string, sessionId: string | null) => Promise<SharedInvocationState>;
    control: (tabId: string, action: 'stop' | 'presence' | 'gesture' | 'advance' | 'skip' | 'close', screen: 'invocation' | 'other', seq?: number, sessionId?: string) => Promise<SharedInvocationState>;
    resume: (tabId: string, count: 1 | 10, key: string) => Promise<SharedInvocationState>;
    react: (tabId: string, emoji: typeof sharedInvocationEmojis[number]) => Promise<SharedInvocationState>;
};
