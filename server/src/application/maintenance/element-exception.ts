import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { lockPlayerMutations } from '../player/player-mutation-guard.js';
import { parsePlayerRecovery } from '../player/player-recovery-readiness.js';
import { closePendingTrade } from '../trades/trade-state.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';

// One exceptional owner mandate, globally single use. No API/command registration.
export const elementExceptionKey = 'admin.element-exception.20261017';
export type ElementExceptionScope = { playerId: string; twitchUserId: string; login: string; actorPlayerId: string };
export type ElementExceptionReceipt = ElementExceptionScope & { operationId: string; sentClosed: number; receivedClosed: number; cryo: string; electro: string };
const fail = () => new Error('ELEMENT_EXCEPTION_GUARD_FAILED');

export async function applyElementException(db: PrismaClient, scope: ElementExceptionScope,
  economy = new PrismaEconomyService(), beforeCommit?: (tx: Prisma.TransactionClient) => Promise<void>,
  beforeMutation?: (tx: Prisma.TransactionClient, affectedPlayerIds: string[], operationId: string) => Promise<void>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        // Same ordering as TradeService. Acquired before reading pending IDs so
        // create/accept/refuse/cancel cannot pass the frozen scope.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('particles:trades'))`;
        const identities = await tx.twitchIdentity.findMany({ where: { OR: [{ twitchUserId: scope.twitchUserId }, { login: { equals: scope.login, mode: 'insensitive' } }] } });
        if (identities.length !== 1 || identities[0]?.playerId !== scope.playerId || identities[0]?.twitchUserId !== scope.twitchUserId || identities[0]?.login.toLowerCase() !== scope.login.toLowerCase()) throw fail();
        const requests = await tx.tradeRequest.findMany({ where: { state: 'PENDING', OR: [{ senderPlayerId: scope.playerId }, { recipientPlayerId: scope.playerId }] }, orderBy: { id: 'asc' } });
        await lockPlayerMutations(tx, [scope.playerId, scope.actorPlayerId, ...requests.flatMap(r => [r.senderPlayerId, r.recipientPlayerId])]);
        const actor = await tx.player.findUniqueOrThrow({ where: { id: scope.actorPlayerId } });
        const official = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
        if (scope.playerId === scope.actorPlayerId || actor.status !== 'ACTIVE' || official?.operatorPlayerId !== scope.actorPlayerId ||
          !await tx.playerRoleAssignment.count({ where: { playerId: scope.actorPlayerId, role: 'ADMIN', revokedAt: null } })) throw fail();
        const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: 'ADMIN', idempotencyKey: elementExceptionKey } });
        if (existing) {
          const receipt = existing.resultSummary as ElementExceptionReceipt | null;
          if (existing.status !== 'COMPLETED' || existing.operationType !== 'ADMIN_ELEMENT_EXCEPTION' || existing.playerId !== scope.playerId || !receipt ||
            receipt.playerId !== scope.playerId || receipt.twitchUserId !== scope.twitchUserId || receipt.login !== scope.login || receipt.actorPlayerId !== scope.actorPlayerId) throw fail();
          return { ...receipt, alreadyProcessed: true };
        }
        const player = await tx.player.findUniqueOrThrow({ where: { id: scope.playerId } });
        if (player.status !== 'ACTIVE' || player.elementKey !== 'cryo' || parsePlayerRecovery(player.legacyRecovery)?.restrictedDomains.length ||
          !await tx.element.count({ where: { key: 'electro', isActive: true } }) ||
          await tx.businessOperation.count({ where: { playerId: scope.playerId, status: 'PENDING' } })) throw fail();
        const now = new Date();
        const op = await tx.businessOperation.create({ data: { playerId: scope.playerId, operationType: 'ADMIN_ELEMENT_EXCEPTION', sourceChannel: 'ADMIN', idempotencyKey: elementExceptionKey } });
        await beforeMutation?.(tx, [...new Set([scope.playerId, ...requests.flatMap(r => [r.senderPlayerId, r.recipientPlayerId])])].sort(), op.id);
        for (const r of requests) await closePendingTrade(tx, r.id, r.senderPlayerId === scope.playerId ? 'CANCELLED' : 'REFUSED', now);
        const before = await economy.swapUnreservedCryoElectroWithoutStats(tx, scope.playerId, op.id);
        await tx.player.update({ where: { id: scope.playerId }, data: { elementKey: 'electro' } });
        const receipt: ElementExceptionReceipt = { ...scope, operationId: op.id, sentClosed: requests.filter(r => r.senderPlayerId === scope.playerId).length,
          receivedClosed: requests.filter(r => r.recipientPlayerId === scope.playerId).length, ...before };
        await tx.adminAuditEntry.create({ data: { actorPlayerId: scope.actorPlayerId, targetPlayerId: scope.playerId, action: 'EXCEPTIONAL_ELEMENT_SWAP', domain: 'administration', operationId: op.id,
          before: { elementKey: 'cryo', ...before, requests: requests.map(r => ({ id: r.id, state: r.state, amount: r.currentAmount.toString() })) },
          after: { elementKey: 'electro', cryo: before.electro, electro: before.cryo, sentClosed: receipt.sentClosed, receivedClosed: receipt.receivedClosed } } });
        await tx.businessOperation.update({ where: { id: op.id }, data: { status: 'COMPLETED', completedAt: now, resultSummary: receipt } });
        await beforeCommit?.(tx);
        return { ...receipt, alreadyProcessed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
    } catch (error) { if (attempt < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
  }
}
