import { randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { arcadeTransaction, arcadeJson as json } from './arcade-transaction.js';
import { createArcadeSession, arcadeParticipants } from './arcade-session-factory.js';
import { ArcadeInvitations, arcadeBusy, participantWhere, validArcadePair, type ArcadeInviteInput, type ArcadeInviteAction } from './arcade-invitations.js';
import { PrismaPlayerXpService } from '../../infrastructure/database/prisma-player-xp-service.js';
import { businessDateToDatabaseDate, getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { type ElementKey } from '../../domain/economy/resources.js';
import { ArcadeRandom, arcadeGames, type ArcadeGame, type ArcadeDifficulty, type ArcadeState } from '../../domain/arcade/types.js';
import { revealMemory, concealMemory, memoryAiView } from '../../domain/arcade/memory.js';
import { chooseMemoryCard } from '../../domain/arcade/memory-ai.js';
import { legalLineMoves, playLineMove } from '../../domain/arcade/line-games.js';
import { chooseLineMove } from '../../domain/arcade/line-ai.js';
import { banterId, type BanterEvent } from '../../domain/arcade/banter.js';
import { personalSummary, projectSession } from './arcade-projection.js';
import { finalizeArcade } from './arcade-finalization.js';

export type ArcadeStart = { game: ArcadeGame; difficulty: ArcadeDifficulty; expectedVersion: 0; previousSessionId: string | null; idempotencyKey: string };
export type ArcadeAction = { expectedVersion: number; idempotencyKey: string } & ({ kind: 'MOVE'; position: number } | { kind: 'ADVANCE' | 'QUIT' });
export type ArcadeMutation = Awaited<ReturnType<typeof personalSummary>> & { session: ReturnType<typeof projectSession>; operationId: string; alreadyProcessed: boolean; award: Awaited<ReturnType<typeof finalizeArcade>>['award'] };
const conflict = (message: string, code = 'ARCADE_CONFLICT') => new AppError(message, 409, code);

export class ArcadeService {
  readonly invitations: ArcadeInvitations;
  constructor(private readonly database: PrismaClient, private readonly getPlayer: GetCurrentPlayer, private readonly clock: Clock,
    private readonly xp = new PrismaPlayerXpService(), private readonly seed = () => randomBytes(4).readUInt32LE()) { this.invitations = new ArcadeInvitations(database, clock, seed); }

  async actor(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (player.status !== 'ACTIVE' || !player.elementKey) throw new AppError('Arcade demande un profil actif avec un élément.', 403, 'ARCADE_UNAVAILABLE');
    return player;
  }
  async overview(identity: AuthenticatedIdentity) {
    const player = await this.actor(identity);
    await this.invitations.reconcileNotificationsForPlayer(player.id);
    return this.database.$transaction(async tx => {
      const summary = await personalSummary(tx, player.id, businessDateToDatabaseDate(getBusinessDate(this.clock.now())));
      const sessions = await Promise.all(arcadeGames.map(game => tx.arcadeSession.findFirst({ where: { ...participantWhere(player.id), game }, include: arcadeParticipants, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })));
      return { ...summary, sessions: sessions.filter(row => row !== null).map(row => projectSession(row, player.id)), invitation: await this.invitations.pending(tx, player.id), serverNow: this.clock.now().toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async session(identity: AuthenticatedIdentity, id: string) {
    const player = await this.actor(identity);
    const row = await this.database.arcadeSession.findFirst({ where: { id, ...participantWhere(player.id) }, include: arcadeParticipants });
    if (!row) throw new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND');
    return projectSession(row, player.id);
  }
  private async mutate(identity: AuthenticatedIdentity, idempotencyKey: string, intent: unknown,
    change: (tx: Prisma.TransactionClient, playerId: string, elementKey: ElementKey, operationId: string, now: Date) => Promise<{ session: ReturnType<typeof projectSession>; award: ArcadeMutation['award'] }>, lockIds: readonly string[] = []): Promise<ArcadeMutation> {
    const actor = await this.actor(identity);
    await this.invitations.reconcileNotificationsForPlayer(actor.id);
    return arcadeTransaction(this.database, this.clock, actor.id, lockIds, idempotencyKey, intent, async (tx, element, operationId, now) => {
      const result = await change(tx, actor.id, element, operationId, now);
      const summary = await personalSummary(tx, actor.id, businessDateToDatabaseDate(getBusinessDate(now)));
      const response: ArcadeMutation = { ...summary, ...result, operationId, alreadyProcessed: false };
      if (result.session.result?.operationId === operationId) await tx.businessOperation.update({ where: { id: operationId }, data: { operationType: 'arcade.finish' } });
      return { response, sessionId: result.session.id };
    });
  }
  async opponents(identity: AuthenticatedIdentity, friendsOnly: boolean) { return this.invitations.opponents((await this.actor(identity)).id, friendsOnly); }
  async invite(identity: AuthenticatedIdentity, input: ArcadeInviteInput) { return this.invitations.invite((await this.actor(identity)).id, input); }
  async actInvitation(identity: AuthenticatedIdentity, id: string, input: ArcadeInviteAction) { return this.invitations.act((await this.actor(identity)).id, id, input); }
  start(identity: AuthenticatedIdentity, input: ArcadeStart) {
    const seed = this.seed();
    return this.mutate(identity, input.idempotencyKey, { action: 'START', game: input.game, difficulty: input.difficulty, expectedVersion: input.expectedVersion, previousSessionId: input.previousSessionId }, async (tx, playerId, _element, _operation, now) => {
      const latest = await tx.arcadeSession.findFirst({ where: { ...participantWhere(playerId), game: input.game }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (await arcadeBusy(tx, playerId)) throw conflict('Une partie Arcade est déjà en cours.', 'ARCADE_ACTIVE_EXISTS');
      if ((latest?.id ?? null) !== input.previousSessionId || input.expectedVersion !== 0) throw conflict('Actualisez Arcade avant de commencer.', 'ARCADE_STALE_VERSION');
      const row = await createArcadeSession(tx, playerId, input.game, input.difficulty, seed, now);
      return { session: projectSession(row), award: null };
    });
  }
  async act(identity: AuthenticatedIdentity, id: string, input: ArcadeAction) {
    const actor = await this.actor(identity);
    const candidate = await this.database.arcadeSession.findFirst({ where: { id, ...participantWhere(actor.id) }, select: { playerId: true, opponentPlayerId: true } });
    const intent = { action: input.kind, sessionId: id, expectedVersion: input.expectedVersion, position: input.kind === 'MOVE' ? input.position : null };
    return this.mutate(identity, input.idempotencyKey, intent, async (tx, playerId, element, operationId, now) => {
      const row = await tx.arcadeSession.findFirst({ where: { id, ...participantWhere(playerId) }, include: arcadeParticipants });
      if (!row) throw new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND');
      const multiplayer = row.mode === 'MULTIPLAYER';
      const viewerSide = playerId === row.playerId ? 'PLAYER' : 'AI';
      if (multiplayer && input.kind !== 'QUIT' && !await validArcadePair(tx, row.playerId, row.opponentPlayerId!)) throw new AppError('Cette partie est indisponible.', 403, 'ARCADE_UNAVAILABLE');
      if (row.version !== input.expectedVersion) throw conflict('Un autre coup a déjà été joué. Actualisez la partie.', 'ARCADE_STALE_VERSION');
      if (row.status !== 'ACTIVE') throw conflict('Cette partie est terminée.', 'ARCADE_FINISHED');
      // Abandonment is not a natural finish: no finalization, grant or domain side effect.
      if (input.kind === 'QUIT') {
        const abandoned = await tx.arcadeSession.update({ where: { id }, data: { status: 'ABANDONED', finishedAt: now, updatedAt: now, version: { increment: 1 } }, include: arcadeParticipants });
        return { session: projectSession(abandoned, playerId), award: null };
      }
      if (now < row.nextActionAt) throw conflict('Le coup précédent est encore affiché.', 'ARCADE_TOO_EARLY');
      let state = row.privateState as unknown as ArcadeState;
      const old = state;
      const random = new ArcadeRandom(Number(row.randomState));
      const difficulty = row.difficulty as ArcadeDifficulty;
      try {
        if (input.kind === 'MOVE') {
          if (state.turn !== viewerSide) throw new RangeError('Not player turn');
          state = state.kind === 'MEMORY' ? revealMemory(state, input.position, difficulty) : playLineMove(state, input.position);
        } else if (state.kind === 'MEMORY' && state.phase === 'REVEAL') state = concealMemory(state);
        else {
          if (multiplayer) throw new RangeError('No AI in multiplayer');
          if (state.turn !== 'AI') throw new RangeError('Not AI turn');
          state = state.kind === 'MEMORY' ? revealMemory(state, chooseMemoryCard(memoryAiView(state), difficulty, random), difficulty)
            : playLineMove(state, chooseLineMove(state, difficulty, random).move);
        }
      } catch (error) { if (error instanceof RangeError) throw new AppError('Ce coup est impossible dans la partie courante.', 400, 'ARCADE_ILLEGAL_MOVE'); throw error; }
      let event: BanterEvent | null = state.outcome;
      if (!event && state.kind === 'MEMORY' && old.kind === 'MEMORY') {
        if (state.playerPairs > old.playerPairs) event = 'PLAYER_PAIR'; else if (state.aiPairs > old.aiPairs) event = 'PAIR';
        else if (state.phase === 'REVEAL' && old.phase !== 'REVEAL') event = 'MISS';
      } else if (!event && state.kind !== 'MEMORY') {
        const board = state;
        event = legalLineMoves(board).some(move => playLineMove(board, move).winningCells.length > 0) ? 'THREAT'
          : board.cells.filter(Boolean).length > (board.kind === 'CONNECT_FOUR' ? 28 : 5) ? 'CLOSE' : 'MOVE';
      }
      const final = state.outcome ? await finalizeArcade(tx, row, state, operationId, element, now, random, this.xp) : null;
      const updated = await tx.arcadeSession.update({ where: { id }, data: { privateState: json(state), randomState: BigInt(random.state),
        version: { increment: 1 }, updatedAt: now, nextActionAt: new Date(now.getTime() + (state.kind === 'MEMORY' && (state.phase === 'REVEAL' || (!multiplayer && state.turn === 'AI')) ? multiplayer ? 500 : 700 : !multiplayer && state.turn === 'AI' ? 350 : 120)),
        banterId: !multiplayer && event ? banterId(event, row.version + 1, row.banterId) : row.banterId, ...final?.terminal }, include: arcadeParticipants });
      return { session: projectSession(updated, playerId), award: final?.award ?? null };
    }, candidate ? [candidate.playerId, ...(candidate.opponentPlayerId ? [candidate.opponentPlayerId] : [])] : []);
  }
}
