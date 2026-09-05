import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { SetGachaTarget } from '../src/application/gacha/gacha-services.js';
import { getParisWeekWindow } from '../src/domain/gacha/gacha.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Gacha database tests.');
const database = createDatabase(config.databaseUrl);
afterAll(async () => database.$disconnect());

describe('Gacha foundation on the development database', () => {
  it('has the complete catalog, RLS, state backfill and one concurrency-safe current banner', async () => {
    const store = new PrismaGachaStore(database);
    const window = getParisWeekWindow(new Date());
    expect(await database.bannerRotation.count({ where: { status: 'ACTIVE' } })).toBe(1);
    const select = () => { throw new Error('An existing weekly banner must not be regenerated.'); };
    const [first, second] = await Promise.all([store.ensureRotation(window.startsAt, window.endsAt, select), store.ensureRotation(window.startsAt, window.endsAt, select)]);
    expect(first.id).toBe(second.id);
    expect(first.featuredFiveStars).toHaveLength(4);
    expect(first.featuredFourStars).toHaveLength(6);
    expect(await database.character.count()).toBe(118);
    expect(await database.character.count({ where: { rarity: 5 } })).toBe(67);
    expect(await database.character.count({ where: { rarity: 4 } })).toBe(51);
    expect(await database.bannerRotation.count({ where: { status: 'ACTIVE' } })).toBe(1);
    expect(await database.player.count()).toBe(await database.playerGachaState.count());
    const rls = await database.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('characters','banner_rotations','banner_featured_characters','banner_votes','player_gacha_states')`;
    expect(rls).toHaveLength(5);
    expect(rls.every(({ relrowsecurity }) => relrowsecurity)).toBe(true);
  });

  it('persists a valid target without changing counters, resources or progression', async () => {
    const identity = { subject: `test-gacha-${randomUUID()}` };
    const playerStore = new PrismaCurrentPlayerStore(database);
    const player = (await new GetOrProvisionCurrentPlayer(playerStore).execute(identity, `Gacha ${randomUUID().slice(0, 8)}`)).player;
    try {
      const store = new PrismaGachaStore(database);
      const current = await store.getCurrent(player.id);
      const target = current!.banner.featuredFiveStars[0]!;
      const beforeBalances = await database.playerResourceBalance.findMany({ where: { playerId: player.id }, orderBy: { resourceKey: 'asc' } });
      const beforeProgression = await database.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } });
      const result = await new SetGachaTarget(new GetCurrentPlayer(playerStore), store).execute(identity, target.id);
      expect(result).toMatchObject({ selectedBannerCharacterId: target.id, pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, totalPulls: 0n });
      expect(await database.playerResourceBalance.findMany({ where: { playerId: player.id }, orderBy: { resourceKey: 'asc' } })).toEqual(beforeBalances);
      expect(await database.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })).toEqual(beforeProgression);
      await expect(store.setTarget(player.id, current!.banner.featuredFourStars[0]!.id)).rejects.toMatchObject({ code: 'GACHA_TARGET_INVALID' });
      await expect(store.setTarget(player.id, randomUUID())).rejects.toMatchObject({ code: 'GACHA_TARGET_INVALID' });
    } finally {
      await database.webIdentity.deleteMany({ where: { playerId: player.id } });
      await database.player.delete({ where: { id: player.id } });
    }
  });
});
