import { CombatAttemptMode, OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import type { DailyCombatCharacter, DailyCombatContext, DailyCombatRandoms, DailyCombatStore, DailyCombatView } from '../../application/combat/daily-combat-store.js';
import { calculateDailyCombatPreview, DAILY_COMBAT_REWARD } from '../../domain/combat/daily-combat.js';
import { isElementKey, resourceKeys, type ElementKey } from '../../domain/economy/resources.js';
import { businessDateToDatabaseDate, databaseDateToBusinessDate } from '../../domain/time/business-date.js';
import type { PlayerResourceBalances } from '../../application/player/player-resource-store.js';
import { PrismaEconomyService } from './prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';

const MAX_ATTEMPTS = 4;

const possessionSelection = {
  characterId: true, constellation: true, copies: true, firstObtainedAt: true, favorite: true,
  character: { select: {
    id: true, externalKey: true, name: true, rarity: true, elementKey: true, weaponType: true, region: true,
    iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true, displayOrder: true, isActive: true,
  } },
} satisfies Prisma.PlayerCharacterSelect;

type Possession = Prisma.PlayerCharacterGetPayload<{ select: typeof possessionSelection }>;
type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaDailyCombatStore implements DailyCombatStore {
  public constructor(
    private readonly database: PrismaClient,
    private readonly randoms: DailyCombatRandoms,
    private readonly economy = new PrismaEconomyService(),
  ) {}

  public async getView(context: DailyCombatContext): Promise<DailyCombatView> {
    const encounterId = await this.ensureEncounter(context.businessDate);
    await this.clearInactiveSlots(context.playerId);
    return readView(this.database, context.playerId, context.businessDate, encounterId);
  }

  public async setSlot(context: DailyCombatContext & { position: number; characterId: string }): Promise<DailyCombatView> {
    if (!Number.isInteger(context.position) || context.position < 1 || context.position > 4) throw new BusinessError('DAILY_COMBAT_POSITION_INVALID', 'Cet emplacement de Combat est invalide.');
    const encounterId = await this.ensureEncounter(context.businessDate);
    await this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, context.playerId);
      const possession = await transaction.playerCharacter.findUnique({ where: { playerId_characterId: { playerId: context.playerId, characterId: context.characterId } }, select: possessionSelection });
      if (!possession) throw new BusinessError('DAILY_COMBAT_CHARACTER_NOT_OWNED', 'Ce personnage ne fait pas partie de votre Box.');
      if (!possession.character.isActive) throw new BusinessError('DAILY_COMBAT_CHARACTER_INACTIVE', 'Ce personnage n’est plus disponible.');
      if (await isKo(transaction, context.playerId, encounterId, context.characterId)) throw new BusinessError('DAILY_COMBAT_CHARACTER_KO', 'Un personnage sélectionné est KO jusqu’à demain.');
      const duplicate = await transaction.playerDailyCombatLoadoutSlot.findFirst({ where: { playerId: context.playerId, characterId: context.characterId, position: { not: context.position } } });
      if (duplicate) throw new BusinessError('DAILY_COMBAT_CHARACTER_DUPLICATE', 'Ce personnage est déjà sélectionné.');
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerDailyCombatLoadoutSlot.upsert({
        where: { playerId_position: { playerId: context.playerId, position: context.position } },
        create: { playerId: context.playerId, position: context.position, characterId: context.characterId },
        update: { characterId: context.characterId },
      });
      await transaction.playerDailyCombatLoadout.update({ where: { playerId: context.playerId }, data: { nextAttemptMode: CombatAttemptMode.MANUAL } });
    });
    return readView(this.database, context.playerId, context.businessDate, encounterId);
  }

  public async copyActiveTeam(context: DailyCombatContext): Promise<DailyCombatView> {
    const encounterId = await this.ensureEncounter(context.businessDate);
    await this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, context.playerId);
      const team = await transaction.team.findFirst({ where: { playerId: context.playerId, isActive: true }, include: { members: { include: { character: true }, orderBy: { position: 'asc' } } } });
      const members = team?.members.filter(({ character }) => character.isActive).slice(0, 4) ?? [];
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerDailyCombatLoadoutSlot.deleteMany({ where: { playerId: context.playerId } });
      if (members.length) await transaction.playerDailyCombatLoadoutSlot.createMany({ data: members.map(({ position, characterId }) => ({ playerId: context.playerId, position, characterId })) });
      await transaction.playerDailyCombatLoadout.update({ where: { playerId: context.playerId }, data: { nextAttemptMode: CombatAttemptMode.MANUAL } });
    });
    return readView(this.database, context.playerId, context.businessDate, encounterId);
  }

  public async removeSlot(context: DailyCombatContext & { position: number }): Promise<DailyCombatView> {
    if (!Number.isInteger(context.position) || context.position < 1 || context.position > 4) throw new BusinessError('DAILY_COMBAT_POSITION_INVALID', 'Cet emplacement de Combat est invalide.');
    const encounterId = await this.ensureEncounter(context.businessDate);
    await this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, context.playerId);
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerDailyCombatLoadoutSlot.deleteMany({ where: { playerId: context.playerId, position: context.position } });
      await transaction.playerDailyCombatLoadout.update({ where: { playerId: context.playerId }, data: { nextAttemptMode: CombatAttemptMode.MANUAL } });
    });
    return readView(this.database, context.playerId, context.businessDate, encounterId);
  }

  public async autoSelect(context: DailyCombatContext): Promise<DailyCombatView> {
    const encounterId = await this.ensureEncounter(context.businessDate);
    await this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, context.playerId);
      const encounter = await loadEncounter(transaction, encounterId);
      const [possessions, kos, matchups] = await Promise.all([
        transaction.playerCharacter.findMany({ where: { playerId: context.playerId, character: { isActive: true } }, select: possessionSelection }),
        transaction.playerDailyCombatKo.findMany({ where: { playerId: context.playerId, encounterId }, select: { characterId: true } }),
        transaction.elementCombatMatchup.findMany(),
      ]);
      const koIds = new Set(kos.map(({ characterId }) => characterId));
      const eligible = possessions.filter(({ characterId }) => !koIds.has(characterId));
      if (eligible.length < 4) throw new BusinessError('DAILY_COMBAT_NOT_ENOUGH_AVAILABLE', 'Vous n’avez plus assez de personnages disponibles aujourd’hui.');
      const relations = relationMap(matchups);
      const enemyElements = encounter.enemies.map(({ elementKeySnapshot }) => elementKey(elementKeySnapshot));
      const ranked = eligible.map((possession) => ({ possession, score: calculateDailyCombatPreview([combatMember(possession)], enemyElements, relations).memberContributions[0]!.halfPoints }))
        .sort((left, right) => right.score - left.score || (left.possession.character.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.possession.character.displayOrder ?? Number.MAX_SAFE_INTEGER) || left.possession.characterId.localeCompare(right.possession.characterId))
        .slice(0, 4);
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerDailyCombatLoadoutSlot.deleteMany({ where: { playerId: context.playerId } });
      await transaction.playerDailyCombatLoadoutSlot.createMany({ data: ranked.map(({ possession }, index) => ({ playerId: context.playerId, position: index + 1, characterId: possession.characterId })) });
      await transaction.playerDailyCombatLoadout.update({ where: { playerId: context.playerId }, data: { nextAttemptMode: CombatAttemptMode.AUTO } });
    });
    return readView(this.database, context.playerId, context.businessDate, encounterId);
  }

  public async clearLoadout(context: DailyCombatContext): Promise<DailyCombatView> {
    const encounterId = await this.ensureEncounter(context.businessDate);
    await this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, context.playerId);
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerDailyCombatLoadoutSlot.deleteMany({ where: { playerId: context.playerId } });
      await transaction.playerDailyCombatLoadout.update({ where: { playerId: context.playerId }, data: { nextAttemptMode: CombatAttemptMode.MANUAL } });
    });
    return readView(this.database, context.playerId, context.businessDate, encounterId);
  }

  public async fight(context: DailyCombatContext & { idempotencyKey: string }) {
    const encounterId = await this.ensureEncounter(context.businessDate);
    const operationKey = `daily-combat.fight:${context.playerId}:${context.idempotencyKey}`;
    let retainedRoll: number | null = null;
    for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber += 1) {
      try {
        const committed = await this.database.$transaction(async (transaction) => {
          await lockPlayer(transaction, context.playerId);
          const existing = await transaction.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey: operationKey } });
          if (existing) {
            if (existing.playerId !== context.playerId || existing.operationType !== 'daily-combat.fight') throw new BusinessError('DAILY_COMBAT_IDEMPOTENCY_CONFLICT', 'Cette tentative ne correspond plus à l’action attendue.');
            if (existing.status !== OperationStatus.COMPLETED) throw new BusinessError('DAILY_COMBAT_IDEMPOTENCY_CONFLICT', 'Cette tentative est encore en cours. Réessayez dans un instant.');
            const prior = await transaction.dailyCombatAttempt.findUniqueOrThrow({ where: { operationId: existing.id } });
            return { operationId: existing.id, alreadyProcessed: true, won: prior.won, mode: prior.mode, chanceHalfPoints: prior.chanceHalfPoints };
          }
          const encounter = await loadEncounter(transaction, encounterId);
          const state = await transaction.playerDailyCombatState.findUnique({ where: { playerId_encounterId: { playerId: context.playerId, encounterId } } });
          if (state?.wonAt) throw new BusinessError('DAILY_COMBAT_ALREADY_COMPLETED', 'Le Combat quotidien est déjà terminé.');
          await transaction.playerDailyCombatLoadoutSlot.deleteMany({ where: { playerId: context.playerId, character: { isActive: false } } });
          const loadout = await transaction.playerDailyCombatLoadout.findUnique({ where: { playerId: context.playerId }, include: { slots: { orderBy: { position: 'asc' } } } });
          if (!loadout || loadout.slots.length !== 4) throw new BusinessError('DAILY_COMBAT_LOADOUT_INCOMPLETE', 'Sélectionnez 4 personnages.');
          const ids = loadout.slots.map(({ characterId }) => characterId);
          if (new Set(ids).size !== 4) throw new BusinessError('DAILY_COMBAT_LOADOUT_INCOMPLETE', 'Sélectionnez 4 personnages.');
          const possessions = await transaction.playerCharacter.findMany({ where: { playerId: context.playerId, characterId: { in: ids }, character: { isActive: true } }, select: possessionSelection });
          if (possessions.length !== 4) throw new BusinessError('DAILY_COMBAT_LOADOUT_INCOMPLETE', 'Sélectionnez 4 personnages.');
          const kos = await transaction.playerDailyCombatKo.findMany({ where: { playerId: context.playerId, encounterId }, select: { characterId: true } });
          const koIds = new Set(kos.map(({ characterId }) => characterId));
          if (ids.some((id) => koIds.has(id))) throw new BusinessError('DAILY_COMBAT_CHARACTER_KO', 'Un personnage sélectionné est KO jusqu’à demain.');
          const availableCount = await transaction.playerCharacter.count({ where: { playerId: context.playerId, character: { isActive: true }, characterId: { notIn: [...koIds] } } });
          if (availableCount < 4) throw new BusinessError('DAILY_COMBAT_NOT_ENOUGH_AVAILABLE', 'Vous n’avez plus assez de personnages disponibles aujourd’hui.');
          const byId = new Map(possessions.map((value) => [value.characterId, value]));
          const ordered = loadout.slots.map(({ characterId }) => byId.get(characterId)!);
          const matchups = await transaction.elementCombatMatchup.findMany();
          const preview = calculateDailyCombatPreview(ordered.map(combatMember), encounter.enemies.map(({ elementKeySnapshot }) => elementKey(elementKeySnapshot)), relationMap(matchups));
          const mode = loadout.nextAttemptMode;
          const roll = retainedRoll ?? (this.randoms.fight.nextInt(200) + 1);
          retainedRoll = roll;
          const won = roll <= preview.finalHalfPoints;
          const operation = await transaction.businessOperation.create({ data: {
            playerId: context.playerId, operationType: 'daily-combat.fight', sourceChannel: SourceChannel.UI, idempotencyKey: operationKey,
            resultSummary: { encounterId, chanceHalfPoints: preview.finalHalfPoints, mode, won, rngRoll: roll },
          }, select: { id: true } });
          const combatAttempt = await transaction.dailyCombatAttempt.create({ data: {
            playerId: context.playerId, encounterId, mode, chanceHalfPoints: preview.finalHalfPoints, won, rngRoll: roll, operationId: operation.id,
            members: { create: ordered.map((possession, index) => ({
              position: index + 1, characterId: possession.characterId, raritySnapshot: possession.character.rarity,
              constellationSnapshot: possession.constellation, elementKeySnapshot: possession.character.elementKey,
              contributionHalfPoints: preview.memberContributions[index]!.halfPoints,
            })) },
          } });
          await transaction.playerCombatStats.upsert({ where: { playerId: context.playerId }, create: {
            playerId: context.playerId, totalFights: 1n, totalWins: won ? 1n : 0n, totalLosses: won ? 0n : 1n,
            totalManualWins: won && mode === CombatAttemptMode.MANUAL ? 1n : 0n,
          }, update: {
            totalFights: { increment: 1n }, totalWins: { increment: won ? 1n : 0n }, totalLosses: { increment: won ? 0n : 1n },
            totalManualWins: { increment: won && mode === CombatAttemptMode.MANUAL ? 1n : 0n },
          } });
          for (const possession of ordered) await transaction.playerCharacterCombatStats.upsert({
            where: { playerId_characterId: { playerId: context.playerId, characterId: possession.characterId } },
            create: { playerId: context.playerId, characterId: possession.characterId, wins: won ? 1n : 0n, losses: won ? 0n : 1n },
            update: { wins: { increment: won ? 1n : 0n }, losses: { increment: won ? 0n : 1n } },
          });
          await transaction.playerDailyCombatState.upsert({ where: { playerId_encounterId: { playerId: context.playerId, encounterId } }, create: {
            playerId: context.playerId, encounterId, wonAt: won ? context.now : null,
          }, update: won ? { wonAt: context.now } : {} });
          if (won) {
            await this.economy.credit(transaction, { playerId: context.playerId, playerElementKey: context.playerElementKey, resourceKey: 'primogems', amount: DAILY_COMBAT_REWARD.primogems, causeKey: 'daily-combat.victory', domainKey: 'daily-combat', operationId: operation.id, sourceChannel: SourceChannel.UI });
            await this.economy.credit(transaction, { playerId: context.playerId, playerElementKey: context.playerElementKey, resourceKey: 'moras', amount: DAILY_COMBAT_REWARD.moras, causeKey: 'daily-combat.victory', domainKey: 'daily-combat', operationId: operation.id, sourceChannel: SourceChannel.UI });
          } else {
            await transaction.playerDailyCombatKo.createMany({ data: ordered.map(({ characterId }) => ({ playerId: context.playerId, encounterId, characterId })), skipDuplicates: true });
          }
          await transaction.playerDailyCombatLoadout.update({ where: { playerId: context.playerId }, data: { nextAttemptMode: CombatAttemptMode.MANUAL } });
          await transaction.businessOperation.update({ where: { id: operation.id }, data: { status: OperationStatus.COMPLETED, completedAt: context.now } });
          return { operationId: operation.id, alreadyProcessed: false, won, mode, chanceHalfPoints: preview.finalHalfPoints, attemptId: combatAttempt.id };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
        const [view, resources] = await Promise.all([readView(this.database, context.playerId, context.businessDate, encounterId), readBalances(this.database, context.playerId)]);
        return { operation: { id: committed.operationId, alreadyProcessed: committed.alreadyProcessed }, result: { won: committed.won, mode: committed.mode, chanceHalfPoints: committed.chanceHalfPoints }, view, resources };
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error) || attemptNumber === MAX_ATTEMPTS) throw error;
      }
    }
    throw new Error('daily-combat.fight exhausted all retry attempts.');
  }

  private async ensureEncounter(businessDate: string): Promise<string> {
    try {
      return await this.database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtext(${`daily-combat:${businessDate}`}))`;
        const date = businessDateToDatabaseDate(businessDate);
        const existing = await transaction.dailyCombatEncounter.findUnique({ where: { businessDate: date }, select: { id: true } });
        if (existing) return existing.id;
        const candidates = await transaction.character.findMany({ where: { isActive: true }, select: { id: true, elementKey: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
        if (candidates.length < 4) throw new BusinessError('DAILY_COMBAT_ENCOUNTER_UNAVAILABLE', 'Le Combat du jour est momentanément indisponible.');
        const pool = [...candidates];
        const selected: typeof candidates = [];
        for (let index = 0; index < 4; index += 1) selected.push(pool.splice(this.randoms.encounter.nextInt(pool.length), 1)[0]!);
        const created = await transaction.dailyCombatEncounter.create({ data: {
          businessDate: date,
          enemies: { create: selected.map((character, index) => ({ position: index + 1, characterId: character.id, elementKeySnapshot: character.elementKey })) },
        }, select: { id: true } });
        return created.id;
      }, { timeout: 20_000 });
    } catch (error) {
      if (error instanceof BusinessError) throw error;
      throw new BusinessError('DAILY_COMBAT_ENCOUNTER_UNAVAILABLE', 'Le Combat du jour est momentanément indisponible.');
    }
  }

  private async clearInactiveSlots(playerId: string): Promise<void> {
    await this.database.playerDailyCombatLoadoutSlot.deleteMany({ where: { playerId, character: { isActive: false } } });
  }
}

async function readView(client: Client, playerId: string, _businessDate: string, encounterId: string): Promise<DailyCombatView> {
  const [encounter, loadout, possessions, koRows, state, lastAttempt, matchups, playerStats, characterStats] = await Promise.all([
    loadEncounter(client, encounterId),
    client.playerDailyCombatLoadout.findUnique({ where: { playerId }, include: { slots: { orderBy: { position: 'asc' } } } }),
    client.playerCharacter.findMany({ where: { playerId, character: { isActive: true } }, select: possessionSelection }),
    client.playerDailyCombatKo.findMany({ where: { playerId, encounterId }, select: { characterId: true }, orderBy: { characterId: 'asc' } }),
    client.playerDailyCombatState.findUnique({ where: { playerId_encounterId: { playerId, encounterId } } }),
    client.dailyCombatAttempt.findFirst({ where: { playerId, encounterId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    client.elementCombatMatchup.findMany(),
    client.playerCombatStats.findUnique({ where: { playerId } }),
    client.playerCharacterCombatStats.findMany({ where: { playerId } }),
  ]);
  const statsByCharacter = new Map(characterStats.map((stats) => [stats.characterId, stats]));
  const characters = possessions.map((possession) => toCharacter(possession, statsByCharacter.get(possession.characterId)));
  const byId = new Map(characters.map((character) => [character.id, character]));
  const koIds = new Set(koRows.map(({ characterId }) => characterId));
  const slots = ([1, 2, 3, 4] as const).map((position) => {
    const row = loadout?.slots.find((slot) => slot.position === position);
    const character = row ? byId.get(row.characterId) ?? null : null;
    return { position, character, ko: Boolean(character && koIds.has(character.id)) };
  });
  const selected = slots.map(({ character }) => character).filter((character): character is DailyCombatCharacter => Boolean(character));
  const complete = selected.length === 4 && new Set(selected.map(({ id }) => id)).size === 4;
  const hasKo = slots.some(({ ko }) => ko);
  const preview = complete && !hasKo ? calculateDailyCombatPreview(selected.map((character) => ({ id: character.id, rarity: character.rarity, constellation: character.constellation, elementKey: character.elementKey })), encounter.enemies.map(({ elementKeySnapshot }) => elementKey(elementKeySnapshot)), relationMap(matchups)) : null;
  const availableCharacterCount = characters.filter(({ id }) => !koIds.has(id)).length;
  const status = state?.wonAt ? 'COMPLETED' : availableCharacterCount < 4 ? 'BLOCKED' : lastAttempt ? 'IN_PROGRESS' : 'TODO';
  return {
    businessDate: databaseDateToBusinessDate(encounter.businessDate), status,
    encounter: { id: encounter.id, enemies: encounter.enemies.map(({ position, character, elementKeySnapshot }) => ({ position: position as 1 | 2 | 3 | 4, character: {
      id: character.id, externalKey: character.externalKey, name: character.name, rarity: rarity(character.rarity), elementKey: elementKey(elementKeySnapshot), weaponType: character.weaponType,
      region: character.region, iconPath: character.iconPath, splashPath: character.splashPath, wishPath: character.wishPath, fullbodyPath: character.fullbodyPath, displayOrder: character.displayOrder,
    } })) },
    loadout: { nextAttemptMode: loadout?.nextAttemptMode ?? CombatAttemptMode.MANUAL, slots },
    availableCharacters: characters,
    koCharacterIds: [...koIds], availableCharacterCount, preview,
    canFight: status !== 'COMPLETED' && availableCharacterCount >= 4 && preview !== null,
    reward: DAILY_COMBAT_REWARD,
    lastAttempt: lastAttempt ? { id: lastAttempt.id, mode: lastAttempt.mode, won: lastAttempt.won, chanceHalfPoints: lastAttempt.chanceHalfPoints, createdAt: lastAttempt.createdAt } : null,
    playerStats: playerStats ? { totalFights: playerStats.totalFights, totalWins: playerStats.totalWins, totalLosses: playerStats.totalLosses, totalManualWins: playerStats.totalManualWins } : { totalFights: 0n, totalWins: 0n, totalLosses: 0n, totalManualWins: 0n },
  };
}

function loadEncounter(client: Client, encounterId: string) {
  return client.dailyCombatEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { enemies: { include: { character: true }, orderBy: { position: 'asc' } } } });
}

function combatMember(possession: Possession) { return { id: possession.characterId, rarity: rarity(possession.character.rarity), constellation: possession.constellation, elementKey: elementKey(possession.character.elementKey) }; }
function toCharacter(possession: Possession, stats?: { wins: bigint; losses: bigint }): DailyCombatCharacter {
  const wins = stats?.wins ?? 0n; const losses = stats?.losses ?? 0n; const fights = wins + losses;
  return {
    id: possession.character.id, externalKey: possession.character.externalKey, name: possession.character.name, rarity: rarity(possession.character.rarity), elementKey: elementKey(possession.character.elementKey),
    weaponType: possession.character.weaponType, region: possession.character.region, iconPath: possession.character.iconPath, splashPath: possession.character.splashPath,
    wishPath: possession.character.wishPath, fullbodyPath: possession.character.fullbodyPath, displayOrder: possession.character.displayOrder,
    constellation: possession.constellation, copies: possession.copies, firstObtainedAt: possession.firstObtainedAt, favorite: possession.favorite,
    combatStats: { fights, wins, losses, winRatePercent: fights === 0n ? 0 : Number(wins * 10_000n / fights) / 100 },
  };
}
function rarity(value: number): 4 | 5 { if (value === 4 || value === 5) return value; throw new Error(`Unsupported character rarity ${value}.`); }
function elementKey(value: string): ElementKey { if (isElementKey(value)) return value; throw new Error(`Unsupported element ${value}.`); }
function relationMap(rows: readonly { attackerElementKey: string; defenderElementKey: string; relation: number }[]) { return new Map(rows.map((row) => [`${row.attackerElementKey}:${row.defenderElementKey}`, row.relation])); }
async function ensureLoadout(transaction: Prisma.TransactionClient, playerId: string) { await transaction.playerDailyCombatLoadout.upsert({ where: { playerId }, create: { playerId }, update: {} }); }
async function lockPlayer(transaction: Prisma.TransactionClient, playerId: string) { const rows = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`; if (!rows[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'Aucun joueur n’est lié à ce compte.'); }
async function isKo(client: Client, playerId: string, encounterId: string, characterId: string) { return Boolean(await client.playerDailyCombatKo.findUnique({ where: { playerId_encounterId_characterId: { playerId, encounterId, characterId } } })); }
async function readBalances(client: Client, playerId: string): Promise<PlayerResourceBalances> {
  const rows = await client.playerResourceBalance.findMany({ where: { playerId, resourceKey: { in: [...resourceKeys] } }, select: { resourceKey: true, amount: true } });
  const values = new Map(rows.map(({ resourceKey, amount }) => [resourceKey, amount]));
  if (!resourceKeys.every((key) => values.has(key))) throw new BusinessError('RESOURCE_STATE_INCOMPLETE', 'L’état des ressources du joueur est incomplet.');
  return Object.fromEntries(resourceKeys.map((key) => [key, values.get(key)!])) as PlayerResourceBalances;
}
