import type { Prisma } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
/** Same lock as session mode changes. Called only by the standalone UI transaction. */
export async function assertSharedStandaloneAuthority(tx: Prisma.TransactionClient, playerId: string, tabId: string | undefined, now: Date, pull?: {
    key: string;
    count: number;
}) {
    await tx.$executeRaw `SELECT pg_advisory_xact_lock(1074074)`;
    const cutoff = new Date(now.getTime() - 45 * 60000);
    const watching = await tx.$queryRaw<{
        watching_id: string;
    }[]> `
    SELECT m.watching_id FROM shared_invocation_members m JOIN shared_invocation_sessions s ON s.id=m.watching_id
    WHERE m.player_id=${playerId}::uuid AND s.status<>'STOPPED' AND s.lease_until>${now} AND s.last_gesture_at>${cutoff}`;
    if (watching.length)
        throw new BusinessError('SHARED_SPECTATOR_READ_ONLY', 'Arrêtez le visionnage pour invoquer.');
    const broadcasting = await tx.$queryRaw<{
        tab_id: string;
        status: string;
        pending_key: string | null;
        pending_count: number | null;
        completed_key: string | null;
        phase: string;
    }[]> `
    SELECT tab_id,status,pending_key,pending_count,completed_key,snapshot->'presentation'->>'phase' phase FROM shared_invocation_sessions WHERE owner_id=${playerId}::uuid
    AND status<>'STOPPED' AND lease_until>${now} AND last_gesture_at>${cutoff}`;
    if (broadcasting[0] && (broadcasting[0].tab_id !== tabId || broadcasting[0].status !== 'ACTIVE')) {
        throw new BusinessError('SHARED_AUTHORITY_REQUIRED', 'La diffusion est contrôlée dans un autre onglet ou en pause.');
    }
    const own = broadcasting[0];
    if (own && !pull && own.phase !== 'idle')
        throw new BusinessError('SHARED_PRESENTATION_PENDING', 'Fermez les résultats précédents avant de changer la cible.');
    if (own && pull && own.completed_key !== pull.key) {
        if (own.pending_key && (own.pending_key !== pull.key || own.pending_count !== pull.count))
            throw new BusinessError('SHARED_PULL_PENDING', 'Confirmez l’Invocation précédente.');
        if (own.phase !== 'idle')
            throw new BusinessError('SHARED_PRESENTATION_PENDING', 'Fermez les résultats précédents.');
        // Durable intent also commits with the economic operation, covering a concurrent start.
        await tx.$executeRaw `UPDATE shared_invocation_sessions SET pending_key=${pull.key}::uuid,pending_count=${pull.count},last_gesture_at=${now} WHERE owner_id=${playerId}::uuid`;
    }
}
