import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { PrismaGachaStore } from '../../infrastructure/database/prisma-gacha-store.js';
import type { GachaPullResult } from './gacha-store.js';
import { sharedCharacter, sharedState, sharedBanner } from './shared-invocation-projection.js';
export { sharedCharacter, sharedState } from './shared-invocation-projection.js';
import { BusinessError } from '../errors.js';
export const sharedEmojis = ['🎉', '✨', '❤️', '😮', '👏'] as const;
export const sharedInactivityMs = 45 * 60000;
export const sharedLeaseMs = 60000;
export const sharedReactionMs = 3000;
type Tx = Prisma.TransactionClient;
type Presentation = {
    phase: 'idle' | 'intro' | 'reveal' | 'summary';
    index: number;
    pull: ReturnType<typeof sharedPull> | null;
};
type Snapshot = {
    displayName: string;
    avatarPath: string | null;
    gacha: {
        banner: {
            id: string;
            startsAt: string;
            endsAt: string;
            featuredFiveStars: ReturnType<typeof sharedCharacter>[];
            featuredFourStars: ReturnType<typeof sharedCharacter>[];
        };
        playerState: ReturnType<typeof sharedState>;
    };
    presentation: Presentation;
};
type Reaction = {
    id: string;
    emoji: string;
    expiresAt: string;
};
type Row = {
    id: string;
    owner_id: string;
    tab_id: string;
    presence_revision: bigint;
    status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    last_gesture_at: Date;
    lease_until: Date;
    seq: number;
    snapshot: Snapshot;
    pending_key: string | null;
    completed_key: string | null;
    pending_count: 1 | 10 | null;
    reactions: Reaction[];
};
/** Explicit allowlists: no Player DTO, balances, auth identity, lifetime counters or XP. */
export function sharedPull(p: GachaPullResult) {
    return { operation: { id: p.operation.id, pullCount: p.operation.pullCount, createdAt: p.operation.createdAt.toISOString() }, results: p.results.map(r => ({ index: r.index, resultType: r.resultType, character: r.character ? sharedCharacter(r.character) : null, rarity: r.rarity, resourceKey: r.resourceKey, resourceAmount: r.resourceAmount?.toString() ?? null, wasNewCharacter: r.wasNewCharacter, constellationAfter: r.constellationAfter, wasFiftyFifty: r.wasFiftyFifty, wonFiftyFifty: r.wonFiftyFifty, guaranteeConsumed: r.guaranteeConsumed, captureTriggered: r.captureTriggered, c6Progression: r.c6Progression, bonusRewards: r.bonusRewards.map(b => ({ resourceKey: b.resourceKey, amount: b.amount.toString(), causeKey: b.causeKey })) })) };
}
export function sharedLive(row: Pick<Row, 'status' | 'last_gesture_at' | 'lease_until'>, now: Date) {
    return row.status !== 'STOPPED' && row.lease_until > now && now.getTime() - row.last_gesture_at.getTime() < sharedInactivityMs;
}
export function nextSharedPresentation(p: Presentation, action: 'advance' | 'skip' | 'close'): Presentation {
    if (!p.pull)
        return p;
    if (action === 'close')
        return p.phase === 'reveal' || p.phase === 'summary' ? { phase: 'idle', index: 0, pull: null } : p;
    if (action === 'skip')
        return p.phase === 'intro' || p.phase === 'reveal' ? { ...p, phase: p.pull.operation.pullCount === 10 ? 'summary' : 'reveal', index: 0 } : p;
    if (p.phase === 'intro')
        return { ...p, phase: 'reveal', index: 0 };
    if (p.phase !== 'reveal' || p.pull.operation.pullCount === 1)
        return p;
    return p.index + 1 < p.pull.results.length ? { ...p, index: p.index + 1 } : { ...p, phase: 'summary' };
}
export class SharedInvocations {
    private cleanupAfter = 0;
    constructor(private readonly db: PrismaClient, private readonly players: GetCurrentPlayer, private readonly gacha: PrismaGachaStore, private readonly clock: Clock) {
    }
    private now() {
        return this.clock.now();
    }
    private async owner(identity: AuthenticatedIdentity) {
        const p = await this.players.execute(identity);
        if (p.status !== 'ACTIVE')
            throw new BusinessError('SHARED_FORBIDDEN', 'Ce compte ne peut pas accéder aux diffusions.');
        return p;
    }
    private async lock(tx: Tx) {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(1074074)`;
    }
    private async member(tx: Tx, playerId: string) {
        await tx.$executeRaw `INSERT INTO shared_invocation_members(player_id) VALUES(${playerId}::uuid) ON CONFLICT DO NOTHING`;
        return (await tx.$queryRaw<{
            watching_id: string | null;
            last_reaction_at: Date | null;
        }[]> `SELECT CASE WHEN EXISTS(SELECT 1 FROM shared_invocation_sessions s WHERE s.id=m.watching_id AND s.status<>'STOPPED' AND s.lease_until>${this.now()} AND s.last_gesture_at>${new Date(this.now().getTime() - sharedInactivityMs)}) THEN watching_id ELSE NULL END watching_id,last_reaction_at FROM shared_invocation_members m WHERE player_id=${playerId}::uuid FOR UPDATE`)[0]!;
    }
    private async row(tx: Tx, id: string, byOwner = false) {
        return (await tx.$queryRaw<Row[]>(byOwner ? PrismaSqlOwner(id) : PrismaSqlId(id)))[0] ?? null;
    }
    private async prune(tx: Tx, now: Date) {
        await tx.$executeRaw `UPDATE shared_invocation_sessions SET status='STOPPED', seq=seq+1, pending_key=NULL,pending_count=NULL,reactions='[]'::jsonb,updated_at=${now} WHERE id IN(SELECT id FROM shared_invocation_sessions WHERE status<>'STOPPED' AND (lease_until<=${now} OR last_gesture_at<=${new Date(now.getTime() - sharedInactivityMs)}) LIMIT 100)`;
        await tx.$executeRaw `UPDATE shared_invocation_members m SET watching_id=NULL FROM shared_invocation_sessions s WHERE m.player_id IN(SELECT m2.player_id FROM shared_invocation_members m2 JOIN shared_invocation_sessions s2 ON m2.watching_id=s2.id WHERE s2.status='STOPPED' LIMIT 1000) AND m.watching_id=s.id AND s.status='STOPPED'`;
        await tx.$executeRaw `UPDATE shared_invocation_sessions s SET seq=seq+1,reactions=COALESCE((SELECT jsonb_agg(r) FROM jsonb_array_elements(s.reactions) r WHERE (r->>'expiresAt')::timestamptz>${now}),'[]'::jsonb) WHERE s.id IN(SELECT s2.id FROM shared_invocation_sessions s2 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(s2.reactions) r WHERE (r->>'expiresAt')::timestamptz<=${now}) LIMIT 100)`;
        await tx.$executeRaw `DELETE FROM shared_invocation_sessions WHERE id IN (SELECT id FROM shared_invocation_sessions WHERE status='STOPPED' AND updated_at<${new Date(now.getTime() - 3600000)} LIMIT 100)`;
    }
    private dto(r: Row, tabId?: string) {
        return { id: r.id, seq: r.seq, status: r.status, authoritative: tabId === r.tab_id, expiresAt: new Date(r.last_gesture_at.getTime() + sharedInactivityMs).toISOString(), ...(tabId === r.tab_id && r.pending_key && r.pending_count ? { pendingPull: { key: r.pending_key, count: r.pending_count } } : {}), snapshot: r.snapshot, reactions: r.reactions.filter(x => Date.parse(x.expiresAt) > this.now().getTime()) };
    }
    private assertAuthority(r: Row | null, tabId: string | undefined) {
        if (!r || !sharedLive(r, this.now()) || r.tab_id !== tabId)
            throw new BusinessError('SHARED_AUTHORITY_REQUIRED', 'La diffusion est contrôlée dans un autre onglet ou a expiré.');
        return r;
    }
    private async project(tx: Tx, playerId: string, displayName: string): Promise<Snapshot> {
        const current = await this.gacha.getCurrent(playerId, tx);
        if (!current)
            throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'La bannière est indisponible.');
        const avatar = await tx.player.findUnique({ where: { id: playerId }, select: { equippedAvatarCosmetic: { select: { assetPath: true } } } });
        return { displayName, avatarPath: avatar?.equippedAvatarCosmetic?.assetPath ?? null, gacha: { banner: sharedBanner(current.banner), playerState: sharedState(current.playerState) }, presentation: { phase: 'idle', index: 0, pull: null } };
    }
    async list(identity: AuthenticatedIdentity) {
        await this.owner(identity);
        return this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await this.prune(tx, this.now());
            const rows = await tx.$queryRaw<Row[]> `SELECT * FROM shared_invocation_sessions WHERE status IN ('ACTIVE','PAUSED') AND lease_until>${this.now()} AND last_gesture_at>${new Date(this.now().getTime() - sharedInactivityMs)} ORDER BY updated_at DESC LIMIT 100`;
            return { sessions: rows.map(r => ({ id: r.id, displayName: r.snapshot.displayName, avatarPath: r.snapshot.avatarPath, status: r.status })) };
        });
    }
    async state(identity: AuthenticatedIdentity, tabId: string, cursor?: string) {
        const p = await this.owner(identity), now = this.now();
        type Version = Pick<Row, 'id' | 'owner_id' | 'seq' | 'pending_key'> & {
            reaction_expired: boolean;
        };
        const versions = () => this.db.$queryRaw<Version[]> `
      SELECT id,owner_id,seq,pending_key,
        EXISTS(SELECT 1 FROM jsonb_array_elements(reactions) r WHERE (r->>'expiresAt')::timestamptz<=${now}) reaction_expired
      FROM shared_invocation_sessions WHERE status<>'STOPPED' AND lease_until>${now}
      AND last_gesture_at>${new Date(now.getTime() - sharedInactivityMs)}
      AND (owner_id=${p.id}::uuid OR id=(SELECT watching_id FROM shared_invocation_members WHERE player_id=${p.id}::uuid)) ORDER BY id`;
        let rows = await versions();
        if (rows.some(r => r.pending_key)) {
            for (const row of rows.filter(r => r.pending_key))
                await this.reconcile(row.owner_id);
            rows = await versions();
        }
        if (now.getTime() >= this.cleanupAfter || rows.some(r => r.reaction_expired)) {
            this.cleanupAfter = now.getTime() + 60000;
            await this.db.$transaction(async (tx) => {
                await this.lock(tx);
                await this.prune(tx, now);
            });
            rows = await versions();
        }
        const nextCursor = rows.map(r => `${r.owner_id === p.id ? 'own' : 'watch'}:${r.id}:${r.seq}`).join('|') || 'idle';
        if (cursor === nextCursor && !rows.some(r => r.reaction_expired))
            return { broadcasting: null, watching: null, cursor: nextCursor, unchanged: true };
        if (!rows.length)
            return { broadcasting: null, watching: null, cursor: nextCursor, unchanged: false };
        const full = await this.db.$queryRaw<Row[]> `SELECT * FROM shared_invocation_sessions WHERE id=ANY(${rows.map(r => r.id)}::uuid[]) AND status<>'STOPPED' AND lease_until>${now} AND last_gesture_at>${new Date(now.getTime() - sharedInactivityMs)} AND (owner_id=${p.id}::uuid OR id=(SELECT watching_id FROM shared_invocation_members WHERE player_id=${p.id}::uuid)) ORDER BY id`;
        const confirmedCursor = full.map(r => `${r.owner_id === p.id ? 'own' : 'watch'}:${r.id}:${r.seq}`).join('|') || 'idle';
        const own = full.find(r => r.owner_id === p.id), watching = full.find(r => r.owner_id !== p.id);
        // A concurrent stop can happen between version and snapshot reads: never revive it.
        return { broadcasting: own && sharedLive(own, this.now()) ? this.dto(own, tabId) : null, watching: watching && sharedLive(watching, this.now()) ? this.dto(watching) : null, cursor: confirmedCursor, unchanged: false };
    }
    async start(identity: AuthenticatedIdentity, tabId: string) {
        const p = await this.owner(identity), now = this.now();
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await this.prune(tx, now);
            const m = await this.member(tx, p.id);
            if (m.watching_id)
                throw new BusinessError('SHARED_MODE_CONFLICT', 'Arrêtez le visionnage avant de diffuser.');
            const own = await this.row(tx, p.id, true);
            if (own && sharedLive(own, now)) {
                this.assertAuthority(own, tabId);
                return;
            }
            if (own)
                await tx.$executeRaw `DELETE FROM shared_invocation_sessions WHERE id=${own.id}::uuid`;
            const snapshot = await this.project(tx, p.id, p.displayName);
            await tx.$executeRaw `INSERT INTO shared_invocation_sessions(owner_id,tab_id,status,last_gesture_at,lease_until,snapshot) VALUES(${p.id}::uuid,${tabId}::uuid,'ACTIVE',${now},${new Date(now.getTime() + sharedLeaseMs)},${JSON.stringify(snapshot)}::jsonb) ON CONFLICT(owner_id) DO UPDATE SET tab_id=EXCLUDED.tab_id,status='ACTIVE',last_gesture_at=EXCLUDED.last_gesture_at,lease_until=EXCLUDED.lease_until,snapshot=EXCLUDED.snapshot,seq=shared_invocation_sessions.seq+1,completed_key=NULL,pending_key=NULL,pending_count=NULL,reactions='[]'::jsonb,updated_at=EXCLUDED.last_gesture_at`;
        });
        return this.state(identity, tabId);
    }
    async watch(identity: AuthenticatedIdentity, tabId: string, sessionId: string | null) {
        const p = await this.owner(identity);
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await this.prune(tx, this.now());
            await this.member(tx, p.id);
            const own = await this.row(tx, p.id, true);
            if (sessionId && own && sharedLive(own, this.now()))
                throw new BusinessError('SHARED_MODE_CONFLICT', 'Arrêtez votre diffusion avant de regarder.');
            if (sessionId) {
                const target = await this.row(tx, sessionId);
                if (!target || target.owner_id === p.id || !sharedLive(target, this.now()))
                    throw new BusinessError('SHARED_UNAVAILABLE', 'Cette diffusion n’est plus disponible.');
            }
            await tx.$executeRaw `UPDATE shared_invocation_members SET watching_id=${sessionId}::uuid WHERE player_id=${p.id}::uuid`;
        });
        return this.state(identity, tabId);
    }
    async control(identity: AuthenticatedIdentity, tabId: string, action: 'stop' | 'presence' | 'gesture' | 'advance' | 'skip' | 'close', screen: 'invocation' | 'other', seq?: number, presenceRevision?: number, sessionId?: string) {
        const p = await this.owner(identity);
        await this.reconcile(p.id);
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await this.prune(tx, this.now());
            const own = this.assertAuthority(await this.row(tx, p.id, true), tabId), now = this.now();
            if (action === 'stop') {
                await tx.$executeRaw `UPDATE shared_invocation_sessions SET status='STOPPED',seq=seq+1,pending_key=NULL,pending_count=NULL,reactions='[]'::jsonb,updated_at=${now} WHERE id=${own.id}::uuid`;
                await this.prune(tx, now);
                return;
            }
            if (action === 'presence' || action === 'gesture') {
                if (sessionId && sessionId !== own.id)
                    return;
                if (presenceRevision !== undefined && BigInt(presenceRevision) <= own.presence_revision)
                    return;
                const status = screen === 'invocation' ? 'ACTIVE' : 'PAUSED';
                const changed = status !== own.status;
                const gesture = action === 'gesture' && now.getTime() - own.last_gesture_at.getTime() >= 10000;
                await tx.$executeRaw `UPDATE shared_invocation_sessions SET presence_revision=${presenceRevision ?? Number(own.presence_revision) + 1},status=${status},lease_until=${new Date(now.getTime() + sharedLeaseMs)},last_gesture_at=${gesture ? now : own.last_gesture_at},seq=seq+${changed ? 1 : 0},updated_at=${now} WHERE id=${own.id}::uuid`;
                return;
            }
            if (own.status !== 'ACTIVE')
                throw new BusinessError('SHARED_PAUSED', 'La diffusion est en pause.');
            if (seq !== own.seq)
                throw new BusinessError('SHARED_STALE', 'La présentation a changé. Actualisez la scène.');
            const snapshot = { ...own.snapshot, presentation: nextSharedPresentation(own.snapshot.presentation, action) };
            await tx.$executeRaw `UPDATE shared_invocation_sessions SET snapshot=${JSON.stringify(snapshot)}::jsonb,seq=seq+1,last_gesture_at=${now},updated_at=${now} WHERE id=${own.id}::uuid`;
        });
        return this.state(identity, tabId);
    }
    async preparePull(identity: AuthenticatedIdentity, tabId: string | undefined, key: string, count: 1 | 10) {
        const p = await this.owner(identity);
        await this.reconcile(p.id);
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await this.prune(tx, this.now());
            const m = await this.member(tx, p.id);
            if (m.watching_id)
                throw new BusinessError('SHARED_SPECTATOR_READ_ONLY', 'Arrêtez le visionnage pour invoquer.');
            const own = await this.row(tx, p.id, true);
            if (!own || !sharedLive(own, this.now()))
                return;
            this.assertAuthority(own, tabId);
            if (own.status !== 'ACTIVE')
                throw new BusinessError('SHARED_PAUSED', 'Revenez dans Invocation avant d’invoquer.');
            if (own.completed_key === key)
                return;
            if (own.pending_key && (own.pending_key !== key || own.pending_count !== count))
                throw new BusinessError('SHARED_PULL_PENDING', 'Confirmez l’Invocation précédente.');
            if (own.snapshot.presentation.phase !== 'idle' && own.snapshot.presentation.pull?.operation.id)
                throw new BusinessError('SHARED_PRESENTATION_PENDING', 'Fermez les résultats précédents.');
            await tx.$executeRaw `UPDATE shared_invocation_sessions SET seq=seq+1,pending_key=${key}::uuid,pending_count=${count},last_gesture_at=${this.now()} WHERE id=${own.id}::uuid`;
        });
    }
    async publishPull(identity: AuthenticatedIdentity) {
        const p = await this.owner(identity);
        await this.reconcile(p.id);
    }
    async releaseFailedPull(identity: AuthenticatedIdentity, key: string) {
        const p = await this.owner(identity);
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await tx.$executeRaw `UPDATE shared_invocation_sessions SET seq=seq+1,pending_key=NULL,pending_count=NULL WHERE owner_id=${p.id}::uuid AND pending_key=${key}::uuid`;
        });
    }
    private async reconcile(playerId: string) {
        const own = (await this.db.$queryRaw<Pick<Row, 'id' | 'pending_key' | 'pending_count'>[]> `SELECT id,pending_key,pending_count FROM shared_invocation_sessions WHERE owner_id=${playerId}::uuid AND status<>'STOPPED'`)[0];
        if (!own?.pending_key || !own.pending_count)
            return;
        const pull = await this.gacha.findStandalonePresentation(playerId, own.pending_key, own.pending_count);
        if (!pull)
            return;
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            const latest = await this.row(tx, own.id);
            if (!latest || latest.status === 'STOPPED' || latest.pending_key !== own.pending_key)
                return;
            const snapshot = { ...latest.snapshot, gacha: { ...latest.snapshot.gacha, playerState: sharedState(pull.playerState) }, presentation: { phase: 'intro', index: 0, pull: sharedPull(pull) } };
            await tx.$executeRaw `UPDATE shared_invocation_sessions SET snapshot=${JSON.stringify(snapshot)}::jsonb,completed_key=pending_key,pending_key=NULL,pending_count=NULL,seq=seq+1,updated_at=${this.now()} WHERE id=${own.id}::uuid`;
        });
    }
    async assertTarget(identity: AuthenticatedIdentity, tabId: string | undefined) {
        const p = await this.owner(identity);
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await this.prune(tx, this.now());
            if ((await this.member(tx, p.id)).watching_id)
                throw new BusinessError('SHARED_SPECTATOR_READ_ONLY', 'Le spectateur ne peut pas changer la cible.');
            const own = await this.row(tx, p.id, true);
            if (own && sharedLive(own, this.now()))
                this.assertAuthority(own, tabId);
        });
    }
    async react(identity: AuthenticatedIdentity, tabId: string, emoji: typeof sharedEmojis[number]) {
        const p = await this.owner(identity);
        await this.db.$transaction(async (tx) => {
            await this.lock(tx);
            await this.prune(tx, this.now());
            const m = await this.member(tx, p.id), now = this.now();
            if (!m.watching_id)
                throw new BusinessError('SHARED_SPECTATOR_REQUIRED', 'Les réactions sont réservées aux spectateurs.');
            if (m.last_reaction_at && now.getTime() - m.last_reaction_at.getTime() < sharedReactionMs)
                throw new BusinessError('SHARED_REACTION_COOLDOWN', 'Patientez trois secondes.');
            const r = await this.row(tx, m.watching_id);
            if (!r || !sharedLive(r, now))
                throw new BusinessError('SHARED_UNAVAILABLE', 'Cette diffusion est terminée.');
            const reactions = [...r.reactions.filter(x => Date.parse(x.expiresAt) > now.getTime()).slice(-15), { id: crypto.randomUUID(), emoji, expiresAt: new Date(now.getTime() + 4000).toISOString() }];
            await tx.$executeRaw `UPDATE shared_invocation_members SET last_reaction_at=${now} WHERE player_id=${p.id}::uuid`;
            await tx.$executeRaw `UPDATE shared_invocation_sessions SET reactions=${JSON.stringify(reactions)}::jsonb,seq=seq+1 WHERE id=${r.id}::uuid`;
        });
        return this.state(identity, tabId);
    }
}
import { Prisma as RuntimePrisma } from '../../../generated/prisma/client.js';
function PrismaSqlOwner(id: string) {
    return RuntimePrisma.sql `SELECT * FROM shared_invocation_sessions WHERE owner_id=${id}::uuid FOR UPDATE`;
}
function PrismaSqlId(id: string) {
    return RuntimePrisma.sql `SELECT * FROM shared_invocation_sessions WHERE id=${id}::uuid FOR UPDATE`;
}
