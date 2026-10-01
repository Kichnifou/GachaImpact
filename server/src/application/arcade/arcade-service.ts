import { randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { PrismaPlayerXpService } from '../../infrastructure/database/prisma-player-xp-service.js';
import { businessDateToDatabaseDate, getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { type ElementKey, elementKeys } from '../../domain/economy/resources.js';
import { ArcadeRandom, arcadeGames, type ArcadeGame, type ArcadeDifficulty, type ArcadeState } from '../../domain/arcade/types.js';
import { createMemory, revealMemory, concealMemory, memoryAiView } from '../../domain/arcade/memory.js';
import { chooseMemoryCard } from '../../domain/arcade/memory-ai.js';
import { createLineGame, legalLineMoves, playLineMove } from '../../domain/arcade/line-games.js';
import { chooseLineMove } from '../../domain/arcade/line-ai.js';
import { ARCADE_RULES_VERSION, ARCADE_SCORING_VERSION } from '../../domain/arcade/points.js';
import { banterId, type BanterEvent } from '../../domain/arcade/banter.js';
import { personalSummary, projectSession } from './arcade-projection.js';
import { finalizeArcade } from './arcade-finalization.js';

export type ArcadeStart = { game: ArcadeGame; difficulty: ArcadeDifficulty; expectedVersion: 0; previousSessionId: string | null; idempotencyKey: string };
export type ArcadeAction = { expectedVersion: number; idempotencyKey: string } & ({ kind: 'MOVE'; position: number } | { kind: 'ADVANCE' });
export type ArcadeMutation = Awaited<ReturnType<typeof personalSummary>> & { session: ReturnType<typeof projectSession>; operationId: string; alreadyProcessed: boolean; award: Awaited<ReturnType<typeof finalizeArcade>>['award'] };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const conflict = (message: string, code = 'ARCADE_CONFLICT') => new AppError(message, 409, code);

export class ArcadeService {
  constructor(private readonly database: PrismaClient, private readonly getPlayer: GetCurrentPlayer, private readonly clock: Clock,
    private readonly xp = new PrismaPlayerXpService(), private readonly seed = () => randomBytes(4).readUInt32LE()) {}

  async actor(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (player.status !== 'ACTIVE' || !player.elementKey) throw new AppError('Arcade demande un profil actif avec un élément.', 403, 'ARCADE_UNAVAILABLE');
    return player;
  }
  async overview(identity: AuthenticatedIdentity) {
    const player = await this.actor(identity);
    return this.database.$transaction(async tx => {
      const summary = await personalSummary(tx, player.id, businessDateToDatabaseDate(getBusinessDate(this.clock.now())));
      const sessions = await Promise.all(arcadeGames.map(game => tx.arcadeSession.findFirst({ where: { playerId: player.id, game }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })));
      return { ...summary, sessions: sessions.filter(row => row !== null).map(projectSession), serverNow: this.clock.now().toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async session(identity: AuthenticatedIdentity, id: string) {
    const player = await this.actor(identity);
    const row = await this.database.arcadeSession.findFirst({ where: { id, playerId: player.id } });
    if (!row) throw new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND');
    return projectSession(row);
  }
  private async mutate(identity: AuthenticatedIdentity, idempotencyKey: string, intent: unknown,
    change: (tx: Prisma.TransactionClient, playerId: string, elementKey: ElementKey, operationId: string, now: Date) => Promise<{ session: ReturnType<typeof projectSession>; award: ArcadeMutation['award'] }>): Promise<ArcadeMutation> {
    const actor = await this.actor(identity);
    const fingerprint = JSON.stringify(intent);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          // Same owner/lock order as progression/economy mutations: Player, then XP and balances.
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${actor.id}::uuid FOR UPDATE`;
          const player = await tx.player.findUniqueOrThrow({ where: { id: actor.id } });
          if (player.status !== 'ACTIVE' || !elementKeys.includes(player.elementKey as ElementKey)) throw new AppError('Profil indisponible.', 403, 'ARCADE_UNAVAILABLE');
          const old = await tx.arcadeReceipt.findUnique({ where: { playerId_idempotencyKey: { playerId: actor.id, idempotencyKey } } });
          if (old) {
            if (old.fingerprint !== fingerprint) throw conflict('Cette clé appartient à un autre coup.', 'ARCADE_IDEMPOTENCY_CONFLICT');
            return { ...(old.response as unknown as ArcadeMutation), alreadyProcessed: true };
          }
          if (await tx.businessOperation.findFirst({ where: { sourceChannel: 'UI', idempotencyKey } })) throw conflict('Clé déjà utilisée.', 'ARCADE_IDEMPOTENCY_CONFLICT');
          const now = this.clock.now();
          const operation = await tx.businessOperation.create({ data: { playerId: actor.id, sourceChannel: 'UI', operationType: 'arcade.action', idempotencyKey, startedAt: now } });
          const result = await change(tx, actor.id, player.elementKey as ElementKey, operation.id, now);
          const summary = await personalSummary(tx, actor.id, businessDateToDatabaseDate(getBusinessDate(now)));
          const response: ArcadeMutation = { ...summary, ...result, operationId: operation.id, alreadyProcessed: false };
          await tx.arcadeReceipt.create({ data: { playerId: actor.id, sessionId: result.session.id, idempotencyKey, fingerprint, operationId: operation.id, response: json(response), createdAt: now } });
          await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now,
            operationType: result.session.result?.operationId === operation.id ? 'arcade.finish' : 'arcade.action',
            resultSummary: { sessionId: result.session.id, version: result.session.version, game: result.session.game } } });
          return response;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
      } catch (error) { if (attempt < 3 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
    throw new Error('Arcade transaction retries exhausted');
  }
  start(identity: AuthenticatedIdentity, input: ArcadeStart) {
    const seed = this.seed();
    return this.mutate(identity, input.idempotencyKey, { action: 'START', game: input.game, difficulty: input.difficulty, expectedVersion: input.expectedVersion, previousSessionId: input.previousSessionId }, async (tx, playerId, _element, _operation, now) => {
      const latest = await tx.arcadeSession.findFirst({ where: { playerId, game: input.game }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (latest?.status === 'ACTIVE') throw conflict('Une partie est déjà en cours. Reprenez-la.', 'ARCADE_ACTIVE_EXISTS');
      if ((latest?.id ?? null) !== input.previousSessionId || input.expectedVersion !== 0) throw conflict('Actualisez Arcade avant de commencer.', 'ARCADE_STALE_VERSION');
      const random = new ArcadeRandom(seed);
      const first = random.nextInt(2) ? 'AI' : 'PLAYER';
      let state: ArcadeState;
      if (input.game === 'MEMORY') {
        const characters = await tx.character.findMany({ where: { isActive: true, OR: [{ iconPath: { not: null } }, { fullbodyPath: { not: null } }, { wishPath: { not: null } }, { splashPath: { not: null } }] },
          select: { id: true, name: true, elementKey: true, iconPath: true, fullbodyPath: true, wishPath: true, splashPath: true }, orderBy: { id: 'asc' } });
        const faces = characters.map(row => ({ id: row.id, name: row.name, elementKey: row.elementKey, assetPaths: [row.iconPath, row.fullbodyPath, row.wishPath, row.splashPath] }));
        if (faces.length < 18) throw new AppError('Memory indisponible : dix-huit portraits sont nécessaires.', 503, 'ARCADE_PORTRAITS_UNAVAILABLE');
        state = createMemory(faces, first, random);
      } else state = createLineGame(input.game, first);
      const row = await tx.arcadeSession.create({ data: { playerId, game: input.game, difficulty: input.difficulty, firstSide: first,
        privateState: json(state), randomState: BigInt(random.state), rulesVersion: ARCADE_RULES_VERSION, scoringVersion: ARCADE_SCORING_VERSION,
        banterId: banterId('START', 0), nextActionAt: now, createdAt: now, updatedAt: now } });
      return { session: projectSession(row), award: null };
    });
  }
  act(identity: AuthenticatedIdentity, id: string, input: ArcadeAction) {
    const intent = { action: input.kind, sessionId: id, expectedVersion: input.expectedVersion, position: input.kind === 'MOVE' ? input.position : null };
    return this.mutate(identity, input.idempotencyKey, intent, async (tx, playerId, element, operationId, now) => {
      const row = await tx.arcadeSession.findFirst({ where: { id, playerId } });
      if (!row) throw new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND');
      if (row.version !== input.expectedVersion) throw conflict('Un autre coup a déjà été joué. Actualisez la partie.', 'ARCADE_STALE_VERSION');
      if (row.status !== 'ACTIVE') throw conflict('Cette partie est terminée.', 'ARCADE_FINISHED');
      if (now < row.nextActionAt) throw conflict('Le coup précédent est encore affiché.', 'ARCADE_TOO_EARLY');
      let state = row.privateState as unknown as ArcadeState;
      const old = state;
      const random = new ArcadeRandom(Number(row.randomState));
      const difficulty = row.difficulty as ArcadeDifficulty;
      try {
        if (input.kind === 'MOVE') {
          if (state.turn !== 'PLAYER') throw new RangeError('Not player turn');
          state = state.kind === 'MEMORY' ? revealMemory(state, input.position, difficulty) : playLineMove(state, input.position);
        } else if (state.kind === 'MEMORY' && state.phase === 'REVEAL') state = concealMemory(state);
        else {
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
        version: { increment: 1 }, updatedAt: now, nextActionAt: new Date(now.getTime() + (state.kind === 'MEMORY' && (state.phase === 'REVEAL' || state.turn === 'AI') ? 700 : state.turn === 'AI' ? 350 : 120)),
        banterId: event ? banterId(event, row.version + 1, row.banterId) : row.banterId, ...final?.terminal } });
      return { session: projectSession(updated), award: final?.award ?? null };
    });
  }
}
