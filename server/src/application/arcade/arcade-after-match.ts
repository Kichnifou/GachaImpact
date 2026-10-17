import { Prisma, type ArcadeSession, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import type { ArcadeGame, ArcadeDifficulty } from '../../domain/arcade/types.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { arcadeTransaction, lockArcadePlayers, arcadeJson, arcadeConflict } from './arcade-transaction.js';
import { arcadeBusy, participantWhere, validArcadePair } from './arcade-invitations.js';
import { createArcadeSession, arcadeParticipants } from './arcade-session-factory.js';
import { projectSession, personalSummary } from './arcade-projection.js';
import { afterMatchDeadline, afterMatchExpired, afterMatchTabKey, cancelAfterMatch, projectAfterMatch, readAfterMatch, touchAfterMatch, type ArcadeAfterMatchState } from './arcade-after-match-state.js';
import type { ArcadeMutation } from './arcade-service.js';
export type ArcadeAfterMatchPresenceInput = { tabKey: string; sequence: number; visible: boolean };
export type ArcadeAfterMatchInput = { kind: 'REPLAY' | 'SOLO'; tabKey: string; sequence: number; idempotencyKey: string };
const candidate = (tx: PrismaClient | Prisma.TransactionClient, id: string, playerId: string) => tx.arcadeSession.findFirst({ where: { id, ...participantWhere(playerId) }, include: arcadeParticipants });
export async function persistAfterMatch(tx: Prisma.TransactionClient, row: ArcadeSession, state: ArcadeAfterMatchState) {
  return tx.arcadeSession.update({ where: { id: row.id }, data: { afterMatch: arcadeJson(state),
    afterMatchExpiresAt: state.status === 'WAITING' ? afterMatchDeadline(state, row.playerId, row.opponentPlayerId!) : null,
    // Presence must not rewrite the historical game timestamps or board version.
    updatedAt: row.updatedAt }, include: arcadeParticipants });
}
export class ArcadeAfterMatch {
  constructor(private readonly db: PrismaClient, private readonly clock: Clock, private readonly seed: () => number) {}
  private async source(id: string, playerId: string) {
    const row = await candidate(this.db, id, playerId);
    if (!row) throw new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND');
    return row;
  }
  async presence(playerId: string, id: string, input: ArcadeAfterMatchPresenceInput) {
    const source = await this.source(id, playerId);
    for (let attempt = 0;; attempt++) try {
      return await this.db.$transaction(async tx => {
        await lockArcadePlayers(tx, [source.playerId, ...(source.opponentPlayerId ? [source.opponentPlayerId] : [])]);
        let row = await candidate(tx, id, playerId);
        if (!row) throw new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND');
        const now = this.clock.now(), state = readAfterMatch(row.afterMatch);
        if (state?.status === 'WAITING') {
          if (afterMatchExpired(row, now) || !await validArcadePair(tx, row.playerId, row.opponentPlayerId!)) { cancelAfterMatch(state); row = await persistAfterMatch(tx, row, state) }
          else if (touchAfterMatch(state, playerId, input.tabKey, input.sequence, input.visible, now)) row = await persistAfterMatch(tx, row, state);
        }
        const next = state?.status === 'STARTED' && state.nextSessionId ? await candidate(tx, state.nextSessionId, playerId) : null;
        return { sessionId: id, afterMatch: projectAfterMatch(row, playerId, now), ...(next ? { nextSession: projectSession(next, playerId, now) } : {}) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (error) { if (attempt < 4 && isPrismaConcurrencyCollision(error)) continue; throw error }
  }
  async request(playerId: string, id: string, input: ArcadeAfterMatchInput): Promise<ArcadeMutation> {
    const source = await this.source(id, playerId), seed = this.seed();
    return arcadeTransaction(this.db, this.clock, playerId, [source.playerId, ...(source.opponentPlayerId ? [source.opponentPlayerId] : [])], input.idempotencyKey,
      { action: 'AFTER_MATCH', sessionId: id, ...input }, async (tx, _element, operationId, now) => {
        let row = await candidate(tx, id, playerId);
        if (!row) throw new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND');
        const state = readAfterMatch(row.afterMatch);
        if (row.mode !== 'MULTIPLAYER' || row.status !== 'FINISHED' || !state) throw arcadeConflict('Cette partie ne propose pas de revanche.', 'ARCADE_AFTER_MATCH_UNAVAILABLE');
        const finish = async (session: ReturnType<typeof projectSession>) => ({ response: { ...await personalSummary(tx, playerId, businessDateToDatabaseDate(getBusinessDate(now))), session, operationId, alreadyProcessed: false, award: null }, sessionId: session.id });
        if (state.status === 'STARTED') {
          if (input.kind === 'SOLO') throw arcadeConflict('La revanche a déjà commencé.', 'ARCADE_ACTIVE_EXISTS');
          const next = state.nextSessionId ? await candidate(tx, state.nextSessionId, playerId) : null;
          if (!next) throw arcadeConflict('Actualisez Arcade.', 'ARCADE_AFTER_MATCH_UNAVAILABLE');
          return finish(projectSession(next, playerId, now));
        }
        if (state.status === 'WAITING' && (afterMatchExpired(row, now) || !await validArcadePair(tx, row.playerId, row.opponentPlayerId!))) { cancelAfterMatch(state); row = await persistAfterMatch(tx, row, state) }
        if (input.kind === 'SOLO') {
          const latest = await tx.arcadeSession.findFirst({ where: { ...participantWhere(playerId), game: row.game }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
          if (latest?.id !== row.id || await arcadeBusy(tx, playerId, undefined, row.id, now)) throw arcadeConflict('Une autre partie ou invitation est déjà en cours.', 'ARCADE_ACTIVE_EXISTS');
          if (state.status === 'WAITING') { cancelAfterMatch(state); await persistAfterMatch(tx, row, state) }
          const solo = await createArcadeSession(tx, playerId, row.game as ArcadeGame, row.difficulty as ArcadeDifficulty, seed, now);
          return finish(projectSession(solo, playerId, now));
        }
        if (state.status !== 'WAITING') return finish(projectSession(row, playerId, now));
        if (await arcadeBusy(tx, row.playerId, undefined, row.id, now) || await arcadeBusy(tx, row.opponentPlayerId!, undefined, row.id, now)) {
          cancelAfterMatch(state); row = await persistAfterMatch(tx, row, state); return finish(projectSession(row, playerId, now));
        }
        touchAfterMatch(state, playerId, input.tabKey, input.sequence, true, now);
        const tab = state.tabs[afterMatchTabKey(playerId, input.tabKey)];
        if (!tab?.visible || tab.until < +now) throw arcadeConflict('Revenez sur cette partie avant de rejouer.', 'ARCADE_AFTER_MATCH_ABSENT');
        if (playerId === row.playerId) state.hostReady = true; else state.guestReady = true;
        state.revision++;
        if (state.hostReady && state.guestReady) {
          const next = await createArcadeSession(tx, row.playerId, row.game as ArcadeGame, row.difficulty as ArcadeDifficulty, seed, now, row.opponentPlayerId);
          state.status = 'STARTED'; state.nextSessionId = next.id; state.tabs = {}; await persistAfterMatch(tx, row, state);
          return finish(projectSession(next, playerId, now));
        }
        row = await persistAfterMatch(tx, row, state); return finish(projectSession(row, playerId, now));
      });
  }
}
