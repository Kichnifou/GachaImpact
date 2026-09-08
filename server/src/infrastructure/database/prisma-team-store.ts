import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import type { PlayerTeams, TeamCharacter, TeamStore } from '../../application/team/team-store.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { deriveTeamPassives, listTeamPassiveDefinitions } from '../../domain/team/team-passives.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';

const BASE_TEAM_COUNT = 10;
const MAX_TEAM_ATTEMPTS = 3;
const SLOT_POSITIONS = [1, 2, 3, 4] as const;

const possessionSelection = {
  constellation: true,
  character: {
    select: {
      id: true, externalKey: true, name: true, rarity: true, elementKey: true,
      classKey: true, weaponType: true, region: true, iconPath: true, splashPath: true,
      wishPath: true, fullbodyPath: true,
    },
  },
} satisfies Prisma.PlayerCharacterSelect;

const teamSelection = {
  id: true,
  displayPosition: true,
  name: true,
  isActive: true,
  members: { select: { position: true, characterId: true }, orderBy: { position: 'asc' as const } },
} satisfies Prisma.TeamSelect;

export class PrismaTeamStore implements TeamStore {
  public constructor(private readonly database: PrismaClient) {}

  public getOrProvision(playerId: string): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      await provisionBaseTeams(transaction, playerId);
      return readPlayerTeams(transaction, playerId);
    });
  }

  public activate(playerId: string, teamId: string): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      const team = await lockOwnedTeam(transaction, playerId, teamId);
      if (!team.isActive) {
        await transaction.team.updateMany({ where: { playerId, isActive: true }, data: { isActive: false } });
        await transaction.team.update({ where: { id: teamId }, data: { isActive: true } });
      }
      return readPlayerTeams(transaction, playerId);
    });
  }

  public rename(playerId: string, teamId: string, name: string | null): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      await lockOwnedTeam(transaction, playerId, teamId);
      await transaction.team.update({ where: { id: teamId }, data: { name } });
      return readPlayerTeams(transaction, playerId);
    });
  }

  public createNext(playerId: string, expectedPosition: number): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      await provisionBaseTeams(transaction, playerId);
      const teams = await lockPlayerTeams(transaction, playerId);
      if (teams.some(({ displayPosition }) => displayPosition === expectedPosition)) {
        return readPlayerTeams(transaction, playerId);
      }
      const nextPosition = (teams.at(-1)?.displayPosition ?? 0) + 1;
      if (expectedPosition !== nextPosition) {
        throw new BusinessError('TEAM_CREATE_POSITION_INVALID', `La prochaine Team disponible est la Team ${nextPosition}.`);
      }
      await transaction.team.create({ data: { playerId, displayPosition: expectedPosition, isBaseSlot: false } });
      return readPlayerTeams(transaction, playerId);
    });
  }

  public deleteExtra(playerId: string, teamId: string): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      const teams = await lockPlayerTeams(transaction, playerId);
      const team = teams.find(({ id }) => id === teamId);
      if (!team) throw new BusinessError('TEAM_NOT_FOUND', 'Cette équipe est introuvable.');
      if (team.displayPosition <= BASE_TEAM_COUNT) {
        throw new BusinessError('TEAM_DELETE_PROTECTED', 'Les Teams 1 à 10 ne peuvent pas être supprimées.');
      }
      if (team.isActive) throw new BusinessError('TEAM_DELETE_ACTIVE', 'Activez une autre Team avant de supprimer celle-ci.');
      await transaction.team.delete({ where: { id: teamId } });
      await rewriteTeamPositions(transaction, playerId, teams.filter(({ id }) => id !== teamId).map(({ id }) => id));
      return readPlayerTeams(transaction, playerId);
    });
  }

  public reorderTeams(playerId: string, teamIds: readonly string[]): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      const teams = await lockPlayerTeams(transaction, playerId);
      if (!isExactIdOrder(teamIds, teams.map(({ id }) => id))) {
        throw new BusinessError('TEAM_ORDER_INVALID', 'L’ordre transmis doit contenir exactement toutes vos Teams une seule fois.');
      }
      await rewriteTeamPositions(transaction, playerId, teamIds);
      return readPlayerTeams(transaction, playerId);
    });
  }

  public setSlot(playerId: string, teamId: string, position: number, characterId: string): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      await lockOwnedTeam(transaction, playerId, teamId);
      await lockPlayerTeams(transaction, playerId);

      const possession = await transaction.playerCharacter.findUnique({
        where: { playerId_characterId: { playerId, characterId } },
        select: { character: { select: { isActive: true } } },
      });
      if (!possession?.character.isActive) {
        throw new BusinessError('TEAM_CHARACTER_NOT_AVAILABLE', 'Ce personnage actif ne fait pas partie de votre Box.');
      }

      const duplicate = await transaction.teamMember.findFirst({
        where: { teamId, characterId, position: { not: position } },
        select: { position: true },
      });
      if (duplicate) {
        throw new BusinessError('TEAM_CHARACTER_DUPLICATE', 'Ce personnage est déjà présent dans cette équipe.');
      }

      await transaction.teamMember.upsert({
        where: { teamId_position: { teamId, position } },
        create: { teamId, position, characterId },
        update: { characterId },
      });
      await assertUniqueCompleteComposition(transaction, playerId, teamId);
      return readPlayerTeams(transaction, playerId);
    });
  }

  public reorderSlots(playerId: string, teamId: string, characterIds: readonly (string | null)[]): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      await lockOwnedTeam(transaction, playerId, teamId);
      await lockPlayerTeams(transaction, playerId);
      const compactIds = characterIds.filter((id): id is string => id !== null);
      const existing = await transaction.teamMember.findMany({ where: { teamId }, select: { characterId: true } });
      if (!isExactIdOrder(compactIds, existing.map(({ characterId }) => characterId))) {
        throw new BusinessError('TEAM_SLOT_ORDER_INVALID', 'La réorganisation doit conserver exactement les personnages de cette Team.');
      }
      await transaction.teamMember.deleteMany({ where: { teamId } });
      if (compactIds.length > 0) {
        await transaction.teamMember.createMany({
          data: characterIds.flatMap((characterId, index) => characterId ? [{ teamId, position: index + 1, characterId }] : []),
        });
      }
      return readPlayerTeams(transaction, playerId);
    });
  }

  public removeSlot(playerId: string, teamId: string, position: number): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      await lockOwnedTeam(transaction, playerId, teamId);
      await transaction.teamMember.deleteMany({ where: { teamId, position } });
      return readPlayerTeams(transaction, playerId);
    });
  }

  public clear(playerId: string, teamId: string): Promise<PlayerTeams> {
    return runTeamTransaction(this.database, async (transaction) => {
      await lockPlayer(transaction, playerId);
      await lockOwnedTeam(transaction, playerId, teamId);
      await transaction.teamMember.deleteMany({ where: { teamId } });
      return readPlayerTeams(transaction, playerId);
    });
  }
}

async function runTeamTransaction<T>(database: PrismaClient, operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TEAM_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isPrismaConcurrencyCollision(error) || attempt === MAX_TEAM_ATTEMPTS) throw error;
    }
  }
  throw new Error('Team operation exhausted all retry attempts.');
}

async function provisionBaseTeams(transaction: Prisma.TransactionClient, playerId: string): Promise<void> {
  const existing = await transaction.team.findMany({
    where: { playerId }, select: { displayPosition: true, isActive: true }, orderBy: { displayPosition: 'asc' },
  });
  const positions = new Set(existing.map(({ displayPosition }) => displayPosition));
  const missing = Array.from({ length: BASE_TEAM_COUNT }, (_, index) => index + 1).filter((position) => !positions.has(position));
  if (missing.length > 0) {
    await transaction.team.createMany({
      data: missing.map((displayPosition) => ({ playerId, displayPosition, isBaseSlot: true, isActive: false })),
      skipDuplicates: true,
    });
  }
  if (!existing.some(({ isActive }) => isActive)) {
    await transaction.team.update({
      where: { playerId_displayPosition: { playerId, displayPosition: 1 } },
      data: { isActive: true },
    });
  }
}

async function readPlayerTeams(client: Prisma.TransactionClient, playerId: string): Promise<PlayerTeams> {
  await cleanupInactiveTeamMembers(client, playerId);
  const [teamRows, possessionRows] = await Promise.all([
    client.team.findMany({ where: { playerId }, select: teamSelection, orderBy: { displayPosition: 'asc' } }),
    client.playerCharacter.findMany({
      where: { playerId, character: { isActive: true } },
      select: possessionSelection,
      orderBy: [{ character: { rarity: 'desc' } }, { character: { name: 'asc' } }],
    }),
  ]);
  const availableCharacters = possessionRows.map(toTeamCharacter);
  const charactersById = new Map(availableCharacters.map((character) => [character.id, character]));
  return {
    teams: teamRows.map((team) => {
      const members = new Map(team.members.map((member) => [member.position, charactersById.get(member.characterId) ?? null]));
      const slots = SLOT_POSITIONS.map((position) => ({ position, character: members.get(position) ?? null }));
      return {
        id: team.id,
        position: team.displayPosition,
        name: team.name,
        active: team.isActive,
        slots,
        passives: deriveTeamPassives(slots.flatMap(({ character }) => character ? [character.elementKey] : [])),
      };
    }),
    availableCharacters,
    passiveReference: listTeamPassiveDefinitions(),
  };
}

async function cleanupInactiveTeamMembers(transaction: Prisma.TransactionClient, playerId: string): Promise<void> {
  const affectedTeams = await transaction.team.findMany({
    where: { playerId, members: { some: { character: { isActive: false } } } },
    select: { id: true, displayPosition: true, isActive: true },
    orderBy: { displayPosition: 'asc' },
  });
  if (affectedTeams.length === 0) return;

  const activeTeamIds = affectedTeams.filter(({ isActive }) => isActive).map(({ id }) => id);
  const baseInactiveTeamIds = affectedTeams
    .filter(({ isActive, displayPosition }) => !isActive && displayPosition <= BASE_TEAM_COUNT)
    .map(({ id }) => id);
  const extraInactiveTeamIds = affectedTeams
    .filter(({ isActive, displayPosition }) => !isActive && displayPosition > BASE_TEAM_COUNT)
    .map(({ id }) => id);

  if (activeTeamIds.length > 0) {
    await transaction.teamMember.deleteMany({
      where: { teamId: { in: activeTeamIds }, character: { isActive: false } },
    });
  }
  if (baseInactiveTeamIds.length > 0) {
    await transaction.teamMember.deleteMany({ where: { teamId: { in: baseInactiveTeamIds } } });
  }
  if (extraInactiveTeamIds.length > 0) {
    await transaction.team.deleteMany({ where: { id: { in: extraInactiveTeamIds }, playerId } });
    const survivingTeams = await transaction.team.findMany({
      where: { playerId }, select: { id: true }, orderBy: { displayPosition: 'asc' },
    });
    await rewriteTeamPositions(transaction, playerId, survivingTeams.map(({ id }) => id));
  }
}

function toTeamCharacter(row: Prisma.PlayerCharacterGetPayload<{ select: typeof possessionSelection }>): TeamCharacter {
  if ((row.character.rarity !== 4 && row.character.rarity !== 5) || !isElementKey(row.character.elementKey)) {
    throw new Error(`Invalid active character catalog entry ${row.character.id}.`);
  }
  return { ...row.character, rarity: row.character.rarity, elementKey: row.character.elementKey, constellation: row.constellation };
}

async function lockPlayer(transaction: Prisma.TransactionClient, playerId: string): Promise<void> {
  const rows = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
  if (!rows[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');
}

async function lockOwnedTeam(transaction: Prisma.TransactionClient, playerId: string, teamId: string): Promise<{ isActive: boolean }> {
  const rows = await transaction.$queryRaw<{ isActive: boolean }[]>`
    SELECT is_active AS "isActive" FROM teams WHERE id = ${teamId}::uuid AND player_id = ${playerId}::uuid FOR UPDATE
  `;
  if (!rows[0]) throw new BusinessError('TEAM_NOT_FOUND', 'Cette équipe est introuvable.');
  return rows[0];
}

async function lockPlayerTeams(transaction: Prisma.TransactionClient, playerId: string): Promise<{ id: string; displayPosition: number; isActive: boolean }[]> {
  return transaction.$queryRaw`
    SELECT id, display_position AS "displayPosition", is_active AS "isActive"
    FROM teams WHERE player_id = ${playerId}::uuid ORDER BY display_position FOR UPDATE
  `;
}

async function rewriteTeamPositions(transaction: Prisma.TransactionClient, playerId: string, orderedIds: readonly string[]): Promise<void> {
  await transaction.team.updateMany({ where: { playerId }, data: { displayPosition: { increment: 1_000_000 } } });
  for (const [index, id] of orderedIds.entries()) {
    await transaction.team.update({ where: { id }, data: { displayPosition: index + 1 } });
  }
}

function isExactIdOrder(candidate: readonly string[], expected: readonly string[]): boolean {
  return candidate.length === expected.length
    && new Set(candidate).size === candidate.length
    && candidate.every((id) => expected.includes(id));
}

async function assertUniqueCompleteComposition(transaction: Prisma.TransactionClient, playerId: string, teamId: string): Promise<void> {
  const members = await transaction.teamMember.findMany({
    where: { team: { playerId } }, select: { teamId: true, characterId: true }, orderBy: [{ teamId: 'asc' }, { characterId: 'asc' }],
  });
  const compositions = new Map<string, string[]>();
  for (const member of members) compositions.set(member.teamId, [...(compositions.get(member.teamId) ?? []), member.characterId]);
  const target = compositions.get(teamId);
  if (target?.length !== 4) return;
  const signature = [...target].sort().join(':');
  const duplicate = [...compositions].some(([otherTeamId, characters]) => otherTeamId !== teamId && characters.length === 4 && [...characters].sort().join(':') === signature);
  if (duplicate) throw new BusinessError('TEAM_COMPOSITION_DUPLICATE', 'Cette composition complète existe déjà dans une autre équipe.');
}
