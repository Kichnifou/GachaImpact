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

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

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

async function readPlayerTeams(client: DatabaseClient, playerId: string): Promise<PlayerTeams> {
  await client.teamMember.deleteMany({
    where: { team: { playerId }, character: { isActive: false } },
  });
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

async function lockPlayerTeams(transaction: Prisma.TransactionClient, playerId: string): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM teams WHERE player_id = ${playerId}::uuid ORDER BY display_position FOR UPDATE`;
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
