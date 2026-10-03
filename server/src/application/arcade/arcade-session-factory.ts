import type { Prisma } from '../../../generated/prisma/client.js';
import { ArcadeRandom, type ArcadeGame, type ArcadeDifficulty, type ArcadeState } from '../../domain/arcade/types.js';
import { createMemory, memoryLayout } from '../../domain/arcade/memory.js';
import { createLineGame } from '../../domain/arcade/line-games.js';
import { ARCADE_RULES_VERSION, ARCADE_SCORING_VERSION } from '../../domain/arcade/points.js';
import { banterId } from '../../domain/arcade/banter.js';
import { AppError } from '../../api/errors.js';
import { arcadeJson } from './arcade-transaction.js';

export const arcadeParticipants = { player: { select: { id: true, displayName: true } }, opponent: { select: { id: true, displayName: true } } } as const;
export async function createArcadeSession(tx: Prisma.TransactionClient, playerId: string, game: ArcadeGame, difficulty: ArcadeDifficulty, seed: number, now: Date, opponentPlayerId: string | null = null) {
  const random = new ArcadeRandom(seed);
  const first = random.nextInt(2) ? 'AI' : 'PLAYER';
  let state: ArcadeState;
  if (game === 'MEMORY') {
    const characters = await tx.character.findMany({ where: { isActive: true, OR: [{ iconPath: { not: null } }, { fullbodyPath: { not: null } }, { wishPath: { not: null } }, { splashPath: { not: null } }] },
      select: { id: true, name: true, elementKey: true, iconPath: true, fullbodyPath: true, wishPath: true, splashPath: true }, orderBy: { id: 'asc' } });
    const faces = characters.map(row => ({ id: row.id, name: row.name, elementKey: row.elementKey, assetPaths: [row.iconPath, row.fullbodyPath, row.wishPath, row.splashPath] }));
    const required = memoryLayout(difficulty, ARCADE_RULES_VERSION).totalPairs;
    if (faces.length < required) throw new AppError(`Memory indisponible : ${required} portraits sont nécessaires.`, 503, 'ARCADE_PORTRAITS_UNAVAILABLE');
    state = createMemory(faces, first, random, difficulty, ARCADE_RULES_VERSION);
  } else state = createLineGame(game, first);
  return tx.arcadeSession.create({ data: { playerId, opponentPlayerId, mode: opponentPlayerId ? 'MULTIPLAYER' : 'SOLO', game, difficulty, firstSide: first,
    privateState: arcadeJson(state), randomState: BigInt(random.state), rulesVersion: ARCADE_RULES_VERSION, scoringVersion: ARCADE_SCORING_VERSION,
    banterId: banterId('START', 0), nextActionAt: now, createdAt: now, updatedAt: now }, include: arcadeParticipants });
}
